/* NVD-L1-03 — Queue wait by request size: median minutes from submission to start (SQL).
   Simulated practice scenario. All data is generated from the seed. Partitions, bucket
   boundaries, waits and the minimum-jobs floor are hypothetical.

   Contract: see docs/COMPANY-INTERVIEW-LOOPS.md § Executable templates (sql).
   level: 1 Medium (median per partition and GPU bucket; cancelled-before-start excluded; floor)
          2 Hard (+ jobs cancelled after they started, jobs still waiting, bucket boundaries hit exactly,
                  a group exactly at the floor)
          3 Very Hard (+ requeued jobs: only the first attempt's wait counts) */
import { insertSQL, ts } from "../../js/rng.js";

export const kind = "sql";

const PARTITIONS = ["batch", "debug", "interactive", "long", "priority"];
const SCHEMES = [
  [[1, 1, "1"], [2, 4, "2-4"], [5, 8, "5-8"], [9, null, "9+"]],
  [[1, 2, "1-2"], [3, 8, "3-8"], [9, 16, "9-16"], [17, null, "17+"]],
  [[1, 1, "1"], [2, 8, "2-8"], [9, 32, "9-32"], [33, null, "33+"]],
];
const DAYS = ["2026-09-28", "2026-09-29", "2026-09-30"];

export function generate(r, level) {
  const parts = r.sample(PARTITIONS, level === 1 ? 2 : 3).sort();
  const scheme = r.pick(SCHEMES);
  const minJobs = level === 1 ? r.pick([2, 3]) : r.pick([3, 4]);
  const jobs = [];                       // {id, part, gpus, attempts: [{q, s, c}]}  times in seconds from DAYS[0]
  let jid = 40000 + r.int(0, 50000);
  const gpusIn = (b, edge) => {
    const [lo, hi] = b;
    const top = hi === null ? lo + r.int(0, 3) * 8 : hi;
    if (edge) return r.pick([lo, top]);
    return r.int(lo, top);
  };
  const waitSec = () => (r.chance(0.2) ? r.int(1800, 14400) : r.int(5, 1500));
  let forcedFloor = level >= 2;          // one group exactly at the floor
  let forcedBelow = true;                // one group one short of the floor
  for (const part of parts) {
    for (const b of scheme) {
      let n = r.int(0, minJobs + 3);
      if (forcedFloor && r.chance(0.5)) { n = minJobs; forcedFloor = false; }
      else if (forcedBelow && r.chance(0.3)) { n = minJobs - 1; forcedBelow = false; }
      for (let k = 0; k < n; k++) {
        const q = r.int(0, 2 * 86400 - 20000);
        const w = waitSec();
        const att = [{ q, s: q + w, c: null }];
        if (level >= 2 && r.chance(0.15)) att[0].c = att[0].s + r.int(60, 5000);           // cancelled after it started
        if (level === 3 && att[0].c === null && r.chance(0.3)) {
          const q2 = att[0].s + r.int(300, 3000);                                          // requeued after preemption
          att.push({ q: q2, s: q2 + waitSec(), c: null });
        }
        jobs.push({ id: "j" + (jid += r.int(1, 30)), part, gpus: gpusIn(b, level >= 2 && r.chance(0.5)), attempts: att });
      }
      // jobs cancelled before they started, and (Hard+) jobs still waiting
      for (let k = r.int(0, 2); k > 0; k--) {
        const q = r.int(0, 2 * 86400 - 20000);
        jobs.push({ id: "j" + (jid += r.int(1, 30)), part, gpus: gpusIn(b, false), attempts: [{ q, s: null, c: q + r.int(10, 6000) }] });
      }
      if (level >= 2 && r.chance(0.3)) {
        const q = r.int(2 * 86400 - 20000, 2 * 86400 - 60);
        jobs.push({ id: "j" + (jid += r.int(1, 30)), part, gpus: gpusIn(b, false), attempts: [{ q, s: null, c: null }] });
      }
    }
  }
  // Guarantee at least one reported group with an even number of starts (median of two middles).
  {
    const part = r.pick(parts), b = r.pick(scheme);
    const have = jobs.filter((j) => j.part === part && bucketOf(j.gpus, scheme) === b && j.attempts[0].s !== null).length;
    let need = Math.max(minJobs, have);
    if (need % 2 === 1) need += 1;
    for (let k = have; k < need; k++) {
      const q = r.int(0, 2 * 86400 - 20000);
      jobs.push({ id: "j" + (jid += r.int(1, 30)), part, gpus: gpusIn(b, false), attempts: [{ q, s: q + waitSec(), c: null }] });
    }
  }

  const cmp = (x, y) => (x < y ? -1 : x > y ? 1 : 0);
  const round2 = (num, den) => Math.floor((2 * num * 100 + den) / (2 * den)) / 100;    // ROUND(num/den, 2), num >= 0
  const solve = (o = {}) => {
    const groups = new Map();
    for (const j of jobs) {
      let b = bucketOf(j.gpus, scheme);
      if (o.dropOpen && b[1] === null) continue;
      const k = j.part + "|" + b[0];
      if (!groups.has(k)) groups.set(k, { part: j.part, b, waits: [], cancelled: 0, submitted: 0 });
      const g = groups.get(k);
      g.submitted++;
      const a0 = j.attempts[0];
      if (a0.s === null) {
        if (a0.c !== null) g.cancelled++;
        continue;
      }
      if (o.dropAnyCancel && j.attempts.some((a) => a.c !== null)) { g.cancelled++; continue; }
      if (o.everyAttempt) for (const a of j.attempts) g.waits.push(a.s - a.q);
      else g.waits.push(a0.s - a0.q);
    }
    const rows = [];
    for (const g of groups.values()) {
      const floorN = o.floorAll ? g.submitted : g.waits.length;
      if (floorN < minJobs || g.waits.length === 0) continue;
      const w = g.waits.slice().sort((a, b) => a - b);
      const n = w.length;
      let med;
      if (o.mean) med = round2(w.reduce((a, x) => a + x, 0), 60 * n);
      else if (o.disc) med = round2(w[Math.floor((n - 1) / 2)], 60);
      else med = round2(n % 2 ? 2 * w[(n - 1) / 2] : w[n / 2 - 1] + w[n / 2], 120);
      rows.push([g.part, g.b[0], g.b[2], n, g.cancelled, med]);
    }
    return rows.sort((a, b) => cmp(a[0], b[0]) || a[1] - b[1]);
  };
  const rows = solve();

  const diagnostics = [
    { message: "The mean wait was reported. The question asks for the median (PERCENTILE_CONT(0.5)).", rows: solve({ mean: true }) },
    { message: "PERCENTILE_DISC (the lower middle value) was used. With an even number of jobs the median is the average of the two middle waits (PERCENTILE_CONT).", rows: solve({ disc: true }) },
    { message: "The open-ended top bucket (bucket_max NULL) was lost in the join. `gpus BETWEEN bucket_min AND NULL` is never true; treat NULL as no upper bound.", rows: solve({ dropOpen: true }) },
    { message: "The floor counted every submitted job. Only jobs that started count towards min_jobs.", rows: solve({ floorAll: true }) },
  ];
  if (level >= 2) diagnostics.push({ message: "Every job with a cancelled_at was excluded. A job cancelled after it started did wait in the queue and started; only jobs cancelled before starting are excluded.", rows: solve({ dropAnyCancel: true }) });
  if (level === 3) diagnostics.push({ message: "Every attempt's wait was counted. Only the first attempt measures submission to start; a requeue after preemption is a different question.", rows: solve({ everyAttempt: true }) });

  const stamp = (sec) => (sec === null ? null : ts(DAYS[Math.floor(sec / 86400)], sec % 86400));
  const cols = ["job_id", "attempt", "partition_name", "gpus_requested", "queued_at", "started_at", "cancelled_at"];
  const tRows = [];
  for (const j of r.shuffle(jobs)) j.attempts.forEach((a, i) => tRows.push([j.id, i + 1, j.part, j.gpus, stamp(a.q), stamp(a.s), stamp(a.c)]));
  const bCols = ["bucket_min", "bucket_max", "label"];
  const bRows = scheme.map((b) => [b[0], b[1], b[2]]);
  const setup =
    "SET TIME ZONE 'UTC';\n" +
    "CREATE TABLE gpu_buckets (\n  bucket_min INT PRIMARY KEY,\n  bucket_max INT,\n  label TEXT NOT NULL\n);\n" +
    "CREATE TABLE job_attempts (\n  job_id TEXT NOT NULL,\n  attempt INT NOT NULL,\n  partition_name TEXT NOT NULL,\n  gpus_requested INT NOT NULL,\n  queued_at TIMESTAMPTZ NOT NULL,\n  started_at TIMESTAMPTZ,\n  cancelled_at TIMESTAMPTZ,\n  PRIMARY KEY (job_id, attempt)\n);\n" +
    insertSQL("gpu_buckets", bCols, bRows) + insertSQL("job_attempts", cols, tRows);

  return {
    vars: {
      min_jobs: minJobs,
      rows: tRows.length,
      buckets: scheme.map((b) => "`" + b[2] + "`").join(", "),
      cancel_rule: level === 1
        ? "In this sample a job with a `cancelled_at` never started."
        : "A job can be cancelled after it started (`cancelled_at` after `started_at`): it started, so it counts. A job with neither `started_at` nor `cancelled_at` is still waiting and is left out entirely.",
      attempt_rule: level === 3
        ? "A job preempted after it started is requeued as attempt 2 (with its own `queued_at` and `started_at`). The queue wait for this report is attempt 1's only."
        : "In this sample every job has a single attempt (`attempt = 1`), but the table allows more.",
    },
    setup,
    tables: [
      { name: "gpu_buckets", columns: bCols, rows: bRows },
      { name: "job_attempts", columns: cols, rows: tRows },
    ],
    expected: { columns: ["partition_name", "bucket_min", "gpu_bucket", "jobs_started", "cancelled_before_start", "median_wait_min"], rows },
    diagnostics: diagnostics.filter((d) => JSON.stringify(d.rows) !== JSON.stringify(rows)),
  };
}

function bucketOf(g, scheme) {
  return scheme.find((b) => g >= b[0] && (b[1] === null || g <= b[1]));
}
