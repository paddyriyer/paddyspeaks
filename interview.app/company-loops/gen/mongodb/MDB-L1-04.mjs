/* MDB-L1-04 — TTL monitor passes: which documents each pass deletes (Python).
   Simulated practice scenario. All data is generated from the seed. The rules are this
   exercise's simplified model of a TTL index (a background pass every `period` seconds
   deletes documents whose date field plus expireAfterSeconds has passed); check current docs.

   Contract (python): entry, signature, starter, prelude, generate(r, level) ->
     { vars, samples: [{args, expect}], tests: [{name, args, expect?, limit_s?}] }.
   expect comes from oracle() below, which rescans every live document at every pass
   (fine for small inputs). The evaluator's reference uses a min-heap with lazy invalidation.
   level: 1 Medium (inserts, updates that move or remove the field, deletes, writes to
            documents TTL already removed)
          2 Hard (+ values that are not dates, an id inserted again after deletion, writes
            exactly at a pass time)
          3 Very Hard (+ a per-pass deletion cap, earliest expiry first; arrays of dates) */
export const kind = "python";
export const entry = "ttl_passes";
export const signature = "def ttl_passes(events: list[tuple[int, str, int, object]], expire_after: int, period: int, n_passes: int, cap: int | None = None) -> list[list[int]]:";
export const starter = `def ttl_passes(events, expire_after, period, n_passes, cap=None):
    """events: (t, op, doc_id, value) sorted by t; op is 'insert', 'update' or 'delete'.
    value is the document's TTL field after the write (None: the field is absent).
    Passes run at period, 2*period, ..., n_passes*period.
    Return one list per pass: the doc_ids it deleted, ascending."""
    ...
`;

export const prelude = `
def _gen_ttl(n, seed, strings=False, arrays=False):
    x = seed
    def rnd(m):
        nonlocal x
        x = (1103515245 * x + 12345) % 2147483648
        return (x >> 8) % m
    t, nxt, out = 0, 1, []
    for _ in range(n):
        t += rnd(4)
        k = rnd(100)
        if k < 55 or nxt < 10:
            if arrays and rnd(10) == 0:
                v = [t + rnd(3000), t - rnd(3000)]
            elif strings and rnd(25) == 0:
                v = 'n/a'
            else:
                v = t - rnd(600)
            out.append((t, 'insert', nxt, v))
            nxt += 1
        elif k < 85:
            d = nxt - 1 - rnd(min(nxt - 1, 50000))
            out.append((t, 'update', d, None if rnd(12) == 0 else t))
        else:
            d = nxt - 1 - rnd(min(nxt - 1, 50000))
            out.append((t, 'delete', d, None))
    return out, t
`.trim() + "\n";

function expiryOf(v, ea) {
  if (typeof v === "number") return v + ea;
  if (Array.isArray(v)) return v.length ? Math.min(...v) + ea : null;
  return null;                                   // absent, or not a date
}

// Brute force: apply the writes, then look at every live document at every pass.
export function oracle(events, ea, period, nPasses, cap) {
  const live = new Map();                        // doc_id -> expiry instant or null
  const out = [];
  let i = 0;
  for (let p = 1; p <= nPasses; p++) {
    const T = p * period;
    for (; i < events.length && events[i][0] <= T; i++) {
      const [, op, d, v] = events[i];
      if (op === "insert") live.set(d, expiryOf(v, ea));
      else if (live.has(d)) { if (op === "delete") live.delete(d); else live.set(d, expiryOf(v, ea)); }
    }
    let due = [...live.entries()].filter(([, e]) => e !== null && e <= T).sort((a, b) => a[1] - b[1] || a[0] - b[0]);
    if (cap != null) due = due.slice(0, cap);
    const gone = due.map(([d]) => d).sort((a, b) => a - b);
    for (const d of gone) live.delete(d);
    out.push(gone);
  }
  return out;
}

const pyVal = (v) => (v === null ? "None" : typeof v === "string" ? `'${v}'` : Array.isArray(v) ? "[" + v.join(", ") + "]" : String(v));
const pyArgs = (events, ea, period, np, cap) =>
  `([${events.map(([t, op, d, v]) => `(${t}, '${op}', ${d}, ${pyVal(v)})`).join(", ")}], ${ea}, ${period}, ${np}, ${cap == null ? "None" : cap})`;
const pyOut = (res) => "[" + res.map((xs) => "[" + xs.join(", ") + "]").join(", ") + "]";

function randomCase(r, level) {
  for (let attempt = 0; attempt < 100; attempt++) {
    const period = r.pick([30, 60, 120]);
    const np = r.int(4, 6);
    const ea = period * r.pick([1, 2, 3]) + r.pick([0, 0, r.int(1, period - 1)]);
    const cap = level === 3 ? r.int(1, 2) : null;
    const n = r.int(10, 16);
    const events = [];
    let t = 0, nxt = 101 + r.int(0, 50);
    const made = [];
    for (let k = 0; k < n; k++) {
      t += r.chance(0.2) ? 0 : r.int(1, Math.floor((period * np) / n) + 5);
      if (level >= 2 && r.chance(0.15)) t = Math.ceil(t / period) * period;     // exactly at a pass
      const roll = r.next();
      const value = () => {
        if (level >= 2 && r.chance(0.12)) return "n/a";
        if (level === 3 && r.chance(0.2)) return r.chance(0.2) ? [] : [t + r.int(-period, period), t + r.int(-period, period)];
        return t - r.int(0, period);
      };
      if (roll < 0.5 || made.length < 2) {
        const reuse = level >= 2 && made.length && r.chance(0.2) ? r.pick(made) : null;   // may still be live: then skip
        const d = reuse !== null && !isLive(events, reuse) ? reuse : nxt++;
        events.push([t, "insert", d, value()]);
        if (!made.includes(d)) made.push(d);
      } else if (roll < 0.85) events.push([t, "update", r.pick(made), r.chance(0.15) ? null : value()]);
      else events.push([t, "delete", r.pick(made), null]);
    }
    const res = oracle(events, ea, period, np, cap);
    const total = res.reduce((s, xs) => s + xs.length, 0);
    if (total >= 2 && res.some((xs) => xs.length === 0) && t <= period * np) return { events, ea, period, np, cap, res };
  }
  throw new Error("MDB-L1-04: could not build a sample");
}

function isLive(events, d) {
  let live = false;
  for (const [, op, id] of events) if (id === d) { if (op === "insert") live = true; else if (op === "delete") live = false; }
  return live;   // conservative: a TTL deletion is not seen here, so an id may be treated as live and not reused
}

export function generate(r, level) {
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const c = randomCase(r, level);
    samples.push({ args: pyArgs(c.events, c.ea, c.period, c.np, c.cap), expect: pyOut(c.res) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const P = r.pick([60, 100]);
  const EA = r.pick([1, 2]) * P;
  const a = 201 + r.int(0, 100), b = a + 1, c = a + 2, d = a + 3;
  const edges = [
    ["an expiry exactly at a pass time is deleted by that pass; one second later waits for the next",
      [[5, "insert", a, P - EA], [6, "insert", b, P - EA + 1]], EA, P, 2, null],
    ["an update that moves the date later saves the document from the pass",
      [[1, "insert", a, 0], [P - 1, "update", a, P], [P + 1, "insert", b, 0]], EA, P, 3, null],
    ["an update that moves the date earlier makes it expire sooner",
      [[1, "insert", a, 2 * P], [2, "update", a, 0]], EA, P, 3, null],
    ["removing the field stops expiry; setting it again restarts it",
      [[1, "insert", a, 0], [2, "update", a, null], [P + 5, "update", a, P]], EA, P, 4, null],
    ["writes to a document the TTL pass already removed change nothing",
      [[1, "insert", a, 0], [EA + P + 1, "update", a, EA + P + 1], [EA + P + 2, "delete", a, null], [EA + P + 3, "insert", b, EA + P + 3]], EA, P, Math.ceil((2 * EA + P + 3) / P), null],
    ["a document deleted by the application is never in the output",
      [[1, "insert", a, 0], [3, "insert", b, 0], [4, "delete", a, null]], EA, P, Math.ceil(EA / P) + 1, null],
    ["passes with nothing to delete return empty lists",
      [[1, "insert", a, 10 * P]], EA, P, 3, null],
  ];
  if (level >= 2) {
    edges.push(["a write at exactly a pass time happens before that pass",
      [[1, "insert", a, P - EA], [P, "update", a, P], [1, "insert", b, P - EA]].sort((x, y) => x[0] - y[0]), EA, P, 2, null]);
    edges.push(["a value that is not a date never expires",
      [[1, "insert", a, "n/a"], [2, "insert", b, P], [P + 1, "update", b, "pending"], [P + 2, "insert", c, 0]], EA, P, Math.ceil(EA / P) + 2, null]);
    edges.push(["an id inserted again after the pass removed it is a new document",
      [[1, "insert", a, 0], [EA + P + 1, "insert", a, EA + P + 1]], EA, P, Math.ceil((2 * EA + P + 1) / P) + 1, null]);
  }
  if (level === 3) {
    edges.push(["the cap takes the earliest expiries first, ties by doc_id, and leaves the rest for the next pass",
      [[1, "insert", d, -5], [2, "insert", c, -10], [3, "insert", b, -5], [4, "insert", a, -5]], EA, P, EA / P + 2, 2]);
    edges.push(["an array of dates expires by its earliest date; an empty array never expires",
      [[1, "insert", a, [3 * P, 0]], [2, "insert", b, []], [3, "insert", c, [2 * P]]], EA, P, Math.ceil((EA + 2 * P) / P) + 1, null]);
    edges.push(["an expired document that is updated while it waits behind the cap is judged on its new date",
      [[1, "insert", a, 0], [2, "insert", b, 0], [3, "insert", c, 0], [EA + 1, "update", c, 10 * P]], EA, P, EA / P + 2, 2]);
  }
  for (const [name, ev, ea, period, np, cap] of edges) tests.push({ name, args: pyArgs(ev, ea, period, np, cap), expect: pyOut(oracle(ev, ea, period, np, cap)) });

  // Timing: 200 000 writes over about 3.5 days of passes every minute, tens of thousands of
  // live documents. Rescanning every live document at every pass is far too slow.
  const seed = r.int(1, 1_000_000);
  const flags = level === 1 ? "" : level === 2 ? ", strings=True" : ", strings=True, arrays=True";
  const capArg = level === 3 ? 40 : "None";
  tests.push({
    name: "200,000 writes, about 5 000 passes (O(log n) per write, not a scan per pass)",
    args: `(lambda ev: (ev[0], 100000, 60, ev[1] // 60 + 1, ${capArg}))(_gen_ttl(200000, ${seed}${flags}))`,
    limit_s: 8,
  });

  return {
    vars: {
      value_rule: level === 1
        ? "`value` is an integer date in seconds, or None when the field is absent (an update to None removes the field)."
        : level === 2
          ? "`value` is an integer date in seconds, None when the field is absent, or a value that is not a date (a string), which never expires."
          : "`value` is an integer date in seconds, None when absent, a string (not a date, never expires), or a list of integer dates: the document expires by its earliest date, and an empty list never expires.",
      cap_rule: level === 3
        ? "`cap` limits how many documents one pass deletes: it deletes the documents with the earliest expiry instants first, ties by smaller doc_id, and the others wait for a later pass (unless a write changes them first)."
        : "`cap` is None: a pass deletes every document that is due.",
    },
    samples,
    tests,
  };
}
