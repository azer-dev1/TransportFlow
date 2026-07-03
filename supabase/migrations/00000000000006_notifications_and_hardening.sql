-- Loose-end hardening, four independent pieces:
--   1. notifications get a read state + retention (30-day purge cron)
--   2. dead Expo push tokens become deletable by the Edge Function
--   3. trip_updates rejects duplicate staff reports (spam insurance)
--   4. admin role + promote_to_staff() RPC (staff promotion without raw SQL)

-- ---------- 1. notifications: read state ----------
-- read_at NULL = unread. The app marks read by setting the timestamp; a
-- column-level grant (same pattern as profiles.full_name) keeps user_id /
-- trip_id / message / sent_at immutable even though the row-level UPDATE
-- policy allows touching the row.
alter table public.notifications add column read_at timestamptz;

grant update (read_at) on public.notifications to authenticated;
create policy "notifications_update_own" on public.notifications
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Unread-badge queries are "count where user_id = me and read_at is null".
create index idx_notifications_unread
  on public.notifications(user_id) where read_at is null;

-- Retention: notifications are transient by nature; the trip row remains
-- the durable record. cron.schedule upserts by name, so re-running is safe.
select cron.schedule('purge-old-notifications', '45 3 * * *',
  $$delete from public.notifications where sent_at < now() - interval '30 days'$$);

-- ---------- 2. devices: let the Edge Function prune dead tokens ----------
-- Expo answers DeviceNotRegistered for uninstalled apps; notify-trip-update
-- now deletes those rows. service_role has no implicit grants in this
-- project (see migration 3 header), so the DELETE must be granted here.
grant delete on public.devices to service_role;

-- ---------- 3. trip_updates: duplicate-report guard ----------
-- Blocks an identical (status, delay) report on the same trip within 5
-- minutes — each insert fans out a webhook + pushes, so repeats are pure
-- spam. A *different* status or delay is always allowed (corrections).
-- BEFORE INSERT so a rejected row never reaches apply_trip_update or the
-- webhook trigger (both AFTER INSERT). Uses idx_trip_updates_trip_time.
create or replace function public.reject_duplicate_trip_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from public.trip_updates tu
    where tu.trip_id = new.trip_id
      and tu.status = new.status
      and tu.delay_minutes = new.delay_minutes
      and tu.created_at > now() - interval '5 minutes'
  ) then
    raise exception 'This exact status was already reported for this trip in the last 5 minutes.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists on_trip_update_reject_duplicate on public.trip_updates;
create trigger on_trip_update_reject_duplicate
  before insert on public.trip_updates
  for each row execute function public.reject_duplicate_trip_update();

-- ---------- 4. admin role + self-service staff promotion ----------
alter table public.profiles drop constraint profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('rider','staff','admin'));

-- Admins may also report trip status (superset of staff powers).
drop policy "trip_updates_insert_staff" on public.trip_updates;
create policy "trip_updates_insert_staff" on public.trip_updates
  for insert to authenticated
  with check (
    reporter_id = auth.uid()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('staff','admin')
    )
  );

-- SECURITY DEFINER (owner postgres) bypasses both RLS and the column-level
-- lock on profiles.role — the *only* client-reachable path that writes role,
-- and it self-gates on the caller being admin. Bootstrapping the first
-- admin remains a deliberate manual step (SQL editor / service_role).
create or replace function public.promote_to_staff(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  ) then
    raise exception 'Only admins can promote users to staff.' using errcode = '42501';
  end if;

  update public.profiles
  set role = 'staff'
  where id = target_user_id and role = 'rider';

  if not found then
    raise exception 'User not found, or not a rider.' using errcode = 'P0001';
  end if;
end;
$$;

revoke execute on function public.promote_to_staff(uuid) from public, anon;
grant execute on function public.promote_to_staff(uuid) to authenticated;
