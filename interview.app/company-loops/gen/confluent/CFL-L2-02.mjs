/* CFL-L2-02 — Read-committed view of a partition: transactions, markers, the last stable offset (Python).
   Simulated practice scenario. All data is generated from the seed and is hypothetical.

   Contract: see docs/COMPANY-INTERVIEW-LOOPS.md § Executable templates (python).
   expect comes from oracle() below: for every transactional record it scans forward
   for the same producer's next marker below the high watermark (O(n^2), small inputs
   only), and takes the last stable offset as the lowest offset of a record whose
   transaction is still open. The evaluator's reference is one forward sweep that
   tracks each producer's open transaction, written independently.
   level: 1 Medium (committed, aborted and one open transaction; read from offset 0)
          2 Hard (+ a high watermark that cuts off markers, a start offset, several
                  transactions per producer, non-transactional records, read_uncommitted)
          3 Very Hard (+ offset gaps, markers with no open transaction, transactions
                  that began before the start offset) */
export const kind = "python";
export const entry = "visible_records";
export const signature = "def visible_records(log: list[tuple[int, int, str]], high_watermark: int, start: int = 0, isolation: str = 'read_committed') -> list[int]:";
export const starter = `def visible_records(log, high_watermark, start=0, isolation="read_committed"):
    """log: (offset, producer_id, kind) in offset order; kind is 'data'
    (non-transactional), 'txn' (transactional), 'commit' or 'abort' (markers).
    Return the offsets a consumer with this isolation level receives, in order."""
    ...
`;

export const prelude = `
def _gen_log(n, producers, seed):
    x = seed
    def nxt():
        nonlocal x
        x = (1103515245 * x + 12345) % 2147483648
        return x >> 16
    log, size, off = [], [0] * producers, 0
    limit = [3 + nxt() % 15 for _ in range(producers)]
    for _ in range(n):
        p = nxt() % producers
        if size[p] >= limit[p]:
            log.append((off, 1000 + p, 'abort' if nxt() % 10 < 3 else 'commit'))
            size[p], limit[p] = 0, 3 + nxt() % 15
        elif nxt() % 25 == 0:
            log.append((off, 1000 + p, 'data'))
        else:
            log.append((off, 1000 + p, 'txn'))
            size[p] += 1
        off += 2 if nxt() % 40 == 0 else 1
    return log, off
`.trim() + "\n";

// The specification, implemented independently of the Python reference.
export function oracle(log, hw, start, isolation) {
  const live = log.filter(([o]) => o < hw);
  if (isolation === "read_uncommitted") {
    return live.filter(([o, , k]) => o >= start && (k === "data" || k === "txn")).map(([o]) => o);
  }
  const fate = new Map();                         // offset of a txn record -> 'commit' | 'abort' | 'open'
  live.forEach(([o, p, k], i) => {
    if (k !== "txn") return;
    let f = "open";
    for (let j = i + 1; j < live.length; j++) {
      const [, p2, k2] = live[j];
      if (p2 === p && (k2 === "commit" || k2 === "abort")) { f = k2; break; }
    }
    fate.set(o, f);
  });
  let lso = hw;
  for (const [o, f] of fate) if (f === "open" && o < lso) lso = o;
  return live
    .filter(([o, , k]) => o >= start && o < lso && (k === "data" || (k === "txn" && fate.get(o) === "commit")))
    .map(([o]) => o);
}

const pyArgs = (log, hw, start, iso) =>
  `([${log.map(([o, p, k]) => `(${o}, ${p}, '${k}')`).join(", ")}], ${hw}, ${start}, '${iso}')`;
const pyOut = (xs) => "[" + xs.join(", ") + "]";

function smallLog(r, level) {
  const np = level === 1 ? 2 : r.int(2, 4);
  const pids = r.sample([3001, 3002, 3007, 4100, 4105, 5200, 5222, 6010], np);
  const size = Object.fromEntries(pids.map((p) => [p, 0]));
  const log = [];
  let off = r.int(0, 3) * 10;
  const n = level === 1 ? r.int(10, 14) : r.int(14, 22);
  for (let i = 0; i < n; i++) {
    const p = r.pick(pids);
    const roll = r.next();
    if (size[p] >= 2 && roll < 0.3) {
      log.push([off, p, r.chance(0.6) ? "commit" : "abort"]);
      size[p] = 0;
    } else if (level === 3 && size[p] === 0 && roll < 0.36) {
      log.push([off, p, r.chance(0.5) ? "commit" : "abort"]);    // a marker with no open transaction
    } else if (level >= 2 && roll > 0.88) {
      log.push([off, p, "data"]);
    } else {
      log.push([off, p, "txn"]);
      size[p]++;
    }
    off += level === 3 && r.chance(0.15) ? r.int(2, 4) : 1;
  }
  // Level 1 closes every transaction but one, so the open one sets the last stable offset.
  if (level === 1) {
    const open = pids.filter((p) => size[p] > 0);
    for (const p of open.slice(1)) { log.push([off++, p, r.chance(0.6) ? "commit" : "abort"]); }
  }
  const end = off;
  const hw = level === 1 ? end : end - r.int(0, 4);
  const start = level === 1 ? 0 : log[r.int(0, Math.floor(log.length / 3))][0];
  const iso = level >= 2 && r.chance(0.25) ? "read_uncommitted" : "read_committed";
  return { log, hw, start, iso };
}

export function generate(r, level) {
  const samples = [];
  for (let i = 0; i < 3; i++) {
    let c;
    for (let k = 0; k < 40; k++) {
      c = smallLog(r, level);
      if (oracle(c.log, c.hw, c.start, c.iso).length >= 2) break;
    }
    samples.push({ args: pyArgs(c.log, c.hw, c.start, c.iso), expect: pyOut(oracle(c.log, c.hw, c.start, c.iso)) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const [A, B, C] = r.sample([7001, 7002, 7003, 7004, 7005, 7006], 3);
  const b = r.int(1, 9) * 100;
  const L = (...rows) => rows.map(([d, p, k]) => [b + d, p, k]);
  const RC = "read_committed", RU = "read_uncommitted";
  const edges = [
    ["committed records are returned, aborted ones are not, markers never",
      L([0, A, "txn"], [1, B, "txn"], [2, A, "txn"], [3, A, "commit"], [4, B, "abort"], [5, C, "data"]), b + 6, b, RC],
    ["an open transaction stops the read at its first record",
      L([0, A, "txn"], [1, B, "txn"], [2, C, "data"], [3, A, "commit"], [4, C, "data"]), b + 5, b, RC],
    ["a committed transaction's records after the last stable offset wait",
      L([0, A, "txn"], [1, B, "txn"], [2, A, "txn"], [3, A, "commit"]), b + 4, b, RC],
    ["a producer's second transaction starts after its marker",
      L([0, A, "txn"], [1, A, "abort"], [2, A, "txn"], [3, A, "txn"], [4, A, "commit"]), b + 5, b, RC],
    ["non-transactional records are visible below the last stable offset",
      L([0, A, "data"], [1, A, "data"], [2, B, "data"]), b + 3, b, RC],
    ["an empty log", [], b, b, RC],
  ];
  if (level >= 2) {
    edges.push(["a commit marker at the high watermark has not happened yet",
      L([0, A, "txn"], [1, B, "data"], [2, A, "commit"]), b + 2, b, RC]);
    edges.push(["records before the start offset are not returned",
      L([0, A, "txn"], [1, A, "commit"], [2, B, "data"], [3, B, "txn"], [4, B, "commit"]), b + 5, b + 2, RC]);
    edges.push(["read_uncommitted returns every data record below the high watermark",
      L([0, A, "txn"], [1, B, "txn"], [2, A, "abort"], [3, C, "data"], [4, B, "txn"]), b + 4, b, RU]);
  }
  if (level === 3) {
    edges.push(["a marker with no open transaction changes nothing",
      L([0, A, "commit"], [1, A, "txn"], [2, B, "abort"], [3, A, "commit"], [4, B, "txn"], [5, B, "abort"]), b + 6, b, RC]);
    edges.push(["an open transaction that began before the start offset still holds the read",
      L([0, A, "txn"], [1, B, "data"], [2, B, "data"], [3, A, "txn"]), b + 4, b + 1, RC]);
    edges.push(["offsets with gaps",
      L([0, A, "txn"], [3, B, "data"], [7, A, "commit"], [8, B, "txn"], [12, B, "commit"], [15, C, "data"]), b + 16, b + 3, RC]);
  }
  for (const [name, log, hw, st, iso] of edges) tests.push({ name, args: pyArgs(log, hw, st, iso), expect: pyOut(oracle(log, hw, st, iso)) });

  // Timing: 300,000 entries from 200 interleaved producers, about 7,000 aborted
  // transactions. One sweep is O(n); checking each record against every aborted
  // transaction, or scanning ahead to each record's marker, is far slower.
  tests.push({
    name: "300,000 log entries from 200 producers (one sweep)",
    args: `(lambda g: (g[0], g[1] - 3, 0, 'read_committed'))(_gen_log(300000, 200, ${r.int(1, 1_000_000)}))`,
    limit_s: 8,
  });

  return {
    vars: {
      topic: r.pick(["payments.settled", "orders.v2", "ledger-entries", "inventory.reservations", "shipments.events"]),
      replay_rule: level === 1
        ? "In this replay the high watermark is the end of the log, reads start at offset 0 and every check uses `read_committed`."
        : level === 2
          ? "In this replay the high watermark can fall before a transaction's marker, reads can start part-way through the log, producers run several transactions in turn, and some checks use `read_uncommitted`."
          : "In this replay offsets have gaps, a producer can write a marker with no open transaction, a transaction can begin before the start offset, the high watermark can fall before a marker, and some checks use `read_uncommitted`.",
    },
    samples,
    tests,
  };
}
