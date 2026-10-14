/* NVD-L1-05 — Profiler self time: exclusive time per annotated range from nested push/pop events (Python).
   Simulated practice scenario. All data is generated from the seed. The trace format (push/pop
   events per thread with integer timestamps) is a generic model of annotated-range profiling,
   not the file format of any particular tool.

   Contract (python): entry, signature, starter, prelude, generate(r, level) ->
     { vars, samples: [{args, expect}], tests: [{name, args, expect?, limit_s?}] }.
   expect comes from oracle() below: it first materialises every range (thread, start, end, depth),
   then, for each range, scans all ranges of its thread for direct children (O(n^2), fine for
   small cases). The evaluator's reference is a single pass with one stack per thread, written
   independently.
   level: 1 Medium (balanced ranges, one or two threads)
          · 2 Hard (+ interleaved threads, recursion of one name, zero-length ranges, equal timestamps)
          · 3 Very Hard (+ pops with nothing open, ranges still open at the end of the trace) */
export const kind = "python";
export const entry = "self_times";
export const signature = "def self_times(events: list[tuple], end_ts: int) -> dict[str, tuple[int, int]]:";
export const starter = `def self_times(events, end_ts):
    """events, in trace order: ('push', thread, ts, name) or ('pop', thread, ts).
    end_ts: the time the trace ends (>= every ts).
    Return {name: (calls, self_time)}."""
    ...
`;

export const prelude = `
def _gen_trace(n_events, threads, max_depth, seed, ragged=False):
    x = seed
    def rnd(m):
        nonlocal x
        x = (1103515245 * x + 12345) % 2147483648
        return (x >> 16) % m
    names = ('forward', 'backward', 'attention', 'matmul', 'allreduce', 'optimizer_step', 'data_load', 'layernorm')
    depth = [0] * threads
    events, t = [], 0
    while len(events) < n_events:
        th = rnd(threads)
        t += rnd(4)
        d = depth[th]
        if d == 0 or (d < max_depth and rnd(100) < 55):
            events.append(('push', th, t, names[rnd(len(names))]))
            depth[th] += 1
        else:
            events.append(('pop', th, t))
            depth[th] -= 1
        if ragged and rnd(1000) == 0:
            events.append(('pop', rnd(threads) + threads, t))      # a pop on a thread with nothing open
    if not ragged:
        for th in range(threads):
            for _ in range(depth[th]):
                t += 1
                events.append(('pop', th, t))
    return events, t + 5
`.trim() + "\n";

// The specification, literally: materialise ranges, then find each one's direct children by scanning.
export function oracle(events, endTs) {
  const ranges = [];
  const open = new Map();
  for (const ev of events) {
    const th = ev[1];
    if (!open.has(th)) open.set(th, []);
    const st = open.get(th);
    if (ev[0] === "push") {
      const rg = { th, start: ev[2], end: null, name: ev[3], depth: st.length, parent: st.length ? st[st.length - 1] : null };
      st.push(rg);
      ranges.push(rg);
    } else if (st.length) st.pop().end = ev[2];
  }
  for (const rg of ranges) if (rg.end === null) rg.end = endTs;
  const out = new Map();
  for (const rg of ranges) {
    let child = 0;
    for (const c of ranges) if (c.parent === rg) child += c.end - c.start;
    const cur = out.get(rg.name) || [0, 0];
    out.set(rg.name, [cur[0] + 1, cur[1] + (rg.end - rg.start) - child]);
  }
  return out;
}

const NAMES = ["allreduce", "attention", "backward", "data_load", "embedding", "forward", "layernorm", "matmul", "optimizer_step", "softmax"];
const pyEvents = (evs) => "[" + evs.map((e) => (e[0] === "push" ? `('push', ${e[1]}, ${e[2]}, '${e[3]}')` : `('pop', ${e[1]}, ${e[2]})`)).join(", ") + "]";
const pyArgs = (evs, endTs) => `(${pyEvents(evs)}, ${endTs})`;
const pyOut = (m) => "{" + [...m.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([k, [c, s]]) => `'${k}': (${c}, ${s})`).join(", ") + "}";

function randomCase(r, level) {
  for (let attempt = 0; attempt < 100; attempt++) {
    const names = r.sample(NAMES, level === 1 ? 4 : 3);           // fewer names at Hard+: recursion is likely
    const threads = r.sample([0, 1, 2, 3, 4, 5, 6, 7].map((x) => 100 + x * 7), level === 1 ? r.int(1, 2) : r.int(2, 3));
    const depth = new Map(threads.map((t) => [t, 0]));
    const evs = [];
    let t = r.int(0, 50);
    const n = level === 1 ? r.int(10, 14) : r.int(14, 20);
    let th = r.pick(threads);
    while (evs.length < n) {
      if (level >= 2 || r.chance(0.15)) th = r.pick(threads);       // Medium: threads mostly take turns in blocks
      t += level >= 2 && r.chance(0.25) ? 0 : r.int(1, 9);
      const d = depth.get(th);
      if (level === 3 && d === 0 && r.chance(0.2)) { evs.push(["pop", th, t]); continue; }
      if (d === 0 || (d < 4 && r.chance(0.55))) { evs.push(["push", th, t, r.pick(names)]); depth.set(th, d + 1); }
      else { evs.push(["pop", th, t]); depth.set(th, d - 1); }
    }
    if (level < 3) for (const x of threads) for (let k = depth.get(x); k > 0; k--) evs.push(["pop", x, (t += r.int(1, 5))]);
    const endTs = t + (level === 3 ? r.int(0, 20) : r.int(0, 5));
    const got = oracle(evs, endTs);
    const pushes = evs.filter((e) => e[0] === "push").length;
    let maxDepth = 0, dd = new Map();
    for (const e of evs) {
      const v = (dd.get(e[1]) || 0) + (e[0] === "push" ? 1 : dd.get(e[1]) ? -1 : 0);
      dd.set(e[1], v);
      maxDepth = Math.max(maxDepth, v);
    }
    const nested = maxDepth >= 2 && pushes >= 4;
    const ragged = level < 3 || [...depth.values()].some((d) => d > 0);
    if (nested && ragged) return { evs, endTs, got };
  }
  throw new Error("NVD-L1-05: could not build a sample");
}

export function generate(r, level) {
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const c = randomCase(r, level);
    samples.push({ args: pyArgs(c.evs, c.endTs), expect: pyOut(c.got) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const [P, Q, R2, S] = r.sample(NAMES, 4);
  const A = 100 + r.int(0, 50), B = A + r.int(1, 9);
  const t0 = r.int(0, 1000);
  const x = r.int(3, 9);
  const edges = [
    ["a parent's self time excludes its two children",
      [["push", A, t0, P], ["push", A, t0 + 2, Q], ["pop", A, t0 + 2 + x], ["push", A, t0 + 10 + x, R2], ["pop", A, t0 + 13 + x], ["pop", A, t0 + 20 + x]], t0 + 30 + x],
    ["only direct children are subtracted, not grandchildren",
      [["push", A, t0, P], ["push", A, t0 + 1, Q], ["push", A, t0 + 2, R2], ["pop", A, t0 + 2 + x], ["pop", A, t0 + 4 + x], ["pop", A, t0 + 9 + x]], t0 + 9 + x],
    ["the same name nested in itself counts each instance once",
      [["push", A, t0, P], ["push", A, t0 + 3, P], ["push", A, t0 + 4, P], ["pop", A, t0 + 4 + x], ["pop", A, t0 + 6 + x], ["pop", A, t0 + 10 + x]], t0 + 10 + x],
    ["a range with no children: self time is its duration",
      [["push", A, t0, S], ["pop", A, t0 + x]], t0 + x],
  ];
  if (level >= 2) {
    edges.push(["a pop closes the innermost range of its own thread only",
      [["push", A, t0, P], ["push", B, t0 + 1, Q], ["push", A, t0 + 2, R2], ["pop", B, t0 + 5], ["pop", A, t0 + 7], ["pop", A, t0 + 7 + x]], t0 + 20]);
    edges.push(["zero-length ranges and equal timestamps: list order decides",
      [["push", A, t0, P], ["push", A, t0, Q], ["pop", A, t0], ["push", A, t0, R2], ["pop", A, t0 + x], ["pop", A, t0 + x]], t0 + x]);
    edges.push(["recursion across threads stays per thread",
      [["push", A, t0, P], ["push", B, t0, P], ["push", A, t0 + 1, P], ["pop", B, t0 + 4], ["pop", A, t0 + 5], ["pop", A, t0 + 5 + x]], t0 + 5 + x]);
  }
  if (level === 3) {
    edges.push(["a pop with nothing open on its thread is ignored",
      [["pop", A, t0], ["push", A, t0 + 1, P], ["pop", B, t0 + 2], ["pop", A, t0 + 1 + x], ["pop", A, t0 + 2 + x]], t0 + 5 + x]);
    edges.push(["ranges still open at the end close at end_ts, inner first",
      [["push", A, t0, P], ["push", A, t0 + 2, Q], ["push", A, t0 + 3, R2], ["pop", A, t0 + 3 + x]], t0 + 10 + x]);
    edges.push(["end_ts equal to the last event closes open ranges with zero extra time",
      [["push", A, t0, P], ["push", B, t0 + 1, Q], ["pop", A, t0 + 4]], t0 + 4]);
  }
  for (const [name, evs, endTs] of edges) tests.push({ name, args: pyArgs(evs, endTs), expect: pyOut(oracle(evs, endTs)) });

  // Timing: 300 000 events on 4 threads, nesting up to 400 deep (deep call stacks in a training step).
  // One stack pass is O(n); finding each range's children by scanning forward is O(n x depth).
  tests.push({
    name: "300,000 events on 4 threads, nesting up to 400 deep (one stack pass, not a scan per range)",
    args: `_gen_trace(300000, 4, 400, ${r.int(1, 1_000_000)}, ${level === 3 ? "True" : "False"})`,
    limit_s: 8,
  });

  return {
    vars: {
      thread_rule: level === 1
        ? "In this trace every range is closed before the end, and every `pop` has a range to close."
        : "Events from different threads are interleaved in the list; several events can share a timestamp, in which case the list order is the order they happened.",
      ragged_rule: level === 3
        ? "The trace was cut out of a longer recording, so it can contain a `pop` on a thread with nothing open (ignore it), and ranges still open at the end (close them at `end_ts`, innermost first)."
        : "Every `pop` in this trace closes a range, and nothing is open at the end.",
    },
    samples,
    tests,
  };
}
