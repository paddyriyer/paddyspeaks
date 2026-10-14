/* CFL-L1-04 — What a log-compaction pass leaves behind (Python).
   Simulated practice scenario. All data is generated from the seed; the compaction rules
   are this exercise's simplified model of a compacted topic (check current docs).

   Contract (python): entry, signature, starter, prelude, generate(r, level) ->
     { vars, samples: [{args, expect}], tests: [{name, args, expect?, limit_s?}] }.
   expect comes from oracle() below: for every record it scans the partition again for a
   later record of the same key (quadratic, fine for small inputs). The evaluator's
   reference makes one pass to find each key's last offset, written independently.
   level: 1 Medium (one partition; the active segment; tombstones and their horizon)
          2 Hard (+ several partitions sharing keys, offset gaps, an empty active segment,
            a partition with no records, tombstones exactly at the horizon)
          3 Very Hard (+ a minimum compaction lag: the first record younger than it ends the
            cleanable range, even when later records carry older timestamps) */
export const kind = "python";
export const entry = "compact";
export const signature = "def compact(records: list[tuple[int, int, str, str | None, int]], active_start: dict[int, int], now_ms: int, delete_retention_ms: int, min_lag_ms: int) -> dict[int, list[int]]:";
export const starter = `def compact(records, active_start, now_ms, delete_retention_ms, min_lag_ms):
    """records: (partition, offset, key, value, ts_ms) in offset order within each
    partition; value None is a tombstone.
    active_start: {partition: base offset of its active segment}.
    Return {partition: [offsets that remain after compaction, ascending]}."""
    ...
`;

export const prelude = `
def _gen_log(n, n_keys, n_parts, seed, min_lag_ms):
    x = seed
    def rnd(m):
        nonlocal x
        x = (1103515245 * x + 12345) % 2147483648
        return (x >> 8) % m
    base = 1760000000000
    records, nxt = [], [0] * n_parts
    for i in range(n):
        p = rnd(n_parts)
        off = nxt[p]
        nxt[p] = off + (2 if rnd(10) == 0 else 1)        # gaps left by earlier compactions
        value = None if rnd(8) == 0 else 'v%d' % i
        records.append((p, off, 'acct-%d' % rnd(n_keys), value, base + i * 20 + rnd(4000)))
    active_start = {p: (nxt[p] * 19) // 20 for p in range(n_parts)}
    return records, active_start, base + n * 20 + 5000, n * 6, min_lag_ms
`.trim() + "\n";

// The rules, applied literally to each record.
export function oracle(records, activeStart, now, retention, minLag) {
  const out = new Map();
  for (const p of Object.keys(activeStart).map(Number).sort((a, b) => a - b)) {
    const recs = records.filter((x) => x[0] === p);
    let end = activeStart[p];
    for (const [, off, , , ts] of recs) {
      if (off >= end) break;
      if (ts > now - minLag) { end = off; break; }
    }
    const kept = [];
    for (const [, off, key, value, ts] of recs) {
      if (off >= end) { kept.push(off); continue; }
      const superseded = recs.some((o) => o[2] === key && o[1] > off && o[1] < end);
      if (superseded) continue;
      if (value === null && ts <= now - retention) continue;
      kept.push(off);
    }
    out.set(p, kept);
  }
  return out;
}

const pyStr = (s) => (s === null ? "None" : `'${s}'`);
const pyArgs = (records, active, now, retention, minLag) =>
  `([${records.map(([p, off, k, v, ts]) => `(${p}, ${off}, ${pyStr(k)}, ${pyStr(v)}, ${ts})`).join(", ")}], ` +
  `{${Object.entries(active).map(([p, o]) => `${p}: ${o}`).join(", ")}}, ${now}, ${retention}, ${minLag})`;
const pyOut = (m) => "{" + [...m.entries()].map(([p, xs]) => `${p}: [${xs.join(", ")}]`).join(", ") + "}";

const KEYS = ["acct-17", "acct-23", "acct-42", "acct-58", "acct-61", "acct-77", "acct-90"];
const BASE = 1760000000000;

function randomCase(r, level) {
  for (let attempt = 0; attempt < 80; attempt++) {
    const nParts = level === 1 ? 1 : r.int(2, 3);
    const keys = r.sample(KEYS, level === 1 ? r.int(4, 5) : r.int(4, 6));
    const n = level === 1 ? r.int(12, 16) : r.int(16, 22);
    const t0 = BASE + r.int(0, 1000) * 1000;
    const records = [];
    const nxt = new Array(nParts).fill(0).map(() => (level === 1 ? 0 : r.int(0, 3) * 100));
    let t = t0;
    for (let i = 0; i < n; i++) {
      const p = r.int(0, nParts - 1);
      const off = nxt[p];
      nxt[p] += level >= 2 && r.chance(0.2) ? r.int(2, 4) : 1;
      t += r.int(500, 3000);
      const ts = level >= 2 && r.chance(0.2) ? t - r.int(1, 2500) : t;     // timestamps need not be in offset order
      records.push([p, off, r.pick(keys), r.chance(0.25) ? null : "v" + (i + 1), ts]);
    }
    const active = {};
    for (let p = 0; p < nParts; p++) {
      const offs = records.filter((x) => x[0] === p).map((x) => x[1]);
      if (!offs.length) active[p] = nxt[p];
      else if (level >= 2 && r.chance(0.25)) active[p] = nxt[p];          // empty active segment
      else active[p] = offs[Math.max(0, offs.length - r.int(1, 3))];
    }
    const now = t + r.int(1000, 5000);
    const retention = Math.floor((now - t0) * (0.3 + 0.4 * r.next()));
    let minLag = 0;
    if (level === 3) {
      // A cut point somewhere before the active segment.
      minLag = now - records[Math.floor(n * (0.5 + 0.3 * r.next()))][4];
    }
    const got = oracle(records, active, now, retention, minLag);
    const kept = [...got.values()].reduce((s, v) => s + v.length, 0);
    const tombs = records.some((x) => x[3] === null);
    if (kept > 0 && kept < n && tombs) return { records, active, now, retention, minLag, got };
  }
  throw new Error("CFL-L1-04: could not build a sample");
}

export function generate(r, level) {
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const c = randomCase(r, level);
    samples.push({ args: pyArgs(c.records, c.active, c.now, c.retention, c.minLag), expect: pyOut(c.got) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const [K1, K2, K3] = r.sample(KEYS, 3);
  const t0 = BASE + r.int(0, 1000) * 1000;
  const dr = r.int(5, 20) * 1000;
  const now = t0 + 100000;
  const hz = now - dr;                                 // the tombstone horizon
  const edges = [
    ["only the latest record of each key survives",
      [[0, 0, K1, "a", t0], [0, 1, K2, "b", t0 + 10], [0, 2, K1, "c", t0 + 20], [0, 3, K1, "d", t0 + 30], [0, 4, K3, "e", t0 + 40]], { 0: 4 }, 0],
    ["the active segment is never compacted, and its records do not remove older ones",
      [[0, 0, K1, "a", t0], [0, 1, K2, "b", t0 + 10], [0, 2, K1, "c", t0 + 20], [0, 3, K1, "d", t0 + 30], [0, 4, K2, "e", t0 + 40]], { 0: 2 }, 0],
    ["a tombstone exactly at the horizon is dropped; one millisecond newer is kept",
      [[0, 0, K1, "a", t0], [0, 1, K1, null, hz], [0, 2, K2, "b", t0 + 5], [0, 3, K2, null, hz + 1], [0, 4, K3, "c", hz + 50]], { 0: 4 }, 0],
    ["a tombstone followed by a new value is removed with the old value",
      [[0, 0, K1, "a", t0], [0, 1, K1, null, now - 1], [0, 2, K1, "b", now - 1], [0, 3, K2, "c", now - 1]], { 0: 3 }, 0],
  ];
  if (level >= 2) {
    edges.push(["the same key in two partitions is compacted separately",
      [[0, 0, K1, "a", t0], [1, 0, K1, "b", t0 + 1], [0, 1, K1, "c", t0 + 2], [1, 1, K2, "d", t0 + 3], [0, 2, K2, "e", t0 + 4], [1, 2, K2, "f", t0 + 5]], { 0: 2, 1: 2 }, 0]);
    edges.push(["an empty active segment, offset gaps and a partition with no records",
      [[0, 0, K1, "a", t0], [0, 3, K1, "b", t0 + 1], [0, 7, K2, null, hz - 1], [0, 8, K3, "c", t0 + 3]], { 0: 9, 1: 0 }, 0]);
  }
  if (level === 3) {
    const lag = r.int(10, 30) * 1000;
    const cut = now - lag;
    edges.push(["the first record younger than the minimum lag ends the cleanable range, even before older ones",
      [[0, 0, K1, "a", t0], [0, 1, K1, "b", cut + 1], [0, 2, K2, "c", cut - 500], [0, 3, K2, "d", cut - 400], [0, 4, K3, "e", cut + 2]], { 0: 4 }, lag]);
    edges.push(["a record exactly at the lag boundary is still cleanable",
      [[0, 0, K1, "a", t0], [0, 1, K1, "b", cut], [0, 2, K2, null, t0 + 1], [0, 3, K3, "c", cut + 5]], { 0: 4 }, lag]);
  }
  for (const [name, recs, active, minLag] of edges) {
    tests.push({ name, args: pyArgs(recs, active, now, dr, minLag), expect: pyOut(oracle(recs, active, now, dr, minLag)) });
  }

  // Timing: 300 000 records over 60 000 keys. One pass per partition with a dict is O(n);
  // rescanning the log for each key (or each record) is O(n x keys).
  const parts = level === 1 ? 1 : 4;
  tests.push({
    name: "300,000 records over 60,000 keys (one pass with a dict, not a rescan per key)",
    args: `_gen_log(300000, 60000, ${parts}, ${r.int(1, 1_000_000)}, ${level === 3 ? 600000 : 0})`,
    limit_s: 8,
  });

  return {
    vars: {
      parts_rule: level === 1
        ? "This topic has one partition, but `active_start` is a dict so the code must work for several."
        : "Partitions are independent: a key in partition 0 never removes a record in partition 1. Offsets can have gaps where earlier compactions removed records, the active segment can be empty (`active_start` one past the last offset), and `active_start` can name a partition with no records (return an empty list for it).",
      lag_rule: level === 3
        ? "A minimum compaction lag also applies: within a partition, the cleanable range ends at the active segment or at the first record (in offset order) whose `ts_ms > now_ms - min_lag_ms`, whichever comes first. Records from that point on stay as they are, even if some of them carry older timestamps."
        : "In this replay `min_lag_ms` is always 0 and every `ts_ms` is at or before `now_ms`, so the cleanable range ends at the active segment.",
    },
    samples,
    tests,
  };
}
