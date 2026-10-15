/* CRW-L1-04 — Maintenance slots: the fewest moments that fall inside every customer's
   allowed window (Python, greedy by earliest end).
   Simulated practice scenario. All data is generated from the seed; windows, freezes
   and minutes are hypothetical.

   Contract (python): entry, signature, starter, prelude, generate(r, level) ->
     { vars, samples: [{args, expect}], tests: [{name, args, expect?, limit_s?}] }.
   expect comes from oracle() below, which does NOT use the greedy: it builds the
   candidate moments (for each window, the latest allowed minute inside it), tries
   every subset by increasing size, and keeps the latest schedule of the smallest
   size. The evaluator's reference is the earliest-end greedy, so each checks the other.
   level: 1 Medium (valid windows, no freezes) · 2 Hard (+ duplicate, nested and
          zero-length windows, and an invalid window -> None) · 3 Very Hard (+ change
          freezes during which no maintenance may happen; a window with no allowed
          minute -> None) */
export const kind = "python";
export const entry = "maintenance_moments";
export const signature = "def maintenance_moments(windows: list[tuple[int, int]], freezes: list[tuple[int, int]] = ()) -> list[int] | None:";
export const starter = `def maintenance_moments(windows, freezes=()):
    """windows: (start, end) per customer cluster, inclusive minutes, any order.
    freezes: (start, end) inclusive minutes in which no maintenance may happen.
    Return the fewest maintenance moments, ascending, such that every window
    contains at least one; among smallest schedules, the latest one.
    Return None if a window has start > end or no allowed minute."""
    ...
`;

export const prelude = `
def _gen_windows(n, horizon, seed, n_freezes=0):
    x = seed

    def nxt():
        nonlocal x
        x = (1103515245 * x + 12345) % 2147483648
        return x >> 8
    windows = []
    for _ in range(n):
        s = nxt() % horizon
        windows.append((s, s + 40 + nxt() % 120))
    freezes = []
    for k in range(n_freezes):
        a = k * (horizon // max(1, n_freezes)) + nxt() % 200
        freezes.append((a, a + nxt() % 30))
    x = seed + 7
    for i in range(len(freezes) - 1, 0, -1):
        j = nxt() % (i + 1)
        freezes[i], freezes[j] = freezes[j], freezes[i]
    return windows, freezes
`.trim() + "\n";

// Independent oracle (small inputs only): subsets of candidate moments by increasing size.
export function oracle(windows, freezes) {
  if (windows.some(([s, e]) => s > e)) return null;
  const allowed = (p) => !freezes.some(([a, b]) => p >= a && p <= b);
  const cand = new Set();
  for (const [s, e] of windows) {
    let p = e;
    while (p >= s && !allowed(p)) p--;
    if (p < s) return null;
    cand.add(p);
  }
  const C = [...cand].sort((a, b) => b - a);          // latest first
  if (!windows.length) return [];
  const covers = (set) => windows.every(([s, e]) => set.some((p) => p >= s && p <= e));
  let best = null;
  for (let size = 1; size <= C.length && !best; size++) {
    const pick = [];
    const rec = (i) => {
      if (pick.length === size) {
        if (covers(pick)) {
          const sched = pick.slice().sort((a, b) => a - b);
          if (!best || later(sched, best)) best = sched;
        }
        return;
      }
      for (let j = i; j < C.length; j++) { pick.push(C[j]); rec(j + 1); pick.pop(); }
    };
    rec(0);
  }
  return best;
}
function later(a, b) {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] > b[i];
  return false;
}

const tup = (xs) => "[" + xs.map(([a, b]) => `(${a}, ${b})`).join(", ") + "]";
const pyArgs = (c) => `(${tup(c.windows)}, ${tup(c.freezes)})`;
const pyOut = (x) => (x === null ? "None" : "[" + x.join(", ") + "]");
const run = (c) => oracle(c.windows, c.freezes);

function randomCase(r, level) {
  for (let attempt = 0; attempt < 100; attempt++) {
    const n = r.int(6, level === 1 ? 8 : 10);
    const span = r.int(600, 1800);
    const windows = [];
    for (let i = 0; i < n; i++) {
      const s = r.int(0, span);
      const len = level >= 2 && r.chance(0.12) ? 0 : r.int(20, 360);
      windows.push([s, s + len]);
    }
    if (level >= 2) {
      const w = r.pick(windows);
      windows.push([w[0], w[1]]);                                   // a duplicate
      const big = r.pick(windows);
      windows.push([Math.max(0, big[0] - r.int(10, 60)), big[1] + r.int(10, 60)]); // a window around another
    }
    const freezes = [];
    if (level === 3) {
      for (let k = 0; k < r.int(2, 3); k++) {
        const w = r.pick(windows);
        const a = w[1] - r.int(0, 30);
        freezes.push([a, a + r.int(5, 60)]);                          // over some window's end
      }
    }
    const c = { windows: r.shuffle(windows), freezes };
    const out = run(c);
    if (out && out.length >= 2 && out.length < n) return c;
  }
  throw new Error("CRW-L1-04: could not build a sample");
}

export function generate(r, level) {
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const c = randomCase(r, level);
    samples.push({ args: pyArgs(c), expect: pyOut(run(c)) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const t = r.int(100, 900);
  const edges = [
    ["no windows needs no maintenance", { windows: [], freezes: [] }],
    ["one window: the moment is its end", { windows: [[t, t + 120]], freezes: [] }],
    ["windows that touch at one minute share it", { windows: [[t + 60, t + 120], [t, t + 60]], freezes: [] }],
    ["windows one minute apart need two moments", { windows: [[t, t + 60], [t + 61, t + 90]], freezes: [] }],
    ["a long window starting first does not decide the first moment", { windows: [[t, t + 500], [t + 40, t + 80], [t + 200, t + 260]], freezes: [] }],
    ["among smallest schedules, the latest one", { windows: [[t, t + 100], [t + 50, t + 300]], freezes: [] }],
    ["windows given out of order", { windows: [[t + 400, t + 450], [t, t + 30], [t + 200, t + 210], [t + 20, t + 220]], freezes: [] }],
  ];
  if (level >= 2) {
    edges.push(["a zero-length window", { windows: [[t, t + 200], [t + 77, t + 77]], freezes: [] }]);
    edges.push(["identical windows count once", { windows: [[t, t + 45], [t, t + 45], [t, t + 45]], freezes: [] }]);
    edges.push(["nested windows", { windows: [[t, t + 600], [t + 100, t + 300], [t + 150, t + 160]], freezes: [] }]);
    edges.push(["a window with start after end is invalid", { windows: [[t, t + 60], [t + 90, t + 80]], freezes: [] }]);
  }
  if (level === 3) {
    edges.push(["a freeze over the window's end moves the moment earlier", { windows: [[t, t + 100]], freezes: [[t + 60, t + 150]] }]);
    edges.push(["a freeze starting one minute after the window starts", { windows: [[t, t + 100]], freezes: [[t + 1, t + 200]] }]);
    edges.push(["a freeze covering the whole window", { windows: [[t + 500, t + 520], [t, t + 100]], freezes: [[t - 5, t + 100]] }]);
    edges.push(["overlapping and touching freezes", { windows: [[t, t + 200]], freezes: [[t + 150, t + 220], [t + 120, t + 160], [t + 100, t + 119]] }]);
    edges.push(["a moment moved by a freeze can miss the next window", { windows: [[t, t + 100], [t + 60, t + 300]], freezes: [[t + 50, t + 150]] }]);
    edges.push(["a freeze between windows changes nothing", { windows: [[t, t + 40], [t + 100, t + 140]], freezes: [[t + 50, t + 90]] }]);
  }
  for (const [name, c] of edges) tests.push({ name, args: pyArgs(c), expect: pyOut(run(c)) });

  // Timing: compared with the reference at check time. 100,000 windows of 40-159
  // minutes over a year need about 7,300 moments; rebuilding the list of uncovered
  // windows after each pick is about 4 x 10^8 checks (about 57 s in CPython).
  const seed = r.int(1, 1_000_000);
  tests.push({
    name: "100,000 windows over a year in time",
    args: `_gen_windows(100000, 525600, ${seed}, ${level === 3 ? 2000 : 0})`,
    limit_s: 8,
  });

  return {
    vars: {
      invalid_rule: level === 1
        ? "Every window in this exercise has start ≤ end."
        : "A window can be zero-length (start = end). If any window has start > end, the input is invalid: return `None`.",
      freeze_rule: level === 3
        ? "`freezes` lists change-freeze periods `(start, end)`, inclusive, in any order and possibly overlapping. No maintenance moment may fall inside a freeze. If some window has no minute outside every freeze, no schedule exists: return `None`."
        : "`freezes` is always empty at this level.",
    },
    samples,
    tests,
  };
}
