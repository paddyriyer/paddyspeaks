/* MET-L1-04 — "People you may know": friend-of-friend suggestions by mutual friends (Python).
   Simulated practice scenario. All data is generated from the seed.

   Contract: see docs/COMPANY-INTERVIEW-LOOPS.md § Executable templates (python).
   level: 1 Medium (clean undirected edges, top k by mutual friends)
          2 Hard (+ duplicate, reversed and self edges; blocked pairs; a minimum mutual count)
          3 Very Hard (+ users who opted out of being used as a connector) */
export const kind = "python";
export const entry = "suggest";
export const signature =
  "def suggest(edges: list[tuple[int, int]], queries: list[int], k: int, blocked: list[tuple[int, int]] = (), hidden: set[int] = frozenset(), min_mutual: int = 1) -> list[list[tuple[int, int]]]:";
export const starter = `from collections import defaultdict
import heapq

def suggest(edges, queries, k, blocked=(), hidden=frozenset(), min_mutual=1):
    """edges: undirected friendships (a, b). For each user in queries return up to k
    (candidate, mutual_friends) pairs, best first."""
    ...
`;

export const prelude = `
def _gen_graph(n_users, n_edges, seed, messy=False):
    x, out, seen = seed, [], set()
    while len(out) < n_edges:
        x = (1103515245 * x + 12345) % 2147483648
        a = (x >> 8) % n_users
        x = (1103515245 * x + 12345) % 2147483648
        # a few "community" ids make friends-of-friends common, like a real social graph
        b = (a + 1 + (x >> 8) % 400) % n_users if (x >> 4) % 4 else (x >> 8) % n_users
        key = (a, b) if a < b else (b, a)
        if not messy and (a == b or key in seen):
            continue
        seen.add(key)
        out.append((a, b))
    return out

def _gen_ids(n, n_users, seed):
    x, out = seed, []
    for _ in range(n):
        x = (1103515245 * x + 12345) % 2147483648
        out.append((x >> 8) % n_users)
    return out
`.trim() + "\n";

// Brute force over every user pair. Correct and slow; used only for small inputs.
export function oracle(edges, queries, k, blocked, hidden, minMutual) {
  const adj = new Map();
  const add = (a, b) => { if (!adj.has(a)) adj.set(a, new Set()); adj.get(a).add(b); };
  for (const [a, b] of edges) { if (a === b) continue; add(a, b); add(b, a); }
  const users = [...adj.keys()];
  const blockedKey = new Set(blocked.map(([a, b]) => (a < b ? a + "," + b : b + "," + a)));
  const hid = new Set(hidden);
  return queries.map((u) => {
    const mine = adj.get(u);
    if (!mine) return [];
    const out = [];
    for (const v of users) {
      if (v === u || mine.has(v)) continue;
      if (blockedKey.has(u < v ? u + "," + v : v + "," + u)) continue;
      let m = 0;
      for (const f of adj.get(v)) if (mine.has(f) && !hid.has(f)) m++;
      if (m >= minMutual) out.push([v, m]);
    }
    out.sort((x, y) => y[1] - x[1] || x[0] - y[0]);
    return out.slice(0, k);
  });
}

const pyPairs = (xs) => "[" + xs.map(([a, b]) => `(${a}, ${b})`).join(", ") + "]";
const pySet = (xs) => (xs.length ? "{" + xs.join(", ") + "}" : "set()");
const pyOut = (res) => "[" + res.map((l) => pyPairs(l)).join(", ") + "]";
const pyArgs = (c) => `(${pyPairs(c.edges)}, [${c.queries.join(", ")}], ${c.k}, ${pyPairs(c.blocked)}, ${pySet(c.hidden)}, ${c.minMutual})`;
const run = (c) => oracle(c.edges, c.queries, c.k, c.blocked, c.hidden, c.minMutual);

function smallCase(r, level, nUsers) {
  const ids = r.sample([...Array(60)].map((_, i) => 1000 + i * 17), nUsers);
  const edges = [];
  const seen = new Set();
  const target = Math.floor(nUsers * 1.6);
  while (edges.length < target) {
    const a = r.pick(ids), b = r.pick(ids);
    if (a === b) continue;
    const key = a < b ? a + "," + b : b + "," + a;
    if (seen.has(key)) continue;
    seen.add(key);
    edges.push([a, b]);
  }
  if (level >= 2) {
    const e = r.pick(edges);
    edges.push([e[1], e[0]]);                // the same friendship, reversed
    edges.push(r.pick(edges));               // an exact duplicate
    const s = r.pick(ids);
    edges.push([s, s]);                      // a self edge
  }
  const shuffled = r.shuffle(edges);
  const queries = r.sample(ids, 3);
  const blocked = [];
  if (level >= 2) {
    const u = queries[0];
    const res = oracle(shuffled, [u], 99, [], [], 1)[0];
    if (res.length) { const v = res[0][0]; blocked.push(r.chance(0.5) ? [u, v] : [v, u]); }
  }
  const hidden = level === 3 ? r.sample(ids, 2) : [];
  return { edges: shuffled, queries, k: r.pick([2, 3, 4]), blocked, hidden, minMutual: level === 1 ? 1 : r.pick([1, 2]) };
}

export function generate(r, level) {
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const c = smallCase(r, level, 9 + i * 2);
    samples.push({ args: pyArgs(c), expect: pyOut(run(c)) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  // Edge cases with exact rules.
  const u = r.pick([7, 11, 19]);
  const C = (edges, queries, k, extra = {}) => ({ edges, queries, k, blocked: extra.blocked || [], hidden: extra.hidden || [], minMutual: extra.minMutual || 1 });
  const edges = [
    ["ties on mutual friends break by smaller user id", C([[u, 1], [u, 2], [1, 30], [2, 30], [1, 20], [2, 20], [1, 40]], [u], 3)],
    ["an existing friend is never suggested, however many mutuals", C([[u, 1], [u, 2], [u, 3], [1, 3], [2, 3], [1, 50]], [u], 5)],
    ["a user with no friends, and a user not in the graph, get []", C([[1, 2], [u, u + 100]], [3, u + 200], 2)],
    ["k larger than the number of candidates returns them all", C([[u, 1], [1, 2], [1, 3]], [u], 10)],
    ["several queries are answered independently, in order", C([[u, 1], [1, 2], [2, 3], [3, u]], [u, 2, 1], 2)],
  ];
  if (level >= 2) {
    edges.push(["a duplicate or reversed edge is one friendship, not two mutuals", C([[u, 1], [1, u], [u, 1], [1, 9], [9, 1], [u, 2], [2, 9]], [u], 2)]);
    edges.push(["a self edge makes nobody their own friend or candidate", C([[u, u], [u, 1], [1, 1], [1, 5]], [u, 1], 3)]);
    edges.push(["blocked works in either direction", C([[u, 1], [1, 5], [1, 6], [u, 2], [2, 6]], [u, 5], 3, { blocked: [[6, u], [5, 1000]] })]);
    edges.push(["exactly min_mutual mutual friends is enough; one fewer is not", C([[u, 1], [u, 2], [u, 3], [1, 8], [2, 8], [1, 9], [3, 70], [2, 70]], [u], 5, { minMutual: 2 })]);
  }
  if (level === 3) {
    edges.push(["a hidden user does not connect anyone, but can still be suggested", C([[u, 1], [u, 2], [1, 8], [2, 8], [2, 4], [4, 9]], [u, 4], 4, { hidden: [1, 4] })]);
    edges.push(["hiding can drop a candidate below min_mutual", C([[u, 1], [u, 2], [1, 8], [2, 8], [u, 3], [3, 6], [2, 6], [1, 6]], [u], 4, { hidden: [2], minMutual: 2 })]);
  }
  for (const [name, c] of edges) tests.push({ name, args: pyArgs(c), expect: pyOut(run(c)) });

  // Timing: 40 000 users, 300 000 friendships, up to 2 500 queries. Two hops from the query
  // user touch a few hundred users; scanning every user per query does not finish.
  const seed = r.int(1, 1_000_000);
  const nq = level === 1 ? 2000 : 2500;
  const block = level >= 2 ? `[(q, (q * 7 + 3) % 40000) for q in _gen_ids(2000, 40000, ${seed + 1})]` : "[]";
  const hid = level === 3 ? `set(_gen_ids(3000, 40000, ${seed + 2}))` : "set()";
  tests.push({
    name: `${nq.toLocaleString("en-US")} queries over 300 000 friendships in time (two hops per query, never all users)`,
    args: `(_gen_graph(40000, 300000, ${seed}, ${level >= 2 ? "True" : "False"}), _gen_ids(${nq}, 40000, ${seed + 3}), 10, ${block}, ${hid}, ${level === 1 ? 1 : 2})`,
    limit_s: 8,
  });

  return {
    vars: {
      edge_rule:
        level === 1
          ? "Each friendship appears once in `edges`, and nobody is their own friend."
          : "`edges` is raw: the same friendship can appear more than once and in either direction, and a self edge `(a, a)` can occur; none of that changes the graph, which is a set of undirected friendships between different users.",
      block_rule:
        level === 1
          ? "`blocked` is empty and `min_mutual` is 1."
          : "A pair in `blocked` (in either order) is never suggested to each other. Only candidates with at least `min_mutual` mutual friends are returned.",
      hidden_rule:
        level === 3
          ? "Users in `hidden` opted out of being used as a connector: a mutual friend in `hidden` does not count. A hidden user can still be suggested, and can still receive suggestions."
          : "`hidden` is empty.",
    },
    samples,
    tests,
  };
}
