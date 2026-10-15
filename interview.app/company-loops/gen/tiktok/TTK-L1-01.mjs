/* TTK-L1-01 — Upload success per app version and network type (SQL).
   Simulated practice scenario. All data is generated from the seed; app versions, network
   types, attempts and the one-hour success rule are hypothetical, defined for this exercise.

   Contract: see docs/COMPANY-INTERVIEW-LOOPS.md § Executable templates (sql).
   level: 1 Medium (resumed attempts of one upload collapsed; the upload belongs to its first
            attempt's version and network; published at most one hour after the first attempt
            started, exactly one hour included)
          2 Hard (+ drafts: an upload saved as a draft and never published is excluded; a draft
            published later counts like any other upload)
          3 Very Hard (+ attempt_id is assigned when the log arrives, so it is not in time order:
            the first attempt is the earliest started_at; an app update between attempts) */
import { insertSQL, ts } from "../../js/rng.js";

export const kind = "sql";

const EPOCH = "2026-01-01";
const DAY_IDX = 284;                                         // 2026-10-12

function addDays(day, n) {
  const d = new Date(Date.UTC(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10) + n));
  return d.toISOString().slice(0, 10);
}
const stamp = (t) => ts(addDays(EPOCH, Math.floor(t / 86400)), ((t % 86400) + 86400) % 86400);

export function generate(r, level) {
  const major = r.int(30, 45), minor = r.int(1, 6);
  const versions = [0, 1, 2].map((k) => `${major}.${minor + k}.0`);
  const networks = ["4g", "5g", "wifi"];
  const D0 = DAY_IDX * 86400;
  const uploads = [];                                         // {id, attempts: [{v, net, s, e, out}]}
  let upNo = 50000 + r.int(0, 40000);
  const newUpload = () => { const u = { id: "up_" + (upNo += r.int(1, 30)), attempts: [] }; uploads.push(u); return u; };
  const att = (u, v, net, s, e, out) => u.attempts.push({ v, net, s, e, out });

  // A random upload: one to three attempts; the last one publishes, fails, or (Hard+) saves a draft.
  const randomUpload = () => {
    const u = newUpload();
    let v = r.pick(versions), net = r.pick(networks);
    let t = D0 + r.int(0, 20 * 3600);
    const k = r.int(1, 3);
    const end = r.chance(0.65) ? "published" : level >= 2 && r.chance(0.4) ? "saved_draft" : r.pick(["failed", "interrupted"]);
    for (let i = 0; i < k; i++) {
      const dur = r.int(20, i === k - 1 && end === "published" ? 1500 : 900);
      const last = i === k - 1;
      att(u, v, net, t, t + dur, last ? end : "interrupted");
      t += dur + r.int(30, r.chance(0.3) ? 4000 : 900);
      if (r.chance(0.4)) net = r.pick(networks);             // resumed on another network
      if (level === 3 && r.chance(0.2)) v = versions[Math.min(2, versions.indexOf(v) + 1)];   // app updated
    }
  };
  for (let i = 0; i < 16 + 5 * level; i++) randomUpload();

  // Planted: exactly one hour (counts) and one second more (does not), resumed on another network.
  const [vA, vB] = r.sample(versions, 2);
  const [nA, nB] = r.sample(networks, 2);
  let t0 = D0 + r.int(3600, 30000);
  let u = newUpload();
  att(u, vA, nA, t0, t0 + r.int(200, 900), "interrupted");
  att(u, vA, nB, t0 + 2400, t0 + 3600, "published");
  t0 = D0 + r.int(3600, 30000);
  u = newUpload();
  att(u, vB, nA, t0, t0 + r.int(100, 600), "failed");
  att(u, vB, nB, t0 + 1800, t0 + 3601, "published");
  // Planted: a resume restarts late; measured from its own start it looks quick, from the first it is not.
  t0 = D0 + r.int(3600, 30000);
  u = newUpload();
  att(u, vA, nB, t0, t0 + 300, "interrupted");
  att(u, vA, nA, t0 + 5000, t0 + 5400, "published");
  if (level >= 2) {
    // Abandoned drafts (excluded) and a draft published later inside the hour (counted, a success).
    for (let i = 0; i < 2; i++) {
      t0 = D0 + r.int(3600, 30000);
      u = newUpload();
      att(u, r.pick(versions), r.pick(networks), t0, t0 + r.int(60, 400), "saved_draft");
    }
    t0 = D0 + r.int(3600, 30000);
    u = newUpload();
    att(u, vB, nA, t0, t0 + 200, "saved_draft");
    att(u, vB, nA, t0 + 1200, t0 + r.int(1500, 3000), "published");
  }
  if (level === 3) {
    // The first attempt's log arrives late: it gets a higher attempt_id than the resume, which
    // ran on another network after an app update.
    t0 = D0 + r.int(3600, 30000);
    u = newUpload();
    att(u, versions[0], nA, t0, t0 + 400, "interrupted");
    att(u, versions[2], nB, t0 + 900, t0 + r.int(1200, 3000), "published");
    u.lateFirst = true;
  }

  // attempt ids: by start time (Hard and below); Very Hard by arrival, so offline logs come late.
  const all = [];
  for (const up of uploads) up.attempts.forEach((a, i) => all.push({ up, a, i, arrive: a.s + (level === 3 && r.chance(0.2) ? r.int(600, 20000) : 0) }));
  for (const x of all) if (x.up.lateFirst && x.i === 0) x.arrive = x.up.attempts[1].s + 30000;
  all.sort((x, y) => x.arrive - y.arrive || x.a.s - y.a.s || (x.up.id < y.up.id ? -1 : 1));
  let aid = 900000 + r.int(0, 50000);
  for (const x of all) x.a.id = (aid += r.int(1, 7));

  const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
  const solve = (o = {}) => {
    const agg = new Map();
    const bump = (v, net, ok) => {
      const k = v + "|" + net;
      if (!agg.has(k)) agg.set(k, { n: 0, ok: 0 });
      const g = agg.get(k);
      g.n++;
      if (ok) g.ok++;
    };
    for (const up of uploads) {
      const as = up.attempts.slice().sort((x, y) => (o.byId ? x.id - y.id : x.s - y.s));
      const pub = as.find((x) => x.out === "published");
      if (!o.drafts && !pub && as.some((x) => x.out === "saved_draft")) continue;
      const from = o.ownStart && pub ? pub.s : as[0].s;
      const ok = !!pub && (o.strict ? pub.e - from < 3600 : pub.e - from <= 3600);
      if (o.perAttempt) { for (const x of as) bump(x.v, x.net, x === pub && ok); continue; }
      const who = o.last ? as[as.length - 1] : as[0];
      bump(who.v, who.net, ok);
    }
    const rate = (a, b) => Math.floor((a * 20000 + b) / (2 * b)) / 10000;
    return [...agg.entries()].sort((a, b) => cmp(a[0], b[0])).map(([k, g]) => {
      const [v, net] = k.split("|");
      return [v, net, g.n, g.ok, rate(g.ok, g.n)];
    });
  };
  const rows = solve();

  const diagnostics = [
    { message: "Attempts were counted instead of uploads. Resumed attempts of one upload_id are one upload, counted once, under its first attempt.", rows: solve({ perAttempt: true }) },
    { message: "Uploads were grouped by their last attempt's app version and network. An upload belongs to the version and network of its first attempt.", rows: solve({ last: true }) },
    { message: "The hour was measured from the publishing attempt's own start. It runs from the upload's first attempt.", rows: solve({ ownStart: true }) },
    { message: "The one-hour bound was treated as exclusive. Publishing exactly one hour after the first attempt started counts.", rows: solve({ strict: true }) },
  ];
  if (level >= 2) diagnostics.push({ message: "Abandoned drafts were counted. An upload saved as a draft and never published is excluded; a draft published later still counts.", rows: solve({ drafts: true }) });
  if (level === 3) diagnostics.push({ message: "The first attempt was taken as the lowest attempt_id. attempt_id follows log arrival, so the first attempt is the one with the earliest started_at.", rows: solve({ byId: true }) });

  const cols = ["attempt_id", "upload_id", "app_version", "network_type", "started_at", "ended_at", "outcome"];
  const tRows = all.slice().sort((x, y) => x.a.id - y.a.id).map(({ up, a }) => [a.id, up.id, a.v, a.net, stamp(a.s), stamp(a.e), a.out]);
  const setup =
    "SET TIME ZONE 'UTC';\n" +
    "CREATE TABLE upload_attempts (\n  attempt_id BIGINT PRIMARY KEY,\n  upload_id TEXT NOT NULL,          -- one upload, however many times it is resumed\n  app_version TEXT NOT NULL,\n  network_type TEXT NOT NULL,       -- '4g' | '5g' | 'wifi'\n  started_at TIMESTAMPTZ NOT NULL,\n  ended_at TIMESTAMPTZ NOT NULL,\n  outcome TEXT NOT NULL             -- 'published' | 'interrupted' | 'failed' | 'saved_draft'\n);\n" +
    insertSQL("upload_attempts", cols, tRows);

  return {
    vars: {
      attempts: tRows.length,
      uploads: uploads.length,
      draft_rule: level === 1
        ? "No attempt in this sample saved a draft."
        : "A creator can stop and save the upload as a draft (`outcome = 'saved_draft'`). An upload that was saved as a draft and never published is excluded entirely; a draft that was published later is counted like any other upload, timed from its first attempt.",
      id_rule: level === 3
        ? "`attempt_id` is assigned when an attempt's log reaches the server, and a phone that was offline sends its logs late, so ids are not in time order: an upload's first attempt is the one with the earliest `started_at`. An app update between attempts can change `app_version` within one upload."
        : "Within one upload, `attempt_id` increases with `started_at`.",
    },
    setup,
    tables: [{ name: "upload_attempts", columns: cols, rows: tRows }],
    expected: { columns: ["app_version", "network_type", "uploads", "published_within_1h", "success_rate"], rows },
    diagnostics: diagnostics.filter((d) => JSON.stringify(d.rows) !== JSON.stringify(rows)),
  };
}
