/* ADB-L1-01 — Generative credits: monthly use against a plan allowance, and when each account ran out (SQL).
   Simulated practice scenario. All data is generated from the seed. The plan names, allowances and
   the charging rule are this exercise's hypothetical rules, not any real plan's (check current docs).

   Contract: see docs/COMPANY-INTERVIEW-LOOPS.md § Executable templates (sql).
   expected comes from the JavaScript oracle below, written independently of the evaluator's SQL.
   level: 1 Medium (one month; failed generations not charged; reaching the allowance exactly runs out)
          2 Hard (+ two UTC months with generations in the last and first minute, two generations of one
            account at the same second, broken by gen_id)
          3 Very Hard (+ plan changes: the allowance is the plan in effect at the month's first instant,
            an account that started mid-month uses its first plan, a change exactly at midnight counts) */
import { insertSQL, ts, pad2 } from "../../js/rng.js";

export const kind = "sql";

const MONTHS = [{ key: "2026-09", days: 30, off: 0 }, { key: "2026-10", days: 31, off: 30 * 86400 }];
const CREDITS = [1, 2, 4, 5, 5, 10, 10];
const cmp = (x, y) => (x < y ? -1 : x > y ? 1 : 0);

// Seconds since 2026-09-01 00:00:00 UTC -> "YYYY-MM-DD HH:MM:SS+00" (August, September, October only).
function stampAbs(abs) {
  if (abs < 0) { const s = abs + 31 * 86400; return ts(`2026-08-${pad2(Math.floor(s / 86400) + 1)}`, s % 86400); }
  if (abs < 30 * 86400) return ts(`2026-09-${pad2(Math.floor(abs / 86400) + 1)}`, abs % 86400);
  const s = abs - 30 * 86400;
  return ts(`2026-10-${pad2(Math.floor(s / 86400) + 1)}`, s % 86400);
}
const monthOf = (stamp) => stamp.slice(0, 7);
const nextMonth = (key) => (key === "2026-08" ? "2026-09" : key === "2026-09" ? "2026-10" : "2026-11");

export function generate(r, level) {
  const plans = { starter: r.pick([15, 20, 25]), standard: r.pick([30, 40, 50]), team: r.pick([60, 80]) };
  const planNames = Object.keys(plans);
  const nAcc = level === 1 ? 4 : level === 2 ? 5 : 6;
  const idSet = new Set();
  while (idSet.size < nAcc) idSet.add("acct_" + r.int(1000, 9999));
  const accIds = [...idSet].sort();
  const months = level === 1 ? [MONTHS[0]] : MONTHS;

  // Plan history: (account, plan, effective abs seconds). accounts.plan is the latest plan.
  const changes = [];
  const created = {};
  accIds.forEach((a, i) => {
    let c0 = -r.int(2, 25) * 86400 - r.int(0, 86399);                 // created in August
    if (level === 3 && i === 1) c0 = r.int(8, 15) * 86400 + r.int(0, 86399); // created mid-September
    created[a] = c0;
    const p0 = level === 3 && i === 0 ? "starter" : r.pick(i === 0 ? ["starter", "standard"] : planNames);
    changes.push({ a, plan: p0, at: c0 });
    if (level === 3) {
      if (i === 0) changes.push({ a, plan: "team", at: r.int(10, 20) * 86400 + r.int(0, 86399) }); // mid-September upgrade
      if (i === 2) changes.push({ a, plan: planNames.find((p) => p !== p0), at: 30 * 86400 });      // exactly 2026-10-01 00:00:00
      if (i >= 3 && r.chance(0.5)) changes.push({ a, plan: planNames.find((p) => p !== p0), at: 30 * 86400 + r.int(10, 20) * 86400 }); // mid-October
    }
  });
  const accPlan = {};
  for (const a of accIds) {
    const cs = changes.filter((c) => c.a === a).sort((x, y) => x.at - y.at);
    accPlan[a] = cs[cs.length - 1].plan;
  }
  // The plan for a month: in effect at the month's first instant, else the account's first plan in the month.
  const planFor = (a, key, current) => {
    if (current) return accPlan[a];
    const start = key + "-01 00:00:00+00", end = nextMonth(key) + "-01 00:00:00+00";
    const cs = changes.filter((c) => c.a === a).map((c) => ({ plan: c.plan, s: stampAbs(c.at) })).sort((x, y) => cmp(x.s, y.s));
    const before = cs.filter((c) => c.s <= start);
    if (before.length) return before[before.length - 1].plan;
    const inMonth = cs.filter((c) => c.s < end);
    return inMonth.length ? inMonth[0].plan : null;
  };

  // Generations, built per account and month around the allowance.
  const gens = [];   // {a, abs, credits, status}
  const modesNeeded = ["exact", "failedonly"];
  if (level >= 2) modesNeeded.push("peers");
  const cells = [];
  for (const m of months) for (const a of accIds) cells.push({ a, m });
  const order = r.shuffle(cells.map((_, i) => i));
  const mode = new Array(cells.length).fill(null);
  modesNeeded.forEach((md, k) => { mode[order[k]] = md; });
  for (let i = 0; i < cells.length; i++) if (!mode[i]) mode[i] = r.pick(["over", "under", "exact", "over"]);
  // Hard+: one account whose generations sit at the end of September and the start of October.
  const boundaryAcc = level >= 2 ? accIds.find((a) => cells.every((c, i) => c.a !== a || (mode[i] !== "peers" && mode[i] !== "failedonly"))) : null;

  cells.forEach(({ a, m }, i) => {
    const allowance = plans[planFor(a, m.key)];
    const md = mode[i];
    const seq = [];         // succeeded credits in time order; a pair at one second is marked
    let pairAt = -1, sum = 0;
    if (md === "exact") {
      while (sum < allowance) { const c = Math.min(r.pick(CREDITS), allowance - sum); seq.push(c); sum += c; }
      for (let k = r.int(1, 3); k > 0; k--) seq.push(r.pick(CREDITS));
    } else if (md === "over") {
      while (sum < allowance) { const c = r.pick(CREDITS); seq.push(c); sum += c; }
      for (let k = r.int(0, 2); k > 0; k--) seq.push(r.pick(CREDITS));
    } else if (md === "under") {
      for (let k = r.int(2, 5); k > 0; k--) { const c = Math.min(r.pick(CREDITS), allowance - 1 - sum); if (c <= 0) break; seq.push(c); sum += c; }
    } else if (md === "peers") {
      while (allowance - sum > 12) { const c = Math.min(r.pick(CREDITS), allowance - sum - 8); seq.push(c); sum += c; }
      const half = Math.ceil((allowance - sum) / 2);   // each alone stays below, together they reach it
      pairAt = seq.length;
      seq.push(half, half);
      for (let k = r.int(0, 2); k > 0; k--) seq.push(r.pick(CREDITS));
    }
    const lo = Math.max(0, created[a] - m.off + 120);
    const hi = (m.days - 1) * 86400;
    const nTimes = seq.length - (pairAt >= 0 ? 1 : 0);
    const used = new Set();
    while (used.size < nTimes) used.add(r.int(lo, hi - 1));
    let times = [...used].sort((x, y) => x - y);
    if (pairAt >= 0) times.splice(pairAt + 1, 0, times[pairAt]);
    if (a === boundaryAcc && times.length) {
      if (m.off === 0) times[times.length - 1] = m.days * 86400 - r.int(1, 59);
      else times[0] = r.int(0, 59);
    }
    seq.forEach((c, k) => gens.push({ a, abs: m.off + times[k], credits: c, status: "succeeded" }));
    const nFailed = md === "failedonly" ? r.int(1, 3) : r.int(0, 3);
    for (let k = 0; k < nFailed; k++) gens.push({ a, abs: m.off + r.int(lo, hi - 1), credits: r.pick(CREDITS), status: "failed" });
  });
  // gen_id does not follow time order: ids are handed out in a shuffled order.
  let gid = 400000 + r.int(0, 90000);
  for (const g of r.shuffle(gens)) { gid += r.int(1, 9); g.id = gid; g.stamp = stampAbs(g.abs); }

  const solve = (o = {}) => {
    const groups = new Map();
    for (const g of gens) {
      if (g.status !== "succeeded" && !o.chargeFailed) continue;
      const key = monthOf(o.shift ? stampAbs(g.abs - 7 * 3600) : g.stamp);
      const k = key + "|" + g.a;
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(g);
    }
    const rows = [];
    for (const [k, list] of [...groups.entries()].sort((x, y) => cmp(x[0], y[0]))) {
      const [key, a] = k.split("|");
      const plan = planFor(a, key, o.current);
      const allowance = plan ? plans[plan] : null;
      list.sort((x, y) => cmp(x.stamp, y.stamp) || x.id - y.id);
      let run = 0, out = null;
      const used = list.reduce((s, g) => s + g.credits, 0);
      for (let j = 0; j < list.length; j++) {
        // o.peers: a running sum that includes every generation at the same second (a RANGE frame).
        let s;
        if (o.peers) s = list.filter((g) => g.stamp <= list[j].stamp).reduce((t, g) => t + g.credits, 0);
        else s = (run += list[j].credits);
        if (out === null && allowance !== null && (o.strict ? s > allowance : s >= allowance)) out = list[j];
      }
      rows.push([a, key + "-01", allowance, list.length, used, out ? out.id : null, out ? out.stamp : null]);
    }
    return rows.sort((x, y) => cmp(x[1], y[1]) || cmp(x[0], y[0]));
  };
  const rows = solve();

  const diagnostics = [
    { message: "Failed generations were charged. Only generations with status 'succeeded' use credits, and an account-month with only failed generations has no row.", rows: solve({ chargeFailed: true }) },
    { message: "Reaching the allowance exactly was not treated as running out. The account runs out at the first generation whose running total is at least the allowance.", rows: solve({ strict: true }) },
  ];
  if (level >= 2) {
    diagnostics.push({ message: "Generations at the same second were summed together (a running SUM ordered by created_ts only uses a RANGE frame). Order the running total by created_ts, gen_id so each generation adds its own credits.", rows: solve({ peers: true }) });
    diagnostics.push({ message: "Months were not taken in UTC. A generation at 00:00:30 UTC on the 1st belongs to the new month.", rows: solve({ shift: true }) });
  }
  if (level === 3) diagnostics.push({ message: "The current plan (accounts.plan) was used for every month. The allowance is the plan in effect at the month's first instant, from plan_changes.", rows: solve({ current: true }) });

  const pCols = ["plan", "monthly_credits"];
  const pRows = planNames.map((p) => [p, plans[p]]);
  const aCols = ["account_id", "created_ts", "plan"];
  const aRows = accIds.map((a) => [a, stampAbs(created[a]), accPlan[a]]);
  const cCols = ["account_id", "plan", "effective_ts"];
  const cRows = changes.slice().sort((x, y) => cmp(x.a, y.a) || x.at - y.at).map((c) => [c.a, c.plan, stampAbs(c.at)]);
  const gCols = ["gen_id", "account_id", "created_ts", "credits", "status"];
  const gRows = gens.slice().sort((x, y) => x.id - y.id).map((g) => [g.id, g.a, g.stamp, g.credits, g.status]);
  const setup =
    "SET TIME ZONE 'UTC';\n" +
    "CREATE TABLE plans (\n  plan TEXT PRIMARY KEY,\n  monthly_credits INT NOT NULL\n);\n" +
    "CREATE TABLE accounts (\n  account_id TEXT PRIMARY KEY,\n  created_ts TIMESTAMPTZ NOT NULL,\n  plan TEXT NOT NULL REFERENCES plans(plan)\n);\n" +
    "CREATE TABLE plan_changes (\n  account_id TEXT NOT NULL REFERENCES accounts(account_id),\n  plan TEXT NOT NULL REFERENCES plans(plan),\n  effective_ts TIMESTAMPTZ NOT NULL,\n  PRIMARY KEY (account_id, effective_ts)\n);\n" +
    "CREATE TABLE generations (\n  gen_id BIGINT PRIMARY KEY,\n  account_id TEXT NOT NULL REFERENCES accounts(account_id),\n  created_ts TIMESTAMPTZ NOT NULL,\n  credits INT NOT NULL CHECK (credits > 0),\n  status TEXT NOT NULL CHECK (status IN ('succeeded', 'failed'))\n);\n" +
    insertSQL("plans", pCols, pRows) + insertSQL("accounts", aCols, aRows) + insertSQL("plan_changes", cCols, cRows) + insertSQL("generations", gCols, gRows);

  return {
    vars: {
      accounts: accIds.length,
      generations: gens.length,
      month_rule: level === 1
        ? "Every generation in this sample is in September 2026, and no account has two generations at the same second."
        : "Months are UTC calendar months. Two generations of one account can share a `created_ts`; order them by `gen_id`.",
      plan_rule: level === 3
        ? "Accounts change plans. A month's allowance comes from the plan in `plan_changes` in effect at the month's first instant (`effective_ts` at or before it); a change during the month applies from the next month. An account created during the month uses its first plan. `accounts.plan` is only the current plan."
        : "In this sample each account has one row in `plan_changes`, from before the data starts, and it matches `accounts.plan`.",
    },
    setup,
    tables: [
      { name: "plans", columns: pCols, rows: pRows },
      { name: "accounts", columns: aCols, rows: aRows },
      { name: "plan_changes", columns: cCols, rows: cRows },
      { name: "generations", columns: gCols, rows: gRows },
    ],
    expected: { columns: ["account_id", "month", "allowance", "charged_generations", "credits_used", "ran_out_gen", "ran_out_at"], rows },
    diagnostics: diagnostics.filter((d) => JSON.stringify(d.rows) !== JSON.stringify(rows)),
  };
}
