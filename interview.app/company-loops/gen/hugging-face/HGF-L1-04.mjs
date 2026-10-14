/* HGF-L1-04 — Dataset viewer paging: the shard and row behind each requested page (Python).
   Simulated practice scenario. All data is generated from the seed. The conversion of a
   dataset into row shards and the viewer's paging rule are this exercise's, not a
   description of how any hub converts or serves datasets.

   Contract (python): entry, signature, starter, prelude, generate(r, level) ->
     { vars, samples: [{args, expect}], tests: [{name, args, expect?, limit_s?}] }.
   expect comes from oracle() below: for every request it walks the shards from the first,
   one row count at a time (O(q·s)). The evaluator's reference uses prefix sums and bisect,
   written independently.
   level: 1 Medium (every shard has rows; pages inside or past the end)
          2 Hard (+ empty shards anywhere, pages that cross several shards)
          3 Very Hard (+ shards not converted yet: rows at or beyond the first one are unknown) */
export const kind = "python";
export const entry = "locate_pages";
export const signature = "def locate_pages(shard_rows: list[int | None], requests: list[tuple[int, int]]) -> list[list[tuple[int, int, int]] | None]:";
export const starter = `def locate_pages(shard_rows, requests):
    """shard_rows: rows in each converted shard, in order (None = not converted yet).
    requests: (offset, length) pages of global row numbers.
    For each request return [(shard_index, first_row_in_shard, n_rows), ...],
    [] past the end, or None when the page needs rows that are not known yet."""
    ...
`;

export const prelude = `
def _gen_case(n_shards, n_req, seed, zero_every=0, none_at=-1, max_len=200):
    x = seed
    def rnd(m):
        nonlocal x
        x = (1103515245 * x + 12345) % 2147483648
        return (x >> 8) % m
    shards = []
    for i in range(n_shards):
        if i == none_at:
            shards.append(None)
        elif zero_every and rnd(zero_every) == 0:
            shards.append(0)
        else:
            shards.append(1 + rnd(9999))
    total = sum(n for n in shards if n)
    reqs = [(rnd(total + 50), 1 + rnd(max_len)) for _ in range(n_req)]
    return shards, reqs
`.trim() + "\n";

// The specification, walked literally for every request.
export function oracle(shards, requests) {
  let complete = true, usable = [];
  for (const n of shards) { if (n === null) { complete = false; break; } usable.push(n); }
  const total = usable.reduce((a, b) => a + b, 0);
  return requests.map(([off, len]) => {
    let end = off + len;
    if (!complete && end > total) return null;
    if (end > total) end = total;
    const segs = [];
    let start = 0;
    for (let i = 0; i < usable.length; i++) {
      const lo = Math.max(off, start), hi = Math.min(end, start + usable[i]);
      if (hi > lo) segs.push([i, lo - start, hi - lo]);
      start += usable[i];
    }
    return segs;
  });
}

const pyOut = (res) => "[" + res.map((s) => (s === null ? "None" : "[" + s.map((t) => `(${t.join(", ")})`).join(", ") + "]")).join(", ") + "]";
const pyArgs = (shards, reqs) => `([${shards.map((n) => (n === null ? "None" : n)).join(", ")}], [${reqs.map(([a, b]) => `(${a}, ${b})`).join(", ")}])`;

function randomCase(r, level) {
  const n = r.int(4, 7);
  const shards = Array.from({ length: n }, () => (level >= 2 && r.chance(0.25) ? 0 : r.int(1, 12)));
  if (level === 3 && r.chance(0.7)) shards[r.int(2, n - 1)] = null;
  let total = 0;
  for (const s of shards) { if (s === null) break; total += s; }
  const reqs = [];
  for (let k = 0; k < r.int(4, 6); k++) reqs.push([r.int(0, total + 3), r.int(1, level === 1 ? 6 : 15)]);
  return { shards, reqs };
}

export function generate(r, level) {
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const c = randomCase(r, level);
    samples.push({ args: pyArgs(c.shards, c.reqs), expect: pyOut(oracle(c.shards, c.reqs)) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const a = r.int(5, 9), b = r.int(3, 8), c = r.int(4, 10);
  const base = [a, b, c];
  const total = a + b + c;
  const edges = [
    ["a page that ends exactly at a shard boundary has no empty segment after it", base, [[0, a]]],
    ["a page that starts exactly at a shard boundary starts at row 0 of the next shard", base, [[a, 2]]],
    ["a page that crosses one boundary", base, [[a - 1, 2]]],
    ["a page that runs past the last row is cut at the end", base, [[total - 1, 5]]],
    ["an offset equal to the row count is past the end", base, [[total, 1], [total + 7, 3]]],
    ["a page that covers every shard", base, [[0, total + 10]]],
  ];
  if (level >= 2) {
    edges.push(["empty shards are skipped and never appear in a segment", [0, a, 0, 0, b, 0], [[a - 1, 2], [0, a + b]]]);
    edges.push(["a dataset whose shards are all empty", [0, 0, 0], [[0, 1], [3, 2]]]);
    edges.push(["a page that spans several whole shards", [a, 1, 1, 0, 1, b], [[a - 1, 5]]]);
  }
  if (level === 3) {
    edges.push(["a page that ends exactly where the converted rows end is known", [a, b, null, c], [[0, a + b], [a, b]]]);
    edges.push(["one row beyond the converted rows is not known yet", [a, b, null, c], [[a, b + 1], [a + b, 1]]]);
    edges.push(["shards after an unconverted one cannot be located, even if converted", [a, null, b, c], [[a + 1, 1], [a - 1, 1]]]);
    edges.push(["the first shard not converted", [null, a, b], [[0, 1]]]);
  }
  for (const [name, shards, reqs] of edges) tests.push({ name, args: pyArgs(shards, reqs), expect: pyOut(oracle(shards, reqs)) });

  // Timing: 30 000 shards and 80 000 page requests. Prefix sums + bisect is
  // O(s + q log s); walking the shards from the first for every request is O(q·s).
  const zero = level === 1 ? 0 : 10;
  const noneAt = level === 3 ? 24000 : -1;
  tests.push({
    name: "30,000 shards, 80,000 page requests (prefix sums and bisect, not a walk per request)",
    args: `_gen_case(30000, 80000, ${r.int(1, 1_000_000)}, ${zero}, ${noneAt})`,
    limit_s: 8,
  });

  return {
    vars: {
      data_rule: level === 1
        ? "In this dataset every shard has at least one row and every shard has been converted."
        : level === 2
          ? "Some shards are empty (0 rows); they never appear in a segment. Every shard has been converted."
          : "Some shards are empty, and conversion may still be running: a shard that is not converted yet is `None`.",
    },
    samples,
    tests,
  };
}
