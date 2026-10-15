/* XAI-L2-01 — Tool-call loops (Python, Z-function of the reversed trace).
   Simulated practice scenario. All data is generated from the seed; every trace,
   call id, threshold and cap is hypothetical.

   Contract (python): entry, signature, starter, prelude, generate(r, level) ->
     { vars, samples: [{args, expect}], tests: [{name, args, expect?, limit_s?}] }.
   expect comes from oracle() below, which tries every cycle length and walks the
   trace backwards call by call to measure how far that cycle reaches. The
   evaluator's reference reads every cycle length's reach from one Z-function of
   the reversed trace, so each checks the other.
   level: 1 Medium (r = 3; clean loops, loops that ended, no loop at all)
          2 Hard (r of 2 to 4 by seed; + a short cycle that repeats r times at the
            very end while a longer cycle covers more calls, ties between a cycle
            and its multiples)
          3 Very Hard (+ a cap: cycles longer than max_cycle calls are not loops) */
export const kind = "python";
export const entry = "find_loops";
export const signature = "def find_loops(traces: list[list[int]], r: int, max_cycle: int | None) -> list[tuple[int, int, int] | None]:";
export const starter = `def find_loops(traces, r, max_cycle):
    """traces: one list per response, the server-side tool calls in the order
    they ran, each call an integer id (equal calls share an id).
    r: a cycle counts as a loop only when at least r full copies of it end
    the trace. max_cycle: the longest cycle length that counts, or None.
    For each trace return (p, start, copies) for the loop that covers the
    most calls at the end of the trace (ties: the shorter cycle), or None."""
    ...
`;

export const prelude = `
def _gen_traces(k, n, seed, r=3, max_cycle=None):
    x = seed

    def nxt():
        nonlocal x
        x = (1103515245 * x + 12345) % 2147483648
        return x >> 8
    traces = []
    for _ in range(k):
        q = 2 + nxt() % 4                          # a short loop of 2 to 5 calls
        cycle = [1000 + nxt() % 60 for _ in range(q)]
        head = n // 5 + nxt() % (n // 10)
        tr = [nxt() % 400 for _ in range(head)]    # ordinary work before the loop
        while len(tr) < n:
            tr.extend(cycle)
            if len(tr) < n * 7 // 20 and nxt() % 50 == 0:
                tr.append(2000 + nxt() % 9)        # near-periodic: the loop stumbles early on
        del tr[n:]
        traces.append(tr)
    return traces, r, max_cycle
`.trim() + "\n";

// The rule, literally: every cycle length, walked back call by call.
export function oracle(traces, r, maxCycle) {
  return traces.map((tr) => {
    const n = tr.length;
    let top = Math.floor(n / r);
    if (maxCycle !== null) top = Math.min(top, maxCycle);
    let best = null;
    for (let p = 1; p <= top; p++) {
      let i = n - 1 - p;
      while (i >= 0 && tr[i] === tr[i + p]) i--;
      const reach = n - 1 - i;                     // calls at the end with period p
      if (reach >= r * p && (best === null || reach > best[0])) best = [reach, p];
    }
    return best === null ? null : [best[1], n - best[0], Math.floor(best[0] / best[1])];
  });
}

const pyNone = (v) => (v === null ? "None" : String(v));
const pyArgs = (c) => `([${c.traces.map((t) => "[" + t.join(", ") + "]").join(", ")}], ${c.r}, ${pyNone(c.maxCycle)})`;
const pyOut = (xs) => "[" + xs.map((x) => (x === null ? "None" : `(${x.join(", ")})`)).join(", ") + "]";
const run = (c) => oracle(c.traces, c.r, c.maxCycle);

function randomTrace(r, R, level) {
  const q = r.int(1, level === 1 ? 3 : 4);
  const ids = r.sample([11, 12, 13, 14, 15, 16, 17, 18, 21, 22, 23, 24, 25, 31, 32, 33], 8);
  const cycle = Array.from({ length: q }, (_, i) => (i > 0 && r.chance(0.3) ? ids[0] : ids[i]));
  const tr = Array.from({ length: r.int(0, 5) }, () => r.pick(ids.concat([41, 42, 43])));
  const copies = r.int(Math.max(1, R - 2), R + 2);
  for (let c = 0; c < copies; c++) tr.push(...cycle);
  if (r.chance(0.4)) tr.push(...cycle.slice(0, r.int(0, q - 1)));
  if (r.chance(0.15)) tr.push(r.pick([51, 52, 53]));        // the loop ended before the trace did
  return tr;
}

export function generate(r, level) {
  const R = level === 1 ? 3 : r.int(2, 4);
  const sampleCap = level === 3 ? r.int(2, 3) : null;
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const c = { traces: Array.from({ length: r.int(3, 5) }, () => randomTrace(r, R, level)), r: R, maxCycle: sampleCap };
    samples.push({ args: pyArgs(c), expect: pyOut(run(c)) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  // Distinct call ids for the hand-built checks; s = web search, o = open a page, p = post search.
  const [s, o, p, x, y, z] = r.sample([101, 102, 103, 104, 105, 201, 202, 203, 301, 302], 6);
  const rep = (xs, k) => Array.from({ length: k }, () => xs).flat();
  const pre = [x, y];
  const one = (traces, cap = null) => ({ traces, r: R, maxCycle: cap });
  const edges = [
    ["the same call repeated: a cycle of one call",
      one([rep([s], R + 2)])],
    ["exactly r copies at the end is a loop",
      one([pre.concat(rep([s, o], R))])],
    ["r - 1 copies and part of another is not",
      one([pre.concat(rep([s, o, p], R - 1), [s, o])])],
    ["the looping stretch can begin part way through a cycle",
      one([pre.concat([o, p], rep([s, o, p], R + 1))])],
    ["a loop the trace broke out of is not reported",
      one([pre.concat(rep([s, o], R + 3), [z])])],
    ["no repeated calls at all, an empty trace, and a trace shorter than r",
      one([[s, o, p, x, y, z], [], [s].concat(R > 2 ? [s] : [])])],
    ["several traces in one call keep their order",
      one([rep([p], R), pre.concat(rep([s, o, p], R)), [x]])],
    ["a shorter cycle repeats r times at the very end, but a longer one covers more calls",
      one([rep([s].concat(rep([o], R)), R + 1)])],
    ["a cycle and its multiples cover the same calls: the shorter cycle wins",
      one([pre.concat(rep([s, o], 2 * R + 2))])],
  ];
  if (level >= 2) {
    edges.push(["a loop of one call inside the longer loop does not hide it",
      one([pre.concat(rep([s, o, o, p, o, o], R))])]);
    edges.push(["a longer cycle with only r - 1 copies loses to one call repeated r times",
      one([[x].concat(rep([s, o, p], R - 1), rep([z], R))])]);
  }
  if (level === 3) {
    const five = [o].concat(rep([p], 4 - R), rep([s], R));   // a cycle of 5 calls ending in r calls of s
    edges.push(["a cycle longer than the cap is not a loop, even when it covers more",
      one([rep(five, R + 1)], 4)]);
    edges.push(["a cycle exactly as long as the cap counts",
      one([pre.concat(rep([s, o, p, z], R + 1))], 4)]);
    edges.push(["with a cap of one call only single-call loops count",
      one([rep([s, o], R + 2), pre.concat(rep([p], R + 1))], 1)]);
  }
  for (const [name, c] of edges) tests.push({ name, args: pyArgs(c), expect: pyOut(run(c)) });

  // Timing: compared with the reference at check time. Four traces of 60 000 calls whose
  // last 60 to 70 percent is one short loop, so every multiple of the loop's length is
  // also a valid cycle, and measuring each one's reach call by call is quadratic.
  const cap = level === 3 ? "12000" : "None";
  tests.push({
    name: "four 60,000-call traces that end in long, nearly periodic loops, in time",
    args: `_gen_traces(4, 60000, ${r.int(1, 1_000_000)}, ${R}, ${cap})`,
    limit_s: 8,
  });

  return {
    vars: {
      r: String(R),
      cap_rule: level === 3
        ? "The operator also caps the cycle length: a cycle of more than max_cycle calls is never a loop, however far it reaches, and max_cycle is at least 1."
        : "In this instance max_cycle is always None: there is no cap on the cycle length.",
    },
    samples,
    tests,
  };
}
