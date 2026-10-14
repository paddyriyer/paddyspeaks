/* MDB-L2-02 — Orphaned documents after chunk migrations (Python, sorting and binary search).
   Simulated practice scenario. All data is generated from the seed.

   Contract (python): entry, signature, starter, prelude, generate(r, level) ->
     { vars, samples: [{args, expect}], tests: [{name, args, expect?, limit_s?}] }.
   expect comes from oracle() below: migrations applied by scanning the chunk list,
   and every document checked against every chunk. The evaluator's reference sorts
   the chunk bounds once and binary-searches each key, so each checks the other.
   level: 1 Medium (the routing table is current; integer keys) · 2 Hard (+ a log of
          committed and aborted migrations to apply first) · 3 Very Hard (+ compound
          shard keys compared field by field) */
export const kind = "python";
export const entry = "find_orphans";
export const signature = "def find_orphans(chunks: list[tuple], documents: list[tuple], migrations: list[tuple] | None = None) -> list[tuple[str, int]]:";
export const starter = `def find_orphans(chunks, documents, migrations=None):
    """chunks: (min_key, max_key, shard) ranges, min inclusive, max exclusive,
    None for the lowest and highest bound. documents: (shard, doc_id, shard_key)
    for every document stored on every shard. Return the sorted (shard, doc_id)
    pairs of documents stored on a shard that does not own their chunk."""
    ...
`;

export const prelude = `
from bisect import bisect_right as _bisect_right


def _lcg(x):
    return (1103515245 * x + 12345) % 2147483648


def _gen_cluster(n_chunks, n_docs, n_moves, seed, compound):
    x = seed
    regions = ['af', 'ap', 'eu', 'me', 'na', 'sa']
    shards = ['shard%02d' % i for i in range(8)]

    def key():
        nonlocal x
        x = _lcg(x)
        a = x
        x = _lcg(x)
        n = ((a >> 4) * 32768 + (x >> 16)) % 1000000000
        return (regions[(x >> 8) % 6], n) if compound else n

    bounds = sorted({key() for _ in range(n_chunks - 1)})
    lows = [None] + bounds
    highs = bounds + [None]
    owner = {}
    chunks = []
    for lo, hi in zip(lows, highs):
        x = _lcg(x)
        owner[lo] = shards[(x >> 8) % 8]
        chunks.append((lo, hi, owner[lo]))
    start = dict(owner)
    moves = []
    for _ in range(n_moves):
        x = _lcg(x)
        lo = lows[(x >> 8) % len(lows)]
        x = _lcg(x)
        to = shards[(x >> 8) % 8]
        x = _lcg(x)
        ok = (x >> 8) % 10 < 8
        moves.append((lo, to, 'committed' if ok else 'aborted'))
        if ok:
            owner[lo] = to
    docs = []
    for i in range(n_docs):
        k = key()
        lo = lows[_bisect_right(bounds, k)]
        x = _lcg(x)
        r = (x >> 8) % 100
        shard = owner[lo] if r < 94 else start[lo] if r < 97 else shards[(x >> 4) % 8]
        docs.append((shard, 7000000 + i, k))
    x = _lcg(x)
    off = (x >> 8) % len(chunks)
    chunks = chunks[off:] + chunks[:off]
    return chunks, docs, (moves if n_moves else None)
`.trim() + "\n";

// Compare shard keys: integers, or arrays compared field by field.
function cmp(a, b) {
  if (Array.isArray(a)) {
    for (let i = 0; i < a.length; i++) {
      const c = cmp(a[i], b[i]);
      if (c) return c;
    }
    return 0;
  }
  return a < b ? -1 : a > b ? 1 : 0;
}
const same = (a, b) => (a === null || b === null ? a === b : cmp(a, b) === 0);

// The rules applied literally: migrations by scanning the chunk list, every document against every chunk.
export function oracle(chunks, documents, migrations) {
  const table = chunks.map(([lo, hi, shard]) => ({ lo, hi, shard }));
  for (const [lo, to, outcome] of migrations || []) {
    if (outcome !== "committed") continue;
    for (const c of table) if (same(c.lo, lo)) c.shard = to;
  }
  const out = [];
  for (const [shard, id, key] of documents) {
    const c = table.find((t) => (t.lo === null || cmp(t.lo, key) <= 0) && (t.hi === null || cmp(key, t.hi) < 0));
    if (c.shard !== shard) out.push([shard, id]);
  }
  return out.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] - b[1]));
}

function py(v) {
  if (v === null || v === undefined) return "None";
  if (typeof v === "number") return String(v);
  if (typeof v === "string") return "'" + v + "'";
  if (Array.isArray(v)) return v.length === 1 ? `(${py(v[0])},)` : "(" + v.map(py).join(", ") + ")";
  throw new Error("unexpected value");
}
const pyList = (xs) => "[" + xs.map(py).join(", ") + "]";
const pyArgs = (c) => `(${pyList(c.chunks)}, ${pyList(c.docs)}, ${c.moves ? pyList(c.moves) : "None"})`;
const run = (c) => oracle(c.chunks, c.docs, c.moves);

const REGIONS = ["ap", "eu", "na", "sa"];
const NAMES = [["shard00", "shard01", "shard02", "shard03"], ["rs0", "rs1", "rs2", "rs3"], ["sh-a", "sh-b", "sh-c", "sh-d"]];

// Chunk bounds: integers, or [region, number] pairs at Very Hard.
function makeTable(r, level, shards, n) {
  let bounds;
  if (level === 3) {
    const set = new Map();
    while (set.size < n - 1) { const k = [r.pick(REGIONS), r.int(1, 9) * 100]; set.set(k.join("/"), k); }
    bounds = [...set.values()].sort(cmp);
  } else {
    bounds = r.sample(Array.from({ length: 19 }, (_, i) => (i + 1) * 50), n - 1).sort((a, b) => a - b);
  }
  const lows = [null, ...bounds], highs = [...bounds, null];
  return lows.map((lo, i) => [lo, highs[i], r.pick(shards)]);
}
function keyIn(r, level, lo, hi) {
  if (level === 3) {
    for (;;) {
      const k = [r.pick(REGIONS), r.int(0, 1000)];
      if ((lo === null || cmp(lo, k) <= 0) && (hi === null || cmp(k, hi) < 0)) return k;
    }
  }
  const a = lo === null ? -40 : lo, b = hi === null ? 1100 : hi;
  return r.chance(0.2) ? a : r.int(a, b - 1);          // the lower bound itself, now and then
}

function randomCase(r, level, shards, idBase) {
  for (let attempt = 0; attempt < 80; attempt++) {
    const chunks = makeTable(r, level, shards, r.int(4, 6));
    const moves = level >= 2
      ? Array.from({ length: r.int(2, 4) }, () => [r.pick(chunks)[0], r.pick(shards), r.chance(0.7) ? "committed" : "aborted"])
      : null;
    const docs = [];
    let id = idBase;
    for (let i = 0, n = r.int(8, 12); i < n; i++) {
      const [lo, hi] = r.pick(chunks);
      const k = keyIn(r, level, lo, hi);
      const shard = r.pick(shards);
      docs.push([shard, id, k]);
      if (r.chance(0.2)) docs.push([r.pick(shards.filter((s) => s !== shard)), id, k]);   // a copy on another shard
      id += r.int(1, 9);
    }
    const c = { chunks: r.shuffle(chunks), docs: r.shuffle(docs), moves };
    const got = run(c);
    if (got.length >= 2 && got.length < docs.length) return c;
  }
  throw new Error("MDB-L2-02: could not build a sample with orphans");
}

export function generate(r, level) {
  const shards = r.pick(NAMES);
  const [A, B, C] = shards;
  const idBase = r.pick([1000, 52000, 880100]);
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const c = randomCase(r, level, shards, idBase + i * 1000);
    samples.push({ args: pyArgs(c), expect: pyOut(run(c)) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  // Hand-built cases: keys are integers below Very Hard, [region, number] pairs at Very Hard.
  const K = level === 3 ? (n) => ["eu", n] : (n) => n;
  const lo = r.int(2, 5) * 100, hi = lo + r.int(2, 5) * 100;
  const three = [[null, K(lo), A], [K(lo), K(hi), B], [K(hi), null, C]];
  const id = (k) => idBase + 500 + k;
  const edges = [
    ["a key equal to a chunk's lower bound belongs to that chunk", { chunks: three, docs: [[B, id(1), K(lo)], [A, id(2), K(lo)]] }],
    ["a key equal to a chunk's upper bound belongs to the next chunk", { chunks: three, docs: [[B, id(1), K(hi)], [C, id(2), K(hi)]] }],
    ["keys in the lowest and highest chunks", { chunks: three, docs: [[A, id(1), K(-5)], [C, id(2), K(lo - 1)], [C, id(3), K(hi + 10000)], [A, id(4), K(hi + 1)]] }],
    ["a copy on two shards: only the copy on the non-owner is an orphan", { chunks: three, docs: [[B, id(1), K(lo + 1)], [C, id(1), K(lo + 1)]] }],
    ["a shard that owns no chunk holds only orphans", { chunks: [[null, K(lo), A], [K(lo), null, B]], docs: [[C, id(2), K(lo)], [C, id(1), K(1)], [A, id(3), K(1)]] }],
    ["one chunk covers every key", { chunks: [[null, null, B]], docs: [[B, id(1), K(lo)], [A, id(2), K(hi)]] }],
    ["no orphans at all", { chunks: three, docs: [[A, id(1), K(lo - 1)], [B, id(2), K(lo)], [C, id(3), K(hi)]] }],
    ["chunks listed out of order, orphans sorted by shard then id", { chunks: [three[2], three[0], three[1]], docs: [[C, id(9), K(lo)], [A, id(3), K(hi)], [C, id(1), K(lo + 1)], [A, id(2), K(lo + 1)]] }],
  ];
  if (level >= 2) {
    const docs = [[A, id(1), K(lo + 1)], [B, id(2), K(lo + 1)], [C, id(3), K(lo + 1)]];
    edges.push(["a committed migration moves ownership", { chunks: three, docs, moves: [[K(lo), C, "committed"]] }]);
    edges.push(["an aborted migration leaves ownership where it was", { chunks: three, docs, moves: [[K(lo), C, "aborted"]] }]);
    edges.push(["a chunk moved away and back again", { chunks: three, docs, moves: [[K(lo), C, "committed"], [K(lo), A, "aborted"], [K(lo), B, "committed"]] }]);
    edges.push(["the lowest chunk can migrate too", { chunks: three, docs: [[A, id(1), K(0)], [B, id(2), K(0)]], moves: [[null, B, "committed"]] }]);
    edges.push(["an empty migration log", { chunks: three, docs, moves: [] }]);
  }
  if (level === 3) {
    const t3 = [[null, ["eu", 500], A], [["eu", 500], ["na", 200], B], [["na", 200], null, C]];
    edges.push(["the first field decides before the second", { chunks: t3, docs: [[A, id(1), ["ap", 900]], [A, id(2), ["eu", 900]], [B, id(3), ["na", 100]], [B, id(4), ["sa", 1]]] }]);
    edges.push(["equal first field: the second field decides", { chunks: t3, docs: [[A, id(1), ["eu", 499]], [A, id(2), ["eu", 500]], [C, id(3), ["na", 200]], [B, id(4), ["na", 199]]] }]);
  }
  for (const [name, c] of edges) {
    if (level === 1) c.moves = null;
    else if (!c.moves) c.moves = [];
    tests.push({ name, args: pyArgs(c), expect: pyOut(run(c)) });
  }

  // Timing: compared with the reference at check time. Checking every chunk for
  // every document is about 2 billion comparisons; sorted bounds take 18 per document.
  const nChunks = 20000, nDocs = 200000, nMoves = level === 1 ? 0 : 5000, seed = r.int(1, 1_000_000);
  tests.push({
    name: `${nDocs.toLocaleString("en-US")} documents and ${nChunks.toLocaleString("en-US")} chunks in time`,
    args: `_gen_cluster(${nChunks}, ${nDocs}, ${nMoves}, ${seed}, ${level === 3 ? "True" : "False"})`,
    limit_s: 8,
  });

  return {
    vars: {
      migration_rule: level === 1
        ? "In this exercise `migrations` is None: `chunks` is already the current routing table."
        : "`chunks` is the routing table before the window. `migrations` is the window's log, in order: `(chunk_min, to_shard, outcome)`, where `chunk_min` names a chunk by its lower bound (None for the lowest chunk) and `outcome` is `'committed'` or `'aborted'`. A committed migration makes `to_shard` the chunk's owner; an aborted one changes nothing, even though it may have copied documents to `to_shard` first. Chunk bounds do not change in the window.",
      key_rule: level === 3
        ? "Shard keys are compound: a `(region, number)` tuple, and chunk bounds are tuples of the same shape. Keys compare field by field, region first, as Python compares tuples."
        : "Shard keys and chunk bounds are integers.",
    },
    samples,
    tests,
  };
}

function pyOut(pairs) {
  return "[" + pairs.map(([s, id]) => `('${s}', ${id})`).join(", ") + "]";
}
