/* PLT-L1-01 — Current property values when user edits and pipeline syncs both write an
   object, and the share of properties held by user edits per object type (SQL).
   Simulated practice scenario. All data is generated from the seed and is hypothetical;
   the "latest wins, ties to the edit" rule is this exercise's model, not a description
   of how any product resolves edits.

   Contract: see docs/COMPANY-INTERVIEW-LOOPS.md § Executable templates (sql).
   The oracle resolves every (object, property) by sorting its writes in JavaScript.
   level: 1 Medium (latest wins; an edit and a sync at the same instant; a sync that
                    overrides an older edit)
          2 Hard (+ NULL writes that clear a property, including an object whose every
                  property is cleared; two writes of one source at one instant, decided
                  by write_id; write ids not in time order)
          3 Very Hard (+ a report instant: writes after it ignored, one exactly at it kept;
                       objects deleted before, exactly at and after it) */
import { insertSQL, ts } from "../../js/rng.js";

export const kind = "sql";

const MIN = 60;
const DAY = 86400;
const BASE = Date.UTC(2026, 8, 14) / 1000;                       // 2026-09-14 00:00 UTC
const TYPES = ["asset", "inventory_lot", "machine", "maintenance_order", "shipment", "supplier", "work_order"];
const PROPS = ["location", "next_review", "owner", "priority", "status"];
const VALUES = {
  location: ["bay_2", "bay_7", "plant_east", "plant_west", "yard"],
  next_review: ["2026-10-01", "2026-10-15", "2026-11-02", "2026-12-07"],
  owner: ["team_a", "team_b", "team_c", "team_d"],
  priority: ["high", "low", "medium", "urgent"],
  status: ["active", "blocked", "closed", "on_hold", "open"],
};

function stamp(sec) {
  const day = new Date((BASE + sec) * 1000).toISOString().slice(0, 10);
  return ts(day, ((sec % DAY) + DAY) % DAY);
}

export function generate(r, level) {
  const asOf = level === 3 ? 2 * DAY + r.pick([10, 12, 14, 16]) * 3600 : 3 * DAY;   // L1/L2: after every write
  const span = 3 * DAY - MIN;
  const types = r.sample(TYPES, level === 1 ? 3 : 4).sort();
  const objects = [];
  const usedIds = new Set();
  for (const t of types) {
    const n = level === 1 ? r.int(2, 3) : r.int(3, 4);
    for (let i = 0; i < n; i++) {
      let id;
      do id = t.replace(/_/g, "-") + "-" + r.int(100, 999); while (usedIds.has(id));
      usedIds.add(id);
      objects.push({ id, type: t, deleted: null, pairs: [] });
    }
  }

  const writes = [];
  const pairs = [];
  const val = (p) => r.pick(VALUES[p.prop]);
  const add = (p, source, at, value) => {
    const w = { obj: p.obj, prop: p.prop, source, at, value, id: 0 };
    p.writes.push(w);
    p.used.add(at);
    writes.push(w);
    return w;
  };
  const freeTime = (p, lo, hi) => {
    let at;
    do at = r.int(lo / MIN, hi / MIN) * MIN; while (p.used.has(at));
    return at;
  };
  for (const o of objects) {
    for (const prop of r.sample(PROPS, r.int(1, 3)).sort()) {
      const p = { obj: o, prop, writes: [], used: new Set() };
      o.pairs.push(p);
      pairs.push(p);
      const nSync = r.int(1, 3), nEdit = r.int(0, 2);
      for (let k = 0; k < nSync; k++) add(p, "sync", freeTime(p, 0, span), level >= 2 && r.chance(0.12) ? null : val(p));
      for (let k = 0; k < nEdit; k++) add(p, "edit", freeTime(p, 0, span), level >= 2 && r.chance(0.12) ? null : val(p));
    }
  }
  const fresh = (exclude) => r.sample(pairs.filter((p) => !exclude.has(p)), 1)[0];
  const planted = new Set();
  // Planted pairs get an explicit history, all before the report instant.
  const reset = (p) => { p.writes.length = 0; p.used.clear(); };
  const history = (p, until) => { if (r.chance(0.6)) add(p, r.pick(["sync", "edit"]), until - r.int(60, 900) * MIN, val(p)); };
  // Every level: an edit and a sync at the same instant, after everything else on the pair.
  {
    const p = fresh(planted); planted.add(p); reset(p);
    const t = asOf - r.int(30, 600) * MIN;
    history(p, t);
    add(p, "sync", t, val(p)); add(p, "edit", t, val(p));
  }
  // Every level: a sync that overrides an older edit (edits do not win forever).
  {
    const p = fresh(planted); planted.add(p); reset(p);
    const t = asOf - r.int(90, 900) * MIN;
    add(p, "sync", t - r.int(60, 600) * MIN, val(p));
    add(p, "edit", t, val(p));
    add(p, "sync", t + r.int(5, 60) * MIN, val(p));
  }
  const tieGroups = [];
  if (level >= 2) {
    // Two syncs at one instant: the higher write_id wins, and here it clears the property.
    {
      const p = fresh(planted); planted.add(p); reset(p);
      const t = asOf - r.int(20, 600) * MIN;
      history(p, t);
      const a = add(p, "sync", t, val(p));
      const b = add(p, "sync", t, null);
      tieGroups.push([a, b]);
    }
    // A NULL that was later overwritten: the property has a value again.
    {
      const p = fresh(planted); planted.add(p); reset(p);
      const t = asOf - r.int(90, 900) * MIN;
      add(p, "sync", t - r.int(60, 600) * MIN, val(p));
      add(p, "edit", t, null);
      add(p, "sync", t + r.int(5, 60) * MIN, val(p));
    }
    // An object whose every property is cleared by a user edit.
    {
      const o = r.pick(objects.filter((x) => x.pairs.every((p) => !planted.has(p))));
      for (const p of o.pairs) {
        planted.add(p);
        reset(p);
        const t = asOf - r.int(10, 600) * MIN;
        add(p, "sync", t - r.int(60, 600) * MIN, val(p));
        add(p, "edit", t, null);
      }
    }
  }
  if (level === 3) {
    // A write exactly at the report instant counts; an edit after it does not.
    {
      const p = fresh(planted); planted.add(p); reset(p);
      add(p, "sync", asOf - r.int(60, 600) * MIN, val(p));
      add(p, "edit", asOf, val(p));
    }
    {
      const p = fresh(planted); planted.add(p); reset(p);
      add(p, "sync", asOf - r.int(60, 600) * MIN, val(p));
      add(p, "edit", asOf + r.int(1, 240) * MIN, val(p));
    }
    const free = r.shuffle(objects.filter((o) => o.pairs.every((p) => !planted.has(p))));
    free[0].deleted = asOf - r.int(1, 20) * 3600;          // deleted before the report instant
    free[1].deleted = asOf;                                // deleted exactly at it: gone
    free[2].deleted = asOf + r.int(1, 8) * 3600;           // deleted after it: still there
  }
  // Drop the writes of pairs that were reset above.
  const live = new Set(pairs.flatMap((p) => p.writes));
  const all = r.shuffle(writes.filter((w) => live.has(w)));
  let id = 5000 + r.int(0, 4000);
  for (const w of all) w.id = id += r.int(1, 9);            // arrival order, not time order
  for (const [a, b] of tieGroups) if (a.id > b.id) [a.id, b.id] = [b.id, a.id];

  const cmpS = (x, y) => (x < y ? -1 : x > y ? 1 : 0);
  const solve = (o = {}) => {
    const cut = o.ignoreAsOf ? Infinity : asOf;
    const per = new Map();
    for (const p of pairs) {
      const ob = p.obj;
      if (!o.keepDeleted && ob.deleted !== null && ob.deleted <= cut) continue;
      let ws = p.writes.filter((w) => (o.asOfExclusive ? w.at < cut : w.at <= cut));
      if (o.skipNull) ws = ws.filter((w) => w.value !== null);
      if (o.editsAlways && ws.some((w) => w.source === "edit")) ws = ws.filter((w) => w.source === "edit");
      if (!ws.length) continue;
      const editRank = (w) => (w.source === "edit" ? (o.tieSync ? 1 : 0) : (o.tieSync ? 0 : 1));
      ws.sort(o.byId
        ? (a, b) => b.id - a.id
        : (a, b) => b.at - a.at || editRank(a) - editRank(b) || (o.lowId ? a.id - b.id : b.id - a.id));
      const win = ws[0];
      if (win.value === null && !o.countNull) continue;
      if (!per.has(ob.type)) per.set(ob.type, { objs: new Set(), props: 0, edit: 0 });
      const s = per.get(ob.type);
      s.objs.add(ob.id);
      s.props++;
      if (win.source === "edit") s.edit++;
    }
    const share = (n, d) => Math.floor((n * 20000 + d) / (2 * d)) / 10000;
    return [...per.entries()].sort((a, b) => cmpS(a[0], b[0]))
      .map(([t, s]) => [t, s.objs.size, s.props, s.edit, share(s.edit, s.props)]);
  };
  const rows = solve();

  const diagnostics = [
    { message: "At an equal written_at the sync won. In this exercise's model the user edit wins a tie with a pipeline sync.", rows: solve({ tieSync: true }) },
    { message: "User edits were treated as always winning. A later sync overrides an older edit: the latest write wins.", rows: solve({ editsAlways: true }) },
    { message: "The latest write was chosen by write_id. Ids are assigned on arrival, not in written_at order; order by written_at first.", rows: solve({ byId: true }) },
  ];
  if (level >= 2) {
    diagnostics.push({ message: "A winning NULL was counted as a property. A NULL write clears the property: no current value, not counted.", rows: solve({ countNull: true }) });
    diagnostics.push({ message: "NULL writes were filtered out before choosing the winner, so an older value came back. A NULL write still wins when it is the latest; it clears the property.", rows: solve({ skipNull: true }) });
    diagnostics.push({ message: "Two writes of one source at one instant were broken by the lower write_id. The higher write_id wins.", rows: solve({ lowId: true }) });
  }
  if (level === 3) {
    diagnostics.push({ message: "Writes after the report instant were used. The state is as of " + stamp(asOf) + "; later writes do not exist yet.", rows: solve({ ignoreAsOf: true }) });
    diagnostics.push({ message: "Writes exactly at the report instant were dropped (and an object deleted exactly then was kept). The instant itself is included: written_at <= as_of, deleted_at <= as_of.", rows: solve({ asOfExclusive: true }) });
    diagnostics.push({ message: "Deleted objects were kept. An object deleted at or before the report instant has no current properties.", rows: solve({ keepDeleted: true }) });
  }

  const oCols = ["object_id", "object_type", "deleted_at"];
  const oRows = objects.slice().sort((a, b) => cmpS(a.id, b.id)).map((o) => [o.id, o.type, o.deleted === null ? null : stamp(o.deleted)]);
  const wCols = ["write_id", "object_id", "property", "value", "source", "written_at"];
  const wRows = all.slice().sort((a, b) => a.id - b.id).map((w) => [w.id, w.obj.id, w.prop, w.value, w.source, stamp(w.at)]);
  const setup =
    "SET TIME ZONE 'UTC';\n" +
    "CREATE TABLE objects (\n  object_id TEXT PRIMARY KEY,\n  object_type TEXT NOT NULL,\n  deleted_at TIMESTAMPTZ\n);\n" +
    "CREATE TABLE property_writes (\n  write_id BIGINT PRIMARY KEY,\n  object_id TEXT NOT NULL REFERENCES objects(object_id),\n  property TEXT NOT NULL,\n  value TEXT,\n  source TEXT NOT NULL CHECK (source IN ('edit', 'sync')),\n  written_at TIMESTAMPTZ NOT NULL\n);\n" +
    insertSQL("objects", oCols, oRows) + insertSQL("property_writes", wCols, wRows);

  return {
    vars: {
      as_of: stamp(asOf),
      writes: wRows.length,
      null_rule: level === 1
        ? "In this sample no write has a NULL `value`."
        : "Several writes here have a NULL `value`.",
      tie_rule: level === 1
        ? "In this sample that never happens."
        : "Here it does.",
      delete_rule: level === 3
        ? "Here some writes come after the report instant, and some objects were deleted."
        : "In this sample every write is at or before the report instant and no object is deleted.",
    },
    setup,
    tables: [
      { name: "objects", columns: oCols, rows: oRows },
      { name: "property_writes", columns: wCols, rows: wRows },
    ],
    expected: { columns: ["object_type", "objects", "properties", "edit_held", "edit_share"], rows },
    diagnostics: diagnostics.filter((d) => JSON.stringify(d.rows) !== JSON.stringify(rows)),
  };
}
