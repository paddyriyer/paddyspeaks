/* PYP-L2-03 — Debug the multi-currency wallet statement (debug, Python).
   Simulated practice scenario. All data is generated from the seed.

   Contract (debug): like python, but `starter` is buggy code the candidate fixes.
   The evaluator's reference is the fixed code. expect comes from oracle() below,
   an independent JavaScript implementation of the specification in the template.
   Planted bugs (see the evaluator notes): every currency is assumed to have two
   decimal places; the conversion is rounded twice, once in US cents and again in
   the home currency; reversed payments and their reversals are both counted; the
   statement month relabels UTC times instead of converting them to the user's
   offset; every funding attempt is counted, not only the one that was used.
   level: 1 Medium (home USD, two-decimal currencies, a user at UTC)
          · 2 Hard (+ other home currencies, yen, a user away from UTC, reversals)
          · 3 Very Hard (+ three-decimal dinars and funding fallbacks) */
export const kind = "debug";
export const entry = "monthly_statement";
export const signature = "def monthly_statement(entries: list[dict], month: str, offset_minutes: int, home: str, currencies: dict[str, int], rates: dict[str, tuple[int, int]]) -> dict:";
export const starter = `from datetime import datetime, timedelta, timezone


def _round_half_up(n, d):
    return (2 * n + d) // (2 * d)


def _to_home(amount, code, home, currencies, rates):
    """Minor units of code -> minor units of home. rates[code] = (num, den):
    one major unit of code is worth num / den US dollars."""
    num, den = rates[code]
    usd_cents = _round_half_up(amount * num * 100, den * 10 ** 2)
    hnum, hden = rates[home]
    return _round_half_up(usd_cents * hden * 10 ** currencies[home], hnum * 100)


def _local_month(ts, offset_minutes):
    when = datetime.fromisoformat(ts).replace(tzinfo=timezone(timedelta(minutes=offset_minutes)))
    return when.strftime("%Y-%m")


def monthly_statement(entries, month, offset_minutes, home, currencies, rates):
    out = {"sent": 0, "received": 0, "net": 0, "from_balance": 0, "from_linked": 0, "reversed": 0}
    for e in entries:
        if _local_month(e["ts"], offset_minutes) != month:
            continue
        amount = _to_home(e["amount"], e["currency"], home, currencies, rates)
        if e["kind"] == "sent":
            out["sent"] += amount
            for source, outcome in e["funding"]:
                if source == "balance":
                    out["from_balance"] += amount
                else:
                    out["from_linked"] += amount
        else:
            out["received"] += amount
    out["net"] = out["received"] - out["sent"]
    return out
`;

export const prelude = `
from datetime import datetime as _dt, timezone as _tz


def _gen_wallet(n, seed):
    x = seed

    def nxt():
        nonlocal x
        x = (1103515245 * x + 12345) % 2147483648
        return x >> 8
    currencies = {'USD': 2, 'EUR': 2, 'GBP': 2, 'JPY': 0, 'KWD': 3}
    rates = {'USD': (1, 1), 'EUR': (109, 100), 'GBP': (127, 100), 'JPY': (67, 10000), 'KWD': (326, 100)}
    codes = sorted(currencies)
    base = 1790812800                     # 2026-10-01 00:00 UTC
    entries, sent = [], []
    for i in range(n):
        t = base - 2 * 86400 + nxt() % (35 * 86400)
        code = codes[nxt() % 5]
        amount = 1 + nxt() % (50000 if currencies[code] else 2000000)
        roll = nxt() % 100
        e = {'id': 'p%d' % i, 'ts': _dt.fromtimestamp(t, _tz.utc).isoformat(), 'currency': code,
             'amount': amount, 'reverses': None, 'funding': None}
        if roll < 8 and sent:
            e['kind'] = 'reversal'
            e['reverses'] = sent.pop(nxt() % len(sent))
        elif roll < 55:
            e['kind'] = 'sent'
            e['funding'] = [('balance', 'declined'), ('card', 'used')] if roll % 3 == 0 else [(('balance', 'bank', 'card')[roll % 3], 'used')]
            sent.append(e['id'])
        else:
            e['kind'] = 'received'
            sent.append(e['id'])
        entries.append(e)
    return entries, '2026-10', -300, 'EUR', currencies, rates
`.trim() + "\n";

// Exact conversion: amount x num_c x den_h x 10^e_h / (den_c x num_h x 10^e_c), half up, once.
function toHome(amount, code, home, currencies, rates) {
  const [nc, dc] = rates[code], [nh, dh] = rates[home];
  const top = BigInt(amount) * BigInt(nc) * BigInt(dh) * 10n ** BigInt(currencies[home]);
  const bottom = BigInt(dc) * BigInt(nh) * 10n ** BigInt(currencies[code]);
  const q = top / bottom;
  return Number(2n * (top - q * bottom) >= bottom ? q + 1n : q);
}
const localMonth = (ts, off) => new Date(Date.parse(ts) + off * 60000).toISOString().slice(0, 7);

// The specification, implemented independently of the Python reference.
export function oracle(entries, month, offset, home, currencies, rates) {
  const reversedIds = new Set(entries.filter((e) => e.kind === "reversal").map((e) => e.reverses));
  const out = { sent: 0, received: 0, net: 0, from_balance: 0, from_linked: 0, reversed: 0 };
  for (const e of entries) {
    if (e.kind === "reversal" || localMonth(e.ts, offset) !== month) continue;
    if (reversedIds.has(e.id)) { out.reversed += 1; continue; }
    const v = toHome(e.amount, e.currency, home, currencies, rates);
    if (e.kind === "received") out.received += v;
    else {
      out.sent += v;
      const used = e.funding.find(([, outcome]) => outcome === "used")[0];
      if (used === "balance") out.from_balance += v; else out.from_linked += v;
    }
  }
  out.net = out.received - out.sent;
  return out;
}

function py(v) {
  if (v === null || v === undefined) return "None";
  if (typeof v === "number") return String(v);
  if (typeof v === "string") return "'" + v + "'";
  if (Array.isArray(v)) return v.tuple ? "(" + v.map(py).join(", ") + ")" : "[" + v.map(py).join(", ") + "]";
  return "{" + Object.entries(v).map(([k, x]) => `'${k}': ${py(x)}`).join(", ") + "}";
}
const tup = (...xs) => Object.assign(xs, { tuple: true });
const pyArgs = (c) => `(${py(c.entries)}, '${c.month}', ${c.offset}, '${c.home}', ${py(c.currencies)}, ` +
  "{" + Object.entries(c.rates).map(([k, [n, d]]) => `'${k}': (${n}, ${d})`).join(", ") + "})";
const run = (c) => oracle(c.entries, c.month, c.offset, c.home, c.currencies, c.rates);

const iso = (sec) => new Date(sec * 1000).toISOString().replace(".000Z", "+00:00");
const MONTHS = [["2026-09", Date.UTC(2026, 8, 1) / 1000, Date.UTC(2026, 9, 1) / 1000],
  ["2026-10", Date.UTC(2026, 9, 1) / 1000, Date.UTC(2026, 10, 1) / 1000],
  ["2026-11", Date.UTC(2026, 10, 1) / 1000, Date.UTC(2026, 11, 1) / 1000]];
const EXP = { USD: 2, EUR: 2, GBP: 2, CAD: 2, JPY: 0, KWD: 3, BHD: 3 };

function rateTable(r) {
  return {
    USD: [1, 1], EUR: [r.int(104, 118), 100], GBP: [r.int(121, 136), 100], CAD: [r.int(70, 76), 100],
    JPY: [r.int(61, 73), 10000], KWD: [r.int(320, 332), 100], BHD: [r.int(262, 268), 100],
  };
}

function streamCase(r, level, rates) {
  const home = level === 1 ? "USD" : r.pick(["USD", "EUR", "GBP"]);
  const codes = level === 1 ? ["USD", "EUR", "CAD"] : level === 2 ? ["USD", "EUR", "GBP", "JPY"] : ["USD", "EUR", "GBP", "JPY", "KWD"];
  const currencies = Object.fromEntries([...new Set([home, ...codes])].map((c) => [c, EXP[c]]));
  const offset = level === 1 ? 0 : r.pick([-480, -300, 60, 330, 600]);
  const [month, start, end] = MONTHS[1];
  const entries = [];
  const n = r.int(5, 8);
  for (let i = 0; i < n; i++) {
    // Times cluster near the month's edges so the local month often differs from the UTC one.
    const edge = r.chance(0.5) ? start : end;
    const t = r.chance(0.6) ? edge + r.pick([-1, 1]) * 60 * r.int(10, 600) : start + r.int(2, 27) * 86400 + r.int(0, 86399);
    const code = r.pick(codes);
    const amount = EXP[code] === 0 ? r.int(300, 40000) : EXP[code] === 3 ? r.int(1000, 90000) : r.int(250, 60000);
    const kind = r.chance(0.55) ? "sent" : "received";
    const funding = kind !== "sent" ? null
      : level === 3 && r.chance(0.5) ? [tup("balance", "declined"), tup(r.pick(["bank", "card"]), "used")]
        : [tup(r.pick(["balance", "bank", "card"]), "used")];
    entries.push({ id: `pay-${r.int(100, 999)}${i}`, ts: iso(t), kind, currency: code, amount, reverses: null, funding });
  }
  if (level >= 2) {
    for (const e of r.sample(entries, r.int(0, 2))) {
      entries.push({ id: `rev-${e.id.slice(4)}`, ts: iso(Date.parse(e.ts) / 1000 + 60 * r.int(5, 4000)), kind: "reversal",
        currency: e.currency, amount: e.amount, reverses: e.id, funding: null });
    }
  }
  return { entries, month, offset, home, currencies, rates };
}

// Find an amount of `code` where rounding through US cents and rounding once disagree.
function doubleRoundAmount(r, code, home, currencies, rates) {
  const [nc, dc] = rates[code], [nh, dh] = rates[home];
  const ec = currencies[code], eh = currencies[home];
  const start = r.int(1000, 50000);
  for (let a = start; a < start + 20000; a++) {
    const usd = Math.floor((2 * a * nc * 100 + dc * 10 ** ec) / (2 * dc * 10 ** ec));   // the buggy first step, for the search only
    const twice = Math.floor((2 * usd * dh * 10 ** eh + nh * 100) / (2 * nh * 100));
    if (twice !== toHome(a, code, home, currencies, rates)) return a;
  }
  return start;
}

export function generate(r, level) {
  const rates = rateTable(r);
  const samples = [];
  for (let i = 0; i < 2; i++) {
    const c = streamCase(r, level, rates);
    samples.push({ args: pyArgs(c), expect: py(run(c)) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const [month, start, end] = MONTHS[1];
  const mid = start + 86400 * r.int(8, 20) + 3600 * r.int(9, 17);
  const usdOnly = { USD: 2 };
  const all = { USD: 2, EUR: 2, GBP: 2, JPY: 0, KWD: 3 };
  const a1 = 100 * r.int(10, 400) + r.int(0, 99), a2 = 100 * r.int(10, 400) + r.int(0, 99);
  const sent = (id, t, amount, extra = {}) => ({ id, ts: iso(t), kind: "sent", currency: "USD", amount, reverses: null, funding: [tup("balance", "used")], ...extra });
  const recv = (id, t, amount, extra = {}) => ({ id, ts: iso(t), kind: "received", currency: "USD", amount, reverses: null, funding: null, ...extra });
  const rev = (id, t, of) => ({ id, ts: iso(t), kind: "reversal", currency: of.currency, amount: of.amount, reverses: of.id, funding: null });
  const mk = (entries, offset = 0, home = "USD", currencies = usdOnly) => ({ entries, month, offset, home, currencies, rates });
  const west = r.pick([-480, -420, -300]), east = r.pick([330, 540, 600]);
  const p1 = sent("p1", mid, a1), p2 = recv("p2", mid + 3600, a2);
  const dr = doubleRoundAmount(r, "EUR", "GBP", all, rates);
  const edges = [
    ["one month, US dollars, one sent and one received",
      mk([p1, p2])],
    ["early on the 1st in UTC is still last month for a user west of UTC",
      mk([sent("p1", start + 3600 * 2, a1, { funding: [tup("bank", "used")] }), recv("p2", mid, a2)], west)],
    ["late on the last day in UTC is already next month for a user east of UTC",
      mk([recv("p1", end - 3600 * 2, a1), recv("p2", mid, a2)], east)],
    ["a payment funded by a card after the balance was declined counts once, as linked",
      mk([sent("p1", mid, a1, { funding: [tup("balance", "declined"), tup("card", "used")] }), sent("p2", mid + 60, a2)])],
    ["a reversed payment and its reversal count in neither total",
      mk([p1, p2, rev("r1", mid + 7200, p1)])],
    ["a payment reversed next month is still excluded, and counted as reversed",
      mk([p1, recv("p3", mid + 60, a2), rev("r3", end + 86400 * 3, recv("p3", mid + 60, a2))])],
    ["a yen payment is converted with zero decimal places",
      mk([recv("p1", mid, 1000 * r.int(2, 90) + r.int(1, 999), { currency: "JPY" })], 0, "USD", all)],
    ["a dinar payment is converted with three decimal places",
      mk([recv("p1", mid, 1000 * r.int(2, 90) + r.int(1, 999), { currency: "KWD" })], 0, "USD", all)],
    ["euros into pounds are converted at one cross rate and rounded once",
      mk([recv("p1", mid, dr, { currency: "EUR" })], 0, "GBP", all)],
    ["an entry from another month is left out",
      mk([p1, recv("p2", start - 86400 * 5, a2)])],
  ];
  for (const [name, c] of edges) tests.push({ name, args: pyArgs(c), expect: py(run(c)) });

  const n = level === 1 ? 50000 : 100000;
  tests.push({ name: `${n.toLocaleString("en-US")} wallet entries in five currencies in time`, args: `_gen_wallet(${n}, ${r.int(1, 1_000_000)})`, limit_s: 8 });

  return {
    vars: {
      replay_rule: level === 1
        ? "This replay covers a user at UTC whose home currency is US dollars, with payments in currencies of two decimal places; the checks also cover other offsets, yen, dinars, reversals and funding fallbacks."
        : level === 2
          ? "This replay covers a user away from UTC, several home currencies, yen and reversals; the checks also cover dinars and funding fallbacks."
          : "This replay covers a user away from UTC, several home currencies, yen and dinars, reversals in the same and the next month, and payments funded by a card or bank after the balance was declined.",
    },
    samples,
    tests,
  };
}
