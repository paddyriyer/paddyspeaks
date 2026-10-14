/* UBR-L1-01 — Lost trips after a match: who cancelled, and how long the rider had waited (SQL).
   Simulated practice scenario. All data is generated from the seed and is hypothetical.

   Contract: see docs/COMPANY-INTERVIEW-LOOPS.md § Executable templates (sql).
   A request is a lost trip when it was matched at least once, never reached PICKED_UP,
   and has a CANCELLED event. It counts once, under the party of its last CANCELLED event
   in (event_ts, event_id) order, bucketed by the seconds from its FIRST match to that
   cancellation. rematched_requests counts lost trips matched to two or more distinct drivers.
   level: 1 Medium (rider and driver cancellations, re-matches, rescued and completed trips,
                    cancellations before any match, waits exactly on bucket boundaries)
          2 Hard (+ system cancellations after a driver cancelled and nobody was re-matched,
                  riders cancelling while the request was being re-matched, a driver and a
                  rider cancellation in the same second)
          3 Very Hard (+ events ingested late, so event_id order is not time order, and
                       duplicated MATCHED and CANCELLED rows from client retries) */
import { insertSQL, ts } from "../../js/rng.js";

export const kind = "sql";

const CITIES = ["amsterdam", "chicago", "lagos", "melbourne", "mexico_city", "mumbai", "sao_paulo", "toronto"];
const DAYS = ["2026-10-05", "2026-10-06", "2026-10-07"];
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

export function generate(r, level) {
  const day = r.pick(DAYS);
  const b1 = r.pick([1, 2, 3]);
  const b2 = r.pick([4, 5, 6, 8]);
  const cities = r.sample(CITIES, 2).sort();
  const labels = [`0-${b1}m`, `${b1}-${b2}m`, `${b2}m+`];
  const bucketOf = (w) => (w < b1 * 60 ? 0 : w < b2 * 60 ? 1 : 2);

  let reqSeq = 880000 + r.int(0, 90000);
  let drvSeq = 100 + r.int(0, 800);
  const requests = [];      // {id, city, sec}
  const events = [];        // {id(later), req, type, party, driver, sec, order}
  const newDriver = () => "drv_" + (drvSeq += r.int(1, 37));
  const add = (req, type, sec, party = null, driver = null) => events.push({ req, type, sec, party, driver });

  // Plans: what happens to each request.
  const plans = ["lost_rider", "lost_driver", "lost_remrider", "exact_b1", "exact_b2", "rescued", "completed", "prematch", "completed"];
  if (level >= 2) plans.push("lost_system", "rider_during_rematch", "same_second", "lost_remsystem");
  if (level === 3) plans.push("dup_match", "dup_cancel", "late_ingest", "late_ingest");
  const nReq = 14 + 4 * level;
  const pool = ["lost_rider", "lost_driver", "lost_remrider", "completed", "rescued", "prematch", "lost_rider"];
  if (level >= 2) pool.push("lost_system", "rider_during_rematch");
  while (plans.length < nReq) plans.push(r.pick(pool));

  const order = r.shuffle(plans);
  order.forEach((plan, i) => {
    const req = "req_" + (reqSeq += r.int(1, 400));
    const city = i < 2 ? cities[i] : r.pick(cities);
    const start = r.int(6 * 3600, 21 * 3600);
    requests.push({ id: req, city, sec: start });
    const m1 = start + r.int(5, 90);           // first match
    const d1 = newDriver();
    const pickWait = () => r.pick([r.int(10, b1 * 60 - 1), r.int(b1 * 60 + 1, b2 * 60 - 1), r.int(b2 * 60 + 1, b2 * 60 + 600)]);
    if (plan === "prematch") { add(req, "CANCELLED", start + r.int(3, 120), "rider"); return; }
    add(req, "MATCHED", m1, null, d1);
    if (plan === "completed" || plan === "rescued") {
      let mm = m1;
      if (plan === "rescued") {
        const c = m1 + r.int(30, 200);
        add(req, "CANCELLED", c, "driver");
        mm = c + r.int(10, 90);
        add(req, "MATCHED", mm, null, newDriver());
      }
      const pu = mm + r.int(120, 600);
      add(req, "PICKED_UP", pu);
      add(req, "DROPPED_OFF", pu + r.int(300, 2400));
      return;
    }
    // Lost trips: choose the wait from the first match to the final cancellation.
    let w = pickWait();
    if (plan === "exact_b1") w = b1 * 60;
    if (plan === "exact_b2") w = b2 * 60;
    const end = m1 + w;
    if (plan === "lost_rider" || plan === "exact_b1" || plan === "exact_b2" || plan === "dup_cancel" || plan === "late_ingest") {
      add(req, "CANCELLED", end, r.chance(0.7) ? "rider" : "driver");
      if (plan === "dup_cancel") { const last = events[events.length - 1]; add(req, "CANCELLED", end, last.party); }
    } else if (plan === "lost_driver") {
      add(req, "CANCELLED", end, "driver");
    } else if (plan === "dup_match") {
      // A client retry writes the first match twice: one driver, two MATCHED rows.
      add(req, "MATCHED", m1, null, d1);
      add(req, "CANCELLED", end, r.chance(0.7) ? "rider" : "driver");
    } else if (plan === "lost_remrider") {
      // Driver cancels, a second driver is matched, then the rider gives up. Long enough to fit.
      const W = Math.max(w, b1 * 60 + r.int(20, 120));
      const c = m1 + r.int(5, Math.floor(W / 3));
      add(req, "CANCELLED", c, "driver");
      const m2 = c + r.int(3, Math.floor(W / 3));
      const d2 = newDriver();
      add(req, "MATCHED", m2, null, d2);
      add(req, "CANCELLED", m1 + W, r.chance(0.6) ? "rider" : "driver");
    } else if (plan === "lost_system") {
      const c = m1 + r.int(5, 150);
      add(req, "CANCELLED", c, "driver");
      add(req, "CANCELLED", c + r.int(60, 300), "system");
    } else if (plan === "lost_remsystem") {
      const c = m1 + r.int(5, 100);
      add(req, "CANCELLED", c, "driver");
      const m2 = c + r.int(5, 60);
      add(req, "MATCHED", m2, null, newDriver());
      const c2 = m2 + r.int(20, 200);
      add(req, "CANCELLED", c2, "driver");
      add(req, "CANCELLED", c2 + r.int(60, 240), "system");
    } else if (plan === "rider_during_rematch") {
      const c = m1 + r.int(5, 150);
      add(req, "CANCELLED", c, "driver");
      add(req, "CANCELLED", c + r.int(10, 400), "rider");
    } else if (plan === "same_second") {
      // Driver and rider cancel in the same second; the higher event_id is last.
      add(req, "CANCELLED", end, "driver");
      add(req, "CANCELLED", end, "rider");
    }
  });

  // Event ids: ingestion order. Normally time order; at Very Hard, offline batches arrive late.
  const evOrder = events.map((e, i) => ({ e, i, key: e.sec + (level === 3 && r.chance(0.3) ? r.int(600, 5400) : 0) }));
  // Same-second pairs keep their generation order (driver first, then rider).
  evOrder.sort((a, b) => a.key - b.key || a.i - b.i);
  let eid = 5_000_000 + r.int(0, 900_000);
  for (const x of evOrder) x.e.id = (eid += r.int(1, 9));
  // Very Hard: guarantee one lost trip whose last cancellation was ingested before an earlier one.
  if (level === 3) {
    const byReq = new Map();
    for (const e of events) if (e.type === "CANCELLED") (byReq.get(e.req) || byReq.set(e.req, []).get(e.req)).push(e);
    for (const [, cs] of byReq) {
      if (cs.length < 2) continue;
      const parties = new Set(cs.map((c) => c.party));
      if (parties.size < 2) continue;
      cs.sort((a, b) => a.sec - b.sec || a.id - b.id);
      const first = cs[0], last = cs[cs.length - 1];
      if (first.sec < last.sec && last.id > first.id) { [first.id, last.id] = [last.id, first.id]; break; }
    }
  }

  const reqById = new Map(requests.map((q) => [q.id, q]));
  const solve = (o = {}) => {
    const byReq = new Map();
    for (const e of events) (byReq.get(e.req) || byReq.set(e.req, []).get(e.req)).push(e);
    const groups = new Map();
    const bump = (city, party, w, rem) => {
      const b = o.boundaryLow ? (w <= b1 * 60 ? 0 : w <= b2 * 60 ? 1 : 2) : bucketOf(w);
      const k = city + "|" + party + "|" + b;
      if (!groups.has(k)) groups.set(k, { city, party, b, n: 0, rem: 0, max: -1 });
      const g = groups.get(k);
      g.n++;
      if (rem) g.rem++;
      g.max = Math.max(g.max, w);
    };
    for (const [req, evs] of byReq) {
      const q = reqById.get(req);
      const ord = evs.slice().sort(o.byId ? (a, b) => a.id - b.id : (a, b) => a.sec - b.sec || a.id - b.id);
      const matches = ord.filter((e) => e.type === "MATCHED");
      const cancels = ord.filter((e) => e.type === "CANCELLED");
      const picked = ord.some((e) => e.type === "PICKED_UP");
      if (!cancels.length) continue;
      if (!matches.length) {
        if (o.prematch) bump(q.city, cancels[cancels.length - 1].party, cancels[cancels.length - 1].sec - q.sec, false);
        continue;
      }
      const firstM = Math.min(...matches.map((m) => m.sec));
      const lastM = Math.max(...matches.map((m) => m.sec));
      const rem = o.rowsRematch ? matches.length >= 2 : new Set(matches.map((m) => m.driver)).size >= 2;
      if (o.everyCancel) {
        for (const c of cancels) if (c.sec >= firstM) bump(q.city, c.party, c.sec - firstM, rem);
        continue;
      }
      if (picked) continue;
      const last = cancels[cancels.length - 1];
      const from = o.fromLastMatch ? lastM : o.fromRequest ? q.sec : firstM;
      bump(q.city, last.party, last.sec - from, rem);
    }
    return [...groups.values()]
      .sort((x, y) => cmp(x.city, y.city) || cmp(x.party, y.party) || x.b - y.b)
      .map((g) => [g.city, g.party, labels[g.b], g.n, g.rem, g.max]);
  };
  const rows = solve();

  const diagnostics = [
    { message: "The wait was measured from the latest match. A re-match does not reset the rider's clock: measure from the first MATCHED event.", rows: solve({ fromLastMatch: true }) },
    { message: "The wait was measured from the request. This report measures from the first match: how long the rider had been told a car was coming.", rows: solve({ fromRequest: true }) },
    { message: "Every cancellation was counted, including driver cancellations that were rescued by a re-match. Count each lost trip once, under its last cancellation.", rows: solve({ everyCancel: true }) },
    { message: "Cancellations before any match were included. Only requests that were matched at least once are lost trips after a match.", rows: solve({ prematch: true }) },
    { message: `A wait of exactly ${b1} or ${b2} minutes went into the lower bucket. Buckets include their lower bound: exactly ${b1 * 60} seconds is in ${labels[1]}.`, rows: solve({ boundaryLow: true }) },
  ];
  if (level === 3) {
    diagnostics.push({ message: "Re-matches were counted from MATCHED rows. A retried MATCHED row for the same driver is not a re-match: count distinct drivers.", rows: solve({ rowsRematch: true }) });
    diagnostics.push({ message: "Events were ordered by event_id. Offline batches arrive late, so ingestion order is not time order: order by (event_ts, event_id).", rows: solve({ byId: true }) });
  }

  const rqCols = ["request_id", "city", "requested_at"];
  const rqRows = requests.slice().sort((a, b) => cmp(a.id, b.id)).map((q) => [q.id, q.city, ts(day, q.sec)]);
  const evCols = ["event_id", "request_id", "event_type", "party", "driver_id", "event_ts"];
  const evRows = events.slice().sort((a, b) => a.id - b.id).map((e) => [e.id, e.req, e.type, e.party, e.driver, ts(day, e.sec)]);
  const setup =
    "SET TIME ZONE 'UTC';\n" +
    "CREATE TABLE trip_requests (\n  request_id TEXT PRIMARY KEY,\n  city TEXT NOT NULL,\n  requested_at TIMESTAMPTZ NOT NULL\n);\n" +
    "CREATE TABLE dispatch_events (\n  event_id BIGINT PRIMARY KEY,\n  request_id TEXT NOT NULL REFERENCES trip_requests(request_id),\n" +
    "  event_type TEXT NOT NULL CHECK (event_type IN ('MATCHED', 'CANCELLED', 'PICKED_UP', 'DROPPED_OFF')),\n" +
    "  party TEXT CHECK (party IN ('rider', 'driver', 'system')),   -- CANCELLED only\n" +
    "  driver_id TEXT,                                               -- MATCHED only\n" +
    "  event_ts TIMESTAMPTZ NOT NULL\n);\n" +
    insertSQL("trip_requests", rqCols, rqRows) + insertSQL("dispatch_events", evCols, evRows);

  return {
    vars: {
      b1, b2,
      b1_s: b1 * 60, b2_s: b2 * 60,
      bucket_a: labels[0], bucket_b: labels[1], bucket_c: labels[2],
      n_requests: requests.length,
      n_events: events.length,
      party_rule: level === 1
        ? "In this sample `party` is `rider` or `driver`."
        : "`party` is `rider`, `driver` or `system` (dispatch gave up after a driver cancelled and nobody else accepted).",
      ingest_rule: level === 3
        ? "Phones that were offline upload their events late, so `event_id` (ingestion order) is not time order, and client retries can write the same MATCHED or CANCELLED event twice with a new `event_id`."
        : "`event_id` increases with ingestion, which in this sample follows time.",
    },
    setup,
    tables: [
      { name: "trip_requests", columns: rqCols, rows: rqRows },
      { name: "dispatch_events", columns: evCols, rows: evRows },
    ],
    expected: { columns: ["city", "cancelled_by", "wait_bucket", "lost_requests", "rematched_requests", "max_wait_s"], rows },
    diagnostics: diagnostics.filter((d) => JSON.stringify(d.rows) !== JSON.stringify(rows)),
  };
}
