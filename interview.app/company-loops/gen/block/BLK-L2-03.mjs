/* BLK-L2-03 — Debug the seller's daily sales summary (debug, Python).
   Simulated practice scenario. All data is generated from the seed.

   Contract (debug): like python, but `starter` is buggy code the candidate fixes.
   The evaluator's reference is the fixed code. expect comes from oracle() below,
   an independent JavaScript implementation of the specification in the template.
   Planted bugs (see the evaluator notes): the location's UTC offset is applied with
   the wrong sign; an offline payment is dated by when it was forwarded, not when it
   was taken; tips are added into gross sales; a refund is booked on the sale's day,
   not on the day it was made; a refund subtracts the whole payment, not the
   refunded amount.
   level: 1 Medium (one location, online payments, whole refunds) · 2 Hard (+ several
          time zones, partial refunds on later days) · 3 Very Hard (+ offline
          payments forwarded hours later, some declined) */
export const kind = "debug";
export const entry = "daily_summary";
export const signature = "def daily_summary(payments: list[dict], refunds: list[dict], locations: dict[str, int]) -> dict:";
export const starter = `from datetime import datetime, timedelta


def _local_day(ts, offset_minutes):
    """An ISO timestamp in UTC -> the location's local calendar date, 'YYYY-MM-DD'."""
    return (datetime.fromisoformat(ts) - timedelta(minutes=offset_minutes)).date().isoformat()


def daily_summary(payments, refunds, locations):
    days = {}

    def row(location, day):
        return days.setdefault(location + "/" + day,
                               {"payments": 0, "gross": 0, "tips": 0, "refunds": 0, "net": 0})

    sales = {}                                   # payment id -> (payment, local sale day)
    for p in payments:
        if p["status"] != "completed":
            continue
        when = p["forwarded_at"] or p["taken_at"]
        day = _local_day(when, locations[p["location"]])
        r = row(p["location"], day)
        r["payments"] += 1
        r["gross"] += p["amount"] + p["tip"]
        r["tips"] += p["tip"]
        sales[p["id"]] = (p, day)
    for f in refunds:
        if f["payment"] not in sales:
            continue
        p, sale_day = sales[f["payment"]]
        r = row(p["location"], sale_day)
        r["refunds"] += p["amount"]
    for r in days.values():
        r["net"] = r["gross"] - r["refunds"]
    return days
`;

export const prelude = `
from datetime import datetime as _dt, timezone as _tz


def _iso(t):
    return _dt.fromtimestamp(t, _tz.utc).isoformat()


def _gen_sales(n, seed):
    x = seed
    locs = {'loc-%02d' % i: (-480, -420, -300, -240, 0, 60, 330, 540, 600, 780)[i] for i in range(10)}
    names = sorted(locs)
    payments, refunds = [], []
    base = 1791158400                      # 2026-10-05 00:00 UTC
    for i in range(n):
        x = (1103515245 * x + 12345) % 2147483648
        t = base + (x >> 4) % (14 * 86400)
        x = (1103515245 * x + 12345) % 2147483648
        offline = (x >> 16) % 10 == 0
        fwd = t + 60 * (1 + (x >> 4) % 900) if offline else None
        x = (1103515245 * x + 12345) % 2147483648
        amount = 100 + (x >> 4) % 25000
        tip = 0 if (x >> 16) % 3 else (x >> 8) % 1500
        pid = 'p%d' % i
        status = 'declined' if offline and (x >> 20) % 7 == 0 else 'completed'
        payments.append({'id': pid, 'location': names[i % 10],
                         'taken_at': _iso(t), 'forwarded_at': _iso(fwd) if fwd else None,
                         'amount': amount, 'tip': tip, 'status': status})
        x = (1103515245 * x + 12345) % 2147483648
        if status == 'completed' and (x >> 16) % 10 < 3:
            part = amount if (x >> 8) % 2 else 1 + (x >> 4) % amount
            refunds.append({'payment': pid, 'refunded_at': _iso(t + 60 + (x >> 4) % 200000), 'amount': part})
    return payments, refunds, locs
`.trim() + "\n";

const localDay = (ts, off) => new Date(Date.parse(ts) + off * 60000).toISOString().slice(0, 10);

// The specification, implemented independently of the Python reference.
export function oracle(payments, refunds, locations) {
  const out = {};
  const at = (loc, day) => (out[loc + "/" + day] ??= { payments: 0, gross: 0, tips: 0, refunds: 0, net: 0 });
  const done = new Map();
  for (const p of payments) {
    if (p.status !== "completed") continue;
    const row = at(p.location, localDay(p.taken_at, locations[p.location]));   // the day it was taken
    row.payments += 1;
    row.gross += p.amount;                       // tips are not sales
    row.tips += p.tip;
    done.set(p.id, p);
  }
  for (const f of refunds) {
    const p = done.get(f.payment);
    if (!p) continue;
    at(p.location, localDay(f.refunded_at, locations[p.location])).refunds += f.amount;   // the day it was made
  }
  for (const row of Object.values(out)) row.net = row.gross - row.refunds;
  return out;
}

function py(v) {
  if (v === null || v === undefined) return "None";
  if (typeof v === "number") return String(v);
  if (typeof v === "string") return "'" + v + "'";
  if (Array.isArray(v)) return "[" + v.map(py).join(", ") + "]";
  return "{" + Object.entries(v).map(([k, x]) => `'${k}': ${py(x)}`).join(", ") + "}";
}
const pyArgs = (p, f, l) => `(${py(p)}, ${py(f)}, ${py(l)})`;

const BASE = Date.UTC(2026, 9, 5) / 1000;            // Monday 2026-10-05 00:00 UTC
const iso = (sec) => new Date(sec * 1000).toISOString().replace(".000Z", "+00:00");
const LOCS = [["loc-portland", -420], ["loc-chicago", -300], ["loc-toronto", -240], ["loc-london", 60],
  ["loc-delhi", 330], ["loc-tokyo", 540], ["loc-sydney", 600], ["loc-auckland", 780]];

function streamCase(r, level) {
  const locs = level === 1 ? [r.pick(LOCS)] : r.sample(LOCS, r.int(2, 3));
  const locations = Object.fromEntries(locs);
  const payments = [], refunds = [];
  const n = level === 1 ? r.int(4, 6) : r.int(6, 9);
  for (let i = 0; i < n; i++) {
    const [loc] = r.pick(locs);
    // Times cluster around UTC midnight so local and UTC dates often differ.
    const t = BASE + 86400 * r.int(0, 1) + r.pick([-1, 1]) * 60 * r.int(5, 600) + 86400;
    const offline = level === 3 && r.chance(0.35);
    const amount = 100 * r.int(3, 180) + r.pick([0, 25, 50, 99]);
    payments.push({
      id: `pay-${r.int(100, 999)}${i}`, location: loc, taken_at: iso(t),
      forwarded_at: offline ? iso(t + 60 * r.int(30, 900)) : null,
      amount, tip: r.chance(0.4) ? 25 * r.int(1, 40) : 0,
      status: offline && r.chance(0.25) ? "declined" : "completed",
    });
  }
  for (const p of payments) {
    if (p.status !== "completed" || !r.chance(0.35)) continue;
    const t0 = Date.parse(p.taken_at) / 1000;
    const whole = level === 1 || r.chance(0.4);
    const later = level === 1 ? 60 * r.int(5, 120) : 60 * r.int(5, 2880);
    refunds.push({ payment: p.id, refunded_at: iso(t0 + later), amount: whole ? p.amount : 100 * r.int(1, Math.max(1, Math.floor(p.amount / 200))) });
  }
  return { payments, refunds: r.shuffle(refunds), locations };
}

export function generate(r, level) {
  const samples = [];
  for (let i = 0; i < 2; i++) {
    const c = streamCase(r, level);
    samples.push({ args: pyArgs(c.payments, c.refunds, c.locations), expect: py(oracle(c.payments, c.refunds, c.locations)) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const pay = (id, loc, t, amount, extra = {}) => ({ id, location: loc, taken_at: iso(t), forwarded_at: null, amount, tip: 0, status: "completed", ...extra });
  const [W, offW] = r.pick(LOCS.slice(0, 3));               // west of UTC
  const [E, offE] = r.pick(LOCS.slice(5));                  // east of UTC
  const U = "loc-utc";
  const amt = 100 * r.int(10, 90), amt2 = 100 * r.int(10, 90);
  const day2 = BASE + 86400;
  const edges = [
    ["an evening sale west of UTC counts on the local date",
      [pay("p1", W, day2 + 3600 * 2, amt)], [], { [W]: offW }],
    ["an early-morning sale east of UTC counts on the local date",
      [pay("p1", E, day2 - 3600 * 3, amt)], [], { [E]: offE }],
    ["an offline payment counts on the day it was taken, not the day it was forwarded",
      [pay("p1", U, day2 - 3600 * 4, amt, { forwarded_at: iso(day2 + 3600 * 9) })], [], { [U]: 0 }],
    ["an offline payment declined when forwarded is not a sale",
      [pay("p1", U, day2 + 3600, amt, { forwarded_at: iso(day2 + 7200), status: "declined" }), pay("p2", U, day2 + 7200, amt2)], [], { [U]: 0 }],
    ["a tip is reported on its own, never inside gross sales",
      [pay("p1", U, day2 + 3600 * 12, amt, { tip: 450 })], [], { [U]: 0 }],
    ["a whole refund made two days later counts on the day it was made",
      [pay("p1", U, day2 + 3600 * 10, amt)], [{ payment: "p1", refunded_at: iso(day2 + 86400 * 2 + 3600), amount: amt }], { [U]: 0 }],
    ["a partial refund on the same day subtracts only the refunded amount",
      [pay("p1", U, day2 + 3600 * 10, amt)], [{ payment: "p1", refunded_at: iso(day2 + 3600 * 11), amount: 250 }], { [U]: 0 }],
    ["two partial refunds of one payment on the same day",
      [pay("p1", U, day2 + 3600 * 10, amt), pay("p2", U, day2 + 3600 * 11, amt2)],
      [{ payment: "p1", refunded_at: iso(day2 + 3600 * 12), amount: 100 }, { payment: "p1", refunded_at: iso(day2 + 3600 * 13), amount: 300 }], { [U]: 0 }],
  ];
  for (const [name, p, f, l] of edges) tests.push({ name, args: pyArgs(p, f, l), expect: py(oracle(p, f, l)) });

  const n = level === 1 ? 100000 : 200000;
  tests.push({ name: `${n.toLocaleString("en-US")} payments across ten locations in time`, args: `_gen_sales(${n}, ${r.int(1, 1_000_000)})`, limit_s: 8 });

  return {
    vars: {
      replay_rule: level === 1
        ? "This replay covers one location, online payments and whole refunds; the checks also include other time zones, partial refunds and offline payments."
        : level === 2
          ? "This replay covers locations in several time zones, with partial refunds made up to two days after the sale; the checks also include offline payments."
          : "This replay covers locations in several time zones, partial refunds on later days, and offline payments forwarded up to fifteen hours after they were taken, some of them declined.",
    },
    samples,
    tests,
  };
}
