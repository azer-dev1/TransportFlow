-- Account deletion support.
--
-- Deleting an auth.users row cascades into profiles and from there into the
-- user's own data (favorites, devices, notifications, notification_prefs).
-- But staff attribution columns reference profiles WITHOUT a delete action,
-- so any staff/admin who ever reported a delay or created an alert could not
-- be deleted. Reports and alerts are network history, not personal data —
-- keep the rows, null the attribution. (The app already renders a missing
-- reporter as "Staff".)

alter table public.trip_updates alter column reporter_id drop not null;
alter table public.trip_updates drop constraint trip_updates_reporter_id_fkey;
alter table public.trip_updates
  add constraint trip_updates_reporter_id_fkey
  foreign key (reporter_id) references public.profiles(id) on delete set null;

alter table public.trips drop constraint trips_updated_by_fkey;
alter table public.trips
  add constraint trips_updated_by_fkey
  foreign key (updated_by) references public.profiles(id) on delete set null;

alter table public.service_alerts alter column created_by drop not null;
alter table public.service_alerts drop constraint service_alerts_created_by_fkey;
alter table public.service_alerts
  add constraint service_alerts_created_by_fkey
  foreign key (created_by) references public.profiles(id) on delete set null;
