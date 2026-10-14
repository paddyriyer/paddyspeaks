/* ADB-L1-04 — Splitting a large PDF into at most k parts with the smallest largest part (Python).
   Simulated practice scenario. All data is generated from the seed; page sizes and the per-part
   overhead are hypothetical, and the split rule is this exercise's, not any product's.

   Contract (python): entry, signature, starter, prelude, generate(r, level) ->
     { vars, samples: [{args, expect}], tests: [{name, args, expect?, limit_s?}] }.
   expect comes from oracle() below: an exhaustive partition DP over every split into at most k
   parts (O(k·n²), small inputs only), then the front-greedy split at that size. The evaluator's
   reference binary-searches the answer with a greedy feasibility check, written independently.
   level: 1 Medium (bytes only)
          · 2 Hard (+ fixed overhead bytes per part)
          · 3 Very Hard (+ chapter pages that must start a part, and None when there are more chapters than parts) */
export const kind = "python";
export const entry = "split_pdf";
export const signature = "def split_pdf(page_bytes: list[int], k: int, overhead: int, chapter_starts: list[int]) -> tuple[int, list[int]] | None:";
export const starter = `def split_pdf(page_bytes, k, overhead, chapter_starts):
    """page_bytes[i]: bytes of page i + 1. Split into at most k parts of consecutive pages.
    A part's size is overhead + the bytes of its pages. Pages in chapter_starts must begin a part.
    Return (largest, starts): the smallest possible largest part, and the first page number of each
    part when every part takes as many pages as fit, from the front. None if it cannot be done."""
    ...
`;

export const prelude = `
def _split_case(n, seed, k, overhead, n_chapters=0):
    x = seed
    def rnd(m):
        nonlocal x
        x = (1103515245 * x + 12345) % 2147483648
        return (x >> 16) % m
    pages = [20000 + rnd(1500) * 2000 for _ in range(n)]
    for _ in range(n // 500):                    # scanned pages with full-resolution images
        pages[rnd(n)] = 8000000 + rnd(4000) * 1000
    chapters = sorted({2 + rnd(n - 1) for _ in range(n_chapters)})
    return pages, k, overhead, chapters
`.trim() + "\n";

// The specification, exhaustively: the best largest part over every split into at most k parts
// that starts a part at every chapter page, then the front-greedy split at that size.
export function oracle(pages, k, overhead, chapters) {
  const n = pages.length;
  const forced = new Set(chapters.map((p) => p - 1));
  const sum = (a, b) => { let s = 0; for (let i = a; i < b; i++) s += pages[i]; return s; };
  const okSeg = (a, b) => { for (let i = a + 1; i < b; i++) if (forced.has(i)) return false; return true; };
  // best[j][i]: smallest largest part splitting the first i pages into exactly j parts.
  let best = Array(n + 1).fill(Infinity);
  best[0] = 0;
  let answer = Infinity;
  for (let j = 1; j <= Math.min(k, n); j++) {
    const nxt = Array(n + 1).fill(Infinity);
    for (let i = 1; i <= n; i++) {
      for (let a = 0; a < i; a++) {
        if (best[a] === Infinity || !okSeg(a, i)) continue;
        const v = Math.max(best[a], overhead + sum(a, i));
        if (v < nxt[i]) nxt[i] = v;
      }
    }
    best = nxt;
    if (best[n] < answer) answer = best[n];
  }
  if (answer === Infinity) return null;
  const starts = [];
  let i = 0;
  while (i < n) {
    starts.push(i + 1);
    let size = overhead + pages[i];
    i++;
    while (i < n && !forced.has(i) && size + pages[i] <= answer) size += pages[i++];
  }
  return [answer, starts];
}

const pyOut = (v) => (v === null ? "None" : `(${v[0]}, [${v[1].join(", ")}])`);
const pyArgs = (pages, k, ov, ch) => `([${pages.join(", ")}], ${k}, ${ov}, [${ch.join(", ")}])`;

function randomCase(r, level) {
  const n = r.int(5, level === 1 ? 9 : 11);
  const pages = Array.from({ length: n }, () => (r.chance(0.15) ? r.int(40, 90) : r.int(2, 30)) * 1000);
  const k = r.int(2, Math.max(2, n - 2));
  const ov = level >= 2 ? r.pick([500, 2000, 5000]) : 0;
  const ch = level === 3 ? r.sample(Array.from({ length: n - 1 }, (_, i) => i + 2), r.int(1, 3)).sort((a, b) => a - b) : [];
  return { pages, k, ov, ch };
}

export function generate(r, level) {
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const c = randomCase(r, level);
    samples.push({ args: pyArgs(c.pages, c.k, c.ov, c.ch), expect: pyOut(oracle(c.pages, c.k, c.ov, c.ch)) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const ov = level >= 2 ? r.pick([1000, 3000]) : 0;
  const u = r.int(2, 9) * 1000;
  const big = r.int(60, 99) * 1000;
  const edges = [
    ["k = 1: the whole document is one part", [u, 2 * u, u, 3 * u], 1, ov, []],
    ["one page", [big], 3, ov, []],
    ["k at least the page count: the largest page decides, and small pages still share parts", [u, u, big, u, u], 9, ov, []],
    ["equal pages, k divides them evenly", [u, u, u, u, u, u], 3, ov, []],
    ["one heavy page alone, the rest balanced around it", [u, u, u, big, u, u, u], 3, ov, []],
    ["a split exactly at the limit keeps the page in the earlier part", [3 * u, u, 2 * u, 2 * u, 2 * u], 2, ov, []],
  ];
  if (level >= 2) {
    edges.push(["a large overhead is paid by every part, so the best split still uses one page per part", [u, u, u, u], 4, 5 * u, []]);
    edges.push(["a large overhead with k = 2", [2 * u, u, u, 2 * u], 2, 10 * u, []]);
  }
  if (level === 3) {
    edges.push(["a chapter start forces a split even when the pages would fit", [u, u, u, u], 3, ov, [3]]);
    edges.push(["as many chapters as parts: one part per chapter", [u, 2 * u, u, 3 * u, u], 3, ov, [2, 4]]);
    edges.push(["more chapters than parts: None", [u, u, u, u, u], 2, ov, [2, 4]]);
    edges.push(["chapter_starts lists page 1 and is not sorted", [2 * u, u, u, 2 * u, u, u], 3, ov, [4, 1]]);
    edges.push(["a heavy chapter is split further inside itself", [u, big, big, u, u, u], 4, ov, [4]]);
  }
  for (const [name, pages, k, o, ch] of edges) tests.push({ name, args: pyArgs(pages, k, o, ch), expect: pyOut(oracle(pages, k, o, ch)) });

  // Timing: 60 000 pages. Binary search on the answer with an O(n) greedy check is about
  // 40 passes; a partition DP is O(k·n²) and does not finish.
  const nCh = level === 3 ? 40 : 0;
  tests.push({
    name: "60,000 pages, k = " + (level === 3 ? 60 : 40) + " (binary search on the answer, not a partition DP)",
    args: `_split_case(60000, ${r.int(1, 1_000_000)}, ${level === 3 ? 60 : 40}, ${level >= 2 ? 250000 : 0}, ${nCh})`,
    limit_s: 8,
  });

  return {
    vars: {
      overhead_rule: level === 1
        ? "In this exercise `overhead` is always 0, but keep the parameter."
        : "Every part also repeats the document's shared resources (fonts, structure): it costs `overhead` bytes on top of its pages (this exercise's rule).",
      chapter_rule: level === 3
        ? "Pages listed in `chapter_starts` (page numbers, unsorted, possibly including 1) must each begin a part, so a part never crosses into a new chapter. If that needs more than `k` parts, return `None`."
        : "In this exercise `chapter_starts` is always empty, but keep the parameter.",
    },
    samples,
    tests,
  };
}
