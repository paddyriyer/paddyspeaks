/* GOO-L3-05 — Last-click conversion attribution, reported by click date (SQL).
   Simulated practice scenario set in a public search-advertising domain. All campaigns,
   visitors, clicks, conversions and values are generated from the seed and are hypothetical.

   One deterministic result set: one row per (UTC click date, campaign_id) that has at least
   one click, carrying
     clicks                   clicks on that date for that campaign;
     conversions              counted conversions credited (last click, within the action's
                              window, both ends inclusive) to those clicks;
     conversion_value_micros  the sum of those conversions' value_micros (0 when none).
   level: 1 Medium    one action; inclusive window end; last click wins; clicks after the
                      conversion never count; reported by click date; zero rows kept;
                      a click with two conversions (fan-out trap for the clicks column)
          2 Hard      + several actions with their own windows; duplicate uploads of one order
                      (keep the earliest); NULL order ids are never duplicates; two clicks at the
                      same instant (higher click_id wins)
          3 Very Hard + an action counted "one per click"; a duplicate re-upload with the same
                      timestamp (smaller conversion_id kept) */
import { insertSQL } from "../../js/rng.js";

export const kind = "sql";

const H = 3600, D = 86400;
const CAMPAIGNS = [
  "Search - trail running shoes", "Search - brand terms", "Display - spring sale", "Video - product launch",
  "Shopping - outdoor gear", "Search - competitor terms", "Video - how-to series", "Display - remarketing",
];
const pad = (n) => String(n).padStart(2, "0");
function stamp(sec) {
  const d = new Date(sec * 1000);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}+00`;
}
const dateOf = (sec) => stamp(sec).slice(0, 10);

export function generate(r, level) {
  const t0 = Date.UTC(2026, r.int(2, 8), r.int(1, 20)) / 1000;    // first day of the extract, 00:00 UTC
  const nCamp = level + 2;
  const campIds = new Set();
  while (campIds.size < nCamp) campIds.add("cmp_" + r.int(1000, 9999));
  const camps = r.sample(CAMPAIGNS, nCamp).map((name, i) => ({ id: [...campIds][i], name }));
  const campOf = () => r.pick(camps).id;
  const twoCamps = () => { const [a, b] = r.sample(camps, 2); return [a.id, b.id]; };

  // Conversion actions. Windows in whole days; hypothetical settings.
  const purchase = { id: "purchase", name: "Online purchase", window: level === 1 ? r.pick([2, 3]) : r.pick([3, 5]), counting: "every" };
  const actions = [purchase];
  const signup = { id: "signup", name: "Newsletter sign-up", window: 1, counting: "every" };
  const lead = { id: "lead", name: "Quote request form", window: r.pick([1, 2]), counting: "one" };
  if (level >= 2) actions.push(signup);
  if (level === 3) actions.push(lead);

  // Visitors: pseudonymous keys, unique.
  const vkeys = new Set();
  const newVisitor = () => { let k; do { k = "vk_" + r.int(0x1000, 0xffff).toString(16); } while (vkeys.has(k)); vkeys.add(k); return k; };

  const clicks = [], convs = [];
  let orderNo = r.int(40000, 90000);
  const nextOrder = () => "ord_" + (orderNo += r.int(1, 37));
  const purchaseValue = () => r.int(8, 450) * 1000000 + r.int(0, 99) * 10000;
  const leadValue = r.pick([20, 35, 50]) * 1000000;
  const signupValue = r.pick([2, 5]) * 1000000;
  const click = (visitor, campaign, t) => { const c = { visitor, campaign, t }; clicks.push(c); return c; };
  const conv = (visitor, action, t, order, value) => {
    const v = value ?? (action === "purchase" ? purchaseValue() : action === "lead" ? leadValue : signupValue);
    const c = { visitor, action, t, order: order === undefined ? (action === "purchase" ? nextOrder() : null) : order, value: v };
    convs.push(c);
    return c;
  };
  const W = purchase.window * D;

  // Forced edge cases, each on its own visitor so nothing else changes their outcome.
  { const v = newVisitor(), t = r.int(D, 2 * D);                        // conversion exactly at the window end: counted
    click(v, campOf(), t); conv(v, "purchase", t + W); }
  { const v = newVisitor(), [a, b] = twoCamps(), t1 = r.int(D, 3 * D), t2 = t1 + r.int(2 * H, 20 * H);
    click(v, a, t1); click(v, b, t2); conv(v, "purchase", t2 + r.int(H, 10 * H)); }   // last click (b) wins
  { const v = newVisitor(), t = r.int(0, 2 * D);                         // just outside the window: unattributed
    click(v, campOf(), t); conv(v, "purchase", t + W + r.int(60, 5 * H)); }
  { const v = newVisitor(), t = r.int(D, 3 * D);                         // the only click comes after the conversion
    conv(v, "purchase", t); click(v, campOf(), t + r.int(H, 5 * H)); }
  { const v = newVisitor(), d = r.int(1, 3);                             // click late on day d, conversion on day d+1
    const t = d * D + 22 * H + r.int(0, 90 * 60);
    click(v, campOf(), t); conv(v, "purchase", (d + 1) * D + r.int(30 * 60, 3 * H)); }
  { const v = newVisitor(), t = r.int(D, 3 * D);                         // one click, two conversions (fan-out trap)
    click(v, campOf(), t); conv(v, "purchase", t + r.int(H, 5 * H)); conv(v, "purchase", t + r.int(6 * H, 20 * H)); }
  { const v = newVisitor();                                              // a click on the last day with no conversion
    click(v, campOf(), 6 * D + r.int(H, 20 * H)); }

  if (level >= 2) {
    { const v = newVisitor(), [a, b] = twoCamps(), t1 = r.int(D, 3 * D), t2 = t1 + r.int(6 * H, 20 * H);
      click(v, a, t1); click(v, b, t2);
      const order = nextOrder();                                        // the same order uploaded twice
      conv(v, "purchase", t1 + r.int(H, 5 * H), order);                  // earliest copy: credited to a
      conv(v, "purchase", t2 + r.int(H, 5 * H), order); }                // later copy: a duplicate, not counted
    { const v = newVisitor(), t = r.int(D, 4 * D);                       // two sign-ups without order ids: both count
      click(v, campOf(), t); conv(v, "signup", t + r.int(H, 2 * H), null); conv(v, "signup", t + r.int(3 * H, 20 * H), null); }
    { const v = newVisitor(), [a, b] = twoCamps(), t = r.int(D, 3 * D);  // two clicks at the same instant
      click(v, a, t); click(v, b, t); conv(v, "purchase", t + r.int(H, D)); }
    { const v = newVisitor(), t = r.int(D, 3 * D);                       // outside the sign-up window, inside purchase's
      click(v, campOf(), t); conv(v, "signup", t + D + r.int(H, 10 * H), null); }
  }
  if (level === 3) {
    { const v = newVisitor(), t = r.int(D, 3 * D);                       // two leads on one click: only the first counts
      click(v, campOf(), t); conv(v, "lead", t + r.int(H, 4 * H)); conv(v, "lead", t + r.int(5 * H, 20 * H)); }
    { const v = newVisitor(), [a, b] = twoCamps(), t1 = r.int(D, 3 * D), t2 = t1 + r.int(5 * H, 10 * H);
      click(v, a, t1); click(v, b, t2);                                  // one lead per click, two clicks: both count
      conv(v, "lead", t1 + r.int(H, 4 * H)); conv(v, "lead", t2 + r.int(H, 4 * H)); }
    { const v = newVisitor(), t = r.int(D, 4 * D), order = nextOrder(); // re-upload with the same timestamp
      click(v, campOf(), t); const tc = t + r.int(H, 6 * H);
      conv(v, "purchase", tc, order); conv(v, "purchase", tc, order); }
  }

  // Ordinary traffic: a pool of visitors with a few clicks, conversions from them and from
  // visitors who never clicked (organic, unattributed).
  const pool = Array.from({ length: level === 1 ? 5 : level === 2 ? 7 : 9 }, newVisitor);
  for (const v of pool) for (let k = 0, n = r.int(1, 3); k < n; k++) click(v, campOf(), r.int(0, 5 * D - 1));
  const nConv = level === 1 ? r.int(6, 8) : level === 2 ? r.int(8, 11) : r.int(10, 13);
  for (let k = 0; k < nConv; k++) {
    const v = r.chance(0.15) ? newVisitor() : r.pick(pool);
    const a = r.pick(actions).id;
    const order = a === "purchase" ? (level >= 2 && r.chance(0.15) ? null : nextOrder()) : null;
    conv(v, a, r.int(0, 6 * D - 1), order);
  }

  // Ids are random, not in time order (real click ids are not sortable by time).
  const ids = (n, lo, hi) => { const s = new Set(); while (s.size < n) s.add(r.int(lo, hi)); return r.shuffle([...s]); };
  const cIds = ids(clicks.length, 100000, 999999);
  clicks.forEach((c, i) => { c.id = cIds[i]; c.t += t0; });
  const vIds = ids(convs.length, 10000, 99999);
  convs.forEach((c, i) => { c.id = vIds[i]; c.t += t0; });
  const actOf = Object.fromEntries(actions.map((a) => [a.id, a]));

  // The oracle. Each opt breaks one rule, for diagnostics.
  const compute = (o = {}) => {
    // 1. Deduplicate uploads: same action and same non-NULL order id → keep the earliest (then smallest id).
    let kept = convs;
    if (!o.noDedup) {
      const best = new Map();
      for (const c of convs) {
        if (c.order === null && !o.nullDup) continue;
        const key = c.action + "|" + c.order;
        const b = best.get(key);
        const better = !b || (o.keepLatest ? (c.t > b.t || (c.t === b.t && c.id > b.id)) : (c.t < b.t || (c.t === b.t && c.id < b.id)));
        if (better) best.set(key, c);
      }
      kept = convs.filter((c) => (c.order === null && !o.nullDup) || best.get(c.action + "|" + c.order) === c);
    }
    // 2. Last click within the action's window.
    const maxWin = Math.max(...actions.map((a) => a.window));
    const credited = [];
    for (const c of kept) {
      const w = (o.oneWindow ? maxWin : actOf[c.action].window) * D;
      let pick = null;
      for (const k of clicks) {
        if (k.visitor !== c.visitor) continue;
        if (!o.upperOnly && k.t > c.t) continue;
        if (!o.noWindow && (o.strict ? !(c.t < k.t + w) : !(c.t <= k.t + w))) continue;
        if (!pick) { pick = k; continue; }
        const later = o.firstClick ? k.t < pick.t : k.t > pick.t;
        const tieWin = k.t === pick.t && (o.lowTie ? k.id < pick.id : k.id > pick.id);
        if (later || tieWin) pick = k;
      }
      if (pick) credited.push({ c, k: pick });
    }
    // 3. Counting "one": a click keeps only its earliest conversion of that action.
    let counted = credited;
    if (!o.noCounting) {
      const first = new Map();
      for (const x of credited) {
        if (actOf[x.c.action].counting !== "one") continue;
        const key = (o.perVisitor ? x.c.visitor : x.k.id) + "|" + x.c.action;
        const b = first.get(key);
        if (!b || x.c.t < b.c.t || (x.c.t === b.c.t && x.c.id < b.c.id)) first.set(key, x);
      }
      counted = credited.filter((x) => actOf[x.c.action].counting !== "one" || first.get((o.perVisitor ? x.c.visitor : x.k.id) + "|" + x.c.action) === x);
    }
    // 4. Report by click date and campaign over the click grid.
    const cells = new Map();
    const cell = (date, camp) => {
      const key = date + "|" + camp;
      if (!cells.has(key)) cells.set(key, { date, camp, clicks: 0, conv: 0, value: 0, perClick: new Map() });
      return cells.get(key);
    };
    for (const k of clicks) cell(dateOf(k.t), k.campaign).clicks++;
    for (const x of counted) {
      const key = (o.byConvDate ? dateOf(x.c.t) : dateOf(x.k.t)) + "|" + x.k.campaign;
      const g = cells.get(key);
      if (!g) continue;                                   // a wrong query's conversion date with no clicks: lost in the join
      g.conv++;
      g.value += x.c.value;
      g.perClick.set(x.k.id, (g.perClick.get(x.k.id) || 0) + 1);
    }
    let rows = [...cells.values()]
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.camp < b.camp ? -1 : a.camp > b.camp ? 1 : 0))
      .map((g) => {
        let n = g.clicks;
        if (o.fanout) for (const m of g.perClick.values()) n += m - 1;    // a click counted once per conversion
        return [g.date, g.camp, n, g.conv, g.value];
      });
    if (o.dropZero) rows = rows.filter((x) => x[3] !== 0);
    return rows;
  };
  const rows = compute();

  const diagnostics = [
    { message: "The window end is inclusive. A conversion exactly window_days after the click is still credited to it.", rows: compute({ strict: true }) },
    { message: "The attribution window was ignored. A conversion more than window_days after the visitor's last click is unattributed.", rows: compute({ noWindow: true }) },
    { message: "Only the upper bound of the window was checked, so a click made after the conversion received credit. A click can only be credited with conversions that happen at or after it.", rows: compute({ upperOnly: true }) },
    { message: "The first qualifying click got the credit. The rule is last click: the visitor's latest click inside the window.", rows: compute({ firstClick: true }) },
    { message: "Conversions were reported on the conversion's date. This report is by the date of the click that receives the credit.", rows: compute({ byConvDate: true }) },
    { message: "Clicks were counted after joining conversions, so a click with several conversions was counted several times. Count clicks from the clicks table on their own, then join the conversion totals.", rows: compute({ fanout: true }) },
    { message: "Rows with no conversions were dropped. Every date and campaign with at least one click is reported, with 0 conversions.", rows: compute({ dropZero: true }) },
  ];
  if (level >= 2) {
    diagnostics.push(
      { message: "Duplicate uploads were counted. Conversions of the same action with the same non-NULL order_id are one conversion: keep the earliest copy.", rows: compute({ noDedup: true }) },
      { message: "The latest copy of a duplicated order was kept. Keep the earliest (then the smallest conversion_id); the copy kept decides which click gets the credit.", rows: compute({ keepLatest: true }) },
      { message: "Conversions with a NULL order_id were treated as duplicates of each other (PARTITION BY or GROUP BY order_id puts all NULLs in one group). A NULL order_id is never a duplicate.", rows: compute({ nullDup: true }) },
      { message: "Two clicks at the same instant: the higher click_id wins. Your tie-break picked the other one.", rows: compute({ lowTie: true }) },
      { message: "One window was used for every action. Each conversion uses the window_days of its own action.", rows: compute({ oneWindow: true }) },
    );
  }
  if (level === 3) {
    diagnostics.push(
      { message: "The counting setting was ignored. For an action counted 'one', a click keeps only its earliest conversion of that action.", rows: compute({ noCounting: true }) },
      { message: "'One' was applied per visitor. It is one conversion per click: a visitor with two credited clicks can count two.", rows: compute({ perVisitor: true }) },
    );
  }

  const cCols = ["click_id", "campaign_id", "visitor_key", "click_ts"];
  const clickRows = clicks.slice().sort((a, b) => a.id - b.id).map((k) => [k.id, k.campaign, k.visitor, stamp(k.t)]);
  const vCols = ["conversion_id", "action_id", "visitor_key", "conv_ts", "order_id", "value_micros"];
  const convRows = convs.slice().sort((a, b) => a.id - b.id).map((c) => [c.id, c.action, c.visitor, stamp(c.t), c.order, c.value]);
  const campRows = camps.slice().sort((a, b) => (a.id < b.id ? -1 : 1)).map((c) => [c.id, c.name]);
  const aCols = ["action_id", "action_name", "window_days", "counting"];
  const aRows = actions.map((a) => [a.id, a.name, a.window, a.counting]);

  const setup =
    "SET TIME ZONE 'UTC';\n" +
    "CREATE TABLE campaigns (\n  campaign_id TEXT PRIMARY KEY,\n  campaign_name TEXT NOT NULL\n);\n" +
    "CREATE TABLE clicks (\n  click_id BIGINT PRIMARY KEY,\n  campaign_id TEXT NOT NULL REFERENCES campaigns (campaign_id),\n  visitor_key TEXT NOT NULL,\n  click_ts TIMESTAMPTZ NOT NULL\n);\n" +
    "CREATE TABLE conversion_actions (\n  action_id TEXT PRIMARY KEY,\n  action_name TEXT NOT NULL,\n  window_days INT NOT NULL CHECK (window_days > 0),\n  counting TEXT NOT NULL CHECK (counting IN ('one','every'))\n);\n" +
    "CREATE TABLE conversions (\n  conversion_id BIGINT PRIMARY KEY,\n  action_id TEXT NOT NULL REFERENCES conversion_actions (action_id),\n  visitor_key TEXT NOT NULL,\n  conv_ts TIMESTAMPTZ NOT NULL,\n  order_id TEXT,\n  value_micros BIGINT NOT NULL\n);\n" +
    insertSQL("campaigns", ["campaign_id", "campaign_name"], campRows) +
    insertSQL("conversion_actions", aCols, aRows) +
    insertSQL("clicks", cCols, clickRows) +
    insertSQL("conversions", vCols, convRows);

  const actText = actions.map((a) => `\`${a.id}\` (window ${a.window} day${a.window > 1 ? "s" : ""}, counting ${a.counting})`).join(", ");
  return {
    vars: {
      clicks: clickRows.length,
      conversions: convRows.length,
      actions: actText,
      dedup_rule: level === 1
        ? "Every row in this extract is a distinct conversion: there are no duplicate uploads."
        : "Uploads can repeat. Conversions of the same `action_id` with the same non-NULL `order_id` are one conversion: keep the earliest `conv_ts` (ties: the smaller `conversion_id`) and drop the other copies before attributing. A NULL `order_id` is never a duplicate of anything.",
      counting_rule: level === 3
        ? "An action whose `counting` is `every` counts every credited conversion. An action whose `counting` is `one` counts at most one conversion per click: the earliest credited one (ties: the smaller `conversion_id`); the click's later conversions of that action are not counted, and are not passed on to another click."
        : "Every action in this extract has `counting` = `every`: each credited conversion counts.",
    },
    setup,
    tables: [
      { name: "campaigns", columns: ["campaign_id", "campaign_name"], rows: campRows },
      { name: "conversion_actions", columns: aCols, rows: aRows },
      { name: "clicks", columns: cCols, rows: clickRows },
      { name: "conversions", columns: vCols, rows: convRows },
    ],
    expected: { columns: ["click_date", "campaign_id", "clicks", "conversions", "conversion_value_micros"], rows },
    diagnostics: diagnostics.filter((d) => JSON.stringify(d.rows) !== JSON.stringify(rows)),
  };
}
