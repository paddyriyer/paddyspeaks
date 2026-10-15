/* TTK-L2-01 — Remix lineage: the nearest common origin of two videos (Python, LCA).
   Simulated practice scenario. All data is generated from the seed.

   Contract (python): entry, signature, starter, prelude, generate(r, level) ->
     { vars, samples: [{args, expect}], tests: [{name, args, expect?, limit_s?}] }.
   expect comes from oracle() below: for every pair it lists the first video's whole
   chain of sources, puts the second video's chain in a set, and takes the first
   common video that is not deleted. The evaluator's reference indexes the videos
   once and answers each pair with binary lifting, so each checks the other.
   level: 1 Medium (one row per remix) · 2 Hard (+ repeated rows, ids that appear in
          no row) · 3 Very Hard (+ deleted videos that stay in the lineage but are
          never returned) */
export const kind = "python";
export const entry = "common_origin";
export const signature = "def common_origin(remixes: list[tuple[str, str]], pairs: list[tuple[str, str]], deleted: set[str] = frozenset()) -> list[str | None]:";
export const starter = `def common_origin(remixes, pairs, deleted=frozenset()):
    """remixes: (video, source) rows: video was made as a duet or stitch of source.
    pairs: (a, b) pairs of video ids.
    Return, per pair, the nearest video that both a and b descend from (a video
    descends from itself), or None."""
    ...
`;

export const prelude = `
def _gen_lineage(n_chains, chain_len, n_branch, n_pairs, seed, dup=0, del_pct=0):
    x = seed

    def nxt():
        nonlocal x
        x = (1103515245 * x + 12345) % 2147483648
        return x >> 8
    remixes, fam, nid = [], [], 0
    for c in range(n_chains):
        ids = ['v%07d' % ((nid + k) * 7919 % 9999991) for k in range(chain_len)]
        nid += chain_len
        for k in range(1, chain_len):
            remixes.append((ids[k], ids[k - 1]))
        fam.append(ids)
    for _ in range(n_branch):
        c = nxt() % n_chains
        ids = fam[c]
        v = 'v%07d' % (nid * 7919 % 9999991)
        nid += 1
        if nxt() % 10 < 7 or len(ids) == chain_len:
            src = ids[nxt() % chain_len]
        else:
            src = ids[chain_len + nxt() % (len(ids) - chain_len)]
        remixes.append((v, src))
        ids.append(v)
    for _ in range(dup):
        remixes.append(remixes[nxt() % len(remixes)])
    for i in range(len(remixes) - 1, 0, -1):
        j = nxt() % (i + 1)
        remixes[i], remixes[j] = remixes[j], remixes[i]
    pairs = []
    for _ in range(n_pairs):
        roll = nxt() % 100
        if roll < 2:
            pairs.append(('v9999999', fam[0][nxt() % chain_len]))
            continue
        c = nxt() % n_chains
        d = (c + 1) % n_chains if roll < 6 else c
        pairs.append((fam[c][nxt() % len(fam[c])], fam[d][nxt() % len(fam[d])]))
    deleted = set()
    if del_pct:
        for ids in fam:
            for v in ids:
                if nxt() % 100 < del_pct:
                    deleted.add(v)
    return remixes, pairs, deleted
`.trim() + "\n";

// Brute force: a's whole chain against the set of b's chain. Small inputs only.
export function oracle(remixes, pairs, deleted) {
  const parent = new Map(), known = new Set();
  for (const [v, s] of remixes) { parent.set(v, s); known.add(v); known.add(s); }
  const del = new Set(deleted || []);
  return pairs.map(([a, b]) => {
    if (!known.has(a) || !known.has(b)) return null;
    const ancB = new Set();
    for (let u = b; u !== undefined; u = parent.get(u)) ancB.add(u);
    for (let u = a; u !== undefined; u = parent.get(u)) if (ancB.has(u) && !del.has(u)) return u;
    return null;
  });
}

const q = (s) => "'" + s + "'";
const pyArgs = (c, level) =>
  "([" + c.remixes.map(([v, s]) => `(${q(v)}, ${q(s)})`).join(", ") + "], [" +
  c.pairs.map(([a, b]) => `(${q(a)}, ${q(b)})`).join(", ") + "]" +
  (level === 3 ? ", " + (c.deleted.length ? "{" + c.deleted.map(q).join(", ") + "}" : "set()") : "") + ")";
const pyOut = (xs) => "[" + xs.map((x) => (x === null ? "None" : q(x))).join(", ") + "]";
const run = (c) => oracle(c.remixes, c.pairs, c.deleted);

function randomCase(r, level) {
  for (let attempt = 0; attempt < 80; attempt++) {
    const n = r.int(12, 18);
    const base = r.int(100, 899);
    const ids = r.shuffle(Array.from({ length: n }, (_, i) => `vid_${base + i * 7 + r.int(0, 6)}`));
    const remixes = [];
    for (let i = 1; i < n; i++) {
      if (i === 1 || (i === 2 && r.chance(0.5)) || r.chance(0.08)) continue;   // more than one original
      const lo = Math.max(0, i - 4);
      remixes.push([ids[i], ids[r.int(lo, i - 1)]]);
    }
    const known = new Set(remixes.flat());
    const pool = ids.filter((v) => known.has(v));
    if (pool.length < 8) continue;
    const pairs = Array.from({ length: r.int(6, 8) }, () => [r.pick(pool), r.pick(pool)]);
    if (level >= 2) {
      for (let k = 0; k < 2; k++) remixes.push(r.pick(remixes));
      pairs.push([r.pick(pool), `vid_${base - r.int(1, 50)}`]);
    }
    const deleted = level === 3 ? r.sample(pool, r.int(2, 4)) : [];
    const c = { remixes: r.shuffle(remixes), pairs, deleted };
    const got = run(c);
    // At least one answer that is a proper ancestor of both videos, and one None.
    if (got.some((x, i) => x !== null && x !== pairs[i][0] && x !== pairs[i][1]) && got.some((x) => x === null)) return c;
  }
  throw new Error("TTK-L2-01: could not build a sample with both outcomes");
}

export function generate(r, level) {
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const c = randomCase(r, level);
    samples.push({ args: pyArgs(c, level), expect: pyOut(run(c)) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  // A fixed little lineage, relabelled per seed:   o ← a ← b ← c ← d,  a ← e ← f,  o2 ← g
  const base = r.int(1000, 8999);
  const [O, A, B, C, D, E, F, O2, G] = r.shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8]).map((k) => `vid_${base + 11 * k}`);
  const tree = [[A, O], [B, A], [C, B], [D, C], [E, A], [F, E], [G, O2]];
  const edges = [
    ["one video is a remix of a remix of the other", { remixes: tree, pairs: [[D, A], [A, D]] }],
    ["a video paired with itself", { remixes: tree, pairs: [[C, C], [O, O]] }],
    ["two remixes of the same video", { remixes: tree, pairs: [[B, E]] }],
    ["cousins at different depths meet at their nearest shared source", { remixes: tree, pairs: [[D, F], [F, C]] }],
    ["two separate lineages share nothing", { remixes: tree, pairs: [[D, G], [O, O2]] }],
    ["an original with remixes, paired with a deep remix", { remixes: tree, pairs: [[O, F]] }],
    ["rows arrive with remixes listed before their sources", { remixes: tree.slice().reverse(), pairs: [[D, F], [C, E]] }],
    ["an id that appears in no row", { remixes: tree, pairs: [[`vid_${base - 1}`, A], [`vid_${base - 1}`, `vid_${base - 1}`]] }],
  ];
  if (level >= 2) {
    edges.push(["a repeated row changes nothing", { remixes: [...tree, [D, C], [E, A]], pairs: [[D, F]] }]);
  }
  if (level === 3) {
    edges.push(["the nearest common video is deleted: go to its nearest source that is not",
      { remixes: tree, pairs: [[D, F]], deleted: [A] }]);
    edges.push(["a deleted video paired with its own remix",
      { remixes: tree, pairs: [[B, D], [B, B]], deleted: [B] }]);
    edges.push(["every common video deleted, up to the original",
      { remixes: tree, pairs: [[C, F]], deleted: [A, O] }]);
    edges.push(["a deleted video below the meeting point changes nothing",
      { remixes: tree, pairs: [[D, F]], deleted: [C, E] }]);
  }
  for (const [name, c] of edges) {
    c.deleted = c.deleted || [];
    tests.push({ name, args: pyArgs(c, level), expect: pyOut(run(c)) });
  }

  // Timing: compared with the reference at check time. Long stitch chains make the
  // walk up a pair's chains (or a set of one video's sources) cost tens of thousands
  // of steps per pair.
  const seed = r.int(1, 1_000_000);
  const [chains, branch, dup, del] = level === 1 ? [3, 20000, 0, 0] : level === 2 ? [4, 30000, 2000, 0] : [4, 30000, 2000, 3];
  tests.push({
    name: `${chains} remix chains 15,000 deep, 15,000 pairs in time`,
    args: `_gen_lineage(${chains}, 15000, ${branch}, 15000, ${seed}, ${dup}, ${del})` + (level === 3 ? "" : "[:2]"),
    limit_s: 8,
  });

  return {
    vars: {
      data_rule: level === 1
        ? "Every remix appears in exactly one row. A pair can name an id that appears in no row: that video is unknown, and the answer for the pair is `None`."
        : "The log is at-least-once, so a row can appear more than once; a repeated row is the same remix. A pair can name an id that appears in no row: that video is unknown, and the answer for the pair is `None`.",
      deleted_rule: level === 3
        ? "`deleted` is a set of video ids that were deleted by their creators. A deleted video keeps its place in the lineage, so its remixes still descend through it, but it is never returned: return the nearest common video that is not deleted, or `None` if every video both descend from is deleted."
        : "In this exercise `deleted` is always empty.",
    },
    samples,
    tests,
  };
}
