/* TGA-L1-02 — Dedicated endpoint replica-minutes per endpoint and UTC day (SQL).
   Simulated practice scenario. All data is generated from the seed; endpoints,
   prices, replica counts and traffic are hypothetical, and the billing rule is this
   exercise's rule.

   Contract: generate(r, level) -> { vars, setup, tables, expected, diagnostics }.
   The oracle below walks every minute of the report in JavaScript and takes the
   largest replica count in force at any moment of that minute; the evaluator's
   reference SQL is written independently (segments between scale events, expanded
   to the minutes they touch) and must return the same rows.
   level: 1 Medium (one day; endpoints start stopped; scale events at any second,
            some exactly on a minute; requests in some running minutes)
          · 2 Hard (+ a second day, endpoints already running before the report from
            an event the day before, runs across midnight, stops and restarts,
            requests while stopped)
          · 3 Very Hard (+ two scale events inside one minute: a short spike, and a stop
            and restart within the same minute; a repeated event that changes nothing;
            an event exactly at midnight) */
import { insertSQL, pad2 } from "../../js/rng.js";

export const kind = "sql";

const DAYS = ["2026-09-15", "2026-09-17", "2026-09-22", "2026-09-24", "2026-10-06"];
const TENANTS = ["t-0412", "t-0907", "t-1133", "t-1580", "t-2264", "t-2718"];

function stampSec(ms) {                      // epoch ms -> "YYYY-MM-DD HH:MM:SS+00"
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())} ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}:${pad2(d.getUTCSeconds())}+00`;
}
const dayStr = (ms) => stampSec(ms).slice(0, 10);

export function generate(r, level) {
  const first = r.pick(level === 1 ? DAYS : DAYS.slice(0, 4));
  const nDays = level === 1 ? 1 : 2;
  const T0 = Date.parse(first + "T00:00:00Z") / 1000;   // seconds
  const MIN0 = T0 / 60;
  const nMin = nDays * 1440;
  const T1 = T0 + nMin * 60;
  const nEp = level === 1 ? 3 : 4;
  const eps = [];
  let epn = 2000 + r.int(0, 7000);
  for (let i = 0; i < nEp; i++) {
    epn += r.int(3, 40);
    eps.push({ id: "ep-" + epn, tenant: r.pick(TENANTS), price4: r.int(9, 30) * 50, events: [] });
  }
  eps.sort((a, b) => (a.id < b.id ? -1 : 1));

  // Scale events: [second, replicas]. Distinct seconds per endpoint; each changes the count
  // (except the deliberate repeat at Very Hard).
  const used = (ep, s) => ep.events.some((e) => e[0] === s);
  const add = (ep, s, k) => { if (!used(ep, s)) ep.events.push([s, k]); };
  eps.forEach((ep, idx) => {
    let k = 0;
    if (level >= 2 && idx % 2 === 0) {                  // already running before the report
      k = r.int(1, 3);
      add(ep, T0 - r.int(1, 20) * 3600 - r.int(0, 3599), k);
    }
    const n = r.int(4, level === 1 ? 6 : 9);
    const times = [];
    for (let j = 0; j < n; j++) {
      let s = T0 + r.int(30, nMin - 30) * 60 + (r.chance(0.25) ? 0 : r.int(1, 59));
      times.push(s);
    }
    times.sort((a, b) => a - b);
    for (const s of times) {
      let nk;
      if (k === 0) nk = r.int(1, 4);                      // start
      else if (r.chance(level === 1 ? 0.25 : 0.35)) nk = 0;   // stop
      else { nk = r.int(1, 5); if (nk === k) nk = k === 5 ? 4 : k + 1; }
      add(ep, s, nk);
      k = nk;
    }
  });
  // Every level: a start exactly on a minute and a stop exactly on a minute (that minute is not billed).
  {
    const ep = eps[nEp - 1];
    const m = r.int(60, 600);
    ep.events = ep.events.filter((e) => e[0] < T0 + (m - 5) * 60 || e[0] > T0 + (m + 60) * 60);
    // make sure the endpoint is stopped just before: put a stop 3 minutes earlier
    add(ep, T0 + (m - 3) * 60 + r.int(1, 59), 0);
    add(ep, T0 + m * 60, r.int(2, 3));                  // start at hh:mm:00
    add(ep, T0 + (m + 7) * 60 + r.int(1, 59), 4);       // scale up mid-minute
    add(ep, T0 + (m + 15) * 60 + r.int(1, 59), 1);      // scale down mid-minute
    add(ep, T0 + (m + 30) * 60, 0);                     // stop at hh:mm:00
  }
  if (level === 3) {
    const ep = eps[1];
    const m = r.int(700, 1300);
    ep.events = ep.events.filter((e) => e[0] < T0 + (m - 5) * 60 || e[0] > T0 + (m + 40) * 60);
    add(ep, T0 + (m - 2) * 60 + r.int(1, 59), 2);
    add(ep, T0 + m * 60 + r.int(5, 20), 6);              // spike up …
    add(ep, T0 + m * 60 + r.int(30, 55), 2);             // … and back inside the same minute
    add(ep, T0 + (m + 10) * 60 + r.int(5, 20), 0);       // stop …
    add(ep, T0 + (m + 10) * 60 + r.int(30, 55), 3);      // … and restart inside the same minute
    add(ep, T0 + (m + 20) * 60 + r.int(1, 59), 3);       // a repeat that changes nothing
    const ep2 = eps[2];
    ep2.events = ep2.events.filter((e) => Math.abs(e[0] - (T0 + 1440 * 60)) > 600);
    add(ep2, T0 + 1440 * 60, r.int(1, 3));               // exactly at midnight
  }
  for (const ep of eps) ep.events.sort((a, b) => a[0] - b[0]);

  // Requests: bursts in some minutes, mostly while running; at Hard also while stopped.
  const countAt = (ep, s) => { let k = 0; for (const [t, v] of ep.events) { if (t <= s) k = v; else break; } return k; };
  const requests = [];
  for (const ep of eps) {
    const bursts = r.int(25, 45) * nDays;
    for (let b = 0; b < bursts; b++) {
      const m = r.int(0, nMin - 1);
      const s0 = T0 + m * 60;
      if (countAt(ep, s0) === 0 && !(level >= 2 && r.chance(0.3))) continue;
      const c = r.int(1, 4);
      for (let j = 0; j < c; j++) requests.push([ep.id, s0 + (j === 0 && r.chance(0.2) ? 0 : r.int(0, 59))]);
    }
  }

  // ---- Oracle -------------------------------------------------------------------
  const compute = (o = {}) => {
    const out = [];
    for (let d = 0; d < nDays; d++) {
      for (const ep of eps) {
        const evs = o.ignoreBefore ? ep.events.filter((e) => e[0] >= T0) : ep.events;
        const reqMin = new Set(requests.filter((q) => q[0] === ep.id).map((q) => Math.floor(q[1] / 60)));
        let billed = 0, idle = 0;
        for (let i = d * 1440; i < (d + 1) * 1440; i++) {
          const s = T0 + i * 60;
          let atStart = 0, mx = 0, atEnd = 0, secs = 0;
          for (const [t, v] of evs) if (t <= s) atStart = v;
          mx = atStart; atEnd = atStart;
          let cur = atStart, curT = s;
          for (const [t, v] of evs) {
            if (t > s && t < s + 60) { secs += cur * (t - curT); cur = v; curT = t; mx = Math.max(mx, v); atEnd = v; }
          }
          secs += cur * (s + 60 - curT);
          let k = mx;
          if (o.startOnly) k = atStart;
          if (o.endOnly) k = atEnd;
          if (o.prorate) k = secs / 60;
          billed += k;
          if (!reqMin.has(MIN0 + i)) idle += o.idleMinutes ? (k > 0 ? 1 : 0) : k;
        }
        if (billed > 0) {
          let cost;
          if (Number.isInteger(billed)) cost = Math.floor((billed * ep.price4 + 50) / 100) / 100;
          else cost = Math.round(billed * ep.price4 / 100) / 100;
          out.push([dayStr((T0 + d * 86400) * 1000), ep.id, billed, idle, cost]);
        }
      }
    }
    return out;
  };
  const rows = compute();

  const diagnostics = [
    { message: "Each minute was billed at the replica count in force when the minute started. A scale-up inside a minute bills that minute at the higher count: each started minute is billed in full for every replica running in it.", rows: compute({ startOnly: true }) },
    { message: "Each minute was billed at the count in force when it ended. A scale-down inside a minute still bills the minute at the higher count that ran in it.", rows: compute({ endOnly: true }) },
    { message: "Replica-seconds were prorated. This exercise's rule bills every started minute in full, so replica-minutes are whole numbers.", rows: compute({ prorate: true }) },
    { message: "idle_replica_minutes counted minutes, not replica-minutes. A minute with no requests on three running replicas is three idle replica-minutes.", rows: compute({ idleMinutes: true }) },
  ];
  if (level >= 2) {
    diagnostics.push({ message: "Scale events before the report were ignored, so an endpoint already running at midnight looked stopped until its first event of the day. Take the count in force from the last event before the report.", rows: compute({ ignoreBefore: true }) });
  }

  // ---- Tables ---------------------------------------------------------------------
  const epCols = ["endpoint_id", "tenant_id", "price_per_replica_minute"];
  const epRows = eps.map((e) => [e.id, e.tenant, (e.price4 / 10000).toFixed(4)]);
  const evCols = ["endpoint_id", "event_ts", "replicas"];
  const evRows = [];
  for (const ep of eps) for (const [s, k] of ep.events) evRows.push([ep.id, s, k]);
  evRows.sort((a, b) => a[1] - b[1] || (a[0] < b[0] ? -1 : 1));
  const evOut = evRows.map(([id, s, k]) => [id, stampSec(s * 1000), k]);
  const rqCols = ["endpoint_id", "request_ts"];
  const rqRows = requests.slice().sort((a, b) => a[1] - b[1] || (a[0] < b[0] ? -1 : 1)).map(([id, s]) => [id, stampSec(s * 1000)]);

  const setup =
    "SET TIME ZONE 'UTC';\n" +
    "CREATE TABLE endpoints (\n  endpoint_id TEXT PRIMARY KEY,\n  tenant_id TEXT NOT NULL,\n  price_per_replica_minute NUMERIC(8,4) NOT NULL\n);\n" +
    "CREATE TABLE replica_events (\n  endpoint_id TEXT NOT NULL REFERENCES endpoints(endpoint_id),\n  event_ts TIMESTAMPTZ NOT NULL,\n  replicas INT NOT NULL CHECK (replicas >= 0)\n);\n" +
    "CREATE TABLE endpoint_requests (\n  endpoint_id TEXT NOT NULL REFERENCES endpoints(endpoint_id),\n  request_ts TIMESTAMPTZ NOT NULL\n);\n" +
    insertSQL("endpoints", epCols, epRows) + insertSQL("replica_events", evCols, evOut) + insertSQL("endpoint_requests", rqCols, rqRows);

  const last = dayStr((T0 + (nDays - 1) * 86400) * 1000);
  return {
    vars: {
      first_day: first,
      last_day: last,
      report_days: nDays === 1 ? "one UTC day, " + first : "two UTC days, " + first + " and " + last,
      scale_events: evOut.length,
      requests: rqRows.length,
      before_rule: level === 1
        ? "In this sample every endpoint is stopped when the report starts; its first scale event is inside the report."
        : "Some endpoints were already running when the report starts: the count in force at midnight comes from their last scale event before it. Requests can arrive while an endpoint is stopped; they are rejected and bill nothing.",
      minute_rule: level === 3
        ? "Two scale events can fall inside the same minute, for example a short spike up and back, or a stop and a restart. An event can repeat the count already in force."
        : "No minute in this sample contains two scale events of the same endpoint.",
    },
    setup,
    tables: [
      { name: "endpoints", columns: epCols, rows: epRows },
      { name: "replica_events", columns: evCols, rows: evOut },
      { name: "endpoint_requests", columns: rqCols, rows: rqRows },
    ],
    expected: { columns: ["day", "endpoint_id", "billed_replica_minutes", "idle_replica_minutes", "cost_usd"], rows },
    diagnostics: diagnostics.filter((d) => JSON.stringify(d.rows) !== JSON.stringify(rows)),
  };
}
