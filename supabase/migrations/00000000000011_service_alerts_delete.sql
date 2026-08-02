-- Staff/admin can retract a service alert.
--
-- Migration 7 gave service_alerts an UPDATE policy ("end/amend an alert") but
-- no DELETE path at all, and nothing in the app ever called the UPDATE. So a
-- mistyped alert stayed on the line screen forever. This wires both ends:
-- a DELETE policy here, and "End now" / "Delete" actions in the line screen.

-- ---------- 1. delete ----------
grant delete on public.service_alerts to authenticated;

create policy "service_alerts_delete_staff" on public.service_alerts
  for delete to authenticated
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('staff','admin')
  ));

-- ---------- 2. narrow the UPDATE grant to the editable columns ----------
-- Same column-lock pattern as profiles.role in migration 2: the table-wide
-- UPDATE grant let a staff member rewrite line_id/created_by/created_at and
-- reassign authorship of someone else's alert. Now that the app actually
-- exercises the UPDATE path (End now), keep it to the bulletin-board fields.
-- A PATCH touching any other column gets a clean 42501 instead of succeeding.
revoke update on public.service_alerts from authenticated;
grant update(title, body, severity, starts_at, ends_at)
  on public.service_alerts to authenticated;

-- WITH CHECK so the post-update row still satisfies the staff predicate
-- (USING alone is only checked against the pre-update row).
drop policy "service_alerts_update_staff" on public.service_alerts;
create policy "service_alerts_update_staff" on public.service_alerts
  for update to authenticated
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('staff','admin')
  ))
  with check (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('staff','admin')
  ));
