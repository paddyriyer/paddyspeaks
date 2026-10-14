/* UBR-L1-05 — Fares from a trip's pings: time and distance across surge windows (Python).
   Simulated practice scenario. All data and the fare rules are hypothetical.

   Contract: see docs/COMPANY-INTERVIEW-LOOPS.md § Executable templates (python).
   Each interval between consecutive pings is charged
     multiplier/100 * (seconds * per_minute / 60 + metres * per_km / 1000)  cents,
   at the multiplier of the surge window containing the interval's START (half-open
   windows, 100 outside any window). metered = base + the exact sum, rounded once to the
   cent, half up. fare = max(metered, minimum); tolls (distinct toll_id, inside the trip)
   and the booking fee are added after the minimum and are never surged.
   The oracle keeps everything in integers (units of 1/300000 cent) and scans every
   window per interval; the evaluator's reference bisects sorted windows, written
   independently.
   level: 1 Medium (sorted windows, one row per toll)
          2 Hard (+ windows in any order, pings exactly on window edges, tolls logged twice)
          3 Very Hard (+ odometer glitches that read lower than before, and toll events
                       outside the trip's first and last ping) */
export const kind = "python";
export const entry = "fares";
export const signature = "def fares(trips: list[tuple[str, list[tuple[int, int]], list[tuple[str, int, int]]]], rates: dict[str, int], surges: list[tuple[int, int, int]]) -> dict[str, tuple[int, int, int]]:";
export const starter = `def fares(trips, rates, surges):
    """trips:  (trip_id, pings, tolls); pings are (t_s, odometer_m) in time order,
            tolls are (toll_id, t_s, cents).
    rates:  {'base', 'per_minute', 'per_km', 'minimum', 'booking_fee'}, all in cents.
    surges: (start_s, end_s, multiplier_pct), half-open, never overlapping.
    Return {trip_id: (fare_cents, tolls_cents, total_cents)}."""
    ...
`;

export const prelude = `
def _gen_day(n_trips, n_pings, seed, glitches=False):
    x = seed
    def rnd(m):
        nonlocal x
        x = (1103515245 * x + 12345) % 2147483648
        return (x >> 8) % m
    surges, t = [], 0
    while t < 86400:                                     # a day of 30-second windows, some unsurged
        if rnd(3):
            surges.append((t, t + 30, 100 + 5 * rnd(31)))
        t += 30
    surges.reverse()
    trips = []
    for i in range(n_trips):
        t, odo, pings = rnd(80000), 0, []
        for _ in range(n_pings):
            pings.append((t, odo))
            t += 1 + rnd(8)
            odo += rnd(120) if not glitches or rnd(20) else -rnd(30)
        tolls = [('toll_%d' % rnd(4), pings[rnd(n_pings)][0], 150 + rnd(500)) for _ in range(rnd(3))]
        trips.append(('trip_%05d' % i, pings, tolls))
    rates = {'base': 250, 'per_minute': 35, 'per_km': 95, 'minimum': 700, 'booking_fee': 185}
    return trips, rates, surges
`.trim() + "\n";

const DEN = 300000;   // one cent = 300000 units; m*(50*dt*pm + 3*dm*pk) is in units

// Literal specification, integers only.
export function oracle(trips, rates, surges, highWater) {
  const out = {};
  for (const [id, pings, tolls] of trips) {
    let units = rates.base * DEN;
    let hw = pings.length ? pings[0][1] : 0;
    for (let i = 0; i + 1 < pings.length; i++) {
      const [t0, o0] = pings[i];
      const [t1, o1] = pings[i + 1];
      let m = 100;
      for (const [s, e, mm] of surges) if (s <= t0 && t0 < e) m = mm;
      let dm;
      if (highWater) { dm = Math.max(0, o1 - hw); hw = Math.max(hw, o1); }
      else dm = o1 - o0;
      units += m * (50 * (t1 - t0) * rates.per_minute + 3 * dm * rates.per_km);
    }
    const metered = Math.floor((2 * units + DEN) / (2 * DEN));
    const fare = Math.max(metered, rates.minimum);
    const tFirst = pings[0][0], tLast = pings[pings.length - 1][0];
    const seen = new Map();
    for (const [tid, t, c] of tolls) if (t >= tFirst && t <= tLast && !seen.has(tid)) seen.set(tid, c);
    const tollSum = [...seen.values()].reduce((a, b) => a + b, 0);
    out[id] = [fare, tollSum, fare + rates.booking_fee + tollSum];
  }
  return out;
}

const pyOut = (o) => "{" + Object.entries(o).map(([k, [a, b, c]]) => `'${k}': (${a}, ${b}, ${c})`).join(", ") + "}";
const pyRates = (rt) => "{" + ["base", "per_minute", "per_km", "minimum", "booking_fee"].map((k) => `'${k}': ${rt[k]}`).join(", ") + "}";
const pyArgs = (trips, rates, surges) =>
  "([" + trips.map(([id, pings, tolls]) =>
    `('${id}', [${pings.map(([t, o]) => `(${t}, ${o})`).join(", ")}], [${tolls.map(([tid, t, c]) => `('${tid}', ${t}, ${c})`).join(", ")}])`).join(", ") +
  `], ${pyRates(rates)}, [${surges.map(([s, e, m]) => `(${s}, ${e}, ${m})`).join(", ")}])`;

function makeRates(r) {
  return { base: r.pick([150, 200, 250, 275]), per_minute: r.pick([20, 25, 30, 35, 45]), per_km: r.pick([80, 90, 95, 110, 125]), minimum: r.pick([500, 600, 700, 800]), booking_fee: r.pick([150, 185, 210, 245]) };
}

function randomCase(r, level) {
  const rates = makeRates(r);
  const surges = [];
  let t = 1000 + r.int(0, 200);
  for (let i = 0; i < 4; i++) {
    const s = t + r.int(0, 120), e = s + r.int(60, 300);
    surges.push([s, e, r.pick([110, 125, 135, 150, 175, 200, 240])]);
    t = e;
  }
  const trips = [];
  for (let k = 0; k < r.int(2, 3); k++) {
    let tt = 900 + r.int(0, 800), odo = r.int(0, 5000);
    const pings = [];
    for (let i = 0; i < r.int(3, 7); i++) {
      pings.push([tt, odo]);
      tt += r.int(15, 180);
      odo += level === 3 && r.chance(0.2) ? -r.int(5, 60) : r.int(0, 1500);
    }
    if (level >= 2 && r.chance(0.5)) pings[1][0] = Math.max(pings[1][0], pings[0][0] + 1);
    const tolls = [];
    if (r.chance(0.6)) {
      const tid = "toll_" + r.pick(["bay_bridge", "ring_road", "airport", "tunnel_4"]);
      tolls.push([tid, pings[r.int(0, pings.length - 1)][0], r.int(150, 900)]);
      if (level >= 2 && r.chance(0.5)) tolls.push([tid, tolls[0][1] + r.int(0, 30), tolls[0][2]]);
      if (level === 3 && r.chance(0.5)) tolls.push(["toll_after", pings[pings.length - 1][0] + r.int(1, 900), r.int(150, 900)]);
    }
    trips.push(["trip_" + String.fromCharCode(97 + k) + r.int(10, 99), pings, tolls]);
  }
  return { trips, rates, surges: level >= 2 ? r.shuffle(surges) : surges };
}

export function generate(r, level) {
  const hw = level === 3;
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const c = randomCase(r, level);
    samples.push({ args: pyArgs(c.trips, c.rates, c.surges), expect: pyOut(oracle(c.trips, c.rates, c.surges, hw)) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const t0 = r.int(20, 60) * 100;
  const S = [t0 + 600, t0 + 1200, r.pick([125, 150, 175, 200])];
  const rt = { base: 200, per_minute: r.pick([25, 35, 45]), per_km: r.pick([90, 110]), minimum: 600, booking_fee: r.pick([150, 210]) };
  const rt24 = { ...rt, per_minute: 24 };
  const trip = (pings, tolls = []) => [["trip_x", pings, tolls]];
  const edges = [
    // per_minute is an odd multiple of 5: 6 seconds is exactly half a cent more.
    ["half a cent rounds up (Python's round() rounds half to even)", trip([[t0, 0], [t0 + 6, 0], [t0 + 7206, 0]]), rt, []],
    ["round once at the end, never per interval", trip([[t0, 0], [t0 + 1, 0], [t0 + 2, 0], [t0 + 3, 0], [t0 + 1000, 9000]]), rt24, []],
    ["the multiplier is the one at the interval's start (half-open windows)",
      trip([[S[0] - 60, 0], [S[0], 500], [S[1] - 30, 4000], [S[1], 4600], [S[1] + 300, 7000]]), rt, [S]],
    ["the base fare is not surged", trip([[S[0], 0], [S[0] + 400, 6000]]), rt, [S]],
    ["a short trip pays the minimum; booking fee and tolls come on top", trip([[t0, 0], [t0 + 90, 400]], [["toll_bridge", t0 + 30, 350]]), rt, []],
    ["a trip with one ping is the base fare, then the minimum", trip([[t0, 1234]]), rt, []],
  ];
  if (level >= 2) {
    edges.push(["windows arrive in any order", trip([[t0, 0], [t0 + 100, 900], [t0 + 250, 2000], [t0 + 400, 3800], [t0 + 900, 7000]]), rt,
      [[t0 + 400, t0 + 900, 150], [t0, t0 + 100, 200], [t0 + 100, t0 + 250, 125]]]);
    edges.push(["a toll logged twice is charged once", trip([[t0, 0], [t0 + 600, 8000]], [["toll_ring", t0 + 100, 425], ["toll_ring", t0 + 104, 425]]), rt, []]);
  }
  if (level === 3) {
    edges.push(["an odometer reading that goes backwards adds no distance, and the next one is measured from the highest so far",
      trip([[t0, 1000], [t0 + 60, 1800], [t0 + 120, 1750], [t0 + 180, 2300], [t0 + 600, 6000]]), rt, []]);
    edges.push(["a toll after the last ping is not part of the trip", trip([[t0, 0], [t0 + 600, 8000]], [["toll_tunnel", t0 + 600, 300], ["toll_bridge", t0 + 601, 500]]), rt, []]);
  }
  for (const [name, trips, rates, surges] of edges) tests.push({ name, args: pyArgs(trips, rates, surges), expect: pyOut(oracle(trips, rates, surges, hw)) });

  // Timing: a day of 30-second surge windows (about 1 900 of them) and 5 000 trips of 100 pings.
  // Scanning the windows for each of the ~500 000 intervals is ~10^9 steps.
  tests.push({
    name: "5,000 trips x 100 pings against ~1,900 surge windows (sort once, bisect)",
    args: `_gen_day(5000, 100, ${r.int(1, 1_000_000)}, ${hw ? "True" : "False"})`,
    limit_s: 8,
  });

  return {
    vars: {
      window_rule: level === 1
        ? "In this exercise `surges` is sorted by start time and each toll appears once."
        : "`surges` can arrive in any order, and a phone that retries can report the same toll crossing twice (the same `toll_id`): a toll is charged once per `toll_id` per trip.",
      odo_rule: level === 3
        ? "GPS odometers glitch: a reading lower than the highest reading so far adds no distance, and distance resumes from that highest reading (a high-water mark). Toll events outside the trip, before its first ping or after its last, are not part of it."
        : "Odometer readings never decrease in this exercise, and every toll event lies within its trip.",
    },
    samples,
    tests,
  };
}
