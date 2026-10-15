/* CRW-L2-02 — Private interconnect plan (Python, minimum spanning tree: Kruskal + union-find).
   Simulated practice scenario. All data is generated from the seed; every cost and
   topology is hypothetical.

   Contract (python): entry, signature, starter, prelude, generate(r, level) ->
     { vars, samples: [{args, expect}], tests: [{name, args, expect?, limit_s?}] }.
   expect comes from oracle() below: links in (cost, link id) order, each kept when a
   breadth-first search over the links kept so far cannot already reach one end from
   the other. The evaluator's reference is Kruskal with union-find, so each checks the
   other. With (cost, link id) as a strict order the plan is unique, so Prim with a
   heap keyed the same way returns the same answer.
   level: 1 Medium (every link valid, a plan always exists)
          2 Hard (+ self-links, links naming unknown clusters, parallel links, and
            inputs where no plan exists -> None)
          3 Very Hard (+ links the customer already has, which are free and count
            as joined) */
export const kind = "python";
export const entry = "interconnect_plan";
export const signature = "def interconnect_plan(clusters: list[str], links: list[tuple[str, str, str, int]], existing: list[tuple[str, str]] = ()) -> tuple[int, list[str]] | None:";
export const starter = `def interconnect_plan(clusters, links, existing=()):
    """clusters: the customer's cluster ids.
    links: (link_id, cluster_a, cluster_b, monthly_cost) candidate private links.
    existing: (cluster_a, cluster_b) links the customer already has (free).
    Return (total_cost, sorted ids of the links to buy) for the cheapest plan that
    joins every cluster, preferring the smaller link id on equal cost, or None."""
    ...
`;

export const prelude = `
def _gen_links(n_clusters, n_links, seed, junk=0, n_existing=0):
    x = seed

    def nxt():
        nonlocal x
        x = (1103515245 * x + 12345) % 2147483648
        return x >> 8
    clusters = ['cl-%05d' % i for i in range(n_clusters)]
    order = clusters[:]
    for i in range(len(order) - 1, 0, -1):
        j = nxt() % (i + 1)
        order[i], order[j] = order[j], order[i]
    pairs = [(order[i], order[nxt() % i]) for i in range(1, n_clusters)]
    while len(pairs) < n_links:
        a, b = clusters[nxt() % n_clusters], clusters[nxt() % n_clusters]
        if junk and nxt() % 100 < junk:
            b = a if nxt() % 2 else 'cl-x%04d' % (nxt() % 1000)
        pairs.append((a, b))
    links = [('lk-%06d' % k, a, b, 100 * (1 + nxt() % 60)) for k, (a, b) in enumerate(pairs)]
    for i in range(len(links) - 1, 0, -1):
        j = nxt() % (i + 1)
        links[i], links[j] = links[j], links[i]
    existing = [(clusters[nxt() % n_clusters], clusters[nxt() % n_clusters]) for _ in range(n_existing)]
    return clusters, links, existing
`.trim() + "\n";

// Links in (cost, id) order; keep one when a BFS over what is kept cannot already
// connect its ends. Quadratic, small inputs only.
export function oracle(clusters, links, existing) {
  const known = new Set(clusters);
  const adj = new Map(clusters.map((c) => [c, []]));
  const join = (a, b) => { adj.get(a).push(b); adj.get(b).push(a); };
  const reach = (a) => {
    const seen = new Set([a]);
    const queue = [a];
    while (queue.length) {
      const u = queue.shift();
      for (const w of adj.get(u)) if (!seen.has(w)) { seen.add(w); queue.push(w); }
    }
    return seen;
  };
  for (const [a, b] of existing) join(a, b);
  const sorted = links.slice().sort((x, y) => x[3] - y[3] || (x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : 0));
  const chosen = [];
  let total = 0;
  for (const [id, a, b, cost] of sorted) {
    if (a === b || !known.has(a) || !known.has(b)) continue;
    if (reach(a).has(b)) continue;
    join(a, b);
    chosen.push(id);
    total += cost;
  }
  if (clusters.length && reach(clusters[0]).size < clusters.length) return null;
  chosen.sort();
  return [total, chosen];
}

const q = (s) => `'${s}'`;
const pyArgs = (c) => `([${c.clusters.map(q).join(", ")}], [${c.links.map(([i, a, b, k]) => `(${q(i)}, ${q(a)}, ${q(b)}, ${k})`).join(", ")}], [${c.existing.map(([a, b]) => `(${q(a)}, ${q(b)})`).join(", ")}])`;
const pyOut = (v) => (v === null ? "None" : `(${v[0]}, [${v[1].map(q).join(", ")}])`);
const run = (c) => oracle(c.clusters, c.links, c.existing);

const SITES = ["use1", "use2", "usc1", "usw1", "eun1", "eus1", "ukw1", "use3"];

function ids(r, n) {
  const used = new Set();
  const out = [];
  while (out.length < n) {
    const id = "lk-" + String(r.int(1, 9999)).padStart(4, "0");
    if (!used.has(id)) { used.add(id); out.push(id); }
  }
  return out;
}

function names(r, n) {
  const sites = r.sample(SITES, 3);
  const used = new Set();
  const out = [];
  while (out.length < n) {
    const c = `${r.pick(sites)}-c${String(r.int(1, 40)).padStart(2, "0")}`;
    if (!used.has(c)) { used.add(c); out.push(c); }
  }
  return out;
}

function randomCase(r, level) {
  for (let attempt = 0; attempt < 100; attempt++) {
    const n = r.int(5, 9);
    const clusters = names(r, n);
    const order = r.shuffle(clusters);
    const pairs = [];
    for (let i = 1; i < n; i++) pairs.push([order[i], order[r.int(0, i - 1)]]);
    const m = r.int(n + 3, 2 * n + 4);
    while (pairs.length < m) {
      let [a, b] = r.sample(clusters, 2);
      if (level >= 2 && r.chance(0.15)) b = r.chance(0.5) ? a : `${a.slice(0, 4)}-c9${r.int(0, 9)}`;
      pairs.push([a, b]);
    }
    const lid = ids(r, pairs.length);
    const costs = [100, 150, 200, 250, 300, 400].map((x) => x * r.int(1, 3));
    const links = r.shuffle(pairs.map(([a, b], i) => [lid[i], a, b, r.pick(costs)]));
    const existing = level === 3 ? Array.from({ length: r.int(1, 3) }, () => r.sample(clusters, 2)) : [];
    const c = { clusters: r.shuffle(clusters), links, existing };
    if (run(c) !== null) return c;
  }
  throw new Error("CRW-L2-02: could not build a sample");
}

export function generate(r, level) {
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const c = randomCase(r, level);
    samples.push({ args: pyArgs(c), expect: pyOut(run(c)) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const [A, B, C, D] = names(r, 4);
  const [i1, i2, i3, i4, i5, i6] = ids(r, 6).sort();
  const k = 100 * r.int(2, 9);
  const edges = [
    ["on equal cost, the smaller link id is bought",
      { clusters: [A, B], links: [[i2, A, B, k], [i1, B, A, k]], existing: [] }],
    ["a triangle of equal costs keeps the two smallest ids",
      { clusters: [A, B, C], links: [[i3, A, B, k], [i1, B, C, k], [i2, C, A, k]], existing: [] }],
    ["a cheap link that closes a cycle is skipped",
      { clusters: [A, B, C, D], links: [[i1, A, B, k], [i2, B, C, k], [i3, A, C, k + 50], [i4, C, D, 3 * k], [i5, A, D, 3 * k + 100]], existing: [] }],
    ["one cluster needs no links",
      { clusters: [A], links: [], existing: [] }],
    ["taking each cluster's cheapest link leaves two groups unjoined",
      { clusters: [A, B, C, D], links: [[i1, A, B, k], [i2, C, D, k], [i3, A, C, 2 * k], [i4, B, D, 2 * k], [i5, A, D, 2 * k + 50]], existing: [] }],
  ];
  if (level >= 2) {
    edges.push(["a self-link and a link to an unknown cluster are ignored",
      { clusters: [A, B, C], links: [[i1, A, A, 10], [i2, B, "zz-c99", 10], [i3, A, B, k], [i4, B, C, k], [i5, A, C, 2 * k]], existing: [] }]);
    edges.push(["parallel links: the cheaper one, then the smaller id",
      { clusters: [A, B, C], links: [[i4, A, B, k], [i2, A, B, k + 10], [i5, B, C, k], [i3, C, B, k]], existing: [] }]);
    edges.push(["two groups with no link between them have no plan",
      { clusters: [A, B, C, D], links: [[i1, A, B, k], [i2, C, D, k], [i3, D, C, k]], existing: [] }]);
    edges.push(["a cluster with only a self-link has no plan",
      { clusters: [A, B, C], links: [[i1, A, B, k], [i2, C, C, k]], existing: [] }]);
  }
  if (level === 3) {
    edges.push(["an existing link makes a purchase unnecessary",
      { clusters: [A, B, C], links: [[i1, A, B, k], [i2, B, C, k], [i3, A, C, 2 * k]], existing: [[A, B]] }]);
    edges.push(["existing links already join everything",
      { clusters: [A, B, C], links: [[i1, A, B, k], [i2, B, C, k]], existing: [[C, A], [A, B], [B, C]] }]);
    edges.push(["an existing link between two clusters changes which equal-cost links are bought",
      { clusters: [A, B, C, D], links: [[i1, A, B, k], [i2, C, D, k], [i3, B, C, k], [i4, A, D, k]], existing: [[B, D]] }]);
  }
  for (const [name, c] of edges) tests.push({ name, args: pyArgs(c), expect: pyOut(run(c)) });

  // Timing: compared with the reference at check time.
  const seed = r.int(1, 1_000_000);
  const [junk, nExisting] = level === 1 ? [0, 0] : level === 2 ? [3, 0] : [3, 400];
  tests.push({
    name: "8,000 clusters and 100,000 candidate links in time",
    args: `_gen_links(8000, 100000, ${seed}, ${junk}, ${nExisting})`,
    limit_s: 8,
  });

  return {
    vars: {
      level_rule: level === 1
        ? "In this exercise every link joins two different known clusters, `existing` is empty, and a plan always exists."
        : level === 2
          ? "Some links are unusable and must be ignored: a link from a cluster to itself, or one that names a cluster not in `clusters`. Two links can join the same pair. If no plan joins every cluster, return `None`. `existing` is empty."
          : "Some links are unusable and must be ignored (a link from a cluster to itself, or one naming an unknown cluster), two links can join the same pair, and if no plan joins every cluster you return `None`. `existing` lists links the customer already has: they cost nothing, count as joining their two clusters, and never appear in the answer.",
    },
    samples,
    tests,
  };
}
