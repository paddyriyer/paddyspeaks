/* DSH-L3-05 — Ordered while closed: per store and week, orders accepted while the store was
   paused or outside its listed hours (holiday hours replace weekly hours for that date), and
   minutes paused inside listed hours (SQL).
   Simulated practice scenario. All stores, hours, pauses and orders are generated from the seed
   and are hypothetical; the hours, holiday and pause rules are this exercise's rules.

   One row per store and week of the sample (every store, every week, zeros included), ordered by
   store_id, week_start:
     orders_accepted       orders whose accepted_at falls in the week
     orders_while_closed   of those, orders accepted while paused OR outside listed hours (once)
     orders_while_paused   of those, orders accepted while paused
     minutes_paused        minutes in the week when the store was paused AND inside listed hours
   Listed hours for a date are its holiday_hours rows when it has any (a NULL row = closed all
   day), otherwise the weekly_hours rows for its ISO weekday. Hours belong to the date they open
   on: close_time < open_time runs past midnight into the next date, and still applies there even
   when that next date is a holiday. Intervals are [open, close); pauses [paused_at, resumed_at),
   with NULL resumed_at meaning still paused at the end of the sample.
   level: 1 Medium (one interval a day, a closed weekday, a holiday closed all day and one with
                    short hours, boundary orders, a pause running past closing, a store-week with
                    no orders)
          2 Hard (+ split lunch/dinner hours, a late-night store whose hours cross midnight, a
                  pause across the Sunday-Monday week boundary, a pause starting before opening,
                  an order early on the first day served by the previous evening's hours)
          3 Very Hard (+ the late store closed on a holiday while its previous evening still runs
                       into it, holiday hours that cross midnight, a pause that began before the
                       sample, and a pause still open at the end of the sample) */
import { insertSQL, pad2 } from "../../js/rng.js";

export const kind = "sql";

const DAY = 86400, WEEK = 7 * DAY;
const BASE = Date.UTC(2026, 2, 2) / 1000;                       // 2026-03-02 (a Monday)
const NAMES = ["pho_corner", "taqueria_luna", "green_bowl", "noodle_lab", "slice_house", "corner_mart", "bagel_works",
  "curry_leaf", "dumpling_den", "night_owl_deli", "harbor_grill", "salad_stand", "ramen_alley", "falafel_cart"];
const REASONS = ["kitchen busy", "tablet offline", "short-staffed", "out of key ingredients", "weather"];

function dateStr(i) {
  const d = new Date((BASE + i * DAY) * 1000);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}
function tsStr(sec, base) {
  const d = new Date((base + sec) * 1000);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())} ` +
    `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}:${pad2(d.getUTCSeconds())}`;
}
const hm = (m) => `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`;
const dow = (d) => (((d % 7) + 7) % 7) + 1;                       // day 0 is a Monday -> ISO 1

export function generate(r, level) {
  const weekShift = r.int(0, 5);
  const base = BASE + weekShift * WEEK;
  const W = level === 3 ? 3 : 2;
  const D = 7 * W;
  const END = D * DAY;

  // Stores and their weekly hours (minutes of the day; close < open crosses midnight).
  const roles = level === 1 ? ["A", "B", "C"] : ["A", "B", "L", "C"];
  const types = { A: "regular", B: level === 1 ? "regular" : "split", L: "late",
    C: level === 1 ? "regular" : r.pick(level === 2 ? ["regular", "split"] : ["regular", "split", "late"]) };
  const names = r.sample(NAMES, roles.length);
  let sid = 100 + r.int(0, 800);
  const ids = roles.map(() => "st_" + (sid += r.int(3, 61)));
  const idOrder = r.shuffle(ids);
  const S = {};
  roles.forEach((role, k) => {
    const type = types[role];
    const weekly = new Map();
    if (type === "regular") {
      const o = 390 + 15 * r.int(0, 14), c = 1200 + 15 * r.int(0, 12);
      for (let w = 1; w <= 7; w++) weekly.set(w, [[o, w === 7 && r.chance(0.5) ? c - 60 : c]]);
    } else if (type === "split") {
      const o1 = 630 + 15 * r.int(0, 4), c1 = 840 + 15 * r.int(0, 4), o2 = 1020 + 15 * r.int(0, 2), c2 = 1290 + 15 * r.int(0, 4);
      for (let w = 1; w <= 7; w++) weekly.set(w, [[o1, c1], [o2, c2]]);
    } else {
      const o = 960 + 15 * r.int(0, 8), c = 30 + 15 * r.int(0, 6);
      for (let w = 1; w <= 7; w++) weekly.set(w, [[o, w === 5 || w === 6 ? c + 60 : c]]);
    }
    S[role] = { role, type, id: idOrder[k], name: names[k], weekly, hol: new Map() };
  });
  // A closed weekday for store C (always at level 1).
  if (level === 1 || r.chance(0.5)) S.C.weekly.set(r.int(1, 5), []);

  // Holidays.
  const h1 = r.int(1, 4);
  S.A.hol.set(h1, []);
  if (S.B.type === "regular") S.B.hol.set(h1, [[600, 900 + 15 * r.int(0, 4)]]);
  else S.B.hol.set(h1, [[660, 840 + 15 * r.int(0, 8)]]);
  let h2 = null;
  if (level === 3) {
    S.L.hol.set(h1, []);                                           // closed, but the evening before runs into it
    h2 = r.int(8, 11);
    S.L.hol.set(h2, [[1080, 60]]);                                 // 18:00 to 01:00 the next day
    if (r.chance(0.5) && S.C.type !== "late") S.C.hol.set(h2, []);
  }

  const weeklyOn = (st, d) => st.weekly.get(dow(d)) || [];
  const listedOn = (st, d) => (st.hol.has(d) ? st.hol.get(d) : weeklyOn(st, d));
  const used = new Map();                                          // role -> days used by forced events
  const openDays = (st, lo, hi) => {
    const out = [];
    for (let d = lo; d <= hi; d++) {
      if (st.hol.has(d) || st.hol.has(d + 1) || !weeklyOn(st, d).length) continue;
      if ((used.get(st.role) || []).includes(d)) continue;
      out.push(d);
    }
    return out;
  };
  const useDay = (st, lo, hi) => {
    const d = r.pick(openDays(st, lo, hi));
    used.set(st.role, [...(used.get(st.role) || []), d]);
    return d;
  };

  // Forced pauses and orders.
  const pauses = [];                                               // { st, s, e (null = open) }
  const orders = [];                                               // { st, t, forced }
  const addOrder = (st, t) => orders.push({ st, t, forced: true });
  // P1: a pause that runs past closing; an order after closing inside it (paused AND outside).
  {
    const st = S.A, d = useDay(st, 0, 6), [, c] = weeklyOn(st, d)[0];
    pauses.push({ st, s: d * DAY + (c - 30 - 5 * r.int(0, 4)) * 60, e: d * DAY + (c + 20 + 5 * r.int(0, 4)) * 60 });
    addOrder(st, d * DAY + (c + 10) * 60 + r.int(0, 59));
  }
  // P2: a pause inside hours; orders exactly at paused_at (paused) and at resumed_at (not paused).
  {
    const st = S.B, d = useDay(st, 0, D - 2), [o, c] = weeklyOn(st, d)[0];
    const s = d * DAY + (o + 30) * 60, dur = 5 * r.int(3, Math.min(24, Math.floor((c - o - 45) / 5)));
    pauses.push({ st, s, e: s + dur * 60 });
    addOrder(st, s); addOrder(st, s + dur * 60);
  }
  if (level >= 2) {
    // P3: a pause that starts before opening; an order before opening inside it.
    {
      const st = S.A, d = useDay(st, 0, 6), [o] = weeklyOn(st, d)[0];
      pauses.push({ st, s: d * DAY + (o - 20) * 60, e: d * DAY + (o + 5 * r.int(4, 12)) * 60 });
      addOrder(st, d * DAY + (o - 10) * 60 + r.int(0, 59));
    }
    // P4: the late store pauses across the Sunday-Monday week boundary.
    {
      const st = S.L;
      pauses.push({ st, s: 6 * DAY + (23 * 60 + 30 + r.int(0, 10)) * 60, e: 7 * DAY + 60 * r.int(10, 25) });
      addOrder(st, 7 * DAY + 60 * r.int(1, 8) + r.int(0, 59));
    }
    // An order early on the first day, served by the previous evening's hours.
    addOrder(S.L, 60 * r.int(12, 28) + r.int(0, 59));
    // An order between lunch and dinner.
    {
      const st = S.B, d = r.pick(openDays(st, 0, D - 1)), [[, c1], [o2]] = weeklyOn(st, d);
      addOrder(st, d * DAY + (c1 + r.int(10, o2 - c1 - 10)) * 60 + r.int(0, 59));
    }
  }
  if (level === 3) {
    // P5: a pause that began before the sample, inside the previous evening's hours.
    pauses.push({ st: S.L, s: -DAY + (23 * 60 + r.int(0, 20)) * 60, e: 600 });
    // P6: still paused at the end of the sample.
    {
      const st = S.A, d = D - 1, [, c] = weeklyOn(st, d)[0];
      const s = d * DAY + (c - 60 - 15 * r.int(0, 4)) * 60;
      pauses.push({ st, s, e: null });
      addOrder(st, s + 60 * r.int(5, 30) + r.int(0, 59));
    }
    // The late store is closed on h1, but the evening before still runs past midnight into it.
    {
      const [[, cPrev]] = weeklyOn(S.L, h1 - 1);
      addOrder(S.L, h1 * DAY + 60 * r.int(5, Math.min(25, cPrev - 5)) + r.int(0, 59));
    }
    // Holiday hours that cross midnight (18:00 to 01:00).
    addOrder(S.L, (h2 + 1) * DAY + 60 * r.int(20, 50) + r.int(0, 59));
  }
  // Boundary orders for store C: exactly at an opening and exactly at a closing.
  {
    const st = S.C;
    const d1 = r.pick(openDays(st, 0, D - 2)), [o] = weeklyOn(st, d1)[0];
    addOrder(st, d1 * DAY + o * 60);
    const d2 = r.pick(openDays(st, 0, D - 2)), lst = weeklyOn(st, d2), [o2, c2] = lst[lst.length - 1];
    addOrder(st, (c2 > o2 ? d2 : d2 + 1) * DAY + c2 * 60);
  }
  // An order on store A's closed holiday, at a time its weekly hours would have been open.
  {
    const [[o]] = weeklyOn(S.A, h1);
    addOrder(S.A, h1 * DAY + (o + r.int(30, 300)) * 60 + r.int(0, 59));
  }

  // Listed intervals [s, e) in seconds from the start of the sample. opts break one rule each.
  const intervals = (st, opts = {}) => {
    const out = [];
    for (let d = opts.noPrevDay ? 0 : -1; d < D; d++) {
      let src = listedOn(st, d);
      if (opts.holidayAdds && st.hol.has(d)) src = [...weeklyOn(st, d), ...st.hol.get(d)];
      for (const [o, c] of src) {
        const s = d * DAY + o * 60;
        let e = c > o ? d * DAY + c * 60 : (d + 1) * DAY + c * 60;
        if (c <= o && (opts.noCross || (opts.prevDayDropped && st.hol.has(d + 1)))) e = (d + 1) * DAY;
        out.push([s, e]);
      }
    }
    return out;
  };
  const roleList = roles.map((x) => S[x]);

  // Random pauses: inside some listed interval, never overlapping another pause or a forced order.
  for (const st of roleList) {
    const ivs = intervals(st).filter(([s, e]) => s >= 0 && e <= END);
    const forcedTimes = orders.filter((o) => o.st === st).map((o) => o.t);
    const want = r.int(1, 2);
    for (let k = 0, tries = 0; k < want && tries < 40; tries++) {
      const [s0, e0] = r.pick(ivs);
      const s = s0 + 300 * r.int(0, Math.floor((e0 - s0) / 300) - 1);
      const e = s + 60 * 5 * r.int(3, 30);
      if (e > END - 3600) continue;
      const clash = pauses.some((p) => p.st === st && s < (p.e === null ? END : p.e) + 600 && p.s - 600 < e) ||
        forcedTimes.some((t) => t >= s - 600 && t <= e + 600);
      if (clash) continue;
      pauses.push({ st, s, e });
      k++;
    }
  }

  // Random orders: mostly inside listed hours, some at any time of the day.
  for (const st of roleList) {
    const ivs = intervals(st);
    for (let d = 0; d < D; d++) {
      const todays = ivs.filter(([s]) => s >= d * DAY && s < (d + 1) * DAY);
      const n = r.int(1, level === 1 ? 2 : 3);
      for (let k = 0; k < n; k++) {
        let t;
        if (todays.length && r.chance(0.82)) {
          const [s, e] = r.pick(todays);
          t = s + r.int(0, Math.min(e, END) - s - 1);
        } else t = d * DAY + r.int(0, DAY - 1);
        orders.push({ st, t, forced: false });
      }
    }
  }
  // One store-week with no orders at all (it still gets a row).
  {
    const cands = [];
    for (const st of roleList) for (let w = 0; w < W; w++)
      if (!orders.some((o) => o.forced && o.st === st && Math.floor(o.t / WEEK) === w)) cands.push([st, w]);
    if (cands.length) {
      const [st, w] = r.pick(cands);
      for (let i = orders.length - 1; i >= 0; i--)
        if (orders[i].st === st && Math.floor(orders[i].t / WEEK) === w) orders.splice(i, 1);
    }
  }

  // The oracle.
  const pend = (p) => (p.e === null ? END : p.e);
  const sorted = [...roleList].sort((a, b) => (a.id < b.id ? -1 : 1));
  const compute = (opts = {}) => {
    const rows = [];
    for (const st of sorted) {
      const ivs = intervals(st, opts);
      const ps = pauses.filter((p) => p.st === st && !(opts.nullDropped && p.e === null));
      const inHours = (p, lo, hi) => {
        let sec = 0;
        for (const [s, e] of ivs) {
          const a = Math.max(p.s, s, lo), b = Math.min(pend(p), e, hi);
          if (b > a) sec += b - a;
        }
        return sec;
      };
      for (let w = 0; w < W; w++) {
        const w0 = w * WEEK, w1 = w0 + WEEK;
        let n = 0, closed = 0, paused = 0, sec = 0;
        for (const o of orders) {
          if (o.st !== st || o.t < w0 || o.t >= w1) continue;
          n++;
          const pz = ps.some((p) => p.s <= o.t && (opts.resumeInclusive ? o.t <= pend(p) : o.t < pend(p)));
          const out = !ivs.some(([s, e]) => s <= o.t && (opts.closeInclusive ? o.t <= e : o.t < e));
          if (pz) paused++;
          closed += opts.doubleCount ? (pz ? 1 : 0) + (out ? 1 : 0) : (pz || out ? 1 : 0);
        }
        for (const p of ps) {
          if (opts.anyHours) {
            const a = Math.max(p.s, w0), b = Math.min(pend(p), w1);
            if (b > a) sec += b - a;
          } else if (opts.weekOfStart) {
            if (Math.min(Math.max(Math.floor(p.s / WEEK), 0), W - 1) === w) sec += inHours(p, 0, END);
          } else sec += inHours(p, w0, w1);
        }
        if (opts.zeroRowsMissing && n === 0) continue;
        rows.push([st.id, dateStr(weekShift * 7 + w * 7), n, closed, paused, sec / 60]);
      }
    }
    return rows;
  };
  const expected = compute();

  const diagnostics = [
    { message: "An order accepted while paused AND outside listed hours was counted twice in orders_while_closed. It is one order accepted while closed; count it once.", rows: compute({ doubleCount: true }) },
    { message: "An order accepted exactly at close_time was treated as open. Listed hours are half-open, [open_time, close_time): the store is closed from close_time on.", rows: compute({ closeInclusive: true }) },
    { message: "An order accepted exactly at resumed_at was treated as paused. A pause covers [paused_at, resumed_at): at resumed_at the store is taking orders again.", rows: compute({ resumeInclusive: true }) },
    { message: "Holiday hours were added to the weekly hours instead of replacing them. When a date has holiday_hours rows, they are that date's only listed hours; a NULL row means closed all day.", rows: compute({ holidayAdds: true }) },
    { message: "Paused minutes outside listed hours were counted. minutes_paused counts only the minutes when the store was paused and inside its listed hours.", rows: compute({ anyHours: true }) },
    { message: "Store-weeks with no orders were left out. The result has one row for every store and every week of the sample, with zeros; start from stores crossed with weeks, not from orders.", rows: compute({ zeroRowsMissing: true }) },
  ];
  if (level >= 2) {
    diagnostics.push(
      { message: "Hours that cross midnight were cut at midnight. When close_time is earlier than open_time, the interval runs into the next date: a late-night store open 17:00 to 01:30 is open at 00:45.", rows: compute({ noCross: true }) },
      { message: "The evening before the sample was ignored. The first date's early hours belong to the previous date's interval that crosses midnight; build the intervals from first_day - 1.", rows: compute({ noPrevDay: true }) },
      { message: "A pause's in-hours minutes were all given to the week it started in. Split each pause at the week boundary (Monday 00:00) and give each week its own minutes.", rows: compute({ weekOfStart: true }) },
    );
  }
  if (level === 3) {
    diagnostics.push(
      { message: "The previous evening's hours were cut at midnight because the next date is a holiday. Hours belong to the date they open on: the late shift that opened the day before still runs into the holiday.", rows: compute({ prevDayDropped: true }) },
      { message: "A pause with no resumed_at was dropped. It is still in force at the end of the sample; count it until the end of the sample.", rows: compute({ nullDropped: true }) },
    );
  }

  // Tables.
  const stCols = ["store_id", "store_name"];
  const stRows = sorted.map((st) => [st.id, st.name]);
  const whCols = ["store_id", "iso_weekday", "open_time", "close_time"];
  const whRows = [];
  for (const st of sorted) for (let w = 1; w <= 7; w++) for (const [o, c] of st.weekly.get(w)) whRows.push([st.id, w, hm(o), hm(c)]);
  const hhCols = ["store_id", "holiday_date", "open_time", "close_time"];
  const hhRows = [];
  for (const st of sorted) for (const d of [...st.hol.keys()].sort((a, b) => a - b)) {
    const lst = st.hol.get(d);
    if (!lst.length) hhRows.push([st.id, dateStr(weekShift * 7 + d), null, null]);
    for (const [o, c] of lst) hhRows.push([st.id, dateStr(weekShift * 7 + d), hm(o), hm(c)]);
  }
  hhRows.sort((a, b) => (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : a[0] < b[0] ? -1 : 1));
  const pCols = ["pause_id", "store_id", "paused_at", "resumed_at", "reason"];
  let pid = 5000 + r.int(0, 3000);
  const pRows = [...pauses].sort((a, b) => a.s - b.s || (a.st.id < b.st.id ? -1 : 1))
    .map((p) => ["pz_" + (pid += r.int(1, 17)), p.st.id, tsStr(p.s, base), p.e === null ? null : tsStr(p.e, base), r.pick(REASONS)]);
  const oCols = ["order_id", "store_id", "accepted_at"];
  let oid = 700000 + r.int(0, 90000);
  const oRows = [...orders].sort((a, b) => a.t - b.t || (a.st.id < b.st.id ? -1 : 1))
    .map((o) => ["ord_" + (oid += r.int(1, 40)), o.st.id, tsStr(o.t, base)]);

  const setup =
    "SET TIME ZONE 'UTC';\n" +
    "CREATE TABLE stores (\n  store_id TEXT PRIMARY KEY,\n  store_name TEXT NOT NULL\n);\n" +
    "CREATE TABLE weekly_hours (\n  store_id TEXT NOT NULL REFERENCES stores (store_id),\n  iso_weekday INT NOT NULL CHECK (iso_weekday BETWEEN 1 AND 7),\n  open_time TIME NOT NULL,\n  close_time TIME NOT NULL CHECK (close_time <> open_time)\n);\n" +
    "CREATE TABLE holiday_hours (\n  store_id TEXT NOT NULL REFERENCES stores (store_id),\n  holiday_date DATE NOT NULL,\n  open_time TIME,\n  close_time TIME,\n  CHECK ((open_time IS NULL) = (close_time IS NULL))\n);\n" +
    "CREATE TABLE pauses (\n  pause_id TEXT PRIMARY KEY,\n  store_id TEXT NOT NULL REFERENCES stores (store_id),\n  paused_at TIMESTAMP NOT NULL,\n  resumed_at TIMESTAMP,\n  reason TEXT NOT NULL\n);\n" +
    "CREATE TABLE orders (\n  order_id TEXT PRIMARY KEY,\n  store_id TEXT NOT NULL REFERENCES stores (store_id),\n  accepted_at TIMESTAMP NOT NULL\n);\n" +
    insertSQL("stores", stCols, stRows) + insertSQL("weekly_hours", whCols, whRows) +
    insertSQL("holiday_hours", hhCols, hhRows) + insertSQL("pauses", pCols, pRows) + insertSQL("orders", oCols, oRows);

  return {
    vars: {
      first_day: dateStr(weekShift * 7),
      last_day: dateStr(weekShift * 7 + D - 1),
      sample_end: tsStr(END, base),
      weeks: W,
      store_count: stRows.length,
      order_rows: oRows.length,
      sample_note: level === 1
        ? "In this sample every store opens at most once a day and closes before midnight."
        : "In this sample some stores split the day into a lunch and a dinner interval, and at least one late-night store's hours cross midnight.",
    },
    setup,
    tables: [
      { name: "stores", columns: stCols, rows: stRows },
      { name: "weekly_hours", columns: whCols, rows: whRows },
      { name: "holiday_hours", columns: hhCols, rows: hhRows },
      { name: "pauses", columns: pCols, rows: pRows },
      { name: "orders", columns: oCols, rows: oRows },
    ],
    expected: {
      columns: ["store_id", "week_start", "orders_accepted", "orders_while_closed", "orders_while_paused", "minutes_paused"],
      rows: expected,
    },
    diagnostics: diagnostics.filter((d) => JSON.stringify(d.rows) !== JSON.stringify(expected)),
  };
}
