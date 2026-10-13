/* ANT-L2-02 — Safety evaluation plan under an accelerator budget (Python).
   Simulated practice scenario. All data is generated from the seed.

   Contract (python): entry, signature, starter, prelude, generate(r, level) ->
     { vars, samples: [{args, expect}], tests: [{name, args, expect?, limit_s?}] }.
   expect comes from oracle() below: a knapsack over the suites in depth-first order
   (take a suite and move to the next position, or skip it together with its whole
   subtree), comparing (coverage, -hours) pairs. The evaluator's reference passes a
   budget array down the tree instead; the two were written independently and both
   were checked against subset enumeration on small inputs.
   level: 1 Medium (a small forest, no required suites)
          · 2 Hard (+ required release-gate suites; None when they cannot fit)
          · 3 Very Hard (+ zero-cost suites, required suites deep in the tree,
            and a chain thousands of suites deep) */
export const kind = "python";
export const entry = "plan_evals";
export const signature = "def plan_evals(suites: list[tuple[str, str | None, int, int]], budget: int, required: list[str]) -> tuple[int, int] | None:";
export const starter = `def plan_evals(suites, budget, required):
    """suites: (suite_id, parent_id or None, hours, coverage).
    A suite can run only if its parent runs. Return (coverage, hours) of the
    plan with the most coverage within budget (fewest hours on a tie), or None
    if the required suites cannot all run within budget."""
    ...
`;

export const prelude = `
def _gen_suites(n, seed, chain=0):
    x, out = seed, []
    def rnd(m):
        nonlocal x
        x = (1103515245 * x + 12345) % 2147483648
        return (x >> 16) % m
    for i in range(n):
        if i == 0 or (i >= chain and rnd(8) == 0):
            parent = None
        elif i < chain:
            parent = 'suite_%d' % (i - 1)              # a long chain of extensions
        else:
            parent = 'suite_%d' % (i - 1 - rnd(min(i, 40)))
        out.append(('suite_%d' % i, parent, 1 + rnd(60), rnd(101)))
    return out
`.trim() + "\n";

// Depth-first-order knapsack. Position i either runs suite order[i] (and goes on to
// i + 1, its first child) or skips its whole subtree (jumps to i + size).
export function oracle(suites, budget, required) {
  const byId = new Map(suites.map((s) => [s[0], s]));
  const kids = new Map([[null, []]]);
  for (const s of suites) kids.set(s[0], []);
  for (const s of suites) kids.get(s[1]).push(s[0]);
  const order = [];
  const stack = kids.get(null).slice().reverse();
  while (stack.length) {
    const id = stack.pop();
    order.push(id);
    const ch = kids.get(id);
    for (let i = ch.length - 1; i >= 0; i--) stack.push(ch[i]);
  }
  const n = order.length;
  const pos = new Map(order.map((id, i) => [id, i]));
  const size = new Array(n).fill(1);
  for (let i = n - 1; i >= 0; i--) {
    const p = byId.get(order[i])[1];
    if (p !== null) size[pos.get(p)] += size[i];
  }
  const must = new Array(n).fill(false);
  for (let id of required) {
    while (id !== null && !must[pos.get(id)]) { must[pos.get(id)] = true; id = byId.get(id)[1]; }
  }
  const better = (a, b) => (b === null || (a !== null && (a[0] > b[0] || (a[0] === b[0] && a[1] < b[1])))); // a beats b
  // f[i][rem]: best [coverage, hours] from positions i.. with rem hours left, or null.
  let f = Array.from({ length: n + 1 }, () => null);
  f[n] = new Array(budget + 1).fill(null).map(() => [0, 0]);
  for (let i = n - 1; i >= 0; i--) {
    const [, , hours, cov] = byId.get(order[i]);
    const row = new Array(budget + 1).fill(null);
    for (let rem = 0; rem <= budget; rem++) {
      let best = null;
      if (hours <= rem) {
        const t = f[i + 1][rem - hours];
        if (t !== null) best = [t[0] + cov, t[1] + hours];
      }
      if (!must[i]) {
        const s = f[i + size[i]][rem];
        if (better(s, best)) best = s;
      }
      row[rem] = best;
    }
    f[i] = row;
  }
  return f[0][budget];
}

const pyOut = (v) => (v === null ? "None" : `(${v[0]}, ${v[1]})`);
const pyArgs = (suites, budget, req) =>
  `([${suites.map(([id, p, h, c]) => `('${id}', ${p === null ? "None" : `'${p}'`}, ${h}, ${c})`).join(", ")}], ${budget}, [${req.map((x) => `'${x}'`).join(", ")}])`;

const AREAS = ["jailbreak", "harmful-advice", "privacy-leakage", "bias", "self-harm", "election-integrity", "cyber-misuse", "agentic-misuse", "honesty", "child-safety"];
const EXT = ["multiturn", "multilingual", "tool-use", "long-context", "adversarial", "regression"];

function forest(r, level) {
  const areas = r.sample(AREAS, level === 1 ? r.int(2, 3) : r.int(3, 4));
  const suites = [];
  const n = level === 1 ? r.int(6, 8) : level === 2 ? r.int(8, 10) : r.int(9, 12);
  for (const a of areas) suites.push([`${a}/base`, null, r.int(4, 30), r.int(1, 20)]);
  while (suites.length < n) {
    const p = r.pick(suites);
    if (p[0].split("/").length > 3) continue;
    const ext = r.pick(EXT.filter((e) => !p[0].split("/").includes(e)));
    const id = `${p[0].replace(/\/base$/, "")}/${ext}`;
    if (suites.some((s) => s[0] === id)) continue;
    const zero = level === 3 && r.chance(0.15);
    suites.push([id, p[0], zero ? 0 : r.int(2, 25), r.int(0, 20)]);
  }
  return r.shuffle(suites);
}

function smallCase(r, level) {
  for (let attempt = 0; attempt < 80; attempt++) {
    const suites = forest(r, level);
    const total = suites.reduce((s, x) => s + x[2], 0);
    const budget = Math.floor(total * r.int(30, 65) / 100);
    let req = [];
    if (level >= 2 && r.chance(0.8)) req = r.sample(suites.map((s) => s[0]), r.int(1, 2));
    const got = oracle(suites, budget, req);
    if (level === 1 && (got === null || got[0] === 0)) continue;
    return { suites, budget, req, got };
  }
  throw new Error("ANT-L2-02: could not build a sample");
}

export function generate(r, level) {
  const samples = [];
  let feasible = 0;
  for (let i = 0; i < 3; i++) {
    const c = smallCase(r, level);
    if (c.got !== null) feasible++;
    if (i === 2 && feasible === 0) { i--; continue; }      // keep at least one plan visible
    samples.push({ args: pyArgs(c.suites, c.budget, c.req), expect: pyOut(c.got) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const [a, b, c] = r.sample(AREAS, 3);
  const x = r.pick(EXT);
  const baseH = r.int(25, 35), extH = r.int(4, 8), otherH = r.int(8, 14);
  const parentFirst = [[`${a}/base`, null, baseH, 1], [`${a}/${x}`, `${a}/base`, extH, 20], [`${b}/base`, null, otherH, 12]];
  const edges = [
    ["a valuable extension still needs its base suite", parentFirst, baseH + extH - 1, []],
    ["a plan that uses exactly the budget is allowed", parentFirst, baseH + extH, []],
    ["equal coverage: the plan with fewer hours wins", [[`${a}/base`, null, 10, 5], [`${b}/base`, null, 7, 5]], 10, []],
    ["an extension listed before its base", [[`${a}/${x}`, `${a}/base`, 3, 9], [`${b}/base`, null, 6, 4], [`${a}/base`, null, 5, 2]], 9, []],
    ["a budget of 0 runs nothing that costs hours", [[`${a}/base`, null, 5, 7], [`${b}/base`, null, 1, 1]], 0, []],
    ["no suite fits: the empty plan (0, 0)", [[`${a}/base`, null, 50, 9]], 40, []],
  ];
  if (level >= 2) {
    const g = [[`${a}/base`, null, 12, 2], [`${a}/${x}`, `${a}/base`, 6, 3], [`${b}/base`, null, 9, 15], [`${c}/base`, null, 4, 6]];
    edges.push(["a required extension forces its base, even when that lowers coverage", g, 22, [`${a}/${x}`]]);
    edges.push(["required suites that do not fit: None", g, 17, [`${a}/${x}`]]);
    edges.push(["required suites that exactly fill the budget", g, 18, [`${a}/${x}`]]);
    edges.push(["required list empty behaves like no gate", g, 22, []]);
  }
  if (level === 3) {
    edges.push(["a zero-hour suite under a zero-hour base is always run", [[`${a}/base`, null, 0, 0], [`${a}/${x}`, `${a}/base`, 0, 4], [`${b}/base`, null, 3, 3]], 2, []]);
    const chain = [];
    let sum = 0, cov = 0;
    for (let i = 0; i < 3000; i++) {
      const h = i % 97 === 0 ? 1 : 0, v = i % 13 === 0 ? 1 : 0;
      sum += h; cov += v;
      chain.push([`${a}/step_${i}`, i === 0 ? null : `${a}/step_${i - 1}`, h, v]);
    }
    edges.push(["a required suite at the bottom of a 3 000-suite chain", chain, sum, [`${a}/step_2999`]]);
    edges.push(["the same chain without the gate and one hour less", chain, sum - 1, []]);
  }
  for (const [name, s, bud, req] of edges) tests.push({ name, args: pyArgs(s, bud, req), expect: pyOut(oracle(s, bud, req)) });

  // Timing: thousands of suites and a budget in the thousands. O(n · budget) is well
  // under a second; merging children with a full budget × budget convolution, or
  // enumerating subsets, is not. Very Hard nests 2 500 suites in one chain.
  const n = level === 1 ? 1500 : level === 2 ? 2500 : 3000;
  const bud = level === 1 ? 1500 : 2000;
  const chainLen = level === 3 ? 2500 : 0;
  tests.push({
    name: `${n.toLocaleString("en-US")} suites, budget ${bud.toLocaleString("en-US")} hours${chainLen ? ", a 2 500-deep chain" : ""} (O(n · budget))`,
    args: `(_gen_suites(${n}, ${r.int(1, 1_000_000)}, ${chainLen}), ${bud}, ${level >= 2 ? "['suite_0']" : "[]"})`,
    limit_s: 8,
  });

  return {
    vars: {
      gate_rule: level === 1
        ? "In this release `required` is always empty, but keep the parameter."
        : "`required` lists the release-gate suites: every one of them must run, and so must its ancestors. If they cannot all run within `budget`, return `None`.",
      depth_rule: level === 3
        ? "Some suites cost 0 hours (they reuse results already computed), and some families are thousands of extensions deep."
        : "Families are a few levels deep.",
    },
    samples,
    tests,
  };
}
