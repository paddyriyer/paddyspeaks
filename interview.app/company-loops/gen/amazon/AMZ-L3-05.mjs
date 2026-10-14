/* AMZ-L3-05 — Available to promise from an inventory movement ledger and reservation holds (SQL).
   Simulated practice scenario. All data, names and quantities are generated from the seed
   and are hypothetical.

   One deterministic result set as of one instant T: one row per (fc_id, sku) with a movement
   at or before T or a reservation made at or before T, carrying
     on_hand               signed sum of movement qty at or before T (each event_id once);
     reserved              sum over the pair's reservations of the units each still holds at T:
                           qty minus units shipped against it by T (floored at 0), while it is
                           open (not cancelled at or before T, and T strictly before expires_at);
     available_to_promise  max(on_hand - reserved, 0);
     oversold_units        max(reserved - on_hand, 0).
   level: 1 Medium (receipts, damage, one-step shipments, cancellations, inclusive boundaries,
                    a pair with holds but no stock yet)
          2 Hard (+ hold expiry incl. a hold expiring exactly at T, signed cycle-count
                  adjustments, partial shipments straddling T)
          3 Very Hard (+ at-least-once feed: duplicated event_ids with later ingested_at,
                       and events that occurred before T but were ingested after it) */
import { insertSQL, ts } from "../../js/rng.js";

export const kind = "sql";

const H = 3600;
const BASE = Date.UTC(2026, 8, 14) / 1000;                      // 2026-09-14 00:00 UTC
const FCS = ["fc_alder", "fc_birch", "fc_cedar", "fc_dune", "fc_elm", "fc_fern", "fc_grove", "fc_heath"];
const SKUS = ["air_fryer", "backpack", "board_game", "desk_lamp", "drill", "headphones", "kettle", "phone_case", "water_bottle", "yoga_mat"];

function stamp(sec) {
  const day = new Date((BASE + sec) * 1000).toISOString().slice(0, 10);
  return ts(day, ((sec % 86400) + 86400) % 86400);
}

export function generate(r, level) {
  const T = 86400 + r.pick([10, 13, 16, 19]) * H + r.pick([0, 15 * 60, 30 * 60]);
  const ttlH = level === 1 ? r.pick([72, 96]) : r.pick([3, 4, 6, 8]);
  const ttl = ttlH * H;

  const fcs = r.sample(FCS, level === 3 ? 3 : 2).sort();
  const skus = r.shuffle(SKUS);
  const nPairs = level === 1 ? 4 : level === 2 ? r.int(5, 6) : r.int(6, 8);
  // Normal pairs: cycle fcs across the first skus. Then two special skus.
  const pairs = [];
  for (let k = 0; k < nPairs; k++) {
    pairs.push({ fc: fcs[k % fcs.length], sku: skus[Math.floor(k / fcs.length)], moves: [], res: [] });
  }
  const used = Math.ceil(nPairs / fcs.length);
  const preorder = { fc: r.pick(fcs), sku: skus[used], moves: [], res: [] };          // holds, no stock yet at T
  const future = { fc: r.pick(fcs), sku: skus[used + 1], moves: [], res: [] };       // everything after T: no row

  const move = (p, kind, qty, at, resv = null) => {
    const m = { fc: p.fc, sku: p.sku, kind, qty, at, resv, ing: at + r.int(1, 300) };
    p.moves.push(m);
    return m;
  };
  const reserve = (p, qty, at, extra = {}) => {
    const x = { fc: p.fc, sku: p.sku, qty, at, exp: at + ttl, cancel: null, ...extra };
    p.res.push(x);
    return x;
  };
  const ship = (p, x, qty, at) => move(p, "ship", -qty, at, x);
  const maxQ = level === 3 ? 4 : 3;
  const END = 3 * 86400 - 1;

  // Base traffic for the normal pairs.
  for (const p of pairs) {
    if (r.chance(0.6)) move(p, "receive", r.int(3, 15), r.int(2 * H, END));
    if (r.chance(0.3)) move(p, "damage", -r.int(1, 2), r.int(2 * H, END));
    if (level >= 2 && r.chance(0.5)) move(p, "adjust", r.pick([-3, -2, -1, 1, 2, 3]), r.int(2 * H, END));
    const k = r.int(2, level === 3 ? 5 : 4);
    for (let i = 0; i < k; i++) {
      const at = r.int(2 * H, END - 2 * H);
      const x = reserve(p, r.int(1, maxQ), at);
      const roll = r.next();
      const span = Math.min(ttl - 60, 10 * H);
      if (roll < 0.4) {
        if (level >= 2 && x.qty >= 2 && r.chance(0.5)) {
          const a = r.int(1, x.qty - 1);
          const t1 = at + r.int(60, Math.floor(span / 2));
          ship(p, x, a, t1);
          ship(p, x, x.qty - a, t1 + r.int(60, Math.floor(span / 2)));
        } else ship(p, x, x.qty, at + r.int(60, span));
      } else if (roll < 0.6) {
        x.cancel = at + r.int(60, Math.min(ttl - 60, 8 * H));
      }
    }
  }

  // Forced edge cases, each in a random normal pair.
  move(r.pick(pairs), "receive", r.int(2, 8), T);                                  // exactly at T: counts
  reserve(r.pick(pairs), r.int(1, maxQ), T);                                        // made exactly at T: holds
  {
    const at = T - r.int(30 * 60, Math.min(ttl - 2 * 60, 5 * H));
    reserve(r.pick(pairs), r.int(1, maxQ), at, { cancel: T });                      // cancelled exactly at T: no hold
  }
  {
    const p = r.pick(pairs);
    const at = T - r.int(10 * 60, Math.min(Math.floor(ttl / 2), 5 * H));
    const x = reserve(p, r.int(1, maxQ), at);
    ship(p, x, x.qty, T + r.int(5 * 60, at + ttl - T - 5 * 60));                    // shipped after T: still held at T
  }
  if (level >= 2) {
    reserve(r.pick(pairs), r.int(1, maxQ), T - ttl);                               // expires exactly at T: lapsed
    const p = r.pick(pairs);
    const at = T - r.int(20 * 60, Math.floor(ttl / 2));
    const x = reserve(p, r.int(2, maxQ + 1), at);
    const a = r.int(1, x.qty - 1);
    ship(p, x, a, r.int(at + 60, T - 60));                                          // part shipped before T
    ship(p, x, x.qty - a, T + r.int(60, at + ttl - T - 60));                        // the rest after T
  }
  if (level === 3) {
    const m = move(r.pick(pairs), "receive", r.int(2, 9), T - r.int(H, 3 * H));     // occurred before T,
    m.ing = T + r.int(H, 4 * H);                                                    // ingested after T: counts
  }

  // The pre-order pair: holds open at T, stock only after T.
  {
    const n = r.int(1, 2);
    for (let i = 0; i < n; i++) reserve(preorder, r.int(1, maxQ), T - r.int(60, Math.min(Math.floor(ttl / 2), 6 * H)));
    move(preorder, "receive", r.int(5, 20), T + r.int(H, 6 * H));
  }
  // The future pair: nothing at or before T.
  move(future, "receive", r.int(5, 20), T + r.int(60, 4 * H));
  reserve(future, r.int(1, maxQ), T + r.int(5 * H, 8 * H));

  // Opening stock for each normal pair, early, large enough that on_hand never goes negative.
  for (const p of pairs) {
    const out = p.moves.reduce((s, m) => s + (m.qty < 0 ? -m.qty : 0), 0);
    move(p, "receive", out + r.int(0, 8), r.int(0, 2 * H - 1));
  }

  // Ids: reservations in reservation order, events in occurrence order.
  const all = [...pairs, preorder, future];
  const resOrig = all.flatMap((p) => p.res);
  const order = resOrig.map((x, i) => i).sort((a, b) => resOrig[a].at - resOrig[b].at || a - b);
  let rid = 100 + r.int(0, 800), oid = 40000 + r.int(0, 50000);
  for (const i of order) {
    resOrig[i].id = "rsv_" + rid++;
    resOrig[i].order = "ord_" + (oid += r.int(1, 37));
  }
  const moves = all.flatMap((p) => p.moves).map((m, i) => ({ m, i })).sort((a, b) => a.m.at - b.m.at || a.i - b.i).map((x) => x.m);
  let evn = 5000 + r.int(0, 3000);
  for (const m of moves) m.id = "ev_" + evn++;

  // Level 3: at-least-once delivery. Some events arrive again with the same event_id.
  const rows = moves.map((m) => ({ ...m }));
  if (level === 3) {
    const before = moves.filter((m) => m.at <= T);
    const forced = [r.pick(before.filter((m) => m.kind === "ship")), r.pick(before.filter((m) => m.kind === "receive"))];
    for (const m of moves) {
      if (forced.includes(m) || r.chance(0.15)) rows.push({ ...m, ing: m.ing + r.int(30, 3600) });
    }
  }
  rows.sort((a, b) => a.ing - b.ing || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  // The oracle. opts break one rule each, for diagnostics.
  const compute = (opts = {}) => {
    const le = (a, b) => (opts.strict ? a < b : a <= b);
    const src = opts.dupes ? rows : moves;
    const onHand = new Map(), shipped = new Map(), held = new Map();
    for (const m of src) {
      if (!le(m.at, T)) continue;
      if (opts.ingested && m.ing > T) continue;
      const key = m.fc + "|" + m.sku;
      onHand.set(key, (onHand.get(key) || 0) + m.qty);
      if (m.kind === "ship") shipped.set(m.resv.id, (shipped.get(m.resv.id) || 0) - m.qty);
    }
    for (const x of resOrig) {
      if (!le(x.at, T)) continue;
      const key = x.fc + "|" + x.sku;
      if (!held.has(key)) held.set(key, 0);
      const cancelled = !opts.ignoreCancel && x.cancel !== null && le(x.cancel, T);
      const expired = !opts.ignoreExpiry && (opts.expiryInclusive ? x.exp < T : x.exp <= T);
      if (cancelled || expired) continue;
      const hold = Math.max(x.qty - (opts.fullQty ? 0 : shipped.get(x.id) || 0), 0);
      held.set(key, held.get(key) + hold);
    }
    const keys = new Set(onHand.keys());
    if (!opts.dropHoldOnly) for (const k of held.keys()) keys.add(k);
    return [...keys].sort().map((k) => {
      const [fc, sku] = k.split("|");
      const oh = onHand.get(k) || 0, rv = held.get(k) || 0;
      return [fc, sku, oh, rv, opts.noFloor ? oh - rv : Math.max(oh - rv, 0), opts.noFloor ? rv - oh : Math.max(rv - oh, 0)];
    });
  };
  const expected = compute();

  const diagnostics = [
    { message: "A boundary was treated as exclusive. Movements and reservations at exactly the as-of time count, and a reservation cancelled exactly at the as-of time no longer holds anything.", rows: compute({ strict: true }) },
    { message: "Units already shipped against a reservation were still counted as reserved. A ship movement consumes the hold: a reservation holds its qty minus the units shipped against it by the as-of time, otherwise every shipped unit is subtracted twice (once from on_hand, once as reserved).", rows: compute({ fullQty: true }) },
    { message: "Cancelled reservations were still holding units. A reservation cancelled at or before the as-of time releases its units.", rows: compute({ ignoreCancel: true }) },
    { message: "A (fc_id, sku) with reservations but no movements yet is missing. Starting from the movement ledger (or an inner join) drops exactly the oversold rows the report exists to show; combine both sides with a FULL JOIN or a UNION of keys.", rows: compute({ dropHoldOnly: true }) },
    { message: "available_to_promise and oversold_units were not floored at 0. Promising a negative number of units means nothing; the shortfall is reported in oversold_units, and available_to_promise is 0.", rows: compute({ noFloor: true }) },
  ];
  if (level >= 2) {
    diagnostics.push(
      { message: "Expired holds were still counted. A reservation holds its units only while the as-of time is strictly before expires_at.", rows: compute({ ignoreExpiry: true }) },
      { message: "A hold expiring exactly at the as-of time was counted. The hold lasts while as_of < expires_at; at expires_at it has lapsed.", rows: compute({ expiryInclusive: true }) },
    );
  }
  if (level === 3) {
    diagnostics.push(
      { message: "Redelivered events were counted twice. The feed is at-least-once: keep one row per event_id before summing (both on_hand and the units shipped against each reservation).", rows: compute({ dupes: true }) },
      { message: "Events were filtered by ingested_at. ingested_at is when the event reached the warehouse; an event that occurred before the as-of time belongs in the books even if it arrived later.", rows: compute({ ingested: true }) },
    );
  }

  const mCols = ["event_id", "fc_id", "sku", "kind", "qty", "reservation_id", "occurred_at", "ingested_at"];
  const rCols = ["reservation_id", "order_id", "fc_id", "sku", "qty", "reserved_at", "expires_at", "cancelled_at"];
  const mRows = rows.map((m) => [m.id, m.fc, m.sku, m.kind, m.qty, m.resv ? m.resv.id : null, stamp(m.at), stamp(m.ing)]);
  const rRows = order.map((i) => resOrig[i]).map((x) => [x.id, x.order, x.fc, x.sku, x.qty, stamp(x.at), stamp(x.exp), x.cancel === null ? null : stamp(x.cancel)]);

  const pk = level === 3 ? "PRIMARY KEY (event_id, ingested_at)" : "PRIMARY KEY (event_id)";
  const setup =
    "SET TIME ZONE 'UTC';\n" +
    "CREATE TABLE reservations (\n  reservation_id TEXT PRIMARY KEY,\n  order_id TEXT NOT NULL,\n  fc_id TEXT NOT NULL,\n  sku TEXT NOT NULL,\n  qty INT NOT NULL CHECK (qty > 0),\n  reserved_at TIMESTAMPTZ NOT NULL,\n  expires_at TIMESTAMPTZ NOT NULL,\n  cancelled_at TIMESTAMPTZ\n);\n" +
    "CREATE TABLE inventory_movements (\n  event_id TEXT NOT NULL,\n  fc_id TEXT NOT NULL,\n  sku TEXT NOT NULL,\n  kind TEXT NOT NULL CHECK (kind IN ('receive','ship','damage','adjust')),\n  qty INT NOT NULL,\n  reservation_id TEXT REFERENCES reservations (reservation_id),\n  occurred_at TIMESTAMPTZ NOT NULL,\n  ingested_at TIMESTAMPTZ NOT NULL,\n  " + pk + "\n);\n" +
    insertSQL("reservations", rCols, rRows) + insertSQL("inventory_movements", mCols, mRows);

  const asOf = stamp(T);
  return {
    vars: {
      as_of: asOf,
      ttl_hours: ttlH,
      movements: mRows.length,
      reservations: rRows.length,
      fc_list: fcs.map((f) => "`" + f + "`").join(", "),
      kinds_rule: level === 1
        ? "Movements are `receive` (positive), `damage` (negative) and `ship` (negative, with the reservation_id it fulfils; an order line ships in one movement)."
        : "Movements are `receive` (positive), `damage` (negative), `adjust` (a signed cycle-count correction) and `ship` (negative, with the reservation_id it fulfils; a reservation can ship in several movements).",
      feed_rule: level === 3
        ? "The movement feed is delivered at least once: a redelivered event appears again with the same event_id and a later ingested_at. Count each event_id once. occurred_at places an event in time; ingested_at is only when it reached the warehouse."
        : "Each event appears once. occurred_at places an event in time; ingested_at is only when it reached the warehouse.",
    },
    setup,
    tables: [
      { name: "reservations", columns: rCols, rows: rRows },
      { name: "inventory_movements", columns: mCols, rows: mRows },
    ],
    expected: { columns: ["fc_id", "sku", "on_hand", "reserved", "available_to_promise", "oversold_units"], rows: expected },
    diagnostics: diagnostics.filter((d) => JSON.stringify(d.rows) !== JSON.stringify(expected)),
  };
}
