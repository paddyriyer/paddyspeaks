/* SFC-L1-01 — Open pipeline at each month-end, reconstructed from field history (SQL).
   Simulated practice scenario. All data is generated from the seed. The CRM objects
   (opportunities and their field history) are described generally; the stage names,
   rules and amounts are this exercise's own.

   Contract: see docs/COMPANY-INTERVIEW-LOOPS.md § Executable templates (sql).
   The oracle below replays every opportunity's true state change by change; the
   evaluator's reference SQL reconstructs it from the history table alone (last
   new_value before the cut-off, else the old_value of the first later change, else
   the current value). They are written independently.
   level: 1 Medium (stage and amount history; every opportunity exists before the window)
          2 Hard (+ owner changes, other tracked fields, opportunities created inside the window)
          3 Very Hard (+ changes exactly at midnight on the 1st, two changes in the same
            second ordered by history_id, deals reopened after closing) */
import { insertSQL, pad2 } from "../../js/rng.js";

export const kind = "sql";

const OPEN = ["Prospecting", "Qualification", "Proposal", "Negotiation"];
const CLOSED = ["Closed Won", "Closed Lost"];
const OWNERS = ["usr_adeyemi", "usr_bauer", "usr_chen", "usr_dubois", "usr_eriksen", "usr_farah", "usr_garcia"];
const DAY = 86400;

const iso = (sec) => {
  const d = new Date(sec * 1000);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())} ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}:${pad2(d.getUTCSeconds())}+00`;
};
const dateOf = (sec) => iso(sec).slice(0, 10);
const monthStart = (y, m) => Date.UTC(y, m, 1) / 1000;          // m is 0-based; Date.UTC rolls years over

export function generate(r, level) {
  const nMonths = level === 1 ? 2 : 3;
  const m0 = r.int(3, 6);                                         // April .. July 2026
  const cutoffs = [];                                             // midnight UTC on the 1st after each month-end
  for (let k = 1; k <= nMonths; k++) cutoffs.push(monthStart(2026, m0 + k));
  const windowStart = monthStart(2026, m0);
  const dataEnd = cutoffs[nMonths - 1] + r.int(10, 25) * DAY;
  const owners = r.sample(OWNERS, level === 1 ? 3 : 4).sort();
  const amount = () => 500 * r.int(10, 400);

  const opps = [];
  const changes = [];                                             // {opp, field, old, new, at, seq}
  const n = 9 + 4 * level;
  let oid = 4000 + r.int(0, 3000);
  for (let i = 0; i < n; i++) {
    const id = "opp_" + (oid += r.int(1, 9));
    // Created before the window, or (Hard+) inside it.
    const inside = level >= 2 && (i === 1 || (i > 4 && r.chance(0.25)));
    const created = inside
      ? r.int(windowStart + DAY, cutoffs[nMonths - 1] - DAY)
      : windowStart - r.int(5, 60) * DAY + r.int(0, DAY - 1);
    const init = { StageName: r.pick(OPEN.slice(0, 2)), Amount: amount(), OwnerId: r.pick(owners) };
    // Change times: sorted, after creation. Opportunity 0 changes only after the first
    // month-end, so its first month-end value is the old_value of a later change.
    const lo = i === 0 ? cutoffs[0] + r.int(1, 5) * DAY : created + 3600;
    const times = [];
    for (let k = r.int(i === 0 ? 1 : 0, 5); k > 0; k--) times.push(r.int(lo, dataEnd));
    const special = [];                                           // Very Hard: forced stage changes
    if (level === 3 && i === 2) special.push({ at: r.pick(cutoffs.slice(0, nMonths - 1)), twin: false });   // exactly at midnight on the 1st
    if (level === 3 && i === 3) special.push({ at: r.int(created + DAY, cutoffs[1] - 3600), twin: true });   // two changes in one second
    if (level === 3 && i === 4) {                               // closed in the first month, reopened in the second
      special.push({ at: r.int(Math.max(created + DAY, windowStart + DAY), cutoffs[0] - 2 * DAY), close: true });
      special.push({ at: r.int(cutoffs[0] + DAY, cutoffs[1] - DAY), twin: false });
    }
    const used = new Set(special.map((s) => s.at));
    for (let k = 0; k < times.length; k++) { while (used.has(times[k])) times[k]++; used.add(times[k]); }
    for (const s of special) times.push(s);
    times.sort((a, b) => (typeof a === "number" ? a : a.at) - (typeof b === "number" ? b : b.at));

    const st = { ...init };
    let seq = 0;
    const stageStep = (forceReopen) => {
      const cur = st.StageName;
      if (CLOSED.includes(cur)) return level === 3 ? r.pick(OPEN.slice(1, 3)) : null;     // reopen only at Very Hard
      if (forceReopen) return r.pick(CLOSED);
      const k = OPEN.indexOf(cur);
      if (r.chance(0.3)) return r.pick(CLOSED);
      return OPEN[Math.min(k + 1, OPEN.length - 1)] === cur ? r.pick(CLOSED) : OPEN[k + 1];
    };
    const apply = (at, field, nv) => {
      changes.push({ opp: id, field, old: st[field], new: nv, at, seq: seq++, i });
      st[field] = nv;
    };
    for (const t of times) {
      if (typeof t !== "number") {                               // forced stage change(s)
        if (t.close) {
          apply(t.at, "StageName", CLOSED.includes(st.StageName) ? r.pick(OPEN.slice(1, 3)) : r.pick(CLOSED));
          continue;
        }
        let nv = stageStep(false);
        apply(t.at, "StageName", nv);
        if (t.twin) {
          nv = stageStep(false);
          apply(t.at, "StageName", nv);                           // same second, higher history_id
        }
        continue;
      }
      const fields = level === 1 ? ["StageName", "StageName", "Amount"] : ["StageName", "StageName", "Amount", "OwnerId", "CloseDate", "NextStep"];
      let f = r.pick(fields);
      if (f === "StageName") {
        const nv = stageStep(false);
        if (nv === null) f = "Amount";
        else { apply(t, f, nv); continue; }
      }
      if (f === "Amount") { let nv; do nv = amount(); while (nv === st.Amount); apply(t, f, nv); }
      else if (f === "OwnerId") { const nv = r.pick(owners.filter((o) => o !== st.OwnerId)); apply(t, f, nv); }
      else if (f === "CloseDate") {
        const old = st.CloseDate || dateOf(created + 60 * DAY);
        st.CloseDate = old;
        apply(t, f, dateOf(t + r.int(20, 90) * DAY));
      } else {
        const old = st.NextStep || "Intro call";
        st.NextStep = old;
        apply(t, f, r.pick(["Send proposal", "Security review", "Pricing call", "Legal redlines"]));
      }
    }
    opps.push({ id, created, init, final: { ...st } });
  }

  // History ids follow time; changes in one second keep their order.
  changes.sort((a, b) => a.at - b.at || a.i - b.i || a.seq - b.seq);
  let hid = 90000 + r.int(0, 9000);
  for (const c of changes) c.hid = (hid += r.int(1, 4));

  // Oracle: replay each opportunity's state up to each cut-off.
  const tracked = ["StageName", "Amount", "OwnerId"];
  const stateAt = (o, cutoff, opt = {}) => {
    const s = { StageName: o.init.StageName, Amount: o.init.Amount, OwnerId: o.init.OwnerId };
    let mine = changes.filter((c) => c.opp === o.id && tracked.includes(c.field));
    if (opt.tieWrong) mine = mine.slice().sort((a, b) => a.at - b.at || b.hid - a.hid);
    for (const c of mine) if (opt.inclusive ? c.at <= cutoff : c.at < cutoff) s[c.field] = c.new;
    if (opt.noFallback) {
      for (const f of tracked) if (!mine.some((c) => c.field === f && c.at < cutoff)) s[f] = null;
    }
    return s;
  };
  const solve = (opt = {}) => {
    const agg = new Map();
    cutoffs.forEach((cut, k) => {
      const me = dateOf(cut - DAY);
      for (const o of opps) {
        if (!opt.ignoreCreated && o.created >= cut) continue;
        const s = opt.current ? o.final : stateAt(o, cut, opt);
        if (s.StageName === null) continue;
        if (!opt.keepClosed && CLOSED.includes(s.StageName)) continue;
        const key = [me, s.StageName, s.OwnerId === null ? "" : s.OwnerId].join("|");
        if (!agg.has(key)) agg.set(key, [0, 0]);
        const a = agg.get(key);
        a[0] += 1;
        a[1] += s.Amount === null ? 0 : s.Amount;
      }
    });
    const cmp = (x, y) => (x < y ? -1 : x > y ? 1 : 0);
    return [...agg.entries()].sort((x, y) => cmp(x[0], y[0])).map(([k, [cnt, amt]]) => {
      const [me, stage, owner] = k.split("|");
      return [me, stage, owner || null, cnt, amt];
    });
  };
  const rows = solve();
  const diagnostics = [
    { message: "The current stage, amount and owner were used for every month-end. Each month-end needs the values as they stood then, rebuilt from the field history.", rows: solve({ current: true }) },
    { message: "Opportunities closed by the month-end were counted. Pipeline is open opportunities only: a deal stops counting from the moment it closes.", rows: solve({ keepClosed: true }) },
    { message: "Opportunities with no tracked change before the month-end were dropped. Their value then is the old_value of their first later change, or the current value if that field never changed.", rows: solve({ noFallback: true }) },
  ];
  if (level >= 2) diagnostics.push({ message: "Opportunities created after the month-end were counted. An opportunity is in a month-end's pipeline only if created_at is before midnight on the 1st that follows.", rows: solve({ ignoreCreated: true }) });
  if (level === 3) {
    diagnostics.push({ message: "A change at exactly 00:00:00 on the 1st was applied to the month before. The month-end state includes only changes strictly before midnight on the 1st.", rows: solve({ inclusive: true }) });
    diagnostics.push({ message: "Two changes in the same second were applied in the wrong order. Within one changed_at, the higher history_id is the later change.", rows: solve({ tieWrong: true }) });
  }

  const oCols = ["opportunity_id", "created_at", "stage", "amount", "owner_id"];
  const oRows = opps.slice().sort((a, b) => (a.id < b.id ? -1 : 1)).map((o) => [o.id, iso(o.created), o.final.StageName, o.final.Amount, o.final.OwnerId]);
  const hCols = ["history_id", "opportunity_id", "field", "old_value", "new_value", "changed_at"];
  const hRows = changes.map((c) => [c.hid, c.opp, c.field, String(c.old), String(c.new), iso(c.at)]);
  const mCols = ["month_end"];
  const mRows = cutoffs.map((c) => [dateOf(c - DAY)]);
  const setup =
    "SET TIME ZONE 'UTC';\n" +
    "CREATE TABLE report_months (\n  month_end DATE PRIMARY KEY\n);\n" +
    "CREATE TABLE opportunities (\n  opportunity_id TEXT PRIMARY KEY,\n  created_at TIMESTAMPTZ NOT NULL,\n  stage TEXT NOT NULL,\n  amount NUMERIC(14,2) NOT NULL,\n  owner_id TEXT NOT NULL\n);\n" +
    "CREATE TABLE opportunity_field_history (\n  history_id BIGINT PRIMARY KEY,\n  opportunity_id TEXT NOT NULL REFERENCES opportunities(opportunity_id),\n  field TEXT NOT NULL,\n  old_value TEXT,\n  new_value TEXT,\n  changed_at TIMESTAMPTZ NOT NULL\n);\n" +
    insertSQL("report_months", mCols, mRows) + insertSQL("opportunities", oCols, oRows) + insertSQL("opportunity_field_history", hCols, hRows);

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return {
    vars: {
      months: cutoffs.map((c) => monthNames[new Date((c - DAY) * 1000).getUTCMonth()]).join(", ").replace(/, ([^,]+)$/, " and $1") + " 2026",
      opps: opps.length,
      history_rows: changes.length,
      fields_rule: level === 1
        ? "In this sample the history tracks `StageName` and `Amount` only; owners never change, and every opportunity was created before the first month in the report."
        : "The history tracks `StageName`, `Amount` and `OwnerId`, and also fields the report does not use (such as `CloseDate` and `NextStep`). Some opportunities were created during the report months.",
      tie_rule: level === 3
        ? "A deal can be reopened: its stage can move from a closed stage back to an open one, and then it counts again. Two changes can share a `changed_at`; the higher `history_id` is the later one."
        : "Within an opportunity, no two changes share a `changed_at`.",
    },
    setup,
    tables: [
      { name: "report_months", columns: mCols, rows: mRows },
      { name: "opportunities", columns: oCols, rows: oRows },
      { name: "opportunity_field_history", columns: hCols, rows: hRows },
    ],
    expected: { columns: ["month_end", "stage", "owner_id", "open_opportunities", "open_amount"], rows },
    diagnostics: diagnostics.filter((d) => JSON.stringify(d.rows) !== JSON.stringify(rows)),
  };
}
