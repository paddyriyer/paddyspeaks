/* XAI-L1-01 — Rate-limit rejections by limit type, per model and spend tier (SQL).
   Simulated practice scenario. All data is generated from the seed. Tiers, limits and
   model names are this exercise's, hypothetical; check current docs for any real product.

   Contract: see docs/COMPANY-INTERVIEW-LOOPS.md § Executable templates (sql).
   level: 1 Medium (as-of join of each request to its team's tier; 200s and 429s only)
          2 Hard (+ requests at the exact instant of an upgrade, and other error codes that
            count as requests but not as rate-limit rejections)
          3 Very Hard (+ requests logged twice by two gateways, and teams whose requests
            start before their first tier row: they are on tier 1 until then) */
import { insertSQL } from "../../js/rng.js";

export const kind = "sql";

const MODELS = ["chat-large", "chat-fast", "chat-mini", "vision-std", "reason-xl", "code-std"];
const TEAMS = ["team_aurora", "team_basalt", "team_cobalt", "team_delta", "team_ember", "team_fjord", "team_garnet"];
const BASE = Date.UTC(2026, 9, 5);                  // 2026-10-05 00:00 UTC
const p2 = (n) => String(n).padStart(2, "0");
const fmt = (sec) => {
  const d = new Date(BASE + sec * 1000);
  return `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())} ${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}:${p2(d.getUTCSeconds())}+00`;
};

export function generate(r, level) {
  const models = r.sample(MODELS, level === 1 ? 2 : 3).sort();
  const teams = r.sample(TEAMS, level === 1 ? 4 : 5).sort();
  const SPAN = 3 * 86400;
  const changes = [];                                // {team, tier, at}
  const firstReq = new Map();
  const late = new Set(level === 3 ? r.sample(teams, 2) : []);   // no tier row before their first requests
  for (const t of teams) {
    let tier = r.int(1, 2), at = level === 3 && late.has(t) ? r.int(20000, 60000) : 0;
    const startAt = late.has(t) ? -1 : 0;
    if (!late.has(t)) changes.push({ team: t, tier, at: 0 });
    else { tier = r.int(2, 3); changes.push({ team: t, tier, at }); }
    firstReq.set(t, startAt);
    let cur = at;
    const ups = r.int(1, 2);
    for (let u = 0; u < ups; u++) {
      cur += r.int(40000, 90000);
      if (cur >= SPAN - 3600) break;
      tier += 1;
      changes.push({ team: t, tier: Math.min(tier, 5), at: cur });
    }
  }
  const tierAt = (team, sec, o = {}) => {
    let best = null;
    for (const c of changes) {
      if (c.team !== team) continue;
      if (o.strict ? c.at < sec : c.at <= sec) { if (!best || c.at > best.at) best = c; }
    }
    if (o.current) best = changes.filter((c) => c.team === team).reduce((a, b) => (b.at > a.at ? b : a));
    return best ? best.tier : (o.dropEarly ? null : 1);
  };

  const reqs = [];                                    // {id, team, model, at, status, limit}
  let rid = 700000 + r.int(0, 90000);
  const nReq = 40 + 10 * level;
  for (let i = 0; i < nReq; i++) {
    const team = r.pick(teams), model = r.pick(models);
    const at = r.int(60, SPAN - 60);
    const tier = tierAt(team, at);
    const pRej = tier <= 2 ? 0.4 : 0.2;
    let status = 200, limit = null;
    if (r.chance(pRej)) { status = 429; limit = r.chance(0.55) ? "rps" : "tpm"; }
    else if (level >= 2 && r.chance(0.15)) status = r.pick([400, 500, 503]);
    reqs.push({ id: rid += r.int(1, 30), team, model, at, status, limit });
  }
  if (level >= 2) {
    // Requests at the exact instant of an upgrade: the new tier applies.
    const ups = changes.filter((c) => c.at > 0);
    for (const c of r.sample(ups, Math.min(2, ups.length))) {
      reqs.push({ id: rid += r.int(1, 30), team: c.team, model: r.pick(models), at: c.at, status: 429, limit: r.pick(["rps", "tpm"]) });
      reqs.push({ id: rid += r.int(1, 30), team: c.team, model: r.pick(models), at: c.at - 1, status: 429, limit: r.pick(["rps", "tpm"]) });
    }
  }
  if (level === 3) {
    // Requests before a late team's first tier row.
    for (const t of late) {
      const first = Math.min(...changes.filter((c) => c.team === t).map((c) => c.at));
      for (let k = 0; k < 3; k++) {
        const rej = r.chance(0.6);
        reqs.push({ id: rid += r.int(1, 30), team: t, model: r.pick(models), at: r.int(60, first - 1), status: rej ? 429 : 200, limit: rej ? r.pick(["rps", "tpm"]) : null });
      }
    }
  }
  reqs.sort((a, b) => a.at - b.at || a.id - b.id);
  // Log rows: one per request, some twice at Very Hard (a second gateway's copy).
  const logs = [];
  let lid = 1;
  for (const q of reqs) {
    logs.push({ lid: lid++, gw: r.pick(["gw-a", "gw-b"]), q });
  }
  if (level === 3) {
    const dupOf = r.sample(reqs.filter((q) => q.status === 429), 3).concat(r.sample(reqs.filter((q) => q.status === 200), 2));
    for (const q of dupOf) logs.push({ lid: lid++, gw: "gw-c", q });
  }

  const cmp = (x, y) => (x < y ? -1 : x > y ? 1 : 0);
  const share = (n, d) => Math.floor((n * 20000 + d) / (2 * d)) / 10000;
  const solve = (o = {}) => {
    const rows = o.dupes ? logs.map((l) => l.q) : reqs;
    const per = new Map();
    for (const q of rows) {
      const tier = tierAt(q.team, q.at, o);
      if (tier === null) continue;
      if (o.dropErrors && q.status !== 200 && q.status !== 429) continue;
      const k = q.model + "|" + tier;
      if (!per.has(k)) per.set(k, { model: q.model, tier, n: 0, rps: 0, tpm: 0 });
      const s = per.get(k);
      s.n++;
      if (q.status === 429 && q.limit === "rps") s.rps++;
      if (q.status === 429 && q.limit === "tpm") s.tpm++;
      if (o.errorsAsRps && q.status >= 500) s.rps++;
    }
    return [...per.values()].sort((a, b) => cmp(a.model, b.model) || a.tier - b.tier)
      .map((s) => [s.model, s.tier, s.n, s.rps, s.tpm, share(s.rps, s.n), share(s.tpm, s.n)]);
  };
  const rows = solve();

  const diagnostics = [
    { message: "Every request was given its team's current (latest) tier. Take the tier in force at requested_at: the latest tier row at or before it.", rows: solve({ current: true }) },
  ];
  if (level >= 2) {
    diagnostics.push({ message: "A request at the exact instant of an upgrade was given the old tier. A tier row applies from its effective_at inclusive.", rows: solve({ strict: true }) });
    diagnostics.push({ message: "Requests that failed with other status codes were left out of the denominator. They are requests; they are just not rate-limit rejections.", rows: solve({ dropErrors: true }) });
    diagnostics.push({ message: "Server errors (5xx) were counted as rejections. Only status 429 is a rate-limit rejection, split by limit_hit.", rows: solve({ errorsAsRps: true }) });
  }
  if (level === 3) {
    diagnostics.push({ message: "Each log row was counted. A request logged by two gateways is still one request: count distinct request_id.", rows: solve({ dupes: true }) });
    diagnostics.push({ message: "Requests sent before a team's first tier row were dropped (an inner join). Before its first row a team is on tier 1.", rows: solve({ dropEarly: true }) });
  }

  const tCols = ["team_id", "tier", "effective_at"];
  const tRows = changes.slice().sort((a, b) => cmp(a.team, b.team) || a.at - b.at).map((c) => [c.team, c.tier, fmt(c.at)]);
  const lCols = ["log_id", "gateway", "request_id", "team_id", "model", "requested_at", "status_code", "limit_hit"];
  const lRows = logs.slice().sort((a, b) => a.q.at - b.q.at || a.lid - b.lid).map((l) => [l.lid, l.gw, l.q.id, l.q.team, l.q.model, fmt(l.q.at), l.q.status, l.q.limit]);
  const setup =
    "SET TIME ZONE 'UTC';\n" +
    "CREATE TABLE tier_changes (\n  team_id TEXT NOT NULL,\n  tier INT NOT NULL,\n  effective_at TIMESTAMPTZ NOT NULL,\n  PRIMARY KEY (team_id, effective_at)\n);\n" +
    "CREATE TABLE request_log (\n  log_id BIGINT PRIMARY KEY,\n  gateway TEXT NOT NULL,\n  request_id BIGINT NOT NULL,\n  team_id TEXT NOT NULL,\n  model TEXT NOT NULL,\n  requested_at TIMESTAMPTZ NOT NULL,\n  status_code INT NOT NULL,\n  limit_hit TEXT CHECK (limit_hit IN ('rps', 'tpm'))\n);\n" +
    insertSQL("tier_changes", tCols, tRows) + insertSQL("request_log", lCols, lRows);

  return {
    vars: {
      requests: reqs.length,
      log_rows: logs.length,
      status_rule: level === 1
        ? "In this sample every request has status 200 or 429."
        : "Status codes other than 200 and 429 (400, 500, 503) also appear: those requests count in requests, but they are not rate-limit rejections.",
      tier_rule: level === 3
        ? "Some teams sent requests before their first tier_changes row: until that row, a team is on tier 1. A request can also appear twice in request_log, once per gateway that logged it (same request_id, different log_id); it is one request."
        : "Every team has a tier_changes row at or before its first request, and each request has exactly one row in request_log.",
    },
    setup,
    tables: [
      { name: "tier_changes", columns: tCols, rows: tRows },
      { name: "request_log", columns: lCols, rows: lRows },
    ],
    expected: { columns: ["model", "tier", "requests", "rps_rejections", "tpm_rejections", "rps_share", "tpm_share"], rows },
    diagnostics: diagnostics.filter((d) => JSON.stringify(d.rows) !== JSON.stringify(rows)),
  };
}
