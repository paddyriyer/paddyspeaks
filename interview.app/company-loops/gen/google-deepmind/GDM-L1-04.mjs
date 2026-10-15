/* GDM-L1-04 — Pareto front of runs: cheapest for their score (Python).
   Simulated practice scenario. All data is generated from the seed; run ids,
   accelerator-hours and scores are synthetic and describe no real experiment.

   Contract (python): entry, signature, starter, prelude, generate(r, level) ->
     { vars, samples: [{args, expect}], tests: [{name, args, expect?, limit_s?}] }.
   expect comes from oracle() below, which compares every pair of runs (O(n^2), small
   inputs only). The evaluator's reference sorts once and keeps a running best, so
   each checks the other.
   level: 1 Medium (every run scored, ids unique) · 2 Hard (+ runs not yet evaluated
          (score None), equal pairs, zero hours, and a record with negative hours ->
          None) · 3 Very Hard (+ a run logged more than once: its last record wins,
          including a last record with no score) */
export const kind = "python";
export const entry = "pareto_front";
export const signature = "def pareto_front(runs: list[tuple[str, int, int | None]]) -> list[str] | None:";
export const starter = `def pareto_front(runs):
    """runs: (run_id, accelerator_hours, score) records, in any order.
    Lower accelerator_hours is better; higher score is better.
    Return the ids of the runs no other run beats, ordered by
    accelerator_hours, then run_id."""
    ...
`;

export const prelude = `
def _gen_runs(n, seed, level=1):
    x = seed

    def nxt():
        nonlocal x
        x = (1103515245 * x + 12345) % 2147483648
        return x >> 8
    runs = []
    for i in range(n):
        hours = 1 + nxt() % (n * 4)
        score = hours * 3 + nxt() % 7
        if level >= 2 and nxt() % 50 == 0:
            score = None
        runs.append(("run-%06d" % i, hours, score))
    if level == 3:
        for _ in range(n // 10):
            i = nxt() % n
            rid, h, s = runs[i]
            runs.append((rid, h, None if s is None else s + nxt() % 5 - 2))
    return (runs,)
`.trim() + "\n";

// Independent oracle (small inputs): last record per id, then every pair.
export function oracle(runs) {
  if (runs.some(([, h]) => h < 0)) return null;
  const last = new Map();
  for (const [id, h, s] of runs) last.set(id, [h, s]);
  const live = [...last.entries()].filter(([, [, s]]) => s !== null).map(([id, [h, s]]) => ({ id, h, s }));
  const front = live.filter((a) => !live.some((b) => b.h <= a.h && b.s >= a.s && (b.h < a.h || b.s > a.s)));
  front.sort((a, b) => a.h - b.h || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return front.map((x) => x.id);
}

const py = (v) => (v === null ? "None" : typeof v === "string" ? `'${v}'` : String(v));
const pyArgs = (runs) => "([" + runs.map(([id, h, s]) => `(${py(id)}, ${h}, ${py(s)})`).join(", ") + "],)";
const pyOut = (x) => (x === null ? "None" : "[" + x.map((s) => `'${s}'`).join(", ") + "]");

function randomCase(r, level) {
  for (let attempt = 0; attempt < 200; attempt++) {
    const n = r.int(8, level === 1 ? 11 : 14);
    const ids = r.sample(Array.from({ length: 60 }, (_, i) => "run-" + String(100 + i * 7)), n);
    const runs = ids.map((id) => {
      const h = r.int(level >= 2 ? 0 : 1, 40) * 8;
      const s = 5000 + Math.floor(h * 10) + r.int(-300, 300);
      return [id, h, level >= 2 && r.chance(0.12) ? null : Math.round(s / 50) * 50];
    });
    if (level >= 2) {
      const [, h0, s0] = r.pick(runs.filter((x) => x[2] !== null));
      runs.push(["run-" + String(600 + r.int(0, 99)), h0, s0]);    // an equal pair
    }
    if (level === 3) {
      for (let k = 0; k < 2; k++) {
        const [id, h, s] = r.pick(runs);
        runs.push([id, h, s === null ? r.int(50, 150) * 50 : r.chance(0.3) ? null : s + r.pick([-1, 1]) * r.int(1, 8) * 50]);
      }
    }
    const shuffled = r.shuffle(runs);
    const out = oracle(shuffled);
    if (out && out.length >= 2 && out.length < shuffled.length - 1) return shuffled;
  }
  throw new Error("GDM-L1-04: could not build a sample");
}

export function generate(r, level) {
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const runs = randomCase(r, level);
    samples.push({ args: pyArgs(runs), expect: pyOut(oracle(runs)) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const h = r.int(10, 60) * 4, s = r.int(60, 90) * 100;
  const id = (k) => "run-" + String(300 + k * 11);
  const edges = [
    ["no runs", []],
    ["one run is its own front", [[id(1), h, s]]],
    ["same hours, the higher score wins", [[id(1), h, s], [id(2), h, s + 50]]],
    ["same score, the fewer hours win", [[id(1), h + 8, s], [id(2), h, s]]],
    ["a staircase: every run is on the front", [[id(3), h + 40, s + 300], [id(1), h, s], [id(2), h + 20, s + 100]]],
    ["one run beats all the others", [[id(1), h + 10, s - 10], [id(2), h, s], [id(3), h + 30, s - 400], [id(4), h + 1, s]]],
    ["more hours for the same score is beaten", [[id(1), h, s], [id(2), h + 1, s], [id(3), h + 2, s + 1]]],
    ["order by hours, not by score or id", [[id(9), h, s], [id(1), h + 50, s + 500], [id(5), h + 20, s + 200]]],
  ];
  if (level >= 2) {
    edges.push(["equal pairs are both kept, in id order", [[id(7), h, s], [id(2), h, s], [id(4), h + 9, s + 9], [id(5), h + 9, s + 9]]]);
    edges.push(["a run with no score is not on the front", [[id(1), h, null], [id(2), h + 50, s]]]);
    edges.push(["no run has a score", [[id(1), h, null], [id(2), h + 5, null]]]);
    edges.push(["zero hours is allowed", [[id(1), 0, s - 500], [id(2), h, s]]]);
    edges.push(["negative hours: the input is invalid", [[id(1), h, s], [id(2), -1, s]]]);
  }
  if (level === 3) {
    edges.push(["a run logged twice: the later record wins (better)", [[id(1), h, s], [id(2), h + 10, s + 20], [id(1), h, s + 100]]]);
    edges.push(["a run logged twice: the later record wins (worse)", [[id(1), h, s + 100], [id(2), h + 10, s + 20], [id(1), h, s - 100]]]);
    edges.push(["a run whose last record has no score drops out", [[id(1), h, s + 100], [id(2), h + 10, s + 20], [id(1), h, null]]]);
    edges.push(["a run whose last record has a score comes back", [[id(1), h, null], [id(2), h + 10, s + 20], [id(1), h, s + 100]]]);
    edges.push(["a re-logged run that now equals another run", [[id(1), h, s], [id(2), h, s + 30], [id(2), h, s]]]);
  }
  for (const [name, runs] of edges) tests.push({ name, args: pyArgs(runs), expect: pyOut(oracle(runs)) });

  // Timing: compared with the reference at check time. 80,000 runs with about 85% of
  // them on the front: comparing every pair is 6.4 x 10^9 checks, and keeping the front
  // as a list and checking each run against all of it is still about 3 x 10^9 (10,000
  // runs took 7.6 s in CPython when timed for this template). One sort is about 0.2 s.
  const seed = r.int(1, 1_000_000);
  tests.push({ name: "80,000 runs with a large front in time", args: `_gen_runs(80000, ${seed}, ${level})`, limit_s: 8 });

  return {
    vars: {
      score_rule: level === 1
        ? "Every run has a score, and every run_id appears once."
        : "A run that has not been evaluated yet has score None: it is not on the front and beats nothing. accelerator_hours can be 0. If any record has negative accelerator_hours, the input is invalid: return None.",
      relog_rule: level === 3
        ? "A run can be logged more than once (it was re-evaluated): only its last record in the list counts, even when that record has no score."
        : "Each run_id appears once.",
    },
    samples,
    tests,
  };
}
