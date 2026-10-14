/* NFX-L2-01 — Edge cache simulation: byte hit ratio of an LRU cache (Python, caching).
   Simulated practice scenario. All data is generated from the seed.

   Contract (python): entry, signature, starter, prelude, generate(r, level) ->
     { vars, samples: [{args, expect}], tests: [{name, args, expect?, limit_s?}] }.
   expect comes from oracle() below: a literal simulation that keeps every cached
   copy with the request number of its last use and, to evict, scans the whole cache
   for the smallest one. The evaluator's reference keeps an ordered dictionary, so
   each checks the other.
   level: 1 Medium (one version per segment, every fitting miss is admitted)
          · 2 Hard (+ second-request admission)
          · 3 Very Hard (+ new versions of a segment, possibly with a new size) */
export const kind = "python";
export const entry = "edge_cache";
export const signature = "def edge_cache(requests: list[tuple[str, int, int]], capacity: int, admit_on_second: bool = False) -> tuple[int, int, int]:";
export const starter = `def edge_cache(requests, capacity, admit_on_second=False):
    """requests: (object_id, version, size_bytes) in arrival order.
    capacity: bytes the cache can hold.
    Return (hits, hit_bytes, total_bytes)."""
    ...
`;

export const prelude = `
def _gen_trace(n, objects, seed, versions=False):
    x, ver, out = seed, {}, []
    for _ in range(n):
        x = (1103515245 * x + 12345) % 2147483648
        u = (x >> 8) / 8388608.0
        k = int(objects * u * u * u)
        v = ver.get(k, 1)
        if versions:
            x = (1103515245 * x + 12345) % 2147483648
            if (x >> 16) % 60 == 0:
                v += 1
                ver[k] = v
        size = 50000 + (k * 2654435761 + v * 40503) % 1950000
        out.append(('t%05d/seg%03d' % (k // 40, k % 40), v, size))
    return out
`.trim() + "\n";

// The specification, simulated literally: last-use stamps and a full scan per eviction.
export function oracle(requests, capacity, admitOnSecond) {
  const cache = [];                // {id, ver, size, last}
  const seen = new Set();
  let hits = 0, hitBytes = 0, total = 0;
  requests.forEach(([id, ver, size], i) => {
    total += size;
    const at = cache.findIndex((c) => c.id === id);
    if (at >= 0 && cache[at].ver === ver) {
      hits++;
      hitBytes += size;
      cache[at].last = i;
    } else {
      if (at >= 0) cache.splice(at, 1);                          // a stale version leaves first
      const admit = size <= capacity && (!admitOnSecond || seen.has(id));
      if (admit) {
        const used = () => cache.reduce((a, c) => a + c.size, 0);
        while (used() + size > capacity) {
          let lo = 0;
          for (let j = 1; j < cache.length; j++) if (cache[j].last < cache[lo].last) lo = j;
          cache.splice(lo, 1);
        }
        cache.push({ id, ver, size, last: i });
      }
    }
    seen.add(id);
  });
  return [hits, hitBytes, total];
}

const pyReqs = (rs) => "[" + rs.map(([id, v, s]) => `('${id}', ${v}, ${s})`).join(", ") + "]";
const pyArgs = (c) => `(${pyReqs(c.reqs)}, ${c.cap}, ${c.admit ? "True" : "False"})`;
const pyOut = (o) => `(${o[0]}, ${o[1]}, ${o[2]})`;
const run = (c) => oracle(c.reqs, c.cap, c.admit);

function randomCase(r, level, title) {
  for (let attempt = 0; attempt < 80; attempt++) {
    const nObj = r.int(5, 8);
    const unit = r.pick([1000, 4096, 250000]);
    const objs = Array.from({ length: nObj }, (_, i) => ({
      id: `${title}/seg${String(i * r.int(1, 3) + i).padStart(3, "0")}`,
      ver: 1,
      size: unit * r.int(1, 9),
    }));
    const cap = unit * r.int(10, 22);
    const reqs = [];
    const n = r.int(14, 22);
    for (let i = 0; i < n; i++) {
      const o = objs[Math.min(nObj - 1, Math.floor(nObj * r.next() * r.next()))];   // skewed popularity
      if (level === 3 && r.chance(0.12)) {
        o.ver += 1;
        if (r.chance(0.6)) o.size = unit * r.int(1, 12);
      }
      reqs.push([o.id, o.ver, o.size]);
    }
    if (level === 1 && r.chance(0.5)) reqs.splice(r.int(0, reqs.length), 0, [`${title}/seg999`, 1, cap + unit]);   // an oversized segment
    const c = { reqs, cap, admit: level >= 2 && r.chance(0.7) };
    const [hits] = run(c);
    if (hits >= 2 && hits < reqs.length - 2) return c;
  }
  throw new Error("NFX-L2-01: could not build a sample with hits and misses");
}

export function generate(r, level) {
  const titles = r.sample(["t00412", "t01877", "t02390", "t05121", "t07733", "t09068"], 4);
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const c = randomCase(r, level, titles[i]);
    samples.push({ args: pyArgs(c), expect: pyOut(run(c)) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const t = titles[3];
  const u = r.pick([1000, 1024, 50000]);
  const S = (k) => `${t}/seg${String(k).padStart(3, "0")}`;
  const q = (k, size, ver = 1) => [S(k), ver, size];
  const cap = u * 10;
  const edges = [
    ["an empty trace", { reqs: [], cap }],
    ["a segment exactly the capacity is cached", { reqs: [q(1, 3 * u), q(2, cap), q(2, cap), q(1, 3 * u)], cap }],
    ["a segment one byte over the capacity is never cached and evicts nothing",
      { reqs: [q(1, 4 * u), q(2, cap + 1), q(1, 4 * u), q(2, cap + 1)], cap }],
    ["a hit makes a segment the most recently used",
      { reqs: [q(1, 5 * u), q(2, 5 * u), q(1, 5 * u), q(3, 5 * u), q(1, 5 * u), q(2, 5 * u)], cap }],
    ["one large segment evicts several small ones, oldest first",
      { reqs: [q(1, 2 * u), q(2, 2 * u), q(3, 3 * u), q(4, 3 * u), q(5, 6 * u), q(4, 3 * u), q(1, 2 * u), q(3, 3 * u)], cap }],
    ["a segment that fits exactly after earlier ones evicts nothing",
      { reqs: [q(1, 3 * u), q(2, 3 * u), q(3, 4 * u), q(1, 3 * u), q(2, 3 * u)], cap }],
    ["a capacity of zero caches nothing", { reqs: [q(1, u), q(1, u), q(1, u)], cap: 0 }],
    ["hits are counted in requests and in bytes",
      { reqs: [q(1, u), q(2, 7 * u), q(1, u), q(1, u), q(2, 7 * u)], cap }],
  ];
  if (level >= 2) {
    edges.push(["with admit_on_second, a first request is never cached",
      { reqs: [q(1, 2 * u), q(1, 2 * u), q(1, 2 * u), q(2, u), q(1, 2 * u)], cap, admit: true }]);
    edges.push(["a request that was not cached still counts as seen",
      { reqs: [q(1, 6 * u), q(2, 6 * u), q(1, 6 * u), q(2, 6 * u), q(1, 6 * u), q(2, 6 * u)], cap, admit: true }]);
    edges.push(["a one-hit segment never evicts a cached one",
      { reqs: [q(1, 6 * u), q(1, 6 * u), q(2, 6 * u), q(3, 6 * u), q(1, 6 * u)], cap, admit: true }]);
    edges.push(["an oversized segment is not cached on its second request either",
      { reqs: [q(1, 3 * u), q(1, 3 * u), q(2, cap + u), q(2, cap + u), q(1, 3 * u)], cap, admit: true }]);
    edges.push(["the same trace without admit_on_second",
      { reqs: [q(1, 2 * u), q(1, 2 * u), q(1, 2 * u), q(2, u), q(1, 2 * u)], cap, admit: false }]);
  }
  if (level === 3) {
    edges.push(["a new version is a miss, and it replaces the old copy",
      { reqs: [q(1, 3 * u), q(1, 3 * u), q(1, 5 * u, 2), q(1, 5 * u, 2), q(1, 3 * u)], cap }]);
    edges.push(["the stale copy is dropped even when the new version is too large to cache",
      { reqs: [q(2, 4 * u), q(1, 4 * u), q(1, cap + u, 2), q(3, 6 * u), q(2, 4 * u)], cap }]);
    edges.push(["an older version after a newer one is a miss too",
      { reqs: [q(1, 2 * u), q(1, 2 * u, 2), q(1, 2 * u), q(1, 2 * u, 2)], cap }]);
    edges.push(["a new version counts as a repeat request for admission",
      { reqs: [q(1, 2 * u), q(1, 3 * u, 2), q(1, 3 * u, 2), q(2, u), q(2, u)], cap, admit: true }]);
    edges.push(["a larger new version evicts other segments to fit",
      { reqs: [q(1, 3 * u), q(2, 3 * u), q(3, 3 * u), q(1, 7 * u, 2), q(3, 3 * u), q(2, 3 * u)], cap }]);
  }
  for (const [name, c] of edges) tests.push({ name, args: pyArgs(c), expect: pyOut(run(c)) });

  // Timing: compared with the reference at check time. About 13 000 segments stay
  // cached; a list-ordered cache or a scan for the oldest entry per eviction is far
  // too slow, an ordered dictionary is O(1) per request.
  const n = 300000;
  const seed = r.int(1, 1_000_000);
  tests.push({
    name: `${n.toLocaleString("en-US")} requests against a ${level === 3 ? "versioned " : ""}trace in time`,
    args: `(_gen_trace(${n}, 60000, ${seed}, ${level === 3 ? "True" : "False"}), 12000000000, ${level >= 2 ? "True" : "False"})`,
    limit_s: 8,
  });

  return {
    vars: {
      admission_rule: level === 1
        ? "In this exercise `admit_on_second` is always False: every miss that fits is admitted."
        : "When `admit_on_second` is True, a missed segment is admitted only if the same `object_id` was requested at least once earlier in the trace (any version, hit or miss, cached or not). Its first request is served from upstream and not stored. When it is False, every miss that fits is admitted.",
      version_rule: level === 3
        ? "A segment can be re-encoded, so a request may name a different `version` of an `object_id` than the cached copy. That request is a miss, the cached copy is removed at once (its bytes are freed) whatever happens next, and the requested version is then admitted by the usual rules. A newer or an older version both count as different."
        : "In this exercise every segment keeps the same version, so the version never decides a hit.",
    },
    samples,
    tests,
  };
}
