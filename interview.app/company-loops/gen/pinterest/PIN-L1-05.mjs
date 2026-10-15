/* PIN-L1-05 — Busier-day lookback: days back to the last busier day, per pin (Python).
   Simulated practice scenario. All data is generated from the seed; pins and daily save
   counts are hypothetical.

   Contract (python): entry, signature, starter, prelude, generate(r, level) ->
     { vars, samples: [{args, expect}], tests: [{name, args, expect?, limit_s?}] }.
   expect comes from oracle() below: for every day, a scan back over every earlier day of the
   pin (brute force, small inputs only). The evaluator's reference keeps a monotonic stack per
   pin, written independently.
   level: 1 Medium (consecutive days, rows sorted, one row per pin and day)
          · 2 Hard (+ days with no row had no saves: the lookback is in calendar days)
          · 3 Very Hard (+ rows in any order, and a day split over several rows whose saves add up) */
export const kind = "python";
export const entry = "busier_lookback";
export const signature = "def busier_lookback(rows: list[tuple[str, int, int]]) -> dict[str, list[int]]:";
export const starter = `def busier_lookback(rows):
    """rows: (pin_id, day, saves).
    Return {pin_id: [lookback for each day listed for that pin, in day order]}, where
    lookback = day - (the latest earlier listed day with strictly more saves), or 0 if none."""
    ...
`;

export const prelude = `
def _gen_series(n_pins, n_days, seed, sparse=False, shuffle=False):
    x = seed
    def rnd(m):
        nonlocal x
        x = (1103515245 * x + 12345) % 2147483648
        return (x >> 16) % m
    rows = []
    for k in range(n_pins):
        pin = 'pin_%d' % (5000 + 7 * k)
        level, day = rnd(50), 1
        rows.append((pin, day, 20000 + rnd(9000) if rnd(4) else level))   # most pins: a launch-day spike
        for _ in range(n_days - 1):
            shape = rnd(10)
            if shape < 8:                      # then a slow climb with long plateaus
                level += rnd(2)
            elif shape < 9:
                level = max(0, level - rnd(3))
            else:
                level += rnd(40)
            day += 1 + (rnd(4) == 0) * rnd(5) if sparse else 1
            rows.append((pin, day, level))
            if shuffle and rnd(8) == 0:        # a late partial count for the same day
                rows.append((pin, day, rnd(3)))
    if shuffle:
        for i in range(len(rows) - 1, 0, -1):
            j = rnd(i + 1)
            rows[i], rows[j] = rows[j], rows[i]
    return (rows,)
`.trim() + "\n";

// The specification, directly: sum each pin's rows per day, then for every day scan back
// over all earlier days for the latest one with strictly more saves.
export function oracle(rows) {
  const per = new Map();
  for (const [pin, day, s] of rows) {
    if (!per.has(pin)) per.set(pin, new Map());
    const m = per.get(pin);
    m.set(day, (m.get(day) || 0) + s);
  }
  const out = new Map();
  for (const [pin, m] of per) {
    const days = [...m.keys()].sort((a, b) => a - b);
    out.set(pin, days.map((d, i) => {
      for (let j = i - 1; j >= 0; j--) if (m.get(days[j]) > m.get(d)) return d - days[j];
      return 0;
    }));
  }
  return out;
}

const pyOut = (m) => "{" + [...m.entries()].map(([p, xs]) => `'${p}': [${xs.join(", ")}]`).join(", ") + "}";
const pyArgs = (rows) => `([${rows.map(([p, d, s]) => `('${p}', ${d}, ${s})`).join(", ")}],)`;

function series(r, level, pin, n, maxV) {
  const rows = [];
  let day = r.int(1, 30);
  for (let i = 0; i < n; i++) {
    rows.push([pin, day, r.int(0, maxV)]);
    day += level === 1 ? 1 : r.chance(0.3) ? r.int(2, 4) : 1;
  }
  return rows;
}

function randomCase(r, level, pins) {
  let rows = [];
  const k = level === 1 ? r.int(1, 2) : r.int(2, 3);
  for (const pin of pins.slice(0, k)) rows = rows.concat(series(r, level, pin, r.int(6, 11), r.pick([4, 6, 9])));
  if (level === 3) {
    const extra = [];
    for (const [p, d] of rows) if (r.chance(0.2)) extra.push([p, d, r.int(0, 3)]);
    rows = r.shuffle(rows.concat(extra));
  }
  return rows;
}

export function generate(r, level) {
  const pins = r.sample(["pin_3011", "pin_4187", "pin_5520", "pin_6643", "pin_7302"], 3);
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const rows = randomCase(r, level, pins);
    samples.push({ args: pyArgs(rows), expect: pyOut(oracle(rows)) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const P = pins[0], Q = pins[1];
  const d = r.int(1, 20);
  const v = r.int(5, 30);
  const run = (vals, start = d, pin = P) => vals.map((x, i) => [pin, start + i, x]);
  const edges = [
    ["a single day has no earlier busier day: 0", run([v])],
    ["an equal day is not busier: the lookback goes past it", run([v + 3, v, v, v])],
    ["a falling series: every day looks back one day", run([v + 4, v + 3, v + 2, v + 1, v])],
    ["a rising series: no day has an earlier busier day", run([v, v + 1, v + 2, v + 5])],
    ["a busy launch day far back, past a long climb below it", run([v + 50, v, v + 1, v + 1, v + 2, v + 3, v + 3, v + 4])],
    ["a dip and a recovery: the recovery skips the days it beats", run([v + 9, v + 6, v + 2, v + 4, v + 7, v + 1])],
  ];
  if (level >= 2) {
    edges.push(["days with no row had no saves: the lookback is in calendar days", [[P, d, v + 2], [P, d + 5, v], [P, d + 6, v + 1], [P, d + 13, v]]]);
    edges.push(["a listed day with 0 saves", [[P, d, 0], [P, d + 3, 0], [P, d + 4, v], [P, d + 9, 0]]]);
    edges.push(["two pins never look at each other", run([v, v + 1], d, P).concat(run([v + 9, v], d + 1, Q))]);
  }
  if (level === 3) {
    edges.push(["rows in any order", [[P, d + 2, v], [P, d, v + 3], [P, d + 1, v + 1], [P, d + 3, v + 2]]]);
    edges.push(["a day split over two rows adds up and becomes the busier day", [[P, d, v + 2], [P, d + 1, v], [P, d + 1, 3], [P, d + 2, v + 1]]]);
    edges.push(["rows of two pins interleaved, with a split day", [[Q, d + 1, v], [P, d + 1, v], [Q, d, v + 1], [P, d, v], [P, d + 1, 1], [Q, d + 2, v]]]);
  }
  for (const [name, rows] of edges) tests.push({ name, args: pyArgs(rows), expect: pyOut(oracle(rows)) });

  // Timing: 100 pins × 3 000 days. Most pins open with a launch-day spike and then climb slowly
  // with long plateaus, so a scan back from each day runs to the spike: O(n²) per pin. A
  // monotonic stack is O(n).
  const seed = r.int(1, 1_000_000);
  tests.push({
    name: "100 pins, 3,000 days each, slow climbs below a launch spike (a stack, not a scan back)",
    args: level === 1 ? `_gen_series(100, 3000, ${seed})` : level === 2 ? `_gen_series(100, 3000, ${seed}, True)` : `_gen_series(100, 3000, ${seed}, True, True)`,
    limit_s: 8,
  });

  return {
    vars: {
      day_rule: level === 1
        ? "In this exercise every pin has one row for each day from its first listed day to its last, and `rows` is sorted by pin and day."
        : level === 2
          ? "`rows` is sorted by pin and day, but days can be missing: a day with no row had no saves, so it is never busier, and the lookback counts calendar days (`day` minus the busier day). Return one value per listed day only."
          : "`rows` arrives in any order, days can be missing (a day with no row had no saves; the lookback counts calendar days), and a late partial count can add a second row for the same pin and day: that day's saves are the sum of its rows. Return one value per distinct listed day.",
    },
    samples,
    tests,
  };
}
