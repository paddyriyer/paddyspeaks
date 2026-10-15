/* WMT-L2-01 — Frequently bought together: item pairs in at least s baskets (Python).
   Simulated practice scenario. All data is generated from the seed.

   Contract (python): entry, signature, starter, prelude, generate(r, level) ->
     { vars, samples: [{args, expect}], tests: [{name, args, expect?, limit_s?}] }.
   expect comes from oracle() below: for every pair of distinct items in the
   catalogue, scan every basket for both (the slow, obviously correct way). The
   evaluator's reference counts the pairs inside each basket, written independently.
   level: 1 Medium (distinct items per basket) · 2 Hard (+ the same item scanned
          twice, empty and one-item baskets) · 3 Very Hard (+ max_items: bulk
          baskets with too many distinct items are left out) */
export const kind = "python";
export const entry = "frequent_pairs";
export const signature = "def frequent_pairs(baskets: list[list[str]], s: int, max_items: int | None = None) -> list[tuple[str, str, int]]:";
export const starter = `def frequent_pairs(baskets, s, max_items=None):
    """baskets: one list of item names per basket (a register transaction or
    an online order). An item may be listed more than once in a basket.
    s: the minimum number of baskets a pair must appear in.
    max_items: None, or the largest number of distinct items a basket may
    have to be counted at all.
    Return [(a, b, count), ...] with a < b, for every pair of distinct items
    found together in at least s baskets, ordered by count descending, then
    a, then b."""
    ...
`;

export const prelude = `
def _gen_baskets(n, n_items, seed, huge=0):
    x = seed
    out = []
    for i in range(n):
        x = (1103515245 * x + 12345) % 2147483648
        size = 1 + (x >> 16) % 8
        b = []
        if (x >> 8) % 4 == 0:
            k = (x >> 10) % 60
            b.extend(('IT%05d' % (7 * k + 1), 'IT%05d' % (7 * k + 4)))
        for _ in range(size):
            x = (1103515245 * x + 12345) % 2147483648
            b.append('IT%05d' % ((x >> 8) % n_items))
        out.append(b)
    for h in range(huge):
        b = ['IT%05d' % ((h * 31 + j) % n_items) for j in range(4000)]
        out.insert((h * 7919) % len(out), b)
    return out
`.trim() + "\n";

const ITEMS = ["bananas", "milk", "bread", "eggs", "tortilla chips", "salsa", "ground coffee", "creamer", "pasta",
  "pasta sauce", "parmesan", "hot dogs", "buns", "ketchup", "charcoal", "diapers", "baby wipes", "paper towels",
  "dish soap", "cereal", "peanut butter", "jelly", "lemons", "avocados"];

// Brute force over every pair of catalogue items: count the baskets holding both.
export function oracle(baskets, s, maxItems) {
  const sets = baskets.map((b) => new Set(b)).filter((st) => maxItems == null || st.size <= maxItems);
  const all = [...new Set(baskets.flat())].sort();
  const out = [];
  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      let c = 0;
      for (const st of sets) if (st.has(all[i]) && st.has(all[j])) c++;
      if (c >= s) out.push([all[i], all[j], c]);
    }
  }
  out.sort((x, y) => y[2] - x[2] || (x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : x[1] < y[1] ? -1 : x[1] > y[1] ? 1 : 0));
  return out;
}

const q = (s) => "'" + s + "'";
const pyOut = (rows) => "[" + rows.map(([a, b, c]) => `(${q(a)}, ${q(b)}, ${c})`).join(", ") + "]";
const pyArgs = (baskets, s, maxItems) =>
  `([${baskets.map((b) => "[" + b.map(q).join(", ") + "]").join(", ")}], ${s}, ${maxItems == null ? "None" : maxItems})`;

function smallCase(r, level) {
  const items = r.sample(ITEMS, level === 1 ? 8 : 10);
  const [x1, x2, y1, y2] = items;            // two pairs that are often bought together
  const n = level === 1 ? r.int(8, 11) : r.int(10, 14);
  const s = r.int(2, 3);
  const baskets = [];
  for (let i = 0; i < n; i++) {
    const b = r.sample(items.slice(4), r.int(level === 1 ? 1 : 0, 3));
    if (i < s + 1 || r.chance(0.25)) b.push(x1, x2);
    if (r.chance(0.35)) b.push(y1, y2);
    if (level >= 2 && b.length && r.chance(0.3)) b.push(r.pick(b));    // scanned twice
    baskets.push(r.shuffle(b));
  }
  let maxItems = null;
  if (level === 3) {
    maxItems = r.int(4, 5);
    const bulk = r.shuffle([x1, x2, y1, y2, ...r.sample(items.slice(4), maxItems)]);   // too many distinct items
    baskets.splice(r.int(0, baskets.length), 0, bulk);
  }
  return { baskets: r.shuffle(baskets), s, maxItems };
}

export function generate(r, level) {
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const c = smallCase(r, level);
    samples.push({ args: pyArgs(c.baskets, c.s, c.maxItems), expect: pyOut(oracle(c.baskets, c.s, c.maxItems)) });
  }
  const tests = samples.map((t, i) => ({ name: "sample " + (i + 1), args: t.args, expect: t.expect }));

  const [a, b, c, d, e] = r.sample(ITEMS, 5);
  const k = r.int(2, 4);
  const [lo, hi] = [a, b].sort();
  const rep = (basket, times) => Array.from({ length: times }, () => basket.slice());
  const edges = [
    ["a pair in exactly s baskets is reported", [...rep([a, b], k), [c]], k, null],
    ["a pair in s - 1 baskets is not reported", [...rep([a, b], k - 1), [a, c], [b, d]], k, null],
    ["the pair is named in name order, whatever the scan order", [[hi, lo], [hi, c, lo], [c, d]], 2, null],
    ["ties in count are ordered by the first item, then the second", [[a, b, c, d], [a, b, c, d], [d, e], [d, e]], 2, null],
    ["s = 1 reports every pair that appears at all", [[a, b, c], [d]], 1, null],
    ["the same item scanned twice counts once, and never pairs with itself", [[a, a, b], [a, b, b], [c, c]], 2, null],
    ["empty and one-item baskets add nothing", [[], [a], [a, b], [], [b]], 1, null],
    ["no pair reaches s: an empty list", [[a, b], [c, d], [a, c]], 2, null],
  ];
  if (level === 3) {
    edges.push(["a basket with exactly max_items distinct items is counted", [[a, b, c], [a, b]], 2, 3]);
    edges.push(["a basket with one more than max_items distinct items is left out", [[a, b, c, d], [a, b]], 2, 3]);
    edges.push(["repeats do not push a basket over max_items", [[a, b, a, b, c, c], [a, b]], 2, 3]);
  }
  for (const [name, bs, s, mx] of edges) tests.push({ name, args: pyArgs(bs, s, mx), expect: pyOut(oracle(bs, s, mx)) });

  // Timing. Counting pairs inside each basket touches about 650 000 pairs. Intersecting
  // per-item basket sets for every pair of frequent items is millions of intersections.
  const seed = r.int(1, 1_000_000);
  const [n, items, s] = level === 1 ? [40000, 4000, 15] : [50000, 5000, 20];
  tests.push(level === 3
    ? { name: `${n.toLocaleString("en-US")} baskets with 30 bulk baskets of 4,000 items, max_items 40`, args: `(_gen_baskets(${n}, ${items}, ${seed}, 30), ${s}, 40)`, limit_s: 8 }
    : { name: `${n.toLocaleString("en-US")} baskets over ${items.toLocaleString("en-US")} items`, args: `(_gen_baskets(${n}, ${items}, ${seed}), ${s}, None)`, limit_s: 8 });

  return {
    vars: {
      basket_rule: level === 1
        ? "In this replay each basket lists each item once; the checks also include baskets where an item is listed twice."
        : "In this replay some baskets list the same item twice (two scans of one item), and some baskets are empty or hold a single item.",
      bulk_rule: level === 3
        ? "Here `max_items` is set: a basket with more than `max_items` distinct items (a bulk or business purchase) is left out entirely, before any pair in it is counted."
        : "In this replay `max_items` is `None`, so every basket counts; your function must still accept the argument.",
    },
    samples,
    tests,
  };
}
