/* BLK-L1-03 — Instalment schedules: per purchase-month cohort, the share of plans with
   every instalment paid by its due date, and late instalments by number (SQL).
   Simulated practice scenario set in a buy-now-pay-later product's public domain. All data
   is generated from the seed and is hypothetical; money is integer cents. The schedule
   (four instalments, the first at checkout, then every 14 days) and the on-time rule are
   this exercise's rules, not a statement of any product's terms.

   Contract: see docs/COMPANY-INTERVIEW-LOOPS.md § Executable templates (sql).
   Payments are applied in (paid_at, payment_id) order to the earliest instalment not yet
   fully paid. Instalment k is fully paid by the payment that brings the plan's running
   total to at least the sum of instalments 1..k; it is on time if that payment's UTC date
   is on or before the due date.
   level: 1 Medium (one exact payment per instalment, in order; stopped plans; payments on
                    the due date and a few days late)
          2 Hard (+ instalments paid in parts, the completing part after the due date; payments
                  at 23:59 on the due date and just after midnight)
          3 Very Hard (+ payments larger than one instalment that pay ahead, and a single
                       payment that clears the rest of the plan early) */
import { insertSQL } from "../../js/rng.js";

export const kind = "sql";

const H = 3600, D = 86400;
const utcTs = (sec) => new Date(sec * 1000).toISOString().replace("T", " ").slice(0, 19) + "+00";
const utcDate = (sec) => new Date(sec * 1000).toISOString().slice(0, 10);
const utcMonth = (sec) => new Date(sec * 1000).toISOString().slice(0, 7) + "-01";
const dayStart = (sec) => sec - (sec % D);

export function generate(r, level) {
  const start = Date.UTC(2026, level === 1 ? 6 : 5, 1) / 1000;   // purchases from 1 July (Medium) or 1 June
  const months = level === 1 ? 2 : 3;
  const nPlans = level === 1 ? r.int(12, 16) : level === 2 ? r.int(15, 19) : r.int(16, 20);
  const plans = [];
  const payments = [];          // {plan, sec, amount, order}
  let pl = 4000 + r.int(0, 5000);

  const makePlan = (sec, amount) => {
    const base = Math.floor(amount / 4);
    const inst = [base + (amount - 4 * base), base, base, base];
    const day0 = dayStart(sec);
    const p = { id: "plan_" + (pl += r.int(1, 60)), sec, amount, inst, due: [0, 1, 2, 3].map((k) => day0 + 14 * k * D) };
    plans.push(p);
    payments.push({ plan: p, sec, amount: inst[0], order: 0 });   // the first instalment at checkout
    return p;
  };
  const pay = (p, sec, amount) => payments.push({ plan: p, sec, amount, order: r.next() });
  // When to pay instalment k: on time (some on the due date itself) or late by days.
  const when = (p, k, late) => {
    const due = p.due[k];
    if (late) return due + D * r.int(1, level === 1 ? 6 : 9) + r.int(0, D - 1);
    return r.chance(0.3) ? due + r.int(6 * H, D - 1) : due - D * r.int(1, 4) + r.int(0, D - 1);
  };

  for (let i = 0; i < nPlans; i++) {
    const sec = start + r.int(0, months * 30 - 1) * D + r.int(7 * H, 22 * H);
    const p = makePlan(sec, r.int(16, 800) * 25 + r.int(0, 3));
    const stopAt = r.chance(0.15) ? r.int(1, 3) : 4;                 // stops paying before instalment stopAt+1
    let prev = sec;
    for (let k = 1; k < stopAt; k++) {
      const late = r.chance(0.25);
      if (level >= 2 && r.chance(0.3)) {                              // paid in two or three parts
        const parts = r.int(2, 3);
        let left = p.inst[k];
        for (let j = 0; j < parts; j++) {
          const amt = j === parts - 1 ? left : Math.max(1, Math.floor(left * r.int(20, 60) / 100));
          left -= amt;
          const t = j === parts - 1 ? Math.max(prev + 60, when(p, k, late)) : Math.max(prev + 60, p.due[k] - D * r.int(1, 6));
          pay(p, t, amt);
          prev = t;
        }
      } else if (level === 3 && k < 3 && r.chance(0.25)) {             // pays ahead into the next instalment
        const extra = r.int(1, p.inst[k + 1] - 1);
        const t = Math.max(prev + 60, when(p, k, late));
        pay(p, t, p.inst[k] + extra);
        prev = t;
        const t2 = Math.max(prev + 60, when(p, k + 1, r.chance(0.25)));
        pay(p, t2, p.inst[k + 1] - extra);
        prev = t2;
        k++;
      } else {
        const t = Math.max(prev + 60, when(p, k, late));
        pay(p, t, p.inst[k]);
        prev = t;
      }
    }
  }
  // Every level: a plan whose second instalment is paid at 23:59 on its due date and whose
  // third is paid one day late, and a plan that stops after checkout.
  {
    const p = makePlan(start + r.int(2, 20) * D + r.int(9 * H, 18 * H), r.int(40, 400) * 25);
    pay(p, p.due[1] + D - r.int(1, 59), p.inst[1]);
    pay(p, p.due[2] + D + r.int(0, 600), p.inst[2]);
    pay(p, p.due[3] - r.int(H, 5 * D), p.inst[3]);
    makePlan(start + r.int(2, 20) * D + r.int(9 * H, 18 * H), r.int(40, 400) * 25);
  }
  if (level >= 2) {
    // Two parts: the first well before the due date, the completing one just after midnight.
    const p = makePlan(start + r.int(30, 50) * D + r.int(9 * H, 18 * H), r.int(80, 400) * 25);
    pay(p, p.due[1] - 3 * D, Math.floor(p.inst[1] / 2));
    pay(p, p.due[1] + D + r.int(0, 59), p.inst[1] - Math.floor(p.inst[1] / 2));
    pay(p, p.due[2] - D, p.inst[2]);
    pay(p, p.due[3] - D, p.inst[3]);
  }
  if (level === 3) {
    // Clears the rest of the plan in one payment a week after checkout.
    const p = makePlan(start + r.int(30, 50) * D + r.int(9 * H, 18 * H), r.int(80, 400) * 25);
    pay(p, p.sec + 7 * D, p.inst[1] + p.inst[2] + p.inst[3]);
    // Pays instalment 2 late with enough to cover instalment 3 too.
    const q = makePlan(start + r.int(30, 50) * D + r.int(9 * H, 18 * H), r.int(80, 400) * 25);
    pay(q, q.due[1] + 2 * D, q.inst[1] + q.inst[2]);
    pay(q, q.due[3] - D, q.inst[3]);
  }

  payments.sort((a, b) => a.sec - b.sec || a.order - b.order);
  let pid = 800000 + r.int(0, 90000);
  for (const x of payments) x.id = (pid += r.int(1, 9));

  // status per instalment: "on" | "late" | "unpaid"
  const judge = (p, o) => {
    const mine = payments.filter((x) => x.plan === p).sort((a, b) => a.sec - b.sec || a.id - b.id);
    const out = [];
    if (o.byOrder) {
      for (let k = 0; k < 4; k++) {
        const x = mine[k];
        out.push(!x ? "unpaid" : utcDate(x.sec) <= utcDate(p.due[k]) ? "on" : "late");
      }
      return out;
    }
    let due = 0;
    for (let k = 0; k < 4; k++) {
      due += p.inst[k];
      let run = 0, done = null, first = null;
      for (const x of mine) {
        run += x.amount;
        if (first === null && run > due - p.inst[k]) first = x;
        if (run >= due) { done = x; break; }
      }
      const x = o.firstPart ? (done ? first : null) : done;
      if (!x) out.push("unpaid");
      else if (o.timestamp ? x.sec <= p.due[k] : utcDate(x.sec) <= utcDate(p.due[k])) out.push("on");
      else out.push("late");
    }
    return out;
  };
  const share = (n, d) => Math.floor((n * 20000 + d) / (2 * d)) / 10000;
  const solve = (o = {}) => {
    const per = new Map();
    for (const p of plans) {
      const st = judge(p, o);
      const m = utcMonth(p.sec);
      if (!per.has(m)) per.set(m, { n: 0, ok: 0, l: [0, 0, 0, 0], u: 0 });
      const s = per.get(m);
      s.n++;
      if (o.unpaidOk ? !st.includes("late") : st.every((x) => x === "on")) s.ok++;
      st.forEach((x, k) => { if (x === "late") s.l[k]++; if (x === "unpaid") s.u++; });
    }
    return [...per.keys()].sort().map((m) => {
      const s = per.get(m);
      return [m, s.n, s.ok, share(s.ok, s.n), s.l[1], s.l[2], s.l[3], s.u];
    });
  };
  const rows = solve();
  const diagnostics = [
    { message: "Payments were compared with the due date as a timestamp (midnight at its start). A payment at any time on the due date (UTC) is on time.", rows: solve({ timestamp: true }) },
    { message: "Plans with an unpaid instalment were counted as on time because nothing was late. A plan is on time only if every instalment was fully paid by its due date.", rows: solve({ unpaidOk: true }) },
  ];
  if (level >= 2) {
    diagnostics.push({ message: "The n-th payment was matched to the n-th instalment. Payments apply to the earliest instalment not yet fully paid, and a part payment does not complete one.", rows: solve({ byOrder: true }) });
    diagnostics.push({ message: "An instalment was judged by the first payment towards it. It is judged by the payment that completes it.", rows: solve({ firstPart: true }) });
  }

  const cmp = (x, y) => (x < y ? -1 : x > y ? 1 : 0);
  const plCols = ["plan_id", "purchased_at", "amount_cents"];
  const plRows = plans.slice().sort((a, b) => cmp(a.id, b.id)).map((p) => [p.id, utcTs(p.sec), p.amount]);
  const iCols = ["plan_id", "instalment_no", "due_date", "amount_cents"];
  const iRows = plans.slice().sort((a, b) => cmp(a.id, b.id)).flatMap((p) => p.inst.map((a, k) => [p.id, k + 1, utcDate(p.due[k]), a]));
  const pCols = ["payment_id", "plan_id", "paid_at", "amount_cents"];
  const pRows = payments.slice().sort((a, b) => a.id - b.id).map((x) => [x.id, x.plan.id, utcTs(x.sec), x.amount]);
  const setup =
    "SET TIME ZONE 'UTC';\n" +
    "CREATE TABLE plans (\n  plan_id TEXT PRIMARY KEY,\n  purchased_at TIMESTAMPTZ NOT NULL,\n  amount_cents BIGINT NOT NULL CHECK (amount_cents > 0)\n);\n" +
    "CREATE TABLE instalments (\n  plan_id TEXT NOT NULL REFERENCES plans(plan_id),\n  instalment_no INT NOT NULL CHECK (instalment_no BETWEEN 1 AND 4),\n  due_date DATE NOT NULL,\n  amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),\n  PRIMARY KEY (plan_id, instalment_no)\n);\n" +
    "CREATE TABLE plan_payments (\n  payment_id BIGINT PRIMARY KEY,\n  plan_id TEXT NOT NULL REFERENCES plans(plan_id),\n  paid_at TIMESTAMPTZ NOT NULL,\n  amount_cents BIGINT NOT NULL CHECK (amount_cents > 0)\n);\n" +
    insertSQL("plans", plCols, plRows) + insertSQL("instalments", iCols, iRows) + insertSQL("plan_payments", pCols, pRows);

  return {
    vars: {
      plans: plans.length,
      payments: payments.length,
      payment_rule: level === 1
        ? "In this sample every payment is exactly one instalment's amount and customers pay their instalments in order, but write the query for the general rule."
        : level === 2
          ? "Customers may pay an instalment in several parts; the instalment is paid when the part that completes it arrives."
          : "Customers may pay in parts or pay ahead: a payment larger than what is left on one instalment carries the rest into the next, so one payment can complete several instalments.",
    },
    setup,
    tables: [
      { name: "plans", columns: plCols, rows: plRows },
      { name: "instalments", columns: iCols, rows: iRows },
      { name: "plan_payments", columns: pCols, rows: pRows },
    ],
    expected: { columns: ["cohort_month", "plans", "on_time_plans", "on_time_share", "late_2", "late_3", "late_4", "unpaid_instalments"], rows },
    diagnostics: diagnostics.filter((d) => JSON.stringify(d.rows) !== JSON.stringify(rows)),
  };
}
