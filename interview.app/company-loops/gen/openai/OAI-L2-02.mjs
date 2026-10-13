/* OAI-L2-02 — Staged model rollout: earliest finish time (Python, graphs).
   Simulated practice scenario. All data is generated from the seed.

   The candidate writes rollout_finish(). The oracle is a memoised depth-first search
   over successors with an explicit stack and three-colour cycle detection; the
   evaluator's reference is Kahn's algorithm forward, so each checks the other. */
export const kind = "python";
export const entry = "rollout_finish";
export const signature = "def rollout_finish(durations: dict[str, int], deps: list[tuple], with_path: bool = False) -> int | tuple[int, list[str]] | None:";
export const starter = `def rollout_finish(durations, deps, with_path=False):
    """durations: minutes each rollout step takes.
    deps: (before, after[, soak_minutes]) - 'after' may start only once 'before' has
    finished (plus the soak time, where given).
    Return the finish time, or (finish, critical_path) when with_path is True.
    Return None if the dependencies contain a cycle."""
    ...
`;

export const prelude = `
def _gen_dag(n, m, seed, soak=False, dmax=30):
    # n steps named in a scrambled order, m random forward edges (so no cycles).
    x = seed
    def nxt():
        nonlocal x
        x = (1103515245 * x + 12345) % 2147483648
        return x >> 16
    name = lambda i: "step%06d" % ((i * 7919) % n)
    durations = {name(i): 1 + nxt() % dmax for i in range(n)}
    deps = []
    for _ in range(m):
        a, b = nxt() % n, nxt() % n
        if a == b:
            continue
        if a > b:
            a, b = b, a
        deps.append((name(a), name(b), nxt() % 15) if soak else (name(a), name(b)))
    return durations, deps

def _chain(n, d, s=None):
    durations = {"c%06d" % i: d for i in range(n)}
    deps = [("c%06d" % i, "c%06d" % (i + 1)) + (() if s is None else (s,)) for i in range(n - 1)]
    return durations, deps
`.trim() + "\n";

/* Independent oracle. Returns null on a cycle, else { finish, path } where path is the
   tie-broken critical path (smallest name first, then smallest-named successor). */
export function oracle(durations, deps, level) {
  const dur = new Map(Object.entries(durations));
  const succ = new Map();             // node -> Map(successor -> soak)
  const touch = (v) => { if (!dur.has(v)) dur.set(v, 0); if (!succ.has(v)) succ.set(v, new Map()); };
  for (const v of Object.keys(durations)) touch(v);
  for (const e of deps) {
    const [a, b] = e, s = e.length > 2 ? e[2] : 0;
    touch(a); touch(b);
    const m = succ.get(a);
    if (!m.has(b) || m.get(b) < s) m.set(b, s);
  }
  const tail = new Map();             // longest duration from the start of v to the end of the rollout
  const colour = new Map();           // 1 = on stack, 2 = done
  for (const root of [...dur.keys()].sort()) {
    if (colour.get(root) === 2) continue;
    const stack = [[root, [...succ.get(root).keys()], 0]];
    colour.set(root, 1);
    while (stack.length) {
      const top = stack[stack.length - 1];
      const [v, kids] = top;
      if (top[2] < kids.length) {
        const w = kids[top[2]++];
        const c = colour.get(w);
        if (c === 1) return null;       // back edge: cycle
        if (c !== 2) { colour.set(w, 1); stack.push([w, [...succ.get(w).keys()], 0]); }
      } else {
        let best = 0;
        for (const [w, s] of succ.get(v)) best = Math.max(best, s + tail.get(w));
        tail.set(v, dur.get(v) + best);
        colour.set(v, 2);
        stack.pop();
      }
    }
  }
  let finish = 0;
  for (const t of tail.values()) finish = Math.max(finish, t);
  const path = [];
  if (level === 3 && dur.size) {
    let v = [...tail.keys()].filter((k) => tail.get(k) === finish).sort()[0];
    path.push(v);
    while (tail.get(v) > dur.get(v)) {
      const need = tail.get(v) - dur.get(v);
      v = [...succ.get(v)].filter(([w, s]) => s + tail.get(w) === need).map(([w]) => w).sort()[0];
      path.push(v);
    }
  }
  return { finish, path };
}

const q = (s) => `'${s}'`;
function pyArgs(durations, deps, level) {
  const d = "{" + Object.entries(durations).map(([k, v]) => `${q(k)}: ${v}`).join(", ") + "}";
  const e = "[" + deps.map((t) => "(" + t.map((x) => (typeof x === "number" ? x : q(x))).join(", ") + ")").join(", ") + "]";
  return level === 3 ? `(${d}, ${e}, True)` : `(${d}, ${e})`;
}
function pyExpect(res, level) {
  if (res === null) return "None";
  return level === 3 ? `(${res.finish}, [${res.path.map(q).join(", ")}])` : String(res.finish);
}

const NAME_SETS = [
  ["canary", "eval_gate", "shard_a", "shard_b", "shard_c", "router", "cache_warm", "region_eu", "region_us", "region_ap", "batch_api", "dashboards"],
  ["weights_upload", "safety_eval", "tokenizer", "gpu_pool_1", "gpu_pool_2", "gpu_pool_3", "load_balancer", "shadow_traffic", "ramp_5pct", "ramp_50pct", "ramp_100pct", "docs"],
  ["build_image", "smoke_test", "kv_cache", "serving_a", "serving_b", "serving_c", "rate_limits", "billing_meter", "status_page", "playground", "api_ga", "retire_old"],
];

function smallCase(r, level, n, withCycle) {
  const names = r.sample(r.pick(NAME_SETS), n);
  const durations = {};
  for (const v of names) durations[v] = r.int(1, 30);
  const deps = [];
  const soak = () => (r.chance(0.5) ? 0 : r.pick([5, 10, 15, 30]));
  for (let j = 1; j < n; j++) {
    const k = r.int(0, Math.min(3, j));
    for (const i of r.sample([...Array(j).keys()], k)) deps.push(level >= 2 ? [names[i], names[j], soak()] : [names[i], names[j]]);
  }
  if (level === 3 && deps.length) {
    const e = r.pick(deps);
    deps.push([e[0], e[1], e[2] + r.pick([5, 20])]);          // the same pair twice: the longer soak applies
  }
  if (level === 2) {
    const gate = r.pick(["change_approval", "capacity_signoff", "legal_review"]);
    deps.push([gate, r.pick(names), r.pick([0, 10, 60])]);     // an external gate: not in durations, 0 minutes
  }
  if (withCycle) {
    const a = r.int(0, n - 2), b = r.int(a + 1, n - 1);
    // a -> b and b -> a: a two-step cycle hidden among valid dependencies.
    deps.push(level >= 2 ? [names[a], names[b], 5] : [names[a], names[b]]);
    deps.push(level >= 2 ? [names[b], names[a], 0] : [names[b], names[a]]);
  }
  return { durations, deps: r.shuffle(deps) };
}

export function generate(r, level) {
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const c = smallCase(r, level, 6 + i * 2 + level, false);
    samples.push({ args: pyArgs(c.durations, c.deps, level), expect: pyExpect(oracle(c.durations, c.deps, level), level) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const t3 = level >= 2;
  const E = (a, b, s = 0) => (t3 ? [a, b, s] : [a, b]);
  const d1 = r.int(3, 20), d2 = r.int(3, 20);
  const cyc = smallCase(r, level, 7, true);
  const edges = [
    ["no steps: the rollout finishes at 0", {}, []],
    ["independent steps run in parallel", { a: d1, b: d2, c: 1 }, []],
    ["a self-dependency is a cycle", { a: d1, b: d2 }, [E("a", "b"), E("b", "b")]],
    ["a cycle anywhere means no finish time", cyc.durations, cyc.deps],
    ["a diamond waits for its slower branch", { src: 2, fast: d1, slow: d1 + d2, sink: 1 }, [E("src", "fast"), E("src", "slow"), E("fast", "sink"), E("slow", "sink")]],
  ];
  if (level >= 2) edges.push(["the soak time delays the next step", { a: d1, b: d2 }, [E("a", "b", 30)]]);
  if (level === 2) edges.push(["an external gate takes no time but its soak counts", { a: d1 }, [E("approval", "a", 45)]]);
  if (level === 3) {
    edges.push(["the same dependency twice: the longer soak applies", { a: d1, b: d2 }, [E("a", "b", 5), E("a", "b", 25)]]);
    edges.push(["two equal critical paths: the smaller names win", { x: 5, y: 5, m: 3, n: 3, z: 1 }, [E("x", "n"), E("y", "m"), E("m", "z"), E("n", "z")]]);
  }
  for (const [name, d, e] of edges) tests.push({ name, args: pyArgs(d, e, level), expect: pyExpect(oracle(d, e, level), level) });

  // A 30 000-step chain: recursive DFS overflows Python's stack.
  const chainN = 30000, cd = r.int(1, 9), cs = r.int(0, 5);
  const chainArgs = level === 3 ? `(*_chain(${chainN}, ${cd}, ${cs}), True)` : level === 2 ? `_chain(${chainN}, ${cd}, ${cs})` : `_chain(${chainN}, ${cd})`;
  if (level < 3) {
    const finish = chainN * cd + (level >= 2 ? (chainN - 1) * cs : 0);
    tests.push({ name: "a 30 000-step chain (no recursion)", args: chainArgs, expect: String(finish), limit_s: 8 });
  } else {
    tests.push({ name: "a 30 000-step chain (no recursion)", args: chainArgs, limit_s: 8 });
  }

  // Timing: ~200 000 dependencies. O(V + E) passes; repeated relaxation does not.
  const seed = r.int(1, 1_000_000);
  const n = 50000, m = level === 1 ? 160000 : 200000;
  tests.push({ name: `${n.toLocaleString("en-US")} steps and ~${m.toLocaleString("en-US")} dependencies in time (O(V + E))`, args: level === 3 ? `(*_gen_dag(${n}, ${m}, ${seed}, True), True)` : `_gen_dag(${n}, ${m}, ${seed}, ${level >= 2 ? "True" : "False"})`, limit_s: 8 });

  return {
    vars: {
      dep_rule: level === 1
        ? "Each dependency is a pair `(before, after)`: `after` may start as soon as `before` has finished."
        : level === 2
          ? "Each dependency is a triple `(before, after, soak)`: `after` may start `soak` minutes after `before` finishes (a bake period for watching error rates). A dependency may name an external gate that is not in `durations`, such as a sign-off; it takes 0 minutes."
          : "Each dependency is a triple `(before, after, soak)`: `after` may start `soak` minutes after `before` finishes. The same pair may appear more than once; the longest soak applies. Every step is in `durations` and takes at least 1 minute.",
      return_rule: level === 3
        ? "The tests call `rollout_finish(durations, deps, with_path=True)`: return a tuple `(finish, critical_path)`: the finish time and the list of steps on a longest path. If several paths tie, start at the alphabetically smallest step that begins one, and at each step continue to the alphabetically smallest successor that stays on a longest path. Return None if the dependencies contain a cycle."
        : "Return the finish time as an int (`with_path` stays False at this level), or None if the dependencies contain a cycle.",
    },
    samples,
    tests,
  };
}
