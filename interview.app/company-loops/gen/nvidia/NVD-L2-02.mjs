/* NVD-L2-02 — Step-time change point: the one split that best explains a slowdown (Python).
   Simulated practice scenario. All data is generated from the seed.

   Contract (python): entry, signature, starter, prelude, generate(r, level) ->
     { vars, samples: [{args, expect}], tests: [{name, args, expect?, limit_s?}] }.
   expect comes from oracle() below: for every allowed split it recomputes both
   segments' squared error from scratch, in exact BigInt rationals, and compares the
   costs directly. The evaluator's reference keeps running sums and maximises the
   explained part by cross-multiplication, written independently.
   level: 1 Medium (microsecond-resolution values, short warm-up windows)
          · 2 Hard (+ exact threshold boundaries, warm-up that hides the best split)
          · 3 Very Hard (+ nanosecond values large enough that floating point cannot
            separate exactly tied splits) */
export const kind = "python";
export const entry = "find_change_point";
export const signature = "def find_change_point(step_ns: list[int], min_len: int, max_ratio_pct: int) -> tuple[int, float, float] | None:";
export const starter = `def find_change_point(step_ns, min_len, max_ratio_pct):
    """step_ns: step times of one training job, in step order (integer nanoseconds).
    Return (k, mean_before, mean_after) for the best split, or None."""
    ...
`;

export const prelude = `
def _gen_steps(n, seed, min_len=50, max_ratio_pct=90):
    x, out = seed, []
    def rnd(m):
        nonlocal x
        x = (1103515245 * x + 12345) % 2147483648
        return (x >> 16) % m
    base = 300000000 + rnd(200000000)
    shift = n // 3 + rnd(n // 3)
    for i in range(n):
        v = base + rnd(40000000)
        if i >= shift:
            v += 25000000 + rnd(5000000)
        if rnd(1000) == 0:
            v += 900000000                     # an occasional checkpoint-save step
        out.append(v)
    return out, min_len, max_ratio_pct
`.trim() + "\n";

// The specification, directly: exact squared error per split, recomputed for every k.
// SSE of a segment = (m * sum(x^2) - sum(x)^2) / m, kept as a BigInt fraction.
function sseFrac(xs) {
  const m = BigInt(xs.length);
  let s = 0n, q = 0n;
  for (const v of xs) { const b = BigInt(v); s += b; q += b * b; }
  return [m * q - s * s, m];                 // numerator, denominator
}
export function oracle(xs, minLen, pct) {
  const n = xs.length;
  if (n < 2 * minLen) return null;
  const [bn, bd] = sseFrac(xs);
  if (bn === 0n) return null;
  let best = null;                           // [k, num, den]
  for (let k = minLen; k <= n - minLen; k++) {
    const [ln, ld] = sseFrac(xs.slice(0, k));
    const [rn, rd] = sseFrac(xs.slice(k));
    const num = ln * rd + rn * ld, den = ld * rd;
    if (!best || num * best[2] < best[1] * den) best = [k, num, den];
  }
  const [k, num, den] = best;
  if (num * 100n * bd > BigInt(pct) * bn * den) return null;
  const sum = (a) => a.reduce((s, v) => s + v, 0);
  return [k, sum(xs.slice(0, k)) / k, sum(xs.slice(k)) / (n - k)];
}

const pyNum = (v) => (Number.isInteger(v) ? v + ".0" : String(v));
const pyOut = (o) => (o === null ? "None" : `(${o[0]}, ${pyNum(o[1])}, ${pyNum(o[2])})`);
const pyArgs = (xs, minLen, pct) => `([${xs.join(", ")}], ${minLen}, ${pct})`;

function series(r, level, n) {
  const unit = level === 3 ? 1 : 1000;
  const base = r.int(250, 600) * 1_000_000;
  const noise = r.int(5, 40) * 1_000_000;
  const shift = r.int(2, n - 2);
  const jump = (r.chance(0.8) ? 1 : -1) * r.int(10, 80) * 1_000_000;
  const xs = [];
  for (let i = 0; i < n; i++) {
    let v = base + Math.floor(r.int(0, noise) / unit) * unit + (i >= shift ? jump : 0);
    if (level >= 2 && i === 0 && r.chance(0.5)) v += r.int(2, 6) * base;   // a slow first step (warm-up)
    xs.push(v);
  }
  return xs;
}

function randomCase(r, level) {
  for (let attempt = 0; attempt < 80; attempt++) {
    const n = level === 1 ? r.int(8, 14) : level === 2 ? r.int(12, 20) : r.int(16, 28);
    const xs = series(r, level, n);
    const minLen = level === 1 ? r.int(1, 2) : r.int(2, 4);
    const pct = r.pick([60, 75, 90]);
    const got = oracle(xs, minLen, pct);
    if (got !== null || attempt % 4 === 3) return { xs, minLen, pct, got };
  }
  throw new Error("NVD-L2-02: could not build a sample");
}

// A short series whose best split costs exactly an integer percentage of the original.
function exactBoundary(r) {
  for (let attempt = 0; attempt < 4000; attempt++) {
    const n = r.int(4, 7);
    const xs = Array.from({ length: n }, () => r.int(0, 9) * 1000);
    const [bn, bd] = sseFrac(xs);
    if (bn === 0n) continue;
    let best = null;
    for (let k = 1; k < n; k++) {
      const [ln, ld] = sseFrac(xs.slice(0, k));
      const [rn, rd] = sseFrac(xs.slice(k));
      const num = ln * rd + rn * ld, den = ld * rd;
      if (!best || num * best[1] < best[0] * den) best = [num, den];
    }
    const top = best[0] * 100n * bd, bottom = bn * best[1];            // ratio in percent = top / bottom
    if (top % bottom === 0n && top > 0n && top / bottom < 100n) return { xs, pct: Number(top / bottom) };
  }
  return { xs: [0, 0, 3000, 3000, 6000], pct: 25 };                    // a known case, should the search fail
}

export function generate(r, level) {
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const c = randomCase(r, level);
    samples.push({ args: pyArgs(c.xs, c.minLen, c.pct), expect: pyOut(c.got) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const v = r.int(300, 500) * 1_000_000, d = r.int(20, 60) * 1_000_000;
  const flat = Array.from({ length: r.int(5, 9) }, () => v);
  const m = r.int(2, 4);
  const edges = [
    ["two splits with exactly equal cost: the smaller k wins", [v, v - d, v], 1, 100],
    ["a constant series has no change point", flat, 1, 100],
    ["fewer than 2 * min_len steps", [v, v + d, v + d], 2, 100],
    ["exactly 2 * min_len steps: the only split is k = min_len",
      [...Array(m).fill(v), ...Array(m - 1).fill(v + d), v + 2 * d], m, 100],
    ["a clean step: the split lands on the first slow step", [...Array(m + 2).fill(v), ...Array(m + 3).fill(v + d)], 1, 50],
    ["the best split is not good enough: max_ratio_pct not met", [v, v + d, v, v + d, v, v + d], 1, 50],
  ];
  if (level >= 2) {
    const eb = exactBoundary(r);
    edges.push(["a split cost of exactly max_ratio_pct percent of the original is reported", eb.xs, 1, eb.pct]);
    edges.push(["one percent below that, the same series has no change point", eb.xs, 1, eb.pct - 1]);
    edges.push(["a slow first step: min_len keeps the split out of the warm-up, and it lands on the slowdown",
      [v + 2 * d, v, v, v, v + d, v + d, v + d], 2, 100]);
  }
  if (level === 3) {
    // Large values, mirrored: the splits at a and at n - a cost exactly the same. Float
    // arithmetic on sums of squares near 1e20 cannot be trusted to keep the tie.
    for (let t = 0; t < 5; t++) {
      const a = r.int(6, 15), b = r.int(4, 12);
      const hi = r.int(2_000_000_000, 8_000_000_000), lo = hi - r.int(200, 900);   // a shift of under a microsecond
      const half = Array.from({ length: a }, () => hi + r.int(0, 99));
      const mid = Array.from({ length: b }, () => lo + r.int(0, 99));
      const midSym = [...mid.slice(0, Math.ceil(b / 2)), ...mid.slice(0, Math.floor(b / 2)).reverse()];
      edges.push([`mirrored nanosecond series ${t + 1}: two exactly tied splits, the smaller k wins`,
        [...half, ...midSym, ...half.slice().reverse()], 1, 100]);
    }
  }
  for (const [name, xs, ml, pct] of edges) tests.push({ name, args: pyArgs(xs, ml, pct), expect: pyOut(oracle(xs, ml, pct)) });

  // Timing: 200 000 steps. Running sums make each split O(1); recomputing the two
  // segments for every split is O(n) per split, O(n^2) in total.
  tests.push({
    name: "200,000 steps (running sums, not a recomputation per split)",
    args: `_gen_steps(200000, ${r.int(1, 1_000_000)}, ${level === 1 ? 20 : 500}, ${r.pick([80, 90])})`,
    limit_s: 8,
  });

  return {
    vars: {
      data_rule: level === 1
        ? "The series you are given are short and recorded to the microsecond, so every value is a multiple of 1 000."
        : level === 2
          ? "The series you are given include a slow first step (warm-up) and costs that land exactly on the threshold."
          : "The series you are given are recorded to the nanosecond, and some are runs of values between 2 000 000 000 and 8 000 000 000.",
    },
    samples,
    tests,
  };
}
