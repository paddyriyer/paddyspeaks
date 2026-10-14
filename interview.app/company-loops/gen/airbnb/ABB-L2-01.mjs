/* ABB-L2-01 — Split stays: two listings that cover one date range with one move (Python).
   Simulated practice scenario. All data is generated from the seed.

   Contract (python): entry, signature, starter, prelude, generate(r, level) ->
     { vars, samples: [{args, expect}], tests: [{name, args, expect?, limit_s?}] }.
   expect comes from oracle() below: every ordered pair of listings and every
   possible move night, checked night by night. The evaluator's reference counts
   intersecting intervals of move nights from free-run arrays, so each checks the other.
   level: 1 Medium (calendars only) · 2 Hard (+ per-listing minimum stay and guest
          capacity) · 3 Very Hard (+ a listing that could host the whole stay alone is
          never part of a split stay) */
export const kind = "python";
export const entry = "split_stays";
export const signature = "def split_stays(calendars: dict[str, str], queries: list[tuple[int, int, int]], min_nights: dict[str, int] | None = None, capacity: dict[str, int] | None = None, exclude_whole: bool = False) -> list[int]:";
export const starter = `def split_stays(calendars, queries, min_nights=None, capacity=None, exclude_whole=False):
    """calendars: listing id -> one character per night ('.' free, 'b' booked,
    'x' blocked by the host), all the same length.
    queries: (check_in, check_out, guests), nights check_in .. check_out - 1.
    Return, per query, the number of ordered pairs (first, second) of different
    listings that can host the stay with exactly one move."""
    ...
`;

export const prelude = `
def _gen_calendars(n, h, seed):
    x, out = seed, {}
    for i in range(n):
        cells, t = [], 0
        while t < h:
            x = (1103515245 * x + 12345) % 2147483648
            run = 1 + (x >> 8) % 9
            x = (1103515245 * x + 12345) % 2147483648
            k = (x >> 16) % 10
            c = '.' if k < 6 else ('b' if k < 9 else 'x')
            cells.append(c * run)
            t += run
        out['L%05d' % i] = ''.join(cells)[:h]
    return out


def _gen_mins(n, seed):
    x, out = seed, {}
    for i in range(n):
        x = (1103515245 * x + 12345) % 2147483648
        out['L%05d' % i] = 1 + (x >> 8) % 4
    return out


def _gen_caps(n, seed):
    x, out = seed, {}
    for i in range(n):
        x = (1103515245 * x + 12345) % 2147483648
        out['L%05d' % i] = 1 + (x >> 8) % 8
    return out


def _gen_split_queries(q, h, seed):
    x, out = seed, []
    for _ in range(q):
        x = (1103515245 * x + 12345) % 2147483648
        d = 2 + (x >> 8) % 12
        x = (1103515245 * x + 12345) % 2147483648
        ci = (x >> 8) % (h - d + 1)
        x = (1103515245 * x + 12345) % 2147483648
        out.append((ci, ci + d, 1 + (x >> 8) % 4))
    return out
`.trim() + "\n";

// Every ordered pair, every move night, every night checked. Small inputs only.
export function oracle(calendars, queries, minNights, capacity, excludeWhole) {
  const ids = Object.keys(calendars);
  const free = (id, a, b) => { for (let t = a; t < b; t++) if (calendars[id][t] !== ".") return false; return true; };
  const minOf = (id) => (minNights ? minNights[id] : 1);
  return queries.map(([ci, co, guests]) => {
    const d = co - ci;
    const usable = ids.filter((id) => {
      if (capacity && capacity[id] < guests) return false;
      if (excludeWhole && free(id, ci, co) && minOf(id) <= d) return false;   // could host alone
      return true;
    });
    let count = 0;
    for (const a of usable) for (const b of usable) {
      if (a === b) continue;
      for (let k = ci + 1; k < co; k++) {
        if (k - ci >= minOf(a) && co - k >= minOf(b) && free(a, ci, k) && free(b, k, co)) { count++; break; }
      }
    }
    return count;
  });
}

const pyStr = (s) => "'" + s + "'";
const pyDict = (o, f) => "{" + Object.entries(o).map(([k, v]) => `${pyStr(k)}: ${f(v)}`).join(", ") + "}";
const pyArgs = (c) =>
  `(${pyDict(c.cal, pyStr)}, [${c.q.map(([a, b, g]) => `(${a}, ${b}, ${g})`).join(", ")}], ` +
  `${c.mins ? pyDict(c.mins, String) : "None"}, ${c.caps ? pyDict(c.caps, String) : "None"}, ${c.excl ? "True" : "False"})`;
const run = (c) => oracle(c.cal, c.q, c.mins, c.caps, c.excl);
const pyOut = (xs) => "[" + xs.join(", ") + "]";

function randomCalendar(r, h) {
  let s = "";
  while (s.length < h) {
    const roll = r.next();
    s += (roll < 0.62 ? "." : roll < 0.9 ? "b" : "x").repeat(r.int(1, 5));
  }
  return s.slice(0, h);
}

function randomCase(r, level, names) {
  for (let attempt = 0; attempt < 80; attempt++) {
    const h = r.int(12, 18);
    const n = r.int(4, 7);
    const cal = {};
    for (const id of names.slice(0, n)) cal[id] = randomCalendar(r, h);
    const q = [];
    for (let i = r.int(3, 5); i > 0; i--) {
      const d = r.int(2, 7), ci = r.int(0, h - d);
      q.push([ci, ci + d, r.int(1, 4)]);
    }
    const c = { cal, q, mins: null, caps: null, excl: level === 3 };
    if (level >= 2) {
      c.mins = Object.fromEntries(Object.keys(cal).map((id) => [id, r.pick([1, 1, 2, 2, 3])]));
      c.caps = Object.fromEntries(Object.keys(cal).map((id) => [id, r.int(1, 6)]));
    }
    const got = run(c);
    if (got.filter((x) => x > 0).length >= 2) return c;
  }
  throw new Error("ABB-L2-01: could not build a sample with split stays");
}

export function generate(r, level) {
  const pool = r.shuffle(["lst_" + r.int(1000, 4999), "lst_" + r.int(5000, 9999), "cabin_" + r.int(10, 99), "loft_" + r.int(10, 99),
    "flat_" + r.int(100, 499), "flat_" + r.int(500, 999), "villa_" + r.int(10, 99), "studio_" + r.int(10, 99)]);
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const c = randomCase(r, level, pool);
    samples.push({ args: pyArgs(c), expect: pyOut(run(c)) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const [A, B, C, D] = pool;
  const h = 10;
  const cal = (spec) => spec;                   // a readable alias for the hand-built calendars
  const all = (ids, v) => Object.fromEntries(ids.map((id) => [id, v]));
  const x = r.int(3, 5);                         // nights in the first listing for the meeting case
  const edges = [
    ["a one-night stay cannot be split",
      { cal: { [A]: ".".repeat(h), [B]: ".".repeat(h) }, q: [[4, 5, 1]] }],
    ["the two halves meet on the move night",
      { cal: { [A]: ".".repeat(x) + "b".repeat(h - x), [B]: "b".repeat(x) + ".".repeat(h - x) }, q: [[0, x + 3, 2]] }],
    ["a night that neither listing has breaks the split",
      { cal: { [A]: ".".repeat(x) + "b".repeat(h - x), [B]: "b".repeat(x + 1) + ".".repeat(h - x - 1) }, q: [[0, x + 3, 2]] }],
    ["a listing never pairs with itself",
      { cal: { [A]: ".".repeat(h), [B]: "b".repeat(h) }, q: [[1, 6, 1]] }],
    [level === 3 ? "two listings free for the whole stay are not offered as a split" : "two listings free for the whole stay pair both ways",
      { cal: { [A]: ".".repeat(h), [B]: "x" + ".".repeat(h - 1) }, q: [[2, 7, 1]] }],
    ["a stay that needs two moves is not a split stay",
      { cal: { [A]: cal("...bbbbbbb"), [B]: cal("bb...bbbbb"), [C]: cal("bbbb......") }, q: [[0, 7, 1]] }],
    ["the stay may start on the first night and end on the last night of the calendar",
      { cal: { [A]: cal("......bxbb"), [B]: cal("bbb......."), [C]: cal("xx........") }, q: [[0, h, 2]] }],
    ["booked and host-blocked nights are both unavailable",
      { cal: { [A]: cal("...x......"), [B]: cal("bbb......."), [C]: cal("....b.....") }, q: [[0, 6, 1], [3, 9, 1]] }],
    ["a query with no listing available returns 0, not an error",
      { cal: { [A]: "b".repeat(h), [B]: "x".repeat(h) }, q: [[0, 4, 1], [5, 9, 3]] }],
  ];
  if (level >= 2) {
    const m = r.int(3, 4);
    const half = { [A]: ".".repeat(m) + "b".repeat(h - m), [B]: "b".repeat(m) + ".".repeat(h - m) };
    edges.push(["a half of exactly the listing's minimum stay is allowed",
      { cal: half, q: [[0, m + 3, 1]], mins: { [A]: m, [B]: 1 }, caps: all([A, B], 4) }]);
    edges.push(["a half one night shorter than the minimum stay is not",
      { cal: half, q: [[0, m + 3, 1]], mins: { [A]: m + 1, [B]: 1 }, caps: all([A, B], 4) }]);
    edges.push(["the minimum stay applies to the second listing too",
      { cal: half, q: [[0, m + 2, 1], [0, m + 3, 1]], mins: { [A]: 1, [B]: 3 }, caps: all([A, B], 4) }]);
    edges.push(["the latest possible move night breaks the second listing's minimum stay, an earlier one works",
      { cal: { [A]: "........bb", [B]: "b" + ".".repeat(h - 1), [C]: "bbbbb" + ".".repeat(h - 5) }, q: [[0, 9, 1]],
        mins: { [A]: 5, [B]: 2, [C]: 3 }, caps: all([A, B, C], 4) }]);
    edges.push(["guests exactly at capacity fit, one more does not",
      { cal: half, q: [[0, m + 3, 3], [0, m + 3, 4]], mins: all([A, B], 1), caps: { [A]: 3, [B]: 6 } }]);
  }
  if (level === 3) {
    edges.push(["a listing that could host the whole stay alone is left out of every pair",
      { cal: { [A]: ".".repeat(h), [B]: "....bbbbbb", [C]: "bbbb......" }, q: [[0, 8, 1]], mins: all([A, B, C], 1), caps: all([A, B, C], 4) }]);
    edges.push(["a listing free for the whole stay but too small for the guests cannot host it alone, and cannot be a half either",
      { cal: { [A]: ".".repeat(h), [B]: "....bbbbbb", [C]: "bbbb......" }, q: [[0, 8, 3]], mins: all([A, B, C], 1), caps: { [A]: 2, [B]: 4, [C]: 4 } }]);
    edges.push(["a listing free for the whole stay whose minimum stay is longer than the stay is not a whole-stay host",
      { cal: { [A]: ".".repeat(h), [B]: "....bbbbbb", [C]: "bbbb......", [D]: "bbbbbbb..." }, q: [[0, 8, 1], [2, 9, 1]],
        mins: { [A]: 9, [B]: 1, [C]: 1, [D]: 1 }, caps: all([A, B, C, D], 4) }]);
    edges.push(["whole-stay hosts are decided per query",
      { cal: { [A]: "......bbbb", [B]: "bbbbbb....", [C]: "..........".slice(0, 3) + "bbbbbbb" }, q: [[0, 6, 1], [0, 8, 1], [3, 10, 1]],
        mins: all([A, B, C], 1), caps: all([A, B, C], 4) }]);
  }
  for (const [name, c] of edges) {
    c.excl = level === 3;
    if (level === 1) { c.mins = null; c.caps = null; }
    else {
      if (!c.mins) c.mins = all(Object.keys(c.cal), 1);
      if (!c.caps) c.caps = all(Object.keys(c.cal), 8);
    }
    tests.push({ name, args: pyArgs(c), expect: pyOut(run(c)) });
  }

  // Timing: compared with the reference at check time. All pairs is 9 million
  // pairs per query; intervals of move nights make each query O(n log n).
  const n = 3000, H = 180, q = 200;
  const seed = r.int(1, 1_000_000);
  const extra = level === 1 ? "None, None, False"
    : `_gen_mins(${n}, ${seed + 2}), _gen_caps(${n}, ${seed + 3}), ${level === 3 ? "True" : "False"}`;
  tests.push({
    name: `${n.toLocaleString("en-US")} listings, ${H} nights and ${q} searches in time`,
    args: `(_gen_calendars(${n}, ${H}, ${seed}), _gen_split_queries(${q}, ${H}, ${seed + 1}), ${extra})`,
    limit_s: 8,
  });

  return {
    vars: {
      min_rule: level === 1
        ? "In this exercise `min_nights` and `capacity` are None: every listing accepts a stay of one night or more, for any number of guests."
        : "`min_nights` maps every listing to its minimum stay: each half of a split stay must be at least that listing's minimum. `capacity` maps every listing to the most guests it hosts: both listings must hold the query's guests.",
      whole_rule: level === 3
        ? "`exclude_whole` is True: a listing that could host the whole stay on its own (free every night of it, a minimum stay no longer than the stay, and room for the guests) is not part of any split stay for that query."
        : "`exclude_whole` is False: a listing that could host the whole stay alone may still be one half of a split stay.",
    },
    samples,
    tests,
  };
}
