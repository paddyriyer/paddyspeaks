/* SPT-L1-03 — Yearly summary: each listener's own top five artists by minutes (SQL).
   Simulated practice scenario. All data is generated from the seed and is hypothetical.
   The 30-second rule and the tie-break are this exercise's rules, not any product's.

   Contract: see docs/COMPANY-INTERVIEW-LOOPS.md § Executable templates (sql).
   A play counts when ms_played >= 30000 and played_at falls in the summary year (UTC).
   Artists rank by counted milliseconds descending, then by their first counted play,
   then by artist_id; the top five per listener are returned.
   level: 1 Medium (short plays, exactly 30 000 ms, a tie on total time at the 5/6 boundary)
          2 Hard (+ plays just outside the year, private-session plays that do not count,
                  a listener with fewer than five artists)
          3 Very Hard (+ the tied artist that plays first overall only has a short play first:
                       the tie-break uses the first COUNTED play) */
import { insertSQL } from "../../js/rng.js";

export const kind = "sql";

const D = 86400;
const NAMES = ["Amber Coast", "Brass Lanterns", "Cedar & Smoke", "Dune Theory", "Echo Parade", "Fern Avenue", "Golden Hour Club",
  "Harbour Lights", "Indigo Rail", "Juniper Kid", "Kite Season", "Lumen Choir", "Marigold", "Night Bus"];
const stamp = (sec) => new Date(sec * 1000).toISOString().replace("T", " ").replace(/\.\d+Z$/, "+00");
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

export function generate(r, level) {
  const year = r.pick([2024, 2025]);
  const Y0 = Date.UTC(year, 0, 1) / 1000, Y1 = Date.UTC(year + 1, 0, 1) / 1000;
  const inYear = () => Y0 + r.int(2 * D, Y1 - Y0 - 2 * D);

  // Artists with distinct ids; two tracks each.
  const nArt = 9;
  const artIds = r.sample([...Array(60)].map((_, i) => 100 + i * 7), nArt).sort((a, b) => a - b).map((n) => "art_" + n);
  const names = r.sample(NAMES, nArt);
  const artists = artIds.map((id, i) => ({ id, name: names[i] }));
  const tracks = [];
  let trk = 5000 + r.int(0, 3000);
  for (const a of artists) for (let k = 0; k < 2; k++) tracks.push({ id: "trk_" + (trk += r.int(1, 40)), artist: a.id });
  const trackOf = (artist) => r.pick(tracks.filter((t) => t.artist === artist)).id;

  const listeners = r.sample(["lst_aria", "lst_bodhi", "lst_cleo", "lst_dev", "lst_esme", "lst_finn", "lst_greta", "lst_hugo"], level === 1 ? 3 : 4).sort();
  const plays = [];   // {listener, track, artist, sec, ms, priv}
  const play = (l, artist, sec, ms, priv = false) => plays.push({ listener: l, track: trackOf(artist), artist, sec, ms, priv });
  const okMs = () => r.pick([r.int(30001, 240000), r.int(60000, 300000), r.int(30001, 90000)]);

  // Listener 0: four clear leaders, then two artists tied on counted time for rank 5.
  {
    const l = listeners[0];
    const six = r.sample(artIds, 6);
    const [hi, lo] = six[4] > six[5] ? [six[4], six[5]] : [six[5], six[4]];   // hi has the larger artist_id
    const tieMs = [r.int(31000, 200000), r.int(31000, 200000), 30000];          // one play of exactly 30 s
    const tieTotal = tieMs.reduce((s, x) => s + x, 0);
    six.slice(0, 4).forEach((a, i) => {
      let left = tieTotal + (4 - i) * r.int(60000, 90000) + 1000;              // strictly above the tie, distinct
      while (left > 0) { const m = Math.min(left, r.int(120000, 260000)); play(l, a, inYear(), Math.max(m, 30000)); left -= m; }
    });
    // The larger artist_id plays (a counted play) first, so the first-play rule picks it.
    const tFirst = Y0 + r.int(10 * D, 60 * D);
    play(l, hi, tFirst, tieMs[0]);
    play(l, hi, inYear(), tieMs[1]);
    play(l, hi, inYear(), tieMs[2]);
    play(l, lo, tFirst + r.int(1, 20) * D, tieMs[1]);
    play(l, lo, tFirst + r.int(21, 250) * D, tieMs[0]);                         // all of lo's counted plays come later
    play(l, lo, tFirst + r.int(21, 250) * D, tieMs[2]);
    if (level === 3) play(l, lo, tFirst - r.int(1, 5) * D, r.int(5000, 29999));   // lo's very first play is short
    // A short play (29 999 ms) for the tie loser, which would break the tie if counted.
    play(l, lo, inYear(), 29999);
    if (level === 3) play(l, lo, tFirst - r.int(6, 8) * D, r.int(2000, 20000));
  }
  // Other listeners: random tastes.
  listeners.slice(1).forEach((l, idx) => {
    const few = level >= 2 && idx === 0;                                       // fewer than five artists
    const mine = r.sample(artIds, few ? 3 : r.int(5, 7));
    for (const a of mine) for (let k = r.int(1, 4); k > 0; k--) play(l, a, inYear(), okMs());
    if (few) { const a = r.pick(artIds.filter((x) => !mine.includes(x))); play(l, a, inYear(), r.int(1000, 29999)); }   // only a short play: not an artist of theirs
    for (let k = r.int(1, 3); k > 0; k--) play(l, r.pick(mine), inYear(), r.int(1000, 29999));
  });
  if (level >= 2) {
    // Plays at the edges of the year; the ones outside are large enough to change a rank.
    for (const l of listeners.slice(1)) {
      const a = r.pick(artIds);
      play(l, a, Y0 - 1, 600000);
      play(l, a, Y1, 600000);
      play(l, r.pick(artIds), Y0, r.int(40000, 200000));
      play(l, r.pick(artIds), Y1 - 1, r.int(40000, 200000));
    }
    // Private-session plays do not count (this exercise's rule).
    for (const l of listeners) play(l, r.pick(artIds), inYear(), r.int(700000, 900000), true);
  }

  plays.sort((x, y) => x.sec - y.sec || cmp(x.listener, y.listener));
  let pid = 880000 + r.int(0, 50000);
  for (const p of plays) p.id = (pid += r.int(1, 7));

  const solve = (o = {}) => {
    const per = new Map();
    for (const p of plays) {
      const yearOk = o.yearInclusive ? p.sec >= Y0 && p.sec <= Y1 : p.sec >= Y0 && p.sec < Y1;
      const counted = yearOk && (o.privateCounts || !p.priv) &&
        (o.allPlays ? true : o.strict ? p.ms > 30000 : p.ms >= 30000);
      const k = p.listener + "|" + p.artist;
      if (o.firstAny && yearOk && !p.priv) {
        if (!per.has(k)) per.set(k, { ms: 0, first: Infinity, any: false });
        const s = per.get(k);
        s.first = Math.min(s.first, p.sec);
      }
      if (!counted) continue;
      if (!per.has(k)) per.set(k, { ms: 0, first: Infinity, any: false });
      const s = per.get(k);
      s.ms += p.ms;
      s.any = true;
      if (!o.firstAny) s.first = Math.min(s.first, p.sec);
    }
    const byL = new Map();
    for (const [k, s] of per) {
      if (!s.any) continue;
      const [l, a] = k.split("|");
      if (!byL.has(l)) byL.set(l, []);
      byL.get(l).push({ a, ...s });
    }
    const out = [];
    for (const l of [...byL.keys()].sort()) {
      const xs = byL.get(l);
      xs.sort((x, y) => y.ms - x.ms || (o.tieById ? 0 : x.first - y.first) || cmp(x.a, y.a));
      let ranked;
      if (o.rankTies) {
        ranked = xs.map((x) => ({ ...x, rank: 1 + xs.filter((z) => z.ms > x.ms).length })).filter((x) => x.rank <= 5);
      } else ranked = xs.slice(0, 5).map((x, i) => ({ ...x, rank: i + 1 }));
      for (const x of ranked) out.push([l, x.rank, x.a, Math.floor((2 * x.ms + 6000) / 12000) / 10]);
    }
    return out;
  };
  const rows = solve();

  const diagnostics = [
    { message: "Plays under 30 seconds were counted. They do not count toward minutes or toward an artist's place.", rows: solve({ allPlays: true }) },
    { message: "A play of exactly 30 000 ms was excluded. At least 30 seconds counts.", rows: solve({ strict: true }) },
    { message: "Equal totals were broken by artist_id. The artist the listener played first (first counted play) ranks higher; artist_id only breaks a tie on that too.", rows: solve({ tieById: true }) },
    { message: "RANK() let two tied artists share fifth place and returned six rows. The summary shows exactly five artists, ties broken by first play.", rows: solve({ rankTies: true }) },
  ];
  if (level >= 2) {
    diagnostics.push({ message: "Private-session plays were counted. In this exercise they never reach the summary.", rows: solve({ privateCounts: true }) });
    diagnostics.push({ message: "The year included midnight at its end. Use played_at >= the year's first instant AND played_at < the next year's first instant.", rows: solve({ yearInclusive: true }) });
  }
  if (level === 3) diagnostics.push({ message: "The tie-break used the artist's first play of any length. A short play is not a counted play, so it cannot decide a tie either.", rows: solve({ firstAny: true }) });

  const aCols = ["artist_id", "name"];
  const aRows = artists.map((a) => [a.id, a.name]);
  const tCols = ["track_id", "artist_id"];
  const tRows = tracks.map((t) => [t.id, t.artist]);
  const pCols = ["play_id", "listener_id", "track_id", "played_at", "ms_played", "private_session"];
  const pRows = plays.map((p) => [p.id, p.listener, p.track, stamp(p.sec), p.ms, p.priv]);
  const setup =
    "SET TIME ZONE 'UTC';\n" +
    "CREATE TABLE artists (\n  artist_id TEXT PRIMARY KEY,\n  name TEXT NOT NULL\n);\n" +
    "CREATE TABLE tracks (\n  track_id TEXT PRIMARY KEY,\n  artist_id TEXT NOT NULL REFERENCES artists(artist_id)\n);\n" +
    "CREATE TABLE plays (\n  play_id BIGINT PRIMARY KEY,\n  listener_id TEXT NOT NULL,\n  track_id TEXT NOT NULL REFERENCES tracks(track_id),\n  played_at TIMESTAMPTZ NOT NULL,\n  ms_played INT NOT NULL,\n  private_session BOOLEAN NOT NULL\n);\n" +
    insertSQL("artists", aCols, aRows) + insertSQL("tracks", tCols, tRows) + insertSQL("plays", pCols, pRows);

  return {
    vars: {
      year,
      next_year: year + 1,
      plays: pRows.length,
      listeners: listeners.length,
      scope_rule: level === 1
        ? "Every play in this sample is in " + year + " and none is in a private session."
        : "The table also holds plays from just before and after " + year + ", and plays with `private_session = true`, which never count (this exercise's rule).",
    },
    setup,
    tables: [
      { name: "artists", columns: aCols, rows: aRows },
      { name: "tracks", columns: tCols, rows: tRows },
      { name: "plays", columns: pCols, rows: pRows },
    ],
    expected: { columns: ["listener_id", "artist_rank", "artist_id", "minutes"], rows },
    diagnostics: diagnostics.filter((d) => JSON.stringify(d.rows) !== JSON.stringify(rows)),
  };
}
