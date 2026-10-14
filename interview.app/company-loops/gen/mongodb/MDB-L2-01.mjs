/* MDB-L2-01 — Change-stream subscriptions: which equality filters each change event matches (Python).
   Simulated practice scenario. All data is generated from the seed.

   Contract (python): entry, signature, starter, prelude, generate(r, level) ->
     { vars, samples: [{args, expect}], tests: [{name, args, expect?, limit_s?}] }.
   expect comes from oracle() below: every subscription tested against every event,
   clause by clause, straight from the rules in the template. The evaluator's
   reference builds an inverted index on (field, value) and counts satisfied
   clauses, so each checks the other.
   level: 1 Medium (plain equality clauses) · 2 Hard (+ {"$in": [...]} clauses,
          duplicates and empty lists) · 3 Very Hard (+ None matches a missing field
          or an explicit null, also inside $in) */
export const kind = "python";
export const entry = "match_subscriptions";
export const signature = "def match_subscriptions(subscriptions: list[tuple[int, dict]], events: list[dict]) -> list[list[int]]:";
export const starter = `def match_subscriptions(subscriptions, events):
    """subscriptions: (sub_id, filter) pairs; a filter maps a field path to the
    value it must equal. events: change events as flat {field path: value} dicts.
    Return, for each event in order, the ids of the subscriptions it matches,
    in ascending order."""
    ...
`;

export const prelude = `
def _lcg(x):
    return (1103515245 * x + 12345) % 2147483648


_OPS = ['insert', 'update', 'replace', 'delete']
_STATUS = ['pending', 'paid', 'packed', 'shipped', 'delivered', 'returned']


def _gen_change_events(n, seed):
    x, out = seed, []
    for _ in range(n):
        x = _lcg(x)
        op = _OPS[(x >> 8) % 4]
        x = _lcg(x)
        ev = {'operationType': op, 'ns.coll': 'c%02d' % ((x >> 8) % 30),
              'documentKey._id': 500000 + (x >> 4) % 200000}
        if op != 'delete':
            x = _lcg(x)
            ev['fullDocument.customerId'] = (x >> 8) % 5000
            x = _lcg(x)
            ev['fullDocument.sku'] = 'sku-%05d' % ((x >> 8) % 20000)
            x = _lcg(x)
            ev['fullDocument.status'] = _STATUS[(x >> 8) % 6]
        out.append(ev)
    return out


def _gen_subscriptions(n, seed, level):
    x, out = seed, []
    for sid in range(1, n + 1):
        x = _lcg(x)
        k = (x >> 8) % 100
        x = _lcg(x)
        a = x >> 8
        if k < 50:
            flt = {'fullDocument.customerId': a % 5000}
            if level >= 2 and k < 10:
                flt = {'fullDocument.customerId': {'$in': [a % 5000, (a >> 3) % 5000, (a >> 6) % 5000]}}
            if k == 49:
                flt['operationType'] = _OPS[a % 3]
        elif k < 80:
            flt = {'fullDocument.sku': 'sku-%05d' % (a % 20000)}
        elif k < 95:
            flt = {'documentKey._id': 500000 + a % 200000}
        elif k < 98:
            flt = {'ns.coll': 'c%02d' % (a % 30), 'fullDocument.status': _STATUS[a % 6]}
            if level >= 3 and k == 97:
                flt['fullDocument.status'] = None
        else:
            flt = {'operationType': 'delete', 'ns.coll': 'c%02d' % (a % 30)}
        out.append((sid, flt))
    return out
`.trim() + "\n";

// The rules, applied literally: every subscription against every event. Small inputs only.
function clauseHolds(cond, ev, field) {
  const has = Object.prototype.hasOwnProperty.call(ev, field);
  const val = has ? ev[field] : undefined;
  const accepted = cond !== null && typeof cond === "object" ? cond.$in : [cond];
  return accepted.some((a) => (a === null ? !has || val === null : has && val === a));
}
export function oracle(subscriptions, events) {
  return events.map((ev) =>
    subscriptions
      .filter(([, flt]) => Object.entries(flt).every(([f, cond]) => clauseHolds(cond, ev, f)))
      .map(([id]) => id)
      .sort((a, b) => a - b));
}

function py(v) {
  if (v === null || v === undefined) return "None";
  if (typeof v === "number") return String(v);
  if (typeof v === "string") return "'" + v + "'";
  if (Array.isArray(v)) return "[" + v.map(py).join(", ") + "]";
  return "{" + Object.entries(v).map(([k, x]) => `'${k}': ${py(x)}`).join(", ") + "}";
}
const pySubs = (subs) => "[" + subs.map(([id, f]) => `(${id}, ${py(f)})`).join(", ") + "]";
const pyArgs = (subs, evs) => `(${pySubs(subs)}, ${py(evs)})`;
const pyOut = (xs) => "[" + xs.map((l) => "[" + l.join(", ") + "]").join(", ") + "]";

const COLLS = ["orders", "carts", "payments", "shipments", "invoices", "returns"];
const STATUS = ["pending", "paid", "packed", "shipped", "delivered"];
const OPS = ["insert", "update", "replace", "delete"];

function makeEvent(r, level, custs, skus) {
  const op = r.pick(OPS);
  const ev = { operationType: op, "ns.coll": r.pick(COLLS.slice(0, 3)), "documentKey._id": r.int(1, 6) };
  if (op !== "delete") {
    ev["fullDocument.customerId"] = r.pick(custs);
    ev["fullDocument.status"] = level === 3 && r.chance(0.15) ? null : r.pick(STATUS.slice(0, 3));
    if (r.chance(0.7)) ev["fullDocument.sku"] = r.pick(skus);       // not every document has a sku
  }
  return ev;
}
function makeFilter(r, level, custs, skus) {
  const pool = [
    () => ["fullDocument.customerId", r.pick(custs)],
    () => ["fullDocument.status", r.pick(STATUS.slice(0, 3))],
    () => ["ns.coll", r.pick(COLLS.slice(0, 3))],
    () => ["operationType", r.pick(OPS)],
    () => ["fullDocument.sku", r.pick(skus)],
    () => ["documentKey._id", r.int(1, 6)],
  ];
  const flt = {};
  const n = r.chance(0.1) ? 0 : r.int(1, 3);
  for (const make of r.sample(pool, n)) {
    const [f, v] = make();
    flt[f] = v;
    if (level >= 2 && r.chance(0.3)) {
      const more = make()[1];
      flt[f] = { $in: r.chance(0.3) ? [v, more, v] : [v, more] };
    }
    if (level === 3 && r.chance(0.15)) flt[f] = r.chance(0.5) ? null : { $in: [null, v] };
  }
  return flt;
}

function randomCase(r, level, idBase) {
  for (let attempt = 0; attempt < 80; attempt++) {
    const custs = r.sample([101, 102, 117, 230, 231, 4096], 3);
    const skus = r.sample(["A-100", "A-101", "B-7", "C-12"], 2);
    let next = idBase;
    const ids = r.shuffle(Array.from({ length: r.int(6, 9) }, () => (next += r.int(1, 4))));   // distinct ids
    const subs = ids.map((id) => [id, makeFilter(r, level, custs, skus)]);
    const evs = Array.from({ length: r.int(5, 7) }, () => makeEvent(r, level, custs, skus));
    const got = oracle(subs, evs);
    const hits = got.filter((l) => l.length > 0).length;
    const total = got.reduce((s, l) => s + l.length, 0);
    if (hits >= 3 && total < subs.length * evs.length * 0.6) return [subs, evs];
  }
  throw new Error("MDB-L2-01: could not build a sample with enough matches");
}

export function generate(r, level) {
  const base = r.pick([10, 300, 7000, 41000]);
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const [subs, evs] = randomCase(r, level, base + i * 50);
    samples.push({ args: pyArgs(subs, evs), expect: pyOut(oracle(subs, evs)) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const c = r.pick([101, 230, 4096]);
  const ins = { operationType: "insert", "ns.coll": "orders", "documentKey._id": 1, "fullDocument.customerId": c, "fullDocument.status": "paid" };
  const del = { operationType: "delete", "ns.coll": "orders", "documentKey._id": 1 };
  const upd = { operationType: "update", "ns.coll": "carts", "documentKey._id": 2, "fullDocument.customerId": c + 1, "fullDocument.status": "pending" };
  const s = (k) => base + 900 + k;
  const edges = [
    ["an empty filter matches every event, deletes included", [[s(2), {}], [s(1), { operationType: "delete" }]], [ins, del, upd]],
    ["every clause must hold, not just one", [[s(1), { "ns.coll": "orders", "fullDocument.status": "pending" }], [s(2), { "ns.coll": "orders", "fullDocument.status": "paid" }]], [ins, upd]],
    ["a clause on a field the event does not carry does not match", [[s(1), { "fullDocument.status": "paid" }], [s(2), { "ns.coll": "orders" }]], [del, ins]],
    ["the integer 7 and the string '7' are different values", [[s(1), { "documentKey._id": 7 }], [s(2), { "documentKey._id": "7" }]], [{ ...ins, "documentKey._id": 7 }, { ...ins, "documentKey._id": "7" }]],
    ["many subscriptions share one field and value; ids come back ascending", [[s(9), { "ns.coll": "orders" }], [s(3), { "ns.coll": "orders" }], [s(5), { "ns.coll": "orders", operationType: "insert" }], [s(4), { "ns.coll": "carts" }]], [ins, del]],
    ["an event that matches nothing gives an empty list", [[s(1), { "ns.coll": "payments" }]], [ins, upd]],
    ["no events at all", [[s(1), { "ns.coll": "orders" }]], []],
    ["no subscriptions at all", [], [ins, del]],
  ];
  if (level >= 2) {
    edges.push(["$in matches any listed value", [[s(1), { "fullDocument.customerId": { $in: [c, c + 1] } }], [s(2), { "fullDocument.customerId": { $in: [c + 2] } }]], [ins, upd, del]]);
    edges.push(["a value listed twice in $in still counts once", [[s(1), { "fullDocument.status": { $in: ["paid", "paid"] }, "ns.coll": "orders" }], [s(2), { "fullDocument.status": { $in: ["paid", "pending", "paid"] }, operationType: "update" }]], [ins, upd]]);
    edges.push(["an empty $in matches nothing", [[s(1), { "ns.coll": { $in: [] } }], [s(2), { "ns.coll": { $in: ["orders", "carts"] } }]], [ins, upd]]);
  }
  if (level === 3) {
    edges.push(["None matches a missing field", [[s(1), { "fullDocument.status": null }], [s(2), { "fullDocument.status": null, "ns.coll": "carts" }]], [del, ins]]);
    edges.push(["None matches an explicit null and nothing else", [[s(1), { "fullDocument.status": null }]], [{ ...upd, "fullDocument.status": null }, upd]]);
    edges.push(["$in with None matches a missing field or a listed value", [[s(1), { "fullDocument.status": { $in: [null, "paid"] } }], [s(2), { "fullDocument.status": { $in: ["pending"] } }]], [del, ins, upd]]);
    edges.push(["a null-tolerant clause still needs the other clauses", [[s(1), { "fullDocument.customerId": null, operationType: "insert" }], [s(2), { "fullDocument.customerId": null, operationType: "delete" }]], [del, ins]]);
  }
  for (const [name, subs, evs] of edges) tests.push({ name, args: pyArgs(subs, evs), expect: pyOut(oracle(subs, evs)) });

  // Timing: compared with the reference at check time. Testing every subscription
  // against every event is 60 million filter checks; an index touches a few hundred.
  const nSubs = 20000, nEvents = 3000, seed = r.int(1, 1_000_000);
  tests.push({
    name: `${nSubs.toLocaleString("en-US")} subscriptions and ${nEvents.toLocaleString("en-US")} change events in time`,
    args: `(_gen_subscriptions(${nSubs}, ${seed}, ${level}), _gen_change_events(${nEvents}, ${seed + 1}))`,
    limit_s: 8,
  });

  return {
    vars: {
      in_rule: level === 1
        ? "In this exercise every clause is a plain value: the event's field must be present and equal to it."
        : "A clause can also be `{\"$in\": [v1, v2, ...]}`: the event's field must be present and equal to one of the listed values. A value may be listed twice, and `{\"$in\": []}` matches nothing.",
      null_rule: level === 3
        ? "A clause value of `None` (also inside `$in`) matches an event where the field is missing or is `None`, the way an equality-to-null query matches missing fields in this exercise's rules; check current docs."
        : "No clause in this exercise uses `None`.",
    },
    samples,
    tests,
  };
}
