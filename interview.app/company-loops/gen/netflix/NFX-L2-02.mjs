/* NFX-L2-02 — Bitrate ladder pruning on the upper convex hull (Python, geometry).
   Simulated practice scenario. All data is generated from the seed.

   Contract (python): entry, signature, starter, prelude, generate(r, level) ->
     { vars, samples: [{args, expect}], tests: [{name, args, expect?, limit_s?}] }.
   expect comes from oracle() below, a brute force on the definition: an encode is a
   rung when nothing dominates it and no segment between an encode on its left and
   one on its right passes on or above it (O(n³) per title). Rung reduction rescans
   every interior rung after each removal. The evaluator's reference uses a monotone
   chain, so each checks the other.
   level: 1 Medium (one quality score per bitrate, every score present)
          · 2 Hard (+ duplicate encodes, same-bitrate ties, collinear points, missing scores)
          · 3 Very Hard (+ a rung budget: drop the rung whose removal loses the least area) */
export const kind = "python";
export const entry = "prune_ladder";
export const signature = "def prune_ladder(encodes: list[tuple[str, str, int, int | None]], max_rungs: int | None = None) -> dict[str, list[str]]:";
export const starter = `def prune_ladder(encodes, max_rungs=None):
    """encodes: (title_id, encode_id, bitrate_kbps, quality) where quality is an
    integer score in hundredths (0..10000) or None.
    Return {title_id: [encode_id, ...]} for each title's ladder, lowest bitrate first."""
    ...
`;

export const prelude = `
def _gen_ladders(titles, per_title, seed, with_none=False):
    x, out = seed, []
    for i in range(per_title):
        for t in range(titles):
            x = (1103515245 * x + 12345) % 2147483648
            b = 150 + (x >> 8) % 15850
            x = (1103515245 * x + 12345) % 2147483648
            c = 600 + (t * 37) % 2400
            q = max(0, 10000 * b // (b + c) - (x >> 12) % 700)
            if with_none and (x >> 4) % 97 == 0:
                q = None
            out.append(('title%05d' % t, 'e%03d' % i, b, q))
    return out
`.trim() + "\n";

// cross > 0 when p lies strictly above the line from a to c (a left of c)
const above = (a, p, c) => (c.b - a.b) * (p.q - a.q) - (c.q - a.q) * (p.b - a.b);

export function oracle(encodes, maxRungs) {
  const by = new Map();
  for (const [t, id, b, q] of encodes) {
    if (q === null) continue;
    if (!by.has(t)) by.set(t, []);
    by.get(t).push({ id, b, q });
  }
  const out = {};
  for (const [t, all] of by) {
    // exact duplicates: keep the smallest encode id
    const pts = all.filter((p) => !all.some((o) => o !== p && o.b === p.b && o.q === p.q && o.id < p.id));
    let rungs = pts.filter((p) => {
      if (pts.some((o) => o !== p && o.b <= p.b && o.q >= p.q)) return false;          // dominated
      for (const a of pts) for (const c of pts) {
        if (a.b < p.b && p.b < c.b && above(a, p, c) <= 0) return false;              // on or below a chord
      }
      return true;
    }).sort((x, y) => x.b - y.b);
    if (maxRungs != null) {
      while (rungs.length > maxRungs) {
        let best = -1, bestArea = null;
        for (let i = 1; i < rungs.length - 1; i++) {
          const area = above(rungs[i - 1], rungs[i], rungs[i + 1]);
          if (bestArea === null || area < bestArea) { best = i; bestArea = area; }   // ties: the lower bitrate (first found)
        }
        rungs = rungs.filter((_, i) => i !== best);
      }
    }
    out[t] = rungs.map((p) => p.id);
  }
  return out;
}

const pyQ = (q) => (q === null ? "None" : String(q));
const pyEnc = (es) => "[" + es.map(([t, id, b, q]) => `('${t}', '${id}', ${b}, ${pyQ(q)})`).join(", ") + "]";
const pyArgs = (c) => `(${pyEnc(c.enc)}, ${c.max == null ? "None" : c.max})`;
const pyOut = (o) => "{" + Object.keys(o).sort().map((k) => `'${k}': [` + o[k].map((x) => `'${x}'`).join(", ") + "]").join(", ") + "}";
const run = (c) => oracle(c.enc, c.max);

function titleEncodes(r, level, title, ids) {
  const c = r.int(800, 2600);
  const res = [];
  const n = r.int(6, 11);
  const used = new Set();
  for (let i = 0; i < n; i++) {
    let b = r.pick([1, 2, 5]) * 50 * r.int(2, 60);
    if (level === 1) { while (used.has(b)) b += 50; }
    used.add(b);
    const q = Math.max(0, Math.floor((10000 * b) / (b + c)) - r.int(0, 900));
    res.push([title, ids.pop(), b, q]);
  }
  if (level >= 2) {
    const dup = r.pick(res);
    res.push([title, ids.pop(), dup[2], dup[3]]);                         // an exact duplicate
    const same = r.pick(res);
    res.push([title, ids.pop(), same[2], same[3] - r.int(5, 300)]);       // same bitrate, lower score
    if (r.chance(0.6)) res.push([title, ids.pop(), r.pick(res)[2] + 50, null]);   // a failed measurement
    const [p, q2] = r.sample(res.filter((e) => e[3] !== null), 2).sort((x, y) => x[2] - y[2]);
    if (q2[2] > p[2] + 100 && (q2[2] - p[2]) % 2 === 0 && (q2[3] - p[3]) % 2 === 0)
      res.push([title, ids.pop(), (p[2] + q2[2]) / 2, (p[3] + q2[3]) / 2]); // a midpoint, exactly collinear
  }
  return r.shuffle(res);
}

export function generate(r, level) {
  const pool = r.shuffle(Array.from({ length: 900 }, (_, i) => "e" + String(i + 100)));
  const names = r.sample(["t20117", "t31402", "t40995", "t52260", "t66013", "t71388", "t80421"], 7);
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const k = 2 + (i % 2);
    let enc = [];
    for (let j = 0; j < k; j++) enc = enc.concat(titleEncodes(r, level, names[(i * 2 + j) % names.length], pool));
    enc = r.shuffle(enc);
    const c = { enc, max: level === 3 ? r.int(2, 4) : null };
    samples.push({ args: pyArgs(c), expect: pyOut(run(c)) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const T = r.pick(["t11110", "t24680", "t35791"]);
  const U = r.pick(["t90001", "t90517"]);
  const k = r.int(1, 3);                         // bitrate scale, so the numbers differ per seed
  const e = (id, b, q, t = T) => [t, id, b * k, q];
  const edges = [
    ["a single encode is a one-rung ladder", [e("e101", 1000, 4000)]],
    ["an encode exactly on the line between its neighbours is not a rung",
      [e("e101", 1000, 3000), e("e102", 2000, 4000), e("e103", 3000, 5000)]],
    ["an encode one point above that line is a rung",
      [e("e101", 1000, 3000), e("e102", 2000, 4001), e("e103", 3000, 5000)]],
    ["an encode below a chord is dropped",
      [e("e101", 1000, 3000), e("e102", 2000, 3500), e("e103", 3000, 5000), e("e104", 4000, 5600)]],
    ["a costlier encode with a lower score is dropped",
      [e("e101", 1000, 4000), e("e102", 1500, 3900), e("e103", 2500, 6000)]],
    ["two encodes at one bitrate: only the higher score can be a rung",
      [e("e101", 1000, 4000), e("e102", 2000, 5200), e("e103", 2000, 6000), e("e104", 4000, 7000)]],
    ["the lowest bitrate that reaches the best score ends the ladder",
      [e("e101", 1000, 4000), e("e102", 3000, 8000), e("e103", 5000, 8000), e("e104", 6000, 7800)]],
    ["titles are pruned independently, whatever the input order",
      [e("e101", 1000, 3000), e("e201", 1000, 5000, U), e("e102", 2000, 4000), e("e202", 2000, 5500, U), e("e103", 3000, 5000), e("e203", 3000, 5600, U)]],
  ];
  if (level >= 2) {
    edges.push(["exact duplicates keep the smallest encode id (as a string)",
      [e("e417", 1000, 3000), e("e1032", 1000, 3000), e("e212", 2500, 6000), e("e090", 2500, 6000)]]);
    edges.push(["an encode with no score is ignored",
      [e("e101", 1000, 3000), e("e102", 1500, null), e("e103", 2000, 5000)]]);
    edges.push(["a title whose encodes all lack a score is left out",
      [e("e101", 1000, 3000), e("e201", 1000, null, U), e("e202", 2000, null, U)]]);
    edges.push(["three collinear encodes in a longer ladder",
      [e("e101", 500, 2000), e("e102", 1000, 4000), e("e103", 2000, 6000), e("e104", 3000, 8000), e("e105", 4000, 8500)]]);
  }
  for (const [name, enc] of edges) tests.push({ name, args: pyArgs({ enc, max: null }), expect: pyOut(run({ enc, max: null })) });
  if (level === 3) {
    const ladder = [e("e101", 500, 2000), e("e102", 1000, 4000), e("e103", 1500, 5300), e("e104", 2500, 6800), e("e105", 4000, 8000), e("e106", 6000, 8600)];
    const l3 = [
      ["a budget at least the ladder's length changes nothing", { enc: ladder, max: 6 }],
      ["the rung that loses the least area goes first", { enc: ladder, max: 5 }],
      ["neighbours change after each removal", { enc: ladder, max: 3 }],
      ["a budget of 2 keeps only the two ends", { enc: ladder, max: 2 }],
      ["equal areas: the lower bitrate rung goes",
        { enc: [e("e101", 500, 1000), e("e102", 1500, 4000), e("e103", 2500, 6000), e("e104", 3500, 7000)], max: 3 }],
      ["the budget applies to each title separately",
        { enc: ladder.concat([e("e201", 800, 5000, U), e("e202", 1600, 6500, U), e("e203", 3200, 7500, U)]), max: 3 }],
    ];
    for (const [name, c] of l3) tests.push({ name, args: pyArgs(c), expect: pyOut(run(c)) });
  }

  // Timing: compared with the reference at check time. The encodes of 12 000 titles
  // arrive interleaved; grouping once is linear, while scanning the whole list per
  // title or testing every chord per encode is far too slow.
  const seed = r.int(1, 1_000_000);
  tests.push({
    name: "360,000 encodes across 12,000 titles in time",
    args: `(_gen_ladders(12000, 30, ${seed}, ${level >= 2 ? "True" : "False"}), ${level === 3 ? 6 : "None"})`,
    limit_s: 8,
  });

  return {
    vars: {
      budget_rule: level === 3
        ? "Players handle only a few rungs, so `max_rungs` may be set (always at least 2). While a title's ladder has more than `max_rungs` rungs, remove the interior rung (never the first or the last) whose removal loses the least area under the ladder: the area of the triangle it forms with its current neighbours. Break a tie by removing the rung with the lower bitrate. Neighbours change after each removal."
        : "In this exercise `max_rungs` is None: return the whole ladder.",
    },
    samples,
    tests,
  };
}
