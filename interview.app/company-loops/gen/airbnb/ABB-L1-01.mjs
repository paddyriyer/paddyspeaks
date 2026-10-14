/* ABB-L1-01 — Occupancy by city and month: booked nights over available nights (SQL).
   Simulated practice scenario. All data is generated from the seed; cities are only labels.

   Contract: see docs/COMPANY-INTERVIEW-LOOPS.md § Executable templates (sql).
   The oracle below walks every listed night of every listing in plain JavaScript; the
   evaluator's reference expands nights with generate_series and EXISTS checks.
   level: 1 Medium (stays split across month boundaries and the window edges, cancelled
            stays, host blocks, a city-month with no bookings)
          2 Hard (+ listings that go live inside the window, overlapping blocks, a window
            that crosses a year boundary)
          3 Very Hard (+ listings that are unlisted inside the window, and blocks that cover
            nights which are also booked: a booked night is available) */
import { insertSQL } from "../../js/rng.js";

export const kind = "sql";

const CITIES = ["Cape Town", "Edinburgh", "Kyoto", "Lisbon", "Mexico City", "Oaxaca", "Porto", "Queenstown", "Seville", "Tbilisi"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const DAY = 86400000;
const toDay = (s) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) / DAY;
const toStr = (d) => new Date(d * DAY).toISOString().slice(0, 10);
const monthOf = (d) => toStr(d).slice(0, 8) + "01";
const addMonths = (y, m, k) => { const t = y * 12 + (m - 1) + k; return [Math.floor(t / 12), (t % 12) + 1]; };
const ymStr = (y, m) => `${y}-${String(m).padStart(2, "0")}-01`;

export function generate(r, level) {
  // Report window: three whole months; Hard+ crosses a year boundary.
  const [y0, m0] = level === 1 ? [2026, r.int(3, 8)] : r.pick([[2025, 11], [2025, 12]]);
  const [y3, m3] = addMonths(y0, m0, 3);
  const w0 = toDay(ymStr(y0, m0)), w1 = toDay(ymStr(y3, m3));
  const [y2, m2] = addMonths(y0, m0, 2);
  const windowLabel = `${MONTHS[m0 - 1]} ${y0} to ${MONTHS[m2 - 1]} ${y2}`;

  const cities = r.sample(CITIES, 3).sort();
  const listings = [];   // {id, city, from, until}
  const res = [];        // {id, listing, ci, co, status}
  const blocks = [];     // {id, listing, s, e}
  let lid = 100 + r.int(0, 800), rid = 5000 + r.int(0, 4000), bid = 70 + r.int(0, 300);

  const addListing = (city, from, until) => {
    const l = { id: "lst_" + (lid += r.int(1, 30)), city, from, until };
    listings.push(l);
    return l;
  };
  // Walk a listing's calendar: stays, cancelled stays and blocks in the gaps.
  const fill = (l, start, end, opts = {}) => {
    let d = start;
    while (d < end) {
      d += r.pick([0, 0, 1, 2, 3, 5, 8]);
      const len = r.int(2, 9);
      if (d + len > end) break;
      if (opts.firstMonthOnly && d + len > opts.firstMonthOnly) break;
      if (r.chance(0.18)) {                                   // a gap the host blocks
        blocks.push({ id: bid += r.int(1, 9), listing: l.id, s: d, e: d + len });
        let end2 = d + len;
        if (level >= 2 && r.chance(0.5)) {                    // Hard+: a second block overlapping it
          const s2 = d + r.int(0, len - 1);
          end2 = Math.max(end2, s2 + r.int(1, 6));
          blocks.push({ id: bid += r.int(1, 9), listing: l.id, s: s2, e: Math.max(s2 + 1, Math.min(end2, s2 + 6)) });
        }
        d = end2;                                             // the next stay starts after both blocks
        continue;
      }
      res.push({ id: "res_" + (rid += r.int(1, 40)), listing: l.id, ci: d, co: d + len, status: "confirmed" });
      // Very Hard: a block over nights that are already booked.
      if (level === 3 && r.chance(0.3)) {
        const s2 = d + r.int(0, len - 1);
        blocks.push({ id: bid += r.int(1, 9), listing: l.id, s: s2, e: Math.min(d + len + r.int(0, 3), s2 + r.int(1, 5)) });
      }
      // A cancelled stay that overlaps the confirmed one (it never occupied anything).
      if (r.chance(0.3)) {
        const s2 = d + r.int(-2, len - 1);
        res.push({ id: "res_" + (rid += r.int(1, 40)), listing: l.id, ci: s2, co: s2 + r.int(1, 7), status: "cancelled" });
      }
      d += len;
    }
  };

  for (const city of cities.slice(0, 2)) {
    const n = r.int(2, 3);
    for (let k = 0; k < n; k++) {
      let from = w0 - r.int(30, 400), until = null;
      if (level >= 2 && k === 1) from = w0 + r.int(10, 50);                // goes live inside the window
      if (level === 3 && k === n - 1) until = w1 - r.int(10, 45);           // unlisted inside the window
      const l = addListing(city, toStr(from), until === null ? null : toStr(until));
      // The calendar starts before the window so stays cross its first edge.
      fill(l, Math.max(from, w0 - 12), until === null ? w1 + 12 : until);
    }
  }
  // Every level: a stay across the window's first edge, and one across a month boundary.
  {
    const l = listings[0];
    const pre = { id: "res_" + (rid += r.int(1, 40)), listing: l.id, ci: w0 - 3, co: w0 + 2, status: "confirmed" };
    // Make room: drop anything of this listing that overlaps.
    for (let i = res.length - 1; i >= 0; i--) if (res[i].listing === l.id && res[i].status === "confirmed" && res[i].ci < pre.co && pre.ci < res[i].co) res.splice(i, 1);
    for (let i = blocks.length - 1; i >= 0; i--) if (blocks[i].listing === l.id && blocks[i].s < pre.co && pre.ci < blocks[i].e) blocks.splice(i, 1);
    res.push(pre);
  }
  // The third city: one listing, bookings only in the first month, so its later months
  // have availability and no booked nights.
  {
    const l = addListing(cities[2], toStr(w0 - r.int(60, 300)), null);
    const [ya, ma] = addMonths(y0, m0, 1);
    fill(l, w0, toDay(ymStr(ya, ma)), { firstMonthOnly: toDay(ymStr(ya, ma)) });
    if (!res.some((x) => x.listing === l.id && x.status === "confirmed")) {
      res.push({ id: "res_" + (rid += r.int(1, 40)), listing: l.id, ci: w0 + 3, co: w0 + 7, status: "confirmed" });
      for (let i = blocks.length - 1; i >= 0; i--) if (blocks[i].listing === l.id && blocks[i].s < w0 + 7 && w0 + 3 < blocks[i].e) blocks.splice(i, 1);
    }
  }
  // Hard+: one more listing that goes live after the window: no row of its own.
  if (level >= 2) addListing(cities[r.int(0, 1)], toStr(w1 + r.int(1, 20)), null);

  const cmp = (x, y) => (x < y ? -1 : x > y ? 1 : 0);
  const solve = (o = {}) => {
    const per = new Map();
    const key = (city, d) => city + "|" + monthOf(d);
    const bump = (k, b, a) => { if (!per.has(k)) per.set(k, [0, 0]); const s = per.get(k); s[0] += b; s[1] += a; };
    for (const l of listings) {
      const from = o.ignoreFrom ? w0 : Math.max(w0, toDay(l.from));
      const until = l.until === null || o.ignoreUntil ? w1 : Math.min(w1, toDay(l.until));
      const myRes = res.filter((x) => x.listing === l.id && (o.countCancelled || x.status === "confirmed"));
      const myBlk = blocks.filter((x) => x.listing === l.id);
      for (let d = from; d < until; d++) {
        let booked;
        if (o.checkInMonth) booked = 0;
        else booked = myRes.some((x) => x.ci <= d && (o.closed ? d <= x.co : d < x.co)) ? 1 : 0;
        let blockedCount = myBlk.filter((x) => x.s <= d && d < x.e).length;
        if (!o.sumBlocks) blockedCount = Math.min(blockedCount, 1);
        let avail;
        if (o.keepBlocked) avail = 1;
        else if (o.blockWins) avail = 1 - blockedCount;
        else avail = booked ? 1 : 1 - blockedCount;
        bump(key(l.city, d), booked, avail);
      }
      if (o.checkInMonth) {
        // The whole stay is credited to its check-in month, if that month is in the window.
        for (const x of myRes) if (x.ci >= w0 && x.ci < w1) bump(key(l.city, x.ci), x.co - x.ci, 0);
      }
    }
    const out = [];
    for (const [k, [b, a]] of [...per.entries()].sort((x, y) => cmp(x[0], y[0]))) {
      if (o.dropZero && b === 0) continue;
      if (a <= 0) continue;
      const [city, month] = k.split("|");
      out.push([city, month, b, a, Math.floor((b * 20000 + a) / (2 * a)) / 10000]);
    }
    return out;
  };
  const rows = solve();

  const diagnostics = [
    { message: "Each stay was credited whole to its check-in month. A stay that crosses a month boundary contributes its nights to each month they fall in.", rows: solve({ checkInMonth: true }) },
    { message: "Blocked nights were left in the denominator. A night the host blocked is not available.", rows: solve({ keepBlocked: true }) },
    { message: "Cancelled reservations were counted as booked. Only confirmed reservations occupy nights.", rows: solve({ countCancelled: true }) },
    { message: "The check-out night was counted. A stay occupies check_in up to, but not including, check_out.", rows: solve({ closed: true }) },
    { message: "City-months with no booked nights are missing. A month with available nights and no bookings is a row with occupancy 0.", rows: solve({ dropZero: true }) },
  ];
  if (level >= 2) {
    diagnostics.push({ message: "Listings were counted as available before listed_from. Nights before a listing went live are not available.", rows: solve({ ignoreFrom: true }) });
    diagnostics.push({ message: "Overlapping blocks were subtracted twice. Count distinct blocked nights, not the sum of block lengths.", rows: solve({ sumBlocks: true }) });
  }
  if (level === 3) {
    diagnostics.push({ message: "Listings were counted as available after listed_until. A listing is listed from listed_from up to, but not including, listed_until.", rows: solve({ ignoreUntil: true }) });
    diagnostics.push({ message: "Blocked nights that are also booked were removed from available. A booked night counts as available, whatever blocks cover it.", rows: solve({ blockWins: true }) });
  }

  const lCols = ["listing_id", "city", "listed_from", "listed_until"];
  const lRows = listings.slice().sort((x, y) => cmp(x.id, y.id)).map((l) => [l.id, l.city, l.from, l.until]);
  const rCols = ["reservation_id", "listing_id", "check_in", "check_out", "status"];
  const rRows = res.slice().sort((x, y) => cmp(x.id, y.id)).map((x) => [x.id, x.listing, toStr(x.ci), toStr(x.co), x.status]);
  const bCols = ["block_id", "listing_id", "start_date", "end_date"];
  const bRows = blocks.slice().sort((x, y) => x.id - y.id).map((x) => [x.id, x.listing, toStr(x.s), toStr(x.e)]);
  const setup =
    "SET TIME ZONE 'UTC';\n" +
    "CREATE TABLE listings (\n  listing_id TEXT PRIMARY KEY,\n  city TEXT NOT NULL,\n  listed_from DATE NOT NULL,\n  listed_until DATE\n);\n" +
    "CREATE TABLE reservations (\n  reservation_id TEXT PRIMARY KEY,\n  listing_id TEXT NOT NULL REFERENCES listings(listing_id),\n  check_in DATE NOT NULL,\n  check_out DATE NOT NULL CHECK (check_out > check_in),\n  status TEXT NOT NULL CHECK (status IN ('confirmed', 'cancelled'))\n);\n" +
    "CREATE TABLE calendar_blocks (\n  block_id BIGINT PRIMARY KEY,\n  listing_id TEXT NOT NULL REFERENCES listings(listing_id),\n  start_date DATE NOT NULL,\n  end_date DATE NOT NULL CHECK (end_date > start_date)\n);\n" +
    insertSQL("listings", lCols, lRows) + insertSQL("reservations", rCols, rRows) + insertSQL("calendar_blocks", bCols, bRows);

  return {
    vars: {
      window: windowLabel,
      start_date: ymStr(y0, m0),
      end_date: ymStr(y3, m3),
      listing_rule: level === 1
        ? "Every listing in this sample went live before the window and is still listed (`listed_until` is NULL)."
        : level === 2
          ? "A listing is listed from `listed_from` on; nights before it are not available. `listed_until` is NULL in this sample (still listed)."
          : "A listing is listed from `listed_from` up to, but not including, `listed_until` (NULL means still listed); nights outside that range are not available.",
      block_rule: level === 1
        ? "Blocks never overlap each other or a confirmed stay in this sample."
        : level === 2
          ? "Blocks can overlap each other: a night covered by two blocks is one blocked night. Blocks never cover a confirmed stay in this sample."
          : "Blocks can overlap each other and can cover nights that are already booked (hosts sometimes block around a stay). A booked night counts as booked and as available, whatever blocks cover it.",
      listings: listings.length,
      reservations: res.length,
    },
    setup,
    tables: [
      { name: "listings", columns: lCols, rows: lRows },
      { name: "reservations", columns: rCols, rows: rRows },
      { name: "calendar_blocks", columns: bCols, rows: bRows },
    ],
    expected: { columns: ["city", "month", "booked_nights", "available_nights", "occupancy"], rows },
    diagnostics: diagnostics.filter((d) => JSON.stringify(d.rows) !== JSON.stringify(rows)),
  };
}
