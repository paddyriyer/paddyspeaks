/* WMT-L1-02 — Substitutions rejected at handover, and short items with no substitute offered (SQL).
   Simulated practice scenario. All data is generated from the seed; the substitution rules
   are this exercise's rules, not any retailer's.

   Contract: see docs/COMPANY-INTERVIEW-LOOPS.md § Executable templates (sql).
   level: 1 Medium (one offer per short line; decisions accepted or rejected; weeks start on Monday)
          2 Hard (+ several offers per line: the latest decides; no response counts as accepted;
                  cancelled orders left out)
          3 Very Hard (+ offers made for lines that were then picked after all (not substitutions), and
                  lines whose customer disallowed substitutes (not a missed offer)) */
import { insertSQL, ts } from "../../js/rng.js";

export const kind = "sql";

const CATS = ["bakery", "dairy", "frozen", "household", "pet", "produce"];
const BASE = Date.UTC(2026, 8, 13);              // Sunday 2026-09-13
const dayStr = (d) => new Date(BASE + d * 86400000).toISOString().slice(0, 10);
const weekStart = (d, sunday) => {
  const dow = new Date(BASE + d * 86400000).getUTCDay();   // 0 Sunday
  return dayStr(d - (sunday ? dow : (dow + 6) % 7));
};

export function generate(r, level) {
  const cats = r.sample(CATS, level === 1 ? 3 : 4).sort();
  const items = [];
  let iid = r.int(10000, 60000);
  for (const c of cats) for (let k = 0; k < 3; k++) items.push({ id: "itm_" + (iid += r.int(3, 400)), cat: c });
  const storeIds = r.sample(["store_2104", "store_2290", "store_3317", "store_4071", "store_5126"], 2);

  const orders = [];   // {id, store, day, sec, status}
  const lines = [];    // {order, no, item, qty, status: picked|short, allow}
  const offers = [];   // {line, sub, at (sec offset from order time, negative), decision}
  let oid = r.int(500000, 900000);
  const addOrder = (day, sec, status = "completed") => {
    const o = { id: "OG" + (oid += r.int(1, 50)), store: r.pick(storeIds), day, sec, status };
    orders.push(o);
    return o;
  };
  const addLine = (o, item, status, allow = true) => {
    const l = { order: o, no: lines.filter((x) => x.order === o).length + 1, item, qty: r.int(1, 4), status, allow };
    lines.push(l);
    return l;
  };
  const subFor = (item) => {
    const same = items.filter((x) => x.cat === item.cat && x !== item);
    return r.chance(0.3) ? r.pick(items.filter((x) => x.cat !== item.cat)) : r.pick(same);
  };
  const offer = (l, minutesBefore, decision) => offers.push({ line: l, sub: subFor(l.item), before: minutesBefore, decision });

  const n = 8 + 3 * level;
  for (let i = 0; i < n; i++) {
    const cancelled = level >= 2 && r.chance(0.15);
    const o = addOrder(r.int(0, 9), r.int(28800, 75600), cancelled ? "cancelled" : "completed");
    const nl = r.int(2, 4);
    for (let k = 0; k < nl; k++) {
      const item = r.pick(items);
      const short = r.chance(0.5);
      const allow = !(level === 3 && short && r.chance(0.2));
      const l = addLine(o, item, short ? "short" : "picked", allow);
      if (short && allow && r.chance(0.7)) {
        if (level >= 2 && r.chance(0.3)) {
          // A first offer, then a later one: the later decision is the one that counts.
          const first = r.chance(0.5) ? "rejected" : "accepted";
          offer(l, r.int(90, 180), first);
          offer(l, r.int(10, 80), first === "rejected" ? (r.chance(0.6) ? "accepted" : null) : "rejected");
        } else {
          const dec = r.chance(0.4) ? "rejected" : level >= 2 && r.chance(0.2) ? null : "accepted";
          offer(l, r.int(10, 180), dec);
        }
      }
      if (level === 3 && !short && r.chance(0.12)) offer(l, r.int(10, 180), r.chance(0.5) ? "rejected" : "accepted");
    }
  }
  // Every level: a rejected substitution on Sunday night and an accepted one on Monday morning (UTC),
  // the substitute from another category, plus a short line with no offer.
  {
    const it = r.pick(items);
    const o1 = addOrder(0, r.int(86100, 86399));
    const l1 = addLine(o1, it, "short");
    offers.push({ line: l1, sub: r.pick(items.filter((x) => x.cat !== it.cat)), before: r.int(20, 60), decision: "rejected" });
    addLine(o1, r.pick(items), "short");
    const o2 = addOrder(1, r.int(0, 300));
    const l2 = addLine(o2, it, "short");
    offers.push({ line: l2, sub: r.pick(items.filter((x) => x.cat === it.cat && x !== it)), before: r.int(20, 60), decision: "accepted" });
  }
  if (level >= 2) {
    // An offer rejected, then a second one accepted; and one with no response (accepted by rule).
    const o = addOrder(r.int(2, 8), r.int(28800, 75600));
    const it = r.pick(items);
    const l = addLine(o, it, "short");
    offers.push({ line: l, sub: subFor(it), before: 150, decision: "rejected" });
    offers.push({ line: l, sub: subFor(it), before: 40, decision: "accepted" });
    const l2 = addLine(o, r.pick(items), "short");
    offers.push({ line: l2, sub: subFor(l2.item), before: 30, decision: null });
    // A cancelled order with a rejected substitution and a short line with no offer.
    const oc = addOrder(r.int(2, 8), r.int(28800, 75600), "cancelled");
    const lc = addLine(oc, r.pick(items), "short");
    offers.push({ line: lc, sub: subFor(lc.item), before: 60, decision: "rejected" });
    addLine(oc, r.pick(items), "short");
  }
  if (level === 3) {
    // Offered, then the original was found and picked: not a substitution.
    const o = addOrder(r.int(2, 8), r.int(28800, 75600));
    const l = addLine(o, r.pick(items), "picked");
    offers.push({ line: l, sub: subFor(l.item), before: 45, decision: "rejected" });
    // Short, and the customer disallowed substitutes: not a missed offer.
    addLine(o, r.pick(items), "short", false);
  }

  const cmp = (x, y) => (x < y ? -1 : x > y ? 1 : 0);
  const solve = (o = {}) => {
    const g = new Map();
    for (const l of lines) {
      if (l.order.status !== "completed" && !o.withCancelled) continue;
      const w = weekStart(l.order.day, o.sunday);
      const lo = offers.filter((x) => x.line === l).sort((a, b) => b.before - a.before);   // oldest first
      const sub = lo.length > 0 && (l.status === "short" || o.offersOnPicked);
      const cat = sub && o.subCategory ? lo[lo.length - 1].sub.cat : l.item.cat;
      const k = w + "|" + cat;
      if (!g.has(k)) g.set(k, { w, cat, lines: 0, sub: 0, rej: 0, short: 0, miss: 0 });
      const s = g.get(k);
      s.lines++;
      if (l.status === "short") s.short++;
      if (sub) {
        s.sub++;
        const dec = (o.firstOffer ? lo[0] : lo[lo.length - 1]).decision;
        if (dec === "rejected" || (dec === null && o.nullRejected)) s.rej++;
      } else if (l.status === "short" && (l.allow || o.ignoreAllow)) s.miss++;
    }
    return [...g.entries()].sort((a, b) => cmp(a[0], b[0])).map(([, s]) => {
      const d = o.overShort ? s.short : s.sub;
      const rate = d === 0 ? null : Math.floor((s.rej * 20000 + d) / (2 * d)) / 10000;
      return [s.w, s.cat, s.lines, s.sub, s.rej, rate, s.miss];
    });
  };
  const rows = solve();
  const diagnostics = [
    { message: "The rejection rate was divided by every short line. Its denominator is the substituted lines only; short lines with no offer are counted separately.", rows: solve({ overShort: true }) },
    { message: "Lines were grouped by the substitute's category. A line belongs to the category of the item the customer ordered.", rows: solve({ subCategory: true }) },
    { message: "Weeks started on Sunday. week_start is the Monday of the UTC pickup date (date_trunc('week', …)).", rows: solve({ sunday: true }) },
  ];
  if (level >= 2) {
    diagnostics.push({ message: "The first offer decided the outcome. When a line has several offers, the latest one (offered_ts, then offer_id) decides.", rows: solve({ firstOffer: true }) });
    diagnostics.push({ message: "Cancelled orders were included. Only completed orders count.", rows: solve({ withCancelled: true }) });
    diagnostics.push({ message: "An offer with no response (decision NULL) was counted as rejected. This exercise's rule counts it as accepted.", rows: solve({ nullRejected: true }) });
  }
  if (level === 3) {
    diagnostics.push({ message: "Offers on lines that were picked after all were counted as substitutions. Only short lines can be substituted.", rows: solve({ offersOnPicked: true }) });
    diagnostics.push({ message: "Short lines whose customer disallowed substitutes were counted as missed offers. Only lines that allow substitutes can miss one.", rows: solve({ ignoreAllow: true }) });
  }

  const orderTs = (o) => o.day * 86400 + o.sec;
  const at = (s) => ts(dayStr(Math.floor(s / 86400)), ((s % 86400) + 86400) % 86400);
  const iCols = ["item_id", "category"];
  const iRows = items.map((x) => [x.id, x.cat]);
  const oCols = ["order_id", "store_id", "pickup_ts", "status"];
  const oRows = orders.slice().sort((a, b) => cmp(a.id, b.id)).map((o) => [o.id, o.store, at(orderTs(o)), o.status]);
  const lCols = ["order_id", "line_no", "item_id", "qty", "pick_status", "allow_sub"];
  const lRows = lines.slice().sort((a, b) => cmp(a.order.id, b.order.id) || a.no - b.no).map((l) => [l.order.id, l.no, l.item.id, l.qty, l.status, l.allow]);
  const fCols = ["offer_id", "order_id", "line_no", "sub_item_id", "offered_ts", "decision"];
  let fid = r.int(7000, 70000);
  const fRows = offers.slice()
    .sort((a, b) => (orderTs(a.line.order) - a.before * 60) - (orderTs(b.line.order) - b.before * 60) || cmp(a.line.order.id, b.line.order.id) || a.line.no - b.line.no)
    .map((f) => [fid += r.int(1, 9), f.line.order.id, f.line.no, f.sub.id, at(orderTs(f.line.order) - f.before * 60), f.decision]);
  const setup =
    "SET TIME ZONE 'UTC';\n" +
    "CREATE TABLE items (\n  item_id TEXT PRIMARY KEY,\n  category TEXT NOT NULL\n);\n" +
    "CREATE TABLE orders (\n  order_id TEXT PRIMARY KEY,\n  store_id TEXT NOT NULL,\n  pickup_ts TIMESTAMPTZ NOT NULL,\n  status TEXT NOT NULL CHECK (status IN ('completed', 'cancelled'))\n);\n" +
    "CREATE TABLE order_lines (\n  order_id TEXT NOT NULL REFERENCES orders(order_id),\n  line_no INT NOT NULL,\n  item_id TEXT NOT NULL REFERENCES items(item_id),\n  qty INT NOT NULL,\n  pick_status TEXT NOT NULL CHECK (pick_status IN ('picked', 'short')),\n  allow_sub BOOLEAN NOT NULL,\n  PRIMARY KEY (order_id, line_no)\n);\n" +
    "CREATE TABLE sub_offers (\n  offer_id BIGINT PRIMARY KEY,\n  order_id TEXT NOT NULL,\n  line_no INT NOT NULL,\n  sub_item_id TEXT NOT NULL REFERENCES items(item_id),\n  offered_ts TIMESTAMPTZ NOT NULL,\n  decision TEXT CHECK (decision IN ('accepted', 'rejected')),\n  FOREIGN KEY (order_id, line_no) REFERENCES order_lines(order_id, line_no)\n);\n" +
    insertSQL("items", iCols, iRows) + insertSQL("orders", oCols, oRows) + insertSQL("order_lines", lCols, lRows) + insertSQL("sub_offers", fCols, fRows);

  return {
    vars: {
      offer_rule: level === 1
        ? "In this sample every substituted line has exactly one offer, every decision is `accepted` or `rejected`, and every order is `completed`."
        : "A line can have several offers (the store proposed another substitute after a rejection): the latest offer (`offered_ts`, then `offer_id`) decides. A `NULL` decision means the customer did not respond, which this exercise's rule counts as accepted. Lines of `cancelled` orders are left out entirely.",
      allow_rule: level === 3
        ? "A substitution offer can exist on a line that was picked after all (the original was found): that line was not substituted. A short line with `allow_sub = false` had no substitute because the customer said no, so it is not a missed offer."
        : "Every line has `allow_sub = true` in this sample, and offers exist only for short lines.",
    },
    setup,
    tables: [
      { name: "items", columns: iCols, rows: iRows },
      { name: "orders", columns: oCols, rows: oRows },
      { name: "order_lines", columns: lCols, rows: lRows },
      { name: "sub_offers", columns: fCols, rows: fRows },
    ],
    expected: { columns: ["week_start", "category", "lines", "substituted", "rejected", "reject_rate", "short_no_offer"], rows },
    diagnostics: diagnostics.filter((d) => JSON.stringify(d.rows) !== JSON.stringify(rows)),
  };
}
