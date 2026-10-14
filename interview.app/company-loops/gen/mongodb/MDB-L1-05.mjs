/* MDB-L1-05 — Search postings: documents containing every query term, scored by term frequency (Python).
   Simulated practice scenario. All data is generated from the seed. The index is this exercise's
   simplified model of an inverted index (posting lists of (doc_id, term frequency) sorted by
   doc_id, plus a set of deleted documents not yet merged away); check current docs for how a
   real full-text search index scores and stores documents.

   Contract (python): entry, signature, starter, prelude, generate(r, level) ->
     { vars, samples: [{args, expect}], tests: [{name, args, expect?, limit_s?}] }.
   expect comes from oracle() below, which checks every document against every term (fine for
   small inputs). The evaluator's reference intersects posting lists, shortest first.
   level: 1 Medium (AND of 1–3 terms; score = sum of tf; top k with doc_id ties; absent terms)
          2 Hard (+ deleted documents; a term repeated in a query counts once)
          3 Very Hard (+ excluded terms written "-term"; a query with no required term) */
export const kind = "python";
export const entry = "search";
export const signature = "def search(postings: dict[str, list[tuple[int, int]]], queries: list[list[str]], k: int, deleted: set[int] | None = None) -> list[list[tuple[int, int]]]:";
export const starter = `def search(postings, queries, k, deleted=None):
    """postings: term -> [(doc_id, tf), ...] sorted by doc_id.
    queries: a list of queries, each a list of terms.
    Return, per query, up to k (doc_id, score) pairs: highest score first, ties by doc_id."""
    ...
`;

export const prelude = `
def _gen_index(n_docs, n_terms, n_queries, seed, deletes=False, negatives=False):
    x = seed
    def rnd(m):
        nonlocal x
        x = (1103515245 * x + 12345) % 2147483648
        return (x >> 8) % m
    postings = {}
    for j in range(n_terms):
        length = 20000 + rnd(20000) if j % 100 == 0 else 50 + rnd(1500)
        step = max(2, (2 * n_docs) // length)
        d, plist = rnd(step), []
        while d < n_docs:
            plist.append((d, 1 + rnd(9)))
            d += 1 + rnd(step)
        postings['w%d' % j] = plist
    queries = []
    for _ in range(n_queries):
        q = ['w%d' % (rnd(n_terms // 100) * 100) if rnd(4) == 0 else 'w%d' % rnd(n_terms)]
        for _ in range(1 + rnd(2)):
            q.append('w%d' % rnd(n_terms))
        if negatives and rnd(3) == 0:
            q.append('-w%d' % rnd(n_terms))
        queries.append(q)
    deleted = {rnd(n_docs) for _ in range(n_docs // 20)} if deletes else None
    return postings, queries, 10, deleted
`.trim() + "\n";

// Brute force: every document against every term.
export function oracle(postings, queries, k, deleted) {
  const gone = new Set(deleted || []);
  const maps = Object.fromEntries(Object.entries(postings).map(([t, pl]) => [t, new Map(pl)]));
  const docs = [...new Set(Object.values(postings).flatMap((pl) => pl.map(([d]) => d)))].sort((a, b) => a - b);
  return queries.map((q) => {
    const pos = [...new Set(q.filter((t) => !t.startsWith("-")))];
    const neg = q.filter((t) => t.startsWith("-")).map((t) => t.slice(1));
    if (!pos.length) return [];
    const hits = [];
    for (const d of docs) {
      if (gone.has(d)) continue;
      if (!pos.every((t) => maps[t] && maps[t].has(d))) continue;
      if (neg.some((t) => maps[t] && maps[t].has(d))) continue;
      hits.push([d, pos.reduce((s, t) => s + maps[t].get(d), 0)]);
    }
    hits.sort((a, b) => b[1] - a[1] || a[0] - b[0]);
    return hits.slice(0, k);
  });
}

const pyArgs = (postings, queries, k, deleted) =>
  "({" + Object.entries(postings).map(([t, pl]) => `'${t}': [${pl.map(([d, f]) => `(${d}, ${f})`).join(", ")}]`).join(", ") + "}, " +
  "[" + queries.map((q) => "[" + q.map((t) => `'${t}'`).join(", ") + "]").join(", ") + "], " + k + ", " +
  (deleted == null ? "None" : deleted.length ? "{" + deleted.join(", ") + "}" : "set()") + ")";
const pyOut = (res) => "[" + res.map((hits) => "[" + hits.map(([d, s]) => `(${d}, ${s})`).join(", ") + "]").join(", ") + "]";

const WORDS = ["replica", "shard", "index", "cursor", "oplog", "bucket", "schema", "atlas", "vector", "backup", "region", "driver", "aggregation", "pipeline", "election", "chunk"];

function randomCase(r, level) {
  for (let attempt = 0; attempt < 100; attempt++) {
    const nDocs = r.int(12, 20);
    const words = r.sample(WORDS, r.int(5, 7));
    const postings = {};
    for (const w of words) {
      const share = r.pick([0.3, 0.5, 0.7]);
      const pl = [];
      for (let d = 1; d <= nDocs; d++) if (r.chance(share)) pl.push([100 + d, r.int(1, 4)]);
      if (pl.length) postings[w] = pl;
    }
    const terms = Object.keys(postings);
    const queries = [];
    for (let i = 0, n = r.int(3, 5); i < n; i++) {
      const q = r.sample(terms, r.int(1, 3));
      if (r.chance(0.15)) q.push(r.pick(WORDS.filter((w) => !terms.includes(w))));       // not in the index
      if (level >= 2 && r.chance(0.3)) q.push(q[0]);                                       // repeated term
      if (level === 3 && r.chance(0.4)) q.push("-" + r.pick(terms.filter((t) => !q.includes(t)).concat(["zzz"])));
      queries.push(q);
    }
    if (level === 3 && r.chance(0.5)) queries.push(["-" + r.pick(terms)]);
    const k = r.int(2, 4);
    const deleted = level >= 2 ? r.sample([...Array(nDocs).keys()].map((d) => 101 + d), r.int(1, 3)).sort((a, b) => a - b) : null;
    const res = oracle(postings, queries, k, deleted);
    if (res.filter((x) => x.length).length >= 2) return { postings, queries, k, deleted, res };
  }
  throw new Error("MDB-L1-05: could not build a sample");
}

export function generate(r, level) {
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const c = randomCase(r, level);
    samples.push({ args: pyArgs(c.postings, c.queries, c.k, c.deleted), expect: pyOut(c.res) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const [A, B, C] = r.sample(WORDS, 3);
  const base = 10 * r.int(1, 90);
  const P = {
    [A]: [[base + 1, 3], [base + 2, 1], [base + 4, 2], [base + 7, 3], [base + 9, 1]],
    [B]: [[base + 2, 2], [base + 4, 1], [base + 7, 2], [base + 8, 5]],
    [C]: [[base + 3, 4], [base + 8, 1]],
  };
  const edges = [
    ["one term: highest tf first, ties by smaller doc_id", P, [[A]], 3, null],
    ["every term must match; the score adds the tfs", P, [[A, B]], 5, null],
    ["k larger than the number of matches returns all of them", P, [[B, A]], 10, null],
    ["a term that is not in the index matches nothing", P, [[A, "nosuchterm"]], 3, null],
    ["terms that never occur together give an empty result", P, [[A, C]], 3, null],
    ["an empty list of queries", P, [], 3, null],
  ];
  if (level >= 2) {
    edges.push(["a deleted document is never returned, even with the best score", P, [[A, B], [A]], 2, [base + 7]]);
    edges.push(["a term repeated in a query counts once", P, [[A, B, A]], 3, []]);
  }
  if (level === 3) {
    edges.push(["an excluded term removes documents that contain it", P, [[A, "-" + C]], 5, []]);
    edges.push(["a query with only excluded terms returns nothing", P, [["-" + C]], 5, []]);
    edges.push(["excluding a term that is not in the index excludes nothing", P, [[B, "-nosuchterm"]], 5, []]);
    edges.push(["a term both required and excluded matches nothing", P, [[A, "-" + A]], 5, []]);
  }
  for (const [name, p, q, k, del] of edges) tests.push({ name, args: pyArgs(p, q, k, del), expect: pyOut(oracle(p, q, k, del)) });

  // Timing: 300 000 documents, 1 200 terms (about 1.3 million postings), 400 queries. Checking
  // every document for every query is far too slow; intersecting the query's lists is fast.
  const seed = r.int(1, 1_000_000);
  tests.push({
    name: "300,000 documents, 400 queries (work proportional to the query's posting lists, not to N)",
    args: `_gen_index(300000, 1200, 400, ${seed}, ${level >= 2 ? "True" : "False"}, ${level === 3 ? "True" : "False"})`,
    limit_s: 8,
  });

  return {
    vars: {
      deleted_rule: level === 1
        ? "`deleted` is None: no document has been deleted."
        : "`deleted` is a set of doc_ids that were deleted after their postings were written; they still appear in posting lists but must never be returned.",
      term_rule: level === 1
        ? "Every term in a query is required."
        : level === 2
          ? "Every term in a query is required; a term repeated in one query counts once."
          : "A term is required unless it is written `-term`, which excludes every document containing `term`. A repeated term counts once. A query with no required term returns an empty list.",
    },
    samples,
    tests,
  };
}
