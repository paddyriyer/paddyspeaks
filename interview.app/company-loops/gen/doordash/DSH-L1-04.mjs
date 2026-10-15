/* DSH-L1-04 — Open stores at each order's time (Python, sorted boundaries + bisect).
   Simulated practice scenario. All data is generated from the seed.

   Contract (python): entry, signature, starter, prelude, generate(r, level) ->
     { vars, samples: [{args, expect}], tests: [{name, args, expect?, limit_s?}] }.
   expect comes from oracle() below: for every order it checks every interval directly,
   including the copy of a late-night interval shifted back by one week. The evaluator's
   reference expands intervals onto the week line, sorts starts and ends, and answers
   each order with two bisects, so each checks the other.
   level: 1 Medium (intervals within one day, split lunch/dinner hours, orders in one week)
          2 Hard (+ intervals that cross midnight, including Sunday night into Monday morning,
                  and a close written as 0 or as 1440)
          3 Very Hard (+ orders over several weeks against the weekly schedule, and 24-hour stores
                  written as adjacent day-long intervals) */
export const kind = "python";
export const entry = "open_store_counts";
export const signature = "def open_store_counts(hours: list[tuple[str, int, int, int]], orders: list[int]) -> list[int]:";
export const starter = `def open_store_counts(hours, orders):
    """hours: (store_id, day, open_min, close_min) per opening interval; day 0 = Monday
    ... 6 = Sunday; minutes after local midnight. If close_min < open_min the interval
    runs past midnight into the next day (Sunday's into Monday).
    orders: minutes since Monday 00:00 of week 0.
    Return, per order, how many stores were open at that minute."""
    ...
`;

export const prelude = `
def _gen_week_hours(n_stores, n_orders, seed, level=3):
    x = seed

    def rnd(m):
        nonlocal x
        x = (6364136223846793005 * x + 1442695040888963407) % 18446744073709551616
        return (x >> 33) % m
    hours = []
    for k in range(n_stores):
        sid = 'st_%05d' % k
        kind = rnd(10)
        if level == 3 and kind == 0:
            for d in range(7):
                hours.append((sid, d, 0, 1440))
            continue
        for d in range(7):
            if rnd(8) == 0:
                continue
            if level >= 2 and kind <= 3:
                c = rnd(240) if rnd(4) else (0 if rnd(2) else 1440)
                hours.append((sid, d, 1080 + rnd(300), c))
            else:
                o = 360 + rnd(300)
                if rnd(3) == 0:
                    m = o + 120 + rnd(120)
                    hours.append((sid, d, o, m))
                    hours.append((sid, d, m + 30 + rnd(60), 1260 + rnd(150)))
                else:
                    hours.append((sid, d, o, 1200 + rnd(230)))
    span = 10080 * (4 if level == 3 else 1)
    orders = [rnd(span) for _ in range(n_orders)]
    return hours, orders
`.trim() + "\n";

const W = 10080;
// Every order against every interval, directly. Small inputs only.
export function oracle(hours, orders) {
  const iv = hours.map(([, d, o, c]) => [d * 1440 + o, c > o ? d * 1440 + c : (d + 1) * 1440 + c]);
  return orders.map((t0) => {
    const t = t0 % W;
    let n = 0;
    for (const [s, e] of iv) if ((s <= t && t < e) || (s <= t + W && t + W < e)) n++;
    return n;
  });
}

const pyArgs = (c) => "([" + c.hours.map(([s, d, o, cl]) => `('${s}', ${d}, ${o}, ${cl})`).join(", ") + "], [" + c.orders.join(", ") + "])";
const pyOut = (xs) => "[" + xs.join(", ") + "]";
const run = (c) => oracle(c.hours, c.orders);

function randomCase(r, level) {
  const nStores = r.int(3, 5);
  let sid = r.int(100, 800);
  const hours = [];
  const ids = [];
  for (let k = 0; k < nStores; k++) {
    const id = "st_" + (sid += r.int(3, 40));
    ids.push(id);
    const late = level >= 2 && r.chance(0.4);
    const allDay = level === 3 && r.chance(0.2);
    for (let d = 0; d < 7; d++) {
      if (allDay) { hours.push([id, d, 0, 1440]); continue; }
      if (r.chance(0.2)) continue;
      if (late) hours.push([id, d, r.int(17, 22) * 60 + r.pick([0, 30]), r.pick([0, 1440, 60, 120, 150, 180])]);
      else if (r.chance(0.35)) {
        const o = r.int(10, 11) * 60, m = o + r.int(3, 4) * 60;
        hours.push([id, d, o, m]);
        hours.push([id, d, m + r.int(1, 2) * 60, r.int(21, 23) * 60]);
      } else hours.push([id, d, r.int(6, 11) * 60 + r.pick([0, 15, 30]), r.int(20, 23) * 60 + r.pick([0, 30])]);
    }
  }
  const span = level === 3 ? 3 * W : W;
  const orders = [];
  for (let i = 0; i < r.int(8, 12); i++) {
    // Mostly near the boundaries, where the interesting answers are.
    const hs = r.pick(hours);
    const at = hs[1] * 1440 + r.pick([hs[2], hs[3], hs[2] - 1, hs[3] - 1, hs[2] + r.int(1, 90)]);
    const base = level === 3 ? r.int(0, 2) * W : 0;
    orders.push(r.chance(0.7) ? (((at % W) + W) % W) + base : r.int(0, span - 1));
  }
  return { hours: r.shuffle(hours), orders };
}

export function generate(r, level) {
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const c = randomCase(r, level);
    samples.push({ args: pyArgs(c), expect: pyOut(run(c)) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const [A, B, C] = r.sample(["st_101", "st_214", "st_377", "st_452", "st_583", "st_690"], 3);
  const d = r.int(0, 5);                 // a weekday that has a next day in the same week
  const o = r.int(8, 11) * 60, c = r.int(20, 22) * 60;
  const at = (day, min) => day * 1440 + min;
  const edges = [
    ["an order at the opening minute counts; one at the closing minute does not",
      { hours: [[A, d, o, c]], orders: [at(d, o), at(d, c), at(d, o - 1), at(d, c - 1)] }],
    ["the gap between lunch and dinner hours",
      { hours: [[A, d, 660, 840], [A, d, 1020, 1320], [B, d, 600, 1200]], orders: [at(d, 700), at(d, 900), at(d, 840), at(d, 1020), at(d, 1250)] }],
    ["hours on one day do not apply to another day",
      { hours: [[A, d, o, c]], orders: [at(d + 1, o + 30), at(d, o + 30)] }],
    ["the first and last minutes of the week",
      { hours: [[A, 0, 0, 600], [B, 6, 900, 1440]], orders: [0, W - 1, at(6, 900)] }],
    ["several stores open at once",
      { hours: [[A, d, o, c], [B, d, o + 60, c], [C, d, o - 30, o + 90]], orders: [at(d, o + 60), at(d, o + 89), at(d, o + 90)] }],
  ];
  if (level >= 2) {
    edges.push(["an interval that crosses midnight is open after midnight, until its close",
      { hours: [[A, d, 1080, 120]], orders: [at(d, 1439), at(d + 1, 0), at(d + 1, 119), at(d + 1, 120)] }]);
    edges.push(["Sunday night runs into Monday morning of the same schedule",
      { hours: [[A, 6, 1200, 180], [B, 0, 480, 1200]], orders: [60, 179, 180, at(6, 1300)] }]);
    edges.push(["a close of 0 and a close of 1440 both mean midnight",
      { hours: [[A, d, 1140, 0], [B, d, 1140, 1440]], orders: [at(d, 1439), at(d + 1, 0)] }]);
  }
  if (level === 3) {
    edges.push(["orders in later weeks follow the same weekly schedule",
      { hours: [[A, d, o, c]], orders: [at(d, o) + W, at(d, c) + 2 * W, at(d, o) + 5 * W] }]);
    edges.push(["a 24-hour store written as adjacent days counts once at midnight",
      { hours: [0, 1, 2, 3, 4, 5, 6].map((k) => [B, k, 0, 1440]), orders: [at(d + 1, 0), at(d, 0) + W, W] }]);
    edges.push(["Sunday night into Monday morning in a later week",
      { hours: [[A, 6, 1260, 120]], orders: [2 * W + 60, 2 * W + 120, 3 * W - 1] }]);
  }
  for (const [name, cse] of edges) tests.push({ name, args: pyArgs(cse), expect: pyOut(run(cse)) });

  // Timing: compared with the reference at check time. Checking every interval for every order
  // (or scanning a start-sorted list until starts pass the order) is O(n) per order.
  const seed = r.int(1, 1_000_000);
  tests.push({
    name: "3,000 stores (about 22,000 intervals) and 20,000 orders in time",
    args: `_gen_week_hours(3000, 20000, ${seed}, ${level})`,
    limit_s: 8,
  });

  return {
    vars: {
      midnight_rule: level === 1
        ? "In this exercise every interval closes on the day it opens (`close_min > open_min`), and every order falls in week 0 (`0 <= t < 10080`)."
        : "An interval with `close_min < open_min` crosses midnight: it runs from `open_min` on its day to `close_min` on the next day, and Sunday's runs into Monday morning. A `close_min` of 0 or 1440 means the interval ends at midnight." +
          (level === 2 ? " Every order falls in week 0 (`0 <= t < 10080`)." : ""),
      weeks_rule: level === 3
        ? "Orders span several weeks: `t` can be any non-negative minute, and the weekly schedule repeats every 10,080 minutes. A 24-hour store may be written as seven intervals of `(day, 0, 1440)`."
        : "",
    },
    samples,
    tests,
  };
}
