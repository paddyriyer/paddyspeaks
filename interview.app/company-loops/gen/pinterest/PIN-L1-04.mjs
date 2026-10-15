/* PIN-L1-04 — Distinct pinners who saved a pin over many date ranges (Python).
   Simulated practice scenario. All data is generated from the seed; pins, pinners and days are
   hypothetical opaque ids and numbers.

   Contract (python): entry, signature, starter, prelude, generate(r, level) ->
     { vars, samples: [{args, expect}], tests: [{name, args, expect?, limit_s?}] }.
   expect comes from oracle() below: a set of pinners built for every query from every save
   (brute force, small inputs only). The evaluator's reference answers the queries offline,
   sorted by last day, with a Fenwick tree over each pinner's latest save day; written
   independently.
   level: 1 Medium (one pin, saves sorted by day)
          · 2 Hard (+ saves in any order, a pinner saving many times on one day, ranges with
            first_day > last_day and ranges outside the data, both 0)
          · 3 Very Hard (+ many pins in one call, queries for pins with no saves) */
export const kind = "python";
export const entry = "distinct_savers";
export const signature = "def distinct_savers(saves: list[tuple[str, int, str]], queries: list[tuple[str, int, int]]) -> list[int]:";
export const starter = `def distinct_savers(saves, queries):
    """saves: (pin_id, day, pinner_id), one row per save.
    queries: (pin_id, first_day, last_day), both days inclusive.
    Return, for each query in order, how many distinct pinners saved that pin
    on a day from first_day to last_day."""
    ...
`;

export const prelude = `
def _gen_saves(n_saves, n_queries, n_days, n_pinners, seed, n_pins=1, shuffle=False):
    x = seed
    def rnd(m):
        nonlocal x
        x = (1103515245 * x + 12345) % 2147483648
        return (x >> 16) % m
    pins = ['pin_%d' % (7000 + 13 * k) for k in range(n_pins)]
    saves = []
    for _ in range(n_saves):
        p = pins[0] if n_pins == 1 or rnd(8) else pins[rnd(n_pins)]   # one evergreen pin gets most saves
        saves.append((p, rnd(n_days), 'u_%d' % rnd(n_pinners)))
    if not shuffle:
        saves.sort(key=lambda s: s[1])
    queries = []
    for _ in range(n_queries):
        a = rnd(n_days)
        b = a + rnd(n_days - a)
        p = pins[0] if n_pins == 1 or rnd(8) else pins[rnd(n_pins)]
        queries.append((p, a, b))
    return saves, queries
`.trim() + "\n";

// The specification, directly: for each query, the set of pinners with a save of that pin
// on a day in [first_day, last_day].
export function oracle(saves, queries) {
  return queries.map(([pin, a, b]) => {
    const s = new Set();
    for (const [p, d, u] of saves) if (p === pin && d >= a && d <= b) s.add(u);
    return s.size;
  });
}

const pyList = (xs) => "[" + xs.join(", ") + "]";
const pyArgs = (saves, queries) =>
  `([${saves.map(([p, d, u]) => `('${p}', ${d}, '${u}')`).join(", ")}], [${queries.map(([p, a, b]) => `('${p}', ${a}, ${b})`).join(", ")}])`;

function randomCase(r, level, pins) {
  const nDays = r.int(12, 30);
  const pinners = Array.from({ length: r.int(4, 7) }, (_, i) => "u_" + (100 + 7 * i + r.int(0, 6)));
  const saves = [];
  const n = r.int(10, 18) + 4 * (level - 1);
  for (let i = 0; i < n; i++) saves.push([level === 3 ? r.pick(pins) : pins[0], r.int(0, nDays), r.pick(pinners)]);
  if (level === 1) saves.sort((x, y) => x[1] - y[1]);
  const queries = [];
  for (let i = 0; i < r.int(5, 8); i++) {
    const a = r.int(0, nDays), b = r.int(a, nDays);
    const pin = level === 3 ? r.pick(pins.concat(["pin_unsaved"])) : pins[0];
    queries.push(level === 2 && r.chance(0.15) ? [pin, b + 1, a] : [pin, a, b]);
  }
  return { saves, queries };
}

export function generate(r, level) {
  const pins = r.sample(["pin_1042", "pin_2219", "pin_3307", "pin_4480", "pin_5126"], 3);
  const P = pins[0], Q = pins[1];
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const c = randomCase(r, level, pins);
    samples.push({ args: pyArgs(c.saves, c.queries), expect: pyList(oracle(c.saves, c.queries)) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const [A, B, C] = ["u_" + r.int(100, 199), "u_" + r.int(200, 299), "u_" + r.int(300, 399)];
  const d = r.int(5, 40);
  const edges = [
    ["a pinner who saves twice in the range counts once",
      [[P, d, A], [P, d + 2, A], [P, d + 3, B]], [[P, d, d + 3]]],
    ["both ends of the range are inclusive",
      [[P, d, A], [P, d + 4, B], [P, d + 5, C]], [[P, d, d + 4], [P, d + 1, d + 4], [P, d, d + 3]]],
    ["a one-day range",
      [[P, d, A], [P, d, B], [P, d + 1, C]], [[P, d, d], [P, d + 1, d + 1]]],
    ["a range between saves has no savers",
      [[P, d, A], [P, d + 10, B]], [[P, d + 1, d + 9]]],
    ["a pinner's earlier save inside the range still counts when a later one is outside",
      [[P, d, A], [P, d + 3, B], [P, d + 8, A]], [[P, d, d + 5], [P, d + 2, d + 5], [P, d + 2, d + 8]]],
    ["the same ranges asked twice, in any order",
      [[P, d, A], [P, d + 1, B], [P, d + 2, A], [P, d + 3, C]], [[P, d + 1, d + 3], [P, d, d + 1], [P, d + 1, d + 3], [P, d, d + 3]]],
  ];
  if (level >= 2) {
    edges.push(["saves in any order", [[P, d + 6, C], [P, d, A], [P, d + 3, B], [P, d + 1, A]], [[P, d, d + 2], [P, d + 1, d + 6]]]);
    edges.push(["many saves by one pinner on one day", [[P, d, A], [P, d, A], [P, d, A], [P, d, B]], [[P, d, d], [P, d - 1, d + 1]]]);
    edges.push(["first_day after last_day is an empty range: 0", [[P, d, A], [P, d + 1, B]], [[P, d + 1, d], [P, d, d + 1]]]);
    edges.push(["a range entirely before or after the data: 0", [[P, d, A], [P, d + 1, B]], [[P, 0, d - 1], [P, d + 2, d + 50]]]);
  }
  if (level === 3) {
    edges.push(["one pinner saving two pins counts once for each pin", [[P, d, A], [Q, d, A], [Q, d + 1, B]], [[P, d, d + 1], [Q, d, d + 1]]]);
    edges.push(["a pin with no saves: 0", [[P, d, A]], [["pin_unsaved", 0, 100], [P, 0, 100]]]);
    edges.push(["queries for different pins interleaved", [[P, d, A], [Q, d + 1, B], [P, d + 2, C], [Q, d + 3, A]], [[Q, d, d + 3], [P, d, d + 3], [Q, d + 2, d + 3], [P, d + 1, d + 1]]]);
  }
  for (const [name, saves, queries] of edges) tests.push({ name, args: pyArgs(saves, queries), expect: pyList(oracle(saves, queries)) });

  // Timing: 200 000 saves over 3 000 days and 50 000 ranges averaging a third of the data.
  // Offline Fenwick is O((n + q) log n); a set per range is O(q · len) and takes minutes.
  const seed = r.int(1, 1_000_000);
  tests.push({
    name: "200,000 saves, 50,000 ranges (offline with a Fenwick tree, not a set per range)",
    args: level === 1 ? `_gen_saves(200000, 50000, 3000, 50000, ${seed})`
      : level === 2 ? `_gen_saves(200000, 50000, 3000, 50000, ${seed}, 1, True)`
        : `_gen_saves(200000, 50000, 3000, 50000, ${seed}, 40, True)`,
    limit_s: 8,
  });

  return {
    vars: {
      order_rule: level === 1
        ? "In this exercise every save is for the same pin and `saves` is sorted by day."
        : level === 2
          ? "Every save is for the same pin, but `saves` arrives in any order and a pinner can save the pin many times on one day. A query with `first_day > last_day` is an empty range: return 0 for it."
          : "`saves` mixes many pins and arrives in any order. A pinner who saved two pins counts for each pin separately. A query for a pin with no saves, or with `first_day > last_day`, returns 0.",
    },
    samples,
    tests,
  };
}
