/* AMZ-L2-02 — Earliest arrival through scheduled linehauls (Python).
   Simulated practice scenario. All data is generated from the seed.

   Contract (python): entry, signature, starter, prelude, generate(r, level) ->
     { vars, samples: [{args, expect}], tests: [{name, args, expect?, limit_s?}] }.
   expect comes from oracle() below: label-correcting relaxation of every lane until
   nothing improves, scanning every departure (and, for daily schedules, computing
   the first repetition at or after the ready minute directly). The evaluator's
   reference is Dijkstra with sorted departures, suffix minima and binary search,
   written independently.
   level: 1 Medium (one transit time per lane) · 2 Hard (+ express departures that
          leave later and arrive earlier, multi-hop routes that beat direct lanes)
          · 3 Very Hard (+ daily repeating schedules and multi-day transits) */
export const kind = "python";
export const entry = "earliest_arrival";
export const signature = "def earliest_arrival(lanes: list[tuple[str, str, list[tuple[int, int]]]], handling: dict[str, int], origin: str, dest: str, ready: int, daily: bool = False) -> int | None:";
export const starter = `def earliest_arrival(lanes, handling, origin, dest, ready, daily=False):
    """lanes: (from_node, to_node, [(depart_minute, transit_minutes), ...]).
    handling: minutes a package needs at a node before it can leave again
    (missing = 0; never applied at origin or dest).
    Return the earliest minute the package can arrive at dest, or None."""
    ...
`;

export const prelude = `
def _gen_network(n, m, k, seed, daily):
    x = seed
    def nxt():
        nonlocal x
        x = (1103515245 * x + 12345) % 2147483648
        return x >> 16
    names = ['N%04d' % i for i in range(n)]
    handling = {names[i]: nxt() % 11 for i in range(n)}
    top = 1440 if daily else n * 60
    lanes = []
    for j, i in enumerate(range(n - 2, -1, -1)):   # the main route, last hop first
        if daily:
            deps = [(nxt() % 1440, 10 + nxt() % 31) for _ in range(k)]
        else:
            deps = [(i * 60 + t * 7, 10 + nxt() % 31) for t in range(k)]
        lanes.append((names[i], names[i + 1], deps))
        while len(lanes) < (j + 1) * m // (n - 1):
            a = nxt() % (n - 1)
            if nxt() % 2:                          # a slower lane a few nodes ahead
                b = min(n - 1, a + 1 + nxt() % 3)
                deps = [((nxt() % 1440) if daily else a * 60 + nxt() % 600, 400 + nxt() % 1001) for _ in range(k)]
            else:                                  # a return lane back up the route
                b = nxt() % (a + 1)
                deps = [(nxt() % top, 2000 + nxt() % 18001) for _ in range(k)]
            lanes.append((names[a], names[b], deps))
    return lanes, handling
`.trim() + "\n";

const DAY = 1440;

// Relax every lane, scanning every departure, until nothing improves.
export function oracle(lanes, handling, origin, dest, ready, daily) {
  const arrive = new Map([[origin, ready]]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const [u, v, deps] of lanes) {
      if (!arrive.has(u)) continue;
      const leave = arrive.get(u) + (u === origin ? 0 : handling[u] || 0);
      for (const [d, tr] of deps) {
        let start = d;
        if (daily) start = d + DAY * Math.max(0, Math.ceil((leave - d) / DAY));
        else if (d < leave) continue;
        const at = start + tr;
        if (!arrive.has(v) || at < arrive.get(v)) { arrive.set(v, at); changed = true; }
      }
    }
  }
  return arrive.has(dest) ? arrive.get(dest) : null;
}

const pyOut = (v) => (v === null ? "None" : String(v));
const pyLane = ([u, v, deps]) => `('${u}', '${v}', [${deps.map(([d, t]) => `(${d}, ${t})`).join(", ")}])`;
const pyArgs = (lanes, handling, origin, dest, ready, daily) =>
  `([${lanes.map(pyLane).join(", ")}], {${Object.entries(handling).map(([k, v]) => `'${k}': ${v}`).join(", ")}}, '${origin}', '${dest}', ${ready}, ${daily ? "True" : "False"})`;

const node = (r, pre, used) => {
  for (;;) {
    const id = pre + r.int(1, 9);
    if (!used.has(id)) { used.add(id); return id; }
  }
};

function smallCase(r, level) {
  for (let attempt = 0; attempt < 80; attempt++) {
    const used = new Set();
    const fc = node(r, "FC", used);
    const sorts = Array.from({ length: level === 1 ? r.int(2, 3) : r.int(3, 4) }, () => node(r, "SC", used));
    const ds = node(r, "DS", used);
    const nodes = [fc, ...sorts, ds];
    const handling = {};
    for (const s of sorts) handling[s] = r.pick([0, 15, 20, 30, 45]);
    if (r.chance(0.5)) handling[ds] = r.pick([30, 60]);     // must be ignored at the destination
    const daily = level === 3;
    const lanes = [];
    const nl = level === 1 ? r.int(6, 9) : r.int(9, 14);
    for (let i = 0; i < nl; i++) {
      const u = r.pick(nodes.slice(0, -1));
      const v = r.pick(nodes.filter((x) => x !== u));
      const nd = level === 1 ? r.int(1, 3) : r.int(2, 4);
      const base = r.pick([45, 90, 120, 180, 240]);
      const deps = [];
      for (let j = 0; j < nd; j++) {
        const d = daily ? r.int(0, 95) * 15 : r.int(0, 60) * 10;
        const tr = level === 1 ? base : r.chance(0.35) ? Math.max(20, Math.floor(base / 3)) : base + r.pick([0, 30, 60, 300]);
        deps.push([d, daily && r.chance(0.2) ? tr + DAY : tr]);
      }
      lanes.push([u, v, r.shuffle(deps)]);
    }
    const ready = daily ? r.int(0, 2 * DAY) : r.int(0, 20) * 10;
    const got = oracle(lanes, handling, fc, ds, ready, daily);
    if (got !== null) return { lanes, handling, origin: fc, dest: ds, ready, daily, got };
  }
  throw new Error("AMZ-L2-02: could not build a reachable sample");
}

export function generate(r, level) {
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const c = smallCase(r, level);
    samples.push({ args: pyArgs(c.lanes, c.handling, c.origin, c.dest, c.ready, c.daily), expect: pyOut(c.got) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const used = new Set();
  const O = node(r, "FC", used), A = node(r, "SC", used), B = node(r, "SC", used), D = node(r, "DS", used);
  const t0 = r.int(6, 30) * 10;            // ready minute
  const h = r.pick([15, 20, 30]);
  const edges = [
    ["origin equals destination: the ready minute", [[O, A, [[t0, 60]]]], {}, O, O, t0, false],
    ["no lane reaches the destination: None", [[O, A, [[t0, 60]]], [D, O, [[t0, 30]]]], {}, O, D, t0, false],
    ["every departure has already left: None", [[O, D, [[t0 - 10, 60], [t0 - 1, 60]]]], {}, O, D, t0, false],
    ["a departure exactly at the ready minute is caught", [[O, D, [[t0, 90], [t0 + 30, 90]]]], {}, O, D, t0, false],
    ["a departure one minute before the ready minute is missed", [[O, D, [[t0 - 1, 90], [t0 + 45, 90]]]], {}, O, D, t0, false],
    ["handling at a sort centre can miss a tight connection",
      [[O, A, [[t0, 60]]], [A, D, [[t0 + 60 + h - 1, 30], [t0 + 60 + h + 40, 30]]]], { [A]: h }, O, D, t0, false],
    ["no handling at the origin or the destination",
      [[O, A, [[t0, 60]]], [A, D, [[t0 + 60 + h, 30]]]], { [O]: 120, [A]: h, [D]: 240 }, O, D, t0, false],
  ];
  if (level >= 2) {
    edges.push(["a later express departure arrives before the next one",
      [[O, D, [[t0 + 10, 300], [t0 + 40, 90], [t0 - 5, 20]]]], {}, O, D, t0, false]);
    edges.push(["two hops through a sort centre beat the direct lane",
      [[O, D, [[t0, 600]]], [O, A, [[t0 + 20, 120]]], [A, B, [[t0 + 160, 60]]], [B, D, [[t0 + 240, 45]]]], { [A]: 15, [B]: 15 }, O, D, t0, false]);
    edges.push(["waiting for a later departure beats taking a slow one now",
      [[O, A, [[t0, 30]]], [A, D, [[t0 + 30, 400], [t0 + 120, 60]]]], {}, O, D, t0, false]);
  }
  if (level === 3) {
    const late = DAY - r.int(2, 6) * 10;
    edges.push(["daily: ready after today's last departure, so tomorrow's",
      [[O, D, [[300, 120], [late - 60, 120]]]], {}, O, D, late, true]);
    edges.push(["daily: tomorrow morning's express beats tonight's slow linehaul",
      [[O, D, [[late + 5, 2000], [60, 200]]]], {}, O, D, late, true]);
    edges.push(["daily: ready on day 3, with a transit longer than a day",
      [[O, A, [[600, 1500]]], [A, D, [[180, 90], [1200, 30]]]], { [A]: 30 }, O, D, 3 * DAY + 500, true]);
    edges.push(["daily: a departure exactly at the ready minute on a later day",
      [[O, D, [[400, 45], [900, 45]]]], {}, O, D, 2 * DAY + 400, true]);
  }
  for (const [name, ls, hd, o, d, rd, dy] of edges) tests.push({ name, args: pyArgs(ls, hd, o, d, rd, dy), expect: pyOut(oracle(ls, hd, o, d, rd, dy)) });

  // Timing: 3 000 nodes, 20 000 lanes, 10 departures each. Dijkstra with sorted
  // departures is well under a second; relaxing every lane until nothing changes
  // needs a pass per hop of a 3 000-hop route.
  const daily = level === 3;
  tests.push({
    name: `3,000 nodes, 20,000 lanes, 10 departures each${daily ? ", daily" : ""} (Dijkstra)`,
    args: `(*_gen_network(3000, 20000, 10, ${r.int(1, 1_000_000)}, ${daily ? "True" : "False"}), 'N0000', 'N2999', 0, ${daily ? "True" : "False"})`,
    limit_s: 8,
  });

  return {
    vars: {
      schedule_rule: level === 1
        ? "In this replay all departures on one lane take the same transit time."
        : "Departures on one lane can have different transit times: an express linehaul may leave later and still arrive earlier.",
      daily_rule: level === 3
        ? "With `daily=True`, as in this replay's samples, each `depart_minute` is a minute of the day (0–1439) and the departure repeats every day, at `depart_minute + 1440·k` for every k ≥ 0; transit times can exceed a day. `ready` and the answer count minutes from midnight of day 0."
        : "This replay uses `daily=False`: every departure happens once, at its minute; minutes count from the start of the planning window.",
    },
    samples,
    tests,
  };
}
