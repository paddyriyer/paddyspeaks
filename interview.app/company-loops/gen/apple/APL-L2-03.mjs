/* APL-L2-03 — Debug the developer proceeds report (debug, Python).
   Simulated practice scenario. All data is generated from the seed.

   Contract (debug): like python, but `starter` is buggy code the candidate fixes.
   The evaluator's reference is the fixed code. expect comes from oracle() below,
   an independent JavaScript implementation of the specification in the template.
   Planted bugs (see the evaluator notes): tax is removed from a tax-inclusive price
   as if it were added on top; the reduced rate starts a day late (> 365 days);
   Python's round() rounds half-unit commissions to even; a refund recomputes the
   commission on its own date instead of reversing the sale; rows are keyed by
   storefront, so storefronts that share a currency are split.
   level: 1 Medium (no tax, no refunds, first-year sales) · 2 Hard (+ tax-inclusive
          prices and refunds) · 3 Very Hard (+ renewals past the first paid year,
          storefronts sharing a currency, refunds across the anniversary) */
export const kind = "debug";
export const entry = "proceeds_report";
export const signature = "def proceeds_report(transactions: list[dict]) -> list[list]:";
export const starter = `from datetime import date


def _days_between(a, b):
    return (date.fromisoformat(b) - date.fromisoformat(a)).days


def proceeds_report(transactions):
    first_sale = {}     # (subscriber, product) -> date of the earliest sale
    sales = {}          # txn -> what a refund needs
    rows = {}
    for t in transactions:
        if t["type"] == "sale":
            key = (t["subscriber"], t["product"])
            first_sale.setdefault(key, t["date"])
            net = t["price"] - t["price"] * t["tax_bp"] // 10000
            days = _days_between(first_sale[key], t["date"])
            rate = 15 if days > 365 else 30
            proceeds = net - round(net * rate / 100)
            row = rows.setdefault((t["app"], t["storefront"]), [t["app"], t["currency"], 0, 0])
            row[2] += 1
            row[3] += proceeds
            sales[t["txn"]] = {"row": row, "net": net, "key": key, "refunded": False}
        elif t["type"] == "refund":
            sale = sales.get(t["original"])
            if sale is None or sale["refunded"]:
                continue
            days = _days_between(first_sale[sale["key"]], t["date"])
            rate = 15 if days > 365 else 30
            sale["row"][2] -= 1
            sale["row"][3] -= sale["net"] - round(sale["net"] * rate / 100)
            sale["refunded"] = True
    return sorted(rows.values())
`;

export const prelude = `
def _gen_store_transactions(n, seed):
    import datetime
    x, out, sold = seed, [], []
    fronts = [('US', 'USD', 0, 999), ('GB', 'GBP', 2000, 899), ('DE', 'EUR', 1900, 999),
              ('FR', 'EUR', 2000, 999), ('JP', 'JPY', 1000, 1500), ('AU', 'AUD', 1000, 1499)]
    apps = ['Lumen', 'Tidepool', 'Orbitly', 'Quill']
    start = datetime.date(2024, 1, 1)
    for i in range(n):
        x = (1103515245 * x + 12345) % 2147483648
        k = (x >> 16) % 10
        day = start + datetime.timedelta(days=i * 700 // n)
        if k < 8 or not sold:
            x = (1103515245 * x + 12345) % 2147483648
            sf, cur, bp, price = fronts[(x >> 8) % 6]
            app = apps[(x >> 12) % 4]
            sub = 's%d' % ((x >> 14) % 20000)
            out.append({'type': 'sale', 'txn': 't%d' % i, 'app': app, 'product': app.lower() + '.plus',
                        'subscriber': sub, 'storefront': sf, 'currency': cur,
                        'price': price + (x >> 20) % 7, 'tax_bp': bp, 'date': day.isoformat()})
            sold.append('t%d' % i)
        else:
            out.append({'type': 'refund', 'txn': 't%d' % i, 'original': sold[(x >> 4) % len(sold)],
                        'date': day.isoformat()})
    return out
`.trim() + "\n";

const DAY_MS = 86400000;
const dayNo = (iso) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / DAY_MS;
const isoOf = (n) => new Date(n * DAY_MS).toISOString().slice(0, 10);
const halfUp = (num, den) => Math.floor((2 * num + den) / (2 * den));   // num, den >= 0

// The specification, implemented independently of the Python reference.
export function oracle(transactions) {
  const first = new Map();
  for (const t of transactions) {
    if (t.type !== "sale") continue;
    const k = t.subscriber + "|" + t.product;
    const d = dayNo(t.date);
    if (!first.has(k) || d < first.get(k)) first.set(k, d);
  }
  const rows = new Map();
  const sales = new Map();
  for (const t of transactions) {
    if (t.type === "sale") {
      const net = halfUp(t.price * 10000, 10000 + t.tax_bp);
      const rate = dayNo(t.date) - first.get(t.subscriber + "|" + t.product) >= 365 ? 15 : 30;
      const proceeds = net - halfUp(net * rate, 100);
      const key = t.app + "|" + t.currency;
      if (!rows.has(key)) rows.set(key, [t.app, t.currency, 0, 0]);
      rows.get(key)[2] += 1;
      rows.get(key)[3] += proceeds;
      sales.set(t.txn, { key, proceeds, refunded: false });
    } else {
      const s = sales.get(t.original);
      if (!s || s.refunded) continue;
      rows.get(s.key)[2] -= 1;
      rows.get(s.key)[3] -= s.proceeds;
      s.refunded = true;
    }
  }
  return [...rows.values()].sort((a, b) => (a[0] !== b[0] ? (a[0] < b[0] ? -1 : 1) : a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0));
}

function py(v) {
  if (v === null || v === undefined) return "None";
  if (typeof v === "number") return String(v);
  if (typeof v === "string") return "'" + v + "'";
  if (Array.isArray(v)) return "[" + v.map(py).join(", ") + "]";
  return "{" + Object.entries(v).map(([k, x]) => `'${k}': ${py(x)}`).join(", ") + "}";
}
const pyArgs = (txns) => "(" + py(txns) + ",)";

const FRONTS = {
  US: ["USD", 0, 999], CA: ["CAD", 0, 1299], GB: ["GBP", 2000, 899], DE: ["EUR", 1900, 999],
  FR: ["EUR", 2000, 999], IT: ["EUR", 2200, 1099], JP: ["JPY", 1000, 1500], AU: ["AUD", 1000, 1499],
};
const APPS = ["Lumen", "Tidepool", "Orbitly", "Quill", "Fernway", "Pebblebox"];

function streamCase(r, level) {
  const apps = r.sample(APPS, 2);
  const fronts = level === 1 ? ["US", "CA"]
    : level === 2 ? r.sample(["US", "GB", "DE", "JP", "AU"], 3)
      : ["DE", "FR", ...r.sample(["US", "GB", "IT", "JP"], 2)];
  const start = dayNo("2024-01-01") + r.int(0, 300);
  const evs = [];
  let txn = r.int(100, 900);
  const subs = r.int(3, 5);
  for (let s = 0; s < subs; s++) {
    const app = level === 3 && s < 2 ? apps[0] : r.pick(apps);
    const sf = level === 3 ? (s < 2 ? fronts[s] : r.pick(fronts.slice(2))) : r.pick(fronts);      // two storefronts that share a currency
    const [currency, taxBp, base] = FRONTS[sf];
    const sub = "s" + r.int(1000, 9999);
    const first = start + r.int(0, 40);
    const months = level === 3 ? r.int(2, 4) : r.int(1, 3);
    for (let m = 0; m < months; m++) {
      const d = level === 3 && m === months - 1 && r.chance(0.6) ? first + 365 + r.int(0, 20) : first + 30 * m;
      const sale = { type: "sale", txn: "t" + txn++, app, product: app.toLowerCase() + ".plus.monthly",
        subscriber: sub, storefront: sf, currency, price: base + r.int(0, 6), tax_bp: taxBp, date: isoOf(d) };
      evs.push({ d, e: sale });
      if (level >= 2 && r.chance(0.25)) evs.push({ d: d + r.int(1, level === 3 ? 12 : 6), e: { type: "refund", txn: "t" + txn++, original: sale.txn } });
    }
  }
  if (level === 3 && evs.some((x) => x.e.type === "refund")) {
    const ref = r.pick(evs.filter((x) => x.e.type === "refund"));
    evs.push({ d: ref.d + 1, e: { type: "refund", txn: "t" + txn++, original: ref.e.original } });     // a repeat
  }
  evs.sort((a, b) => a.d - b.d);           // stable: a sale stays before a refund on the same day
  return evs.map(({ d, e }) => ({ ...e, date: isoOf(d) }));
}

export function generate(r, level) {
  const samples = [];
  for (let i = 0; i < 2; i++) {
    const ev = streamCase(r, level);
    samples.push({ args: pyArgs(ev), expect: py(oracle(ev)) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const app = r.pick(APPS);
  const product = app.toLowerCase() + ".plus.monthly";
  const sub = "s" + r.int(1000, 9999);
  const d0 = dayNo("2024-02-01") + r.int(0, 200);
  let n = r.int(10, 80);
  const sale = (sf, day, price, extra = {}) => {
    const [currency, taxBp] = FRONTS[sf];
    return { type: "sale", txn: "t" + n++, app, product, subscriber: sub, storefront: sf, currency, price, tax_bp: taxBp, date: isoOf(day), ...extra };
  };
  const refund = (orig, day) => ({ type: "refund", txn: "t" + n++, original: orig.txn, date: isoOf(day) });
  // Prices chosen so that only the bug a check names changes its result.
  const noTie = (p) => p * 30 % 100 !== 50 && p * 15 % 100 !== 50;
  const pick = (lo, hi, ok = noTie) => { for (;;) { const p = r.int(lo, hi); if (ok(p)) return p; } };
  const vat = (() => {                     // a tax-inclusive price whose correct net has no half-unit commission
    for (;;) { const p = r.int(900, 1300); if (noTie(halfUp(p * 10000, 11900))) return p; }
  })();
  const s1 = sale("US", d0, pick(600, 1400));
  const s2 = sale("US", d0 + 335, pick(600, 1400));
  const edges = [
    ["a tax-inclusive price has its tax divided out", [sale("DE", d0, vat)]],
    ["a sale exactly 365 days after the first one earns the reduced rate", [s1, sale("US", d0 + 365, pick(600, 1400))]],
    ["a sale 364 days after the first one does not", [sale("US", d0, pick(600, 1400)), sale("US", d0 + 364, pick(600, 1400))]],
    ["a commission of exactly half a minor unit rounds up", [sale("US", d0, 995 + 20 * r.int(0, 10))]],
    ["a refund after the anniversary reverses what the sale paid", [s1, s2, refund(s2, d0 + 365 + r.int(3, 20))]],
    ["two storefronts that share a currency are one row", [sale("DE", d0, 999 + 20 * r.int(0, 3), { tax_bp: 0 }), sale("FR", d0 + 1, 1099, { subscriber: sub + "b", tax_bp: 0 })]],
    ["a second refund of the same sale and a refund of an unknown sale change nothing", (() => {
      const a = sale("US", d0, pick(600, 1400));
      return [a, refund(a, d0 + 2), refund(a, d0 + 3), { type: "refund", txn: "t" + n++, original: "t999999", date: isoOf(d0 + 4) }];
    })()],
    ["each product has its own first year", (() => {
      const a = sale("US", d0, pick(600, 1400));
      const b = sale("US", d0 + 200, pick(600, 1400), { product: app.toLowerCase() + ".pro.yearly" });
      return [a, b, sale("US", d0 + 380, pick(600, 1400), { product: b.product })];
    })()],
  ];
  for (const [name, ev] of edges) tests.push({ name, args: pyArgs(ev), expect: py(oracle(ev)) });

  const size = level === 1 ? 100000 : 200000;
  tests.push({ name: `${size.toLocaleString("en-US")} transactions in time`, args: `(_gen_store_transactions(${size}, ${r.int(1, 1_000_000)}),)`, limit_s: 8 });

  return {
    vars: {
      replay_rule: level === 1
        ? "This replay covers storefronts whose prices include no tax, first-year subscriptions and no refunds; the checks also include the other rules."
        : level === 2
          ? "This replay covers storefronts with tax-inclusive prices, and refunds."
          : "This replay covers tax-inclusive prices, renewals past the subscriber's first paid year, storefronts that share a currency, refunds across the anniversary, and refunds that repeat.",
    },
    samples,
    tests,
  };
}
