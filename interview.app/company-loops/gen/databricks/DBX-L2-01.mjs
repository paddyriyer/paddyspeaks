/* DBX-L2-01 — Salting hot join keys and balancing the tasks (Python, greedy scheduling).
   Simulated practice scenario. All data is generated from the seed.

   Contract (python): entry, signature, starter, prelude, generate(r, level) ->
     { vars, samples: [{args, expect}], tests: [{name, args, expect?, limit_s?}] }.
   expect comes from oracle() below: the specification followed literally, with a
   linear scan over the tasks for every piece. The evaluator's reference keeps the
   task loads in a heap, so each checks the other.
   level: 1 Medium (split hot keys, place the pieces) · 2 Hard (+ a cap on salts per
          key) · 3 Very Hard (+ the other side of the join is copied to every salt) */
export const kind = "python";
export const entry = "plan_tasks";
export const signature = "def plan_tasks(key_rows: dict[str, int], num_tasks: int, target_rows: int, max_salts: int | None = None, other_rows: dict[str, int] | None = None) -> tuple[int, list[list[tuple[str, int]]]]:";
export const starter = `def plan_tasks(key_rows, num_tasks, target_rows, max_salts=None, other_rows=None):
    """key_rows: join key -> rows on the large side of the join (each >= 1).
    A key with more than target_rows rows is split into salted pieces
    (salt 0, 1, ...), at most max_salts of them when max_salts is set.
    other_rows (or None): key -> rows on the other side, copied to every piece.
    Place the pieces on num_tasks tasks largest first, each on the least
    loaded task. Return (largest task load, pieces per task)."""
    ...
`;

export const prelude = `
def _gen_skew(n, tasks, target, max_salts, with_other, seed):
    x, rows, other = seed, {}, {}
    for i in range(n):
        x = (1103515245 * x + 12345) % 2147483648
        k = 'k%07d' % i
        if (x >> 16) % 500 == 0:
            x = (1103515245 * x + 12345) % 2147483648
            rows[k] = target + (x >> 8) % (target * 30)
        else:
            x = (1103515245 * x + 12345) % 2147483648
            rows[k] = 1 + (x >> 8) % (target // 4)
        if with_other and (x >> 4) % 3 == 0:
            other[k] = (x >> 10) % (target // 8)
    return rows, tasks, target, max_salts, (other if with_other else None)
`.trim() + "\n";

// The specification, step by step. Small inputs only (a linear scan per piece).
export function oracle(keyRows, numTasks, target, maxSalts, otherRows) {
  const pieces = [];
  for (const [key, rows] of Object.entries(keyRows)) {
    let s = rows > target ? Math.ceil(rows / target) : 1;
    if (maxSalts != null) s = Math.min(s, maxSalts);
    const copy = otherRows && otherRows[key] !== undefined ? otherRows[key] : 0;
    for (let salt = 0; salt < s; salt++) {
      const share = Math.floor(rows / s) + (salt < rows % s ? 1 : 0);
      pieces.push({ key, salt, load: share + copy });
    }
  }
  pieces.sort((a, b) => b.load - a.load || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0) || a.salt - b.salt);
  const loads = new Array(numTasks).fill(0);
  const tasks = Array.from({ length: numTasks }, () => []);
  for (const p of pieces) {
    let t = 0;
    for (let i = 1; i < numTasks; i++) if (loads[i] < loads[t]) t = i;
    loads[t] += p.load;
    tasks[t].push([p.key, p.salt]);
  }
  return [Math.max(0, ...loads), tasks];
}

const pyDict = (o) => "{" + Object.entries(o).map(([k, v]) => `'${k}': ${v}`).join(", ") + "}";
const pyOut = ([mx, tasks]) => `(${mx}, [${tasks.map((t) => "[" + t.map(([k, s]) => `('${k}', ${s})`).join(", ") + "]").join(", ")}])`;
const pyArgs = (rows, n, target, maxSalts, other) =>
  `(${pyDict(rows)}, ${n}, ${target}, ${maxSalts == null ? "None" : maxSalts}, ${other == null ? "None" : pyDict(other)})`;
const caseOf = (name, rows, n, target, maxSalts = null, other = null) =>
  ({ name, args: pyArgs(rows, n, target, maxSalts, other), expect: pyOut(oracle(rows, n, target, maxSalts, other)) });

const PREFIX = ["cust", "device", "merchant", "sku", "tenant", "account", "region"];

function smallCase(r, level, prefix) {
  const target = r.pick([500, 800, 1000, 1200, 2000]);
  const nKeys = level === 1 ? r.int(5, 7) : r.int(6, 9);
  const ids = r.sample(Array.from({ length: 90 }, (_, i) => 10 + i), nKeys);
  const rows = {}, other = {};
  ids.forEach((id, i) => {
    const key = `${prefix}_${String(id).padStart(3, "0")}`;
    const hot = i < (level === 1 ? 1 : 2) || r.chance(0.15);
    rows[key] = hot ? target + r.int(1, target * (level === 1 ? 4 : 7)) : r.int(1, Math.floor(target * 0.9));
    if (level === 3 && r.chance(0.6)) other[key] = r.int(0, Math.floor(target / 3));
  });
  const shuffled = {};
  for (const k of r.shuffle(Object.keys(rows))) shuffled[k] = rows[k];
  const maxSalts = level === 1 ? null : r.int(2, 4);
  return { rows: shuffled, n: r.int(3, 5), target, maxSalts, other: level === 3 ? other : null };
}

export function generate(r, level) {
  const prefix = r.pick(PREFIX);
  const samples = [];
  for (let i = 0; i < 2; i++) {
    const c = smallCase(r, level, prefix);
    samples.push({ args: pyArgs(c.rows, c.n, c.target, c.maxSalts, c.other), expect: pyOut(oracle(c.rows, c.n, c.target, c.maxSalts, c.other)) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const T = r.pick([100, 200, 400]);
  const [a, b, c, d] = r.sample(Array.from({ length: 60 }, (_, i) => `${prefix}_${String(100 + i)}`), 4).sort();
  tests.push(caseOf("a key with exactly target_rows rows is not split", { [a]: T, [b]: 3 }, 2, T));
  tests.push(caseOf("one row over target_rows makes two pieces, salt 0 takes the extra row", { [a]: T + 1 }, 2, T));
  tests.push(caseOf("rows are spread as evenly as possible over the salts", { [b]: 3 * T + 2, [a]: 5 }, 3, T));
  tests.push(caseOf("equal loads are placed in key order, then salt order", { [b]: T / 2, [a]: T / 2, [c]: T }, 2, T));
  tests.push(caseOf("a task tie goes to the lowest task index", { [a]: 7, [b]: 7, [c]: 7, [d]: 7 }, 4, T));
  tests.push(caseOf("more tasks than pieces leaves tasks empty", { [a]: 9 }, 3, T));
  tests.push(caseOf("no keys: every task is empty", {}, 2, T));
  tests.push(caseOf("largest first, not in input order", { [a]: 1, [b]: 2, [c]: T - 1, [d]: T - 2 }, 2, T));
  if (level >= 2) {
    tests.push(caseOf("max_salts caps the split, so pieces can exceed target_rows", { [a]: 10 * T, [b]: T }, 4, T, 3));
    tests.push(caseOf("max_salts of 1 means no key is split", { [a]: 3 * T, [b]: T + 5 }, 3, T, 1));
  }
  if (level === 3) {
    tests.push(caseOf("the other side's rows are copied to every salt of a key", { [a]: 2 * T, [b]: T }, 2, T, 4, { [a]: 30, [b]: 7 }));
    tests.push(caseOf("the copy changes the order of placement but not the number of salts", { [a]: T + 2, [b]: T, [c]: T / 2 }, 2, T, 4, { [a]: 0, [c]: T }));
    tests.push(caseOf("other-side keys with no rows on the large side add nothing", { [a]: 5 }, 2, T, null, { [b]: 50, [a]: 1 }));
  }

  // Timing: up to about 150 000 pieces on thousands of tasks. A heap of task loads is
  // O(P log T); scanning every task for every piece is O(P · T).
  const n = level === 1 ? 120000 : 150000;
  const nt = level === 1 ? 4000 : 5000;
  const target = 20000;
  const salts = level === 1 ? "None" : String(r.int(6, 10));
  tests.push({
    name: `${n.toLocaleString("en-US")} keys on ${nt.toLocaleString("en-US")} tasks in time`,
    args: `_gen_skew(${n}, ${nt}, ${target}, ${salts}, ${level === 3 ? "True" : "False"}, ${r.int(1, 1_000_000)})`,
    limit_s: 8,
  });

  return {
    vars: {
      key_name: prefix + "_id",
      salt_rule: level === 1
        ? "In this exercise `max_salts` is `None`, so a hot key gets as many salts as it needs; your function must still accept the argument."
        : "Here `max_salts` is set: a key gets at most `max_salts` salts, even if its pieces then hold more than `target_rows` rows.",
      other_rule: level === 3
        ? "Here `other_rows` is given: every piece of a key also carries that key's rows from the other side of the join, because salting copies the other side to every salt. A key missing from `other_rows` carries nothing extra. The copy counts in the piece's load, but the number of salts depends on the large side only."
        : "In this exercise `other_rows` is `None`, so a piece's load is just its own rows; your function must still accept the argument.",
    },
    samples,
    tests,
  };
}
