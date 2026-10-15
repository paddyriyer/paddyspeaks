/* TTK-L1-03 — LIVE minutes and gifts per creator-day in the creator's time zone (SQL).
   Simulated practice scenario. All data is generated from the seed; creators, sessions, gift
   values in coins and reversals are hypothetical. Gift rules are this exercise's, not any
   product's; viewers do not appear in the data at all.

   Contract: see docs/COMPANY-INTERVIEW-LOOPS.md § Executable templates (sql).
   level: 1 Medium (local dates from each creator's time zone; a session that crosses local
            midnight split at midnight; reversed gifts excluded)
          2 Hard (+ a half-hour time zone; a session ending exactly at local midnight adds no
            row for the next day; a reversal logged twice; a creator-day whose gifts were all
            reversed)
          3 Very Hard (+ sessions still live at the report cutoff, ended_at NULL, counted up to
            the cutoff and split at midnight too) */
import { insertSQL, ts } from "../../js/rng.js";

export const kind = "sql";

const EPOCH = "2026-01-01";
const DAY = 86400, H = 3600, M = 60;
const D0 = 277 * DAY;                                         // 2026-10-05 00:00 UTC
// UTC offsets in force on 2026-10-04 .. 2026-10-11 (no daylight-saving change in that span).
const ZONES = [
  ["America/Los_Angeles", -7 * H], ["America/New_York", -4 * H], ["America/Sao_Paulo", -3 * H],
  ["Europe/London", 1 * H], ["Europe/Berlin", 2 * H], ["Asia/Jakarta", 7 * H], ["Asia/Tokyo", 9 * H],
];
const KOLKATA = ["Asia/Kolkata", 5 * H + 30 * M];

function addDays(day, n) {
  const d = new Date(Date.UTC(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10) + n));
  return d.toISOString().slice(0, 10);
}
const stamp = (t) => ts(addDays(EPOCH, Math.floor(t / DAY)), ((t % DAY) + DAY) % DAY);
const dayIdx = (t) => Math.floor(t / DAY);

export function generate(r, level) {
  const nCreators = 2 + level;
  let zones = r.sample(ZONES, nCreators);
  if (level >= 2) zones[r.int(0, nCreators - 1)] = KOLKATA;
  const ids = r.sample(Array.from({ length: 40 }, (_, i) => "cr_" + (300 + 23 * i)), nCreators).sort();
  const creators = ids.map((id, i) => ({ id, tz: zones[i][0], off: zones[i][1] }));
  const sessions = [];                                        // {id, c, s, e (null = still live)}
  const gifts = [];                                           // {id, sess, t, coins}
  const reversals = [];                                       // {gift, t}
  let sNo = 4000 + r.int(0, 900), gNo = 60000 + r.int(0, 9000);
  const COINS = [1, 1, 5, 10, 30, 99, 199, 500];
  const newSession = (c, s, e) => { const x = { id: "ls_" + (sNo += r.int(1, 9)), c, s, e }; sessions.push(x); return x; };
  const gift = (sess, t, coins = r.pick(COINS)) => { const g = { id: "g_" + (gNo += r.int(1, 13)), sess, t, coins }; gifts.push(g); return g; };
  const localMidnight = (c, day) => D0 + day * DAY - c.off;   // UTC instant of local 00:00 on D0 + day

  // Random sessions on 5–7 October (UTC), in whole minutes, never overlapping per creator.
  for (const c of creators) {
    let t = D0 + r.int(0, 360) * M;
    for (let k = r.int(2, 3); k > 0; k--) {
      const dur = r.int(20, 240) * M;
      newSession(c, t, t + dur);
      t += dur + r.int(30, 300) * M;
    }
  }
  // The report runs one to three hours after local midnight (10 October) of the third creator,
  // later than every closed session and reversal.
  const cutoff = localMidnight(creators[2], 5) + r.int(60, 180) * M;
  // Planted: the first creator's session crosses local midnight (9 October), with gifts at
  // 23:59:59 and 00:00:00 local.
  const c0 = creators[0];
  const m0 = localMidnight(c0, 4);
  const cross = newSession(c0, m0 - r.int(10, 50) * M, m0 + r.int(10, 120) * M);
  gift(cross, m0 - 1);
  const atMidnight = gift(cross, m0);
  gift(cross, m0 + r.int(1, 500));
  if (level >= 2) {
    // A session that ends exactly at local midnight, whose gifts were all reversed.
    const c1 = creators[1];
    const m1 = localMidnight(c1, 4);
    const ends = newSession(c1, m1 - r.int(40, 150) * M, m1);
    ends.fixed = true;                                        // no other gifts
    const gone = [gift(ends, m1 - r.int(600, 1800)), gift(ends, m1 - r.int(1, 500))];
    for (const g of gone) reversals.push({ gift: g, t: Math.min(cutoff - 60, g.t + r.int(H, DAY)) });
    reversals.push({ gift: gone[0], t: reversals[reversals.length - 2].t + r.int(1, 30) });   // logged twice
  }
  if (level === 3) {
    // Still live at the cutoff: one crosses local midnight before it, one started within the hour.
    const c2 = creators[2];
    newSession(c2, localMidnight(c2, 5) - r.int(30, 90) * M, null);
    newSession(creators[nCreators - 1], cutoff - r.int(5, 50) * M, null);
  }

  // Gifts inside each session (before the cutoff for live ones), and reversals.
  for (const s of sessions) {
    if (s.fixed) continue;
    const end = s.e ?? cutoff;
    for (let k = r.int(1, 4); k > 0; k--) gift(s, s.s + r.int(0, end - s.s - 1));
  }
  for (const g of gifts) if (g !== atMidnight && !reversals.some((x) => x.gift === g) && r.chance(0.15)) reversals.push({ gift: g, t: Math.min(cutoff - 1, g.t + r.int(H, 2 * DAY)) });
  reversals.push({ gift: atMidnight, t: Math.min(cutoff - 1, atMidnight.t + r.int(H, DAY)) });

  const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
  const solve = (o = {}) => {
    const live = new Map(), gsum = new Map();
    const off = (c) => (o.utc ? 0 : c.off);
    const key = (c, idx) => c.id + "|" + addDays(EPOCH, idx);
    for (const s of sessions) {
      if (o.dropOpen && s.e === null) continue;
      const a = s.s + off(s.c), b = (s.e ?? cutoff) + off(s.c);
      if (o.noSplit) { const k = key(s.c, dayIdx(a)); live.set(k, (live.get(k) || 0) + (b - a) / M); continue; }
      for (let d = dayIdx(a); d * DAY < b; d++) {
        const mins = (Math.min(b, (d + 1) * DAY) - Math.max(a, d * DAY)) / M;
        if (mins > 0) { const k = key(s.c, d); live.set(k, (live.get(k) || 0) + mins); }
      }
    }
    const revs = new Map();
    for (const x of reversals) revs.set(x.gift.id, (revs.get(x.gift.id) || 0) + 1);
    for (const g of gifts) {
      if (o.dropOpen && g.sess.e === null) continue;
      const nRev = revs.get(g.id) || 0;
      let n = 1, coins = g.coins;
      if (o.keepReversed) n = 1;
      else if (o.subtractEach) { n = 1 - nRev; coins = g.coins * (1 - nRev); }
      else if (nRev) continue;
      const k = key(g.sess.c, dayIdx((o.sessionDay ? g.sess.s : g.t) + off(g.sess.c)));
      const x = gsum.get(k) || { n: 0, coins: 0 };
      gsum.set(k, { n: x.n + n, coins: x.coins + coins });
    }
    return [...live.entries()].sort((a, b) => cmp(a[0], b[0])).map(([k, mins]) => {
      const [c, d] = k.split("|");
      const g = gsum.get(k) || { n: 0, coins: 0 };
      return [c, d, mins, g.n, g.coins];
    });
  };
  const rows = solve();

  const diagnostics = [
    { message: "Days were taken in UTC. A creator-day is the date in the creator's own time zone.", rows: solve({ utc: true }) },
    { message: "Sessions were not split at local midnight: all of a session's minutes went to the day it started.", rows: solve({ noSplit: true }) },
    { message: "Gifts were dated by their session's start. A gift belongs to the local date it was sent, so a session across midnight gives gifts to both days.", rows: solve({ sessionDay: true }) },
    { message: "Reversed gifts were counted. A gift with any row in gift_reversals is excluded, whenever it was reversed.", rows: solve({ keepReversed: true }) },
  ];
  if (level >= 2) diagnostics.push({ message: "Reversals were subtracted once per reversal row. A reversal logged twice is still one reversed gift: exclude the gift, do not subtract it twice.", rows: solve({ subtractEach: true }) });
  if (level === 3) diagnostics.push({ message: "Sessions still live at the cutoff were dropped. A session with ended_at NULL counts up to the cutoff, with its gifts.", rows: solve({ dropOpen: true }) });

  const cCols = ["creator_id", "time_zone"];
  const cRows = creators.map((c) => [c.id, c.tz]);
  sessions.sort((a, b) => cmp(a.id, b.id));
  const sCols = ["session_id", "creator_id", "started_at", "ended_at"];
  const sRows = sessions.map((s) => [s.id, s.c.id, stamp(s.s), s.e === null ? null : stamp(s.e)]);
  gifts.sort((a, b) => a.t - b.t || cmp(a.id, b.id));
  const gCols = ["gift_id", "session_id", "sent_at", "coins"];
  const gRows = gifts.map((g) => [g.id, g.sess.id, stamp(g.t), g.coins]);
  reversals.sort((a, b) => a.t - b.t || cmp(a.gift.id, b.gift.id));
  const rCols = ["reversal_id", "gift_id", "reversed_at"];
  let rid = 100 + r.int(0, 800);
  const rRows = reversals.map((x) => [(rid += r.int(1, 5)), x.gift.id, stamp(x.t)]);
  const setup =
    "SET TIME ZONE 'UTC';\n" +
    "CREATE TABLE creators (\n  creator_id TEXT PRIMARY KEY,\n  time_zone TEXT NOT NULL            -- IANA name, e.g. 'Asia/Tokyo'\n);\n" +
    "CREATE TABLE live_sessions (\n  session_id TEXT PRIMARY KEY,\n  creator_id TEXT NOT NULL REFERENCES creators(creator_id),\n  started_at TIMESTAMPTZ NOT NULL,\n  ended_at TIMESTAMPTZ               -- NULL while the session is still live\n);\n" +
    "CREATE TABLE gifts (\n  gift_id TEXT PRIMARY KEY,\n  session_id TEXT NOT NULL REFERENCES live_sessions(session_id),\n  sent_at TIMESTAMPTZ NOT NULL,\n  coins INTEGER NOT NULL\n);\n" +
    "CREATE TABLE gift_reversals (\n  reversal_id BIGINT PRIMARY KEY,\n  gift_id TEXT NOT NULL REFERENCES gifts(gift_id),\n  reversed_at TIMESTAMPTZ NOT NULL\n);\n" +
    insertSQL("creators", cCols, cRows) + insertSQL("live_sessions", sCols, sRows) + insertSQL("gifts", gCols, gRows) + insertSQL("gift_reversals", rCols, rRows);

  return {
    vars: {
      cutoff: stamp(cutoff).replace("+00", ""),
      sessions: sRows.length,
      gifts: gRows.length,
      edge_rule: level === 1
        ? "Every session in this sample has ended, and each reversed gift has one row in `gift_reversals`."
        : level === 2
          ? "Every session in this sample has ended. A session can end exactly at local midnight (it adds nothing to the next day), time zones can be half an hour off UTC, and a reversal can be logged twice for one gift."
          : "A session still live when the report runs has `ended_at` NULL: count it up to the cutoff, split at local midnight like any other. Time zones can be half an hour off UTC, and a reversal can be logged twice for one gift.",
    },
    setup,
    tables: [
      { name: "creators", columns: cCols, rows: cRows },
      { name: "live_sessions", columns: sCols, rows: sRows },
      { name: "gifts", columns: gCols, rows: gRows },
      { name: "gift_reversals", columns: rCols, rows: rRows },
    ],
    expected: { columns: ["creator_id", "local_date", "live_minutes", "gifts", "coins"], rows },
    diagnostics: diagnostics.filter((d) => JSON.stringify(d.rows) !== JSON.stringify(rows)),
  };
}
