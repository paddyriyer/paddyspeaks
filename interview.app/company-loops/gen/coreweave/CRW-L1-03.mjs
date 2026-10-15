/* CRW-L1-03 — Contracted power per data hall and day (SQL).
   Simulated practice scenario. All data is generated from the seed; halls, contracted
   power and draws are hypothetical figures, not any real site's.

   Contract: generate(r, level) -> { vars, setup, tables, expected, diagnostics }.
   The oracle below works on half-hour slot numbers in JavaScript; the evaluator's
   reference SQL works on timestamps, so each checks the other.
   level: 1 Medium (one day, every hall on UTC, one copy of each reading) · 2 Hard
          (+ a second day, readings re-sent with corrected values, a hall-day with no
          readings) · 3 Very Hard (+ halls in other time zones: the day is the site's
          local day) */
import { insertSQL, pad2 } from "../../js/rng.js";

export const kind = "sql";

const BASE = Date.UTC(2026, 8, 14);              // 2026-09-14 00:00 UTC = minute 0
const ZONES = [["America/New_York", -4], ["America/Chicago", -5], ["America/Los_Angeles", -7], ["Europe/London", 1], ["Europe/Madrid", 2]];   // offsets in mid-September 2026
const SITES = ["site-a", "site-b", "site-c", "site-d"];

function stamp(min, sec = 0) {
  const d = new Date(BASE + min * 60000 + sec * 1000);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())} ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}:${pad2(d.getUTCSeconds())}+00`;
}
const dayName = (k) => `2026-09-${14 + k}`;
const kw = (d10) => (d10 / 10).toFixed(1);

export function generate(r, level) {
  const days = level === 1 ? 1 : 2;
  const sites = r.sample(SITES, 2);
  const halls = [];
  for (let i = 0; i < 3; i++) {
    const zone = level === 3 && i < 2 ? ZONES[r.int(0, ZONES.length - 1)] : ["UTC", 0];
    halls.push({ id: `${sites[i % 2]}-hall-${i + 1}${r.pick(["a", "b", "c"])}`, zone: zone[0], off: zone[1], c: r.pick([1800, 2400, 3200, 4000, 5000]) });
  }
  if (level === 3 && halls[0].zone === halls[1].zone) { const z = ZONES.find((x) => x[0] !== halls[0].zone); halls[1].zone = z[0]; halls[1].off = z[1]; }

  // Which slots each hall-day is missing: a single missing slot (not a gap), a gap at
  // the start of the day, a gap in the middle; at Hard, one hall-day with no readings.
  const hallDays = [];
  for (let k = 0; k < days; k++) for (const h of halls) hallDays.push({ h, k, missing: new Set() });
  const plan = r.shuffle(hallDays);
  const single = r.int(3, 44);
  plan[0].missing.add(single);
  const g = r.int(2, 3);
  for (let s = 0; s < g; s++) plan[1].missing.add(s);                       // first reading at 01:00 or later
  const mid = r.int(8, 40), len = r.int(2, 4);
  for (let s = mid; s < mid + len; s++) plan[2].missing.add(s);
  if (level >= 2) for (let s = 0; s < 48; s++) plan[3].missing.add(s);
  if (r.chance(0.5)) plan[plan.length - 1].missing.add(r.pick([0, 47]));   // one slot at an edge: still not a gap
  if (level >= 2 && r.chance(0.5)) { plan[4].missing.add(46); plan[4].missing.add(47); }   // a gap at the end of the day

  const readings = [];     // {h, k, slot, d10, recv}   recv in seconds after the slot ends
  for (const hd of hallDays) {
    const { h } = hd;
    let base = Math.round(h.c * 10 * (r.int(70, 84) / 100));
    const spikeAt = r.int(10, 40), spikeLen = r.int(1, 4);
    for (let s = 0; s < 48; s++) {
      if (hd.missing.has(s)) continue;
      base += r.int(-20, 20) * Math.max(1, Math.round(h.c / 1000));
      base = Math.max(Math.round(h.c * 6.5), Math.min(Math.round(h.c * 8.7), base));
      let d10 = base;
      if (s >= spikeAt && s < spikeAt + spikeLen) d10 = 9 * h.c + r.int(1, Math.round(h.c * 0.8));   // above 90%
      readings.push({ h, k: hd.k, slot: s, d10, recv: r.int(20, 240) });
    }
  }
  // A reading of exactly 90% of the contract (not above it).
  const ex = r.pick(readings.filter((x) => x.d10 < 9 * x.h.c));
  ex.d10 = 9 * ex.h.c;
  // Hard: re-sent readings. The first copy arrived earlier with a wrong value; the copy
  // received last is authoritative. One stale copy is a false spike above the real peak.
  const copies = [];
  if (level >= 2) {
    for (const x of r.sample(readings.filter((y) => y.d10 < 9 * y.h.c && y !== ex), 4)) {
      const stale = r.chance(0.5) || copies.length === 0 ? 9 * x.h.c + Math.round(x.h.c * 1.2) : x.d10 - r.int(5, 60);
      copies.push({ ...x, d10: stale, recv: x.recv - r.int(5, 15) });
    }
  }

  // ---- Oracle ------------------------------------------------------------------------
  const compute = (o = {}) => {
    const cells = new Map();                    // hall|dayIndex -> Map(slot -> {d10, recv}) or list
    const add = (x) => {
      let k = x.k, slot = x.slot;
      if (o.utcDay) {                           // the UTC day instead of the site's local day
        const utc = x.k * 1440 + x.slot * 30 - x.h.off * 60;
        k = Math.floor(utc / 1440);
        slot = (utc - k * 1440) / 30;
      }
      if (k < 0 || k >= days) return;
      const key = x.h.id + "|" + k;
      if (!cells.has(key)) cells.set(key, []);
      cells.get(key).push({ slot, d10: x.d10, recv: x.recv });
    };
    for (const x of readings) add(x);
    for (const x of copies) add(x);
    const rows = [];
    for (let k = 0; k < days; k++) {
      for (const h of halls.slice().sort((a, b) => (a.id < b.id ? -1 : 1))) {
        let list = cells.get(h.id + "|" + k) || [];
        if (!o.noDedup) {
          const best = new Map();
          for (const x of list) if (!best.has(x.slot) || x.recv > best.get(x.slot).recv) best.set(x.slot, x);
          list = [...best.values()];
        }
        const n = list.length;
        const peak = n ? Math.max(...list.map((x) => x.d10)) : null;
        const pct = n ? Math.floor((200 * peak + h.c) / (2 * h.c)) / 10 : null;
        const above = 30 * list.filter((x) => (o.atLeast ? x.d10 >= 9 * h.c : x.d10 > 9 * h.c)).length;
        const slots = [...new Set(list.map((x) => x.slot))].sort((a, b) => a - b);
        const marks = o.noEdges ? slots : [-1, ...slots, 48];
        let gap = false;
        for (let i = 1; i < marks.length; i++) if (marks[i] - marks[i - 1] - 1 >= (o.singleSlot ? 1 : 2)) gap = true;
        rows.push([dayName(k), h.id, n, peak === null ? null : kw(peak), pct, above, gap]);
      }
    }
    return rows;
  };
  const rows = compute();

  const diagnostics = [
    { message: "A reading of exactly 90% of the contract was counted as above it. Only a draw strictly greater than 90% counts.", rows: compute({ atLeast: true }) },
    { message: "Gaps were only looked for between readings. An hour with no reading at the start or end of the day is a gap too.", rows: compute({ noEdges: true }) },
    { message: "A single missing half-hour was flagged. A gap is 60 minutes or more with no reading covering them; one missing reading leaves only 30.", rows: compute({ singleSlot: true }) },
  ];
  if (level >= 2) diagnostics.push({ message: "Re-sent readings were all counted. Keep one reading per hall and reading_ts: the copy with the latest received_at.", rows: compute({ noDedup: true }) });
  if (level === 3) diagnostics.push({ message: "Readings were grouped by UTC day. The day is the hall's local day in its site_tz.", rows: compute({ utcDay: true }) });

  // ---- Tables ----------------------------------------------------------------------------
  const hCols = ["hall_id", "site_tz", "contracted_kw"];
  const hRows = halls.slice().sort((a, b) => (a.id < b.id ? -1 : 1)).map((h) => [h.id, h.zone, h.c]);
  const utcMin = (x) => x.k * 1440 + x.slot * 30 - x.h.off * 60;
  const all = readings.concat(copies).map((x) => [x.h.id, stamp(utcMin(x)), kw(x.d10), stamp(utcMin(x) + 30, x.recv), utcMin(x) * 1000 + x.recv]);
  all.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[4] - b[4]));
  const rCols = ["hall_id", "reading_ts", "draw_kw", "received_at"];
  const rRows = all.map((x) => x.slice(0, 4));

  const setup =
    "SET TIME ZONE 'UTC';\n" +
    "CREATE TABLE halls (\n  hall_id TEXT PRIMARY KEY,\n  site_tz TEXT NOT NULL,\n  contracted_kw INT NOT NULL\n);\n" +
    "CREATE TABLE power_readings (\n  hall_id TEXT NOT NULL REFERENCES halls(hall_id),\n  reading_ts TIMESTAMPTZ NOT NULL,\n  draw_kw NUMERIC(7,1) NOT NULL,\n  received_at TIMESTAMPTZ NOT NULL\n);\n" +
    insertSQL("halls", hCols, hRows) + insertSQL("power_readings", rCols, rRows);

  return {
    vars: {
      first_day: dayName(0),
      last_day: dayName(days - 1),
      days_rule: days === 1 ? "The report covers one day, 2026-09-14." : "The report covers 2026-09-14 and 2026-09-15.",
      dup_rule: level === 1
        ? "Each half-hour has at most one reading per hall."
        : "A meter can re-send a reading with a corrected value: the same hall_id and reading_ts appear more than once, and the copy with the latest received_at is authoritative.",
      tz_rule: level === 3
        ? "Halls are in different time zones, so a hall's day runs from local midnight to local midnight in its site_tz."
        : "Every hall in this data is on UTC.",
      readings: rRows.length,
    },
    setup,
    tables: [
      { name: "halls", columns: hCols, rows: hRows },
      { name: "power_readings", columns: rCols, rows: rRows },
    ],
    expected: { columns: ["day", "hall_id", "readings", "peak_kw", "peak_pct", "minutes_above_90", "data_gap"], rows },
    diagnostics: diagnostics.filter((d) => JSON.stringify(d.rows) !== JSON.stringify(rows)),
  };
}
