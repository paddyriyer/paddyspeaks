/* LNK-L1-02 — Company page follower growth per week (SQL).
   Simulated practice scenario. All data is generated from the seed; pages, members and
   counts are hypothetical. The output is a per-page aggregate a page admin would see,
   never a list of followers.

   Contract: see docs/COMPANY-INTERVIEW-LOOPS.md § Executable templates (sql).
   level: 1 Medium (unfollow-then-refollow within 7 days dropped; every week of the window
            reported; pages below a follower floor at the end of the window excluded)
          2 Hard (+ refollows exactly 7 days and 7 days + 1 second after the unfollow,
            pairs that straddle a week boundary, events in the first and last second of a
            week, a page that starts above the floor and ends below it)
          3 Very Hard (+ the same event delivered twice, repeated unfollow/refollow cycles,
            a page that ends exactly at the floor) */
import { insertSQL } from "../../js/rng.js";

export const kind = "sql";

const DAY = 86400;
const WEEK = 7 * DAY;
const MONDAYS = ["2026-08-31", "2026-09-07", "2026-09-14", "2026-09-21"];
const NAMES = ["Acme Robotics", "Bluebird Health", "Cobalt Analytics", "Delta Freight", "Evergreen Learning",
  "Fjord Energy", "Granite Software", "Harbor Finance", "Indigo Studio", "Juniper Labs"];
const fmt = (s) => new Date(s * 1000).toISOString().replace("T", " ").slice(0, 19) + "+00";
const dateOf = (s) => new Date(s * 1000).toISOString().slice(0, 10);

export function generate(r, level) {
  const firstWeek = r.pick(MONDAYS);
  const weeks = level === 1 ? 3 : 4;
  const W0 = Date.parse(firstWeek + "T00:00:00Z") / 1000;
  const W1 = W0 + weeks * WEEK;                                   // exclusive end
  const floor = r.pick([50, 100, 150, 200]);
  const nPages = level === 1 ? 4 : 5;
  const names = r.sample(NAMES, nPages);
  let pid = r.int(1000, 9000);
  let mid = r.int(300000, 900000);

  const pages = [];
  const events = [];            // {page, member, type, at}
  for (let p = 0; p < nPages; p++) {
    const page = { id: (pid += r.int(3, 40)), name: names[p], start: 0 };
    pages.push(page);
    const actors = r.int(6, level === 1 ? 9 : 12);
    let baseline = 0;
    for (let a = 0; a < actors; a++) {
      const member = (mid += r.int(1, 500));
      let following = r.chance(0.4);
      if (following) baseline++;
      const nEv = r.int(1, level === 3 ? 4 : 3);
      let t = W0 + r.int(0, Math.floor((W1 - W0) / 2));
      for (let k = 0; k < nEv && t < W1; k++) {
        const type = following ? "unfollow" : "follow";
        events.push({ page: page.id, member, type, at: t });
        following = !following;
        // Gap to the next event: after an unfollow, sometimes a quick refollow.
        let gap;
        if (type === "unfollow") {
          const opts = [r.int(60, 6 * DAY), r.int(7 * DAY + 2, 15 * DAY)];
          if (level >= 2) opts.push(7 * DAY, 7 * DAY + 1);
          gap = r.pick(opts);
        } else gap = r.int(3600, 10 * DAY);
        t += gap;
      }
    }
    page.start = baseline;      // members not in the event log are added below
  }
  const addPair = (page, member, uAt, gap) => {
    events.push({ page, member, type: "unfollow", at: uAt });
    events.push({ page, member, type: "follow", at: uAt + gap });
    return 1;                   // one baseline follower
  };
  // Every level: a quick unfollow-and-refollow, collapsed.
  const extra = new Map(pages.map((p) => [p.id, 0]));
  {
    const p = r.pick(pages);
    extra.set(p.id, extra.get(p.id) + addPair(p.id, (mid += r.int(1, 500)), W0 + r.int(DAY, 5 * DAY), r.int(3600, 2 * DAY)));
  }
  if (level >= 2) {
    // An unfollow late on a Sunday and a refollow on Monday: collapsed, so neither week moves.
    const p1 = r.pick(pages);
    const sunday = W0 + WEEK - r.int(1, 3 * 3600);
    extra.set(p1.id, extra.get(p1.id) + addPair(p1.id, (mid += r.int(1, 500)), sunday, r.int(2 * 3600, 3 * DAY)));
    // Exactly 7 days (collapsed) and 7 days + 1 second (both count).
    const p2 = r.pick(pages);
    extra.set(p2.id, extra.get(p2.id) + addPair(p2.id, (mid += r.int(1, 500)), W0 + r.int(0, WEEK), 7 * DAY));
    extra.set(p2.id, extra.get(p2.id) + addPair(p2.id, (mid += r.int(1, 500)), W0 + r.int(0, WEEK), 7 * DAY + 1));
    // Follows in the first and last second of a week.
    const p3 = r.pick(pages);
    events.push({ page: p3.id, member: (mid += r.int(1, 500)), type: "follow", at: W0 + WEEK - 1 });
    events.push({ page: p3.id, member: (mid += r.int(1, 500)), type: "follow", at: W0 + WEEK });
  }
  if (level === 3) {
    // Two quick cycles in a row by one member: all four events collapse.
    const p = r.pick(pages), m = (mid += r.int(1, 500));
    const t = W0 + r.int(DAY, 6 * DAY);
    extra.set(p.id, extra.get(p.id) + addPair(p.id, m, t, r.int(3600, DAY)));
    addPair(p.id, m, t + 2 * DAY, r.int(3600, DAY));
    // The same follow delivered twice (same page, member, type and time; new event id).
    const dup = r.pick(events.filter((e) => e.type === "follow"));
    events.push({ ...dup });
  }

  // Follower counts at the start: the event log's baseline plus members who never acted.
  const net = new Map(pages.map((p) => [p.id, 0]));
  const seen = new Set();
  for (const e of events) {
    const k = [e.page, e.member, e.type, e.at].join("|");
    if (seen.has(k)) continue;                       // a duplicate delivery is one event
    seen.add(k);
    net.set(e.page, net.get(e.page) + (e.type === "follow" ? 1 : -1));
  }
  const order = r.shuffle(pages);
  order.forEach((p, i) => {
    p.start += extra.get(p.id);
    const n = net.get(p.id);
    let end;
    if (i === 0) end = floor + r.int(20, 3 * floor);                    // comfortably above
    else if (i === 1) end = floor - r.int(1, Math.floor(floor / 2));     // below
    else if (i === 2 && level >= 2 && n < 0) end = floor - 1;            // starts at or above, ends just below
    else if (i === 3 && level === 3) end = floor;                        // exactly at the floor
    else end = r.int(Math.floor(floor / 2), 3 * floor);
    const others = Math.max(0, end - n - p.start);
    p.start += others;
  });
  // Hard+: make sure some page starts at or above the floor and ends below it.
  if (level >= 2 && !pages.some((p) => p.start >= floor && p.start + net.get(p.id) < floor)) {
    const p = order[4];
    const k = Math.max(1, net.get(p.id) + 1);           // enough unfollows to end below the floor
    for (let i = 0; i < k; i++) {
      events.push({ page: p.id, member: (mid += r.int(1, 500)), type: "unfollow", at: W0 + r.int(DAY, (weeks - 1) * WEEK) });
    }
    net.set(p.id, net.get(p.id) - k);
    p.start = floor;            // starts at the floor, ends below it
  }

  const evs = events.filter((e) => e.at >= W0 && e.at < W1);
  const ids = r.shuffle(evs.map((_, i) => i));
  const base = r.int(1_000_000, 9_000_000);
  evs.forEach((e, i) => { e.id = base + ids[i] * 3 + r.int(0, 2); });

  // Oracle, from the rows.
  const cmp = (x, y) => (x < y ? -1 : x > y ? 1 : 0);
  const weekOf = (s) => dateOf(W0 + Math.floor((s - W0) / WEEK) * WEEK);
  const weekList = Array.from({ length: weeks }, (_, i) => dateOf(W0 + i * WEEK));
  const solve = (o = {}) => {
    let list = evs.map((e) => ({ ...e }));
    if (!o.keepDup) {
      const s = new Set();
      list = list.filter((e) => { const k = [e.page, e.member, e.type, e.at].join("|"); if (s.has(k)) return false; s.add(k); return true; });
    }
    const byPM = new Map();
    for (const e of list) {
      const k = e.page + "|" + e.member;
      if (!byPM.has(k)) byPM.set(k, []);
      byPM.get(k).push(e);
    }
    const drop = new Set();
    if (!o.noCollapse) for (const seq of byPM.values()) {
      seq.sort((a, b) => a.at - b.at || a.id - b.id);
      for (let i = 0; i + 1 < seq.length; i++) {
        const a = seq[i], b = seq[i + 1];
        if (a.type === "unfollow" && b.type === "follow" && (o.exclusive ? b.at - a.at < 7 * DAY : b.at - a.at <= 7 * DAY)) { drop.add(a); drop.add(b); }
      }
    }
    const endCount = (p) => p.start + list.filter((e) => e.page === p.id).reduce((s, e) => s + (e.type === "follow" ? 1 : -1), 0);
    const eligible = pages.filter((p) => (o.floorAtStart ? p.start : endCount(p)) >= floor).map((p) => p.id).sort((a, b) => a - b);
    const out = [];
    for (const pg of eligible) for (const w of weekList) {
      const inWeek = list.filter((e) => e.page === pg && !drop.has(e) && weekOf(e.at) === w);
      const f = inWeek.filter((e) => e.type === "follow").length, u = inWeek.length - f;
      if (o.noSpine && !inWeek.length) continue;
      out.push([pg, w, f, u, f - u]);
    }
    return out;
  };
  const expected = solve();

  const diagnostics = [
    { message: "Unfollow-then-refollow pairs were not collapsed. A refollow within 7 days of the same member's unfollow cancels both events.", rows: solve({ noCollapse: true }) },
    { message: "Weeks with no counted events were left out. Every week of the window is reported for each page, with zeros.", rows: solve({ noSpine: true }) },
  ];
  if (level >= 2) {
    diagnostics.push({ message: "The 7-day bound was exclusive. A refollow exactly 7 days after the unfollow is still collapsed.", rows: solve({ exclusive: true }) });
    diagnostics.push({ message: "The floor was applied to the count at the start of the window. It applies to the follower count at the end.", rows: solve({ floorAtStart: true }) });
  }
  if (level === 3) diagnostics.push({ message: "Duplicate deliveries of the same event were counted twice. Rows with the same page, member, type and time are one event.", rows: solve({ keepDup: true }) });

  const pCols = ["page_id", "page_name", "followers_at_start"];
  const pRows = pages.slice().sort((a, b) => a.id - b.id).map((p) => [p.id, p.name, p.start]);
  const eCols = ["event_id", "page_id", "member_id", "event_type", "event_at"];
  const eRows = evs.slice().sort((a, b) => a.id - b.id).map((e) => [e.id, e.page, e.member, e.type, fmt(e.at)]);
  const setup =
    "SET TIME ZONE 'UTC';\n" +
    "CREATE TABLE pages (\n  page_id BIGINT PRIMARY KEY,\n  page_name TEXT NOT NULL,\n  followers_at_start INT NOT NULL\n);\n" +
    "CREATE TABLE follow_events (\n  event_id BIGINT PRIMARY KEY,\n  page_id BIGINT NOT NULL REFERENCES pages(page_id),\n  member_id BIGINT NOT NULL,\n  event_type TEXT NOT NULL CHECK (event_type IN ('follow', 'unfollow')),\n  event_at TIMESTAMPTZ NOT NULL\n);\n" +
    insertSQL("pages", pCols, pRows) + insertSQL("follow_events", eCols, eRows);

  return {
    vars: {
      first_week: firstWeek,
      weeks,
      min_followers: floor,
      event_rows: eRows.length,
      dup_rule: level === 3
        ? "The event log is delivered at least once: the same event can appear twice with different `event_id`s. Rows with the same `page_id`, `member_id`, `event_type` and `event_at` are one event."
        : "Each event appears once in this sample.",
    },
    setup,
    tables: [
      { name: "pages", columns: pCols, rows: pRows },
      { name: "follow_events", columns: eCols, rows: eRows },
    ],
    expected: { columns: ["page_id", "week_start", "follows", "unfollows", "net_new"], rows: expected },
    diagnostics: diagnostics.filter((d) => JSON.stringify(d.rows) !== JSON.stringify(expected)),
  };
}
