/* APL-L1-03 — Library adds after a listener's first listen, per genre (SQL).
   Simulated practice scenario. All data is generated from the seed. The listen rule,
   the seven-day window and the floor are hypothetical, stated in the problem.

   Contract: see docs/COMPANY-INTERVIEW-LOOPS.md § Executable templates (sql).
   level: 1 Medium (every play is a listen; pair = listener x track; the earliest add decides:
            before the first listen excludes the pair, within 7 days inclusive is an add;
            genres with at least min_listeners distinct listeners)
          2 Hard (+ only plays of at least min_ms count as listens: a preview before the first
            listen does not start the clock, and an add after a preview but before the first
            listen excludes the pair; several adds of one track)
          3 Very Hard (+ a track can belong to several genres and counts in each) */
import { insertSQL } from "../../js/rng.js";

export const kind = "sql";

const GENRES = ["alternative", "classical", "country", "electronic", "hip-hop", "jazz", "k-pop", "latin", "pop", "rock"];
const BASE = Date.UTC(2026, 7, 3);           // 2026-08-03 00:00:00 UTC
const DAY = 86400;
const WEEK = 7 * DAY;
const pad = (n) => String(n).padStart(2, "0");
function at(t) {
  const d = new Date(BASE + t * 1000);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}+00`;
}

export function generate(r, level) {
  const minMs = level === 1 ? 0 : r.pick([15000, 30000]);
  const minListeners = r.pick([3, 4]);
  const picked = r.sample(GENRES, level === 1 ? 4 : 5).sort();
  const niche = picked[r.int(0, picked.length - 1)];
  const main = picked.filter((g) => g !== niche);

  // Tracks: several per main genre, two in the niche genre.
  const tracks = [];                               // {id, genres: [..]}
  const tids = new Set();
  const newTid = () => { let id; do id = "trk_" + r.int(1000, 9999); while (tids.has(id)); tids.add(id); return id; };
  for (const g of main) for (let i = 0; i < 3; i++) tracks.push({ id: newTid(), genres: [g] });
  if (level === 3) for (const t of tracks) if (r.chance(0.3)) t.genres.push(r.pick(main.filter((g) => g !== t.genres[0])));
  const nicheTracks = [0, 1, 2].map(() => ({ id: newTid(), genres: [niche] }));
  tracks.push(...nicheTracks);
  const mainTracks = tracks.filter((t) => !t.genres.includes(niche));

  const plays = [];     // {id, l, track, t, ms}
  const adds = [];      // {id, l, track, t}
  const listen = () => (minMs > 0 && r.chance(0.2) ? minMs : r.int(31000, 260000));
  const preview = () => (r.chance(0.3) ? minMs - 1 : r.int(2000, minMs - 1));

  const lids = new Set();
  const nListeners = 10 + 3 * level;
  while (lids.size < nListeners) lids.add("lst_" + r.int(10000, 99999));
  const listeners = [...lids];

  const pair = (l, track, nicheLike) => {
    const first = r.int(0, 20 * DAY);
    // Hard+: previews (short plays) before the first real listen.
    let prev = null;
    if (level >= 2 && r.chance(0.35)) {
      prev = first - r.int(3600, 3 * DAY);
      plays.push({ l, track, t: prev, ms: preview() });
    }
    plays.push({ l, track, t: first, ms: listen() });
    for (let k = r.int(0, 2); k > 0; k--) plays.push({ l, track, t: first + r.int(60, 10 * DAY), ms: r.int(1000, 200000) });
    const u = r.next();
    const opts = nicheLike ? ["within", "none"] : null;
    const kind = opts ? r.pick(opts)
      : u < 0.3 ? "none" : u < 0.6 ? "within" : u < 0.72 ? "late" : u < 0.84 ? "before" : prev !== null ? "between" : "within";
    if (kind === "within") {
      const t = first + r.pick([0, WEEK, r.int(60, WEEK - 1), r.int(60, 2 * DAY)]);
      adds.push({ l, track, t });
      if (level >= 2 && r.chance(0.3)) adds.push({ l, track, t: t + r.int(WEEK, 3 * WEEK) });   // removed and re-added later
    } else if (kind === "late") {
      adds.push({ l, track, t: first + WEEK + r.pick([1, r.int(3600, 10 * DAY)]) });
    } else if (kind === "before") {
      adds.push({ l, track, t: first - r.int(60, 5 * DAY) });                       // added from a recommendation
      if (r.chance(0.5)) adds.push({ l, track, t: first + r.int(60, 3 * DAY) });     // and again after listening
    } else if (kind === "between") {
      adds.push({ l, track, t: prev + r.int(1, first - prev - 1) });                // after a preview, before the first listen
    }
  };

  for (const l of listeners) {
    for (const tr of r.sample(mainTracks, r.int(2, 4))) pair(l, tr.id, false);
    // Hard+: a track the listener only previewed: no listen, so no pair.
    if (level >= 2 && r.chance(0.3)) {
      const tr = r.pick(mainTracks);
      if (!plays.some((p) => p.l === l && p.track === tr.id)) plays.push({ l, track: tr.id, t: r.int(0, 20 * DAY), ms: preview() });
    }
    // An add of a track never played: no pair either.
    if (r.chance(0.2)) {
      const tr = r.pick(mainTracks);
      if (!plays.some((p) => p.l === l && p.track === tr.id)) adds.push({ l, track: tr.id, t: r.int(0, 25 * DAY) });
    }
  }
  // The niche genre: fewer listeners than the floor, but they play several of its tracks,
  // so its pair count can reach the floor while its listener count cannot.
  for (const l of r.sample(listeners, minListeners - 1)) for (const tr of nicheTracks) pair(l, tr.id, true);

  let pid = 800000 + r.int(0, 90000), aid = 50000 + r.int(0, 9000);
  for (const p of plays.slice().sort((a, b) => a.t - b.t)) p.id = (pid += r.int(1, 5));
  for (const a of adds.slice().sort((x, y) => x.t - y.t)) a.id = (aid += r.int(1, 5));

  const genresOf = new Map(tracks.map((t) => [t.id, t.genres]));
  const cmp = (x, y) => (x < y ? -1 : x > y ? 1 : 0);
  const share = (n, d) => Math.floor((n * 20000 + d) / (2 * d)) / 10000;

  const solve = (o = {}) => {
    const firstListen = new Map();
    for (const p of plays) {
      if (p.ms < (o.allPlays ? 0 : minMs)) continue;
      const k = p.l + "|" + p.track;
      if (!firstListen.has(k) || p.t < firstListen.get(k)) firstListen.set(k, p.t);
    }
    const addTimes = new Map();
    for (const a of adds) {
      const k = a.l + "|" + a.track;
      if (!addTimes.has(k)) addTimes.set(k, []);
      addTimes.get(k).push(a.t);
    }
    const per = new Map();
    for (const [k, first] of firstListen) {
      const [l, track] = k.split("|");
      const ts = addTimes.get(k) || [];
      let added;
      if (o.keepPreAdded) added = ts.some((t) => t >= first && t <= first + WEEK);
      else {
        const pickT = ts.length ? (o.latestAdd ? Math.max(...ts) : Math.min(...ts)) : null;
        if (pickT !== null && pickT < first) continue;                       // already in the library
        added = pickT !== null && (o.strict ? pickT < first + WEEK : pickT <= first + WEEK);
      }
      const gs = o.oneGenre ? [genresOf.get(track)[0]] : genresOf.get(track);
      for (const g of gs) {
        if (!per.has(g)) per.set(g, { ls: new Set(), pairs: 0, added: 0 });
        const s = per.get(g);
        s.ls.add(l); s.pairs++; if (added) s.added++;
      }
    }
    return [...per.entries()]
      .filter(([, s]) => (o.floorPairs ? s.pairs : s.ls.size) >= minListeners)
      .map(([g, s]) => [g, s.ls.size, s.pairs, s.added, share(s.added, s.pairs)])
      .sort((a, b) => b[4] - a[4] || cmp(a[0], b[0]));
  };
  const rows = solve();

  const diagnostics = [
    { message: "Pairs whose track was already in the library before the first listen were kept. Those adds did not follow a listen; leave the pair out.", rows: solve({ keepPreAdded: true }) },
    { message: "The latest add was used. The earliest add decides: before the first listen excludes the pair, within seven days counts.", rows: solve({ latestAdd: true }) },
    { message: "The seven-day window was treated as exclusive. An add exactly seven days after the first listen counts.", rows: solve({ strict: true }) },
    { message: `The floor was applied to pairs instead of distinct listeners. A genre needs at least ${minListeners} different listeners.`, rows: solve({ floorPairs: true }) },
  ];
  if (level >= 2) diagnostics.push({ message: `Short plays were counted as listens. Only plays of at least ${minMs} ms start the clock; a preview does not.`, rows: solve({ allPlays: true }) });
  if (level === 3) diagnostics.push({ message: "Each track was counted in one genre only. A track in two genres counts once in each.", rows: solve({ oneGenre: true }) });

  const gCols = ["track_id", "genre"];
  const gRows = [];
  for (const t of tracks.slice().sort((a, b) => cmp(a.id, b.id))) for (const g of t.genres.slice().sort()) gRows.push([t.id, g]);
  const pCols = ["play_id", "listener_id", "track_id", "played_at", "ms_played"];
  const pRows = plays.slice().sort((a, b) => a.id - b.id).map((p) => [p.id, p.l, p.track, at(p.t), p.ms]);
  const aCols = ["add_id", "listener_id", "track_id", "added_at"];
  const aRows = adds.slice().sort((a, b) => a.id - b.id).map((a) => [a.id, a.l, a.track, at(a.t)]);
  const setup =
    "SET TIME ZONE 'UTC';\n" +
    "CREATE TABLE track_genres (\n  track_id TEXT NOT NULL,\n  genre TEXT NOT NULL,\n  PRIMARY KEY (track_id, genre)\n);\n" +
    "CREATE TABLE plays (\n  play_id BIGINT PRIMARY KEY,\n  listener_id TEXT NOT NULL,\n  track_id TEXT NOT NULL,\n  played_at TIMESTAMPTZ NOT NULL,\n  ms_played INT NOT NULL\n);\n" +
    "CREATE TABLE library_adds (\n  add_id BIGINT PRIMARY KEY,\n  listener_id TEXT NOT NULL,\n  track_id TEXT NOT NULL,\n  added_at TIMESTAMPTZ NOT NULL\n);\n" +
    insertSQL("track_genres", gCols, gRows) + insertSQL("plays", pCols, pRows) + insertSQL("library_adds", aCols, aRows);

  return {
    vars: {
      min_ms: minMs,
      min_listeners: minListeners,
      plays: plays.length,
      adds: adds.length,
      listen_rule: level === 1
        ? "Every play counts as a listen in this round, whatever its `ms_played`."
        : `A play counts as a listen only if \`ms_played >= ${minMs}\`; shorter plays are previews and never start the clock. A pair needs at least one listen.`,
      genre_rule: level === 3
        ? "A track can have several rows in `track_genres`; its pairs count once in each of its genres."
        : "Each track has exactly one row in `track_genres`.",
    },
    setup,
    tables: [
      { name: "track_genres", columns: gCols, rows: gRows },
      { name: "plays", columns: pCols, rows: pRows },
      { name: "library_adds", columns: aCols, rows: aRows },
    ],
    expected: { columns: ["genre", "listeners", "pairs", "added", "add_rate"], rows },
    diagnostics: diagnostics.filter((d) => JSON.stringify(d.rows) !== JSON.stringify(rows)),
  };
}
