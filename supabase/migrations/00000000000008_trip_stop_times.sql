-- Server-side ETAs: one row per (trip, stop) with the arrival math done in
-- SQL, so clients render times instead of computing them. security_invoker
-- makes the view run with the caller's privileges — the underlying tables'
-- RLS (trips: authenticated-only) keeps applying instead of being silently
-- bypassed via the view owner.
create view public.trip_stop_times
with (security_invoker = true) as
select
  t.id  as trip_id,
  t.line_id,
  ls.id as line_stop_id,
  ls.stop_id,
  s.name as stop_name,
  ls.sequence_order,
  t.scheduled_departure,
  t.status,
  t.delay_minutes,
  t.scheduled_departure
    + make_interval(mins => ls.arrival_offset_minutes) as scheduled_arrival,
  -- NULL when cancelled: there is no expected arrival. Delay shifts every
  -- stop uniformly (the same assumption the completion cron makes).
  case
    when t.status = 'cancelled' then null
    else t.scheduled_departure
      + make_interval(mins => ls.arrival_offset_minutes)
      + make_interval(mins => case when t.status = 'delayed' then t.delay_minutes else 0 end)
  end as expected_arrival
from public.trips t
join public.line_stops ls on ls.line_id = t.line_id
join public.stops s on s.id = ls.stop_id;

-- Matches trips' exposure: authenticated only (lines/stops are anon-readable
-- but trips are not, and the view is only as open as its narrowest table).
grant select on public.trip_stop_times to authenticated;
