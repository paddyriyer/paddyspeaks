/* AMZ-L2-01 — Cheapest shipment plan for a multi-item order (Python).
   Simulated practice scenario. All data is generated from the seed.

   Contract (python): entry, signature, starter, prelude, generate(r, level) ->
     { vars, samples: [{args, expect}], tests: [{name, args, expect?, limit_s?}] }.
   expect comes from oracle() below: a brute-force enumeration of every assignment
   of items to centres (packages per centre = ceil(items / max_items)). The
   evaluator's reference is a subset dynamic programme over the order's items,
   written independently.
   level: 1 Medium (every item stocked, no box limit) · 2 Hard (+ items stocked
          nowhere, cost ties broken by package count) · 3 Very Hard (+ a box limit
          that can force several packages from one centre) */
export const kind = "python";
export const entry = "plan_shipments";
export const signature = "def plan_shipments(items: list[str], centres: list[tuple[str, int, dict[str, int]]], max_items: int | None = None) -> tuple[int, int] | None:";
export const starter = `def plan_shipments(items, centres, max_items=None):
    """items: distinct SKUs in one order (one unit each).
    centres: (centre_id, package_cost, {sku: unit_cost}) — a centre can ship a
    SKU only if the SKU is in its dict. Costs are integer cents.
    A package comes from one centre and costs package_cost + the unit costs of
    the items in it. max_items (or None) caps the items in one package.
    Return (total_cost, packages) for the cheapest plan, fewest packages on a
    cost tie, or None if some item cannot be shipped."""
    ...
`;

export const prelude = `
def _gen_order(n, m, seed):
    x = seed
    items = ['sku%02d' % i for i in range(n)]
    centres = []
    for f in range(m):
        units = {}
        for i in range(n):
            x = (1103515245 * x + 12345) % 2147483648
            if i % m == f or (x >> 16) % 100 < 45:
                x = (1103515245 * x + 12345) % 2147483648
                units[items[i]] = 50 + (x >> 16) % 551
        x = (1103515245 * x + 12345) % 2147483648
        centres.append(('fc%02d' % f, 250 + (x >> 16) % 651, units))
    return items, centres
`.trim() + "\n";

const SKUS = ["B0KETTLE", "B0CABLE", "B0LAMP", "B0BOOK", "B0MUG", "B0TOWEL", "B0CHARGER", "B0SOCKS", "B0PAN", "B0LEGO",
  "B0SOAP", "B0PENS", "B0TENT", "B0BOTTLE", "B0FILTER", "B0BULB", "B0TAPE", "B0GLOVES"];
const FCS = ["FC-A", "FC-B", "FC-C", "FC-D", "FC-E", "FC-F", "FC-G", "FC-H"];

// Brute force: every assignment of each item to a centre that stocks it.
// With a box limit, a centre holding k items sends ceil(k / max_items) packages.
export function oracle(items, centres, maxItems) {
  const options = items.map((sku) => centres.map((c, f) => [f, c[2][sku]]).filter(([, u]) => u !== undefined));
  if (options.some((o) => o.length === 0)) return null;
  const count = new Array(centres.length).fill(0);
  let best = null;
  const walk = (i, unitSum) => {
    if (i === items.length) {
      let cost = unitSum, packages = 0;
      for (let f = 0; f < centres.length; f++) {
        if (!count[f]) continue;
        const p = maxItems == null ? 1 : Math.ceil(count[f] / maxItems);
        cost += p * centres[f][1];
        packages += p;
      }
      if (best === null || cost < best[0] || (cost === best[0] && packages < best[1])) best = [cost, packages];
      return;
    }
    for (const [f, u] of options[i]) {
      count[f]++;
      walk(i + 1, unitSum + u);
      count[f]--;
    }
  };
  walk(0, 0);
  return best;
}

const pyOut = (v) => (v === null ? "None" : `(${v[0]}, ${v[1]})`);
const pyCentre = ([id, base, units]) => `('${id}', ${base}, {${Object.entries(units).map(([s, u]) => `'${s}': ${u}`).join(", ")}})`;
const pyArgs = (items, centres, maxItems) =>
  `([${items.map((s) => `'${s}'`).join(", ")}], [${centres.map(pyCentre).join(", ")}], ${maxItems == null ? "None" : maxItems})`;

function smallCase(r, level, allowMissing) {
  const n = level === 1 ? r.int(4, 6) : level === 2 ? r.int(6, 7) : r.int(6, 8);
  const m = level === 1 ? r.int(2, 3) : r.int(3, 4);
  const items = r.sample(SKUS, n);
  const ids = r.sample(FCS, m);
  const centres = ids.map((id) => [id, r.pick([299, 399, 450, 549, 650, 799]), {}]);
  items.forEach((sku, i) => {
    for (let f = 0; f < m; f++) {
      if (i % m === f || r.chance(0.5)) centres[f][2][sku] = r.pick([0, 45, 80, 120, 175, 240, 310, 420]);
    }
  });
  if (allowMissing && r.chance(0.5)) {               // an item nobody stocks
    const extra = r.pick(SKUS.filter((s) => !items.includes(s)));
    items.splice(r.int(0, items.length), 0, extra);
  }
  const maxItems = level === 3 ? r.int(2, 3) : null;
  return { items, centres: r.shuffle(centres), maxItems };
}

export function generate(r, level) {
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const c = smallCase(r, level, level >= 2 && i === 2);
    samples.push({ args: pyArgs(c.items, c.centres, c.maxItems), expect: pyOut(oracle(c.items, c.centres, c.maxItems)) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const [a, b, c, d, e] = r.sample(SKUS, 5);
  const [F, G, H] = r.sample(FCS, 3);
  const base = r.pick([300, 400, 500]);
  const edges = [
    ["one centre stocks everything: one package", [a, b, c], [[F, base, { [a]: 100, [b]: 120, [c]: 90 }]], null],
    ["splitting is cheaper when each centre is much closer for its half",
      [a, b, c, d], [[F, 100, { [a]: 50, [b]: 60, [c]: 900, [d]: 900 }], [G, 100, { [a]: 900, [b]: 900, [c]: 40, [d]: 70 }]], null],
    ["consolidating is cheaper when the package cost dominates",
      [a, b, c], [[F, 900, { [a]: 100, [b]: 100, [c]: 130 }], [G, 900, { [a]: 90, [b]: 90, [c]: 90 }]], null],
    ["equal cost: the plan with fewer packages wins",
      [a, b], [[F, 2 * base, { [a]: 50, [b]: 50 }], [G, base, { [a]: 50 }], [H, base, { [b]: 50 }]], null],
    ["an item no centre stocks: None", [a, b], [[F, base, { [a]: 100 }], [G, base, { [a]: 80 }]], null],
    ["an empty order costs nothing", [], [[F, base, { [a]: 100 }]], null],
    ["a unit cost of 0 is still a valid offer", [a, b], [[F, base, { [a]: 0, [b]: 0 }], [G, 1, { [a]: 1 }]], null],
  ];
  if (level === 3) {
    edges.push(["a box limit of 2 forces three packages from one centre",
      [a, b, c, d, e], [[F, base, { [a]: 10, [b]: 10, [c]: 10, [d]: 10, [e]: 10 }]], 2]);
    edges.push(["exactly max_items items fit in one package", [a, b, c], [[F, base, { [a]: 10, [b]: 10, [c]: 10 }]], 3]);
    edges.push(["the box limit makes a second centre worthwhile",
      [a, b, c, d], [[F, base, { [a]: 10, [b]: 10, [c]: 10, [d]: 10 }], [G, base - 15, { [c]: 10, [d]: 10 }]], 3]);
  }
  for (const [name, it, cs, mx] of edges) tests.push({ name, args: pyArgs(it, cs, mx), expect: pyOut(oracle(it, cs, mx)) });

  // Timing: 13 items, 40 centres. A subset DP over items (about 3^(n-1) steps) is
  // well under a second; trying every item-to-centre assignment is 40^13.
  const n = level === 1 ? 12 : 13;
  const m = level === 1 ? 30 : 40;
  const cap = level === 3 ? 5 : null;
  tests.push({
    name: `${n} items, ${m} centres${cap ? `, max_items ${cap}` : ""} (subset DP)`,
    args: `(*_gen_order(${n}, ${m}, ${r.int(1, 1_000_000)}), ${cap == null ? "None" : cap})`,
    limit_s: 8,
  });

  return {
    vars: {
      stock_rule: level === 1
        ? "In this replay every item is stocked by at least one centre."
        : "An item may be stocked by no centre at all; then the order cannot be planned and you return `None`.",
      box_rule: level === 3
        ? "Here `max_items` is set: a package holds at most `max_items` items, so one centre may have to send several packages, each paying its package cost."
        : "In this replay `max_items` is `None`, so a package can hold any number of items; your function must still accept the argument.",
    },
    samples,
    tests,
  };
}
