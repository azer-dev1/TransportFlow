create extension if not exists "pgcrypto";

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role text not null default 'rider' check (role in ('rider','staff')),
  created_at timestamptz not null default now()
);

create table public.lines (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  mode text not null check (mode in ('bus','train')),
  created_at timestamptz not null default now()
);

create table public.stops (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  latitude numeric(9,6) not null,
  longitude numeric(9,6) not null
);

create table public.line_stops (
  id uuid primary key default gen_random_uuid(),
  line_id uuid not null references public.lines(id) on delete cascade,
  stop_id uuid not null references public.stops(id) on delete cascade,
  sequence_order int not null,
  -- minutes after the parent trip's scheduled_departure that the
  -- vehicle is expected to reach this stop
  arrival_offset_minutes int not null default 0 check (arrival_offset_minutes >= 0)
);
create index idx_line_stops_order on public.line_stops(line_id, sequence_order);

-- status/delay_minutes are a denormalized "current state" cache kept in
-- sync by the trip_updates trigger below; there is no client-facing
-- UPDATE path onto this table (see RLS migration).
create table public.trips (
  id uuid primary key default gen_random_uuid(),
  line_id uuid not null references public.lines(id) on delete cascade,
  scheduled_departure timestamptz not null,
  status text not null default 'on_time' check (status in ('on_time','delayed','cancelled')),
  delay_minutes int not null default 0,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);
create index idx_trips_line_time on public.trips(line_id, scheduled_departure);

-- append-only delay-report event log / audit trail
create table public.trip_updates (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  reporter_id uuid not null references public.profiles(id),
  status text not null check (status in ('on_time','delayed','cancelled')),
  delay_minutes int not null default 0,
  created_at timestamptz not null default now()
);
create index idx_trip_updates_trip_time on public.trip_updates(trip_id, created_at desc);

create table public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  line_id uuid references public.lines(id) on delete cascade,
  stop_id uuid references public.stops(id) on delete cascade,
  check (
    (line_id is not null and stop_id is null) or
    (line_id is null and stop_id is not null)
  ),
  unique nulls not distinct (user_id, line_id, stop_id)
);

create table public.devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  expo_push_token text not null,
  unique (user_id, expo_push_token)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  trip_id uuid references public.trips(id) on delete cascade,
  message text not null,
  sent_at timestamptz not null default now()
);

-- Auto-create a profiles row on signup so an app-layer insert can never
-- strand a user with an auth record but no profile. Reads full_name from
-- signUp({ options: { data: { full_name } } }); falls back to the email's
-- local part if not supplied.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
      split_part(new.email, '@', 1),
      'New Rider'
    ),
    'rider'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keeps trips' denormalized current-state columns in sync with the
-- append-only trip_updates log, in the same transaction as the insert.
create or replace function public.apply_trip_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.trips
  set status        = new.status,
      delay_minutes = new.delay_minutes,
      updated_by    = new.reporter_id,
      updated_at    = new.created_at
  where id = new.trip_id;
  return new;
end;
$$;

drop trigger if exists on_trip_update_insert on public.trip_updates;
create trigger on_trip_update_insert
  after insert on public.trip_updates
  for each row execute function public.apply_trip_update();
