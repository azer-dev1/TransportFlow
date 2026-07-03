# TransportFlow — Development Log

A plain-language recap of how this project was built, in order. Last updated: 2026-07-03.

## What TransportFlow is

A transit-tracking app: riders browse bus/train lines, see schedules and live trip
status, favorite lines/stops, and get push notifications when a favorited trip is
delayed or cancelled. Staff members report those delays/cancellations from inside the
same app.

## The architecture decision (before any code)

**No Express / no custom backend server.** The mobile app talks directly to Supabase
(PostgREST + Auth + Realtime), and Postgres **Row Level Security is the entire
enforcement layer** — every table has policies deciding who can read/write what.
The one piece of custom server logic (notification fan-out) is a Supabase **Edge
Function**, triggered by a database webhook. Consequence: there is nothing to deploy
to Render/Railway/etc. — hosting the backend means hosting the Supabase project,
and that's done.

## Phase 1 — Backend (`94aab11`, `5e32796`)

- **Schema** (`supabase/migrations/…01_init_schema.sql`): `profiles` (created
  automatically on signup by a trigger, `role` = rider|staff), `lines`, `stops`,
  `line_stops` (ordered stops per line with arrival offsets), `trips` (denormalized
  current status), `trip_updates` (append-only staff reports — a trigger,
  `apply_trip_update()`, syncs each insert into the trip's current state),
  `favorites`, `devices` (Expo push tokens), `notifications`.
- **RLS policies** (`…02_rls_policies.sql`): catalog readable by any signed-in user,
  favorites/devices/notifications owner-only, `trip_updates` insert restricted to
  staff. Note: `profiles` SELECT is deliberately read-all for authenticated users.
- **Notification pipeline** (`…03_notify_trip_updates.sql` + 
  `supabase/functions/notify-trip-update/`): insert into `trip_updates` → pg_net
  webhook (URL + service key read from Vault secrets `edge_url` /
  `edge_service_role_key`) → Edge Function finds everyone who favorited the line or
  a stop on it → writes `notifications` rows → sends Expo push to their `devices`.
- **Seed** (`supabase/seed.sql`): 2 demo lines, 7 stops, trips (originally
  hand-seeded for today + 2 days; replaced by the Phase 5 scheduling layer), demo
  staff promotion. Demo accounts: `rider-demo@transportflow.app` /
  `staff-demo@transportflow.app`, password `password123`.

## Phase 2 — Mobile app, 7 steps (branch `feat/mobile-auth`, PR #2)

Built with **Expo SDK 57 + expo-router** (file-based routing under `mobile/src/app/`).

1. **Foundation + auth** (`5c4a0ff`): typed Supabase client
   (`src/lib/supabase.ts` + generated `database.types.ts`), `AuthProvider`
   (session + profile), `Stack.Protected` route guarding, sign-in/sign-up screens.
2. **Browse** (`7da72ae`): lines list (home) → line detail (stops timeline +
   upcoming departures) → trip rows.
3. **Live trip detail** (`5e9665d`): `trips/[id]` subscribes to Supabase Realtime
   (trip UPDATEs + new trip_updates) and refetches — a staff report appears on a
   rider's open screen within a second. Migration 4 adds both tables to the
   `supabase_realtime` publication (nothing streams without that).
4. **Favorites** (`c161866`): star toggles on line detail, `/favorites` screen.
5. **Push notifications** (`afec91d`): registers the device's Expo push token,
   deep-links notification taps to the trip screen.
6. **Staff mode** (`64d9c15`): staff-only report card on trip detail
   (on-time / delayed + minutes / cancelled).

Everything was verified with live smoke tests against the local stack: auth + RLS
denials, the realtime loop, favorites constraints, and a full notification fan-out.

## Phase 3 — Getting it on a real phone (`5321566`, `54d3405`)

Expo Go **does not work** for this app on the test phone (OPPO, Android 11): Expo
Go's bundled worklets runtime crashes natively at startup (pulled in by expo-router →
reanimated, even though the app doesn't use it). Fix: an **EAS development build** —
a custom dev shell app built in Expo's cloud (`eas build --profile development
--platform android`), installed once on the phone. `expo-notifications` is also
guarded out of Expo Go. EAS project: id `f6939a50-3975-40a1-8699-18b7c6fc8a16`,
owner `azer-dev`, package `com.azerdev.transportflow`.

**Daily testing workflow:** `cd mobile && npx expo start`, phone on the same Wi-Fi,
open the TransportFlow dev app. JS/TS changes hot-reload; a new `eas build` is only
needed when native modules or `app.json` native config change.

## Phase 4 — Hosting (2026-07-03)

Local Docker Supabase was eating all the RAM, so the backend moved to a **hosted
Supabase project**: ref `cxekufirfbjoieztiqbz` (eu-west-2),
`https://cxekufirfbjoieztiqbz.supabase.co`. Applied and verified: all 4 migrations
(`npx supabase db push`), Edge Function deployed (`npx supabase functions deploy
notify-trip-update`), Vault secrets set with the real hosted values, catalog + demo
users seeded, webhook round-trip confirmed (HTTP 200 in `net._http_response`).
`mobile/.env` points at the hosted URL + anon key. **Docker is no longer needed.**

Caveats: the free tier pauses the DB after ~1 week of inactivity (restore from the
dashboard); never commit the hosted `service_role` key; never run seed.sql's
"LOCAL DEV ONLY" Vault block against the hosted project.

## Phase 5 — A real timetable: service patterns + pg_cron (2026-07-03)

The seed only generated trips for today + 2 days, so the schedule would have gone
permanently empty on 2026-07-06. Migration `…05_service_patterns.sql` turns trips
into the materialized output of a recurring timetable, entirely inside Postgres:

- **`service_patterns`** — one row per recurring departure ("Blue Line, 07:00,
  Mon–Sun"), with wall-clock times in a per-pattern timezone (`Africa/Tunis`) so
  departures survive DST. Catalog-style RLS: clients read, only seed/SQL writes.
- **`materialize_trips(days_ahead)`** — expands patterns into concrete `trips`
  rows; idempotent thanks to a new `UNIQUE (line_id, scheduled_departure)` index.
  A **pg_cron** job (`materialize-trips`, 02:15 UTC nightly) keeps a rolling
  7-day horizon.
- **`complete_finished_trips()`** — second cron (`complete-finished-trips`, every
  10 min) marks trips **`completed`** (new status) once departure + delay + the
  line's last arrival offset + 5 min grace has passed, so "upcoming departures"
  stay clean and stale delays don't linger. Deliberately not a valid
  `trip_updates` status — completion is a lifecycle fact, not a staff report.
- Both functions are SECURITY DEFINER with EXECUTE revoked from clients (not
  exposed as RPC). The seed's trip blocks were replaced by pattern upserts + one
  `materialize_trips(7)` call.

Deployed to hosted the same day: patterns seeded, 7 days of trips materialized,
both cron jobs verified running (`cron.job_run_details`). One cleanup: the old
seed wrote UTC wall times, patterns write Tunis local — 22 leftover off-by-1h
"phantom" future trips were deleted (any trip with staff reports was kept).

## Phase 6 — Loose-end hardening (2026-07-03)

Migration `…06_notifications_and_hardening.sql` + an Edge Function update, closing
four gaps in what was already built:

- **Notification read state + retention**: `notifications.read_at` (NULL = unread),
  an owner-only UPDATE policy column-locked to `read_at` (same pattern as
  `profiles.full_name`), a partial index for unread-count queries, and a
  `purge-old-notifications` cron (03:45 UTC daily, deletes rows older than 30
  days). The app can now show "3 unread" once a notifications screen exists.
- **Dead push tokens get pruned**: `notify-trip-update` now reads Expo's push
  tickets and deletes `devices` rows whose token comes back
  `DeviceNotRegistered` (app uninstalled), instead of ignoring the response.
  Needed a `service_role` DELETE grant on `devices`.
- **Duplicate-report guard**: a BEFORE INSERT trigger on `trip_updates` rejects an
  identical (status, delay) report on the same trip within 5 minutes — each
  insert fans out a webhook + pushes, so repeats are pure spam. Corrections
  (different status or delay) always go through.
- **Admin role + `promote_to_staff(user_id)` RPC**: `profiles.role` now allows
  `admin`; the SECURITY DEFINER RPC is the only client-reachable path that
  writes `role` and refuses non-admin callers. Admins can also report trip
  status. Bootstrapping the first admin is still a manual SQL step.

All verified live on hosted with rolled-back transactional tests (duplicate
blocked, correction allowed, promotion gated, no rows leaked).

## Where things stand / what's next

- PR #1 (`feat/notification-webhook`) and PR #2 (`feat/mobile-auth`, stacked on #1)
  are open — merge #1 first, then #2.
- **FCM V1 credentials** (`eas credentials`) are still needed before Android push
  notifications actually deliver to the phone.
- Later: shareable `preview` APK builds, then Play Store via the `production` profile.

## Gotchas worth remembering

- `mobile/.npmrc` has `legacy-peer-deps=true` — an upstream react/react-dom peer
  conflict; don't remove it.
- Regenerate DB types after schema changes:
  `npx supabase gen types typescript --local > mobile/src/lib/database.types.ts`
  (or `--project-id cxekufirfbjoieztiqbz` against hosted).
- SDK 57: never import `@react-navigation/*` directly — use expo-router's exports.
- Realtime in scripts/tests: `SUBSCRIBED` fires before the server registers the
  postgres_changes listener; wait for the system confirmation message or early
  writes are silently dropped.
- `supabase functions serve` hangs on this machine — see
  `supabase/functions/notify-trip-update/README.md` for the manual workaround.
