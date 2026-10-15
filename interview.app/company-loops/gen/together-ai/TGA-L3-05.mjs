/* TGA-L3-05 — Calls after deprecation: per tenant, deprecated model version and week, the
   requests made after the deprecation date in force, the replacement calls that week, and the
   day the tenant first called the named replacement (SQL).
   Simulated practice scenario. Model families, versions, tenants, notices and requests are
   generated from the seed and are hypothetical; the deprecation rules are this exercise's rules,
   and nothing here describes a real tenant, model or catalogue.

   Rules (every request is a UTC timestamp; only deployment = 'serverless' counts anywhere):
     notice in force   for a request to version v at time t: v's deprecation notice with the
                       highest notice_no whose announced_at <= t (none: the call is not late).
     late call         a serverless request (any status) to v with requested_at at or after
                       00:00 UTC on the notice-in-force's deprecates_on.
     week_start        the Monday (UTC) of the late call's week.
     replacement_calls the tenant's serverless requests with status 'ok' to v's named
                       replacement in that same week.
     first_replacement_on  the UTC date of the tenant's earliest serverless 'ok' request to the
                       named replacement, at any time in the data (NULL when there is none).
   One row per (tenant_id, version_id, week_start) with at least one late call, ordered by
   tenant_id, version_id, week_start.
   level: 1 Medium (two deprecated versions, one notice each, all requests 'ok', dedicated
                    requests to leave out, calls at exactly 00:00 on the deprecation day and one
                    second before, Sunday calls, tenants who migrated early, late or never)
          2 Hard (+ a third deprecated version, error statuses: an error still counts as a late
                  call but never as a replacement call, including a tenant whose earliest
                  replacement call failed)
          3 Very Hard (+ a replacement that is itself deprecated later, and second notices:
                       one postponing a date before it arrived, one extending a date that had
                       already passed, so a call is judged by the notice in force when it was
                       made) */
import { insertSQL, ts } from "../../js/rng.js";

export const kind = "sql";

const D = 86400;
const FAMILIES = ["chat-small", "chat-large", "code-medium", "instruct-mini", "vision-chat", "reason-large", "embed-base", "summarise-mid"];

export function generate(r, level) {
  // The data starts on a Monday in 2026 and runs for whole weeks.
  const S = Date.UTC(2026, 0, 5) / 1000 + r.int(0, 30) * 7 * D;            // 2026-01-05 is a Monday
  const weeks = level === 1 ? 6 : level === 2 ? 7 : 9;
  const L = weeks * 7;
  const dayStr = (d) => new Date((S + d * D) * 1000).toISOString().slice(0, 10);
  const stamp = (sec) => { const d = Math.floor(sec / D); return ts(dayStr(d), sec - d * D); };

  // ---- Model versions and deprecation notices.
  const nDep = level === 1 ? 2 : level === 2 ? 3 : r.int(3, 4);
  const fams = r.sample(FAMILIES, 6);
  const versions = [];                                                      // {id, family, released}
  const deps = [];                                                          // deprecated versions
  const addVersion = (fam, k) => {
    const id = `${fam}-v${k}`;
    let v = versions.find((x) => x.id === id);
    if (!v) { v = { id, family: fam, released: -r.int(30, 400) + k }; versions.push(v); }
    return v;
  };
  const famUsed = [];
  for (let i = 0; i < nDep; i++) {
    if (level === 3 && i === nDep - 1) {
      // A chain: the first deprecated version's replacement is itself deprecated later.
      const first = deps[0];
      const fam = first.family, k = first.k + 1;
      const d1 = Math.min(L - 12, first.notices[0].dep + r.int(18, 28));
      deps.push({ family: fam, k, id: `${fam}-v${k}`, repl: `${fam}-v${k + 1}`, chain: true,
        notices: [{ no: 1, ann: (d1 - r.int(14, 30)) * D + r.int(0, D - 1), dep: d1 }] });
      continue;
    }
    const fam = fams[famUsed.length];
    famUsed.push(fam);
    const k = r.int(1, 3);
    const lo = level === 3 && i === 0 ? 8 : 10;
    const hi = level === 3 && i === 0 ? 16 : L - (level === 3 ? 30 : 15);
    const d1 = r.int(lo, hi);
    deps.push({ family: fam, k, id: `${fam}-v${k}`, repl: `${fam}-v${k + 1}`,
      notices: [{ no: 1, ann: (d1 - r.int(14, 40)) * D + r.int(0, D - 1), dep: d1 }] });
  }
  for (const v of deps) { addVersion(v.family, v.k); addVersion(v.family, v.k + 1); }
  // Two versions nobody deprecates (noise).
  for (const fam of fams.slice(famUsed.length, famUsed.length + 2)) addVersion(fam, r.int(1, 2));

  // Level 3: second notices on two single-notice, non-chain versions.
  //   postpone  announced before the first date arrived, moves it later;
  //   extend    announced after the first date had passed, moves it later again.
  if (level === 3) {
    const cand = r.shuffle(deps.filter((v) => !v.chain));
    const [a, b] = cand;
    {
      const d1 = a.notices[0].dep;
      const annDay = d1 - r.int(2, 6);
      a.notices.push({ no: 2, ann: annDay * D + r.int(0, D - 1), dep: Math.min(L - 8, d1 + r.int(7, 14)), kind: "postpone" });
    }
    {
      const d1 = b.notices[0].dep;
      const annDay = d1 + r.int(3, 6);
      b.notices.push({ no: 2, ann: annDay * D + r.int(0, D - 1), dep: Math.min(L - 6, annDay + r.int(7, 14)), kind: "extend" });
    }
  }

  // ---- Tenants and requests.
  const nT = level === 1 ? 4 : level === 2 ? 5 : r.int(6, 7);
  const tenants = [];
  let tid = 100 + r.int(0, 600);
  for (let i = 0; i < nT; i++) tenants.push("tn_" + (tid += r.int(1, 60)));
  const reqs = [];                                                          // {t, v, sec, dep, st}
  const errP = level === 1 ? 0 : 0.12;
  const add = (t, v, sec, extra = {}) => {
    const q = { t, v, sec, dep: "serverless", st: "ok", ...extra };
    if (!("st" in extra) && r.chance(errP)) q.st = "error";
    if (!("dep" in extra) && r.chance(0.07)) q.dep = "dedicated";
    reqs.push(q);
    return q;
  };
  const pairs = [];
  for (const v of deps) {
    const users = tenants.filter(() => r.chance(level === 3 ? 0.45 : 0.55));
    if (users.length < 2) for (const t of r.sample(tenants, 2)) if (!users.includes(t)) users.push(t);
    const d1 = v.notices[0].dep;
    for (const t of users) {
      const style = r.pick(["early", "late", "late", "never"]);
      const M = style === "early" ? d1 - r.int(3, 12) : style === "late" ? d1 + r.int(3, 18) : Infinity;
      const p = level === 3 ? 0.14 : level === 2 ? 0.18 : 0.24;
      for (let d = Math.max(0, d1 - 18); d < L; d++) {
        if (d < M) { if (r.chance(p)) add(t, v.id, d * D + r.int(0, D - 1)); }
        else {
          if (r.chance(0.05)) add(t, v.id, d * D + r.int(0, D - 1));      // a straggling caller
          if (r.chance(p)) add(t, v.repl, d * D + r.int(0, D - 1));
        }
      }
      pairs.push({ t, v, style });
    }
  }
  // Noise on versions nobody deprecates.
  for (const v of versions.filter((x) => !deps.some((y) => y.id === x.id || y.repl === x.id))) {
    for (let i = 0; i < 6; i++) add(r.pick(tenants), v.id, r.int(0, L * D - 1));
  }

  // ---- Forced edge cases.
  const single = deps.filter((v) => v.notices.length === 1);
  {
    const v = r.pick(single), d = v.notices[0].dep, t = r.pick(tenants);
    add(t, v.id, d * D, { st: "ok", dep: "serverless" });                  // exactly 00:00 on the day: late
    add(t, v.id, d * D - 1, { st: "ok", dep: "serverless" });              // one second before: not late
    let sun = d + ((6 - ((d % 7) + 7) % 7) + 7) % 7;                        // the first Sunday on or after d
    if (sun >= L) sun -= 7;
    if (sun < d) sun = d;
    add(t, v.id, sun * D + r.int(0, D - 1), { st: "ok", dep: "serverless" });
  }
  {
    const v = r.pick(deps), d = v.notices[v.notices.length - 1].dep;
    const t = r.pick(tenants);
    add(t, v.id, r.int(d, L - 1) * D + r.int(0, D - 1), { st: "ok", dep: "dedicated" });   // a dedicated late call
  }
  // A tenant that started on the replacement before the deprecation date and still calls the old version.
  {
    const v = r.pick(single), d = v.notices[0].dep, t = r.pick(tenants);
    add(t, v.repl, (d - r.int(4, 8)) * D + r.int(0, D - 1), { st: "ok", dep: "serverless" });
    add(t, v.id, r.int(d, Math.min(L - 1, d + 10)) * D + r.int(0, D - 1), { st: "ok", dep: "serverless" });
  }
  // A dedicated call to a replacement before any serverless one, for a tenant with late calls.
  {
    const v = r.pick(deps), d = v.notices[v.notices.length - 1].dep, t = r.pick(tenants);
    const x = r.int(d, Math.min(L - 3, d + 10));
    add(t, v.id, x * D + r.int(0, D - 1), { st: "ok", dep: "serverless" });
    const firstOk = reqs.filter((q) => q.t === t && q.v === v.repl && q.st === "ok" && q.dep === "serverless").reduce((m, q) => Math.min(m, q.sec), Infinity);
    const at = Math.min(firstOk, x * D) - r.int(1, 3) * D;
    add(t, v.repl, Math.max(0, at), { st: "ok", dep: "dedicated" });
  }
  if (level >= 2) {
    // A tenant whose earliest replacement call failed, with late calls after the deprecation date.
    const v = r.pick(deps), d = v.notices[v.notices.length - 1].dep, t = r.pick(tenants);
    const x = r.int(d, Math.min(L - 3, d + 8));
    add(t, v.id, x * D + r.int(0, D - 1), { st: "error", dep: "serverless" });            // a failed late call: still late
    add(t, v.id, x * D + r.int(0, D - 1), { st: "ok", dep: "serverless" });
    const firstOk = reqs.filter((q) => q.t === t && q.v === v.repl && q.st === "ok" && q.dep === "serverless").reduce((m, q) => Math.min(m, q.sec), Infinity);
    const base = Math.min(firstOk, (x + 1) * D);
    add(t, v.repl, Math.max(0, base - r.int(1, 2) * D - r.int(1, 3600)), { st: "error", dep: "serverless" });
    if (firstOk === Infinity) add(t, v.repl, Math.min(L * D - 1, (x + 1) * D + r.int(0, D - 1)), { st: "ok", dep: "serverless" });
  }
  if (level === 3) {
    for (const v of deps.filter((x) => x.notices.length === 2)) {
      const [n1, n2] = v.notices, t = r.pick(tenants);
      if (n2.kind === "postpone") {
        // Between the first date and the postponed one: not late under the notice in force.
        add(t, v.id, r.int(n1.dep, n2.dep - 1) * D + r.int(0, D - 1), { st: "ok", dep: "serverless" });
        add(t, v.id, r.int(n2.dep, L - 1) * D + r.int(0, D - 1), { st: "ok", dep: "serverless" });
      } else {
        // After the first date passed and before the extension was announced: late.
        const annDay = Math.floor(n2.ann / D);
        add(t, v.id, r.int(n1.dep, annDay - 1) * D + r.int(0, D - 1), { st: "ok", dep: "serverless" });
        // After the extension, before its new date: not late.
        add(t, v.id, (annDay + 1 + r.int(0, Math.max(0, n2.dep - annDay - 2))) * D + r.int(0, D - 1), { st: "ok", dep: "serverless" });
      }
    }
  }

  reqs.sort((a, b) => a.sec - b.sec || (a.t < b.t ? -1 : a.t > b.t ? 1 : 0));
  let rid = 10000 + r.int(0, 50000);
  for (const q of reqs) q.id = "rq_" + (rid += r.int(1, 9));

  // ---- The oracle.
  const byId = new Map(deps.map((v) => [v.id, v]));
  const weekOf = (sec, sunday) => {
    const d = Math.floor(sec / D);                                         // day index; day 0 is a Monday
    const dow = ((d % 7) + 7) % 7;                                         // 0 = Monday
    return sunday ? d - ((dow + 1) % 7) : d - dow;
  };
  const compute = (o = {}) => {
    const okDep = (q) => o.dedicated || q.dep === "serverless";
    const rows = new Map();
    for (const q of reqs) {
      const v = byId.get(q.v);
      if (!v || !okDep(q)) continue;
      if (o.lateOkOnly && q.st !== "ok") continue;
      let n;
      if (o.latestNotice) n = v.notices[v.notices.length - 1];
      else if (o.firstNotice) n = v.notices[0];
      else { n = null; for (const x of v.notices) if (x.ann <= q.sec) n = x; }
      if (!n) continue;
      const late = o.dayAfter ? q.sec >= (n.dep + 1) * D : q.sec >= n.dep * D;
      if (!late) continue;
      const w = weekOf(q.sec, o.sunday);
      const key = `${q.t}|${q.v}|${String(w).padStart(5, "0")}`;
      if (!rows.has(key)) rows.set(key, { t: q.t, v, w, late: 0 });
      rows.get(key).late++;
    }
    const replOk = (q, t, v) => q.t === t && q.v === v.repl && okDep(q) && (o.replAnyStatus || q.st === "ok");
    const out = [];
    for (const x of rows.values()) {
      let rc = 0, first = Infinity;
      const from = o.firstAfterDep ? x.v.notices[x.v.notices.length - 1].dep * D : -Infinity;
      for (const q of reqs) {
        if (!replOk(q, x.t, x.v)) continue;
        if (weekOf(q.sec, o.sunday) === x.w) rc++;
        if (q.sec >= from && q.sec < first) first = q.sec;
      }
      out.push([x.t, x.v.id, dayStr(x.w), x.late, rc, first === Infinity ? null : dayStr(Math.floor(first / D))]);
    }
    out.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : a[2] < b[2] ? -1 : a[2] > b[2] ? 1 : 0));
    return out;
  };
  const expected = compute();

  const diagnostics = [
    { message: "Requests on dedicated endpoints were counted. In this exercise a catalogue deprecation applies to serverless requests only: keep deployment = 'serverless' for late calls, replacement calls and the first replacement call.", rows: compute({ dedicated: true }) },
    { message: "Late calls were counted from the day after the deprecation date. The version is deprecated from 00:00 UTC on deprecates_on: a call at exactly midnight that day is late (requested_at >= the date's midnight).", rows: compute({ dayAfter: true }) },
    { message: "Weeks started on Sunday. week_start is the Monday of the call's week in UTC (date_trunc('week', …) in PostgreSQL).", rows: compute({ sunday: true }) },
    { message: "The first replacement call was searched for only from the deprecation date on. A tenant that started on the replacement earlier migrated earlier: take its earliest successful serverless call at any time in the data.", rows: compute({ firstAfterDep: true }) },
  ];
  if (level >= 2) {
    diagnostics.push(
      { message: "Only successful calls were counted as late. A failed call to a deprecated version is still a late call: it shows code that still points at the old version.", rows: compute({ lateOkOnly: true }) },
      { message: "Failed calls to the replacement were counted. Only a call with status 'ok' shows the tenant running on the replacement, for replacement_calls and for first_replacement_on.", rows: compute({ replAnyStatus: true }) },
    );
  }
  if (level === 3) {
    diagnostics.push(
      { message: "Every call was judged by the version's latest notice. A call is judged by the notice in force when it was made (the highest notice_no announced at or before requested_at): calls made after an earlier date had passed, before an extension was announced, were late.", rows: compute({ latestNotice: true }) },
      { message: "Every call was judged by the version's first notice. A later notice that postponed the date replaces it from the moment it was announced.", rows: compute({ firstNotice: true }) },
    );
  }

  // ---- Tables.
  const mCols = ["version_id", "family", "released_on"];
  const mRows = versions.slice().sort((a, b) => (a.id < b.id ? -1 : 1)).map((v) => [v.id, v.family, dayStr(v.released)]);
  const nCols = ["version_id", "notice_no", "announced_at", "deprecates_on", "replacement_id"];
  const nRows = deps.slice().sort((a, b) => (a.id < b.id ? -1 : 1)).flatMap((v) => v.notices.map((n) => [v.id, n.no, stamp(n.ann), dayStr(n.dep), v.repl]));
  const qCols = ["request_id", "tenant_id", "version_id", "deployment", "status", "requested_at"];
  const qRows = reqs.map((q) => [q.id, q.t, q.v, q.dep, q.st, stamp(q.sec)]);

  const setup =
    "SET TIME ZONE 'UTC';\n" +
    "CREATE TABLE model_versions (\n  version_id TEXT PRIMARY KEY,\n  family TEXT NOT NULL,\n  released_on DATE NOT NULL\n);\n" +
    "CREATE TABLE deprecation_notices (\n  version_id TEXT NOT NULL REFERENCES model_versions (version_id),\n  notice_no INT NOT NULL,\n  announced_at TIMESTAMPTZ NOT NULL,\n  deprecates_on DATE NOT NULL,\n  replacement_id TEXT NOT NULL REFERENCES model_versions (version_id),\n  PRIMARY KEY (version_id, notice_no)\n);\n" +
    "CREATE TABLE requests (\n  request_id TEXT PRIMARY KEY,\n  tenant_id TEXT NOT NULL,\n  version_id TEXT NOT NULL REFERENCES model_versions (version_id),\n  deployment TEXT NOT NULL CHECK (deployment IN ('serverless', 'dedicated')),\n  status TEXT NOT NULL CHECK (status IN ('ok', 'error')),\n  requested_at TIMESTAMPTZ NOT NULL\n);\n" +
    insertSQL("model_versions", mCols, mRows) + insertSQL("deprecation_notices", nCols, nRows) + insertSQL("requests", qCols, qRows);

  const multi = deps.filter((v) => v.notices.length > 1).length;
  return {
    vars: {
      first_day: dayStr(0),
      last_day: dayStr(L - 1),
      tenants: nT,
      deprecated: deps.length,
      request_rows: qRows.length,
      notice_note: level < 3
        ? "In this sample every deprecated version has a single notice."
        : `In this sample ${multi} versions have a second notice that moved their date.`,
    },
    setup,
    tables: [
      { name: "model_versions", columns: mCols, rows: mRows },
      { name: "deprecation_notices", columns: nCols, rows: nRows },
      { name: "requests", columns: qCols, rows: qRows },
    ],
    expected: { columns: ["tenant_id", "version_id", "week_start", "late_calls", "replacement_calls", "first_replacement_on"], rows: expected },
    diagnostics: diagnostics.filter((d) => JSON.stringify(d.rows) !== JSON.stringify(expected)),
  };
}
