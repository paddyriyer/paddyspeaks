/* UBR-L2-01 — Surge smoothing on a hexagonal grid (Python, grids and neighbourhoods).
   Simulated practice scenario. All data is generated from the seed.

   Contract (python): entry, signature, starter, prelude, generate(r, level) ->
     { vars, samples: [{args, expect}], tests: [{name, args, expect?, limit_s?}] }.
   expect comes from oracle() below: for every cell it scans EVERY other cell and
   measures the axial hex distance (quadratic, small inputs only). The evaluator's
   reference enumerates the k-ring offsets instead, so each checks the other.
   All multipliers are integers in hundredths (100 = 1.00x).
   level: 1 Medium (raw ratio, k-ring average, cap) · 2 Hard (+ step limit against
          the previous multipliers) · 3 Very Hard (+ distance weights in the average) */
export const kind = "python";
export const entry = "smooth_surge";
export const signature = "def smooth_surge(cells: dict[tuple[int, int], tuple[int, int]], k: int, cap: int, prev: dict[tuple[int, int], int] | None = None, max_step: int | None = None, weighted: bool = False) -> dict[tuple[int, int], int]:";
export const starter = `def smooth_surge(cells, k, cap, prev=None, max_step=None, weighted=False):
    """cells: {(q, r): (open_requests, available_drivers)} on an axial hex grid.
    Return {(q, r): multiplier in hundredths} for every cell in cells."""
    ...
`;

export const prelude = `
def _gen_cells(width, seed):
    x, out = seed, {}
    for q in range(width):
        for r in range(width):
            x = (1103515245 * x + 12345) % 2147483648
            if (x >> 8) % 10 == 0:
                continue                          # about 10% of cells have no data
            x = (1103515245 * x + 12345) % 2147483648
            demand = (x >> 8) % 40
            x = (1103515245 * x + 12345) % 2147483648
            supply = (x >> 8) % 25
            out[(q - width // 2, r - width // 3)] = (demand, supply)
    return out


def _gen_prev(cells, cap, seed):
    x, out = seed, {}
    for cell in cells:
        x = (1103515245 * x + 12345) % 2147483648
        if (x >> 8) % 4:
            out[cell] = 100 + (x >> 12) % (cap - 99)
    return out
`.trim() + "\n";

const hexDist = (a, b) => {
  const dq = a[0] - b[0], dr = a[1] - b[1];
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
};

function raw(demand, supply, cap) {
  if (demand <= supply) return 100;
  if (supply === 0) return cap;
  return Math.min(cap, Math.floor((100 * demand) / supply));
}

// The specification, implemented independently of the Python reference: every pair of cells.
export function oracle(cells, k, cap, prev, maxStep, weighted) {
  const keys = [...cells.keys()];
  const pos = keys.map((s) => s.split(",").map(Number));
  const rawOf = keys.map((s) => raw(cells.get(s)[0], cells.get(s)[1], cap));
  const out = new Map();
  keys.forEach((s, i) => {
    let S = 0, W = 0;
    pos.forEach((p, j) => {
      const d = hexDist(pos[i], p);
      if (d > k) return;
      const w = weighted ? k + 1 - d : 1;
      S += w * rawOf[j];
      W += w;
    });
    let v = Math.floor((2 * S + W) / (2 * W));               // round half up
    if (prev) {
      const p = prev.has(s) ? prev.get(s) : 100;
      v = Math.min(Math.max(v, p - maxStep), p + maxStep);
    }
    out.set(s, Math.min(Math.max(v, 100), cap));
  });
  return out;
}

const key = (q, r) => q + "," + r;
const sortKeys = (m) => [...m.keys()].sort((a, b) => {
  const [aq, ar] = a.split(",").map(Number), [bq, br] = b.split(",").map(Number);
  return aq - bq || ar - br;
});
const pyDict = (m, val) => "{" + sortKeys(m).map((s) => `(${s.split(",").join(", ")}): ${val(m.get(s))}`).join(", ") + "}";
const pyArgs = (c) =>
  `(${pyDict(c.cells, (v) => `(${v[0]}, ${v[1]})`)}, ${c.k}, ${c.cap}, ${c.prev ? pyDict(c.prev, String) : "None"}, ${c.prev ? c.step : "None"}, ${c.weighted ? "True" : "False"})`;
const run = (c) => oracle(c.cells, c.k, c.cap, c.prev, c.step, c.weighted);
const pyOut = (m) => pyDict(m, String);

function randomCase(r, level, cap, step, bq, br) {
  for (let attempt = 0; attempt < 50; attempt++) {
    const radius = level === 1 ? 2 : 3;
    const cells = new Map();
    for (let q = -radius; q <= radius; q++) for (let s = -radius; s <= radius; s++) {
      if (hexDist([q, s], [0, 0]) > radius || !r.chance(0.75)) continue;
      const supply = r.int(0, 12);
      const demand = r.chance(0.45) ? r.int(0, supply) : supply + r.int(1, 25);
      cells.set(key(bq + q, br + s), [demand, supply]);
    }
    const c = { cells, k: level === 1 ? 1 : r.int(1, 2), cap, step, weighted: level === 3, prev: null };
    if (level >= 2) {
      c.prev = new Map();
      for (const s of cells.keys()) if (r.chance(0.6)) c.prev.set(s, r.int(100, cap));
    }
    const got = run(c);
    if (cells.size >= 6 && [...got.values()].filter((v) => v > 100).length >= 2) return c;
  }
  throw new Error("UBR-L2-01: could not build a sample with surge");
}

export function generate(r, level) {
  const cap = r.pick([250, 300, 350, 400]);
  const step = r.pick([20, 25, 40, 50]);
  const bq = r.int(-40, 40), br = r.int(-40, 40);
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const c = randomCase(r, level, cap, step, bq + 20 * i, br - 10 * i);
    samples.push({ args: pyArgs(c), expect: pyOut(run(c)) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const at = (q, s) => key(bq + q, br + s);
  const mk = (pairs) => new Map(pairs.map(([q, s, d, sup]) => [at(q, s), [d, sup]]));
  const weighted = level === 3;
  const edges = [
    ["a cell with demand equal to supply is 1.00x", { cells: mk([[0, 0, 7, 7]]), k: 1 }],
    ["no drivers and some requests is the cap; no drivers and no requests is 1.00x",
      { cells: mk([[0, 0, 3, 0], [5, 5, 0, 0]]), k: 1 }],
    ["the raw ratio is truncated to the hundredth (7 / 3 is 233)", { cells: mk([[0, 0, 7, 3]]), k: 1 }],
    ["a raw ratio above the cap is capped", { cells: mk([[0, 0, 60, 2]]), k: 1 }],
    ["(+1, -1) is a neighbour on a hex grid, (+1, +1) is not",
      { cells: mk([[0, 0, 4, 4], [1, -1, 30, 10], [1, 1, 30, 10]]), k: 1 }],
    ["a cell exactly k away is averaged in, k + 1 away is not",
      { cells: mk([[0, 0, 2, 2], [2, -2, 9, 3], [2, 1, 9, 3]]), k: 2 }],
    ["an average that ends in exactly half a hundredth rounds up (100.5 is 101)",
      { cells: mk([[0, 0, 101, 100], [0, 1, 5, 5]]), k: 1 }],
    ["cells with no data are left out of the average, not counted as 1.00x",
      { cells: mk([[0, 0, 12, 4], [-1, 0, 12, 4]]), k: 2 }],
  ];
  if (level >= 2) {
    const one = (d, sup) => mk([[0, 0, d, sup]]);
    const P = (v) => new Map([[at(0, 0), v]]);
    edges.push([`a rise is limited to max_step (${step}) above the previous multiplier`, { cells: one(50, 10), k: 1, prev: P(100) }]);
    edges.push([`a fall is limited to max_step (${step}) below the previous multiplier`, { cells: one(1, 5), k: 1, prev: P(220) }]);
    edges.push(["a move of exactly max_step is allowed in full", { cells: one(100 + step, 100), k: 1, prev: P(100) }]);
    edges.push(["a cell with no previous multiplier starts from 1.00x", { cells: one(50, 10), k: 1, prev: new Map() }]);
    edges.push(["a previous multiplier above the cap still ends at or below the cap", { cells: one(60, 2), k: 1, prev: P(cap + step + 30) }]);
  }
  if (level === 3) {
    edges.push(["the centre weighs k + 1, a cell d away weighs k + 1 - d",
      { cells: mk([[0, 0, 30, 10], [1, 0, 10, 10], [0, -2, 20, 10], [2, -1, 40, 10]]), k: 2 }]);
    edges.push(["weights count only the cells that have data",
      { cells: mk([[0, 0, 25, 10], [-1, 1, 10, 10], [-3, 0, 99, 1]]), k: 3 }]);
  }
  for (const [name, c] of edges) {
    c.cap = cap;
    c.weighted = weighted;
    c.step = step;
    if (level === 1 || !c.prev) c.prev = null;
    tests.push({ name, args: pyArgs(c), expect: pyOut(run(c)) });
  }

  // Timing: compared with the reference at check time. Scanning every cell for every
  // cell is quadratic; enumerating the k-ring offsets is not.
  const width = 240, kk = 3, seed = r.int(1, 1_000_000);
  const prevArg = level >= 2 ? `_gen_prev(_gen_cells(${width}, ${seed}), ${cap}, ${seed + 1})` : "None";
  tests.push({
    name: `about ${(Math.round(width * width * 0.9 / 1000) * 1000).toLocaleString("en-US")} cells with k = ${kk} in time`,
    args: `(_gen_cells(${width}, ${seed}), ${kk}, ${cap}, ${prevArg}, ${level >= 2 ? step : "None"}, ${weighted ? "True" : "False"})`,
    limit_s: 8,
  });

  return {
    vars: {
      step_rule: level === 1
        ? "In this exercise `prev` and `max_step` are None: there is no step limit."
        : `\`prev\` maps cells to the multiplier published in the previous interval, and \`max_step\` (${step} in the checks) is the most a multiplier may move in one interval: after smoothing, limit the value to the range \`p - max_step\` to \`p + max_step\`, where \`p\` is the cell's previous multiplier, or 100 if the cell is not in \`prev\`. Apply the 100 and \`cap\` bounds after the step limit. When \`prev\` is None there is no step limit.`,
      weight_rule: level === 3
        ? "`weighted` is True: a cell at hex distance `d` from the centre (the centre itself is at 0) has weight `k + 1 - d`, and the average is the weighted average over cells that have data."
        : "`weighted` is False: every cell in the neighbourhood has weight 1.",
    },
    samples,
    tests,
  };
}
