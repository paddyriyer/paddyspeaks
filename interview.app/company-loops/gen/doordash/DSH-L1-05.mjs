/* DSH-L1-05 — Repeat carts: orders that exactly repeat one of the same account's earlier carts (Python, hashing).
   Simulated practice scenario. All data is generated from the seed.

   Contract (python): entry, signature, starter, prelude, generate(r, level) ->
     { vars, samples: [{args, expect}], tests: [{name, args, expect?, limit_s?}] }.
   expect comes from oracle() below: for every order it walks back through all earlier orders
   and compares item -> total quantity maps built from scratch. The evaluator's reference keys
   a hash map on (account, canonical sorted cart), so each checks the other.
   level: 1 Medium (each item at most once per cart, lines in any order, quantities matter)
          2 Hard (+ the same item on several lines adds up, quantity-0 lines are ignored, an
                  order with no positive line returns None and is never a match)
          3 Very Hard (+ modifiers: the same item with different options is a different line;
                  the order of options does not matter) */
export const kind = "python";
export const entry = "repeat_carts";
export const signature = "def repeat_carts(orders: list[tuple[str, str, list[tuple]]]) -> list[str | None]:";
export const starter = `def repeat_carts(orders):
    """orders: (order_id, account_id, lines) in the order they were placed.
    A line is (item_id, quantity), or (item_id, quantity, options) where options is a
    tuple of modifier names.
    Return, per order, the order_id of the most recent earlier order by the same
    account with exactly the same cart, or None."""
    ...
`;

export const prelude = `
def _gen_cart_orders(n_accounts, per_account, seed, level=3):
    x = seed

    def rnd(m):
        nonlocal x
        x = (6364136223846793005 * x + 1442695040888963407) % 18446744073709551616
        return (x >> 33) % m
    items = ['itm_%03d' % i for i in range(400)]
    opts = ('no_onion', 'extra_cheese', 'gluten_free', 'spicy', 'no_ice', 'large')
    orders, hist = [], {}
    for k in range(n_accounts * per_account):
        acct = 'acct_%04d' % rnd(n_accounts)
        h = hist.setdefault(acct, [])
        if h and rnd(10) == 0:
            lines = list(h[rnd(len(h))])
            lines.reverse()
        else:
            lines, used = [], set()
            for _ in range(1 + rnd(5)):
                it = items[rnd(len(items))]
                if level == 1 and it in used:
                    continue
                used.add(it)
                q = 1 + rnd(3) if level == 1 else rnd(4)
                if level == 3 and rnd(2):
                    o = []
                    for _ in range(1 + rnd(2)):
                        p = opts[rnd(6)]
                        if p not in o:
                            o.append(p)
                    lines.append((it, q, tuple(o)))
                else:
                    lines.append((it, q))
            h.append(lines)
        orders.append(('o%07d' % k, acct, lines))
    return (orders,)
`.trim() + "\n";

// For every order, rebuild and compare against every earlier order of the same account. Small inputs only.
function cartKey(lines) {
  const m = new Map();
  for (const ln of lines) {
    const k = ln.length > 2 && ln[2].length ? ln[0] + "|" + [...ln[2]].sort().join(",") : ln[0] + "|";
    m.set(k, (m.get(k) || 0) + ln[1]);
  }
  return [...m.entries()].filter(([, q]) => q > 0).map(([k, q]) => k + "=" + q).sort().join(";");
}
export function oracle(orders) {
  return orders.map(([, acct, lines], i) => {
    const k = cartKey(lines);
    if (!k) return null;
    for (let j = i - 1; j >= 0; j--) if (orders[j][1] === acct && cartKey(orders[j][2]) === k) return orders[j][0];
    return null;
  });
}

const pyLine = (ln) => (ln.length > 2 ? `('${ln[0]}', ${ln[1]}, (${ln[2].map((o) => `'${o}'`).join(", ")}${ln[2].length === 1 ? "," : ""}))` : `('${ln[0]}', ${ln[1]})`);
const pyArgs = (orders) => "([" + orders.map(([id, a, lines]) => `('${id}', '${a}', [${lines.map(pyLine).join(", ")}])`).join(", ") + "],)";
const pyOut = (xs) => "[" + xs.map((x) => (x === null ? "None" : `'${x}'`)).join(", ") + "]";
const run = (orders) => oracle(orders);

const MENU = ["pad_thai", "spring_rolls", "green_curry", "mango_rice", "burrito", "chips_salsa", "horchata", "poke_bowl", "miso_soup", "latte", "croissant", "bagel", "oat_milk", "bananas"];
const OPTS = ["no_onion", "extra_cheese", "gluten_free", "spicy", "no_ice", "large"];

function randomCase(r, level) {
  const accts = r.sample(["acct_ana", "acct_ben", "acct_cho", "acct_dev", "acct_eli"], r.int(2, 3));
  const menu = r.sample(MENU, 6);
  const orders = [];
  const hist = new Map();
  let oid = r.int(1000, 8000);
  const n = r.int(8, 11);
  for (let i = 0; i < n; i++) {
    const a = r.pick(accts);
    const h = hist.get(a) || [];
    let lines;
    if (h.length && r.chance(0.4)) {
      lines = r.shuffle(r.pick(h));
      if (level >= 2 && r.chance(0.3)) {
        // Same cart written differently: split one line's quantity over two lines.
        const idx = lines.findIndex((ln) => ln[1] >= 2);
        if (idx >= 0) { const ln = lines[idx]; lines = lines.slice(); lines.splice(idx, 1, [ln[0], 1, ...ln.slice(2)], [ln[0], ln[1] - 1, ...ln.slice(2)]); }
      }
      if (level === 3 && r.chance(0.3)) lines = lines.map((ln) => (ln.length > 2 ? [ln[0], ln[1], ln[2].slice().reverse()] : ln));
      if (r.chance(0.3)) lines = lines.map((ln, j) => (j === 0 ? [ln[0], ln[1] + 1, ...ln.slice(2)] : ln)); // near miss
    } else {
      lines = r.sample(menu, r.int(1, 3)).map((it) => {
        const q = r.int(1, 3);
        return level === 3 && r.chance(0.4) ? [it, q, r.sample(OPTS, r.int(1, 2))] : [it, q];
      });
      if (level >= 2 && r.chance(0.2)) lines.push([r.pick(menu), 0]);
    }
    h.push(lines);
    hist.set(a, h);
    orders.push(["o" + (oid += r.int(1, 30)), a, lines]);
  }
  return orders;
}

export function generate(r, level) {
  const samples = [];
  for (let i = 0; i < 3; i++) {
    let c;
    for (let t = 0; t < 40; t++) { c = randomCase(r, level); const g = run(c); if (g.some((x) => x !== null) && g.some((x) => x === null)) break; }
    samples.push({ args: pyArgs(c), expect: pyOut(run(c)) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const [A, B] = r.sample(["acct_ana", "acct_ben", "acct_cho", "acct_dev"], 2);
  const [x, y, z] = r.sample(MENU, 3);
  const q = r.int(1, 3);
  let id = r.int(100, 900);
  const o = () => "o" + (id += r.int(1, 9));
  const edges = [
    ["the same lines in a different order are the same cart",
      [[o(), A, [[x, q], [y, 1]]], [o(), A, [[y, 1], [x, q]]]]],
    ["a different quantity is a different cart",
      [[o(), A, [[x, q], [y, 1]]], [o(), A, [[x, q + 1], [y, 1]]]]],
    ["another account's identical cart is not a repeat",
      [[o(), A, [[x, q]]], [o(), B, [[x, q]]], [o(), B, [[x, q]]]]],
    ["the most recent earlier match is reported",
      [[o(), A, [[x, 1]]], [o(), A, [[y, 2]]], [o(), A, [[x, 1]]], [o(), A, [[x, 1]]]]],
    ["a cart that is a subset of an earlier one is not a repeat",
      [[o(), A, [[x, 1], [y, 1], [z, 2]]], [o(), A, [[x, 1], [y, 1]]]]],
  ];
  if (level >= 2) {
    edges.push(["the same item on two lines adds up",
      [[o(), A, [[x, 2], [y, 1]]], [o(), A, [[x, 1], [y, 1], [x, 1]]]]]);
    edges.push(["a quantity-0 line is ignored",
      [[o(), A, [[x, q]]], [o(), A, [[z, 0], [x, q]]]]]);
    edges.push(["an order with no positive line returns None and is never a match",
      [[o(), A, [[x, 0]]], [o(), A, []], [o(), A, [[y, 0]]], [o(), A, [[x, 1]]]]]);
  }
  if (level === 3) {
    edges.push(["options in a different order are the same line",
      [[o(), A, [[x, 1, ["spicy", "no_onion"]]]], [o(), A, [[x, 1, ["no_onion", "spicy"]]]]]]);
    edges.push(["the same item with different options is a different line",
      [[o(), A, [[x, 1, ["spicy"]], [x, 1, []]]], [o(), A, [[x, 2, []]]], [o(), A, [[x, 1, []], [x, 1, ["spicy"]]]]]]);
    edges.push(["an empty options tuple is the same as no options",
      [[o(), A, [[y, 2]]], [o(), A, [[y, 2, []]]]]]);
  }
  for (const [name, cse] of edges) tests.push({ name, args: pyArgs(cse), expect: pyOut(run(cse)) });

  // Timing: compared with the reference at check time. Two heavy accounts with tens of
  // thousands of orders each: comparing with every earlier order, or `cart in earlier_carts`
  // on a list, is quadratic per account.
  const seed = r.int(1, 1_000_000);
  const per = level === 3 ? 18000 : 25000;
  tests.push({
    name: `2 accounts with ${per.toLocaleString("en-US")} orders each in time`,
    args: `_gen_cart_orders(2, ${per}, ${seed}, ${level})`,
    limit_s: 8,
  });

  return {
    vars: {
      line_rule: level === 1
        ? "In this exercise every line is `(item_id, quantity)` with a quantity of at least 1, and an item appears at most once per cart."
        : level === 2
          ? "Every line is `(item_id, quantity)`. The same item may appear on several lines of one order: its quantities add up. A line with quantity 0 is ignored, and an order with no line of positive quantity returns `None` and is never anyone's match."
          : "A line is `(item_id, quantity)` or `(item_id, quantity, options)`, where `options` is a tuple of distinct modifier names in any order; no options and an empty tuple are the same. A cart line is an item together with its set of options: the same item with different options is a different line. Quantities of the same line add up across rows, a line with quantity 0 is ignored, and an order with no line of positive quantity returns `None` and is never anyone's match.",
    },
    samples,
    tests,
  };
}
