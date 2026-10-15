/* PYP-L1-05 — Balance targets: the first date a wallet's balance reached each of many
   target amounts, or None (Python).
   Simulated practice scenario. All data is generated from the seed.

   Contract (python): entry, signature, starter, prelude, generate(r, level) ->
     { vars, samples: [{args, expect}], tests: [{name, args, expect?, limit_s?}] }.
   expect comes from oracle() below, which replays the history once per target. The
   evaluator's reference keeps the running maximum and bisects it, so each checks the other.
   level: 1 Medium (opening balance 0, positive targets, intraday balances count)
          2 Hard (+ an opening balance: targets at or below it return 'opening'; repeated
                  targets; balances that fall back after a peak)
          3 Very Hard (+ end_of_day=True: only each date's closing balance counts, so an
                  intraday peak reaches nothing) */
export const kind = "python";
export const entry = "balance_targets";
export const signature = "def balance_targets(opening_cents: int, events: list[tuple[str, int]], targets: list[int], end_of_day: bool = False) -> list[str | None]:";
export const starter = `def balance_targets(opening_cents, events, targets, end_of_day=False):
    """events: (date 'YYYY-MM-DD', amount_cents) in the order they were applied.
    Return, per target, the date the balance first reached it, 'opening' if the
    opening balance already did, or None."""
    ...
`;

export const prelude = `
def _gen_wallet(n, q, seed, opening=0, per_day=4, unreached=40):
    import datetime
    x = seed

    def nxt():
        nonlocal x
        x = (1103515245 * x + 12345) % 2147483648
        return x >> 8
    day = datetime.date(2020, 1, 1)
    one = datetime.timedelta(days=1)
    events, bal, peak = [], opening, opening
    label = day.isoformat()
    for _ in range(n):
        if nxt() % per_day == 0:
            day += one
            label = day.isoformat()
        if nxt() % 100 < 55:
            amt = 100 + nxt() % 25000             # money in
        else:
            amt = -(100 + nxt() % 24000)          # money out
            if bal + amt < 0:
                amt = -bal                        # the wallet never goes below zero here
        bal += amt
        peak = max(peak, bal)
        events.append((label, amt))
    targets = []
    for _ in range(q):
        if nxt() % 100 < unreached:
            targets.append(peak + 1 + nxt() % (peak + 1))
        else:
            targets.append(1 + nxt() % max(peak, 1))
    return opening, events, targets
`.trim() + "\n";

// Replays the whole history for each target. Small inputs only.
export function oracle(opening, events, targets, endOfDay) {
  return targets.map((t) => {
    if (t <= opening) return "opening";
    let bal = opening;
    for (let i = 0; i < events.length; i++) {
      bal += events[i][1];
      if (endOfDay && i + 1 < events.length && events[i + 1][0] === events[i][0]) continue;
      if (bal >= t) return events[i][0];
    }
    return null;
  });
}

const pyArgs = (c) =>
  `(${c.opening}, [` + c.events.map(([d, a]) => `('${d}', ${a})`).join(", ") + "], [" + c.targets.join(", ") + "]" + (c.eod ? ", True" : "") + ")";
const pyOut = (xs) => "[" + xs.map((x) => (x === null ? "None" : `'${x}'`)).join(", ") + "]";
const run = (c) => oracle(c.opening, c.events, c.targets, c.eod);

const dayStr = (base, k) => { const d = new Date(base + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + k); return d.toISOString().slice(0, 10); };

function randomCase(r, level, base) {
  for (let attempt = 0; attempt < 100; attempt++) {
    const opening = level === 1 ? 0 : r.int(2, 40) * 500;
    const events = [];
    let bal = opening, k = 0;
    const n = r.int(9, 13);
    for (let i = 0; i < n; i++) {
      if (i && r.chance(level === 3 ? 0.45 : 0.6)) k += r.int(1, 3);
      let amt = r.chance(0.6) ? r.int(1, 60) * 250 : -r.int(1, 50) * 250;
      if (bal + amt < 0) amt = -bal;
      if (amt === 0) amt = r.int(1, 20) * 250;
      bal += amt;
      events.push([dayStr(base, k), amt]);
    }
    let b = opening, peak = opening;
    const seen = [];
    for (const [, a] of events) { b += a; peak = Math.max(peak, b); seen.push(b); }
    const targets = [];
    for (let j = 0; j < r.int(6, 8); j++) {
      const roll = r.next();
      if (roll < 0.3) targets.push(r.pick(seen.filter((x) => x > 0)) || 250);     // exactly a balance that occurred
      else if (roll < 0.5) targets.push(peak + r.int(1, 40) * 250);                // never reached
      else if (level >= 2 && roll < 0.6) targets.push(r.int(1, Math.max(1, opening / 250)) * 250);   // at or below the opening
      else targets.push(r.int(1, Math.max(1, Math.floor(peak / 250))) * 250);
    }
    if (level >= 2) targets.push(targets[0]);                                       // a repeated target
    const c = { opening, events, targets: r.shuffle(targets), eod: level === 3 };
    const got = run(c);
    if (got.some((x) => x === null) && got.some((x) => x !== null && x !== "opening")) return c;
  }
  throw new Error("PYP-L1-05: could not build a sample with both outcomes");
}

export function generate(r, level) {
  const base = dayStr("2026-03-02", r.int(0, 120));
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const c = randomCase(r, level, base);
    samples.push({ args: pyArgs(c), expect: pyOut(run(c)) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const d = (k) => dayStr(base, k);
  const m = r.int(4, 40) * 100;
  const eod = level === 3;
  const edges = [
    ["a balance exactly equal to the target reaches it", 0, [[d(0), m], [d(1), m]], [2 * m]],
    ["one cent short does not", 0, [[d(0), m], [d(1), m - 1]], [2 * m]],
    ["a peak that falls back still reached the target on its date", 0, [[d(0), 3 * m], [d(2), -2 * m], [d(5), m]], [3 * m, 2 * m]],
    ["the first date, not a later one at a higher balance", 0, [[d(0), m], [d(3), m], [d(4), 5 * m]], [2 * m]],
    ["a target above every balance is None", 0, [[d(0), m], [d(1), -m]], [m + 1]],
    ["no events at all", 0, [], [m]],
    ["targets in any order, answered in input order", 0, [[d(0), m], [d(1), m], [d(2), m]], [3 * m, m, 2 * m]],
  ];
  if (level >= 2) {
    edges.push(["a target equal to the opening balance is 'opening'", 5 * m, [[d(0), -m], [d(1), 2 * m]], [5 * m, 5 * m + 1, 6 * m]]);
    edges.push(["a dip below the opening does not change an 'opening' answer", 2 * m, [[d(0), -2 * m], [d(1), m]], [m, 2 * m, 2 * m + 1]]);
    edges.push(["repeated targets get the same answer", 0, [[d(0), m], [d(2), m]], [2 * m, 2 * m, m]]);
  }
  if (level === 3) {
    edges.push(["an intraday peak that is spent the same day reaches nothing", 0, [[d(0), 4 * m], [d(0), -3 * m], [d(1), m]], [4 * m, 2 * m]]);
    edges.push(["the closing balance of the day decides, even after a dip during it", 0, [[d(0), m], [d(1), -m], [d(1), 3 * m]], [3 * m]]);
    edges.push(["several events on the last date close that date", m, [[d(0), m], [d(2), m], [d(2), m]], [m, 3 * m, 4 * m]]);
  }
  for (const [name, opening, events, targets] of edges) {
    const c = { opening, events, targets, eod };
    tests.push({ name, args: pyArgs(c), expect: pyOut(run(c)) });
  }

  // Timing: compared with the reference at check time. 200 000 events and 20 000 targets,
  // about 40% of them never reached, so a per-target replay with an early break still reads
  // the whole history for each of those.
  const seed = r.int(1, 1_000_000);
  const opening = level === 1 ? 0 : r.int(10, 200) * 100;
  tests.push({
    name: "200,000 events and 20,000 targets in time",
    args: `(*_gen_wallet(200000, 20000, ${seed}, ${opening}), ${eod ? "True" : "False"})`,
    limit_s: 8,
  });

  return {
    vars: {
      opening_rule: level === 1
        ? "In this exercise `opening_cents` is 0 and every target is positive."
        : "`opening_cents` can be positive: a target at or below it was met before the history starts, so its answer is the string `'opening'`. Targets can repeat.",
      eod_rule: level === 3
        ? "`end_of_day` is True in this exercise: only each date's closing balance (after its last event) counts. A balance reached during a date and spent before its last event reaches nothing."
        : "`end_of_day` is False in this exercise: the balance after every event counts.",
    },
    samples,
    tests,
  };
}
