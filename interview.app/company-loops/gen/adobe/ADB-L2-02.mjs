/* ADB-L2-02 — Breaking a paragraph into lines with the least squared slack (Python).
   Simulated practice scenario. All data is generated from the seed.

   Contract (python): entry, signature, starter, prelude, generate(r, level) ->
     { vars, samples: [{args, expect}], tests: [{name, args, expect?, limit_s?}] }.
   expect comes from oracle() below: it enumerates EVERY way to break a short
   paragraph (2^(n-1) choices), keeps the legal ones, and takes the minimum by
   (cost, list of line starts). The evaluator's reference is a suffix DP whose
   inner loop stops at the line width, written independently.
   level: 1 Medium (space 1, every word fits)
          · 2 Hard (wider spaces, lines that fill exactly, ties between layouts)
          · 3 Very Hard (+ forced line breaks, and a word wider than the line → None) */
export const kind = "python";
export const entry = "break_lines";
export const signature = "def break_lines(widths: list[int], line_width: int, space: int, forced: list[int]) -> tuple[int, list[int]] | None:";
export const starter = `def break_lines(widths, line_width, space, forced):
    """widths: width of each word, in layout units, in reading order.
    A line holding words i..j is sum(widths[i..j]) + space * (j - i) wide and must
    fit in line_width. Return (cost, starts): the least total squared slack, and the
    index of the first word of every line. None if some word is wider than a line."""
    ...
`;

export const prelude = `
def _gen_words(n, seed, line_width, space, forced_every=0):
    x = seed
    def rnd(m):
        nonlocal x
        x = (1103515245 * x + 12345) % 2147483648
        return (x >> 16) % m
    widths = [2 + rnd(11) for _ in range(n)]
    forced = []
    if forced_every:
        i = forced_every // 2
        while i < n:
            forced.append(i)
            i += forced_every // 2 + rnd(forced_every)
    return widths, line_width, space, forced
`.trim() + "\n";

/* Independent oracle: try every set of break points. A break after word i (i < n-1)
   is bit i of the mask. */
export function oracle(widths, L, space, forced) {
  const n = widths.length;
  if (widths.some((w) => w > L)) return null;
  if (n === 0) return [0, []];
  const hard = new Set(forced);
  let best = null;
  for (let mask = 0; mask < 1 << (n - 1); mask++) {
    let ok = true;
    for (const f of hard) if (f < n - 1 && !(mask & (1 << f))) { ok = false; break; }
    if (!ok) continue;
    const starts = [0];
    for (let i = 0; i < n - 1; i++) if (mask & (1 << i)) starts.push(i + 1);
    let cost = 0;
    for (let s = 0; s < starts.length && ok; s++) {
      const a = starts[s], b = s + 1 < starts.length ? starts[s + 1] - 1 : n - 1;
      let len = 0;
      for (let i = a; i <= b; i++) len += widths[i];
      len += space * (b - a);
      if (len > L) { ok = false; break; }
      if (b !== n - 1 && !hard.has(b)) cost += (L - len) * (L - len);
    }
    if (!ok) continue;
    if (!best || cost < best[0] || (cost === best[0] && lexLess(starts, best[1]))) best = [cost, starts];
  }
  return best;
}
function lexLess(a, b) {
  for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) return a[i] < b[i];
  return a.length < b.length;
}
// A first-fit layout, used only to choose an edge case where it is not optimal.
function greedyCost(widths, L, space) {
  let cost = 0, len = -space;
  for (let i = 0; i < widths.length; i++) {
    if (len + space + widths[i] > L) { cost += (L - len) * (L - len); len = widths[i]; } else len += space + widths[i];
  }
  return cost;
}
// The same search with the last line charged, to choose a "last line is free" edge case.
function chargedLast(widths, L, space) {
  const n = widths.length;
  let best = Infinity;
  for (let mask = 0; mask < 1 << (n - 1); mask++) {
    const starts = [0];
    for (let i = 0; i < n - 1; i++) if (mask & (1 << i)) starts.push(i + 1);
    let cost = 0, ok = true;
    for (let s = 0; s < starts.length; s++) {
      const a = starts[s], b = s + 1 < starts.length ? starts[s + 1] - 1 : n - 1;
      let len = space * (b - a);
      for (let i = a; i <= b; i++) len += widths[i];
      if (len > L) { ok = false; break; }
      cost += (L - len) * (L - len);
    }
    if (ok && cost < best) best = cost;
  }
  return best;
}
function countOptimal(widths, L, space) {
  const n = widths.length, target = oracle(widths, L, space, [])[0];
  let count = 0;
  for (let mask = 0; mask < 1 << (n - 1); mask++) {
    const starts = [0];
    for (let i = 0; i < n - 1; i++) if (mask & (1 << i)) starts.push(i + 1);
    let cost = 0, ok = true;
    for (let s = 0; s < starts.length; s++) {
      const a = starts[s], b = s + 1 < starts.length ? starts[s + 1] - 1 : n - 1;
      let len = space * (b - a);
      for (let i = a; i <= b; i++) len += widths[i];
      if (len > L) { ok = false; break; }
      if (b !== n - 1) cost += (L - len) * (L - len);
    }
    if (ok && cost === target) count++;
  }
  return count;
}

const pyOut = (v) => (v === null ? "None" : `(${v[0]}, [${v[1].join(", ")}])`);
const pyArgs = (w, L, sp, f) => `([${w.join(", ")}], ${L}, ${sp}, [${f.join(", ")}])`;

function randomWords(r, n, lo, hi) {
  return Array.from({ length: n }, () => r.int(lo, hi));
}

function randomCase(r, level) {
  const n = level === 1 ? r.int(8, 11) : r.int(10, 14);
  const space = level === 1 ? 1 : r.int(1, 3);
  const L = level === 1 ? r.int(14, 22) : r.int(16, 28);
  const widths = randomWords(r, n, 1, level === 1 ? 7 : 9);
  let forced = [];
  if (level === 3) {
    if (r.chance(0.25)) widths[r.int(0, n - 1)] = L + r.int(1, 4);                       // a word wider than the line
    else forced = r.sample([...Array(n - 1).keys()].slice(1), r.int(1, 2)).sort((a, b) => a - b);
  }
  return { widths, L, space, forced };
}

function search(r, tries, make, ok) {
  for (let i = 0; i < tries; i++) { const c = make(); if (ok(c)) return c; }
  return null;
}

export function generate(r, level) {
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const c = randomCase(r, level);
    samples.push({ args: pyArgs(c.widths, c.L, c.space, c.forced), expect: pyOut(oracle(c.widths, c.L, c.space, c.forced)) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const L = r.int(18, 26);
  const edges = [
    ["an empty paragraph", [], L, 1, []],
    ["everything fits on one line, which is free", [3, 4, 2], L, 1, []],
    ["a word exactly as wide as the line fits", [L, 3, 4], L, 1, []],
  ];
  // two words plus one space that fill the line exactly, then more words
  const w1 = r.int(4, L - 6);
  edges.push(["a line that fills exactly has no slack", [w1, L - 1 - w1, 5, 6, 4], L, 1, []]);
  const greedy = search(r, 400, () => {
    const w = randomWords(r, r.int(6, 9), 1, 8);
    return { w, L: r.int(10, 16) };
  }, (c) => greedyCost(c.w, c.L, 1) > oracle(c.w, c.L, 1, [])[0] && greedyCost(c.w, c.L, 1) - oracle(c.w, c.L, 1, [])[0] >= 4);
  const g = greedy || { w: [3, 2, 2, 5], L: 6 };
  edges.push(["filling each line as far as it goes is not optimal", g.w, g.L, 1, []]);
  const lastFree = search(r, 400, () => ({ w: randomWords(r, r.int(6, 9), 1, 7), L: r.int(10, 16) }),
    (c) => {
      const o = oracle(c.w, c.L, 1, []);
      // the free-last-line answer differs from what charging the last line would choose
      return chargedLast(c.w, c.L, 1) !== o[0] + lastSlack(c.w, c.L, 1, o[1]);
    });
  if (lastFree) edges.push(["the last line is free, so the layout changes", lastFree.w, lastFree.L, 1, []]);
  if (level >= 2) {
    const sp = r.int(2, 3);
    edges.push([`spaces are ${sp} units wide`, [4, 4, 4, 4, 4, 4], 4 * 3 + sp * 2 + r.int(0, 2), sp, []]);
    const tie = search(r, 600, () => ({ w: randomWords(r, r.int(5, 8), 1, 6), L: r.int(9, 14) }),
      (c) => countOptimal(c.w, c.L, 1) >= 2);
    if (tie) edges.push(["two layouts cost the same: the smaller list of starts wins", tie.w, tie.L, 1, []]);
    edges.push(["every word on its own line", [5, 6, 5, 6], 7, 1, []]);
  }
  if (level === 3) {
    edges.push(["a word wider than the line returns None", [3, L + 1, 2], L, 1, []]);
    edges.push(["a forced break after the first word; that line is free", [2, 3, 4, 5, 3], L, 1, [0]]);
    edges.push(["a forced break after the last word changes nothing", [4, 5, 6], L, 1, [2]]);
    const fw = randomWords(r, 10, 2, 6);
    edges.push(["two forced breaks split the paragraph into three free endings", fw, 14, 1, [2, 6]]);
  }
  for (const [name, w, LL, sp, f] of edges) tests.push({ name, args: pyArgs(w, LL, sp, f), expect: pyOut(oracle(w, LL, sp, f)) });

  // Timing: 80,000 words of 2–12 units in a 72-unit line (about 9 words a line).
  // Stopping the inner loop at the line width is about 10 steps per word; trying
  // every later word as the line end is about 3×10⁹ steps.
  tests.push({
    name: "80,000 words (inner loop must stop at the line width)",
    args: `_gen_words(80000, ${r.int(1, 1_000_000)}, 72, ${level === 1 ? 1 : 2}, ${level === 3 ? 300 : 0})`,
    limit_s: 8,
  });

  return {
    vars: {
      forced_rule: level === 3
        ? "`forced` lists word indices, sorted and distinct, after which a line must end (a manual line break in the paragraph). In this exercise a line that ends at a forced break is free, like the last line, and no line may run past a forced break."
        : "In this exercise `forced` is always empty, but keep the parameter.",
      width_rule: level === 3
        ? "If any word is wider than `line_width`, return `None`: the layout engine then hyphenates or scales that word, which is outside this exercise."
        : "Every word is at most `line_width` wide in this replay; return `None` if one is not.",
    },
    samples,
    tests,
  };
}
function lastSlack(w, L, sp, starts) {
  const a = starts[starts.length - 1];
  let len = sp * (w.length - 1 - a);
  for (let i = a; i < w.length; i++) len += w[i];
  return (L - len) * (L - len);
}
