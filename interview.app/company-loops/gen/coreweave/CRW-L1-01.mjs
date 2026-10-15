/* CRW-L1-01 — Time to ready per region, GPU type and week (SQL).
   Simulated practice scenario. All data is generated from the seed; regions, GPU
   types, node counts and timings are hypothetical.

   Contract: generate(r, level) -> { vars, setup, tables, expected, diagnostics }.
   The oracle below walks the generated requests and node events in JavaScript; the
   evaluator's reference SQL is written independently and must return the same rows.
   level: 1 Medium (one week, every node reports ready once) · 2 Hard (+ a second
          week, nodes that flap not_ready/ready, cancelled requests with ready nodes)
          · 3 Very Hard (+ replacement nodes, so a cluster can have more ready nodes
          than it asked for; requests late on a Sunday that finish on Monday) */
import { insertSQL, pad2 } from "../../js/rng.js";

export const kind = "sql";

const REGIONS = ["us-east", "us-central", "us-west", "eu-north", "eu-west"];
const GPUS = ["H100", "H200", "B200", "GB200", "L40S"];
const BASE = Date.UTC(2026, 8, 14);          // Monday 2026-09-14 00:00 UTC

function stamp(min) {                        // minutes after BASE -> "YYYY-MM-DD HH:MM:00+00"
  const d = new Date(BASE + min * 60000);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())} ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}:00+00`;
}
function weekOf(min) {                       // Monday of the UTC week, as a date string
  const w = Math.floor(min / (7 * 1440));
  const d = new Date(BASE + w * 7 * 86400000);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}
function median(xs) {
  if (!xs.length) return null;
  const s = xs.slice().sort((a, b) => a - b), n = s.length;
  return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
}

export function generate(r, level) {
  const regions = r.sample(REGIONS, level === 1 ? 2 : 3);
  const gpus = r.sample(GPUS, 2);
  const weeks = level === 1 ? 1 : 2;
  const reqs = [];
  const events = [];
  let rid = 100 + r.int(0, 800);
  let nid = 1;

  // One request: its nodes, when each first reports ready, and the noise around it.
  const make = (opts) => {
    const n = opts.n ?? r.int(2, level === 1 ? 4 : 5);
    const req = {
      request_id: "cr-" + rid++,
      customer_id: "cust-" + r.pick(["a17", "b42", "c08", "d93", "e55", "f21"]),
      region: opts.region ?? r.pick(regions),
      gpu_type: opts.gpu ?? r.pick(gpus),
      n,
      at: opts.at ?? r.int(0, weeks * 7 * 1440 - 600),
      cancelled: null,
    };
    reqs.push(req);
    const readyCount = opts.ready ?? n;          // distinct nodes that ever report ready
    const nodes = [];
    for (let k = 0; k < Math.max(n, readyCount) + (opts.stuck || 0); k++) {
      const name = `node-${String(nid++).padStart(4, "0")}`;
      const prov = req.at + r.int(1, 6);
      events.push([req.request_id, name, "provisioning", prov]);
      if (k < readyCount) {
        const rd = req.at + (opts.slow && k === 0 ? r.int(240, 420) : r.int(12, 180));
        nodes.push({ name, ready: rd });
        events.push([req.request_id, name, "ready", rd]);
      } else {
        events.push([req.request_id, name, "not_ready", prov + r.int(20, 90)]);   // failed health checks, never ready
      }
    }
    req.nodes = nodes;
    return req;
  };

  // Every region × GPU group gets at least one fully ready cluster, so rows are never empty.
  for (const g of gpus) make({ region: regions[0], gpu: g, at: r.int(60, 6 * 1440) });
  const extra = level === 1 ? r.int(4, 6) : r.int(8, 11);
  for (let i = 0; i < extra; i++) {
    const roll = r.next();
    if (roll < 0.22) make({ ready: 0 });                                       // partial: nothing ready yet
    else if (roll < 0.4) { const n = r.int(3, 5); make({ n, ready: n - r.int(1, 2) }); }   // partial
    else make({});
  }
  // A cancelled request whose nodes all became ready first: it must still be excluded.
  const c1 = make({ slow: true });
  c1.cancelled = c1.at + 500;
  if (level >= 2) {
    const c2 = make({ ready: 1, n: 3 });
    c2.cancelled = c2.at + r.int(30, 200);
  }

  // Hard: flapping nodes. A ready node later reports not_ready and then ready again;
  // its first ready time stands. One flap is on the last node of a ready cluster,
  // one on a partial cluster (so counting ready events instead of nodes is wrong).
  if (level >= 2) {
    const full = reqs.filter((q) => !q.cancelled && q.nodes.length === q.n);
    const q = r.pick(full);
    const last = q.nodes.reduce((a, b) => (b.ready > a.ready ? b : a));
    const back = last.ready + r.int(15, 60);
    events.push([q.request_id, last.name, "not_ready", last.ready + r.int(3, 10)]);
    events.push([q.request_id, last.name, "ready", back + 5]);
    const p = make({ n: 3, ready: 2 });
    const node = p.nodes[0];
    events.push([p.request_id, node.name, "not_ready", node.ready + 4]);
    events.push([p.request_id, node.name, "ready", node.ready + r.int(20, 50)]);
  }

  // Very Hard: replacement nodes. One node never becomes ready and a replacement does
  // (exactly n ready nodes); in another cluster the failed node recovers after its
  // replacement was ready, so n + 1 nodes are ready and the cluster was ready at the n-th.
  if (level === 3) {
    make({ n: 3, ready: 3, stuck: 1 });
    const q = make({ n: r.int(3, 4) });
    const lateName = `node-${String(nid++).padStart(4, "0")}`;
    const latest = Math.max(...q.nodes.map((x) => x.ready));
    const recovered = latest + r.int(30, 120);
    events.push([q.request_id, lateName, "provisioning", q.at + 2]);
    events.push([q.request_id, lateName, "not_ready", q.at + 40]);
    events.push([q.request_id, lateName, "ready", recovered]);
    q.nodes.push({ name: lateName, ready: recovered });
    // Late on a Sunday: requested in week 1, ready in week 2.
    make({ region: regions[1], gpu: gpus[0], at: 7 * 1440 - r.int(20, 50) });
  }

  // ---- Oracle -------------------------------------------------------------------
  const firstReady = (q, useLast) => {                // per node: first (or last) ready event
    const m = new Map();
    for (const [id, name, state, at] of events) {
      if (id !== q.request_id || state !== "ready") continue;
      const cur = m.get(name);
      if (cur === undefined || (useLast ? at > cur : at < cur)) m.set(name, at);
    }
    return [...m.values()].sort((a, b) => a - b);
  };
  const compute = (o = {}) => {
    const groups = new Map();
    for (const q of reqs) {
      if (q.cancelled && !o.keepCancelled) continue;
      let times = firstReady(q, o.lastReady);
      if (o.countEvents) times = events.filter((e) => e[0] === q.request_id && e[2] === "ready").map((e) => e[3]).sort((a, b) => a - b);
      let readyAt = null;
      if (times.length >= q.n) readyAt = o.maxNode ? times[times.length - 1] : times[q.n - 1];
      if (o.partialAsReady && readyAt === null && times.length) readyAt = times[times.length - 1];
      const wk = weekOf(o.readyWeek && readyAt !== null ? readyAt : q.at);
      const key = [wk, q.region, q.gpu_type].join("|");
      if (!groups.has(key)) groups.set(key, { mins: [], partial: 0 });
      const g = groups.get(key);
      if (readyAt === null) g.partial++;
      else g.mins.push(readyAt - q.at);
    }
    return [...groups.keys()].sort().map((k) => {
      const [wk, region, gpu] = k.split("|");
      const g = groups.get(k);
      return [wk, region, gpu, g.mins.length, median(g.mins), g.mins.length ? Math.max(...g.mins) : null, g.partial];
    });
  };
  const rows = compute();

  const diagnostics = [
    { message: "A cancelled request was counted. Requests with a cancelled_at are excluded entirely, even if their nodes became ready before the cancellation.", rows: compute({ keepCancelled: true }) },
    { message: "Partially ready clusters were timed by their last ready node. A cluster is ready only when nodes_requested distinct nodes have reported ready; the others are counted in partial_clusters.", rows: compute({ partialAsReady: true }) },
  ];
  if (level >= 2) {
    diagnostics.push({ message: "A flapping node was timed by its latest ready event. A node's ready time is its first ready event.", rows: compute({ lastReady: true }) });
    diagnostics.push({ message: "Ready events were counted instead of distinct nodes, so a node that flapped counted twice and a partial cluster looked ready.", rows: compute({ countEvents: true }) });
  }
  if (level === 3) {
    diagnostics.push({ message: "The cluster was timed by its last ready node. With replacement nodes a cluster can have more ready nodes than it asked for; it was ready when the nodes_requested-th distinct node first reported ready.", rows: compute({ maxNode: true }) });
    diagnostics.push({ message: "A cluster was put in the week it became ready. The week is the UTC week (Monday start) of requested_at.", rows: compute({ readyWeek: true }) });
  }

  // ---- Tables ---------------------------------------------------------------------
  const reqCols = ["request_id", "customer_id", "region", "gpu_type", "nodes_requested", "requested_at", "cancelled_at"];
  const reqRows = reqs
    .slice()
    .sort((a, b) => a.at - b.at || (a.request_id < b.request_id ? -1 : 1))
    .map((q) => [q.request_id, q.customer_id, q.region, q.gpu_type, q.n, stamp(q.at), q.cancelled === null ? null : stamp(q.cancelled)]);
  const evCols = ["request_id", "node_name", "state", "event_ts"];
  const evRows = events
    .slice()
    .sort((a, b) => a[3] - b[3] || (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : a[2] < b[2] ? -1 : 1))
    .map((e) => [e[0], e[1], e[2], stamp(e[3])]);

  const setup =
    "SET TIME ZONE 'UTC';\n" +
    "CREATE TABLE cluster_requests (\n  request_id TEXT PRIMARY KEY,\n  customer_id TEXT NOT NULL,\n  region TEXT NOT NULL,\n  gpu_type TEXT NOT NULL,\n  nodes_requested INT NOT NULL,\n  requested_at TIMESTAMPTZ NOT NULL,\n  cancelled_at TIMESTAMPTZ\n);\n" +
    "CREATE TABLE node_events (\n  request_id TEXT NOT NULL REFERENCES cluster_requests(request_id),\n  node_name TEXT NOT NULL,\n  state TEXT NOT NULL CHECK (state IN ('provisioning','ready','not_ready')),\n  event_ts TIMESTAMPTZ NOT NULL\n);\n" +
    insertSQL("cluster_requests", reqCols, reqRows) + insertSQL("node_events", evCols, evRows);

  return {
    vars: {
      requests: reqs.length,
      events: events.length,
      week_rule: weeks === 1 ? "All requests fall in one week." : "The data covers two weeks.",
      flap_rule: level === 1
        ? "In this data every node reports `ready` at most once."
        : "A node can flap: after `ready` it may report `not_ready` and later `ready` again. Its ready time is still its first `ready` event.",
      replace_rule: level === 3
        ? "A node that fails its health checks is replaced by a new node, and the failed one can recover later, so a cluster can end with more ready nodes than it requested."
        : "No cluster has more nodes reporting `ready` than it requested.",
    },
    setup,
    tables: [
      { name: "cluster_requests", columns: reqCols, rows: reqRows },
      { name: "node_events", columns: evCols, rows: evRows },
    ],
    expected: { columns: ["week_start", "region", "gpu_type", "ready_clusters", "median_minutes", "max_minutes", "partial_clusters"], rows },
    diagnostics: diagnostics.filter((d) => JSON.stringify(d.rows) !== JSON.stringify(rows)),
  };
}
