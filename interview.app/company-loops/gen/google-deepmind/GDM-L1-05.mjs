/* GDM-L1-05 — Dividing a compute budget by max-min fairness (Python).
   Simulated practice scenario. All data is generated from the seed; projects,
   requests and budgets are synthetic and describe no real allocation. The tie rule
   is this exercise's rule.

   Contract (python): entry, signature, starter, prelude, generate(r, level) ->
     { vars, samples: [{args, expect}], tests: [{name, args, expect?, limit_s?}] }.
   expect comes from oracle() below, which hands out the budget one hour at a time to
   the project with the smallest allocation still below its request (small budgets
   only). The evaluator's reference sorts by request and computes the water level, so
   each checks the other.
   level: 1 Medium (unique projects, the spare hours by project id) · 2 Hard (+ the
          spare hours to smaller requests first when prefer is "smaller", requests of
          0, budgets of 0 or above the total, and a negative request or budget -> None)
          · 3 Very Hard (+ a project listed more than once: its requests are added
          together and it appears once, at its first position) */
export const kind = "python";
export const entry = "allocate_hours";
export const signature = 'def allocate_hours(requests: list[tuple[str, int]], budget: int, prefer: str = "id") -> list[tuple[str, int]] | None:';
export const starter = `def allocate_hours(requests, budget, prefer="id"):
    """requests: (project_id, hours_requested) in submission order.
    budget: whole accelerator-hours to share.
    Return (project_id, hours_allocated) for every project, in input order,
    shared by max-min fairness; see the problem for the spare-hour rule."""
    ...
`;

export const prelude = `
def _gen_requests(n, seed, level=1):
    x = seed

    def nxt():
        nonlocal x
        x = (1103515245 * x + 12345) % 2147483648
        return x >> 8
    reqs = []
    total = 0
    for i in range(n):
        h = 1 + i * 7 + nxt() % 7
        reqs.append(("proj-%05d" % i, h))
        total += h
    for i in range(n - 1, 0, -1):
        j = nxt() % (i + 1)
        reqs[i], reqs[j] = reqs[j], reqs[i]
    if level == 3:
        for _ in range(n // 20):
            h = 1 + nxt() % 500
            reqs.append((reqs[nxt() % n][0], h))
            total += h
    return (reqs, total * 9 // 10, "smaller" if level >= 2 and seed % 2 else "id")
`.trim() + "\n";

// Independent oracle (small budgets): one hour at a time.
export function oracle(requests, budget, prefer) {
  if (budget < 0 || requests.some(([, h]) => h < 0)) return null;
  const order = [];
  const req = new Map();
  for (const [p, h] of requests) {
    if (!req.has(p)) { order.push(p); req.set(p, 0); }
    req.set(p, req.get(p) + h);
  }
  const alloc = new Map(order.map((p) => [p, 0]));
  const before = (a, b) => {                  // does project a get the next hour before b?
    if (alloc.get(a) !== alloc.get(b)) return alloc.get(a) < alloc.get(b);
    if (prefer === "smaller" && req.get(a) !== req.get(b)) return req.get(a) < req.get(b);
    return a < b;
  };
  for (let left = budget; left > 0; left--) {
    let pick = null;
    for (const p of order) if (alloc.get(p) < req.get(p) && (pick === null || before(p, pick))) pick = p;
    if (pick === null) break;
    alloc.set(pick, alloc.get(pick) + 1);
  }
  return order.map((p) => [p, alloc.get(p)]);
}

const pyArgs = (c) => "([" + c.requests.map(([p, h]) => `('${p}', ${h})`).join(", ") + `], ${c.budget}, '${c.prefer}')`;
const pyOut = (x) => (x === null ? "None" : "[" + x.map(([p, h]) => `('${p}', ${h})`).join(", ") + "]");
const run = (c) => oracle(c.requests, c.budget, c.prefer);

const NAMES = ["proj-atlas", "proj-birch", "proj-cobalt", "proj-delta", "proj-ember", "proj-fjord", "proj-garnet", "proj-heron", "proj-iris", "proj-juniper", "proj-kestrel", "proj-larch"];

function randomCase(r, level) {
  for (let attempt = 0; attempt < 200; attempt++) {
    const n = r.int(5, level === 1 ? 7 : 9);
    const names = r.sample(NAMES, n);
    const requests = names.map((p) => [p, r.int(level >= 2 ? 0 : 4, 90)]);
    if (level === 3) {
      for (let k = 0; k < 2; k++) {
        const pos = r.int(1, requests.length);
        requests.splice(pos, 0, [r.pick(names), r.int(3, 40)]);
      }
    }
    const total = requests.reduce((a, [, h]) => a + h, 0);
    const budget = r.int(Math.floor(total * 0.35), Math.floor(total * 0.85));
    const c = { requests, budget, prefer: level === 1 ? "id" : r.pick(["id", "smaller"]) };
    const out = run(c);
    // keep cases where some projects are capped, some are not, and spare hours are split
    const merged = new Map();
    for (const [p, h] of requests) merged.set(p, (merged.get(p) || 0) + h);
    const capped = out.filter(([p, h]) => h === merged.get(p)).length;
    const levels = new Set(out.filter(([p, h]) => h < merged.get(p)).map(([, h]) => h));
    if (capped >= 1 && capped < out.length - 1 && levels.size === 2) return c;
  }
  throw new Error("GDM-L1-05: could not build a sample");
}

export function generate(r, level) {
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const c = randomCase(r, level);
    samples.push({ args: pyArgs(c), expect: pyOut(run(c)) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const [a, b, c, d] = r.sample(NAMES, 4).sort();
  const k = r.int(5, 30);
  const edges = [
    ["no projects", { requests: [], budget: 100, prefer: "id" }],
    ["one project gets at most its request", { requests: [[a, k]], budget: 10 * k, prefer: "id" }],
    ["an even split", { requests: [[b, 50], [a, 50], [c, 50]], budget: 3 * k, prefer: "id" }],
    ["a small request is met in full and the rest is shared", { requests: [[a, 100], [b, k], [c, 100]], budget: 100 + k, prefer: "id" }],
    ["spare hours go by project id", { requests: [[c, 100], [a, 100], [b, 100]], budget: 3 * k + 2, prefer: "id" }],
    ["requests exactly at the level", { requests: [[a, k], [b, k], [c, 3 * k]], budget: 3 * k, prefer: "id" }],
    ["output keeps the input order", { requests: [[d, 2 * k], [b, 4], [a, 3 * k], [c, 7]], budget: 2 * k + 11, prefer: "id" }],
  ];
  if (level >= 2) {
    edges.push(["spare hours to the smaller request first", { requests: [[a, 90], [b, 40], [c, 60]], budget: 3 * 25 + 2, prefer: "smaller" }]);
    edges.push(["smaller first, equal requests by id", { requests: [[c, 50], [b, 50], [a, 70]], budget: 3 * 20 + 2, prefer: "smaller" }]);
    edges.push(["a budget above the total leaves hours unallocated", { requests: [[a, k], [b, 2 * k]], budget: 5 * k, prefer: "id" }]);
    edges.push(["a budget of 0", { requests: [[a, k], [b, 2 * k]], budget: 0, prefer: "smaller" }]);
    edges.push(["a request of 0 gets 0", { requests: [[a, 0], [b, 30], [c, 30]], budget: 31, prefer: "id" }]);
    edges.push(["a negative request: the input is invalid", { requests: [[a, 10], [b, -1]], budget: 5, prefer: "id" }]);
    edges.push(["a negative budget: the input is invalid", { requests: [[a, 10]], budget: -1, prefer: "id" }]);
  }
  if (level === 3) {
    edges.push(["a project listed twice: requests add up", { requests: [[a, 10], [b, 30], [a, 25]], budget: 60, prefer: "id" }]);
    edges.push(["a project listed twice appears once, at its first position", { requests: [[c, 5], [a, 40], [b, 40], [c, 30]], budget: 90, prefer: "smaller" }]);
    edges.push(["two small entries that add up to more than the level", { requests: [[a, 20], [b, 100], [a, 20], [c, 100]], budget: 3 * 33 + 1, prefer: "smaller" }]);
  }
  for (const [name, cs] of edges) tests.push({ name, args: pyArgs(cs), expect: pyOut(run(cs)) });

  // Timing: compared with the reference at check time. 50,000 staggered requests and a
  // budget of 90% of the total (about 7.9 x 10^9 hours): one hour at a time is out of the
  // question, and capping one project per round (find the smallest request, recompute the
  // equal share) is O(n^2), over a minute. Sorting once is about 0.1 s.
  const seed = r.int(1, 1_000_000) * 2 + (level >= 2 ? r.int(0, 1) : 0);
  tests.push({ name: "50,000 staggered requests and a large budget in time", args: `_gen_requests(50000, ${seed}, ${level})`, limit_s: 8 });

  return {
    vars: {
      prefer_rule: level === 1
        ? "In this exercise prefer is always \"id\": the spare hours go to the uncapped projects in ascending project_id order."
        : "prefer is \"id\" or \"smaller\". With \"id\", the spare hours go to the uncapped projects in ascending project_id order; with \"smaller\", to the uncapped projects with the smaller total request first, equal requests by ascending project_id.",
      invalid_rule: level === 1
        ? "Every request is at least 1 hour, the budget is at least 1, and each project appears once."
        : "A request can be 0, and the budget can be 0 or more than all the requests together (the extra hours stay unallocated). If any request or the budget is negative, the input is invalid: return None.",
      dup_rule: level === 3
        ? "A project can appear more than once (it submitted several requests): add its requests together; it appears once in the output, at the position of its first request."
        : "Each project appears once.",
    },
    samples,
    tests,
  };
}
