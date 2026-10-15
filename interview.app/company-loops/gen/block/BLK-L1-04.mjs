/* BLK-L1-04 — Drawer discrepancy: runs of consecutive cash transactions in a shift whose
   net equals the counted shortfall (Python).
   Simulated practice scenario set in a point-of-sale product's public domain. All data is
   generated from the seed and is hypothetical; money is integer cents.

   Contract (python): entry, signature, starter, prelude, generate(r, level) ->
     { vars, samples: [{args, expect}], tests: [{name, args, expect?, limit_s?}] }.
   expect comes from oracle() below: a literal check of every (start, end) pair of each
   shift's counted transactions. The evaluator's reference keeps prefix sums in a hash map
   (count and latest position per prefix), written independently.
   level: 1 Medium (one shift; sales, refunds and paid-outs; overages)
          2 Hard (+ several shifts interleaved in one list, a shift with no transactions,
                  shifts that are not under review)
          3 Very Hard (+ voided transactions, which are skipped: never part of a run's net,
                       never a run's first or last transaction, not counted in its length) */
export const kind = "python";
export const entry = "discrepancy_runs";
export const signature = "def discrepancy_runs(txns: list[tuple[str, int, bool]], shortfalls: dict[str, int]) -> dict[str, tuple[int, tuple[int, int] | None]]:";
export const starter = `def discrepancy_runs(txns, shortfalls):
    """txns: (shift_id, amount_cents, voided) in the order they were rung up.
    shortfalls: {shift_id: expected minus counted cash, in cents (never 0)}.
    Return {shift_id: (number_of_runs, (first_pos, last_pos) of the shortest run, or None)}
    for every shift in shortfalls."""
    ...
`;

export const prelude = `
def _gen_drawer(n, n_shifts, seed, void_rate=0):
    x = seed
    def rnd(m):
        nonlocal x
        x = (1103515245 * x + 12345) % 2147483648
        return (x >> 16) % m
    shifts = ['shift_%02d' % k for k in range(n_shifts)]
    txns = []
    for _ in range(n):
        r = rnd(100)
        cents = 25 * (1 + rnd(120)) if r >= 12 else -25 * (1 + rnd(60))   # sales; refunds and paid-outs
        txns.append((shifts[rnd(n_shifts)], cents, rnd(100) < void_rate))
    shortfalls = {s: 25 * (1 + rnd(200)) * (1 if rnd(4) else -1) for s in shifts}
    return txns, shortfalls
`.trim() + "\n";

// The specification, checked literally: every (start, end) pair of each shift's counted
// transactions, the net summed from scratch for each pair.
export function oracle(txns, shortfalls) {
  const out = new Map();
  for (const [s, want] of Object.entries(shortfalls)) {
    const pos = [];
    txns.forEach(([shift, , voided], i) => { if (shift === s && !voided) pos.push(i); });
    let count = 0, best = null;
    for (let a = 0; a < pos.length; a++) {
      for (let b = a; b < pos.length; b++) {
        let net = 0;
        for (let k = a; k <= b; k++) net += txns[pos[k]][1];
        if (net !== want) continue;
        count++;
        const len = b - a + 1;
        if (!best || len < best.len || (len === best.len && pos[a] < best.first)) best = { len, first: pos[a], last: pos[b] };
      }
    }
    out.set(s, [count, best ? [best.first, best.last] : null]);
  }
  return out;
}

const pyBool = (b) => (b ? "True" : "False");
const pyArgs = (txns, sf) =>
  `([${txns.map(([s, c, v]) => `('${s}', ${c}, ${pyBool(v)})`).join(", ")}], {${Object.entries(sf).map(([s, c]) => `'${s}': ${c}`).join(", ")}})`;
const pyOut = (m) => "{" + [...m.entries()].map(([s, [c, b]]) => `'${s}': (${c}, ${b ? `(${b[0]}, ${b[1]})` : "None"})`).join(", ") + "}";

const PALETTE = [-750, -500, -250, 250, 500, 750, 1000, 1250, 1500, 2000];
const sid = (r) => "shift_" + r.int(100, 999);

function randomCase(r, level) {
  for (let attempt = 0; attempt < 100; attempt++) {
    const nShifts = level === 1 ? 1 : r.int(2, 3);
    const ids = [];
    while (ids.length < nShifts) { const s = sid(r); if (!ids.includes(s)) ids.push(s); }
    const n = level === 1 ? r.int(8, 11) : r.int(12, 16);
    const txns = [];
    for (let i = 0; i < n; i++) txns.push([r.pick(ids), r.pick(PALETTE), level === 3 && r.chance(0.18)]);
    const sf = {};
    for (const s of ids) {
      const pos = [];
      txns.forEach(([shift, , v], i) => { if (shift === s && !v) pos.push(i); });
      if (!pos.length) continue;
      const a = r.int(0, pos.length - 1), b = r.int(a, Math.min(pos.length - 1, a + 3));
      let net = 0;
      for (let k = a; k <= b; k++) net += txns[pos[k]][1];
      if (net !== 0) sf[s] = net;
    }
    if (level >= 2 && r.chance(0.3)) sf[sid(r) + "_x"] = 500;               // under review, no transactions
    if (!Object.keys(sf).length) continue;
    const got = oracle(txns, sf);
    const runs = [...got.values()].reduce((x, [c]) => x + c, 0);
    if (runs > 0) return { txns, sf, got };
  }
  throw new Error("BLK-L1-04: could not build a sample");
}

export function generate(r, level) {
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const c = randomCase(r, level);
    samples.push({ args: pyArgs(c.txns, c.sf), expect: pyOut(c.got) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const [A, B, C] = (() => { const xs = []; while (xs.length < 3) { const s = sid(r); if (!xs.includes(s)) xs.push(s); } return xs; })();
  const k = 25 * r.int(4, 20);              // a unit that scales every edge case
  const one = (amounts, s) => [amounts.map((x) => [A, x * k, false]), { [A]: s * k }];
  const edges = [
    ["a single transaction equal to the shortfall is a run of one", ...one([40, 20, 30], 20)],
    ["no run matches", ...one([12, 16], 40)],
    ["the whole shift is the only run", ...one([10, 20, 30], 60)],
    ["a refund inside a run lowers its net", ...one([80, -20, 40], 60)],
    ["an overage is a negative shortfall", ...one([40, -30, 20, -30], -30)],
    ["equal lengths: the run that starts first is the shortest", ...one([12, 16, 4, 8, 20], 28)],
    ["zero-net stretches make several runs end at the same transaction", ...one([20, -20, 28, 12, 16], 28)],
  ];
  if (level >= 2) {
    edges.push(["interleaved shifts: a run never mixes shifts",
      [[A, 16 * k, false], [B, 12 * k, false], [A, 12 * k, false]], { [A]: 28 * k, [B]: 28 * k }]);
    edges.push(["a shift under review with no transactions",
      [[A, 20 * k, false], [A, 8 * k, false]], { [A]: 20 * k, [C]: 20 * k }]);
    edges.push(["shifts that are not under review are not reported",
      [[A, 20 * k, false], [B, 20 * k, false], [A, 8 * k, false]], { [A]: 28 * k }]);
  }
  if (level === 3) {
    edges.push(["a voided transaction inside a run is skipped",
      [[A, 16 * k, false], [A, 99 * k, true], [A, 12 * k, false]], { [A]: 28 * k }]);
    edges.push(["a voided transaction is never a run by itself",
      [[A, 20 * k, true], [A, 8 * k, false]], { [A]: 20 * k }]);
    edges.push(["shortest means fewest counted transactions, not the narrowest span of positions",
      [[A, 14 * k, false], [A, 4 * k, true], [A, 4 * k, true], [A, 14 * k, false], [A, 40 * k, false], [A, 8 * k, false], [A, 12 * k, false], [A, 8 * k, false]], { [A]: 28 * k }]);
  }
  for (const [name, txns, sf] of edges) tests.push({ name, args: pyArgs(txns, sf), expect: pyOut(oracle(txns, sf)) });

  // Timing: 200 000 transactions. Prefix sums in a hash map are O(n); checking every
  // start for every end is O(n²) — about 2·10^10 steps for one shift.
  const nShifts = level === 1 ? 1 : 4;
  tests.push({
    name: `200,000 transactions across ${nShifts === 1 ? "one shift" : "4 shifts"} (a hash map of prefix sums, not every start and end)`,
    args: `_gen_drawer(200000, ${nShifts}, ${r.int(1, 1_000_000)}, ${level === 3 ? 8 : 0})`,
    limit_s: 8,
  });

  return {
    vars: {
      shift_rule: level === 1
        ? "In this replay `txns` holds one shift, but it is still a list of `(shift_id, …)` tuples and `shortfalls` a dict."
        : "`txns` interleaves several shifts (several registers on one day) in the order they were rung up. A run uses consecutive transactions of one shift; another shift's transactions in between neither break it nor count in it. Report every shift in `shortfalls`, including one with no transactions, and only those.",
      void_rule: level === 3
        ? "A transaction with `voided = True` was cancelled before any cash moved. Skip it entirely: it is never part of a run's net, never a run's first or last transaction, and it does not count in a run's length."
        : "In this replay no transaction is voided (`voided` is always `False`).",
    },
    samples,
    tests,
  };
}
