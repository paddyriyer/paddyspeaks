/* STR-L1-01 — Authorization-to-capture funnel per merchant per day (SQL).
   Simulated practice scenario. All data is generated from the seed.

   Contract: see docs/COMPANY-INTERVIEW-LOOPS.md § Executable templates.
   level: 1 Medium (one currency, one full capture per authorization)
          2 Hard (+ partial and multiple captures, two currencies)
          3 Very Hard (+ captures landing on a later day, failed capture attempts,
                       up to three currencies including a zero-decimal one) */
import { insertSQL, ts } from "../../js/rng.js";

export const kind = "sql";

const MERCHANTS = ["acct_bluebird_bakery", "acct_cedar_cycles", "acct_dune_outfitters", "acct_ember_coffee", "acct_fable_books", "acct_granite_gym", "acct_harbor_hostel"];
const BASES = ["2026-09-07", "2026-09-14", "2026-09-21", "2026-09-28", "2026-10-05"];

export function generate(r, level) {
  const minAuths = r.pick([2, 3]);
  const day0 = r.pick(BASES);
  const merchants = r.sample(MERCHANTS, level === 1 ? 3 : 4).sort();
  const pool = level === 3 ? ["usd", "eur", "gbp", "jpy"] : ["usd", "eur", "gbp"];
  const single = r.pick(pool.slice(0, 3));
  const curOf = {};
  merchants.forEach((m, i) => {
    if (level === 1) curOf[m] = [single];
    else if (level === 2) curOf[m] = i < 2 ? r.sample(pool, 2).sort() : [r.pick(pool)];
    else curOf[m] = i < 3 ? r.sample(pool, 2 + (i === 0 ? 1 : 0)).sort() : [r.pick(pool)];
  });

  // Authorizations, grouped by (day, merchant, currency).
  const auths = [];
  let seq = 0;
  const groups = [];
  for (let d = 0; d < 2; d++) for (const m of merchants) for (const c of curOf[m]) groups.push([d, m, c]);
  const forcedBig = r.int(0, groups.length - 1);
  let forcedSmall = r.int(0, groups.length - 1);
  if (forcedSmall === forcedBig) forcedSmall = (forcedSmall + 1) % groups.length;
  const idBase = 10000 + r.int(0, 80000);
  groups.forEach(([d, m, c], gi) => {
    const n = gi === forcedBig ? 4 : gi === forcedSmall ? 1 : r.int(1, 4);
    for (let k = 0; k < n; k++) {
      const amount = c === "jpy" ? r.int(3, 300) * 100 : r.int(500, 60000);
      auths.push({ id: "auth_" + (idBase + seq++), day: d, merchant: m, currency: c, amount, sec: r.int(0, 79000) });
    }
  });
  const shuffled = r.shuffle(auths);   // ids are not in time order

  const captures = [];
  const voids = [];
  let capSeq = 0, voidSeq = 0;
  const capId = () => "cap_" + (50000 + idBase + capSeq++);
  let forcedLate = level === 3;
  for (const a of shuffled) {
    const abs = a.day * 86400 + a.sec;
    const u = r.next();
    if (u < 0.6) {
      // Captured. Plan the successful capture amounts.
      let parts;
      if (level === 1) parts = [a.amount];
      else {
        const v = r.next();
        if (v < 0.4) parts = [a.amount];
        else if (v < 0.7) parts = [r.int(Math.ceil(a.amount * 0.3), a.amount - 1)];
        else {
          const total = r.chance(0.5) ? a.amount : r.int(Math.ceil(a.amount / 2), a.amount - 1);
          const k = r.int(2, 3);
          parts = [];
          let left = total;
          for (let i = 0; i < k - 1; i++) {
            const p = r.int(1, Math.max(1, Math.floor(left / 2)));
            parts.push(p);
            left -= p;
          }
          parts.push(left);
        }
      }
      let t = abs + r.int(60, 2000);
      if (level === 3 && a.day === 0 && (forcedLate || r.chance(0.35))) {
        t = abs + (86400 - a.sec) + r.int(60, 20000);   // lands on the next UTC day
        forcedLate = false;
      } else if (level === 3 && r.chance(0.25)) {
        t = abs + r.int(20000, 90000);                  // may also cross midnight
      }
      if (level === 3 && r.chance(0.3)) {
        captures.push({ id: capId(), auth: a.id, amount: parts[0], status: "failed", abs: t });
        t += r.int(60, 900);
      }
      for (const p of parts) {
        captures.push({ id: capId(), auth: a.id, amount: p, status: "succeeded", abs: t });
        t += r.int(60, 1500);
      }
    } else if (u < 0.78) {
      voids.push({ id: "void_" + (70000 + idBase + voidSeq++), auth: a.id, abs: abs + r.int(300, 50000) });
    } else if (level === 3 && r.chance(0.5)) {
      // Still uncaptured: an attempt that failed does not capture anything.
      captures.push({ id: capId(), auth: a.id, amount: a.amount, status: "failed", abs: abs + r.int(60, 30000) });
    }
  }

  const authById = new Map(auths.map((a) => [a.id, a]));
  const keyOf = (d, m, c) => `${dayStr(day0, d)}|${m}|${c}`;

  // Oracle (and diagnostics, by switching one rule off).
  const compute = (o = {}) => {
    const g = new Map();
    const get = (k) => {
      if (!g.has(k)) g.set(k, { n: 0, voided: 0, captured: 0, amt: 0, capAmt: 0 });
      return g.get(k);
    };
    const voided = new Set(voids.map((v) => v.auth));
    const ok = (c) => c.status === "succeeded" || o.includeFailed;
    const rowsPerAuth = new Map();
    for (const c of captures) rowsPerAuth.set(c.auth, (rowsPerAuth.get(c.auth) || 0) + 1);
    for (const a of auths) {
      const s = get(keyOf(a.day, a.merchant, a.currency));
      if (o.voidExcluded && voided.has(a.id)) { s.voided += 1; continue; }
      const mult = o.fanout ? Math.max(1, rowsPerAuth.get(a.id) || 0) : 1;
      s.n += mult;
      s.amt += a.amount * mult;
      if (voided.has(a.id)) s.voided += 1;
    }
    if (o.byCaptureDay) {
      const seen = new Set();
      for (const c of captures) {
        if (!ok(c)) continue;
        const a = authById.get(c.auth);
        const k = keyOf(Math.floor(c.abs / 86400), a.merchant, a.currency);
        if (!g.has(k)) continue;              // the candidate's left join keeps authorization days only
        const s = g.get(k);
        s.capAmt += c.amount;
        if (!seen.has(k + "|" + a.id)) { seen.add(k + "|" + a.id); s.captured += 1; }
      }
    } else {
      const capturedAuths = new Set();
      for (const c of captures) {
        if (!ok(c)) continue;
        const a = authById.get(c.auth);
        if (o.voidExcluded && voided.has(a.id)) continue;
        const s = get(keyOf(a.day, a.merchant, a.currency));
        s.capAmt += c.amount;
        if (o.captureRows) s.captured += 1;
        else if (!capturedAuths.has(a.id)) { capturedAuths.add(a.id); s.captured += 1; }
      }
    }
    const rows = [];
    for (const k of [...g.keys()].sort()) {
      const s = g.get(k);
      if (!o.noHaving && s.n < minAuths) continue;
      if (s.n === 0) continue;
      const [d, m, c] = k.split("|");
      const rate = o.intDiv ? (a, b) => Math.floor(a / b) : ratio4;
      rows.push([d, m, c, s.n, s.voided, s.captured, s.amt, s.capAmt, rate(s.captured, s.n), rate(s.capAmt, s.amt)]);
    }
    return rows;
  };
  const rows = compute();

  const diagnostics = [
    { message: "Integer division: a count divided by a count is truncated to 0 or 1. Cast to numeric before dividing, then ROUND(…, 4).", rows: compute({ intDiv: true }) },
    { message: `Merchant-days below the minimum were reported. Keep only (day, merchant, currency) groups with at least ${minAuths} authorizations.`, rows: compute({ noHaving: true }) },
    { message: "Voided authorizations were dropped from the denominator. A void is a funnel outcome: it stays in `authorizations` and `authorized_amount`.", rows: compute({ voidExcluded: true }) },
  ];
  if (level >= 2) {
    diagnostics.push({ message: "Joining captures straight onto authorizations repeats an authorization once per capture row, inflating `authorizations` and `authorized_amount`. Aggregate captures per authorization first.", rows: compute({ fanout: true }) });
    diagnostics.push({ message: "`captured_auths` counted capture rows. An authorization with several partial captures is one captured authorization.", rows: compute({ captureRows: true }) });
  }
  if (level === 3) {
    diagnostics.push({ message: "Failed capture attempts were counted. Only captures with status 'succeeded' moved money.", rows: compute({ includeFailed: true }) });
    diagnostics.push({ message: "Captures were attributed to the day they were captured. The funnel is a cohort: every capture belongs to the UTC day of its authorization.", rows: compute({ byCaptureDay: true }) });
  }

  const authCols = ["auth_id", "merchant_id", "currency", "amount", "authorized_at"];
  const authRows = auths.map((a) => [a.id, a.merchant, a.currency, a.amount, absTs(day0, a.day * 86400 + a.sec)]).sort((x, y) => cmp(x[4], y[4]) || cmp(x[0], y[0]));
  const capCols = ["capture_id", "auth_id", "amount", "status", "captured_at"];
  const capRows = captures.map((c) => [c.id, c.auth, c.amount, c.status, absTs(day0, c.abs)]).sort((x, y) => cmp(x[4], y[4]) || cmp(x[0], y[0]));
  const voidCols = ["void_id", "auth_id", "voided_at"];
  const voidRows = voids.map((v) => [v.id, v.auth, absTs(day0, v.abs)]).sort((x, y) => cmp(x[2], y[2]) || cmp(x[0], y[0]));

  const setup =
    "SET TIME ZONE 'UTC';\n" +
    "CREATE TABLE authorizations (\n  auth_id TEXT PRIMARY KEY,\n  merchant_id TEXT NOT NULL,\n  currency TEXT NOT NULL,          -- ISO code, lower case\n  amount BIGINT NOT NULL CHECK (amount > 0),   -- minor units\n  authorized_at TIMESTAMPTZ NOT NULL\n);\n" +
    "CREATE TABLE captures (\n  capture_id TEXT PRIMARY KEY,\n  auth_id TEXT NOT NULL REFERENCES authorizations(auth_id),\n  amount BIGINT NOT NULL CHECK (amount > 0),   -- minor units, same currency as the authorization\n  status TEXT NOT NULL CHECK (status IN ('succeeded','failed')),\n  captured_at TIMESTAMPTZ NOT NULL\n);\n" +
    "CREATE TABLE voids (\n  void_id TEXT PRIMARY KEY,\n  auth_id TEXT NOT NULL UNIQUE REFERENCES authorizations(auth_id),\n  voided_at TIMESTAMPTZ NOT NULL\n);\n" +
    insertSQL("authorizations", authCols, authRows) + insertSQL("captures", capCols, capRows) + insertSQL("voids", voidCols, voidRows);

  return {
    vars: {
      min_auths: minAuths,
      n_auths: auths.length,
      capture_rule:
        level === 1
          ? "Each captured authorization has exactly one capture, for the full amount, on the same day."
          : level === 2
            ? "An authorization can be captured in part, or in several partial captures; their sum never exceeds the authorized amount. Merchants take payments in more than one currency."
            : "An authorization can be captured in part or in several partial captures, and a capture can arrive on a later UTC day than its authorization. Some capture attempts failed (`status = 'failed'`) and moved no money. Currencies include a zero-decimal one (`jpy`), whose minor unit is the whole yen.",
    },
    setup,
    tables: [
      { name: "authorizations", columns: authCols, rows: authRows },
      { name: "captures", columns: capCols, rows: capRows },
      { name: "voids", columns: voidCols, rows: voidRows },
    ],
    expected: { columns: ["auth_date", "merchant_id", "currency", "authorizations", "voided", "captured_auths", "authorized_amount", "captured_amount", "capture_rate_count", "capture_rate_amount"], rows },
    diagnostics: diagnostics.filter((d) => JSON.stringify(d.rows) !== JSON.stringify(rows)),
  };
}

// ROUND(a::numeric / b, 4), half away from zero (a, b >= 0, b > 0), in exact integer arithmetic.
function ratio4(a, b) {
  return Math.floor((2 * a * 10000 + b) / (2 * b)) / 10000;
}
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
function dayStr(day0, n) {
  const d = new Date(day0 + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function absTs(day0, abs) {
  return ts(dayStr(day0, Math.floor(abs / 86400)), abs % 86400);
}
