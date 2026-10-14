/* APL-L1-05 — Subscription renewal dates with upgrades and downgrades (Python).
   Simulated practice scenario. All data is generated from the seed. The renewal and
   plan-change rules are this exercise's, stated in the problem; check current docs
   for any real store's rules.

   Contract: see docs/COMPANY-INTERVIEW-LOOPS.md § Executable templates (python).
   expect comes from oracle() below, which steps renewal by renewal through every period
   and change. The evaluator's reference jumps straight to the right period with month
   arithmetic, so each checks the other.
   level: 1 Medium (no plan changes: renewals anchored to the purchase day, clamped to month end)
          2 Hard (+ one change: an upgrade starts a new period that day, a downgrade waits for the
            next renewal; purchases and changes after as_of)
          3 Very Hard (+ several changes: an upgrade or re-choosing the current plan cancels a
            pending downgrade, a later downgrade replaces it, renewals come before changes on the same day) */
export const kind = "python";
export const entry = "renewals";
export const signature = "def renewals(plans: dict[str, tuple[int, int]], subs: list[tuple[str, str, list[tuple[str, str]]]], as_of: str) -> list[tuple[str, str] | None]:";
export const starter = `def renewals(plans, subs, as_of):
    """plans: name -> (tier, months). subs: (purchase_date, plan, changes), changes being
    (date, new_plan) in date order. Dates are 'YYYY-MM-DD'.
    Return, per subscription, (next_renewal_date, plan_renewing_then): the first renewal
    strictly after as_of. Return None for a subscription purchased after as_of."""
    ...
`;

export const prelude = `
def _gen_subs(n, seed, names, as_of, max_changes):
    from datetime import date
    lo, hi = date(1980, 1, 1).toordinal(), date.fromisoformat(as_of).toordinal()
    x, out = seed, []
    for _ in range(n):
        x = (1103515245 * x + 12345) % 2147483648
        p = lo + x % (hi - lo + 1)
        x = (1103515245 * x + 12345) % 2147483648
        plan = names[(x >> 8) % len(names)]
        changes, c = [], p
        for _ in range((x >> 16) % (max_changes + 1)):
            x = (1103515245 * x + 12345) % 2147483648
            c += x % (hi + 60 - c + 1) // 4
            x = (1103515245 * x + 12345) % 2147483648
            changes.append((date.fromordinal(c).isoformat(), names[(x >> 8) % len(names)]))
        out.append((date.fromordinal(p).isoformat(), plan, changes))
    return out
`.trim() + "\n";

const pad = (n) => String(n).padStart(2, "0");
const mIdx = (s) => Number(s.slice(0, 4)) * 12 + Number(s.slice(5, 7)) - 1;
const dim = (m) => new Date(Date.UTC(Math.floor(m / 12), (m % 12) + 1, 0)).getUTCDate();
const dateOn = (m, day) => `${Math.floor(m / 12)}-${pad((m % 12) + 1)}-${pad(Math.min(day, dim(m)))}`;
const iso = (ord) => new Date(ord * 86400000).toISOString().slice(0, 10);       // days since 1970-01-01
const ordOf = (s) => Date.UTC(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10))) / 86400000;

// Independent oracle: walk renewal by renewal, interleaving the changes in date order
// (a renewal on a change's day happens first). Small inputs only.
export function oracle(plans, subs, asOf) {
  return subs.map(([purchase, plan0, changes]) => {
    if (purchase > asOf) return null;
    let plan = plan0, base = mIdx(purchase), day = Number(purchase.slice(8)), k = 0, pending = null;
    const ch = changes.filter(([c]) => c <= asOf);
    let i = 0;
    for (;;) {
      const R = dateOn(base + (k + 1) * plans[plan][1], day);
      if (i < ch.length && R > ch[i][0]) {
        const [c, nw] = ch[i++];
        const t1 = plans[nw][0], t0 = plans[plan][0];
        if (t1 > t0) { plan = nw; base = mIdx(c); day = Number(c.slice(8)); k = 0; pending = null; }
        else if (t1 < t0) pending = nw;
        else pending = null;
      } else if (R <= asOf) {
        if (pending) { base += (k + 1) * plans[plan][1]; k = 0; plan = pending; pending = null; }
        else k++;
      } else return [R, pending ?? plan];
    }
  });
}

const POOL = {
  student_monthly: [1, 1], student_semiannual: [2, 6],
  individual_monthly: [3, 1], individual_quarterly: [4, 3], individual_annual: [5, 12],
  family_monthly: [6, 1], family_annual: [7, 12],
};
const FIXED = { student_monthly: [1, 1], individual_quarterly: [4, 3], individual_annual: [5, 12], family_annual: [7, 12] };

const pyPlans = (p) => "{" + Object.keys(p).sort().map((k) => `'${k}': (${p[k][0]}, ${p[k][1]})`).join(", ") + "}";
const pySubs = (subs) => "[" + subs.map(([d, p, ch]) => `('${d}', '${p}', [${ch.map(([c, n]) => `('${c}', '${n}')`).join(", ")}])`).join(", ") + "]";
const pyArgs = (plans, subs, asOf) => `(${pyPlans(plans)}, ${pySubs(subs)}, '${asOf}')`;
const pyResult = (res) => "[" + res.map((x) => (x === null ? "None" : `('${x[0]}', '${x[1]}')`)).join(", ") + "]";

function smallCase(r, level) {
  const names = r.sample(Object.keys(POOL), 4);
  const plans = Object.fromEntries(names.map((n) => [n, POOL[n]]));
  const asOf = `2026-${pad(r.int(1, 12))}-${pad(r.int(1, 28))}`;
  const hi = ordOf(asOf), lo = ordOf("2019-01-01");
  const subs = [];
  const n = r.int(5, 7);
  for (let i = 0; i < n; i++) {
    let p;
    const u = r.next();
    if (u < 0.3) { const m = r.int(2019 * 12, 2026 * 12 - 1); p = dateOn(m, r.pick([29, 30, 31])); }   // a late anchor day
    else if (u < 0.4) p = "2024-02-29";
    else p = iso(r.int(lo, hi));
    if (level >= 2 && i === n - 1) p = iso(hi + r.int(1, 40));                                 // purchased after as_of
    if (p > asOf && !(level >= 2 && i === n - 1)) p = asOf;
    const changes = [];
    const nCh = level === 1 ? 0 : level === 2 ? r.int(0, 1) : r.int(0, 3);
    let c = ordOf(p);
    const plan0 = r.pick(names);
    let cur = plan0;
    for (let k = 0; k < nCh; k++) {
      c += r.int(1, Math.max(1, Math.floor((hi + 60 - c) / 2)));
      const nw = level === 3 && r.chance(0.25) ? cur : r.pick(names.filter((x) => x !== cur));
      changes.push([iso(c), nw]);
      cur = nw;
    }
    subs.push([p, plan0, changes]);
  }
  return { plans, subs, asOf };
}

export function generate(r, level) {
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const c = smallCase(r, level);
    samples.push({ args: pyArgs(c.plans, c.subs, c.asOf), expect: pyResult(oracle(c.plans, c.subs, c.asOf)) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const P = FIXED;
  const edges = [
    ["anchored to the 31st: February renews on its last day", [["2025-01-31", "student_monthly", []]], "2026-02-10"],
    ["after February the anchor goes back to the 31st (a renewal on as_of is not after it)", [["2025-01-31", "student_monthly", []]], "2026-02-28"],
    ["an annual plan bought on 29 February", [["2024-02-29", "individual_annual", []], ["2024-02-29", "family_annual", []]], "2025-01-01"],
    ["the leap-day anchor returns in a leap year", [["2024-02-29", "individual_annual", []]], "2027-03-01"],
    ["purchased on as_of: the first renewal is one period later", [["2026-03-15", "individual_quarterly", []]], "2026-03-15"],
    ["quarterly from 30 November", [["2025-11-30", "individual_quarterly", []], ["2025-11-30", "student_monthly", []]], "2026-03-01"],
  ];
  if (level >= 2) {
    edges.push(["purchased after as_of", [["2026-06-02", "student_monthly", []], ["2026-01-31", "student_monthly", []]], "2026-06-01"]);
    edges.push(["an upgrade starts a new period on the day it is made", [["2025-05-10", "student_monthly", [["2026-01-31", "individual_annual"]]]], "2026-06-01"]);
    edges.push(["a downgrade waits for the next renewal", [["2026-01-20", "individual_annual", [["2026-03-05", "student_monthly"]]]], "2026-06-01"]);
    edges.push(["after the downgrade, renewals follow the new period", [["2026-01-20", "individual_annual", [["2026-03-05", "student_monthly"]]]], "2027-02-01"]);
    edges.push(["a downgrade made on a renewal day waits for the following renewal", [["2026-01-20", "individual_quarterly", [["2026-04-20", "student_monthly"]]]], "2026-04-25"]);
    edges.push(["a change dated after as_of has not happened yet", [["2026-01-10", "student_monthly", [["2026-06-15", "family_annual"]]]], "2026-06-01"]);
  }
  if (level === 3) {
    edges.push(["an upgrade cancels a pending downgrade", [["2026-01-31", "individual_annual", [["2026-03-01", "student_monthly"], ["2026-04-30", "family_annual"]]]], "2026-05-01"]);
    edges.push(["choosing the current plan again cancels the downgrade", [["2026-02-14", "individual_quarterly", [["2026-03-01", "student_monthly"], ["2026-04-01", "individual_quarterly"]]]], "2026-04-10"]);
    edges.push(["two downgrades: the later one is the one that happens", [["2026-01-05", "family_annual", [["2026-02-01", "individual_quarterly"], ["2026-03-01", "student_monthly"]]]], "2027-01-06"]);
    edges.push(["the renewal comes before a change made on the same day", [["2026-01-31", "individual_annual", [["2026-02-10", "student_monthly"], ["2027-01-31", "individual_quarterly"]]]], "2027-02-01"]);
  }
  for (const [name, subs, asOf] of edges) tests.push({ name, args: pyArgs(P, subs, asOf), expect: pyResult(oracle(P, subs, asOf)) });

  // Timing: 200 000 subscriptions with synthetic purchase dates spread from 1980, mostly on
  // monthly plans. Stepping period by period is ~5·10^7 renewals; month arithmetic is O(1)
  // per subscription plus O(1) per change.
  const seed = r.int(1, 1_000_000);
  const n = 150000;
  const names = level === 1 ? ["family_monthly", "individual_monthly", "student_monthly", "individual_quarterly"]
    : ["family_monthly", "individual_monthly", "student_monthly", "individual_quarterly", "individual_annual"];
  const plansAll = Object.fromEntries(names.map((k) => [k, POOL[k]]));
  tests.push({
    name: `${n.toLocaleString("en-US")} subscriptions over decades of renewals, in time`,
    args: `(${pyPlans(plansAll)}, _gen_subs(${n}, ${seed}, [${names.map((x) => `'${x}'`).join(", ")}], '2026-10-01', ${level === 1 ? 0 : level === 2 ? 1 : 2}), '2026-10-01')`,
    limit_s: 8,
  });

  return {
    vars: {
      change_rule: level === 1
        ? "In this round every `changes` list is empty, and every purchase is on or before `as_of`."
        : level === 2
          ? "Each subscription has at most one change. A change dated after `as_of` has not happened yet: ignore it. A subscription purchased after `as_of` gets `None`."
          : "A subscription can have several changes. A change dated after `as_of` has not happened yet: ignore it. A subscription purchased after `as_of` gets `None`.",
      pending_rule: level === 3
        ? "While a downgrade is pending: an upgrade cancels it (and starts its own new period); choosing the plan already in effect cancels it; another downgrade replaces it. A renewal happens before any change made on the same day, so a downgrade due that day has already taken effect when the change is compared."
        : "Choosing the plan already in effect cancels a pending downgrade.",
    },
    samples,
    tests,
  };
}
