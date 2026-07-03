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

## Phase 7 — Search, nearby stops, service alerts, notification prefs (2026-07-03)

Migration `…07_search_nearby_alerts_prefs.sql` + an Edge Function extension — four
new capabilities, all pure Postgres:

- **Typo-tolerant search**: `pg_trgm` GIN indexes on stop/line names +
  `search_stops(query)` / `search_lines(query)` RPCs (trigram + word similarity +
  substring; "centrl station" → Central Station at rank 0.72). SECURITY INVOKER,
  so results stay behind the caller's RLS.
- **Nearby stops**: `cube`/`earthdistance` + a GiST `ll_to_earth` index +
  `nearby_stops(lat, lng, radius_m)` RPC returning stops with `distance_m`,
  bounding-box prefiltered then exact great-circle. A future map screen is a
  render layer over this one call.
- **Service alerts**: `service_alerts` table (line-level announcements with
  severity + optional `ends_at`; staff/admin insert & update, everyone reads).
  INSERT fires the same Vault-configured webhook to `notify-trip-update`, which
  now branches on `payload.table` and reuses the favorites fan-out. Alert pushes
  deep-link to the line screen (`data.line_id`).
- **Notification preferences**: `favorites.muted` (a muted favorite is excluded
  from fan-out entirely) and `notification_prefs` (per-user quiet hours in the
  user's own timezone — during the window the notification row is still written,
  only the push is suppressed).

Verified live on hosted: search + nearby RPC results, then three real alert
fan-outs through the webhook — normal (1 recipient, 1 notification, and the
demo's fake push token correctly pruned as `DeviceNotRegistered` — the Phase 6
prune path confirmed against Expo's real API), quiet-hours (row written,
`quiet_skipped: 1`, no push), and muted (`recipients: 0`). Test alerts,
notifications, and prefs were cleaned up afterwards. Note: hosted had **no
favorites rows** until now — rider-demo's Central Station favorite + fake device
token were re-created there as durable demo fixtures (matching the old local
stack).

## Phase 8 — Server-side ETAs + free-tier keep-alive (2026-07-03)

- **`trip_stop_times` view** (migration `…08`): one row per (trip, stop) with
  `scheduled_arrival` and `expected_arrival` (offset + delay; NULL when
  cancelled) computed in SQL. `security_invoker = true` so the underlying
  tables' RLS still applies through the view; SELECT granted to authenticated
  only (same exposure as `trips`). The trip detail screen now renders these
  rows instead of doing `departure + offset + delay` math in JS — delay math
  lives in exactly one place.
- **Keep-alive** (`.github/workflows/supabase-keepalive.yml`): the free tier
  pauses projects after ~1 week idle; the action curls one REST query
  (Mon + Thu, 06:17 UTC) using the `SUPABASE_ANON_KEY` repo secret (already
  set on `azer-dev1/TransportFlow` — it's the publishable anon key, not
  service_role). Scheduled workflows run from the default branch, so it
  activates when this branch merges to master; until then it can be run
  manually via workflow_dispatch.

## Phase 9 — GTFS import: a real network (2026-07-03)

`scripts/gtfs-import/` (Node, `adm-zip` + `csv-parse`) downloads any standard
GTFS zip and maps it onto our model: routes → `lines`, served stops → `stops`,
each route's **dominant stop sequence** (the one shared by the most trips) →
`line_stops` with offsets from its representative trip, and first-stop
departure times × `calendar.txt` weekdays → `service_patterns` (merged per
departure time; after-midnight departures wrap the weekday). Ids are
md5-derived from GTFS ids so re-runs upsert in place; patterns are replaced
wholesale per line. Applies via the Management API (`SUPABASE_ACCESS_TOKEN`)
in batched statements, or `--dry-run` writes the SQL to a file.

Imported feed: **Mouv'enbus** (CA Provence Verte, France — Licence Ouverte
v2.0, 31 routes / 195 served stops / 100 departure patterns). The hand-made
demo lines and stops were deleted; rider-demo now favorites the busiest real
stop (Place Clemenceau, Brignoles) so notification demos keep working.
Verified on hosted: 362 trips materialized for the week, typo search
("clemencau" → Place Clemenceau), nearby-stops around Brignoles centre, and
correct Paris-time → UTC conversion (07:00 local = 05:00 UTC departures).

Accepted lossiness (documented in the script's README): one direction per
route, `calendar_dates.txt` exceptions ignored (school lines won't stop for
holidays), representative travel times. Swapping cities = re-running the
script with another feed URL.

## Phase 10 — App screens for the Phase 7 backend (2026-07-03)

Migration `…09` (notifications added to the realtime publication) + five screens
of UI wiring, no new backend logic:

- **Search on home**: debounced input over the `search_lines` / `search_stops`
  RPCs; stop hits show chips of the lines serving them (with 31 real lines,
  browsing without search was getting clunky).
- **Notifications screen + live unread badge**: bell in the home header with a
  count from `useUnreadCount` (head-count query + realtime INSERT/UPDATE
  subscription); the screen marks everything read once per visit while keeping
  the unread highlights visible, and taps deep-link to the trip.
- **Service alerts on line detail**: active alerts (started, not ended) render
  as severity-colored banners; staff/admin get a compose card (title, body,
  severity) that posts to `service_alerts` and triggers the fan-out.
- **Mute per favorite**: bell toggle on each favorites row (`favorites.muted`).
- **Quiet hours on profile**: switch + HH:MM window saved to
  `notification_prefs` with the device's timezone; off deletes the row.

Also: staff cards now show for the `admin` role too. Verified with
`tsc --noEmit` and live backend checks; on-phone walkthrough still pending
(needs the dev build + `expo start`).

## Phase 11 — Standalone preview builds + OTA updates (2026-07-03)

Testing was chained to `npx expo start` on the dev machine's Wi-Fi. Fix:
**EAS Update** + a **preview APK**.

- `expo-updates` installed; `app.json` gained `runtimeVersion: appVersion` and
  the EAS updates URL; `eas.json` profiles gained channels (development /
  preview / production).
- The preview/production profiles bake `EXPO_PUBLIC_SUPABASE_URL` / `_ANON_KEY`
  into the build via `eas.json` `env` — standalone builds bundle JS on EAS
  servers where the gitignored `.env` doesn't exist (the dev client never hit
  this because `expo start` injects env locally). These are the publishable
  values that ship in any APK; RLS remains the enforcement layer.
- **Workflow from here**: install the preview APK once; after any JS change,
  `cd mobile && npx eas-cli update --channel preview --message "..."` publishes
  over the air — the app picks it up on next launch, any network, no dev
  server. A new APK is only needed when native modules / app.json native
  config change. The dev-client + `expo start` flow still exists for hot
  reload sessions.

## Where things stand / what's next

- PR #1 (`feat/notification-webhook`) and PR #2 (`feat/mobile-auth`, stacked on #1)
  merged to master 2026-07-03 — everything above is on master.
- **FCM V1 credentials** (`eas credentials`) are still needed before Android push
  notifications actually deliver to the phone.
- Nearby/map view (the one Phase 7 surface still without UI — needs a map
  library + location permission, so it's its own chunk).
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
