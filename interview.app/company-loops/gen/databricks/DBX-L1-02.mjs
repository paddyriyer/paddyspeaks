/* DBX-L1-02 — Table freshness against upstream tables along a lineage graph (SQL).
   Simulated practice scenario. All data is generated from the seed. Which operations
   count as a data change is this exercise's rule, stated in the problem.

   Contract: see docs/COMPANY-INTERVIEW-LOOPS.md § Executable templates (sql).
   level: 1 Medium (a forest of bronze -> silver -> gold chains; OPTIMIZE/VACUUM after the
                    last write; recursion needed for indirect ancestors)
          2 Hard (+ several upstreams per table and diamonds, commits after the as-of time,
                  two newer ancestors tied on their last change)
          3 Very Hard (+ views in the lineage, which have no commits and are not reported
                  but pass dependencies through; a deeper graph; an ancestor that changed
                  at exactly the same instant as its descendant) */
import { insertSQL } from "../../js/rng.js";

export const kind = "sql";

const BRONZE = ["bronze.orders_raw", "bronze.clicks_raw", "bronze.customers_raw", "bronze.payments_raw", "bronze.devices_raw"];
const SILVER = ["silver.orders", "silver.sessions", "silver.customers", "silver.payments", "silver.devices"];
const GOLD = ["gold.daily_revenue", "gold.customer_ltv", "gold.funnel_daily", "gold.payment_health"];
const ML = ["ml.churn_features", "ml.ltv_training_set"];
const AS_OF = [[2026, 9, 22, 9], [2026, 9, 29, 7], [2026, 10, 6, 12], [2026, 10, 13, 8]];
const DATA_OPS = ["WRITE", "MERGE", "UPDATE", "DELETE", "STREAMING UPDATE"];

export function generate(r, level) {
  const [Y, M, D, H] = r.pick(AS_OF);
  const asOfMs = Date.UTC(Y, M - 1, D, H);
  const tsStr = (sec) => new Date(asOfMs + sec * 1000).toISOString().replace("T", " ").replace(".000Z", "+00");   // sec relative to as_of

  // ---- the graph ---------------------------------------------------------------
  const nB = level === 1 ? 3 : 3 + (level === 3 ? 1 : r.int(0, 1));
  const bronze = r.sample(BRONZE, nB).sort();
  const silver = r.sample(SILVER, nB).sort();
  const gold = r.sample(GOLD, level === 1 ? 2 : 3).sort();
  const ml = level === 3 ? r.sample(ML, 1) : [];
  const edges = [];                         // [downstream, upstream]
  const views = [];
  if (level === 1) {
    silver.forEach((s, i) => edges.push([s, bronze[i]]));
    const sp = r.shuffle(silver);
    gold.forEach((g, i) => edges.push([g, sp[i]]));
  } else {
    silver.forEach((s, i) => {
      edges.push([s, bronze[i]]);
      if (r.chance(0.4)) edges.push([s, bronze[(i + 1) % bronze.length]]);
    });
    gold.forEach((g, i) => {
      const ups = r.sample(silver, r.int(1, 2));
      for (const u of ups) edges.push([g, u]);
      if (i === 0) {                        // a diamond: a bronze table reached directly and through a silver one
        const viaS = ups[0];
        const b = edges.find((e) => e[0] === viaS)[1];
        edges.push([g, b]);
      }
    });
  }
  if (level === 3) {
    // Views: gold.x reads silver.y through a view; ml reads gold through a view.
    const v1 = silver[0].replace("silver.", "silver.") + "_v";
    views.push(v1);
    edges.push([v1, silver[0]]);
    edges.push([gold[gold.length - 1], v1]);
    const v2 = "gold.reporting_v";
    views.push(v2);
    edges.push([v2, gold[0]]);
    edges.push([v2, gold[1]]);
    edges.push([ml[0], v2]);
    edges.push([ml[0], silver[silver.length - 1]]);
  }
  // dedupe edges
  const seenE = new Set();
  const E = edges.filter(([d, u]) => { const k = d + ">" + u; if (seenE.has(k) || d === u) return false; seenE.add(k); return true; });
  const tables = [...bronze, ...silver, ...gold, ...ml].sort();
  const isView = new Set(views);

  // ---- last data change per table (seconds relative to as_of, negative = before) ----
  const last = new Map();
  for (const t of tables) last.set(t, -r.int(5, 1200) * 60 - r.int(0, 59));
  // Force some ties/equalities.
  if (level >= 2) {
    // Two ancestors of gold[0] newer than it and tied with each other.
    const g = gold[0];
    const ups = E.filter((e) => e[0] === g).map((e) => e[1]);
    if (ups.length >= 2) {
      const t = -r.int(5, 60) * 60;
      last.set(ups[0], t); last.set(ups[1], t);
      last.set(g, t - r.int(30, 400) * 60 - r.int(1, 59));
    }
  }
  if (level === 3) {
    // ml[0] changed at exactly the same instant as one of its ancestors (not newer).
    const s = silver[silver.length - 1];
    last.set(ml[0], last.get(s));
  }

  // ---- commits --------------------------------------------------------------------
  const commits = [];   // [table, version, sec, op]
  for (const t of tables) {
    const lc = last.get(t);
    const list = [];
    const create = lc - r.int(2, 40) * 3600 - r.int(0, 3599);
    list.push([create, "CREATE TABLE"]);
    let cur = create;
    const nMid = r.int(0, 3);
    for (let k = 0; k < nMid; k++) {
      cur = cur + r.int(60, Math.max(61, Math.floor((lc - cur) / (nMid - k + 1))));
      if (cur >= lc) break;
      list.push([cur, r.chance(0.25) ? "OPTIMIZE" : r.pick(DATA_OPS)]);
    }
    list.push([lc, r.pick(DATA_OPS)]);
    // Maintenance after the last data change, before as_of.
    if (r.chance(level === 1 ? 0.5 : 0.6) && lc < -120) {
      const t2 = lc + r.int(60, Math.min(-60 - lc, 7200));
      list.push([t2, r.chance(0.6) ? "OPTIMIZE" : "VACUUM"]);
    }
    if (level >= 2 && r.chance(0.35)) list.push([r.int(1, 5400), r.pick(DATA_OPS)]);   // after as_of
    list.sort((a, b) => a[0] - b[0]);
    list.forEach(([sec, op], v) => commits.push([t, v, sec, op]));
  }
  // Make sure each trap is present at least once.
  const force = (pred, add) => { if (!commits.some(pred)) add(); };
  const bump = (t, sec, op) => { const v = commits.filter((c) => c[0] === t).length; commits.push([t, v, sec, op]); };
  force((c) => (c[3] === "OPTIMIZE" || c[3] === "VACUUM") && c[2] > last.get(c[0]) && c[2] <= 0,
    () => { const t = r.pick(tables); bump(t, last.get(t) + r.int(1, Math.max(1, -last.get(t) - 1)), "OPTIMIZE"); });
  if (level >= 2) force((c) => c[2] > 0 && DATA_OPS.includes(c[3]), () => { const t = r.pick(gold.concat(silver)); bump(t, r.int(1, 3600), "MERGE"); });

  // ---- the oracle ---------------------------------------------------------------------
  const ups = new Map();
  for (const [d, u] of E) { if (!ups.has(d)) ups.set(d, []); ups.get(d).push(u); }
  const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
  const solve = (o = {}) => {
    const lastOf = new Map();
    for (const [t, , sec, op] of commits) {
      if (!o.afterAsOf && sec > 0) continue;
      if (!o.maintenance && !DATA_OPS.includes(op) && op !== "CREATE TABLE") continue;
      if (!lastOf.has(t) || sec > lastOf.get(t)) lastOf.set(t, sec);
    }
    const out = [];
    for (const t of tables) {
      // Ancestors.
      const anc = [];
      if (o.directOnly) anc.push(...(ups.get(t) || []).filter((u) => !isView.has(u)));
      else {
        const seen = new Set();
        const stack = [...(ups.get(t) || [])];
        while (stack.length) {
          const u = stack.pop();
          if (o.multi) { if (!isView.has(u)) anc.push(u); }
          else if (seen.has(u)) continue;
          seen.add(u);
          if (o.stopAtViews && isView.has(u)) continue;
          if (!o.multi && !isView.has(u)) anc.push(u);
          stack.push(...(ups.get(u) || []));
        }
      }
      const lc = lastOf.get(t);
      const newer = anc.filter((u) => (o.geq ? lastOf.get(u) >= lc : lastOf.get(u) > lc));
      let best = null;
      for (const u of newer) if (best === null || lastOf.get(u) > lastOf.get(best) || (lastOf.get(u) === lastOf.get(best) && u < best)) best = u;
      const lag = best === null ? 0 : Math.floor((lastOf.get(best) - lc) / 60);
      out.push([t, tsStr(lc), Math.floor((0 - lc) / 60), anc.length, newer.length, lag, best]);
    }
    return out.sort((a, b) => cmp(a[0], b[0]));
  };
  const rows = solve();
  const diagnostics = [
    { message: "OPTIMIZE or VACUUM commits were counted as data changes. They rewrite or delete files but do not change the table's data.", rows: solve({ maintenance: true }) },
    { message: "Only direct upstreams were compared. Freshness is against every ancestor along the lineage, which needs a recursive walk.", rows: solve({ directOnly: true }) },
  ];
  if (level >= 2) {
    diagnostics.push({ message: "Commits after the as-of time were included. The report describes the tables as they were at as_of.", rows: solve({ afterAsOf: true }) });
    diagnostics.push({ message: "An ancestor reached by two paths was counted twice. Count distinct ancestors (UNION, not UNION ALL, in the recursion).", rows: solve({ multi: true }) });
  }
  if (level === 3) {
    diagnostics.push({ message: "The walk stopped at views. A view has no commits and is not reported, but the dependency passes through it to the tables it reads.", rows: solve({ stopAtViews: true }) });
    diagnostics.push({ message: "An ancestor that changed at the same instant was counted as newer. Newer means strictly later.", rows: solve({ geq: true }) });
  }

  const oCols = ["object_name", "object_type"];
  const oRows = [...tables.map((t) => [t, "TABLE"]), ...views.map((v) => [v, "VIEW"])].sort((a, b) => cmp(a[0], b[0]));
  const lCols = ["downstream", "upstream"];
  const lRows = E.slice().sort((a, b) => cmp(a[0], b[0]) || cmp(a[1], b[1]));
  const cCols = ["table_name", "version", "commit_ts", "operation"];
  const cRows = commits.slice().sort((a, b) => cmp(a[0], b[0]) || a[1] - b[1]).map(([t, v, sec, op]) => [t, v, tsStr(sec), op]);
  // Versions must be in timestamp order per table (bump() appends): re-number them.
  const byT = new Map();
  for (const row of cRows) { if (!byT.has(row[0])) byT.set(row[0], []); byT.get(row[0]).push(row); }
  const cOut = [];
  for (const [, list] of [...byT.entries()].sort((a, b) => cmp(a[0], b[0]))) {
    list.sort((a, b) => cmp(a[2], b[2]));
    list.forEach((row, i) => cOut.push([row[0], i, row[2], row[3]]));
  }
  const setup =
    "SET TIME ZONE 'UTC';\n" +
    "CREATE TABLE catalog_objects (\n  object_name TEXT PRIMARY KEY,\n  object_type TEXT NOT NULL      -- TABLE | VIEW\n);\n" +
    "CREATE TABLE lineage (\n  downstream TEXT NOT NULL,\n  upstream TEXT NOT NULL,\n  PRIMARY KEY (downstream, upstream)\n);\n" +
    "CREATE TABLE table_commits (\n  table_name TEXT NOT NULL,\n  version BIGINT NOT NULL,\n  commit_ts TIMESTAMPTZ NOT NULL,\n  operation TEXT NOT NULL,\n  PRIMARY KEY (table_name, version)\n);\n" +
    insertSQL("catalog_objects", oCols, oRows) + insertSQL("lineage", lCols, lRows) + insertSQL("table_commits", cCols, cOut);

  return {
    vars: {
      as_of: tsStr(0),
      objects: oRows.length,
      view_rule: level === 3
        ? "Some lineage nodes are views (`object_type = 'VIEW'`). A view has no commits and gets no row, and it is not counted as an ancestor, but dependencies pass through it: a table that reads a view depends on everything the view reads."
        : "Every object in this sample is a table.",
    },
    setup,
    tables: [
      { name: "catalog_objects", columns: oCols, rows: oRows },
      { name: "lineage", columns: lCols, rows: lRows },
      { name: "table_commits", columns: cCols, rows: cOut },
    ],
    expected: { columns: ["table_name", "last_change", "staleness_minutes", "ancestors", "newer_ancestors", "lag_minutes", "newest_ancestor"], rows },
    diagnostics: diagnostics.filter((d) => JSON.stringify(d.rows) !== JSON.stringify(rows)),
  };
}
