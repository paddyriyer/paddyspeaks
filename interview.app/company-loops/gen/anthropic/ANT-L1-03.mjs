/* ANT-L1-03 — Message batch reconciliation across resubmissions (SQL).
   Simulated practice scenario. All data is generated from the seed; jobs, batch ids
   and token counts are hypothetical.

   Contract: see docs/COMPANY-INTERVIEW-LOOPS.md § Executable templates (sql).
   level: 1 Medium (ended batches; failed items resubmitted in a later batch)
          2 Hard (+ items resubmitted after they had succeeded, batches created in
                  the same second, so batch_id decides which success came first)
          3 Very Hard (+ a batch still in progress, results missing from an ended batch,
                       items that succeeded and then failed on a resubmission) */
import { insertSQL, ts } from "../../js/rng.js";

export const kind = "sql";

const JOBS = ["job_contract_summaries", "job_ticket_triage", "job_doc_classify", "job_eval_sweep", "job_catalog_translate", "job_meeting_notes"];
const DAYS = ["2026-09-06", "2026-09-14", "2026-09-21", "2026-09-29", "2026-10-05"];
const FAILS = ["errored", "errored", "expired", "canceled"];

export function generate(r, level) {
  const day = r.pick(DAYS);
  const jobs = r.sample(JOBS, level === 1 ? 2 : 3).sort();
  const batches = [];      // {id, job, at, status}
  const requests = [];     // {batch, custom}
  const results = [];      // {batch, custom, type, out}
  const usedIds = new Set();
  const newBatchId = () => {
    let id;
    do id = "msgbatch_" + Array.from({ length: 8 }, () => "abcdefghjkmnpqrstuvwxyz0123456789"[r.int(0, 32)]).join("");
    while (usedIds.has(id));
    usedIds.add(id);
    return id;
  };
  const ok = (p) => r.chance(p);

  jobs.forEach((job, ji) => {
    const k = r.int(5, level === 1 ? 6 : 8);
    const items = Array.from({ length: k }, (_, i) => "item-" + String(i + 1).padStart(3, "0"));
    let at = 3600 * (1 + ji * 2) + r.int(0, 1800);
    const succeeded = new Set();
    const submit = (ids, status, opts = {}) => {
      const b = { id: opts.id || newBatchId(), job, at: opts.at ?? at, status };
      batches.push(b);
      for (const c of ids) {
        requests.push({ batch: b.id, custom: c });
        if (status !== "ended") continue;
        if (opts.lose && opts.lose.includes(c)) continue;            // result never exported
        const forced = opts.force && opts.force[c];
        const type = forced || (ok(opts.pOk ?? 0.6) ? "succeeded" : r.pick(FAILS));
        results.push({ batch: b.id, custom: c, type, out: type === "succeeded" ? r.int(40, 4000) : null });
        if (type === "succeeded") succeeded.add(c);
      }
      return b;
    };

    // Round 1: every item. Items 0-4 have fixed roles so every instance exercises each rule.
    const F = () => r.pick(FAILS);
    const force1 = { [items[0]]: "succeeded", [items[1]]: F() };
    if (level >= 2) force1[items[3]] = F();
    if (level === 3) Object.assign(force1, { [items[2]]: "succeeded", [items[4]]: F() });
    submit(items, "ended", { force: force1 });

    // Round 2: resubmit the failed items, except one the client has not retried yet.
    at += r.int(4, 20) * 600;
    const reserved = items.slice(0, 5);
    let failed = items.filter((c) => !succeeded.has(c));
    const spare = failed.filter((c) => !reserved.includes(c));
    const left = spare.length ? r.pick(spare) : null;
    const round2 = failed.filter((c) => c !== left);
    const force2 = {};
    if (level === 1) {
      submit(round2, "ended", { force: force2 });
    } else {
      round2.push(items[0]);                                            // already succeeded: resubmitted by mistake
      force2[items[0]] = "succeeded";
      if (level === 3) {
        round2.push(items[2]);                                          // succeeded, then failed on resubmission
        Object.assign(force2, { [items[2]]: F(), [items[1]]: F(), [items[4]]: F() });
      }
      // Two batches created in the same second; items[3] sits in both and succeeds in
      // both, so batch_id decides which success came first.
      const both = items[3];
      const rest = round2.filter((c) => c !== both);
      const fa = { ...force2, [both]: "succeeded" };
      submit([both, ...rest.filter((_, i) => i % 2 === 0)], "ended", { force: fa });
      submit([both, ...rest.filter((_, i) => i % 2 === 1)], "ended", { force: fa, at });
    }

    // Round 3 (levels 2 and 3): whatever is still failed. At level 3 one batch ended
    // without exporting its result, and the last batch is still in progress.
    if (level >= 2) {
      at += r.int(4, 20) * 600;
      failed = items.filter((c) => !succeeded.has(c) && c !== left);
      if (level === 3) {
        submit([items[4]], "ended", { lose: [items[4]] });
        at += 60;
        submit(failed.filter((c) => c !== items[4]), "in_progress");
      } else if (failed.length) submit(failed, "ended", { pOk: 0.5 });
    }
  });

  // Oracle, parameterised so each diagnostic breaks one rule.
  const bById = new Map(batches.map((b) => [b.id, b]));
  const order = (x, y) => x.at - y.at || cmp(x.id, y.id);
  const compute = (o = {}) => {
    const out = [];
    for (const job of jobs) {
      const reqs = requests.filter((q) => bById.get(q.batch).job === job);
      const byItem = new Map();
      for (const q of reqs) {
        const res = results.find((x) => x.batch === q.batch && x.custom === q.custom) || null;
        if (o.innerJoin && !res) continue;
        if (!byItem.has(q.custom)) byItem.set(q.custom, []);
        byItem.get(q.custom).push({ b: bById.get(q.batch), res });
      }
      let items = o.rowsNotItems ? [...byItem.values()].reduce((s, a) => s + a.length, 0) : byItem.size;
      let succ = 0, retry = 0, missing = 0, inflight = 0, dup = 0, wasted = 0;
      for (const atts of byItem.values()) {
        atts.sort((x, y) => order(x.b, y.b));
        const wins = atts.filter((a) => a.res && a.res.type === "succeeded");
        const latest = atts[atts.length - 1];
        const isSucc = o.latestOnly ? !!(latest.res && latest.res.type === "succeeded") : wins.length > 0;
        if (isSucc) succ++;
        else if (latest.b.status !== "ended") { if (o.inFlightAsMissing) missing++; else inflight++; }
        else if (!latest.res) missing++;
        else retry++;
        if (wins.length > 1) {
          dup++;
          wasted += wins.slice(o.wastedAll ? 0 : 1).reduce((s, a) => s + a.res.out, 0);
        } else if (o.wastedAll && wins.length === 1) { /* not wasted: one success */ }
      }
      out.push([job, items, succ, retry, missing, inflight, dup, wasted]);
    }
    return out;
  };
  const expected = compute();

  const diagnostics = [
    { message: "Items were counted per request row. An item resubmitted in three batches is still one item: count DISTINCT custom_id per job.", rows: compute({ rowsNotItems: true }) },
  ];
  if (level >= 2) diagnostics.push({ message: "wasted_output_tokens included the first success. Only successes after an item's first one (by created_at, then batch_id) are wasted.", rows: compute({ wastedAll: true }) });
  if (level === 3) {
    diagnostics.push({ message: "Items were classified by their latest attempt only. An item that succeeded once is succeeded, even if a later resubmission failed.", rows: compute({ latestOnly: true }) });
    diagnostics.push({ message: "Requests were inner-joined to results, so items with no result at all vanished. Start from batch_requests and LEFT JOIN batch_results.", rows: compute({ innerJoin: true }) });
    diagnostics.push({ message: "Items in a batch that is still in progress were counted as missing. Results do not exist until a batch has ended: those items are in flight.", rows: compute({ inFlightAsMissing: true }) });
  }

  const bRows = batches.slice().sort((x, y) => cmp(x.job, y.job) || order(x, y)).map((b) => [b.id, b.job, ts(day, b.at), b.status]);
  const qRows = requests.map((q) => [q.batch, q.custom]).sort((x, y) => cmp(x[0], y[0]) || cmp(x[1], y[1]));
  const resRows = results.map((x) => [x.batch, x.custom, x.type, x.out]).sort((x, y) => cmp(x[0], y[0]) || cmp(x[1], y[1]));
  const bCols = ["batch_id", "job_id", "created_at", "processing_status"];
  const qCols = ["batch_id", "custom_id"];
  const resCols = ["batch_id", "custom_id", "result_type", "output_tokens"];

  const setup =
    "SET TIME ZONE 'UTC';\n" +
    "CREATE TABLE batches (\n  batch_id TEXT PRIMARY KEY,\n  job_id TEXT NOT NULL,\n  created_at TIMESTAMPTZ NOT NULL,\n  processing_status TEXT NOT NULL CHECK (processing_status IN ('in_progress','ended'))\n);\n" +
    "CREATE TABLE batch_requests (\n  batch_id TEXT NOT NULL REFERENCES batches,\n  custom_id TEXT NOT NULL,\n  PRIMARY KEY (batch_id, custom_id)\n);\n" +
    "CREATE TABLE batch_results (\n  batch_id TEXT NOT NULL,\n  custom_id TEXT NOT NULL,\n  result_type TEXT NOT NULL CHECK (result_type IN ('succeeded','errored','canceled','expired')),\n  output_tokens INT,\n  PRIMARY KEY (batch_id, custom_id),\n  FOREIGN KEY (batch_id, custom_id) REFERENCES batch_requests\n);\n" +
    insertSQL("batches", bCols, bRows) + insertSQL("batch_requests", qCols, qRows) + insertSQL("batch_results", resCols, resRows);

  return {
    vars: {
      n_batches: batches.length,
      n_requests: requests.length,
      status_rule: level === 3
        ? "Some batches are still `in_progress` (they have no results yet), and an ended batch can be missing a result row."
        : "Every batch in this sample has ended, and every request in an ended batch has a result row.",
    },
    setup,
    tables: [
      { name: "batches", columns: bCols, rows: bRows },
      { name: "batch_requests", columns: qCols, rows: qRows },
      { name: "batch_results", columns: resCols, rows: resRows },
    ],
    expected: { columns: ["job_id", "items", "succeeded", "retry", "missing", "in_flight", "duplicate_successes", "wasted_output_tokens"], rows: expected },
    diagnostics: diagnostics.filter((d) => JSON.stringify(d.rows) !== JSON.stringify(expected)),
  };
}

const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
