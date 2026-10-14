/* AMZ-L1-01 — Delivery promise kept, judged on the customer's local date (SQL).
   Simulated practice scenario. All data is generated from the seed and is hypothetical.

   Contract: see docs/COMPANY-INTERVIEW-LOOPS.md § Executable templates (sql).
   An order is on time when every one of its packages has a DELIVERED scan and the
   latest first-DELIVERED scan, converted to the destination's local date, is on or
   before the promised date. The oracle converts instants with Intl (IANA zones),
   independently of PostgreSQL's AT TIME ZONE.
   level: 1 Medium (one package per order; evening deliveries that are the next UTC day)
          2 Hard (+ multi-package orders judged by their last package, undelivered packages)
          3 Very Hard (+ attempted-but-not-delivered scans, duplicate DELIVERED scans,
                       orders not yet shipped (no packages), a DST change and non-DST zones) */
import { insertSQL } from "../../js/rng.js";

export const kind = "sql";

const METHODS = ["economy", "expedited", "scheduled", "standard"];
const FCS = ["FC-RIVERBEND-1", "FC-LAKESIDE-2", "FC-MESA-4", "FC-HARBOR-3", "FC-PRAIRIE-7"];
const ZONES12 = ["America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles"];
const ZONES3 = ["America/New_York", "America/Chicago", "America/Los_Angeles", "America/Phoenix", "Pacific/Honolulu"];
const BASES = ["2026-09-14", "2026-09-28", "2026-10-12", "2026-10-31", "2026-11-09"];

const DAY = 86400000;
const fmtCache = {};
function localDate(ms, tz) {
  const f = (fmtCache[tz] ||= new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }));
  return f.format(new Date(ms));
}
const dayMs = (d) => Date.parse(d + "T00:00:00Z");
const addDays = (d, n) => new Date(dayMs(d) + n * DAY).toISOString().slice(0, 10);
const diffDays = (a, b) => Math.round((dayMs(a) - dayMs(b)) / DAY);
const fmt = (ms) => new Date(ms).toISOString().replace("T", " ").replace(/\.\d+Z$/, "+00");
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

export function generate(r, level) {
  const groupCol = r.pick(["ship_method", "fc_id"]);
  const base = level === 3 ? r.pick(["2026-10-31", "2026-03-07", ...BASES]) : r.pick(BASES);
  const promiseDays = [base, addDays(base, 1)];
  const methods = r.sample(METHODS, 3);
  const fcs = r.sample(FCS, 3);
  const zones = level === 3 ? ZONES3 : r.sample(ZONES12, 3);
  const nOrders = (level === 1 ? 10 : level === 2 ? 14 : 18) + r.int(0, 2);

  const plans = ["on_time", "evening", "late", "evening"];
  if (level >= 2) plans.push("multi_one_late", "multi_on_time", "multi_missing", "missing");
  if (level === 3) plans.push("attempt_then_late", "dup_delivered", "not_shipped", "multi_evening");
  while (plans.length < nOrders) plans.push(r.pick(level === 1 ? ["on_time", "on_time", "late", "evening"] : ["on_time", "on_time", "late", "evening", "multi_on_time", "multi_one_late"]));
  const order = r.shuffle(plans);

  const orderIds = r.shuffle([...Array(200)].map((_, i) => 1100000 + i * 97 + r.int(0, 90))).slice(0, order.length);
  let pkgSeq = 500000 + r.int(0, 40000);
  let scanSeq = 9000000 + r.int(0, 100000);

  const orders = [];
  const packages = [];
  const scans = [];
  const addScan = (pkg, type, ms) => scans.push({ id: scanSeq++, pkg, type, ms });

  // An instant on a given UTC day; the oracle decides its local date.
  const at = (d, minSec, maxSec) => dayMs(d) + r.int(minSec, maxSec) * 1000;
  const onTimeMs = (p) => at(addDays(p, -r.int(0, 1)), 15 * 3600, 22 * 3600);   // local daytime, on or before the promise
  const eveningMs = (p) => at(addDays(p, 1), 1800, 3 * 3600 + 1800);            // next UTC day, still the promised local evening
  const lateMs = (p) => at(addDays(p, r.int(1, 3)), 15 * 3600, 22 * 3600);

  const shipPackage = (o, deliveredMs, opts = {}) => {
    const id = "PKG-" + pkgSeq++;
    packages.push({ id, order: o.id });
    const firstScan = deliveredMs != null ? deliveredMs : dayMs(o.promised) + r.int(8 * 3600, 16 * 3600) * 1000;
    addScan(id, "DEPARTED_FC", firstScan - r.int(20, 40) * 3600000);
    if (opts.attemptMs != null) {
      addScan(id, "OUT_FOR_DELIVERY", opts.attemptMs - r.int(2, 5) * 3600000);
      addScan(id, "DELIVERY_ATTEMPTED", opts.attemptMs);
    }
    if (deliveredMs != null) {
      addScan(id, "OUT_FOR_DELIVERY", deliveredMs - r.int(1, 6) * 3600000);
      addScan(id, "DELIVERED", deliveredMs);
      if (opts.dupMs != null) addScan(id, "DELIVERED", opts.dupMs);
    } else {
      addScan(id, "ARRIVED_AT_STATION", firstScan - r.int(2, 10) * 3600000);
    }
  };

  order.forEach((plan, i) => {
    const promised = r.pick(promiseDays);
    const o = {
      id: "ORD-" + orderIds[i],
      method: r.pick(methods),
      fc: r.pick(fcs),
      tz: r.pick(zones),
      promised,
      placedMs: null,
    };
    orders.push(o);
    const p = promised;
    if (plan === "on_time") shipPackage(o, onTimeMs(p));
    else if (plan === "evening") shipPackage(o, eveningMs(p));
    else if (plan === "late") shipPackage(o, lateMs(p));
    else if (plan === "missing") shipPackage(o, null);
    else if (plan === "multi_on_time") { shipPackage(o, onTimeMs(p)); shipPackage(o, onTimeMs(p)); }
    else if (plan === "multi_one_late") { shipPackage(o, onTimeMs(p)); shipPackage(o, lateMs(p)); if (r.chance(0.5)) shipPackage(o, onTimeMs(p)); }
    else if (plan === "multi_missing") { shipPackage(o, onTimeMs(p)); shipPackage(o, null); }
    else if (plan === "multi_evening") { shipPackage(o, onTimeMs(p)); shipPackage(o, eveningMs(p)); }
    else if (plan === "attempt_then_late") shipPackage(o, lateMs(p), { attemptMs: onTimeMs(p) });
    else if (plan === "dup_delivered") { const d = onTimeMs(p); shipPackage(o, d, { dupMs: d + r.int(1, 2) * DAY + r.int(0, 3600) * 1000 }); }
    // not_shipped: no packages at all
    const own = new Set(packages.filter((x) => x.order === o.id).map((x) => x.id));
    const first = Math.min(dayMs(p) - DAY, ...scans.filter((s) => own.has(s.pkg)).map((s) => s.ms));
    o.placedMs = first - r.int(2 * 3600, 40 * 3600) * 1000;
  });

  // ---- oracle ---------------------------------------------------------------
  const compute = (opt = {}) => {
    const byPkg = {};
    for (const s of scans) {
      const counts = s.type === "DELIVERED" || (opt.attemptCounts && s.type === "DELIVERY_ATTEMPTED");
      if (!counts) continue;
      const cur = byPkg[s.pkg];
      if (cur == null || (opt.lastScan ? s.ms > cur : s.ms < cur)) byPkg[s.pkg] = s.ms;
    }
    const groups = {};
    for (const o of orders) {
      const pk = packages.filter((p) => p.order === o.id);
      if (opt.dropUnshipped && !pk.length) continue;
      const dates = pk.filter((p) => byPkg[p.id] != null).map((p) => (opt.utc ? new Date(byPkg[p.id]).toISOString().slice(0, 10) : localDate(byPkg[p.id], o.tz)));
      let outcome, late = null;
      const allDelivered = pk.length > 0 && dates.length === pk.length;
      if (!allDelivered && !(opt.partialCounts && dates.length)) outcome = "undelivered";
      else {
        const d = dates.reduce((a, b) => (opt.firstPackage ? (b < a ? b : a) : b > a ? b : a));
        if (d <= o.promised) outcome = "on_time";
        else { outcome = "late"; late = diffDays(d, o.promised); }
      }
      const g = groupCol === "ship_method" ? o.method : o.fc;
      const key = o.promised + "|" + g;
      const G = (groups[key] ||= { promised: o.promised, g, orders: 0, on_time: 0, late: 0, undelivered: 0, maxLate: null });
      G.orders++;
      G[outcome]++;
      if (late != null) G.maxLate = G.maxLate == null ? late : Math.max(G.maxLate, late);
    }
    return Object.values(groups)
      .sort((a, b) => cmp(a.promised, b.promised) || cmp(a.g, b.g))
      .map((G) => [G.promised, G.g, G.orders, G.on_time, G.late, G.undelivered, Math.floor((2 * G.on_time * 1000 + G.orders) / (2 * G.orders)) / 10, G.maxLate]);
  };
  const rows = compute();

  const diagnostics = [
    { message: "Deliveries were dated in UTC. The promise is a local date at the destination: a parcel delivered at 8 p.m. in Los Angeles is the next day in UTC but on time for the customer. Convert with `delivered_at AT TIME ZONE dest_tz` before taking the date.", rows: compute({ utc: true }) },
  ];
  if (level >= 2) {
    diagnostics.push({ message: "A multi-package order was judged by its first package to arrive. The customer has the order only when the last package arrives: use the latest delivery date per order.", rows: compute({ firstPackage: true }) });
    diagnostics.push({ message: "An order with a package that never arrived was judged by the packages that did. Until every package is delivered, the order is undelivered.", rows: compute({ partialCounts: true }) });
  }
  if (level === 3) {
    diagnostics.push({ message: "A DELIVERY_ATTEMPTED scan was treated as a delivery. An attempt means the customer still does not have the parcel; only DELIVERED counts.", rows: compute({ attemptCounts: true }) });
    diagnostics.push({ message: "The latest DELIVERED scan was used. A repeated DELIVERED scan (a device re-sync) does not move the delivery: use each package's first one.", rows: compute({ lastScan: true }) });
    diagnostics.push({ message: "Orders with no packages disappeared (an inner join). An order that has not shipped is still an order whose promise is not kept: LEFT JOIN from orders.", rows: compute({ dropUnshipped: true }) });
  }

  const oCols = ["order_id", "ship_method", "fc_id", "dest_tz", "promised_date", "placed_at"];
  const oRows = orders.map((o) => [o.id, o.method, o.fc, o.tz, o.promised, fmt(o.placedMs)]).sort((a, b) => cmp(a[0], b[0]));
  const pCols = ["package_id", "order_id"];
  const pRows = packages.map((p) => [p.id, p.order]).sort((a, b) => cmp(a[0], b[0]));
  const sCols = ["scan_id", "package_id", "scan_type", "scanned_at"];
  const sRows = scans.slice().sort((a, b) => a.ms - b.ms || a.id - b.id).map((s) => [s.id, s.pkg, s.type, fmt(s.ms)]);

  const types = level === 3 ? "'DEPARTED_FC','ARRIVED_AT_STATION','OUT_FOR_DELIVERY','DELIVERY_ATTEMPTED','DELIVERED'" : "'DEPARTED_FC','ARRIVED_AT_STATION','OUT_FOR_DELIVERY','DELIVERED'";
  const setup =
    "SET TIME ZONE 'UTC';\n" +
    "CREATE TABLE orders (\n  order_id TEXT PRIMARY KEY,\n  ship_method TEXT NOT NULL,\n  fc_id TEXT NOT NULL,           -- fulfilment centre that ships it\n  dest_tz TEXT NOT NULL,         -- IANA time zone of the delivery address\n  promised_date DATE NOT NULL,   -- local date promised to the customer\n  placed_at TIMESTAMPTZ NOT NULL\n);\n" +
    "CREATE TABLE packages (\n  package_id TEXT PRIMARY KEY,\n  order_id TEXT NOT NULL REFERENCES orders(order_id)\n);\n" +
    `CREATE TABLE package_scans (\n  scan_id BIGINT PRIMARY KEY,\n  package_id TEXT NOT NULL REFERENCES packages(package_id),\n  scan_type TEXT NOT NULL CHECK (scan_type IN (${types})),\n  scanned_at TIMESTAMPTZ NOT NULL\n);\n` +
    insertSQL("orders", oCols, oRows) + insertSQL("packages", pCols, pRows) + insertSQL("package_scans", sCols, sRows);

  return {
    vars: {
      group_col: groupCol,
      n_orders: orders.length,
      package_rule:
        level === 1
          ? "Every order shipped as exactly one package."
          : level === 2
            ? "An order can ship as several packages; it is delivered on the local date its last package is delivered, and it is undelivered while any package has no DELIVERED scan."
            : "An order can ship as several packages (or none yet); it is delivered on the local date its last package is delivered, and it is undelivered while it has no packages or any package has no DELIVERED scan.",
      scan_rule:
        level === 3
          ? "A package's delivery time is its first `DELIVERED` scan; a later repeat of that scan changes nothing, and `DELIVERY_ATTEMPTED` is not a delivery."
          : "A package's delivery time is its `DELIVERED` scan (use the first if there were several).",
    },
    setup,
    tables: [
      { name: "orders", columns: oCols, rows: oRows },
      { name: "packages", columns: pCols, rows: pRows },
      { name: "package_scans", columns: sCols, rows: sRows },
    ],
    expected: { columns: ["promised_date", groupCol, "orders", "on_time", "late", "undelivered", "on_time_pct", "max_days_late"], rows },
    diagnostics: diagnostics.filter((d) => JSON.stringify(d.rows) !== JSON.stringify(rows)),
  };
}
