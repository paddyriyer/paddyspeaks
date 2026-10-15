/* PIN-L2-01 — Price-drop alerts on saved product pins (Python, heaps / event sweep).
   Simulated practice scenario. All data is generated from the seed.

   Contract (python): entry, signature, starter, prelude, generate(r, level) ->
     { vars, samples: [{args, expect}], tests: [{name, args, expect?, limit_s?}] }.
   expect comes from oracle() below: for every save it looks up the price in force on
   the save day and scans that product's later price rows one by one. The evaluator's
   reference sweeps days once with a max-heap of pending thresholds per product, so
   each checks the other.
   level: 1 Medium (a price row every day, pct 90) · 2 Hard (+ sparse price rows,
          saves before the first price, pct varies) · 3 Very Hard (+ out-of-stock
          rows that never alert and saves made while out of stock) */
export const kind = "python";
export const entry = "price_drop_alerts";
export const signature = "def price_drop_alerts(saves: list[tuple[str, int]], prices: list[tuple[str, int, int | None]], pct: int = 90) -> list[int]:";
export const starter = `def price_drop_alerts(saves, prices, pct=90):
    """saves: (product, day) per save of a product pin, in save order.
    prices: (product, day, price_cents) rows; a row's price holds from its day
    until the product's next row.
    Return, per save, the first day after the save on which the product's price is
    at most pct% of its price on the save day, or -1."""
    ...
`;

export const prelude = `
def _gen_price_history(n_products, n_days, n_saves, seed, density=100, stockouts=0):
    x = seed

    def nxt():
        nonlocal x
        x = (1103515245 * x + 12345) % 2147483648
        return x >> 8
    prices, saves = [], []
    for k in range(n_products):
        sku = 'sku_%05d' % (k * 37 + 1000)
        base = 500 + nxt() % 20000
        sale = n_days - 1 - nxt() % 200 if k % 2 == 0 else -1
        for day in range(n_days):
            if day and nxt() % 100 >= density and day != sale:
                continue
            if stockouts and day and day != sale and nxt() % 100 < stockouts:
                prices.append((sku, day, None))
            elif day == sale:
                prices.append((sku, day, base * 70 // 100))
            else:
                prices.append((sku, day, base * (96 + nxt() % 9) // 100))
    for _ in range(n_saves):
        k = nxt() % n_products
        saves.append(('sku_%05d' % (k * 37 + 1000), nxt() % n_days))
    x = seed + 1
    for i in range(len(prices) - 1, 0, -1):
        j = nxt() % (i + 1)
        prices[i], prices[j] = prices[j], prices[i]
    return saves, prices
`.trim() + "\n";

// Per save: the price in force on the save day, then a forward scan. Small inputs only.
export function oracle(saves, prices, pct) {
  const by = new Map();
  for (const [p, d, v] of prices) {
    if (!by.has(p)) by.set(p, []);
    by.get(p).push([d, v]);
  }
  for (const rows of by.values()) rows.sort((a, b) => a[0] - b[0]);
  return saves.map(([p, day]) => {
    const rows = by.get(p) || [];
    let saved = null;
    for (const [d, v] of rows) if (d <= day) saved = v;           // the last row on or before the save day
    if (saved === null) return -1;                                  // no price yet, or out of stock
    for (const [d, v] of rows) {
      if (d <= day || v === null) continue;
      if (100 * v <= pct * saved) return d;
    }
    return -1;
  });
}

const pyStr = (s) => "'" + s + "'";
const pyArgs = (c) =>
  "([" + c.saves.map(([p, d]) => `(${pyStr(p)}, ${d})`).join(", ") + "], [" +
  c.prices.map(([p, d, v]) => `(${pyStr(p)}, ${d}, ${v === null ? "None" : v})`).join(", ") + `], ${c.pct})`;
const pyOut = (xs) => "[" + xs.join(", ") + "]";
const run = (c) => oracle(c.saves, c.prices, c.pct);

const NAMES = ["lamp", "rug", "vase", "chair", "mirror", "kettle", "planter", "throw", "frame", "stool", "sconce", "tote"];

function randomCase(r, level, pct) {
  for (let attempt = 0; attempt < 80; attempt++) {
    const products = r.sample(NAMES, level === 1 ? 2 : 3).map((n) => `sku_${n}_${r.int(10, 99)}`);
    const days = r.int(14, 22);
    const prices = [];
    for (const p of products) {
      let price = r.int(20, 400) * 10;
      const first = level === 1 ? 0 : r.int(0, 3);
      for (let d = first; d < days; d++) {
        if (level >= 2 && d > first && !r.chance(0.55)) continue;
        if (level === 3 && d > first && r.chance(0.12)) { prices.push([p, d, null]); continue; }
        if (d > first) {
          const roll = r.next();
          if (roll < 0.15) price = Math.floor((price * r.int(65, 80)) / 100);      // a sale
          else if (roll < 0.3) price = Math.floor((price * r.int(110, 130)) / 100); // back up
          else price = Math.floor((price * r.int(94, 104)) / 100);
          price = Math.max(price, 50);
        }
        prices.push([p, d, price]);
      }
    }
    const saves = Array.from({ length: r.int(7, 10) }, () => [r.pick(products), r.int(0, days - 1)]);
    const c = { saves, prices: r.shuffle(prices), pct };
    const got = run(c);
    if (got.some((x) => x >= 0) && got.some((x) => x < 0)) return c;
  }
  throw new Error("PIN-L2-01: could not build a sample with both outcomes");
}

export function generate(r, level) {
  const pct = level === 1 ? 90 : r.pick([90, 85, 80, 75]);
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const c = randomCase(r, level, pct);
    samples.push({ args: pyArgs(c), expect: pyOut(run(c)) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const [A, B] = r.sample(NAMES, 2).map((n) => `sku_${n}_${r.int(10, 99)}`);
  const m = r.int(20, 80);
  const S = 100 * m;                 // the price on the save day
  const T = pct * m;                 // exactly pct% of S
  const d0 = r.int(1, 9);
  const edges = [
    ["a price of exactly pct% of the saved price alerts",
      { saves: [[A, d0]], prices: [[A, d0 - 1, S], [A, d0 + 2, T]] }],
    ["one cent above pct% does not alert",
      { saves: [[A, d0]], prices: [[A, d0 - 1, S], [A, d0 + 2, T + 1]] }],
    ["a drop on the save day itself sets the saved price, it is not an alert",
      { saves: [[A, d0 + 1]], prices: [[A, d0, S], [A, d0 + 1, T - 5], [A, d0 + 4, T - 5]] }],
    ["the first qualifying day, not the cheapest one",
      { saves: [[A, d0]], prices: [[A, 0, S], [A, d0 + 2, T], [A, d0 + 5, Math.floor(T / 2)]] }],
    ["a save before the product's first price row never alerts",
      { saves: [[A, 0], [A, 3]], prices: [[A, 2, S], [A, 6, Math.floor(T / 2)]] }],
    ["each save is measured against its own saved price",
      { saves: [[A, 1], [A, 4]], prices: [[A, 0, S], [A, 3, S + S / 2], [A, 6, S + 10], [A, 9, T]] }],
    ["a drop on another product does not alert",
      { saves: [[A, 1], [B, 1]], prices: [[B, 0, S], [A, 0, S], [B, 5, T]] }],
    ["rows arrive out of order and interleaved",
      { saves: [[B, 2], [A, 2]], prices: [[A, 7, T], [B, 0, S], [A, 0, S], [B, 9, T - 1], [B, 4, S + 100], [A, 3, S - 100]] }],
    ["two saves on the same day alert on the same day",
      { saves: [[A, 2], [A, 2]], prices: [[A, 0, S], [A, 5, T]] }],
    ["a save on the last row's day has nothing after it",
      { saves: [[A, 6]], prices: [[A, 0, S], [A, 6, T]] }],
    ["a product with no price rows at all",
      { saves: [[B, 3]], prices: [[A, 0, S]] }],
  ];
  if (level === 3) {
    edges.push(["an out-of-stock day never alerts, and coming back cheap alerts on that day",
      { saves: [[A, 1]], prices: [[A, 0, S], [A, 3, null], [A, 6, T]] }]);
    edges.push(["a save while out of stock never alerts",
      { saves: [[A, 4]], prices: [[A, 0, S], [A, 3, null], [A, 6, Math.floor(T / 2)]] }]);
    edges.push(["out of stock on the save day itself",
      { saves: [[A, 3]], prices: [[A, 0, S], [A, 3, null], [A, 5, Math.floor(T / 2)]] }]);
    edges.push(["back in stock above the threshold, then a real drop",
      { saves: [[A, 1]], prices: [[A, 0, S], [A, 2, null], [A, 4, S], [A, 8, T]] }]);
  }
  for (const [name, c] of edges) {
    c.pct = pct;
    tests.push({ name, args: pyArgs(c), expect: pyOut(run(c)) });
  }

  // Timing: compared with the reference at check time. Prices wobble within a few
  // per cent, so most saves stay pending for years of rows; a forward scan per save
  // (or a scan of every pending save on every price row) is quadratic.
  const seed = r.int(1, 1_000_000);
  const density = level === 1 ? 100 : 75;
  const stockouts = level === 3 ? 3 : 0;
  tests.push({
    name: "150,000 saves over 20 products with 4,000 days of prices in time",
    args: `(*_gen_price_history(20, 4000, 150000, ${seed}, ${density}, ${stockouts}), ${pct})`,
    limit_s: 8,
  });

  return {
    vars: {
      pct_rule: level === 1
        ? "In this exercise `pct` is 90, and every product has a price row for every day."
        : `In this exercise the tests use \`pct\` = ${pct}. Price rows are sparse: a product's price changes only on the days that have a row.`,
      stock_rule: level === 3
        ? "A row's price may be `None`: the product is out of stock from that day until its next row. An out-of-stock day never alerts. A save made while the product is out of stock never alerts (-1). If the product comes back at a price at or below a pending save's threshold, the alert fires on the day it comes back."
        : "Every row has a price in this exercise.",
    },
    samples,
    tests,
  };
}
