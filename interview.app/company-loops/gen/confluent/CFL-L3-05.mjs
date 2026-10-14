/* CFL-L3-05 — Cross-cluster replication lag: offset lag and time lag per mirrored partition,
   worst per link, topic and hour (SQL).
   Simulated practice scenario. All clusters, topics, offsets and times are generated from the
   seed and are hypothetical.

   Two samplers: one records each source partition's log-end offset, the other records the
   log-end offset of each partition on every link's destination cluster. Links keep offsets
   (a mirrored record has the same offset on both sides; this exercise's rule).
   For every destination sample (link, mirror topic, partition, t, m) that is a mirror of a
   source topic and has a source sample at or before t:
     offset_lag = max(L - m, 0), L = the source log-end offset of the latest source sample at
                  or before t (inclusive);
     time_lag_s = 0 when offset_lag = 0, else t minus the earliest source sample time whose
                  log-end offset is greater than m (the first sample that showed an offset the
                  mirror did not have yet).
   One row per (link_name, topic, hour of t): max offset lag, max time lag and worst_partition
   (the partition with the largest time lag, ties to the smaller partition; NULL when the
   hour's max time lag is 0), ordered by link_name, topic, hour_start.
   level: 1 Medium (one link, inclusive as-of, mirror ahead of a stale source sample, a mirror
                    sample before the first source sample, a destination sample exactly at a
                    source sample and exactly on an hour boundary)
          2 Hard (+ two links over the same source, ties for the worst partition, more topics)
          3 Very Hard (+ one link names mirror topics with a prefix, topic names containing
                       dots, a destination-local topic whose name matches a source topic only
                       if the prefix is ignored) */
import { insertSQL, ts } from "../../js/rng.js";

export const kind = "sql";

const M = 60, H = 3600;
const TOPICS = ["orders", "clickstream", "shipments", "user-profiles", "fraud-scores", "price-updates", "carts"];
const DOTTED = ["payments.v2", "inventory.events", "audit.log", "billing.invoices"];
const LINKS = ["analytics-mirror", "backup-link", "dr-west", "eu-replica", "reporting-link"];
const ALIASES = ["east", "primary", "central", "onprem"];

export function generate(r, level) {
  const BASE = Date.UTC(2026, 9, r.int(5, 9), r.int(6, 10)) / 1000;    // window start, on the hour
  const stamp = (sec) => {
    const d = new Date((BASE + sec) * 1000);
    return ts(d.toISOString().slice(0, 10), d.getUTCHours() * H + d.getUTCMinutes() * M + d.getUTCSeconds());
  };
  const END = 4 * H;

  // Links.
  const linkNames = r.sample(LINKS, level === 1 ? 1 : 2).sort();
  const alias = r.pick(ALIASES);
  const links = linkNames.map((name) => ({ name, prefix: "", topics: [] }));
  if (level === 3) r.pick(links).prefix = alias + ".";
  const plain = links.find((l) => l.prefix === "");

  // Topics: random-traffic topics plus one scripted edge topic.
  const nRandom = level === 1 ? 2 : 3;
  let rnd, edgeName;
  if (level === 3) {
    const pool = r.shuffle(TOPICS);
    const dotted = r.pick(DOTTED);
    rnd = [dotted, pool[0], pool[1]];
    edgeName = pool[2];
  } else {
    const pool = r.sample([...TOPICS, ...DOTTED], nRandom + 1);
    rnd = pool.slice(1);
    edgeName = pool[0];
  }
  if (level === 1) links[0].topics = rnd.slice();
  else if (level === 2) {
    links[0].topics = rnd.slice();
    links[1].topics = r.sample(rnd, 2);
  } else {
    const prefixed = links.find((l) => l.prefix !== "");
    plain.topics = [rnd[0], r.pick([rnd[1], rnd[2]])];               // the dotted topic is on the plain link
    prefixed.topics = r.sample(rnd, 2);
  }
  const edgeLink = r.pick(links);

  // Source partitions with a piecewise-constant produce rate.
  const makeLeo = () => {
    const base = r.int(1000, 4000000);
    const rates = [];
    for (let k = 0; k < 30; k++) rates.push(r.pick([0, 0, 1, 2, 3, 5, 8, 12]));
    return (t) => {
      let v = base, s = -1800;
      for (const rate of rates) {
        if (t <= s) break;
        v += rate * (Math.min(t, s + 600) - s);
        s += 600;
      }
      return v;
    };
  };
  const src = [];        // {topic, part, t, leo}
  const dst = [];        // {link, mtopic, part, t, m}
  const leoOf = new Map();
  const srcTopics = level === 3 ? [...rnd, "heartbeats"] : rnd;
  for (const topic of srcTopics) {
    const nPart = topic === "heartbeats" ? 1 : 2;
    let t = -(r.int(1, 15) * M + r.int(0, 59));
    const times = [];
    while (t < END) { times.push(t); t += r.int(18, 28) * M + r.int(0, 59); }
    for (let p = 0; p < nPart; p++) {
      const leo = makeLeo();
      leoOf.set(topic + "|" + p, leo);
      for (const tt of times) src.push({ topic, part: p, t: tt, leo: leo(tt) });
    }
  }
  let first = true;
  for (const l of links) {
    for (const topic of l.topics) {
      let t = first ? 0 : r.int(0, 10) * M + r.int(0, 59);          // the first series starts exactly on the hour
      first = false;
      const times = [];
      while (t < END) { times.push(t); t += r.int(16, 26) * M + r.int(0, 59); }
      for (let p = 0; p < 2; p++) {
        const leo = leoOf.get(topic + "|" + p);
        let prev = 0;
        for (const tt of times) {
          const d = r.pick(level === 1 ? [0, 120, 600, 900, 1500] : [0, 60, 300, 600, 900, 1500, 2400]);
          prev = Math.max(prev, leo(tt - d));
          dst.push({ link: l.name, mtopic: l.prefix + topic, part: p, t: tt, m: prev });
        }
      }
    }
  }
  if (level === 3) {
    // A topic local to the prefixed link's destination cluster that shares a name with a source topic.
    const pl = links.find((l) => l.prefix !== "");
    let t = r.int(1, 9) * M + r.int(0, 59), v = r.int(100, 5000);
    while (t < END) {
      dst.push({ link: pl.name, mtopic: "heartbeats", part: 0, t, m: v });
      v += r.int(20, 400);
      t += r.int(16, 26) * M + r.int(0, 59);
    }
  }

  // The scripted edge topic: one partition, mirrored by one link.
  {
    const mt = edgeLink.prefix + edgeName;
    const at = (h, lo, hi) => h * H + r.int(lo, hi) * M + r.int(0, 59);
    const a = r.int(5000, 900000), x1 = r.int(40, 400), y = r.int(5, 60), x2 = r.int(20, 300);
    const L3 = a + x1 + x2, z = r.int(3, 30), w = r.int(2, 30), x3 = z + w + r.int(10, 200), x4 = r.int(10, 300), x5 = r.int(5, 100);
    const s1 = at(1, 3, 8), s2 = at(1, 22, 28), s3 = at(1, 40, 47), s4 = at(2, 5, 12), s5 = at(2, 48, 55), s6 = at(3, 10, 20), s7 = at(3, 45, 55);
    for (const [t, leo] of [[s1, a], [s2, a + x1], [s3, L3], [s4, L3], [s5, L3 + x3], [s6, L3 + x3 + x4], [s7, L3 + x3 + x4 + x5]]) {
      src.push({ topic: edgeName, part: 0, t, leo });
    }
    const m0b = a - y - r.int(10, 140);
    for (const [t, m] of [
      [at(0, 10, 25), m0b - r.int(10, 200)],          // before the first source sample: not evaluated
      [at(0, 35, 55), m0b],
      [at(1, 12, 18), a - y],
      [s2, a - y],                                    // exactly at a source sample: as-of is inclusive
      [at(1, 50, 56), L3],                            // caught up
      [at(2, 25, 32), L3 + z],                        // ahead of the stale source sample: floored to 0
      [at(2, 36, 44), L3 + z + w],
      [at(3, 25, 35), L3 + z + w],                    // stuck: lag since the sample in the previous hour
    ]) dst.push({ link: edgeLink.name, mtopic: mt, part: 0, t, m });
  }

  // Source samples by partition, in time order.
  const byPart = new Map();
  for (const s of [...src].sort((a, b) => a.t - b.t)) {
    const k = s.topic + "|" + s.part;
    if (!byPart.has(k)) byPart.set(k, []);
    byPart.get(k).push(s);
  }
  const prefixOf = new Map(links.map((l) => [l.name, l.prefix]));

  // The oracle. opts break one rule each, for diagnostics.
  const compute = (opts = {}) => {
    const groups = new Map();
    for (const d of dst) {
      const prefix = prefixOf.get(d.link);
      let topic;
      if (opts.firstDot) { const i = d.mtopic.indexOf("."); topic = i >= 0 ? d.mtopic.slice(i + 1) : d.mtopic; }
      else if (opts.replace) topic = prefix ? d.mtopic.split(prefix).join("") : d.mtopic;
      else if (opts.noStrip) topic = d.mtopic;
      else topic = d.mtopic.startsWith(prefix) ? d.mtopic.slice(prefix.length) : null;
      if (topic === null) continue;
      const ss = byPart.get(topic + "|" + d.part) || [];
      let asof = null;
      for (const s of ss) {
        if (opts.latest || (opts.strict ? s.t < d.t : s.t <= d.t)) asof = s;
      }
      let off = 0, lag = 0;
      if (!asof) {
        if (!opts.unsourced) continue;
      } else {
        const raw = asof.leo - d.m;
        off = opts.noFloor ? raw : Math.max(raw, 0);
        if (raw > 0) {
          const f = ss.find((s) => s.leo > d.m);
          lag = d.t - f.t;
          if (opts.lastCaughtUp) {
            const le = ss.filter((s) => s.leo <= d.m);
            if (le.length) lag = d.t - le[le.length - 1].t;
          }
        }
      }
      const hour = Math.floor(d.t / H) * H;
      const key = d.link + "\u0000" + topic + "\u0000" + String(hour).padStart(8, "0");
      if (!groups.has(key)) groups.set(key, { link: d.link, topic, hour, items: [] });
      groups.get(key).items.push({ part: d.part, off, lag });
    }
    const out = [...groups.values()].map((g) => {
      const maxOff = Math.max(...g.items.map((x) => x.off));
      const maxLag = Math.max(...g.items.map((x) => x.lag));
      let worst = null;
      if (opts.worstByOffset) {
        if (maxOff > 0) worst = Math.min(...g.items.filter((x) => x.off === maxOff).map((x) => x.part));
      } else if (maxLag > 0 || opts.worstNotNull) {
        worst = Math.min(...g.items.filter((x) => x.lag === maxLag).map((x) => x.part));
      }
      return { g, row: [g.link, g.topic, stamp(g.hour), maxOff, maxLag, worst] };
    });
    out.sort((a, b) => (a.g.link < b.g.link ? -1 : a.g.link > b.g.link ? 1 : 0) ||
      (a.g.topic < b.g.topic ? -1 : a.g.topic > b.g.topic ? 1 : 0) || a.g.hour - b.g.hour);
    return out.map((x) => x.row);
  };
  const expected = compute();

  const diagnostics = [
    { message: "The as-of lookup was exclusive. A source sample taken at exactly the destination sample's time is the latest one at or before it, and its log-end offset is the one the lag is measured against.", rows: compute({ strict: true }) },
    { message: "Offset lag went negative. A destination sample can be ahead of the last source sample (the source was sampled earlier, then more records arrived and were mirrored); the lag is floored at 0 and the time lag is 0 there.", rows: compute({ noFloor: true }) },
    { message: "The lag was measured against the newest source sample, not the one in force at the destination sample's time. Join each destination sample to the latest source sample at or before its sampled_at (a LATERAL ... ORDER BY sampled_at DESC LIMIT 1, or a window).", rows: compute({ latest: true }) },
    { message: "Time lag was measured from the last source sample that the mirror had caught up to. The rule is the earliest source sample whose log-end offset is greater than the mirror's: the first time the source was seen holding an offset the mirror did not have.", rows: compute({ lastCaughtUp: true }) },
    { message: "Destination samples taken before any source sample of their partition were counted (as lag 0). With nothing to compare against there is no lag to report, so they are left out, and an hour with only such samples has no row.", rows: compute({ unsourced: true }) },
    { message: "worst_partition was chosen by offset lag. It is the partition with the largest time lag (ties to the smaller partition), because a busy partition can have the most records behind while another has been behind for longest.", rows: compute({ worstByOffset: true }) },
    { message: "worst_partition was filled in for an hour with no time lag. When the hour's max_time_lag_s is 0 nothing is behind, and worst_partition is NULL.", rows: compute({ worstNotNull: true }) },
  ];
  if (level === 3) {
    diagnostics.push(
      { message: "The source topic was taken as everything after the first dot. Topic names can contain dots (`" + rnd[0] + "` on the plain link), and the plain link has no prefix at all: strip exactly the link's topic_prefix from the start of the name.", rows: compute({ firstDot: true }) },
      { message: "The prefix was removed with replace() without checking that the name starts with it. A topic local to the destination cluster whose name does not carry the prefix is not a mirror, even when a source topic has the same name.", rows: compute({ replace: true }) },
      { message: "Destination topic names were joined to source topics as they are. The prefixed link's mirror topics are named topic_prefix followed by the source topic, so their samples matched nothing.", rows: compute({ noStrip: true }) },
    );
  }

  const lCols = ["link_name", "source_cluster", "destination_cluster", "topic_prefix"];
  const sCols = ["topic", "partition_id", "sampled_at", "log_end_offset"];
  const dCols = ["link_name", "mirror_topic", "partition_id", "sampled_at", "log_end_offset"];
  const srcCluster = alias + "-kafka";
  const lRows = links.map((l) => [l.name, srcCluster, l.name.split("-")[0] + "-cluster", l.prefix]);
  const sRows = [...src].sort((a, b) => a.t - b.t || (a.topic < b.topic ? -1 : a.topic > b.topic ? 1 : 0) || a.part - b.part)
    .map((s) => [s.topic, s.part, stamp(s.t), s.leo]);
  const dRows = [...dst].sort((a, b) => a.t - b.t || (a.link < b.link ? -1 : a.link > b.link ? 1 : 0) ||
    (a.mtopic < b.mtopic ? -1 : a.mtopic > b.mtopic ? 1 : 0) || a.part - b.part)
    .map((d) => [d.link, d.mtopic, d.part, stamp(d.t), d.m]);

  const setup =
    "SET TIME ZONE 'UTC';\n" +
    "CREATE TABLE mirror_links (\n  link_name TEXT PRIMARY KEY,\n  source_cluster TEXT NOT NULL,\n  destination_cluster TEXT NOT NULL,\n  topic_prefix TEXT NOT NULL\n);\n" +
    "CREATE TABLE source_offsets (\n  topic TEXT NOT NULL,\n  partition_id INT NOT NULL,\n  sampled_at TIMESTAMPTZ NOT NULL,\n  log_end_offset BIGINT NOT NULL,\n  PRIMARY KEY (topic, partition_id, sampled_at)\n);\n" +
    "CREATE TABLE mirror_offsets (\n  link_name TEXT NOT NULL REFERENCES mirror_links (link_name),\n  mirror_topic TEXT NOT NULL,\n  partition_id INT NOT NULL,\n  sampled_at TIMESTAMPTZ NOT NULL,\n  log_end_offset BIGINT NOT NULL,\n  PRIMARY KEY (link_name, mirror_topic, partition_id, sampled_at)\n);\n" +
    insertSQL("mirror_links", lCols, lRows) + insertSQL("source_offsets", sCols, sRows) + insertSQL("mirror_offsets", dCols, dRows);

  const quoted = (xs) => xs.map((x) => "`" + x + "`").join(" and ");
  return {
    vars: {
      window_start: stamp(0),
      window_end: stamp(END),
      source_rows: sRows.length,
      mirror_rows: dRows.length,
      links_rule: level === 1
        ? "One cluster link, " + quoted(linkNames) + ", mirrors some of the source cluster's topics to another cluster."
        : "Two cluster links, " + quoted(linkNames) + ", mirror topics from the same source cluster to two destination clusters; a topic can be mirrored by both, and each link is reported separately.",
      naming_rule: level === 3
        ? "Links can name mirror topics with a prefix: on a link whose `topic_prefix` is not empty, the mirror of source topic `orders` is named `" + alias + ".orders`. A destination topic is the mirror of source topic X only if its name is exactly the link's `topic_prefix` followed by X; the destination sampler also reports topics that are local to the destination cluster, and those are not mirrors. Topic names can contain dots."
        : "Every link here has an empty `topic_prefix`, so a mirror topic has the same name as its source topic.",
    },
    setup,
    tables: [
      { name: "mirror_links", columns: lCols, rows: lRows },
      { name: "source_offsets", columns: sCols, rows: sRows },
      { name: "mirror_offsets", columns: dCols, rows: dRows },
    ],
    expected: { columns: ["link_name", "topic", "hour_start", "max_offset_lag", "max_time_lag_s", "worst_partition"], rows: expected },
    diagnostics: diagnostics.filter((d) => JSON.stringify(d.rows) !== JSON.stringify(expected)),
  };
}
