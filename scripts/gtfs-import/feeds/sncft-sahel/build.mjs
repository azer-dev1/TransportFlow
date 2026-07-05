// Hand-authored GTFS for the SNCFT Métro du Sahel (Banlieue du Sahel).
//
// No machine-readable schedule exists for this line: the portal's SNCFT GTFS
// dataset has no files, so trips were transcribed from the official été 2026
// poster (sncft.com.tn/voyageurs/banlieue-sahel, affiche-ete-2026-new-1).
// Stations come from the portal's "Cartographie des stations du Banlieue
// sahel" CSV, plus Moknine Zone Industrielle (absent there) from the
// Référentiel National d'Arrêts.
//
// Per-train intermediate times are derived from each train's real first-stop
// departure plus one representative run's offsets (train 505 southbound,
// train 528 northbound) — the importer collapses per-trip variations to the
// representative trip anyway, so nothing is lost downstream. The four partial
// workings (503, 527, 506, 536) carry their real transcribed times; the
// importer drops them as non-dominant variants, they are kept here for
// completeness.
//
// Usage:  node build.mjs   -> writes trips.txt, stop_times.txt, sncft-sahel.gtfs.zip

import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";
const AdmZip = createRequire(import.meta.url)("adm-zip");

// Station order of the poster's 32 columns, Sousse -> Mahdia.
const S_ORDER = [
  "231A", "232B", "233C", "234D", "235E", "236F", "239J", "237G", "240K", "238H",
  "272Z", "241L", "254C", "242M", "243N", "244P", "245R", "246S", "247P", "248W",
  "249X", "260J", "MZI", "270X", "261K", "262L", "264N", "265P", "271Y", "266R",
  "268T", "267S",
];
const N_ORDER = [...S_ORDER].reverse();

// Minute offsets of the representative full runs (train 505 / train 528).
const S_OFFSETS = [0, 2, 6, 8, 11, 14, 18, 20, 26, 35, 39, 41, 43, 45, 50, 52, 54, 56, 58, 60, 62, 66, 67, 69, 72, 81, 85, 91, 93, 97, 101, 107];
const N_OFFSETS = [0, 4, 7, 10, 18, 21, 28, 32, 34, 36, 40, 42, 44, 47, 50, 52, 54, 58, 62, 63, 67, 68, 85, 89, 95, 97, 100, 104, 107, 110, 113, 115];

// Full-line trains: [train number, first-stop departure "H:MM"].
const S_TRAINS = [
  ["505", "5:45"], ["507", "6:30"], ["509", "7:20"], ["511", "8:00"],
  ["513", "9:10"], ["515", "10:10"], ["517", "11:10"], ["519", "12:00"],
  ["521", "13:10"], ["523", "13:45"], ["525", "14:45"], ["529", "16:10"],
  ["531", "17:10"], ["533", "18:10"], ["535", "18:45"], ["537", "19:40"],
  ["539", "20:20"],
];
const N_TRAINS = [
  ["528", "13:15"], ["508", "5:15"], ["510", "5:55"], ["514", "6:40"],
  ["516", "7:50"], ["518", "8:35"], ["520", "9:50"], ["522", "10:35"],
  ["524", "11:25"], ["526", "12:10"], ["530", "14:10"], ["532", "15:10"],
  ["534", "16:00"], ["538", "17:30"], ["540", "18:10"], ["542", "19:25"],
  ["544", "20:10"],
];

// Partial workings, real transcribed times: [train, route, [stopId, "H:MM"][]].
const at = (order, from, times) => times.map((t, i) => [order[from + i], t]);
const PARTIALS = [
  ["503", "MS-S", at(S_ORDER, 0, ["5:10", "5:12", "5:16", "5:18", "5:21", "5:24", "5:28", "5:30", "5:36", "5:40"])],
  ["527", "MS-S", at(S_ORDER, 0, ["15:30", "15:32", "15:36", "15:38", "15:41", "15:44", "15:48", "15:50", "15:56", "16:10", "16:14", "16:16", "16:18", "16:21", "16:26", "16:29", "16:32", "16:35", "16:38", "16:41", "16:44", "16:48", "16:49", "16:52", "16:55", "16:59"])],
  ["506", "MS-N", at(N_ORDER, 22, ["5:50", "5:54", "6:00", "6:02", "6:05", "6:09", "6:12", "6:15", "6:18", "6:20"])],
  ["536", "MS-N", [
    ["262L", "17:10"], ["261K", "17:14"], ["MZI", "17:18"], ["260J", "17:22"],
    ["249X", "17:24"], ["248W", "17:27"], ["247P", "17:29"], ["246S", "17:32"],
    ["245R", "17:34"], ["244P", "17:37"], ["243N", "17:41"], ["242M", "17:44"],
    ["254C", "17:46"], ["272Z", "17:50"], ["238H", "18:03"], ["240K", "18:07"],
    ["237G", "18:13"], ["239J", "18:15"], ["236F", "18:18"], ["235E", "18:22"],
    ["233C", "18:27"], ["232B", "18:30"], ["231A", "18:32"],
  ]],
];

const toMin = (t) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
const hms = (min) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}:00`;

const tripRows = [];
const stRows = [];
function addTrip(trip, route, stopTimes) {
  tripRows.push(`${route},DAILY,${trip}`);
  stopTimes.forEach(([stopId, time], i) => {
    const t = hms(toMin(time));
    stRows.push(`${trip},${t},${t},${stopId},${i + 1}`);
  });
}
for (const [trip, dep] of S_TRAINS) addTrip(trip, "MS-S", S_ORDER.map((s, i) => [s, hms(toMin(dep) + S_OFFSETS[i]).slice(0, 5)]));
for (const [trip, dep] of N_TRAINS) addTrip(trip, "MS-N", N_ORDER.map((s, i) => [s, hms(toMin(dep) + N_OFFSETS[i]).slice(0, 5)]));
for (const [trip, route, stopTimes] of PARTIALS) addTrip(trip, route, stopTimes);

writeFileSync("trips.txt", "route_id,service_id,trip_id\n" + tripRows.join("\n") + "\n");
writeFileSync("stop_times.txt", "trip_id,arrival_time,departure_time,stop_id,stop_sequence\n" + stRows.join("\n") + "\n");

const zip = new AdmZip();
for (const f of ["agency.txt", "routes.txt", "calendar.txt", "stops.txt", "trips.txt", "stop_times.txt"]) zip.addLocalFile(f);
zip.writeZip("sncft-sahel.gtfs.zip");
console.log(`wrote ${tripRows.length} trips / ${stRows.length} stop_times -> sncft-sahel.gtfs.zip`);
