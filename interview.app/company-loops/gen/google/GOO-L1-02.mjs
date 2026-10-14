/* GOO-L1-02 — Audience retention curve from played ranges (SQL).
   Simulated practice scenario. All data is generated from the seed.

   Contract: see docs/COMPANY-INTERVIEW-LOOPS.md § Executable templates (sql).
   level: 1 Medium (checkpoint grid per video, half-open ranges, zero rows kept)
          2 Hard (+ several ranges per view: skips forward, rewinds that overlap, starts mid-video)
          3 Very Hard (+ only views with at least min_play distinct seconds count; ranges that run past the end) */
import { insertSQL } from "../../js/rng.js";

export const kind = "sql";

const VIDEOS = ["vid_bread_basics", "vid_city_timelapse", "vid_guitar_lesson_3", "vid_lunar_eclipse", "vid_marathon_vlog", "vid_robot_arm_build"];

export function generate(r, level) {
  const step = r.pick([10, 20, 25]);
  const minPlay = level === 3 ? r.pick([20, 30, 45]) : 0;
  const videos = r.sample(VIDEOS, level === 1 ? 3 : 4).sort().map((id) => ({ id, d: r.int(12, 90) * 10 }));
  const pcts = [];
  for (let p = 0; p < 100; p += step) pcts.push(p);
  const posOf = (v, p) => Math.floor((v.d * p) / 100);

  const views = [];     // {view_id, video, ranges: [[s, e]]}
  const used = new Set();
  const newView = () => { let x; do x = "vw_" + r.int(100000, 999999); while (used.has(x)); used.add(x); return x; };
  videos.forEach((v, vi) => {
    const lastPos = posOf(v, pcts[pcts.length - 1]);
    const n = r.int(5, 8);
    for (let k = 0; k < n; k++) {
      // Video 0: nobody reaches the last checkpoint (a zero row the grid must keep).
      const cap = vi === 0 ? lastPos : v.d;
      const ranges = [];
      let s = level >= 2 && r.chance(0.2) ? r.int(0, Math.floor(v.d / 2)) : 0;
      if (s >= cap) s = 0;
      let e = k === 0 ? cap : r.pick([r.int(s + 1, cap), r.int(s + 1, cap), cap]);
      ranges.push([s, e]);
      if (level >= 2) {
        const extra = r.int(0, 2);
        for (let j = 0; j < extra && e < cap - 10; j++) {
          const kind = r.pick(["skip", "rewind"]);
          const s2 = kind === "skip" ? Math.min(cap - 5, e + r.int(5, 60)) : Math.max(0, e - r.int(5, 40));
          const e2 = Math.min(cap, s2 + r.int(5, 120));
          if (e2 > s2) { ranges.push([s2, e2]); e = Math.max(e, e2); }
        }
      }
      views.push({ view_id: newView(), video: v, ranges });
    }
    // Every level: a range that ends exactly on a checkpoint (excluded there), one that starts on it (included).
    const p = pcts[1 + r.int(0, pcts.length - 2)];
    const x = posOf(v, p);
    if (vi !== 0 || x < lastPos) {
      views.push({ view_id: newView(), video: v, ranges: [[0, x]] });
      if (level >= 2) {
        const cap = vi === 0 ? lastPos : v.d;
        views.push({ view_id: newView(), video: v, ranges: [[0, 5 + r.int(0, 20)], [x, Math.min(cap, x + 60)]] });
        // A rewind across the checkpoint: two ranges cover it, the view counts once.
        views.push({ view_id: newView(), video: v, ranges: [[0, Math.min(cap, x + 10)], [Math.max(0, x - 5), Math.min(cap, x + 20)]] });
      }
    }
  });
  if (level === 3) {
    for (const v of r.sample(videos.slice(1), 2)) {      // video 0 keeps its empty last checkpoint
      // Rewatched the same few seconds: the lengths add up to min_play, the distinct seconds do not.
      const a = r.int(0, Math.floor(v.d / 2));
      views.push({ view_id: newView(), video: v, ranges: [[a, a + minPlay - 5], [a + 2, a + minPlay - 3]] });
      // Ran past the end: only the part inside the video counts.
      views.push({ view_id: newView(), video: v, ranges: [[v.d - minPlay + 2, v.d + r.int(4, 8)]] });
      // A bounce.
      views.push({ view_id: newView(), video: v, ranges: [[0, r.int(1, Math.min(10, minPlay - 1))]] });
    }
    // A long, clearly engaged view on every video keeps every denominator positive.
    for (const v of videos) views.push({ view_id: newView(), video: v, ranges: [[0, Math.min(v.d, posOf(v, pcts[pcts.length - 1]))]] });
  }

  const union = (ranges, d, clamp, sum) => {
    const rs = ranges.map(([s, e]) => (clamp ? [Math.max(0, s), Math.min(e, d)] : [s, e])).filter(([s, e]) => e > s).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    if (sum) return rs.reduce((t, [s, e]) => t + e - s, 0);
    let total = 0, cs = null, ce = null;
    for (const [s, e] of rs) {
      if (cs === null || s > ce) { if (cs !== null) total += ce - cs; cs = s; ce = e; }
      else ce = Math.max(ce, e);
    }
    if (cs !== null) total += ce - cs;
    return total;
  };

  const solve = (o = {}) => {
    const rows = [];
    for (const v of videos) {
      const vs = views.filter((w) => w.video === v);
      const engaged = vs.filter((w) => union(w.ranges, v.d, !o.noClamp, o.sumLengths) >= minPlay);
      const denom = o.denomAll ? vs.length : engaged.length;
      for (const p of pcts) {
        const x = posOf(v, p);
        let viewers = 0;
        for (const w of engaged) {
          const hits = w.ranges.filter(([s, e]) => s <= x && (o.inclusiveEnd ? x <= e : x < Math.min(e, v.d))).length;
          viewers += o.countRanges ? hits : hits > 0 ? 1 : 0;
        }
        if (o.noGrid && viewers === 0) continue;
        rows.push([v.id, p, viewers, Math.floor((viewers * 20000 + denom) / (2 * denom)) / 10000]);
      }
    }
    return rows;
  };
  const rows = solve();

  const diagnostics = [
    { message: "A range that ends exactly at a checkpoint was counted there. Ranges are half-open: start_s ≤ position < end_s.", rows: solve({ inclusiveEnd: true }) },
    { message: "Checkpoints that nobody reached are missing. Every video has a row for every checkpoint, with 0 viewers.", rows: solve({ noGrid: true }) },
  ];
  if (level >= 2) diagnostics.push({ message: "Ranges were counted instead of views. A view that rewinds over a checkpoint still counts once.", rows: solve({ countRanges: true }) });
  if (level === 3) {
    diagnostics.push({ message: "Played time was the sum of range lengths. Rewatched seconds count once: merge overlapping ranges first.", rows: solve({ sumLengths: true }) });
    diagnostics.push({ message: "Ranges were not clipped to the video's duration, so a range past the end added seconds that do not exist.", rows: solve({ noClamp: true }) });
    diagnostics.push({ message: "Short views were removed from the numerator but not from the denominator.", rows: solve({ denomAll: true }) });
  }

  const vCols = ["video_id", "duration_s"];
  const vRows = videos.map((v) => [v.id, v.d]);
  const wCols = ["view_id", "video_id"];
  const shuffled = r.shuffle(views);
  const wRows = shuffled.map((w) => [w.view_id, w.video.id]).sort((a, b) => (a[0] < b[0] ? -1 : 1));
  const rCols = ["view_id", "start_s", "end_s"];
  const rRows = [];
  for (const w of shuffled) for (const [s, e] of w.ranges) rRows.push([w.view_id, s, e]);
  rRows.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] - b[1]));
  const setup =
    "SET TIME ZONE 'UTC';\n" +
    "CREATE TABLE videos (\n  video_id TEXT PRIMARY KEY,\n  duration_s INT NOT NULL\n);\n" +
    "CREATE TABLE views (\n  view_id TEXT PRIMARY KEY,\n  video_id TEXT NOT NULL REFERENCES videos(video_id)\n);\n" +
    "CREATE TABLE played_ranges (\n  view_id TEXT NOT NULL REFERENCES views(view_id),\n  start_s INT NOT NULL,\n  end_s INT NOT NULL CHECK (end_s > start_s)\n);\n" +
    insertSQL("videos", vCols, vRows) + insertSQL("views", wCols, wRows) + insertSQL("played_ranges", rCols, rRows);

  return {
    vars: {
      step,
      min_play: minPlay,
      views: views.length,
      ranges: rRows.length,
      last_pct: pcts[pcts.length - 1],
      range_rule: level === 1
        ? "In this sample every view has one range starting at 0."
        : "A view can have several ranges: a skip forward leaves a gap, a rewind overlaps what was already played, and a view opened from a shared link starts mid-video.",
      play_rule: level === 3
        ? `Only **engaged** views count, in the numerator and the denominator: views with at least ${minPlay} distinct seconds played. Seconds watched twice count once, and a range that runs past \`duration_s\` counts only up to it.`
        : "Every view counts.",
    },
    setup,
    tables: [
      { name: "videos", columns: vCols, rows: vRows },
      { name: "views", columns: wCols, rows: wRows },
      { name: "played_ranges", columns: rCols, rows: rRows },
    ],
    expected: { columns: ["video_id", "pct", "viewers", "retention"], rows },
    diagnostics: diagnostics.filter((d) => JSON.stringify(d.rows) !== JSON.stringify(rows)),
  };
}
