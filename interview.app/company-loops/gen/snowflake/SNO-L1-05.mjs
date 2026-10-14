/* SNO-L1-05 — Bulk-load file selection: glob patterns, files already loaded and a
   load-metadata retention window (Python). Simulated practice scenario. All data is generated
   from the seed. The 64-day window and the "uncertain" rule are this exercise's simplified
   rules modelled on public bulk-loading documentation (check current docs); the loader here
   takes glob patterns, which is the exercise's choice, not a product's syntax.

   Contract (python): entry, signature, starter, prelude, generate(r, level) ->
     { vars, samples: [{args, expect}], tests: [{name, args, expect?, limit_s?}] }.
   expect comes from oracle() below: a backtracking glob matcher over pattern tokens (no
   regular expressions) and, per file, a scan of the whole load history. The evaluator's
   reference compiles each pattern to a regular expression and indexes the history by
   path, written independently.
   level: 1 Medium (`*` and `?` within one directory level; remembered loads with the same
            etag are skipped; old files with no remembered load are uncertain)
          · 2 Hard (+ `**` across directories, `!` exclude patterns, exact 64-day boundaries,
            a remembered load of an older version)
          · 3 Very Hard (+ character classes `[a-z]` and `[!_]`, failed loads in the history,
            and the load_uncertain switch) */
export const kind = "python";
export const entry = "select_files";
export const signature = "def select_files(files: list[tuple[str, str, int]], history: list[tuple[str, str, int, str]], patterns: list[str], now: int, load_uncertain: bool) -> list[tuple[str, str]]:";
export const starter = `def select_files(files, history, patterns, now, load_uncertain):
    """files: (path, etag, last_modified) in the stage now.
    history: (path, etag, loaded_at, status) load records.
    patterns: glob patterns; a leading '!' marks an exclude pattern.
    Return [(path, 'LOAD' | 'SKIP_LOADED' | 'SKIP_UNCERTAIN')] for every
    selected file, sorted by path."""
    ...
`;

export const prelude = `
def _gen_load(n, seed, patterns, load_uncertain=False, failed=False):
    x = seed
    def rnd(m):
        nonlocal x
        x = (1103515245 * x + 12345) % 2147483648
        return (x >> 16) % m
    day, now = 86400, 1790000000
    files, history = [], []
    for k in range(n):
        m, d, kind = 1 + rnd(9), 1 + rnd(28), rnd(10)
        if kind == 0:
            path = 'landing/orders/2026/%02d/%02d/_manifest-%06d.json' % (m, d, k)
        elif kind == 1:
            path = 'landing/orders/tmp/part-%06d.csv.gz' % k
        else:
            path = 'landing/orders/2026/%02d/%02d/part-%06d.csv.gz' % (m, d, k)
        modified = now - rnd(120) * day - rnd(24) * 3600 - rnd(3600)
        etag = '%04x%04x' % (rnd(32768), rnd(32768))
        files.append((path, etag, modified))
        h = rnd(4)
        if h:                                            # loaded once, maybe an older version
            history.append((path, etag if h != 1 else 'e%07x' % rnd(32768), modified + rnd(3600),
                            'LOAD_FAILED' if failed and rnd(8) == 0 else 'LOADED'))
        if h == 3:
            history.append((path, '%04x%04x' % (rnd(32768), rnd(32768)), modified - rnd(30) * day, 'LOADED'))
    return files, history, patterns, now, load_uncertain
`.trim() + "\n";

const DAY = 86400;
const WINDOW = 64 * DAY;

// Pattern tokens: literal, ? , * , ** , [class]. Backtracking with memo.
function tokens(p) {
  const t = [];
  for (let i = 0; i < p.length;) {
    const c = p[i];
    if (c === "*" && p[i + 1] === "*") { t.push({ k: "dstar" }); i += 2; }
    else if (c === "*") { t.push({ k: "star" }); i++; }
    else if (c === "?") { t.push({ k: "one" }); i++; }
    else if (c === "[") {
      const j = p.indexOf("]", i + 1);
      let body = p.slice(i + 1, j);
      const neg = body[0] === "!";
      if (neg) body = body.slice(1);
      const ranges = [];
      for (let k = 0; k < body.length; k++) {
        if (body[k + 1] === "-" && k + 2 < body.length) { ranges.push([body[k], body[k + 2]]); k += 2; }
        else ranges.push([body[k], body[k]]);
      }
      t.push({ k: "class", neg, ranges });
      i = j + 1;
    } else { t.push({ k: "lit", c }); i++; }
  }
  return t;
}
export function globMatch(pattern, s) {
  const t = tokens(pattern);
  const memo = new Map();
  const go = (i, j) => {
    const key = i * 10000 + j;
    if (memo.has(key)) return memo.get(key);
    let ok;
    if (i === t.length) ok = j === s.length;
    else {
      const x = t[i];
      if (x.k === "dstar") { ok = false; for (let e = j; e <= s.length && !ok; e++) ok = go(i + 1, e); }
      else if (x.k === "star") { ok = false; for (let e = j; e <= s.length && !ok; e++) { ok = go(i + 1, e); if (s[e] === "/") break; } }
      else if (j >= s.length) ok = false;
      else if (x.k === "one") ok = s[j] !== "/" && go(i + 1, j + 1);
      else if (x.k === "lit") ok = s[j] === x.c && go(i + 1, j + 1);
      else {
        const inSet = x.ranges.some(([a, b]) => s[j] >= a && s[j] <= b);
        ok = s[j] !== "/" && (x.neg ? !inSet : inSet) && go(i + 1, j + 1);
      }
    }
    memo.set(key, ok);
    return ok;
  };
  return go(0, 0);
}

export function oracle(files, history, patterns, now, loadUncertain) {
  const inc = patterns.filter((p) => p[0] !== "!"), exc = patterns.filter((p) => p[0] === "!").map((p) => p.slice(1));
  const out = [];
  for (const [path, etag, modified] of files) {
    if (!inc.some((p) => globMatch(p, path)) || exc.some((p) => globMatch(p, path))) continue;
    const remembered = history.filter((h) => h[0] === path && now - h[2] < WINDOW);
    let st;
    if (remembered.length) st = remembered.some((h) => h[1] === etag && h[3] === "LOADED") ? "SKIP_LOADED" : "LOAD";
    else if (now - modified >= WINDOW) st = loadUncertain ? "LOAD" : "SKIP_UNCERTAIN";
    else st = "LOAD";
    out.push([path, st]);
  }
  out.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  return out;
}

const q = (s) => `'${s}'`;
const pyArgs = (files, history, patterns, now, lu) =>
  `([${files.map(([p, e, m]) => `(${q(p)}, ${q(e)}, ${m})`).join(", ")}], ` +
  `[${history.map(([p, e, at, st]) => `(${q(p)}, ${q(e)}, ${at}, ${q(st)})`).join(", ")}], ` +
  `[${patterns.map(q).join(", ")}], ${now}, ${lu ? "True" : "False"})`;
const pyOut = (rows) => `[${rows.map(([p, s]) => `(${q(p)}, ${q(s)})`).join(", ")}]`;

const NOWS = ["2026-09-21", "2026-09-28", "2026-10-05", "2026-10-09"];
const HEX = "0123456789abcdef".split("");
const ep = (day) => Date.parse(day + "T00:00:00Z") / 1000;
const md = (t) => { const d = new Date(t * 1000); return [String(d.getUTCMonth() + 1).padStart(2, "0"), String(d.getUTCDate()).padStart(2, "0")]; };

const PATTERNS = {
  1: [
    ["landing/orders/2026/*/*/part-*.csv.gz"],
    ["landing/orders/2026/0?/*/part-*.csv.gz"],
    ["landing/orders/2026/*/*/part-*.csv.gz", "landing/orders/*.csv.gz"],
    ["landing/orders/2026/*/?5/*.csv.gz", "landing/orders/2026/*/1?/*.csv.gz"],
  ],
  2: [
    ["landing/**/part-*.csv.gz", "!**/tmp/**"],
    ["landing/**.gz", "!**/tmp/**", "!landing/clicks/**"],
    ["landing/orders/**", "!**/_*"],
    ["landing/clicks/2026/**/events-*.json.gz", "landing/orders/2026/*/*/part-*.csv.gz", "!**/tmp/**"],
  ],
  3: [
    ["landing/orders/2026/0[6-9]/[0-2][0-9]/part-*.csv.gz", "landing/orders/2026/10/**"],
    ["landing/**/[!_]*.gz", "!**/tmp/**"],
    ["landing/clicks/2026/*/*/[01][0-9]/events-*.json.gz", "landing/orders/**/part-00[0-4]?.csv.gz", "!**/_*"],
    ["landing/**/[a-p]*-*.gz", "!landing/orders/tmp/**"],
  ],
};

function randomCase(r, level) {
  const now = ep(r.pick(NOWS)) + r.int(0, DAY - 1);
  const etag = () => Array.from({ length: 8 }, () => r.pick(HEX)).join("");
  const files = [], history = [];
  const used = new Set();
  const n = level === 1 ? r.int(7, 9) : r.int(9, 12);
  for (let k = 0; files.length < n && k < 100; k++) {
    const modified = now - r.int(0, 100) * DAY - r.int(0, DAY - 1);
    const [mm, dd] = md(modified);
    const kind = r.int(0, level === 1 ? 5 : 8);
    let path;
    if (kind <= 3) path = `landing/orders/2026/${mm}/${dd}/part-${String(r.int(0, 80)).padStart(4, "0")}.csv.gz`;
    else if (kind === 4) path = `landing/orders/2026/${mm}/${dd}/_SUCCESS`;
    else if (kind === 5) path = `landing/orders/backfill-${String(r.int(1, 9)).padStart(2, "0")}.csv.gz`;
    else if (kind === 6) path = `landing/orders/tmp/part-${String(r.int(0, 99)).padStart(4, "0")}.csv.gz`;
    else path = `landing/clicks/2026/${mm}/${dd}/${String(r.int(0, 23)).padStart(2, "0")}/events-${String(r.int(0, 30)).padStart(3, "0")}.json.gz`;
    if (used.has(path)) continue;
    used.add(path);
    const e = etag();
    files.push([path, e, modified]);
    const h = r.int(0, 4);
    const status = () => (level === 3 && r.chance(0.25) ? "LOAD_FAILED" : "LOADED");
    const after = () => Math.min(modified + r.int(60, 7200), now - 1);
    if (h === 1 || h === 2) history.push([path, e, after(), status()]);            // loaded this version
    if (h === 3) {                                                                                      // loaded an older version
      history.push([path, etag(), modified - r.int(1, 20) * DAY, "LOADED"]);
      if (level >= 2 && r.chance(0.5)) history.push([path, e, after(), status()]);
    }
  }
  const patterns = r.pick(PATTERNS[level]);
  const lu = level === 3 && r.chance(0.4);
  return { args: [files, r.shuffle(history), patterns, now, lu] };
}

export function generate(r, level) {
  const samples = [];
  for (let i = 0; i < 3; i++) {
    let c;
    for (let k = 0; k < 40; k++) {
      c = randomCase(r, level);
      const got = oracle(...c.args);
      const kinds = new Set(got.map((x) => x[1]));
      if (got.length >= 3 && kinds.size >= 2) break;
    }
    samples.push({ args: pyArgs(...c.args), expect: pyOut(oracle(...c.args)) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const now = ep(r.pick(NOWS)) + r.int(0, DAY - 1);
  const E = "a1b2c3d4", E2 = "9f8e7d6c";
  const recent = now - r.int(2, 30) * DAY;
  const edges = [
    ["* stays within one directory level",
      [["landing/a.csv.gz", E, recent], ["landing/x/b.csv.gz", E, recent], ["landing/.csv.gz", E, recent]], [], ["landing/*.csv.gz"], false],
    ["? is exactly one character, and . is literal",
      [["in/part-07.csv", E, recent], ["in/part-107.csv", E, recent], ["in/part-07xcsv", E, recent], ["in/part-/.csv", E, recent]], [], ["in/part-?7.csv", "in/part-0?.csv"], false],
    ["a remembered load of the same etag is skipped; a new etag loads",
      [["in/a.csv", E, recent], ["in/b.csv", E2, recent]], [["in/a.csv", E, recent + 3600, "LOADED"], ["in/b.csv", E, recent + 60, "LOADED"]], ["in/*.csv"], false],
    ["never loaded: last_modified exactly 64 days ago is uncertain, one second later is not",
      [["in/old.csv", E, now - WINDOW], ["in/edge.csv", E, now - WINDOW + 1]], [], ["in/*.csv"], false],
    ["a load exactly 64 days ago is forgotten; one second later it is remembered",
      [["in/a.csv", E, now - 70 * DAY], ["in/b.csv", E, now - 70 * DAY]], [["in/a.csv", E, now - WINDOW, "LOADED"], ["in/b.csv", E, now - WINDOW + 1, "LOADED"]], ["in/*.csv"], false],
  ];
  if (level >= 2) {
    edges.push(["** crosses directories but the slashes around it stay literal",
      [["in/x.gz", E, recent], ["in/a/x.gz", E, recent], ["in/a/b/x.gz", E, recent], ["in/a/b/y.gz", E, recent]], [], ["in/**/x.gz"], false]);
    edges.push(["an exclude pattern wins over an include",
      [["in/2026/part-1.gz", E, recent], ["in/tmp/part-2.gz", E, recent], ["in/2026/tmp/part-3.gz", E, recent]], [], ["in/**", "!**/tmp/**"], false]);
    edges.push(["an old last_modified (a copy that kept its timestamp) with a remembered load of another etag is loaded, not uncertain",
      [["in/a.csv", E, now - 80 * DAY]], [["in/a.csv", E2, now - 10 * DAY, "LOADED"]], ["in/*"], false]);
  }
  if (level === 3) {
    edges.push(["character classes, ranges and negation; a class never matches /",
      [["in/a1b", E, recent], ["in/a5b", E, recent], ["in/a/b", E, recent], ["in/_x", E, recent], ["in/yx", E, recent]], [], ["in/a[0-3]b", "in/a[!0-9]b", "in/[!_]x"], false]);
    edges.push(["a remembered failed load of the same etag is loaded again",
      [["in/a.csv", E, recent], ["in/b.csv", E, recent]], [["in/a.csv", E, recent + 60, "LOAD_FAILED"], ["in/b.csv", E, recent + 60, "LOAD_FAILED"], ["in/b.csv", E, recent + 900, "LOADED"]], ["in/*.csv"], false]);
    edges.push(["load_uncertain loads an old file with no remembered load",
      [["in/old.csv", E, now - 90 * DAY], ["in/done.csv", E, now - 90 * DAY]], [["in/done.csv", E, now - 5 * DAY, "LOADED"]], ["in/*.csv"], true]);
  }
  for (const [name, files, history, patterns, lu] of edges) tests.push({ name, args: pyArgs(files, history, patterns, now, lu), expect: pyOut(oracle(files, history, patterns, now, lu)) });

  // Timing: 60,000 files and about 60,000 load records. Indexing the history by path is
  // O(F + H); scanning the history for every file is O(F × H).
  const pats = level === 1 ? "['landing/orders/2026/0?/*/part-*.csv.gz']"
    : level === 2 ? "['landing/**/part-*.csv.gz', '!**/tmp/**']"
    : "['landing/orders/2026/0[1-9]/[0-2][0-9]/[!_]*.gz', '!**/tmp/**']";
  tests.push({ name: "60,000 files against 60,000 load records (an index by path, not a scan)", args: `_gen_load(60000, ${r.int(1, 1_000_000)}, ${pats}, ${level === 3 ? "True, True" : "False, False"})`, limit_s: 8 });

  return {
    vars: {
      glob_rule: level === 1
        ? "Patterns in this exercise use only `*` and `?`, and every pattern is an include pattern."
        : level === 2
          ? "`**` matches any sequence of characters, including `/` (and the empty sequence); the characters around it are ordinary, so `in/**/x.gz` matches `in/a/x.gz` but not `in/x.gz`. A pattern starting with `!` is an exclude pattern: a file matching any exclude pattern is not selected, even if an include pattern matches it."
          : "`**` matches any sequence of characters including `/` (and the empty sequence), with the characters around it ordinary. `[abc]` and ranges such as `[0-9]` match one character in the set, `[!abc]` one character not in it; a class never matches `/`. A pattern starting with `!` is an exclude pattern, and exclusion wins.",
      history_rule: level === 3
        ? "A record's `status` is `LOADED` or `LOAD_FAILED`. A remembered failed load makes the path's status known but does not count as loaded. When `load_uncertain` is True, files that would be `SKIP_UNCERTAIN` are `LOAD` instead."
        : "Every record in this exercise has `status = 'LOADED'`, and `load_uncertain` is always False (keep the parameter).",
    },
    samples,
    tests,
  };
}
