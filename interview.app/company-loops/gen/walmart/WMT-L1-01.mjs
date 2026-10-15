/* WMT-L1-01 — Pickup wait: check-in to handover per store and hour of day (SQL).
   Simulated practice scenario. All data is generated from the seed; the wait rule is
   this exercise's rule, not any retailer's.

   Contract: see docs/COMPANY-INTERVIEW-LOOPS.md § Executable templates (sql).
   level: 1 Medium (one check-in and one handover per order; early check-ins wait from the slot start)
          2 Hard (+ repeated check-ins (the first counts), orders never handed over, handovers with no
                  check-in, a handover before the slot started (wait 0), a check-in exactly at the slot start)
          3 Very Hard (+ stores in several time zones: the hour of day is the store's local hour, and slots
                  late in the local evening fall on the next UTC day) */
import { insertSQL, ts } from "../../js/rng.js";

export const kind = "sql";

const DAYS = ["2026-09-14", "2026-09-15", "2026-09-16"];
// Offsets on these dates (daylight saving time in force where observed; Phoenix stays on standard time).
const ZONES = { "America/New_York": -4, "America/Chicago": -5, "America/Denver": -6, "America/Phoenix": -7, "America/Los_Angeles": -7 };

export function generate(r, level) {
  const nStores = level === 1 ? 2 : 3;
  const storeIds = [];
  while (storeIds.length < nStores) {
    const s = "store_" + r.int(1000, 5999);
    if (!storeIds.includes(s)) storeIds.push(s);
  }
  storeIds.sort();
  const zoneNames = Object.keys(ZONES);
  const stores = storeIds.map((id, i) => ({ id, tz: level === 3 ? zoneNames[(i + r.int(0, 4)) % 5] : "UTC" }));
  if (level === 3 && new Set(stores.map((s) => s.tz)).size < 2) stores[0].tz = stores[1].tz === "America/New_York" ? "America/Los_Angeles" : "America/New_York";
  const off = (s) => (s.tz === "UTC" ? 0 : ZONES[s.tz]);
  const target = r.pick([5, 6, 8, 10]);

  const orders = [];    // {id, store, slot (minute since DAYS[0] 00:00 UTC)}
  const events = [];    // {order, type, at (minute)}
  let oid = r.int(100000, 400000);
  const slotFor = (s) => {
    // L1/L2: a UTC hour 13..22 on day 0 or 1. L3: a local hour 8..20, converted to UTC.
    const day = r.int(0, 1);
    if (level < 3) return day * 1440 + r.int(13, 22) * 60;
    return day * 1440 + (r.int(8, 20) - off(s)) * 60;
  };
  const addOrder = (s, slot) => {
    const o = { id: "PU" + (oid += r.int(1, 90)), store: s, slot };
    orders.push(o);
    return o;
  };
  const n = 10 + 4 * level;
  for (let i = 0; i < n; i++) {
    const s = r.pick(stores);
    const o = addOrder(s, slotFor(s));
    const early = r.chance(0.35);
    const checkin = o.slot + (early ? -r.int(1, 30) : r.int(0, 50));
    const start = Math.max(checkin, o.slot);
    const wait = r.int(0, 22);
    events.push({ order: o, type: "checkin", at: checkin });
    events.push({ order: o, type: "handover", at: start + wait });
  }
  // Every level: an early check-in in the previous clock hour, a wait exactly at the target,
  // and a check-in at minute 59 of an hour.
  {
    const s = stores[0];
    const o = addOrder(s, slotFor(s));
    events.push({ order: o, type: "checkin", at: o.slot - r.int(5, 25) });
    events.push({ order: o, type: "handover", at: o.slot + target });
    const s2 = r.pick(stores);
    const o2 = addOrder(s2, slotFor(s2));
    events.push({ order: o2, type: "checkin", at: o2.slot + 59 });
    events.push({ order: o2, type: "handover", at: o2.slot + 59 + target + r.int(1, 6) });
  }
  if (level >= 2) {
    // Repeated check-in: the second tap lands while the customer is already waiting.
    for (let k = 0; k < 2; k++) {
      const s = r.pick(stores);
      const o = addOrder(s, slotFor(s));
      const checkin = o.slot + (k === 0 ? -r.int(3, 20) : r.int(0, 30));
      const start = Math.max(checkin, o.slot);
      const wait = r.int(6, 20);
      events.push({ order: o, type: "checkin", at: checkin });
      events.push({ order: o, type: "checkin", at: start + r.int(1, wait - 1) });
      events.push({ order: o, type: "handover", at: start + wait });
    }
    // Never handed over (customer left; order cancelled at the desk).
    { const s = r.pick(stores); const o = addOrder(s, slotFor(s)); events.push({ order: o, type: "checkin", at: o.slot + r.int(0, 30) }); }
    // Handed over with no check-in (customer walked to the desk).
    { const s = r.pick(stores); const o = addOrder(s, slotFor(s)); events.push({ order: o, type: "handover", at: o.slot + r.int(2, 30) }); }
    // Handed over before the slot started: the wait is 0.
    { const s = r.pick(stores); const o = addOrder(s, slotFor(s)); const c = o.slot - r.int(15, 28); events.push({ order: o, type: "checkin", at: c }); events.push({ order: o, type: "handover", at: c + r.int(3, 10) }); }
    // A check-in exactly at the slot start.
    { const s = r.pick(stores); const o = addOrder(s, slotFor(s)); events.push({ order: o, type: "checkin", at: o.slot }); events.push({ order: o, type: "handover", at: o.slot + r.int(1, 15) }); }
  }
  if (level === 3) {
    // A slot late in the local evening that is on the next UTC day.
    const s = stores.reduce((a, b) => (off(a) <= off(b) ? a : b));
    const o = addOrder(s, (20 - off(s)) * 60);
    events.push({ order: o, type: "checkin", at: o.slot + r.int(5, 40) });
    events.push({ order: o, type: "handover", at: o.slot + r.int(45, 58) });
  }

  const cmp = (x, y) => (x < y ? -1 : x > y ? 1 : 0);
  const solve = (o = {}) => {
    const groups = new Map();
    for (const ord of orders) {
      const ev = events.filter((e) => e.order === ord);
      const cis = ev.filter((e) => e.type === "checkin").map((e) => e.at).sort((a, b) => a - b);
      const hos = ev.filter((e) => e.type === "handover").map((e) => e.at);
      if (!cis.length || !hos.length) continue;
      const ci = o.lastCheckin ? cis[cis.length - 1] : cis[0];
      const start = o.fromCheckin ? ci : Math.max(ci, ord.slot);
      let wait = hos[0] - start;
      if (!o.noClamp) wait = Math.max(0, wait);
      const hourBase = o.hourOfCheckin ? ci : start;
      const shift = o.utcHour ? 0 : off(ord.store) * 60;
      const hour = Math.floor((((hourBase + shift) % 1440) + 1440) % 1440 / 60);
      const k = ord.store.id + "|" + String(hour).padStart(2, "0");
      if (!groups.has(k)) groups.set(k, { store: ord.store.id, hour, ws: [] });
      groups.get(k).ws.push(wait);
    }
    return [...groups.entries()].sort((a, b) => cmp(a[0], b[0])).map(([, g]) => {
      const nW = g.ws.length, sum = g.ws.reduce((a, b) => a + b, 0);
      const avg = sum >= 0 ? Math.floor((20 * sum + nW) / (2 * nW)) / 10 : -Math.floor((-20 * sum + nW) / (2 * nW)) / 10;
      const over = g.ws.filter((w) => (o.atLeast ? w >= target : w > target)).length;
      return [g.store, g.hour, nW, avg, Math.max(...g.ws), over];
    });
  };
  const rows = solve();
  const diagnostics = [
    { message: "The wait was measured from the check-in even when the customer checked in before the slot. An early check-in waits from the slot start.", rows: solve({ fromCheckin: true }) },
    { message: "Rows were grouped by the hour of the check-in. The hour of day is the hour the wait started: the slot start for an early check-in.", rows: solve({ hourOfCheckin: true }) },
    { message: `over_target counted waits of exactly ${target} minutes. Only waits longer than the target count.`, rows: solve({ atLeast: true }) },
  ];
  if (level >= 2) {
    diagnostics.push({ message: "The last check-in was used. A customer who taps \"I'm here\" twice started waiting at the first tap.", rows: solve({ lastCheckin: true }) });
    diagnostics.push({ message: "A handover before the slot started produced a negative wait. The wait is never below 0.", rows: solve({ noClamp: true }) });
  }
  if (level === 3) diagnostics.push({ message: "The hour of day was taken in UTC. Group by the store's local hour (stores.tz).", rows: solve({ utcHour: true }) });

  const at = (m) => ts(DAYS[Math.floor(m / 1440)], (m % 1440) * 60);
  const sCols = ["store_id", "tz"];
  const sRows = stores.map((s) => [s.id, s.tz]);
  const oCols = ["order_id", "store_id", "slot_start"];
  const oRows = orders.slice().sort((a, b) => cmp(a.id, b.id)).map((o) => [o.id, o.store.id, at(o.slot)]);
  const eCols = ["event_id", "order_id", "event_type", "event_ts"];
  let eid = r.int(5000, 90000);
  const eRows = events.slice().sort((a, b) => a.at - b.at || cmp(a.order.id, b.order.id) || cmp(a.type, b.type)).map((e) => [eid += r.int(1, 7), e.order.id, e.type, at(e.at)]);
  const setup =
    "SET TIME ZONE 'UTC';\n" +
    "CREATE TABLE stores (\n  store_id TEXT PRIMARY KEY,\n  tz TEXT NOT NULL\n);\n" +
    "CREATE TABLE pickup_orders (\n  order_id TEXT PRIMARY KEY,\n  store_id TEXT NOT NULL REFERENCES stores(store_id),\n  slot_start TIMESTAMPTZ NOT NULL\n);\n" +
    "CREATE TABLE pickup_events (\n  event_id BIGINT PRIMARY KEY,\n  order_id TEXT NOT NULL REFERENCES pickup_orders(order_id),\n  event_type TEXT NOT NULL CHECK (event_type IN ('checkin', 'handover')),\n  event_ts TIMESTAMPTZ NOT NULL\n);\n" +
    insertSQL("stores", sCols, sRows) + insertSQL("pickup_orders", oCols, oRows) + insertSQL("pickup_events", eCols, eRows);

  return {
    vars: {
      target,
      orders: orders.length,
      event_rule: level === 1
        ? "In this sample every order has exactly one `checkin` and one `handover` event."
        : "An order can have several `checkin` events (the customer tapped twice): the wait starts from the first. Orders without a `checkin` or without a `handover` are left out; each order has at most one `handover`.",
      tz_rule: level === 3
        ? "Stores are in different time zones (`stores.tz`, an IANA name): `hour_of_day` is the hour in the store's local time."
        : "Every store's `tz` is `UTC` in this sample, so the hour of day is the UTC hour; keep the query correct for other zones.",
    },
    setup,
    tables: [
      { name: "stores", columns: sCols, rows: sRows },
      { name: "pickup_orders", columns: oCols, rows: oRows },
      { name: "pickup_events", columns: eCols, rows: eRows },
    ],
    expected: { columns: ["store_id", "hour_of_day", "handovers", "avg_wait_min", "max_wait_min", "over_target"], rows },
    diagnostics: diagnostics.filter((d) => JSON.stringify(d.rows) !== JSON.stringify(rows)),
  };
}
