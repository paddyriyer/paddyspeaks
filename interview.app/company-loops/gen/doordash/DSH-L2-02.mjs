/* DSH-L2-02 — Promotion price timeline: the price a consumer saw, as segments
   (Python, sweep line with a heap and lazy deletion).
   Simulated practice scenario. All data is generated from the seed.

   Contract (python): entry, signature, starter, prelude, generate(r, level) ->
     { vars, samples: [{args, expect}], tests: [{name, args, expect?, limit_s?}] }.
   expect comes from oracle() below: it cuts the period at every start, end and base
   price change, and for every piece scans every promotion of the item (O(n²), fine
   for small inputs). The evaluator's reference sweeps once with a min-heap of active
   promotions and drops expired ones lazily, so each checks the other.
   level: 1 Medium (one base price per item, promotions inside the period and below
          the base) · 2 Hard (+ promotions clipped at the period's edges, priced at or
          above the base, equal prices) · 3 Very Hard (+ base prices that change during
          the period) */
export const kind = "python";
export const entry = "price_timeline";
export const signature = "def price_timeline(base: dict[str, list[tuple[int, int]]], promotions: list[tuple[str, str, int, int, int]], horizon: int) -> dict[str, list[tuple]]:";
export const starter = `def price_timeline(base, promotions, horizon):
    """base: item -> [(time, price_cents)] rows in time order, the first at time 0.
    promotions: (promo_id, item, start, end, price_cents), half-open [start, end),
    listed in the order they were created (oldest first).
    Return item -> [(start, end, price_cents, promo_id or None)] covering [0, horizon)."""
    ...
`;

export const prelude = `
def _gen_promotions(n_items, per_item, horizon, seed, base_changes=0):
    x = seed

    def nxt():
        nonlocal x
        x = (1103515245 * x + 12345) % 2147483648
        return x >> 8
    base, promos = {}, []
    for k in range(n_items):
        item = 'item-%04d' % (k * 13 + 100)
        times = sorted({1 + nxt() % (horizon - 1) for _ in range(base_changes)})
        base[item] = [(0, 300 + nxt() % 3000)] + [(t, 300 + nxt() % 3000) for t in times]
        for j in range(per_item):
            start = nxt() % horizon - horizon // 20
            length = 60 + nxt() % (horizon // 2)
            promos.append(('p%d-%d' % (k, j), item, start, start + length, 100 + nxt() % 3200))
    x = seed + 7
    for i in range(len(promos) - 1, 0, -1):
        j = nxt() % (i + 1)
        promos[i], promos[j] = promos[j], promos[i]
    return base, promos, horizon
`.trim() + "\n";

// Cut at every change, then scan every promotion for every piece. Small inputs only.
export function oracle(base, promotions, horizon) {
  const out = {};
  for (const [item, rows] of Object.entries(base)) {
    const mine = promotions.filter((p) => p[1] === item);
    const cuts = new Set([0, horizon]);
    for (const [t] of rows) if (t > 0 && t < horizon) cuts.add(t);
    for (const [, , s, e] of mine) {
      if (s > 0 && s < horizon) cuts.add(s);
      if (e > 0 && e < horizon) cuts.add(e);
    }
    const ts = [...cuts].sort((a, b) => a - b);
    const segs = [];
    for (let i = 0; i + 1 < ts.length; i++) {
      const t = ts[i];
      let basePrice = null;
      for (const [rt, rp] of rows) if (rt <= t) basePrice = rp;
      let win = null;                                   // the first-created promotion among the cheapest
      for (const p of mine) {
        if (p[2] <= t && t < p[3] && p[4] < basePrice && (win === null || p[4] < win[4])) win = p;
      }
      const price = win ? win[4] : basePrice, promo = win ? win[0] : null;
      const last = segs[segs.length - 1];
      if (last && last[2] === price && last[3] === promo) last[1] = ts[i + 1];
      else segs.push([t, ts[i + 1], price, promo]);
    }
    out[item] = segs;
  }
  return out;
}

const pyStr = (s) => (s === null ? "None" : "'" + s + "'");
const pyArgs = (c) =>
  "({" + Object.entries(c.base).map(([k, rows]) => `${pyStr(k)}: [${rows.map(([t, p]) => `(${t}, ${p})`).join(", ")}]`).join(", ") + "}, [" +
  c.promotions.map(([id, it, s, e, p]) => `(${pyStr(id)}, ${pyStr(it)}, ${s}, ${e}, ${p})`).join(", ") + `], ${c.horizon})`;
const pyOut = (o) =>
  "{" + Object.entries(o).map(([k, segs]) => `${pyStr(k)}: [${segs.map(([s, e, p, id]) => `(${s}, ${e}, ${p}, ${pyStr(id)})`).join(", ")}]`).join(", ") + "}";
const run = (c) => oracle(c.base, c.promotions, c.horizon);

const ITEMS = ["pad-thai", "margherita", "chicken-bowl", "iced-latte", "veggie-burrito", "ramen", "caesar-salad",
  "fish-tacos", "bagel-box", "smoothie", "dumplings", "falafel-wrap", "poke-bowl", "cheeseburger"];

function randomCase(r, level) {
  const horizon = 10 * r.int(12, 30);
  const items = r.sample(ITEMS, level === 1 ? 2 : 3);
  const base = {};
  for (const it of items) {
    const rows = [[0, 50 * r.int(8, 30)]];
    if (level === 3) {
      let t = 0;
      for (let k = r.int(1, 2); k > 0; k--) {
        t += r.int(2, Math.floor(horizon / 3));
        if (t < horizon) rows.push([t, r.chance(0.2) ? rows[rows.length - 1][1] : 50 * r.int(8, 30)]);
      }
    }
    base[it] = rows;
  }
  const promotions = [];
  let n = 0;
  for (const it of items) {
    const low = Math.min(...base[it].map((x) => x[1]));
    const prices = [];
    for (let k = r.int(3, level === 1 ? 4 : 6); k > 0; k--) {
      let s = r.int(0, horizon - 10), e = s + r.int(5, Math.floor(horizon / 2));
      if (level === 1) e = Math.min(e, horizon);
      else if (r.chance(0.2)) s -= r.int(1, 30);
      let price;
      if (level >= 2 && prices.length && r.chance(0.3)) price = r.pick(prices);           // an equal price
      else if (level >= 2 && r.chance(0.12)) price = low + 25 * r.int(0, 4);               // at or above a base
      else price = low - 25 * r.int(1, Math.floor((low - 100) / 25));
      prices.push(price);
      promotions.push([`promo-${r.int(100, 999)}${n++}`, it, s, e, price]);
    }
  }
  return { base, promotions: level === 1 ? promotions : r.shuffle(promotions), horizon };
}

export function generate(r, level) {
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const c = randomCase(r, level);
    samples.push({ args: pyArgs(c), expect: pyOut(run(c)) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const [X, Y] = r.sample(ITEMS, 2);
  const B = 50 * r.int(10, 20), H = 100;
  const P = (id, s, e, price, item = X) => [id, item, s, e, price];
  const one = (promotions, extra = {}) => ({ base: { [X]: [[0, B]], ...extra }, promotions, horizon: H });
  const edges = [
    ["the lowest price wins while promotions overlap",
      one([P("pr-a", 10, 50, B - 100), P("pr-b", 30, 70, B - 150)])],
    ["equal prices: the older promotion wins, even when it started later",
      one([P("pr-old", 40, 80, B - 200), P("pr-new", 20, 60, B - 200)])],
    ["a promotion ending exactly when another starts (half-open)",
      one([P("pr-a", 10, 30, B - 100), P("pr-b", 30, 50, B - 100)])],
    ["when the cheapest ends, the next best returns, not the base price",
      one([P("pr-long", 0, 100, B - 50), P("pr-flash", 20, 40, B - 200)])],
    ["a dearer promotion starting and ending inside the winner does not split it",
      one([P("pr-a", 10, 90, B - 200), P("pr-b", 30, 60, B - 100)])],
    ["an item with no promotions is one base segment, and another item's promotion changes nothing",
      one([P("pr-y", 10, 40, 150, Y)], { [Y]: [[0, 400]] })],
    ["promotions clipped at the period's edges, and one entirely after it",
      one([P("pr-early", -30, 20, B - 100), P("pr-late", 80, 150, B - 150), P("pr-after", 100, 140, 100)])],
    ["a promotion priced at the base price never wins",
      one([P("pr-same", 10, 50, B), P("pr-dear", 20, 30, B + 100)])],
  ];
  if (level === 3) {
    edges.push(["a lower new base price beats a promotion that beat the old one",
      { base: { [X]: [[0, B], [50, B - 150]] }, promotions: [P("pr-a", 20, 80, B - 100)], horizon: H }]);
    edges.push(["the winning promotion survives a base change as one segment",
      { base: { [X]: [[0, B], [40, B - 50]] }, promotions: [P("pr-a", 10, 90, B - 200)], horizon: H }]);
    edges.push(["a base row with the same price is not a new segment",
      { base: { [X]: [[0, B], [30, B]] }, promotions: [], horizon: H }]);
    edges.push(["a base price rise lets a promotion win from that moment",
      { base: { [X]: [[0, B], [60, B + 200]] }, promotions: [P("pr-a", 20, 90, B + 100)], horizon: H }]);
  }
  for (const [name, c] of edges) tests.push({ name, args: pyArgs(c), expect: pyOut(run(c)) });

  // Timing: compared with the reference at check time. Promotions run for up to two
  // weeks of a four-week period, so thousands are active at every boundary; a sweep
  // that rescans its list of active promotions at each boundary is O(n·a).
  tests.push({
    name: "80,000 promotions on four items over four weeks of minutes in time",
    args: `_gen_promotions(4, 20000, 40320, ${r.int(1, 1_000_000)}, ${level === 3 ? 3 : 0})`,
    limit_s: 8,
  });

  return {
    vars: {
      base_rule: level === 3
        ? "An item's base price can change during the period: its rows are `(time, price)` in time order, the first at time 0, and a row's price holds until the item's next row. A promotion that was below the old base price may not be below the new one, and the other way round."
        : "In this exercise every item has exactly one base row, `(0, price)`, so its base price holds for the whole period.",
      level_note: level === 1
        ? "This replay has promotions inside the period, all priced below the base; the checks also cover clipping and promotions at or above the base."
        : level === 2
          ? "This replay includes promotions that start before 0 or end after the horizon, promotions at or above the base price, and promotions with equal prices."
          : "This replay includes clipped promotions, promotions at or above the base price, equal prices and base prices that change.",
    },
    samples,
    tests,
  };
}
