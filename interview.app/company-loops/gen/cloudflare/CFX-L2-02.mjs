/* CFX-L2-02 — Dashboard range peaks: maximum requests per second over many ranges
   (Python, range queries / sparse table).
   Simulated practice scenario. All data is generated from the seed.

   Contract (python): entry, signature, starter, prelude, generate(r, level) ->
     { vars, samples: [{args, expect}], tests: [{name, args, expect?, limit_s?}] }.
   expect comes from oracle() below, which rebuilds the per-second series and scans
   every second of every range. The evaluator's reference answers each range in O(1)
   from a sparse table, so each checks the other.
   level: 1 Medium (peak per range) · 2 Hard (+ the earliest second at which the peak
          happened) · 3 Very Hard (+ unsorted rows, several rows for one second, seconds
          with no row) */
export const kind = "python";
export const entry = "range_peaks";
export const signature = "def range_peaks(samples: list[tuple[int, int]], ranges: list[tuple[int, int]], with_time: bool = False) -> list:";
export const starter = `def range_peaks(samples, ranges, with_time=False):
    """samples: (epoch_second, requests) rows for one zone.
    ranges: (first_second, last_second) pairs, both inclusive.
    Return the peak requests per second inside each range."""
    ...
`;

export const prelude = `
def _gen_series(n, seed, start=1760000000):
    x, out, level = seed, [], 4000
    for i in range(n):
        x = (1103515245 * x + 12345) % 2147483648
        level = max(0, level + (x >> 16) % 201 - 100)
        out.append((start + i, level + (x >> 8) % 50))
    return out


def _gen_ranges(n, q, seed, start=1760000000):
    x, out = seed, []
    for _ in range(q):
        x = (1103515245 * x + 12345) % 2147483648
        a = start - 50 + (x >> 8) % (n // 2)
        x = (1103515245 * x + 12345) % 2147483648
        out.append((a, a + (x >> 8) % (n // 2 + 100)))
    return out
`.trim() + "\n";

// Rebuild the series and scan each range second by second.
export function oracle(samples, ranges, withTime) {
  if (!samples.length) return ranges.map(() => null);
  const per = new Map();
  for (const [s, c] of samples) per.set(s, (per.get(s) || 0) + c);
  const lo = Math.min(...per.keys()), hi = Math.max(...per.keys());
  return ranges.map(([a, b]) => {
    const from = Math.max(a, lo), to = Math.min(b, hi);
    if (from > to) return null;
    let best = -1, at = null;
    for (let t = from; t <= to; t++) {
      const v = per.get(t) || 0;
      if (v > best) { best = v; at = t; }
    }
    return withTime ? [best, at] : best;
  });
}

const pyPairs = (ps) => "[" + ps.map(([a, b]) => `(${a}, ${b})`).join(", ") + "]";
const pyArgs = (c) => `(${pyPairs(c.samples)}, ${pyPairs(c.ranges)}, ${c.withTime ? "True" : "False"})`;
const pyOut = (xs) => "[" + xs.map((x) => (x === null ? "None" : Array.isArray(x) ? `(${x[0]}, ${x[1]})` : String(x))).join(", ") + "]";
const run = (c) => oracle(c.samples, c.ranges, c.withTime);

function series(r, start, n, level) {
  let rows = [];
  const peak = r.int(40, 95);
  for (let i = 0; i < n; i++) rows.push([start + i, r.int(0, peak)]);
  if (level === 3) {
    rows = rows.filter((_, i) => i === 0 || i === n - 1 || !r.chance(0.2));       // seconds with no row
    const extra = r.sample(rows, 3).map(([s]) => [s, r.int(1, 30)]);            // a second row for a second
    rows = r.shuffle(rows.concat(extra));
  }
  return rows;
}

export function generate(r, level) {
  const withTime = level >= 2;
  const start = 1760000000 + r.int(0, 2000) * 60;
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const n = r.int(12, 20);
    const s0 = start + i * 1000;
    const rows = series(r, s0, n, level);
    const ranges = Array.from({ length: 6 }, () => {
      const a = s0 + r.int(-3, n - 1);
      return [a, a + r.int(0, Math.min(10, n))];
    });
    const c = { samples: rows, ranges, withTime };
    samples.push({ args: pyArgs(c), expect: pyOut(run(c)) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  // Hand-built series: n seconds from s0, with a repeated peak value.
  const n = r.int(17, 23);
  const s0 = start + 50000;
  const vals = Array.from({ length: n }, () => r.int(5, 60));
  const pk = 80 + r.int(0, 9);
  const p1 = r.int(3, 6), p2 = p1 + r.int(4, 7);
  vals[p1] = pk; vals[p2] = pk;
  const rows = vals.map((v, i) => [s0 + i, v]);
  const last = s0 + n - 1;
  const edges = [
    ["a range of one second", [[s0 + 2, s0 + 2], [last, last]]],
    ["a range that is exactly the whole series", [[s0, last]]],
    ["a range that starts before the series and ends after it is clipped", [[s0 - 30, last + 30], [s0 - 1, s0 + 1]]],
    ["a range entirely before or after the series is None", [[s0 - 20, s0 - 1], [last + 1, last + 9]]],
    ["a range whose first second is after its last is None", [[s0 + 9, s0 + 4]]],
    ["the same peak twice in one range: the earliest second is reported", [[s0 + p1, s0 + p2], [s0, last]]],
    ["ranges of 8 and 9 seconds, where the two halves overlap", [[s0 + 1, s0 + 8], [s0 + 1, s0 + 9], [s0 + p1 + 1, s0 + p2 - 1]]],
    ["the same range asked twice", [[s0 + 3, s0 + 11], [s0 + 3, s0 + 11]]],
  ];
  for (const [name, ranges] of edges) {
    const c = { samples: rows, ranges, withTime };
    tests.push({ name, args: pyArgs(c), expect: pyOut(run(c)) });
  }
  tests.push({ name: "no rows at all: every range is None", args: pyArgs({ samples: [], ranges: [[s0, last], [s0, s0]], withTime }), expect: pyOut(run({ samples: [], ranges: [[s0, last], [s0, s0]], withTime })) });
  tests.push({ name: "no ranges", args: pyArgs({ samples: rows, ranges: [], withTime }), expect: "[]" });
  if (level === 3) {
    const gapRows = rows.filter((_, i) => i < 4 || i > 11);            // seconds 4..11 have no row
    const dup = [[s0 + 2, 70], [s0 + 2, 25], ...gapRows.slice().reverse()];
    const cases = [
      ["a range inside a stretch with no rows peaks at 0, at its first second", { samples: gapRows, ranges: [[s0 + 5, s0 + 9], [s0 + 4, s0 + 11]], withTime }],
      ["rows for the same second are added together", { samples: dup, ranges: [[s0 + 1, s0 + 3], [s0 + 2, s0 + 2]], withTime }],
      ["rows in any order give the same answers", { samples: r.shuffle(rows), ranges: [[s0, last], [s0 + p1 + 1, last]], withTime }],
    ];
    for (const [name, c] of cases) tests.push({ name, args: pyArgs(c), expect: pyOut(run(c)) });
  }

  const N = 150000, Q = 100000;
  const seed = r.int(1, 1_000_000);
  const series_ = level === 3 ? `_gen_series(${N}, ${seed})[::-1]` : `_gen_series(${N}, ${seed})`;
  tests.push({
    name: `${N.toLocaleString("en-US")} seconds and ${Q.toLocaleString("en-US")} ranges in time`,
    args: `(${series_}, _gen_ranges(${N}, ${Q}, ${seed + 1}), ${withTime ? "True" : "False"})`,
    limit_s: 8,
  });

  return {
    vars: {
      time_rule: withTime
        ? "With `with_time=True`, return `(peak, second)` for each range instead, where `second` is the earliest second in the range at which the peak happened."
        : "In this exercise `with_time` is False: return the peak alone.",
      rows_rule: level === 3
        ? "Rows come from several log batches: they are in no particular order, one second can have several rows (add them together), and a second with no row had 0 requests."
        : "In this exercise the rows are sorted, with exactly one row for every second from the first to the last.",
    },
    samples,
    tests,
  };
}
