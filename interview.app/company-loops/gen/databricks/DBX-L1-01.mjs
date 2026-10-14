/* DBX-L1-01 — Job SLA misses from run history, with retries and repair runs (SQL).
   Simulated practice scenario. All data is generated from the seed. The SLA rule (a run
   date's output is final when its latest successful run ends) is this exercise's rule,
   stated in the problem; it is not a description of any product's internal behaviour.

   Contract: see docs/COMPANY-INTERVIEW-LOOPS.md § Executable templates (sql).
   level: 1 Medium (scheduled runs and automatic retries; MET / LATE / MISSED)
          2 Hard (+ repair runs, some after a success and some on the next UTC day,
                  a success exactly at the deadline, deadlines that cross midnight)
          3 Very Hard (+ schedule history with effective dates, a job that starts mid-window,
                  days with no run at all, runs still RUNNING with no end_ts) */
import { insertSQL } from "../../js/rng.js";

export const kind = "sql";

const JOBS = ["bronze_orders_ingest", "silver_sessions_build", "gold_revenue_daily", "features_refresh",
  "dq_checks_nightly", "billing_export", "inventory_snapshot", "attribution_model"];
const FIRST_DAYS = [[2026, 9, 21], [2026, 9, 28], [2026, 10, 5], [2026, 10, 12]];
const SCHED = [3600, 5400, 9000, 14400, 22500, 79200, 84600];   // 01:00 01:30 02:30 04:00 06:15 22:00 23:30
const SLA = [60, 90, 120, 180];

const pad2 = (n) => String(n).padStart(2, "0");
const hms = (s) => `${pad2(Math.floor(s / 3600))}:${pad2(Math.floor((s % 3600) / 60))}:${pad2(s % 60)}`;

export function generate(r, level) {
  const [Y, M, D] = r.pick(FIRST_DAYS);
  const base = Date.UTC(Y, M - 1, D);
  const dayStr = (i) => new Date(base + i * 86400000).toISOString().slice(0, 10);
  const tsStr = (sec) => new Date(base + sec * 1000).toISOString().replace("T", " ").replace(".000Z", "+00");
  const nDays = level + 1;
  const jobs = r.sample(JOBS, level === 1 ? 4 : 5).sort();

  // Schedules: [{job, from (day index, may be negative = before the window), time, sla}]
  const schedules = [];
  for (const j of jobs) schedules.push({ job: j, from: -r.int(3, 40), time: r.pick(SCHED), sla: r.pick(SLA) });
  if (level === 3) {
    const [changed, fresh] = r.sample(jobs, 2);
    const s0 = schedules.find((s) => s.job === changed);
    let t2; do t2 = r.pick(SCHED); while (t2 === s0.time);
    schedules.push({ job: changed, from: r.int(1, nDays - 1), time: t2, sla: r.pick(SLA) });
    schedules.find((s) => s.job === fresh).from = r.int(1, nDays - 2);       // starts inside the window
  }
  // The schedule in effect on a day: the latest effective_from on or before it.
  const schedFor = (job, day) => schedules.filter((s) => s.job === job && s.from <= day).sort((a, b) => b.from - a.from)[0] || null;

  const cells = [];
  for (let d = 0; d < nDays; d++) for (const j of jobs) { const s = schedFor(j, d); if (s) cells.push({ job: j, day: d, s }); }

  // Scenario per cell; some are forced so every instance has its edge cases.
  const forced = ["ok", "late", "missed", "retry_ok"];
  if (level >= 2) forced.push("exact", "repair_after_success", "failed_repair_after_success", "repair_next_day");
  if (level === 3) forced.push("none", "running_after_fail", "running_after_success");
  const pool = level === 1 ? ["ok", "ok", "retry_ok", "late", "missed"]
    : level === 2 ? ["ok", "ok", "retry_ok", "late", "missed", "exact", "repair_after_success", "failed_repair_after_success", "repair_next_day"]
      : ["ok", "retry_ok", "late", "missed", "exact", "repair_after_success", "failed_repair_after_success", "repair_next_day", "none", "running_after_fail"];
  const order = r.shuffle(cells.map((_, i) => i));
  const scen = new Array(cells.length);
  forced.forEach((f, k) => { if (k < order.length) scen[order[k]] = f; });
  for (let i = 0; i < cells.length; i++) if (!scen[i]) scen[i] = r.pick(pool);

  const runs = [];   // {job, day (run_date index), type, start, end|null, state}
  cells.forEach((c, i) => {
    const sched = c.day * 86400 + c.s.time;
    const deadline = sched + c.s.sla * 60;
    const add = (type, start, end, state) => runs.push({ job: c.job, day: c.day, type, start, end, state });
    const st = sched + r.int(0, 150);
    switch (scen[i]) {
      case "ok": add("scheduled", st, deadline - r.int(120, 1800), "SUCCESS"); break;
      case "late": add("scheduled", st, deadline + r.int(1, 2400), "SUCCESS"); break;
      case "exact": add("scheduled", st, deadline, "SUCCESS"); break;
      case "retry_ok": {
        const e1 = st + r.int(120, 900);
        add("scheduled", st, e1, "FAILED");
        const s2 = e1 + r.int(30, 300);
        add("retry", s2, r.chance(0.5) ? deadline - r.int(1, 600) : deadline + r.int(1, 900), "SUCCESS");
        break;
      }
      case "missed": {
        let t = st;
        const n = r.int(1, 3);
        for (let k = 0; k < n; k++) {
          const e = t + r.int(60, 900);
          add(k === 0 ? "scheduled" : "retry", t, e, k === n - 1 && r.chance(0.3) ? "CANCELED" : "FAILED");
          t = e + r.int(30, 300);
        }
        break;
      }
      case "repair_after_success": {
        const e1 = deadline - r.int(300, 1800);
        add("scheduled", st, e1, "SUCCESS");
        const s2 = deadline + r.int(60, 1800);
        add("repair", s2, s2 + r.int(300, 1500), "SUCCESS");
        break;
      }
      case "failed_repair_after_success": {
        const e1 = deadline - r.int(300, 1800);
        add("scheduled", st, e1, "SUCCESS");
        const s2 = e1 + r.int(600, 3600);
        add("repair", s2, s2 + r.int(60, 600), "FAILED");
        break;
      }
      case "repair_next_day": {
        const e1 = st + r.int(120, 600);
        add("scheduled", st, e1, "FAILED");
        add("retry", e1 + 60, e1 + 60 + r.int(60, 600), "FAILED");
        const s3 = Math.max((c.day + 1) * 86400 + r.int(1800, 7200), deadline + 600);
        add("repair", s3, s3 + r.int(600, 2400), "SUCCESS");
        break;
      }
      case "running_after_fail": {
        const e1 = st + r.int(120, 600);
        add("scheduled", st, e1, "FAILED");
        add("retry", e1 + r.int(30, 120), null, "RUNNING");
        break;
      }
      case "running_after_success": {
        const e1 = deadline - r.int(300, 1800);
        add("scheduled", st, e1, "SUCCESS");
        add("repair", deadline + r.int(60, 600), null, "RUNNING");
        break;
      }
      case "none": break;
    }
  });
  runs.sort((a, b) => a.start - b.start || (a.job < b.job ? -1 : 1));
  let rid = 700000 + r.int(0, 90000);
  const seq = new Map();
  for (const x of runs) {
    x.id = (rid += r.int(1, 9));
    const k = x.job + "|" + x.day;
    seq.set(k, (seq.get(k) || 0) + 1);
    x.attempt = seq.get(k);
  }

  const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
  const solve = (o = {}) => {
    const out = [];
    const keyDay = (x) => (o.byStartDate ? Math.floor(x.start / 86400) : x.day);
    const useRun = (x) => (o.scheduledOnly ? x.type === "scheduled" : true);
    const ok = (x) => (o.anyFinished ? x.end !== null && x.state !== "RUNNING" : x.state === "SUCCESS");
    for (let d = 0; d < nDays; d++) {
      for (const j of jobs) {
        const s = schedFor(j, d) && o.currentSchedule ? schedFor(j, nDays + 99) : schedFor(j, d);
        if (!s) continue;
        const mine = runs.filter((x) => x.job === j && keyDay(x) === d && useRun(x));
        if (o.innerJoin && mine.length === 0) continue;
        const deadline = d * 86400 + s.time + s.sla * 60;
        const succ = mine.filter(ok).map((x) => x.end);
        let delivered = null;
        if (succ.length) delivered = o.firstSuccess ? Math.min(...succ) : Math.max(...succ);
        let status, late;
        if (delivered === null) { status = "MISSED"; late = null; }
        else if (o.strict ? delivered < deadline : delivered <= deadline) { status = "MET"; late = 0; }
        else { status = "LATE"; late = Math.ceil((delivered - deadline) / 60); }
        out.push([dayStr(d), j, mine.length, tsStr(deadline), delivered === null ? null : tsStr(delivered), status, late]);
      }
    }
    return out.sort((a, b) => cmp(a[0], b[0]) || cmp(a[1], b[1]));
  };
  const rows = solve();

  const diagnostics = [
    { message: "A failed or canceled run was taken as the delivery. Only a run with result_state = 'SUCCESS' delivers the day's output.", rows: solve({ anyFinished: true }) },
    { message: "Only the scheduled attempt was considered. Retries and repair runs for the same run_date count too.", rows: solve({ scheduledOnly: true }) },
  ];
  if (level >= 2) {
    diagnostics.push({ message: "The first successful run was used. A later successful repair run replaces the output, so the day is final only when the latest successful run ends.", rows: solve({ firstSuccess: true }) });
    diagnostics.push({ message: "Runs were grouped by the UTC date they started. A repair run belongs to its run_date, even when it starts the next day.", rows: solve({ byStartDate: true }) });
    diagnostics.push({ message: "A run that ended exactly at the deadline was counted LATE. The deadline is inclusive.", rows: solve({ strict: true }) });
  }
  if (level === 3) {
    diagnostics.push({ message: "Days with no run at all are missing. Every date on which a schedule is in effect gets a row; with no run it is MISSED with runs = 0.", rows: solve({ innerJoin: true }) });
    diagnostics.push({ message: "Every date used the job's current schedule. Use the schedule row in effect on that run_date (the latest effective_from on or before it).", rows: solve({ currentSchedule: true }) });
  }

  const sCols = ["job_id", "effective_from", "schedule_time", "sla_minutes"];
  const sRows = schedules.slice().sort((a, b) => cmp(a.job, b.job) || a.from - b.from).map((s) => [s.job, dayStr(s.from), hms(s.time), s.sla]);
  const rCols = ["run_id", "job_id", "run_date", "attempt", "run_type", "start_ts", "end_ts", "result_state"];
  const rRows = runs.map((x) => [x.id, x.job, dayStr(x.day), x.attempt, x.type, tsStr(x.start), x.end === null ? null : tsStr(x.end), x.state]);
  const setup =
    "SET TIME ZONE 'UTC';\n" +
    "CREATE TABLE job_schedules (\n  job_id TEXT NOT NULL,\n  effective_from DATE NOT NULL,\n  schedule_time TIME NOT NULL,      -- daily, UTC\n  sla_minutes INT NOT NULL,\n  PRIMARY KEY (job_id, effective_from)\n);\n" +
    "CREATE TABLE job_runs (\n  run_id BIGINT PRIMARY KEY,\n  job_id TEXT NOT NULL,\n  run_date DATE NOT NULL,           -- the logical date the run produces\n  attempt INT NOT NULL,\n  run_type TEXT NOT NULL,           -- scheduled | retry | repair\n  start_ts TIMESTAMPTZ NOT NULL,\n  end_ts TIMESTAMPTZ,               -- NULL while RUNNING\n  result_state TEXT NOT NULL        -- SUCCESS | FAILED | CANCELED | RUNNING\n);\n" +
    insertSQL("job_schedules", sCols, sRows) + insertSQL("job_runs", rCols, rRows);

  return {
    vars: {
      first_day: dayStr(0),
      last_day: dayStr(nDays - 1),
      runs: runs.length,
      schedule_rule: level === 3
        ? "A job's schedule can change: use the `job_schedules` row with the latest `effective_from` on or before the `run_date`. A date before a job's first `effective_from` has no schedule and no row. A scheduled date with no run at all is `MISSED` with `runs = 0`. A run still `RUNNING` (no `end_ts`) counts in `runs` but has delivered nothing."
        : "Each job has one `job_schedules` row, in effect for the whole window, and at least one run on every date.",
    },
    setup,
    tables: [
      { name: "job_schedules", columns: sCols, rows: sRows },
      { name: "job_runs", columns: rCols, rows: rRows },
    ],
    expected: { columns: ["run_date", "job_id", "runs", "deadline", "delivered_at", "status", "minutes_late"], rows },
    diagnostics: diagnostics.filter((d) => JSON.stringify(d.rows) !== JSON.stringify(rows)),
  };
}
