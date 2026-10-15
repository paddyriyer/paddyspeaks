/* CRW-L2-01 — Accepting reservations in order (Python, lazy segment tree: range add, range minimum).
   Simulated practice scenario. All data is generated from the seed; every capacity,
   size and horizon is hypothetical.

   Contract (python): entry, signature, starter, prelude, generate(r, level) ->
     { vars, samples: [{args, expect}], tests: [{name, args, expect?, limit_s?}] }.
   expect comes from oracle() below, which keeps one booked count per hour and checks
   every hour of every request. The evaluator's reference keeps headroom in a lazy
   segment tree, so each checks the other.
   level: 1 Medium (reservations only, one capacity, every request well formed)
          2 Hard (+ cancellations, and malformed requests that are rejected)
          3 Very Hard (+ capacity that changes over the horizon: planned additions and
            planned reductions) */
export const kind = "python";
export const entry = "accept_reservations";
export const signature = "def accept_reservations(horizon: int, capacity: list[tuple[int, int]], ops: list[tuple]) -> list[bool]:";
export const starter = `def accept_reservations(horizon, capacity, ops):
    """horizon: hours 0 .. horizon-1 in the reservation book.
    capacity: (from_hour, gpus) steps, sorted by hour, the first at hour 0; each
    holds until the next step.
    ops: ("reserve", rid, start, end, gpus) for hours [start, end), or
         ("cancel", rid), processed in order.
    Return one bool per op: was the reservation accepted, or did the
    cancellation release an accepted reservation?"""
    ...
`;

export const prelude = `
def _gen_book(horizon, n_ops, seed, cancel_pct=0, n_steps=1, cap=150000):
    x = seed

    def nxt():
        nonlocal x
        x = (1103515245 * x + 12345) % 2147483648
        return x >> 8
    steps = [(0, cap)]
    for k in range(1, n_steps):
        steps.append((horizon * k // n_steps + nxt() % 500, cap * (80 + nxt() % 40) // 100))
    ops, made = [], 0
    for i in range(n_ops):
        if made and nxt() % 100 < cancel_pct:
            ops.append(('cancel', 'r%06d' % (nxt() % made)))
            continue
        dur = horizon // 4 + nxt() % (horizon // 2)
        start = nxt() % (horizon - dur + 1)
        ops.append(('reserve', 'r%06d' % made, start, start + dur, 8 * (1 + nxt() % 32)))
        made += 1
    return horizon, steps, ops
`.trim() + "\n";

// One booked count per hour; every hour of every request is checked. Small inputs only.
export function oracle(horizon, capacity, ops) {
  const capAt = (h) => {
    let c = 0;
    for (const [from, g] of capacity) if (from <= h) c = g;            // steps are sorted
    return c;
  };
  const booked = new Array(Math.max(horizon, 0)).fill(0);
  const active = new Map();
  return ops.map((op) => {
    if (op[0] === "cancel") {
      const res = active.get(op[1]);
      if (!res) return false;
      active.delete(op[1]);
      for (let h = res[0]; h < res[1]; h++) booked[h] -= res[2];
      return true;
    }
    const [, rid, s, e, g] = op;
    if (!(Number.isInteger(s) && Number.isInteger(e) && s >= 0 && s < e && e <= horizon && g > 0)) return false;
    for (let h = s; h < e; h++) if (booked[h] + g > capAt(h)) return false;
    for (let h = s; h < e; h++) booked[h] += g;
    active.set(rid, [s, e, g]);
    return true;
  });
}

const pyOp = (op) => op[0] === "cancel" ? `('cancel', '${op[1]}')` : `('reserve', '${op[1]}', ${op[2]}, ${op[3]}, ${op[4]})`;
const pyArgs = (c) => `(${c.horizon}, [${c.capacity.map(([f, g]) => `(${f}, ${g})`).join(", ")}], [${c.ops.map(pyOp).join(", ")}])`;
const pyOut = (xs) => "[" + xs.map((b) => (b ? "True" : "False")).join(", ") + "]";
const run = (c) => oracle(c.horizon, c.capacity, c.ops);

function randomCase(r, level) {
  for (let attempt = 0; attempt < 100; attempt++) {
    const horizon = r.int(12, 24);
    const base = 8 * r.int(4, 10);
    const capacity = [[0, base]];
    if (level === 3) {
      const cut = r.int(4, horizon - 4);
      capacity.push([cut, base + 8 * r.pick([-3, -2, 2, 3])]);
      if (r.chance(0.5)) capacity.push([r.int(cut + 1, horizon - 1), base + 8 * r.pick([-4, -1, 1, 4])]);
    }
    const ops = [];
    let made = 0;
    const n = r.int(8, 12);
    for (let i = 0; i < n; i++) {
      if (level >= 2 && made && r.chance(0.25)) { ops.push(["cancel", "r" + r.int(1, made + 1)]); continue; }
      made += 1;
      const s = r.int(0, horizon - 2);
      let e = r.int(s + 1, Math.min(horizon, s + r.int(3, 12)));
      let g = 8 * r.int(1, Math.max(1, Math.floor(base / 16)));
      if (level >= 2 && r.chance(0.12)) {
        const bad = r.int(0, 2);
        if (bad === 0) e = s;                          // empty range
        else if (bad === 1) e = horizon + r.int(1, 4); // past the book
        else g = 0;                                    // nothing requested
      }
      ops.push(["reserve", "r" + made, s, e, g]);
    }
    const c = { horizon, capacity, ops };
    const got = run(c).filter((_, i) => ops[i][0] === "reserve");
    if (got.some((x) => x) && got.some((x) => !x)) return c;
  }
  throw new Error("CRW-L2-01: could not build a sample with both outcomes");
}

export function generate(r, level) {
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const c = randomCase(r, level);
    samples.push({ args: pyArgs(c), expect: pyOut(run(c)) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const C = 8 * r.int(6, 16);                 // pool size in GPUs
  const H = r.int(20, 40);
  const a = r.int(2, 6), b = a + r.int(4, 8);
  const half = C / 2;
  const R = (id, s, e, g) => ["reserve", id, s, e, g];
  const edges = [
    ["a request that brings an hour exactly to capacity is accepted",
      { horizon: H, capacity: [[0, C]], ops: [R("r1", a, b, half), R("r2", a, b, half)] }],
    ["one GPU over capacity in a single hour is rejected",
      { horizon: H, capacity: [[0, C]], ops: [R("r1", a, b, half), R("r2", b - 1, b + 3, half + 1), R("r3", b, b + 3, half + 1)] }],
    ["hours are half-open: a request ending at hour h does not touch hour h",
      { horizon: H, capacity: [[0, C]], ops: [R("r1", a, b, C), R("r2", b, b + 2, C), R("r3", a - 1, a, C)] }],
    ["a rejected request books nothing",
      { horizon: H, capacity: [[0, C]], ops: [R("r1", a, b, half), R("r2", a, b, C), R("r3", a + 1, b, half)] }],
    ["a request covering the whole book",
      { horizon: H, capacity: [[0, C]], ops: [R("r1", 0, H, C - 8), R("r2", H - 1, H, 8), R("r3", 0, 1, 16)] }],
    ["many small requests fill an hour one at a time",
      { horizon: H, capacity: [[0, C]], ops: Array.from({ length: C / 8 + 1 }, (_, i) => R("r" + (i + 1), a + (i % 3), b, 8)) }],
  ];
  if (level >= 2) {
    edges.push(["a cancellation frees the hours for a later request",
      { horizon: H, capacity: [[0, C]], ops: [R("r1", a, b, C), R("r2", a + 1, b + 1, half), ["cancel", "r1"], R("r3", a + 1, b + 1, half)] }]);
    edges.push(["cancelling twice, a rejected request or an unknown id releases nothing",
      { horizon: H, capacity: [[0, C]], ops: [R("r1", a, b, C), R("r2", a, b, 8), ["cancel", "r2"], ["cancel", "r9"], ["cancel", "r1"], ["cancel", "r1"], R("r3", a, b, C)] }]);
    edges.push(["malformed requests are rejected and book nothing",
      { horizon: H, capacity: [[0, C]], ops: [R("r1", a, a, 8), R("r2", b, a, 8), R("r3", H - 2, H + 1, 8), R("r4", a, b, 0), R("r5", -1, a, 8), R("r6", a, b, C)] }]);
  }
  if (level === 3) {
    const cut = b - 1;
    edges.push(["a planned reduction inside the range blocks a request that fits before it",
      { horizon: H, capacity: [[0, C], [cut, half]], ops: [R("r1", a, b, half + 8), R("r2", a, cut, half + 8), R("r3", cut, b + 2, half)] }]);
    edges.push(["a planned addition only helps from its hour on",
      { horizon: H, capacity: [[0, half], [b, C]], ops: [R("r1", b, b + 3, C), R("r2", b - 1, b + 3, half + 8), R("r3", a, b, half)] }]);
    edges.push(["capacity steps down to zero for a decommissioned hall",
      { horizon: H, capacity: [[0, C], [b, 0], [b + 4, C]], ops: [R("r1", a, b, 8), R("r2", b + 1, b + 3, 8), R("r3", b + 4, b + 6, C)] }]);
  }
  for (const [name, c] of edges) tests.push({ name, args: pyArgs(c), expect: pyOut(run(c)) });

  // Timing: compared with the reference at check time. Six years of hourly slots and
  // requests that span years, so every per-hour scan (in Python or a C slice) is long.
  const seed = r.int(1, 1_000_000);
  const [cancelPct, steps, cap] = level === 1 ? [0, 1, 300000] : level === 2 ? [30, 1, 150000] : [30, 4, 150000];
  tests.push({
    name: "60,000 operations on a six-year hourly book in time",
    args: `_gen_book(52560, 60000, ${seed}, ${cancelPct}, ${steps}, ${cap})`,
    limit_s: 8,
  });

  const gpu = r.pick(["H100", "H200", "B200", "GB200", "L40S", "A100"]);
  const region = r.pick(["US-EAST", "US-WEST", "US-CENTRAL", "EU-NORTH", "EU-SOUTH", "UK"]);
  return {
    vars: {
      pool: `the ${gpu} pool in a hypothetical ${region} region`,
      level_rule: level === 1
        ? "In this exercise every op is a reservation, every request is well formed, and capacity is one step at hour 0."
        : level === 2
          ? "Ops include cancellations, and some requests are malformed: a request is rejected unless `0 ≤ start < end ≤ horizon` and `gpus > 0`. Capacity is one step at hour 0."
          : "Ops include cancellations and malformed requests (rejected unless `0 ≤ start < end ≤ horizon` and `gpus > 0`), and capacity has several steps: planned additions raise it and planned reductions lower it, possibly to 0. Reductions are known when the book is built, so no accepted reservation is ever over capacity.",
    },
    samples,
    tests,
  };
}
