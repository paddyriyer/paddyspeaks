/* GDM-L2-01 — Residue contacts in a predicted structure (Python, cell lists).
   Simulated practice scenario. All data is generated from the seed; every structure,
   coordinate, confidence value and cutoff is synthetic.

   Contract (python): entry, signature, starter, prelude, generate(r, level) ->
     { vars, samples: [{args, expect}], tests: [{name, args, expect?, limit_s?}] }.
   expect comes from oracle() below, which compares every pair of residues (small
   inputs only). The evaluator's reference buckets residues into cutoff-sized cubes,
   so each checks the other.
   level: 1 Medium (residues numbered 1..n in order, every residue counted)
          2 Hard (+ a per-residue confidence floor: residues below it are left out)
          3 Very Hard (+ residue numbers with gaps, listed in no particular order) */
export const kind = "python";
export const entry = "residue_contacts";
export const signature = "def residue_contacts(residues: list[tuple[int, int, int, int, int]], cutoff: int, min_conf: int = 0) -> list[tuple[int, int]]:";
export const starter = `def residue_contacts(residues, cutoff, min_conf=0):
    """residues: (residue_number, x, y, z, confidence) per residue, coordinates of the
    residue's representative atom in thousandths of an angstrom (integers).
    cutoff: the contact distance, in the same units.
    min_conf: residues whose confidence is below this are left out.
    Return every contact (a, b) with a < b, sorted: both residues counted, their
    representative atoms at most cutoff apart, and b - a >= 3."""
    ...
`;

export const prelude = `
def _gen_globule(n, side, cutoff, seed, min_conf=0, gaps=False):
    x = seed

    def nxt():
        nonlocal x
        x = (1103515245 * x + 12345) % 2147483648
        return x >> 8
    half = side // 2
    res = []
    num = 1
    for _ in range(n):
        res.append((num, nxt() % side - half, nxt() % side - half, nxt() % side - half, 30 + nxt() % 71))
        num += 1 + ((nxt() >> 10) % 4 if gaps and (nxt() >> 10) % 10 == 0 else 0)
    if gaps:
        for i in range(n - 1, 0, -1):
            j = nxt() % (i + 1)
            res[i], res[j] = res[j], res[i]
    return res, cutoff, min_conf
`.trim() + "\n";

// Every pair, exact integer arithmetic. Small inputs only.
export function oracle(residues, cutoff, minConf) {
  const pts = residues.filter((p) => p[4] >= minConf);
  const c2 = cutoff * cutoff;
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    for (let j = 0; j < pts.length; j++) {
      const a = pts[i], b = pts[j];
      if (b[0] - a[0] < 3) continue;                     // a before b, at least 3 apart
      const dx = a[1] - b[1], dy = a[2] - b[2], dz = a[3] - b[3];
      if (dx * dx + dy * dy + dz * dz <= c2) out.push([a[0], b[0]]);
    }
  }
  out.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
  return out;
}

const pyRes = (rs) => "[" + rs.map((p) => `(${p.join(", ")})`).join(", ") + "]";
const pyArgs = (c) => `(${pyRes(c.residues)}, ${c.cutoff}, ${c.minConf})`;
const pyOut = (ps) => "[" + ps.map(([a, b]) => `(${a}, ${b})`).join(", ") + "]";
const run = (c) => oracle(c.residues, c.cutoff, c.minConf);

// A short chain folded back on itself: steps of a few angstroms in random directions.
function randomCase(r, level) {
  for (let attempt = 0; attempt < 200; attempt++) {
    const cutoff = r.pick([6000, 7000, 8000, 10000]);
    const n = r.int(14, 22);
    const residues = [];
    let x = r.int(-5000, 5000), y = r.int(-5000, 5000), z = r.int(-5000, 5000);
    let num = level === 3 ? r.int(1, 400) : 1;
    for (let i = 0; i < n; i++) {
      const conf = level >= 2 && r.chance(0.3) ? r.int(25, 69) : r.int(70, 98);
      residues.push([num, x, y, z, conf]);
      x += r.int(-3600, 3600); y += r.int(-3600, 3600); z += r.int(-3600, 3600);
      num += level === 3 && r.chance(0.2) ? r.int(2, 5) : 1;
    }
    const minConf = level >= 2 ? r.pick([50, 60, 70]) : 0;
    const c = { residues: level === 3 ? r.shuffle(residues) : residues, cutoff, minConf };
    const got = run(c);
    // Want contacts and also pairs far enough apart in sequence that are not contacts.
    const kept = residues.filter((p) => p[4] >= minConf);
    let farPairs = 0;
    for (const a of kept) for (const b of kept) if (b[0] - a[0] >= 3) farPairs++;
    if (got.length >= 2 && farPairs > got.length + 3) return c;
  }
  throw new Error("GDM-L2-01: could not build a sample with contacts and non-contacts");
}

export function generate(r, level) {
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const c = randomCase(r, level);
    samples.push({ args: pyArgs(c), expect: pyOut(run(c)) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const C = 1000 * r.pick([5, 6, 8, 10]);                  // a multiple of 5 000 for the 3-4-5 cases
  const base = level === 3 ? r.int(2, 300) : 1;
  const K = (k, x, y, z, conf = 90) => [base + k, x, y, z, conf];
  const far = 20 * C;
  const edges = [
    ["a pair exactly at the cutoff is a contact (a 3-4-5 triangle)",
      { residues: [K(0, 0, 0, 0), K(1, far, 0, 0), K(2, far, far, 0), K(3, 3 * C / 5, 4 * C / 5, 0)], cutoff: C, minConf: 0 }],
    ["one thousandth of an angstrom beyond the cutoff is not a contact",
      { residues: [K(0, 0, 0, 0), K(1, far, 0, 0), K(2, far, far, 0), K(3, C + 1, 0, 0), K(4, 0, -C, 0), K(5, far, -far, far), K(6, 3 * C / 5, 4 * C / 5, 1)], cutoff: C, minConf: 0 }],
    ["neighbours 1 and 2 apart in the sequence never count; 3 apart does",
      { residues: [K(0, 0, 0, 0), K(1, 1000, 0, 0), K(2, 1000, 1000, 0), K(3, 0, 1000, 0), K(4, 500, 500, 500)], cutoff: C, minConf: 0 }],
    ["negative coordinates, and a contact across zero",
      { residues: [K(0, -C / 2, -1, -1), K(1, -far, -far, -far), K(2, -far, 0, -far), K(3, C / 2 - 1, 0, 0), K(4, -C / 2, -C, -1), K(5, -far, far, -far), K(6, -C / 2 - 1, -C - 1, 0)], cutoff: C, minConf: 0 }],
    ["a contact across a cube corner, diagonal in all three axes",
      { residues: [K(0, -1, -1, -1), K(1, far, 0, 0), K(2, far, far, 0), K(3, C / 2, C / 2, C / 2), K(4, -C / 2 - 1, -C / 2 - 1, -C / 2 - 1)], cutoff: C, minConf: 0 }],
    ["an extended strand has no contacts",
      { residues: Array.from({ length: 8 }, (_, i) => K(i, 3800 * i, 0, 0)), cutoff: Math.min(C, 11000), minConf: 0 }],
  ];
  if (level >= 2) {
    edges.push(["a residue exactly at the confidence floor counts; one point below does not",
      { residues: [K(0, 0, 0, 0, 70), K(1, far, 0, 0), K(2, far, far, 0), K(3, 1000, 0, 0, 70), K(4, 0, 1000, 0, 69), K(5, 0, 0, 1000, 95)], cutoff: C, minConf: 70 }]);
    edges.push(["a low-confidence residue removes every contact it was part of",
      { residues: [K(0, 0, 0, 0, 40), K(1, far, 0, 0), K(2, far, far, 0), K(3, 1000, 0, 0), K(4, 0, 1000, 0), K(5, 0, 0, 1000), K(6, 1000, 1000, 0)], cutoff: C, minConf: 50 }]);
  }
  if (level === 3) {
    edges.push(["separation is by residue number, not by position in the list",
      { residues: [K(10, 0, 0, 0), K(13, 1000, 0, 0), K(11, 0, 1000, 0), K(30, 1000, 1000, 0), K(12, far, far, far), K(14, 0, 0, 1000)], cutoff: C, minConf: 0 }]);
    edges.push(["a gap in the numbering makes list neighbours contacts",
      { residues: [K(0, 0, 0, 0), K(1, 1500, 0, 0), K(5, 3000, 0, 0), K(6, 4500, 0, 0), K(40, 4500, 1500, 0)], cutoff: C, minConf: 0 }]);
  }
  for (const [name, c] of edges) tests.push({ name, args: pyArgs(c), expect: pyOut(run(c)) });

  // Timing: compared with the reference at check time. A compact synthetic globule of
  // 50 000 residues (far more than one chain) about 37 cutoffs across: every x-slab of
  // width cutoff still holds about 1 300 residues, while each cutoff-sized cube holds about one.
  const seed = r.int(1, 1_000_000);
  tests.push({
    name: "a compact synthetic globule of 50,000 residues in time",
    args: `_gen_globule(50000, 296000, 8000, ${seed}, ${level >= 2 ? 35 : 0}, ${level === 3 ? "True" : "False"})`,
    limit_s: 8,
  });

  const organism = r.pick(["a hypothetical plant protein", "a hypothetical bacterial enzyme", "a hypothetical yeast protein", "a hypothetical membrane protein", "a hypothetical archaeal protein"]);
  return {
    vars: {
      structure: organism,
      level_rule: level === 1
        ? "In this exercise residues are numbered 1 to n in list order, and every residue counts: the min_conf argument is 0."
        : level === 2
          ? "Residues are numbered 1 to n in list order, but residues whose confidence is below the min_conf argument are left out entirely (this exercise's rule; check current docs on how confidence is used)."
          : "Residues below the min_conf argument are left out, and the structure is a fragment: residue numbers can start anywhere, have gaps where residues were not modelled, and the list is in no particular order.",
    },
    samples,
    tests,
  };
}
