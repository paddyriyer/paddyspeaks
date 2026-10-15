/* TTK-L1-05 — Comment thread display order: replies nested depth first, siblings by a given
   score, deleted comments with replies kept as placeholders (Python).
   Simulated practice scenario. All data is generated from the seed; comment ids, scores and
   threads are hypothetical. The score is given as data; how it is computed is out of scope.

   Contract (python): entry, signature, starter, prelude, generate(r, level) ->
     { vars, samples: [{args, expect}], tests: [{name, args, expect?, limit_s?}] }.
   expect comes from oracle() below: recursive, and it finds each comment's replies by scanning
   every comment (brute force, small inputs only). The evaluator's reference builds a children
   index and walks it with an explicit stack; written independently.
   level: 1 Medium (rows listed by id, parents before replies; single deleted comments)
          · 2 Hard (+ chains of deleted comments above a live reply, wholly deleted subtrees,
            score ties broken by id)
          · 3 Very Hard (+ rows in any order, replies whose parent is not in the input shown at
            the top level) */
export const kind = "python";
export const entry = "thread_order";
export const signature = "def thread_order(comments: list[tuple[int, int | None, int, bool]]) -> list[tuple[int, int, bool]]:";
export const starter = `def thread_order(comments):
    """comments: (comment_id, parent_id or None, score, deleted).
    Return the thread as displayed: (comment_id, depth, placeholder) in display order.
    Replies follow their parent depth first; siblings by score descending, then comment_id.
    A deleted comment is shown as a placeholder only if a reply below it is still shown."""
    ...
`;

export const prelude = `
def _gen_thread(n, chain, seed, deleted=False, shuffle=False, orphans=False):
    x = seed
    def rnd(m):
        nonlocal x
        x = (1103515245 * x + 12345) % 2147483648
        return (x >> 16) % m
    rows, ids, cid = [], [], 10000
    def add(parent):
        nonlocal cid
        cid += 1 + rnd(3)
        rows.append((cid, parent, rnd(120) - 20, deleted and rnd(6) == 0))
        ids.append(cid)
        return cid
    for _ in range(50):
        add(None)
    last = ids[rnd(len(ids))]
    for _ in range(chain):                         # one long back-and-forth reply chain
        last = add(last)
    while len(rows) < n:
        k = rnd(20)
        if k == 0:
            add(None)
        elif orphans and k == 1:
            add(5 + rnd(5000))                     # its parent was purged: not in the input
        else:
            add(ids[rnd(len(ids))])
    if shuffle:
        for i in range(len(rows) - 1, 0, -1):
            j = rnd(i + 1)
            rows[i], rows[j] = rows[j], rows[i]
    return (rows,)
`.trim() + "\n";

// The specification, directly: a comment's replies are found by scanning every row; a comment
// is shown if it is not deleted or any reply below it is shown; walk recursively.
export function oracle(rows) {
  const ids = new Set(rows.map((c) => c[0]));
  const isRoot = (c) => c[1] === null || !ids.has(c[1]);
  const bySibling = (a, b) => b[2] - a[2] || a[0] - b[0];
  const children = (id) => rows.filter((c) => c[1] === id && !isRoot(c)).sort(bySibling);
  const out = [];
  const walk = (c, depth) => {
    const mine = [];
    for (const k of children(c[0])) mine.push(...walk(k, depth + 1));
    if (!c[3] || mine.length) return [[c[0], depth, c[3]], ...mine];
    return [];
  };
  for (const c of rows.filter(isRoot).sort(bySibling)) out.push(...walk(c, 0));
  return out;
}

const pyBool = (b) => (b ? "True" : "False");
const pyArgs = (rows) => `([${rows.map(([i, p, s, d]) => `(${i}, ${p === null ? "None" : p}, ${s}, ${pyBool(d)})`).join(", ")}],)`;
const pyOut = (xs) => `[${xs.map(([i, d, p]) => `(${i}, ${d}, ${pyBool(p)})`).join(", ")}]`;

function randomCase(r, level) {
  let id = r.int(100, 900);
  const rows = [];
  const n = r.int(9, 14);
  for (let i = 0; i < n; i++) {
    id += r.int(1, 5);
    const parent = !rows.length || r.chance(0.25) ? null : r.pick(rows)[0];
    rows.push([id, parent, r.int(-2, 6), r.chance(level === 1 ? 0.15 : 0.3)]);
  }
  if (level === 3) {
    rows.push([id + r.int(1, 5), r.int(1, 99), r.int(0, 6), false]);           // parent purged
    return r.shuffle(rows);
  }
  return rows;
}

export function generate(r, level) {
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const rows = randomCase(r, level);
    samples.push({ args: pyArgs(rows), expect: pyOut(oracle(rows)) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const b = r.int(2, 9) * 100;                  // ids in the edge cases start near b
  const v = r.int(3, 20);                        // a typical score
  const F = false, T = true;
  const edges = [
    ["a single comment", [[b, null, v, F]]],
    ["siblings by score, highest first", [[b, null, v, F], [b + 1, b, v, F], [b + 2, b, v + 5, F], [b + 3, b, v - 4, F]]],
    ["depth first: a reply's whole subtree comes before the next sibling", [[b, null, v, F], [b + 1, b, v + 2, F], [b + 2, b, v, F], [b + 3, b + 1, v, F], [b + 4, b + 3, v, F]]],
    ["a deleted reply with no replies disappears", [[b, null, v, F], [b + 1, b, v, T], [b + 2, b, v - 1, F]]],
    ["a deleted comment with a live reply stays as a placeholder", [[b, null, v, T], [b + 1, b, v, F], [b + 2, null, v - 1, F]]],
    ["top-level comments are ordered the same way, negative scores last", [[b, null, -3, F], [b + 1, null, v, F], [b + 2, null, 0, F]]],
  ];
  if (level >= 2) {
    edges.push(["deleted, deleted, then a live reply: both deleted comments are placeholders", [[b, null, v, T], [b + 1, b, v, T], [b + 2, b + 1, v, F], [b + 3, b, v + 1, T]]]);
    edges.push(["a subtree that is deleted all the way down disappears whole", [[b, null, v, F], [b + 1, b, v + 3, T], [b + 2, b + 1, v, T], [b + 3, b + 2, v, T], [b + 4, b, v, F]]]);
    edges.push(["equal scores: the lower comment_id first", [[b + 5, null, v, F], [b + 2, null, v, F], [b + 9, b + 2, 1, F], [b + 7, b + 2, 1, F]]]);
    edges.push(["a deleted top-level comment whose replies were all deleted", [[b, null, v + 9, T], [b + 1, b, v, T], [b + 2, null, v, F]]]);
  }
  if (level === 3) {
    edges.push(["replies listed before their parents", [[b + 4, b + 1, v, F], [b + 1, b, v, F], [b + 3, b, v + 1, F], [b, null, v, F]]]);
    edges.push(["a reply whose parent is not in the input is shown at the top level", [[b, null, v, F], [b + 2, b - 50, v + 1, F], [b + 3, b + 2, v, F]]]);
    edges.push(["a deleted reply of a purged parent, with a live reply below it", [[b + 2, b - 50, v, T], [b + 3, b + 2, v, F], [b, null, v + 1, F]]]);
  }
  // A reply chain deeper than Python's default recursion limit (1 000), small enough to check.
  const depth = 1200 + r.int(0, 300);
  const chain = [[b, null, v, F]];
  for (let i = 1; i < depth; i++) chain.push([b + i, b + i - 1, r.int(0, 9), level >= 2 && i % 97 === 5]);
  chain.push([b + depth, b, v, F]);
  edges.push([`a reply chain ${depth} deep (deeper than the default recursion limit)`, level === 3 ? r.shuffle(chain) : chain]);
  for (const [name, rows] of edges) tests.push({ name, args: pyArgs(rows), expect: pyOut(oracle(rows)) });

  // Timing: 100 000 comments with one reply chain 20 000 deep. Scanning every comment for each
  // comment's replies is O(n²) (about 10^10 checks); a recursive walk stops at the recursion
  // limit; a children index walked with a stack is O(n log n).
  const seed = r.int(1, 1_000_000);
  tests.push({
    name: "100,000 comments, one reply chain 20,000 deep (an index and a stack, not recursion)",
    args: level === 1 ? `_gen_thread(100000, 20000, ${seed})`
      : level === 2 ? `_gen_thread(100000, 20000, ${seed}, True)`
        : `_gen_thread(100000, 20000, ${seed}, True, True, True)`,
    limit_s: 8,
  });

  return {
    vars: {
      input_rule: level === 1
        ? "In this exercise `comments` is listed by `comment_id`, every reply's parent is listed before it, and deleted comments are rare."
        : level === 2
          ? "`comments` is listed by `comment_id` and every `parent_id` is in the input. Several deleted comments can sit above one live reply, and a deleted comment whose replies were all deleted disappears with them."
          : "`comments` arrives in any order (a reply can be listed before its parent). Retention can purge a comment completely: a reply whose `parent_id` is not in the input is shown at the top level (depth 0), ordered with the other top-level comments.",
    },
    samples,
    tests,
  };
}
