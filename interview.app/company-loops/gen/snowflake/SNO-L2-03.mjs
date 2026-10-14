/* SNO-L2-03 — Debug a semi-structured JSON flattener (debug, Python).
   Simulated practice scenario. All data is generated from the seed.

   Contract (debug): like python, but `starter` is buggy code the candidate fixes.
   The evaluator's reference is the fixed code. expect comes from oracle() below,
   an independent JavaScript implementation of the specification in the template.
   Planted bugs (see the evaluator notes): JSON nulls are dropped; empty objects and
   arrays vanish; keys are lower-cased, so `id` and `ID` collide; only keys with a
   dot are quoted, and quotes inside a key are not escaped; the depth limit expands
   one level too far.
   level: 1 Medium (nested objects and arrays, nulls, mixed-case keys) · 2 Hard
          (+ empty containers, keys with spaces, hyphens and leading digits) ·
          3 Very Hard (+ a depth limit, quotes inside keys, keys that differ only by case) */
export const kind = "debug";
export const entry = "flatten_records";
export const signature = "def flatten_records(records: list[dict], max_depth: int | None = None) -> list[dict]:";
export const starter = `def _segment(key):
    if "." in key:
        return '["' + key + '"]'
    return key


def _walk(value, path, depth, max_depth, out):
    expand = max_depth is None or depth <= max_depth
    if isinstance(value, dict) and expand:
        for key, child in value.items():
            key = key.lower()              # column names are case-insensitive
            seg = _segment(key)
            if not path:
                child_path = seg
            elif seg.startswith("["):
                child_path = path + seg
            else:
                child_path = path + "." + seg
            _walk(child, child_path, depth + 1, max_depth, out)
    elif isinstance(value, list) and expand:
        for i, child in enumerate(value):
            _walk(child, path + "[" + str(i) + "]", depth + 1, max_depth, out)
    elif value is not None:
        out[path] = value


def flatten_records(records, max_depth=None):
    rows = []
    for record in records:
        out = {}
        _walk(record, "", 0, max_depth, out)
        rows.append(out)
    return rows
`;

export const prelude = `
def _gen_documents(n, seed):
    x, out = seed, []
    def nxt():
        nonlocal x
        x = (1103515245 * x + 12345) % 2147483648
        return x >> 16
    for i in range(n):
        items = [{'sku': 'S%05d' % nxt(), 'qty': 1 + nxt() % 5, 'price': (nxt() % 10000) / 100,
                  'attrs': {'Color': None if nxt() % 7 == 0 else 'c%d' % (nxt() % 9), 'size-eu': nxt() % 50}}
                 for _ in range(1 + nxt() % 6)]
        out.append({'eventId': 'e%07d' % i, 'type': 'order', 'user': {'id': nxt(), 'tier': ['free', 'pro'][nxt() % 2],
                    'tags': [] if nxt() % 3 == 0 else ['t%d' % (nxt() % 20)]},
                    'items': items, 'geo': {'ip country': 'C%d' % (nxt() % 60), 'coords': [nxt() % 180, nxt() % 90]},
                    'meta': {}})
    return out
`.trim() + "\n";

const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;
const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

/* The specification, implemented independently of the Python reference. */
export function oracle(records, maxDepth) {
  const segment = (k) => (IDENT.test(k) ? null : '["' + k.replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"]');
  return records.map((rec) => {
    const out = [];                                   // [path, value], insertion order
    const stack = Object.entries(rec).map(([k, v]) => [segment(k) ?? k, v, 1]);
    while (stack.length) {
      const [path, v, depth] = stack.shift();
      const container = Array.isArray(v) || isObj(v);
      const empty = container && (Array.isArray(v) ? v.length === 0 : Object.keys(v).length === 0);
      if (!container || empty || (maxDepth != null && depth >= maxDepth)) { out.push([path, v]); continue; }
      const kids = Array.isArray(v)
        ? v.map((c, i) => [`${path}[${i}]`, c, depth + 1])
        : Object.entries(v).map(([k, c]) => { const s = segment(k); return [s ? path + s : path + "." + k, c, depth + 1]; });
      stack.unshift(...kids);
    }
    return out;
  });
}

function py(v) {
  if (v === null || v === undefined) return "None";
  if (typeof v === "boolean") return v ? "True" : "False";
  if (typeof v === "number") return String(v);
  if (typeof v === "string") return JSON.stringify(v);
  if (Array.isArray(v)) return "[" + v.map(py).join(", ") + "]";
  return "{" + Object.entries(v).map(([k, x]) => `${JSON.stringify(k)}: ${py(x)}`).join(", ") + "}";
}
const pyRows = (rows) => "[" + rows.map((pairs) => "{" + pairs.map(([k, v]) => `${JSON.stringify(k)}: ${py(v)}`).join(", ") + "}").join(", ") + "]";
const pyArgs = (records, maxDepth) => `(${py(records)}, ${maxDepth == null ? "None" : maxDepth})`;

const SOURCES = ["clickstream", "orders", "iot", "app_events", "billing"];
const KEYSETS = {
  1: ["eventId", "userId", "sessionId", "deviceType", "appVersion"],
  2: ["ip address", "user-agent", "2fa_enabled", "x-request-id", "page title"],
  3: ['say "hi"', "a.b", "Total", "total", "ID", "id"],
};

function value(r, level, depth) {
  const roll = r.next();
  if (depth >= 3 || roll < 0.45) {
    return r.pick([null, true, false, 0, r.int(1, 999), r.int(1, 9999) / 100, "", "ok", "EUR", "mobile"]);
  }
  if (roll < 0.7) {
    const n = level >= 2 && r.chance(0.25) ? 0 : r.int(1, 3);
    return Array.from({ length: n }, () => value(r, level, depth + 1));
  }
  return obj(r, level, depth + 1);
}
function obj(r, level, depth) {
  const n = level >= 2 && depth > 0 && r.chance(0.2) ? 0 : r.int(1, 4);
  const pool = ["status", "amount", "items", "price", "sku", "geo", "city", "tags", "lat", "lon", "plan", "ts"];
  for (let l = 1; l <= level; l++) pool.push(...KEYSETS[l]);
  const o = {};
  for (const k of r.sample(pool, n)) o[k] = value(r, level, depth);
  return o;
}

export function generate(r, level) {
  const src = r.pick(SOURCES);
  const depthLimit = level === 3 ? r.int(2, 3) : null;
  const samples = [];
  for (let i = 0; i < 2; i++) {
    const recs = Array.from({ length: r.int(2, 3) }, () => obj(r, level, 0));
    samples.push({ args: pyArgs(recs, depthLimit), expect: pyRows(oracle(recs, depthLimit)) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const n = r.int(1, 99), sku = "SKU-" + r.int(100, 999);
  const edges = [
    ["nested objects and arrays become paths", [{ order: { id: n, lines: [{ sku, qty: 2 }, { sku: sku + "B", qty: 1 }] } }], null],
    ["a JSON null is kept: null is not the same as missing", [{ status: "shipped", coupon: null }, { status: "open" }], null],
    ["empty objects and arrays are kept as values", [{ tags: [], meta: {}, id: n }], null],
    ["keys are case-sensitive: id and ID are different fields", [{ id: n, ID: n + 1, userId: "u" + n }], null],
    ["a key with a dot is quoted, so it cannot collide with a nested key", [{ "a.b": 1, a: { b: 2 } }], null],
    ["keys with spaces, hyphens or a leading digit are quoted", [{ "ip address": "10.0.0." + n, "x-ray": { on: true }, "2fa": false }], null],
    ["a quote inside a key is escaped", [{ 'say "hi"': n }], null],
    ["arrays of arrays index twice", [{ grid: [[1, 2], [3]] }], null],
    ["an empty record flattens to an empty row", [{}, { k: 1 }], null],
    ["a container exactly at max_depth is kept whole", [{ a: { b: { c: 1 } }, d: [[1], 2] }], 2],
    ["max_depth 1 keeps every top-level value whole", [{ a: { b: 1 }, c: [1, 2], e: 3 }], 1],
  ];
  for (const [name, recs, md] of edges) tests.push({ name, args: pyArgs(recs, md), expect: pyRows(oracle(recs, md)) });

  const big = level === 1 ? 10000 : 15000;
  tests.push({ name: `${big.toLocaleString("en-US")} order documents in time`, args: `(_gen_documents(${big}, ${r.int(1, 1_000_000)}),)`, limit_s: 8 });

  return {
    vars: {
      source: src,
      replay_rule: level === 1
        ? "This replay has nested objects and arrays, nulls and mixed-case keys, with no depth limit."
        : level === 2
          ? "This replay adds empty objects and arrays and keys with spaces, hyphens and leading digits, with no depth limit."
          : `This replay is flattened with \`max_depth=${depthLimit}\`, and its keys include quotes, dots and names that differ only by case.`,
    },
    samples,
    tests,
  };
}
