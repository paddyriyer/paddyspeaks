/* GDM-L2-03 — Debug the checkpoint retention planner (debug, Python).
   Simulated practice scenario. All data is generated from the seed; every run,
   step, metric and pin is synthetic.

   Contract (debug): like python, but `starter` is buggy code the candidate fixes.
   The evaluator's reference is the fixed code. expect comes from oracle() below, an
   independent JavaScript implementation of the specification in the template.
   Planted bugs (see the evaluator notes): the last k checkpoints are kept across all
   runs instead of per run; the metric direction is read from a value the policy
   never uses, so "min" is treated as higher-is-better; step 0 is left out of the
   every-Nth rule; pins are matched by step only, protecting the same step in every
   run; ties on the metric are broken by input order instead of by step.
   level: 1 Medium (samples: a single run, higher metric is better, no pins)
          2 Hard (+ several runs, a metric where lower is better, and pins)
          3 Very Hard (+ ties on the metric, step 0, and pins on deleted checkpoints) */
export const kind = "debug";
export const entry = "plan_deletions";
export const signature = "def plan_deletions(checkpoints: list[dict], policy: dict, pins: list[tuple[str, int]]) -> list[tuple[str, int]]:";
export const starter = `def plan_deletions(checkpoints, policy, pins):
    """checkpoints: dicts {"run", "step", "metric"}, one per saved checkpoint.
    policy: {"keep_last", "keep_best", "metric_mode": "min" | "max", "every"}.
    pins: (run, step) pairs that an evaluation still points at.
    Return the (run, step) pairs to delete, sorted."""
    keep_last = policy["keep_last"]
    keep_best = policy["keep_best"]
    every = policy["every"]
    lower_is_better = policy["metric_mode"] == "lower"

    by_run = {}
    for ck in checkpoints:
        by_run.setdefault(ck["run"], []).append(ck)

    keep = set()

    # 1. the most recent checkpoints
    latest = sorted(checkpoints, key=lambda ck: ck["step"], reverse=True)
    for ck in latest[:keep_last]:
        keep.add((ck["run"], ck["step"]))

    # 2. the best checkpoints of each run by its evaluation metric
    for run, cks in by_run.items():
        ranked = sorted(cks, key=lambda ck: ck["metric"], reverse=not lower_is_better)
        for ck in ranked[:keep_best]:
            keep.add((run, ck["step"]))

    # 3. every Nth step, as a sparse history of the run
    for ck in checkpoints:
        if ck["step"] and ck["step"] % every == 0:
            keep.add((ck["run"], ck["step"]))

    # 4. checkpoints that an evaluation still points at
    pinned_steps = {step for _, step in pins}
    for ck in checkpoints:
        if ck["step"] in pinned_steps:
            keep.add((ck["run"], ck["step"]))

    return sorted((ck["run"], ck["step"]) for ck in checkpoints
                  if (ck["run"], ck["step"]) not in keep)
`;

export const prelude = `
def _gen_checkpoints(n_runs, per_run, seed, mode='min', n_pins=5000):
    x = seed

    def nxt():
        nonlocal x
        x = (1103515245 * x + 12345) % 2147483648
        return x >> 12
    cks, pins = [], []
    for r in range(n_runs):
        run = 'run-%05d' % r
        stride = 250 * (1 + nxt() % 8)
        for i in range(per_run):
            cks.append({'run': run, 'step': i * stride, 'metric': (nxt() % 4000) / 1000})
    for _ in range(n_pins):
        c = cks[nxt() % len(cks)]
        pins.append((c['run'], c['step'] + (0 if nxt() % 5 else 125)))
    for i in range(len(cks) - 1, 0, -1):
        j = nxt() % (i + 1)
        cks[i], cks[j] = cks[j], cks[i]
    policy = {'keep_last': 3, 'keep_best': 2, 'metric_mode': mode, 'every': 5000}
    return cks, policy, pins
`.trim() + "\n";

// The specification, implemented independently of the Python reference. Metrics are
// held as integer thousandths, so comparisons and ties are exact.
export function oracle(cks, policy, pins) {
  const runs = new Map();
  for (const c of cks) {
    if (!runs.has(c.run)) runs.set(c.run, []);
    runs.get(c.run).push(c);
  }
  const keep = new Set();
  const key = (run, step) => run + "\u0000" + step;
  for (const list of runs.values()) {
    const byStep = list.slice().sort((a, b) => b.step - a.step);
    for (const c of byStep.slice(0, policy.keep_last)) keep.add(key(c.run, c.step));
    const sign = policy.metric_mode === "min" ? 1 : -1;
    const byMetric = list.slice().sort((a, b) => sign * (a.m - b.m) || a.step - b.step);
    for (const c of byMetric.slice(0, policy.keep_best)) keep.add(key(c.run, c.step));
  }
  for (const c of cks) if (c.step % policy.every === 0) keep.add(key(c.run, c.step));
  const pinned = new Set(pins.map(([run, step]) => key(run, step)));
  for (const c of cks) if (pinned.has(key(c.run, c.step))) keep.add(key(c.run, c.step));
  return cks.filter((c) => !keep.has(key(c.run, c.step)))
    .map((c) => [c.run, c.step])
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] - b[1]));
}

const metric = (m) => (m / 1000).toFixed(3);
const pyCk = (c) => `{'run': '${c.run}', 'step': ${c.step}, 'metric': ${metric(c.m)}}`;
const pyPolicy = (p) => `{'keep_last': ${p.keep_last}, 'keep_best': ${p.keep_best}, 'metric_mode': '${p.metric_mode}', 'every': ${p.every}}`;
const pyArgs = (c) => `([${c.cks.map(pyCk).join(", ")}], ${pyPolicy(c.policy)}, [${c.pins.map(([r, s]) => `('${r}', ${s})`).join(", ")}])`;
const pyOut = (xs) => "[" + xs.map(([r, s]) => `('${r}', ${s})`).join(", ") + "]";
const run = (c) => oracle(c.cks, c.policy, c.pins);

const RUN_NAMES = ["lm-small", "lm-base", "vision-a", "vision-b", "agent-x", "agent-y", "fold-1", "fold-2"];

function randomCase(r, level) {
  for (let attempt = 0; attempt < 200; attempt++) {
    const nRuns = level === 1 ? 1 : r.int(2, 3);
    const runs = r.sample(RUN_NAMES, nRuns);
    const every = r.pick([1000, 2000, 2500]);
    const cks = [];
    for (const name of runs) {
      const stride = r.pick([250, 500]);
      const start = level === 3 && r.chance(0.6) ? 0 : stride;
      const n = r.int(6, 9);
      for (let i = 0; i < n; i++) {
        const m = level === 3 && cks.length && r.chance(0.25) ? r.pick(cks.filter((c) => c.run === name).map((c) => c.m).concat([r.int(500, 3500)])) : r.int(500, 3500);
        cks.push({ run: name, step: start + i * stride, m });
      }
    }
    const mode = level === 1 ? "max" : r.pick(["min", "max"]);
    const policy = { keep_last: r.int(1, 2), keep_best: r.int(1, 2), metric_mode: mode, every };
    const pins = [];
    if (level >= 2) {
      for (let i = 0; i < r.int(1, 2); i++) { const c = r.pick(cks); pins.push([c.run, c.step]); }
      if (level === 3) pins.push([r.pick(runs), 100000 + 250 * r.int(0, 20)]);   // a checkpoint already deleted
    }
    const c = { cks: r.shuffle(cks), policy, pins };
    const del = run(c);
    if (del.length >= 2 && del.length < cks.length - 2) return c;
  }
  throw new Error("GDM-L2-03: could not build a sample with kept and deleted checkpoints");
}

export function generate(r, level) {
  const samples = [];
  for (let i = 0; i < 2; i++) {
    const c = randomCase(r, level);
    samples.push({ args: pyArgs(c), expect: pyOut(run(c)) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const [A, B] = r.sample(RUN_NAMES, 2).sort();
  const big = 1_000_000;                                    // an every-Nth rule that keeps nothing
  const S = r.pick([250, 500]);                             // step stride
  const ms = () => r.shuffle([800, 1200, 1500, 2100, 2600, 3100, 3400, 900]);
  const series = (run, n, first, stride, metrics) => Array.from({ length: n }, (_, i) => ({ run, step: first + i * stride, m: metrics[i % metrics.length] }));
  const P = (keep_last, keep_best, metric_mode, every) => ({ keep_last, keep_best, metric_mode, every });
  const tieA = series(A, 6, S, S, [1100, 2400, 1700, 2400, 900, 1300]);   // steps 2S and 4S tie for best
  const edges = [
    ["the last k are kept in every run, not across all runs",
      { cks: r.shuffle([...series(A, 6, 4 * S, 4 * S, ms()), ...series(B, 5, S, S, ms())]), policy: P(2, 0, "max", big), pins: [] }],
    ["with metric_mode min, the lowest metric is the best",
      { cks: r.shuffle(series(A, 7, S, S, ms())), policy: P(1, 2, "min", big), pins: [] }],
    ["step 0 is a multiple of every N",
      { cks: r.shuffle(series(A, 9, 0, S, ms())), policy: P(1, 0, "max", 4 * S), pins: [] }],
    ["a pin protects one checkpoint of one run, not the same step in other runs",
      { cks: r.shuffle([...series(A, 4, S, S, ms()), ...series(B, 4, S, S, ms())]), policy: P(0, 0, "max", big), pins: [[A, 2 * S]] }],
    ["a tie on the best metric goes to the earlier step",
      { cks: [tieA[3], tieA[5], tieA[1], tieA[0], tieA[2], tieA[4]], policy: P(1, 1, "max", big), pins: [] }],
    ["a checkpoint kept by two rules is kept once, and k larger than the run keeps it all",
      { cks: r.shuffle([...series(A, 3, S, S, ms()), ...series(B, 6, S, S, ms())]), policy: P(4, 1, "max", 2 * S), pins: [] }],
    ["a pin on a checkpoint that is already gone changes nothing",
      { cks: r.shuffle(series(A, 6, S, S, ms())), policy: P(1, 1, "max", big), pins: [[A, 100 * S], [B, S]] }],
  ];
  if (level >= 2) {
    edges.push(["a tie on the lowest metric, with metric_mode min",
      { cks: r.shuffle(series(A, 6, S, S, [1500, 600, 2200, 600, 1900, 2500])), policy: P(1, 1, "min", big), pins: [] }]);
  }
  if (level === 3) {
    edges.push(["every rule at once across three runs",
      { cks: r.shuffle([...series(A, 8, 0, S, ms()), ...series(B, 6, 0, 2 * S, [1000, 400, 1000, 400, 3000, 2000]), ...series("zeta-run", 3, S, S, ms())]), policy: P(2, 1, "min", 4 * S), pins: [[B, 2 * S], [A, 3 * S], ["zeta-run", 7 * S]] }]);
  }
  for (const [name, c] of edges) tests.push({ name, args: pyArgs(c), expect: pyOut(run(c)) });

  const n = level === 1 ? 50000 : 100000;
  tests.push({
    name: `${n.toLocaleString("en-US")} checkpoints across ${(n / 50).toLocaleString("en-US")} runs in time`,
    args: `_gen_checkpoints(${n / 50}, 50, ${r.int(1, 1_000_000)}, '${level === 1 ? "max" : "min"}')`,
    limit_s: 8,
  });

  return {
    vars: {
      retention_rule: level === 1
        ? "This replay covers a single run whose metric is higher-is-better, with no pins; the checks also cover several runs, a lower-is-better metric, ties, step 0 and pins."
        : level === 2
          ? "This replay covers several runs, a metric that can be lower-is-better, and pins; the checks also cover ties and step 0."
          : "This replay covers several runs, lower-is-better metrics, ties on the metric, step 0, and pins on checkpoints that were already deleted.",
    },
    samples,
    tests,
  };
}
