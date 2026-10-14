/* ANT-L1-04 — Tool-use call telemetry: outcomes per tool and peak calls in flight (Python).
   Simulated practice scenario. All data is generated from the seed; tool names,
   timeouts and traffic are hypothetical.

   Contract: see docs/COMPANY-INTERVIEW-LOOPS.md § Executable templates (python).
   level: 1 Medium (one use and at most one result per call; late results; no result)
          2 Hard (+ re-delivered uses and results, results for unknown ids, a result at
                  exactly the timeout, events sharing a millisecond)
          3 Very Hard (+ the same tool_use_id in two conversations, a result logged before
                       its use, zero-length calls, a call ending as another starts) */
export const kind = "python";
export const entry = "tool_call_stats";
export const signature = "def tool_call_stats(events: list[tuple[int, str, str, str, str | None, bool]], timeout_ms: int) -> tuple[dict[str, list[int]], int, int]:";
export const starter = `def tool_call_stats(events, timeout_ms):
    """events: (ts_ms, conversation_id, kind, tool_use_id, tool_name, is_error), sorted by ts_ms.
    kind is 'use' or 'result'; tool_name is None on results; is_error is False on uses.
    Return (per_tool, unmatched_results, peak_in_flight) where
    per_tool[tool_name] = [calls, ok, errors, timed_out]."""
    ...
`;

export const prelude = `
def _gen_tool_events(n_calls, n_convs, seed, timeout_ms, tools=('search_docs', 'run_sql', 'fetch_url', 'create_ticket', 'calculator')):
    x, ts, raw = seed, 0, []
    for i in range(n_calls):
        x = (1103515245 * x + 12345) % 2147483648
        ts += (x >> 16) % 40
        x = (1103515245 * x + 12345) % 2147483648
        conv = 'conv_%d' % ((x >> 8) % n_convs)
        x = (1103515245 * x + 12345) % 2147483648
        tool = tools[(x >> 16) % len(tools)]
        tid = 'toolu_%07d' % i
        raw.append((ts, 2 * i, conv, 'use', tid, tool, False))
        x = (1103515245 * x + 12345) % 2147483648
        fate = (x >> 16) % 20
        x = (1103515245 * x + 12345) % 2147483648
        dur = (x >> 12) % (timeout_ms + timeout_ms // 3)
        if fate < 18:
            raw.append((ts + dur, 2 * i + 1, conv, 'result', tid, None, fate == 0))
        if fate == 19:
            raw.append((ts + dur, 2 * i + 1, conv, 'result', 'toolu_x%07d' % i, None, False))
    raw.sort()
    return [(t, c, k, d, n, e) for t, _, c, k, d, n, e in raw]
`.trim() + "\n";

// Independent oracle: group events per call first, then decide; brute-force peak.
export function oracle(events, timeout) {
  const calls = new Map();                         // key -> {tool, start, end, outcome}
  const order = [];
  let unmatched = 0;
  events.forEach(([t, conv, kind, id, tool, err], i) => {
    const key = conv + "\u0000" + id;
    let c = calls.get(key);
    if (kind === "use") {
      if (!c) { c = { tool, start: t, res: null }; calls.set(key, c); order.push(c); }
      return;
    }
    if (!c) { unmatched++; return; }
    if (c.res === null) c.res = { t, err };
  });
  const per = {};
  const spans = [];
  for (const c of order) {
    const s = (per[c.tool] = per[c.tool] || [0, 0, 0, 0]);
    s[0]++;
    if (c.res && c.res.t - c.start <= timeout) { s[c.res.err ? 2 : 1]++; spans.push([c.start, c.res.t]); }
    else { s[3]++; spans.push([c.start, c.start + timeout]); }
  }
  let peak = 0;
  for (const [t] of spans) {
    let n = 0;
    for (const [a, b] of spans) if (a <= t && t < b) n++;
    peak = Math.max(peak, n);
  }
  return [per, unmatched, peak];
}

const pyStr = (s) => (s === null ? "None" : `'${s}'`);
const pyBool = (b) => (b ? "True" : "False");
const pyEvents = (evs) => "[" + evs.map(([t, c, k, id, tool, e]) => `(${t}, '${c}', '${k}', '${id}', ${pyStr(tool)}, ${pyBool(e)})`).join(", ") + "]";
const pyResult = ([per, un, peak]) => "({" + Object.keys(per).sort().map((k) => `'${k}': [${per[k].join(", ")}]`).join(", ") + `}, ${un}, ${peak})`;
const pyArgs = (evs, timeout) => `(${pyEvents(evs)}, ${timeout})`;

const TOOLS = ["search_docs", "run_sql", "fetch_url", "create_ticket", "calculator", "lookup_order"];

function smallCase(r, level, nCalls, timeout) {
  const tools = r.sample(TOOLS, 3);
  const convs = level === 1 ? ["conv_a"] : ["conv_a", "conv_b"];
  const raw = [];
  let t = r.int(0, 500), seq = 0;
  for (let i = 0; i < nCalls; i++) {
    t += level >= 2 && r.chance(0.25) ? 0 : r.int(50, Math.floor(timeout / 2));
    const conv = r.pick(convs);
    const id = level === 3 && i > 0 && r.chance(0.25) ? `toolu_${String(i - 1).padStart(3, "0")}` : `toolu_${String(i).padStart(3, "0")}`;
    const tool = r.pick(tools);
    raw.push([t, seq++, conv, "use", id, tool, false]);
    if (level >= 2 && r.chance(0.2)) raw.push([t + r.int(0, 30), seq++, conv, "use", id, tool, false]);     // re-delivered
    const fate = r.int(0, 9);
    const dur = fate <= 1 ? timeout + r.int(1, 2000) : fate === 2 && level >= 2 ? timeout : level === 3 && fate === 3 ? 0 : r.int(1, timeout);
    if (fate !== 9) {
      const err = r.chance(0.25);
      raw.push([t + dur, seq++, conv, "result", id, null, err]);
      if (level >= 2 && r.chance(0.2)) raw.push([t + dur + r.int(0, 500), seq++, conv, "result", id, null, !err]);   // second result
    }
    if (level >= 2 && r.chance(0.15)) raw.push([t + r.int(1, 900), seq++, conv, "result", "toolu_9" + String(i).padStart(2, "0"), null, false]);
  }
  raw.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  return raw.map(([tt, , c, k, id, tool, e]) => [tt, c, k, id, tool, e]);
}

export function generate(r, level) {
  const timeout = r.pick([5000, 10000, 15000, 30000]);
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const evs = smallCase(r, level, 4 + i, timeout);
    samples.push({ args: pyArgs(evs, timeout), expect: pyResult(oracle(evs, timeout)) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const T = timeout, a = r.pick(TOOLS), b = r.pick(TOOLS.filter((x) => x !== a));
  const t0 = r.int(1000, 9000);
  const U = (t, id, tool = a, conv = "c1") => [t, conv, "use", id, tool, false];
  const R = (t, id, err = false, conv = "c1") => [t, conv, "result", id, null, err];
  const edges = [
    ["a result and an error result", [U(t0, "t1"), U(t0 + 5, "t2", b), R(t0 + 900, "t1"), R(t0 + 1200, "t2", true)]],
    ["a call with no result times out", [U(t0, "t1"), U(t0 + 10, "t2"), R(t0 + 50, "t2")]],
    [`a result ${T + 1} ms after its use is a timeout, and the late result is ignored`, [U(t0, "t1"), R(t0 + T + 1, "t1", true)]],
    ["two overlapping calls, then a third after both ended", [U(t0, "t1"), U(t0 + 10, "t2", b), R(t0 + 20, "t1"), R(t0 + 30, "t2"), U(t0 + 40, "t3")]],
    ["no events at all", []],
  ];
  if (level >= 2) {
    edges.push([`a result exactly ${T} ms after its use is on time`, [U(t0, "t1"), R(t0 + T, "t1")]]);
    edges.push(["a re-delivered use and a second result are ignored", [U(t0, "t1"), U(t0 + 3, "t1"), R(t0 + 100, "t1", true), R(t0 + 120, "t1")]]);
    edges.push(["a result for an id never used is unmatched", [U(t0, "t1"), R(t0 + 40, "zz9"), R(t0 + 50, "t1")]]);
    edges.push(["several events in the same millisecond, in list order", [U(t0, "t1"), U(t0, "t2"), R(t0 + 7, "t1"), R(t0 + 7, "t2", true), U(t0 + 7, "t3", b)]]);
  }
  if (level === 3) {
    edges.push(["the same tool_use_id in two conversations is two calls", [U(t0, "t1", a, "c1"), U(t0 + 1, "t1", b, "c2"), R(t0 + 30, "t1", false, "c2")]]);
    edges.push(["a result logged before its use is unmatched; the use then times out", [R(t0, "t1"), U(t0 + 2, "t1")]]);
    edges.push(["a zero-length call is never in flight", [U(t0, "t1"), R(t0, "t1"), U(t0 + 5, "t2"), R(t0 + 5, "t2")]]);
    edges.push(["a call that ends as another starts does not overlap it", [U(t0, "t1"), R(t0 + 50, "t1"), U(t0 + 50, "t2"), U(t0 + 60, "t3", b), R(t0 + 70, "t2")]]);
  }
  for (const [name, evs] of edges) tests.push({ name, args: pyArgs(evs, T), expect: pyResult(oracle(evs, T)) });

  // Timing: ~100 000 calls, hundreds in flight at once. Matching by scanning back and a
  // peak computed by comparing every pair of calls are both far too slow.
  const seed = r.int(1, 1_000_000);
  const n = level === 1 ? 80000 : 110000;
  const convs = level === 3 ? 400 : 60;
  tests.push({ name: `${n.toLocaleString("en-US")} tool calls in time (O(n log n))`, args: `(_gen_tool_events(${n}, ${convs}, ${seed}, ${T}), ${T})`, limit_s: 8 });

  return {
    vars: {
      timeout_ms: T,
      dup_rule: level === 1
        ? "In the samples each call has one `use` and at most one `result`."
        : "Telemetry is delivered at least once: a `use` or `result` can appear twice, and a `result` can refer to an id that was never used.",
      key_rule: level === 3
        ? "A call is identified by `(conversation_id, tool_use_id)`: the same id in two conversations is two calls. A result logged before its call's use (collector clock skew) is unmatched."
        : "A call is identified by `(conversation_id, tool_use_id)`.",
    },
    samples,
    tests,
  };
}
