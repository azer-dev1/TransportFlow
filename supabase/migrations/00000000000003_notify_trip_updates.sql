-- =====================================================================
-- Notification fan-out (no Express in the path).
--
-- Flow:  staff INSERT into trip_updates
--          -> apply_trip_update()          (syncs trips current-state)
--          -> notify_trip_update_webhook() (this file) posts the row to the
--             notify-trip-update Edge Function via pg_net
--          -> Edge Function writes notifications rows + sends Expo push,
--             using the service_role key (bypasses RLS).
-- =====================================================================

create extension if not exists pg_net;

-- ---------------------------------------------------------------------
-- service_role table grants for the Edge Function.
-- config.toml leaves auto_expose_new_tables unset, so service_role gets NO
-- SELECT/INSERT by default (BYPASSRLS only skips policies, it is not a GRANT).
-- Grant precisely what notify-trip-update needs — nothing more. Future
-- service_role consumers must add their own grants here.
-- ---------------------------------------------------------------------
grant select on public.trips, public.lines, public.line_stops,
                public.favorites, public.devices to service_role;
grant insert on public.notifications to service_role;

-- ---------------------------------------------------------------------
-- Webhook trigger. Reads the target URL + auth key from Vault so no secret
-- lives in the schema or in git; SECURITY DEFINER means client roles never
-- get to read Vault themselves. No-op until the two secrets are configured
-- (safe in prod before setup, and in plain-SQL/CI environments).
-- ---------------------------------------------------------------------
create or replace function public.notify_trip_update_webhook()
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
      'table',  'trip_updates',
      'schema', 'public',
      'record', to_jsonb(new)
    ),
    timeout_milliseconds := 5000
  );
  return new;
end;
$$;

-- Trigger names sort so this fires AFTER on_trip_update_insert (apply_trip_update):
-- '_insert' < '_notify'. The trip's current-state columns are therefore already
-- synced by the time the webhook fires.
drop trigger if exists on_trip_update_notify on public.trip_updates;
create trigger on_trip_update_notify
  after insert on public.trip_updates
  for each row execute function public.notify_trip_update_webhook();
