/* SNO-L2-01 — Multi-cluster warehouse simulation (Python).
   Simulated practice scenario. All data is generated from the seed.

   Contract (python): entry, signature, starter, prelude, generate(r, level) ->
     { vars, samples: [{args, expect}], tests: [{name, args, expect?, limit_s?}] }.
   expect comes from oracle() below: it applies the six rules literally at EVERY
   second of the trace (small traces only). The evaluator's reference jumps from
   event to event with a heap, written independently.
   level: 1 Medium (one cluster at rest, scale-out under bursts) · 2 Hard (+ idle
          clusters scale in, the 60-second minimum, quiet gaps) · 3 Very Hard (+ a
          minimum of several clusters, a cluster that starts and is never used,
          finishes, arrivals and readiness in the same second) */
export const kind = "python";
export const entry = "simulate_warehouse";
export const signature = "def simulate_warehouse(queries: list[tuple[str, int, int]], policy: dict) -> tuple[int, int, int, int, float]:";
export const starter = `def simulate_warehouse(queries, policy):
    """queries: (query_id, arrival_s, duration_s) in arrival order; queries that
    arrive in the same second queue in list order.
    policy: {"slots", "min_clusters", "max_clusters", "startup_s", "idle_s",
    "credits_per_hour"}.
    Return (max_wait, total_wait, peak_clusters, billed_seconds, credits),
    credits rounded to 3 decimal places; (0, 0, 0, 0, 0.0) for no queries."""
    ...
`;

export const prelude = `
def _gen_queries(n, seed):
    x, t, out = seed, 0, []
    for i in range(n):
        x = (1103515245 * x + 12345) % 2147483648
        r = (x >> 16) % 1000
        if r < 4:
            t += 20000 + (x >> 4) % 200000
        elif r < 700:
            t += (x >> 8) % 4
        x = (1103515245 * x + 12345) % 2147483648
        out.append(('q%06d' % i, t, 1 + (x >> 16) % 240))
    return out
`.trim() + "\n";

/* The specification, applied at every second from the first arrival to the last
   finish. Only usable on short traces — which is the point of the timing test. */
export function oracle(queries, p) {
  if (!queries.length) return [0, 0, 0, 0, 0];
  const t0 = queries[0][1];
  const clusters = [];                         // {id, started, readyAt, running: [finish...], idleFrom, on}
  for (let c = 1; c <= p.min_clusters; c++) clusters.push({ id: c, started: t0, readyAt: t0, running: [], idleFrom: t0, on: true });
  let nextId = p.min_clusters + 1, qi = 0, done = 0, maxWait = 0, totalWait = 0, peak = p.min_clusters, billed = 0;
  const queue = [];
  let t = t0;
  for (; ; t++) {
    const on = clusters.filter((c) => c.on);
    for (const c of on) {                                             // 1. finishes
      if (c.readyAt >= t) continue;
      const before = c.running.length;
      c.running = c.running.filter((f) => f !== t);
      done += before - c.running.length;
      if (before > 0 && c.running.length === 0) c.idleFrom = t;
    }
    for (const c of on) if (c.readyAt === t && c.id > p.min_clusters) c.idleFrom = t;   // 2. ready
    while (qi < queries.length && queries[qi][1] === t) queue.push(queries[qi++]);      // 3. arrivals
    const ready = on.filter((c) => c.readyAt <= t).sort((a, b) => a.id - b.id);
    while (queue.length) {                                            // 4. dispatch
      const c = ready.find((x) => x.running.length < p.slots);
      if (!c) break;
      const [, arrival, duration] = queue.shift();
      const w = t - arrival;
      totalWait += w;
      maxWait = Math.max(maxWait, w);
      c.running.push(t + duration);
      c.idleFrom = null;
    }
    if (done === queries.length) break;
    const count = () => clusters.filter((c) => c.on).length;
    const isStarting = clusters.some((c) => c.on && c.readyAt > t);
    if (queue.length && !isStarting && count() < p.max_clusters) {    // 5. scale out
      clusters.push({ id: nextId++, started: t, readyAt: t + p.startup_s, running: [], idleFrom: null, on: true });
      peak = Math.max(peak, count());
    }
    const idle = clusters.filter((c) => c.on && c.readyAt <= t && c.running.length === 0 && c.idleFrom !== null && t - c.idleFrom >= p.idle_s)
      .sort((a, b) => b.id - a.id);
    for (const c of idle) {                                           // 6. scale in
      if (count() <= p.min_clusters) break;
      c.on = false;
      billed += Math.max(60, t - c.started);
    }
  }
  for (const c of clusters) if (c.on) billed += Math.max(60, t - c.started);
  return [maxWait, totalWait, peak, billed, Math.round((billed * p.credits_per_hour / 3600) * 1000) / 1000];
}

const pyNum = (x) => (Number.isInteger(x) ? x.toFixed(1) : String(x));
const pyOut = (v) => `(${v[0]}, ${v[1]}, ${v[2]}, ${v[3]}, ${pyNum(v[4])})`;
const pyPolicy = (p) => `{'slots': ${p.slots}, 'min_clusters': ${p.min_clusters}, 'max_clusters': ${p.max_clusters}, 'startup_s': ${p.startup_s}, 'idle_s': ${p.idle_s}, 'credits_per_hour': ${p.credits_per_hour}}`;
const pyArgs = (qs, p) => `([${qs.map(([id, a, d]) => `('${id}', ${a}, ${d})`).join(", ")}], ${pyPolicy(p)})`;

const PREFIX = ["dash", "etl", "adhoc", "rpt", "bi", "nb"];
const SIZES = [["X-Small", 1], ["Small", 2], ["Medium", 4], ["Large", 8]];

function policyFor(r, level) {
  return {
    slots: level === 3 ? r.int(2, 3) : r.int(2, 4),
    min_clusters: level === 3 ? r.int(2, 3) : 1,
    max_clusters: level === 1 ? r.int(2, 3) : r.int(3, 5),
    startup_s: r.pick([5, 10, 15, 20]),
    idle_s: level === 1 ? r.pick([600, 900]) : r.pick([30, 45, 60, 90]),
    credits_per_hour: r.pick(SIZES)[1],
  };
}

function trace(r, level, pre) {
  const n = level === 1 ? r.int(8, 12) : level === 2 ? r.int(12, 18) : r.int(16, 24);
  const out = [];
  let t = r.int(0, 50) * 60;
  for (let i = 0; i < n; i++) {
    const roll = r.next();
    if (level >= 2 && roll < 0.12) t += r.int(100, 400);             // a quiet spell: clusters go idle
    else if (roll < (level === 3 ? 0.7 : 0.55)) t += r.int(0, level === 3 ? 1 : 4);   // a burst
    else t += r.int(3, 25);
    out.push([`${pre}-${String(i + 1).padStart(3, "0")}`, t, r.int(level === 3 ? 1 : 5, level === 1 ? 90 : level === 2 ? 150 : 200)]);
  }
  return out;
}

export function generate(r, level) {
  const pre = r.pick(PREFIX);
  const policy = policyFor(r, level);
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const qs = trace(r, level, pre);
    samples.push({ args: pyArgs(qs, policy), expect: pyOut(oracle(qs, policy)) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const P = (o) => Object.assign({ slots: 2, min_clusters: 1, max_clusters: 3, startup_s: 10, idle_s: 60, credits_per_hour: r.pick(SIZES)[1] }, o);
  const base = r.int(1, 20) * 100;
  const q = (k, at, d) => [`${pre}-e${k}`, base + at, d];
  const edges = [
    ["no queries: the warehouse never resumes", [], P({})],
    ["a query arriving in the second another finishes takes its slot without waiting",
      [q(1, 0, 30), q(2, 0, 30), q(3, 30, 10)], P({ max_clusters: 1 })],
    ["one cluster only: the queue waits for the next free slot",
      [q(1, 0, 40), q(2, 1, 40), q(3, 2, 15), q(4, 3, 5)], P({ max_clusters: 1 })],
    ["a queued query starts on the new cluster the second it is ready",
      [q(1, 0, 100), q(2, 0, 100), q(3, 0, 100)], P({ startup_s: 17 })],
    ["only one cluster starts at a time, even with a long queue",
      [q(1, 0, 200), q(2, 0, 200), q(3, 0, 200), q(4, 0, 200), q(5, 0, 200), q(6, 0, 200), q(7, 0, 200)], P({ max_clusters: 4, startup_s: 10 })],
    ["the lowest-numbered cluster with a free slot takes the query, so the extra one goes idle and scales in",
      [q(1, 0, 50), q(2, 0, 50), q(3, 0, 50), q(4, 70, 5), q(5, 300, 5)], P({ idle_s: 40 })],
    ["an extra cluster that is used for a few seconds is billed for 60",
      [q(1, 0, 20), q(2, 0, 20), q(3, 0, 25)], P({ startup_s: 5, idle_s: 30 })],
    ["a query arriving exactly when a cluster reaches idle_s keeps it on",
      [q(1, 0, 40), q(2, 0, 40), q(3, 0, 40), q(4, 90, 10)], P({ startup_s: 10, idle_s: 40 })],
    ["the minimum number of clusters never scales in",
      [q(1, 0, 5), q(2, 500, 5)], P({ min_clusters: 2, max_clusters: 3, idle_s: 30 })],
  ];
  if (level === 3) {
    edges.push(["a cluster that starts but is never used still costs 60 seconds",
      [q(1, 0, 12), q(2, 0, 12), q(3, 0, 12)], P({ startup_s: 30, idle_s: 30 })]);
    edges.push(["a finish, an arrival and a cluster becoming ready all in one second",
      [q(1, 0, 20), q(2, 0, 20), q(3, 0, 30), q(4, 20, 30), q(5, 20, 30)], P({ startup_s: 20, idle_s: 30 })]);
  }
  for (const [name, qs, p] of edges) tests.push({ name, args: pyArgs(qs, p), expect: pyOut(oracle(qs, p)) });

  // Timing: bursts separated by quiet gaps of hours to days. Stepping second by
  // second covers tens of millions of seconds; jumping between events does not.
  const n = level === 1 ? 60000 : 100000;
  tests.push({
    name: `${n.toLocaleString("en-US")} queries over months (event-driven)`,
    args: `(_gen_queries(${n}, ${r.int(1, 1_000_000)}), {'slots': 8, 'min_clusters': ${level === 3 ? 2 : 1}, 'max_clusters': 10, 'startup_s': 30, 'idle_s': 300, 'credits_per_hour': 4})`,
    limit_s: 8,
  });

  const [sizeName] = SIZES.find(([, c]) => c === policy.credits_per_hour);
  return {
    vars: {
      warehouse: `${pre.toUpperCase()}_WH`,
      size_rule: `In the samples the warehouse is ${sizeName} (${policy.credits_per_hour} credit${policy.credits_per_hour > 1 ? "s" : ""} per cluster-hour), each cluster runs ${policy.slots} queries at once, and it may run between ${policy.min_clusters} and ${policy.max_clusters} clusters.`,
      level_rule: level === 1
        ? "This replay is mostly bursts, so you will see clusters start; the checks also cover scale-in."
        : level === 2
          ? "This replay has bursts and quiet spells, so clusters both start and shut down."
          : "This replay keeps several clusters at rest and has many events in the same second; the order of the six steps decides the answer.",
    },
    samples,
    tests,
  };
}
