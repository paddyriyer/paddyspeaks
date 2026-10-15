/* WMT-L1-04 — Sales over arbitrary minute ranges while voids and late uploads correct earlier minutes (Python).
   Simulated practice scenario. All data is generated from the seed.

   Contract (python): entry, signature, starter, prelude, generate(r, level) ->
     { vars, samples: [{args, expect}], tests: [{name, args, expect?, limit_s?}] }.
   expect comes from oracle() below: it keeps every transaction and, for each query,
   adds up the counted transactions whose minute is in the range. The evaluator's
   reference keeps a Fenwick (binary indexed) tree over minutes, written independently.
   level: 1 Medium (sales, voids of sales already seen, inclusive range queries)
          · 2 Hard (+ moves that correct a transaction's minute, repeated voids, empty ranges lo > hi)
          · 3 Very Hard (+ voids that arrive before their sale, moves of transactions not seen yet) */
export const kind = "python";
export const entry = "range_sales";
export const signature = "def range_sales(n_minutes: int, ops: list[tuple]) -> list[int]:";
export const starter = `def range_sales(n_minutes, ops):
    """Minutes are 0 .. n_minutes - 1. ops, in arrival order:
      ('sale', txn_id, minute, cents)
      ('void', txn_id)
      ('move', txn_id, minute)
      ('query', lo, hi)            # inclusive; lo > hi means an empty range
    Return the answer to every query, in order (integer cents)."""
    ...
`;

export const prelude = `
def _gen_ops(n_minutes, n_sales, n_queries, seed, level=3):
    x = seed
    def rnd(m):
        nonlocal x
        x = (6364136223846793005 * x + 1442695040888963407) % 18446744073709551616
        return (x >> 33) % m
    ops, seen, voided, k, q = [], [], set(), 0, 0
    total = n_sales + n_queries
    while k < n_sales or q < n_queries:
        if k >= n_sales or (q < n_queries and rnd(total) < n_queries):
            a, b = rnd(n_minutes), rnd(n_minutes)
            if level >= 2 and rnd(50) == 0 and a > 0:
                ops.append(('query', a, rnd(a)))                     # lo > hi: an empty range
            else:
                ops.append(('query', min(a, b), max(a, b)))
            q += 1
            continue
        tid = 'T%d' % k
        k += 1
        if level == 3 and rnd(40) == 0:
            ops.append(('void', tid))                             # the void arrives first
            voided.add(tid)
        ops.append(('sale', tid, rnd(n_minutes), 50 + rnd(20000)))
        seen.append(tid)
        roll = rnd(10)
        if roll == 0:
            t = seen[rnd(len(seen))]
            if level >= 2 or t not in voided:
                ops.append(('void', t))
                voided.add(t)
        elif roll == 1 and level >= 2:
            ops.append(('move', seen[rnd(len(seen))], rnd(n_minutes)))
        elif roll == 2 and level == 3:
            ops.append(('move', 'X%d' % rnd(1000), rnd(n_minutes)))
    return n_minutes, ops
`.trim() + "\n";

// The specification, literally: every transaction is kept; a query adds up the counted ones in range.
export function oracle(n, ops) {
  const txns = new Map();        // id -> {minute, cents, counted}
  const voidFirst = new Set();
  const out = [];
  for (const op of ops) {
    if (op[0] === "sale") txns.set(op[1], { minute: op[2], cents: op[3], counted: !voidFirst.has(op[1]) });
    else if (op[0] === "void") {
      if (txns.has(op[1])) txns.get(op[1]).counted = false;
      else voidFirst.add(op[1]);
    } else if (op[0] === "move") {
      if (txns.has(op[1])) txns.get(op[1]).minute = op[2];
    } else {
      let s = 0;
      for (const t of txns.values()) if (t.counted && t.minute >= op[1] && t.minute <= op[2]) s += t.cents;
      out.push(s);
    }
  }
  return out;
}

const pyOp = (op) => "(" + op.map((v) => (typeof v === "string" ? `'${v}'` : String(v))).join(", ") + ")";
const pyArgs = (n, ops) => `(${n}, [${ops.map(pyOp).join(", ")}])`;
const pyOut = (xs) => "[" + xs.join(", ") + "]";

function randomCase(r, level) {
  const n = r.pick([60, 90, 120]);
  const ops = [];
  const seen = [];
  const voided = new Set();
  let k = r.int(100, 900);
  const nOps = 14 + 4 * level;
  for (let i = 0; i < nOps; i++) {
    const roll = r.next();
    if (roll < 0.3 && seen.length) {
      const lo = r.int(0, n - 1), hi = r.int(lo, Math.min(n - 1, lo + r.int(0, n)));
      if (level >= 2 && r.chance(0.1)) { const a = r.int(1, n - 1); ops.push(["query", a, r.int(0, a - 1)]); }
      else ops.push(["query", lo, hi]);
    } else if (roll < 0.42 && seen.length) {
      const live = seen.filter((t) => !voided.has(t));
      const t = level >= 2 && r.chance(0.3) ? r.pick(seen) : live.length ? r.pick(live) : null;
      if (t) { ops.push(["void", t]); voided.add(t); }
    } else if (roll < 0.52 && level >= 2 && seen.length) {
      ops.push(["move", r.pick(seen), r.int(0, n - 1)]);
    } else if (roll < 0.56 && level === 3) {
      ops.push(["move", "t" + (k + 50 + r.int(0, 9)), r.int(0, n - 1)]);
    } else {
      const id = "t" + (k += r.int(1, 3));
      if (level === 3 && r.chance(0.12)) { ops.push(["void", id]); voided.add(id); }
      ops.push(["sale", id, r.int(0, n - 1), r.int(1, 400) * 25]);
      seen.push(id);
    }
  }
  ops.push(["query", 0, n - 1]);
  return { n, ops };
}

export function generate(r, level) {
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const c = randomCase(r, level);
    samples.push({ args: pyArgs(c.n, c.ops), expect: pyOut(oracle(c.n, c.ops)) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const n = r.pick([60, 120, 1440]);
  const m = r.int(10, Math.floor(n / 2));        // a minute in the middle
  const c = r.int(2, 80) * 25;
  const edges = [
    ["a late upload into an earlier minute changes a range already answered",
      [["sale", "a1", m + 5, c], ["query", m, m + 9], ["sale", "a2", m, c + 100], ["query", m, m + 9]]],
    ["a range includes both of its ends; lo == hi is one minute",
      [["sale", "a1", m, c], ["sale", "a2", m + 3, 2 * c], ["sale", "a3", m + 4, 7], ["query", m, m + 3], ["query", m + 3, m + 3], ["query", m + 1, m + 2]]],
    ["a void takes the sale out of its minute",
      [["sale", "a1", m, c], ["sale", "a2", m + 1, 300], ["void", "a1"], ["query", m - 1, m + 1]]],
  ];
  if (level >= 2) {
    edges.push(["a move takes the amount from the old minute to the new one",
      [["sale", "a1", m, c], ["query", m, m], ["move", "a1", m + 7], ["query", m, m], ["query", m + 1, m + 7]]]);
    edges.push(["a repeated void changes nothing", [["sale", "a1", m, c], ["sale", "a2", m, 40], ["void", "a1"], ["void", "a1"], ["query", 0, n - 1]]]);
    edges.push(["a voided transaction that is moved still counts nothing",
      [["sale", "a1", m, c], ["void", "a1"], ["move", "a1", m + 2], ["sale", "a2", m + 2, 15], ["query", m, m + 2]]]);
    edges.push(["lo > hi is an empty range: 0", [["sale", "a1", m, c], ["query", m + 1, m], ["query", m, m - 1]]]);
    edges.push(["the first and last minutes", [["sale", "a1", 0, c], ["sale", "a2", n - 1, 99], ["query", 0, 0], ["query", n - 1, n - 1], ["query", 0, n - 1]]]);
  }
  if (level === 3) {
    edges.push(["a void that arrives before its sale: the sale never counts",
      [["void", "a1"], ["sale", "a1", m, c], ["sale", "a2", m, 60], ["query", m, m], ["void", "a1"], ["query", m, m]]]);
    edges.push(["a move for a transaction not seen yet is ignored",
      [["move", "a1", m + 3], ["sale", "a1", m, c], ["query", m + 3, m + 3], ["query", m, m]]]);
    edges.push(["voided before arrival, then moved: still nothing",
      [["void", "a1"], ["sale", "a1", m, c], ["move", "a1", m + 1], ["sale", "a2", m + 1, 35], ["query", m, m + 1]]]);
  }
  for (const [name, ops] of edges) tests.push({ name, args: pyArgs(n, ops), expect: pyOut(oracle(n, ops)) });

  // Timing: a year of minutes, 120 000 sales with voids and moves, 30 000 queries whose ranges
  // average a third of the year, interleaved so almost every query follows an update.
  tests.push({
    name: "525,600 minutes, 120,000 sales, 30,000 long range queries interleaved with updates (log-time updates and queries)",
    args: `_gen_ops(525600, 120000, 30000, ${r.int(1, 1_000_000)}, ${level})`,
    limit_s: 8,
  });

  return {
    vars: {
      void_rule: level === 1
        ? "At this level every `void` names a sale that has already arrived and has not been voided, and there are no `move` operations."
        : level === 2
          ? "A `void` can be repeated (the register resent it): the repeat changes nothing. A `move` corrects the minute of a transaction already seen; a voided transaction can be moved and stays voided. Every `void` and `move` names a sale that has already arrived."
          : "A `void` can be repeated (the repeat changes nothing) and can arrive before its sale, because uploads are out of order: that sale then never counts. A `move` corrects the minute of a transaction already seen (a voided one stays voided); a `move` for a transaction not seen yet is ignored.",
    },
    samples,
    tests,
  };
}
