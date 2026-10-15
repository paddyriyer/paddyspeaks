/* PLT-L3-05 — Dangling links: links whose target object was deleted, per link type, and how
   long each stayed dangling until it was removed, re-pointed or the target restored (SQL).
   Simulated practice scenario. All data, names and times are generated from the seed and are
   hypothetical; nothing here describes any company's product internals.

   The model: link_types, objects, object_deletions (one row per period an object spent deleted;
   restored_at NULL while still deleted) and link_versions (a link's target over time; a version is
   in force on [valid_from, valid_to), valid_to NULL while in force; re-pointing closes version n and
   opens n + 1 at the same instant with another target; removing closes the last version).

   A dangling episode is the overlap of one link version with one deletion period of its target:
     start = max(valid_from, deleted_at), end = min(valid_to, restored_at) (NULL = open),
     counted only when start < end (positive length).
   Outcome: still dangling when both ends are open; otherwise the earlier end decides:
     valid_to <= restored_at (ties go to the link) -> repointed if a next version exists, else removed;
     restored_at < valid_to (or valid_to open)     -> restored.
   avg_hours_to_fix = resolved seconds / (3600 * resolved episodes), rounded half up to 2 places,
   NULL when the link type has no resolved episode. One row per link type, zero rows included.
   level: 1 Medium (deletions are never undone; re-pointing, removal, a version created against an
                    already-deleted target, a deletion exactly at valid_to, shared targets,
                    a link type with no episodes)
          2 Hard (+ restores: several deletion periods per object, a restore exactly at valid_to
                  (credited to the link), a restore exactly at valid_from (no episode))
          3 Very Hard (+ a grace period: deletion periods restored less than G minutes after they
                       began are ignored; exactly G counts; open deletions always count) */
import { insertSQL, ts } from "../../js/rng.js";

export const kind = "sql";

const DAY = 1440;                                               // times are whole minutes
const BASE = Date.UTC(2026, 8, 28) / 1000;                      // 2026-09-28 00:00 UTC
const TYPES = [
  ["asset_site", "asset", "site"],
  ["inspection_asset", "inspection", "asset"],
  ["part_bin", "part", "storage_bin"],
  ["part_supplier", "part", "supplier"],
  ["po_supplier", "purchase_order", "supplier"],
  ["shipment_po", "shipment", "purchase_order"],
  ["work_order_asset", "work_order", "asset"],
  ["work_order_part", "work_order", "part"],
];
const PREFIX = { asset: "ast", site: "site", inspection: "insp", part: "prt", storage_bin: "bin", supplier: "sup", purchase_order: "po", shipment: "shp", work_order: "wo" };

function stamp(min) {
  const sec = BASE + min * 60;
  const day = new Date(sec * 1000).toISOString().slice(0, 10);
  return ts(day, (((min * 60) % 86400) + 86400) % 86400);
}

export function generate(r, level) {
  const T = 6 * DAY + r.pick([9, 11, 14, 17]) * 60 + r.pick([0, 15, 30, 45]);   // snapshot time
  const G = level === 3 ? r.pick([10, 15, 30]) : 0;                              // grace minutes

  const nTypes = level === 1 ? 3 : level === 2 ? 4 : r.int(4, 5);
  const types = r.sample(TYPES, nTypes).sort((a, b) => (a[0] < b[0] ? -1 : 1));
  const clean = r.pick(types)[0];                                                 // no deletions at all
  const dirty = types.filter((t) => t[0] !== clean);
  const meta = new Map(types.map((t) => [t[0], { src: t[1], tgt: t[2] }]));

  // Objects.
  const objects = new Map();                                                      // id -> {type, periods}
  const counters = {};
  const newObj = (type) => {
    counters[type] = (counters[type] || r.int(100, 700)) + r.int(1, 9);
    const id = PREFIX[type] + "_" + counters[type];
    objects.set(id, { type, periods: [] });
    return id;
  };
  const del = (id, d, rest = null) => objects.get(id).periods.push({ d, r: rest });

  // Links.
  const links = [];
  const addLink = (lt, versions) => {
    const L = { type: lt, src: newObj(meta.get(lt).src), versions };
    links.push(L);
    return L;
  };
  const targetsOf = new Map();                                                    // lt -> [object ids]
  const fresh = (lt) => {
    const id = newObj(meta.get(lt).tgt);
    if (!targetsOf.has(lt)) targetsOf.set(lt, []);
    targetsOf.get(lt).push(id);
    return id;
  };

  // Random deletion history for a fresh target of version v (vend = valid_to or the snapshot time).
  const scenario = (v) => {
    const vend = v.vt === null ? T : v.vt;
    const roll = r.next();
    const openInside = () => del(v.tgt, r.int(v.vf + 1, vend - 1));
    const openBefore = () => del(v.tgt, v.vf - r.int(30, 600));
    if (level === 1) {
      if (roll < 0.4) return;
      if (roll < 0.82) openInside();
      else openBefore();
      return;
    }
    if (roll < 0.3) return;
    if (roll < 0.55) { if (r.chance(0.75)) openInside(); else openBefore(); return; }
    if (roll < 0.85) {
      const d = r.int(v.vf - 300, vend - 2);
      let rest;
      if (level === 3 && r.chance(0.35)) rest = d + r.int(2, G - 1);                // transient: ignored
      else rest = r.int(Math.max(d, v.vf) + 1, Math.min(T, vend + 300));
      del(v.tgt, d, Math.min(rest, T));
      return;
    }
    const span = vend - v.vf;
    const d1 = r.int(v.vf + 1, v.vf + Math.floor(span / 3));
    const r1 = r.int(d1 + 1, v.vf + Math.floor(span / 2));
    const d2 = r.int(r1 + 1, vend - 1);
    del(v.tgt, d1, r1);
    del(v.tgt, d2, r.chance(0.5) ? null : r.int(d2 + 1, Math.min(T, vend + 200)));
  };

  // Base traffic.
  const nLinks = level === 1 ? [3, 4] : level === 2 ? [3, 5] : [4, 5];
  for (const [lt] of types) {
    const isClean = lt === clean;
    const k = r.int(nLinks[0], nLinks[1]);
    for (let j = 0; j < k; j++) {
      const nv = r.pick([1, 1, 2, 2, 3]);
      let t = r.int(DAY, T - 2 * DAY);
      const versions = [];
      for (let i = 0; i < nv; i++) {
        const vt = t + r.int(3 * 60, 30 * 60);
        const open = vt >= T || (i === nv - 1 && r.chance(0.5));
        const pool = targetsOf.get(lt) || [];
        const reuse = pool.length && r.chance(0.15);
        const v = { vf: t, vt: open ? null : vt, tgt: reuse ? r.pick(pool) : fresh(lt) };
        versions.push(v);
        if (!isClean && !reuse) scenario(v);
        if (open) break;
        t = vt;
      }
      addLink(lt, versions);
    }
  }

  // Forced edge cases, each in a random dirty link type.
  const when = () => r.int(DAY, T - 3 * DAY);
  {                                                         // deleted exactly when the version ended: no episode
    const lt = r.pick(dirty)[0], a = when(), b = a + r.int(4 * 60, 20 * 60);
    const v = { vf: a, vt: b, tgt: fresh(lt) };
    del(v.tgt, b);
    addLink(lt, [v]);
  }
  {                                                         // re-pointed to a target that was already deleted
    const lt = r.pick(dirty)[0], a = when(), b = a + r.int(3 * 60, 12 * 60), c = b + r.int(2 * 60, 20 * 60);
    const v1 = { vf: a, vt: b, tgt: fresh(lt) }, v2 = { vf: b, vt: c, tgt: fresh(lt) };
    del(v2.tgt, b - r.int(60, 900));
    const vs = [v1, v2];
    if (r.chance(0.5)) vs.push({ vf: c, vt: null, tgt: fresh(lt) });
    addLink(lt, vs);
  }
  {                                                         // deleted exactly at the snapshot time: still dangling
    const lt = r.pick(dirty)[0];
    const v = { vf: when(), vt: null, tgt: fresh(lt) };
    del(v.tgt, T);
    addLink(lt, [v]);
  }
  {                                                         // deleted while linked, then re-pointed
    const lt = r.pick(dirty)[0], a = when(), b = a + r.int(5 * 60, 24 * 60);
    const v1 = { vf: a, vt: b, tgt: fresh(lt) };
    del(v1.tgt, r.int(a + 30, b - 30));
    addLink(lt, [v1, { vf: b, vt: null, tgt: fresh(lt) }]);
  }
  {                                                         // two links share one deleted target
    const lt = r.pick(dirty)[0], a = when(), a2 = a + r.int(30, 300);
    const o = fresh(lt), d = a2 + r.int(60, 600), b2 = d + r.int(60, 900);
    del(o, d);
    addLink(lt, [{ vf: a, vt: null, tgt: o }]);
    addLink(lt, [{ vf: a2, vt: b2, tgt: o }]);
  }
  if (level >= 2) {
    {                                                       // restored exactly at valid_to: credited to the link
      const lt = r.pick(dirty)[0], a = when(), b = a + r.int(5 * 60, 20 * 60);
      const v = { vf: a, vt: b, tgt: fresh(lt) };
      del(v.tgt, r.int(a + 30, b - 30), b);
      addLink(lt, [v]);
    }
    {                                                       // restored exactly at valid_from: no episode
      const lt = r.pick(dirty)[0], a = when();
      const v = { vf: a, vt: null, tgt: fresh(lt) };
      del(v.tgt, a - r.int(30, 600), a);
      addLink(lt, [v]);
    }
    {                                                       // deleted twice while linked: two episodes
      const lt = r.pick(dirty)[0], a = when();
      const v = { vf: a, vt: null, tgt: fresh(lt) };
      const d1 = a + r.int(60, 600), r1 = d1 + r.int(30, 900), d2 = r1 + r.int(60, 1200);
      del(v.tgt, d1, r1);
      del(v.tgt, d2, r.chance(0.5) ? null : d2 + r.int(60, 600));
      addLink(lt, [v]);
    }
  }
  if (level === 3) {
    {                                                       // shorter than the grace period: ignored
      const lt = r.pick(dirty)[0], a = when();
      const v = { vf: a, vt: null, tgt: fresh(lt) };
      const d = a + r.int(60, 900);
      del(v.tgt, d, d + r.int(1, G - 1));
      addLink(lt, [v]);
    }
    {                                                       // exactly the grace period: counts (restored)
      const lt = r.pick(dirty)[0], a = when(), b = a + r.int(10 * 60, 24 * 60);
      const v = { vf: a, vt: b, tgt: fresh(lt) };
      const d = a + r.int(30, 300);
      del(v.tgt, d, d + G);
      addLink(lt, [v]);
    }
    {                                                       // open and younger than the grace period: counts
      const lt = r.pick(dirty)[0];
      const v = { vf: when(), vt: null, tgt: fresh(lt) };
      del(v.tgt, T - r.int(1, G - 1));
      addLink(lt, [v]);
    }
  }

  // Ids: links by first valid_from.
  links.sort((a, b) => a.versions[0].vf - b.versions[0].vf || (a.src < b.src ? -1 : 1));
  let lid = 1000 + r.int(0, 8000);
  for (const L of links) L.id = "lnk_" + (lid += r.int(1, 23));

  // The oracle. opts break one rule each, for diagnostics.
  const round2 = (sum, n) => Math.floor((2 * sum * 100 + 60 * n) / (2 * 60 * n)) / 100;   // minutes -> hours, half up
  const compute = (o = {}) => {
    const per = new Map(types.map((t) => [t[0], { ep: 0, removed: 0, repointed: 0, restored: 0, open: 0, sum: 0, n: 0 }]));
    for (const L of links) {
      L.versions.forEach((v, i) => {
        const hasNext = i < L.versions.length - 1;
        for (const p of objects.get(v.tgt).periods) {
          if (!o.ignoreGrace && p.r !== null && (o.graceStrict ? p.r - p.d <= G : p.r - p.d < G)) continue;
          const pr = o.ignoreRestore ? null : p.r;
          const s = Math.max(v.vf, p.d);
          const vEnd = v.vt === null ? Infinity : v.vt, pEnd = pr === null ? Infinity : pr;
          const e = Math.min(vEnd, pEnd);
          if (o.zeroLen ? !(s <= e) : !(s < e)) continue;
          const S = o.fromDeletion ? p.d : s;
          const a = per.get(L.type);
          a.ep++;
          let out;
          if (e === Infinity) out = "open";
          else if (vEnd < pEnd || (vEnd === pEnd && !o.tieRestored)) out = hasNext && !o.noRepoint ? "repointed" : "removed";
          else out = "restored";
          if (out === "open") {
            a.open++;
            if (o.avgOpen) { a.sum += T - S; a.n++; }
          } else {
            a[out]++;
            a.sum += e - S;
            a.n++;
          }
        }
      });
    }
    const rows = [];
    for (const [lt, a] of per) {
      if (a.ep === 0 && o.dropZero) continue;
      const ep = a.ep === 0 && o.countStar ? 1 : a.ep;
      rows.push([lt, ep, a.removed, a.repointed, a.restored, a.open, a.n ? round2(a.sum, a.n) : null]);
    }
    return rows;
  };
  const expected = compute();

  const diagnostics = [
    { message: "An overlap of zero length was counted as an episode. A target deleted exactly when the link version ended (or restored exactly when it began) was never dangling: count an overlap only when its start is strictly before its end.", rows: compute({ zeroLen: true }) },
    { message: "An episode was timed from deleted_at even when the link version started later. A link re-pointed to a target that was already deleted starts dangling when the version starts: the start is the later of valid_from and deleted_at.", rows: compute({ fromDeletion: true }) },
    { message: "A link type with no episodes is missing. Start from link_types and LEFT JOIN the episodes, so a clean link type shows zeros and a NULL average.", rows: compute({ dropZero: true }) },
    { message: "A link type with no episodes shows 1 episode. After a LEFT JOIN, COUNT(*) counts the NULL-extended row; count a column of the episode side instead.", rows: compute({ countStar: true }) },
    { message: "Re-pointed links were counted as removed. A version closed by valid_to whose link has a next version was re-pointed; only a closed last version was removed.", rows: compute({ noRepoint: true }) },
    { message: "Still-dangling episodes were included in avg_hours_to_fix (measured to the snapshot time). The average covers resolved episodes only.", rows: compute({ avgOpen: true }) },
  ];
  if (level >= 2) {
    diagnostics.push(
      { message: "Restores were ignored: every deletion period was treated as open. A deletion period ends at restored_at, and an episode the restore ended is 'restored'.", rows: compute({ ignoreRestore: true }) },
      { message: "A restore at exactly the instant the version ended was credited as 'restored'. When valid_to equals restored_at, the link change is credited (removed or repointed).", rows: compute({ tieRestored: true }) },
    );
  }
  if (level === 3) {
    diagnostics.push(
      { message: `Deletion periods shorter than the ${G}-minute grace period were counted. A period restored less than ${G} minutes after it began is a delete-and-recreate by a sync, not an episode.`, rows: compute({ ignoreGrace: true }) },
      { message: `A deletion period lasting exactly ${G} minutes was ignored. Only periods restored less than ${G} minutes after they began are ignored; exactly ${G} minutes counts.`, rows: compute({ graceStrict: true }) },
    );
  }

  // Tables.
  const tRows = types.map((t) => [t[0], t[1], t[2]]);
  const oRows = [...objects.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([id, o]) => [id, o.type]);
  const dRows = [...objects.entries()]
    .flatMap(([id, o]) => o.periods.map((p) => ({ id, ...p })))
    .sort((a, b) => a.d - b.d || (a.id < b.id ? -1 : 1))
    .map((p) => [p.id, stamp(p.d), p.r === null ? null : stamp(p.r)]);
  const vRows = links
    .flatMap((L) => L.versions.map((v, i) => [L.id, i + 1, L.type, L.src, v.tgt, stamp(v.vf), v.vt === null ? null : stamp(v.vt)]))
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] - b[1]));
  const tCols = ["link_type", "source_object_type", "target_object_type"];
  const oCols = ["object_id", "object_type"];
  const dCols = ["object_id", "deleted_at", "restored_at"];
  const vCols = ["link_id", "version", "link_type", "source_object_id", "target_object_id", "valid_from", "valid_to"];

  const setup =
    "SET TIME ZONE 'UTC';\n" +
    "CREATE TABLE link_types (\n  link_type TEXT PRIMARY KEY,\n  source_object_type TEXT NOT NULL,\n  target_object_type TEXT NOT NULL\n);\n" +
    "CREATE TABLE objects (\n  object_id TEXT PRIMARY KEY,\n  object_type TEXT NOT NULL\n);\n" +
    "CREATE TABLE object_deletions (\n  object_id TEXT NOT NULL REFERENCES objects (object_id),\n  deleted_at TIMESTAMPTZ NOT NULL,\n  restored_at TIMESTAMPTZ,\n  PRIMARY KEY (object_id, deleted_at),\n  CHECK (restored_at IS NULL OR restored_at > deleted_at)\n);\n" +
    "CREATE TABLE link_versions (\n  link_id TEXT NOT NULL,\n  version INT NOT NULL,\n  link_type TEXT NOT NULL REFERENCES link_types (link_type),\n  source_object_id TEXT NOT NULL REFERENCES objects (object_id),\n  target_object_id TEXT NOT NULL REFERENCES objects (object_id),\n  valid_from TIMESTAMPTZ NOT NULL,\n  valid_to TIMESTAMPTZ,\n  PRIMARY KEY (link_id, version),\n  CHECK (valid_to IS NULL OR valid_to > valid_from)\n);\n" +
    insertSQL("link_types", tCols, tRows) + insertSQL("objects", oCols, oRows) +
    insertSQL("object_deletions", dCols, dRows) + insertSQL("link_versions", vCols, vRows);

  return {
    vars: {
      as_of: stamp(T),
      grace_minutes: G,
      link_type_list: types.map((t) => "`" + t[0] + "` (" + t[1].replace(/_/g, " ") + " → " + t[2].replace(/_/g, " ") + ")").join(", "),
      versions: vRows.length,
      deletions: dRows.length,
      restore_rule: level === 1
        ? "In this sample no deleted object has been restored yet, so `restored_at` is always NULL and `restored` is 0."
        : "An object can be deleted, restored and deleted again: each row of `object_deletions` is one period.",
      grace_rule: level === 3
        ? `Pipeline syncs sometimes delete an object and re-create it moments later. A deletion period whose restored_at is less than ${G} minutes after its deleted_at is ignored entirely; a period that lasted exactly ${G} minutes or longer, or is still open, counts.`
        : "Every deletion period counts.",
    },
    setup,
    tables: [
      { name: "link_types", columns: tCols, rows: tRows },
      { name: "objects", columns: oCols, rows: oRows },
      { name: "object_deletions", columns: dCols, rows: dRows },
      { name: "link_versions", columns: vCols, rows: vRows },
    ],
    expected: { columns: ["link_type", "episodes", "removed", "repointed", "restored", "still_dangling", "avg_hours_to_fix"], rows: expected },
    diagnostics: diagnostics.filter((d) => JSON.stringify(d.rows) !== JSON.stringify(expected)),
  };
}
