/* PYP-L2-02 — Lowest balance after back-dated activity (Python, segment tree).
   Simulated practice scenario. All data is generated from the seed.

   Contract (python): entry, signature, starter, prelude, generate(r, level) ->
     { vars, samples: [{args, expect}], tests: [{name, args, expect?, limit_s?}] }.
   expect comes from oracle() below: after every arrival it sorts the whole history
   again, recomputes every running balance from the opening balance and scans for
   the lowest. The evaluator's reference keeps a segment tree of (sum, lowest
   prefix) over the final history positions, so each checks the other.
   level: 1 Medium (distinct times, some events arrive late)
          · 2 Hard (+ several events at the same minute, ordered by arrival)
          · 3 Very Hard (+ corrections: an arrival repeating an event id replaces
            that event's amount, and 0 cancels it) */
export const kind = "python";
export const entry = "lowest_balance";
export const signature = "def lowest_balance(opening: int, arrivals: list[tuple[str, int, int]]) -> list[tuple[int, int]]:";
export const starter = `def lowest_balance(opening, arrivals):
    """opening: the wallet balance before any event, in minor units.
    arrivals: (event_id, t, amount) in the order they reached the wallet;
    t is the minute the event took effect, amount is signed minor units.
    After each arrival, return (lowest running balance, t of the event where it
    was first reached) over the history as it then stands."""
    ...
`;

export const prelude = `
def _gen_arrivals(n, seed, late_pct=40, ties=False, corrections=0):
    x = seed

    def nxt():
        nonlocal x
        x = (1103515245 * x + 12345) % 2147483648
        return x >> 8
    out, seen = [], []
    clock = 1000000
    while len(out) < n:
        if corrections and seen and nxt() % 100 < corrections:
            eid, t = seen[nxt() % len(seen)]
            out.append((eid, t, (nxt() % 40000) - 25000))
            continue
        clock += 1 + nxt() % 90
        if nxt() % 100 < late_pct:
            t = 1000000 + nxt() % (clock - 1000000)
        else:
            t = clock
        if ties and seen and nxt() % 4 == 0:
            t = seen[nxt() % len(seen)][1]
        eid = 'e%07d' % len(seen)
        seen.append((eid, t))
        out.append((eid, t, (nxt() % 40000) - 20000))
    return 50000, out
`.trim() + "\n";

// The rule, literally: rebuild and rescan the whole history after every arrival.
export function oracle(opening, arrivals) {
  const ev = new Map();                       // id -> { t, first, amount }
  const out = [];
  arrivals.forEach(([id, t, amount], i) => {
    if (ev.has(id)) ev.get(id).amount = amount;          // a correction keeps its place
    else ev.set(id, { t, first: i, amount });
    const hist = [...ev.values()].sort((a, b) => a.t - b.t || a.first - b.first);
    let bal = opening, low = null, at = null;
    for (const e of hist) {
      bal += e.amount;
      if (low === null || bal < low) { low = bal; at = e.t; }   // strict: ties keep the earlier event
    }
    out.push([low, at]);
  });
  return out;
}

const pyArgs = (c) => `(${c.opening}, [` + c.arrivals.map(([id, t, a]) => `('${id}', ${t}, ${a})`).join(", ") + "])";
const pyOut = (xs) => "[" + xs.map(([l, t]) => `(${l}, ${t})`).join(", ") + "]";
const run = (c) => oracle(c.opening, c.arrivals);

function randomCase(r, level) {
  const n = r.int(7, 10);
  const opening = 100 * r.int(0, 60);
  const arrivals = [];
  const used = new Set();
  let clock = r.int(600, 900);
  let k = 0;
  while (arrivals.length < n) {
    if (level === 3 && k > 1 && r.chance(0.2)) {          // a correction to an earlier event
      const [id, t] = r.pick(arrivals);
      arrivals.push([id, t, r.chance(0.25) ? 0 : 100 * r.int(-90, 60)]);
      continue;
    }
    clock += r.int(3, 40);
    let t = r.chance(0.4) ? clock - r.int(5, 120) : clock;    // late: dated before what is already there
    if (level >= 2 && arrivals.length && r.chance(0.25)) t = r.pick(arrivals)[1];
    while (level === 1 && used.has(t)) t += 1;
    used.add(t);
    k += 1;
    const id = `tx${r.int(10, 99)}${k}`;
    arrivals.push([id, t, 100 * r.int(-90, 60) + r.pick([0, 0, 25, 50])]);
  }
  return { opening, arrivals };
}

export function generate(r, level) {
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const c = randomCase(r, level);
    samples.push({ args: pyArgs(c), expect: pyOut(run(c)) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const O = 100 * r.int(20, 80);
  const m = 100 * r.int(5, 15);
  const t0 = r.int(600, 900);
  const edges = [
    ["one event: its balance is the lowest, the opening balance is not an event",
      { opening: O, arrivals: [["a", t0, m]] }],
    ["events in time order",
      { opening: O, arrivals: [["a", t0, -m], ["b", t0 + 5, -m], ["c", t0 + 9, 3 * m]] }],
    ["a back-dated debit makes a new low before later events",
      { opening: O, arrivals: [["a", t0, -m], ["b", t0 + 30, 2 * m], ["c", t0 + 10, -3 * m]] }],
    ["a back-dated credit lifts every later balance, and the low moves",
      { opening: O, arrivals: [["a", t0, -m], ["b", t0 + 30, -2 * m], ["c", t0 + 20, 4 * m]] }],
    ["an event dated before everything arrives last",
      { opening: O, arrivals: [["a", t0 + 10, m], ["b", t0 + 20, m], ["c", t0 + 1, -O - 4 * m]] }],
    ["equal lowest balances: the earlier event is reported",
      { opening: O, arrivals: [["a", t0, -m], ["b", t0 + 10, m], ["c", t0 + 20, -m]] }],
    ["equal lowest balances created by a late event between them",
      { opening: O, arrivals: [["a", t0, -2 * m], ["b", t0 + 20, m], ["c", t0 + 10, m], ["d", t0 + 15, -m]] }],
    ["the balance can go below zero",
      { opening: 0, arrivals: [["a", t0 + 40, m], ["b", t0, -2 * m]] }],
  ];
  if (level >= 2) {
    edges.push(["an event at the same minute as an earlier arrival goes after it",
      { opening: O, arrivals: [["a", t0, -m], ["b", t0, 2 * m], ["c", t0 - 5, -m]] }]);
    edges.push(["same minute, the later arrival is the lower one",
      { opening: O, arrivals: [["a", t0, m], ["b", t0, -3 * m]] }]);
  }
  if (level === 3) {
    edges.push(["a correction changes an event's amount and keeps its place",
      { opening: O, arrivals: [["a", t0, -m], ["b", t0 + 10, -m], ["a", t0, -4 * m]] }]);
    edges.push(["a correction to zero cancels the event that made the low",
      { opening: O, arrivals: [["a", t0, m], ["b", t0 + 10, -3 * m], ["c", t0 + 20, m], ["b", t0 + 10, 0]] }]);
    edges.push(["a correction of the first event shifts every later balance",
      { opening: O, arrivals: [["a", t0, -m], ["b", t0 + 10, -m], ["c", t0 + 30, 5 * m], ["a", t0, 2 * m]] }]);
  }
  for (const [name, c] of edges) tests.push({ name, args: pyArgs(c), expect: pyOut(run(c)) });

  // Timing: compared with the reference at check time. 40% of arrivals are dated at a
  // random earlier minute, so recomputing the balances from the inserted position on
  // touches half the history for those arrivals.
  const ties = level >= 2 ? "True" : "False";
  const corrections = level === 3 ? 10 : 0;
  tests.push({
    name: "80,000 arrivals, 40% of them back-dated, in time",
    args: `_gen_arrivals(80000, ${r.int(1, 1_000_000)}, 40, ${ties}, ${corrections})`,
    limit_s: 8,
  });

  return {
    vars: {
      tie_rule: level === 1
        ? "In this exercise no two events share a minute."
        : "Several events can share a minute. Among them, the one that arrived first comes first, wherever the others were dated.",
      correction_rule: level === 3
        ? "An arrival can repeat an earlier event's id: it is a correction. It replaces that event's amount (an amount of 0 cancels it), and its `t` is always the original's, so the event keeps its place in the history."
        : "Every event id arrives once.",
    },
    samples,
    tests,
  };
}
