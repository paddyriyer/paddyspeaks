/* OAI-L1-02 — Hourly p95 latency regressions per model family (SQL).
   Simulated practice scenario. All data is generated from the seed.

   generate(r, level) -> { vars, setup, tables, expected, diagnostics }   (see OAI-L1-01.mjs)
   level: 1 Medium   every family has traffic every hour of the report
          2 Hard     + a family-hour with no traffic (the hour grid must supply it,
                       and the hour after it has no previous hour to compare with)
          3 Very Hard + an hour where every request failed (no p95) and traffic in the
                       hour BEFORE the report, which is the first report hour's baseline

   The oracle mirrors PostgreSQL's percentile_cont exactly (same double arithmetic:
   pos = 0.95 * (n - 1), lerp between floor and ceil). Regression thresholds are
   25 / 50 / 75 %, so the multiplier (1.25, 1.5, 1.75) is exact in binary and the
   planted "exactly X %" hour is decided without rounding noise. */
import { insertSQL, ts } from "../../js/rng.js";

export const kind = "sql";

const FAMILIES = ["chat-large", "chat-small", "embedding", "reasoning", "vision", "audio"];
const REGIONS = ["us-east", "us-west", "eu-west", "ap-south"];
const DAYS = ["2026-09-14", "2026-09-21", "2026-10-02"];

function percentileCont(sorted, p) {             // PostgreSQL percentile_cont, same float ops
  const n = sorted.length;
  if (!n) return null;
  const pos = p * (n - 1);
  const lo = Math.floor(pos), hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}
function percentileDisc(sorted, p) {                    // PostgreSQL percentile_disc
  const n = sorted.length;
  if (!n) return null;
  const k = Math.max(1, Math.ceil(p * n));
  return sorted[k - 1];
}

export function generate(r, level) {
  const pct = r.pick([25, 50, 75]);
  const mult = 1 + pct / 100;
  const nFam = level === 1 ? 2 : level === 2 ? 3 : 4;
  const fams = r.sample(FAMILIES, nFam).sort();
  const H = level === 1 ? 4 : 5;                         // report hours
  const startHour = r.int(6, 14);
  const day = r.pick(DAYS);
  const firstIdx = level === 3 ? -1 : 0;                 // L3: traffic in the hour before the report

  // Plan the special family-hours, one kind per family (fams shuffled for roles).
  const roles = r.shuffle(fams);
  const plan = new Map(fams.map((f) => [f, {}]));
  const regFam = roles[0];
  plan.get(regFam)[level === 3 ? 0 : r.int(1, H - 1)] = "regress";
  const bFam = roles[1];
  const bj = r.int(1, H - 1);
  plan.get(bFam)[bj - 1] = "pre";
  plan.get(bFam)[bj] = "boundary";
  if (level >= 2) {
    const g = r.int(1, H - 2);
    plan.get(roles[2])[g] = "gap";
    plan.get(roles[2])[g + 1] = "after";
  }
  if (level === 3) {
    const a = r.int(1, H - 2);
    plan.get(roles[3])[a] = "allerr";
    plan.get(roles[3])[a + 1] = "after";
    if (r.chance(0.5)) plan.get(regFam)[r.int(2, H - 1)] = "regress";   // a second, ordinary regression
  }

  const events = [];
  const okRange = level === 1 ? [10, 16] : level === 2 ? [8, 16] : [6, 16];
  for (const f of fams) {
    let levelV = r.int(30, 220) * 10;                    // the family's typical p95, ms
    let prev = null;                                     // actual p95 of the previous hour (null: none)
    let lastKnown = null;                                // last hour that had a p95
    for (let h = firstIdx; h < H; h++) {
      const kind2 = plan.get(f)[h] || "normal";
      const hour = startHour + h;
      if (kind2 === "gap") { prev = null; continue; }
      if (kind2 === "allerr") {
        const n = r.int(2, 4);
        for (let i = 0; i < n; i++) events.push(errEvent(r, f, hour, i === 0 ? 0 : r.int(0, 3599)));
        prev = null;
        continue;
      }
      let V, d = 0;
      if (kind2 === "regress") V = Math.ceil(prev * (mult + r.pick([0.15, 0.3, 0.6])));
      else if (kind2 === "after") V = Math.ceil(lastKnown * (mult + r.pick([0.15, 0.3, 0.6])));
      else if (kind2 === "pre") V = Math.max(4, Math.round((levelV * (0.93 + 0.14 * r.next())) / 4) * 4);
      else if (kind2 === "boundary") V = prev * mult;   // prev is a multiple of 4, so this is an integer
      else { V = Math.max(40, Math.round(levelV * (0.93 + 0.14 * r.next()))); d = r.int(0, Math.floor(V * 0.03)); }
      const nOk = r.int(okRange[0], okRange[1]);
      const lats = groupLatencies(r, nOk, V, d);
      for (let i = 0; i < nOk; i++) {
        const sec = i === 0 && r.chance(0.3) ? 0 : i === 1 && r.chance(0.3) ? 3599 : r.int(0, 3599);
        events.push({ fam: f, hour, sec, status: "ok", lat: lats[i], region: r.pick(REGIONS) });
      }
      const nErr = level === 1 ? (r.chance(0.6) ? r.int(1, 2) : 0) : r.int(0, 2);
      for (let i = 0; i < nErr; i++) events.push(errEvent(r, f, hour, r.int(0, 3599)));
      const sorted = lats.slice().sort((a, b) => a - b);
      prev = percentileCont(sorted, 0.95);
      lastKnown = prev;
      levelV = V;
    }
  }
  // At least one error somewhere, so "errors are not latency samples" always matters.
  if (!events.some((e) => e.status !== "ok")) events.push(errEvent(r, fams[0], startHour, r.int(0, 3599)));

  events.sort((a, b) => a.hour - b.hour || a.sec - b.sec || (a.fam < b.fam ? -1 : a.fam > b.fam ? 1 : 0) || a.lat - b.lat);
  let id = 40000 + r.int(0, 50000);
  for (const e of events) e.request_id = "req_" + (id += r.int(1, 7));

  // ---- Oracle -------------------------------------------------------------
  const compute = (o = {}) => {
    const cells = new Map();                             // fam|h -> {requests, errors, ok:[]}
    for (const e of events) {
      const h = e.hour - startHour;
      if (o.filterFirst && h < 0) continue;
      const k = e.fam + "|" + h;
      if (!cells.has(k)) cells.set(k, { requests: 0, errors: 0, ok: [], all: [] });
      const c = cells.get(k);
      if (o.okOnly && e.status !== "ok") continue;
      c.requests += 1;
      c.all.push(e.lat);
      if (e.status === "ok") c.ok.push(e.lat); else c.errors += 1;
    }
    const out = [];
    for (const f of fams) {
      let series = [];
      for (let h = firstIdx; h < H; h++) {
        const c = cells.get(f + "|" + h);
        const vals = (c ? (o.withErrors ? c.all : c.ok) : []).slice().sort((a, b) => a - b);
        const p95 = o.disc ? percentileDisc(vals, 0.95) : percentileCont(vals, 0.95);
        series.push({ h, requests: c ? c.requests : 0, error_rate: c && c.requests ? c.errors / c.requests : null, p95 });
      }
      if (o.noGrid) series = series.filter((s) => s.requests > 0);
      if (o.filterFirst) series = series.filter((s) => s.h >= 0);
      for (let i = 0; i < series.length; i++) {
        const s = series[i];
        if (s.h < 0) continue;
        const p = i > 0 && (o.noGrid || series[i - 1].h === s.h - 1) ? series[i - 1].p95 : null;
        const reg = s.p95 !== null && p !== null && (o.inclusive ? s.p95 >= p * mult : s.p95 > p * mult);
        out.push([s.h, f, s.requests, s.error_rate, s.p95, p, reg]);
      }
    }
    out.sort((a, b) => a[0] - b[0] || (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0));
    return out.map(([h, f, ...rest]) => [ts(day, (startHour + h) * 3600), f, ...rest]);
  };
  const rows = compute();

  const diagnostics = [
    { message: "Failed requests were treated as latency samples. A timeout's duration is not a model's serving latency: compute p95 over status = 'ok' only, and count failures only in error_rate.", rows: compute({ withErrors: true }) },
    { message: "Failed requests were filtered out before aggregating, so `requests` and `error_rate` only see successful calls. Filter inside the p95 (FILTER (WHERE status = 'ok')), not in WHERE.", rows: compute({ okOnly: true }) },
    { message: "percentile_disc returns an observed value; this report asks for percentile_cont, which interpolates between the two values either side of the 95th percentile.", rows: compute({ disc: true }) },
    { message: `The threshold is strict: a p95 exactly ${pct}% above the previous hour is not a regression. Use >, not >=.`, rows: compute({ inclusive: true }) },
  ];
  if (level >= 2) diagnostics.push({ message: "Hours with no traffic are missing from the report, and LAG compared some hours with an earlier hour that is not the immediately preceding one. Build an hour grid (generate_series × model_families), LEFT JOIN the hourly stats to it, then apply LAG.", rows: compute({ noGrid: true }) });
  if (level === 3) diagnostics.push({ message: "The events were restricted to the report window before LAG ran, so the first report hour lost its baseline. Compute LAG over the hour before the window too, then filter the output rows.", rows: compute({ filterFirst: true }) });

  const evCols = ["request_id", "model_family", "region", "event_ts", "status", "latency_ms"];
  const evRows = events.map((e) => [e.request_id, e.fam, e.region, ts(day, e.hour * 3600 + e.sec), e.status, e.lat]);
  const famCols = ["model_family"];
  const famRows = fams.map((f) => [f]);
  const setup =
    "SET TIME ZONE 'UTC';\n" +
    "CREATE TABLE model_families (\n  model_family TEXT PRIMARY KEY\n);\n" +
    "CREATE TABLE inference_events (\n  request_id TEXT PRIMARY KEY,\n  model_family TEXT NOT NULL REFERENCES model_families,\n  region TEXT NOT NULL,\n  event_ts TIMESTAMPTZ NOT NULL,\n  status TEXT NOT NULL CHECK (status IN ('ok','error','timeout')),\n  latency_ms INT NOT NULL\n);\n" +
    insertSQL("model_families", famCols, famRows) + insertSQL("inference_events", evCols, evRows);

  const start = ts(day, startHour * 3600), end = ts(day, (startHour + H - 1) * 3600);
  return {
    vars: {
      pct,
      start,
      end,
      hours: H,
      events: events.length,
      gaps: level === 1
        ? "In this sample every family has traffic in every report hour."
        : "A family can have an hour with no traffic at all: it still gets a row (requests 0, the other measures NULL), and the hour after it has no previous hour to compare with.",
      baseline: level === 3
        ? "The table also holds traffic from the hour before the report. Do not report that hour, but it is the previous hour for the first report hour. An hour in which every request failed has no p95."
        : "The first report hour has no previous hour in the data, so it is never a regression.",
    },
    setup,
    tables: [
      { name: "model_families", columns: famCols, rows: famRows },
      { name: "inference_events", columns: evCols, rows: evRows },
    ],
    expected: { columns: ["hour_start", "model_family", "requests", "error_rate", "p95_ms", "prev_p95_ms", "regressed"], rows },
    diagnostics: diagnostics.filter((d) => JSON.stringify(d.rows) !== JSON.stringify(rows)),
  };
}

// Latencies for one family-hour whose percentile_cont(0.95) is exactly V + d * frac:
// the two order statistics either side of position 0.95 * (n - 1) are V and V + d.
function groupLatencies(r, n, V, d) {
  const pos = 0.95 * (n - 1);
  const lo = Math.floor(pos), hi = Math.ceil(pos);
  const vals = [];
  for (let i = 0; i < n; i++) {
    if (i < lo) vals.push(r.int(Math.round(V * 0.25), Math.round(V * 0.85)));
    else if (i === lo) vals.push(V);
    else if (i === hi) vals.push(V + d);
    else vals.push(r.int(V + d, V + d + Math.round(V * 0.8)));
  }
  return r.shuffle(vals);
}

function errEvent(r, fam, hour, sec) {
  const timeout = r.chance(0.5);
  return { fam, hour, sec, status: timeout ? "timeout" : "error", lat: timeout ? r.pick([30000, 60000]) : r.int(3, 80), region: r.pick(REGIONS) };
}
