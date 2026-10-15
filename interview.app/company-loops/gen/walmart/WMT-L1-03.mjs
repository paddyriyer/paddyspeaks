/* WMT-L1-03 — Phantom inventory suspects: stock on hand, no sales for 3 days, normally sells daily (SQL).
   Simulated practice scenario. All data is generated from the seed; the suspect rule is this
   exercise's rule, not any retailer's.

   Contract: see docs/COMPANY-INTERVIEW-LOOPS.md § Executable templates (sql).
   level: 1 Medium (one sales row per selling day; a snapshot every day; calendar days)
          2 Hard (+ days with only returns (negative units) or a zero row, which are not sales;
                  missing snapshots, which are not "stock on hand")
          3 Very Hard (+ several sales rows per day that must be netted, and store closure days that are
                  skipped: the windows are counted in the store's open days) */
import { insertSQL } from "../../js/rng.js";

export const kind = "sql";

const BASE = Date.UTC(2026, 7, 1);   // day 0 = 2026-08-01
const dayStr = (d) => new Date(BASE + d * 86400000).toISOString().slice(0, 10);

export function generate(r, level) {
  const N = r.pick([7, 10, 14]);                 // baseline open days
  const K = N - r.int(1, 2);                     // must have sold on at least K of them
  const asOf = r.int(40, 50);                    // as-of day index
  const first = asOf - (N + 3) - 6;              // data starts here (room for closures and the day before the baseline)
  const storeIds = r.sample(["store_0412", "store_1187", "store_2045", "store_2930", "store_3374", "store_4418"], level === 1 ? 2 : 3).sort();
  const itemIds = r.sample(["itm_bananas", "itm_bread", "itm_eggs", "itm_milk", "itm_razors", "itm_batteries", "itm_detergent", "itm_yogurt"], 4).sort();

  // Store closures (Very Hard): 1-2 closed days per store, one inside the check window for one store.
  const closed = new Map(storeIds.map((s) => [s, new Set()]));
  if (level === 3) {
    storeIds.forEach((s, i) => {
      if (i === 0) closed.get(s).add(asOf - r.int(0, 2));
      const c = r.int(1, 2);
      for (let k = 0; k < c; k++) closed.get(s).add(asOf - r.int(3, N + 3));
    });
  }
  const openDays = (s) => { const xs = []; for (let d = asOf; d >= first; d--) if (!closed.get(s).has(d)) xs.push(d); return xs; };   // newest first

  const sales = [];      // {store, item, day, units}
  const snaps = new Map();   // store|item|day -> on_hand (missing = no row)
  const kinds = ["suspect", "suspect", "soldout", "slow", "normal", "normal"];
  if (level >= 2) kinds.push("return_only", "missing_snap", "zero_row");
  if (level === 3) kinds.push("netted");
  const plan = [];
  for (const s of storeIds) for (const it of itemIds) plan.push([s, it, r.pick(kinds)]);
  // Every level: one exact-K suspect, and one item that sold on K-1 baseline days plus the day before the baseline.
  plan[0][2] = "suspect_exact";
  plan[plan.length - 1][2] = "slow_edge";
  if (level >= 2) plan[1][2] = "return_only";
  if (level >= 2) plan[2][2] = "missing_snap";
  if (level === 3) plan[3][2] = "netted";

  for (const [s, it, kind] of plan) {
    const od = openDays(s);
    const check = od.slice(0, 3), base = od.slice(3, 3 + N), before = od[3 + N];
    const sell = (d, units) => sales.push({ s, it, d, units });
    // Baseline selling days.
    let sellDays;
    if (kind === "slow" || kind === "slow_edge") sellDays = r.sample(base, K - 1);
    else if (kind === "suspect_exact") sellDays = r.sample(base, K);
    else sellDays = r.sample(base, r.int(K, N));
    for (const d of sellDays) {
      if (level === 3 && r.chance(0.3)) { const u = r.int(2, 6); sell(d, u - 1); sell(d, 1); }   // two lanes
      else sell(d, r.int(1, 9));
    }
    if (kind === "slow_edge") sell(before, r.int(1, 6));
    // Check window.
    const quiet = kind !== "normal";
    if (!quiet) sell(r.pick(check), r.int(1, 4));
    if (kind === "return_only") sell(r.pick(check), -r.int(1, 2));
    if (kind === "zero_row") sell(r.pick(check), 0);
    if (kind === "netted") { const d = r.pick(check), u = r.int(1, 3); sell(d, u); sell(d, -u); }
    // Older days before the baseline: some noise.
    for (let d = first; d < (before ?? first); d++) if (!closed.get(s).has(d) && r.chance(0.5)) sell(d, r.int(1, 5));
    // End-of-day snapshots for the last 7 calendar days (including closed days, which carry the count).
    let oh = r.int(4, 30);
    for (let d = asOf - 6; d <= asOf; d++) {
      let v = oh;
      if (kind === "soldout" && d === r.pick(check)) v = 0;
      snaps.set(`${s}|${it}|${d}`, v);
    }
    if (kind === "soldout" && check.every((d) => snaps.get(`${s}|${it}|${d}`) > 0)) snaps.set(`${s}|${it}|${check[1]}`, 0);
    if (kind === "missing_snap") snaps.delete(`${s}|${it}|${r.pick(check)}`);
  }

  const cmp = (x, y) => (x < y ? -1 : x > y ? 1 : 0);
  const solve = (o = {}) => {
    const out = [];
    for (const s of storeIds) {
      const od = o.calendar ? Array.from({ length: asOf - first + 1 }, (_, i) => asOf - i) : openDays(s);
      const check = od.slice(0, 3), base = od.slice(3, 3 + N + (o.longBase ? 1 : 0));
      for (const it of itemIds) {
        const net = (d) => sales.filter((x) => x.s === s && x.it === it && x.d === d).reduce((a, x) => a + x.units, 0);
        const anyPos = (d) => sales.some((x) => x.s === s && x.it === it && x.d === d && x.units > 0);
        const anyRow = (d) => sales.some((x) => x.s === s && x.it === it && x.d === d);
        const sold = (d) => (o.anyRow ? anyRow(d) : o.anyPos ? anyPos(d) : net(d) > 0);
        const okStock = check.every((d) => {
          const v = snaps.get(`${s}|${it}|${d}`);
          return v === undefined ? !!o.missingOk : v > 0;
        });
        if (!okStock || check.some(sold)) continue;
        const daysSold = base.filter(sold).length;
        if (o.strictK ? daysSold <= K : daysSold < K) continue;
        const units = base.reduce((a, d) => a + net(d), 0);
        const last = snaps.get(`${s}|${it}|${check[0]}`);
        out.push([s, it, daysSold, units, last === undefined ? null : last]);
      }
    }
    return out.sort((a, b) => cmp(a[0], b[0]) || cmp(a[1], b[1]));
  };
  const rows = solve();
  const diagnostics = [
    { message: `The baseline window took ${N + 1} days. It is the ${N} days immediately before the 3-day check window.`, rows: solve({ longBase: true }) },
    { message: `An item had to sell on more than ${K} baseline days. "At least ${K}" includes exactly ${K}.`, rows: solve({ strictK: true }) },
  ];
  if (level >= 2) {
    diagnostics.push({ message: "A day with any sales row (even a return or a zero row) was treated as a sale. A day counts as sold only when its net units are above 0.", rows: solve({ anyRow: true }) });
    diagnostics.push({ message: "A missing snapshot was treated as stock on hand. Without a snapshot the stock is unknown, so the store-item is not a suspect.", rows: solve({ missingOk: true }) });
  }
  if (level === 3) {
    diagnostics.push({ message: "Calendar days were used. Closed days are skipped: the windows are the store's last open days.", rows: solve({ calendar: true }) });
    diagnostics.push({ message: "A day with any positive row counted as sold. Rows of one day are netted first: +2 and −2 is no sale.", rows: solve({ anyPos: true }) });
  }

  const sCols = ["sale_id", "store_id", "item_id", "biz_date", "units"];
  let sid = r.int(100000, 800000);
  const sRows = sales.slice().sort((a, b) => a.d - b.d || cmp(a.s, b.s) || cmp(a.it, b.it)).map((x) => [sid += r.int(1, 13), x.s, x.it, dayStr(x.d), x.units]);
  const iCols = ["store_id", "item_id", "biz_date", "on_hand"];
  const iRows = [...snaps.entries()].map(([k, v]) => { const [s, it, d] = k.split("|"); return [s, it, Number(d), v]; })
    .sort((a, b) => cmp(a[0], b[0]) || cmp(a[1], b[1]) || a[2] - b[2]).map(([s, it, d, v]) => [s, it, dayStr(d), v]);
  const cCols = ["store_id", "biz_date"];
  const cRows = [];
  for (const s of storeIds) for (const d of [...closed.get(s)].sort((a, b) => a - b)) cRows.push([s, dayStr(d)]);
  const setup =
    "SET TIME ZONE 'UTC';\n" +
    "CREATE TABLE sales (\n  sale_id BIGINT PRIMARY KEY,\n  store_id TEXT NOT NULL,\n  item_id TEXT NOT NULL,\n  biz_date DATE NOT NULL,\n  units INT NOT NULL\n);\n" +
    "CREATE TABLE inventory_snapshots (\n  store_id TEXT NOT NULL,\n  item_id TEXT NOT NULL,\n  biz_date DATE NOT NULL,\n  on_hand INT NOT NULL,\n  PRIMARY KEY (store_id, item_id, biz_date)\n);\n" +
    "CREATE TABLE store_closures (\n  store_id TEXT NOT NULL,\n  biz_date DATE NOT NULL,\n  PRIMARY KEY (store_id, biz_date)\n);\n" +
    insertSQL("sales", sCols, sRows) + insertSQL("inventory_snapshots", iCols, iRows) + insertSQL("store_closures", cCols, cRows);

  return {
    vars: {
      as_of: dayStr(asOf),
      baseline_days: N,
      min_days: K,
      first_day: dayStr(first),
      sales_rule: level === 1
        ? "In this sample a store-item has at most one `sales` row per day, always with positive units, and a snapshot for every one of the last 7 days."
        : level === 2
          ? "A day's `units` can be 0 or negative (a net return): a day counts as sold only when its units are above 0. Some snapshots are missing: a missing snapshot is not stock on hand."
          : "A day can have several `sales` rows (one per register lane, returns negative): net them per day, and the day counts as sold only when the net is above 0. Some snapshots are missing: a missing snapshot is not stock on hand.",
      closure_rule: level === 3
        ? "Stores close on some days (`store_closures`). Closed days are skipped entirely: the check window is the store's last 3 open days up to the as-of date, and the baseline the " + N + " open days before those."
        : "`store_closures` is empty in this sample, so open days are calendar days; keep the query correct if it were not.",
    },
    setup,
    tables: [
      { name: "sales", columns: sCols, rows: sRows },
      { name: "inventory_snapshots", columns: iCols, rows: iRows },
      { name: "store_closures", columns: cCols, rows: cRows },
    ],
    expected: { columns: ["store_id", "item_id", "baseline_days_sold", "baseline_units", "on_hand"], rows },
    diagnostics: diagnostics.filter((d) => JSON.stringify(d.rows) !== JSON.stringify(rows)),
  };
}
