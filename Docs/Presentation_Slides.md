# TransportFlow — Presentation Script (Canva)

17 slides, 16:9. Each slide below has: **ON SLIDE** (paste into Canva, keep it this
short), **VISUAL** (what to place), and **SAY** (speaker notes — put them in Canva's
notes panel, don't put them on the slide).

Design suggestions: brand blue `#175CD3` as the accent (matches the app splash), white
background, one bold statement per slide, status colors green/amber/red only when talking
about trip status. Use real app screenshots wherever indicated — they beat any stock art.

Deck balance: slides 1–9 are the product story (problem → data → app → demo), slides
10–14 are the technical story, 15–17 close. If time runs short, slides 11 and 14 are
the safest skips.

---

## Slide 1 — Title

**ON SLIDE:**
> **TransportFlow**
> Real-time public transport, for riders and the people who run it.
> *Azer Debbabi — July 2026*

**VISUAL:** App icon / splash route-mark logo, one phone screenshot (home screen) on the right.

**SAY:** TransportFlow is a mobile app where riders see live schedules, delays and
alerts, and transit staff publish those updates — one app, both roles. I'll show the app,
then what's technically interesting underneath.

---

## Slide 2 — The problem

**ON SLIDE:**
> The timetable says 07:10.
> The bus knows otherwise.
- Printed/static schedules can't say "10 minutes late today"
- Riders find out by waiting at the stop
- Operators have no direct channel to the riders affected

**SAY:** The information exists — the operator knows the bus is late — but there's no
channel from the operator to exactly the riders who care. That channel is the product.

---

## Slide 3 — The solution

**ON SLIDE:**
> One app, two roles.
- **Riders:** browse & search lines, live ETAs per stop, nearby stops on a map, favorites, push notifications
- **Staff:** report delays/cancellations, post service alerts — from the same app
- A staff report reaches affected riders **in seconds**, as a push

**VISUAL:** 3 phone screenshots side by side (line detail, trip with ETAs, notification).

**SAY:** Same codebase, role-gated. The key promise: when staff report a delay, every
rider who starred that line or a stop on it gets a push within seconds, and their open
screens update live without refreshing.

---

## Slide 4 — Built on Tunisia's open transport data

**ON SLIDE:**
> **5 networks · 78 lines · 474 stops · 2,000+ trips a week**
- TRANSTU — Tunis métro & TGM
- Métro du Sahel (SNCFT) · STS — Sousse
- SORETRAK — Kairouan · SNTRI — intercity
- Source: the Ministry of Transport's open-data portal

**VISUAL:** Stat tiles for the four numbers (in the generated PPTX). Optionally a small
Tunisia map with Tunis, Sousse and Kairouan marked (Canva elements).

**SAY:** This isn't demo data. The catalog is five real Tunisian networks imported from
catalogue-data.transport.tn — the métro and TGM in Tunis, the Métro du Sahel and STS
buses around Sousse, Kairouan's buses, and SNTRI intercity coaches. Seventy-eight lines,
474 stops, about two thousand scheduled trips live in the app every week. Two of those
feeds needed real rescue work to be usable — I'll come back to that in the technical part.

---

## Slide 5 — Rider experience

**ON SLIDE:**
- Typo-tolerant search ("cartage" → Carthage Byrsa)
- Route maps + stops near me (3 km, live location)
- Star a line or stop → that's your subscription
- Mute per favorite · quiet hours at night
- Notification inbox with live unread badge

**VISUAL:** Screenshots: search results, nearby map, favorites with mute bells.

**SAY:** Favorites are the subscription model — no separate settings maze. Mute keeps a
favorite visible but silent; quiet hours suppress pushes at night but the in-app inbox
still records everything. Search is typo-tolerant using Postgres trigram matching — no
external search service.

---

## Slide 6 — The app at a glance

**ON SLIDE:**
> Five screens, no manual needed.

**VISUAL:** A gallery row of 5 phone screenshots, each with a one-word caption:
Home (search) · Line (route map) · Trip (live ETAs) · Nearby (map) · Inbox.

**SAY:** A quick visual tour before the demo. Home is search plus the network list; a
line shows its route on the map and today's trips; a trip shows a live ETA per stop;
Nearby finds stops around you; and the inbox keeps every notification with an unread
badge. Navigation is three taps deep at most.

---

## Slide 7 — Staff experience

**ON SLIDE:**
- Report status: on time / delayed +minutes / cancelled
- Post line alerts: "Strike this Friday" (info / warning / disruption)
- Every report is **attributed and permanent** — an audit log, not an edit
- Admins promote staff in-app

**VISUAL:** Screenshots: the amber staff report card, a posted alert banner.

**SAY:** Staff tools appear inline in the rider UI, amber-bordered, only for staff
accounts. Design decision: staff never *edit* a trip — they append a report to a log, and
the trip's current state is derived from it. Full audit trail: who reported what, when.
Corrections are new entries, not rewrites.

---

## Slide 8 — A morning with TransportFlow

**ON SLIDE:**
> **07:31** — She checks her starred TGM line. On time.
> **07:38** — Staff report: delayed +10.
> **07:38** — Push lands on her lock screen.
> **07:39** — One tap: new ETA for her stop. Coffee first.

**VISUAL:** 4 step cards on a timeline (in the generated PPTX); optionally a lock-screen
push screenshot.

**SAY:** The whole product in sixty seconds, from the rider's side. She didn't refresh
anything, didn't search anything — she starred a line once, and the one delay that
affects her morning found *her*. That's the loop I'll now show you live.

---

## Slide 9 — Live demo

**ON SLIDE:**
> **Live demo**
> staff report → rider push → deep link

**SAY (demo script):** Two phones (or phone + emulator). ① Rider phone: open a favorited
line's trip. ② Staff phone: report "delayed 10 min". ③ Point at the rider phone: status
badge and every stop ETA update live — no refresh. ④ Push arrives; tap it — deep-links
straight into the trip. **Fallback if network misbehaves:** pre-recorded screen video on
the next hidden slide, or show the notifications inbox from an earlier report.

---

## Slide 10 — Architecture: there is no backend server

**ON SLIDE:**
> The app talks straight to the database.
> Authorization lives *in* Postgres.
- No Express/API layer — nothing to host, nothing to bypass
- Supabase: Postgres + Auth + Realtime + 2 Edge Functions
- Security enforced by Row-Level Security, not middleware

**VISUAL:** Architecture diagram (`slides-assets/architecture.png`, already in the PPTX).

**SAY:** The unconventional choice: we deleted the middle tier. The app holds only a
public key plus the user's JWT; Postgres itself decides what each request may read or
write, via Row-Level Security. That means the security rules live in exactly one place,
there's no server to keep in sync or pay for, and the same rules protect *every* path —
app, API, or someone with curl.

---

## Slide 11 — Security: the database is the gatekeeper

**ON SLIDE:**
- Every table: RLS + explicit grants (deny by default)
- `trips` has **no client write path** — only the append-only report log
- Riders physically can't self-promote: `role` column is write-locked by Postgres
- Secrets in Vault, never in code · pushes sent by a service-role Edge Function

**SAY:** Three layers: grants are the ceiling, RLS narrows per-row, and column-level
locks handle the rest — a rider PATCHing their own `role` gets a permission error from
Postgres itself, no app code involved. The one privileged path that writes roles is a
single audited SQL function that requires the caller to be an admin.

---

## Slide 12 — One write, four effects

**ON SLIDE:**
> One INSERT powers everything:
1. Trip state syncs (trigger)
2. Rider's open screen updates (Realtime)
3. Durable notification per affected rider (Edge Function)
4. Push to their phones — respecting mutes & quiet hours

**VISUAL:** Fan-out sequence diagram (`slides-assets/fanout.png`, already in the PPTX).

**SAY:** When staff hit submit, a database trigger syncs the trip, Supabase Realtime
streams the change to open screens, and a webhook — fired by the database itself — calls
our Edge Function, which finds every rider with an unmuted favorite on that line or its
stops, writes each a durable notification, and sends the pushes. Duplicate reports within
five minutes are rejected *before* any of this fires, because every accepted write costs
real notifications.

---

## Slide 13 — Real data, real schedules

**ON SLIDE:**
- One importer, any GTFS feed → our model (5 feeds, namespaced)
- STS feed: broken 2016 pseudo-GTFS in a RAR → **repaired + stops geocoded**
- Métro du Sahel: no digital feed existed → **GTFS hand-authored** from the été 2026 timetable
- No external scheduler: pg_cron turns 318 patterns into ~2,000 dated trips a week

**SAY:** Getting real data in was its own engineering story. The importer maps any
standard GTFS feed onto our model, with namespaces so five agencies' IDs don't collide.
Two feeds fought back: STS published a broken 2016 pseudo-GTFS inside a RAR archive —
repaired and geocoded — and the Métro du Sahel had no digital feed at all, so I authored
one from the printed summer timetable. And there's no external scheduler: recurring
patterns like "line 3, 07:10, Mon–Sat" become concrete dated trips via cron jobs *inside*
Postgres, timezone-correct.

---

## Slide 14 — Engineering practice

**ON SLIDE:**
- 13 reviewed PRs to a protected master · conventional history
- Typed end-to-end: generated DB types → typed queries → typed routes
- Production build **1.5.0** · JS ships over-the-air on relaunch (EAS Update)
- Free-tier ops: scheduled keep-alive, zero hosting cost

**SAY:** Every feature landed as a PR. TypeScript types are generated from the live
database schema, so a schema change that breaks a screen fails compilation, not the demo.
The app is past "runs on my machine": version 1.5.0 is a production build, and day-to-day
fixes ship over the air — a fix reaches installed phones on relaunch, no store
round-trip. Total hosting bill: zero.

---

## Slide 15 — Honest limits & next steps

**ON SLIDE:**
- Today: staff-reported status (operator in the loop) — not vehicle GPS
- One direction per line; holiday calendars not applied yet
- **Next:** GTFS-RT vehicle positions · both directions · dark mode · offline cache · automated test suite

**SAY:** Being upfront: "real-time" here means operator-reported, which is a deliberate
product choice — it works for networks without GPS-equipped fleets, which is most of
Tunisia's. The architecture is ready for GTFS-RT vehicle feeds as the natural next step,
since the ingestion and fan-out pipeline already exists.

---

## Slide 16 — Stack & deliverables

**ON SLIDE:**
> Expo (React Native) · Supabase (Postgres · Auth · Realtime · Edge Functions) · Google Maps · EAS
- ✅ Working app — production build, verified on device
- ✅ Source on GitHub, PR history
- ✅ README + as-built technical documentation
- ✅ These slides

**VISUAL:** Small logos row (Expo, Supabase, Google Maps, GitHub).

---

## Slide 17 — Thank you

**ON SLIDE:**
> **TransportFlow**
> The bus is late. Now everybody knows.
> *github.com/azer-dev1/TransportFlow*

**VISUAL:** QR code to the repo (already in the PPTX), logo, one last screenshot.

---
---

# Diagram sources

The two slide diagrams are pre-rendered in `Docs/slides-assets/` (`architecture.png`
for slide 10, `fanout.png` for slide 12) and already placed in the generated PPTX.
Their editable SVG sources live in the session that generated them; the equivalent
Mermaid versions are in `TransportFlow_Technical_Documentation.md` if they ever need
to be re-derived.

---

# Your workflow

1. **Import the deck** — Canva → Create a design → Import file →
   `Docs/TransportFlow_Slides.pptx`. Layout, diagrams, QR code and speaker notes come
   with it.
2. **Screenshots** — capture them on the preview build and drop them onto the dashed
   placeholder frames (slides 1, 3, 5, 6, 7, 17). Canva's "Mockups" app can frame them
   in a phone device frame.
3. **Slide 4 (optional)** — add a small Tunisia map from Canva's elements and mark
   Tunis, Sousse, Kairouan.
4. **Slide 16** — add the Expo / Supabase / Google Maps / GitHub logos from Canva's
   element library.
5. **Flip through after import** — Canva substitutes fonts, so check nothing overflowed.
6. **Rehearse slide 9 once** with both phones on the venue's expected network; keep a
   screen recording of the demo loop as the fallback.
