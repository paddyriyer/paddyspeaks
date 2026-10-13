/* OAI-L1-04 — Sliding-window token rate limiter (Python).
   Simulated practice scenario. All data is generated from the seed.

   Contract (python):
     entry, signature, starter          the function the candidate writes
     prelude                            Python helpers available to test expressions
     generate(r, level) -> {
       vars,
       samples: [{args, expect}],       shown to the candidate; expect from oracle() below
       tests:   [{name, args, expect?, limit_s?}]   run by "Run & check"; a test with no
                                        expect is compared against the evaluator's
                                        reference implementation at check time
     }
   args is a Python expression for the argument tuple. CI proves the reference
   implementation agrees with oracle() on every sample and every test that has an expect. */
export const kind = "python";
export const entry = "admit";
export const signature = "def admit(requests: list[tuple[int, str, int]], tpm: dict[str, int], rpm: int | None = None) -> list[bool]:";
export const starter = `from collections import deque, defaultdict

def admit(requests, tpm, rpm=None):
    """requests: (ts_ms, project_id, tokens), sorted by ts_ms.
    Return one bool per request: True if admitted."""
    ...
`;

export const prelude = `
def _gen_requests(n, projects, seed, step_max=6, tok_max=4000):
    x, ts, out = seed, 0, []
    for _ in range(n):
        x = (1103515245 * x + 12345) % 2147483648
        ts += (x >> 16) % (step_max + 1)
        x = (1103515245 * x + 12345) % 2147483648
        p = projects[(x >> 16) % len(projects)]
        x = (1103515245 * x + 12345) % 2147483648
        out.append((ts, p, 1 + (x >> 16) % tok_max))
    return out
`.trim() + "\n";

const WINDOW = 60000;

// Brute force: rescans every admitted request. Correct and slow; used only for small inputs.
export function oracle(requests, tpm, rpm) {
  const admitted = [];
  const out = [];
  for (const [t, p, tok] of requests) {
    if (!(p in tpm)) { out.push(false); continue; }
    let sum = 0, cnt = 0;
    for (const [t2, p2, k2] of admitted) if (p2 === p && t2 > t - WINDOW && t2 <= t) { sum += k2; cnt += 1; }
    const ok = sum + tok <= tpm[p] && (rpm == null || cnt + 1 <= rpm);
    out.push(ok);
    if (ok) admitted.push([t, p, tok]);
  }
  return out;
}

const pyBool = (b) => (b ? "True" : "False");
const pyList = (xs) => "[" + xs.map(pyBool).join(", ") + "]";
function pyArgs(reqs, tpm, rpm) {
  const rq = "[" + reqs.map(([t, p, k]) => `(${t}, '${p}', ${k})`).join(", ") + "]";
  const lim = "{" + Object.entries(tpm).map(([p, v]) => `'${p}': ${v}`).join(", ") + "}";
  return `(${rq}, ${lim}, ${rpm == null ? "None" : rpm})`;
}

function smallCase(r, level, n) {
  const projects = level === 1 ? ["proj_a"] : ["proj_a", "proj_b", "proj_c"].slice(0, 2 + (level === 3 ? 1 : 0));
  const tpm = {};
  for (const p of projects) tpm[p] = r.pick([1000, 2500, 4000, 6000]);
  const rpm = level === 3 ? r.int(2, 4) : null;
  const reqs = [];
  let t = r.int(0, 5000);
  for (let i = 0; i < n; i++) {
    t += r.pick([0, 0, 1000, 5000, 20000, 59999, 60000, 61000]);
    const p = level === 3 && r.chance(0.15) ? "proj_unknown" : r.pick(projects);
    reqs.push([t, p, r.int(100, 2500)]);
  }
  return { reqs, tpm, rpm };
}

export function generate(r, level) {
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const { reqs, tpm, rpm } = smallCase(r, level, 5 + i);
    samples.push({ args: pyArgs(reqs, tpm, rpm), expect: pyList(oracle(reqs, tpm, rpm)) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  // Edge cases with exact boundaries.
  const lim = r.pick([1000, 3000]);
  const edges = [
    ["exactly 60 000 ms later, the first request has left the window", [[0, "p", lim], [60000, "p", lim]], { p: lim }, null],
    ["59 999 ms later it is still inside", [[0, "p", lim], [59999, "p", 1]], { p: lim }, null],
    ["a rejected request consumes nothing", [[0, "p", lim - 10], [1, "p", 50], [2, "p", 10]], { p: lim }, null],
    ["a single request larger than the limit is rejected", [[5, "p", lim + 1]], { p: lim }, null],
    ["same timestamp, several requests", [[7, "p", 1], [7, "p", 1], [7, "p", lim]], { p: lim }, null],
  ];
  if (level === 3) edges.push(["the request cap binds before the token cap", [[0, "p", 1], [1, "p", 1], [2, "p", 1]], { p: lim }, 2]);
  if (level >= 2) edges.push(["a project with no limit is rejected", [[0, "x", 1]], { p: lim }, null]);
  for (const [name, reqs, tpm, rpm] of edges) tests.push({ name, args: pyArgs(reqs, tpm, rpm), expect: pyList(oracle(reqs, tpm, rpm)) });

  // Timing: about 12 000 requests per minute across projects; an answer that rescans
  // the window for each request is far too slow. Compared with the reference at check time.
  const seed = r.int(1, 1_000_000);
  const n = level === 1 ? 120000 : 200000;
  const projs = level === 1 ? "['proj_a']" : "['proj_a', 'proj_b', 'proj_c', 'proj_d']";
  const limits = level === 1 ? "{'proj_a': 4000000}" : "{'proj_a': 2000000, 'proj_b': 900000, 'proj_c': 3500000, 'proj_d': 50000}";
  tests.push({ name: `${n.toLocaleString("en-US")} requests in time (amortised O(1) per request)`, args: `(_gen_requests(${n}, ${projs}, ${seed}), ${limits}, ${level === 3 ? 900 : "None"})`, limit_s: 8 });

  return {
    vars: {
      limit_rule: level === 1 ? "One project, one tokens-per-minute (TPM) limit." : "Each project has its own TPM limit; a project with no configured limit is rejected.",
      rpm_rule: level === 3 ? "Each project is also capped at `rpm` admitted requests in the same window. Both limits must hold." : "There is no request-count limit (`rpm` is None).",
    },
    samples,
    tests,
  };
}
