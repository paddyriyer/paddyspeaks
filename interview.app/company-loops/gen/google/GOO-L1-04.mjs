/* GOO-L1-04 — Trending queries per window with a lateness bound (Python).
   Simulated practice scenario. All data is generated from the seed.

   Contract: see docs/COMPANY-INTERVIEW-LOOPS.md § Executable templates (python).
   level: 1 Medium (tumbling windows, watermark = max event time - lateness, late events dropped)
          2 Hard (+ count ties, a window end exactly at the watermark, late events that open a new window)
          3 Very Hard (+ distinct_users: a query counts each user once per window) */
export const kind = "python";
export const entry = "trending";
export const signature = "def trending(events: list[tuple[int, str, str]], width: int, lateness: int, k: int, distinct_users: bool = False) -> tuple[list[tuple[int, list[tuple[str, int]]]], int]:";
export const starter = `import heapq

def trending(events, width, lateness, k, distinct_users=False):
    """events: (event_ts, user_id, query) in ARRIVAL order (not sorted by event_ts).
    Return (windows, dropped): windows is a list of (window_start, top) in ascending
    window_start, top is up to k (query, count) pairs by count desc then query asc;
    dropped is the number of events that arrived after their window had closed."""
    ...
`;

export const prelude = `
def _gen_search(n, n_queries, n_users, seed, jitter, step_max=2):
    x, base, out = seed, 0, []
    for _ in range(n):
        x = (1103515245 * x + 12345) % 2147483648
        base += (x >> 16) % (step_max + 1)
        x = (1103515245 * x + 12345) % 2147483648
        late = (x >> 8) % (jitter + 1) if (x >> 20) % 8 == 0 else 0
        x = (1103515245 * x + 12345) % 2147483648
        a = (x >> 16) % n_queries
        x = (1103515245 * x + 12345) % 2147483648
        b = (x >> 16) % n_queries
        x = (1103515245 * x + 12345) % 2147483648
        out.append((max(0, base - late), 'u%d' % ((x >> 16) % n_users), 'q%d' % min(a, b)))
    return out
`.trim() + "\n";

// Independent oracle: decide acceptance against the watermark of the events before,
// then group what was accepted. (Emission order is ascending by construction.)
export function oracle(events, width, lateness, k, distinct) {
  let maxTs = null, dropped = 0;
  const wins = new Map();
  for (const [t, u, q] of events) {
    const start = t - (t % width);
    if (maxTs !== null && start + width <= maxTs - lateness) { dropped++; }
    else {
      if (!wins.has(start)) wins.set(start, new Map());
      const w = wins.get(start);
      if (!w.has(q)) w.set(q, distinct ? new Set() : 0);
      if (distinct) w.get(q).add(u); else w.set(q, w.get(q) + 1);
    }
    if (maxTs === null || t > maxTs) maxTs = t;
  }
  const out = [];
  for (const start of [...wins.keys()].sort((a, b) => a - b)) {
    const items = [...wins.get(start)].map(([q, v]) => [q, distinct ? v.size : v]);
    items.sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
    out.push([start, items.slice(0, k)]);
  }
  return [out, dropped];
}

const pyResult = ([wins, dropped]) =>
  "([" + wins.map(([s, top]) => `(${s}, [${top.map(([q, c]) => `('${q}', ${c})`).join(", ")}])`).join(", ") + `], ${dropped})`;
const pyArgs = (ev, width, lateness, k, distinct) =>
  `([${ev.map(([t, u, q]) => `(${t}, '${u}', '${q}')`).join(", ")}], ${width}, ${lateness}, ${k}, ${distinct ? "True" : "False"})`;

const QUERIES = ["eclipse", "election results", "news", "recipes", "stock market", "weather", "world cup"];

function smallCase(r, level, n) {
  const width = r.pick([10, 60]);
  const lateness = level === 1 ? r.pick([0, width]) : r.pick([0, width / 2, width, 2 * width]);
  const qs = r.sample(QUERIES, level === 1 ? 3 : 4);
  const users = ["u1", "u2", "u3"].slice(0, level === 3 ? 2 : 3);
  const ev = [];
  let base = r.int(0, 3 * width);
  for (let i = 0; i < n; i++) {
    base += r.pick([0, 1, 3, width / 2, width]);
    const late = r.chance(0.3) ? r.int(1, lateness + 2 * width) : 0;
    ev.push([Math.max(0, base - late), r.pick(users), r.pick(qs)]);
  }
  return { ev, width, lateness, k: r.pick([1, 2, 3]), distinct: level === 3 };
}

export function generate(r, level) {
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const c = smallCase(r, level, 8 + 2 * i);
    samples.push({ args: pyArgs(c.ev, c.width, c.lateness, c.k, c.distinct), expect: pyResult(oracle(c.ev, c.width, c.lateness, c.k, c.distinct)) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const W = r.pick([10, 60]);
  const q1 = r.pick(["eclipse", "news"]), q2 = r.pick(["weather", "world cup"]);
  const edges = [
    ["no events", [], W, 0, 3, false],
    ["an event at exactly the window end belongs to the next window", [[0, "u1", q1], [W, "u1", q2], [W - 1, "u2", q1]], W, W, 2, false],
    ["lateness 0: a window closes when the watermark reaches its end", [[1, "u1", q1], [W, "u1", q2], [W - 1, "u2", q1]], W, 0, 2, false],
    ["late but inside the lateness bound is kept", [[3 * W, "u1", q1], [3 * W - 5, "u2", q2], [2 * W + 1, "u3", q2]], W, W, 3, false],
    ["k larger than the number of queries", [[1, "u1", q1], [2, "u2", q2], [3, "u3", q2]], W, 0, 5, false],
  ];
  if (level >= 2) {
    edges.push(["equal counts are ordered by query", [[1, "u1", q2], [2, "u2", q1], [3, "u3", q2], [4, "u1", q1], [5, "u2", "recipes"]], W, 0, 2, false]);
    edges.push(["a late event opens a window that has not closed yet", [[5 * W, "u1", q1], [4 * W + 2, "u2", q2], [6 * W, "u1", q1], [4 * W + 3, "u3", q2]], W, 2 * W, 2, false]);
    edges.push(["the watermark does not move back when an older event arrives", [[4 * W, "u1", q1], [W, "u2", q2], [2 * W - 1, "u3", q2], [2 * W, "u1", q1]], W, 2 * W, 2, false]);
  }
  if (level === 3) {
    edges.push(["distinct users: one user repeating a query counts once", [[1, "u1", q1], [2, "u1", q1], [3, "u1", q1], [4, "u2", q2], [5, "u3", q2]], W, 0, 2, true]);
    edges.push(["distinct users: the same user in two windows counts in both", [[1, "u1", q1], [W + 1, "u1", q1], [W + 2, "u1", q1]], W, W, 1, true]);
  }
  for (const [name, ev, width, lat, k, d] of edges) tests.push({ name, args: pyArgs(ev, width, lat, k, d), expect: pyResult(oracle(ev, width, lat, k, d)) });

  // Timing: ~3 300 one-minute windows with ~2 500 open at once (lateness 150 000 s).
  // Rescanning every open window on every event is ~5·10⁸ steps (over 11 s in CPython);
  // a heap of window starts pops each window once (well under a second).
  const seed = r.int(1, 1_000_000);
  const n = 200000;
  tests.push({
    name: `${n.toLocaleString("en-US")} events, ~2 500 windows open at once, in time`,
    args: `(_gen_search(${n}, ${level === 1 ? 300 : 600}, 5000, ${seed}, 180000), 60, 150000, ${level === 1 ? 5 : 10}, ${level === 3 ? "True" : "False"})`,
    limit_s: 8,
  });

  return {
    vars: {
      count_rule: level === 3
        ? "When `distinct_users` is true (it is in this round), a query's count in a window is the number of **distinct** `user_id`s that searched it there, not the number of searches."
        : "`distinct_users` is false in this round: a query's count is the number of accepted searches for it in the window.",
      tie_rule: level === 1
        ? "Order `top` by count descending, then query ascending."
        : "Order `top` by count descending, then query ascending; ties are common, so the tie-break matters.",
    },
    samples,
    tests,
  };
}
