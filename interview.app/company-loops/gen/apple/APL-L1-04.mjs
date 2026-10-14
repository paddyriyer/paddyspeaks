/* APL-L1-04 — Time-synced lyrics: the line on screen at each playback position (Python).
   Simulated practice scenario. All data is generated from the seed.

   Contract: see docs/COMPANY-INTERVIEW-LOOPS.md § Executable templates (python).
   expect comes from oracle() below, which checks every line for every position. The
   evaluator's reference sorts once and binary-searches, so each checks the other.
   level: 1 Medium (lines sorted, half-open [start, end), gaps show nothing, seeks backwards)
          2 Hard (+ lines out of order: answers are input indexes; a corrected line listed
            later with the same start replaces the earlier one)
          3 Very Hard (+ repeat-one: positions count total listening time and wrap at duration_ms) */
export const kind = "python";
export const entry = "current_lines";
export const signature = "def current_lines(lines: list[tuple[int, int]], positions: list[int], duration_ms: int | None = None) -> list[int]:";
export const starter = `def current_lines(lines, positions, duration_ms=None):
    """lines: (start_ms, end_ms) per lyric line; a line is on screen for start_ms <= p < end_ms.
    positions: playback positions in ms, in the order they were sampled (seeks go anywhere).
    Return, for each position, the index in \`lines\` of the line on screen, or -1."""
    ...
`;

export const prelude = `
def _gen_lines(n, seed, shuffle=False, fixes=0):
    x, t, out = seed, 0, []
    for _ in range(n):
        x = (1103515245 * x + 12345) % 2147483648
        gap = 0 if (x >> 16) % 3 == 0 else 1 + (x >> 8) % 1500
        x = (1103515245 * x + 12345) % 2147483648
        length = 800 + (x >> 12) % 5200
        out.append((t + gap, t + gap + length))
        t += gap + length
    for _ in range(fixes):
        x = (1103515245 * x + 12345) % 2147483648
        s, e = out[(x >> 8) % n]
        x = (1103515245 * x + 12345) % 2147483648
        out.append((s, s + 1 + (x >> 8) % (e - s)))
    if shuffle:
        for i in range(len(out) - 1, 0, -1):
            x = (1103515245 * x + 12345) % 2147483648
            j = (x >> 8) % (i + 1)
            out[i], out[j] = out[j], out[i]
    return out


def _gen_positions(q, seed, total, seek_every=8):
    x, p, out = seed, 0, []
    for _ in range(q):
        x = (1103515245 * x + 12345) % 2147483648
        if (x >> 16) % seek_every == 0:
            x = (1103515245 * x + 12345) % 2147483648
            p = x % total
        else:
            p = (p + 100 + (x >> 8) % 900) % total
        out.append(p)
    return out
`.trim() + "\n";

// Independent oracle: the last listing of each start wins; then test every line.
export function oracle(lines, positions, duration) {
  const last = new Map();
  lines.forEach(([s], i) => last.set(s, i));
  return positions.map((p0) => {
    const p = duration ? p0 % duration : p0;
    for (const [s, i] of last) if (s <= p && p < lines[i][1]) return i;
    return -1;
  });
}

const pyList = (xs) => "[" + xs.join(", ") + "]";
const pyLines = (ls) => "[" + ls.map(([s, e]) => `(${s}, ${e})`).join(", ") + "]";
const pyArgs = (ls, ps, d) => `(${pyLines(ls)}, ${pyList(ps)}${d ? ", " + d : ""})`;

function smallCase(r, level) {
  const lines = [];
  let t = r.int(0, 3000);
  const n = r.int(5, 8);
  for (let i = 0; i < n; i++) {
    t += r.pick([0, 0, r.int(1, 1500)]);
    const len = r.int(800, 4000);
    lines.push([t, t + len]);
    t += len;
  }
  const end = t;
  let ls = lines.slice();
  if (level >= 2) {
    for (let k = r.int(1, 2); k > 0; k--) {
      const [s, e] = r.pick(lines);
      ls.push([s, s + r.int(1, e - s - 1)]);       // a correction: same start, shorter
    }
    ls = r.shuffle(ls);
  }
  const duration = level === 3 ? end + r.int(0, 3000) : null;
  const ps = [];
  for (let i = 0; i < 10; i++) {
    const [s, e] = r.pick(lines);
    let p = r.pick([s, e, e - 1, r.int(s, e), r.int(0, end + 500), s - 1 < 0 ? 0 : s - 1]);
    if (duration && r.chance(0.4)) p += duration * r.int(1, 2);
    ps.push(p);
  }
  return { ls, ps, duration };
}

export function generate(r, level) {
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const c = smallCase(r, level);
    samples.push({ args: pyArgs(c.ls, c.ps, c.duration), expect: pyList(oracle(c.ls, c.ps, c.duration)) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const a = r.int(500, 2000), b = a + r.int(800, 3000), c = b + r.int(1, 900), d = c + r.int(800, 3000);
  const edges = [
    ["a position before the first line shows nothing", [[a, b], [c, d]], [0, a - 1], null],
    ["start is inclusive, end is exclusive", [[a, b], [c, d]], [a, b - 1, b, c, d - 1, d], null],
    ["back-to-back lines: the end of one is the start of the next", [[a, b], [b, c], [c, d]], [b - 1, b, c, d], null],
    ["seeking backwards replays earlier lines", [[a, b], [b, c], [c, d]], [d - 1, c, a, b + 1, a - 1, c + 1], null],
    ["no positions", [[a, b]], [], null],
    ["no lines", [], [0, a, d], null],
  ];
  if (level >= 2) {
    edges.push(["lines out of order: answers are indexes into the input", [[c, d], [0, a], [a, b]], [1, a, c, b], null]);
    edges.push(["a later line with the same start replaces the earlier one", [[0, a], [a, d], [a, b]], [a, b - 1, b, c, d - 1], null]);
    edges.push(["the last listing wins even when it is the longer one", [[a, b], [0, a], [a, d]], [a, b, d - 1, d], null]);
  }
  if (level === 3) {
    const dur = d + r.int(0, 2000);
    edges.push(["repeat-one: a position equal to duration_ms is the start of the song again", [[0, a], [a, b], [c, d]], [dur, dur + a - 1, dur + a, 2 * dur + c, dur - 1], dur]);
    edges.push(["repeat-one: the last line ending exactly at duration_ms", [[0, a], [a, d]], [d - 1, d, d + a, 3 * d - 1], d]);
  }
  for (const [name, ls, ps, dur] of edges) tests.push({ name, args: pyArgs(ls, ps, dur), expect: pyList(oracle(ls, ps, dur)) });

  // Timing: 50 000 lines (a long live recording with a synced transcript) and 200 000
  // positions with a seek about every 8 samples. Checking every line per position is
  // 10^10 steps; a forward pointer reset on every backward seek is still ~6·10^8.
  // Sorting once and binary-searching takes well under a second.
  const seed = r.int(1, 1_000_000);
  const n = 50000, q = 200000;
  const linesExpr = `_gen_lines(${n}, ${seed}${level >= 2 ? ", True, 2000" : ""})`;
  const total = level === 3 ? "3 * (max(e for _, e in _L) + 1000)" : "max(e for _, e in _L) + 1000";
  tests.push({
    name: `${n.toLocaleString("en-US")} lines, ${q.toLocaleString("en-US")} positions with frequent seeks, in time`,
    args: `(lambda _L: (_L, _gen_positions(${q}, ${seed + 7}, ${total})${level === 3 ? ", max(e for _, e in _L) + 1000" : ""}))(${linesExpr})`,
    limit_s: 8,
  });

  return {
    vars: {
      order_rule: level === 1
        ? "In this round `lines` is sorted by `start_ms` and no two lines share a start."
        : "`lines` is **not** sorted (lyric files are edited by hand). Two entries can share a `start_ms`: the one listed **later** is a correction and replaces the earlier one entirely, whatever its `end_ms`. Return indexes into `lines` as given.",
      repeat_rule: level === 3
        ? "This round plays in repeat-one: `duration_ms` is given, positions count total listening time, and a position `p` means `p % duration_ms` into the song."
        : "`duration_ms` is `None` in this round: positions are offsets into the song.",
    },
    samples,
    tests,
  };
}
