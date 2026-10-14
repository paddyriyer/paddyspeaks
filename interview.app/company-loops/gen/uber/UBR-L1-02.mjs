/* UBR-L1-02 — Driver utilisation by hour from status changes (SQL).
   Simulated practice scenario. All data is generated from the seed and is hypothetical.

   Contract: see docs/COMPANY-INTERVIEW-LOOPS.md § Executable templates (sql).
   Each driver_status row starts a status that lasts until the driver's next row in
   (changed_at, event_id) order, or until the report window ends; at Very Hard it lasts
   at most cap seconds (the app re-sends the current status while it is running). Online
   statuses (OPEN, EN_ROUTE, ON_TRIP) are clipped to [from_ts, to_ts) and split at UTC
   hour boundaries; per (city, hour) the report sums seconds per status.
   level: 1 Medium (every driver logs on and off inside the window; statuses cross hours,
                    one change exactly on an hour)
          2 Hard (+ drivers already online when the window opens, drivers still online
                  when it closes, rows after it, two rows in the same second)
          3 Very Hard (+ a staleness cap: repeated same-status rows while the app runs,
                       silences longer than the cap that must not count, late ingestion) */
import { insertSQL, ts } from "../../js/rng.js";

export const kind = "sql";

const CITIES = ["austin", "bogota", "cairo", "dublin", "jakarta", "manila", "nairobi", "warsaw"];
const DAYS = ["2026-10-08", "2026-10-09", "2026-10-10"];
const H = 3600;
const ONLINE = new Set(["OPEN", "EN_ROUTE", "ON_TRIP"]);
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const BIG = 7 * 86400;

export function generate(r, level) {
  const day = r.pick(DAYS);
  const h0 = r.pick([5, 6, 7, 8]);
  const span = r.pick([4, 5, 6]);
  const W0 = h0 * H, W1 = (h0 + span) * H;
  const cap = level === 3 ? r.pick([10, 12, 15]) * 60 : BIG;
  const cities = r.sample(CITIES, 2).sort();
  const nDrivers = level === 1 ? 7 : level === 2 ? 9 : 8;

  let dSeq = 3000 + r.int(0, 5000);
  const drivers = [];
  const rows = [];   // {driver, status, sec, id}
  const add = (driver, status, sec) => rows.push({ driver, status, sec });

  for (let i = 0; i < nDrivers; i++) {
    const id = "drv_" + (dSeq += r.int(3, 90));
    drivers.push({ id, city: i < 2 ? cities[i] : r.pick(cities) });
    // Shape of this driver's shift.
    const carryIn = level >= 2 && (i === 0 || r.chance(0.3));
    const stillOn = level >= 2 && (i === 1 || r.chance(0.3));
    let t = carryIn ? W0 - r.int(10 * 60, 2 * H) : W0 + r.int(0, Math.floor(span * H / 3));
    const end = stillOn ? W1 + r.int(5 * 60, H) : Math.min(W1 - 60, t + r.int(H, span * H));
    let st = "OPEN";
    const seq = { OPEN: "EN_ROUTE", EN_ROUTE: "ON_TRIP", ON_TRIP: "OPEN" };
    const dur = { OPEN: [2 * 60, 25 * 60], EN_ROUTE: [2 * 60, 12 * 60], ON_TRIP: [5 * 60, 45 * 60] };
    const lastRowBy = stillOn && i === 1 ? W1 - 60 : end;   // driver 1: last row inside, open-ended
    while (t < lastRowBy) {
      add(id, st, t);
      let d = r.int(dur[st][0], dur[st][1]);
      // Very Hard: the app re-sends the status while it runs; sometimes it goes silent.
      if (level === 3) {
        let k = t;
        const silent = r.chance(0.15);
        if (silent) d = Math.max(d, cap + r.int(60, 20 * 60));
        for (;;) {
          const step = cap - r.int(30, 120);
          if (silent || k + step >= t + d) break;
          k += step;
          add(id, st, k);
        }
      }
      t += d;
      st = seq[st];
    }
    if (!stillOn) add(id, "OFFLINE", end);
    else if (i !== 1 && r.chance(0.5)) add(id, "OFFLINE", end + r.int(60, H));   // after the window
  }
  // Every level: a change exactly on an hour boundary, inside the window.
  {
    const id = "drv_" + (dSeq += r.int(3, 90));
    drivers.push({ id, city: r.pick(cities) });
    const hb = (h0 + 1 + r.int(0, span - 2)) * H;
    add(id, "OPEN", hb - r.int(5 * 60, 20 * 60));
    add(id, "ON_TRIP", hb);
    add(id, "OPEN", hb + r.int(5 * 60, Math.min(cap - 60, 40 * 60)));
    add(id, "OFFLINE", hb + Math.min(cap - 30, 50 * 60));
  }
  // Hard+: two rows in the same second; the higher event_id holds afterwards.
  let tiePair = null;
  if (level >= 2) {
    const id = "drv_" + (dSeq += r.int(3, 90));
    drivers.push({ id, city: r.pick(cities) });
    const t = W0 + r.int(H, (span - 1) * H - 1200);
    add(id, "OPEN", t - r.int(120, 400));
    tiePair = [rows.length, rows.length + 1];
    add(id, "ON_TRIP", t);
    add(id, "OPEN", t);
    add(id, "OFFLINE", t + r.int(300, Math.min(cap - 60, 1100)));
  }

  // event_id: ingestion order. Time order, except late uploads at Very Hard.
  const keyed = rows.map((x, i) => ({ x, i, key: x.sec + (level === 3 && r.chance(0.25) ? r.int(300, 3 * H) : 0) }));
  keyed.sort((a, b) => a.key - b.key || a.i - b.i);
  let eid = 9_100_000 + r.int(0, 800_000);
  for (const k of keyed) k.x.id = (eid += r.int(1, 7));
  if (tiePair) {   // keep the stated order of the same-second pair
    const [a, b] = tiePair.map((j) => rows[j]);
    if (a.id > b.id) [a.id, b.id] = [b.id, a.id];
  }

  const cityOf = new Map(drivers.map((d) => [d.id, d.city]));
  const solve = (o = {}) => {
    const per = new Map();   // city|hour -> {open, enr, trip, drivers:Set}
    const byDriver = new Map();
    for (const x of rows) (byDriver.get(x.driver) || byDriver.set(x.driver, []).get(x.driver)).push(x);
    for (const [drv, xs] of byDriver) {
      xs.sort((a, b) => a.sec - b.sec || a.id - b.id);
      xs.forEach((x, i) => {
        if (!ONLINE.has(x.status)) return;
        if (o.noCarry && x.sec < W0) return;
        let e = i + 1 < xs.length ? xs[i + 1].sec : (o.noOpenEnd ? x.sec : Infinity);
        if (!o.noCap) e = Math.min(e, x.sec + cap);
        const a = Math.max(x.sec, W0), b = Math.min(e, W1);
        if (b <= a) return;
        for (let h = Math.floor(a / H) * H; h < b; h += H) {
          let s = Math.min(b, h + H) - Math.max(a, h);
          let hour = h;
          if (o.noSplit) { if (h !== Math.floor(a / H) * H) break; s = b - a; }
          if (s <= 0) continue;
          const k = cityOf.get(drv) + "|" + hour;
          if (!per.has(k)) per.set(k, { city: cityOf.get(drv), hour, OPEN: 0, EN_ROUTE: 0, ON_TRIP: 0, ds: new Set() });
          const g = per.get(k);
          g[x.status] += s;
          g.ds.add(drv);
        }
      });
    }
    const mins = (s) => Math.floor((10 * s + 3) / 6) / 100;
    const util = (n, d) => Math.floor((2 * n * 10000 + d) / (2 * d)) / 10000;
    return [...per.values()]
      .sort((x, y) => cmp(x.city, y.city) || x.hour - y.hour)
      .map((g) => [g.city, ts(day, g.hour), g.ds.size, mins(g.OPEN), mins(g.EN_ROUTE), mins(g.ON_TRIP), util(g.ON_TRIP, g.OPEN + g.EN_ROUTE + g.ON_TRIP)]);
  };
  const result = solve();

  const diagnostics = [
    { message: "Each status was credited to the hour it started in. A status that crosses an hour boundary must be split between the hours.", rows: solve({ noSplit: true }) },
  ];
  if (level >= 2) {
    diagnostics.push({ message: "Statuses that began before the window were dropped. A driver online at from_ts is online from from_ts: carry the status in effect at the window's start into it.", rows: solve({ noCarry: true }) });
    diagnostics.push({ message: "A driver's last status was given no duration. With no later row, it lasts until the window ends.", rows: solve({ noOpenEnd: true }) });
  }
  if (level === 3) diagnostics.push({ message: `Statuses were not capped. A status counts for at most ${cap / 60} minutes after its row; a longer silence means the app stopped reporting.`, rows: solve({ noCap: true }) });

  const dCols = ["driver_id", "city"];
  const dRows = drivers.slice().sort((a, b) => cmp(a.id, b.id)).map((d) => [d.id, d.city]);
  const sCols = ["event_id", "driver_id", "status", "changed_at"];
  const sRows = rows.slice().sort((a, b) => a.id - b.id).map((x) => [x.id, x.driver, x.status, ts(day, x.sec)]);
  const setup =
    "SET TIME ZONE 'UTC';\n" +
    "CREATE TABLE drivers (\n  driver_id TEXT PRIMARY KEY,\n  city TEXT NOT NULL\n);\n" +
    "CREATE TABLE driver_status (\n  event_id BIGINT PRIMARY KEY,\n  driver_id TEXT NOT NULL REFERENCES drivers(driver_id),\n" +
    "  status TEXT NOT NULL CHECK (status IN ('OFFLINE', 'OPEN', 'EN_ROUTE', 'ON_TRIP')),\n  changed_at TIMESTAMPTZ NOT NULL\n);\n" +
    insertSQL("drivers", dCols, dRows) + insertSQL("driver_status", sCols, sRows);

  return {
    vars: {
      from_ts: ts(day, W0),
      to_ts: ts(day, W1),
      hours: span,
      cap_s: cap,
      n_drivers: drivers.length,
      n_rows: rows.length,
      window_rule: level === 1
        ? "In this sample every driver logs on and off inside the window."
        : "Some drivers were already online when the window opens (their status then is the one from their last row before it), some are still online when it closes, and rows after the window exist and change nothing inside it.",
      cap_rule: level === 3
        ? `A status lasts at most ${cap / 60} minutes (${cap} seconds) after its row: while the app runs it re-sends the current status, so a row repeating the same status is normal, and a longer silence means the app stopped reporting; time after the cap is not counted. \`event_id\` is ingestion order, and late uploads make it differ from time order.`
        : "",
    },
    setup,
    tables: [
      { name: "drivers", columns: dCols, rows: dRows },
      { name: "driver_status", columns: sCols, rows: sRows },
    ],
    expected: { columns: ["city", "hour_start", "drivers", "open_min", "en_route_min", "on_trip_min", "utilisation"], rows: result },
    diagnostics: diagnostics.filter((d) => JSON.stringify(d.rows) !== JSON.stringify(result)),
  };
}
