/* NVD-L3-05 — Jobs placed on a failing node: jobs that started on a node between its first
   fatal error event and its drain, per cluster (SQL against a given model).
   Simulated practice scenario. All data, node ids, error codes and times are generated from
   the seed and are hypothetical; the codes and their severities are this exercise's own.

   Per node, events ordered by time drive a small state machine:
     in service --fatal xid--> exposed (an exposure window opens at that event)
     exposed    --drain-----> drained  (the window closes at that event)
     in service --drain-----> drained  (a maintenance drain: no window)
     drained    --resume----> in service
   A fatal xid while exposed or drained changes nothing; a window with no later drain stays open.
   A placement is an allocation whose started_at is in [opened, closed). Per cluster (the node's
   assignment when the allocation started): distinct nodes with a placement, distinct jobs
   placed, distinct placed jobs whose final_state is 'failed'. Clusters with none are absent.
   level: 1 Medium (warning vs fatal codes via a lookup, repeated fatals, maintenance drains,
                    boundaries at exactly the fatal and the drain, a job already running at the
                    fatal, a two-node job placed on two exposed nodes)
          2 Hard (+ resume events: several windows per node, a fatal while drained that opens
                  nothing, a maintenance drain then a later failure, a window never drained)
          3 Very Hard (+ requeued jobs with several attempts on the same exposed node, a node
                       moved to another cluster during repair that fails again there) */
import { insertSQL, ts } from "../../js/rng.js";

export const kind = "sql";

const M = 60, H = 3600, DAY = 86400;
const END = 3 * DAY;                                             // the sample covers three days
const BASE = Date.UTC(2026, 8, 21) / 1000;                       // 2026-09-21 00:00 UTC
const CLUSTERS = ["aurora", "basalt", "cobalt", "delta", "ember", "fjord", "garnet", "harbor"];
const TEAMS = ["vision", "speech", "recsys", "pretrain", "robotics", "genomics", "weather", "chemistry"];

function stamp(sec) {
  const day = new Date((BASE + sec) * 1000).toISOString().slice(0, 10);
  return ts(day, ((sec % DAY) + DAY) % DAY);
}

export function generate(r, level) {
  const nCl = level === 1 ? 2 : level === 2 ? r.int(2, 3) : 3;
  const clusters = r.sample(CLUSTERS, nCl).sort();

  // Error codes: a lookup decides which are fatal (hypothetical codes, this exercise's own).
  const codes = r.sample(Array.from({ length: 200 }, (_, i) => 200 + i), 7).sort((a, b) => a - b);
  const fatalCodes = r.sample(codes, r.int(3, 4));
  const fatalSet = new Set(fatalCodes);
  const warnCodes = codes.filter((c) => !fatalSet.has(c));

  // Patterns per cluster. Each cluster has at least one node that fails.
  const plans = level === 1
    ? [["pairA", "pairB", "maint"], ["failing", "quiet", r.pick(["maint", "quiet"])]]
    : level === 2
      ? [["pairA", "pairB", "repaired", "quiet"], ["open", "maint_fail", "maint", "quiet"], ["failing", "quiet", "maint", "quiet"]]
          .map((p) => p.slice(0, r.int(3, 4)))
      : [["pairA", "pairB", "repaired", "quiet"], ["open", "maint_fail", "maint", "quiet"], ["failing", "moved", "quiet", "maint"]];

  const ids = new Set();
  const nodeId = () => { let s; do s = "gn-" + r.int(1000, 9999); while (ids.has(s)); ids.add(s); return s; };
  const FROM0 = -20 * DAY;
  const nodes = [];
  const byPattern = {};
  for (let ci = 0; ci < nCl; ci++) {
    for (const pat of plans[ci]) {
      const n = { id: nodeId(), cluster: clusters[ci], pat, ev: [], used: new Set(), assign: [{ cluster: clusters[ci], from: FROM0, until: null }] };
      nodes.push(n);
      (byPattern[pat] = byPattern[pat] || []).push(n);
    }
  }
  const addEv = (n, t, type, code = null) => {
    while (n.used.has(t)) t++;
    n.used.add(t);
    n.ev.push({ t, type, code });
    return t;
  };
  const fatal = (n, t) => addEv(n, t, "xid", r.pick(fatalCodes));
  const warn = (n, t) => addEv(n, t, "xid", r.pick(warnCodes));

  // Event histories.
  const info = {};
  for (const n of nodes) {
    if (n.pat === "pairA" || n.pat === "pairB") continue;
    if (n.pat === "maint") {
      const t = r.int(6 * H, 50 * H);
      addEv(n, t, "drain");
      if (level >= 2) addEv(n, t + r.int(H, 6 * H), "resume");
    } else if (n.pat === "failing") {
      const F = fatal(n, r.int(5 * H, 40 * H));
      const D = F + r.int(40 * M, 6 * H);
      if (r.chance(0.6)) fatal(n, r.int(F + M, D - M));
      addEv(n, D, "drain");
      info.failing = { n, F, D };
    } else if (n.pat === "repaired") {
      const F1 = fatal(n, r.int(4 * H, 18 * H));
      const D1 = addEv(n, F1 + r.int(30 * M, 4 * H), "drain");
      const X = fatal(n, D1 + r.int(20 * M, 2 * H));            // fatal while drained: opens nothing
      const R1 = addEv(n, X + r.int(H, 6 * H), "resume");
      const F2 = fatal(n, R1 + r.int(2 * H, 8 * H));
      if (r.chance(0.5)) fatal(n, F2 + r.int(5 * M, 50 * M));
      addEv(n, F2 + r.int(H, 5 * H), "drain");
      info.repaired = { n, R1, F2 };
    } else if (n.pat === "open") {
      const F = fatal(n, r.int(20 * H, 50 * H));
      if (r.chance(0.6)) fatal(n, F + r.int(H, 10 * H));
      info.open = { n, F };
    } else if (n.pat === "maint_fail") {
      const Md = addEv(n, r.int(3 * H, 15 * H), "drain");
      const R = addEv(n, Md + r.int(H, 5 * H), "resume");
      const F = fatal(n, R + r.int(3 * H, 15 * H));
      addEv(n, F + r.int(H, 5 * H), "drain");
      info.maint_fail = { n, R, F };
    } else if (n.pat === "moved") {
      const from = r.pick(clusters.filter((c) => c !== n.cluster));
      const F1 = fatal(n, r.int(4 * H, 16 * H));
      const D1 = addEv(n, F1 + r.int(30 * M, 3 * H), "drain");
      const MV = D1 + r.int(H, 4 * H);                          // moved while drained
      const R1 = addEv(n, MV + r.int(30 * M, 3 * H), "resume");
      const F2 = fatal(n, R1 + r.int(2 * H, 10 * H));
      if (r.chance(0.6)) addEv(n, F2 + r.int(H, 5 * H), "drain");
      n.assign = [{ cluster: from, from: FROM0, until: MV }, { cluster: n.cluster, from: MV, until: null }];
    }
  }
  {
    const a = byPattern.pairA[0], b = byPattern.pairB[0];
    const Fa = r.int(5 * H, 30 * H), Da = Fa + r.int(3 * H, 6 * H);
    const Fb = Fa + r.int(10 * M, 2 * H), Db = Fb + r.int(2 * H, 5 * H);
    const W = warn(a, Fa - r.int(30 * M, 3 * H));                // a warning before the fatal: opens nothing
    fatal(a, Fa);
    fatal(a, r.int(Fa + M, Da - M));
    addEv(a, Da, "drain");
    fatal(b, Fb);
    addEv(b, Db, "drain");
    info.pair = { a, b, Fa, Da, Fb, Db, W };
  }
  // Background warnings on every node: never open a window.
  for (const n of nodes) {
    const k = r.int(0, 2);
    for (let i = 0; i < k; i++) warn(n, r.int(H, END - H));
  }
  for (const n of nodes) n.ev.sort((x, y) => x.t - y.t);

  // State machine (also the oracle's window finder). opts break one rule each, for diagnostics.
  const windowsOf = (n, opts = {}) => {
    const isFatal = (e) => e.type === "xid" && (opts.anyXid || fatalSet.has(e.code));
    if (opts.firstEver) {
      const f = n.ev.find(isFatal);
      if (!f) return [];
      const d = n.ev.find((e) => e.type === "drain" && e.t > f.t);
      return [[f.t, d ? d.t : Infinity]];
    }
    let state = "in", start = 0;
    const out = [];
    for (const e of n.ev) {
      if (isFatal(e)) {
        if (state === "in" || (opts.ignoreDrained && state === "drained")) { state = "exp"; start = e.t; }
      } else if (e.type === "drain") {
        if (state === "exp") out.push([start, e.t]);
        state = "drained";
      } else if (e.type === "resume") {
        if (state === "drained") state = "in";
      }
    }
    if (state === "exp") out.push([start, Infinity]);
    return opts.requireDrain ? out.filter((w) => w[1] !== Infinity) : out;
  };
  const drainedAt = (n, t) => {
    let st = "in";
    for (const e of n.ev) {
      if (e.t > t) break;
      if (e.type === "drain") st = "drained";
      else if (e.type === "resume" && st === "drained") st = "in";
    }
    return st === "drained";
  };
  const clusterAt = (n, t) => n.assign.find((a) => t >= a.from && (a.until === null || t < a.until)).cluster;
  const truth = new Map(nodes.map((n) => [n, windowsOf(n)]));
  const inTruth = (n, t) => truth.get(n).some((w) => t >= w[0] && t < w[1]);

  // Jobs. Each allocation: node, start, end, gpus, attempt.
  const jobs = [];
  const addJob = (allocs, final = null) => {
    const exposed = allocs.some((a) => inTruth(a.node, a.start));
    const roll = r.next();
    const f = final || (exposed ? (roll < 0.5 ? "failed" : "completed") : roll < 0.1 ? "failed" : roll < 0.18 ? "cancelled" : "completed");
    jobs.push({ team: r.pick(TEAMS), final: f, allocs });
  };
  const alloc = (node, start, end = null, attempt = 1, gpus = null) =>
    ({ node, start, end: end === null ? start + r.int(20 * M, 10 * H) : end, attempt, gpus: gpus || r.pick([2, 4, 8]) });

  // Background traffic: never placed on a drained node.
  const nBg = level === 1 ? 12 : level === 2 ? 18 : 24;
  for (let i = 0, tries = 0; i < nBg && tries < 500; tries++) {
    const n = r.pick(nodes);
    const s = r.int(0, END - 2 * H);
    if (drainedAt(n, s)) continue;
    const allocs = [alloc(n, s)];
    if (r.chance(0.25)) {
      const c = clusterAt(n, s);
      const mates = nodes.filter((m) => m !== n && clusterAt(m, s) === c && !drainedAt(m, s));
      if (mates.length) allocs.push(alloc(r.pick(mates), s, allocs[0].end, 1, allocs[0].gpus));
    }
    addJob(allocs);
    i++;
  }

  // Forced edge cases.
  const P = info.pair;
  addJob([alloc(P.a, P.Fa)], "failed");                                          // starts exactly at the fatal: counts
  addJob([alloc(P.b, P.Db)], "completed");                                       // starts exactly at the drain: does not
  addJob([alloc(P.b, P.Fb - r.int(10 * M, 2 * H), P.Fb + r.int(10 * M, 3 * H))], "failed"); // running at the fatal: not placed
  addJob([alloc(P.a, r.int(P.W + 1, P.Fa - 1))], "completed");                  // after a warning, before the fatal
  {
    const s = r.int(P.Fb + 1, Math.min(P.Da, P.Db) - 1), g = r.pick([4, 8]);
    const e = s + r.int(20 * M, 4 * H);
    addJob([alloc(P.a, s, e, 1, g), alloc(P.b, s, e, 1, g)]);                   // two exposed nodes, one job
  }
  for (const n of nodes) {                                                       // one placement in every window
    for (const [o, c] of truth.get(n)) {
      const hi = c === Infinity ? Math.min(o + 10 * H, END - 1) : c - 1;
      addJob([alloc(n, r.int(o + 1, hi))]);
    }
  }
  if (level >= 2) {
    const R = info.repaired;
    addJob([alloc(R.n, r.int(R.R1 + 1, R.F2 - 1))], "completed");               // back in service, before the next fatal
    const MF = info.maint_fail;
    addJob([alloc(MF.n, r.int(MF.R + 1, MF.F - 1))]);                            // after a maintenance drain and resume
  }
  if (level === 3) {
    const n = r.pick([P.a, info.failing.n]);
    const [o, c] = truth.get(n)[0];
    const s1 = r.int(o + 1, o + Math.floor((c - o) / 3));
    const e1 = s1 + r.int(5 * M, 20 * M);
    const s2 = r.int(e1 + M, Math.min(e1 + 10 * M, c - 1));
    const g = r.pick([2, 4]);
    addJob([alloc(n, s1, e1, 1, g), alloc(n, s2, null, 2, g)], "failed");        // requeued onto the same node
  }

  // Ids: jobs in order of first start; events in time order.
  const jOrder = jobs.map((j, i) => i).sort((a, b) => jobs[a].allocs[0].start - jobs[b].allocs[0].start || a - b);
  let jn = 40000 + r.int(0, 50000);
  for (const i of jOrder) {
    jobs[i].id = "job_" + (jn += r.int(1, 29));
    jobs[i].submitted = jobs[i].allocs[0].start - r.int(M, 3 * H);
  }
  const allEv = nodes.flatMap((n) => n.ev.map((e) => ({ ...e, node: n }))).sort((a, b) => a.t - b.t || (a.node.id < b.node.id ? -1 : 1));
  let en = 7000 + r.int(0, 2000);
  for (const e of allEv) e.id = "ev_" + en++;

  // The oracle.
  const compute = (opts = {}) => {
    const wins = new Map(nodes.map((n) => [n, windowsOf(n, opts)]));
    const placed = (a) => wins.get(a.node).some(([o, c]) => opts.overlap
      ? a.start < c && a.end > o
      : (opts.startExcl ? a.start > o : a.start >= o) && (opts.endIncl ? a.start <= c : a.start < c));
    const per = new Map();
    for (const j of jobs) {
      for (const a of j.allocs) {
        if (!placed(a)) continue;
        const cl = opts.currentCluster ? a.node.cluster : clusterAt(a.node, a.start);
        if (!per.has(cl)) per.set(cl, { nodes: new Set(), jobs: new Set(), failed: new Set(), rows: 0, frows: 0 });
        const p = per.get(cl);
        p.nodes.add(a.node.id);
        p.jobs.add(j.id);
        p.rows++;
        if (j.final === "failed") { p.failed.add(j.id); p.frows++; }
      }
    }
    return [...per.keys()].sort().map((cl) => {
      const p = per.get(cl);
      return opts.countRows ? [cl, p.nodes.size, p.rows, p.frows] : [cl, p.nodes.size, p.jobs.size, p.failed.size];
    });
  };
  const expected = compute();

  const diagnostics = [
    { message: "Warning-severity xid events opened windows. Only an xid whose code has severity 'fatal' in xid_codes opens an exposure window; join the events to the lookup.", rows: compute({ anyXid: true }) },
    { message: "A job that started exactly at the first fatal error was left out. The window opens at that instant: started_at >= the fatal event's time.", rows: compute({ startExcl: true }) },
    { message: "A job that started exactly at the drain was counted. The window closes at the drain: started_at < the drain's time.", rows: compute({ endIncl: true }) },
    { message: "Allocations were counted instead of jobs. A multi-node job (or a requeued one) has several allocation rows; jobs_placed and jobs_failed count distinct job_id.", rows: compute({ countRows: true }) },
    { message: "Jobs already running when the fatal error arrived were counted. The question is which jobs the scheduler placed on the failing node: an allocation counts only if it started inside the window.", rows: compute({ overlap: true }) },
  ];
  if (level >= 2) {
    diagnostics.push(
      { message: "Only each node's first fatal error ever was used. After a drain and a resume the node is back in service, and its next fatal error opens a new window.", rows: compute({ firstEver: true }) },
      { message: "A fatal error while the node was drained opened a window. A drained node is out of service until it resumes; only a fatal error while it is in service opens a window.", rows: compute({ ignoreDrained: true }) },
      { message: "Windows with no drain yet were dropped (an inner join to the next drain). A node that failed and was never drained is still exposed: its window stays open.", rows: compute({ requireDrain: true }) },
    );
  }
  if (level === 3) {
    diagnostics.push({ message: "Placements were counted in the node's current cluster. A node moved during repair counts in the cluster it was assigned to when the allocation started (node_assignments).", rows: compute({ currentCluster: true }) });
  }

  // Tables.
  const xRows = codes.map((c) => [c, fatalSet.has(c) ? "fatal" : "warning"]);
  const nRows = nodes.slice().sort((a, b) => (a.id < b.id ? -1 : 1)).map((n) => [n.id, n.cluster, 8]);
  const aRows = nodes.slice().sort((a, b) => (a.id < b.id ? -1 : 1))
    .flatMap((n) => n.assign.map((a) => [n.id, a.cluster, stamp(a.from), a.until === null ? null : stamp(a.until)]));
  const eRows = allEv.map((e) => [e.id, e.node.id, e.type, e.code, stamp(e.t)]);
  const jRows = jOrder.map((i) => jobs[i]).map((j) => [j.id, j.team, stamp(j.submitted), j.final]);
  const alRows = jOrder.map((i) => jobs[i])
    .flatMap((j) => j.allocs.map((a) => ({ j, a })))
    .sort((x, y) => x.a.start - y.a.start || (x.j.id < y.j.id ? -1 : x.j.id > y.j.id ? 1 : 0) || (x.a.node.id < y.a.node.id ? -1 : 1))
    .map(({ j, a }) => [j.id, a.attempt, a.node.id, a.gpus, stamp(a.start), stamp(a.end)]);

  const xCols = ["xid_code", "severity"];
  const nCols = ["node_id", "cluster", "gpus"];
  const aCols = ["node_id", "cluster", "assigned_from", "assigned_until"];
  const eCols = ["event_id", "node_id", "event_type", "xid_code", "occurred_at"];
  const jCols = ["job_id", "team", "submitted_at", "final_state"];
  const alCols = ["job_id", "attempt", "node_id", "gpus", "started_at", "ended_at"];
  const types = level === 1 ? "'xid','drain'" : "'xid','drain','resume'";
  const setup =
    "SET TIME ZONE 'UTC';\n" +
    "CREATE TABLE xid_codes (\n  xid_code INT PRIMARY KEY,\n  severity TEXT NOT NULL CHECK (severity IN ('fatal','warning'))\n);\n" +
    "CREATE TABLE nodes (\n  node_id TEXT PRIMARY KEY,\n  cluster TEXT NOT NULL,\n  gpus INT NOT NULL\n);\n" +
    "CREATE TABLE node_assignments (\n  node_id TEXT NOT NULL REFERENCES nodes (node_id),\n  cluster TEXT NOT NULL,\n  assigned_from TIMESTAMPTZ NOT NULL,\n  assigned_until TIMESTAMPTZ,\n  PRIMARY KEY (node_id, assigned_from)\n);\n" +
    "CREATE TABLE node_events (\n  event_id TEXT PRIMARY KEY,\n  node_id TEXT NOT NULL REFERENCES nodes (node_id),\n  event_type TEXT NOT NULL CHECK (event_type IN (" + types + ")),\n  xid_code INT REFERENCES xid_codes (xid_code),\n  occurred_at TIMESTAMPTZ NOT NULL\n);\n" +
    "CREATE TABLE jobs (\n  job_id TEXT PRIMARY KEY,\n  team TEXT NOT NULL,\n  submitted_at TIMESTAMPTZ NOT NULL,\n  final_state TEXT NOT NULL CHECK (final_state IN ('completed','failed','cancelled'))\n);\n" +
    "CREATE TABLE job_allocations (\n  job_id TEXT NOT NULL REFERENCES jobs (job_id),\n  attempt INT NOT NULL,\n  node_id TEXT NOT NULL REFERENCES nodes (node_id),\n  gpus INT NOT NULL,\n  started_at TIMESTAMPTZ NOT NULL,\n  ended_at TIMESTAMPTZ NOT NULL,\n  PRIMARY KEY (job_id, attempt, node_id)\n);\n" +
    insertSQL("xid_codes", xCols, xRows) + insertSQL("nodes", nCols, nRows) + insertSQL("node_assignments", aCols, aRows) +
    insertSQL("node_events", eCols, eRows) + insertSQL("jobs", jCols, jRows) + insertSQL("job_allocations", alCols, alRows);

  return {
    vars: {
      cluster_list: clusters.map((c) => "`" + c + "`").join(", "),
      events: eRows.length,
      allocations: alRows.length,
      lifecycle_rule: level === 1
        ? "`node_events.event_type` is `xid` (a driver error carrying an `xid_code`) or `drain` (the node stops accepting new jobs). In this sample a drained node never returns to service."
        : "`node_events.event_type` is `xid` (a driver error carrying an `xid_code`), `drain` (the node stops accepting new jobs) or `resume` (the node returns to service after a repair or maintenance).",
      episode_rule: level === 1
        ? "A fatal error on a node that is already drained opens nothing."
        : "A drained node, whatever the reason for the drain, is out of service until its next `resume`: a fatal error while it is out of service opens nothing, and once it is back in service its next fatal error opens a new window. A node can therefore have several windows.",
      cluster_rule: level === 3
        ? "Nodes are sometimes moved to another cluster while they are drained for repair, so `nodes.cluster` (the node's current cluster) is not always the cluster to use. A job that is requeued has one allocation per attempt (`attempt` 1, 2, …)."
        : "In this sample every node has one assignment, but the rule still applies.",
    },
    setup,
    tables: [
      { name: "xid_codes", columns: xCols, rows: xRows },
      { name: "nodes", columns: nCols, rows: nRows },
      { name: "node_assignments", columns: aCols, rows: aRows },
      { name: "node_events", columns: eCols, rows: eRows },
      { name: "jobs", columns: jCols, rows: jRows },
      { name: "job_allocations", columns: alCols, rows: alRows },
    ],
    expected: { columns: ["cluster", "nodes_affected", "jobs_placed", "jobs_failed"], rows: expected },
    diagnostics: diagnostics.filter((d) => JSON.stringify(d.rows) !== JSON.stringify(expected)),
  };
}
