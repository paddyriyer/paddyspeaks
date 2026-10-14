/* CFX-L1-05 — Was the cached copy purged before this request? (Python).
   Simulated practice scenario. All data is generated from the seed. The purge kinds, the
   matching rules and the inclusive time boundaries are this exercise's own rules; check
   current docs for how any real purge feature behaves.

   Contract (python): entry, signature, starter, prelude, generate(r, level) ->
     { vars, samples: [{args, expect}], tests: [{name, args, expect?, limit_s?}] }.
   expect comes from oracle() below, which checks every purge against every request
   (fine for small inputs). The evaluator's reference indexes purge times per
   (zone, kind, value) and bisects.
   level: 1 Medium (one zone, tag purges, purges listed in time order)
          2 Hard (+ several zones, purge-everything, purges in any order)
          3 Very Hard (+ prefix purges on whole path segments) */
export const kind = "python";
export const entry = "invalidated";
export const signature = "def invalidated(purges: list[tuple[int, str, str, str | None]], requests: list[tuple[int, str, str, int, list[str]]]) -> list[bool]:";
export const starter = `def invalidated(purges, requests):
    """purges: (purge_ts, zone, kind, value); kind is 'tag', 'everything' (value None) or 'prefix'.
    requests: (request_ts, zone, path, cached_at, tags) with cached_at <= request_ts.
    Return one bool per request: True if a matching purge in the request's zone has
    cached_at <= purge_ts <= request_ts."""
    ...
`;

export const prelude = `
def _gen_purges(n_req, n_purge, n_zones, n_tags, seed, everything=False, prefixes=False, shuffled=False):
    x = seed
    def rnd(m):
        nonlocal x
        x = (1103515245 * x + 12345) % 2147483648
        return (x >> 16) % m
    horizon = 2000000
    dirs = ['/img', '/img/products', '/css', '/js', '/docs', '/docs/v2', '/api/v1']
    purges = []
    for i in range(n_purge):
        t = i * horizon // n_purge
        z = 'zone%d.example' % rnd(n_zones)
        k = rnd(40)
        if everything and k == 0:
            purges.append((t, z, 'everything', None))
        elif prefixes and k < 4:
            purges.append((t, z, 'prefix', dirs[rnd(len(dirs))]))
        else:
            purges.append((t, z, 'tag', 'tag-%d' % rnd(n_tags)))
    if shuffled:
        for i in range(len(purges) - 1, 0, -1):
            j = rnd(i + 1)
            purges[i], purges[j] = purges[j], purges[i]
    requests = []
    for i in range(n_req):
        t = rnd(horizon)
        cached = max(0, t - rnd(2000))
        path = '%s/item-%d.%s' % (dirs[rnd(len(dirs))], rnd(500), ('png', 'css', 'js', 'html')[rnd(4)])
        tags = ['tag-%d' % rnd(n_tags) for _ in range(1 + rnd(3))]
        requests.append((t, 'zone%d.example' % rnd(n_zones), path, cached, tags))
    return purges, requests
`.trim() + "\n";

const matches = (p, path, tags) =>
  (p.kind === "tag" && tags.includes(p.value)) ||
  p.kind === "everything" ||
  (p.kind === "prefix" && (path === p.value || path.startsWith(p.value + "/")));

// Independent oracle: every purge against every request.
export function oracle(purges, requests) {
  return requests.map(([t, zone, path, cached, tags]) =>
    purges.some(([pt, pz, kind, value]) => pz === zone && cached <= pt && pt <= t && matches({ kind, value }, path, tags)));
}

const q = (s) => (s === null ? "None" : `'${s}'`);
const pyArgs = (purges, requests) =>
  `([${purges.map(([t, z, k, v]) => `(${t}, ${q(z)}, ${q(k)}, ${q(v)})`).join(", ")}], ` +
  `[${requests.map(([t, z, p, c, tags]) => `(${t}, ${q(z)}, ${q(p)}, ${c}, [${tags.map(q).join(", ")}])`).join(", ")}])`;
const pyOut = (bs) => "[" + bs.map((b) => (b ? "True" : "False")).join(", ") + "]";

const ZONES = ["example.com", "example.net", "example.org"];
const TAGS = ["product-42", "product-7", "catalog", "homepage", "pricing", "blog", "product"];
const PATHS = ["/img/products/42.png", "/img/logo.svg", "/images/hero.jpg", "/css/site.css", "/docs/v2/start.html", "/docs/v20/start.html", "/index.html"];
const PREFIXES = ["/img", "/img/products", "/docs/v2", "/css", "/images"];

function randomCase(r, level) {
  const zones = level === 1 ? [r.pick(ZONES)] : r.sample(ZONES, 2);
  const tags = r.sample(TAGS, 4);
  const purges = [];
  for (let i = r.int(4, 7); i > 0; i--) {
    const t = 10 * r.int(1, 20);
    const z = r.pick(zones);
    const k = level === 1 ? 0 : r.int(0, level === 3 ? 6 : 5);
    if (k === 5) purges.push([t, z, "everything", null]);
    else if (k === 6) purges.push([t, z, "prefix", r.pick(PREFIXES)]);
    else purges.push([t, z, "tag", r.pick(tags)]);
  }
  if (level === 1) purges.sort((a, b) => a[0] - b[0]);
  const requests = [];
  for (let i = r.int(5, 7); i > 0; i--) {
    const t = 10 * r.int(2, 22);
    const cached = Math.max(0, t - 10 * r.int(0, 8));
    requests.push([t, r.pick(zones), r.pick(PATHS), cached, r.sample(tags, r.int(0, 2))]);
  }
  return { purges, requests };
}

export function generate(r, level) {
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const c = randomCase(r, level);
    samples.push({ args: pyArgs(c.purges, c.requests), expect: pyOut(oracle(c.purges, c.requests)) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const z = r.pick(ZONES);
  const z2 = ZONES.find((x) => x !== z);
  const tag = r.pick(["product-42", "catalog", "pricing"]);
  const t0 = 100 * r.int(1, 9);
  const P = "/img/products/42.png";
  const edges = [
    ["a purge at exactly cached_at invalidates the copy", [[t0, z, "tag", tag]], [[t0 + 50, z, P, t0, [tag]]]],
    ["a purge at exactly request_ts invalidates the copy", [[t0 + 50, z, "tag", tag]], [[t0 + 50, z, P, t0, [tag]]]],
    ["a purge one second before caching, or one second after the request, does not",
      [[t0 - 1, z, "tag", tag], [t0 + 51, z, "tag", tag]], [[t0 + 50, z, P, t0, [tag]]]],
    ["a tag must match exactly: 'product' is not 'product-42'", [[t0 + 10, z, "tag", "product"]], [[t0 + 50, z, P, t0, ["product-42"]], [t0 + 60, z, P, t0, ["product"]]]],
    ["a copy with no tags is never purged by tag", [[t0 + 10, z, "tag", tag]], [[t0 + 50, z, P, t0, []]]],
    ["no purges at all", [], [[t0, z, P, t0, [tag]], [t0 + 5, z, "/index.html", 0, []]]],
  ];
  if (level >= 2) {
    edges.push(["a purge in another zone does not touch this zone's copy, even with the same tag", [[t0 + 10, z2, "tag", tag]], [[t0 + 50, z, P, t0, [tag]]]]);
    edges.push(["purge everything invalidates every copy cached before it in that zone only",
      [[t0 + 10, z, "everything", null]], [[t0 + 50, z, "/index.html", t0, []], [t0 + 50, z2, "/index.html", t0, []], [t0 + 50, z, P, t0 + 20, [tag]]]]);
    edges.push(["purges are not in time order", [[t0 + 300, z, "tag", tag], [t0 + 10, z, "tag", "blog"], [t0 + 40, z, "tag", tag]],
      [[t0 + 50, z, P, t0, [tag]], [t0 + 200, z, P, t0 + 100, [tag, "blog"]]]]);
  }
  if (level === 3) {
    edges.push(["a prefix matches whole path segments: '/img' is not '/images'",
      [[t0 + 10, z, "prefix", "/img"]], [[t0 + 50, z, "/images/hero.jpg", t0, []], [t0 + 50, z, "/img/logo.svg", t0, []], [t0 + 50, z, P, t0, []]]]);
    edges.push(["a prefix equal to the whole path matches; '/docs/v2' is not '/docs/v20'",
      [[t0 + 10, z, "prefix", "/docs/v2/start.html"], [t0 + 20, z, "prefix", "/docs/v2"]],
      [[t0 + 15, z, "/docs/v2/start.html", t0, []], [t0 + 50, z, "/docs/v20/start.html", t0, []]]]);
  }
  for (const [name, p, rq] of edges) tests.push({ name, args: pyArgs(p, rq), expect: pyOut(oracle(p, rq)) });

  // Timing: 100 000 requests against 60 000 purges over 20 tags per zone, so each
  // (zone, tag) holds hundreds to thousands of purge times. Scanning all purges per request
  // is ~6·10^9 checks; scanning one tag's list per request tag is still ~10^8 or more.
  // Sorted times per key and a bisect answer each check in O(log p).
  const seed = r.int(1, 1_000_000);
  tests.push({
    name: "100,000 requests against 60,000 purges, in time",
    args: `_gen_purges(100000, 60000, ${level === 1 ? 1 : 3}, 20, ${seed}, ${level >= 2 ? "True" : "False"}, ${level === 3 ? "True" : "False"}, ${level >= 2 ? "True" : "False"})`,
    limit_s: 8,
  });

  return {
    vars: {
      zone_rule: level === 1
        ? "All purges and requests in this round belong to one zone, every purge has `kind` `'tag'`, and `purges` is in time order."
        : "A purge affects only its own zone: the same tag in two zones is two different tags. `kind` `'everything'` (with `value` `None`) invalidates every copy in its zone. `purges` is in no particular order.",
      prefix_rule: level === 3
        ? "`kind` `'prefix'` invalidates copies whose `path` equals `value` or starts with `value + '/'`: a prefix covers whole path segments, so `/img` covers `/img/logo.svg` but not `/images/hero.jpg`."
        : "There are no prefix purges in this round.",
    },
    samples,
    tests,
  };
}
