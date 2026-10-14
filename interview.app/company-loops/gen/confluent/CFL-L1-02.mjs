/* CFL-L1-02 — Hot partitions: topic-hours where one partition takes far more than its share (SQL).
   Simulated practice scenario. All data is generated from the seed; topics, partition counts
   and byte volumes are hypothetical.

   Contract: see docs/COMPANY-INTERVIEW-LOOPS.md § Executable templates (sql).
   level: 1 Medium (every partition reports every sample; mean over the topic's partitions;
            a minimum-traffic floor)
          2 Hard (+ idle partitions with no rows still count in the mean; a ratio exactly k;
            a topic-hour exactly at the floor; two partitions tied for busiest)
          3 Very Hard (+ partitions added during the day: an hour uses the count in force at its
            end; a change exactly on an hour boundary; samples delivered twice) */
import { insertSQL } from "../../js/rng.js";

export const kind = "sql";

const TOPICS = ["orders", "payments", "shipments", "inventory", "clickstream", "invoices", "telemetry"];
const DAYS = ["2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08"];
const pad2 = (n) => String(n).padStart(2, "0");
const tsOf = (day, sec) => `${day} ${pad2(Math.floor(sec / 3600))}:${pad2(Math.floor((sec % 3600) / 60))}:${pad2(sec % 60)}+00`;

export function generate(r, level) {
  for (let attempt = 0; attempt < 60; attempt++) {
    const out = build(r, level);
    if (out) return out;
  }
  throw new Error("CFL-L1-02: could not build an instance");
}

function build(r, level) {
  const day = r.pick(DAYS);
  const k2 = r.pick([4, 5, 6]);                       // 2k: k is 2, 2.5 or 3
  const k = k2 / 2;
  const minBytes = r.pick([40, 50, 60]) * 1_000_000;
  const nHours = level === 1 ? 3 : 4;
  const h0 = r.int(6, 16);
  const SAMPLE = 1200;                                // a sample every 20 minutes
  const topics = r.sample(TOPICS, level === 1 ? 2 : 3).sort();

  // Partition counts: history per topic [{at (sec of day), count}].
  const counts = {};
  topics.forEach((t, i) => {
    const c = level >= 2 && i === 0 ? r.int(7, 8) : r.int(4, 6);
    counts[t] = [{ at: -86400 * 30, count: c }];
  });
  let midHour = null, edgeHour = null;
  if (level === 3) {
    const [ta, tb] = r.sample(topics, 2);
    midHour = { topic: ta, h: r.int(1, nHours - 1) };
    const addA = r.int(2, 4);
    counts[ta].push({ at: (h0 + midHour.h) * 3600 + r.pick([10, 25, 35]) * 60, count: counts[ta][0].count + addA });
    edgeHour = { topic: tb, h: r.int(1, nHours - 1) };
    counts[tb].push({ at: (h0 + edgeHour.h) * 3600, count: counts[tb][0].count + r.int(2, 3) });
  }
  const countAt = (t, sec, strict) => {               // latest change before (strict) or at sec
    let c = null;
    for (const x of counts[t]) if (strict ? x.at < sec : x.at <= sec) c = x.count;
    return c;
  };

  // Scenario per topic-hour.
  const bag = level === 1
    ? ["skewed", "balanced", "low", "skewed", "balanced", "skewed"]
    : ["boundary", "floor", "tie", "idle", "skewed", "balanced", "low", "skewed", "balanced", "skewed", "low", "skewed"];
  const order = r.shuffle(bag);
  let bi = 0;
  const hourly = {};                                  // "t|h" -> per-partition totals
  const vary = (u) => Math.max(1, Math.round(u * (0.8 + 0.4 * r.next())));
  const make = (scen, c) => {
    const H = new Array(c).fill(0);
    const hot = r.int(0, c - 1);
    const others = [...Array(c).keys()].filter((p) => p !== hot);
    if (scen === "balanced") {
      const u = Math.ceil((minBytes * (1.2 + r.next())) / c);
      for (let p = 0; p < c; p++) H[p] = vary(u);
      return H;
    }
    if (scen === "boundary") {                        // busiest * c == k * total exactly
      let m = Math.ceil((minBytes * (1.1 + r.next())) / c);
      m += m % 2;
      const B = k * m, O = (c - k) * m;
      H[hot] = B;
      let left = O;
      others.forEach((p, i) => {
        const v = i === others.length - 1 ? left : Math.round((O / others.length) * (0.85 + 0.3 * r.next()));
        H[p] = v;
        left -= v;
      });
      if (others.some((p) => H[p] <= 0 || H[p] >= B)) return null;
      return H;
    }
    if (scen === "floor") {                           // total exactly the floor, clearly skewed
      const rho = k + 0.4 + r.next();
      const B = Math.round((minBytes * rho) / c);
      H[hot] = B;
      let left = minBytes - B;
      const per = left / others.length;
      others.forEach((p, i) => {
        const v = i === others.length - 1 ? left : Math.round(per * (0.85 + 0.3 * r.next()));
        H[p] = v;
        left -= v;
      });
      if (others.some((p) => H[p] <= 0 || H[p] >= B)) return null;
      return H;
    }
    if (scen === "tie") {                             // two partitions tied for busiest
      if (c <= 2 * k) return null;
      const [h1, h2] = r.sample([...Array(c).keys()], 2);
      const rest = [...Array(c).keys()].filter((p) => p !== h1 && p !== h2);
      const u = Math.ceil(minBytes / (4 * c));
      for (const p of rest) H[p] = vary(u);
      const O = rest.reduce((s, p) => s + H[p], 0);
      let B = Math.ceil((k * O * (1.3 + r.next())) / (c - 2 * k));
      while (2 * B + O < minBytes) B *= 2;
      H[h1] = H[h2] = B;
      return H;
    }
    if (scen === "idle") {                            // skewed only when idle partitions count
      const zMax = c - Math.ceil(k) - 1;
      if (zMax < 2) return null;
      const z = r.int(2, zMax);
      const idle = new Set(r.sample(others, z));
      const live = others.filter((p) => !idle.has(p));
      const f = 1 - z / c + 0.03 + (0.94 - (1 - z / c + 0.03)) * r.next();
      const rho = (k * c * f) / (c - z);              // ratio over all c partitions; k*f over the live ones
      let u = Math.ceil(minBytes / c);
      for (;;) {
        for (const p of live) H[p] = vary(u);
        const O = live.reduce((s, p) => s + H[p], 0);
        H[hot] = Math.round((rho * O) / (c - rho));
        if (H[hot] + O >= minBytes * 1.05) break;
        u *= 2;
      }
      return H;
    }
    // skewed (above the floor) or low (below it)
    const rho = Math.min(k + 0.3 + 2 * r.next(), c - 0.6);
    let u = Math.ceil((minBytes * (scen === "low" ? 0.3 + 0.4 * r.next() : 1.2 + r.next())) / (2 * c));
    for (const p of others) H[p] = vary(u);
    const O = others.reduce((s, p) => s + H[p], 0);
    H[hot] = Math.round((rho * O) / (c - rho));
    const T = H[hot] + O;
    if (scen === "low" ? T >= minBytes : T < minBytes) return null;
    return H;
  };
  for (const t of topics) for (let h = 0; h < nHours; h++) {
    const c = countAt(t, (h0 + h + 1) * 3600, true);
    let H = null;
    for (let tries = 0; !H && tries < 6; tries++) {
      const forced = midHour && t === midHour.topic && h === midHour.h;   // the hour a partition was added is reported
      const scen = tries < 3 && !forced ? order[bi % order.length] : "skewed";
      H = make(scen, c);
      if (H) bi++;
      else if (tries === 2) bi++;
    }
    if (!H) return null;
    hourly[t + "|" + h] = H;
  }

  // Split each partition-hour into 20-minute samples (partitions added mid-hour report from then on).
  const samples = [];                                  // [topic, partition, sec, bytes]
  for (const t of topics) for (let h = 0; h < nHours; h++) {
    const H = hourly[t + "|" + h];
    const start = (h0 + h) * 3600;
    H.forEach((total, p) => {
      if (total === 0) {
        if (level === 1) throw new Error("idle partition at Medium");
        return;
      }
      const slots = [0, 1, 2].map((q) => start + q * SAMPLE).filter((sec) => sec >= addedAt(t, p));
      const w = slots.map(() => 1 + r.int(0, 9));
      const W = w.reduce((a, b) => a + b, 0);
      let left = total;
      slots.forEach((sec, i) => {
        const v = i === slots.length - 1 ? left : Math.floor((total * w[i]) / W);
        left -= v;
        if (v > 0) samples.push([t, p, sec, v]);
      });
    });
  }
  function addedAt(t, p) {                            // when partition p of topic t was created
    for (const x of counts[t]) if (x.count > p) return x.at;
    return Infinity;
  }
  // Very Hard: a few samples delivered twice.
  const rowsOut = samples.slice();
  if (level === 3) for (const s of r.sample(samples, 4)) rowsOut.push(s.slice());

  const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
  const solve = (o = {}) => {
    const src = o.dupes ? rowsOut : samples;
    const per = new Map();                            // "t|h" -> Map(p -> bytes), plus sample rows
    for (const [t, p, sec, v] of src) {
      const h = Math.floor(sec / 3600) - h0;
      const key = t + "|" + h;
      if (!per.has(key)) per.set(key, { t, h, parts: new Map(), rows: 0 });
      const e = per.get(key);
      e.parts.set(p, (e.parts.get(p) || 0) + v);
      e.rows++;
    }
    const out = [];
    for (const e of per.values()) {
      let total = 0, best = -1, bp = -1;
      for (const [p, v] of e.parts) {
        total += v;
        if (v > best || (v === best && (o.tieHigh ? p > bp : p < bp))) { best = v; bp = p; }
      }
      const endSec = (h0 + e.h + 1) * 3600;
      let c = o.startCount ? countAt(e.t, (h0 + e.h) * 3600, false) : countAt(e.t, endSec, true);
      if (o.liveOnly) c = e.parts.size;
      if (o.perSample) c = e.rows;
      if (o.noFloor ? false : o.strictFloor ? total <= minBytes : total < minBytes) continue;
      const lhs = 2 * best * c, rhs = k2 * total;
      if (o.ge ? lhs < rhs : lhs <= rhs) continue;
      const mean = Math.floor((total * 200 + c) / (2 * c)) / 100;
      const ratio = Math.floor((best * c * 2000 + total) / (2 * total)) / 1000;
      out.push([e.t, tsOf(day, (h0 + e.h) * 3600), bp, best, mean, ratio]);
    }
    return out.sort((x, y) => cmp(x[0], y[0]) || cmp(x[1], y[1]));
  };
  const rows = solve();
  if (!rows.length) return null;

  const diagnostics = [
    { message: "The minimum-traffic floor was not applied. A topic-hour below min_bytes is never reported, however skewed.", rows: solve({ noFloor: true }) },
    { message: "The mean was taken over sample rows, not over partitions. Sum each partition's samples for the hour first; the mean is the topic-hour total over the number of partitions.", rows: solve({ perSample: true }) },
  ];
  if (level >= 2) {
    diagnostics.push({ message: "The mean divided by the partitions that had traffic. An idle partition has no rows but is still one of the topic's partitions (count it from partition_count_changes).", rows: solve({ liveOnly: true }) });
    diagnostics.push({ message: "A ratio exactly k was reported. The busiest partition must exceed k times the mean.", rows: solve({ ge: true }) });
    diagnostics.push({ message: "A topic-hour exactly at the floor was dropped. The floor is inclusive: total >= min_bytes.", rows: solve({ strictFloor: true }) });
    diagnostics.push({ message: "Tied busiest partitions were broken the wrong way. The lower partition_id is reported.", rows: solve({ tieHigh: true }) });
  }
  if (level === 3) {
    diagnostics.push({ message: "The partition count was taken at the start of the hour. Use the count in force at the end of the hour (partitions added during the hour count for the whole hour).", rows: solve({ startCount: true }) });
    diagnostics.push({ message: "Samples delivered twice were counted twice. Count each (topic, partition_id, sample_ts) once.", rows: solve({ dupes: true }) });
  }

  const pcCols = ["topic", "effective_at", "partition_count"];
  const pcRows = [];
  for (const t of topics) for (const x of counts[t]) pcRows.push([t, x.at < 0 ? "2026-09-01 00:00:00+00" : tsOf(day, x.at), x.count]);
  const sCols = ["topic", "partition_id", "sample_ts", "bytes_in"];
  const sRows = rowsOut.map(([t, p, sec, v]) => [t, p, tsOf(day, sec), v]);
  sRows.sort((x, y) => cmp(x[2], y[2]) || cmp(x[0], y[0]) || x[1] - y[1]);
  const setup =
    "SET TIME ZONE 'UTC';\n" +
    "CREATE TABLE partition_count_changes (\n  topic TEXT NOT NULL,\n  effective_at TIMESTAMPTZ NOT NULL,\n  partition_count INT NOT NULL,\n  PRIMARY KEY (topic, effective_at)\n);\n" +
    "CREATE TABLE bytes_in_samples (\n  topic TEXT NOT NULL,\n  partition_id INT NOT NULL,\n  sample_ts TIMESTAMPTZ NOT NULL,\n  bytes_in BIGINT NOT NULL\n);\n" +
    insertSQL("partition_count_changes", pcCols, pcRows) + insertSQL("bytes_in_samples", sCols, sRows);

  return {
    vars: {
      k: k,
      min_bytes: minBytes,
      min_mb: minBytes / 1_000_000,
      samples: sRows.length,
      idle_rule: level === 1
        ? "In this sample every partition has at least one sample in every hour."
        : "A partition with no traffic in an hour has no rows at all, but it is still one of the topic's partitions.",
      count_rule: level === 3
        ? "Partitions can be added during the day (never removed). A topic-hour uses the count in force at the end of the hour: the latest change with `effective_at` before the next hour starts, so partitions added during the hour count for the whole hour. The collector can deliver a sample twice; the copies are identical and count once."
        : "No topic changes its partition count during this sample, and each (topic, partition_id, sample_ts) appears once.",
    },
    setup,
    tables: [
      { name: "partition_count_changes", columns: pcCols, rows: pcRows },
      { name: "bytes_in_samples", columns: sCols, rows: sRows },
    ],
    expected: { columns: ["topic", "hour_start", "busiest_partition", "busiest_bytes", "mean_bytes", "skew_ratio"], rows },
    diagnostics: diagnostics.filter((d) => JSON.stringify(d.rows) !== JSON.stringify(rows)),
  };
}
