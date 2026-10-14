/* ABB-L3-05 — Double-booked nights from confirmed reservations and their alterations (SQL).
   Simulated practice scenario. All listings, cities, guests and dates are generated from the
   seed and are hypothetical.

   A stay covers the nights check_in <= night < check_out (half-open: a check-out and a
   check-in on the same date share no night). A reservation counts only if its status is
   'confirmed'; its stay is the dates of its accepted alteration with the latest resolved_at,
   or its own dates when it has none (declined and pending alterations change nothing).
   A night of a listing is overbooked when more counted stays cover it than the listing has
   units. One row per listing with at least one overbooked night:
     overbooked_nights      distinct overbooked nights;
     excess_stay_nights     sum over those nights of (stays covering it - units);
     reservations_involved  distinct reservations covering at least one overbooked night;
     first_night            the earliest overbooked night.
   Ordered by excess_stay_nights DESC, listing_id.
   level: 1 Medium (statuses, back-to-back stays, a triple overlap, nested and identical stays,
                    at most one alteration per reservation: accepted or declined)
          2 Hard (+ several alterations per reservation, latest accepted by resolved_at wins,
                  pending alterations, small accepted date shifts)
          3 Very Hard (+ multi-unit listings: overbooked only above the unit count) */
import { insertSQL, ts } from "../../js/rng.js";

export const kind = "sql";

const DAY = 86400;
const DAY0 = Date.UTC(2026, 10, 2) / 1000;                   // night 0 = 2026-11-02
const CITIES = ["Lisbon", "Kyoto", "Austin", "Cape Town", "Oaxaca", "Edinburgh", "Hobart", "Marrakesh", "Bergen", "Valparaiso"];

const night = (d) => new Date((DAY0 + d * DAY) * 1000).toISOString().slice(0, 10);
function stamp(sec) {
  const day = new Date((DAY0 + sec) * 1000).toISOString().slice(0, 10);
  return ts(day, ((sec % DAY) + DAY) % DAY);
}

export function generate(r, level) {
  // ---- listings -------------------------------------------------------------------------
  const nList = level === 1 ? 4 : level === 2 ? r.int(5, 6) : r.int(6, 7);
  const cities = r.sample(CITIES, Math.min(nList, r.int(3, 4)));
  const idsUsed = new Set();
  const uid = (prefix, lo, hi) => {
    for (;;) {
      const id = prefix + r.int(lo, hi);
      if (!idsUsed.has(id)) { idsUsed.add(id); return id; }
    }
  };
  const listings = [];
  for (let i = 0; i < nList; i++) {
    listings.push({ id: uid("lst_", 1000, 9899), host: uid("hst_", 100, 989), city: cities[i % cities.length], units: 1, res: [], walk: [], tail: 36 });
  }
  const multi = level === 3 ? listings.slice(nList - 2) : [];      // multi-unit listings (Very Hard)
  multi[0] && (multi[0].units = 2);
  multi[1] && (multi[1].units = r.pick([2, 3]));
  const clean = listings[0];                                         // no overbooked night after all rules
  const single = listings.slice(1, nList - multi.length);           // conflict listings, one unit each

  // ---- reservations ---------------------------------------------------------------------
  const all = [];
  const book = (L, ci, co, status = "confirmed") => {
    const x = { L, ci, co, status, alts: [], guest: uid("gst_", 10000, 99999) };
    L.res.push(x);
    all.push(x);
    return x;
  };
  const alloc = (L, len) => {                                        // free nights after the walk
    const s = L.tail;
    L.tail += len + r.int(1, 3);
    return s;
  };
  const alter = (x, ci, co, status) => x.alts.push({ ci, co, status });
  const overlapping = (L) => {                                       // dates that overlap a walk stay
    const s = r.pick(L.walk);
    const st = s.ci + r.int(0, s.co - s.ci - 1);
    return [st, st + r.int(1, 4)];
  };

  // A calendar per unit: non-overlapping confirmed stays, the first two back to back.
  for (const L of listings) {
    for (let u = 0; u < L.units; u++) {
      let cur = r.int(0, 3), first = true;
      while (cur < 28) {
        const len = r.int(1, 6);
        L.walk.push(book(L, cur, cur + len));
        cur += len + (first ? 0 : r.chance(0.3) ? 0 : r.int(1, 4));
        first = false;
      }
    }
  }
  // Requests and bookings that hold no nights, often on top of booked nights.
  const quiet = level === 1 ? ["cancelled", "declined"] : ["cancelled", "declined", "pending"];
  for (const L of listings) {
    const k = r.int(1, 3);
    for (let i = 0; i < k; i++) {
      const [ci, co] = overlapping(L);
      book(L, ci, co, i === 0 ? "cancelled" : r.pick(quiet));
    }
  }
  // Ordinary conflicts on the single-unit conflict listings.
  for (const L of single) {
    const k = r.int(0, level === 1 ? 1 : 2);
    for (let i = 0; i < k; i++) book(L, ...overlapping(L));
  }

  // Forced cases.
  {                                                                  // three stays on one night
    const L = r.pick(single), s = r.pick(L.walk);
    const n = s.ci + r.int(0, s.co - s.ci - 1);
    book(L, Math.max(0, n - r.int(0, 2)), n + r.int(1, 3));
    book(L, Math.max(0, n - r.int(0, 2)), n + r.int(1, 3));
  }
  {                                                                  // one stay nested inside another
    const L = r.pick(single), a = alloc(L, 6);
    book(L, a, a + 6);
    const st = a + r.int(1, 2);
    book(L, st, st + r.int(1, 3));
  }
  {                                                                  // identical dates, another guest
    const L = r.pick(single), s = r.pick(L.walk);
    book(L, s.ci, s.co);
  }
  {                                                                  // accepted alteration creates a conflict
    const L = r.pick(single), len = r.int(1, 4), a = alloc(L, len);
    const x = book(L, a, a + len);
    alter(x, ...overlapping(L), "accepted");
  }
  {                                                                  // clean listing: accepted alteration resolves a conflict,
    const [ci, co] = overlapping(clean);                             // a declined one would have caused one
    const x = book(clean, ci, co);
    const a = alloc(clean, co - ci);
    alter(x, a, a + co - ci, "accepted");
    const len = r.int(1, 4), b = alloc(clean, len);
    const y = book(clean, b, b + len);
    alter(y, ...overlapping(clean), "declined");
  }
  if (level >= 2) {
    {                                                                // two accepted: the later (back to free nights) wins
      const L = r.pick(single), len = r.int(2, 4), a = alloc(L, len);
      const x = book(L, a, a + len);
      alter(x, ...overlapping(L), "accepted");
      const b = alloc(L, len);
      alter(x, b, b + len, "accepted");
    }
    {                                                                // accepted to free nights, then a pending move onto a booking
      const L = r.pick(single), len = r.int(1, 3), a = alloc(L, len);
      const x = book(L, a, a + len);
      const b = alloc(L, len);
      alter(x, b, b + len, "accepted");
      alter(x, ...overlapping(L), "pending");
    }
    {                                                                // free nights first, then an accepted move onto a booking
      const L = r.pick(single), len = r.int(1, 3), a = alloc(L, len);
      const x = book(L, a, a + len);
      const b = alloc(L, len);
      alter(x, b, b + len, "accepted");
      alter(x, ...overlapping(L), "accepted");
    }
    for (const L of single) {                                        // small accepted date shifts on ordinary stays
      if (!r.chance(0.6)) continue;
      const s = r.pick(L.walk);
      if (s.alts.length) continue;
      const d = r.pick([-1, 1]);
      alter(s, Math.max(0, s.ci + d), s.co + d, "accepted");
    }
  }
  for (const L of multi) {                                           // units + 1 stays on one night
    const a = alloc(L, 6);
    for (let i = 0; i <= L.units; i++) book(L, a + r.int(0, 2), a + 3 + r.int(0, 2));
    const k = r.int(0, 2);                                           // and some overlap that stays within units
    for (let i = 0; i < k; i++) book(L, ...overlapping(L));
  }

  // ---- timestamps and ids ---------------------------------------------------------------
  for (const x of all) {
    const earliest = Math.min(x.ci, ...x.alts.map((a) => a.ci));        // booked before any date it ever held
    x.booked = earliest * DAY - r.int(6, 45) * DAY - r.int(0, DAY - 1);
    let t = x.booked + r.int(2, 30) * 3600;
    for (const a of x.alts) {
      a.req = t;
      a.res = a.status === "pending" ? null : t + r.int(1, 30) * 3600;
      t = (a.res ?? t) + r.int(2, 48) * 3600;
    }
  }
  const byBooked = all.map((x, i) => i).sort((a, b) => all[a].booked - all[b].booked || a - b);
  let rn = 30000 + r.int(0, 60000);
  for (const i of byBooked) all[i].id = "res_" + (rn += r.int(1, 29));
  const altsAll = all.flatMap((x) => x.alts.map((a) => ({ x, a })));
  altsAll.sort((p, q) => p.a.req - q.a.req || (p.x.id < q.x.id ? -1 : 1));
  let an = 700 + r.int(0, 2000);
  for (const p of altsAll) p.a.id = "alt_" + (an += r.int(1, 9));

  // ---- the oracle (opts break one rule each, for diagnostics) -----------------------------
  const stayOf = (x, opts) => {
    if (opts.noAlter || !x.alts.length) return [x.ci, x.co];
    if (opts.anyAlter) {
      const a = x.alts.reduce((m, b) => (b.req > m.req ? b : m));
      return [a.ci, a.co];
    }
    const acc = x.alts.filter((a) => a.status === "accepted");
    if (!acc.length) return [x.ci, x.co];
    const a = acc.reduce((m, b) => (opts.firstAccepted ? (b.res < m.res ? b : m) : (b.res > m.res ? b : m)));
    return [a.ci, a.co];
  };
  const compute = (opts = {}) => {
    const out = [];
    for (const L of listings) {
      const cover = new Map();
      const counted = L.res.filter((x) => opts.noStatus || x.status === "confirmed");
      for (const x of counted) {
        const [ci, co] = stayOf(x, opts);
        for (let d = ci; opts.closed ? d <= co : d < co; d++) {
          if (!cover.has(d)) cover.set(d, []);
          cover.get(d).push(x.id);
        }
      }
      const u = opts.ignoreUnits ? 1 : L.units;
      const over = [...cover.entries()].filter(([, ids]) => ids.length > u).sort((p, q) => p[0] - q[0]);
      if (!over.length) continue;
      const nights = opts.pairs ? over.reduce((s, [, ids]) => s + (ids.length * (ids.length - 1)) / 2, 0) : over.length;
      const excess = over.reduce((s, [, ids]) => s + ids.length - u, 0);
      const involved = opts.involvedAll ? counted.length : new Set(over.flatMap(([, ids]) => ids)).size;
      out.push([L.id, L.city, nights, excess, involved, night(over[0][0])]);
    }
    return out.sort((p, q) => q[3] - p[3] || (p[0] < q[0] ? -1 : p[0] > q[0] ? 1 : 0));
  };
  const expected = compute();

  const diagnostics = [
    { message: "A check-out night was counted as booked. Stays are half-open: a stay covers check_in <= night < check_out, so a guest leaving on the 5th and one arriving on the 5th do not overlap (BETWEEN check_in AND check_out includes the check-out date).", rows: compute({ closed: true }) },
    { message: "Reservations that are not confirmed were counted. Cancelled bookings and declined or pending requests hold no nights: count only status = 'confirmed'.", rows: compute({ noStatus: true }) },
    { message: "Alterations were ignored. A reservation's stay is the dates of its latest accepted alteration; the check_in and check_out on the reservation row are the dates as first booked.", rows: compute({ noAlter: true }) },
    { message: "Declined or pending alterations were applied. Only an accepted alteration changes the stay; take the latest accepted one, not the latest one.", rows: compute({ anyAlter: true }) },
    { message: "Nights were counted once per overlapping pair. A self join yields three pairs for a night with three stays; overbooked_nights counts distinct nights.", rows: compute({ pairs: true }) },
    { message: "reservations_involved counted every confirmed reservation of the listing. Count only the reservations that cover at least one overbooked night.", rows: compute({ involvedAll: true }) },
  ];
  if (level >= 2) {
    diagnostics.push({ message: "The first accepted alteration was used. When a reservation has several accepted alterations, the one with the latest resolved_at sets the stay.", rows: compute({ firstAccepted: true }) });
  }
  if (level === 3) {
    diagnostics.push({ message: "Every listing was treated as one unit. A listing with units = 2 can host two stays on a night; it is overbooked only when more stays than units cover the night, and the excess is stays minus units.", rows: compute({ ignoreUnits: true }) });
  }

  // ---- tables ---------------------------------------------------------------------------
  const lCols = ["listing_id", "host_id", "city", "units"];
  const lRows = listings.slice().sort((p, q) => (p.id < q.id ? -1 : 1)).map((L) => [L.id, L.host, L.city, L.units]);
  const rCols = ["reservation_id", "listing_id", "guest_id", "check_in", "check_out", "status", "booked_at"];
  const rRows = byBooked.map((i) => all[i]).map((x) => [x.id, x.L.id, x.guest, night(x.ci), night(x.co), x.status, stamp(x.booked)]);
  const aCols = ["alteration_id", "reservation_id", "new_check_in", "new_check_out", "status", "requested_at", "resolved_at"];
  const aRows = altsAll.map(({ x, a }) => [a.id, x.id, night(a.ci), night(a.co), a.status, stamp(a.req), a.res === null ? null : stamp(a.res)]);

  const setup =
    "SET TIME ZONE 'UTC';\n" +
    "CREATE TABLE listings (\n  listing_id TEXT PRIMARY KEY,\n  host_id TEXT NOT NULL,\n  city TEXT NOT NULL,\n  units INT NOT NULL CHECK (units >= 1)\n);\n" +
    "CREATE TABLE reservations (\n  reservation_id TEXT PRIMARY KEY,\n  listing_id TEXT NOT NULL REFERENCES listings (listing_id),\n  guest_id TEXT NOT NULL,\n  check_in DATE NOT NULL,\n  check_out DATE NOT NULL,\n  status TEXT NOT NULL CHECK (status IN ('pending','confirmed','declined','cancelled')),\n  booked_at TIMESTAMPTZ NOT NULL,\n  CHECK (check_out > check_in)\n);\n" +
    "CREATE TABLE reservation_alterations (\n  alteration_id TEXT PRIMARY KEY,\n  reservation_id TEXT NOT NULL REFERENCES reservations (reservation_id),\n  new_check_in DATE NOT NULL,\n  new_check_out DATE NOT NULL,\n  status TEXT NOT NULL CHECK (status IN ('pending','accepted','declined')),\n  requested_at TIMESTAMPTZ NOT NULL,\n  resolved_at TIMESTAMPTZ,\n  CHECK (new_check_out > new_check_in)\n);\n" +
    insertSQL("listings", lCols, lRows) + insertSQL("reservations", rCols, rRows) + insertSQL("reservation_alterations", aCols, aRows);

  return {
    vars: {
      city_list: cities.join(", "),
      listings_n: lRows.length,
      reservations_n: rRows.length,
      alterations_n: aRows.length,
      alter_rule: level === 1
        ? "in this sample a reservation has at most one alteration, and it is either `accepted` or `declined`."
        : "a reservation can have several alterations over time, one open at a time: each is `pending` until the other party accepts or declines it, and its `resolved_at` is set then.",
      units_rule: level === 3
        ? "Some listings here have several identical units (`units` 2 or 3, like a guesthouse with matching rooms that are booked as one listing): such a listing is overbooked on a night only when more stays than `units` cover it."
        : "Every listing in this sample has `units = 1`, so a night is overbooked as soon as two counted stays cover it.",
    },
    setup,
    tables: [
      { name: "listings", columns: lCols, rows: lRows },
      { name: "reservations", columns: rCols, rows: rRows },
      { name: "reservation_alterations", columns: aCols, rows: aRows },
    ],
    expected: { columns: ["listing_id", "city", "overbooked_nights", "excess_stay_nights", "reservations_involved", "first_night"], rows: expected },
    diagnostics: diagnostics.filter((d) => JSON.stringify(d.rows) !== JSON.stringify(expected)),
  };
}
