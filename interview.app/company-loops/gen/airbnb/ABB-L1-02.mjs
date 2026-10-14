/* ABB-L1-02 — Refunds owed under this exercise's cancellation policies (SQL).
   Simulated practice scenario. The policies, tiers, fees and amounts are hypothetical and
   defined by the exercise; they are not any marketplace's current policy.

   Contract: see docs/COMPANY-INTERVIEW-LOOPS.md § Executable templates (sql).
   The oracle below applies the rules booking by booking in JavaScript; the evaluator's
   reference picks the tier with DISTINCT ON over a join to policy_tiers.
   level: 1 Medium (one cancellation per booking, all before check-in; notice tiers with
            exact-boundary cancellations; half-cent rounding)
          2 Hard (+ a strict-policy grace tier that also needs the cancellation within 48 hours
            of booking; duplicate cancellation events, out of event-id order)
          3 Very Hard (+ cancellations at or after check-in: nights already begun are never
            refunded, the rest at the policy's base tier, fees kept) */
import { insertSQL } from "../../js/rng.js";

export const kind = "sql";

const BASE = Date.UTC(2026, 8, 1) / 1000;                 // 2026-09-01 00:00:00 UTC, in seconds
const fmt = (sec) => new Date(sec * 1000).toISOString().slice(0, 19).replace("T", " ") + "+00";
const H = 3600, D = 86400;

export function generate(r, level) {
  const F = r.pick([1, 2]), M = r.pick([5, 7]), PM = r.pick([25, 50]), S = r.pick([7, 10]), G = r.pick([14, 30]);
  const GRACE_H = 48;
  const tiers = [
    { policy: "flexible", min: F, maxH: null, pct: 100, svc: true },
    { policy: "flexible", min: 0, maxH: null, pct: 50, svc: false },
    { policy: "moderate", min: M, maxH: null, pct: 100, svc: true },
    { policy: "moderate", min: 0, maxH: null, pct: PM, svc: false },
    { policy: "strict", min: S, maxH: null, pct: 50, svc: false },
    { policy: "strict", min: 0, maxH: null, pct: 0, svc: false },
  ];
  if (level >= 2) tiers.push({ policy: "strict", min: G, maxH: GRACE_H, pct: 100, svc: true });
  const minOf = { flexible: F, moderate: M, strict: S };
  const checkInHour = r.pick([14, 15, 16]);

  const bookings = [];   // {id, listing, policy, booked, ci, nights, nightly, cleaning, svc}
  const cancels = [];    // {event, booking, at}
  let bk = 3000 + r.int(0, 5000), ev = 900000 + r.int(0, 90000);
  const newBooking = (policy, leadDays, nights) => {
    const booked = BASE + r.int(0, 20) * D + r.int(0, D - 1);
    const ciDay = Math.floor(booked / D) + leadDays;
    const b = {
      id: "bk_" + (bk += r.int(1, 60)), listing: "lst_" + r.int(100, 999), policy, booked,
      ci: ciDay * D + checkInHour * H, nights,
      nightly: r.int(7000, 42000), cleaning: r.pick([0, 2500, 4000, 6000, 8500]), svc: r.int(900, 6500),
    };
    bookings.push(b);
    return b;
  };
  const cancel = (b, at) => cancels.push({ event: ev += r.int(1, 30), booking: b.id, at });

  const n = 9 + 3 * level;
  for (let i = 0; i < n; i++) {
    const policy = r.pick(["flexible", "moderate", "strict"]);
    const b = newBooking(policy, r.int(2, 45), r.int(1, 9));
    if (r.chance(0.2)) continue;                                   // never cancelled
    cancel(b, r.int(b.booked, b.ci - 1));
  }
  // Every level: exactly at a tier's notice boundary, and one second inside it.
  for (const policy of r.sample(["flexible", "moderate", "strict"], 2)) {
    const T = minOf[policy];
    const b1 = newBooking(policy, T + r.int(3, 12), r.int(1, 6));
    cancel(b1, b1.ci - T * D);                                     // exactly T days: the tier applies
    const b2 = newBooking(policy, T + r.int(3, 12), r.int(1, 6));
    cancel(b2, b2.ci - T * D + 1);                                 // one second late: the next tier down
  }
  // Every level: an odd amount at a 50% tier, so the refund ends in half a cent.
  {
    const b = newBooking("flexible", F + r.int(2, 9), 1);
    b.nightly = 2 * r.int(4000, 20000) + 1;
    cancel(b, b.ci - r.int(1, F * D - 1));
  }
  if (level >= 2) {
    // The grace tier: within 48 hours of booking and at least G days before check-in.
    const g1 = newBooking("strict", G + r.int(5, 20), r.int(2, 7));
    cancel(g1, g1.booked + GRACE_H * H);                           // exactly 48 hours: applies
    const g2 = newBooking("strict", G + r.int(5, 20), r.int(2, 7));
    cancel(g2, g2.booked + GRACE_H * H + 1);                       // one second later: does not
    const g3 = newBooking("strict", G - r.int(1, 3), r.int(2, 7));
    cancel(g3, g3.booked + r.int(1, 40) * H);                      // in time, but too close to check-in
    // Duplicate cancellation events: the earliest cancelled_at counts, not the lowest event_id.
    for (const policy of ["moderate", "strict"]) {
      const T = minOf[policy];
      const b = newBooking(policy, T + r.int(6, 15), r.int(2, 6));
      const late = b.ci - r.int(1, T * D - 1);                     // inside the notice period
      const early = b.ci - T * D - r.int(1, 4 * D);                // before it
      cancel(b, late);
      cancel(b, early);                                            // logged later, happened earlier
    }
  }
  if (level === 3) {
    for (let k = 0; k < 3; k++) {
      const b = newBooking(r.pick(["flexible", "moderate"]), r.int(2, 20), r.int(3, 9));
      cancel(b, b.ci + r.int(1, (b.nights - 1) * 24) * H + r.int(0, H - 1));   // mid-stay
    }
    const b0 = newBooking("moderate", r.int(3, 20), r.int(2, 6));
    cancel(b0, b0.ci);                                             // exactly at check-in: night 1 has begun
    const b1 = newBooking("flexible", r.int(3, 20), r.int(3, 6));
    cancel(b1, b1.ci + 2 * D);                                     // exactly when night 3 begins
    const b2 = newBooking("flexible", r.int(3, 20), r.int(1, 3));
    cancel(b2, b2.ci + b2.nights * D + r.int(1, 10) * H);          // after check-out: nothing left
  }

  const rhu = (x) => Math.floor((x + 50) / 100);                 // x is cents × percent
  const solve = (o = {}) => {
    const first = new Map();
    for (const c of cancels) {
      const cur = first.get(c.booking);
      if (cur === undefined || (o.latest ? c.at > cur : c.at < cur)) first.set(c.booking, c.at);
    }
    const out = [];
    for (const b of bookings.slice().sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0))) {
      if (!first.has(b.id)) continue;
      const at = first.get(b.id);
      const days = Math.floor((b.ci - at) / D);
      let pct, refund;
      if (at < b.ci || o.midAsBefore) {
        let best = null;
        for (const t of tiers) {
          if (t.policy !== b.policy) continue;
          if (o.strictGt ? !(days > t.min) : !(days >= t.min)) continue;
          if (t.maxH !== null && (o.noGrace || at > b.booked + t.maxH * H)) continue;
          if (!best || t.pct > best.pct) best = t;
        }
        pct = best ? best.pct : 0;
        const svc = best ? best.svc : false;
        const nightsPart = o.trunc ? Math.floor(b.nights * b.nightly * pct / 100) : rhu(b.nights * b.nightly * pct);
        refund = nightsPart + (o.noCleaning ? 0 : b.cleaning) + (svc && !o.noSvc ? b.svc : 0);
      } else {
        pct = tiers.find((t) => t.policy === b.policy && t.min === 0 && t.maxH === null).pct;
        const begun = Math.min(b.nights, Math.floor((at - b.ci) / D) + (o.offByOne ? 0 : 1));
        refund = rhu((b.nights - begun) * b.nightly * pct);
      }
      out.push([b.id, b.policy, days, pct, refund]);
    }
    return out;
  };
  const rows = solve();

  const diagnostics = [
    { message: "A cancellation exactly at a tier's notice boundary was given the lower tier. At least N days before check-in includes exactly N days.", rows: solve({ strictGt: true }) },
    { message: "The cleaning fee was kept. A cancellation before check-in refunds the cleaning fee in full.", rows: solve({ noCleaning: true }) },
    { message: "The service fee was never refunded. It is refunded when the tier says so.", rows: solve({ noSvc: true }) },
    { message: "Half cents were truncated. Round the nightly refund half up to whole cents.", rows: solve({ trunc: true }) },
  ];
  if (level >= 2) {
    diagnostics.push({ message: "The latest cancellation event was used. When a booking has several, the earliest cancelled_at counts.", rows: solve({ latest: true }) });
    diagnostics.push({ message: "The grace tier never applied. A tier with max_hours_after_booking applies when the cancellation is within that many hours of booked_at (inclusive) and the notice is long enough.", rows: solve({ noGrace: true }) });
  }
  if (level === 3) {
    diagnostics.push({ message: "Mid-stay cancellations were treated like cancellations before check-in.", rows: solve({ midAsBefore: true }) });
    diagnostics.push({ message: "A night that begins exactly at the cancellation was refunded. A night has begun once check_in plus k days is at or before cancelled_at.", rows: solve({ offByOne: true }) });
  }

  const cmp = (x, y) => (x < y ? -1 : x > y ? 1 : 0);
  const tCols = ["policy", "min_notice_days", "max_hours_after_booking", "nightly_refund_pct", "service_fee_refunded"];
  const tRows = tiers.slice().sort((x, y) => cmp(x.policy, y.policy) || y.min - x.min || cmp(x.maxH ?? -1, y.maxH ?? -1)).map((t) => [t.policy, t.min, t.maxH, t.pct, t.svc]);
  const bCols = ["booking_id", "listing_id", "policy", "booked_at", "check_in", "nights", "nightly_cents", "cleaning_cents", "service_fee_cents"];
  const bRows = bookings.slice().sort((x, y) => cmp(x.id, y.id)).map((b) => [b.id, b.listing, b.policy, fmt(b.booked), fmt(b.ci), b.nights, b.nightly, b.cleaning, b.svc]);
  const cCols = ["event_id", "booking_id", "cancelled_at"];
  const cRows = cancels.slice().sort((x, y) => x.event - y.event).map((c) => [c.event, c.booking, fmt(c.at)]);
  const setup =
    "SET TIME ZONE 'UTC';\n" +
    "CREATE TABLE policy_tiers (\n  policy TEXT NOT NULL,\n  min_notice_days INT NOT NULL,\n  max_hours_after_booking INT,\n  nightly_refund_pct INT NOT NULL,\n  service_fee_refunded BOOLEAN NOT NULL\n);\n" +
    "CREATE TABLE bookings (\n  booking_id TEXT PRIMARY KEY,\n  listing_id TEXT NOT NULL,\n  policy TEXT NOT NULL,\n  booked_at TIMESTAMPTZ NOT NULL,\n  check_in TIMESTAMPTZ NOT NULL,\n  nights INT NOT NULL CHECK (nights >= 1),\n  nightly_cents INT NOT NULL,\n  cleaning_cents INT NOT NULL,\n  service_fee_cents INT NOT NULL\n);\n" +
    "CREATE TABLE cancellations (\n  event_id BIGINT PRIMARY KEY,\n  booking_id TEXT NOT NULL REFERENCES bookings(booking_id),\n  cancelled_at TIMESTAMPTZ NOT NULL\n);\n" +
    insertSQL("policy_tiers", tCols, tRows) + insertSQL("bookings", bCols, bRows) + insertSQL("cancellations", cCols, cRows);

  return {
    vars: {
      flexible_days: F,
      moderate_days: M,
      moderate_pct: PM,
      strict_days: S,
      grace_rule: level === 1
        ? "Every tier in this sample has `max_hours_after_booking` NULL."
        : `A tier with \`max_hours_after_booking\` set applies only if the cancellation is also at most that many hours after \`booked_at\` (inclusive); in this sample the strict policy has such a grace tier (100% at ${G}+ days, within ${GRACE_H} hours of booking).`,
      dup_rule: level === 1
        ? "Each cancelled booking has exactly one row in `cancellations`."
        : "A booking can have several cancellation events (client retries); the earliest `cancelled_at` counts, whatever the `event_id` order.",
      stay_rule: level === 3
        ? "A cancellation at or after `check_in` is a mid-stay cancellation: night k (k = 0, 1, …) has begun when `check_in + k days <= cancelled_at`; begun nights are never refunded, the remaining nights are refunded at the policy's base tier (`min_notice_days = 0`, no booking window), and neither fee is refunded. Report its `nightly_refund_pct` as that base tier's."
        : "Every cancellation in this sample happens before `check_in`.",
    },
    setup,
    tables: [
      { name: "policy_tiers", columns: tCols, rows: tRows },
      { name: "bookings", columns: bCols, rows: bRows },
      { name: "cancellations", columns: cCols, rows: cRows },
    ],
    expected: { columns: ["booking_id", "policy", "days_before", "nightly_refund_pct", "refund_cents"], rows },
    diagnostics: diagnostics.filter((d) => JSON.stringify(d.rows) !== JSON.stringify(rows)),
  };
}
