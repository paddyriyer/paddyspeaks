/* SNO-L1-03 — Storage over time: active, time-travel and fail-safe bytes per table per day
   from table storage events (SQL). Simulated practice scenario. All data is generated from
   the seed; the lifecycle rule is this exercise's simplified rule (check current docs).

   Contract: see docs/COMPANY-INTERVIEW-LOOPS.md § Executable templates (sql).
   level: 1 Medium (permanent tables; removed bytes stay in time travel for the table's
            retention days, then 7 days in fail-safe; one snapshot at the end of each day)
          2 Hard (+ transient tables with no fail-safe, retention 0, removals at exact
            midnights so a state change lands exactly on a snapshot, an event at a snapshot)
          3 Very Hard (+ DROP events with NULL bytes: everything active at that moment
            moves to time travel, which needs a running total) */
import { insertSQL, pad2 } from "../../js/rng.js";

export const kind = "sql";

const TABLES = ["raw_events", "orders_daily", "dim_customer", "fct_sessions", "stg_clicks", "inventory_snapshot", "ml_features"];
const STARTS = ["2026-09-07", "2026-09-10", "2026-09-14", "2026-09-17"];
const DAY = 86400;
const MB = 1000000;

const ep = (day) => Date.parse(day + "T00:00:00Z") / 1000;
function dayStr(t) {
  const d = new Date(t * 1000);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}
const fmt = (t) => { const d = new Date(t * 1000); return `${dayStr(t)} ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}:${pad2(d.getUTCSeconds())}+00`; };

export function generate(r, level) {
  const start = r.pick(STARTS);
  const nDays = level === 1 ? 7 : r.int(8, 10);
  const t0 = ep(start), tEnd = t0 + nDays * DAY;          // the last snapshot is tEnd
  const names = r.sample(TABLES, level === 1 ? 3 : r.int(4, 5)).sort();
  const tables = names.map((name, i) => {
    const transient = level >= 2 && i % 3 === 1;
    return { name, kind: transient ? "TRANSIENT" : "PERMANENT", ret: transient ? r.pick([0, 1]) : level === 1 ? r.pick([1, 3, 5]) : r.pick([0, 1, 3, 5]) };
  });
  // Hard+: at least one permanent table with retention ≥ 1 for the exact-midnight cases.
  const exact = level >= 2 ? tables.find((t) => t.kind === "PERMANENT") : null;
  if (exact && exact.ret === 0) exact.ret = r.pick([1, 3]);

  const events = [];     // {table, t, type, bytes|null}
  for (const tb of tables) {
    const plan = [];     // [t, type, forcedBytes?]
    const late = tb !== exact && r.chance(0.25);            // created during the report
    const first = late ? t0 + r.int(1, nDays - 3) * DAY + r.int(600, DAY - 600) : t0 - r.int(18, 22) * DAY + r.int(0, DAY - 1);
    plan.push([first, "ADD"]);
    const n = r.int(6, 10);
    for (let i = 0; i < n; i++) plan.push([r.int(first + 60, tEnd - 60), r.chance(0.55) ? "REMOVE" : "ADD"]);
    if (tb === exact) {
      const R = tb.ret;
      plan.push([t0 + (2 - R) * DAY, "REMOVE"]);              // reaches fail-safe exactly at day 2's start
      plan.push([t0 + (3 - R - 7) * DAY, "REMOVE"]);          // purged exactly at day 3's start
      plan.push([t0 + 4 * DAY, "ADD"]);                       // exactly at a snapshot instant
    }
    plan.sort((a, b) => a[0] - b[0]);
    // Distinct timestamps per table.
    for (let i = 1; i < plan.length; i++) if (plan[i][0] <= plan[i - 1][0]) plan[i][0] = plan[i - 1][0] + 1;
    let active = 0;
    for (const [t, type] of plan) {
      if (type === "ADD" || active === 0) {
        const b = (t === plan[0][0] ? r.int(400, 900) : r.int(5, 120)) * MB + r.int(0, MB - 1);
        events.push({ table: tb.name, t, type: "ADD", bytes: b });
        active += b;
      } else {
        const b = Math.max(1, Math.floor(active * (0.05 + 0.25 * r.next())));
        events.push({ table: tb.name, t, type: "REMOVE", bytes: b });
        active -= b;
      }
    }
  }
  if (level === 3) {
    // Drop one or two tables during the report: everything active moves to time travel.
    const victims = r.sample(tables.filter((tb) => tb !== exact), r.int(1, 2));
    for (const v of victims) {
      const td = t0 + r.int(1, nDays - 3) * DAY + r.int(600, DAY - 600);
      for (let i = events.length - 1; i >= 0; i--) if (events[i].table === v.name && events[i].t >= td) events.splice(i, 1);
      if (!events.some((e) => e.table === v.name)) events.push({ table: v.name, t: td - 3600, type: "ADD", bytes: r.int(50, 300) * MB });
      events.push({ table: v.name, t: td, type: "DROP", bytes: null });
    }
  }
  events.sort((a, b) => a.t - b.t || (a.table < b.table ? -1 : a.table > b.table ? 1 : 0));
  let eid = 7000 + r.int(0, 2000);
  for (const e of events) e.id = (eid += r.int(1, 6));

  const info = new Map(tables.map((tb) => [tb.name, tb]));
  const solve = (o = {}) => {
    const out = [];
    for (let d = 0; d < nDays; d++) {
      const s = t0 + (d + (o.startOfDay ? 0 : 1)) * DAY;
      for (const tb of tables) {
        const R = tb.ret * DAY;
        const F = (o.noFailsafe ? 0 : tb.kind === "PERMANENT" || o.transientFs ? 7 : 0) * DAY;
        let active = 0, tt = 0, fs = 0;
        for (const e of events) {
          if (e.table !== tb.name || e.t >= s) continue;
          let moved = 0;
          if (e.type === "ADD") { active += e.bytes; continue; }
          if (e.type === "REMOVE") moved = e.bytes;
          else if (!o.ignoreDrop) moved = active;
          active -= moved;
          if (!moved) continue;
          const inTT = o.inclusive ? s <= e.t + R : s < e.t + R;
          const inFS = o.inclusive ? s <= e.t + R + F : s < e.t + R + F;
          if (inTT) tt += moved; else if (inFS) fs += moved;
        }
        out.push([dayStr(t0 + d * DAY), tb.name, active, tt, fs]);
      }
    }
    return out;
  };
  const expected = solve();
  const diagnostics = [
    { message: "The snapshot was taken at the start of each day. A day's row is the state at its end: every event before the next midnight counts.", rows: solve({ startOfDay: true }) },
    { message: "Fail-safe was left out: removed bytes vanished when time travel ended. Permanent tables keep them 7 more days in fail-safe, and they are still billed.", rows: solve({ noFailsafe: true }) },
  ];
  if (level >= 2) {
    diagnostics.push({ message: "Transient tables were given a fail-safe period. They have none: after time travel the bytes are gone.", rows: solve({ transientFs: true }) });
    diagnostics.push({ message: "A period's end was treated as inclusive. Bytes removed at t are in time travel during [t, t + retention), in fail-safe during [t + retention, t + retention + 7 days).", rows: solve({ inclusive: true }) });
  }
  if (level === 3) diagnostics.push({ message: "DROP events were ignored because their bytes are NULL. A drop moves everything active at that moment into time travel.", rows: solve({ ignoreDrop: true }) });

  const tCols = ["table_name", "table_kind", "retention_days"];
  const tRows = tables.map((tb) => [tb.name, tb.kind, tb.ret]);
  const eCols = ["event_id", "table_name", "event_ts", "event_type", "bytes"];
  const eRows = events.map((e) => [e.id, e.table, fmt(e.t), e.type, e.bytes]);
  const setup =
    "SET TIME ZONE 'UTC';\n" +
    "CREATE TABLE table_settings (\n  table_name TEXT PRIMARY KEY,\n  table_kind TEXT NOT NULL CHECK (table_kind IN ('PERMANENT', 'TRANSIENT')),\n  retention_days INT NOT NULL\n);\n" +
    "CREATE TABLE storage_events (\n  event_id BIGINT PRIMARY KEY,\n  table_name TEXT NOT NULL REFERENCES table_settings(table_name),\n  event_ts TIMESTAMPTZ NOT NULL,\n  event_type TEXT NOT NULL CHECK (event_type IN ('ADD', 'REMOVE', 'DROP')),\n  bytes BIGINT\n);\n" +
    insertSQL("table_settings", tCols, tRows) + insertSQL("storage_events", eCols, eRows);

  return {
    vars: {
      start_date: start,
      end_date: dayStr(tEnd - DAY),
      events: eRows.length,
      kind_rule: level === 1
        ? "Every table in this sample is `PERMANENT`."
        : "A `TRANSIENT` table has no fail-safe: its removed bytes are gone when time travel ends. A table with `retention_days = 0` sends removed bytes straight to fail-safe (permanent) or deletes them at once (transient).",
      drop_rule: level === 3
        ? "A `DROP` event has `bytes` NULL: at that moment every byte still active in the table is removed, as if by one `REMOVE` of the whole active amount, and follows the same lifecycle. A dropped table still gets a row every day, with 0 active bytes after the drop."
        : "This sample has only `ADD` and `REMOVE` events.",
    },
    setup,
    tables: [
      { name: "table_settings", columns: tCols, rows: tRows },
      { name: "storage_events", columns: eCols, rows: eRows },
    ],
    expected: { columns: ["day", "table_name", "active_bytes", "time_travel_bytes", "failsafe_bytes"], rows: expected },
    diagnostics: diagnostics.filter((d) => JSON.stringify(d.rows) !== JSON.stringify(expected)),
  };
}
