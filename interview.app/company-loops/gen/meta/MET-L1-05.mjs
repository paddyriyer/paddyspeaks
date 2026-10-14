/* MET-L1-05 — Peak concurrent viewers of a creator's live broadcast (Python).
   Simulated practice scenario. All data is generated from the seed.

   Contract: see docs/COMPANY-INTERVIEW-LOOPS.md § Executable templates (python).
   level: 1 Medium (one session per viewer at a time: a sweep line)
          2 Hard (+ the same viewer on several devices or reconnecting: merge per viewer first)
          3 Very Hard (+ a minimum continuous watch time before a viewer counts at all) */
export const kind = "python";
export const entry = "peak_viewers";
export const signature = "def peak_viewers(sessions: list[tuple[str, int, int]], min_ms: int = 0) -> tuple[int, int, int]:";
export const starter = `def peak_viewers(sessions, min_ms=0):
    """sessions: (viewer_id, start_ms, end_ms), half-open [start_ms, end_ms), in any order.
    Return (peak, first_ms_at_peak, ms_at_peak), or (0, -1, 0) if nobody counts."""
    ...
`;

export const prelude = `
def _gen_sessions(n, n_viewers, seed, span_ms=7200000, max_len=900000, multi=True):
    x, out = seed, []
    for i in range(n):
        x = (1103515245 * x + 12345) % 2147483648
        v = (x >> 7) % n_viewers if multi else i
        x = (1103515245 * x + 12345) % 2147483648
        s = (x >> 4) % span_ms
        x = (1103515245 * x + 12345) % 2147483648
        out.append(('v%d' % v, s, s + 1 + (x >> 8) % max_len))
    return out
`.trim() + "\n";

// Brute force: merge per viewer, then count coverage at every boundary. O(n^2); small inputs only.
export function oracle(sessions, minMs) {
  const by = new Map();
  for (const [v, s, e] of sessions) { if (!by.has(v)) by.set(v, []); by.get(v).push([s, e]); }
  const ivs = [];
  for (const list of by.values()) {
    list.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    let [cs, ce] = list[0];
    for (let i = 1; i < list.length; i++) {
      const [s, e] = list[i];
      if (s <= ce) ce = Math.max(ce, e);
      else { ivs.push([cs, ce]); [cs, ce] = [s, e]; }
    }
    ivs.push([cs, ce]);
  }
  const kept = ivs.filter(([s, e]) => e - s >= minMs);
  if (!kept.length) return [0, -1, 0];
  const pts = [...new Set(kept.flat())].sort((a, b) => a - b);
  let peak = 0, first = -1, dur = 0;
  for (let i = 0; i + 1 < pts.length; i++) {
    const t = pts[i];
    let c = 0;
    for (const [s, e] of kept) if (s <= t && t < e) c++;
    const len = pts[i + 1] - t;
    if (c > peak) { peak = c; first = t; dur = len; }
    else if (c === peak && c > 0) dur += len;
  }
  return peak === 0 ? [0, -1, 0] : [peak, first, dur];
}

const pyTuple = (t) => `(${t.join(", ")})`;
const pyArgs = (sess, minMs) => `([${sess.map(([v, s, e]) => `('${v}', ${s}, ${e})`).join(", ")}], ${minMs})`;

function smallCase(r, level, n) {
  const viewers = r.sample(["ana", "bo", "cy", "dee", "eli", "fay", "gus", "hal", "ivy", "jo"], level === 1 ? n : Math.max(3, n - 3));
  const sess = [];
  const grid = [0, 500, 1000, 1500, 2000, 3000, 4000, 5000, 6000];
  if (level === 1) {
    for (const v of viewers) {
      const s = r.pick(grid);
      sess.push([v, s, s + r.pick([500, 1000, 1500, 2500, 4000])]);
    }
  } else {
    for (let i = 0; i < n; i++) {
      const v = r.pick(viewers);
      const s = r.pick(grid);
      sess.push([v, s, s + r.pick([500, 1000, 1500, 2500])]);
    }
  }
  const minMs = level === 3 ? r.pick([1000, 1500]) : 0;
  return { sess: r.shuffle(sess), minMs };
}

export function generate(r, level) {
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const { sess, minMs } = smallCase(r, level, 6 + i);
    samples.push({ args: pyArgs(sess, minMs), expect: pyTuple(oracle(sess, minMs)) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const t0 = r.int(1, 9) * 1000;
  const edges = [
    ["one viewer leaves at the instant another joins: never two at once", [["a", t0, t0 + 1000], ["b", t0 + 1000, t0 + 2000]], 0],
    ["the peak is reached twice: first time and the total time at the peak", [["a", t0, t0 + 1000], ["b", t0 + 500, t0 + 1000], ["c", t0 + 3000, t0 + 3200], ["d", t0 + 3100, t0 + 3700]], 0],
    ["no sessions at all", [], 0],
    ["sessions arrive in any order", [["c", t0 + 50, t0 + 90], ["a", t0, t0 + 100], ["b", t0 + 10, t0 + 60]], 0],
  ];
  if (level >= 2) {
    edges.push(["the same viewer on two devices counts once", [["a", t0, t0 + 1000], ["a", t0 + 200, t0 + 800], ["b", t0 + 500, t0 + 600]], 0]);
    edges.push(["a reconnect that touches the previous session is one continuous view", [["a", t0, t0 + 1000], ["a", t0 + 1000, t0 + 2000], ["b", t0 + 900, t0 + 1100]], 0]);
    edges.push(["a gap of 1 ms is two views, but never two viewers", [["a", t0, t0 + 1000], ["a", t0 + 1001, t0 + 2000], ["b", t0 + 999, t0 + 1002]], 0]);
  }
  if (level === 3) {
    edges.push(["a merged view of exactly min_ms counts; one ms shorter does not", [["a", t0, t0 + 1000], ["b", t0 + 100, t0 + 1099], ["c", t0 + 200, t0 + 1200]], 1000]);
    edges.push(["two short touching sessions merge into one that is long enough", [["a", t0, t0 + 600], ["a", t0 + 600, t0 + 1200], ["b", t0 + 300, t0 + 900]], 1000]);
    edges.push(["nobody watches long enough", [["a", t0, t0 + 400], ["b", t0, t0 + 999]], 1000]);
  }
  for (const [name, sess, minMs] of edges) tests.push({ name, args: pyArgs(sess, minMs), expect: pyTuple(oracle(sess, minMs)) });

  // Timing: 200 000 sessions over a two-hour broadcast. Counting the viewers at every
  // boundary, or marking every millisecond, does not finish; sorting does.
  const seed = r.int(1, 1_000_000);
  const n = level === 1 ? 150000 : 200000;
  const nViewers = level === 1 ? n : r.pick([60000, 90000]);
  const minMs = level === 3 ? r.pick([30000, 60000]) : 0;
  tests.push({
    name: `${n.toLocaleString("en-US")} sessions in time (O(n log n))`,
    args: `(_gen_sessions(${n}, ${nViewers}, ${seed}, multi=${level === 1 ? "False" : "True"}), ${minMs})`,
    limit_s: 8,
  });

  return {
    vars: {
      viewer_rule:
        level === 1
          ? "Each viewer has one session in the samples (the large test gives every session its own viewer): a viewer never overlaps themselves."
          : "A viewer can have several sessions: two devices at once, or a reconnect. A viewer counts once while any of their sessions is open, and sessions of one viewer that overlap or touch (one ends at the instant the next starts) are one continuous view.",
      min_rule:
        level === 3
          ? "A viewer's continuous view (after merging) counts only if it lasts at least `min_ms`; a shorter one is a scroll-past and is ignored entirely."
          : "`min_ms` is 0: every view counts.",
    },
    samples,
    tests,
  };
}
