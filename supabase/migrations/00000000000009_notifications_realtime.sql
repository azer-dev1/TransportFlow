-- The notifications screen badge updates live: the app subscribes to
-- INSERT (new notification) and UPDATE (read elsewhere) on notifications.
-- RLS still gates delivery per subscriber (owner-only select policy).
alter publication supabase_realtime add table public.notifications;
