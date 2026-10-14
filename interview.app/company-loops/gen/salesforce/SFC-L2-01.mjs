/* SFC-L2-01 — Formula field recalculation order after a record save (Python).
   Simulated practice scenario. All data is generated from the seed.

   Contract (python): entry, signature, starter, prelude, generate(r, level) ->
     { vars, samples: [{args, expect}], tests: [{name, args, expect?, limit_s?}] }.
   expect comes from oracle() below, written independently of the evaluator's
   reference: levels by memoised depth-first search with three-colour cycle
   detection, and the affected set of each edit by a fixed point over every
   formula (the naive method the timing test rules out). The reference computes
   levels once with Kahn's algorithm and walks reverse references per edit.
   level: 1 Medium (one object, shallow formulas, no cycles in the samples)
          · 2 Hard (+ deeper chains, diamonds, repeated references, references to
            fields no formula defines)
          · 3 Very Hard (+ cycles in the samples, empty and repeated edits) */
export const kind = "python";
export const entry = "recalc_order";
export const signature = "def recalc_order(formulas: dict[str, list[str]], edits: list[list[str]]) -> list[list[str]] | None:";
export const starter = `def recalc_order(formulas, edits):
    """formulas: {formula_field: [fields it references]}.
    edits: one list of edited (non-formula) fields per record save.
    Return, per edit, the formula fields to recalculate in evaluation order
    (level, then API name), or None if the formulas contain a cycle."""
    ...
`;

export const prelude = `
def _gen_formulas(groups, n_edits, seed):
    x = seed
    def rnd(m):
        nonlocal x
        x = (1103515245 * x + 12345) % 2147483648
        return (x >> 16) % m
    formulas = {}
    for g in range(groups - 1, -1, -1):              # dict order is not evaluation order
        names = ['F%d_%02d__c' % (g, j) for j in range(15)]
        ins = ['In%d_%d__c' % (g, i) for i in range(4)]
        for j in range(14, -1, -1):
            refs = []
            for _ in range(1 + rnd(3)):
                k = rnd(4 + j)
                refs.append(ins[k] if k < 4 else names[k - 4])
            if rnd(40) == 0:
                refs.append('In%d_%d__c' % (rnd(groups), rnd(4)))
            formulas[names[j]] = refs
    edits = [['In%d_%d__c' % (rnd(groups), rnd(4)) for _ in range(1 + rnd(3))] for _ in range(n_edits)]
    return formulas, edits
`.trim() + "\n";

// The specification, implemented independently of the Python reference.
export function oracle(formulas, edits) {
  const names = Object.keys(formulas);
  const isF = new Set(names);
  const level = new Map();
  const colour = new Map();          // 1 = on the stack, 2 = done
  let cyclic = false;
  const depth = (f) => {
    if (colour.get(f) === 2) return level.get(f);
    if (colour.get(f) === 1) { cyclic = true; return 0; }
    colour.set(f, 1);
    let lv = 1;
    for (const x of formulas[f]) if (isF.has(x)) lv = Math.max(lv, depth(x) + 1);
    colour.set(f, 2);
    level.set(f, lv);
    return lv;
  };
  for (const f of names) depth(f);
  if (cyclic) return null;
  return edits.map((edit) => {
    const changed = new Set(edit);
    const hit = new Set();
    for (let again = true; again;) {
      again = false;
      for (const f of names) {
        if (hit.has(f)) continue;
        if (formulas[f].some((x) => changed.has(x))) { hit.add(f); changed.add(f); again = true; }
      }
    }
    return [...hit].sort((a, b) => level.get(a) - level.get(b) || (a < b ? -1 : a > b ? 1 : 0));
  });
}

const q = (s) => "'" + s + "'";
const pyList = (xs) => "[" + xs.map(q).join(", ") + "]";
const pyOut = (v) => (v === null ? "None" : "[" + v.map(pyList).join(", ") + "]");
const pyArgs = (formulas, edits) =>
  "({" + Object.entries(formulas).map(([f, refs]) => `${q(f)}: ${pyList(refs)}`).join(", ") + "}, [" + edits.map(pyList).join(", ") + "])";

const OBJECTS = {
  Opportunity: {
    inputs: ["Amount", "Probability", "Discount__c", "Quantity__c", "Unit_Price__c", "Tax_Rate__c", "Close_Date__c", "Stage__c"],
    formulas: ["Gross__c", "Net_Amount__c", "Tax__c", "Total__c", "Weighted_Amount__c", "Commission__c", "Margin__c", "Days_To_Close__c", "Deal_Size_Band__c", "Approval_Needed__c", "Expected_Revenue__c", "Health_Score__c"],
  },
  Case: {
    inputs: ["Priority__c", "Opened_At__c", "First_Response_At__c", "Severity__c", "Tier__c", "Reopen_Count__c", "Channel__c", "Region__c"],
    formulas: ["Age_Hours__c", "Response_Hours__c", "Breach_Risk__c", "Target_Hours__c", "SLA_Status__c", "Escalation_Level__c", "Routing_Score__c", "Queue_Band__c", "Customer_Impact__c", "Weighted_Priority__c", "Follow_Up_Due__c", "Health_Flag__c"],
  },
  Invoice__c: {
    inputs: ["Subtotal__c", "Discount_Pct__c", "Tax_Rate__c", "Freight__c", "Due_Date__c", "Paid_Amount__c", "Currency_Rate__c", "Terms_Days__c"],
    formulas: ["Discount_Amount__c", "Net__c", "Tax_Amount__c", "Grand_Total__c", "Balance_Due__c", "Days_Overdue__c", "Late_Fee__c", "Corporate_Total__c", "Status_Label__c", "Aging_Bucket__c", "Payment_Score__c", "Reminder_Due__c"],
  },
};

function randomCase(r, level) {
  const objName = r.pick(Object.keys(OBJECTS));
  const obj = OBJECTS[objName];
  const inputs = r.sample(obj.inputs, level === 1 ? 4 : 6);
  const nF = level === 1 ? r.int(4, 6) : level === 2 ? r.int(7, 9) : r.int(8, 10);
  const fnames = r.sample(obj.formulas, nF);       // creation order = a valid dependency order
  const formulas = {};
  fnames.forEach((f, j) => {
    const refs = [];
    const k = level === 1 ? r.int(1, 2) : r.int(1, 3);
    for (let i = 0; i < k; i++) {
      const fromF = j > 0 && r.chance(level === 1 ? 0.5 : 0.65);
      refs.push(fromF ? fnames[r.int(Math.max(0, j - 3), j - 1)] : r.pick(inputs));
    }
    if (level >= 2 && r.chance(0.15)) refs.push(refs[0]);                // a field referenced twice
    if (level >= 2 && r.chance(0.1)) refs.push("Owner_Region__c");       // defined nowhere: an input
    formulas[f] = refs;
  });
  if (level === 3 && r.chance(0.2)) {                                    // close a cycle
    const a = fnames[r.int(0, 1)], b = fnames[fnames.length - 1];
    formulas[a] = formulas[a].concat([b]);
  }
  const order = r.shuffle(fnames);                                       // dict order says nothing
  const shuffled = {};
  for (const f of order) shuffled[f] = formulas[f];
  const edits = [];
  const nE = level === 1 ? r.int(2, 3) : r.int(3, 4);
  for (let i = 0; i < nE; i++) {
    const e = r.sample(inputs, level === 1 ? 1 : r.int(1, 2));
    if (level === 3 && r.chance(0.2)) e.push(e[0]);
    edits.push(level === 3 && r.chance(0.1) ? [] : e);
  }
  return { formulas: shuffled, edits };
}

export function generate(r, level) {
  const samples = [];
  for (let i = 0; i < 2; i++) {
    let c, got;
    for (let t = 0; t < 50; t++) {
      c = randomCase(r, level);
      got = oracle(c.formulas, c.edits);
      if (got === null ? level === 3 && i === 1 : got.some((x) => x.length >= 2)) break;
    }
    samples.push({ args: pyArgs(c.formulas, c.edits), expect: pyOut(got) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const X = r.pick(["Quantity__c", "Amount", "List_Price__c"]);
  const Y = r.pick(["Discount__c", "Tax_Rate__c", "Freight__c"]);
  const edges = [
    ["a chain is evaluated in dependency order even when the names sort the other way",
      { Amount_Due__c: ["Net__c"], Net__c: ["Subtotal__c", Y], Subtotal__c: [X] }, [[X]]],
    ["a diamond lists the shared formula once, after both parents",
      { Total__c: ["Gross__c", "Tax__c"], Tax__c: [X], Gross__c: [X] }, [[X]]],
    ["equal levels are ordered by API name", { Zeta__c: [X], Beta__c: [X], Mid__c: [X] }, [[X]]],
    ["a level is the longest chain, not the shortest",
      { A_Score__c: [X, "C_Band__c"], C_Band__c: ["B_Base__c"], B_Base__c: [X] }, [[X]]],
    ["levels come from the whole graph, not from the edited field",
      { Alpha__c: [X, "Q_Rate__c"], Q_Rate__c: [Y], Zeta__c: [X] }, [[X], [Y]]],
    ["an edit to a field no formula references recalculates nothing",
      { Net__c: [X] }, [["Description"], [X]]],
    ["a cycle makes the configuration invalid", { Net__c: ["Total__c", X], Total__c: ["Net__c"] }, [[X]]],
    ["edits are answered in order, one list each", { Net__c: [X], Tax__c: [Y], Total__c: ["Net__c", "Tax__c"] }, [[Y], [X, Y], [X]]],
  ];
  if (level >= 2) {
    edges.push(["a formula that references the same field twice", { Net__c: [X, X, Y], Total__c: ["Net__c", "Net__c"] }, [[X]]]);
    edges.push(["a referenced field that no formula defines is an input", { Net__c: ["Partner_Rebate__c"] }, [["Partner_Rebate__c"]]]);
    edges.push(["a deep chain", Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`L${String(11 - i).padStart(2, "0")}__c`, [i === 0 ? X : `L${String(12 - i).padStart(2, "0")}__c`]])), [[X]]]);
  }
  if (level === 3) {
    edges.push(["a formula that references itself is a cycle", { Net__c: [X], Total__c: ["Total__c", "Net__c"] }, [[X]]]);
    edges.push(["a cycle no edit reaches still makes the configuration invalid",
      { Net__c: [X], Loop_A__c: ["Loop_B__c"], Loop_B__c: ["Loop_A__c", Y] }, [[X]]]);
    edges.push(["an empty edit and a repeated field", { Net__c: [X], Total__c: ["Net__c", Y] }, [[], [X, X], [Y, X]]]);
    edges.push(["no edits at all", { Net__c: [X] }, []]);
  }
  for (const [name, f, e] of edges) tests.push({ name, args: pyArgs(f, e), expect: pyOut(oracle(f, e)) });

  // Timing: 2,500 objects' worth of fields (37,500 formulas, about 75,000 references)
  // and 3,000 saves. Levels once plus a walk of each edit's dependants is fast;
  // anything that scans every formula on every edit is O(edits · (V + E)).
  tests.push({
    name: "37,500 formulas and 3,000 edits (levels once, then walk only the dependants)",
    args: `_gen_formulas(2500, 3000, ${r.int(1, 1_000_000)})`,
    limit_s: 8,
  });

  return {
    vars: {
      shape_rule: level === 1
        ? "In this exercise's samples every formula reads at most two fields and the chains are short."
        : level === 2
          ? "Formulas may read the same field twice, read a field that no formula defines (treat it as an input), and form chains a dozen levels deep."
          : "Formulas may read the same field twice or a field no formula defines; an edit may be empty or name a field twice; and some configurations contain a cycle, possibly one that no edit reaches.",
    },
    samples,
    tests,
  };
}
