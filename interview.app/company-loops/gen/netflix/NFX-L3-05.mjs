/* NFX-L3-05 — Binge sessions: episodes watched back to back per profile, autoplay versus chosen,
   per title and season (SQL against a given viewing model).
   Simulated practice scenario. All titles, profiles, ids and times are generated from the seed
   and are hypothetical.

   Rules (the oracle below implements them; the evaluator's reference SQL is written separately):
     view          a play lasting at least min_view_s seconds (ended_at - started_at); shorter plays
                   are dropped before anything else, so they neither count nor break a session;
     session       each profile's views in order of (started_at, play_id); a view continues the
                   session of the view immediately before it when both are episodes of the same
                   title AND season and it starts no more than G minutes (inclusive) after that view
                   ended; otherwise it starts a new session (a film or anything else in between ends it);
     binge         a session of episodes with at least min_episodes DISTINCT episodes;
     output        per (title_name, season_no) with at least one binge: binge_sessions,
                   binge_profiles (distinct), episodes_in_binges (sum of distinct episodes),
                   autoplay_continuations and chosen_continuations (the views after the first in
                   each binge session, by start_reason).
   level: 1 Medium (gap exactly G links, G + 1 s breaks, a short episode of another series between
                    two episodes, a season finale that autoplays the next season)
          2 Hard (+ plays under min_view_s dropped, a play of exactly min_view_s kept, a false start,
                  a rewatched episode that does not make a session a binge)
          3 Very Hard (+ at-least-once feed: redelivered rows with the same play_id and a later
                       received_at; plays whose stop event was lost: ended_at NULL, the end is
                       started_at + the episode's runtime) */
import { insertSQL, ts } from "../../js/rng.js";

export const kind = "sql";

const H = 3600;
const BASE = Date.UTC(2026, 8, 18) / 1000;                       // 2026-09-18 00:00 UTC
// First letters are all different, so every collation orders these names the same way.
const SERIES = ["Arden Falls", "Bright Meridian", "Copper Coast", "Driftwood Academy", "Ember Street",
  "Foxglove Manor", "Glass Orbit", "Hollow Pines", "Iron Tide", "Juniper Line"];
const SHORTS = ["Kite and Pebble", "Little Lighthouse", "Moss and Moth"];
const FILMS = ["Northern Lantern", "Opal Run", "Quiet Engine", "Saltgrass Road", "Velvet Signal"];

function stamp(sec) {
  const day = new Date((BASE + sec) * 1000).toISOString().slice(0, 10);
  return ts(day, ((sec % 86400) + 86400) % 86400);
}

export function generate(r, level) {
  const G = r.pick(level === 1 ? [15, 20, 30] : [15, 20, 25, 30]);
  const GAP = G * 60;
  const minEp = r.pick([3, 4]);
  const minView = level === 1 ? 0 : r.pick([60, 90, 120]);

  // Catalogue: long-form series (2-3 seasons), one short-form series, a few films.
  let tid = 100 + r.int(0, 300), eid = 5000 + r.int(0, 2000);
  const titles = [], episodes = [];
  const mkSeries = (name, seasons, epsLo, epsHi, rtLo, rtHi) => {
    const s = { id: "t" + tid++, name, kind: "series", seasons: [] };
    titles.push(s);
    const rt = r.int(rtLo, rtHi);
    for (let sn = 1; sn <= seasons; sn++) {
      const n = r.int(epsLo, epsHi), eps = [];
      for (let k = 1; k <= n; k++) {
        const e = { id: "e" + eid++, title: s, season: sn, no: k, runtime: Math.max(rtLo, rt + r.int(-3, 3)), episode: true };
        eps.push(e);
        episodes.push(e);
      }
      s.seasons.push(eps);
    }
    return s;
  };
  const series = r.sample(SERIES, level === 1 ? 3 : 4).sort().map((n) => mkSeries(n, r.int(2, 3), 6, 9, 24, 58));
  const shortForm = mkSeries(r.pick(SHORTS), r.int(1, 2), 8, 12, 5, 8);
  const films = r.sample(FILMS, level === 3 ? 3 : 2).sort().map((name) => {
    const f = { id: "t" + tid++, name, kind: "film", runtime: r.int(85, 130), episode: false, title: null };
    f.title = f;
    titles.push(f);
    return f;
  });

  // Timeline. `t` is a cursor in seconds from BASE; each profile's activities run in sequence.
  const plays = [];
  let t = 0;
  const add = (prof, item, reason, dur, extra = {}) => {
    const p = { prof, item, reason, start: t, end: t + dur, lost: false, ...extra };
    plays.push(p);
    t += dur;
    return p;
  };
  const fullDur = (item) => item.runtime * 60 - r.int(0, 120);
  const link = () => (r.chance(0.6) ? [r.int(5, 20), "autoplay"] : [r.int(30, GAP - 60), "chosen"]);
  // Play a list of episodes back to back; `gaps[i]` may force the gap before episode i.
  const run = (prof, eps, first = "chosen", gaps = {}) => {
    eps.forEach((e, i) => {
      let reason = first;
      if (i > 0) {
        const [g, why] = gaps[i] || link();
        t += g;
        reason = why;
      }
      add(prof, e, reason, fullDur(e));
    });
  };
  const seasonSlice = (len, s = r.pick(series)) => {
    const ok = s.seasons.filter((x) => x.length >= len);
    const eps = r.pick(ok);
    const st = r.int(0, eps.length - len);
    return eps.slice(st, st + len);
  };

  const acts = [];                                              // [profileIndex, fn]
  const nProf = level === 1 ? 4 : level === 2 ? 5 : 6;
  const profIds = new Set();
  while (profIds.size < nProf) profIds.add("pf_" + r.int(1000, 9999));
  const profs = r.shuffle([...profIds]);
  const at = (fn) => acts.push([r.int(0, nProf - 1), fn]);

  // A plain binge (guarantees a non-empty answer).
  at((p) => run(p, seasonSlice(minEp + r.int(0, 2))));
  // A link of exactly G minutes: still the same session.
  at((p) => {
    const eps = seasonSlice(minEp + r.int(0, 1));
    run(p, eps, "chosen", { [r.int(1, eps.length - 1)]: [GAP, "chosen"] });
  });
  // G minutes and one second: a new session.
  at((p) => {
    const b = r.int(1, 2);
    const eps = seasonSlice(minEp + b);
    run(p, eps.slice(0, minEp));
    t += GAP + 1;
    run(p, eps.slice(minEp));
  });
  // One short episode of another series between two episodes of a season: the session ends.
  at((p) => {
    const b = r.int(1, 2);
    const eps = seasonSlice(minEp - 1 + b);
    run(p, eps.slice(0, minEp - 1));
    t += r.int(30, 90);
    const se = r.pick(r.pick(shortForm.seasons));
    add(p, se, "chosen", fullDur(se));
    t += r.int(30, 90);
    run(p, eps.slice(minEp - 1));
  });
  // A season finale that autoplays the next season's first episode: two sessions.
  at((p) => {
    const s = r.pick(series);
    const si = r.int(0, s.seasons.length - 2);
    const a = s.seasons[si], la = r.int(minEp, minEp + 1);
    run(p, a.slice(a.length - la));
    t += r.int(5, 20);
    run(p, s.seasons[si + 1].slice(0, minEp + r.int(0, 1)), "autoplay");
  });
  if (level >= 2) {
    // A play shorter than min_view_s of something else between two episodes: dropped, no break.
    at((p) => {
      const eps = seasonSlice(minEp);
      const k = r.int(1, eps.length - 1);
      run(p, eps.slice(0, k));
      t += r.int(20, 60);
      const other = r.chance(0.5) ? r.pick(films) : r.pick(r.pick(series.filter((x) => x !== eps[0].title)).seasons)[0];
      add(p, other, "chosen", r.int(10, minView - 1));
      t += r.int(20, 60);
      run(p, eps.slice(k));
    });
    // A false start: autoplay starts the next episode, stopped within seconds, then chosen again.
    at((p) => {
      const eps = seasonSlice(minEp + r.int(0, 1));
      const k = r.int(1, eps.length - 1);
      run(p, eps.slice(0, k));
      t += r.int(5, 20);
      add(p, eps[k], "autoplay", r.int(5, minView - 1));
      t += r.int(20, 120);
      run(p, eps.slice(k));
    });
    // A play of exactly min_view_s seconds is a view.
    at((p) => {
      const eps = seasonSlice(minEp);
      const m = r.int(1, eps.length - 2);
      run(p, eps.slice(0, m));
      t += r.int(5, 20);
      add(p, eps[m], "autoplay", minView);
      t += r.int(20, 60);
      run(p, eps.slice(m + 1));
    });
    // A rewatched episode: minEp plays but only minEp - 1 distinct episodes (not a binge).
    at((p) => {
      const eps = seasonSlice(minEp - 1);
      const k = r.int(0, eps.length - 1);
      const seq = [...eps.slice(0, k + 1), eps[k], ...eps.slice(k + 1)];
      run(p, seq, "chosen", { [k + 1]: [r.int(30, 300), "chosen"] });
    });
  }
  let lostPlay = null;
  if (level === 3) {
    // The stop event of a mid-session play was lost: its end is started_at + runtime.
    at((p) => {
      const eps = seasonSlice(minEp + r.int(0, 1));
      const k = r.int(0, eps.length - 2);
      run(p, eps.slice(0, k));
      if (k > 0) {
        const [g, why] = link();
        t += g;
        lostPlay = add(p, eps[k], why, eps[k].runtime * 60, { lost: true });
      } else lostPlay = add(p, eps[k], "chosen", eps[k].runtime * 60, { lost: true });
      const [g, why] = r.chance(0.5) ? [r.int(5, 20), "autoplay"] : [r.int(30, GAP - 60), "chosen"];
      t += g;
      run(p, eps.slice(k + 1), why);
    });
  }
  // Background traffic: short runs of episodes and films.
  for (let i = 0; i < nProf; i++) {
    for (let k = r.int(1, 3); k > 0; k--) {
      acts.push([i, r.chance(0.35)
        ? (p) => { const f = r.pick(films); add(p, f, "chosen", r.chance(0.7) ? fullDur(f) : r.int(20 * 60, f.runtime * 60 - 600)); }
        : (p) => run(p, seasonSlice(r.int(1, Math.min(minEp + 1, 6)), r.chance(0.2) ? shortForm : r.pick(series)))]);
    }
  }
  // Lay the activities out per profile, hours apart.
  for (let i = 0; i < nProf; i++) {
    t = r.int(6 * H, 20 * H);
    for (const [, fn] of r.shuffle(acts.filter((a) => a[0] === i))) {
      fn(profs[i]);
      t += r.int(2 * H, 26 * H);
    }
  }

  // Ids in start order; received_at is when the stop event arrived (the start event, if lost).
  plays.sort((a, b) => a.start - b.start || (a.prof < b.prof ? -1 : a.prof > b.prof ? 1 : 0));
  let pid = 20000 + r.int(0, 50000);
  for (const p of plays) {
    p.id = "pl_" + pid;
    pid += r.int(1, 9);
    p.recv = p.lost ? p.start + r.int(1, 60) : p.end + r.int(1, 90);
  }
  const rows = plays.map((p) => ({ ...p }));
  if (level === 3) {
    const binges = plays.filter((p) => p.item.episode && p !== lostPlay);
    const forced = [r.pick(binges), lostPlay];
    for (const p of plays) {
      if (forced.includes(p) || r.chance(0.12)) rows.push({ ...p, recv: p.recv + r.int(30, 2 * H) });
    }
  }
  rows.sort((a, b) => a.recv - b.recv || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  // The oracle. Each option breaks one rule, for diagnostics.
  const compute = (o = {}) => {
    let src = (o.dupes ? rows : plays).map((p) => ({ ...p, eend: p.lost ? (o.nullDrop ? null : p.start + p.item.runtime * 60) : p.end }));
    if (o.nullDrop) src = src.filter((p) => p.eend !== null);
    const short = (p) => (o.minStrict ? p.eend - p.start <= minView : p.eend - p.start < minView);
    const chain = o.keepShort || o.shortBreak ? src : src.filter((p) => !short(p));
    const byKey = new Map();
    for (const p of chain) {
      const key = o.noInterleaveBreak ? (p.item.episode ? p.prof + "|" + p.item.title.id + "|" + p.item.season : null) : p.prof;
      if (key === null) continue;
      if (!byKey.has(key)) byKey.set(key, []);
      byKey.get(key).push(p);
    }
    const sessions = [];
    for (const list of byKey.values()) {
      list.sort((a, b) => a.start - b.start || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
      let cur = null, prev = null;
      for (const p of list) {
        let joins = false;
        if (prev && p.item.episode && prev.item.episode && p.item.title === prev.item.title && (o.ignoreSeason || p.item.season === prev.item.season)) {
          if (!(o.nullBreak && prev.lost)) {
            const g = o.startToStart ? p.start - prev.start : p.start - prev.eend;
            joins = o.strictGap ? g < GAP : o.minuteTrunc ? Math.floor(g / 60) <= G : g <= GAP;
          }
        }
        if (joins) cur.push(p);
        else sessions.push((cur = [p]));
        prev = p;
      }
    }
    const agg = new Map();
    for (let s of sessions) {
      if (o.shortBreak) s = s.filter((p) => !short(p));
      if (!s.length || !s[0].item.episode) continue;
      const n = o.countPlays ? s.length : new Set(s.map((p) => p.item.id)).size;
      if (o.minEpStrict ? n <= minEp : n < minEp) continue;
      const key = s[0].item.title.name + "\u0000" + s[0].item.season;
      if (!agg.has(key)) agg.set(key, { name: s[0].item.title.name, season: s[0].item.season, n: 0, profs: new Set(), eps: 0, auto: 0, chosen: 0 });
      const a = agg.get(key);
      a.n++;
      a.profs.add(s[0].prof);
      a.eps += n;
      for (const p of o.firstAsCont ? s : s.slice(1)) {
        if (p.reason === "autoplay") a.auto++;
        else a.chosen++;
      }
    }
    return [...agg.values()]
      .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : a.season - b.season))
      .map((a) => [a.name, a.season, a.n, a.profs.size, a.eps, a.auto, a.chosen]);
  };
  const expected = compute();

  const diagnostics = [
    { message: `A gap of exactly ${G} minutes was treated as a break. The rule is inclusive: a view that starts no more than ${G} minutes after the previous view ended continues the session.`, rows: compute({ strictGap: true }) },
    { message: "The gap was rounded down to whole minutes, so a view starting a few seconds over the threshold still continued the session. Compare the exact interval (started_at - previous ended_at) with the threshold.", rows: compute({ minuteTrunc: true }) },
    { message: "The gap was measured from the previous view's start. It runs from the previous view's END to this view's start; start-to-start includes a whole episode's runtime.", rows: compute({ startToStart: true }) },
    { message: "Sessions were built per profile AND season (PARTITION BY profile, title, season), so an episode of another series watched in between did not end the session. Back to back means the view immediately before, across everything the profile watched.", rows: compute({ noInterleaveBreak: true }) },
    { message: "Sessions crossed a season boundary: the season is part of the rule. When a finale autoplays the next season's first episode, that episode starts a new session (and, being first, is not a continuation).", rows: compute({ ignoreSeason: true }) },
    { message: "The first view of a binge session was counted as a continuation. Only the views after the first are continuations; a session's first episode can itself be autoplayed (for example from the previous season's finale).", rows: compute({ firstAsCont: true }) },
    { message: `A session needs at least ${minEp} distinct episodes; one with exactly ${minEp} was excluded (> instead of >=).`, rows: compute({ minEpStrict: true }) },
    { message: "Plays were counted instead of distinct episodes. A rewatched episode is one episode: count DISTINCT episode_id both to qualify a binge and in episodes_in_binges.", rows: compute({ countPlays: true }) },
  ];
  if (level >= 2) {
    diagnostics.push(
      { message: `Plays shorter than ${minView} seconds were kept. They are not views: drop them before building sessions, so a false start neither counts nor ends a session.`, rows: compute({ keepShort: true }) },
      { message: `Plays shorter than ${minView} seconds were removed from the counts but still ended sessions. Drop them before ordering the views, not after the sessions are built.`, rows: compute({ shortBreak: true }) },
      { message: `A play of exactly ${minView} seconds was dropped. A play lasting at least ${minView} seconds is a view.`, rows: compute({ minStrict: true }) },
    );
  }
  if (level === 3) {
    diagnostics.push(
      { message: "Redelivered rows were counted twice. The feed is at least once: keep one row per play_id before ordering views (a duplicate also links to itself and adds a continuation).", rows: compute({ dupes: true }) },
      { message: "Plays with a NULL ended_at were dropped (a duration or gap computed from NULL is NULL, so a filter removes the row). Their end is started_at plus the episode's runtime.", rows: compute({ nullDrop: true }) },
      { message: "A play with a NULL ended_at ended its session: the gap after it was NULL. Use started_at plus the episode's runtime as its end.", rows: compute({ nullBreak: true }) },
    );
  }

  const tCols = ["title_id", "title_name", "kind"];
  const eCols = ["episode_id", "title_id", "season_no", "episode_no", "runtime_min"];
  const pCols = ["play_id", "profile_id", "title_id", "episode_id", "started_at", "ended_at", "start_reason", "received_at"];
  const tRows = titles.map((x) => [x.id, x.name, x.kind]);
  const eRows = episodes.map((e) => [e.id, e.title.id, e.season, e.no, e.runtime]);
  const pRows = rows.map((p) => [p.id, p.prof, p.item.title.id, p.item.episode ? p.item.id : null, stamp(p.start), p.lost ? null : stamp(p.end), p.reason, stamp(p.recv)]);
  const pk = level === 3 ? "PRIMARY KEY (play_id, received_at)" : "PRIMARY KEY (play_id)";
  const setup =
    "SET TIME ZONE 'UTC';\n" +
    "CREATE TABLE titles (\n  title_id TEXT PRIMARY KEY,\n  title_name TEXT NOT NULL UNIQUE,\n  kind TEXT NOT NULL CHECK (kind IN ('series','film'))\n);\n" +
    "CREATE TABLE episodes (\n  episode_id TEXT PRIMARY KEY,\n  title_id TEXT NOT NULL REFERENCES titles (title_id),\n  season_no INT NOT NULL,\n  episode_no INT NOT NULL,\n  runtime_min INT NOT NULL,\n  UNIQUE (title_id, season_no, episode_no)\n);\n" +
    "CREATE TABLE plays (\n  play_id TEXT NOT NULL,\n  profile_id TEXT NOT NULL,\n  title_id TEXT NOT NULL REFERENCES titles (title_id),\n  episode_id TEXT REFERENCES episodes (episode_id),\n  started_at TIMESTAMPTZ NOT NULL,\n  ended_at TIMESTAMPTZ,\n  start_reason TEXT NOT NULL CHECK (start_reason IN ('autoplay','chosen')),\n  received_at TIMESTAMPTZ NOT NULL,\n  " + pk + "\n);\n" +
    insertSQL("titles", tCols, tRows) + insertSQL("episodes", eCols, eRows) + insertSQL("plays", pCols, pRows);

  return {
    vars: {
      gap_minutes: G,
      min_episodes: minEp,
      min_view_s: minView,
      plays: pRows.length,
      profiles: nProf,
      view_rule: level === 1
        ? "Every play in this sample counts as a view."
        : `A play is a view only if it lasted at least ${minView} seconds (\`ended_at − started_at\`). Shorter plays are false starts: drop them before anything else, so they neither count nor end a session.`,
      end_rule: level === 3
        ? "When a device's stop event was lost, `ended_at` is NULL; such a play ended at `started_at` plus its episode's `runtime_min` (in this sample only episode plays lose their stop event)."
        : "Every play has an `ended_at`.",
      feed_rule: level === 3
        ? "The plays feed is delivered at least once: a redelivered play appears again with the same `play_id` and a later `received_at`. Count each play_id once."
        : "Each play appears once; `received_at` is only when its stop event reached the warehouse.",
    },
    setup,
    tables: [
      { name: "titles", columns: tCols, rows: tRows },
      { name: "episodes", columns: eCols, rows: eRows },
      { name: "plays", columns: pCols, rows: pRows },
    ],
    expected: { columns: ["title_name", "season_no", "binge_sessions", "binge_profiles", "episodes_in_binges", "autoplay_continuations", "chosen_continuations"], rows: expected },
    diagnostics: diagnostics.filter((d) => JSON.stringify(d.rows) !== JSON.stringify(expected)),
  };
}
