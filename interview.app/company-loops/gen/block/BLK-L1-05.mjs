/* BLK-L1-05 — Tip pooling: each team member's share when every tip is split equally among
   those clocked in at payment time, rounded once at the end (Python).
   Simulated practice scenario set in a point-of-sale product's public domain. All data is
   generated from the seed and is hypothetical; money is integer cents. The pooling and
   rounding rules are this exercise's rules, not a statement of any product's settings.

   Contract (python): entry, signature, starter, prelude, generate(r, level) ->
     { vars, samples: [{args, expect}], tests: [{name, args, expect?, limit_s?}] }.
   expect comes from oracle() below: for every tip it scans every shift to find who was on
   the clock, then adds tip/heads to each of them as an exact fraction (BigInt over a
   common denominator). The evaluator's reference sweeps sorted events with a running
   per-head total, written independently.
   level: 1 Medium (one shift per member; tips at clock-in and clock-out seconds; nobody on
                    the clock; half a cent)
          2 Hard (+ members with several shifts, summed before rounding; a clock-out and a
                  clock-in at the same second)
          3 Very Hard (+ tip adjustments after the payment: the last one replaces the tip,
                       which is still split among those on the clock at the payment) */
export const kind = "python";
export const entry = "tip_pool";
export const signature = "def tip_pool(shifts: list[tuple[str, int, int]], tips: list[tuple[str, int, int]], adjustments: list[tuple[str, int]]) -> tuple[dict[str, int], int]:";
export const starter = `def tip_pool(shifts, tips, adjustments):
    """shifts: (member_id, clock_in, clock_out) in seconds; on the clock at t if clock_in <= t < clock_out.
    tips: (payment_id, paid_at, tip_cents).
    adjustments: (payment_id, new_tip_cents) in the order they were made.
    Return ({member_id: cents for every member in shifts}, unassigned_cents)."""
    ...
`;

export const prelude = `
def _gen_pool(n_members, shifts_per, n_tips, seed, n_adjust=0, days=30):
    x = seed
    def rnd(m):
        nonlocal x
        x = (1103515245 * x + 12345) % 2147483648
        return (x >> 16) % m
    shifts = []
    for k in range(n_members):
        member = 'tm_%05d' % k
        used = set()
        for _ in range(shifts_per):
            d = rnd(days)
            while d in used:
                d = (d + 1) % days
            used.add(d)
            start = d * 86400 + rnd(50000)
            shifts.append((member, start, start + 14400 + rnd(21600)))   # 4 to 10 hours, one per day
    tips = [('pay_%06d' % i, rnd(days * 86400), rnd(1500)) for i in range(n_tips)]
    adjustments = [('pay_%06d' % rnd(n_tips), rnd(2500)) for _ in range(n_adjust)]
    return shifts, tips, adjustments
`.trim() + "\n";

const gcd = (a, b) => { while (b) [a, b] = [b, a % b]; return a; };

// The specification, literally: per tip, scan every shift for who is on the clock.
export function oracle(shifts, tips, adjustments) {
  const tipOf = new Map(tips.map(([p, , c]) => [p, c]));
  for (const [p, c] of adjustments) tipOf.set(p, c);
  const perTip = tips.map(([p, at]) => ({ cents: tipOf.get(p), on: shifts.filter(([, a, b]) => a <= at && at < b).map(([m]) => m) }));
  let L = 1;
  for (const t of perTip) if (t.on.length) L = (L * t.on.length) / gcd(L, t.on.length);
  const BL = BigInt(L);
  const acc = new Map(shifts.map(([m]) => [m, 0n]));
  let unassigned = 0;
  for (const t of perTip) {
    if (!t.on.length) { unassigned += t.cents; continue; }
    const part = (BigInt(t.cents) * BL) / BigInt(t.on.length);       // exact: heads divide L
    for (const m of t.on) acc.set(m, acc.get(m) + part);
  }
  const shares = new Map([...acc.entries()].map(([m, s]) => [m, Number((2n * s + BL) / (2n * BL))]));
  return { shares, unassigned };
}

const pyArgs = (shifts, tips, adj) =>
  `([${shifts.map(([m, a, b]) => `('${m}', ${a}, ${b})`).join(", ")}], ` +
  `[${tips.map(([p, t, c]) => `('${p}', ${t}, ${c})`).join(", ")}], ` +
  `[${adj.map(([p, c]) => `('${p}', ${c})`).join(", ")}])`;
const pyOut = ({ shares, unassigned }) => "({" + [...shares.entries()].map(([m, c]) => `'${m}': ${c}`).join(", ") + `}, ${unassigned})`;

function ids(r, prefix, n) {
  const xs = [];
  while (xs.length < n) { const s = prefix + r.int(100, 999); if (!xs.includes(s)) xs.push(s); }
  return xs;
}

function randomCase(r, level) {
  for (let attempt = 0; attempt < 100; attempt++) {
    const members = ids(r, "tm_", r.int(3, 5));
    const shifts = [];
    for (const m of members) {
      const n = level === 1 ? 1 : r.int(1, 3);
      let t = r.int(0, 120);
      for (let k = 0; k < n; k++) {
        const a = t, b = a + r.int(60, 240);
        shifts.push([m, a, b]);
        t = b + r.int(0, 90);               // a break (or none) before the next shift
      }
    }
    const bounds = shifts.flatMap(([, a, b]) => [a, b]);
    const pays = ids(r, "pay_", r.int(6, 9));
    const tips = pays.map((p) => [p, r.chance(0.35) ? r.pick(bounds) : r.int(0, 600), r.int(0, 40) * 25 + r.pick([0, 0, 1, 3, 7])]);
    const adj = [];
    if (level === 3) for (const [p] of tips) if (r.chance(0.35)) { adj.push([p, r.int(0, 60) * 25]); if (r.chance(0.3)) adj.push([p, r.int(0, 60) * 25 + 1]); }
    const got = oracle(shifts, tips, adj);
    const positive = [...got.shares.values()].filter((x) => x > 0).length;
    if (positive >= 2) return { shifts, tips, adj, got };
  }
  throw new Error("BLK-L1-05: could not build a sample");
}

export function generate(r, level) {
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const c = randomCase(r, level);
    samples.push({ args: pyArgs(c.shifts, c.tips, c.adj), expect: pyOut(c.got) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const [A, B, C] = ids(r, "tm_", 3);
  const [P, Q, R] = ids(r, "pay_", 3);
  const t0 = r.int(0, 50) * 60;            // shift every edge case in time
  const T = (x) => t0 + x;
  const edges = [
    ["a tip at a clock-in second is shared; at a clock-out second it is not",
      [[A, T(0), T(100)], [B, T(50), T(200)]], [[P, T(50), 1000], [Q, T(100), 300]], []],
    ["rounded once at the end, not per tip",
      [[A, T(0), T(1000)], [B, T(0), T(1000)], [C, T(0), T(1000)]], [[P, T(10), 100], [Q, T(20), 100], [R, T(30), 100]], []],
    ["half a cent rounds up", [[A, T(0), T(100)], [B, T(0), T(100)]], [[P, T(5), 101]], []],
    ["a tip with nobody on the clock is unassigned; a member with no tips gets 0",
      [[A, T(100), T(200)]], [[P, T(50), 500], [Q, T(200), 400]], []],
  ];
  if (level >= 2) {
    edges.push(["a member's shifts are summed before rounding",
      [[A, T(0), T(10)], [A, T(20), T(30)], [B, T(0), T(30)]], [[P, T(5), 1], [Q, T(25), 1], [R, T(15), 1]], []]);
    edges.push(["a clock-out and a clock-in at the same second",
      [[A, T(0), T(50)], [B, T(50), T(100)]], [[P, T(50), 700]], []]);
  }
  if (level === 3) {
    edges.push(["the last adjustment replaces the tip",
      [[A, T(0), T(100)], [B, T(0), T(100)]], [[P, T(10), 400]], [[P, 1000], [P, 600]]]);
    edges.push(["a tip adjusted to 0 leaves nothing unassigned",
      [[A, T(100), T(200)]], [[P, T(10), 500], [Q, T(150), 300]], [[P, 0]]]);
  }
  for (const [name, shifts, tips, adj] of edges) tests.push({ name, args: pyArgs(shifts, tips, adj), expect: pyOut(oracle(shifts, tips, adj)) });

  // Timing: 200 000 tips over 30 days with a few hundred people on the clock at once.
  // A sweep with a running per-head total is O((n + m) log(n + m)); scanning every shift
  // per tip is O(n·m), and adding each tip to everyone on the clock is O(n·k).
  const spec = level === 1 ? "36000, 1" : "6000, 6";
  tests.push({
    name: "200,000 tips, about 36,000 shifts, a few hundred on the clock at once (a sweep, not a loop over everyone on the clock)",
    args: `_gen_pool(${spec}, 200000, ${r.int(1, 1_000_000)}, ${level === 3 ? 20000 : 0})`,
    limit_s: 8,
  });

  return {
    vars: {
      shift_rule: level === 1
        ? "In this replay each member has exactly one shift."
        : "A member can have several shifts (a split shift, a break); their shifts never overlap. Add up a member's exact share across all of their shifts and round once, per member.",
      adjust_rule: level === 3
        ? "Tips on card payments can be adjusted after the payment (a tip added on a signed receipt). `adjustments` lists `(payment_id, new_tip_cents)` in the order they were made; the last one for a payment replaces its tip, and the adjusted tip is still split among those on the clock at the payment's `paid_at`. Every adjustment refers to a payment in `tips`."
        : "In this replay `adjustments` is always empty, but keep the parameter.",
    },
    samples,
    tests,
  };
}
