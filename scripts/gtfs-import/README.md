# GTFS import

Replaces the hand-made demo network with a real city's GTFS feed, mapped onto
TransportFlow's model (`lines`, `stops`, `line_stops`, `service_patterns` —
trips are then materialized by the existing pg_cron job).

## Usage

```sh
cd scripts/gtfs-import
npm install

# Preview: parse the feed and write gtfs-import.sql without touching the DB
node index.mjs --file mouvenbus.zip --dry-run

# Apply to the hosted project (Management API)
SUPABASE_ACCESS_TOKEN=sbp_... node index.mjs --url https://transport.data.gouv.fr/resources/83429/download
```

- `--url` / `--file` — the GTFS zip. Any standard feed works; small networks
  (≤ ~50 routes) fit the free tier comfortably.
- `--prefix NAME` — id namespace for multi-feed imports (e.g. `--prefix transtu`).
  Feeds from different agencies often reuse GTFS ids (`route_id` "1"), which
  would otherwise collide. Re-running with the same prefix upserts in place;
  omitting it keeps compatibility with pre-prefix imports.
- `--max-routes N` — cap on imported routes, ranked by trip count (default 40).
- `--project-ref` — target project (default: the hosted TransportFlow ref,
  override via flag or `SUPABASE_PROJECT_REF`).
- `SUPABASE_ACCESS_TOKEN` — a personal access token (`supabase login` stores
  one; on Windows it lives in Credential Manager under `Supabase CLI:supabase`).

Idempotent: ids are md5-derived from GTFS ids, so re-running upserts in place;
`service_patterns` are replaced wholesale per imported line. To switch cities,
just run it again with another feed (old lines stay unless you delete them).

The currently imported feed is **Mouv'enbus** (CA Provence Verte, France) —
[dataset](https://transport.data.gouv.fr/datasets/reseau-transport-mouv-enbus-agglomeration-provence-verte),
Licence Ouverte v2.0.

## What gets lost in translation

The app models a line as one ordered stop list + recurring departures, so:

- Only each route's **dominant variant** (the exact stop sequence shared by
  the most trips) is imported — the reverse direction and school-run variants
  of the same route are dropped.
- **`calendar_dates.txt` exceptions** (holidays etc.) are ignored; feeds with
  no `calendar.txt` at all get a weekly pattern inferred from which weekdays
  occur in `calendar_dates`.
- Per-trip travel-time differences collapse to the representative trip's
  offsets; departures past midnight wrap to the next service day.
