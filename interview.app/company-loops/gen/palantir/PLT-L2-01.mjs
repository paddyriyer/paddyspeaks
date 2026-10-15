/* PLT-L2-01 — Sensor outliers against a rolling median (Python, heaps).
   Simulated practice scenario. All data is generated from the seed.

   Contract (python): entry, signature, starter, prelude, generate(r, level) ->
     { vars, samples: [{args, expect}], tests: [{name, args, expect?, limit_s?}] }.
   expect comes from oracle() below, which sorts a copy of each machine's window for
   every check (fine for small inputs). The evaluator's reference keeps each window
   in two heaps with lazy deletion, so each checks the other.
   level: 1 Medium (odd windows) · 2 Hard (+ even windows use the mean of the two
          middle readings, and dropouts) · 3 Very Hard (+ flagged readings are kept
          out of the window) */
export const kind = "python";
export const entry = "sensor_outliers";
export const signature = "def sensor_outliers(readings: list[tuple[str, int | None]], w: int, d: int, exclude_outliers: bool = False) -> list[int]:";
export const starter = `def sensor_outliers(readings, w, d, exclude_outliers=False):
    """readings: (machine_id, value) in time order across all machines.
    Return the positions in readings of the values that are more than d units
    from the median of the previous w readings of the same machine."""
    ...
`;

export const prelude = `
def _gen_readings(n, machines, seed, dropouts=False):
    x, out = seed, []
    names = ['press-%02d' % k for k in range(machines)]
    for _ in range(n):
        x = (1103515245 * x + 12345) % 2147483648
        k = (x >> 8) % machines
        x = (1103515245 * x + 12345) % 2147483648
        r = x >> 8
        if dropouts and r % 50 == 0:
            out.append((names[k], None))
            continue
        v = 600 + 25 * k + (r % 81) - 40
        if r % 97 == 0:
            v += 250 if (r >> 7) % 2 else -250
        out.append((names[k], v))
    return out
`.trim() + "\n";

// Sort the window for every check. Small inputs only.
export function oracle(readings, w, d, exclude) {
  const kept = new Map();               // machine -> accepted values, oldest first
  const out = [];
  readings.forEach(([m, v], i) => {
    if (v === null) return;
    if (!kept.has(m)) kept.set(m, []);
    const vals = kept.get(m);
    let bad = false;
    if (vals.length >= w) {
      const win = vals.slice(vals.length - w).sort((a, b) => a - b);
      const twice = w % 2 ? 2 * win[(w - 1) / 2] : win[w / 2 - 1] + win[w / 2];
      bad = Math.abs(2 * v - twice) > 2 * d;
      if (bad) out.push(i);
    }
    if (!(bad && exclude)) vals.push(v);
  });
  return out;
}

const pyReadings = (rs) => "[" + rs.map(([m, v]) => `('${m}', ${v === null ? "None" : v})`).join(", ") + "]";
const pyArgs = (c) => `(${pyReadings(c.rs)}, ${c.w}, ${c.d}, ${c.ex ? "True" : "False"})`;
const pyOut = (xs) => "[" + xs.join(", ") + "]";
const run = (c) => oracle(c.rs, c.w, c.d, c.ex);

const KINDS = ["press", "cnc", "pump", "kiln", "mixer", "lathe", "chiller"];

function randomCase(r, level, names) {
  for (let attempt = 0; attempt < 80; attempt++) {
    const ms = r.sample(names, r.int(2, 3));
    const w = level === 1 ? r.pick([3, 5, 7]) : r.int(3, 7);
    const d = r.int(3, 12);
    const base = new Map(ms.map((m) => [m, r.int(40, 400)]));
    const rs = [];
    const n = r.int(22, 34);
    for (let i = 0; i < n; i++) {
      const m = r.pick(ms);
      if (level >= 2 && r.chance(0.08)) { rs.push([m, null]); continue; }
      let v = base.get(m) + r.int(-d, d);
      if (r.chance(0.12)) v += r.pick([-1, 1]) * r.int(d + 1, 4 * d + 6);
      if (r.chance(0.04)) base.set(m, base.get(m) + r.pick([-1, 1]) * r.int(2 * d, 5 * d));   // a lasting shift
      rs.push([m, v]);
    }
    const c = { rs, w, d, ex: level === 3 };
    if (run(c).length >= 1) return c;
  }
  throw new Error("PLT-L2-01: could not build a sample with an outlier");
}

export function generate(r, level) {
  const kindA = r.pick(KINDS);
  const names = Array.from({ length: 5 }, (_, i) => `${kindA}-${String(r.int(1, 9) + i * 10).padStart(2, "0")}`);
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const c = randomCase(r, level, names);
    samples.push({ args: pyArgs(c), expect: pyOut(run(c)) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const ex = level === 3;
  const [A, B] = r.sample(names, 2);
  const b = r.int(100, 500);
  const d = r.int(4, 15);
  const w = r.pick([3, 5]);
  const flat = (m, k, v) => Array.from({ length: k }, () => [m, v]);
  const edges = [
    ["no readings at all", { rs: [], w, d }],
    ["exactly d away is not an outlier, d + 1 away is",
      { rs: [...flat(A, w, b), [A, b + d], [A, b - d], [A, b + d + 1], [A, b - d - 1]], w, d }],
    ["the first w readings of a machine are never checked",
      { rs: [[A, b], [A, b + 50 * d], ...flat(A, w - 2, b), [A, b - 50 * d], [A, b + 1]], w, d }],
    ["each machine is compared only with its own readings",
      { rs: [...flat(A, w, b), ...flat(B, w, b + 10 * d), [A, b + 10 * d], [B, b], [B, b + 10 * d]], w, d }],
    ["w = 1 compares a reading with the machine's previous one",
      { rs: [[A, b], [B, b + 3 * d], [A, b + d], [A, b + 2 * d + 1], [B, b + 3 * d - d - 1]], w: 1, d }],
    ["a single spike does not move the median",
      { rs: [...flat(A, w, b), [A, b + 20 * d], [A, b + 1], [A, b - 1], [A, b]], w, d }],
    [ex ? "a lasting change in level (flagged readings stay out of the window)" : "a lasting change stops being flagged once it fills half the window",
      { rs: [...flat(A, 5, b), ...flat(A, 6, b + 3 * d)], w: 5, d }],
    ["the window slides: readings older than w no longer count",
      { rs: [...flat(A, 3, b + 6 * d), ...flat(A, 3, b), [A, b + 6 * d], [A, b]], w: 3, d }],
  ];
  if (level >= 2) {
    edges.push(["an even window uses the mean of its two middle readings",
      { rs: [[A, b], [B, b], [A, b + 1], [B, b + 1], [A, b - d], [B, b + d + 1], [A, b], [B, b + d]], w: 2, d }]);
    edges.push(["an even window whose middle readings are far apart",
      { rs: [[A, b], [A, b + 2 * d], [A, b + 1], [A, b + 3 * d], [A, b - 1], [A, b + 3 * d]], w: 4, d }]);
    edges.push(["a dropout is neither checked nor counted in the window",
      { rs: [[A, b], [A, null], [A, b], [A, null], [A, null], [A, b], [A, b + 4 * d], [A, null]], w: 3, d }]);
    edges.push(["a machine that only ever drops out", { rs: [[B, null], [B, null], ...flat(A, 3, b), [A, b + 2 * d], [B, null]], w: 2, d }]);
  }
  if (level === 3) {
    edges.push(["a flagged reading is kept out of the window, so a lasting change stays flagged",
      { rs: [...flat(A, 3, b), ...flat(A, 5, b + 5 * d)], w: 3, d }]);
    edges.push(["a reading exactly d away is not flagged, so it does enter the window",
      { rs: [...flat(A, 3, b), [A, b + d], [A, b + d], [A, b + 2 * d], [A, b + 2 * d + 1]], w: 3, d }]);
    edges.push(["warm-up readings always enter the window, however far apart",
      { rs: [[A, b], [A, b + 30 * d], [A, b + 60 * d], [A, b + 30 * d], [A, b + 60 * d]], w: 3, d }]);
    edges.push(["excluding a flagged reading does not hold back the next one",
      { rs: [...flat(A, 3, b), [A, b + 9 * d], [A, b + 1], [A, b + 9 * d], [A, b - 1]], w: 3, d }]);
  }
  for (const [name, c] of edges) {
    c.ex = ex;
    tests.push({ name, args: pyArgs(c), expect: pyOut(run(c)) });
  }

  // Timing: compared with the reference at check time. One machine at one reading a
  // second with a window of about a day. Sorting each window is hopeless, and
  // bisect.insort plus a delete shifts about w/2 list entries twice per reading.
  const n = 240000;
  const tw = level === 1 ? r.pick([75001, 86401, 90001]) : r.pick([75000, 86400, 86401, 90000]);
  const seed = r.int(1, 1_000_000);
  tests.push({
    name: `${n.toLocaleString("en-US")} readings with a window of ${tw.toLocaleString("en-US")} in time`,
    args: `(_gen_readings(${n}, 1, ${seed}, ${level >= 2 ? "True" : "False"}), ${tw}, 120, ${ex ? "True" : "False"})`,
    limit_s: 8,
  });

  return {
    vars: {
      window_rule: level === 1
        ? "In this exercise `w` is odd, so the median is the middle reading of the window, and no reading is missing."
        : "`w` may be even: then the median is the mean of the two middle readings, which can end in .5, and the comparison must be exact. A value of `None` is a dropout (the sensor sent nothing): it is never checked, never flagged and never part of any window.",
      exclude_rule: level === 3
        ? "Here `exclude_outliers` is True: a flagged reading is not added to its machine's window, so the window is the previous w readings that were not flagged. Readings in the warm-up are always added."
        : "Here `exclude_outliers` is False: every reading enters its machine's window, flagged or not.",
    },
    samples,
    tests,
  };
}
