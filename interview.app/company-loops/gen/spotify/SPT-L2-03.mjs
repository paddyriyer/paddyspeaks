/* SPT-L2-03 — Debug the artist audience report (debug, Python).
   Simulated practice scenario. All data is generated from the seed. The 30-second
   rule and the "last 28 days in the artist's time zone" window are this exercise's
   rules, not a description of how any real service counts streams.

   Contract (debug): like python, but `starter` is buggy code the candidate fixes.
   The evaluator's reference is the fixed code. expect comes from oracle() below,
   an independent JavaScript implementation of the specification in the template.
   Planted bugs (see the evaluator notes): a play of exactly 30 seconds is not
   counted; featured artists are not credited; listeners are counted once per
   device; the 28-day window is taken in UTC, not the artist's time zone; plays of
   tracks that have since been removed are dropped.
   level: 1 Medium (primary artists only in the samples, whole-hour offsets)
          · 2 Hard (+ featured artists, listeners on several devices)
          · 3 Very Hard (+ removed tracks, half-hour offsets, plays at the edges of
            the window and of the 30-second rule) */
export const kind = "debug";
export const entry = "artist_audience";
export const signature = "def artist_audience(plays: list[dict], tracks: dict, artists: dict[str, int], as_of: str) -> dict:";
export const starter = `from datetime import date

DAY = 86400


def _window(as_of):
    """The 28 days ending with as_of, as [start, end) in seconds."""
    end = (date.fromisoformat(as_of) - date(1970, 1, 1)).days * DAY + DAY
    return end - 28 * DAY, end


def artist_audience(plays, tracks, artists, as_of):
    start, end = _window(as_of)
    live = {t: info for t, info in tracks.items() if not info.get("removed")}
    streams = {a: 0 for a in artists}
    listeners = {a: set() for a in artists}
    for p in plays:
        info = live.get(p["track"])
        if info is None:
            continue
        if p["ms"] <= 30_000:
            continue
        if not (start <= p["ts"] < end):
            continue
        a = info["primary"]
        streams[a] += 1
        listeners[a].add((p["listener"], p["device"]))
    return {a: {"streams": streams[a], "listeners": len(listeners[a])} for a in artists}
`;

export const prelude = `
def _gen_audience(n, seed):
    x = seed
    def rnd(m):
        nonlocal x
        x = (1103515245 * x + 12345) % 2147483648
        return (x >> 4) % m
    offsets = [-480, -300, -180, 0, 60, 330, 540, 600]
    artists = {'ar_%03d' % i: offsets[i % 8] for i in range(300)}
    names = list(artists)
    tracks = {}
    for i in range(3000):
        primary = names[rnd(300)]
        featured = [names[rnd(300)]] if rnd(4) == 0 else []
        if featured == [primary]:
            featured = []
        tracks['tr_%04d' % i] = {'primary': primary, 'featured': featured, 'removed': rnd(20) == 0}
    tids = list(tracks)
    base = 1788220800          # 2026-09-01 00:00 UTC
    devices = ('phone', 'desktop', 'speaker', 'car', 'web')
    plays = []
    for _ in range(n):
        plays.append({'listener': 'ls_%05d' % rnd(40000), 'device': devices[rnd(5)],
                      'track': tids[rnd(3000)], 'ts': base + rnd(40 * 86400), 'ms': rnd(240000)})
    return plays, tracks, artists, '2026-10-05'
`.trim() + "\n";

const DAY = 86400;
const dayStart = (iso) => { const [y, m, d] = iso.split("-").map(Number); return Date.UTC(y, m - 1, d) / 1000; };
const isoOf = (secs) => new Date(secs * 1000).toISOString().slice(0, 10);

// The specification, implemented independently of the Python reference.
export function oracle(plays, tracks, artists, asOf) {
  const lastDay = dayStart(asOf);
  const out = {};
  const seen = {};
  for (const a of Object.keys(artists)) { out[a] = { streams: 0, listeners: 0 }; seen[a] = new Set(); }
  for (const p of plays) {
    if (p.ms < 30000) continue;
    const t = tracks[p.track];
    for (const a of [t.primary, ...t.featured]) {
      const localDay = Math.floor((p.ts + artists[a] * 60) / DAY) * DAY;     // the artist's calendar day
      const daysBack = (lastDay - localDay) / DAY;
      if (daysBack < 0 || daysBack > 27) continue;
      out[a].streams++;
      seen[a].add(p.listener);
    }
  }
  for (const a of Object.keys(out)) out[a].listeners = seen[a].size;
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
const pyArgs = (plays, tracks, artists, asOf) => `(${py(plays)}, ${py(tracks)}, ${py(artists)}, '${asOf}')`;

const ARTISTS = ["ar_lumen", "ar_harbour", "ar_velvet", "ar_northbound", "ar_saltmarsh", "ar_kiteday", "ar_orchid", "ar_basalt"];
const WHOLE = [-480, -360, -300, -240, 0, 60, 120, 480, 540, 600];
const HALF = [-210, 330, 570];
const DEVICES = ["phone", "desktop", "speaker", "car", "web"];
const AS_OF = ["2026-09-30", "2026-10-04", "2026-10-11", "2026-08-31", "2026-07-19"];

function randomCase(r, level) {
  const asOf = r.pick(AS_OF);
  const last = dayStart(asOf);
  const names = r.sample(ARTISTS, level === 1 ? 2 : 3);
  const artists = {};
  for (const a of names) artists[a] = level === 3 && r.chance(0.4) ? r.pick(HALF) : r.pick(WHOLE);
  const tracks = {};
  const nt = level === 1 ? 3 : 4;
  for (let i = 0; i < nt; i++) {
    const primary = r.pick(names);
    const featured = level >= 2 && r.chance(0.45) ? [r.pick(names.filter((a) => a !== primary))] : [];
    tracks["tr_" + r.pick("abcdefghjk".split("")) + (i + 1)] = { primary, featured, removed: level === 3 && r.chance(0.3) };
  }
  const tids = Object.keys(tracks);
  const listeners = Array.from({ length: level === 1 ? 3 : 4 }, (_, i) => "ls_" + String(r.int(100, 999)) + i);
  const plays = [];
  const n = level === 1 ? r.int(6, 8) : r.int(8, 11);
  for (let i = 0; i < n; i++) {
    let ts;
    if (level === 3 && r.chance(0.35)) {                      // close to either edge of the window
      const edge = r.chance(0.5) ? last + DAY : last - 27 * DAY;
      ts = edge + r.int(-14, 14) * 1800;
    } else ts = last - r.int(-2, 31) * DAY + r.int(0, 86399);
    const ms = level === 3 && r.chance(0.25) ? r.pick([29999, 30000, 30001]) : r.chance(0.2) ? r.int(1000, 29000) : r.int(31000, 240000);
    const device = level === 1 ? "phone" : r.pick(DEVICES);
    plays.push({ listener: r.pick(listeners), device, track: r.pick(tids), ts, ms });
  }
  return { plays, tracks, artists, asOf };
}

export function generate(r, level) {
  const samples = [];
  for (let i = 0; i < 2; i++) {
    let c, got;
    for (let k = 0; k < 50; k++) {
      c = randomCase(r, level);
      got = oracle(c.plays, c.tracks, c.artists, c.asOf);
      if (Object.values(got).some((v) => v.streams > 0)) break;
    }
    samples.push({ args: pyArgs(c.plays, c.tracks, c.artists, c.asOf), expect: py(got) });
  }
  const tests = samples.map((x, i) => ({ name: "sample " + (i + 1), args: x.args, expect: x.expect }));

  const asOf = r.pick(AS_OF);
  const last = dayStart(asOf);
  const [A, B] = r.sample(ARTISTS, 2);
  const tz = r.pick([-300, -240, 0, 60, 120]);
  const noon = (back, off) => last - back * DAY + 12 * 3600 - off * 60;   // local noon, `back` days before as_of
  const mid = r.int(5, 20);
  const one = { tr_one: { primary: A, featured: [], removed: false } };
  const P = (listener, device, track, ts, ms) => ({ listener, device, track, ts, ms });
  const east = 540, west = -300;
  const edges = [
    ["a play of exactly 30 seconds counts", [P("ls_1", "phone", "tr_one", noon(mid, tz), 30000)], one, { [A]: tz }],
    ["a play one millisecond short does not count", [P("ls_1", "phone", "tr_one", noon(mid, tz), 29999)], one, { [A]: tz }],
    ["a featured artist is credited with the stream",
      [P("ls_1", "phone", "tr_feat", noon(mid, tz), 90000)],
      { tr_feat: { primary: A, featured: [B], removed: false } }, { [A]: tz, [B]: tz }],
    ["one listener on two devices is one listener",
      [P("ls_1", "phone", "tr_one", noon(mid, tz), 90000), P("ls_1", "speaker", "tr_one", noon(mid + 1, tz), 90000)], one, { [A]: tz }],
    ["a track removed since still counts for plays that happened",
      [P("ls_1", "phone", "tr_gone", noon(mid, tz), 90000)],
      { tr_gone: { primary: A, featured: [], removed: true } }, { [A]: tz }],
    [`late evening UTC on ${isoOf(last)} is already the next day for an artist at UTC+9`,
      [P("ls_1", "phone", "tr_one", last + 20 * 3600, 90000)], one, { [A]: east }],
    [`early on ${isoOf(last + DAY)} UTC is still ${isoOf(last)} for an artist at UTC−5`,
      [P("ls_1", "phone", "tr_one", last + DAY + 3 * 3600, 90000)], one, { [A]: west }],
    ["the first second of the window's first local day counts",
      [P("ls_1", "phone", "tr_one", last - 27 * DAY - west * 60, 90000)], one, { [A]: west }],
    ["the last second before the window's first local day does not",
      [P("ls_1", "phone", "tr_one", last - 27 * DAY - west * 60 - 1, 90000)], one, { [A]: west }],
    ["an artist with no plays reports zeros",
      [P("ls_1", "phone", "tr_one", noon(mid, tz), 90000)], one, { [A]: tz, [B]: tz }],
  ];
  if (level >= 2) {
    edges.push(["one play near midnight falls inside the window for one credited artist and outside it for the other",
      [P("ls_1", "car", "tr_feat", last + DAY + 3 * 3600, 90000)],
      { tr_feat: { primary: A, featured: [B], removed: false } }, { [A]: west, [B]: east }]);
  }
  if (level === 3) {
    edges.push(["a half-hour offset moves the day boundary by half an hour",
      [P("ls_1", "web", "tr_one", last + DAY - 330 * 60 - 1, 90000), P("ls_2", "web", "tr_one", last + DAY - 330 * 60, 90000)], one, { [A]: 330 }]);
  }
  for (const [name, plays, tracks, artists] of edges) tests.push({ name, args: pyArgs(plays, tracks, artists, asOf), expect: py(oracle(plays, tracks, artists, asOf)) });

  tests.push({ name: "200,000 plays in time", args: `_gen_audience(200000, ${r.int(1, 1_000_000)})`, limit_s: 8 });

  return {
    vars: {
      report_rule: level === 1
        ? "This replay's tracks each credit one artist and every listener uses one device; the checks also cover featured artists, several devices and removed tracks."
        : level === 2
          ? "This replay includes tracks with featured artists and listeners who play on several devices."
          : "This replay includes featured artists, listeners on several devices, tracks removed since, artists at half-hour offsets, and plays close to the edges of the window and of the 30-second rule.",
    },
    samples,
    tests,
  };
}
