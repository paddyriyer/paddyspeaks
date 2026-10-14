/* MDB-L1-02 — Time without a primary, per election (SQL).
   Simulated practice scenario. All data is generated from the seed; replica sets, members,
   timings and maintenance windows are hypothetical. Elections, step-downs and member states
   are described in general terms; the rules here are this exercise's rules.

   Contract: see docs/COMPANY-INTERVIEW-LOOPS.md § Executable templates (sql).
   level: 1 Medium (failovers and step-downs; secondaries changing state inside a gap;
            step-downs inside maintenance windows labelled)
          2 Hard (+ a hand-over recorded at the same millisecond; a new primary elected
            before the old one steps down; the same member re-elected; step-downs exactly
            at a window's start and end; a failure inside a window)
          3 Very Hard (+ the monitor re-reports unchanged states; a gap still open when
            the log ends) */
import { insertSQL } from "../../js/rng.js";

export const kind = "sql";

const SETS = ["rs-orders", "rs-billing", "rs-catalog", "rs-sessions", "rs-inventory", "rs-profiles"];
const LETTERS = ["a", "b", "c", "d"];
const BASE = Date.UTC(2026, 9, 5, 0, 0, 0);          // 2026-10-05 00:00:00 UTC
const HOUR = 3600000, MIN = 60000;

const stamp = (ms) => new Date(ms).toISOString().replace("T", " ").replace("Z", "+00");

export function generate(r, level) {
  for (let attempt = 0; attempt < 50; attempt++) {
    const out = build(r, level);
    if (out) return out;
  }
  throw new Error("MDB-L1-02: could not build an instance");
}

function build(r, level) {
  const nSets = level === 1 ? 2 : 3;
  const sets = r.sample(SETS, nSets).sort();
  const need = ["failoverNoise", "maintStepdown", "plainStepdown", "failover", "secondaryNoise"];
  if (level >= 2) need.push("handover", "partition", "atWindowEnd", "atWindowStart", "reelect", "failureInWindow");
  const plan = Object.fromEntries(sets.map((s) => [s, []]));
  r.shuffle(need).forEach((ep, i) => plan[sets[i % nSets]].push(ep));
  for (const s of sets) if (r.chance(0.5)) plan[s].push(r.pick(["plainStepdown", "failover", "secondaryNoise"]));
  const openSet = level === 3 ? r.pick(sets) : null;

  const rows = [];          // {set, member, ms, state, reason, seq}
  const windows = [];       // [set, startMs, endMs]
  let seq = 0;
  const cur = new Map();     // member -> its latest state (each member's rows are added in time order)
  let lastMs = 0;
  const add = (set, member, ms, state, reason) => {
    rows.push({ set, member, ms, state, reason, seq: seq++ });
    cur.set(member, state);
    lastMs = Math.max(lastMs, ms);
  };

  for (const set of sets) {
    lastMs = 0;
    const members = LETTERS.slice(0, 3).map((x) => set.slice(3) + "-" + x);
    let primary = members[0];
    let t = BASE + r.int(0, 30) * MIN;
    for (const m of members) add(set, m, t, m === primary ? "PRIMARY" : "SECONDARY", "snapshot");
    const others = () => members.filter((m) => m !== primary);
    const advance = (lo, hi) => { t = Math.max(t, Math.ceil(t / MIN) * MIN) + r.int(lo, hi) * MIN + r.int(0, 59999); };
    const heartbeat = () => {
      if (level !== 3) return;
      for (const m of members) if (r.chance(0.4)) add(set, m, t + r.int(1, 20) * 1000, cur.get(m), "heartbeat");
    };
    const episodes = r.shuffle(plan[set]);
    if (level === 3) episodes.unshift("primaryHeartbeat");
    for (const ep of episodes) {
      advance(30, 120);
      const [q, w] = r.shuffle(others());
      if (ep === "primaryHeartbeat") {                         // the primary re-reports itself, then fails over
        add(set, primary, t, "PRIMARY", "heartbeat");
        t += r.int(5, 40) * 1000;
        add(set, primary, t, "DOWN", "unreachable");
        add(set, q, t + r.int(2000, 12000), "PRIMARY", "election");
        add(set, primary, t + r.int(5, 15) * MIN, "SECONDARY", "rejoined");
        primary = q;
      } else if (ep === "failover" || ep === "failoverNoise" || ep === "failureInWindow") {
        if (ep === "failureInWindow") {
          const ws = Math.ceil(t / HOUR) * HOUR;
          windows.push([set, ws, ws + 2 * HOUR]);
          t = ws + r.int(20, 90) * MIN + r.int(0, 59999);
        }
        const gap = r.int(2000, 12000);
        add(set, primary, t, "DOWN", "unreachable");
        if (ep === "failoverNoise") {                           // another member changes state inside the gap
          add(set, w, t + r.int(200, gap - 200), "RECOVERING", "resync");
          add(set, w, t + gap + r.int(1, 5) * MIN, "SECONDARY", "resync");
        }
        add(set, q, t + gap, "PRIMARY", "election");
        add(set, primary, t + gap + r.int(3, 20) * MIN, "RECOVERING", "rejoined");
        add(set, primary, t + gap + r.int(21, 40) * MIN, "SECONDARY", "rejoined");
        primary = q;
        if (ep === "failureInWindow") t = Math.max(t, windows[windows.length - 1][2]) + MIN;
      } else if (ep === "maintStepdown" || ep === "atWindowStart" || ep === "atWindowEnd" || ep === "plainStepdown") {
        if (ep !== "plainStepdown") {
          const ws = Math.ceil(t / HOUR) * HOUR;
          const we = ws + r.int(1, 3) * HOUR;
          windows.push([set, ws, we]);
          t = ep === "atWindowStart" ? ws : ep === "atWindowEnd" ? we : ws + r.int(5, 50) * MIN + r.int(0, 59999);
        }
        add(set, primary, t, "SECONDARY", "stepdown");
        add(set, q, t + r.int(300, 3000), "PRIMARY", "election");
        primary = q;
        if (ep !== "plainStepdown") t = Math.max(t, windows[windows.length - 1][2]) + MIN;
      } else if (ep === "secondaryNoise") {
        add(set, w, t, r.pick(["RECOVERING", "DOWN"]), r.pick(["resync", "unreachable"]));
        add(set, w, t + r.int(1, 10) * MIN, "SECONDARY", "rejoined");
      } else if (ep === "handover") {                           // both changes recorded in the same millisecond
        add(set, primary, t, "SECONDARY", "stepdown");
        add(set, q, t, "PRIMARY", "election");
        primary = q;
      } else if (ep === "partition") {                          // a new primary before the old one steps down
        add(set, q, t, "PRIMARY", "election");
        add(set, primary, t + r.int(500, 8000), "SECONDARY", "stepdown");
        primary = q;
      } else if (ep === "reelect") {
        add(set, primary, t, "SECONDARY", "stepdown");
        add(set, primary, t + r.int(4000, 11000), "PRIMARY", "election");
      }
      t = Math.max(t, lastMs) + 20 * MIN;
      heartbeat();
    }
    if (set === openSet) {                                      // the log ends inside a gap
      advance(30, 90);
      add(set, primary, t, "DOWN", "unreachable");
      add(set, others()[0], t + r.int(1000, 4000), "RECOVERING", "resync");
    }
  }

  rows.sort((a, b) => a.ms - b.ms || a.seq - b.seq);
  let cid = 100 + r.int(0, 800);
  rows.forEach((x) => { x.id = cid++; });

  const expected = compute(rows, windows, {});
  if (!expected.length) return null;

  const diagnostics = [
    { message: "The gap was closed by the next state change of any member. A secondary changing state does not end a gap; only a member becoming PRIMARY does.", rows: compute(rows, windows, { anyNext: true }) },
    { message: "Every step-down was labelled maintenance. Only a step-down inside one of the set's maintenance windows is maintenance.", rows: compute(rows, windows, { allMaint: true }) },
  ];
  if (level >= 2) {
    diagnostics.push({ message: "A step-down exactly at a window's end was labelled maintenance. A window is [starts_at, ends_at): its end is outside.", rows: compute(rows, windows, { inclusiveEnd: true }) });
    diagnostics.push({ message: "Rows were applied one at a time, so a hand-over recorded in one millisecond became a 0-second gap. Changes at the same instant happen together: the set was never without a primary.", rows: compute(rows, windows, { rowByRow: true }) });
    diagnostics.push({ message: "Each lost primary was paired with the next PRIMARY row. When a new primary was elected before the old one stepped down, the set never lacked a primary; count primaries instead.", rows: compute(rows, windows, { naivePairing: true }) });
  }
  if (level === 3) {
    diagnostics.push({ message: "Every PRIMARY row was counted as a new primary. The monitor re-reports unchanged states; a row only changes the count when the member's previous state differs.", rows: compute(rows, windows, { everyPrimaryRow: true }) });
    diagnostics.push({ message: "The gap still open at the end of the log was dropped. Report it with NULL elected_at, new_primary and seconds.", rows: compute(rows, windows, { dropOpen: true }) });
  }

  const cols = ["change_id", "replica_set", "member", "changed_at", "new_state", "reason"];
  const tableRows = rows.map((x) => [x.id, x.set, x.member, stamp(x.ms), x.state, x.reason]);
  windows.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] - b[1]));
  const wCols = ["replica_set", "starts_at", "ends_at"];
  const wRows = windows.map(([s, a, b]) => [s, stamp(a), stamp(b)]);
  const setup =
    "SET TIME ZONE 'UTC';\n" +
    "CREATE TABLE member_state_changes (\n  change_id BIGINT PRIMARY KEY,\n  replica_set TEXT NOT NULL,\n  member TEXT NOT NULL,\n  changed_at TIMESTAMPTZ(3) NOT NULL,\n  new_state TEXT NOT NULL CHECK (new_state IN ('PRIMARY','SECONDARY','RECOVERING','DOWN')),\n  reason TEXT NOT NULL\n);\n" +
    "CREATE TABLE maintenance_windows (\n  replica_set TEXT NOT NULL,\n  starts_at TIMESTAMPTZ NOT NULL,\n  ends_at TIMESTAMPTZ NOT NULL\n);\n" +
    insertSQL("member_state_changes", cols, tableRows) + insertSQL("maintenance_windows", wCols, wRows);

  return {
    vars: {
      changes: tableRows.length,
      sets: nSets,
      same_instant_rule: level === 1
        ? "In this sample no two changes of one replica set share a timestamp."
        : "Several changes can share one `changed_at`; changes at the same instant take effect together, so a step-down and an election recorded in the same millisecond leave no gap.",
      repeat_rule: level === 3
        ? "The monitor also re-reports a member's unchanged state (reason `'heartbeat'`); such a row changes nothing. A gap that is still open when the log ends is reported with NULL `elected_at`, `new_primary` and `seconds_without_primary`."
        : "Every row is a real change of that member's state, and every gap in this sample closes before the log ends.",
    },
    setup,
    tables: [
      { name: "member_state_changes", columns: cols, rows: tableRows },
      { name: "maintenance_windows", columns: wCols, rows: wRows },
    ],
    expected: { columns: ["replica_set", "lost_at", "elected_at", "new_primary", "seconds_without_primary", "cause"], rows: expected },
    diagnostics: diagnostics.filter((d) => JSON.stringify(d.rows) !== JSON.stringify(expected)),
  };
}

// The rules applied literally; opts break one rule at a time for the diagnostics.
function compute(rows, windows, opts) {
  const out = [];
  const sets = [...new Set(rows.map((x) => x.set))].sort();
  for (const set of sets) {
    const evs = rows.filter((x) => x.set === set);
    const cause = (x) => {
      if (x.reason !== "stepdown") return "failure";
      const inWin = windows.some(([s, a, b]) => s === set && x.ms >= a && (opts.inclusiveEnd ? x.ms <= b : x.ms < b));
      return inWin || opts.allMaint ? "maintenance" : "stepdown";
    };
    const emit = (lost, end) => out.push([set, stamp(lost.ms), end ? stamp(end.ms) : null, end ? end.member : null, end ? (end.ms - lost.ms) / 1000 : null, cause(lost)]);

    if (opts.naivePairing) {
      const prev = new Map();
      evs.forEach((x, i) => {
        const was = prev.get(x.member);
        prev.set(x.member, x.state);
        if (was === "PRIMARY" && x.state !== "PRIMARY") emit(x, evs.slice(i + 1).find((y) => y.state === "PRIMARY"));
      });
      continue;
    }
    // Group rows into instants (or keep them one by one), apply, and watch the primary count.
    const groups = [];
    for (const x of evs) {
      if (!opts.rowByRow && groups.length && groups[groups.length - 1][0].ms === x.ms) groups[groups.length - 1].push(x);
      else groups.push([x]);
    }
    const state = new Map();
    let count = 0, open = null;
    for (let gi = 0; gi < groups.length; gi++) {
      const before = count;
      let leaving = null, joining = null;
      for (const x of groups[gi]) {
        const was = state.get(x.member);
        state.set(x.member, x.state);
        if (opts.everyPrimaryRow) {
          if (x.state === "PRIMARY") { count++; joining = joining || x; }
          else if (was === "PRIMARY") { count--; leaving = leaving || x; }
        } else if (x.state === "PRIMARY" && was !== "PRIMARY") { count++; joining = joining || x; }
        else if (x.state !== "PRIMARY" && was === "PRIMARY") { count--; leaving = leaving || x; }
      }
      if (open) {
        if (opts.anyNext) { emit(open, groups[gi][0]); open = null; }          // closed by whatever came next
        else if (before === 0 && count > 0) { emit(open, joining); open = null; }
      } else if (before > 0 && count === 0) open = leaving;
    }
    if (open && !opts.dropOpen) emit(open, null);
  }
  return out;
}
