/* NVD-L1-04 — GPU slice placement: first-fit of aligned 1/2/4-slot slices across many GPUs (Python).
   Simulated practice scenario. All data is generated from the seed. The slot layout (4 or 8
   equal slots per GPU, slices of 1, 2 or 4 slots on aligned boundaries) is this exercise's own
   hypothetical model of GPU partitioning, not the specification of any product.

   Contract (python): entry, signature, starter, prelude, generate(r, level) ->
     { vars, samples: [{args, expect}], tests: [{name, args, expect?, limit_s?}] }.
   expect comes from oracle() below: a literal scan of every GPU from index 0 and every aligned
   offset, for every request. The evaluator's reference keeps a min-heap of candidate GPUs per
   slice size with lazy invalidation, written independently.
   level: 1 Medium (allocations and valid releases)
          · 2 Hard (+ releases of unknown, rejected or already released ids; a full cluster)
          · 3 Very Hard (+ drain / undrain of GPUs: a drained GPU keeps its slices but takes no new ones) */
export const kind = "python";
export const entry = "place_slices";
export const signature = "def place_slices(num_gpus: int, slots: int, ops: list[tuple]) -> list[tuple[int, int] | None]:";
export const starter = `def place_slices(num_gpus, slots, ops):
    """num_gpus GPUs, each with \`slots\` equal slots (4 or 8).
    ops: ('alloc', req_id, size) with size 1, 2 or 4; ('free', req_id);
         ('drain', gpu); ('undrain', gpu).
    Return, for every 'alloc' in order, (gpu, offset) or None if it could not be placed."""
    ...
`;

export const prelude = `
def _gen_ops(num_gpus, n_ops, slots, seed, drains=False):
    x = seed
    def rnd(m):
        nonlocal x
        x = (1103515245 * x + 12345) % 2147483648
        return (x >> 16) % m
    sizes = (1, 1, 1, 2, 2, 4)
    ops, live, nid = [], [], 0
    while len(ops) < n_ops:
        u = rnd(100)
        if len(ops) < num_gpus * slots // 2 or u < 52 or not live:
            nid += 1
            ops.append(('alloc', 'r%d' % nid, sizes[rnd(6)]))
            live.append('r%d' % nid)
        elif drains and u >= 97:
            ops.append(('drain' if u < 99 else 'undrain', rnd(num_gpus)))
        else:
            k = rnd(len(live))
            live[k], live[-1] = live[-1], live[k]
            ops.append(('free', live.pop()))
    return num_gpus, slots, ops
`.trim() + "\n";

// The specification, literally: for each request scan GPUs from 0 and aligned offsets from 0.
export function oracle(numGpus, slots, ops) {
  const used = Array.from({ length: numGpus }, () => new Array(slots).fill(false));
  const drained = new Array(numGpus).fill(false);
  const live = new Map();
  const out = [];
  for (const op of ops) {
    if (op[0] === "alloc") {
      const [, id, k] = op;
      let placed = null;
      for (let g = 0; g < numGpus && !placed; g++) {
        if (drained[g]) continue;
        for (let o = 0; o + k <= slots; o += k) {
          let free = true;
          for (let s = o; s < o + k; s++) if (used[g][s]) free = false;
          if (free) {
            for (let s = o; s < o + k; s++) used[g][s] = true;
            live.set(id, [g, o, k]);
            placed = [g, o];
            break;
          }
        }
      }
      out.push(placed);
    } else if (op[0] === "free") {
      const h = live.get(op[1]);
      if (h) {
        for (let s = h[1]; s < h[1] + h[2]; s++) used[h[0]][s] = false;
        live.delete(op[1]);
      }
    } else if (op[0] === "drain") drained[op[1]] = true;
    else if (op[0] === "undrain") drained[op[1]] = false;
  }
  return out;
}

const pyOps = (ops) => "[" + ops.map((op) => (op[0] === "alloc" ? `('alloc', '${op[1]}', ${op[2]})` : op[0] === "free" ? `('free', '${op[1]}')` : `('${op[0]}', ${op[1]})`)).join(", ") + "]";
const pyArgs = (n, slots, ops) => `(${n}, ${slots}, ${pyOps(ops)})`;
const pyOut = (out) => "[" + out.map((p) => (p ? `(${p[0]}, ${p[1]})` : "None")).join(", ") + "]";

function randomCase(r, level) {
  for (let attempt = 0; attempt < 100; attempt++) {
    const n = r.int(2, level === 1 ? 3 : 4);
    const slots = r.pick([4, 8]);
    const ops = [];
    const live = [];
    const gone = [];
    let nid = r.int(1, 50);
    const len = level === 1 ? r.int(10, 14) : r.int(14, 20);
    while (ops.length < len) {
      const u = r.next();
      if (u < 0.55 || !live.length) {
        const id = "r" + nid++;
        ops.push(["alloc", id, r.pick([1, 1, 2, 2, 4])]);
        live.push(id);
      } else if (level >= 2 && u < 0.65 && gone.length) {
        ops.push(["free", r.chance(0.5) ? r.pick(gone) : "r" + (nid + 100)]);          // stale or unknown id
      } else if (level === 3 && u < 0.78) {
        ops.push([r.chance(0.6) ? "drain" : "undrain", r.int(0, n - 1)]);
      } else {
        const id = live.splice(r.int(0, live.length - 1), 1)[0];
        ops.push(["free", id]);
        gone.push(id);
      }
    }
    const got = oracle(n, slots, ops);
    const placed = got.filter(Boolean).length;
    if (placed > 0 && (level === 1 || got.some((x) => x === null)) && got.some((x) => x && x[0] > 0)) return { n, slots, ops, got };
  }
  throw new Error("NVD-L1-04: could not build a sample");
}

export function generate(r, level) {
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const c = randomCase(r, level);
    samples.push({ args: pyArgs(c.n, c.slots, c.ops), expect: pyOut(c.got) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const A = () => "r" + r.int(100, 999);
  const ids = new Set();
  const fresh = () => { let x; do x = A(); while (ids.has(x)); ids.add(x); return x; };
  const [a, b, c, d, e, f] = [fresh(), fresh(), fresh(), fresh(), fresh(), fresh()];
  const edges = [
    ["slices start on multiples of their size: a 2-slot slice skips an odd free slot",
      1, 8, [["alloc", a, 1], ["alloc", b, 2], ["alloc", c, 1], ["alloc", d, 4]]],
    ["a 4-slot slice needs an aligned block, not any four free slots",
      2, 8, [["alloc", a, 2], ["alloc", b, 4], ["free", a], ["alloc", c, 1], ["alloc", d, 4], ["alloc", e, 4]]],
    ["a release makes the lowest GPU eligible again (first fit, not next fit)",
      3, 4, [["alloc", a, 4], ["alloc", b, 4], ["alloc", c, 2], ["free", a], ["alloc", d, 2], ["alloc", e, 4]]],
    ["a whole-GPU slice on 4-slot GPUs, and nothing left for another",
      1, 4, [["alloc", a, 4], ["alloc", b, 1]]],
    ["the lowest free aligned offset inside a GPU is used",
      1, 8, [["alloc", a, 2], ["alloc", b, 2], ["alloc", c, 2], ["free", b], ["alloc", d, 1], ["alloc", e, 1], ["alloc", f, 2]]],
  ];
  if (level >= 2) {
    edges.push(["a rejected request's id is not live: releasing it frees nothing",
      1, 4, [["alloc", a, 4], ["alloc", b, 2], ["free", b], ["alloc", c, 2]]]);
    edges.push(["releasing an id twice, or an id never seen, changes nothing",
      2, 4, [["alloc", a, 4], ["alloc", b, 4], ["free", a], ["free", a], ["free", "nope"], ["alloc", c, 2], ["alloc", d, 2], ["alloc", e, 2]]]);
    edges.push(["a full cluster rejects every size, then accepts after a release",
      2, 4, [["alloc", a, 4], ["alloc", b, 4], ["alloc", c, 1], ["free", b], ["alloc", d, 1], ["alloc", e, 4]]]);
  }
  if (level === 3) {
    edges.push(["a drained GPU takes no new slices, even with free slots",
      2, 4, [["alloc", a, 1], ["drain", 0], ["alloc", b, 1], ["alloc", c, 2]]]);
    edges.push(["a release on a drained GPU does not make it eligible; undrain does",
      2, 4, [["alloc", a, 4], ["alloc", b, 4], ["drain", 0], ["free", a], ["alloc", c, 2], ["undrain", 0], ["alloc", d, 2]]]);
    edges.push(["drain twice and undrain a GPU that was never drained",
      2, 8, [["drain", 1], ["drain", 1], ["undrain", 0], ["alloc", a, 4], ["alloc", b, 4], ["alloc", c, 4], ["undrain", 1], ["alloc", d, 4]]]);
  }
  for (const [name, n, slots, ops] of edges) tests.push({ name, args: pyArgs(n, slots, ops), expect: pyOut(oracle(n, slots, ops)) });

  // Timing: 3 000 GPUs, 150 000 operations on a nearly full cluster. Holes left by releases sit
  // anywhere, so scanning GPUs from 0 costs O(G) per request; per-size heaps cost O(log G).
  const slotsT = level === 1 ? r.pick([4, 8]) : 8;
  tests.push({
    name: "3,000 GPUs, 150,000 operations on a nearly full cluster (heaps, not scans)",
    args: `_gen_ops(3000, 150000, ${slotsT}, ${r.int(1, 1_000_000)}, ${level === 3 ? "True" : "False"})`,
    limit_s: 8,
  });

  return {
    vars: {
      release_rule: level === 1
        ? "In this trace every `free` names a slice that is currently placed, but your code should ignore any other `free`."
        : "A `free` may name an id that was rejected, was already released or was never seen: ignore it.",
      drain_rule: level === 3
        ? "`('drain', gpu)` stops a GPU from taking new slices; slices already on it stay until released. `('undrain', gpu)` makes it eligible again. Draining a drained GPU or undraining an active one changes nothing."
        : "In this trace there are no `drain` or `undrain` operations, but keep them in mind for the follow-ups.",
    },
    samples,
    tests,
  };
}
