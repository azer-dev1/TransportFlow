alter table public.profiles      enable row level security;
alter table public.lines         enable row level security;
alter table public.stops         enable row level security;
alter table public.line_stops    enable row level security;
alter table public.trips         enable row level security;
alter table public.trip_updates  enable row level security;
alter table public.favorites     enable row level security;
alter table public.devices       enable row level security;
alter table public.notifications enable row level security;

-- ---------- table-level GRANTs (the privilege ceiling RLS narrows within) ----------
-- config.toml leaves auto_expose_new_tables unset (the new Supabase default), so newly
-- created tables are NOT auto-granted to the anon/authenticated API roles. RLS policies
-- only narrow access that a GRANT already opened; without these grants PostgREST returns
-- permission-denied regardless of policy. Explicit grants are idempotent and correct
-- whether or not image defaults exist.
grant select on public.lines, public.stops, public.line_stops to anon, authenticated;
grant select on public.trips, public.notifications, public.profiles to authenticated;
-- audit log: read all, insert gated to staff by RLS below
grant select, insert on public.trip_updates to authenticated;
-- owner CRUD (RLS restricts to user_id = auth.uid())
grant select, insert, update, delete on public.favorites to authenticated;
grant select, insert, update, delete on public.devices   to authenticated;
-- NOTE: profiles UPDATE is deliberately locked to the full_name column only, at the very
-- bottom of this file (revoke update + grant update(full_name)) so role stays unwritable.

-- ---------- lines / stops / line_stops: seed-only catalog data ----------
-- No client write policy — MVP has no "create a line/stop" UI. Seeding
-- and any future admin tooling runs via the SQL editor / service_role
-- key, which bypasses RLS entirely.
create policy "lines_select_all" on public.lines
  for select to anon, authenticated using (true);

create policy "stops_select_all" on public.stops
  for select to anon, authenticated using (true);

create policy "line_stops_select_all" on public.line_stops
  for select to anon, authenticated using (true);

-- ---------- trips: read-only to clients ----------
create policy "trips_select_authenticated" on public.trips
  for select to authenticated using (true);
-- Intentionally no insert/update/delete policy. All state changes go
-- through trip_updates + the apply_trip_update trigger (SECURITY DEFINER,
-- bypasses RLS as table owner) — this keeps every status change
-- attributable to an audit-log row.

-- ---------- trip_updates: append-only audit log, staff-only insert ----------
create policy "trip_updates_select_authenticated" on public.trip_updates
  for select to authenticated using (true);

create policy "trip_updates_insert_staff" on public.trip_updates
  for insert to authenticated
  with check (
    reporter_id = auth.uid()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'staff'
    )
  );
-- No update/delete policy: true append-only log. A staff correction is a
-- new INSERT, not an edit of a prior entry.

-- ---------- favorites: owner CRUD ----------
create policy "favorites_owner_crud" on public.favorites
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------- devices: owner CRUD ----------
create policy "devices_owner_crud" on public.devices
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------- notifications: read own only, no client insert path ----------
create policy "notifications_select_own" on public.notifications
  for select to authenticated using (user_id = auth.uid());
-- Deliberately NO insert policy for anon/authenticated. Only the future
-- notification Edge Function (using the service_role key, which bypasses
-- RLS) writes these.

-- ---------- profiles: read-all, self-update, role column locked down ----------
create policy "profiles_select_authenticated" on public.profiles
  for select to authenticated using (true);
-- No insert policy: rows are only ever created by the SECURITY DEFINER
-- handle_new_user() trigger, which bypasses RLS as the function owner.

create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Lock down the `role` column so riders cannot self-promote to staff even
-- though the row-level UPDATE policy above allows updating their own row.
-- Column-level GRANT/REVOKE is enforced by Postgres/PostgREST independently
-- of RLS: a PATCH that touches `role` gets a clean 42501 permission error
-- rather than being silently accepted or reverted.
revoke update on public.profiles from authenticated;
grant update (full_name) on public.profiles to authenticated;
