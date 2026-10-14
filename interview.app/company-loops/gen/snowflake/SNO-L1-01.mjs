/* SNO-L1-01 — Long-running query outliers against each fingerprint's own p90 baseline (SQL).
   Simulated practice scenario. All data is generated from the seed. The table is a
   simplified, hypothetical query log, not any product's actual view definition.

   Contract: see docs/COMPANY-INTERVIEW-LOOPS.md § Executable templates (sql).
   level: 1 Medium (execution time = elapsed − queued; p90 of the previous N days per
            fingerprint; a minimum number of baseline runs; outlier above factor × p90)
          2 Hard (+ failed queries ignored everywhere, runs before the window, exact
            window/day boundaries, exactly factor × p90, exactly min_runs)
          3 Very Hard (+ one fingerprint on two warehouse sizes: the baseline is per
            fingerprint and size; a minimum absolute excess over the p90) */
import { insertSQL, ts, pad2 } from "../../js/rng.js";

export const kind = "sql";

const REPORT_DATES = ["2026-09-22", "2026-09-23", "2026-09-24", "2026-09-28", "2026-09-29", "2026-09-30"];
const WAREHOUSES = { XSMALL: "ADHOC_WH", SMALL: "BI_WH", MEDIUM: "ETL_WH", LARGE: "TRANSFORM_WH" };
const USERS = ["dbt_runner", "looker_svc", "analyst_ana", "analyst_raj", "airflow_svc", "finance_bi"];
const HEX = "0123456789abcdef".split("");

function addDays(day, n) {
  const d = new Date(Date.parse(day + "T00:00:00Z") + n * 86400000);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

// PostgreSQL's percentile_cont: linear interpolation between the two nearest ranks.
export function p90(values) {
  const v = values.slice().sort((a, b) => a - b);
  const pos = 0.9 * (v.length - 1);
  const lo = Math.floor(pos), hi = Math.ceil(pos);
  return v[lo] + (v[hi] - v[lo]) * (pos - lo);
}

export function generate(r, level) {
  const report = r.pick(REPORT_DATES);
  const N = level === 1 ? 7 : r.pick([7, 14]);
  const factor = level === 1 ? r.pick([2, 3]) : r.pick([2, 2.5, 3]);
  const minRuns = r.pick([5, 6, 8]);
  const minExcess = level === 3 ? r.pick([1000, 2000, 3000]) : 0;
  const windowStart = addDays(report, -N);

  const rows = [];      // {id, hash, size, user, day, sec, status, exec, queued}
  let qid = 100000 + r.int(0, 800000);
  const usedHashes = new Set();
  const newHash = () => {
    let h;
    do h = "qh_" + Array.from({ length: 8 }, () => r.pick(HEX)).join(""); while (usedHashes.has(h));
    usedHashes.add(h);
    return h;
  };
  const add = (hash, size, day, sec, exec, queued = 0, status = "SUCCESS") =>
    rows.push({ id: "q" + (qid += r.int(1, 9)), hash, size, user: r.pick(USERS), day, sec, status, exec, queued });
  const baselineDay = () => addDays(report, -r.int(1, N));
  const anySec = () => r.int(60, 86340);
  const queuedMaybe = () => (r.chance(0.3) ? r.int(100, 4000) : 0);
  // n baseline successes around `base` ms, with an optional forced list of values.
  const baseline = (hash, size, base, n, forced = null) => {
    const vals = forced || Array.from({ length: n }, () => Math.max(1, Math.round(base * (0.6 + 0.8 * r.next()))));
    for (const v of vals) add(hash, size, baselineDay(), anySec(), v, queuedMaybe());
    return vals;
  };
  const sizes = Object.keys(WAREHOUSES);

  // Ordinary fingerprints: some outliers, some normal runs, one slow only because it queued.
  const nFp = level === 1 ? 4 : 5;
  for (let i = 0; i < nFp; i++) {
    const h = newHash(), size = r.pick(sizes);
    const base = r.pick([800, 1500, 4000, 9000, 25000]) + r.int(0, 300);
    const vals = baseline(h, size, base, r.int(minRuns, minRuns + 12));
    const p = p90(vals);
    const k = r.int(2, 4);
    for (let j = 0; j < k; j++) add(h, size, report, anySec(), Math.max(1, Math.round(base * (0.5 + 0.7 * r.next()))), queuedMaybe());
    if (i % 2 === 0 || r.chance(0.4)) add(h, size, report, anySec(), Math.floor(factor * p) + r.int(1, base), queuedMaybe());
    if (i === 1) {
      const exec = Math.round(base * (0.8 + 0.3 * r.next()));
      add(h, size, report, anySec(), exec, Math.ceil(factor * p) - exec + r.int(500, 5000));   // slow only in the queue
    }
  }
  // Every level: a fingerprint with exactly min_runs baseline runs and a clear outlier.
  {
    const h = newHash(), size = r.pick(sizes), base = 2000 + r.int(0, 2000);
    const vals = baseline(h, size, base, minRuns);
    add(h, size, report, anySec(), Math.ceil(factor * p90(vals)) + r.int(200, 3000), queuedMaybe());
    add(h, size, report, anySec(), base, 0);
  }
  if (level >= 2) {
    // 11 baseline runs: the p90 is exactly the 10th value, so exactly factor × p90 is testable.
    const h = newHash(), size = r.pick(sizes), base = 2 * (1000 + r.int(0, 1500));
    const vals = Array.from({ length: 11 }, () => 2 * Math.round((base * (0.6 + 0.8 * r.next())) / 2));
    baseline(h, size, base, 11, vals);
    const v9 = vals.slice().sort((a, b) => a - b)[9];
    add(h, size, report, anySec(), factor * v9, 0);                         // equal: not an outlier
    add(h, size, report, r.int(0, 59), factor * v9 + 1, r.int(0, 1) * 700); // one more: outlier
    // A failed run on the report day and failed baseline runs that would lift the p90.
    add(h, size, report, anySec(), factor * v9 * 4, 0, "FAILED");
    add(h, size, baselineDay(), anySec(), base * 20, 0, "FAILED");
    add(h, size, baselineDay(), anySec(), base * 25, 0, "FAILED");

    // Window edges: a run exactly at the window start counts; the second before does not.
    const h2 = newHash(), s2 = r.pick(sizes), b2 = 3000 + r.int(0, 2000);
    const v2 = Array.from({ length: minRuns - 1 }, () => Math.round(b2 * (0.6 + 0.8 * r.next())));
    baseline(h2, s2, b2, minRuns - 1, v2);
    add(h2, s2, windowStart, 0, Math.round(b2 * 0.9), 0);                  // the min_runs-th run, at the edge
    add(h2, s2, addDays(windowStart, -1), 86399, b2 * 30, 0);               // outside: would lift the p90
    add(h2, s2, addDays(windowStart, -3), anySec(), b2 * 30, 0);
    const p2 = p90([...v2, Math.round(b2 * 0.9)]);
    add(h2, s2, report, 86399, Math.ceil(factor * p2) + r.int(100, 900), 0); // last second of the day
    add(h2, s2, addDays(report, 1), 0, b2 * 40, 0);                         // next day: not reported

    // Too few runs in the window (one more just before it): never evaluated.
    const h3 = newHash(), s3 = r.pick(sizes), b3 = 5000 + r.int(0, 3000);
    baseline(h3, s3, b3, minRuns - 1);
    add(h3, s3, addDays(windowStart, -1), r.int(80000, 86399), b3, 0);
    add(h3, s3, report, anySec(), b3 * 10, 0);
  }
  if (level === 3) {
    // One fingerprint on two warehouse sizes: the large one is much faster.
    const h = newHash();
    const bigBase = 4000 + r.int(0, 2000), smallBase = 6 * bigBase;
    const vl = baseline(h, "LARGE", bigBase, minRuns + 8);
    const vs = baseline(h, "XSMALL", smallBase, minRuns + 2);
    add(h, "LARGE", report, anySec(), Math.ceil(factor * p90(vl)) + r.int(100, 800), 0);   // outlier for LARGE
    add(h, "XSMALL", report, anySec(), Math.round(smallBase * 1.2), 0);                     // normal for XSMALL
    add(h, "XSMALL", report, anySec(), Math.ceil(factor * p90(vs)) + r.int(100, 800), 0);  // outlier for XSMALL
    // A tiny fingerprint: a large ratio but a small absolute excess.
    const ht = newHash(), st = r.pick(sizes), bt = 60 + r.int(0, 60);
    const vt = baseline(ht, st, bt, minRuns + 3);
    add(ht, st, report, anySec(), Math.ceil(factor * p90(vt)) + 10, 0);
    // Exactly the minimum excess counts; one millisecond less does not.
    const he = newHash(), se = r.pick(sizes), be = Math.floor(minExcess / 5);
    const ve = Array.from({ length: 11 }, () => Math.round(be * (0.6 + 0.8 * r.next())));
    baseline(he, se, be, 11, ve);
    const e9 = ve.slice().sort((a, b) => a - b)[9];
    add(he, se, report, anySec(), e9 + minExcess, 0);
    add(he, se, report, anySec(), e9 + minExcess - 1, 0);
  }

  const cmp = (x, y) => (x < y ? -1 : x > y ? 1 : 0);
  const reportStart = Date.parse(report + "T00:00:00Z") / 1000;
  const at = (q) => Date.parse(q.day + "T00:00:00Z") / 1000 + q.sec;
  const solve = (o = {}) => {
    const lo = reportStart - N * 86400 + (o.windowShift || 0);
    const metric = (q) => (o.elapsed ? q.exec + q.queued : q.exec);
    const ok = (q) => o.withFailed || q.status === "SUCCESS";
    const key = (q) => (o.ignoreSize ? q.hash : q.hash + "|" + q.size);
    const base = new Map();
    for (const q of rows) {
      const t = at(q);
      const inWin = o.allHistory ? t < reportStart + 86400 : t >= lo && t < reportStart;
      if (!ok(q) || !inWin) continue;
      if (!base.has(key(q))) base.set(key(q), []);
      base.get(key(q)).push(metric(q));
    }
    const out = [];
    for (const q of rows) {
      const t = at(q);
      if (!ok(q) || t < reportStart || t >= reportStart + 86400) continue;
      const b = base.get(key(q));
      if (!b || b.length < minRuns + (o.runsOff || 0)) continue;
      const p = p90(b);
      const m = metric(q);
      if (!(o.ge ? m >= factor * p : m > factor * p)) continue;
      if (!o.noExcess && m - p < minExcess) continue;
      out.push([q.id, q.hash, q.size, m, Math.round(p * 10) / 10, b.length]);
    }
    out.sort((a, b) => cmp(a[1], b[1]) || b[3] - a[3] || cmp(a[0], b[0]));
    return out;
  };
  const expected = solve();

  const diagnostics = [
    { message: "Elapsed time was compared, queue time included. A query that waited for a busy warehouse is a capacity problem, not a slower query: compare total_elapsed_ms − queued_ms.", rows: solve({ elapsed: true }) },
    { message: "The baseline included the report day itself (or all history). The baseline is the previous N days only, before the report date.", rows: solve({ allHistory: true }) },
  ];
  if (level >= 2) {
    diagnostics.push({ message: "Failed queries were included. Only SUCCESS runs form the baseline and only SUCCESS runs are reported.", rows: solve({ withFailed: true }) });
    diagnostics.push({ message: "A run at exactly factor × p90 was reported. An outlier is strictly above factor × p90.", rows: solve({ ge: true }) });
    diagnostics.push({ message: "The baseline window starts a second late or early: it is [report_date − N days, report_date), and a run exactly at the start counts.", rows: solve({ windowShift: 1 }) });
    diagnostics.push({ message: "The minimum number of baseline runs is off by one: a fingerprint with exactly min_runs runs is evaluated.", rows: solve({ runsOff: 1 }) });
  }
  if (level === 3) {
    diagnostics.push({ message: "The baseline mixed warehouse sizes. A fingerprint's runs on a large warehouse and on an extra-small one need separate baselines.", rows: solve({ ignoreSize: true }) });
    diagnostics.push({ message: "The minimum absolute excess was ignored: a 100 ms query that took 400 ms is not worth an alert.", rows: solve({ noExcess: true }) });
  }

  const cols = ["query_id", "query_hash", "warehouse_name", "warehouse_size", "user_name", "start_time", "execution_status", "total_elapsed_ms", "queued_ms"];
  const sorted = rows.slice().sort((a, b) => at(a) - at(b) || cmp(a.id, b.id));
  const tRows = sorted.map((q) => [q.id, q.hash, WAREHOUSES[q.size], q.size, q.user, ts(q.day, q.sec), q.status, q.exec + q.queued, q.queued]);
  const setup =
    "SET TIME ZONE 'UTC';\n" +
    "CREATE TABLE query_history (\n  query_id TEXT PRIMARY KEY,\n  query_hash TEXT NOT NULL,\n  warehouse_name TEXT NOT NULL,\n  warehouse_size TEXT NOT NULL,\n  user_name TEXT NOT NULL,\n  start_time TIMESTAMPTZ NOT NULL,\n  execution_status TEXT NOT NULL,\n  total_elapsed_ms BIGINT NOT NULL,\n  queued_ms BIGINT NOT NULL\n);\n" +
    insertSQL("query_history", cols, tRows);

  return {
    vars: {
      report_date: report,
      baseline_days: N,
      factor,
      min_runs: minRuns,
      min_excess_ms: minExcess,
      queries: rows.length,
      status_rule: level === 1
        ? "Every query in this sample succeeded, but filter on `execution_status = 'SUCCESS'` anyway."
        : "Only queries with `execution_status = 'SUCCESS'` count, both in the baseline and on the report day; a failed run's time says nothing about the query's speed.",
      size_rule: level === 3
        ? `The baseline belongs to a fingerprint on one warehouse size: runs of the same \`query_hash\` on different \`warehouse_size\`s have separate baselines, and a query is compared only with runs on its own size. A query is also reported only if its execution time is at least ${minExcess} ms above the p90 (\`exec_ms − p90 ≥ ${minExcess}\`).`
        : "In this sample each fingerprint always runs on the same warehouse size.",
    },
    setup,
    tables: [{ name: "query_history", columns: cols, rows: tRows }],
    expected: { columns: ["query_id", "query_hash", "warehouse_size", "exec_ms", "baseline_p90_ms", "baseline_runs"], rows: expected },
    diagnostics: diagnostics.filter((d) => JSON.stringify(d.rows) !== JSON.stringify(expected)),
  };
}
