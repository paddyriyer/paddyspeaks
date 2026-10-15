/* PLT-L1-04 — Pipeline cycles: the groups of datasets that depend on each other in a
   cycle, from declared inputs (Python).
   Simulated practice scenario. All data is generated from the seed and is hypothetical.

   Contract (python): entry, signature, starter, prelude, generate(r, level) ->
     { vars, samples: [{args, expect}], tests: [{name, args, expect?, limit_s?}] }.
   expect comes from oracle() below: for each dataset not yet placed, a forward search
   along inputs intersected with a backward search along readers (O(groups · (V + E)),
   fine for test sizes). The evaluator's reference is an iterative Tarjan, written
   independently.
   level: 1 Medium (every input is declared; simple and joined cycles)
          2 Hard (+ datasets that read themselves, undeclared raw sources, duplicate
                  inputs, two cycles sharing a dataset)
          3 Very Hard (+ a cycle thousands of datasets long, so a recursive search with
                       the default recursion limit fails; the timing test is a
                       100 000-dataset cycle) */
export const kind = "python";
export const entry = "pipeline_cycles";
export const signature = "def pipeline_cycles(inputs: dict[str, list[str]]) -> list[list[str]]:";
export const starter = `def pipeline_cycles(inputs):
    """inputs: {dataset: [datasets it reads]}. An input that is not a key is a raw source.
    Return the cycle groups: each sorted ascending, groups sorted by first element."""
    ...
`;

export const prelude = `
def _gen_pipeline(n, seed, chain=0, extras=False):
    x = seed
    def rnd(m):
        nonlocal x
        x = (1103515245 * x + 12345) % 2147483648
        return (x >> 16) % m
    names = ['ds_%06d' % i for i in range(n)]
    inputs = {}
    i = 0
    while i < n:                                 # blocks of 1-5 datasets, most of them cycles
        end = min(n, i + 1 + rnd(5))
        cyc = end - i > 1 and rnd(3) > 0
        for j in range(i, end):
            ins = [names[j - 1]] if j > i else ([names[end - 1]] if cyc else [])
            for _ in range(rnd(3)):              # plus reads from earlier blocks (acyclic)
                if i:
                    ins.append(names[rnd(i)])
            if extras and rnd(40) == 0:
                ins.append('raw_%d' % rnd(300))  # an undeclared source
            if extras and end - i == 1 and rnd(25) == 0:
                ins.append(names[j])             # reads itself
            inputs[names[j]] = ins
        i = end
    for k in range(chain):                       # one very long cycle
        ins = ['loop_%06d' % ((k - 1) % chain)]
        if rnd(5) == 0:
            ins.append(names[rnd(n)])
        inputs['loop_%06d' % k] = ins
    return (inputs,)
`.trim() + "\n";

const cmpS = (x, y) => (x < y ? -1 : x > y ? 1 : 0);

// Specification, the slow way: for each dataset not yet placed, intersect what it can
// reach along inputs with what can reach it. A group counts if it has two or more
// datasets, or one dataset that lists itself.
export function oracle(inputs) {
  const fwd = new Map(), back = new Map();
  const node = (x) => { if (!fwd.has(x)) { fwd.set(x, []); back.set(x, []); } };
  for (const [ds, ins] of Object.entries(inputs)) {
    node(ds);
    for (const i of ins) { node(i); fwd.get(ds).push(i); back.get(i).push(ds); }
  }
  const search = (g, s) => {
    const seen = new Set([s]); const todo = [s];
    while (todo.length) { const u = todo.pop(); for (const v of g.get(u)) if (!seen.has(v)) { seen.add(v); todo.push(v); } }
    return seen;
  };
  const placed = new Set();
  const groups = [];
  for (const s of [...fwd.keys()].sort(cmpS)) {
    if (placed.has(s)) continue;
    const b = search(back, s);
    const comp = [...search(fwd, s)].filter((x) => b.has(x)).sort(cmpS);
    for (const c of comp) placed.add(c);
    if (comp.length > 1 || (inputs[s] || []).includes(s)) groups.push(comp);
  }
  groups.sort((a, b) => cmpS(a[0], b[0]));
  return groups;
}

const q = (s) => `'${s}'`;
const pyOut = (groups) => "[" + groups.map((g) => "[" + g.map(q).join(", ") + "]").join(", ") + "]";
const pyArgs = (inputs) => "({" + Object.entries(inputs).map(([k, v]) => `${q(k)}: [${v.map(q).join(", ")}]`).join(", ") + "},)";

const NAMES = ["capacity_plan", "demand_plan", "inventory_daily", "machine_health", "maintenance_backlog", "orders_clean",
  "orders_enriched", "parts_usage", "plant_kpis", "quality_flags", "shipments_joined", "supplier_risk", "supplier_scores",
  "work_orders_open", "yield_daily", "downtime_events", "lead_times", "service_levels"];
const RAW = ["raw_erp_orders", "raw_mes_events", "raw_sensor_dump", "raw_supplier_feed"];

function randomCase(r, level) {
  for (let attempt = 0; attempt < 100; attempt++) {
    const n = level === 1 ? r.int(6, 8) : level === 2 ? r.int(8, 10) : r.int(9, 12);
    const names = r.sample(NAMES, n);
    const inputs = {};
    for (const ds of r.shuffle(names)) {
      const ins = [];
      const k = r.pick([0, 1, 1, 1, 2]);
      for (let j = 0; j < k; j++) {
        const other = r.pick(names.filter((x) => x !== ds));
        if (level === 1 && ins.includes(other)) continue;
        ins.push(other);
      }
      if (level >= 2 && r.chance(0.12)) ins.push(ds);                      // reads itself
      if (level >= 2 && r.chance(0.2)) ins.push(r.pick(RAW));              // undeclared source
      if (level >= 2 && ins.length && r.chance(0.1)) ins.push(ins[0]);     // duplicate input
      inputs[ds] = ins;
    }
    const got = oracle(inputs);
    const declared = new Set(names);
    const inCycle = got.reduce((s, g) => s + g.length, 0);
    if (got.length >= 1 && inCycle < declared.size) return { inputs, got };
  }
  throw new Error("PLT-L1-04: could not build a sample");
}

export function generate(r, level) {
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const c = randomCase(r, level);
    samples.push({ args: pyArgs(c.inputs), expect: pyOut(c.got) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const [a, b, c, d, e, f, g] = r.sample(NAMES, 7);
  const edges = [
    ["no inputs at all", {}],
    ["a plain chain has no cycle", { [a]: [b], [b]: [c], [c]: [] }],
    ["two datasets that read each other", { [a]: [b], [b]: [a], [c]: [a] }],
    ["a cycle feeding datasets outside it: only the cycle is reported", { [a]: [c], [b]: [a], [c]: [b], [d]: [a], [e]: [d, c] }],
    ["two cycles joined one way stay two groups", { [a]: [b], [b]: [a], [c]: [d, a], [d]: [c] }],
    ["a diamond of shared inputs is not a cycle", { [a]: [b, c], [b]: [d], [c]: [d], [d]: [] }],
  ];
  if (level >= 2) {
    edges.push(["a dataset that reads itself is a group of one", { [a]: [a], [b]: [a], [c]: [b, c] }]);
    edges.push(["undeclared raw sources and duplicate inputs", { [a]: [RAW[0], b, b], [b]: [a, RAW[1]], [c]: [RAW[0]] }]);
    edges.push(["two cycles sharing a dataset are one group", { [a]: [b], [b]: [c], [c]: [a, d], [d]: [e], [e]: [c], [f]: [e] }]);
    edges.push(["a cycle reached only through other datasets", { [g]: [f], [f]: [e], [e]: [d], [d]: [c], [c]: [b], [b]: [a], [a]: [c] }]);
  }
  if (level === 3) {
    const n = r.int(2400, 3000);
    const deep = {};
    for (let k = 0; k < n; k++) deep[`stage_${String(k).padStart(5, "0")}`] = [`stage_${String((k + n - 1) % n).padStart(5, "0")}`];
    deep[a] = ["stage_00000"];
    edges.push([`a cycle of ${n} datasets (too deep for a recursive search at the default limit)`, deep]);
    const chain = {};
    for (let k = 0; k < n; k++) chain[`step_${String(k).padStart(5, "0")}`] = k ? [`step_${String(k - 1).padStart(5, "0")}`] : [b];
    chain[b] = [c];
    chain[c] = [b];
    edges.push([`a ${n}-dataset chain ending in a two-dataset cycle`, chain]);
  }
  for (const [name, inputs] of edges) tests.push({ name, args: pyArgs(inputs), expect: pyOut(oracle(inputs)) });

  const seed = r.int(1, 1_000_000);
  tests.push(level === 3
    ? { name: "a 100,000-dataset cycle plus 30,000 others (iterative and linear)", args: `_gen_pipeline(30000, ${seed}, 100000, True)`, limit_s: 8 }
    : { name: "60,000 datasets, about 10,000 cycles (one linear pass, not a search per dataset)", args: `_gen_pipeline(60000, ${seed}, 0, ${level === 2 ? "True" : "False"})`, limit_s: 8 });

  return {
    vars: {
      self_rule: level === 1
        ? "In this exercise's samples no dataset lists itself and every input is declared, but your code must still handle both."
        : "Some datasets list themselves, some inputs are raw sources that are not keys, and an input can be listed twice.",
      depth_rule: level === 3
        ? "Some pipelines are very deep: a single cycle can run through 100 000 datasets."
        : "Pipelines can hold tens of thousands of datasets.",
    },
    samples,
    tests,
  };
}
