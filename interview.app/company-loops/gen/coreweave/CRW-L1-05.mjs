/* CRW-L1-05 — Burst stretch: the run of consecutive hours in which a customer's usage
   most exceeded its reservation, in net (Python, Kadane).
   Simulated practice scenario. All data is generated from the seed; reservations and
   usage are hypothetical.

   Contract (python): entry, signature, starter, prelude, generate(r, level) ->
     { vars, samples: [{args, expect}], tests: [{name, args, expect?, limit_s?}] }.
   expect comes from oracle() below, which tries every start and end (small inputs
   only) with the tie rule written out; the evaluator's reference is one pass, so
   each checks the other.
   level: 1 Medium (one reservation level for the whole period) · 2 Hard (+ reservation
          steps that ramp up and down, and hours before the first step with nothing
          reserved) · 3 Very Hard (+ hours with no meter reading, which a run cannot
          include) */
export const kind = "python";
export const entry = "burst_stretch";
export const signature = "def burst_stretch(usage: list[int], reservation: list[tuple[int, int]]) -> tuple[int, int, int] | None:";
export const starter = `def burst_stretch(usage, reservation):
    """usage[h]: GPU-hours used in hour h (-1: no meter reading for that hour).
    reservation: (from_hour, gpus) steps sorted by from_hour; a step holds until
    the next one, and hours before the first step have 0 GPUs reserved.
    Return (start_hour, end_hour, net) for the run of consecutive hours with the
    largest total of usage - reserved; ties: the shortest run, then the earliest.
    Return None if no hour's usage exceeds its reservation."""
    ...
`;

export const prelude = `
def _gen_usage(n, n_steps, seed, missing=0):
    x = seed

    def nxt():
        nonlocal x
        x = (1103515245 * x + 12345) % 2147483648
        return x >> 8
    reservation = []
    step = n // n_steps
    for k in range(n_steps):
        reservation.append((k * step, 256 + nxt() % 512))
    usage = []
    k = 0
    for h in range(n):
        while k + 1 < n_steps and reservation[k + 1][0] <= h:
            k += 1
        usage.append(max(0, reservation[k][1] + nxt() % 81 - 40))
    for _ in range(missing):
        usage[nxt() % 1000] = -1
    return usage, reservation
`.trim() + "\n";

// Every start and end, the tie rule spelled out. Small inputs only.
export function oracle(usage, reservation) {
  const n = usage.length;
  const reserved = (h) => {
    let g = 0;
    for (const [from, gpus] of reservation) if (from <= h) g = gpus;
    return g;
  };
  let best = null;
  for (let i = 0; i < n; i++) {
    let sum = 0;
    for (let j = i; j < n; j++) {
      if (usage[j] < 0) break;                       // a missing hour ends every run through it
      sum += usage[j] - reserved(j);
      if (!best || sum > best[2] || (sum === best[2] && (j - i < best[1] - best[0] || (j - i === best[1] - best[0] && i < best[0])))) best = [i, j, sum];
    }
  }
  if (!best || best[2] <= 0) return null;            // positive iff some hour has net > 0
  return best;
}

const pyArgs = (c) => `([${c.usage.join(", ")}], [${c.reservation.map(([a, b]) => `(${a}, ${b})`).join(", ")}])`;
const pyOut = (x) => (x === null ? "None" : `(${x.join(", ")})`);
const run = (c) => oracle(c.usage, c.reservation);

function randomCase(r, level) {
  for (let attempt = 0; attempt < 100; attempt++) {
    const n = r.int(24, 40);
    const reservation = [];
    if (level === 1) reservation.push([0, r.int(8, 40) * 8]);
    else {
      let h = r.chance(0.5) ? 0 : r.int(1, 4);
      for (let k = 0; k < r.int(2, 4); k++) {
        reservation.push([h, r.int(8, 40) * 8]);
        h += r.int(5, 12);
        if (h >= n) break;
      }
    }
    const usage = [];
    for (let h = 0; h < n; h++) {
      let g = 0;
      for (const [from, gpus] of reservation) if (from <= h) g = gpus;
      usage.push(Math.max(0, g + r.int(-30, 12)));
    }
    const at = r.int(2, n - 8);
    for (let h = at; h < at + r.int(2, 6); h++) usage[h] += r.int(10, 60);   // a burst
    if (level === 3) for (let k = 0; k < r.int(1, 3); k++) usage[r.int(0, n - 1)] = -1;
    const c = { usage, reservation };
    const out = run(c);
    if (out && out[1] > out[0]) return c;
  }
  throw new Error("CRW-L1-05: could not build a sample");
}

export function generate(r, level) {
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const c = randomCase(r, level);
    samples.push({ args: pyArgs(c), expect: pyOut(run(c)) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const g = r.int(8, 40) * 8;
  const edges = [
    ["never above the reservation", { usage: [g - 3, g, g - 10, g], reservation: [[0, g]] }],
    ["usage exactly at the reservation is not a burst", { usage: [g, g, g], reservation: [[0, g]] }],
    ["every hour above", { usage: [g + 2, g + 5, g + 1], reservation: [[0, g]] }],
    ["a single hour", { usage: [g, g - 4, g + 9, g - 1], reservation: [[0, g]] }],
    ["a small dip worth bridging", { usage: [g + 5, g - 2, g + 5, g - 9], reservation: [[0, g]] }],
    ["a dip too deep to bridge: equal runs, the earlier", { usage: [g + 5, g - 6, g + 5], reservation: [[0, g]] }],
    ["equal net, the shorter run wins", { usage: [g + 3, g + 3, g - 9, g + 6, g - 1], reservation: [[0, g]] }],
    ["zero-net hours around a burst are left out", { usage: [g, g, g + 7, g + 1, g, g], reservation: [[0, g]] }],
    ["the burst at the very end", { usage: [g - 1, g - 2, g + 3, g + 8], reservation: [[0, g]] }],
  ];
  if (level >= 2) {
    edges.push(["hours before the first step have nothing reserved", { usage: [12, 0, g, g + 1], reservation: [[2, g]] }]);
    edges.push(["a step up ends the burst", { usage: [g + 4, g + 4, g + 40, g + 40], reservation: [[0, g], [2, g + 64]] }]);
    edges.push(["a step down starts one", { usage: [g - 8, g - 8, g - 8, g - 8], reservation: [[0, g], [2, g - 16]] }]);
  }
  if (level === 3) {
    edges.push(["a missing hour splits a run", { usage: [g + 5, g + 5, -1, g + 6, g - 1], reservation: [[0, g]] }]);
    edges.push(["a missing hour is not a zero", { usage: [g + 9, -1, g + 2, g - 1, g + 4], reservation: [[0, g]] }]);
    edges.push(["only missing hours and quiet hours", { usage: [-1, g, -1, g - 2], reservation: [[0, g]] }]);
  }
  for (const [name, c] of edges) tests.push({ name, args: pyArgs(c), expect: pyOut(run(c)) });

  // Timing: compared with the reference at check time. Six years of hourly usage;
  // every start and end with prefix sums is about 1.4 x 10^9 pairs.
  const seed = r.int(1, 1_000_000);
  tests.push({
    name: "six years of hourly usage (52,560 hours) in time",
    args: `_gen_usage(52560, ${level === 1 ? 1 : 105}, ${seed}, ${level === 3 ? 6 : 0})`,
    limit_s: 8,
  });

  return {
    vars: {
      reservation_rule: level === 1
        ? "In this exercise `reservation` has one step, `(0, gpus)`: the same reservation for the whole period."
        : "`reservation` has several steps as the contract ramps up and down. The first step can start after hour 0; hours before it have 0 GPUs reserved, so all their usage is on demand.",
      missing_rule: level === 3
        ? "`usage[h]` is `-1` when the meter sent no reading for that hour. A run cannot include such an hour: it is not zero usage, it is unknown."
        : "Every hour has a reading.",
    },
    samples,
    tests,
  };
}
