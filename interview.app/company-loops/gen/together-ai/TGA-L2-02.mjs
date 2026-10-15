/* TGA-L2-02 — Per-tenant latency questions (Python, offline threshold order + Fenwick tree).
   Simulated practice scenario. All data is generated from the seed; every tenant,
   model, timestamp and latency is hypothetical.

   Contract (python): entry, signature, starter, prelude, generate(r, level) ->
     { vars, samples: [{args, expect}], tests: [{name, args, expect?, limit_s?}] }.
   expect comes from oracle() below, which scans every request for every query. The
   evaluator's reference answers the queries offline, by descending threshold, with a
   Fenwick tree over time per tenant, so each checks the other.
   level: 1 Medium (every request has a latency, every query is well formed, all models)
          2 Hard (+ failed requests with no latency, which never count, and malformed
            queries, answered -1)
          3 Very Hard (+ queries limited to one model) */
export const kind = "python";
export const entry = "slow_request_counts";
export const signature = "def slow_request_counts(requests: list[tuple[str, int, int | None, str]], queries: list[tuple[str, int, int, int, str | None]]) -> list[int]:";
export const starter = `def slow_request_counts(requests, queries):
    """requests: (tenant, ts, latency_ms, model), in no particular order.
    queries: (tenant, t_from, t_to, threshold_ms, model); model None means all models.
    Return one int per query: the tenant's requests with t_from <= ts < t_to
    and latency_ms > threshold_ms."""
    ...
`;

export const prelude = `
def _gen_latency(n, q, tenants, seed, fail_pct=0, models=0, bad_pct=0):
    x = seed

    def nxt():
        nonlocal x
        x = (1103515245 * x + 12345) % 2147483648
        return x >> 8
    names = ['tn-%03d' % k for k in range(tenants)]
    mods = ['m-%d' % k for k in range(models)] if models else ['m-0']
    reqs = []
    for i in range(n):
        lat = None if fail_pct and nxt() % 100 < fail_pct else 20 + nxt() % 3000
        reqs.append((names[nxt() % tenants], i * 7 + nxt() % 7, lat, mods[nxt() % len(mods)]))
    span = n * 7
    qs = []
    for _ in range(q):
        a = nxt() % (span // 3)
        b = span - nxt() % (span // 3)
        if bad_pct and nxt() % 100 < bad_pct:
            a, b = b, a
        m = mods[nxt() % len(mods)] if models and nxt() % 2 else None
        qs.append(((names + ['tn-999'])[nxt() % (tenants + 1)], a, b, 20 + nxt() % 3000, m))
    return reqs, qs
`.trim() + "\n";

// The specification, directly: every query scans every request. Small inputs only.
export function oracle(requests, queries) {
  return queries.map(([tenant, from, to, threshold, model]) => {
    if (from >= to) return -1;
    let n = 0;
    for (const [t, ts, lat, m] of requests) {
      if (t !== tenant || lat === null) continue;
      if (model !== null && m !== model) continue;
      if (ts >= from && ts < to && lat > threshold) n += 1;
    }
    return n;
  });
}

const pyS = (s) => (s === null ? "None" : `'${s}'`);
const pyN = (v) => (v === null ? "None" : String(v));
const pyArgs = (c) => `([${c.requests.map(([t, ts, l, m]) => `(${pyS(t)}, ${ts}, ${pyN(l)}, ${pyS(m)})`).join(", ")}], `
  + `[${c.queries.map(([t, a, b, th, m]) => `(${pyS(t)}, ${a}, ${b}, ${th}, ${pyS(m)})`).join(", ")}])`;
const pyOut = (xs) => "[" + xs.join(", ") + "]";
const run = (c) => oracle(c.requests, c.queries);

const TENANTS = ["tn-acorn", "tn-birch", "tn-cedar", "tn-delta", "tn-ember", "tn-fjord", "tn-grove"];
const MODELS = ["llama-70b", "qwen-32b", "mixtral-8x7b", "gemma-27b", "deepseek-v3"];

function randomCase(r, level) {
  for (let attempt = 0; attempt < 100; attempt++) {
    const tenants = r.sample(TENANTS, r.int(2, 3));
    const models = r.sample(MODELS, 2);
    const n = r.int(12, 16);
    const requests = [];
    for (let i = 0; i < n; i++) {
      const lat = level >= 2 && r.chance(0.12) ? null : 10 * r.int(5, 90);
      requests.push([r.pick(tenants), r.int(0, 60), lat, r.pick(models)]);
    }
    const queries = [];
    for (let i = 0; i < r.int(5, 7); i++) {
      const tenant = r.chance(0.1) ? r.pick(TENANTS.filter((t) => !tenants.includes(t))) : r.pick(tenants);
      let a = r.int(0, 40), b = a + r.int(5, 30);
      if (level >= 2 && r.chance(0.12)) [a, b] = r.chance(0.5) ? [b, a] : [a, a];
      const threshold = r.chance(0.4) ? r.pick(requests)[2] ?? 300 : 10 * r.int(5, 90);
      const model = level === 3 && r.chance(0.5) ? r.pick(models) : null;
      queries.push([tenant, a, b, threshold, model]);
    }
    const c = { requests, queries };
    const out = run(c);
    if (out.filter((x) => x > 0).length >= 2 && out.some((x) => x === 0 || x === -1)) return c;
  }
  throw new Error("TGA-L2-02: could not build a varied sample");
}

export function generate(r, level) {
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const c = randomCase(r, level);
    samples.push({ args: pyArgs(c), expect: pyOut(run(c)) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const [T, U, V] = r.sample(TENANTS, 3);
  const [M, N] = r.sample(MODELS, 2);
  const th = 10 * r.int(20, 50);
  const t0 = r.int(100, 900);
  const req = (t, dt, lat, m = M) => [t, t0 + dt, lat, m];
  const edges = [
    ["a latency equal to the threshold is not slower than it",
      { requests: [req(T, 1, th), req(T, 2, th + 1), req(T, 3, th - 1)], queries: [[T, t0, t0 + 10, th, null], [T, t0, t0 + 10, th - 1, null]] }],
    ["t_from is inclusive and t_to is exclusive",
      { requests: [req(T, 0, th + 50), req(T, 5, th + 50), req(T, 10, th + 50)], queries: [[T, t0, t0 + 10, th, null], [T, t0 + 1, t0 + 11, th, null], [T, t0 + 10, t0 + 11, th, null]] }],
    ["requests at the same timestamp are all counted",
      { requests: [req(T, 4, th + 10), req(T, 4, th + 20), req(T, 4, th + 30), req(T, 4, th - 10)], queries: [[T, t0 + 4, t0 + 5, th, null], [T, t0 + 4, t0 + 5, th + 15, null]] }],
    ["another tenant's slow requests are never counted",
      { requests: [req(T, 2, th + 100), req(U, 2, th + 900), req(U, 3, th + 900), req(T, 3, th - 100)], queries: [[T, t0, t0 + 10, th, null], [U, t0, t0 + 10, th, null]] }],
    ["a tenant with no requests gets 0",
      { requests: [req(T, 2, th + 100), req(U, 3, th + 100)], queries: [[V, t0, t0 + 10, 0, null], [T, t0, t0 + 10, 0, null]] }],
    ["the same range at several thresholds, in no particular order",
      { requests: [req(T, 1, th - 200), req(T, 2, th), req(T, 3, th + 200), req(T, 4, th + 400), req(T, 5, th + 600)],
        queries: [[T, t0, t0 + 10, th + 300, null], [T, t0, t0 + 10, 0, null], [T, t0, t0 + 10, th + 1000, null], [T, t0, t0 + 10, th - 1, null]] }],
  ];
  if (level >= 2) {
    edges.push(["a failed request has no latency and is never counted",
      { requests: [req(T, 1, null), req(T, 2, th + 50), req(T, 3, null)], queries: [[T, t0, t0 + 10, 0, null], [T, t0, t0 + 2, 0, null]] }]);
    edges.push(["a query with t_from >= t_to is malformed and answered -1",
      { requests: [req(T, 1, th + 50), req(T, 2, th + 50)], queries: [[T, t0 + 5, t0, 0, null], [T, t0 + 1, t0 + 1, 0, null], [T, t0, t0 + 5, 0, null]] }]);
  }
  if (level === 3) {
    edges.push(["a query can be limited to one model",
      { requests: [req(T, 1, th + 50, M), req(T, 2, th + 50, N), req(T, 3, th + 50, N), req(U, 3, th + 50, M)],
        queries: [[T, t0, t0 + 10, th, M], [T, t0, t0 + 10, th, N], [T, t0, t0 + 10, th, null], [U, t0, t0 + 10, th, N]] }]);
    edges.push(["a model the tenant never called gets 0",
      { requests: [req(T, 1, th + 50, M), req(T, 2, th + 50, M)], queries: [[T, t0, t0 + 10, 0, N], [T, t0, t0 + 10, 0, M]] }]);
  }
  for (const [name, c] of edges) tests.push({ name, args: pyArgs(c), expect: pyOut(run(c)) });

  // Timing: compared with the reference at check time. Few tenants and wide ranges, so a
  // query's slice of its tenant's requests holds tens of thousands of rows.
  const seed = r.int(1, 1_000_000);
  const tenants = level === 3 ? 3 : r.int(3, 5);
  const [n, q, failPct, models, badPct] = level === 1 ? [150000, 30000, 0, 0, 0]
    : level === 2 ? [150000, 30000, 5, 0, 5] : [120000, 30000, 5, 3, 5];
  tests.push({
    name: `${n.toLocaleString("en-US")} requests and ${q.toLocaleString("en-US")} queries over ${tenants} tenants in time`,
    args: `_gen_latency(${n}, ${q}, ${tenants}, ${seed}, ${failPct}, ${models}, ${badPct})`,
    limit_s: 8,
  });

  const metric = r.pick(["an end-to-end latency", "a time to first token"]);
  return {
    vars: {
      metric,
      level_rule: level === 1
        ? "In this exercise every request has a latency, every query has t_from below t_to, and every query's model is None (all models)."
        : level === 2
          ? "Some requests failed and have latency_ms set to None: they are never counted. A query whose t_from is at or after its t_to is malformed and its answer is -1. Every query's model is None (all models)."
          : "Some requests failed (latency_ms is None) and are never counted, a query whose t_from is at or after its t_to is answered -1, and a query's model can name one model, in which case only the tenant's requests to that model count (None still means all models).",
    },
    samples,
    tests,
  };
}
