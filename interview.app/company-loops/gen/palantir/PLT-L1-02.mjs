/* PLT-L1-02 — Reads after expiry: reads of restricted datasets made after the reader's
   purpose-based grant had ended, renewals honoured, per dataset and month (SQL).
   Simulated practice scenario. All data is generated from the seed and is hypothetical.
   Markings, grants and purposes follow this exercise's model only; nothing here
   describes how any product enforces access.

   Contract: see docs/COMPANY-INTERVIEW-LOOPS.md § Executable templates (sql).
   The oracle classifies every read by scanning the grants in JavaScript.
   level: 1 Medium (one purpose; renewals that overlap and renewals after a gap; a read
                    exactly at expiry; a read before any grant; a month boundary)
          2 Hard (+ several purposes: a grant only covers reads for its own purpose)
          3 Very Hard (+ revocations, including one recorded after the grant had already
                       expired; a dataset marked restricted part-way through the window) */
import { insertSQL, ts } from "../../js/rng.js";

export const kind = "sql";

const H = 60;                                   // times are in minutes from BASE
const D = 24 * H;
const BASE = Date.UTC(2026, 6, 1) / 1000;       // 2026-07-01 00:00 UTC
const WIN0 = 47 * D;                            // reads from 2026-08-17
const WIN1 = 79 * D;                            // to 2026-09-18
const SEP1 = 62 * D;                            // 2026-09-01 00:00
const USERS = ["u_ana", "u_ben", "u_chen", "u_dara", "u_eli", "u_fay", "u_gus", "u_hana", "u_ivo", "u_jun", "u_kai", "u_lena", "u_mo", "u_nia"];
const PURPOSES = ["capacity_planning", "maintenance_planning", "quality_review", "supplier_audit"];
const DATASETS = ["inspection_results", "maintenance_history", "payroll_summary", "plant_costs", "supplier_contracts", "supplier_scorecards", "warranty_claims"];
const MARKINGS = ["restricted-finance", "restricted-hr", "restricted-ops"];

function stamp(min) {
  const t = BASE + min * 60;
  const day = new Date(t * 1000).toISOString().slice(0, 10);
  return ts(day, ((t % 86400) + 86400) % 86400);
}
const month = (min) => new Date((BASE + min * 60) * 1000).toISOString().slice(0, 8) + "01";

export function generate(r, level) {
  const users = r.shuffle(USERS);
  let ui = 0;
  const nextUser = () => users[ui++];
  const purposes = level === 1 ? [r.pick(PURPOSES)] : r.sample(PURPOSES, level === 2 ? 2 : 3).sort();
  const P = purposes[0];
  const nRestricted = level === 1 ? 2 : 3;
  const dnames = r.sample(DATASETS, nRestricted + 1);
  const datasets = dnames.map((id, k) => ({
    id,
    marking: k < nRestricted ? r.pick(MARKINGS) : null,
    since: k < nRestricted ? -r.int(10, 60) * D : null,
  }));
  const restricted = datasets.filter((d) => d.marking);
  const plain = datasets.find((d) => !d.marking);
  const ds = (k) => restricted[k % restricted.length].id;
  if (level === 3) restricted[restricted.length - 1].since = WIN0 + r.int(6, 12) * D + r.int(1, 23) * H;   // marked part-way

  const grants = [];
  const reads = [];
  const grant = (user, dataset, purpose, from, to, revoked = null) => {
    const g = { user, dataset, purpose, from, to, revoked };
    grants.push(g);
    return g;
  };
  const read = (user, dataset, purpose, at) => reads.push({ user, dataset, purpose, at });
  const minute = (lo, hi) => r.int(lo, hi);

  // Random background: a few users with grant chains and reads.
  const bg = Array.from({ length: level === 1 ? 3 : 4 }, nextUser);
  for (const u of bg) {
    for (const d of restricted) {
      for (const p of purposes) {
        if (!r.chance(level === 1 ? 0.6 : 0.45)) continue;
        let from = minute(0, WIN0 + 5 * D);
        const n = r.int(1, 3);
        for (let k = 0; k < n; k++) {
          const to = from + r.int(7, 21) * D + r.int(0, 23) * H;
          const rev = level === 3 && r.chance(0.2) ? from + r.int(1, Math.floor((to - from) / H) - 1) * H : null;
          grant(u, d.id, p, from, to, rev);
          from = to + r.int(-3 * 24, 5 * 24) * H;      // overlap or gap before the renewal
        }
      }
      const nr = r.int(1, 3);
      for (let k = 0; k < nr; k++) read(u, d.id, r.pick(purposes), minute(WIN0, WIN1));
    }
    read(u, plain.id, r.pick(purposes), minute(WIN0, WIN1));          // never counted
  }
  // Planted, each on its own user so nothing else can cover it.
  {
    // Expired, renewed after a gap: a read exactly at expiry, one in the gap, one exactly at the renewal.
    const u = nextUser(), d = ds(0);
    const e = WIN0 + r.int(3, 9) * D + r.int(0, 23) * H;
    const gap = r.int(1, 4) * D + r.int(1, 23) * H;
    grant(u, d, P, e - r.int(10, 20) * D, e);
    grant(u, d, P, e + gap, e + gap + r.int(10, 20) * D);
    read(u, d, P, e);
    read(u, d, P, e + r.int(1, Math.floor(gap / H) - 1) * H + r.int(1, 59));
    read(u, d, P, e + gap);
  }
  {
    // Overlapping renewal: covered after the first grant's expiry.
    const u = nextUser(), d = ds(1);
    const e = WIN0 + r.int(10, 16) * D;
    grant(u, d, P, e - r.int(14, 20) * D, e);
    grant(u, d, P, e - r.int(1, 3) * D, e + r.int(10, 20) * D);
    read(u, d, P, e + r.int(1, 48) * H);
  }
  {
    // Two expired grants: the hours late count from the later end. Then never renewed.
    const u = nextUser(), d = ds(2);
    const e1 = WIN0 - r.int(2, 6) * D;
    const e2 = e1 + r.int(4, 8) * D + r.int(1, 23) * H;
    grant(u, d, P, e1 - r.int(10, 20) * D, e1);
    grant(u, d, P, e1 - r.int(1, 2) * D + 7 * H, e2);
    read(u, d, P, SEP1 - r.int(1, 30));                 // just before the month boundary
    read(u, d, P, SEP1);                                // exactly on it
    // A read before any grant this user ever had on another dataset.
    const d2 = ds(3);
    grant(u, d2, P, WIN1 - r.int(3, 6) * D, WIN1 + 30 * D);
    read(u, d2, P, WIN1 - r.int(8, 20) * D);
  }
  if (level >= 2) {
    // A grant for another purpose covers nothing for this one.
    const u = nextUser(), d = ds(1), Q = purposes[1];
    const a = WIN0 + r.int(1, 5) * D;
    grant(u, d, Q, a, a + r.int(20, 30) * D);
    read(u, d, P, a + r.int(2, 10) * D);
    read(u, d, Q, a + r.int(2, 10) * D);
    // ...and an older grant of the right purpose makes another read late, not never granted.
    const u2 = nextUser();
    const e = WIN0 + r.int(2, 6) * D;
    grant(u2, d, P, e - 15 * D, e);
    grant(u2, d, Q, e - 2 * D, e + 20 * D);
    read(u2, d, P, e + r.int(2, 40) * H);
  }
  if (level === 3) {
    // Revoked before expiry: the grant ends at the revocation.
    const u = nextUser(), d = ds(0);
    const a = WIN0 + r.int(1, 6) * D;
    const rev = a + r.int(2, 5) * D + r.int(1, 23) * H;
    grant(u, d, P, a, a + r.int(20, 30) * D, rev);
    read(u, d, P, rev + r.int(1, 30) * H + r.int(1, 59));
    // A revocation recorded after the grant had already expired changes nothing.
    const u2 = nextUser();
    const e = WIN0 + r.int(6, 12) * D;
    grant(u2, d, P, e - 20 * D, e, e + r.int(2, 4) * D);
    read(u2, d, P, e + r.int(2, 30) * H);
    // A dataset marked part-way: reads before the marking do not count; one exactly at it does.
    const m = restricted[restricted.length - 1];
    const u3 = nextUser();
    read(u3, m.id, P, m.since - r.int(1, 48) * H);
    read(u3, m.id, P, m.since);
  }

  const ord = r.shuffle(reads);
  let rid = 70000 + r.int(0, 9000);
  ord.forEach((x) => (x.id = rid += r.int(1, 7)));
  let gid = 400 + r.int(0, 500);
  r.shuffle(grants).forEach((g) => (g.id = gid += r.int(1, 5)));

  const cmpS = (x, y) => (x < y ? -1 : x > y ? 1 : 0);
  const restrictedAt = new Map(datasets.map((d) => [d.id, d]));
  const solve = (o = {}) => {
    const per = new Map();
    for (const x of reads) {
      const d = restrictedAt.get(x.dataset);
      if (!d.marking) continue;
      if (!o.ignoreSince && d.since > x.at) continue;
      let gs = grants.filter((g) => g.user === x.user && g.dataset === x.dataset && (o.ignorePurpose || g.purpose === x.purpose));
      if (o.firstOnly && gs.length) {
        const byPurpose = new Map();
        for (const g of gs) if (!byPurpose.has(g.purpose) || g.from < byPurpose.get(g.purpose).from) byPurpose.set(g.purpose, g);
        gs = [...byPurpose.values()];
      }
      const end = (g) => {
        if (o.ignoreRevoke || g.revoked === null) return g.to;
        if (o.coalesce) return g.revoked;
        return Math.min(g.to, g.revoked);
      };
      const started = gs.filter((g) => g.from <= x.at);
      const covered = started.some((g) => (o.inclusiveEnd ? x.at <= end(g) : x.at < end(g)));
      const k = x.dataset + "|" + month(x.at);
      if (!per.has(k)) per.set(k, { n: 0, late: 0, never: 0, maxLate: null });
      const s = per.get(k);
      s.n++;
      if (covered) continue;
      if (!started.length) { s.never++; continue; }
      s.late++;
      const ends = started.map(end);
      const last = o.minEnd ? Math.min(...ends) : Math.max(...ends);
      const late = Math.floor((x.at - last + 3) / 6) / 10;     // minutes -> hours, 1 decimal, half up
      s.maxLate = s.maxLate === null ? late : Math.max(s.maxLate, late);
    }
    return [...per.entries()].sort((a, b) => cmpS(a[0], b[0])).map(([k, s]) => {
      const [dataset, m] = k.split("|");
      return [dataset, m, s.n, s.late, s.never, s.maxLate];
    });
  };
  const rows = solve();

  const diagnostics = [
    { message: "A read exactly at expires_at was treated as covered. A grant covers [granted_at, end): the end itself is outside it.", rows: solve({ inclusiveEnd: true }) },
    { message: "Only each reader's first grant was checked, so renewals were ignored. Any grant that covers the read counts.", rows: solve({ firstOnly: true }) },
    { message: "Hours late were measured from the earliest grant end. Measure from the latest end at or before the read: that is when access actually lapsed.", rows: solve({ minEnd: true }) },
  ];
  if (level >= 2) diagnostics.push({ message: "The purpose was ignored. A grant covers only reads made for the purpose it was given for.", rows: solve({ ignorePurpose: true }) });
  if (level === 3) {
    diagnostics.push({ message: "Revocations were ignored. A revoked grant ends at revoked_at when that comes before expires_at.", rows: solve({ ignoreRevoke: true }) });
    diagnostics.push({ message: "The end was taken as COALESCE(revoked_at, expires_at), so a revocation recorded after expiry extended the grant. Use the earlier of the two.", rows: solve({ coalesce: true }) });
    diagnostics.push({ message: "Reads made before the dataset was marked were counted. A read counts only when marked_since <= read_at.", rows: solve({ ignoreSince: true }) });
  }

  const dCols = ["dataset_id", "marking", "marked_since"];
  const dRows = datasets.slice().sort((a, b) => cmpS(a.id, b.id)).map((d) => [d.id, d.marking, d.since === null ? null : stamp(d.since)]);
  const gCols = ["grant_id", "user_id", "dataset_id", "purpose", "granted_at", "expires_at", "revoked_at"];
  const gRows = grants.slice().sort((a, b) => a.id - b.id).map((g) => [g.id, g.user, g.dataset, g.purpose, stamp(g.from), stamp(g.to), g.revoked === null ? null : stamp(g.revoked)]);
  const rCols = ["read_id", "user_id", "dataset_id", "purpose", "read_at"];
  const rRows = reads.slice().sort((a, b) => a.id - b.id).map((x) => [x.id, x.user, x.dataset, x.purpose, stamp(x.at)]);
  const setup =
    "SET TIME ZONE 'UTC';\n" +
    "CREATE TABLE datasets (\n  dataset_id TEXT PRIMARY KEY,\n  marking TEXT,\n  marked_since TIMESTAMPTZ\n);\n" +
    "CREATE TABLE grants (\n  grant_id BIGINT PRIMARY KEY,\n  user_id TEXT NOT NULL,\n  dataset_id TEXT NOT NULL REFERENCES datasets(dataset_id),\n  purpose TEXT NOT NULL,\n  granted_at TIMESTAMPTZ NOT NULL,\n  expires_at TIMESTAMPTZ NOT NULL,\n  revoked_at TIMESTAMPTZ,\n  CHECK (expires_at > granted_at)\n);\n" +
    "CREATE TABLE reads (\n  read_id BIGINT PRIMARY KEY,\n  user_id TEXT NOT NULL,\n  dataset_id TEXT NOT NULL REFERENCES datasets(dataset_id),\n  purpose TEXT NOT NULL,\n  read_at TIMESTAMPTZ NOT NULL\n);\n" +
    insertSQL("datasets", dCols, dRows) + insertSQL("grants", gCols, gRows) + insertSQL("reads", rCols, rRows);

  return {
    vars: {
      reads: rRows.length,
      grants: gRows.length,
      purpose_rule: level === 1
        ? "In this sample every grant and every read has the same purpose."
        : "Here users often hold a grant for one purpose and read for another.",
      revoke_rule: level === 3
        ? "Here some grants were revoked."
        : "In this sample no grant is revoked (`revoked_at` is NULL).",
      marked_rule: level === 3
        ? "Here one dataset was marked part-way through the period."
        : "Every marked dataset in this sample was marked before the period began.",
    },
    setup,
    tables: [
      { name: "datasets", columns: dCols, rows: dRows },
      { name: "grants", columns: gCols, rows: gRows },
      { name: "reads", columns: rCols, rows: rRows },
    ],
    expected: { columns: ["dataset_id", "read_month", "restricted_reads", "after_expiry", "never_granted", "max_hours_late"], rows },
    diagnostics: diagnostics.filter((d) => JSON.stringify(d.rows) !== JSON.stringify(rows)),
  };
}
