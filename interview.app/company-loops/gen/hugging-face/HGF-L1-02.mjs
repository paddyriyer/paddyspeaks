/* HGF-L1-02 — Gated access decisions: median hours from request to decision (SQL).
   Simulated practice scenario. All data is generated from the seed. Gating here is
   described generally (a repo may require accepting conditions before access); the
   approval modes and the report are this exercise's, not a statement of any hub's rules.

   Contract: see docs/COMPANY-INTERVIEW-LOOPS.md § Executable templates (sql).
   The oracle works per request in JavaScript (exact integer minutes); the evaluator's
   reference is SQL with PERCENTILE_CONT.
   level: 1 Medium (at most one decision per request; manual and auto repos; pending requests)
          2 Hard (+ decisions reversed later: wait from the first decision, outcome from the
            latest; a manual repo with every request still pending)
          3 Very Hard (+ an as-of cutoff inside the data: later requests and decisions do not
            exist yet, including a decision exactly at the cutoff) */
import { insertSQL, ts } from "../../js/rng.js";

export const kind = "sql";

const STARTS = ["2026-09-01", "2026-09-07", "2026-09-14", "2026-09-21"];
const REPOS = [
  "acme-labs/speech-corpus-de", "northwind/legal-qa-7b", "quill/faces-synthetic",
  "riverbank/code-instruct-v1", "fjord/satellite-tiles", "lumen/chat-base-13b", "orbit/med-terms-glossary",
];
const HEX = "0123456789abcdef".split("");

function addDays(day, n) {
  const d = new Date(day + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
// Seconds since the first day's midnight -> "YYYY-MM-DD HH:MM:SS+00".
const at = (start, s) => ts(addDays(start, Math.floor(s / 86400)), s % 86400);

export function generate(r, level) {
  const start = r.pick(STARTS);
  const names = r.sample(REPOS, level === 1 ? 5 : 6).sort();
  const nAuto = r.int(1, 2);
  const repos = names.map((id, i) => ({ id, mode: i < nAuto ? "auto" : "manual" }));
  // shuffle modes so auto repos are not always alphabetically first
  const modes = r.shuffle(repos.map((x) => x.mode));
  repos.forEach((x, i) => (x.mode = modes[i]));
  const manual = repos.filter((x) => x.mode === "manual");
  // Hard+: the last manual repo has only pending requests.
  const allPending = level >= 2 ? manual[manual.length - 1] : null;

  const asOf = level === 3 ? 6 * 86400 + r.pick([9, 12, 15]) * 3600 : 40 * 86400;
  const users = new Set();
  const uid = () => { let u; do u = "u_" + Array.from({ length: 5 }, () => r.pick(HEX)).join(""); while (users.has(u)); users.add(u); return u; };

  const reqs = [];    // {repo, user, t, decs: [{t, decision}]}
  const randWait = () => 6 * (r.chance(0.4) ? r.int(1, 20) : r.int(30, 700));   // minutes, multiples of 6
  for (const repo of repos) {
    const n = repo.mode === "auto" ? r.int(2, 4) : r.int(4, 7);
    for (let i = 0; i < n; i++) {
      const t = r.int(0, (level === 3 ? 7 : 6) * 86400 - 1);
      const q = { repo, user: uid(), t, decs: [] };
      if (repo.mode === "auto") q.decs.push({ t: t + r.int(1, 20), decision: "accepted" });
      else if (repo !== allPending && r.chance(0.75)) {
        const t1 = t + 60 * randWait();
        const d1 = r.chance(0.75) ? "accepted" : "rejected";
        q.decs.push({ t: t1, decision: d1 });
        if (level >= 2 && r.chance(0.3)) q.decs.push({ t: t1 + 60 * randWait(), decision: d1 === "accepted" ? "rejected" : "accepted" });
      }
      reqs.push(q);
    }
  }
  // Every level: one manual repo has at least two decided requests (so a median exists).
  {
    const repo = manual.find((x) => x !== allPending);
    for (let i = 0; i < 2; i++) {
      const t = r.int(0, 3 * 86400);
      reqs.push({ repo, user: uid(), t, decs: [{ t: t + 60 * randWait(), decision: "accepted" }] });
    }
  }
  if (level >= 2) {
    // A reversal: rejected quickly, accepted much later.
    const repo = r.pick(manual.filter((x) => x !== allPending));
    const t = r.int(0, 2 * 86400);
    const t1 = t + 60 * 6 * r.int(1, 10);
    reqs.push({ repo, user: uid(), t, decs: [{ t: t1, decision: "rejected" }, { t: t1 + 60 * 6 * r.int(100, 400), decision: "accepted" }] });
  }
  if (level === 3) {
    const repo = r.pick(manual.filter((x) => x !== allPending));
    // A decision exactly at the cutoff: not yet made.
    const k = r.int(5, 60);
    reqs.push({ repo, user: uid(), t: asOf - 360 * k, decs: [{ t: asOf, decision: "accepted" }] });
    // Decided before the cutoff, reversed after it.
    const t = asOf - 3600 * r.int(10, 30);
    reqs.push({ repo, user: uid(), t, decs: [{ t: t + 360 * r.int(5, 40), decision: "accepted" }, { t: asOf + 360 * r.int(1, 50), decision: "rejected" }] });
    // A request after the cutoff.
    reqs.push({ repo, user: uid(), t: asOf + r.int(60, 7200), decs: [] });
    // A request exactly at the cutoff: not yet made.
    reqs.push({ repo: r.pick(repos), user: uid(), t: asOf, decs: [] });
  }

  reqs.sort((a, b) => a.t - b.t || (a.repo.id < b.repo.id ? -1 : 1) || (a.user < b.user ? -1 : 1));
  let rid = 51000 + r.int(0, 9000);
  for (const q of reqs) q.id = rid += r.int(1, 7);
  const decs = [];
  for (const q of reqs) for (const d of q.decs) decs.push({ ...d, req: q });
  decs.sort((a, b) => a.t - b.t || a.req.id - b.req.id);
  let did = 900000 + r.int(0, 90000);
  for (const d of decs) d.id = did += r.int(1, 7);

  const cmp = (x, y) => (x < y ? -1 : x > y ? 1 : 0);
  const solve = (o = {}) => {
    const cut = o.noCut ? Infinity : asOf;
    const out = [];
    const sorted = repos.slice().sort((a, b) => cmp(a.mode, b.mode) || cmp(a.id, b.id));
    for (const repo of sorted) {
      const mine = reqs.filter((q) => q.repo === repo && q.t < cut);
      if (!mine.length) continue;
      let acc = 0, rej = 0, pend = 0;
      const waits = [];   // seconds
      for (const q of mine) {
        const ds = q.decs.filter((d) => d.t < cut);
        if (!ds.length) { pend++; continue; }
        const outcome = (o.firstOutcome ? ds[0] : ds[ds.length - 1]).decision;
        if (outcome === "accepted") acc++; else rej++;
        waits.push((o.lastWait ? ds[ds.length - 1].t : ds[0].t) - q.t);
      }
      let med = null;
      if ((repo.mode === "manual" || o.autoMedian) && waits.length) {
        waits.sort((a, b) => a - b);
        const n = waits.length;
        if (o.mean) med = Math.round(waits.reduce((s, x) => s + x, 0) / n / 36) / 100;
        else {
          const two = n % 2 ? 2 * waits[(n - 1) / 2] : waits[n / 2 - 1] + waits[n / 2];   // 2 × median, seconds
          med = Math.round(two / 72) / 100;     // exact for multiples of 6 minutes
        }
      }
      out.push([repo.id, repo.mode, mine.length, acc, rej, pend, med]);
    }
    return out;
  };
  const rows = solve();

  const diagnostics = [
    { message: "Auto-approving repos were given a median. Their decisions are automatic, so they are reported apart with a NULL median instead of being mixed with human decisions.", rows: solve({ autoMedian: true }) },
    { message: "That is the mean wait, not the median. A few requests that waited days pull the mean far from the typical wait.", rows: solve({ mean: true }) },
  ];
  if (level >= 2) {
    diagnostics.push({ message: "The wait was measured to the latest decision. The time to a decision ends at the first decision; a later reversal changes the outcome, not the wait.", rows: solve({ lastWait: true }) });
    diagnostics.push({ message: "The outcome was taken from the first decision. A reversed request counts under its latest decision.", rows: solve({ firstOutcome: true }) });
  }
  if (level === 3) diagnostics.push({ message: "The as-of cutoff was ignored. Requests and decisions at or after it had not happened yet when the report is taken.", rows: solve({ noCut: true }) });

  const gCols = ["repo_id", "approval_mode"];
  const gRows = repos.map((x) => [x.id, x.mode]);
  const qCols = ["request_id", "repo_id", "user_id", "requested_at"];
  const qRows = reqs.map((q) => [q.id, q.repo.id, q.user, at(start, q.t)]);
  const dCols = ["decision_id", "request_id", "decision", "decided_at"];
  const dRows = decs.map((d) => [d.id, d.req.id, d.decision, at(start, d.t)]);
  const setup =
    "SET TIME ZONE 'UTC';\n" +
    "CREATE TABLE gated_repos (\n  repo_id TEXT PRIMARY KEY,\n  approval_mode TEXT NOT NULL CHECK (approval_mode IN ('auto', 'manual'))\n);\n" +
    "CREATE TABLE access_requests (\n  request_id BIGINT PRIMARY KEY,\n  repo_id TEXT NOT NULL REFERENCES gated_repos(repo_id),\n  user_id TEXT NOT NULL,\n  requested_at TIMESTAMPTZ NOT NULL\n);\n" +
    "CREATE TABLE access_decisions (\n  decision_id BIGINT PRIMARY KEY,\n  request_id BIGINT NOT NULL REFERENCES access_requests(request_id),\n  decision TEXT NOT NULL CHECK (decision IN ('accepted', 'rejected')),\n  decided_at TIMESTAMPTZ NOT NULL\n);\n" +
    insertSQL("gated_repos", gCols, gRows) + insertSQL("access_requests", qCols, qRows) + insertSQL("access_decisions", dCols, dRows);

  return {
    vars: {
      as_of: at(start, asOf),
      requests: reqs.length,
      decision_rule: level === 1
        ? "In this sample a request has at most one decision."
        : "A maintainer can reverse a decision later, so a request can have several decisions: the wait ends at the **first** decision, and the outcome is the **latest** decision.",
      cutoff_rule: level === 3
        ? "The log continues after the cutoff: requests and decisions at or after it must be ignored."
        : "In this sample everything happened before the cutoff.",
    },
    setup,
    tables: [
      { name: "gated_repos", columns: gCols, rows: gRows },
      { name: "access_requests", columns: qCols, rows: qRows },
      { name: "access_decisions", columns: dCols, rows: dRows },
    ],
    expected: { columns: ["repo_id", "approval_mode", "requests", "accepted", "rejected", "pending", "median_hours_to_decision"], rows },
    diagnostics: diagnostics.filter((d) => JSON.stringify(d.rows) !== JSON.stringify(rows)),
  };
}
