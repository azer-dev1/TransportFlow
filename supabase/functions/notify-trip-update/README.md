# notify-trip-update

Notification fan-out Edge Function. **No Express in the path** — the whole flow is
Postgres + Edge Function:

```
staff INSERT into trip_updates
  → apply_trip_update()            (trigger: syncs trips current-state columns)
  → notify_trip_update_webhook()   (trigger: pg_net POST to this function)
  → this function                  (service_role):
       • find riders who favorited the affected line, or a stop it serves
       • INSERT a notifications row per rider (durable, RLS-readable by owner)
       • send an Expo push to each rider's registered devices (best-effort)
```

Defined across:
- `supabase/migrations/00000000000003_notify_trip_updates.sql` — `pg_net`, the
  `service_role` grants this function needs, the webhook trigger function, and the
  `trip_updates` AFTER INSERT trigger.
- `supabase/config.toml` — `[functions.notify-trip-update]` (`verify_jwt = true`).
- `supabase/seed.sql` — **local-only** Vault wiring (see below).

## Configuration (Vault)

The trigger reads two Vault secrets; until both exist it is a safe no-op:

| secret name             | value                                                        |
|-------------------------|--------------------------------------------------------------|
| `edge_url`              | full URL of this function                                    |
| `edge_service_role_key` | service_role JWT, sent as the webhook's `Authorization` Bearer |

**Local:** wired automatically by `supabase/seed.sql` on `supabase db reset`
(URL `http://host.docker.internal:54321/functions/v1/notify-trip-update`, plus the
public local demo service_role key — not a real secret).

**Hosted:** set the two secrets to real values (never commit the real key):

```sql
select vault.create_secret(
  'https://<project-ref>.supabase.co/functions/v1/notify-trip-update', 'edge_url');
select vault.create_secret('<real service_role key>', 'edge_service_role_key');
```

and deploy the function: `supabase functions deploy notify-trip-update`.

## Local testing when `functions serve` hangs

On some Windows setups `supabase functions serve` hangs at "Setting up Edge
Functions runtime..." (CLI 2.109.0, before any Docker activity). Workaround —
run the runtime container manually and point the Vault URL at it:

```powershell
docker run -d --name tf_edge_manual --network supabase_network_TransportFlow `
  -v "<repo>\supabase\functions:/home/deno/functions:ro" `
  -e SUPABASE_URL=http://supabase_kong_TransportFlow:8000 `
  -e SUPABASE_SERVICE_ROLE_KEY=<local demo service_role key> `
  public.ecr.aws/supabase/edge-runtime:v1.74.2 `
  start --main-service /home/deno/functions/notify-trip-update --port 9000
```

```sql
-- point the webhook at it (and restore the seed value when done)
do $$ declare v_id uuid; begin
  select id into v_id from vault.secrets where name = 'edge_url';
  perform vault.update_secret(v_id, 'http://tf_edge_manual:9000/', 'edge_url');
end $$;
```

Note this bypasses Kong, so `verify_jwt` is not enforced — local testing only.
Webhook responses (including this function's JSON reply) land in
`net._http_response`.

## Response

```json
{ "recipients": <n>, "notifications": <n>, "devices": <n>, "push_sent": <n> }
```

Push is best-effort: a failed Expo call is logged but never fails the webhook, since
the `notifications` row is the durable record.
