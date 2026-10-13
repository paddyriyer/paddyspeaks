/* OAI-L1-01 — Token usage vs billed tokens reconciliation (SQL).
   Simulated practice scenario. All data is generated from the seed.

   Contract (see docs/COMPANY-INTERVIEW-LOOPS.md § Executable templates):
     generate(r, level) -> {
       vars,                       // placeholders for the template text
       setup,                      // PostgreSQL DDL + seed rows (fresh schema each run)
       tables: [{name, columns, rows}],   // what the candidate sees
       expected: {columns, rows},  // computed here by the oracle; CI proves the
                                   // evaluator's reference SQL returns exactly this
       diagnostics: [{message, rows}],    // known wrong answers, explained
     }
   level: 1 Medium · 2 Hard (retried events) · 3 Very Hard (+ missing rows both sides) */
import { insertSQL, ts } from "../../js/rng.js";

export const kind = "sql";

const PROJECTS = ["proj_atlas", "proj_beacon", "proj_cobalt", "proj_delta", "proj_ember", "proj_fjord"];
const FAMILIES = ["chat-small", "chat-large", "reasoning", "embedding", "vision"];
const DAYS = ["2026-09-14", "2026-09-15"];

export function generate(r, level) {
  const threshold = r.pick([100, 250, 500]);
  const projects = r.sample(PROJECTS, level === 1 ? 3 : 4);
  const families = r.sample(FAMILIES, 3);
  const events = [];
  let id = 1000 + r.int(0, 8000);

  for (const day of DAYS) {
    for (const p of projects) {
      const n = r.int(2, 4);
      for (let k = 0; k < n; k++) {
        const fam = r.pick(families);
        const sec = k === 0 && day === DAYS[0] && level === 3 ? 86399 - r.int(0, 30) : r.int(0, 86399);
        const ingestDelay = r.int(1, 900);
        events.push({
          request_id: "req_" + id++,
          project_id: p,
          model_family: fam,
          status: r.chance(0.15) ? "error" : "ok",
          prompt_tokens: r.int(40, 3500),
          completion_tokens: fam === "embedding" ? 0 : r.int(1, 1800),
          event_sec: sec,
          day,
          ingest_sec: sec + ingestDelay,          // may cross midnight: attribution is by event time
        });
      }
    }
  }

  // Retries (level >= 2): the same request_id re-sent later; the LATEST ingested copy wins
  // and may carry corrected token counts.
  if (level >= 2) {
    const retried = r.sample(events.filter((e) => e.status === "ok"), Math.max(2, Math.floor(events.length / 6)));
    for (const e of retried) {
      events.push({ ...e, prompt_tokens: r.chance(0.5) ? e.prompt_tokens : e.prompt_tokens + r.int(5, 60), ingest_sec: e.ingest_sec + r.int(30, 3000) });
    }
  }

  // Ground truth: deduplicated, ok-only, attributed to the UTC day of event time.
  const latest = new Map();
  for (const e of events) {
    const cur = latest.get(e.request_id);
    if (!cur || e.ingest_sec > cur.ingest_sec) latest.set(e.request_id, e);
  }
  const metered = new Map();
  for (const e of latest.values()) {
    if (e.status !== "ok") continue;
    const key = e.day + "|" + e.project_id;
    metered.set(key, (metered.get(key) || 0) + e.prompt_tokens + e.completion_tokens);
  }

  // Billing lines: equal to metered, except deliberate drift.
  const billing = new Map(metered);
  const keys = [...metered.keys()].sort();
  const big = r.sample(keys, 2);
  for (const k of big) billing.set(k, billing.get(k) + (r.chance(0.5) ? 1 : -1) * r.int(threshold + 1, threshold + 2500));
  const small = r.sample(keys.filter((k) => !big.includes(k)), 2);
  billing.set(small[0], billing.get(small[0]) + threshold);          // exactly the threshold: NOT reported (strict >)
  if (small[1]) billing.set(small[1], billing.get(small[1]) - r.int(1, threshold - 1));
  if (level === 3) {
    const gone = keys.filter((k) => !big.includes(k) && !small.includes(k));
    if (gone.length) billing.delete(r.pick(gone));                       // usage with no billing line
    const ghost = DAYS[1] + "|" + r.pick(PROJECTS.filter((p) => !projects.includes(p)));
    billing.set(ghost, r.int(threshold + 10, 4000));                   // billing with no usage
  }

  // Expected result.
  const all = new Set([...metered.keys(), ...billing.keys()]);
  const rows = [];
  for (const k of [...all].sort()) {
    const [d, p] = k.split("|");
    const m = metered.get(k) || 0, b = billing.get(k) || 0;
    if (Math.abs(b - m) > threshold) rows.push([d, p, m, b, b - m]);
  }

  // Known wrong answers, computed the same way with one rule broken.
  const diag = (opts) => {
    const mm = new Map();
    const src = opts.noDedup ? events : [...latest.values()];
    for (const e of src) {
      if (e.status !== "ok" && !opts.countErrors) continue;
      const day = opts.ingestDay ? dayOf(e.day, e.ingest_sec) : e.day;
      const key = day + "|" + e.project_id;
      mm.set(key, (mm.get(key) || 0) + e.prompt_tokens + e.completion_tokens);
    }
    const ks = opts.inner ? [...mm.keys()].filter((k) => billing.has(k)) : [...new Set([...mm.keys(), ...billing.keys()])];
    const out = [];
    for (const k of ks.sort()) {
      const [d, p] = k.split("|");
      const m = mm.get(k) || 0, b = billing.get(k) || 0;
      if (Math.abs(b - m) > threshold) out.push([d, p, m, b, b - m]);
    }
    return out;
  };
  const diagnostics = [
    { message: "Errored requests were counted. Only requests with status 'ok' are billable.", rows: diag({ countErrors: true }) },
  ];
  if (level >= 2) diagnostics.push({ message: "Retried requests were counted twice. Keep one row per request_id: the copy with the latest ingested_at.", rows: diag({ noDedup: true }) });
  if (level === 3) {
    diagnostics.push({ message: "An inner join drops project-days that exist on only one side: usage with no billing line, and billing with no usage. Use a FULL OUTER JOIN and treat the missing side as 0.", rows: diag({ inner: true }) });
    diagnostics.push({ message: "Usage was attributed to the day it was ingested. Attribute each request to the UTC day of its event_ts.", rows: diag({ ingestDay: true }) });
  }

  const evRows = events
    .map((e) => [e.request_id, e.project_id, e.model_family, e.status, e.prompt_tokens, e.completion_tokens, ts(e.day, e.event_sec), stamp(e.day, e.ingest_sec)])
    .sort((a, b) => (a[6] < b[6] ? -1 : a[6] > b[6] ? 1 : a[7] < b[7] ? -1 : 1));
  const billRows = [...billing.entries()].sort().map(([k, v]) => { const [d, p] = k.split("|"); return [d, p, v]; });
  const evCols = ["request_id", "project_id", "model_family", "status", "prompt_tokens", "completion_tokens", "event_ts", "ingested_at"];
  const billCols = ["usage_date", "project_id", "billed_tokens"];

  const setup =
    "SET TIME ZONE 'UTC';\n" +
    "CREATE TABLE usage_events (\n  request_id TEXT NOT NULL,\n  project_id TEXT NOT NULL,\n  model_family TEXT NOT NULL,\n  status TEXT NOT NULL CHECK (status IN ('ok','error')),\n  prompt_tokens INT NOT NULL,\n  completion_tokens INT NOT NULL,\n  event_ts TIMESTAMPTZ NOT NULL,\n  ingested_at TIMESTAMPTZ NOT NULL\n);\n" +
    "CREATE TABLE billing_lines (\n  usage_date DATE NOT NULL,\n  project_id TEXT NOT NULL,\n  billed_tokens BIGINT NOT NULL,\n  PRIMARY KEY (usage_date, project_id)\n);\n" +
    insertSQL("usage_events", evCols, evRows) + insertSQL("billing_lines", billCols, billRows);

  return {
    vars: {
      threshold,
      events: events.length,
      retries: level >= 2 ? "Clients retry: the same request_id can appear more than once, and the latest ingested copy is authoritative (it may carry corrected token counts)." : "Each request_id appears once.",
      gaps: level === 3 ? "A project-day can appear on only one side: usage with no billing line, or a billing line with no usage. Treat the missing side as 0." : "Every project-day with usage has a billing line.",
    },
    setup,
    tables: [
      { name: "usage_events", columns: evCols, rows: evRows },
      { name: "billing_lines", columns: billCols, rows: billRows },
    ],
    expected: { columns: ["usage_date", "project_id", "metered_tokens", "billed_tokens", "diff"], rows },
    diagnostics: diagnostics.filter((d) => JSON.stringify(d.rows) !== JSON.stringify(rows)),   // a rule this seed never exercises is not a diagnostic
  };
}

function stamp(day, sec) {                       // ingest time can roll past midnight
  if (sec < 86400) return ts(day, sec);
  return ts(nextDay(day), sec - 86400);
}
function dayOf(day, sec) { return sec < 86400 ? day : nextDay(day); }
function nextDay(day) {
  const d = new Date(day + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
