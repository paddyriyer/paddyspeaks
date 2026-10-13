/* OAI-L2-03 — Debug: per-project hourly token totals from usage events (Python).
   Simulated practice scenario. All data is generated from the seed.

   kind "debug": `starter` is the buggy function the candidate fixes. Five planted bugs:
     1. deduplication keeps the FIRST attempt seen, not the highest attempt number;
     2. only status "error" is excluded, so "timeout" and "cancelled" are billed;
     3. the status filter runs before deduplication, so a request whose latest attempt
        failed bills an earlier successful attempt;
     4. ceil(ts / hour) - 1 puts an event exactly on the hour into the previous hour;
     5. a mutable default argument (totals={}) leaks totals from one call into the next.
   The oracle implements the specification directly; each named test exposes one bug. */
export const kind = "debug";
export const entry = "hourly_tokens";
export const signature = "def hourly_tokens(events: list[dict]) -> list[tuple[str, int, int]]:";
export const starter = `import math

HOUR_MS = 3_600_000


def hourly_tokens(events, totals={}):
    """Aggregate usage events into per-project hourly token totals.

    events: dicts with request_id, project_id, attempt, ts_ms (epoch ms, UTC), status,
    prompt_tokens, completion_tokens. A request may be retried; each retry is a new
    event with a higher attempt number, and events can arrive in any order.
    Returns [(project_id, hour_start_epoch_seconds, tokens)] sorted by project, hour.
    """
    latest = {}
    for e in events:
        if e["status"] == "error":
            continue
        rid = e["request_id"]
        if rid not in latest:
            latest[rid] = e

    for e in latest.values():
        hour = (math.ceil(e["ts_ms"] / HOUR_MS) - 1) * 3600
        key = (e["project_id"], hour)
        totals[key] = totals.get(key, 0) + e["prompt_tokens"] + e["completion_tokens"]

    return sorted((p, h, t) for (p, h), t in totals.items())
`;

export const prelude = `
def _after_other_call(warmup, events):
    # Calls the function once on other data first, as a long-running service would.
    hourly_tokens(warmup)
    return events

def _gen_events(n, seed, base_ms, projects=8):
    x, out = seed, []
    def nxt():
        nonlocal x
        x = (1103515245 * x + 12345) % 2147483648
        return x >> 16
    seen = {}
    for i in range(n):
        k = nxt() * 32768 + nxt()
        k %= n * 3 // 4 + 1
        seen[k] = seen.get(k, 0) + 1        # each (request_id, attempt) is unique
        status = ("ok", "ok", "ok", "ok", "ok", "ok", "error", "timeout", "cancelled")[nxt() % 9]
        out.append({"request_id": "req_%07d" % k, "project_id": "proj_%02d" % (k % projects),
                    "attempt": 100 - seen[k], "ts_ms": base_ms + (nxt() * 32768 + nxt()) % (36 * 3_600_000),
                    "status": status, "prompt_tokens": nxt() % 4000, "completion_tokens": nxt() % 1500})
    return out
`.trim() + "\n";

const HOUR_MS = 3_600_000;

// The specification, written directly: latest attempt per request decides; only "ok" bills;
// an event belongs to the UTC hour [h, h + 1h) containing ts_ms.
export function oracle(events) {
  const latest = new Map();
  for (const e of events) {
    const cur = latest.get(e.request_id);
    if (!cur || e.attempt > cur.attempt) latest.set(e.request_id, e);
  }
  const tot = new Map();
  for (const e of latest.values()) {
    if (e.status !== "ok") continue;
    const hour = Math.floor(e.ts_ms / HOUR_MS) * 3600;
    const k = e.project_id + "\u0000" + hour;
    tot.set(k, (tot.get(k) || 0) + e.prompt_tokens + e.completion_tokens);
  }
  return [...tot].map(([k, t]) => { const [p, h] = k.split("\u0000"); return [p, Number(h), t]; })
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] - b[1]));
}

const pyEvent = (e) => `{'request_id': '${e.request_id}', 'project_id': '${e.project_id}', 'attempt': ${e.attempt}, 'ts_ms': ${e.ts_ms}, 'status': '${e.status}', 'prompt_tokens': ${e.prompt_tokens}, 'completion_tokens': ${e.completion_tokens}}`;
const pyEvents = (es) => "[" + es.map(pyEvent).join(", ") + "]";
const pyOut = (rows) => "[" + rows.map(([p, h, t]) => `('${p}', ${h}, ${t})`).join(", ") + "]";

const DAYS = [["2026-03-02", 1772409600000], ["2026-05-18", 1779062400000], ["2026-07-01", 1782864000000], ["2026-09-14", 1789344000000]];
const PROJECTS = [["proj_chat", "proj_search", "proj_eval"], ["proj_alpha", "proj_beta", "proj_gamma"], ["proj_support", "proj_docs", "proj_agents"]];

export function generate(r, level) {
  const [day, base] = r.pick(DAYS);
  const projects = r.pick(PROJECTS);
  let seq = r.int(100, 900);
  const rid = () => "req_" + String(seq++).padStart(5, "0");
  const ev = (o) => Object.assign({ request_id: rid(), project_id: projects[0], attempt: 1, ts_ms: base + 9 * HOUR_MS + r.int(1, HOUR_MS - 1), status: "ok", prompt_tokens: r.int(50, 3000), completion_tokens: r.int(10, 900) }, o);

  // Random samples: a mix of every situation the specification covers.
  const sampleEvents = (n) => {
    const out = [];
    const statuses = level === 1 ? ["ok", "ok", "ok", "error"] : ["ok", "ok", "ok", "ok", "error", "timeout", "cancelled"];
    for (let i = 0; i < n; i++) {
      const hours = level === 3 ? 30 : 4;              // level 3 spans midnight
      const ts = base + (level === 3 ? 20 : 8) * HOUR_MS + r.int(0, hours - 1) * HOUR_MS + (r.chance(0.15) ? 0 : r.int(1, HOUR_MS - 1));
      const e = ev({ project_id: r.pick(projects.slice(0, level + 0)), ts_ms: ts, status: r.pick(statuses) });
      out.push(e);
      if (r.chance(level === 1 ? 0.3 : 0.45)) {          // a retry with corrected counts
        const retry = Object.assign({}, e, { attempt: 2, ts_ms: e.ts_ms + r.int(200, 4000), status: r.pick(["ok", "ok", "error"]), prompt_tokens: e.prompt_tokens, completion_tokens: r.int(10, 900) });
        out.push(retry);
        if (level === 3 && r.chance(0.3)) out.push(Object.assign({}, retry));   // the same attempt delivered twice
      }
    }
    if (!out.some((e) => e.status === "ok")) out.push(ev({}));
    return level === 1 ? out : r.shuffle(out);
  };

  const samples = [];
  for (let i = 0; i < 3; i++) {
    let es = sampleEvents(4 + i * 2 + level);
    if (!oracle(es).length) es = es.concat([ev({})]);
    samples.push({ args: `(${pyEvents(es)},)`, expect: pyOut(oracle(es)) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  // One test per bug. Each also has a request that bills normally, so no expected result is empty.
  const P = projects[0], Q = projects[1];
  const h9 = base + 9 * HOUR_MS;
  const keep = () => ev({ project_id: Q });
  const t = [];
  {
    const a = ev({ ts_ms: h9 + 600000 });
    t.push(["a retry with corrected counts replaces the first attempt",
      [a, Object.assign({}, a, { attempt: 2, ts_ms: a.ts_ms + 1500, completion_tokens: a.completion_tokens + r.int(5, 200) }), keep()]]);
  }
  {
    const a = ev({ ts_ms: h9 + 900000 });
    t.push(["attempts arriving out of order: the highest attempt wins, not the last seen",
      [Object.assign({}, a, { attempt: 3, ts_ms: a.ts_ms + 4000, prompt_tokens: a.prompt_tokens + 7 }), a, Object.assign({}, a, { attempt: 2, ts_ms: a.ts_ms + 2000, completion_tokens: a.completion_tokens + 3 }), keep()]]);
  }
  t.push(["timed-out and cancelled requests are not billed", [ev({ status: "timeout" }), ev({ status: "cancelled" }), keep()]]);
  {
    const a = ev({ ts_ms: h9 + 1200000 });
    t.push(["the latest attempt failed, so the request is not billed", [a, Object.assign({}, a, { attempt: 2, ts_ms: a.ts_ms + 3000, status: "error" }), keep()]]);
  }
  t.push(["an event exactly on the hour belongs to that hour", [ev({ ts_ms: h9 + HOUR_MS }), ev({ ts_ms: h9 + HOUR_MS - 1 }), keep()]]);
  if (level >= 2) t.push(["an event at exactly midnight UTC belongs to the new day", [ev({ ts_ms: base + 24 * HOUR_MS }), ev({ ts_ms: base + 24 * HOUR_MS - 1 }), keep()]]);
  if (level === 3) {
    const a = ev({});
    t.push(["the same attempt delivered twice is counted once", [a, Object.assign({}, a), keep()]]);
  }
  for (const [name, es] of t) tests.push({ name, args: `(${pyEvents(es)},)`, expect: pyOut(oracle(es)) });

  // Bug 5: call the function once on other data first, then check the second result.
  {
    const warm = [ev({ project_id: P, ts_ms: h9 + 60000 }), ev({ project_id: Q, ts_ms: h9 + 120000 })];
    const es = [ev({ project_id: P, ts_ms: h9 + 300000 }), keep()];
    tests.push({ name: "a second call does not include the first call's events", args: `(_after_other_call(${pyEvents(warm)}, ${pyEvents(es)}),)`, expect: pyOut(oracle(es)) });
  }

  // Timing: deduplicating by scanning the list for each request is O(n²) and fails.
  const n = level === 1 ? 100000 : 200000;
  tests.push({ name: `${n.toLocaleString("en-US")} events in time (one pass)`, args: `(_gen_events(${n}, ${r.int(1, 1_000_000)}, ${base}),)`, limit_s: 8 });

  return { vars: { day, projects: projects.join(", ") }, samples, tests };
}
