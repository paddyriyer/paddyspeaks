/* TTK-L3-05 — Lapsed sounds: videos still playing a licensed sound after its licence ended in a
   region, and hours until they were muted, per region and month (SQL).
   Simulated practice scenario. All sounds, licences, videos, regions and times are generated from
   the seed and are hypothetical; the licence, mute and renewal rules are this exercise's rules.

   A lapse is a licence row whose licence_end is at or before as_of and at which the sound is not
   licensed in that region (no licence of the same sound and region has licence_start <= that end
   < licence_end). A video joins a lapse when it uses the sound, was published before the end, was
   not removed at or before the end, and had no mute in that region at or before the end (mutes
   are permanent; the earliest mute row counts). The lapse ends at the earliest of: the video's
   first mute in that region, its removal, the next licence_start of the sound in that region after
   the end. A mute that ties with another stop counts as the mute.
   One row per (region, lapse_month = month of licence_end in UTC):
     video_lapses, muted (ended by a mute), still_playing (no stop by as_of),
     avg_hours_to_mute and max_hours_to_mute over the muted ones, ROUND 1 (NULL when none).
   level: 1 Medium (two regions, one licence per sound and region, a mute exactly at the end,
                    early mutes, a licence that ends after as_of)
          2 Hard (+ three regions, duplicate mute rows from retries, removed videos, videos
                  published after the end, mutes in one region but not another)
          3 Very Hard (+ renewals: one starting exactly at the end, one overlapping, and renewals
                       after a gap that end a lapse; a second lapse after a renewal) */
import { insertSQL, pad2 } from "../../js/rng.js";

export const kind = "sql";

const REGIONS = ["AU", "BR", "CA", "DE", "FR", "GB", "JP", "MX", "US"];
const WORDS_A = ["Neon", "Paper", "Velvet", "Static", "Golden", "Hollow", "Quiet", "Electric", "Lunar", "Copper", "Glass", "Wild"];
const WORDS_B = ["Tide", "Harbour", "Signal", "Orchard", "Avenue", "Echo", "Summer", "Engine", "Lanterns", "Weather", "Parade", "Motel"];
const DAY = 1440;

function stamp(min) {
  const d = new Date(min * 60000);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())} ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}:00+00`;
}
function month(min) {
  const d = new Date(min * 60000);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}`;
}
/* Round p/q (q > 0, p >= 0) to `dec` decimals, half away from zero, as PostgreSQL rounds numeric. */
function roundRat(p, q, dec) {
  const f = 10 ** dec;
  return Math.floor((2 * p * f + q) / (2 * q)) / f;
}
function isHalf(p, q, dec) {
  const t = 2 * p * 10 ** dec;
  return t % q === 0 && (t / q) % 2 === 1;
}

export function generate(r, level) {
  const base = Date.UTC(2026, 1 + r.int(0, 3), 1) / 60000;         // first of Feb..May 2026, minutes
  const asOf = base + 95 * DAY + r.int(8, 16) * 60;
  const regs = r.sample(REGIONS, level === 1 ? 2 : 3).sort();
  const nSounds = level === 1 ? 3 : level === 2 ? 4 : 5;

  // Sounds.
  const sounds = [];
  let sn = 1000 + r.int(0, 8000);
  const a = r.shuffle(WORDS_A), b = r.shuffle(WORDS_B);
  for (let k = 0; k < nSounds + 1; k++) {
    sounds.push({ id: "snd_" + (sn += r.int(3, 400)), kind: k < nSounds ? "licensed" : "original", title: a[k] + " " + b[k] });
  }
  const licensed = sounds.filter((s) => s.kind === "licensed");

  // Licences: one per licensed sound and region, then renewals at level 3.
  const lic = [];
  const endMin = () => base + r.int(8, 88) * DAY + (r.chance(0.4) ? 0 : r.int(1, 1439));
  const pairs = [];
  for (const s of licensed) for (const g of regs) pairs.push({ s, g });
  const core = pairs[0];                                            // the forced lapse
  const future = pairs[1 + r.int(0, pairs.length - 2)];             // ends after as_of
  for (const p of pairs) {
    let end;
    if (p === core) end = base + r.int(10, 70) * DAY + r.int(0, 1439);
    else if (p === future) end = asOf + r.int(1, 40) * DAY + r.int(0, 1439);
    else end = endMin();
    p.e1 = end;
    lic.push({ sound: p.s.id, region: p.g, start: base - r.int(60, 400) * DAY, end });
  }
  const renew = new Map();                                          // pair -> kind
  if (level === 3) {
    const cand = r.shuffle(pairs.filter((p) => p !== core && p !== future));
    const kinds = ["contiguous", "overlap", "gap", "gap2"];
    kinds.forEach((k, i) => { if (cand[i]) renew.set(cand[i], k); });
    for (const [p, k] of renew) {
      const E1 = p.e1;
      let start, end;
      if (k === "contiguous") { start = E1; end = r.chance(0.5) ? Math.min(E1 + r.int(4, 30) * DAY, asOf - 2 * DAY) : asOf + r.int(5, 60) * DAY; }
      else if (k === "overlap") { start = E1 - r.int(1, 20) * DAY - r.int(0, 600); end = E1 + r.int(20, 120) * DAY; }
      else if (k === "gap") { start = E1 + r.int(6 * 60, 72 * 60); end = start + r.int(20, 120) * DAY; }
      else { start = E1 + r.int(6 * 60, 48 * 60); end = Math.min(start + r.int(3, 12) * DAY + r.int(0, 1439), asOf - 60); }
      if (end <= E1 + 1) end = asOf + r.int(5, 60) * DAY;          // a renewal must reach past E1
      lic.push({ sound: p.s.id, region: p.g, start, end });
    }
  }

  // Coverage: is the sound licensed in this region at instant t?
  const coveredAt = (sid, g, t) => lic.some((n) => n.sound === sid && n.region === g && n.start <= t && n.end > t);
  const uncoveredEnds = (sid, g) => lic.filter((n) => n.sound === sid && n.region === g && n.end <= asOf && !coveredAt(sid, g, n.end))
    .map((n) => n.end).sort((x, y) => x - y);

  // Videos.
  const videos = [];
  let vn = 7000000 + r.int(0, 900000);
  const addVideo = (s, pub, removed = null) => {
    const v = { id: "v" + (vn += r.int(7, 9000)), sound: s.id, pub, removed };
    videos.push(v);
    return v;
  };
  const earlyPub = () => base - r.int(1, 60) * DAY - r.int(0, 1439);
  for (const s of sounds) {
    const n = s.kind === "original" ? r.int(2, 3) : level === 1 ? r.int(4, 6) : r.int(5, 7);
    for (let k = 0; k < n; k++) {
      let pub = earlyPub(), removed = null;
      if (level >= 2 && r.chance(0.25)) pub = base + r.int(0, 90) * DAY + r.int(0, 1439);
      if (level >= 2 && r.chance(0.15)) removed = Math.min(pub + r.int(1, 100) * DAY + r.int(0, 1439), asOf - r.int(1, 600));
      if (removed !== null && removed <= pub) removed = null;
      addVideo(s, Math.min(pub, asOf - 1440), removed);
    }
  }

  // Mutes: video -> region -> [times]. At most one logical mute per video and region (mutes are
  // permanent), placed around the first lapse in that region; retries add later duplicate rows.
  const mutes = [];
  const addMute = (v, g, t) => { if (t <= asOf && t > v.pub) mutes.push({ v: v.id, g, t }); };
  const lateDelay = (E) => {
    const room = Math.min(240 * 60, asOf - E);
    if (room < 2) return null;
    let d = r.int(1, room);
    if (d % 6 === 3) d = d > 1 ? d - 1 : d + 1;
    return d;
  };
  const forcedVids = new Set();
  // Forced edge cases on the core lapse.
  const E0 = core.e1;
  const fLate = addVideo(core.s, earlyPub()), fExact = addVideo(core.s, earlyPub()), fNone = addVideo(core.s, earlyPub());
  const fEarly = addVideo(core.s, earlyPub());
  addMute(fLate, core.g, E0 + (lateDelay(E0) || 30));
  addMute(fExact, core.g, E0);
  addMute(fEarly, core.g, E0 - r.int(30, 48 * 60));
  for (const v of [fLate, fExact, fNone, fEarly]) forcedVids.add(v.id);
  if (level >= 2) {
    const fPubAfter = addVideo(core.s, E0 + r.int(60, 3 * DAY));
    const fRemBefore = addVideo(core.s, earlyPub(), E0 - r.int(60, 5 * DAY));
    const fRemAfter = addVideo(core.s, earlyPub());
    const d = lateDelay(E0) || 600;
    fRemAfter.removed = E0 + Math.max(1, Math.floor(d / 2));
    addMute(fRemAfter, core.g, E0 + d + 5);
    const fRetry = addVideo(core.s, earlyPub());                    // on time, then a retry after the end
    addMute(fRetry, core.g, E0 - r.int(5, 300));
    addMute(fRetry, core.g, E0 + r.int(10, 900));
    const fRetry2 = addVideo(core.s, earlyPub());                   // late, then a later retry
    const d2 = lateDelay(E0) || 60;
    addMute(fRetry2, core.g, E0 + d2);
    addMute(fRetry2, core.g, E0 + d2 + r.int(30, 600));
    const fOther = addVideo(core.s, earlyPub());                    // muted on time elsewhere only
    for (const g of regs) {
      if (g === core.g) continue;
      const Eg = lic.find((L) => L.sound === core.s.id && L.region === g).end;
      addMute(fOther, g, Math.min(E0, Eg) - r.int(10, 600));
    }
    for (const v of [fPubAfter, fRemBefore, fRemAfter, fRetry, fRetry2, fOther]) forcedVids.add(v.id);
  }
  // Random mutes for every other video and region.
  for (const v of videos) {
    if (forcedVids.has(v.id)) continue;
    const s = sounds.find((x) => x.id === v.sound);
    if (s.kind === "original") continue;
    for (const g of regs) {
      const ends = uncoveredEnds(s.id, g);
      if (!ends.length) continue;
      const E = ends.find((e) => e > v.pub) ?? ends[0];
      const roll = r.next();
      let t = null;
      if (v.pub >= E) t = r.chance(0.5) ? v.pub + r.int(1, 60) : null;
      else if (roll < 0.28) t = E - r.int(0, 72 * 60);
      else if (roll < 0.36) t = E;
      else if (roll < 0.8) { const d = lateDelay(E); t = d === null ? null : E + d; }
      if (t === null && ends.length > 1 && r.chance(0.5)) {      // no mute at the first lapse: maybe at the next
        const E2 = ends[ends.length - 1], d = lateDelay(E2);
        if (d !== null) t = E2 + d;
      }
      if (t !== null) {
        addMute(v, g, t);
        if (level >= 2 && r.chance(0.2)) addMute(v, g, t + r.int(5, 600));
      }
    }
  }
  if (level === 3) {                                                // a gap renewal ends a lapse with no mute
    for (const [p, k] of renew) {
      if (k !== "gap" && k !== "gap2") continue;
      const v = addVideo(p.s, earlyPub());
      const ends = uncoveredEnds(p.s.id, p.g);
      if (ends.length > 1) { const d = lateDelay(ends[1]); if (d !== null) addMute(v, p.g, ends[1] + d); }
    }
  }

  // The oracle. Each opt breaks one rule, for diagnostics.
  const mutesOf = (vid, g, any) => mutes.filter((m) => m.v === vid && (any || m.g === g)).map((m) => m.t);
  const compute = (o = {}) => {
    const groups = new Map();
    for (const L of lic) {
      if (!o.futureEnds && L.end > asOf) continue;
      const E = L.end;
      const covers = (n) => n.sound === L.sound && n.region === L.region && n.end > E && (o.contiguousAsGap ? n.start < E : n.start <= E);
      if (!o.renewalIgnored && lic.some(covers)) continue;
      let rel = null;
      if (!o.relicNotStop && !o.renewalIgnored) {
        for (const n of lic) {
          if (n.sound !== L.sound || n.region !== L.region) continue;
          if (o.contiguousAsGap ? n.start >= E : n.start > E) rel = rel === null ? n.start : Math.min(rel, n.start);
        }
      }
      for (const v of videos) {
        if (v.sound !== L.sound) continue;
        if (!o.publishedAfter && v.pub >= E) continue;
        if (!o.removalIgnored && v.removed !== null && v.removed <= E) continue;
        const ts = mutesOf(v.id, L.region, o.anyRegion);
        const mute = ts.length ? (o.latestMute ? Math.max(...ts) : Math.min(...ts)) : null;
        if (mute !== null && (o.onTimeStrict ? mute < E : mute <= E)) continue;
        const stops = [mute, o.removalIgnored ? null : v.removed, rel].filter((x) => x !== null && x >= E);
        let stop = stops.length ? Math.min(...stops) : null;
        let muted = mute !== null && stop === mute;
        if (stop === null && o.stillAsMuted) { stop = asOf; muted = true; }
        const key = L.region + "|" + month(E);
        if (!groups.has(key)) groups.set(key, { g: L.region, m: month(E), n: 0, muted: 0, still: 0, sum: 0, max: 0 });
        const G = groups.get(key);
        G.n++;
        if (stop === null) G.still++;
        else if (muted) { G.muted++; G.sum += stop - E; G.max = Math.max(G.max, stop - E); }
      }
    }
    return [...groups.values()].sort((x, y) => (x.g < y.g ? -1 : x.g > y.g ? 1 : x.m < y.m ? -1 : x.m > y.m ? 1 : 0));
  };
  const toRows = (gs) => gs.map((G) => [G.g, G.m, G.n, G.muted, G.still,
    G.muted ? roundRat(G.sum, 60 * G.muted, 1) : null, G.muted ? roundRat(G.max, 60, 1) : null]);

  // Keep averages and maxima away from an exact half at 1 decimal (nudge a late mute by a minute).
  for (let guard = 0; guard < 80; guard++) {
    const bad = compute().find((G) => G.muted && (isHalf(G.sum, 60 * G.muted, 1) || isHalf(G.max, 60, 1)));
    if (!bad) break;
    const cands = mutes.filter((m) => m.g === bad.g && m.t < asOf - 5 && m.v !== fExact.id);
    const m = cands[guard % cands.length];
    for (const x of mutes) if (x.v === m.v && x.g === m.g) x.t += 1;
  }
  const expected = toRows(compute());

  const diagnostics = [
    { message: "A mute at exactly licence_end was counted as late. The sound may play up to licence_end (exclusive); a video muted at or before that instant was muted on time and is not a lapse.", rows: toRows(compute({ onTimeStrict: true })) },
    { message: "Licences that end after as_of were counted. A licence that has not yet ended has not lapsed; keep only licence_end <= as_of.", rows: toRows(compute({ futureEnds: true })) },
    { message: "Lapses still playing at as_of were included in the hours (as if muted at as_of). Average and maximum hours to mute cover only lapses ended by a mute; still-playing lapses are counted apart.", rows: toRows(compute({ stillAsMuted: true })) },
  ];
  if (level >= 2) {
    diagnostics.push(
      { message: "The latest mute row was used. Retries write duplicate mute rows; the video was muted from its earliest mute in that region, and mutes are permanent.", rows: toRows(compute({ latestMute: true })) },
      { message: "A mute in another region was counted. Licences and mutes are per region: a video muted in one region still plays the sound in the others.", rows: toRows(compute({ anyRegion: true })) },
      { message: "Removed videos were ignored. A video removed at or before the licence end was not playing; one removed after it stops playing at its removal, which ends the lapse without a mute.", rows: toRows(compute({ removalIgnored: true })) },
      { message: "Videos published at or after the licence end were counted. Only videos published before licence_end were playing the sound when it lapsed.", rows: toRows(compute({ publishedAfter: true })) },
    );
  }
  if (level === 3) {
    diagnostics.push(
      { message: "Every licence end was treated as a lapse. When another licence of the same sound and region covers the end instant (licence_start <= end < licence_end), the sound never stopped being licensed.", rows: toRows(compute({ renewalIgnored: true })) },
      { message: "A renewal after a gap did not end the lapse. Once the sound is licensed again in that region, the video is no longer playing it without a licence; the lapse ends at that licence_start, not at a later mute.", rows: toRows(compute({ relicNotStop: true })) },
      { message: "A renewal starting exactly at the previous licence_end was treated as a gap. licence_start <= end covers the instant; licences are [start, end) intervals that join with no gap.", rows: toRows(compute({ contiguousAsGap: true })) },
    );
  }

  // Tables.
  const sCols = ["sound_id", "kind", "title"];
  const sRows = sounds.map((s) => [s.id, s.kind, s.title]).sort((x, y) => (x[0] < y[0] ? -1 : 1));
  let ln = 300 + r.int(0, 500);
  const lSorted = lic.slice().sort((x, y) => (x.sound < y.sound ? -1 : x.sound > y.sound ? 1 : x.region < y.region ? -1 : x.region > y.region ? 1 : x.start - y.start));
  const lCols = ["licence_id", "sound_id", "region", "licence_start", "licence_end"];
  const lRows = lSorted.map((L) => ["lic_" + (ln += r.int(1, 40)), L.sound, L.region, stamp(L.start), stamp(L.end)]);
  const vCols = ["video_id", "sound_id", "published_at", "removed_at"];
  const vSorted = videos.slice().sort((x, y) => (x.id < y.id ? -1 : 1));
  const vRows = vSorted.map((v) => [v.id, v.sound, stamp(v.pub), v.removed === null ? null : stamp(v.removed)]);
  const mCols = ["mute_id", "video_id", "region", "muted_at"];
  let mn = 50000 + r.int(0, 40000);
  const mRows = mutes.slice().sort((x, y) => x.t - y.t || (x.v < y.v ? -1 : x.v > y.v ? 1 : x.g < y.g ? -1 : 1))
    .map((m) => [mn += r.int(1, 30), m.v, m.g, stamp(m.t)]);

  const setup =
    "SET TIME ZONE 'UTC';\n" +
    "CREATE TABLE sounds (\n  sound_id TEXT PRIMARY KEY,\n  kind TEXT NOT NULL CHECK (kind IN ('licensed', 'original')),\n  title TEXT NOT NULL\n);\n" +
    "CREATE TABLE sound_licences (\n  licence_id TEXT PRIMARY KEY,\n  sound_id TEXT NOT NULL REFERENCES sounds (sound_id),\n  region TEXT NOT NULL,\n  licence_start TIMESTAMPTZ NOT NULL,\n  licence_end TIMESTAMPTZ NOT NULL CHECK (licence_end > licence_start)\n);\n" +
    "CREATE TABLE videos (\n  video_id TEXT PRIMARY KEY,\n  sound_id TEXT NOT NULL REFERENCES sounds (sound_id),\n  published_at TIMESTAMPTZ NOT NULL,\n  removed_at TIMESTAMPTZ\n);\n" +
    "CREATE TABLE video_mutes (\n  mute_id INT PRIMARY KEY,\n  video_id TEXT NOT NULL REFERENCES videos (video_id),\n  region TEXT NOT NULL,\n  muted_at TIMESTAMPTZ NOT NULL\n);\n" +
    insertSQL("sounds", sCols, sRows) + insertSQL("sound_licences", lCols, lRows) +
    insertSQL("videos", vCols, vRows) + insertSQL("video_mutes", mCols, mRows);

  return {
    vars: {
      as_of: stamp(asOf),
      regions: regs.map((x) => "`" + x + "`").join(", "),
      video_count: vRows.length,
      mute_rows: mRows.length,
      licence_count: lRows.length,
      removal_rule: level === 1
        ? "No video in this sample was removed (`removed_at` is NULL throughout), and every video was published before every licence end."
        : "A video with `removed_at` (deleted or made private by its creator) plays nowhere from that instant: if it was removed at or before the licence end it was not playing and does not count; if removed later, the lapse ends at its removal. A video published at or after the licence end does not count for that lapse. `video_mutes` can hold several rows for one video and region, because the mute job retries.",
      renewal_rule: level === 3
        ? "A sound can have several licences in one region. A licence end is a lapse only if no licence of the same sound and region covers that instant (`licence_start <= end < licence_end`), so a renewal that starts exactly at the end, or overlaps it, is no lapse. After a gap, the lapse also ends at the next `licence_start` of that sound and region, if that comes before any mute or removal."
        : "In this sample each sound has exactly one licence per region, so every licence end at or before the snapshot time is a lapse.",
    },
    setup,
    tables: [
      { name: "sounds", columns: sCols, rows: sRows },
      { name: "sound_licences", columns: lCols, rows: lRows },
      { name: "videos", columns: vCols, rows: vRows },
      { name: "video_mutes", columns: mCols, rows: mRows },
    ],
    expected: {
      columns: ["region", "lapse_month", "video_lapses", "muted", "still_playing", "avg_hours_to_mute", "max_hours_to_mute"],
      rows: expected,
    },
    diagnostics: diagnostics.filter((d) => JSON.stringify(d.rows) !== JSON.stringify(expected)),
  };
}
