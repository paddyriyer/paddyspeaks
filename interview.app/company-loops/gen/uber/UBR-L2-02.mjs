/* UBR-L2-02 — Cheapest insertion of a new rider into a shared ride (Python, routing).
   Simulated practice scenario. All data is generated from the seed.

   Contract (python): entry, signature, starter, prelude, generate(r, level) ->
     { vars, samples: [{args, expect}], tests: [{name, args, expect?, limit_s?}] }.
   expect comes from oracle() below: it builds every candidate route (each pickup
   position, each later drop-off position) and simulates it stop by stop, which is
   cubic and fine for small inputs. The evaluator's reference checks each pair in
   constant time from prefix and suffix arrays, so each checks the other.
   level: 1 Medium (capacity and the new rider's wait and ride limits) · 2 Hard
          (+ latest-arrival limits on the stops already promised) · 3 Very Hard
          (+ parties of several seats and a dwell time at every stop) */
export const kind = "python";
export const entry = "insert_rider";
export const signature = "def insert_rider(start: tuple[int, int], onboard: int, capacity: int, stops: list[tuple[str, str, int, int, int | None, int]], pickup: tuple[int, int], dropoff: tuple[int, int], max_wait: int, max_ride: int, seats: int = 1, dwell: int = 0) -> tuple[int, int, int] | None:";
export const starter = `def insert_rider(start, onboard, capacity, stops, pickup, dropoff,
                 max_wait, max_ride, seats=1, dwell=0):
    """stops: the driver's planned stops, in order, as
    (rider, kind, x, y, latest, seats) with kind 'pickup' or 'dropoff'.
    Return (added_seconds, pickup_index, dropoff_index) for the cheapest feasible
    insertion of the new rider, or None if there is none."""
    ...
`;

export const prelude = `
def _gen_route(n, capacity, seats_max, dwell, seed):
    x = seed
    def nxt():
        nonlocal x
        x = (1103515245 * x + 12345) % 2147483648
        return x >> 8
    start = (nxt() % 2000, nxt() % 2000)
    pos, t, load, stops, riding, rid = start, 0, 0, [], [], 0
    for _ in range(min(2, capacity)):                       # riders already in the car
        riding.append(('on%d' % rid, 1)); rid += 1; load += 1
    onboard = load
    while len(stops) < n:
        want_pick = len(stops) + len(riding) < n and (not riding or nxt() % 2 == 0)
        size = 1 + nxt() % seats_max
        if want_pick and load + size <= capacity:
            name, kind = 'r%d' % rid, 'pickup'
            riding.append((name, size)); rid += 1; load += size
        elif riding:
            name, size = riding.pop(nxt() % len(riding))
            kind = 'dropoff'; load -= size
        else:
            continue
        loc = (nxt() % 2000, nxt() % 2000)
        t += abs(loc[0] - pos[0]) + abs(loc[1] - pos[1])
        latest = None if nxt() % 3 == 0 else t + 20000 + nxt() % 20000
        stops.append((name, kind, loc[0], loc[1], latest, size))
        t += dwell
        pos = loc
    return start, onboard, stops
`.trim() + "\n";

const dist = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);

// Simulate one route: { ok, finish, aP, aD }. Stops are {loc, kind, latest, seats, isNew}.
function simulate(start, onboard, capacity, route, dwell) {
  let pos = start, t = 0, load = onboard, aP = null, aD = null;
  for (const s of route) {
    t += dist(pos, s.loc);
    if (s.latest !== null && t > s.latest) return { ok: false };
    if (s.isNew === "P") aP = t;
    if (s.isNew === "D") aD = t;
    load += s.kind === "pickup" ? s.seats : -s.seats;
    if (load > capacity) return { ok: false };
    t += dwell;
    pos = s.loc;
  }
  return { ok: true, finish: t, aP, aD };
}

// The specification, implemented independently: every (pickup, drop-off) position, simulated in full.
export function oracle(c) {
  const base = c.stops.map(([, kind, x, y, latest, seats]) => ({ loc: [x, y], kind, latest, seats }));
  const old = simulate(c.start, c.onboard, Infinity, base, c.dwell).finish;
  let best = null;
  const n = base.length;
  for (let p = 0; p <= n; p++) {
    for (let d = p + 1; d <= n + 1; d++) {
      const route = base.slice();
      route.splice(p, 0, { loc: c.pickup, kind: "pickup", latest: c.maxWait, seats: c.seats, isNew: "P" });
      route.splice(d, 0, { loc: c.dropoff, kind: "dropoff", latest: null, seats: c.seats, isNew: "D" });
      const s = simulate(c.start, c.onboard, c.capacity, route, c.dwell);
      if (!s.ok || s.aD - s.aP > c.maxRide) continue;
      const added = s.finish - old;
      if (!best || added < best[0]) best = [added, p, d];      // p, d ascending: the first of equals wins
    }
  }
  return best;
}

const pyStr = (s) => "'" + s + "'";
const pyStops = (stops) => "[" + stops.map(([rid, kind, x, y, latest, seats]) =>
  `(${pyStr(rid)}, ${pyStr(kind)}, ${x}, ${y}, ${latest === null ? "None" : latest}, ${seats})`).join(", ") + "]";
const pyArgs = (c) => `((${c.start[0]}, ${c.start[1]}), ${c.onboard}, ${c.capacity}, ${pyStops(c.stops)}, (${c.pickup[0]}, ${c.pickup[1]}), (${c.dropoff[0]}, ${c.dropoff[1]}), ${c.maxWait}, ${c.maxRide}, ${c.seats}, ${c.dwell})`;
const pyOut = (v) => (v ? `(${v[0]}, ${v[1]}, ${v[2]})` : "None");

const NAMES = ["ana", "bo", "chen", "dev", "eli", "fay", "gus", "hana", "ivo", "jun", "kai", "lea"];

// A feasible planned route on a small grid. Latest arrivals leave some slack at level 2+.
function route(r, level, n, capacity, dwell) {
  const loc = () => [r.int(0, 40), r.int(0, 40)];
  const start = loc();
  const names = r.shuffle(NAMES);
  let used = 0, load = 0;
  const riding = [];
  const nOn = r.int(0, Math.min(2, capacity - 1));
  for (let i = 0; i < nOn; i++) { const sz = level === 3 && r.chance(0.3) ? 2 : 1; if (load + sz <= capacity) { riding.push([names[used++], sz]); load += sz; } }
  const onboard = load;
  const stops = [];
  let pos = start, t = 0;
  while (stops.length < n) {
    const sz = level === 3 && r.chance(0.35) ? 2 : 1;
    let rid, kind, size;
    if (stops.length + riding.length < n && used < names.length && load + sz <= capacity && (!riding.length || r.chance(0.5))) {
      rid = names[used++]; kind = "pickup"; size = sz; riding.push([rid, sz]); load += sz;
    } else if (riding.length) {
      [rid, size] = riding.splice(r.int(0, riding.length - 1), 1)[0]; kind = "dropoff"; load -= size;
    } else break;
    const l = loc();
    t += dist(pos, l);
    const latest = level === 1 || r.chance(0.3) ? null : t + r.int(4, 30);
    stops.push([rid, kind, l[0], l[1], latest, size]);
    t += dwell;
    pos = l;
  }
  return { start, onboard, stops };
}

function randomCase(r, level, capacity, dwell) {
  let fallback = null;
  for (let attempt = 0; attempt < 200; attempt++) {
    const rt = route(r, level, r.int(3, level === 1 ? 4 : 6), capacity, dwell);
    const c = {
      ...rt, capacity, dwell,
      pickup: [r.int(0, 40), r.int(0, 40)], dropoff: [r.int(0, 40), r.int(0, 40)],
      maxWait: r.int(30, 90), maxRide: r.int(25, 70), seats: level === 3 && r.chance(0.5) ? 2 : 1,
    };
    const got = oracle(c);
    if (got && got[1] > 0) return c;          // feasible, and not simply "pick up first"
    if (got && !fallback) fallback = c;
  }
  if (fallback) return fallback;
  throw new Error("UBR-L2-02: could not build a feasible sample");
}

export function generate(r, level) {
  const capacity = level === 3 ? r.pick([4, 5, 6]) : r.pick([3, 4]);
  const dwell = level === 3 ? r.pick([1, 2, 3]) : 0;
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const c = randomCase(r, level, capacity, dwell);
    samples.push({ args: pyArgs(c), expect: pyOut(oracle(c)) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const ox = r.int(0, 50), oy = r.int(0, 50);
  const P = (x, y) => [ox + x, oy + y];
  const S = (rid, kind, x, y, latest = null, seats = 1) => [rid, kind, ox + x, oy + y, latest, seats];
  const base = { start: P(0, 0), onboard: 0, capacity, dwell, seats: 1, maxWait: 1000, maxRide: 1000 };
  const w = dwell;                          // the samples' dwell (0 below level 3)
  const edges = [
    ["an idle driver: pick up, then drop off", { ...base, stops: [], pickup: P(3, 4), dropoff: P(10, 4) }],
    ["a new rider exactly on the way costs nothing extra",
      { ...base, stops: [S("ana", "pickup", 0, 10), S("ana", "dropoff", 0, 30)], pickup: P(0, 15), dropoff: P(0, 25) }],
    ["equal costs: the earliest pickup position, then the earliest drop-off position, wins",
      { ...base, stops: [S("ana", "pickup", 5, 0), S("ana", "dropoff", 5, 0)], pickup: P(5, 0), dropoff: P(5, 0) }],
    ["a full car cannot take the rider until someone gets out",
      { ...base, capacity: 2, onboard: 2, stops: [S("ana", "dropoff", 0, 20), S("bo", "dropoff", 0, 50)], pickup: P(0, 10), dropoff: P(0, 30) }],
    ["a pickup exactly at max_wait is allowed",
      { ...base, stops: [S("ana", "pickup", 20, 0)], pickup: P(0, 12), dropoff: P(0, 20), maxWait: 12 }],
    ["one second over max_wait is not, and nothing feasible returns None",
      { ...base, stops: [S("ana", "pickup", 20, 0)], pickup: P(0, 12), dropoff: P(0, 20), maxWait: 11 }],
    ["a ride of exactly max_ride is allowed",
      { ...base, stops: [], pickup: P(1, 0), dropoff: P(9, 0), maxRide: 8 + w }],
    ["one second over max_ride, with no other way, returns None",
      { ...base, stops: [], pickup: P(1, 0), dropoff: P(9, 0), maxRide: 7 + w }],
    ["max_ride forces the drop-off before another rider's pickup",
      { ...base, stops: [S("ana", "pickup", 10, 3), S("ana", "dropoff", 40, 0)], pickup: P(5, 0), dropoff: P(12, 0), maxRide: 7 + w }],
  ];
  if (level >= 2) {
    edges.push(["a detour that reaches a promised stop exactly on time is allowed",
      { ...base, stops: [S("ana", "pickup", 10, 0, 14 + w), S("ana", "dropoff", 20, 0)], pickup: P(5, 2), dropoff: P(30, 0) }]);
    edges.push(["one second later than a promised stop is not",
      { ...base, stops: [S("ana", "pickup", 10, 0, 13 + w), S("ana", "dropoff", 20, 0)], pickup: P(5, 2), dropoff: P(30, 0) }]);
    edges.push(["a tight promise late in the route rules out every pickup before it",
      { ...base, stops: [S("ana", "pickup", 0, 10), S("bo", "pickup", 0, 20), S("ana", "dropoff", 0, 30, 30 + 2 * w), S("bo", "dropoff", 0, 40)],
        pickup: P(6, 12), dropoff: P(0, 35) }]);
  }
  if (level === 3) {
    edges.push(["a party of two needs two free seats for the whole ride",
      { ...base, capacity: 4, onboard: 2, seats: 2, stops: [S("ana", "pickup", 0, 10, null, 1), S("ana", "dropoff", 0, 30, null, 1), S("cy", "dropoff", 0, 40, null, 2)],
        pickup: P(0, 5), dropoff: P(0, 35) }]);
    edges.push(["the dwell at an inserted stop delays the promised stops after it",
      { ...base, dwell: 2, stops: [S("ana", "pickup", 0, 10, 11), S("ana", "dropoff", 0, 20)], pickup: P(0, 5), dropoff: P(0, 25) }]);
    edges.push(["dwell at the pickup counts toward the new rider's ride time (None here)",
      { ...base, dwell: 3, stops: [], pickup: P(0, 0), dropoff: P(0, 6), maxRide: 8 }]);
  }
  for (const [name, c] of edges) tests.push({ name, args: pyArgs(c), expect: pyOut(oracle(c)) });

  // Timing: compared with the reference at check time. Simulating every candidate route
  // is cubic in the number of stops; checking each pair from precomputed arrays is quadratic.
  const n = 600, seed = r.int(1, 1_000_000);
  const cap = level === 3 ? 6 : 8, seatsMax = level === 3 ? 2 : 1, dw = level === 3 ? 30 : 0;
  tests.push({
    name: `a long batched route of ${n} stops in time`,
    args: `(lambda s, o, st: (s, o, ${cap}, st, (1000, 1000), (1500, 300), 10**9, 10**9, ${level === 3 ? 2 : 1}, ${dw}))(*_gen_route(${n}, ${cap}, ${seatsMax}, ${dw}, ${seed}))`,
    limit_s: 8,
  });

  return {
    vars: {
      latest_rule: level === 1
        ? "In this exercise every `latest` is None: the stops already planned have no time limit."
        : "`latest` is the latest arrival time promised for that stop (None means no limit). Inserting the new rider may delay later stops, but never past their `latest`.",
      party_rule: level === 3
        ? `Parties can be larger than one: \`seats\` is the new rider's party size, and each stop's last field is the size of that rider's party. Every stop, including the two new ones, takes \`dwell\` seconds (${dwell} in the samples) before the car leaves it; arrival times are measured on arrival, so dwell at the pickup counts toward the new rider's ride time.`
        : "Every party is one seat (`seats` is 1), and `dwell` is 0: the car leaves a stop the moment it arrives.",
    },
    samples,
    tests,
  };
}
