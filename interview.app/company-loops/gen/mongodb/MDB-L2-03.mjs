/* MDB-L2-03 — Debug the slow-query shape normaliser (debug, Python).
   Simulated practice scenario. All data is generated from the seed.

   Contract (debug): like python, but `starter` is buggy code the candidate fixes.
   The evaluator's reference is the fixed code. expect comes from oracle() below,
   an independent JavaScript implementation of the specification in the template.
   Planted bugs (see the evaluator notes): microsecond durations read as seconds;
   every list normalised element by element, so $in lists of different lengths are
   different shapes; keys sorted only at the top level; $options kept beside $regex;
   entries the server marked as truncated are not skipped.
   level: 1 Medium (equality and range filters, mixed units, cut-off lines) ·
          2 Hard (+ $in lists and $or / $and branches) · 3 Very Hard (+ regex
          filters with and without options, entries marked truncated) */
export const kind = "debug";
export const entry = "summarise_shapes";
export const signature = "def summarise_shapes(lines: list[str]) -> dict:";
export const starter = `import json

LOGICAL = ("$and", "$or", "$nor")


def _micros(dur):
    n = int(dur.rstrip("mus"))
    if dur.endswith("ms"):
        return n * 1000
    if dur.endswith("s"):
        return n * 1000000
    return n


def _shape(v):
    if isinstance(v, dict):
        return {k: _shape(x) for k, x in v.items()}
    if isinstance(v, list):
        return [_shape(x) for x in v]
    return "?"


def summarise_shapes(lines):
    groups = {}         # (ns, shape) -> totals
    skipped = 0
    for line in lines:
        try:
            entry = json.loads(line)
        except ValueError:
            skipped += 1
            continue
        shape = _shape(entry["filter"])
        key = (entry["ns"], json.dumps(dict(sorted(shape.items())), separators=(",", ":")))
        us = _micros(entry["dur"])
        g = groups.setdefault(key, {"count": 0, "total_us": 0, "max_us": 0})
        g["count"] += 1
        g["total_us"] += us
        g["max_us"] = max(g["max_us"], us)
    shapes = [{"ns": ns, "shape": shape, **g} for (ns, shape), g in groups.items()]
    shapes.sort(key=lambda s: (-s["total_us"], s["ns"], s["shape"]))
    return {"shapes": shapes, "skipped": skipped}
`;

export const prelude = `
import json as _json


def _gen_slow_log(n, seed):
    x, out = seed, []
    colls = ['shop.orders', 'shop.customers', 'shop.carts', 'shop.payments', 'shop.returns']
    fields = ['status', 'customerId', 'sku', 'region', 'total', 'createdAt', 'name', 'tier']
    for _ in range(n):
        x = (1103515245 * x + 12345) % 2147483648
        a = x >> 4
        f1, f2 = fields[a % 8], fields[(a >> 3) % 8]
        k = (a >> 6) % 10
        if k < 3:
            flt = {f1: a % 977}
        elif k < 5:
            flt = {f1: {'$gte': a % 50, '$lt': 50 + a % 70}} if a & 1 else {f1: {'$lt': 50 + a % 70, '$gte': a % 50}}
        elif k < 7:
            flt = {f1: {'$in': list(range(1 + (a >> 9) % 6))}, f2: 'v%d' % (a % 13)}
        elif k < 8:
            flt = {'$or': [{f1: a % 7}, {f2: {'$gt': a % 11}}]}
        elif k < 9:
            flt = {f1: {'$regex': '^p%d' % (a % 9)}}
            if a & 2:
                flt[f1]['$options'] = 'i'
        else:
            flt = {'$and': [{f1: {'$exists': True}}, {f2: {'$nin': ['x', 'y']}}]}
        entry = {'ns': colls[(a >> 12) % 5], 'filter': flt,
                 'dur': '%d%s' % (1 + (a >> 14) % 900, ('us', 'ms', 'ms', 's')[(a >> 16) % 4])}
        if (a >> 18) % 50 == 0:
            entry['truncated'] = {'filter': {'bytes': 20480}}
        line = _json.dumps(entry)
        if (a >> 20) % 40 == 0:
            line = line[:len(line) // 2]
        out.append(line)
    return out
`.trim() + "\n";

// The specification, implemented independently of the Python reference.
const LOGICAL = new Set(["$and", "$or", "$nor"]);
const UNIT = { us: 1, ms: 1000, s: 1000000 };
function norm(v, logical) {
  if (Array.isArray(v)) return logical ? v.map((x) => norm(x, false)) : "?";
  if (v !== null && typeof v === "object") {
    const o = {};
    for (const [k, x] of Object.entries(v)) if (!(k === "$options" && "$regex" in v)) o[k] = norm(x, LOGICAL.has(k));
    return o;
  }
  return "?";
}
function canon(v) {
  if (Array.isArray(v)) return "[" + v.map(canon).join(",") + "]";
  if (v !== null && typeof v === "object") {
    return "{" + Object.keys(v).sort().map((k) => JSON.stringify(k) + ":" + canon(v[k])).join(",") + "}";
  }
  return JSON.stringify(v);
}
export function oracle(lines) {
  const groups = new Map();
  let skipped = 0;
  for (const line of lines) {
    let e;
    try { e = JSON.parse(line); } catch { skipped++; continue; }
    if ("truncated" in e) { skipped++; continue; }
    const m = /^(\d+)(us|ms|s)$/.exec(e.dur);
    const us = Number(m[1]) * UNIT[m[2]];
    const shape = canon(norm(e.filter, false));
    const key = e.ns + "\u0000" + shape;
    if (!groups.has(key)) groups.set(key, { ns: e.ns, shape, count: 0, total_us: 0, max_us: 0 });
    const g = groups.get(key);
    g.count++;
    g.total_us += us;
    g.max_us = Math.max(g.max_us, us);
  }
  const lt = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
  const shapes = [...groups.values()].sort((a, b) => b.total_us - a.total_us || lt(a.ns, b.ns) || lt(a.shape, b.shape));
  return { shapes, skipped };
}

const pyStr = (s) => "'" + s.replace(/\\/g, "\\\\").replace(/'/g, "\\'") + "'";
const pyArgs = (lines) => "([" + lines.map(pyStr).join(", ") + "],)";
function pyOut(o) {
  const sh = o.shapes.map((s) => `{'ns': ${pyStr(s.ns)}, 'shape': ${pyStr(s.shape)}, 'count': ${s.count}, 'total_us': ${s.total_us}, 'max_us': ${s.max_us}}`);
  return `{'shapes': [${sh.join(", ")}], 'skipped': ${o.skipped}}`;
}

const NS = ["shop.orders", "shop.customers", "shop.carts"];
const STATUS = ["paid", "pending", "shipped", "returned"];
const line = (ns, filter, dur, extra) => JSON.stringify({ ns, filter, dur, planSummary: "IXSCAN", ...(extra || {}) });

function randomFilter(r, level) {
  const kinds = ["eq", "eq2", "range"];
  if (level >= 2) kinds.push("in", "or", "and");
  if (level === 3) kinds.push("regex");
  const k = r.pick(kinds);
  const st = r.pick(STATUS);
  if (k === "eq") return { status: st };
  if (k === "eq2") return r.chance(0.5) ? { customerId: r.int(1, 999), status: st } : { status: st, customerId: r.int(1, 999) };
  if (k === "range") {
    const lo = r.int(0, 40), hi = lo + r.int(5, 60);
    return { total: r.chance(0.5) ? { $gte: lo, $lt: hi } : { $lt: hi, $gte: lo } };
  }
  if (k === "in") return { status: { $in: r.sample(STATUS, r.int(1, 4)) } };
  if (k === "or") return { $or: [{ status: st }, { total: { $gt: r.int(10, 90) } }] };
  if (k === "and") return { $and: [{ sku: { $exists: true } }, { tags: { $nin: r.sample(["sale", "gift", "bulk"], r.int(1, 3)) } }] };
  const rx = { $regex: "^" + r.pick(["ann", "bo", "chr", "dev"]) };
  if (r.chance(0.5)) rx.$options = "i";
  return { name: rx };
}
function randomDur(r) {
  const u = r.pick(["us", "ms", "ms", "s"]);
  return (u === "s" ? r.int(1, 3) : u === "us" ? r.int(80, 990) : r.int(2, 400)) + u;
}
function randomLog(r, level) {
  const lines = [];
  const pool = Array.from({ length: 4 }, () => [r.pick(NS), randomFilter(r, level)]);
  for (let i = 0, n = r.int(7, 10); i < n; i++) {
    const [ns, f] = r.chance(0.6) ? r.pick(pool) : [r.pick(NS), randomFilter(r, level)];
    let l = line(ns, f, randomDur(r), level === 3 && r.chance(0.12) ? { truncated: { filter: { bytes: 20480 } } } : null);
    if (r.chance(0.1)) l = l.slice(0, r.int(10, l.length - 2));                // the shipper cut it off
    lines.push(l);
  }
  return lines;
}

export function generate(r, level) {
  const samples = [];
  for (let i = 0; i < 2; i++) {
    const lines = randomLog(r, level);
    samples.push({ args: pyArgs(lines), expect: pyOut(oracle(lines)) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const [ns, ns2] = r.sample(NS, 2);
  const st = r.pick(STATUS);
  const a = r.int(2, 40), b = a + r.int(10, 50);
  const ms = () => r.int(5, 300) + "ms";
  const edges = [
    ["microseconds are not seconds", [line(ns, { status: st }, r.int(100, 990) + "us"), line(ns, { status: st }, ms())]],
    ["a second is a million microseconds", [line(ns, { status: st }, r.int(1, 4) + "s"), line(ns, { status: st }, ms())]],
    ["$in lists of different lengths are one shape", [line(ns, { status: { $in: ["paid", "pending"] } }, ms()), line(ns, { status: { $in: ["paid", "pending", "shipped"] } }, ms())]],
    ["operator order inside a field does not change the shape", [line(ns, { total: { $gte: a, $lt: b } }, ms()), line(ns, { total: { $lt: b, $gte: a } }, ms())]],
    ["top-level field order does not change the shape", [line(ns, { status: st, customerId: a }, ms()), line(ns, { customerId: b, status: st }, ms())]],
    ["regex options belong to the regex literal", [line(ns, { name: { $regex: "^ann" } }, ms()), line(ns, { name: { $regex: "^bo", $options: "i" } }, ms())]],
    ["an entry marked truncated is skipped and counted", [line(ns, { status: st }, ms(), { truncated: { filter: { bytes: 20480 } } }), line(ns, { status: st, customerId: a }, ms())]],
    ["a line cut off by the shipper is skipped and counted", [line(ns, { status: st }, ms()).slice(0, 25), line(ns, { status: st }, ms())]],
    ["the same filter on two collections is two shapes", [line(ns, { status: st }, "40ms"), line(ns2, { status: st }, "40ms")]],
    ["$or branches are kept in order", [line(ns, { $or: [{ status: st }, { customerId: a }] }, ms()), line(ns, { $or: [{ customerId: a }, { status: st }] }, ms())]],
    ["an equal total is ordered by namespace, then shape", [line(ns2, { sku: "A-1" }, "7ms"), line(ns, { status: st }, "7ms"), line(ns, { customerId: a }, "7ms")]],
    ["an empty log", []],
  ];
  for (const [name, lines] of edges) tests.push({ name, args: pyArgs(lines), expect: pyOut(oracle(lines)) });

  const n = 60000;
  tests.push({ name: `${n.toLocaleString("en-US")} log lines in time`, args: `(_gen_slow_log(${n}, ${r.int(1, 1_000_000)}),)`, limit_s: 8 });

  return {
    vars: {
      replay_rule: level === 1
        ? "This replay has equality and range filters, durations in all three units and lines the shipper cut off; the checks also cover lists, branches, regexes and truncated entries."
        : level === 2
          ? "This replay adds `$in` lists of different lengths and `$or` / `$and` branches; the checks also cover regexes and truncated entries."
          : "This replay has every feature: `$in` lists, `$or` / `$and` branches, regex filters with and without options, entries marked truncated and lines cut off.",
    },
    samples,
    tests,
  };
}
