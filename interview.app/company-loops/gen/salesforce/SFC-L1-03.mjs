/* SFC-L1-03 — Case first response within entitlement, in business hours (SQL).
   Simulated practice scenario. All data is generated from the seed. The business-hours
   calendar, holidays, priorities and targets are this exercise's own rules.

   Contract: see docs/COMPANY-INTERVIEW-LOOPS.md § Executable templates (sql).
   The oracle measures business time by walking the calendar day by day in JavaScript
   (and builds the boundary cases by walking it forwards); the evaluator's reference SQL
   intersects each case's interval with one business window per calendar day. They are
   written independently.
   level: 1 Medium (business hours, weekends, one holiday; every case answered)
          2 Hard (+ automated acknowledgements and internal notes that are not a response,
            unanswered cases: breached if already over target, otherwise not yet judged)
          3 Very Hard (+ P1 on a 24x7 calendar: every second counts, holidays too) */
import { insertSQL, pad2 } from "../../js/rng.js";

export const kind = "sql";

const DAY = 86400;
const iso = (sec) => {
  const d = new Date(sec * 1000);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())} ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}:${pad2(d.getUTCSeconds())}+00`;
};
const dateOf = (sec) => iso(sec).slice(0, 10);

export function generate(r, level) {
  const [open, close] = r.pick([[8, 17], [9, 17], [9, 18], [7, 15]]);
  const base = Date.UTC(2026, 0, 5) / 1000 + 7 * DAY * r.int(8, 40);       // a Monday
  const asOf = base + 14 * DAY + r.int(9, 15) * 3600;                      // Monday of the third week
  const weekdays = [];
  for (let d = 0; d < 14; d++) if (d % 7 < 5) weekdays.push(base + d * DAY);
  const holidays = r.sample(weekdays.slice(1), level === 1 ? 1 : 2).sort((a, b) => a - b);
  const hol = new Set(holidays.map((h) => h / DAY));
  const targets = {
    P1: r.pick([30, 60]), P2: r.pick([120, 240]), P3: r.pick([480, 600]), P4: r.pick([960, 1440]),
  };
  const calOf = (p) => (level === 3 && p === "P1" ? "24x7" : "business");

  // Calendar arithmetic, in seconds since the epoch.
  const workday = (dIdx, o = {}) => {
    const wd = new Date(dIdx * DAY * 1000).getUTCDay();
    return wd !== 0 && wd !== 6 && (o.ignoreHolidays || !hol.has(dIdx));
  };
  const elapsed = (s, t, cal, o = {}) => {
    if (o.wall || cal === "24x7") return t - s;
    let sum = 0;
    for (let d = Math.floor(s / DAY); d <= Math.floor(t / DAY); d++) {
      if (!workday(d, o)) continue;
      const a = Math.max(s, d * DAY + open * 3600), b = Math.min(t, d * DAY + close * 3600);
      if (b > a) sum += b - a;
    }
    return sum;
  };
  const addElapsed = (s, e, cal) => {
    if (cal === "24x7") return s + e;
    for (let d = Math.floor(s / DAY); ; d++) {
      if (!workday(d)) continue;
      const a = Math.max(s, d * DAY + open * 3600), b = d * DAY + close * 3600;
      if (a >= b) continue;
      if (e <= b - a) return a + e;
      e -= b - a;
    }
  };

  const cases = [];          // {id, p, created}
  const comments = [];       // {case, at, author, pub}
  let cid = 500100 + r.int(0, 80000);
  let mid = 7000000 + r.int(0, 900000);
  const prios = ["P1", "P2", "P3", "P4"];
  const n = 14 + 4 * level;
  const offHours = () => {                                     // a weekend, a holiday, or outside the day's hours
    const k = r.int(0, 2);
    if (k === 0) return base + 5 * DAY + r.int(0, 2 * DAY - 1);                 // the first weekend
    if (k === 1) return holidays[0] + r.int(0, DAY - 1);
    const d = r.pick(weekdays.slice(0, 5));
    return d + (r.chance(0.5) ? r.int(0, open * 3600 - 1) : r.int(close * 3600, DAY - 1));
  };
  for (let i = 0; i < n; i++) {
    const p = i < 4 ? prios[i] : r.pick(prios);
    const cal = calOf(p);
    const tgt = targets[p] * 60;
    let created;
    let resp = null;
    if (i === 0 || i === 1) {                                   // exactly at the target, and one second over
      created = cal === "business" || r.chance(0.5) ? offHours() : base + r.int(0, 4) * DAY + r.int(0, DAY - 1);
      resp = addElapsed(created, tgt + (i === 1 ? 1 : 0), cal);
    } else if (i === 2 && level === 3) {                        // P1 on 24x7 across a weekend
      created = base + 4 * DAY + r.int(20, 23) * 3600;
      resp = created + r.int(Math.floor(tgt / 2), tgt);
    } else {
      created = level === 1 ? base + r.int(0, 6 * DAY) : r.int(base, asOf - 3600);
      if (r.chance(0.3)) created = Math.min(offHours(), asOf - 3600);
      const mode = r.int(0, 2);
      if (mode === 0) resp = addElapsed(created, r.int(Math.floor(tgt / 4), tgt), cal);             // in time
      else if (mode === 1) resp = addElapsed(created, r.int(tgt + 60, tgt * 3), cal);              // late
      else resp = created + r.int(120, 3 * DAY);                                                   // any wall time, even off hours
      if (level >= 2 && r.chance(0.15)) resp = null;                                               // never answered (yet)
    }
    if (resp !== null && resp > asOf) {
      if (level === 1) resp = created + r.int(60, 600);         // keep every case answered at Medium
      else resp = null;
    }
    const id = "case_" + (cid += r.int(1, 50));
    cases.push({ id, p, created, resp });
    // Noise that is not a first response.
    if (r.chance(0.35)) {
      const lim = (resp === null ? asOf : resp) - created - 2;
      if (lim > 10) comments.push({ case: id, at: created + r.int(1, lim), author: "customer", pub: true });
    }
    if (level >= 2 && r.chance(0.6)) comments.push({ case: id, at: created + r.int(1, 90), author: "automated", pub: true });
    if (level >= 2 && r.chance(0.3)) {
      const lim = (resp === null ? asOf : resp) - created - 2;
      if (lim > 10) comments.push({ case: id, at: created + r.int(1, lim), author: "agent", pub: false });
    }
    if (resp !== null) {
      comments.push({ case: id, at: resp, author: "agent", pub: true });
      if (r.chance(0.4) && resp + 7200 <= asOf) comments.push({ case: id, at: resp + r.int(60, 7200), author: "agent", pub: true });
    }
  }
  // Hard+: one case created just before the snapshot and not yet answered (not judged),
  // and one old unanswered case (breached).
  if (level >= 2) {
    const id1 = "case_" + (cid += r.int(1, 50));
    cases.push({ id: id1, p: "P4", created: asOf - r.int(600, 3000), resp: null });
    const id2 = "case_" + (cid += r.int(1, 50));
    cases.push({ id: id2, p: r.pick(["P2", "P3"]), created: base + r.int(0, 3) * DAY + 10 * 3600, resp: null });
    comments.push({ case: id2, at: base + r.int(0, 3) * DAY + 10 * 3600 + 30 + 4 * DAY, author: "agent", pub: false });
  }

  const cmp = (x, y) => (x < y ? -1 : x > y ? 1 : 0);
  const share = (k, d) => Math.floor((k * 20000 + d) / (2 * d)) / 10000;
  const solve = (o = {}) => {
    const agg = new Map();
    for (const c of cases) {
      const cal = o.allBusiness ? "business" : calOf(c.p);
      const tgt = targets[c.p] * 60;
      let resp = c.resp;
      if (o.anyComment) {
        const all = comments.filter((m) => m.case === c.id).map((m) => m.at);
        resp = all.length ? Math.min(...all) : null;
      }
      let met;
      if (resp !== null) {
        const e = elapsed(c.created, resp, cal, o);
        met = o.strict ? e < tgt : e <= tgt;
      } else {
        if (o.dropUnanswered) continue;
        const e = elapsed(c.created, asOf, cal, o);
        if (e <= tgt && !o.pendingAsBreach) continue;              // not yet judged
        met = false;
      }
      if (!agg.has(c.p)) agg.set(c.p, [0, 0]);
      agg.get(c.p)[met ? 0 : 1]++;
    }
    return [...agg.entries()].sort((x, y) => cmp(x[0], y[0])).map(([p, [m, b]]) => [p, m + b, m, b, share(m, m + b)]);
  };
  const rows = solve();
  const diagnostics = [
    { message: "Elapsed time was measured on the wall clock. The target is in business time: only Monday–Friday hours that are not holidays count.", rows: solve({ wall: true }) },
    { message: "Holidays were counted as business days. A date in the holidays table contributes no business time.", rows: solve({ ignoreHolidays: true }) },
    { message: "A response at exactly the target was counted as a breach. Responding within the target includes the boundary.", rows: solve({ strict: true }) },
    { message: level === 1
      ? "A customer's comment was taken as the first response. Only a public comment by an agent responds to the case."
      : "The first comment of any kind was taken as the first response. Automated acknowledgements, internal notes and customer comments do not count; only a public comment by an agent does.", rows: solve({ anyComment: true }) },
  ];
  if (level >= 2) {
    diagnostics.push({ message: "Unanswered cases were left out. One that is already past its target at the snapshot is a breach.", rows: solve({ dropUnanswered: true }) });
    diagnostics.push({ message: "Every unanswered case was counted as a breach. One still within its target at the snapshot cannot be judged yet and is not reported.", rows: solve({ pendingAsBreach: true }) });
  }
  if (level === 3) diagnostics.push({ message: "P1 was measured in business hours. Its entitlement uses the 24x7 calendar, where every second counts.", rows: solve({ allBusiness: true }) });

  const cCols = ["case_id", "priority", "created_at"];
  const cRows = cases.slice().sort((a, b) => cmp(a.id, b.id)).map((c) => [c.id, c.p, iso(c.created)]);
  comments.sort((a, b) => a.at - b.at || cmp(a.case, b.case));
  const kCols = ["comment_id", "case_id", "created_at", "author_type", "is_public"];
  const kRows = comments.map((m) => [(mid += r.int(1, 9)), m.case, iso(m.at), m.author, m.pub]);
  const eCols = ["priority", "response_minutes", "calendar"];
  const eRows = prios.map((p) => [p, targets[p], calOf(p)]);
  const hCols = ["holiday_date"];
  const hRows = holidays.map((h) => [dateOf(h)]);
  const setup =
    "SET TIME ZONE 'UTC';\n" +
    "CREATE TABLE entitlements (\n  priority TEXT PRIMARY KEY,\n  response_minutes INT NOT NULL,\n  calendar TEXT NOT NULL CHECK (calendar IN ('business','24x7'))\n);\n" +
    "CREATE TABLE holidays (\n  holiday_date DATE PRIMARY KEY\n);\n" +
    "CREATE TABLE cases (\n  case_id TEXT PRIMARY KEY,\n  priority TEXT NOT NULL REFERENCES entitlements(priority),\n  created_at TIMESTAMPTZ NOT NULL\n);\n" +
    "CREATE TABLE case_comments (\n  comment_id BIGINT PRIMARY KEY,\n  case_id TEXT NOT NULL REFERENCES cases(case_id),\n  created_at TIMESTAMPTZ NOT NULL,\n  author_type TEXT NOT NULL CHECK (author_type IN ('agent','customer','automated')),\n  is_public BOOLEAN NOT NULL\n);\n" +
    insertSQL("entitlements", eCols, eRows) + insertSQL("holidays", hCols, hRows) +
    insertSQL("cases", cCols, cRows) + insertSQL("case_comments", kCols, kRows);

  return {
    vars: {
      open: open,
      close: close,
      open_hhmm: pad2(open) + ":00",
      close_hhmm: pad2(close) + ":00",
      as_of: iso(asOf),
      cases: cases.length,
      comments: comments.length,
      answer_rule: level === 1
        ? "Every case in this sample has been answered by the snapshot."
        : "Some cases have no agent response by the snapshot. Such a case is **breached** if its business time from `created_at` to the snapshot is already over the target, and is not reported (not yet judged) otherwise. Automated acknowledgements and internal notes (`is_public = false`) are not responses.",
      calendar_rule: level === 3
        ? "An entitlement's `calendar` is `'business'` or `'24x7'`; on `'24x7'` every second counts, weekends and holidays included."
        : "Every entitlement in this sample uses the `'business'` calendar.",
    },
    setup,
    tables: [
      { name: "entitlements", columns: eCols, rows: eRows },
      { name: "holidays", columns: hCols, rows: hRows },
      { name: "cases", columns: cCols, rows: cRows },
      { name: "case_comments", columns: kCols, rows: kRows },
    ],
    expected: { columns: ["priority", "cases", "met", "breached", "met_rate"], rows },
    diagnostics: diagnostics.filter((d) => JSON.stringify(d.rows) !== JSON.stringify(rows)),
  };
}
