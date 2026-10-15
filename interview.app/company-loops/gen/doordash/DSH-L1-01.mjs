/* DSH-L1-01 — Order accuracy per merchant and week (SQL).
   Simulated practice scenario. All data is generated from the seed; the report window
   is this exercise's rule, not any marketplace's published policy.

   Contract: see docs/COMPANY-INTERVIEW-LOOPS.md § Executable templates (sql).
   level: 1 Medium (several reports on one order count once, cancelled orders excluded,
                    non-accuracy issue types ignored, own-channel orders shown apart)
          2 Hard (+ reports filed after the window are not counted, a report exactly at the
                  window counts, orders a second either side of the UTC week boundary)
          3 Very Hard (+ the week is the store's local week, so an order on Monday morning UTC
                  can belong to the previous week in the Americas, or Monday in Sydney is still
                  Sunday in UTC) */
import { insertSQL } from "../../js/rng.js";

export const kind = "sql";

const WEEK0 = Date.UTC(2026, 8, 7);           // Monday 2026-09-07
const DAY = 86400000;
const ZONES = ["America/New_York", "America/Chicago", "America/Los_Angeles", "Australia/Sydney", "America/Toronto"];
const BRANDS = ["bao_house", "corner_deli", "green_bowl", "noodle_bar", "pita_co", "taco_stand", "pizza_loft", "sushi_go"];
const COUNTED = ["missing_item", "incorrect_item"];
const OTHER = ["late_delivery", "damaged_packaging", "food_temperature"];

const p2 = (n) => String(n).padStart(2, "0");
const fmt = (ms) => {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())} ${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}:${p2(d.getUTCSeconds())}+00`;
};
const fmtCache = {};
function localDate(ms, tz) {
  const f = (fmtCache[tz] ||= new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }));
  return f.format(new Date(ms));
}
function mondayOf(dateStr) {
  const ms = Date.parse(dateStr + "T00:00:00Z");
  const dow = (new Date(ms).getUTCDay() + 6) % 7;      // Monday = 0
  return new Date(ms - dow * DAY).toISOString().slice(0, 10);
}

export function generate(r, level) {
  const nMerchants = level === 1 ? 3 : 4;
  const merchants = r.sample(BRANDS, nMerchants).sort();
  const stores = [];
  let sid = r.int(1000, 4000);
  for (const m of merchants) {
    const k = level === 1 ? 1 : r.int(1, 2);
    for (let i = 0; i < k; i++) stores.push({ id: "st_" + (sid += r.int(3, 60)), merchant: m, tz: level === 3 ? r.pick(ZONES) : "UTC" });
  }
  if (level === 3 && new Set(stores.map((s) => s.tz)).size < 2) { stores[0].tz = "America/Los_Angeles"; stores[stores.length - 1].tz = "Australia/Sydney"; }
  const windowH = r.pick([24, 48, 72]);

  const orders = [];     // {id, store, channel, status, placed, delivered}
  const reports = [];    // {id, order, type, at}
  let oid = r.int(200000, 700000);
  let rid = r.int(10, 900);
  const addOrder = (store, placed, o = {}) => {
    const status = o.status || (r.chance(0.12) ? "cancelled" : "delivered");
    const ord = {
      id: "ord_" + (oid += r.int(1, 97)),
      store,
      channel: o.channel || (r.chance(0.25) ? "own_channel" : "marketplace"),
      status,
      placed,
      delivered: status === "delivered" ? placed + r.int(22, 75) * 60000 + r.int(0, 59) * 1000 : null,
    };
    orders.push(ord);
    return ord;
  };
  const addReport = (ord, type, at) => reports.push({ id: (rid += r.int(1, 9)), order: ord, type, at });
  // A report time: L1 always well inside the window; L2+ sometimes after it.
  const reportAt = (ord) => {
    const base = ord.delivered ?? ord.placed + 3600000;
    const maxMin = level === 1 ? Math.min(windowH, 24) * 60 - 1 : (windowH + 30) * 60;
    return base + r.int(5, maxMin) * 60000 + r.int(0, 59) * 1000;
  };
  // Placed instants: two weeks, daytime in UTC at L1/L2; any hour at L3 (so local days shift).
  const randPlaced = () => {
    const w = r.int(0, 1), d = r.int(0, 6);
    const sec = level === 3 ? r.int(0, 86399) : r.int(11 * 3600, 22 * 3600);
    return WEEK0 + (w * 7 + d) * DAY + sec * 1000;
  };

  const n = 16 + 6 * level;
  for (let i = 0; i < n; i++) {
    const ord = addOrder(r.pick(stores), randPlaced());
    const roll = r.next();
    if (roll < 0.2) addReport(ord, r.pick(COUNTED), reportAt(ord));
    else if (roll < 0.3) { addReport(ord, r.pick(COUNTED), reportAt(ord)); addReport(ord, r.pick(COUNTED), reportAt(ord)); }
    else if (roll < 0.4) addReport(ord, r.pick(OTHER), reportAt(ord));
  }
  // Every level: a delivered order with three reports (counts once), a cancelled order with a
  // counted report, a delivered order with only a non-accuracy report, and an own-channel order
  // with a counted report.
  {
    const [s1, s2, s3] = [r.pick(stores), r.pick(stores), r.pick(stores)];
    const a = addOrder(s1, randPlaced(), { status: "delivered", channel: "marketplace" });
    addReport(a, "missing_item", a.delivered + r.int(10, 300) * 60000);
    addReport(a, "incorrect_item", a.delivered + r.int(301, 600) * 60000);
    addReport(a, "missing_item", a.delivered + r.int(601, 900) * 60000);
    const b = addOrder(s2, randPlaced(), { status: "cancelled", channel: "marketplace" });
    addReport(b, "missing_item", b.placed + r.int(40, 120) * 60000);
    const c = addOrder(s3, randPlaced(), { status: "delivered", channel: "marketplace" });
    addReport(c, r.pick(OTHER), c.delivered + r.int(5, 200) * 60000);
    const d = addOrder(s1, randPlaced(), { status: "delivered", channel: "own_channel" });
    addReport(d, "incorrect_item", d.delivered + r.int(5, 200) * 60000);
  }
  // Hard+: a report exactly at the window (counts), one a second after it (does not), and
  // orders a second either side of the UTC week boundary.
  if (level >= 2) {
    const s = r.pick(stores);
    const a = addOrder(s, randPlaced(), { status: "delivered" });
    addReport(a, "missing_item", a.delivered + windowH * 3600000);
    const b = addOrder(r.pick(stores), randPlaced(), { status: "delivered" });
    addReport(b, "incorrect_item", b.delivered + windowH * 3600000 + 1000);
    const s4 = r.pick(stores);
    addOrder(s4, WEEK0 + 7 * DAY - 1000, { status: "delivered", channel: "marketplace" });
    addOrder(s4, WEEK0 + 7 * DAY, { status: "delivered", channel: "marketplace" });
  }
  // Very Hard: orders whose local week differs from their UTC week, in both directions.
  if (level === 3) {
    const west = stores.find((s) => s.tz.startsWith("America")) || stores[0];
    const east = stores.find((s) => s.tz === "Australia/Sydney");
    const a = addOrder(west, WEEK0 + 7 * DAY + r.int(60, 180) * 60000, { status: "delivered" });  // Monday early UTC = Sunday evening local
    addReport(a, "missing_item", a.delivered + r.int(10, 120) * 60000);
    if (east) addOrder(east, WEEK0 + 7 * DAY - r.int(60, 400) * 60000, { status: "delivered" });  // Sunday UTC = Monday local
  }

  const cmp = (x, y) => (x < y ? -1 : x > y ? 1 : 0);
  const solve = (o = {}) => {
    const bad = new Map();   // order id -> number of counted reports
    for (const rep of reports) {
      if (!o.allTypes && !COUNTED.includes(rep.type)) continue;
      const ord = rep.order;
      if (!o.noWindow) {
        if (ord.delivered === null) continue;
        if (rep.at > ord.delivered + windowH * 3600000) continue;
      }
      bad.set(ord.id, (bad.get(ord.id) || 0) + 1);
    }
    const g = new Map();
    for (const ord of orders) {
      if (!o.keepCancelled && ord.status !== "delivered") continue;
      const tz = o.utc ? "UTC" : ord.store.tz;
      const wk = mondayOf(localDate(ord.placed, tz));
      const k = ord.store.merchant + "|" + wk + "|" + ord.channel;
      if (!g.has(k)) g.set(k, { n: 0, bad: 0 });
      const s = g.get(k);
      s.n++;
      const b = bad.get(ord.id) || 0;
      if (b) s.bad += o.perReport ? b : 1;
    }
    const share = (num, d) => Math.floor((num * 20000 + d) / (2 * d)) / 10000;
    return [...g.entries()].sort((x, y) => cmp(x[0], y[0])).map(([k, s]) => {
      const [m, wk, ch] = k.split("|");
      const good = s.n - s.bad;
      const rate = good >= 0 ? share(good, s.n) : -share(-good, s.n);
      return [m, wk, ch, s.n, s.bad, rate];
    });
  };
  const rows = solve();

  const diagnostics = [
    { message: "Reports were counted instead of orders. An order with three reports is one inaccurate order: count DISTINCT orders with a qualifying report.", rows: solve({ perReport: true }) },
    { message: "Cancelled orders were counted. They were never delivered, so they are in neither the denominator nor the numerator.", rows: solve({ keepCancelled: true, noWindow: level === 1 }) },
    { message: "Every issue type was counted. Only missing_item and incorrect_item make an order inaccurate; late delivery or packaging is a different problem.", rows: solve({ allTypes: true }) },
  ];
  if (level >= 2) diagnostics.push({ message: `Reports filed after the window were counted. A report counts only when reported_at is at most ${windowH} hours after delivered_at (exactly ${windowH} hours still counts).`, rows: solve({ noWindow: true }) });
  if (level === 3) diagnostics.push({ message: "Weeks were taken in UTC. The week is the store's local week: convert placed_at with AT TIME ZONE time_zone before date_trunc('week', …).", rows: solve({ utc: true }) });

  const sCols = level === 3 ? ["store_id", "merchant_id", "time_zone"] : ["store_id", "merchant_id"];
  const sRows = stores.map((s) => (level === 3 ? [s.id, s.merchant, s.tz] : [s.id, s.merchant]));
  const oCols = ["order_id", "store_id", "channel", "status", "placed_at", "delivered_at"];
  const oRows = orders.slice().sort((a, b) => cmp(a.id, b.id)).map((o) => [o.id, o.store.id, o.channel, o.status, fmt(o.placed), o.delivered === null ? null : fmt(o.delivered)]);
  const rCols = ["report_id", "order_id", "issue_type", "reported_at"];
  const rRows = reports.slice().sort((a, b) => a.id - b.id).map((x) => [x.id, x.order.id, x.type, fmt(x.at)]);
  const setup =
    "SET TIME ZONE 'UTC';\n" +
    "CREATE TABLE stores (\n  store_id TEXT PRIMARY KEY,\n  merchant_id TEXT NOT NULL" + (level === 3 ? ",\n  time_zone TEXT NOT NULL      -- IANA zone of the store" : "") + "\n);\n" +
    "CREATE TABLE orders (\n  order_id TEXT PRIMARY KEY,\n  store_id TEXT NOT NULL REFERENCES stores(store_id),\n  channel TEXT NOT NULL,        -- 'marketplace' or 'own_channel' (the merchant's own ordering site)\n  status TEXT NOT NULL,         -- 'delivered' or 'cancelled'\n  placed_at TIMESTAMPTZ NOT NULL,\n  delivered_at TIMESTAMPTZ      -- NULL when cancelled\n);\n" +
    "CREATE TABLE issue_reports (\n  report_id BIGINT PRIMARY KEY,\n  order_id TEXT NOT NULL REFERENCES orders(order_id),\n  issue_type TEXT NOT NULL,\n  reported_at TIMESTAMPTZ NOT NULL\n);\n" +
    insertSQL("stores", sCols, sRows) + insertSQL("orders", oCols, oRows) + insertSQL("issue_reports", rCols, rRows);

  return {
    vars: {
      window_h: windowH,
      orders: orders.length,
      reports: reports.length,
      week_tz_sql: level === 3 ? "s.time_zone" : "'UTC'",
      week_rule: level === 3
        ? "`week_start` is the Monday of the order's week in the store's local time: convert `placed_at` with the store's `time_zone` before finding the week."
        : "`week_start` is the Monday of the UTC week that contains `placed_at`.",
    },
    setup,
    tables: [
      { name: "stores", columns: sCols, rows: sRows },
      { name: "orders", columns: oCols, rows: oRows },
      { name: "issue_reports", columns: rCols, rows: rRows },
    ],
    expected: { columns: ["merchant_id", "week_start", "channel", "delivered_orders", "inaccurate_orders", "accuracy_rate"], rows },
    diagnostics: diagnostics.filter((d) => JSON.stringify(d.rows) !== JSON.stringify(rows)),
  };
}
