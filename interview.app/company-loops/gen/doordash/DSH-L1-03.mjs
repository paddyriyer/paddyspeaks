/* DSH-L1-03 — Ordered while toggled off: as-of item availability at order time (SQL).
   Simulated practice scenario. All data is generated from the seed.

   Contract: see docs/COMPANY-INTERVIEW-LOOPS.md § Executable templates (sql).
   level: 1 Medium (latest store toggle at or before the order wins; toggles after the order are
                    ignored; an item never toggled is available; off then back on is available)
          2 Hard (+ a toggle at exactly the order time applies, two toggles at one instant (the higher
                  toggle_id wins), the same item toggled at another store does not apply)
          3 Very Hard (+ merchant-wide toggles (store_id NULL) apply to every store of that merchant;
                  the latest toggle of either scope wins) */
import { insertSQL } from "../../js/rng.js";

export const kind = "sql";

const DAY0 = Date.UTC(2026, 8, 21);
const DAY = 86400000;
const BRANDS = ["corner_mart", "quick_stop", "fresh_basket", "night_owl", "city_grocer", "daily_needs"];
const ITEMS = ["oat_milk", "eggs_12", "bananas", "ice_cream", "cold_brew", "sourdough", "tortilla_chips", "sparkling_water",
  "pain_relief", "diapers_s3", "ramen_cup", "greek_yogurt", "paper_towels", "frozen_pizza", "avocados", "dish_soap"];

const p2 = (n) => String(n).padStart(2, "0");
const fmt = (ms) => {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())} ${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}:${p2(d.getUTCSeconds())}+00`;
};

export function generate(r, level) {
  const brands = r.sample(BRANDS, level === 3 ? 2 : 1).sort();
  const stores = [];
  let sid = r.int(1000, 5000);
  if (level === 3) {
    stores.push({ id: "st_" + (sid += r.int(5, 90)), merchant: brands[0] });
    stores.push({ id: "st_" + (sid += r.int(5, 90)), merchant: brands[0] });
    stores.push({ id: "st_" + (sid += r.int(5, 90)), merchant: brands[1] });
  } else {
    const k = level === 1 ? 2 : 3;
    for (let i = 0; i < k; i++) stores.push({ id: "st_" + (sid += r.int(5, 90)), merchant: brands[0] });
  }
  const items = r.sample(ITEMS, level === 1 ? 8 : level === 2 ? 10 : 14).map((x) => "itm_" + x);
  // Items reserved for the edge cases below get no random toggles, so each edge means what it says.
  const nRes = level === 1 ? 4 : level === 2 ? 7 : 10;
  const reserved = items.slice(0, nRes);
  const free = items.slice(nRes);

  const toggles = [];   // {id, merchant, store (null = merchant-wide), item, avail, at}
  let tid = r.int(100, 5000);
  const addToggle = (merchant, store, item, avail, at) => {
    const t = { id: (tid += r.int(1, 7)), merchant, store, item, avail, at };
    toggles.push(t);
    return t;
  };
  const orders = [];    // {id, store, at, items: [item]}
  let oid = r.int(500000, 900000);
  const addOrder = (store, at, its) => {
    const o = { id: "ord_" + (oid += r.int(1, 80)), store, at, items: [...new Set(its)] };
    orders.push(o);
    return o;
  };
  const randAt = (lo = 0, hi = 2 * DAY - 1000) => DAY0 + r.int(lo / 1000, hi / 1000) * 1000;

  // Random toggles, in time order per (store, item): alternating off/on, mostly off first.
  for (const s of stores) {
    for (const it of r.sample(free, r.int(2, free.length))) {
      let avail = false;
      const k = r.int(1, 3);
      const times = Array.from({ length: k }, () => randAt(0, 2 * DAY - 3600000)).sort((a, b) => a - b);
      for (const at of times) { addToggle(s.merchant, s.id, it, avail, at); avail = !avail; }
    }
  }
  if (level === 3) {
    for (const m of brands) {
      for (const it of r.sample(free, 2)) addToggle(m, null, it, r.chance(0.6) ? false : true, randAt());
    }
  }
  const n = 10 + 4 * level;
  for (let i = 0; i < n; i++) addOrder(r.pick(stores), randAt(8 * 3600000, 2 * DAY - 3600000), r.sample(items, r.int(1, 4)));

  // Every level: an order after an "off" toggle (flagged), an order before it (not), a toggle after
  // the order that is ignored, off then back on before an order (available), and an order with two
  // unavailable lines (one order, two lines).
  {
    const s = stores[0];
    const [a, b, c, d] = reserved.slice(0, 4);
    const t0 = DAY0 + r.int(9, 14) * 3600000;
    addToggle(s.merchant, s.id, a, false, t0);
    addOrder(s, t0 - r.int(60, 900) * 1000, [a]);                         // before the toggle: available
    addOrder(s, t0 + r.int(60, 900) * 1000, [a, b]);                      // after it: one bad line
    addToggle(s.merchant, s.id, b, false, t0 + 2 * DAY - 7200000);       // after every order: ignored
    addToggle(s.merchant, s.id, c, false, t0 + 1800000);
    addToggle(s.merchant, s.id, c, true, t0 + 3600000);
    addOrder(s, t0 + 3600000 + r.int(60, 600) * 1000, [c]);               // off then on: available
    addToggle(s.merchant, s.id, d, false, t0 + 4 * 3600000);
    addOrder(s, t0 + 5 * 3600000, [a, d, c]);                             // a and d off: two lines
  }
  // Hard+: a toggle at exactly the order time, two toggles at one instant, and the same item off at
  // another store.
  if (level >= 2) {
    const s = stores[1], other = stores[0];
    const [e, f, g] = reserved.slice(4, 7);
    const t1 = DAY0 + DAY + r.int(9, 14) * 3600000;
    addToggle(s.merchant, s.id, e, true, t1 - 7200000);
    addToggle(s.merchant, s.id, e, false, t1);
    addOrder(s, t1, [e]);                                                 // toggle at the same second applies
    addToggle(s.merchant, s.id, f, false, t1 + 3600000);
    addToggle(s.merchant, s.id, f, true, t1 + 3600000);                   // same instant, higher id: available
    addOrder(s, t1 + 3600000 + r.int(30, 600) * 1000, [f]);
    addToggle(other.merchant, other.id, g, false, t1 - 3 * 3600000);      // another store only
    addToggle(s.merchant, s.id, g, true, t1 - 4 * 3600000);
    addOrder(s, t1 - 2 * 3600000, [g]);
  }
  // Very Hard: merchant-wide off then a later store-level on (available), store-level off then a
  // later merchant-wide on (available), a merchant-wide off that applies to a store with no store
  // toggle (unavailable), and another merchant's merchant-wide toggle (does not apply).
  if (level === 3) {
    const [s1, s2, s3] = stores;
    const [h, i2, j] = reserved.slice(7, 10);
    const t2 = DAY0 + r.int(15, 19) * 3600000;
    addToggle(s1.merchant, null, h, false, t2);
    addToggle(s1.merchant, s1.id, h, true, t2 + 1800000);
    addOrder(s1, t2 + 3600000, [h]);                                      // store on after merchant off: available
    addOrder(s2, t2 + 3600000, [h]);                                      // merchant off applies to s2
    addToggle(s2.merchant, s2.id, i2, false, t2 - 3600000);
    addToggle(s2.merchant, null, i2, true, t2 - 1800000);
    addOrder(s2, t2, [i2]);                                               // merchant on after store off: available
    addToggle(s3.merchant, null, j, false, t2 - 7200000);
    addToggle(s1.merchant, s1.id, j, true, t2 - 9000000);
    addOrder(s1, t2 - 3600000, [j]);                                      // other merchant's off: available
  }

  const cmp = (x, y) => (x < y ? -1 : x > y ? 1 : 0);
  const stateOf = (o, item, opt) => {
    let best = null;
    let anyOff = false;
    for (const t of toggles) {
      if (t.item !== item) continue;
      const applies = opt.anyStore ? t.merchant === o.store.merchant
        : t.store === o.store.id || (t.store === null && !opt.noMerchant && t.merchant === o.store.merchant);
      if (!applies) continue;
      if (!opt.ignoreTime) {
        if (opt.strict ? !(t.at < o.at) : !(t.at <= o.at)) continue;
      }
      if (!t.avail) anyOff = true;
      const better = !best || t.at > best.at || (t.at === best.at && (opt.tieLow ? t.id < best.id : t.id > best.id));
      if (better) best = t;
    }
    if (opt.everOff) return !anyOff;
    return best ? best.avail : true;
  };
  const solve = (opt = {}) => {
    const g = new Map();
    for (const o of orders) {
      const day = new Date(o.at).toISOString().slice(0, 10);
      const k = o.store.id + "|" + day;
      if (!g.has(k)) g.set(k, { n: 0, f: 0, l: 0 });
      const s = g.get(k);
      s.n++;
      const bad = o.items.filter((it) => !stateOf(o, it, opt)).length;
      if (bad) s.f += opt.linesAsOrders ? bad : 1;
      s.l += bad;
    }
    return [...g.entries()].sort((x, y) => cmp(x[0], y[0])).map(([k, s]) => {
      const [st, day] = k.split("|");
      return [st, day, s.n, s.f, s.l];
    });
  };
  const rows = solve();

  const diagnostics = [
    { message: "Toggles after the order were used. An order sees only the latest toggle at or before placed_at; a toggle later in the day changes nothing for it.", rows: solve({ ignoreTime: true }) },
    { message: "Any earlier 'off' toggle flagged the line, even when the item was switched back on before the order. Only the latest toggle counts.", rows: solve({ everOff: true }) },
    { message: "Unavailable lines were counted as orders. flagged_orders counts orders with at least one unavailable line; flagged_lines counts the lines.", rows: solve({ linesAsOrders: true }) },
  ];
  if (level >= 2) {
    diagnostics.push({ message: "A toggle at exactly the order time was ignored. The rule is toggled_at <= placed_at.", rows: solve({ strict: true }) });
    diagnostics.push({ message: "Two toggles at the same instant were broken by the lower toggle_id. The higher toggle_id is the later one and wins.", rows: solve({ tieLow: true }) });
    diagnostics.push({ message: "A toggle at another store was applied. A store-level toggle applies to its own store only.", rows: solve({ anyStore: true }) });
  }
  if (level === 3) diagnostics.push({ message: "Merchant-wide toggles (store_id IS NULL) were ignored. They apply to every store of that merchant, and the latest toggle of either scope wins.", rows: solve({ noMerchant: true }) });

  const sCols = ["store_id", "merchant_id"];
  const sRows = stores.map((s) => [s.id, s.merchant]);
  const tCols = ["toggle_id", "merchant_id", "store_id", "item_id", "is_available", "toggled_at"];
  const tRows = toggles.slice().sort((a, b) => a.id - b.id).map((t) => [t.id, t.merchant, t.store, t.item, t.avail, fmt(t.at)]);
  const oCols = ["order_id", "store_id", "placed_at"];
  const oRows = orders.slice().sort((a, b) => cmp(a.id, b.id)).map((o) => [o.id, o.store.id, fmt(o.at)]);
  const iCols = ["order_id", "item_id", "quantity"];
  const iRows = [];
  for (const o of orders.slice().sort((a, b) => cmp(a.id, b.id))) for (const it of o.items.slice().sort()) iRows.push([o.id, it, r.int(1, 3)]);
  const setup =
    "SET TIME ZONE 'UTC';\n" +
    "CREATE TABLE stores (\n  store_id TEXT PRIMARY KEY,\n  merchant_id TEXT NOT NULL\n);\n" +
    "CREATE TABLE availability_toggles (\n  toggle_id BIGINT PRIMARY KEY,  -- of two toggles at the same instant, the higher id was recorded later\n  merchant_id TEXT NOT NULL,\n  store_id TEXT,                 -- NULL: applies to every store of the merchant\n  item_id TEXT NOT NULL,\n  is_available BOOLEAN NOT NULL,\n  toggled_at TIMESTAMPTZ NOT NULL\n);\n" +
    "CREATE TABLE orders (\n  order_id TEXT PRIMARY KEY,\n  store_id TEXT NOT NULL REFERENCES stores(store_id),\n  placed_at TIMESTAMPTZ NOT NULL\n);\n" +
    "CREATE TABLE order_items (\n  order_id TEXT NOT NULL REFERENCES orders(order_id),\n  item_id TEXT NOT NULL,\n  quantity INT NOT NULL,\n  PRIMARY KEY (order_id, item_id)\n);\n" +
    insertSQL("stores", sCols, sRows) + insertSQL("availability_toggles", tCols, tRows) + insertSQL("orders", oCols, oRows) + insertSQL("order_items", iCols, iRows);

  return {
    vars: {
      orders: orders.length,
      toggles: toggles.length,
      scope_rule: level === 3
        ? "A toggle with `store_id` NULL is merchant-wide: it applies to every store of that `merchant_id`. A store's item state is the latest toggle of either scope (its own store's, or its merchant's merchant-wide ones)."
        : "Every toggle in this sample names one store, and applies to that store only.",
    },
    setup,
    tables: [
      { name: "stores", columns: sCols, rows: sRows },
      { name: "availability_toggles", columns: tCols, rows: tRows },
      { name: "orders", columns: oCols, rows: oRows },
      { name: "order_items", columns: iCols, rows: iRows },
    ],
    expected: { columns: ["store_id", "order_date", "orders", "flagged_orders", "flagged_lines"], rows },
    diagnostics: diagnostics.filter((d) => JSON.stringify(d.rows) !== JSON.stringify(rows)),
  };
}
