/* PLT-L2-03 — Debug the ontology object sync (debug, Python).
   Simulated practice scenario. All data is generated from the seed.

   Contract (debug): like python, but `starter` is buggy code the candidate fixes.
   The evaluator's reference is the fixed code. expect comes from oracle() below,
   an independent JavaScript implementation of the specification in the template.
   Planted bugs (see the evaluator notes): a changed primary key copies the object
   instead of moving it; deletes are applied after all upserts instead of in commit
   order; bool("false") is True; a timestamp without a zone is read as UTC instead
   of the source's local time; an explicit null is skipped instead of clearing the
   property.
   level: 1 Medium (upserts, deletes, typed casts and nulls) · 2 Hard (+ changed
          primary keys and rows deleted and re-created in one batch) · 3 Very Hard
          (+ timestamps with and without zones, properties outside the schema) */
export const kind = "debug";
export const entry = "sync_objects";
export const signature = "def sync_objects(store: dict, changes: list[dict], schema: dict, source_offset: int) -> dict:";
export const starter = `from datetime import datetime, timedelta


def _cast(kind, raw, source_offset):
    if kind == "int":
        return int(raw)
    if kind == "bool":
        return bool(raw)
    if kind == "timestamp":
        text = raw.strip().replace("T", " ")
        offset = 0
        if text.endswith("Z"):
            text = text[:-1]
        elif len(text) > 19 and text[19] in "+-":
            sign = 1 if text[19] == "+" else -1
            offset = sign * (int(text[20:22]) * 60 + int(text[23:25]))
            text = text[:19]
        t = datetime.strptime(text, "%Y-%m-%d %H:%M:%S") - timedelta(minutes=offset)
        return t.strftime("%Y-%m-%dT%H:%M:%SZ")
    return raw


def sync_objects(store, changes, schema, source_offset):
    # apply upserts first, then deletes, so each object is written once
    upserts = [ch for ch in changes if ch["op"] == "upsert"]
    deletes = [ch for ch in changes if ch["op"] == "delete"]
    for ch in upserts:
        pk = ch["pk"]
        old = ch.get("old_pk")
        obj = dict(store.get(old if old in store else pk, {}))
        for name, raw in ch["props"].items():
            if name not in schema:
                continue
            if raw is None:
                continue
            obj[name] = _cast(schema[name], raw, source_offset)
        store[pk] = obj
    for ch in deletes:
        store.pop(ch["pk"], None)
    return store
`;

export const prelude = `
def _gen_sync(n, seed):
    x = seed

    def nxt():
        nonlocal x
        x = (1103515245 * x + 12345) % 2147483648
        return x >> 8

    schema = {'status': 'str', 'quantity': 'int', 'hazardous': 'bool', 'promised_at': 'timestamp', 'carrier': 'str'}
    store = {}
    for i in range(20000):
        store['SHP-%06d' % i] = {'status': 'open', 'quantity': i % 40, 'hazardous': False,
                                 'promised_at': '2026-03-01T12:00:00Z', 'carrier': 'C%d' % (i % 9)}
    zones = ['', 'Z', '+02:00', '-05:00']
    changes = []
    top = 20000
    for _ in range(n):
        r = nxt()
        k = r % 20
        pk = 'SHP-%06d' % (nxt() % (top + 50))
        if k < 2:
            changes.append({'op': 'delete', 'pk': pk})
            continue
        props = {}
        if r % 3 == 0:
            props['status'] = ['open', 'packed', 'shipped', 'held'][nxt() % 4]
        if r % 4 == 0:
            props['quantity'] = '%03d' % (nxt() % 500)
        if r % 5 == 0:
            props['hazardous'] = 'true' if nxt() % 2 else 'FALSE'
        if r % 7 == 0:
            t = nxt()
            props['promised_at'] = '2026-03-%02d %02d:%02d:00%s' % (1 + t % 28, t % 24, t % 60, zones[t % 4])
        if r % 11 == 0:
            props['carrier'] = None
        if r % 13 == 0:
            props['legacy_code'] = 'X%d' % r
        ch = {'op': 'upsert', 'pk': pk, 'props': props}
        if k == 2:
            top += 1
            ch['pk'] = 'SHP-%06d' % (top + 50)
            ch['old_pk'] = pk
        changes.append(ch)
    return store, changes, schema, -300
`.trim() + "\n";

// The specification, implemented independently of the Python reference.
const TS = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})(Z|[+-]\d{2}:\d{2})?$/;
function toUtc(raw, sourceOffset) {
  const m = TS.exec(raw.trim());
  let off = sourceOffset;
  if (m[7] === "Z") off = 0;
  else if (m[7]) off = (m[7][0] === "+" ? 1 : -1) * (Number(m[7].slice(1, 3)) * 60 + Number(m[7].slice(4, 6)));
  const ms = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) - off * 60000;
  return new Date(ms).toISOString().slice(0, 19) + "Z";
}
function cast(type, raw, sourceOffset) {
  if (raw === null) return null;
  if (type === "int") return parseInt(raw, 10);
  if (type === "bool") return raw.trim().toLowerCase() === "true";
  if (type === "timestamp") return toUtc(raw, sourceOffset);
  return raw;
}
export function oracle(store, changes, schema, sourceOffset) {
  const out = new Map(Object.entries(store).map(([k, v]) => [k, { ...v }]));
  for (const ch of changes) {
    if (ch.op === "delete") { out.delete(ch.pk); continue; }
    let obj;
    if (ch.old_pk != null && ch.old_pk !== ch.pk && out.has(ch.old_pk)) {
      obj = out.get(ch.old_pk);
      out.delete(ch.old_pk);
    } else obj = { ...(out.get(ch.pk) || {}) };
    for (const [name, raw] of Object.entries(ch.props)) {
      if (!(name in schema)) continue;
      obj[name] = cast(schema[name], raw, sourceOffset);
    }
    out.set(ch.pk, obj);
  }
  return Object.fromEntries(out);
}

function py(v) {
  if (v === null || v === undefined) return "None";
  if (typeof v === "boolean") return v ? "True" : "False";
  if (typeof v === "number") return String(v);
  if (typeof v === "string") return "'" + v + "'";
  if (Array.isArray(v)) return "[" + v.map(py).join(", ") + "]";
  return "{" + Object.entries(v).map(([k, x]) => `'${k}': ${py(x)}`).join(", ") + "}";
}
const pyArgs = (c) => `(${py(c.store)}, ${py(c.changes)}, ${py(c.schema)}, ${c.offset})`;
const run = (c) => oracle(c.store, c.changes, c.schema, c.offset);

const OBJECT_TYPES = [
  { prefix: "WO", str: ["status", "crew"], int: ["priority", "estimate_hours"], bool: ["safety_critical", "parts_ready"], ts: ["due_at", "opened_at"],
    statuses: ["open", "scheduled", "in_progress", "done"], other: ["C1", "C2", "night"] },
  { prefix: "SHP", str: ["status", "carrier"], int: ["quantity", "pallets"], bool: ["hazardous", "expedite"], ts: ["promised_at", "shipped_at"],
    statuses: ["open", "packed", "shipped", "held"], other: ["road", "rail", "parcel"] },
  { prefix: "BED", str: ["status", "ward"], int: ["floor", "capacity"], bool: ["isolation", "staffed"], ts: ["available_at", "cleaned_at"],
    statuses: ["free", "occupied", "cleaning", "closed"], other: ["north", "south", "east"] },
];
const OFFSETS = [-300, -240, -420, 60, 120, 330, 540];

const pad = (n, w = 2) => String(n).padStart(w, "0");
function rawTs(r, zoned) {
  const s = `2026-0${r.int(3, 4)}-${pad(r.int(1, 28))}${r.pick([" ", "T"])}${pad(r.int(0, 23))}:${pad(r.pick([0, 15, 30, 45]))}:00`;
  if (!zoned) return s;
  return s + r.pick(["Z", "+02:00", "-05:00", "+05:30"]);
}

function setting(r) {
  const t = r.pick(OBJECT_TYPES);
  const schema = {};
  for (const p of t.str) schema[p] = "str";
  for (const p of t.int) schema[p] = "int";
  for (const p of t.bool) schema[p] = "bool";
  for (const p of t.ts) schema[p] = "timestamp";
  const offset = r.pick(OFFSETS);
  return { t, schema, offset, id: (n) => `${t.prefix}-${n}` };
}

// A typed object as it already sits in the store.
function stored(r, S) {
  const t = S.t;
  return {
    [t.str[0]]: r.pick(t.statuses), [t.str[1]]: r.pick(t.other),
    [t.int[0]]: r.int(1, 40), [t.bool[0]]: r.chance(0.5),
    [t.ts[0]]: `2026-03-${pad(r.int(1, 28))}T${pad(r.int(0, 23))}:00:00Z`,
  };
}

function randomProps(r, S, level) {
  const t = S.t, p = {};
  if (r.chance(0.6)) p[t.str[0]] = r.pick(t.statuses);
  if (r.chance(0.35)) p[t.str[1]] = r.chance(0.25) ? null : r.pick(t.other);
  if (r.chance(0.4)) p[t.int[r.int(0, 1)]] = r.chance(0.3) ? pad(r.int(0, 60), 3) : String(r.int(0, 60));
  if (r.chance(0.4)) p[t.bool[r.int(0, 1)]] = r.pick(["true", "false", "True", "FALSE"]);
  if (level === 3 && r.chance(0.45)) p[t.ts[r.int(0, 1)]] = rawTs(r, r.chance(0.5));
  if (level === 3 && r.chance(0.2)) p.legacy_code = "L" + r.int(100, 999);
  if (!Object.keys(p).length) p[t.str[0]] = r.pick(t.statuses);
  return p;
}

function streamCase(r, level) {
  const S = setting(r);
  const store = {};
  const ids = Array.from({ length: 4 }, () => r.int(1000, 9999)).filter((v, i, a) => a.indexOf(v) === i);
  for (const n of ids) store[S.id(n)] = stored(r, S);
  const live = Object.keys(store);
  const changes = [];
  let fresh = r.int(10000, 20000);                 // new keys never collide with existing ones
  const steps = level === 1 ? r.int(5, 7) : r.int(7, 10);
  for (let i = 0; i < steps; i++) {
    const roll = r.next();
    if (roll < 0.15 && live.length) {
      const pk = r.pick(live);
      changes.push({ op: "delete", pk });
      if (level >= 2 && r.chance(0.5)) changes.push({ op: "upsert", pk, props: randomProps(r, S, level) });   // re-created
    } else if (roll < 0.3 && level >= 2 && live.length) {
      const old = r.pick(live), pk = S.id(fresh += r.int(1, 90));
      changes.push({ op: "upsert", pk, old_pk: old, props: randomProps(r, S, level) });
      live.push(pk);
    } else if (roll < 0.45) {
      const pk = S.id(fresh += r.int(1, 90));
      changes.push({ op: "upsert", pk, props: randomProps(r, S, level) });
      live.push(pk);
    } else {
      changes.push({ op: "upsert", pk: live.length ? r.pick(live) : S.id(r.int(1000, 9999)), props: randomProps(r, S, level) });
    }
  }
  return { store, changes, schema: S.schema, offset: S.offset };
}

export function generate(r, level) {
  const samples = [];
  for (let i = 0; i < 2; i++) {
    const c = streamCase(r, level);
    samples.push({ args: pyArgs(c), expect: py(run(c)) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const S = setting(r);
  const t = S.t;
  const [a, b, c] = [r.int(100, 399), r.int(400, 699), r.int(700, 999)];
  const A = S.id(a), B = S.id(b), C = S.id(c);
  const obj = () => stored(r, S);
  const st = t.str[0], other = t.str[1], num = t.int[0], flag = t.bool[0], when = t.ts[0];
  const base = () => ({ [A]: obj(), [B]: obj() });
  const mk = (store, changes) => ({ store, changes, schema: S.schema, offset: S.offset });
  const up = (pk, props, old) => (old ? { op: "upsert", pk, old_pk: old, props } : { op: "upsert", pk, props });
  const q = r.int(2, 60);
  const edges = [
    ["a changed primary key moves the object; the old key is gone",
      mk(base(), [up(C, { [st]: t.statuses[1] }, A)])],
    ["a key change for an object the store never had is a plain insert",
      mk(base(), [up(C, { [st]: t.statuses[2], [num]: String(q) }, S.id(a + 1000))])],
    ["a row deleted and re-created in one batch starts again from the new row",
      mk(base(), [{ op: "delete", pk: A }, up(A, { [st]: t.statuses[0] })])],
    ["a delete after an upsert in the same batch removes the object",
      mk(base(), [up(B, { [st]: t.statuses[3] }), { op: "delete", pk: B }])],
    ["a delete for an unknown key changes nothing",
      mk(base(), [{ op: "delete", pk: C }])],
    ['the text "false" casts to False, in any letter case',
      mk(base(), [up(A, { [flag]: "false" }), up(B, { [flag]: "FALSE", [t.bool[1]]: "True" })])],
    ["integers arrive as text, with leading zeros or a sign",
      mk(base(), [up(A, { [num]: pad(q, 4) }), up(B, { [t.int[1]]: "-" + q })])],
    ["a timestamp without a zone is in the source system's local time",
      mk(base(), [up(A, { [when]: `2026-03-31 ${pad(r.int(20, 23))}:30:00` }), up(B, { [t.ts[1]]: "2026-03-01T00:15:00" })])],
    ["a timestamp with Z or its own offset keeps that offset",
      mk(base(), [up(A, { [when]: "2026-03-01T08:00:00Z" }), up(B, { [when]: "2026-03-01 08:00:00+05:30", [t.ts[1]]: "2026-02-28T22:00:00-05:00" })])],
    ["an explicit null clears a property; a missing property keeps its value",
      mk(base(), [up(A, { [other]: null }), up(B, { [st]: t.statuses[2] })])],
    ["a property outside the schema is ignored",
      mk(base(), [up(A, { legacy_code: "L42", [st]: t.statuses[1] })])],
  ];
  for (const [name, cse] of edges) tests.push({ name, args: pyArgs(cse), expect: py(run(cse)) });

  const n = level === 1 ? 100000 : 200000;
  tests.push({ name: `${n.toLocaleString("en-US")} change rows in time`, args: `_gen_sync(${n}, ${r.int(1, 1_000_000)})`, limit_s: 8 });

  return {
    vars: {
      replay_rule: level === 1
        ? "This replay holds upserts and deletes with typed casts and explicit nulls; the checks also cover changed primary keys and timestamps."
        : level === 2
          ? "This replay also holds changed primary keys and rows deleted and re-created in the same batch."
          : "This replay holds every case: changed primary keys, rows deleted and re-created in one batch, timestamps with and without zones, and properties outside the schema.",
    },
    samples,
    tests,
  };
}
