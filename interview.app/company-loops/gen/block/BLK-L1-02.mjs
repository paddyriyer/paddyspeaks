/* BLK-L1-02 — Offline-mode payments: hours until forwarded, the share declined once
   forwarded, and payments never forwarded listed apart (SQL).
   Simulated practice scenario set in a point-of-sale product's public domain. All data is
   generated from the seed and is hypothetical; money is integer cents. The forwarding
   window at Very Hard is this exercise's rule, not a statement of any product's limit.

   Contract: see docs/COMPANY-INTERVIEW-LOOPS.md § Executable templates (sql).
   level: 1 Medium (at most one forward attempt per payment; payments forwarded in the next
                    month; a seller-month where nothing was forwarded, so averages are NULL)
          2 Hard (+ ERROR attempts before the decisive one, payments with only ERROR
                  attempts, a later duplicate decisive attempt, equal timestamps broken by
                  attempt_id)
          3 Very Hard (+ a forwarding window: a payment whose first decisive attempt is
                       later than the window counts as never forwarded; one exactly at it) */
import { insertSQL } from "../../js/rng.js";

export const kind = "sql";

const H = 3600, D = 86400;
const BASE = Date.UTC(2026, 7, 1) / 1000;               // 2026-08-01 00:00 UTC
const utcTs = (sec) => new Date(sec * 1000).toISOString().replace("T", " ").slice(0, 19) + "+00";
const utcMonth = (sec) => new Date(sec * 1000).toISOString().slice(0, 7) + "-01";

export function generate(r, level) {
  const W = level === 3 ? r.pick([24, 48, 72]) : null;
  const nSellers = r.int(3, 4);
  const sellers = [];
  let sid = 1000 + r.int(0, 8000);
  for (let k = 0; k < nSellers; k++) sellers.push("S" + (sid += r.int(3, 90)));
  const nPay = level === 1 ? r.int(22, 28) : level === 2 ? r.int(28, 34) : r.int(32, 38);
  const pays = [];
  const attempts = [];          // {pay, sec, result, order}
  let pid = 70000 + r.int(0, 20000);
  const maxDelay = level === 3 ? (W + 18) * H : 40 * H;
  const newPay = (seller, sec) => {
    const p = { id: "off_" + (pid += r.int(1, 40)), seller, sec, amount: r.int(4, 600) * 25 };
    pays.push(p);
    return p;
  };
  const att = (p, sec, result) => attempts.push({ pay: p, sec, result, order: r.next() });

  for (let i = 0; i < nPay; i++) {
    const p = newPay(r.pick(sellers), r.chance(0.2) ? BASE + 31 * D - r.int(1 * H, 20 * H) : BASE + r.int(1 * H, 58 * D));
    if (r.chance(0.1)) {                                   // never forwarded
      if (level >= 2 && r.chance(0.6)) for (let k = r.int(1, 2); k > 0; k--) att(p, p.sec + r.int(60, maxDelay), "ERROR");
      continue;
    }
    const delay = r.int(60, maxDelay);
    if (level >= 2 && r.chance(0.3)) for (let k = r.int(1, 2); k > 0; k--) att(p, p.sec + r.int(30, delay), "ERROR");
    const res = r.chance(0.18) ? "DECLINED" : "APPROVED";
    att(p, p.sec + delay, res);
    if (level >= 2 && r.chance(0.12)) att(p, p.sec + delay + r.int(0, 2 * H), res === "APPROVED" ? "DECLINED" : "APPROVED");
  }
  // Every level: a seller-month with offline payments and no forward at all (NULL averages).
  const lone = "S" + (sid += r.int(3, 90));
  sellers.push(lone);
  {
    const p = newPay(lone, BASE + r.int(2, 25) * D + r.int(9 * H, 18 * H));
    if (level >= 2) att(p, p.sec + r.int(H, 5 * H), "ERROR");
  }
  // Every level: a payment taken late on 31 August and forwarded in September.
  att(newPay(sellers[0], BASE + 31 * D - r.int(10 * 60, 2 * H)), BASE + 31 * D + r.int(H, 6 * H) , "APPROVED");
  if (level >= 2) {
    // Two decisive attempts at the same second: the lower attempt_id settles the payment.
    const p = newPay(sellers[1], BASE + r.int(33, 50) * D);
    const t = p.sec + r.int(2 * H, 9 * H);
    attempts.push({ pay: p, sec: t, result: "DECLINED", order: -1 });
    attempts.push({ pay: p, sec: t, result: "APPROVED", order: 2 });
    // ERROR, then a decline, then an approval of a retry.
    const q = newPay(sellers[2 % sellers.length], BASE + r.int(3, 25) * D);
    att(q, q.sec + r.int(10 * 60, H), "ERROR");
    att(q, q.sec + r.int(2 * H, 3 * H), "DECLINED");
    att(q, q.sec + r.int(4 * H, 5 * H), "APPROVED");
  }
  if (level === 3) {
    const p = newPay(sellers[0], BASE + r.int(3, 25) * D);       // exactly at the window: in time
    att(p, p.sec + W * H, "APPROVED");
    const q = newPay(sellers[1], BASE + r.int(3, 25) * D);       // one second late: never forwarded
    att(q, q.sec + W * H + 1, "APPROVED");
  }

  // attempt_id: time order, but attempts at the same second in their `order`.
  attempts.sort((a, b) => a.sec - b.sec || a.order - b.order);
  let aid = 300000 + r.int(0, 90000);
  for (const a of attempts) a.id = (aid += r.int(1, 7));

  const solve = (o = {}) => {
    const per = new Map();
    for (const p of pays) {
      const mine = attempts.filter((a) => a.pay === p).sort((a, b) => a.sec - b.sec || a.id - b.id);
      let dec = mine.filter((a) => o.errorsForward || a.result !== "ERROR");
      if (o.lastAttempt) dec = dec.slice().reverse();
      let d = dec[0] || null;
      if (d && W !== null && !o.noWindow && (o.exclusive ? d.sec - p.sec >= W * H : d.sec - p.sec > W * H)) d = null;
      const k = p.seller + "|" + utcMonth(o.forwardMonth && d ? d.sec : p.sec);
      if (!per.has(k)) per.set(k, { n: 0, fw: 0, secs: 0, dec: 0, never: 0, neverCents: 0 });
      const s = per.get(k);
      s.n++;
      if (d) { s.fw++; s.secs += d.sec - p.sec; if (d.result === "DECLINED") s.dec++; }
      else { s.never++; s.neverCents += p.amount; }
    }
    const cmp = (x, y) => (x < y ? -1 : x > y ? 1 : 0);
    return [...per.entries()].sort((x, y) => cmp(x[0], y[0])).map(([k, s]) => {
      const [seller, month] = k.split("|");
      const avg = s.fw ? Math.floor((s.secs * 200 + 3600 * s.fw) / (7200 * s.fw)) / 100 : null;
      const den = o.allInDenominator ? s.n : s.fw;
      const decShare = den ? Math.floor((s.dec * 20000 + den) / (2 * den)) / 10000 : null;
      return [seller, month, s.n, s.fw, avg, decShare, s.never, s.neverCents];
    });
  };
  const rows = solve();
  const diagnostics = [
    { message: "Payments were grouped by the month they were forwarded. The report groups by the month the payment was taken (taken_at).", rows: solve({ forwardMonth: true }) },
    { message: "The decline share was divided by all offline payments. Its denominator is the forwarded payments only; never-forwarded payments are listed apart.", rows: solve({ allInDenominator: true }) },
  ];
  if (level >= 2) {
    diagnostics.push({ message: "ERROR attempts were treated as forwarding the payment. Only an APPROVED or DECLINED attempt settles it.", rows: solve({ errorsForward: true }) });
    diagnostics.push({ message: "The latest decisive attempt was used. The first decisive attempt (by attempted_at, then attempt_id) settles the payment; later ones are ignored.", rows: solve({ lastAttempt: true }) });
  }
  if (level === 3) {
    diagnostics.push({ message: "The forwarding window was ignored. A payment whose first decisive attempt is more than the window after taken_at counts as never forwarded.", rows: solve({ noWindow: true }) });
    diagnostics.push({ message: "The window boundary is exclusive in this query. An attempt exactly the window's length after taken_at is in time.", rows: solve({ exclusive: true }) });
  }

  const cmp = (x, y) => (x < y ? -1 : x > y ? 1 : 0);
  const pCols = ["payment_id", "seller_id", "taken_at", "amount_cents"];
  const pRows = pays.slice().sort((a, b) => cmp(a.id, b.id)).map((p) => [p.id, p.seller, utcTs(p.sec), p.amount]);
  const aCols = ["attempt_id", "payment_id", "attempted_at", "result"];
  const aRows = attempts.slice().sort((a, b) => a.id - b.id).map((a) => [a.id, a.pay.id, utcTs(a.sec), a.result]);
  const setup =
    "SET TIME ZONE 'UTC';\n" +
    "CREATE TABLE offline_payments (\n  payment_id TEXT PRIMARY KEY,\n  seller_id TEXT NOT NULL,\n  taken_at TIMESTAMPTZ NOT NULL,\n  amount_cents BIGINT NOT NULL CHECK (amount_cents > 0)\n);\n" +
    "CREATE TABLE forward_attempts (\n  attempt_id BIGINT PRIMARY KEY,\n  payment_id TEXT NOT NULL REFERENCES offline_payments(payment_id),\n  attempted_at TIMESTAMPTZ NOT NULL,\n  result TEXT NOT NULL CHECK (result IN ('APPROVED', 'DECLINED', 'ERROR'))\n);\n" +
    insertSQL("offline_payments", pCols, pRows) + insertSQL("forward_attempts", aCols, aRows);

  return {
    vars: {
      payments: pays.length,
      attempts: attempts.length,
      attempt_rule: level === 1
        ? "In this sample each payment has at most one attempt, always `APPROVED` or `DECLINED`, and that attempt is its first decisive attempt. (In general an `ERROR` attempt settles nothing, and the first decisive attempt is the earliest `APPROVED` or `DECLINED` one by `attempted_at`, then `attempt_id`.)"
        : "A payment can have several attempts. `ERROR` attempts (the network dropped, the request timed out) settle nothing; the payment's first decisive attempt is its earliest `APPROVED` or `DECLINED` attempt by `attempted_at`, then `attempt_id`, and any later attempt is ignored.",
      window_rule: level === 3
        ? `This exercise's rule (check current docs for any real limit): an offline payment must be forwarded within ${W} hours of \`taken_at\`. If its first decisive attempt is more than ${W} hours after \`taken_at\` it was not processed and counts as never forwarded; exactly ${W} hours is still in time.`
        : "There is no forwarding deadline in this version of the report.",
      window_h: W === null ? 0 : W,
    },
    setup,
    tables: [
      { name: "offline_payments", columns: pCols, rows: pRows },
      { name: "forward_attempts", columns: aCols, rows: aRows },
    ],
    expected: { columns: ["seller_id", "month", "offline_payments", "forwarded", "avg_hours_to_forward", "declined_share", "never_forwarded", "never_forwarded_cents"], rows },
    diagnostics: diagnostics.filter((d) => JSON.stringify(d.rows) !== JSON.stringify(rows)),
  };
}
