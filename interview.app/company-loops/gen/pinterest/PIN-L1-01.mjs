/* PIN-L1-01 — Save rate per pin format and week: unique savers per thousand impressions (SQL).
   Simulated practice scenario. All data is generated from the seed; formats, counts and the
   metric definition are hypothetical, not any product's reporting.

   Contract: see docs/COMPANY-INTERVIEW-LOOPS.md § Executable templates (sql).
   level: 1 Medium (one week; a pinner saving one pin to several boards counts once; a format with
            impressions and no saves still gets a row)
          2 Hard (+ two weeks with saves either side of Monday 00:00 UTC; a pinner who saved the pin
            in an earlier week is credited to that first week only)
          3 Very Hard (+ the impression job reloads some pin-days: only the latest load counts) */
import { insertSQL, ts } from "../../js/rng.js";

export const kind = "sql";

const FORMATS = ["idea", "product", "standard", "video"];
const DAY0 = "2026-09-07";                                   // a Monday

function addDays(day, n) {
  const d = new Date(Date.UTC(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10) + n));
  return d.toISOString().slice(0, 10);
}
const weekOf = (dayIdx) => addDays(DAY0, 7 * Math.floor(dayIdx / 7));

export function generate(r, level) {
  const nWeeks = level === 1 ? 1 : 2;
  const nDays = 7 * nWeeks;
  const quiet = r.pick(FORMATS);                             // a format with impressions and no savers
  const quietWeek = nWeeks - 1;
  // Pins: every format at least once, the rest random.
  const pins = [];
  let pid = 1000 + r.int(0, 8000);
  const nPins = 6 + 2 * level;
  const fmts = r.shuffle(FORMATS).concat(Array.from({ length: nPins - 4 }, () => r.pick(FORMATS)));
  for (const f of fmts) pins.push({ id: "pin_" + (pid += r.int(1, 90)), format: f });

  // Impressions: one row per pin-day on most days; every format has impressions every week.
  const imp = [];                                            // {pin, dayIdx, n, load}
  for (const p of pins) {
    for (let d = 0; d < nDays; d++) if (r.chance(0.35)) imp.push({ pin: p, dayIdx: d, n: r.int(40, 950), load: 0 });
  }
  for (const f of FORMATS) {
    for (let w = 0; w < nWeeks; w++) {
      if (!imp.some((x) => x.pin.format === f && Math.floor(x.dayIdx / 7) === w)) {
        const p = r.pick(pins.filter((q) => q.format === f));
        imp.push({ pin: p, dayIdx: 7 * w + r.int(0, 6), n: r.int(40, 950), load: 0 });
      }
    }
  }
  // Very Hard: some pin-days reloaded once or twice; the last load is the one that counts.
  const loads = [];                                          // all rows, with load index
  for (const x of imp) {
    loads.push(x);
    if (level === 3 && r.chance(0.3)) {
      const k = r.int(1, 2);
      for (let j = 1; j <= k; j++) loads.push({ pin: x.pin, dayIdx: x.dayIdx, n: r.int(40, 950), load: j });
    }
  }

  // Saves.
  const saves = [];                                          // {id, pin, pinner, board, dayIdx, sec}
  let sid = 50000 + r.int(0, 40000);
  let uid = 300 + r.int(0, 600);
  const pinners = Array.from({ length: 9 + 2 * level }, () => "u_" + (uid += r.int(1, 40)));
  const board = () => "b_" + r.int(100, 999);
  const daySec = () => (level >= 2 && r.chance(0.2) ? r.pick([r.int(86340, 86399), r.int(0, 59)]) : r.int(3600, 82800));
  const addSave = (pin, pinner, dayIdx, sec) => saves.push({ id: (sid += r.int(1, 9)), pin, pinner, board: board(), dayIdx, sec: sec ?? daySec() });
  for (const p of pins) {
    const n = p.format === quiet ? 0 : r.int(1, 4);
    for (const u of r.sample(pinners, n)) {
      const d = r.int(0, nDays - 1);
      addSave(p, u, d);
      if (r.chance(0.3)) addSave(p, u, Math.min(nDays - 1, d + r.int(0, 2)));   // same pin, another board
      if (level >= 2 && d < 7 && r.chance(0.25)) addSave(p, u, r.int(7, 13));    // again in a later week
    }
  }
  // Every level: one pinner saves one pin to three boards on the same day.
  {
    const p = r.pick(pins.filter((q) => q.format !== quiet));
    const u = r.pick(pinners), d = r.int(0, 6);
    for (let k = 0; k < 3; k++) addSave(p, u, d);
  }
  // Every level: one pinner saves two different pins of the same format in the same week.
  {
    const f = r.pick(FORMATS.filter((x) => x !== quiet && pins.filter((q) => q.format === x).length >= 2));
    if (f) {
      const [p1, p2] = r.sample(pins.filter((q) => q.format === f), 2);
      const u = r.pick(pinners), d = r.int(0, 6);
      addSave(p1, u, d);
      addSave(p2, u, d);
    }
  }
  if (level >= 2) {
    // Saves one second either side of the week boundary, and a re-save that crosses it.
    const p = r.pick(pins.filter((q) => q.format !== quiet));
    const [u1, u2] = r.sample(pinners, 2);
    addSave(p, u1, 6, 86399);
    addSave(p, u1, 7, 0);
    addSave(p, u2, 7, 0);
  }
  // Remove saves of the quiet format in its quiet week (Hard+: other weeks may have saves).
  const keep = saves.filter((s) => !(s.pin.format === quiet && Math.floor(s.dayIdx / 7) === quietWeek));
  if (level >= 2) {
    // Hard+: the quiet format has a saver in week 1, so its week-2 row is the zero row.
    const p = r.pick(pins.filter((q) => q.format === quiet));
    keep.push({ id: (sid += r.int(1, 9)), pin: p, pinner: r.pick(pinners), board: board(), dayIdx: r.int(0, 6), sec: r.int(3600, 82800) });
  }
  // Save ids increase with time, as a log's ids would.
  keep.sort((a, b) => a.dayIdx - b.dayIdx || a.sec - b.sec || a.id - b.id);
  let nid = 50000 + r.int(0, 40000);
  for (const s of keep) s.id = (nid += r.int(1, 9));

  const cmp = (x, y) => (x < y ? -1 : x > y ? 1 : 0);
  const solve = (o = {}) => {
    // Impressions per (week, format).
    const latest = new Map();
    for (const x of loads) {
      const k = x.pin.id + "|" + x.dayIdx;
      if (o.sumLoads) latest.set(k, { ...x, n: (latest.get(k)?.n || 0) + x.n });
      else if (!latest.has(k) || latest.get(k).load < x.load) latest.set(k, x);
    }
    const agg = new Map();
    for (const x of latest.values()) {
      const k = weekOf(x.dayIdx) + "|" + x.pin.format;
      if (!agg.has(k)) agg.set(k, { imp: 0, savers: new Set(), rows: 0 });
      agg.get(k).imp += x.n;
    }
    // Savers: (pin, pinner) credited to the week of the first save of that pair.
    const first = new Map();
    const ordered = keep.slice().sort((a, b) => a.dayIdx - b.dayIdx || a.sec - b.sec || a.id - b.id);
    for (const s of ordered) {
      const pair = s.pin.id + "|" + s.pinner;
      const wk = weekOf(s.dayIdx);
      const k = wk + "|" + s.pin.format;
      if (!agg.has(k)) throw new Error("PIN-L1-01: a save in a format-week without impressions");
      const a = agg.get(k);
      a.rows++;
      if (o.perWeek) a.savers.add(pair);
      else if (o.pinnerOnly) a.savers.add(s.pinner);
      else if (!first.has(pair)) { first.set(pair, wk); a.savers.add(pair); }
    }
    const per1k = (s, i) => Math.floor((2 * s * 100000 + i) / (2 * i)) / 100;
    return [...agg.entries()]
      .filter(([, a]) => !(o.innerJoin && a.rows === 0))
      .sort((x, y) => cmp(x[0], y[0]))
      .map(([k, a]) => {
        const [wk, f] = k.split("|");
        const s = o.rows ? a.rows : a.savers.size;
        return [wk, f, a.imp, s, per1k(s, a.imp)];
      });
  };
  const rows = solve();

  const diagnostics = [
    { message: "Every save row was counted. A pinner who saves one pin to several boards is one saver of that pin.", rows: solve({ rows: true }) },
    { message: "Distinct pinners were counted per format and week. The unit is a (pin, pinner) pair: a pinner who saves two different pins of the same format counts twice.", rows: solve({ pinnerOnly: true }) },
  ];
  if (level >= 2) {
    diagnostics.push({ message: "A pinner who saved the pin in an earlier week was counted again. Each (pin, pinner) pair is credited only to the week of its first save.", rows: solve({ perWeek: true }) });
    diagnostics.push({ message: "Format-weeks with impressions but no saves are missing. They are rows with 0 savers (an inner join drops them).", rows: solve({ innerJoin: true }) });
  }
  if (level === 3) diagnostics.push({ message: "Every load of a reloaded pin-day was summed. Only the latest load (highest loaded_at) of each pin and day counts.", rows: solve({ sumLoads: true }) });

  const pCols = ["pin_id", "pin_format"];
  const pRows = pins.map((p) => [p.id, p.format]);
  const iCols = ["pin_id", "impression_date", "impressions", "loaded_at"];
  const iRows = loads
    .slice()
    .sort((a, b) => cmp(a.pin.id, b.pin.id) || a.dayIdx - b.dayIdx || a.load - b.load)
    .map((x) => {
      const day = addDays(DAY0, x.dayIdx);
      return [x.pin.id, day, x.n, ts(addDays(day, 1), 7200 + r.int(0, 1800) + 18000 * x.load)];
    });
  const sCols = ["save_id", "pin_id", "pinner_id", "board_id", "saved_at"];
  const sRows = keep.map((s) => [s.id, s.pin.id, s.pinner, s.board, ts(addDays(DAY0, s.dayIdx), s.sec)]);
  const setup =
    "SET TIME ZONE 'UTC';\n" +
    "CREATE TABLE pins (\n  pin_id TEXT PRIMARY KEY,\n  pin_format TEXT NOT NULL CHECK (pin_format IN ('standard', 'video', 'idea', 'product'))\n);\n" +
    "CREATE TABLE pin_daily_impressions (\n  pin_id TEXT NOT NULL REFERENCES pins(pin_id),\n  impression_date DATE NOT NULL,\n  impressions INT NOT NULL,\n  loaded_at TIMESTAMPTZ NOT NULL,\n  PRIMARY KEY (pin_id, impression_date, loaded_at)\n);\n" +
    "CREATE TABLE saves (\n  save_id BIGINT PRIMARY KEY,\n  pin_id TEXT NOT NULL REFERENCES pins(pin_id),\n  pinner_id TEXT NOT NULL,\n  board_id TEXT NOT NULL,\n  saved_at TIMESTAMPTZ NOT NULL\n);\n" +
    insertSQL("pins", pCols, pRows) + insertSQL("pin_daily_impressions", iCols, iRows) + insertSQL("saves", sCols, sRows);

  return {
    vars: {
      pins: pins.length,
      saves: keep.length,
      week_rule: level === 1
        ? "All data falls in one week."
        : "The data covers two weeks. A pinner who saved a pin in an earlier week is not a new saver of it later: each (pin, pinner) pair is counted once, in the week of its first save.",
      load_rule: level === 3
        ? "The impression job reloads a day when late logs arrive, so a pin and day can have several rows; only the row with the latest `loaded_at` counts."
        : "Each pin and day has one impression row; `loaded_at` is when it was loaded.",
    },
    setup,
    tables: [
      { name: "pins", columns: pCols, rows: pRows },
      { name: "pin_daily_impressions", columns: iCols, rows: iRows },
      { name: "saves", columns: sCols, rows: sRows },
    ],
    expected: { columns: ["week_start", "pin_format", "impressions", "pin_savers", "savers_per_1k"], rows },
    diagnostics: diagnostics.filter((d) => JSON.stringify(d.rows) !== JSON.stringify(rows)),
  };
}
