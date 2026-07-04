// GTFS -> TransportFlow importer.
//
// Maps a standard GTFS feed onto this project's deliberately simple model:
//
//   routes.txt           -> lines            (mode from route_type)
//   stops.txt            -> stops            (only stops actually served)
//   stop_times.txt       -> line_stops       (ONE representative stop sequence
//                                             per route: the sequence shared by
//                                             the most trips; arrival offsets
//                                             come from its representative trip)
//   trips + calendar.txt -> service_patterns (first-stop departure times x
//                                             service weekdays, merged per
//                                             departure time)
//
// Known lossiness, accepted by design (the app models a line as one ordered
// stop list + departure patterns): only the dominant direction/variant of
// each route is imported, calendar_dates.txt exceptions are ignored, and
// per-trip travel-time variations collapse to the representative trip's.
//
// Usage:
//   node index.mjs --file feed.zip [--dry-run]
//   node index.mjs --url https://.../gtfs.zip --max-routes 40
//
// Applies SQL via the Supabase Management API (needs SUPABASE_ACCESS_TOKEN,
// e.g. from `supabase login`), or writes it to gtfs-import.sql with --dry-run.
// Idempotent: line/stop/line_stop ids are md5-derived from GTFS ids, upserted
// on conflict; service_patterns are delete-and-reinserted per imported line.

import AdmZip from "adm-zip";
import { parse } from "csv-parse/sync";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

// ---------- args ----------
const args = process.argv.slice(2);
function argValue(flag, fallback = undefined) {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : fallback;
}
const FILE = argValue("--file");
const URL_ = argValue("--url");
const MAX_ROUTES = Number(argValue("--max-routes", "40"));
// Namespace folded into every generated id, so feeds whose GTFS ids overlap
// (e.g. two agencies both using route_id "1") can coexist. "" keeps the ids
// of historical single-feed imports.
const PREFIX = argValue("--prefix", "");
const PROJECT_REF = argValue("--project-ref", process.env.SUPABASE_PROJECT_REF ?? "cxekufirfbjoieztiqbz");
const DRY_RUN = args.includes("--dry-run");
const SQL_OUT = argValue("--sql-out", "gtfs-import.sql");

if (!FILE && !URL_) {
  console.error("Usage: node index.mjs (--file feed.zip | --url https://.../gtfs.zip) [--max-routes N] [--dry-run] [--project-ref REF]");
  process.exit(1);
}
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
if (!DRY_RUN && !TOKEN) {
  console.error("SUPABASE_ACCESS_TOKEN is required (or use --dry-run to emit SQL only).");
  process.exit(1);
}

// ---------- load feed ----------
let zipBuf;
if (FILE) {
  zipBuf = readFileSync(FILE);
} else {
  const res = await fetch(URL_, { redirect: "follow" });
  if (!res.ok) throw new Error(`feed download failed: HTTP ${res.status}`);
  zipBuf = Buffer.from(await res.arrayBuffer());
}
const zip = new AdmZip(zipBuf);

function readCsv(name, required = true) {
  const entry = zip.getEntries().find((e) => e.entryName.replace(/^.*\//, "") === name);
  if (!entry) {
    if (required) throw new Error(`${name} missing from feed`);
    return [];
  }
  return parse(entry.getData().toString("utf8"), {
    columns: true,
    bom: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
  });
}

const agency = readCsv("agency.txt");
const routes = readCsv("routes.txt");
const stops = readCsv("stops.txt");
const trips = readCsv("trips.txt");
const stopTimes = readCsv("stop_times.txt");
const calendar = readCsv("calendar.txt", false);
const calendarDates = readCsv("calendar_dates.txt", false);

// Some feeds miscase the tz (TRANSTU ships "AFRICA/TUNIS"); canonicalize
// against the IANA names Node knows so downstream tz math is safe.
const rawTz = agency[0]?.agency_timezone || "UTC";
const TIMEZONE =
  Intl.supportedValuesOf("timeZone").find((z) => z.toLowerCase() === rawTz.toLowerCase()) ?? rawTz;

// ---------- service_id -> ISO weekdays (1=Mon..7=Sun) ----------
const WEEKDAY_COLS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const serviceDays = new Map();
for (const row of calendar) {
  const days = WEEKDAY_COLS.flatMap((col, i) => (row[col] === "1" ? [i + 1] : []));
  if (days.length) serviceDays.set(row.service_id, days);
}
// Feeds without calendar.txt define services purely via calendar_dates
// exceptions; infer a weekly pattern from which weekdays actually occur.
if (serviceDays.size === 0 && calendarDates.length) {
  const byService = new Map();
  for (const row of calendarDates) {
    if (row.exception_type !== "1") continue;
    const d = row.date; // YYYYMMDD
    const date = new Date(Date.UTC(+d.slice(0, 4), +d.slice(4, 6) - 1, +d.slice(6, 8)));
    const iso = ((date.getUTCDay() + 6) % 7) + 1;
    if (!byService.has(row.service_id)) byService.set(row.service_id, new Set());
    byService.get(row.service_id).add(iso);
  }
  for (const [sid, days] of byService) serviceDays.set(sid, [...days].sort());
}

// ---------- stop_times grouped per trip ----------
const timesByTrip = new Map();
for (const st of stopTimes) {
  if (!timesByTrip.has(st.trip_id)) timesByTrip.set(st.trip_id, []);
  timesByTrip.get(st.trip_id).push(st);
}
for (const list of timesByTrip.values()) {
  list.sort((a, b) => Number(a.stop_sequence) - Number(b.stop_sequence));
}

// "HH:MM:SS", hours may exceed 23 (after-midnight service) -> total minutes
function toMinutes(hms) {
  const [h, m] = (hms ?? "").split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

// ---------- per route: dominant sequence, offsets, departure patterns ----------
function md5Uuid(seed) {
  const h = createHash("md5").update(PREFIX ? `${PREFIX}:${seed}` : seed).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

const BUS_TYPES = (t) => t === 3 || t === 11 || (t >= 200 && t <= 299) || (t >= 700 && t <= 799);

const tripsByRoute = new Map();
for (const t of trips) {
  if (!tripsByRoute.has(t.route_id)) tripsByRoute.set(t.route_id, []);
  tripsByRoute.get(t.route_id).push(t);
}

const importedLines = [];
for (const route of routes) {
  const routeTrips = (tripsByRoute.get(route.route_id) ?? []).filter((t) => {
    const st = timesByTrip.get(t.trip_id);
    return st && st.length >= 2 && serviceDays.has(t.service_id);
  });
  if (!routeTrips.length) continue;

  // Group trips by exact stop sequence; keep the sequence run most often.
  const bySignature = new Map();
  for (const t of routeTrips) {
    const sig = timesByTrip.get(t.trip_id).map((st) => st.stop_id).join("|");
    if (!bySignature.has(sig)) bySignature.set(sig, []);
    bySignature.get(sig).push(t);
  }
  const [, groupTrips] = [...bySignature.entries()].sort(
    (a, b) => b[1].length - a[1].length,
  )[0];

  const rep = timesByTrip.get(groupTrips[0].trip_id);
  const t0 = toMinutes(rep[0].departure_time || rep[0].arrival_time);
  if (t0 === null) continue;
  const lineStops = rep.map((st, i) => ({
    stopId: st.stop_id,
    seq: i + 1,
    offset: Math.max(0, (toMinutes(st.arrival_time || st.departure_time) ?? t0) - t0),
  }));

  // Departure patterns from every trip of the dominant sequence: first-stop
  // departure x the trip's service weekdays, unioned per departure time.
  // Departures >= 24:00 wrap to the next day (weekdays rotate accordingly).
  const patterns = new Map();
  for (const t of groupTrips) {
    const depMin = toMinutes(timesByTrip.get(t.trip_id)[0].departure_time);
    if (depMin === null) continue;
    const dayShift = Math.floor(depMin / (24 * 60));
    const minutes = depMin % (24 * 60);
    const time = `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
    const days = serviceDays.get(t.service_id).map((d) => ((d - 1 + dayShift) % 7) + 1);
    if (!patterns.has(time)) patterns.set(time, new Set());
    days.forEach((d) => patterns.get(time).add(d));
  }
  if (!patterns.size || lineStops.length < 2) continue;

  const name = [route.route_short_name, route.route_long_name]
    .filter((s, i, arr) => s && arr.indexOf(s) === i)
    .join(" — ") || route.route_id;

  importedLines.push({
    routeId: route.route_id,
    tripCount: routeTrips.length,
    name,
    mode: BUS_TYPES(Number(route.route_type)) ? "bus" : "train",
    lineStops,
    patterns,
  });
}

importedLines.sort((a, b) => b.tripCount - a.tripCount);
const selected = importedLines.slice(0, MAX_ROUTES);

// Only stops actually used by imported line sequences.
const stopById = new Map(stops.map((s) => [s.stop_id, s]));
const usedStopIds = new Set(selected.flatMap((l) => l.lineStops.map((ls) => ls.stopId)));
const importedStops = [...usedStopIds]
  .map((id) => stopById.get(id))
  .filter((s) => s && s.stop_lat && s.stop_lon);

// ---------- SQL generation ----------
const q = (s) => `'${String(s).replaceAll("'", "''")}'`;

const statements = [];
function chunked(rows, header, footer = "") {
  for (let i = 0; i < rows.length; i += 400) {
    statements.push(header + rows.slice(i, i + 400).join(",\n") + footer + ";");
  }
}

chunked(
  selected.map((l) =>
    `(${q(md5Uuid("tf-line:" + l.routeId))}, ${q(l.name)}, ${q(l.mode)})`),
  "insert into public.lines (id, name, mode) values\n",
  "\non conflict (id) do update set name = excluded.name, mode = excluded.mode",
);

chunked(
  importedStops.map((s) =>
    `(${q(md5Uuid("tf-stop:" + s.stop_id))}, ${q(s.stop_name || s.stop_id)}, ${Number(s.stop_lat)}, ${Number(s.stop_lon)})`),
  "insert into public.stops (id, name, latitude, longitude) values\n",
  "\non conflict (id) do update set name = excluded.name, latitude = excluded.latitude, longitude = excluded.longitude",
);

chunked(
  selected.flatMap((l) =>
    l.lineStops
      .filter((ls) => usedStopIds.has(ls.stopId) && stopById.get(ls.stopId))
      .map((ls) =>
        `(${q(md5Uuid(`tf-linestop:${l.routeId}:${ls.seq}`))}, ${q(md5Uuid("tf-line:" + l.routeId))}, ${q(md5Uuid("tf-stop:" + ls.stopId))}, ${ls.seq}, ${ls.offset})`)),
  "insert into public.line_stops (id, line_id, stop_id, sequence_order, arrival_offset_minutes) values\n",
  `\non conflict (id) do update set line_id = excluded.line_id, stop_id = excluded.stop_id,
  sequence_order = excluded.sequence_order, arrival_offset_minutes = excluded.arrival_offset_minutes`,
);

// Patterns: replace wholesale per imported line so removed departures die.
const lineIdList = selected.map((l) => q(md5Uuid("tf-line:" + l.routeId))).join(", ");
statements.push(`delete from public.service_patterns where line_id in (${lineIdList});`);
chunked(
  selected.flatMap((l) =>
    [...l.patterns.entries()].map(([time, days]) =>
      `(${q(md5Uuid("tf-line:" + l.routeId))}, ${q(time)}, array[${[...days].sort().join(",")}], ${q(TIMEZONE)})`)),
  "insert into public.service_patterns (line_id, departure_time, days_of_week, timezone) values\n",
);

// ---------- apply ----------
const totalPatterns = selected.reduce((n, l) => n + l.patterns.size, 0);
console.log(`feed: ${routes.length} routes, ${stops.length} stops, ${trips.length} trips (tz ${TIMEZONE})`);
console.log(`importing: ${selected.length} lines, ${importedStops.length} stops, ` +
  `${selected.reduce((n, l) => n + l.lineStops.length, 0)} line_stops, ${totalPatterns} patterns`);

if (DRY_RUN) {
  writeFileSync(SQL_OUT, statements.join("\n\n") + "\n");
  console.log(`dry run: wrote ${statements.length} statements to ${SQL_OUT}`);
  process.exit(0);
}

// Batch statements into Management API calls, staying well under size limits.
const batches = [];
let current = "";
for (const stmt of statements) {
  if (current && current.length + stmt.length > 400_000) {
    batches.push(current);
    current = "";
  }
  current += stmt + "\n";
}
if (current) batches.push(current);

for (let i = 0; i < batches.length; i++) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: batches[i] }),
  });
  if (!res.ok) {
    console.error(`batch ${i + 1}/${batches.length} failed: HTTP ${res.status}`, await res.text());
    process.exit(1);
  }
  console.log(`batch ${i + 1}/${batches.length} applied`);
}
console.log("done. Run `select public.materialize_trips(7);` (or wait for the nightly cron) to generate trips.");
