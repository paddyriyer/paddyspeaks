/* GOO-L1-05 — Autocomplete suggestions from a sharded query log (Python).
   Simulated practice scenario. All data is generated from the seed.

   Contract: see docs/COMPANY-INTERVIEW-LOOPS.md § Executable templates (python).
   level: 1 Medium (sum counts across shards, top k per prefix by count then text)
          2 Hard (+ raw query text to normalise before summing; prefixes ending in a space)
          3 Very Hard (+ blocked words: drop any query containing one as a whole word) */
export const kind = "python";
export const entry = "suggest";
export const signature = "def suggest(entries: list[tuple[str, int]], prefixes: list[str], k: int, blocked: set[str] | None = None) -> list[list[str]]:";
export const starter = `def suggest(entries, prefixes, k, blocked=None):
    """entries: (query_text, searches) rows from several shards; a query can appear in many rows.
    prefixes: what users have typed so far (already lowercase and normalised).
    Return, for each prefix in order, up to k suggestions: normalised queries that start
    with the prefix, by total searches descending, then alphabetically."""
    ...
`;

export const prelude = `
_SYL = ['ka', 'lo', 'mi', 'ne', 'ru', 'sa', 'ti', 'vo', 'be', 'da', 'fi', 'go', 'hu', 'je', 'pa', 'zu', 'el', 'or', 'an', 'ys']


def _vocab(n_words=400):
    return [_SYL[i % 20] + _SYL[(i // 20) % 20] + ('' if i % 3 else _SYL[(i * 7 + 3) % 20]) for i in range(n_words)]


def _gen_case(n, m, seed, messy=False):
    words = _vocab()
    x, entries = seed, []
    for _ in range(n):
        x = (1103515245 * x + 12345) % 2147483648
        nw = 1 + (x >> 16) % 3
        parts = []
        for _ in range(nw):
            x = (1103515245 * x + 12345) % 2147483648
            a = (x >> 16) % len(words)
            x = (1103515245 * x + 12345) % 2147483648
            b = (x >> 16) % len(words)
            parts.append(words[min(a, b)])
        x = (1103515245 * x + 12345) % 2147483648
        text = ' '.join(parts)
        if messy and (x >> 16) % 4 == 0:
            text = '  ' + text.upper().replace(' ', '   ') + ' '
        entries.append((text, 1 + (x >> 20) % 50))
    prefixes = []
    for _ in range(m):
        x = (1103515245 * x + 12345) % 2147483648
        t = ' '.join(entries[(x >> 4) % n][0].lower().split())
        x = (1103515245 * x + 12345) % 2147483648
        prefixes.append(t[:1 + (x >> 16) % 8])
    return entries, prefixes
`.trim() + "\n";

const norm = (s) => s.toLowerCase().split(" ").filter((w) => w.length).join(" ");

// Independent oracle: brute force over every query for every prefix.
export function oracle(entries, prefixes, k, blocked) {
  const tot = new Map();
  for (const [text, n] of entries) {
    const q = norm(text);
    tot.set(q, (tot.get(q) || 0) + n);
  }
  const ok = [...tot.keys()].filter((q) => !blocked || !q.split(" ").some((w) => blocked.includes(w)));
  return prefixes.map((p) =>
    ok.filter((q) => q.startsWith(p))
      .sort((a, b) => tot.get(b) - tot.get(a) || (a < b ? -1 : a > b ? 1 : 0))
      .slice(0, k));
}

const pyStr = (s) => "'" + s.replace(/\\/g, "\\\\").replace(/'/g, "\\'") + "'";
const pyResult = (res) => "[" + res.map((l) => "[" + l.map(pyStr).join(", ") + "]").join(", ") + "]";
const pyArgs = (entries, prefixes, k, blocked) =>
  `([${entries.map(([t, n]) => `(${pyStr(t)}, ${n})`).join(", ")}], [${prefixes.map(pyStr).join(", ")}], ${k}, ${blocked ? "{" + blocked.map(pyStr).join(", ") + "}" : "None"})`;

const POOL = ["near me", "nest box", "neural network", "new year", "new york", "new york weather", "newton laws", "news today",
  "pi digits", "pie crust", "pine tree", "pizza", "pizza dough", "pizza near me", "doughnut shop", "python list", "pyramids"];

function messy(r, q) {
  const k = r.int(0, 4);
  if (k === 1) return q.toUpperCase();
  if (k === 2) return "  " + q;
  if (k === 3) return q.replace(" ", "   ") + " ";
  if (k === 4) return q.charAt(0).toUpperCase() + q.slice(1);
  return q;
}

function smallCase(r, level) {
  const qs = r.sample(POOL, r.int(6, 9));
  const entries = [];
  const n = r.int(8, 14);
  for (let i = 0; i < n; i++) {
    const q = r.pick(qs);
    entries.push([level >= 2 ? messy(r, q) : q, r.int(1, 30)]);
  }
  const prefixes = [];
  const m = r.int(3, 5);
  for (let i = 0; i < m; i++) {
    const kind = r.int(0, 9);
    if (kind === 0) prefixes.push("");
    else if (kind === 1) prefixes.push("zz");
    else if (kind === 2 && level >= 2) prefixes.push(r.pick(["new ", "pi", "pizza ", "ne"]));
    else { const q = r.pick(qs); prefixes.push(q.slice(0, r.int(1, Math.min(6, q.length)))); }
  }
  let blocked = null;
  if (level === 3) {
    const words = [...new Set(qs.flatMap((q) => q.split(" ")))];
    blocked = r.sample(words, 2).sort();
  }
  return { entries, prefixes, k: r.pick([2, 3]), blocked };
}

export function generate(r, level) {
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const c = smallCase(r, level);
    samples.push({ args: pyArgs(c.entries, c.prefixes, c.k, c.blocked), expect: pyResult(oracle(c.entries, c.prefixes, c.k, c.blocked)) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const a = r.int(2, 9), b = r.int(2, 9);
  const edges = [
    ["a prefix nothing starts with", [["news today", a], ["near me", b]], ["zq"], 3, null],
    ["the empty prefix returns the overall top k", [["pizza", a], ["news today", a + 1], ["pine tree", b]], [""], 2, null],
    ["a query equal to the prefix is a suggestion", [["pizza", a], ["pizza dough", a + 1]], ["pizza"], 5, null],
    ["counts are summed across shards before ranking", [["news today", a], ["new york", a + b], ["news today", b + 1]], ["new"], 1, null],
    ["equal totals are ordered alphabetically", [["pine tree", a], ["pie crust", a], ["pizza", a]], ["pi"], 2, null],
    ["the same prefix twice is answered twice", [["near me", a], ["nest box", b]], ["ne", "ne"], 1, null],
  ];
  if (level >= 2) {
    edges.push(["case and spacing variants are one query", [["New  York", a], [" new york ", b], ["news today", a + b - 1]], ["new"], 1, null]);
    edges.push(["a trailing space in the prefix is part of it", [["new york", a], ["news today", a + 5], ["new year", b]], ["new "], 3, null]);
  }
  if (level === 3) {
    edges.push(["a blocked word removes the whole query", [["pizza dough", a + 9], ["pizza", a], ["pizza near me", b]], ["pizza"], 3, ["dough"]]);
    edges.push(["a blocked word inside another word does not", [["doughnut shop", a], ["pizza dough", b]], ["d", "p"], 2, ["dough"]]);
  }
  for (const [name, e, p, k, bl] of edges) tests.push({ name, args: pyArgs(e, p, k, bl), expect: pyResult(oracle(e, p, k, bl)) });

  // Timing: ~200 000 log rows, ~100 000 distinct queries, 50 000 prefixes. Scanning every
  // query per prefix is ~5·10⁹ comparisons; one ranked pass that fills each wanted prefix is linear.
  const seed = r.int(1, 1_000_000);
  const blockedArg = level === 3 ? "set(_vocab()[3:400:37])" : "None";
  tests.push({
    name: "200,000 log rows and 50,000 prefixes in time",
    args: `(*_gen_case(200000, 50000, ${seed}, ${level >= 2 ? "True" : "False"}), 10, ${blockedArg})`,
    limit_s: 8,
  });

  return {
    vars: {
      text_rule: level === 1
        ? "In this round every `query_text` is already normalised."
        : "`query_text` is raw: normalise it (lowercase, no leading or trailing spaces, runs of spaces collapsed to one) before summing. Prefixes are already normalised, but a prefix can end with a space: `'new '` matches `'new york'` and not `'news today'`.",
      blocked_rule: level === 3
        ? "`blocked` is a set of words: drop every query that contains one of them as a whole word (split on spaces). A blocked word inside a longer word does not count: blocking `dough` keeps `doughnut shop`."
        : "`blocked` is None in this round.",
    },
    samples,
    tests,
  };
}
