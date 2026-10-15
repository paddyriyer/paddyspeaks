/* XAI-L1-04 — Fusing web and public-post results with reciprocal rank fusion (Python).
   Simulated practice scenario. All data is generated from the seed; the fusion constant,
   weights and lists are this exercise's rules, not any product's.

   Contract (python): entry, signature, starter, prelude, generate(r, level) ->
     { vars, samples: [{args, expect}], tests: [{name, args, expect?, limit_s?}] }.
   expect comes from oracle() below, which scores every source as an exact fraction with
   BigInt cross-multiplication and sorts with a comparator. The evaluator's reference uses
   a dict of first ranks per list and fractions.Fraction, so each checks the other.
   level: 1 Medium (two lists, no repeats inside a list, weights 1 and 1)
          2 Hard (+ a source repeated inside one list counts at its first position, an empty
            list, and scores that are equal as fractions but not as floats)
          3 Very Hard (+ integer weights per list, including a weighted exact tie that
            floats get wrong) */
export const kind = "python";
export const entry = "fuse_results";
export const signature = "def fuse_results(web: list[str], posts: list[str], k: int, top_n: int, weights: tuple[int, int] = (1, 1)) -> list[str]:";
export const starter = `def fuse_results(web, posts, k, top_n, weights=(1, 1)):
    """web, posts: source ids in the order each server-side tool ranked them
    (position 1 first). k: this exercise's fusion constant.
    weights: (weight of the web list, weight of the post list).
    A source's score is the sum, over the lists it appears in, of
    weight / (k + its rank in that list).
    Return at most top_n source ids, highest score first, equal scores by id."""
    ...
`;

export const prelude = `
def _gen_lists(n_web, n_posts, overlap_pct, seed, k=60, top_n=100, dup_pct=0, weights=(1, 1)):
    x = seed

    def nxt():
        nonlocal x
        x = (1103515245 * x + 12345) % 2147483648
        return x >> 8
    pool = n_web + n_posts
    web, seen = [], set()
    while len(web) < n_web:
        s = 'src-%07d' % (nxt() % pool)
        if s not in seen or nxt() % 100 < dup_pct:
            seen.add(s)
            web.append(s)
    posts, seen2 = [], set()
    while len(posts) < n_posts:
        if nxt() % 100 < overlap_pct:
            s = 'src-%07d' % int(web[nxt() % n_web][4:])
        else:
            s = 'src-%07d' % (pool + nxt() % pool)
        if s not in seen2 or nxt() % 100 < dup_pct:
            seen2.add(s)
            posts.append(s)
    return web, posts, k, top_n, weights
`.trim() + "\n";

// Exact scores as BigInt fractions [p, q]; comparator by score desc, then id asc.
export function oracle(web, posts, k, topN, weights = [1, 1]) {
  const first = (xs) => {
    const m = new Map();
    xs.forEach((s, i) => { if (!m.has(s)) m.set(s, i + 1); });
    return m;
  };
  const rw = first(web), rp = first(posts);
  const ids = [...new Set([...rw.keys(), ...rp.keys()])];
  const K = BigInt(k), W1 = BigInt(weights[0]), W2 = BigInt(weights[1]);
  const score = (s) => {
    let p = 0n, q = 1n;
    const add = (w, rank) => { const d = K + BigInt(rank); p = p * d + w * q; q = q * d; };
    if (rw.has(s)) add(W1, rw.get(s));
    if (rp.has(s)) add(W2, rp.get(s));
    return [p, q];
  };
  const sc = new Map(ids.map((s) => [s, score(s)]));
  ids.sort((a, b) => {
    const [pa, qa] = sc.get(a), [pb, qb] = sc.get(b);
    const l = pa * qb, rr = pb * qa;
    if (l !== rr) return l > rr ? -1 : 1;
    return a < b ? -1 : a > b ? 1 : 0;
  });
  return ids.slice(0, topN);
}

const pyList = (xs) => "[" + xs.map((s) => `'${s}'`).join(", ") + "]";
const pyArgs = (c) => `(${pyList(c.web)}, ${pyList(c.posts)}, ${c.k}, ${c.top_n}, (${c.w[0]}, ${c.w[1]}))`;
const run = (c) => oracle(c.web, c.posts, c.k, c.top_n, c.w);
const pyOut = (xs) => pyList(xs);
const id = (n) => "src-" + String(n).padStart(4, "0");

// Find ranks (a, b) and (c, d) whose weighted scores are equal as fractions but whose
// float sums w1/(k+a) + w2/(k+b) differ, the way a float solution computes them.
function floatTrap(k, w1, w2, maxRank) {
  for (let a = 1; a <= maxRank; a++) for (let b = 1; b <= maxRank; b++) {
    const pa = w1 * (k + b) + w2 * (k + a), qa = (k + a) * (k + b);
    for (let c = a + 1; c <= maxRank; c++) {
      // w2 / (k + d) = pa/qa - w1/(k + c)  ->  solve for d exactly
      const num = pa * (k + c) - w1 * qa, den = qa * (k + c);
      if (num <= 0 || (w2 * den) % num !== 0) continue;
      const d = (w2 * den) / num - k;
      if (d < 1 || d > maxRank || d === b) continue;
      const fa = w1 / (k + a) + w2 / (k + b), fc = w1 / (k + c) + w2 / (k + d);
      if (fa !== fc) return { a, b, c, d, fa, fc };
    }
  }
  return null;
}

// Lists of the given length with chosen sources at chosen 1-based positions; filler sources
// fill the rest, each in one list only.
function build(len, placed, fillerStart) {
  const xs = [];
  let f = fillerStart;
  for (let i = 1; i <= len; i++) xs.push(placed.has(i) ? placed.get(i) : id(f++));
  return { xs, next: f };
}

function randomCase(r, level, k) {
  const nw = r.int(5, 9), np = level >= 2 && r.chance(0.15) ? 0 : r.int(4, 8);
  const pool = r.shuffle(Array.from({ length: 30 }, (_, i) => id(100 + i * 7 + r.int(0, 6))));
  const web = pool.slice(0, nw);
  const posts = [];
  let j = nw;
  for (let i = 0; i < np; i++) posts.push(r.chance(0.45) ? r.pick(web) : pool[j++]);
  const dedupe = (xs) => (level >= 2 ? xs : [...new Set(xs)]);
  let p2 = dedupe(posts);
  let w2 = web.slice();
  if (level >= 2 && r.chance(0.6)) {                         // a source repeated in one list
    const tgt = r.chance(0.5) ? w2 : p2;
    if (tgt.length >= 2) tgt.splice(r.int(1, tgt.length), 0, r.pick(tgt.slice(0, tgt.length - 1)));
  }
  if (level === 1) p2 = [...new Set(p2)];
  const w = level === 3 ? r.pick([[1, 2], [2, 1], [3, 2], [2, 3], [1, 3]]) : [1, 1];
  const distinct = new Set([...w2, ...p2]).size;
  return { web: w2, posts: p2, k, top_n: r.int(3, distinct + 1), w };
}

export function generate(r, level) {
  const k = r.pick([20, 30, 40, 50, 60]);
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const c = randomCase(r, level, k);
    samples.push({ args: pyArgs(c), expect: pyOut(run(c)) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));
  const W = level === 3 ? r.pick([[1, 2], [2, 1], [3, 2]]) : [1, 1];
  const edges = [];

  // A source ranked 2nd in both lists against sources ranked 1st in only one.
  {
    const base = r.int(200, 400);
    const A = id(base + 5), X = id(base + 1), Y = id(base + 9);
    const w = build(5, new Map([[1, X], [2, A]]), base + 20);
    const p = build(5, new Map([[1, Y], [2, A]]), w.next);
    edges.push(["a source in both lists against sources ranked first in only one", { web: w.xs, posts: p.xs, k, top_n: 4, w: W }]);
  }
  // Mirrored ranks give exactly equal scores; the lower id wins, and top_n cuts inside the tie.
  {
    const a = r.int(2, 4), b = a + r.int(2, 4);
    const lo = id(r.int(500, 600)), hi = id(r.int(700, 800));
    const P = r.chance(0.5) ? hi : lo, Q = P === hi ? lo : hi;
    const w = build(b + 1, new Map([[a, P], [b, Q]]), 900);
    const p = build(b + 1, new Map([[b, P], [a, Q]]), w.next);
    const c = { web: w.xs, posts: p.xs, k, top_n: 50, w: [1, 1] };
    edges.push(["mirrored ranks tie exactly and the lower id comes first", c]);
    // top_n that ends exactly on the first of the tied pair.
    const full = run(c);
    const at = full.indexOf(lo);
    edges.push(["top_n ends inside a tie: only the lower id is returned", { ...c, top_n: at + 1 }]);
  }
  edges.push(["top_n larger than the number of sources returns them all",
    { web: [id(11), id(12), id(13)], posts: [id(12), id(14)], k, top_n: 10, w: W }]);
  if (level >= 2) {
    const base = r.int(1000, 1200);
    const S = id(base), T = id(base + 3);
    edges.push(["a source repeated in one list counts once, at its first position",
      { web: [id(base + 7), S, T, S, id(base + 8)], posts: [T, S, T], k, top_n: 10, w: W }]);
    edges.push(["an empty list: the other list's order is kept",
      { web: [], posts: [id(base + 40), id(base + 12), id(base + 31)], k, top_n: 3, w: W }]);
    const t = floatTrap(k, 1, 1, 60);
    if (!t) throw new Error("XAI-L1-04: no float trap for k=" + k);
    // Give the source the floats put first the higher id, so the exact tie-break disagrees.
    const P = t.fa > t.fc ? id(2900) : id(2100), Q = t.fa > t.fc ? id(2100) : id(2900);
    const len = Math.max(t.a, t.b, t.c, t.d);
    const w = build(len, new Map([[t.a, P], [t.c, Q]]), 3000);
    const p = build(len, new Map([[t.b, P], [t.d, Q]]), w.next);
    edges.push(["scores equal as fractions but not as floats tie, and the lower id comes first",
      { web: w.xs, posts: p.xs, k, top_n: 2 * len, w: [1, 1] }]);
  }
  if (level === 3) {
    let t = null, wt = null;
    for (const cand of [[2, 1], [1, 2], [3, 2], [2, 3], [3, 1], [1, 3]]) {
      t = floatTrap(k, cand[0], cand[1], 80);
      if (t) { wt = cand; break; }
    }
    if (!t) throw new Error("XAI-L1-04: no weighted float trap for k=" + k);
    const P = t.fa > t.fc ? id(4900) : id(4100), Q = t.fa > t.fc ? id(4100) : id(4900);
    const len = Math.max(t.a, t.b, t.c, t.d);
    const w = build(len, new Map([[t.a, P], [t.c, Q]]), 5000);
    const p = build(len, new Map([[t.b, P], [t.d, Q]]), w.next);
    edges.push(["weighted scores equal as fractions but not as floats", { web: w.xs, posts: p.xs, k, top_n: 2 * len, w: wt }]);
    edges.push(["a heavier post list lets a post-only source pass a web-only one",
      { web: [id(6001), id(6002)], posts: [id(6003), id(6004)], k, top_n: 4, w: [1, 3] }]);
  }
  for (const [name, c] of edges) tests.push({ name, args: pyArgs(c), expect: pyOut(run(c)) });

  // Timing: compared with the reference at check time. 40 000 results per list.
  const seed = r.int(1, 1_000_000);
  const dup = level >= 2 ? 3 : 0;
  tests.push({
    name: "two lists of 40,000 results in time",
    args: `_gen_lists(40000, 40000, 30, ${seed}, ${k}, 100, ${dup}, (${W[0]}, ${W[1]}))`,
    limit_s: 8,
  });

  return {
    vars: {
      k: String(k),
      level_rule: level === 1
        ? "In this exercise no source appears twice in the same list, both lists are non-empty, and both weights are 1."
        : level === 2
          ? "A tool can return the same source twice in one list (two passages of one page): only its first position counts, and the other positions are not renumbered. Either list can be empty. Both weights are 1."
          : "A tool can return the same source twice in one list: only its first position counts, and the other positions are not renumbered. Either list can be empty. The weights are positive integers and can differ between the lists.",
    },
    samples,
    tests,
  };
}
