/* PLT-L1-05 — Supplier record matching: pairs of records in the same postcode whose
   normalised names are within one edit (Python).
   Simulated practice scenario: a generic distributor merging supplier lists from several
   source systems. All names, postcodes and ids are generated from the seed and are
   hypothetical.

   Contract (python): entry, signature, starter, prelude, generate(r, level) ->
     { vars, samples: [{args, expect}], tests: [{name, args, expect?, limit_s?}] }.
   expect comes from oracle() below: every pair of records, with the names normalised by
   regular expressions and compared by a full edit-distance table (Levenshtein, or the
   optimal-string-alignment table when transpositions count). The evaluator's reference
   blocks by postcode and uses a linear one-edit check, written independently.
   level: 1 Medium (punctuation, case and trailing legal-form words; one insertion,
                    deletion or substitution; postcodes already in one form)
          2 Hard (+ postcodes in mixed case and spacing, missing postcodes, names that
                  normalise to nothing, stacked legal-form words)
          3 Very Hard (+ transpositions=True: one swap of two adjacent characters is
                       also one edit) */
export const kind = "python";
export const entry = "match_suppliers";
export const signature = "def match_suppliers(records: list[tuple[int, str, str | None]], transpositions: bool = False) -> list[tuple[int, int]]:";
export const starter = `def match_suppliers(records, transpositions=False):
    """records: (record_id, name, postcode or None).
    Return sorted (smaller_id, larger_id) pairs that match."""
    ...
`;

export const prelude = `
def _gen_suppliers(n, n_postcodes, seed, transpositions=False):
    x = seed
    def rnd(m):
        nonlocal x
        x = (1103515245 * x + 12345) % 2147483648
        return (x >> 16) % m
    syl = ['an', 'bel', 'cor', 'dex', 'en', 'fal', 'gar', 'hol', 'ion', 'kel', 'lum', 'mar', 'nor', 'ost', 'per', 'quin', 'ral', 'sten', 'tor', 'vex']
    kinds = ['castings', 'fasteners', 'polymers', 'logistics', 'tooling', 'valves', 'bearings', 'plastics', 'metals', 'controls']
    forms = ['', ' ltd', ' inc.', ', llc', ' gmbh', ' co', ' corp']
    pcs = ['%c%d %d%c%c' % (65 + rnd(26), 1 + rnd(99), rnd(10), 65 + rnd(26), 65 + rnd(26)) for _ in range(n_postcodes)]
    recs, by_pc = [], {}
    for rid in range(1, n + 1):
        pc = pcs[rnd(n_postcodes)]
        seen = by_pc.setdefault(pc, [])
        if seen and rnd(3) == 0:                 # a near-duplicate of a supplier at the same postcode
            base = list(seen[rnd(len(seen))])
            k = rnd(len(base))
            op = rnd(4)
            if op == 0:
                base[k] = 'xyzq'[rnd(4)]
            elif op == 1:
                del base[k]
            elif op == 2:
                base.insert(k, 'aeio'[rnd(4)])
            elif k + 1 < len(base):
                base[k], base[k + 1] = base[k + 1], base[k]
            name = ''.join(base)
        else:
            name = syl[rnd(20)] + syl[rnd(20)] + syl[rnd(20)] + ' ' + kinds[rnd(10)]
        seen.append(name)
        recs.append((rid, name.title() + forms[rnd(7)], pc if rnd(2) else pc.lower().replace(' ', '')))
    return (recs, transpositions)
`.trim() + "\n";

const LEGAL = new Set(["co", "corp", "gmbh", "inc", "limited", "llc", "ltd", "plc"]);
const normName = (s) => {
  const words = s.toLowerCase().replace(/[^a-z0-9]/g, " ").trim().split(/ +/).filter(Boolean);
  while (words.length && LEGAL.has(words[words.length - 1])) words.pop();
  return words.join(" ");
};
const normPc = (s) => (s === null ? "" : s.toUpperCase().replace(/ /g, ""));
// Full dynamic-programming edit distance; with swaps it is the optimal string alignment distance.
function distance(a, b, swaps) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (swaps && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}
export function oracle(records, swaps) {
  const out = [];
  for (let i = 0; i < records.length; i++) {
    for (let j = i + 1; j < records.length; j++) {
      const [ri, ni, pi] = records[i], [rj, nj, pj] = records[j];
      const a = normName(ni), b = normName(nj), p = normPc(pi), q = normPc(pj);
      if (!a || !b || !p || p !== q) continue;
      if (distance(a, b, swaps) <= 1) out.push(ri < rj ? [ri, rj] : [rj, ri]);
    }
  }
  return out.sort((x, y) => x[0] - y[0] || x[1] - y[1]);
}

const py = (s) => (s === null ? "None" : "'" + s.replace(/\\/g, "\\\\").replace(/'/g, "\\'") + "'");
const pyArgs = (recs, swaps) => `([${recs.map(([id, n, p]) => `(${id}, ${py(n)}, ${py(p)})`).join(", ")}], ${swaps ? "True" : "False"})`;
const pyOut = (pairs) => "[" + pairs.map(([a, b]) => `(${a}, ${b})`).join(", ") + "]";

const BASES = ["Apex Fasteners", "Brightline Tooling", "Delta Polymers", "Harbor Valves", "Ironwood Fabrication", "Kestrel Logistics",
  "Northfield Castings", "Summit Bearings", "Tri-State Metals", "Westbrook Controls", "Bluewater Plastics", "Granite Packaging"];
const FORMS = ["", " Ltd", " Ltd.", " Inc.", ", Inc", " LLC", " GmbH", " Co.", " Corp"];
const PCS = ["SW1A 1AA", "M1 2AB", "EC2V 7HH", "LS1 4DY", "10115", "75008", "60601", "B33 8TH", "G2 3EW", "CF10 1EP"];

function mutate(r, s, swaps) {
  const cs = [...s];
  const letters = [...cs.keys()].filter((i) => /[a-z]/i.test(cs[i]));
  const k = r.pick(letters);
  const op = r.int(0, swaps ? 3 : 2);
  if (op === 0) cs[k] = cs[k] === "x" ? "q" : "x";
  else if (op === 1) cs.splice(k, 1);
  else if (op === 2) cs.splice(k, 0, r.pick(["a", "e", "o"]));
  else if (k + 1 < cs.length && cs[k + 1] !== cs[k] && /[a-z]/i.test(cs[k + 1])) [cs[k], cs[k + 1]] = [cs[k + 1], cs[k]];
  return cs.join("");
}
function dress(r, name, level) {
  let s = r.chance(0.3) ? name.toUpperCase() : name;
  if (r.chance(0.2)) s = s.replace(" ", "-");
  s += r.pick(FORMS);
  if (level >= 2 && r.chance(0.15)) s += r.pick([" Co. Ltd", " Corp."]);
  return s;
}
function dressPc(r, pc, level) {
  if (level === 1) return pc;
  return r.pick([pc, pc.toLowerCase(), pc.replace(/ /g, ""), pc.toLowerCase().replace(/ /g, "")]);
}

function randomCase(r, level, swaps) {
  for (let attempt = 0; attempt < 100; attempt++) {
    const pcs = r.sample(PCS, level === 1 ? 2 : 3);
    const bases = r.sample(BASES, level === 1 ? 4 : 5);
    const recs = [];
    let id = r.int(100, 900);
    for (const b of bases) {
      const pc = r.pick(pcs);
      recs.push([id += r.int(1, 9), dress(r, b, level), dressPc(r, pc, level)]);
      const copies = r.int(0, 2);
      for (let k = 0; k < copies; k++) {
        let nm = r.chance(0.7) ? mutate(r, b, swaps) : b;
        if (r.chance(0.25)) nm = mutate(r, nm, swaps);                       // two edits: no match
        const samePc = r.chance(0.8);
        recs.push([id += r.int(1, 9), dress(r, nm, level), dressPc(r, samePc ? pc : r.pick(pcs), level)]);
      }
    }
    if (level >= 2) {
      recs.push([id += r.int(1, 9), r.pick(bases) + r.pick(FORMS), r.pick([null, "", " "])]);
      if (r.chance(0.5)) recs.push([id += r.int(1, 9), r.pick(["Ltd.", "Co. Ltd", "LLC"]), dressPc(r, pcs[0], level)]);
    }
    const shuffled = r.shuffle(recs);
    const got = oracle(shuffled, swaps);
    if (got.length >= 1 && got.length < recs.length) return { recs: shuffled, got };
  }
  throw new Error("PLT-L1-05: could not build a sample");
}

export function generate(r, level) {
  const swaps = level === 3;
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const c = randomCase(r, level, swaps);
    samples.push({ args: pyArgs(c.recs, swaps), expect: pyOut(c.got) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const [P, Q] = r.sample(PCS, 2);
  const [B1, B2] = r.sample(BASES, 2);
  let id = r.int(10, 90);
  const nid = () => (id += r.int(1, 7));
  const rec = (name, pc) => [nid(), name, pc];
  const lower = B1.toLowerCase();
  const sub = (s, k) => s.slice(0, k) + (s[k] === "z" ? "q" : "z") + s.slice(k + 1);
  const k1 = 1 + r.int(0, 3);
  const swap = (x) => {                            // swap the first two adjacent, different letters from index 2
    let k = 2;
    while (!(/[a-z]/i.test(x[k]) && /[a-z]/i.test(x[k + 1]) && x[k] !== x[k + 1])) k++;
    return x.slice(0, k) + x[k + 1] + x[k] + x.slice(k + 2);
  };
  const edges = [
    ["one substitution matches", [rec(B1, P), rec(sub(B1, k1), P)]],
    ["two substitutions do not", [rec(B1, P), rec(sub(sub(B1, k1), k1 + 2), P)]],
    ["one inserted character at the end, and one at the start", [rec(B1, P), rec(B1 + "s", P), rec("A" + B1, Q), rec(B1, Q)]],
    ["the same name at different postcodes never matches", [rec(B1, P), rec(B1, Q)]],
    ["case, punctuation and a trailing legal form are ignored", [rec(B1.toUpperCase() + ", Ltd.", P), rec(lower.replace(" ", "-"), P), rec(B2 + " Inc.", P)]],
    ["a space is a character: one missing space is one edit", [rec(B1, P), rec(B1.replace(" ", ""), P)]],
    ["a legal-form word that is not at the end is kept", [rec("Co " + B1, P), rec(B1, P), rec(B1 + " Co", P)]],
    ["a swap of two adjacent letters" + (swaps ? " is one edit here" : " is two edits here"), [rec(B1, P), rec(swap(B1), P)]],
  ];
  if (level >= 2) {
    edges.push(["postcodes match after upper-casing and removing spaces", [rec(B1, P), rec(B1 + " Ltd", P.toLowerCase().replace(/ /g, "")), rec(B1, P.toLowerCase())]]);
    edges.push(["missing or blank postcodes never match", [rec(B1, null), rec(B1, null), rec(B1, ""), rec(B1, " ")]]);
    edges.push(["names that are only legal forms never match", [rec("Ltd.", P), rec("Co. Ltd", P), rec("LLC", P)]]);
    edges.push(["stacked legal forms are all stripped", [rec(B1 + " Co. Ltd", P), rec(B1 + " Corp", P), rec(B1 + " Limited, Inc.", P)]]);
  }
  if (level === 3) {
    edges.push(["a swap plus a substitution is two edits", [rec(B1, P), rec(sub(swap(B1), B1.length - 2), P)]]);
    { const sp = B1.indexOf(" "); edges.push(["a letter swapped with the space is one edit", [rec(B1, P), rec(B1.slice(0, sp) + B1[sp + 1] + " " + B1.slice(sp + 2), P)]]); }
    edges.push(["two separate swaps are two edits", [rec("Ironwood Fabrication", P), rec("Iornwood Fabricaiton", P)]]);
  }
  for (const [name, recs] of edges) tests.push({ name, args: pyArgs(recs, swaps), expect: pyOut(oracle(recs, swaps)) });

  tests.push({
    name: "40,000 records across 2,000 postcodes (block by postcode; a linear one-edit check)",
    args: `_gen_suppliers(40000, 2000, ${r.int(1, 1_000_000)}, ${swaps ? "True" : "False"})`,
    limit_s: 8,
  });

  return {
    vars: {
      postcode_rule: level === 1
        ? "In this exercise's samples every postcode is already in one form, but your code must still normalise it."
        : "Postcodes arrive in mixed case and spacing, and some are missing (None) or blank.",
      edit_rule: level === 3
        ? "Here `transpositions` is True: swapping two adjacent characters also counts as one edit."
        : "Here `transpositions` is False: a swap of two adjacent characters counts as two edits.",
    },
    samples,
    tests,
  };
}
