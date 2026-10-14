/* ANT-L2-01 — Deadline-first scheduling of batch jobs under per-model concurrency (Python).
   Simulated practice scenario. All data is generated from the seed.

   Contract (python): entry, signature, starter, prelude, generate(r, level) ->
     { vars, samples: [{args, expect}], tests: [{name, args, expect?, limit_s?}] }.
   expect comes from oracle() below: a literal event-by-event simulation that, at
   every event time, recounts the busy slots and scans every job for the earliest
   deadline. The evaluator's reference uses a heap of finish times and a heap of
   queued jobs per model, written independently; both were also checked against a
   third implementation on thousands of random cases.
   level: 1 Medium (one model, no cancellations)
          · 2 Hard (several models, tight deadlines, jobs with no requests)
          · 3 Very Hard (+ cancellations, including ones that race a start and ones
            that arrive after the deadline) */
export const kind = "python";
export const entry = "run_jobs";
export const signature = "def run_jobs(jobs: list[tuple[str, str, int, int, list[int]]], slots: dict[str, int], cancels: list[tuple[str, int]]) -> dict[str, tuple[int, int, int, int | None]]:";
export const starter = `def run_jobs(jobs, slots, cancels):
    """jobs: (job_id, model, submit_ts, deadline_ts, durations).
    slots: {model: requests that may run at once}.
    cancels: (job_id, cancel_ts).
    Return {job_id: (done, canceled, expired, last_finish or None)}."""
    ...
`;

export const prelude = `
def _gen_jobs(n_jobs, per_job, seed, n_models=3, with_cancels=True):
    x, jobs = seed, []
    def rnd(m):
        nonlocal x
        x = (1103515245 * x + 12345) % 2147483648
        return (x >> 16) % m
    models = ('claude-haiku', 'claude-sonnet', 'claude-opus')[:n_models]
    for k in range(n_jobs):
        sub = rnd(2000)                                  # a morning's submissions, long backlog
        jobs.append(('job_%d' % k, models[rnd(n_models)], sub, sub + 20000 + rnd(70000),
                     [1 + rnd(20) for _ in range(1 + rnd(2 * per_job))]))
    cancels = [('job_%d' % k, jobs[k][2] + rnd(5000)) for k in range(0, n_jobs, 17)] if with_cancels else []
    slots = {'claude-haiku': 24, 'claude-sonnet': 16, 'claude-opus': 10}
    if n_models == 1:
        slots = {'claude-haiku': 40}
    return jobs, slots, cancels
`.trim() + "\n";

// The specification, simulated literally. At each event time t: finished requests
// have freed their slots; cancels apply; then each model fills its free slots by
// scanning every job for the earliest (deadline, submit time, input position).
export function oracle(jobs, slots, cancels) {
  const cancelAt = new Map(cancels);
  const st = jobs.map(([id, model, sub, dl, durs], idx) => ({ id, model, sub, dl, durs, idx, next: 0, done: 0, canceled: 0, expired: 0, last: null }));
  const running = [];
  const times = new Set();
  for (const s of st) {
    times.add(s.sub);
    if (cancelAt.has(s.id)) times.add(cancelAt.get(s.id));
  }
  let prev = -Infinity;
  for (;;) {
    let t = Infinity;
    for (const x of times) if (x > prev && x < t) t = x;
    if (t === Infinity) break;
    prev = t;
    for (const s of st) {
      if (cancelAt.get(s.id) === t && t < s.dl && s.next < s.durs.length) {
        s.canceled += s.durs.length - s.next;
        s.next = s.durs.length;
      }
    }
    for (const model of Object.keys(slots)) {
      let busy = running.filter((x) => x.model === model && x.end > t).length;
      while (busy < slots[model]) {
        let best = null;
        for (const s of st) {
          if (s.model !== model || s.sub > t || s.next >= s.durs.length) continue;
          if (t >= s.dl) { s.expired += s.durs.length - s.next; s.next = s.durs.length; continue; }
          if (!best || s.dl < best.dl || (s.dl === best.dl && (s.sub < best.sub || (s.sub === best.sub && s.idx < best.idx)))) best = s;
        }
        if (!best) break;
        const end = t + best.durs[best.next++];
        running.push({ model, end });
        times.add(end);
        best.done++;
        best.last = best.last === null ? end : Math.max(best.last, end);
        busy++;
      }
    }
  }
  const out = new Map();
  for (const s of st) out.set(s.id, [s.done, s.canceled, s.expired + (s.durs.length - s.next), s.last]);
  return out;
}

const pyOut = (m) => "{" + [...m.entries()].map(([id, [a, b, c, d]]) => `'${id}': (${a}, ${b}, ${c}, ${d === null ? "None" : d})`).join(", ") + "}";
const pyArgs = (jobs, slots, cancels) =>
  `([${jobs.map(([id, m, s, d, durs]) => `('${id}', '${m}', ${s}, ${d}, [${durs.join(", ")}])`).join(", ")}], ` +
  `{${Object.entries(slots).map(([m, n]) => `'${m}': ${n}`).join(", ")}}, ` +
  `[${cancels.map(([id, t]) => `('${id}', ${t})`).join(", ")}])`;

const MODELS = ["claude-haiku", "claude-sonnet", "claude-opus"];
const HEX = "0123456789abcdef".split("");
const jid = (r) => "job_" + Array.from({ length: 5 }, () => r.pick(HEX)).join("");

function randomCase(r, level) {
  for (let attempt = 0; attempt < 80; attempt++) {
    const models = level === 1 ? [r.pick(MODELS)] : r.sample(MODELS, r.int(2, 3));
    const slots = {};
    for (const m of models) slots[m] = r.int(1, level === 1 ? 3 : 2);
    const n = level === 1 ? r.int(3, 5) : level === 2 ? r.int(5, 7) : r.int(6, 8);
    const jobs = [];
    for (let k = 0; k < n; k++) {
      const sub = r.int(0, 60);
      const items = level === 2 && r.chance(0.1) ? 0 : r.int(1, level === 1 ? 4 : 5);
      const slack = level === 1 ? r.int(30, 150) : r.int(-5, 90);
      jobs.push([jid(r), r.pick(models), sub, sub + slack, Array.from({ length: items }, () => r.int(1, 25))]);
    }
    const cancels = [];
    if (level === 3) for (const j of jobs) if (r.chance(0.3)) cancels.push([j[0], j[2] + r.int(0, 60)]);
    const got = oracle(jobs, slots, cancels);
    const done = [...got.values()].reduce((s, v) => s + v[0], 0);
    const lost = [...got.values()].reduce((s, v) => s + v[1] + v[2], 0);
    if (done > 0 && (level === 1 || lost > 0)) return { jobs, slots, cancels, got };
  }
  throw new Error("ANT-L2-01: could not build a sample");
}

export function generate(r, level) {
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const c = randomCase(r, level);
    samples.push({ args: pyArgs(c.jobs, c.slots, c.cancels), expect: pyOut(c.got) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const [M, M2] = r.sample(MODELS, 2);
  const [A, B, C] = [jid(r), jid(r), jid(r)];
  const d = r.int(4, 9);                     // a request duration used by several tests
  const one = { [M]: 1 };
  const edges = [
    ["a slot freed at second t starts the next request at t", [[A, M, 0, 100, [d, d, d]]], one, []],
    ["the earliest deadline runs first, not the earliest submission",
      [[A, M, 0, 1000, [10, 10]], [B, M, 5, 30, [10, 10]]], one, []],
    ["a request started before the deadline finishes after it; none starts at the deadline",
      [[A, M, 0, 15, [20]], [B, M, 0, 20, [5]]], one, []],
    ["one second before the deadline is still in time",
      [[A, M, 0, 15, [20]], [B, M, 0, 21, [5]]], one, []],
    ["equal deadlines: earlier submission first, then input order",
      [[A, M, 3, 50, [d]], [C, M, 0, 50, [d]], [B, M, 0, 50, [d]]], one, []],
    ["a deadline at the submission time expires every request", [[A, M, 10, 10, [3, 3]]], one, []],
  ];
  if (level >= 2) {
    edges.push(["models never share slots", [[A, M, 0, 100, [10]], [B, M2, 0, 100, [10]]], { [M]: 1, [M2]: 1 }, []]);
    edges.push(["a job with no requests", [[A, M, 0, 100, []], [B, M, 0, 100, [d]]], one, []]);
    edges.push(["a busy model makes a later deadline expire while the other model is idle",
      [[A, M, 0, 40, [30, 30]], [B, M, 0, 50, [5]], [C, M2, 0, 50, [5]]], { [M]: 1, [M2]: 1 }, []]);
  }
  if (level === 3) {
    edges.push(["a cancel at second t wins over a start at t", [[A, M, 0, 100, [5, 5, 5]]], one, [[A, 5]]]);
    edges.push(["a cancel after the deadline does not turn expired into canceled", [[A, M, 0, 6, [5, 5, 5]]], one, [[A, 8]]]);
    edges.push(["requests already running are not canceled", [[A, M, 0, 100, [5, 5]]], { [M]: 2 }, [[A, 1]]]);
    edges.push(["a canceled job frees the queue for the next one", [[A, M, 0, 100, [5, 5, 5]], [B, M, 0, 200, [5]]], one, [[A, 3]]]);
  }
  for (const [name, jobs, slots, cancels] of edges) tests.push({ name, args: pyArgs(jobs, slots, cancels), expect: pyOut(oracle(jobs, slots, cancels)) });

  // Timing: 8 000 jobs (about 200 000 requests) submitted within a morning, so thousands
  // of jobs wait at once. Heaps make each start O(log n); scanning the waiting jobs
  // for the earliest deadline at every start is O(requests × waiting jobs).
  const nModels = level === 1 ? 1 : 3;
  tests.push({
    name: "8,000 jobs, about 200,000 requests, thousands waiting at once (heaps, not scans)",
    args: `_gen_jobs(8000, 25, ${r.int(1, 1_000_000)}, ${nModels}, ${level === 3 ? "True" : "False"})`,
    limit_s: 8,
  });

  return {
    vars: {
      model_rule: level === 1
        ? "In this replay every job uses one model, but `slots` is a dict so the code must work for several."
        : "Each model has its own slots; a model that is busy never borrows another model's free slots.",
      cancel_rule: level === 3
        ? "Owners can cancel a job: `cancels` lists `(job_id, cancel_ts)`, at most one per job, never before the job's submission."
        : "In this replay `cancels` is always empty, but keep the parameter.",
    },
    samples,
    tests,
  };
}
