/* UBR-L1-03 — Courier waits at restaurants, per merchant and daypart (SQL).
   Simulated practice scenario. All data is generated from the seed and is hypothetical.

   Contract: see docs/COMPANY-INTERVIEW-LOOPS.md § Executable templates (sql).
   An order is measured when it has a PICKED_UP event. Its pickup is the first PICKED_UP in
   (event_ts, event_id) order; the courier who picked up is that row's courier; the wait runs
   from that courier's first ARRIVED event for the order at or before the pickup. The
   daypart comes from the arrival's local time in the merchant's time zone. A long wait is
   strictly more than N minutes. Groups need at least min_orders measured orders.
   level: 1 Medium (one courier per order, cancelled orders, two time zones, waits of exactly
                    N minutes, arrivals exactly at a daypart's start, pickups in the next daypart)
          2 Hard (+ reassigned orders: an earlier courier arrived and was unassigned; couriers
                  that re-enter the restaurant's geofence before pickup)
          3 Very Hard (+ ARRIVED events after the pickup, duplicated PICKED_UP rows from
                       retries, and pickups whose courier never logged an arrival) */
import { insertSQL } from "../../js/rng.js";

export const kind = "sql";

// Fixed UTC offsets valid for the sample dates (no DST change between 2026-10-12 and 2026-10-16).
const ZONES = [
  ["America/Chicago", -300], ["Europe/London", 60], ["Asia/Kolkata", 330],
  ["America/Sao_Paulo", -180], ["Australia/Sydney", 660], ["Africa/Nairobi", 180],
];
const MERCHANTS = ["mer_bagel_works", "mer_basil_corner", "mer_dosa_point", "mer_green_bowl", "mer_noodle_bar", "mer_taco_stand", "mer_wok_street"];
const DAYS = ["2026-10-13", "2026-10-14", "2026-10-15"];
const DAYPARTS = [["breakfast", 6, 11], ["lunch", 11, 15], ["afternoon", 15, 17], ["dinner", 17, 22], ["late_night", 22, 30]];
const H = 3600;
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const fmt = (ms) => new Date(ms).toISOString().replace("T", " ").replace(/\.\d+Z$/, "+00");

const partOfLocal = (sec) => {          // seconds since local midnight (may be negative or ≥ 86400)
  const h = (((Math.floor(sec / H)) % 24) + 24) % 24;
  return DAYPARTS.findIndex(([, a, b]) => (h >= a && h < b) || (h + 24 >= a && h + 24 < b));
};

export function generate(r, level) {
  const day = r.pick(DAYS);
  const dayMs = Date.parse(day + "T00:00:00Z");
  const n = r.pick([5, 7, 8, 10]);
  const minOrders = level === 1 ? 2 : r.pick([2, 3]);
  const zones = r.sample(ZONES, 2);
  const merchants = r.sample(MERCHANTS, level === 3 ? 4 : 3).sort().map((id, i) => ({ id, zone: zones[i % 2] }));

  let oSeq = 610000 + r.int(0, 80000);
  let cSeq = 200 + r.int(0, 700);
  const orders = [];   // {id, m}
  const events = [];   // {order, courier, type, ms}
  const courier = () => "cou_" + (cSeq += r.int(1, 41));
  // Local seconds -> UTC milliseconds for merchant m.
  const utc = (m, local) => dayMs + (local - m.zone[1] * 60) * 1000;
  const randLocal = (part) => {
    const [, a, b] = DAYPARTS[part];
    return r.int(a * H, b * H - 1);
  };
  const pickPart = () => r.pick([0, 1, 1, 1, 2, 3, 3, 3, 4]);
  const normalWait = () => r.pick([r.int(30, n * 60 - 1), r.int(30, n * 60 - 1), r.int(n * 60 + 1, n * 60 + 900)]);

  const addOrder = (m, plan, local, wait) => {
    const o = "ord_" + (oSeq += r.int(1, 300));
    orders.push({ id: o, m });
    const ev = (c, type, loc) => events.push({ order: o, courier: c, type, ms: utc(m, loc) });
    const c1 = courier();
    if (plan === "cancelled") { ev(c1, "ARRIVED", local); return; }
    if (plan === "reassigned" || plan === "no_arrival") {
      // c1 arrives first, is unassigned; c2 arrives (or not) and picks up.
      const a1 = local - r.int(120, 900);
      ev(c1, "ARRIVED", a1);
      ev(c1, "UNASSIGNED", a1 + r.int(60, Math.max(61, local - a1 - 10)));
      const c2 = courier();
      if (plan === "reassigned") ev(c2, "ARRIVED", local);
      ev(c2, "PICKED_UP", local + wait);
      return;
    }
    ev(c1, "ARRIVED", local);
    if (plan === "reentry") ev(c1, "ARRIVED", local + r.int(20, Math.max(21, wait - 10)));
    ev(c1, "PICKED_UP", local + wait);
    if (plan === "dup_pickup") ev(c1, "PICKED_UP", local + wait + r.int(2, 40));
    if (plan === "after_pickup") ev(c1, "ARRIVED", local + wait + r.int(60, 600));
  };

  const m0 = merchants[0];
  // Edge cases, every level, on the first merchant's lunch so that group always qualifies.
  addOrder(m0, "plain", 11 * H, n * 60);                          // exactly N minutes, exactly 11:00 local
  addOrder(m0, "plain", randLocal(1), n * 60 + 1);                // one second over
  addOrder(m0, "plain", 11 * H - r.int(60, 400), n * 60 + r.int(200, 600));  // arrives in breakfast, picked up in lunch
  addOrder(merchants[1], "plain", 17 * H, r.int(30, 600));        // exactly 17:00 local
  addOrder(merchants[1], "plain", 22 * H + r.int(0, 3 * H), normalWait());   // late night
  addOrder(merchants[2], "cancelled", randLocal(3), 0);
  if (level >= 2) {
    addOrder(m0, "reassigned", randLocal(1), r.int(60, n * 60 - 30));   // short for c2, long since c1 arrived
    addOrder(merchants[1], "reentry", randLocal(3), n * 60 + r.int(60, 600));
  }
  if (level === 3) {
    addOrder(m0, "dup_pickup", randLocal(1), n * 60 - r.int(1, 20));
    addOrder(merchants[2], "after_pickup", randLocal(3), r.int(60, 400));
    addOrder(merchants[3], "no_arrival", randLocal(3), r.int(60, 400));
    addOrder(merchants[3], "dup_pickup", randLocal(3), r.int(60, n * 60));
  }
  const nOrders = level === 1 ? 24 : level === 2 ? 30 : 36;
  const plans = ["plain", "plain", "plain", "cancelled"];
  if (level >= 2) plans.push("reassigned", "reentry");
  if (level === 3) plans.push("dup_pickup", "after_pickup", "no_arrival");
  while (orders.length < nOrders) {
    const m = r.pick(merchants);
    addOrder(m, r.pick(plans), randLocal(pickPart()), normalWait());
  }

  // event_id in time order (ties: generation order).
  const ord = events.map((e, i) => ({ e, i })).sort((a, b) => a.e.ms - b.e.ms || a.i - b.i);
  let eid = 70_000_000 + r.int(0, 900_000);
  for (const x of ord) x.e.id = (eid += r.int(1, 6));

  const mOf = new Map(orders.map((o) => [o.id, o.m]));
  const solve = (o = {}) => {
    const byOrder = new Map();
    for (const e of events) (byOrder.get(e.order) || byOrder.set(e.order, []).get(e.order)).push(e);
    const groups = new Map();
    for (const [oid, evs] of byOrder) {
      const m = mOf.get(oid);
      const xs = evs.slice().sort((a, b) => a.ms - b.ms || a.id - b.id);
      const pickups = xs.filter((e) => e.type === "PICKED_UP");
      if (!pickups.length) continue;
      const pu = o.lastPickup ? pickups[pickups.length - 1] : pickups[0];
      let arrivals = xs.filter((e) => e.type === "ARRIVED" && (o.anyCourier || e.courier === pu.courier) && (o.anyTime || e.ms <= pu.ms));
      if (!arrivals.length) continue;
      const arr = o.lastArrival ? arrivals[arrivals.length - 1] : arrivals[0];
      const wait = (pu.ms - arr.ms) / 1000;
      const at = o.byPickup ? pu.ms : arr.ms;
      const localSec = o.utcHour ? (at - dayMs) / 1000 : (at - dayMs) / 1000 + m.zone[1] * 60;
      const part = partOfLocal(localSec);
      const k = m.id + "|" + part;
      if (!groups.has(k)) groups.set(k, { m: m.id, part, n: 0, long: 0, max: -1 });
      const g = groups.get(k);
      g.n++;
      if (o.inclusive ? wait >= n * 60 : wait > n * 60) g.long++;
      g.max = Math.max(g.max, wait);
    }
    const pct = (a, b) => Math.floor((2 * a * 1000 + b) / (2 * b)) / 10;
    return [...groups.values()]
      .filter((g) => o.noFloor || g.n >= minOrders)
      .sort((x, y) => cmp(x.m, y.m) || x.part - y.part)
      .map((g) => [g.m, DAYPARTS[g.part][0], g.n, g.long, pct(g.long, g.n), g.max]);
  };
  const rows = solve();

  const diagnostics = [
    { message: `A wait of exactly ${n} minutes was counted as long. Long means strictly more than ${n} minutes.`, rows: solve({ inclusive: true }) },
    { message: "Dayparts were taken from the UTC hour. Use the arrival's local time in the merchant's time zone.", rows: solve({ utcHour: true }) },
    { message: "The daypart came from the pickup time. It comes from the courier's arrival: that is when the wait began.", rows: solve({ byPickup: true }) },
  ];
  if (level >= 2) {
    diagnostics.push({ message: "The wait started at the first arrival by any courier. On a reassigned order only the courier who picked up waited; start at that courier's arrival.", rows: solve({ anyCourier: true }) });
    diagnostics.push({ message: "The wait started at the courier's latest arrival. A courier who re-enters the geofence has been waiting since the first arrival.", rows: solve({ lastArrival: true }) });
    diagnostics.push({ message: `Groups with fewer than ${minOrders} measured orders were kept.`, rows: solve({ noFloor: true }) });
  }
  if (level === 3) {
    diagnostics.push({ message: "The last PICKED_UP row was used. A retried PICKED_UP row is a duplicate; the pickup happened at the first one.", rows: solve({ lastPickup: true }) });
    diagnostics.push({ message: "Arrivals after the pickup were used. Only arrivals at or before the pickup start a wait.", rows: solve({ anyTime: true, lastArrival: true }) });
  }

  const mCols = ["merchant_id", "time_zone"];
  const mRows = merchants.map((m) => [m.id, m.zone[0]]);
  const oCols = ["order_id", "merchant_id"];
  const oRows = orders.slice().sort((a, b) => cmp(a.id, b.id)).map((o) => [o.id, o.m.id]);
  const eCols = ["event_id", "order_id", "courier_id", "event_type", "event_ts"];
  const eRows = events.slice().sort((a, b) => a.id - b.id).map((e) => [e.id, e.order, e.courier, e.type, fmt(e.ms)]);
  const setup =
    "SET TIME ZONE 'UTC';\n" +
    "CREATE TABLE merchants (\n  merchant_id TEXT PRIMARY KEY,\n  time_zone TEXT NOT NULL      -- IANA zone name\n);\n" +
    "CREATE TABLE delivery_orders (\n  order_id TEXT PRIMARY KEY,\n  merchant_id TEXT NOT NULL REFERENCES merchants(merchant_id)\n);\n" +
    "CREATE TABLE courier_events (\n  event_id BIGINT PRIMARY KEY,\n  order_id TEXT NOT NULL REFERENCES delivery_orders(order_id),\n  courier_id TEXT NOT NULL,\n" +
    "  event_type TEXT NOT NULL CHECK (event_type IN ('ARRIVED', 'UNASSIGNED', 'PICKED_UP')),\n  event_ts TIMESTAMPTZ NOT NULL\n);\n" +
    insertSQL("merchants", mCols, mRows) + insertSQL("delivery_orders", oCols, oRows) + insertSQL("courier_events", eCols, eRows);

  return {
    vars: {
      n_min: n,
      n_s: n * 60,
      min_orders: minOrders,
      n_orders: orders.length,
      n_events: events.length,
      courier_rule: level === 1
        ? "In this sample each order has one courier, who arrives once."
        : "An order can be reassigned: a courier may arrive, be `UNASSIGNED`, and another courier arrive and pick up. Only the courier who picked up waited, from their own first arrival. A courier can also log `ARRIVED` twice before the pickup (leaving and re-entering the restaurant's geofence).",
      data_rule: level === 3
        ? "Couriers' phones also log `ARRIVED` after the pickup (re-entering the geofence on the way out), retries can write the `PICKED_UP` row twice, and a pickup whose courier logged no `ARRIVED` at or before it has no measurable wait and is left out."
        : "",
    },
    setup,
    tables: [
      { name: "merchants", columns: mCols, rows: mRows },
      { name: "delivery_orders", columns: oCols, rows: oRows },
      { name: "courier_events", columns: eCols, rows: eRows },
    ],
    expected: { columns: ["merchant_id", "daypart", "orders", "long_waits", "long_wait_pct", "max_wait_s"], rows },
    diagnostics: diagnostics.filter((d) => JSON.stringify(d.rows) !== JSON.stringify(rows)),
  };
}
