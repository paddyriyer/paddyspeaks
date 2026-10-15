/* TGA-L2-01 — Adapter cache on a dedicated endpoint (Python, LFU with LRU tie-break).
   Simulated practice scenario. All data is generated from the seed; every slot count,
   adapter id and traffic pattern is hypothetical.

   Contract (python): entry, signature, starter, prelude, generate(r, level) ->
     { vars, samples: [{args, expect}], tests: [{name, args, expect?, limit_s?}] }.
   expect comes from oracle() below, which keeps a plain list of loaded adapters and
   scans every slot for the victim on each miss. The evaluator's reference keeps
   frequency buckets of insertion-ordered dicts, so each checks the other.
   level: 1 Medium (adapter requests only, at least one slot)
          2 Hard (+ requests served by the base model alone, which skip the cache, and
            an endpoint with no adapter slots)
          3 Very Hard (+ pinned adapters, which are never evicted) */
export const kind = "python";
export const entry = "adapter_cache";
export const signature = "def adapter_cache(slots: int, requests: list[str | None], pinned: list[str] = ()) -> tuple[int, int, list[str]]:";
export const starter = `def adapter_cache(slots, requests, pinned=()):
    """slots: how many LoRA adapters the endpoint can hold loaded at once.
    requests: adapter ids in arrival order (None: served by the base model alone).
    pinned: adapter ids that, once loaded, are never evicted.
    Return (hits, misses, evictions): evictions lists evicted adapter ids in order."""
    ...
`;

export const prelude = `
def _gen_adapter_traffic(n, universe, slots, seed, base_pct=0, n_pinned=0):
    x = seed

    def nxt():
        nonlocal x
        x = (1103515245 * x + 12345) % 2147483648
        return x >> 8
    reqs = []
    for _ in range(n):
        if base_pct and nxt() % 100 < base_pct:
            reqs.append(None)
            continue
        a = nxt() % universe
        b = nxt() % universe
        reqs.append('ad-%05d' % (a * b // universe))
    pinned = ['ad-%05d' % k for k in range(n_pinned)]
    return slots, reqs, pinned
`.trim() + "\n";

// The specification, directly: a list of loaded adapters with their count and last use;
// on a miss with every slot taken, scan all of them for the victim. Small inputs only.
export function oracle(slots, requests, pinned) {
  const pin = new Set(pinned || []);
  const loaded = [];                                  // {id, count, last}
  let hits = 0, misses = 0, t = 0;
  const evictions = [];
  for (const a of requests) {
    t += 1;
    if (a === null) continue;                         // base model alone: not the cache
    const cur = loaded.find((e) => e.id === a);
    if (cur) { hits += 1; cur.count += 1; cur.last = t; continue; }
    misses += 1;
    if (loaded.length >= slots) {
      let victim = -1;
      for (let i = 0; i < loaded.length; i++) {
        const e = loaded[i];
        if (pin.has(e.id)) continue;
        if (victim < 0) { victim = i; continue; }
        const v = loaded[victim];
        if (e.count < v.count || (e.count === v.count && e.last < v.last)) victim = i;
      }
      if (victim < 0) continue;                       // nothing evictable: served without loading
      evictions.push(loaded[victim].id);
      loaded.splice(victim, 1);                       // its count is forgotten
    }
    loaded.push({ id: a, count: 1, last: t });
  }
  return [hits, misses, evictions];
}

const pyStr = (s) => (s === null ? "None" : `'${s}'`);
const pyArgs = (c) => `(${c.slots}, [${c.requests.map(pyStr).join(", ")}], [${(c.pinned || []).map(pyStr).join(", ")}])`;
const pyOut = ([h, m, ev]) => `(${h}, ${m}, [${ev.map(pyStr).join(", ")}])`;
const run = (c) => oracle(c.slots, c.requests, c.pinned || []);

const NAMES = ["sql-helper", "support-tone", "legal-summ", "code-review", "med-coding", "ticket-tags",
  "faq-de", "faq-ja", "json-extract", "claims-triage", "retail-search", "chat-casual"];

function randomCase(r, level) {
  for (let attempt = 0; attempt < 100; attempt++) {
    const pool = r.sample(NAMES, r.int(5, 7));
    const slots = r.int(2, 3);
    const n = r.int(12, 16);
    const weights = pool.map((_, i) => (i < 2 ? 4 : 1));
    const total = weights.reduce((a, b) => a + b, 0);
    const requests = [];
    for (let i = 0; i < n; i++) {
      if (level >= 2 && r.chance(0.15)) { requests.push(null); continue; }
      let k = r.int(1, total), j = 0;
      while (k > weights[j]) { k -= weights[j]; j++; }
      requests.push(pool[j]);
    }
    const pinned = level === 3 && r.chance(0.7) ? [r.pick(pool)] : [];
    const c = { slots, requests, pinned };
    const [h, , ev] = run(c);
    if (h > 0 && ev.length >= 2) return c;
  }
  throw new Error("TGA-L2-01: could not build a sample with hits and evictions");
}

export function generate(r, level) {
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const c = randomCase(r, level);
    samples.push({ args: pyArgs(c), expect: pyOut(run(c)) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const [A, B, C, D, E] = r.sample(NAMES, 5);
  const edges = [
    ["an often-used adapter is kept over a more recently used one",
      { slots: 2, requests: [A, A, A, B, C, D, A] }],
    ["equal counts: the adapter used least recently is evicted",
      { slots: 2, requests: [A, B, B, A, C, D] }],
    ["an evicted adapter comes back with a count of 1, not its old count",
      { slots: 2, requests: [A, A, A, B, B, B, B, C, A, D, B] }],
    ["one slot: every new adapter evicts the previous one",
      { slots: 1, requests: [A, A, B, A, C, C] }],
    ["more slots than adapters: misses only on first use, no evictions",
      { slots: 5, requests: [A, B, C, A, B, C, A] }],
    ["the same adapter every time",
      { slots: 3, requests: [D, D, D, D, D] }],
  ];
  if (level >= 2) {
    edges.push(["base-model requests skip the cache and change no counts",
      { slots: 2, requests: [A, null, B, null, null, A, C, null, B] }]);
    edges.push(["an endpoint with no adapter slots: every adapter request misses, nothing is evicted",
      { slots: 0, requests: [A, A, null, B, A] }]);
    edges.push(["only base-model requests",
      { slots: 2, requests: [null, null, null] }]);
  }
  if (level === 3) {
    edges.push(["a pinned adapter is never evicted, even with the lowest count",
      { slots: 2, requests: [E, A, A, A, B, C, B, D], pinned: [E] }]);
    edges.push(["every slot pinned: other adapters are served without loading, nothing is evicted",
      { slots: 2, requests: [A, B, C, A, C, B, A], pinned: [A, B] }]);
    edges.push(["a pinned adapter's first request can evict an unpinned one",
      { slots: 2, requests: [B, B, C, A, A, C, D], pinned: [A] }]);
    edges.push(["a pinned adapter that is never requested takes no slot",
      { slots: 2, requests: [B, C, B, C, D], pinned: [E] }]);
  }
  for (const [name, c] of edges) tests.push({ name, args: pyArgs(c), expect: pyOut(run(c)) });

  // Timing: compared with the reference at check time. Thousands of slots, so scanning
  // every slot for the victim on each of ~90 000 misses is hundreds of millions of steps.
  const seed = r.int(1, 1_000_000);
  const slots = r.int(40, 60) * 100;
  const [basePct, nPinned] = level === 1 ? [0, 0] : level === 2 ? [20, 0] : [20, 50];
  tests.push({
    name: `150,000 adapter requests on ${slots.toLocaleString("en-US")} slots in time`,
    args: `_gen_adapter_traffic(150000, 30000, ${slots}, ${seed}, ${basePct}, ${nPinned})`,
    limit_s: 8,
  });

  const base = r.pick(["a 70B instruction model", "an 8B chat model", "a 32B coding model", "a 14B multilingual model"]);
  return {
    vars: {
      base_model: base,
      level_rule: level === 1
        ? "In this exercise every request names an adapter, there is at least one slot, and no adapter is pinned."
        : level === 2
          ? "Some requests are None: they are served by the base model alone, never touch the cache, and are neither hits nor misses. The slot count can be 0, in which case every adapter request is a miss served without loading anything. No adapter is pinned."
          : "Some requests are None (the base model alone: not hits, not misses, no effect on the cache), the slot count can be 0, and pinned lists adapters the customer pinned: a pinned adapter is loaded on its first request like any other, takes a slot, and is never evicted. When every loaded adapter is pinned and the cache is full, the requested adapter is served without being loaded: a miss, with no eviction.",
    },
    samples,
    tests,
  };
}
