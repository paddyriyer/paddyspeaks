/* XAI-L1-03 — Freshness of public posts: minutes from creation to searchable, per hour (SQL).
   Simulated practice scenario. Posts are public posts with a given schema and no content;
   all data is generated from the seed and every lag is hypothetical.

   Contract: see docs/COMPANY-INTERVIEW-LOOPS.md § Executable templates (sql).
   level: 1 Medium (per creation hour: median and 95th percentile by nearest rank; edits are
            searchable after the first version; deleted posts excluded)
          2 Hard (+ an edited version searchable before the first version, posts created in the
            first and last second of an hour, posts never searchable shown apart)
          3 Very Hard (+ the same version made searchable again by a re-index, and deleted posts
            whose searchable rows remain) */
import { insertSQL } from "../../js/rng.js";

export const kind = "sql";

const p2 = (n) => String(n).padStart(2, "0");
const DAYS = ["2026-10-06", "2026-10-07", "2026-10-08"];

export function generate(r, level) {
  const day = r.pick(DAYS);
  const base = Date.parse(day + "T00:00:00Z") / 1000;
  const fmt = (sec) => {
    const d = new Date((base + sec) * 1000);
    return `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())} ${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}:${p2(d.getUTCSeconds())}+00`;
  };
  const h0 = r.int(6, 18);
  const hours = level === 1 ? 3 : 4;
  const posts = [];                              // {id, created, deleted, rows: [{v, at}]}
  let pid = 1800000000 + r.int(0, 9000000);
  const lag = () => (r.chance(0.85) ? r.int(8, 240) : r.int(241, 1800));
  for (let h = 0; h < hours; h++) {
    const n = r.int(9, 16);
    for (let i = 0; i < n; i++) {
      let created = (h0 + h) * 3600 + r.int(0, 3599);
      if (level >= 2 && i === 0) created = (h0 + h) * 3600;            // first second of the hour
      if (level >= 2 && i === 1) created = (h0 + h) * 3600 + 3599;     // last second
      const p = { id: String(pid += r.int(1, 5000)), created, deleted: null, rows: [] };
      const first = created + lag();
      p.rows.push({ v: 1, at: first });
      if (r.chance(0.25)) {                                            // an edit, searchable later
        const editAt = first + r.int(30, 900);
        p.rows.push({ v: 2, at: editAt + r.int(5, 120) });
      }
      if (level >= 2 && r.chance(0.12)) {                              // the edit beat version 1 into the index
        p.rows = [{ v: 2, at: created + r.int(20, 90) }, { v: 1, at: created + r.int(200, 900) }];
      }
      if (level >= 2 && r.chance(0.08)) p.rows = [];                    // never searchable (yet)
      if (level === 3 && p.rows.length && r.chance(0.15)) {            // a re-index of the same version
        const x = r.pick(p.rows);
        p.rows.push({ v: x.v, at: x.at + r.int(600, 7200) });
      }
      if (r.chance(0.1)) {                                             // deleted later
        const lastSeen = Math.max(created, ...p.rows.map((x) => x.at));
        p.deleted = lastSeen + r.int(60, 3600);
        if (level < 3 && r.chance(0.5)) p.rows = [];                   // removed from the index too
      }
      posts.push(p);
    }
  }
  if (level >= 2 && !posts.some((p) => !p.deleted && !p.rows.length)) {
    const p = r.pick(posts.filter((q) => !q.deleted));
    p.rows = [];
  }
  if (level === 3 && !posts.some((p) => p.deleted && p.rows.length)) {
    const p = r.pick(posts.filter((q) => q.rows.length));
    p.deleted = Math.max(...p.rows.map((x) => x.at)) + 300;
  }

  const cmp = (x, y) => (x < y ? -1 : x > y ? 1 : 0);
  const mins = (secs) => Math.floor((10 * secs + 3) / 6) / 100;
  const disc = (xs, p) => { const s = xs.slice().sort((a, b) => a - b); return s[Math.max(1, Math.ceil(p * s.length)) - 1]; };
  const solve = (o = {}) => {
    const per = new Map();
    for (const p of posts) {
      if (p.deleted !== null && !o.keepDeleted) continue;
      const hr = Math.floor(p.created / 3600);
      if (!per.has(hr)) per.set(hr, { lags: [], uns: 0 });
      const s = per.get(hr);
      const rows = o.v1 ? p.rows.filter((x) => x.v === 1) : p.rows;
      if (!rows.length) { s.uns++; continue; }
      if (o.perRow) for (const x of rows) s.lags.push(x.at - p.created);
      else if (o.latestVersion) {
        const top = Math.max(...rows.map((x) => x.v));
        s.lags.push(Math.min(...rows.filter((x) => x.v === top).map((x) => x.at)) - p.created);
      } else s.lags.push(Math.min(...rows.map((x) => x.at)) - p.created);
    }
    return [...per.entries()].sort((a, b) => a[0] - b[0]).map(([hr, s]) => [
      fmt(hr * 3600), s.lags.length, s.uns,
      s.lags.length ? mins(disc(s.lags, 0.5)) : null,
      s.lags.length ? mins(disc(s.lags, 0.95)) : null,
    ]);
  };
  const rows = solve();

  const diagnostics = [
    { message: "Deleted posts were kept. A post with a deleted_at is left out of every column.", rows: solve({ keepDeleted: true }) },
    { message: "Every searchable row was counted as a post. An edited post counts once, at the first time any of its versions became searchable.", rows: solve({ perRow: true }) },
    { message: "The lag was taken to the latest version. Freshness is when the post first became searchable, whichever version that was.", rows: solve({ latestVersion: true }) },
  ];
  if (level >= 2) diagnostics.push({ message: "Only version 1 was used. When an edit was indexed first, the post was already searchable then.", rows: solve({ v1: true }) });

  const pCols = ["post_id", "created_at", "deleted_at"];
  const pRows = posts.slice().sort((a, b) => cmp(a.id.padStart(12, "0"), b.id.padStart(12, "0"))).map((p) => [p.id, fmt(p.created), p.deleted === null ? null : fmt(p.deleted)]);
  const sCols = ["post_id", "version", "searchable_at"];
  const sRows = posts.flatMap((p) => p.rows.map((x) => [p.id, x.v, fmt(x.at)])).sort((a, b) => cmp(a[2], b[2]) || cmp(a[0], b[0]) || a[1] - b[1]);
  const setup =
    "SET TIME ZONE 'UTC';\n" +
    "CREATE TABLE posts (\n  post_id BIGINT PRIMARY KEY,\n  created_at TIMESTAMPTZ NOT NULL,\n  deleted_at TIMESTAMPTZ\n);\n" +
    "CREATE TABLE searchable (\n  post_id BIGINT NOT NULL REFERENCES posts(post_id),\n  version INT NOT NULL,\n  searchable_at TIMESTAMPTZ NOT NULL\n);\n" +
    insertSQL("posts", pCols, pRows.map((x) => [Number(x[0]), x[1], x[2]])) +
    insertSQL("searchable", sCols, sRows.map((x) => [Number(x[0]), x[1], x[2]]));

  return {
    vars: {
      posts: String(posts.length),
      day,
      index_rule: level === 1
        ? "In this sample every post that was not deleted became searchable, and an edit is always searchable after the version it replaced."
        : level === 2
          ? "An edit can become searchable before the version it replaced, and some posts have no searchable row yet: count those in unsearchable, and leave them out of the percentiles."
          : "An edit can become searchable before the version it replaced, some posts have no searchable row yet (count them in unsearchable, outside the percentiles), a re-index can make the same version searchable again later, and a deleted post's searchable rows can still be in the table.",
    },
    setup,
    tables: [
      { name: "posts", columns: pCols, rows: pRows },
      { name: "searchable", columns: sCols, rows: sRows },
    ],
    expected: { columns: ["hour_start", "posts", "unsearchable", "median_minutes", "p95_minutes"], rows },
    diagnostics: diagnostics.filter((d) => JSON.stringify(d.rows) !== JSON.stringify(rows)),
  };
}
