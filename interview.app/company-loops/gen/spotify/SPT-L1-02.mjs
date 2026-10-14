/* SPT-L1-02 — Release-day share of first-week streams, per album and market, with the
   release at each market's local midnight (SQL).
   Simulated practice scenario. All data is generated from the seed and is hypothetical.

   Contract: see docs/COMPANY-INTERVIEW-LOOPS.md § Executable templates (sql).
   A stream's day number is its local date in the market's time zone minus the album's
   release date. Release day is day 0; the first week is days 0 to 6. The oracle converts
   instants with Intl (IANA zones), independently of PostgreSQL's AT TIME ZONE.
   level: 1 Medium (every stream is in the first week; streams near local midnight fall on
                    another UTC date)
          2 Hard (+ streams after the first week, exactly at local midnight of day 7;
                  a minimum-streams floor)
          3 Very Hard (+ a daylight-saving change inside the week, so 7 local days are not
                       168 hours; streams in the hour that differs) */
import { insertSQL } from "../../js/rng.js";

export const kind = "sql";

const H = 3600, D = 86400;
const ZONES = { AU: "Australia/Sydney", BR: "America/Sao_Paulo", DE: "Europe/Berlin", GB: "Europe/London", IN: "Asia/Kolkata", JP: "Asia/Tokyo", MX: "America/Mexico_City", US: "America/New_York" };
const ALBUMS = ["alb_after_hours_tapes", "alb_blue_harbour", "alb_cassette_summer", "alb_glass_orchard", "alb_low_tide", "alb_northern_lights", "alb_paper_moons", "alb_velvet_static"];

const fmtDate = {}, fmtWall = {};
function localDate(sec, tz) {
  const f = (fmtDate[tz] ||= new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }));
  return f.format(new Date(sec * 1000));
}
function offsetAt(sec, tz) {
  const f = (fmtWall[tz] ||= new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }));
  const p = Object.fromEntries(f.formatToParts(new Date(sec * 1000)).map((x) => [x.type, x.value]));
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second) / 1000 - sec;
}
function localToUtc(wallSec, tz) {                       // never called for a wall time a DST change skips or repeats
  let t = wallSec - offsetAt(wallSec, tz);
  t = wallSec - offsetAt(t, tz);
  return t;
}
const daySec = (d) => Date.parse(d + "T00:00:00Z") / 1000;
const dayDiff = (a, b) => Math.round((daySec(a) - daySec(b)) / D);
const utcDate = (sec) => new Date(sec * 1000).toISOString().slice(0, 10);
const stamp = (sec) => new Date(sec * 1000).toISOString().replace("T", " ").replace(/\.\d+Z$/, "+00");
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

export function generate(r, level) {
  const nAlb = level === 1 ? 2 : 3;
  const albumIds = r.sample(ALBUMS, nAlb).sort();
  // Fridays. Very Hard: weeks that span the European (2026-10-25) and US (2026-11-01) clock changes.
  const releases = level === 3 ? ["2026-10-23", "2026-10-30", r.pick(["2026-10-23", "2026-10-30"])] : r.sample(["2026-09-04", "2026-09-11", "2026-09-18"], nAlb);
  const albums = albumIds.map((id, i) => ({ id, release: releases[i] }));

  let marketIds;
  if (level === 3) marketIds = [r.pick(["DE", "GB"]), "US", ...r.sample(["AU", "IN", "JP", "BR", "MX"], 2)];
  else marketIds = [r.pick(["US", "BR", "MX"]), r.pick(["JP", "IN", "AU"]), ...r.sample(["DE", "GB"], level === 1 ? 1 : 2)];
  marketIds = [...new Set(marketIds)].sort();
  const floor = level === 1 ? 1 : r.pick([4, 5, 6]);

  const streams = [];   // {album, market, sec}
  const at = (a, m, day, hh, mm, ss) => streams.push({ album: a.id, market: m, sec: localToUtc(daySec(a.release) + day * D + hh * H + mm * 60 + ss, ZONES[m]) });
  // A random local wall time that never falls in 01:00–03:59, where a clock change could skip or repeat it.
  const wall = () => r.pick([[0, r.int(0, 59)], [r.int(22, 23), r.int(0, 59)], [r.int(4, 21), r.int(0, 59)], [r.int(23, 23), r.int(30, 59)]]);
  const pairs = [];
  for (const a of albums) for (const m of marketIds) pairs.push([a, m]);
  // Hard+: two pairs of the last album in markets that get no forced streams below:
  // one exactly at the floor (reported), one a stream short (not reported).
  const quiet = marketIds.filter((m) => !["US", "DE", "GB"].includes(m) || level === 2);
  const [fm1, fm2] = r.sample(quiet, 2);
  const aLast = albums[albums.length - 1];
  pairs.forEach(([a, m]) => {
    let n = r.int(6, 11);
    if (level >= 2 && a === aLast && m === fm1) n = floor;
    if (level >= 2 && a === aLast && m === fm2) n = floor - 1;
    for (let k = 0; k < n; k++) {
      const day = r.pick([0, 0, 0, 1, 2, 3, 4, 5, 6]);
      const [hh, mm] = wall();
      at(a, m, day, hh, mm, r.int(0, 59));
    }
    // Late streams after the first week (not counted, so they do not move the floor).
    if (level >= 2 && r.chance(0.7)) for (let k = r.int(1, 3); k > 0; k--) { const [hh, mm] = wall(); at(a, m, r.int(7, 9), hh, mm, r.int(0, 59)); }
  });
  // Every level: the first second of release day, and the last second of day 6, in every market.
  const a0 = albums[0];
  for (const m of marketIds) { at(a0, m, 0, 0, 0, 0); at(a0, m, 6, 23, 59, 59); }
  if (level >= 2) for (const m of marketIds) at(albums[1], m, 7, 0, 0, 0);      // first second after the week
  if (level === 3) {
    // Inside the week's last local hour, which 168 hours from release miss when the clocks fall back.
    for (const a of albums) for (const m of marketIds) if (m === "US" || m === "DE" || m === "GB") at(a, m, 6, 23, r.int(5, 50), r.int(0, 59));
  }

  streams.sort((x, y) => x.sec - y.sec || cmp(x.album + x.market, y.album + y.market));
  let sid = 4400000 + r.int(0, 900000);
  for (const s of streams) s.id = (sid += r.int(1, 13));

  const albumOf = Object.fromEntries(albums.map((a) => [a.id, a]));
  const solve = (o = {}) => {
    const per = new Map();
    for (const s of streams) {
      const a = albumOf[s.album], tz = ZONES[s.market];
      let dayNo, inWeek;
      if (o.hours168) {
        const rel = localToUtc(daySec(a.release), tz);
        dayNo = dayDiff(localDate(s.sec, tz), a.release);
        inWeek = s.sec >= rel && s.sec < rel + 7 * D;
      } else {
        dayNo = dayDiff(o.utc ? utcDate(s.sec) : localDate(s.sec, tz), a.release);
        inWeek = dayNo >= 0 && dayNo <= (o.eightDays ? 7 : 6);
      }
      if (!inWeek) continue;
      const k = s.album + "|" + s.market;
      if (!per.has(k)) per.set(k, { n: 0, d0: 0 });
      const c = per.get(k);
      c.n++;
      if (dayNo === 0) c.d0++;
    }
    const share = (n, d) => Math.floor((n * 20000 + d) / (2 * d)) / 10000;
    return [...per.entries()].filter(([, c]) => c.n >= (o.noFloor ? 1 : floor)).sort((x, y) => cmp(x[0], y[0]))
      .map(([k, c]) => { const [al, m] = k.split("|"); return [al, m, c.n, c.d0, share(c.d0, c.n)]; });
  };
  const rows = solve();

  const diagnostics = [
    { message: "Days were taken in UTC. Release is at local midnight in each market: a stream at 00:30 in Tokyo on release day is 15:30 the day before in UTC. Convert with `stream_ts AT TIME ZONE tz` before taking the date.", rows: solve({ utc: true }) },
  ];
  if (level >= 2) {
    diagnostics.push({ message: "The first week ran to the end of day 7. The first week is the release date and the six local days after it; a stream at local midnight starting day 7 is outside it.", rows: solve({ eightDays: true }) });
    diagnostics.push({ message: "The minimum-streams floor was not applied (or applied as more than rather than at least).", rows: solve({ noFloor: true }) });
  }
  if (level === 3) diagnostics.push({ message: "The first week was taken as 168 hours from the release instant. When the clocks change inside the week, seven local days are 167 or 169 hours; compare local dates instead.", rows: solve({ hours168: true }) });

  const aCols = ["album_id", "release_date"];
  const aRows = albums.map((a) => [a.id, a.release]);
  const mCols = ["market", "tz"];
  const mRows = marketIds.map((m) => [m, ZONES[m]]);
  const sCols = ["stream_id", "album_id", "market", "stream_ts"];
  const sRows = streams.map((s) => [s.id, s.album, s.market, stamp(s.sec)]);
  const setup =
    "SET TIME ZONE 'UTC';\n" +
    "CREATE TABLE albums (\n  album_id TEXT PRIMARY KEY,\n  release_date DATE NOT NULL      -- released at local midnight in every market\n);\n" +
    "CREATE TABLE markets (\n  market TEXT PRIMARY KEY,\n  tz TEXT NOT NULL                -- IANA time zone used for the market's release\n);\n" +
    "CREATE TABLE streams (\n  stream_id BIGINT PRIMARY KEY,\n  album_id TEXT NOT NULL REFERENCES albums(album_id),\n  market TEXT NOT NULL REFERENCES markets(market),\n  stream_ts TIMESTAMPTZ NOT NULL\n);\n" +
    insertSQL("albums", aCols, aRows) + insertSQL("markets", mCols, mRows) + insertSQL("streams", sCols, sRows);

  return {
    vars: {
      min_streams: floor,
      streams: sRows.length,
      markets: marketIds.length,
      week_rule: level === 1
        ? "Every stream in this sample falls in its album's first week in its market."
        : "Streams after the first week are in the table too; they count nowhere.",
      min_rule: level === 1
        ? "Report every album and market with at least one first-week stream."
        : "Report only album and market pairs with at least " + floor + " first-week streams.",
      dst_rule: level === 3
        ? "Some markets change their clocks during an album's first week."
        : "No market changes its clocks during these weeks.",
    },
    setup,
    tables: [
      { name: "albums", columns: aCols, rows: aRows },
      { name: "markets", columns: mCols, rows: mRows },
      { name: "streams", columns: sCols, rows: sRows },
    ],
    expected: { columns: ["album_id", "market", "first_week_streams", "release_day_streams", "release_day_share"], rows },
    diagnostics: diagnostics.filter((d) => JSON.stringify(d.rows) !== JSON.stringify(rows)),
  };
}
