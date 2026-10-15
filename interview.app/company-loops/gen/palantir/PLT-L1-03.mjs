/* PLT-L1-03 — First-pass yield per production line and shift (SQL).
   Simulated practice scenario: a generic manufacturer's end-of-line test results.
   All data is generated from the seed and is hypothetical.

   Contract: see docs/COMPANY-INTERVIEW-LOOPS.md § Executable templates (sql).
   The oracle works in the plant's local seconds and orders each unit's attempts in
   JavaScript; the setup stores UTC instants.
   level: 1 Medium (UTC plant; night shifts that cross midnight; tests exactly on shift
                    boundaries; retests by final outcome, including a pass later failed
                    on a re-test; test_id not in time order)
          2 Hard (+ void tests that are not attempts, including units with only voids and
                  a void after the last attempt; retests on another line; a fail and a
                  pass logged in the same second, decided by test_id)
          3 Very Hard (+ the plant runs on local time in a named zone, so shifts and shift
                       dates are local) */
import { insertSQL, ts, pad2 } from "../../js/rng.js";

export const kind = "sql";

const H = 3600;
const D = 86400;
const LBASE = Date.UTC(2026, 8, 15) / 1000;          // 2026-09-15 00:00 in plant-local terms
const LINES = ["line_a", "line_b", "line_c", "line_d", "line_e"];
// Offsets that hold for every date in this exercise (mid-September 2026, no DST change).
const ZONES = [["Europe/Berlin", 2 * H], ["America/Chicago", -5 * H], ["Asia/Kolkata", 5.5 * H], ["America/Sao_Paulo", -3 * H], ["Asia/Tokyo", 9 * H], ["Europe/London", 1 * H]];

const dateOf = (dayIdx) => new Date((LBASE + dayIdx * D) * 1000).toISOString().slice(0, 10);
function stampUtc(sec) {                               // seconds since LBASE, UTC instant
  const t = LBASE + sec;
  const day = new Date(t * 1000).toISOString().slice(0, 10);
  return ts(day, ((t % D) + D) % D);
}

export function generate(r, level) {
  const [tz, off] = level === 3 ? r.pick(ZONES) : ["UTC", 0];
  const lines = r.sample(LINES, level === 1 ? 2 : 3).sort();
  const tests = [];          // {unit, line, at (local s), result}
  const units = [];
  let sn = 10000 + r.int(0, 80000);
  const newUnit = () => { const u = "SN" + (sn += r.int(1, 37)); units.push(u); return u; };
  const t = (unit, line, at, result) => tests.push({ unit, line, at, result });
  const other = (line) => r.pick(lines.filter((l) => l !== line));
  const START = 6 * H, END = 2 * D + 6 * H;           // two production days of shifts

  for (const line of lines) {
    const n = level === 1 ? r.int(7, 10) : r.int(9, 12);
    for (let i = 0; i < n; i++) {
      const u = newUnit();
      let at = r.int(START, END - 1);
      if (level >= 2 && r.chance(0.12)) { t(u, line, at, "void"); at += r.int(60, 1800); }
      let k = 0;
      for (;;) {
        k++;
        const pass = r.chance(k === 1 ? 0.72 : 0.7);
        const where = level >= 2 && k > 1 && r.chance(0.3) ? other(line) : line;
        t(u, where, at, pass ? "pass" : "fail");
        if (pass || k === 3) break;
        at += r.int(10, 180) * 60;
      }
      if (level >= 2 && r.chance(0.08)) t(u, line, at + r.int(60, 900), "void");
    }
  }
  const pick = () => r.pick(lines);
  // Every level: boundary instants (local).
  const day = r.int(0, 1);
  t(newUnit(), pick(), day * D + 6 * H, r.pick(["pass", "fail"]));                     // 06:00:00 opens the day shift
  t(newUnit(), pick(), day * D + 22 * H, "pass");                                       // 22:00:00 opens the night shift
  t(newUnit(), pick(), (day + 1) * D + 6 * H - 1, r.pick(["pass", "fail"]));             // 05:59:59 is still last night
  t(newUnit(), pick(), (day + 1) * D + r.int(1, 120) * 60, "pass");                     // after midnight: previous date's night
  t(newUnit(), pick(), day * D + 14 * H - 1, "pass");                                    // 13:59:59 is still day
  // Every level: passed, then failed on a re-test. Final outcome is the last attempt.
  {
    const u = newUnit(), l = pick(), at = r.int(START, END - 6 * H);
    t(u, l, at, "pass");
    t(u, l, at + r.int(30, 240) * 60, "fail");
  }
  // Every level: failed first, passed on retest in a later shift.
  {
    const u = newUnit(), l = pick(), at = day * D + 13 * H + r.int(0, 50) * 60;
    t(u, l, at, "fail");
    t(u, l, at + r.int(70, 200) * 60, "pass");
  }
  const sameSecond = [];
  if (level >= 2) {
    // Only voids: not a unit at all for yield.
    { const u = newUnit(), l = pick(), at = r.int(START, END - H); t(u, l, at, "void"); t(u, l, at + r.int(60, 600), "void"); }
    // A void after the last attempt changes nothing.
    { const u = newUnit(), l = pick(), at = r.int(START, END - 2 * H); t(u, l, at, "fail"); t(u, l, at + 1200, "pass"); t(u, l, at + 2400, "void"); }
    // A void first: the first attempt is the next test.
    { const u = newUnit(), l = pick(), at = r.int(START, END - 2 * H); t(u, l, at, "void"); t(u, l, at + 600, "pass"); }
    // Fail and pass in the same second: test_id decides.
    {
      const u = newUnit(), l = pick(), at = r.int(START, END - 2 * H);
      const order = r.chance(0.5) ? ["fail", "pass"] : ["pass", "fail"];
      t(u, l, at, order[0]); t(u, l, at, order[1]);
      sameSecond.push([tests[tests.length - 2], tests[tests.length - 1]]);
    }
    // Retested on another line: the unit stays with the first line and shift.
    { const u = newUnit(), l = pick(), at = r.int(START, END - 4 * H); t(u, l, at, "fail"); t(u, other(l), at + r.int(4, 7) * H + r.int(0, 3599), "pass"); }
  }
  if (level === 3) {
    // Instants where UTC and local disagree on the shift or the date.
    for (const h of [5, 13, 21, 23]) t(newUnit(), pick(), day * D + h * H + r.int(30, 50) * 60, r.pick(["pass", "fail"]));
  }

  // test_id in upload order: not time order, except that same-second pairs keep their listed order.
  const ord = r.shuffle(tests);
  let id = 300000 + r.int(0, 90000);
  ord.forEach((x) => (x.id = id += r.int(1, 13)));
  for (const [a, b] of sameSecond) if (a.id > b.id) [a.id, b.id] = [b.id, a.id];

  const cmpS = (x, y) => (x < y ? -1 : x > y ? 1 : 0);
  const shiftOf = (localSec, o) => {
    const s = o.utc ? localSec - off : localSec;
    const d = Math.floor(s / D), tod = s - d * D;
    const name = tod >= 6 * H && tod < 14 * H ? "day" : tod >= 14 * H && tod < 22 * H ? "swing" : "night";
    const sd = tod < 6 * H && !o.calendar ? d - 1 : d;
    return [dateOf(sd), name];
  };
  const solve = (o = {}) => {
    const byUnit = new Map();
    for (const x of tests) {
      if (x.result === "void" && !o.voidFail && !o.voidLast) continue;
      if (!byUnit.has(x.unit)) byUnit.set(x.unit, []);
      byUnit.get(x.unit).push(x);
    }
    const per = new Map();
    const bump = (line, at, f) => {
      const [sd, sh] = shiftOf(at, o);
      const k = line + "|" + sd + "|" + sh;
      if (!per.has(k)) per.set(k, { units: 0, first: 0, re: 0, fin: 0 });
      f(per.get(k));
    };
    for (const xs0 of byUnit.values()) {
      xs0.sort(o.byId ? (a, b) => a.id - b.id : (a, b) => a.at - b.at || a.id - b.id);
      const all = xs0;
      const xs = o.voidLast ? all.filter((x, i) => x.result !== "void" || i === all.length - 1) : all;
      const att = xs.filter((x) => x.result !== "void" || o.voidFail);
      if (!att.length) continue;
      const first = att[0], last = xs[xs.length - 1];
      const fin = o.anyPass ? att.some((x) => x.result === "pass") : last.result === "pass";
      if (o.perTest) {
        for (const x of att) bump(x.line, x.at, (s) => { s.units++; if (x === first && x.result === "pass") s.first++; if (att.length > 1) s.re++; if (fin) s.fin++; });
        continue;
      }
      bump(first.line, first.at, (s) => {
        s.units++;
        if (first.result === "pass") s.first++;
        if (att.length > 1) s.re++;
        if (fin) s.fin++;
      });
    }
    const share = (n, d) => Math.floor((n * 20000 + d) / (2 * d)) / 10000;
    return [...per.entries()].sort((a, b) => cmpS(a[0], b[0])).map(([k, s]) => {
      const [line, sd, sh] = k.split("|");
      return [line, sd, sh, s.units, s.first, s.re, s.fin, share(s.first, s.units)];
    });
  };
  const rows = solve();

  const diagnostics = [
    { message: "Tests after midnight were given the calendar date. A night shift that starts at 22:00 keeps its start date until 06:00 the next morning.", rows: solve({ calendar: true }) },
    { message: "Attempts were ordered by test_id. test_id is the upload order; order by tested_at, then test_id.", rows: solve({ byId: true }) },
    { message: "The final outcome was 'any pass'. It is the result of the last attempt: a unit that passed and then failed a re-test ends as a fail.", rows: solve({ anyPass: true }) },
    { message: "Every test was counted where it happened. A unit is counted once, on the line and shift of its first attempt.", rows: solve({ perTest: true }) },
  ];
  if (level >= 2) {
    diagnostics.push({ message: "Void tests were counted as failed attempts. A void is an aborted run and is not an attempt at all.", rows: solve({ voidFail: true }) });
    diagnostics.push({ message: "A void after the last attempt was taken as the final outcome. Only pass and fail attempts decide it.", rows: solve({ voidLast: true }) });
  }
  if (level === 3) diagnostics.push({ message: "Shifts were computed in UTC. The plant's shifts are local: convert with AT TIME ZONE '" + tz + "' first.", rows: solve({ utc: true }) });

  const cols = ["test_id", "unit_serial", "line_id", "tested_at", "result"];
  const trows = tests.slice().sort((a, b) => a.id - b.id).map((x) => [x.id, x.unit, x.line, stampUtc(x.at - off), x.result]);
  const setup =
    "SET TIME ZONE 'UTC';\n" +
    "CREATE TABLE tests (\n  test_id BIGINT PRIMARY KEY,\n  unit_serial TEXT NOT NULL,\n  line_id TEXT NOT NULL,\n  tested_at TIMESTAMPTZ NOT NULL,\n  result TEXT NOT NULL CHECK (result IN ('pass', 'fail', 'void'))\n);\n" +
    insertSQL("tests", cols, trows);

  const offTxt = (off >= 0 ? "+" : "-") + pad2(Math.floor(Math.abs(off) / H)) + ":" + pad2((Math.abs(off) % H) / 60);
  return {
    vars: {
      tz,
      tests: trows.length,
      tz_rule: level === 3
        ? `The plant runs on local time in \`${tz}\` (UTC${offTxt} on every date in this sample); \`tested_at\` is stored as an instant, so convert it before you assign shifts.`
        : "The plant runs on UTC, so local time and UTC agree.",
      void_rule: level === 1
        ? "In this sample no test is void, but the rule still holds."
        : "Void tests are common: some units have a void before their first attempt, after their last, or nothing but voids.",
    },
    setup,
    tables: [{ name: "tests", columns: cols, rows: trows }],
    expected: { columns: ["line_id", "shift_date", "shift", "units", "first_pass", "retested", "final_pass", "fpy"], rows },
    diagnostics: diagnostics.filter((d) => JSON.stringify(d.rows) !== JSON.stringify(rows)),
  };
}
