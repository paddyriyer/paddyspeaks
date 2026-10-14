/* APL-L3-05 — Phased release adoption: share of daily active devices on the new build per day
   of a seven-day phased release, with pauses (SQL).
   Simulated practice scenario. All apps, devices, versions and sessions are generated from the
   seed and are hypothetical. The seven-day percentage schedule is this exercise's rule.

   One row per (app_id, activity_date) from the release's start date through the earliest of:
   the date phase_day reaches 7, the date of a release_all action, and the report end.
     release_state  latest log action on or before the date: start/resume -> active,
                    pause -> paused, release_all -> complete;
     phase_day      number of active dates from the start date through the date;
     release_pct    the schedule's pct for phase_day, or 100 when complete;
     active_devices distinct devices with a session that date (in the app's report_tz);
     devices_on_new of those, devices with a session on the phased build or a later build
                    (higher build_number);
     share_on_new   ROUND(100 * devices_on_new / active_devices, 2), NULL when no device was active.
   level: 1 Medium (one app, one pause, UTC days, the release finishes before the report end)
          2 Hard (+ several apps, a release_all, a release cut by the report end, a date with no
                  sessions at all, devices shared across apps)
          3 Very Hard (+ per-app reporting time zones, a hotfix build after the phased build,
                       version strings whose text order differs from build order, two pauses) */
import { insertSQL, ts } from "../../js/rng.js";

export const kind = "sql";

const DAY = 86400;
const BASE = Date.UTC(2026, 8, 1) / 1000;                       // 2026-09-01 00:00 UTC = day 0
const SCHEDULE = [1, 2, 5, 10, 20, 50, 100];                    // this exercise's phase-day percentages
const APPS = ["app_beatgrid", "app_notecraft", "app_pocketchef", "app_skyglass", "app_tidepool", "app_trailmap", "app_wordloom"];
const ZONES = [["Asia/Tokyo", 540], ["Asia/Kolkata", 330], ["America/Phoenix", -420], ["Pacific/Honolulu", -600],
  ["Asia/Singapore", 480], ["America/Bogota", -300]];             // no daylight saving in September

const dateStr = (d) => new Date((BASE + d * DAY) * 1000).toISOString().slice(0, 10);
function stamp(sec) {                                             // seconds since BASE (UTC) -> timestamptz literal
  const d = Math.floor(sec / DAY);
  return ts(dateStr(d), sec - d * DAY);
}

/* Per-date state of a release from its log. advanceOnPause: the "paused days count" mistake. */
function simulate(app, R, opts = {}) {
  const act = new Map(app.log.map((x) => [x.d, x.action]));
  const days = [];
  let state = null, phase = 0, end = null;
  for (let d = app.start; d <= R + 40; d++) {
    if (act.has(d)) {
      const a = act.get(d);
      state = a === "pause" ? "paused" : a === "release_all" ? "complete" : "active";
    }
    if (state === "active" || (opts.advanceOnPause && state === "paused")) phase++;
    days.push({ d, state, phase: Math.min(phase, 7) });
    if (end === null && (state === "complete" || phase === 7)) end = d;
    if (end !== null && d >= Math.max(end, R)) break;
  }
  return { days, end };
}

export function generate(r, level) {
  const nApps = level === 1 ? 1 : level === 2 ? r.int(2, 3) : 3;
  const names = r.sample(APPS, nApps);
  const roles = (level === 1 ? ["pause"] : level === 2 ? ["pause", "all", "cut"] : ["pause2", "all", "cut"]).slice(0, nApps);
  const zones = r.sample(ZONES, 3);

  // Release logs (relative days). Non-cut apps first; the report end follows from them.
  const apps = names.map((id, i) => ({ id, role: roles[i], tz: level === 3 ? zones[i][0] : "UTC", off: level === 3 ? zones[i][1] : 0 }));
  const mkLog = (a, start) => {
    a.start = start;
    const log = [{ d: start, action: "start" }];
    if (a.role === "pause" || a.role === "pause2" || (a.role === "cut" && r.chance(0.5))) {
      let d = start + r.int(1, a.role === "cut" ? 2 : 4);
      const pauses = a.role === "pause2" ? 2 : 1;
      for (let k = 0; k < pauses; k++) {
        const len = r.int(1, level === 3 ? 3 : 2);
        log.push({ d, action: "pause" }, { d: d + len, action: "resume" });
        d += len + r.int(1, 2);
      }
    } else if (a.role === "all") {
      let d = start;
      if (r.chance(0.5)) { log.push({ d: start + 1, action: "pause" }, { d: start + 2, action: "resume" }); d = start + 2; }
      log.push({ d: d + r.int(1, 2), action: "release_all" });
    }
    a.log = log;
  };
  for (const a of apps) if (a.role !== "cut") mkLog(a, r.int(1, 4));
  const ends = apps.filter((a) => a.role !== "cut").map((a) => simulate(a, 0).end);
  const R = Math.max(...ends) + r.int(1, 2);                          // report end (relative day)
  for (const a of apps) if (a.role === "cut") mkLog(a, R - r.int(2, 4));

  // Builds. At level 3 the old minor is 9 and the new one 10, so text order lies.
  for (const a of apps) {
    const major = r.int(2, 9);
    const minor = level === 3 ? 9 : r.int(1, 6);
    const p = r.int(2, 6);
    const b0 = r.int(100, 900);
    a.older = { v: level === 3 ? `${major}.8.${r.int(1, 9)}` : `${major}.${minor}.${p - 1}`, b: b0 };
    a.old = { v: `${major}.${minor}.${p}`, b: b0 + r.int(3, 9) };
    a.neu = { v: `${major}.${minor + 1}.0`, b: a.old.b + r.int(5, 15) };
    a.builds = [a.older, a.old, a.neu];
    a.sim = simulate(a, R);
    a.last = Math.min(a.sim.end ?? R, R);                               // last reported date
  }
  if (level === 3) {                                                    // a hotfix for one app
    const a = r.pick(apps.filter((x) => x.last - x.start >= 3));
    a.hot = { v: a.neu.v.replace(/\.0$/, ".1"), b: a.neu.b + r.int(1, 4) };
    a.hotDay = a.start + r.int(2, Math.min(5, a.last - a.start));
    a.builds.push(a.hot);
  }

  // Devices and sessions. A session is generated on a local date and second, then stored in UTC.
  const pool = r.shuffle(Array.from({ length: 40 }, (_, i) => "dv_" + (4096 + i * 97 + r.int(0, 90)).toString(16)));
  const sessions = [];                                                  // {app, dev, local day, utc sec, ver}
  const pctOn = (a, d) => {
    const x = a.sim.days.find((y) => y.d === d);
    if (!x) return d < a.start ? 0 : 100;
    return x.state === "complete" ? 100 : SCHEDULE[x.phase - 1];
  };
  const add = (a, dev, d, sec) => sessions.push({ app: a.id, dev, day: d, utc: d * DAY + sec - a.off * 60, ver: a.verAt.get(dev)(d, sec) });
  for (const a of apps) {
    const devs = r.sample(level === 1 ? pool.slice(0, 20) : pool, level === 1 ? r.int(9, 12) : r.int(7, 10));
    a.devs = devs;
    a.verAt = new Map();
    for (const dev of devs) {
      const u = r.int(0, 99);
      const manual = r.chance(0.15) ? r.int(a.start, a.last) : null;
      let upDay = null;
      for (let d = a.start; d <= a.last + 1; d++) if (pctOn(a, d) > u || d === manual) { upDay = d; break; }
      const upSec = r.int(0, DAY - 1);
      const base = r.chance(0.25) ? a.older : a.old;
      const hotter = a.hot && r.chance(0.6);
      a.verAt.set(dev, (d, sec) => {
        if (upDay === null || d < upDay || (d === upDay && sec < upSec)) return base.v;
        return hotter && d >= a.hotDay ? a.hot.v : a.neu.v;
      });
    }
  }
  let zero = null;
  if (level >= 2) {                                                     // a date with no sessions at all
    const a = apps.find((x) => x.role === "pause" || x.role === "pause2");
    zero = { app: a.id, day: r.int(a.start + 1, a.last) };
  }
  const open = (a, d) => !(zero && zero.app === a.id && zero.day === d);
  for (const a of apps) {
    const lo = a.start - 1, hi = Math.min(a.last + 1, R + 1);
    for (const dev of a.devs) {
      for (let d = lo; d <= hi; d++) {
        if (!r.chance(0.55) || !open(a, d)) continue;
        const k = r.int(1, level === 1 ? 3 : 2);
        for (let j = 0; j < k; j++) add(a, dev, d, r.int(0, DAY - 1));
      }
    }
    // Forced edges: one session at exactly local midnight, one a second before the next midnight.
    const days = [];
    for (let d = a.start; d <= a.last; d++) if (open(a, d)) days.push(d);
    add(a, r.pick(a.devs), r.pick(days), 0);
    add(a, r.pick(a.devs), r.pick(days), DAY - 1);
  }
  if (level === 3) {                                                    // a device seen only on the hotfix
    const a = apps.find((x) => x.hot);
    const dev = pool.find((x) => !a.devs.includes(x));
    a.verAt.set(dev, () => a.hot.v);
    const days = [];
    for (let d = a.hotDay; d <= a.last; d++) if (open(a, d)) days.push(d);
    if (days.length) add(a, dev, r.pick(days), r.int(3600, DAY - 3600));
  }
  sessions.sort((x, y) => x.utc - y.utc || (x.app < y.app ? -1 : x.app > y.app ? 1 : 0) || (x.dev < y.dev ? -1 : x.dev > y.dev ? 1 : 0));
  let sid = 70000 + r.int(0, 20000);
  for (const s of sessions) s.id = "s_" + (sid += r.int(1, 9));

  // The oracle. opts break one rule each, for diagnostics.
  const compute = (opts = {}) => {
    const out = [];
    for (const a of [...apps].sort((x, y) => (x.id < y.id ? -1 : 1))) {
      const sim = opts.advanceOnPause ? simulate(a, R, { advanceOnPause: true }) : a.sim;
      const last = opts.noStop ? R : Math.min(sim.end ?? R, R);
      const build = new Map(a.builds.map((b) => [b.v, b.b]));
      const isNew = (v) => (opts.exact ? v === a.neu.v : opts.text ? v >= a.neu.v : build.get(v) >= a.neu.b);
      const perDay = new Map();                                           // day -> Map(dev -> onNew) or session counts
      for (const s of sessions) {
        if (s.app !== a.id) continue;
        const d = opts.utc ? Math.floor(s.utc / DAY) : s.day;
        if (!perDay.has(d)) perDay.set(d, { devs: new Map(), n: 0, nNew: 0 });
        const x = perDay.get(d);
        x.n++;
        if (isNew(s.ver)) x.nNew++;
        x.devs.set(s.dev, (x.devs.get(s.dev) || false) || isNew(s.ver));
      }
      for (const day of sim.days) {
        if (day.d > last) break;
        const x = perDay.get(day.d);
        let act = 0, on = 0;
        if (x) {
          if (opts.sessions) { act = x.n; on = x.nNew; }
          else { act = x.devs.size; on = [...x.devs.values()].filter(Boolean).length; }
        }
        if (opts.dropEmpty && act === 0) continue;
        const share = act === 0 ? null : opts.intDiv ? Math.floor((100 * on) / act) : Math.floor((2 * on * 10000 + act) / (2 * act)) / 100;
        const pct = day.state === "complete" ? 100 : SCHEDULE[day.phase - 1];
        out.push([a.id, dateStr(day.d), day.phase, day.state, pct, act, on, share]);
      }
    }
    return out;
  };
  const expected = compute();

  const diagnostics = [
    { message: "Sessions were counted instead of devices. The share is of daily active DEVICES: a device with three sessions in a day counts once, and it counts as on the new build if any of its sessions that day ran it.", rows: compute({ sessions: true }) },
    { message: "Paused dates advanced the phase. phase_day counts only active dates, so the percentage holds while the release is paused and the release finishes later than seven calendar days after the start.", rows: compute({ advanceOnPause: true }) },
    { message: "The share was computed with integer division and truncated. Divide as numeric (100.0 * on / active) and ROUND to 2 places; NULLIF guards a date with no active devices.", rows: compute({ intDiv: true }) },
    { message: "Rows continue after the release finished. The phased release ends on the date phase_day reaches 7 or on the release_all date; report nothing after that, even when the report end is later.", rows: compute({ noStop: true }) },
  ];
  if (level >= 2) {
    diagnostics.push({ message: "A date with no sessions is missing. Every date of the release appears, with 0 active devices and a NULL share: build the dates from the release log (generate_series) and LEFT JOIN the activity to them.", rows: compute({ dropEmpty: true }) });
  }
  if (level === 3) {
    diagnostics.push(
      { message: "Only the exact phased version was counted. A device on a later build (the hotfix) has the new code too: compare build_number, not version equality.", rows: compute({ exact: true }) },
      { message: "Version strings were compared as text. As text '…9.x' sorts after '…10.0', so devices still on the old version were counted as updated; compare build_number (or the version split into integers).", rows: compute({ text: true }) },
      { message: "Sessions were assigned to UTC dates. Each app's dates are calendar dates in its report_tz: use (started_at AT TIME ZONE report_tz)::date.", rows: compute({ utc: true }) },
    );
  }

  const aCols = ["app_id", "report_tz"];
  const bCols = ["app_id", "version", "build_number"];
  const lCols = ["app_id", "version", "action", "action_date"];
  const pCols = ["phase_day", "release_pct"];
  const sCols = ["session_id", "device_id", "app_id", "app_version", "started_at"];
  const sorted = [...apps].sort((x, y) => (x.id < y.id ? -1 : 1));
  const aRows = sorted.map((a) => [a.id, a.tz]);
  const bRows = sorted.flatMap((a) => [...a.builds].sort((x, y) => x.b - y.b).map((b) => [a.id, b.v, b.b]));
  const lRows = sorted.flatMap((a) => a.log.map((x) => [a.id, a.neu.v, x.action, dateStr(x.d)]));
  const pRows = SCHEDULE.map((p, i) => [i + 1, p]);
  const sRows = sessions.map((s) => [s.id, s.dev, s.app, s.ver, stamp(s.utc)]);

  const setup =
    "SET TIME ZONE 'UTC';\n" +
    "CREATE TABLE apps (\n  app_id TEXT PRIMARY KEY,\n  report_tz TEXT NOT NULL\n);\n" +
    "CREATE TABLE app_builds (\n  app_id TEXT NOT NULL REFERENCES apps (app_id),\n  version TEXT NOT NULL,\n  build_number INT NOT NULL,\n  PRIMARY KEY (app_id, version),\n  UNIQUE (app_id, build_number)\n);\n" +
    "CREATE TABLE phase_schedule (\n  phase_day INT PRIMARY KEY,\n  release_pct INT NOT NULL\n);\n" +
    "CREATE TABLE phased_release_log (\n  app_id TEXT NOT NULL REFERENCES apps (app_id),\n  version TEXT NOT NULL,\n  action TEXT NOT NULL CHECK (action IN ('start','pause','resume','release_all')),\n  action_date DATE NOT NULL,\n  PRIMARY KEY (app_id, action_date)\n);\n" +
    "CREATE TABLE app_sessions (\n  session_id TEXT PRIMARY KEY,\n  device_id TEXT NOT NULL,\n  app_id TEXT NOT NULL REFERENCES apps (app_id),\n  app_version TEXT NOT NULL,\n  started_at TIMESTAMPTZ NOT NULL\n);\n" +
    insertSQL("apps", aCols, aRows) + insertSQL("app_builds", bCols, bRows) + insertSQL("phase_schedule", pCols, pRows) +
    insertSQL("phased_release_log", lCols, lRows) + insertSQL("app_sessions", sCols, sRows);

  return {
    vars: {
      report_end: dateStr(R),
      app_count: apps.length === 1 ? "its app" : `each of its ${apps.length} apps`,
      sessions: sRows.length,
      day_rule: level === 3
        ? "Each app reports in its own time zone (`apps.report_tz`): a session belongs to the calendar date of `started_at` in that zone, and the log's `action_date` values are dates in the same zone."
        : "Every app reports in UTC here (`report_tz` is `UTC`), so a session belongs to the UTC date of `started_at`.",
    },
    setup,
    tables: [
      { name: "apps", columns: aCols, rows: aRows },
      { name: "app_builds", columns: bCols, rows: bRows },
      { name: "phase_schedule", columns: pCols, rows: pRows },
      { name: "phased_release_log", columns: lCols, rows: lRows },
      { name: "app_sessions", columns: sCols, rows: sRows },
    ],
    expected: { columns: ["app_id", "activity_date", "phase_day", "release_state", "release_pct", "active_devices", "devices_on_new", "share_on_new"], rows: expected },
    diagnostics: diagnostics.filter((d) => JSON.stringify(d.rows) !== JSON.stringify(expected)),
  };
}
