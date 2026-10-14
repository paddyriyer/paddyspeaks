/* ANT-L2-03 — Debug the pairwise win-rate report for two model snapshots (debug, Python).
   Simulated practice scenario. All data is generated from the seed.

   Contract (debug): like python, but `starter` is buggy code the candidate fixes.
   The evaluator's reference is the fixed code. expect comes from oracle() below,
   an independent JavaScript implementation of the specification in the template.
   Planted bugs (see the evaluator notes), each isolated by one named test in which
   the other four bugs change nothing:
     1. retried judge calls: the first judgment to arrive is kept, not the highest attempt;
     2. position swap ignored: "second" is read as the candidate in both orders;
     3. a tie earns the candidate nothing instead of half the points;
     4. an item judged in only one order is counted as paired;
     5. the summary pools every item instead of averaging the per-category rates.
   level: 1 Medium (one attempt per judgment, ties, one or two categories)
          · 2 Hard (+ retried judge calls in order, unparseable verdicts, missing orders)
          · 3 Very Hard (+ retries that arrive before the original, a latest attempt that
            is invalid although an earlier one parsed, more categories) */
export const kind = "debug";
export const entry = "win_rates";
export const signature = "def win_rates(judgments: list[dict]) -> dict:";
export const starter = `def win_rates(judgments):
    latest = {}
    for j in judgments:
        key = (j["item"], j["order"])
        if key not in latest:                          # one judgment per item and order
            latest[key] = j
    items = {}
    for (item, order), j in latest.items():
        rec = items.setdefault(item, {"category": j["category"], "points": 0, "orders": 0})
        if j["verdict"] == "invalid":
            continue
        rec["orders"] += 1
        if j["verdict"] == "second":                   # the candidate's response is shown second
            rec["points"] += 2
    cats, unpaired = {}, 0
    for rec in items.values():
        if rec["orders"] == 0:
            unpaired += 1
            continue
        c = cats.setdefault(rec["category"], {"items": 0, "points": 0})
        c["items"] += 1
        c["points"] += rec["points"]
    items_total = sum(c["items"] for c in cats.values())
    points_total = sum(c["points"] for c in cats.values())
    macro = points_total / (4 * items_total) if items_total else None
    return {"categories": cats, "unpaired": unpaired, "macro_win_rate": macro}
`;

export const prelude = `
def _gen_judgments(n_items, seed):
    x, out = seed, []
    def rnd(m):
        nonlocal x
        x = (1103515245 * x + 12345) % 2147483648
        return (x >> 16) % m
    cats = ('coding', 'math', 'long-documents', 'tool-use', 'summarization', 'multilingual')
    verdicts = ('first', 'second', 'tie', 'first', 'second', 'invalid')
    for i in range(n_items):
        cat = cats[rnd(len(cats))]
        for order in ('AB', 'BA'):
            if rnd(25) == 0:
                continue                                     # this order was never judged
            tries = 1 + (rnd(8) == 0) + (rnd(30) == 0)
            batch = [{'item': 'item_%d' % i, 'category': cat, 'order': order, 'attempt': a,
                      'verdict': verdicts[rnd(6)]} for a in range(1, tries + 1)]
            if rnd(3) == 0:
                batch.reverse()                              # a retry logged before the original
            out.extend(batch)
    for k in range(len(out) - 1, 0, -1):                     # judgments arrive interleaved
        j = rnd(k + 1)
        out[k], out[j] = out[j], out[k]
    return out
`.trim() + "\n";

// The specification, implemented independently of the Python reference.
export function oracle(judgments) {
  const best = new Map();
  for (const j of judgments) {
    const key = j.item + "\u0001" + j.order;
    const cur = best.get(key);
    if (!cur || j.attempt > cur.attempt) best.set(key, j);
  }
  const perItem = new Map();
  for (const j of best.values()) {
    if (!perItem.has(j.item)) perItem.set(j.item, { category: j.category, valid: [] });
    if (j.verdict !== "invalid") perItem.get(j.item).valid.push(j);
  }
  const cats = new Map();
  let unpaired = 0;
  for (const { category, valid } of perItem.values()) {
    if (valid.length !== 2) { unpaired++; continue; }
    let pts = 0;
    for (const j of valid) {
      if (j.verdict === "tie") { pts += 1; continue; }
      const candidateShown = j.order === "AB" ? "second" : "first";
      if (j.verdict === candidateShown) pts += 2;
    }
    if (!cats.has(category)) cats.set(category, { items: 0, points: 0 });
    const c = cats.get(category);
    c.items++;
    c.points += pts;
  }
  const rates = [...cats.values()].map((c) => c.points / (4 * c.items));
  const categories = {};
  for (const [k, v] of cats) categories[k] = { items: v.items, points: v.points };
  return { categories, unpaired, macro_win_rate: rates.length ? rates.reduce((s, x) => s + x, 0) / rates.length : null };
}

function py(v) {
  if (v === null || v === undefined) return "None";
  if (typeof v === "boolean") return v ? "True" : "False";
  if (typeof v === "number") return String(v);
  if (typeof v === "string") return "'" + v + "'";
  if (Array.isArray(v)) return "[" + v.map(py).join(", ") + "]";
  return "{" + Object.entries(v).map(([k, x]) => `'${k}': ${py(x)}`).join(", ") + "}";
}
const pyArgs = (js) => "(" + py(js) + ",)";

const CATS = ["coding", "math", "long-documents", "tool-use", "summarization", "multilingual", "instruction-following", "refusal-calibration"];
const DIGITS = "0123456789".split("");
const iid = (r) => "item_" + Array.from({ length: 5 }, () => r.pick(DIGITS)).join("");

function randomCase(r, level) {
  const cats = r.sample(CATS, level === 1 ? r.int(1, 2) : level === 2 ? r.int(2, 3) : r.int(3, 4));
  const n = level === 1 ? r.int(4, 6) : level === 2 ? r.int(6, 8) : r.int(7, 10);
  const batches = [];
  for (let i = 0; i < n; i++) {
    const item = iid(r), category = r.pick(cats);
    for (const order of ["AB", "BA"]) {
      if (level >= 2 && r.chance(0.12)) continue;                       // never judged in this order
      const tries = level === 1 ? 1 : r.chance(0.3) ? r.int(2, 3) : 1;
      const batch = [];
      for (let a = 1; a <= tries; a++) {
        const invalid = level >= 2 && r.chance(level === 3 && a === tries ? 0.3 : 0.15);
        batch.push({ item, category, order, attempt: a, verdict: invalid ? "invalid" : r.pick(["first", "second", "tie", "first", "second"]) });
      }
      if (level === 3 && r.chance(0.4)) batch.reverse();                  // the retry is logged first
      batches.push(batch);
    }
  }
  // Interleave the batches; each batch keeps its own logged order.
  const out = [];
  while (batches.some((b) => b.length)) {
    const live = batches.filter((b) => b.length);
    out.push(r.pick(live).shift());
  }
  return out;
}

export function generate(r, level) {
  const samples = [];
  for (let i = 0; i < 2; i++) {
    let js;
    for (let k = 0; k < 40; k++) { js = randomCase(r, level); if (oracle(js).macro_win_rate !== null) break; }
    samples.push({ args: pyArgs(js), expect: py(oracle(js)) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const [C1, C2] = r.sample(CATS, 2);
  const J = (item, category, order, verdict, attempt = 1) => ({ item, category, order, attempt, verdict });
  // An item judged in both orders, attempt 1. In the tests below every category that
  // is not about the swap holds one BA "first" and one BA "second", so reading BA the
  // wrong way round moves points between items but not the category's total.
  const pair = (item, cat, ab, ba) => [J(item, cat, "AB", ab), J(item, cat, "BA", ba)];
  const [i1, i2, i3, i4, i5, i6] = Array.from({ length: 6 }, () => iid(r));
  const edges = [
    ["the highest attempt counts, not the first judgment logged",
      [J(i1, C1, "AB", "first", 1), J(i1, C1, "BA", "first"), ...pair(i2, C1, "first", "second"), J(i1, C1, "AB", "second", 2)]],
    ["in BA order the candidate is shown first",
      pair(i1, C1, "second", "first")],
    ["a tie is worth half the points",
      [...pair(i1, C1, "tie", "first"), ...pair(i2, C1, "second", "second")]],
    ["an item judged in only one order is unpaired",
      [...pair(i1, C1, "second", "first"), ...pair(i2, C1, "first", "second"), J(i3, C1, "AB", "second")]],
    ["the summary averages per-category rates (macro), not all items pooled",
      [...pair(i1, C1, "second", "first"), ...pair(i2, C1, "second", "second"),
        ...pair(i3, C2, "first", "first"), ...pair(i4, C2, "first", "second"), ...pair(i5, C2, "first", "first"), ...pair(i6, C2, "first", "second")]],
    ["nothing paired at all: no categories and None",
      [J(i1, C1, "AB", "second"), J(i2, C1, "BA", "invalid"), J(i2, C1, "AB", "first")]],
  ];
  if (level >= 2) {
    edges.push(["a retry logged before the original still wins (highest attempt, not last seen)",
      [J(i1, C1, "AB", "second", 2), J(i1, C1, "AB", "first", 1), J(i1, C1, "BA", "first"), ...pair(i2, C1, "first", "second")]]);
    edges.push(["an unparseable verdict leaves the item unpaired",
      [...pair(i1, C1, "second", "first"), ...pair(i2, C1, "first", "second"), J(i3, C1, "AB", "tie"), J(i3, C1, "BA", "invalid")]]);
  }
  if (level === 3) {
    edges.push(["an invalid latest attempt is not replaced by an earlier valid one",
      [J(i1, C1, "AB", "second", 1), J(i1, C1, "AB", "invalid", 2), J(i1, C1, "BA", "first"), ...pair(i2, C1, "second", "first")]]);
    edges.push(["three orders of arrival for one item's retries",
      [J(i1, C1, "BA", "second", 3), J(i1, C1, "AB", "tie", 1), J(i1, C1, "BA", "first", 1), J(i1, C1, "BA", "tie", 2), J(i1, C1, "AB", "second", 2), ...pair(i2, C2, "tie", "tie")]]);
  }
  for (const [name, js] of edges) tests.push({ name, args: pyArgs(js), expect: py(oracle(js)) });

  const n = level === 1 ? 40000 : 80000;
  tests.push({ name: `${n.toLocaleString("en-US")} items (about ${(2 * n).toLocaleString("en-US")} judgments) in one pass`, args: `(_gen_judgments(${n}, ${r.int(1, 1_000_000)}),)`, limit_s: 8 });

  return {
    vars: {
      retry_rule: level === 1
        ? "In this replay every judgment is a first attempt, but the checks also include retried judge calls."
        : level === 2
          ? "Judge calls are retried after timeouts and unparseable answers, so one (item, order) can have several attempts."
          : "Judge calls are retried after timeouts and unparseable answers, and a retry can be logged before the attempt it replaced.",
    },
    samples,
    tests,
  };
}
