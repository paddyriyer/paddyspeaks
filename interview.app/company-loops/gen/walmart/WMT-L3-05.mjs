/* WMT-L3-05 — Rollback lift: units per store-day during each rollback versus the four weeks
   before, out-of-stock store-days excluded (SQL).
   Simulated practice scenario. All stores, items, dates and units are generated from the seed
   and are hypothetical; the rollback and out-of-stock rules are this exercise's rules.

   One row per rollback, ordered by rollback_id:
     rollback_store_days            counted store-days in [start_date, end_date]
     rollback_units_per_store_day   units on those store-days / their number, ROUND 2
     baseline_store_days            counted store-days in [start_date - 28, start_date - 1]
     baseline_units_per_store_day   likewise (NULL when there are none), ROUND 2
     lift_pct                       100 * (rollback rate / baseline rate - 1) from the unrounded
                                    rates, ROUND 1; NULL when the baseline rate is 0 or NULL.
   A store-day (store, date) counts when the store is in the rollback's region, the date is on or
   after the store's opened_on, the item is not out of stock there that day (its units are left
   out too), and, for the baseline only, the date is not inside another rollback of the same item
   in the same region.
   level: 1 Medium (one region, a sales row for every store-day incl. zeros, out-of-stock days
                    with units, window boundaries)
          2 Hard (+ two regions, sales rows only for days with sales, a seasonal item whose
                  baseline sold nothing)
          3 Very Hard (+ a store that opened inside a window, an earlier rollback of the same item
                       inside a later rollback's baseline, and one in another region that must not
                       be excluded) */
import { insertSQL, pad2 } from "../../js/rng.js";

export const kind = "sql";

const BASE = Date.UTC(2026, 4, 4) / 1000;                       // 2026-05-04 (a Monday)
const REGIONS = ["central", "gulf_coast", "mountain", "northeast", "pacific", "southeast"];
const ITEMS = ["ground_coffee_1kg", "paper_towels_12", "laundry_pods_60", "dog_food_15kg", "bath_towel_set", "cereal_family", "crayons_24", "storage_bin_40l"];
const SEASONAL = ["pool_noodle", "hot_cocoa_mix", "sunscreen_spf50", "beach_towel"];

function day(base, i) {
  const d = new Date((base + i * 86400) * 1000);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

/* Round p/q (q > 0) to `dec` decimals, half away from zero, as PostgreSQL rounds numeric. */
function roundRat(p, q, dec) {
  const f = 10 ** dec, s = p < 0 ? -1 : 1, a = Math.abs(p);
  return (s * Math.floor((2 * a * f + q) / (2 * q))) / f;
}
/* Is p/q exactly halfway between two values at `dec` decimals? */
function isHalf(p, q, dec) {
  const t = 2 * Math.abs(p) * 10 ** dec;
  return t % q === 0 && (t / q) % 2 === 1;
}

export function generate(r, level) {
  const base = BASE + r.int(0, 3) * 7 * 86400;
  const regs = r.sample(REGIONS, level === 1 ? 1 : 2);
  const [R1, R2] = regs;
  const itemNames = r.shuffle(ITEMS);
  const seasonal = r.pick(SEASONAL);

  // Stores. opened is a day index; long before the data at levels 1-2.
  const stores = [];
  let sid = 1000 + r.int(0, 3000);
  const addStore = (region, opened) => {
    stores.push({ id: "store_" + (sid += r.int(3, 97)), region, opened, openedOn: null });
    return stores[stores.length - 1];
  };

  // Rollbacks: { item, region, s, e } with s/e day indexes (inclusive).
  const rbs = [];
  const len = () => r.int(5, level === 1 ? 8 : 9);
  let zeroBase = null;                                    // the seasonal rollback (levels 2-3)
  let opener = null;                                      // the store that opened mid-data (level 3)
  if (level === 1) {
    for (let k = 0; k < 3; k++) addStore(R1, -1);
    for (let k = 0; k < 2; k++) {
      const s = 30 + r.int(0, 6), e = s + len() - 1;
      rbs.push({ item: itemNames[k], region: R1, s, e });
    }
  } else if (level === 2) {
    for (let k = 0; k < 2; k++) addStore(R1, -1);
    for (let k = 0; k < 2; k++) addStore(R2, -1);
    if (r.chance(0.5)) addStore(r.pick(regs), -1);
    const sA = 30 + r.int(0, 6), sB = 30 + r.int(0, 8), sC = 30 + r.int(0, 8);
    rbs.push({ item: itemNames[0], region: R1, s: sA, e: sA + len() - 1 });
    rbs.push({ item: itemNames[1], region: R2, s: sB, e: sB + len() - 1 });
    zeroBase = { item: seasonal, region: r.pick(regs), s: sC, e: sC + len() - 1 };
    rbs.push(zeroBase);
  } else {
    for (let k = 0; k < 2; k++) addStore(R1, -1);
    for (let k = 0; k < 2; k++) addStore(R2, -1);
    const sA = 30 + r.int(0, 3), eA = sA + len() - 1;
    const gap = r.int(9, 14);
    const sA2 = eA + gap + 1, eA2 = sA2 + len() - 1;
    const sB = eA + 2 + r.int(0, 1), eB = Math.min(sB + r.int(3, 5) - 1, sA2 - 2);
    rbs.push({ item: itemNames[0], region: R1, s: sA, e: eA });
    rbs.push({ item: itemNames[0], region: R1, s: sA2, e: eA2 });
    rbs.push({ item: itemNames[0], region: R2, s: sB, e: eB });
    const sC = 30 + r.int(0, 20);
    zeroBase = { item: seasonal, region: r.pick(regs), s: sC, e: sC + len() - 1 };
    rbs.push(zeroBase);
    opener = addStore(R1, sA2 - r.int(6, 20));          // opened inside the later rollback's baseline
  }
  const D = Math.max(...rbs.map((x) => x.e)) + 3;          // data days 0 .. D-1
  const items = [...new Set(rbs.map((x) => x.item))];

  // Opening dates: inside the data for the opener, otherwise years earlier.
  for (const st of stores) {
    if (st.opened >= 0) st.openedOn = day(base, st.opened);
    else st.openedOn = `${2012 + r.int(0, 12)}-${pad2(r.int(1, 12))}-${pad2(r.int(1, 28))}`;
    if (st.opened < 0) st.opened = -100000;
  }

  const inRollback = (item, region, d) => rbs.some((x) => x.item === item && x.region === region && d >= x.s && d <= x.e);
  const key = (st, it, d) => st + "|" + it + "|" + d;

  // Sales and out-of-stock days.
  const sales = new Map();          // key -> units (level 1: every open store-day has a row)
  const oos = new Set();
  for (const st of stores) {
    for (const it of items) {
      const rate = r.int(1, 4);
      for (let d = 0; d < D; d++) {
        if (d < st.opened) continue;
        const rb = inRollback(it, st.region, d);
        let u = 0;
        if (it === seasonal) {
          const quiet = st.region === zeroBase.region && d >= zeroBase.s - 28 && d < zeroBase.s;
          if (!quiet && r.chance(rb ? 0.8 : 0.25)) u = r.int(1, rb ? 5 : 2);
        } else if (r.chance(rb ? 0.7 : 0.55)) {
          u = rb ? r.int(1, rate + 2) : r.int(1, rate + 1);
        }
        if (u > 0 || level === 1) sales.set(key(st.id, it, d), u);
        if (r.chance(0.04)) oos.add(key(st.id, it, d));
      }
    }
  }

  // Forced edge cases around the first rollback (and the second at level 3).
  const setUnits = (st, it, d, u) => sales.set(key(st.id, it, d), u);
  const forced = level === 3 ? [rbs[0], rbs[1]] : [rbs[0], rbs[1]];
  for (const rb of forced) {
    const scope = stores.filter((st) => st.region === rb.region && st.opened < 0);
    const st = r.pick(scope);
    setUnits(st, rb.item, rb.s - 29, r.int(4, 9));                     // the day before the baseline
    setUnits(st, rb.item, rb.e + 1, r.int(4, 9));                      // the day after the rollback
    setUnits(st, rb.item, rb.s - 28, r.int(1, 3));                     // the first baseline day
    setUnits(st, rb.item, rb.e, r.int(2, 6));                          // the last rollback day
    for (const k of [rb.s - 28, rb.s - 29, rb.e, rb.e + 1]) oos.delete(key(st.id, rb.item, k));
    const st2 = r.pick(scope);
    const dIn = r.int(rb.s, rb.e), dBase = r.int(rb.s - 27, rb.s - 1);
    oos.add(key(st2.id, rb.item, dIn)); setUnits(st2, rb.item, dIn, r.int(1, 3));    // sold out mid-day
    oos.add(key(st2.id, rb.item, dBase)); setUnits(st2, rb.item, dBase, r.int(1, 2));
  }
  if (level === 3) {                                                   // the opener sells from day one
    setUnits(opener, rbs[1].item, opener.opened, r.int(1, 3));
    oos.delete(key(opener.id, rbs[1].item, opener.opened));
  }

  // The oracle. opts break one rule each, for diagnostics.
  const ordered = rbs.map((x, i) => ({ x, i })).sort((a, b) => a.x.s - b.x.s || a.i - b.i).map((o) => o.x);
  let rid = 200 + r.int(0, 600);
  for (const x of ordered) x.id = "rb_" + (rid += r.int(1, 9));
  const tally = (rb, from, to, baseline, opts) => {
    let days = 0, units = 0;
    for (const st of stores) {
      if (!opts.regionIgnored && st.region !== rb.region) continue;
      for (let d = from; d <= to; d++) {
        if (!opts.preOpen && d < st.opened) continue;
        const k = key(st.id, rb.item, d);
        const u = sales.get(k);
        if (opts.zeroDropped && u === undefined) continue;
        if (oos.has(k) && !opts.oosIgnored) {
          if (opts.oosUnitsKept) units += u || 0;
          continue;
        }
        if (baseline && !opts.keepPrior && rbs.some((o) => o !== rb && o.item === rb.item &&
            (opts.priorAnyRegion || o.region === st.region) && d >= o.s && d <= o.e)) continue;
        days++;
        units += u || 0;
      }
    }
    return { days, units };
  };
  const raw = (opts = {}) => ordered.map((rb) => {
    const ro = tally(rb, rb.s, opts.endExclusive ? rb.e - 1 : rb.e, false, opts);
    const b = tally(rb, rb.s - 28, opts.baselineInclStart ? rb.s : rb.s - 1, true, opts);
    return { rb, ro, b };
  });
  const compute = (opts = {}) => raw(opts).map(({ rb, ro, b }) => [
    rb.id, rb.item, ro.days,
    ro.days ? roundRat(ro.units, ro.days, 2) : null,
    b.days,
    b.days ? roundRat(b.units, b.days, 2) : null,
    b.days && b.units && ro.days ? roundRat(100 * ro.units * b.days - 100 * ro.days * b.units, ro.days * b.units, 1) : null,
  ]);

  // Keep lift_pct away from an exact half at 1 decimal, so equivalent formulas cannot round apart.
  for (let guard = 0; guard < 60; guard++) {
    const bad = raw().find(({ ro, b }) => b.units && isHalf(100 * ro.units * b.days - 100 * ro.days * b.units, ro.days * b.units, 1));
    if (!bad) break;
    const rb = bad.rb;
    const cand = stores.filter((st) => st.region === rb.region && st.opened <= rb.s);
    const st = cand[guard % cand.length];
    for (let d = rb.s; d <= rb.e; d++) {
      const k = key(st.id, rb.item, d);
      if (oos.has(k)) continue;
      sales.set(k, (sales.get(k) || 0) + 1);
      break;
    }
  }
  const expected = compute();

  const diagnostics = [
    { message: "Units sold on out-of-stock store-days were kept while those days were dropped from the count. An out-of-stock store-day is left out entirely: its units too, even if some sold before the shelf emptied.", rows: compute({ oosUnitsKept: true }) },
    { message: "Out-of-stock store-days were counted. A day the item was out of stock says nothing about demand at the rollback price; leave those store-days out of both the rollback and the baseline.", rows: compute({ oosIgnored: true }) },
    { message: "The baseline window included the rollback's first day. The baseline is the 28 days before start_date: start_date - 28 through start_date - 1.", rows: compute({ baselineInclStart: true }) },
    { message: "The rollback's end_date was treated as exclusive. The rollback runs from start_date through end_date inclusive.", rows: compute({ endExclusive: true }) },
  ];
  if (level >= 2) {
    diagnostics.push(
      { message: "Store-days with no sales row were not counted. A row exists only when something sold; an in-stock store-day with no row sold 0 units and still belongs in the denominator. Build the store-days from a calendar of the window and the stores in the region, then LEFT JOIN the sales.", rows: compute({ zeroDropped: true }) },
      { message: "Stores outside the rollback's region were counted. A rollback applies only to the stores in its region, for both windows.", rows: compute({ regionIgnored: true }) },
    );
  }
  if (level === 3) {
    diagnostics.push(
      { message: "Days before a store opened were counted as zero-sale store-days. A store counts only from its opened_on date.", rows: compute({ preOpen: true }) },
      { message: "The baseline kept days that fell inside an earlier rollback of the same item in the same region. Those days were not regular selling and are left out of the baseline.", rows: compute({ keepPrior: true }) },
      { message: "Another rollback's days were excluded from the baseline in every region. Only a rollback of the same item in the same region removes those days from a store's baseline.", rows: compute({ priorAnyRegion: true }) },
    );
  }

  // Tables.
  const sCols = ["store_id", "region", "opened_on"];
  const sRows = stores.map((st) => [st.id, st.region, st.openedOn]).sort((a, b) => (a[0] < b[0] ? -1 : 1));
  const rCols = ["rollback_id", "item_id", "region", "start_date", "end_date", "rollback_price_cents"];
  const rRows = ordered.map((x) => [x.id, x.item, x.region, day(base, x.s), day(base, x.e), r.int(97, 2497)]);
  const cmp = (a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : a[2] - b[2]);
  const fRows = [...sales.entries()].map(([k, u]) => { const [st, it, d] = k.split("|"); return [st, it, Number(d), u]; })
    .sort(cmp).map(([st, it, d, u]) => [st, it, day(base, d), u]);
  const oRows = [...oos].map((k) => { const [st, it, d] = k.split("|"); return [st, it, Number(d)]; })
    .filter(([st, , d]) => d >= 0 && d < D && d >= stores.find((x) => x.id === st).opened)
    .sort(cmp).map(([st, it, d]) => [st, it, day(base, d)]);
  const fCols = ["store_id", "item_id", "sale_date", "units"];
  const oCols = ["store_id", "item_id", "oos_date"];

  const setup =
    "SET TIME ZONE 'UTC';\n" +
    "CREATE TABLE stores (\n  store_id TEXT PRIMARY KEY,\n  region TEXT NOT NULL,\n  opened_on DATE NOT NULL\n);\n" +
    "CREATE TABLE rollbacks (\n  rollback_id TEXT PRIMARY KEY,\n  item_id TEXT NOT NULL,\n  region TEXT NOT NULL,\n  start_date DATE NOT NULL,\n  end_date DATE NOT NULL CHECK (end_date >= start_date),\n  rollback_price_cents INT NOT NULL\n);\n" +
    "CREATE TABLE store_item_sales (\n  store_id TEXT NOT NULL REFERENCES stores (store_id),\n  item_id TEXT NOT NULL,\n  sale_date DATE NOT NULL,\n  units INT NOT NULL CHECK (units >= 0),\n  PRIMARY KEY (store_id, item_id, sale_date)\n);\n" +
    "CREATE TABLE out_of_stock_days (\n  store_id TEXT NOT NULL REFERENCES stores (store_id),\n  item_id TEXT NOT NULL,\n  oos_date DATE NOT NULL,\n  PRIMARY KEY (store_id, item_id, oos_date)\n);\n" +
    insertSQL("stores", sCols, sRows) + insertSQL("rollbacks", rCols, rRows) +
    insertSQL("store_item_sales", fCols, fRows) + insertSQL("out_of_stock_days", oCols, oRows);

  return {
    vars: {
      first_day: day(base, 0),
      last_day: day(base, D - 1),
      regions: regs.map((x) => "`" + x + "`").join(level === 1 ? "" : " and "),
      sales_rows: fRows.length,
      rollback_count: rRows.length,
      region_rule: level === 1
        ? "In this sample every store, and so every rollback, is in region `" + R1 + "`."
        : "The sample has stores in two regions, " + regs.map((x) => "`" + x + "`").join(" and ") + "; a rollback covers only the stores in its own region.",
      rows_rule: level === 1
        ? "`store_item_sales` has a row for every store, item and date the store was open, with `units` 0 when nothing sold."
        : "`store_item_sales` has a row only when at least one unit sold: a store-day with no row sold 0 units, and it still counts if the item was in stock.",
      overlap_rule: level === 3
        ? "Baseline store-days that fall inside another rollback of the same item in the same region are left out as well: they were not regular selling days. Rollbacks of one item in one region never overlap each other."
        : "In this sample no rollback's baseline overlaps another rollback of the same item.",
    },
    setup,
    tables: [
      { name: "stores", columns: sCols, rows: sRows },
      { name: "rollbacks", columns: rCols, rows: rRows },
      { name: "store_item_sales", columns: fCols, rows: fRows },
      { name: "out_of_stock_days", columns: oCols, rows: oRows },
    ],
    expected: {
      columns: ["rollback_id", "item_id", "rollback_store_days", "rollback_units_per_store_day", "baseline_store_days", "baseline_units_per_store_day", "lift_pct"],
      rows: expected,
    },
    diagnostics: diagnostics.filter((d) => JSON.stringify(d.rows) !== JSON.stringify(expected)),
  };
}
