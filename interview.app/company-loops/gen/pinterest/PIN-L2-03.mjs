/* PIN-L2-03 — Debug the pin engagement rollup (debug, Python).
   Simulated practice scenario. All data is generated from the seed.

   Contract (debug): like python, but `starter` is buggy code the candidate fixes.
   The evaluator's reference is the fixed code. expect comes from oracle() below,
   an independent JavaScript implementation of the specification in the template
   (weeks computed from day numbers, not from Python's datetime).
   Planted bugs (see the evaluator notes): repins credited one hop up instead of to
   the original pin; saves to group boards dropped along with secret ones; the
   deleted check made on the event's pin instead of the original; video watch time in
   milliseconds compared with a threshold in seconds; weeks cut in a fixed UTC-8
   offset instead of UTC.
   level: 1 Medium (static pins, repins one hop deep) · 2 Hard (+ video pins, group
          boards, repins of repins) · 3 Very Hard (+ deleted pins and events in the
          first hours of a Monday, UTC) */
export const kind = "debug";
export const entry = "weekly_engagement";
export const signature = "def weekly_engagement(events: list[dict], pins: dict[str, dict]) -> dict[str, dict[str, int]]:";
export const starter = `from datetime import datetime, timedelta, timezone

MIN_VIEW_SECONDS = 2            # a video view counts after 2 seconds watched
REPORT_TZ_OFFSET = -8 * 3600    # shift timestamps before cutting weeks


def _original(pins, pin):
    origin = pins[pin]["origin"]
    return origin if origin is not None else pin


def _week(ts):
    day = datetime.fromtimestamp(ts + REPORT_TZ_OFFSET, timezone.utc).date()
    return (day - timedelta(days=day.weekday())).isoformat()


def weekly_engagement(events, pins):
    rows = {}
    for ev in events:
        if ev["pin"] not in pins or pins[ev["pin"]]["deleted"]:
            continue
        root = _original(pins, ev["pin"])
        t = ev["type"]
        metric = None
        if t == "impression":
            metric = "impressions"
        elif t == "save":
            if ev["board"] == "public":
                metric = "saves"
        elif t == "closeup":
            if pins[root]["format"] == "static":
                metric = "views"
        elif t == "video_view":
            if pins[root]["format"] == "video" and ev["watched_ms"] >= MIN_VIEW_SECONDS:
                metric = "views"
        if metric:
            key = root + "|" + _week(ev["ts"])
            row = rows.setdefault(key, {"impressions": 0, "saves": 0, "views": 0})
            row[metric] += 1
    return rows
`;

export const prelude = `
def _gen_engagement(n_events, n_pins, seed, start=1788739200):
    x = seed

    def nxt():
        nonlocal x
        x = (1103515245 * x + 12345) % 2147483648
        return x >> 8
    pins, ids = {}, []
    for i in range(n_pins):
        pid = 'pin_%06d' % (i * 7 + 11)
        origin = ids[nxt() % len(ids)] if ids and nxt() % 100 < 55 else None
        fmt = pins[origin]['format'] if origin else ('video' if nxt() % 100 < 30 else 'static')
        pins[pid] = {'origin': origin, 'format': fmt, 'deleted': nxt() % 100 < 3}
        ids.append(pid)
    kinds = ['impression'] * 6 + ['closeup', 'closeup', 'save', 'video_view']
    boards = ['public', 'public', 'group', 'secret']
    events = []
    for _ in range(n_events):
        ev = {'type': kinds[nxt() % 10], 'pin': ids[nxt() % n_pins], 'ts': start + nxt() % (35 * 86400)}
        if ev['type'] == 'save':
            ev['board'] = boards[nxt() % 4]
        elif ev['type'] == 'video_view':
            ev['watched_ms'] = nxt() % 9000
        events.append(ev)
    return events, pins
`.trim() + "\n";

// The specification, implemented independently of the Python reference.
function weekOf(ts) {
  const day = Math.floor(ts / 86400);
  const monday = day - ((day + 3) % 7);           // 1970-01-01 was a Thursday
  return new Date(monday * 86400000).toISOString().slice(0, 10);
}
export function oracle(events, pins) {
  const out = {};
  const original = (p) => { while (pins[p].origin !== null) p = pins[p].origin; return p; };
  for (const e of events) {
    if (!(e.pin in pins)) continue;
    const root = original(e.pin);
    if (pins[root].deleted) continue;
    const fmt = pins[root].format;
    let metric = null;
    if (e.type === "impression") metric = "impressions";
    else if (e.type === "save" && e.board !== "secret") metric = "saves";
    else if (e.type === "closeup" && fmt === "static") metric = "views";
    else if (e.type === "video_view" && fmt === "video" && e.watched_ms >= 2000) metric = "views";
    if (!metric) continue;
    const k = root + "|" + weekOf(e.ts);
    if (!out[k]) out[k] = { impressions: 0, saves: 0, views: 0 };
    out[k][metric]++;
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
const pyArgs = (events, pins) => "(" + py(events) + ", " + py(pins) + ")";

const MONDAYS = [1788739200, 1789344000, 1789948800, 1790553600, 1791158400];   // 2026-09-07 … 2026-10-05

function streamCase(r, level) {
  for (let attempt = 0; attempt < 60; attempt++) {
    const base = r.int(100, 899) * 10;
    const pins = {};
    const ids = [];
    const nOrig = r.int(2, 3);
    for (let i = 0; i < nOrig; i++) {
      const id = `pin_${base + i}`;
      pins[id] = { origin: null, format: level >= 2 && r.chance(0.5) ? "video" : "static", deleted: level === 3 && r.chance(0.2) };
      ids.push(id);
    }
    const depth = level === 1 ? 1 : level === 2 ? 2 : 3;
    for (let i = 0; i < r.int(2, 4); i++) {
      const parent = r.pick(ids);
      let d = 0;
      for (let p = parent; pins[p].origin !== null; p = pins[p].origin) d++;
      if (d + 1 > depth) continue;
      const id = `pin_${base + 50 + i}`;
      pins[id] = { origin: parent, format: pins[parent].format, deleted: level === 3 && r.chance(0.25) };
      ids.push(id);
    }
    const weeks = r.sample(MONDAYS, 2);
    const events = [];
    for (let i = 0; i < r.int(9, 13); i++) {
      const pin = r.pick(ids);
      const fmt = pins[pin].format;
      const roll = r.next();
      const monday = r.pick(weeks);
      // Hours 9..23 of any day, except that Very Hard data also uses Monday 00:00–08:59 UTC.
      const ts = level === 3 && r.chance(0.2) ? monday + r.int(0, 8 * 3600 + 3599) : monday + r.int(0, 6) * 86400 + r.int(9 * 3600, 86399);
      if (roll < 0.35) events.push({ type: "impression", pin, ts });
      else if (roll < 0.6) events.push({ type: "save", pin, ts, board: level === 1 ? r.pick(["public", "public", "secret"]) : r.pick(["public", "group", "secret"]) });
      else if (fmt === "video") events.push({ type: "video_view", pin, ts, watched_ms: r.pick([r.int(200, 1999), r.int(2000, 9000), 2000]) });
      else events.push({ type: "closeup", pin, ts });
    }
    const got = oracle(events, pins);
    if (Object.keys(got).length >= 2) return [events, pins];
  }
  throw new Error("PIN-L2-03: could not build a sample with two rows");
}

export function generate(r, level) {
  const samples = [];
  for (let i = 0; i < 2; i++) {
    const [ev, pins] = streamCase(r, level);
    samples.push({ args: pyArgs(ev, pins), expect: py(oracle(ev, pins)) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const b = r.int(100, 899) * 10;
  const O = `pin_${b}`, R1 = `pin_${b + 1}`, R2 = `pin_${b + 2}`, V = `pin_${b + 5}`;
  const W = r.pick(MONDAYS);
  const mid = W + r.int(1, 3) * 86400 + r.int(10, 20) * 3600;          // Tuesday to Thursday, daytime
  const st = (deleted = false) => ({ origin: null, format: "static", deleted });
  const rp = (origin, deleted = false) => ({ origin, format: "static", deleted });
  const imp = (pin, ts = mid) => ({ type: "impression", pin, ts });
  const edges = [
    ["impressions and a closeup on one static pin",
      [[imp(O), imp(O, mid + 60), { type: "closeup", pin: O, ts: mid + 90 }], { [O]: st() }]],
    ["a repin's events are credited to the original pin",
      [[imp(R1), { type: "save", pin: R1, ts: mid + 5, board: "public" }], { [O]: st(), [R1]: rp(O) }]],
    ["a repin of a repin is credited to the original, not the middle pin",
      [[imp(R2), { type: "save", pin: R2, ts: mid + 5, board: "public" }], { [O]: st(), [R1]: rp(O), [R2]: rp(R1) }]],
    ["a save to a secret board is not counted",
      [[imp(O), { type: "save", pin: O, ts: mid + 5, board: "secret" }], { [O]: st() }]],
    ["a save to a group board is counted",
      [[imp(O), { type: "save", pin: O, ts: mid + 5, board: "group" }, { type: "save", pin: O, ts: mid + 9, board: "public" }], { [O]: st() }]],
    ["a deleted repin's events still count for its original",
      [[imp(R1), { type: "save", pin: R1, ts: mid + 5, board: "public" }, imp(O)], { [O]: st(), [R1]: rp(O, true) }]],
    ["a deleted original has no rows, even through a live repin",
      [[imp(R1), imp(O)], { [O]: st(true), [R1]: rp(O) }]],
    ["a video view under 2 seconds is not a view",
      [[imp(V), { type: "video_view", pin: V, ts: mid + 5, watched_ms: r.int(300, 1999) }], { [V]: { origin: null, format: "video", deleted: false } }]],
    ["a video view of exactly 2 seconds counts, and a closeup on a video pin does not",
      [[{ type: "video_view", pin: V, ts: mid + 5, watched_ms: 2000 }, { type: "closeup", pin: V, ts: mid + 7 }], { [V]: { origin: null, format: "video", deleted: false } }]],
    ["an event in the first hours of Monday, UTC, belongs to that week",
      [[imp(O, W + r.int(1, 7) * 3600), imp(O, W - 86400 * 3)], { [O]: st() }]],
    ["Sunday 23:59:59 and Monday 00:00:00 UTC are different weeks",
      [[imp(O, W - 1), imp(O, W)], { [O]: st() }]],
    ["an event for a pin that is not in pins is ignored",
      [[imp(O), imp(`pin_${b + 9}`)], { [O]: st() }]],
  ];
  for (const [name, [ev, pins]] of edges) tests.push({ name, args: pyArgs(ev, pins), expect: py(oracle(ev, pins)) });

  tests.push({ name: "200,000 events over 20,000 pins in time", args: `_gen_engagement(200000, 20000, ${r.int(1, 1_000_000)})`, limit_s: 8 });

  return {
    vars: {
      replay_rule: level === 1
        ? "This replay has static pins and repins one level deep; the checks also cover the other rules."
        : level === 2
          ? "This replay has static and video pins, group and secret boards, and repins of repins."
          : "This replay has static and video pins, group and secret boards, repins several levels deep, deleted pins, and events in the first hours of a Monday (UTC).",
    },
    samples,
    tests,
  };
}
