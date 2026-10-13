/* STR-L3-05 — Ledger queries: quarantine unbalanced journals, balances as of a time (SQL).
   Simulated practice scenario. All data is generated from the seed.

   One deterministic result set: one row per (account_id, currency) with at least one
   entry in an eligible journal, carrying
     balance_minor        sum of the account's eligible entries in that currency, excluding
                          entries of journals that do not balance in that currency;
     unbalanced_journals  distinct eligible journals, unbalanced in that currency, that touch
                          the account in that currency.
   level: 1 Medium (one currency, unbalanced journals, inclusive as-of boundary)
          2 Hard (+ several currencies, FX journals that balance per currency but not in sum,
                  a cross-currency misbooking, reversals before and after the as-of time)
          3 Very Hard (+ backdated journals: as of effective time, as known at a second time) */
import { insertSQL, ts } from "../../js/rng.js";

export const kind = "sql";

const H = 3600;
const DAYS = ["2026-09-14", "2026-09-15", "2026-09-16"];
const MERCHANTS = ["atlas", "beacon", "cobalt", "delta", "ember", "fjord", "garnet", "harbor", "indigo", "juniper"];

function stamp(sec) {
  return ts(DAYS[Math.floor(sec / 86400)], sec % 86400);
}

export function generate(r, level) {
  const currencies = level === 1 ? [r.pick(["usd", "eur", "gbp"])] : r.sample(["usd", "eur", "gbp", "jpy", "sek"], level === 2 ? 2 : 3);
  const names = r.shuffle(MERCHANTS);
  const merchants = names.slice(0, level === 1 ? 3 : 4).map((m) => "merchant_" + m);
  const dormant = "merchant_" + names[names.length - 1];   // touched only by the zero-balance edge case
  const asOf = 86400 + r.pick([9, 12, 15, 18]) * H + r.pick([0, 30 * 60]);
  const knownAt = level === 3 ? asOf + r.pick([6, 9, 12]) * H : asOf;

  const amount = (c) => (c === "jpy" ? r.int(300, 60000) : c === "sek" ? r.int(2000, 300000) : r.int(500, 50000));
  const feeOf = (a) => Math.max(1, Math.floor(a * 0.03));          // hypothetical fee rule
  const otherCur = (c) => r.pick(currencies.filter((x) => x !== c));

  const journals = [];
  const add = (kind, created, entries, extra = {}) => {
    const j = { kind, created, effective: created, entries, reverses: null, ...extra };
    journals.push(j);
    return j;
  };
  const charge = (c, m, created) => {
    const a = amount(c), f = feeOf(a);
    return add("charge", created, [
      { account: "cash", currency: c, amount: a },
      { account: m, currency: c, amount: -(a - f) },
      { account: "fees", currency: c, amount: -f },
    ]);
  };
  const flow = (kind, c, m, created) => {                          // refund or payout: merchant debited, cash credited
    const a = amount(c);
    return add(kind, created, [
      { account: m, currency: c, amount: a },
      { account: "cash", currency: c, amount: -a },
    ]);
  };
  const fx = (m, created) => {                                      // balances per currency, never in sum
    const x = r.pick(currencies), y = otherCur(x);
    const ax = amount(x), ay = amount(y);
    return add("fx_conversion", created, [
      { account: m, currency: x, amount: ax },
      { account: "fx_clearing", currency: x, amount: -ax },
      { account: "fx_clearing", currency: y, amount: ay },
      { account: m, currency: y, amount: -ay },
    ]);
  };
  const reverse = (orig, created, effective) => add("reversal", created,
    orig.entries.map((e) => ({ ...e, amount: -e.amount })), { reverses: orig, effective: effective ?? created });

  // Forced edge cases first.
  const atBoundary = charge(r.pick(currencies), r.pick(merchants), asOf);          // exactly at as_of: included
  const afterAsOf = charge(r.pick(currencies), r.pick(merchants), asOf + r.int(5 * 60, 3 * H));
  if (level === 3) afterAsOf.created = knownAt + r.int(60, 2 * H), afterAsOf.effective = afterAsOf.created;

  // Base traffic.
  const n = level === 1 ? r.int(10, 13) : level === 2 ? r.int(13, 16) : r.int(16, 20);
  const base = [];
  for (let k = 0; k < n; k++) {
    const created = r.int(0, 3 * 86400 - 1);
    const c = r.pick(currencies), m = r.pick(merchants), roll = r.next();
    let j;
    if (currencies.length > 1 && roll < 0.2) j = fx(m, created);
    else if (roll < 0.6) j = charge(c, m, created);
    else if (roll < 0.8) j = flow("refund", c, m, created);
    else j = flow("payout", c, m, created);
    base.push(j);
  }
  const early = () => r.int(2 * H, asOf - 2 * H);

  // Unbalanced journals (quarantined from balances).
  const offByOne = charge(r.pick(currencies), r.pick(merchants), early());
  offByOne.entries[1].amount += r.pick([1, -1]);                   // a rounding slip: sums to ±1
  if (level === 1) {
    const c = currencies[0], a = amount(c), f = feeOf(a);           // the fee leg is missing
    add("charge", early(), [
      { account: "cash", currency: c, amount: a },
      { account: dormant, currency: c, amount: -(a - f) },
    ]);
  } else {
    fx(r.pick(merchants), early());                                 // at least one eligible FX journal
    const x = r.pick(currencies), y = otherCur(x), a = amount(x);
    add("adjustment", early(), [                                    // misbooked across currencies: sums to 0 overall
      { account: "cash", currency: x, amount: a },
      { account: r.pick(merchants), currency: y, amount: -a },
    ]);
    // Reversals. The dormant merchant's charge is reversed before as_of (its rows end at 0);
    // another eligible journal is reversed after as_of (it still counts as of as_of).
    const t1 = r.int(2 * H, asOf - 6 * H);
    const voided = charge(r.pick(currencies), dormant, t1);
    if (level === 2) reverse(voided, t1 + r.int(H, 4 * H));
    else reverse(voided, asOf + r.int(H, knownAt - asOf - H), t1);  // posted late, backdated to the original
    const candidates = base.filter((j) => j.created < asOf - H);
    const orig = candidates.length ? r.pick(candidates) : charge(r.pick(currencies), r.pick(merchants), early());
    reverse(orig, asOf + r.int(H, 4 * H));                          // L3: effective = created > as_of: excluded
  }

  // Backdating (level 3): as of effective time, as known at known_at.
  if (level === 3) {
    for (const j of base) {
      if (j.reverses === null && r.chance(0.3)) j.effective = Math.max(0, j.created - r.int(H, 30 * H));
    }
    const lateKnown = charge(r.pick(currencies), r.pick(merchants), asOf + r.int(H, knownAt - asOf - H));
    lateKnown.effective = asOf - r.int(H, 10 * H);                   // created after as_of, effective before: included
    const atKnown = flow("refund", r.pick(currencies), r.pick(merchants), knownAt);
    atKnown.effective = asOf - r.int(H, 5 * H);                      // created exactly at known_at: included
    const tooLate = charge(r.pick(currencies), r.pick(merchants), knownAt + r.int(H, 5 * H));
    tooLate.effective = asOf - r.int(H, 10 * H);                     // not yet known at known_at: excluded
    const effBoundary = flow("payout", r.pick(currencies), r.pick(merchants), asOf + r.int(H, knownAt - asOf - H));
    effBoundary.effective = asOf;                                    // effective exactly at as_of: included
  }

  // Ids in creation order (ties by insertion), entry ids follow.
  journals.forEach((j, i) => (j.seq = i));
  journals.sort((a, b) => a.created - b.created || a.seq - b.seq);
  let jid = 1000 + r.int(0, 8000), eid = 1 + r.int(0, 50) * 100;
  for (const j of journals) {
    j.id = "jr_" + jid++;
    for (const e of j.entries) e.id = eid++;
  }

  // The oracle. opts break one rule each, for diagnostics.
  const reversedIds = new Set(journals.filter((j) => j.reverses).map((j) => j.reverses.id));
  const compute = (opts = {}) => {
    const le = (a, b) => (opts.strict ? a < b : a <= b);
    const eligible = (j) => {
      if (opts.voidReversed && (j.reverses || reversedIds.has(j.id))) return false;
      if (opts.ignoreReversals && j.kind === "reversal") return false;
      if (opts.createdOnly) return le(j.created, asOf);
      if (opts.ignoreKnown) return le(j.effective, asOf);
      return le(j.effective, asOf) && le(j.created, knownAt);
    };
    const acc = new Map();
    for (const j of journals) {
      if (!eligible(j)) continue;
      const sums = new Map();
      let total = 0;
      for (const e of j.entries) {
        sums.set(e.currency, (sums.get(e.currency) || 0) + e.amount);
        total += e.amount;
      }
      for (const e of j.entries) {
        const unbalanced = opts.crossCurrency ? total !== 0 : sums.get(e.currency) !== 0;
        const key = e.account + "|" + e.currency;
        if (!acc.has(key)) acc.set(key, { account: e.account, currency: e.currency, bal: 0, bad: new Set() });
        const a = acc.get(key);
        if (unbalanced) a.bad.add(j.id);
        if (!unbalanced || opts.includeUnbalanced) a.bal += e.amount;
      }
    }
    const rows = [...acc.values()]
      .sort((a, b) => (a.account < b.account ? -1 : a.account > b.account ? 1 : a.currency < b.currency ? -1 : a.currency > b.currency ? 1 : 0))
      .map((a) => [a.account, a.currency, a.bal, a.bad.size]);
    return opts.dropZero ? rows.filter((x) => x[2] !== 0) : rows;
  };
  const rows = compute();

  const diagnostics = [
    { message: "Entries of unbalanced journals were added to the balance. A journal that does not sum to zero in a currency is quarantined: count it in unbalanced_journals, but leave its entries in that currency out of balance_minor.", rows: compute({ includeUnbalanced: true }) },
    { message: "The as-of boundary is inclusive. A journal stamped exactly at the as-of time belongs in the balance.", rows: compute({ strict: true }) },
    { message: "Rows whose balance is 0 were dropped (a HAVING SUM(...) <> 0, or a filter on the result). Every account-currency with an eligible entry is reported, including one whose entries cancel or are all quarantined.", rows: compute({ dropZero: true }) },
  ];
  if (level >= 2) {
    diagnostics.push(
      { message: "Balance was checked per journal across currencies. Minor units of different currencies cannot be added: an FX conversion balances in each currency but not in sum, and a misbooking can sum to zero across currencies while each currency is off. Group by journal AND currency.", rows: compute({ crossCurrency: true }) },
      { message: "Reversed journals were treated as void: both the original and its reversal were dropped. A reversal is an ordinary journal that counts only once it is itself eligible; until then the original stands.", rows: compute({ voidReversed: true }) },
      { message: "Reversal journals were ignored. A compensating journal is part of the books; leaving it out keeps a mistake on the balance.", rows: compute({ ignoreReversals: true }) },
    );
  }
  if (level === 3) {
    diagnostics.push(
      { message: "Journals were selected by created_at. The balance is as of effective time: a journal created after the as-of time but effective before it belongs in the balance, if it was known by known_at.", rows: compute({ createdOnly: true }) },
      { message: "known_at was ignored. A backdated journal created after known_at was not yet on the books at that time and must be left out.", rows: compute({ ignoreKnown: true }) },
    );
  }

  const jCols = ["journal_id", "kind", "reverses_journal_id", "created_at", "effective_at"];
  const eCols = ["entry_id", "journal_id", "account_id", "currency", "amount_minor"];
  const jRows = journals.map((j) => [j.id, j.kind, j.reverses ? j.reverses.id : null, stamp(j.created), stamp(j.effective)]);
  const eRows = journals.flatMap((j) => j.entries.map((e) => [e.id, j.id, e.account, e.currency, e.amount]));

  const setup =
    "SET TIME ZONE 'UTC';\n" +
    "CREATE TABLE journals (\n  journal_id TEXT PRIMARY KEY,\n  kind TEXT NOT NULL CHECK (kind IN ('charge','refund','payout','fx_conversion','adjustment','reversal')),\n  reverses_journal_id TEXT REFERENCES journals (journal_id),\n  created_at TIMESTAMPTZ NOT NULL,\n  effective_at TIMESTAMPTZ NOT NULL\n);\n" +
    "CREATE TABLE entries (\n  entry_id BIGINT PRIMARY KEY,\n  journal_id TEXT NOT NULL REFERENCES journals (journal_id),\n  account_id TEXT NOT NULL,\n  currency TEXT NOT NULL,\n  amount_minor BIGINT NOT NULL\n);\n" +
    insertSQL("journals", jCols, jRows) + insertSQL("entries", eCols, eRows);

  const asOfText = stamp(asOf), knownText = stamp(knownAt);
  const curList = currencies.map((c) => "`" + c + "`").join(", ");
  return {
    vars: {
      as_of: asOfText,
      known_at: knownText,
      journals: journals.length,
      entries: eRows.length,
      time_rule: level === 3
        ? `Journals can be backdated: effective_at may be earlier than created_at. Report the books as of effective time \`${asOfText}\`, as they were known at \`${knownText}\`: a journal is eligible when effective_at ≤ \`${asOfText}\` AND created_at ≤ \`${knownText}\`.`
        : `A journal is eligible when its effective_at is at or before \`${asOfText}\`. Nothing in this extract is backdated: effective_at always equals created_at.`,
      currency_rule: level === 1
        ? `Every amount is in one currency, ${curList}, in its minor unit.`
        : `Amounts are in ${curList}, each in its own minor unit. Never add amounts of different currencies: a journal must balance in each currency separately, and an FX conversion moves value between currencies through \`fx_clearing\`.`,
      reversal_rule: level === 1
        ? "There are no reversals in this extract."
        : "A mistaken journal is never edited or deleted. It is reversed by a later journal of kind `reversal` whose entries negate it and whose reverses_journal_id names the original. A reversal is an ordinary journal: it counts once it is itself eligible, and until then the original stands.",
    },
    setup,
    tables: [
      { name: "journals", columns: jCols, rows: jRows },
      { name: "entries", columns: eCols, rows: eRows },
    ],
    expected: { columns: ["account_id", "currency", "balance_minor", "unbalanced_journals"], rows },
    diagnostics: diagnostics.filter((d) => JSON.stringify(d.rows) !== JSON.stringify(rows)),
  };
}
