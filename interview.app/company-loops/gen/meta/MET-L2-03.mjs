/* MET-L2-03 — Debug the feed dwell-time calculator (debug, Python).
   Simulated practice scenario. All data is generated from the seed.

   Contract (debug): like python, but `starter` is buggy code the candidate fixes.
   The evaluator's reference is the fixed code. expect comes from oracle() below,
   an independent JavaScript implementation of the specification in the template.
   Planted bugs (see the evaluator notes): events processed in arrival order instead of
   time order; backgrounding the app closes only one visible post; a repeated start
   resets an open interval; the cap is applied to the total instead of to each
   interval; viewability is judged on the total instead of on one interval.
   Each bug has a test that only it fails.
   level: 1 Medium (one post on screen at a time, small upload reorderings) ·
          2 Hard (+ batches uploaded out of order, backgrounding) ·
          3 Very Hard (+ two posts visible at once, repeated starts, ties, capped intervals) */
export const kind = "debug";
export const entry = "dwell_by_impression";
export const signature = "def dwell_by_impression(events: list[dict], min_visible_ms: int, cap_ms: int) -> dict:";
export const starter = `def dwell_by_impression(events, min_visible_ms, cap_ms):
    open_at = {}          # imp -> start of its open interval
    total = {}            # imp -> visible time so far

    def close(imp, ts):
        start = open_at.pop(imp)
        total[imp] = total.get(imp, 0) + (ts - start)

    for ev in events:
        imp, kind, ts = ev["imp"], ev["kind"], ev["ts"]
        if kind == "start":
            open_at[imp] = ts
        elif kind == "stop":
            if imp in open_at:
                close(imp, ts)
        elif kind == "background":
            if open_at:
                on_screen = max(open_at, key=open_at.get)    # the post being looked at
                close(on_screen, ts)

    end = max((ev["ts"] for ev in events), default=0)
    for imp in list(open_at):                               # still visible at the end
        close(imp, end)

    return {imp: min(t, cap_ms) for imp, t in total.items() if t >= min_visible_ms}
`;

export const prelude = `
def _gen_visibility(n, seed, base=1760000000000):
    x, out, t, i = seed, [], base, 0
    while len(out) < n:
        x = (1103515245 * x + 12345) % 2147483648
        r = (x >> 8) % 100
        imp = 'p%d' % i
        i += 1
        dur = 50 + (x >> 4) % 4000
        out.append({'imp': imp, 'kind': 'start', 'ts': t})
        if r < 5:
            out.append({'imp': imp, 'kind': 'start', 'ts': t + 20})       # a repeated start
        if r < 8:
            out.append({'imp': None, 'kind': 'background', 'ts': t + dur})
            out.append({'imp': imp, 'kind': 'start', 'ts': t + dur + 9000})
            t += 9000
        out.append({'imp': imp, 'kind': 'stop', 'ts': t + dur})
        t += dur // 2 + (x >> 16) % 300                                   # the next post overlaps a little
    x2 = seed
    for k in range(0, len(out) - 1, 2):                                   # uploads reorder neighbours
        x2 = (1103515245 * x2 + 12345) % 2147483648
        if (x2 >> 16) % 3 == 0:
            out[k], out[k + 1] = out[k + 1], out[k]
    return out
`.trim() + "\n";

// The specification, implemented independently of the Python reference.
export function oracle(events, minVisible, cap) {
  const rank = (k) => (k === "start" ? 1 : 0);              // stop and background first at a tie
  const evs = events.map((e, i) => ({ ...e, i })).sort((a, b) => a.ts - b.ts || rank(a.kind) - rank(b.kind) || a.i - b.i);
  const open = new Map();
  const spans = new Map();                                    // imp -> [lengths]
  const end = (imp, ts) => {
    if (!spans.has(imp)) spans.set(imp, []);
    spans.get(imp).push(ts - open.get(imp));
    open.delete(imp);
  };
  for (const e of evs) {
    if (e.kind === "start") { if (!open.has(e.imp)) open.set(e.imp, e.ts); }
    else if (e.kind === "stop") { if (open.has(e.imp)) end(e.imp, e.ts); }
    else if (e.kind === "background") { for (const imp of [...open.keys()]) end(imp, e.ts); }
  }
  const last = evs.length ? evs[evs.length - 1].ts : 0;
  for (const imp of [...open.keys()]) end(imp, last);
  const out = {};
  for (const [imp, ls] of spans) {
    if (Math.max(...ls) >= minVisible) out[imp] = ls.reduce((s, l) => s + Math.min(l, cap), 0);
  }
  return out;
}

function py(v) {
  if (v === null || v === undefined) return "None";
  if (typeof v === "boolean") return v ? "True" : "False";
  if (typeof v === "number") return String(v);
  if (typeof v === "string") return "'" + v + "'";
  if (Array.isArray(v)) return "[" + v.map(py).join(", ") + "]";
  return "{" + Object.entries(v).map(([k, x]) => `'${k}': ${py(x)}`).join(", ") + "}";
}
const strip = (es) => es.map(({ imp, kind, ts }) => ({ imp, kind, ts }));
const pyArgs = (events, minV, cap) => `(${py(strip(events))}, ${minV}, ${cap})`;

const ALNUM = "abcdefghjkmnpqrstuvwxyz23456789";
const rid = (r) => "imp_" + Array.from({ length: 5 }, () => r.pick(ALNUM.split(""))).join("");

// A scrolling session in time order, then reordered the way uploads reorder it.
function sessionCase(r, level, minV, cap) {
  for (let attempt = 0; attempt < 50; attempt++) {
    const evs = [];
    let t = 1760000000000 + r.int(0, 86400) * 1000;
    const nPosts = level === 1 ? r.int(3, 4) : r.int(4, 6);
    for (let p = 0; p < nPosts; p++) {
      const imp = rid(r);
      const dur = r.chance(0.3) ? r.int(50, minV - 1) : r.int(minV, level === 3 ? cap + 2000 : cap - 1);
      evs.push({ imp, kind: "start", ts: t });
      if (level === 3 && r.chance(0.3)) evs.push({ imp, kind: "start", ts: t + r.int(10, 200) });
      if (level >= 2 && r.chance(0.25)) {                     // backgrounded, then back
        const bg = t + Math.floor(dur / 2);
        evs.push({ imp: null, kind: "background", ts: bg });
        t = bg + r.int(2000, 9000);
        evs.push({ imp, kind: "start", ts: t });
      }
      evs.push({ imp, kind: "stop", ts: t + dur });
      t += level === 3 && r.chance(0.4) ? Math.floor(dur / 2) : dur + r.int(0, 400);   // overlap at Very Hard
    }
    let stream = evs;
    if (level === 1) {
      const i = r.int(0, stream.length - 2);
      stream = stream.slice(); [stream[i], stream[i + 1]] = [stream[i + 1], stream[i]];
    } else {
      const k = r.int(2, Math.max(2, Math.floor(stream.length / 2)));       // two upload batches, later one first
      stream = [...stream.slice(k), ...stream.slice(0, k)];
    }
    const out = oracle(stream, minV, cap);
    if (Object.keys(out).length) return stream;
  }
  throw new Error("MET-L2-03: could not build a sample with viewable impressions");
}

export function generate(r, level) {
  const minV = r.pick([500, 1000, 1500]);
  const cap = r.pick([10000, 20000, 30000]);
  const samples = [];
  for (let i = 0; i < 2; i++) {
    const ev = sessionCase(r, level, minV, cap);
    samples.push({ args: pyArgs(ev, minV, cap), expect: py(oracle(ev, minV, cap)) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const T = 1760000000000 + r.int(0, 86400) * 1000;
  const A = rid(r), B = rid(r), C = rid(r);
  const st = (imp, dt) => ({ imp, kind: "start", ts: T + dt });
  const sp = (imp, dt) => ({ imp, kind: "stop", ts: T + dt });
  const bg = (dt) => ({ imp: null, kind: "background", ts: T + dt });
  const half = Math.floor(minV / 2) + 10;          // two of these sum past min_visible_ms
  const big = Math.floor(cap * 0.6);               // two of these sum past cap_ms
  const edges = [
    ["a later upload batch that arrives first is put back in time order",
      [st(B, 0), sp(A, 2 * minV + 300), st(A, 300), sp(B, 4 * minV)]],
    ["backgrounding the app ends every visible post",
      [st(A, 0), st(B, 200), bg(2 * minV), st(C, 6 * minV), sp(C, 8 * minV)]],
    ["a repeated start does not restart the interval",
      [st(A, 0), st(A, half), sp(A, 2 * minV)]],
    ["the cap applies to each interval, not to the total",
      [st(A, 0), sp(A, big), st(A, big + 1000), sp(A, 2 * big + 1000)]],
    ["viewable needs one interval of min_visible_ms, not a total",
      [st(A, 0), sp(A, half), st(A, half + 500), sp(A, 2 * half + 500), st(B, 3 * half), sp(B, 3 * half + minV)]],
    ["a stop and a start at the same moment: the stop comes first",
      [st(A, 0), st(A, minV), sp(A, minV), sp(A, minV + half)]],
    ["a post still visible at the end closes at the last event",
      [st(A, 0), st(B, minV), sp(B, 3 * minV)]],
    ["a stop without a start is ignored", [sp(A, 100), st(B, 200), sp(B, 200 + minV)]],
    ["exactly min_visible_ms is viewable", [st(A, 0), sp(A, minV), st(B, minV + 10), sp(B, 2 * minV + 9)]],
  ];
  if (level === 3) {
    edges.push(["a single interval longer than the cap",
      [st(A, 0), st(B, 100), sp(A, cap + 4000), sp(B, 100 + minV)]]);
  }
  for (const [name, ev] of edges) tests.push({ name, args: pyArgs(ev, minV, cap), expect: py(oracle(ev, minV, cap)) });

  const n = level === 1 ? 100000 : 200000;
  tests.push({ name: `${n.toLocaleString("en-US")} visibility events in time (sort plus one pass)`, args: `(_gen_visibility(${n}, ${r.int(1, 1_000_000)}), ${minV}, ${cap})`, limit_s: 8 });

  return {
    vars: {
      upload_rule: level === 1
        ? "In this replay one post is on screen at a time and the batch is almost in time order; the checks also cover the cases below."
        : level === 2
          ? "The app uploads in batches, so a later batch can arrive first, and the app is sometimes sent to the background."
          : "Batches arrive out of order, the app goes to the background, two posts can be visible at once, the client sometimes repeats a start, and someone can leave a post on screen far longer than the cap.",
    },
    samples,
    tests,
  };
}
