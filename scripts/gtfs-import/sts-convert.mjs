// STS (Société de Transport du Sahel) feed repair: the portal publishes a
// ".zip" that is really a RAR v4 of UTF-16LE tab-separated files — GTFS-shaped
// but unusable as-is: misspelled headers ("Thirsday", "Sart_date",
// "Departure_itme"), header rows with missing/space-mangled tabs,
// "stop-times.txt" filename, DD/MM/YYYY calendar dates, H:MM times, and a
// stops.txt with Arabic-only names and NO coordinates.
//
// This converter emits a clean GTFS zip. Coordinates and Latin names for the
// 65 stops that actually appear in stop_times come from the Référentiel
// National d'Arrêts / SNCFT station registry where a confident match exists
// (STOPS table below); the remaining village stops are linearly interpolated
// between their coordinate-bearing neighbours along each trip's stop sequence,
// which places them on the right road corridor. Stops with no coordinates
// after interpolation are left blank and dropped by the importer.
//
// Usage:
//   tar -xf sts.zip            # bsdtar reads the RAR
//   node sts-convert.mjs --dir STS --out sts.gtfs.zip

import AdmZip from "adm-zip";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const args = process.argv.slice(2);
const argValue = (f, d) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };
const DIR = argValue("--dir");
const OUT = argValue("--out", "sts.gtfs.zip");
if (!DIR) { console.error("Usage: node sts-convert.mjs --dir <extracted STS dir> [--out sts.gtfs.zip]"); process.exit(1); }

// [Latin name, lat, lon] — coordinates null where only the corridor is known
// (filled by interpolation below). Sources: Référentiel National d'Arrêts
// (STS/SNCFT/SRT/SNTRI rows) for matched stations, town centres otherwise.
const STOPS = {
  1: ["Sousse", 35.8228, 10.6416],
  2: ["Hammam Sousse", 35.8702, 10.5865],
  11: ["Zaouiet Sousse", 35.7864, 10.6191],
  12: ["Messadine", 35.7589, 10.6005],
  13: ["M'saken", 35.733, 10.5752],
  24: ["Sidi Bou Ali", 35.9532, 10.4513],
  26: ["Échangeur Hergla", null, null],
  34: ["Borjine", null, null],
  35: ["Hdadra", null, null],
  39: ["Essebala", null, null],
  40: ["Ghabghoub", null, null],
  41: ["Sidi El Hani", 35.6706, 10.3186],
  46: ["Jemmal", 35.6286, 10.7576],
  106: ["Centrale Électrique", 35.792, 10.656],
  108: ["Sahline", 35.7596, 10.7015],
  116: ["Menzel Hayet", 35.649, 10.681],
  117: ["Kerker", 35.4683, 10.6597],
  118: ["Échangeur Boumerdès", null, null],
  128: ["Hbira", 35.417, 10.383],
  129: ["El Khadhraoui", null, null],
  130: ["El Mrazig", null, null],
  131: ["El Ghabet", null, null],
  132: ["Kairouan", 35.6781, 10.0963],
  134: ["Enfidha", 36.1354, 10.3808],
  138: ["Bouficha", 36.3033, 10.4512],
  142: ["Hammamet", 36.4, 10.6119],
  143: ["Bou Thadi", null, null],
  155: ["Sidi Bouzid", 35.044, 9.4974],
  171: ["Gafsa", 34.425, 8.7842],
  181: ["El Fahs", 36.3747, 9.9067],
  184: ["Goubellat", 36.5439, 9.6614],
  185: ["Medjez el Bab", 36.6437, 9.6042],
  187: ["Oued Zarga", 36.6733, 9.4266],
  189: ["Béja", 36.7256, 9.1817],
  196: ["Aïn Mzaker", 36.2016, 10.279],
  201: ["Hicher", null, null],
  205: ["Ennadhour", 36.093, 10.0894],
  206: ["Monastir", 35.7706, 10.8253],
  208: ["Aéroport Monastir", 35.762, 10.7512],
  214: ["Menzel Harb", null, null],
  217: ["Hôtel Robinson", null, null],
  220: ["Nabeul", 36.4561, 10.7376],
  224: ["Korba", 36.5789, 10.8582],
  229: ["Menzel Temime", 36.7812, 10.9943],
  231: ["Mahdia", 35.5008, 11.0643],
  234: ["Bekalta", 35.6152, 10.9894],
  235: ["Teboulba", 35.6377, 10.9616],
  236: ["Moknine", 35.6313, 10.9156],
  237: ["Ksar Hellal", 35.6451, 10.9009],
  240: ["Ksibet el Médiouni", 35.686, 10.841],
  250: ["Bennane", 35.6772, 10.8481],
  289: ["Bouhjar", 35.6724, 10.8676],
  296: ["Haffouz", 35.631, 9.6764],
  305: ["Makthar", 35.8579, 9.2072],
  312: ["Le Sers", 36.075, 9.0208],
  318: ["Le Kef", 36.1826, 8.7148],
  322: ["Bou Hlel", null, null],
  329: ["El Mangoura", null, null],
  330: ["El Jem", 35.3, 10.7167],
  453: ["Borj El Aifa", null, null],
  463: ["Sayada", 35.6661, 10.8882],
  464: ["Aéroport – Ruspina", null, null],
  465: ["Skanes Hôtels", null, null],
  523: ["Bembla – Menara", 35.6944, 10.792],
  714: ["Zaghouan", 36.4029, 10.1429],
};

// Latin route names for the 16 routes that carry trips (route_id -> name).
const ROUTES = {
  11301: "Sousse – Kairouan",
  11304: "Sousse – Gafsa",
  11306: "Sousse – Zaghouan – Béja",
  15252: "Sousse – Enfidha – Ennadhour",
  21321: "Monastir – Kélibia",
  21322: "Monastir – Sousse – Kairouan",
  22323: "Jemmal – Nabeul",
  22324: "Jemmal – Kairouan",
  24240: "Mahdia – Sayada – Sousse",
  24325: "Bekalta – Le Kef",
  31201: "Mahdia – Bennane – Sousse",
  31202: "Mahdia – Monastir – Sousse",
  31223: "Mahdia – Sayada – Sousse",
  31301: "Mahdia – Kairouan",
  31341: "Hammam Sousse – Nabeul",
  32511: "El Jem – Sousse",
};

// UTF-16LE TSV -> array of trimmed cell arrays (skips the malformed header row).
function rows(name) {
  const text = readFileSync(join(DIR, name), "utf16le").replace(/^﻿/, "");
  return text.split(/\r?\n/).slice(1).filter((l) => l.trim())
    .map((l) => l.split("\t").map((c) => c.trim()));
}

const routesIn = rows("routes.txt");   // agency_id, numligne, route_id, long_name, type, type_name
const stopsIn = rows("stops.txt");     // stop_id, name (Arabic)
const tripsIn = rows("trips.txt");     // trip_id, route_id, service_id, direction_id
const calIn = rows("calendar.txt");    // service_id, 7 day flags, start, end (DD/MM/YYYY)
const stIn = rows("stop-times.txt");   // trip_id, stop_id, arrival, departure, sequence

// Interpolate missing coordinates along each trip's stop sequence.
const coord = new Map();
for (const [id, [, lat, lon]] of Object.entries(STOPS)) if (lat !== null) coord.set(id, [lat, lon]);
const seqByTrip = new Map();
for (const [trip, stop] of stIn.map((r) => [r[0], r[1]])) {
  if (!seqByTrip.has(trip)) seqByTrip.set(trip, []);
  seqByTrip.get(trip).push(stop);
}
for (const seq of seqByTrip.values()) {
  for (let i = 0; i < seq.length; i++) {
    if (coord.has(seq[i])) continue;
    const prev = seq.slice(0, i).reverse().find((s) => coord.has(s));
    const next = seq.slice(i + 1).find((s) => coord.has(s));
    if (!prev || !next) continue;
    const gap = seq.indexOf(next) - seq.lastIndexOf(prev);
    const k = (i - seq.lastIndexOf(prev)) / gap;
    const [la1, lo1] = coord.get(prev);
    const [la2, lo2] = coord.get(next);
    coord.set(seq[i], [+(la1 + (la2 - la1) * k).toFixed(5), +(lo1 + (lo2 - lo1) * k).toFixed(5)]);
  }
}

// ---------- emit ----------
const q = (s) => (/[",]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s);
const hms = (t) => { const [h, m] = t.split(":"); return `${h.padStart(2, "0")}:${m}:00`; };
const ymd = (d) => { const [dd, mm, yy] = d.split("/"); return `${yy}${mm}${dd}`; };

const out = {};
out["agency.txt"] = "agency_id,agency_name,agency_url,agency_timezone\nSTS,Société de Transport du Sahel,https://www.sts.tn,Africa/Tunis\n";
// The raw feed is internally inconsistent: some routes referenced by trips
// (e.g. 22323 Jemmal – Nabeul) have no routes.txt row; synthesize those.
const routeIds = new Set(routesIn.map((r) => r[2]));
const orphanRoutes = [...new Set(tripsIn.map((r) => r[1]).filter((id) => id && !routeIds.has(id)))];
out["routes.txt"] = "route_id,agency_id,route_short_name,route_long_name,route_type\n" +
  routesIn.filter((r) => r[2]).map((r) => `${r[2]},STS,${r[1]},${q(ROUTES[r[2]] ?? r[3])},3`)
    .concat(orphanRoutes.map((id) => `${id},STS,${id.slice(-3)},${q(ROUTES[id] ?? id)},3`))
    .join("\n") + "\n";
out["stops.txt"] = "stop_id,stop_name,stop_lat,stop_lon\n" +
  stopsIn.filter((r) => r[0]).map((r) => {
    const [name] = STOPS[r[0]] ?? [r[1]];
    const c = coord.get(r[0]);
    return `${r[0]},${q(name)},${c ? c[0] : ""},${c ? c[1] : ""}`;
  }).join("\n") + "\n";
out["trips.txt"] = "trip_id,route_id,service_id,direction_id\n" +
  tripsIn.filter((r) => r[0]).map((r) => r.slice(0, 4).join(",")).join("\n") + "\n";
out["calendar.txt"] = "service_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date\n" +
  calIn.filter((r) => r[0]).map((r) => [...r.slice(0, 8), ymd(r[8]), ymd(r[9])].join(",")).join("\n") + "\n";
out["stop_times.txt"] = "trip_id,stop_id,arrival_time,departure_time,stop_sequence\n" +
  stIn.filter((r) => r[0]).map((r) => `${r[0]},${r[1]},${hms(r[2])},${hms(r[3])},${r[4]}`).join("\n") + "\n";

const zip = new AdmZip();
for (const [name, text] of Object.entries(out)) zip.addFile(name, Buffer.from(text, "utf8"));
zip.writeZip(OUT);
const located = stopsIn.filter((r) => coord.has(r[0])).length;
console.log(`wrote ${OUT}: ${routesIn.length} routes, ${tripsIn.length} trips, ${stIn.length} stop_times, ${located} stops with coordinates`);
