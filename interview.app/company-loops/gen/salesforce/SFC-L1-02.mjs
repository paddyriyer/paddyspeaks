/* SFC-L1-02 — 30-day lead conversion by source, duplicates merged first (SQL).
   Simulated practice scenario. All data is generated from the seed. The merge and
   conversion rules are this exercise's own, not a description of any product.

   Contract: see docs/COMPANY-INTERVIEW-LOOPS.md § Executable templates (sql).
   The oracle builds each person's lead group from the generator's own record of who
   was merged into whom; the evaluator's reference SQL resolves the merge table with
   a recursive CTE. They are written independently.
   level: 1 Medium (one level of merges; every lead older than the window)
          2 Hard (+ leads too young to judge, conversions at exactly 30 days)
          3 Very Hard (+ merge chains: A into B, later B into C; survivors without a source) */
import { insertSQL, pad2 } from "../../js/rng.js";

export const kind = "sql";

const SOURCES = ["Partner Referral", "Phone Inquiry", "Purchased List", "Trade Show", "Web", "Webinar"];
const DAY = 86400;
const W = 30 * DAY;

const iso = (sec) => {
  const d = new Date(sec * 1000);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())} ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}:${pad2(d.getUTCSeconds())}+00`;
};

export function generate(r, level) {
  const asOf = Date.UTC(2026, r.int(6, 9), 1) / 1000;          // the snapshot: midnight on the 1st
  const sources = r.sample(SOURCES, level === 1 ? 3 : 4).sort();
  const leads = [];                                               // {id, source, created, converted, group}
  const merges = [];                                              // {from, into, at}
  let lid = 2000 + r.int(0, 5000);
  const newId = () => "lead_" + (lid += r.int(1, 7));
  const nGroups = 10 + 4 * level;
  const oldest = asOf - 110 * DAY;
  const matureMax = asOf - W - DAY;                               // created at least 31 days before the snapshot

  for (let g = 0; g < nGroups; g++) {
    // Group shape: 0 = the clock trap, 1 = a merge chain (Very Hard), 2 = young (Hard+),
    // 3 = exactly 30 days to convert (Hard+), 4 = mature exactly at the snapshot (Hard+).
    const young = level >= 2 && (g === 2 || (g > 4 && r.chance(0.15)));
    const size = g === 0 ? 2 : g === 1 && level === 3 ? 3 : r.pick([1, 1, 1, 2, 2, 3]);
    const firstMax = young ? asOf - r.int(1, 25) * DAY : g === 0 ? matureMax - 7 * DAY : matureMax;
    const first = g === 4 && level >= 2 ? asOf - W : young ? r.int(asOf - W + DAY, firstMax) : r.int(oldest, firstMax);
    const members = [];
    for (let k = 0; k < size; k++) {
      const created = k === 0 ? first : Math.min(first + r.int(1, 20) * DAY + r.int(0, DAY - 1), asOf - 3600);
      members.push({ id: newId(), source: r.pick(sources), created, converted: null, g });
    }
    // The survivor: often not the earliest lead (a later form fill is the "best" record).
    const surv = g === 0 ? members[1] : members[r.int(0, size - 1)];
    if (level === 3 && r.chance(0.2)) surv.source = null;
    if (g === 0 && surv.source === members[0].source) surv.source = r.pick(sources.filter((s) => s !== members[0].source));
    // Conversion of the survivor.
    const groupFirst = Math.min(...members.map((m) => m.created));
    let conv = null;
    if (g === 0) conv = groupFirst + W + r.int(1, 5) * DAY;                       // within 30 days of the survivor, not of the first lead
    else if (g === 3 && level >= 2) conv = groupFirst + W;                       // exactly 30 days: counts
    else if (r.chance(0.55)) conv = surv.created + r.int(1, 45) * DAY + r.int(0, DAY - 1);
    if (g === 0) surv.created = Math.max(surv.created, conv - W + DAY);          // keep the trap: survivor's own clock says "in time"
    if (conv !== null && conv <= asOf && conv > surv.created) surv.converted = conv;
    leads.push(...members);
    // Merges. Default: every other member merged straight into the survivor.
    const others = members.filter((m) => m !== surv);
    if (g === 1 && level === 3) {
      // A chain: the first other into the second, later the second into the survivor.
      const [a, b] = others;
      const t1 = Math.max(a.created, b.created) + r.int(3600, 3 * DAY);
      merges.push({ from: a.id, into: b.id, at: Math.min(t1, asOf - 2) });
      merges.push({ from: b.id, into: surv.id, at: Math.min(Math.max(t1, surv.created) + r.int(3600, 3 * DAY), asOf - 1) });
    } else {
      for (const o of others) merges.push({ from: o.id, into: surv.id, at: Math.min(Math.max(o.created, surv.created) + r.int(3600, 5 * DAY), asOf - 1) });
    }
    for (const m of members) m.surv = surv;
  }

  const byId = new Map(leads.map((l) => [l.id, l]));
  const into = new Map(merges.map((m) => [m.from, m.into]));
  const cmp = (x, y) => (x < y ? -1 : x > y ? 1 : 0);
  const share = (n, d) => Math.floor((n * 20000 + d) / (2 * d)) / 10000;

  // Oracle (and its broken variants). Groups come from the generator's own bookkeeping.
  const solve = (o = {}) => {
    const groups = new Map();
    for (const l of leads) {
      let root;
      if (o.noMerge) root = l;
      else if (o.oneHop) root = byId.get(into.get(l.id) || l.id);
      else root = l.surv;
      if (!groups.has(root.id)) groups.set(root.id, { root, members: [] });
      groups.get(root.id).members.push(l);
    }
    const agg = new Map();
    for (const { root, members } of groups.values()) {
      const earliest = members.reduce((a, b) => (b.created < a.created ? b : a));
      const start = o.survivorClock ? root.created : earliest.created;
      if (!o.keepYoung && start + W > asOf) continue;
      let src = o.firstSource ? earliest.source : root.source;
      if (src === null) { if (o.dropNull) continue; src = "Unknown"; }
      const conv = root.converted !== null && (o.strict ? root.converted < start + W : root.converted <= start + W);
      if (!agg.has(src)) agg.set(src, [0, 0]);
      const a = agg.get(src);
      a[0]++;
      if (conv) a[1]++;
    }
    return [...agg.entries()].sort((x, y) => cmp(x[0], y[0])).map(([s, [n, c]]) => [s, n, c, share(c, n)]);
  };
  const rows = solve();
  const diagnostics = [
    { message: "Merged duplicates were counted as leads of their own. Fold every merged lead into its surviving lead first: one person, one lead.", rows: solve({ noMerge: true }) },
    { message: "The 30 days were measured from the surviving lead's own created_at. The clock starts at the earliest created_at of any lead merged into it.", rows: solve({ survivorClock: true }) },
    { message: "The source was taken from the earliest lead in the group. The group reports under the surviving lead's lead_source.", rows: solve({ firstSource: true }) },
  ];
  if (level >= 2) {
    diagnostics.push({ message: "A conversion at exactly 30 days was not counted. Within 30 days includes the boundary: converted_at <= first created_at + 30 days.", rows: solve({ strict: true }) });
    diagnostics.push({ message: "Leads whose 30 days had not ended by the snapshot were counted (mostly as not converted). Report a group only when its first created_at + 30 days is at or before the snapshot.", rows: solve({ keepYoung: true }) });
  }
  if (level === 3) {
    diagnostics.push({ message: "Merges were followed one step only. A lead merged into a lead that was itself merged later belongs to the final survivor.", rows: solve({ oneHop: true }) });
    diagnostics.push({ message: "Groups whose surviving lead has no lead_source were dropped. Report them as 'Unknown'.", rows: solve({ dropNull: true }) });
  }

  const lCols = ["lead_id", "lead_source", "created_at", "converted_at"];
  const lRows = leads.slice().sort((a, b) => cmp(a.id, b.id)).map((l) => [l.id, l.source, iso(l.created), l.converted === null ? null : iso(l.converted)]);
  const mCols = ["merged_lead_id", "surviving_lead_id", "merged_at"];
  const mRows = merges.slice().sort((a, b) => a.at - b.at || cmp(a.from, b.from)).map((m) => [m.from, m.into, iso(m.at)]);
  const setup =
    "SET TIME ZONE 'UTC';\n" +
    "CREATE TABLE leads (\n  lead_id TEXT PRIMARY KEY,\n  lead_source TEXT,\n  created_at TIMESTAMPTZ NOT NULL,\n  converted_at TIMESTAMPTZ\n);\n" +
    "CREATE TABLE lead_merges (\n  merged_lead_id TEXT PRIMARY KEY REFERENCES leads(lead_id),\n  surviving_lead_id TEXT NOT NULL REFERENCES leads(lead_id),\n  merged_at TIMESTAMPTZ NOT NULL\n);\n" +
    insertSQL("leads", lCols, lRows) + insertSQL("lead_merges", mCols, mRows);

  return {
    vars: {
      as_of: iso(asOf),
      leads: leads.length,
      merges: merges.length,
      age_rule: level === 1
        ? "In this sample every group's first lead was created more than 30 days before the snapshot, but write the maturity filter anyway."
        : "Some leads are younger: report a group only if its first `created_at` + 30 days is at or before the snapshot; a group whose window is still running cannot be judged yet.",
      chain_rule: level === 3
        ? "Merges can chain: a lead merged into another lead that was itself merged later belongs to the final survivor. A surviving lead with no `lead_source` reports as `'Unknown'`."
        : "A surviving lead is never itself merged into another lead in this sample.",
    },
    setup,
    tables: [
      { name: "leads", columns: lCols, rows: lRows },
      { name: "lead_merges", columns: mCols, rows: mRows },
    ],
    expected: { columns: ["lead_source", "leads", "converted_30d", "conversion_rate"], rows },
    diagnostics: diagnostics.filter((d) => JSON.stringify(d.rows) !== JSON.stringify(rows)),
  };
}
