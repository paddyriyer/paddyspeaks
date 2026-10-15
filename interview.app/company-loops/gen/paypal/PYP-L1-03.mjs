/* PYP-L1-03 — Pay-later early payoff per purchase-amount band (SQL).
   Simulated practice scenario. All data is generated from the seed.

   Contract: generate(r, level) -> { vars, setup, tables, expected, diagnostics }.
   The oracle places every counted plan in its band (lower inclusive, upper exclusive,
   an open top band), decides "paid off" from the sum of posted payments, "paid off
   early" from the date of the last posted payment against the final due date, and
   counts the posted extra payments. Every band is reported, including empty ones.
   level: 1 Medium (bands, schedules, extra payments; dates in UTC)
          2 Hard (+ cancelled plans excluded, reversed payments ignored, purchases exactly
                  on a band boundary, last payments in the final seconds before and after
                  the due date's midnight)
          3 Very Hard (+ the due date is a date in the plan's own time zone: the last
                  payment's local date decides, not its UTC date) */
import { insertSQL, ts } from "../../js/rng.js";

export const kind = "sql";

const BAND_SETS = [
  [0, 5000, 15000, 40000, 100000],
  [0, 10000, 25000, 60000, 150000],
  [3000, 7500, 20000, 50000, 120000],
];
const BASE = "2026-05-01";
const DAY = 86400;
const ZONES = ["America/Los_Angeles", "America/New_York", "Europe/London", "Asia/Tokyo", "Australia/Sydney"];

const dayStr = (k) => { const d = new Date(BASE + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + k); return d.toISOString().slice(0, 10); };
const stamp = (s) => ts(dayStr(Math.floor(s / DAY)), s % DAY);
const fmtCache = new Map();
function localDate(s, zone) {
  if (!fmtCache.has(zone)) fmtCache.set(zone, new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }));
  const d = new Date(Date.parse(BASE + "T00:00:00Z") + s * 1000);
  return fmtCache.get(zone).format(d);
}
const r4 = (c, n) => Math.floor((2 * c * 10000 + n) / (2 * n)) / 10000;
const money = (c) => "$" + (c / 100).toLocaleString("en-US", { maximumFractionDigits: 0 });

export function generate(r, level) {
  const cuts = r.pick(BAND_SETS);
  const bands = cuts.map((lo, i) => ({ id: i + 1, lo, hi: i + 1 < cuts.length ? cuts[i + 1] : null }));
  bands.forEach((b) => { b.label = b.hi === null ? money(b.lo) + "+" : money(b.lo) + "–" + money(b.hi); });
  // The top band stays empty in this sample (it must still be reported).
  const usable = bands.slice(0, -1);

  const plans = [];
  const pays = [];
  let pid = 30001 + r.int(0, 300) * 10, payId = 800001 + r.int(0, 500) * 10;
  const pay = (plan, cents, t, kind, status = "posted") => pays.push({ id: payId++, plan: plan.id, cents, t, kind, status });

  const nPlans = r.int(16, 22) + level * 2;
  for (let i = 0; i < nPlans; i++) {
    const band = r.pick(usable);
    let amount = r.int(Math.max(band.lo, 2000), band.hi - 1);
    amount = Math.max(amount - (amount % 4), band.lo + 4);           // whole instalments
    if (amount >= band.hi) amount = band.lo + 4;
    const start = r.int(0, 60) * DAY + r.int(8, 20) * 3600 + r.int(0, 3599);
    const startDay = Math.floor(start / DAY);
    const dues = [0, 14, 28, 42].map((k) => startDay + k);               // this exercise's schedule: 4 instalments, two weeks apart
    const plan = { id: pid++, amount, start, finalDue: dayStr(dues[3]), finalDueDay: dues[3], zone: level === 3 ? r.pick(ZONES) : "UTC", status: "active" };
    plans.push(plan);
    const inst = amount / 4;
    const at = (d) => d * DAY + r.int(9, 18) * 3600 + r.int(0, 3599);    // a time well inside the UTC day
    pay(plan, inst, start, "scheduled");
    const style = r.pick(["schedule", "schedule", "early", "early", "extra_small", "stopped"]);
    if (style === "schedule") {
      for (const d of dues.slice(1)) pay(plan, inst, at(d), "scheduled");
    } else if (style === "early") {
      const k = r.int(1, 2);                                              // scheduled instalments paid before the extra one
      for (const d of dues.slice(1, 1 + k)) pay(plan, inst, at(d), "scheduled");
      const left = amount - inst * (1 + k);
      const when = r.int(dues[k] + 1, dues[3] - 1);
      pay(plan, left, at(when), "extra");
    } else if (style === "extra_small") {
      const extra = Math.min(inst - 1, r.int(1, 30) * 100);
      pay(plan, inst, at(dues[1]), "scheduled");
      pay(plan, extra, at(r.int(dues[1] + 1, dues[2] - 1)), "extra");
      pay(plan, inst - extra, at(dues[2]), "scheduled");
      pay(plan, inst, at(dues[3]), "scheduled");
    } else {
      pay(plan, inst, at(dues[1]), "scheduled");
      if (r.chance(0.5)) pay(plan, Math.min(inst - 1, r.int(1, 20) * 100), at(dues[1] + 3), "extra");
    }
  }

  // Boundaries (Hard+): purchases exactly on a band's lower bound; a last payment in the final
  // seconds before the due date's UTC midnight (early) and one just after it (not early).
  const special = (amount, lastAt) => {
    const startDay = r.int(0, 50);
    const plan = { id: pid++, amount, start: startDay * DAY + 36000, finalDue: dayStr(startDay + 42), finalDueDay: startDay + 42, zone: level === 3 ? r.pick(ZONES) : "UTC", status: "active" };
    plans.push(plan);
    pay(plan, amount / 2, plan.start, "scheduled");
    pay(plan, amount / 2, lastAt(plan), "extra");
    return plan;
  };
  if (level >= 2) {
    for (const b of r.sample(usable.filter((x) => x.lo > 0), 2)) special(b.lo, (p) => (p.finalDueDay - 5) * DAY + 40000);
    special(usable[1].lo + 200, (p) => p.finalDueDay * DAY - r.int(1, 30));        // 23:59:xx the day before: early
    special(usable[1].lo + 400, (p) => p.finalDueDay * DAY + r.int(0, 30));        // 00:00:xx on the due date: not early
    // Cancelled plans: excluded with their payments.
    for (const p of r.sample(plans.filter((x) => pays.some((y) => y.plan === x.id && y.kind === "extra")), 2)) p.status = "cancelled";
    // Reversed payments: an extra payment that paid a plan off, reversed (the plan is not paid off),
    // and a reversed duplicate of a scheduled payment (the plan is unaffected).
    const extras = pays.filter((y) => y.kind === "extra" && plans.find((p) => p.id === y.plan).status === "active");
    if (extras.length) r.pick(extras).status = "reversed";
    const sched = pays.filter((y) => y.kind === "scheduled" && y.t > plans.find((p) => p.id === y.plan).start);
    const dup = r.pick(sched);
    pays.push({ ...dup, id: payId++, t: dup.t + 60, status: "reversed" });
  }
  if (level === 3) {
    // Local dates: a payment at 03:00 UTC on the due date is still the day before in Los Angeles
    // (early); one at 22:00 UTC the day before is already the due date in Tokyo (not early).
    const a = special(usable[2].lo + 600, (p) => p.finalDueDay * DAY + 3 * 3600 + r.int(0, 600));
    a.zone = "America/Los_Angeles";
    const b = special(usable[2].lo + 800, (p) => p.finalDueDay * DAY - 2 * 3600 - r.int(0, 600));
    b.zone = "Asia/Tokyo";
  }
  pays.sort((x, y) => x.t - y.t || x.id - y.id);

  const report = (o) => {
    const out = [];
    const bandOf = (amt) => bands.find((b) => amt >= b.lo && (b.hi === null || (o.hiInclusive ? amt <= b.hi : amt < b.hi)));
    const agg = new Map(bands.map((b) => [b.id, { plans: 0, off: 0, early: 0, extras: 0, extraCents: 0 }]));
    for (const p of plans) {
      if (p.status === "cancelled" && !o.countCancelled) continue;
      const b = bandOf(p.amount);
      if (!b) continue;
      const mine = pays.filter((y) => y.plan === p.id && (y.status === "posted" || o.countReversed));
      const paid = mine.reduce((s, y) => s + y.cents, 0);
      const c = agg.get(b.id);
      c.plans += 1;
      const extras = mine.filter((y) => y.kind === "extra");
      c.extras += extras.length;
      c.extraCents += extras.reduce((s, y) => s + y.cents, 0);
      if (paid >= p.amount) {
        c.off += 1;
        const last = Math.max(...mine.map((y) => y.t));
        const d = o.utc || p.zone === "UTC" ? dayStr(Math.floor(last / DAY)) : localDate(last, p.zone);
        if (o.inclusive ? d <= p.finalDue : d < p.finalDue) c.early += 1;
      }
    }
    for (const b of bands) {
      const c = agg.get(b.id);
      if (o.inner && c.plans === 0) continue;
      out.push([b.id, b.label, c.plans, c.off, c.early, c.plans ? r4(c.early, c.plans) : null, c.extras, c.extraCents]);
    }
    return out;
  };
  const rows = report({});
  const same = (x) => JSON.stringify(x) === JSON.stringify(rows);

  const diagnostics = [
    { message: "Bands with no plans were dropped. Every band in amount_bands is reported, with zeros and a NULL share when it has no plans.", rows: report({ inner: true }) },
    { message: "A plan whose last payment was on the final due date was counted as early. Early means strictly before the final due date.", rows: report({ inclusive: true }) },
  ];
  if (level >= 2) {
    diagnostics.push({ message: "Reversed payments were counted. A reversed payment neither pays the plan down nor counts as an extra payment.", rows: report({ countReversed: true }) });
    diagnostics.push({ message: "Cancelled plans were counted. They are excluded with all their payments.", rows: report({ countCancelled: true }) });
    diagnostics.push({ message: "A purchase exactly on a band's upper bound was put in the lower band (BETWEEN is inclusive at both ends). The upper bound is exclusive.", rows: report({ hiInclusive: true }) });
  }
  if (level === 3) {
    diagnostics.push({ message: "The last payment's UTC date was compared with the due date. The due date is a date in the plan's own time zone: compare the payment's local date.", rows: report({ utc: true }) });
  }

  const bandCols = ["band_id", "label", "lower_cents", "upper_cents"];
  const bandRows = bands.map((b) => [b.id, b.label, b.lo, b.hi]);
  const planCols = ["plan_id", "purchase_cents", "purchased_at", "final_due_date", "status"].concat(level === 3 ? ["time_zone"] : []);
  const planRows = plans
    .slice()
    .sort((a, b) => a.id - b.id)
    .map((p) => [p.id, p.amount, stamp(p.start), p.finalDue, p.status].concat(level === 3 ? [p.zone] : []));
  const payCols = ["payment_id", "plan_id", "amount_cents", "paid_at", "kind", "status"];
  const payRows = pays.map((y) => [y.id, y.plan, y.cents, stamp(y.t), y.kind, y.status]);

  const setup =
    "SET TIME ZONE 'UTC';\n" +
    "CREATE TABLE amount_bands (\n  band_id INT PRIMARY KEY,\n  label TEXT NOT NULL,\n  lower_cents BIGINT NOT NULL,\n  upper_cents BIGINT\n);\n" +
    "CREATE TABLE paylater_plans (\n  plan_id INT PRIMARY KEY,\n  purchase_cents BIGINT NOT NULL,\n  purchased_at TIMESTAMPTZ NOT NULL,\n  final_due_date DATE NOT NULL,\n  status TEXT NOT NULL CHECK (status IN ('active','cancelled'))" + (level === 3 ? ",\n  time_zone TEXT NOT NULL" : "") + "\n);\n" +
    "CREATE TABLE plan_payments (\n  payment_id INT PRIMARY KEY,\n  plan_id INT NOT NULL REFERENCES paylater_plans,\n  amount_cents BIGINT NOT NULL,\n  paid_at TIMESTAMPTZ NOT NULL,\n  kind TEXT NOT NULL CHECK (kind IN ('scheduled','extra')),\n  status TEXT NOT NULL CHECK (status IN ('posted','reversed'))\n);\n" +
    insertSQL("amount_bands", bandCols, bandRows) + insertSQL("paylater_plans", planCols, planRows) + insertSQL("plan_payments", payCols, payRows);

  return {
    vars: {
      plans: plans.length,
      payments: pays.length,
      tz_sql: level === 3 ? "pl.time_zone" : "'UTC'",
      status_rule: level === 1
        ? "Every plan is `active` and every payment `posted`."
        : "Plans with `status = 'cancelled'` are excluded with all their payments. A payment with `status = 'reversed'` was undone: it counts nowhere.",
      date_rule: level === 3
        ? "`final_due_date` is a date in the plan's own `time_zone`: compare the local date of the last payment (`paid_at AT TIME ZONE time_zone`)."
        : "Dates are UTC: compare the UTC date of the last payment.",
      date_answer: level === 3
        ? "In the plan's own time zone: the due date is a local date, so convert `paid_at` with `AT TIME ZONE time_zone` before taking the date."
        : "In UTC in this sample.",
    },
    setup,
    tables: [
      { name: "amount_bands", columns: bandCols, rows: bandRows },
      { name: "paylater_plans", columns: planCols, rows: planRows },
      { name: "plan_payments", columns: payCols, rows: payRows },
    ],
    expected: { columns: ["band_id", "label", "plans", "paid_off", "paid_off_early", "early_share", "extra_payments", "extra_cents"], rows },
    diagnostics: diagnostics.filter((d) => !same(d.rows)),
  };
}
