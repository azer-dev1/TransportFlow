# TransportFlow — Comprehensive Specification Analysis

**Source document:** *TransportFlow-MobileDev.pdf* (IEEE Computer Society — ISIMM Student Branch, "From Explorer to Innovator" program)
**Analysis basis:** This report is derived strictly from the two-page document provided. Where the document is silent, this is explicitly flagged rather than assumed.

---

## 1. Executive Summary

**What is the project about?**
TransportFlow is a digital platform (described in the doc as having a mobile frontend) that addresses unreliable public transport information. Per the brief: *"Public transport users often don't have up-to-date information on bus and train schedules, and delays are usually only known when they arrive at the stop, causing wasted time and frustration."*

**What problem is it solving?**
The stated problem is informational asymmetry between transport operators and riders — no advance visibility into schedules or delays. The proposed solution: *"TransportFlow is a digital platform that lets users check daily transport schedules, view real-time updates, and know when a bus or train is delayed."*

**What are the expected deliverables?**
Explicitly listed under section 03 "DELIVERABLES":
- Source Code (GitHub)
- Working Application
- README documentation
- Presentation slides
- Technical Documentation

**What are the major constraints and success criteria?**
Explicit constraints (section 06 "PROJECT DETAILS"):
- Category: Smart Cities / Mobile Dev
- Team Size: 1–4 members
- Duration: 3–5 weeks

No explicit success criteria, grading rubric, or acceptance criteria are stated anywhere in the document. This is a notable gap (see Section 11 — Clarification Questions).

The document also contains an explicit flexibility clause (page 2): *"The proposed solution and suggested features are intended to serve as a guideline rather than a strict implementation plan... provided that the project's core objectives and requirements are respected."* This means the tech stack and even some features are non-binding, but the **core objectives** (undefined precisely, but reasonably read as the Technical Objectives in section 05 and Core Features in section 02) are binding.

---

## 2. Requirements Extraction

Legend: **E** = Explicit (directly stated), **I** = Implied (reasonable inference), **R** = Recommendation (my own addition, not in document).

### 2.1 Functional Requirements

| ID | Requirement | Type | Source/Reference |
|----|---|---|---|
| F1 | View daily bus and train schedules with updated timings | E | Core Features, item 1 |
| F2 | Get real-time updates on delays and schedule changes | E | Core Features, item 2 |
| F3 | Secure sign-in for both users and authorized transport staff | E | Core Features, item 3 |
| F4 | Save favorite routes and frequently used stops | E | Core Features, item 4 |
| F5 | Access information about lines, stops, and timings | E | Core Features, item 5 |
| F6 | Allow staff to report delays and update trip status | E | Core Features, item 6 |
| F7 | Receive notifications for delays and important route updates | E | Core Features, item 7 |
| F8 | Personalized routes/stop info tied to a signed-in account | E | Description: *"Users can sign in to access personalized routes and stop information."* |
| F9 | Role differentiation: regular user vs. authorized staff | E | Description + F3/F6 ("authorized transport staff") |
| F10 | CRUD operations on underlying data (routes, stops, trips, schedules) | I | Technical Objectives item: "CRUD operations" — not tied to a specific entity in the doc |
| F11 | Map/geolocation feature (e.g., nearby stops, live vehicle position) | I | Technical Objectives: "Map & geolocation integration" — feature itself not described in Core Features, so its exact behavior is undefined |
| F12 | Authorization rules restricting staff-only actions from regular users | I | Inferred from "authorized transport staff" wording; no explicit permission model is described |
| F13 | Account registration/sign-up flow | I | Sign-in is explicit; sign-up is not mentioned but is logically required to have accounts |

### 2.2 Non-Functional Requirements

| ID | Requirement | Type | Source/Reference |
|----|---|---|---|
| N1 | Real-time / low-latency data delivery for delay updates | E | Description ("real-time updates"); Tech stack lists WebSockets explicitly |
| N2 | Secure authentication mechanism | E | Core Features item 3 ("Secure sign-in") |
| N3 | Mobile platform delivery | I | Project category "Mobile Dev"; suggested stack "Flutter / React Native" |
| N4 | Usability for general public (non-technical riders) | I | Implied by target audience ("public transport users") |
| N5 | Reliability/accuracy of delay data ("always have accurate data") | E | Description: *"so passengers always have accurate data."* |
| N6 | Performance/responsiveness — no explicit metric | — | Not specified; flagged as a gap |
| N7 | Scalability — no explicit metric (concurrent users, data volume) | — | Not specified; flagged as a gap |

### 2.3 Technical Requirements

| ID | Requirement | Type | Source/Reference |
|----|---|---|---|
| T1 | Authentication & Authorization implementation | E | Technical Objectives |
| T2 | Mobile app development | E | Technical Objectives |
| T3 | Real-time data handling | E | Technical Objectives |
| T4 | Map & geolocation integration | E | Technical Objectives |
| T5 | Database design & management | E | Technical Objectives |
| T6 | Push notifications & live updates | E | Technical Objectives |
| T7 | CRUD operations | E | Technical Objectives |
| T8 | Suggested frontend: Flutter / React Native | E (but non-binding) | Tech Stack table + page-2 flexibility note |
| T9 | Suggested backend: Node.js, Express.js | E (but non-binding) | Tech Stack table |
| T10 | Suggested database: PostgreSQL, Redis | E (but non-binding) | Tech Stack table |
| T11 | Suggested real-time layer: WebSockets | E (but non-binding) | Tech Stack table |

### 2.4 User Requirements (by persona)

| Persona | Needs (as stated) | Source |
|---|---|---|
| Rider / passenger (unauthenticated) | View schedules, line/stop/timing info | Core Features items 1, 5 |
| Rider / passenger (authenticated) | Personalized routes, saved favorites, notifications | Description; Core Features items 3, 4, 7 |
| Authorized transport staff | Sign in, report delays, update trip status | Core Features items 3, 6; Description |

### 2.5 Business / Domain Requirements

| ID | Requirement | Type | Source |
|---|---|---|---|
| B1 | Domain = public transport / Smart Cities | E | Category field |
| B2 | Two-sided platform: passengers + transport operators/staff | E | Description |
| B3 | "Authorized" implies some vetting/permissioning process for staff accounts | I | Word choice "authorized"; mechanism not defined |

### 2.6 Constraints

| ID | Constraint | Type | Source |
|---|---|---|---|
| C1 | Team size 1–4 members | E | Project Details |
| C2 | Duration 3–5 weeks | E | Project Details |
| C3 | Category restricted to Smart Cities / Mobile Dev | E | Project Details |
| C4 | Deliverables fixed (5 items listed) | E | Deliverables section |
| C5 | Tech stack is a *suggestion only*, not mandatory | E | Page 2 note |
| C6 | Core objectives/requirements must still be respected even if implementation differs | E | Page 2 note |

### 2.7 Assumptions (explicitly flagged as assumptions, not requirements)

| ID | Assumption | Rationale |
|---|---|---|
| A1 | "Trip" and "schedule" and "route" are distinct but related data entities | Not formally defined in the doc; inferred from feature wording ("update trip information," "trip status," "schedules," "routes") |
| A2 | Staff accounts are provisioned by an admin/back-office process rather than public self-registration | Inferred from "authorized" — but the doc does not describe how authorization is granted |
| A3 | "Real-time" implies push-based updates (WebSockets) rather than client polling | Inferred from the explicit listing of WebSockets in the tech stack, though this stack is non-binding |
| A4 | The product targets a specific city/region's transit network rather than multiple operators/cities | Not stated either way |

---

## 3. Scope Analysis

### 3.1 Project Scope (as defined by the document)
The scope is bounded by two explicit anchors: the **Core Features** (section 02) and the **Technical Objectives** (section 05), delivered as a working mobile application with the deliverables in section 03, within 3–5 weeks by a 1–4 person team.

### 3.2 Mandatory Features
Treated as mandatory because they appear directly under "Core Features" and "Technical Objectives," and the page-2 note says core objectives/requirements must be respected:
- View schedules (F1)
- Real-time delay/schedule updates (F2)
- Secure sign-in, dual-role (user + staff) (F3, F9)
- Favorite routes/stops (F4)
- Line/stop/timing info access (F5)
- Staff delay reporting & trip status updates (F6)
- Notifications for delays/route updates (F7)
- CRUD, Auth, Mobile dev, Real-time handling, Maps/geolocation, DB design, Push notifications (T1–T7)

### 3.3 Optional / Flexible Elements
Explicitly framed as non-strict by the page-2 note:
- Exact frontend framework (Flutter / React Native is only a *suggestion*)
- Exact backend framework (Node.js/Express is only a *suggestion*)
- Exact database choice (PostgreSQL/Redis is only a *suggestion*)
- Exact real-time mechanism (WebSockets is only a *suggestion* — e.g., MQTT, SSE, or polling could substitute)
- Additional features beyond the listed core set: *"Teams may also extend the project with additional features, improve existing functionality..."*

### 3.4 Explicitly Out of Scope
**Nothing is explicitly stated as out of scope.** The document never uses exclusionary language (e.g., "this project will not include..."). This is a gap, not a finding — flagged in Section 11.

### 3.5 Scope Risks / Potential Scope Creep
- **Map & geolocation integration** is listed as a Technical Objective but has no corresponding Core Feature describing what it should actually do (live vehicle tracking? nearest-stop search? turn-by-turn navigation?). Teams may over-build or under-build this without a clear definition — high scope-ambiguity risk.
- **"Authorized transport staff"** has no defined onboarding/verification flow, which could lead teams to either skip proper authorization logic or over-engineer an admin panel beyond what's needed.
- **CRUD operations** is generic; without defined entities, teams might build CRUD for entities never mentioned (e.g., full admin dashboards, analytics, payment) that extend beyond the brief's intent.
- The explicit "free to extend" clause is a double-edged sword: it legitimizes feature creep under the banner of "improvement," which could consume the already-short 3–5 week timeline if not actively managed.
- Real-time delay reporting (staff-driven) combined with push notifications (user-facing) implies an end-to-end pipeline (staff input → backend → real-time channel → client). This pipeline's complexity is easy to underestimate in a short timeline.

---

## 4. System Design Recommendations
*(Note: this section is necessarily more inferential/recommendation-heavy since the document gives only a suggested stack and feature list, not architecture. Each item below states why it follows from the spec.)*

### 4.1 Suggested Architecture — **R**
A three-tier architecture: Mobile client (Flutter/React Native) ↔ REST/WebSocket API (Node.js/Express) ↔ Data layer (PostgreSQL for persistent data, Redis for caching/pub-sub of real-time events).
**Why it fits:** This mirrors the suggested stack almost directly (section 04) and supports both the CRUD/auth objectives (best served by a REST layer) and the real-time objective (best served by a pub/sub or WebSocket layer), which are the two technical pillars explicitly named in section 05.

### 4.2 Components / Modules — **R**
| Module | Purpose | Maps to requirement |
|---|---|---|
| Auth service | Sign-in/sign-up, role (rider/staff) management | F3, F9, T1 |
| Schedule/Catalog service | Lines, stops, timetables (read-heavy) | F1, F5 |
| Trip/Delay service | Staff updates to trip status, delay events | F6 |
| Notification service | Push notifications on delay/route events | F7, T6 |
| Real-time gateway | WebSocket (or similar) channel broadcasting delay/schedule changes | F2, T3, T11 |
| Favorites/Profile service | Saved routes/stops per user | F4, F8 |
| Map/Geolocation module | Stop discovery, possibly live position display | F11, T4 |

**Why it fits:** Each module corresponds one-to-one with a Core Feature or Technical Objective; nothing is added that isn't traceable to the brief.

### 4.3 Database Design — **R**
Suggested core entities (inferred from feature language, not stated in the doc):
- `User` (id, name, credentials, role: rider/staff)
- `Stop` (id, name, geolocation)
- `Line/Route` (id, name, stops sequence)
- `Trip` (id, line_id, scheduled_time, status, delay_minutes)
- `Favorite` (user_id, route_id or stop_id)
- `Notification` (user_id, trip_id/route_id, message, timestamp)

**Why it fits:** This is the minimal schema needed to support every Core Feature (F1–F7) without adding unrequested entities (e.g., no payment, no ticketing — those are never mentioned).
**Caveat:** This is an inference. The document never defines data entities, so this schema is a recommendation, not a requirement.

### 4.4 API Requirements — **R**
- REST endpoints for CRUD on stops/lines/trips/favorites (supports T7).
- Auth endpoints (login, register, token refresh) (supports T1, F3).
- A WebSocket channel (or SSE) for trip-status/delay broadcast (supports F2, T3, T11).
- Push notification trigger endpoint, likely integrated with a third-party push provider (supports F7, T6) — **the document does not specify a push provider (e.g., Firebase Cloud Messaging); this is an open decision for the team.**

### 4.5 Security Considerations — **R**
- Role-based access control (RBAC) distinguishing rider vs. staff actions, since only staff should be able to "report delays and update trip information" (Core Features item 6).
- Standard authentication hardening (password hashing, token expiry) — not explicitly required by the doc beyond "Secure sign-in," but reasonable given that phrase.
- **The document gives no detail on the staff authorization/vetting process** — this is a genuine open question, not just an implementation detail, since it affects trust in the entire delay-reporting feature (see Section 11).

### 4.6 Scalability Considerations — **R**
- Redis suggested in the stack is well-suited to caching frequently-read schedule data and to backing a pub/sub layer for delay broadcasts — consistent with the stack's own inclusion of Redis alongside WebSockets.
- **No explicit scale targets (number of users, stops, lines, concurrent connections) are given in the document.** Any scalability design is therefore speculative; flagged in Section 11.

### 4.7 Deployment Considerations — **R**
Not addressed at all in the document (no mention of cloud provider, CI/CD, app store distribution, or hosting). Given the "Working Application" deliverable, the team will need to decide deployment targets (e.g., installable APK/TestFlight build vs. app-store release vs. local demo build) — this should be clarified (see Section 11).

---

## 5. Implementation Roadmap

Given the explicit 3–5 week duration (Project Details) and 1–4 person team, the roadmap below assumes the **upper bound (5 weeks)** for safety margin, with milestones. (This is a recommendation — the document gives no week-by-week breakdown.)

| Phase | Focus | Suggested Duration | Key Milestones | Dependencies |
|---|---|---|---|---|
| 1. Research & Planning | Clarify ambiguous requirements (staff auth model, map feature scope, push provider); finalize tech stack choice; define data entities | Days 1–3 | Requirements sign-off; stack decision | Access to organizers for clarification (Section 11) |
| 2. System Design | DB schema, API contract, wireframes, architecture diagram | Days 4–6 | Design docs approved internally | Phase 1 complete |
| 3. Core Development | Auth, schedules CRUD, favorites, staff delay-reporting, real-time channel, notifications, map integration | Weeks 2–4 | Feature-complete build ("feature freeze") | Phase 2 complete; incremental feature delivery |
| 4. Testing | Functional testing of all 7 Core Features; role-based access testing; real-time update testing under simulated delay events | Week 4 (overlapping) – early Week 5 | All Core Features verified | Phase 3 substantially complete |
| 5. Deployment | Build working application artifact; deploy backend; package mobile app for demo/installation | Week 5 (early) | "Working Application" deliverable ready | Phase 4 passed |
| 6. Documentation & Presentation | README, Technical Documentation, Presentation slides | Week 5 (parallel to/after Phase 5) | All 5 deliverables finalized | Can start drafting earlier; finalize once features stable |

**Note on dependencies:** Real-time notification delivery (F7) depends on both the delay-reporting feature (F6) and the notification/real-time module being built — this is the riskiest integration path and should be prioritized early in Phase 3, not left to the end.

---

## 6. Team Planning (Recommendation — team size 1–4 per Project Details)

### 6.1 Suggested Roles (scaled for a 4-person team; reduce/merge roles if team is smaller)
| Role | Responsibilities |
|---|---|
| Mobile/Frontend Developer | Flutter/React Native UI, screens for schedules, favorites, notifications, map view |
| Backend Developer | API (auth, CRUD, real-time gateway), database schema implementation |
| Data/Real-time Engineer | WebSocket/pub-sub layer, delay-event pipeline, push notification integration |
| QA / Documentation Lead | Testing across roles (rider vs staff), README, Technical Documentation, slides |

For a 1–2 person team, merge into "Frontend" and "Backend+Data+Docs" responsibilities.

### 6.2 Task Allocation Principle — **R**
Allocate by vertical feature slices (e.g., one person owns "schedules + favorites end-to-end," another owns "delay reporting + notifications end-to-end") rather than strict frontend/backend split, since the riskiest feature (real-time delay→notification pipeline) spans both layers and benefits from a single owner coordinating it.

### 6.3 Collaboration Workflow — **R**
- Daily or every-other-day short syncs given the compressed 3–5 week timeline.
- Shared task board (e.g., GitHub Projects/Issues) mapped directly to the Core Features list so progress is traceable to the brief.

### 6.4 Git Workflow — **R**
- `main` branch protected; feature branches per Core Feature (e.g., `feature/delay-reporting`, `feature/favorites`).
- Pull requests with at least one reviewer before merge, given GitHub source code is an explicit deliverable and will likely be reviewed by judges.
- Tag a release/build at the end of each phase to create a recoverable checkpoint within the short timeline.

---

## 7. Risk Assessment

| Risk Category | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| Technical | Real-time pipeline (staff report → broadcast → push notification) is the most complex integration and is underspecified | Medium-High | High | Prototype this pipeline first (spike) in Phase 1–2 before building UI polish |
| Technical | Map/geolocation feature scope is undefined, risking wasted effort | Medium | Medium | Clarify with organizers (Section 11) before investing development time |
| Timeline | 3–5 weeks is short for 7 Core Features + 7 Technical Objectives with a 1–4 person team | High | High | Aggressively prioritize mandatory features; treat extensions as stretch goals only |
| Requirement | No defined success/grading criteria — teams cannot verify they're "done" | High | Medium | Request rubric/evaluation criteria from organizers early |
| Requirement | "Authorized staff" provisioning process undefined | Medium | Medium | Decide and document an assumption explicitly (e.g., seeded staff accounts) if organizers can't clarify in time |
| Integration | Mobile client + chosen backend + real-time layer + push notification provider must all interoperate; any one swap from the suggested stack increases integration risk | Medium | Medium | If deviating from suggested stack, validate the end-to-end pipeline early, not at the end |
| Security | No defined password/auth policy; risk of weak/naive authentication implementation under time pressure | Medium | Medium | Use a well-tested auth library/service rather than custom crypto |
| Security | Staff role elevation/abuse if authorization isn't properly enforced server-side | Medium | High | Enforce RBAC checks server-side (not just hidden UI), given staff actions affect data integrity for all users |
| Scope | "Free to extend" clause may encourage feature creep that jeopardizes core deliverables | Medium | High | Freeze scope to Core Features + Technical Objectives until those are demonstrably working; treat anything else as optional/stretch |

---

## 8. Evaluation Strategy (Inferred — this is an academic/competition context: IEEE Computer Society / ISIMM student branch, "From Explorer to Innovator" program)

**Likely judging criteria (inferred from deliverables and objectives, not stated explicitly):**
- Functional completeness against the 7 Core Features
- Demonstrated technical objectives (CRUD, auth, real-time, maps, DB design, push notifications)
- Quality/clarity of documentation (README, Technical Documentation — both explicit deliverables)
- Presentation quality (Presentation slides — explicit deliverable)
- Code quality/organization (GitHub Source Code — explicit deliverable, suggesting judges may review the repo)
- Working, demoable application (explicit deliverable: "Working Application")

**Common areas teams lose marks (general competition-pattern reasoning, not from the document):**
- Real-time features that are "faked" with polling intervals long enough to look broken in a live demo
- Missing role separation (rider can do staff actions, or vice versa)
- Incomplete documentation submitted at the last minute
- Over-scoped map features that don't work reliably, instead of a smaller working version
- No tests/no evidence the real-time delay pipeline actually works end-to-end during a live demo

**Suggestions to maximize scoring while staying in scope — R:**
- Ensure every one of the 7 Core Features has a visible, demoable path in the app — judges can likely map the demo directly to the printed feature list.
- Keep additions (if any) clearly secondary to a polished, reliable core; a working core beats a sprawling, unstable extended feature set.
- Make the README and Technical Documentation map explicitly to the Technical Objectives (section 05) so evaluators can trace each objective to its implementation.

---

## 9. Development Checklist

**Planning**
- [ ] Confirm team size (1–4) and assign roles
- [ ] Decide on final tech stack (confirm or deviate from suggestion; document rationale either way)
- [ ] Define data entities (User, Stop, Line, Trip, Favorite, Notification, etc.)
- [ ] Clarify open questions with organizers (see Section 11) before deep implementation

**Design**
- [ ] Database schema diagram
- [ ] API contract (REST endpoints + real-time channel spec)
- [ ] Wireframes for rider and staff views
- [ ] Architecture diagram for documentation deliverable

**Core Feature Implementation**
- [ ] F1 — Daily schedule viewing
- [ ] F2 — Real-time delay/schedule updates
- [ ] F3 — Secure sign-in (rider + staff roles)
- [ ] F4 — Favorite routes/stops
- [ ] F5 — Line/stop/timing info browsing
- [ ] F6 — Staff delay reporting / trip status update
- [ ] F7 — Notifications for delays/route updates

**Technical Objectives**
- [ ] CRUD operations across core entities
- [ ] Authentication & Authorization (with RBAC for staff actions)
- [ ] Mobile app build (Flutter/React Native or chosen alternative)
- [ ] Real-time data handling (WebSocket or chosen alternative)
- [ ] Map & geolocation integration (scope confirmed with organizers)
- [ ] Database design finalized and implemented
- [ ] Push notifications wired to a provider

**Testing**
- [ ] Rider-flow end-to-end test
- [ ] Staff-flow end-to-end test (delay report → broadcast → notification received)
- [ ] Access-control test (rider cannot perform staff actions)
- [ ] Real-time latency sanity check (demo-readiness)

**Deployment**
- [ ] Backend deployed/runnable
- [ ] Mobile app build produced and installable for demo

**Documentation & Deliverables**
- [ ] Source Code pushed to GitHub
- [ ] README documentation written
- [ ] Technical Documentation written
- [ ] Presentation slides prepared
- [ ] Working Application packaged/ready to demo

---

## 10. Summary of Key Uncertainties Flagged Throughout
- No grading rubric or explicit success criteria
- No defined scope/behavior for "Map & geolocation integration"
- No defined staff authorization/provisioning process
- No performance, scalability, or concurrency targets
- No deployment/hosting expectations for the "Working Application" deliverable
- No specified push notification provider
- No explicit statement of what is *out of scope*

---

## 11. Clarification Questions for IEEE Organizers / Supervisors

1. Is there a formal grading rubric or weighted evaluation criteria for this project? If so, can it be shared in advance?
2. What exactly should "Map & geolocation integration" accomplish — nearest-stop lookup, live vehicle tracking on a map, route navigation, or something else?
3. How are "authorized transport staff" accounts created/verified — is a self-contained admin-seeding mechanism acceptable, or is a specific provisioning workflow expected?
4. Are there any expected scale targets (number of users, stops, lines, concurrent real-time connections) the solution should be designed to handle?
5. Is real public transit data (e.g., a city's actual GTFS feed) expected/available, or is mock/synthetic data acceptable for the demo?
6. What deployment/hosting expectations exist for the "Working Application" deliverable — must it run on judges' devices, be hosted online, or is a local/demo-only build sufficient?
7. Is a specific push notification provider (e.g., Firebase Cloud Messaging, APNs) required, or is any approach acceptable?
8. Are there constraints on third-party paid services (maps APIs, hosting, push services) given this is a student/competition project?
9. Is deviation from the suggested tech stack viewed neutrally, or does adherence to the suggested stack affect scoring in practice?
10. What format and length are expected for the "Technical Documentation" and "README" deliverables — is there a template?
11. Is offline/degraded-connectivity behavior expected (since transit riders may have poor connectivity), or is this out of scope?
12. Are there any data-privacy or compliance expectations given the system stores user accounts and possibly location data?
