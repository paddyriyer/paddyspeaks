/* CFL-L1-03 — Under-replicated minutes and time below min in-sync replicas (SQL).
   Simulated practice scenario. All data is generated from the seed; topics, replication
   settings and ISR changes are hypothetical.

   Contract: see docs/COMPANY-INTERVIEW-LOOPS.md § Executable templates (sql).
   level: 1 Medium (every partition has a row at the window start; intervals between changes;
            at most one partition per topic ever drops below min ISR)
          2 Hard (+ the state at the window start comes from the day before; rows after the
            window end; repeated sizes; below-min intervals of different partitions overlap:
            the topic's time is their union)
          3 Very Hard (+ replication settings differ per topic, including min ISR equal to the
            replication factor; a partition whose only row is from the day before; one below-min
            interval nested inside another, so merging by the previous row's end is wrong) */
import { insertSQL } from "../../js/rng.js";

export const kind = "sql";

const TOPICS = ["orders", "payments", "shipments", "inventory", "clickstream", "invoices", "audit-log"];
const DAYS = ["2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09"];
const pad2 = (n) => String(n).padStart(2, "0");
const DAY_MS = 86400000;
const tsAt = (baseMs, sec) => {
  const d = new Date(baseMs + sec * 1000);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())} ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}:${pad2(d.getUTCSeconds())}+00`;
};

export function generate(r, level) {
  for (let attempt = 0; attempt < 60; attempt++) {
    const out = build(r, level);
    if (out) return out;
  }
  throw new Error("CFL-L1-03: could not build an instance");
}

function build(r, level) {
  const day = r.pick(DAYS);
  const base = Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10)));
  const W = 86400;
  const topics = r.sample(TOPICS, level === 1 ? 2 : 3).sort();
  const SETTINGS = level === 3 ? [[3, 2], [2, 1], [4, 3], [3, 3], [4, 2]] : [[3, 2]];
  const cfg = {};
  if (level === 3) {
    const pickS = r.shuffle(SETTINGS);
    topics.forEach((t, i) => (cfg[t] = { rf: pickS[i][0], min: pickS[i][1] }));
    if (!topics.some((t) => cfg[t].rf === cfg[t].min)) cfg[topics[topics.length - 1]] = { rf: 3, min: 3 };
  } else for (const t of topics) cfg[t] = { rf: 3, min: 2 };

  const rows = [];                                     // [topic, partition, sec, size]
  const rnd = (lo, hi) => r.int(lo, hi);
  const usedSecs = new Map();
  const add = (t, p, sec, size) => {
    const key = t + "|" + p;
    if (!usedSecs.has(key)) usedSecs.set(key, new Set());
    if (usedSecs.get(key).has(sec)) return false;
    usedSecs.get(key).add(sec);
    rows.push([t, p, sec, size]);
    return true;
  };
  // A random incident timeline inside the window (before 72 000 s) for one partition.
  const timeline = (t, p, allowBelow) => {
    const { rf, min } = cfg[t];
    const n = rnd(0, 3);
    let at = rnd(600, 20000);
    for (let i = 0; i < n && at < 66000; i++) {
      const sz = allowBelow && min > 1 && r.chance(0.4) ? rnd(1, min - 1) : Math.max(1, rf - 1);
      add(t, p, at, sz);
      const back = Math.min(at + rnd(60, 5400), 71900);
      if (level >= 2 && r.chance(0.25)) add(t, p, back - rnd(10, 50), sz);   // a repeated size, no change
      add(t, p, back, rf);
      at = back + rnd(600, 20000);
    }
  };

  const nParts = {};
  topics.forEach((t, ti) => {
    nParts[t] = rnd(2, level === 1 ? 3 : 4);
    const { rf } = cfg[t];
    const belowPart = rnd(0, nParts[t] - 1);           // Medium: the only partition that may go below min
    for (let p = 0; p < nParts[t]; p++) {
      // State at the window start.
      const startSize = r.chance(0.2) ? Math.max(1, rf - 1) : rf;
      if (level === 1) add(t, p, 0, startSize);
      else {
        add(t, p, -rnd(600, 80000), startSize);
        if (r.chance(0.3)) add(t, p, -rnd(80001, 86000), rf);        // an older row too
      }
      timeline(t, p, level >= 2 || p === belowPart);
      if (level >= 2 && r.chance(0.3)) add(t, p, W + rnd(0, 7200), Math.max(1, rf - 1));   // after the window
    }
    // Hard+: a change exactly at the window end (it belongs to the next day).
    if (level >= 2 && ti === 0) { add(t, 0, W, Math.max(1, rf - 1)); add(t, 0, W + rnd(7201, 9000), rf); }
  });

  // Hard+: two partitions of one topic overlap below min; Very Hard: one nested inside another.
  const belowTopics = topics.filter((t) => cfg[t].min > 1 && cfg[t].rf - 1 >= cfg[t].min);
  if (level >= 2 && belowTopics.length) {
    const t = r.pick(belowTopics);
    const { rf, min } = cfg[t];
    // Late in the day, after every random incident has recovered.
    const a = rnd(75000, 77000);
    const below = rnd(1, min - 1);
    if (level === 2) {
      // [a, a+L0) and [a+d, a+d+L1) overlap.
      const L0 = rnd(300, 1500), d = rnd(60, L0 - 60), L1 = rnd(300, 1500);
      add(t, 0, a, below); add(t, 0, a + L0, rf);
      add(t, 1, a + d, below); add(t, 1, a + d + L1, rf);
    } else {
      // [a, f) long; [b, c) nested inside; [e, g) starts after c and before f, ends after f.
      const b = a + rnd(60, 300), c = b + rnd(60, 300), e = c + rnd(60, 300), f = e + rnd(120, 600), g = f + rnd(60, 600);
      add(t, 0, a, below); add(t, 0, f, rf);
      add(t, 1, b, below); add(t, 1, c, rf);
      if (nParts[t] >= 3) { add(t, 2, e, below); add(t, 2, g, rf); }
      else { add(t, 1, e, below); add(t, 1, g, rf); }
    }
  }
  // Very Hard: a partition whose only row is from the day before, under-replicated all day.
  if (level === 3) {
    const t = r.pick(topics.filter((x) => cfg[x].rf > 1));
    const p = nParts[t]++;
    add(t, p, -rnd(3600, 40000), Math.max(1, cfg[t].rf - 1));
  }

  // The oracle.
  const cmp = (x, y) => (x < y ? -1 : x > y ? 1 : 0);
  const solve = (o = {}) => {
    const out = [];
    for (const t of topics) {
      const { rf, min } = cfg[t];
      let urp = 0, urpParts = 0;
      const below = [];
      for (let p = 0; p < nParts[t]; p++) {
        const rs = rows.filter((x) => x[0] === t && x[1] === p).sort((x, y) => x[2] - y[2]);
        let partUrp = 0, spans = 0;
        rs.forEach((x, i) => {
          const next = i + 1 < rs.length ? rs[i + 1][2] : Infinity;
          const s = Math.max(x[2], 0);
          if (o.noCarryIn && x[2] < 0) return;
          const e = o.noClip ? (next === Infinity ? W : next) : Math.min(next, W);
          if (e <= s) return;
          if (x[3] < rf) { partUrp += e - s; spans++; }
          if (o.belowLe ? x[3] <= min : x[3] < min) below.push([s, e]);
        });
        urp += partUrp;
        if (partUrp > 0) urpParts += o.countSpans ? spans : 1;
      }
      if (urp === 0) continue;
      below.sort((x, y) => x[0] - y[0] || x[1] - y[1]);
      let tot = 0;
      if (o.sum) for (const [s, e] of below) tot += e - s;
      else {
        // Merge overlapping or touching intervals: compare with the largest end so far
        // (or, for the diagnostic, with the previous interval's end only).
        let cs = null, ce = null, pe = null;
        for (const [s, e] of below) {
          if (cs === null || s > (o.prevEnd ? pe : ce)) {
            if (cs !== null) tot += ce - cs;
            cs = s; ce = e;
          } else ce = Math.max(ce, e);
          pe = e;
        }
        if (cs !== null) tot += ce - cs;
      }
      const mins = (sec) => Math.floor((sec * 200 + 60) / 120) / 100;
      out.push([t, urpParts, mins(urp), mins(tot)]);
    }
    return out.sort((x, y) => cmp(x[0], y[0]));
  };
  const expected = solve();
  if (!expected.length || !expected.some((x) => x[3] > 0)) return null;

  const diagnostics = [
    { message: "isr_size equal to min_insync_replicas was counted as below the minimum. At exactly the minimum, writes that need every in-sync replica still succeed.", rows: solve({ belowLe: true }) },
  ];
  diagnostics.push({ message: "under_replicated_partitions counted under-replicated intervals, not partitions. A partition that was under-replicated twice is one partition (COUNT(DISTINCT partition_id)).", rows: solve({ countSpans: true }) });
  if (level >= 2) {
    diagnostics.push({ message: "Below-min time was summed across partitions. The topic is below the minimum while at least one partition is: take the union of the intervals.", rows: solve({ sum: true }) });
    diagnostics.push({ message: "The state at the window start was ignored. A partition's last change before the window still holds until its next change.", rows: solve({ noCarryIn: true }) });
    diagnostics.push({ message: "Intervals were not clipped to the window end. Time after the window does not count, and a change at exactly the window end belongs to the next day.", rows: solve({ noClip: true }) });
  }
  if (level === 3) diagnostics.push({ message: "Intervals were merged by comparing with the previous interval's end only. A nested interval ends early; compare with the largest end so far.", rows: solve({ prevEnd: true }) });

  const tCols = ["topic", "replication_factor", "min_insync_replicas"];
  const tRows = topics.map((t) => [t, cfg[t].rf, cfg[t].min]);
  const cCols = ["topic", "partition_id", "changed_at", "isr_size"];
  const cRows = rows.slice().sort((x, y) => x[2] - y[2] || cmp(x[0], y[0]) || x[1] - y[1]).map(([t, p, sec, sz]) => [t, p, tsAt(base, sec), sz]);
  const setup =
    "SET TIME ZONE 'UTC';\n" +
    "CREATE TABLE topics (\n  topic TEXT PRIMARY KEY,\n  replication_factor INT NOT NULL,\n  min_insync_replicas INT NOT NULL CHECK (min_insync_replicas <= replication_factor)\n);\n" +
    "CREATE TABLE isr_changes (\n  topic TEXT NOT NULL REFERENCES topics(topic),\n  partition_id INT NOT NULL,\n  changed_at TIMESTAMPTZ NOT NULL,\n  isr_size INT NOT NULL,\n  PRIMARY KEY (topic, partition_id, changed_at)\n);\n" +
    insertSQL("topics", tCols, tRows) + insertSQL("isr_changes", cCols, cRows);

  return {
    vars: {
      window_start: tsAt(base, 0),
      window_end: tsAt(base, W),
      day,
      changes: cRows.length,
      start_rule: level === 1
        ? `Every partition has a row exactly at the window start (\`${tsAt(base, 0)}\`), so its state there is known; every change is inside the window.`
        : "A partition's state at the window start is its latest change before it, which may be from the previous day; rows at or after the window end belong to the next day.",
      settings_rule: level === 3
        ? "Replication settings differ by topic; `min_insync_replicas` can equal `replication_factor`."
        : "Every topic here has `replication_factor` 3 and `min_insync_replicas` 2.",
    },
    setup,
    tables: [
      { name: "topics", columns: tCols, rows: tRows },
      { name: "isr_changes", columns: cCols, rows: cRows },
    ],
    expected: { columns: ["topic", "under_replicated_partitions", "urp_partition_minutes", "below_min_isr_minutes"], rows: expected },
    diagnostics: diagnostics.filter((d) => JSON.stringify(d.rows) !== JSON.stringify(expected)),
  };
}
