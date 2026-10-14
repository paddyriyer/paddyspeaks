/* APL-L1-01 — Product page conversion by storefront and traffic source (SQL).
   Simulated practice scenario. All data is generated from the seed. Traffic sources,
   the attribution rule and every number are hypothetical, stated in the problem.

   Contract: see docs/COMPANY-INTERVIEW-LOOPS.md § Executable templates (sql).
   level: 1 Medium (first-time downloads only; credit the account's last view of the page
            in the same storefront at or before the download; distinct viewers)
          2 Hard (+ an attribution window in hours, inclusive; a download in another
            storefront makes a later one a re-download; a view in the download's second)
          3 Very Hard (+ the same download logged twice in one second; two views in one
            second broken by view_id; a minimum-viewers floor) */
import { insertSQL } from "../../js/rng.js";

export const kind = "sql";

const APPS = ["app_budgetbook", "app_hikingmaps", "app_journal", "app_puzzlequest", "app_recipebox", "app_stargazer"];
const STORES = ["AU", "BR", "DE", "FR", "GB", "IN", "JP", "US"];
const SOURCES = ["app_referrer", "browse", "search", "web_referrer"];
const BASE = Date.UTC(2026, 8, 7);                         // 2026-09-07 00:00:00 UTC
const pad = (n) => String(n).padStart(2, "0");
function at(t) {
  const d = new Date(BASE + t * 1000);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}+00`;
}

export function generate(r, level) {
  const apps = r.sample(APPS, level === 3 ? 3 : 2).sort();
  const stores = r.sample(STORES, level === 1 ? 1 : 2).sort();
  const sources = r.sample(SOURCES, level === 1 ? 3 : 4).sort();
  const windowH = level === 1 ? 0 : r.pick([24, 48, 72]);
  const W = windowH * 3600;
  const minViewers = level === 3 ? r.pick([3, 4]) : 1;
  const nAccounts = 12 + 4 * level;

  const views = [];       // {id, acct, app, store, source, t}
  const dls = [];         // {id, acct, app, store, t}
  let viewId = 4000 + r.int(0, 3000);
  let dlId = 70000 + r.int(0, 20000);
  const accts = new Set();
  while (accts.size < nAccounts) accts.add("acct_" + r.int(10000, 99999));

  for (const acct of [...accts]) {
    const home = r.pick(stores);
    for (const app of r.sample(apps, r.int(1, apps.length))) {
      let t = r.int(0, 3 * 86400);
      const mine = [];
      const nv = r.int(1, 3);
      for (let i = 0; i < nv; i++) {
        mine.push({ id: (viewId += r.int(1, 3)), acct, app, store: home, source: r.pick(sources), t });
        t += r.int(600, 20 * 3600);
      }
      const last = mine[mine.length - 1];
      // Very Hard: a second view in the same second as the last one, from another source.
      if (level === 3 && r.chance(0.3)) {
        const other = sources.filter((s) => s !== last.source);
        mine.push({ id: (viewId += r.int(1, 3)), acct, app, store: home, source: r.pick(other), t: last.t });
      }
      views.push(...mine);
      // Hard+: an earlier download in another storefront makes every later one a re-download.
      if (level >= 2 && stores.length > 1 && r.chance(0.15)) {
        dls.push({ id: (dlId += r.int(1, 9)), acct, app, store: stores.find((s) => s !== home), t: Math.max(0, mine[0].t - r.int(86400, 2 * 86400)) });
      }
      const u = r.next();
      let dlT = null;
      if (u < 0.3) dlT = null;                                                    // viewed, did not download
      else if (u < 0.4) dlT = Math.max(0, mine[0].t - r.int(60, 7200));           // downloaded before any view
      else if (u < 0.5 && mine.length > 1) dlT = mine[0].t + r.int(1, mine[1].t - mine[0].t - 1); // between views
      else {
        const lastT = last.t;
        if (level === 1) dlT = lastT + r.pick([0, r.int(30, 3600), r.int(3600, 4 * 86400)]);
        else dlT = lastT + r.pick([0, r.int(30, 3600), W, W + 1, W + r.int(3600, 86400), r.int(60, W - 1)]);
      }
      if (dlT !== null) {
        const d = { id: (dlId += r.int(1, 9)), acct, app, store: home, t: dlT };
        dls.push(d);
        if (level === 3 && r.chance(0.25)) dls.push({ ...d, id: (dlId += r.int(1, 9)) });   // logged twice
        if (r.chance(0.3)) {
          // A re-download days later, after another look at the page.
          const t2 = dlT + r.int(2 * 86400, 5 * 86400);
          views.push({ id: (viewId += r.int(1, 3)), acct, app, store: home, source: r.pick(sources), t: t2 - r.int(60, 3600) });
          dls.push({ id: (dlId += r.int(1, 9)), acct, app, store: home, t: t2 });
        }
      }
    }
  }
  // Very Hard: make sure some group clears the floor (a few accounts browsing one page).
  if (level === 3) {
    const app = apps[0], store = stores[0], source = sources[0];
    for (let i = 0; i < minViewers; i++) {
      const acct = "acct_" + r.int(100000, 199999);
      const t = r.int(0, 4 * 86400);
      views.push({ id: (viewId += r.int(1, 3)), acct, app, store, source, t });
      if (i === 0) dls.push({ id: (dlId += r.int(1, 9)), acct, app, store, t: t + r.int(60, 3600) });
    }
  }

  const cmp = (x, y) => (x < y ? -1 : x > y ? 1 : 0);
  const share = (n, d) => Math.floor((n * 20000 + d) / (2 * d)) / 10000;

  const solve = (o = {}) => {
    // First-time downloads: the earliest per account and app (time, then id), over every storefront.
    const byKey = new Map();
    for (const d of dls) {
      const k = d.acct + "|" + d.app + (o.storeScoped ? "|" + d.store : "");
      if (!byKey.has(k)) byKey.set(k, []);
      byKey.get(k).push(d);
    }
    const first = [];
    for (const list of byKey.values()) {
      if (o.allDownloads) { first.push(...list); continue; }
      const minT = Math.min(...list.map((d) => d.t));
      if (o.strictEarlier) { first.push(...list.filter((d) => d.t === minT)); continue; }
      list.sort((a, b) => a.t - b.t || a.id - b.id);
      first.push(list[0]);
    }
    const credit = new Map();
    for (const d of first) {
      let best = null;
      for (const v of views) {
        if (v.acct !== d.acct || v.app !== d.app || v.store !== d.store || v.t > d.t) continue;
        if (W && !o.noWindow && (o.strictWindow ? d.t - v.t >= W : d.t - v.t > W)) continue;
        if (!best) { best = v; continue; }
        if (o.firstTouch) { if (v.t < best.t || (v.t === best.t && v.id < best.id)) best = v; }
        else if (v.t > best.t || (v.t === best.t && (o.tieLow ? v.id < best.id : v.id > best.id))) best = v;
      }
      if (best) {
        const k = [d.app, d.store, best.source].join("|");
        credit.set(k, (credit.get(k) || 0) + 1);
      }
    }
    const seen = new Map();
    for (const v of views) {
      const k = [v.app, v.store, v.source].join("|");
      if (!seen.has(k)) seen.set(k, o.viewsNotViewers ? [] : new Set());
      if (o.viewsNotViewers) seen.get(k).push(v.id); else seen.get(k).add(v.acct);
    }
    const floor = o.noFloor ? 1 : minViewers;
    return [...seen.entries()].sort((a, b) => cmp(a[0], b[0])).map(([k, s]) => {
      const n = o.viewsNotViewers ? s.length : s.size;
      const c = credit.get(k) || 0;
      return [...k.split("|"), n, c, share(c, n)];
    }).filter((row) => row[3] >= floor);
  };
  const rows = solve();

  const diagnostics = [
    { message: "Re-downloads were counted. Only an account's first download of an app (earliest downloaded_at, then lowest download_id) is a conversion.", rows: solve({ allDownloads: true }) },
    { message: "Downloads were credited to the account's first view of the page. Credit goes to the last view at or before the download.", rows: solve({ firstTouch: true }) },
    { message: "The denominator counts page views, not distinct viewers. An account that viewed the page three times from one source is one viewer.", rows: solve({ viewsNotViewers: true }) },
  ];
  if (level >= 2) {
    diagnostics.push({ message: `The attribution window was ignored. A view more than ${windowH} hours before the download earns no credit.`, rows: solve({ noWindow: true }) });
    diagnostics.push({ message: `The window was treated as exclusive. A view exactly ${windowH} hours before the download still earns the credit.`, rows: solve({ strictWindow: true }) });
    diagnostics.push({ message: "Re-downloads were detected within one storefront only. A download in any storefront makes the account's later downloads of the app re-downloads.", rows: solve({ storeScoped: true }) });
  }
  if (level === 3) {
    diagnostics.push({ message: "A download logged twice in the same second was counted twice. Only one row can be the first download: break the tie by download_id.", rows: solve({ strictEarlier: true }) });
    diagnostics.push({ message: "Two views in the same second were tie-broken the wrong way. The higher view_id is the later view.", rows: solve({ tieLow: true }) });
    diagnostics.push({ message: `The minimum-viewers floor was not applied. Groups with fewer than ${minViewers} viewers are left out.`, rows: solve({ noFloor: true }) });
  }

  const vCols = ["view_id", "account_id", "app_id", "storefront", "source", "viewed_at"];
  const vRows = views.slice().sort((a, b) => a.id - b.id).map((v) => [v.id, v.acct, v.app, v.store, v.source, at(v.t)]);
  const dCols = ["download_id", "account_id", "app_id", "storefront", "downloaded_at"];
  const dRows = dls.slice().sort((a, b) => a.id - b.id).map((d) => [d.id, d.acct, d.app, d.store, at(d.t)]);
  const setup =
    "SET TIME ZONE 'UTC';\n" +
    "CREATE TABLE page_views (\n  view_id BIGINT PRIMARY KEY,\n  account_id TEXT NOT NULL,\n  app_id TEXT NOT NULL,\n  storefront TEXT NOT NULL,\n  source TEXT NOT NULL,\n  viewed_at TIMESTAMPTZ NOT NULL\n);\n" +
    "CREATE TABLE downloads (\n  download_id BIGINT PRIMARY KEY,\n  account_id TEXT NOT NULL,\n  app_id TEXT NOT NULL,\n  storefront TEXT NOT NULL,\n  downloaded_at TIMESTAMPTZ NOT NULL\n);\n" +
    insertSQL("page_views", vCols, vRows) + insertSQL("downloads", dCols, dRows);

  return {
    vars: {
      views: views.length,
      downloads: dls.length,
      window_h: windowH,
      min_viewers: minViewers,
      window_rule: level === 1
        ? "There is no attribution window in this round: any earlier view of the page in that storefront can earn the credit."
        : `The credited view must be at most ${windowH} hours before the download (inclusive: exactly ${windowH} hours still counts); if the last earlier view is older, the download is unattributed.`,
      redownload_rule: level === 1
        ? "Every account in this sample uses one storefront."
        : "Accounts can download in more than one storefront: a first download in one storefront makes every later download of that app by the account a re-download, wherever it happens.",
      floor_rule: level === 3
        ? `Return only groups with at least ${minViewers} viewers. The same download can be logged twice with the same \`downloaded_at\`; only one of those rows (the lower \`download_id\`) can be the first download. Two views in the same second are ordered by \`view_id\`: the higher one is the later view.`
        : "Return every group with at least one viewer.",
    },
    setup,
    tables: [
      { name: "page_views", columns: vCols, rows: vRows },
      { name: "downloads", columns: dCols, rows: dRows },
    ],
    expected: { columns: ["app_id", "storefront", "source", "viewers", "downloads", "conversion_rate"], rows },
    diagnostics: diagnostics.filter((d) => JSON.stringify(d.rows) !== JSON.stringify(rows)),
  };
}
