/* CFX-L3-05 — Rule changes and blocking: blocked-request share in the hour before and the
   hour after each WAF rule deployment, per zone (SQL).
   Simulated practice scenario. All data, names and numbers are generated from the seed and
   are hypothetical; the reporting rules are this exercise's rules, not a product's.

   One row per (succeeded deployment, zone it applies to):
     before window  [max(T - 1 h, previous succeeded deployment affecting the zone), T)
     after window   [T, min(T + 1 h, next succeeded deployment affecting the zone))
     requests_*     requests logged for that zone in the window
     blocked_pct_*  100 * blocked / requests rounded to 2 places (half up), NULL when the window
                    holds fewer than min_requests requests; blocked means action = 'block'
     change_pp      blocked_pct_after - blocked_pct_before (NULL when either is NULL)
   level: 1 Medium (half-open windows, failed deployments, a zone with no traffic, a window
                    under the floor, challenges and logs that are not blocks)
          2 Hard (+ deployments to the same zone less than an hour apart cut each other's
                  windows, a failed deployment inside another's window)
          3 Very Hard (+ account-level deployments with zone_id NULL that apply to every zone
                       of the account, and cut zone-level windows too) */
import { insertSQL, ts } from "../../js/rng.js";

export const kind = "sql";

const M = 60, H = 3600;
const DAY = "2026-09-21";
const ZONES = ["zone_aster", "zone_birch", "zone_cobalt", "zone_delta", "zone_ember", "zone_fjord", "zone_garnet", "zone_harbor"];
const RULES = ["rule_admin_paths", "rule_api_writes", "rule_bad_methods", "rule_country_list", "rule_login_form", "rule_old_clients", "rule_upload_size", "rule_xml_endpoint"];

const pct100 = (a, b) => Math.floor((2 * a * 10000 + b) / (2 * b));   // hundredths of a percent-point, half up

export function generate(r, level) {
  const floor = level === 1 ? r.pick([5, 6]) : level === 2 ? r.pick([5, 6, 8]) : r.pick([6, 8]);
  const nz = level === 1 ? 3 : level === 2 ? 4 : 5;
  const zoneIds = r.sample(ZONES, nz).sort();
  const accts = ["acct_" + r.pick(["north", "nimbus", "nova"]), "acct_" + r.pick(["south", "summit", "solar"])];
  const nA = level === 3 ? 3 : 2;
  const zones = zoneIds.map((id, i) => ({ id, acct: i < nA ? accts[0] : accts[1] }));
  // The silent zone: no requests at all. At level 3 it sits in the first account.
  const silent = level === 3 ? zones[r.int(0, nA - 1)].id : r.pick(zoneIds);
  const traffic = zoneIds.filter((z) => z !== silent);
  const acctOf = (z) => zones.find((x) => x.id === z).acct;

  const deps = [];          // {zone|null, acct, rule, status, at}
  const affects = (d, z) => (d.zone === null ? d.acct === acctOf(z) : d.zone === z);
  const depsOf = (z) => deps.filter((d) => affects(d, z));
  const allTimes = () => deps.map((d) => d.at);
  const randTime = () => r.int(3 * 60, 21 * 60) * M + r.int(0, 59);
  const okTime = (t, zs, gap) => t >= 3 * H && t <= 21 * H && !allTimes().some((u) => Math.abs(u - t) < 60) &&
    zs.every((z) => depsOf(z).every((d) => Math.abs(d.at - t) >= gap));
  const add = (zone, acct, status, at) => {
    const d = { zone, acct, status, at, rule: r.pick(RULES) };
    deps.push(d);
    return d;
  };
  const placeFree = (zone, status, gap) => {
    for (let k = 0; k < 500; k++) {
      const t = randTime();
      if (okTime(t, [zone], gap)) return add(zone, acctOf(zone), status, t);
    }
    return null;
  };

  // Base deployments: every zone gets one or two, at least 2 h 10 min apart within the zone.
  const BIG = 2 * H + 10 * M;
  for (const z of zoneIds) {
    const n = z === silent ? 1 : level === 1 ? r.int(1, 2) : r.chance(0.35) ? 2 : 1;
    for (let i = 0; i < n; i++) placeFree(z, "succeeded", BIG);
  }
  if (level === 1) {
    placeFree(r.pick(zoneIds), "failed", BIG);
  } else {
    // A close pair (and sometimes a close predecessor) in one traffic zone: windows get cut.
    const z = r.pick(traffic);
    const base = depsOf(z)[0];
    for (let k = 0; k < 200; k++) {
      const t = base.at + r.int(15, 50) * M + r.int(0, 59);
      if (okTime(t, [z], 5 * M) && t <= 21 * H) { add(z, acctOf(z), "succeeded", t); break; }
    }
    if (r.chance(0.5)) {
      for (let k = 0; k < 200; k++) {
        const t = base.at - r.int(20, 55) * M - r.int(0, 59);
        if (okTime(t, [z], 5 * M) && t >= 3 * H) { add(z, acctOf(z), "succeeded", t); break; }
      }
    }
    // A failed deployment inside a succeeded one's window, in another traffic zone when possible.
    const z2 = traffic.length > 1 ? r.pick(traffic.filter((x) => x !== z)) : z;
    const host = depsOf(z2).filter((d) => d.status === "succeeded")[0];
    for (let k = 0; k < 200; k++) {
      const t = host.at + (r.chance(0.5) ? 1 : -1) * (r.int(10, 40) * M + r.int(0, 59));
      if (okTime(t, [z2], 5 * M)) { add(z2, acctOf(z2), "failed", t); break; }
    }
  }
  if (level === 3) {
    // An account-level deployment close to a zone-level one in a traffic zone of the first account.
    const azs = zones.filter((x) => x.acct === accts[0]).map((x) => x.id);
    const tz = r.pick(azs.filter((z) => z !== silent));
    const near = depsOf(tz).filter((d) => d.status === "succeeded" && d.zone !== null);
    for (let k = 0; k < 400; k++) {
      const t = r.pick(near).at + (r.chance(0.5) ? 1 : -1) * (r.int(15, 45) * M + r.int(0, 59));
      if (okTime(t, azs, 5 * M)) { add(null, accts[0], "succeeded", t); break; }
    }
    if (r.chance(0.5)) {
      const bzs = zones.filter((x) => x.acct === accts[1]).map((x) => x.id);
      for (let k = 0; k < 400; k++) {
        const t = randTime();
        if (okTime(t, bzs, 5 * M)) { add(null, accts[1], "succeeded", t); break; }
      }
    }
  }

  deps.sort((a, b) => a.at - b.at);
  let did = r.int(300, 900);
  const ver = new Map();
  for (const d of deps) {
    d.id = (did += r.int(1, 9));
    ver.set(d.rule, (ver.get(d.rule) || r.int(1, 6)) + 1);
    d.version = ver.get(d.rule);
  }

  // Requests, per traffic zone. Block probability changes at each succeeded deployment.
  const reqs = [];          // {zone, at, action, rule}
  const push = (z, t, forced = null) => reqs.push({ zone: z, at: t, forced });
  // The newly onboarded zone: its traffic starts shortly before its first deployment, so that
  // deployment's before window is under the floor.
  const fresh = r.pick(traffic);
  const freshFirst = depsOf(fresh).filter((d) => d.status === "succeeded")[0];
  for (const z of traffic) {
    const ds = depsOf(z);
    const sd = ds.filter((d) => d.status === "succeeded");
    // Traffic only around the deployments that affect the zone (merged ±65 min spans).
    const spans = [];
    for (const d of ds) {
      const a = Math.max(0, d.at - 65 * M), b = Math.min(86399, d.at + 65 * M);
      if (spans.length && a <= spans[spans.length - 1][1]) spans[spans.length - 1][1] = Math.max(spans[spans.length - 1][1], b);
      else spans.push([a, b]);
    }
    const gap = r.int(4, 6) * M;
    for (const [a, b] of spans) {
      for (let t = a + r.int(0, gap); t <= b; t += r.int(Math.floor(gap / 3), Math.floor((gap * 5) / 3))) {
        if (!(z === fresh && t < freshFirst.at)) push(z, t);
      }
    }
    if (z === fresh) {
      const k = r.int(1, floor - 1);
      for (let i = 0; i < k; i++) push(z, freshFirst.at - r.int(60, 25 * M));
    }
    // Boundary requests at succeeded deployments.
    push(z, r.pick(sd).at, "block");                          // exactly at T: after window
    const cands = sd.filter((d) => !(z === fresh && d === freshFirst));
    if (cands.length) push(z, r.pick(cands).at - H);         // exactly at T - 1 h: before window
    push(z, r.pick(sd).at + H);                               // exactly at T + 1 h: not in that window
  }
  const segP = new Map();
  for (const q of reqs) {
    const live = depsOf(q.zone).filter((d) => d.status === "succeeded" && d.at <= q.at);
    const key = q.zone + "|" + live.length;
    if (!segP.has(key)) segP.set(key, live.length === 0 ? 0.03 + r.next() * 0.12 : 0.02 + r.next() * 0.43);
    const p = segP.get(key);
    const x = r.next();
    q.action = q.forced || (x < p ? "block" : x < p + 0.08 ? "challenge" : x < p + 0.13 ? "log" : "allow");
    q.rule = q.action === "allow" ? null : live.length && r.chance(0.6) ? live[live.length - 1].rule : r.pick(RULES);
  }
  reqs.sort((a, b) => a.at - b.at || (a.zone < b.zone ? -1 : a.zone > b.zone ? 1 : 0));
  let rq = r.int(10000, 60000);
  for (const q of reqs) q.id = "rq_" + (rq += r.int(1, 7));

  // The oracle. Each opt breaks one rule, for diagnostics.
  const compute = (o = {}) => {
    const eff = deps.filter((d) => (o.includeFailed || d.status === "succeeded") && !(o.ignoreAccount && d.zone === null));
    const out = [];
    for (const d of eff) {
      const targets = d.zone !== null ? [d.zone] : zones.filter((x) => x.acct === d.acct).map((x) => x.id);
      for (const z of targets) {
        let lo = d.at - H, hi = d.at + H;
        if (!o.noCut) {
          for (const e of eff) {
            if (e === d || !affects(e, z)) continue;
            if (o.accountNoCut && (e.zone === null) !== (d.zone === null)) continue;
            if (e.at < d.at) lo = Math.max(lo, e.at);
            if (e.at > d.at) hi = Math.min(hi, e.at);
          }
        }
        let rb = 0, bb = 0, ra = 0, ba = 0;
        for (const q of reqs) {
          if (!o.allZones && q.zone !== z) continue;
          const inB = o.closed ? lo < q.at && q.at <= d.at : lo <= q.at && q.at < d.at;
          const inA = o.closed ? d.at < q.at && q.at <= hi : d.at <= q.at && q.at < hi;
          if (!inB && !inA) continue;
          let blk = q.action === "block" || (o.countChallenge && q.action === "challenge");
          if (o.ruleOnly && q.rule !== d.rule) blk = false;
          if (inB) { rb++; if (blk) bb++; } else { ra++; if (blk) ba++; }
        }
        if (o.dropEmpty && rb + ra === 0) continue;
        const ok = (n) => (o.noFloor ? n > 0 : n >= floor);
        const hb = ok(rb) ? pct100(bb, rb) : null, ha = ok(ra) ? pct100(ba, ra) : null;
        out.push([d.id, z, rb, hb === null ? null : hb / 100, ra, ha === null ? null : ha / 100,
          hb === null || ha === null ? null : (ha - hb) / 100]);
      }
    }
    return out.sort((a, b) => a[0] - b[0] || (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0));
  };
  const expected = compute();

  const diagnostics = [
    { message: "A window boundary is on the wrong side. Windows are half-open: a request logged exactly at deployed_at belongs to the hour after, one exactly an hour before belongs to the hour before, and one exactly an hour after belongs to neither.", rows: compute({ closed: true }) },
    { message: "Challenged requests were counted as blocked. In this exercise only action = 'block' is a block; 'challenge' and 'log' are not.", rows: compute({ countChallenge: true }) },
    { message: "Requests from other zones were counted. Each window counts only requests logged for the zone the row is about.", rows: compute({ allZones: true }) },
    { message: "Only blocks by the deployed rule were counted. The share is the zone's overall blocked share, whichever rule blocked the request.", rows: compute({ ruleOnly: true }) },
    { message: "A share was reported for a window under the floor. When a window holds fewer than " + floor + " requests its blocked_pct is NULL, and so is change_pp.", rows: compute({ noFloor: true }) },
    { message: "A deployment with no requests in either window is missing. Every succeeded deployment gets its row, with 0 requests and NULL shares; start from the deployments and LEFT JOIN the requests.", rows: compute({ dropEmpty: true }) },
    { message: "Failed deployments were reported (or used as boundaries). A failed deployment never took effect: it gets no row and never cuts another deployment's window.", rows: compute({ includeFailed: true }) },
  ];
  if (level >= 2) {
    diagnostics.push({ message: "Windows were not cut by neighbouring deployments. When another succeeded deployment affects the same zone within the hour, the before window starts at the previous one and the after window ends at the next one.", rows: compute({ noCut: true }) });
  }
  if (level === 3) {
    diagnostics.push(
      { message: "Account-level deployments are missing. A deployment with zone_id NULL applies to every zone of its account and is reported once per zone.", rows: compute({ ignoreAccount: true }) },
      { message: "Account-level and zone-level deployments did not cut each other's windows. Any succeeded deployment that applies to the zone, whatever its scope, bounds the windows of the others.", rows: compute({ accountNoCut: true }) },
    );
  }

  const stamp = (sec) => ts(DAY, sec);
  const zCols = ["zone_id", "account_id"];
  const dCols = ["deployment_id", "account_id", "zone_id", "rule_id", "version", "status", "deployed_at"];
  const qCols = ["request_id", "zone_id", "occurred_at", "action", "rule_id"];
  const zRows = zones.map((x) => [x.id, x.acct]);
  const dRows = deps.map((d) => [d.id, d.acct, d.zone, d.rule, d.version, d.status, stamp(d.at)]);
  const qRows = reqs.map((q) => [q.id, q.zone, stamp(q.at), q.action, q.rule]);
  const setup =
    "SET TIME ZONE 'UTC';\n" +
    "CREATE TABLE zones (\n  zone_id TEXT PRIMARY KEY,\n  account_id TEXT NOT NULL\n);\n" +
    "CREATE TABLE waf_deployments (\n  deployment_id INT PRIMARY KEY,\n  account_id TEXT NOT NULL,\n  zone_id TEXT REFERENCES zones (zone_id),\n  rule_id TEXT NOT NULL,\n  version INT NOT NULL,\n  status TEXT NOT NULL CHECK (status IN ('succeeded','failed')),\n  deployed_at TIMESTAMPTZ NOT NULL\n);\n" +
    "CREATE TABLE requests (\n  request_id TEXT PRIMARY KEY,\n  zone_id TEXT NOT NULL REFERENCES zones (zone_id),\n  occurred_at TIMESTAMPTZ NOT NULL,\n  action TEXT NOT NULL CHECK (action IN ('allow','block','challenge','log')),\n  rule_id TEXT\n);\n" +
    insertSQL("zones", zCols, zRows) + insertSQL("waf_deployments", dCols, dRows) + insertSQL("requests", qCols, qRows);

  return {
    vars: {
      min_requests: floor,
      zones: zRows.length,
      deployments: dRows.length,
      requests: qRows.length,
      window_rule: level === 1
        ? "In this sample, deployments that affect the same zone are at least two hours apart, so every window is a full hour."
        : "When another succeeded deployment affects the same zone less than an hour away, the windows stop there: the before window starts at the later of `deployed_at − 1 hour` and the previous such deployment, and the after window ends at the earlier of `deployed_at + 1 hour` and the next one.",
      scope_rule: level === 3
        ? "A deployment with `zone_id` NULL is account-level: it applies to every zone of its `account_id` in `zones`, is reported once per such zone, and bounds those zones' windows like any other deployment that affects them."
        : "Every deployment in this sample targets one zone (`zone_id` is never NULL).",
    },
    setup,
    tables: [
      { name: "zones", columns: zCols, rows: zRows },
      { name: "waf_deployments", columns: dCols, rows: dRows },
      { name: "requests", columns: qCols, rows: qRows },
    ],
    expected: { columns: ["deployment_id", "zone_id", "requests_before", "blocked_pct_before", "requests_after", "blocked_pct_after", "change_pp"], rows: expected },
    diagnostics: diagnostics.filter((d) => JSON.stringify(d.rows) !== JSON.stringify(expected)),
  };
}
