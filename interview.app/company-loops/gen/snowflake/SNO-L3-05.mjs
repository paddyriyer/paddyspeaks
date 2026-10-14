/* SNO-L3-05 — Warehouse credits per hour with per-second billing and a 60-second minimum
   after each resume (SQL). Simulated practice scenario. All data, names and numbers are
   generated from the seed and are hypothetical; the billing rule is this exercise's rule.

   One deterministic result set: one row per (warehouse_name, hour_start) with billed seconds
   in that hour, carrying
     billed_seconds  seconds of billed running time that fall in the hour, summed over runs;
     credits         sum over those seconds of the size's credits_per_hour / 3600, rounded to
                     4 decimal places at the end.
   A run starts at an effective RESUME and ends at the next effective SUSPEND (or at
   report_end). It is billed per second, and for at least 60 seconds after its resume: a
   shorter run is billed as though it kept running at its last size until resume + 60 s.
   Each run pays its own minimum, so two short runs a few seconds apart can overlap.
   Nothing at or after report_end is billed. Billed seconds are split at hour boundaries.
   level: 1 Medium (resume/suspend only, fixed sizes; short runs, overlapping minimums,
                    runs across hours, a minimum that spills into the next hour, exact hours)
          2 Hard (+ RESIZE events while running and while suspended, a resize inside a
                  run shorter than the minimum)
          3 Very Hard (+ no-op events: RESUME while running and SUSPEND while suspended;
                       runs still open at report_end, one resumed seconds before it, and
                       events after report_end) */
import { insertSQL, ts } from "../../js/rng.js";

export const kind = "sql";

const H = 3600;
const MIN_S = 60;
const SIZES = [["X-Small", 1], ["Small", 2], ["Medium", 4], ["Large", 8], ["X-Large", 16]];
const RATE = Object.fromEntries(SIZES);
const NAMES = ["adhoc_wh", "bi_wh", "dbt_wh", "etl_wh", "finance_wh", "loader_wh", "ml_wh", "reporting_wh", "sandbox_wh"];
const DAYS = ["2026-09-07", "2026-09-15", "2026-09-22", "2026-10-01", "2026-10-06"];

export function generate(r, level) {
  const day = r.pick(DAYS);
  const BASE = Date.UTC(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10)) / 1000;
  const startHour = r.pick([6, 7, 8]);
  const stamp = (sec) => {
    const d = new Date((BASE + sec) * 1000).toISOString().slice(0, 10);
    return ts(d, ((sec % 86400) + 86400) % 86400);
  };

  const nWh = level === 1 ? 2 : 3;
  const whs = r.sample(NAMES, nWh).sort().map((name) => ({
    name,
    initial: r.pick(level === 1 ? SIZES.slice(0, 4) : SIZES.slice(0, 3))[0],
    blocks: [],
    events: [],
  }));

  // Block kinds. Forced edge cases first, then a few random ones.
  const forced = ["short", "pair", "long", "edgeHour", "exact60", "onHour"];
  if (level >= 2) forced.push("resizeShort", "suspResize", "long");
  if (level === 3) forced.push("dupShort", "dupSuspend", "dupLong");
  const extras = level === 1 ? ["short", "long", "pair"] : level === 2 ? ["short", "long", "pair", "resizeShort"] : ["short", "long", "pair", "dupShort"];
  const nExtra = level === 1 ? r.int(1, 2) : r.int(2, 3);
  const kinds = r.shuffle([...forced, ...Array.from({ length: nExtra }, () => r.pick(extras))]);
  kinds.forEach((k, i) => whs[i % nWh].blocks.push(k));

  // Lay each warehouse's blocks out in its own hour slots so runs never collide.
  let maxSlot = 0;
  for (const w of whs) {
    let size = w.initial;
    const ev = (type, at, sz = null) => w.events.push({ wh: w.name, type, at, size: sz });
    const resize = (at) => {
      const next = r.pick(SIZES.filter(([s]) => s !== size))[0];
      size = next;
      ev("RESIZE", at, next);
    };
    let slot = r.int(0, 1);
    for (const b of w.blocks) {
      const S = (startHour + slot) * H;
      if (b === "short") {
        const x = S + r.int(2 * 60, 50 * 60);
        ev("RESUME", x); ev("SUSPEND", x + r.int(5, 55));
        slot += 1;
      } else if (b === "exact60") {
        const x = S + r.int(2 * 60, 50 * 60);
        ev("RESUME", x); ev("SUSPEND", x + MIN_S);
        slot += 1;
      } else if (b === "pair") {                       // second resume inside the first minimum
        const x = S + r.int(2 * 60, 50 * 60), d1 = r.int(5, 25), g = r.int(5, 20);
        ev("RESUME", x); ev("SUSPEND", x + d1);
        ev("RESUME", x + d1 + g); ev("SUSPEND", x + d1 + g + r.int(5, 50));
        slot += 1;
      } else if (b === "long" || b === "dupLong") {
        const k = r.int(1, 2);
        const x = S + r.int(2 * 60, 40 * 60), y = S + k * H + r.int(2 * 60, 50 * 60);
        ev("RESUME", x);
        if (level >= 2) {
          const n = r.int(1, 2);
          const pts = [];
          while (pts.length < n) {
            const t = r.int(x + 2 * 60, y - 2 * 60);
            if (pts.every((p) => Math.abs(p - t) > 60)) pts.push(t);
          }
          pts.sort((a, c) => a - c);
          for (const t of pts) resize(t);
        }
        if (b === "dupLong") {
          let t;
          do t = r.int(x + 2 * 60, y - 2 * 60); while (w.events.some((e) => e.at === t));
          ev("RESUME", t);                             // already running: a no-op
        }
        ev("SUSPEND", y);
        slot += k + 1;
      } else if (b === "edgeHour") {                   // the minimum spills into the next hour
        const x = S + H - r.int(10, 50);
        ev("RESUME", x); ev("SUSPEND", x + r.int(3, 8));
        slot += 2;
      } else if (b === "onHour") {                     // exactly on hour boundaries
        const k = r.int(1, 2);
        ev("RESUME", S); ev("SUSPEND", S + k * H);
        slot += k + 1;
      } else if (b === "resizeShort") {                // resized inside the minimum
        const x = S + r.int(2 * 60, 50 * 60), t = x + r.int(5, 25);
        ev("RESUME", x); resize(t); ev("SUSPEND", t + r.int(5, 25));
        slot += 1;
      } else if (b === "suspResize") {                 // resized while suspended
        resize(S + r.int(60, 100));
        const x = S + r.int(3 * 60, 20 * 60);
        ev("RESUME", x); ev("SUSPEND", x + r.int(5 * 60, 30 * 60));
        slot += 1;
      } else if (b === "dupShort") {                   // a second RESUME inside the first minute
        const x = S + r.int(2 * 60, 50 * 60);
        ev("RESUME", x); ev("RESUME", x + r.int(10, 30)); ev("SUSPEND", x + r.int(35, 55));
        slot += 1;
      } else if (b === "dupSuspend") {                 // a second SUSPEND while suspended
        const x = S + r.int(2 * 60, 30 * 60), y = x + r.int(5 * 60, 20 * 60);
        ev("RESUME", x); ev("SUSPEND", y); ev("SUSPEND", y + r.int(5, 120));
        slot += 1;
      }
    }
    w.size = size;
    maxSlot = Math.max(maxSlot, slot);
  }

  const reportEnd = (startHour + maxSlot + 1) * H + r.pick([0, 30 * 60, 45 * 60]);
  if (level === 3) {
    // Open at report_end: one long run, one resumed seconds before the end, and events after it.
    const [a, b, c] = r.shuffle(whs);
    a.events.push({ wh: a.name, type: "RESUME", at: reportEnd - r.int(10 * 60, 50 * 60), size: null });
    a.events.push({ wh: a.name, type: "SUSPEND", at: reportEnd + r.int(5 * 60, 40 * 60), size: null });
    b.events.push({ wh: b.name, type: "RESUME", at: reportEnd - r.int(15, 50), size: null });
    b.events.push({ wh: b.name, type: "SUSPEND", at: reportEnd + r.int(70, 600), size: null });
    const x = reportEnd + r.int(2 * 60, 20 * 60);
    c.events.push({ wh: c.name, type: "RESUME", at: x, size: null });
    c.events.push({ wh: c.name, type: "SUSPEND", at: x + r.int(3 * 60, 10 * 60), size: null });
  }

  // Sanity: no two events of one warehouse share a second.
  for (const w of whs) {
    const seen = new Set();
    for (const e of w.events) {
      if (seen.has(e.at)) throw new Error(`SNO-L3-05: event collision at ${e.at} on ${w.name}`);
      seen.add(e.at);
    }
  }

  const all = whs.flatMap((w) => w.events).sort((p, q) => p.at - q.at || (p.wh < q.wh ? -1 : p.wh > q.wh ? 1 : 0));
  let id = 1000 + r.int(0, 8000);
  for (const e of all) e.id = id++;

  // The oracle: walk each warehouse's events as a state machine. opts break one rule each.
  const compute = (opts = {}) => {
    const end = opts.noClip ? Infinity : reportEnd;
    const acc = new Map();                                  // "wh|hour" -> [secs, creditSecs]
    const add = (wh, a, b, size, hourOf = null) => {
      const rate = RATE[size];
      let t = a;
      while (t < b) {
        const h = Math.floor(t / H) * H;
        const u = Math.min(b, h + H);
        const key = wh + "|" + (hourOf === null ? h : hourOf);
        const cur = acc.get(key) || [0, 0];
        cur[0] += u - t; cur[1] += (u - t) * rate;
        acc.set(key, cur);
        t = u;
      }
    };
    for (const w of whs) {
      const evs = w.events.filter((e) => e.at < end).sort((p, q) => p.at - q.at);
      let running = false, size = w.initial, resumeAt = 0, segStart = 0;
      let segs = [];                                         // billed segments of this warehouse
      const flush = (a, b, sz, pad = false) => { if (b > a) segs.push({ a, b, sz, pad, resumeAt }); };
      const closeRun = (t) => {
        flush(segStart, t, size);
        const billedEnd = Math.min(opts.noMin ? t : Math.max(t, resumeAt + MIN_S), end);
        flush(t, billedEnd, size, true);
        running = false;
      };
      for (const e of evs) {
        if (e.type === "RESIZE") {
          if (running) {
            if (opts.ignoreRunningResize) continue;
            flush(segStart, e.at, size);
            segStart = e.at;
          } else if (opts.ignoreSuspendedResize) continue;
          size = e.size;
        } else if (e.type === "RESUME") {
          if (running) {
            if (!opts.dupNew) continue;
            closeRun(e.at);
          }
          if (opts.unionMin) {                               // overlapping minimums merged
            for (const s of segs) if (s.pad && s.b > e.at) s.b = Math.max(s.a, e.at);
          }
          running = true; resumeAt = e.at; segStart = e.at;
        } else if (running) {
          closeRun(e.at);
        }
      }
      if (running) {
        if (opts.dropOpen) running = false;
        else closeRun(end);
      }
      for (const s of segs) {
        if (opts.resumeHour) add(w.name, s.a, s.b, s.sz, Math.floor(s.resumeAt / H) * H);
        else if (opts.padResumeHour && s.pad) add(w.name, s.a, s.b, s.sz, Math.floor(s.resumeAt / H) * H);
        else add(w.name, s.a, s.b, s.sz);
      }
    }
    return [...acc.entries()]
      .filter(([, v]) => v[0] > 0)
      .map(([k, v]) => { const [wh, h] = k.split("|"); return { wh, h: +h, secs: v[0], cs: v[1] }; })
      .sort((p, q) => (p.wh < q.wh ? -1 : p.wh > q.wh ? 1 : p.h - q.h))
      .map((x) => [x.wh, stamp(x.h), x.secs, Math.floor((x.cs * 20000 + 3600) / 7200) / 10000]);
  };
  const expected = compute();

  const diagnostics = [
    { message: "No 60-second minimum was applied. In this exercise each resume is billed for at least 60 seconds: a run that suspends sooner is billed as though it kept running until 60 seconds after its resume.", rows: compute({ noMin: true }) },
    { message: "Overlapping minimums were merged. Each resume pays its own 60-second minimum, so a warehouse resumed again a few seconds after it suspended is billed for both minimums even though they overlap in time.", rows: compute({ unionMin: true }) },
    { message: "Each run was charged entirely to the hour it resumed in. Billed seconds must be split at hour boundaries, so a run from 10:40 to 12:15 contributes to the 10:00, 11:00 and 12:00 rows.", rows: compute({ resumeHour: true }) },
    { message: "The seconds added by the minimum were charged to the hour of the resume. They are billed as though the warehouse kept running, so a run resumed at 10:59:50 that suspends 5 seconds later bills 10 seconds to 10:00 and 50 seconds to 11:00.", rows: compute({ padResumeHour: true }) },
  ];
  if (level >= 2) {
    diagnostics.push(
      { message: "Resizes during a run were ignored. The rate changes at the instant of the RESIZE: seconds before it bill at the old size, seconds after it (including any minimum padding) at the new one.", rows: compute({ ignoreRunningResize: true }) },
      { message: "Resizes made while the warehouse was suspended were ignored. A RESIZE while suspended sets the size the next run starts at; the size in force at any instant is the latest RESIZE at or before it, else the initial size.", rows: compute({ ignoreSuspendedResize: true }) },
    );
  }
  if (level === 3) {
    diagnostics.push(
      { message: "A RESUME logged while the warehouse was already running was treated as a new start. It is a no-op: the run continues and its 60-second minimum is not paid again (and a SUSPEND while suspended is a no-op too).", rows: compute({ dupNew: true }) },
      { message: "Events at or after report_end were used. The report bills nothing at or after report_end: a run still running then is billed up to report_end, even if a later SUSPEND exists, and its minimum is cut at report_end.", rows: compute({ noClip: true }) },
      { message: "Runs still open at report_end were dropped. A warehouse resumed before report_end and not yet suspended has been billed from its resume up to report_end.", rows: compute({ dropOpen: true }) },
    );
  }

  const eCols = ["event_id", "warehouse_name", "event_type", "size", "occurred_at"];
  const eRows = all.map((e) => [e.id, e.wh, e.type, e.size, stamp(e.at)]);
  const wCols = ["warehouse_name", "initial_size"];
  const wRows = whs.map((w) => [w.name, w.initial]);
  const sCols = ["size", "credits_per_hour"];
  const sRows = SIZES.map(([s, c]) => [s, c]);

  const setup =
    "SET TIME ZONE 'UTC';\n" +
    "CREATE TABLE warehouse_sizes (\n  size TEXT PRIMARY KEY,\n  credits_per_hour INT NOT NULL\n);\n" +
    "CREATE TABLE warehouses (\n  warehouse_name TEXT PRIMARY KEY,\n  initial_size TEXT NOT NULL REFERENCES warehouse_sizes (size)\n);\n" +
    "CREATE TABLE warehouse_events (\n  event_id BIGINT PRIMARY KEY,\n  warehouse_name TEXT NOT NULL REFERENCES warehouses (warehouse_name),\n  event_type TEXT NOT NULL CHECK (event_type IN ('RESUME','SUSPEND','RESIZE')),\n  size TEXT REFERENCES warehouse_sizes (size),\n  occurred_at TIMESTAMPTZ NOT NULL\n);\n" +
    insertSQL("warehouse_sizes", sCols, sRows) + insertSQL("warehouses", wCols, wRows) + insertSQL("warehouse_events", eCols, eRows);

  return {
    vars: {
      report_end: stamp(reportEnd),
      warehouse_list: whs.map((w) => "`" + w.name + "`").join(", "),
      events: eRows.length,
      events_rule: level === 1
        ? "Events are `RESUME` and `SUSPEND` only: in this sample no warehouse is resized, so each one bills at its `initial_size` throughout, and the log alternates cleanly (a warehouse starts suspended)."
        : level === 2
          ? "Events are `RESUME`, `SUSPEND` and `RESIZE` (with the new `size`). A RESIZE can happen while the warehouse runs (the rate changes at that instant) or while it is suspended (the next run starts at the new size); the size in force at any instant is the latest RESIZE at or before it, else `initial_size`. A warehouse starts suspended, and RESUME and SUSPEND alternate."
          : "Events are `RESUME`, `SUSPEND` and `RESIZE` (with the new `size`). A RESIZE can happen while the warehouse runs (the rate changes at that instant) or while it is suspended (the next run starts at the new size); the size in force at any instant is the latest RESIZE at or before it, else `initial_size`. A warehouse starts suspended. Two clients can race, so the log also holds no-ops: a RESUME while the warehouse is already running and a SUSPEND while it is already suspended change nothing.",
      end_rule: level === 3
        ? "Some warehouses are still running at report_end, and the log already holds events after it: bill an open run up to report_end and ignore everything at or after report_end."
        : "In this sample every run has ended before report_end.",
    },
    setup,
    tables: [
      { name: "warehouse_sizes", columns: sCols, rows: sRows },
      { name: "warehouses", columns: wCols, rows: wRows },
      { name: "warehouse_events", columns: eCols, rows: eRows },
    ],
    expected: { columns: ["warehouse_name", "hour_start", "billed_seconds", "credits"], rows: expected },
    diagnostics: diagnostics.filter((d) => JSON.stringify(d.rows) !== JSON.stringify(expected)),
  };
}
