/* PYP-L3-05 — Late claims: buyer protection claims filed after this exercise's window, per item
   category and month, with reopened claims counted once (SQL).
   Simulated practice scenario. All buyers, purchases, claims, windows and dates are generated from
   the seed and are hypothetical; the claim window and its versions are this exercise's rules, not
   any real programme's (check current docs).

   One row per (item_category, claim_month) with at least one claim, ordered by both:
     claims                 original claims (reopens_claim_id IS NULL) filed in that month
     late_claims            those whose days_to_claim exceed the window in force on the purchase date
     reopened_claims        those reopened at least once (directly)
     median_days_to_claim   percentile_cont(0.5) of days_to_claim over the group's claims
   days_to_claim = the original's filing date - the purchase date, both as calendar dates in the
   buyer's time zone; claim_month is the original's filing month in that time zone. The window is
   the programme_rules row with the latest effective_from on or before the purchase date.
   level: 1 Medium (one rule, every buyer in UTC, reopenings one level deep, a claim filed exactly
                    on the last day of the window, one filed the day after it but less than
                    window + 1 full days later)
          2 Hard (+ a rule change part-way through the purchases, a purchase on the change date,
                  buyers in several time zones, a claim that changes month in UTC)
          3 Very Hard (+ a future-dated rule version, reopenings of reopenings, and a purchase with
                       two separate original claims, only one of them reopened) */
import { insertSQL, pad2, ts } from "../../js/rng.js";

export const kind = "sql";

const DAY = 86400;
const ZONES = [["Asia/Tokyo", 9 * 3600], ["America/Bogota", -5 * 3600], ["Asia/Kolkata", 19800],
  ["America/Phoenix", -7 * 3600], ["Pacific/Honolulu", -10 * 3600], ["Africa/Lagos", 3600], ["Asia/Singapore", 8 * 3600]];
const CATS = ["electronics", "apparel", "home_goods", "event_tickets", "collectibles", "beauty", "toys", "sporting_goods"];
const CURR = [["USD", 2], ["EUR", 2], ["GBP", 2], ["JPY", 0], ["KWD", 3]];
const REASONS = ["item_not_received", "not_as_described"];

const dateOf = (d) => { const x = new Date(d * DAY * 1000); return `${x.getUTCFullYear()}-${pad2(x.getUTCMonth() + 1)}-${pad2(x.getUTCDate())}`; };

export function generate(r, level) {
  const B = Date.UTC(2026, r.int(0, 5), 1) / 1000 / DAY + r.int(0, 9);       // first purchase day
  const wins = r.shuffle([30, 45, 60]);
  const rules = [{ from: B - 300 - r.int(0, 400), w: wins[0] }];
  if (level >= 2) rules.push({ from: B + r.int(18, 28), w: wins[1] });
  const C = level >= 2 ? rules[1].from : null;
  const windowAt = (d, opts = {}) => {
    let best = null;
    for (const x of rules) if ((opts.exclusive ? x.from < d : x.from <= d) && (!best || x.from > best.from)) best = x;
    return best.w;
  };
  const cats = r.sample(CATS, level === 1 ? 3 : 4);

  // Buyers: everyone in UTC at level 1; several fixed-offset zones (no daylight saving) above.
  const buyers = [];
  const zonesUsed = level === 1 ? [["UTC", 0]] : [ZONES[0], ZONES[1], ...r.sample(ZONES.slice(2), r.int(1, 2))];
  const newBuyer = (zone) => { const b = { zone: zone || r.pick(zonesUsed) }; buyers.push(b); return b; };
  const someBuyer = () => (buyers.length && r.chance(0.3) ? r.pick(buyers) : newBuyer());

  const purchases = [], claims = [];
  const addPurchase = (buyer, pDay, pTod) => {
    const [cur, exp] = r.pick(CURR);
    const amount = exp === 0 ? r.int(8, 600) * 100 : exp === 2 ? r.int(899, 64999) : r.int(3, 200) * 1000 + r.int(0, 999);
    const p = { buyer, cat: r.pick(cats), day: pDay, at: pDay * DAY + pTod - buyer.zone[1], cur, amount };
    purchases.push(p);
    return p;
  };
  const addClaim = (p, fDay, fTod, parent, reason) => {
    const c = { p, at: fDay * DAY + fTod - p.buyer.zone[1], parent: parent || null, reason: reason || (parent ? parent.reason : r.pick(REASONS)) };
    claims.push(c);
    return c;
  };
  const reopen = (c, minGap, maxGap) => {
    const localDay = Math.floor((c.at + c.p.buyer.zone[1]) / DAY);
    return addClaim(c.p, localDay + r.int(minGap, maxGap), r.int(0, DAY - 1), c);
  };

  // Random purchases with one claim each, some reopened.
  const n = level === 1 ? r.int(13, 17) : level === 2 ? r.int(18, 24) : r.int(22, 28);
  for (let i = 0; i < n; i++) {
    const p = addPurchase(someBuyer(), B + r.int(0, 45), r.int(0, DAY - 1));
    const W = windowAt(p.day);
    const root = addClaim(p, p.day + r.int(1, W + 25), r.int(0, DAY - 1));
    if (r.chance(0.25)) {
      const a = reopen(root, 2, 30);
      if (level === 3 && r.chance(0.35)) reopen(a, 2, 12);
    }
  }

  // Forced edge cases.
  {   // filed on the window's last day (on time), reopened after the window
    const p = addPurchase(someBuyer(), B + r.int(2, 12), r.int(0, DAY - 1));
    const root = addClaim(p, p.day + windowAt(p.day), r.int(0, DAY - 1));
    reopen(root, 4, 15);
  }
  {   // window + 1 calendar days, but fewer than window + 1 full days: late
    const p = addPurchase(someBuyer(), B + r.int(3, 40), r.int(22 * 3600, 23 * 3600 + 1800));
    addClaim(p, p.day + windowAt(p.day) + 1, r.int(900, 7200));
  }
  if (level >= 2) {
    const tokyo = newBuyer(ZONES[0]), bogota = newBuyer(ZONES[1]);
    {   // Tokyo: purchase at 05:xx local (the previous day in UTC); filed on the last local day of the window
      const p = addPurchase(tokyo, B + r.int(2, C - B - 3), 5 * 3600 + r.int(0, 3000));
      addClaim(p, p.day + windowAt(p.day), 19 * 3600 + r.int(0, 1800));
    }
    {   // Bogota: filed late on the last local day of a month (the next month in UTC)
      const t = new Date((B + 30) * DAY * 1000);
      const monthEnd = Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0) / 1000 / DAY;
      const p = addPurchase(bogota, monthEnd - r.int(3, 20), r.int(0, DAY - 1));
      addClaim(p, monthEnd, 21 * 3600 + r.int(0, 9000));
    }
    const [lo, hi] = [Math.min(rules[0].w, rules[1].w), Math.max(rules[0].w, rules[1].w)];
    {   // purchased before the rule change, filed after it, days between the two windows
      const p = addPurchase(someBuyer(), C - r.int(1, 6), r.int(0, DAY - 1));
      addClaim(p, p.day + r.int(lo + 1, hi), r.int(0, DAY - 1));
    }
    {   // purchased on the change date: the new rule applies
      const p = addPurchase(someBuyer(), C, r.int(0, DAY - 1));
      addClaim(p, p.day + r.int(lo + 1, hi), r.int(0, DAY - 1));
    }
  }
  if (level === 3) {
    {   // one purchase, two separate original claims; only the first is reopened
      const p = addPurchase(someBuyer(), B + r.int(5, 35), r.int(0, DAY - 1));
      const first = addClaim(p, p.day + r.int(1, 10), r.int(0, DAY - 1), null, "item_not_received");
      reopen(first, 3, 12);
      addClaim(p, p.day + r.int(12, 28), r.int(0, DAY - 1), null, "not_as_described");
    }
    {   // a reopening of a reopening
      const p = addPurchase(someBuyer(), B + r.int(5, 35), r.int(0, DAY - 1));
      const root = addClaim(p, p.day + r.int(1, 20), r.int(0, DAY - 1));
      reopen(reopen(root, 2, 10), 2, 10);
    }
  }
  // Level 3: a rule version published with an effective date after every filing.
  const localDayOf = (t, b) => Math.floor((t + b.zone[1]) / DAY);
  if (level === 3) {
    const lastFiled = Math.max(...claims.map((c) => localDayOf(c.at, c.p.buyer)));
    rules.push({ from: lastFiled + r.int(3, 20), w: wins[2] });
    // a purchase before the change whose days fall between the first and the future window
    const [lo, hi] = [Math.min(rules[0].w, wins[2]), Math.max(rules[0].w, wins[2])];
    const p = addPurchase(someBuyer(), C - r.int(1, 8), r.int(0, DAY - 1));
    addClaim(p, p.day + r.int(lo + 1, hi), r.int(0, DAY - 1));
    if (localDayOf(claims[claims.length - 1].at, p.buyer) >= rules[2].from) rules[2].from = localDayOf(claims[claims.length - 1].at, p.buyer) + 1;
  }

  // Identifiers.
  let bid = 4000 + r.int(0, 5000);
  buyers.forEach((b) => { b.id = "B-" + (bid += r.int(1, 37)); });
  let pid = 70000 + r.int(0, 20000);
  purchases.slice().sort((a, b) => a.at - b.at).forEach((p) => { p.id = "P-" + (pid += r.int(1, 90)); });
  let cid = 300000 + r.int(0, 90000);
  claims.slice().sort((a, b) => a.at - b.at).forEach((c) => { c.id = "CLM-" + (cid += r.int(1, 40)); });
  let vno = r.int(1, 4);
  rules.forEach((x) => { x.ver = "bp-v" + (vno++); });

  // The oracle. opts break one rule each, for diagnostics.
  const children = (c) => claims.filter((k) => k.parent === c);
  const chainLatest = (c) => { let best = c; for (const k of children(c)) { const m = chainLatest(k); if (m.at > best.at) best = m; } return best; };
  const compute = (opts = {}) => {
    let units;
    if (opts.everyRow) units = claims.map((c) => ({ c, src: c }));
    else if (opts.oneLevel) {
      const keys = new Set(claims.map((c) => c.parent || c));
      units = [...keys].map((c) => ({ c, src: c }));
    } else units = claims.filter((c) => !c.parent).map((c) => ({ c, src: opts.latestFiling ? chainLatest(c) : c }));
    const groups = new Map();
    for (const { c, src } of units) {
      const p = c.p, off = opts.utc ? 0 : p.buyer.zone[1];
      const pd = Math.floor((p.at + off) / DAY), fd = Math.floor((src.at + off) / DAY);
      const days = opts.elapsed ? Math.floor((src.at - p.at) / DAY) : fd - pd;
      const w = opts.latestRule ? rules.reduce((a, b) => (b.from > a.from ? b : a)).w
        : windowAt(opts.ruleAtFiling ? fd : pd, { exclusive: !!opts.exclusive });
      const late = opts.inclusive ? days >= w : days > w;
      const reopened = opts.byPurchase
        ? claims.some((k) => k.parent && k.p === p)
        : claims.some((k) => k.parent === c);
      const key = p.cat + "|" + dateOf(fd).slice(0, 7);
      if (!groups.has(key)) groups.set(key, { cat: p.cat, month: dateOf(fd).slice(0, 7), n: 0, late: 0, reo: 0, days: [] });
      const g = groups.get(key);
      g.n++; g.late += late ? 1 : 0; g.reo += reopened ? 1 : 0; g.days.push(days);
    }
    return [...groups.values()]
      .sort((a, b) => (a.cat < b.cat ? -1 : a.cat > b.cat ? 1 : a.month < b.month ? -1 : a.month > b.month ? 1 : 0))
      .map((g) => {
        const d = g.days.slice().sort((a, b) => a - b), m = d.length;
        const med = m % 2 ? d[(m - 1) / 2] : (d[m / 2 - 1] + d[m / 2]) / 2;
        return [g.cat, g.month, g.n, g.late, g.reo, med];
      });
  };
  const expected = compute();

  const diagnostics = [
    { message: "Reopenings were counted as claims of their own. A row with reopens_claim_id set continues an earlier claim; count each original claim once, dated by its original filing.", rows: compute({ everyRow: true }) },
    { message: "Each claim was counted once but dated by its latest reopening. The month and the days to claim come from the original filing; a reopening later does not make a claim late.", rows: compute({ latestFiling: true }) },
    { message: "Days to claim were counted as whole 24-hour periods. This exercise counts calendar dates in the buyer's time zone: a claim filed at 01:00 on the day after the window's last day is late, even if fewer than window + 1 full days have passed.", rows: compute({ elapsed: true }) },
    { message: "A claim filed on the window's last day was counted as late. The window is inclusive: a claim is late only when days_to_claim is greater than window_days.", rows: compute({ inclusive: true }) },
  ];
  if (level >= 2) {
    diagnostics.push(
      { message: "Dates were taken in UTC. The purchase date, the filing date and the claim month are calendar dates in the buyer's time zone (buyers.time_zone).", rows: compute({ utc: true }) },
      { message: "The window was the one in force on the filing date. The rule that applies is the one in force on the purchase date.", rows: compute({ ruleAtFiling: true }) },
      { message: "Every claim used the newest rule version. Each purchase takes the rule with the latest effective_from on or before its purchase date.", rows: compute({ latestRule: true }) },
      { message: "A rule was applied only from the day after its effective_from. A purchase on the effective date already falls under the new rule.", rows: compute({ exclusive: true }) },
    );
  }
  if (level === 3) {
    diagnostics.push(
      { message: "Reopenings were mapped to a claim by COALESCE(reopens_claim_id, claim_id), one level up. A reopening of a reopening then becomes a claim of its own; follow the chain to the original, or count only rows with reopens_claim_id IS NULL.", rows: compute({ oneLevel: true }) },
      { message: "Reopenings were matched to claims by purchase. A purchase can have two separate claims; a claim is reopened only when a row reopens it.", rows: compute({ byPurchase: true }) },
    );
  }

  // Tables.
  const bCols = ["buyer_id", "time_zone"];
  const bRows = buyers.map((b) => [b.id, b.zone[0]]).sort((a, b) => (a[0] < b[0] ? -1 : 1));
  const pCols = ["purchase_id", "buyer_id", "item_category", "purchased_at", "amount_minor", "currency"];
  const pRows = purchases.slice().sort((a, b) => a.at - b.at)
    .map((p) => [p.id, p.buyer.id, p.cat, ts(dateOf(Math.floor(p.at / DAY)), ((p.at % DAY) + DAY) % DAY), p.amount, p.cur]);
  const rCols = ["rule_version", "effective_from", "window_days"];
  const rRows = rules.map((x) => [x.ver, dateOf(x.from), x.w]);
  const cCols = ["claim_id", "purchase_id", "claim_reason", "filed_at", "reopens_claim_id"];
  const cRows = claims.slice().sort((a, b) => a.at - b.at)
    .map((c) => [c.id, c.p.id, c.reason, ts(dateOf(Math.floor(c.at / DAY)), ((c.at % DAY) + DAY) % DAY), c.parent ? c.parent.id : null]);

  const setup =
    "SET TIME ZONE 'UTC';\n" +
    "CREATE TABLE buyers (\n  buyer_id TEXT PRIMARY KEY,\n  time_zone TEXT NOT NULL\n);\n" +
    "CREATE TABLE purchases (\n  purchase_id TEXT PRIMARY KEY,\n  buyer_id TEXT NOT NULL REFERENCES buyers (buyer_id),\n  item_category TEXT NOT NULL,\n  purchased_at TIMESTAMPTZ NOT NULL,\n  amount_minor BIGINT NOT NULL,\n  currency CHAR(3) NOT NULL\n);\n" +
    "CREATE TABLE programme_rules (\n  rule_version TEXT PRIMARY KEY,\n  effective_from DATE NOT NULL UNIQUE,\n  window_days INT NOT NULL\n);\n" +
    "CREATE TABLE claims (\n  claim_id TEXT PRIMARY KEY,\n  purchase_id TEXT NOT NULL REFERENCES purchases (purchase_id),\n  claim_reason TEXT NOT NULL,\n  filed_at TIMESTAMPTZ NOT NULL,\n  reopens_claim_id TEXT REFERENCES claims (claim_id)\n);\n" +
    insertSQL("buyers", bCols, bRows) + insertSQL("purchases", pCols, pRows) +
    insertSQL("programme_rules", rCols, rRows) + insertSQL("claims", cCols, cRows);

  const roots = claims.filter((c) => !c.parent).length;
  return {
    vars: {
      purchase_count: pRows.length,
      claim_rows: cRows.length,
      reopen_rows: cRows.length - roots,
      rule_rule: level === 1
        ? "In this sample `programme_rules` has one version, `" + rules[0].ver + "`: a " + rules[0].w + "-day window."
        : level === 2
          ? "In this sample the window changed: `" + rules[0].ver + "` (" + rules[0].w + " days) applies to purchases before " + dateOf(rules[1].from) + " and `" + rules[1].ver + "` (" + rules[1].w + " days) from that date on."
          : "`programme_rules` has " + rules.length + " versions, including one published ahead of its effective date; a version applies only to purchases made on or after its `effective_from`.",
      tz_rule: level === 1
        ? "Every buyer in this sample has `time_zone` `UTC`."
        : "Buyers in this sample are in several time zones, among them `Asia/Tokyo` and `America/Bogota`.",
      chain_rule: level === 3
        ? "A reopening can itself be reopened, and one purchase can have more than one original claim (for example one for an item not received and a later one for an item not as described); each original claim is counted once."
        : "In this sample every reopening points at an original claim, and each purchase has at most one original claim.",
    },
    setup,
    tables: [
      { name: "buyers", columns: bCols, rows: bRows },
      { name: "purchases", columns: pCols, rows: pRows },
      { name: "programme_rules", columns: rCols, rows: rRows },
      { name: "claims", columns: cCols, rows: cRows },
    ],
    expected: {
      columns: ["item_category", "claim_month", "claims", "late_claims", "reopened_claims", "median_days_to_claim"],
      rows: expected,
    },
    diagnostics: diagnostics.filter((d) => JSON.stringify(d.rows) !== JSON.stringify(expected)),
  };
}
