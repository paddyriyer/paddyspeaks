/* AMZ-L1-05 — Dock doors for inbound trailers at a fulfilment centre (Python).
   Simulated practice scenario. All data is generated from the seed and is hypothetical.

   Contract: see docs/COMPANY-INTERVIEW-LOOPS.md § Executable templates (python).
   At any moment, the most urgent waiting trailer (priority, then arrival, then trailer_id)
   takes the lowest-numbered free door; a door whose unload ends at t is free at t.
   The oracle below jumps from assignment to assignment and rescans every trailer and door
   (quadratic, small inputs only); the evaluator's reference is an independently written
   event simulation with heaps.
   level: 1 Medium (one priority, arrivals sorted and distinct)
          2 Hard (+ equal arrival minutes, input in any order, doors freed exactly on arrival)
          3 Very Hard (+ priorities: an urgent trailer overtakes earlier arrivals in the yard) */
export const kind = "python";
export const entry = "assign_doors";
export const signature = "def assign_doors(trailers: list[tuple[int, str, int, int]], doors: int) -> dict[str, tuple[int, int]]:";
export const starter = `import heapq

def assign_doors(trailers, doors):
    """trailers: (arrival_min, trailer_id, unload_min, priority); 0 is the most urgent.
    Doors are numbered 1..doors. Return {trailer_id: (door, start_min)}."""
    ...
`;

export const prelude = `
def _gen_trailers(n, seed, max_step, unload_lo, unload_hi, n_prio=1):
    x, t, out = seed, 0, []
    for i in range(n):
        x = (1103515245 * x + 12345) % 2147483648
        t += (x >> 16) % (max_step + 1)
        x = (1103515245 * x + 12345) % 2147483648
        u = unload_lo + (x >> 8) % (unload_hi - unload_lo + 1)
        x = (1103515245 * x + 12345) % 2147483648
        out.append((t, 'TRL-%07d' % ((i * 7919 + seed) % 10000000), u, (x >> 16) % n_prio))
    return out
`.trim() + "\n";

const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

// Brute force: find the next assignment time, rescan everything. Small inputs only.
export function oracle(trailers, doors) {
  const freeAt = Array(doors).fill(-Infinity);
  const left = trailers.slice();
  const out = {};
  let now = -Infinity;
  while (left.length) {
    const t = Math.max(now, Math.min(...left.map((x) => x[0])), Math.min(...freeAt));
    const ready = left.filter((x) => x[0] <= t).sort((a, b) => a[3] - b[3] || a[0] - b[0] || cmp(a[1], b[1]));
    const head = ready[0];
    const d = freeAt.findIndex((f) => f <= t);
    out[head[1]] = [d + 1, t];
    freeAt[d] = t + head[2];
    left.splice(left.indexOf(head), 1);
    now = t;
  }
  return out;
}

const pyDict = (o) => "{" + Object.keys(o).sort().map((k) => `'${k}': (${o[k][0]}, ${o[k][1]})`).join(", ") + "}";
const pyArgs = (ts, doors) => `([${ts.map(([a, id, u, p]) => `(${a}, '${id}', ${u}, ${p})`).join(", ")}], ${doors})`;

function smallCase(r, level, n) {
  const doors = r.int(2, 3);
  const ids = r.shuffle([...Array(60)].map((_, i) => "TRL-" + String(1000 + i * 17 + r.int(0, 9)).padStart(4, "0")));
  const steps = level === 1 ? [5, 10, 20, 45] : [0, 0, 5, 10, 30];
  const ts = [];
  let t = r.int(0, 30);
  for (let i = 0; i < n; i++) {
    if (i) t += r.pick(steps);
    ts.push([t, ids[i], r.int(2, 9) * 10, level === 3 ? r.int(0, 2) : 0]);
  }
  return { ts: level === 1 ? ts : r.shuffle(ts), doors };
}

export function generate(r, level) {
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const { ts, doors } = smallCase(r, level, 5 + i);
    samples.push({ args: pyArgs(ts, doors), expect: pyDict(oracle(ts, doors)) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const t0 = r.int(1, 40) * 5;
  const U = r.pick([30, 45, 60]);
  const [A, B, C, D] = r.sample(["TRL-2041", "TRL-2187", "TRL-2290", "TRL-2335", "TRL-2468", "TRL-2502"], 4).sort();
  const edges = [
    ["a door whose unload ends at minute t serves a trailer arriving at t", [[t0, A, U, 0], [t0 + U, B, 10, 0]], 1],
    ["the lowest-numbered free door is used", [[t0, A, 3 * U, 0], [t0 + 1, B, 5, 0], [t0 + 20, C, 10, 0]], 3],
    ["a trailer waits in the yard while every door is busy", [[t0, A, U, 0], [t0 + 5, B, 10, 0]], 1],
    ["waiting trailers are served in arrival order", [[t0, A, U, 0], [t0 + 5, C, 10, 0], [t0 + 10, B, 10, 0]], 1],
  ];
  if (level >= 2) {
    edges.push(["same arrival minute: the smaller trailer_id goes first", [[t0, B, U, 0], [t0, A, U, 0], [t0, C, U, 0]], 2]);
    edges.push(["the input is not sorted by arrival", [[t0 + 30, C, 10, 0], [t0, A, U, 0], [t0 + 10, B, 10, 0]], 1]);
    edges.push(["two doors free up at the same minute: lowest number first", [[t0, A, U, 0], [t0, B, U, 0], [t0 + U, C, 10, 0], [t0 + U, D, 10, 0]], 2]);
  }
  if (level === 3) {
    edges.push(["an urgent trailer overtakes one that has waited longer", [[t0, A, U, 1], [t0 + 5, B, 10, 1], [t0 + 20, C, 10, 0]], 1]);
    edges.push(["urgency never interrupts an unload in progress", [[t0, A, U, 2], [t0 + 10, B, 10, 0]], 1]);
    edges.push(["an urgent trailer arriving as a door frees takes it", [[t0, A, U, 1], [t0 + 5, B, 10, 1], [t0 + U, C, 10, 0]], 1]);
  }
  for (const [name, ts, doors] of edges) tests.push({ name, args: pyArgs(ts, doors), expect: pyDict(oracle(ts, doors)) });

  // Timing: arrivals outpace the doors for most of the run, so the yard queue grows to tens of
  // thousands of trailers. Scanning the yard (or every door) per assignment is far too slow.
  const seed = r.int(1, 1_000_000);
  const n = level === 1 ? 150000 : 200000;
  const doors = level === 1 ? 200 : 300;
  const gen = `_gen_trailers(${n}, ${seed}, 1, 60, 400, ${level === 3 ? 3 : 1})`;
  tests.push({ name: `${n.toLocaleString("en-US")} trailers, ${doors} doors in time (heaps: O(n log n))`, args: `(${level === 1 ? gen : `list(reversed(${gen}))`}, ${doors})`, limit_s: 8 });

  return {
    vars: {
      order_rule:
        level === 1
          ? "In the samples `trailers` is sorted by arrival and no two trailers arrive in the same minute."
          : "`trailers` can be in any order, and several trailers can arrive in the same minute.",
      priority_rule:
        level === 3
          ? "Priorities are 0, 1 or 2; a more urgent trailer takes the next free door ahead of less urgent ones that arrived earlier, but never interrupts an unload in progress."
          : "Every trailer has priority 0, so the yard is first come, first served.",
    },
    samples,
    tests,
  };
}
