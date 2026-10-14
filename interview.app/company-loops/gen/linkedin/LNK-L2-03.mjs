/* LNK-L2-03 — Debug the creator post analytics report (debug, Python).
   Simulated practice scenario. All data is generated from the seed; every member id,
   post id and number is hypothetical. The report is shown only to the creator it is
   about, and it holds counts, never a list of viewers.

   Contract (debug): like python, but `starter` is buggy code the candidate fixes.
   The evaluator's reference is the fixed code. expect comes from oracle() below,
   an independent JavaScript implementation of the specification in the template.
   Planted bugs (see the evaluator notes): an edited post's events keep the edit
   suffix and form a second row; the author check runs on the reshare instead of the
   original, so other members' reshares are dropped and the creator's own reshares of
   someone else's post are reported; deleted accounts are removed from unique viewers
   only; the time-zone offset is applied with the wrong sign; unique viewers are
   counted once per post instead of once per post and local day.
   level: 1 Medium (creator in UTC, reshares, no edits or deleted accounts) · 2 Hard
          (+ edited posts, a non-zero offset, events near local midnight) · 3 Very Hard
          (+ deleted accounts, negative offsets, viewers who return on later days, the
          creator's own views and reshares) */
export const kind = "debug";
export const entry = "creator_report";
export const signature = "def creator_report(creator: str, offset_min: int, posts: dict[str, dict], events: list[dict], deleted: list[str]) -> list[list]:";
export const starter = `from datetime import date, timedelta

EPOCH = date(1970, 1, 1)


def creator_report(creator, offset_min, posts, events, deleted):
    deleted = set(deleted)
    rows = {}                                   # (day, post) -> [views, unique, reactions]
    seen = set()
    for ev in events:
        member = ev["member"]
        if member == creator:
            continue
        base = ev["post"].split("#")[0]
        post = posts.get(base)
        if post is None or post["author"] != creator:
            continue
        original = post["reshare_of"] or ev["post"]
        day = (EPOCH + timedelta(days=(ev["ts"] - offset_min * 60) // 86400)).isoformat()
        row = rows.setdefault((day, original), [0, 0, 0])
        if ev["type"] == "view":
            row[0] += 1
            if member not in deleted and (original, member) not in seen:
                seen.add((original, member))
                row[1] += 1
        elif ev["type"] == "react":
            row[2] += 1
    return [[day, post, v, u, r] for (day, post), (v, u, r) in sorted(rows.items())]
`;

export const prelude = `
def _gen_creator_events(n, seed):
    x = seed
    creator = 'mbr-0001'
    posts = {}
    for i in range(400):
        x = (1103515245 * x + 12345) % 2147483648
        author = creator if i < 120 else 'mbr-%04d' % (2 + (x >> 16) % 3000)
        posts['p%04d' % i] = {'author': author, 'reshare_of': None}
    for i in range(400, 1000):
        x = (1103515245 * x + 12345) % 2147483648
        posts['p%04d' % i] = {'author': 'mbr-%04d' % (1 + (x >> 16) % 3000),
                              'reshare_of': 'p%04d' % ((x >> 8) % 400)}
    deleted = ['mbr-%04d' % i for i in range(2, 3000, 37)]
    events = []
    t = 1788220800
    for i in range(n):
        x = (1103515245 * x + 12345) % 2147483648
        t += (x >> 16) % 25
        x = (1103515245 * x + 12345) % 2147483648
        pid = 'p%04d' % ((x >> 8) % 1000)
        if (x >> 4) % 7 == 0:
            pid += '#v2'
        x = (1103515245 * x + 12345) % 2147483648
        events.append({'type': 'react' if (x >> 16) % 9 == 0 else 'view', 'post': pid,
                       'member': 'mbr-%04d' % (1 + (x >> 8) % 3000), 'ts': t})
    return creator, 330, posts, events, deleted
`.trim() + "\n";

const BASE = Date.UTC(2026, 8, 14) / 1000;          // 2026-09-14 00:00 UTC, in epoch seconds
const isoDay = (d) => new Date(d * 86400000).toISOString().slice(0, 10);

// The specification, implemented independently of the Python reference.
export function oracle(creator, offsetMin, posts, events, deleted) {
  const gone = new Set(deleted);
  const rows = new Map();          // "day|post" -> {day, post, views, viewers:Set, reactions}
  for (const e of events) {
    if (gone.has(e.member) || e.member === creator) continue;
    const id = e.post.includes("#") ? e.post.slice(0, e.post.indexOf("#")) : e.post;
    if (!(id in posts)) continue;
    const orig = posts[id].reshare_of === null ? id : posts[id].reshare_of;
    if (posts[orig].author !== creator) continue;
    const day = isoDay(Math.floor((e.ts + offsetMin * 60) / 86400));
    const k = day + "|" + orig;
    if (!rows.has(k)) rows.set(k, { day, post: orig, views: 0, viewers: new Set(), reactions: 0 });
    const row = rows.get(k);
    if (e.type === "view") { row.views++; row.viewers.add(e.member); } else if (e.type === "react") row.reactions++;
  }
  return [...rows.values()]
    .sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : a.post < b.post ? -1 : a.post > b.post ? 1 : 0))
    .map((x) => [x.day, x.post, x.views, x.viewers.size, x.reactions]);
}

function py(v) {
  if (v === null || v === undefined) return "None";
  if (typeof v === "boolean") return v ? "True" : "False";
  if (typeof v === "number") return String(v);
  if (typeof v === "string") return "'" + v + "'";
  if (Array.isArray(v)) return "[" + v.map(py).join(", ") + "]";
  return "{" + Object.entries(v).map(([k, x]) => `'${k}': ${py(x)}`).join(", ") + "}";
}
const pyArgs = (c) => "(" + [c.creator, c.offset, c.posts, c.events, c.deleted].map(py).join(", ") + ")";
const run = (c) => py(oracle(c.creator, c.offset, c.posts, c.events, c.deleted));

const OFFSETS = { 2: [330, 60, 120, 540, -300], 3: [-480, -300, -240, 330, 345, 600] };

function streamCase(r, level) {
  const creator = `mbr-${r.int(1000, 9999)}`;
  const others = Array.from({ length: 6 }, (_, i) => `mbr-${r.int(10, 99)}${i}`);
  const offset = level === 1 ? 0 : r.pick(OFFSETS[level]);
  const posts = {};
  const mine = [];
  for (let i = 0; i < r.int(2, 3); i++) {
    const id = `p-${r.int(100, 999)}${i}`;
    posts[id] = { author: creator, reshare_of: null };
    mine.push(id);
  }
  const theirs = `p-${r.int(100, 999)}9`;
  posts[theirs] = { author: others[0], reshare_of: null };
  const reshares = [];
  for (let i = 0; i < 2; i++) {
    const id = `r-${r.int(100, 999)}${i}`;
    posts[id] = { author: others[1 + i], reshare_of: r.pick(mine) };
    reshares.push(id);
  }
  if (level === 3) {                                // the creator reshares someone else's post
    const id = `r-${r.int(100, 999)}7`;
    posts[id] = { author: creator, reshare_of: theirs };
    reshares.push(id);
  }
  const deleted = level === 3 ? [others[r.int(1, 5)]] : [];
  const viewers = level === 3 ? [...others, creator] : others;
  const days = level === 1 ? 1 : 2;
  const events = [];
  let t = BASE + r.int(0, 3) * 86400;
  const n = level === 1 ? r.int(8, 11) : r.int(11, 15);
  for (let i = 0; i < n; i++) {
    t += level === 1 ? r.int(60, 4000) : r.int(600, Math.floor((days * 86400) / n));
    let post = r.chance(0.6) ? r.pick(mine) : r.chance(0.8) ? r.pick(reshares) : theirs;
    if (level >= 2 && r.chance(0.25)) post += "#v2";
    events.push({ type: r.chance(0.8) ? "view" : "react", post, member: r.pick(viewers), ts: t });
  }
  if (level >= 2) {                                 // two views either side of local midnight
    const midnight = BASE + 2 * 86400 - offset * 60;
    events.push({ type: "view", post: mine[0], member: others[2], ts: midnight - r.int(1, 900) });
    events.push({ type: "view", post: mine[0], member: others[2], ts: midnight + r.int(0, 900) });
    events.sort((a, b) => a.ts - b.ts);
  }
  return { creator, offset, posts, events, deleted };
}

export function generate(r, level) {
  const samples = [];
  for (let i = 0; i < 2; i++) {
    const c = streamCase(r, level);
    samples.push({ args: pyArgs(c), expect: run(c) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const me = `mbr-${r.int(1000, 9999)}`;
  const [u1, u2, u3, au] = [`mbr-${r.int(10, 99)}1`, `mbr-${r.int(10, 99)}2`, `mbr-${r.int(10, 99)}3`, `mbr-${r.int(10, 99)}4`];
  const P = `p-${r.int(100, 999)}1`, Q = `p-${r.int(100, 999)}2`, R = `r-${r.int(100, 999)}3`, S = `r-${r.int(100, 999)}4`;
  const posts = { [P]: { author: me, reshare_of: null }, [Q]: { author: au, reshare_of: null },
    [R]: { author: u1, reshare_of: P }, [S]: { author: me, reshare_of: Q } };
  const t0 = BASE + r.int(1, 5) * 86400 + r.int(3600, 30000);
  const v = (post, member, ts) => ({ type: "view", post, member, ts });
  const c = (offset, events, deleted = []) => ({ creator: me, offset, posts, events, deleted });
  const edges = [
    ["an edited post's events stay on the post", c(0, [v(P, u1, t0), v(P + "#v2", u2, t0 + 60), { type: "react", post: P + "#v3", member: u3, ts: t0 + 90 }])],
    ["views of another member's reshare are credited to the original post", c(0, [v(P, u1, t0), v(R, u2, t0 + 30), v(R, u3, t0 + 50)])],
    ["views of the creator's own reshare of someone else's post are not in the report", c(0, [v(P, u1, t0), v(S, u2, t0 + 30)])],
    ["events from deleted accounts are not counted at all", c(0, [v(P, u1, t0), v(P, u2, t0 + 10), { type: "react", post: P, member: u2, ts: t0 + 20 }], [u2])],
    ["a view at 20:00 UTC is on the next local day at UTC+05:30",
      c(330, [v(P, u1, BASE + 86400 + 20 * 3600), v(P, u2, BASE + 86400 + 3 * 3600)])],
    ["a view at 03:00 UTC is on the previous local day at UTC-05:00",
      c(-300, [v(P, u1, BASE + 86400 + 3 * 3600), v(P, u2, BASE + 86400 + 6 * 3600)])],
    ["a viewer who returns the next day is unique on both days", c(0, [v(P, u1, t0), v(P, u1, t0 + 600), v(P, u1, t0 + 86400)])],
    ["the creator's own views are not counted", c(0, [v(P, me, t0), v(P, u1, t0 + 5)])],
    ["a post with only reactions has a row with zero views", c(0, [{ type: "react", post: P, member: u1, ts: t0 }])],
    ["an edited reshare is still credited to the original", c(0, [v(R + "#v2", u2, t0), v(P, u2, t0 + 40)])],
  ];
  for (const [name, cs] of edges) tests.push({ name, args: pyArgs(cs), expect: run(cs) });

  const n = level === 1 ? 100000 : 200000;
  tests.push({ name: `${n.toLocaleString("en-US")} events in time`, args: `_gen_creator_events(${n}, ${r.int(1, 1_000_000)})`, limit_s: 8 });

  return {
    vars: {
      replay_rule: level === 1
        ? "This replay covers one creator in UTC with original posts and reshares; the checks also cover edits, time zones and deleted accounts."
        : level === 2
          ? "This replay covers a creator outside UTC, edited posts, reshares, and views close to local midnight."
          : "This replay covers a creator outside UTC, edited posts, reshares (including the creator's own reshare of another member's post), deleted accounts, the creator's own views, and viewers who come back on later days.",
    },
    samples,
    tests,
  };
}
