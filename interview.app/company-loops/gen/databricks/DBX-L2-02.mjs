/* DBX-L2-02 — Small-file compaction planner (Python, bin packing).
   Simulated practice scenario. All data is generated from the seed.

   Contract (python): entry, signature, starter, prelude, generate(r, level) ->
     { vars, samples: [{args, expect}], tests: [{name, args, expect?, limit_s?}] }.
   expect comes from oracle() below: first-fit decreasing written literally, with a
   linear scan over the open outputs for every file. The evaluator's reference finds
   the first output with room through a max segment tree, so each checks the other.
   level: 1 Medium (small files, first-fit decreasing per partition, no lone
          rewrites) · 2 Hard (+ a minimum number of candidates per partition) ·
          3 Very Hard (+ files with many deleted rows are rewritten for their live bytes) */
export const kind = "python";
export const entry = "plan_compaction";
export const signature = "def plan_compaction(files: list[tuple[str, str, int, int]], target_mb: int, small_mb: int, min_input_files: int = 2, purge_pct: int | None = None) -> list[tuple[str, int, list[str]]]:";
export const starter = `def plan_compaction(files, target_mb, small_mb, min_input_files=2, purge_pct=None):
    """files: (path, partition, size_mb, deleted_mb) for one table.
    Candidates: size_mb < small_mb, or (purge_pct set and
    deleted_mb * 100 >= purge_pct * size_mb). A candidate weighs its live MB.
    Per partition with >= min_input_files candidates: first-fit decreasing
    into outputs of at most target_mb. Drop an output holding one file unless
    that file is a purge candidate.
    Return [(partition, output_mb, [paths]), ...] by partition, then by output."""
    ...
`;

export const prelude = `
def _gen_files(n, parts, target, small, min_files, purge, seed):
    x, out = seed, []
    for i in range(n):
        x = (1103515245 * x + 12345) % 2147483648
        p = (x >> 8) % parts
        part = 'dt=2026-%02d-%02d' % (1 + p // 28, 1 + p % 28)
        x = (1103515245 * x + 12345) % 2147483648
        size = 1 + (x >> 8) % (2 * target)
        if size >= small and (x >> 4) % 4:
            size = 1 + size % small
        deleted = 0
        if purge is not None:
            x = (1103515245 * x + 12345) % 2147483648
            if (x >> 8) % 5 == 0:
                deleted = (x >> 12) % size
        out.append(('part-%06d.parquet' % i, part, size, deleted))
    return out, target, small, min_files, purge
`.trim() + "\n";

// First-fit decreasing as specified, one linear scan per file. Small inputs only.
export function oracle(files, target, small, minFiles, purgePct) {
  const isPurge = (f) => purgePct != null && f[3] * 100 >= purgePct * f[2];
  const parts = new Map();
  for (const f of files) {
    if (!(f[2] < small || isPurge(f))) continue;
    if (!parts.has(f[1])) parts.set(f[1], []);
    parts.get(f[1]).push({ path: f[0], live: f[2] - f[3], purge: isPurge(f) });
  }
  const plan = [];
  for (const part of [...parts.keys()].sort()) {
    const c = parts.get(part);
    if (c.length < minFiles) continue;
    c.sort((a, b) => b.live - a.live || (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
    const outs = [];
    for (const f of c) {
      let o = outs.find((x) => x.total + f.live <= target);
      if (!o) { o = { total: 0, paths: [], purge: false }; outs.push(o); }
      o.total += f.live;
      o.paths.push(f.path);
      o.purge = o.purge || f.purge;
    }
    for (const o of outs) if (o.paths.length > 1 || o.purge) plan.push([part, o.total, o.paths]);
  }
  return plan;
}

const q = (s) => `'${s}'`;
const pyOut = (plan) => "[" + plan.map(([p, t, paths]) => `(${q(p)}, ${t}, [${paths.map(q).join(", ")}])`).join(", ") + "]";
const pyArgs = (files, target, small, minFiles, purge) =>
  `([${files.map((f) => `(${q(f[0])}, ${q(f[1])}, ${f[2]}, ${f[3]})`).join(", ")}], ${target}, ${small}, ${minFiles}, ${purge == null ? "None" : purge})`;
const caseOf = (name, files, target, small, minFiles = 2, purge = null) =>
  ({ name, args: pyArgs(files, target, small, minFiles, purge), expect: pyOut(oracle(files, target, small, minFiles, purge)) });

const COLS = ["dt", "event_date", "ingest_date", "load_date"];
const pad = (n, w) => String(n).padStart(w, "0");

function smallCase(r, level, col, target, small, minFiles, purge) {
  const nParts = r.int(2, 3);
  const days = r.sample(Array.from({ length: 20 }, (_, i) => i + 1), nParts);
  const files = [];
  let id = r.int(10, 60);
  for (const d of days) {
    const part = `${col}=2026-10-${pad(d, 2)}`;
    const n = level === 1 ? r.int(4, 7) : r.int(4, 8);
    let last = null;
    for (let i = 0; i < n; i++) {
      let size = r.chance(0.75) ? r.int(2, small - 1) : r.int(small, 2 * target);
      if (last !== null && r.chance(0.2)) size = last;                 // a size tie
      last = size;
      let deleted = 0;
      if (purge != null && r.chance(0.35)) deleted = size >= small ? r.int(Math.floor(size / 3), size - 1) : r.int(1, Math.floor(size / 2));
      files.push([`part-${pad(id, 5)}.parquet`, part, size, deleted]);
      id += r.int(1, 9);
    }
  }
  return r.shuffle(files);
}

export function generate(r, level) {
  const col = r.pick(COLS);
  const target = r.pick([128, 256]);
  const small = r.pick([target / 4, target / 2, (target * 3) / 8]);
  const minFiles = level === 1 ? 2 : r.int(3, 4);
  const purge = level === 3 ? r.pick([50, 60, 75]) : null;
  const samples = [];
  for (let i = 0; i < 2; i++) {
    const files = smallCase(r, level, col, target, small, minFiles, purge);
    samples.push({ args: pyArgs(files, target, small, minFiles, purge), expect: pyOut(oracle(files, target, small, minFiles, purge)) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const [d1, d2] = r.sample(Array.from({ length: 28 }, (_, i) => i + 1), 2).sort((a, b) => a - b);
  const P = `${col}=2026-09-${pad(d1, 2)}`, Q = `${col}=2026-09-${pad(d2, 2)}`;
  const base = r.int(100, 800);
  const f = (k) => `part-${pad(base + k, 5)}.parquet`;
  const T = 128;
  tests.push(caseOf("a file of exactly small_mb is not a candidate",
    [[f(1), P, 64, 0], [f(2), P, 63, 0], [f(3), P, 10, 0]], T, 64));
  tests.push(caseOf("two files that fill an output exactly share it",
    [[f(1), P, 70, 0], [f(2), P, 58, 0]], T, 96));
  tests.push(caseOf("a file that would overflow an output by 1 MB goes to the next one",
    [[f(1), P, 70, 0], [f(2), P, 59, 0], [f(3), P, 50, 0], [f(4), P, 9, 0]], T, 96));
  tests.push(caseOf("first fit, not best fit: the earliest output with room takes the file",
    [[f(4), P, 13, 0], [f(2), P, 58, 0], [f(1), P, 74, 0], [f(3), P, 56, 0]], T, 96));
  tests.push(caseOf("a file left alone in an output is not rewritten",
    [[f(1), P, 60, 0], [f(2), P, 60, 0], [f(3), P, 50, 0]], T, 64));
  tests.push(caseOf("equal sizes are placed in path order",
    [[f(3), P, 40, 0], [f(1), P, 40, 0], [f(4), P, 40, 0], [f(2), P, 40, 0]], T, 64));
  tests.push(caseOf("partitions are packed separately and listed in order",
    [[f(1), Q, 50, 0], [f(2), P, 30, 0], [f(3), Q, 40, 0], [f(4), P, 20, 0], [f(5), Q, 45, 0]], T, 64));
  tests.push(caseOf("no candidates: an empty plan",
    [[f(1), P, 100, 0], [f(2), Q, 64, 0]], T, 64));
  if (level >= 2) {
    tests.push(caseOf("a partition with fewer than min_input_files candidates is skipped",
      [[f(1), P, 10, 0], [f(2), P, 12, 0], [f(3), Q, 10, 0], [f(4), Q, 11, 0], [f(5), Q, 12, 0]], T, 64, 3));
    tests.push(caseOf("exactly min_input_files candidates is enough, even if one ends up alone",
      [[f(1), P, 60, 0], [f(2), P, 60, 0], [f(3), P, 30, 0], [f(4), P, 90, 0]], T, 64, 3));
  }
  if (level === 3) {
    tests.push(caseOf("a large file with many deleted rows is rewritten on its own",
      [[f(1), P, 200, 120], [f(2), P, 300, 0]], T, 64, 1, 50));
    tests.push(caseOf("deleted rows of exactly purge_pct make a file a candidate",
      [[f(1), P, 200, 100], [f(2), P, 30, 0]], T, 64, 2, 50));
    tests.push(caseOf("just under purge_pct the large file is left alone",
      [[f(1), P, 200, 99], [f(2), P, 30, 0], [f(3), P, 20, 0]], T, 64, 2, 50));
    tests.push(caseOf("only live MB count toward the target",
      [[f(1), P, 60, 20], [f(2), P, 60, 20], [f(3), P, 50, 10]], T, 64, 2, 75));
    tests.push(caseOf("min_input_files counts purge candidates too",
      [[f(1), P, 220, 150], [f(2), Q, 220, 150], [f(3), Q, 20, 0]], T, 64, 2, 60));
  }

  // Timing: one table, up to 100 000 files in two partitions. Finding the first
  // output with room through a max segment tree is O(n log n); scanning the open
  // outputs for every file is O(n · outputs).
  const n = level === 1 ? 80000 : 100000;
  const parts = 2;
  tests.push({
    name: `${n.toLocaleString("en-US")} files in ${parts} partitions in time`,
    args: `_gen_files(${n}, ${parts}, 128, 64, 2, ${level === 3 ? 50 : "None"}, ${r.int(1, 1_000_000)})`,
    limit_s: 8,
  });

  return {
    vars: {
      partition_col: col,
      target_mb: String(target),
      small_mb: String(small),
      partition_rule: level === 1
        ? "In this exercise `min_input_files` is 2, so any partition with two or more candidates is planned."
        : `Here \`min_input_files\` is ${minFiles} in the samples: a partition with fewer candidates than that is skipped entirely, because a compaction job for it would cost more than it saves. Count every candidate, including purge candidates.`,
      purge_rule: level === 3
        ? `Here \`purge_pct\` is ${purge} in the samples. A file of any size is also a candidate when \`deleted_mb * 100 >= purge_pct * size_mb\`: rows marked deleted but still stored in it waste reads, and rewriting it keeps only its live rows. Such a file may be rewritten on its own.`
        : "In this exercise `purge_pct` is `None` and `deleted_mb` is 0 for every file; your function must still accept the argument.",
    },
    samples,
    tests,
  };
}
