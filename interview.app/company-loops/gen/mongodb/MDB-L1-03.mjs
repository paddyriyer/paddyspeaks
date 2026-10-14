/* MDB-L1-03 — Unused indexes across every replica-set member (SQL).
   Simulated practice scenario. All data is generated from the seed; clusters, collections,
   indexes, sizes and counters are hypothetical. The samples mirror, in general terms, the
   per-member index access counters public documentation describes (an ops count and the time
   counting began, reset when the member restarts); the rules here are this exercise's rules.

   Contract: see docs/COMPANY-INTERVIEW-LOOPS.md § Executable templates (sql).
   level: 1 Medium (usage is an increase between consecutive samples on any member; the
            baseline sample does not count; unique, TTL and newly built indexes excluded)
          2 Hard (+ a member restart resets its counters; an index built exactly at the
            window's start)
          3 Very Hard (+ two clusters running the same collections and index names) */
import { insertSQL } from "../../js/rng.js";

export const kind = "sql";

const CLUSTERS = ["shop-us", "shop-eu", "shop-ap"];
const NAMESPACES = ["shop.orders", "shop.customers", "shop.carts", "shop.products", "shop.reviews"];
const PLAIN = [["status_1", "{ status: 1 }"], ["customerId_1_createdAt_-1", "{ customerId: 1, createdAt: -1 }"], ["createdAt_-1", "{ createdAt: -1 }"],
  ["region_1_status_1", "{ region: 1, status: 1 }"], ["tags_1", "{ tags: 1 }"], ["updatedAt_1", "{ updatedAt: 1 }"], ["couponCode_1", "{ couponCode: 1 }"],
  ["lastLogin_-1", "{ lastLogin: -1 }"], ["price_1", "{ price: 1 }"], ["category_1_price_1", "{ category: 1, price: 1 }"], ["warehouseId_1", "{ warehouseId: 1 }"]];
const UNIQUE = [["email_1", "{ email: 1 }"], ["sku_1", "{ sku: 1 }"], ["externalRef_1", "{ externalRef: 1 }"]];
const TTL = [["expireAt_1", "{ expireAt: 1 }"], ["lastSeen_1", "{ lastSeen: 1 }"]];
const DAY = 86400000, HOUR = 3600000, MB = 1048576;
const START = Date.UTC(2026, 8, 28);                 // window start: 2026-09-28 00:00 UTC
const stamp = (ms) => new Date(ms).toISOString().replace("T", " ").replace(/\.000Z$/, "+00");

export function generate(r, level) {
  for (let attempt = 0; attempt < 50; attempt++) {
    const out = build(r, level);
    if (out) return out;
  }
  throw new Error("MDB-L1-03: could not build an instance");
}

function build(r, level) {
  const nSamples = level === 1 ? 5 : 7;               // daily samples; the first is the baseline
  const sampleAt = Array.from({ length: nSamples }, (_, i) => START + i * DAY);
  const end = sampleAt[nSamples - 1];
  const clusters = r.sample(CLUSTERS, level === 3 ? 2 : 1).sort();
  const nss = r.sample(NAMESPACES, level === 1 ? 2 : 3).sort();

  // Profiles every instance needs, spread over the collections.
  const need = ["usedPrimary", "usedSecondary", "unusedBaseline", "unusedZero", "unique", "ttl", "newInWindow"];
  if (level >= 2) need.push("atWindowStart", "afterRestart", "usedPrimary");
  const plainPool = r.shuffle(PLAIN), uniquePool = r.shuffle(UNIQUE), ttlPool = r.shuffle(TTL);
  let pi = 0, ui = 0, ti = 0;
  const specs = [];                                   // the first cluster's indexes
  for (const ns of nss) specs.push({ ns, name: "_id_", key: "{ _id: 1 }", unique: true, ttl: null, profile: "usedPrimary" });
  need.forEach((p, i) => {
    const ns = nss[i % nss.length];
    let name, key, unique = false, ttl = null;
    if (p === "unique") { [name, key] = uniquePool[ui++ % uniquePool.length]; unique = true; }
    else if (p === "ttl") { [name, key] = ttlPool[ti++ % ttlPool.length]; ttl = r.pick([3600, 86400, 604800]); }
    else [name, key] = plainPool[pi++];
    specs.push({ ns, name, key, unique, ttl, profile: p });
  });

  // Every index needs a unique (ns, name) inside a cluster.
  const seen = new Set();
  for (const s of specs) { const k = s.ns + "|" + s.name; if (seen.has(k)) return null; seen.add(k); }

  const all = [];
  clusters.forEach((cl, ci) => {
    for (const s of specs) {
      let profile = s.profile;
      if (ci === 1 && ["usedPrimary", "usedSecondary", "unusedBaseline", "unusedZero"].includes(profile)) {
        // The second cluster runs the same application, with its own traffic: swap used and unused.
        profile = profile.startsWith("used") ? r.pick(["unusedBaseline", "unusedZero"]) : r.pick(["usedPrimary", "usedSecondary"]);
        if (s.name === "_id_") profile = "usedPrimary";
      }
      let created;
      if (profile === "newInWindow") created = START + r.int(1, nSamples - 2) * DAY + r.int(1, 23) * HOUR;
      else if (profile === "atWindowStart") created = START;
      else created = START - r.int(20, 400) * DAY - r.int(0, 23) * HOUR;
      all.push({ cluster: cl, ns: s.ns, name: s.name, key: s.key, unique: s.unique, ttl: s.ttl, profile, created,
        size: s.name === "_id_" ? r.int(200, 3000) * MB + r.int(0, MB) : r.int(8, 4000) * MB + r.int(0, MB - 1) });
    }
  });

  // Samples: per cluster, three members; one primary.
  const samples = [];
  for (const cl of clusters) {
    const members = [0, 1, 2].map((i) => `${cl}-${i}`);
    const primary = r.pick(members);
    const secondaries = members.filter((m) => m !== primary);
    const restart = level >= 2 ? { member: r.pick(members), interval: r.int(2, nSamples - 1) } : null;
    if (restart) restart.at = sampleAt[restart.interval - 1] + r.int(2, 20) * HOUR;
    const bootAt = Object.fromEntries(members.map((m) => [m, START - r.int(3, 60) * DAY - r.int(0, 23) * HOUR]));
    const secOnly = r.pick(secondaries);
    for (const ix of all.filter((x) => x.cluster === cl)) {
      for (const m of members) {
        // increments per interval (index i covers sample i-1 -> i)
        const inc = new Array(nSamples).fill(0);
        const some = () => { const k = r.int(1, nSamples - 1); inc[k] = r.int(1, 5000); for (let i = 1; i < nSamples; i++) if (r.chance(0.5)) inc[i] += r.int(0, 3000); };
        if (ix.profile === "usedPrimary" && m === primary) some();
        if (ix.profile === "usedPrimary" && m !== primary && r.chance(0.5)) some();
        if (ix.profile === "usedSecondary" && m === secOnly) some();
        if (ix.profile === "afterRestart" && restart && m === restart.member) inc[restart.interval] = r.int(1, 9);
        let since = Math.max(bootAt[m], ix.created);
        let ops = ix.profile === "unusedZero" || ix.created >= START ? 0 : ix.profile === "afterRestart" ? r.int(50, 900) : r.int(0, 1) ? r.int(1, 90000) : 0;
        if (ix.profile === "unusedBaseline" && ops === 0) ops = r.int(1, 90000);
        for (let i = 0; i < nSamples; i++) {
          if (i > 0) {
            if (restart && m === restart.member && i === restart.interval && restart.at > ix.created) { since = restart.at; ops = inc[i]; }
            else ops += inc[i];
          }
          if (sampleAt[i] < ix.created) continue;      // not built yet
          samples.push({ cluster: cl, member: m, state: m === primary ? "PRIMARY" : "SECONDARY", ns: ix.ns, name: ix.name, at: sampleAt[i], since, ops });
        }
      }
    }
  }

  const expected = compute(all, samples, {});
  if (!expected.length) return null;

  const diagnostics = [
    { message: "Only the primary's counters were read. An index used only by reads sent to a secondary is still in use; check every member.", rows: compute(all, samples, { primaryOnly: true }) },
    { message: "An index was treated as used because its counter was above zero. The first sample is the baseline: only an increase between samples inside the window is use.", rows: compute(all, samples, { anyOps: true }) },
    { message: "Unique indexes were reported. A unique index enforces a constraint even when no query reads it; exclude it.", rows: compute(all, samples, { keepUnique: true }) },
    { message: "TTL indexes were reported. A TTL index exists to expire documents; exclude it.", rows: compute(all, samples, { keepTtl: true }) },
    { message: "An index built inside the window was reported. It has not been observed for the whole window; exclude indexes created at or after the window's start.", rows: compute(all, samples, { keepNew: true }) },
  ];
  if (level >= 2) {
    diagnostics.push({ message: "An index built exactly at the window's start was reported. 'Built inside the window' includes its first instant: created_at >= window start.", rows: compute(all, samples, { strictStart: true }) });
    diagnostics.push({ message: "Usage was measured as the last sample minus the first. A restart resets a member's counters (its `since` changes), so after a restart the count since `since` is all new use.", rows: compute(all, samples, { lastMinusFirst: true }) });
  }
  if (level === 3) diagnostics.push({ message: "Usage was matched on (ns, index_name) without the cluster. Two clusters with the same collections are separate; an index used in one can be unused in the other.", rows: compute(all, samples, { ignoreCluster: true }) });

  const iCols = ["cluster", "ns", "index_name", "key_pattern", "is_unique", "ttl_seconds", "created_at", "size_bytes"];
  const iRows = all.slice().sort((a, b) => cmp([a.cluster, a.ns, a.name], [b.cluster, b.ns, b.name]))
    .map((x) => [x.cluster, x.ns, x.name, x.key, x.unique, x.ttl, stamp(x.created), x.size]);
  const sCols = ["cluster", "member", "member_state", "ns", "index_name", "sampled_at", "since", "ops"];
  const sRows = samples.slice().sort((a, b) => a.at - b.at || cmp([a.cluster, a.member, a.ns, a.name], [b.cluster, b.member, b.ns, b.name]))
    .map((x) => [x.cluster, x.member, x.state, x.ns, x.name, stamp(x.at), stamp(x.since), x.ops]);
  const setup =
    "SET TIME ZONE 'UTC';\n" +
    "CREATE TABLE indexes (\n  cluster TEXT NOT NULL,\n  ns TEXT NOT NULL,\n  index_name TEXT NOT NULL,\n  key_pattern TEXT NOT NULL,\n  is_unique BOOLEAN NOT NULL,\n  ttl_seconds INT,\n  created_at TIMESTAMPTZ NOT NULL,\n  size_bytes BIGINT NOT NULL,\n  PRIMARY KEY (cluster, ns, index_name)\n);\n" +
    "CREATE TABLE index_stats_samples (\n  cluster TEXT NOT NULL,\n  member TEXT NOT NULL,\n  member_state TEXT NOT NULL,\n  ns TEXT NOT NULL,\n  index_name TEXT NOT NULL,\n  sampled_at TIMESTAMPTZ NOT NULL,\n  since TIMESTAMPTZ NOT NULL,\n  ops BIGINT NOT NULL,\n  PRIMARY KEY (cluster, member, ns, index_name, sampled_at)\n);\n" +
    insertSQL("indexes", iCols, iRows) + insertSQL("index_stats_samples", sCols, sRows);

  return {
    vars: {
      window_start: stamp(START),
      window_end: stamp(end),
      n_samples: nSamples,
      n_rows: sRows.length,
      restart_rule: level === 1
        ? "No member restarted during the window, so `since` never changes."
        : "A member that restarts starts counting again from zero: its later samples carry a new `since` (the restart time, after the previous sample) and an `ops` that counts only accesses since then.",
      cluster_rule: level === 3
        ? "Two clusters run the same application, so the same `ns` and `index_name` appear in both; an index is identified by `(cluster, ns, index_name)`."
        : "There is one cluster in this sample, but an index is still identified by `(cluster, ns, index_name)`.",
    },
    setup,
    tables: [
      { name: "indexes", columns: iCols, rows: iRows },
      { name: "index_stats_samples", columns: sCols, rows: sRows },
    ],
    expected: { columns: ["cluster", "ns", "index_name", "key_pattern", "size_mb"], rows: expected },
    diagnostics: diagnostics.filter((d) => JSON.stringify(d.rows) !== JSON.stringify(expected)),
  };
}

function cmp(a, b) {
  for (let i = 0; i < a.length; i++) { if (a[i] < b[i]) return -1; if (a[i] > b[i]) return 1; }
  return 0;
}

// The rules applied literally; opts break one rule at a time for the diagnostics.
function compute(all, samples, opts) {
  const used = new Set();
  const key = (x) => (opts.ignoreCluster ? "" : x.cluster) + "|" + x.ns + "|" + x.name;
  const series = new Map();
  for (const s of samples) {
    if (opts.primaryOnly && s.state !== "PRIMARY") continue;
    const k = s.cluster + "|" + s.member + "|" + s.ns + "|" + s.name;
    if (!series.has(k)) series.set(k, []);
    series.get(k).push(s);
  }
  for (const list of series.values()) {
    list.sort((a, b) => a.at - b.at);
    const u = key(list[0]);
    if (opts.anyOps) { if (list.some((s) => s.ops > 0)) used.add(u); continue; }
    if (opts.lastMinusFirst) { if (list[list.length - 1].ops - list[0].ops > 0) used.add(u); continue; }
    for (let i = 1; i < list.length; i++) {
      const d = list[i].since === list[i - 1].since ? list[i].ops - list[i - 1].ops : list[i].ops;
      if (d > 0) used.add(u);
    }
  }
  const out = [];
  for (const x of all) {
    if (x.unique && !opts.keepUnique) continue;
    if (x.ttl !== null && !opts.keepTtl) continue;
    if (!opts.keepNew && (opts.strictStart ? x.created > START : x.created >= START)) continue;
    if (used.has(key(x))) continue;
    out.push([x.cluster, x.ns, x.name, x.key, Math.floor((x.size * 20 + MB) / (2 * MB)) / 10]);
  }
  return out.sort((a, b) => cmp(a.slice(0, 3), b.slice(0, 3)));
}
