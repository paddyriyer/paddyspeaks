/* CFX-L1-02 — Origin 5xx share per zone and hour, edge-generated errors apart (SQL).
   Simulated practice scenario. All data is generated from the seed. What counts as
   forwarded, as an origin error and as an edge-generated error, and the floor, are this
   exercise's own rules, not any product's definition.

   Contract: see docs/COMPANY-INTERVIEW-LOOPS.md § Executable templates (sql).
   level: 1 Medium (one origin attempt per forwarded request; edge errors have none; floor)
          2 Hard (+ origin errors served stale with edge status 200; hour-boundary timestamps
                  with fractions of a second)
          3 Very Hard (+ retries: several attempts per request, the last one decides) */
import { insertSQL, ts } from "../../js/rng.js";

export const kind = "sql";

const ZONES = ["example.com", "example.net", "example.org", "example.io"];
const OK = [200, 200, 200, 204, 301, 304];
const C4 = [403, 404, 429];
const C5 = [500, 502, 503, 504];
const EDGE_ERR = [521, 522, 523];

const cmp = (x, y) => (x < y ? -1 : x > y ? 1 : 0);

export function generate(r, level) {
  const floor = r.pick([3, 4, 5]);
  const day = "2026-09-" + r.pick(["14", "15", "16"]);
  const zones = r.sample(ZONES, 2).sort();
  const groups = [];
  for (const z of zones) {
    let h = r.int(1, 5);
    for (let i = 0; i < 3; i++) { groups.push({ z, h, c: r.int(floor - 2, floor + 4) }); h += level === 1 ? r.int(1, 3) : 1; }
  }
  const g = r.shuffle(groups);
  g[0].c = floor;                                   // exactly at the floor
  g[1].c = floor - 1; g[1].cached = floor + 1;      // below the floor, many non-forwarded requests
  if (g[2].c < floor) g[2].c = floor + 1;
  g[2].edgeErr = 1; g[2].need4xx = true; g[2].needStale = level >= 2; g[2].needRetry = level === 3;
  if (g[3].c < floor) g[3].c = floor;
  g[3].needErr = true; g[3].needRetry = level === 3;

  const reqs = [];   // {z, h, attempts: [status...], edge}
  for (const grp of groups) {
    for (let i = 0; i < grp.c; i++) {
      let last = r.chance(0.6) ? r.pick(OK) : r.chance(0.5) ? r.pick(C4) : r.pick(C5);
      if (i === 0 && grp.needErr) last = r.pick(C5);
      if (i === 1 && grp.need4xx) last = r.pick(C4);
      const attempts = [];
      if (level === 3 && (r.chance(0.25) || (i === 2 && grp.needRetry))) {
        for (let k = r.int(1, 2); k > 0; k--) attempts.push(r.pick(C5));
        if (i === 2 && grp.needRetry) last = r.pick([200, 200, 304]);   // retried and recovered
      }
      attempts.push(last);
      let edge = last;
      const stale = level >= 2 && C5.includes(last) && (r.chance(0.3) || (i === 3 && grp.needStale));
      if (i === 3 && grp.needStale && !C5.includes(last)) { attempts[attempts.length - 1] = r.pick(C5); edge = 200; }
      else if (stale) edge = 200;
      reqs.push({ z: grp.z, h: grp.h, attempts, edge });
    }
    const nCached = (grp.cached || 0) + r.int(0, 2);
    for (let i = 0; i < nCached; i++) reqs.push({ z: grp.z, h: grp.h, attempts: [], edge: r.pick([200, 200, 304, 403]) });
    const nErr = (grp.edgeErr || 0) + (r.chance(0.3) ? 1 : 0);
    for (let i = 0; i < nErr; i++) reqs.push({ z: grp.z, h: grp.h, attempts: [], edge: r.pick(EDGE_ERR) });
  }

  const ordered = r.shuffle(reqs);
  let rid = 3_000_000 + r.int(0, 900000);
  const rRows = [], aRows = [];
  for (const q of ordered) {
    let sec = q.h * 3600 + r.int(0, 3599);
    let frac = "";
    if (level >= 2 && r.chance(0.2)) {
      if (r.chance(0.5)) { sec = q.h * 3600 + 3599; frac = "." + String(r.int(900, 999)); }   // last instant of the hour
      else sec = q.h * 3600;                                                                  // first instant
    }
    const t = ts(day, sec);
    q.id = (rid += r.int(1, 9));
    rRows.push([q.id, q.z, frac ? t.replace("+00", frac + "+00") : t, q.edge]);
    q.attempts.forEach((s, i) => aRows.push([q.id, i + 1, s]));
  }

  const solve = (o = {}) => {
    const per = new Map();
    for (const q of reqs) {
      const k = q.z + "|" + String(q.h).padStart(2, "0");
      if (!per.has(k)) per.set(k, { all: 0, f: 0, e: 0, edge: 0 });
      const s = per.get(k);
      s.all++;
      const isErr = (st) => (o.with4xx ? st >= 400 : st >= 500 && st <= 599);
      if (q.attempts.length === 0) {
        if (q.edge >= 500) {
          if (o.edgeAsOrigin) { s.f++; s.e++; } else s.edge++;
        }
        continue;
      }
      if (o.perAttempt) { s.f += q.attempts.length; s.e += q.attempts.filter(isErr).length; continue; }
      s.f++;
      let bad;
      if (o.byEdge) bad = isErr(q.edge);
      else if (o.anyAttempt) bad = q.attempts.some(isErr);
      else if (o.firstAttempt) bad = isErr(q.attempts[0]);
      else bad = isErr(q.attempts[q.attempts.length - 1]);
      if (bad) s.e++;
    }
    const share = (n, d) => Math.floor((n * 20000 + d) / (2 * d)) / 10000;
    return [...per.entries()]
      .filter(([, s]) => { const n = o.floorAll ? s.all : s.f; return s.f > 0 && (o.floorStrict ? n > floor : n >= floor); })
      .map(([k, s]) => { const [z, h] = k.split("|"); return [z, ts(day, Number(h) * 3600), s.f, s.e, share(s.e, s.f), s.edge]; })
      .sort((x, y) => cmp(x[0], y[0]) || cmp(x[1], y[1]));
  };
  const expected = solve();

  const diagnostics = [
    { message: "Edge-generated errors were counted as forwarded requests that failed. They never reached the origin: report them in edge_errors only.", rows: solve({ edgeAsOrigin: true }) },
    { message: "4xx responses were counted as origin errors. Only 5xx statuses count.", rows: solve({ with4xx: true }) },
    { message: "The floor was applied with > instead of >=. A zone-hour with exactly the minimum number of forwarded requests is reported.", rows: solve({ floorStrict: true }) },
    { message: "The floor was applied to all requests. It counts forwarded requests only; cache hits and edge errors cannot lift a zone-hour over it.", rows: solve({ floorAll: true }) },
  ];
  if (level >= 2) diagnostics.push({ message: "Errors were judged by edge_status. An origin 5xx served stale from cache reaches the visitor as 200 but is still an origin error.", rows: solve({ byEdge: true }) });
  if (level === 3) {
    diagnostics.push({ message: "A request counted as an error when any attempt failed. Only its last attempt decides: a retry that succeeded is not an origin error.", rows: solve({ anyAttempt: true }) });
    diagnostics.push({ message: "The first attempt was used. The last attempt (highest attempt_no) is the request's outcome.", rows: solve({ firstAttempt: true }) });
    diagnostics.push({ message: "Attempts were counted instead of requests. Join to one outcome per request before counting.", rows: solve({ perAttempt: true }) });
  }

  rRows.sort((x, y) => x[0] - y[0]);
  aRows.sort((x, y) => x[0] - y[0] || x[1] - y[1]);
  const rCols = ["request_id", "zone_name", "request_ts", "edge_status"];
  const aCols = ["request_id", "attempt_no", "origin_status"];
  const setup =
    "SET TIME ZONE 'UTC';\n" +
    "CREATE TABLE requests (\n  request_id BIGINT PRIMARY KEY,\n  zone_name TEXT NOT NULL,\n  request_ts TIMESTAMPTZ NOT NULL,\n  edge_status INT NOT NULL\n);\n" +
    "CREATE TABLE origin_attempts (\n  request_id BIGINT NOT NULL REFERENCES requests(request_id),\n  attempt_no INT NOT NULL,\n  origin_status INT NOT NULL,\n  PRIMARY KEY (request_id, attempt_no)\n);\n" +
    insertSQL("requests", rCols, rRows) + insertSQL("origin_attempts", aCols, aRows);

  return {
    vars: {
      min_forwarded: floor,
      requests: rRows.length,
      attempts: aRows.length,
      edge_rule: level === 1
        ? "In this sample `edge_status` equals the origin's status for every forwarded request."
        : "Judge the origin by `origin_status`, not `edge_status`: an origin 5xx can reach the visitor as a cached copy served stale with `edge_status` 200, and it still counts as an origin error. Some timestamps fall in the last or first instant of an hour.",
      attempt_rule: level === 3
        ? "A request can have several attempts (the edge retried after a failure): its outcome is its **last** attempt, the highest `attempt_no`, and it counts once."
        : "Every forwarded request has exactly one attempt in this sample.",
    },
    setup,
    tables: [
      { name: "requests", columns: rCols, rows: rRows },
      { name: "origin_attempts", columns: aCols, rows: aRows },
    ],
    expected: { columns: ["zone_name", "hour_start", "forwarded", "origin_5xx", "origin_5xx_share", "edge_errors"], rows: expected },
    diagnostics: diagnostics.filter((d) => JSON.stringify(d.rows) !== JSON.stringify(expected)),
  };
}
