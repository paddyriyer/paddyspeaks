/* XAI-L1-02 — Batch turnaround per size band and week (SQL).
   Simulated practice scenario. All data is generated from the seed. The completion window,
   size bands and every timestamp are this exercise's, hypothetical; check current docs.

   Contract: see docs/COMPANY-INTERVIEW-LOOPS.md § Executable templates (sql).
   level: 1 Medium (custom ids unique across batches; every request has one result, some
            after the window)
          2 Hard (+ custom ids reused across batches, requests with no result yet, errored
            results, a result exactly at the window, batches either side of a week boundary)
          3 Very Hard (+ results delivered more than once: a request's earliest result counts) */
import { insertSQL } from "../../js/rng.js";

export const kind = "sql";

const TEAMS = ["team_aurora", "team_basalt", "team_cobalt", "team_delta", "team_ember"];
const BASE = Date.UTC(2026, 8, 28);                 // Monday 2026-09-28 00:00 UTC
const p2 = (n) => String(n).padStart(2, "0");
const iso = (sec) => {
  const d = new Date(BASE + sec * 1000);
  return [`${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())}`, `${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}:${p2(d.getUTCSeconds())}`];
};
const fmt = (sec) => { const [a, b] = iso(sec); return `${a} ${b}+00`; };
const weekOf = (sec) => iso(Math.floor(sec / (7 * 86400)) * 7 * 86400)[0];   // BASE is a Monday

export function generate(r, level) {
  const W = r.pick([12, 24, 48]);
  const WS = W * 3600;
  const mid = r.pick([5, 8, 10]), large = r.pick([15, 20, 25]);
  const band = (n) => (n >= large ? large : n >= mid ? mid : 1);
  const nBatches = 14 + 3 * level;
  const batches = [];
  let bnum = 100 + r.int(0, 800);
  let resId = 50000 + r.int(0, 40000);
  const results = [];                                   // {rid, batch, cid, at, outcome}
  for (let i = 0; i < nBatches; i++) {
    let sub;
    if (level >= 2 && i < 2) sub = 7 * 86400 + (i === 0 ? -r.int(30, 600) : r.int(0, 600));   // either side of Monday 00:00
    else sub = r.int(3600, 13 * 86400);
    const size = r.pick([r.int(1, mid - 1), r.int(mid, large - 1), r.int(large, large + 12)]);
    const b = { id: "batch_" + (bnum += r.int(1, 9)), team: r.pick(TEAMS), sub, reqs: [] };
    const slow = r.chance(0.35);
    for (let q = 1; q <= size; q++) {
      const cid = level === 1 ? `${b.id.slice(6)}-q${q}` : `q${q}`;
      b.reqs.push(cid);
      if (level >= 2 && slow && r.chance(0.2)) continue;                // no result yet
      const off = slow && r.chance(0.3) ? r.int(WS + 1, Math.floor(WS * 1.5)) : r.int(Math.floor(WS * 0.05), WS);
      const outcome = level >= 2 && r.chance(0.12) ? "errored" : "succeeded";
      results.push({ rid: resId += r.int(1, 7), batch: b, cid, at: sub + off, outcome });
    }
    batches.push(b);
  }
  if (level >= 2) {
    // A result exactly at the window, in a batch whose other results are early.
    const b = batches[2];
    for (const cid of b.reqs) {
      if (!results.some((x) => x.batch === b && x.cid === cid)) results.push({ rid: resId += r.int(1, 7), batch: b, cid, at: b.sub + r.int(600, WS), outcome: "succeeded" });
    }
    for (const x of results) if (x.batch === b) x.at = Math.min(x.at, b.sub + WS - 60);
    const own = results.filter((x) => x.batch === b);
    if (own.length) own[0].at = b.sub + WS;
  }
  if (level === 3) {
    // Redeliveries: a later row for a request that already has a result.
    for (const x of r.sample(results, 6)) results.push({ rid: resId += r.int(1, 7), batch: x.batch, cid: x.cid, at: x.at + r.int(600, WS), outcome: "succeeded" });
    // A request whose first result was in the window and a redelivery outside it.
    const x = r.pick(results.filter((y) => y.at - y.batch.sub < WS / 2));
    results.push({ rid: resId += r.int(1, 7), batch: x.batch, cid: x.cid, at: x.batch.sub + WS + r.int(60, 3600), outcome: "succeeded" });
  }

  const cmp = (x, y) => (x < y ? -1 : x > y ? 1 : 0);
  const share = (n, d) => Math.floor((n * 20000 + d) / (2 * d)) / 10000;
  const hours = (secs) => Math.floor((2 * secs + 36) / 72) / 100;
  const disc = (xs, p) => { const s = xs.slice().sort((a, b) => a - b); return s[Math.max(1, Math.ceil(p * s.length)) - 1]; };
  const solve = (o = {}) => {
    const first = new Map();                         // batch|cid -> earliest result time
    for (const x of results) {
      const k = (o.cidOnly ? "" : x.batch.id) + "|" + x.cid;
      if (o.cidOnly && level >= 2) {
        // joining on custom_id alone: every batch with that custom id gets every result
        for (const b of batches) if (b.reqs.includes(x.cid)) {
          const kk = b.id + "|" + x.cid;
          if (!first.has(kk) || x.at < first.get(kk)) first.set(kk, x.at);
        }
        continue;
      }
      const cur = first.get(k);
      if (o.latest ? cur === undefined || x.at > cur : cur === undefined || x.at < cur) first.set(k, x.at);
    }
    const per = new Map();
    for (const b of batches) {
      const k = weekOf(b.sub) + "|" + band(b.reqs.length);
      if (!per.has(k)) per.set(k, { wk: weekOf(b.sub), band: band(b.reqs.length), n: 0, reqs: 0, inWin: 0, pending: 0, turn: [] });
      const s = per.get(k);
      s.n++;
      let allIn = true, last = 0, inWin = 0;
      for (const cid of b.reqs) {
        s.reqs++;
        const at = first.get(b.id + "|" + cid);
        const ok = at !== undefined && (o.strict ? at - b.sub < WS : at - b.sub <= WS);
        if (ok) inWin++;
        if (!ok) allIn = false;
        if (at !== undefined) last = Math.max(last, at - b.sub);
      }
      s.inWin += inWin;
      if (allIn || o.noPending) { s.turn.push(last); if (!allIn) s.pending++; }
      else s.pending++;
    }
    return [...per.values()].sort((a, b) => cmp(a.wk, b.wk) || a.band - b.band).map((s) => [
      s.wk, s.band, s.n, s.reqs, share(s.inWin, s.reqs), s.pending,
      s.turn.length ? hours(disc(s.turn, 0.5)) : null,
    ]);
  };
  const rows = solve();

  const diagnostics = [
    { message: "Batches still holding requests without a result at the window were included in the median turnaround. Show them apart: count them in pending_batches and leave them out of the median.", rows: solve({ noPending: true }) },
  ];
  if (level >= 2) {
    diagnostics.push({ message: "Results were joined on custom_id alone. Custom ids are the batch's own ids and repeat across batches: join on (batch_id, custom_id).", rows: solve({ cidOnly: true }) });
    diagnostics.push({ message: "A result exactly at submitted_at + the window was treated as late. The window is inclusive.", rows: solve({ strict: true }) });
  }
  if (level === 3) diagnostics.push({ message: "A redelivered result replaced the first one. A request's result time is its earliest result row.", rows: solve({ latest: true }) });

  const bCols = ["batch_id", "team_id", "submitted_at"];
  const bRows = batches.slice().sort((a, b) => cmp(a.id, b.id)).map((b) => [b.id, b.team, fmt(b.sub)]);
  const qCols = ["batch_id", "custom_id"];
  const qRows = batches.flatMap((b) => b.reqs.map((c) => [b.id, c])).sort((a, b) => cmp(a[0], b[0]) || cmp(a[1].length, b[1].length) || cmp(a[1], b[1]));
  const rCols = ["result_id", "batch_id", "custom_id", "result_at", "outcome"];
  const rRows = results.slice().sort((a, b) => a.rid - b.rid).map((x) => [x.rid, x.batch.id, x.cid, fmt(x.at), x.outcome]);
  const setup =
    "SET TIME ZONE 'UTC';\n" +
    "CREATE TABLE batches (\n  batch_id TEXT PRIMARY KEY,\n  team_id TEXT NOT NULL,\n  submitted_at TIMESTAMPTZ NOT NULL\n);\n" +
    "CREATE TABLE batch_requests (\n  batch_id TEXT NOT NULL REFERENCES batches(batch_id),\n  custom_id TEXT NOT NULL,\n  PRIMARY KEY (batch_id, custom_id)\n);\n" +
    "CREATE TABLE batch_results (\n  result_id BIGINT PRIMARY KEY,\n  batch_id TEXT NOT NULL,\n  custom_id TEXT NOT NULL,\n  result_at TIMESTAMPTZ NOT NULL,\n  outcome TEXT NOT NULL CHECK (outcome IN ('succeeded', 'errored'))\n);\n" +
    insertSQL("batches", bCols, bRows) + insertSQL("batch_requests", qCols, qRows) + insertSQL("batch_results", rCols, rRows);

  return {
    vars: {
      window_hours: String(W),
      mid: String(mid),
      large: String(large),
      mid_less: String(mid - 1),
      large_less: String(large - 1),
      batches: String(batches.length),
      id_rule: level === 1
        ? "In this sample every custom_id is unique across batches, and every request has exactly one result row."
        : level === 2
          ? "custom_id is the id the team gave each request inside its batch, so the same custom_id appears in many batches. Some requests have no result row yet, and a result can be errored. Each request has at most one result row."
          : "custom_id is the id the team gave each request inside its batch, so the same custom_id appears in many batches. Some requests have no result row yet, and a result can be errored. A result can be delivered more than once: a request's result time is its earliest result row.",
    },
    setup,
    tables: [
      { name: "batches", columns: bCols, rows: bRows },
      { name: "batch_requests", columns: qCols, rows: qRows },
      { name: "batch_results", columns: rCols, rows: rRows },
    ],
    expected: { columns: ["week_start", "size_band", "batches", "requests", "in_window_share", "pending_batches", "median_hours"], rows },
    diagnostics: diagnostics.filter((d) => JSON.stringify(d.rows) !== JSON.stringify(rows)),
  };
}
