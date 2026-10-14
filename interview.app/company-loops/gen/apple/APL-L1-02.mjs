/* APL-L1-02 — Billing retry recovery by plan and storefront (SQL).
   Simulated practice scenario. All data is generated from the seed. The retry and
   grace-period rules are this exercise's own, stated in the problem; real stores'
   rules change, so the text says to check current documentation.

   Contract: see docs/COMPANY-INTERVIEW-LOOPS.md § Executable templates (sql).
   level: 1 Medium (one retry episode per subscription: opened by the first failed renewal,
            closed by the next renewal or expiry; recovered within N days of entering retry;
            grace-period recoveries counted inside the N days)
          2 Hard (+ several episodes per subscription, renewals outside episodes, a renewal
            after expiry is a new purchase, recoveries exactly on the N-day and grace boundaries)
          3 Very Hard (+ the plan can change between episodes: the episode's plan is the one on
            its opening failure; episodes younger than N days on as_of are left out) */
import { insertSQL } from "../../js/rng.js";

export const kind = "sql";

const PLANS = ["family_annual", "family_monthly", "individual_annual", "individual_monthly", "student_monthly", "voice_monthly"];
const STORES = ["CA", "DE", "GB", "JP", "MX", "US"];
const BASE = Date.UTC(2026, 2, 2);                 // 2026-03-02 00:00:00 UTC
const DAY = 86400;
const AS_OF_T = 200 * DAY;                         // 2026-09-18 00:00:00 UTC
const pad = (n) => String(n).padStart(2, "0");
function at(t) {
  const d = new Date(BASE + t * 1000);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}+00`;
}

export function generate(r, level) {
  const nDays = r.pick([30, 45, 60]);
  const N = nDays * DAY;
  const planIds = r.sample(PLANS, 3).sort();
  const grace = new Map(planIds.map((p, i) => [p, i === 0 ? 0 : r.pick([3, 6, 16])]));
  if ([...grace.values()].every((g) => g === 0)) grace.set(planIds[1], 6);
  const stores = r.sample(STORES, level === 1 ? 2 : 3).sort();
  const nSubs = 12 + 4 * level;
  // Below Very Hard every episode is at least N days old on as_of.
  const lastStart = level === 3 ? AS_OF_T - 2 * DAY : AS_OF_T - N - DAY;

  const subs = [];                // {id, store}
  let events = [];                // {sub, plan, type, t}
  const ids = new Set();
  while (ids.size < nSubs) ids.add("sub_" + r.int(100000, 999999));
  const subIds = [...ids];

  for (let si = 0; si < subIds.length; si++) {
    const sub = subIds[si];
    subs.push({ id: sub, store: r.pick(stores) });
    let plan = r.pick(planIds);
    let t = r.int(0, 20 * DAY) + r.int(0, DAY - 1);
    events.push({ sub, plan, type: "renewed", t });
    const nEp = si === 0 ? 1 : level === 1 ? (r.chance(0.85) ? 1 : 0) : r.int(1, 3);
    for (let e = 0; e < nEp; e++) {
      // Ordinary renewals before the failure: outside any episode, they recover nothing.
      const gap = r.int(10, 50) * DAY + r.int(0, DAY - 1);
      if (r.chance(0.5)) events.push({ sub, plan, type: "renewed", t: t + Math.floor(gap / 2) });
      if (level === 3 && e > 0 && r.chance(0.4)) plan = r.pick(planIds.filter((p) => p !== plan)); // changed plan
      const f = t + gap;
      if (f > lastStart) break;
      events.push({ sub, plan, type: "renewal_failed", t: f });
      const g = grace.get(plan) * DAY;
      const u = r.next();
      let close = null, type = null;
      if (u < 0.2 && g > 0) { close = f + (level >= 2 && r.chance(0.4) ? g : r.int(3600, g)); type = "renewed"; }
      else if (u < 0.5) { close = f + (level >= 2 && r.chance(0.35) ? r.pick([N, N + 1]) : r.int(g + 3600, N - 1)); type = "renewed"; }
      else if (u < 0.65) { close = f + N + r.int(3600, 20 * DAY); type = "renewed"; }               // recovered, but late
      else if (u < 0.9) { close = f + r.int(7 * DAY, N + 5 * DAY); type = "expired"; }
      // else: still in retry at the end of the data
      const last = e === nEp - 1;
      if (close === null && !last) { close = f + r.int(7 * DAY, N); type = "expired"; }
      // Failed retry attempts inside the episode.
      const until = close === null ? Math.min(f + N, AS_OF_T - 1) : close;
      const nRetry = r.int(0, 3);
      for (let k = 1; k <= nRetry; k++) {
        const rt = f + Math.floor(((until - f) * k) / (nRetry + 1));
        if (rt > f && rt < until) events.push({ sub, plan, type: "renewal_failed", t: rt });
      }
      if (close === null) break;
      events.push({ sub, plan, type, t: close });
      t = close;
      // Hard+: after expiry the subscriber may buy again; that renewal is not a recovery.
      if (type === "expired" && level >= 2 && r.chance(0.5)) {
        t = close + r.int(DAY, 20 * DAY);
        events.push({ sub, plan, type: "renewed", t });
      }
    }
  }
  // Very Hard: an episode exactly N days old on as_of (counted) and one a day younger (left out).
  if (level === 3) {
    for (const [k, start] of [[0, AS_OF_T - N], [1, AS_OF_T - N + DAY]]) {
      const sub = "sub_" + (1000000 + r.int(0, 899999) * 2 + k);
      const plan = planIds[k + 1];
      subs.push({ id: sub, store: stores[0] });
      events.push({ sub, plan, type: "renewed", t: start - 30 * DAY });
      events.push({ sub, plan, type: "renewal_failed", t: start });
      events.push({ sub, plan, type: "renewed", t: start + r.int(3600, 3 * DAY) });
    }
  }
  // The tables are a snapshot taken at as_of: nothing later is visible.
  events = events.filter((e) => e.t < AS_OF_T);
  // Event ids follow time within a subscription; across subscriptions they interleave.
  const order = events.map((e, i) => ({ e, k: e.t * 64 + (i % 64) })).sort((a, b) => a.k - b.k);
  let eid = 300000 + r.int(0, 50000);
  for (const { e } of order) e.id = (eid += r.int(1, 4));

  const cmp = (x, y) => (x < y ? -1 : x > y ? 1 : 0);
  const share = (n, d) => Math.floor((n * 20000 + d) / (2 * d)) / 10000;
  const storeOf = new Map(subs.map((s) => [s.id, s.store]));

  const solve = (o = {}) => {
    const bySub = new Map();
    for (const e of events) { if (!bySub.has(e.sub)) bySub.set(e.sub, []); bySub.get(e.sub).push(e); }
    const episodes = [];      // {plan, store, start, end, endType, failures, sub}
    for (const [sub, list] of bySub) {
      list.sort((a, b) => a.t - b.t || a.id - b.id);
      let cur = null;
      for (const e of list) {
        if (e.type === "renewal_failed") {
          if (!cur) { cur = { sub, plan: e.plan, store: storeOf.get(sub), start: e.t, end: null, endType: null, failures: 1 }; episodes.push(cur); }
          else cur.failures++;
        } else if (cur) {
          if (e.type === "expired" && o.expiryOpen) continue;
          cur.end = e.t; cur.endType = e.type; cur = null;
        }
      }
      if (o.latestPlan) { const p = list[list.length - 1].plan; for (const ep of episodes) if (ep.sub === sub) ep.plan = p; }
    }
    const per = new Map();
    for (const ep of episodes) {
      if (!o.immature && ep.start + N > AS_OF_T) continue;
      const k = ep.plan + "|" + ep.store;
      if (!per.has(k)) per.set(k, { n: 0, rec: 0, grace: 0 });
      const s = per.get(k);
      const g = grace.get(ep.plan) * DAY;
      const limit = o.noWindow ? Infinity : o.afterGrace ? N + g : N;
      const d = ep.endType === "renewed" ? ep.end - ep.start : null;
      const rec = d !== null && (o.strict ? d < limit : d <= limit);
      s.n += o.everyFailure ? ep.failures : 1;
      if (rec) { s.rec++; if (g > 0 && d <= g) s.grace++; }
    }
    return [...per.entries()].sort((a, b) => cmp(a[0], b[0])).map(([k, s]) => {
      const [plan, store] = k.split("|");
      return [plan, store, s.n, s.rec, s.grace, share(s.rec, s.n)];
    });
  };
  const rows = solve();

  const diagnostics = [
    { message: "Every failed renewal was counted as a subscription entering retry. Further failures inside an open episode are retry attempts, not new entries.", rows: solve({ everyFailure: true }) },
    { message: `The ${nDays}-day window was started at the end of the grace period. The grace period is part of the window: count from entering billing retry.`, rows: solve({ afterGrace: true }) },
    { message: `Late recoveries were counted. A renewal more than ${nDays} days after entering retry closes the episode but is not a recovery within ${nDays} days.`, rows: solve({ noWindow: true }) },
  ];
  if (level >= 2) {
    diagnostics.push({ message: "An expiry did not close the episode, so a later purchase was counted as a recovery. After `expired`, the next renewal is a new subscription period, not a recovery.", rows: solve({ expiryOpen: true }) });
    diagnostics.push({ message: `The window was treated as exclusive. A renewal exactly ${nDays} days after entering retry is a recovery.`, rows: solve({ strict: true }) });
  }
  if (level === 3) {
    diagnostics.push({ message: `Episodes younger than ${nDays} days on as_of were included. They have not had their full window yet, so they would lower the rate.`, rows: solve({ immature: true }) });
    diagnostics.push({ message: "Each subscription's latest plan was used. An episode belongs to the plan on the failed renewal that opened it.", rows: solve({ latestPlan: true }) });
  }

  const asOf = at(AS_OF_T);
  const pCols = ["plan_id", "grace_days"];
  const pRows = planIds.map((p) => [p, grace.get(p)]);
  const sCols = ["subscription_id", "storefront"];
  const sRows = subs.slice().sort((a, b) => cmp(a.id, b.id)).map((s) => [s.id, s.store]);
  const eCols = ["event_id", "subscription_id", "plan_id", "event_type", "event_ts"];
  const eRows = events.slice().sort((a, b) => a.id - b.id).map((e) => [e.id, e.sub, e.plan, e.type, at(e.t)]);
  const setup =
    "SET TIME ZONE 'UTC';\n" +
    "CREATE TABLE plans (\n  plan_id TEXT PRIMARY KEY,\n  grace_days INT NOT NULL CHECK (grace_days >= 0)\n);\n" +
    "CREATE TABLE subscriptions (\n  subscription_id TEXT PRIMARY KEY,\n  storefront TEXT NOT NULL\n);\n" +
    "CREATE TABLE billing_events (\n  event_id BIGINT PRIMARY KEY,\n  subscription_id TEXT NOT NULL REFERENCES subscriptions(subscription_id),\n  plan_id TEXT NOT NULL REFERENCES plans(plan_id),\n  event_type TEXT NOT NULL CHECK (event_type IN ('renewed', 'renewal_failed', 'expired')),\n  event_ts TIMESTAMPTZ NOT NULL\n);\n" +
    insertSQL("plans", pCols, pRows) + insertSQL("subscriptions", sCols, sRows) + insertSQL("billing_events", eCols, eRows);

  return {
    vars: {
      n_days: nDays,
      as_of: asOf,
      subs: subs.length,
      events: events.length,
      episode_rule: level === 1
        ? "In this sample a subscription enters billing retry at most once."
        : "A subscription can enter billing retry several times. A `renewed` event outside an episode is an ordinary renewal and recovers nothing; after `expired`, a later `renewed` is a new purchase, not a recovery.",
      plan_rule: level === 3
        ? `Subscriptions can change plan between episodes: an episode belongs to the \`plan_id\` on the failed renewal that opened it, and uses that plan's grace period. Leave out episodes that opened less than ${nDays} days before \`${asOf}\` (an episode opened exactly ${nDays} days before it is counted).`
        : `Every episode in this sample opened at least ${nDays} days before \`${asOf}\`, so all of them count.`,
    },
    setup,
    tables: [
      { name: "plans", columns: pCols, rows: pRows },
      { name: "subscriptions", columns: sCols, rows: sRows },
      { name: "billing_events", columns: eCols, rows: eRows },
    ],
    expected: { columns: ["plan_id", "storefront", "entered", "recovered", "recovered_in_grace", "recovery_rate"], rows },
    diagnostics: diagnostics.filter((d) => JSON.stringify(d.rows) !== JSON.stringify(rows)),
  };
}
