/* ANT-L1-02 — Streams that stalled: time to first token and the longest silence (SQL).
   Simulated practice scenario. All data is generated from the seed; models,
   thresholds and timings are hypothetical.

   Contract: see docs/COMPANY-INTERVIEW-LOOPS.md § Executable templates (sql).
   level: 1 Medium (complete streams; pings during stalls)
          2 Hard (+ events sharing a millisecond, values exactly at a threshold,
                  streams ended by an error event)
          3 Very Hard (+ errors before the first token, truncated streams, single-delta
                       streams, a request with no events at all) */
import { insertSQL, pad2 } from "../../js/rng.js";

export const kind = "sql";

const MODELS = ["model-large-2", "model-mid-4", "model-small-4", "model-mid-3"];
const DAYS = ["2026-09-09", "2026-09-17", "2026-09-24", "2026-10-02", "2026-10-08"];

function tsms(day, ms) {
  const s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return `${day} ${pad2(h)}:${pad2(m)}:${pad2(s % 60)}.${String(ms % 1000).padStart(3, "0")}+00`;
}

export function generate(r, level) {
  const day = r.pick(DAYS);
  const ttftLimit = r.pick([1500, 2000, 2500, 3000]);
  const gapLimit = r.pick([3000, 4000, 5000]);
  const pingEvery = r.pick([700, 1000, 1500]);
  const models = r.sample(MODELS, level === 1 ? 2 : 3);

  // Kinds of stream; each instance gets a shuffled mix.
  const kinds = ["ok", "ok", "ok", "stall", "slow", "ok"];
  if (level >= 2) kinds.push("ttft_exact", "gap_exact", "error_mid", "ok_ties");
  if (level === 3) kinds.push("error_first", "truncated", "single", "no_events", "single_slow");
  const plan = r.shuffle(kinds);

  const reqs = [];
  const events = [];
  let rid = r.int(100, 900);
  let clock = r.int(3600, 7200) * 1000;
  for (const k of plan) {
    const id = "req_" + (rid += r.int(1, 40)).toString().padStart(5, "0");
    const model = r.pick(models);
    const start = (clock += r.int(1000, 90000));
    reqs.push({ id, model, start });
    if (k === "no_events") continue;
    let seq = 0, t = start;
    const ev = (type, at) => { events.push({ rid: id, seq: seq++, type, at }); t = at; };
    ev("message_start", start + r.int(60, 400));
    if (k === "error_first") { ev("ping", t + pingEvery); ev("error", t + r.int(100, 900)); continue; }
    ev("content_block_start", t + r.int(0, 4));

    const ttft = k === "slow" || k === "single_slow" ? ttftLimit + r.int(1, 2500) : k === "ttft_exact" ? ttftLimit : r.int(250, ttftLimit - 200);
    // Pings may arrive while the client waits for the first token.
    let first = start + ttft;
    for (let p = t + pingEvery; p < first; p += pingEvery) ev("ping", p);
    ev("content_block_delta", first);

    const nDeltas = k === "single" || k === "single_slow" ? 1 : r.int(4, 9);
    const stallAt = k === "stall" || k === "gap_exact" || k === "error_mid" ? r.int(1, nDeltas - 2) : -1;
    for (let i = 1; i < nDeltas; i++) {
      let gap = r.int(15, 400);
      if (k === "ok_ties" && i % 2 === 1) gap = 0;                            // same millisecond, seq decides
      if (i === stallAt) gap = k === "gap_exact" ? gapLimit : gapLimit + r.int(1, 6000);
      const next = t + gap;
      if (gap >= pingEvery) for (let p = t + pingEvery; p < next; p += pingEvery) ev("ping", p);   // keep-alives during the silence
      ev("content_block_delta", next);
      if (k === "error_mid" && i === stallAt) { ev("error", t + r.int(5, 200)); break; }
    }
    if (k === "error_mid" || k === "truncated") continue;
    ev("content_block_stop", t + r.int(0, 5));
    ev("message_delta", t + r.int(1, 30));
    ev("message_stop", t + r.int(0, 3));
  }

  // Oracle, parameterised so each diagnostic breaks one rule.
  const compute = (o = {}) => {
    const out = [];
    for (const q of reqs) {
      const evs = events.filter((e) => e.rid === q.id).sort((a, b) => a.seq - b.seq);
      if (o.innerJoin && !evs.length) continue;
      const deltas = evs.filter((e) => e.type === "content_block_delta");
      const firstTok = o.ttftFirstEvent ? evs[0] : deltas[0];
      const ttft = firstTok ? firstTok.at - q.start : null;
      let maxGap = null;
      if (o.pingsCount) {
        // LAG over every event, then keep the delta rows: a ping becomes the "previous" event.
        for (let i = 1; i < evs.length; i++) {
          if (evs[i].type !== "content_block_delta") continue;
          const g = evs[i].at - evs[i - 1].at;
          if (maxGap === null || g > maxGap) maxGap = g;
        }
      } else {
        for (let i = 1; i < deltas.length; i++) { const g = deltas[i].at - deltas[i - 1].at; if (maxGap === null || g > maxGap) maxGap = g; }
      }
      const has = (t) => evs.some((e) => e.type === t);
      const outcome = has("message_stop") ? "completed" : o.noTruncated || has("error") ? "error" : "truncated";
      const over = (v, lim) => v !== null && (o.inclusive ? v >= lim : v > lim);
      if (outcome !== "completed" || over(ttft, ttftLimit) || over(maxGap, gapLimit)) out.push([q.id, q.model, ttft, maxGap, deltas.length, outcome]);
    }
    return out.sort((a, b) => (a[0] < b[0] ? -1 : 1));
  };
  const expected = compute();

  const diagnostics = [
    { message: "The gap was taken with LAG over every event and then filtered to deltas, so a ping (a keep-alive) inside a silence became the previous event and split it. Only content_block_delta events are progress: filter to them before LAG.", rows: compute({ pingsCount: true }) },
    { message: "TTFT was measured to the first event (message_start). Time to first token is from started_at to the first content_block_delta.", rows: compute({ ttftFirstEvent: true }) },
  ];
  if (level >= 2) diagnostics.push({ message: `The thresholds were applied as >=. A TTFT of exactly ${ttftLimit} ms or a gap of exactly ${gapLimit} ms is not a problem; only strictly greater is.`, rows: compute({ inclusive: true }) });
  if (level === 3) {
    diagnostics.push({ message: "A request with no stream events was dropped by an inner join. Start from stream_requests and LEFT JOIN its events: a request that never streamed is truncated.", rows: compute({ innerJoin: true }) });
    diagnostics.push({ message: "Every stream without message_stop was labelled 'error'. Only a stream with an error event is 'error'; one that simply stopped is 'truncated'.", rows: compute({ noTruncated: true }) });
  }

  const reqRows = reqs.map((q) => [q.id, q.model, tsms(day, q.start)]);
  // Level 3 stores events in arrival order across streams, not grouped by request.
  const evSorted = level === 3 ? r.shuffle(events) : events.slice().sort((a, b) => (a.rid < b.rid ? -1 : a.rid > b.rid ? 1 : a.seq - b.seq));
  const evRows = evSorted.map((e) => [e.rid, e.seq, e.type, tsms(day, e.at)]);
  const reqCols = ["request_id", "model", "started_at"];
  const evCols = ["request_id", "seq", "event_type", "event_ts"];

  const setup =
    "SET TIME ZONE 'UTC';\n" +
    "CREATE TABLE stream_requests (\n  request_id TEXT PRIMARY KEY,\n  model TEXT NOT NULL,\n  started_at TIMESTAMPTZ NOT NULL\n);\n" +
    "CREATE TABLE stream_events (\n  request_id TEXT NOT NULL REFERENCES stream_requests,\n  seq INT NOT NULL,\n  event_type TEXT NOT NULL,\n  event_ts TIMESTAMPTZ NOT NULL,\n  PRIMARY KEY (request_id, seq)\n);\n" +
    insertSQL("stream_requests", reqCols, reqRows) + insertSQL("stream_events", evCols, evRows);

  return {
    vars: {
      ttft_ms: ttftLimit,
      gap_ms: gapLimit,
      n_requests: reqs.length,
      n_events: events.length,
      edge_rule: level === 1
        ? "Every stream in this sample completed."
        : level === 2
          ? "Some streams end with an `error` event instead of `message_stop`. Events can share a millisecond; `seq` is their order."
          : "Some streams end with an `error` event, some stop without either `message_stop` or `error`, and a request can have no events at all. Events can share a millisecond; `seq` is their order, and the table is not stored in any particular order.",
    },
    setup,
    tables: [
      { name: "stream_requests", columns: reqCols, rows: reqRows },
      { name: "stream_events", columns: evCols, rows: evRows },
    ],
    expected: { columns: ["request_id", "model", "ttft_ms", "max_gap_ms", "deltas", "outcome"], rows: expected },
    diagnostics: diagnostics.filter((d) => JSON.stringify(d.rows) !== JSON.stringify(expected)),
  };
}
