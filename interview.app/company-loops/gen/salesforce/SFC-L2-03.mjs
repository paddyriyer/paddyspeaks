/* SFC-L2-03 — Debug the forecast rollup (debug, Python).
   Simulated practice scenario. All data is generated from the seed.

   Contract (debug): like python, but `starter` is buggy code the candidate fixes.
   The evaluator's reference is the fixed code. expect comes from oracle() below,
   an independent JavaScript implementation of the specification in the template
   (linear scans for rates, BigInt arithmetic for the credited amounts).
   Planted bugs (see the evaluator notes): Omitted opportunities roll into the
   pipeline bucket; the dated rate lookup ignores a rate that takes effect on the
   close date (bisect_left, not bisect_right); split rows overwrite each other, so
   only the last member of a split is credited; the owner is the last history entry
   in list order, not the latest by date; the first month of a fiscal year that does
   not start in January is put in the previous fiscal year (> instead of >=).
   level: 1 Medium (one foreign currency, single owners, fiscal year in January)
          · 2 Hard (+ several currencies with rate changes, splits, a fiscal year
            starting in another month)
          · 3 Very Hard (+ owner changes listed out of order, Omitted deals, rate
            changes on close dates) */
export const kind = "debug";
export const entry = "forecast_rollup";
export const signature = "def forecast_rollup(opps: list[dict], split_rows: list[tuple[str, str, int]], rates: list[tuple[str, str, int]], corporate: str, fy_start: int) -> dict:";
export const starter = `from bisect import bisect_left

BUCKETS = ("closed", "commit", "best_case", "pipeline")
ROLLS_INTO = {                      # forecast category -> buckets it counts in
    "Closed": ("closed", "commit", "best_case", "pipeline"),
    "Commit": ("commit", "best_case", "pipeline"),
    "Best Case": ("best_case", "pipeline"),
    "Pipeline": ("pipeline",),
    "Omitted": ("pipeline",),
}


def _fiscal_quarter(close_date, fy_start):
    year, month = int(close_date[:4]), int(close_date[5:7])
    fy = year + 1 if fy_start > 1 and month > fy_start else year
    quarter = (month - fy_start) % 12 // 3 + 1
    return "FY%d-Q%d" % (fy, quarter)


def forecast_rollup(opps, split_rows, rates, corporate, fy_start):
    by_currency = {}
    for currency, effective, ppm in rates:
        by_currency.setdefault(currency, []).append((effective, ppm))
    for series in by_currency.values():
        series.sort()
    dates = {c: [d for d, _ in s] for c, s in by_currency.items()}
    splits = {opp_id: (user, pct) for opp_id, user, pct in split_rows}

    out = {}
    for o in opps:
        if o["currency"] == corporate:
            ppm = 1_000_000
        else:
            i = bisect_left(dates[o["currency"]], o["close_date"]) - 1
            ppm = by_currency[o["currency"]][i][1]
        owner = o["owner_history"][-1][1]
        credits = [splits[o["id"]]] if o["id"] in splits else [(owner, 100)]
        quarter = _fiscal_quarter(o["close_date"], fy_start)
        for user, pct in credits:
            amount = o["amount"] * pct * ppm // 100_000_000
            row = out.setdefault(user + "/" + quarter, dict.fromkeys(BUCKETS, 0))
            for bucket in ROLLS_INTO[o["category"]]:
                row[bucket] += amount
    return out
`;

export const prelude = `
def _gen_forecast(n, seed):
    x = seed
    def rnd(m):
        nonlocal x
        x = (1103515245 * x + 12345) % 2147483648
        return (x >> 16) % m
    curs = ['EUR', 'GBP', 'CAD', 'AUD', 'CHF', 'SEK', 'NZD', 'SGD']
    rates = []
    for c in curs:
        for k in range(2000):
            y, rest = divmod(k, 336)
            m, day = divmod(rest, 28)
            rates.append((c, '%d-%02d-%02d' % (2005 + 3 * y, m + 1, day + 1), 600000 + rnd(800000)))
    cats = ('Pipeline', 'Best Case', 'Commit', 'Closed', 'Omitted')
    opps, split_rows = [], []
    for i in range(n):
        oid = '006%012d' % i
        hist = [('2025-%02d-%02d' % (4 * j + 1 + rnd(4), 1 + rnd(28)), 'rep%d' % rnd(400)) for j in range(1 + rnd(3))]
        if rnd(2):
            hist.reverse()
        opps.append({'id': oid, 'owner_history': hist, 'amount': 1000 + rnd(5000000),
                     'currency': ('USD', curs[rnd(8)])[rnd(2)],
                     'close_date': '20%02d-%02d-%02d' % (11 + rnd(14), 1 + rnd(12), 1 + rnd(28)),
                     'category': cats[rnd(5)]})
        if rnd(5) == 0:
            a = 10 + rnd(80)
            split_rows.append((oid, 'rep%d' % rnd(400), a))
            split_rows.append((oid, 'rep%d' % rnd(400), 100 - a))
    return opps, split_rows, rates, 'USD', 2
`.trim() + "\n";

// The specification, implemented independently of the Python reference.
const ROLL = {
  Closed: ["closed", "commit", "best_case", "pipeline"],
  Commit: ["commit", "best_case", "pipeline"],
  "Best Case": ["best_case", "pipeline"],
  Pipeline: ["pipeline"],
  Omitted: [],
};
export function oracle(opps, splitRows, rates, corporate, fyStart) {
  const out = new Map();
  for (const o of opps) {
    let ppm = 1000000;
    if (o.currency !== corporate) {
      let bestDate = null;
      for (const [c, eff, p] of rates) {
        if (c === o.currency && eff <= o.close_date && (bestDate === null || eff > bestDate)) { bestDate = eff; ppm = p; }
      }
      if (bestDate === null) throw new Error("SFC-L2-03: no rate for " + o.currency + " on " + o.close_date);
    }
    let owner = null, latest = null;
    for (const [d, u] of o.owner_history) if (latest === null || d > latest) { latest = d; owner = u; }
    const mine = splitRows.filter(([id]) => id === o.id).map(([, u, p]) => [u, p]);
    const credits = mine.length ? mine : [[owner, 100]];
    const y = Number(o.close_date.slice(0, 4)), m = Number(o.close_date.slice(5, 7));
    // The fiscal year is named by the calendar year in which it ends.
    const fy = fyStart === 1 ? y : m >= fyStart ? y + 1 : y;
    const quarter = Math.floor((((m - fyStart) % 12) + 12) % 12 / 3) + 1;
    const key = (u) => `${u}/FY${fy}-Q${quarter}`;
    for (const [u, pct] of credits) {
      const amt = Number((BigInt(o.amount) * BigInt(pct) * BigInt(ppm)) / 100000000n);
      if (!out.has(key(u))) out.set(key(u), { closed: 0, commit: 0, best_case: 0, pipeline: 0 });
      const row = out.get(key(u));
      for (const b of ROLL[o.category]) row[b] += amt;
    }
  }
  return out;
}

const q = (s) => "'" + s + "'";
const pyOpp = (o) => `{'id': ${q(o.id)}, 'owner_history': [${o.owner_history.map(([d, u]) => `(${q(d)}, ${q(u)})`).join(", ")}], ` +
  `'amount': ${o.amount}, 'currency': ${q(o.currency)}, 'close_date': ${q(o.close_date)}, 'category': ${q(o.category)}}`;
const pyArgs = (c) => `([${c.opps.map(pyOpp).join(", ")}], [${c.splits.map(([o, u, p]) => `(${q(o)}, ${q(u)}, ${p})`).join(", ")}], ` +
  `[${c.rates.map(([cur, d, p]) => `(${q(cur)}, ${q(d)}, ${p})`).join(", ")}], ${q(c.corporate)}, ${c.fy})`;
const pyOut = (m) => "{" + [...m.entries()].map(([k, v]) => `${q(k)}: {'closed': ${v.closed}, 'commit': ${v.commit}, 'best_case': ${v.best_case}, 'pipeline': ${v.pipeline}}`).join(", ") + "}";
const run = (c) => oracle(c.opps, c.splits, c.rates, c.corporate, c.fy);

const REPS = ["avery", "blake", "casey", "devon", "emery", "finley", "harper", "jordan", "kai", "logan", "morgan", "quinn", "riley", "sage"];
const FOREIGN = ["EUR", "GBP", "CAD", "AUD", "CHF", "SEK"];
const CATS = ["Pipeline", "Best Case", "Commit", "Closed"];
const p2 = (n) => String(n).padStart(2, "0");
const day = (y, m, d) => `${y}-${p2(m)}-${p2(d)}`;
let oppNo = 0;
const oppId = (r) => "006" + p2(++oppNo) + String(r.int(1000000, 9999999));

function randomCase(r, level) {
  const corporate = r.pick(["USD", "USD", "EUR"]);
  const foreign = r.sample(FOREIGN.filter((c) => c !== corporate), level === 1 ? 1 : r.int(2, 3));
  const fy = level === 1 ? 1 : r.pick([2, 4, 7, 10, 11]);
  const year = r.int(2025, 2026);
  const rates = [];
  for (const c of foreign) {
    rates.push([c, day(year - 1, 1, 1), r.int(600, 1400) * 1000]);
    const changes = level === 1 ? 1 : r.int(2, 4);
    const seen = new Set();
    for (let k = 0; k < changes; k++) {
      const d = day(year, r.int(1, 12), r.int(1, 28));
      if (!seen.has(d)) { seen.add(d); rates.push([c, d, r.int(600000, 1400000)]); }
    }
  }
  const shuffledRates = r.shuffle(rates);
  const reps = r.sample(REPS, level === 1 ? 3 : 4);
  const opps = [], splits = [];
  const n = level === 1 ? r.int(4, 6) : r.int(6, 8);
  for (let i = 0; i < n; i++) {
    const id = oppId(r);
    let closeDate = day(year, r.int(1, 12), r.int(1, 28));
    if (level === 3 && r.chance(0.3)) {                       // close on the day a rate changes
      const ch = r.pick(rates.filter(([, d]) => d.startsWith(String(year))));
      if (ch) closeDate = ch[1];
    }
    const hist = [[day(year - 1, r.int(1, 12), r.int(1, 28)), r.pick(reps)]];
    if (level >= 2 && r.chance(0.5)) hist.push([day(year, r.int(1, 12), r.int(1, 28)), r.pick(reps)]);
    const history = level === 3 && r.chance(0.6) ? r.shuffle(hist) : hist.slice().sort((a, b) => (a[0] < b[0] ? -1 : 1));
    const cat = level === 3 && r.chance(0.15) ? "Omitted" : r.pick(CATS);
    opps.push({ id, owner_history: history, amount: r.int(5, 900) * 1000 + r.int(0, 99) * 7, currency: r.chance(0.5) ? corporate : r.pick(foreign), close_date: closeDate, category: cat });
    if (level >= 2 && r.chance(0.3)) {
      const [u1, u2] = r.sample(reps, 2);
      const a = r.pick([25, 30, 40, 50, 60, 70]);
      splits.push([id, u1, a], [id, u2, 100 - a]);
    }
  }
  return { opps, splits, rates: shuffledRates, corporate, fy };
}

export function generate(r, level) {
  oppNo = 0;
  const samples = [];
  for (let i = 0; i < 2; i++) {
    const c = randomCase(r, level);
    samples.push({ args: pyArgs(c), expect: pyOut(run(c)) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const [R1, R2, R3] = r.sample(REPS, 3);
  const cur = r.pick(["EUR", "GBP", "CAD"]);
  const y = r.int(2025, 2026);
  const amt = r.int(10, 400) * 1000 + r.int(1, 999);
  const opp = (o) => Object.assign({ id: oppId(r), owner_history: [[day(y - 1, 3, 1), R1]], amount: amt, currency: "USD", close_date: day(y, 5, 15), category: "Commit" }, o);
  const base = (o) => ({ splits: [], rates: [[cur, day(y - 1, 1, 1), 900000]], corporate: "USD", fy: 1, ...o });
  const sid = oppId(r);
  const edges = [
    ["a Closed deal counts in every bucket; a Pipeline deal only in pipeline",
      base({ opps: [opp({ category: "Closed" }), opp({ category: "Pipeline", amount: 5000 })] })],
    ["an Omitted deal keeps its row but adds to no bucket",
      base({ opps: [opp({ category: "Pipeline", amount: 7000 }), opp({ category: "Omitted", amount: 50000 }), opp({ category: "Omitted", owner_history: [[day(y - 1, 3, 1), R2]] })] })],
    ["a rate that takes effect on the close date applies to that deal",
      base({ opps: [opp({ currency: cur, close_date: day(y, 4, 1) })], rates: [[cur, day(y, 4, 1), 1250000], [cur, day(y - 1, 1, 1), 800000]] })],
    ["a rate that takes effect after the close date does not apply",
      base({ opps: [opp({ currency: cur, close_date: day(y, 3, 31) })], rates: [[cur, day(y, 4, 1), 1250000], [cur, day(y - 1, 1, 1), 800000]] })],
    ["a two-way split credits both members, each rounded down",
      base({ opps: [opp({ id: sid, amount: 100001, category: "Best Case" })], splits: [[sid, R2, 30], [sid, R3, 70]] })],
    ["an owner change mid-quarter moves the whole deal; history is not in date order",
      base({ opps: [opp({ owner_history: [[day(y, 5, 2), R2], [day(y - 1, 11, 20), R1], [day(y, 4, 10), R3]] })] })],
    ["the first month of a fiscal year that starts in February is quarter 1 of the next fiscal year",
      base({ fy: 2, opps: [opp({ close_date: day(y, 2, 10) }), opp({ close_date: day(y, 1, 31), category: "Closed" })] })],
    ["a fiscal year starting in November wraps across the calendar year",
      base({ fy: 11, opps: [opp({ close_date: day(y, 1, 5) }), opp({ close_date: day(y, 11, 1), category: "Closed" }), opp({ close_date: day(y, 10, 31), category: "Pipeline" })] })],
    ["the corporate currency converts at exactly 1",
      base({ corporate: cur, opps: [opp({ currency: cur })], rates: [[cur, day(y - 1, 1, 1), 900000], ["USD", day(y - 1, 1, 1), 1100000]] })],
  ];
  for (const [name, c] of edges) tests.push({ name, args: pyArgs(c), expect: pyOut(run(c)) });

  tests.push({ name: "60,000 opportunities and 16,000 dated rates in time", args: `_gen_forecast(60000, ${r.int(1, 1_000_000)})`, limit_s: 8 });

  return {
    vars: {
      replay_rule: level === 1
        ? "This replay has one foreign currency, single owners and a fiscal year that starts in January; the checks also cover the other rules."
        : level === 2
          ? "This replay has several currencies whose rates change during the year, split opportunities, owner changes and a fiscal year that does not start in January."
          : "This replay has several currencies whose rates change during the year (sometimes on a deal's close date), split opportunities, owner histories exported out of date order, Omitted deals and a fiscal year that does not start in January.",
    },
    samples,
    tests,
  };
}
