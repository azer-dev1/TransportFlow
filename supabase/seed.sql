-- =========================================================
-- Lines
-- =========================================================
insert into public.lines (id, name, mode) values
  ('11111111-1111-1111-1111-111111111111', 'Blue Line Express', 'bus'),
  ('22222222-2222-2222-2222-222222222222', 'Coastal Rail', 'train')
on conflict (id) do update set name = excluded.name, mode = excluded.mode;

-- =========================================================
-- Stops
-- =========================================================
insert into public.stops (id, name, latitude, longitude) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Central Station',  36.806389, 10.181667),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Market Square',    36.812000, 10.170000),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'University Ave',   36.820000, 10.165000),
  ('aaaaaaaa-0000-0000-0000-000000000004', 'Harbor View',      36.830000, 10.150000),
  ('bbbbbbbb-0000-0000-0000-000000000001', 'North Terminal',   36.850000, 10.200000),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'Riverside',        36.860000, 10.210000),
  ('bbbbbbbb-0000-0000-0000-000000000003', 'Airport Junction', 36.870000, 10.220000)
on conflict (id) do update
  set name = excluded.name, latitude = excluded.latitude, longitude = excluded.longitude;

-- =========================================================
-- line_stops (fixed ids so upsert is idempotent)
-- =========================================================
insert into public.line_stops (id, line_id, stop_id, sequence_order, arrival_offset_minutes) values
  ('cccccccc-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001', 1, 0),
  ('cccccccc-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000002', 2, 8),
  ('cccccccc-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000003', 3, 17),
  ('cccccccc-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000004', 4, 27),
  ('dddddddd-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'bbbbbbbb-0000-0000-0000-000000000001', 1, 0),
  ('dddddddd-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'bbbbbbbb-0000-0000-0000-000000000002', 2, 12),
  ('dddddddd-0000-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222', 'bbbbbbbb-0000-0000-0000-000000000003', 3, 25)
on conflict (id) do update
  set line_id = excluded.line_id,
      stop_id = excluded.stop_id,
      sequence_order = excluded.sequence_order,
      arrival_offset_minutes = excluded.arrival_offset_minutes;

-- =========================================================
-- Trips: date-relative, delete-and-reseed for the two demo lines so the
-- schedule is never empty regardless of when this script runs (today
-- through +2 days). Safe to re-run standalone (without a full db reset).
-- =========================================================
delete from public.trips
where line_id in (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222'
);

-- Bus: hourly departures 07:00-21:00, for today + next 2 days
insert into public.trips (line_id, scheduled_departure)
select
  '11111111-1111-1111-1111-111111111111',
  date_trunc('day', now()) + (d || ' days')::interval + interval '7 hours' + (h || ' hours')::interval
from generate_series(0, 2) as d
cross join generate_series(0, 14) as h;  -- 07:00 .. 21:00 hourly

-- Train: every 2 hours 06:00-20:00, for today + next 2 days
insert into public.trips (line_id, scheduled_departure)
select
  '22222222-2222-2222-2222-222222222222',
  date_trunc('day', now()) + (d || ' days')::interval + interval '6 hours' + (h * 2 || ' hours')::interval
from generate_series(0, 2) as d
cross join generate_series(0, 7) as h;  -- 06:00, 08:00, ... 20:00

-- =========================================================
-- Demo staff account promotion (idempotent — safe to re-run)
-- =========================================================
-- Prerequisite (manual, one-time): create the auth user first, since app
-- signup always defaults to 'rider' by design (see architecture review).
-- Either:
--   (a) Supabase Dashboard -> Authentication -> Add user, email =
--       staff-demo@transportflow.app, or
--   (b) have that address sign up once through the app.
-- Either way, the on_auth_user_created trigger creates the matching
-- profiles row with role='rider'. This block then promotes it:
update public.profiles
set role = 'staff'
where id = (select id from auth.users where email = 'staff-demo@transportflow.app');

-- =========================================================
-- Optional: one demo trip_update to show the delay-report flow end to
-- end. Only runs if the staff demo account above has already been created.
-- =========================================================
delete from public.trip_updates
where reporter_id = (select id from auth.users where email = 'staff-demo@transportflow.app');

insert into public.trip_updates (trip_id, reporter_id, status, delay_minutes)
select
  (select id from public.trips
   where line_id = '11111111-1111-1111-1111-111111111111'
     and scheduled_departure > now()
   order by scheduled_departure asc
   limit 1),
  (select id from auth.users where email = 'staff-demo@transportflow.app'),
  'delayed',
  6
where exists (select 1 from auth.users where email = 'staff-demo@transportflow.app');

-- favorites, devices, and notifications are intentionally NOT seeded here —
-- they require a real logged-in demo rider's UUID, which isn't knowable in
-- advance. Seed those from the app itself after a demo rider signs up, or
-- extend this script once a fixed demo-rider account is chosen the same
-- way as the staff account above.
