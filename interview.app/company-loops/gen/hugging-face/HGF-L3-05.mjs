/* HGF-L3-05 — Cold starts: requests that reached an inference endpoint while it was scaled to zero,
   and the wait each added, per endpoint (SQL against a given model).
   Simulated practice scenario. Endpoint names, repos, times and rules are generated from the seed
   and are hypothetical; the scale-to-zero rules are this exercise's own.

   The state of an endpoint at time t is set by its latest event with occurred_at <= t
   (serving before its first event). Cold states: scaled_to_zero, start_failed (Hard+), resumed
   (Very Hard). paused (Very Hard) rejects requests: they count as requests, never as cold.
   A cold request waits until the endpoint's first replica_ready strictly after received_at;
   with none in the export it is waiting_at_end and has no wait.
   One row per endpoint in `endpoints`, ordered by endpoint_id:
     requests, cold_requests, waiting_at_end, total_wait_s, max_wait_s (0 when no waits).
   level: 1 Medium (scale to zero and wake, scale-out replica_ready while serving, a request at
                    exactly the scale-to-zero second (cold) and at exactly the ready second (served),
                    a warm endpoint, an endpoint with no requests)
          2 Hard (+ failed starts that keep the endpoint at zero, a cold period still open at the
                  end of the export)
          3 Very Hard (+ owner pause and resume, request log delivered at least once) */
import { insertSQL, ts } from "../../js/rng.js";

export const kind = "sql";

const MIN = 60, H = 3600, DAY = 86400;
const NAMES = ["ep-captioner", "ep-doc-layout", "ep-embedder", "ep-ner-tagger", "ep-reranker", "ep-sentiment",
  "ep-speech-to-text", "ep-summariser", "ep-table-qa", "ep-text-classifier", "ep-translator", "ep-zero-shot"];
const NAMESPACES = ["kestrel-ai", "northwind-ml", "orchid-lab", "tern-research"];
const INSTANCES = ["cpu-small", "cpu-medium", "gpu-small", "gpu-medium"];
const COLD = new Set(["scaled_to_zero", "start_failed", "resumed"]);

export function generate(r, level) {
  const baseDay = Date.UTC(2026, 8, 14 + r.int(0, 13)) / 1000;
  const day = new Date(baseDay * 1000).toISOString().slice(0, 10);
  const nextDay = new Date((baseDay + DAY) * 1000).toISOString().slice(0, 10);
  const stamp = (sec) => {
    if (sec < 0 || sec >= DAY) throw new Error("time outside the export day: " + sec);
    return ts(day, sec);
  };
  const CUTOFF = DAY;                                   // export covers [00:00, next 00:00)

  const nCold = level === 1 ? 2 : level === 2 ? 3 : r.int(3, 4);
  const names = r.sample(NAMES, nCold + 2);
  const eps = [];
  for (let i = 0; i < nCold; i++) eps.push({ id: names[i], type: "cold", min: 0, idle: r.pick([15, 30, 60]) });
  eps.push({ id: names[nCold], type: "warm", min: 1, idle: null });
  eps.push({ id: names[nCold + 1], type: "idle", min: 0, idle: r.pick([15, 30, 60]) });
  for (const e of eps) {
    e.repo = r.pick(NAMESPACES) + "/" + e.id.slice(3);
    e.instance = e.type === "warm" ? r.pick(["gpu-small", "gpu-medium"]) : r.pick(INSTANCES);
    e.events = [];
    e.reqs = [];
  }
  const coldEps = eps.filter((e) => e.type === "cold");
  for (const e of coldEps) e.cycles = level === 1 ? 2 : r.int(2, 3);

  // Forced edge cases: (endpoint, cycle) slots.
  const slot = () => { const e = r.pick(coldEps); return { e, c: r.int(0, e.cycles - 1) }; };
  const atZero = slot(), atReady = slot(), scaleOut = slot(), fail = slot(), pause = slot();
  const waitingEp = level >= 2 ? r.pick(coldEps) : null;
  const is = (s, e, c) => s.e === e && s.c === c;

  const ev = (e, kind, at) => e.events.push({ kind, at });
  const rq = (e, at) => e.reqs.push({ at });

  for (const e of coldEps) {
    const I = e.idle * MIN;
    const gapMax = Math.min(I - 3 * MIN, 20 * MIN);
    let t = r.int(0, 20 * MIN);
    // A serving stretch: k requests with gaps shorter than the idle period, sometimes a scale-out.
    const serve = (forceScaleOut) => {
      const k = r.int(1, 4);
      const outAt = forceScaleOut ? r.int(0, k - 1) : r.chance(0.3) ? r.int(0, k - 1) : -1;
      let last = t;
      for (let i = 0; i < k; i++) {
        t += r.int(20, gapMax);
        rq(e, t);
        last = t;
        if (i === outAt) { t += r.int(5, 120); ev(e, "replica_ready", t); }
      }
      return last;
    };
    for (let c = 0; c < e.cycles; c++) {
      let last = serve(is(scaleOut, e, c));
      if (level === 3 && is(pause, e, c)) {
        const p = t + r.int(MIN, 5 * MIN);
        ev(e, "paused", p);
        const q = p + r.int(20 * MIN, 2 * H);
        rq(e, p);                                                    // rejected at the pause second
        for (let i = r.int(0, 2); i > 0; i--) rq(e, r.int(p + 1, q - 1));
        ev(e, "resumed", q);
        const w = r.int(40, 6 * MIN);
        rq(e, q + r.int(0, w - 1));                                  // cold after resume
        if (r.chance(0.5)) rq(e, q + r.int(0, w - 1));
        ev(e, "replica_ready", q + w);
        t = q + w;
        last = serve(false);
      }
      const z = last + I;
      ev(e, "scaled_to_zero", z);
      const c0 = is(atZero, e, c) ? z : z + r.int(2 * MIN, 2 * H);
      rq(e, c0);
      let ready;
      if (level >= 2 && (is(fail, e, c) || r.chance(0.25))) {
        const f = c0 + r.int(20, 90);
        ev(e, "start_failed", f);
        ready = f + r.int(30, 5 * MIN);
        rq(e, r.int(f + 1, ready - 1));                              // arrives after the failure: still cold
      } else ready = c0 + r.int(25, 6 * MIN);
      for (let i = r.int(0, 2); i > 0; i--) rq(e, r.int(c0 + 1, ready - 1));
      ev(e, "replica_ready", ready);
      t = ready;
      if (is(atReady, e, c)) rq(e, ready);                         // served: arrives with the replica
    }
    const last = serve(false);
    if (e === waitingEp) {                                           // a cold period still open at the end
      const z = last + I;
      if (z > CUTOFF - 15 * MIN) throw new Error("timeline too long");
      ev(e, "scaled_to_zero", z);
      const n = r.int(1, 3);
      for (let i = 0; i < n; i++) rq(e, r.int(Math.max(z + 60, CUTOFF - 8 * MIN), CUTOFF - 30));
    }
  }
  // Warm endpoint: never at zero; autoscaling adds replicas now and then.
  {
    const e = eps.find((x) => x.type === "warm");
    for (let i = r.int(4, 7); i > 0; i--) rq(e, r.int(10 * MIN, 22 * H));
    for (let i = r.int(1, 2); i > 0; i--) ev(e, "replica_ready", r.int(H, 21 * H) + i);
    const o = r.pick(e.reqs);
    ev(e, "replica_ready", o.at + r.int(5, 90));                     // right after a request: still not cold
  }
  // Idle endpoint: scales to zero early and receives nothing.
  {
    const e = eps.find((x) => x.type === "idle");
    ev(e, "scaled_to_zero", e.idle * MIN + r.int(0, 2 * H));
  }
  for (const e of eps) {
    e.events.sort((a, b) => a.at - b.at);
    for (let i = 1; i < e.events.length; i++) if (e.events[i].at === e.events[i - 1].at) e.events[i].at += 1;
    e.reqs.sort((a, b) => a.at - b.at);
  }

  // Ids in time order.
  const allEv = eps.flatMap((e) => e.events.map((x) => ({ ...x, ep: e.id }))).sort((a, b) => a.at - b.at || (a.ep < b.ep ? -1 : 1));
  let en = 2000 + r.int(0, 5000);
  for (const x of allEv) x.id = "evt_" + en++;
  const allRq = eps.flatMap((e) => e.reqs.map((x) => ({ ...x, ep: e.id }))).sort((a, b) => a.at - b.at || (a.ep < b.ep ? -1 : 1));
  let rn = 100000 + r.int(0, 800000);
  for (const x of allRq) { x.id = "req_" + (rn += r.int(1, 97)); x.log = Math.min(x.at + r.int(1, 20), CUTOFF - 1); }
  for (const x of allRq) if (x.at > x.log) x.log = x.at;

  const rows = allRq.map((x) => ({ ...x }));
  if (level === 3) {
    const coldOnes = allRq.filter((x) => stateAt(x.ep, x.at) !== null && COLD.has(stateAt(x.ep, x.at)));
    const forced = r.pick(coldOnes);
    for (const x of allRq) if (x === forced || r.chance(0.15)) rows.push({ ...x, log: Math.min(x.log + r.int(30, 900), CUTOFF - 1) });
  }
  rows.sort((a, b) => a.log - b.log || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  function evsOf(ep) { return allEv.filter((x) => x.ep === ep); }
  function stateAt(ep, at) {
    let k = null;
    for (const x of evsOf(ep)) if (x.at <= at) k = x.kind;
    return k;
  }

  // The oracle. opts break one rule each, for diagnostics.
  const compute = (opts = {}) => {
    const src = opts.dupes ? rows : allRq;
    const coldKinds = new Set(["scaled_to_zero", "start_failed", "resumed"]);
    if (opts.failEnds) coldKinds.delete("start_failed");
    if (opts.resumedServing) coldKinds.delete("resumed");
    if (opts.pausedCold) coldKinds.add("paused");
    const out = [];
    for (const e of [...eps].sort((a, b) => (a.id < b.id ? -1 : 1))) {
      const evs = evsOf(e.id);
      const reqs = src.filter((x) => x.ep === e.id);
      if (opts.dropIdle && reqs.length === 0) continue;
      let cold = 0, waiting = 0, total = 0, max = 0;
      for (const q of reqs) {
        let isCold, end = null;
        if (opts.nextEvent) {
          const nx = evs.find((x) => x.at > q.at);
          isCold = !!nx && nx.kind === "replica_ready";
          end = isCold ? nx.at : null;
        } else {
          let i = -1;
          for (let j = 0; j < evs.length; j++) if (evs[j].at <= q.at) i = j;
          let cur = i >= 0 ? evs[i] : null;
          if (opts.atZeroExclusive && cur && cur.at === q.at && coldKinds.has(cur.kind)) cur = i >= 1 ? evs[i - 1] : null;
          isCold = !!cur && coldKinds.has(cur.kind);
          if (opts.readyInclusive && cur && cur.at === q.at && cur.kind === "replica_ready" && i >= 1 && coldKinds.has(evs[i - 1].kind)) {
            isCold = true; end = q.at;
          } else if (isCold) {
            const nx = evs.find((x) => x.at > q.at && (x.kind === "replica_ready" || (opts.failEnds && x.kind === "start_failed")));
            end = nx ? nx.at : null;
          }
        }
        if (!isCold) continue;
        if (end === null) { if (opts.dropWaiting) continue; cold++; waiting++; continue; }
        cold++;
        const w = end - q.at;
        total += w;
        if (w > max) max = w;
      }
      out.push([e.id, reqs.length, cold, waiting, total, max]);
    }
    return out;
  };
  const expected = compute();

  const diagnostics = [
    { message: "A request at exactly the second the endpoint scaled to zero was treated as served. The state at a time is set by the latest event at or before it, so that request found the endpoint at zero and waited for the wake.", rows: compute({ atZeroExclusive: true }) },
    { message: "A request at exactly the second a replica became ready was counted as a cold start (with a wait of 0). At that second the endpoint is serving again: the cold period is [scaled_to_zero, replica_ready).", rows: compute({ readyInclusive: true }) },
    { message: "A request was called cold because the next event after it is replica_ready. replica_ready also happens when autoscaling adds a replica to an endpoint that is already serving; whether a request was cold depends on the state when it arrived (the latest event at or before it), not on the next event.", rows: compute({ nextEvent: true }) },
    { message: "Endpoints with no requests are missing. The report has one row per endpoint in `endpoints`: start from that table and LEFT JOIN the requests.", rows: compute({ dropIdle: true }) },
  ];
  if (level >= 2) {
    diagnostics.push(
      { message: "start_failed was treated as the end of the cold period. A failed start leaves the endpoint at zero; requests after it still wait, until the first replica_ready.", rows: compute({ failEnds: true }) },
      { message: "Cold requests still waiting at the end of the export were dropped. They are cold starts with no replica_ready yet: count them in cold_requests and waiting_at_end, and leave them out of the wait totals.", rows: compute({ dropWaiting: true }) },
    );
  }
  if (level === 3) {
    diagnostics.push(
      { message: "Redelivered request log rows were counted twice. The log is delivered at least once: keep one row per request_id.", rows: compute({ dupes: true }) },
      { message: "Requests to a paused endpoint were counted as cold starts. A paused endpoint rejects requests at once; they count as requests, not as cold starts.", rows: compute({ pausedCold: true }) },
      { message: "Requests between resumed and the next replica_ready were treated as served. Resuming starts the endpoint from zero, so those requests waited like any cold start.", rows: compute({ resumedServing: true }) },
    );
  }

  const epCols = ["endpoint_id", "model_repo", "instance_type", "min_replicas", "idle_minutes"];
  const epRows = [...eps].sort((a, b) => (a.id < b.id ? -1 : 1)).map((e) => [e.id, e.repo, e.instance, e.min, e.idle]);
  const evCols = ["event_id", "endpoint_id", "kind", "occurred_at"];
  const evRows = allEv.map((x) => [x.id, x.ep, x.kind, stamp(x.at)]);
  const rqCols = ["request_id", "endpoint_id", "received_at", "logged_at"];
  const rqRows = rows.map((x) => [x.id, x.ep, stamp(x.at), stamp(x.log)]);

  const kinds = level === 1 ? "'scaled_to_zero','replica_ready'" : level === 2 ? "'scaled_to_zero','start_failed','replica_ready'" : "'scaled_to_zero','start_failed','replica_ready','paused','resumed'";
  const pk = level === 3 ? "PRIMARY KEY (request_id, logged_at)" : "PRIMARY KEY (request_id)";
  const setup =
    "SET TIME ZONE 'UTC';\n" +
    "CREATE TABLE endpoints (\n  endpoint_id TEXT PRIMARY KEY,\n  model_repo TEXT NOT NULL,\n  instance_type TEXT NOT NULL,\n  min_replicas INT NOT NULL,\n  idle_minutes INT\n);\n" +
    "CREATE TABLE endpoint_events (\n  event_id TEXT PRIMARY KEY,\n  endpoint_id TEXT NOT NULL REFERENCES endpoints (endpoint_id),\n  kind TEXT NOT NULL CHECK (kind IN (" + kinds + ")),\n  occurred_at TIMESTAMPTZ NOT NULL\n);\n" +
    "CREATE TABLE endpoint_requests (\n  request_id TEXT NOT NULL,\n  endpoint_id TEXT NOT NULL REFERENCES endpoints (endpoint_id),\n  received_at TIMESTAMPTZ NOT NULL,\n  logged_at TIMESTAMPTZ NOT NULL,\n  " + pk + "\n);\n" +
    insertSQL("endpoints", epCols, epRows) + insertSQL("endpoint_events", evCols, evRows) + insertSQL("endpoint_requests", rqCols, rqRows);

  return {
    vars: {
      day,
      cutoff: `${nextDay} 00:00:00+00`,
      endpoint_count: eps.length,
      events: evRows.length,
      requests: rqRows.length,
      kinds_rule: level === 1
        ? "Event kinds are `scaled_to_zero` (the last replica stopped) and `replica_ready` (a replica became ready to serve)."
        : level === 2
          ? "Event kinds are `scaled_to_zero` (the last replica stopped), `start_failed` (a wake attempt failed and is retried automatically; the endpoint stays at zero) and `replica_ready` (a replica became ready to serve)."
          : "Event kinds are `scaled_to_zero` (the last replica stopped), `start_failed` (a wake attempt failed and is retried automatically; the endpoint stays at zero), `replica_ready` (a replica became ready to serve), `paused` (the owner paused the endpoint) and `resumed` (the owner resumed it).",
      cold_rule: level === 3
        ? "An endpoint is at zero while its latest event is `scaled_to_zero`, `start_failed` or `resumed` (resuming starts it from zero). While its latest event is `paused`, requests are rejected at once: they count in `requests` but are never cold."
        : level === 2
          ? "An endpoint is at zero while its latest event is `scaled_to_zero` or `start_failed`."
          : "An endpoint is at zero while its latest event is `scaled_to_zero`.",
      feed_rule: level === 3
        ? "The request log is delivered at least once: a redelivered row has the same request_id and a later logged_at. Count each request_id once."
        : "Each request appears once in the log.",
    },
    setup,
    tables: [
      { name: "endpoints", columns: epCols, rows: epRows },
      { name: "endpoint_events", columns: evCols, rows: evRows },
      { name: "endpoint_requests", columns: rqCols, rows: rqRows },
    ],
    expected: { columns: ["endpoint_id", "requests", "cold_requests", "waiting_at_end", "total_wait_s", "max_wait_s"], rows: expected },
    diagnostics: diagnostics.filter((d) => JSON.stringify(d.rows) !== JSON.stringify(expected)),
  };
}
