/* GDM-L2-02 — Ablation pairs in a hyperparameter sweep (Python, masked signatures).
   Simulated practice scenario. All data is generated from the seed; every run,
   configuration and value is synthetic.

   Contract (python): entry, signature, starter, prelude, generate(r, level) ->
     { vars, samples: [{args, expect}], tests: [{name, args, expect?, limit_s?}] }.
   expect comes from oracle() below, which compares every pair of runs key by key
   (small inputs only). The evaluator's reference groups runs by one masked
   signature per key, so each checks the other.
   level: 1 Medium (every run sets every hyperparameter; nothing ignored)
          2 Hard (+ keys that are not hyperparameters, such as the seed, are ignored)
          3 Very Hard (+ runs omit keys, which then take the sweep's default) */
export const kind = "python";
export const entry = "ablation_pairs";
export const signature = "def ablation_pairs(runs: list[tuple[str, dict]], ignore: tuple = (), defaults: dict | None = None) -> list[tuple[str, str, str]]:";
export const starter = `def ablation_pairs(runs, ignore=(), defaults=None):
    """runs: (run_id, config) per run in the sweep; config maps a key to a value.
    ignore: keys that are not hyperparameters and are never compared.
    defaults: the value of any key a run's config omits (None: every run sets every key).
    Return (run_a, run_b, key) for every pair of runs whose configs differ in
    exactly one compared key, with run_a < run_b, sorted."""
    ...
`;

export const prelude = `
_HP = {
    'learning_rate': [0.0001, 0.0003, 0.001, 0.003],
    'batch_size': [64, 128, 256, 512],
    'warmup_steps': [0, 500, 1000, 2000],
    'weight_decay': [0.0, 0.01, 0.05, 0.1],
    'dropout': [0.0, 0.1, 0.2, 0.3],
    'optimizer': ['adamw', 'adam', 'sgd', 'adafactor'],
    'schedule': ['cosine', 'linear', 'constant', 'rsqrt'],
    'layers': [12, 24, 32, 48],
    'width': [512, 768, 1024, 2048],
    'label_smoothing': [0.0, 0.05, 0.1, 0.2],
}


def _gen_sweep(n, seed, ignored=False, sparse=False):
    x = seed

    def nxt():
        nonlocal x
        x = (1103515245 * x + 12345) % 2147483648
        return x >> 16
    keys = sorted(_HP)
    n_orig = n - n // 4
    picks = []
    for i in range(n):
        if i >= n_orig:                                    # a one-change variant of an original
            p = list(picks[nxt() % n_orig])
            k = nxt() % len(keys)
            p[k] = (p[k] + 1 + nxt() % 3) % 4
        else:
            p = [nxt() % 4 for _ in keys]
        picks.append(p)
    runs = []
    for i, p in enumerate(picks):
        cfg = {}
        for k, j in zip(keys, p):
            if sparse and j == 0 and nxt() % 2 == 0:
                continue                                   # omitted: takes the default
            cfg[k] = _HP[k][j]
        if ignored:
            cfg['seed'] = nxt() % 30000
        runs.append(('run-%06d' % i, cfg))
    defaults = {k: _HP[k][0] for k in keys} if sparse else None
    return runs, (('seed',) if ignored else ()), defaults
`.trim() + "\n";

// Values are kept as their Python literals, one literal per value, so equality is string equality.
const HP = {
  learning_rate: ["0.0001", "0.0003", "0.001", "0.003"],
  batch_size: ["64", "128", "256", "512"],
  warmup_steps: ["0", "500", "1000", "2000"],
  weight_decay: ["0.0", "0.01", "0.05", "0.1"],
  dropout: ["0.0", "0.1", "0.2", "0.3"],
  optimizer: ["'adamw'", "'adam'", "'sgd'", "'adafactor'"],
  schedule: ["'cosine'", "'linear'", "'constant'", "'rsqrt'"],
  layers: ["12", "24", "32", "48"],
  width: ["512", "768", "1024", "2048"],
  label_smoothing: ["0.0", "0.05", "0.1", "0.2"],
  use_bias: ["True", "False"],
  data_mix: ["'web-v3'", "'web-v4'", "'code-v2'"],
};

// Every pair of runs, compared key by key over every key any run or the defaults name.
export function oracle(runs, ignore, defaults) {
  const keys = new Set(Object.keys(defaults || {}));
  for (const [, cfg] of runs) for (const k of Object.keys(cfg)) keys.add(k);
  const compared = [...keys].filter((k) => !ignore.includes(k));
  const eff = runs.map(([id, cfg]) => [id, compared.map((k) => (k in cfg ? cfg[k] : (defaults || {})[k]))]);
  const out = [];
  for (let i = 0; i < eff.length; i++) {
    for (let j = i + 1; j < eff.length; j++) {
      const diff = [];
      for (let t = 0; t < compared.length; t++) if (eff[i][1][t] !== eff[j][1][t]) diff.push(compared[t]);
      if (diff.length !== 1) continue;
      const [a, b] = eff[i][0] < eff[j][0] ? [eff[i][0], eff[j][0]] : [eff[j][0], eff[i][0]];
      out.push([a, b, diff[0]]);
    }
  }
  const cmp = (x, y) => (x < y ? -1 : x > y ? 1 : 0);
  out.sort((p, q) => cmp(p[0], q[0]) || cmp(p[1], q[1]) || cmp(p[2], q[2]));
  return out;
}

const pyCfg = (cfg) => "{" + Object.entries(cfg).map(([k, v]) => `'${k}': ${v}`).join(", ") + "}";
const pyArgs = (c) => {
  const runs = "[" + c.runs.map(([id, cfg]) => `('${id}', ${pyCfg(cfg)})`).join(", ") + "]";
  const ign = c.ignore.length ? "(" + c.ignore.map((k) => `'${k}'`).join(", ") + ",)" : "()";
  return `(${runs}, ${ign}, ${c.defaults ? pyCfg(c.defaults) : "None"})`;
};
const pyOut = (xs) => "[" + xs.map(([a, b, k]) => `('${a}', '${b}', '${k}')`).join(", ") + "]";
const run = (c) => oracle(c.runs, c.ignore, c.defaults);

const ALL_KEYS = Object.keys(HP);

// A small sweep: a few base configs, each with one-change variants and the odd repeat.
function randomCase(r, level) {
  for (let attempt = 0; attempt < 200; attempt++) {
    const keys = r.sample(ALL_KEYS, r.int(4, 6));
    const values = Object.fromEntries(keys.map((k) => [k, HP[k].slice(0, Math.min(HP[k].length, 3))]));
    const bases = Array.from({ length: r.int(2, 3) }, () => Object.fromEntries(keys.map((k) => [k, r.pick(values[k])])));
    const effs = [];
    for (const b of bases) {
      effs.push({ ...b });
      for (let v = 0; v < r.int(1, 3); v++) {
        const e = { ...b };
        const k = r.pick(keys);
        e[k] = r.pick(values[k]);                          // may equal the base: a repeat
        if (r.chance(0.25)) { const k2 = r.pick(keys); e[k2] = r.pick(values[k2]); }
        effs.push(e);
      }
    }
    const order = r.shuffle(effs);
    const first = r.int(1, 900);
    const ids = order.map((_, i) => "run-" + String(first + 3 * i + r.int(0, 2)).padStart(4, "0"));
    const ignore = level >= 2 ? ["seed"] : [];
    const defaults = level === 3 ? Object.fromEntries(keys.map((k) => [k, values[k][0]])) : null;
    const runs = order.map((e, i) => {
      const cfg = {};
      for (const k of keys) {
        if (defaults && e[k] === defaults[k] && r.chance(0.5)) continue;
        cfg[k] = e[k];
      }
      if (level >= 2) cfg.seed = String(r.int(1, 99999));
      return [ids[i], cfg];
    });
    const c = { runs: r.shuffle(runs), ignore, defaults };
    const n = runs.length;
    const got = run(c);
    if (got.length >= 2 && got.length < (n * (n - 1)) / 2 - 3) return c;
  }
  throw new Error("GDM-L2-02: could not build a sample with pairs and non-pairs");
}

export function generate(r, level) {
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const c = randomCase(r, level);
    samples.push({ args: pyArgs(c), expect: pyOut(run(c)) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const [k1, k2, k3, k4] = r.sample(["learning_rate", "batch_size", "warmup_steps", "weight_decay", "layers", "width"], 4);
  const base = { [k1]: HP[k1][1], [k2]: HP[k2][1], [k3]: HP[k3][1], [k4]: HP[k4][1], optimizer: HP.optimizer[0] };
  const with_ = (o) => ({ ...base, ...o });
  const id = (n) => "run-" + String(n).padStart(4, "0");
  const plain = (runs) => ({ runs, ignore: [], defaults: null });
  const edges = [
    ["one key apart is a pair; two keys apart is not",
      plain([[id(1), base], [id(2), with_({ [k1]: HP[k1][2] })], [id(3), with_({ [k1]: HP[k1][2], [k2]: HP[k2][3] })]])],
    ["identical configs are never a pair, but each pairs with a one-change variant",
      plain([[id(4), base], [id(5), { ...base }], [id(6), with_({ [k3]: HP[k3][0] })]])],
    ["three values of one key give three pairs",
      plain([[id(7), with_({ [k2]: HP[k2][0] })], [id(8), with_({ [k2]: HP[k2][2] })], [id(9), with_({ [k2]: HP[k2][3] })]])],
    ["each pair is ordered by run id and the list is sorted, whatever the input order",
      plain([[id(40), with_({ [k4]: HP[k4][3] })], [id(12), base], [id(31), with_({ optimizer: HP.optimizer[2] })], [id(5), with_({ [k1]: HP[k1][0] })]])],
    ["a string value and a boolean value are compared like any other",
      plain([[id(1), with_({ use_bias: "True" })], [id(2), with_({ use_bias: "False" })], [id(3), with_({ use_bias: "True", optimizer: HP.optimizer[1] })]])],
    ["a single run has no pairs",
      plain([[id(1), base]])],
  ];
  if (level >= 2) {
    edges.push(["runs that differ only in an ignored key are identical",
      { runs: [[id(1), with_({ seed: "11" })], [id(2), with_({ seed: "12" })], [id(3), with_({ seed: "13", [k1]: HP[k1][3] })]], ignore: ["seed"], defaults: null }]);
    edges.push(["several ignored keys, and a pair that also differs in one of them",
      { runs: [[id(1), with_({ seed: "7", run_name: "'base'" })], [id(2), with_({ seed: "7", run_name: "'wd'", [k3]: HP[k3][2] })], [id(3), with_({ seed: "8", run_name: "'base'", [k3]: HP[k3][2], [k4]: HP[k4][0] })]], ignore: ["seed", "run_name"], defaults: null }]);
  }
  if (level === 3) {
    const d = { [k1]: HP[k1][1], [k2]: HP[k2][1], dropout: "0.1", optimizer: HP.optimizer[0] };
    edges.push(["an omitted key equals an explicit default value",
      { runs: [[id(1), { [k1]: HP[k1][1] }], [id(2), { [k1]: HP[k1][1], [k2]: HP[k2][1] }], [id(3), { [k2]: HP[k2][2] }], [id(4), { [k1]: HP[k1][3], optimizer: HP.optimizer[0] }]], ignore: [], defaults: d }]);
    edges.push(["an explicit 0.0 is a value, not a missing key",
      { runs: [[id(1), { dropout: "0.0" }], [id(2), {}], [id(3), { dropout: "0.1", [k1]: HP[k1][0] }], [id(4), { dropout: "0.0", [k1]: HP[k1][0] }]], ignore: ["seed"], defaults: d }]);
  }
  for (const [name, c] of edges) tests.push({ name, args: pyArgs(c), expect: pyOut(run(c)) });

  // Timing: compared with the reference at check time. 24 000 runs, ten hyperparameters
  // with four values each: bucketing by any one key leaves about 6 000 runs per bucket,
  // while each masked signature holds only a few runs.
  tests.push({
    name: "a sweep of 24,000 runs in time",
    args: `_gen_sweep(24000, ${r.int(1, 1_000_000)}, ${level >= 2 ? "True" : "False"}, ${level === 3 ? "True" : "False"})`,
    limit_s: 8,
  });

  return {
    vars: {
      sweep: r.pick(["a language-model pre-training sweep", "a sweep over a small vision model", "a reinforcement-learning agent sweep", "a protein-structure model sweep", "a speech model sweep"]),
      level_rule: level === 1
        ? "In this exercise every run sets every key, every key is a hyperparameter (the ignore argument is empty), and the defaults argument is None."
        : level === 2
          ? "Some keys are not hyperparameters, such as the seed: keys in the ignore argument are never compared, so two runs that differ only in their seed have identical configs. Every run sets every other key, and the defaults argument is None."
          : "Keys in the ignore argument are never compared, and runs only record what they changed: a key a run's config omits takes its value from the defaults argument, which names every compared key. An explicit value equal to the default is the same as omitting it, and a falsy value such as 0.0 is still a value.",
    },
    samples,
    tests,
  };
}
