/* GOO-L1-03 — Impression share and why it was lost, from auction logs (SQL).
   Simulated practice scenario. All data is generated from the seed. The auction rules
   are a simplified, hypothetical model stated in the problem, not any real ad system's.

   Contract: see docs/COMPANY-INTERVIEW-LOOPS.md § Executable templates (sql).
   level: 1 Medium (budget-limited campaigns do not enter; rank the rest; slots per auction)
          2 Hard (+ a minimum ad rank per auction, ties on ad_rank, two UTC days)
          3 Very Hard (+ several ads of one campaign in an auction: the campaign competes once, with its best ad) */
import { insertSQL, ts } from "../../js/rng.js";

export const kind = "sql";

const CAMPAIGNS = ["cmp_bikes", "cmp_camping", "cmp_climbing", "cmp_kayaks", "cmp_running", "cmp_ski"];
const DAYS = ["2026-09-24", "2026-09-25"];

export function generate(r, level) {
  const camps = r.sample(CAMPAIGNS, level === 1 ? 4 : 5).sort();
  const nAuctions = 12 + 4 * level;
  const auctions = [];
  const bids = [];      // {bid_id, auction, campaign, ad, rank, budget}
  let bidId = 1000 + r.int(0, 8000);
  let aid = 20000 + r.int(0, 50000);
  for (let i = 0; i < nAuctions; i++) {
    const day = level === 1 ? DAYS[0] : DAYS[i % 2];
    // Hard+: some auctions in the last and first minutes of a day.
    const sec = level >= 2 && r.chance(0.25) ? r.pick([r.int(86340, 86399), r.int(0, 59)]) : r.int(3600, 82800);
    const a = { id: "auc_" + (aid += r.int(1, 40)), day, sec, slots: r.int(1, 3), min: level === 1 ? 0 : r.pick([0, 20, 35]) };
    auctions.push(a);
    let present = camps.filter(() => r.chance(0.6));
    if (present.length < 2) present = r.sample(camps, 2);
    const usedRanks = new Set();
    const best = [];
    for (const c of present) {
      const budget = r.chance(0.15);
      let rank;
      if (level >= 2 && best.length && r.chance(0.25)) rank = r.pick(best);            // tie with another campaign
      else if (level >= 2 && a.min > 0 && r.chance(0.15)) rank = a.min;                  // exactly the minimum
      else { do rank = r.int(5, 95); while (usedRanks.has(rank)); }
      usedRanks.add(rank);
      best.push(rank);
      const nAds = level === 3 ? r.pick([1, 1, 2, 3]) : 1;
      bids.push({ bid_id: bidId += r.int(1, 5), auction: a, campaign: c, ad: c.replace("cmp_", "ad_") + "_1", rank, budget });
      for (let k = 2; k <= nAds; k++) {
        // Never above the first ad; an equal rank loses to the first ad's lower bid_id.
        bids.push({ bid_id: bidId += r.int(1, 5), auction: a, campaign: c, ad: c.replace("cmp_", "ad_") + "_" + k, rank: r.chance(0.3) ? rank : r.int(5, rank), budget });
      }
    }
  }
  // Every level: a budget-limited campaign with the highest rank in a 1-slot auction.
  {
    const a = { id: "auc_" + (aid += r.int(1, 40)), day: DAYS[0], sec: r.int(3600, 82800), slots: 1, min: 0 };
    auctions.push(a);
    const [c1, c2] = r.sample(camps, 2);
    bids.push({ bid_id: bidId += r.int(1, 5), auction: a, campaign: c1, ad: c1.replace("cmp_", "ad_") + "_1", rank: 97, budget: true });
    bids.push({ bid_id: bidId += r.int(1, 5), auction: a, campaign: c2, ad: c2.replace("cmp_", "ad_") + "_1", rank: r.int(30, 80), budget: false });
  }
  // Very Hard: one campaign with two strong ads in a 2-slot auction against a weaker rival.
  if (level === 3) {
    const a = { id: "auc_" + (aid += r.int(1, 40)), day: DAYS[1], sec: r.int(3600, 82800), slots: 2, min: 0 };
    auctions.push(a);
    const [c1, c2] = r.sample(camps, 2);
    bids.push({ bid_id: bidId += r.int(1, 5), auction: a, campaign: c1, ad: c1.replace("cmp_", "ad_") + "_1", rank: 90, budget: false });
    bids.push({ bid_id: bidId += r.int(1, 5), auction: a, campaign: c1, ad: c1.replace("cmp_", "ad_") + "_2", rank: 85, budget: false });
    bids.push({ bid_id: bidId += r.int(1, 5), auction: a, campaign: c2, ad: c2.replace("cmp_", "ad_") + "_1", rank: 40, budget: false });
  }

  const cmp = (x, y) => (x < y ? -1 : x > y ? 1 : 0);
  const solve = (o = {}) => {
    const per = new Map();
    for (const a of auctions) {
      const ab = bids.filter((b) => b.auction === a);
      // One entrant per campaign: its best ad (rank desc, bid_id asc), unless o.perBid.
      let entrants;
      if (o.perBid) entrants = ab.map((b) => ({ key: b.bid_id, campaign: b.campaign, rank: b.rank, budget: b.budget }));
      else {
        const m = new Map();
        for (const b of ab) {
          const cur = m.get(b.campaign);
          if (!cur || b.rank > cur.rank || (b.rank === cur.rank && b.bid_id < cur.bid_id)) m.set(b.campaign, b);
        }
        entrants = [...m.values()].map((b) => ({ key: b.campaign, campaign: b.campaign, rank: b.rank, budget: b.budget }));
      }
      const competing = entrants.filter((e) => (o.budgetCompetes || !e.budget) && (o.ignoreMin || e.rank >= a.min));
      competing.sort((x, y) => y.rank - x.rank || (o.tieWrong ? -cmp(x.campaign, y.campaign) : cmp(x.campaign, y.campaign)));
      const pos = new Map();
      competing.forEach((e, i) => pos.set(e.key, i + 1));
      for (const e of entrants) {
        const k = a.day + "|" + e.campaign;
        if (!per.has(k)) per.set(k, { el: 0, imp: 0, top: 0, lb: 0, lr: 0 });
        const s = per.get(k);
        s.el++;
        const p = pos.get(e.key);
        if (e.budget) s.lb++;
        else if (p !== undefined && p <= a.slots) { s.imp++; if (p === 1) s.top++; }
        else s.lr++;
      }
    }
    const share = (n, d) => Math.floor((n * 20000 + d) / (2 * d)) / 10000;
    return [...per.entries()].sort((x, y) => cmp(x[0], y[0])).map(([k, s]) => {
      const [day, c] = k.split("|");
      return [day, c, s.el, s.imp, s.top, share(s.imp, s.el), share(s.lb, s.el), share(s.lr, s.el)];
    });
  };
  const rows = solve();

  const diagnostics = [
    { message: "Budget-limited campaigns were ranked with the others and took positions. A campaign limited by budget does not enter the auction at all.", rows: solve({ budgetCompetes: true }) },
  ];
  if (level >= 2) {
    diagnostics.push({ message: "The minimum ad rank was ignored. A campaign below min_rank is not shown (lost to rank); one exactly at min_rank qualifies.", rows: solve({ ignoreMin: true }) });
    diagnostics.push({ message: "Equal ad ranks were tie-broken the wrong way. The lower campaign_id takes the higher position.", rows: solve({ tieWrong: true }) });
  }
  if (level === 3) diagnostics.push({ message: "Each ad was treated as its own entrant. A campaign is eligible once per auction and competes with its best ad only.", rows: solve({ perBid: true }) });

  const aCols = ["auction_id", "auction_ts", "slots", "min_rank"];
  const aRows = auctions.slice().sort((x, y) => cmp(x.id, y.id)).map((a) => [a.id, ts(a.day, a.sec), a.slots, a.min]);
  const bCols = ["bid_id", "auction_id", "campaign_id", "ad_id", "ad_rank", "budget_limited"];
  const bRows = bids.slice().sort((x, y) => x.bid_id - y.bid_id).map((b) => [b.bid_id, b.auction.id, b.campaign, b.ad, b.rank, b.budget]);
  const setup =
    "SET TIME ZONE 'UTC';\n" +
    "CREATE TABLE auctions (\n  auction_id TEXT PRIMARY KEY,\n  auction_ts TIMESTAMPTZ NOT NULL,\n  slots INT NOT NULL CHECK (slots >= 1),\n  min_rank INT NOT NULL\n);\n" +
    "CREATE TABLE bids (\n  bid_id BIGINT PRIMARY KEY,\n  auction_id TEXT NOT NULL REFERENCES auctions(auction_id),\n  campaign_id TEXT NOT NULL,\n  ad_id TEXT NOT NULL,\n  ad_rank INT NOT NULL,\n  budget_limited BOOLEAN NOT NULL\n);\n" +
    insertSQL("auctions", aCols, aRows) + insertSQL("bids", bCols, bRows);

  return {
    vars: {
      auctions: auctions.length,
      bids: bids.length,
      min_rule: level === 1
        ? "Every auction's `min_rank` is 0 in this sample, and no two campaigns tie on `ad_rank`."
        : "A campaign whose `ad_rank` is below the auction's `min_rank` is not shown (lost to rank); exactly `min_rank` qualifies. Equal `ad_rank`s are ordered by `campaign_id` ascending.",
      ads_rule: level === 3
        ? "A campaign can have several ads (several `bids` rows) in one auction. It is eligible once and competes once, with its best ad: highest `ad_rank`, then lowest `bid_id`. `budget_limited` is a campaign-level state, the same on all of its rows in an auction."
        : "Each campaign has at most one row per auction.",
    },
    setup,
    tables: [
      { name: "auctions", columns: aCols, rows: aRows },
      { name: "bids", columns: bCols, rows: bRows },
    ],
    expected: { columns: ["auction_date", "campaign_id", "eligible", "impressions", "top_impressions", "impression_share", "lost_budget_share", "lost_rank_share"], rows },
    diagnostics: diagnostics.filter((d) => JSON.stringify(d.rows) !== JSON.stringify(rows)),
  };
}
