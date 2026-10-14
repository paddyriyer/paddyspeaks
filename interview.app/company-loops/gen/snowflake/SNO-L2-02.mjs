/* SNO-L2-02 — Join ordering: the cheapest left-deep order (Python).
   Simulated practice scenario. All data is generated from the seed.

   Contract (python): entry, signature, starter, prelude, generate(r, level) ->
     { vars, samples: [{args, expect}], tests: [{name, args, expect?, limit_s?}] }.
   expect comes from oracle() below: it tries every permutation of the tables
   (small inputs only) with BigInt row estimates. The evaluator's reference is a
   dynamic programme over subsets, written independently.
   level: 1 Medium (star schemas, cross products allowed) · 2 Hard (+ snowflaked
          dimensions, two fact tables, composite predicates, ties) · 3 Very Hard
          (+ cross products forbidden, disconnected queries that have no valid order) */
export const kind = "python";
export const entry = "best_join_order";
export const signature = "def best_join_order(tables: dict[str, int], predicates: list[tuple[str, str, int]], allow_cross: bool = True) -> tuple[int, list[str]] | None:";
export const starter = `def best_join_order(tables, predicates, allow_cross=True):
    """tables: {name: estimated rows after filters}.
    predicates: (a, b, d): the join predicate between a and b keeps 1 of every
    d row pairs; several predicates on one pair multiply.
    rows(S) = floor(product of rows in S / product of d of predicates inside S).
    Joining prefix P with table x costs rows(P) + rows(x) + rows(P + x).
    Return (cost, order) for the cheapest left-deep order, the lexicographically
    smallest order on a cost tie, or None if allow_cross is False and no order
    joins every table through predicates."""
    ...
`;

export const prelude = `
def _gen_schema(n, seed, connected=True):
    x = seed
    def nxt():
        nonlocal x
        x = (1103515245 * x + 12345) % 2147483648
        return x >> 16
    names = ['t%02d' % i for i in range(n)]
    tables = {t: 10 + nxt() % 5000000 for t in names}
    preds = []
    for i in range(1, n):
        j = nxt() % i
        preds.append((names[j], names[i], 2 + nxt() % 100000))
    for _ in range(n // 2):
        a, b = nxt() % n, nxt() % n
        if a != b:
            preds.append((names[a], names[b], 2 + nxt() % 1000))
    return tables, preds
`.trim() + "\n";

/* rows(S) for a set of names, as a BigInt. */
function rowsOf(set, tables, predicates) {
  let num = 1n, den = 1n;
  for (const t of set) num *= BigInt(tables[t]);
  for (const [a, b, d] of predicates) if (set.has(a) && set.has(b)) den *= BigInt(d);
  return num / den;
}

// Brute force: every permutation, every join costed from scratch.
export function oracle(tables, predicates, allowCross) {
  const names = Object.keys(tables);
  if (!names.length) return [0n, []];
  let best = null;
  const linked = (x, set) => predicates.some(([a, b]) => (a === x && set.has(b)) || (b === x && set.has(a)));
  const lexLess = (p, q) => { for (let i = 0; i < p.length; i++) if (p[i] !== q[i]) return p[i] < q[i]; return false; };
  const walk = (order, used) => {
    if (order.length === names.length) {
      let cost = 0n;
      for (let k = 1; k < order.length; k++) {
        const prefix = new Set(order.slice(0, k));
        const withX = new Set(order.slice(0, k + 1));
        cost += rowsOf(prefix, tables, predicates) + BigInt(tables[order[k]]) + rowsOf(withX, tables, predicates);
      }
      if (best === null || cost < best[0] || (cost === best[0] && lexLess(order, best[1]))) best = [cost, order.slice()];
      return;
    }
    for (const x of names) {
      if (used.has(x)) continue;
      if (!allowCross && order.length && !linked(x, used)) continue;
      used.add(x); order.push(x);
      walk(order, used);
      order.pop(); used.delete(x);
    }
  };
  walk([], new Set());
  return best;
}

const pyOut = (v) => (v === null ? "None" : `(${v[0].toString()}, [${v[1].map((s) => `'${s}'`).join(", ")}])`);
const pyArgs = (tables, preds, allowCross) =>
  `({${Object.entries(tables).map(([k, v]) => `'${k}': ${v}`).join(", ")}}, [${preds.map(([a, b, d]) => `('${a}', '${b}', ${d})`).join(", ")}], ${allowCross ? "True" : "False"})`;

const FACTS = ["store_sales", "web_sales", "orders", "page_views", "shipments", "returns", "sessions", "invoices"];
const DIMS = ["date_dim", "item", "customer", "store", "promotion", "warehouse", "carrier", "web_page", "account", "product"];
const SUBS = ["region", "category", "brand", "nation", "city", "segment"];
const MAGS = [1000, 5000, 20000, 100000, 400000];

/* A star (or snowflake) query: fact tables joined to filtered dimensions on foreign keys. */
function starCase(r, level) {
  const tables = {}, preds = [];
  const nDims = level === 1 ? r.int(3, 4) : r.int(2, 3);
  const facts = r.sample(FACTS, level === 1 ? 1 : r.int(1, 2));
  const dims = r.sample(DIMS, nDims);
  for (const f of facts) tables[f] = r.int(2, 60) * 1_000_000;
  for (const dm of dims) {
    const distinct = r.pick(MAGS) * r.int(1, 9);
    const filtered = r.chance(0.6) ? Math.max(1, Math.floor(distinct / r.pick([10, 50, 200, 1000]))) : distinct;
    tables[dm] = filtered;
    for (const f of facts) if (f === facts[0] || r.chance(0.6)) preds.push([f, dm, distinct]);
  }
  if (facts.length === 2 && r.chance(0.5)) {               // a composite key between the facts
    preds.push([facts[0], facts[1], tables[facts[0]] / 1000]);
    preds.push([facts[0], facts[1], 1000]);
  }
  if (level >= 2 && r.chance(0.7)) {                       // a snowflaked dimension
    const s = r.pick(SUBS), dm = r.pick(dims), distinct = r.int(5, 400);
    tables[s] = r.chance(0.5) ? Math.max(1, Math.floor(distinct / r.int(2, 20))) : distinct;
    preds.push([dm, s, distinct]);
  }
  if (level === 3 && r.chance(0.35)) tables[r.pick(["fx_rates", "calendar_flags", "tenant_settings"])] = r.int(1, 40);  // no predicate
  return { tables: Object.fromEntries(r.shuffle(Object.entries(tables))), preds: r.shuffle(preds) };
}

export function generate(r, level) {
  const allow = level !== 3;
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const c = starCase(r, level);
    samples.push({ args: pyArgs(c.tables, c.preds, allow), expect: pyOut(oracle(c.tables, c.preds, allow)) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const [F, G] = r.sample(FACTS, 2);
  const [A, B, C] = r.sample(DIMS, 3);
  const big = r.int(2, 9) * 1_000_000;
  const edges = [
    ["no tables: nothing to join", {}, [], true],
    ["one table: no join, no cost", { [A]: r.int(10, 999) }, [], true],
    ["two tables cost the same in either order: the smaller name goes first", { [F]: big, [A]: 365 }, [[F, A, 3650]], true],
    ["row estimates round down", { [A]: 7, [B]: 3 }, [[A, B, 2]], true],
    ["two predicates on one pair multiply", { [F]: big, [G]: big / 2, [A]: 50 }, [[F, G, 1000], [F, G, big / 1000], [G, A, 50]], true],
    ["a selective dimension first beats joining the biggest tables first",
      { [F]: big, [G]: big * 2, [A]: 30, [B]: 2000 }, [[F, A, 3000], [F, G, big], [G, B, 2000]], true],
    ["a cross product of two tiny filtered dimensions can be the cheapest start",
      { [F]: big, [A]: 3, [B]: 2 }, [[F, A, 3000], [F, B, 2000]], true],
    ["with cross products forbidden, each table must join through a predicate",
      { [F]: big, [A]: 3, [B]: 2 }, [[F, A, 3000], [F, B, 2000]], false],
    ["a table with no predicate cannot be joined without a cross product: None",
      { [F]: big, [A]: 30, [C]: 4 }, [[F, A, 3000]], false],
    ["the same disconnected query is fine when cross products are allowed",
      { [F]: big, [A]: 30, [C]: 4 }, [[F, A, 3000]], true],
    ["row estimates far above 2**53 are exact integers",
      { [A]: 999_999_937, [B]: 999_999_929, [C]: 999_999_893 }, [[A, B, 7]], true],
  ];
  for (const [name, tb, pr, al] of edges) tests.push({ name, args: pyArgs(tb, pr, al), expect: pyOut(oracle(tb, pr, al)) });

  // Timing: a dynamic programme over subsets is about 2^n * n steps; trying every
  // order is n! (over 10^12 here).
  const n = level === 1 ? 14 : level === 2 ? 15 : 16;
  tests.push({ name: `${n} tables (dynamic programming over subsets)`, args: `(*_gen_schema(${n}, ${r.int(1, 1_000_000)}), ${allow ? "True" : "False"})`, limit_s: 8 });

  return {
    vars: {
      level_rule: level === 1
        ? "In this replay the queries are star joins and cross products are allowed (`allow_cross=True`); the checks also call it with `False`."
        : level === 2
          ? "In this replay the queries join one or two fact tables to filtered and snowflaked dimensions, some through composite keys, and cross products are allowed."
          : "In this replay cross products are forbidden (`allow_cross=False`), and a query may name a table that no predicate reaches.",
    },
    samples,
    tests,
  };
}
