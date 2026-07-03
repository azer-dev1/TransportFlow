-- Scheduling layer: trips stop being hand-seeded rows and become the
-- materialized output of a recurring timetable.
--
--   service_patterns  ("Blue Line departs 07:00, Mon-Sun")
--        |  materialize_trips(days_ahead)   -- nightly pg_cron + on-demand
--        v
--   trips             (concrete departures, unique per line+time)
--        |  complete_finished_trips()       -- every 10 min pg_cron
--        v
--   status 'completed' once the last stop's time (plus delay) has passed
--
-- Both jobs run inside Postgres via pg_cron; no external scheduler.

create extension if not exists pg_cron;

-- ---------- service_patterns: the recurring timetable ----------
-- departure_time is a local wall-clock time in `timezone`, so departures
-- stay at the same local hour across DST changes. days_of_week uses ISO
-- numbering (1 = Monday .. 7 = Sunday).
create table public.service_patterns (
  id uuid primary key default gen_random_uuid(),
  line_id uuid not null references public.lines(id) on delete cascade,
  departure_time time not null,
  days_of_week int[] not null default '{1,2,3,4,5,6,7}',
  timezone text not null default 'Africa/Tunis',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (line_id, departure_time),
  check (days_of_week <@ array[1,2,3,4,5,6,7] and cardinality(days_of_week) > 0)
);

-- Same catalog treatment as lines/stops/line_stops: readable by everyone,
-- writable only via seed/SQL editor/service_role (no client write policy).
alter table public.service_patterns enable row level security;
grant select on public.service_patterns to anon, authenticated;
create policy "service_patterns_select_all" on public.service_patterns
  for select to anon, authenticated using (true);

-- ---------- trips: unique per (line, departure) ----------
-- Materialization relies on ON CONFLICT DO NOTHING for idempotency, which
-- needs a unique index; it also supersedes the old non-unique lookup index
-- on the same columns.
drop index if exists public.idx_trips_line_time;
create unique index uq_trips_line_departure
  on public.trips(line_id, scheduled_departure);

-- 'completed' is set only by complete_finished_trips() below. It is
-- deliberately NOT added to trip_updates' status check: staff report
-- on_time/delayed/cancelled; completion is a lifecycle fact, not a report.
alter table public.trips drop constraint trips_status_check;
alter table public.trips add constraint trips_status_check
  check (status in ('on_time','delayed','cancelled','completed'));

-- ---------- materialize_trips: patterns -> concrete trips ----------
create or replace function public.materialize_trips(days_ahead int default 7)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted integer;
begin
  insert into public.trips (line_id, scheduled_departure)
  select
    p.line_id,
    -- date + time = local timestamp; AT TIME ZONE converts it to the
    -- absolute instant that wall-clock time means in the pattern's zone
    (d.local_day + p.departure_time) at time zone p.timezone
  from public.service_patterns p
  cross join lateral (
    -- "today" evaluated in the pattern's own timezone, not the server's
    select (now() at time zone p.timezone)::date + offs as local_day
    from generate_series(0, greatest(days_ahead, 1) - 1) as offs
  ) d
  where p.active
    and extract(isodow from d.local_day)::int = any (p.days_of_week)
  on conflict (line_id, scheduled_departure) do nothing;

  get diagnostics inserted = row_count;
  return inserted;
end;
$$;

-- ---------- complete_finished_trips: trip lifecycle ----------
-- A trip is finished once its delayed arrival at its line's last stop is
-- 5+ minutes in the past. Cancelled trips keep their status; a completed
-- trip can still be overwritten by a late staff correction via the
-- existing apply_trip_update trigger.
create or replace function public.complete_finished_trips()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  completed integer;
begin
  update public.trips t
  set status = 'completed',
      updated_at = now()
  where t.status in ('on_time', 'delayed')
    and t.scheduled_departure
        + make_interval(mins => t.delay_minutes)
        + make_interval(mins => coalesce((
            select max(ls.arrival_offset_minutes)
            from public.line_stops ls
            where ls.line_id = t.line_id), 0))
        + interval '5 minutes'
      < now();

  get diagnostics completed = row_count;
  return completed;
end;
$$;

-- Both functions are cron/service-only; without this revoke, PostgREST
-- would expose them as RPC to any authenticated client (harmless but
-- pointless for materialize, status-flipping for complete).
revoke execute on function public.materialize_trips(int) from public, anon, authenticated;
revoke execute on function public.complete_finished_trips() from public, anon, authenticated;

-- ---------- cron jobs ----------
-- cron.schedule(name, ...) upserts by name, so re-running is safe.
-- Nightly at 02:15 UTC keeps a rolling 7-day horizon of trips; even if the
-- job fails for days there is slack before the schedule runs dry.
select cron.schedule('materialize-trips', '15 2 * * *',
  $$select public.materialize_trips(7)$$);

-- Every 10 minutes, retire trips whose run has finished so "upcoming
-- departures" queries stay clean and stale delays don't linger.
select cron.schedule('complete-finished-trips', '*/10 * * * *',
  $$select public.complete_finished_trips()$$);
