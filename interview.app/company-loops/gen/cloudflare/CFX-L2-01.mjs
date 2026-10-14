/* CFX-L2-01 — Weighted hashing ring for origin pools (Python, hashing / binary search).
   Simulated practice scenario. All data is generated from the seed.

   Contract (python): entry, signature, starter, prelude, generate(r, level) ->
     { vars, samples: [{args, expect}], tests: [{name, args, expect?, limit_s?}] }.
   expect comes from oracle() below: for every key it scans every point on the ring
   and keeps the smallest (position, origin, index) at or after the key's hash, which
   is the slow, obviously-correct reading of the rule. The evaluator's reference sorts
   the ring once and binary-searches it, so each checks the other.
   level: 1 Medium (map keys to origins) · 2 Hard (+ how many keys move when one origin
          is removed) · 3 Very Hard (+ where the moved keys go, drained origins,
          repeated keys) */
export const kind = "python";
export const entry = "route_keys";
export const signature = "def route_keys(origins: list[tuple[str, int]], keys: list[str], vnodes: int, remove: str | None = None, detail: bool = False):";
export const starter = `def ring_hash(s):
    """32-bit FNV-1a over the UTF-8 bytes of s, then a 32-bit mixing step so that
    similar strings land far apart. Use exactly this function."""
    h = 2166136261
    for b in s.encode("utf-8"):
        h = ((h ^ b) * 16777619) & 0xFFFFFFFF
    h ^= h >> 16
    h = (h * 0x85EBCA6B) & 0xFFFFFFFF
    h ^= h >> 13
    h = (h * 0xC2B2AE35) & 0xFFFFFFFF
    h ^= h >> 16
    return h


def route_keys(origins, keys, vnodes, remove=None, detail=False):
    """origins: [(name, weight)]; each origin owns weight * vnodes points on the ring,
    point i at ring_hash(name + "#" + str(i)). Return the origin name for every key."""
    ...
`;

export const prelude = `
def _gen_pool(n, seed):
    x, out = seed, []
    for i in range(n):
        x = (1103515245 * x + 12345) % 2147483648
        out.append(('origin-%02d.pool' % i, 1 + (x >> 16) % 5))
    return out


def _gen_keys(n, seed):
    x, out = seed, []
    for i in range(n):
        x = (1103515245 * x + 12345) % 2147483648
        out.append('/assets/%x/img-%d.webp' % ((x >> 8) % 65536, (x >> 4) % 997))
    return out
`.trim() + "\n";

// 32-bit FNV-1a over the bytes of an ASCII string (all generated names are ASCII), then
// the murmur3 32-bit finaliser, exactly as the starter's ring_hash.
export function ringHash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  h ^= h >>> 16;
  return h >>> 0;
}

function points(origins, vnodes, skip) {
  const pts = [];
  for (const [name, w] of origins) {
    if (name === skip) continue;
    for (let i = 0; i < w * vnodes; i++) pts.push({ pos: ringHash(name + "#" + i), name, i });
  }
  return pts;
}
const less = (a, b) => a.pos !== b.pos ? a.pos < b.pos : a.name !== b.name ? a.name < b.name : a.i < b.i;

// Scan every point for every key: the first point at or after the key's hash, else wrap.
function owner(pts, h) {
  let best = null, first = null;
  for (const p of pts) {
    if (first === null || less(p, first)) first = p;
    if (p.pos >= h && (best === null || less(p, best))) best = p;
  }
  return (best || first).name;
}

export function oracle(origins, keys, vnodes, remove, detail) {
  const pts = points(origins, vnodes, null);
  if (!pts.length) return null;
  const before = keys.map((k) => owner(pts, ringHash(k)));
  if (remove === null || remove === undefined) return before;
  const pts2 = points(origins, vnodes, remove);
  if (!pts2.length) return null;
  const after = keys.map((k) => owner(pts2, ringHash(k)));
  let moved = 0;
  const to = {};
  before.forEach((b, i) => { if (b !== after[i]) { moved++; to[after[i]] = (to[after[i]] || 0) + 1; } });
  return detail ? [before, moved, to] : [before, moved];
}

const q = (s) => "'" + s + "'";
const pyList = (xs) => "[" + xs.map(q).join(", ") + "]";
function pyOut(v) {
  if (v === null) return "None";
  if (!Array.isArray(v[0])) return pyList(v);
  const parts = [pyList(v[0]), String(v[1])];
  if (v.length === 3) parts.push("{" + Object.keys(v[2]).sort().map((k) => `${q(k)}: ${v[2][k]}`).join(", ") + "}");
  return "(" + parts.join(", ") + ")";
}
const pyArgs = (c) => `([${c.origins.map(([n, w]) => `(${q(n)}, ${w})`).join(", ")}], ${pyList(c.keys)}, ${c.vnodes}, ${c.remove == null ? "None" : q(c.remove)}, ${c.detail ? "True" : "False"})`;
const run = (c) => oracle(c.origins, c.keys, c.vnodes, c.remove, c.detail);

const POOLS = [
  ["origin-iad", "origin-fra", "origin-sin", "origin-gru", "origin-syd", "origin-ams"],
  ["web-a.internal", "web-b.internal", "web-c.internal", "web-d.internal", "web-e.internal"],
  ["api-1", "api-2", "api-3", "api-4", "api-5", "api-6", "api-7"],
  ["img-east", "img-west", "img-central", "img-north"],
];
const PATHS = ["/", "/login", "/api/v2/cart", "/img/logo.svg", "/static/app.js", "/static/app.css", "/products/42",
  "/products/77", "/search?q=lamp", "/checkout", "/account/orders", "/blog/edge-caching", "/fonts/inter.woff2",
  "/api/v2/price", "/robots.txt", "/sitemap.xml", "/img/hero.webp", "/help/returns"];

function randomCase(r, level) {
  const names = r.sample(r.pick(POOLS), r.int(3, 4));
  const origins = names.map((n) => [n, r.int(1, 3)]);
  if (level === 3 && r.chance(0.6)) origins.push([r.pick(r.pick(POOLS).filter((n) => !names.includes(n))) || "drained-origin", 0]);
  let keys = r.sample(PATHS, r.int(7, 10));
  if (level === 3) keys = keys.concat(r.sample(keys, 2));
  const c = { origins: r.shuffle(origins), keys, vnodes: r.int(2, 5), remove: null, detail: level === 3 };
  if (level >= 2) c.remove = r.pick(names);
  return c;
}

export function generate(r, level) {
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const c = randomCase(r, level);
    samples.push({ args: pyArgs(c), expect: pyOut(run(c)) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const names = r.sample(r.pick(POOLS), 3);
  const [A, B, C] = names;
  const vn = r.int(2, 4);
  const pool = [[A, 2], [B, 1], [C, 3]];
  const detail = level === 3;
  const rm = level >= 2 ? B : null;
  // A key whose hash is above every point must wrap round to the first point.
  const top = Math.max(...points(pool, vn, null).map((p) => p.pos));
  let wrapKey = null;
  for (let i = 0; i < 5000 && wrapKey === null; i++) if (ringHash("/cache/" + i) > top) wrapKey = "/cache/" + i;
  if (wrapKey === null) throw new Error("CFX-L2-01: no key above every point");
  const edges = [
    ["a key that hashes exactly onto a point belongs to that point's origin", { origins: pool, keys: [`${C}#1`, `${A}#0`, `${B}#${vn - 1}`], vnodes: vn }],
    ["a key above every point wraps to the first point on the ring", { origins: pool, keys: [wrapKey, "/"], vnodes: vn }],
    ["no keys at all", { origins: pool, keys: [], vnodes: vn }],
    ["one origin takes every key", { origins: [[A, 1]], keys: ["/a", "/b", "/c"], vnodes: vn, remove: level >= 2 ? C : null }],
    ["an empty pool returns None", { origins: [], keys: ["/a"], vnodes: vn }],
    ["an origin with weight 0 owns no points", { origins: [[A, 0], [B, 0]], keys: ["/a", "/b"], vnodes: vn }],
    ["a weight-0 origin next to live ones receives nothing", { origins: [[A, 1], [B, 0], [C, 2]], keys: PATHS.slice(0, 8), vnodes: vn }],
  ];
  if (level >= 2) {
    edges.push(["removing an origin moves only the keys it held", { origins: pool, keys: PATHS.slice(0, 12), vnodes: vn }]);
    edges.push(["removing a name that is not in the pool moves nothing", { origins: pool, keys: PATHS.slice(3, 9), vnodes: vn, remove: "not-in-pool" }]);
    edges.push(["removing the only origin with points returns None", { origins: [[A, 0], [B, 2]], keys: ["/x"], vnodes: vn, remove: B }]);
    edges.push(["a repeated key is counted every time it moves", { origins: pool, keys: [...PATHS.slice(0, 6), ...PATHS.slice(0, 6)], vnodes: vn }]);
  }
  for (const [name, c] of edges) {
    if (!("remove" in c)) c.remove = rm;
    c.detail = detail;
    if (level === 1) c.remove = null;
    tests.push({ name, args: pyArgs(c), expect: pyOut(run(c)) });
  }

  const seed = r.int(1, 1_000_000);
  const removeArg = level >= 2 ? `'origin-${String(r.int(0, 39)).padStart(2, "0")}.pool'` : "None";
  tests.push({
    name: "40 origins, 160 points per unit of weight and 60,000 keys in time",
    args: `(_gen_pool(40, ${seed}), _gen_keys(60000, ${seed + 1}), 160, ${removeArg}, ${detail ? "True" : "False"})`,
    limit_s: 8,
  });

  return {
    vars: {
      remove_rule: level === 1
        ? "In this exercise `remove` is None: return only the list of origin names."
        : "When `remove` is the name of an origin, also work out where every key would go if that origin were taken out of the pool, and return a tuple `(names, moved)`: `names` is the list above for the full pool, and `moved` is the number of entries of `keys` (a repeated key counts each time) whose origin differs without it. A `remove` that names no origin in the pool moves nothing. If taking it out leaves no points at all, return None.",
      detail_rule: level === 3
        ? "With `detail=True`, return `(names, moved, to)` instead, where `to` maps each origin that receives moved keys to how many it receives (an empty dict when nothing moves)."
        : "`detail` is False in this exercise.",
    },
    samples,
    tests,
  };
}
