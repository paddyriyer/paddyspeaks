/* SPT-L2-02 — Episode highlights: non-overlapping clips with the highest total score
   you are given (Python).
   Simulated practice scenario. All data is generated from the seed. Scores stand in
   for "a scoring function you are given"; nothing here describes how any real
   service ranks or picks clips.

   Contract (python): entry, signature, starter, prelude, generate(r, level) ->
     { vars, samples: [{args, expect}], tests: [{name, args, expect?, limit_s?}] }.
   expect comes from oracle() below: brute force over every subset of the clips
   (inputs here have at most 13 clips), keeping the subsets whose clips are pairwise
   separated by at least min_gap seconds. The evaluator's reference is a sorted DP
   with binary search, written independently.
   level: 1 Medium (no gap, clips may touch)
          · 2 Hard (+ score ties broken by fewer clips, clips scored 0, nested clips)
          · 3 Very Hard (+ a required gap between highlights, tested at its exact
            boundary) */
export const kind = "python";
export const entry = "pick_highlights";
export const signature = "def pick_highlights(clips: list[tuple[str, int, int, int]], min_gap: int = 0) -> tuple[int, int]:";
export const starter = `def pick_highlights(clips, min_gap=0):
    """clips: (clip_id, start_s, end_s, score), each covering [start_s, end_s).
    Return (best total score, number of clips in that selection)."""
    ...
`;

export const prelude = `
def _gen_clips(n, episode_s, max_len, seed):
    x = seed
    def rnd(m):
        nonlocal x
        x = (1103515245 * x + 12345) % 2147483648
        return (x >> 4) % m
    clips = []
    for i in range(n):
        start = rnd(episode_s)
        clips.append(('clip_%d' % i, start, start + 10 + rnd(max_len), rnd(1000)))
    return clips
`.trim() + "\n";

// Brute force: every subset, checked pairwise.
export function oracle(clips, gap) {
  const n = clips.length;
  let best = [0, 0];
  for (let mask = 1; mask < 1 << n; mask++) {
    const chosen = clips.filter((_, i) => mask & (1 << i)).sort((a, b) => a[1] - b[1]);
    let ok = true;
    for (let i = 1; i < chosen.length && ok; i++) if (chosen[i][1] - chosen[i - 1][2] < gap) ok = false;
    if (!ok) continue;
    const total = chosen.reduce((s, c) => s + c[3], 0);
    if (total > best[0] || (total === best[0] && chosen.length < best[1])) best = [total, chosen.length];
  }
  return best;
}

const pyArgs = (clips, gap) => `([${clips.map(([id, s, e, sc]) => `('${id}', ${s}, ${e}, ${sc})`).join(", ")}], ${gap})`;
const pyOut = ([t, c]) => `(${t}, ${c})`;
const LETTERS = "abcdefghjkmnpqrstuvwxyz".split("");
const cid = (r, used) => {
  for (;;) {
    const id = "hl_" + r.pick(LETTERS) + r.pick(LETTERS) + r.int(1, 9);
    if (!used.has(id)) { used.add(id); return id; }
  }
};

function randomCase(r, level, gap) {
  for (let attempt = 0; attempt < 100; attempt++) {
    const used = new Set();
    const n = level === 1 ? r.int(6, 9) : level === 2 ? r.int(9, 12) : r.int(10, 13);
    const span = level === 1 ? 600 : 900;
    const clips = [];
    for (let i = 0; i < n; i++) {
      // starts on 5-second marks so that touching clips and exact gaps happen often
      const start = 5 * r.int(0, span / 5);
      const len = 5 * r.int(3, level === 1 ? 24 : 36);
      const score = level >= 2 && r.chance(0.12) ? 0 : level >= 2 ? r.int(1, 12) : r.int(1, 60);
      clips.push([cid(r, used), start, start + len, score]);
    }
    if (level >= 2 && r.chance(0.5)) {                 // a nested pair whose total ties the outer clip
      const [, s, e] = r.pick(clips);
      if (e - s >= 40) {
        const mid = s + 5 * Math.floor((e - s) / 10);
        const a = r.int(1, 8), b = r.int(1, 8);
        clips.push([cid(r, used), s, mid, a], [cid(r, used), mid, e, b], [cid(r, used), s, e, a + b]);
      }
    }
    const pick = r.shuffle(clips).slice(0, 13);
    const got = oracle(pick, gap);
    if (got[1] >= 2) return { clips: pick, got };
  }
  throw new Error("SPT-L2-02: could not build a sample");
}

export function generate(r, level) {
  const gap = level === 3 ? 5 * r.int(1, 6) : 0;
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const c = randomCase(r, level, gap);
    samples.push({ args: pyArgs(c.clips, gap), expect: pyOut(c.got) });
  }
  const tests = samples.map((x, i) => ({ name: "sample " + (i + 1), args: x.args, expect: x.expect }));

  const t0 = 5 * r.int(0, 40);
  const L = 5 * r.int(4, 12);
  const at = (s) => t0 + s;
  const edges = [
    ["clips that touch do not overlap", [["a", at(0), at(L), 5], ["b", at(L), at(2 * L), 5]], 0],
    ["one second of overlap forces a choice", [["a", at(0), at(L + 1), 5], ["b", at(L), at(2 * L), 6]], 0],
    ["no clips", [], 0],
    ["the highest-scoring clip is not always in the best set", [["a", at(10), at(40), 10], ["b", at(0), at(20), 7], ["c", at(30), at(60), 7]], 0],
    ["picking the earliest-ending clip first is not always best", [["a", at(0), at(10), 1], ["b", at(5), at(100), 50]], 0],
    ["input order does not matter", [["c", at(2 * L), at(3 * L), 4], ["a", at(0), at(L), 3], ["b", at(L), at(2 * L), 2]], 0],
  ];
  if (level >= 2) {
    edges.push(["on a score tie, fewer clips win", [["a", at(0), at(100), 9], ["b", at(0), at(50), 4], ["c", at(50), at(100), 5]], 0]);
    edges.push(["a clip scored 0 is not added", [["a", at(0), at(10), 3], ["b", at(20), at(30), 0]], 0]);
    edges.push(["two clips with the same end", [["a", at(0), at(60), 4], ["b", at(30), at(60), 6], ["c", at(60), at(90), 2]], 0]);
  }
  if (level === 3) {
    edges.push([`a gap of exactly ${gap} s is allowed`, [["a", at(0), at(L), 5], ["b", at(L + gap), at(2 * L + gap), 5]], gap]);
    edges.push([`a gap of ${gap - 1} s is too short`, [["a", at(0), at(L), 5], ["b", at(L + gap - 1), at(2 * L + gap), 6]], gap]);
    edges.push(["with a gap required, touching clips cannot both be chosen", [["a", at(0), at(L), 5], ["b", at(L), at(2 * L), 4], ["c", at(2 * L + gap), at(3 * L + gap), 1]], gap]);
  }
  for (const [name, clips, g] of edges) tests.push({ name, args: pyArgs(clips, g), expect: pyOut(oracle(clips, g)) });

  tests.push({
    name: "80,000 candidate clips over a four-hour episode, up to 20 minutes long (n log n, not n²)",
    args: `(_gen_clips(80000, 14400, 1200, ${r.int(1, 1_000_000)}), ${gap})`,
    limit_s: 8,
  });

  return {
    vars: {
      gap_rule: level === 3
        ? `In this episode the producer wants at least \`min_gap\` = ${gap} seconds between one highlight's end and the next one's start, so that the reel does not run two moments together.`
        : "In this episode `min_gap` is 0: highlights may touch, but they may not overlap.",
    },
    samples,
    tests,
  };
}
