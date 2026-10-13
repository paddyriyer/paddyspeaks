/* GOO-L2-02 — Best bitrate plan for a recorded network trace (Python).
   Simulated practice scenario. All data is generated from the seed.

   Contract (python): entry, signature, starter, prelude, generate(r, level) ->
     { vars, samples: [{args, expect}], tests: [{name, args, expect?, limit_s?}] }.
   expect comes from oracle() below: it enumerates every plan (one rendition per
   segment) and simulates the player's buffer, so it is only used on short traces.
   The evaluator's reference is a dynamic programme over (previous rendition,
   buffer level) written independently.
   level: 1 Medium (no switching penalty, steady network) · 2 Hard (+ switching
          penalty, throughput swings) · 3 Very Hard (+ near-outages, a tight buffer cap,
          a heavy stall penalty) */
export const kind = "python";
export const entry = "best_plan_score";
export const signature = "def best_plan_score(throughput: list[int], ladder: list[tuple[int, int]], segment_ticks: int, max_buffer: int, switch_penalty: int, stall_penalty: int) -> int:";
export const starter = `def best_plan_score(throughput, ladder, segment_ticks, max_buffer, switch_penalty, stall_penalty):
    """throughput[i]: kbps while segment i downloads. ladder: (kbps, quality).
    Time is in ticks of 100 ms. Downloading segment i at rendition (kbps, q) takes
        ceil(kbps * segment_ticks / throughput[i]) ticks.
    The buffer starts at 0. stall = max(0, download - buffer); then
        buffer = min(max(buffer - download, 0) + segment_ticks, max_buffer).
    score = sum(q) - switch_penalty * sum(|q_i - q_(i-1)|) - stall_penalty * sum(stall).
    Return the best score over all plans."""
    ...
`;

export const prelude = `
def _gen_trace(n, seed):
    x, level, out = seed, 3000, []
    for _ in range(n):
        x = (1103515245 * x + 12345) % 2147483648
        step = (x >> 8) % 1601 - 800
        level = min(9000, max(250, level + step))
        x = (1103515245 * x + 12345) % 2147483648
        out.append(120 if (x >> 8) % 40 == 0 else level)   # a short near-outage now and then
    return out
`.trim() + "\n";

const download = (kbps, seg, thr) => Math.ceil((kbps * seg) / thr);   // exact: all values are small integers

// Exhaustive search over every plan, simulating the buffer segment by segment.
export function oracle(throughput, ladder, seg, maxBuf, swPen, stPen) {
  const n = throughput.length;
  let best = -Infinity;
  const plan = new Array(n).fill(0);
  const go = (i, buf, score) => {
    if (i === n) { if (score > best) best = score; return; }
    for (let r = 0; r < ladder.length; r++) {
      const [kbps, q] = ladder[r];
      const dl = download(kbps, seg, throughput[i]);
      const stall = Math.max(0, dl - buf);
      const nb = Math.min(Math.max(buf - dl, 0) + seg, maxBuf);
      const sw = i === 0 ? 0 : swPen * Math.abs(q - ladder[plan[i - 1]][1]);
      plan[i] = r;
      go(i + 1, nb, score + q - sw - stPen * stall);
    }
  };
  go(0, 0, 0);
  return best;
}

const LADDERS = [
  [[300, 10], [750, 22], [1500, 34], [3000, 44], [6000, 51]],
  [[250, 8], [600, 20], [1200, 31], [2500, 41], [4500, 48]],
  [[400, 12], [1000, 26], [2000, 37], [4000, 46], [8000, 52]],
];

const pyArgs = (thr, ladder, seg, maxBuf, sw, st) =>
  `([${thr.join(", ")}], [${ladder.map(([k, q]) => `(${k}, ${q})`).join(", ")}], ${seg}, ${maxBuf}, ${sw}, ${st})`;

function smallCase(r, level, base) {
  const R = level === 1 ? 3 : 4;
  const ladder = r.sample(base, R).sort((a, b) => a[0] - b[0]);
  const n = level === 1 ? r.int(4, 6) : level === 2 ? r.int(5, 6) : r.int(6, 7);
  const thr = [];
  let lv = r.int(800, 5000);
  for (let i = 0; i < n; i++) {
    const swing = level === 1 ? 500 : 2500;
    lv = Math.min(9000, Math.max(300, lv + r.int(-swing, swing)));
    thr.push(level === 3 && r.chance(0.2) ? r.int(100, 250) : lv);
  }
  const seg = r.pick([20, 40]);
  const maxBuf = level === 3 ? seg * r.int(1, 3) : seg * r.int(3, 6);
  const sw = level === 1 ? 0 : r.int(1, 3);
  const st = level === 3 ? r.int(3, 6) : r.int(1, 3);
  return { thr, ladder, seg, maxBuf, sw, st };
}

export function generate(r, level) {
  const base = r.pick(LADDERS);
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const c = smallCase(r, level, base);
    samples.push({ args: pyArgs(c.thr, c.ladder, c.seg, c.maxBuf, c.sw, c.st), expect: String(oracle(c.thr, c.ladder, c.seg, c.maxBuf, c.sw, c.st)) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const lad3 = r.sample(base, 3).sort((a, b) => a[0] - b[0]);
  const [lo, mid, hi] = lad3;
  const seg = 20;
  const edges = [
    ["one segment: the first download is a stall (startup)", [r.int(1500, 4000)], lad3, seg, 80, 0, 2],
    ["download time rounds up to whole ticks", [3 * lo[0]], [lo], seg, 80, 0, 5],
    ["a lower rendition that avoids a stall beats a higher one that stalls",
      [hi[0] * 2, Math.max(100, Math.floor(hi[0] / 2)), hi[0] * 2], lad3, seg, 60, 0, 3],
    ["the buffer cap: waiting while full adds no buffer",
      [hi[0] * 8, hi[0] * 8, hi[0] * 8, Math.max(100, Math.floor(mid[0] / 3)), hi[0] * 8], lad3, seg, seg, 0, 2],
    ["a long steady trace has no stalls after startup", Array.from({ length: 6 }, () => hi[0] * 3), lad3, seg, 100, 0, 1],
  ];
  if (level >= 2) {
    edges.push(["a switching penalty makes holding one rendition better than oscillating",
      [hi[0] * 4, mid[0] * 2, hi[0] * 4, mid[0] * 2, hi[0] * 4], lad3, seg, 40, 3, 4]);
    edges.push(["the same trace without a switching penalty", [hi[0] * 4, mid[0] * 2, hi[0] * 4, mid[0] * 2, hi[0] * 4], lad3, seg, 40, 0, 4]);
  }
  if (level === 3) {
    edges.push(["build buffer at a low rendition before a near-outage",
      [mid[0] * 3, mid[0] * 3, mid[0] * 3, 120, 120, hi[0] * 3], lad3, seg, 80, 1, 6]);
    edges.push(["a tight buffer cap cannot ride out the same outage", [mid[0] * 3, mid[0] * 3, mid[0] * 3, 120, 120, hi[0] * 3], lad3, seg, seg, 1, 6]);
  }
  for (const [name, thr, lad, sg, mb, sw, st] of edges) tests.push({ name, args: pyArgs(thr, lad, sg, mb, sw, st), expect: String(oracle(thr, lad, sg, mb, sw, st)) });

  // Timing: a long trace. The DP has at most len(ladder) * (max_buffer + 1) states per
  // segment; enumerating plans is len(ladder) ** segments.
  const n = level === 1 ? 120 : level === 2 ? 150 : 180;
  const maxBuf = level === 3 ? 200 : 300;
  const seed = r.int(1, 1_000_000);
  tests.push({
    name: `${n} segments, 5 renditions, buffer cap ${maxBuf} ticks (DP over buffer states)`,
    args: `(_gen_trace(${n}, ${seed}), [${base.map(([k, q]) => `(${k}, ${q})`).join(", ")}], 20, ${maxBuf}, ${level === 1 ? 0 : 2}, ${level === 3 ? 5 : 2})`,
    limit_s: 8,
  });

  return {
    vars: {
      trace_rule: level === 1
        ? "In this replay the network is fairly steady and `switch_penalty` is 0."
        : level === 2
          ? "Throughput swings from segment to segment, and every change of quality costs `switch_penalty` per quality point."
          : "The trace includes near-outages (a tunnel, a crowded cell), the buffer cap is tight, and a stalled tick costs far more than any quality gain.",
    },
    samples,
    tests,
  };
}
