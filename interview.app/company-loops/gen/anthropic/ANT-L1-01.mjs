/* ANT-L1-01 — Prompt caching: savings or loss per workspace and model (SQL).
   Simulated practice scenario. All data is generated from the seed; every price,
   workspace and token count is hypothetical.

   Contract: see docs/COMPANY-INTERVIEW-LOOPS.md § Executable templates (sql).
   level: 1 Medium (one key per workspace, 5-minute cache writes only, all rows on the day)
          2 Hard (+ two keys per workspace, 1-hour cache writes, rows just outside the day)
          3 Very Hard (+ keys with no workspace, which belong to the default workspace) */
import { insertSQL, ts } from "../../js/rng.js";

export const kind = "sql";

const WORKSPACES = ["ws_contracts", "ws_support_agent", "ws_research_tools", "ws_docs_qa", "ws_code_review", "ws_eval_harness"];
const MODELS = [
  ["model-large-2", 1500, 7500],    // input, output price in US cents per million tokens (hypothetical)
  ["model-mid-4", 300, 1500],
  ["model-mid-3", 300, 1500],
  ["model-small-3", 80, 400],
  ["model-small-4", 100, 500],
  ["model-large-1", 500, 2500],
];
const DAYS = ["2026-09-08", "2026-09-16", "2026-09-23", "2026-10-01", "2026-10-07"];

// Integer cost units: 1/20 cent per million tokens, so every multiplier is exact.
const UNIT_PER_USD4 = 20 * 100 * 1e6 / 1e4;                 // units in 0.0001 USD = 200 000
function roundDiv(n, d) {                                   // half away from zero, like numeric ROUND
  const s = n < 0 ? -1 : 1;
  return s * Math.floor((2 * Math.abs(n) + d) / (2 * d));
}

export function generate(r, level) {
  const day = r.pick(DAYS);
  const minReq = r.pick([3, 4, 5]);
  const models = r.sample(MODELS, level === 1 ? 2 : 3);
  const wsNames = r.sample(WORKSPACES, level === 1 ? 3 : 4);
  if (level === 3) wsNames.push("default");

  // API keys: one per workspace at level 1, two at level 2+; at level 3 the default
  // workspace's keys have workspace_id NULL.
  const keys = [];
  let kseq = r.int(10, 80);
  for (const w of wsNames) {
    const n = level === 1 ? 1 : 2;
    for (let i = 0; i < n; i++) keys.push({ id: "key_" + (kseq += r.int(3, 17)).toString(36).padStart(4, "0"), ws: w });
  }
  const keysOf = (w) => keys.filter((k) => k.ws === w);

  // Groups (workspace, model) with a caching profile and a request count.
  const combos = r.shuffle(wsNames.flatMap((w) => models.map((m) => [w, m])));
  const nGroups = level === 1 ? 4 : 6;
  const groups = combos.slice(0, nGroups).map(([w, m], i) => ({ ws: w, model: m, profile: ["writeheavy", "reader", "none", "reader", "mixed", "writeheavy"][i] }));
  if (level === 3 && !groups.some((g) => g.ws === "default")) groups[groups.length - 1].ws = "default";
  const counts = r.shuffle([minReq, minReq - 1, ...groups.slice(2).map(() => r.int(minReq, minReq + 3))]);
  groups.forEach((g, i) => { g.n = counts[i]; });
  if (groups[0].n < minReq) { const j = groups.findIndex((g) => g.n >= minReq); [groups[0].n, groups[j].n] = [groups[j].n, groups[0].n]; }

  const rows = [];
  let rid = r.int(1000, 9000);
  const mk = (g, at, k) => {
    let inp = r.int(40, 2500), w5 = 0, w1 = 0, rd = 0;
    const p = g.profile;
    if (p === "writeheavy") {
      if (level >= 2 && r.chance(0.5)) w1 = r.int(4000, 40000); else w5 = r.int(4000, 40000);
      if (r.chance(0.2)) rd = r.int(1000, 4000);
    } else if (p === "reader") {
      if (k === 0) w5 = r.int(8000, 60000);
      else rd = r.int(8000, 60000);
    } else if (p === "mixed") {
      if (k === 0 && level >= 2) w1 = r.int(5000, 30000);
      else if (r.chance(0.5)) rd = r.int(5000, 30000); else w5 = r.int(2000, 12000);
    } else inp = r.int(400, 9000);
    const key = r.pick(keysOf(g.ws));
    rows.push({ id: "msg_" + (rid += r.int(1, 9)), key: key.id, ws: g.ws, model: g.model[0], at, inp, w5, w1, rd, out: r.int(30, 1800) });
  };
  for (const g of groups) for (let k = 0; k < g.n; k++) mk(g, ts(day, r.int(60, 86340)), k);
  if (level >= 2) {
    // Rows at the edges of the day: midnight belongs to the day; one second before and
    // midnight of the next day do not.
    const q = groups.filter((g) => g.n >= minReq);
    mk(r.pick(q), ts(day, 0), 1);
    mk(r.pick(q), ts(shiftDay(day, -1), 86399), 1);
    mk(r.pick(q), ts(shiftDay(day, 1), 0), 1);
    const g = q.find((x) => x.profile === "none") || q[0];
    mk(g, ts(shiftDay(day, 1), 0), 1);
  }
  const inDay = (x, closed) => x.at.slice(0, 10) === day || (closed && x.at === ts(shiftDay(day, 1), 0));

  // Oracle, parameterised so each diagnostic breaks one rule.
  const compute = (o = {}) => {
    const agg = new Map();
    for (const x of rows) {
      if (!inDay(x, o.closedDay)) continue;
      if (o.dropDefault && x.ws === "default") continue;
      const g = o.byKey ? x.key : x.ws;
      const k = g + "|" + x.model;
      const a = agg.get(k) || { g, model: x.model, n: 0, inp: 0, w5: 0, w1: 0, rd: 0, out: 0 };
      a.n++; a.inp += x.inp; a.w5 += x.w5; a.w1 += x.w1; a.rd += x.rd; a.out += x.out;
      agg.set(k, a);
    }
    const out = [];
    for (const a of agg.values()) {
      if (o.strictMin ? a.n <= minReq : a.n < minReq) continue;
      const [, pin, pout] = MODELS.find((m) => m[0] === a.model);
      const prompt = a.inp + a.w5 + a.w1 + a.rd;
      const share = roundDiv(a.rd * 1e4, o.shareOfInput ? a.inp : prompt) / 1e4;
      const actual = 20 * pin * a.inp + 25 * pin * a.w5 + (o.oneHourAs5m ? 25 : 40) * pin * a.w1 + (o.readsFull ? 20 : 2) * pin * a.rd + 20 * pout * a.out;
      const uncached = 20 * pin * (o.uncachedInputOnly ? a.inp : prompt) + 20 * pout * a.out;
      const net = roundDiv(uncached - actual, UNIT_PER_USD4);
      out.push([a.g, a.model, a.n, prompt, share, roundDiv(actual, UNIT_PER_USD4) / 1e4, roundDiv(uncached, UNIT_PER_USD4) / 1e4, net]);
    }
    out.sort((a, b) => a[7] - b[7] || cmp(a[0], b[0]) || cmp(a[1], b[1]));
    return out.map((x) => [...x.slice(0, 7), x[7] / 1e4]);
  };
  const expected = compute();

  const diagnostics = [
    { message: "Cache reads were priced at the full input price. In this exercise a cache read costs 0.1 × the model's input price.", rows: compute({ readsFull: true }) },
    { message: "The uncached cost counted only input_tokens. Without caching, every prompt token (input, cache writes and cache reads) would have been billed at the input price.", rows: compute({ uncachedInputOnly: true }) },
    { message: "cache_read_share was divided by input_tokens. The denominator is all prompt tokens: input + cache writes + cache reads.", rows: compute({ shareOfInput: true }) },
    { message: `The minimum was applied as strictly greater. A group with exactly ${minReq} requests is reported.`, rows: compute({ strictMin: true }) },
  ];
  if (level >= 2) {
    diagnostics.push({ message: "1-hour cache writes were priced like 5-minute writes. In this exercise a 1-hour write costs 2 × the input price; a 5-minute write 1.25 ×.", rows: compute({ oneHourAs5m: true }) });
    diagnostics.push({ message: "The day was treated as closed: a request at midnight of the next day was counted. Use created_at >= day AND created_at < day + 1.", rows: compute({ closedDay: true }) });
    diagnostics.push({ message: "Usage was grouped by API key. A workspace can have several keys; group by the key's workspace.", rows: compute({ byKey: true }) });
  }
  if (level === 3) diagnostics.push({ message: "Requests from keys with no workspace were dropped (an inner join, or a NULL group filtered out). Those keys belong to the default workspace; report them as 'default'.", rows: compute({ dropDefault: true }) });

  const keyRows = keys.map((k) => [k.id, k.ws === "default" ? null : k.ws]).sort((a, b) => cmp(a[0], b[0]));
  const priceRows = models.map((m) => [m[0], (m[1] / 100).toFixed(2), (m[2] / 100).toFixed(2)]).sort((a, b) => cmp(a[0], b[0]));
  const useRows = rows.slice().sort((a, b) => cmp(a.at, b.at) || cmp(a.id, b.id)).map((x) => [x.id, x.key, x.model, x.at, x.inp, x.w5, x.w1, x.rd, x.out]);
  const keyCols = ["api_key_id", "workspace_id"];
  const priceCols = ["model", "input_usd_per_mtok", "output_usd_per_mtok"];
  const useCols = ["request_id", "api_key_id", "model", "created_at", "input_tokens", "cache_creation_5m_tokens", "cache_creation_1h_tokens", "cache_read_input_tokens", "output_tokens"];

  const setup =
    "SET TIME ZONE 'UTC';\n" +
    "CREATE TABLE api_keys (\n  api_key_id TEXT PRIMARY KEY,\n  workspace_id TEXT\n);\n" +
    "CREATE TABLE model_prices (\n  model TEXT PRIMARY KEY,\n  input_usd_per_mtok NUMERIC(8,2) NOT NULL,\n  output_usd_per_mtok NUMERIC(8,2) NOT NULL\n);\n" +
    "CREATE TABLE messages_usage (\n  request_id TEXT PRIMARY KEY,\n  api_key_id TEXT NOT NULL REFERENCES api_keys,\n  model TEXT NOT NULL REFERENCES model_prices,\n  created_at TIMESTAMPTZ NOT NULL,\n  input_tokens INT NOT NULL,\n  cache_creation_5m_tokens INT NOT NULL,\n  cache_creation_1h_tokens INT NOT NULL,\n  cache_read_input_tokens INT NOT NULL,\n  output_tokens INT NOT NULL\n);\n" +
    insertSQL("api_keys", keyCols, keyRows) + insertSQL("model_prices", priceCols, priceRows) + insertSQL("messages_usage", useCols, useRows);

  return {
    vars: {
      day,
      min_requests: minReq,
      n_requests: rows.length,
      write_rule: level === 1
        ? "In this sample every cache write uses the 5-minute duration (`cache_creation_1h_tokens` is 0)."
        : "Cache writes come in two durations, priced differently: `cache_creation_5m_tokens` and `cache_creation_1h_tokens`.",
      workspace_rule: level === 3
        ? "Some API keys have `workspace_id` NULL: they belong to the organization's default workspace; report them as `'default'`."
        : "Every API key belongs to exactly one workspace.",
    },
    setup,
    tables: [
      { name: "api_keys", columns: keyCols, rows: keyRows },
      { name: "model_prices", columns: priceCols, rows: priceRows },
      { name: "messages_usage", columns: useCols, rows: useRows },
    ],
    expected: { columns: ["workspace_id", "model", "requests", "prompt_tokens", "cache_read_share", "actual_cost_usd", "uncached_cost_usd", "net_savings_usd"], rows: expected },
    diagnostics: diagnostics.filter((d) => JSON.stringify(d.rows) !== JSON.stringify(expected)),
  };
}

const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
function shiftDay(day, n) {
  const d = new Date(day + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
