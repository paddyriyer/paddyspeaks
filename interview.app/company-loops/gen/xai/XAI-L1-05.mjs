/* XAI-L1-05 — Merging index segments of real-time posts at the least bytes rewritten (Python).
   Simulated practice scenario. All data is generated from the seed; segment sizes, ids and
   the merge rules are this exercise's, not any product's.

   Contract (python): entry, signature, starter, prelude, generate(r, level) ->
     { vars, samples: [{args, expect}], tests: [{name, args, expect?, limit_s?}] }.
   expect comes from oracle() below: it re-sorts every segment before each merge, and for
   six or fewer segments also tries every possible merge order and checks that the plan's
   total is the least one. The evaluator's reference uses a min-heap, so each checks the other.
   level: 1 Medium (at least two segments, every segment non-empty, merge down to one)
          2 Hard (+ empty and single-segment inputs, zero-byte segments, a merged segment
            equal in size to an original)
          3 Very Hard (+ a target: merge only until at most target segments remain) */
export const kind = "python";
export const entry = "merge_plan";
export const signature = "def merge_plan(segments: list[tuple[int, int]], target: int = 1) -> tuple[int, list[tuple[int, int, int]]]:";
export const starter = `def merge_plan(segments, target=1):
    """segments: (segment_id, bytes) for each small index segment; ids are distinct.
    Merge two segments at a time until at most target segments remain. A merge of
    segments of a and b bytes rewrites a + b bytes and creates a segment of a + b
    bytes whose id is the next one after the largest id so far.
    Return (total bytes rewritten, [(first_id, second_id, new_id), ...]) for the
    plan with the least total, using this exercise's tie rule."""
    ...
`;

export const prelude = `
def _gen_segments(n, seed, target=1, max_bytes=5000000, zero_pct=0):
    x = seed

    def nxt():
        nonlocal x
        x = (1103515245 * x + 12345) % 2147483648
        return x >> 8
    ids, segs = set(), []
    while len(segs) < n:
        sid = 1 + nxt() % (n * 10)
        if sid in ids:
            continue
        ids.add(sid)
        size = 0 if nxt() % 100 < zero_pct else 1000 + nxt() % max_bytes
        segs.append((sid, size))
    return segs, target
`.trim() + "\n";

const key = (s) => [s[1], s[0]];                       // (bytes, id)
const before = (x, y) => x[1] - y[1] || x[0] - y[0];

// Literal rule: re-sort all segments before each merge.
export function oracle(segments, target = 1) {
  let cur = segments.map((s) => s.slice());
  let next = cur.reduce((m, s) => Math.max(m, s[0]), 0);
  let total = 0;
  const merges = [];
  while (cur.length > Math.max(target, 1)) {
    cur.sort(before);
    const [a, b] = cur;
    cur = cur.slice(2);
    next += 1;
    total += a[1] + b[1];
    merges.push([a[0], b[0], next]);
    cur.push([next, a[1] + b[1]]);
  }
  return [total, merges];
}

// Every merge order, for small inputs: the least total.
function bruteBest(sizes, target) {
  if (sizes.length <= Math.max(target, 1)) return 0;
  let best = Infinity;
  for (let i = 0; i < sizes.length; i++) for (let j = i + 1; j < sizes.length; j++) {
    const rest = sizes.filter((_, k) => k !== i && k !== j);
    rest.push(sizes[i] + sizes[j]);
    best = Math.min(best, sizes[i] + sizes[j] + bruteBest(rest, target));
  }
  return best;
}

function solve(segs, target) {
  const out = oracle(segs, target);
  if (segs.length <= 6) {
    const b = bruteBest(segs.map((s) => s[1]), target);
    if (b !== out[0]) throw new Error("XAI-L1-05: greedy total " + out[0] + " is not the least " + b);
  }
  return out;
}

const pySegs = (segs) => "[" + segs.map(([i, b]) => `(${i}, ${b})`).join(", ") + "]";
const pyArgs = (c) => `(${pySegs(c.segs)}, ${c.target})`;
const pyOut = ([total, merges]) => `(${total}, [${merges.map(([a, b, n]) => `(${a}, ${b}, ${n})`).join(", ")}])`;
const run = (c) => solve(c.segs, c.target);

function ids(r, n) {
  const s = new Set();
  while (s.size < n) s.add(r.int(1, 99));
  return r.shuffle([...s]);
}

function randomCase(r, level) {
  const n = r.int(4, 6);
  const id = ids(r, n);
  const segs = id.map((i) => [i, level >= 2 && r.chance(0.12) ? 0 : 10 * r.int(1, 40)]);
  if (r.chance(0.5)) segs[1][1] = segs[0][1];                       // an equal size
  const target = level === 3 ? r.int(1, 3) : 1;
  return { segs, target };
}

export function generate(r, level) {
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const c = randomCase(r, level);
    samples.push({ args: pyArgs(c), expect: pyOut(run(c)) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));
  const u = 10 * r.int(2, 9);
  const id = ids(r, 8);
  const edges = [
    ["two segments: one merge", { segs: [[id[0], u], [id[1], 3 * u]], target: 1 }],
    ["merging the two largest first is not the least total",
      { segs: [[id[0], 10 * u], [id[1], 9 * u], [id[2], u], [id[3], u + 10], [id[4], 2 * u]], target: 1 }],
    ["equal sizes merge in id order",
      { segs: [[id[0], u], [id[1], u], [id[2], u], [id[3], u]], target: 1 }],
    ["a merged segment ties an original of the same size: the original's lower id goes first",
      { segs: [[id[0], u], [id[1], 2 * u], [id[2], 3 * u], [id[3], 5 * u]], target: 1 }],
  ];
  if (level >= 2) {
    edges.push(["no segments: nothing to merge", { segs: [], target: 1 }]);
    edges.push(["a single segment: nothing to merge", { segs: [[id[5], 7 * u]], target: 1 }]);
    edges.push(["zero-byte segments cost nothing to absorb",
      { segs: [[id[0], 0], [id[1], 4 * u], [id[2], 0], [id[3], u]], target: 1 }]);
  }
  if (level === 3) {
    edges.push(["merge only until target segments remain",
      { segs: [[id[0], u], [id[1], 2 * u], [id[2], 4 * u], [id[3], 8 * u], [id[4], 16 * u], [id[5], 3 * u]], target: 3 }]);
    edges.push(["target equal to the number of segments: nothing to merge",
      { segs: [[id[0], u], [id[1], 2 * u], [id[2], 4 * u]], target: 3 }]);
    edges.push(["target larger than the number of segments: nothing to merge",
      { segs: [[id[0], u], [id[1], 2 * u]], target: 5 }]);
  }
  for (const [name, c] of edges) tests.push({ name, args: pyArgs(c), expect: pyOut(run(c)) });

  // Timing: compared with the reference at check time. 80 000 segments.
  const seed = r.int(1, 1_000_000);
  const target = level === 3 ? r.int(2, 20) : 1;
  const zero = level >= 2 ? 2 : 0;
  tests.push({
    name: "80,000 segments in time",
    args: `_gen_segments(80000, ${seed}, ${target}, 5000000, ${zero})`,
    limit_s: 8,
  });

  const shards = r.pick(["a hypothetical shard of the live post index", "one hypothetical partition of the real-time index", "a hypothetical hour-bucket of the post index"]);
  return {
    vars: {
      where: shards,
      level_rule: level === 1
        ? "In this exercise there are always at least two segments, every segment has at least 1 byte, and target is 1."
        : level === 2
          ? "The list can be empty or hold one segment (then nothing is merged), a segment can have 0 bytes (all its posts were deleted), and target is 1."
          : "The list can be empty or hold one segment, a segment can have 0 bytes, and target can be greater than 1: stop as soon as at most target segments remain (no merge at all if there are already that few).",
    },
    samples,
    tests,
  };
}
