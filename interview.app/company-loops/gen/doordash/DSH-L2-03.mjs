/* DSH-L2-03 — Debug the cart total calculator (debug, Python).
   Simulated practice scenario. All data is generated from the seed.

   Contract (debug): like python, but `starter` is buggy code the candidate fixes.
   The evaluator's reference is the fixed code (exact fractions). expect comes from
   oracle() below, an independent JavaScript implementation of the specification in
   whole integers scaled by 100 and 10 000.
   Planted bugs (see the evaluator notes): modifier prices are added once per line, not
   once per unit; the order-level promotion is taken from the subtotal before item-level
   promotions; the membership waiver tests the discounted subtotal, not the subtotal
   before promotions; tax is charged on the subtotal before promotions; each line's
   item discount is rounded down on its own instead of rounding once.
   level: 1 Medium (modifiers, item promotions, members well above the minimum) ·
          2 Hard (+ order promotions with caps, members near the minimum) · 3 Very Hard
          (+ percentages that leave fractions of a cent on several lines) */
export const kind = "debug";
export const entry = "price_carts";
export const signature = "def price_carts(carts: list[dict], fees: dict) -> list[dict]:";
export const starter = `import math
from fractions import Fraction


def _half_up(x):
    """An exact amount in cents -> whole cents, halves rounded up."""
    return math.floor(x + Fraction(1, 2))


def price_carts(carts, fees):
    out = []
    for cart in carts:
        subtotal = 0
        item_discount = 0
        for line in cart["lines"]:
            mods = sum(m["price"] for m in line.get("modifiers", []))
            line_total = line["price"] * line["qty"] + mods
            subtotal += line_total
            item_discount += line_total * line.get("promo_pct", 0) // 100
        order_discount = 0
        promo = cart.get("order_promo")
        if promo:
            order_discount = min(promo["max_off"], Fraction(subtotal * promo["pct"], 100))
        discounted = _half_up(subtotal - item_discount - order_discount)
        delivery = fees["delivery"]
        if cart["member"] and discounted >= fees["member_min"]:
            delivery = 0
        tax = _half_up(Fraction(subtotal * fees["tax_bps"], 10000))
        out.append({"subtotal": subtotal, "discount": subtotal - discounted, "delivery_fee": delivery,
                    "tax": tax, "total": discounted + delivery + tax})
    return out
`;

export const prelude = `
def _gen_carts(n, seed):
    x = seed

    def nxt():
        nonlocal x
        x = (1103515245 * x + 12345) % 2147483648
        return x >> 8
    carts = []
    for i in range(n):
        lines = []
        for k in range(1 + nxt() % 6):
            mods = [{'name': 'mod-%d' % m, 'price': 25 * (nxt() % 9)} for m in range(nxt() % 3)]
            lines.append({'item': 'item-%d' % (nxt() % 500), 'price': 99 + nxt() % 2400, 'qty': 1 + nxt() % 4,
                          'modifiers': mods, 'promo_pct': (0, 0, 10, 15, 20, 25, 33)[nxt() % 7]})
        promo = None
        if nxt() % 3 == 0:
            promo = {'pct': (10, 15, 20, 25, 40, 50)[nxt() % 6], 'max_off': 500 * (1 + nxt() % 4)}
        carts.append({'member': nxt() % 2 == 0, 'lines': lines, 'order_promo': promo})
    fees = {'delivery': 299 + 100 * (seed % 4), 'member_min': 1200 + 300 * (seed % 3), 'tax_bps': 600 + 25 * (seed % 15)}
    return carts, fees
`.trim() + "\n";

// The specification, in integers: amounts x100 after item promotions, x10 000 after the order promotion.
export function oracle(carts, fees) {
  return carts.map((cart) => {
    let subtotal = 0, itemOff100 = 0;
    for (const l of cart.lines) {
      const unit = l.price + (l.modifiers || []).reduce((s, m) => s + m.price, 0);   // modifiers are per unit
      const lineTotal = unit * l.qty;
      subtotal += lineTotal;
      itemOff100 += lineTotal * (l.promo_pct || 0);
    }
    const after100 = subtotal * 100 - itemOff100;                                    // item promotions first
    const p = cart.order_promo;
    const orderOff10k = p ? Math.min(p.max_off * 10000, after100 * p.pct) : 0;
    const discounted = Math.floor((after100 * 100 - orderOff10k + 5000) / 10000);     // rounded once, half up
    const delivery = cart.member && subtotal >= fees.member_min ? 0 : fees.delivery;  // before promotions
    const tax = Math.floor((discounted * fees.tax_bps + 5000) / 10000);               // on the discounted subtotal
    return { subtotal, discount: subtotal - discounted, delivery_fee: delivery, tax, total: discounted + delivery + tax };
  });
}

function py(v) {
  if (v === null || v === undefined) return "None";
  if (typeof v === "boolean") return v ? "True" : "False";
  if (typeof v === "number") return String(v);
  if (typeof v === "string") return "'" + v + "'";
  if (Array.isArray(v)) return "[" + v.map(py).join(", ") + "]";
  return "{" + Object.entries(v).map(([k, x]) => `'${k}': ${py(x)}`).join(", ") + "}";
}
const pyArgs = (carts, fees) => `(${py(carts)}, ${py(fees)})`;

const MENU = [["spicy-ramen", 1450, [["extra-egg", 150], ["extra-noodles", 200]]], ["margherita-12in", 1699, [["extra-cheese", 250], ["basil", 50]]],
  ["chicken-bowl", 1195, [["guacamole", 275], ["double-chicken", 395]]], ["iced-latte", 525, [["oat-milk", 75], ["extra-shot", 100]]],
  ["veggie-burrito", 1049, [["sour-cream", 75], ["queso", 150]]], ["pad-thai", 1395, [["shrimp", 395], ["tofu", 200]]],
  ["cheeseburger", 999, [["bacon", 199], ["avocado", 175]]], ["caesar-salad", 1125, [["salmon", 495], ["chicken", 300]]]];

function randomCart(r, level, fees) {
  const n = level === 1 ? r.int(1, 3) : r.int(2, 4);
  const lines = r.sample(MENU, n).map(([item, price, mods]) => {
    const pcts = level === 3 ? [0, 10, 15, 25, 33, 35] : [0, 0, 10, 20, 25, 50];
    const nudge = level === 3 ? r.pick([0, 1, 3, 5]) : 0;                           // odd cents leave fractions
    return {
      item, price: price + nudge, qty: r.int(1, 3),
      modifiers: r.sample(mods, r.int(0, 2)).map(([name, p]) => ({ name, price: p })),
      promo_pct: r.pick(pcts),
    };
  });
  const promo = level >= 2 && r.chance(0.6) ? { pct: r.pick([10, 15, 20, 25, 40]), max_off: 100 * r.pick([3, 5, 8, 10]) } : null;
  return { member: r.chance(0.6), lines, order_promo: promo };
}

export function generate(r, level) {
  const samples = [];
  for (let i = 0; i < 2; i++) {
    const fees = { delivery: r.pick([199, 299, 399, 499]), member_min: 100 * r.pick([12, 15, 20]), tax_bps: r.pick([0, 625, 725, 875, 1025]) };
    if (level === 1) fees.member_min = 1000;
    const carts = Array.from({ length: r.int(3, 4) }, () => randomCart(r, level, fees));
    samples.push({ args: pyArgs(carts, fees), expect: py(oracle(carts, fees)) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const [A, B] = r.sample(MENU, 2).map((m) => m[0]);
  const fee = r.pick([299, 399]);
  const F = (tax_bps, member_min = 1500) => ({ delivery: fee, member_min, tax_bps });
  const L = (item, price, qty, promo_pct = 0, modifiers = []) => ({ item, price, qty, modifiers, promo_pct });
  const C = (lines, order_promo = null, member = false) => ({ member, lines, order_promo });
  const edges = [
    ["a modifier is charged once per unit",
      [C([L(A, 850, 2, 0, [{ name: "extra-cheese", price: 150 }])])], F(800)],
    ["item promotions come before the order promotion",
      [C([L(A, 2000, 1, 10)], { pct: 20, max_off: 1000 })], F(0)],
    ["the membership minimum is tested on the subtotal before promotions",
      [C([L(A, 1500, 1)], { pct: 25, max_off: 1000 }, true)], F(0, 1200)],
    ["tax is charged on the discounted subtotal",
      [C([L(A, 2000, 1, 10)])], F(800)],
    ["fractions of a cent from several lines add up before rounding",
      [C([L(A, 1005, 1, 10), L(B, 1005, 1, 10)])], F(0)],
    ["half a cent rounds up, once",
      [C([L(A, 1005, 1, 10)])], F(0)],
    ["the order promotion stops at its cap",
      [C([L(A, 3000, 1)], { pct: 50, max_off: 500 })], F(0)],
    ["a member exactly at the minimum gets free delivery; a non-member pays",
      [C([L(A, 750, 2)], null, true), C([L(A, 750, 2)], null, false)], F(0)],
  ];
  for (const [name, carts, fees] of edges) tests.push({ name, args: pyArgs(carts, fees), expect: py(oracle(carts, fees)) });

  tests.push({ name: "30,000 carts in time", args: `_gen_carts(30000, ${r.int(1, 1_000_000)})`, limit_s: 8 });

  return {
    vars: {
      replay_rule: level === 1
        ? "This replay has modifiers and item-level promotions; the checks also cover order-level promotions, the membership minimum and rounding."
        : level === 2
          ? "This replay adds order-level promotions with caps and members near the minimum; the checks also cover rounding."
          : "This replay adds percentages and prices that leave fractions of a cent on several lines, on top of order-level promotions with caps and members near the minimum.",
    },
    samples,
    tests,
  };
}
