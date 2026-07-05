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

The currently imported feeds (2026-07-04) are Tunisian, from the Ministry of
Transport's open-data portal ([catalogue-data.transport.tn](https://catalogue-data.transport.tn)):

| prefix        | feed                                   | imported                 |
| ------------- | -------------------------------------- | ------------------------ |
| `transtu`     | TRANSTU (Tunis métro léger 1 + TGM)    | 3 lines / 31 stops       |
| `soretrak`    | SORETRAK (Kairouan buses)              | 34 lines / 189 stops     |
| `sntri`       | SNTRI (intercity coaches)              | 23 lines / 157 stops     |
| `sncft-sahel` | SNCFT Métro du Sahel (hand-authored)   | 2 lines / 32 stops       |
| `sts`         | STS Sahel buses (converted, 2016 data) | 16 lines / ~65 stops     |

SNCFT's own GTFS dataset has no files uploaded, so `feeds/sncft-sahel/` is
hand-built (see below). The TRANSTU feed is a 2019 pilot — métro lines 2–6 and
the bus network are absent, and its two schedule-less routes (ligne2, ligne28)
are dropped automatically. SORETRAK also publishes GTFS-Realtime, unused so far.

## Hand-authored feed: `feeds/sncft-sahel/`

The Métro du Sahel (Sousse — Monastir — Mahdia) has no machine-readable
schedule anywhere, so the official été 2026 timetable poster was transcribed
into a minimal GTFS (station list from the portal's "Cartographie des stations
du Banlieue sahel" CSV; provenance and method in `build.mjs`). Regenerate and
import with:

```sh
cd feeds/sncft-sahel
node build.mjs
SUPABASE_ACCESS_TOKEN=sbp_... node ../../index.mjs --file sncft-sahel.gtfs.zip --prefix sncft-sahel
```

## Converted feed: STS (`sts-convert.mjs`)

STS publishes a `.zip` that is actually a RAR v4 of UTF-16 tab-separated
files — GTFS-shaped but broken (misspelled headers, `DD/MM/YYYY` dates,
`stop-times.txt` filename, no stop coordinates, Arabic-only names).
`sts-convert.mjs` repairs all of that and joins coordinates + Latin names for
the scheduled stops from the Référentiel National d'Arrêts (the mapping table
lives in the converter). Only 16 of the feed's 265 routes carry trips; the
schedules date from 2016.

```sh
# extract the RAR first (bsdtar handles it): tar -xf sts.zip
node sts-convert.mjs --dir <extracted STS dir> --out sts.gtfs.zip
SUPABASE_ACCESS_TOKEN=sbp_... node index.mjs --file sts.gtfs.zip --prefix sts
```

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
