/* CFX-L1-01 — Cache hit ratio per zone and content type (SQL).
   Simulated practice scenario. All data is generated from the seed. Which cache statuses
   count as hits, which are excluded, the minimum-requests floor and the host-to-zone rule
   are this exercise's own rules, not any product's definition.

   Contract: see docs/COMPANY-INTERVIEW-LOOPS.md § Executable templates (sql).
   level: 1 Medium (hit/revalidated are hits, miss/expired are misses, bypass/dynamic excluded,
                    floor on cacheable requests, every host on exactly one zone)
          2 Hard (+ stale and updating are hits, raw Content-Type headers to normalise)
          3 Very Hard (+ nested zones: the longest zone wins; hosts on no zone dropped,
                       including look-alike suffixes; a missing Content-Type is 'unknown') */
import { insertSQL, ts } from "../../js/rng.js";

export const kind = "sql";

const BASE_ZONES = ["example.com", "example.net", "example.org"];
const TYPES = ["application/javascript", "application/json", "image/png", "image/webp", "text/css", "text/html"];
const SUBS = ["www", "img", "static", "cdn", "assets"];
const HIT_L1 = ["hit", "revalidated"];
const HIT_L2 = ["stale", "updating"];
const MISS = ["miss", "expired"];
const EXCL = ["bypass", "dynamic"];

const cmp = (x, y) => (x < y ? -1 : x > y ? 1 : 0);

export function generate(r, level) {
  const floor = r.pick([3, 4, 5]);
  // Zones and the hosts that belong to each.
  const zoneNames = r.sample(BASE_ZONES, 2).sort();
  const hostsOf = new Map();
  for (const z of zoneNames) hostsOf.set(z, [z, ...r.sample(SUBS, 2).map((s) => s + "." + z)]);
  const orphans = [];
  if (level === 3) {
    // A nested zone under the first zone; its hosts must not count for the parent.
    const nested = r.pick(["shop", "eu", "api"]) + "." + zoneNames[0];
    zoneNames.push(nested);
    hostsOf.set(nested, [nested, r.pick(SUBS) + "." + nested]);
    // Hosts on no zone: a look-alike suffix and a removed zone.
    orphans.push(r.pick(SUBS) + ".my" + zoneNames[1], "www.old" + zoneNames[0]);
  }
  zoneNames.sort();

  // Plan groups (zone, base content type) with a number of cacheable requests each.
  const groups = [];
  for (const z of zoneNames) for (const t of r.sample(TYPES, level === 1 ? 2 : 3)) groups.push({ z, t, c: r.int(floor - 2, floor + 5) });
  const g = r.shuffle(groups);
  g[0].c = floor;            // exactly at the floor: reported
  g[1].c = floor - 1;        // one below: not reported, even with excluded requests on top
  g[1].extraExcl = floor;
  if (g[2].c < floor) g[2].c = floor + 2;
  g[2].mustReval = true;     // a revalidated hit in a reported group
  g[2].extraExcl = Math.max(g[2].extraExcl || 0, 1);

  const reqs = [];   // {host, ct, status}
  const hitSet = level === 1 ? HIT_L1 : [...HIT_L1, ...HIT_L2];
  const rawCt = (t) => {
    if (level === 1) return t;
    const v = r.int(0, 5);
    if (v === 0 && (t.startsWith("text/") || t === "application/json" || t === "application/javascript")) return t + "; charset=utf-8";
    if (v === 1) return t.toUpperCase();
    if (v === 2) return t[0].toUpperCase() + t.slice(1);
    if (v === 3) return " " + t;
    return t;
  };
  for (const grp of groups) {
    const hosts = hostsOf.get(grp.z);
    const statuses = [];
    for (let i = 0; i < grp.c; i++) statuses.push(r.chance(0.6) ? r.pick(hitSet) : r.pick(MISS));
    if (grp.c >= 2) { statuses[0] = "hit"; statuses[1] = "miss"; }
    if (grp.mustReval) statuses[2] = level === 1 ? "revalidated" : r.pick(["revalidated", "stale", "updating"]);
    const nEx = (grp.extraExcl || 0) + r.int(0, 2);
    for (let i = 0; i < nEx; i++) statuses.push(r.pick(EXCL));
    for (const s of statuses) reqs.push({ host: r.pick(hosts), ct: rawCt(grp.t), status: s });
  }
  if (level === 3) {
    for (const h of orphans) for (let i = r.int(floor, floor + 2); i > 0; i--) reqs.push({ host: h, ct: r.pick(TYPES), status: r.pick(["hit", "miss"]) });
    // A missing Content-Type, enough of them in one zone to be reported.
    const z = r.pick(zoneNames);
    for (let i = 0; i < floor + 1; i++) reqs.push({ host: r.pick(hostsOf.get(z)), ct: null, status: i === 0 ? "miss" : r.pick(["hit", "revalidated", "miss"]) });
  }

  const ordered = r.shuffle(reqs);
  let rid = 700000 + r.int(0, 90000);
  const day = "2026-09-" + r.pick(["21", "22", "23"]);
  const rows = ordered.map((q) => [rid += r.int(1, 7), ts(day, r.int(0, 86399)), q.host, q.ct, q.status]);

  // Oracle, from the generated rows.
  const zoneOf = (host, o) => {
    let best = null;
    for (const z of zoneNames) {
      const ok = o.noDot ? host.endsWith(z) : host === z || host.endsWith("." + z);
      if (ok && (best === null || (o.shortest ? z.length < best.length : z.length > best.length))) best = z;
    }
    return best;
  };
  const normCt = (ct, o) => {
    if (ct === null) return "unknown";
    return o.rawCt ? ct : ct.split(";")[0].trim().toLowerCase();
  };
  const solve = (o = {}) => {
    const hits = o.revalAsMiss ? ["hit"] : [...HIT_L1, ...HIT_L2];
    const per = new Map();
    for (const [, , host, ct, st] of rows) {
      const z = zoneOf(host, o);
      if (z === null) continue;
      const k = z + "\u0000" + normCt(ct, o);
      if (!per.has(k)) per.set(k, { all: 0, c: 0, h: 0 });
      const s = per.get(k);
      s.all++;
      if (EXCL.includes(st) && !o.keepExcluded) continue;
      s.c++;
      if (hits.includes(st)) s.h++;
    }
    const share = (n, d) => Math.floor((n * 20000 + d) / (2 * d)) / 10000;
    return [...per.entries()]
      .filter(([, s]) => { const n = o.floorAll ? s.all : s.c; return s.c > 0 && (o.floorStrict ? n > floor : n >= floor); })
      .map(([k, s]) => { const [z, t] = k.split("\u0000"); return [z, t, s.c, s.h, share(s.h, s.c)]; })
      .sort((x, y) => cmp(x[0], y[0]) || cmp(x[1], y[1]));
  };
  const expected = solve();

  const diagnostics = [
    { message: "Revalidated responses were counted as misses. Under this exercise's rule a response served from cache after a successful revalidation with the origin is a hit.", rows: solve({ revalAsMiss: true }) },
    { message: "Bypassed and uncacheable (dynamic) requests were left in the denominator. They are excluded: the cache never had a chance to serve them.", rows: solve({ keepExcluded: true }) },
    { message: "The floor was applied with > instead of >=. A group with exactly the minimum number of cacheable requests is reported.", rows: solve({ floorStrict: true }) },
    { message: "The floor was applied to all requests. It counts cacheable requests only, so excluded requests cannot lift a group over it.", rows: solve({ floorAll: true }) },
  ];
  if (level >= 2) diagnostics.push({ message: "Content types were grouped as logged. Normalise the header first: the media type before any ';', trimmed and lower-cased.", rows: solve({ rawCt: true }) });
  if (level === 3) {
    diagnostics.push({ message: "Hosts were matched to zones by a plain suffix. 'www.myexample.net' is not in zone 'example.net': the zone must equal the host or follow a dot.", rows: solve({ noDot: true }) });
    diagnostics.push({ message: "A host under a nested zone was given to the parent zone. The longest matching zone name wins.", rows: solve({ shortest: true }) });
  }

  const zCols = ["zone_name"];
  const zRows = zoneNames.map((z) => [z]);
  const rCols = ["request_id", "request_ts", "host", "content_type", "cache_status"];
  const setup =
    "SET TIME ZONE 'UTC';\n" +
    "CREATE TABLE zones (\n  zone_name TEXT PRIMARY KEY\n);\n" +
    "CREATE TABLE requests (\n  request_id BIGINT PRIMARY KEY,\n  request_ts TIMESTAMPTZ NOT NULL,\n  host TEXT NOT NULL,\n  content_type TEXT,\n  cache_status TEXT NOT NULL\n);\n" +
    insertSQL("zones", zCols, zRows) + insertSQL("requests", rCols, rows);

  return {
    vars: {
      min_cacheable: floor,
      requests: rows.length,
      zone_count: zoneNames.length,
      status_rule: level === 1
        ? "In this sample `cache_status` is one of `hit`, `revalidated`, `miss`, `expired`, `bypass` and `dynamic`."
        : "`stale` and `updating` (a cached copy served while it is being refreshed) also count as **hits**.",
      ct_rule: level === 1
        ? "`content_type` is already a clean, lower-case media type in this sample."
        : "`content_type` is the raw response header: report the media type before any `;`, trimmed and lower-cased (`Text/HTML; charset=utf-8` is `text/html`).",
      zone_rule: level === 3
        ? "Zones can be nested (`shop.example.com` inside `example.com`): a host belongs to the **longest** matching zone. Requests whose host is on no zone are left out. A missing `content_type` is reported as `unknown`."
        : "Every host in this sample belongs to exactly one zone.",
    },
    setup,
    tables: [
      { name: "zones", columns: zCols, rows: zRows },
      { name: "requests", columns: rCols, rows },
    ],
    expected: { columns: ["zone_name", "content_type", "cacheable_requests", "cache_hits", "hit_ratio"], rows: expected },
    diagnostics: diagnostics.filter((d) => JSON.stringify(d.rows) !== JSON.stringify(expected)),
  };
}
