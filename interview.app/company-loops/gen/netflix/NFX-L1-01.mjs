/* NFX-L1-01 — Early abandonment per title and country (SQL).
   Simulated practice scenario. All data is generated from the seed; titles, profiles,
   thresholds and the session rules are hypothetical.

   Contract: see docs/COMPANY-INTERVIEW-LOOPS.md § Executable templates (sql).
   level: 1 Medium (each play counts on its own; strict "< N minutes"; inclusive floor)
          2 Hard (+ home-page previews are not plays; plays of one profile and title less than
                  G minutes apart form one viewing session, judged by its furthest position)
          3 Very Hard (+ a session whose first play resumes part-way through is not a start
                  and is left out of both the numerator and the denominator) */
import { insertSQL } from "../../js/rng.js";

export const kind = "sql";

const TITLES = [
  ["tt_copper_valley", "Copper Valley", 96],
  ["tt_glass_orchard", "The Glass Orchard", 52],
  ["tt_long_relay", "The Long Relay", 118],
  ["tt_northern_signal", "Northern Signal", 44],
  ["tt_paper_lanterns", "Paper Lanterns", 61],
  ["tt_quiet_harbor", "The Quiet Harbor", 107],
  ["tt_salt_and_ember", "Salt and Ember", 38],
  ["tt_tidewater", "Tidewater", 89],
];
const COUNTRIES = ["BR", "DE", "GB", "IN", "JP", "KR", "MX", "US"];
const BASE = Date.UTC(2026, 8, 1);                       // 2026-09-01 00:00 UTC
const tsAbs = (sec) => new Date(BASE + sec * 1000).toISOString().slice(0, 19).replace("T", " ") + "+00";
const cmp = (x, y) => (x < y ? -1 : x > y ? 1 : 0);
const SLOT = 8 * 3600;                                   // every slot holds one sequence of plays

export function generate(r, level) {
  const N = r.pick([2, 3, 5]);
  const floor = r.pick([3, 4, 5]);
  const G = r.pick([10, 15, 30]);
  const NS = N * 60;
  const titles = r.sample(TITLES, level === 1 ? 3 : 4).sort((a, b) => cmp(a[0], b[0]));
  const countries = r.sample(COUNTRIES, level === 3 ? 3 : 2).sort();
  const profiles = {};
  for (const c of countries) {
    const start = r.int(10, 60);
    profiles[c] = Array.from({ length: 6 }, (_, k) => `p_${c.toLowerCase()}_${start + 3 * k}`);
  }
  let groups = [];
  for (const t of titles) for (const c of countries) if (r.chance(0.7)) groups.push({ t, c });
  if (groups.length < 4) groups = titles.flatMap((t) => countries.map((c) => ({ t, c }))).slice(0, 4);

  const seqs = [];      // each: list of {profile, title, country, startPos, endPos, gap, preview}
  const position = (t, kindOf) => {
    const run = t[2] * 60;
    if (kindOf === "early") return r.int(15, NS - 1);
    if (kindOf === "exact") return NS;
    return r.int(NS + 1, run);
  };
  const playsOf = (g, profile, P) => {
    // One viewing session whose furthest position is P, as one or more plays (Hard+).
    const base = { profile, title: g.t[0], country: g.c, preview: false };
    const gap = () => (r.chance(0.25) ? G * 60 : r.int(0, G * 60));
    if (level === 1 || r.chance(0.55) || P < 40) return [{ ...base, startPos: 0, endPos: P }];
    const shape = r.pick(["resume", "rewind", "three"]);
    if (shape === "resume") {
      const a = r.int(10, P - 10);
      return [{ ...base, startPos: 0, endPos: a }, { ...base, startPos: a, endPos: P, gap: gap() }];
    }
    if (shape === "rewind") {        // watched to P, then started again from the beginning
      const b = r.int(10, Math.max(11, Math.min(P - 1, NS - 1)));
      return [{ ...base, startPos: 0, endPos: P }, { ...base, startPos: 0, endPos: b, gap: gap() }];
    }
    const a = r.int(10, Math.floor(P / 2)), b = r.int(a + 5, P - 3);
    return [{ ...base, startPos: 0, endPos: a }, { ...base, startPos: a, endPos: b, gap: gap() }, { ...base, startPos: b, endPos: P, gap: gap() }];
  };

  groups.forEach((g, gi) => {
    const n = gi === 0 ? floor : r.int(Math.max(1, floor - 2), floor + 1);
    for (let k = 0; k < n; k++) {
      // The first group has exactly the floor of plays, one of them stopping at exactly N minutes.
      let kindOf = gi === 0 && k === 0 ? "exact" : r.pick(["early", "early", "late", "late", "late"]);
      if (r.chance(0.06)) kindOf = "exact";
      seqs.push(playsOf(g, r.pick(profiles[g.c]), position(g.t, kindOf)));
    }
  });
  // A near miss: the same profile starts the title again G minutes and 1 second after stopping.
  {
    const g = r.pick(groups), p = r.pick(profiles[g.c]);
    const base = { profile: p, title: g.t[0], country: g.c, preview: false };
    seqs.push([{ ...base, startPos: 0, endPos: r.int(15, NS - 1) }, { ...base, startPos: 0, endPos: r.int(NS + 1, g.t[2] * 60), gap: G * 60 + 1 }]);
  }
  if (level >= 2) {
    // Home-page previews: short, muted autoplays that are not plays.
    for (let k = r.int(2, 3); k > 0; k--) {
      const g = r.pick(groups);
      seqs.push([{ profile: r.pick(profiles[g.c]), title: g.t[0], country: g.c, preview: true, startPos: 0, endPos: r.int(20, Math.min(90, NS - 1)) }]);
    }
  }
  if (level === 3) {
    // Sessions that resume part-way through: not a start of the title.
    for (let k = r.int(3, 4); k > 0; k--) {
      const g = r.pick(groups);
      const s = k % 2 ? r.int(20, NS - 40) : r.int(NS + 60, g.t[2] * 60 - 400);
      seqs.push([{ profile: r.pick(profiles[g.c]), title: g.t[0], country: g.c, preview: false, startPos: s, endPos: s + r.int(15, 300) }]);
    }
    // A preview immediately followed by a resumed play: previews go before sessions are built.
    const g = r.pick(groups), p = r.pick(profiles[g.c]);
    const base = { profile: p, title: g.t[0], country: g.c };
    const s = r.int(NS + 60, g.t[2] * 60 - 600);
    seqs.push([{ ...base, preview: true, startPos: 0, endPos: r.int(20, 60) }, { ...base, preview: false, startPos: s, endPos: s + r.int(60, 500), gap: r.int(5, 120) }]);
  }

  // Lay the sequences out in time: one 8-hour slot each, in random order.
  const order = r.shuffle(seqs.map((_, i) => i));
  const plays = [];
  order.forEach((si, slot) => {
    let t = slot * SLOT + r.int(0, 1800);
    seqs[si].forEach((p, j) => {
      if (j > 0) t += p.gap;
      const start = t;
      t += p.endPos - p.startPos + r.int(0, 240);
      plays.push({ ...p, start, stop: t });
    });
  });
  plays.sort((a, b) => a.start - b.start);
  let id = 7000000 + r.int(0, 900000);
  for (const p of plays) p.id = id += r.int(1, 60);

  const gapS = level === 1 ? -1 : G * 60;
  const solve = (o = {}) => {
    const ps = plays.filter((p) => o.previews || level === 1 || !p.preview);
    const byKey = new Map();
    for (const p of ps) {
      const k = p.profile + "|" + p.title;
      if (!byKey.has(k)) byKey.set(k, []);
      byKey.get(k).push(p);
    }
    const sessions = [];
    for (const list of byKey.values()) {
      list.sort((a, b) => a.start - b.start || a.id - b.id);
      let cur = null;
      for (const p of list) {
        if (!cur || o.noMerge || p.start - cur.lastStop > gapS) {
          cur = { title: p.title, country: p.country, first: p.startPos, max: p.endPos, last: p.endPos, lastStop: p.stop };
          sessions.push(cur);
        } else {
          cur.max = Math.max(cur.max, p.endPos);
          cur.last = p.endPos;
          cur.lastStop = p.stop;
        }
      }
    }
    const per = new Map();
    for (const s of sessions) {
      if (level === 3 && !o.resumes && s.first !== 0) continue;
      const k = s.title + "|" + s.country;
      if (!per.has(k)) per.set(k, { n: 0, e: 0 });
      const g = per.get(k);
      g.n++;
      const pos = o.lastEnd ? s.last : s.max;
      if (o.inclusive ? pos <= NS : pos < NS) g.e++;
    }
    const rate = (e, n) => Math.floor((e * 20000 + n) / (2 * n)) / 10000;
    return [...per.entries()]
      .filter(([, g]) => o.noFloor || g.n >= floor)
      .map(([k, g]) => { const [t, c] = k.split("|"); return [t, c, g.n, g.e, rate(g.e, g.n)]; })
      .sort((a, b) => b[4] - a[4] || cmp(a[0], b[0]) || cmp(a[1], b[1]));
  };
  const rows = solve();

  const diagnostics = [
    { message: `A play that reached exactly ${N} minutes was counted as early. Early means the furthest position is strictly less than ${N} minutes (${NS} seconds).`, rows: solve({ inclusive: true }) },
    { message: `Titles below the floor were kept. Only title-country pairs with at least ${floor} counted plays are reported (the floor is inclusive).`, rows: solve({ noFloor: true }) },
  ];
  if (level >= 2) {
    diagnostics.push({ message: "Home-page previews were counted as plays. Rows with is_preview = true are removed before anything else.", rows: solve({ previews: true }) });
    diagnostics.push({ message: `Every play was counted on its own. Plays of one profile and title that start at most ${G} minutes after the previous one stopped are one viewing session.`, rows: solve({ noMerge: true }) });
    diagnostics.push({ message: "A session was judged by its last play's end position. Use its furthest position: someone who watched 40 minutes and then restarted the opening did not abandon early.", rows: solve({ lastEnd: true }) });
  }
  if (level === 3) diagnostics.push({ message: "Sessions that resume part-way through were counted. A session whose first play starts at a position other than 0 is not a start of the title and is left out entirely.", rows: solve({ resumes: true }) });

  const tCols = ["title_id", "title_name", "runtime_min"];
  const tRows = titles.map((t) => [t[0], t[1], t[2]]);
  const pCols = ["play_id", "profile_id", "title_id", "country", "started_at", "stopped_at", "start_position_s", "end_position_s", "is_preview"];
  const pRows = plays.map((p) => [p.id, p.profile, p.title, p.country, tsAbs(p.start), tsAbs(p.stop), p.startPos, p.endPos, p.preview]);
  const setup =
    "SET TIME ZONE 'UTC';\n" +
    "CREATE TABLE titles (\n  title_id TEXT PRIMARY KEY,\n  title_name TEXT NOT NULL,\n  runtime_min INT NOT NULL\n);\n" +
    "CREATE TABLE plays (\n  play_id BIGINT PRIMARY KEY,\n  profile_id TEXT NOT NULL,\n  title_id TEXT NOT NULL REFERENCES titles(title_id),\n  country CHAR(2) NOT NULL,\n" +
    "  started_at TIMESTAMPTZ NOT NULL,\n  stopped_at TIMESTAMPTZ NOT NULL,\n  start_position_s INT NOT NULL,\n  end_position_s INT NOT NULL,\n  is_preview BOOLEAN NOT NULL\n);\n" +
    insertSQL("titles", tCols, tRows) + insertSQL("plays", pCols, pRows);

  return {
    vars: {
      n_min: N,
      n_sec: NS,
      min_plays: floor,
      gap_min: G,
      gap_s: gapS,
      plays: plays.length,
      session_rule: level === 1
        ? "Every row of `plays` counts on its own as one play, and `is_preview` is false on every row of this sample."
        : `Rows with \`is_preview = true\` are muted home-page previews, not plays: remove them first. Then plays of the same profile and title form one viewing session while each starts at most ${G} minutes after the previous one stopped (exactly ${G} minutes still continues it). A session counts as one play; it is early when its furthest \`end_position_s\` is below ${N} minutes, and its country is its first play's country.`,
      resume_rule: level === 3
        ? "A session whose first play has `start_position_s` other than 0 resumed part-way through: it is not a start of the title and is left out of both counts."
        : "In this sample the first play of every session starts at position 0.",
    },
    setup,
    tables: [
      { name: "titles", columns: tCols, rows: tRows },
      { name: "plays", columns: pCols, rows: pRows },
    ],
    expected: { columns: ["title_id", "country", "plays", "early_stops", "early_stop_rate"], rows },
    diagnostics: diagnostics.filter((d) => JSON.stringify(d.rows) !== JSON.stringify(rows)),
  };
}
