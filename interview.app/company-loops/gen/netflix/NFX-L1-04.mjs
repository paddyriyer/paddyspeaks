/* NFX-L1-04 — Home-page rows without repeats (Python, greedy with hash sets).
   Simulated practice scenario. All data is generated from the seed; rows, titles,
   priorities and caps are hypothetical.

   Contract (python): entry, signature, starter, prelude, generate(r, level) ->
     { vars, samples: [{args, expect}], tests: [{name, args, expect?, limit_s?}] }.
   expect comes from oracle() below, a brute-force fill that rescans every kept row for
   each candidate; the evaluator's reference keeps sets and counters, so each checks the other.
   level: 1 Medium (fill by priority, return in display order, no title twice on the page,
                    rows below min_fill dropped and their titles released)
          2 Hard (+ at most row_genre_cap titles of one genre in a row)
          3 Very Hard (+ at most page_genre_cap titles of one genre on the whole page;
                  a dropped row gives its genre budget back) */
export const kind = "python";
export const entry = "fill_rows";
export const signature = "def fill_rows(rows: list[tuple[str, int, list[int]]], cap: int, min_fill: int, genres: dict[int, str] | None = None, row_genre_cap: int | None = None, page_genre_cap: int | None = None) -> list[tuple[str, list[int]]]:";
export const starter = `def fill_rows(rows, cap, min_fill, genres=None, row_genre_cap=None, page_genre_cap=None):
    """rows: (row_id, priority, ranked candidate title ids), in display order.
    Fill rows by priority (high first, ties by row_id) without repeating a title on
    the page. Return [(row_id, titles)] for the rows that are kept, in display order."""
    ...
`;

export const prelude = `
_GENRES = ["anime", "comedy", "crime", "docs", "drama", "family", "horror", "romance", "scifi", "thriller"]


def _gen_rows(n_rows, n_cand, universe, seed, base=100000):
    x, out = seed, []
    for i in range(n_rows):
        x = (1103515245 * x + 12345) % 2147483648
        prio = (x >> 8) % 50
        cands = []
        for _ in range(n_cand):
            x = (1103515245 * x + 12345) % 2147483648
            cands.append(base + (x >> 4) % universe)
        out.append(("r%05d" % i, prio, cands))
    return out


def _gen_genres(universe, seed, base=100000):
    x, out = seed, {}
    for t in range(base, base + universe):
        x = (1103515245 * x + 12345) % 2147483648
        out[t] = _GENRES[(x >> 8) % len(_GENRES)]
    return out
`.trim() + "\n";

const cmp = (x, y) => (x < y ? -1 : x > y ? 1 : 0);

// Brute force: for each candidate, rescan this row and every kept row. Small inputs only.
export function oracle(rows, cap, minFill, genres, rowCap, pageCap) {
  const order = rows.map((_, i) => i).sort((a, b) => rows[b][1] - rows[a][1] || cmp(rows[a][0], rows[b][0]));
  const kept = new Map();
  for (const i of order) {
    const got = [];
    for (const t of rows[i][2]) {
      if (got.length >= cap) break;
      if (got.includes(t)) continue;
      if ([...kept.values()].some((ts) => ts.includes(t))) continue;
      if (rowCap != null && got.filter((x) => genres[x] === genres[t]).length >= rowCap) continue;
      if (pageCap != null) {
        let n = got.filter((x) => genres[x] === genres[t]).length;
        for (const ts of kept.values()) n += ts.filter((x) => genres[x] === genres[t]).length;
        if (n >= pageCap) continue;
      }
      got.push(t);
    }
    if (got.length >= minFill) kept.set(i, got);
  }
  return rows.map((_, i) => i).filter((i) => kept.has(i)).map((i) => [rows[i][0], kept.get(i)]);
}

const pyStr = (s) => `'${s}'`;
const pyRows = (rows) => "[" + rows.map(([id, p, c]) => `(${pyStr(id)}, ${p}, [${c.join(", ")}])`).join(", ") + "]";
const pyGenres = (g) => (g ? "{" + Object.keys(g).map((k) => `${k}: ${pyStr(g[k])}`).join(", ") + "}" : "None");
const pyOpt = (v) => (v == null ? "None" : String(v));
const pyArgs = (c) => `(${pyRows(c.rows)}, ${c.cap}, ${c.min}, ${pyGenres(c.genres)}, ${pyOpt(c.rowCap)}, ${pyOpt(c.pageCap)})`;
const pyOut = (out) => "[" + out.map(([id, ts]) => `(${pyStr(id)}, [${ts.join(", ")}])`).join(", ") + "]";
const run = (c) => oracle(c.rows, c.cap, c.min, c.genres, c.rowCap, c.pageCap);

const ROW_IDS = ["award_winners", "because_you_watched", "critically_acclaimed", "hidden_gems", "new_releases",
  "top_picks", "trending_now", "watch_together", "binge_worthy", "only_on_service"];
const GENRES = ["anime", "comedy", "crime", "docs", "drama", "family", "thriller"];

function randomCase(r, level, base) {
  for (let attempt = 0; attempt < 80; attempt++) {
    const universe = Array.from({ length: r.int(14, 22) }, (_, i) => base + 7 * i + r.int(0, 5));
    const ids = r.sample(ROW_IDS, r.int(4, 6));
    const rows = ids.map((id) => {
      const c = r.sample(universe, r.int(3, 9));
      if (r.chance(0.3)) c.splice(r.int(1, c.length), 0, r.pick(c));          // a repeat within the row
      return [id, r.int(1, 4), c];
    });
    const cap = r.int(3, 5), min = r.int(2, 3);
    const genres = level >= 2 ? Object.fromEntries(universe.map((t) => [t, r.pick(GENRES.slice(0, 4))])) : null;
    const c = { rows, cap, min, genres, rowCap: level >= 2 ? r.int(1, 2) : null, pageCap: level === 3 ? r.int(3, 5) : null };
    const out = run(c);
    // Interesting: at least two rows kept and at least one dropped.
    if (out.length >= 2 && out.length < rows.length) return c;
  }
  throw new Error("NFX-L1-04: could not build a sample");
}

export function generate(r, level) {
  const base = r.pick([1000, 40000, 81000, 230000]);
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const c = randomCase(r, level, base + i * 500);
    samples.push({ args: pyArgs(c), expect: pyOut(run(c)) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const t = (k) => base + 900 + k;                    // readable ids for the hand-built cases
  const [A, B, C, D] = r.sample(ROW_IDS, 4).sort();   // A < B < C < D as row ids
  const g = (map) => Object.fromEntries(Object.entries(map).map(([k, v]) => [t(+k), v]));
  const edges = [
    ["a title in a higher-priority row is not repeated", { rows: [[A, 1, [t(1), t(2), t(3)]], [B, 5, [t(2), t(4)]]], cap: 3, min: 1 }],
    ["a repeated candidate within one row counts once", { rows: [[A, 2, [t(1), t(1), t(2), t(1), t(3)]]], cap: 3, min: 1 }],
    ["rows fill by priority but come back in display order", { rows: [[D, 1, [t(1), t(2)]], [A, 9, [t(2), t(3)]], [C, 4, [t(3), t(1), t(4)]]], cap: 2, min: 1 }],
    ["equal priorities: the smaller row_id fills first", { rows: [[C, 3, [t(1), t(2)]], [B, 3, [t(1), t(3)]]], cap: 2, min: 1 }],
    ["a row below min_fill is dropped and its titles go to later rows",
      { rows: [[A, 2, [t(1), t(4), t(5)]], [B, 9, [t(1), t(2), t(3)]], [C, 5, [t(3), t(4)]]], cap: 3, min: 2 }],
    ["a row with exactly min_fill titles is kept", { rows: [[A, 5, [t(1), t(2), t(3)]], [B, 1, [t(1), t(2), t(3), t(4), t(5)]]], cap: 3, min: 2 }],
    ["a row stops at cap; its later candidates stay available", { rows: [[A, 5, [t(1), t(2), t(3), t(4)]], [B, 1, [t(4), t(3), t(5)]]], cap: 2, min: 2 }],
    ["no row reaches min_fill: an empty page", { rows: [[A, 1, [t(1)]], [B, 2, [t(1), t(2)]]], cap: 3, min: 3 }],
    ["a row with no candidates", { rows: [[A, 1, []], [B, 2, [t(1), t(2)]]], cap: 2, min: 1 }],
  ];
  if (level >= 2) {
    const gm = g({ 1: "drama", 2: "drama", 3: "drama", 4: "comedy", 5: "comedy", 6: "docs" });
    edges.push(["row genre cap: a skipped title is still free for a later row",
      { rows: [[A, 5, [t(1), t(2), t(4), t(3)]], [B, 1, [t(2), t(6), t(3)]]], cap: 3, min: 1, genres: gm, rowCap: 1 }]);
    edges.push(["row genre cap: one genre only fills a row up to the cap",
      { rows: [[A, 1, [t(1), t(2), t(3)]], [B, 2, [t(4), t(5), t(6)]]], cap: 3, min: 2, genres: gm, rowCap: 2 }]);
    edges.push(["row genre cap can drop a row below min_fill",
      { rows: [[A, 3, [t(1), t(2), t(3)]], [B, 1, [t(2), t(3), t(4)]]], cap: 3, min: 2, genres: gm, rowCap: 1 }]);
  }
  if (level === 3) {
    const gm = g({ 1: "drama", 2: "drama", 3: "drama", 4: "drama", 5: "comedy", 6: "comedy", 7: "docs" });
    edges.push(["page genre cap counts every kept row",
      { rows: [[A, 3, [t(1), t(2), t(5)]], [B, 2, [t(3), t(4), t(6)]], [C, 1, [t(7), t(4)]]], cap: 3, min: 1, genres: gm, rowCap: 3, pageCap: 3 }]);
    edges.push(["a dropped row gives its page genre budget back",
      { rows: [[A, 9, [t(1), t(2)]], [B, 5, [t(3), t(4), t(5)]], [C, 1, [t(4), t(6), t(7)]]], cap: 3, min: 3, genres: gm, rowCap: 3, pageCap: 2 }]);
    edges.push(["the page genre cap is reached exactly, not exceeded",
      { rows: [[A, 2, [t(1), t(2)]], [B, 1, [t(3), t(5), t(4)]]], cap: 2, min: 1, genres: gm, rowCap: 2, pageCap: 3 }]);
  }
  for (const [name, c] of edges) {
    if (level >= 2 && !c.genres) {
      c.genres = Object.fromEntries([...new Set(c.rows.flatMap((x) => x[2]))].map((x, i) => [x, GENRES[i % GENRES.length]]));
      c.rowCap = 3;
    }
    if (level === 3 && c.pageCap == null) c.pageCap = 10;
    if (level < 2) { c.genres = null; c.rowCap = null; }
    if (level < 3) c.pageCap = null;
    tests.push({ name, args: pyArgs(c), expect: pyOut(run(c)) });
  }

  // Timing: compared with the reference at check time. Checking "already on the page"
  // by scanning lists grows with the page; a set keeps it constant.
  const nRows = 3000, nCand = 150, universe = 200000;
  const seed = r.int(1, 1_000_000);
  const gArg = level >= 2 ? `_gen_genres(${universe}, ${seed + 1})` : "None";
  tests.push({
    name: `${nRows.toLocaleString("en-US")} rows of ${nCand} candidates in time`,
    args: `(_gen_rows(${nRows}, ${nCand}, ${universe}, ${seed}), 40, 10, ${gArg}, ${level >= 2 ? 4 : "None"}, ${level === 3 ? 9000 : "None"})`,
    limit_s: 8,
  });

  return {
    vars: {
      genre_rule: level === 1
        ? "In this exercise `genres`, `row_genre_cap` and `page_genre_cap` are None."
        : "`genres` maps every title id to its genre. A row may hold at most `row_genre_cap` titles of one genre: a candidate that would exceed it is skipped for this row only and stays available to later rows.",
      page_rule: level === 3
        ? "The whole page may hold at most `page_genre_cap` titles of one genre, counting the kept rows filled so far and the row being filled. A row that is dropped gives its titles and its genre count back."
        : "`page_genre_cap` is None.",
    },
    samples,
    tests,
  };
}
