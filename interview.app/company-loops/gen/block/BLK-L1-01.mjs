/* BLK-L1-01 — Payment method mix per business category and month, split tenders
   counted per tender (SQL).
   Simulated practice scenario set in a point-of-sale product's public domain. All data is
   generated from the seed and is hypothetical; money is integer cents.

   Contract: see docs/COMPANY-INTERVIEW-LOOPS.md § Executable templates (sql).
   The oracle converts instants to the seller's local month with Intl (IANA zones),
   independently of PostgreSQL's AT TIME ZONE.
   level: 1 Medium (UTC months; every tender completed; split payments; the full grid of
                    five methods with zeros)
          2 Hard (+ months in each seller's own time zone, payments near month ends,
                  failed card attempts before the tender that went through)
          3 Very Hard (+ cash tenders with change given, so the amount applied is the cash
                       tendered minus the change; three-way splits) */
import { insertSQL } from "../../js/rng.js";

export const kind = "sql";

const CATS = ["beauty", "food_and_drink", "health_and_fitness", "home_services", "retail"];
const ZONES = ["America/New_York", "America/Chicago", "America/Los_Angeles", "Europe/London", "Australia/Sydney", "Asia/Tokyo"];
const METHODS = ["cash", "chip", "contactless", "keyed", "swipe"];
const CARD = ["chip", "contactless", "keyed", "swipe"];
const BASE = Date.UTC(2026, 0, 1) / 1000;          // 2026-01-01 00:00 UTC
const H = 3600, D = 86400;

const fmt = {};
function localMonth(sec, tz) {
  const f = (fmt[tz] ||= new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit" }));
  const p = Object.fromEntries(f.formatToParts(new Date(sec * 1000)).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-01`;
}
const utcMonth = (sec) => new Date(sec * 1000).toISOString().slice(0, 7) + "-01";
const utcTs = (sec) => new Date(sec * 1000).toISOString().replace("T", " ").slice(0, 19) + "+00";

function pickMethod(r) {
  const x = r.next();
  return x < 0.34 ? "contactless" : x < 0.58 ? "chip" : x < 0.8 ? "cash" : x < 0.9 ? "swipe" : "keyed";
}

export function generate(r, level) {
  const cats = r.sample(CATS, 3).sort();
  const sellers = [];
  let sid = 1000 + r.int(0, 8000);
  for (const c of cats) {
    for (let k = 0; k < 2; k++) sellers.push({ id: "S" + (sid += r.int(3, 90)), cat: c, tz: r.pick(ZONES) });
  }
  // Hard+: make sure the zones on both sides of UTC appear.
  if (level >= 2) { sellers[0].tz = "America/Los_Angeles"; sellers[sellers.length - 1].tz = "Australia/Sydney"; }

  const nPay = level === 1 ? r.int(26, 32) : level === 2 ? r.int(32, 40) : r.int(36, 44);
  const payments = [];
  const tenders = [];
  let pid = 50000 + r.int(0, 40000);
  let tid = 900000 + r.int(0, 90000);
  const boundaries = [BASE + 31 * D, BASE + 59 * D];   // 2026-02-01 and 2026-03-01 UTC
  const addPayment = (seller, sec, parts) => {
    const p = { id: "pay_" + (pid += r.int(1, 30)), seller, sec };
    payments.push(p);
    for (const t of parts) tenders.push({ id: (tid += r.int(1, 9)), pay: p, ...t });
    return p;
  };
  for (let i = 0; i < nPay; i++) {
    const seller = r.pick(sellers);
    let sec;
    if (level >= 2 && r.chance(0.3)) sec = r.pick(boundaries) + r.int(-14 * H, 14 * H);
    else sec = BASE + r.int(2 * H, 58 * D);
    const total = r.int(4, 400) * 25;
    const nT = r.chance(level === 3 ? 0.35 : 0.25) ? (level === 3 && r.chance(0.35) ? 3 : 2) : 1;
    const parts = [];
    if (level >= 2 && r.chance(0.2)) {
      parts.push({ method: r.pick(CARD), status: "FAILED", applied: total, change: 0 });      // declined attempt
    }
    let left = total;
    for (let k = 0; k < nT; k++) {
      const amt = k === nT - 1 ? left : Math.max(25, Math.floor((left * r.int(25, 75)) / 100 / 25) * 25);
      if (amt >= left && k < nT - 1) break;
      const method = k === 0 && nT > 1 && r.chance(0.5) ? "cash" : pickMethod(r);
      let change = 0;
      if (level === 3 && method === "cash" && amt % 1000 !== 0 && r.chance(0.7)) change = Math.ceil(amt / 1000) * 1000 - amt;
      parts.push({ method, status: "COMPLETED", applied: amt, change });
      left -= amt;
    }
    if (left > 0) parts.push({ method: pickMethod(r), status: "COMPLETED", applied: left, change: 0 });
    addPayment(seller, sec, parts);
  }
  // Every level: a split payment (cash then a card).
  addPayment(sellers[1], BASE + r.int(3, 25) * D + r.int(9 * H, 18 * H), [
    { method: "cash", status: "COMPLETED", applied: 2000, change: 0 },
    { method: r.pick(CARD), status: "COMPLETED", applied: r.int(10, 200) * 25, change: 0 },
  ]);
  if (level >= 2) {
    // A failed chip read followed by a contactless retry, and a payment a few hours either
    // side of a UTC month end for a seller behind and one ahead of UTC.
    addPayment(sellers[2], BASE + r.int(33, 50) * D + 12 * H, [
      { method: "chip", status: "FAILED", applied: 4200, change: 0 },
      { method: "contactless", status: "COMPLETED", applied: 4200, change: 0 },
    ]);
    addPayment(sellers[0], boundaries[0] + r.int(1 * H, 6 * H), [{ method: "keyed", status: "COMPLETED", applied: r.int(20, 300) * 25, change: 0 }]);
    addPayment(sellers[sellers.length - 1], boundaries[1] - r.int(1 * H, 9 * H), [{ method: "swipe", status: "COMPLETED", applied: r.int(20, 300) * 25, change: 0 }]);
  }
  if (level === 3) {
    addPayment(sellers[3], BASE + r.int(3, 50) * D + r.int(9 * H, 18 * H), [
      { method: "cash", status: "COMPLETED", applied: 1350, change: 650 },
      { method: "contactless", status: "COMPLETED", applied: r.int(10, 200) * 25, change: 0 },
    ]);
  }

  const share = (n, d) => Math.floor((n * 20000 + d) / (2 * d)) / 10000;
  const solve = (o = {}) => {
    const groups = new Map();
    const monthOf = (p) => (level === 1 || o.utc ? utcMonth(p.sec) : localMonth(p.sec, p.seller.tz));
    const counted = tenders.filter((t) => o.failed || t.status === "COMPLETED");
    let units;
    if (o.perPayment) {
      // One row per payment, under its largest counted tender.
      const byPay = new Map();
      for (const t of counted) {
        const amt = t.applied;
        const cur = byPay.get(t.pay);
        if (!cur) byPay.set(t.pay, { pay: t.pay, method: t.method, amt, big: amt, id: t.id });
        else {
          cur.amt += amt;
          if (amt > cur.big || (amt === cur.big && t.id < cur.id)) Object.assign(cur, { method: t.method, big: amt, id: t.id });
        }
      }
      units = [...byPay.values()].map((u) => ({ pay: u.pay, method: u.method, amt: u.amt }));
    } else {
      units = counted.map((t) => ({ pay: t.pay, method: t.method, amt: o.noChange ? t.applied + t.change : t.applied }));
    }
    for (const u of units) {
      const k = u.pay.seller.cat + "|" + monthOf(u.pay);
      if (!groups.has(k)) groups.set(k, { n: 0, a: 0, m: new Map() });
      const g = groups.get(k);
      g.n++;
      g.a += u.amt;
      const mm = g.m.get(u.method) || { n: 0, a: 0 };
      mm.n++;
      mm.a += u.amt;
      g.m.set(u.method, mm);
    }
    const rows = [];
    for (const k of [...groups.keys()].sort()) {
      const [cat, month] = k.split("|");
      const g = groups.get(k);
      for (const m of METHODS) {
        const mm = g.m.get(m) || { n: 0, a: 0 };
        if (o.noGrid && mm.n === 0) continue;
        rows.push([cat, month, m, mm.n, mm.a, share(mm.n, g.n), share(mm.a, g.a)]);
      }
    }
    return rows;
  };
  const rows = solve();

  const diagnostics = [
    { message: "Each payment was counted once, under its largest tender. A split payment contributes one row per tender, each with its own method and amount.", rows: solve({ perPayment: true }) },
    { message: "Methods with no tenders in a category-month are missing. The report lists all five methods for every category-month, with zeros.", rows: solve({ noGrid: true }) },
  ];
  if (level >= 2) {
    diagnostics.push({ message: "Months were taken in UTC. A payment belongs to the month of its local time in the seller's time zone.", rows: solve({ utc: true }) });
    diagnostics.push({ message: "FAILED tenders were counted. Only COMPLETED tenders took money.", rows: solve({ failed: true }) });
  }
  if (level === 3) diagnostics.push({ message: "Cash tenders were counted at the cash handed over. The amount applied is tendered_cents minus change_cents.", rows: solve({ noChange: true }) });

  const cmp = (x, y) => (x < y ? -1 : x > y ? 1 : 0);
  const sCols = ["seller_id", "business_category", "time_zone"];
  const sRows = sellers.map((s) => [s.id, s.cat, s.tz]);
  const pCols = ["payment_id", "seller_id", "created_at"];
  const pRows = payments.slice().sort((a, b) => cmp(a.id, b.id)).map((p) => [p.id, p.seller.id, utcTs(p.sec)]);
  const tCols = ["tender_id", "payment_id", "method", "status", "tendered_cents", "change_cents"];
  const tRows = tenders.slice().sort((a, b) => a.id - b.id).map((t) => [t.id, t.pay.id, t.method, t.status, t.applied + t.change, t.change]);
  const mCols = ["method"];
  const mRows = METHODS.map((m) => [m]);
  const setup =
    "SET TIME ZONE 'UTC';\n" +
    "CREATE TABLE sellers (\n  seller_id TEXT PRIMARY KEY,\n  business_category TEXT NOT NULL,\n  time_zone TEXT NOT NULL\n);\n" +
    "CREATE TABLE payments (\n  payment_id TEXT PRIMARY KEY,\n  seller_id TEXT NOT NULL REFERENCES sellers(seller_id),\n  created_at TIMESTAMPTZ NOT NULL\n);\n" +
    "CREATE TABLE tenders (\n  tender_id BIGINT PRIMARY KEY,\n  payment_id TEXT NOT NULL REFERENCES payments(payment_id),\n  method TEXT NOT NULL,\n  status TEXT NOT NULL CHECK (status IN ('COMPLETED', 'FAILED')),\n  tendered_cents BIGINT NOT NULL CHECK (tendered_cents > 0),\n  change_cents BIGINT NOT NULL CHECK (change_cents >= 0)\n);\n" +
    "CREATE TABLE tender_methods (\n  method TEXT PRIMARY KEY\n);\n" +
    insertSQL("sellers", sCols, sRows) + insertSQL("payments", pCols, pRows) + insertSQL("tenders", tCols, tRows) + insertSQL("tender_methods", mCols, mRows);

  return {
    vars: {
      payments: payments.length,
      tenders: tenders.length,
      month_rule: level === 1
        ? "`month` is the first day of the UTC calendar month of the payment's `created_at`."
        : "`month` is the first day of the calendar month of the payment's `created_at` in the seller's own `time_zone` (a payment at 02:00 UTC on 1 February is still January for a seller in Los Angeles).",
      status_rule: level === 1
        ? "Every tender in this sample has `status = 'COMPLETED'`."
        : "Only tenders with `status = 'COMPLETED'` count; a `FAILED` tender is a declined or abandoned attempt that took no money.",
      change_rule: level === 3
        ? "A cash tender records the cash handed over (`tendered_cents`) and the change given back (`change_cents`); the amount it applied to the payment is `tendered_cents - change_cents`. Card tenders have `change_cents = 0`."
        : "Every tender in this sample has `change_cents = 0`, so its amount is `tendered_cents`; keep the subtraction anyway.",
      month_tz_sql: level === 1 ? "'UTC'" : "s.time_zone",
    },
    setup,
    tables: [
      { name: "sellers", columns: sCols, rows: sRows },
      { name: "payments", columns: pCols, rows: pRows },
      { name: "tenders", columns: tCols, rows: tRows },
      { name: "tender_methods", columns: mCols, rows: mRows },
    ],
    expected: { columns: ["business_category", "month", "method", "tenders", "amount_cents", "tender_share", "amount_share"], rows },
    diagnostics: diagnostics.filter((d) => JSON.stringify(d.rows) !== JSON.stringify(rows)),
  };
}
