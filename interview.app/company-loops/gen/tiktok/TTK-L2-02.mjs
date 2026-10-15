/* TTK-L2-02 — Sound match: where a clip's fingerprint best aligns in a sound library
   (Python, hash index + offset voting).
   Simulated practice scenario. All data is generated from the seed.

   Contract (python): entry, signature, starter, prelude, generate(r, level) ->
     { vars, samples: [{args, expect}], tests: [{name, args, expect?, limit_s?}] }.
   expect comes from oracle() below, which tries every sound and every valid offset
   and compares the clip frame by frame. The evaluator's reference indexes the clip's
   hashes, scans each sound once and votes per offset, so each checks the other.
   level: 1 Medium (every clip frame has a hash; min_votes 1) · 2 Hard (+ frames with
          no hash, a minimum vote count) · 3 Very Hard (+ hashes too common in a
          sound cast no votes there) */
export const kind = "python";
export const entry = "best_alignment";
export const signature = "def best_alignment(library: dict[str, list[int]], clip: list[int | None], min_votes: int = 1, max_repeat: int | None = None) -> tuple[str, int, int] | None:";
export const starter = `def best_alignment(library, clip, min_votes=1, max_repeat=None):
    """library: sound id -> list of fingerprint hashes, one per frame.
    clip: the uploaded clip's hashes, one per frame (None: no hash for that frame).
    Return (sound_id, offset, votes) for the best alignment of the whole clip inside
    one sound, or None."""
    ...
`;

export const prelude = `
def _gen_library(n_sounds, min_len, max_len, clip_len, seed, gaps=0, beats=0):
    x = seed

    def nxt():
        nonlocal x
        x = (1103515245 * x + 12345) % 2147483648
        return x >> 7
    library = {}
    for k in range(n_sounds):
        n = min_len + nxt() % (max_len - min_len + 1)
        sound = [nxt() for _ in range(n)]
        if beats and k % 3 == 0:
            beat = nxt()
            for p in range(k % 8, n, 8):
                sound[p] = beat
        library['snd_%05d' % (k * 7 + 3)] = sound
    keys = sorted(library)
    src = library[keys[nxt() % len(keys)]]
    while len(src) < clip_len:
        src = library[keys[nxt() % len(keys)]]
    start = nxt() % (len(src) - clip_len + 1)
    clip = []
    for i in range(clip_len):
        r = nxt() % 100
        if r < gaps:
            clip.append(None)
        elif r < 45:
            clip.append(nxt())
        else:
            clip.append(src[start + i])
    return library, clip
`.trim() + "\n";

// Every sound, every offset at which the whole clip fits, frame by frame. Small inputs only.
export function oracle(library, clip, minVotes, maxRepeat) {
  let best = null;
  const ids = Object.keys(library).sort();
  for (const id of ids) {
    const s = library[id];
    const count = new Map();
    for (const h of s) count.set(h, (count.get(h) || 0) + 1);
    for (let o = 0; o + clip.length <= s.length; o++) {
      let v = 0;
      for (let i = 0; i < clip.length; i++) {
        const h = clip[i];
        if (h === null || h !== s[o + i]) continue;
        if (maxRepeat != null && count.get(h) > maxRepeat) continue;     // too common in this sound
        v++;
      }
      if (v > 0 && (best === null || v > best[2])) best = [id, o, v];    // ids and offsets ascend: first wins ties
    }
  }
  if (best === null || best[2] < minVotes) return null;
  return best;
}

const q = (s) => "'" + s + "'";
const pyList = (xs) => "[" + xs.map((h) => (h === null ? "None" : String(h))).join(", ") + "]";
const pyArgs = (c) =>
  "({" + Object.entries(c.library).map(([k, v]) => `${q(k)}: ${pyList(v)}`).join(", ") + "}, " +
  pyList(c.clip) + `, ${c.minVotes}, ${c.maxRepeat == null ? "None" : c.maxRepeat})`;
const pyOut = (x) => (x === null ? "None" : `(${q(x[0])}, ${x[1]}, ${x[2]})`);
const run = (c) => oracle(c.library, c.clip, c.minVotes, c.maxRepeat);

function randomCase(r, level, minVotes, maxRepeat) {
  for (let attempt = 0; attempt < 80; attempt++) {
    const alphabet = r.int(25, 40);
    const library = {};
    const ids = r.sample([3, 10, 17, 24, 31, 38, 45, 52], r.int(3, 4)).map((k) => `snd_${String(k * 13).padStart(4, "0")}`);
    for (const id of ids) {
      const n = r.int(18, 34);
      library[id] = Array.from({ length: n }, () => 1000 + r.int(0, alphabet));
      if (level === 3 && r.chance(0.5)) {
        const beat = 1000 + r.int(0, alphabet);
        for (let p = r.int(0, 3); p < n; p += 4) library[id][p] = beat;
      }
    }
    const src = library[r.pick(ids)];
    const m = r.int(7, 11);
    if (src.length < m) continue;
    const start = r.int(0, src.length - m);
    const clip = [];
    for (let i = 0; i < m; i++) {
      const roll = r.next();
      if (level >= 2 && roll < 0.15) clip.push(null);
      else if (roll < 0.4) clip.push(1000 + r.int(0, alphabet));
      else clip.push(src[start + i]);
    }
    const c = { library, clip, minVotes, maxRepeat };
    if (run(c) !== null) return c;
  }
  throw new Error("TTK-L2-02: could not build a sample with a match");
}

export function generate(r, level) {
  const minVotes = level === 1 ? 1 : r.int(3, 5);
  const maxRepeat = level === 3 ? r.int(3, 5) : null;
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const c = randomCase(r, level, minVotes, maxRepeat);
    samples.push({ args: pyArgs(c), expect: pyOut(run(c)) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const h = (k) => 5000 + 37 * k + r.int(0, 30) * 1000;       // distinct per k within one seed
  const H = Array.from({ length: 12 }, (_, k) => h(k));
  const [S1, S2] = [`snd_${r.int(10, 49)}`, `snd_${r.int(50, 99)}`];
  const mv = (c) => ({ minVotes: 1, maxRepeat: null, ...c });
  const edges = [
    ["the clip matches at offset 0",
      mv({ library: { [S1]: [H[0], H[1], H[2], H[3], H[4], H[5]] }, clip: [H[0], H[1], H[2]] })],
    ["the clip matches at the last offset where it still fits",
      mv({ library: { [S1]: [H[5], H[6], H[7], H[0], H[1], H[2]] }, clip: [H[0], H[1], H[2]] })],
    ["an alignment running past the end of the sound does not count",
      mv({ library: { [S1]: [H[7], H[8], H[9], H[3], H[0], H[1]] }, clip: [H[0], H[1], H[2], H[4]] })],
    ["a clip longer than every sound has no alignment",
      mv({ library: { [S1]: [H[0], H[1]], [S2]: [H[0]] }, clip: [H[0], H[1], H[2]] })],
    ["no hash in common",
      mv({ library: { [S1]: [H[0], H[1], H[2], H[3]] }, clip: [H[8], H[9]] })],
    ["equal votes in two sounds: the smaller sound id wins",
      mv({ library: { [S2]: [H[0], H[1], H[2], H[3]], [S1]: [H[5], H[0], H[1], H[9]] }, clip: [H[0], H[1]] })],
    ["equal votes at two offsets: the smaller offset wins",
      mv({ library: { [S1]: [H[3], H[0], H[1], H[4], H[0], H[1]] }, clip: [H[0], H[1]] })],
    ["a hash repeated in clip and sound counts once per clip frame",
      mv({ library: { [S1]: [H[6], H[6], H[6], H[6]] }, clip: [H[6], H[6], H[6]] })],
    ["the most votes wins over an earlier, weaker alignment",
      mv({ library: { [S1]: [H[0], H[1], H[9], H[9], H[0], H[1], H[2], H[3]] }, clip: [H[0], H[1], H[2], H[3]] })],
  ];
  if (level >= 2) {
    edges.push(["a frame with no hash keeps its place in the clip",
      mv({ library: { [S1]: [H[1], H[2], H[3], H[4], H[9]] }, clip: [null, H[2], H[3]] })]);
    edges.push(["a clip of frames with no hash at all",
      mv({ library: { [S1]: [H[1], H[2], H[3]] }, clip: [null, null] })]);
    edges.push(["exactly min_votes is a match",
      { library: { [S1]: [H[0], H[1], H[2], H[3], H[4]] }, clip: [H[0], H[1], H[2], H[8]], minVotes: 3, maxRepeat: null }]);
    edges.push(["one vote short of min_votes is no match",
      { library: { [S1]: [H[0], H[1], H[2], H[3], H[4]] }, clip: [H[0], H[1], H[2], H[8]], minVotes: 4, maxRepeat: null }]);
  }
  if (level === 3) {
    edges.push(["a hash too common in one sound votes only where it is rare",
      { library: { [S1]: [H[7], H[2], H[7], H[7], H[7], H[9]], [S2]: [H[5], H[7], H[2], H[8]] }, clip: [H[7], H[2], H[7]], minVotes: 1, maxRepeat: 3 }]);
    edges.push(["a hash exactly max_repeat times in a sound still votes",
      { library: { [S1]: [H[7], H[1], H[7], H[2], H[7], H[3]] }, clip: [H[7], H[2]], minVotes: 1, maxRepeat: 3 }]);
  }
  for (const [name, c] of edges) tests.push({ name, args: pyArgs(c), expect: pyOut(run(c)) });

  // Timing: compared with the reference at check time. About 1.5 million library
  // frames and a 1,500-frame clip: trying every offset, or finding each clip hash by
  // scanning each sound, is O(n·m).
  const seed = r.int(1, 1_000_000);
  const [sounds, gaps, beats] = level === 1 ? [350, 0, 0] : level === 2 ? [400, 8, 0] : [400, 8, 1];
  tests.push({
    name: `${sounds} sounds of up to 7,000 frames and a 1,500-frame clip in time`,
    args: `(*_gen_library(${sounds}, 1000, 7000, 1500, ${seed}, ${gaps}, ${beats}), ${minVotes}, ${maxRepeat == null ? "None" : 40})`,
    limit_s: 8,
  });

  return {
    vars: {
      gap_rule: level === 1
        ? "In this exercise every clip frame has a hash, and the tests use `min_votes` = 1, so the answer is `None` only when no alignment gets a single vote."
        : `A clip frame can be \`None\` when the fingerprinter produced no hash for it (silence or noise). It never votes, but it keeps its place: offsets are counted in frames, \`None\` frames included. The samples and the timing check use \`min_votes\` = ${minVotes}; each small check passes its own.`,
      repeat_rule: level === 3
        ? `\`max_repeat\` is an integer here (${maxRepeat} in the samples): a hash value that occurs more than \`max_repeat\` times in a sound, such as a repeating beat, is too common to locate anything, and it casts no votes for that sound. It still votes in sounds where it occurs \`max_repeat\` times or fewer.`
        : "In this exercise `max_repeat` is `None`: every match votes.",
    },
    samples,
    tests,
  };
}
