-- Realtime postgres_changes only streams tables that are members of the
-- supabase_realtime publication; nothing is published by default. The
-- live trip-detail screen subscribes to:
--   * trips UPDATE  (status/delay synced by the apply_trip_update trigger)
--   * trip_updates INSERT (the append-only audit rows themselves)
-- RLS still gates delivery per subscriber; both tables already have
-- select-to-authenticated policies (migration 2).
alter publication supabase_realtime add table public.trips, public.trip_updates;
