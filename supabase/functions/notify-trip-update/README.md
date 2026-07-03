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

## Response

```json
{ "recipients": <n>, "notifications": <n>, "devices": <n>, "push_sent": <n> }
```

Push is best-effort: a failed Expo call is logged but never fails the webhook, since
the `notifications` row is the durable record.
