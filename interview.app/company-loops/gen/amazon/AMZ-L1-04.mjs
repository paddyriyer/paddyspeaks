/* AMZ-L1-04 — Usage above a capacity commitment: on-demand unit-seconds (Python).
   Simulated practice scenario. All data is generated from the seed and is hypothetical.

   Contract: see docs/COMPANY-INTERVIEW-LOOPS.md § Executable templates (python).
   For each instance family f: integral over t of max(0, used_f(t) - committed_f(t)),
   where both are sums of units over half-open intervals [start, end) containing t.
   The oracle below is a brute force over every elementary segment (O(n^2), small inputs
   only); the evaluator's reference is an independently written sweep line.
   level: 1 Medium (one family, one unit per instance, one commitment for the whole period)
          2 Hard (+ several families, time-bounded commitments, families with no commitment)
          3 Very Hard (+ normalised size units, overlapping commitments that add up,
                       zero-length usages, commitments for families nobody used) */
export const kind = "python";
export const entry = "on_demand_unit_seconds";
export const signature = "def on_demand_unit_seconds(usages: list[tuple[int, int, str, int]], commitments: list[tuple[int, int, str, int]]) -> dict[str, int]:";
export const starter = `def on_demand_unit_seconds(usages, commitments):
    """usages:      (start_s, end_s, family, units) — one running instance, [start, end)
    commitments: (start_s, end_s, family, units) — capacity paid for, [start, end)
    Return {family: on-demand unit-seconds} for every family in usages."""
    ...
`;

export const prelude = `
def _gen_usage(n, fams, seed, horizon, max_len, units=(1,)):
    x, out = seed, []
    for _ in range(n):
        x = (1103515245 * x + 12345) % 2147483648
        s = (x >> 3) % horizon
        x = (1103515245 * x + 12345) % 2147483648
        ln = 1 + (x >> 7) % max_len
        x = (1103515245 * x + 12345) % 2147483648
        f = fams[(x >> 16) % len(fams)]
        x = (1103515245 * x + 12345) % 2147483648
        out.append((s, s + ln, f, units[(x >> 16) % len(units)]))
    return out
`.trim() + "\n";

// Brute force over elementary segments. Correct and quadratic; small inputs only.
export function oracle(usages, commitments) {
  const out = {};
  const fams = [...new Set(usages.map((u) => u[2]))];
  for (const f of fams) {
    const us = usages.filter((u) => u[2] === f);
    const cs = commitments.filter((c) => c[2] === f);
    const pts = [...new Set([...us, ...cs].flatMap((x) => [x[0], x[1]]))].sort((a, b) => a - b);
    let total = 0;
    for (let i = 0; i + 1 < pts.length; i++) {
      const a = pts[i], b = pts[i + 1];
      let used = 0, com = 0;
      for (const u of us) if (u[0] <= a && a < u[1]) used += u[3];
      for (const c of cs) if (c[0] <= a && a < c[1]) com += c[3];
      if (used > com) total += (used - com) * (b - a);
    }
    out[f] = total;
  }
  return out;
}

const pyDict = (o) => "{" + Object.keys(o).sort().map((k) => `'${k}': ${o[k]}`).join(", ") + "}";
const pyTuples = (xs) => "[" + xs.map(([s, e, f, u]) => `(${s}, ${e}, '${f}', ${u})`).join(", ") + "]";
const pyArgs = (us, cs) => `(${pyTuples(us)}, ${pyTuples(cs)})`;

const FAMILIES = ["gp-m", "compute-c", "memory-r", "burst-t", "gpu-g", "storage-i"];

function smallCase(r, level, fams, n) {
  const units = level === 3 ? [1, 2, 4, 8] : [1];
  const usages = [];
  for (let i = 0; i < n; i++) {
    const s = r.int(0, 40) * 60;
    const len = level === 3 && r.chance(0.12) ? 0 : r.int(1, 30) * 60;
    usages.push([s, s + len, r.pick(fams), r.pick(units)]);
  }
  const commitments = [];
  if (level === 1) commitments.push([0, 7200, fams[0], r.int(1, 2)]);
  else {
    for (const f of fams.slice(0, fams.length - 1)) {
      const s = r.int(0, 20) * 60;
      commitments.push([s, s + r.int(10, 50) * 60, f, level === 3 ? r.pick([2, 4, 8]) : r.int(1, 2)]);
      if (level === 3 && r.chance(0.6)) {
        const s2 = r.int(0, 30) * 60;
        commitments.push([s2, s2 + r.int(5, 40) * 60, f, r.pick([1, 2, 4])]);
      }
    }
    if (level === 3) commitments.push([0, 3600, "unused-x", 4]);
  }
  return { usages, commitments };
}

export function generate(r, level) {
  const fams = level === 1 ? [r.pick(FAMILIES)] : r.sample(FAMILIES, 3);
  const f = fams[0], g = fams[1] || "compute-c";
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const { usages, commitments } = smallCase(r, level, fams, 4 + 2 * i);
    samples.push({ args: pyArgs(usages, commitments), expect: pyDict(oracle(usages, commitments)) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const t0 = r.int(1, 50) * 100;
  const L = r.pick([600, 900, 3600]);
  const edges = [
    ["a usage inside its commitment costs nothing", [[t0, t0 + L, f, 1]], [[0, t0 + 2 * L, f, 1]]],
    ["a usage that ends exactly when the commitment starts is all on demand", [[t0, t0 + L, f, 1]], [[t0 + L, t0 + 3 * L, f, 1]]],
    ["back-to-back usages do not overlap (half-open intervals)", [[t0, t0 + L, f, 1], [t0 + L, t0 + 2 * L, f, 1]], [[0, t0 + 5 * L, f, 1]]],
    ["only the overlap above the commitment is on demand", [[t0, t0 + L, f, 1], [t0 + L / 2, t0 + L + L / 2, f, 1]], [[0, t0 + 5 * L, f, 1]]],
    ["unused commitment is not carried forward to a later peak", [[t0, t0 + L, f, 1], ...[...Array(5)].map(() => [t0 + 2 * L, t0 + 3 * L, f, 1])], [[0, t0 + 5 * L, f, 3]]],
    ["a family with usage but no commitment pays for all of it", [[t0, t0 + L, f, 1], [t0 + L / 2, t0 + 2 * L, f, 1]], []],
    ["a zero-length usage still lists its family, with 0", [[t0, t0, f, 1]], []],
  ];
  if (level >= 2) {
    edges.push(["a commitment covers its own family only", [[t0, t0 + L, f, 1], [t0, t0 + L, g, 1]], [[0, t0 + 2 * L, f, 1]]]);
    edges.push(["usage running before, during and after a commitment", [[t0, t0 + 4 * L, f, 1], [t0 + L, t0 + 4 * L, f, 1]], [[t0 + L, t0 + 2 * L, f, 1]]]);
  }
  if (level === 3) {
    edges.push(["overlapping commitments add up", [[t0, t0 + 3 * L, f, 6]], [[t0, t0 + 2 * L, f, 4], [t0 + L, t0 + 3 * L, f, 2]]]);
    edges.push(["units weigh both sides", [[t0, t0 + L, f, 8], [t0, t0 + L, f, 2]], [[t0, t0 + L, f, 4]]]);
    edges.push(["a commitment for a family nobody used is not in the result", [[t0, t0 + L, f, 1]], [[t0, t0 + L, g, 4]]]);
  }
  for (const [name, us, cs] of edges) tests.push({ name, args: pyArgs(us, cs), expect: pyDict(oracle(us, cs)) });

  // Timing: four years of per-second usage. A per-second simulation walks ~126 million seconds
  // per family and a per-segment rescan is quadratic; a sorted sweep is O(n log n).
  const seed = r.int(1, 1_000_000);
  const n = level === 1 ? 150000 : 200000;
  const horizon = 4 * 365 * 86400;
  const maxLen = 3 * 86400;
  const tf = level === 1 ? [f] : fams;
  const unitsPy = level === 3 ? "(1, 2, 4, 8)" : "(1,)";
  const commits = [];
  if (level === 1) commits.push([0, horizon + maxLen, f, r.int(150, 220)]);
  else {
    for (const fam of tf) {
      for (let q = 0; q < 8; q++) {
        const s = q * 182 * 86400 + r.int(0, 30) * 86400;
        commits.push([s, s + r.int(60, 150) * 86400, fam, level === 3 ? r.pick([80, 160, 200]) : r.int(40, 70)]);
        if (level === 3) commits.push([s + 86400 * r.int(5, 30), s + 86400 * r.int(31, 90), fam, r.pick([40, 80])]);
      }
    }
  }
  const famsPy = "[" + tf.map((x) => `'${x}'`).join(", ") + "]";
  tests.push({ name: `${n.toLocaleString("en-US")} instances over four years in time (O(n log n) sweep)`, args: `(_gen_usage(${n}, ${famsPy}, ${seed}, ${horizon}, ${maxLen}, ${unitsPy}), ${pyTuples(commits)})`, limit_s: 8 });

  return {
    vars: {
      family_rule:
        level === 1
          ? "In the samples there is one family, every instance counts as 1 unit, and one commitment covers the whole period."
          : "There are several families. A commitment covers usage of its own family only, during its own interval; a family with no commitment at some moment pays on demand for everything running then.",
      unit_rule:
        level === 3
          ? "Instances have different sizes: `units` is the instance's normalised size (a larger instance counts as more units). Commitments of the same family that overlap in time add up."
          : "Every instance counts as `units = 1`, and commitments of one family do not overlap.",
    },
    samples,
    tests,
  };
}
