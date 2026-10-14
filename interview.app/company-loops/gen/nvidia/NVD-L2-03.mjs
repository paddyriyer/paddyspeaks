/* NVD-L2-03 — Debug the GPU utilisation rollup (debug, Python).
   Simulated practice scenario. All data is generated from the seed.

   Contract (debug): like python, but `starter` is buggy code the candidate fixes.
   The evaluator's reference is the fixed code. expect comes from oracle() below,
   an independent JavaScript implementation of the specification in the template.
   Planted bugs (see the evaluator notes): the GPU model is taken from the node's
   first GPU; the slot share uses integer division; a preempted allocation is held
   until its scheduled end; GPU-hours are all charged to the start day; and average
   utilisation divides by allocated time, so missing samples count as 0 %.
   level: 1 Medium (one GPU model, slices, allocations inside one day, every sample present)
          · 2 Hard (+ nodes with mixed GPU models, allocations across midnight)
          · 3 Very Hard (+ preemptions, missing samples, slices sharing a GPU at once) */
export const kind = "debug";
export const entry = "utilisation_rollup";
export const signature = "def utilisation_rollup(allocations: list[dict], samples: list[tuple[str, int, int, int]], inventory: dict[str, list[str]], slots_per_gpu: dict[str, int], interval: int) -> dict[tuple[str, str], tuple[float, float | None]]:";
export const starter = `from datetime import datetime, timezone

_DAY_NAMES = {}


def _day(ts):
    d = ts // 86400
    if d not in _DAY_NAMES:
        _DAY_NAMES[d] = datetime.fromtimestamp(d * 86400, timezone.utc).strftime("%Y-%m-%d")
    return _DAY_NAMES[d]


def utilisation_rollup(allocations, samples, inventory, slots_per_gpu, interval):
    charged = {}            # (day, team) -> GPU-seconds charged
    held = {}               # (node, gpu) -> [(start, stop, team, share)]
    for a in allocations:
        model = inventory[a["node"]][0]
        share = a["slots"] // slots_per_gpu[model]
        stop = a["end"]
        held.setdefault((a["node"], a["gpu"]), []).append((a["start"], stop, a["team"], share))
        key = (_day(a["start"]), a["team"])
        charged[key] = charged.get(key, 0) + (stop - a["start"]) * share
    busy = {}               # (day, team) -> utilisation x GPU-seconds
    for node, gpu, ts, util in samples:
        for start, stop, team, share in held.get((node, gpu), ()):
            if start <= ts < stop:
                key = (_day(ts), team)
                busy[key] = busy.get(key, 0) + util * share * interval
    out = {}
    for key, secs in charged.items():
        if secs > 0:
            out[key] = (round(secs / 3600, 3), round(busy.get(key, 0) / secs, 3))
    return out
`;

export const prelude = `
def _gen_cluster(n_nodes, hours, seed, interval=60):
    x = seed
    def rnd(m):
        nonlocal x
        x = (1103515245 * x + 12345) % 2147483648
        return (x >> 16) % m
    slots = {'type_a': 7, 'type_b': 4, 'type_c': 8}
    names = sorted(slots)
    t0 = 1789344000 + 6 * 3600                  # 06:00 UTC, so the window crosses midnight
    t1 = t0 + hours * 3600
    inventory, allocations, samples = {}, [], []
    for i in range(n_nodes):
        node = 'node%03d' % i
        kinds = [names[rnd(3)]] * 8 if rnd(4) else [names[rnd(3)] for _ in range(8)]
        inventory[node] = kinds
        for g in range(8):
            t = t0 + rnd(3600)
            while t < t1:
                dur = 600 + rnd(5 * 3600)
                full = slots[kinds[g]]
                a = {'job': 'j%d' % len(allocations), 'team': 'team%02d' % rnd(12), 'node': node, 'gpu': g,
                     'slots': full if rnd(3) else 1 + rnd(full), 'start': t, 'end': t + dur}
                if rnd(10) == 0:
                    a['preempted_at'] = t + dur // 2
                allocations.append(a)
                t += dur + rnd(1800)
            for ts in range(t0, t1, interval):
                if rnd(50):
                    samples.append((node, g, ts, rnd(101)))
    return allocations, samples, inventory, slots, interval
`.trim() + "\n";

const DAY0 = 1789344000;                  // 2026-09-14 00:00:00 UTC
const dayName = (ts) => new Date(Math.floor(ts / 86400) * 86400 * 1000).toISOString().slice(0, 10);
const round3 = (x) => Math.round(x * 1000) / 1000;

// The specification, implemented independently of the Python reference.
export function oracle(allocations, samples, inventory, slots, interval) {
  const charged = new Map(), busy = new Map(), seen = new Map();
  const add = (m, k, v) => m.set(k, (m.get(k) || 0) + v);
  const holders = [];
  for (const a of allocations) {
    const share = a.slots / slots[inventory[a.node][a.gpu]];
    const stop = a.preempted_at ?? a.end;
    holders.push({ node: a.node, gpu: a.gpu, start: a.start, stop, team: a.team, share });
    for (let d = Math.floor(a.start / 86400); d * 86400 < stop; d++) {
      const lo = Math.max(a.start, d * 86400), hi = Math.min(stop, (d + 1) * 86400);
      if (hi > lo) add(charged, dayName(lo) + "|" + a.team, (hi - lo) * share);
    }
  }
  for (const [node, gpu, ts, util] of samples) {
    for (const h of holders) {
      if (h.node !== node || h.gpu !== gpu || ts < h.start || ts >= h.stop) continue;
      const k = dayName(ts) + "|" + h.team;
      add(busy, k, util * h.share * interval);
      add(seen, k, h.share * interval);
    }
  }
  const out = [];
  for (const [k, secs] of charged) {
    if (!(secs > 0)) continue;
    const [day, team] = k.split("|");
    out.push([day, team, round3(secs / 3600), seen.get(k) ? round3(busy.get(k) / seen.get(k)) : null]);
  }
  return out;
}

const pyOut = (rows) => "{" + rows.map(([d, t, h, u]) => `('${d}', '${t}'): (${h}, ${u === null ? "None" : u})`).join(", ") + "}";
function pyArgs(allocations, samples, inventory, slots, interval) {
  const al = allocations.map((a) =>
    `{'job': '${a.job}', 'team': '${a.team}', 'node': '${a.node}', 'gpu': ${a.gpu}, 'slots': ${a.slots}, 'start': ${a.start}, 'end': ${a.end}` +
    (a.preempted_at !== undefined ? `, 'preempted_at': ${a.preempted_at}` : "") + "}");
  const sm = samples.map(([n, g, t, u]) => `('${n}', ${g}, ${t}, ${u})`);
  const inv = Object.entries(inventory).map(([n, ms]) => `'${n}': [${ms.map((m) => `'${m}'`).join(", ")}]`);
  const sl = Object.entries(slots).map(([m, s]) => `'${m}': ${s}`);
  return `([${al.join(", ")}], [${sm.join(", ")}], {${inv.join(", ")}}, {${sl.join(", ")}}, ${interval})`;
}

const TEAMS = ["vision", "speech", "pretrain", "recsys", "robotics", "genomics", "weather", "eval"];
const MODELS = ["type_a", "type_b", "type_c"];

function slotTable(r) {
  const counts = r.sample([2, 4, 7, 8], 3);
  return Object.fromEntries(MODELS.map((m, i) => [m, counts[i]]));
}

// Samples for every GPU used, one every `interval` seconds, from one interval before
// each allocation on that GPU starts to one interval after it ends.
function sampleGrid(r, allocations, interval, missing) {
  const want = new Map();                              // "node#gpu" -> Set of timestamps
  for (const a of allocations) {
    const k = a.node + "#" + a.gpu;
    if (!want.has(k)) want.set(k, new Set());
    for (let ts = Math.floor(a.start / interval) * interval - interval; ts <= a.end + interval; ts += interval) want.get(k).add(ts);
  }
  const out = [];
  for (const [k, set] of want) {
    const [node, gpu] = k.split("#");
    for (const ts of [...set].sort((x, y) => x - y)) {
      if (missing && r.chance(0.2)) continue;
      out.push([node, Number(gpu), ts, r.int(0, 100)]);
    }
  }
  return out;
}

function randomCase(r, level) {
  for (let attempt = 0; attempt < 60; attempt++) {
    const interval = r.pick([300, 600, 900]);
    const slots = slotTable(r);
    const nodes = ["node-0" + r.int(1, 4), "node-1" + r.int(0, 9)];
    const inventory = {};
    for (const n of nodes) {
      const m = r.pick(MODELS);
      inventory[n] = Array.from({ length: 4 }, () => (level >= 2 && r.chance(0.35) ? r.pick(MODELS) : m));
    }
    const allocations = [];
    const nAlloc = level === 1 ? r.int(2, 3) : r.int(3, 5);
    const day = DAY0 + r.int(0, 3) * 86400;
    for (let i = 0; i < nAlloc; i++) {
      const node = r.pick(nodes), gpu = r.int(0, 3);
      const full = slots[inventory[node][gpu]];
      const startH = level === 1 ? r.int(1, 18) : r.int(19, 23);
      let start = day + startH * 3600 + r.int(0, 11) * interval;
      if (level >= 2 && r.chance(0.5)) start += r.int(1, interval - 1);       // not on a sample boundary
      const dur = level === 1 ? r.int(3, 10) * interval : r.int(2, 6) * 1800 + r.int(0, 600);
      const a = { job: "job-" + r.int(1000, 9999), team: r.pick(TEAMS), node, gpu, slots: r.chance(0.5) ? full : r.int(1, full), start, end: start + dur };
      if (level === 3 && r.chance(0.35)) a.preempted_at = start + Math.floor(dur * r.int(2, 8) / 10);
      // On one GPU, allocations follow one another unless level 3 lets two slices share it.
      const prev = allocations.filter((b) => b.node === node && b.gpu === gpu);
      if (prev.length && !(level === 3 && a.slots < full && prev.reduce((t, b) => t + b.slots, a.slots) <= full)) {
        const after = Math.max(...prev.map((b) => b.end));
        const shift = after - a.start + r.int(0, 5) * interval;
        a.start += shift; a.end += shift;
        if (a.preempted_at !== undefined) a.preempted_at += shift;
      }
      allocations.push(a);
    }
    const samples = sampleGrid(r, allocations, interval, level === 3);
    const got = oracle(allocations, samples, inventory, slots, interval);
    if (got.length) return { allocations, samples, inventory, slots, interval, got };
  }
  throw new Error("NVD-L2-03: could not build a sample");
}

export function generate(r, level) {
  const samples = [];
  for (let i = 0; i < 2; i++) {
    const c = randomCase(r, level);
    samples.push({ args: pyArgs(c.allocations, c.samples, c.inventory, c.slots, c.interval), expect: pyOut(c.got) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  // Edge tests: each one isolates one rule. Allocations start and end on sample
  // boundaries and every sample is present unless the test is about missing samples.
  const iv = r.pick([60, 300]);
  const slots = slotTable(r);
  const [M1, M2] = MODELS.slice().sort((x, y) => slots[y] - slots[x]);     // M1 has more slots than M2
  const [T, U] = r.sample(TEAMS, 2);
  const node = "node-" + r.int(10, 40);
  const inv = { [node]: [M1, M1, M1, M1] };
  const day = DAY0 + r.int(0, 5) * 86400;
  const at = (h) => day + h * 3600;
  const grid = (g, from, to, gaps = []) => {
    const out = [];
    for (let ts = from, i = 0; ts < to; ts += iv, i++) if (!gaps.includes(i)) out.push([node, g, ts, (i * 37 + r.int(0, 30)) % 101]);
    return out;
  };
  const job = (team, gpu, slotsHeld, start, end, extra = {}) => ({ job: "job-" + r.int(1000, 9999), team, node, gpu, slots: slotsHeld, start, end, ...extra });
  const h0 = r.int(2, 10);
  const edges = [
    ["a GPU on a mixed node uses its own model's slot count",
      [job(T, 2, slots[M2], at(h0), at(h0 + 2))], grid(2, at(h0), at(h0 + 2)), { [node]: [M1, M1, M2, M1] }],
    ["a slice of a GPU is charged its fraction of a GPU-hour",
      [job(T, 0, 1, at(h0), at(h0 + 3))], grid(0, at(h0), at(h0 + 3)), inv],
    ["a preempted allocation ends at preempted_at",
      [job(T, 1, slots[M1], at(h0), at(h0 + 4), { preempted_at: at(h0 + 1) })], grid(1, at(h0), at(h0 + 4)), inv],
    ["an allocation across midnight is charged to both days",
      [job(T, 0, slots[M1], day + 22 * 3600, day + 26 * 3600)], grid(0, day + 22 * 3600, day + 26 * 3600), inv],
    ["missing samples are excluded from average utilisation, not counted as 0 %",
      [job(T, 3, slots[M1], at(h0), at(h0 + 1))], grid(3, at(h0), at(h0 + 1), [1, 2, 5, 6, 7]), inv],
    ["an allocation with no samples at all has average utilisation None",
      [job(T, 1, slots[M1], at(h0), at(h0 + 1))], [], inv],
    ["a sample at the exact end second belongs to the next holder of the GPU",
      [job(T, 0, slots[M1], at(h0), at(h0 + 1)), job(U, 0, slots[M1], at(h0 + 1), at(h0 + 2))], grid(0, at(h0), at(h0 + 2)), inv],
    ["two slices share one GPU at once; each team gets its own share",
      [job(T, 0, 1, at(h0), at(h0 + 2)), job(U, 0, slots[M1] - 1, at(h0), at(h0 + 2))], grid(0, at(h0), at(h0 + 2)), inv],
  ];
  for (const [name, al, sm, iv2] of edges) tests.push({ name, args: pyArgs(al, sm, iv2, slots, iv), expect: pyOut(oracle(al, sm, iv2, slots, iv)) });

  tests.push({ name: "20 nodes x 8 GPUs, 26 hours of samples, in time", args: `_gen_cluster(20, 26, ${r.int(1, 1_000_000)}, 60)`, limit_s: 8 });

  return {
    vars: {
      replay_rule: level === 1
        ? "The replays you are given use one GPU model per node, with whole GPUs and slices, inside one day and with every sample present; the checks cover the other cases too."
        : level === 2
          ? "The replays you are given include nodes with mixed GPU models and allocations that cross midnight UTC."
          : "The replays you are given include preempted allocations, missing samples, and slices of one GPU held by two teams at once.",
    },
    samples,
    tests,
  };
}
