/* MSF-L1-03 — Copilot suggestions kept: accepted and not undone within 5 minutes (SQL).
   Simulated practice scenario. All data is generated from the seed; apps, languages,
   counts and the "kept" rule are hypothetical, and no prompt or suggestion text exists.

   Contract: see docs/COMPANY-INTERVIEW-LOOPS.md § Executable templates (sql).
   level: 1 Medium (one acceptance per suggestion; an undo exactly 300 s later is still "within
                    5 minutes"; groups below a minimum number of suggestions are not reported)
          2 Hard (+ duplicate acceptance events: the clock runs from the LAST acceptance; undos at
                  299/300/301 s; dismissed suggestions)
          3 Very Hard (+ accept → undo → accept again; an undo before the last acceptance is
                       irrelevant; suggestions with no detected language reported as 'und') */
import { insertSQL, ts } from "../../js/rng.js";

export const kind = "sql";

const APPS = ["excel", "outlook", "powerpoint", "teams", "word"];
const LANGS = ["de", "en", "es", "fr", "ja", "pt"];
const DAYS = ["2026-09-21", "2026-09-22", "2026-09-23"];
const WINDOW = 300;

export function generate(r, level) {
  const day = r.pick(DAYS);
  const apps = r.sample(APPS, level === 1 ? 2 : 3).sort();
  const langs = r.sample(LANGS, level === 1 ? 2 : 3).sort();
  const sugg = [];                  // {id, user, app, lang, sec, events: [{type, sec}]}
  let sid = 900000 + r.int(0, 90000);
  const add = (app, lang, events, sec) => {
    const s = { id: (sid += r.int(1, 13)), user: "u" + r.int(1000, 1099), app, lang, sec, events: [] };
    let t = sec;
    for (const [type, gap] of events) { t += gap; s.events.push({ type, sec: t }); }
    sugg.push(s);
    return s;
  };
  const UNDO = level === 1 ? [20, 120, 300, 900, 2400] : [20, 120, 299, 300, 301, 900];
  const groups = [];
  for (const a of apps) for (const l of langs) groups.push([a, l]);
  for (const [app, lang] of groups) {
    const n = r.int(2, level === 1 ? 6 : 8);
    for (let k = 0; k < n; k++) {
      const sec = r.int(8 * 3600, 20 * 3600);
      const roll = r.next();
      let ev;
      if (roll < 0.3) ev = level >= 2 && r.chance(0.5) ? [["dismissed", r.int(2, 30)]] : [];
      else if (roll < 0.65) ev = [["accepted", r.int(2, 40)]];
      else ev = [["accepted", r.int(2, 40)], ["undone", r.pick(UNDO)]];
      if (level >= 2 && ev.length && ev[0][0] === "accepted" && r.chance(0.25)) ev.splice(1, 0, ["accepted", r.int(1, 4)]); // client retry
      if (level === 3 && ev.length === 2 && ev[1][0] === "undone" && r.chance(0.35)) ev.push(["accepted", r.int(5, 120)], ...(r.chance(0.5) ? [["undone", r.pick(UNDO)]] : []));
      add(app, lang, ev, sec);
    }
  }
  // Cases every instance contains. Their groups are always above the floor.
  const forcedKeys = new Set();
  const G = () => { const g = r.pick(groups); forcedKeys.add(g[0] + "|" + g[1]); return g; };
  { const [a, l] = G(); add(a, l, [["accepted", 5], ["undone", 300]], r.int(30000, 60000)); }   // exactly 5 minutes: undone in time
  { const [a, l] = G(); add(a, l, [["accepted", 5], ["undone", r.int(301, 3000)]], r.int(30000, 60000)); } // later undo: still kept
  if (level >= 2) {
    const [a, l] = G();
    add(a, l, [["accepted", 5], ["accepted", 3], ["undone", 299]], r.int(30000, 60000));        // 302 s after the first, 299 s after the last
    const [a2, l2] = G();
    add(a2, l2, [["accepted", 5], ["accepted", 2], ["accepted", 2]], r.int(30000, 60000));       // three duplicates: one acceptance
  }
  if (level === 3) {
    const [a, l] = G();
    add(a, l, [["accepted", 5], ["undone", 30], ["accepted", 40]], r.int(30000, 60000));         // re-accepted, not undone again: kept
    const [a2, l2] = G();
    add(a2, l2, [["accepted", 5], ["undone", 30], ["accepted", 40], ["undone", 200]], r.int(30000, 60000)); // re-accepted and undone: not kept
    const undApp = r.pick(apps);                                                                  // no language detected
    forcedKeys.add(undApp + "|und");
    for (let k = r.int(3, 5); k > 0; k--) add(undApp, null, r.chance(0.6) ? [["accepted", r.int(2, 40)]] : [], r.int(30000, 60000));
  }
  // A language seen only once or twice: always below the floor.
  {
    const rare = LANGS.find((l) => !langs.includes(l));
    for (let k = r.int(1, 2); k > 0; k--) add(r.pick(apps), rare, [["accepted", r.int(2, 40)]], r.int(30000, 60000));
  }

  const cmp = (x, y) => (x === y ? 0 : x === null ? 1 : y === null ? -1 : x < y ? -1 : 1);
  const share = (n, d) => (d === 0 ? null : Math.floor((n * 20000 + d) / (2 * d)) / 10000);
  let minShown = 1;
  const solve = (o = {}) => {
    const g = new Map();
    for (const s of sugg) {
      const lang = s.lang === null ? (o.nullLang ? null : "und") : s.lang;
      const key = s.app + "\u0000" + (lang === null ? "\u0001" : lang);
      if (!g.has(key)) g.set(key, { app: s.app, lang, shown: 0, acc: 0, kept: 0 });
      const e = g.get(key);
      e.shown++;
      const accs = s.events.filter((x) => x.type === "accepted").map((x) => x.sec);
      if (!accs.length) continue;
      e.acc += o.perEvent ? accs.length : 1;
      const from = o.firstAccept ? Math.min(...accs) : Math.max(...accs);
      const undone = s.events.some((x) => x.type === "undone" && (o.anyUndo || x.sec > from) && x.sec - from <= (o.exclusive ? WINDOW - 1 : WINDOW));
      if (!undone) e.kept++;
    }
    return [...g.values()]
      .filter((e) => o.noFloor || e.shown >= minShown)
      .sort((x, y) => cmp(x.app, y.app) || cmp(x.lang, y.lang))
      .map((e) => [e.app, e.lang, e.shown, e.acc, e.kept, share(e.acc, e.shown), share(e.kept, e.acc)]);
  };
  {
    const sizes = solve().map((row) => row[2]).sort((a, b) => b - a);
    const forcedMin = Math.min(...solve().filter((row) => forcedKeys.has(row[0] + "|" + row[1])).map((row) => row[2]));
    minShown = Math.min(forcedMin, Math.max(3, sizes[Math.min(sizes.length - 1, r.int(1, Math.max(1, Math.floor(sizes.length / 2))))]));
  }
  const rows = solve();

  const diagnostics = [
    { message: `Groups below the floor were reported. Only app–language groups with at least ${minShown} suggestions shown are in the result.`, rows: solve({ noFloor: true }) },
    { message: "An undo exactly 300 seconds after the acceptance was treated as outside the window. Within 5 minutes includes 300 seconds, so that suggestion was not kept.", rows: solve({ exclusive: true }) },
  ];
  if (level >= 2) {
    diagnostics.push({ message: "Acceptance events were counted instead of suggestions. A duplicate acceptance event is the same suggestion accepted once.", rows: solve({ perEvent: true }) });
    diagnostics.push({ message: "The 5 minutes were measured from the first acceptance. They run from the suggestion's last acceptance.", rows: solve({ firstAccept: true }) });
  }
  if (level === 3) {
    diagnostics.push({ message: "An undo before the last acceptance was counted. It undid an earlier acceptance; only an undo after the last acceptance, within 5 minutes, makes the suggestion not kept.", rows: solve({ anyUndo: true }) });
    diagnostics.push({ message: "Suggestions with no detected language were reported under NULL. Report them under 'und'.", rows: solve({ nullLang: true }) });
  }

  const sCols = ["suggestion_id", "user_id", "app", "language", "shown_at"];
  const sRows = sugg.slice().sort((x, y) => x.id - y.id).map((s) => [s.id, s.user, s.app, s.lang, ts(day, s.sec)]);
  const evs = [];
  for (const s of sugg) for (const e of s.events) evs.push([s.id, e.type, e.sec]);
  evs.sort((x, y) => x[2] - y[2] || x[0] - y[0]);
  let eid = 4000000 + r.int(0, 900000);
  const eCols = ["event_id", "suggestion_id", "event_type", "event_ts"];
  const eRows = evs.map(([s, t, sec]) => [eid += r.int(1, 17), s, t, ts(day, sec)]);
  const setup =
    "SET TIME ZONE 'UTC';\n" +
    "CREATE TABLE suggestions (\n  suggestion_id BIGINT PRIMARY KEY,\n  user_id TEXT NOT NULL,\n  app TEXT NOT NULL,\n  language TEXT,\n  shown_at TIMESTAMPTZ NOT NULL\n);\n" +
    "CREATE TABLE suggestion_events (\n  event_id BIGINT PRIMARY KEY,\n  suggestion_id BIGINT NOT NULL REFERENCES suggestions(suggestion_id),\n  event_type TEXT NOT NULL CHECK (event_type IN ('accepted', 'undone', 'dismissed')),\n  event_ts TIMESTAMPTZ NOT NULL\n);\n" +
    insertSQL("suggestions", sCols, sRows) + insertSQL("suggestion_events", eCols, eRows);

  return {
    vars: {
      min_shown: minShown,
      suggestions: sugg.length,
      accept_rule: level === 1
        ? "In this sample a suggestion is accepted at most once."
        : level === 2
          ? "A client can log the same acceptance more than once (a retry a few seconds later). A suggestion is accepted once however many `accepted` events it has, and the 5 minutes run from its **last** acceptance."
          : "A suggestion can be accepted, undone and accepted again, and a client can log duplicate acceptances. A suggestion is accepted once however many `accepted` events it has; the 5 minutes run from its **last** acceptance, and an undo before that acceptance does not matter.",
      lang_rule: level === 3
        ? "`language` is NULL when no language was detected; report those suggestions under the language `'und'` (undetermined)."
        : "Every suggestion has a detected language in this sample.",
    },
    setup,
    tables: [
      { name: "suggestions", columns: sCols, rows: sRows },
      { name: "suggestion_events", columns: eCols, rows: eRows },
    ],
    expected: { columns: ["app", "language", "shown", "accepted", "kept", "accept_rate", "keep_rate"], rows },
    diagnostics: diagnostics.filter((d) => JSON.stringify(d.rows) !== JSON.stringify(rows)),
  };
}
