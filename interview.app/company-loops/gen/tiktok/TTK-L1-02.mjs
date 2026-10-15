/* TTK-L1-02 — Remix reach: distinct creators who duetted or stitched an original within 7 days,
   per week of publishing (SQL).
   Simulated practice scenario. All data is generated from the seed; videos, creators, settings
   and the 7-day reach rule are hypothetical, defined for this exercise.

   Contract: see docs/COMPANY-INTERVIEW-LOOPS.md § Executable templates (sql).
   level: 1 Medium (distinct remix creators per original, the original's own creator excluded,
            7 days inclusive; each original's setting recorded once, when it was published)
          2 Hard (+ settings changed after publishing: the setting in force at publish time
            decides, not the latest; originals published either side of a week boundary)
          3 Very Hard (+ settings changed while the video was a draft, one exactly at publish
            time; remixes of remixes, which are not originals and reach no original) */
import { insertSQL, ts } from "../../js/rng.js";

export const kind = "sql";

const EPOCH = "2026-01-01";
const W0 = 270 * 86400;                                       // 2026-09-28, a Monday
const DAY = 86400, WEEK = 7 * DAY;

function addDays(day, n) {
  const d = new Date(Date.UTC(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10) + n));
  return d.toISOString().slice(0, 10);
}
const stamp = (t) => ts(addDays(EPOCH, Math.floor(t / DAY)), ((t % DAY) + DAY) % DAY);
const weekOf = (t) => addDays(EPOCH, Math.floor((t - W0) / WEEK) * 7 + W0 / DAY);

export function generate(r, level) {
  const creators = r.sample(Array.from({ length: 30 }, (_, i) => "cr_" + (210 + 17 * i)), 7).sort();
  const videos = [];                                          // {id, creator, t, source, type}
  const settings = [];                                        // {video, t, allowed}
  let vNo = 700000 + r.int(0, 90000);
  const newVideo = (creator, t, source = null, type = null) => {
    const v = { id: "v" + (vNo += r.int(1, 60)), creator, t, source, type };
    videos.push(v);
    return v;
  };
  const set = (v, t, allowed) => settings.push({ video: v, t, allowed });
  const remix = (orig, creator, t, type = r.pick(["duet", "stitch"])) => {
    const x = newVideo(creator, t, orig, type);
    set(x, t, true);
    return x;
  };
  const others = (c) => creators.filter((x) => x !== c);

  const originals = [];
  const newOriginal = (t, allowed = r.chance(0.85)) => {
    const o = newVideo(r.pick(creators), t);
    originals.push(o);
    if (level === 3 && r.chance(0.5)) {                       // changed while a draft
      set(o, t - r.int(3600, 3 * DAY), !allowed);
      if (r.chance(0.5)) set(o, t - r.int(60, 3000), allowed);
      else set(o, t, allowed);                               // or exactly when it was published
    } else set(o, t, allowed);
    return o;
  };
  const n = 7 + 2 * level;
  for (let i = 0; i < n; i++) newOriginal(W0 + r.int(0, 2 * WEEK - DAY));

  // Remixes of originals that allowed remixing when published: inside and outside 7 days.
  for (const o of originals.slice()) {
    if (!settings.filter((s) => s.video === o && s.t <= o.t).sort((a, b) => b.t - a.t)[0].allowed) continue;
    const k = r.int(0, 4);
    for (let i = 0; i < k; i++) remix(o, r.pick(others(o.creator)), o.t + r.int(600, r.chance(0.2) ? 9 * DAY : 6 * DAY));
  }
  // Planted on one original: the same creator duets and stitches it; its own creator duets it;
  // a remix exactly 7 days after (counts) and one 7 days and a second after (does not).
  const o1 = newOriginal(W0 + r.int(DAY, 5 * DAY), true);
  const [cA, cB, cC] = r.sample(others(o1.creator), 3);
  remix(o1, cA, o1.t + r.int(600, 2 * DAY), "duet");
  remix(o1, cA, o1.t + r.int(2 * DAY, 4 * DAY), "stitch");
  remix(o1, o1.creator, o1.t + r.int(600, 3 * DAY), "duet");
  remix(o1, cB, o1.t + WEEK);
  remix(o1, cC, o1.t + WEEK + 1);
  // An original with no remixes at all.
  newOriginal(W0 + r.int(DAY, 12 * DAY), r.chance(0.5));
  // A first-week original remixed in the second week counts in its own week.
  const o2 = newOriginal(W0 + 6 * DAY + r.int(0, 20000), true);
  remix(o2, r.pick(others(o2.creator)), W0 + WEEK + r.int(3600, 3 * DAY));

  if (level >= 2) {
    // Turned off after publishing: still counts (its remixes came before the change).
    const o3 = newOriginal(W0 + r.int(DAY, 8 * DAY), true);
    const x3 = remix(o3, r.pick(others(o3.creator)), o3.t + r.int(600, 2 * DAY));
    set(o3, x3.t + r.int(600, DAY), false);
    // Off when published, turned on later and then remixed: excluded.
    const o4 = newOriginal(W0 + r.int(DAY, 8 * DAY), false);
    const on = o4.t + r.int(3600, 2 * DAY);
    set(o4, on, true);
    remix(o4, r.pick(others(o4.creator)), on + r.int(600, DAY));
    remix(o4, r.pick(others(o4.creator)), on + r.int(600, DAY));
    // Either side of the week boundary.
    const o5 = newOriginal(W0 + WEEK - 1, true);
    remix(o5, r.pick(others(o5.creator)), o5.t + r.int(60, DAY));
    const o6 = newOriginal(W0 + WEEK, true);
    remix(o6, r.pick(others(o6.creator)), o6.t + r.int(60, DAY));
  }
  if (level === 3) {
    // Changed during the draft to off, back on exactly at publish time: counts.
    const o7 = newVideo(r.pick(creators), W0 + r.int(DAY, 8 * DAY));
    originals.push(o7);
    set(o7, o7.t - r.int(DAY, 2 * DAY), false);
    set(o7, o7.t, true);
    remix(o7, r.pick(others(o7.creator)), o7.t + r.int(600, DAY));
    // Remixes of remixes: a stitch of a duet reaches the duet, which is not an original.
    const remixVids = videos.filter((v) => v.source && v.t < W0 + 2 * WEEK);
    for (let i = 0; i < 2; i++) {
      const src = r.pick(remixVids);
      remix(src, r.pick(others(src.creator)), src.t + r.int(600, 2 * DAY));
    }
  }

  const inForce = (v, at) => {
    const s = settings.filter((x) => x.video === v && x.t <= at).sort((a, b) => b.t - a.t)[0];
    return s ? s.allowed : false;
  };
  const latest = (v) => settings.filter((x) => x.video === v).sort((a, b) => b.t - a.t)[0].allowed;
  const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
  const solve = (o = {}) => {
    const roots = o.remixAsOriginal ? videos : originals;
    const agg = new Map();
    const g = (wk) => { if (!agg.has(wk)) agg.set(wk, { n: 0, reached: 0, creators: 0 }); return agg.get(wk); };
    for (const v of roots) {
      if (!(o.latest ? latest(v) : inForce(v, v.t))) continue;
      const wk = weekOf(v.t);
      g(wk).n++;
      const kids = videos.filter((x) => x.source === v && (o.self || x.creator !== v.creator) && (o.strict ? x.t - v.t < WEEK : x.t - v.t <= WEEK));
      if (o.remixWeek) {
        const per = new Map();
        for (const x of kids) { const w = weekOf(x.t); if (!per.has(w)) per.set(w, new Set()); per.get(w).add(x.creator); }
        for (const [w, s] of per) g(w).creators += s.size;
        if (kids.length) g(wk).reached++;
        continue;
      }
      const c = o.rows ? kids.length : new Set(kids.map((x) => x.creator)).size;
      if (c) g(wk).reached++;
      g(wk).creators += c;
    }
    const ratio = (a, b) => (b ? Math.floor((a * 200 + b) / (2 * b)) / 100 : 0);
    return [...agg.entries()].sort((a, b) => cmp(a[0], b[0])).filter(([, x]) => x.n > 0)
      .map(([wk, x]) => [wk, x.n, x.reached, x.creators, ratio(x.creators, x.n)]);
  };
  const rows = solve();

  const diagnostics = [
    { message: "Remix videos were counted, not creators. A creator who duets and stitches the same original reaches it once.", rows: solve({ rows: true }) },
    { message: "The original's own creator was counted. Remixing your own video does not add reach.", rows: solve({ self: true }) },
    { message: "The 7-day bound was treated as exclusive. A remix published exactly 7 days after the original counts.", rows: solve({ strict: true }) },
    { message: "Remix creators were counted in the week of the remix. Every remix counts in the week its original was published.", rows: solve({ remixWeek: true }) },
  ];
  if (level >= 2) diagnostics.push({ message: "The latest remix setting was used. Eligibility is the setting in force when the original was published (the latest change at or before published_at).", rows: solve({ latest: true }) });
  if (level === 3) diagnostics.push({ message: "Remix videos were treated as originals. A video that appears in remixes as remix_video_id is not an original, even when others remix it.", rows: solve({ remixAsOriginal: true }) });

  videos.sort((a, b) => a.t - b.t || cmp(a.id, b.id));
  const vCols = ["video_id", "creator_id", "published_at"];
  const vRows = videos.map((v) => [v.id, v.creator, stamp(v.t)]);
  const xCols = ["remix_video_id", "source_video_id", "remix_type"];
  const xRows = videos.filter((v) => v.source).map((v) => [v.id, v.source.id, v.type]);
  settings.sort((a, b) => cmp(a.video.id, b.video.id) || a.t - b.t);
  const sCols = ["video_id", "changed_at", "remix_allowed"];
  const sRows = settings.map((s) => [s.video.id, stamp(s.t), s.allowed]);
  const setup =
    "SET TIME ZONE 'UTC';\n" +
    "CREATE TABLE videos (\n  video_id TEXT PRIMARY KEY,\n  creator_id TEXT NOT NULL,\n  published_at TIMESTAMPTZ NOT NULL\n);\n" +
    "CREATE TABLE remixes (\n  remix_video_id TEXT PRIMARY KEY REFERENCES videos(video_id),\n  source_video_id TEXT NOT NULL REFERENCES videos(video_id),\n  remix_type TEXT NOT NULL            -- 'duet' | 'stitch'\n);\n" +
    "CREATE TABLE remix_settings (\n  video_id TEXT NOT NULL REFERENCES videos(video_id),\n  changed_at TIMESTAMPTZ NOT NULL,\n  remix_allowed BOOLEAN NOT NULL,     -- duets and stitches allowed\n  PRIMARY KEY (video_id, changed_at)\n);\n" +
    insertSQL("videos", vCols, vRows) + insertSQL("remixes", xCols, xRows) + insertSQL("remix_settings", sCols, sRows);

  return {
    vars: {
      videos: vRows.length,
      remixes: xRows.length,
      setting_rule: level === 1
        ? "In this sample each video's setting was recorded once, at the moment it was published, and never changed."
        : level === 2
          ? "Creators change the setting after publishing: the one that decides is the setting in force at `published_at`, the latest change at or before it. Weeks are Monday to Sunday in UTC, and an original published at Sunday 23:59:59 belongs to the earlier week."
          : "Creators change the setting while a video is still a draft and after publishing: the one that decides is the setting in force at `published_at`, the latest change at or before it (a change at exactly `published_at` is in force). Weeks are Monday to Sunday in UTC.",
      remix_rule: level === 3
        ? "A remix can itself be remixed (a stitch of a duet). A video listed in `remixes` as `remix_video_id` is never an original, and a remix of a remix reaches no original."
        : "In this sample every `source_video_id` is an original.",
    },
    setup,
    tables: [
      { name: "videos", columns: vCols, rows: vRows },
      { name: "remixes", columns: xCols, rows: xRows },
      { name: "remix_settings", columns: sCols, rows: sRows },
    ],
    expected: { columns: ["week_start", "originals", "remixed_originals", "remix_creators", "creators_per_original"], rows },
    diagnostics: diagnostics.filter((d) => JSON.stringify(d.rows) !== JSON.stringify(rows)),
  };
}
