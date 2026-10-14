/* MSF-L2-03 — Debug the meeting attendance report (debug, Python).
   Simulated practice scenario. All data is generated from the seed.

   Contract (debug): like python, but `starter` is buggy code the candidate fixes.
   The evaluator's reference is the fixed code. expect comes from oracle() below,
   an independent JavaScript implementation of the specification in the template.
   Planted bugs (see the evaluator notes): a rejoin overwrites the first join; time
   on two devices at once is counted twice; durations are taken from the clock
   time of day, so a session across midnight goes negative; times are shown in UTC,
   not the organiser's time zone; every guest is merged into one attendee.
   Each bug has its own check that the other four bugs pass.
   level: 1 Medium (members on one device each, rejoins) · 2 Hard (+ several
          devices per person, guests) · 3 Very Hard (+ meetings across midnight,
          devices still connected at the end, stray leave events) */
export const kind = "debug";
export const entry = "attendance_report";
export const signature = "def attendance_report(meeting: dict, events: list[dict]) -> dict[str, dict]:";
export const starter = `from datetime import datetime, timezone


def _fmt(ts):
    return datetime.fromtimestamp(ts, timezone.utc).strftime("%Y-%m-%d %H:%M")


def _clock(ts):
    return ts % 86400                     # seconds since midnight


def attendance_report(meeting, events):
    first, sessions, open_at = {}, {}, {}
    for ev in events:
        key = ev["user"] or "guest"
        device = (key, ev["device"])
        if ev["type"] == "join":
            first[key] = ev["ts"]
            open_at[device] = ev["ts"]
        elif device in open_at:
            sessions.setdefault(key, []).append((open_at.pop(device), ev["ts"]))
    for (key, _), start in open_at.items():          # still connected when the meeting ended
        sessions.setdefault(key, []).append((start, meeting["end"]))
    report = {}
    for key, spans in sessions.items():
        report[key] = {
            "first_join": _fmt(first[key]),
            "last_leave": _fmt(max(end for _, end in spans)),
            "seconds": sum(_clock(end) - _clock(start) for start, end in spans),
        }
    return report
`;

export const prelude = `
def _gen_attendance(people, seed):
    x = seed
    def rnd(m):
        nonlocal x
        x = (1103515245 * x + 12345) % 2147483648
        return (x >> 16) % m
    start = 1789344000 + 23 * 3600                    # 23:00 UTC, so the meeting runs past midnight
    end = start + 4 * 3600
    timed = []
    for p in range(people):
        guest = rnd(10) == 0
        user = None if guest else 'u-%06d' % p
        name = 'Guest %d' % p if guest else 'Member %d' % p
        for device in ('desktop', 'mobile')[:1 + rnd(2)]:
            t = start + rnd(1800)
            for _ in range(1 + rnd(3)):
                timed.append((t, 1, user, name, device, 'join'))
                t += 60 + rnd(3600)
                if t >= end or rnd(5) == 0:
                    break
                timed.append((t, 0, user, name, device, 'leave'))
                t += 30 + rnd(900)
                if t >= end:
                    break
    timed.sort(key=lambda e: (e[0], e[1]))
    events = [{'ts': t, 'type': kind, 'user': user, 'name': name, 'device': device}
              for t, _, user, name, device, kind in timed]
    return {'id': 'mtg-all-hands', 'start': start, 'end': end, 'tz_offset_min': -480}, events
`.trim() + "\n";

const fmt = (ts, off) => new Date((ts + off * 60) * 1000).toISOString().slice(0, 16).replace("T", " ");

// The specification, implemented independently of the Python reference.
export function oracle(meeting, events) {
  const keyOf = (e) => (e.user === null ? "guest:" + e.name : e.user);
  const open = new Map();                  // key \u0000 device -> join ts
  const spans = new Map();                 // key -> [[start, end]]
  const first = new Map();
  const add = (k, a, b) => { if (!spans.has(k)) spans.set(k, []); spans.get(k).push([a, b]); };
  for (const e of events) {
    const k = keyOf(e), dk = k + "\u0000" + e.device;
    if (e.type === "join") {
      if (!first.has(k) || e.ts < first.get(k)) first.set(k, e.ts);
      open.set(dk, e.ts);
    } else if (open.has(dk)) {
      add(k, open.get(dk), e.ts);
      open.delete(dk);
    }
  }
  for (const [dk, a] of open) add(dk.split("\u0000")[0], a, meeting.end);
  const out = {};
  for (const k of [...spans.keys()].sort()) {
    // Union length by sweeping second boundaries: count each second covered by any session.
    const pts = [];
    for (const [a, b] of spans.get(k)) { pts.push([a, 1]); pts.push([b, -1]); }
    pts.sort((x, y) => x[0] - y[0] || y[1] - x[1]);
    let depth = 0, prev = null, secs = 0;
    for (const [t, d] of pts) {
      if (depth > 0) secs += t - prev;
      depth += d;
      prev = t;
    }
    out[k] = {
      first_join: fmt(first.get(k), meeting.tz_offset_min),
      last_leave: fmt(Math.max(...spans.get(k).map((s) => s[1])), meeting.tz_offset_min),
      seconds: secs,
    };
  }
  return out;
}

function py(v) {
  if (v === null || v === undefined) return "None";
  if (typeof v === "number") return String(v);
  if (typeof v === "string") return "'" + v.replace(/'/g, "\\'") + "'";
  if (Array.isArray(v)) return "[" + v.map(py).join(", ") + "]";
  return "{" + Object.entries(v).map(([k, x]) => `'${k}': ${py(x)}`).join(", ") + "}";
}
const pyArgs = (meeting, events) => "(" + py(meeting) + ", " + py(events) + ")";

const DAY0 = 1789344000;                    // 2026-09-14 00:00 UTC
const OFFSETS = [-480, -420, -300, -240, 60, 120, 330, 540, 600];
const FIRST = ["Ana", "Bo", "Chen", "Dara", "Eli", "Femi", "Gita", "Hugo", "Ines", "Jae", "Kofi", "Lena", "Mo", "Noor", "Omar", "Pia"];
const LAST = ["Alvarez", "Brandt", "Costa", "Dube", "Eriksen", "Fong", "Ghosh", "Haas", "Ito", "Juarez", "Kim", "Lund", "Moreau", "Nakamura", "Okafor"];
const DEVICES = ["desktop", "web", "mobile", "room"];
const ev = (ts, type, user, name, device) => ({ ts, type, user, name, device });

function meetingCase(r, level) {
  const off = r.pick(OFFSETS);
  const dur = r.int(30, 90) * 60;
  let start;
  if (level === 3 && r.chance(0.7)) {
    // Crosses midnight in UTC or in the organiser's local time.
    const localMidnight = r.chance(0.5);
    const base = DAY0 + r.int(1, 20) * 86400;
    start = localMidnight ? base - off * 60 - r.int(10, dur / 60 - 10) * 60 : base - r.int(10, dur / 60 - 10) * 60;
  } else {
    // A daytime meeting in both UTC and local time: local 08:00–16:00, and the UTC day unchanged.
    for (;;) {
      const localMin = r.int(8 * 60, 16 * 60);
      start = DAY0 + r.int(1, 20) * 86400 + localMin * 60 - off * 60;
      const s = start % 86400, e = (start + dur) % 86400;
      if (e > s) break;
    }
  }
  start -= start % 60;
  const meeting = { id: "mtg-" + r.int(1000, 9999), start, end: start + dur, tz_offset_min: off };
  const n = level === 1 ? r.int(2, 4) : r.int(3, 5);
  const people = [];
  const usedNames = new Set();
  for (let i = 0; i < n; i++) {
    let name;
    do name = r.pick(FIRST) + " " + r.pick(LAST); while (usedNames.has(name));
    usedNames.add(name);
    const guest = level >= 2 && r.chance(0.35);
    people.push({ user: guest ? null : "u-" + r.int(10000, 99999), name });
  }
  const events = [];
  for (const p of people) {
    const devs = level === 1 ? [r.pick(DEVICES)] : r.sample(DEVICES, r.chance(0.5) ? 2 : 1);
    for (const dev of devs) {
      let t = start + r.int(0, 8) * 60 + r.int(0, 59);
      const visits = r.int(1, level === 1 ? 2 : 3);
      for (let v = 0; v < visits; v++) {
        events.push(ev(t, "join", p.user, p.name, dev));
        t += r.int(4, Math.max(5, Math.floor(dur / 60 / visits))) * 60 + r.int(0, 59);
        if (t >= meeting.end - 60) {
          if (level === 3 && r.chance(0.5)) break;             // still connected at the end
          t = meeting.end - r.int(1, 59);
        }
        events.push(ev(t, "leave", p.user, p.name, dev));
        t += r.int(1, 10) * 60;
        if (t >= meeting.end - 120) break;
      }
    }
  }
  if (level === 3 && r.chance(0.6)) {
    const p = r.pick(people);
    events.push(ev(start + r.int(1, dur - 1), "leave", p.user, p.name, "phone-dial-in"));   // a leave with no join
  }
  events.sort((a, b) => a.ts - b.ts || (a.type === b.type ? 0 : a.type === "leave" ? -1 : 1));
  return { meeting, events };
}

export function generate(r, level) {
  const samples = [];
  for (let i = 0; i < 2; i++) {
    const { meeting, events } = meetingCase(r, level);
    samples.push({ args: pyArgs(meeting, events), expect: py(oracle(meeting, events)) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const day = DAY0 + r.int(1, 20) * 86400;
  const U = "u-" + r.int(10000, 99999), N = r.pick(FIRST) + " " + r.pick(LAST);
  const [G1, G2] = r.sample(FIRST, 2).map((f) => f + " " + r.pick(LAST));
  const m = (start, mins, off) => ({ id: "mtg-" + r.int(1000, 9999), start, end: start + mins * 60, tz_offset_min: off });
  const at = (h, min) => day + h * 3600 + min * 60;
  const a = r.int(5, 15), b = r.int(20, 35);
  const westOff = r.pick([-480, -420, -300]);
  const edges = [];
  {
    const mt = m(at(14, 0), 60, 0);
    edges.push(["a person who leaves and rejoins keeps their first join time", mt,
      [ev(at(14, 1), "join", U, N, "desktop"), ev(at(14, a), "leave", U, N, "desktop"), ev(at(14, b), "join", U, N, "desktop"), ev(at(14, 50), "leave", U, N, "desktop")]]);
  }
  {
    const mt = m(at(15, 0), 60, 0);
    edges.push(["time on two devices at once counts once", mt,
      [ev(at(15, 2), "join", U, N, "desktop"), ev(at(15, 2), "join", U, N, "mobile"), ev(at(15, b), "leave", U, N, "mobile"), ev(at(15, 45), "leave", U, N, "desktop")]]);
  }
  {
    const mt = m(at(23, 30), 60, 0);
    edges.push(["a session across midnight has a positive duration", mt,
      [ev(at(23, 30 + r.int(0, 10)), "join", U, N, "web"), ev(at(24, r.int(5, 25)), "leave", U, N, "web")]]);
  }
  {
    const mt = m(at(17, 0), 45, westOff);
    edges.push(["times are shown in the organiser's time zone", mt,
      [ev(at(17, 1), "join", U, N, "desktop"), ev(at(17, 40), "leave", U, N, "desktop")]]);
  }
  {
    const mt = m(at(20, 0), 30, 330);
    edges.push(["an organiser ahead of UTC sees the next local date", mt,
      [ev(at(20, 3), "join", U, N, "room"), ev(at(20, 28), "leave", U, N, "room")]]);
  }
  {
    const mt = m(at(10, 0), 60, 0);
    edges.push(["two guests are two attendees", mt,
      [ev(at(10, 1), "join", null, G1, "web"), ev(at(10, a), "leave", null, G1, "web"), ev(at(10, b), "join", null, G2, "web"), ev(at(10, 55), "leave", null, G2, "web")]]);
  }
  {
    const mt = m(at(11, 0), 30, 0);
    edges.push(["a device still connected at the end counts until the meeting ends", mt,
      [ev(at(11, 4), "join", U, N, "desktop")]]);
  }
  {
    const mt = m(at(12, 0), 30, 0);
    edges.push(["a leave with no join is ignored", mt,
      [ev(at(12, 2), "join", U, N, "desktop"), ev(at(12, 5), "leave", U, N, "mobile"), ev(at(12, 20), "leave", U, N, "desktop")]]);
  }
  {
    const mt = m(at(13, 0), 60, 0);
    edges.push(["a member and a guest with the same name are different attendees", mt,
      [ev(at(13, 1), "join", U, N, "desktop"), ev(at(13, 1), "join", null, N, "web"), ev(at(13, 30), "leave", null, N, "web"), ev(at(13, 40), "leave", U, N, "desktop")]]);
  }
  for (const [name, meeting, events] of edges) tests.push({ name, args: pyArgs(meeting, events), expect: py(oracle(meeting, events)) });

  tests.push({ name: "about 120,000 events for 25,000 people in time", args: `_gen_attendance(25000, ${r.int(1, 1_000_000)})`, limit_s: 8 });

  return {
    vars: {
      replay_rule: level === 1
        ? "This replay covers members who each use one device and sometimes leave and rejoin; the checks also include several devices, guests and meetings across midnight."
        : level === 2
          ? "This replay covers members and guests, rejoins, and people connected from more than one device at once."
          : "This replay covers members and guests on several devices, meetings that run past midnight in UTC or in the organiser's time zone, devices still connected when the meeting ends, and stray leave events.",
    },
    samples,
    tests,
  };
}
