/* GOO-L2-01 — Earliest arrival over time-dependent road segments (Python).
   Simulated practice scenario. All data is generated from the seed.

   Contract (python): entry, signature, starter, prelude, generate(r, level) ->
     { vars, samples: [{args, expect}], tests: [{name, args, expect?, limit_s?}] }.
   expect comes from oracle() below: a minute-by-minute simulation of the road
   network (a time-expanded search), which needs no Dijkstra and no reasoning about
   when to wait. The evaluator's reference is a time-dependent Dijkstra written
   independently.
   level: 1 Medium (mild traffic profiles) · 2 Hard (rush-hour jams where waiting
          beats driving, more junctions) · 3 Very Hard (+ closures: a segment that
          cannot be entered during a bucket, some closed for good) */
export const kind = "python";
export const entry = "earliest_arrival";
export const signature = "def earliest_arrival(segments: list[tuple[str, str, list[int | None]]], source: str, target: str, depart: int, bucket_min: int) -> int | None:";
export const starter = `def earliest_arrival(segments, source, target, depart, bucket_min):
    """segments: (from_junction, to_junction, profile). profile[j] is the travel
    time in whole minutes for a car that ENTERS the segment during bucket j, i.e.
    at a minute t with min(t // bucket_min, len(profile) - 1) == j; None means the
    segment cannot be entered during that bucket.
    You may wait at a junction. Return the earliest minute you can be at target,
    or None if it cannot be reached."""
    ...
`;

export const prelude = `
def _gen_roads(n, m, h, seed):
    x = seed
    def nxt():
        nonlocal x
        x = (1103515245 * x + 12345) % 2147483648
        return x >> 4                            # 27 bits: enough for any junction index
    pool = []
    for _ in range(64):                          # 64 shared profiles: free-flow, peaks, jams
        base = 2 + nxt() % 12
        peak = nxt() % h
        width = 1 + nxt() % 4
        pool.append([base * (1 + 3 * (abs(j - peak) < width)) + nxt() % 3 for j in range(h)])
    names = ['j%05d' % i for i in range(n)]
    out = []
    for i in range(n - 1):                       # a spine so every junction is reachable
        out.append((names[i], names[i + 1], pool[nxt() % 64]))
    for _ in range(m - (n - 1)):
        a = nxt() % n
        span = 2000 if nxt() % 20 == 0 else 50   # mostly local roads, a few arterials
        b = (a + 1 + nxt() % span) % n
        out.append((names[a], names[b], pool[nxt() % 64]))
    return out
`.trim() + "\n";

// Minute-by-minute simulation. Waiting is free, so a junction reached at minute e is
// available at every minute >= e. After the last bucket every profile is constant,
// so a reachable target is reached within (junctions) * (max travel + 1) minutes.
export function oracle(segs, source, target, depart, B) {
  if (source === target) return depart;
  const H = segs.length ? segs[0][2].length : 1;
  let maxtt = 1;
  const nodes = new Set([source, target]);
  for (const [a, b, p] of segs) {
    nodes.add(a); nodes.add(b);
    for (const v of p) if (v !== null && v > maxtt) maxtt = v;
  }
  const horizon = Math.max(depart, H * B) + nodes.size * (maxtt + 1) + 1;
  const earliest = new Map([[source, depart]]);
  for (let t = depart; t <= horizon; t++) {
    for (const [a, b, p] of segs) {
      const e = earliest.get(a);
      if (e === undefined || e > t) continue;
      const tt = p[Math.min(Math.floor(t / B), H - 1)];
      if (tt === null) continue;
      const arr = t + tt;
      const cur = earliest.get(b);
      if (cur === undefined || arr < cur) earliest.set(b, arr);
    }
  }
  return earliest.has(target) ? earliest.get(target) : null;
}

const pyOut = (v) => (v === null ? "None" : String(v));
const pyProf = (p) => "[" + p.map((v) => (v === null ? "None" : String(v))).join(", ") + "]";
const pyArgs = (segs, s, t, depart, B) =>
  `([${segs.map(([a, b, p]) => `('${a}', '${b}', ${pyProf(p)})`).join(", ")}], '${s}', '${t}', ${depart}, ${B})`;

const STREETS = ["main", "oak", "elm", "pine", "lake", "hill", "park", "mill", "bay", "ridge", "river", "cedar", "maple", "grove", "bridge", "harbor"];

function profile(r, level, H) {
  const base = r.int(3, 18);
  const p = [];
  for (let j = 0; j < H; j++) p.push(base + r.int(0, 3));
  if (level >= 2 && r.chance(0.6)) {               // a rush-hour jam over one or two buckets
    const at = r.int(0, H - 2);
    const len = r.int(1, 2);
    const mult = r.int(3, 6);
    for (let j = at; j < Math.min(H, at + len); j++) p[j] = base * mult + r.int(0, 5);
  }
  if (level === 3 && r.chance(0.35)) {             // a closure; sometimes in the last bucket (closed for good)
    const at = r.chance(0.3) ? H - 1 : r.int(0, H - 2);
    p[at] = null;
  }
  return p;
}

function smallCase(r, level, H, B) {
  for (let attempt = 0; attempt < 80; attempt++) {
    const n = level === 1 ? r.int(4, 5) : level === 2 ? r.int(5, 7) : r.int(6, 8);
    const names = r.sample(STREETS, n);
    const segs = [];
    const m = level === 1 ? r.int(6, 8) : level === 2 ? r.int(9, 12) : r.int(11, 15);
    for (let i = 0; i < m; i++) {
      const a = r.pick(names), b = r.pick(names);
      if (a !== b) segs.push([a, b, profile(r, level, H)]);
    }
    const source = names[0], target = names[n - 1];
    const depart = r.int(0, H * B - 1);
    const shuffled = r.shuffle(segs);
    const got = oracle(shuffled, source, target, depart, B);
    if (got !== null) return { segs: shuffled, source, target, depart, got };
  }
  throw new Error("GOO-L2-01: could not build a reachable sample");
}

export function generate(r, level) {
  const samples = [];
  const H = level === 1 ? 4 : level === 2 ? 6 : 8;
  const B = level === 1 ? 15 : r.pick([10, 15, 20]);
  for (let i = 0; i < 3; i++) {
    const c = smallCase(r, level, H, B);
    samples.push({ args: pyArgs(c.segs, c.source, c.target, c.depart, B), expect: pyOut(c.got) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const [s, a, b, t] = r.sample(STREETS, 4);
  const flat = (v) => Array.from({ length: H }, () => v);
  const withAt = (v, j, w) => { const p = flat(v); p[j] = w; return p; };
  const jam = r.int(40, 70), clear = r.int(4, 9);
  const edges = [
    ["waiting at the junction for the jam to clear beats entering now",
      [[s, t, withAt(clear, 0, jam)]], s, t, B - r.int(2, 5), B],
    ["entering exactly at a bucket boundary uses the new bucket's time",
      [[s, t, withAt(r.int(25, 35), 0, 2)]], s, t, B, B],
    ["source equals target: already there", [[s, a, flat(5)], [a, s, flat(5)]], s, s, r.int(0, B * H), B],
    ["departing after the last bucket keeps the last bucket's times",
      [[s, a, withAt(6, H - 1, 11)], [a, t, withAt(6, H - 1, 13)]], s, t, H * B + r.int(1, 30), B],
    ["no road reaches the target", [[s, a, flat(5)], [t, s, flat(5)]], s, t, 0, B],
    ["the shortest road at free flow is jammed; the long way wins",
      [[s, t, withAt(12, 0, 80)], [s, a, flat(6)], [a, b, flat(6)], [b, t, flat(6)]], s, t, 0, B],
  ];
  if (level >= 2) {
    edges.push(["reaching the jammed segment later, after it clears, is best",
      [[s, a, flat(B)], [a, t, withAt(5, 0, 90)], [s, t, flat(B * 2 + 30)]], s, t, 0, B]);
  }
  if (level === 3) {
    edges.push(["closed now, open in the next bucket: wait at the junction",
      [[s, t, withAt(7, 0, null)]], s, t, r.int(1, B - 1), B]);
    edges.push(["closed in the last bucket means closed for good",
      [[s, t, withAt(4, H - 1, null)]], s, t, H * B + 5, B]);
    edges.push(["a closure on the direct road sends you round",
      [[s, t, flat(null).map((v, j) => (j === H - 1 ? 3 : null))], [s, a, flat(9)], [a, t, flat(9)]], s, t, 0, B]);
  }
  for (const [name, q, src, tgt, dep, bk] of edges) tests.push({ name, args: pyArgs(q, src, tgt, dep, bk), expect: pyOut(oracle(q, src, tgt, dep, bk)) });

  // Timing: tens of thousands of junctions, a day of hourly buckets. Time-dependent
  // Dijkstra is near-linear; a minute-by-minute simulation or Bellman-Ford is not.
  const n = level === 1 ? 40000 : level === 2 ? 50000 : 60000;
  const m = level === 1 ? 120000 : level === 2 ? 150000 : 180000;
  const seed = r.int(1, 1_000_000);
  const depart = r.int(0, 23) * 60 + r.int(0, 59);
  tests.push({
    name: `${n.toLocaleString("en-US")} junctions, ${m.toLocaleString("en-US")} segments, 24 hourly buckets`,
    args: `(_gen_roads(${n}, ${m}, 24, ${seed}), 'j00000', 'j${String(n - 1).padStart(5, "0")}', ${depart}, 60)`,
    limit_s: 8,
  });

  return {
    vars: {
      traffic_rule: level === 1
        ? "Traffic in this replay is mild: travel times change a little from bucket to bucket."
        : level === 2
          ? "Profiles include rush-hour jams: entering a segment one minute later can save half an hour."
          : "Profiles include rush-hour jams and closures: `None` in a profile means the segment cannot be entered during that bucket, and a segment closed in the last bucket stays closed.",
      bucket_rule: `In the samples a bucket is ${B} minutes and a profile has ${H} buckets.`,
    },
    samples,
    tests,
  };
}
