/* BLK-L2-02 — Which open invoices does a lump payment cover? (Python).
   Simulated practice scenario. All data is generated from the seed.

   Contract (python): entry, signature, starter, prelude, generate(r, level) ->
     { vars, samples: [{args, expect}], tests: [{name, args, expect?, limit_s?}] }.
   expect comes from oracle() below: every subset of a small invoice list is summed
   (brute force, at most 2^14 subsets here). The evaluator's reference is a
   meet-in-the-middle count over the two halves, written independently.
   level: 1 Medium (distinct amounts) · 2 Hard (+ equal amounts, so several sets can
          match) · 3 Very Hard (+ credit notes with negative amounts) */
export const kind = "python";
export const entry = "match_invoices";
export const signature = "def match_invoices(invoices: list[tuple[str, int]], payment: int) -> tuple[int, list[str]]:";
export const starter = `def match_invoices(invoices, payment):
    """invoices: (invoice_id, amount) open items for one customer, amounts in
    integer cents (a credit note has a negative amount). payment: a lump sum in
    cents, at least 1.
    Return (count, ids): count is the number of different sets of open items whose
    amounts add up to exactly payment; ids lists that set's invoice ids in input
    order when count == 1, and is [] otherwise."""
    ...
`;

export const prelude = `
def _gen_invoices(n, credits, seed):
    x = seed
    invoices, pick = [], 0
    for i in range(n):
        x = (1103515245 * x + 12345) % 2147483648
        amount = 5000 + (x >> 4) % 24995000
        if i % 9 == 4 and credits:
            amount = -(500 + (x >> 4) % 200000)
        invoices.append(('INV-%05d' % (10007 * (i + 1) % 100000), amount))
        x = (1103515245 * x + 12345) % 2147483648
        if (x >> 16) % 2:
            pick += amount
    if pick <= 0:
        pick = 5000
    return invoices, pick
`.trim() + "\n";

// Brute force over every subset (n <= 14 here).
export function oracle(invoices, payment) {
  const n = invoices.length;
  let count = 0, only = 0;
  for (let mask = 1; mask < 1 << n; mask++) {
    let s = 0;
    for (let j = 0; j < n; j++) if (mask & (1 << j)) s += invoices[j][1];
    if (s === payment) { count++; only = mask; }
  }
  const ids = count === 1 ? invoices.filter((_, j) => only & (1 << j)).map(([id]) => id) : [];
  return [count, ids];
}

const pyOut = ([c, ids]) => `(${c}, [${ids.map((s) => `'${s}'`).join(", ")}])`;
const pyArgs = (inv, p) => `([${inv.map(([id, a]) => `('${id}', ${a})`).join(", ")}], ${p})`;

let invNo = 0;
const invId = (r) => `INV-${String(r.int(1000, 9999))}${String(++invNo).padStart(2, "0")}`;
const dollars = (r, lo, hi) => 100 * r.int(lo, hi) + r.pick([0, 0, 25, 50, 99, 37, 80]);

function smallCase(r, level) {
  const n = level === 1 ? r.int(6, 8) : level === 2 ? r.int(8, 10) : r.int(9, 12);
  const inv = [];
  const seen = new Set();
  while (inv.length < n) {
    const a = dollars(r, 40, 2400);
    if (!seen.has(a)) { seen.add(a); inv.push([invId(r), a]); }
  }
  if (level >= 2 && r.chance(0.6)) {                   // a repeated amount (a monthly retainer)
    const k = r.int(0, n - 1), j = (k + 1 + r.int(0, n - 2)) % n;
    inv[j][1] = inv[k][1];
  }
  if (level === 3) for (let c = r.int(1, 2); c > 0; c--) inv.splice(r.int(0, inv.length), 0, [invId(r).replace("INV", "CRN"), -dollars(r, 5, 300)]);
  // The payment is the sum of a random non-empty set, so at least one set matches.
  let payment = 0;
  while (payment <= 0) {
    payment = 0;
    for (const [, a] of inv) if (r.chance(0.4)) payment += a;
  }
  if (r.chance(0.2)) payment += 1;                     // sometimes a cent off: usually nothing matches
  return { inv, payment };
}

export function generate(r, level) {
  invNo = 0;
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const c = smallCase(r, level);
    samples.push({ args: pyArgs(c.inv, c.payment), expect: pyOut(oracle(c.inv, c.payment)) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const [A, B, C, D, E] = [invId(r), invId(r), invId(r), invId(r), invId(r)];
  const x = dollars(r, 100, 900), y = dollars(r, 1000, 3000), z = dollars(r, 3100, 9000);
  const edges = [
    ["the payment equals one invoice", [[A, x], [B, y], [C, z]], y],
    ["the payment equals every open invoice together", [[A, x], [B, y], [C, z]], x + y + z],
    ["no set adds up to the payment", [[A, x], [B, y], [C, z]], y + 1],
    ["one cent short of an exact match is no match", [[A, 1999], [B, 2001]], 3999],
    ["two invoices for the same amount: two sets match", [[A, x], [B, y], [C, x]], x],
    ["one invoice or two others: two sets, so no ids", [[A, x], [B, y], [C, x + y], [D, z]], x + y],
    ["no open invoices", [], x],
    ["an amount far larger than any DP over sums could index", [[A, 987654321], [B, 123456789], [C, 555555555], [D, 444444444]], 987654321 + 555555555],
  ];
  if (level === 3) {
    edges.push(["a credit note is netted against the invoices it travels with", [[A, x], [B, y], [E.replace("INV", "CRN"), -500]], x + y - 500]);
    edges.push(["only a credit note makes the payment add up", [[A, 300000], [B, 450000], [E.replace("INV", "CRN"), -120000]], 330000]);
    edges.push(["an invoice and a credit note that cancel out double the matches", [[A, x], [B, y], [C, 750], [D.replace("INV", "CRN"), -750]], x + y]);
  }
  for (const [name, inv, p] of edges) tests.push({ name, args: pyArgs(inv, p), expect: pyOut(oracle(inv, p)) });

  // Timing: n open items. Meet in the middle builds 2 x 2^(n/2) sums; every subset is 2^n.
  const n = level === 1 ? 34 : level === 2 ? 36 : 38;
  tests.push({
    name: `${n} open items${level === 3 ? " including credit notes" : ""} (meet in the middle)`,
    args: `_gen_invoices(${n}, ${level === 3 ? "True" : "False"}, ${r.int(1, 1_000_000)})`,
    limit_s: 8,
  });

  return {
    vars: {
      max_open: n,
      amount_rule: level === 1
        ? "In the samples every open item has a different amount. The checks also include two invoices for the same amount: they are still different invoices, and a set using one is different from a set using the other."
        : "Two open items can have the same amount (a monthly retainer, say), and they are still different invoices: two sets that differ only in which of them they use are counted separately.",
      credit_hint: level === 3 ? "with the credit notes in this list" : "once credit notes with negative amounts are allowed",
      credit_rule: level === 3
        ? "Open items also include credit notes, with negative amounts and ids starting `CRN-`. A set may include them, so a set can add up to the payment while containing invoices worth more than the payment."
        : "In this replay every amount is positive; there are no credit notes.",
    },
    samples,
    tests,
  };
}
