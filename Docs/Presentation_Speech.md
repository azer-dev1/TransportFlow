# TransportFlow — Speech (word-for-word)

Matches the 17-slide deck (`TransportFlow_Slides.pptx` / `Presentation_Slides.md`).
Full run ≈ **12–13 minutes** including the 2-minute demo. Each slide shows a time
budget; the running total is in brackets. If your slot is **10 minutes**, use the
cuts marked ✂ (they remove ~3 minutes without breaking the story).

Delivery notes:
- Speak the **bold sentences** exactly — they are the anchors; everything else can
  drift toward your own words.
- Pause one beat after every slide transition line (the *→ next slide* markers).
- The demo (slide 9) is the centerpiece. Everything before it builds up to it;
  everything after it explains it. Protect its time.

---

## Slide 1 — Title (30s) [0:30]

Good morning. My name is Azer Debbabi, and this is **TransportFlow — real-time
public transport, for riders and for the people who run it.**

It's a mobile app with two faces: riders see live schedules, delays and alerts;
transit staff publish those updates — same app, both roles. For the next few
minutes I'll show you the product, then a live demo, and then what's technically
interesting underneath it.

*→ next slide*

---

## Slide 2 — The problem (45s) [1:15]

Here's the situation every rider in Tunisia knows. **The timetable says 07:10.
The bus knows otherwise.**

A printed schedule — or a static app — can't tell you "ten minutes late, today".
So riders find out the only way they can: by standing at the stop, waiting.

And here's what makes it frustrating: the information *exists*. The operator knows
the bus is late. What's missing is a channel from the operator to exactly the
riders who care. **That missing channel is the product.**

*→ next slide*

---

## Slide 3 — The solution (45s) [2:00]

TransportFlow is **one app, two roles**.

Riders browse and search lines, see live arrival times per stop, find nearby stops
on a map, star their favorites, and get push notifications.

Staff — from the very same app — report delays and cancellations and post service
alerts, like "strike this Friday".

The key promise is this: **when staff report a delay, every rider who starred that
line — or a stop on it — gets a push within seconds**, and if they have the app
open, their screen updates live, without refreshing.

*→ next slide*

---

## Slide 4 — Tunisia's open data (60s) [3:00]

And this isn't running on demo data.

**The catalog is five real Tunisian networks: seventy-eight lines, four hundred
seventy-four stops, about two thousand scheduled trips live in the app every
week.** The métro and TGM in Tunis. The Métro du Sahel and the STS buses around
Sousse. SORETRAK in Kairouan. And SNTRI's intercity coaches.

All of it comes from the Ministry of Transport's open-data portal —
catalogue-data.transport.tn. I'll be honest with you: two of those feeds needed
real rescue work before they were usable, and I'll come back to that story in the
technical part.

*→ next slide*

---

## Slide 5 — Rider experience (45s) [3:45]

What does a rider actually get?

Search that forgives typos — type "cartage" with a missing letter, you still get
Carthage Byrsa. Route maps, and "stops near me" within three kilometers. And the
part I want you to remember: **starring a favorite is the subscription — there is
no settings maze.** You star a line, you get its news. You can mute any favorite
and keep it visible but silent, and quiet hours stop pushes at night while the
in-app inbox still records everything.

*→ next slide*

---

## Slide 6 — The app at a glance (30s) [4:15]

A quick tour before I show it live. Home is search plus the network list. A line
shows its route on the map and today's trips. A trip shows a live arrival time per
stop. Nearby finds stops around you. And the inbox keeps every notification, with
an unread badge. **Nothing in this app is more than three taps deep.**

*→ next slide*

---

## Slide 7 — Staff experience (45s) [5:00]

Now the other role. Staff see the same app, plus amber-bordered tools that only
appear for staff accounts: report a trip on time, delayed by so many minutes, or
cancelled — and post line-level alerts with a severity.

One design decision I want to highlight: **staff never edit a trip. They append a
report to a permanent log**, and the trip's current state is derived from that
log. So there's a full audit trail — who reported what, and when — and a
correction is a new entry, never a rewrite of history.

*→ next slide*

---

## Slide 8 — A morning with TransportFlow (40s) [5:40]

Let me make it concrete. 07:31 — she checks her starred TGM line: on time. 07:38 —
somewhere in the operations room, staff report a ten-minute delay. The same
minute, a push lands on her lock screen. One tap, 07:39 — she's looking at the new
arrival time for her stop. **Coffee first, instead of ten minutes on the
platform.**

She refreshed nothing and searched nothing. She starred a line once, and the one
delay that affects her morning found *her*. That's the loop — and now I'll show it
to you live.

*→ next slide*

---

## Slide 9 — LIVE DEMO (2:00) [7:40]

*(Choreography, not spoken text:)*

1. **Before you start talking**, have the rider phone already on a favorited
   line's trip screen, visible to the room.
2. On the staff phone, narrate as you tap: *"I'm signed in as staff. I open the
   same trip, and I report: delayed, ten minutes."*
3. Point at the rider phone: *"No refresh — watch the badge and the arrival
   times."* Give it the beat it needs. *"Every stop's ETA just moved by ten
   minutes."*
4. Wait for the push: *"And here's the push on the lock screen. I tap it — and I'm
   inside the trip it concerns."*
5. Close: *"One report by staff; every affected rider notified, in seconds."*

**Fallback** (say it calmly if the network misbehaves): *"The venue network isn't
cooperating — here's a recording of exactly this loop"* → play the screen
recording. Practice the switch once so it's smooth.

*→ next slide*

---

## Slide 10 — Architecture (60s) [8:40]

So how is it built? With one unconventional choice: **there is no backend server.
We deleted the middle tier.**

No Express, no API layer — the app talks directly to Postgres, through Supabase.
The app holds only a public key plus the signed-in user's token, and **the
database itself decides what each request may read or write**, through Row-Level
Security.

Why is that a good idea? The security rules live in exactly one place. There's no
server to keep in sync — or to pay for. And the same rules protect every path to
the data: the app, the API, or someone with curl. There is no way around the
database, because the database *is* the gatekeeper.

*→ next slide*

---

## Slide 11 — Security (45s) [9:25] ✂ *(cut for 10-min slot: say only the bold sentence while showing the slide, then move on — saves ~35s)*

Three layers, all inside Postgres. Grants are the ceiling — deny by default.
Row-Level Security narrows each table to exactly your rows. And column-level locks
finish the job: **a rider who tries to change their own role to "staff" gets a
permission error from Postgres itself — no app code involved.** Trips have no
client write path at all; the only way to change a trip is the audited report log
you saw. And secrets live in Vault, never in the code.

*→ next slide*

---

## Slide 12 — One write, four effects (60s) [10:25]

This diagram is the demo you just watched, from the inside.

When staff hit submit, **one database INSERT powers everything you saw.** A
trigger syncs the trip's state. Supabase Realtime streams that change to every
open screen — that's the rider phone updating with no refresh. Then the database
itself fires a webhook to an Edge Function, which finds every rider with an
unmuted favorite on that line or its stops, writes each of them a durable
notification, and sends the pushes — respecting mutes and quiet hours.

And because every accepted write costs real notifications, duplicate reports
within five minutes are rejected *before* any of this fires.

*→ next slide*

---

## Slide 13 — Real data, real schedules (60s) [11:25] ✂ *(cut for 10-min slot: keep the STS + Métro du Sahel sentence — it's the best story in the talk — drop the rest, saves ~30s)*

Getting real Tunisian data in was its own engineering story.

One importer maps any standard GTFS feed onto the app's model, with namespaces so
five agencies' IDs don't collide. But two feeds fought back. **STS published a
broken 2016 pseudo-GTFS inside a RAR archive — I repaired it and geocoded its
stops. And the Métro du Sahel had no digital feed at all — so I authored one, from
the printed summer timetable.**

And there's no external scheduler: recurring patterns like "line 3, 07:10, Monday
to Saturday" become concrete, dated trips through cron jobs running *inside*
Postgres — timezone-correct.

*→ next slide*

---

## Slide 14 — Engineering practice (40s) [12:05] ✂ *(cut for 10-min slot: skip entirely, the slide speaks for itself — saves 40s)*

Briefly, how it was built. Every feature landed as a reviewed pull request to a
protected master branch.
Types are generated from the live database schema, so a schema change that would
break a screen fails compilation — not the demo. Version 1.5.0 is a production
build, and day-to-day fixes ship over the air: a fix reaches installed phones on
the next launch, no store round-trip. And the total hosting bill is **zero**.

*→ next slide*

---

## Slide 15 — Honest limits (40s) [12:45]

I want to be upfront about what this is and isn't.

"Real-time" here means **operator-reported** — not vehicle GPS. That's a
deliberate choice: it works for fleets without GPS equipment, which is most of
Tunisia's. Today it's one direction per line, and holiday calendars aren't applied
yet. The natural next step is GTFS-RT vehicle positions — and the ingestion and
fan-out pipeline you've seen is already built for exactly that.

*→ next slide*

---

## Slide 16 — Stack & deliverables (20s) [13:05]

The stack: Expo and React Native on the phone; Supabase — Postgres, Auth,
Realtime, Edge Functions — behind it; Google Maps for maps. Delivered: a working
production build verified on device, the full source and PR history on GitHub, and
as-built documentation.

*→ next slide*

---

## Slide 17 — Thank you (15s) [13:20]

**TransportFlow. The bus is late — now everybody knows.**

The QR code takes you to the repository. Thank you — I'm happy to take questions.

---
---

# Q&A preparation — likely questions, honest answers

**"Why no backend server? Isn't that risky?"**
The opposite — it removes the riskiest component. Authorization is enforced by
Postgres Row-Level Security on every single request, so there's no server whose
bugs or misconfigurations could bypass the rules. A traditional API would be a
second place where security has to be right; here there's exactly one.

**"The app ships with a key inside the APK — isn't that a secret?"**
No — it's the *anon* key, designed to be public. It grants nothing by itself;
every request is checked by RLS against the signed-in user's token. The privileged
key (service role) exists only inside Supabase's Vault and the Edge Functions,
never in the app or the repo.

**"What stops a staff member from spamming or lying?"**
Every report is attributed — their name is on it, permanently, in an append-only
log. Exact duplicate reports within five minutes are rejected by the database
before any notification fires. And staff status is granted by an admin and can be
revoked. (If asked further: a per-reporter rate limit is a planned hardening step.)

**"Why not GPS / real vehicle positions?"**
Most Tunisian fleets aren't GPS-equipped, so a GPS-only design would exclude
exactly the networks this is for. Operator-reported status works today with zero
hardware. The pipeline — ingest, store, fan out — is format-ready for GTFS-RT
vehicle feeds when an operator can provide them; that's the roadmap's first item.

**"Does it scale? What if thousands of users sign up?"**
The heavy read paths are indexed Postgres queries over a small catalog; the
fan-out batches pushes 100 at a time through Expo's push service; and Supabase's
free tier is the only current constraint — the same architecture upgrades in place
by changing plan, not by re-architecting.

**"What does it cost to run?"**
Today: zero. Supabase free tier, Expo push is free, and Google's native mobile
Maps SDK has no per-load charge on Android. That's deliberate — it has to be
sustainable without funding.

**"Why Supabase and not Firebase?"**
Two reasons: relational data with real SQL — schedules, lines and stops are
naturally relational — and Row-Level Security as the authorization model. Also no
vendor lock-in: it's Postgres underneath, exportable any day.

**"What happens when the operator changes the schedules?"**
Re-run the importer — it's idempotent, so it upserts in place. Recurring patterns
then materialize into dated trips automatically every night inside Postgres.

**"Is it on the Play Store / iOS?"**
Android production build 1.5.0 exists and updates ship over the air; the Play
Store listing is the next release step. The codebase is cross-platform Expo — iOS
is a build away, pending an Apple developer account.

**"Where are the automated tests?"**
Honest answer: type-safety end-to-end plus verified live checks, but no automated
test suite yet — it's first on the hardening list, and it's on the limits slide
because I'd rather name it than hide it.

---

# If the defense is in French

This script translates cleanly — the slide anchors ("Le bus est en retard —
maintenant tout le monde le sait") keep their punch. Ask Claude to produce
`Presentation_Speech_FR.md` from this file if needed.
