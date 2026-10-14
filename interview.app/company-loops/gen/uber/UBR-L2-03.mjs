/* UBR-L2-03 — Debug the trip-state reconstruction from mobile events (debug, Python).
   Simulated practice scenario. All data is generated from the seed.

   Contract (debug): like python, but `starter` is buggy code the candidate fixes.
   The evaluator's reference is the fixed code. expect comes from oracle() below,
   an independent JavaScript implementation of the specification in the template.
   Planted bugs (see the evaluator notes): events ordered by the phone's clock instead
   of the trip sequence number; retransmitted copies not dropped; an illegal transition
   counted but still applied; a cancel after the driver has arrived treated as illegal;
   location events counted as illegal instead of ignored.
   Each bug has a test that only it fails.
   level: 1 Medium (correct phone clocks, small reorderings, retransmissions) ·
          2 Hard (+ skewed phone clocks, offline batches, no-show cancellations) ·
          3 Very Hard (+ location events, double taps and stale retries) */
export const kind = "debug";
export const entry = "reconstruct_trips";
export const signature = "def reconstruct_trips(events: list[dict]) -> dict:";
export const starter = `ALLOWED = {
    None: {"requested"},
    "requested": {"accepted", "cancelled"},
    "accepted": {"arrived", "cancelled"},
    "arrived": {"started"},
    "started": {"completed"},
    "completed": set(),
    "cancelled": set(),
}


def reconstruct_trips(events):
    by_trip = {}
    for ev in events:
        by_trip.setdefault(ev["trip"], []).append(ev)

    out = {}
    for trip, evs in by_trip.items():
        evs.sort(key=lambda ev: ev["device_ts"])
        state, started_at, seconds, illegal = None, None, None, 0
        for ev in evs:
            t = ev["type"]
            if t not in ALLOWED.get(state, set()):
                illegal += 1
            state = t
            if t == "started":
                started_at = ev["device_ts"]
            elif t == "completed":
                seconds = ev["device_ts"] - started_at
        out[trip] = {"state": state, "trip_seconds": seconds, "illegal": illegal}
    return out
`;

export const prelude = `
def _gen_trip_events(n, seed):
    x, out, trip, eid = seed, [], 0, 0
    def nxt():
        nonlocal x
        x = (1103515245 * x + 12345) % 2147483648
        return x >> 8
    path = ['requested', 'accepted', 'arrived', 'started', 'completed']
    while len(out) < n:
        trip += 1
        tid = 't%07d' % trip
        stop = nxt() % 9
        steps = path if stop >= 3 else path[:stop + 1] + ['cancelled']
        skew_rider, skew_driver = nxt() % 400 - 200, nxt() % 400 - 200
        real = 1767225600 + nxt() % 86400
        for seq, t in enumerate(steps, 1):
            if nxt() % 6 == 0:
                eid += 1
                out.append({'event_id': 'e%d' % eid, 'trip': tid, 'seq': seq * 10 - 5, 'type': 'location', 'device_ts': real + skew_driver})
            real += 5 + nxt() % 300
            eid += 1
            skew = skew_rider if t in ('requested', 'cancelled') else skew_driver
            ev = {'event_id': 'e%d' % eid, 'trip': tid, 'seq': seq * 10, 'type': t, 'device_ts': real + skew}
            out.append(ev)
            if nxt() % 10 == 0:
                out.append(dict(ev))                      # a retransmitted copy
    for i in range(len(out) - 1, 0, -1):                  # offline batches: shuffle locally
        j = max(0, i - nxt() % 40)
        out[i], out[j] = out[j], out[i]
    return out
`.trim() + "\n";

const NEXT = {
  "": ["requested"],
  requested: ["accepted", "cancelled"],
  accepted: ["arrived", "cancelled"],
  arrived: ["started", "cancelled"],
  started: ["completed"],
  completed: [],
  cancelled: [],
};
const LIFECYCLE = new Set(["requested", "accepted", "arrived", "started", "completed", "cancelled"]);

// The specification, implemented independently of the Python reference.
export function oracle(events) {
  const seen = new Set();
  const trips = new Map();
  for (const e of events) {
    if (!trips.has(e.trip)) trips.set(e.trip, []);
    if (seen.has(e.event_id)) continue;
    seen.add(e.event_id);
    trips.get(e.trip).push(e);
  }
  const out = {};
  for (const [trip, evs] of trips) {
    const ordered = evs.filter((e) => LIFECYCLE.has(e.type)).sort((a, b) => a.seq - b.seq);
    let state = "", startTs = null, seconds = null, illegal = 0;
    for (const e of ordered) {
      if (!NEXT[state].includes(e.type)) { illegal++; continue; }
      state = e.type;
      if (state === "started") startTs = e.device_ts;
      if (state === "completed") seconds = e.device_ts - startTs;
    }
    out[trip] = { state: state || null, trip_seconds: seconds, illegal };
  }
  return out;
}

function py(v) {
  if (v === null || v === undefined) return "None";
  if (typeof v === "boolean") return v ? "True" : "False";
  if (typeof v === "number") return String(v);
  if (typeof v === "string") return "'" + v + "'";
  if (Array.isArray(v)) return "[" + v.map(py).join(", ") + "]";
  return "{" + Object.entries(v).map(([k, x]) => `'${k}': ${py(x)}`).join(", ") + "}";
}
const pyArgs = (events) => "(" + py(events) + ",)";

const FIELDS = (eid, trip, seq, type, ts) => ({ event_id: eid, trip, seq, type, device_ts: ts });

// A random stream of trips, delivered out of order.
function stream(r, level, t0) {
  let eid = r.int(100, 900);
  const evs = [];
  const nTrips = level === 1 ? 2 : 3;
  const path = ["requested", "accepted", "arrived", "started", "completed"];
  for (let k = 0; k < nTrips; k++) {
    const trip = "trip-" + String.fromCharCode(97 + k) + r.int(10, 99);
    const end = r.next();
    let steps = path;
    if (end < 0.3) steps = path.slice(0, r.int(1, 2)).concat(["cancelled"]);
    else if (end < 0.45 && level >= 2) steps = path.slice(0, 3).concat(["cancelled"]);   // a no-show
    const skewRider = level === 1 ? 0 : r.int(-150, 150), skewDriver = level === 1 ? 0 : r.int(-150, 150);
    let real = t0 + r.int(0, 600);
    const own = [];
    steps.forEach((type, i) => {
      if (level === 3 && r.chance(0.25)) own.push(FIELDS("e" + eid++, trip, i * 10 + 5, "location", real + skewDriver));
      real += type === "completed" ? r.int(300, 2400) : r.int(20, 400);
      const skew = type === "requested" || type === "cancelled" ? skewRider : skewDriver;
      const ev = FIELDS("e" + eid++, trip, (i + 1) * 10, type, real + skew);
      own.push(ev);
      if (r.chance(0.2)) own.push({ ...ev });                                       // a retransmitted copy
      if (level === 3 && type === "started" && r.chance(0.5)) own.push(FIELDS("e" + eid++, trip, (i + 1) * 10 + 1, "started", real + skew + r.int(1, 4)));  // a double tap
    });
    if (level === 3 && r.chance(0.4)) {                                                // a stale retry with a new id
      const last = own.filter((e) => e.type !== "location").at(-1);
      own.push(FIELDS("e" + eid++, trip, last.seq + 3, "accepted", last.device_ts + r.int(5, 60)));
    }
    evs.push(...own);
  }
  // delivery order: small swaps at level 1, whole offline batches moved later at 2 and 3
  let out = evs.slice();
  if (level === 1) {
    for (let i = 0; i < 3; i++) { const a = r.int(0, out.length - 2); [out[a], out[a + 1]] = [out[a + 1], out[a]]; }
  } else {
    const cut = r.int(1, out.length - 3), len = r.int(2, 4);
    const batch = out.splice(cut, len);
    out = out.concat(batch);
    out = r.shuffle(out.slice(0, 4)).concat(out.slice(4));
  }
  return out;
}

export function generate(r, level) {
  const t0 = 1767225600 + r.int(0, 300) * 86400;
  const samples = [];
  for (let i = 0; i < 2; i++) {
    const ev = stream(r, level, t0 + i * 3600);
    samples.push({ args: pyArgs(ev), expect: py(oracle(ev)) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const T = "trip-" + r.pick(["k", "m", "q", "w"]) + r.int(100, 999);
  let n = r.int(1000, 5000);
  const id = () => "e" + n++;
  const at = t0 + r.int(0, 3000);
  const trip = (types, gaps, opts = {}) => {
    // one trip in seq order; rider events carry opts.rider skew, driver events opts.driver skew
    let real = at;
    return types.map((type, i) => {
      real += gaps[i % gaps.length];
      const skew = type === "requested" || type === "cancelled" ? opts.rider || 0 : opts.driver || 0;
      return FIELDS(id(), T, (i + 1) * 10, type, real + skew);
    });
  };
  const full = ["requested", "accepted", "arrived", "started", "completed"];
  const g = [r.int(20, 60), r.int(30, 90), r.int(150, 400), r.int(30, 90), r.int(600, 1800)];

  const reversed = trip(full, g).reverse();
  const skewed = trip(full, g, { rider: 0, driver: -(g[1] + r.int(30, 120)) });   // the driver's phone runs slow
  const dup = trip(full, g);
  dup.splice(2, 0, { ...dup[1] });
  dup.push({ ...dup[4] });
  const retry = trip(["requested", "accepted", "arrived"], g);
  retry.push(FIELDS(id(), T, 35, "accepted", retry[2].device_ts + 3));
  retry.push(...trip(["started", "completed"], g).map((e, i) => ({ ...e, seq: 40 + i * 10, device_ts: retry[2].device_ts + 60 + i * 900 })));
  const noShow = trip(["requested", "accepted", "arrived", "cancelled"], g);
  const pings = trip(full, g);
  for (const k of [4, 3, 1]) pings.splice(k, 0, FIELDS(id(), T, k * 10 + 5, "location", pings[k - 1].device_ts + 7));
  const tap = trip(full, g);
  tap.splice(4, 0, FIELDS(id(), T, 41, "started", tap[3].device_ts + 2));
  const late = trip(full, g);
  late.push(FIELDS(id(), T, 60, "cancelled", late[4].device_ts + 30));
  const lost = trip(full, g).slice(1);
  const onlyPings = [FIELDS(id(), T, 5, "location", at), FIELDS(id(), T, 6, "location", at + 4)];
  const two = [...trip(full, g), ...trip(["requested", "cancelled"], g).map((e) => ({ ...e, trip: T + "x" }))];
  const twoMixed = r.shuffle(two);

  const edges = [
    ["events delivered in reverse order are applied in seq order", reversed],
    ["a phone clock running slow does not reorder the trip: seq decides, not device time", skewed],
    ["a retransmitted copy of an event is applied once and is not illegal", dup],
    ["an illegal event is counted and does not change the state", retry],
    ["a rider no-show: cancelled after the driver arrived", noShow],
    ["location events are ignored, not counted as illegal", pings],
    ["a double-tapped start: the first start counts, the second is illegal", tap],
    ["a cancel after completion is illegal and changes nothing", late],
    ["a trip whose request never arrived has no state", lost],
    ["a trip with only location events has no state and nothing illegal", onlyPings],
    ["two trips in one stream are reconstructed separately", twoMixed],
  ];
  for (const [name, ev] of edges) tests.push({ name, args: pyArgs(ev), expect: py(oracle(ev)) });

  const size = level === 1 ? 100000 : 200000;
  tests.push({ name: `${size.toLocaleString("en-US")} trip events in time`, args: `(_gen_trip_events(${size}, ${r.int(1, 1_000_000)}),)`, limit_s: 8 });

  return {
    vars: {
      replay_rule: level === 1
        ? "This replay has accurate phone clocks, small reorderings in delivery and some retransmitted copies; the checks also include skewed clocks, no-show cancellations and location events."
        : level === 2
          ? "This replay has phone clocks that disagree by a few minutes, offline batches delivered late, retransmitted copies and rider no-shows."
          : "This replay has skewed phone clocks, offline batches, retransmitted copies, no-shows, location events mixed into the stream, double-tapped buttons and stale retries that arrive with new event ids.",
    },
    samples,
    tests,
  };
}
