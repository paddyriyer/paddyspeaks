/* PIN-L2-02 — Order agreement: discordant pairs between the shown order and a given
   scoring function (Python, divide and conquer / inversion counting).
   Simulated practice scenario. All data is generated from the seed.

   Contract (python): entry, signature, starter, prelude, generate(r, level) ->
     { vars, samples: [{args, expect}], tests: [{name, args, expect?, limit_s?}] }.
   expect comes from oracle() below, which compares every pair of counted pins. The
   evaluator's reference counts with a merge sort, so each checks the other.
   level: 1 Medium (distinct scores, every pin once) · 2 Hard (+ equal scores, repeated
          pins counted at their first position, pins without a score skipped) ·
          3 Very Hard (+ also report the number of comparable pairs) */
export const kind = "python";
export const entry = "discordant_pairs";
export const signature = "def discordant_pairs(shown: list[str], scores: dict[str, int], report_comparable: bool = False) -> int | tuple[int, int]:";
export const starter = `def discordant_pairs(shown, scores, report_comparable=False):
    """shown: pin ids in the order they were shown, first position first.
    scores: pin id -> integer score from the scoring function (higher ranks higher).
    Return the number of pairs shown in an order the scoring function disagrees with."""
    ...
`;

export const prelude = `
def _gen_ranked(n, seed, tie_div=1, repeat_pct=0, unscored_pct=0):
    x = seed
    perm = list(range(n))
    for i in range(n - 1, 0, -1):
        x = (1103515245 * x + 12345) % 2147483648
        j = (x >> 4) % (i + 1)
        perm[i], perm[j] = perm[j], perm[i]
    shown, scores = [], {}
    for i in range(n):
        pin = 'pin_%07d' % (i * 3 + 1)
        x = (1103515245 * x + 12345) % 2147483648
        if repeat_pct and i > 10 and (x >> 8) % 100 < repeat_pct:
            shown.append(shown[(x >> 12) % len(shown)])
        shown.append(pin)
        if not (unscored_pct and (x >> 16) % 100 < unscored_pct):
            scores[pin] = perm[i] // tie_div - n // (2 * tie_div)
    return shown, scores
`.trim() + "\n";

// Every pair of counted pins. Small inputs only.
export function oracle(shown, scores, comparable) {
  const seen = new Set();
  const v = [];
  for (const p of shown) {
    if (seen.has(p)) continue;                       // a scroll-back: first position only
    seen.add(p);
    if (Object.prototype.hasOwnProperty.call(scores, p)) v.push(scores[p]);
  }
  let d = 0, c = 0;
  for (let i = 0; i < v.length; i++) {
    for (let j = i + 1; j < v.length; j++) {
      if (v[i] < v[j]) d++;
      if (v[i] !== v[j]) c++;
    }
  }
  return comparable ? [d, c] : d;
}

const pyArgs = (c) =>
  "([" + c.shown.map((p) => `'${p}'`).join(", ") + "], {" +
  Object.entries(c.scores).map(([k, s]) => `'${k}': ${s}`).join(", ") + "}, " + (c.comparable ? "True" : "False") + ")";
const pyOut = (x) => (Array.isArray(x) ? `(${x[0]}, ${x[1]})` : String(x));
const run = (c) => oracle(c.shown, c.scores, c.comparable);

function randomCase(r, level, comparable) {
  for (let attempt = 0; attempt < 60; attempt++) {
    const n = r.int(8, 12);
    const base = r.int(100, 900) * 1000;
    const pins = r.sample(Array.from({ length: 40 }, (_, i) => `pin_${base + i * 10 + r.int(0, 9)}`), n);
    const scores = {};
    if (level === 1) {
      const vals = r.sample(Array.from({ length: 60 }, (_, i) => i * 7 - 150), n);
      pins.forEach((p, i) => { scores[p] = vals[i]; });
    } else {
      for (const p of pins) if (!r.chance(0.12)) scores[p] = r.int(-6, 9) * 5;  // equal scores happen
    }
    // The shown order agrees with the scoring function only partly.
    const order = pins.slice().sort((a, b) => (scores[b] ?? 0) - (scores[a] ?? 0));
    for (let k = 0; k < r.int(3, 6); k++) {
      const i = r.int(0, n - 2), j = r.int(i + 1, Math.min(n - 1, i + 4));
      [order[i], order[j]] = [order[j], order[i]];
    }
    const shown = order.slice();
    if (level >= 2) for (let k = 0; k < r.int(1, 2); k++) shown.splice(r.int(1, shown.length), 0, r.pick(order));
    const c = { shown, scores, comparable };
    const got = run(c);
    const d = Array.isArray(got) ? got[0] : got;
    if (d > 0) return c;
  }
  throw new Error("PIN-L2-02: could not build a sample with a discordant pair");
}

export function generate(r, level) {
  const comparable = level === 3;
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const c = randomCase(r, level, comparable);
    samples.push({ args: pyArgs(c), expect: pyOut(run(c)) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const base = r.int(1000, 9000);
  const P = (k) => `pin_${base + k}`;
  const k = r.int(5, 9);
  const ids = Array.from({ length: k }, (_, i) => P(i));
  const desc = {};
  ids.forEach((p, i) => { desc[p] = (k - i) * 10; });              // ids in descending score order
  const edges = [
    ["shown exactly in the scoring order", { shown: ids, scores: desc }],
    ["shown in exactly the reverse order", { shown: ids.slice().reverse(), scores: desc }],
    ["one adjacent swap is one pair", { shown: [ids[1], ids[0], ...ids.slice(2)], scores: desc }],
    ["a single pin has no pairs", { shown: [P(0)], scores: { [P(0)]: 5 } }],
    ["nothing shown", { shown: [], scores: {} }],
    ["negative scores compare as integers", { shown: [P(0), P(1), P(2)], scores: { [P(0)]: -40, [P(1)]: -3, [P(2)]: -25 } }],
    ["a pin moved from last to first",
      { shown: [ids[k - 1], ...ids.slice(0, k - 1)], scores: desc }],
  ];
  if (level >= 2) {
    edges.push(["equal scores are not discordant", { shown: [P(0), P(1), P(2)], scores: { [P(0)]: 10, [P(1)]: 10, [P(2)]: 30 } }]);
    edges.push(["every score equal", { shown: [P(0), P(1), P(2), P(3)], scores: { [P(0)]: 7, [P(1)]: 7, [P(2)]: 7, [P(3)]: 7 } }]);
    edges.push(["a repeated pin counts at its first position",
      { shown: [P(0), P(1), P(0)], scores: { [P(0)]: 20, [P(1)]: 10 } }]);
    edges.push(["a pin first shown low and repeated high still counts low",
      { shown: [P(1), P(2), P(0), P(1)], scores: { [P(0)]: 30, [P(1)]: 10, [P(2)]: 20 } }]);
    edges.push(["a pin without a score is skipped",
      { shown: [P(0), P(9), P(1)], scores: { [P(0)]: 5, [P(1)]: 50 } }]);
    edges.push(["ties inside a reversed order",
      { shown: [P(0), P(1), P(2), P(3), P(4)], scores: { [P(0)]: 1, [P(1)]: 1, [P(2)]: 2, [P(3)]: 2, [P(4)]: 3 } }]);
  }
  for (const [name, c] of edges) {
    c.comparable = comparable;
    tests.push({ name, args: pyArgs(c), expect: pyOut(run(c)) });
  }

  // Timing: compared with the reference at check time. All pairs is ~10^11
  // comparisons; an insertion-sorted list (bisect.insort) moves ~n²/4 pointers.
  const n = 380000;
  const seed = r.int(1, 1_000_000);
  const extra = level === 1 ? "" : ", 4, 2, 1";
  tests.push({
    name: `${n.toLocaleString("en-US")} shown pins in time`,
    args: `(*_gen_ranked(${n}, ${seed}${extra}), ${comparable ? "True" : "False"})`,
    limit_s: 8,
  });

  return {
    vars: {
      data_rule: level === 1
        ? "In this exercise every pin in `shown` appears once and has a score, and no two scores are equal."
        : "A pin can appear more than once in `shown` (the pinner scrolled back up): only its first position counts. A pin with no entry in `scores` is skipped. Two pins with equal scores are neither in agreement nor discordant.",
      return_rule: level === 3
        ? "Call with `report_comparable=True`: return a tuple `(discordant, comparable)`, where `comparable` is the number of pairs of counted pins whose scores differ. Nothing shown returns `(0, 0)`."
        : "`report_comparable` is False: return one integer.",
    },
    samples,
    tests,
  };
}
