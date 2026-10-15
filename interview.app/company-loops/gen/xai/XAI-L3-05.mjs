/* XAI-L3-05 — Spend tier reached: the first UTC day a team's cumulative spend met each of this
   exercise's tier thresholds, and its 429 rejections in the 7 days before and after (SQL).
   Simulated practice scenario. Teams, spend, thresholds and requests are generated from the seed and
   are hypothetical; the tier thresholds and the spend rules are this exercise's rules (check current
   docs for how real spend tiers work).

   One row per (team, tier) the team reached, ordered by team_id, tier:
     reached_on           the first UTC day in the sample whose END-OF-DAY cumulative spend is at least
                          the tier's threshold in force that day. Cumulative spend counts kinds
                          'charge' (positive) and 'refund' (negative) only; 'promotional_credit' rows
                          are usage paid by free credits and never count. A tier is reached once.
     rejected_7d_before   429 rows in request_errors for the team on reached_on-7 .. reached_on-1
     rejected_7d_after    429 rows on reached_on+1 .. reached_on+7
                          (the upgrade day is in neither; a window not wholly inside the sample is NULL)
   level: 1 Medium (one threshold version, charges only, a two-tier jump in one day, a threshold met
                    exactly, 429s on the window boundaries, other error codes)
          2 Hard (+ refunds: a charge refunded the same day it crossed a threshold, a dip below a
                  reached tier and a second crossing; windows that run off either end of the sample)
          3 Very Hard (+ a second threshold version that lowers one tier, so a team reaches it on a
                       day it spent nothing; promotional-credit usage that must not count) */
import { insertSQL, pad2, ts } from "../../js/rng.js";

export const kind = "sql";

const BASE = Date.UTC(2026, 5, 1) / 1000;                       // 2026-06-01
const MODELS = ["model-large", "model-fast", "model-mini", "model-vision", "model-code"];
const OTHER_CODES = [400, 500, 503];

function day(base, i) {
  const d = new Date((base + i * 86400) * 1000);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

export function generate(r, level) {
  const base = BASE + r.int(0, 40) * 86400;
  const D = level === 1 ? r.int(50, 58) : level === 2 ? r.int(56, 63) : r.int(63, 70);
  const nTiers = level === 1 ? 3 : 4;
  const nTeams = level === 1 ? 4 : level === 2 ? 5 : 6;

  // Thresholds (cents). Each tier at least 4x the one before.
  const t1 = r.pick([5000, 10000, 20000, 25000]);
  const T = [t1];
  for (let k = 1; k < nTiers; k++) T.push(T[k - 1] * r.pick([4, 5]));
  // Versions: [{from: day index or null (long before), to: day index or null, thr: [...]}]
  const versions = [{ from: null, to: null, thr: T.slice() }];
  let dx = null;                                                 // level 3: the day v2 starts
  if (level === 3) {
    dx = r.int(Math.floor(D / 3) + 3, Math.floor((2 * D) / 3));
    const T2 = T.slice();
    T2[1] = T[1] - 2 * t1;                                       // tier 2 lowered (still > t1)
    versions[0].to = dx;
    versions.push({ from: dx, to: null, thr: T2 });
  }
  const thrOn = (k, d, latestOnly) => {                          // k is 0-based
    if (latestOnly) return versions[versions.length - 1].thr[k];
    const v = versions.find((x) => (x.from === null || d >= x.from) && (x.to === null || d < x.to));
    return v.thr[k];
  };

  // Teams.
  const ids = new Set();
  while (ids.size < nTeams) ids.add("team_" + String(r.int(1000, 9899)));
  const teams = [...ids].sort().map((id) => ({ id, events: [], used: new Set() }));
  const smallMax = Math.max(2, Math.floor(t1 / (2 * D)));

  // A unique second of day per team and day, so no two of a team's events tie.
  const second = (tm, d, lo, hi) => {
    for (;;) {
      const s = r.int(lo, hi);
      const k = d * 86400 + s;
      if (!tm.used.has(k)) { tm.used.add(k); return s; }
    }
  };
  const add = (tm, d, s, kindName, amt) => tm.events.push({ d, s, kind: kindName, amt });
  const cumEnd = (tm, d) => tm.events.reduce((a, e) => a + (e.kind !== "promotional_credit" && e.d <= d ? e.amt : 0), 0);

  // Small daily charges: never enough on their own to move a team past the next threshold.
  const lIdx = level === 3 ? r.int(0, nTeams - 1) : -1;
  const lTeam = lIdx >= 0 ? teams[lIdx] : null;                 // the lowered-threshold team
  for (const tm of teams) {
    for (let d = 0; d < D; d++) {
      if (tm === lTeam && d === dx) continue;                   // spends nothing on the change day
      if (r.chance(0.6)) add(tm, d, second(tm, d, 0, 86399), "charge", r.int(1, smallMax));
    }
  }
  if (lTeam && !lTeam.events.some((e) => e.d > dx + 1)) add(lTeam, dx + 2, second(lTeam, dx + 2, 0, 86399), "charge", r.int(1, smallMax));

  // Planned actions per team, processed in day order.
  const lo = level === 1 ? 8 : 1, hi = level === 1 ? D - 9 : D - 2;
  const actions = [];
  const others = r.shuffle(teams.map((_, i) => i).filter((i) => i !== lIdx));
  const exactTeam = others[0], jumpTeam = others[1];
  let edgeTeam = null, dipTeam = null;
  if (level >= 2) {
    const rest = teams.map((_, i) => i).filter((i) => i !== jumpTeam && teams[i] !== lTeam);
    edgeTeam = r.pick(rest);
    dipTeam = r.pick(rest.filter((i) => i !== edgeTeam));
  }
  teams.forEach((tm, i) => {
    if (tm === lTeam) {
      const d1 = r.int(2, Math.max(3, dx - 12));
      actions.push({ tm, d: d1, k: 0, extra: r.int(1, Math.floor(t1 / 4)) });
      actions.push({ tm, d: dx - r.int(2, 4), k: -2, extra: r.int(1, Math.floor(t1 / 2)) }); // above new t2, below old
      if (r.chance(0.5)) actions.push({ tm, d: r.int(dx + 3, D - 2), k: 2, extra: r.int(1, Math.floor(t1 / 4)) });
      return;
    }
    let top;                                                     // highest tier this team reaches
    if (i === jumpTeam) top = r.int(1, nTiers - 1);
    else top = r.int(0, nTiers - 1);
    const steps = [];
    if (i === jumpTeam) {                                        // tiers top-1 and top on one day
      for (let k = 0; k < top - 1; k++) steps.push([k]);
      steps.push([top - 1, top]);
    } else for (let k = 0; k <= top; k++) steps.push([k]);
    const span = hi - lo + 1;
    const days = r.shuffle(Array.from({ length: span }, (_, j) => lo + j)).slice(0, steps.length).sort((a, b) => a - b);
    steps.forEach((ks, j) => {
      const exact = i === exactTeam && j === steps.length - 1;
      actions.push({ tm, d: days[j], k: ks[ks.length - 1], extra: exact ? 0 : r.int(1, Math.floor(t1 / 4)) });
    });
    if (i === dipTeam) {                                         // dip below the last tier, cross again
      const last = actions[actions.length - 1];
      if (last.d + 5 <= D - 1) {
        const dipD = last.d + r.int(1, 2);
        actions.push({ tm, d: dipD, dip: last.k, z: r.int(1, Math.floor(t1 / 4)) });
        actions.push({ tm, d: r.int(dipD + 2, Math.min(D - 1, dipD + 8)), k: last.k, extra: r.int(1, Math.floor(t1 / 4)), recross: true });
      }
    }
    if (i === edgeTeam) {                                        // same-day refund of a crossing charge
      const first = actions.find((a) => a.tm === tm && a.k !== undefined);
      if (first.d >= 2) actions.push({ tm, d: r.int(0, first.d - 1), intraday: first.k });
    }
  });
  if (level >= 2 && !actions.some((a) => a.d > D - 8 && a.k !== undefined)) {   // an after window off the end
    for (const i of others) {
      const late = teams[i];
      const reached = Math.max(...actions.filter((a) => a.tm === late).map((a) => a.k ?? -1));
      if (reached + 1 < nTiers) {
        actions.push({ tm: late, d: r.int(D - 6, D - 2), k: reached + 1, extra: r.int(1, Math.floor(t1 / 4)) });
        break;
      }
    }
  }
  actions.sort((a, b) => a.d - b.d || (a.intraday !== undefined) - (b.intraday !== undefined));
  for (const a of actions) {
    const tm = a.tm;
    if (a.intraday !== undefined) {                              // crosses at 09:xx, refunded at 17:xx
      const c = cumEnd(tm, a.d);
      const need = thrOn(a.intraday, a.d) - c;
      if (need <= 0) continue;
      const amt = need + r.int(1, Math.floor(t1 / 4)) + 3 * smallMax;   // above it whatever else that day
      // the running total must be below the threshold until this charge
      const s1 = second(tm, a.d, 9 * 3600, 10 * 3600 - 1), s2 = second(tm, a.d, 17 * 3600, 18 * 3600 - 1);
      add(tm, a.d, s1, "charge", amt);
      add(tm, a.d, s2, "refund", -amt);
    } else if (a.dip !== undefined) {
      const c = cumEnd(tm, a.d);
      const amt = c - thrOn(a.dip, a.d) + a.z;
      if (amt > 0) add(tm, a.d, second(tm, a.d, 0, 86399), "refund", -amt);
    } else {
      const thr = a.k === -2 ? thrOn(1, a.d, true) : thrOn(a.k, a.d);
      const c = cumEnd(tm, a.d);
      const amt = thr - c + a.extra;
      if (amt > 0) add(tm, a.d, second(tm, a.d, 0, 86399), "charge", amt);
    }
  }

  // Promotional credits (level 3): usage paid by free credits, including one that would cross early.
  if (level === 3) {
    for (const tm of teams) for (let d = 0; d < D; d++) if (r.chance(0.08)) add(tm, d, second(tm, d, 0, 86399), "promotional_credit", r.int(1, smallMax * 3));
    const tm = teams.find((x) => x !== lTeam);
    const firstReach = (() => { for (let d = 0; d < D; d++) if (cumEnd(tm, d) >= thrOn(0, d)) return d; return null; })();
    if (firstReach !== null && firstReach >= 2) {
      const e = r.int(0, firstReach - 1);
      add(tm, e, second(tm, e, 0, 86399), "promotional_credit", thrOn(0, e) - cumEnd(tm, e) + r.int(1, smallMax));
    }
  }

  // Request errors: background 429s and other codes, plus window-boundary rows around crossings.
  const errs = [];
  const errSecs = new Set();
  const addErr = (tm, d, s, code) => {
    if (d < 0 || d >= D) return;
    const k = tm.id + "|" + (d * 86400 + s);
    if (errSecs.has(k)) return;
    errSecs.add(k);
    errs.push({ team: tm.id, d, s, code, model: r.pick(MODELS), limit: code === 429 ? r.pick(["requests_per_second", "tokens_per_minute"]) : null });
  };
  for (const tm of teams) {
    for (let d = 0; d < D; d++) {
      if (r.chance(0.3)) for (let j = r.int(1, 3); j > 0; j--) addErr(tm, d, r.int(0, 86399), 429);
      if (r.chance(0.12)) addErr(tm, d, r.int(0, 86399), r.pick(OTHER_CODES));
    }
  }

  // The oracle. opts break one rule each, for diagnostics.
  const reachedFor = (tm, opts) => {
    const counts = (e) => e.kind === "charge" || (e.kind === "refund" && !opts.noRefunds) || (e.kind === "promotional_credit" && opts.promo);
    const out = [];
    const cum = [];
    let run = 0;
    const byDay = Array.from({ length: D }, () => 0);
    const hasEvent = Array.from({ length: D }, () => false);
    for (const e of tm.events) if (counts(e)) { byDay[e.d] += e.amt; hasEvent[e.d] = true; }
    for (let d = 0; d < D; d++) { run += byDay[d]; cum.push(run); }
    const meets = (c, k, d) => (opts.strict ? c > thrOn(k, d, opts.latest) : c >= thrOn(k, d, opts.latest));
    for (let k = 0; k < nTiers; k++) {
      let hit = null;
      if (opts.intraday) {
        const evs = tm.events.filter(counts).sort((a, b) => a.d - b.d || a.s - b.s);
        let rt = 0;
        for (const e of evs) { rt += e.amt; if (meets(rt, k, e.d)) { hit = e.d; break; } }
      } else if (opts.lastCross) {
        for (let d = 0; d < D; d++) if (meets(cum[d], k, d) && (d === 0 || !meets(cum[d - 1], k, d - 1))) hit = d;
      } else {
        for (let d = 0; d < D; d++) {
          if (opts.eventDays && !hasEvent[d]) continue;
          if (meets(cum[d], k, d)) { hit = d; break; }
        }
      }
      if (hit !== null) out.push([k + 1, hit]);
    }
    return out;
  };
  const rej = (team, from, to, opts) => errs.filter((x) => x.team === team && (x.code === 429 || opts.allCodes) &&
    (opts.tsUpper && to > from
      ? (x.d >= from && x.d < to) || (x.d === to && x.s === 0)
      : x.d >= from && x.d <= to)).length;
  const compute = (opts = {}) => {
    const rows = [];
    for (const tm of teams) {
      for (const [tier, d] of reachedFor(tm, opts)) {
        const bFrom = d - 7, bTo = opts.beforeInclDay ? d : d - 1;
        const aFrom = opts.afterInclDay ? d : d + 1, aTo = d + 7;
        const bOk = opts.noNull || bFrom >= 0, aOk = opts.noNull || aTo <= D - 1;
        rows.push([tm.id, tier, day(base, d),
          bOk ? rej(tm.id, bFrom, bTo, { ...opts, tsUpper: false }) : null,
          aOk ? rej(tm.id, aFrom, aTo, opts) : null]);
      }
    }
    return rows;
  };

  // Boundary rows around every reached day (correct rule), then compute.
  for (const tm of teams) {
    for (const [, d] of reachedFor(tm, {})) {
      if (r.chance(0.7)) addErr(tm, d - 7, 0, 429);              // first second of the before window
      if (r.chance(0.7)) addErr(tm, d - 8, 86399, 429);          // last second before it
      addErr(tm, d, r.int(0, 86399), 429);                       // the upgrade day itself
      addErr(tm, d + 7, 86399, 429);                             // last second of the after window
      if (r.chance(0.7)) addErr(tm, d + 8, 0, 429);              // first second after it
      addErr(tm, d + r.int(1, 7), r.int(0, 86399), r.pick(OTHER_CODES));
    }
  }
  const expected = compute();

  const diagnostics = [
    { message: "A threshold met exactly was not counted. A team reaches a tier when its cumulative spend is at least the threshold (>=), not only when it is above it.", rows: compute({ strict: true }) },
    { message: "The upgrade day was counted in the after window. The after window is the 7 UTC days after reached_on: reached_on + 1 through reached_on + 7.", rows: compute({ afterInclDay: true }) },
    { message: "The upgrade day was counted in the before window. The before window is reached_on − 7 through reached_on − 1.", rows: compute({ beforeInclDay: true }) },
    { message: "The after window stopped at midnight at the start of its last day. Comparing a timestamp with reached_on + 7 (a date) means 00:00:00 on that day; rejections later that day were lost. Compare dates (requested_at::date) or use < reached_on + 8.", rows: compute({ tsUpper: true }) },
    { message: "Every error was counted as a rejection. Only status_code 429 is a rate-limit rejection; 400, 500 and 503 rows are other failures.", rows: compute({ allCodes: true }) },
  ];
  if (level >= 2) {
    diagnostics.push(
      { message: "A window that runs off the edge of the sample was counted from the days that exist. When reached_on − 7 is before the first day or reached_on + 7 after the last, that window is incomplete and its count is NULL.", rows: compute({ noNull: true }) },
      { message: "Refunds were left out of cumulative spend. Refund rows are negative spend and lower the running total.", rows: compute({ noRefunds: true }) },
      { message: "The running total was checked after every event, so a charge that crossed a threshold and was refunded later the same day counted. In this exercise a tier is reached on a day whose end-of-day cumulative spend meets the threshold.", rows: compute({ intraday: true }) },
      { message: "The last crossing was reported instead of the first. A team whose spend dips below a reached tier and crosses again reached that tier on the first day only.", rows: compute({ lastCross: true }) },
    );
  }
  if (level === 3) {
    diagnostics.push(
      { message: "Promotional-credit usage was counted as spend. Only charge and refund rows count toward cumulative spend.", rows: compute({ promo: true }) },
      { message: "Only days with spend events were checked. When a threshold is lowered, a team can reach a tier on a day it spent nothing; check every day of the sample (a calendar), or the days thresholds change as well.", rows: compute({ eventDays: true }) },
      { message: "The latest threshold version was applied to every day. A day uses the threshold in force on that day: effective_from <= day < effective_to.", rows: compute({ latest: true }) },
    );
  }

  // Tables.
  const vFrom = (v) => (v.from === null ? "2026-01-01" : day(base, v.from));
  const vTo = (v) => (v.to === null ? null : day(base, v.to));
  const thCols = ["tier", "min_spend_cents", "effective_from", "effective_to"];
  const thRows = [];
  for (const v of versions) for (let k = 0; k < nTiers; k++) thRows.push([k + 1, v.thr[k], vFrom(v), vTo(v)]);
  let eid = 10000 + r.int(0, 80000);
  const allEv = [];
  for (const tm of teams) for (const e of tm.events) allEv.push({ team: tm.id, ...e });
  allEv.sort((a, b) => a.d - b.d || a.s - b.s || (a.team < b.team ? -1 : 1));
  const seCols = ["event_id", "team_id", "occurred_at", "kind", "amount_cents"];
  const seRows = allEv.map((e) => ["sp_" + (eid += r.int(1, 7)), e.team, ts(day(base, e.d), e.s), e.kind, e.amt]);
  errs.sort((a, b) => a.d - b.d || a.s - b.s || (a.team < b.team ? -1 : 1));
  let rid = 500000 + r.int(0, 400000);
  const reCols = ["request_id", "team_id", "model", "requested_at", "status_code", "limit_hit"];
  const reRows = errs.map((x) => ["req_" + (rid += r.int(1, 9)), x.team, x.model, ts(day(base, x.d), x.s), x.code, x.limit]);

  const setup =
    "SET TIME ZONE 'UTC';\n" +
    "CREATE TABLE tier_thresholds (\n  tier INT NOT NULL,\n  min_spend_cents BIGINT NOT NULL,\n  effective_from DATE NOT NULL,\n  effective_to DATE,\n  PRIMARY KEY (tier, effective_from)\n);\n" +
    "CREATE TABLE spend_events (\n  event_id TEXT PRIMARY KEY,\n  team_id TEXT NOT NULL,\n  occurred_at TIMESTAMPTZ NOT NULL,\n  kind TEXT NOT NULL CHECK (kind IN ('charge', 'refund', 'promotional_credit')),\n  amount_cents BIGINT NOT NULL\n);\n" +
    "CREATE TABLE request_errors (\n  request_id TEXT PRIMARY KEY,\n  team_id TEXT NOT NULL,\n  model TEXT NOT NULL,\n  requested_at TIMESTAMPTZ NOT NULL,\n  status_code INT NOT NULL,\n  limit_hit TEXT\n);\n" +
    insertSQL("tier_thresholds", thCols, thRows) + insertSQL("spend_events", seCols, seRows) + insertSQL("request_errors", reCols, reRows);

  return {
    vars: {
      first_day: day(base, 0),
      last_day: day(base, D - 1),
      tier_count: String(nTiers),
      team_count: String(nTeams),
      spend_rows: String(seRows.length),
      error_rows: String(reRows.length),
      kinds_rule: level === 1
        ? "In this sample every spend event is a charge."
        : level === 2
          ? "This sample has charges and refunds."
          : "This sample has charges, refunds and promotional-credit usage.",
      threshold_rule: level === 3
        ? "In this sample the thresholds have two versions; the second takes effect on " + day(base, dx) + "."
        : "In this sample the thresholds have a single version, in force for the whole sample.",
      window_rule: level === 1
        ? "In this sample every window happens to lie inside the sample; your query should still apply the rule."
        : "Windows near the sample's first or last day can run off it.",
    },
    setup,
    tables: [
      { name: "tier_thresholds", columns: thCols, rows: thRows },
      { name: "spend_events", columns: seCols, rows: seRows },
      { name: "request_errors", columns: reCols, rows: reRows },
    ],
    expected: { columns: ["team_id", "tier", "reached_on", "rejected_7d_before", "rejected_7d_after"], rows: expected },
    diagnostics: diagnostics.filter((d) => JSON.stringify(d.rows) !== JSON.stringify(expected)),
  };
}
