/* SPT-L1-01 — Collaborative playlists: additions per collaborator, and additions
   removed by a different member within 24 hours (SQL).
   Simulated practice scenario. All data is generated from the seed and is hypothetical.

   Contract: see docs/COMPANY-INTERVIEW-LOOPS.md § Executable templates (sql).
   An addition's removal is the NEXT event for the same playlist and track, in
   (event_ts, event_id) order, when that event is a remove. It counts when the remover
   is not the adder and the removal is at most 24 hours after the addition.
   level: 1 Medium (each track added at most once; self-removals; the exact 24-hour boundary)
          2 Hard (+ tracks removed and added back, so only the next removal belongs to an
                  addition; a playlist that is not collaborative is out of scope)
          3 Very Hard (+ client retries logged twice: identical rows with a new event_id) */
import { insertSQL } from "../../js/rng.js";

export const kind = "sql";

const H = 3600, D = 86400;
const BASE = Date.UTC(2026, 8, 7) / 1000;                 // Monday 2026-09-07 00:00 UTC
const PLAYLISTS = ["pl_beach_day", "pl_gym_rotation", "pl_house_party", "pl_road_trip", "pl_study_mix", "pl_sunday_cooking", "pl_wedding_dance"];
const USERS = ["u_ana", "u_ben", "u_chen", "u_dara", "u_eli", "u_fatima", "u_goran", "u_hana", "u_ivo"];
const stamp = (sec) => new Date(sec * 1000).toISOString().replace("T", " ").replace(/\.\d+Z$/, "+00");
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

export function generate(r, level) {
  const nPl = level === 1 ? 3 : 4;
  const names = r.sample(PLAYLISTS, nPl).sort();
  const playlists = names.map((id, i) => {
    const members = r.sample(USERS, i === 0 ? 3 + (level >= 2 ? 1 : 0) : r.int(2, 4)).sort();
    return { id, owner: members[0], members, collab: true };
  });
  // Hard+: one playlist is not collaborative; only its owner edits it.
  if (level >= 2) {
    const p = playlists[playlists.length - 1];
    p.collab = false;
    p.members = [p.owner];
  }

  const events = [];   // {pl, user, track, action, sec, tie}
  let trackNo = 1000 + r.int(0, 8000);
  const nextTrack = () => "trk_" + (trackNo += r.int(1, 37));
  const push = (pl, user, track, action, sec) => events.push({ pl, user, track, action, sec, tie: r.next() });
  const other = (members, not) => r.pick(members.filter((u) => !not.includes(u)));
  const startSec = () => BASE + r.int(0, 9) * D + r.int(7 * H, 22 * H);

  // Forced cases, all in the first (collaborative) playlist.
  const p0 = playlists[0];
  {
    const [a, b, c] = r.sample(p0.members, 3);
    let t = startSec();
    push(p0.id, a, nextTrack(), "add", t); push(p0.id, b, events[events.length - 1].track, "remove", t + D);       // exactly 24 h: counts
    t = startSec();
    const t2 = nextTrack();
    push(p0.id, b, t2, "add", t); push(p0.id, c, t2, "remove", t + D + 1);                                          // one second over: does not
    t = startSec();
    const t3 = nextTrack();
    push(p0.id, c, t3, "add", t); push(p0.id, c, t3, "remove", t + r.int(5, 50) * 60);                               // self-removal: does not
    t = startSec();
    const t4 = nextTrack();
    push(p0.id, a, t4, "add", t); push(p0.id, c, t4, "remove", t + r.int(1, 20) * H);                                // ordinary: counts
    if (level >= 2) {
      // Removed by the adder, added back by another member, then removed by a third within 24 h
      // of the FIRST addition: the first addition's removal is the self-removal.
      t = startSec();
      const t5 = nextTrack();
      push(p0.id, a, t5, "add", t);
      push(p0.id, a, t5, "remove", t + r.int(10, 50) * 60);
      push(p0.id, b, t5, "add", t + r.int(2, 4) * H);
      push(p0.id, c, t5, "remove", t + r.int(6, 12) * H);
    }
  }

  // Random chains for every playlist.
  for (const p of playlists) {
    const nTracks = (p === p0 ? 3 : 4) + r.int(0, 2) + level;
    for (let k = 0; k < nTracks; k++) {
      const track = nextTrack();
      let t = startSec();
      let adder = r.pick(p.members);
      const rounds = level >= 2 && r.chance(0.3) ? 2 : 1;
      for (let round = 0; round < rounds; round++) {
        push(p.id, adder, track, "add", t);
        const fate = r.int(0, 9);
        if (fate <= 3 && round === rounds - 1) break;                       // kept
        let remover;
        if (p.members.length === 1 || fate === 4) remover = adder;
        else remover = other(p.members, [adder]);
        const delay = r.pick([r.int(2, 59) * 60, r.int(1, 23) * H, D, D + 1, D + r.int(2, 30) * H, D - r.int(1, 120)]);
        t += delay;
        push(p.id, remover, track, "remove", t);
        t += r.int(1, 30) * H;
        adder = r.pick(p.members);
      }
    }
  }

  // Event ids follow time (ties in random order).
  events.sort((x, y) => x.sec - y.sec || x.tie - y.tie);
  let eid = 70000 + r.int(0, 20000);
  for (const e of events) e.id = (eid += r.int(1, 9));

  // Very Hard: client retries logged twice with a new event_id.
  const logged = events.slice();
  if (level === 3) {
    // A retried addition whose removal by another member counts.
    const counted = events.find((e, i) => e.action === "add" && e.pl === p0.id && i >= 0 &&
      events.some((x) => x.pl === e.pl && x.track === e.track && x.action === "remove" && x.user !== e.user && x.sec - e.sec <= D && x.sec > e.sec));
    const dups = [counted];
    for (const e of events) if (e !== counted && r.chance(0.12)) dups.push(e);
    for (const e of dups) logged.push({ ...e, id: (eid += r.int(1, 9)) });
  }

  const solve = (o = {}) => {
    const collab = new Set(playlists.filter((p) => p.collab || o.allPlaylists).map((p) => p.id));
    let rows = logged.slice();
    if (!o.noDedupe) {
      const seen = new Set();
      rows = rows.slice().sort((x, y) => x.id - y.id).filter((e) => {
        const k = [e.pl, e.user, e.track, e.action, e.sec].join("|");
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
    }
    const byKey = new Map();
    for (const e of rows) {
      const k = e.pl + "|" + e.track;
      if (!byKey.has(k)) byKey.set(k, []);
      byKey.get(k).push(e);
    }
    const per = new Map();
    for (const list of byKey.values()) {
      list.sort((x, y) => x.sec - y.sec || x.id - y.id);
      list.forEach((e, i) => {
        if (e.action !== "add" || !collab.has(e.pl)) return;
        const k = e.pl + "|" + e.user;
        if (!per.has(k)) per.set(k, { adds: 0, rem: 0 });
        const s = per.get(k);
        s.adds++;
        const within = (x) => (o.strict ? x.sec - e.sec < D : x.sec - e.sec <= D);
        let hit;
        if (o.anyLater) hit = list.some((x) => x.action === "remove" && x.sec > e.sec && x.user !== e.user && within(x));
        else {
          const n = list[i + 1];
          hit = n && n.action === "remove" && (o.selfCounts || n.user !== e.user) && within(n);
        }
        if (hit) s.rem++;
      });
    }
    const share = (n, d) => Math.floor((n * 20000 + d) / (2 * d)) / 10000;
    return [...per.entries()].sort((x, y) => cmp(x[0], y[0])).map(([k, s]) => {
      const [pl, u] = k.split("|");
      return [pl, u, s.adds, s.rem, share(s.rem, s.adds)];
    });
  };
  const rows = solve();

  const diagnostics = [
    { message: "Removals by the member who added the track were counted. Only a removal by a different member counts.", rows: solve({ selfCounts: true }) },
    { message: "A removal exactly 24 hours after the addition was left out. Within 24 hours includes 24 hours exactly.", rows: solve({ strict: true }) },
  ];
  if (level >= 2) {
    diagnostics.push({ message: "An addition was matched with any later removal of the track. Only the next event for that playlist and track belongs to the addition; after a re-add, a later removal belongs to the re-add.", rows: solve({ anyLater: true }) });
    diagnostics.push({ message: "A playlist that is not collaborative was included. The report covers collaborative playlists only.", rows: solve({ allPlaylists: true }) });
  }
  if (level === 3) diagnostics.push({ message: "Retried events were counted twice. Rows identical in playlist, user, track, action and event_ts are one event; a doubled addition also hides its own removal from LEAD.", rows: solve({ noDedupe: true }) });

  const pCols = ["playlist_id", "owner_id", "is_collaborative"];
  const pRows = playlists.map((p) => [p.id, p.owner, p.collab]);
  const eCols = ["event_id", "playlist_id", "user_id", "track_id", "action", "event_ts"];
  const eRows = logged.slice().sort((x, y) => x.id - y.id).map((e) => [e.id, e.pl, e.user, e.track, e.action, stamp(e.sec)]);
  const setup =
    "SET TIME ZONE 'UTC';\n" +
    "CREATE TABLE playlists (\n  playlist_id TEXT PRIMARY KEY,\n  owner_id TEXT NOT NULL,\n  is_collaborative BOOLEAN NOT NULL\n);\n" +
    "CREATE TABLE playlist_events (\n  event_id BIGINT PRIMARY KEY,\n  playlist_id TEXT NOT NULL REFERENCES playlists(playlist_id),\n  user_id TEXT NOT NULL,\n  track_id TEXT NOT NULL,\n  action TEXT NOT NULL CHECK (action IN ('add', 'remove')),\n  event_ts TIMESTAMPTZ NOT NULL\n);\n" +
    insertSQL("playlists", pCols, pRows) + insertSQL("playlist_events", eCols, eRows);

  return {
    vars: {
      playlists: playlists.length,
      events: eRows.length,
      scope_rule: level === 1
        ? "Every playlist in this sample is collaborative, and each track is added to a playlist at most once."
        : "Only playlists with `is_collaborative = true` are reported. A track can be removed and added back later, possibly by someone else; each addition is judged by the event that follows it.",
      dup_rule: level === 3
        ? "Clients retry, so an event can be logged twice: rows with the same `playlist_id, user_id, track_id, action, event_ts` are one event, whatever their `event_id`."
        : "No event is logged twice.",
    },
    setup,
    tables: [
      { name: "playlists", columns: pCols, rows: pRows },
      { name: "playlist_events", columns: eCols, rows: eRows },
    ],
    expected: { columns: ["playlist_id", "user_id", "additions", "removed_by_others", "removed_share"], rows },
    diagnostics: diagnostics.filter((d) => JSON.stringify(d.rows) !== JSON.stringify(rows)),
  };
}
