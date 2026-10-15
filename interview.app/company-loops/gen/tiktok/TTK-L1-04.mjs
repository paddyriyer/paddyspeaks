/* TTK-L1-04 — Resumable upload assembly: the fewest received byte ranges that cover the file,
   or the first missing byte (Python).
   Simulated practice scenario. All data is generated from the seed; file sizes, ranges and
   sequence numbers are hypothetical.

   Contract (python): entry, signature, starter, prelude, generate(r, level) ->
     { vars, samples: [{args, expect}], tests: [{name, args, expect?, limit_s?}] }.
   expect comes from oracle() below: the stated assembly rule applied literally, rescanning
   every range at every step (small inputs only). The evaluator's reference sorts once by first
   byte and sweeps; written independently.
   level: 1 Medium (ranges listed by first byte, no repeats, every checksum passed)
          · 2 Hard (+ ranges in any order, resent duplicates, ranges inside others, ties on the
            last byte broken by the lowest seq)
          · 3 Very Hard (+ ranges whose checksum failed must be ignored, even when they reach
            furthest; one-byte files and one-byte ranges) */
export const kind = "python";
export const entry = "assemble_upload";
export const signature = "def assemble_upload(file_size: int, ranges: list[tuple[int, int, int, bool]]) -> tuple[str, list[int] | int]:";
export const starter = `def assemble_upload(file_size, ranges):
    """file_size: bytes in the file (offsets 0 .. file_size - 1).
    ranges: (seq, first_byte, last_byte, checksum_ok), both bytes inclusive.
    Return ("complete", [seq, ...]) with the ranges the assembly rule picks, in file order,
    or ("missing", offset) with the first byte no usable range contains."""
    ...
`;

export const prelude = `
def _gen_ranges(n_parts, n_extra, seed, shuffle=False, bad=False, hole=False):
    x = seed
    def rnd(m):
        nonlocal x
        x = (1103515245 * x + 12345) % 2147483648
        return (x >> 16) % m
    parts, pos = [], 0
    for _ in range(n_parts):                       # the client's parts, each overlapping the last a little
        length = 400 + rnd(200)
        start = max(0, pos - rnd(40))
        parts.append((start, start + length - 1))
        pos = start + length
    size = pos
    ranges, seq = [], 0
    def add(a, b, ok=True):
        nonlocal seq
        seq += 1 + rnd(3)
        ranges.append((seq, a, b, ok))
    for a, b in parts:
        add(a, b)
    for _ in range(n_extra):                       # retries: resends, resumed tails and partial pieces
        a, b = parts[rnd(n_parts)]
        k = rnd(4)
        if k == 0:
            add(a, b)
        elif k == 1:
            add(a + rnd(b - a), b)
        elif k == 2:
            add(a, a + rnd(b - a))
        else:
            c = a + rnd(b - a)
            add(c, min(size - 1, c + rnd(900)), not bad or rnd(3) > 0)
    if hole:                                       # a byte late in the file was never received intact
        h = parts[n_parts - 1 - rnd(n_parts // 20 + 1)][0] + 7
        ranges = [t for t in ranges if not (t[1] <= h <= t[2])]
    if shuffle:
        for i in range(len(ranges) - 1, 0, -1):
            j = rnd(i + 1)
            ranges[i], ranges[j] = ranges[j], ranges[i]
    return size, ranges
`.trim() + "\n";

// The rule as stated: from byte 0, take among the usable ranges containing the first uncovered
// byte the one that ends furthest (ties: lowest seq); stop when the file is covered or nothing
// contains the byte. Every range is rescanned at every step.
export function oracle(size, ranges) {
  const ok = ranges.filter((x) => x[3]);
  const out = [];
  let pos = 0;
  while (pos < size) {
    let best = null;
    for (const x of ok) {
      if (x[1] <= pos && pos <= x[2] && (!best || x[2] > best[2] || (x[2] === best[2] && x[0] < best[0]))) best = x;
    }
    if (!best) return ["missing", pos];
    out.push(best[0]);
    pos = best[2] + 1;
  }
  return ["complete", out];
}

const pyBool = (b) => (b ? "True" : "False");
const pyArgs = (size, ranges) => `(${size}, [${ranges.map(([s, a, b, ok]) => `(${s}, ${a}, ${b}, ${pyBool(ok)})`).join(", ")}])`;
const pyOut = ([tag, v]) => (tag === "complete" ? `('complete', [${v.join(", ")}])` : `('missing', ${v})`);

// Sequence numbers in arrival order, gaps allowed (other uploads share the counter).
function numberer(r) {
  let s = r.int(1, 40);
  return () => (s += r.int(1, 4));
}

function randomCase(r, level, wantHole) {
  const next = numberer(r);
  const parts = [];
  let pos = 0;
  const n = r.int(4, 7);
  for (let i = 0; i < n; i++) {
    const len = r.int(20, 60);
    const start = Math.max(0, pos - r.int(0, 8));
    parts.push([start, start + len - 1]);
    pos = start + len;
  }
  const size = pos;
  let rs = parts.map(([a, b]) => [next(), a, b, true]);
  const extras = level === 1 ? r.int(1, 3) : r.int(3, 6);
  for (let i = 0; i < extras; i++) {
    const [a, b] = r.pick(parts);
    const k = r.int(0, level === 1 ? 2 : 3);
    if (k === 0 && level >= 2) rs.push([next(), a, b, true]);                         // resent part
    else if (k === 1) rs.push([next(), r.int(a, b), b, true]);                       // resumed tail
    else if (k === 2) rs.push([next(), a, r.int(a, b), true]);                       // cut short
    else { const c = r.int(a, b); rs.push([next(), c, Math.min(size - 1, c + r.int(10, 70)), true]); }
  }
  if (level === 3) {
    for (let i = 0; i < 2; i++) { const c = r.int(0, size - 2); rs.push([next(), c, Math.min(size - 1, c + r.int(30, 90)), false]); }
  }
  if (wantHole) {
    const h = r.int(1, size - 1);
    rs = rs.filter((x) => !(x[3] && x[1] <= h && h <= x[2]));
  }
  if (level === 1) {
    // Listed by first byte; a level-1 list holds no two ranges with the same bytes.
    const seen = new Set();
    rs = rs.filter((x) => { const k = x[1] + ":" + x[2]; if (seen.has(k)) return false; seen.add(k); return true; });
    rs.sort((x, y) => x[1] - y[1] || x[2] - y[2] || x[0] - y[0]);
  } else rs = r.shuffle(rs);
  return { size, rs };
}

export function generate(r, level) {
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const { size, rs } = randomCase(r, level, i === 2);
    samples.push({ args: pyArgs(size, rs), expect: pyOut(oracle(size, rs)) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const s0 = r.int(3, 60);
  const L = r.int(60, 99) * 10;                     // a small file of L bytes
  const T = true;
  const q = (...xs) => xs.map((x, i) => [s0 + 3 * i, x[0], x[1], x[2] ?? T]);
  const edges = [
    ["one range covers the whole file", L, q([0, L - 1])],
    ["adjacent ranges (last + 1 = next first) leave no gap", L, q([0, 199], [200, L - 1])],
    ["byte 0 was never received: missing at 0", L, q([1, 300], [250, L - 1])],
    ["a gap of one byte in the middle", L, q([0, 299], [301, L - 1])],
    ["the last byte is missing", L, q([0, 400], [380, L - 2])],
    ["a range that overlaps both neighbours is skipped", L, q([0, 99], [50, 149], [100, 399], [390, L - 1])],
    ["the range reaching furthest wins, not the first one listed", L, q([0, 120], [100, 150], [110, 500], [480, L - 1])],
  ];
  if (level >= 2) {
    edges.push(["ranges in any order", L, q([400, L - 1], [0, 199], [150, 450])]);
    edges.push(["a part resent twice: the lower seq is used", L, [[s0 + 9, 0, 299, T], [s0 + 2, 0, 299, T], [s0 + 5, 250, L - 1, T]]]);
    edges.push(["two ranges end on the same byte: the lower seq, whatever its start", L, [[s0 + 7, 120, 600, T], [s0 + 4, 50, 600, T], [s0, 0, 130, T], [s0 + 11, 590, L - 1, T]]]);
    edges.push(["a range inside another adds nothing", L, q([0, L - 1], [10, 50], [300, 301])]);
  }
  if (level === 3) {
    edges.push(["a failed checksum is ignored even when it reaches furthest", L, [[s0, 0, 299, T], [s0 + 3, 250, L - 1, false], [s0 + 6, 280, 700, T], [s0 + 8, 690, L - 1, T]]]);
    edges.push(["only a failed range holds a byte: it is missing", L, [[s0, 0, 299, T], [s0 + 3, 200, 500, false], [s0 + 5, 301, L - 1, T]]]);
    edges.push(["a one-byte file", 1, [[s0, 0, 0, T]]]);
    edges.push(["one-byte ranges bridge a gap", L, [[s0, 0, 299, T], [s0 + 1, 300, 300, T], [s0 + 2, 301, 301, T], [s0 + 4, 302, L - 1, T]]]);
    edges.push(["no usable range at all", L, [[s0, 0, L - 1, false]]]);
  }
  for (const [name, size, rs] of edges) tests.push({ name, args: pyArgs(size, rs), expect: pyOut(oracle(size, rs)) });

  // Timing: 12 000 parts plus 120 000 retried ranges, so the cover needs about 11 000 ranges.
  // Rescanning every range at each step is O(n·k) ≈ 1.5e9 checks; one sort and a sweep is O(n log n).
  const seed = r.int(1, 1_000_000);
  tests.push({
    name: "132,000 received ranges, a cover of about 11,000 (sort once, not a rescan per step)",
    args: level === 1 ? `_gen_ranges(12000, 120000, ${seed})`
      : level === 2 ? `_gen_ranges(12000, 120000, ${seed}, True)`
        : `_gen_ranges(12000, 120000, ${seed}, True, True, True)`,
    limit_s: 8,
  });

  return {
    vars: {
      order_rule: level === 1
        ? "In this exercise `ranges` is listed by first byte, no two ranges hold the same bytes, and every checksum passed."
        : level === 2
          ? "`ranges` arrives in any order (retries finish out of order), a part can be received several times with different `seq`, and every checksum passed in this exercise."
          : "`ranges` arrives in any order with resent duplicates, and some ranges failed their checksum (`checksum_ok` is False): a failed range is never used, whatever it covers. A file can be a single byte.",
    },
    samples,
    tests,
  };
}
