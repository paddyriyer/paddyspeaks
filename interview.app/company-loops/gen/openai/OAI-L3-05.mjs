/* OAI-L3-05 — Monthly cost per organization with effective-dated prices (SQL).
   Simulated practice scenario. All data, prices and names are generated from the seed
   and are hypothetical.

   Contract: docs/COMPANY-INTERVIEW-LOOPS.md § Executable templates.
   The oracle below prices every usage row in JavaScript (integer arithmetic in
   cents × tokens), so it never shares code or rounding with the reference SQL.

   level: 1 Medium    prices change at 00:00 UTC, one credit row per org-month at most
          2 Hard      + price changes at any time of day, two changes in one month,
                        several credit grants per org-month (fan-out trap)
          3 Very Hard + usage before a model's first price row (UNPRICED or excluded,
                        per the instance's rule), credits above cost (floor at 0),
                        an organization with a month of no usage (month grid) */
import { insertSQL } from "../../js/rng.js";

export const kind = "sql";

const ORGS = ["aurora", "basalt", "cedar", "dune", "ember", "fable", "garnet", "harbor", "iris", "juniper", "kestrel", "lumen"];
// Hypothetical list prices in cents per 1M tokens: [input range], [output range].
const MODELS = {
  "text-mini": [[15, 60], [60, 240]],
  "text-pro": [[250, 500], [1000, 2000]],
  "reasoning-lg": [[1000, 1500], [4000, 6000]],
  "embed-v2": [[2, 13], [0, 0]],
  "vision-std": [[200, 500], [800, 1500]],
  "audio-rt": [[400, 1000], [1600, 4000]],
};
const NEW_MODEL = "agent-preview";
const FACTORS = [0.5, 0.6, 0.75, 0.8, 1.2, 1.25];
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAY = 86400;

export function generate(r, level) {
  const threshold = r.pick([10, 15, 20, 25]);
  const unpricedMode = level === 3 ? r.pick(["exclude", "unpriced"]) : "exclude";
  const m0 = r.int(1, 6);                                       // first month index (Feb..Jul 2026)
  const months = [0, 1, 2].map((i) => Date.UTC(2026, m0 + i, 1) / 1000);
  const monthEnd = (i) => Date.UTC(2026, m0 + i + 1, 1) / 1000;
  const monthOf = (t) => (t < months[1] ? 0 : t < months[2] ? 1 : 2);

  // Organizations and their roles in the data.
  const orgs = r.sample(ORGS, level + 3).map((n) => "org_" + n);
  const [E, B, C, G, U] = orgs;                                 // E: exact-threshold org, B: big mover
  const gapMonth = level === 3 ? r.int(0, 1) : -1;              // G has no usage that month
  const projects = [];
  let pid = r.int(100, 700);
  for (const o of orgs) for (let k = 0, n = r.int(1, 2); k < n; k++) projects.push({ id: "prj_" + (pid += r.int(1, 9)), org: o });

  // Price book: one opening row per model before the first month, then changes.
  const models = r.sample(Object.keys(MODELS), 4);
  const prices = [];
  for (const m of models) {
    const [[il, ih], [ol, oh]] = MODELS[m];
    prices.push({ model: m, eff: months[0] - r.int(20, 150) * DAY, inC: r.int(il, ih), outC: r.int(ol, oh) });
  }
  const latestOf = (m) => prices.filter((p) => p.model === m).sort((a, b) => a.eff - b.eff).pop();
  const change = (m, eff) => {
    const prev = latestOf(m);
    const f = r.pick(FACTORS);
    let inC = Math.max(1, Math.round(prev.inC * f));
    if (inC === prev.inC) inC = prev.inC + 1;
    const outC = prev.outC === 0 ? 0 : Math.max(1, Math.round(prev.outC * f));
    prices.push({ model: m, eff, inC, outC });
    return eff;
  };
  const changes = [];
  const changed = r.sample(models, 2);
  if (level === 1) {
    for (const m of changed) changes.push({ model: m, t: change(m, months[r.int(0, 2)] + (r.int(5, 24) - 1) * DAY) });
  } else {
    const mi = r.int(0, 2);                                     // two changes for one model in one month
    const d1 = r.int(5, 12), d2 = r.int(14, 24);
    const tod = () => r.int(1, 22) * 3600 + r.pick([0, 900, 1800, 2700]);
    changes.push({ model: changed[0], t: change(changed[0], months[mi] + (d1 - 1) * DAY + tod()) });
    changes.push({ model: changed[0], t: change(changed[0], months[mi] + (d2 - 1) * DAY + tod()) });
    changes.push({ model: changed[1], t: change(changed[1], months[r.int(0, 2)] + (r.int(5, 24) - 1) * DAY + tod()) });
  }

  // Usage rows: a few batches per project per month.
  const usage = [];
  let uid = r.int(10000, 90000);
  const primary = new Map(orgs.map((o) => [o, r.pick(models.filter((m) => !m.startsWith("embed")))]));
  const addUsage = (proj, model, t, scale) => {
    const input = Math.round(r.int(500, 9000) * 1000 * scale);
    const output = model.startsWith("embed") ? 0 : Math.round((input * r.int(5, 50)) / 100);
    usage.push({ id: "u_" + (uid += r.int(1, 7)), project: proj.id, org: proj.org, model, t, mi: monthOf(t), input, output });
  };
  for (const o of orgs) {
    const f = r.int(5, 30) / 10;
    const mine = projects.filter((p) => p.org === o);
    for (let i = 0; i < 3; i++) {
      if (o === G && i === gapMonth) continue;
      const mult = o === B && i === 2 ? 3 : i === 0 ? 1 : r.int(7, 14) / 10;
      const days = (monthEnd(i) - months[i]) / DAY;
      for (const p of mine) {
        for (let k = 0, n = r.int(2, 3); k < n; k++) {
          const model = o === B || k === 0 ? primary.get(o) : r.pick(models);
          addUsage(p, model, months[i] + r.int(0, days * DAY - 1), f * mult);
        }
      }
    }
  }
  // Usage exactly at each price change (the new price applies) and shortly before it.
  const boundaryOrgs = orgs.filter((o) => o !== G && o !== B);
  for (const c of changes) {
    const o = r.pick(boundaryOrgs);
    const p = r.pick(projects.filter((x) => x.org === o));
    addUsage(p, c.model, c.t, 1);
    const o2 = r.pick(boundaryOrgs);
    addUsage(r.pick(projects.filter((x) => x.org === o2)), c.model, c.t - r.int(60, 3600), 1);
  }
  // Level 3: a model used before its first price row takes effect.
  if (level === 3) {
    const li = r.int(1, 2);
    const start = months[li] + r.int(6, 18) * DAY + r.int(1, 22) * 3600;
    prices.push({ model: NEW_MODEL, eff: start, inC: r.int(300, 800), outC: r.int(1200, 3000) });
    const pu = projects.find((x) => x.org === U);
    addUsage(pu, NEW_MODEL, start - r.int(1, 3) * DAY - r.int(0, 3600), 1);   // unpriced
    addUsage(pu, NEW_MODEL, start, 1);                                       // exactly at the first price
    addUsage(pu, NEW_MODEL, start + r.int(3600, 5 * DAY), 1);
  }

  // ---- Oracle -------------------------------------------------------------------------
  const book = new Map();
  for (const p of prices) (book.get(p.model) || book.set(p.model, []).get(p.model)).push(p);
  for (const rows of book.values()) rows.sort((a, b) => a.eff - b.eff);
  const roundCents = (v) => Math.floor((v + 500000) / 1000000);   // v = Σ tokens × cents-per-1M; half up
  const priceFor = (u, o) => {
    const rows = book.get(u.model) || [];
    if (o.latest) return rows[rows.length - 1] || null;
    const t = o.monthStart ? months[u.mi] : u.t;
    let hit = null;
    for (const p of rows) if (o.strict ? p.eff < t : p.eff <= t) hit = p;
    if (!hit && o.backfill) hit = rows[0] || null;
    return hit;
  };
  const usageStats = (o) => {
    const st = new Map();
    for (const u of usage) {
      const key = u.org + "|" + u.mi;
      const s = st.get(key) || { V: 0, Vrow: 0, n: 0, unpriced: false };
      s.n++;
      const p = priceFor(u, o);
      if (!p) s.unpriced = true;
      else {
        const v = u.input * p.inC + u.output * p.outC;
        s.V += v;
        s.Vrow += roundCents(v);
      }
      st.set(key, s);
    }
    return st;
  };

  // Credits: decided against the true gross (correct pricing).
  const truth = usageStats({});
  const gross = (o, i) => { const s = truth.get(o + "|" + i); return s ? roundCents(s.V) : 0; };
  const credits = new Map();                                    // "org|month" -> [cents, ...]
  const grant = (o, i, cents) => {
    if (cents <= 0) return;
    const parts = level >= 2 && r.chance(0.5) && cents >= 300 ? split(r, cents, r.int(2, 3)) : [cents];
    credits.set(o + "|" + i, parts);
  };
  for (const o of orgs) {
    if (o === E) continue;
    for (let i = 0; i < 3; i++) {
      if (o === B && i >= 1) continue;
      if (level === 3 && o === C && i <= 1) continue;
      if (o === G && i === gapMonth) continue;
      if (r.chance(0.35)) grant(o, i, Math.round((gross(o, i) * r.int(5, 25)) / 100));
    }
  }
  if (level === 3) grant(C, 1, gross(C, 1) + r.int(500, 5000));  // credits above cost: floored at 0
  // E: net cost changes by exactly the threshold from month 1 to month 2 (not reported: strict >).
  const n1 = Math.floor((Math.min(gross(E, 0), gross(E, 1) / 1.3) * 0.9) / 100) * 100;
  if (n1 >= 100) {
    const n2 = (n1 / 100) * (100 + (r.chance(0.5) ? threshold : -threshold));
    grant(E, 0, gross(E, 0) - n1);
    grant(E, 1, gross(E, 1) - n2);
  }

  const compute = (o = {}) => {
    const st = usageStats(o);
    const state = (org, i) => {
      const s = st.get(org + "|" + i);
      const cr = credits.get(org + "|" + i) || [];
      const c = cr.reduce((a, b) => a + b, 0);
      if (unpricedMode === "unpriced" && !o.dropUnpriced && s && s.unpriced) return { unpriced: true };
      let g = 0;
      if (s) g = o.roundPerRow ? s.Vrow : roundCents(s.V * (o.fanout ? Math.max(1, cr.length) : 1));
      const cc = o.fanout ? c * (s ? s.n : 0) : c;
      return { unpriced: false, net: o.noFloor ? g - cc : Math.max(0, g - cc) };
    };
    const rows = [];
    for (let i = 1; i < 3; i++) {
      for (const org of [...orgs].sort()) {
        let cur, prev;
        if (o.noGrid) {                                         // LAG over months that have usage
          if (!st.has(org + "|" + i)) continue;
          cur = state(org, i);
          for (let j = i - 1; j >= 0; j--) if (st.has(org + "|" + j)) { prev = state(org, j); break; }
        } else {
          cur = state(org, i);
          prev = state(org, i - 1);
        }
        const m = fmtDate(months[i]);
        if (cur.unpriced) { rows.push([m, org, prev && !prev.unpriced ? prev.net / 100 : null, null, null, "UNPRICED"]); continue; }
        if (!prev || prev.unpriced) continue;
        if (prev.net === 0) { if (cur.net > 0) rows.push([m, org, 0, cur.net / 100, null, "FROM_ZERO"]); continue; }
        if (prev.net < 0) continue;
        const diff = cur.net - prev.net;
        const over = o.gte ? 100 * Math.abs(diff) >= threshold * prev.net : 100 * Math.abs(diff) > threshold * prev.net;
        if (!over) continue;
        const hund = Math.floor((2 * 10000 * Math.abs(diff) + prev.net) / (2 * prev.net)); // hundredths of a percent, half away from zero
        rows.push([m, org, prev.net / 100, cur.net / 100, (Math.sign(diff) * hund) / 100, diff > 0 ? "UP" : "DOWN"]);
      }
    }
    return rows;
  };
  const rows = compute();

  const diagnostics = [
    { message: "Prices were matched with effective_from < usage_ts. A price takes effect AT its effective_from: usage at exactly that instant pays the new price (use <=).", rows: compute({ strict: true }) },
    { message: "Each month was priced at the rate in effect when the month began. Prices change mid-month: price every usage row at its own usage_ts.", rows: compute({ monthStart: true }) },
    { message: "All usage was priced at the model's latest price. Historical usage must pay the price in effect when it happened (a point-in-time join).", rows: compute({ latest: true }) },
    { message: "A change of exactly the threshold was reported. The rule is strictly greater than the threshold.", rows: compute({ gte: true }) },
    { message: "Each usage row was rounded to cents before summing. Sum the exact amounts and round the organization's monthly gross once.", rows: compute({ roundPerRow: true }) },
  ];
  if (level >= 2) diagnostics.push({ message: "Credits were joined to usage rows before aggregating, so both sides fanned out: cost was multiplied by the number of credit grants and credits by the number of usage rows. Aggregate each side to org × month first, then join.", rows: compute({ fanout: true }) });
  if (level === 3) {
    diagnostics.push({ message: "Net cost was not floored at 0. Credits above the month's cost leave a net of 0, not a negative number (unused credit does not carry over).", rows: compute({ noFloor: true }) });
    diagnostics.push({ message: "The previous month was taken from the previous row with usage (LAG over existing rows). A month with no usage still exists and costs 0: build the organization × month grid first.", rows: compute({ noGrid: true }) });
    if (unpricedMode === "unpriced") diagnostics.push({ message: "Usage with no price in effect was silently dropped (an inner join). This instance's rule reports that organization-month as UNPRICED.", rows: compute({ dropUnpriced: true }) });
    else diagnostics.push({ message: "Usage before a model's first price row was priced at that first price. This instance's rule excludes unpriced usage from cost.", rows: compute({ backfill: true }) });
  }

  // ---- Tables -------------------------------------------------------------------------
  const orgCols = ["org_id", "org_name"];
  const orgRows = [...orgs].sort().map((o) => [o, cap(o.slice(4)) + " " + r.pick(["Labs", "Health", "Studio", "Analytics", "Robotics", "Learning"])]);
  const projCols = ["project_id", "org_id"];
  const projRows = projects.map((p) => [p.id, p.org]).sort((a, b) => (a[0] < b[0] ? -1 : 1));
  const priceCols = ["model", "effective_from", "usd_per_mtok_input", "usd_per_mtok_output"];
  const priceRows = [...prices].sort((a, b) => (a.model < b.model ? -1 : a.model > b.model ? 1 : a.eff - b.eff)).map((p) => [p.model, fmtTs(p.eff), p.inC / 100, p.outC / 100]);
  const usageCols = ["usage_id", "project_id", "model", "usage_ts", "input_tokens", "output_tokens"];
  const usageRows = [...usage].sort((a, b) => a.t - b.t || (a.id < b.id ? -1 : 1)).map((u) => [u.id, u.project, u.model, fmtTs(u.t), u.input, u.output]);
  const creditCols = ["org_id", "credit_month", "amount_usd"];
  const creditRows = [];
  for (const [k, parts] of [...credits.entries()].sort()) {
    const [o, i] = k.split("|");
    for (const c of parts) creditRows.push([o, fmtDate(months[+i]), c / 100]);
  }

  const setup =
    "SET TIME ZONE 'UTC';\n" +
    "CREATE TABLE organizations (\n  org_id TEXT PRIMARY KEY,\n  org_name TEXT NOT NULL\n);\n" +
    "CREATE TABLE projects (\n  project_id TEXT PRIMARY KEY,\n  org_id TEXT NOT NULL REFERENCES organizations\n);\n" +
    "CREATE TABLE model_prices (\n  model TEXT NOT NULL,\n  effective_from TIMESTAMPTZ NOT NULL,\n  usd_per_mtok_input NUMERIC(10,2) NOT NULL,\n  usd_per_mtok_output NUMERIC(10,2) NOT NULL,\n  PRIMARY KEY (model, effective_from)\n);\n" +
    "CREATE TABLE usage_records (\n  usage_id TEXT PRIMARY KEY,\n  project_id TEXT NOT NULL REFERENCES projects,\n  model TEXT NOT NULL,\n  usage_ts TIMESTAMPTZ NOT NULL,\n  input_tokens BIGINT NOT NULL,\n  output_tokens BIGINT NOT NULL\n);\n" +
    "CREATE TABLE credits (\n  org_id TEXT NOT NULL REFERENCES organizations,\n  credit_month DATE NOT NULL,\n  amount_usd NUMERIC(12,2) NOT NULL CHECK (amount_usd > 0)\n);\n" +
    insertSQL("organizations", orgCols, orgRows) + insertSQL("projects", projCols, projRows) +
    insertSQL("model_prices", priceCols, priceRows) + insertSQL("usage_records", usageCols, usageRows) +
    insertSQL("credits", creditCols, creditRows);

  const monthsText = `${MONTH_NAMES[(m0) % 12]}, ${MONTH_NAMES[(m0 + 1) % 12]} and ${MONTH_NAMES[(m0 + 2) % 12]} 2026`;
  return {
    vars: {
      threshold,
      m1: fmtDate(months[0]),
      m2: fmtDate(months[1]),
      m3: fmtDate(months[2]),
      months_text: monthsText,
      usage_rows: usage.length,
      unpriced_mode: unpricedMode,
      price_note: level === 1
        ? "In this sample a price changes at 00:00 UTC, at most once per model."
        : "A price can change at any time of day, and one model changes price twice in the same month.",
      credit_note: level === 1
        ? "An organization has at most one credit row per month."
        : "An organization can receive several credit grants in one month; they add up.",
      gap_note: level === 3
        ? "Some organizations have a month with no usage at all; that month's gross cost is 0."
        : "Every organization has usage in every month of the sample.",
      unpriced_rule: level < 3
        ? "Every usage row has a price in effect."
        : unpricedMode === "exclude"
          ? "Some usage has no price in effect (a model was used before its first price row). Rule for this instance: exclude that usage from cost; it counts as 0 here and is reported elsewhere."
          : "Some usage has no price in effect (a model was used before its first price row). Rule for this instance: an organization-month with any unpriced usage is reported with status `UNPRICED`, whatever its change, with `net_usd` and `pct_change` NULL (and `prev_net_usd` as usual, NULL if that month is UNPRICED too). A month whose previous month is UNPRICED cannot be compared and is reported only if it is UNPRICED itself.",
    },
    setup,
    tables: [
      { name: "organizations", columns: orgCols, rows: orgRows },
      { name: "projects", columns: projCols, rows: projRows },
      { name: "model_prices", columns: priceCols, rows: priceRows },
      { name: "usage_records", columns: usageCols, rows: usageRows },
      { name: "credits", columns: creditCols, rows: creditRows },
    ],
    expected: { columns: ["month", "org_id", "prev_net_usd", "net_usd", "pct_change", "status"], rows },
    diagnostics: diagnostics.filter((d) => JSON.stringify(d.rows) !== JSON.stringify(rows)),
  };
}

function split(r, cents, k) {                    // k positive parts summing to cents
  const cuts = new Set();
  while (cuts.size < k - 1) cuts.add(r.int(1, cents - 1));
  const xs = [0, ...[...cuts].sort((a, b) => a - b), cents];
  return xs.slice(1).map((x, i) => x - xs[i]);
}
function cap(s) { return s[0].toUpperCase() + s.slice(1); }
function fmtDate(sec) { return new Date(sec * 1000).toISOString().slice(0, 10); }
function fmtTs(sec) { const s = new Date(sec * 1000).toISOString(); return s.slice(0, 10) + " " + s.slice(11, 19) + "+00"; }
