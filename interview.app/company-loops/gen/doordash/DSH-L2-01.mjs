/* DSH-L2-01 — Substitutions that fill the most out-of-stock lines (Python, bipartite
   matching / augmenting paths).
   Simulated practice scenario. All data is generated from the seed.

   Contract (python): entry, signature, starter, prelude, generate(r, level) ->
     { vars, samples: [{args, expect}], tests: [{name, args, expect?, limit_s?}] }.
   expect comes from oracle() below: a max-flow (Edmonds-Karp, BFS augmenting paths)
   over source -> lines -> items -> sink with each item's spare units as capacity. The
   evaluator's reference uses Kuhn's DFS augmenting paths with item capacities, so each
   checks the other. Every seeded sample holds at least one order where greedy first
   fit (lines in order, first approved item with a unit left) fills fewer lines than
   the maximum, so a greedy answer fails the samples, not only the timing test.
   level: 1 Medium (one unit per item, nothing reserved) · 2 Hard (+ several units per
          item, repeated or unstocked items in approved lists, empty lists) · 3 Very
          Hard (+ units already reserved by in-stock lines of the same order) */
export const kind = "python";
export const entry = "most_lines_filled";
export const signature = "def most_lines_filled(orders: list[dict]) -> list[int]:";
export const starter = `def most_lines_filled(orders):
    """orders: dicts with "lines" [(line_id, approved item ids)], "units" {item: units on hand}
    and "reserved" {item: units already used by in-stock lines of the same order}.
    One unit fills one line, and only a line whose approved list names its item.
    Return, per order, the largest number of lines that can be filled at once."""
    ...
`;

export const prelude = `
def _gen_orders(n_orders, seed, max_lines=40, reserve=False):
    x = seed

    def nxt():
        nonlocal x
        x = (1103515245 * x + 12345) % 2147483648
        return x >> 8
    orders = []
    for o in range(n_orders):
        n = max_lines // 2 + nxt() % (max_lines // 2 + 1)
        pool = ['itm-%d-%02d' % (o % 97, k) for k in range(max(3, n * 2 // 3))]
        units = {}
        for it in pool:
            c = nxt() % 3
            if c:
                units[it] = c
        lines = []
        for i in range(n):
            k = 1 + nxt() % 4
            lines.append(('ln-%03d' % i, [pool[(i * 7 + nxt()) % len(pool)] for _ in range(k)]))
        reserved = {}
        if reserve:
            for it in pool:
                if nxt() % 5 == 0:
                    reserved[it] = 1 + nxt() % 2
        orders.append({'lines': lines, 'units': units, 'reserved': reserved})
    return (orders,)
`.trim() + "\n";

/* Spare units per item after reservations. */
function spare(order) {
  const cap = {};
  for (const [it, n] of Object.entries(order.units)) cap[it] = Math.max(0, n - (order.reserved[it] || 0));
  return cap;
}

/* Max flow, Edmonds-Karp. Nodes: 0 source, 1..L lines, L+1..L+K items, L+K+1 sink. */
function maxFilled(order) {
  const cap = spare(order);
  const items = Object.keys(cap);
  const L = order.lines.length, K = items.length, N = L + K + 2, S = 0, T = N - 1;
  const idx = new Map(items.map((it, k) => [it, L + 1 + k]));
  const c = Array.from({ length: N }, () => new Map());
  const add = (u, v, w) => {
    c[u].set(v, (c[u].get(v) || 0) + w);
    if (!c[v].has(u)) c[v].set(u, 0);
  };
  order.lines.forEach(([, approved], i) => {
    add(S, i + 1, 1);
    for (const it of new Set(approved)) if (idx.has(it)) add(i + 1, idx.get(it), 1);
  });
  for (const it of items) add(idx.get(it), T, cap[it]);
  let flow = 0;
  for (;;) {
    const prev = new Array(N).fill(-1);
    prev[S] = S;
    const q = [S];
    for (let h = 0; h < q.length && prev[T] < 0; h++) {
      const u = q[h];
      for (const [v, w] of c[u]) if (w > 0 && prev[v] < 0) { prev[v] = u; q.push(v); }
    }
    if (prev[T] < 0) return flow;
    for (let v = T; v !== S; v = prev[v]) {        // every path carries one unit (line edges are 1)
      const u = prev[v];
      c[u].set(v, c[u].get(v) - 1);
      c[v].set(u, c[v].get(u) + 1);
    }
    flow += 1;
  }
}
export const oracle = (orders) => orders.map(maxFilled);

/* The likely wrong answer: lines in order, the first approved item with a unit left. */
function greedy(order) {
  const cap = spare(order);
  let f = 0;
  for (const [, approved] of order.lines) {
    const it = approved.find((x) => (cap[x] || 0) > 0);
    if (it !== undefined) { cap[it] -= 1; f += 1; }
  }
  return f;
}

const pyStr = (s) => "'" + s + "'";
const pyDict = (o) => "{" + Object.entries(o).map(([k, v]) => `${pyStr(k)}: ${v}`).join(", ") + "}";
const pyOrder = (o) =>
  `{'lines': [${o.lines.map(([id, a]) => `(${pyStr(id)}, [${a.map(pyStr).join(", ")}])`).join(", ")}], ` +
  `'units': ${pyDict(o.units)}, 'reserved': ${pyDict(o.reserved)}}`;
const pyArgs = (orders) => "([" + orders.map(pyOrder).join(", ") + "],)";
const pyOut = (xs) => "[" + xs.join(", ") + "]";

const WORDS = ["oat-milk", "soy-milk", "whole-milk", "greek-yogurt", "sourdough", "rye-bread", "brown-eggs", "free-range-eggs",
  "cheddar", "gouda", "basmati", "jasmine-rice", "penne", "fusilli", "spinach", "kale", "fuji-apple", "gala-apple",
  "cola-12pk", "seltzer-8pk", "ice-cream-pint", "frozen-peas", "tortillas", "pita"];

function randomOrder(r, level, items) {
  const L = level === 1 ? r.int(3, 5) : level === 2 ? r.int(4, 7) : r.int(5, 8);
  const pool = r.sample(items, Math.min(items.length, r.int(L - 1, L + 1)));
  const units = {};
  for (const it of pool) {
    const n = level === 1 ? (r.chance(0.85) ? 1 : 0) : r.pick([0, 1, 1, 1, 2, 2, 3]);
    if (n || (level >= 2 && r.chance(0.3))) units[it] = n;           // L2+: an item listed with 0 units
  }
  const lines = [];
  for (let i = 0; i < L; i++) {
    let approved = [];
    if (!(level >= 2 && r.chance(0.08))) {                         // L2+: the consumer chose a refund
      approved = r.sample(pool, Math.min(pool.length, r.int(1, 3)));
      if (level >= 2 && r.chance(0.12)) approved.push(approved[0]);  // a repeated item
      if (level >= 2 && r.chance(0.12)) approved.push(r.pick(items.filter((x) => !pool.includes(x))));
    }
    lines.push([`ln-${i + 1}`, approved]);
  }
  const reserved = {};
  if (level === 3) for (const it of pool) if (r.chance(0.3)) reserved[it] = r.int(1, 2);
  return { lines, units, reserved };
}

function sampleCase(r, level) {
  const items = r.sample(WORDS, 12).map((w) => `${w}-${r.int(10, 99)}`);
  for (let attempt = 0; attempt < 400; attempt++) {
    const first = randomOrder(r, level, items);
    const best = maxFilled(first);
    if (greedy(first) < best) {
      const orders = [first];
      for (let k = r.int(1, 2); k > 0; k--) orders.push(randomOrder(r, level, items));
      return r.shuffle(orders);
    }
  }
  throw new Error("DSH-L2-01: could not build a sample where first fit falls short");
}

export function generate(r, level) {
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const orders = sampleCase(r, level);
    samples.push({ args: pyArgs(orders), expect: pyOut(oracle(orders)) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const [a, b, c, d, e, f, g] = r.sample(WORDS, 7).map((w) => `${w}-${r.int(10, 99)}`);
  const one = (...xs) => Object.fromEntries(xs.map((x) => [x, 1]));
  const O = (lines, units, reserved = {}) => ({ lines: lines.map((ap, i) => [`ln-${i + 1}`, ap]), units, reserved });
  const chain = [a, b, c, d, e, f];                       // line k approves item k then k+1; the last approves item 0
  const edges = [
    ["taking the first approved item can block a line that has no other choice",
      [O([[a, b], [a]], one(a, b))]],
    ["fewest options first is not enough either",
      [O([[c, d], [a, d], [b, d], [b, c]], one(a, b, c, d))]],
    ["a long chain of moves: every line shifts to its second choice",
      [O([...chain.slice(0, -1).map((x, k) => [x, chain[k + 1]]), [a]], one(...chain))]],
    ["an item with two units fills two lines",
      [O([[a], [a], [a]], { [a]: 2 })]],
    ["approved items with no units, or not stocked at all, fill nothing",
      [O([[a], [b, c]], { [a]: 0, [d]: 3 })]],
    ["a line with an empty approved list (refund) is never filled",
      [O([[], [a]], { [a]: 5 })]],
    ["an item repeated on one approved list still fills that line once",
      [O([[a, a, a], [b]], { [a]: 2 })]],
    ["more units than lines fills every line",
      [O([[a, b], [b], [a, c]], { [a]: 4, [b]: 4, [c]: 4 })]],
    ["units never move between orders",
      [O([[a], [a]], one(a)), O([[a], [g]], one(g)), O([], one(a, b))]],
  ];
  if (level === 3) {
    edges.push(["units reserved by in-stock lines come off first",
      [O([[a], [a], [b]], { [a]: 2, [b]: 1 }, { [a]: 1 })]]);
    edges.push(["more reserved than on hand leaves zero, never a negative count",
      [O([[a, b], [b]], { [a]: 1, [b]: 1 }, { [a]: 3 })]]);
    edges.push(["a reservation of an item no line approves changes nothing",
      [O([[a], [b]], one(a, b, c), { [c]: 1 })]]);
  }
  for (const [name, orders] of edges) tests.push({ name, args: pyArgs(orders), expect: pyOut(oracle(orders)) });

  // Timing: compared with the reference at check time. Trying every assignment is
  // exponential in the lines of one order; augmenting paths are fast.
  const maxLines = level === 1 ? 40 : 60;
  tests.push({
    name: `1,500 orders with ${maxLines / 2} to ${maxLines} out-of-stock lines each in time`,
    args: `_gen_orders(1500, ${r.int(1, 1_000_000)}, ${maxLines}, ${level === 3 ? "True" : "False"})`,
    limit_s: 8,
  });

  return {
    vars: {
      max_lines: maxLines,
      level_rule: level === 1
        ? "In this exercise every item has at most one unit, and `\"reserved\"` is always empty."
        : level === 2
          ? "An item can have several units. An approved list can repeat an item or name an item the store does not have (no entry in `\"units\"`, or 0 units). `\"reserved\"` is always empty in this exercise."
          : "An item can have several units. An approved list can repeat an item or name an item the store does not have (no entry in `\"units\"`, or 0 units). `\"reserved\"` maps an item to units that in-stock lines of the same order already use: they come off that item's units first, and an item never has fewer than zero units left.",
    },
    samples,
    tests,
  };
}
