/* DSH-L1-02 — Membership value per month (SQL).
   Simulated practice scenario. All data is generated from the seed; the membership,
   minimum-subtotal and fee rules are this exercise's rules, not any real programme's.

   Contract: see docs/COMPANY-INTERVIEW-LOOPS.md § Executable templates (sql).
   level: 1 Medium (one minimum subtotal, members with no orders still counted, cancelled orders
                    and orders outside a member-month excluded, "exceeded" is strict, trial months apart)
          2 Hard (+ the minimum is tested on the subtotal after promotions, a subtotal exactly at the
                  minimum qualifies, orders a second either side of a month boundary)
          3 Very Hard (+ grocery and convenience stores have a higher minimum than restaurants) */
import { insertSQL } from "../../js/rng.js";

export const kind = "sql";

const MONTHS = ["2026-07-01", "2026-08-01", "2026-09-01"];
const DAYS_IN = { "2026-07-01": 31, "2026-08-01": 31, "2026-09-01": 30 };
const DAY = 86400000;
const p2 = (n) => String(n).padStart(2, "0");
const fmt = (ms) => {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())} ${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}:${p2(d.getUTCSeconds())}+00`;
};
const monthOf = (ms) => new Date(ms).toISOString().slice(0, 7) + "-01";

export function generate(r, level) {
  const minRest = r.pick([1000, 1200, 1500]);
  const minGroc = level === 3 ? r.pick([2500, 3000, 3500]) : minRest;
  const nStores = 4;
  const stores = [];
  let sid = r.int(100, 900);
  for (let i = 0; i < nStores; i++) stores.push({ id: "st_" + (sid += r.int(3, 70)), vertical: level === 3 && i >= 2 ? r.pick(["grocery", "convenience"]) : "restaurant" });
  const minFor = (st) => (st.vertical === "restaurant" ? minRest : minGroc);

  const consumers = [];
  let cid = r.int(10000, 60000);
  const nCons = 6 + level;
  for (let i = 0; i < nCons; i++) consumers.push("cx_" + (cid += r.int(7, 400)));
  const members = [];       // {consumer, month, trial, price}
  for (const c of consumers) {
    const first = r.int(0, 2);
    const last = r.int(first, 2);
    const price = r.pick([799, 899, 999]);
    const trialFirst = r.chance(0.45);
    for (let m = first; m <= last; m++) members.push({ consumer: c, month: MONTHS[m], trial: trialFirst && m === first, price });
  }
  const isMember = (c, month) => members.find((x) => x.consumer === c && x.month === month);

  const orders = [];        // {id, consumer, store, placed, status, subtotal, promo, fee}
  let oid = r.int(300000, 800000);
  const addOrder = (c, store, placed, o = {}) => {
    const ord = {
      id: "ord_" + (oid += r.int(1, 90)),
      consumer: c,
      store,
      placed,
      status: o.status || (r.chance(0.1) ? "cancelled" : "delivered"),
      subtotal: o.subtotal ?? r.int(6, 70) * 100 + r.pick([0, 49, 99]),
      promo: o.promo ?? (level >= 2 && r.chance(0.3) ? r.pick([200, 300, 500]) : 0),
      fee: o.fee ?? r.pick([199, 299, 399, 499, 599]),
    };
    orders.push(ord);
    return ord;
  };
  const randIn = (month) => Date.parse(month + "T00:00:00Z") + r.int(0, DAYS_IN[month] - 1) * DAY + r.int(9 * 3600, 23 * 3600) * 1000;
  for (const c of consumers) {
    for (const month of MONTHS) {
      const k = r.int(0, isMember(c, month) ? 4 : 2);
      for (let i = 0; i < k; i++) addOrder(c, r.pick(stores), randIn(month));
    }
  }
  // Every level: a member-month whose waived fees equal the price exactly (not ahead), and one
  // with a cancelled qualifying order that would otherwise put it ahead.
  const paid = members.filter((x) => !x.trial);
  const exact = paid.length ? r.pick(paid) : members[0];
  const others = members.filter((x) => x !== exact);
  {
    const mm = exact;
    const rest = stores.find((s) => s.vertical === "restaurant");
    // Remove this member-month's random orders so the total is exact.
    for (let i = orders.length - 1; i >= 0; i--) if (orders[i].consumer === mm.consumer && monthOf(orders[i].placed) === mm.month) orders.splice(i, 1);
    const half = Math.floor(mm.price / 2);
    addOrder(mm.consumer, rest, randIn(mm.month), { status: "delivered", subtotal: minRest + 500, promo: 0, fee: half });
    addOrder(mm.consumer, rest, randIn(mm.month), { status: "delivered", subtotal: minRest + 900, promo: 0, fee: mm.price - half });
    addOrder(mm.consumer, rest, randIn(mm.month), { status: "cancelled", subtotal: minRest + 1500, promo: 0, fee: 399 });
    addOrder(mm.consumer, rest, randIn(mm.month), { status: "delivered", subtotal: minRest - 1, promo: 0, fee: 499 });
  }
  // Hard+: a subtotal exactly at the minimum after a promotion (qualifies), one a cent below after a
  // promotion (does not), and orders a second either side of a month boundary for a member who
  // joined in the later month.
  if (level >= 2) {
    const rest = stores.find((s) => s.vertical === "restaurant");
    const mm = r.pick(others);
    addOrder(mm.consumer, rest, randIn(mm.month), { status: "delivered", subtotal: minRest + 300, promo: 300, fee: 299 });
    addOrder(mm.consumer, rest, randIn(mm.month), { status: "delivered", subtotal: minRest + 199, promo: 200, fee: 399 });
    const late = others.find((x) => x.consumer !== exact.consumer && x.month !== MONTHS[0] && !isMember(x.consumer, MONTHS[MONTHS.indexOf(x.month) - 1]));
    if (late) {
      const t = Date.parse(late.month + "T00:00:00Z");
      addOrder(late.consumer, rest, t - 1000, { status: "delivered", subtotal: minRest + 2000, promo: 0, fee: 599 });
      addOrder(late.consumer, rest, t, { status: "delivered", subtotal: minRest + 2000, promo: 0, fee: 599 });
    }
  }
  // Very Hard: a grocery order above the restaurant minimum but below the grocery minimum.
  if (level === 3) {
    const groc = stores.find((s) => s.vertical !== "restaurant");
    const mm = r.pick(others);
    addOrder(mm.consumer, groc, randIn(mm.month), { status: "delivered", subtotal: Math.floor((minRest + minGroc) / 2), promo: 0, fee: 499 });
    addOrder(mm.consumer, groc, randIn(mm.month), { status: "delivered", subtotal: minGroc, promo: 0, fee: 399 });
  }

  const cmp = (x, y) => (x < y ? -1 : x > y ? 1 : 0);
  const solve = (o = {}) => {
    const per = new Map();   // consumer|month -> {count, cents}
    for (const ord of orders) {
      if (!o.keepCancelled && ord.status !== "delivered") continue;
      const month = monthOf(ord.placed);
      if (!isMember(ord.consumer, month)) continue;
      const sub = o.ignorePromo ? ord.subtotal : ord.subtotal - ord.promo;
      const min = o.oneMin ? minRest : minFor(ord.store);
      if (!o.noMin && !(o.strictMin ? sub > min : sub >= min)) continue;
      const k = ord.consumer + "|" + month;
      if (!per.has(k)) per.set(k, { n: 0, cents: 0 });
      per.get(k).n++;
      per.get(k).cents += ord.fee;
    }
    const g = new Map();
    for (const mm of members) {
      const w = per.get(mm.consumer + "|" + mm.month);
      if (o.inner && !w) continue;
      const k = mm.month + "|" + (mm.trial ? "trial" : "paid");
      if (!g.has(k)) g.set(k, { members: 0, orders: 0, cents: 0, ahead: 0 });
      const s = g.get(k);
      s.members++;
      if (w) {
        s.orders += w.n;
        s.cents += w.cents;
        if (o.ge ? w.cents >= mm.price : w.cents > mm.price) s.ahead++;
      }
    }
    const share = (n, d) => Math.floor((n * 20000 + d) / (2 * d)) / 10000;
    return [...g.entries()].sort((x, y) => cmp(x[0], y[0])).map(([k, s]) => {
      const [month, kind2] = k.split("|");
      return [month, kind2, s.members, s.orders, s.cents, s.ahead, share(s.ahead, s.members)];
    });
  };
  const rows = solve();

  const diagnostics = [
    { message: "Members with no qualifying order that month were dropped (an inner join). Every member-month is in the denominator, including the ones that saved nothing.", rows: solve({ inner: true }) },
    { message: "A member whose waived fees exactly equal the monthly price was counted as ahead. 'Exceeded' is strict: waived > price_cents.", rows: solve({ ge: true }) },
    { message: "Cancelled orders were counted. A cancelled order was never delivered, so no fee was waived.", rows: solve({ keepCancelled: true }) },
    { message: "Every member order was treated as waived. Only orders that meet the minimum subtotal have their delivery fee waived.", rows: solve({ noMin: true }) },
  ];
  if (level >= 2) {
    diagnostics.push({ message: "The minimum was tested on the subtotal before promotions. This exercise's rule tests subtotal_cents - promo_cents.", rows: solve({ ignorePromo: true }) });
    diagnostics.push({ message: "A subtotal exactly at the minimum was excluded. The minimum is inclusive (>=).", rows: solve({ strictMin: true }) });
  }
  if (level === 3) diagnostics.push({ message: "The restaurant minimum was used for every store. Grocery and convenience stores have their own, higher minimum.", rows: solve({ oneMin: true }) });

  const mCols = ["consumer_id", "month", "is_trial", "price_cents"];
  const mRows = members.slice().sort((a, b) => cmp(a.consumer + a.month, b.consumer + b.month)).map((x) => [x.consumer, x.month, x.trial, x.price]);
  const sCols = ["store_id", "vertical"];
  const sRows = stores.map((s) => [s.id, s.vertical]);
  const oCols = ["order_id", "consumer_id", "store_id", "placed_at", "status", "subtotal_cents", "promo_cents", "delivery_fee_cents"];
  const oRows = orders.slice().sort((a, b) => cmp(a.id, b.id)).map((x) => [x.id, x.consumer, x.store.id, fmt(x.placed), x.status, x.subtotal, x.promo, x.fee]);
  const setup =
    "SET TIME ZONE 'UTC';\n" +
    "CREATE TABLE member_months (\n  consumer_id TEXT NOT NULL,\n  month DATE NOT NULL,          -- first day of a UTC calendar month the consumer was a member\n  is_trial BOOLEAN NOT NULL,\n  price_cents INT NOT NULL,     -- the plan's monthly price (a trial month is free)\n  PRIMARY KEY (consumer_id, month)\n);\n" +
    "CREATE TABLE stores (\n  store_id TEXT PRIMARY KEY,\n  vertical TEXT NOT NULL        -- 'restaurant', 'grocery' or 'convenience'\n);\n" +
    "CREATE TABLE orders (\n  order_id TEXT PRIMARY KEY,\n  consumer_id TEXT NOT NULL,\n  store_id TEXT NOT NULL REFERENCES stores(store_id),\n  placed_at TIMESTAMPTZ NOT NULL,\n  status TEXT NOT NULL,         -- 'delivered' or 'cancelled'\n  subtotal_cents INT NOT NULL,\n  promo_cents INT NOT NULL,     -- promotion discount on the subtotal\n  delivery_fee_cents INT NOT NULL  -- the fee a non-member would pay\n);\n" +
    insertSQL("member_months", mCols, mRows) + insertSQL("stores", sCols, sRows) + insertSQL("orders", oCols, oRows);

  return {
    vars: {
      min_restaurant: minRest,
      min_grocery: minGroc,
      orders: orders.length,
      member_months: members.length,
      min_rule: level === 3
        ? `An order meets the minimum when its subtotal after promotions (\`subtotal_cents - promo_cents\`) is at least ${minRest} cents at a restaurant, or at least ${minGroc} cents at a \`grocery\` or \`convenience\` store.`
        : `An order meets the minimum when its subtotal after promotions (\`subtotal_cents - promo_cents\`) is at least ${minRest} cents, at any store.` +
          (level === 1 ? " In this sample every `promo_cents` is 0." : ""),
    },
    setup,
    tables: [
      { name: "member_months", columns: mCols, rows: mRows },
      { name: "stores", columns: sCols, rows: sRows },
      { name: "orders", columns: oCols, rows: oRows },
    ],
    expected: { columns: ["month", "plan_kind", "members", "waived_orders", "fees_waived_cents", "members_ahead", "share_ahead"], rows },
    diagnostics: diagnostics.filter((d) => JSON.stringify(d.rows) !== JSON.stringify(rows)),
  };
}
