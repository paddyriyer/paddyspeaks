/* OAI-L2-01 — Cost-optimal micro-batching for an inference server (Python, DP).
   Simulated practice scenario. All data is generated from the seed.

   The candidate writes min_batch_cost(). The oracle below is a brute force over every
   set partition of a small input; it never sorts and never assumes batches are
   contiguous, so it checks the contiguity argument the reference relies on. */
export const kind = "python";
export const entry = "min_batch_cost";
export const signature = "def min_batch_cost(lengths: list[int], max_batch: int, overhead: int, token_budget: int | None = None, shapes: list[int] | None = None) -> int:";
export const starter = `def min_batch_cost(lengths, max_batch, overhead, token_budget=None, shapes=None):
    """lengths: sequence length (tokens) of each queued request, in arrival order.
    Return the minimum total cost of running every request in some batch."""
    ...
`;

export const prelude = `
def _gen_lengths(n, seed, lo=16, hi=4096):
    x, out = seed, []
    for _ in range(n):
        x = (1103515245 * x + 12345) % 2147483648
        out.append(lo + (x >> 16) % (hi - lo + 1))
    return out
`.trim() + "\n";

/* Padded size of a batch of k requests, or null when the batch is not allowed. */
function padded(k, maxBatch, shapes) {
  if (k > maxBatch) return null;
  if (!shapes) return k;
  let best = null;
  for (const s of shapes) if (s >= k && (best === null || s < best)) best = s;
  return best;
}

// Brute force: every set partition (restricted growth strings). Small n only.
export function oracle(lengths, maxBatch, overhead, budget, shapes) {
  const n = lengths.length;
  if (n === 0) return 0;
  const block = new Array(n).fill(0);
  let best = Infinity;
  const rec = (i, used) => {
    if (i === n) {
      let cost = 0;
      for (let b = 0; b < used; b++) {
        let k = 0, mx = 0;
        for (let j = 0; j < n; j++) if (block[j] === b) { k++; if (lengths[j] > mx) mx = lengths[j]; }
        const p = padded(k, maxBatch, shapes);
        if (p === null) return;
        if (budget != null && mx * p > budget) return;
        cost += mx * p + overhead;
      }
      if (cost < best) best = cost;
      return;
    }
    for (let b = 0; b <= used; b++) {
      block[i] = b;
      rec(i + 1, b === used ? used + 1 : used);
    }
  };
  rec(0, 0);
  if (!Number.isFinite(best)) throw new Error("OAI-L2-01 generator produced an infeasible instance");
  return best;
}

const pyList = (xs) => "[" + xs.join(", ") + "]";
function pyArgs(c) {
  return `(${pyList(c.lengths)}, ${c.maxBatch}, ${c.overhead}, ${c.budget == null ? "None" : c.budget}, ${c.shapes ? pyList(c.shapes) : "None"})`;
}
const run = (c) => oracle(c.lengths, c.maxBatch, c.overhead, c.budget, c.shapes);

const SHAPE_SETS = [[1, 2, 4, 8], [1, 2, 3, 4, 6, 8], [1, 4, 8], [1, 2, 4, 6, 8]];

function smallCase(r, level, n) {
  const lengths = [];
  for (let i = 0; i < n; i++) {
    // Level 1: spread-out lengths; higher levels: clusters and repeats.
    if (level === 1) lengths.push(r.int(8, 512));
    else lengths.push(r.chance(0.35) && lengths.length ? r.pick(lengths) : r.pick([r.int(8, 64), r.int(100, 300), r.int(400, 1024)]));
  }
  const c = { lengths, maxBatch: r.int(2, 4), overhead: r.chance(0.5) ? r.int(20, 120) : r.int(200, 900), budget: null, shapes: null };
  if (level >= 2) {
    const mx = Math.max(...lengths);
    c.budget = mx * r.pick([1, 2, 2, 3]) + r.pick([0, 0, r.int(1, 200)]);
  }
  if (level === 3) {
    c.shapes = r.pick(SHAPE_SETS);
    c.maxBatch = Math.max(...c.shapes);
  }
  return c;
}

export function generate(r, level) {
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const c = smallCase(r, level, 5 + i + (level === 3 ? 1 : 0));
    samples.push({ args: pyArgs(c), expect: String(run(c)) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  // Edge cases with exact boundaries.
  const L = r.pick([128, 256, 512]);
  const C = r.int(50, 400);
  const edges = [
    ["no queued requests costs nothing", { lengths: [], maxBatch: 4, overhead: C, budget: null, shapes: null }],
    ["one request runs alone", { lengths: [L], maxBatch: 4, overhead: C, budget: null, shapes: null }],
    ["exactly max_batch equal requests fit in one batch", { lengths: [L, L, L], maxBatch: 3, overhead: C, budget: null, shapes: null }],
    ["max_batch + 1 equal requests need two batches", { lengths: [L, L, L, L], maxBatch: 3, overhead: C, budget: null, shapes: null }],
    ["with no launch overhead every request runs alone", { lengths: [L, 3, L + 7, 40, 9], maxBatch: 4, overhead: 0, budget: null, shapes: null }],
    ["arrival order is not batch order: one long request among short ones", { lengths: [20, L * 4, 22, 21, 24, 19], maxBatch: 4, overhead: C, budget: null, shapes: null }],
  ];
  if (level >= 2) {
    edges.push(["a batch exactly at the token budget is allowed", { lengths: [L, L, L], maxBatch: 4, overhead: 10 * L, budget: 3 * L, shapes: null }]);
    edges.push(["one token over the budget forces a split", { lengths: [L, L, L + 1], maxBatch: 4, overhead: 10 * L, budget: 3 * L, shapes: null }]);
  }
  if (level === 3) {
    edges.push(["three requests pad to a batch of four", { lengths: [L, L, L], maxBatch: 4, overhead: C, budget: null, shapes: [1, 2, 4] }]);
    edges.push(["padding counts against the budget", { lengths: [L, L, L], maxBatch: 8, overhead: 10 * L, budget: 3 * L, shapes: [1, 2, 4, 8] }]);
  }
  for (const [name, c] of edges) tests.push({ name, args: pyArgs(c), expect: String(run(c)) });

  // Timing: the O(n·B) DP passes easily; enumerating partitions or subsets does not, and a
  // top-down recursion over 6 000+ states hits Python's recursion limit. Compared with the
  // reference at check time.
  const seed = r.int(1, 1_000_000);
  const n = level === 1 ? 6000 : 8000;
  const B = level === 1 ? 64 : 96;
  const big = level === 1 ? `(_gen_lengths(${n}, ${seed}), ${B}, ${r.int(500, 5000)}, None, None)`
    : level === 2 ? `(_gen_lengths(${n}, ${seed}), ${B}, ${r.int(500, 5000)}, ${r.pick([65536, 131072])}, None)`
      : `(_gen_lengths(${n}, ${seed}), 128, ${r.int(500, 5000)}, ${r.pick([131072, 262144])}, [1, 2, 4, 8, 16, 24, 32, 48, 64, 96, 128])`;
  tests.push({ name: `${n.toLocaleString("en-US")} requests, batches up to ${level === 3 ? 128 : B}, in time (O(n·B))`, args: big, limit_s: 8 });

  return {
    vars: {
      budget_rule: level === 1
        ? "There is no memory limit (`token_budget` is None)."
        : "The KV-cache memory limit caps padded tokens: a batch is allowed only if `max length × padded batch size ≤ token_budget`.",
      shape_rule: level === 3
        ? "The engine only launches pre-compiled batch sizes listed in `shapes` (always including 1). A batch of k requests is padded to the smallest size in `shapes` that is ≥ k and costs `max length × padded size + overhead`; `max_batch` equals the largest shape."
        : "Any batch size from 1 to `max_batch` can be launched (`shapes` is None), so the padded size is the number of requests.",
    },
    samples,
    tests,
  };
}
