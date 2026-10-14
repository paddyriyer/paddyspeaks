/* SNO-L1-04 — Scheduled tasks: the fewest warehouses that run every task window, and an
   assignment (Python). Simulated practice scenario. All data is generated from the seed; the
   scheduling rules (overlapping runs skipped, child tasks after their predecessors) are this
   exercise's simplified rules, not a product specification.

   Contract (python): entry, signature, starter, prelude, generate(r, level) ->
     { vars, samples: [{args, expect}], tests: [{name, args, expect?, limit_s?}] }.
   expect comes from oracle() below: child start times by repeated relaxation until nothing
   changes, and the assignment by scanning warehouses 1, 2, 3, ... for the first free one.
   The evaluator's reference uses a topological order and two heaps per size, written
   independently.
   level: 1 Medium (standalone tasks on a fixed period, one warehouse size)
          · 2 Hard (+ several sizes that never share warehouses, runs longer than the period
            so the next run is skipped, a run that starts before the horizon and ends after it)
          · 3 Very Hard (+ task graphs: child tasks start when all their predecessors in the
            same graph run have finished; the whole graph run is what may overlap) */
export const kind = "python";
export const entry = "plan_warehouses";
export const signature = "def plan_warehouses(tasks: list[tuple[str, str, int | None, int | None, int, tuple[str, ...]]], horizon: int) -> tuple[dict[str, int], list[tuple[str, int, int]]]:";
export const starter = `def plan_warehouses(tasks, horizon):
    """tasks: (task_id, size, first_start, every, duration, after).
    A root task has after == () and is scheduled at first_start + k * every while < horizon.
    A child task has first_start = every = None and a tuple of predecessor ids.
    Return ({size: warehouses needed}, [(task_id, start, warehouse_no), ...])
    with the runs in (start, task_id) order."""
    ...
`;

export const prelude = `
def _gen_tasks(n, seed, n_sizes=1, graphs=0, horizon=4320):
    x = seed
    def rnd(m):
        nonlocal x
        x = (1103515245 * x + 12345) % 2147483648
        return (x >> 16) % m
    sizes = ('XSMALL', 'SMALL', 'MEDIUM')[:n_sizes]
    tasks = []
    for k in range(n):
        every = 120 + rnd(481)
        dur = every // 2 + rnd(every // 2)
        if n_sizes > 1 and rnd(10) == 0:
            dur = every + rnd(every)                     # longer than its period: runs get skipped
        tasks.append(('t%05d' % k, sizes[0] if rnd(5) else sizes[rnd(n_sizes)], rnd(every), every, dur, ()))
    for g in range(graphs):
        root = 'g%04d_root' % g
        every = 60 + rnd(120)
        tasks.append((root, sizes[rnd(n_sizes)], rnd(60), every, 5 + rnd(20), ()))
        prev = [root]
        for c in range(1 + rnd(4)):
            cid = 'g%04d_c%d' % (g, c)
            preds = tuple(sorted(set(prev[rnd(len(prev))] for _ in range(1 + rnd(2)))))
            tasks.append((cid, sizes[rnd(n_sizes)], None, None, 3 + rnd(20), preds))
            prev.append(cid)
    return tasks, horizon
`.trim() + "\n";

// The specification, literally: graph runs scheduled one after another (skipping any
// scheduled while the previous run is unfinished), child starts by relaxation, then the
// runs in (start, task_id) order, each on the first free warehouse of its size.
export function oracle(tasks, horizon) {
  const byId = new Map(tasks.map((t) => [t[0], t]));
  const rootOf = (id) => { let t = byId.get(id); while (t[5].length) t = byId.get(t[5][0]); return t[0]; };
  const runs = [];
  for (const [root, , first, every, dur, after] of tasks) {
    if (after.length) continue;
    const members = tasks.filter((t) => rootOf(t[0]) === root);
    let finish = null;
    for (let s = first; s < horizon; s += every) {
      if (finish !== null && finish > s) continue;
      const start = new Map(members.map((t) => [t[0], s]));
      for (let changed = true; changed;) {
        changed = false;
        for (const t of members) {
          if (!t[5].length) continue;
          const st = Math.max(...t[5].map((p) => start.get(p) + byId.get(p)[4]));
          if (st !== start.get(t[0])) { start.set(t[0], st); changed = true; }
        }
      }
      finish = -Infinity;
      for (const t of members) {
        runs.push({ id: t[0], size: t[1], start: start.get(t[0]), end: start.get(t[0]) + t[4] });
        finish = Math.max(finish, start.get(t[0]) + t[4]);
      }
    }
  }
  runs.sort((a, b) => a.start - b.start || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const ends = new Map();
  const out = [];
  for (const x of runs) {
    if (!ends.has(x.size)) ends.set(x.size, []);
    const e = ends.get(x.size);
    let i = e.findIndex((v) => v <= x.start);
    if (i < 0) { e.push(x.end); i = e.length - 1; } else e[i] = x.end;
    out.push([x.id, x.start, i + 1]);
  }
  return { counts: [...ends.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([k, v]) => [k, v.length]), out };
}

const pyStr = (s) => `'${s}'`;
const pyTask = ([id, size, first, every, dur, after]) =>
  `(${pyStr(id)}, ${pyStr(size)}, ${first === null ? "None" : first}, ${every === null ? "None" : every}, ${dur}, (${after.map(pyStr).join(", ")}${after.length === 1 ? "," : ""}))`;
const pyArgs = (tasks, horizon) => `([${tasks.map(pyTask).join(", ")}], ${horizon})`;
const pyOut = ({ counts, out }) =>
  `({${counts.map(([k, v]) => `${pyStr(k)}: ${v}`).join(", ")}}, [${out.map(([id, s, n]) => `(${pyStr(id)}, ${s}, ${n})`).join(", ")}])`;

const NAMES = ["load_orders", "refresh_kpis", "merge_clicks", "snapshot_stock", "score_churn", "sync_crm", "rollup_sales",
  "dedupe_events", "export_finance", "build_features", "audit_access", "compact_logs", "publish_share", "check_quality"];
const SIZES = ["XSMALL", "SMALL", "MEDIUM"];

function randomCase(r, level) {
  const sizes = level === 1 ? [r.pick(SIZES)] : r.sample(SIZES, r.int(2, 3));
  const names = r.shuffle(NAMES);
  const horizon = r.pick([120, 180, 240]);
  const tasks = [];
  const nStand = level === 1 ? r.int(4, 6) : level === 2 ? r.int(5, 7) : r.int(3, 4);
  for (let i = 0; i < nStand; i++) {
    const every = r.pick([15, 20, 30, 45, 60]);
    const dur = level >= 2 && r.chance(0.25) ? r.int(every, 2 * every + 5) : r.int(3, every - 1);
    tasks.push([names.pop(), r.pick(sizes), r.int(0, 20), every, dur, []]);
  }
  if (level === 3) {
    for (let g = 0; g < r.int(1, 2); g++) {
      const root = names.pop();
      const every = r.pick([30, 40, 60]);
      tasks.push([root, r.pick(sizes), r.int(0, 15), every, r.int(3, 10), []]);
      const prev = [root];
      for (let c = 0; c < r.int(2, 3); c++) {
        const id = names.pop();
        const preds = [...new Set([r.pick(prev), r.pick(prev)])].sort();
        tasks.push([id, r.pick(sizes), null, null, r.int(3, 15), preds]);
        prev.push(id);
      }
    }
  }
  return { tasks: r.shuffle(tasks), horizon };
}

export function generate(r, level) {
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const c = randomCase(r, level);
    samples.push({ args: pyArgs(c.tasks, c.horizon), expect: pyOut(oracle(c.tasks, c.horizon)) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const [S, S2] = r.sample(SIZES, 2);
  const d = r.int(5, 12);
  const P = r.pick([30, 60]);
  const edges = [
    ["a warehouse freed at minute t runs the next task at t", [["a_load", S, 0, P, d, []], ["b_merge", S, d, P, d, []]], P],
    ["equal start times: the lower task_id takes the lower warehouse", [["b_merge", S, 0, P, d, []], ["a_load", S, 0, P, d, []]], P],
    ["the lowest-numbered free warehouse, not the most recently freed",
      [["a_long", S, 0, 100, 90, []], ["b_short", S, 0, 100, 10, []], ["c_mid", S, 0, 100, 20, []], ["d_next", S, 25, 100, 5, []], ["e_next", S, 26, 100, 5, []]], 100],
    ["a run scheduled exactly at the horizon does not run", [["a_load", S, 0, 40, 10, []], ["b_merge", S, 5, 40, 30, []]], 80],
  ];
  if (level >= 2) {
    edges.push(["sizes never share warehouses", [["a_load", S, 0, P, d, []], ["b_merge", S2, 0, P, d, []]], P]);
    edges.push(["a run still going at the next scheduled time skips it", [["a_load", S, 0, 10, 25, []]], 60]);
    edges.push(["a run ending exactly at the next scheduled time does not skip it", [["a_load", S, 0, 10, 10, []], ["b_merge", S, 5, 30, 4, []]], 40]);
    edges.push(["a run that starts before the horizon and ends after it still needs a warehouse", [["a_load", S, 0, 50, 100, []], ["b_merge", S, 49, 100, 5, []]], 50]);
  }
  if (level === 3) {
    edges.push(["a child starts when all of its predecessors have finished",
      [["r_root", S, 0, 60, 10, []], ["c_one", S, null, null, 20, ["r_root"]], ["c_two", S, null, null, 5, ["r_root"]], ["c_three", S2, null, null, 5, ["c_one", "c_two"]]], 120]);
    edges.push(["an unfinished graph run skips the next run of the whole graph",
      [["r_root", S, 0, 30, 10, []], ["c_one", S, null, null, 25, ["r_root"]], ["x_other", S, 31, 30, 5, []]], 90]);
    edges.push(["a graph run ending exactly at the next scheduled time does not skip it",
      [["r_root", S, 0, 30, 10, []], ["c_one", S2, null, null, 20, ["r_root"]]], 90]);
  }
  for (const [name, tasks, horizon] of edges) tests.push({ name, args: pyArgs(tasks, horizon), expect: pyOut(oracle(tasks, horizon)) });

  // Timing: 6,000 tasks over three days, about 85,000-140,000 runs and thousands of
  // warehouses in use at once. Heaps make each run O(log w); scanning warehouses
  // 1, 2, 3, ... for a free one is O(runs × warehouses).
  const args = level === 1 ? `_gen_tasks(6000, ${r.int(1, 1_000_000)}, 1, 0)`
    : level === 2 ? `_gen_tasks(6000, ${r.int(1, 1_000_000)}, 3, 0)`
    : `_gen_tasks(6000, ${r.int(1, 1_000_000)}, 3, 400)`;
  tests.push({ name: "6,000 tasks over three days, thousands of warehouses busy at once (heaps, not scans)", args, limit_s: 8 });

  return {
    vars: {
      size_rule: level === 1
        ? "In this exercise every task uses the same warehouse size, but return the dict anyway."
        : "Each task names a warehouse size; warehouses of different sizes are separate pools, numbered from 1 in each size.",
      graph_rule: level === 3
        ? "Some tasks form graphs: a child task has `first_start = every = None` and `after`, a tuple of predecessor ids in the same graph. Each scheduled run of the root starts one graph run: the root starts at the scheduled minute and every child starts when all of its predecessors in that graph run have finished. The skip rule applies to the whole graph: a scheduled root run is skipped if any task of the previous graph run that ran is still running."
        : "In this exercise every task is a root task (`after == ()`).",
    },
    samples,
    tests,
  };
}
