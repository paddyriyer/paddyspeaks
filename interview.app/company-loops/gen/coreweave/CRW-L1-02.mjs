/* CRW-L1-02 — SLA credits per customer cluster and month (SQL).
   Simulated practice scenario. All data is generated from the seed; the SLA target,
   the notice period and the credit tiers are this exercise's hypothetical rules.

   Contract: generate(r, level) -> { vars, setup, tables, expected, diagnostics }.
   The oracle below marks unavailable node-minutes in JavaScript sets; the evaluator's
   reference SQL is written independently and must return the same rows.
   level: 1 Medium (September only, one record per outage, maintenance announced early
          or late) · 2 Hard (+ October, outages crossing month boundaries, overlapping
          records of one outage from two monitors) · 3 Very Hard (+ a window announced
          exactly at the notice limit, a cluster exactly at the SLA target, another
          cluster's maintenance overlapping an outage) */
import { insertSQL, pad2 } from "../../js/rng.js";

export const kind = "sql";

const BASE = Date.UTC(2026, 8, 1);                 // 2026-09-01 00:00 UTC = minute 0
const SEP = [0, 30 * 1440];
const OCT = [30 * 1440, 61 * 1440];
const CUSTOMERS = ["cust-aurora", "cust-basalt", "cust-cirrus", "cust-dune", "cust-ember", "cust-flint", "cust-gale"];

function stamp(min) {
  const d = new Date(BASE + min * 60000);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())} ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}:00+00`;
}

export function generate(r, level) {
  const sla = r.pick(["99.9", "99.95", "99.5"]);
  const slaMilli = Math.round(Number(sla) * 1000);
  const noticeHours = r.pick([48, 72, 120]);
  const notice = noticeHours * 60;
  const months = level === 1 ? [SEP] : [SEP, OCT];
  const nClusters = level === 1 ? 3 : level === 2 ? 4 : 5;
  const customers = r.sample(CUSTOMERS, nClusters);

  const clusters = [];
  const outages = [];       // {id, cluster, node, s, e}   minutes, end exclusive
  const windows = [];       // {id, cluster, s, e, ann}
  let oid = 5000 + r.int(0, 3000);
  let wid = 300 + r.int(0, 300);

  const busy = new Map();   // node -> [[s, e)] so records on one node never overlap (before duplicates)
  const free = (node, s, e) => (busy.get(node) || []).every(([a, b]) => e <= a || s >= b);
  const addOutage = (c, node, s, e) => {
    if (!busy.has(node)) busy.set(node, []);
    busy.get(node).push([s, e]);
    const o = { id: "out-" + oid++, cluster: c.id, node, s, e };
    outages.push(o);
    return o;
  };
  const randomOutages = (c, budget, lo, hi, maxDur) => {
    let left = budget;
    for (let guard = 0; left > 0 && guard < 400; guard++) {
      const node = r.pick(c.nodes);
      const d = Math.min(left, r.int(20, maxDur));
      const s = r.int(lo, hi - d);
      if (!free(node, s, s + d)) continue;
      addOutage(c, node, s, s + d);
      left -= d;
    }
  };

  // Band per cluster: how much downtime it gets, as a share of its node-minutes.
  const gap = (100000 - slaMilli) / 100000;          // allowed unavailable share
  const bands = [0.4 * gap, (gap + 0.01) / 2, 0.025, r.pick([0.2 * gap, 0.06, (gap + 0.01) / 2]), null];
  for (let i = 0; i < nClusters; i++) {
    const exact = level === 3 && i === nClusters - 1;
    const nodes = exact ? r.pick([10, 20]) : r.pick([4, 6, 8, 12]);
    const id = `cl-${customers[i].slice(5, 9)}-${r.int(10, 99)}`;
    const c = { id, customer: customers[i], n: nodes, nodes: Array.from({ length: nodes }, (_, k) => `${id}-n${pad2(k + 1)}`), exact };
    clusters.push(c);
    if (exact) continue;
    for (const [lo, hi] of months) {
      const nm = nodes * (hi - lo);
      const share = months.length > 1 && lo === OCT[0] ? r.pick([0, 0.3 * gap, 0.02]) : bands[i];
      randomOutages(c, Math.round(nm * share), lo + 120, hi - 120, Math.max(60, Math.round((nm * share) / 3)));
    }
  }

  // Maintenance: per cluster one window announced in advance and usually one announced
  // late, each placed across part of one of the cluster's outages.
  const addWindow = (c, s, e, ann) => windows.push({ id: "mw-" + wid++, cluster: c.id, s, e, ann });
  for (const c of clusters) {
    if (c.exact) continue;
    const own = outages.filter((o) => o.cluster === c.id);
    if (!own.length) continue;
    const a = r.pick(own);
    const s1 = a.s + r.int(-30, Math.max(0, Math.floor((a.e - a.s) / 2)));
    addWindow(c, s1, s1 + r.int(60, 240), s1 - notice - r.int(1, 72) * 60);
    if (r.chance(0.75) || level === 1) {
      const b = r.pick(own);
      const s2 = b.s + r.int(0, Math.max(0, Math.floor((b.e - b.s) / 2)));
      addWindow(c, s2, s2 + r.int(60, 180), s2 - r.int(60, notice - 60));
    }
  }

  if (level >= 2) {
    // Outages crossing month boundaries, and a second monitor's overlapping record.
    const c = clusters[0], c2 = clusters[1];
    const n1 = c.nodes.find((n) => free(n, -180, 150)) || c.nodes[0];
    addOutage(c, n1, -r.int(60, 180), r.int(30, 150));                      // from August into September
    const n2 = c2.nodes.find((n) => free(n, OCT[0] - 200, OCT[0] + 300)) || c2.nodes[0];
    addOutage(c2, n2, OCT[0] - r.int(60, 200), OCT[0] + r.int(40, 300));     // September into October
    for (const o of r.sample(outages.filter((x) => x.e - x.s >= 40), 2)) {
      const shift = r.int(5, Math.floor((o.e - o.s) / 2));
      outages.push({ id: "out-" + oid++, cluster: o.cluster, node: o.node, s: o.s + shift, e: o.e + r.int(0, 25) });
    }
  }

  if (level === 3) {
    // A window announced exactly noticeHours before it starts counts as announced in advance.
    const c = clusters[1];
    const o = r.pick(outages.filter((x) => x.cluster === c.id && x.s >= SEP[0] && x.e <= SEP[1]));
    if (o) addWindow(c, o.s + 5, o.s + 5 + r.int(60, 120), o.s + 5 - notice);
    // Another cluster's advance window during an outage of clusters[2]: it does not apply.
    const t = outages.find((x) => x.cluster === clusters[2].id && x.s >= SEP[0] && x.e <= SEP[1]);
    if (t) addWindow(clusters[0], t.s, t.e, t.s - notice - 600);
    // The cluster exactly at the SLA target in September.
    const ex = clusters[nClusters - 1];
    let need = (ex.n * (SEP[1] - SEP[0]) * (100000 - slaMilli)) / 100000;   // an integer: n is a multiple of 5
    const parts = r.int(2, 3);
    for (let k = 0; k < parts; k++) {
      const d = k === parts - 1 ? need : Math.floor(need / (parts - k)) + r.int(0, 9);
      const s = r.int(2, 26) * 1440 + r.int(0, 600);
      addOutage(ex, ex.nodes[k], s, s + d);
      need -= d;
    }
    const ws = 28 * 1440 + r.int(0, 600);
    addWindow(ex, ws, ws + 120, ws - notice - 1440);                          // touches no outage
  }

  // ---- Oracle -----------------------------------------------------------------------
  const qualifies = (w, o) => (o.strictNotice ? w.s - w.ann > notice : w.s - w.ann >= notice);
  const compute = (o = {}) => {
    const rows = [];
    const unav = new Map();     // cluster|monthStart -> node-minutes
    const seen = new Set();
    for (const out of outages) {
      const ws = windows.filter((w) => (o.crossCluster || w.cluster === out.cluster) && (o.allMaint || (!o.noMaint && qualifies(w, o))));
      for (let m = out.s; m < out.e; m++) {
        if (ws.some((w) => m >= w.s && m < w.e)) continue;
        const key = out.node + "|" + m;
        if (!o.dupCount && seen.has(key)) continue;
        seen.add(key);
        const at = o.startMonth ? out.s : m;
        const mo = months.find(([lo, hi]) => at >= lo && at < hi);
        if (!mo) continue;
        const k = out.cluster + "|" + mo[0];
        unav.set(k, (unav.get(k) || 0) + 1);
      }
    }
    for (const [lo, hi] of months) {
      for (const c of clusters.slice().sort((a, b) => (a.id < b.id ? -1 : 1))) {
        const nm = c.n * (hi - lo);
        const u = unav.get(c.id + "|" + lo) || 0;
        const pct = Math.floor((200000 * (nm - u) + nm) / (2 * nm)) / 1000;
        const up = (nm - u) * 100000;
        const meets = o.strictSla ? up > slaMilli * nm : up >= slaMilli * nm;
        const credit = meets ? 0 : up >= 99000 * nm ? 10 : up >= 95000 * nm ? 25 : 50;
        rows.push([lo === 0 ? "2026-09-01" : "2026-10-01", c.id, c.customer, nm, u, pct, credit]);
      }
    }
    return rows;
  };
  const rows = compute();

  const diagnostics = [
    { message: "Maintenance was ignored. Minutes inside a maintenance window announced at least the notice period in advance are not unavailability.", rows: compute({ noMaint: true }) },
    { message: "Every maintenance window was excluded. A window announced less than the notice period before it starts still counts as unavailability.", rows: compute({ allMaint: true }) },
  ];
  if (level >= 2) {
    diagnostics.push({ message: "Overlapping outage records for one node were added together. A node-minute is unavailable once, however many records cover it.", rows: compute({ dupCount: true }) });
    diagnostics.push({ message: "Each outage was counted in the month it started. Split outages at month boundaries: every node-minute belongs to its own month.", rows: compute({ startMonth: true }) });
  }
  if (level === 3) {
    diagnostics.push({ message: "A window announced exactly the notice period in advance was treated as late. Exactly the notice period counts as in advance.", rows: compute({ strictNotice: true }) });
    diagnostics.push({ message: "Availability exactly at the SLA target earned a credit. Meeting the target exactly is not a breach.", rows: compute({ strictSla: true }) });
    diagnostics.push({ message: "A maintenance window was applied to another cluster's outage. Maintenance excludes minutes only for its own cluster.", rows: compute({ crossCluster: true }) });
  }

  // ---- Tables -------------------------------------------------------------------------
  const cCols = ["cluster_id", "customer_id", "node_count"];
  const cRows = clusters.slice().sort((a, b) => (a.id < b.id ? -1 : 1)).map((c) => [c.id, c.customer, c.n]);
  const oCols = ["outage_id", "cluster_id", "node_name", "started_at", "ended_at"];
  const oRows = outages.slice().sort((a, b) => a.s - b.s || (a.id < b.id ? -1 : 1)).map((o) => [o.id, o.cluster, o.node, stamp(o.s), stamp(o.e)]);
  const wCols = ["window_id", "cluster_id", "starts_at", "ends_at", "announced_at"];
  const wRows = windows.slice().sort((a, b) => a.s - b.s || (a.id < b.id ? -1 : 1)).map((w) => [w.id, w.cluster, stamp(w.s), stamp(w.e), stamp(w.ann)]);

  const setup =
    "SET TIME ZONE 'UTC';\n" +
    "CREATE TABLE clusters (\n  cluster_id TEXT PRIMARY KEY,\n  customer_id TEXT NOT NULL,\n  node_count INT NOT NULL\n);\n" +
    "CREATE TABLE node_outages (\n  outage_id TEXT PRIMARY KEY,\n  cluster_id TEXT NOT NULL REFERENCES clusters(cluster_id),\n  node_name TEXT NOT NULL,\n  started_at TIMESTAMPTZ NOT NULL,\n  ended_at TIMESTAMPTZ NOT NULL CHECK (ended_at > started_at)\n);\n" +
    "CREATE TABLE maintenance_windows (\n  window_id TEXT PRIMARY KEY,\n  cluster_id TEXT NOT NULL REFERENCES clusters(cluster_id),\n  starts_at TIMESTAMPTZ NOT NULL,\n  ends_at TIMESTAMPTZ NOT NULL CHECK (ends_at > starts_at),\n  announced_at TIMESTAMPTZ NOT NULL\n);\n" +
    insertSQL("clusters", cCols, cRows) + insertSQL("node_outages", oCols, oRows) + insertSQL("maintenance_windows", wCols, wRows);

  return {
    vars: {
      sla,
      notice_hours: noticeHours,
      last_month: level === 1 ? "2026-09-01" : "2026-10-01",
      report_months: level === 1 ? "September 2026" : "September and October 2026",
      months_rule: level === 1
        ? "The report covers September 2026 only, and every outage in the data lies inside September."
        : "The report covers September and October 2026. An outage can start before the report or cross from one month into the next; only its minutes inside a reported month count there.",
      dup_rule: level === 1
        ? "Outage records for one node never overlap."
        : "Two monitors can both record the same failure, so records for one node can overlap. A node-minute is unavailable once, however many records cover it.",
      outages: outages.length,
    },
    setup,
    tables: [
      { name: "clusters", columns: cCols, rows: cRows },
      { name: "node_outages", columns: oCols, rows: oRows },
      { name: "maintenance_windows", columns: wCols, rows: wRows },
    ],
    expected: { columns: ["month", "cluster_id", "customer_id", "node_minutes", "unavailable_node_minutes", "availability_pct", "credit_pct"], rows },
    diagnostics: diagnostics.filter((d) => JSON.stringify(d.rows) !== JSON.stringify(rows)),
  };
}
