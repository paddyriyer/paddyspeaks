/* ABB-L1-04 — Orphan nights: calendar gaps shorter than the listing's minimum stay (Python).
   Simulated practice scenario. All data is generated from the seed.

   Contract (python): entry, signature, starter, prelude, generate(r, level) ->
     { vars, samples: [{args, expect}], tests: [{name, args, expect?, limit_s?}] }.
   expect comes from oracle() below, which marks every occupied night of every listing in a
   set and walks the calendar night by night. The evaluator's reference sorts and merges
   intervals instead; the two were written independently.
   level: 1 Medium (confirmed bookings only, never overlapping; no blocks)
          2 Hard (+ cancelled bookings that neither fill nor bound a gap, unsorted input,
            listings with no bookings)
          3 Very Hard (+ host blocks that bound gaps like bookings and may overlap or touch
            bookings and each other; rows for listings not in min_stay are ignored) */
export const kind = "python";
export const entry = "orphan_gaps";
export const signature = "def orphan_gaps(min_stay: dict[str, int], bookings: list[tuple[str, int, int, str]], blocks: list[tuple[str, int, int]]) -> dict[str, list[tuple[int, int]]]:";
export const starter = `def orphan_gaps(min_stay, bookings, blocks):
    """min_stay: {listing_id: minimum nights}.
    bookings: (listing_id, check_in, check_out, status); nights check_in <= n < check_out.
    blocks: (listing_id, start, end); nights start <= n < end.
    Return {listing_id: [(gap_start, gap_end), ...]} for every listing in min_stay."""
    ...
`;

export const prelude = `
def _gen_calendar(n_listings, per_listing, seed, with_cancel=False, with_blocks=False):
    x = seed
    def rnd(m):
        nonlocal x
        x = (1103515245 * x + 12345) % 2147483648
        return (x >> 16) % m
    min_stay, bookings, blocks = {}, [], []
    for k in range(n_listings):
        lid = 'lst_%05d' % k
        min_stay[lid] = 1 + rnd(5)
        d = rnd(30)
        for _ in range(per_listing):
            d += (0, 0, 1, 1, 2, 3, 4, 6, 9)[rnd(9)]
            n = 1 + rnd(8)
            bookings.append((lid, d, d + n, 'confirmed'))
            if with_cancel and rnd(6) == 0:
                s = d + rnd(n + 3)
                bookings.append((lid, s, s + 1 + rnd(5), 'cancelled'))
            if with_blocks and rnd(7) == 0:
                s = d + n + rnd(4)
                blocks.append((lid, s, s + 1 + rnd(3)))
            d += n
    for arr in (bookings, blocks):                     # shuffle: the input is in no order
        for i in range(len(arr) - 1, 0, -1):
            j = rnd(i + 1)
            arr[i], arr[j] = arr[j], arr[i]
    return min_stay, bookings, blocks
`.trim() + "\n";

// The specification, night by night: mark every occupied night, then walk from the first
// occupied night to the last and report each free run that is shorter than the minimum.
export function oracle(minStay, bookings, blocks) {
  const out = new Map();
  for (const [lid, ms] of Object.entries(minStay)) {
    const occ = new Set();
    for (const [l, a, b, st] of bookings) if (l === lid && st === "confirmed") for (let d = a; d < b; d++) occ.add(d);
    for (const [l, a, b] of blocks) if (l === lid) for (let d = a; d < b; d++) occ.add(d);
    const gaps = [];
    if (occ.size) {
      const lo = Math.min(...occ), hi = Math.max(...occ);
      let d = lo;
      while (d <= hi) {
        if (occ.has(d)) { d++; continue; }
        const s = d;
        while (!occ.has(d)) d++;                     // hi is occupied, so this stops
        if (d - s < ms) gaps.push([s, d]);
      }
    }
    out.set(lid, gaps);
  }
  return out;
}

const pyOut = (m) => "{" + [...m.entries()].map(([id, gs]) => `'${id}': [${gs.map(([a, b]) => `(${a}, ${b})`).join(", ")}]`).join(", ") + "}";
const pyArgs = (minStay, bookings, blocks) =>
  `({${Object.entries(minStay).map(([l, n]) => `'${l}': ${n}`).join(", ")}}, ` +
  `[${bookings.map(([l, a, b, s]) => `('${l}', ${a}, ${b}, '${s}')`).join(", ")}], ` +
  `[${blocks.map(([l, a, b]) => `('${l}', ${a}, ${b})`).join(", ")}])`;

const lidOf = (r) => "lst_" + r.int(1000, 9999);

function randomCase(r, level) {
  for (let attempt = 0; attempt < 100; attempt++) {
    const n = level === 1 ? r.int(2, 3) : r.int(3, 4);
    const ids = new Set();
    while (ids.size < n) ids.add(lidOf(r));
    const minStay = {};
    for (const id of [...ids].sort()) minStay[id] = r.int(2, 5);
    const bookings = [], blocks = [];
    const lids = Object.keys(minStay);
    for (const lid of lids) {
      if (level >= 2 && lid === lids[lids.length - 1] && r.chance(0.4)) continue;   // no bookings
      let d = r.int(0, 6);
      const k = r.int(2, 5);
      for (let i = 0; i < k; i++) {
        d += r.pick([0, 1, 1, 2, 3, 4, 6]);
        const len = r.int(1, 6);
        bookings.push([lid, d, d + len, "confirmed"]);
        if (level >= 2 && r.chance(0.25)) { const s = d + r.int(-1, len + 2); bookings.push([lid, s, s + r.int(1, 4), "cancelled"]); }
        if (level === 3 && r.chance(0.3)) { const s = d + r.int(-1, len + 3); blocks.push([lid, s, s + r.int(1, 4)]); }
        d += len;
      }
    }
    if (level === 3 && r.chance(0.5)) bookings.push(["lst_0000", r.int(0, 5), r.int(6, 9), "confirmed"]);   // not in min_stay
    const bk = level === 1 ? bookings.sort((x, y) => (x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : x[1] - y[1])) : r.shuffle(bookings);
    const bl = r.shuffle(blocks);
    const got = oracle(minStay, bk, bl);
    if ([...got.values()].some((g) => g.length)) return { minStay, bookings: bk, blocks: bl, got };
  }
  throw new Error("ABB-L1-04: could not build a sample");
}

export function generate(r, level) {
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const c = randomCase(r, level);
    samples.push({ args: pyArgs(c.minStay, c.bookings, c.blocks), expect: pyOut(c.got) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const [A, B] = [lidOf(r), lidOf(r)].sort();
  const ms = r.int(3, 5);
  const d0 = r.int(0, 20);
  const edges = [
    ["a gap one night shorter than the minimum stay is orphan",
      { [A]: ms }, [[A, d0, d0 + 2, "confirmed"], [A, d0 + 2 + ms - 1, d0 + ms + 4, "confirmed"]], []],
    ["a gap exactly the minimum stay is not orphan",
      { [A]: ms }, [[A, d0, d0 + 2, "confirmed"], [A, d0 + 2 + ms, d0 + ms + 5, "confirmed"]], []],
    ["back-to-back bookings leave no gap; a one-night hole after them is orphan",
      { [A]: ms }, [[A, d0, d0 + 3, "confirmed"], [A, d0 + 3, d0 + 5, "confirmed"], [A, d0 + 6, d0 + 8, "confirmed"]], []],
    ["nights before the first and after the last booking are never orphan",
      { [A]: 30 }, [[A, d0 + 1, d0 + 2, "confirmed"]], []],
    ["a minimum stay of 1 has no orphan nights",
      { [A]: 1 }, [[A, d0, d0 + 1, "confirmed"], [A, d0 + 2, d0 + 3, "confirmed"]], []],
  ];
  if (level >= 2) {
    edges.push(["a cancelled booking neither fills nor bounds a gap",
      { [A]: ms }, [[A, d0, d0 + 2, "confirmed"], [A, d0 + 3, d0 + 4, "cancelled"], [A, d0 + 2 + ms + 2, d0 + ms + 6, "confirmed"], [A, d0 + 2 + ms + 2 + 4, d0 + ms + 10, "cancelled"]], []]);
    edges.push(["bookings arrive in no order; a listing without bookings maps to []",
      { [A]: ms, [B]: 2 }, [[A, d0 + 9, d0 + 12, "confirmed"], [A, d0, d0 + 3, "confirmed"], [A, d0 + 4, d0 + 8, "confirmed"]], []]);
  }
  if (level === 3) {
    edges.push(["a block bounds a gap like a booking",
      { [A]: ms }, [[A, d0, d0 + 2, "confirmed"]], [[A, d0 + 3, d0 + 5]]]);
    edges.push(["a block overlapping a booking and another block merges into one occupied run",
      { [A]: ms }, [[A, d0, d0 + 4, "confirmed"], [A, d0 + 5 + ms, d0 + 8 + ms, "confirmed"]], [[A, d0 + 2, d0 + 5], [A, d0 + 3, d0 + 6]]]);
    edges.push(["a nested booking inside a long block leaves no gap",
      { [A]: ms }, [[A, d0 + 2, d0 + 4, "confirmed"], [A, d0 + 11, d0 + 12, "confirmed"]], [[A, d0, d0 + 10]]]);
    edges.push(["bookings and blocks of listings not in min_stay are ignored",
      { [A]: ms }, [[B, d0, d0 + 2, "confirmed"], [A, d0, d0 + 2, "confirmed"], [A, d0 + 3, d0 + 4, "confirmed"]], [[B, d0 + 2, d0 + 3]]]);
  }
  for (const [name, minStay, bookings, blocks] of edges) tests.push({ name, args: pyArgs(minStay, bookings, blocks), expect: pyOut(oracle(minStay, bookings, blocks)) });

  // Timing: 4 000 listings with 100 bookings each, about 700 nights per calendar.
  // Sorting each listing's intervals is O(n log n); rescanning every booking for every night
  // is O(nights × bookings) per listing, about 3 × 10^8 checks here.
  tests.push({
    name: "4,000 listings × 100 bookings, about 700 nights each (sort and scan, not per-night rescans)",
    args: `_gen_calendar(4000, 100, ${r.int(1, 1_000_000)}, ${level >= 2 ? "True" : "False"}, ${level === 3 ? "True" : "False"})`,
    limit_s: 8,
  });

  return {
    vars: {
      status_rule: level === 1
        ? "In this data every booking is `'confirmed'`, the confirmed bookings of a listing never overlap, and `blocks` is empty, but keep the parameter."
        : "A booking's status is `'confirmed'` or `'cancelled'`; cancelled bookings occupy nothing and bound nothing. Confirmed bookings of one listing never overlap each other." + (level === 2 ? " `blocks` is empty in this data, but keep the parameter." : ""),
      block_rule: level === 3
        ? "Host blocks occupy nights exactly like confirmed bookings, and they may overlap or touch bookings and each other. Rows for a listing that is not in `min_stay` are ignored."
        : "Every listing in `bookings` is in `min_stay`.",
      order_rule: level === 1 ? "The input is sorted by listing and check-in." : "The input is in no particular order.",
    },
    samples,
    tests,
  };
}
