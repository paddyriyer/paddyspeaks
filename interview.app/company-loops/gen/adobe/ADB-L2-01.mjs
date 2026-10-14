/* ADB-L2-01 — Comparing two saved versions of a cloud document (Python).
   Simulated practice scenario. All data is generated from the seed.

   Contract (python): entry, signature, starter, prelude, generate(r, level) ->
     { vars, samples: [{args, expect}], tests: [{name, args, expect?, limit_s?}] }.
   expect comes from oracle() below: the textbook longest-common-subsequence table
   (O(n·m), fine for the small cases), from which deleted = n − LCS and
   inserted = m − LCS. The evaluator's reference is Myers' greedy O((n+m)·D)
   algorithm, written independently.
   level: 1 Medium (distinct paragraphs, a few edits)
          · 2 Hard (+ repeated paragraphs such as empty lines and repeated headings,
            moved paragraphs, one version empty)
          · 3 Very Hard (+ the max_edits cap: None when the versions differ by more) */
export const kind = "python";
export const entry = "version_diff";
export const signature = "def version_diff(old: list[str], new: list[str], max_edits: int | None = None) -> tuple[int, int] | None:";
export const starter = `def version_diff(old, new, max_edits=None):
    """old, new: paragraph content hashes of two saved versions, in document order.
    Return (deleted, inserted) for the fewest paragraph deletions plus insertions
    that turn old into new, or None if that number exceeds max_edits."""
    ...
`;

export const prelude = `
def _gen_versions(n, sites, seed, cap=None):
    x = seed
    def rnd(m):
        nonlocal x
        x = (1103515245 * x + 12345) % 2147483648
        return (x >> 16) % m
    old = ['%07x' % (i * 2654435761 % 268435456) for i in range(n)]
    ops = {}
    for _ in range(sites):
        ops[rnd(n)] = rnd(3)
    new, k = [], 0
    for i, h in enumerate(old):
        op = ops.get(i)
        if op == 0:
            continue                      # paragraph deleted
        if op is not None:
            new.append('n%06d' % k)       # paragraph inserted (op 1) or replacing this one (op 2)
            k += 1
            if op == 2:
                continue
        new.append(h)
    return old, new, cap
`.trim() + "\n";

// Independent oracle: the full LCS table.
export function oracle(oldv, newv, maxEdits) {
  const n = oldv.length, m = newv.length;
  let prev = new Array(m + 1).fill(0);
  for (let i = 1; i <= n; i++) {
    const cur = new Array(m + 1).fill(0);
    for (let j = 1; j <= m; j++) cur[j] = oldv[i - 1] === newv[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], cur[j - 1]);
    prev = cur;
  }
  const lcs = prev[m];
  const del = n - lcs, ins = m - lcs;
  if (maxEdits !== null && maxEdits !== undefined && del + ins > maxEdits) return null;
  return [del, ins];
}

const pyList = (xs) => "[" + xs.map((s) => "'" + s + "'").join(", ") + "]";
const pyArgs = (a, b, cap) => `(${pyList(a)}, ${pyList(b)}, ${cap === null || cap === undefined ? "None" : cap})`;
const pyOut = (v) => (v === null ? "None" : `(${v[0]}, ${v[1]})`);

const HEX = "0123456789abcdef".split("");
const EMPTY = "e3b0c4";            // the hash an empty paragraph gets in this exercise
function hashes(r, k, avoid = new Set()) {
  const out = [];
  while (out.length < k) {
    const h = Array.from({ length: 6 }, () => r.pick(HEX)).join("");
    if (h !== EMPTY && !avoid.has(h)) { avoid.add(h); out.push(h); }
  }
  return out;
}

function randomCase(r, level) {
  for (let attempt = 0; attempt < 60; attempt++) {
    const n = level === 1 ? r.int(8, 12) : r.int(10, 16);
    const seen = new Set();
    let old = hashes(r, n, seen);
    if (level >= 2) {
      // repeated paragraphs: empty lines and a repeated heading
      const heading = hashes(r, 1, seen)[0];
      for (let i = 0; i < r.int(2, 4); i++) old.splice(r.int(0, old.length), 0, r.chance(0.6) ? EMPTY : heading);
    }
    let nw = old.slice();
    const edits = level === 1 ? r.int(2, 4) : r.int(3, 6);
    for (let e = 0; e < edits; e++) {
      const op = r.int(0, level === 1 ? 2 : 3);
      if (op === 0 && nw.length > 1) nw.splice(r.int(0, nw.length - 1), 1);                    // delete
      else if (op === 1) nw.splice(r.int(0, nw.length), 0, hashes(r, 1, seen)[0]);               // insert
      else if (op === 2 && nw.length) nw[r.int(0, nw.length - 1)] = hashes(r, 1, seen)[0];       // rewrite
      else if (nw.length > 2) {                                                                  // move
        const [p] = nw.splice(r.int(0, nw.length - 1), 1);
        nw.splice(r.int(0, nw.length), 0, p);
      }
    }
    if (level >= 2 && r.chance(0.15)) { if (r.chance(0.5)) old = []; else nw = []; }
    const full = oracle(old, nw, null);
    if (full[0] + full[1] === 0) continue;
    let cap = null;
    if (level === 3) {
      const d = full[0] + full[1];
      cap = r.pick([d, d - 1, d + r.int(1, 3), Math.max(0, d - r.int(2, 4))]);
    }
    return { old, nw, cap, got: oracle(old, nw, cap) };
  }
  throw new Error("ADB-L2-01: could not build a sample");
}

export function generate(r, level) {
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const c = randomCase(r, level);
    samples.push({ args: pyArgs(c.old, c.nw, c.cap), expect: pyOut(c.got) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const P = hashes(r, 8);
  const [a, b, c, d, e, f, g, h] = P;
  const edges = [
    ["identical versions need no edits", [a, b, c, d], [a, b, c, d], null],
    ["two empty versions", [], [], null],
    ["a new document: every paragraph is an insertion", [], [a, b, c], null],
    ["everything deleted", [a, b, c, d, e], [], null],
    ["a rewritten paragraph is one deletion and one insertion", [a, b, c, d], [a, b, g, d], null],
    ["a moved paragraph is one deletion and one insertion", [a, b, c, d, e], [b, c, d, a, e], null],
    ["swapped neighbours", [a, b, c, d], [a, c, b, d], null],
    ["reversed order keeps only one paragraph in place", [a, b, c, d, e], [e, d, c, b, a], null],
    ["the longest common run is not at the start", [a, b, c, d, e, f], [g, d, e, f, a, h], null],
  ];
  if (level >= 2) {
    edges.push(["empty paragraphs repeat; the alignment must not pair the wrong ones",
      [a, EMPTY, b, EMPTY, c, EMPTY], [EMPTY, a, b, EMPTY, EMPTY, c], null]);
    edges.push(["a whole section moved down", [a, b, c, d, e, f], [d, e, f, a, b, c], null]);
  }
  if (level === 3) {
    edges.push(["exactly max_edits edits is still a diff", [a, b, c, d], [a, c, b, g], 4]);
    edges.push(["one edit over the cap returns None", [a, b, c, d], [a, c, b, g], 3]);
    edges.push(["a cap of 0 on identical versions", [a, b, c], [a, b, c], 0]);
    edges.push(["a cap of 0 on different versions", [a, b, c], [a, c], 0]);
    edges.push(["a cap larger than both versions together", [a, b], [c], 50]);
  }
  for (const [name, x, y, cap] of edges) tests.push({ name, args: pyArgs(x, y, cap), expect: pyOut(oracle(x, y, cap)) });

  // Timing: a 30,000-paragraph manual with about 80 edit sites spread through it
  // (about 100 edits). Myers does O(n + D²) work here; a full table is 9×10⁸ cells.
  const cap = level === 3 ? `, ${r.int(400, 900)}` : "";
  tests.push({
    name: "30,000 paragraphs, about 100 edits spread through the document",
    args: `_gen_versions(30000, 80, ${r.int(1, 1_000_000)}${cap})`,
    limit_s: 8,
  });

  return {
    vars: {
      cap_rule: level === 3
        ? "`max_edits` is an integer or `None`. If the fewest edits needed is greater than `max_edits`, return `None`: the page then says the versions differ too much to show side by side. Exactly `max_edits` edits is still a diff."
        : "In this exercise `max_edits` is always `None`, but keep the parameter.",
      dup_rule: level === 1
        ? "In this replay every paragraph hash is distinct within a version."
        : "Hashes can repeat within a version: every empty paragraph has the same hash, and so does a heading that appears twice.",
    },
    samples,
    tests,
  };
}
