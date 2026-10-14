/* UBR-L3-05 — Surge exposure per city and local hour: requests priced above 1.0x, and the
   same share weighted by completed trips (SQL).
   Simulated practice scenario set in a public ride-hailing marketplace domain. All cities'
   data, zones, surge windows, requests and trips are generated from the seed and are
   hypothetical; real city names and IANA time zones are used only as labels.

   One deterministic result set for one local report date D: one row per (city_id, local hour
   of D in the city's own time zone) with at least min_requests requests, carrying
     requests                 ride requests made in that local hour;
     surged_requests          those priced above 1.00x: the multiplier of the request's zone's
                              surge window in force at requested_at (starts_at <= t < ends_at),
                              1.00 when no window is in force;
     request_surge_share      surged_requests / requests, rounded to 4 places;
     completed_trips          requests from that hour that have a completed trip (a completed
                              trip counts in the hour of its request);
     surged_completed_trips   the completed ones that were priced above 1.00x;
     completed_surge_share    surged_completed_trips / completed_trips, rounded to 4 places,
                              NULL when completed_trips is 0.
   level: 1 Medium    two cities with whole-hour offsets; one trip per request at most;
                      a window boundary hit exactly (start counts, end does not); a 1.00x
                      window; requests on the neighbouring local days; an hour with no
                      completed trip (NULL share); min_requests 1
          2 Hard      + re-matches (driver-cancelled trips before the final one: fan-out),
                      adjacent windows, a minimum-requests floor with an hour below it
          3 Very Hard + three cities including a half-hour offset (Asia/Kolkata), an hour 0 with
                      a request exactly at local midnight and one a second before it */
import { insertSQL, ts } from "../../js/rng.js";

export const kind = "sql";

const H = 3600, DAY = 86400;
// Offsets (minutes east of UTC) on 14–17 September 2026. None of these zones changes its
// offset in that window (Sydney's daylight time starts 4 October 2026; London and New York
// change in late October / early November), so a fixed offset is exact for the oracle.
const WHOLE = [
  { id: "chicago", tz: "America/Chicago", off: -300 },
  { id: "london", tz: "Europe/London", off: 60 },
  { id: "los_angeles", tz: "America/Los_Angeles", off: -420 },
  { id: "new_york", tz: "America/New_York", off: -240 },
  { id: "singapore", tz: "Asia/Singapore", off: 480 },
  { id: "sydney", tz: "Australia/Sydney", off: 600 },
  { id: "tokyo", tz: "Asia/Tokyo", off: 540 },
  { id: "lagos", tz: "Africa/Lagos", off: 60 },
];
const HALF = [
  { id: "mumbai", tz: "Asia/Kolkata", off: 330 },
  { id: "bengaluru", tz: "Asia/Kolkata", off: 330 },
];
const ZONE_NAMES = ["airport", "downtown", "riverside", "stadium", "university", "old_town"];
const SURGED = [110, 120, 125, 140, 150, 175, 200, 230];

const pad2 = (n) => String(n).padStart(2, "0");
const isoDate = (sec) => new Date(sec * 1000).toISOString().slice(0, 10);
const stamp = (sec) => ts(isoDate(sec), ((sec % DAY) + DAY) % DAY);
// "YYYY-MM-DD HH:00:00" of the wall clock at offset `off` minutes, and that wall-clock date.
const hourLabel = (sec, off) => {
  const l = sec + off * 60;
  return `${isoDate(l)} ${pad2(Math.floor((((l % DAY) + DAY) % DAY) / H))}:00:00`;
};
const round4 = (a, b) => Math.floor((2 * a * 10000 + b) / (2 * b)) / 10000;   // half up, a, b >= 0

export function generate(r, level) {
  const dayStr = `2026-09-${pad2(r.int(14, 17))}`;
  const dayUTC = Date.UTC(2026, 8, Number(dayStr.slice(8))) / 1000;
  const minReq = level === 1 ? 1 : r.pick([2, 3]);

  const cities = level === 3
    ? [...r.sample(WHOLE, 2), r.pick(HALF)]
    : r.sample(WHOLE, level === 1 ? 2 : r.int(2, 3));
  cities.sort((a, b) => (a.id < b.id ? -1 : 1));
  for (const c of cities) {
    c.base = dayUTC - c.off * 60;                                    // local midnight of D, UTC seconds
    c.zones = r.sample(ZONE_NAMES, level === 1 ? 2 : r.int(2, 3)).sort().map((n) => c.id + "_" + n);
    const nHours = level === 1 ? 3 : level === 2 ? 4 : r.int(4, 5);
    const hours = r.sample([...Array(22)].map((_, i) => i + 1), nHours);   // local hours 1..22
    if (level === 3 && c === cities[0]) hours[0] = 0;                 // an hour 0 in the first city
    c.hours = hours.sort((a, b) => a - b).map((h) => ({ h, small: false, reqs: [] }));
    if (minReq >= 2) r.pick(c.hours.filter((x) => x.h !== 0)).small = true;   // below the floor
    c.windows = Object.fromEntries(c.zones.map((z) => [z, []]));
  }
  const big = (c) => c.hours.filter((x) => !x.small);

  const windows = [];
  const addWindow = (c, zone, start, end, mult) => {               // local seconds; false on overlap
    const list = c.windows[zone];
    if (end <= start || list.some((w) => start < w.e && w.s < end)) return false;
    const w = { c, zone, s: start, e: end, start: c.base + start, end: c.base + end, mult };
    list.push(w);
    windows.push(w);
    return true;
  };
  const requests = [];
  const addReq = (c, hr, zone, s) => {
    const x = { c, zone, s, at: c.base + s, trips: [], noComplete: false };
    if (hr) hr.reqs.push(x);
    requests.push(x);
    return x;
  };

  // F1: a surged window whose start and end are both hit by a request (start counts, end not).
  {
    const c = r.pick(cities), hr = r.pick(big(c)), zone = r.pick(c.zones);
    const s = hr.h * H + r.int(5, 20) * 60, e = s + r.int(10, 25) * 60;
    addWindow(c, zone, s, e, r.pick(SURGED));
    addReq(c, hr, zone, s);
    addReq(c, hr, zone, e);
  }
  // F2: a window that explicitly sets 1.00x, with a request inside it.
  for (let tries = 0; tries < 50; tries++) {
    const c = r.pick(cities), hr = r.pick(big(c)), zone = r.pick(c.zones);
    const s = hr.h * H + r.int(0, 30) * 60, e = s + r.int(10, 25) * 60;
    if (addWindow(c, zone, s, e, 100)) { addReq(c, hr, zone, s + r.int(1, e - s - 1)); break; }
  }
  // F3: a request exactly on a local hour.
  {
    const c = r.pick(cities), hr = r.pick(big(c));
    addReq(c, hr, r.pick(c.zones), hr.h * H);
  }
  // F4 (level 3): a request exactly at local midnight of D (hour 0) and one a second before it.
  if (level === 3) {
    const c = cities[0], hr = c.hours.find((x) => x.h === 0);
    addReq(c, hr, r.pick(c.zones), 0);
    addReq(c, null, r.pick(c.zones), -1);
  }

  // Random surge windows around the active hours.
  for (const c of cities) {
    for (const zone of c.zones) {
      for (const hr of c.hours) for (let k = 0; k < 2; k++) {
        if (!r.chance(0.7)) continue;
        const s = hr.h * H + r.int(-20, 50) * 60, e = s + r.int(15, 50) * 60;
        if (!addWindow(c, zone, s, e, r.chance(0.85) ? r.pick(SURGED) : 100)) continue;
        if (level >= 2 && r.chance(0.45)) {
          const prev = c.windows[zone][c.windows[zone].length - 1].mult;
          const next = r.pick([100, ...SURGED].filter((m) => m !== prev));
          addWindow(c, zone, e, e + r.int(10, 30) * 60, next);     // starts exactly where the last ends
        }
      }
    }
  }
  // Random requests to fill each hour; requests at window ends inside a busy hour.
  for (const c of cities) {
    for (const hr of c.hours) {
      const want = hr.small ? minReq - 1 : r.int(Math.max(minReq, 2), level === 1 ? 5 : 6);
      while (hr.reqs.length < want) addReq(c, hr, r.pick(c.zones), hr.h * H + r.int(0, H - 1));
    }
    // Neighbouring local days: before local midnight of D and from local midnight of D+1.
    addReq(c, null, r.pick(c.zones), -r.int(60, 3 * H));
    addReq(c, null, r.pick(c.zones), DAY + (r.chance(0.3) ? 0 : r.int(60, 3 * H)));
    if (level >= 2) addReq(c, null, r.pick(c.zones), -r.int(3 * H, 9 * H));
  }
  // F5: one counted hour has no completed trip at all.
  {
    const c = r.pick(cities), hr = r.pick(big(c));
    for (const x of hr.reqs) x.noComplete = true;
  }

  // Trips: an optional chain of driver-cancelled matches (level 2+), then the final outcome.
  let driver = r.int(1000, 5000);
  for (const x of requests) {
    const roll = r.next();
    const final = x.noComplete
      ? r.pick(["none", "rider_cancelled", "driver_cancelled"])
      : roll < 0.62 ? "completed" : roll < 0.75 ? "none" : roll < 0.9 ? "rider_cancelled" : "driver_cancelled";
    if (final === "none") continue;
    let t = x.at + r.int(15, 180);
    const pre = level >= 2 && r.chance(0.35) ? (level === 3 ? r.int(1, 2) : 1) : 0;
    for (let k = 0; k < pre; k++) {
      const end = t + r.int(60, 480);
      x.trips.push({ status: "driver_cancelled", matched: t, ended: end, driver: "drv_" + (driver += r.int(1, 97)) });
      t = end + r.int(10, 120);
    }
    const end = final === "completed" ? t + r.int(5 * 60, 50 * 60) : t + r.int(60, 600);
    x.trips.push({ status: final, matched: t, ended: end, driver: "drv_" + (driver += r.int(1, 97)) });
  }

  // Ids in time order.
  requests.sort((a, b) => a.at - b.at || (a.c.id < b.c.id ? -1 : a.c.id > b.c.id ? 1 : 0));
  let rq = r.int(70000, 90000), rider = r.int(200, 900);
  for (const x of requests) { x.id = "req_" + (rq += r.int(1, 29)); x.rider = "rdr_" + (rider += r.int(1, 53)); }
  windows.sort((a, b) => a.start - b.start || (a.zone < b.zone ? -1 : 1));
  let wn = r.int(300, 700);
  for (const w of windows) w.id = "sw_" + wn++;
  const trips = requests.flatMap((x) => x.trips.map((t) => ({ ...t, x }))).sort((a, b) => a.matched - b.matched);
  let tn = r.int(400000, 500000);
  for (const t of trips) t.id = "trp_" + (tn += r.int(1, 17));

  // The oracle. opts break one rule each, for diagnostics.
  const compute = (opts = {}) => {
    const acc = new Map();
    const cell = (key) => { if (!acc.has(key)) acc.set(key, { req: 0, sreq: 0, comp: 0, scomp: 0 }); return acc.get(key); };
    const inWindow = (w, t) => (opts.exclusiveStart ? w.start < t : w.start <= t) && (opts.inclusiveEnd ? t <= w.end : t < w.end);
    const surgedAt = (x) => {                                         // the multipliers a join would produce
      const m = x.c.windows[x.zone].filter((w) => inWindow(w, x.at)).map((w) => w.mult);
      return m.length ? m : opts.innerJoin ? [] : [100];
    };
    const isSurged = (m) => (opts.geOne ? m >= 100 : m > 100);
    for (const x of requests) {
      const off = opts.utc ? 0 : x.c.off;
      const dateOk = opts.utc || opts.utcDate ? isoDate(x.at) === dayStr : hourLabel(x.at, x.c.off).slice(0, 10) === dayStr;
      if (!dateOk) continue;
      const key = x.c.id + "|" + hourLabel(x.at, off);
      const done = x.trips.find((t) => t.status === "completed");
      const fan = opts.fanout ? Math.max(1, x.trips.length) : 1;
      for (const m of surgedAt(x)) {
        const k = cell(key), s = isSurged(m);
        k.req += fan;
        k.sreq += s ? fan : 0;
        if (done && !opts.endHour) { k.comp += 1; k.scomp += s ? 1 : 0; }
      }
    }
    if (opts.endHour) {                                               // completed trips by their own end hour
      for (const x of requests) {
        const done = x.trips.find((t) => t.status === "completed");
        if (!done || hourLabel(done.ended, x.c.off).slice(0, 10) !== dayStr) continue;
        const k = acc.get(x.c.id + "|" + hourLabel(done.ended, x.c.off));
        if (!k) continue;
        k.comp += 1;
        k.scomp += surgedAt(x)[0] > 100 ? 1 : 0;
      }
    }
    const floor = opts.noFloor ? 1 : minReq;
    return [...acc.entries()].filter(([, v]) => v.req >= floor).sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)).map(([key, v]) => {
      const [city, label] = key.split("|");
      const share = opts.overRequests ? round4(v.scomp, v.req) : v.comp ? round4(v.scomp, v.comp) : opts.zeroShare ? 0 : null;
      return [city, label, v.req, v.sreq, round4(v.sreq, v.req), v.comp, v.scomp, share];
    });
  };
  const expected = compute();

  const diagnostics = [
    { message: "Hours (and the report date) were taken in UTC. Each city reports in its own local time: convert requested_at with the city's time_zone before truncating to the hour and before filtering on the report date.", rows: compute({ utc: true }) },
    { message: "The report date was filtered in UTC while hours were local. A city's local day is a different 24-hour span of UTC instants; filter on the local date of requested_at, not its UTC date.", rows: compute({ utcDate: true }) },
    { message: "A window's end was treated as inclusive (BETWEEN). Windows are half-open, starts_at <= requested_at < ends_at: a request exactly at ends_at is no longer priced by that window, and with adjacent windows an inclusive end matches two windows and counts the request twice.", rows: compute({ inclusiveEnd: true }) },
    { message: "A window's start was treated as exclusive. A request exactly at starts_at is priced by that window.", rows: compute({ exclusiveStart: true }) },
    { message: "Requests outside every surge window disappeared. An inner join to surge_windows drops them; they are priced at 1.00x and belong in the denominator. Use a LEFT JOIN and COALESCE the multiplier to 1.00.", rows: compute({ innerJoin: true }) },
    { message: "Requests at exactly 1.00x were counted as surged. Surge exposure means priced above 1.00x (multiplier > 1.00); a window that sets 1.00x and a request with no window are both unsurged.", rows: compute({ geOne: true }) },
    { message: "Completed trips were placed in the hour they ended. The weighted share describes the requests of each hour: a completed trip counts in the hour of its request.", rows: compute({ endHour: true }) },
    { message: "completed_surge_share was divided by all requests. The completed-trip-weighted share is surged completed trips over completed trips.", rows: compute({ overRequests: true }) },
    { message: "An hour with no completed trip got a share of 0. With nothing completed the weighted share is undefined: return NULL (NULLIF on the denominator), not 0.", rows: compute({ zeroShare: true }) },
  ];
  if (level >= 2) {
    diagnostics.push(
      { message: "Requests were counted once per trip row. A re-matched request has several trips (driver-cancelled ones before the final match); joining requests to trips before counting multiplies them. Count requests, and reduce trips to one completed flag per request first.", rows: compute({ fanout: true }) },
      { message: "The minimum-requests floor was ignored. Hours with fewer than min_requests requests are left out.", rows: compute({ noFloor: true }) },
    );
  }

  const cCols = ["city_id", "time_zone"];
  const wCols = ["window_id", "zone_id", "starts_at", "ends_at", "multiplier"];
  const qCols = ["request_id", "city_id", "zone_id", "rider_id", "requested_at"];
  const tCols = ["trip_id", "request_id", "driver_id", "status", "matched_at", "ended_at"];
  const cRows = cities.map((c) => [c.id, c.tz]);
  const wRows = windows.map((w) => [w.id, w.zone, stamp(w.start), stamp(w.end), (w.mult / 100).toFixed(2)]);
  const qRows = requests.map((x) => [x.id, x.c.id, x.zone, x.rider, stamp(x.at)]);
  const tRows = trips.map((t) => [t.id, t.x.id, t.driver, t.status, stamp(t.matched), stamp(t.ended)]);

  const setup =
    "SET TIME ZONE 'UTC';\n" +
    "CREATE TABLE cities (\n  city_id TEXT PRIMARY KEY,\n  time_zone TEXT NOT NULL\n);\n" +
    "CREATE TABLE surge_windows (\n  window_id TEXT PRIMARY KEY,\n  zone_id TEXT NOT NULL,\n  starts_at TIMESTAMPTZ NOT NULL,\n  ends_at TIMESTAMPTZ NOT NULL,\n  multiplier NUMERIC(4,2) NOT NULL,\n  CHECK (ends_at > starts_at)\n);\n" +
    "CREATE TABLE ride_requests (\n  request_id TEXT PRIMARY KEY,\n  city_id TEXT NOT NULL REFERENCES cities (city_id),\n  zone_id TEXT NOT NULL,\n  rider_id TEXT NOT NULL,\n  requested_at TIMESTAMPTZ NOT NULL\n);\n" +
    "CREATE TABLE trips (\n  trip_id TEXT PRIMARY KEY,\n  request_id TEXT NOT NULL REFERENCES ride_requests (request_id),\n  driver_id TEXT NOT NULL,\n  status TEXT NOT NULL CHECK (status IN ('completed','rider_cancelled','driver_cancelled')),\n  matched_at TIMESTAMPTZ NOT NULL,\n  ended_at TIMESTAMPTZ NOT NULL\n);\n" +
    insertSQL("cities", cCols, cRows) + insertSQL("surge_windows", wCols, wRows) +
    insertSQL("ride_requests", qCols, qRows) + insertSQL("trips", tCols, tRows);

  return {
    vars: {
      report_date: dayStr,
      min_requests: minReq,
      city_list: cities.map((c) => "`" + c.id + "` (" + c.tz + ")").join(", "),
      trip_rule: level === 1
        ? "A request has at most one trip: it was matched once (and the trip completed or was cancelled by the rider or the driver), or never matched."
        : "A request can be matched more than once: when a driver cancels, the request is re-matched and gets a new trip row. At most one trip per request is completed.",
      requests_n: qRows.length,
      windows_n: wRows.length,
      trips_n: tRows.length,
    },
    setup,
    tables: [
      { name: "cities", columns: cCols, rows: cRows },
      { name: "surge_windows", columns: wCols, rows: wRows },
      { name: "ride_requests", columns: qCols, rows: qRows },
      { name: "trips", columns: tCols, rows: tRows },
    ],
    expected: {
      columns: ["city_id", "local_hour", "requests", "surged_requests", "request_surge_share", "completed_trips", "surged_completed_trips", "completed_surge_share"],
      rows: expected,
    },
    diagnostics: diagnostics.filter((d) => JSON.stringify(d.rows) !== JSON.stringify(expected)),
  };
}
