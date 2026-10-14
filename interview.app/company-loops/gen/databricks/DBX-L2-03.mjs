/* DBX-L2-03 — Debug the upsert (MERGE) into a customers table (debug, Python).
   Simulated practice scenario. All data is generated from the seed.

   Contract (debug): like python, but `starter` is buggy code the candidate fixes.
   The evaluator's reference is the fixed code. expect comes from oracle() below,
   an independent JavaScript implementation of the specification in the template.
   Planted bugs (see the evaluator notes): a truthiness test treats key 0 as a null
   key; deduplication ignores seq when updated_at ties; a delete for a key that is
   not in the table inserts a row; a late delete is not checked for staleness; every
   change scans the whole table (and removes from a list), so a large merge is
   quadratic.
   level: 1 Medium (one change per key, inserts, updates and deletes) · 2 Hard
          (+ several changes per key in any order, stale changes) · 3 Very Hard
          (+ null keys, key 0, deletes for unknown keys, updated_at ties) */
export const kind = "debug";
export const entry = "merge_upsert";
export const signature = "def merge_upsert(target: list[dict], changes: list[dict]) -> dict:";
export const starter = `def merge_upsert(target, changes):
    rows = [dict(r) for r in target]            # the customers table before the merge
    stats = {"inserted": 0, "updated": 0, "deleted": 0, "stale": 0, "null_keys": 0}

    # 1. one change per key: the latest wins
    latest = {}
    for ch in changes:
        if not ch["id"]:
            stats["null_keys"] += 1
            continue
        cur = latest.get(ch["id"])
        if cur is None or ch["updated_at"] > cur["updated_at"]:
            latest[ch["id"]] = ch

    # 2. apply the changes
    for key, ch in latest.items():
        match = next((r for r in rows if r["id"] == key), None)
        if match is None:
            rows.append({"id": key, "plan": ch["plan"], "updated_at": ch["updated_at"]})
            stats["inserted"] += 1
        elif ch["op"] == "delete":
            rows.remove(match)
            stats["deleted"] += 1
        elif ch["updated_at"] < match["updated_at"]:
            stats["stale"] += 1
        else:
            match["plan"] = ch["plan"]
            match["updated_at"] = ch["updated_at"]
            stats["updated"] += 1

    rows.sort(key=lambda r: r["id"])
    return {"rows": [[r["id"], r["plan"], r["updated_at"]] for r in rows], **stats}
`;

export const prelude = `
def _gen_merge(n_target, n_changes, seed):
    x, target, changes = seed, [], []
    plans = ['free', 'standard', 'premium', 'enterprise']
    for i in range(n_target):
        x = (1103515245 * x + 12345) % 2147483648
        target.append({'id': 2 * i, 'plan': plans[(x >> 8) % 4], 'updated_at': 1000 + (x >> 12) % 5000})
    for s in range(n_changes):
        x = (1103515245 * x + 12345) % 2147483648
        k = (x >> 8) % (3 * n_target)
        x = (1103515245 * x + 12345) % 2147483648
        op = 'delete' if (x >> 8) % 7 == 0 else 'upsert'
        key = None if (x >> 12) % 101 == 0 else k
        changes.append({'id': key, 'op': op, 'plan': None if op == 'delete' else plans[(x >> 16) % 4],
                        'updated_at': 1000 + (x >> 4) % 7000, 'seq': s + 1})
    return target, changes
`.trim() + "\n";

// The specification, implemented independently of the Python reference.
export function oracle(target, changes) {
  const stats = { inserted: 0, updated: 0, deleted: 0, stale: 0, null_keys: 0 };
  const table = new Map(target.map((t) => [t.id, { plan: t.plan, updated_at: t.updated_at }]));
  const keyed = [];
  for (const c of changes) {
    if (c.id === null) stats.null_keys++;
    else keyed.push(c);
  }
  // order by key, then (updated_at, seq) descending: the first change per key wins
  keyed.sort((a, b) => a.id - b.id || b.updated_at - a.updated_at || b.seq - a.seq);
  let prev;
  for (const c of keyed) {
    if (c.id === prev) continue;
    prev = c.id;
    const row = table.get(c.id);
    if (!row) {
      if (c.op === "upsert") { table.set(c.id, { plan: c.plan, updated_at: c.updated_at }); stats.inserted++; }
      continue;                                   // a delete for an unknown key changes nothing
    }
    if (c.updated_at < row.updated_at) { stats.stale++; continue; }
    if (c.op === "delete") { table.delete(c.id); stats.deleted++; }
    else { row.plan = c.plan; row.updated_at = c.updated_at; stats.updated++; }
  }
  const rows = [...table.entries()].sort((a, b) => a[0] - b[0]).map(([id, r]) => [id, r.plan, r.updated_at]);
  return { rows, ...stats };
}

function py(v) {
  if (v === null || v === undefined) return "None";
  if (typeof v === "boolean") return v ? "True" : "False";
  if (typeof v === "number") return String(v);
  if (typeof v === "string") return "'" + v + "'";
  if (Array.isArray(v)) return "[" + v.map(py).join(", ") + "]";
  return "{" + Object.entries(v).map(([k, x]) => `'${k}': ${py(x)}`).join(", ") + "}";
}
const pyArgs = (target, changes) => `(${py(target)}, ${py(changes)})`;
const caseOf = (name, target, changes) => ({ name, args: pyArgs(target, changes), expect: py(oracle(target, changes)) });

const PLANS = ["free", "standard", "premium", "enterprise"];

function streamCase(r, level) {
  const step = r.pick([1, 3, 7]);
  const ids = r.sample(Array.from({ length: 40 }, (_, i) => (i + 1) * step), 12);
  if (level === 3 && r.chance(0.5)) ids[0] = 0;                // customer 0 is a real key
  const nT = level === 1 ? r.int(4, 5) : r.int(4, 6);
  const inTable = ids.slice(0, nT), fresh = ids.slice(nT);
  const target = inTable.map((id) => ({ id, plan: r.pick(PLANS), updated_at: r.int(100, 400) }));
  const changes = [];
  let seq = 0;
  const add = (id, op, ts) => changes.push({ id, op, plan: op === "delete" ? null : r.pick(PLANS), updated_at: ts, seq: ++seq });
  const used = new Set();
  const nC = level === 1 ? r.int(4, 6) : r.int(6, 9);
  for (let i = 0; i < nC; i++) {
    const existing = r.chance(0.65);
    let id = existing ? r.pick(inTable) : r.pick(fresh);
    if (level === 1) {                                     // one change per key, never stale
      if (used.has(id)) continue;
      used.add(id);
      add(id, existing && r.chance(0.3) ? "delete" : "upsert", r.int(500, 900));
      continue;
    }
    const op = existing && r.chance(0.3) ? "delete" : level === 3 && !existing && r.chance(0.25) ? "delete" : "upsert";
    add(id, op, existing && r.chance(0.3) ? r.int(20, 99) : r.int(500, 900));       // some stale
    if (r.chance(0.35)) {                                   // another change for the same key
      const ts = level === 3 && r.chance(0.4) ? changes[changes.length - 1].updated_at : r.int(450, 950);
      add(id, r.chance(0.25) ? "delete" : "upsert", ts);
    }
  }
  if (level === 3) {
    if (r.chance(0.7)) add(null, "upsert", r.int(500, 900));
    if (r.chance(0.4)) add(null, "delete", r.int(500, 900));
  }
  return { target: r.shuffle(target), changes: level === 1 ? changes : r.shuffle(changes) };
}

export function generate(r, level) {
  const samples = [];
  for (let i = 0; i < 2; i++) {
    const c = streamCase(r, level);
    samples.push({ args: pyArgs(c.target, c.changes), expect: py(oracle(c.target, c.changes)) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const [A, B, C] = r.sample(Array.from({ length: 50 }, (_, i) => 10 + i * 7), 3);
  const [p1, p2, p3] = r.sample(PLANS, 3);
  const t0 = r.int(100, 300);
  const row = (id, plan, ts) => ({ id, plan, updated_at: ts });
  const up = (id, plan, ts, seq) => ({ id, op: "upsert", plan, updated_at: ts, seq });
  const del = (id, ts, seq) => ({ id, op: "delete", plan: null, updated_at: ts, seq });
  tests.push(caseOf("key 0 is a real key, not a null key",
    [row(0, p1, t0), row(A, p2, t0)], [up(0, p3, t0 + 50, 1)]));
  tests.push(caseOf("null keys are counted and never matched",
    [row(A, p1, t0)], [up(null, p2, t0 + 10, 1), del(null, t0 + 20, 2), up(B, p3, t0 + 30, 3)]));
  tests.push(caseOf("same updated_at for one key: the higher seq wins",
    [row(A, p1, t0)], [up(A, p2, t0 + 40, 4), up(A, p3, t0 + 40, 7)]));
  tests.push(caseOf("the latest change wins whatever the input order",
    [row(A, p1, t0)], [up(A, p2, t0 + 90, 9), up(A, p3, t0 + 60, 3)]));
  tests.push(caseOf("a delete older than the row is stale and the row stays",
    [row(A, p1, t0 + 100), row(B, p2, t0)], [del(A, t0 + 40, 1)]));
  tests.push(caseOf("an upsert older than the row is stale",
    [row(A, p1, t0 + 100)], [up(A, p2, t0 + 40, 1)]));
  tests.push(caseOf("a delete for a key not in the table changes nothing",
    [row(A, p1, t0)], [del(B, t0 + 10, 1)]));
  tests.push(caseOf("an insert then a later delete in one batch leaves no row",
    [row(A, p1, t0)], [up(C, p2, t0 + 10, 1), del(C, t0 + 20, 2)]));
  tests.push(caseOf("a change with the same updated_at as the row is applied",
    [row(A, p1, t0)], [up(A, p2, t0, 1)]));
  tests.push(caseOf("a newer delete removes the row",
    [row(A, p1, t0), row(B, p2, t0)], [del(B, t0 + 5, 1), up(C, p3, t0 + 5, 2)]));

  const n = level === 1 ? 50000 : 80000;
  tests.push({ name: `${n.toLocaleString("en-US")} rows and ${n.toLocaleString("en-US")} changes in time`, args: `_gen_merge(${n}, ${n}, ${r.int(1, 1_000_000)})`, limit_s: 8 });

  return {
    vars: {
      batch_rule: level === 1
        ? "This replay's batches carry at most one change per key; the checks also cover several changes per key, stale changes and null keys."
        : level === 2
          ? "This replay's batches carry several changes for some keys, in any order, and some changes older than the row they would touch."
          : "This replay's batches carry several changes per key in any order, stale changes, null keys, a customer whose id is 0, deletes for keys the table does not have, and changes for one key with the same `updated_at`.",
    },
    samples,
    tests,
  };
}
