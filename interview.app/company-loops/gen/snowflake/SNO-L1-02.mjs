/* SNO-L1-02 — Data share consumption: distinct consumer accounts per listing per month,
   trial versus paid (SQL). Simulated practice scenario. All data is generated from the seed;
   the entitlement model is a simplified, hypothetical one stated in the problem.

   Contract: see docs/COMPANY-INTERVIEW-LOOPS.md § Executable templates (sql).
   level: 1 Medium (queries covered by an entitlement; paid beats trial within a month;
            new consumers by first covered query)
          2 Hard (+ queries no entitlement covers, half-open entitlement ends, a trial and
            a paid entitlement overlapping, month-boundary seconds)
          3 Very Hard (+ the provider's own test queries, and a report window that starts
            after the history does, so "new" needs the earlier months) */
import { insertSQL, pad2 } from "../../js/rng.js";

export const kind = "sql";

const LISTINGS = [
  ["LST_WEATHER_HOURLY", "Hourly weather observations"],
  ["LST_RETAIL_FOOTFALL", "Retail footfall by postcode"],
  ["LST_FX_RATES", "Daily currency reference rates"],
  ["LST_SHIPPING_ETA", "Container shipping arrival estimates"],
  ["LST_POI_CATALOG", "Points of interest catalogue"],
];
const PROVIDERS = ["PROV_NIMBUS", "PROV_GEOLYTICS", "PROV_TIDEWATER"];
const LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ".split("");
const DAY = 86400;

const ep = (day) => Date.parse(day + "T00:00:00Z") / 1000;
function fmt(t) {
  const d = new Date(t * 1000);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())} ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}:${pad2(d.getUTCSeconds())}+00`;
}
const monthOf = (t) => { const d = new Date(t * 1000); return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-01`; };

export function generate(r, level) {
  const spanStart = ep(level === 3 ? "2026-05-01" : "2026-06-01");
  const spanEnd = ep("2026-09-01");
  const fromMonth = "2026-06-01", toMonth = "2026-08-01";
  const usedAcct = new Set();
  const acct = () => {
    let a;
    do a = "ACCT_" + Array.from({ length: 3 }, () => r.pick(LETTERS)).join("") + r.int(1, 9); while (usedAcct.has(a));
    usedAcct.add(a);
    return a;
  };
  const listings = r.sample(LISTINGS, level === 1 ? 2 : 3).map(([id, name]) => ({ id, name, provider: r.pick(PROVIDERS) }));
  listings.sort((a, b) => (a.id < b.id ? -1 : 1));
  const ents = [];      // {listing, account, kind, start, end|null}
  const qs = [];        // {listing, account, t}
  const ent = (l, a, k, start, end) => ents.push({ listing: l.id, account: a, kind: k, start, end });
  const q = (l, a, t) => qs.push({ listing: l.id, account: a, t });
  const inside = (a, b, n, l, acc) => { const hi = Math.min(b ?? spanEnd, spanEnd); if (hi <= a) return; for (let i = 0; i < n; i++) q(l, acc, r.int(a, hi - 1)); };
  const pool = Array.from({ length: level === 1 ? 7 : 9 }, acct);

  for (const l of listings) {
    for (const a of r.sample(pool, r.int(4, pool.length - 1))) {
      const s = spanStart + r.int(0, Math.floor((spanEnd - spanStart) / DAY) - 20) * DAY + r.int(0, DAY - 1);
      const pat = r.pick(level === 1 ? ["trial", "convert", "paid"] : ["trial", "convert", "paid", "lapsed"]);
      const trialEnd = s + 14 * DAY;
      if (pat === "trial" || pat === "lapsed") {
        ent(l, a, "trial", s, trialEnd);
        inside(s, trialEnd, r.int(1, 4), l, a);
        if (pat === "lapsed") for (let i = 0; i < r.int(1, 3); i++) { const t = trialEnd + r.int(1, 40 * DAY); if (t < spanEnd) q(l, a, t); }
      } else if (pat === "convert") {
        const paidStart = level === 1 ? trialEnd : s + r.int(7, 14) * DAY;
        const paidEnd = r.chance(0.5) ? null : paidStart + r.int(20, 50) * DAY;
        ent(l, a, "trial", s, trialEnd);
        ent(l, a, "paid", paidStart, paidEnd);
        inside(s, paidStart, r.int(1, 3), l, a);
        inside(paidStart, paidEnd, r.int(1, 5), l, a);
        if (level >= 2 && paidEnd !== null && paidEnd < spanEnd && r.chance(0.5)) q(l, a, paidEnd + r.int(0, 5 * DAY));
      } else {
        const end = r.chance(0.6) ? null : s + r.int(25, 60) * DAY;
        ent(l, a, "paid", s, end);
        inside(s, end, r.int(1, 6), l, a);
      }
    }
  }
  // Every level: an account that converts inside one month (paid only, never trial-only).
  {
    const l = r.pick(listings), a = acct(), m = ep(r.pick(["2026-06-01", "2026-07-01", "2026-08-01"]));
    ent(l, a, "trial", m + 2 * DAY, m + 12 * DAY);
    ent(l, a, "paid", m + 12 * DAY, null);
    q(l, a, m + 5 * DAY + r.int(0, DAY - 1));
    q(l, a, m + 20 * DAY + r.int(0, DAY - 1));
  }
  if (level >= 2) {
    // A query exactly at a trial's end is not covered; one exactly at a start is.
    const l = r.pick(listings), a = acct(), s = ep("2026-07-18") + r.int(0, 3) * DAY + r.int(0, 40000);   // ends in August
    ent(l, a, "trial", s, s + 14 * DAY);
    q(l, a, s);
    q(l, a, s + 14 * DAY);
    q(l, a, s + 30 * DAY + r.int(0, DAY));                                // after: not covered
    // A trial and a paid entitlement overlap: a query covered by both is paid.
    const l2 = r.pick(listings), a2 = acct(), s2 = ep("2026-06-14") + r.int(0, 5) * DAY;
    ent(l2, a2, "trial", s2, s2 + 14 * DAY);
    ent(l2, a2, "paid", s2 + 10 * DAY, null);
    q(l2, a2, s2 + 12 * DAY);                                             // its only query in that month window
    // Month boundaries: the last second of July and the first second of August.
    const l3 = r.pick(listings), a3 = acct(), s3 = ep("2026-07-20");
    ent(l3, a3, "paid", s3, ep("2026-08-01") + 1);
    q(l3, a3, ep("2026-08-01") - 1);
    q(l3, a3, ep("2026-08-01"));
    // Uncovered queries before any entitlement exists.
    const l4 = r.pick(listings), a4 = acct(), s4 = ep("2026-08-10");
    q(l4, a4, ep("2026-07-25") + r.int(0, DAY));
    ent(l4, a4, "trial", s4, s4 + 14 * DAY);
    q(l4, a4, s4 + r.int(1, 3) * DAY);
  }
  if (level === 3) {
    // The provider's own account tests its listing, with an entitlement.
    const l = r.pick(listings);
    ent(l, l.provider, "trial", ep("2026-06-02"), null);
    for (const d of ["2026-06-05", "2026-07-09", "2026-08-21"]) q(l, l.provider, ep(d) + r.int(0, DAY - 1));
    // A consumer whose first query was in May: not new in June.
    const l2 = r.pick(listings), a2 = acct();
    ent(l2, a2, "paid", ep("2026-05-11"), null);
    q(l2, a2, ep("2026-05-20") + r.int(0, DAY - 1));
    q(l2, a2, ep("2026-06-15") + r.int(0, DAY - 1));
    q(l2, a2, ep("2026-07-15") + r.int(0, DAY - 1));
    // And one whose first query is the first second of June: new in June.
    const l3 = r.pick(listings), a3 = acct();
    ent(l3, a3, "trial", ep("2026-05-25"), ep("2026-06-08"));
    q(l3, a3, ep("2026-06-01"));
  }

  const provider = new Map(listings.map((l) => [l.id, l.provider]));
  const cmp = (x, y) => (x < y ? -1 : x > y ? 1 : 0);
  const solve = (o = {}) => {
    const covered = [];
    for (const x of qs) {
      if (!o.withProvider && provider.get(x.listing) === x.account) continue;
      const cov = ents.filter((e) => e.listing === x.listing && e.account === x.account && e.start <= x.t &&
        (e.end === null || (o.endInclusive ? x.t <= e.end : x.t < e.end)));
      if (!cov.length && !o.uncovered) continue;
      const paid = o.trialWins ? cov.length > 0 && cov.every((e) => e.kind === "paid") : cov.some((e) => e.kind === "paid");
      covered.push({ ...x, paid });
    }
    const first = new Map();
    for (const c of covered) {
      const k = c.listing + "|" + c.account;
      if (o.newInWindow && monthOf(c.t) < fromMonth) continue;
      if (!first.has(k) || c.t < first.get(k)) first.set(k, c.t);
    }
    const per = new Map();      // month|listing -> Map(account -> {paid, trial})
    for (const c of covered) {
      const m = monthOf(c.t);
      if (m < fromMonth || m > toMonth) continue;
      const k = m + "|" + c.listing;
      if (!per.has(k)) per.set(k, new Map());
      const accs = per.get(k);
      if (!accs.has(c.account)) accs.set(c.account, { paid: false, trial: false });
      const s = accs.get(c.account);
      if (c.paid) s.paid = true; else s.trial = true;
    }
    return [...per.keys()].sort().map((k) => {
      const [m, lid] = k.split("|");
      const accs = per.get(k);
      let paid = 0, trialOnly = 0, nw = 0;
      for (const [a, s] of accs) {
        if (s.paid) paid++;
        if (o.trialAny ? s.trial : !s.paid) trialOnly++;
        const f = first.get(lid + "|" + a);
        if (f !== undefined && monthOf(f) === m) nw++;
      }
      return [m, lid, accs.size, paid, trialOnly, nw];
    });
  };
  const expected = solve();

  const diagnostics = [
    { message: "trial_only_consumers counted every account with a trial query, including accounts that also had a paid query that month. Paid wins; the two columns add up to consumers.", rows: solve({ trialAny: true }) },
  ];
  if (level >= 2) {
    diagnostics.push({ message: "Queries that no entitlement covers were counted. A query before an entitlement starts or after it ends is not consumption of the listing.", rows: solve({ uncovered: true }) });
    diagnostics.push({ message: "ends_at was treated as inclusive. Entitlements are half-open: a query exactly at ends_at is not covered.", rows: solve({ endInclusive: true }) });
    diagnostics.push({ message: "A query covered by both a trial and a paid entitlement was counted as trial. When both cover it, it is paid.", rows: solve({ trialWins: true }) });
  }
  if (level === 3) {
    diagnostics.push({ message: "The provider's own test queries were counted. A provider querying its own listing is not a consumer.", rows: solve({ withProvider: true }) });
    diagnostics.push({ message: "new_consumers was computed from the report months only. An account first seen in May is not new in June: compute the first query over all history, then filter the months.", rows: solve({ newInWindow: true }) });
  }

  ents.sort((a, b) => a.start - b.start || cmp(a.listing, b.listing) || cmp(a.account, b.account));
  qs.sort((a, b) => a.t - b.t || cmp(a.listing, b.listing) || cmp(a.account, b.account));
  let eid = 500 + r.int(0, 400), qid = 90000 + r.int(0, 9000);
  const lCols = ["listing_id", "listing_name", "provider_account"];
  const lRows = listings.map((l) => [l.id, l.name, l.provider]);
  const eCols = ["entitlement_id", "listing_id", "consumer_account", "kind", "starts_at", "ends_at"];
  const eRows = ents.map((e) => [eid += r.int(1, 7), e.listing, e.account, e.kind, fmt(e.start), e.end === null ? null : fmt(e.end)]);
  const qCols = ["query_id", "listing_id", "consumer_account", "query_ts"];
  const qRows = qs.map((x) => [qid += r.int(1, 30), x.listing, x.account, fmt(x.t)]);
  const setup =
    "SET TIME ZONE 'UTC';\n" +
    "CREATE TABLE listings (\n  listing_id TEXT PRIMARY KEY,\n  listing_name TEXT NOT NULL,\n  provider_account TEXT NOT NULL\n);\n" +
    "CREATE TABLE entitlements (\n  entitlement_id BIGINT PRIMARY KEY,\n  listing_id TEXT NOT NULL REFERENCES listings(listing_id),\n  consumer_account TEXT NOT NULL,\n  kind TEXT NOT NULL CHECK (kind IN ('trial', 'paid')),\n  starts_at TIMESTAMPTZ NOT NULL,\n  ends_at TIMESTAMPTZ\n);\n" +
    "CREATE TABLE listing_queries (\n  query_id BIGINT PRIMARY KEY,\n  listing_id TEXT NOT NULL REFERENCES listings(listing_id),\n  consumer_account TEXT NOT NULL,\n  query_ts TIMESTAMPTZ NOT NULL\n);\n" +
    insertSQL("listings", lCols, lRows) + insertSQL("entitlements", eCols, eRows) + insertSQL("listing_queries", qCols, qRows);

  return {
    vars: {
      from_month: fromMonth,
      to_month: toMonth,
      queries: qRows.length,
      entitlements: eRows.length,
      coverage_rule: level === 1
        ? "In this sample every query is covered by exactly one entitlement, and a trial always ends exactly when its paid entitlement starts."
        : "Some queries are covered by no entitlement (before it started, after it ended): they are not counted at all. A trial and a paid entitlement of the same account can overlap; a query covered by both counts as paid.",
      history_rule: level === 3
        ? "The log starts in May, before the report months, so an account first seen in May is not new in June. Providers test their own listings: a query by the listing's `provider_account` never counts, even when an entitlement covers it."
        : "The log starts at the beginning of the first report month, and no provider queries its own listing in this sample (exclude `provider_account` anyway).",
    },
    setup,
    tables: [
      { name: "listings", columns: lCols, rows: lRows },
      { name: "entitlements", columns: eCols, rows: eRows },
      { name: "listing_queries", columns: qCols, rows: qRows },
    ],
    expected: { columns: ["month", "listing_id", "consumers", "paid_consumers", "trial_only_consumers", "new_consumers"], rows: expected },
    diagnostics: diagnostics.filter((d) => JSON.stringify(d.rows) !== JSON.stringify(expected)),
  };
}
