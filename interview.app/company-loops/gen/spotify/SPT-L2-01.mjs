/* SPT-L2-01 — Play queue edits: the final order after many play-next, add-to-queue,
   remove, move and advance operations (Python).
   Simulated practice scenario. All data is generated from the seed. The queue rules
   are this exercise's rules, not a description of any real player.

   Contract (python): entry, signature, starter, prelude, generate(r, level) ->
     { vars, samples: [{args, expect}], tests: [{name, args, expect?, limit_s?}] }.
   expect comes from oracle() below: a plain array that is searched and spliced on
   every operation, with each entry's part ("queued" or "context") stored beside it.
   The evaluator's reference is a doubly linked list over dicts with a sentinel
   between the two parts, written independently; both were also checked against a
   third (list.index) implementation on random sessions.
   level: 1 Medium (play next, add, remove, advance)
          · 2 Hard (+ moves, entries moving between the two parts)
          · 3 Very Hard (+ moves and removes of entries that already left the queue,
            moves after the entry itself, advancing past the end) */
export const kind = "python";
export const entry = "apply_queue";
export const signature = "def apply_queue(context: list[str], ops: list[tuple]) -> tuple[str | None, list[str]]:";
export const starter = `def apply_queue(context, ops):
    """context: entry ids from the playlist or album, in play order.
    ops: ('next', e) | ('add', e) | ('remove', e) | ('move', e, after_or_None) | ('advance',)
    Return (now_playing or None, [entry ids in queue order])."""
    ...
`;

export const prelude = `
def _gen_queue_session(n_context, n_ops, seed, moves=True):
    x = seed
    def rnd(m):
        nonlocal x
        x = (1103515245 * x + 12345) % 2147483648
        return (x >> 4) % m
    context = ['c%d' % i for i in range(n_context)]
    seen = list(context)
    ops, k = [], 0
    for _ in range(n_ops):
        r = rnd(100)
        if r < 22:
            ops.append(('next', 'q%d' % k)); seen.append('q%d' % k); k += 1
        elif r < 44:
            ops.append(('add', 'q%d' % k)); seen.append('q%d' % k); k += 1
        elif r < 64 or (not moves and r < 94):
            ops.append(('remove', seen[rnd(len(seen))]))
        elif r < 94:
            ops.append(('move', seen[rnd(len(seen))], None if rnd(8) == 0 else seen[rnd(len(seen))]))
        else:
            ops.append(('advance',))
    return context, ops
`.trim() + "\n";

// The specification, applied literally to an array of {id, part}.
export function oracle(context, ops) {
  const q = context.map((id) => ({ id, part: "context" }));
  let playing = null;
  const at = (id) => q.findIndex((x) => x.id === id);
  for (const op of ops) {
    const [k, e, after] = op;
    if (k === "next") q.unshift({ id: e, part: "queued" });
    else if (k === "add") {
      const i = q.findIndex((x) => x.part === "context");
      q.splice(i === -1 ? q.length : i, 0, { id: e, part: "queued" });
    } else if (k === "remove") {
      const i = at(e);
      if (i !== -1) q.splice(i, 1);
    } else if (k === "move") {
      const i = at(e);
      if (i === -1 || after === e) continue;
      if (after !== null && at(after) === -1) continue;
      q.splice(i, 1);
      if (after === null) q.unshift({ id: e, part: "queued" });
      else {
        const j = at(after);
        q.splice(j + 1, 0, { id: e, part: q[j].part });
      }
    } else {
      playing = q.length ? q.shift().id : null;
    }
  }
  return [playing, q.map((x) => x.id)];
}

const s = (v) => (v === null ? "None" : `'${v}'`);
const pyOp = (op) => (op.length === 1 ? `('${op[0]}',)` : `(${op.map(s).join(", ")})`);
const pyArgs = (context, ops) => `([${context.map(s).join(", ")}], [${ops.map(pyOp).join(", ")}])`;
const pyOut = ([p, q]) => `(${s(p)}, [${q.map(s).join(", ")}])`;

function randomCase(r, level) {
  for (let attempt = 0; attempt < 100; attempt++) {
    const nc = level === 1 ? r.int(3, 5) : r.int(3, 6);
    const context = Array.from({ length: nc }, (_, i) => "c" + (i + 1));
    const seen = context.slice();
    const gone = [];
    const ops = [];
    let k = 0;
    const nops = level === 1 ? r.int(8, 11) : level === 2 ? r.int(10, 13) : r.int(12, 15);
    for (let i = 0; i < nops; i++) {
      const roll = r.next();
      if (roll < 0.22) { const e = "q" + ++k; ops.push(["next", e]); seen.push(e); }
      else if (roll < 0.45) { const e = "q" + ++k; ops.push(["add", e]); seen.push(e); }
      else if (roll < (level === 1 ? 0.75 : 0.58)) {
        const e = level === 3 && gone.length && r.chance(0.3) ? r.pick(gone) : r.pick(seen);
        ops.push(["remove", e]); gone.push(e);
      } else if (level >= 2 && roll < 0.85) {
        const e = level === 3 && gone.length && r.chance(0.2) ? r.pick(gone) : r.pick(seen);
        let after = r.chance(0.15) ? null : r.pick(seen);
        if (level === 3 && r.chance(0.1)) after = e;
        ops.push(["move", e, after]);
      } else ops.push(["advance"]);
    }
    const got = oracle(context, ops);
    const kinds = new Set(ops.map((o) => o[0]));
    if (got[1].length >= 2 && kinds.has("add") && kinds.has("next") && (level === 1 || kinds.has("move"))) return { context, ops, got };
  }
  throw new Error("SPT-L2-01: could not build a sample");
}

export function generate(r, level) {
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const c = randomCase(r, level);
    samples.push({ args: pyArgs(c.context, c.ops), expect: pyOut(c.got) });
  }
  const tests = samples.map((x, i) => ({ name: "sample " + (i + 1), args: x.args, expect: x.expect }));

  const n = r.int(2, 4);
  const ctx = Array.from({ length: n }, (_, i) => "c" + (i + 1));
  const last = ctx[n - 1];
  const edges = [
    ["play next twice: the later one plays first", ctx, [["next", "q1"], ["next", "q2"]]],
    ["add to queue goes after earlier queued entries and before the context", ctx, [["next", "q1"], ["add", "q2"], ["add", "q3"]]],
    ["add with nothing queued goes in front of the context", ctx, [["add", "q1"]]],
    ["advance plays queued entries before the context", ctx, [["add", "q1"], ["add", "q2"], ["advance"]]],
    ["advance with an empty queue stops playback", [], [["add", "q1"], ["advance"], ["advance"]]],
    ["removing an entry that already played changes nothing", ctx, [["advance"], ["remove", "c1"]]],
    ["once the queued part has played, add starts it again in front of the context", ctx, [["add", "q1"], ["advance"], ["advance"], ["add", "q2"]]],
    ["removing the last context entry, then adding, puts the entry at the end", ["c1"], [["remove", "c1"], ["add", "q1"], ["next", "q2"]]],
  ];
  if (level >= 2) {
    edges.push(["a context entry moved to the front joins the queued part", ctx, [["move", last, null], ["add", "q1"]]]);
    edges.push(["an entry moved after a context entry joins the context part", ctx, [["add", "q1"], ["add", "q2"], ["move", "q1", "c1"], ["add", "q3"]]]);
    edges.push(["an entry moved after the last queued entry is queued", ctx, [["add", "q1"], ["add", "q2"], ["move", last, "q2"], ["add", "q3"]]]);
    edges.push(["moving an entry after the entry just before it changes nothing", ctx, [["add", "q1"], ["add", "q2"], ["move", "q2", "q1"]]]);
  }
  if (level === 3) {
    edges.push(["moving an entry after itself changes nothing", ctx, [["add", "q1"], ["add", "q2"], ["move", "q1", "q1"]]]);
    edges.push(["moving after an entry that was removed changes nothing", ctx, [["add", "q1"], ["remove", "c1"], ["move", "q1", "c1"]]]);
    edges.push(["moving an entry that already played changes nothing", ctx, [["next", "q1"], ["advance"], ["move", "q1", last]]]);
    edges.push(["advancing past the end, then queueing again", ["c1"], [["advance"], ["advance"], ["next", "q1"], ["move", "q1", null]]]);
  }
  for (const [name, c, ops] of edges) tests.push({ name, args: pyArgs(c, ops), expect: pyOut(oracle(c, ops)) });

  tests.push({
    name: "150,000 context entries and 150,000 edits (constant work per edit, not list.index)",
    args: `_gen_queue_session(150000, 150000, ${r.int(1, 1_000_000)}, ${level === 1 ? "False" : "True"})`,
    limit_s: 8,
  });

  return {
    vars: {
      op_rule: level === 1
        ? "In this session the listener uses play next, add to queue, remove and skip (`advance`); your function must still accept `move`, though none appears here."
        : level === 2
          ? "In this session the listener also drags entries around the queue with `move`."
          : "In this session the listener also uses `move`, and some removes and moves name entries that have already played or been removed, or name the entry itself as the place to move after.",
    },
    samples,
    tests,
  };
}
