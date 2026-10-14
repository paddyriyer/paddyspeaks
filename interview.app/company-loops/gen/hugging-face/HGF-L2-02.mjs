/* HGF-L2-02 — Test rows that overlap the train split (Python).
   Simulated practice scenario. All data is generated from the seed.

   Contract (python): entry, signature, starter, prelude, generate(r, level) ->
     { vars, samples: [{args, expect}], tests: [{name, args, expect?, limit_s?}] }.
   expect comes from oracle() below, which compares every test row with every train
   row of the same dataset, word window by word window: the naive method, fine for
   small splits. The evaluator's reference builds one map from n-gram to the
   smallest train row index; it is written independently.
   level: 1 Medium (lower-case rows separated by single spaces, one dataset)
          · 2 Hard (+ capitals, punctuation and odd whitespace, several datasets,
            rows shorter than n, the smallest matching train row)
          · 3 Very Hard (+ n varies, windows that would only exist across two
            rows, overlaps exactly n − 1 words long, empty splits) */
export const kind = "python";
export const entry = "split_overlap";
export const signature = "def split_overlap(datasets: dict[str, tuple[list[str], list[str]]], n: int) -> dict[str, list[tuple[int, int]]]:";
export const starter = `import re


def split_overlap(datasets, n):
    """datasets: {name: (train_rows, test_rows)}, each a list of strings.
    Return {name: [(test_index, smallest_train_index), ...]} sorted by test index,
    for test rows that share at least one n-word sequence with a train row
    of the same dataset. Every dataset appears, with [] when it is clean."""
    ...
`;

export const prelude = `
def _gen_splits(n_train, n_test, words, seed):
    x = seed
    def rnd(m):
        nonlocal x
        x = (1103515245 * x + 12345) % 2147483648
        return (x >> 16) % m
    syl = ['ka', 'lo', 'mi', 'ne', 'ru', 'ta', 'vo', 'zi', 'pe', 'sa', 'do', 'fu', 'gi', 'ha', 'ju', 'be']
    vocab = [syl[i % 16] + syl[(i // 16) % 16] + syl[(i // 256) % 16] for i in range(4096)]
    out = {}
    for d in range(2):
        train = [' '.join(vocab[rnd(4096)] for _ in range(words - 5 + rnd(11))) for _ in range(n_train)]
        test = []
        for i in range(n_test):
            row = [vocab[rnd(4096)] for _ in range(words - 5 + rnd(11))]
            if rnd(25) == 0:                       # about 4% copy a passage from a train row
                src = train[rnd(n_train)].split()
                s = rnd(len(src) - 9)
                row[3:3] = [w.upper() if rnd(3) == 0 else w for w in src[s:s + 9]]
            test.append(' '.join(row))
        out['org-%d/corpus-%d' % (d, d)] = (train, test)
    return out, 8
`.trim() + "\n";

// ---- the specification, implemented the obvious way: every test row against every train row ----
const words = (s) => s.toLowerCase().match(/[a-z0-9]+/g) || [];
function grams(row, n) {
  const w = words(row), out = new Set();
  for (let i = 0; i + n <= w.length; i++) out.add(w.slice(i, i + n).join(" "));
  return out;
}
export function oracle(datasets, n) {
  const res = {};
  for (const [name, [train, test]] of Object.entries(datasets)) {
    const tg = train.map((row) => grams(row, n));
    const hits = [];
    test.forEach((row, ti) => {
      const g = grams(row, n);
      for (let j = 0; j < tg.length; j++) {
        let hit = false;
        for (const x of g) if (tg[j].has(x)) { hit = true; break; }
        if (hit) { hits.push([ti, j]); break; }
      }
    });
    res[name] = hits;
  }
  return res;
}

const pyStr = (s) => JSON.stringify(s);           // ASCII only: a JSON string is a Python string
const pyArgs = (ds, n) => "({" + Object.entries(ds).map(([k, [a, b]]) =>
  `${pyStr(k)}: ([${a.map(pyStr).join(", ")}], [${b.map(pyStr).join(", ")}])`).join(", ") + `}, ${n})`;
const pyOut = (res) => "{" + Object.entries(res).map(([k, v]) => `${pyStr(k)}: [${v.map(([a, b]) => `(${a}, ${b})`).join(", ")}]`).join(", ") + "}";

const VOCAB = ("the model answers a question about which city has the largest river and then explains why each " +
  "step of reasoning follows from known facts given in context so that readers can check whether claims hold " +
  "under new evidence while translation pairs keep source sentences aligned with target text for every language " +
  "review sentiment positive negative neutral product shipped late arrived broken works well battery screen price " +
  "patient asked doctor about dose side effects code function returns sorted list without duplicates input output").split(" ");
const ORGS = ["open-lab", "nlp-group", "civic-data", "edu-bench", "lang-coop", "text-guild"];
const SETS = ["qa-small", "reviews-en", "mt-pairs", "reasoning-mix", "code-snips", "med-dialog"];

function rowOf(r, len) { return Array.from({ length: len }, () => r.pick(VOCAB)); }
function noisy(r, ws, level) {
  if (level === 1) return ws.join(" ");
  const seps = [" ", " ", " ", ", ", "  ", " - ", "\t", ". ", "; ", "\n"];
  return ws.map((w) => (r.chance(0.2) ? w[0].toUpperCase() + w.slice(1) : r.chance(0.05) ? w.toUpperCase() : w))
    .map((w, i) => (i ? r.pick(seps) : "") + w).join("") + (r.chance(0.5) ? r.pick(["?", ".", "!", ""]) : "");
}

function randomCase(r, level, n) {
  for (let attempt = 0; attempt < 60; attempt++) {
    const nd = level === 1 ? 1 : r.int(2, 3);
    const names = r.sample(SETS, nd).map((s) => r.pick(ORGS) + "/" + s);
    const ds = {};
    for (const name of names) {
      const trainW = Array.from({ length: r.int(3, 5) }, () => rowOf(r, r.int(n + 1, n + 8)));
      const testW = [];
      for (let i = r.int(4, 6); i > 0; i--) {
        const row = rowOf(r, level >= 2 && r.chance(0.15) ? r.int(2, n - 1) : r.int(n, n + 7));
        const roll = r.next();
        if (roll < 0.4) {
          const src = r.pick(trainW), s = r.int(0, src.length - n);
          const len = level === 3 && r.chance(0.3) ? n - 1 : n + r.int(0, 2);
          row.splice(r.int(0, row.length), 0, ...src.slice(s, s + len));
        }
        testW.push(row);
      }
      const train = trainW.map((w) => noisy(r, w, level));
      if (level === 3 && r.chance(0.3)) train.push(train[r.int(0, train.length - 1)]);   // a duplicated train row
      ds[name] = [train, testW.map((w) => noisy(r, w, level))];
    }
    if (level === 3 && r.chance(0.3)) ds[r.pick(ORGS) + "/empty-test"] = [ds[names[0]][0].slice(0, 1), []];
    const got = oracle(ds, n);
    const flagged = Object.values(got).reduce((s, v) => s + v.length, 0);
    const total = Object.values(ds).reduce((s, v) => s + v[1].length, 0);
    if (flagged > 0 && flagged < total) return { ds, got };
  }
  throw new Error("HGF-L2-02: could not build a sample");
}

export function generate(r, level) {
  const n = level === 3 ? r.pick([5, 6, 10, 12]) : 8;
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const c = randomCase(r, level, n);
    samples.push({ args: pyArgs(c.ds, n), expect: pyOut(c.got) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const W = (k) => rowOf(r, k);
  const A = W(n + 4), B = W(n + 3), C = W(n + 2);
  const name = r.pick(ORGS) + "/" + r.pick(SETS), other = r.pick(ORGS) + "/held-out";
  const j = (ws) => ws.join(" ");
  const edges = [
    ["a test row that is exactly one n-word window of a train row",
      { [name]: [[j(A), j(B)], [j(B.slice(1, 1 + n)), j(C)]] }],
    ["a shared run of n − 1 words is not an overlap",
      { [name]: [[j(A)], [j([...C.slice(0, 2), ...A.slice(2, 2 + n - 1), ...C.slice(2)])]] }],
    ["the smallest matching train row is reported, not the first one found in the test row",
      { [name]: [[j(C), j(A), j(B)], [j([...B.slice(0, n), "and", ...A.slice(0, n)])]] }],
    ["every dataset appears, a clean one with []",
      { [name]: [[j(A)], [j(A.slice(2, 2 + n))]], [other]: [[j(B)], [j(C)]] }],
    ["overlaps only count within the same dataset",
      { [name]: [[j(A)], [j(C)]], [other]: [[j(C)], [j(B)]] }],
  ];
  if (level >= 2) {
    edges.push(["capitals, punctuation and whitespace runs do not hide an overlap",
      { [name]: [[j(A)], [A.slice(1, 1 + n).map((w, i) => (i % 2 ? w.toUpperCase() : w)).join(",\n\t ") + "?!"]] }]);
    edges.push(["a test row shorter than n words is never flagged",
      { [name]: [[j(A)], [j(A.slice(0, n - 1)), j(A.slice(0, n))]] }]);
    edges.push(["two identical test rows are both flagged",
      { [name]: [[j(B), j(A)], [j(C), j(A.slice(0, n)), j(A.slice(0, n))]] }]);
  }
  if (level === 3) {
    edges.push(["a window that only exists across the end of one train row and the start of the next is not an overlap",
      { [name]: [[j(A), j(B)], [j([...A.slice(-4), ...B.slice(0, n - 4)])]] }]);
    edges.push(["empty test split and an empty train split",
      { [name]: [[j(A)], []], [other]: [[], [j(A)]] }]);
    edges.push(["hyphens split words: \"step-by-step\" is three words",
      { [name]: [[[...A.slice(0, n - 3), "step", "by", "step"].join(" ")], [[...A.slice(0, n - 3), "step-by-step"].join(" ")]] }]);
  }
  for (const [nm, ds] of edges) tests.push({ name: nm, args: pyArgs(ds, n), expect: pyOut(oracle(ds, n)) });

  // Timing: two datasets of 6 000 train and 2 000 test rows, about 40 words each.
  // One n-gram map is about 640 000 window lookups; comparing every test row with
  // every train row is 24 million row pairs.
  tests.push({
    name: "2 datasets × (6,000 train + 2,000 test rows), ~40 words each (one n-gram map, not row pairs)",
    args: `_gen_splits(6000, 2000, 40, ${r.int(1, 1_000_000)})`,
    limit_s: 8,
  });

  return {
    vars: {
      n,
      text_rule: level === 1
        ? "In this replay rows are lower-case words separated by single spaces, and there is one dataset; the checks also cover several datasets and messier text."
        : level === 2
          ? "In this replay rows have capitals, punctuation, tabs and line breaks, some rows are shorter than n words, and there are several datasets."
          : "In this replay n is not 8, train rows can repeat, some splits are empty, and some passages are shared for exactly n − 1 words.",
    },
    samples,
    tests,
  };
}
