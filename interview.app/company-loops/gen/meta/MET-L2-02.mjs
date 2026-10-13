/* MET-L2-02 — Degrees of separation on a friendship graph (Python, graphs).
   Simulated practice scenario. All data is generated from the seed.

   Contract (python): entry, signature, starter, prelude, generate(r, level) ->
     { vars, samples: [{args, expect}], tests: [{name, args, expect?, limit_s?}] }.
   expect comes from oracle() below: a plain single-source breadth-first search from
   the first user of each query, layer by layer, with shortest-path counts. The
   evaluator's reference searches from both ends, so each checks the other.
   level: 1 Medium (distance within max_depth) · 2 Hard (+ deactivated accounts are
          not part of any chain) · 3 Very Hard (+ count the distinct shortest chains) */
export const kind = "python";
export const entry = "separation";
export const signature = "def separation(friendships: list[tuple[int, int]], queries: list[tuple[int, int]], max_depth: int, inactive: set[int] | None = None, count_paths: bool = False) -> list:";
export const starter = `def separation(friendships, queries, max_depth, inactive=None, count_paths=False):
    """friendships: undirected (user_a, user_b) pairs, possibly repeated.
    For each (u, v) in queries, return the number of friendships on the shortest
    chain from u to v, or -1 if there is none within max_depth."""
    ...
`;

export const prelude = `
def _gen_graph(n, m, seed, base=10000000):
    x, out = seed, []
    while len(out) < m:
        x = (1103515245 * x + 12345) % 2147483648
        a = (x >> 8) % n
        x = (1103515245 * x + 12345) % 2147483648
        b = (x >> 8) % n
        if a != b:
            out.append((base + a, base + b))
    return out


def _gen_queries(n, q, seed, base=10000000):
    x, out = seed, []
    for _ in range(q):
        x = (1103515245 * x + 12345) % 2147483648
        a = (x >> 8) % n
        x = (1103515245 * x + 12345) % 2147483648
        out.append((base + a, base + (x >> 8) % n))
    return out


def _gen_inactive(n, k, seed, base=10000000):
    x, out = seed, set()
    for _ in range(k):
        x = (1103515245 * x + 12345) % 2147483648
        out.add(base + (x >> 8) % n)
    return out
`.trim() + "\n";

// Single-source BFS per query, full layers, with path counts. Small inputs only.
export function oracle(friendships, queries, maxDepth, inactive, countPaths) {
  const off = new Set(inactive || []);
  const adj = new Map();
  const link = (a, b) => { if (!adj.has(a)) adj.set(a, new Set()); adj.get(a).add(b); };
  for (const [a, b] of friendships) { link(a, b); link(b, a); }
  return queries.map(([u, v]) => {
    let d = -1, ways = 0;
    if (!off.has(u) && !off.has(v)) {
      const dist = new Map([[u, 0]]), cnt = new Map([[u, 1]]);
      let layer = [u], depth = 0;
      while (layer.length && depth <= maxDepth && !dist.has(v)) {
        const next = [];
        for (const x of layer) for (const y of adj.get(x) || []) {
          if (off.has(y)) continue;
          if (!dist.has(y)) { dist.set(y, depth + 1); cnt.set(y, 0); next.push(y); }
          if (dist.get(y) === depth + 1) cnt.set(y, cnt.get(y) + cnt.get(x));
        }
        layer = next;
        depth++;
      }
      if (dist.has(v) && dist.get(v) <= maxDepth) { d = dist.get(v); ways = cnt.get(v); }
    }
    return countPaths ? [d, ways] : d;
  });
}

const pyPairs = (ps) => "[" + ps.map(([a, b]) => `(${a}, ${b})`).join(", ") + "]";
const pySet = (xs) => (xs.length ? "{" + xs.join(", ") + "}" : "set()");
const pyArgs = (c) =>
  `(${pyPairs(c.f)}, ${pyPairs(c.q)}, ${c.depth}, ${c.off ? pySet(c.off) : "None"}, ${c.count ? "True" : "False"})`;
const pyOut = (xs) => "[" + xs.map((x) => (Array.isArray(x) ? `(${x[0]}, ${x[1]})` : String(x))).join(", ") + "]";
const run = (c) => oracle(c.f, c.q, c.depth, c.off, c.count);

function randomCase(r, level, base) {
  for (let attempt = 0; attempt < 60; attempt++) {
    const n = r.int(10, 14);
    const ids = Array.from({ length: n }, (_, i) => base + i * r.int(1, 4) + i);
    const f = [];
    const m = r.int(n, n + 7);
    while (f.length < m) {
      const a = r.pick(ids), b = r.pick(ids);
      if (a !== b) f.push([a, b]);
    }
    if (r.chance(0.5)) f.push(r.pick(f).slice().reverse());            // a repeated friendship
    const q = Array.from({ length: r.int(4, 6) }, () => [r.pick(ids), r.pick(ids)]);
    const off = level >= 2 ? r.sample(ids, r.int(1, 2)) : null;
    const c = { f, q, depth: r.int(3, 5), off, count: level === 3 };
    const got = run(c);
    const hits = got.filter((x) => (Array.isArray(x) ? x[0] : x) > 0).length;
    if (hits >= 2) return c;
  }
  throw new Error("MET-L2-02: could not build a sample with reachable pairs");
}

export function generate(r, level) {
  const base = r.pick([1000, 52000, 700100, 3300000]);
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const c = randomCase(r, level, base + i * 100);
    samples.push({ args: pyArgs(c), expect: pyOut(run(c)) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const count = level === 3;
  const u = (k) => base + 500 + k;                     // readable ids for the hand-built cases
  const depth = r.int(3, 5);
  const chain = Array.from({ length: depth + 1 }, (_, i) => [u(i), u(i + 1)]);      // u0 … u(depth+1)
  const edges = [
    ["a user is zero friendships from themselves", { f: [[u(0), u(1)]], q: [[u(0), u(0)]], depth }],
    ["direct friends are one apart, in either direction", { f: [[u(0), u(1)], [u(1), u(2)]], q: [[u(1), u(0)], [u(0), u(1)]], depth }],
    ["a chain of exactly max_depth is reported", { f: chain, q: [[u(0), u(depth)]], depth }],
    ["a chain of max_depth + 1 is not", { f: chain, q: [[u(0), u(depth + 1)]], depth }],
    ["users in different groups are not connected", { f: [[u(0), u(1)], [u(2), u(3)]], q: [[u(0), u(3)], [u(3), u(2)]], depth }],
    ["a user with no friendships at all", { f: [[u(0), u(1)]], q: [[u(0), u(9)], [u(9), u(9)]], depth }],
    ["a repeated friendship row changes nothing",
      { f: [[u(0), u(1)], [u(1), u(0)], [u(1), u(2)], [u(0), u(1)], [u(2), u(3)]], q: [[u(0), u(3)], [u(3), u(0)]], depth }],
  ];
  if (level >= 2) {
    const ring = [[u(0), u(1)], [u(1), u(2)], [u(0), u(3)], [u(3), u(4)], [u(4), u(2)]];
    edges.push(["a deactivated account on the short chain forces the long one", { f: ring, q: [[u(0), u(2)]], depth: 4, off: [u(1)] }]);
    edges.push(["a deactivated account is never an endpoint", { f: ring, q: [[u(1), u(2)], [u(1), u(1)]], depth: 4, off: [u(1)] }]);
    edges.push(["the only chain runs through a deactivated account", { f: chain, q: [[u(0), u(2)]], depth, off: [u(1)] }]);
    edges.push(["an empty set of deactivated accounts", { f: ring, q: [[u(0), u(2)]], depth: 4, off: [] }]);
  }
  if (level === 3) {
    const k = r.int(3, 5);
    const mids = Array.from({ length: k }, (_, i) => u(10 + i));
    const fan = mids.flatMap((m) => [[u(0), m], [m, u(1)]]);
    edges.push([`${k} mutual friends are ${k} shortest chains`, { f: fan, q: [[u(0), u(1)]], depth: 3 }]);
    const layers = [[u(0), u(10)], [u(0), u(11)], [u(10), u(20)], [u(10), u(21)], [u(11), u(20)], [u(11), u(21)], [u(20), u(1)], [u(21), u(1)]];
    edges.push(["two layers of two: four chains of three", { f: layers, q: [[u(0), u(1)], [u(1), u(0)]], depth: 4 }]);
    edges.push(["a repeated row does not double a chain", { f: [...fan, ...fan.slice(0, 2)], q: [[u(0), u(1)]], depth: 3 }]);
    edges.push(["longer chains are not counted", { f: [...fan, [u(0), u(30)], [u(30), u(31)], [u(31), u(1)]], q: [[u(0), u(1)]], depth: 4 }]);
    edges.push(["chains through a deactivated account are not counted", { f: fan, q: [[u(0), u(1)]], depth: 3, off: [mids[0]] }]);
    const star = Array.from({ length: 6 }, (_, i) => [u(0), u(40 + i)]);
    edges.push(["one side much wider than the other",
      { f: [...star, [u(40), u(50)], [u(41), u(50)], [u(50), u(51)], [u(51), u(1)]], q: [[u(0), u(1)], [u(1), u(0)]], depth: 5 }]);
  }
  for (const [name, c] of edges) {
    c.count = count;
    if (level === 1) c.off = null;
    tests.push({ name, args: pyArgs(c), expect: pyOut(run(c)) });
  }

  // Timing: compared with the reference at check time. A one-sided search reaches
  // most of the graph for each query; a two-sided one meets in the middle.
  const n = 60000, m = 300000, q = 600;
  const seed = r.int(1, 1_000_000);
  const off = level >= 2 ? `_gen_inactive(${n}, 1500, ${seed + 2})` : "None";
  tests.push({
    name: `${m.toLocaleString("en-US")} friendships and ${q.toLocaleString("en-US")} queries in time`,
    args: `(_gen_graph(${n}, ${m}, ${seed}), _gen_queries(${n}, ${q}, ${seed + 1}), 6, ${off}, ${count ? "True" : "False"})`,
    limit_s: 8,
  });

  return {
    vars: {
      inactive_rule: level === 1
        ? "In this exercise `inactive` is None: every account is active."
        : "`inactive` is a set of deactivated user ids. A deactivated account is not part of any chain, not even as an endpoint: a query that names one returns -1.",
      count_rule: level === 3
        ? "With `count_paths=True`, return a tuple `(distance, chains)` per query instead, where `chains` is the number of distinct shortest chains (sequences of users) from u to v; return `(0, 1)` when u equals v and `(-1, 0)` when there is no chain within `max_depth`."
        : "`count_paths` is False: return one integer per query.",
    },
    samples,
    tests,
  };
}
