/* CRW-L2-03 — Debug the GPU-hour invoice calculator (debug, Python).
   Simulated practice scenario. All data is generated from the seed; every price,
   reservation and customer is hypothetical.

   Contract (debug): like python, but `starter` is buggy code the candidate fixes.
   The evaluator's reference is the fixed code. expect comes from oracle() below, an
   independent JavaScript implementation of the specification in the template.
   Planted bugs (see the evaluator notes): timedelta.seconds drops whole days from a
   segment; reserved hours are carried across months instead of resetting each month;
   a segment is priced at the rate in force when the run started, not when the segment
   started; a segment is billed to the month the run started in; each part of a line
   is rounded separately with round(), which also rounds half to even.
   level: 1 Medium (one month, no price amendments, runs shorter than a day)
          2 Hard (+ runs of several days and runs across a month boundary)
          3 Very Hard (+ on-demand price amendments in the middle of a month) */
export const kind = "debug";
export const entry = "monthly_invoice_lines";
export const signature = "def monthly_invoice_lines(runs: list[dict], prices: list[dict], reservations: dict) -> dict:";
export const starter = `from datetime import datetime


def _parse(ts):
    return datetime.fromisoformat(ts)


def _next_month(dt):
    """The first instant of the calendar month after dt (UTC)."""
    if dt.month == 12:
        return dt.replace(year=dt.year + 1, month=1, day=1, hour=0, minute=0, second=0)
    return dt.replace(month=dt.month + 1, day=1, hour=0, minute=0, second=0)


def _price_rows(prices):
    by_type = {}
    for p in prices:
        by_type.setdefault(p["gpu_type"], []).append((_parse(p["from"]), p["cents_per_hour"]))
    for rows in by_type.values():
        rows.sort()
    return by_type


def _rate_at(rows, when):
    """(start of the price period, on-demand cents per GPU-hour) in force at when."""
    found = None
    for since, cents in rows:
        if since <= when:
            found = (since, cents)
    return found


def monthly_invoice_lines(runs, prices, reservations):
    rows_by_type = _price_rows(prices)
    usage = {}                    # line key -> {price period start: [gpu_seconds, cents_per_hour]}
    for run in runs:
        start, end = _parse(run["start"]), _parse(run["end"])
        rows = rows_by_type[run["gpu_type"]]
        cuts = [since for since, _ in rows if start < since < end]      # price amendments
        m = _next_month(start)
        while m < end:                                                  # month boundaries
            cuts.append(m)
            m = _next_month(m)
        cuts.sort()
        a = start
        for b in cuts + [end]:
            seconds = (b - a).seconds * run["gpus"]
            month = start.strftime("%Y-%m")
            since, rate = _rate_at(rows, start)
            key = run["customer"] + "|" + month + "|" + run["gpu_type"]
            cell = usage.setdefault(key, {}).setdefault(since, [0, rate])
            cell[0] += seconds
            a = b

    lines = {}
    left = {}                     # reservation key -> reserved GPU-seconds not yet used
    for key in sorted(usage):
        customer, month, gpu_type = key.split("|")
        rkey = customer + "|" + gpu_type
        res = reservations.get(rkey, {"hours": 0, "cents_per_hour": 0})
        remaining = left.setdefault(rkey, res["hours"] * 3600)
        line = {"gpu_seconds": 0, "reserved_seconds": 0, "on_demand_seconds": 0, "amount_cents": 0}
        for since in sorted(usage[key]):                                # earliest price period first
            seconds, rate = usage[key][since]
            covered = min(seconds, remaining)
            remaining -= covered
            line["gpu_seconds"] += seconds
            line["reserved_seconds"] += covered
            line["on_demand_seconds"] += seconds - covered
            line["amount_cents"] += (round(covered * res["cents_per_hour"] / 3600)
                                     + round((seconds - covered) * rate / 3600))
        left[rkey] = remaining
        if line["gpu_seconds"]:
            lines[key] = line
    return lines
`;

export const prelude = `
from datetime import datetime as _dt, timezone as _tz


def _iso(t):
    return _dt.fromtimestamp(t, _tz.utc).isoformat()


def _gen_runs(n, seed, amend=False):
    x = seed

    def nxt():
        nonlocal x
        x = (1103515245 * x + 12345) % 2147483648
        return x >> 8
    base = 1767225600                       # 2026-01-01 00:00 UTC
    types = ['H100', 'H200', 'A100', 'L40S']
    prices = []
    for i, g in enumerate(types):
        prices.append({'gpu_type': g, 'from': _iso(base - 86400 * 30), 'cents_per_hour': 150 + 97 * i})
        if amend:
            for k in range(1, 6):
                prices.append({'gpu_type': g, 'from': _iso(base + k * 2592000 + nxt() % 1296000),
                               'cents_per_hour': 150 + 97 * i + nxt() % 120})
    customers = ['cust-%03d' % c for c in range(300)]
    reservations = {}
    for c in customers:
        for g in types:
            if nxt() % 3 == 0:
                reservations[c + '|' + g] = {'hours': 8 * (1 + nxt() % 400), 'cents_per_hour': 100 + nxt() % 150}
    runs = []
    for _ in range(n):
        start = base + nxt() % (180 * 86400)
        length = 60 + nxt() % (5 * 86400) if nxt() % 4 == 0 else 60 + nxt() % 7200
        runs.append({'customer': customers[nxt() % 300], 'gpu_type': types[nxt() % 4],
                     'gpus': 1 << (nxt() % 4), 'start': _iso(start), 'end': _iso(start + length)})
    return runs, prices, reservations
`.trim() + "\n";

const iso = (sec) => new Date(sec * 1000).toISOString().replace(".000Z", "+00:00");
const sec = (s) => Date.parse(s) / 1000;
const nextMonth = (t) => {
  const d = new Date(t * 1000);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1) / 1000;
};
const monthOf = (t) => new Date(t * 1000).toISOString().slice(0, 7);

// The specification, implemented independently of the Python reference.
export function oracle(runs, prices, reservations) {
  const rows = {};
  for (const p of prices) (rows[p.gpu_type] ??= []).push([sec(p.from), p.cents_per_hour]);
  for (const list of Object.values(rows)) list.sort((x, y) => x[0] - y[0]);
  const periodAt = (list, t) => { let k = -1; for (let i = 0; i < list.length; i++) if (list[i][0] <= t) k = i; return k; };
  const usage = new Map();                         // key -> Map(period index -> seconds)
  for (const run of runs) {
    const list = rows[run.gpu_type];
    const s = sec(run.start), e = sec(run.end);
    const points = new Set([s, e]);
    for (const [from] of list) if (from > s && from < e) points.add(from);
    for (let m = nextMonth(s); m < e; m = nextMonth(m)) points.add(m);
    const pts = [...points].sort((x, y) => x - y);
    for (let i = 0; i + 1 < pts.length; i++) {
      const a = pts[i], b = pts[i + 1];
      const key = `${run.customer}|${monthOf(a)}|${run.gpu_type}`;
      if (!usage.has(key)) usage.set(key, new Map());
      const cells = usage.get(key);
      const k = periodAt(list, a);
      cells.set(k, (cells.get(k) || 0) + (b - a) * run.gpus);
    }
  }
  const out = {};
  for (const [key, cells] of usage) {
    const [customer, , gpuType] = key.split("|");
    const res = reservations[`${customer}|${gpuType}`] || { hours: 0, cents_per_hour: 0 };
    let left = res.hours * 3600;                   // reset every month
    let total = 0, reserved = 0, numer = 0;
    for (const k of [...cells.keys()].sort((x, y) => x - y)) {
      const s = cells.get(k);
      const cover = Math.min(s, left);
      left -= cover;
      total += s;
      reserved += cover;
      numer += cover * res.cents_per_hour + (s - cover) * rows[gpuType][k][1];
    }
    if (total > 0) out[key] = { gpu_seconds: total, reserved_seconds: reserved, on_demand_seconds: total - reserved, amount_cents: Math.floor((numer + 1800) / 3600) };
  }
  return Object.fromEntries(Object.entries(out).sort(([a], [b]) => (a < b ? -1 : 1)));
}

function py(v) {
  if (v === null || v === undefined) return "None";
  if (typeof v === "number") return String(v);
  if (typeof v === "string") return "'" + v + "'";
  if (Array.isArray(v)) return "[" + v.map(py).join(", ") + "]";
  return "{" + Object.entries(v).map(([k, x]) => `'${k}': ${py(x)}`).join(", ") + "}";
}
const pyArgs = (c) => `(${py(c.runs)}, ${py(c.prices)}, ${py(c.reservations)})`;
const run = (c) => oracle(c.runs, c.prices, c.reservations);

const TYPES = ["H100", "H200", "B200", "A100", "L40S"];

function streamCase(r, level) {
  const year = 2026, mon = r.int(0, 10);
  const m0 = Date.UTC(year, mon, 1) / 1000, m1 = Date.UTC(year, mon + 1, 1) / 1000;
  const types = r.sample(TYPES, 2);
  const prices = [];
  for (const g of types) {
    prices.push({ gpu_type: g, from: iso(m0 - 86400 * 40), cents_per_hour: 10 * r.int(15, 60) + r.pick([0, 5, 7]) });
    if (level === 3) prices.push({ gpu_type: g, from: iso(m0 + 86400 * r.int(8, 20) + 3600 * r.int(0, 23)), cents_per_hour: 10 * r.int(15, 60) + r.pick([0, 3]) });
  }
  const customers = r.sample(["cust-ahi", "cust-bex", "cust-cor", "cust-dun", "cust-eld"], 2);
  const reservations = {};
  for (const c of customers) for (const g of types) if (r.chance(0.5)) reservations[`${c}|${g}`] = { hours: r.int(2, 30), cents_per_hour: 10 * r.int(8, 14) + r.pick([0, 5]) };
  const runs = [];
  for (let i = 0; i < r.int(4, 7); i++) {
    let s, len;
    if (level >= 2 && r.chance(0.3)) { s = m1 - 3600 * r.int(1, 30); len = 3600 * r.int(2, 40) + 60 * r.int(0, 59); }  // across the month end
    else if (level >= 2 && r.chance(0.3)) { s = m0 + 86400 * r.int(0, 20); len = 86400 * r.int(1, 3) + 60 * r.int(1, 600); }
    else { s = m0 + 86400 * r.int(0, 26) + 60 * r.int(0, 1400); len = 60 * r.int(1, 600) + r.int(0, 59); }
    runs.push({ customer: r.pick(customers), gpu_type: r.pick(types), gpus: r.pick([1, 2, 4, 8]), start: iso(s), end: iso(s + len) });
  }
  return { runs, prices, reservations };
}

export function generate(r, level) {
  const samples = [];
  for (let i = 0; i < 2; i++) {
    const c = streamCase(r, level);
    samples.push({ args: pyArgs(c), expect: py(run(c)) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const mon = r.int(0, 11);                                 // any month, December included
  const m0 = Date.UTC(2026, mon, 1) / 1000, m1 = Date.UTC(2026, mon + 1, 1) / 1000;
  const G = r.pick(TYPES), G2 = TYPES.find((t) => t !== G);
  const cust = r.pick(["cust-fen", "cust-gal", "cust-hob"]);
  const od = 10 * r.int(20, 60);                            // on-demand cents per GPU-hour
  const rr = 10 * r.int(8, 15);                             // reserved cents per GPU-hour
  const H = 3600, D = 86400;
  const base = [{ gpu_type: G, from: iso(m0 - 40 * D), cents_per_hour: od }, { gpu_type: G2, from: iso(m0 - 40 * D), cents_per_hour: od + 50 }];
  const amendAt = m0 + D * r.int(10, 18);
  const od2 = od + 10 * r.int(3, 12);
  const amended = [...base, { gpu_type: G, from: iso(amendAt), cents_per_hour: od2 }];
  const R = (start, len, gpus = 1, g = G) => ({ customer: cust, gpu_type: g, gpus, start: iso(start), end: iso(start + len) });
  const edges = [
    ["a run longer than a day is metered for every second",
      { runs: [R(m0 + 2 * D, 2 * D + 3 * H, 8)], prices: base, reservations: {} }],
    ["reserved hours start again every month",
      { runs: [R(m0 + 3 * D, 8 * H, 1), R(m1 + 3 * D, 8 * H, 1)], prices: base, reservations: { [`${cust}|${G}`]: { hours: 10, cents_per_hour: rr } } }],
    ["a run across a price amendment is priced on each side of it",
      { runs: [R(amendAt - 2 * H, 5 * H, 2)], prices: amended, reservations: {} }],
    ["a run across the end of the month is split between the two months",
      { runs: [R(m1 - 2 * H, 4 * H, 4)], prices: base, reservations: {} }],
    ["exactly half a cent rounds up",
      { runs: [R(m0 + 5 * D, 36, 1)], prices: [{ gpu_type: G, from: iso(m0 - 40 * D), cents_per_hour: 250 }], reservations: {} }],
    ["a line is rounded once, not once per price period",
      { runs: [R(amendAt - 3 * D, 6, 1), R(amendAt + 2 * D, 4, 1)], prices: [{ gpu_type: G, from: iso(m0 - 40 * D), cents_per_hour: 240 }, { gpu_type: G, from: iso(amendAt), cents_per_hour: 360 }], reservations: {} }],
    ["reserved hours cover the earliest price period first",
      { runs: [R(amendAt - 3 * D, 6 * H, 1), R(amendAt + 2 * D, 6 * H, 1)], prices: amended, reservations: { [`${cust}|${G}`]: { hours: 8, cents_per_hour: rr } } }],
    ["each GPU type has its own reservation, and no reservation means on-demand",
      { runs: [R(m0 + 4 * D, 5 * H, 2), R(m0 + 4 * D, 5 * H, 2, G2)], prices: base, reservations: { [`${cust}|${G}`]: { hours: 6, cents_per_hour: rr } } }],
    ["a run that starts and ends at the same moment bills nothing",
      { runs: [R(m0 + 6 * D, 0, 4), R(m0 + 6 * D, 2 * H, 1)], prices: base, reservations: {} }],
  ];
  for (const [name, c] of edges) tests.push({ name, args: pyArgs(c), expect: py(run(c)) });

  const n = level === 1 ? 50000 : 100000;
  tests.push({ name: `${n.toLocaleString("en-US")} instance runs over six months in time`, args: `_gen_runs(${n}, ${r.int(1, 1_000_000)}, ${level === 3 ? "True" : "False"})`, limit_s: 8 });

  return {
    vars: {
      replay_rule: level === 1
        ? "This replay covers one month with no price amendments and runs shorter than a day; the checks also include long runs, month ends and amendments."
        : level === 2
          ? "This replay covers runs of several days and runs across a month end; the checks also include a price amendment in the middle of a month."
          : "This replay covers runs of several days, runs across a month end and on-demand price amendments in the middle of a month.",
    },
    samples,
    tests,
  };
}
