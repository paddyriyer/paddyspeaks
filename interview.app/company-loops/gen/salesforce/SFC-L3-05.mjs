/* SFC-L3-05 — API allocation use: org-days that crossed 80% and 100% of their daily allocation (SQL).
   Simulated practice scenario. All data, names, editions and numbers are generated from the seed
   and are hypothetical; the allocation formula is this exercise's rule, not a product's.

   One row per (org_id, usage_day) whose day total reached at least 80% of that day's allocation:
     allocation      LEAST(base_requests + per_licence * licences, max_requests) + active add-ons, where
                     the edition and the licence count are the ones in force at the start of the day
                     (latest row with effective_at <= 00:00 UTC of that day) and an add-on is active on
                     days starts_on <= day <= ends_on (both inclusive);
     requests        the day's total over hourly buckets (UTC days);
     pct_used        ROUND(100 * requests / allocation, 1), half away from zero;
     crossed_80_at   hour_start of the first bucket at which the day's running total reached 80%;
     crossed_100_at  same for 100%, NULL when the day never reached it.
   level: 1 Medium (licence changes at exactly 00:00 and mid-day, add-ons, a day landing exactly on 80%,
                    a bucket landing exactly on 100%)
          2 Hard (+ a binding edition cap, an add-on ending exactly on a reported day, both thresholds
                  crossed in one bucket, licence decreases)
          3 Very Hard (+ edition upgrades inside the window, and a usage feed that re-loads an hour with
                       a corrected count: the latest loaded_at replaces earlier loads) */
import { insertSQL } from "../../js/rng.js";

export const kind = "sql";

const H = 3600, DAY = 86400;
const BASE = Date.UTC(2026, 8, 7) / 1000;                       // 2026-09-07 00:00 UTC (a Monday)
const EDITIONS = ["business", "enterprise", "growth", "premier", "scale", "team"];
const ORGS = ["org_acorn", "org_beacon", "org_cobalt", "org_delta", "org_ember", "org_fjord", "org_garnet", "org_harbor", "org_indigo", "org_juniper"];

const iso = (sec) => new Date((BASE + sec) * 1000).toISOString();
const stamp = (sec) => { const s = iso(sec); return s.slice(0, 10) + " " + s.slice(11, 19) + "+00"; };
const dateOf = (dayIdx) => iso(dayIdx * DAY).slice(0, 10);

export function generate(r, level) {
  const D = level === 1 ? 3 : level === 2 ? 4 : 5;                 // days in the usage window
  const nOrg = level === 1 ? 4 : level === 2 ? r.int(5, 6) : r.int(6, 7);
  const orgs = r.sample(ORGS, nOrg).sort();

  // Editions: allocation = LEAST(base + per_licence * licences, max_requests). All multiples of 50.
  const edNames = r.sample(EDITIONS, level === 1 ? 2 : 3).sort();
  const editions = edNames.map((name) => {
    const base = 500 * r.int(4, 16), per = 50 * r.int(2, 6);
    return { name, base, per, cap: Math.ceil((base + per * 200) / 1000) * 1000 };   // never binds by default
  });
  let capEd = null, capOrg = null;
  if (level >= 2) {
    capEd = r.pick(editions);
    capEd.cap = Math.ceil((capEd.base + capEd.per * r.int(25, 35)) / 1000) * 1000;  // binds above ~35 licences
  }
  const edOf = (name) => editions.find((e) => e.name === name);

  // Histories. Times are seconds from BASE; every org has rows well before the window.
  const used = new Set();
  const uniq = (org, t) => { while (used.has(org + "|" + t)) t += 1; used.add(org + "|" + t); return t; };
  const lic = [], eds = [];
  const special = [];                                                // [org, day, why] that must be reported
  const pickDistinct = (xs, k) => r.sample(xs, Math.min(k, xs.length));
  const [orgA, orgB, orgC, orgE] = pickDistinct(orgs, 4);
  if (level >= 2) capOrg = orgC;
  for (const o of orgs) {
    const ed = o === capOrg ? capEd.name : r.pick(edNames);
    eds.push({ org: o, ed, at: uniq("e" + o, -r.int(20, 400) * DAY + r.int(0, DAY - 1)) });
    const n0 = o === capOrg ? r.int(45, 70) : r.int(5, 40);
    lic.push({ org: o, n: n0, at: uniq("l" + o, -r.int(5, 300) * DAY + r.int(0, DAY - 1)) });
  }
  const licAt = (o, t, cmp) => {                                     // licences in force at t
    let best = null;
    for (const x of lic) if (x.org === o && cmp(x.at, t) && (!best || x.at > best.at)) best = x;
    return best.n;
  };
  const change = (o, at) => {
    const cur = licAt(o, at, (a, b) => a <= b);
    let n = cur + (r.chance(level === 1 ? 0.8 : 0.5) ? r.int(3, 15) : -r.int(2, 6));
    if (n < 1 || n === cur) n = cur + r.int(3, 15);
    lic.push({ org: o, n, at: uniq("l" + o, at) });
  };
  // A change at exactly 00:00 of a day (applies that day) and one mid-day (applies from the next day).
  const dA = r.int(1, D - 1);
  change(orgA, dA * DAY);
  special.push([orgA, dA]);
  const dB = r.int(0, D - 1);
  change(orgB, dB * DAY + r.int(1, 22) * H + r.int(0, 59) * 60);
  special.push([orgB, dB]);
  if (level >= 2) {
    for (const o of orgs) if (o !== capOrg && r.chance(0.35)) change(o, r.int(0, D * DAY - 1));
    special.push([capOrg, r.int(0, D - 1)]);
  }
  if (level === 3) {                                                 // an edition upgrade inside the window
    const cur = eds.find((x) => x.org === orgE).ed;
    const to = r.pick(edNames.filter((n) => n !== cur));
    const dE = r.int(1, D - 1);
    const at = r.chance(0.5) ? dE * DAY : (dE - 1) * DAY + r.int(1, 22) * H;
    eds.push({ org: orgE, ed: to, at: uniq("e" + orgE, at) });
    special.push([orgE, dE]);
    if (at % DAY) special.push([orgE, dE - 1]);
  }

  // Add-ons: extra requests on top of the capped allocation, active starts_on..ends_on inclusive.
  const addons = [];
  const addon = (o, s, e) => addons.push({ org: o, extra: 500 * r.int(2, 10), s, e });
  addon(r.pick(orgs), r.int(0, D - 1), r.int(0, D - 1) + r.int(0, 2));
  if (addons[0].e < addons[0].s) addons[0].e = addons[0].s;
  special.push([addons[0].org, addons[0].s]);                         // a reported day the add-on covers
  if (level >= 2) {
    const o = r.pick(orgs), dX = r.int(0, D - 2);
    addon(o, dX - r.int(0, 2), dX);                                  // ends exactly on a reported day
    special.push([o, dX]);
    addon(r.pick(orgs), -r.int(10, 20), -r.int(1, 5));               // ended before the window
  }

  const edAt = (o, t, current) => {
    let best = null;
    for (const x of eds) if (x.org === o && (current || x.at <= t) && (!best || x.at > best.at)) best = x;
    return edOf(best.ed);
  };
  const allocation = (o, d, opts = {}) => {
    const t0 = d * DAY;
    const n = opts.lic === "current" ? licAt(o, Infinity, () => true)
      : opts.lic === "strict" ? licAt(o, t0, (a, b) => a < b)
      : opts.lic === "end" ? licAt(o, t0 + DAY, (a, b) => a < b)
      : licAt(o, t0, (a, b) => a <= b);
    const e = edAt(o, t0, opts.edCurrent);
    const raw = e.base + e.per * n;
    let a = opts.noCap ? raw : Math.min(raw, e.cap);
    if (!opts.noAddon) for (const x of addons) if (x.org === o && x.s <= d && (opts.addonExcl ? d < x.e : d <= x.e)) a += x.extra;
    return a;
  };

  // Usage targets per org-day.
  const target = new Map();
  for (const o of orgs) for (let d = 0; d < D; d++) {
    const u = r.next();
    target.set(o + "|" + d, u < 0.15 ? "none" : u < 0.5 ? "low" : u < 0.75 ? "warn" : "over");
  }
  for (const [o, d] of special) target.set(o + "|" + d, r.chance(0.5) ? "warn" : "over");
  const keys = r.shuffle([...target.keys()]);
  target.set(keys[0], "e80");
  target.set(keys[1], "e100");
  if (level >= 2) target.set(keys[2], "same");

  const split = (total, k) => {                                      // k positive parts summing to total
    if (k <= 0) return [];
    const cuts = new Set();
    while (cuts.size < k - 1) cuts.add(r.int(1, total - 1));
    const c = [0, ...[...cuts].sort((a, b) => a - b), total];
    return c.slice(1).map((v, i) => v - c[i]);
  };
  const usage = [];                                                  // the true hourly counts
  for (const o of orgs) for (let d = 0; d < D; d++) {
    const t = target.get(o + "|" + d);
    if (t === "none") continue;
    const A = allocation(o, d), A80 = (A * 4) / 5;
    const k = r.int(3, level === 3 ? 6 : 7);
    const hours = r.sample([...Array(24).keys()], k).sort((a, b) => a - b);
    let parts;
    if (t === "low") parts = split(r.int(Math.ceil(0.3 * A), A80 - 1), k);
    else if (t === "warn") parts = split(r.int(A80 + 1, A - 1), k);
    else if (t === "over") parts = split(r.int(A + 1, Math.floor(1.3 * A)), k);
    else if (t === "e80") {
      const j = r.chance(0.3) ? k : r.int(1, k - 1);
      parts = [...split(A80, j), ...split(r.int(k - j, Math.floor(0.19 * A)), k - j)];
    } else if (t === "e100") {
      const j = r.int(1, k);
      parts = [...split(A, j), ...split(r.int(k - j, Math.floor(0.25 * A)), k - j)];
    } else {                                                         // "same": 80% and 100% in one bucket
      const j = r.int(0, k - 2);
      const p = j === 0 ? 0 : r.int(Math.max(j, Math.ceil(0.3 * A)), A80 - 1);
      parts = [...split(p, j), A - p + r.int(0, Math.floor(0.1 * A)), ...split(r.int(k - j - 1, Math.floor(0.2 * A)), k - j - 1)];
    }
    hours.forEach((h, i) => usage.push({ org: o, at: d * DAY + h * H, n: parts[i] }));
  }

  // Loads. Level 3 re-loads some hours: an earlier preliminary count, then the corrected one.
  const loads = [];
  for (const u of usage) {
    const first = u.at + H + r.int(60, 1800);
    loads.push({ org: u.org, at: u.at, n: u.n, ld: first });
  }
  if (level === 3) {
    const reported = usage.filter((u) => ["warn", "over", "e80", "e100", "same"].includes(target.get(u.org + "|" + Math.floor(u.at / DAY))) && u.n >= 2);
    const forced = r.sample(reported, 2);
    for (let i = 0; i < usage.length; i++) {
      const u = usage[i], L = loads[i];
      if (!(forced.includes(u) || (u.n >= 2 && r.chance(0.15)))) continue;
      const pre = r.chance(0.7) ? u.n - r.int(1, u.n - 1) : u.n + r.int(1, Math.max(1, Math.floor(u.n / 3)));
      loads.push({ org: u.org, at: u.at, n: pre, ld: L.ld });        // the preliminary load
      L.ld += r.int(1800, 6 * H);                                    // the correction arrives later
      if (r.chance(0.2)) loads.push({ org: u.org, at: u.at, n: pre + r.int(1, 9), ld: L.ld - r.int(60, 1500) });
    }
  }
  loads.sort((a, b) => a.ld - b.ld || (a.org < b.org ? -1 : a.org > b.org ? 1 : a.at - b.at));

  // The oracle. opts break one rule each, for diagnostics.
  const compute = (opts = {}) => {
    const per = new Map();                                           // org|hour -> requests
    const byKey = new Map();
    for (const L of loads) {
      const key = L.org + "|" + L.at;
      if (!byKey.has(key)) byKey.set(key, []);
      byKey.get(key).push(L);
    }
    for (const [key, ls] of byKey) {
      const v = opts.sumLoads ? ls.reduce((s, x) => s + x.n, 0)
        : opts.earliest ? ls.reduce((m, x) => (x.ld < m.ld ? x : m)).n
        : ls.reduce((m, x) => (x.ld > m.ld ? x : m)).n;
      per.set(key, v);
    }
    const ge = (a, b) => (opts.strict ? a > b : a >= b);
    const out = [];
    for (const o of orgs) {
      const hrs = [...per.keys()].filter((k) => k.startsWith(o + "|")).map((k) => Number(k.split("|")[1])).sort((a, b) => a - b);
      let carry = 0;
      for (let d = 0; d < D; d++) {
        const day = hrs.filter((t) => Math.floor(t / DAY) === d);
        if (!day.length) continue;
        const A = allocation(o, d, opts);
        const total = day.reduce((s, t) => s + per.get(o + "|" + t), 0);
        let cum = opts.noReset ? carry : 0, c80 = null, c100 = null;
        for (const t of day) {
          cum += per.get(o + "|" + t);
          if (c80 === null && ge(cum * 100, A * 80)) c80 = t;
          if (c100 === null && ge(cum, A)) c100 = t;
        }
        carry += total;
        if (!ge(total * 100, A * 80)) continue;
        if (opts.only100 && total < A) continue;
        const pct = opts.intPct ? Math.floor((100 * total) / A) : Math.floor((2000 * total + A) / (2 * A)) / 10;
        out.push({ d, o, row: [o, dateOf(d), A, total, pct, stamp(c80), c100 === null ? null : stamp(c100)] });
      }
    }
    out.sort((a, b) => a.d - b.d || (a.o < b.o ? -1 : a.o > b.o ? 1 : 0));
    return out.map((x) => x.row);
  };
  const expected = compute();

  const diagnostics = [
    { message: "A threshold was treated as exclusive. A day that reaches exactly 80% (or a bucket that brings the running total to exactly 100%) has crossed it: compare with >=, and compare integers (requests * 100 >= allocation * 80) rather than rounded percentages.", rows: compute({ strict: true }) },
    { message: "Every day used the org's current licence count. The allocation of a past day uses the licences in force at the start of that day: the latest licence_changes row with effective_at at or before 00:00 UTC of the day.", rows: compute({ lic: "current" }) },
    { message: "A licence change during the day was applied to that same day. In this exercise's rule the allocation is fixed at the start of the day (00:00 UTC); a change at 14:00 counts from the next day.", rows: compute({ lic: "end" }) },
    { message: "A licence change effective exactly at 00:00 was not applied to that day. In force at the start of the day means effective_at <= the day's start, inclusive.", rows: compute({ lic: "strict" }) },
    { message: "Add-ons were ignored. An active add-on's extra_requests are added on top of the licence-based (capped) allocation.", rows: compute({ noAddon: true }) },
    { message: "The running total was not reset at midnight. The 80% and 100% crossings are per day: partition the running SUM by org_id and usage day.", rows: compute({ noReset: true }) },
    { message: "Days that reached 80% but not 100% are missing. Every day at or above 80% is reported; crossed_100_at is NULL when the day never reached its allocation.", rows: compute({ only100: true }) },
    { message: "pct_used was computed with integer division and lost its decimal. Use 100.0 * requests / allocation (or a cast) before ROUND(…, 1).", rows: compute({ intPct: true }) },
  ];
  if (level >= 2) {
    diagnostics.push(
      { message: "The edition's max_requests cap was ignored. The licence-based allocation is LEAST(base_requests + per_licence * licences, max_requests); add-ons come on top of the cap.", rows: compute({ noCap: true }) },
      { message: "An add-on's ends_on was treated as exclusive. Add-ons are active from starts_on through ends_on, both days included.", rows: compute({ addonExcl: true }) },
    );
  }
  if (level === 3) {
    diagnostics.push(
      { message: "Every load of a re-loaded hour was summed. A re-load is a corrected count that replaces the earlier one: keep the row with the latest loaded_at per (org_id, hour_start).", rows: compute({ sumLoads: true }) },
      { message: "The earliest load of a re-loaded hour was kept. The latest loaded_at is the corrected count.", rows: compute({ earliest: true }) },
      { message: "Every day used the org's current edition. The edition, like the licence count, is the one in force at the start of the day.", rows: compute({ edCurrent: true }) },
    );
  }

  const eCols = ["edition", "base_requests", "per_licence", "max_requests"];
  const oeCols = ["org_id", "edition", "effective_at"];
  const lCols = ["org_id", "licences", "effective_at"];
  const aCols = ["addon_id", "org_id", "extra_requests", "starts_on", "ends_on"];
  const uCols = ["org_id", "hour_start", "requests", "loaded_at"];
  const eRows = editions.map((e) => [e.name, e.base, e.per, e.cap]);
  const oeRows = eds.slice().sort((a, b) => (a.org < b.org ? -1 : a.org > b.org ? 1 : a.at - b.at)).map((x) => [x.org, x.ed, stamp(x.at)]);
  const lRows = lic.slice().sort((a, b) => (a.org < b.org ? -1 : a.org > b.org ? 1 : a.at - b.at)).map((x) => [x.org, x.n, stamp(x.at)]);
  let aid = 100 + r.int(0, 800);
  const aRows = addons.slice().sort((a, b) => a.s - b.s).map((x) => ["ao_" + aid++, x.org, x.extra, dateOf(x.s), dateOf(x.e)]);
  const uRows = loads.map((L) => [L.org, stamp(L.at), L.n, stamp(L.ld)]);

  const pk = level === 3 ? "PRIMARY KEY (org_id, hour_start, loaded_at)" : "PRIMARY KEY (org_id, hour_start)";
  const setup =
    "SET TIME ZONE 'UTC';\n" +
    "CREATE TABLE editions (\n  edition TEXT PRIMARY KEY,\n  base_requests INT NOT NULL,\n  per_licence INT NOT NULL,\n  max_requests INT NOT NULL\n);\n" +
    "CREATE TABLE org_editions (\n  org_id TEXT NOT NULL,\n  edition TEXT NOT NULL REFERENCES editions (edition),\n  effective_at TIMESTAMPTZ NOT NULL,\n  PRIMARY KEY (org_id, effective_at)\n);\n" +
    "CREATE TABLE licence_changes (\n  org_id TEXT NOT NULL,\n  licences INT NOT NULL CHECK (licences > 0),\n  effective_at TIMESTAMPTZ NOT NULL,\n  PRIMARY KEY (org_id, effective_at)\n);\n" +
    "CREATE TABLE allocation_addons (\n  addon_id TEXT PRIMARY KEY,\n  org_id TEXT NOT NULL,\n  extra_requests INT NOT NULL CHECK (extra_requests > 0),\n  starts_on DATE NOT NULL,\n  ends_on DATE NOT NULL CHECK (ends_on >= starts_on)\n);\n" +
    "CREATE TABLE api_usage (\n  org_id TEXT NOT NULL,\n  hour_start TIMESTAMPTZ NOT NULL,\n  requests INT NOT NULL CHECK (requests >= 0),\n  loaded_at TIMESTAMPTZ NOT NULL,\n  " + pk + "\n);\n" +
    insertSQL("editions", eCols, eRows) + insertSQL("org_editions", oeCols, oeRows) + insertSQL("licence_changes", lCols, lRows) +
    insertSQL("allocation_addons", aCols, aRows) + insertSQL("api_usage", uCols, uRows);

  return {
    vars: {
      first_day: dateOf(0),
      last_day: dateOf(D - 1),
      orgs: orgs.length,
      usage_rows: uRows.length,
      feed_rule: level === 3
        ? "The usage feed re-loads an hour when late requests are counted: the same (org_id, hour_start) can appear several times with different `loaded_at`, and the row with the latest `loaded_at` is the corrected count. It replaces the earlier loads; it is not added to them."
        : "Each (org_id, hour_start) appears once; `loaded_at` is only when the row reached the warehouse.",
    },
    setup,
    tables: [
      { name: "editions", columns: eCols, rows: eRows },
      { name: "org_editions", columns: oeCols, rows: oeRows },
      { name: "licence_changes", columns: lCols, rows: lRows },
      { name: "allocation_addons", columns: aCols, rows: aRows },
      { name: "api_usage", columns: uCols, rows: uRows },
    ],
    expected: { columns: ["org_id", "usage_day", "allocation", "requests", "pct_used", "crossed_80_at", "crossed_100_at"], rows: expected },
    diagnostics: diagnostics.filter((d) => JSON.stringify(d.rows) !== JSON.stringify(expected)),
  };
}
