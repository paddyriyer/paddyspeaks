/* MSF-L2-02 — Blob storage tiering: the cheapest hot / cool / cold / archive schedule (Python).
   Simulated practice scenario. All data is generated from the seed.

   Contract (python): entry, signature, starter, prelude, generate(r, level) ->
     { vars, samples: [{args, expect}], tests: [{name, args, expect?, limit_s?}] }.
   expect comes from oracle() below: a dynamic programme over STAYS — for every end
   day and tier, try every start day of the last stay (O(D² · T²)), charging each
   stay its storage, reads and early-deletion shortfall. The evaluator's reference
   is a day-by-day programme over (tier, days in tier capped at the minimum),
   written independently; both were checked against brute-force enumeration of
   every tier sequence on thousands of small random cases.
   level: 1 Medium (hot and cool) · 2 Hard (+ an offline archive tier with a
          rehydration fee) · 3 Very Hard (+ a cold tier; long minimums that the
          trace does not always outlast) */
export const kind = "python";
export const entry = "cheapest_tiering";
export const signature = "def cheapest_tiering(reads: list[int], tiers: dict[str, dict]) -> tuple[int, int]:";
export const starter = `def cheapest_tiering(reads, tiers):
    """reads[d]: reads of the blob on day d (len >= 1).
    tiers: {name: {"store", "read", "min_days", "enter", "leave"}}; read is None
    for an offline tier. Return (total_cost, tier_changes) for the cheapest
    schedule, fewest changes on a cost tie."""
    ...
`;

export const prelude = `
def _gen_trace(days, n_tiers, seed):
    x = seed
    def rnd(m):
        nonlocal x
        x = (1103515245 * x + 12345) % 2147483648
        return (x >> 16) % m
    reads = []
    for d in range(days):
        if d < 20:
            reads.append(20 + rnd(200))                 # busy while new
        elif rnd(1000) < 6:
            reads.append(1 + rnd(40))                   # an occasional audit or restore
        else:
            reads.append(0 if rnd(100) < 90 else 1)
    tiers = {
        'hot': {'store': 40 + rnd(20), 'read': 1, 'min_days': 0, 'enter': 0, 'leave': 0},
        'cool': {'store': 20 + rnd(8), 'read': 6 + rnd(5), 'min_days': 30, 'enter': 40 + rnd(40), 'leave': 0},
        'cold': {'store': 8 + rnd(4), 'read': 30 + rnd(30), 'min_days': 90, 'enter': 80 + rnd(60), 'leave': 0},
        'archive': {'store': 2 + rnd(3), 'read': None, 'min_days': 180, 'enter': 100 + rnd(100), 'leave': 1500 + rnd(2000)},
    }
    names = {2: ['hot', 'cool'], 3: ['hot', 'cool', 'archive']}.get(n_tiers, list(tiers))
    return reads, {n: tiers[n] for n in names}
`.trim() + "\n";

const less = (a, b) => a[0] < b[0] || (a[0] === b[0] && a[1] < b[1]);

// The specification as a programme over stays: f[e][t] is the cheapest
// (cost, changes) for days 0..e-1 whose last stay is in tier t and ends at day e.
export function oracle(reads, tiers) {
  const names = Object.keys(tiers);
  const D = reads.length;
  const pre = [0], busy = [0];
  for (const x of reads) { pre.push(pre[pre.length - 1] + x); busy.push(busy[busy.length - 1] + (x > 0 ? 1 : 0)); }
  const f = Array.from({ length: D + 1 }, () => names.map(() => null));
  for (let e = 1; e <= D; e++) {
    names.forEach((n, i) => {
      const t = tiers[n];
      let best = null;
      for (let s = 0; s < e; s++) {
        if (t.read === null && busy[e] - busy[s] > 0) continue;      // offline on a day with reads
        const len = e - s;
        const stay = len * t.store + (pre[e] - pre[s]) * (t.read || 0) + Math.max(0, t.min_days - len) * t.store;
        let cand = null;
        if (s === 0) cand = [stay, 0];
        else {
          names.forEach((m, j) => {
            if (j === i || f[s][j] === null) return;
            const v = [f[s][j][0] + tiers[m].leave + t.enter + stay, f[s][j][1] + 1];
            if (cand === null || less(v, cand)) cand = v;
          });
        }
        if (cand !== null && (best === null || less(cand, best))) best = cand;
      }
      f[e][i] = best;
    });
  }
  let ans = null;
  for (const v of f[D]) if (v !== null && (ans === null || less(v, ans))) ans = v;
  return ans;
}

const py = (v) => (v === null ? "None" : String(v));
const pyTiers = (tiers) => "{" + Object.entries(tiers).map(([n, t]) =>
  `'${n}': {'store': ${t.store}, 'read': ${py(t.read)}, 'min_days': ${t.min_days}, 'enter': ${t.enter}, 'leave': ${t.leave}}`).join(", ") + "}";
const pyArgs = (reads, tiers) => `([${reads.join(", ")}], ${pyTiers(tiers)})`;
const pyOut = ([c, k]) => `(${c}, ${k})`;
const T = (store, read, min_days, enter, leave) => ({ store, read, min_days, enter, leave });

function priceList(r, level) {
  const hot = r.int(30, 60);
  const tiers = {
    hot: T(hot, r.int(1, 2), 0, 0, 0),
    cool: T(Math.round(hot * r.int(40, 55) / 100), r.int(4, 10), r.pick(level === 1 ? [5, 7, 10] : [7, 10, 14]), r.int(20, 80), 0),
  };
  if (level === 3) tiers.cold = T(Math.round(hot * r.int(15, 25) / 100), r.int(25, 60), r.pick([20, 30]), r.int(50, 150), 0);
  if (level >= 2) tiers.archive = T(r.int(1, 4), null, r.pick(level === 2 ? [20, 30] : [30, 45]), r.int(50, 150), r.int(250, 900));
  return tiers;
}

function traceFor(r, level) {
  const D = level === 1 ? r.int(18, 30) : level === 2 ? r.int(35, 60) : r.int(50, 90);
  const busyDays = r.int(2, 6);
  const audits = new Set(Array.from({ length: r.int(1, level === 1 ? 2 : 3) }, () => r.int(busyDays + 3, D - 1)));
  return Array.from({ length: D }, (_, d) => (d < busyDays ? r.int(15, 120) : audits.has(d) ? r.int(1, 30) : r.chance(0.08) ? 1 : 0));
}

export function generate(r, level) {
  const samples = [];
  for (let i = 0; i < 3; i++) {
    let reads, tiers, got;
    for (let attempt = 0; attempt < 40; attempt++) {
      reads = traceFor(r, level);
      tiers = priceList(r, level);
      got = oracle(reads, tiers);
      if (got[1] > 0) break;                          // prefer traces where moving pays
    }
    samples.push({ args: pyArgs(reads, tiers), expect: pyOut(got) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const h = r.int(20, 40), c = r.int(4, 8), m = r.int(3, 6), big = r.int(500, 900);
  const hotCool = (min, leave = 0) => ({ hot: T(h, 0, 0, 0, 0), cool: T(c, 50, min, r.int(1, 5), leave) });
  const quiet = (n) => Array(n).fill(0);
  const edges = [
    ["leaving after exactly min_days days owes no early-deletion charge", [...quiet(m), big], hotCool(m)],
    ["leaving one day before min_days owes one day of storage", [...quiet(m - 1), big], hotCool(m)],
    ["deletion after the last day charges the early-deletion shortfall but no leave fee",
      quiet(2), { hot: T(10, 0, 0, 0, 0), cool: T(2, 1, 5, 0, 100) }],
    ["a single day", [r.int(0, 3)], hotCool(m)],
    ["on a cost tie, fewer tier changes wins",
      [1, 0], { hot: T(4, 0, 0, 0, 0), cool: T(2, 4, 0, 2, 0) }],
    ["a stay longer than the minimum owes nothing extra", [...quiet(m + r.int(2, 5)), big], hotCool(m)],
  ];
  if (level >= 2) {
    const arch = (leave) => ({ hot: T(h, 1, 0, 0, 0), cool: T(c + 6, 6, m, 3, 0), archive: T(1, null, 2 * m, 2, leave) });
    edges.push(["an offline tier is never used on a day with reads", [0, 0, 1, 0, 0], arch(10)]);
    edges.push(["one read after a long quiet stretch: rehydrate from the archive or stay online",
      [...quiet(4 * m), r.int(1, 3)], arch(r.int(20, 60))]);
    edges.push(["a rehydration fee larger than the savings keeps the blob online",
      [...quiet(2 * m), 1], arch(5000)]);
    edges.push(["moving to a cooler tier before the minimum owes early deletion on the tier left",
      [...Array(m - 1).fill(1), ...quiet(6 * m)], { hot: T(h, 1, 0, 0, 0), cool: T(c + 6, 6, m, 0, 0), archive: T(1, null, m, 0, 0) }]);
  }
  if (level === 3) {
    edges.push(["four tiers, with one read in the middle of a long quiet stretch",
      [...quiet(m), ...quiet(3 * m), r.int(1, 4), ...quiet(m)],
      { hot: T(h, 1, 0, 0, 0), cool: T(c + 8, 5, m, 2, 0), cold: T(c, 20, 2 * m, 4, 0), archive: T(1, null, 3 * m, 4, 400) }]);
    edges.push(["a minimum longer than the whole trace is charged at deletion",
      quiet(m), { hot: T(h, 1, 0, 0, 0), cold: T(3, 20, 10 * m, 0, 0), archive: T(1, null, 30 * m, 0, 0) }]);
  }
  for (const [name, reads, tiers] of edges) tests.push({ name, args: pyArgs(reads, tiers), expect: pyOut(oracle(reads, tiers)) });

  // Timing: ten years of daily reads. The day-by-day programme does
  // O(D · Σ min_days) work; trying every start day of every stay is O(D² · T²),
  // and enumerating tier sequences is T^D.
  tests.push({
    name: "3,650 days of reads (ten years), per-day programme rather than all stays or all sequences",
    args: `_gen_trace(3650, ${level + 1}, ${r.int(1, 1_000_000)})`,
    limit_s: 8,
  });

  return {
    vars: {
      tier_rule: level === 1
        ? "In this replay `tiers` has two online tiers, `hot` and `cool`, but the code must accept any number of tiers."
        : level === 2
          ? "In this replay `tiers` has `hot`, `cool` and an offline `archive`, but the code must accept any number of tiers."
          : "In this replay `tiers` has `hot`, `cool`, `cold` and an offline `archive`, and some minimums are longer than the trace.",
    },
    samples,
    tests,
  };
}
