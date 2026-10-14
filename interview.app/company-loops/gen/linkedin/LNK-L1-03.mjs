/* LNK-L1-03 — Recruiter message responses within 7 days, per seat (SQL).
   Simulated practice scenario. All data is generated from the seed; seats, members and
   numbers are hypothetical. The output is a per-seat aggregate, never message content.

   Contract: see docs/COMPANY-INTERVIEW-LOOPS.md § Executable templates (sql).
   level: 1 Medium (accept, decline and reply are responses, a read is not; bulk duplicates
            to the same member collapse to the first message)
          2 Hard (+ a response to a duplicate copy counts for the kept message; duplicate
            gaps exactly at the limit and one second past it; responses exactly 7 days and
            7 days + 1 second after the send; messages whose 7 days have not ended by the
            as-of time are left out)
          3 Very Hard (+ chains of three copies, each within the limit of the previous one;
            several response events per conversation, the first one counts) */
import { insertSQL } from "../../js/rng.js";

export const kind = "sql";

const DAY = 86400;
const WINDOW = 7 * DAY;
const START = Date.UTC(2026, 8, 1) / 1000;          // 2026-09-01
const RESP = ["accepted", "declined", "replied"];
const fmt = (s) => new Date(s * 1000).toISOString().replace("T", " ").slice(0, 19) + "+00";

export function generate(r, level) {
  const dupHours = r.pick([2, 6, 12, 24]);
  const DUP = dupHours * 3600;
  const asOf = Date.UTC(2026, 9, 1) / 1000 + r.int(0, 3) * DAY;
  const closed = asOf - WINDOW;                       // last send whose window has ended
  const nSeats = r.int(3, level === 1 ? 4 : 5);
  const seats = [];
  {
    let s = r.int(100, 800);
    for (let i = 0; i < nSeats; i++) seats.push("seat-" + String((s += r.int(3, 90))).padStart(4, "0"));
  }
  let member = r.int(4000000, 6000000);
  const nextMember = () => (member += r.int(1, 999));

  const msgs = [];          // {seat, member, sent}
  const events = [];        // {msg, type, at}
  // A group: copies of one message to one member; `respond` says which copy gets the response and when.
  const makeGroup = (seat, t0, o = {}) => {
    const m = nextMember();
    const n = o.copies || (level === 1 ? r.pick([1, 1, 2]) : level === 2 ? r.pick([1, 1, 2]) : r.pick([1, 2, 3]));
    const sends = [t0];
    for (let k = 1; k < n; k++) {
      const g = o.gaps ? o.gaps[k - 1] : (level >= 2 && r.chance(0.2) ? DUP : r.int(60, DUP - 1));
      sends.push(sends[k - 1] + g);
    }
    const ms = sends.map((t) => { const x = { seat, member: m, sent: t }; msgs.push(x); return x; });
    for (const x of ms) events.push({ msg: x, type: "delivered", at: x.sent + r.int(1, 30) });
    const outcome = o.outcome || r.pick(["none", "read", "accepted", "declined", "replied", "replied"]);
    if (outcome === "none") return ms;
    const target = o.target !== undefined ? ms[o.target] : level === 1 ? ms[0] : r.pick(ms);
    let at;
    if (o.at !== undefined) at = o.at;
    else {
      const opts = [t0 + r.int(600, WINDOW - 1), t0 + r.int(600, WINDOW - 1), t0 + WINDOW + r.int(1, 5 * DAY)];
      if (level >= 2) opts.push(t0 + WINDOW, t0 + WINDOW + 1);
      at = r.pick(opts);
    }
    if (at <= target.sent) at = target.sent + r.int(60, 3600);
    if (outcome !== "read") events.push({ msg: target, type: "read", at: Math.max(target.sent + 31, at - r.int(60, 3 * 3600)) });
    events.push({ msg: target, type: outcome, at });
    if (level === 3 && outcome !== "read" && r.chance(0.35)) {
      // A later response in the same conversation (a decline, then a reply): only the first counts.
      events.push({ msg: target, type: r.pick(RESP), at: at + r.int(3600, 6 * DAY) });
    }
    return ms;
  };

  const sendWindowEnd = closed;                        // every level: plenty of closed messages
  for (const s of seats) {
    const n = r.int(4, level === 1 ? 7 : 8);
    for (let i = 0; i < n; i++) makeGroup(s, r.int(START, sendWindowEnd));
  }
  // Every level: a duplicate pair where the member declines the kept message within the window.
  makeGroup(r.pick(seats), r.int(START, closed - 2 * DAY), { copies: 2, gaps: [r.int(60, DUP - 1)], outcome: "declined", target: 0 });
  if (level >= 2) {
    const t = r.int(START, closed - 10 * DAY);
    // Copy exactly at the limit (still a duplicate) answered on the copy; copy one second past it (its own message).
    makeGroup(r.pick(seats), t, { copies: 2, gaps: [DUP], outcome: "replied", target: 1, at: t + DUP + r.int(600, DAY) });
    makeGroup(r.pick(seats), t + DAY, { copies: 2, gaps: [DUP + 1], outcome: "accepted", target: 1, at: t + DAY + DUP + r.int(600, DAY) });
    // Responses exactly 7 days and 7 days + 1 second after the send.
    const u = r.int(START, closed - 2 * DAY);
    makeGroup(r.pick(seats), u, { copies: 1, outcome: "replied", at: u + WINDOW });
    makeGroup(r.pick(seats), u + 3600, { copies: 1, outcome: "accepted", at: u + 3600 + WINDOW + 1 });
    // The as-of boundary: sent exactly 7 days before (counted) and later (left out).
    makeGroup(r.pick(seats), closed, { copies: 1, outcome: "replied", at: closed + r.int(600, DAY) });
    for (let i = 0; i < r.int(2, 4); i++) makeGroup(r.pick(seats), r.int(closed + 1, asOf - 3600), { copies: 1 });
  }
  if (level === 3) {
    // Three copies, each within the limit of the previous one but the third beyond the limit from the first.
    const t = r.int(START, closed - 10 * DAY);
    const g1 = r.int(Math.floor(DUP / 2) + 60, DUP - 60), g2 = r.int(Math.floor(DUP / 2) + 60, DUP - 60);
    makeGroup(r.pick(seats), t, { copies: 3, gaps: [g1, g2], outcome: "replied", target: 2, at: t + g1 + g2 + r.int(600, DAY) });
    // A decline on the kept message inside the window, then a reply on a copy after it: first response counts.
    const v = r.int(START, closed - 10 * DAY);
    const ms = makeGroup(r.pick(seats), v, { copies: 2, gaps: [r.int(60, DUP - 1)], outcome: "declined", target: 0, at: v + r.int(DAY, 6 * DAY) });
    events.push({ msg: ms[1], type: "replied", at: v + WINDOW + r.int(1, DAY) });
  }

  const evs = events.filter((e) => e.at <= asOf);
  const mOrder = r.shuffle(msgs.map((_, i) => i));
  const mBase = r.int(10_000_000, 80_000_000);
  msgs.forEach((x, i) => { x.id = mBase + mOrder[i] * 2 + r.int(0, 1); });
  const eOrder = r.shuffle(evs.map((_, i) => i));
  const eBase = r.int(100_000_000, 800_000_000);
  evs.forEach((e, i) => { e.id = eBase + eOrder[i]; });

  // Oracle, from the rows.
  const cmp = (x, y) => (x < y ? -1 : x > y ? 1 : 0);
  const solve = (o = {}) => {
    const byPair = new Map();
    for (const x of msgs) {
      const k = x.seat + "|" + x.member;
      if (!byPair.has(k)) byPair.set(k, []);
      byPair.get(k).push(x);
    }
    const groups = [];
    for (const list of byPair.values()) {
      list.sort((a, b) => a.sent - b.sent || a.id - b.id);
      let g = null, prev = null;
      for (const x of list) {
        const dup = g && !o.noDedup && (o.anchored ? x.sent - g.first <= DUP : x.sent - prev <= DUP);
        if (dup) g.members.add(x);
        else { g = { seat: x.seat, first: x.sent, kept: x, members: new Set([x]) }; groups.push(g); }
        prev = x.sent;
      }
    }
    const types = new Set(o.declineNot ? ["accepted", "replied"] : o.readCounts ? [...RESP, "read"] : RESP);
    const per = new Map(seats.map((s) => [s, { n: 0, a: 0 }]));
    for (const g of groups) {
      if (!o.noAsOf && g.first + WINDOW > asOf) continue;
      const resp = evs.filter((e) => types.has(e.type) && (o.copyIgnored ? e.msg === g.kept : g.members.has(e.msg))).map((e) => e.at).sort((a, b) => a - b);
      const s = per.get(g.seat);
      s.n++;
      if (resp.length) {
        const at = o.lastResponse ? resp[resp.length - 1] : resp[0];
        if (o.exclusive ? at < g.first + WINDOW : at <= g.first + WINDOW) s.a++;
      }
    }
    const share = (n, d) => Math.floor((n * 20000 + d) / (2 * d)) / 10000;
    return [...per.entries()].filter(([, s]) => s.n > 0).sort((x, y) => cmp(x[0], y[0])).map(([seat, s]) => [seat, s.n, s.a, share(s.a, s.n)]);
  };
  const expected = solve();

  const diagnostics = [
    { message: "A decline was not counted as a response. Accepting, declining and replying all count; only a read does not.", rows: solve({ declineNot: true }) },
    { message: "A read receipt was counted as a response. Reading a message is not answering it.", rows: solve({ readCounts: true }) },
    { message: "Bulk duplicates were counted as separate messages. Copies to the same member within the duplicate limit are one message, the earliest.", rows: solve({ noDedup: true }) },
  ];
  if (level >= 2) {
    diagnostics.push({ message: "A response to a duplicate copy was ignored. A response to any copy counts for the kept message.", rows: solve({ copyIgnored: true }) });
    diagnostics.push({ message: "Messages whose 7 days had not ended by the as-of time were counted (they can only lower the rate).", rows: solve({ noAsOf: true }) });
    diagnostics.push({ message: "The 7-day bound was exclusive. A response exactly 7 days after the send counts.", rows: solve({ exclusive: true }) });
  }
  if (level === 3) {
    diagnostics.push({ message: "Duplicates were measured from the first copy. A copy is a duplicate when it is within the limit of the previous copy, so chains can be longer than the limit.", rows: solve({ anchored: true }) });
    diagnostics.push({ message: "The last response event was used. The first response decides whether the member answered within 7 days.", rows: solve({ lastResponse: true }) });
  }

  const mCols = ["message_id", "seat_id", "member_id", "sent_at"];
  const mRows = msgs.slice().sort((a, b) => a.id - b.id).map((x) => [x.id, x.seat, x.member, fmt(x.sent)]);
  const eCols = ["event_id", "message_id", "event_type", "event_at"];
  const eRows = evs.slice().sort((a, b) => a.id - b.id).map((e) => [e.id, e.msg.id, e.type, fmt(e.at)]);
  const setup =
    "SET TIME ZONE 'UTC';\n" +
    "CREATE TABLE messages (\n  message_id BIGINT PRIMARY KEY,\n  seat_id TEXT NOT NULL,\n  member_id BIGINT NOT NULL,\n  sent_at TIMESTAMPTZ NOT NULL\n);\n" +
    "CREATE TABLE message_events (\n  event_id BIGINT PRIMARY KEY,\n  message_id BIGINT NOT NULL REFERENCES messages(message_id),\n  event_type TEXT NOT NULL CHECK (event_type IN ('delivered', 'read', 'accepted', 'declined', 'replied')),\n  event_at TIMESTAMPTZ NOT NULL\n);\n" +
    insertSQL("messages", mCols, mRows) + insertSQL("message_events", eCols, eRows);

  return {
    vars: {
      dup_hours: dupHours,
      as_of: fmt(asOf),
      message_rows: mRows.length,
      copy_rule: level === 1
        ? "In this sample members only ever respond to the kept (earliest) copy."
        : "A response to any copy in the group counts for the kept message, timed from the kept message's `sent_at`.",
      asof_rule: level === 1
        ? `Every message in this sample was sent at least 7 days before the as-of time \`${fmt(asOf)}\`.`
        : `The data is as of \`${fmt(asOf)}\`. Leave out kept messages whose 7 days have not ended by then (sent_at + 7 days later than the as-of time); a message sent exactly 7 days before it is counted.`,
      chain_rule: level === 3
        ? "A member's conversation can hold several response events (for example a decline, then a reply); the first response event across the group's copies is the one that counts."
        : "",
    },
    setup,
    tables: [
      { name: "messages", columns: mCols, rows: mRows },
      { name: "message_events", columns: eCols, rows: eRows },
    ],
    expected: { columns: ["seat_id", "messages", "responses_7d", "response_rate"], rows: expected },
    diagnostics: diagnostics.filter((d) => JSON.stringify(d.rows) !== JSON.stringify(expected)),
  };
}
