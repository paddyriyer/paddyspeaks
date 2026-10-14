/* CFL-L1-05 — Which log segments retention deletes (Python).
   Simulated practice scenario. All data is generated from the seed; the retention rules are
   this exercise's simplified model of time- and size-based retention (check current docs).

   Contract (python): entry, signature, starter, prelude, generate(r, level) ->
     { vars, samples: [{args, expect}], tests: [{name, args, expect?, limit_s?}] }.
   expect comes from oracle() below, which deletes one segment at a time and recomputes the
   remaining size from scratch at every step. The evaluator's reference keeps one running
   total, written independently.
   level: 1 Medium (one topic; time then size; the active segment is never deleted)
          2 Hard (+ unlimited limits (-1), a segment that has not expired in front of expired
            ones, exact boundaries for both limits, every segment expired)
          3 Very Hard (+ a log start offset moved forward by a delete-records request: whole
            segments below it go too, and it can sit inside a segment or the active one) */
export const kind = "python";
export const entry = "apply_retention";
export const signature = "def apply_retention(partitions: list[tuple[str, int, int, list[tuple[int, int, int]]]], configs: dict[str, tuple[int, int]], now_ms: int) -> dict[tuple[str, int], tuple[int, int, int]]:";
export const starter = `def apply_retention(partitions, configs, now_ms):
    """partitions: (topic, partition_id, log_start_offset, segments); segments are
    (base_offset, size_bytes, max_ts_ms), oldest first; the last one is the active segment.
    configs: {topic: (retention_ms, retention_bytes)}, -1 meaning no limit.
    Return {(topic, partition_id): (deleted_segments, deleted_bytes, new_log_start_offset)}."""
    ...
`;

export const prelude = `
def _gen_logs(n_parts, n_segs, seed, with_start):
    x = seed
    def rnd(m):
        nonlocal x
        x = (1103515245 * x + 12345) % 2147483648
        return (x >> 8) % m
    hour = 3600000
    now = 1760000000000
    topics = ('orders', 'payments', 'clickstream')
    parts, configs = [], {}
    for t in topics:
        configs[t] = (hour * (n_segs * 9 // 10 + rnd(n_segs // 20)), 0)
    for k in range(n_parts):
        t = topics[k % 3]
        base, segs, total = rnd(1000), [], 0
        for i in range(n_segs):
            size = 200000 + rnd(1800000)
            ts = now - (n_segs - i) * hour + rnd(hour)
            segs.append((base, size, ts))
            base += 500 + rnd(4500)
            total += size
        start = segs[0][0]
        if with_start and k % 4 == 0:
            start = segs[n_segs * 4 // 5][0] + 3
        parts.append((t, k, start, segs))
        if configs[t][1] == 0:
            configs[t] = (configs[t][0], total // 4)
    return parts, configs, now
`.trim() + "\n";

// The rules, one segment at a time, recomputing the remaining size every step.
export function oracle(parts, configs, now) {
  const out = new Map();
  for (const [topic, pid, logStart, segs] of parts) {
    const [rms, rbytes] = configs[topic];
    let left = segs.slice();
    const deleted = [];
    const drop = () => deleted.push(left.shift());
    if (rms !== -1) while (left.length > 1 && now - left[0][2] > rms) drop();
    if (rbytes !== -1) while (left.length > 1 && left.reduce((s, x) => s + x[1], 0) - left[0][1] >= rbytes) drop();
    while (left.length > 1 && left[1][0] <= logStart) drop();
    out.set(topic + "|" + pid, [deleted.length, deleted.reduce((s, x) => s + x[1], 0), Math.max(logStart, left[0][0])]);
  }
  return out;
}

const pyArgs = (parts, configs, now) =>
  `([${parts.map(([t, p, ls, segs]) => `('${t}', ${p}, ${ls}, [${segs.map((s) => `(${s.join(", ")})`).join(", ")}])`).join(", ")}], ` +
  `{${Object.entries(configs).map(([t, [a, b]]) => `'${t}': (${a}, ${b})`).join(", ")}}, ${now})`;
const pyOut = (m) => "{" + [...m.entries()].map(([k, v]) => { const [t, p] = k.split("|"); return `('${t}', ${p}): (${v.join(", ")})`; }).join(", ") + "}";

const TOPICS = ["orders", "payments", "clickstream", "shipments", "invoices"];
const HOUR = 3600000;
const NOW = 1760000000000;

function segments(r, n, sizeLo, sizeHi, disorder) {
  const segs = [];
  let base = r.int(0, 50) * 100;
  for (let i = 0; i < n; i++) {
    let ts = NOW - (n - i) * HOUR + r.int(0, HOUR - 1);
    if (disorder && i > 0 && i < n - 1 && r.chance(0.2)) ts += r.int(4, 8) * HOUR;      // a late-stamped record
    segs.push([base, r.int(sizeLo, sizeHi) * 1000, ts]);
    base += r.int(100, 900);
  }
  return segs;
}

function randomCase(r, level) {
  for (let attempt = 0; attempt < 80; attempt++) {
    const topics = r.sample(TOPICS, level === 1 ? 1 : 2);
    const configs = {};
    const parts = [];
    let pid = 0;
    for (const t of topics) {
      const nP = level === 1 ? r.int(2, 3) : r.int(1, 2);
      const segsOf = [];
      for (let k = 0; k < nP; k++) segsOf.push(segments(r, r.int(5, 9), 100, 900, level >= 2));
      const rms = level >= 2 && r.chance(0.25) ? -1 : r.int(2, 6) * HOUR;
      const avgTotal = segsOf.reduce((s, sg) => s + sg.reduce((a, x) => a + x[1], 0), 0) / nP;
      let rbytes = Math.floor(avgTotal * (0.3 + 0.4 * r.next()) / 1000) * 1000;
      if (level >= 2 && rms !== -1 && r.chance(0.25)) rbytes = -1;
      configs[t] = [rms, rbytes];
      for (const segs of segsOf) {
        let ls = segs[0][0];
        if (level === 3 && r.chance(0.4)) {
          const i = r.int(1, segs.length - 1);
          ls = r.chance(0.4) ? segs[i][0] : segs[i][0] + r.int(1, 50);               // on a boundary or inside
        }
        parts.push([t, pid++, ls, segs]);
      }
    }
    const got = oracle(parts, configs, NOW);
    const res = parts.map((p) => [p[3].length, got.get(p[0] + "|" + p[1])[0]]);
    if (res.some(([, d]) => d > 0) && res.some(([n, d]) => d < n - 1)) return { parts, configs, got };
  }
  throw new Error("CFL-L1-05: could not build a sample");
}

export function generate(r, level) {
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const c = randomCase(r, level);
    samples.push({ args: pyArgs(c.parts, c.configs, NOW), expect: pyOut(c.got) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const t = r.pick(TOPICS);
  const S = r.int(2, 9) * 100000;                        // a segment size used by several tests
  const seg = (base, size, hoursAgo) => [base, size, NOW - hoursAgo * HOUR];
  const edges = [
    ["the active segment is never deleted, even when it has expired",
      [[t, 0, 0, [seg(0, S, 50), seg(100, S, 40), seg(200, S, 30)]]], { [t]: [10 * HOUR, level === 1 ? 10 * S : -1] }],
    ["time retention stops at the first segment that has not expired",
      [[t, 0, 0, [seg(0, S, 20), seg(100, S, 3), seg(200, S, 15), seg(300, S, 1)]]], { [t]: [10 * HOUR, -1] }],
    ["size retention deletes while the rest is still at least retention_bytes (exactly equal counts)",
      [[t, 0, 0, [seg(0, S, 5), seg(100, S, 4), seg(200, S, 3), seg(300, S, 2)]]], { [t]: [-1, 2 * S] }],
    ["size counts the active segment; one byte more than the rest keeps the segment",
      [[t, 0, 0, [seg(0, S, 5), seg(100, S, 4), seg(200, S, 3), seg(300, S, 2)]]], { [t]: [-1, 2 * S + 1] }],
    ["time first, then size on what is left",
      [[t, 0, 0, [seg(0, S, 30), seg(100, 2 * S, 20), seg(200, S, 9), seg(300, S, 8), seg(400, S, 1)]]], { [t]: [10 * HOUR, 2 * S] }],
  ];
  if (level >= 2) {
    edges.push(["a segment exactly retention_ms old has not expired",
      [[t, 0, 0, [seg(0, S, 10), seg(100, S, 9), seg(200, S, 1)]]], { [t]: [10 * HOUR, -1] }]);
    edges.push(["no limits at all deletes nothing",
      [[t, 0, 0, [seg(0, S, 500), seg(100, S, 400), seg(200, S, 1)]]], { [t]: [-1, -1] }]);
  }
  if (level === 3) {
    edges.push(["a log start offset inside a segment deletes only the segments wholly below it",
      [[t, 0, 250, [seg(0, S, 5), seg(100, S, 4), seg(200, S, 3), seg(300, S, 2)]]], { [t]: [-1, -1] }]);
    edges.push(["a log start offset on a segment's base offset deletes every segment before it",
      [[t, 0, 300, [seg(0, S, 5), seg(100, S, 4), seg(200, S, 3), seg(300, S, 2)]]], { [t]: [-1, -1] }]);
    edges.push(["a log start offset inside the active segment still keeps the active segment",
      [[t, 0, 420, [seg(0, S, 5), seg(100, S, 4), seg(200, S, 3), seg(300, S, 2)]]], { [t]: [-1, -1] }]);
    edges.push(["after time and size, a log start offset that is already behind changes nothing",
      [[t, 0, 50, [seg(0, S, 30), seg(100, S, 20), seg(200, S, 3), seg(300, S, 2)]]], { [t]: [10 * HOUR, -1] }]);
  }
  for (const [name, parts, configs] of edges) tests.push({ name, args: pyArgs(parts, configs, NOW), expect: pyOut(oracle(parts, configs, NOW)) });

  // Timing: 80 partitions with 10 000 segments each (hourly segments kept for over a year).
  // One running total is O(s); recomputing the remaining size for every deletion is O(s^2).
  tests.push({
    name: "80 partitions x 10,000 segments (one running total, not a re-sum per deletion)",
    args: `_gen_logs(80, 10000, ${r.int(1, 1_000_000)}, ${level === 3 ? "True" : "False"})`,
    limit_s: 8,
  });

  return {
    vars: {
      limits_rule: level === 1
        ? "Every topic in this replay has both limits set."
        : "Either limit can be -1 (no limit), and a record stamped late can leave a segment that has not expired in front of older-looking ones.",
      start_rule: level === 3
        ? "A delete-records request can move a partition's `log_start_offset` forward. After time and size, also delete the oldest segments while the next segment's `base_offset <= log_start_offset` (the active segment still stays). The new log start offset is the larger of `log_start_offset` and the first remaining segment's base offset."
        : "In this replay `log_start_offset` is always the first segment's base offset; the new log start offset is the first remaining segment's base offset.",
    },
    samples,
    tests,
  };
}
