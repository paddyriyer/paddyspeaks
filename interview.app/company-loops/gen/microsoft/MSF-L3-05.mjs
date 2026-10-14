/* MSF-L3-05 — Policy compliance by day: the latest evaluation per resource carried forward (SQL).
   Simulated practice scenario. All data, names and states are generated from the seed and are
   hypothetical.

   One deterministic result set: for every UTC day D in [start_day, end_day] and every policy,
   over the resources that exist at the end of D (deleted_at NULL or >= next midnight), take each
   resource's latest evaluation for the policy made before the next midnight (evaluated_at < D+1),
   carried forward from earlier days; skip resources with no evaluation yet and (level 2+) those
   whose latest state is exempt; count compliant / non_compliant; compliance_pct =
   ROUND(100 * compliant / assessed, 1). One row per (day, policy) with at least one assessed
   resource, ordered by day, policy_id.
   level: 1 Medium (carry-forward, deletions incl. one exactly at midnight, an evaluation exactly
                    at midnight, ids not in time order)
          2 Hard (+ exempt as a latest state that hides an earlier non-compliant one, two
                  evaluations of one pair at the same instant: the larger evaluation_id is later)
          3 Very Hard (+ a resource deleted and re-created with the same resource_id: one row per
                       lifetime, evaluations belong to their lifetime, nothing carries across) */
import { insertSQL, ts } from "../../js/rng.js";

export const kind = "sql";

const H = 3600;
const DAY = 86400;
const BASE = Date.UTC(2026, 8, 7) / 1000;                        // 2026-09-07 00:00 UTC
const POLICIES = ["pol_allowed_locations", "pol_backup_enabled", "pol_diagnostic_logs", "pol_disk_encryption",
  "pol_https_only", "pol_no_public_ip", "pol_require_owner_tag", "pol_tls_min_version"];
const RGS = ["rg-web", "rg-data", "rg-ops", "rg-ml", "rg-shared", "rg-edge", "rg-api", "rg-batch"];
const TYPES = [["storage_account", "st"], ["virtual_machine", "vm"], ["sql_database", "sqldb"],
  ["key_vault", "kv"], ["app_service", "app"], ["managed_disk", "disk"]];

const iso = (sec) => new Date((BASE + sec) * 1000).toISOString();
const stamp = (sec) => ts(iso(sec).slice(0, 10), ((sec % DAY) + DAY) % DAY);
const dayStr = (sec) => iso(sec).slice(0, 10);

export function generate(r, level) {
  const nDays = level === 1 ? r.int(4, 5) : level === 2 ? r.int(5, 6) : r.int(6, 7);
  const S = r.int(3, 4) * DAY;                                   // first reported day (midnight)
  const END = S + nDays * DAY;                                   // exclusive end of the last day
  const LIMIT = END + 12 * H;                                    // a little data after the range
  const policies = r.sample(POLICIES, level === 1 ? 2 : 3).sort();
  const nRes = (level === 1 ? 8 : level === 2 ? 10 : 12) + r.int(0, 2);

  // Resources. 0..2 are stable (early, never deleted, every policy); 3 is deleted exactly at a
  // midnight; 4 is deleted in the middle of a day; 5 (level 3) is deleted and re-created.
  const names = new Set();
  const resources = [];
  for (let i = 0; i < nRes; i++) {
    let id;
    do {
      const [type, pre] = r.pick(TYPES);
      id = { rid: `${r.pick(RGS)}/${type}/${pre}-${String(r.int(1, 40)).padStart(2, "0")}`, type };
    } while (names.has(id.rid));
    names.add(id.rid);
    const special = i <= 5;
    let pols = special && i <= 2 ? policies.slice() : policies.filter(() => r.chance(0.6));
    if (!pols.length) pols = [r.pick(policies)];
    const early = special || r.chance(0.6);
    const c = early ? r.int(S - 3 * DAY, S - DAY - 2 * H) : r.int(S - DAY, END - DAY);
    let d = null;
    if (!special && r.chance(0.25) && c + DAY < END - 2 * H) d = r.int(Math.max(c + DAY, S), END - 2 * H);
    resources.push({ ...id, pols, special, noExempt: i >= 3 && i <= 5, lives: [{ c, d, evals: [] }] });
  }
  const k2 = r.int(1, nDays - 1);
  resources[3].lives[0].d = S + k2 * DAY;                                    // deleted exactly at midnight
  resources[4].lives[0].d = S + r.int(0, nDays - 2) * DAY + r.int(2 * H, 20 * H) + 1;   // mid-day
  if (level === 3) {
    const L1 = resources[5].lives[0];
    L1.d = S + r.int(0, nDays - 3) * DAY + r.int(3 * H, 12 * H) + 1;
    const c2 = L1.d + r.int(H, 6 * H);
    resources[5].lives.push({ c: c2, d: null, evals: [], firstAfter: c2 + r.int(DAY + H, 2 * DAY) });
  }

  // Random evaluations: odd seconds, strictly increasing per (lifetime, policy), so they never
  // collide with each other or with the forced ones (even seconds).
  const allowExempt = (res) => level >= 2 && !res.noExempt;
  const randomState = (res) => {
    if (allowExempt(res) && r.chance(0.1)) return "exempt";
    return r.chance(0.6) ? "compliant" : "non_compliant";
  };
  for (const res of resources) {
    for (const L of res.lives) {
      for (const pol of res.pols) {
        let t = (L.firstAfter ?? L.c + r.int(5 * 60, res.special ? 12 * H : 30 * H)) | 1;
        let st = randomState(res);
        const stop = L.d ?? LIMIT;
        while (t < stop && t < LIMIT) {
          L.evals.push({ pol, at: t, st, forced: false });
          t = (t + r.int(16 * H, 3 * DAY)) | 1;
          if (r.chance(0.35)) {
            let n;
            do n = randomState(res); while (n === st);
            st = n;
          }
        }
      }
    }
  }

  // Forced edge cases on distinct (stable resource, policy) pairs.
  const pairs = r.shuffle([0, 1, 2].flatMap((i) => policies.map((pol) => ({ res: resources[i], pol }))));
  const evalsOf = (p) => p.res.lives[0].evals.filter((e) => e.pol === p.pol);
  const removeIn = (p, lo, hi) => { const L = p.res.lives[0]; L.evals = L.evals.filter((e) => !(e.pol === p.pol && e.at >= lo && e.at < hi)); };
  const add = (p, at, st, extra = {}) => { const e = { pol: p.pol, at, st, forced: true, ...extra }; p.res.lives[0].evals.push(e); return e; };
  const ties = [];
  if (level >= 2) {
    {                                                            // latest state exempt hides non_compliant
      const p = pairs[1];
      const kA = r.int(0, nDays - 1);
      const tA = S + kA * DAY + 2 * r.int(3 * H, 7 * H);
      const tB = tA + 2 * r.int(H, 4 * H);
      removeIn(p, tA, S + (kA + 1) * DAY);
      add(p, tA, "non_compliant");
      add(p, tB, "exempt");
    }
    {                                                            // two evaluations at the same instant
      const p = pairs[2];
      const kT = r.int(0, nDays - 1);
      const t = S + kT * DAY + 2 * r.int(6 * H, 11 * H);
      removeIn(p, t, S + (kT + 1) * DAY);
      const win = r.pick(["compliant", "non_compliant"]);
      const lose = win === "compliant" ? "non_compliant" : "compliant";
      const a = add(p, t, lose), b = add(p, t, win);
      ties.push([a, b]);                                         // b must get the larger id
    }
  }
  {                                                              // an evaluation exactly at midnight
    const p = pairs[0];
    const M = S + r.int(1, nDays - 1) * DAY;
    const before = evalsOf(p).filter((e) => e.at < M).sort((a, b) => a.at - b.at);
    const last = before[before.length - 1].st;
    add(p, M, last === "compliant" ? "non_compliant" : "compliant");
  }

  // Ids: unique, assigned by the ingestion pipeline, not in time order.
  const evals = [];
  for (const res of resources) for (const L of res.lives) for (const e of L.evals) { e.rid = res.rid; e.life = L; evals.push(e); }
  let next = 7000 + r.int(0, 900);
  const ids = r.shuffle(evals.map(() => (next += r.int(1, 3))));
  evals.forEach((e, i) => { e.id = ids[i]; });
  for (const [a, b] of ties) if (a.id > b.id) [a.id, b.id] = [b.id, a.id];
  const lives = resources.flatMap((res) => res.lives.map((L) => ({ ...L, rid: res.rid, type: res.type, ref: L })));

  // The oracle. Options break one rule each, for diagnostics.
  const compute = (o = {}) => {
    const rows = [];
    for (let k = 0; k < nDays; k++) {
      const d0 = S + k * DAY, end = d0 + DAY;
      const tally = new Map(policies.map((p) => [p, [0, 0, 0]]));
      const count = (e) => {
        if (e.st === "exempt") return;
        const t = tally.get(e.pol);
        t[0]++;
        if (e.st === "compliant") t[1]++; else t[2]++;
      };
      const inWindow = (e) => (o.noCarry ? e.at >= d0 && e.at < end : o.midnightPrev ? e.at <= end : e.at < end);
      const later = (a, b) => (o.byId ? a.id > b.id
        : a.at !== b.at ? a.at > b.at : o.tieLow ? a.id < b.id : a.id > b.id);
      for (const L of lives) {
        if (!(L.c < end)) continue;
        if (!o.ignoreDeleted && L.d !== null && (o.delBoundary ? L.d <= end : L.d < end)) continue;
        const pool = (o.anyLife ? evals.filter((e) => e.rid === L.rid) : L.ref.evals).filter(inWindow);
        const groups = o.perResource ? [pool] : policies.map((p) => pool.filter((e) => e.pol === p));
        for (const g of groups) {
          if (o.allEvals) { g.forEach(count); continue; }
          const cand = o.dropExemptFirst ? g.filter((e) => e.st !== "exempt") : g;
          if (!cand.length) continue;
          let best = cand[0];
          for (const e of cand) if (later(e, best)) best = e;
          count(best);
        }
      }
      for (const p of policies) {
        const [a, c, n] = tally.get(p);
        if (a > 0) rows.push([dayStr(d0), p, a, c, n, Math.floor((2000 * c + a) / (2 * a)) / 10]);
      }
    }
    return rows;
  };
  const expected = compute();

  const diagnostics = [
    { message: "States were not carried forward. A resource that was not re-evaluated on a day keeps its latest earlier state; counting only that day's evaluations drops most resources (and whole days).", rows: compute({ noCarry: true }) },
    { message: "Every evaluation up to the day was counted. Each resource counts once per policy and day, with its latest evaluation only.", rows: compute({ allEvals: true }) },
    { message: "Deleted resources were still counted. A resource deleted before the next midnight no longer exists at the end of the day and leaves the report from that day on.", rows: compute({ ignoreDeleted: true }) },
    { message: "A resource deleted exactly at midnight was dropped from the day before. It existed for the whole of that day; deleted_at at the next midnight means it is gone from the following day only (deleted_at >= next midnight keeps it).", rows: compute({ delBoundary: true }) },
    { message: "An evaluation made exactly at midnight was counted in the previous day. A day ends before the next midnight: evaluated_at < D + 1 day.", rows: compute({ midnightPrev: true }) },
    { message: "The latest evaluation was picked per resource across all policies. Take the latest per resource and policy: each policy has its own state for the same resource.", rows: compute({ perResource: true }) },
    { message: "The latest evaluation was picked by the largest evaluation_id. Ids come from the ingestion pipeline and are not in time order; evaluated_at decides which evaluation is latest.", rows: compute({ byId: true }) },
  ];
  if (level >= 2) {
    diagnostics.push(
      { message: "Exempt evaluations were filtered out before picking the latest. An exemption is the resource's current state: it hides the earlier non-compliant evaluation, so the resource is left out instead of counted as non-compliant.", rows: compute({ dropExemptFirst: true }) },
      { message: "Ties at the same evaluated_at were broken the wrong way. When two evaluations of a resource and policy share evaluated_at, the larger evaluation_id is the later one.", rows: compute({ tieLow: true }) },
    );
  }
  if (level === 3) {
    diagnostics.push({ message: "A re-created resource inherited the state of its earlier lifetime. Evaluations belong to the lifetime they fall in; a resource re-created with the same resource_id has no state until it is evaluated again.", rows: compute({ anyLife: true }) });
  }

  const rCols = ["resource_id", "resource_type", "created_at", "deleted_at"];
  const eCols = ["evaluation_id", "policy_id", "resource_id", "evaluated_at", "compliance_state"];
  const rRows = lives.slice().sort((a, b) => (a.rid < b.rid ? -1 : a.rid > b.rid ? 1 : a.c - b.c))
    .map((L) => [L.rid, L.type, stamp(L.c), L.d === null ? null : stamp(L.d)]);
  const eRows = evals.slice().sort((a, b) => a.id - b.id)
    .map((e) => [e.id, e.pol, e.rid, stamp(e.at), e.st]);
  const states = level === 1 ? "'compliant','non_compliant'" : "'compliant','non_compliant','exempt'";
  const rpk = level === 3 ? "PRIMARY KEY (resource_id, created_at)" : "PRIMARY KEY (resource_id)";
  const setup =
    "SET TIME ZONE 'UTC';\n" +
    "CREATE TABLE resources (\n  resource_id TEXT NOT NULL,\n  resource_type TEXT NOT NULL,\n  created_at TIMESTAMPTZ NOT NULL,\n  deleted_at TIMESTAMPTZ,\n  " + rpk + "\n);\n" +
    "CREATE TABLE policy_evaluations (\n  evaluation_id INT PRIMARY KEY,\n  policy_id TEXT NOT NULL,\n  resource_id TEXT NOT NULL,\n  evaluated_at TIMESTAMPTZ NOT NULL,\n  compliance_state TEXT NOT NULL CHECK (compliance_state IN (" + states + "))\n);\n" +
    insertSQL("resources", rCols, rRows) + insertSQL("policy_evaluations", eCols, eRows);

  return {
    vars: {
      start_day: dayStr(S),
      end_day: dayStr(END - DAY),
      days: nDays,
      policy_list: policies.map((p) => "`" + p + "`").join(", "),
      resource_rows: rRows.length,
      evaluation_rows: eRows.length,
      lifecycle_rule: level === 3
        ? "A resource can be deleted and later re-created with the same `resource_id`, so `resources` holds one row per lifetime (primary key `resource_id, created_at`). An evaluation belongs to the lifetime it falls in: at or after that lifetime's `created_at` and, when `deleted_at` is set, before it. A re-created resource starts with no state; nothing from an earlier lifetime carries forward."
        : "Each `resource_id` appears once in `resources`; `deleted_at` is NULL while the resource still exists.",
      state_rule: level === 1
        ? "`compliance_state` is `compliant` or `non_compliant`. No two evaluations of the same resource and policy share an `evaluated_at`."
        : "`compliance_state` is `compliant`, `non_compliant` or `exempt`. An exemption is a state like the others: when a resource's latest evaluation for the policy is `exempt`, the resource is left out of that policy's row for the day (it is neither assessed nor counted), even if an earlier evaluation said `non_compliant`. Two evaluations of the same resource and policy can share an `evaluated_at`; the one with the larger `evaluation_id` is the later.",
    },
    setup,
    tables: [
      { name: "resources", columns: rCols, rows: rRows },
      { name: "policy_evaluations", columns: eCols, rows: eRows },
    ],
    expected: { columns: ["day", "policy_id", "assessed_resources", "compliant", "non_compliant", "compliance_pct"], rows: expected },
    diagnostics: diagnostics.filter((dg) => JSON.stringify(dg.rows) !== JSON.stringify(expected)),
  };
}
