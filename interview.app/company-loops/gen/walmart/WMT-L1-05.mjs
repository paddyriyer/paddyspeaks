/* WMT-L1-05 — Expiring stock: units of each lot that expire unsold when sales take the oldest lot first (Python).
   Simulated practice scenario. All data is generated from the seed; the selling rule is this
   exercise's rule, not any retailer's.

   Contract (python): entry, signature, starter, prelude, generate(r, level) ->
     { vars, samples: [{args, expect}], tests: [{name, args, expect?, limit_s?}] }.
   expect comes from oracle() below: for every unit sold it scans every lot from the
   oldest. The evaluator's reference keeps a queue of lots per item, written independently.
   level: 1 Medium (one item; an older lot never expires after a newer one)
          · 2 Hard (several items; a newer lot can expire first; sales larger than the stock; same-day deliveries)
          · 3 Very Hard (+ write-offs of damaged units from a named lot, including ones larger than what is left
            and ones after the lot has expired) */
export const kind = "python";
export const entry = "expired_units";
export const signature = "def expired_units(lots: list[tuple[str, str, int, int, int]], sales: list[tuple[int, str, int]], writeoffs: list[tuple[int, str, int]], as_of: int) -> dict[str, int]:";
export const starter = `def expired_units(lots, sales, writeoffs, as_of):
    """lots: (lot_id, item, delivered_day, units, expiry_day), sorted by delivered_day.
    sales: (day, item, units), sorted by day.
    writeoffs: (day, lot_id, units), sorted by day.
    Return {lot_id: units that expired unsold} for every lot with expiry_day < as_of."""
    ...
`;

export const prelude = `
def _gen_stock(n_items, lots_per_item, sales_per_item, days, seed, with_writeoffs=False):
    x = seed
    def rnd(m):
        nonlocal x
        x = (6364136223846793005 * x + 1442695040888963407) % 18446744073709551616
        return (x >> 33) % m
    items = ['upc_%05d' % (10000 + 7 * i) for i in range(n_items)]
    order = sorted((rnd(days), k) for k in range(n_items * lots_per_item))
    lots = [('L%d' % k, items[rnd(n_items)], d, 5 + rnd(20), d + 3 + rnd(38)) for k, (d, _) in enumerate(order)]
    sales = sorted((rnd(days), items[rnd(n_items)], 1 + rnd(9)) for _ in range(n_items * sales_per_item))
    writeoffs = []
    if with_writeoffs:
        picks = [lots[rnd(len(lots))] for _ in range(len(lots) // 10)]
        writeoffs = sorted((lot[2] + rnd(45), lot[0], 1 + rnd(30)) for lot in picks)
        writeoffs = [w for w in writeoffs if w[0] <= days]
    return lots, sales, writeoffs, days
`.trim() + "\n";

// The specification, literally: sell unit by unit, each time scanning all lots for the oldest sellable one.
export function oracle(lots, sales, writeoffs, asOf) {
  const left = new Map(lots.map((l) => [l[0], l[3]]));
  const exp = new Map(lots.map((l) => [l[0], l[4]]));
  const events = [];
  writeoffs.forEach((w, i) => events.push({ day: w[0], kind: 0, i, w }));
  sales.forEach((s, i) => events.push({ day: s[0], kind: 1, i, s }));
  events.sort((a, b) => a.day - b.day || a.kind - b.kind || a.i - b.i);   // write-offs before sales on a day
  for (const e of events) {
    if (e.kind === 0) {
      const [day, id, n] = e.w;
      if (day <= exp.get(id)) left.set(id, left.get(id) - Math.min(n, left.get(id)));
      continue;
    }
    const [day, item, units] = e.s;
    for (let u = 0; u < units; u++) {
      const lot = lots.find((l) => l[1] === item && l[2] <= day && l[4] >= day && left.get(l[0]) > 0);
      if (!lot) break;
      left.set(lot[0], left.get(lot[0]) - 1);
    }
  }
  const out = new Map();
  for (const l of lots) if (l[4] < asOf) out.set(l[0], left.get(l[0]));
  return out;
}

const q = (s) => `'${s}'`;
const pyArgs = (lots, sales, wos, asOf) =>
  `([${lots.map((l) => `(${q(l[0])}, ${q(l[1])}, ${l[2]}, ${l[3]}, ${l[4]})`).join(", ")}], ` +
  `[${sales.map((s) => `(${s[0]}, ${q(s[1])}, ${s[2]})`).join(", ")}], ` +
  `[${wos.map((w) => `(${w[0]}, ${q(w[1])}, ${w[2]})`).join(", ")}], ${asOf})`;
const pyOut = (m) => "{" + [...m.entries()].map(([k, v]) => `${q(k)}: ${v}`).join(", ") + "}";

const ITEMS = ["upc_strawberries", "upc_spinach", "upc_whole_milk", "upc_sourdough", "upc_yogurt", "upc_salad_kit"];

function randomCase(r, level) {
  for (let attempt = 0; attempt < 60; attempt++) {
    const items = level === 1 ? [r.pick(ITEMS)] : r.sample(ITEMS, r.int(2, 3));
    const nLots = level === 1 ? r.int(4, 6) : r.int(6, 9);
    const days = r.int(14, 22);
    const lots = [];
    let lid = r.int(1000, 8000), lastExp = 0;
    const ds = Array.from({ length: nLots }, () => r.int(0, days - 4)).sort((a, b) => a - b);
    for (const d of ds) {
      let e = d + r.int(1, 8);
      if (level === 1) { e = Math.max(e, lastExp); lastExp = e; }
      lots.push(["LOT-" + (lid += r.int(1, 40)), r.pick(items), d, r.int(2, 9), e]);
    }
    const sales = Array.from({ length: r.int(6, 12) }, () => [r.int(0, days), r.pick(items), r.int(1, level === 1 ? 4 : 7)]).sort((a, b) => a[0] - b[0]);
    const wos = [];
    if (level === 3) {
      for (let k = 0; k < r.int(2, 3); k++) {
        const l = r.pick(lots);
        wos.push([l[2] + r.int(0, 9), l[0], r.int(1, 6)]);
      }
      wos.sort((a, b) => a[0] - b[0]);
    }
    const asOf = days + r.int(-2, 3);
    if (sales.some((s) => s[0] > asOf) || wos.some((w) => w[0] > asOf)) continue;
    const got = oracle(lots, sales, wos, asOf);
    const sold = lots.some((l) => got.has(l[0]) && got.get(l[0]) < l[3]);
    const exp = [...got.values()].some((v) => v > 0);
    if (got.size && sold && exp) return { lots, sales, wos, asOf, got };
  }
  throw new Error("WMT-L1-05: could not build a sample");
}

export function generate(r, level) {
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const c = randomCase(r, level);
    samples.push({ args: pyArgs(c.lots, c.sales, c.wos, c.asOf), expect: pyOut(c.got) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const [I, J] = r.sample(ITEMS, 2);
  const u = r.int(4, 9);
  const d = r.int(2, 6);
  const L = (n) => "LOT-" + String(n).padStart(4, "0");
  const [A, B, C] = [L(r.int(1000, 3000)), L(r.int(3001, 6000)), L(r.int(6001, 9999))];
  const edges = [
    ["a sale on the expiry day still takes the lot; the day after it has expired",
      [[A, I, 0, u, d], [B, I, 0, u, d + 5]], [[d, I, 2], [d + 1, I, 3]], [], d + 6],
    ["a lot delivered on the day of a sale is sold that day",
      [[A, I, d, u, d + 2]], [[d, I, u - 1]], [], d + 4],
    ["a lot that expires on the as-of day is not reported yet; one day earlier is",
      [[A, I, 0, u, d], [B, I, 0, u, d + 1]], [[1, I, 1]], [], d + 1],
    ["the oldest lot sells first, and the rest of a sale moves to the next lot",
      [[A, I, 0, u, d + 3], [B, I, 1, u, d + 3]], [[d, I, u + 2]], [], d + 5],
  ];
  if (level >= 2) {
    edges.push(["oldest first even when a newer lot expires sooner: the newer one expires",
      [[A, I, 0, u, d + 6], [B, I, 1, u, d]], [[d - 1, I, u - 1], [d + 2, I, 2]], [], d + 8]);
    edges.push(["a sale larger than the stock takes everything; the rest is lost, not owed",
      [[A, I, 0, u, d + 2]], [[1, I, u + 5], [2, I, 1]], [], d + 4]);
    edges.push(["items never share lots",
      [[A, I, 0, u, d], [B, J, 0, u, d]], [[1, J, u]], [], d + 2]);
    edges.push(["lots delivered on the same day sell in list order",
      [[B, I, 1, u, d + 3], [A, I, 1, u, d + 3], [C, I, 2, u, d + 3]], [[2, I, u + 1]], [], d + 5]);
  }
  if (level === 3) {
    edges.push(["a write-off removes units from the named lot, not the oldest",
      [[A, I, 0, u, d + 4], [B, I, 1, u, d + 4]], [[d + 1, I, 1]], [[d, B, 2]], d + 6]);
    edges.push(["a write-off larger than what is left removes only what is left",
      [[A, I, 0, u, d + 4], [B, I, 0, u, d + 4]], [[1, I, u - 1]], [[2, A, 5]], d + 6]);
    edges.push(["a write-off after the expiry day changes nothing: those units already expired",
      [[A, I, 0, u, d]], [[1, I, 1]], [[d + 1, A, 3]], d + 3]);
    edges.push(["a write-off happens before the sales of its day",
      [[A, I, 0, u, d + 4], [B, I, 0, u, d + 4]], [[d, I, 3]], [[d, A, u - 1]], d + 6]);
  }
  for (const [name, lots, sales, wos, asOf] of edges) tests.push({ name, args: pyArgs(lots, sales, wos, asOf), expect: pyOut(oracle(lots, sales, wos, asOf)) });

  // Timing: 5 items, 50 000 lots and 125 000 sales over 3 000 days. A queue per item makes each
  // lot leave the front once; scanning the lots from the oldest on every sale is quadratic.
  tests.push({
    name: "50,000 lots and 125,000 sales over 3,000 days (each lot leaves the front of its queue once)",
    args: `_gen_stock(5, 10000, 25000, 3000, ${r.int(1, 1_000_000)}, ${level === 3 ? "True" : "False"})`,
    limit_s: 8,
  });

  return {
    vars: {
      item_rule: level === 1
        ? "In this sample there is one item, and an older lot never expires after a newer one; keep the code correct for several items and any expiry dates."
        : "There are several items, and a newer lot can expire before an older one: sales still take the oldest lot first, so the newer one can expire on the shelf.",
      writeoff_rule: level === 3
        ? "`writeoffs` lists damaged units removed from a named lot: `(day, lot_id, units)`. A write-off removes up to `units` from that lot (never below 0) before the sales of its day; a write-off after the lot's expiry day changes nothing, because those units have already expired. Written-off units are not expired units."
        : "`writeoffs` is always empty at this level, but keep the parameter.",
    },
    samples,
    tests,
  };
}
