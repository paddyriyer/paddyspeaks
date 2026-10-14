/* LNK-L3-05 — Profile viewers per week, for the member's own view (SQL).
   Simulated practice scenario. All members, settings, views and time zones are generated
   from the seed and are hypothetical.

   Contract: see docs/COMPANY-INTERVIEW-LOOPS.md § Executable templates (sql).
   One row per (viewed member, week) with at least one counted viewer, for the weeks whose
   Monday start (in the VIEWED member's own time zone) lies between week_from and week_to
   inclusive:
     viewers          distinct counted viewers in that week;
     named_viewers    viewers with at least one view in named mode that week;
     private_viewers  the others (every view that week in private mode).
   A view counts unless it is a self-view or its viewer's account is closed. A view's mode
   is the viewer's visibility setting in force at viewed_at (the latest setting with
   effective_at <= viewed_at); with no setting by then, the default is named.
   The oracle converts instants with Intl (IANA zones), independently of PostgreSQL's
   AT TIME ZONE.
   level: 1 Medium (everyone in UTC; settings that change, a viewer with no setting yet,
                    repeat views, a self-view, a viewer who switched mode mid-week)
          2 Hard (+ closed accounts, a setting effective exactly at a view, views exactly on
                  the window's week boundaries, European zones across a DST change)
          3 Very Hard (+ members on several continents: views that are Monday in UTC but
                       Sunday locally and the reverse, around two DST changes) */
import { insertSQL } from "../../js/rng.js";

export const kind = "sql";

const H = 3600, D = 86400, W = 7 * D;
const BASE = Date.UTC(2026, 9, 5) / 1000;                       // Monday 2026-10-05 00:00 UTC
const NEG = ["America/Los_Angeles", "America/New_York", "America/Chicago", "America/Sao_Paulo"];
const POS = ["Asia/Tokyo", "Australia/Sydney", "Asia/Kolkata", "Asia/Singapore"];
const MID = ["UTC", "Europe/London", "Europe/Berlin"];

const fmtDate = {}, fmtWall = {};
function localDate(sec, tz) {                                    // "YYYY-MM-DD" in tz
  const f = (fmtDate[tz] ||= new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }));
  return f.format(new Date(sec * 1000));
}
function offsetAt(sec, tz) {                                     // local wall clock minus UTC, seconds
  const f = (fmtWall[tz] ||= new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }));
  const p = Object.fromEntries(f.formatToParts(new Date(sec * 1000)).map((x) => [x.type, x.value]));
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second) / 1000 - sec;
}
function localToUtc(wallSec, tz) {                               // the instant whose wall clock in tz is wallSec
  let t = wallSec - offsetAt(wallSec, tz);
  t = wallSec - offsetAt(t, tz);
  return t;
}
function mondayOf(day) {                                         // "YYYY-MM-DD" -> its Monday
  const ms = Date.parse(day + "T00:00:00Z");
  const dow = (new Date(ms).getUTCDay() + 6) % 7;
  return new Date(ms - dow * D * 1000).toISOString().slice(0, 10);
}
const isoDay = (sec) => new Date(sec * 1000).toISOString().slice(0, 10);
const stamp = (sec) => new Date(sec * 1000).toISOString().replace("T", " ").replace(/\.\d+Z$/, "+00");
const list = (xs) => { const q = xs.map((z) => "`" + z + "`"); return q.length < 2 ? q.join("") : q.slice(0, -1).join(", ") + " and " + q[q.length - 1]; };
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

export function generate(r, level) {
  const nT = level === 1 ? 3 : level === 2 ? 4 : 5;              // members whose viewers are reported
  const nV = level === 1 ? 7 : level === 2 ? 9 : 11;             // ordinary viewers
  const nEdge = level === 1 ? 3 : 5;                             // one viewer per forced rule
  const used = new Set();
  const newId = () => {
    let n;
    do n = r.int(1000, 9999); while (used.has(n));
    used.add(n);
    return "mbr_" + n;
  };
  const ids = [];
  for (let i = 0; i < nT + nV + nEdge; i++) ids.push(newId());
  const targets = ids.slice(0, nT), viewers = ids.slice(nT, nT + nV), edge = ids.slice(nT + nV);

  // Time zones. Only the viewed member's zone decides the week.
  const zone = {};
  for (const m of ids) zone[m] = level === 1 ? "UTC" : level === 2 ? r.pick(MID) : r.pick([...NEG, ...POS, ...MID]);
  if (level === 3) {
    zone[targets[0]] = r.pick(NEG);
    zone[targets[1]] = r.pick(POS);
  }

  // Report window: Monday indexes into the six weeks of data (weeks 0 and 5 lie outside it).
  const a = r.int(1, 2), span = level === 1 ? 1 : 2;
  const wFrom = a, wTo = a + span;
  const weekFrom = isoDay(BASE + wFrom * W), weekTo = isoDay(BASE + wTo * W);
  const mid = (w, day, hour) => BASE + w * W + day * D + hour * H + r.int(0, 3 * H - 1);   // day 1 = Tuesday, UTC
  const inWindow = () => r.int(wFrom, wTo);

  // Visibility settings: history per member, alternating modes after the first.
  const settings = {};                                           // member -> [{at, mode}] sorted by at
  const setOf = (m) => (settings[m] ||= []);
  for (const m of [...targets, ...viewers]) {
    if (r.chance(0.25)) continue;                               // never changed it: named by default
    const times = [-r.int(1, 60) * D - r.int(0, D - 1)];
    const k = r.int(0, level === 1 ? 1 : 2);
    while (times.length < k + 1) {
      const t = r.int(0, 6 * W - 1);
      if (!times.includes(t)) times.push(t);
    }
    times.sort((x, y) => x - y);
    let mode = r.chance(0.7) ? "named" : "private";
    for (const t of times) {
      setOf(m).push({ at: BASE + t, mode });
      mode = mode === "named" ? "private" : "named";
    }
  }

  const views = [];                                              // {viewer, viewed, at}
  const view = (viewer, viewed, at) => views.push({ viewer, viewed, at });

  // Ordinary traffic: viewers and other reported members viewing each reported member.
  for (const t of targets) {
    const pool = [...viewers, ...targets.filter((x) => x !== t)];
    const k = r.int(6, level === 3 ? 12 : 10);
    for (let i = 0; i < k; i++) view(r.pick(pool), t, BASE + r.int(0, 6 * W - 1));
    const rep = r.pick(viewers), w = inWindow();                 // a repeat viewer in one week
    view(rep, t, mid(w, 1, 9));
    view(rep, t, mid(w, 3, 14));
  }
  view(targets[0], targets[0], mid(inWindow(), 2, 10));          // a self-view

  // Forced rules, one dedicated viewer each.
  const [eMix, eCur, eNoDef, eExact, eClosed] = edge;
  {
    const t = r.pick(targets), w = inWindow();                   // named on Tuesday, private from Wednesday
    setOf(eMix).push({ at: BASE - 20 * D - r.int(0, D - 1), mode: "named" }, { at: mid(w, 2, 12), mode: "private" });
    view(eMix, t, mid(w, 1, 12));
    view(eMix, t, mid(w, 3, 12));
  }
  {
    const t = r.pick(targets);                                   // private then, named only after the data
    setOf(eCur).push({ at: BASE - r.int(10, 40) * D - r.int(0, D - 1), mode: "private" }, { at: BASE + 6 * W + r.int(1, 5) * D + r.int(0, D - 1), mode: "named" });
    view(eCur, t, mid(inWindow(), 2, 9));
  }
  {
    const t = r.pick(targets);                                   // first setting comes after the view
    setOf(eNoDef).push({ at: BASE + 6 * W + r.int(1, 5) * D + r.int(0, D - 1), mode: "private" });
    view(eNoDef, t, mid(inWindow(), 3, 9));
  }
  const closed = new Set();
  const closedAt = {};
  if (level >= 2) {
    const t = r.pick(targets), at = mid(inWindow(), 2, 11);      // switched to private exactly at the view
    setOf(eExact).push({ at: BASE - r.int(10, 40) * D - r.int(0, D - 1), mode: "named" }, { at, mode: "private" });
    view(eExact, t, at);
    view(eClosed, r.pick(targets), mid(inWindow(), 1, 15));      // account closed later: the view is removed
    view(eClosed, r.pick(targets), mid(inWindow(), 3, 8));
    closed.add(eClosed);
    closedAt[eClosed] = BASE + r.int(0, 6 * W + 5 * D);
    if (r.chance(0.5)) {
      const v = r.pick(viewers);
      closed.add(v);
      closedAt[v] = BASE + r.int(0, 6 * W + 5 * D);
    }
    // Views exactly on the window's local week boundaries.
    const t2 = r.pick(targets), tz = zone[t2];
    const start = localToUtc(BASE + wFrom * W, tz), next = localToUtc(BASE + (wTo + 1) * W, tz);
    view(r.pick(viewers), t2, start);                             // Monday 00:00 local: in the first week
    view(r.pick(viewers), t2, next - 1);                          // Sunday 23:59:59 local: in the last week
    view(r.pick(viewers), t2, next);                              // Monday 00:00 after it: outside
  }
  if (level === 3) {
    // West of UTC: early Monday in UTC is still Sunday locally, and the reverse east of it.
    view(r.pick(viewers), targets[0], BASE + wFrom * W + r.int(1, 2) * H + r.int(0, 1799));     // local: week before
    view(r.pick(viewers), targets[0], BASE + (wTo + 1) * W + r.int(1, 2) * H + r.int(0, 1799)); // local: last week
    view(r.pick(viewers), targets[1], BASE + wFrom * W - r.int(1, 4) * H);                      // local: first week
    view(r.pick(viewers), targets[1], BASE + (wTo + 1) * W - r.int(1, 4) * H);                  // local: week after
  }

  // Ids: view ids in time order.
  views.sort((x, y) => x.at - y.at || cmp(x.viewer, y.viewer) || cmp(x.viewed, y.viewed));
  let vid = 700000 + r.int(0, 90000);
  for (const v of views) v.id = "pv_" + (vid += r.int(1, 29));
  for (const m of Object.keys(settings)) settings[m].sort((x, y) => x.at - y.at);

  // The oracle. opts break one rule each, for diagnostics.
  const modeAt = (m, at, opts) => {
    const list = settings[m] || [];
    if (opts.current) return list.length ? list[list.length - 1].mode : "named";
    let mode = null;
    for (const s of list) if (opts.strict ? s.at < at : s.at <= at) mode = s.mode;
    return mode ?? (opts.noDefault ? null : "named");
  };
  const compute = (opts = {}) => {
    const groups = new Map();                                    // member|week -> Map viewer -> {named, priv, n, nn}
    for (const v of views) {
      if (!opts.self && v.viewer === v.viewed) continue;
      if (!opts.closed && closed.has(v.viewer)) continue;
      const mode = modeAt(v.viewer, v.at, opts);
      if (mode === null) continue;
      const tz = opts.utc ? "UTC" : opts.viewerZone ? zone[v.viewer] : zone[v.viewed];
      const wk = mondayOf(localDate(v.at, tz));
      if (wk < weekFrom || (opts.dropLast ? wk >= weekTo : wk > weekTo)) continue;
      const key = v.viewed + "|" + wk;
      if (!groups.has(key)) groups.set(key, new Map());
      const g = groups.get(key);
      const e = g.get(v.viewer) || { named: false, priv: false, n: 0, nn: 0 };
      e.n += 1;
      if (mode === "named") { e.named = true; e.nn += 1; } else e.priv = true;
      g.set(v.viewer, e);
    }
    return [...groups.keys()].sort().map((key) => {
      const [m, wk] = key.split("|");
      const es = [...groups.get(key).values()];
      const distinct = es.length;
      if (opts.countViews) {
        const n = es.reduce((s, e) => s + e.n, 0), nn = es.reduce((s, e) => s + e.nn, 0);
        return [m, wk, n, nn, n - nn];
      }
      const named = es.filter((e) => e.named).length, priv = es.filter((e) => e.priv).length;
      if (opts.both) return [m, wk, distinct, named, priv];
      if (opts.anyPrivate) return [m, wk, distinct, distinct - priv, priv];
      return [m, wk, distinct, named, distinct - named];
    });
  };
  const expected = compute();

  const diagnostics = [
    { message: "Self-views were counted. A member looking at their own profile is not a viewer.", rows: compute({ self: true }) },
    { message: "Views were counted instead of viewers. Repeat views by the same viewer in the same week collapse to one viewer.", rows: compute({ countViews: true }) },
    { message: "A viewer who used both modes in one week was counted twice, once as named and once as private, so named_viewers + private_viewers exceeds viewers. Each viewer counts once a week: named if any of their views that week was named.", rows: compute({ both: true }) },
    { message: "A viewer who used both modes in one week was counted as private. The rule is the other way round: one named view that week makes them a named viewer (the member was already shown their name), and only a viewer whose every view was private counts as private.", rows: compute({ anyPrivate: true }) },
    { message: "The viewer's current setting was used for every view. A view's mode is the setting in force when the view happened: the latest setting with effective_at at or before viewed_at.", rows: compute({ current: true }) },
    { message: "Views by members with no setting in force yet were dropped (an inner join to the settings, or a NULL mode filtered out). With no setting at or before the view, the mode is the default, named.", rows: compute({ noDefault: true }) },
    { message: "The last week of the window was dropped. week_to is a week start and the window includes it: every view up to the end of that Sunday, local time.", rows: compute({ dropLast: true }) },
  ];
  if (level >= 2) {
    diagnostics.push(
      { message: "A setting that took effect exactly when a view happened was not applied. The setting in force is the latest with effective_at at or before viewed_at, so a switch at that same instant governs the view.", rows: compute({ strict: true }) },
      { message: "Views by closed accounts were counted. When a member closes their account their activity is removed, so their views no longer appear in anyone's viewer counts.", rows: compute({ closed: true }) },
      { message: "Weeks were taken in UTC. The report is the member's own view, so a week runs Monday to Sunday in the viewed member's time zone: convert with viewed_at AT TIME ZONE time_zone before truncating to the week.", rows: compute({ utc: true }) },
    );
  }
  if (level === 3) {
    diagnostics.push(
      { message: "Weeks were taken in the viewer's time zone. The report belongs to the member who was viewed, so their time zone decides the week.", rows: compute({ viewerZone: true }) },
    );
  }

  // Tables.
  const allMembers = [...ids].sort();
  const mCols = ["member_id", "time_zone", "closed_at"];
  const mRows = allMembers.map((m) => [m, zone[m], closed.has(m) ? stamp(closedAt[m]) : null]);
  const sCols = ["member_id", "mode", "effective_at"];
  const sRows = [];
  for (const m of allMembers) for (const s of settings[m] || []) sRows.push([m, s.mode, stamp(s.at)]);
  sRows.sort((x, y) => cmp(x[2], y[2]) || cmp(x[0], y[0]));
  const vCols = ["view_id", "viewer_id", "viewed_id", "viewed_at"];
  const vRows = views.map((v) => [v.id, v.viewer, v.viewed, stamp(v.at)]);

  const setup =
    "SET TIME ZONE 'UTC';\n" +
    "CREATE TABLE members (\n  member_id TEXT PRIMARY KEY,\n  time_zone TEXT NOT NULL,       -- IANA zone the member chose for their own reports\n  closed_at TIMESTAMPTZ           -- set when the member closed their account\n);\n" +
    "CREATE TABLE visibility_settings (\n  member_id TEXT NOT NULL REFERENCES members (member_id),\n  mode TEXT NOT NULL CHECK (mode IN ('named', 'private')),\n  effective_at TIMESTAMPTZ NOT NULL,\n  PRIMARY KEY (member_id, effective_at)\n);\n" +
    "CREATE TABLE profile_views (\n  view_id TEXT PRIMARY KEY,\n  viewer_id TEXT NOT NULL REFERENCES members (member_id),\n  viewed_id TEXT NOT NULL REFERENCES members (member_id),\n  viewed_at TIMESTAMPTZ NOT NULL\n);\n" +
    insertSQL("members", mCols, mRows) + insertSQL("visibility_settings", sCols, sRows) + insertSQL("profile_views", vCols, vRows);

  const tzs = [...new Set(targets.map((t) => zone[t]))].sort();
  return {
    vars: {
      week_from: weekFrom,
      week_to: weekTo,
      views: vRows.length,
      members: mRows.length,
      zone_rule: level === 1
        ? "In this instance every member's `time_zone` is `UTC`."
        : level === 2
          ? "The viewed members here are in " + list(tzs) + "; European clocks go back one hour on 2026-10-25."
          : "The viewed members here are in " + list(tzs) + ", and the data spans daylight-saving changes in Europe (2026-10-25) and North America (2026-11-01).",
    },
    setup,
    tables: [
      { name: "members", columns: mCols, rows: mRows },
      { name: "visibility_settings", columns: sCols, rows: sRows },
      { name: "profile_views", columns: vCols, rows: vRows },
    ],
    expected: { columns: ["member_id", "week_start", "viewers", "named_viewers", "private_viewers"], rows: expected },
    diagnostics: diagnostics.filter((d) => JSON.stringify(d.rows) !== JSON.stringify(expected)),
  };
}
