/* TGA-L1-03 — Adapter traffic on shared dedicated endpoints (SQL).
   Simulated practice scenario. All data is generated from the seed; endpoints,
   adapters, attachments and traffic are hypothetical.

   Contract: generate(r, level) -> { vars, setup, tables, expected, diagnostics }.
   The oracle below counts requests per endpoint and UTC day in JavaScript and checks
   each attachment interval against each 7-day window; the evaluator's reference SQL is
   written independently and must return the same rows.
   level: 1 Medium (two report days; adapters attached long ago, recently, or detached
            during the report; dormant adapters; a request exactly on the window's edge)
          · 2 Hard (+ a third day, rejected requests that count nowhere, including a
            rejected call to a dormant adapter and calls after a detach)
          · 3 Very Hard (+ one adapter attached to two endpoints, used on one only; an
            adapter detached and re-attached, so no single attachment covers the window) */
import { insertSQL, pad2 } from "../../js/rng.js";

export const kind = "sql";

const DAYS = ["2026-09-21", "2026-09-23", "2026-09-28", "2026-10-01", "2026-10-05"];
const DAY = 86400;

function stampSec(s) {
  const d = new Date(s * 1000);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())} ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}:${pad2(d.getUTCSeconds())}+00`;
}
const dayStr = (s) => stampSec(s).slice(0, 10);
function round3(num, den) {
  if (!den) return null;
  return Math.floor((2000 * num + den) / (2 * den)) / 1000;
}

export function generate(r, level) {
  const first = r.pick(DAYS);
  const D0 = Date.parse(first + "T00:00:00Z") / 1000;
  const R = level === 1 ? 2 : 3;
  const H = D0 - 10 * DAY;                  // traffic history starts ten days before the report
  const END = D0 + R * DAY;
  const nEp = level === 1 ? 2 : 3;

  const eps = [];
  let epn = 3000 + r.int(0, 6000);
  for (let i = 0; i < nEp; i++) { epn += r.int(5, 60); eps.push("ep-" + epn); }
  let adn = 100 + r.int(0, 300);
  const nextAd = () => { adn += r.int(1, 37); return "ad" + adn; };

  const atts = [];                          // {ep, ad, from, to|null}
  const plan = [];                          // {ep, ad, dormantFrom|null, onlyAt|null}
  const requests = [];                      // [ep, ad|null, status, sec]
  for (const ep of eps) {
    const nActive = r.int(2, level === 1 ? 3 : 4);
    for (let i = 0; i < nActive; i++) {
      const ad = nextAd();
      atts.push({ ep, ad, from: H - r.int(1, 40) * DAY - r.int(0, DAY - 1), to: null });
      plan.push({ ep, ad, dormantFrom: null });
    }
    // Dormant for a long time: listed on every report day.
    const dz = nextAd();
    atts.push({ ep, ad: dz, from: H - r.int(5, 30) * DAY, to: null });
    plan.push({ ep, ad: dz, dormantFrom: H + r.int(0, 2) * DAY });
    // Recently attached and never used: not attached for the whole window, never listed.
    const rc = nextAd();
    atts.push({ ep, ad: rc, from: D0 - r.int(1, 4) * DAY + r.int(60, DAY - 60), to: null });
    plan.push({ ep, ad: rc, dormantFrom: -Infinity });
  }
  // Detached during the report: not attached at the end of that day.
  {
    const ep = eps[0], ad = nextAd();
    const det = D0 + r.int(0, R - 1) * DAY + r.int(3600, DAY - 3600);
    atts.push({ ep, ad, from: H - 20 * DAY, to: det });
    plan.push({ ep, ad, dormantFrom: H, detachedAt: det });
  }
  // The edge of the window: a dormant adapter's only recent request is at 00:00:00 on
  // the first day of the first report day's window; it is idle from the second report day.
  {
    const ep = eps[eps.length - 1], ad = nextAd();
    atts.push({ ep, ad, from: H - 15 * DAY, to: null });
    plan.push({ ep, ad, dormantFrom: H });
    requests.push([ep, ad, "ok", D0 - 6 * DAY]);
  }
  let shared = null, reat = null;
  if (level === 3) {
    // The same adapter on two endpoints: busy on one, dormant on the other.
    shared = nextAd();
    atts.push({ ep: eps[0], ad: shared, from: H - 12 * DAY, to: null });
    plan.push({ ep: eps[0], ad: shared, dormantFrom: null });
    atts.push({ ep: eps[1], ad: shared, from: H - 9 * DAY, to: null });
    plan.push({ ep: eps[1], ad: shared, dormantFrom: H });
    // Detached and re-attached five minutes later, two days before the report; never used since.
    reat = nextAd();
    const cut = D0 - 2 * DAY + r.int(3600, DAY - 3600);
    atts.push({ ep: eps[2], ad: reat, from: H - 25 * DAY, to: cut });
    atts.push({ ep: eps[2], ad: reat, from: cut + 300, to: null });
    plan.push({ ep: eps[2], ad: reat, dormantFrom: H });
  }

  // Daily traffic over the history and the report.
  for (let day = H; day < END; day += DAY) {
    for (const ep of eps) {
      const nb = r.int(2, 6);
      for (let j = 0; j < nb; j++) requests.push([ep, null, "ok", day + r.int(0, DAY - 1)]);
      for (const p of plan.filter((x) => x.ep === ep)) {
        if (p.dormantFrom !== null && day >= p.dormantFrom) continue;
        const k = r.int(0, 4);
        for (let j = 0; j < k; j++) {
          const s = day + r.int(0, DAY - 1);
          if (p.detachedAt && s >= p.detachedAt) continue;
          requests.push([ep, p.ad, "ok", s]);
        }
      }
      if (level >= 2 && r.chance(0.5)) {            // a rejected call: counts nowhere
        const p = r.pick(plan.filter((x) => x.ep === ep));
        requests.push([ep, r.chance(0.3) ? null : p.ad, "rejected", day + r.int(0, DAY - 1)]);
      }
    }
  }
  if (level >= 2) {
    // Calls to the detached adapter after its detach, and a rejected call to a dormant adapter.
    const det = plan.find((p) => p.detachedAt);
    for (let j = 0; j < r.int(2, 3); j++) requests.push([det.ep, det.ad, "rejected", det.detachedAt + r.int(60, 7200)]);
    const dz = plan.find((p) => p.ep === eps[1] && p.dormantFrom !== null && p.dormantFrom > -Infinity && !p.detachedAt);
    requests.push([dz.ep, dz.ad, "rejected", D0 + r.int(0, R - 1) * DAY + r.int(0, DAY - 1)]);
  }

  // ---- Oracle -------------------------------------------------------------------
  const compute = (o = {}) => {
    const out = [];
    const reqs = o.keepRejected ? requests : requests.filter((q) => q[2] === "ok");
    for (let d = 0; d < R; d++) {
      const day = D0 + d * DAY;
      for (const ep of eps) {
        const today = reqs.filter((q) => q[0] === ep && q[3] >= day && q[3] < day + DAY);
        const base = today.filter((q) => q[1] === null).length;
        const per = new Map();
        for (const q of today) if (q[1] !== null) per.set(q[1], (per.get(q[1]) || 0) + 1);
        let busiest = null;
        for (const [ad, c] of [...per.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
          if (busiest === null || c > per.get(busiest) || (o.tieHigh && c === per.get(busiest))) busiest = ad;
        }
        const wFrom = o.oneDay ? day : day - (o.eightDays ? 7 : 6) * DAY;
        const wTo = day + DAY;
        const idle = [];
        const ads = [...new Set(atts.filter((a) => a.ep === ep).map((a) => a.ad))].sort();
        for (const ad of ads) {
          const rows = atts.filter((a) => a.ep === ep && a.ad === ad);
          let covered;
          if (o.anyAttach) covered = rows.some((a) => a.from < wTo && (a.to === null || a.to >= wTo));
          else if (o.minAttach) covered = Math.min(...rows.map((a) => a.from)) <= wFrom && rows.some((a) => a.to === null || a.to >= wTo);
          else covered = rows.some((a) => a.from <= wFrom && (a.to === null || a.to >= wTo));
          if (!covered) continue;
          const used = reqs.some((q) => (o.anyEndpoint || q[0] === ep) && q[1] === ad && q[3] >= wFrom && q[3] < wTo);
          if (!used) idle.push(ad);
        }
        out.push([dayStr(day), ep, today.length, round3(base, today.length), per.size, busiest, idle.length ? idle.join(", ") : null]);
      }
    }
    return out;
  };
  const rows = compute();

  const diagnostics = [
    { message: "An adapter was listed as idle after only one quiet day. The rule is no served request on this endpoint in the 7 days ending that day.", rows: compute({ oneDay: true }) },
    { message: "Adapters attached during the window were listed. An adapter is listed only when one attachment covers the whole 7-day window, from 00:00 six days earlier to the end of the day.", rows: compute({ anyAttach: true }) },
    { message: "The window was eight days long. The 7 days ending on a day start at 00:00 six days before it; a request at exactly that moment is inside the window.", rows: compute({ eightDays: true }) },
    { message: "Ties for the busiest adapter went to the higher id. Break ties by the lower adapter_id.", rows: compute({ tieHigh: true }) },
  ];
  if (level >= 2) {
    diagnostics.push({ message: "Rejected requests were counted. Only requests with status 'ok' were served; rejected ones count nowhere, and a rejected call does not make an adapter active.", rows: compute({ keepRejected: true }) });
  }
  if (level === 3) {
    diagnostics.push({ message: "Requests on another endpoint kept an adapter off the idle list. Traffic is per endpoint: an adapter can be busy on one endpoint and idle on another.", rows: compute({ anyEndpoint: true }) });
    diagnostics.push({ message: "The earliest attached_at of an adapter was used across its attachments. An adapter detached and re-attached inside the window was not attached for the whole window.", rows: compute({ minAttach: true }) });
  }

  // ---- Tables ---------------------------------------------------------------------
  const attCols = ["endpoint_id", "adapter_id", "attached_at", "detached_at"];
  const attRows = atts
    .slice()
    .sort((a, b) => a.from - b.from || (a.ad < b.ad ? -1 : 1))
    .map((a) => [a.ep, a.ad, stampSec(a.from), a.to === null ? null : stampSec(a.to)]);
  const sorted = requests.slice().sort((a, b) => a[3] - b[3] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : String(a[1]) < String(b[1]) ? -1 : 1));
  const reqCols = ["request_id", "endpoint_id", "adapter_id", "status", "request_ts"];
  let rid = 500000 + r.int(0, 400000);
  const reqRows = sorted.map((q) => [rid++, q[0], q[1], q[2], stampSec(q[3])]);

  const setup =
    "SET TIME ZONE 'UTC';\n" +
    "CREATE TABLE adapter_attachments (\n  endpoint_id TEXT NOT NULL,\n  adapter_id TEXT NOT NULL,\n  attached_at TIMESTAMPTZ NOT NULL,\n  detached_at TIMESTAMPTZ\n);\n" +
    "CREATE TABLE endpoint_requests (\n  request_id BIGINT PRIMARY KEY,\n  endpoint_id TEXT NOT NULL,\n  adapter_id TEXT,\n  status TEXT NOT NULL CHECK (status IN ('ok','rejected')),\n  request_ts TIMESTAMPTZ NOT NULL\n);\n" +
    insertSQL("adapter_attachments", attCols, attRows) + insertSQL("endpoint_requests", reqCols, reqRows);

  const last = dayStr(D0 + (R - 1) * DAY);
  return {
    vars: {
      first_day: first,
      last_day: last,
      endpoints: eps.join(", "),
      attachments: attRows.length,
      requests: reqRows.length,
      status_rule: level === 1
        ? "Every request in this sample has status ok."
        : "A request with status rejected was not served (for example, it named an adapter that was not attached): it counts nowhere, and it does not make an adapter active.",
      attach_rule: level === 3
        ? "The same adapter can be attached to more than one endpoint, and an adapter can be detached and attached again, which adds a second attachment row."
        : "No adapter is attached to two endpoints, and none was detached and attached again.",
    },
    setup,
    tables: [
      { name: "adapter_attachments", columns: attCols, rows: attRows },
      { name: "endpoint_requests", columns: reqCols, rows: reqRows },
    ],
    expected: { columns: ["day", "endpoint_id", "requests", "base_share", "adapters_used", "busiest_adapter", "idle_adapters"], rows },
    diagnostics: diagnostics.filter((d) => JSON.stringify(d.rows) !== JSON.stringify(rows)),
  };
}
