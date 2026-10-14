/* DBX-L1-04 — Critical path and list-scheduling makespan of a stage DAG (Python).
   Simulated practice scenario. All data is generated from the seed. The scheduling rule
   (highest bottom level first, non-preemptive, on S identical slots) is this exercise's
   model, stated in the problem; it is not a description of any engine's scheduler.

   Contract (python): entry, signature, starter, prelude, generate(r, level) ->
     { vars, samples: [{args, expect}], tests: [{name, args, expect?, limit_s?}] }.
   expect comes from oracle() below: memoised recursion for bottom levels and a
   simulation that advances to the next finish time and rescans every stage there
   (quadratic, small inputs only). The evaluator's reference uses Kahn's algorithm and
   two heaps, so each checks the other.
   level: 1 Medium (one task per stage; valid DAG) · 2 Hard (+ invalid input -> None:
          cycles, self-dependencies, unknown stages; the empty job) · 3 Very Hard (+ stages
          with many tasks that occupy several slots at once) */
export const kind = "python";
export const entry = "schedule";
export const signature = "def schedule(stages: list[tuple[int, int, int, list[int]]], slots: int) -> tuple[int, list[int], int] | None:";
export const starter = `import heapq


def schedule(stages, slots):
    """stages: (stage_id, tasks, task_seconds, deps). Return
    (critical_path_seconds, critical_path_stage_ids, makespan), or None if the
    dependencies are invalid."""
    ...
`;

export const prelude = `
def _gen_stages(n, seed, max_tasks=1, max_deps=3, max_secs=60):
    x, out = seed, []
    def nxt():
        nonlocal x
        x = (1103515245 * x + 12345) % 2147483648
        return x >> 8
    for i in range(n):
        deps = set()
        if i:
            for _ in range(nxt() % (max_deps + 1)):
                deps.add(nxt() % i)
            if nxt() % 10 < 3:
                deps.add(i - 1)
        out.append((10 + 3 * i, 1 + nxt() % max_tasks, 1 + nxt() % max_secs, sorted(10 + 3 * d for d in deps)))
    x2 = seed
    for i in range(n - 1, 0, -1):          # list order is not a topological order
        x2 = (1103515245 * x2 + 12345) % 2147483648
        j = (x2 >> 8) % (i + 1)
        out[i], out[j] = out[j], out[i]
    return out
`.trim() + "\n";

// ---- oracle ----------------------------------------------------------------------
export function oracle(stages, slots) {
  const by = new Map(stages.map((s) => [s[0], { id: s[0], tasks: s[1], secs: s[2], deps: s[3] }]));
  for (const s of by.values()) for (const d of s.deps) if (!by.has(d)) return null;
  // cycle check by DFS colouring
  const colour = new Map();
  const hasCycle = (id) => {
    colour.set(id, 1);
    for (const d of by.get(id).deps) {
      const c = colour.get(d);
      if (c === 1) return true;
      if (c === undefined && hasCycle(d)) return true;
    }
    colour.set(id, 2);
    return false;
  };
  for (const id of by.keys()) if (!colour.has(id) && hasCycle(id)) return null;
  if (!by.size) return [0, [], 0];
  const children = new Map([...by.keys()].map((k) => [k, []]));
  for (const s of by.values()) for (const d of s.deps) children.get(d).push(s.id);
  const memo = new Map();
  const bl = (id) => {
    if (memo.has(id)) return memo.get(id);
    let m = 0;
    for (const c of children.get(id)) m = Math.max(m, bl(c));
    const v = by.get(id).secs + m;
    memo.set(id, v);
    return v;
  };
  const better = (a, b) => bl(a) > bl(b) || (bl(a) === bl(b) && a < b);
  let cur = null;
  for (const id of by.keys()) if (cur === null || better(id, cur)) cur = id;
  const cp = bl(cur);
  const path = [cur];
  for (;;) {
    let nx = null;
    for (const c of children.get(cur)) if (nx === null || better(c, nx)) nx = c;
    if (nx === null) break;
    path.push(nx); cur = nx;
  }
  // Simulation: running = [{id, end, k}]
  const left = new Map([...by.keys()].map((k) => [k, by.get(k).tasks]));       // not started
  const unfinished = new Map(left);
  const done = new Set();
  let running = [];
  let t = 0, free = slots, makespan = 0;
  for (;;) {
    // finish everything due at t
    const still = [];
    for (const x of running) {
      if (x.end === t) { free += x.k; unfinished.set(x.id, unfinished.get(x.id) - x.k); if (unfinished.get(x.id) === 0) done.add(x.id); makespan = Math.max(makespan, t); }
      else still.push(x);
    }
    running = still;
    // start: rescan all stages each time a slot is given out
    while (free > 0) {
      let pick = null;
      for (const s of by.values()) {
        if (left.get(s.id) === 0) continue;
        if (!s.deps.every((d) => done.has(d))) continue;
        if (pick === null || better(s.id, pick)) pick = s.id;
      }
      if (pick === null) break;
      const k = Math.min(free, left.get(pick));
      left.set(pick, left.get(pick) - k);
      free -= k;
      running.push({ id: pick, end: t + by.get(pick).secs, k });
    }
    if (!running.length) break;
    t = Math.min(...running.map((x) => x.end));
  }
  return [cp, path, makespan];
}

const pyVal = (v) => (v === null ? "None" : `(${v[0]}, [${v[1].join(", ")}], ${v[2]})`);
const pyArgs = (stages, slots) => `([${stages.map(([id, k, s, d]) => `(${id}, ${k}, ${s}, [${d.join(", ")}])`).join(", ")}], ${slots})`;

function smallCase(r, level, n) {
  const ids = r.sample([...Array(80).keys()].map((i) => i + 1), n);    // topological order = this order
  const stages = ids.map((id, i) => {
    const deps = new Set();
    if (i > 0) for (let k = r.int(0, 2); k > 0; k--) deps.add(ids[r.int(0, i - 1)]);
    const tasks = level === 3 ? r.pick([1, 1, 2, 3, 5, 8]) : 1;
    return [id, tasks, r.pick([2, 3, 4, 5, 5, 6, 8, 10]), [...deps].sort((a, b) => a - b)];
  });
  return { stages: r.shuffle(stages), slots: r.int(2, level === 3 ? 4 : 3) };
}

export function generate(r, level) {
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const { stages, slots } = smallCase(r, level, 5 + i);
    samples.push({ args: pyArgs(stages, slots), expect: pyVal(oracle(stages, slots)) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));
  for (let i = 0; i < 4; i++) {
    const { stages, slots } = smallCase(r, level, 8 + 2 * i);
    tests.push({ name: `random job ${i + 1} (${stages.length} stages, ${slots} slots)`, args: pyArgs(stages, slots), expect: pyVal(oracle(stages, slots)) });
  }

  const a = r.int(2, 9), b = a + r.int(1, 9), c = b + r.int(1, 9), d = c + r.int(1, 9);
  const e = r.int(3, 9);
  const edges = [
    ["one stage", [[a, 1, e, []]], 1],
    ["a chain on many slots: makespan equals the critical path", [[c, 1, 4, [b]], [a, 1, 3, []], [b, 1, 5, [a]]], 4],
    // Two sources tie on bottom level; the smaller id is on the critical path and starts first.
    ["tied bottom levels: smaller stage id first", [[b, 1, 5, []], [a, 1, 2, []], [c, 1, 3, [a]], [d, 1, 4, []]], 1],
    // The dependent becomes ready at the instant a slot frees.
    ["a stage starts at the instant its last dependency finishes", [[a, 1, 3, []], [b, 1, 3, []], [c, 1, 2, [a, b]], [d, 1, 1, []]], 2],
    ["priority is the bottom level, not the stage's own length", [[a, 1, 6, []], [b, 1, 2, []], [c, 1, 6, [b]], [d, 1, 5, []]], 2],
  ];
  if (level >= 2) {
    edges.push(["no stages", [], 3]);
    edges.push(["a cycle returns None", [[a, 1, 2, [c]], [b, 1, 2, [a]], [c, 1, 2, [b]], [d, 1, 2, []]], 2]);
    edges.push(["a stage that depends on itself returns None", [[a, 1, 2, []], [b, 1, 2, [b]]], 2]);
    edges.push(["an unknown dependency returns None", [[a, 1, 2, []], [b, 1, 2, [a, d + 50]]], 2]);
    edges.push(["more slots than stages", [[a, 1, 3, []], [b, 1, 7, [a]], [c, 1, 2, [a]], [d, 1, 2, []]], 10]);
  }
  if (level === 3) {
    edges.push(["one stage with more tasks than slots", [[a, 7, 5, []]], 3]);
    edges.push(["a wide stage holds every slot until its tasks are all started", [[a, 6, 4, []], [b, 1, 3, []], [c, 2, 5, [a]]], 4]);
    edges.push(["a stage finishes when its last task finishes", [[a, 3, 2, []], [b, 1, 9, [a]], [c, 4, 1, []]], 2]);
  }
  for (const [name, stages, slots] of edges) tests.push({ name, args: pyArgs(stages, slots), expect: pyVal(oracle(stages, slots)) });

  // Timing: tens of thousands of stages. Rescanning every stage whenever a slot frees is
  // quadratic; two heaps and in-degree counters are O((n + E) log n).
  const seed = r.int(1, 1_000_000);
  const n = level === 3 ? 20000 : 30000;
  const slots = level === 3 ? 64 : r.pick([16, 32, 48]);
  tests.push({ name: `${n.toLocaleString("en-US")} stages in time (heaps, not rescans)`, args: `(_gen_stages(${n}, ${seed}, ${level === 3 ? 40 : 1}), ${slots})`, limit_s: 8 });

  return {
    vars: {
      task_rule: level === 3
        ? "A stage has `tasks` identical tasks of `task_seconds` each. Each task needs one slot; a stage's tasks can run on several slots at once, and the stage finishes when its last task finishes."
        : "Every stage in this exercise has exactly one task (`tasks` is 1), so a stage occupies one slot for `task_seconds`.",
      invalid_rule: level >= 2
        ? "If a dependency names a stage that is not in the list, or the dependencies contain a cycle (including a stage that depends on itself), return `None`. An empty list returns `(0, [], 0)`."
        : "The input is always a valid, non-empty DAG in this exercise.",
    },
    samples,
    tests,
  };
}
