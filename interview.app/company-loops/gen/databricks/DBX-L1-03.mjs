/* DBX-L1-03 — Idle minutes on interactive clusters before auto-termination (SQL).
   Simulated practice scenario. All data is generated from the seed. The auto-termination
   rule (terminate after T idle minutes; a run arriving later starts the cluster again) is
   this exercise's simplified model, stated in the problem.

   Contract: see docs/COMPANY-INTERVIEW-LOOPS.md § Executable templates (sql).
   level: 1 Medium (sequential runs; gaps shorter and longer than the auto-termination time;
                    job clusters to exclude; trailing idle capped by as_of)
          2 Hard (+ concurrent and contained runs that must be merged, back-to-back runs,
                  a gap of exactly T minutes, an interactive cluster with no runs, an owner
                  with only job clusters)
          3 Very Hard (+ auto-termination disabled (0) on some clusters, runs still running
                  at as_of with no end_ts) */
import { insertSQL } from "../../js/rng.js";

export const kind = "sql";

const OWNERS = ["team_analytics", "team_finance_bi", "team_growth_ds", "team_ml_research", "team_platform", "team_risk"];
const DAYS = [[2026, 9, 23], [2026, 9, 30], [2026, 10, 7], [2026, 10, 14]];
const AUTOTERM = [10, 15, 20, 30, 45, 60];

export function generate(r, level) {
  const [Y, M, D] = r.pick(DAYS);
  const base = Date.UTC(Y, M - 1, D);
  const tsStr = (sec) => new Date(base + sec * 1000).toISOString().replace("T", " ").replace(".000Z", "+00");
  const owners = r.sample(OWNERS, level === 1 ? 3 : 4).sort();
  const hex = () => r.int(0x1000, 0xffff).toString(16);

  const clusters = [];   // {id, owner, type, T}
  const runs = [];       // {cluster, start, end|null}
  const jobOnlyOwner = level >= 2 ? owners[owners.length - 1] : null;
  for (const o of owners) {
    const nI = o === jobOnlyOwner ? 0 : r.int(1, 2);
    for (let k = 0; k < nI; k++) clusters.push({ id: `ic-${hex()}-${o.slice(5, 9)}`, owner: o, type: "interactive", T: r.pick(AUTOTERM) });
    if (r.chance(0.5) || o === jobOnlyOwner || o === owners[0]) clusters.push({ id: `jc-${hex()}-${o.slice(5, 9)}`, owner: o, type: "job", T: 0 });
  }
  const inter = clusters.filter((c) => c.type === "interactive");
  if (level === 3) inter[r.int(1, inter.length - 1)].T = 0;              // never the first: it carries the forced gaps              // auto-termination disabled
  let idle0 = null;
  if (level >= 2) {                                                       // an interactive cluster that never ran
    const o = r.pick(owners.filter((x) => x !== jobOnlyOwner));
    idle0 = { id: `ic-${hex()}-${o.slice(5, 9)}`, owner: o, type: "interactive", T: r.pick(AUTOTERM) };
    clusters.push(idle0);
  }

  // Runs on interactive clusters, gap by gap.
  const gapKinds = level === 1 ? ["short", "short", "long"] : ["short", "long", "touch", "overlap", "contained", "short"];
  // The first interactive cluster always gets these gaps, in this order.
  const forcedFirst = level >= 2 ? ["exact", "contained", "short", "overlap", "touch"] : ["short", "long"];
  for (const c of inter) {
    const forced = c === inter[0] ? forcedFirst : [];
    const T = c.T * 60;
    let start = 8 * 3600 + r.int(0, 3 * 3600);
    let maxEnd = start + r.int(300, 3600);
    runs.push({ cluster: c, start, end: maxEnd });
    const n = Math.max(forced.length, r.int(2, level === 1 ? 4 : 5));
    for (let k = 0; k < n; k++) {
      let g = k < forced.length ? forced[k] : r.pick(gapKinds);
      if (T === 0 && (g === "exact")) g = "long";
      const dur = r.int(300, 3600);
      let s, e;
      if (g === "short") s = maxEnd + r.int(1, Math.max(1, (T || 1800) - 1));
      else if (g === "long") s = maxEnd + (T || 1800) + r.int(1, 7200);
      else if (g === "exact") s = maxEnd + T;
      else if (g === "touch") s = maxEnd;
      else if (g === "overlap") s = Math.max(start, maxEnd - r.int(60, 600));
      else s = Math.max(start, maxEnd - r.int(240, 600));                   // contained: ends before maxEnd
      e = g === "contained" ? Math.min(maxEnd - 1, s + r.int(30, 200)) : s + dur;
      if (e <= s) e = s + 30;
      runs.push({ cluster: c, start: s, end: e });
      start = s;
      maxEnd = Math.max(maxEnd, e);
    }
  }
  // Job clusters: a run or two each (excluded from the report).
  for (const c of clusters.filter((x) => x.type === "job")) {
    let s = 7 * 3600 + r.int(0, 6 * 3600);
    for (let k = r.int(1, 2); k > 0; k--) { const e = s + r.int(600, 3000); runs.push({ cluster: c, start: s, end: e }); s = e + r.int(600, 4000); }
  }
  // Still running at as_of (Very Hard): the last run of one cluster has no end.
  let maxAll = Math.max(...runs.map((x) => x.end));
  if (level === 3) {
    const c = inter.find((x) => x.T > 0) || inter[0];
    const lastEnd = Math.max(...runs.filter((x) => x.cluster === c).map((x) => x.end));
    const s = lastEnd + r.int(60, Math.max(61, c.T * 60 - 60));
    runs.push({ cluster: c, start: s, end: null, running: true });
    maxAll = Math.max(maxAll, s + 60);
  }
  const asOf = maxAll + r.int(60, 900);

  runs.sort((a, b) => a.start - b.start || (a.cluster.id < b.cluster.id ? -1 : 1));
  let rid = 41000 + r.int(0, 5000);
  for (const x of runs) x.id = (rid += r.int(1, 7));

  const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
  const solve = (o = {}) => {
    const per = new Map();
    for (const c of clusters) {
      if (c.type !== "interactive" && !o.jobClusters) continue;
      const mine = runs.filter((x) => x.cluster === c && !(o.runningIgnored && x.running))
        .map((x) => ({ s: x.start, e: x.end === null ? asOf : x.end, id: x.id }))
        .sort((a, b) => a.s - b.s || a.id - b.id);
      if (!mine.length) continue;
      const T = c.T * 60;
      const disabled = c.T === 0 && !o.disabledAsZero;
      let busy = 0, idle = 0, starts = 1;
      if (o.sumBusy) busy = mine.reduce((a, x) => a + (x.e - x.s), 0);
      // Islands of busy time.
      const isl = [];
      for (const x of mine) {
        const last = isl[isl.length - 1];
        if (last && x.s <= last.e) last.e = Math.max(last.e, x.e);
        else isl.push({ s: x.s, e: x.e });
      }
      if (!o.sumBusy) busy = isl.reduce((a, x) => a + (x.e - x.s), 0);
      const gaps = [];
      if (o.lagEnd) for (let i = 1; i < mine.length; i++) gaps.push(Math.max(0, mine[i].s - mine[i - 1].e));
      else for (let i = 1; i < isl.length; i++) gaps.push(isl[i].s - isl[i - 1].e);
      for (const g of gaps) {
        if (disabled || o.noCap) idle += g;
        else idle += Math.min(g, T);
        if (!disabled && (o.strictRestart ? g > T : g >= T)) starts++;
      }
      const tail = asOf - isl[isl.length - 1].e;
      idle += disabled || o.noCap ? tail : Math.min(T, tail);
      const k = c.owner;
      if (!per.has(k)) per.set(k, { clusters: 0, runs: 0, busy: 0, idle: 0, starts: 0 });
      const p = per.get(k);
      p.clusters++; p.runs += mine.length; p.busy += busy; p.idle += idle; p.starts += starts;
    }
    const m2 = (sec) => Math.round((sec * 100) / 60) / 100;                    // never a .5 case: sec*5/3
    const share = (n, d) => Math.floor((n * 20000 + d) / (2 * d)) / 10000;      // ROUND(n/d, 4), half up
    return [...per.entries()]
      .map(([ow, p]) => [ow, p.clusters, p.runs, m2(p.busy), m2(p.idle), p.starts, share(p.idle, p.idle + p.busy)])
      .sort((a, b) => b[4] - a[4] || cmp(a[0], b[0]));
  };
  const rows = solve();
  const diagnostics = [
    { message: "Idle time was not capped by auto-termination. A cluster idle for longer than its auto-termination time stopped after T minutes; only those T minutes were idle.", rows: solve({ noCap: true }) },
    { message: "Job clusters were included. They terminate when their run ends; only interactive clusters sit idle.", rows: solve({ jobClusters: true }) },
  ];
  if (level >= 2) {
    diagnostics.push({ message: "Busy time was the sum of run durations. Concurrent runs share the cluster: merge overlapping runs into busy intervals first.", rows: solve({ sumBusy: true }) });
    diagnostics.push({ message: "Each gap was measured from the previous run's end. A run contained in an earlier, longer run ends early: measure from the latest end so far (merged intervals).", rows: solve({ lagEnd: true }) });
    diagnostics.push({ message: "A gap of exactly T minutes was not counted as a restart. After T idle minutes the cluster has terminated; a run starting then starts it again.", rows: solve({ strictRestart: true }) });
  }
  if (level === 3) {
    diagnostics.push({ message: "auto-termination 0 was read as 'terminate immediately'. 0 means disabled: the cluster stays up, every gap and the tail to as_of are idle, and it never restarts.", rows: solve({ disabledAsZero: true }) });
    diagnostics.push({ message: "Runs with no end_ts were dropped. A run still running at as_of keeps the cluster busy until as_of.", rows: solve({ runningIgnored: true }) });
  }

  const cCols = ["cluster_id", "owner", "cluster_type", "autotermination_minutes"];
  const cRows = clusters.slice().sort((a, b) => cmp(a.id, b.id)).map((c) => [c.id, c.owner, c.type, c.T]);
  const rCols = ["run_id", "cluster_id", "start_ts", "end_ts"];
  const rRows = runs.map((x) => [x.id, x.cluster.id, tsStr(x.start), x.end === null ? null : tsStr(x.end)]);
  const setup =
    "SET TIME ZONE 'UTC';\n" +
    "CREATE TABLE clusters (\n  cluster_id TEXT PRIMARY KEY,\n  owner TEXT NOT NULL,\n  cluster_type TEXT NOT NULL,             -- interactive | job\n  autotermination_minutes INT NOT NULL    -- interactive only; job clusters show 0\n);\n" +
    "CREATE TABLE cluster_runs (\n  run_id BIGINT PRIMARY KEY,\n  cluster_id TEXT NOT NULL REFERENCES clusters(cluster_id),\n  start_ts TIMESTAMPTZ NOT NULL,\n  end_ts TIMESTAMPTZ                      -- NULL while running\n);\n" +
    insertSQL("clusters", cCols, cRows) + insertSQL("cluster_runs", rCols, rRows);

  return {
    vars: {
      as_of: tsStr(asOf),
      runs: runs.length,
      extra_rule: level === 3
        ? `\`autotermination_minutes = 0\` on an interactive cluster means auto-termination is disabled: the cluster never stops, so every gap and the whole tail up to \`${tsStr(asOf)}\` are idle, and it is started only once. A run with no \`end_ts\` is still running at \`${tsStr(asOf)}\` and keeps the cluster busy until then.`
        : "Every interactive cluster in this sample has auto-termination enabled, and every run has ended.",
    },
    setup,
    tables: [
      { name: "clusters", columns: cCols, rows: cRows },
      { name: "cluster_runs", columns: rCols, rows: rRows },
    ],
    expected: { columns: ["owner", "clusters", "runs", "busy_minutes", "idle_minutes", "starts", "idle_share"], rows },
    diagnostics: diagnostics.filter((d) => JSON.stringify(d.rows) !== JSON.stringify(rows)),
  };
}
