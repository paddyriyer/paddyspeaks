/* APL-L2-01 — Near-duplicate photos by perceptual hash (Python, bit tricks + union-find).
   Simulated practice scenario. All data is generated from the seed.

   Contract (python): entry, signature, starter, prelude, generate(r, level) ->
     { vars, samples: [{args, expect}], tests: [{name, args, expect?, limit_s?}] }.
   expect comes from oracle() below: every pair of photos is compared with BigInt
   XOR and a bit count, and groups are merged with a plain label-propagation pass.
   The evaluator's reference uses the pigeonhole multi-index (max_bits + 1 blocks)
   with union-find, so each checks the other.
   level: 1 Medium (every photo has a hash) · 2 Hard (+ hashes not computed yet,
          photos listed twice) · 3 Very Hard (+ the keeper of each group first) */
export const kind = "python";
export const entry = "group_near_duplicates";
export const signature = "def group_near_duplicates(photos: list[tuple[str, int | None, int]], max_bits: int, keep_best: bool = False) -> list[list[str]]:";
export const starter = `def group_near_duplicates(photos, max_bits, keep_best=False):
    """photos: (photo_id, phash, score) with a 64-bit perceptual hash.
    Two photos are near duplicates when their hashes differ in at most max_bits bits.
    Return the groups of near duplicates (two or more photos each)."""
    ...
`;

export const prelude = `
def _gen_photo_hashes(n, max_bits, seed):
    x = seed
    def draw():
        nonlocal x
        x = (6364136223846793005 * x + 1442695040888963407) % 18446744073709551616
        return x >> 32
    out, i = [], 0
    while len(out) < n:
        base = (draw() << 32) | draw()
        size = 1 + draw() % 4
        for _ in range(size):
            h = base
            for _ in range(draw() % (max_bits + 2)):
                h ^= 1 << (draw() % 64)
            out.append(('P%06d' % i, h, draw() % 1000))
            i += 1
    return out[:n]
`.trim() + "\n";

const MASK64 = (1n << 64n) - 1n;
function popcount(v) {
  let c = 0;
  while (v) { v &= v - 1n; c++; }
  return c;
}

// The specification, brute force over all pairs. Small inputs only.
export function oracle(photos, maxBits, keepBest) {
  const byId = new Map();
  for (const [id, h, score] of photos) if (h !== null) byId.set(id, { h, score });
  const ids = [...byId.keys()].sort();
  const label = ids.map((_, i) => i);
  let changed = true;
  while (changed) {                         // propagate the smallest label along every edge
    changed = false;
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
      if (popcount(byId.get(ids[i]).h ^ byId.get(ids[j]).h) > maxBits) continue;
      const m = Math.min(label[i], label[j]);
      if (label[i] !== m || label[j] !== m) { label[i] = label[j] = m; changed = true; }
    }
  }
  const groups = new Map();
  ids.forEach((id, i) => { if (!groups.has(label[i])) groups.set(label[i], []); groups.get(label[i]).push(id); });
  const out = [...groups.values()].filter((g) => g.length >= 2);   // members already sorted by id
  out.sort((a, b) => (a[0] < b[0] ? -1 : 1));
  if (!keepBest) return out;
  return out.map((g) => {
    let best = g[0];
    for (const id of g) if (byId.get(id).score > byId.get(best).score) best = id;   // ties keep the smaller id
    return [best, ...g.filter((id) => id !== best)];
  });
}

const hex = (h) => "0x" + h.toString(16).padStart(16, "0");
const pyStr = (s) => "'" + s + "'";
const pyPhotos = (ps) => "[" + ps.map(([id, h, s]) => `(${pyStr(id)}, ${h === null ? "None" : hex(h)}, ${s})`).join(", ") + "]";
const pyArgs = (c) => `(${pyPhotos(c.photos)}, ${c.d}, ${c.keep ? "True" : "False"})`;
const pyOut = (gs) => "[" + gs.map((g) => "[" + g.map(pyStr).join(", ") + "]").join(", ") + "]";
const run = (c) => oracle(c.photos, c.d, c.keep);

function hash64(r) {
  let h = 0n;
  for (let i = 0; i < 4; i++) h = (h << 16n) | BigInt(r.int(0, 65535));
  return h & MASK64;
}
function flip(r, h, k, avoid = []) {             // flip exactly k distinct bits not in avoid
  const bits = r.sample(Array.from({ length: 64 }, (_, i) => i).filter((b) => !avoid.includes(b)), k);
  let v = h;
  for (const b of bits) v ^= 1n << BigInt(b);
  return { v, bits };
}

const PREFIX = ["IMG_", "DSC_", "PXL_", "Photo_"];

function randomCase(r, level, d, prefix) {
  for (let attempt = 0; attempt < 50; attempt++) {
    let num = r.int(1000, 8000);
    const id = () => prefix + String((num += r.int(1, 40))).padStart(4, "0");
    const photos = [];
    const clusters = r.int(3, 5);
    for (let c = 0; c < clusters; c++) {
      const base = hash64(r);
      const size = r.int(1, 4);
      let prev = base;
      for (let k = 0; k < size; k++) {
        const near = r.chance(0.5) ? prev : base;                      // sometimes a chain
        prev = flip(r, near, r.int(0, d + (r.chance(0.3) ? 2 : 0))).v;
        photos.push([id(), prev, r.int(10, 99)]);
      }
    }
    if (level >= 2) {
      photos.push([id(), null, r.int(10, 99)]);
      const again = r.pick(photos.filter((p) => p[1] !== null));
      photos.push(again.slice());
    }
    const shuffled = r.shuffle(photos);
    const c = { photos: shuffled, d, keep: level === 3 };
    if (run(c).length >= 1) return c;
  }
  throw new Error("APL-L2-01: could not build a sample with a group");
}

export function generate(r, level) {
  const prefix = r.pick(PREFIX);
  const d = level === 1 ? r.int(2, 3) : r.int(3, 5);
  const samples = [];
  for (let i = 0; i < 2; i++) {
    const c = randomCase(r, level, d, prefix);
    samples.push({ args: pyArgs(c), expect: pyOut(run(c)) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const keep = level === 3;
  let num = r.int(100, 900);
  const id = () => prefix + String((num += r.int(1, 9))).padStart(4, "0");
  const P = (h, score = r.int(10, 99)) => [id(), h, score];
  const A = hash64(r);
  const fA = flip(r, A, d);
  const fB = flip(r, fA.v, d, fA.bits);                                // disjoint bits: A to C is 2d apart
  const top = (A ^ (1n << 63n)) ^ 1n;                                  // the highest and the lowest bit
  const edges = [
    ["hashes that differ in exactly max_bits bits are near duplicates", { photos: [P(A), P(fA.v)], d }],
    ["hashes that differ in max_bits + 1 bits are not", { photos: [P(A), P(flip(r, A, d + 1).v)], d }],
    ["near duplicates chain: A ~ B and B ~ C make one group although A and C are far apart",
      { photos: r.shuffle([P(A), P(fA.v), P(fB.v)]), d }],
    ["a photo with no near duplicate is in no group", { photos: [P(A), P(hash64(r) ^ (A ^ MASK64))], d }],
    ["an empty library", { photos: [], d }],
    ["max_bits = 0 groups identical hashes only", { photos: [P(A), P(A), P(flip(r, A, 1).v)], d: 0 }],
    ["differences in the highest and the lowest bit count", { photos: [P(A), P(top)], d: 2 }],
    ["groups are ordered by their smallest photo id", {
      photos: (() => { const B = hash64(r) ^ (A ^ MASK64); const g1 = [P(B), P(flip(r, B, 1).v)]; const g2 = [P(A), P(flip(r, A, 1).v)]; return [g1[1], g2[0], g1[0], g2[1]]; })(),
      d,
    }],
  ];
  if (level >= 2) {
    edges.push(["a photo whose hash is not computed yet is in no group", { photos: [P(A), P(null), P(fA.v)], d }]);
    const twice = P(A);
    edges.push(["a photo listed twice is one photo", { photos: [twice, P(flip(r, A, 1).v), twice.slice()], d }]);
    const alone = P(A);
    edges.push(["a photo listed twice with no other near duplicate is in no group", { photos: [alone, alone.slice(), P(hash64(r) ^ (A ^ MASK64))], d }]);
  }
  if (level === 3) {
    edges.push(["the keeper is the highest score, listed first", { photos: [P(A, 40), P(fA.v, 95), P(fB.v, 60)], d }]);
    edges.push(["equal top scores keep the smaller photo id", { photos: [P(fA.v, 70), P(A, 70)].reverse(), d }]);
    const B = hash64(r) ^ (A ^ MASK64);
    edges.push(["groups are ordered by their smallest id, not by their keeper", { photos: (() => { const b = P(B, 10), a = P(A, 10), a2 = P(flip(r, A, 1).v, 50), b2 = P(flip(r, B, 1).v, 99); return [a2, b, b2, a]; })(), d }]);
  }
  for (const [name, c] of edges) {
    c.keep = keep;
    tests.push({ name, args: pyArgs(c), expect: pyOut(run(c)) });
  }

  // Timing: compared with the reference at check time. All pairs is 8 * 10^8 comparisons.
  const n = 40000, td = level === 1 ? 3 : 4;
  tests.push({
    name: `${n.toLocaleString("en-US")} photos within ${td} bits in time`,
    args: `(_gen_photo_hashes(${n}, ${td}, ${r.int(1, 1_000_000)}), ${td}, ${keep ? "True" : "False"})`,
    limit_s: 8,
  });

  return {
    vars: {
      max_bits: String(d),
      input_rule: level === 1
        ? "In this exercise every photo has a hash, and each photo id appears once."
        : "`phash` is None for a photo whose hash has not been computed yet: it is in no group. A photo id can appear more than once (the same photo reported by two devices, with the same hash and score); it is one photo.",
      keep_rule: level === 3
        ? "With `keep_best=True`, list each group's keeper first: the photo with the highest `score`, the smaller photo id on a tie. The rest of the group follows in photo id order. Groups are still ordered by the smallest photo id they contain."
        : "`keep_best` is False: list each group's photo ids in ascending order.",
    },
    samples,
    tests,
  };
}
