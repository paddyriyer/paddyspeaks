/* GOO-L1-01 — Short clicks and long clicks on search results (SQL).
   Simulated practice scenario. All data is generated from the seed.

   Contract: see docs/COMPANY-INTERVIEW-LOOPS.md § Executable templates (sql).
   level: 1 Medium (dwell = time to the user's next event, a last click with no later event is long,
                    inclusive threshold, pages with no clicks kept)
          2 Hard (+ the next event can be a new search on another page, events in the same second)
          3 Very Hard (+ click events logged twice: dedupe before LEAD) */
import { insertSQL, ts } from "../../js/rng.js";

export const kind = "sql";

const DAY = "2026-09-23";
const QUERIES = ["best hiking boots", "how to tie a tie", "jupiter moons", "sourdough starter", "tax deadline", "usb c charger", "visa requirements japan", "weather tomorrow"];

export function generate(r, level) {
  const longS = r.pick([30, 60, 90]);
  const minPages = r.pick([2, 3]);
  const queries = r.sample(QUERIES, level === 1 ? 4 : 5);
  const nUsers = 8 + 2 * level + r.int(0, 2);

  const pages = [];     // {page_id, user, query}
  const events = [];    // {uidx, seq, page, ts, type, pos}
  const usedPage = new Set();
  for (let u = 0; u < nUsers; u++) {
    const user = "b_" + (4096 + r.int(0, 61439)).toString(16);
    let t = r.int(7 * 3600, 18 * 3600);
    let seq = 0;
    const nPages = level === 1 ? r.int(1, 2) : r.int(1, 3);
    let leftLast = false;
    for (let pi = 0; pi < nPages; pi++) {
      if (pi) {
        // Gap to the next search. Hard+: it can come soon after a click the user never returned from.
        if (leftLast && level >= 2) t += (u === 1 && pi === 1) ? r.int(3, longS - 1) : r.pick([r.int(3, longS - 1), longS, r.int(longS + 1, 900)]);
        else t += r.int(longS + 60, 1800);
      }
      let pid;
      do pid = "pg_" + r.int(10000, 99999); while (usedPage.has(pid));
      usedPage.add(pid);
      pages.push({ page_id: pid, user, query: r.pick(queries) });
      const push = (type, pos = null) => events.push({ uidx: u, seq: seq++, page: pid, user, ts: t, type, pos });
      push("serve");
      const plantExact = u === 0 && pi === 0;
      const nClicks = plantExact ? 2 : r.pick([0, 1, 1, 2, 3]);
      const positions = r.sample([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], nClicks);
      leftLast = false;
      for (let c = 0; c < nClicks; c++) {
        t += c > 0 && level >= 2 && r.chance(0.3) ? 0 : r.int(2, 25);   // Hard+: a click in the same second as the return
        push("click", positions[c]);
        const last = c === nClicks - 1;
        if (!last || r.chance(0.5)) {
          t += plantExact && c === 0 ? longS : r.pick([r.int(1, longS - 1), r.int(1, longS - 1), longS, r.int(longS + 1, 400)]);
          push("return");
        } else {
          leftLast = true;                                          // never came back to this page
        }
      }
      if (u === 1 && pi === 0 && level >= 2 && nPages > 1 && !leftLast) {
        // make sure user 1 leaves page 0 after a click, so a quick new search decides a dwell
        t += r.int(2, 25);
        push("click", r.int(1, 10));
        leftLast = true;
      }
    }
  }

  // event_id follows (event_ts, user, sequence): within a user, ties keep sequence order.
  events.sort((a, b) => a.ts - b.ts || a.uidx - b.uidx || a.seq - b.seq);
  let id = 300000 + r.int(0, 90000);
  for (const e of events) { id += r.int(1, 9); e.id = id; }
  // Very Hard: some clicks are logged twice; the copy has a later event_id.
  if (level === 3) {
    const clicks = events.filter((e) => e.type === "click");
    for (const e of r.sample(clicks, Math.max(2, Math.floor(clicks.length / 5)))) { id += r.int(1, 9); events.push({ ...e, id, dup: true }); }
  }

  const pageOf = new Map(pages.map((p) => [p.page_id, p]));
  const solve = (o = {}) => {
    const evs = events.filter((e) => o.noDedup || !e.dup);
    const byUser = new Map();
    for (const e of evs) {
      const key = o.samePage ? e.page : e.user;
      if (!byUser.has(key)) byUser.set(key, []);
      byUser.get(key).push(e);
    }
    const per = new Map(pages.map((p) => [p.page_id, { clicks: 0, short: 0, long: 0 }]));
    for (const list of byUser.values()) {
      list.sort((a, b) => a.ts - b.ts || a.id - b.id);
      list.forEach((e, i) => {
        if (e.type !== "click") return;
        const nx = list[i + 1];
        const isLong = nx ? (o.exclusive ? nx.ts - e.ts > longS : nx.ts - e.ts >= longS) : !o.unknownShort;
        const s = per.get(e.page);
        s.clicks++;
        if (isLong) s.long++; else s.short++;
      });
    }
    const q = new Map();
    for (const [pid, s] of per) {
      const query = pageOf.get(pid).query;
      if (!q.has(query)) q.set(query, { pages: 0, clicks: 0, short: 0, lp: 0 });
      const a = q.get(query);
      a.pages++; a.clicks += s.clicks; a.short += s.short;
      a.lp += o.countClicks ? s.long : s.long > 0 ? 1 : 0;
    }
    const rows = [];
    for (const [query, a] of q) {
      if (a.pages < minPages) continue;
      rows.push([query, a.pages, a.clicks, a.short, a.lp, Math.floor((a.lp * 20000 + a.pages) / (2 * a.pages)) / 10000]);
    }
    rows.sort((x, y) => x[5] - y[5] || (x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : 0));
    return rows;
  };
  const rows = solve();

  const diagnostics = [
    { message: `A dwell of exactly ${longS} seconds was treated as short. The threshold is inclusive: ${longS} seconds or more is a long click.`, rows: solve({ exclusive: true }) },
    { message: "A click with no later event was treated as short (or dropped). The searcher never came back: that is a long click.", rows: solve({ unknownShort: true }) },
    { message: "Long clicks were counted instead of pages with a long click.", rows: solve({ countClicks: true }) },
  ];
  if (level >= 2) diagnostics.push({ message: "Dwell was measured to the next event on the same page only. A new search by the same user also ends the dwell.", rows: solve({ samePage: true }) });
  if (level === 3) diagnostics.push({ message: "Duplicate click rows were kept. The first copy then 'ends' a moment later and looks like a short click. Keep one row per (page_id, event_type, event_ts, position).", rows: solve({ noDedup: true }) });

  const pCols = ["page_id", "user_id", "query"];
  const pRows = pages.map((p) => [p.page_id, p.user, p.query]).sort((a, b) => (a[0] < b[0] ? -1 : 1));
  const eCols = ["event_id", "page_id", "event_ts", "event_type", "position"];
  const eRows = events.slice().sort((a, b) => a.id - b.id).map((e) => [e.id, e.page, ts(DAY, e.ts), e.type, e.pos]);
  const setup =
    "SET TIME ZONE 'UTC';\n" +
    "CREATE TABLE results_pages (\n  page_id TEXT PRIMARY KEY,\n  user_id TEXT NOT NULL,\n  query TEXT NOT NULL\n);\n" +
    "CREATE TABLE page_events (\n  event_id BIGINT PRIMARY KEY,\n  page_id TEXT NOT NULL REFERENCES results_pages(page_id),\n  event_ts TIMESTAMPTZ NOT NULL,\n  event_type TEXT NOT NULL CHECK (event_type IN ('serve','click','return')),\n  position INT\n);\n" +
    insertSQL("results_pages", pCols, pRows) + insertSQL("page_events", eCols, eRows);

  return {
    vars: {
      long_s: longS,
      min_pages: minPages,
      pages: pages.length,
      events: events.length,
      next_rule: level === 1
        ? "In this sample each user's pages are far apart, but the rule is the same."
        : "A user can search again without returning: the next event may be the `serve` of a new page, and it ends the dwell just the same. A `return` and the next click can share a second; `event_id` gives their order.",
      dup_rule: level === 3
        ? "The click logger sometimes writes a click twice: rows with the same `page_id`, `event_type`, `event_ts` and `position` are one event (keep the lowest `event_id`)."
        : "Each event is logged once.",
    },
    setup,
    tables: [
      { name: "results_pages", columns: pCols, rows: pRows },
      { name: "page_events", columns: eCols, rows: eRows },
    ],
    expected: { columns: ["query", "pages", "clicks", "short_clicks", "long_click_pages", "long_click_rate"], rows },
    diagnostics: diagnostics.filter((d) => JSON.stringify(d.rows) !== JSON.stringify(rows)),
  };
}
