-- Four pure-Postgres capabilities:
--   1. typo-tolerant stop/line search        (pg_trgm + search_* RPCs)
--   2. "stops around me"                     (earthdistance + nearby_stops RPC)
--   3. line-level service alerts             (new table riding the existing
--                                             webhook -> Edge Function fan-out)
--   4. notification preferences              (mute per favorite, quiet hours)

-- ---------- 1. search: pg_trgm ----------
create extension if not exists pg_trgm with schema extensions;

-- GIN trigram indexes make % / <% and ILIKE '%...%' index-assisted.
create index idx_stops_name_trgm on public.stops
  using gin (name extensions.gin_trgm_ops);
create index idx_lines_name_trgm on public.lines
  using gin (name extensions.gin_trgm_ops);

-- Typo-tolerant: trigram similarity catches "centrl station" -> Central
-- Station; word_similarity (<%) catches short partial queries ("centr");
-- ILIKE catches plain substrings the similarity threshold would miss.
-- SECURITY INVOKER (the default): results stay gated by the caller's RLS.
create or replace function public.search_stops(query text, max_results int default 10)
returns table (id uuid, name text, latitude numeric, longitude numeric, rank real)
language sql
stable
set search_path = public, extensions
as $$
  select s.id, s.name, s.latitude, s.longitude,
         greatest(similarity(s.name, query), word_similarity(query, s.name)) as rank
  from public.stops s
  where s.name % query
     or query <% s.name
     or s.name ilike '%' || query || '%'
  order by rank desc, s.name
  limit greatest(max_results, 1)
$$;

create or replace function public.search_lines(query text, max_results int default 10)
returns table (id uuid, name text, mode text, rank real)
language sql
stable
set search_path = public, extensions
as $$
  select l.id, l.name, l.mode,
         greatest(similarity(l.name, query), word_similarity(query, l.name)) as rank
  from public.lines l
  where l.name % query
     or query <% l.name
     or l.name ilike '%' || query || '%'
  order by rank desc, l.name
  limit greatest(max_results, 1)
$$;

-- ---------- 2. nearby stops: earthdistance ----------
create extension if not exists cube with schema extensions;
create extension if not exists earthdistance with schema extensions;

-- Great-circle GiST index. NOTE: earthdistance's SQL helpers resolve cube
-- operators through search_path at call time — fine on Supabase, whose
-- database default search_path includes `extensions`.
create index idx_stops_earth on public.stops
  using gist (extensions.ll_to_earth(latitude::float8, longitude::float8));

-- earth_box is a fast bounding-box prefilter (uses the GiST index);
-- earth_distance then exacts the great-circle cut. distance_m in meters.
create or replace function public.nearby_stops(
  lat double precision,
  lng double precision,
  radius_m double precision default 1000
)
returns table (id uuid, name text, latitude numeric, longitude numeric, distance_m double precision)
language sql
stable
set search_path = public, extensions
as $$
  select s.id, s.name, s.latitude, s.longitude,
         earth_distance(ll_to_earth(lat, lng),
                        ll_to_earth(s.latitude::float8, s.longitude::float8)) as distance_m
  from public.stops s
  where earth_box(ll_to_earth(lat, lng), radius_m)
          @> ll_to_earth(s.latitude::float8, s.longitude::float8)
    and earth_distance(ll_to_earth(lat, lng),
                       ll_to_earth(s.latitude::float8, s.longitude::float8)) <= radius_m
  order by distance_m
$$;

-- ---------- 3. service alerts ----------
-- Line-level announcements ("strike Friday", "station closed"). INSERT rides
-- the same Vault-configured webhook to the notify-trip-update Edge Function,
-- which branches on payload.table and reuses the favorites fan-out.
create table public.service_alerts (
  id uuid primary key default gen_random_uuid(),
  line_id uuid not null references public.lines(id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  body text not null,
  severity text not null default 'info' check (severity in ('info','warning','disruption')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at)
);
create index idx_service_alerts_line on public.service_alerts(line_id, starts_at desc);

alter table public.service_alerts enable row level security;
grant select on public.service_alerts to anon, authenticated;
grant insert, update on public.service_alerts to authenticated;

create policy "service_alerts_select_all" on public.service_alerts
  for select to anon, authenticated using (true);

create policy "service_alerts_insert_staff" on public.service_alerts
  for insert to authenticated
  with check (
    created_by = auth.uid()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('staff','admin')
    )
  );

-- Staff may end/amend an alert (set ends_at, fix wording) — unlike
-- trip_updates this is a bulletin board, not an audit log.
create policy "service_alerts_update_staff" on public.service_alerts
  for update to authenticated
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('staff','admin')
  ));

-- Same Vault-driven webhook as trip_updates (migration 3), same edge_url;
-- the function branches on the table name in the payload.
create or replace function public.notify_service_alert_webhook()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text;
  v_key text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'edge_url';
  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'edge_service_role_key';

  if v_url is null or v_url = '' then
    return new;  -- webhook not configured for this environment
  end if;

  perform net.http_post(
    url     := v_url,
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || coalesce(v_key, '')
    ),
    body    := jsonb_build_object(
      'type',   'INSERT',
      'table',  'service_alerts',
      'schema', 'public',
      'record', to_jsonb(new)
    ),
    timeout_milliseconds := 5000
  );
  return new;
end;
$$;

drop trigger if exists on_service_alert_notify on public.service_alerts;
create trigger on_service_alert_notify
  after insert on public.service_alerts
  for each row execute function public.notify_service_alert_webhook();

-- ---------- 4. notification preferences ----------
-- Mute per favorite: a muted favorite still shows in the app but is
-- excluded from fan-out recipient computation entirely (no row, no push).
-- favorites_owner_crud (FOR ALL) + the existing UPDATE grant already cover
-- clients toggling it.
alter table public.favorites add column muted boolean not null default false;

-- Quiet hours: per-user window (user-local wall clock) during which the
-- Edge Function still writes the notifications row but skips the push.
-- NULL start/end = no quiet hours. A window may wrap midnight (22:00-07:00).
create table public.notification_prefs (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  quiet_start time,
  quiet_end time,
  timezone text not null default 'Africa/Tunis',
  check ((quiet_start is null) = (quiet_end is null))
);

alter table public.notification_prefs enable row level security;
grant select, insert, update, delete on public.notification_prefs to authenticated;
create policy "notification_prefs_owner_crud" on public.notification_prefs
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- The Edge Function consults prefs during fan-out (see migration 3 header
-- for why service_role needs explicit grants).
grant select on public.notification_prefs to service_role;
