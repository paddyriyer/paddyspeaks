/* DBX-L3-05 — Data quality expectations: failing rows, quarantined rows and the run-over-run
   trend per pipeline update (SQL). Simulated practice scenario. All data, names and counts are
   generated from the seed and are hypothetical.

   One deterministic result set: one row per COMPLETED update of each dataset, carrying
     rows_in            rows the update read (from pipeline_updates);
     failing_rows       distinct records with at least one failed expectation in that update;
     quarantined_rows   distinct records with at least one failed expectation whose action, in
                        the version in force when the update STARTED, is 'drop';
     failure_pct        ROUND(100 * failing_rows / rows_in, 2);
     prev_failure_pct   failure_pct of the dataset's previous COMPLETED update (by started_at);
     change_pts         failure_pct - prev_failure_pct (NULL for the first completed update).
   level: 1 Medium (one version per expectation; COMPLETED and FAILED updates; a clean update
                    with no failures; records failing several expectations)
          2 Hard (+ actions that change over time, one exactly at an update's started_at;
                  an expectation added later; CANCELED updates)
          3 Very Hard (+ an at-least-once event log with redelivered failures; a version that
                       takes effect while an update is running; a RUNNING update) */
import { insertSQL, ts } from "../../js/rng.js";

export const kind = "sql";

const M = 60, H = 3600;
const BASE = Date.UTC(2026, 8, 21) / 1000;                       // 2026-09-21 00:00 UTC
const DATASETS = ["silver.ad_clicks", "silver.app_sessions", "silver.cart_events", "silver.checkout_events",
  "silver.page_views", "silver.search_queries"];
const EXPECTATIONS = ["known_device_type", "known_event_type", "non_negative_duration", "non_null_user_id",
  "session_id_format", "url_not_empty", "valid_country_code", "valid_event_ts"];
const FAIL_EXP = "supported_schema_version";

function stamp(sec) {
  const day = new Date((BASE + sec) * 1000).toISOString().slice(0, 10);
  return ts(day, ((sec % 86400) + 86400) % 86400);
}

export function generate(r, level) {
  const nDs = level === 1 ? 2 : 3;
  const dsNames = r.sample(DATASETS, nDs).sort();
  const datasets = dsNames.map((name, di) => {
    const k = level === 1 ? 3 : level === 2 ? r.int(3, 4) : 4;
    const exps = r.sample(EXPECTATIONS, k + (level >= 2 ? 1 : 0));  // last one may be added later (L2+)
    const ds = { name, di, exps: exps.slice(0, k), late: level >= 2 ? exps[k] : null, versions: [], runs: [] };
    // Initial actions: at least one warn and one drop.
    const acts = ds.exps.map((e, i) => (i === 0 ? "warn" : i === 1 ? "drop" : r.pick(["warn", "drop"])));
    ds.exps.forEach((e, i) => ds.versions.push({ exp: e, action: acts[i], eff: -r.int(3, 9) * 86400 - r.int(0, 86399) }));
    ds.hasFail = di === 0 || r.chance(0.4);
    if (ds.hasFail) ds.versions.push({ exp: FAIL_EXP, action: "fail", eff: -r.int(10, 20) * 86400 });
    return ds;
  });

  // Updates: per dataset, spaced hours apart; statuses with forced patterns.
  for (const ds of datasets) {
    const n = level === 1 ? r.int(4, 5) : level === 2 ? r.int(5, 6) : r.int(5, 7);
    let t = ds.di * 7 * M + r.int(1 * H, 3 * H);
    for (let i = 0; i < n; i++) {
      const dur = r.int(12, 45) * M;
      ds.runs.push({ ds, start: t, end: t + dur, status: "COMPLETED", rowsIn: r.int(40, level === 3 ? 600 : 300), fails: [] });
      t += dur + r.int(2 * H, 6 * H);
    }
    // statuses: first and last-but-one stay completed so every dataset has >= 2 completed
    for (let i = 1; i < n; i++) {
      if (i === n - 2) continue;
      const roll = r.next();
      if (roll < 0.25) ds.runs[i].status = "FAILED";
      else if (level >= 2 && roll < 0.4) ds.runs[i].status = "CANCELED";
    }
    if (ds.di === 0) ds.runs[1].status = "FAILED";                  // a failure between two completed updates
  }
  if (level >= 2) {
    const ds = r.pick(datasets.slice(1));
    const i = ds.runs.findIndex((x, j) => j > 0 && j !== ds.runs.length - 2 && x.status === "COMPLETED");
    if (i > 0) ds.runs[i].status = "CANCELED";
  }
  if (level === 3) {
    const ds = r.pick(datasets);
    const last = ds.runs[ds.runs.length - 1];
    last.status = "RUNNING";
  }
  const done = (ds) => ds.runs.filter((x) => x.status === "COMPLETED");

  // Version changes (L2+).
  const actionAt = (ds, exp, t, strict = false) => {
    let best = null;
    for (const v of ds.versions) {
      if (v.exp !== exp) continue;
      if (strict ? v.eff < t : v.eff <= t) if (!best || v.eff > best.eff) best = v;
    }
    return best ? best.action : null;
  };
  const forced = [];                                                // [run, exp, eff?]: a record failing only exp
  if (level >= 2) {
    for (const ds of datasets) {
      const comp = done(ds);
      // A flip exactly at a completed update's start (dataset 0 always, others by chance).
      if (ds.di === 0 || r.chance(0.5)) {
        const run = comp[r.int(1, comp.length - 1)];
        const exp = r.pick(ds.exps);
        const cur = actionAt(ds, exp, run.start);
        ds.versions.push({ exp, action: cur === "warn" ? "drop" : "warn", eff: run.start });
        forced.push([run, exp]);
        if (ds.di === 0) forced.push([comp[0], exp]);              // and before the change, under the old action
      }
      // The late expectation: added at a completed update's start or between updates.
      const k = r.int(1, ds.runs.length - 1);
      const run = ds.runs[k];
      const eff = r.chance(0.5) ? run.start : run.start - r.int(10 * M, 90 * M);
      ds.versions.push({ exp: ds.late, action: r.pick(["warn", "drop"]), eff });
      ds.exps.push(ds.late);
    }
  }
  if (level === 3) {
    // A version that takes effect while a completed update is running.
    const ds = r.pick(datasets);
    const comp = done(ds).filter((x) => x.end - x.start >= 20 * M);
    const run = comp.length ? r.pick(comp) : done(ds)[0];
    const exp = r.pick(ds.exps.filter((e) => actionAt(ds, e, run.start) !== null));
    const cur = actionAt(ds, exp, run.start);
    const eff = run.start + r.int(3 * M, Math.floor((run.end - run.start) / 2));
    ds.versions.push({ exp, action: cur === "warn" ? "drop" : "warn", eff });
    run.midFlip = { exp, eff };
    forced.push([run, exp, eff]);
  }

  // Failures.
  const recId = (n) => "r" + String(n).padStart(5, "0");
  for (const ds of datasets) {
    const comp = done(ds).filter((x) => !forced.some((f) => f[0] === x));
    const clean = comp.length && (ds.di === 0 || r.chance(0.3)) ? r.pick(comp) : null;
    for (const run of ds.runs) {
      run.used = new Set();
      if (run === clean) continue;
      const live = ds.exps.filter((e) => actionAt(ds, e, run.start) !== null);
      const recordNo = () => {
        let x;
        do x = r.int(1, run.rowsIn); while (run.used.has(x));
        run.used.add(x);
        return x;
      };
      const addRec = (exps) => {
        const rec = recId(recordNo());
        for (const e of exps) run.fails.push({ rec, exp: e, at: r.int(run.start + 30, run.end - 30) });
      };
      const k = r.int(2, level === 3 ? 10 : 8);
      for (let j = 0; j < k; j++) addRec(r.sample(live, r.int(1, Math.min(level === 1 ? 2 : 3, live.length))));
      // One record failing a warn and a drop expectation at once.
      const w = live.filter((e) => actionAt(ds, e, run.start) === "warn");
      const d = live.filter((e) => actionAt(ds, e, run.start) === "drop");
      if (w.length && d.length && r.chance(0.6)) addRec([r.pick(w), r.pick(d)]);
      if (run.status === "FAILED" && ds.hasFail) addRec([FAIL_EXP]);
    }
  }
  // Forced records that fail only the expectation whose version changed (at start, or mid-update).
  for (const [run, exp, eff] of forced) {
    let n = run.rowsIn;
    while (run.used.has(n)) n--;
    run.used.add(n);
    const lo = eff === undefined ? run.start + 30 : eff + 1;
    run.fails.push({ rec: recId(n), exp, at: r.int(lo, run.end - 30) });
  }

  // Ids in start order.
  const allRuns = datasets.flatMap((ds) => ds.runs).sort((a, b) => a.start - b.start || a.ds.di - b.ds.di);
  let uid = 4000 + r.int(0, 3000);
  for (const run of allRuns) run.id = "upd_" + uid++;

  // Event-log rows (with redeliveries at level 3).
  const logRows = [];
  for (const run of allRuns) {
    for (const f of run.fails) {
      logRows.push({ run, rec: f.rec, exp: f.exp, at: f.at });
      if (level === 3 && r.chance(0.15)) logRows.push({ run, rec: f.rec, exp: f.exp, at: f.at + r.int(5, 900) });
    }
  }
  if (level === 3) {                                                // at least one redelivery in a completed update
    const cand = logRows.filter((x) => x.run.status === "COMPLETED");
    const x = r.pick(cand);
    logRows.push({ ...x, at: x.at + r.int(5, 900) });
  }
  logRows.sort((a, b) => a.at - b.at || (a.run.id < b.run.id ? -1 : a.run.id > b.run.id ? 1 : 0) || (a.rec < b.rec ? -1 : a.rec > b.rec ? 1 : 0) || (a.exp < b.exp ? -1 : a.exp > b.exp ? 1 : 0));

  // The oracle. opts break one rule each, for diagnostics.
  const compute = (opts = {}) => {
    const out = [];
    for (const ds of datasets) {
      const runs = ds.runs.filter((x) => opts.includeAll || x.status === "COMPLETED");
      const stats = new Map();
      const statOf = (run) => {
        if (stats.has(run)) return stats.get(run);
        const rows = logRows.filter((x) => x.run === run);
        const seen = new Map();                                     // rec|exp -> first logged_at
        for (const x of rows) {
          const k = x.rec + "|" + x.exp;
          if (!seen.has(k) || x.at < seen.get(k)) seen.set(k, x.at);
        }
        const failing = new Set(), quarantined = new Set();
        for (const [k, at] of seen) {
          const [rec, exp] = k.split("|");
          failing.add(rec);
          let action;
          if (opts.ignoreAction) action = "drop";
          else if (opts.currentAction) action = actionAt(ds, exp, Infinity);
          else if (opts.byLogged) action = actionAt(ds, exp, at);
          else action = actionAt(ds, exp, run.start, opts.strictEff);
          if (action === "drop") quarantined.add(rec);
        }
        const nFail = opts.countRows ? rows.length : opts.countPairs ? seen.size : failing.size;
        const hund = Math.floor((20000 * nFail + run.rowsIn) / (2 * run.rowsIn));
        const s = { nFail, nQ: quarantined.size, hund };
        stats.set(run, s);
        return s;
      };
      let prev = null;
      for (const run of runs) {
        const s = statOf(run);
        if (opts.dropClean && s.nFail === 0) continue;
        let p = prev;
        if (opts.prevAny) {
          const i = ds.runs.indexOf(run);
          p = i > 0 ? statOf(ds.runs[i - 1]).hund : null;
        }
        out.push([ds.name, run.id, run.rowsIn, s.nFail, s.nQ, s.hund / 100, p === null ? null : p / 100, p === null ? null : (s.hund - p) / 100]);
        prev = s.hund;
      }
    }
    return out;
  };
  const expected = compute();

  const diagnostics = [
    { message: "failing_rows counts failed checks, not records. A record that fails two expectations is one failing row: count DISTINCT record_id per update.", rows: compute({ countRows: true }) },
    { message: "Every failing record was counted as quarantined. Only a record that fails at least one expectation whose action is 'drop' is quarantined; a 'warn' expectation keeps the row and only records the failure.", rows: compute({ ignoreAction: true }) },
    { message: "Updates that did not complete were reported. Only COMPLETED updates are rows of the report, and only they can be the previous update in the trend.", rows: compute({ includeAll: true }) },
    { message: "The previous update was taken over every update, not only completed ones. A failed or cancelled update wrote nothing; the trend compares each completed update with the dataset's previous completed update (filter before LAG, not after).", rows: compute({ prevAny: true }) },
    { message: "An update with no failed expectations is missing. Start from the updates and LEFT JOIN the failures, so a clean update appears with 0 failing rows and a failure_pct of 0.", rows: compute({ dropClean: true }) },
  ];
  if (level >= 2) {
    diagnostics.push(
      { message: "The current action was used for every update. An expectation's action changes over time; an update uses the version in force when it started (the latest effective_from at or before started_at).", rows: compute({ currentAction: true }) },
      { message: "A version that took effect exactly at an update's started_at was ignored. effective_from at or before started_at is in force.", rows: compute({ strictEff: true }) },
    );
  }
  if (level === 3) {
    diagnostics.push(
      { message: "Redelivered failures were counted as different checks. The event log is at least once: count each (update_id, record_id, expectation) once.", rows: compute({ countPairs: true }) },
      { message: "The action was looked up at logged_at. A version that takes effect while an update is running does not apply to that update: it uses the version in force at started_at.", rows: compute({ byLogged: true }) },
    );
  }

  const uCols = ["update_id", "dataset", "status", "started_at", "ended_at", "rows_in"];
  const vCols = ["dataset", "expectation", "action", "effective_from"];
  const fCols = ["update_id", "record_id", "expectation", "logged_at"];
  const uRows = allRuns.map((x) => [x.id, x.ds.name, x.status, stamp(x.start), x.status === "RUNNING" ? null : stamp(x.end), x.rowsIn]);
  const vRows = datasets.flatMap((ds) => ds.versions.map((v) => [ds.name, v.exp, v.action, stamp(v.eff)]))
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : a[3] < b[3] ? -1 : 1));
  const fRows = logRows.map((x) => [x.run.id, x.rec, x.exp, stamp(x.at)]);

  const setup =
    "SET TIME ZONE 'UTC';\n" +
    "CREATE TABLE pipeline_updates (\n  update_id TEXT PRIMARY KEY,\n  dataset TEXT NOT NULL,\n  status TEXT NOT NULL CHECK (status IN ('COMPLETED','FAILED','CANCELED','RUNNING')),\n  started_at TIMESTAMPTZ NOT NULL,\n  ended_at TIMESTAMPTZ,\n  rows_in INT NOT NULL CHECK (rows_in > 0),\n  UNIQUE (dataset, started_at)\n);\n" +
    "CREATE TABLE expectation_versions (\n  dataset TEXT NOT NULL,\n  expectation TEXT NOT NULL,\n  action TEXT NOT NULL CHECK (action IN ('warn','drop','fail')),\n  effective_from TIMESTAMPTZ NOT NULL,\n  PRIMARY KEY (dataset, expectation, effective_from)\n);\n" +
    "CREATE TABLE expectation_failures (\n  update_id TEXT NOT NULL REFERENCES pipeline_updates (update_id),\n  record_id TEXT NOT NULL,\n  expectation TEXT NOT NULL,\n  logged_at TIMESTAMPTZ NOT NULL\n);\n" +
    insertSQL("pipeline_updates", uCols, uRows) + insertSQL("expectation_versions", vCols, vRows) + insertSQL("expectation_failures", fCols, fRows);

  return {
    vars: {
      updates: uRows.length,
      failures: fRows.length,
      versions: vRows.length,
      status_rule: level === 1
        ? "An update ends `COMPLETED` or `FAILED`."
        : level === 2
          ? "An update ends `COMPLETED`, `FAILED` or `CANCELED`."
          : "An update ends `COMPLETED`, `FAILED` or `CANCELED`; one that is still `RUNNING` has read rows but has not finished.",
      version_rule: level === 1
        ? "Each expectation has one row in `expectation_versions`: its action has never changed."
        : level === 2
          ? "An expectation's action can change, and an expectation can be added after the first updates; every change is a new row in `expectation_versions`. An update applies, for each expectation, the version with the latest `effective_from` at or before the update's `started_at`."
          : "An expectation's action can change, and an expectation can be added after the first updates; every change is a new row in `expectation_versions`. An update applies, for each expectation, the version with the latest `effective_from` at or before the update's `started_at`, for the whole update, even when a new version takes effect while it is running.",
      log_rule: level === 3
        ? "The event log is delivered at least once: the same (update_id, record_id, expectation) can appear again with a later `logged_at`, and counts once."
        : "Each failed check appears once in `expectation_failures`.",
    },
    setup,
    tables: [
      { name: "pipeline_updates", columns: uCols, rows: uRows },
      { name: "expectation_versions", columns: vCols, rows: vRows },
      { name: "expectation_failures", columns: fCols, rows: fRows },
    ],
    expected: { columns: ["dataset", "update_id", "rows_in", "failing_rows", "quarantined_rows", "failure_pct", "prev_failure_pct", "change_pts"], rows: expected },
    diagnostics: diagnostics.filter((d) => JSON.stringify(d.rows) !== JSON.stringify(expected)),
  };
}
