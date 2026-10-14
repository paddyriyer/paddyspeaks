/* SPT-L1-05 — Album completion: per listener, the shortest stretch of plays that
   contains every track of an album (Python).
   Simulated practice scenario. All data is generated from the seed and is hypothetical.
   The 30-second rule is this exercise's rule.

   Contract: see docs/COMPANY-INTERVIEW-LOOPS.md § Executable templates (python).
   Intended: two pointers with per-track counts, O(n) per listener after grouping.
   Naive: from every start, scan forward until every album track has been seen, O(n²)
   when one album track is rare.
   level: 1 Medium (plays are (listener, track) in time order)
          2 Hard (+ plays are (ts, listener, track) in arrival order; order each listener's
                  plays by ts, equal ts in arrival order)
          3 Very Hard (+ plays carry ms_played; a play under 30 000 ms is not a play at all) */
export const kind = "python";
export const entry = "shortest_completion";
export const signature = "def shortest_completion(plays: list[tuple], album: list[str]) -> dict[str, tuple[int, int]]:";
export const starter = `def shortest_completion(plays, album):
    """plays: one tuple per play (its shape is given in the problem for this round).
    album: the album's distinct track ids.
    Return {listener_id: (length, start)} for every listener whose plays contain the
    whole album: the shortest run of that listener's consecutive plays holding every
    album track, and its 0-based start in that listener's own play sequence
    (earliest start on a tie). Leave out listeners who never complete the album."""
    ...
`;

export const prelude = `
def _gen_plays(n, n_listeners, album_size, rare_every, seed, shape):
    x = seed

    def nxt():
        nonlocal x
        x = (1103515245 * x + 12345) % 2147483648
        return x >> 8

    album = ['alb%d' % i for i in range(album_size)]
    catalog = album[:-1] + ['trk%d' % i for i in range(80)]
    rare = album[-1]
    plays = []
    ts = 1000
    for i in range(n):
        who = 'lst%d' % (nxt() % n_listeners)
        track = rare if nxt() % rare_every == 0 else catalog[nxt() % len(catalog)]
        ts += nxt() % 3
        if shape == 2:
            plays.append((who, track))
        elif shape == 3:
            plays.append((ts - nxt() % 5, who, track))
        else:
            plays.append((ts - nxt() % 5, who, track, 40000 if nxt() % 10 else 29999))
    return plays, album
`.trim() + "\n";

// Independent oracle: brute force over every (start, end) of each listener's sequence.
export function oracle(plays, album, level) {
  const seqs = new Map();
  const rows = plays.map((p, i) => {
    if (level === 1) return { l: p[0], t: p[1], ts: 0, i };
    if (level === 2) return { l: p[1], t: p[2], ts: p[0], i };
    return { l: p[1], t: p[2], ts: p[0], i, ms: p[3] };
  }).filter((p) => level < 3 || p.ms >= 30000);
  rows.sort((a, b) => a.ts - b.ts || a.i - b.i);
  for (const p of rows) { if (!seqs.has(p.l)) seqs.set(p.l, []); seqs.get(p.l).push(p.t); }
  const out = {};
  for (const l of [...seqs.keys()].sort()) {
    const s = seqs.get(l);
    let best = null;
    for (let i = 0; i < s.length; i++) {
      for (let j = i; j < s.length; j++) {
        const win = new Set(s.slice(i, j + 1));
        if (album.every((t) => win.has(t))) {
          const len = j - i + 1;
          if (!best || len < best[0]) best = [len, i];
          break;
        }
      }
    }
    if (best) out[l] = best;
  }
  return out;
}

const pyStr = (s) => "'" + s.replace(/\\/g, "\\\\").replace(/'/g, "\\'") + "'";
const pyPlay = (p) => "(" + p.map((v) => (typeof v === "string" ? pyStr(v) : String(v))).join(", ") + ")";
const pyArgs = (plays, album) => `([${plays.map(pyPlay).join(", ")}], [${album.map(pyStr).join(", ")}])`;
const pyRes = (o) => "{" + Object.keys(o).sort().map((k) => `${pyStr(k)}: (${o[k][0]}, ${o[k][1]})`).join(", ") + "}";

const LISTENERS = ["lst_ada", "lst_bo", "lst_cyd", "lst_dima", "lst_eun"];
const ALBUM = ["trk_a1", "trk_a2", "trk_a3", "trk_a4", "trk_a5"];
const OTHER = ["trk_x1", "trk_x2", "trk_x3", "trk_x4"];

// Shape plays for the level from (listener, track) in time order.
function shape(r, seq, level) {
  if (level === 1) return seq.map(([l, t]) => [l, t]);
  let ts = 1_700_000_000 + r.int(0, 50_000_000);
  const timed = seq.map(([l, t, ms]) => {
    ts += r.pick([0, 1, 4, 30, 200]);
    return level === 2 ? [ts, l, t] : [ts, l, t, ms ?? r.pick([30000, 61000, 184000, 215000])];
  });
  // Arrival order: swap some neighbours (different instants keep their time order by ts).
  for (let k = 0; k < timed.length; k++) if (r.chance(0.3) && k + 1 < timed.length) [timed[k], timed[k + 1]] = [timed[k + 1], timed[k]];
  return timed;
}

function smallCase(r, level) {
  const albSize = r.int(3, 4);
  const album = ALBUM.slice(0, albSize);
  const ls = r.sample(LISTENERS, 3);
  const seq = [];
  for (let k = r.int(14, 20); k > 0; k--) {
    const l = r.pick(ls);
    const t = r.chance(0.65) ? r.pick(album) : r.pick(OTHER);
    seq.push([l, t, level === 3 && r.chance(0.2) ? r.int(1000, 29999) : undefined]);
  }
  return [shape(r, seq, level), album];
}

export function generate(r, level) {
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const [plays, album] = smallCase(r, level);
    samples.push({ args: pyArgs(plays, album), expect: pyRes(oracle(plays, album, level)) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const [L1, L2] = r.sample(LISTENERS, 2);
  const [a, b, c] = ALBUM;
  const [x, y] = OTHER;
  const mk = (seq) => shape(r, seq.map((p) => [...p]), level);
  const edges = [
    ["no plays at all", [], [a, b]],
    ["a one-track album: the first play of it", [[L1, x], [L1, a], [L1, a]], [a]],
    ["a listener who never completes the album is left out", [[L1, a], [L1, b], [L2, a], [L2, x]], [a, b]],
    ["two shortest stretches: the earlier start", [[L1, a], [L1, b], [L1, x], [L1, b], [L1, a]], [a, b]],
    ["the whole sequence is the only stretch", [[L1, a], [L1, x], [L1, y], [L1, c], [L1, b]], [a, b, c]],
    ["another listener's plays do not split a stretch", [[L1, a], [L2, x], [L2, y], [L1, b]], [a, b]],
    ["repeats inside the stretch still count toward its length", [[L1, a], [L1, a], [L1, x], [L1, a], [L1, b]], [a, b]],
  ];
  const fixed = edges.map(([name, seq, album]) => [name, mk(seq), album]);
  if (level >= 2) {
    // Out of arrival order: b arrives first but happened after a.
    fixed.push(["plays arrive out of order; order by ts", level === 2
      ? [[205, L1, b], [100, L1, a], [150, L1, x], [300, L1, a]]
      : [[205, L1, b, 61000], [100, L1, a, 61000], [150, L1, x, 61000], [300, L1, a, 61000]], [a, b]]);
    fixed.push(["equal ts keep their arrival order", level === 2
      ? [[100, L1, b], [100, L1, x], [100, L1, a], [90, L1, a]]
      : [[100, L1, b, 30000], [100, L1, x, 30000], [100, L1, a, 30000], [90, L1, a, 30000]], [a, b]]);
  }
  if (level === 3) {
    fixed.push(["a play under 30 seconds is not a play", [[1, L1, a, 61000], [2, L1, x, 61000], [3, L1, b, 29999], [4, L1, a, 61000], [5, L1, b, 30000]], [a, b]]);
    fixed.push(["only short plays of a track: never completed", [[1, L1, a, 61000], [2, L1, b, 12000], [3, L2, a, 30000], [4, L2, b, 30001]], [a, b]]);
  }
  for (const [name, plays, album] of fixed) tests.push({ name, args: pyArgs(plays, album), expect: pyRes(oracle(plays, album, level)) });

  // Timing: 300 000 plays over 3 listeners, a 10-track album whose last track is rare.
  // Scanning forward from every start costs ~thousands of steps per start (~10⁹ in all);
  // two pointers touch each play twice.
  const seed = r.int(1, 1_000_000);
  tests.push({
    name: "300,000 plays in time",
    args: `_gen_plays(300000, 3, 10, ${r.pick([3000, 4000, 5000])}, ${seed}, ${level + 1})`,
    limit_s: 8,
  });

  return {
    vars: {
      shape_rule: level === 1
        ? "Each play is `(listener_id, track_id)`, and `plays` is already in time order."
        : level === 2
          ? "Each play is `(ts, listener_id, track_id)` with `ts` in seconds, and `plays` is in arrival order, not time order: order each listener's plays by `ts`, and keep plays with equal `ts` in arrival order."
          : "Each play is `(ts, listener_id, track_id, ms_played)` with `ts` in seconds, and `plays` is in arrival order, not time order: order each listener's plays by `ts`, and keep plays with equal `ts` in arrival order.",
      short_rule: level === 3
        ? "A play with `ms_played` under 30 000 is not a play (this exercise's rule): drop it before anything else, so it neither counts toward the album nor takes a place in the sequence. Exactly 30 000 counts."
        : "Every play counts.",
    },
    samples,
    tests,
  };
}
