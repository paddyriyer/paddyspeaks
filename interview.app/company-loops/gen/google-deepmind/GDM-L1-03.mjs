/* GDM-L1-03 — Reruns that did not reproduce, per project and month (SQL).
   Simulated practice scenario. All data is generated from the seed; projects,
   config hashes, code versions, data snapshots, seeds and metrics are synthetic and
   describe no real experiment or result.

   Contract: generate(r, level) -> { vars, setup, tables, expected, diagnostics }.
   The oracle below walks the generated runs in JavaScript; the evaluator's reference
   SQL is written independently and must return the same rows.
   level: 1 Medium (one month, failed runs that never count, a rerun exactly at the
          tolerance, recipes with three or more runs) · 2 Hard (+ a second month, a
          rerun in the month after its first run, runs that differ only in seed or
          in data snapshot) · 3 Very Hard (+ two runs of a recipe started in the same
          second, runs with no recorded seed, a cancelled run that carries a metric) */
import { insertSQL, pad2 } from "../../js/rng.js";

export const kind = "sql";

const PROJECTS = ["proj-atlas", "proj-birch", "proj-cobalt", "proj-delta", "proj-ember", "proj-fjord"];
const TOLERANCES = [20, 30, 50, 100];          // in ten-thousandths of the metric
const BASE = Date.UTC(2026, 8, 1);             // 2026-09-01 00:00 UTC
const DAY = 1440;

function stamp(min) {
  const d = new Date(BASE + min * 60000);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())} ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}:00+00`;
}
function monthOf(min) {
  const d = new Date(BASE + min * 60000);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-01`;
}
const metricText = (m) => (m === null ? null : (m / 10000).toFixed(4));

export function generate(r, level) {
  const projects = r.sample(PROJECTS, level === 1 ? 2 : 3);
  const tol = r.pick(TOLERANCES);
  const days = level === 1 ? 30 : 61;          // September, or September and October
  const runs = [];                             // {project, cfg, code, snap, seed, t, status, metric}
  const hex = (n) => Array.from({ length: n }, () => "0123456789abcdef"[r.int(0, 15)]).join("");
  const snaps = ["snap-2026-08-15", "snap-2026-08-29", "snap-2026-09-12"];

  const recipe = (project) => ({ project, cfg: "cfg-" + hex(6), code: "git-" + hex(7), snap: r.pick(snaps), seed: r.int(0, 9999) });
  const run = (rc, t, metric, status = "completed", over = {}) => {
    const x = Object.assign({ ...rc }, over, { t, status, metric });
    runs.push(x);
    return x;
  };
  const near = () => r.int(-tol, tol);                          // reproduces
  const far = () => (r.chance(0.5) ? 1 : -1) * r.int(tol + 1, tol * 4);   // does not
  const span = days * DAY;

  for (const p of projects) {
    const k = r.int(3, 4);
    for (let i = 0; i < k; i++) {
      const rc = recipe(p);
      const base = r.int(6000, 9400);
      let t = r.int(60, span - 6 * DAY);
      run(rc, t, base);
      const reruns = r.int(0, 3);
      for (let j = 0; j < reruns; j++) {
        t += r.int(60, 2 * DAY);
        run(rc, t, base + (r.chance(0.55) ? near() : far()));
      }
    }
  }
  // Every level: a recipe with a failed attempt before its first completed run, a rerun
  // exactly at the tolerance (reproduced), and one well outside it.
  {
    const rc = recipe(projects[0]);
    const base = r.int(6500, 9000);
    const t = r.int(2 * DAY, Math.min(span, 30 * DAY) - 4 * DAY);
    run(rc, t - r.int(30, 300), null, "failed");
    run(rc, t, base);
    run(rc, t + r.int(120, 900), base + (r.chance(0.5) ? tol : -tol));
    run(rc, t + r.int(1000, 2000), base + far());
    run(rc, t + r.int(2100, 2800), null, "failed");
  }
  if (level >= 2) {
    // First run in September, rerun in October: reported in October.
    const rc = recipe(projects[1]);
    const base = r.int(6500, 9000);
    run(rc, 30 * DAY - r.int(60, 600), base);
    run(rc, 30 * DAY + r.int(60, 3 * DAY), base + far());
    // Same recipe but another seed, and another snapshot: new recipes, not reruns.
    const rc2 = recipe(projects[2]);
    const b2 = r.int(6500, 9000);
    const t2 = r.int(DAY, 25 * DAY);
    run(rc2, t2, b2);
    run(rc2, t2 + r.int(60, 600), b2 + far(), "completed", { seed: (rc2.seed + r.int(1, 50)) % 10000 });
    run(rc2, t2 + r.int(700, 1400), b2 + far(), "completed", { snap: snaps.find((s) => s !== rc2.snap) });
    run(rc2, t2 + r.int(1500, 2000), b2 + near());
  }
  if (level === 3) {
    // Two runs of a recipe started in the same minute: the smaller run_id is the first.
    const rc = recipe(projects[2]);
    const base = r.int(6500, 9000);
    const t = r.int(35 * DAY, 55 * DAY);
    run(rc, t, base).tieFirst = true;
    run(rc, t, base + far()).tieSecond = true;
    run(rc, t + r.int(60, 900), base + near());
    // No recorded seed: never a rerun of anything, even with identical other fields.
    const rn = recipe(projects[0]);
    rn.seed = null;
    const bn = r.int(6500, 9000);
    const tn = r.int(32 * DAY, 50 * DAY);
    run(rn, tn, bn);
    run(rn, tn + r.int(60, 900), bn + far());
    // A cancelled run that carries a metric from its last evaluation, before the first completed run.
    const rk = recipe(projects[1]);
    const bk = r.int(6500, 9000);
    const tk = r.int(33 * DAY, 50 * DAY);
    run(rk, tk - r.int(60, 600), bk + far(), "cancelled");
    run(rk, tk, bk);
    run(rk, tk + r.int(60, 900), bk + near());
  }

  // run ids follow start time; within the same minute the planted tie is ordered first/second.
  const order = runs.map((x, i) => [x, i, r.next()]);
  order.sort((a, b) => a[0].t - b[0].t || (a[0].tieFirst ? -1 : b[0].tieFirst ? 1 : a[0].tieSecond ? -1 : b[0].tieSecond ? 1 : a[2] - b[2]));
  let id = r.int(1000, 5000);
  for (const [x] of order) { id += r.int(1, 4); x.id = "run-" + String(id).padStart(5, "0"); }

  // ---- Oracle -------------------------------------------------------------------
  const compute = (o = {}) => {
    const groups = new Map();                  // recipe key -> runs, ordered
    for (const x of runs) {
      if (!o.anyFirst) {
        if (x.status !== "completed" && !(o.keepCancelled && x.status === "cancelled")) continue;
        if (x.metric === null) continue;
      }
      if (x.seed === null && !o.nullSeeds) continue;
      const key = [x.project, x.cfg, x.code, o.ignoreSnap ? "" : x.snap, o.ignoreSeed ? "" : String(x.seed)].join("|");
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(x);
    }
    const out = new Map();
    for (const list of groups.values()) {
      list.sort((a, b) => a.t - b.t || (o.tieHigh ? (a.id < b.id ? 1 : -1) : (a.id < b.id ? -1 : 1)));
      const first = list[0];
      for (let i = 1; i < list.length; i++) {
        const x = list[i];
        if (x.status !== "completed" || x.metric === null) continue;      // only completed runs are reruns
        const ref = o.previous ? list[i - 1] : first;
        if (ref.metric === null) continue;
        const d = Math.abs(x.metric - ref.metric);
        const key = monthOf(o.firstMonth ? first.t : x.t) + "|" + x.project;
        if (!out.has(key)) out.set(key, { n: 0, bad: 0, max: 0 });
        const g = out.get(key);
        g.n++;
        if (o.inclusive ? d >= tol : d > tol) g.bad++;
        if (d > g.max) g.max = d;
      }
    }
    return [...out.keys()].sort().map((k) => {
      const [month, project] = k.split("|");
      const g = out.get(k);
      return [month, project, g.n, g.bad, g.max / 10000];
    });
  };
  const rows = compute();

  const diagnostics = [
    { message: `A rerun exactly ${(tol / 10000).toFixed(4)} away from the first run was counted as not reproduced. Only a difference strictly greater than the tolerance is.`, rows: compute({ inclusive: true }) },
    { message: "A failed run was taken as the first run of its recipe. Only completed runs with a final metric count, as the first run or as reruns.", rows: compute({ anyFirst: true }) },
    { message: "Each rerun was compared with the run before it. It is compared with the first completed run of its recipe.", rows: compute({ previous: true }) },
  ];
  if (level >= 2) {
    diagnostics.push({ message: "Runs with different seeds were treated as the same recipe. A rerun has the same config hash, code version, data snapshot and seed.", rows: compute({ ignoreSeed: true }) });
    diagnostics.push({ message: "Runs on different data snapshots were treated as the same recipe. The snapshot is part of the recipe.", rows: compute({ ignoreSnap: true }) });
    diagnostics.push({ message: "A rerun was reported in the month of its recipe's first run. It belongs to the month of its own started_at.", rows: compute({ firstMonth: true }) });
  }
  if (level === 3) {
    diagnostics.push({ message: "Two runs started in the same minute were ordered by the larger run_id. The smaller run_id is the first.", rows: compute({ tieHigh: true }) });
    diagnostics.push({ message: "Runs with no recorded seed were grouped together (GROUP BY treats NULLs as equal). A run without a seed cannot be a rerun of anything.", rows: compute({ nullSeeds: true }) });
    diagnostics.push({ message: "A cancelled run with a metric was counted. Only completed runs count.", rows: compute({ keepCancelled: true }) });
  }

  // ---- Tables ---------------------------------------------------------------------
  const cols = ["run_id", "project", "config_hash", "code_version", "data_snapshot", "seed", "started_at", "status", "final_metric"];
  const tableRows = runs
    .slice()
    .sort((a, b) => (a.id < b.id ? -1 : 1))
    .map((x) => [x.id, x.project, x.cfg, x.code, x.snap, x.seed, stamp(x.t), x.status, metricText(x.metric)]);
  const setup =
    "SET TIME ZONE 'UTC';\n" +
    "CREATE TABLE runs (\n  run_id TEXT PRIMARY KEY,\n  project TEXT NOT NULL,\n  config_hash TEXT NOT NULL,\n  code_version TEXT NOT NULL,\n  data_snapshot TEXT NOT NULL,\n  seed INT,\n  started_at TIMESTAMPTZ NOT NULL,\n  status TEXT NOT NULL CHECK (status IN ('completed','failed','cancelled')),\n  final_metric NUMERIC(8,4)\n);\n" +
    insertSQL("runs", cols, tableRows);

  return {
    vars: {
      tolerance: (tol / 10000).toFixed(4),
      runs: runs.length,
      month_rule: level === 1 ? "All runs in this sample started in September 2026." : "The sample covers September and October 2026.",
      edge_rule: level === 3
        ? "Two runs of a recipe can start in the same minute; the smaller run_id is then the first. Some runs have no recorded seed (seed is NULL): such a run is never a rerun and never the first run of anything. A cancelled run may carry a final_metric from its last evaluation; it still does not count."
        : "No two runs of a recipe start in the same minute, and every run has a seed.",
    },
    setup,
    tables: [{ name: "runs", columns: cols, rows: tableRows }],
    expected: { columns: ["month", "project", "reruns", "not_reproduced", "max_abs_diff"], rows },
    diagnostics: diagnostics.filter((d) => JSON.stringify(d.rows) !== JSON.stringify(rows)),
  };
}
