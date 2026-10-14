/* CFL-L1-01 — Consumer groups whose lag keeps growing (SQL).
   Simulated practice scenario. All data is generated from the seed; the collector,
   groups, topics and offsets are hypothetical.

   Contract: see docs/COMPANY-INTERVIEW-LOOPS.md § Executable templates (sql).
   level: 1 Medium (a committed-offset row for every consumed partition at every snapshot;
            lag = log end − committed; streaks of strictly growing total lag per group)
          2 Hard (+ a committed offset read after its log end, so raw lag is negative and
            must count as 0; groups that consume two topics; runs of exactly N and N − 1)
          3 Very Hard (+ rows only when the committed offset changed: carry the latest
            commit forward; a stalled partition has no rows while its lag grows; a
            partition and a whole group that start part-way through) */
import { insertSQL } from "../../js/rng.js";

export const kind = "sql";

const TOPICS = ["orders", "payments", "shipments", "inventory", "clickstream", "invoices"];
const GROUPS = ["billing-sink", "fraud-scorer", "search-indexer", "email-notifier", "warehouse-loader", "audit-archiver"];
const DAYS = ["2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08"];
const pad2 = (n) => String(n).padStart(2, "0");
const tsOf = (day, sec) => `${day} ${pad2(Math.floor(sec / 3600))}:${pad2(Math.floor((sec % 3600) / 60))}:${pad2(sec % 60)}+00`;

export function generate(r, level) {
  for (let attempt = 0; attempt < 60; attempt++) {
    const out = build(r, level);
    if (out) return out;
  }
  throw new Error("CFL-L1-01: could not build an instance");
}

function build(r, level) {
  const N = level === 1 ? 3 : r.int(3, 4);
  const nSnap = 12 + 2 * level;
  const day = r.pick(DAYS);
  const t0 = r.int(7, 15) * 3600 + r.pick([0, 15, 30, 45]) * 60;
  const step = r.pick([60, 120, 300]);
  let sid = r.int(100, 900);
  const snaps = [];
  for (let s = 0; s < nSnap; s++) {
    snaps.push({ id: sid, at: tsOf(day, t0 + s * step) });
    sid += r.int(1, 4);                               // ids increase but are not consecutive
  }

  const topics = r.sample(TOPICS, level === 1 ? 2 : 3).sort();
  const parts = {};                                   // topic -> partition count
  for (const t of topics) parts[t] = r.int(2, 3);
  const logEnd = {};                                  // "topic|p" -> [offset per snapshot]
  for (const t of topics) for (let p = 0; p < parts[t]; p++) {
    const xs = [r.int(100000, 900000)];
    for (let s = 1; s < nSnap; s++) xs.push(xs[s - 1] + r.int(200, 600));
    logEnd[t + "|" + p] = xs;
  }

  const nGroups = level === 1 ? 3 : 4;
  const groups = r.sample(GROUPS, nGroups).sort();
  const consumes = {};
  groups.forEach((g, i) => {
    if (level === 1) consumes[g] = [r.pick(topics)];
    else consumes[g] = i === 0 || r.chance(0.4) ? r.sample(topics, 2).sort() : [r.pick(topics)];
  });

  // A plan of "modes" per step, per group: grow, flat, drain, mix, stall.
  const plan = (forced) => {
    const modes = [];
    while (modes.length < nSnap - 1) {
      const m = r.pick(["grow", "flat", "drain", "drain", "mix", "stall"]);
      const len = m === "flat" ? 1 : r.int(1, N + 1);
      for (let k = 0; k < len; k++) modes.push(m);
    }
    if (forced) {
      const at = r.int(0, nSnap - 1 - forced.length);
      forced.forEach((m, k) => (modes[at + k] = m));
    }
    return modes.slice(0, nSnap - 1);
  };
  const forcedFor = (i) => {
    if (i === 0) return [...Array(N + r.int(0, 2)).fill("grow"), "drain"];                // a streak of at least N
    if (i === 1) return ["drain", ...Array(N - 1).fill("grow"), "flat", ...Array(2).fill("grow"), "drain"]; // N − 1, an equal step, more growth
    if (i === 2 && level >= 2) return ["flat", ...Array(N).fill("grow"), "drain"];        // exactly N
    return null;
  };

  // committed[g|t|p] = array per snapshot (null before the partition's first commit).
  const committed = {};
  const firstSnap = {};                               // group -> first snapshot index
  groups.forEach((g, gi) => {
    const modes = plan(forcedFor(gi));
    const gStart = level === 3 && gi === nGroups - 1 ? r.int(2, 4) : 0;
    firstSnap[g] = gStart;
    const keys = [];
    for (const t of consumes[g]) for (let p = 0; p < parts[t]; p++) keys.push(t + "|" + p);
    // Very Hard: one partition of the first group starts consuming later.
    const lateKey = level === 3 && gi === 0 ? r.pick(keys) : null;
    const lateAt = lateKey ? r.int(gStart + 2, nSnap - 3) : -1;
    for (const k of keys) {
      const le = logEnd[k];
      const start = k === lateKey ? lateAt : gStart;
      const arr = new Array(nSnap).fill(null);
      let lag = r.int(0, 3000);
      arr[start] = le[start] - lag;
      for (let s = start + 1; s < nSnap; s++) {
        const m = modes[s - 1];
        const inc = le[s] - le[s - 1];
        let d;
        if (m === "grow") d = k === keys[0] ? r.int(1, 150) : r.int(0, 150);
        else if (m === "flat") d = 0;
        else if (m === "drain") d = -r.int(0, Math.min(150, lag));
        else if (m === "stall") d = inc;                         // committed offset unchanged
        else d = r.int(-Math.min(150, lag), 150);
        lag = Math.max(0, lag + d);
        arr[s] = le[s] - lag;
      }
      committed[g + "|" + k] = arr;
    }
  });

  // Hard+: one committed offset read after its log end (raw lag negative).
  if (level >= 2) {
    const ks = Object.keys(committed);
    const k = r.pick(ks);
    const arr = committed[k];
    const cand = arr.map((v, s) => (v === null || s === 0 ? -1 : s)).filter((s) => s > 0);
    const s = r.pick(cand);
    const [, t, p] = k.split("|");
    arr[s] = logEnd[t + "|" + p][s] + r.int(1, 60);
  }

  // Rows the collector writes.
  const cRows = [];                                   // [snapshot_id, group, topic, partition, committed]
  for (const [k, arr] of Object.entries(committed)) {
    const [g, t, p] = k.split("|");
    let prev = null;
    for (let s = 0; s < nSnap; s++) {
      if (arr[s] === null) continue;
      if (level < 3 || prev === null || arr[s] !== prev) cRows.push([snaps[s].id, g, t, Number(p), arr[s]]);
      prev = arr[s];
    }
  }
  const rowAt = new Map(cRows.map((x) => [x[0] + "|" + x[1] + "|" + x[2] + "|" + x[3], x[4]]));

  const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
  const solve = (o = {}) => {
    const out = [];
    for (const g of groups) {
      const series = [];                              // {s, total}
      for (let s = 0; s < nSnap; s++) {
        let total = 0, any = false;
        for (const t of consumes[g]) for (let p = 0; p < parts[t]; p++) {
          // Latest committed offset at or before s (or only at s, when not carrying forward).
          let c = null;
          for (let q = s; q >= 0; q--) {
            const v = rowAt.get(snaps[q].id + "|" + g + "|" + t + "|" + p);
            if (v !== undefined) { c = v; break; }
            if (o.noCarry) break;
          }
          if (c === null) continue;
          any = true;
          const raw = logEnd[t + "|" + p][s] - c;
          total += o.noClamp ? raw : Math.max(0, raw);
        }
        if (any) series.push({ s, total });
      }
      let run = null;
      const close = () => {
        if (run && run.n >= (o.offByOne ? N - 1 : N)) out.push([g, snaps[run.from].at, snaps[run.to].at, run.n, run.lag0, run.lag1]);
        run = null;
      };
      for (let i = 1; i < series.length; i++) {
        const a = series[i - 1], b = series[i];
        const up = o.ge ? b.total >= a.total : b.total > a.total;
        if (up) {
          if (!run) run = { from: a.s, lag0: a.total, n: 0 };
          run.n++;
          run.to = b.s;
          run.lag1 = b.total;
        } else close();
      }
      close();
    }
    return out.sort((x, y) => cmp(x[0], y[0]) || cmp(x[1], y[1]));
  };
  const rows = solve();
  if (!rows.length) return null;

  const diagnostics = [
    { message: "An equal total was counted as growth. A streak needs each snapshot's total lag to be strictly greater than the previous one's.", rows: solve({ ge: true }) },
    { message: `Streaks were measured in snapshots, not increases. ${N} increases in a row span ${N + 1} snapshots.`, rows: solve({ offByOne: true }) },
  ];
  if (level >= 2) diagnostics.push({ message: "Negative lag was summed as it is. A committed offset read after its log-end offset means the partition is caught up: its lag is 0.", rows: solve({ noClamp: true }) });
  if (level === 3) diagnostics.push({ message: "Partitions without a row at a snapshot were dropped (an inner join on snapshot_id). A missing row means the committed offset did not change: carry the latest earlier commit forward.", rows: solve({ noCarry: true }) });

  const sCols = ["snapshot_id", "taken_at"];
  const sRows = snaps.map((x) => [x.id, x.at]);
  const lCols = ["snapshot_id", "topic", "partition_id", "log_end_offset"];
  const lRows = [];
  for (let s = 0; s < nSnap; s++) for (const t of topics) for (let p = 0; p < parts[t]; p++) lRows.push([snaps[s].id, t, p, logEnd[t + "|" + p][s]]);
  const cCols = ["snapshot_id", "group_id", "topic", "partition_id", "committed_offset"];
  cRows.sort((x, y) => x[0] - y[0] || cmp(x[1], y[1]) || cmp(x[2], y[2]) || x[3] - y[3]);
  const setup =
    "SET TIME ZONE 'UTC';\n" +
    "CREATE TABLE snapshots (\n  snapshot_id INT PRIMARY KEY,\n  taken_at TIMESTAMPTZ NOT NULL UNIQUE\n);\n" +
    "CREATE TABLE log_end_offsets (\n  snapshot_id INT NOT NULL REFERENCES snapshots(snapshot_id),\n  topic TEXT NOT NULL,\n  partition_id INT NOT NULL,\n  log_end_offset BIGINT NOT NULL,\n  PRIMARY KEY (snapshot_id, topic, partition_id)\n);\n" +
    "CREATE TABLE committed_offsets (\n  snapshot_id INT NOT NULL REFERENCES snapshots(snapshot_id),\n  group_id TEXT NOT NULL,\n  topic TEXT NOT NULL,\n  partition_id INT NOT NULL,\n  committed_offset BIGINT NOT NULL,\n  PRIMARY KEY (snapshot_id, group_id, topic, partition_id)\n);\n" +
    insertSQL("snapshots", sCols, sRows) + insertSQL("log_end_offsets", lCols, lRows) + insertSQL("committed_offsets", cCols, cRows);

  return {
    vars: {
      streak: N,
      snapshots: nSnap,
      interval: step === 60 ? "minute" : step / 60 + " minutes",
      groups: nGroups,
      clamp_rule: level === 1
        ? "In this sample every committed offset is at or below its partition's log-end offset."
        : "The collector reads the log-end offsets first and the committed offsets a moment later, so a committed offset can exceed the log-end offset of the same snapshot; that partition's lag is 0, never negative.",
      rows_rule: level === 3
        ? "The collector writes a `committed_offsets` row only at a partition's first commit and whenever its committed offset changed since the previous snapshot. A partition with no row at a snapshot still has its latest earlier committed offset. A partition counts toward its group from its first commit on, and a group's series starts at its first commit."
        : "Every snapshot has a `committed_offsets` row for every partition each group consumes.",
    },
    setup,
    tables: [
      { name: "snapshots", columns: sCols, rows: sRows },
      { name: "log_end_offsets", columns: lCols, rows: lRows },
      { name: "committed_offsets", columns: cCols, rows: cRows },
    ],
    expected: { columns: ["group_id", "streak_start", "streak_end", "increases", "lag_at_start", "lag_at_end"], rows },
    diagnostics: diagnostics.filter((d) => JSON.stringify(d.rows) !== JSON.stringify(rows)),
  };
}
