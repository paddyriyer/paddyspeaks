/* ANT-L1-05 — Prompt-cache replay: cache reads, cache writes and uncached input (Python).
   Simulated practice scenario. A deliberately simplified cache model; all data is
   generated from the seed, and every TTL, minimum and token count is hypothetical.

   Contract: see docs/COMPANY-INTERVIEW-LOOPS.md § Executable templates (python).
   level: 1 Medium (one workspace, every prefix cacheable, one TTL)
          2 Hard (+ several workspaces with the same segment ids, a minimum cacheable length)
          3 Very Hard (+ two TTLs: a refresh never shortens an entry's life) */
export const kind = "python";
export const entry = "cache_accounting";
export const signature = "def cache_accounting(requests: list[tuple[int, str, list[tuple[str, int]], int]], min_tokens: int = 0) -> list[tuple[int, int, int]]:";
export const starter = `def cache_accounting(requests, min_tokens=0):
    """requests: (ts_s, workspace_id, segments, ttl_s), sorted by ts_s.
    segments: [(segment_id, tokens), ...]; the last segment is never cached.
    Return one (cache_read_tokens, cache_write_tokens, uncached_input_tokens) per request."""
    ...
`;

export const prelude = `
def _gen_convs(n_convs, turns, n_ws, seed, ttl_mix=False, sys_tokens=1800):
    # Conversations grow by a user turn and a reply per request; requests interleave in time.
    x, ts, reqs = seed, 0, []
    hist = [[('sys_w%d' % (c % n_ws), sys_tokens)] for c in range(n_convs)]
    for t in range(turns):
        for c in range(n_convs):
            x = (1103515245 * x + 12345) % 2147483648
            ts += (x >> 16) % 91
            x = (1103515245 * x + 12345) % 2147483648
            user = ('c%d_u%d' % (c, t), 5 + (x >> 16) % 96)
            x = (1103515245 * x + 12345) % 2147483648
            ttl = 3600 if ttl_mix and (x >> 16) % 4 == 0 else 300
            reqs.append((ts, 'ws_%d' % (c % n_ws), hist[c] + [user], ttl))
            x = (1103515245 * x + 12345) % 2147483648
            hist[c] = hist[c] + [user, ('c%d_a%d' % (c, t), 20 + (x >> 16) % 181)]
    return reqs
`.trim() + "\n";

// Brute-force oracle: one map entry per (workspace, full prefix) string. Fine for small inputs.
export function oracle(requests, minTokens) {
  const cache = new Map();
  const out = [];
  for (const [t, ws, segs, ttl] of requests) {
    const cum = [];
    segs.reduce((s, [, tok]) => (cum.push(s + tok), s + tok), 0);
    const total = cum.length ? cum[cum.length - 1] : 0;
    const keys = [];
    let hit = -1, last = -1;
    for (let k = 0; k + 1 < segs.length; k++) {
      if (cum[k] < minTokens) continue;
      const key = ws + "\u0001" + segs.slice(0, k + 1).map((s) => s[0]).join("\u0002");
      keys.push(key);
      last = k;
      if ((cache.get(key) ?? -Infinity) > t) hit = k;
    }
    const read = hit >= 0 ? cum[hit] : 0;
    const write = last > hit ? cum[last] - read : 0;
    out.push([read, write, total - read - write]);
    for (const key of keys) cache.set(key, Math.max(cache.get(key) ?? -Infinity, t + ttl));
  }
  return out;
}

const pySegs = (segs) => "[" + segs.map(([id, tok]) => `('${id}', ${tok})`).join(", ") + "]";
const pyReqs = (reqs) => "[" + reqs.map(([t, ws, segs, ttl]) => `(${t}, '${ws}', ${pySegs(segs)}, ${ttl})`).join(", ") + "]";
const pyArgs = (reqs, minT) => `(${pyReqs(reqs)}, ${minT})`;
const pyOut = (rows) => "[" + rows.map((x) => `(${x.join(", ")})`).join(", ") + "]";

function smallCase(r, level, n, minT) {
  const wss = level === 1 ? ["ws_a"] : ["ws_a", "ws_b"];
  // A segment id always has the same token count: one size per system prompt.
  const lo = level === 1 ? 300 : Math.floor(minT / 2), hi = level === 1 ? 2400 : minT + 1500;
  const sysTok = { sys_support: r.int(lo, hi), sys_contracts: r.int(lo, hi) };
  const convs = [0, 1, 2].map((i) => { const s = r.pick(["sys_support", "sys_contracts"]); return { ws: r.pick(wss), hist: [[s, sysTok[s]]], i, turn: 0 }; });
  const reqs = [];
  let t = r.int(0, 3000);
  for (let j = 0; j < n; j++) {
    t += r.pick([0, 20, 120, 299, 300, 301, 900]);
    const c = r.pick(convs);
    const user = [`c${c.i}_u${c.turn}`, r.int(10, 400)];
    const ttl = level === 3 && r.chance(0.4) ? 3600 : 300;
    reqs.push([t, c.ws, [...c.hist, user], ttl]);
    c.hist = [...c.hist, user, [`c${c.i}_a${c.turn}`, r.int(30, 900)]];
    c.turn++;
  }
  return reqs;
}

export function generate(r, level) {
  const minT = level === 1 ? 0 : r.pick([1024, 2048]);
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const reqs = smallCase(r, level, 5 + i, minT);
    samples.push({ args: pyArgs(reqs, minT), expect: pyOut(oracle(reqs, minT)) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const t0 = r.int(100, 5000);
  const S = r.pick(["sys_triage", "sys_review", "sys_assist"]);
  const sysTok = (minT || 1024) + r.int(100, 900);
  const w = "ws_main";
  const Q = (t, segs, ttl = 300, ws = w) => [t, ws, segs, ttl];
  const sys = [S, sysTok];
  const edges = [
    ["the same system prompt 299 s later is read from the cache", [Q(t0, [sys, ["u1", 40]]), Q(t0 + 299, [sys, ["u2", 60]])], minT],
    ["at exactly the TTL the entry has expired and is written again", [Q(t0, [sys, ["u1", 40]]), Q(t0 + 300, [sys, ["u2", 60]])], minT],
    ["a hit refreshes the entry's TTL", [Q(t0, [sys, ["u1", 40]]), Q(t0 + 200, [sys, ["u2", 60]]), Q(t0 + 450, [sys, ["u3", 70]])], minT],
    ["the last segment is never cached", [Q(t0, [sys, ["u1", 40]]), Q(t0 + 5, [sys, ["u1", 40]])], minT],
    ["a single-segment request is all uncached input", [Q(t0, [sys]), Q(t0 + 1, [sys])], minT],
    ["a second conversation shares only the system prompt", [Q(t0, [sys, ["a1", 300], ["a2", 80]]), Q(t0 + 10, [sys, ["b1", 250], ["b2", 90]])], minT],
  ];
  if (level >= 2) {
    edges.push(["a prefix one token below the minimum is never cached", [Q(t0, [["s_small", minT - 1], ["u1", 10]]), Q(t0 + 1, [["s_small", minT - 1], ["u2", 10]])], minT]);
    edges.push(["a prefix of exactly the minimum is cached", [Q(t0, [["s_exact", minT], ["u1", 10]]), Q(t0 + 1, [["s_exact", minT], ["u2", 10]])], minT]);
    edges.push(["the minimum applies to the whole prefix, not one segment", [Q(t0, [["p1", Math.floor(minT / 2) + 10], ["p2", Math.floor(minT / 2) + 10], ["u1", 5]]), Q(t0 + 2, [["p1", Math.floor(minT / 2) + 10], ["p2", Math.floor(minT / 2) + 10], ["u2", 5]])], minT]);
    edges.push(["workspaces do not share cache entries", [Q(t0, [sys, ["u1", 40]], 300, "ws_one"), Q(t0 + 3, [sys, ["u1", 40]], 300, "ws_two"), Q(t0 + 4, [sys, ["u9", 40]], 300, "ws_one")], minT]);
  }
  if (level === 3) {
    edges.push(["a 5-minute request does not shorten a 1-hour entry", [Q(t0, [sys, ["u1", 40]], 3600), Q(t0 + 100, [sys, ["u2", 40]], 300), Q(t0 + 1000, [sys, ["u3", 40]], 300)], minT]);
    edges.push(["a 1-hour request extends a 5-minute entry", [Q(t0, [sys, ["u1", 40]], 300), Q(t0 + 100, [sys, ["u2", 40]], 3600), Q(t0 + 2000, [sys, ["u3", 40]], 300)], minT]);
    edges.push(["exactly one hour after a 1-hour write the entry has expired", [Q(t0, [sys, ["u1", 40]], 3600), Q(t0 + 3600, [sys, ["u2", 40]], 300)], minT]);
  }
  for (const [name, reqs, m] of edges) tests.push({ name, args: pyArgs(reqs, m), expect: pyOut(oracle(reqs, m)) });

  // Timing: long conversations (prompts of up to ~2 000 segments). Building a key from
  // the whole prefix for every prefix is quadratic per request and far too slow.
  const seed = r.int(1, 1_000_000);
  const [nc, turns] = level === 1 ? [6, 500] : [6, 600];
  tests.push({ name: `${(nc * turns).toLocaleString("en-US")} requests with long prompts in time (O(segments) per request)`, args: `(_gen_convs(${nc}, ${turns}, ${level === 1 ? 1 : 3}, ${seed}, ${level === 3 ? "True" : "False"}), ${minT})`, limit_s: 8 });

  return {
    vars: {
      min_rule: level === 1
        ? "`min_tokens` is 0: every prefix can be cached."
        : `A prefix can be cached only if its cumulative tokens are at least \`min_tokens\` (${minT} in the tests); shorter prefixes are never stored.`,
      ws_rule: level === 1
        ? "All requests come from one workspace."
        : "The cache is scoped to a workspace: the same segments sent from two workspaces are two different entries.",
      ttl_rule: level === 3
        ? "Requests carry a TTL of 300 or 3600 seconds. Storing or refreshing an entry sets its expiry to `max(current expiry, ts + ttl_s)`: a shorter TTL never shortens a live entry."
        : "Every request uses a TTL of 300 seconds.",
    },
    samples,
    tests,
  };
}
