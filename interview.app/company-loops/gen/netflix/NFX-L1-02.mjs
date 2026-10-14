/* NFX-L1-02 — Rising titles: week-over-week share-of-viewing gain per country (SQL).
   Simulated practice scenario. All data is generated from the seed; titles, profiles,
   thresholds and the ranking rules are hypothetical.

   Contract: see docs/COMPANY-INTERVIEW-LOOPS.md § Executable templates (sql).
   level: 1 Medium (share of the country's minutes, gain vs last week, distinct-viewer
                    threshold, top K with ties kept, new titles start from 0)
          2 Hard (+ sessions on the week boundaries and outside the two weeks; the share's
                  denominator includes titles that do not qualify; three countries)
          3 Very Hard (+ a viewer counts toward the threshold only with at least M minutes of
                  that title in the week, summed over their sessions) */
import { insertSQL } from "../../js/rng.js";

export const kind = "sql";

const TITLES = [
  "tt_ash_and_anchor", "tt_bright_meridian", "tt_cinder_road", "tt_deep_shelf", "tt_eastbound",
  "tt_foxglove", "tt_granite_hours", "tt_hollow_crown", "tt_iron_lagoon", "tt_juniper_lane",
  "tt_kestrel", "tt_last_ferry",
];
const COUNTRIES = ["AR", "CA", "ES", "FR", "ID", "IT", "NG", "PL", "TH"];
const WEEK_STARTS = ["2026-08-31", "2026-09-07", "2026-09-14", "2026-09-21", "2026-09-28"];   // Mondays
const DAY = 86400;
const cmp = (x, y) => (x < y ? -1 : x > y ? 1 : 0);

export function generate(r, level) {
  const ws = r.pick(WEEK_STARTS);
  const wsMs = Date.parse(ws + "T00:00:00Z");
  const tsAt = (sec) => new Date(wsMs + sec * 1000).toISOString().slice(0, 19).replace("T", " ") + "+00";
  const V = r.pick([3, 4, 5]);
  const K = r.pick([2, 3]);
  const M = level === 3 ? r.pick([10, 15, 20]) : 1;
  const countries = r.sample(COUNTRIES, level === 3 ? 3 : 2).sort();

  const sessions = [];   // {profile, title, country, week (-2..1), sec (from week start), minutes}
  const at = (week) => {
    if (level >= 2 && r.chance(0.12)) return r.pick([0, 7 * DAY - 1]);           // the first or last second of the week
    return r.int(0, 6) * DAY + r.int(60, DAY - 60);
  };
  // One viewer's total minutes in a week, as one or two sessions.
  const addViewer = (c, title, week, profile, total) => {
    const parts = total >= 6 && r.chance(0.3) ? [total - Math.floor(total / 3), Math.floor(total / 3)] : [total];
    for (const m of parts) sessions.push({ profile, title, country: c, week, sec: at(week), minutes: m });
  };
  const addWeek = (c, title, week, pool, totals) => {
    const who = r.sample(pool, totals.length);
    totals.forEach((t, i) => addViewer(c, title, week, who[i], t));
  };
  const heavy = (n, lo, hi) => Array.from({ length: n }, () => r.int(Math.max(lo, M), hi));

  for (const c of countries) {
    const start = r.int(10, 70);
    const pool = Array.from({ length: 12 }, (_, k) => `pr_${c.toLowerCase()}_${start + 2 * k}`);
    const titles = r.sample(TITLES, 7);
    const [tieA, tieB, riser, fresh, exactV, thin, faller] = titles;
    const watching = (t) => [...new Set(sessions.filter((s) => s.country === c && s.title === t && s.week === 0).map((s) => s.profile))];
    // Two titles with identical minutes in both weeks: an exact tie on gain.
    const tiePrev = heavy(r.int(1, 2), 5, 25), tieCurr = heavy(V + r.int(0, 1), r.chance(0.6) ? 60 : 25, 110);
    for (const t of [tieA, tieB]) { addWeek(c, t, -1, pool, tiePrev); addWeek(c, t, 0, pool, tieCurr); }
    addWeek(c, riser, -1, pool, heavy(r.int(1, 2), 5, 40));
    addWeek(c, riser, 0, pool, heavy(V + r.int(1, 2), 20, 100));
    addWeek(c, fresh, 0, pool, heavy(V + r.int(0, 1), 35, 100));                // not viewed last week at all
    addWeek(c, exactV, -1, pool, heavy(r.int(1, 2), 5, 30));
    addWeek(c, exactV, 0, pool, heavy(V, 40, 110));                             // exactly the threshold
    addWeek(c, thin, -1, pool, heavy(1, 5, 15));
    addWeek(c, thin, 0, pool, heavy(V - 1, 70, 120));                           // big rise, one viewer short
    addWeek(c, faller, -1, pool, heavy(r.int(2, V + 1), 40, 120));
    addWeek(c, faller, 0, pool, heavy(r.int(1, V), 5, 30));
    // One of the thin title's viewers came back twice more: more sessions, not more viewers.
    const again = r.pick(watching(thin));
    for (let k = 0; k < 2; k++) sessions.push({ profile: again, title: thin, country: c, week: 0, sec: at(0), minutes: r.int(Math.max(5, M), 40) });
    if (level === 3) {
      // A light viewer of the thin title: not a viewer for the threshold, so it stays one short.
      const free = pool.filter((p) => !watching(thin).includes(p));
      sessions.push({ profile: r.pick(free), title: thin, country: c, week: 0, sec: at(0), minutes: r.int(1, M - 1) });
      // One of exactV's viewers is replaced by one with exactly M minutes over two sessions: still exactly V.
      const pl = r.pick(watching(exactV));
      for (const s of sessions) if (s.country === c && s.title === exactV && s.week === 0 && s.profile === pl) s.minutes = 0;
      for (let i = sessions.length - 1; i >= 0; i--) if (sessions[i].minutes === 0) sessions.splice(i, 1);
      const pb = r.pick(pool.filter((p) => !watching(exactV).includes(p)));
      sessions.push({ profile: pb, title: exactV, country: c, week: 0, sec: at(0), minutes: M - 4 });
      sessions.push({ profile: pb, title: exactV, country: c, week: 0, sec: at(0), minutes: 4 });
      // And light viewers of the riser add minutes without adding viewers.
      const free2 = pool.filter((p) => !watching(riser).includes(p));
      sessions.push({ profile: r.pick(free2), title: riser, country: c, week: 0, sec: at(0), minutes: r.int(1, M - 1) });
    }
    if (level >= 2) {
      // Outside the two weeks, including the very next Monday 00:00:00 and the last second before the previous week.
      sessions.push({ profile: r.pick(pool), title: thin, country: c, week: 1, sec: 0, minutes: r.int(30, 90) });
      sessions.push({ profile: r.pick(pool), title: faller, country: c, week: -2, sec: 7 * DAY - 1, minutes: r.int(30, 90) });
      for (let k = r.int(1, 2); k > 0; k--) sessions.push({ profile: r.pick(pool), title: r.pick(titles), country: c, week: r.pick([-2, 1]), sec: r.int(0, 7 * DAY - 1), minutes: r.int(5, 90) });
    }
  }

  const absSec = (s) => s.week * 7 * DAY + s.sec;
  sessions.sort((a, b) => absSec(a) - absSec(b) || cmp(a.profile, b.profile));
  let id = 50000000 + r.int(0, 9000000);
  for (const s of sessions) s.id = id += r.int(1, 97);

  const solve = (o = {}) => {
    // Which week(s) a session falls in: half-open [start, start + 7 days), or closed when o.closed.
    const weeksOf = (s) => {
      const t = absSec(s), out = [];
      for (const w of [-1, 0]) {
        const lo = w * 7 * DAY, hi = lo + 7 * DAY;
        if (t >= lo && (o.closed ? t <= hi : t < hi)) out.push(w);
      }
      return out;
    };
    const mins = new Map(), totals = new Map(), viewers = new Map(), sessCount = new Map();
    for (const s of sessions) for (const w of weeksOf(s)) {
      const kt = s.country + "|" + s.title + "|" + w;
      mins.set(kt, (mins.get(kt) || 0) + s.minutes);
      totals.set(s.country + "|" + w, (totals.get(s.country + "|" + w) || 0) + s.minutes);
      if (w === 0) {
        const kv = s.country + "|" + s.title;
        if (!viewers.has(kv)) viewers.set(kv, new Map());
        viewers.get(kv).set(s.profile, (viewers.get(kv).get(s.profile) || 0) + s.minutes);
        sessCount.set(kv, (sessCount.get(kv) || 0) + 1);
      }
    }
    const nViewers = (kv) => (o.sessions ? sessCount.get(kv) || 0 : [...(viewers.get(kv) || new Map()).values()].filter((m) => o.anyMinutes || m >= M).length);
    const qualifies = (kv) => nViewers(kv) >= V;
    // Hundredths of a percent, rounded half up.
    const share = (m, total) => Math.floor((m * 20000 + total) / (2 * total));
    let denom = (c, w) => totals.get(c + "|" + w);
    if (o.qualifiedDenominator) {
      denom = (c, w) => {
        let sum = 0;
        for (const [k, m] of mins) { const [cc, t, ww] = k.split("|"); if (cc === c && +ww === w && qualifies(cc + "|" + t)) sum += m; }
        return sum;
      };
    }
    const out = [];
    for (const c of countries) {
      const cand = [];
      for (const [k, m] of mins) {
        const [cc, t, w] = k.split("|");
        if (cc !== c || w !== "0") continue;
        const kv = c + "|" + t;
        if (!qualifies(kv)) continue;
        const pm = mins.get(c + "|" + t + "|-1");
        if (o.innerJoin && pm === undefined) continue;
        const prev = pm === undefined ? 0 : share(pm, denom(c, -1));
        const curr = share(m, denom(c, 0));
        const gain = curr - prev;
        if (o.zeroGain ? gain < 0 : gain <= 0) continue;
        cand.push({ t, prev, curr, gain });
      }
      cand.sort((a, b) => b.gain - a.gain || cmp(a.t, b.t));
      let rank = 0, dense = 0;
      cand.forEach((x, i) => {
        if (i === 0 || x.gain !== cand[i - 1].gain) { rank = i + 1; dense++; }
        x.rank = o.rowNumber ? i + 1 : o.dense ? dense : rank;
      });
      for (const x of cand) if (x.rank <= K) out.push([c, x.t, x.prev / 100, x.curr / 100, x.gain / 100, x.rank]);
    }
    return out;
  };
  const rows = solve();

  const diagnostics = [
    { message: `Tied titles were split by ROW_NUMBER. Titles with the same gain share a rank (RANK), and every title ranked ${K} or better is kept, even if that makes more than ${K} rows.`, rows: solve({ rowNumber: true }) },
    { message: "DENSE_RANK was used. After a tie, RANK skips: two titles tied at rank 1 are followed by rank 3, not 2, so fewer titles make the cut.", rows: solve({ dense: true }) },
    { message: "The threshold counted sessions, not viewers. A profile that watched a title three times is one viewer.", rows: solve({ sessions: true }) },
    { message: "Titles not viewed last week were dropped (an inner join). Their previous share is 0, so their whole share is gain.", rows: solve({ innerJoin: true }) },
  ];
  if (level >= 2) {
    diagnostics.push({ message: "The share was computed over qualifying titles only. The denominator is every minute viewed in the country that week, whatever the title.", rows: solve({ qualifiedDenominator: true }) });
    diagnostics.push({ message: "The weeks were closed at both ends, so a session at Monday 00:00:00 counted in two weeks. Use half-open ranges: [week start, week start + 7 days).", rows: solve({ closed: true }) });
  }
  if (level === 3) diagnostics.push({ message: `Every viewer counted toward the threshold. Only profiles with at least ${M} minutes of the title that week, summed over their sessions, count.`, rows: solve({ anyMinutes: true }) });

  const cols = ["session_id", "profile_id", "title_id", "country", "started_at", "minutes_viewed"];
  const tRows = sessions.map((s) => [s.id, s.profile, s.title, s.country, tsAt(absSec(s)), s.minutes]);
  const setup =
    "SET TIME ZONE 'UTC';\n" +
    "CREATE TABLE viewing_sessions (\n  session_id BIGINT PRIMARY KEY,\n  profile_id TEXT NOT NULL,\n  title_id TEXT NOT NULL,\n  country CHAR(2) NOT NULL,\n" +
    "  started_at TIMESTAMPTZ NOT NULL,\n  minutes_viewed INT NOT NULL CHECK (minutes_viewed > 0)\n);\n" +
    insertSQL("viewing_sessions", cols, tRows);
  const prevStart = new Date(wsMs - 7 * DAY * 1000).toISOString().slice(0, 10);
  const nextStart = new Date(wsMs + 7 * DAY * 1000).toISOString().slice(0, 10);

  return {
    vars: {
      week_start: ws,
      prev_week_start: prevStart,
      next_week_start: nextStart,
      min_viewers: V,
      top_k: K,
      min_view_minutes: M,
      sessions: sessions.length,
      viewer_rule: level === 3
        ? `A profile counts as a viewer of a title only if its \`minutes_viewed\` of that title in the current week add up to at least ${M} (exactly ${M} counts).`
        : "Any profile with a session of the title in the current week counts as one viewer of it, however many sessions it had.",
      week_rule: level === 1
        ? "Every session in this sample falls inside the two weeks."
        : "The table also holds sessions from other weeks; a session exactly at a Monday 00:00:00 belongs to the week that starts then.",
    },
    setup,
    tables: [{ name: "viewing_sessions", columns: cols, rows: tRows }],
    expected: { columns: ["country", "title_id", "prev_share_pct", "curr_share_pct", "gain_pts", "gain_rank"], rows },
    diagnostics: diagnostics.filter((d) => JSON.stringify(d.rows) !== JSON.stringify(rows)),
  };
}
