/* OAI-L1-05 — Global p95 per window from K regional latency streams (Python).
   Simulated practice scenario. All data is generated from the seed.

   Contract (python): see OAI-L1-04.mjs.
   level: 1 Medium    tumbling windows; empty windows are None
          2 Hard      + a minimum sample count per window, empty regional logs,
                        events before t0
          3 Very Hard + hopping windows (width > step): an event counts in every
                        window that contains it

   The timing test hands the function K lazy regional streams that are about 80 times
   longer than the report needs. A k-way merge with a heap reads only what the report
   needs; materialising and sorting the streams does not finish in time. */
export const kind = "python";
export const entry = "window_p95";
export const signature = "def window_p95(logs: list[Iterable[tuple[int, int]]], t0: int, width: int, n_windows: int, step: int | None = None, min_count: int = 1) -> list[int | None]:";
export const starter = `import heapq

def window_p95(logs, t0, width, n_windows, step=None, min_count=1):
    """logs: one iterable per region of (ts_ms, latency_ms), each sorted by ts_ms.
    Window i covers [t0 + i*step, t0 + i*step + width); step defaults to width.
    Return, per window, the nearest-rank p95 latency, or None."""
    ...
`;

export const prelude = `
def _region_stream(seed, n, t_start=0, step_max=8, lat_max=2400):
    x, ts = seed, t_start
    for _ in range(n):
        x = (1103515245 * x + 12345) % 2147483648
        ts += (x >> 16) % (step_max + 1)
        x = (1103515245 * x + 12345) % 2147483648
        lat = 20 + (x >> 16) % lat_max
        if (x >> 8) % 97 == 0:
            lat *= 12
        yield (ts, lat)
`.trim() + "\n";

// Brute force over every event for every window. Correct and slow; small inputs only.
export function oracle(logs, t0, width, n, step, minCount) {
  const st = step == null ? width : step;
  const mc = minCount == null ? 1 : minCount;
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = t0 + i * st, b = a + width;
    const vals = [];
    for (const log of logs) for (const [t, v] of log) if (t >= a && t < b) vals.push(v);
    if (!vals.length || vals.length < mc) { out.push(null); continue; }
    vals.sort((x, y) => x - y);
    const rank = Math.floor((95 * vals.length + 99) / 100);      // ceil(0.95 * n), in integers
    out.push(vals[rank - 1]);
  }
  return out;
}

const pyVal = (v) => (v === null ? "None" : String(v));
const pyList = (xs) => "[" + xs.map(pyVal).join(", ") + "]";
function pyArgs(logs, t0, width, n, step, minCount) {
  const lg = "[" + logs.map((log) => "[" + log.map(([t, v]) => `(${t}, ${v})`).join(", ") + "]").join(", ") + "]";
  let s = `(${lg}, ${t0}, ${width}, ${n}`;
  if (step != null || minCount != null) s += `, ${step == null ? "None" : step}`;
  if (minCount != null) s += `, ${minCount}`;
  return s + ")";
}
function tc(name, logs, t0, width, n, step, minCount) {
  return { name, args: pyArgs(logs, t0, width, n, step, minCount), expect: pyList(oracle(logs, t0, width, n, step, minCount)) };
}

// A small random case: K sorted regional logs around [t0, end).
function smallCase(r, level) {
  const K = level === 1 ? r.int(2, 3) : r.int(3, 4);
  const width = r.pick([500, 1000, 2000]);
  const step = level === 3 ? width / r.pick([2, 4]) : null;
  const n = level === 3 ? r.int(4, 6) : r.int(3, 4);
  const t0 = r.int(1, 9) * 1000;
  const span = (step ?? width) * (n - 1) + width;
  const minCount = level >= 2 ? r.pick([3, 5, 8]) : null;
  const logs = [];
  for (let k = 0; k < K; k++) {
    if (level >= 2 && k === K - 1 && r.chance(0.4)) { logs.push([]); continue; }   // a quiet region
    const log = [];
    let t = t0 - (level >= 2 ? r.int(0, 400) : 0);
    const mean = Math.max(10, Math.floor(span / r.int(10, 18)));
    while (true) {
      t += r.int(0, 2 * mean);
      if (t >= t0 + span + 300) break;
      const slow = r.chance(0.06);
      log.push([t, slow ? r.int(4000, 30000) : r.int(40, 1500)]);
    }
    logs.push(log);
  }
  // One window left empty (level 1) or thin (levels 2-3), so None appears.
  if (r.chance(0.6)) {
    const i = r.int(0, n - 1);
    const a = t0 + i * (step ?? width), b = a + width;
    for (const log of logs) {
      const keep = log.filter(([t]) => t < a || t >= b);
      const inside = log.filter(([t]) => t >= a && t < b);
      log.length = 0;
      log.push(...keep, ...(level === 1 ? [] : inside.slice(0, 1)));
      log.sort((x, y) => x[0] - y[0]);
    }
  }
  return { logs, t0, width, n, step, minCount };
}

export function generate(r, level) {
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const c = smallCase(r, level);
    samples.push({ args: pyArgs(c.logs, c.t0, c.width, c.n, c.step, c.minCount), expect: pyList(oracle(c.logs, c.t0, c.width, c.n, c.step, c.minCount)) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  // Exact-boundary edge cases.
  const W = r.pick([1000, 5000, 60000]);
  const t0 = r.int(1, 50) * 1000;
  const base = r.int(80, 400);
  const ramp = (m, k0 = 0) => [...Array(m)].map((_, i) => base + 10 * (i + k0));
  const interleave = (vals, regions) => {               // spread values over regions, each log sorted by ts
    const logs = [...Array(regions)].map(() => []);
    const order = r.shuffle(vals);
    order.forEach((v, i) => logs[i % regions].push([t0 + i, v]));
    return logs;
  };
  tests.push(tc(`an event at exactly t0 + width belongs to the next window`, [[[t0 + W - 1, base], [t0 + W, base + 500]]], t0, W, 2));
  tests.push(tc(`an event at t0 − 1 is before the first window`, [[[t0 - 1, 9999], [t0, base]]], t0, W, 1));
  tests.push(tc(`20 values: rank ceil(0.95 × 20) = 19, not the maximum`, interleave(ramp(20), 3), t0, W, 1));
  tests.push(tc(`21 values: rank ceil(0.95 × 21) = 20`, interleave(ramp(21), 2), t0, W, 1));
  tests.push(tc(`a window with no events is None`, [[[t0 + 5, base]], [[t0 + 2 * W + 7, base + 30]]], t0, W, 3));
  tests.push(tc(`equal timestamps in different regions both count`, [[[t0 + 3, base], [t0 + 9, base + 1]], [[t0 + 3, base + 900]], [[t0 + 3, base + 2]]], t0, W, 1));
  tests.push(tc(`duplicate latencies are separate samples`, [[[t0, base], [t0 + 1, base], [t0 + 2, base]], [[t0 + 1, base + 5]]], t0, W, 1));
  if (level >= 2) {
    const mc = r.pick([3, 4, 5]);
    const exact = [...Array(mc)].map((_, i) => [t0 + i, base + 7 * i]);
    tests.push(tc(`exactly min_count = ${mc} events is reported`, [exact, []], t0, W, 1, null, mc));
    tests.push(tc(`min_count − 1 events is None`, [exact.slice(1), []], t0, W, 1, null, mc));
    tests.push(tc(`every regional log empty`, [[], [], []], t0, W, 2, null, 1));
  }
  if (level === 3) {
    const S = W / 4;
    tests.push(tc(`hopping windows (width = 4 × step): one event counts in four windows`, [[[t0 + 3 * S, base]]], t0, W, 6, S));
    tests.push(tc(`hopping: an event at t0 + width leaves window 0 and stays in the later ones`, [[[t0, base], [t0 + W, base + 400]]], t0, W, 5, S));
  }

  // Timing: eight lazy regional streams of 2 000 000 events each (≈ 4 ms apart per region).
  // The report covers about 1/80 of them, so reading lazily is the point.
  const seed = r.int(1, 1_000_000);
  const n = 100;
  const width = level === 3 ? 4000 : 1000;
  const step = level === 3 ? 1000 : null;
  const t0t = r.int(2, 9) * 1000;
  const streams = `[_region_stream(${seed} + 7919 * k, 2000000) for k in range(8)]`;
  const extra = level === 3 ? `, ${step}, 50` : level === 2 ? ", None, 50" : "";
  tests.push({ name: `8 regional streams of 2 000 000 events: read only what ${n} windows need (k-way merge)`, args: `(${streams}, ${t0t}, ${width}, ${n}${extra})`, limit_s: 8 });

  return {
    vars: {
      window_rule: level === 3
        ? "Windows hop: window i covers `[t0 + i·step, t0 + i·step + width)`, `step` divides `width`, so windows overlap and an event counts in every window that contains it."
        : "Windows tumble: window i covers `[t0 + i·width, t0 + (i+1)·width)`; `step` is None (it defaults to `width`).",
      count_rule: level === 1
        ? "A window with no events reports None (`min_count` is 1)."
        : "A window with fewer than `min_count` events reports None: a p95 of three samples is noise. A regional log can be empty, and logs can start before t0.",
    },
    samples,
    tests,
  };
}
