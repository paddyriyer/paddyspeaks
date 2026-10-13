/* STR-L1-04 — Idempotency-key store with 24-hour expiry (Python).
   Simulated practice scenario. All data is generated from the seed.

   Contract: see docs/COMPANY-INTERVIEW-LOOPS.md § Executable templates (python).
   level: 1 Medium (execute / replay / conflict with expiry)
          2 Hard (+ equal timestamps, exact-boundary expiry, re-use of expired keys)
          3 Very Hard (+ a cap on live keys: the oldest live key is evicted early) */
export const kind = "python";
export const entry = "idempotency_outcomes";
export const signature = "def idempotency_outcomes(requests: list[tuple[int, str, str]], max_keys: int | None = None) -> list[str]:";
export const starter = `from collections import deque

TTL = 86400  # seconds: a key lives 24 hours from its first use

def idempotency_outcomes(requests, max_keys=None):
    """requests: (ts_seconds, idempotency_key, params_hash), sorted by ts.
    Return one of "execute", "replay", "conflict" per request."""
    ...
`;

export const prelude = `
def _gen_idem(n, n_keys, seed, step_max=2, n_params=3):
    x, ts, out = seed, 0, []
    for _ in range(n):
        x = (1103515245 * x + 12345) % 2147483648
        ts += (x >> 16) % (step_max + 1)
        x = (1103515245 * x + 12345) % 2147483648
        k = 'idk_%d' % ((x >> 7) % n_keys)
        x = (1103515245 * x + 12345) % 2147483648
        out.append((ts, k, 'h%d' % ((x >> 16) % n_params)))
    return out
`.trim() + "\n";

const TTL = 86400;

// Brute force: rescans every live key on every request. Used only for small inputs.
export function oracle(reqs, maxKeys) {
  let live = [];
  let seq = 0;
  const out = [];
  for (const [t, k, h] of reqs) {
    live = live.filter((e) => e.first + TTL > t);
    const e = live.find((x) => x.key === k);
    if (e) { out.push(e.hash === h ? "replay" : "conflict"); continue; }
    if (maxKeys != null && live.length >= maxKeys) {
      let bi = 0;
      for (let i = 1; i < live.length; i++) if (live[i].first < live[bi].first || (live[i].first === live[bi].first && live[i].seq < live[bi].seq)) bi = i;
      live.splice(bi, 1);
    }
    live.push({ key: k, first: t, hash: h, seq: seq++ });
    out.push("execute");
  }
  return out;
}

const pyList = (xs) => "[" + xs.map((s) => `'${s}'`).join(", ") + "]";
const pyArgs = (reqs, maxKeys) => `([${reqs.map(([t, k, h]) => `(${t}, '${k}', '${h}')`).join(", ")}], ${maxKeys == null ? "None" : maxKeys})`;

function smallCase(r, level, n) {
  const keys = r.sample(["idk_order_17", "idk_order_18", "idk_refund_3", "idk_payout_9", "idk_sub_42"], level === 1 ? 2 : 3);
  const steps = level === 1 ? [1, 600, 3600, 40000, 90000] : [0, 0, 1, 3600, 43200, 86399, 86400, 90000];
  const reqs = [];
  let t = r.int(0, 5000);
  for (let i = 0; i < n; i++) {
    if (i) t += r.pick(steps);
    reqs.push([t, r.pick(keys), r.pick(["h_a1", "h_b2"])]);
  }
  const maxKeys = level === 3 ? 2 : null;
  return { reqs, maxKeys };
}

export function generate(r, level) {
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const { reqs, maxKeys } = smallCase(r, level, 6 + i);
    samples.push({ args: pyArgs(reqs, maxKeys), expect: pyList(oracle(reqs, maxKeys)) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const t0 = r.int(100, 9000);
  const k = r.pick(["idk_charge_7", "idk_payment_31", "idk_refund_12"]);
  const edges = [
    ["same key, same params within 24h replays", [[t0, k, "h1"], [t0 + 120, k, "h1"]], null],
    ["same key, different params within 24h conflicts", [[t0, k, "h1"], [t0 + 120, k, "h2"]], null],
    ["86 399 s after first use the key is still live", [[t0, k, "h1"], [t0 + 86399, k, "h2"]], null],
    ["exactly 86 400 s after first use the key has expired and executes again", [[t0, k, "h1"], [t0 + 86400, k, "h2"]], null],
    ["a replay does not extend the key's life", [[t0, k, "h1"], [t0 + 80000, k, "h1"], [t0 + 86400, k, "h1"]], null],
    ["a conflict does not extend the key's life", [[t0, k, "h1"], [t0 + 50000, k, "h2"], [t0 + 86400, k, "h2"]], null],
  ];
  if (level >= 2) {
    edges.push(["several requests at the same second are processed in list order", [[t0, k, "h1"], [t0, k, "h1"], [t0, k, "h2"]], null]);
    edges.push(["a re-executed key gets a fresh 24 hours", [[t0, k, "h1"], [t0 + 86400, k, "h2"], [t0 + 100000, k, "h1"], [t0 + 172800, k, "h1"]], null]);
  }
  if (level === 3) {
    edges.push(["at the cap, the oldest live key is evicted", [[t0, "a", "h1"], [t0 + 1, "b", "h1"], [t0 + 2, "c", "h1"], [t0 + 3, "a", "h2"], [t0 + 4, "c", "h2"]], 2]);
    edges.push(["expired keys do not hold a place under the cap", [[t0, "a", "h1"], [t0 + 50000, "b", "h1"], [t0 + 86400, "c", "h1"], [t0 + 86401, "b", "h2"], [t0 + 86402, "c", "h1"]], 2]);
    edges.push(["ties in first use are evicted in arrival order", [[t0, "a", "h1"], [t0, "b", "h1"], [t0 + 5, "c", "h1"], [t0 + 6, "b", "h2"], [t0 + 7, "a", "h2"]], 2]);
  }
  for (const [name, reqs, mk] of edges) tests.push({ name, args: pyArgs(reqs, mk), expect: pyList(oracle(reqs, mk)) });

  // Timing: ~200 000 requests over about two and a half days; tens of thousands of keys
  // are live at once, so purging by scanning the whole store per request is far too slow.
  const seed = r.int(1, 1_000_000);
  const n = level === 1 ? 150000 : 200000;
  const nKeys = r.pick([250000, 400000]);
  const cap = level === 3 ? r.pick([20000, 40000]) : "None";
  tests.push({ name: `${n.toLocaleString("en-US")} requests in time (O(1) amortised per request)`, args: `(_gen_idem(${n}, ${nKeys}, ${seed}), ${cap})`, limit_s: 8 });

  return {
    vars: {
      tie_rule: level === 1 ? "In the samples timestamps are strictly increasing; the large test can repeat one, and requests at the same second are processed in list order." : "Several requests can share a timestamp; process them in list order.",
      cap_rule:
        level === 3
          ? "The store holds at most `max_keys` live keys. When a new key must be stored and the store is full (after expired keys are gone), evict the live key with the earliest first use (ties: the one stored first); the evicted key then behaves as new."
          : "`max_keys` is None: the store is unbounded.",
    },
    samples,
    tests,
  };
}
