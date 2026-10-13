/* AMZ-L1-03 — Allocate untagged cloud cost to teams, to the cent (SQL).
   Simulated practice scenario. All data is generated from the seed and is hypothetical.

   Contract: see docs/COMPANY-INTERVIEW-LOOPS.md § Executable templates (sql).
   For each (account, usage day) the untagged usage cost (the shared pool) is split across
   the teams that have tagged usage that day, in proportion to their tagged cost:
   each team gets floor(pool * team / tagged) cents, and the cents left over go one each to
   the largest remainders (ties: team name ascending). Allocations are then summed per
   (account, team). The oracle works in exact integers.
   level: 1 Medium (one usage day; usage line items only)
          2 Hard (+ several days allocated separately, credit and tax lines that are not usage,
                  pools whose remainders tie)
          3 Very Hard (+ tag values with stray case and spaces, empty-string tags, a day whose
                       pool has no tagged usage to follow: it stays 'unallocated') */
import { insertSQL } from "../../js/rng.js";

export const kind = "sql";

const TEAMS = ["ads-reporting", "catalog", "checkout", "fulfilment-api", "recommendations", "search", "seller-tools"];
const SERVICES = ["AmazonEC2", "AmazonS3", "AmazonRDS", "AWSLambda", "AmazonDynamoDB", "AWSDataTransfer", "AmazonCloudWatch"];
const BASES = ["2026-09-01", "2026-09-08", "2026-09-15", "2026-10-01"];
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const addDays = (d, n) => new Date(Date.parse(d + "T00:00:00Z") + n * 86400000).toISOString().slice(0, 10);

export function generate(r, level) {
  const nAcc = level === 1 ? 2 : 3;
  const accounts = [...Array(nAcc)].map(() => String(r.int(100000, 999999)) + String(r.int(100000, 999999))).sort();
  const nDays = level === 1 ? 1 : level === 2 ? 2 + r.int(0, 1) : 3;
  const base = r.pick(BASES);
  const days = [...Array(nDays)].map((_, i) => addDays(base, i));

  let seq = 880000 + r.int(0, 50000);
  const items = [];
  const add = (acc, day, team, type, cents, service) => items.push({ id: "li-" + seq++, acc, day, team, type, cents, service: service || r.pick(SERVICES) });
  const teamTag = (t) => {
    if (level < 3 || !r.chance(0.3)) return t;
    return r.pick([t.toUpperCase(), " " + t, t + " ", t[0].toUpperCase() + t.slice(1)]);
  };

  const tiePool = level >= 2 ? { acc: r.pick(accounts), day: r.pick(days) } : null;
  const orphan = level === 3 ? { acc: r.pick(accounts.filter((a) => !(tiePool && a === tiePool.acc))), day: r.pick(days) } : null;

  for (const acc of accounts) {
    const teams = r.sample(TEAMS, r.int(3, 4));
    for (const day of days) {
      if (orphan && orphan.acc === acc && orphan.day === day) {
        for (let j = r.int(1, 2); j > 0; j--) add(acc, day, j % 2 ? null : "", "Usage", r.int(500, 40000));
        continue;
      }
      if (tiePool && tiePool.acc === acc && tiePool.day === day) {
        // Three teams with equal tagged cost; the pool leaves 1 or 2 cents over, so the tie-break decides.
        const tied = teams.slice(0, 3);
        const each = r.int(1000, 30000);
        for (const t of tied) add(acc, day, teamTag(t), "Usage", each);
        add(acc, day, null, "Usage", 3 * r.int(500, 20000) + r.int(1, 2));
        continue;
      }
      const active = teams.filter(() => r.chance(0.85));
      if (!active.length) active.push(teams[0]);
      for (const t of active) for (let j = r.int(1, 2); j > 0; j--) add(acc, day, teamTag(t), "Usage", r.int(50, 90000));
      for (let j = r.int(1, 3); j > 0; j--) add(acc, day, level === 3 && r.chance(0.3) ? "" : null, "Usage", r.int(100, 50000), r.pick(["AWSDataTransfer", "AmazonCloudWatch", "AmazonVPC"]));
      if (level >= 2) {
        if (r.chance(0.6)) add(acc, day, r.chance(0.5) ? teamTag(r.pick(active)) : null, "Credit", -r.int(10, 400));
        if (r.chance(0.6)) add(acc, day, null, "Tax", r.int(100, 3000), "AmazonEC2");
      }
    }
  }

  // ---- oracle ---------------------------------------------------------------
  const compute = (opt = {}) => {
    const norm = (t) => {
      if (t == null) return null;
      const n = opt.rawTags ? t : t.trim().toLowerCase();
      return n === "" ? null : n;
    };
    const pools = {};
    for (const it of items) {
      if (!opt.allTypes && it.type !== "Usage") continue;
      const key = opt.wholePeriod ? it.acc : it.acc + "|" + it.day;
      const P = (pools[key] ||= { acc: it.acc, shared: 0, teams: {} });
      const team = norm(it.team);
      if (team == null) P.shared += it.cents;
      else P.teams[team] = (P.teams[team] || 0) + it.cents;
    }
    const totals = {};
    const put = (acc, team, direct, alloc) => {
      const T = (totals[acc + "|" + team] ||= { acc, team, direct: 0, alloc: 0 });
      T.direct += direct;
      T.alloc += alloc;
    };
    for (const P of Object.values(pools)) {
      const names = Object.keys(P.teams);
      const tagged = names.reduce((s, n) => s + P.teams[n], 0);
      if (!names.length) {
        if (P.shared && !opt.dropOrphan) put(P.acc, "unallocated", 0, P.shared);
        continue;
      }
      const parts = names.map((n) => {
        const num = P.shared * P.teams[n];
        if (opt.nearest) return { n, base: Math.round(num / tagged), rem: 0 };
        const base = Math.floor(num / tagged);
        return { n, base, rem: num - base * tagged };
      });
      let left = opt.nearest || opt.floorOnly ? 0 : P.shared - parts.reduce((s, p) => s + p.base, 0);
      parts.sort((a, b) => b.rem - a.rem || (opt.tieDesc ? cmp(b.n, a.n) : cmp(a.n, b.n)));
      for (const p of parts) {
        const extra = left > 0 ? 1 : 0;
        left -= extra;
        put(P.acc, p.n, P.teams[p.n], p.base + extra);
      }
    }
    return Object.values(totals)
      .sort((a, b) => cmp(a.acc, b.acc) || cmp(a.team, b.team))
      .map((T) => [T.acc, T.team, T.direct, T.alloc, T.direct + T.alloc]);
  };
  const rows = compute();

  const diagnostics = [
    { message: "Each team's share was floored and the leftover cents were dropped, so the allocations no longer add up to the pool. Hand the remaining cents out one at a time, largest remainder first.", rows: compute({ floorOnly: true }) },
    { message: "Each share was rounded to the nearest cent independently. The rounded shares need not add up to the pool (three equal teams and a pool of 100 cents give 33 + 33 + 33). Use floor plus largest remainder.", rows: compute({ nearest: true }) },
  ];
  if (level >= 2) {
    diagnostics.push({ message: "Equal remainders were broken by team name descending. The tie-break is team name ascending.", rows: compute({ tieDesc: true }) });
    diagnostics.push({ message: "The pool was split once per account over the whole period. Each usage day is its own pool, split by that day's tagged usage, and the daily allocations are then added up.", rows: compute({ wholePeriod: true }) });
    diagnostics.push({ message: "Credit and tax lines were treated as usage. Only `line_item_type = 'Usage'` is allocated; credits and tax are reported elsewhere.", rows: compute({ allTypes: true }) });
  }
  if (level === 3) {
    diagnostics.push({ message: "Tag values were used as written, so ' checkout' and 'CHECKOUT' became separate teams and empty strings became a team. Normalise with LOWER(TRIM(team)) and treat '' as untagged.", rows: compute({ rawTags: true }) });
    diagnostics.push({ message: "A day whose pool had no tagged usage to follow disappeared. Its cost still has to appear: report it under team 'unallocated'.", rows: compute({ dropOrphan: true }) });
  }

  const cols = ["line_item_id", "account_id", "usage_date", "product_code", "line_item_type", "team", "cost_cents"];
  const tRows = items.map((it) => [it.id, it.acc, it.day, it.service, it.type, it.team, it.cents]).sort((a, b) => cmp(a[1], b[1]) || cmp(a[2], b[2]) || cmp(a[0], b[0]));
  const types = level === 1 ? "'Usage'" : "'Usage','Credit','Tax'";
  const setup =
    "SET TIME ZONE 'UTC';\n" +
    `CREATE TABLE cur_line_items (\n  line_item_id TEXT PRIMARY KEY,\n  account_id TEXT NOT NULL,          -- 12-digit account id\n  usage_date DATE NOT NULL,\n  product_code TEXT NOT NULL,\n  line_item_type TEXT NOT NULL CHECK (line_item_type IN (${types})),\n  team TEXT,                         -- cost-allocation tag; NULL when untagged\n  cost_cents BIGINT NOT NULL         -- hypothetical extract, rounded to cents\n);\n` +
    insertSQL("cur_line_items", cols, tRows);

  return {
    vars: {
      n_items: items.length,
      period_rule:
        level === 1
          ? "The extract covers one usage day."
          : `The extract covers ${nDays} usage days. Each (account, usage day) is its own pool, split by that day's tagged usage; add the daily results up.`,
      type_rule: level === 1 ? "Every line item is usage (`line_item_type = 'Usage'`)." : "Only `line_item_type = 'Usage'` is allocated or counted as direct cost; `Credit` and `Tax` lines are out of scope.",
      tag_rule:
        level === 3
          ? "Tag values were typed by hand: compare them as `LOWER(TRIM(team))`, and treat an empty string like NULL (untagged). If a pool has no tagged usage that day, its whole amount is reported under team `'unallocated'` with `direct_cents = 0`."
          : "Tag values are clean lower-case team names; NULL means untagged. Every pool in the sample has tagged usage to follow.",
    },
    setup,
    tables: [{ name: "cur_line_items", columns: cols, rows: tRows }],
    expected: { columns: ["account_id", "team", "direct_cents", "allocated_cents", "total_cents"], rows },
    diagnostics: diagnostics.filter((d) => JSON.stringify(d.rows) !== JSON.stringify(rows)),
  };
}
