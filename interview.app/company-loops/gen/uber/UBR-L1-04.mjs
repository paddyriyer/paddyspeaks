/* UBR-L1-04 — Nearest available drivers on a hexagonal grid (Python).
   Simulated practice scenario. All data is generated from the seed and is hypothetical.

   Contract: see docs/COMPANY-INTERVIEW-LOOPS.md § Executable templates (python).
   Cells use axial coordinates (q, r); the distance between cells is
   (|dq| + |dr| + |dq + dr|) / 2. For each request, the answer is up to k open drivers
   within max_ring, ordered by (distance, driver_id). The oracle below scans every driver
   for every request (small inputs only); the evaluator's reference walks rings outward
   from the request's cell over a cell index, written independently.
   level: 1 Medium (one update per driver, all open)
          2 Hard (+ a stream of updates: later rows move drivers and change their status)
          3 Very Hard (+ dispatch: each request claims the first driver on its list, who is
                       no longer available to later requests) */
export const kind = "python";
export const entry = "nearest_drivers";
export const signature = "def nearest_drivers(updates: list[tuple[str, int, int, str]], requests: list[tuple[int, int]], k: int, max_ring: int, claim: bool = False) -> list[list[str]]:";
export const starter = `def nearest_drivers(updates, requests, k, max_ring, claim=False):
    """updates:  (driver_id, q, r, status) in arrival order; status is 'open', 'on_trip' or 'offline'.
    requests: (q, r) cells, in order.
    Return one list of driver ids per request: up to k open drivers within max_ring rings,
    nearest first, ties by driver_id."""
    ...
`;

export const prelude = `
def _gen_fleet(n_updates, n_drivers, n_requests, side, seed, statuses=('open',)):
    x = seed
    def rnd(m):
        nonlocal x
        x = (1103515245 * x + 12345) % 2147483648
        return (x >> 8) % m
    updates = []
    for _ in range(n_updates):
        d = rnd(n_drivers)
        updates.append(('drv_%06d' % d, rnd(side) - side // 2, rnd(side) - side // 2, statuses[rnd(len(statuses))]))
    requests = [(rnd(side) - side // 2, rnd(side) - side // 2) for _ in range(n_requests)]
    return updates, requests
`.trim() + "\n";

const dist = (a, b) => (Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[0] - b[0] + a[1] - b[1])) / 2;
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

// Brute force: final state per driver, then every request scans every driver.
export function oracle(updates, requests, k, maxRing, claim) {
  const last = new Map();
  for (const [id, q, r, st] of updates) last.set(id, [q, r, st]);
  const open = new Map([...last].filter(([, v]) => v[2] === "open"));
  return requests.map((req) => {
    const cand = [];
    for (const [id, [q, r]] of open) {
      const d = dist(req, [q, r]);
      if (d <= maxRing) cand.push([d, id]);
    }
    cand.sort((a, b) => a[0] - b[0] || cmp(a[1], b[1]));
    const out = cand.slice(0, k).map((c) => c[1]);
    if (claim && out.length) open.delete(out[0]);
    return out;
  });
}

const pyStr = (s) => `'${s}'`;
const pyList = (xs) => "[" + xs.map((l) => "[" + l.map(pyStr).join(", ") + "]").join(", ") + "]";
const pyArgs = (updates, requests, k, maxRing, claim) =>
  `([${updates.map(([id, q, r, st]) => `('${id}', ${q}, ${r}, '${st}')`).join(", ")}], ` +
  `[${requests.map(([q, r]) => `(${q}, ${r})`).join(", ")}], ${k}, ${maxRing}, ${claim ? "True" : "False"})`;

function randomCase(r, level) {
  const n = level === 1 ? r.int(6, 9) : r.int(8, 12);
  const span = 5;
  const ids = r.sample([...Array(60)].map((_, i) => "drv_" + String(100 + i * 7 + r.int(0, 6))), n);
  const updates = ids.map((id) => [id, r.int(-span, span), r.int(-span, span), "open"]);
  if (level >= 2) {
    for (let j = 0; j < n; j++) {
      const id = r.pick(ids);
      updates.push([id, r.int(-span, span), r.int(-span, span), r.pick(["open", "open", "on_trip", "offline"])]);
    }
  }
  const requests = [...Array(r.int(3, 5))].map(() => [r.int(-span, span), r.int(-span, span)]);
  if (level === 3) requests.push(requests[0].slice());       // the same cell twice: the second sees one driver fewer
  return { updates, requests, k: r.int(2, 4), maxRing: r.int(2, 5), claim: level === 3 };
}

export function generate(r, level) {
  const claim = level === 3;
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const c = randomCase(r, level);
    samples.push({ args: pyArgs(c.updates, c.requests, c.k, c.maxRing, c.claim), expect: pyList(oracle(c.updates, c.requests, c.k, c.maxRing, c.claim)) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const q0 = r.int(-20, 20), r0 = r.int(-20, 20);
  const at = (dq, dr) => [q0 + dq, r0 + dr];
  const A = "drv_" + r.int(200, 499), B = "drv_" + r.int(500, 799), C = "drv_" + r.int(800, 999);
  const u = (id, [q, rr], st = "open") => [id, q, rr, st];
  const R = r.int(3, 6);
  const edges = [
    ["hex distance is not max(|dq|, |dr|): (+2, +2) is 4 rings away, (+3, -3) is 3",
      [u(A, at(2, 2)), u(B, at(3, -3))], [at(0, 0)], 1, 6],
    ["a driver in the request's own cell is at distance 0", [u(A, at(1, 0)), u(B, at(0, 0))], [at(0, 0)], 2, 3],
    ["equal distance: ties by driver_id as strings", [u("drv_99", at(0, 2)), u("drv_100", at(-2, 0)), u("drv_7", at(1, 1))], [at(0, 0)], 3, 3],
    ["max_ring is inclusive", [u(A, at(R, 0)), u(B, at(0, -(R + 1)))], [at(0, 0)], 5, R],
    ["fewer than k in range returns a shorter list, nobody returns []", [u(A, at(1, -1))], [at(0, 0), at(R + 3, 0)], 4, R],
    ["several drivers share a cell", [u(C, at(2, -1)), u(A, at(2, -1)), u(B, at(2, -1))], [at(0, 0)], 2, 4],
  ];
  if (level >= 2) {
    edges.push(["a later update moves the driver", [u(A, at(1, 0)), u(B, at(2, 0)), u(A, at(4, 0))], [at(0, 0)], 1, 5]);
    edges.push(["a driver who went on a trip is not available", [u(A, at(1, 0)), u(B, at(2, 0)), u(A, at(1, 0), "on_trip")], [at(0, 0)], 2, 5]);
    edges.push(["on a trip, then open again elsewhere", [u(A, at(1, 0), "on_trip"), u(B, at(2, 0)), u(A, at(-3, 3), "open")], [at(0, 0)], 2, 5]);
    edges.push(["offline drivers are not available", [u(A, at(0, 1), "offline"), u(B, at(0, 2))], [at(0, 0)], 2, 5]);
  }
  if (level === 3) {
    edges.push(["two requests, one nearby driver: the second gets the next one", [u(A, at(0, 1)), u(B, at(0, 3))], [at(0, 0), at(0, 0)], 2, 5]);
    edges.push(["a request that finds nobody claims nobody", [u(A, at(0, 1))], [at(R + 4, 0), at(0, 0)], 1, R]);
    edges.push(["a claimed driver is gone even from a cell far away", [u(A, at(0, 0)), u(B, at(5, 0))], [at(0, 0), at(4, 0), at(4, 0)], 1, 6]);
  }
  for (const [name, ups, reqs, k, mr] of edges) tests.push({ name, args: pyArgs(ups, reqs, k, mr, claim), expect: pyList(oracle(ups, reqs, k, mr, claim)) });

  // Timing: 100 000 updates for 60 000 drivers on a 500 x 500 city, 15 000 requests.
  // Scanning every driver per request is ~7 x 10^8 distance checks; a cell index and a few
  // rings per request is well under a second.
  const statuses = level === 1 ? "('open',)" : "('open', 'open', 'on_trip', 'offline')";
  tests.push({
    name: "100,000 updates, 15,000 requests on a 500 x 500 grid (cell index, rings outward)",
    args: `(*_gen_fleet(100000, 60000, 15000, 500, ${r.int(1, 1_000_000)}, ${statuses}), ${r.pick([5, 8])}, ${r.pick([6, 8])}, ${claim ? "True" : "False"})`,
    limit_s: 8,
  });

  return {
    vars: {
      update_rule: level === 1
        ? "In this exercise every driver appears once in `updates` and is `'open'`."
        : "`updates` is a stream: a driver can appear many times, and only their last row counts (their current cell and status). Only drivers whose last status is `'open'` are available.",
      claim_rule: claim
        ? "`claim` is `True`: requests are dispatched in order, and each request claims the first driver on its list (if any), who is then unavailable to every later request."
        : "In this exercise `claim` is always `False`: requests do not change who is available.",
    },
    samples,
    tests,
  };
}
