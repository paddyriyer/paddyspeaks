/* CFL-L2-03 — Debug a schema compatibility checker (debug, Python).
   Simulated practice scenario. All data is generated from the seed and is hypothetical.

   Contract (debug): like python, but `starter` is buggy code the candidate fixes.
   The evaluator's reference is the fixed code. expect comes from oracle() below, an
   independent JavaScript implementation of the specification in the template.
   Planted bugs (see the evaluator notes): type promotion checked in the wrong
   direction; a falsy default (0, "", False, None) treated as no default; the reader
   enum's default symbol ignored; a non-transitive mode checks the oldest version
   instead of the latest; the optional-field rule reversed.
   level: 1 Medium (BACKWARD and FORWARD, primitive fields, one or two versions)
          2 Hard (+ FULL, enums, optional fields, several versions)
          3 Very Hard (+ the transitive modes and enum default symbols) */
export const kind = "debug";
export const entry = "check_compatibility";
export const signature = "def check_compatibility(new_schema: dict, previous: list[dict], mode: str) -> list[list]:";
export const starter = `# (writer type -> reader types that can read it)
PROMOTIONS = {
    "int": {"long", "float", "double"},
    "long": {"float", "double"},
    "float": {"double"},
    "string": {"bytes"},
    "bytes": {"string"},
}


def _type_ok(reader_type, writer_type):
    if isinstance(reader_type, dict) and isinstance(writer_type, dict):
        # enums: every symbol the writer can produce must exist in the reader
        return set(writer_type["enum"]) <= set(reader_type["enum"])
    if isinstance(reader_type, dict) or isinstance(writer_type, dict):
        return False                     # an enum and a primitive never match
    return reader_type == writer_type or writer_type in PROMOTIONS.get(reader_type, ())


def _unreadable_fields(reader, writer):
    """Names of the reader's fields it cannot fill from data written with writer."""
    written = {f["name"]: f for f in writer["fields"]}
    bad = []
    for rf in reader["fields"]:
        wf = written.get(rf["name"])
        if wf is None:
            if not rf.get("default"):    # the reader needs a default for a field it never receives
                bad.append(rf["name"])
        elif not _type_ok(rf["type"], wf["type"]):
            bad.append(rf["name"])
        elif rf.get("optional") and not wf.get("optional"):
            bad.append(rf["name"])       # nulls the other side cannot hold
    return bad


def check_compatibility(new_schema, previous, mode):
    """previous: registered versions, oldest first (version 1 is previous[0]).
    Return sorted [version, "backward" | "forward", field] conflicts; [] if compatible."""
    if mode == "NONE" or not previous:
        return []
    versions = list(range(1, len(previous) + 1))
    if not mode.endswith("_TRANSITIVE"):
        versions = versions[:1]          # only the latest version
    base = mode.replace("_TRANSITIVE", "")
    conflicts = []
    for v in versions:
        old = previous[v - 1]
        if base in ("BACKWARD", "FULL"):          # the new schema reads old data
            conflicts += [[v, "backward", f] for f in _unreadable_fields(new_schema, old)]
        if base in ("FORWARD", "FULL"):           # old schemas read new data
            conflicts += [[v, "forward", f] for f in _unreadable_fields(old, new_schema)]
    return sorted(conflicts)
`;

export const prelude = `
def _gen_history(versions, fields, seed):
    x = seed
    def nxt():
        nonlocal x
        x = (1103515245 * x + 12345) % 2147483648
        return x >> 16
    kinds = [('int', 'long', 'double'), ('string', 'bytes'), ('float', 'double'), ('boolean',)]
    fam = [kinds[nxt() % 4] for _ in range(fields)]
    def schema():
        out = []
        for i in range(fields):
            if nxt() % 10 == 0:
                continue
            f = {'name': 'f%04d' % i, 'type': fam[i][nxt() % len(fam[i])]}
            r = nxt() % 6
            if r == 0:
                f['optional'] = True
                f['default'] = None
            elif r < 3:
                f['default'] = 0
            out.append(f)
        return {'name': 'Event', 'fields': out}
    history = [schema() for _ in range(versions)]
    return schema(), history, 'FULL_TRANSITIVE'
`.trim() + "\n";

const WIDEN = { int: ["long", "float", "double"], long: ["float", "double"], float: ["double"], string: ["bytes"], bytes: ["string"] };
const isEnum = (t) => typeof t === "object";

// Names of reader fields that cannot be filled from data written with writer (the specification).
function unreadable(reader, writer) {
  const w = new Map(writer.fields.map((f) => [f.name, f]));
  const out = [];
  for (const rf of reader.fields) {
    const wf = w.get(rf.name);
    let bad;
    if (!wf) bad = !("default" in rf);
    else if (isEnum(rf.type) !== isEnum(wf.type)) bad = true;
    else if (isEnum(rf.type)) {
      const rs = new Set(rf.type.enum);
      bad = !wf.type.enum.every((s) => rs.has(s)) && !("default" in rf.type);
    } else bad = rf.type !== wf.type && !(WIDEN[wf.type] || []).includes(rf.type);
    if (!bad && wf && wf.optional === true && rf.optional !== true) bad = true;
    if (bad) out.push(rf.name);
  }
  return out;
}

export function oracle(next, previous, mode) {
  if (mode === "NONE" || !previous.length) return [];
  const transitive = mode.endsWith("_TRANSITIVE");
  const base = transitive ? mode.slice(0, -"_TRANSITIVE".length) : mode;
  const out = [];
  previous.forEach((old, i) => {
    const v = i + 1;
    if (!transitive && v !== previous.length) return;
    if (base === "BACKWARD" || base === "FULL") for (const f of unreadable(next, old)) out.push([v, "backward", f]);
    if (base === "FORWARD" || base === "FULL") for (const f of unreadable(old, next)) out.push([v, "forward", f]);
  });
  const c = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
  return out.sort((a, b) => a[0] - b[0] || c(a[1], b[1]) || c(a[2], b[2]));
}

function py(v) {
  if (v === null) return "None";
  if (typeof v === "boolean") return v ? "True" : "False";
  if (typeof v === "number") return String(v);
  if (typeof v === "string") return "'" + v + "'";
  if (Array.isArray(v)) return "[" + v.map(py).join(", ") + "]";
  return "{" + Object.entries(v).map(([k, x]) => `'${k}': ${py(x)}`).join(", ") + "}";
}
const pyArgs = (next, prev, mode) => `(${py(next)}, ${py(prev)}, '${mode}')`;

// Field pool: name, family of interchangeable-looking types, or an enum.
const POOL = [
  ["order_id", ["string", "bytes"]], ["amount_minor", ["int", "long", "double"]], ["currency", ["string"]],
  ["created_at", ["long", "int"]], ["customer_id", ["string", "bytes"]], ["retries", ["int", "long"]],
  ["weight_kg", ["float", "double"]], ["is_test", ["boolean"]], ["note", ["string"]], ["score", ["float", "double", "int"]],
  ["status", "enum"], ["channel", "enum"],
];
const SYMBOLS = { status: ["PENDING", "PAID", "SHIPPED", "REFUNDED", "UNKNOWN"], channel: ["WEB", "APP", "STORE", "PARTNER", "OTHER"] };
const clone = (x) => JSON.parse(JSON.stringify(x));
const falsy = (t) => (t === "boolean" ? false : t === "string" || t === "bytes" ? "" : 0);
const truthy = (t) => (t === "boolean" ? true : t === "string" || t === "bytes" ? "n/a" : 1);

function makeField(r, level, name, fam) {
  if (fam === "enum") {
    const syms = SYMBOLS[name].slice(0, r.int(2, 4));
    const type = { enum: syms };
    if (level === 3 && r.chance(0.4)) type.default = syms[0];
    const f = { name, type };
    if (r.chance(0.4)) f.default = syms[0];
    return f;
  }
  const t = r.pick(fam);
  const f = { name, type: t };
  if (level >= 2 && r.chance(0.25)) { f.optional = true; if (r.chance(0.7)) f.default = null; }
  else if (r.chance(0.45)) f.default = r.chance(0.5) ? falsy(t) : truthy(t);
  return f;
}

function mutate(r, level, schema) {
  const s = clone(schema);
  const used = new Set(s.fields.map((f) => f.name));
  const pool = POOL.filter(([n, fam]) => !used.has(n) && (level >= 2 || fam !== "enum"));
  const ops = ["add", "remove", "retype", "retype"];
  if (level >= 2) ops.push("optional", "enum");
  const op = r.pick(ops);
  if (op === "add" && pool.length) {
    const [n, fam] = r.pick(pool);
    s.fields.push(makeField(r, level, n, fam));
  } else if (op === "remove" && s.fields.length > 2) {
    s.fields.splice(r.int(1, s.fields.length - 1), 1);
  } else if (op === "optional") {
    const f = r.pick(s.fields.filter((x) => !isEnum(x.type)));
    if (f && f.optional) { delete f.optional; if (f.default === null) f.default = falsy(f.type); }
    else if (f) { f.optional = true; f.default = null; }
  } else if (op === "enum") {
    const f = s.fields.find((x) => isEnum(x.type));
    if (f) {
      const all = SYMBOLS[f.name];
      if (r.chance(0.5) && f.type.enum.length < all.length) f.type.enum.push(all[f.type.enum.length]);
      else if (f.type.enum.length > 2) f.type.enum.pop();
      if (level === 3 && r.chance(0.3)) { if ("default" in f.type) delete f.type.default; else f.type.default = f.type.enum[0]; }
    }
  } else {
    const f = r.pick(s.fields.filter((x) => !isEnum(x.type)));
    const fam = f && POOL.find(([n]) => n === f.name)[1];
    if (f && fam.length > 1) f.type = r.pick(fam.filter((t) => t !== f.type));
  }
  return s;
}

function historyCase(r, level) {
  const names = r.sample(POOL.filter(([, fam]) => level >= 2 || fam !== "enum"), r.int(3, 5));
  if (level >= 2 && !names.some(([, fam]) => fam === "enum")) names.push(POOL[10 + r.int(0, 1)]);
  let cur = { name: r.pick(["Payment", "OrderPlaced", "Shipment", "Refund"]), fields: [["order_id", ["string"]], ...names.filter(([n]) => n !== "order_id")].map(([n, fam]) => makeField(r, level, n, fam)) };
  const nv = level === 1 ? r.int(1, 2) : level === 2 ? r.int(2, 3) : r.int(3, 5);
  const prev = [];
  for (let i = 0; i < nv; i++) {
    if (i) for (let k = r.int(1, 2); k > 0; k--) cur = mutate(r, level, cur);
    prev.push(cur);
  }
  let next = cur;
  for (let k = r.int(1, 3); k > 0; k--) next = mutate(r, level, next);
  const modes = level === 1 ? ["BACKWARD", "FORWARD"]
    : level === 2 ? ["BACKWARD", "FORWARD", "FULL"]
      : ["BACKWARD_TRANSITIVE", "FORWARD_TRANSITIVE", "FULL_TRANSITIVE", "FULL", "BACKWARD"];
  return { next, prev, mode: r.pick(modes) };
}

export function generate(r, level) {
  const samples = [];
  for (let i = 0; i < 3; i++) {
    let c;
    for (let k = 0; k < 40; k++) {
      c = historyCase(r, level);
      if (i === 2 || oracle(c.next, c.prev, c.mode).length) break;
    }
    samples.push({ args: pyArgs(c.next, c.prev, c.mode), expect: py(oracle(c.next, c.prev, c.mode)) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const rec = r.pick(["Payment", "OrderPlaced", "Shipment"]);
  const S = (...fields) => ({ name: rec, fields });
  const id = { name: "order_id", type: "string" };
  const st = (syms, dflt) => ({ name: "status", type: dflt ? { enum: syms, default: dflt } : { enum: syms } });
  const amt = r.pick(["amount_minor", "total_minor"]);
  const edges = [
    ["widening int to long is backward compatible",
      S(id, { name: amt, type: "long" }), [S(id, { name: amt, type: "int" })], "BACKWARD"],
    ["narrowing long to int is not backward compatible",
      S(id, { name: amt, type: "int" }), [S(id, { name: amt, type: "long" })], "BACKWARD"],
    ["a new field with default 0 is backward compatible",
      S(id, { name: "retries", type: "int", default: 0 }), [S(id)], "BACKWARD"],
    ["a new optional field with a null default is backward compatible",
      S(id, { name: "note", type: "string", optional: true, default: null }), [S(id)], "BACKWARD"],
    ["a new field without a default is not backward compatible, even if optional",
      S(id, { name: "note", type: "string", optional: true }, { name: "retries", type: "int" }), [S(id)], "BACKWARD"],
    ["removing a field the old schema needs is not forward compatible",
      S(id), [S(id, { name: "coupon", type: "string" }, { name: "retries", type: "int", default: 0 })], "FORWARD"],
    ["a new enum symbol is forward compatible when the old enum has a default symbol",
      S(id, st(["PENDING", "PAID", "UNKNOWN", "REFUNDED"])), [S(id, st(["PENDING", "PAID", "UNKNOWN"], "UNKNOWN"))], "FORWARD"],
    ["a new enum symbol without an old default is not forward compatible",
      S(id, st(["PENDING", "PAID", "REFUNDED"])), [S(id, st(["PENDING", "PAID"]))], "FORWARD"],
    ["a non-transitive mode checks only the latest version",
      S(id, { name: "region", type: "string" }), [S(id), S(id, { name: "region", type: "string", default: "eu" })], "BACKWARD"],
    ["making an optional field required is not backward compatible",
      S(id, { name: "note", type: "string" }), [S(id, { name: "note", type: "string", optional: true, default: null })], "BACKWARD"],
    ["making a required field optional is backward compatible",
      S(id, { name: "note", type: "string", optional: true, default: null }), [S(id, { name: "note", type: "string" })], "BACKWARD"],
    ["NONE accepts anything",
      S(id, { name: amt, type: "int" }), [S({ name: amt, type: "string" })], "NONE"],
    ["an enum never matches a string field",
      S(id, { name: "channel", type: "string" }), [S(id, { name: "channel", type: { enum: ["WEB", "APP"] } })], "BACKWARD"],
  ];
  if (level >= 2) {
    edges.push(["FULL checks both directions",
      S(id, { name: amt, type: "long" }, { name: "note", type: "string", optional: true }), [S(id, { name: amt, type: "int" }, { name: "currency", type: "string" })], "FULL"]);
  }
  if (level === 3) {
    edges.push(["a transitive mode checks every version",
      S(id, { name: "region", type: "string" }), [S(id), S(id, { name: "region", type: "string", default: "eu" })], "BACKWARD_TRANSITIVE"]);
    edges.push(["FULL_TRANSITIVE: each version, both directions",
      S(id, st(["PENDING", "PAID", "SHIPPED"], "PENDING")),
      [S(id, st(["PENDING", "PAID"])), S(id, st(["PENDING", "PAID", "SHIPPED", "REFUNDED"], "PENDING")), S(id, st(["PENDING", "PAID", "SHIPPED"], "PENDING"))], "FULL_TRANSITIVE"]);
  }
  for (const [name, next, prev, mode] of edges) tests.push({ name, args: pyArgs(next, prev, mode), expect: py(oracle(next, prev, mode)) });
  tests.push({ name: "a first version: nothing registered yet", args: pyArgs(S(id), [], "FULL_TRANSITIVE"), expect: "[]" });

  tests.push({ name: "300 versions of 300 fields, FULL_TRANSITIVE, in time", args: `_gen_history(300, 300, ${r.int(1, 1_000_000)})`, limit_s: 8 });

  return {
    vars: {
      subject: r.pick(["payments-value", "orders-value", "shipments-value", "refunds-value"]),
      replay_rule: level === 1
        ? "This replay uses `BACKWARD` and `FORWARD` with primitive fields and one or two registered versions; the checks also cover the other modes and enums."
        : level === 2
          ? "This replay adds `FULL`, enums and optional fields, with several registered versions."
          : "This replay adds the transitive modes and enums with default symbols, with up to five registered versions.",
    },
    samples,
    tests,
  };
}
