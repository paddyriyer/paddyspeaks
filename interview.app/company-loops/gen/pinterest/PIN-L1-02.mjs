/* PIN-L1-02 — Visual search success per entry point and week (SQL).
   Simulated practice scenario. All data is generated from the seed; entry points, the
   10-minute window and the success rule are hypothetical. The search log holds the entry
   point and time only: never the image the pinner searched with.

   Contract: see docs/COMPANY-INTERVIEW-LOOPS.md § Executable templates (sql).
   level: 1 Medium (a save or closeup by the same pinner within 10 minutes, inclusive; one week)
          2 Hard (+ the window ends at the pinner's next visual search; two weeks, a search
            late on Sunday succeeding after midnight)
          3 Very Hard (+ an action on the pin a crop was taken from does not count) */
import { insertSQL, ts } from "../../js/rng.js";

export const kind = "sql";

const ENTRY = ["camera", "crop", "upload"];
const DAY0 = "2026-09-21";                                   // a Monday

function addDays(day, n) {
  const d = new Date(Date.UTC(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10) + n));
  return d.toISOString().slice(0, 10);
}
const stamp = (t) => ts(addDays(DAY0, Math.floor(t / 86400)), t % 86400);
const weekOf = (t) => addDays(DAY0, 7 * Math.floor(t / (7 * 86400)));

export function generate(r, level) {
  const nDays = level === 1 ? 7 : 14;
  const searches = [];                                       // {pinner, entry, src, t}
  const actions = [];                                        // {pinner, pin, action, t}
  let uid = 100 + r.int(0, 800);
  const newPinner = () => "u_" + (uid += r.int(1, 30));
  let pinNo = 2000 + r.int(0, 5000);
  const newPin = () => "pin_" + (pinNo += r.int(1, 60));
  const base = () => r.int(0, nDays - 1) * 86400 + r.int(3600, 79200);
  const search = (pinner, t, entry) => {
    const e = entry || r.pick(ENTRY);
    const s = { pinner, entry: e, src: e === "crop" ? newPin() : null, t };
    searches.push(s);
    return s;
  };
  const act = (pinner, t, action, pin) => actions.push({ pinner, pin: pin || newPin(), action: action || r.pick(["save", "closeup"]), t });

  const scen = {
    simple: () => { const u = newPinner(), t = base(); search(u, t); act(u, t + r.int(20, 540)); },
    double: () => { const u = newPinner(), t = base(); search(u, t); act(u, t + r.int(20, 200), "closeup"); act(u, t + r.int(210, 590), "save"); },
    edgeIn: () => { const u = newPinner(), t = base(); search(u, t); act(u, t + 600); },
    edgeOut: () => { const u = newPinner(), t = base(); search(u, t); act(u, t + 601); },
    before: () => { const u = newPinner(), t = base(); search(u, t); act(u, t - r.int(30, 500)); },
    click: () => { const u = newPinner(), t = base(); search(u, t); act(u, t + r.int(20, 300), "outbound_click"); },
    none: () => { const u = newPinner(); search(u, base()); },
    other: () => { const u = newPinner(), t = base(); search(u, t); act(newPinner(), t + r.int(20, 300), "save"); },
    cut: () => {
      const u = newPinner(), t = base(), g = r.int(120, 400);
      const [e1, e2] = r.sample(ENTRY, 2);
      search(u, t, e1); search(u, t + g, e2); act(u, t + g + r.int(10, 150));
    },
    cutExact: () => {
      const u = newPinner(), t = base(), g = r.int(120, 400);
      const [e1, e2] = r.sample(ENTRY, 2);
      search(u, t, e1); search(u, t + g, e2); act(u, t + g, "closeup");
    },
    sunday: () => { const u = newPinner(), t = 6 * 86400 + r.int(86100, 86280); search(u, t); act(u, 7 * 86400 + r.int(60, 200)); },
    cropSrc: () => { const u = newPinner(), t = base(); const s = search(u, t, "crop"); act(u, t + r.int(20, 300), r.pick(["save", "closeup"]), s.src); },
    cropBoth: () => { const u = newPinner(), t = base(); const s = search(u, t, "crop"); act(u, t + r.int(20, 200), "closeup", s.src); act(u, t + r.int(210, 500), "save"); },
  };
  const plan = ["simple", "simple", "double", "edgeIn", "edgeOut", "before", "click", "none", "other"];
  if (level >= 2) plan.push("cut", "cutExact", "sunday");
  if (level === 3) plan.push("cropSrc", "cropBoth");
  for (let i = 0; i < 4 + 2 * level; i++) plan.push(r.pick(["simple", "simple", "double", "none", "click", "before"]));
  for (const k of r.shuffle(plan)) scen[k]();

  // Ids increase with time, as a log's would.
  searches.sort((a, b) => a.t - b.t || (a.pinner < b.pinner ? -1 : 1));
  actions.sort((a, b) => a.t - b.t || (a.pinner < b.pinner ? -1 : 1));
  let sid = 70000 + r.int(0, 20000), aid = 400000 + r.int(0, 90000);
  for (const s of searches) s.id = "vs_" + (sid += r.int(1, 7));
  for (const a of actions) a.id = (aid += r.int(1, 7));

  const cmp = (x, y) => (x < y ? -1 : x > y ? 1 : 0);
  const solve = (o = {}) => {
    const agg = new Map();
    for (const s of searches) {
      const next = searches.filter((x) => x.pinner === s.pinner && x.t > s.t).reduce((m, x) => Math.min(m, x.t), Infinity);
      const hits = actions.filter((a) =>
        a.pinner === s.pinner &&
        (o.click || a.action !== "outbound_click") &&
        (o.before ? Math.abs(a.t - s.t) <= 600 : a.t >= s.t) &&
        (o.strict ? a.t < s.t + 600 : a.t <= s.t + 600) &&
        (o.noCut || level === 1 || a.t < next) &&
        (o.srcCounts || level < 3 || a.pin !== s.src));
      const k = weekOf(s.t) + "|" + s.entry;
      if (!agg.has(k)) agg.set(k, { n: 0, ok: 0 });
      const g = agg.get(k);
      g.n++;
      g.ok += o.joinRows ? hits.length : hits.length ? 1 : 0;
    }
    const rate = (a, b) => Math.floor((a * 20000 + b) / (2 * b)) / 10000;
    return [...agg.entries()].sort((x, y) => cmp(x[0], y[0])).map(([k, g]) => {
      const [wk, e] = k.split("|");
      return [wk, e, g.n, g.ok, rate(g.ok, g.n)];
    });
  };
  const rows = solve();

  const diagnostics = [
    { message: "Successful searches were counted as joined action rows. A search with a closeup and a save is one successful search.", rows: solve({ joinRows: true }) },
    { message: "Outbound clicks were counted. Only a save or a closeup makes a search successful.", rows: solve({ click: true }) },
    { message: "The 10-minute window was treated as exclusive. An action exactly 10 minutes after the search still counts.", rows: solve({ strict: true }) },
    { message: "Actions before the search were counted. Only actions at or after the search time follow it.", rows: solve({ before: true }) },
  ];
  if (level >= 2) diagnostics.push({ message: "The window was not cut at the pinner's next visual search. An action at or after the next search belongs to that later search only.", rows: solve({ noCut: true }) });
  if (level === 3) diagnostics.push({ message: "Actions on the pin a crop was taken from were counted. They do not make the crop search successful.", rows: solve({ srcCounts: true }) });

  const sCols = ["search_id", "pinner_id", "entry_point", "source_pin_id", "searched_at"];
  const sRows = searches.map((s) => [s.id, s.pinner, s.entry, s.src, stamp(s.t)]);
  const aCols = ["action_id", "pinner_id", "pin_id", "action", "action_ts"];
  const aRows = actions.map((a) => [a.id, a.pinner, a.pin, a.action, stamp(a.t)]);
  const setup =
    "SET TIME ZONE 'UTC';\n" +
    "CREATE TABLE visual_searches (\n  search_id TEXT PRIMARY KEY,\n  pinner_id TEXT NOT NULL,\n  entry_point TEXT NOT NULL CHECK (entry_point IN ('camera', 'crop', 'upload')),\n  source_pin_id TEXT,              -- the pin a crop was taken from; NULL for camera and upload\n  searched_at TIMESTAMPTZ NOT NULL\n);\n" +
    "CREATE TABLE pin_actions (\n  action_id BIGINT PRIMARY KEY,\n  pinner_id TEXT NOT NULL,\n  pin_id TEXT NOT NULL,\n  action TEXT NOT NULL CHECK (action IN ('closeup', 'save', 'outbound_click')),\n  action_ts TIMESTAMPTZ NOT NULL\n);\n" +
    insertSQL("visual_searches", sCols, sRows) + insertSQL("pin_actions", aCols, aRows);

  return {
    vars: {
      searches: searches.length,
      actions: actions.length,
      next_rule: level === 1
        ? "The data covers one week."
        : "The data covers two weeks. A search's window also ends at the same pinner's next visual search: an action at or after that next search belongs to the later search only. A search belongs to the week of `searched_at`, even when its action falls in the next week.",
      crop_rule: level === 3
        ? "For a crop search, an action on `source_pin_id` (the pin the crop was taken from) does not count: the pinner was already looking at that pin."
        : "`source_pin_id` is informational in this exercise.",
    },
    setup,
    tables: [
      { name: "visual_searches", columns: sCols, rows: sRows },
      { name: "pin_actions", columns: aCols, rows: aRows },
    ],
    expected: { columns: ["week_start", "entry_point", "searches", "successful_searches", "success_rate"], rows },
    diagnostics: diagnostics.filter((d) => JSON.stringify(d.rows) !== JSON.stringify(rows)),
  };
}
