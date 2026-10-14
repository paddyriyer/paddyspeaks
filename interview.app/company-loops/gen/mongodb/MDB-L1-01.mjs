/* MDB-L1-01 — Index efficiency: query shapes that examine far more documents than they return (SQL).
   Simulated practice scenario. All data is generated from the seed; collections, query shapes,
   plans and counts are hypothetical. The profiler fields mirror what public documentation
   describes in general terms (docsExamined, keysExamined, nreturned, planSummary, queryHash);
   the rules here are this exercise's rules.

   Contract: see docs/COMPANY-INTERVIEW-LOOPS.md § Executable templates (sql).
   level: 1 Medium (one row per query; ratio of sums, not the average of ratios; strict k;
            inclusive minimum-executions floor; COLLSCAN executions counted)
          2 Hard (+ cursors continued by getMore rows: their work counts, but they are not
            executions; a shape that returned nothing; a plan that flips between index and
            collection scan)
          3 Very Hard (+ profiler rows shipped twice; the same queryHash in two collections) */
import { insertSQL, ts } from "../../js/rng.js";

export const kind = "sql";

const NAMESPACES = ["shop.orders", "shop.customers", "shop.carts", "catalog.products", "catalog.reviews",
  "events.clicks", "iot.readings", "app.sessions"];
const INDEXES = ["{ status: 1 }", "{ customerId: 1 }", "{ createdAt: -1 }", "{ sku: 1 }", "{ tenantId: 1, createdAt: -1 }",
  "{ deviceId: 1, ts: 1 }", "{ email: 1 }", "{ category: 1, price: 1 }"];
const HOSTS = ["rs0-a:27017", "rs0-b:27017", "rs0-c:27017"];
const DAY = "2026-10-06";
const HEX = "0123456789ABCDEF";

export function generate(r, level) {
  for (let attempt = 0; attempt < 50; attempt++) {
    const out = build(r, level);
    if (out) return out;
  }
  throw new Error("MDB-L1-01: could not build an instance");
}

function build(r, level) {
  const k = r.pick([10, 20, 25, 50]);
  const floor = r.int(3, 5);
  const usedHash = new Set();
  const hash = () => {
    for (;;) {
      let h = "";
      for (let i = 0; i < 8; i++) h += HEX[r.int(0, 15)];
      if (!usedHash.has(h)) { usedHash.add(h); return h; }
    }
  };
  const ops = [];                                   // one entry per profiled operation (before duplication)
  const opIds = Object.fromEntries(HOSTS.map((h) => [h, 1000 + r.int(0, 5000)]));
  let cursor = 74000000000 + r.int(0, 99999) * 1000;
  let sec = r.int(3600, 7200);
  const nsPool = r.shuffle(NAMESPACES);
  let nsi = 0;
  const nextNs = () => nsPool[nsi++ % nsPool.length];

  const query = (ns, h, plan, docs, nret, host) => {
    sec += r.int(5, 400);
    const keys = plan === "COLLSCAN" ? 0 : docs + r.int(0, 12);
    const row = { host: host || r.pick(HOSTS), ns, op: "query", hash: h, cursor: null, plan, keys, docs, nret, millis: plan === "COLLSCAN" ? r.int(40, 900) : r.int(1, 60), sec };
    row.op_id = opIds[row.host]++;
    ops.push(row);
    return row;
  };
  const getmore = (q, docs, nret) => {
    if (q.cursor === null) q.cursor = cursor += r.int(1, 999);
    sec += r.int(1, 30);
    const row = { host: q.host, ns: q.ns, op: "getmore", hash: q.hash, cursor: q.cursor, plan: q.plan, keys: q.plan === "COLLSCAN" ? 0 : docs + r.int(0, 12), docs, nret, millis: r.int(1, 300), sec };
    row.op_id = opIds[row.host]++;
    ops.push(row);
    return row;
  };
  const ix = () => "IXSCAN " + r.pick(INDEXES);

  // 1. A well-indexed shape: examines about what it returns.
  for (let s = 0; s < (level === 1 ? 2 : 1); s++) {
    const ns = nextNs(), h = hash(), plan = ix();
    for (let i = 0, n = r.int(floor, floor + 3); i < n; i++) { const nret = r.int(1, 60); query(ns, h, plan, nret + r.int(0, nret), nret); }
  }
  // 2. A poorly selective index: ratio well above k.
  {
    const ns = nextNs(), h = hash(), plan = ix();
    for (let i = 0, n = r.int(floor + 1, floor + 4); i < n; i++) { const nret = r.int(1, 30); query(ns, h, plan, nret * r.int(k + 2, 4 * k), nret); }
  }
  // 3. A collection scan.
  {
    const ns = nextNs(), h = hash();
    const n = r.int(floor, floor + 3);
    for (let i = 0; i < n; i++) {
      const q = query(ns, h, "COLLSCAN", r.int(8000, 40000), r.int(1, 25));
      if (level >= 2 && i === 0) getmore(q, r.int(8000, 40000), r.int(1, 25));   // a getMore row is not a COLLSCAN execution
    }
  }
  // 4. Exactly k documents examined per document returned: not reported.
  {
    const ns = nextNs(), h = hash(), plan = ix();
    const n = r.int(floor, floor + 2);
    const rets = Array.from({ length: n }, () => r.int(2, 40));
    const docs = rets.map((x) => x * k);
    const d = r.int(1, Math.floor((Math.min(rets[0], rets[1]) * k) / 2));     // shift work between two queries; the total stays k x returned
    docs[0] += d; docs[1] -= d;
    rets.forEach((nret, i) => query(ns, h, plan, docs[i], nret));
  }
  // 5. Bad ratio, one execution short of the floor: not reported.
  {
    const ns = nextNs(), h = hash(), plan = ix();
    for (let i = 0; i < floor - 1; i++) { const nret = r.int(1, 10); query(ns, h, plan, nret * r.int(3 * k, 6 * k), nret); }
  }
  // 6. Bad ratio, exactly the floor: reported.
  {
    const ns = nextNs(), h = hash(), plan = ix();
    for (let i = 0; i < floor; i++) { const nret = r.int(1, 10); query(ns, h, plan, nret * r.int(2 * k, 5 * k), nret); }
  }
  // 7. Average of per-query ratios above k, ratio of sums below it: not reported.
  {
    const ns = nextNs(), h = hash(), plan = ix();
    const m = floor + 1;
    query(ns, h, plan, k * m + r.int(5, 40), 1);
    for (let i = 1; i < m; i++) { const nret = r.int(80, 150); query(ns, h, plan, nret + r.int(0, 10), nret); }
  }

  if (level >= 2) {
    // 8. The first batch looks fine; the getMore batches do the scanning. Reported.
    {
      const ns = nextNs(), h = hash(), plan = ix();
      for (let i = 0, n = r.int(floor, floor + 1); i < n; i++) {
        const q = query(ns, h, plan, 101 + r.int(0, 30), 101);
        for (let j = 0, g = r.int(1, 3); j < g; j++) getmore(q, r.int(300, 600) * k, r.int(10, 60));
      }
    }
    // 9. Bad ratio, floor - 1 queries plus getMore rows: not reported.
    {
      const ns = nextNs(), h = hash(), plan = ix();
      for (let i = 0; i < floor - 1; i++) {
        const nret = r.int(5, 20);
        const q = query(ns, h, plan, nret * r.int(3 * k, 5 * k), nret);
        getmore(q, r.int(3, 9) * k * 10, r.int(2, 9));
      }
    }
    // 10. Returned nothing at all: reported with no ratio.
    {
      const ns = nextNs(), h = hash();
      for (let i = 0, n = r.int(floor, floor + 2); i < n; i++) query(ns, h, "COLLSCAN", r.int(3000, 20000), 0);
    }
    // 11. A plan that flips: mostly index, sometimes a collection scan. Reported.
    {
      const ns = nextNs(), h = hash(), plan = ix();
      const n = r.int(floor + 1, floor + 4);
      const flips = new Set(r.sample([...Array(n).keys()], r.int(1, 2)));
      for (let i = 0; i < n; i++) {
        const nret = r.int(1, 15);
        if (flips.has(i)) query(ns, h, "COLLSCAN", r.int(15000, 30000), nret);
        else query(ns, h, plan, nret * r.int(2, 4), nret);
      }
    }
  }

  let rows = ops;
  if (level === 3) {
    // 12. The same queryHash in two collections: bad in one, fine in the other.
    {
      const h = hash();
      const nsA = nextNs(), nsB = nextNs(), planA = ix(), planB = ix();
      for (let i = 0; i < floor; i++) query(nsA, h, planA, 2 * 3 * k, 2);
      for (let i = 0; i < 3; i++) { const nret = r.int(400, 600); query(nsB, h, planB, nret, nret); }
    }
    // 13. Floor - 1 bad queries; one of them shipped twice. Not reported.
    const ns = nextNs(), h = hash(), plan = ix();
    const dupMe = [];
    for (let i = 0; i < floor - 1; i++) { const nret = r.int(1, 8); dupMe.push(query(ns, h, plan, nret * r.int(3 * k, 5 * k), nret)); }
    // Duplicates: that one plus about one row in eight of the rest.
    const dups = [r.pick(dupMe), ...r.sample(ops.filter((o) => !dupMe.includes(o)), Math.max(3, Math.floor(ops.length / 8)))];
    rows = ops.concat(dups.map((o) => ({ ...o, dup: true })));
  }

  // Shuffle by time a little so duplicates sit later in the log, then number entries.
  rows = rows.map((o) => ({ ...o, ingest: o.dup ? o.sec + r.int(600, 3000) : o.sec + r.int(1, 5) }))
    .sort((a, b) => a.ingest - b.ingest || a.sec - b.sec);
  let eid = 1 + r.int(0, 900);
  rows.forEach((o) => { o.entry_id = eid++; });

  const rowsOut = compute(rows, k, floor, {});
  if (!rowsOut.length) return null;

  const diagnostics = [
    { message: "The ratio was averaged over executions. One query that returned a single document dominates an average; the shape's efficiency is total documents examined over total documents returned.", rows: compute(rows, k, floor, { avgRatio: true }) },
    { message: `A shape examining exactly ${k} documents per document returned was reported. The rule is strictly greater than ${k}.`, rows: compute(rows, k, floor, { geK: true }) },
    { message: `A shape with exactly ${floor} executions was dropped. The floor is inclusive: at least ${floor}.`, rows: compute(rows, k, floor, { floorStrict: true }) },
  ];
  if (level >= 2) {
    diagnostics.push({ message: "getMore rows were counted as executions. A getMore continues a cursor the query opened; only op = 'query' rows are executions.", rows: compute(rows, k, floor, { countGetmore: true }) });
    diagnostics.push({ message: "getMore rows were left out. The documents a cursor examines and returns in later batches are part of the query's work.", rows: compute(rows, k, floor, { ignoreGetmore: true }) });
    diagnostics.push({ message: "getMore rows of a collection-scan cursor were counted as COLLSCAN executions. Count only op = 'query' rows.", rows: compute(rows, k, floor, { getmoreCollscan: true }) });
    diagnostics.push({ message: "The shape that returned nothing was dropped (or divided by zero). A shape that examines documents and returns none is the worst case; report it with a NULL ratio.", rows: compute(rows, k, floor, { dropZero: true }) });
  }
  if (level === 3) {
    diagnostics.push({ message: "Duplicate profiler rows were counted. A row with the same (host, op_id) is the same operation shipped twice; count it once.", rows: compute(rows, k, floor, { noDedup: true }) });
    diagnostics.push({ message: "Shapes were grouped by query_hash alone. The same hash in two collections is two different shapes; group by (ns, query_hash).", rows: compute(rows, k, floor, { hashOnly: true }) });
  }

  const cols = ["entry_id", "host", "op_id", "ns", "op", "query_hash", "cursor_id", "plan_summary", "keys_examined", "docs_examined", "n_returned", "millis", "logged_at"];
  const tableRows = rows.map((o) => [o.entry_id, o.host, o.op_id, o.ns, o.op, o.hash, o.cursor, o.plan, o.keys, o.docs, o.nret, o.millis, ts(DAY, o.sec)]);
  const setup =
    "SET TIME ZONE 'UTC';\n" +
    "CREATE TABLE profiled_ops (\n  entry_id BIGINT PRIMARY KEY,\n  host TEXT NOT NULL,\n  op_id BIGINT NOT NULL,\n  ns TEXT NOT NULL,\n  op TEXT NOT NULL CHECK (op IN ('query','getmore')),\n  query_hash TEXT NOT NULL,\n  cursor_id BIGINT,\n  plan_summary TEXT NOT NULL,\n  keys_examined INT NOT NULL,\n  docs_examined INT NOT NULL,\n  n_returned INT NOT NULL,\n  millis INT NOT NULL,\n  logged_at TIMESTAMPTZ NOT NULL\n);\n" +
    insertSQL("profiled_ops", cols, tableRows);

  return {
    vars: {
      k,
      min_execs: floor,
      rows: tableRows.length,
      getmore_rule: level === 1
        ? "Every query here returned all its results in its first batch, so every row is an execution (`op = 'query'`)."
        : "A query that returns more than one batch leaves a cursor open, and each later batch is a separate `op = 'getmore'` row with the same `query_hash`, `ns`, `host` and `cursor_id`. A getMore row is not an execution, but the documents it examined and returned belong to the query's work.",
      dup_rule: level === 3
        ? "The log shipper can deliver a row twice: the copies have different `entry_id`s but the same `(host, op_id)` and identical values, and count once."
        : "Each operation appears once.",
    },
    setup,
    tables: [{ name: "profiled_ops", columns: cols, rows: tableRows }],
    expected: { columns: ["ns", "query_hash", "executions", "docs_examined", "n_returned", "examined_per_returned", "collscan_executions"], rows: rowsOut },
    diagnostics: diagnostics.filter((d) => JSON.stringify(d.rows) !== JSON.stringify(rowsOut)),
  };
}

// The rules applied literally; opts break one rule at a time for the diagnostics.
function compute(rows, k, floor, opts) {
  let src = rows;
  if (!opts.noDedup) {
    const seen = new Set();
    src = [];
    for (const o of rows) { const key = o.host + "|" + o.op_id; if (!seen.has(key)) { seen.add(key); src.push(o); } }
  }
  const groups = new Map();
  for (const o of src) {
    const key = opts.hashOnly ? o.hash : o.ns + "|" + o.hash;
    if (!groups.has(key)) groups.set(key, { ns: o.ns, hash: o.hash, execs: 0, docs: 0, nret: 0, coll: 0, ratios: [] });
    const g = groups.get(key);
    if (o.ns < g.ns) g.ns = o.ns;
    const isQuery = o.op === "query";
    if (isQuery || opts.countGetmore) g.execs++;
    if (isQuery || !opts.ignoreGetmore) { g.docs += o.docs; g.nret += o.nret; }
    if (o.plan === "COLLSCAN" && (isQuery || opts.getmoreCollscan)) g.coll++;
    if (isQuery) g.ratios.push(o.docs / Math.max(o.nret, 1));
  }
  const out = [];
  for (const g of groups.values()) {
    if (opts.floorStrict ? !(g.execs > floor) : !(g.execs >= floor)) continue;
    let ratio, hit;
    if (opts.avgRatio) {
      const avg = g.ratios.reduce((a, b) => a + b, 0) / g.ratios.length;
      ratio = Math.round(avg * 100) / 100;
      hit = avg > k;
    } else {
      ratio = g.nret > 0 ? Math.floor((g.docs * 200 + g.nret) / (2 * g.nret)) / 100 : null;   // half-up to 2 places
      hit = opts.geK ? g.docs >= k * g.nret : g.docs > k * g.nret;
    }
    if (opts.dropZero && g.nret === 0) continue;
    if (!hit) continue;
    out.push([g.ns, g.hash, g.execs, g.docs, g.nret, ratio, g.coll]);
  }
  return out.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0));
}
