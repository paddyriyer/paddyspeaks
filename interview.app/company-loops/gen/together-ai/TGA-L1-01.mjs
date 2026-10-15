/* TGA-L1-01 — Fine-tuning job outcomes per base model and method (SQL).
   Simulated practice scenario. All data is generated from the seed; base models,
   tenants, job counts and timings are hypothetical.

   Contract: generate(r, level) -> { vars, setup, tables, expected, diagnostics }.
   The oracle below walks the generated attempts and their events in JavaScript; the
   evaluator's reference SQL is written independently and must return the same rows.
   level: 1 Medium (retries of failed jobs, one queued period per attempt)
          · 2 Hard (+ jobs cancelled while queued or while training, a cancelled job
            that was resubmitted, terminal events delivered twice)
          · 3 Very Hard (+ attempts preempted and queued again, so time queued is the
            sum of several periods; a retry that switched from a full fine-tune to LoRA) */
import { insertSQL, pad2 } from "../../js/rng.js";

export const kind = "sql";

const MODELS = ["oak-8b", "oak-70b", "birch-7b", "cedar-32b", "fir-3b", "elm-14b", "pine-24b"];
const TENANTS = ["t-0412", "t-0907", "t-1133", "t-1580", "t-2264", "t-2718", "t-3091"];
const BASE = Date.UTC(2026, 8, 14);          // Monday 2026-09-14 00:00 UTC
const TERMINAL = ["completed", "validation_failed", "failed", "cancelled"];

function stamp(min) {                        // minutes after BASE -> "YYYY-MM-DD HH:MM:00+00"
  const d = new Date(BASE + min * 60000);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())} ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}:00+00`;
}
function median(xs) {
  if (!xs.length) return null;
  const s = xs.slice().sort((a, b) => a - b), n = s.length;
  return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
}
function round3(num, den) {                  // num/den rounded half-up to 3 decimals, exactly
  if (!den) return null;
  return Math.floor((2000 * num + den) / (2 * den)) / 1000;
}

export function generate(r, level) {
  const models = r.sample(MODELS, level === 1 ? 2 : 3);
  const attempts = [];                       // {id, root, model, method, at, outcome, queue, firstRun}
  const events = [];                         // [job_id, state, minute]
  let nextId = 3000 + r.int(0, 4000);

  // One attempt and its events. outcome is the attempt's terminal state.
  const attempt = (root, model, method, at, outcome, opts = {}) => {
    const id = "ftjob-" + nextId++;
    const a = { id, root: root || id, retry_of: root, model, method, at, outcome, queue: null, firstQueue: null, firstRun: null, end: 0 };
    attempts.push(a);
    events.push([id, "validating", at]);
    let t = at + r.int(1, 8);
    if (outcome === "validation_failed") {
      events.push([id, "validation_failed", t]);
      a.end = t;
      return a;
    }
    events.push([id, "queued", t]);
    if (outcome === "cancelled" && opts.inQueue) {
      const q = r.int(5, 90);
      t += q;
      events.push([id, "cancelled", t]);
      a.queue = q; a.firstQueue = q; a.end = t;
      return a;
    }
    const q1 = r.int(2, 240);
    t += q1;
    events.push([id, "running", t]);
    a.queue = q1; a.firstQueue = q1; a.firstRun = t;
    if (opts.preempt) {                      // preempted: back to the queue, then running again
      t += r.int(10, 200);
      events.push([id, "queued", t]);
      const q2 = r.int(3, 150);
      t += q2;
      events.push([id, "running", t]);
      a.queue += q2;
    }
    t += r.int(20, 600);
    events.push([id, outcome, t]);
    a.end = t;
    return a;
  };

  // A logical job: a first attempt, then retries pointing at it; the last attempt's outcome counts.
  const job = (outcomes, opts = {}) => {
    const model = opts.model || r.pick(models);
    let method = opts.method || (r.chance(0.6) ? "lora" : "full");
    let at = opts.at ?? r.int(0, 3 * 1440);
    let root = null;
    outcomes.forEach((o, i) => {
      if (opts.switchAt === i) method = "lora";
      const a = attempt(root, model, method, at, o, (opts.each && opts.each[i]) || {});
      if (!root) root = a.id;
      at = a.end + r.int(5, 300);
    });
  };

  // Every chosen model gets a completed job and at least one more, so every group is busy.
  for (const m of models) {
    job(["completed"], { model: m, method: "lora" });
    job([r.pick(["failed", "validation_failed"]), "completed"], { model: m });
  }
  const extra = level === 1 ? r.int(6, 8) : r.int(9, 12);
  for (let i = 0; i < extra; i++) {
    const roll = r.next();
    if (roll < 0.35) job(["completed"]);
    else if (roll < 0.5) job(["validation_failed"]);
    else if (roll < 0.62) job(["failed"]);
    else if (roll < 0.8) job(["validation_failed", r.pick(["completed", "failed"])]);
    else job(["failed", "failed", r.pick(["completed", "failed"])]);
  }
  // Retried twice: two failures, then a success; the first two must not count.
  job(["validation_failed", "failed", "completed"], { model: models[0] });
  if (level >= 2) {
    job(["cancelled"], { each: [{ inQueue: true }] });              // cancelled while queued
    job(["cancelled"]);                                              // cancelled while training
    job(["cancelled", "completed"], { model: models[1], each: [{ inQueue: r.chance(0.5) }] });  // resubmitted after a cancel
    job(["failed", "cancelled"], { model: models[2] });              // retried, then cancelled
  }
  if (level === 3) {
    job(["completed"], { model: models[0], each: [{ preempt: true }] });
    job(["failed", "completed"], { model: models[1], each: [{}, { preempt: true }] });
    job(["failed"], { model: models[2], each: [{ preempt: true }] });
    job(["failed", "completed"], { model: models[0], method: "full", switchAt: 1 });   // full failed, retried as LoRA
    job(["validation_failed", "failed", "completed"], { model: models[2], method: "full", switchAt: 2 });
  }

  // Hard: some terminal events were delivered twice (same job, state and minute).
  const dupes = [];
  if (level >= 2) {
    const latestIds = new Set(latestAttempts().map((a) => a.id));
    const cands = attempts.filter((a) => latestIds.has(a.id));
    for (const a of r.sample(cands, 3)) {
      const e = events.find((x) => x[0] === a.id && TERMINAL.includes(x[1]));
      dupes.push([e[0], e[1], e[2]]);
    }
  }
  events.push(...dupes);

  function latestAttempts(byFirst) {         // the last (or first) attempt of every logical job
    const m = new Map();
    for (const a of attempts) {
      const cur = m.get(a.root);
      if (!cur || (byFirst ? a.at < cur.at : a.at > cur.at)) m.set(a.root, a);
    }
    return [...m.values()];
  }

  // ---- Oracle -------------------------------------------------------------------
  const compute = (o = {}) => {
    let units = o.everyAttempt ? attempts : latestAttempts(o.firstOutcome);
    const groups = new Map();
    for (const a of units) {
      const model = a.model;
      let method = a.method;
      if (o.originalMethod) method = attempts.find((x) => x.id === a.root).method;
      const key = model + "|" + method;
      if (!groups.has(key)) groups.set(key, { jobs: 0, c: { completed: 0, validation_failed: 0, failed: 0, cancelled: 0 }, q: [] });
      const g = groups.get(key);
      const w = o.countEvents ? events.filter((e) => e[0] === a.id && TERMINAL.includes(e[1])).length : 1;
      g.jobs += w;
      g.c[a.outcome] += w;
      if (a.outcome === "completed" || a.outcome === "failed") {
        let q = a.queue;
        if (o.fromCreated) q = a.firstRun - a.at;
        if (o.firstPeriod) q = a.firstQueue;
        g.q.push(q);
      }
    }
    return [...groups.keys()].sort().map((k) => {
      const [model, method] = k.split("|");
      const g = groups.get(k);
      const den = o.cancelInRate ? g.jobs : g.jobs - g.c.cancelled;
      return [model, method, g.jobs, g.c.completed, g.c.validation_failed, g.c.failed, g.c.cancelled,
        round3(g.c.completed, den), median(g.q)];
    });
  };
  const rows = compute();

  const diagnostics = [
    { message: "Every attempt was counted. A retry names the original job in retry_of; the original and its retries are one job, counted once by its latest attempt.", rows: compute({ everyAttempt: true }) },
    { message: "Each job was counted by its first attempt. The outcome, base model and method of a retried job are those of its latest attempt.", rows: compute({ firstOutcome: true }) },
    { message: "Queue time was measured from created_at. Minutes queued run from a queued event to the attempt's next event; dataset validation is not queueing.", rows: compute({ fromCreated: true }) },
  ];
  if (level >= 2) {
    diagnostics.push({ message: "Cancelled jobs were left in the completion_rate denominator. Cancelled jobs are shown apart: the rate is completed over completed plus both kinds of failure.", rows: compute({ cancelInRate: true }) });
    diagnostics.push({ message: "Terminal events were counted instead of jobs, so a terminal event delivered twice counted twice. Count one outcome per job.", rows: compute({ countEvents: true }) });
  }
  if (level === 3) {
    diagnostics.push({ message: "Only the first queued period was counted. A preempted attempt goes back to the queue; every queued period adds to its minutes queued.", rows: compute({ firstPeriod: true }) });
    diagnostics.push({ message: "A retried job was grouped by its original method. A job retried as LoRA after a full fine-tune failed belongs to the LoRA group.", rows: compute({ originalMethod: true }) });
  }

  // ---- Tables ---------------------------------------------------------------------
  const tenantOf = new Map();
  for (const a of attempts) if (!tenantOf.has(a.root)) tenantOf.set(a.root, r.pick(TENANTS));
  const jobCols = ["job_id", "tenant_id", "base_model", "method", "retry_of", "created_at"];
  const jobRows = attempts
    .slice()
    .sort((a, b) => a.at - b.at || (a.id < b.id ? -1 : 1))
    .map((a) => [a.id, tenantOf.get(a.root), a.model, a.method, a.retry_of, stamp(a.at)]);
  const evCols = ["job_id", "state", "event_ts"];
  const evRows = events
    .slice()
    .sort((a, b) => a[2] - b[2] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0))
    .map((e) => [e[0], e[1], stamp(e[2])]);

  const setup =
    "SET TIME ZONE 'UTC';\n" +
    "CREATE TABLE ft_jobs (\n  job_id TEXT PRIMARY KEY,\n  tenant_id TEXT NOT NULL,\n  base_model TEXT NOT NULL,\n  method TEXT NOT NULL CHECK (method IN ('lora','full')),\n  retry_of TEXT REFERENCES ft_jobs(job_id),\n  created_at TIMESTAMPTZ NOT NULL\n);\n" +
    "CREATE TABLE ft_job_events (\n  job_id TEXT NOT NULL REFERENCES ft_jobs(job_id),\n  state TEXT NOT NULL CHECK (state IN ('validating','validation_failed','queued','running','completed','failed','cancelled')),\n  event_ts TIMESTAMPTZ NOT NULL\n);\n" +
    insertSQL("ft_jobs", jobCols, jobRows) + insertSQL("ft_job_events", evCols, evRows);

  return {
    vars: {
      attempts: attempts.length,
      events: events.length,
      cancel_rule: level === 1
        ? "No job in this sample was cancelled."
        : "A job can be cancelled while it is queued or while it is training, and a customer can resubmit a cancelled job as a retry. Some terminal events were delivered twice: the same job, state and timestamp appear in two rows.",
      queue_rule: level === 3
        ? "An attempt can be preempted: after running it goes back to queued and later runs again, so its minutes queued add up over several queued periods. A retry can change method: a customer may retry a failed full fine-tune as LoRA."
        : "In this sample each attempt is queued at most once, and a retry keeps the base model and method of the original.",
    },
    setup,
    tables: [
      { name: "ft_jobs", columns: jobCols, rows: jobRows },
      { name: "ft_job_events", columns: evCols, rows: evRows },
    ],
    expected: {
      columns: ["base_model", "method", "jobs", "completed", "failed_validation", "failed_training", "cancelled", "completion_rate", "median_queue_minutes"],
      rows,
    },
    diagnostics: diagnostics.filter((d) => JSON.stringify(d.rows) !== JSON.stringify(rows)),
  };
}
