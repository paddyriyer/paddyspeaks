/* MET-L1-02 — Conversion lift study readout: test versus holdout (SQL).
   Simulated practice scenario. All data is generated from the seed.

   Contract: see docs/COMPANY-INTERVIEW-LOOPS.md § Executable templates (sql).
   level: 1 Medium (assignment time, study window and objective event)
          2 Hard (+ browser and server copies of one conversion share an event_id)
          3 Very Hard (+ duplicate assignment rows, users assigned to both cells, a
                       copy pair that straddles the study end) */
import { insertSQL } from "../../js/rng.js";

export const kind = "sql";

const STUDIES = ["lift_autumn_launch", "lift_back_to_school", "lift_holiday_preview", "lift_new_store", "lift_spring_refresh"];
const EVENTS = ["Purchase", "Lead", "CompleteRegistration", "AddToCart"];
const BASE = Date.UTC(2026, 7, 31);           // 2026-08-31 00:00:00 UTC; times are seconds from here
const DAY = 86400;

export function generate(r, level) {
  const nStudies = level === 1 ? 2 : 3;
  const studies = r.sample(STUDIES, nStudies).sort().map((study_id) => {
    const start = r.int(0, 6) * DAY;
    return { study_id, event_name: r.pick(["Purchase", "Purchase", "Lead", "CompleteRegistration"]), start, end: start + r.pick([7, 10, 14]) * DAY };
  });
  const pool = r.sample([...Array(60)].map((_, i) => 7_300_100 + i * 13 + r.int(0, 12)), 26);

  // Assignments: one row per (study, user) unless level 3 adds duplicates and contamination.
  const assigns = [];                         // {study_id, user_id, cell, sec}
  for (const s of studies) {
    const members = r.sample(pool, r.int(9, 13));
    members.forEach((u, i) => {
      const cell = i < 2 ? "test" : i < 4 ? "control" : r.chance(0.5) ? "test" : "control";
      assigns.push({ study_id: s.study_id, user_id: u, cell, sec: s.start + r.int(0, 3 * DAY) });
    });
  }
  if (level === 3) {
    for (const s of studies) {
      const mine = assigns.filter((a) => a.study_id === s.study_id);
      const dup = r.pick(mine);
      assigns.push({ ...dup, sec: dup.sec + r.int(3600, 2 * DAY) });                        // logged again, same cell
      const both = r.pick(mine.filter((a) => a !== dup && a.user_id !== dup.user_id));
      assigns.push({ ...both, cell: both.cell === "test" ? "control" : "test", sec: both.sec + r.int(60, DAY) });   // contaminated
    }
  }

  // Conversions (events). Each logical conversion has an event_id; at level >= 2 the
  // browser pixel and the server both report some of them.
  const conv = [];                            // logical: {event_id, user_id, event_name, sec}
  let ev = 400000 + r.int(0, 90000);
  const addConv = (user_id, event_name, sec) => { const c = { event_id: "ev_" + ev++, user_id, event_name, sec }; conv.push(c); return c; };
  const firstAssign = (s, u) => Math.min(...assigns.filter((a) => a.study_id === s.study_id && a.user_id === u).map((a) => a.sec));
  for (const u of pool) {
    const n = r.int(0, 3);
    for (let k = 0; k < n; k++) addConv(u, r.pick(EVENTS), r.int(-2 * DAY, 22 * DAY));
  }
  // Planted boundaries, per study: a conversion exactly at assignment (counts), one second
  // before assignment (does not), and one exactly at the study end (does not).
  for (const s of studies) {
    const mine = [...new Set(assigns.filter((a) => a.study_id === s.study_id).map((a) => a.user_id))];
    const [a, b, c] = r.sample(mine, 3);
    addConv(a, s.event_name, firstAssign(s, a));
    addConv(b, s.event_name, firstAssign(s, b) - 1);
    addConv(c, s.event_name, s.end);
    addConv(r.pick(mine), s.event_name, s.end - 1 - r.int(0, DAY));
    addConv(r.pick(mine), s.event_name, firstAssign(s, a) + r.int(DAY, 4 * DAY));
  }

  const rows = [];                            // logged: {event_id, user_id, event_name, source, sec}
  const straddle = new Set();
  for (const c of conv) {
    rows.push({ ...c, source: "pixel" });
    if (level >= 2 && r.chance(0.35)) rows.push({ ...c, source: "server", sec: c.sec + r.int(0, 180) });
  }
  if (level === 3) {
    // A copy pair that straddles a study end: the earliest copy decides, so it counts.
    const s = r.pick(studies);
    const mixed = (u) => new Set(assigns.filter((a) => a.study_id === s.study_id && a.user_id === u).map((a) => a.cell)).size > 1;
    const ok = assigns.filter((a) => a.study_id === s.study_id && a.sec < s.end - DAY && !mixed(a.user_id));
    const u = r.pick(ok).user_id;
    const c = addConv(u, s.event_name, s.end - r.int(1, 60));
    rows.push({ ...c, source: "server" });
    rows.push({ ...c, source: "pixel", sec: s.end + r.int(0, 120) });
    straddle.add(c.event_id);
  }

  // Oracle.
  const compute = (o) => {
    const out = [];
    // logical events from the logged rows: earliest copy per (event_name, event_id)
    let events;
    if (o.noDedup) events = rows.map((x) => ({ ...x }));
    else {
      const m = new Map();
      for (const x of rows) {
        const k = x.event_name + "|" + x.event_id;
        const cur = m.get(k);
        if (!cur || x.sec < cur.sec) m.set(k, x);
      }
      events = [...m.values()];
      if (o.latestCopy) {
        const m2 = new Map();
        for (const x of rows) { const k = x.event_name + "|" + x.event_id; const cur = m2.get(k); if (!cur || x.sec > cur.sec) m2.set(k, x); }
        events = [...m2.values()];
      }
    }
    for (const s of studies) {
      const per = new Map();                  // user -> {cell, sec} or null when contaminated
      for (const a of assigns.filter((x) => x.study_id === s.study_id)) {
        if (o.noAssignDedup) continue;
        const cur = per.get(a.user_id);
        if (cur === undefined) per.set(a.user_id, { cell: a.cell, sec: a.sec });
        else if (cur !== null) {
          if (cur.cell !== a.cell && !o.keepContaminated) per.set(a.user_id, null);
          else if (a.sec < cur.sec) per.set(a.user_id, { cell: cur.cell === a.cell ? a.cell : cur.cell, sec: a.sec });
        }
      }
      let units;                              // [{user, cell, sec}]
      if (o.noAssignDedup) units = assigns.filter((x) => x.study_id === s.study_id).map((a) => ({ user: a.user_id, cell: a.cell, sec: a.sec }));
      else units = [...per.entries()].filter(([, v]) => v).map(([user, v]) => ({ user, cell: v.cell, sec: v.sec }));
      const stat = { test: { users: 0, conv: new Set(), n: 0 }, control: { users: 0, conv: new Set(), n: 0 } };
      for (const un of units) {
        const st = stat[un.cell];
        st.users++;
        for (const e of events) {
          if (e.user_id !== un.user) continue;
          if (!o.anyEvent && e.event_name !== s.event_name) continue;
          if (!o.ignoreAssign && e.sec < un.sec) continue;
          if (o.inclusiveEnd ? e.sec > s.end : e.sec >= s.end) continue;
          if (e.sec < s.start) continue;
          st.conv.add(un.user);
          st.n++;
        }
      }
      const tu = stat.test.users, cu = stat.control.users;
      const tc = stat.test.conv.size, cc = stat.control.conv.size;
      const lift = cc === 0 ? null : (tc / tu - cc / cu) / (cc / cu);
      out.push([s.study_id, tu, tc, stat.test.n, cu, cc, stat.control.n, lift]);
    }
    return out;
  };
  const expectedRows = compute({});

  const diagnostics = [
    { message: "Conversions before the user's assignment were counted. A conversion counts only from the moment the user entered the study (event_ts >= assigned_at).", rows: compute({ ignoreAssign: true }) },
    { message: "A conversion exactly at ends_at was counted. The study window is half-open: event_ts < ends_at.", rows: compute({ inclusiveEnd: true }) },
    { message: "Every conversion event was counted. Only the study's objective event (studies.event_name) counts.", rows: compute({ anyEvent: true }) },
  ];
  if (level >= 2) {
    diagnostics.push({ message: "Browser and server copies of the same conversion were counted twice. One conversion is one (event_name, event_id).", rows: compute({ noDedup: true }) });
  }
  if (level === 3) {
    diagnostics.push({ message: "Duplicate assignment rows were counted as separate users (and their conversions twice). Collapse to one row per (study, user).", rows: compute({ noAssignDedup: true }) });
    diagnostics.push({ message: "Users assigned to both cells were kept. A contaminated user has seen both conditions and must be excluded from the study entirely.", rows: compute({ keepContaminated: true }) });
    if (straddle.size) diagnostics.push({ message: "The latest copy of a conversion decided its time. The earliest report of a deduplicated conversion is its time.", rows: compute({ latestCopy: true }) });
  }

  const sCols = ["study_id", "event_name", "starts_at", "ends_at"];
  const sRows = studies.map((s) => [s.study_id, s.event_name, at(s.start), at(s.end)]);
  const aCols = ["study_id", "user_id", "cell", "assigned_at"];
  const aRows = assigns.map((a) => [a.study_id, a.user_id, a.cell, at(a.sec)]).sort((x, y) => (x[3] < y[3] ? -1 : x[3] > y[3] ? 1 : x[1] - y[1]));
  const cCols = ["event_id", "user_id", "event_name", "source", "event_ts"];
  const cRows = rows.map((x) => [x.event_id, x.user_id, x.event_name, x.source, at(x.sec)]).sort((x, y) => (x[4] < y[4] ? -1 : x[4] > y[4] ? 1 : x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : x[3] < y[3] ? -1 : 1));

  const setup =
    "SET TIME ZONE 'UTC';\n" +
    "CREATE TABLE lift_studies (\n  study_id TEXT PRIMARY KEY,\n  event_name TEXT NOT NULL,\n  starts_at TIMESTAMPTZ NOT NULL,\n  ends_at TIMESTAMPTZ NOT NULL\n);\n" +
    "CREATE TABLE lift_assignments (\n  study_id TEXT NOT NULL REFERENCES lift_studies,\n  user_id BIGINT NOT NULL,\n  cell TEXT NOT NULL CHECK (cell IN ('test','control')),\n  assigned_at TIMESTAMPTZ NOT NULL\n);\n" +
    "CREATE TABLE conversion_events (\n  event_id TEXT NOT NULL,\n  user_id BIGINT NOT NULL,\n  event_name TEXT NOT NULL,\n  source TEXT NOT NULL CHECK (source IN ('pixel','server')),\n  event_ts TIMESTAMPTZ NOT NULL\n);\n" +
    insertSQL("lift_studies", sCols, sRows) + insertSQL("lift_assignments", aCols, aRows) + insertSQL("conversion_events", cCols, cRows);

  return {
    vars: {
      studies: nStudies,
      dedup_rule:
        level === 1
          ? "Each conversion is reported once (`source = 'pixel'`)."
          : "A conversion can be reported twice, by the browser pixel and by the server, with the same `event_id` and `event_name`: those copies are one conversion, and its time is the earliest copy's `event_ts`.",
      assign_rule:
        level === 3
          ? "The assignment log can repeat a user in the same cell (use the earliest `assigned_at`), and a few users were assigned to both cells by mistake: exclude those users from that study entirely."
          : "Each user appears at most once per study in `lift_assignments`.",
    },
    setup,
    tables: [
      { name: "lift_studies", columns: sCols, rows: sRows },
      { name: "lift_assignments", columns: aCols, rows: aRows },
      { name: "conversion_events", columns: cCols, rows: cRows },
    ],
    expected: { columns: ["study_id", "test_users", "test_converters", "test_conversions", "control_users", "control_converters", "control_conversions", "lift"], rows: expectedRows },
    diagnostics: diagnostics.filter((d) => JSON.stringify(d.rows) !== JSON.stringify(expectedRows)),
  };
}

function at(sec) {
  return new Date(BASE + sec * 1000).toISOString().replace("T", " ").replace(".000Z", "+00");
}
