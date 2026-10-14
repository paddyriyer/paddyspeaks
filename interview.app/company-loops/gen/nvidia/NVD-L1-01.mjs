/* NVD-L1-01 — Error counter deltas: daily increase of a cumulative counter that resets on driver reload (SQL).
   Simulated practice scenario. All data is generated from the seed. The counter, its reset
   behaviour and the thresholds are a hypothetical model stated in the problem, not the
   specification of any product.

   Contract: see docs/COMPANY-INTERVIEW-LOOPS.md § Executable templates (sql).
   level: 1 Medium (resets are visible as drops; increases attributed to the later reading's date)
          2 Hard (+ failed reads stored as NULL, sample_id not in time order, readings either side of midnight)
          3 Very Hard (+ a reload after which the counter climbs past its old value: only driver_load_id shows it) */
import { insertSQL, ts } from "../../js/rng.js";

export const kind = "sql";

const NODES = ["node-a01", "node-a02", "node-a07", "node-b03", "node-b11", "node-c04", "node-c09"];
const DAYS = ["2026-09-21", "2026-09-22"];
const HEX = "0123456789abcdef".split("");

export function generate(r, level) {
  const nodes = r.sample(NODES, level === 1 ? 3 : 4).sort();
  const threshold = r.pick(level === 1 ? [20, 25, 30] : [25, 30, 40, 50]);
  const minGpus = level === 1 ? 1 : r.pick([1, 2, 2]);
  const gpus = [];                     // {uuid, node, rows: [{day, sec, delta}]}
  const usedUuid = new Set();
  for (const node of nodes) {
    const n = r.int(level === 3 ? 3 : 2, level === 1 ? 3 : 4);
    for (let k = 0; k < n; k++) {
      let u;
      do u = "GPU-" + Array.from({ length: 6 }, () => r.pick(HEX)).join(""); while (usedUuid.has(u));
      usedUuid.add(u);
      gpus.push({ uuid: u, node, rows: [] });
    }
  }
  // Reading times: a few per day; Hard+ often a reading just before and just after midnight.
  for (const g of gpus) {
    const secs = new Set();
    const list = [];
    for (let d = 0; d < DAYS.length; d++) {
      const want = r.int(3, level === 1 ? 4 : 5);
      const mine = new Set();
      if (d === 0) mine.add(r.int(300, 3000));                      // the baseline reading, early on day 1
      if (level >= 2 && r.chance(0.5)) mine.add(d === 0 ? r.int(86100, 86399) : r.int(0, 300));
      while (mine.size < want) mine.add(r.int(3600, 85000));
      for (const s of mine) if (!secs.has(d + ":" + s)) { secs.add(d + ":" + s); list.push({ d, sec: s }); }
    }
    list.sort((a, b) => a.d - b.d || a.sec - b.sec);
    const noisy = r.chance(0.35);                                   // some GPUs log errors steadily
    g.rows = list.map((x) => ({ day: DAYS[x.d], d: x.d, sec: x.sec, delta: noisy ? r.int(3, 13) : r.chance(0.12) ? r.int(5, 14) : r.int(0, 3) }));
  }
  // Force a node-day with minGpus flagged GPUs, one of them exactly at the threshold.
  const fNode = r.pick(nodes);                                       // every node has at least 2 GPUs
  const fDay = r.int(0, 1);
  const onNode = r.shuffle(gpus.filter((g) => g.node === fNode));
  const targets = onNode.slice(0, Math.max(minGpus, 1));
  targets.forEach((g, i) => {
    const total = i === 0 ? threshold : threshold + r.int(0, 15);
    const idx = g.rows.map((x, j) => j).filter((j) => j > 0 && g.rows[j].d === fDay);
    let left = total;
    idx.forEach((j, q) => {
      const v = q === idx.length - 1 ? left : r.int(0, left);
      g.rows[j].delta = v;
      left -= v;
    });
  });
  // Very Hard: another GPU on the same node is reloaded on that day and its counter climbs past
  // the old value before the next reading. Only driver_load_id shows the reset.
  let hidden = null, hiddenJ = -1;
  if (level === 3) {
    hidden = r.pick(gpus.filter((g) => g.node === fNode && !targets.includes(g)));
    hiddenJ = hidden.rows.findIndex((x, j) => j > 0 && x.d === fDay);
    for (const x of hidden.rows) if (x.d === fDay) x.delta = r.int(0, 1);
  }
  // Turn deltas into cumulative readings with resets.
  for (const g of gpus) {
    let v = r.int(60, 900);
    let load = r.int(1, 9);
    g.rows[0].v = v;
    g.rows[0].load = load;
    const forcedReset = g === targets[0] ? g.rows.findIndex((x, j) => j > 0 && x.d === fDay) : -1;
    for (let j = 1; j < g.rows.length; j++) {
      const row = g.rows[j];
      let reset = (r.chance(0.1) && g !== hidden) || j === forcedReset;
      if (g === hidden && j === hiddenJ) {
        reset = true;
        row.delta = v + r.int(0, 3);                                  // the new value is not below the old one
      }
      if (reset && level < 3 && row.delta >= v) reset = false;        // below Very Hard every reset is a visible drop
      if (reset) { v = row.delta; load += 1; } else v += row.delta;
      row.v = v;
      row.load = load;
    }
  }
  // All readings, plus (Hard+) failed reads stored as NULL.
  const all = [];
  for (const g of gpus) {
    for (const x of g.rows) all.push({ g, day: x.day, d: x.d, sec: x.sec, v: x.v, load: x.load });
    if (level >= 2 && r.chance(0.6)) {
      const taken = new Set(g.rows.map((x) => x.d + ":" + x.sec));
      for (let k = r.int(1, 2); k > 0; k--) {
        let d, s;
        do { d = r.int(0, 1); s = r.int(0, 86399); } while (taken.has(d + ":" + s));
        taken.add(d + ":" + s);
        // the load id the GPU had at that time
        const before = g.rows.filter((x) => x.d < d || (x.d === d && x.sec < s));
        const load = before.length ? before[before.length - 1].load : g.rows[0].load;
        all.push({ g, day: DAYS[d], d, sec: s, v: null, load });
      }
    }
  }
  all.sort((a, b) => a.d - b.d || a.sec - b.sec || (a.g.uuid < b.g.uuid ? -1 : 1));
  const order = level === 1 ? all : r.shuffle(all);                  // Hard+: sample_id is not time order
  let sid = 500000 + r.int(0, 90000);
  for (const x of order) x.id = (sid += r.int(1, 7));

  const cmp = (x, y) => (x < y ? -1 : x > y ? 1 : 0);
  const solve = (o = {}) => {
    const totals = new Map();          // day|node|gpu -> increase
    for (const g of gpus) {
      let rows = all.filter((x) => x.g === g);
      rows = o.bySampleId ? rows.sort((a, b) => a.id - b.id) : rows.sort((a, b) => a.d - b.d || a.sec - b.sec);
      if (!o.keepNull) rows = rows.filter((x) => x.v !== null);
      for (let j = 1; j < rows.length; j++) {
        const p = rows[j - 1], c = rows[j];
        if (p.v === null || c.v === null) continue;
        const reset = o.dropOnly ? c.v < p.v : c.load !== p.load;
        let inc;
        if (o.raw) inc = c.v - p.v;
        else if (reset) inc = o.resetZero ? 0 : c.v;
        else inc = c.v - p.v;
        const day = o.earlierDay ? p.day : c.day;
        const k = day + "|" + g.node + "|" + g.uuid;
        totals.set(k, (totals.get(k) || 0) + inc);
      }
    }
    const per = new Map();
    for (const [k, inc] of totals) {
      if (o.strict ? inc <= threshold : inc < threshold) continue;
      const [day, node, uuid] = k.split("|");
      const nk = day + "|" + node;
      if (!per.has(nk)) per.set(nk, []);
      per.get(nk).push([uuid, inc]);
    }
    const rows = [];
    for (const [nk, list] of per) {
      if (list.length < minGpus) continue;
      list.sort((a, b) => b[1] - a[1] || cmp(a[0], b[0]));
      const [day, node] = nk.split("|");
      rows.push([day, node, list.length, list[0][0], list[0][1]]);
    }
    return rows.sort((a, b) => cmp(a[0], b[0]) || cmp(a[1], b[1]));
  };
  const rows = solve();

  const diagnostics = [
    { message: "A reset was counted as zero increase. After a driver reload the counter restarts from 0, so the new reading itself is the increase since the reload.", rows: solve({ resetZero: true }) },
    { message: "The raw difference was summed, so a reset produced a negative increase. A reset's increase is the new reading.", rows: solve({ raw: true }) },
    { message: "Increases were attributed to the date of the earlier reading. An increase belongs to the UTC date of the later reading.", rows: solve({ earlierDay: true }) },
    { message: "A GPU exactly at the threshold was left out. The threshold is inclusive (increase >= threshold).", rows: solve({ strict: true }) },
  ];
  if (level >= 2) {
    diagnostics.push({ message: "Failed reads (NULL ce_total) were kept in the LAG, so the reading after a failed read lost its increase. Drop NULL readings before comparing neighbours.", rows: solve({ keepNull: true }) });
    diagnostics.push({ message: "Readings were ordered by sample_id. sample_id is a load identifier, not time order; order by sample_ts.", rows: solve({ bySampleId: true }) });
  }
  if (level === 3) diagnostics.push({ message: "A reset was detected only as a drop in the counter. After one reload the counter climbed past its old value; a change of driver_load_id is the reset.", rows: solve({ dropOnly: true }) });

  const cols = ["sample_id", "node_id", "gpu_uuid", "sample_ts", "driver_load_id", "ce_total"];
  const tRows = all.slice().sort((a, b) => a.id - b.id).map((x) => [x.id, x.g.node, x.g.uuid, ts(x.day, x.sec), x.load, x.v]);
  const setup =
    "SET TIME ZONE 'UTC';\n" +
    "CREATE TABLE gpu_error_samples (\n  sample_id BIGINT PRIMARY KEY,\n  node_id TEXT NOT NULL,\n  gpu_uuid TEXT NOT NULL,\n  sample_ts TIMESTAMPTZ NOT NULL,\n  driver_load_id INT NOT NULL,\n  ce_total BIGINT\n);\n" +
    insertSQL("gpu_error_samples", cols, tRows);

  return {
    vars: {
      threshold,
      min_gpus: minGpus,
      samples: tRows.length,
      gpus: gpus.length,
      null_rule: level === 1
        ? "In this sample every read succeeded, so `ce_total` is never NULL, and `sample_id` happens to follow time order."
        : "A failed read is stored with `ce_total` NULL: ignore it, and compare the next reading with the last successful one. `sample_id` is assigned at load time and is not in time order.",
      reset_rule: level === 3
        ? "Watch for a reload after which the counter climbed past its old value before the next reading: the value did not drop, but `driver_load_id` changed."
        : "In this sample every reload happens to show up as a drop in the value, but `driver_load_id` is the rule.",
    },
    setup,
    tables: [{ name: "gpu_error_samples", columns: cols, rows: tRows }],
    expected: { columns: ["day", "node_id", "flagged_gpus", "worst_gpu", "worst_increase"], rows },
    diagnostics: diagnostics.filter((d) => JSON.stringify(d.rows) !== JSON.stringify(rows)),
  };
}
