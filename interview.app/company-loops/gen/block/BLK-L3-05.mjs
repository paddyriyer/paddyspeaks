/* BLK-L3-05 — Gift card balances on a date, and cards untouched for twelve months, per seller (SQL).
   Simulated practice scenario. All sellers, cards, amounts and dates are generated from the seed
   and are hypothetical. Money is integer cents.

   One deterministic result set as of the END of one local date D (local midnight that starts D + 1),
   one row per seller with at least one card activated by then, ordered by seller_id:
     cards_with_balance  cards whose balance at the as-of instant is above 0;
     outstanding_cents   the sum of those balances;
     dormant_cards       cards with balance above 0 whose last activity (balance checks excluded)
                         up to the as-of instant fell on or before the cutoff date C = D minus 12 months,
                         i.e. happened before local midnight that starts C + 1;
     dormant_cents       the sum of the dormant cards' balances.
   Balance = activate + load + refund − redeem (balance_check carries 0).
   level: 1 Medium (activate, load, redeem; every seller in UTC; an activity at 23:59:59 on D and one
                    at 00:00:00 on D + 1; last activity exactly on C and exactly at the start of C + 1;
                    a dormant card reloaded after D; a drained old card; a card activated after D;
                    a printed card never activated)
          2 Hard (+ refunds back onto a card, balance checks after the cutoff on a dormant card, a seller
                  whose activated cards are all drained: a row of zeros)
          3 Very Hard (+ sellers in different time zones: D, C and their boundaries are local dates,
                       occurred_at is an instant) */
import { insertSQL } from "../../js/rng.js";

export const kind = "sql";

const DAY = 86400;
const SELLERS = ["corner_bakery", "fern_florist", "harbor_cafe", "lantern_books", "north_barber", "river_salon", "sun_taqueria", "tide_yoga"];
// Fixed-offset zones (minutes east of UTC); none observes daylight saving time.
const NEGZ = [["America/Phoenix", -420], ["Pacific/Honolulu", -600], ["America/Regina", -360]];
const POSZ = [["Asia/Tokyo", 540], ["Australia/Brisbane", 600]];
const LOADS = [1500, 2000, 2500, 3000, 5000, 7500, 10000];

const iso = (sec) => new Date(sec * 1000).toISOString();
const stamp = (sec) => iso(sec).slice(0, 10) + " " + iso(sec).slice(11, 19) + "+00";
const dayStr = (day) => iso(day * DAY).slice(0, 10);

export function generate(r, level) {
  const month = r.int(5, 8), dom = r.int(2, 27);
  const D = Date.UTC(2026, month, dom) / 1000 / DAY;                 // epoch day of the as-of date
  const C = Date.UTC(2025, month, dom) / 1000 / DAY;                 // the cutoff date, 12 months earlier

  // Sellers and their time zones.
  const nSellers = level === 1 ? 3 : 4;
  const names = r.sample(SELLERS, nSellers).sort();
  let zones;
  if (level === 3) zones = r.shuffle([...r.sample(NEGZ, 2), ...r.sample(POSZ, 2)]);
  else zones = names.map(() => ["UTC", 0]);
  const sellers = names.map((id, i) => ({
    id, tz: zones[i][0], off: zones[i][1] * 60,
    locs: Array.from({ length: r.int(1, 3) }, (_, k) => id + "_" + (k + 1)),
    cards: [],
  }));
  const local = (s, day, sod) => day * DAY - s.off + sod;               // instant of a local day and second

  const cards = [];
  const newCard = (s, type) => {
    const c = { s, type: type || (r.chance(0.5) ? "physical" : "digital"), acts: [] };
    s.cards.push(c);
    cards.push(c);
    return c;
  };
  const act = (c, kind, amount, t) => c.acts.push({ kind, amount, t, loc: r.pick(c.s.locs) });
  const balance = (c) => c.acts.reduce((b, a) => b + (a.kind === "redeem" ? -a.amount : a.kind === "balance_check" ? 0 : a.amount), 0);
  const daytime = () => r.int(8 * 3600, 21 * 3600);

  // A random card: activated some time in the 20 months before D, then a few activities, possibly after D.
  const randomCard = (s) => {
    const c = newCard(s);
    let day = r.int(D - 600, D - 3);
    act(c, "activate", r.pick(LOADS), local(s, day, daytime()));
    const n = r.int(1, level === 1 ? 4 : 6);
    let redeemed = 0, refunded = 0;
    for (let i = 0; i < n; i++) {
      day += r.int(1, 140);
      const t = local(s, day, daytime());
      const bal = balance(c);
      const roll = r.next();
      if (level >= 2 && roll < 0.12) act(c, "balance_check", 0, t);
      else if (level >= 2 && roll < 0.22 && redeemed - refunded > 0) {
        const a = r.int(1, Math.min(redeemed - refunded, 4000));
        refunded += a;
        act(c, "refund", a, t);
      } else if (bal > 0 && roll < 0.75) {
        const a = r.chance(0.3) ? bal : r.int(100, Math.max(100, bal));
        redeemed += Math.min(a, bal);
        act(c, "redeem", Math.min(a, bal), t);
      } else act(c, "load", r.pick(LOADS), t);
    }
    return c;
  };
  for (const s of sellers) {
    const k = level === 1 ? r.int(2, 3) : r.int(3, 4);
    for (let i = 0; i < k; i++) randomCard(s);
  }

  const pickSeller = (pred) => r.pick(sellers.filter(pred || (() => true)));
  // 1. Last activity exactly on the cutoff date (dormant), with a positive balance.
  {
    const s = pickSeller(), c = newCard(s);
    const a = r.pick(LOADS);
    act(c, "activate", a, local(s, C - r.int(30, 200), daytime()));
    act(c, r.chance(0.5) ? "load" : "redeem", r.int(100, a - 100), local(s, C, r.int(12 * 3600, DAY - 1)));
    if (c.acts[1].kind === "load") c.acts[1].amount = r.pick(LOADS);
  }
  // 2. Last activity exactly at the local midnight that starts C + 1 (not dormant).
  {
    const s = pickSeller(), c = newCard(s);
    const a = r.pick(LOADS);
    act(c, "activate", a, local(s, C - r.int(20, 150), daytime()));
    act(c, "redeem", r.int(100, a - 100), local(s, C + 1, 0));
  }
  // 3. Dormant at D, reloaded after D.
  {
    const s = pickSeller(), c = newCard(s);
    act(c, "activate", r.pick(LOADS), local(s, C - r.int(40, 300), daytime()));
    act(c, "load", r.pick(LOADS), local(s, D + r.int(1, 25), daytime()));
  }
  // 4. End-of-day boundary: an activity at 23:59:59 on D counts, one at 00:00:00 on D + 1 does not.
  const eod = (s) => {
    const c = newCard(s);
    const a = r.pick(LOADS.slice(2));
    act(c, "activate", a, local(s, D - r.int(20, 200), daytime()));
    act(c, "redeem", r.int(100, a - 500), local(s, D, DAY - 1));
    act(c, "load", r.pick(LOADS), local(s, D + 1, 0));
  };
  if (level === 3) {
    eod(pickSeller((s) => s.off < 0));
    eod(pickSeller((s) => s.off > 0));
  } else eod(pickSeller());
  // 5. An old card drained to zero.
  const drained = (s) => {
    const c = newCard(s);
    const a = r.pick(LOADS), t0 = r.int(D - 650, C - 60);
    act(c, "activate", a, local(s, t0, daytime()));
    const part = r.int(100, a - 100);
    act(c, "redeem", part, local(s, t0 + r.int(1, 20), daytime()));
    act(c, "redeem", a - part, local(s, t0 + r.int(21, 50), daytime()));
  };
  // 6. A card activated after D.
  const future = (s) => {
    const c = newCard(s);
    act(c, "activate", r.pick(LOADS), local(s, D + r.int(1, 10), daytime()));
  };
  // 7. A printed card never activated.
  const blank = (s) => newCard(s, "physical");

  let zeroSeller = null;
  if (level >= 2) {
    // A seller whose activated cards are all drained: its row is all zeros.
    zeroSeller = { id: r.pick(SELLERS.filter((x) => !names.includes(x))), tz: "UTC", off: 0, locs: [], cards: [] };
    if (level === 3) { const z = r.pick([...NEGZ, ...POSZ]); zeroSeller.tz = z[0]; zeroSeller.off = z[1] * 60; }
    zeroSeller.locs = [zeroSeller.id + "_1"];
    sellers.push(zeroSeller);
    sellers.sort((a, b) => (a.id < b.id ? -1 : 1));
    drained(zeroSeller);
    if (r.chance(0.5)) future(zeroSeller);
    // A dormant card with balance checks after the cutoff: still dormant.
    {
      const s = pickSeller((x) => x !== zeroSeller), c = newCard(s);
      const a = r.pick(LOADS);
      act(c, "activate", a, local(s, C - r.int(60, 250), daytime()));
      act(c, "redeem", r.int(100, a - 100), local(s, C - r.int(5, 50), daytime()));
      act(c, "balance_check", 0, local(s, r.int(C + 2, D - 1), daytime()));
    }
    // A refund back onto a card within the last year.
    {
      const s = pickSeller((x) => x !== zeroSeller), c = newCard(s);
      const a = r.pick(LOADS.slice(2)), d0 = D - r.int(60, 300);
      act(c, "activate", a, local(s, d0, daytime()));
      const red = r.int(1000, a);
      act(c, "redeem", red, local(s, d0 + r.int(1, 20), daytime()));
      act(c, "refund", r.int(100, red), local(s, d0 + r.int(21, 50), daytime()));
    }
  }
  drained(pickSeller((x) => x !== zeroSeller));
  future(pickSeller((x) => x !== zeroSeller));
  blank(pickSeller((x) => x !== zeroSeller));

  // Ids: cards in a shuffled order, activities in occurrence order.
  let cid = 1000 + r.int(0, 8000);
  for (const c of r.shuffle(cards)) c.id = "gc_" + (cid += r.int(1, 9));
  const acts = cards.flatMap((c) => c.acts.map((a) => ({ ...a, c }))).map((a, i) => ({ a, i })).sort((x, y) => x.a.t - y.a.t || x.i - y.i).map((x) => x.a);
  let aid = 50000 + r.int(0, 40000);
  for (const a of acts) a.id = "gca_" + aid++;
  for (const c of cards) {
    const first = c.acts.length ? c.acts[0].t : local(c.s, D - r.int(10, 400), daytime());
    c.created = c.type === "physical" ? first - r.int(5, 90) * DAY - r.int(0, 3600) : first;
  }

  // The oracle. opts break one rule each, for diagnostics.
  const compute = (opts = {}) => {
    const out = [];
    for (const s of sellers) {
      const off = opts.utc ? 0 : s.off;
      const end = opts.startOfDay ? D * DAY - off : (D + 1) * DAY - off;
      const quiet = (opts.strict ? C : C + 1) * DAY - off;
      let any = false, nb = 0, sum = 0, nd = 0, sd = 0;
      for (const c of s.cards) {
        const in_ = c.acts.filter((a) => opts.noAsOf || a.t < end);
        if (!in_.some((a) => a.kind === "activate")) continue;
        any = true;
        const bal = in_.reduce((b, a) => b + (a.kind === "redeem" || (opts.refundSub && a.kind === "refund") ? -a.amount : a.kind === "balance_check" ? 0 : a.amount), 0);
        const real = (opts.lastAll ? c.acts : in_).filter((a) => opts.checks || a.kind !== "balance_check");
        const last = Math.max(...real.map((a) => a.t));
        const quietOk = opts.leTs ? last <= quiet : last < quiet;
        if (bal > 0) { nb++; sum += bal; }
        if (quietOk && (bal > 0 || (opts.zeroDormant && bal === 0))) { nd++; sd += bal; }
      }
      if (!any || (opts.dropZero && nb === 0)) continue;
      out.push([s.id, nb, sum, nd, sd]);
    }
    return out;
  };
  const expected = compute();

  const diagnostics = [
    { message: "Activities on the as-of date itself were left out. The balance is as of the END of the as-of date: include everything before the local midnight that starts the next day (an activity at 23:59:59 counts, one at 00:00:00 the next day does not).", rows: compute({ startOfDay: true }) },
    { message: "Activities after the as-of date were counted. A balance on a date reads only the activities up to the end of that date; later loads and redemptions belong to later dates.", rows: compute({ noAsOf: true }) },
    { message: "Dormancy used the card's last activity ever, including activities after the as-of date. A card that was untouched for 12 months on the as-of date and reloaded later was dormant on that date.", rows: compute({ lastAll: true }) },
    { message: "The cutoff date was treated as exclusive. A card whose last activity fell ON the cutoff date has been untouched for 12 months: dormant means last activity on or before the cutoff date.", rows: compute({ strict: true }) },
    { message: "A card whose last activity was at exactly 00:00:00 on the day after the cutoff date was counted as dormant. Comparing last_activity <= (as-of end − 12 months) includes that instant; the day after the cutoff date is inside the 12 months, so use < local midnight that starts the day after the cutoff.", rows: compute({ leTs: true }) },
    { message: "Cards with a zero balance were counted as dormant. Dormant applies only to cards that still hold money (balance above 0).", rows: compute({ zeroDormant: true }) },
  ];
  if (level >= 2) {
    diagnostics.push(
      { message: "Refunds were subtracted. A refund puts a purchase's money back onto the card, so it adds to the balance like a load.", rows: compute({ refundSub: true }) },
      { message: "Balance checks were treated as activity. A balance check reads the card without using it; it does not stop the card from being dormant.", rows: compute({ checks: true }) },
      { message: "A seller whose activated cards all have zero balance is missing. Every seller with at least one card activated by the as-of date gets a row, with zeros when nothing is outstanding (starting from cards with a balance, or a HAVING on the balance, drops it).", rows: compute({ dropZero: true }) },
    );
  }
  if (level === 3) {
    diagnostics.push({ message: "Dates were taken in UTC. The as-of date and the cutoff date are each seller's local dates in sellers.time_zone: compute the boundaries as local midnight converted to an instant (for example (date + 1)::timestamp AT TIME ZONE time_zone).", rows: compute({ utc: true }) });
  }

  const sCols = ["seller_id", "time_zone"];
  const cCols = ["card_id", "seller_id", "card_type", "created_at"];
  const aCols = ["activity_id", "card_id", "location_id", "kind", "amount_cents", "occurred_at"];
  const sRows = sellers.map((s) => [s.id, s.tz]);
  const cRows = cards.slice().sort((a, b) => (a.id < b.id ? -1 : 1)).map((c) => [c.id, c.s.id, c.type, stamp(c.created)]);
  const aRows = acts.map((a) => [a.id, a.c.id, a.loc, a.kind, a.amount, stamp(a.t)]);

  const setup =
    "SET TIME ZONE 'UTC';\n" +
    "CREATE TABLE sellers (\n  seller_id TEXT PRIMARY KEY,\n  time_zone TEXT NOT NULL\n);\n" +
    "CREATE TABLE gift_cards (\n  card_id TEXT PRIMARY KEY,\n  seller_id TEXT NOT NULL REFERENCES sellers (seller_id),\n  card_type TEXT NOT NULL CHECK (card_type IN ('physical','digital')),\n  created_at TIMESTAMPTZ NOT NULL\n);\n" +
    "CREATE TABLE gift_card_activities (\n  activity_id TEXT PRIMARY KEY,\n  card_id TEXT NOT NULL REFERENCES gift_cards (card_id),\n  location_id TEXT NOT NULL,\n  kind TEXT NOT NULL CHECK (kind IN ('activate','load','redeem','refund','balance_check')),\n  amount_cents INT NOT NULL CHECK (amount_cents >= 0),\n  occurred_at TIMESTAMPTZ NOT NULL\n);\n" +
    insertSQL("sellers", sCols, sRows) + insertSQL("gift_cards", cCols, cRows) + insertSQL("gift_card_activities", aCols, aRows);

  return {
    vars: {
      as_of_date: dayStr(D),
      cutoff_date: dayStr(C),
      cards: cRows.length,
      activities: aRows.length,
      kinds_rule: level === 1
        ? "`activate` and `load` add, and `redeem` subtracts. Every activity counts as activity for dormancy."
        : "`activate`, `load` and `refund` (a purchase refunded back onto the card) add, `redeem` subtracts, and `balance_check` carries amount 0. A balance check is not activity: it does not stop a card from being dormant.",
      tz_rule: level === 3
        ? "Sellers are in different time zones. The as-of date and the cutoff date are each seller's local dates in `sellers.time_zone`; `occurred_at` is an instant (shown in UTC)."
        : "Dates are the seller's local dates, and every seller here has `time_zone` 'UTC'.",
    },
    setup,
    tables: [
      { name: "sellers", columns: sCols, rows: sRows },
      { name: "gift_cards", columns: cCols, rows: cRows },
      { name: "gift_card_activities", columns: aCols, rows: aRows },
    ],
    expected: { columns: ["seller_id", "cards_with_balance", "outstanding_cents", "dormant_cards", "dormant_cents"], rows: expected },
    diagnostics: diagnostics.filter((d) => JSON.stringify(d.rows) !== JSON.stringify(expected)),
  };
}
