# TransportFlow — Technical Architecture & Execution Blueprint

> **⚠️ As-built update (2026-07-05).** This is the original pre-implementation plan, kept
> for history. The shipped system (documented in the root `README.md`) deviates from it in
> several load-bearing ways:
>
> - **No Express/Node API server was built.** The mobile app talks directly to Supabase
>   (PostgREST + Realtime + Auth); authorization is enforced entirely by Postgres RLS,
>   table grants, and column-level grants. Parts 2, 4, and the backend rows of Part 1 are
>   therefore obsolete — there are no `/auth/*` or `/trips/:id/status` REST routes, no
>   Render/Railway deployment, no Pino/Sentry backend monitoring.
> - **Staff reports are an append-only log**, not a `PATCH` on `trips`: staff INSERT into
>   `trip_updates` and a `SECURITY DEFINER` trigger syncs the trip's current state, keeping
>   an audit trail. The Part 3 schema also grew beyond this plan: `service_patterns`
>   (+ pg_cron trip materialization), `service_alerts`, `notification_prefs` (quiet hours),
>   `favorites.muted`, `notifications.read_at`, an `admin` role, and the `trip_stop_times`
>   ETA view, plus `search_lines`/`search_stops` (pg_trgm), `nearby_stops` (earthdistance)
>   and `promote_to_staff` RPCs.
> - **Push fan-out is Postgres → pg_net webhook → `notify-trip-update` Edge Function →
>   Expo Push**, not an Express listener. Account deletion is a second Edge Function.
> - **Styling** uses plain StyleSheet + shared theme tokens, not NativeWind. **Maps** use
>   MapLibre + OpenFreeMap tiles. Network data comes from a **GTFS importer**
>   (`scripts/gtfs-import`) rather than hand-seeded demo rows.
> - The Vitest/Supertest/Maestro testing stack (Part 9) was not adopted; there is no
>   Express app to test and verification has been manual/on-device.

This blueprint translates the previously extracted TransportFlow requirements (schedules, real-time delay updates, rider/staff roles, favorites, notifications, maps) into a concrete, buildable system for a 1–4 person team over 3–5 weeks (using the upper bound, 5 weeks / extendable to 6 if your team has 4–6 weeks available). All domain examples below use TransportFlow entities (Rider, Staff, Stop, Line, Trip, Delay) — not the generic medical/Deaf-HoH examples from the task template, which do not apply to this project.

---

# Part 1: Final Technology Stack

| Layer | Recommended | Alternatives Considered | Why Chosen | Learning Difficulty | Setup Complexity | Fit for 4–6 wks |
|---|---|---|---|---|---|---|
| **Frontend (mobile)** | **React Native (Expo)** | Flutter, plain React Native CLI | Expo removes native build pain (no Xcode/Android Studio config needed to start), has hot reload, built-in push notification + location APIs, and one JS codebase serves iOS+Android. Flutter is equally capable but Dart is a second language for a team likely already in the JS ecosystem (since backend is also JS) — staying in one language reduces context-switching under time pressure. | Low–Medium (if team knows React) | Low (Expo Go for instant device testing) | Excellent |
| **Backend** | **Node.js + Express.js** | NestJS, FastAPI (Python), Django | Express is minimal, fast to learn, has the largest tutorial/StackOverflow base, and pairs naturally with a JS frontend (shared types possible). NestJS adds structure but also adds a learning curve (decorators, DI, modules) that isn't justified for a 5-week MVP with a small team. FastAPI is excellent but would split the team across two languages (Python backend, JS frontend) — only worth it if the team already knows Python well. | Low | Low | Excellent |
| **Database** | **PostgreSQL via Supabase** | Raw self-hosted PostgreSQL, MongoDB, Firebase Firestore | Supabase gives a managed Postgres instance, a free tier, an auto-generated REST API, **built-in Auth**, and **built-in Realtime** (Postgres logical replication → WebSocket) — covering three of the project's hardest technical objectives (DB, Auth, Real-time) with one service. Relational data (Stops belong to Lines, Trips reference Lines, Users have roles) fits SQL naturally; MongoDB's schema-less model adds no benefit here and risks data-integrity bugs under time pressure. | Medium (SQL) | Low (hosted, free tier, no server to manage) | Excellent |
| **Authentication** | **Supabase Auth** | Firebase Auth, Auth.js (NextAuth), Clerk, custom JWT | Since the DB layer is already Supabase, using Supabase Auth means user records, roles, and row-level security (RLS) policies live in the same place as the rest of the data — no separate identity service to sync. It natively supports email/password and issues JWTs the Express backend (or RLS policies) can verify directly. Clerk/Auth.js are strong but introduce a second vendor relationship for no added benefit here. | Low | Low | Excellent |
| **Real-Time Communication** | **Supabase Realtime** | Socket.IO, raw WebSockets, Firebase Realtime DB | Supabase Realtime listens directly to Postgres table changes (e.g., an `INSERT`/`UPDATE` on the `trips` table when staff report a delay) and pushes the change to subscribed clients with zero custom server code for the broadcast itself. This directly satisfies the brief's stated real-time/WebSocket objective with the least implementation risk. Socket.IO is a fine fallback if the team needs custom event logic (e.g., merging delay + chat-style features), but for "staff updates a trip → riders see it instantly," Supabase Realtime is a more direct fit. | Low–Medium | Low | Excellent |
| **Deployment — Frontend** | **Expo (EAS Build) + Expo Go for demo** | App Store/Play Store full release, web build via Expo Web | EAS Build produces installable APK/IPA builds without needing paid developer accounts for a *demo*; Expo Go allows judges/teammates to scan a QR code and run the live app instantly on their own phone — ideal for a competition demo. | Low | Low | Excellent |
| **Deployment — Backend** | **Render (free tier) or Railway** | Heroku (no longer free), AWS/GCP/Azure, Vercel (not ideal for long-lived Express servers with WebSockets) | Render/Railway both offer free-tier Node hosting with simple GitHub-push deploys and support long-running connections needed for any custom WebSocket logic. AWS/GCP add operational complexity (VPCs, IAM) the brief never asks for. | Low | Low | Excellent |
| **Deployment — Database** | **Supabase (managed)** | Self-hosted Postgres on a VM | Already covered above — Supabase is free-tier hosted, so there is no separate DB deployment step. | — | — | Excellent |
| **Monitoring — Logging** | **Pino (backend) + Render/Railway built-in log viewer** | Winston, console.log only | Pino is fast and structured (JSON logs), and both Render and Railway surface logs in their dashboards with zero extra setup — adequate for an MVP without standing up a separate log aggregator. | Low | Low | Good |
| **Monitoring — Error Tracking** | **Sentry (free tier)** | Bugsnag, Rollbar | Sentry has official SDKs for both Express and React Native, a generous free tier, and gives stack traces with source maps — valuable for catching crashes during the live demo period. | Low | Low | Good |
| **Monitoring — Analytics** | **Optional: none for MVP, or simple Supabase SQL queries** | Mixpanel, Amplitude, PostHog | The brief does not ask for analytics; a dedicated analytics tool is not justified scope. If "usage insight" is wanted for the presentation, a few SQL `COUNT`/`GROUP BY` queries against Supabase tables are sufficient. | — | — | Good (low-effort) |

**Final stack at a glance:** React Native (Expo) → Express.js API → Supabase (Postgres + Auth + Realtime) → Render/Railway (API hosting) → Sentry/Pino (monitoring).

---

# Part 2: Complete System Architecture

## High-Level Architecture Diagram

```
                    +------------------------+
                    |   Rider Mobile App     |
                    |  (React Native/Expo)   |
                    +-----------+------------+
                                |
                  REST (HTTPS) | + Realtime subscription (WSS)
                                |
                    +-----------v------------+
                    |   Express.js API       |
                    |  (Render/Railway host) |
                    |  - Auth middleware     |
                    |  - Routes/Controllers  |
                    |  - Validation layer    |
                    +-----------+------------+
                                |
                                | SQL (pg client) + Supabase SDK
                                |
                    +-----------v------------+
                    |   Supabase Platform    |
                    |  - PostgreSQL DB       |
                    |  - Auth (JWT issuer)   |
                    |  - Realtime (pub/sub on table changes)
                    +-----------+------------+
                                ^
                  REST (HTTPS) | + Realtime subscription (WSS)
                                |
                    +-----------+------------+
                    |  Staff Mobile/Web App  |
                    | (same RN app, staff role) |
                    +------------------------+

         Push notifications: Supabase trigger -> Express webhook -> Expo Push Notification Service -> Rider device
```

**Why this shape fits the spec:** Both the rider and staff use the *same client codebase* (React Native), differentiated only by role/permissions — this matches the brief's description of one platform serving both personas (Core Features 3 & 6) rather than two separate apps, minimizing build effort.

---

## Data Flow

### User Registration Flow
1. User opens app, taps "Sign Up," enters name/email/password.
2. Client calls `POST /auth/register` → Express forwards to Supabase Auth `signUp()`.
3. Supabase creates an `auth.users` record and issues a session JWT.
4. Express inserts a corresponding row into the app's `profiles` table with `role = 'rider'` (default; staff roles are provisioned separately — see Assumption A2 from the requirements analysis).
5. JWT + profile returned to client; client stores token securely (Expo SecureStore).
6. Client redirected to the Rider Dashboard.

### Login Flow
1. User enters email/password, taps "Log In."
2. Client calls `POST /auth/login` → Express calls Supabase Auth `signInWithPassword()`.
3. On success, Supabase returns a JWT + refresh token.
4. Express returns `{ token, refreshToken, user }` to client.
5. Client stores tokens; subsequent requests attach `Authorization: Bearer <token>`.
6. Client routes to Rider Dashboard or Staff Dashboard based on `user.role`.

### Schedule & Stop Browsing Flow
1. Rider opens "Schedules" tab.
2. Client calls `GET /lines` and `GET /stops?line_id=...`.
3. Express queries Postgres (`lines`, `stops`, `trips` joined) and returns JSON.
4. Client renders schedule list; rider can tap a stop to see upcoming trips (`GET /trips?stop_id=...`).
5. Rider can tap "Save" on a route/stop → `POST /favorites`.

### Delay Reporting Flow (Staff)
1. Staff logs in; role check (`role = 'staff'`) unlocks the "Report Delay" screen.
2. Staff selects a trip, enters delay minutes or status (`on_time`, `delayed`, `cancelled`).
3. Client calls `PATCH /trips/:id/status` with the new status.
4. Express verifies staff role via auth middleware, then updates the `trips` row in Postgres.
5. Supabase Realtime detects the row `UPDATE` and pushes the change over the open WebSocket channel to all subscribed rider clients.
6. Rider clients update the relevant trip's UI in real time (Core Feature 2).

### Real-Time Notification Flow
1. Rider has previously saved a Stop/Line as a favorite and granted notification permission (Expo push token registered server-side at login, `POST /devices/register`).
2. On the same `trips` `UPDATE` event from the Delay Reporting Flow, a Postgres trigger (or an Express listener subscribed to Supabase Realtime) checks which riders have favorited the affected line/stop.
3. Express calls the Expo Push Notification API with the relevant device tokens and a message (e.g., "Bus 12 is delayed 8 minutes").
4. Rider receives a native push notification even if the app is in the background (Core Feature 7).

---

# Part 3: Database Engineering

## Tables

### `profiles`
| Column | Type | Constraints |
|---|---|---|
| id | uuid | PK, references `auth.users.id` |
| full_name | text | not null |
| role | text | not null, check in ('rider','staff') |
| created_at | timestamptz | default now() |

### `lines`
| Column | Type | Constraints |
|---|---|---|
| id | uuid | PK, default gen_random_uuid() |
| name | text | not null |
| mode | text | check in ('bus','train') |
| created_at | timestamptz | default now() |

### `stops`
| Column | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| name | text | not null |
| latitude | numeric(9,6) | not null |
| longitude | numeric(9,6) | not null |

### `line_stops` (join table, ordered sequence of stops per line)
| Column | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| line_id | uuid | FK → lines.id |
| stop_id | uuid | FK → stops.id |
| sequence_order | int | not null |
| Index | (line_id, sequence_order) | for ordered retrieval |

### `trips`
| Column | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| line_id | uuid | FK → lines.id |
| scheduled_departure | timestamptz | not null |
| status | text | check in ('on_time','delayed','cancelled'), default 'on_time' |
| delay_minutes | int | default 0 |
| updated_by | uuid | FK → profiles.id (staff who last updated) |
| updated_at | timestamptz | default now() |
| Index | (line_id, scheduled_departure) | for fast schedule lookups |

### `favorites`
| Column | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK → profiles.id |
| line_id | uuid | FK → lines.id, nullable |
| stop_id | uuid | FK → stops.id, nullable |
| Unique | (user_id, line_id, stop_id) | prevent duplicate favorites |

### `devices` (push tokens)
| Column | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK → profiles.id |
| expo_push_token | text | not null |
| Unique | (user_id, expo_push_token) | |

### `notifications` (sent-history log)
| Column | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK → profiles.id |
| trip_id | uuid | FK → trips.id |
| message | text | not null |
| sent_at | timestamptz | default now() |

> Note: the original task template listed `Doctors`, `Patients`, `Messages`, `Conversations`, `Symptoms`, `Emergency Alerts` — none of these exist in TransportFlow's brief. They are intentionally **not** included since the requirements document never describes medical consultations, chat, or emergency alerts.

## ER Diagram (text form)

```
profiles (1) ---- (many) favorites (many) ---- (1) lines
profiles (1) ---- (many) favorites (many) ---- (1) stops
profiles (1) ---- (many) devices
profiles (1) ---- (many) trips [updated_by]
lines (1) ---- (many) line_stops (many) ---- (1) stops
lines (1) ---- (many) trips
trips (1) ---- (many) notifications
profiles (1) ---- (many) notifications
```

## SQL Schema

```sql
create extension if not exists "pgcrypto";

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role text not null check (role in ('rider','staff')),
  created_at timestamptz default now()
);

create table lines (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  mode text check (mode in ('bus','train')),
  created_at timestamptz default now()
);

create table stops (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  latitude numeric(9,6) not null,
  longitude numeric(9,6) not null
);

create table line_stops (
  id uuid primary key default gen_random_uuid(),
  line_id uuid references lines(id) on delete cascade,
  stop_id uuid references stops(id) on delete cascade,
  sequence_order int not null
);
create index idx_line_stops_order on line_stops(line_id, sequence_order);

create table trips (
  id uuid primary key default gen_random_uuid(),
  line_id uuid references lines(id) on delete cascade,
  scheduled_departure timestamptz not null,
  status text not null default 'on_time' check (status in ('on_time','delayed','cancelled')),
  delay_minutes int default 0,
  updated_by uuid references profiles(id),
  updated_at timestamptz default now()
);
create index idx_trips_line_time on trips(line_id, scheduled_departure);

create table favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  line_id uuid references lines(id) on delete cascade,
  stop_id uuid references stops(id) on delete cascade,
  unique (user_id, line_id, stop_id)
);

create table devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  expo_push_token text not null,
  unique (user_id, expo_push_token)
);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  trip_id uuid references trips(id) on delete cascade,
  message text not null,
  sent_at timestamptz default now()
);

-- Row Level Security example: only staff can update trips
alter table trips enable row level security;
create policy "riders can read trips" on trips for select using (true);
create policy "staff can update trips" on trips for update using (
  exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'staff')
);
```

---

# Part 4: API Design

| Route | Method | Auth | Request Body | Response Body |
|---|---|---|---|---|
| `/auth/register` | POST | None | `{ email, password, full_name }` | `{ token, user }` |
| `/auth/login` | POST | None | `{ email, password }` | `{ token, refreshToken, user }` |
| `/auth/refresh` | POST | Refresh token | `{ refreshToken }` | `{ token }` |
| `/lines` | GET | Bearer (any role) | — | `[{ id, name, mode }]` |
| `/lines/:id/stops` | GET | Bearer | — | `[{ id, name, latitude, longitude, sequence_order }]` |
| `/stops/:id/trips` | GET | Bearer | — | `[{ id, line_id, scheduled_departure, status, delay_minutes }]` |
| `/trips/:id` | GET | Bearer | — | `{ id, line_id, scheduled_departure, status, delay_minutes }` |
| `/trips/:id/status` | PATCH | Bearer, **staff only** | `{ status, delay_minutes }` | `{ id, status, delay_minutes, updated_at }` |
| `/favorites` | GET | Bearer | — | `[{ id, line_id, stop_id }]` |
| `/favorites` | POST | Bearer | `{ line_id?, stop_id? }` | `{ id, line_id, stop_id }` |
| `/favorites/:id` | DELETE | Bearer | — | `{ success: true }` |
| `/devices/register` | POST | Bearer | `{ expo_push_token }` | `{ success: true }` |
| `/profile` | GET | Bearer | — | `{ id, full_name, role }` |
| `/profile` | PATCH | Bearer | `{ full_name? }` | `{ id, full_name, role }` |

**Example:**
```
PATCH /trips/3f2a.../status
Authorization: Bearer <staff JWT>

Request:
{
  "status": "delayed",
  "delay_minutes": 8
}

Response:
{
  "id": "3f2a...",
  "status": "delayed",
  "delay_minutes": 8,
  "updated_at": "2026-06-22T14:05:00Z"
}
```

---

# Part 5: Accessibility Engineering

The TransportFlow brief targets the general public (riders of all ages/abilities), not a population with a stated disability focus. Accordingly, this is a **general mobile accessibility plan** (WCAG-aligned), not the Deaf/HoH-specific plan from the unrelated template — that population is never mentioned in TransportFlow's requirements.

- **Standard:** Target **WCAG 2.1 AA** for any web-rendered surfaces (e.g., an admin/staff web console if built), and platform accessibility guidelines (Apple Human Interface / Android Accessibility) for the mobile app.
- **Color contrast:** Minimum 4.5:1 contrast ratio for body text, 3:1 for large text — verified with a tool like the WebAIM Contrast Checker during design. Delay-status colors (e.g., red for "delayed") must be paired with an icon/text label, not color alone, since color-blind users (~8% of men) cannot rely on red/green distinction.
- **Keyboard/focus navigation:** For any web console, ensure all interactive elements are reachable via `Tab` and have visible focus rings (`:focus-visible` styling); on mobile, ensure screen-reader focus order matches visual order (test with VoiceOver/TalkBack).
- **Screen reader labels:** All icon-only buttons (e.g., favorite-star icon) get `accessibilityLabel` props in React Native (e.g., `accessibilityLabel="Add to favorites"`).
- **Notification design:** Push notifications should include both the delay status and minutes in text (not relying on an icon/emoji alone) so they read correctly via screen readers and notification previews.
- **Error messaging:** Form errors (e.g., failed login) should be announced to screen readers via `accessibilityLiveRegion="polite"` on the error text component, and phrased in plain language ("Incorrect email or password" rather than an error code).
- **Responsive design:** Use relative units (`flex`, percentage widths) rather than fixed pixel layouts so the app scales across phone sizes; respect the OS-level font-scaling setting (avoid hard-capping font sizes).
- **Touch targets:** Minimum 44x44pt tap targets (Apple HIG) for all buttons, especially the staff delay-entry controls used in time-pressured situations.

---

# Part 6: UI/UX Design System

| Screen | Purpose | Key Components | User Actions | Accessibility Notes |
|---|---|---|---|---|
| Landing/Welcome | First entry, app value prop | Logo, "Sign In"/"Sign Up" buttons | Choose auth path | Large tap targets, high-contrast CTA buttons |
| Login | Authenticate | Email/password fields, submit button, error banner | Log in, navigate to Register | Labeled inputs, live-region error announcement |
| Register | Create account | Name/email/password fields | Submit, navigate to Login | Inline validation messages tied to fields via `accessibilityLabel` |
| Rider Dashboard | Home for riders | Favorited routes list, nearby stops, search bar | View favorites, search lines/stops, navigate to map | Section headers marked for screen-reader navigation |
| Schedule/Line Detail | View timings for a line | Stop list, upcoming trip times, delay-status badges | Tap a stop to see trip detail, save as favorite | Status badges use icon+text, not color alone |
| Map/Nearby Stops | Geolocation-based stop discovery | Map view, stop pins, "use my location" button | Browse nearby stops, tap pin for details | Provide list-view fallback for users who cannot use the map visually |
| Staff Dashboard | Home for staff | Assigned/active trips list, "Report Delay" entry point | Select a trip to update | Role-gated; clear visual distinction from rider UI |
| Report Delay Screen | Staff updates trip status | Status selector (on-time/delayed/cancelled), delay-minutes input, submit | Submit status update | Large, simple controls usable quickly in the field |
| Favorites/Settings | Manage saved routes & notification prefs | Favorites list with remove action, notification toggle, logout | Remove favorite, toggle notifications, log out | Destructive actions (remove, logout) have confirm step |

**Typography:** System fonts (San Francisco on iOS, Roboto on Android) via React Native defaults — avoids custom font licensing/loading overhead and respects OS-level accessibility font scaling automatically.

**Color palette:** Neutral base (white/dark-gray text on white/near-white background) + one brand accent color (e.g., teal) for primary actions, with semantic colors for trip status: green (`on_time`), amber (`delayed`), red (`cancelled`) — each always paired with text/icon per the accessibility section.

**Spacing system:** 4px base unit scale (4, 8, 12, 16, 24, 32) for consistent margins/padding — simple to apply with Tailwind-style utility values.

**Component library — Recommended: NativeWind (Tailwind for React Native).** Tailwind's utility classes map directly onto React Native via NativeWind, giving fast, consistent styling without building a component library from scratch. shadcn/ui is excellent but is a **web** (React DOM) component library and does not run in React Native directly — it would only apply if a separate staff web console is built. Material UI is also web-only and visually opinionated in a way that fights customization speed. **Decision: NativeWind for the mobile app; if a staff web console is added later, shadcn/ui + Tailwind is the natural extension since both share the same design tokens.**

---

# Part 7: Development Roadmap (6-week version; compress to 5 by merging Weeks 5–6 if needed)

| Week | Features | Deliverables | Risks | Success Criteria |
|---|---|---|---|---|
| 1 | Project setup, Supabase project + schema, Auth (register/login), basic navigation shell | Repo scaffolded, DB schema migrated, working login/register | Underestimating Supabase/RLS learning curve | A new user can register and log in on a device |
| 2 | Lines/Stops/Trips CRUD (read paths), schedule browsing screens | Rider can browse lines, stops, and upcoming trips | Seed data may be missing/incomplete | Rider dashboard shows real schedule data end-to-end |
| 3 | Favorites, staff role + Report Delay screen, RLS policy enforcement | Staff can update trip status; role gating verified | RLS policies misconfigured allowing rider writes | Staff-only mutation confirmed blocked for rider accounts |
| 4 | Realtime subscription wiring, push notification pipeline (Expo push + device registration) | Rider sees live delay update without refresh; push notification received | Realtime/push integration is the hardest technical risk — start early in the week, not late | A staff delay update triggers a visible rider-side update and a push notification within seconds |
| 5 | Map/geolocation integration, polish UI, accessibility pass (contrast, labels) | Map screen functional; accessibility checklist applied | Map feature scope ambiguity (flagged earlier) — confirm scope before building | Nearby-stop map view works on a real device |
| 6 | Testing, bug fixing, deployment (EAS build + Render deploy), documentation & slides | Working Application, README, Technical Docs, Slides | Time pressure on documentation if left to the very end | All 7 Core Features demoable end-to-end on a real device |

---

# Part 8: GitHub & Team Workflow

## Repository Structure
```
transportflow/
├── frontend/                 # React Native (Expo) app
│   ├── app/                  # screens (Expo Router) or src/screens
│   ├── components/
│   ├── hooks/
│   ├── lib/                  # supabase client, api client
│   └── app.json
├── backend/                  # Express API
│   ├── src/
│   │   ├── routes/
│   │   ├── controllers/
│   │   ├── middleware/       # auth, role-check
│   │   ├── lib/              # supabase admin client
│   │   └── index.js
│   └── package.json
├── db/
│   ├── schema.sql
│   └── seed.sql
├── docs/
│   ├── README.md
│   ├── technical-documentation.md
│   └── architecture-diagram.png
└── .github/
    └── workflows/ci.yml
```

## Branching Strategy
- `main` — always deployable, protected, no direct pushes.
- `develop` — integration branch where finished features merge before a release tag.
- `feature/<short-name>` — one branch per Core Feature (e.g., `feature/delay-reporting`, `feature/favorites`, `feature/push-notifications`).
- Merge order: `feature/*` → PR into `develop` → periodic PR from `develop` → `main` at each weekly milestone.

## Pull Request Rules
- **Review process:** At least one teammate reviews every PR before merge (even a quick 5-minute read) — for a 2-person team, the other person reviews; for 1-person teams, self-review against a checklist plus running the test suite locally.
- **Merge requirements:** CI (lint + any automated tests) must pass; no merging with failing builds.
- **Commit conventions:** Conventional Commits format — `feat:`, `fix:`, `docs:`, `chore:`, `refactor:` — e.g., `feat: add staff delay-status endpoint`. This produces a readable history useful for the "Source Code" deliverable review.

---

# Part 9: Testing Strategy

| Test Type | What to Test | Tool |
|---|---|---|
| **Unit** | Pure functions: delay-time formatting, role-check helper, validation schemas | **Vitest** (fast, works for both frontend and backend JS/TS without separate config) |
| **Integration** | API routes against a test Supabase project/schema: auth flow, trip status update, favorites CRUD, RLS enforcement (rider blocked from staff-only mutation) | **Vitest + Supertest** (Supertest drives HTTP requests against the Express app in tests) |
| **Accessibility** | Color contrast, screen-reader labels, touch target sizing on key screens | **Lighthouse** (for any web console) + manual VoiceOver/TalkBack pass on the mobile app (automated mobile a11y tooling is limited; manual pass is the practical option for an MVP) |
| **End-to-End** | Full user journeys: register→login→browse schedule; staff login→report delay→rider sees update; favorite→push notification received | **Playwright** if a web console exists; for the mobile app, **Maestro** (lightweight, YAML-based E2E testing for React Native, far less setup overhead than Detox for a small team) |

**Chosen stack: Vitest + Supertest for unit/integration, Maestro for mobile E2E, Lighthouse for any web-facing accessibility check.** Reasoning: this avoids standing up Jest *and* Vitest (redundant), avoids Detox's heavier native-build requirements for E2E given the team's time budget, and keeps the whole testing toolchain inside the JS ecosystem already chosen for the stack.

---

# Part 10: Security Plan

| Concern | Implementation |
|---|---|
| **Password hashing** | Handled automatically by Supabase Auth (bcrypt under the hood) — do not implement custom password hashing; never store plaintext passwords in the `profiles` table (passwords aren't even stored there — only in Supabase's managed `auth.users`). |
| **JWT management** | Supabase issues short-lived JWTs + a refresh token; store tokens in **Expo SecureStore** (encrypted device storage), never in plain AsyncStorage or app state alone. Refresh proactively before expiry using the `/auth/refresh` endpoint. |
| **Session handling** | Treat the JWT as the session; on logout, clear SecureStore and call Supabase's `signOut()` to invalidate the refresh token server-side. |
| **Authorization** | Enforce role checks **server-side** in Express middleware (`requireRole('staff')`) on every staff-only route, *and* mirror the same rule in Postgres Row-Level Security policies (defense in depth) — this directly addresses the earlier-flagged risk of UI-only role gating being bypassable. |
| **Input validation** | Validate all request bodies with **Zod** schemas at the top of each Express route handler before touching the database — rejects malformed delay-minutes, missing fields, or wrong types early. |
| **Rate limiting** | Apply `express-rate-limit` on `/auth/login` and `/auth/register` (e.g., 10 requests/15 min per IP) to blunt brute-force/credential-stuffing attempts — low effort, meaningful protection for an MVP. |
| **Data protection** | Use HTTPS everywhere (Render/Railway provide TLS by default); never log full JWTs or passwords in Pino logs; restrict the Supabase **service role key** (admin key) to the backend only — never ship it inside the mobile app bundle, which must use the public anon key with RLS enforced. |

---

# Part 11: AI Features Feasibility Analysis

The original template's AI features (Sign Language Recognition, Medical Chatbot) are healthcare-context specific and not applicable. Re-evaluated for TransportFlow's actual domain:

| Feature | Complexity | Est. Dev Time | Infra Needs | Competition Value | MVP Verdict |
|---|---|---|---|---|---|
| **Speech-to-Text** (voice search for "find my stop") | Medium | 3–5 days | Device-native speech API (Expo Speech-to-Text or platform API) — no server infra needed | Medium — nice demo flourish, not core to brief | NICE TO HAVE |
| **Text-to-Speech** (read out delay alerts) | Low | 1–2 days | Expo `expo-speech` (on-device, no backend) | Medium — accessibility-adjacent, easy win | NICE TO HAVE |
| **Sign Language Recognition** | Very High | Weeks, requires trained ML model + camera pipeline | Significant ML infra (model hosting/inference) | Not relevant — no Deaf/HoH requirement in this brief | DO NOT BUILD FOR MVP |
| **Chatbot** (e.g., "ask about delays" conversational assistant) | Medium–High | 5–7 days for a usable version (LLM API integration + prompt design) | Requires an LLM API (cost/quota management) | Medium-High — could be an attractive differentiator if time allows, but not in the Core Features list | NICE TO HAVE (only after all 7 Core Features are solid) |
| **Predictive delay estimation** (ML-based ETA prediction from historical delay data) | High | 1–2+ weeks, needs historical data the project likely won't have | Model training pipeline, historical data | Low for an MVP — interesting but data-starved in a brand-new app with no historical trips yet | DO NOT BUILD FOR MVP |
| **Translation** (multi-language UI) | Low–Medium | 2–3 days using a static i18n library (no AI needed) | None — i18next is sufficient, this isn't really an "AI" feature | Low-Medium | NICE TO HAVE, and arguably better solved without AI at all (static translation files) |

**MUST BUILD:** none of the AI features are required by the brief's Core Features or Technical Objectives — none should be prioritized over the 7 Core Features.

---

# Part 12: Final Recommendation

1. **Exact architecture:** React Native (Expo) mobile client (single codebase, role-based UI for rider vs. staff) → Express.js REST API (hosted on Render) → Supabase (Postgres + Auth + Realtime), with Expo Push Notifications triggered by an Express listener on Realtime trip-status changes.
2. **Exact technology stack:** Expo (React Native) + NativeWind · Express.js + Zod validation · Supabase (Postgres, Auth, Realtime, RLS) · Render (API hosting) · Sentry + Pino (monitoring) · Vitest/Supertest + Maestro (testing).
3. **Exact feature set to include:** All 7 Core Features from the brief (schedules, real-time delay updates, secure rider/staff sign-in, favorites, line/stop/timing browsing, staff delay reporting, push notifications) + a working map/nearby-stops view, built on the schema in Part 3.
4. **Features to intentionally exclude:** Sign language recognition, predictive ML delay estimation, full multi-operator/multi-city support, a custom chatbot, and any payment/ticketing functionality — none are in the brief, and each would consume time needed to make the Core Features reliable.
5. **Fastest path to a polished, high-scoring MVP:** Build and prove the riskiest path first — staff delay update → Realtime push → rider UI update → push notification — by end of Week 3/4, *before* polishing UI. A small number of features working end-to-end and demoed live beats a larger feature set that's fragile under live conditions.
