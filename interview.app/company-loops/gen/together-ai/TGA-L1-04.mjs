/* TGA-L1-04 — Ordering a customer's own fine-tuning queue (Python, Smith's ratio rule).
   Simulated practice scenario. All data is generated from the seed; job lengths,
   weights and ids are hypothetical.

   Contract (python): entry, signature, starter, prelude, generate(r, level) ->
     { vars, samples: [{args, expect}], tests: [{name, args, expect?, limit_s?}] }.
   expect comes from oracle() below, which does NOT sort by ratio: it tries every
   order (small inputs only), keeps the smallest total weighted completion time in
   exact BigInt arithmetic, and among equal totals the order whose job ids come first
   lexicographically. The evaluator's reference sorts by an exact ratio comparison, so
   each checks the other. Every sample is chosen so that shortest-job-first gives a
   worse total than the best order.
   level: 1 Medium (positive minutes and weights, ratio ties broken by job id)
          · 2 Hard (+ zero weights for best-effort jobs, an empty queue, invalid input
            -> None: minutes below 1, a negative weight, a repeated job id)
          · 3 Very Hard (+ a job already running that must stay first, an unknown running
            id -> None, and minutes and weights up to 10^9, where float ratios collide) */
export const kind = "python";
export const entry = "queue_order";
export const signature = "def queue_order(jobs: list[tuple[str, int, int]], running: str | None = None) -> tuple[list[str], int] | None:";
export const starter = `def queue_order(jobs, running=None):
    """jobs: (job_id, minutes, weight) for each job in one customer's queue.
    running: the id of a job already running (it stays first), or None.
    Return (order, total): the job ids in the order that minimises the total
    weighted completion time, ties between equal ratios by job id, and that total.
    Return None for invalid input."""
    ...
`;

export const prelude = `
def _gen_queue(n, seed, big=False, zero_share=0, pin=False):
    x = seed

    def nxt():
        nonlocal x
        x = (1103515245 * x + 12345) % 2147483648
        return x >> 8
    jobs = []
    for i in range(n):
        if big:
            minutes = 1 + nxt() * 997 % 1000000000
            weight = nxt() * 991 % 1000000001
        else:
            minutes = 5 + nxt() % 2880
            weight = nxt() % 21
        if zero_share and nxt() % 100 < zero_share:
            weight = 0
        jobs.append(("ft-%07d" % i, minutes, weight))
    for i in range(n - 1, 0, -1):
        j = nxt() % (i + 1)
        jobs[i], jobs[j] = jobs[j], jobs[i]
    running = jobs[nxt() % n][0] if pin else None
    return jobs, running
`.trim() + "\n";

// Independent oracle: every order (n <= 7), exact BigInt totals.
export function oracle(jobs, running) {
  const ids = new Set();
  for (const [id, m, w] of jobs) {
    if (m < 1 || w < 0 || ids.has(id)) return null;
    ids.add(id);
  }
  if (running !== null && !ids.has(running)) return null;
  const n = jobs.length;
  if (n > 8) throw new Error("TGA-L1-04 oracle: input too large");
  let best = null;
  const perm = [], used = Array(n).fill(false);
  const rec = () => {
    if (perm.length === n) {
      let clock = 0n, total = 0n;
      for (const k of perm) { clock += BigInt(jobs[k][1]); total += BigInt(jobs[k][2]) * clock; }
      const seq = perm.map((k) => jobs[k][0]);
      if (!best || total < best[1] || (total === best[1] && lexLess(seq, best[0]))) best = [seq, total];
      return;
    }
    for (let k = 0; k < n; k++) {
      if (used[k]) continue;
      if (perm.length === 0 && running !== null && jobs[k][0] !== running) continue;
      used[k] = true; perm.push(k); rec(); perm.pop(); used[k] = false;
    }
  };
  rec();
  return best || [[], 0n];
}
function lexLess(a, b) {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] < b[i];
  return false;
}
function sjfTotal(jobs, running) {                 // shortest job first, ties by id (the wrong greedy)
  const head = jobs.filter((j) => j[0] === running);
  const rest = jobs.filter((j) => j[0] !== running).sort((a, b) => a[1] - b[1] || (a[0] < b[0] ? -1 : 1));
  let clock = 0n, total = 0n;
  for (const j of head.concat(rest)) { clock += BigInt(j[1]); total += BigInt(j[2]) * clock; }
  return total;
}

const pyJobs = (jobs) => "[" + jobs.map(([id, m, w]) => `("${id}", ${m}, ${w})`).join(", ") + "]";
const pyArgs = (c) => `(${pyJobs(c.jobs)}, ${c.running === null ? "None" : `"${c.running}"`})`;
const pyOut = (x) => (x === null ? "None" : `([${x[0].map((s) => `"${s}"`).join(", ")}], ${x[1].toString()})`);
const run = (c) => oracle(c.jobs, c.running);

function ids(r, n) {
  const s = new Set();
  while (s.size < n) s.add("ft-" + String(r.int(1, 9999)).padStart(4, "0"));
  return [...s];
}

function randomCase(r, level, opts = {}) {
  for (let attempt = 0; attempt < 400; attempt++) {
    const n = r.int(5, level === 1 ? 6 : 7);
    const names = ids(r, n);
    const jobs = names.map((id) => {
      if (opts.big) return [id, r.int(1, 1000000000), r.int(1, 1000000000)];
      return [id, r.int(1, 48) * 15, r.int(1, 10)];
    });
    if (!opts.big && r.chance(0.6)) {                          // a ratio tie with another job
      const a = r.int(0, n - 1), b = (a + r.int(1, n - 1)) % n;
      const k = r.int(2, 3);
      jobs[b] = [jobs[b][0], jobs[a][1] * k, jobs[a][2] * k];
    }
    if (level >= 2 && !opts.big && r.chance(0.6)) jobs[r.int(0, n - 1)][2] = 0;   // a best-effort job
    const running = opts.pin ? r.pick(jobs)[0] : null;
    const c = { jobs, running };
    const out = run(c);
    if (!out) continue;
    if (sjfTotal(jobs, running) <= out[1]) continue;           // shortest-first must lose
    if (opts.pin && run({ jobs, running: null })[0][0] === running) continue;   // pinning must matter
    return c;
  }
  throw new Error("TGA-L1-04: could not build a sample");
}

export function generate(r, level) {
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const c = randomCase(r, level, { pin: level === 3 && i > 0, big: level === 3 && i === 2 });
    samples.push({ args: pyArgs(c), expect: pyOut(run(c)) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const [a, b, c, d, e] = ids(r, 5).sort();
  const m = r.int(2, 8) * 10;
  const edges = [
    ["shortest job first is not the best order", { jobs: [[a, m, 1], [b, 3 * m, 6]], running: null }],
    ["the heaviest job is not always first", { jobs: [[a, 10 * m, 5], [b, m, 2]], running: null }],
    ["equal ratios go by job id", { jobs: [[c, 3 * m, 3], [a, m, 1], [b, 2 * m, 2]], running: null }],
    ["one job", { jobs: [[d, m, 4]], running: null }],
    ["jobs given out of order", { jobs: [[e, 5 * m, 1], [d, m, 3], [c, 2 * m, 2], [b, 4 * m, 7], [a, m, 1]], running: null }],
  ];
  if (level >= 2) {
    edges.push(["an empty queue", { jobs: [], running: null }]);
    edges.push(["zero-weight jobs go last, by job id", { jobs: [[c, m, 0], [a, 3 * m, 0], [b, 9 * m, 1], [d, 2 * m, 2]], running: null }]);
    edges.push(["a job of zero minutes is invalid", { jobs: [[a, m, 2], [b, 0, 1]], running: null }]);
    edges.push(["a negative weight is invalid", { jobs: [[a, m, 2], [b, m, -1]], running: null }]);
    edges.push(["a repeated job id is invalid", { jobs: [[a, m, 2], [b, 2 * m, 1], [a, 3 * m, 4]], running: null }]);
  }
  if (level === 3) {
    edges.push(["the running job stays first", { jobs: [[a, 8 * m, 1], [b, m, 5], [c, 2 * m, 3]], running: a }]);
    edges.push(["an unknown running job is invalid", { jobs: [[a, m, 1], [b, 2 * m, 2]], running: e }]);
    edges.push(["a running job with zero weight", { jobs: [[c, m, 3], [b, 4 * m, 0], [a, 2 * m, 1]], running: b }]);
    edges.push(["ratios a float cannot tell apart", { jobs: [[a, 999999999, 1000000000], [b, 999999998, 999999999], [c, 1000000000, 999999999]], running: null }]);
    edges.push(["large weights and minutes", { jobs: [[a, 1000000000, 999999937], [b, 999999893, 1000000000], [c, 7, 1], [d, 1000000000, 1000000000]], running: c }]);
  }
  for (const [name, cs] of edges) tests.push({ name, args: pyArgs(cs), expect: pyOut(run(cs)) });

  // Timing: compared with the reference at check time. 60,000 jobs: one exact sort takes
  // about 0.4-0.5 s in CPython; any search over orders, or picking the best remaining job
  // 60,000 times (O(n^2), about 5 minutes), does not finish.
  const seed = r.int(1, 1_000_000);
  tests.push({
    name: "60,000 queued jobs in time",
    args: `_gen_queue(60000, ${seed}, ${level === 3 ? "True" : "False"}, ${level >= 2 ? 5 : 0}, ${level === 3 ? "True" : "False"})`,
    limit_s: 8,
  });

  return {
    vars: {
      weight_rule: level === 1
        ? "Every weight in this exercise is at least 1, and every job has at least 1 minute."
        : "A weight can be 0 for a best-effort job; such jobs go after every job with a positive weight, by job id. An empty queue returns an empty order and a total of 0. Return None if any job has fewer than 1 minute, a negative weight, or a job id that appears twice.",
      running_rule: level === 3
        ? "running is the id of a job that is already running: it cannot be preempted, so it stays first with the minutes it has left, and the rest follow in the best order. Return None if running names no job in the list. Minutes and weights can be as large as 1 000 000 000."
        : "running is always None at this level.",
    },
    samples,
    tests,
  };
}
