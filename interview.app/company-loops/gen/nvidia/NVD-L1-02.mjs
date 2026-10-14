/* NVD-L1-02 — Lost work after restarts: steps recomputed after each restore, and their share of GPU-hours (SQL).
   Simulated practice scenario. All data is generated from the seed. Jobs, teams, step rates,
   checkpoint intervals and GPU counts are hypothetical.

   Contract: see docs/COMPANY-INTERVIEW-LOOPS.md § Executable templates (sql).
   level: 1 Medium (failures and completions; a run restores from its last checkpoint; team totals)
          2 Hard (+ preemptions, a checkpoint in the same second as the interruption, jobs never interrupted)
          3 Very Hard (+ checkpoint attempts that failed, restarts on a different number of GPUs) */
import { insertSQL, ts } from "../../js/rng.js";

export const kind = "sql";

const TEAMS = ["team-audio", "team-llm", "team-recsys", "team-robotics", "team-vision"];
const DAY0 = Date.UTC(2026, 8, 28);           // 2026-09-28, a week of runs

const stamp = (sec) => {
  const d = new Date(DAY0 + sec * 1000);
  return ts(d.toISOString().slice(0, 10), d.getUTCHours() * 3600 + d.getUTCMinutes() * 60 + d.getUTCSeconds());
};

export function generate(r, level) {
  const teams = r.sample(TEAMS, level === 1 ? 2 : 3).sort();
  const nJobs = level === 1 ? r.int(4, 5) : r.int(5, 7);
  const jobs = [];
  const events = [];               // {job, t, type, step, gpus}
  const usedIds = new Set();
  for (let j = 0; j < nJobs; j++) {
    let id;
    do id = "job-" + r.int(1000, 9999); while (usedIds.has(id));
    usedIds.add(id);
    const team = j < teams.length ? teams[j] : r.pick(teams);
    const job = { id, team };
    jobs.push(job);
    const p = r.int(2, 6);                               // seconds per step
    const C = r.pick([100, 200, 250]);                   // checkpoint every C steps
    let gpus = r.pick([8, 16, 32, 64]);
    let t = r.int(0, 3 * 86400);
    let step = 0;
    const maxRuns = r.int(2, 4);
    const neverInterrupted = level >= 2 && j === nJobs - 1;
    const sameSecond = level >= 2 && j === 1;            // an interruption exactly at a checkpoint
    for (let run = 0; run < maxRuns; run++) {
      const last = run === maxRuns - 1 || neverInterrupted;
      const interrupted = !last && ((run === 0 && (j === 0 || sameSecond)) || r.chance(0.75));
      events.push({ job, t, type: "start", step, gpus });
      const firstCk = Math.floor(step / C) * C + C;
      let F = step + (interrupted ? r.int(40, 900) : r.int(300, 1500));
      let forceFailedLast = false;
      if (interrupted && run === 0 && sameSecond) F = firstCk + C * r.int(0, 2);          // exactly at a checkpoint
      else if (interrupted && run === 0 && j === 0 && level === 3) {
        F = firstCk + C * r.int(1, 2) + r.int(1, C - 1);                                  // the last attempt failed
        forceFailedLast = true;
      }
      let restore = step;
      for (let c = firstCk; c <= F; c += C) {
        const isLast = c + C > F;
        let failed = level === 3 && r.chance(0.3);
        if (isLast && forceFailedLast) failed = true;
        if (isLast && interrupted && run === 0 && sameSecond) failed = false;
        events.push({ job, t: t + (c - step) * p, type: failed ? "checkpoint_failed" : "checkpoint", step: c, gpus: null });
        if (!failed) restore = c;
      }
      const end = t + (F - step) * p;
      const type = !interrupted ? "complete" : level >= 2 && r.chance(0.4) ? "preempt" : "fail";
      events.push({ job, t: end, type, step: F, gpus: null });
      if (!interrupted) break;
      t = end + r.int(60, 2400);
      step = restore;
      if (level === 3 && r.chance(0.5)) gpus = r.pick([8, 16, 32, 64].filter((g) => g !== gpus));
    }
  }

  const round = (n, d, k) => {     // ROUND(n / d, k), half away from zero, for n >= 0
    const f = 10 ** k;
    return Math.floor((2 * n * f + d) / (2 * d)) / f;
  };
  const cmp = (x, y) => (x < y ? -1 : x > y ? 1 : 0);
  const solve = (o = {}) => {
    const per = new Map();
    for (const job of jobs) {
      const ev = events.filter((e) => e.job === job).sort((a, b) => a.t - b.t);
      let cur = null, first = null;
      const s = { n: 0, steps: 0, lost: 0, total: 0 };
      for (const e of ev) {
        if (e.type === "start") {
          cur = { t: e.t, step: e.step, gpus: o.firstGpus && first ? first : e.gpus, cks: [] };
          if (!first) first = e.gpus;
        } else if (e.type === "checkpoint" || (o.failedCk && e.type === "checkpoint_failed")) {
          cur.cks.push(e);
        } else if (e.type === "fail" || e.type === "preempt" || e.type === "complete") {
          s.total += (e.t - cur.t) * cur.gpus;
          if (e.type === "fail" || (e.type === "preempt" && !o.ignorePreempt)) {
            const usable = o.noCk ? [] : cur.cks.filter((c) => (o.strictCk ? c.t < e.t : c.t <= e.t));
            const from = usable.length ? usable[usable.length - 1] : cur;
            s.n++;
            s.steps += e.step - from.step;
            s.lost += (e.t - from.t) * cur.gpus;
          }
          cur = null;
        }
      }
      per.set(job.id, { job, ...s });
    }
    const rows = [];
    for (const team of teams) {
      const mine = [...per.values()].filter((x) => x.job.team === team).sort((a, b) => cmp(a.job.id, b.job.id));
      const keep = o.dropClean ? mine.filter((x) => x.n > 0) : mine;
      if (!keep.length) continue;
      for (const x of keep) rows.push([team, x.job.id, x.n, x.steps, round(x.lost, 3600, 2), round(x.lost, x.total, 4)]);
      const T = keep.reduce((a, x) => ({ n: a.n + x.n, steps: a.steps + x.steps, lost: a.lost + x.lost, total: a.total + x.total }), { n: 0, steps: 0, lost: 0, total: 0 });
      const share = o.avgShare
        ? round(keep.reduce((a, x) => a + round(x.lost, x.total, 4) * 10000, 0), keep.length * 10000, 4)
        : round(T.lost, T.total, 4);
      rows.push([team, null, T.n, T.steps, round(T.lost, 3600, 2), share]);
    }
    return rows;
  };
  const rows = solve();

  const diagnostics = [
    { message: "Lost work was measured from the start of the run, ignoring checkpoints. A restart resumes from the last checkpoint saved in the run.", rows: solve({ noCk: true }) },
    { message: "The team row averaged its jobs' shares. The team's share is the team's lost GPU-seconds over the team's total GPU-seconds.", rows: solve({ avgShare: true }) },
  ];
  if (level >= 2) {
    diagnostics.push({ message: "Preemptions were not counted as interruptions. A preempted run loses its work since the last checkpoint just like a failed one.", rows: solve({ ignorePreempt: true }) });
    diagnostics.push({ message: "A checkpoint in the same second as the interruption was ignored. It completed, so nothing after it was lost.", rows: solve({ strictCk: true }) });
    diagnostics.push({ message: "Jobs that were never interrupted were left out. Every job gets a row (with zeros), and its GPU-hours count in the team's denominator.", rows: solve({ dropClean: true }) });
  }
  if (level === 3) {
    diagnostics.push({ message: "Failed checkpoint attempts were treated as restore points. Only event_type = 'checkpoint' can be restored from.", rows: solve({ failedCk: true }) });
    diagnostics.push({ message: "Every run was charged at the job's first GPU count. A restart can run on a different number of GPUs; use the gpus of each run's start event.", rows: solve({ firstGpus: true }) });
  }

  // Event ids in random order: order by event_ts, not event_id.
  const order = r.shuffle(events);
  let eid = 70000 + r.int(0, 20000);
  for (const e of order) e.id = (eid += r.int(1, 9));
  const jCols = ["job_id", "team"];
  const jRows = jobs.slice().sort((a, b) => cmp(a.id, b.id)).map((j) => [j.id, j.team]);
  const eCols = ["event_id", "job_id", "event_ts", "event_type", "step", "gpus"];
  const eRows = events.slice().sort((a, b) => a.id - b.id).map((e) => [e.id, e.job.id, stamp(e.t), e.type, e.step, e.gpus]);
  const setup =
    "SET TIME ZONE 'UTC';\n" +
    "CREATE TABLE jobs (\n  job_id TEXT PRIMARY KEY,\n  team TEXT NOT NULL\n);\n" +
    "CREATE TABLE job_events (\n  event_id BIGINT PRIMARY KEY,\n  job_id TEXT NOT NULL REFERENCES jobs(job_id),\n  event_ts TIMESTAMPTZ NOT NULL,\n  event_type TEXT NOT NULL,\n  step INT NOT NULL,\n  gpus INT\n);\n" +
    insertSQL("jobs", jCols, jRows) + insertSQL("job_events", eCols, eRows);

  return {
    vars: {
      jobs: jobs.length,
      events: events.length,
      types_rule: level === 1
        ? "`event_type` is `start`, `checkpoint`, `fail` or `complete`."
        : level === 2
          ? "`event_type` is `start`, `checkpoint`, `fail`, `preempt` or `complete`; a `preempt` interrupts a run exactly like a `fail`."
          : "`event_type` is `start`, `checkpoint`, `checkpoint_failed`, `fail`, `preempt` or `complete`; a `preempt` interrupts a run exactly like a `fail`, and a `checkpoint_failed` attempt saved nothing that can be restored.",
      gpus_rule: level === 3
        ? "A restart may run on a different number of GPUs than the run before it."
        : "In this sample a job keeps the same number of GPUs on every run, but read it from each run's `start` event anyway.",
    },
    setup,
    tables: [
      { name: "jobs", columns: jCols, rows: jRows },
      { name: "job_events", columns: eCols, rows: eRows },
    ],
    expected: { columns: ["team", "job_id", "interruptions", "recomputed_steps", "lost_gpu_hours", "lost_share"], rows },
    diagnostics: diagnostics.filter((d) => JSON.stringify(d.rows) !== JSON.stringify(rows)),
  };
}
