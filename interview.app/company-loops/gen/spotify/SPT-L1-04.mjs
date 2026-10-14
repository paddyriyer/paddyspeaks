/* SPT-L1-04 — Playlist reorder: the fewest track moves that turn the old order into the
   new one (Python).
   Simulated practice scenario. All data is generated from the seed and is hypothetical.

   Contract: see docs/COMPANY-INTERVIEW-LOOPS.md § Executable templates (python).
   moves = (tracks in both versions) − (longest increasing run of their old positions,
   taken in new order). Intended: patience sorting with bisect, O(n log n). Naive: the
   quadratic LIS dynamic programme, O(n²), far too slow at 200 000 tracks.
   level: 1 Medium (the new order is a permutation of the old one)
          2 Hard (+ tracks removed and tracks added; neither is a move)
          3 Very Hard (+ a playlist can hold the same track more than once; the k-th copy
                       in the old order is the k-th copy in the new order) */
export const kind = "python";
export const entry = "reorder_moves";
export const signature = "def reorder_moves(old: list[str], new: list[str]) -> tuple[int, int, int]:";
export const starter = `def reorder_moves(old, new):
    """old, new: a playlist's track ids before and after an edit, in playlist order.
    Return (removed, added, moves): how many entries were removed, how many were added,
    and the fewest single-track moves that put the kept entries into their new order."""
    ...
`;

export const prelude = `
def _gen_case(n, seed, churn=0, dups=0):
    x = seed

    def nxt():
        nonlocal x
        x = (1103515245 * x + 12345) % 2147483648
        return x >> 8

    old = ['t%d' % (i % (n - dups) if dups else i) for i in range(n)]
    # Shuffle a large share of positions so the longest kept run is long but far from n.
    new = old[:]
    for _ in range(n // 2):
        i, j = nxt() % n, nxt() % n
        new[i], new[j] = new[j], new[i]
    if churn:
        for _ in range(churn):
            new[nxt() % n] = 'new%d' % (nxt() % 1000000)
    return old, new
`.trim() + "\n";

// Independent oracle: occurrence matching, then the quadratic LIS DP (inputs are small).
export function oracle(oldL, newL) {
  const pos = new Map();
  const seen = new Map();
  oldL.forEach((t, i) => { const k = seen.get(t) || 0; seen.set(t, k + 1); pos.set(t + "#" + k, i); });
  seen.clear();
  const seq = [];
  let added = 0;
  for (const t of newL) {
    const k = seen.get(t) || 0;
    seen.set(t, k + 1);
    const p = pos.get(t + "#" + k);
    if (p === undefined) added++;
    else seq.push(p);
  }
  const best = seq.map(() => 1);
  for (let i = 0; i < seq.length; i++) for (let j = 0; j < i; j++) if (seq[j] < seq[i]) best[i] = Math.max(best[i], best[j] + 1);
  const lis = seq.length ? Math.max(...best) : 0;
  return [oldL.length - seq.length, added, seq.length - lis];
}

const pyStr = (s) => "'" + s.replace(/\\/g, "\\\\").replace(/'/g, "\\'") + "'";
const pyList = (xs) => "[" + xs.map(pyStr).join(", ") + "]";
const pyArgs = (o, n) => `(${pyList(o)}, ${pyList(n)})`;
const pyRes = (t) => `(${t.join(", ")})`;

const POOL = ["trk_4fq", "trk_9ab", "trk_1kz", "trk_7mn", "trk_2pd", "trk_8xs", "trk_5ht", "trk_3cw", "trk_6ry", "trk_0lv", "trk_4ge", "trk_9uj"];

function smallCase(r, level) {
  const n = r.int(6, 10);
  let old = r.sample(POOL, n);
  if (level === 3) { const d = r.pick(old); old.splice(r.int(0, old.length), 0, d); if (r.chance(0.5)) old.splice(r.int(0, old.length), 0, r.pick(old)); }
  let nw = old.slice();
  for (let k = r.int(1, 3); k > 0; k--) {                    // a few moves
    const i = r.int(0, nw.length - 1);
    const [t] = nw.splice(i, 1);
    nw.splice(r.int(0, nw.length), 0, t);
  }
  if (level >= 2) {
    for (let k = r.int(1, 2); k > 0; k--) nw.splice(r.int(0, nw.length - 1), 1);                                  // removals
    const fresh = POOL.filter((t) => !old.includes(t));
    for (let k = r.int(1, 2); k > 0 && fresh.length; k--) nw.splice(r.int(0, nw.length), 0, fresh.splice(r.int(0, fresh.length - 1), 1)[0]);  // additions
  }
  return [old, nw];
}

export function generate(r, level) {
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const [o, n] = smallCase(r, level);
    samples.push({ args: pyArgs(o, n), expect: pyRes(oracle(o, n)) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const t = r.sample(POOL, 6);
  const [a, b, c, d, e] = t;
  const edges = [
    ["two empty playlists", [], []],
    ["nothing changed", [a, b, c, d], [a, b, c, d]],
    ["the last track moved to the top is one move", [a, b, c, d, e], [e, a, b, c, d]],
    ["a reversed playlist needs all but one track moved", [a, b, c, d, e], [e, d, c, b, a]],
    ["two neighbours swapped is one move", [a, b, c, d], [a, c, b, d]],
    ["a single track", [a], [a]],
  ];
  if (level >= 2) {
    edges.push(["every track replaced: removals and additions, no moves", [a, b, c], [d, e]]);
    edges.push(["a removal alone does not move anything", [a, b, c, d], [a, c, d]]);
    edges.push(["an added track in the middle is not a move", [a, b, c], [a, e, b, c]]);
    edges.push(["everything removed", [a, b, c], []]);
  }
  if (level === 3) {
    edges.push(["copies are matched in order: the k-th copy with the k-th copy", [a, b, a], [a, a, b]]);
    edges.push(["one copy of a doubled track removed", [a, b, a, c], [a, b, c]]);
    edges.push(["a second copy added", [a, b], [a, b, b]]);
  }
  for (const [name, o, n] of edges) tests.push({ name, args: pyArgs(o, n), expect: pyRes(oracle(o, n)) });

  // Timing: 200 000 entries, half of them swapped. The quadratic DP is ~2·10¹⁰ steps;
  // patience sorting is ~200 000 · log₂ 200 000 comparisons.
  const seed = r.int(1, 1_000_000);
  tests.push({
    name: "200,000 tracks in time",
    args: `_gen_case(200000, ${seed}, ${level >= 2 ? 20000 : 0}, ${level === 3 ? 50000 : 0})`,
    limit_s: 8,
  });

  return {
    vars: {
      churn_rule: level === 1
        ? "In this round `new` holds exactly the same tracks as `old`, in a different order, and no track appears twice."
        : "A track may be in only one of the two lists: an entry only in `old` was removed and an entry only in `new` was added. Removals and additions are counted separately and are never moves.",
      dup_rule: level === 3
        ? "A playlist can hold the same track more than once. Copies are matched in order (this exercise's rule): the first copy in `old` is the first copy in `new`, the second the second, and so on; any extra copies are removals or additions."
        : "No track appears twice in one list.",
    },
    samples,
    tests,
  };
}
