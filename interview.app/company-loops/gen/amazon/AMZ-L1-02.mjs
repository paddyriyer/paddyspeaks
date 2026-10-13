/* AMZ-L1-02 — Package scan silences: the longest stretch with no scan (SQL).
   Simulated practice scenario. All data is generated from the seed and is hypothetical.

   Contract: see docs/COMPANY-INTERVIEW-LOOPS.md § Executable templates (sql).
   Per package, the scans that count run from the first carrier scan (anything but
   LABEL_CREATED) up to and including the first DELIVERED scan, ordered by
   (scanned_at, scan_id). A silence is the time between two consecutive counted scans;
   for an undelivered package (Very Hard) the time from its last scan to as_of is one too.
   level: 1 Medium (label-to-pickup waits that must not count, an inclusive threshold)
          2 Hard (+ scans after delivery, equal longest silences (earliest wins), duplicate scans)
          3 Very Hard (+ undelivered packages with an open silence up to as_of, packages
                       that only have a label) */
import { insertSQL } from "../../js/rng.js";

export const kind = "sql";

const FACILITIES = ["STN-ALDER-2", "SORT-BASIN-1", "FC-CEDAR-5", "SORT-DELTA-3", "STN-EMBER-8", "FC-GRANITE-6", "STN-HOLLOW-4"];
const BASES = ["2026-09-03", "2026-09-17", "2026-10-01", "2026-10-15"];
const H = 3600;
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const fmt = (ms) => new Date(ms).toISOString().replace("T", " ").replace(/\.\d+Z$/, "+00");

export function generate(r, level) {
  const T = r.pick([12, 18, 24]);
  const base = Date.parse(r.pick(BASES) + "T00:00:00Z") / 1000;   // seconds
  const asOf = base + 14 * 86400 + r.pick([0, 6, 12]) * H;
  const facilities = r.sample(FACILITIES, 5);
  const nPk = (level === 1 ? 7 : level === 2 ? 9 : 11) + r.int(0, 1);

  const plans = ["silent", "exact", "just_under", "quiet"];
  if (level >= 2) plans.push("post_delivery", "tie", "dup");
  if (level === 3) plans.push("open_silent", "open_quiet", "label_only", "open_beats_closed");
  while (plans.length < nPk) plans.push(r.pick(["quiet", "silent", "quiet", ...(level >= 2 ? ["tie", "post_delivery"] : [])]));
  const order = r.shuffle(plans);

  const pkgIds = r.shuffle([...Array(300)].map((_, i) => 7300000 + i * 53 + r.int(0, 50))).slice(0, order.length);
  let scanSeq = 41000000 + r.int(0, 900000);
  const scans = [];
  const normalGap = () => r.int(20 * 60, (T - 2) * H);
  const bigGap = () => T * H + r.int(600, 20 * H);

  order.forEach((plan, i) => {
    const pkg = "TBA" + pkgIds[i];
    const open = plan.startsWith("open");
    // Gaps between consecutive carrier scans; one may be special.
    const k = r.int(3, level === 1 ? 4 : 5);
    const gaps = [...Array(k)].map(normalGap);
    const pos = r.int(0, k - 1);
    if (plan === "silent" || plan === "post_delivery" || plan === "dup") gaps[pos] = bigGap();
    if (plan === "exact") gaps[pos] = T * H;
    if (plan === "just_under") gaps[pos] = T * H - r.int(1, 900);
    if (plan === "tie") {
      const g = bigGap();
      const p2 = (pos + 1 + r.int(0, k - 2)) % k;
      gaps[pos] = g;
      gaps[p2] = g;
    }
    let openGap = null;
    if (plan === "open_silent") openGap = bigGap();
    if (plan === "open_quiet") openGap = r.int(H, (T - 3) * H);
    if (plan === "open_beats_closed") { gaps[pos] = T * H + r.int(60, 3 * H); openGap = gaps[pos] + r.int(2 * H, 10 * H); }

    const labelWait = r.chance(0.7) ? T * H + r.int(2 * H, 30 * H) : r.int(H, 6 * H);   // seller has not handed over yet
    const journey = gaps.reduce((a, b) => a + b, 0);
    let t0;
    if (open) t0 = asOf - openGap - journey - labelWait;
    else t0 = base + r.int(0, 3 * 86400);
    if (plan === "label_only") {
      scans.push({ id: scanSeq++, pkg, type: "LABEL_CREATED", fac: "SHIPPER", t: asOf - r.int(2, 6) * 86400 });
      return;
    }
    scans.push({ id: scanSeq++, pkg, type: "LABEL_CREATED", fac: "SHIPPER", t: t0 });
    let t = t0 + labelWait;
    const types = ["PICKED_UP"];
    for (let j = 1; j < k; j++) types.push(j % 2 ? "ARRIVED" : "DEPARTED");
    types.push(open ? "ARRIVED" : "OUT_FOR_DELIVERY");
    let fac = r.pick(facilities);
    for (let j = 0; j <= k; j++) {
      if (types[j] === "ARRIVED") fac = r.pick(facilities.filter((f) => f !== fac));
      scans.push({ id: scanSeq++, pkg, type: types[j], fac, t });
      if (plan === "dup" && j === pos) scans.push({ id: scanSeq++, pkg, type: types[j], fac, t });   // the same scan uploaded twice
      if (j < k) t += gaps[j];
    }
    if (!open) {
      t += r.int(15 * 60, 5 * H);
      scans.push({ id: scanSeq++, pkg, type: "DELIVERED", fac, t });
      if (plan === "post_delivery" || (level >= 2 && r.chance(0.2))) {
        scans.push({ id: scanSeq++, pkg, type: "RETURN_PICKUP", fac, t: t + r.int(2, 5) * 86400 + r.int(0, 8 * H) });
      }
    }
  });

  // ---- oracle ---------------------------------------------------------------
  const compute = (opt = {}) => {
    const by = {};
    for (const s of scans) (by[s.pkg] ||= []).push(s);
    const out = [];
    for (const [pkg, list] of Object.entries(by)) {
      const ss = list.slice().sort((a, b) => a.t - b.t || a.id - b.id);
      const start = opt.includeLabel ? 0 : ss.findIndex((s) => s.type !== "LABEL_CREATED");
      if (start < 0) continue;
      const di = ss.findIndex((s) => s.type === "DELIVERED");
      const delivered = di >= 0;
      const end = delivered && !opt.afterDelivery ? di : ss.length - 1;
      const gaps = [];
      for (let j = start; j < end; j++) gaps.push({ secs: ss[j + 1].t - ss[j].t, from: ss[j], fac: opt.endFacility ? ss[j + 1].fac : ss[j].fac });
      if (!delivered && !opt.noOpen) gaps.push({ secs: asOf - ss[end].t, from: ss[end], fac: opt.endFacility ? null : ss[end].fac });
      if (!gaps.length) continue;
      let best = gaps[0];
      for (const g of gaps) if (g.secs > best.secs || (opt.latestTie && g.secs === best.secs)) best = g;
      if (best.secs < T * H) continue;
      out.push({ secs: best.secs, row: [pkg, delivered, fmt(best.from.t * 1000), best.fac, Math.floor((2 * best.secs + 36) / 72) / 100] });
    }
    return out.sort((a, b) => b.secs - a.secs || cmp(a.row[0], b.row[0])).map((x) => x.row);
  };
  const rows = compute();

  const diagnostics = [
    { message: "The wait from LABEL_CREATED to the first carrier scan was counted. Until the carrier scans the parcel the shipper still has it; the network's silences start at the first carrier scan.", rows: compute({ includeLabel: true }) },
    { message: "The silence was attributed to the facility that scanned the parcel next. The parcel went quiet at the facility of the scan before the gap.", rows: compute({ endFacility: true }) },
  ];
  if (level >= 2) {
    diagnostics.push({ message: "Scans after the first DELIVERED scan were included. A return pickup days later is a new journey, not a silence in this one: stop at the first DELIVERED scan.", rows: compute({ afterDelivery: true }) });
    diagnostics.push({ message: "When two silences tie for the longest, the later one was reported. Report the earliest (order by scanned_at, then scan_id).", rows: compute({ latestTie: true }) });
  }
  if (level === 3) {
    diagnostics.push({ message: "Undelivered packages only counted the silences between scans. A parcel that has not been scanned since Tuesday is silent now: measure from its last scan to as_of too.", rows: compute({ noOpen: true }) });
  }

  const cols = ["scan_id", "package_id", "scan_type", "facility_id", "scanned_at"];
  const tableRows = scans.slice().sort((a, b) => a.t - b.t || a.id - b.id).map((s) => [s.id, s.pkg, s.type, s.fac, fmt(s.t * 1000)]);
  const types = "'LABEL_CREATED','PICKED_UP','ARRIVED','DEPARTED','OUT_FOR_DELIVERY','DELIVERED'" + (level >= 2 ? ",'RETURN_PICKUP'" : "");
  const setup =
    "SET TIME ZONE 'UTC';\n" +
    `CREATE TABLE package_scans (\n  scan_id BIGINT PRIMARY KEY,\n  package_id TEXT NOT NULL,\n  scan_type TEXT NOT NULL CHECK (scan_type IN (${types})),\n  facility_id TEXT NOT NULL,     -- 'SHIPPER' for LABEL_CREATED\n  scanned_at TIMESTAMPTZ NOT NULL\n);\n` +
    insertSQL("package_scans", cols, tableRows);

  return {
    vars: {
      min_hours: T,
      as_of: fmt(asOf * 1000),
      n_scans: scans.length,
      n_packages: order.length,
      end_rule:
        level === 1
          ? "Every package in the sample has been delivered, and its DELIVERED scan is its last scan."
          : level === 2
            ? "Every package in the sample has been delivered. Some have scans after delivery (a return pickup): those belong to a different journey and are ignored."
            : "Some packages have not been delivered yet: their last silence runs from their last scan to `as_of`. Scans after a package's first DELIVERED scan (a return pickup) are ignored, and a package with no carrier scan at all is not reported.",
    },
    setup,
    tables: [{ name: "package_scans", columns: cols, rows: tableRows }],
    expected: { columns: ["package_id", "delivered", "gap_started_at", "facility_id", "gap_hours"], rows },
    diagnostics: diagnostics.filter((d) => JSON.stringify(d.rows) !== JSON.stringify(rows)),
  };
}
