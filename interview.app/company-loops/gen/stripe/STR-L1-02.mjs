/* STR-L1-02 — Refund-cap violations: the first refund that pushes a charge over (SQL).
   Simulated practice scenario. All data is generated from the seed.

   Contract: see docs/COMPANY-INTERVIEW-LOOPS.md § Executable templates.
   level: 1 Medium (several partial refunds per charge, all succeeded)
          2 Hard (+ failed refunds, partially captured charges: the cap is amount_captured)
          3 Very Hard (+ refunds racing at the same timestamp, pending and canceled refunds) */
import { insertSQL, ts } from "../../js/rng.js";

export const kind = "sql";

const MERCHANTS = ["acct_alder_audio", "acct_birch_bikes", "acct_coral_cosmetics", "acct_drift_surf", "acct_elm_electronics", "acct_fern_florist"];
const BASES = ["2026-08-31", "2026-09-09", "2026-09-17", "2026-09-26", "2026-10-03"];

export function generate(r, level) {
  const day0 = r.pick(BASES);
  const merchants = r.sample(MERCHANTS, 3);
  const nCharges = (level === 1 ? 6 : level === 2 ? 8 : 10) + r.int(0, 2);

  // Plans: at least two breaches and one charge refunded to exactly its cap.
  const plans = ["breach", "breach", "exact"];
  if (level >= 2) plans.push("failed_would_breach", "between");
  if (level === 3) plans.push("race", "pending_breach");
  while (plans.length < nCharges) plans.push(r.pick(["under", "under", "none", "breach", "exact"]));
  const order = r.shuffle(plans);

  const chargeIds = r.shuffle([...Array(90)].map((_, i) => 1000 + i * 37 + r.int(0, 30))).slice(0, order.length);
  const refundPool = r.shuffle([...Array(400)].map((_, i) => 20000 + i * 11 + r.int(0, 9)));
  let rp = 0;
  const nextRefundId = () => "re_" + refundPool[rp++];

  const charges = [];
  const refunds = [];
  order.forEach((plan, i) => {
    const amount = r.int(20, 900) * 100 + r.int(0, 99);
    let captured = amount;
    if (level >= 2 && (plan === "between" || r.chance(0.35))) captured = r.int(Math.ceil(amount * 0.5), amount - 1);
    const ch = { id: "ch_" + chargeIds[i], merchant: r.pick(merchants), currency: r.pick(["usd", "eur", "gbp"]), amount, captured, abs: r.int(0, 60000) };
    charges.push(ch);
    let t = ch.abs + r.int(600, 20000);
    const add = (amt, status = "succeeded", same = false) => {
      if (!same) t += r.int(60, 40000);
      refunds.push({ id: nextRefundId(), charge: ch.id, amount: amt, status, abs: t });
    };
    const cap = captured;
    const breachRun = () => {
      let cum = 0;
      while (cum <= cap) {
        const a = r.int(Math.ceil(cap * 0.15), Math.ceil(cap * 0.6));
        add(a);
        cum += a;
      }
      if (r.chance(0.5)) add(r.int(100, Math.ceil(cap * 0.3)));     // later refunds are over too: report only the first
    };
    if (plan === "none") return;
    if (plan === "under") {
      const k = r.int(1, 2);
      for (let j = 0; j < k; j++) add(r.int(100, Math.floor(cap / 3)));
    } else if (plan === "exact") {
      const a = r.int(Math.ceil(cap * 0.2), Math.floor(cap * 0.6));
      add(a);
      add(cap - a);                                                   // exactly the cap: not a violation
    } else if (plan === "breach") {
      breachRun();
    } else if (plan === "between") {
      // Over the captured amount but within the authorized amount.
      const total = r.int(captured + 1, amount);
      const a = r.int(Math.ceil(total * 0.3), Math.floor(total * 0.7));
      add(a);
      add(total - a);
    } else if (plan === "failed_would_breach") {
      const a = r.int(Math.ceil(cap * 0.4), Math.floor(cap * 0.7));
      add(a);
      add(cap - a + r.int(1, 2000), "failed");                       // would breach, but never moved money
      add(r.int(1, cap - a));                                         // keeps the total at or under the cap
    } else if (plan === "race") {
      const a = r.int(Math.ceil(cap * 0.3), Math.floor(cap * 0.6));
      add(a);
      const b = r.int(Math.ceil((cap - a) * 0.4), cap - a);          // b alone does not breach…
      const c = cap - a - b + r.int(1, 3000);                         // …b + c does
      add(b);
      add(c, "succeeded", true);                                      // same created_at as b
    } else if (plan === "pending_breach") {
      const a = r.int(Math.ceil(cap * 0.5), Math.floor(cap * 0.8));
      add(a);
      add(r.int(1, 1500), "canceled");
      add(cap - a + r.int(1, 2500), "pending");                       // pending refunds count
    }
  });

  const counts = (s, o) => s === "succeeded" || (s === "pending" && !o.succeededOnly) || (o.countFailed && (s === "failed" || s === "canceled"));

  const compute = (o = {}) => {
    const rows = [];
    for (const ch of charges) {
      const cap = o.amountCap ? ch.amount : ch.captured;
      const rs = refunds.filter((x) => x.charge === ch.id && counts(x.status, o)).sort((a, b) => a.abs - b.abs || cmp(a.id, b.id));
      let cum = 0;
      for (let i = 0; i < rs.length; i++) {
        cum += rs[i].amount;
        let shown = cum;
        if (o.rangePeers) for (let j = i + 1; j < rs.length && rs[j].abs === rs[i].abs; j++) shown += rs[j].amount;
        if (o.gte ? shown >= cap : shown > cap) {
          rows.push({ abs: rs[i].abs, row: [ch.id, ch.merchant, rs[i].id, absTs(day0, rs[i].abs), shown, cap, shown - cap] });
          if (!o.all) break;
        }
      }
    }
    return rows.sort((a, b) => a.abs - b.abs || cmp(a.row[0], b.row[0]) || cmp(a.row[2], b.row[2])).map((x) => x.row);
  };
  const rows = compute();

  const diagnostics = [
    { message: "Every refund above the cap was reported. Report one row per charge: the first refund that pushed the running total over.", rows: compute({ all: true }) },
    { message: "`>=` was used. A charge refunded to exactly its captured amount is fully refunded, not over the cap: use a strict `>`.", rows: compute({ gte: true }) },
  ];
  if (level >= 2) {
    diagnostics.push({ message: "Failed (or canceled) refunds were counted in the running total. They never moved money; filter them out before the window function.", rows: compute({ countFailed: true }) });
    diagnostics.push({ message: "The cap was the charge's `amount`. A partially captured charge can only be refunded up to `amount_captured`.", rows: compute({ amountCap: true }) });
  }
  if (level === 3) {
    diagnostics.push({ message: "Refunds sharing a timestamp got the same running total: ORDER BY created_at alone uses the default RANGE frame, which adds all peers at once. Order by (created_at, refund_id) with a ROWS frame.", rows: compute({ rangePeers: true }) });
    diagnostics.push({ message: "Pending refunds were left out. A pending refund is committed against the charge and counts toward the cap.", rows: compute({ succeededOnly: true }) });
  }

  const chCols = ["charge_id", "merchant_id", "currency", "amount", "amount_captured", "created_at"];
  const chRows = charges.map((c) => [c.id, c.merchant, c.currency, c.amount, c.captured, absTs(day0, c.abs)]).sort((a, b) => cmp(a[5], b[5]) || cmp(a[0], b[0]));
  const reCols = ["refund_id", "charge_id", "amount", "status", "created_at"];
  const reRows = refunds.map((x) => [x.id, x.charge, x.amount, x.status, absTs(day0, x.abs)]).sort((a, b) => cmp(a[4], b[4]) || cmp(a[0], b[0]));

  const statuses = level === 1 ? "'succeeded'" : level === 2 ? "'succeeded','failed'" : "'succeeded','pending','failed','canceled'";
  const setup =
    "SET TIME ZONE 'UTC';\n" +
    "CREATE TABLE charges (\n  charge_id TEXT PRIMARY KEY,\n  merchant_id TEXT NOT NULL,\n  currency TEXT NOT NULL,\n  amount BIGINT NOT NULL,            -- authorized, minor units\n  amount_captured BIGINT NOT NULL,   -- minor units; <= amount\n  created_at TIMESTAMPTZ NOT NULL\n);\n" +
    `CREATE TABLE refunds (\n  refund_id TEXT PRIMARY KEY,\n  charge_id TEXT NOT NULL REFERENCES charges(charge_id),\n  amount BIGINT NOT NULL CHECK (amount > 0),   -- minor units\n  status TEXT NOT NULL CHECK (status IN (${statuses})),\n  created_at TIMESTAMPTZ NOT NULL\n);\n` +
    insertSQL("charges", chCols, chRows) + insertSQL("refunds", reCols, reRows);

  return {
    vars: {
      n_refunds: refunds.length,
      status_rule:
        level === 1
          ? "Every refund in the table succeeded."
          : level === 2
            ? "Refunds with `status = 'failed'` never moved money and do not count."
            : "Refunds with `status` 'failed' or 'canceled' never moved money and do not count; 'succeeded' and 'pending' refunds do.",
      cap_rule:
        level === 1
          ? "Every charge was captured in full (`amount_captured = amount`)."
          : "Some charges were captured only in part: the cap is `amount_captured`, not `amount`.",
      tie_rule:
        level === 3
          ? "Two refunds on the same charge can share a `created_at` to the second; order them by `refund_id` to break the tie."
          : "Refunds on the same charge have distinct `created_at` values; order them by (`created_at`, `refund_id`) anyway.",
    },
    setup,
    tables: [
      { name: "charges", columns: chCols, rows: chRows },
      { name: "refunds", columns: reCols, rows: reRows },
    ],
    expected: { columns: ["charge_id", "merchant_id", "breach_refund_id", "breached_at", "refunded_total", "amount_captured", "excess"], rows },
    diagnostics: diagnostics.filter((d) => JSON.stringify(d.rows) !== JSON.stringify(rows)),
  };
}

const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
function absTs(day0, abs) {
  const d = new Date(day0 + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + Math.floor(abs / 86400));
  return ts(d.toISOString().slice(0, 10), abs % 86400);
}
