/* ABB-L1-05 — Map search: listings inside a viewport, across the antimeridian, by price, paged (Python).
   Simulated practice scenario. All data is generated from the seed.

   Contract (python): entry, signature, starter, prelude, generate(r, level) ->
     { vars, samples: [{args, expect}], tests: [{name, args, expect?, limit_s?}] }.
   expect comes from oracle() below, which checks every listing against every query. The
   evaluator's reference buckets listings into a latitude/longitude grid once and visits
   only the cells a viewport touches; the two were written independently.
   level: 1 Medium (inclusive bounds, one viewport that crosses the antimeridian, price ties
            broken by id)
          2 Hard (+ invalid queries with a sentinel result, pages past the end, viewports on
            both sides of the antimeridian)
          3 Very Hard (+ an optional maximum price per query, listings exactly on every edge,
            a viewport that is a single meridian) */
export const kind = "python";
export const entry = "search_map";
export const signature = "def search_map(listings: list[tuple[str, float, float, int]], queries: list[tuple[float, float, float, float, int, int, int | None]]) -> list[tuple[int, list[str]]]:";
export const starter = `def search_map(listings, queries):
    """listings: (listing_id, lat, lng, nightly_price).
    queries: (south, west, north, east, page, page_size, max_price or None).
    Return one (total_matches, listing_ids_on_page) per query, in query order."""
    ...
`;

export const prelude = `
def _gen_map(n_listings, n_queries, seed, with_price=False):
    x = seed
    def rnd(m):
        nonlocal x
        x = (1103515245 * x + 12345) % 2147483648
        return (x >> 16) % m
    centres = [(-36.85, 174.76), (-17.71, 178.06), (-18.14, -178.44), (65.0, -179.5), (51.5, -0.12),
               (38.72, -9.14), (35.01, 135.77), (-33.92, 18.42), (19.43, -99.13), (41.69, 44.8),
               (55.95, -3.19), (37.39, -5.98), (-45.03, 168.66), (13.75, 100.5), (-8.65, 115.2)]
    listings = []
    for k in range(n_listings):
        clat, clng = centres[rnd(len(centres))]
        lat = round(clat + (rnd(20001) - 10000) / 10000.0, 4)
        lng = clng + (rnd(20001) - 10000) / 10000.0
        if lng >= 180.0:
            lng -= 360.0
        elif lng < -180.0:
            lng += 360.0
        listings.append(('lst_%06d' % k, lat, round(lng, 4), 40 + rnd(400)))
    queries = []
    for _ in range(n_queries):
        clat, clng = centres[rnd(len(centres))]
        h, w = (3 + rnd(20)) / 100.0, (3 + rnd(20)) / 100.0
        lat = clat + (rnd(1601) - 800) / 1000.0
        lng = clng + (rnd(1601) - 800) / 1000.0
        west, east = round(lng - w, 3), round(lng + w, 3)
        if west < -180.0:
            west += 360.0
        if east >= 180.0:
            east -= 360.0
        queries.append((round(lat - h, 3), west, round(lat + h, 3), east, rnd(4), 20,
                        (80 + rnd(300)) if with_price and rnd(2) else None))
    return listings, queries
`.trim() + "\n";

// The specification, literally: test every listing against every query.
export function oracle(listings, queries) {
  return queries.map(([s, w, n, e, page, size, maxPrice]) => {
    if (s > n || page < 0 || size < 1) return [0, []];
    const hits = listings.filter(([, lat, lng, price]) => {
      if (lat < s || lat > n) return false;
      const inLng = w <= e ? w <= lng && lng <= e : lng >= w || lng <= e;
      return inLng && (maxPrice === null || price <= maxPrice);
    });
    hits.sort((a, b) => a[3] - b[3] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
    return [hits.length, hits.slice(page * size, (page + 1) * size).map((x) => x[0])];
  });
}

const num = (x) => String(x);
const pyOut = (res) => "[" + res.map(([t, ids]) => `(${t}, [${ids.map((i) => `'${i}'`).join(", ")}])`).join(", ") + "]";
const pyArgs = (listings, queries) =>
  `([${listings.map(([id, la, ln, p]) => `('${id}', ${num(la)}, ${num(ln)}, ${p})`).join(", ")}], ` +
  `[${queries.map(([s, w, n, e, pg, sz, mp]) => `(${num(s)}, ${num(w)}, ${num(n)}, ${num(e)}, ${pg}, ${sz}, ${mp === null ? "None" : mp})`).join(", ")}])`;

const fix = (x, d = 3) => Number(x.toFixed(d));
const wrap = (lng) => (lng >= 180 ? lng - 360 : lng < -180 ? lng + 360 : lng);

function randomCase(r, level) {
  // Two clusters: one straddling the antimeridian, one elsewhere.
  const centres = [[r.int(-40, -10) + 0.5, 179.5], [r.int(10, 50) + 0.25, r.int(-120, 120) + 0.5]];
  const listings = [];
  const n = level === 1 ? r.int(9, 12) : r.int(12, 16);
  const used = new Set();
  for (let k = 0; k < n; k++) {
    const [clat, clng] = centres[k % 2];
    let id;
    do id = "lst_" + r.int(100, 999); while (used.has(id));
    used.add(id);
    listings.push([id, fix(clat + r.int(-80, 80) / 100, 2), fix(wrap(clng + r.int(-80, 80) / 100), 2), r.pick([60, 75, 90, 90, 120, 150, 210])]);
  }
  const queries = [];
  const q = level === 1 ? 3 : 5;
  for (let i = 0; i < q; i++) {
    const [clat, clng] = centres[i % 2];
    const h = r.int(30, 90) / 100, w = r.int(30, 90) / 100;
    const lat = clat + r.int(-30, 30) / 100, lng = clng + r.int(-30, 30) / 100;
    const size = r.int(2, 4);
    queries.push([fix(lat - h, 2), fix(wrap(lng - w), 2), fix(lat + h, 2), fix(wrap(lng + w), 2), r.int(0, 1), size,
      level === 3 && r.chance(0.5) ? r.pick([90, 120, 150]) : null]);
  }
  if (level >= 2) queries.push([centres[0][0] + 1, 170, centres[0][0] - 1, -170, 0, 5, null]);   // south > north
  return { listings: r.shuffle(listings), queries };
}

export function generate(r, level) {
  const samples = [];
  for (let i = 0; i < 3; i++) {
    let c;
    for (let a = 0; a < 50; a++) { c = randomCase(r, level); if (oracle(c.listings, c.queries).some(([t]) => t > 0)) break; }
    samples.push({ args: pyArgs(c.listings, c.queries), expect: pyOut(oracle(c.listings, c.queries)) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const lat0 = r.int(-50, 50);
  const p = r.int(80, 200);
  const L = (id, la, ln, price) => [id, la, ln, price];
  const edges = [
    ["a viewport west of 180 and east of -180 crosses the antimeridian",
      [L("lst_a1", lat0 + 0.1, 179.9, p), L("lst_a2", lat0 + 0.2, -179.9, p + 10), L("lst_a3", lat0 + 0.3, 0.5, p - 10), L("lst_a4", lat0 + 0.1, 178.0, p)],
      [[lat0, 179.5, lat0 + 1, -179.5, 0, 10, null]]],
    ["the bounds are inclusive",
      [L("lst_b1", lat0, 10.25, p), L("lst_b2", lat0 + 1, 10.5, p), L("lst_b3", lat0 + 0.5, 10.75, p), L("lst_b4", lat0 + 1.0001, 10.5, p)],
      [[lat0, 10.25, lat0 + 1, 10.75, 0, 10, null]]],
    ["equal prices are ordered by listing_id; pages are 0-based",
      [L("lst_c3", lat0 + 0.2, 20.2, p), L("lst_c1", lat0 + 0.3, 20.3, p), L("lst_c2", lat0 + 0.4, 20.4, p), L("lst_c0", lat0 + 0.5, 20.5, p + 1)],
      [[lat0, 20, lat0 + 1, 21, 0, 2, null], [lat0, 20, lat0 + 1, 21, 1, 2, null]]],
  ];
  if (level >= 2) {
    edges.push(["invalid queries return (0, []): south above north, a negative page, a page size of 0",
      [L("lst_d1", lat0 + 0.5, 30.5, p)],
      [[lat0 + 1, 30, lat0, 31, 0, 5, null], [lat0, 30, lat0 + 1, 31, -1, 5, null], [lat0, 30, lat0 + 1, 31, 0, 0, null], [lat0, 30, lat0 + 1, 31, 0, 1, null]]]);
    edges.push(["a page past the end still reports the total",
      [L("lst_e1", lat0 + 0.5, -60.5, p), L("lst_e2", lat0 + 0.6, -60.4, p + 5)],
      [[lat0, -61, lat0 + 1, -60, 3, 2, null]]]);
    edges.push(["a crossing viewport includes -180 and excludes a listing just east of its east edge",
      [L("lst_f1", lat0 + 0.5, -180, p), L("lst_f2", lat0 + 0.5, 179.999, p), L("lst_f3", lat0 + 0.5, -178.999, p), L("lst_f4", lat0 + 0.5, -179, p + 1)],
      [[lat0, 179.9, lat0 + 1, -179, 0, 10, null]]]);
  }
  if (level === 3) {
    edges.push(["max_price is inclusive; None means no limit",
      [L("lst_g1", lat0 + 0.5, 40.5, p), L("lst_g2", lat0 + 0.5, 40.6, p + 1), L("lst_g3", lat0 + 0.5, 40.7, p - 1)],
      [[lat0, 40, lat0 + 1, 41, 0, 10, p], [lat0, 40, lat0 + 1, 41, 0, 10, null]]]);
    edges.push(["a viewport one meridian wide matches only that longitude; a whole-world viewport matches all",
      [L("lst_h1", lat0 + 0.5, 50.5, p), L("lst_h2", lat0 + 0.6, 50.5001, p), L("lst_h3", lat0 + 0.7, -170, p)],
      [[lat0, 50.5, lat0 + 1, 50.5, 0, 10, null], [-90, -180, 90, 180, 0, 10, null]]]);
  }
  for (const [name, listings, queries] of edges) tests.push({ name, args: pyArgs(listings, queries), expect: pyOut(oracle(listings, queries)) });

  // Timing: 60 000 listings in 15 metros, 6 000 small viewports. A full scan is
  // 3.6 × 10^8 listing checks; a grid visits only the few cells each viewport touches.
  tests.push({
    name: "60,000 listings, 6,000 viewports (a spatial index, not a scan per query)",
    args: `_gen_map(60000, 6000, ${r.int(1, 1_000_000)}, ${level === 3 ? "True" : "False"})`,
    limit_s: 8,
  });

  return {
    vars: {
      invalid_rule: level === 1
        ? "Every query in this data is valid (`south <= north`, `page >= 0`, `page_size >= 1`)."
        : "A query with `south > north`, `page < 0` or `page_size < 1` is invalid: return `(0, [])` for it.",
      price_rule: level === 3
        ? "`max_price`, when not None, keeps only listings with `nightly_price <= max_price`."
        : "`max_price` is always None in this data, but keep the field.",
    },
    samples,
    tests,
  };
}
