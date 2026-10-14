/* NFX-L1-05 — Subtitle cue repair after a frame-rate change (Python, sorting and interval merging).
   Simulated practice scenario. All data is generated from the seed; cue text, timings,
   offsets and thresholds are hypothetical.

   Contract (python): entry, signature, starter, prelude, generate(r, level) ->
     { vars, samples: [{args, expect}], tests: [{name, args, expect?, limit_s?}] }.
   expect comes from oracle() below, which groups cues as connected components of the
   pairwise overlap graph (O(n^2), small inputs only); the evaluator's reference sorts and
   sweeps once, so each checks the other.
   level: 1 Medium (rescale with round half up, shift by a non-negative offset, merge
                    overlaps, close gaps shorter than min_gap_ms)
          2 Hard (+ negative offsets: cues ending at or before 0 are dropped, starts clamp to 0;
                  input in any order, equal starts keep input order; chains of overlaps)
          3 Very Hard (+ a line already in a merged cue is not repeated) */
export const kind = "python";
export const entry = "repair_cues";
export const signature = "def repair_cues(cues: list[tuple[int, int, str]], num: int, den: int, offset_ms: int, min_gap_ms: int, dedupe: bool = False) -> list[tuple[int, int, str]]:";
export const starter = `def repair_cues(cues, num, den, offset_ms, min_gap_ms, dedupe=False):
    """cues: (start_ms, end_ms, text). Rescale every time by num/den (round half up),
    shift by offset_ms, then merge overlapping cues and close tiny gaps.
    Return [(start_ms, end_ms, text)] sorted by start."""
    ...
`;

export const prelude = `
_LINES = ["Where were you?", "Keep the lights off.", "[door creaks]", "We leave at dawn.", "Not yet.",
          "- Who is it?", "- Open up!", "[rain on the window]", "I never said that.", "Run!"]


def _gen_cues(n, seed, shuffle=False):
    x, t, out = seed, 0, []
    for _ in range(n):
        x = (1103515245 * x + 12345) % 2147483648
        t += 800 + (x >> 8) % 2400
        x = (1103515245 * x + 12345) % 2147483648
        dur = 600 + (x >> 8) % 1800
        x = (1103515245 * x + 12345) % 2147483648
        out.append((t, t + dur, _LINES[(x >> 8) % len(_LINES)]))
    if shuffle:
        for i in range(len(out) - 1, 0, -1):
            x = (1103515245 * x + 12345) % 2147483648
            j = (x >> 8) % (i + 1)
            out[i], out[j] = out[j], out[i]
    return out
`.trim() + "\n";

const RATES = [
  { num: 25025, den: 24000, label: "timed against a 25 fps master and now played at 23.976 fps (times stretch by 25 / 23.976)" },
  { num: 24000, den: 25025, label: "timed against a 23.976 fps master and now played at 25 fps (times shrink by 23.976 / 25)" },
  { num: 1001, den: 1000, label: "timed against a 24 fps master and now played at 23.976 fps (times stretch by 24 / 23.976)" },
  { num: 1000, den: 1001, label: "timed against a 23.976 fps master and now played at 24 fps (times shrink by 23.976 / 24)" },
];
const LINES = ["Where were you?", "Keep the lights off.", "[door creaks]", "We leave at dawn.", "Not yet.", "- Who is it?",
  "- Open up!", "[rain on the window]", "I never said that.", "Run!", "[distant sirens]", "Is anyone there?", "Hold the line."];

const scale = (t, num, den) => Math.floor((2 * t * num + den) / (2 * den));        // round half up, exact in doubles here

// Components of the overlap graph after sorting; O(n^2), small inputs only.
export function oracle(cues, num, den, off, minGap, dedupe) {
  const items = [];
  cues.forEach(([s, e, text], i) => {
    let ns = scale(s, num, den) + off;
    const ne = scale(e, num, den) + off;
    if (ne <= 0) return;
    if (ns < 0) ns = 0;
    items.push({ s: ns, e: ne, text, i });
  });
  items.sort((a, b) => a.s - b.s || a.i - b.i);
  const parent = items.map((_, i) => i);
  const find = (x) => (parent[x] === x ? x : (parent[x] = find(parent[x])));
  for (let a = 0; a < items.length; a++) for (let b = a + 1; b < items.length; b++) {
    if (items[b].s < items[a].e) parent[find(b)] = find(a);
  }
  const groups = new Map();
  items.forEach((it, k) => { const root = find(k); if (!groups.has(root)) groups.set(root, []); groups.get(root).push(it); });
  const merged = [...groups.values()].map((g) => {
    const lines = [];
    for (const it of g) if (!dedupe || !lines.includes(it.text)) lines.push(it.text);
    return { s: Math.min(...g.map((x) => x.s)), e: Math.max(...g.map((x) => x.e)), lines };
  }).sort((a, b) => a.s - b.s);
  for (let k = 0; k + 1 < merged.length; k++) {
    const gap = merged[k + 1].s - merged[k].e;
    if (gap > 0 && gap < minGap) merged[k].e = merged[k + 1].s;
  }
  return merged.map((m) => [m.s, m.e, m.lines.join("\n")]);
}

const pyStr = (s) => JSON.stringify(s);
const pyCues = (cs) => "[" + cs.map(([s, e, t]) => `(${s}, ${e}, ${pyStr(t)})`).join(", ") + "]";
const pyArgs = (c, dedupe) => `(${pyCues(c.cues)}, ${c.rate.num}, ${c.rate.den}, ${c.off}, ${c.gap}, ${dedupe ? "True" : "False"})`;
const pyOut = (out) => "[" + out.map(([s, e, t]) => `(${s}, ${e}, ${pyStr(t)})`).join(", ") + "]";

export function generate(r, level) {
  const rate = r.pick(RATES);
  const minGap = r.pick([80, 84, 120, 160]);
  const dedupe = level === 3;
  const run = (c) => oracle(c.cues, c.rate.num, c.rate.den, c.off, c.gap, dedupe);
  // A random scene: mostly sequential cues, some overlapping (two speakers), some tiny gaps.
  const randomCase = (n) => {
    const cues = [];
    let t = r.int(level >= 2 ? 0 : 1000, 4000);
    for (let k = 0; k < n; k++) {
      const dur = r.int(600, 3000);
      cues.push([t, t + dur, r.pick(LINES)]);
      const roll = r.next();
      if (roll < 0.25) t += r.int(100, dur - 100);                                   // next overlaps
      else if (roll < 0.45) t += dur + r.int(1, minGap + 20);                        // tiny gap, near the threshold
      else t += dur + r.int(200, 2500);
    }
    if (level === 3 && cues.length > 2) {                                            // a line delivered twice, overlapping
      const k = r.int(0, cues.length - 1), [s, e, text] = cues[k];
      cues.splice(k + 1, 0, [s + r.int(0, 200), e + r.int(-100, 300), text]);
    }
    const off = level === 1 ? r.int(0, 3) * 250 : r.pick([-1500, -900, -400, 0, 600, 1200]);
    return { cues: level >= 2 ? r.shuffle(cues) : cues, rate, off, gap: minGap };
  };
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const c = randomCase(r.int(5, 8));
    samples.push({ args: pyArgs(c, dedupe), expect: pyOut(run(c)) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const L = r.sample(LINES, 6);
  const plain = { num: 1, den: 1 };
  // A start whose rescaled time is exactly half a millisecond (round half up), if the rate has one.
  let half = null;
  if (rate.den % 2 === 0) for (let t = 1; t < 400000 && half === null; t++) if ((t * rate.num) % rate.den === rate.den / 2) half = t;
  const edges = [
    ["no cues", { cues: [], rate, off: 0, gap: minGap }],
    ["one cue is only rescaled and shifted", { cues: [[61000, 63500, L[0]]], rate, off: level === 1 ? 500 : -500, gap: minGap }],
    ["cues that touch end-to-start are not merged", { cues: [[1000, 2000, L[0]], [2000, 3000, L[1]]], rate: plain, off: 0, gap: minGap }],
    ["overlapping cues merge, lines in start order", { cues: [[1000, 2500, L[0]], [2000, 3000, L[1]], [4000, 5000, L[2]]], rate: plain, off: 0, gap: minGap }],
    ["a gap of exactly min_gap_ms is kept", { cues: [[1000, 2000, L[0]], [2000 + minGap, 3000, L[1]]], rate: plain, off: 0, gap: minGap }],
    ["a gap one millisecond shorter is closed", { cues: [[1000, 2000, L[0]], [2000 + minGap - 1, 3000, L[1]]], rate: plain, off: 0, gap: minGap }],
    ["a cue inside another merges into it", { cues: [[1000, 5000, L[0]], [2000, 3000, L[1]]], rate: plain, off: 0, gap: minGap }],
    ["rescaling can create an overlap that was not there", { cues: [[10000, 20000, L[0]], [20005, 21000, L[1]]], rate: { num: 1001, den: 1000 }, off: 0, gap: 1 }],
  ];
  if (half !== null) edges.push(["a rescaled time exactly halfway rounds up", { cues: [[half, half + 2000, L[3]]], rate, off: 0, gap: minGap }]);
  if (level >= 2) {
    edges.push(["a negative offset drops cues that end at or before 0", { cues: [[200, 900, L[0]], [500, 1000, L[1]], [1200, 2500, L[2]]], rate: plain, off: -1000, gap: minGap }]);
    edges.push(["a negative offset clamps a start to 0", { cues: [[300, 1800, L[0]], [2400, 3000, L[1]]], rate: plain, off: -600, gap: minGap }]);
    edges.push(["input in any order; equal starts keep input order", { cues: [[3000, 4000, L[2]], [1000, 2000, L[1]], [1000, 1500, L[0]]], rate: plain, off: 0, gap: minGap }]);
    edges.push(["a chain: A overlaps B, B overlaps C, A does not overlap C", { cues: [[1000, 2000, L[0]], [1900, 3000, L[1]], [2900, 4000, L[2]], [6000, 7000, L[3]]], rate: plain, off: 0, gap: minGap }]);
    edges.push(["a merged cue's end is the latest end, not the last cue's", { cues: [[1000, 6000, L[0]], [2000, 3000, L[1]], [5000, 5500, L[2]], [6000 + minGap - 1, 7000, L[3]]], rate: plain, off: 0, gap: minGap }]);
  }
  if (level === 3) {
    edges.push(["the same line twice in one merged cue appears once", { cues: [[1000, 2500, L[0]], [1200, 2600, L[0]], [2400, 3500, L[1]]], rate: plain, off: 0, gap: minGap }]);
    edges.push(["the same line in two separate cues stays in both", { cues: [[1000, 2000, L[0]], [3000, 4000, L[0]]], rate: plain, off: 0, gap: minGap }]);
    edges.push(["a repeated line after another line is still dropped", { cues: [[1000, 3000, L[1]], [1500, 2000, L[2]], [1800, 2800, L[1]]], rate: plain, off: 0, gap: minGap }]);
  }
  for (const [name, c] of edges) tests.push({ name, args: pyArgs(c, dedupe), expect: pyOut(run(c)) });

  // Timing: compared with the reference at check time. Merging by repeatedly scanning
  // for an overlapping pair is quadratic; one sort and one sweep is O(n log n).
  const n = 100000, seed = r.int(1, 1_000_000);
  tests.push({
    name: `${n.toLocaleString("en-US")} cues in time`,
    args: `(_gen_cues(${n}, ${seed}, ${level >= 2 ? "True" : "False"}), ${rate.num}, ${rate.den}, ${level >= 2 ? -700 : 400}, ${minGap}, ${dedupe ? "True" : "False"})`,
    limit_s: 8,
  });

  return {
    vars: {
      rate_story: rate.label,
      num: rate.num,
      den: rate.den,
      min_gap_ms: minGap,
      offset_rule: level === 1
        ? "In this exercise `offset_ms` is never negative and `cues` arrive sorted by start."
        : "`offset_ms` can be negative: a cue whose new end is at or before 0 is dropped, and a new start below 0 becomes 0. `cues` arrive in any order; cues with equal new starts keep their input order.",
      dedupe_rule: level === 3
        ? "`dedupe` is True: when a cue merges into one that already has exactly the same line of text, that line is not repeated."
        : "`dedupe` is False: merged lines are kept even if two of them are the same text.",
    },
    samples,
    tests,
  };
}
