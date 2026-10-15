/* PYP-L2-01 — Settling a group's shared expenses (Python, heaps).
   Simulated practice scenario. All data is generated from the seed.

   Contract (python): entry, signature, starter, prelude, generate(r, level) ->
     { vars, samples: [{args, expect}], tests: [{name, args, expect?, limit_s?}] }.
   expect comes from oracle() below: it builds every member's net balance (BigInt
   for the currency conversion), then applies the transfer rule literally, scanning
   every member for the largest creditor and the largest debtor before each
   transfer. The evaluator's reference keeps two heaps, so each checks the other.
   level: 1 Medium (one currency, remainder to the first listed participants)
          · 2 Hard (+ repayments already made, the remainder rule varies by seed)
          · 3 Very Hard (+ expenses in other currencies with minor-unit exponents
            0, 2 and 3, converted once with half-up rounding before the split) */
export const kind = "python";
export const entry = "settle_group";
export const signature = "def settle_group(members: list[str], expenses: list[tuple[str, int, str, list[str]]], repaid: list[tuple[str, str, int]], currencies: dict[str, tuple[int, int, int]], home: str, remainder: str) -> list[tuple[str, str, int]]:";
export const starter = `def settle_group(members, expenses, repaid, currencies, home, remainder):
    """members: member ids in the order they joined the group.
    expenses: (payer, amount, currency, participants), amount in the currency's
    minor units, split equally among participants.
    repaid: (from_member, to_member, amount) already paid directly, in home minor units.
    currencies: code -> (exponent, num, den): one major unit is worth num/den
    major units of home.
    remainder: 'listed' or 'joined' -- who gets the leftover minor units of a split.
    Return the transfers (from_member, to_member, amount) in the order the
    largest-creditor-largest-debtor rule makes them."""
    ...
`;

export const prelude = `
def _gen_group(n_members, n_expenses, seed, level=1, remainder='listed'):
    x = seed

    def nxt():
        nonlocal x
        x = (1103515245 * x + 12345) % 2147483648
        return x >> 8
    members = ['m%06d' % ((k * 7919) % 1000003) for k in range(n_members)]
    home = 'USD'
    currencies = {'USD': (2, 1, 1)}
    if level == 3:
        home = 'EUR'
        currencies = {'EUR': (2, 1, 1), 'JPY': (0, 61, 10000), 'KWD': (3, 296, 100), 'GBP': (2, 117, 100)}
    codes = sorted(currencies)
    expenses = []
    for _ in range(n_expenses):
        payer = members[nxt() % n_members]
        k = 2 + nxt() % 5
        parts = []
        for _ in range(k):
            m = members[nxt() % n_members]
            if m not in parts:
                parts.append(m)
        cur = codes[nxt() % len(codes)] if level == 3 else home
        expenses.append((payer, 100 + nxt() % 90000, cur, parts))
    repaid = []
    if level >= 2:
        for _ in range(n_expenses // 10):
            a = members[nxt() % n_members]
            b = members[nxt() % n_members]
            if a != b:
                repaid.append((a, b, 1 + nxt() % 5000))
    return members, expenses, repaid, currencies, home, remainder
`.trim() + "\n";

// Converted amount in home minor units, rounded half up once (BigInt, exact).
function toHome(amount, cur, currencies, home) {
  if (cur === home) return amount;
  const [e, num, den] = currencies[cur];
  const eh = currencies[home][0];
  const top = BigInt(amount) * BigInt(num) * 10n ** BigInt(eh);
  const bottom = BigInt(den) * 10n ** BigInt(e);
  const q = top / bottom, rem = top - q * bottom;
  return Number(2n * rem >= bottom ? q + 1n : q);
}

export function balancesOf(members, expenses, repaid, currencies, home, remainder) {
  const bal = new Map(members.map((m) => [m, 0]));
  const joined = new Map(members.map((m, i) => [m, i]));
  for (const [payer, amount, cur, parts] of expenses) {
    const total = toHome(amount, cur, currencies, home);
    bal.set(payer, bal.get(payer) + total);
    const k = parts.length, base = Math.floor(total / k), extra = total - base * k;
    const who = remainder === "listed" ? parts.slice() : parts.slice().sort((a, b) => joined.get(a) - joined.get(b));
    who.forEach((m, i) => bal.set(m, bal.get(m) - base - (i < extra ? 1 : 0)));
  }
  for (const [a, b, amt] of repaid) {
    bal.set(a, bal.get(a) + amt);
    bal.set(b, bal.get(b) - amt);
  }
  return bal;
}

// The rule, literally: before every transfer, scan all members in join order.
export function oracle(members, expenses, repaid, currencies, home, remainder) {
  const bal = balancesOf(members, expenses, repaid, currencies, home, remainder);
  const out = [];
  for (;;) {
    let c = null, d = null;
    for (const m of members) {
      const v = bal.get(m);
      if (v > 0 && (c === null || v > bal.get(c))) c = m;     // strict: ties keep the earlier member
      if (v < 0 && (d === null || v < bal.get(d))) d = m;
    }
    if (c === null || d === null) break;
    const x = Math.min(bal.get(c), -bal.get(d));
    out.push([d, c, x]);
    bal.set(c, bal.get(c) - x);
    bal.set(d, bal.get(d) + x);
  }
  return out;
}

const q = (s) => "'" + s + "'";
const pyList = (xs) => "[" + xs.map(q).join(", ") + "]";
const pyCur = (cs) => "{" + Object.entries(cs).map(([k, [e, n, d]]) => `${q(k)}: (${e}, ${n}, ${d})`).join(", ") + "}";
const pyArgs = (c) => "(" + pyList(c.members) + ", [" +
  c.expenses.map(([p, a, cur, parts]) => `(${q(p)}, ${a}, ${q(cur)}, ${pyList(parts)})`).join(", ") + "], [" +
  c.repaid.map(([a, b, x]) => `(${q(a)}, ${q(b)}, ${x})`).join(", ") + "], " +
  pyCur(c.currencies) + ", " + q(c.home) + ", " + q(c.remainder) + ")";
const pyOut = (ts) => "[" + ts.map(([a, b, x]) => `(${q(a)}, ${q(b)}, ${x})`).join(", ") + "]";
const run = (c) => oracle(c.members, c.expenses, c.repaid, c.currencies, c.home, c.remainder);

const NAMES = ["ana", "ben", "chidi", "dara", "eli", "fen", "gus", "hana", "ivo", "jun", "kemi", "lars", "mila", "noor", "oren", "priya"];

function currencySet(r, level) {
  if (level < 3) {
    const home = r.pick(["USD", "EUR", "GBP"]);
    return { home, currencies: { [home]: [2, 1, 1] } };
  }
  const home = r.pick(["USD", "EUR", "GBP"]);
  const currencies = { [home]: [2, 1, 1] };
  currencies.JPY = [0, 2 * r.int(28, 37) + 1, 10000];  // one yen in home major units (hypothetical, odd)
  currencies.KWD = [3, r.int(280, 340), 100];
  const other = home === "USD" ? "EUR" : "USD";
  currencies[other] = [2, r.int(80, 140), 100];
  return { home, currencies };
}

function randomCase(r, level, remainder) {
  for (let attempt = 0; attempt < 100; attempt++) {
    const members = r.sample(NAMES, r.int(4, level === 1 ? 6 : 7));
    const { home, currencies } = currencySet(r, level);
    const codes = Object.keys(currencies);
    const expenses = [];
    for (let i = 0, n = r.int(3, 6); i < n; i++) {
      const payer = r.pick(members);
      let parts = r.sample(members, r.int(2, members.length));
      if (r.chance(0.3)) parts = parts.filter((m) => m !== payer).concat(parts.includes(payer) ? [payer] : []);
      const cur = level === 3 && r.chance(0.5) ? r.pick(codes) : home;
      const e = currencies[cur][0];
      const amount = e === 0 ? r.int(800, 30000) : e === 3 ? r.int(2000, 90000) + r.int(0, 9) : r.int(500, 25000) + r.pick([0, 1, 2]);
      expenses.push([payer, amount, cur, parts]);
    }
    const repaid = [];
    if (level >= 2) {
      for (let i = 0, n = r.int(1, 2); i < n; i++) {
        const [a, b] = r.sample(members, 2);
        repaid.push([a, b, 100 * r.int(1, 40)]);
      }
    }
    const c = { members, expenses, repaid, currencies, home, remainder };
    if (run(c).length >= 2) return c;
  }
  throw new Error("PYP-L2-01: could not build a sample with at least two transfers");
}

// The smallest amount of `cur` that converts to exactly half a home minor unit above an integer.
function halfwayAmount(currencies, cur, home) {
  const [e, num, den] = currencies[cur];
  const eh = currencies[home][0];
  for (let a = 1; a < 200000; a++) {
    const top = BigInt(a) * BigInt(num) * 10n ** BigInt(eh), bottom = BigInt(den) * 10n ** BigInt(e);
    if ((2n * (top % bottom)) === bottom && top / bottom >= 2n) return a;
  }
  return null;
}

export function generate(r, level) {
  const remainder = level === 1 ? "listed" : r.pick(["listed", "joined"]);
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const c = randomCase(r, level, remainder);
    samples.push({ args: pyArgs(c), expect: pyOut(run(c)) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const [A, B, C, D, E] = r.sample(NAMES, 5);
  const home = r.pick(["USD", "EUR", "GBP"]);
  const one = { [home]: [2, 1, 1] };
  const k = r.int(2, 9);
  const mk = (members, expenses, repaid = [], currencies = one) => ({ members, expenses, repaid, currencies, home, remainder });
  const edges = [
    ["a split with leftover minor units follows the remainder rule",
      // listed order differs from join order, so the two rules disagree
      mk([A, B, C], [[A, 3000 * k + 1001, home, [C, B, A]]])],
    ["a payer who is not a participant is owed the whole amount",
      mk([A, B, C], [[A, 1500 * k, home, [B, C]]])],
    ["everyone already even makes no transfers",
      mk([A, B, C], [[A, 300 * k, home, [A, B, C]], [B, 300 * k, home, [A, B, C]], [C, 300 * k, home, [A, B, C]]])],
    ["an expense for the payer alone changes nothing",
      mk([A, B], [[A, 777 * k, home, [A]], [B, 400 * k, home, [A, B]]])],
    ["equal creditors: the one who joined first is paid first",
      mk([A, B, C], [[B, 200 * k, home, [C]], [A, 200 * k, home, [C]]])],
    ["equal debtors: the one who joined first pays first",
      mk([A, B, C], [[A, 600 * k, home, [B, C]]])],
    ["one transfer that clears a creditor and a debtor together",
      mk([A, B, C, D], [[A, 500 * k, home, [C]], [B, 300 * k, home, [D]]])],
    ["largest first is the rule, even when fewer transfers exist",
      // balances +4, +3, +2, -5, -4 (times k): the rule makes four transfers, three would do
      mk([A, B, C, D, E], [[A, 400 * k, home, [E]], [B, 300 * k, home, [D]], [C, 200 * k, home, [D]]])],
    ["a member in no expense never appears",
      mk([A, B, C, D], [[A, 900 * k, home, [A, C]]])],
  ];
  if (level >= 2) {
    edges.push(["a repayment already made reduces what is still owed",
      mk([A, B, C], [[A, 1200 * k, home, [A, B, C]]], [[B, A, 100 * k]])]);
    edges.push(["a repayment that overshoots turns a debtor into a creditor",
      mk([A, B, C], [[A, 600 * k, home, [B, C]]], [[B, A, 500 * k]])]);
    edges.push(["remainder units over several expenses add up",
      mk([A, B, C], [[A, 1000, home, [B, C, A]], [B, 1000, home, [C, A, B]], [C, 1001, home, [A, B, C]]])]);
  }
  if (level === 3) {
    const { currencies } = currencySet(r, 3);
    const h = Object.keys(currencies)[0];
    const fx = (members, expenses, repaid = []) => ({ members, expenses, repaid, currencies, home: h, remainder });
    const half = halfwayAmount(currencies, "JPY", h);
    if (half !== null) edges.push(["a conversion that lands exactly on half a minor unit rounds up",
      fx([A, B], [[A, half, "JPY", [B]]])]);
    edges.push(["a three-decimal currency is converted with its own exponent",
      fx([A, B, C], [[A, 12345 + k, "KWD", [B, C]]])]);
    edges.push(["a zero-decimal currency is converted with its own exponent",
      fx([A, B], [[B, 4321 * k, "JPY", [A, B]]])]);
    edges.push(["the conversion is rounded once, before the split, not per share",
      fx([A, B, C, D], [[A, 1001 + 10 * k, "JPY", [B, C, D]]])]);
  }
  for (const [name, c] of edges) tests.push({ name, args: pyArgs(c), expect: pyOut(run(c)) });

  // Timing: compared with the reference at check time. About 40 000 members end with a
  // non-zero balance, so a scan for the largest before every transfer is quadratic.
  tests.push({
    name: "40,000 members and 64,000 expenses settled in time",
    args: `_gen_group(40000, 64000, ${r.int(1, 1_000_000)}, ${level}, '${remainder}')`,
    limit_s: 8,
  });

  return {
    vars: {
      remainder_rule: remainder === "listed"
        ? "The tests use `remainder = 'listed'`: the leftover units go one each to the first participants in the order the expense lists them."
        : "The tests use `remainder = 'joined'`: the leftover units go one each to the participants who joined the group first, in `members` order.",
      repaid_rule: level === 1
        ? "In this exercise `repaid` is always empty."
        : "`repaid` lists payments members already made to each other directly, in home minor units: the payer's balance goes up by the amount and the receiver's goes down. A repayment can overshoot what was owed.",
      currency_rule: level === 3
        ? "Expenses may be in other currencies. `currencies[code] = (exponent, num, den)`: the currency has `exponent` decimal places (0, 2 or 3), and one major unit of it is worth `num / den` major units of `home`. An expense is converted to home minor units once, as `amount × num × 10^e_home / (den × 10^e_code)`, rounded half up, and only then split."
        : "In this exercise every expense is in `home`, and `currencies` holds only `home`.",
    },
    samples,
    tests,
  };
}
