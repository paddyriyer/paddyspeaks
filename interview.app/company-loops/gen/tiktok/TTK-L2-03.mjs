/* TTK-L2-03 — Debug the regional sound availability check (debug, Python).
   Simulated practice scenario. All data is generated from the seed.

   Contract (debug): like python, but `starter` is buggy code the candidate fixes.
   The evaluator's reference is the fixed code. expect comes from oracle() below, an
   independent JavaScript implementation of the specification in the template (it
   compares local calendar dates as strings; the reference compares timestamps).
   Planted bugs (see the evaluator notes): the end date is treated as inclusive;
   region groups are not expanded to their countries; licence dates are cut at
   midnight UTC instead of local midnight; a sound licensed only in the future is
   reported muted instead of blocked; a renewal overwrites the earlier licence.
   level: 1 Medium (countries named directly, one licence per sound and country)
          · 2 Hard (+ region groups) · 3 Very Hard (+ renewals after a gap,
          back-to-back renewals and open-ended licences) */
export const kind = "debug";
export const entry = "sound_status";
export const signature = "def sound_status(licences: list[dict], groups: dict[str, list[str]], offsets: dict[str, int], checks: list[tuple[str, str, int]]) -> list[str]:";
export const starter = `from datetime import datetime, timezone

DAY = 86400


def _midnight(day):
    """'YYYY-MM-DD' -> Unix seconds at 00:00 on that date."""
    return int(datetime.fromisoformat(day).replace(tzinfo=timezone.utc).timestamp())


def _countries(regions, groups):
    """The countries a licence names, directly or through a region group."""
    return set(regions)


def sound_status(licences, groups, offsets, checks):
    windows = {}                     # (sound, country) -> (start, end) in Unix seconds
    for lic in licences:
        start = _midnight(lic["start"])
        end = _midnight(lic["end"]) + DAY if lic["end"] else None     # through the end date
        for country in _countries(lic["regions"], groups):
            windows[(lic["sound"], country)] = (start, end)
    out = []
    for sound, country, ts in checks:
        w = windows.get((sound, country))
        if w is None:
            out.append("blocked")
        elif w[0] <= ts and (w[1] is None or ts < w[1]):
            out.append("available")
        else:
            out.append("muted")
    return out
`;

export const prelude = `
from datetime import datetime as _dt, timezone as _tz


def _gen_catalogue(n_sounds, n_checks, seed):
    x = seed

    def nxt():
        nonlocal x
        x = (1103515245 * x + 12345) % 2147483648
        return x >> 8
    offsets = {'BR': -180, 'AR': -180, 'CO': -300, 'MX': -360, 'GB': 0, 'IE': 0, 'DE': 60, 'FR': 60,
               'SE': 60, 'NO': 60, 'DK': 60, 'FI': 120, 'IN': 330, 'JP': 540, 'KR': 540, 'AU': 600, 'NZ': 780}
    groups = {'NORDICS': ['SE', 'NO', 'DK', 'FI'], 'LATAM': ['BR', 'AR', 'CO', 'MX'],
              'APAC': ['IN', 'JP', 'KR', 'AU', 'NZ'], 'WEUR': ['GB', 'IE', 'DE', 'FR']}
    names = sorted(offsets) + sorted(groups)
    countries = sorted(offsets)
    base = 1767225600                       # 2026-01-01 00:00 UTC
    licences = []
    for k in range(n_sounds):
        sound = 'snd_%05d' % k
        day = nxt() % 200
        for _ in range(1 + nxt() % 3):
            length = 10 + nxt() % 120
            start = _dt.fromtimestamp(base + day * 86400, _tz.utc).date().isoformat()
            end = _dt.fromtimestamp(base + (day + length) * 86400, _tz.utc).date().isoformat()
            regions = [names[nxt() % len(names)] for _ in range(1 + nxt() % 3)]
            licences.append({'sound': sound, 'regions': regions, 'start': start,
                             'end': None if nxt() % 6 == 0 else end})
            day += length + nxt() % 40
    checks = []
    for _ in range(n_checks):
        checks.append(('snd_%05d' % (nxt() % (n_sounds + 50)), countries[nxt() % len(countries)],
                       base + nxt() % (400 * 86400)))
    return licences, groups, offsets, checks
`.trim() + "\n";

const BASE = Date.UTC(2026, 0, 1) / 1000;
const dateOf = (sec) => new Date(sec * 1000).toISOString().slice(0, 10);
const localDate = (ts, off) => dateOf(ts + off * 60);
const dayNo = (iso) => Math.round((Date.parse(iso + "T00:00:00Z") / 1000 - BASE) / 86400);

// The specification, implemented on local calendar dates (independent of the reference).
export function oracle(licences, groups, offsets, checks) {
  const byKey = new Map();
  for (const lic of licences) {
    const cs = new Set();
    for (const g of lic.regions) for (const c of groups[g] || [g]) cs.add(c);
    for (const c of cs) {
      const k = lic.sound + "|" + c;
      if (!byKey.has(k)) byKey.set(k, []);
      byKey.get(k).push(lic);
    }
  }
  return checks.map(([sound, country, ts]) => {
    const day = localDate(ts, offsets[country]);
    const ls = byKey.get(sound + "|" + country) || [];
    if (ls.some((l) => l.start <= day && (l.end === null || day < l.end))) return "available";
    if (ls.some((l) => l.start <= day)) return "muted";                 // licensed before, now lapsed
    return "blocked";
  });
}

function py(v) {
  if (v === null || v === undefined) return "None";
  if (typeof v === "number") return String(v);
  if (typeof v === "string") return "'" + v + "'";
  if (Array.isArray(v)) return "[" + v.map(py).join(", ") + "]";
  return "{" + Object.entries(v).map(([k, x]) => `'${k}': ${py(x)}`).join(", ") + "}";
}
const pyChecks = (cs) => "[" + cs.map(([s, c, t]) => `('${s}', '${c}', ${t})`).join(", ") + "]";
const pyArgs = (c) => `(${py(c.licences)}, ${py(c.groups)}, ${py(c.offsets)}, ${pyChecks(c.checks)})`;
const run = (c) => oracle(c.licences, c.groups, c.offsets, c.checks);

const OFFSETS = { BR: -180, MX: -360, GB: 0, DE: 60, SE: 60, NO: 60, DK: 60, FI: 120, IN: 330, JP: 540, KR: 540, AU: 600, NZ: 780 };
const GROUPS = { NORDICS: ["SE", "NO", "DK", "FI"], APAC: ["IN", "JP", "KR", "AU", "NZ"], LATAM: ["BR", "MX"] };
const COUNTRIES = Object.keys(OFFSETS);

function randomCase(r, level) {
  for (let attempt = 0; attempt < 80; attempt++) {
    const sounds = r.sample(["snd_rain", "snd_drums", "snd_choir", "snd_synth", "snd_waves", "snd_brass"], r.int(2, 3));
    const licences = [];
    for (const sound of sounds) {
      let day = r.int(5, 60);
      const regions = level === 1
        ? r.sample(COUNTRIES, r.int(1, 3))
        : r.sample([...COUNTRIES, ...Object.keys(GROUPS)], r.int(1, 3));
      const n = level === 3 ? r.int(1, 3) : 1;
      for (let k = 0; k < n; k++) {
        const len = r.int(10, 60);
        const open = level === 3 && k === n - 1 && r.chance(0.3);
        licences.push({ sound, regions, start: dateOf(BASE + day * 86400), end: open ? null : dateOf(BASE + (day + len) * 86400) });
        day += len + (r.chance(0.4) ? 0 : r.int(5, 30));                        // back to back, or after a gap
      }
    }
    const checks = [];
    for (let i = 0; i < r.int(8, 11); i++) {
      const lic = r.pick(licences);
      const edge = r.pick([lic.start, lic.end || lic.start]);
      const cs = new Set();
      for (const g of lic.regions) for (const c of GROUPS[g] || [g]) cs.add(c);
      const country = r.chance(0.8) ? r.pick([...cs]) : r.pick(COUNTRIES);
      // Near a boundary (within a day either side), or anywhere in the year.
      const ts = r.chance(0.6)
        ? BASE + dayNo(edge) * 86400 + r.pick([-1, 1]) * 60 * r.int(10, 1400)
        : BASE + 86400 * r.int(0, 220) + r.int(0, 86399);
      checks.push([r.chance(0.08) ? "snd_unknown" : lic.sound, country, ts]);
    }
    const offsets = Object.fromEntries(COUNTRIES.map((c) => [c, OFFSETS[c]]));
    const c = { licences: r.shuffle(licences), groups: level === 1 ? {} : GROUPS, offsets, checks };
    const got = run(c);
    if (new Set(got).size >= 2) return c;
  }
  throw new Error("TTK-L2-03: could not build a varied sample");
}

export function generate(r, level) {
  const samples = [];
  for (let i = 0; i < 2; i++) {
    const c = randomCase(r, level);
    samples.push({ args: pyArgs(c), expect: py(run(c)) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const snd = r.pick(["snd_lofi", "snd_anthem", "snd_strings", "snd_beat"]);
  const at = (iso, hh, mm = 0) => Date.parse(iso + "T00:00:00Z") / 1000 + hh * 3600 + mm * 60;   // a UTC time
  const L = (regions, start, end) => ({ sound: snd, regions, start, end });
  const case_ = (licences, checks) => ({ licences, groups: GROUPS, offsets: OFFSETS, checks });
  const mo = r.int(3, 7), m2 = String(mo).padStart(2, "0"), m3 = String(mo + 3).padStart(2, "0");
  const S = `2026-${m2}-01`, E = `2026-${m3}-01`;          // a three-month licence
  const mid = `2026-${m2}-15`;
  const edges = [
    ["the end date itself is no longer covered",
      case_([L(["BR"], S, E)], [[snd, "BR", at(E, 15)]])],
    ["the last day before the end date is covered",
      case_([L(["BR"], S, E)], [[snd, "BR", at(`2026-${String(mo + 2).padStart(2, "0")}-28`, 15)]])],
    ["a country inside a region group is covered",
      case_([L(["NORDICS"], S, E)], [[snd, "SE", at(mid, 12)], [snd, "GB", at(mid, 12)]])],
    ["local midnight east of UTC starts the licence before UTC midnight",
      case_([L(["JP"], S, E)], [[snd, "JP", at(S, -4)]])],
    ["local midnight west of UTC ends the licence after UTC midnight",
      case_([L(["MX"], S, E)], [[snd, "MX", at(E, 3)]])],
    ["a sound licensed only from a future date is blocked, not muted",
      case_([L(["GB"], E, null)], [[snd, "GB", at(mid, 12)]])],
    ["a sound whose licence has ended is muted",
      case_([L(["GB"], S, E)], [[snd, "GB", at(`2026-${String(mo + 4).padStart(2, "0")}-10`, 12)]])],
    ["the first licence still counts after a renewal is added",
      case_([L(["DE"], S, `2026-${String(mo + 1).padStart(2, "0")}-01`), L(["DE"], E, null)], [[snd, "DE", at(mid, 12)]])],
    ["the gap between a licence and its renewal is muted, the renewal is available",
      case_([L(["DE"], S, `2026-${String(mo + 1).padStart(2, "0")}-01`), L(["DE"], E, null)],
        [[snd, "DE", at(`2026-${String(mo + 2).padStart(2, "0")}-10`, 12)], [snd, "DE", at(`2026-${m3}-20`, 12)]])],
    ["a back-to-back renewal has no gap",
      case_([L(["GB"], S, E), L(["GB"], E, null)], [[snd, "GB", at(E, 0)]])],
    ["a sound with no licence anywhere, and a country named twice",
      case_([L(["FI", "NORDICS"], S, E)], [["snd_unlisted", "FI", at(mid, 12)], [snd, "FI", at(mid, 12)]])],
  ];
  for (const [name, c] of edges) tests.push({ name, args: pyArgs(c), expect: py(run(c)) });

  const n = level === 1 ? 100000 : 200000;
  tests.push({ name: `${n.toLocaleString("en-US")} checks against 20,000 sounds in time`, args: `_gen_catalogue(20000, ${n}, ${r.int(1, 1_000_000)})`, limit_s: 8 });

  return {
    vars: {
      replay_rule: level === 1
        ? "This replay names countries directly, with one licence per sound and country; the checks also include region groups, renewals and other time zones."
        : level === 2
          ? "This replay names countries and region groups, with one licence per sound and country; the checks also include renewals after a gap and back-to-back renewals."
          : "This replay names countries and region groups, and includes renewals after a gap, back-to-back renewals and open-ended licences.",
    },
    samples,
    tests,
  };
}
