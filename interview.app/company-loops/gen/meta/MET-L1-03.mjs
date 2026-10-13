/* MET-L1-03 — Group message delivery receipts: messages slower than the SLA (SQL).
   Simulated practice scenario. All data is generated from the seed. Metadata only:
   the tables hold no message content.

   Contract: see docs/COMPANY-INTERVIEW-LOOPS.md § Executable templates (sql).
   level: 1 Medium (static membership; delivered receipts, duplicated across devices)
          2 Hard (+ members who joined or left around the send; read receipts that
                  arrive without, or before, the delivered receipt)
          3 Very Hard (+ receipts from the sender's own devices and from non-recipients,
                       a member who left and rejoined, a message with no recipients) */
import { insertSQL } from "../../js/rng.js";

export const kind = "sql";

const CHATS = ["chat_book_club", "chat_climbing", "chat_family", "chat_flatmates", "chat_project_x", "chat_running", "chat_dm_1", "chat_dm_2"];
const DAY0 = Date.UTC(2026, 9, 5);             // 2026-10-05 00:00:00 UTC; times are seconds from here

export function generate(r, level) {
  const sla = r.pick([5, 10, 30, 60]);
  const startH = r.pick([6, 8, 9, 12]);
  const spanH = r.pick([4, 6]);
  const start = startH * 3600, end = start + spanH * 3600;

  const userPool = r.sample([...Array(50)].map((_, i) => 40_100 + i * 11 + r.int(0, 10)), 22);
  let up = 0;
  const nextUser = () => userPool[up++];
  const chats = [];
  const dm = r.sample(CHATS.filter((c) => c.startsWith("chat_dm")), 1)[0];
  const groups = r.sample(CHATS.filter((c) => !c.startsWith("chat_dm")), level === 1 ? 2 : 3).sort();
  chats.push({ chat_id: dm, users: [nextUser(), nextUser()] });
  for (const g of groups) chats.push({ chat_id: g, users: [...Array(r.int(3, 5))].map(nextUser) });

  const members = [];                         // {chat_id, user_id, joined, left|null}
  for (const c of chats) for (const u of c.users) members.push({ chat_id: c.chat_id, user_id: u, joined: start - r.int(1, 90) * 86400, left: null });

  const msgs = [];                            // {id, chat_id, sender, sec}
  let mid = 9_100_000 + r.int(0, 800_000);
  const addMsg = (chat_id, sender, sec) => { const m = { id: mid, chat_id, sender, sec }; mid += r.int(1, 40); msgs.push(m); return m; };
  for (const c of chats) {
    const n = r.int(3, 5);
    for (let k = 0; k < n; k++) addMsg(c.chat_id, r.pick(c.users), start + r.int(0, spanH * 3600 - 1));
  }
  const outside = [
    addMsg(chats[1].chat_id, chats[1].users[0], start - r.int(1, 1800)),  // before the window
    addMsg(chats[0].chat_id, chats[0].users[1], end),                     // exactly at its end: excluded
  ];

  // Membership changes around a send (level >= 2).
  if (level >= 2) {
    const g = chats[1];
    const m = addMsg(g.chat_id, g.users[0], start + r.int(600, 3600));
    const newcomer = nextUser(), leaver = g.users[g.users.length - 1], atSend = nextUser();
    members.push({ chat_id: g.chat_id, user_id: newcomer, joined: m.sec + r.int(1, 600), left: null });     // joined after: not a recipient
    members.push({ chat_id: g.chat_id, user_id: atSend, joined: m.sec, left: null });                       // joined at the send: a recipient
    members.find((x) => x.chat_id === g.chat_id && x.user_id === leaver).left = m.sec;                      // left at the send: not a recipient
    g.users.push(newcomer, atSend);
  }
  if (level === 3) {
    const g = chats[2];
    const back = g.users[1];
    const row = members.find((x) => x.chat_id === g.chat_id && x.user_id === back);
    const gone = start + r.int(100, 1200);
    row.left = gone;
    members.push({ chat_id: g.chat_id, user_id: back, joined: gone + r.int(1800, 5400), left: null });      // left, then rejoined
    addMsg(g.chat_id, g.users[0], gone + r.int(60, 1500));                                                 // sent while away
    // A chat whose only other member has left: a message with no recipients.
    const solo = { chat_id: "chat_dm_" + (dm === "chat_dm_1" ? "2" : "1"), users: [nextUser(), nextUser()] };
    chats.push(solo);
    members.push({ chat_id: solo.chat_id, user_id: solo.users[0], joined: start - 86400 * 10, left: null });
    members.push({ chat_id: solo.chat_id, user_id: solo.users[1], joined: start - 86400 * 10, left: start - 600 });
    addMsg(solo.chat_id, solo.users[0], start + r.int(60, 3600));
  }

  const isMember = (chat_id, u, sec) => members.some((m) => m.chat_id === chat_id && m.user_id === u && m.joined <= sec && (m.left === null || m.left > sec));
  for (const m of msgs) {                     // only a member can send
    if (!isMember(m.chat_id, m.sender, m.sec)) m.sender = chats.find((c) => c.chat_id === m.chat_id).users[0];
  }
  const recipientsOf = (m) => [...new Set(members.filter((x) => x.chat_id === m.chat_id).map((x) => x.user_id))].filter((u) => u !== m.sender && isMember(m.chat_id, u, m.sec)).sort((a, b) => a - b);

  // Receipts.
  const receipts = [];                        // {message_id, user_id, type, sec}
  const delays = [1, 2, 3, 4, 6, 8];
  const slow = [sla, sla + 1, sla + r.int(5, 400), 3 * sla + r.int(0, 900)];
  msgs.sort((a, b) => a.id - b.id);
  const plantSlow = msgs.find((m) => m.sec >= start && m.sec < end && recipientsOf(m).length >= 2);
  const plantExact = msgs.find((m) => m !== plantSlow && m.sec >= start && m.sec < end && recipientsOf(m).length >= 1);
  for (const m of msgs) {
    const rec = recipientsOf(m);
    rec.forEach((u, i) => {
      let d = r.chance(0.8) ? r.pick(delays) : r.pick(slow);
      if (m === plantSlow && i === rec.length - 1) d = sla + r.int(1, 120);
      if (m === plantExact) d = i === 0 ? sla : Math.min(sla, r.pick(delays));
      if (outside.includes(m)) d = sla + r.int(1, 300);                              // slow, but outside the window
      if (m !== plantSlow && m !== plantExact && !outside.includes(m) && r.chance(0.07)) return;            // offline: no receipt yet
      const readOnly = level >= 2 && r.chance(0.2) && m !== plantExact;
      if (readOnly) receipts.push({ message_id: m.id, user_id: u, type: "read", sec: m.sec + d });
      else {
        receipts.push({ message_id: m.id, user_id: u, type: "delivered", sec: m.sec + d });
        if (r.chance(0.3)) receipts.push({ message_id: m.id, user_id: u, type: "delivered", sec: m.sec + d + r.int(1, 900) });    // a second device
        if (r.chance(0.4)) receipts.push({ message_id: m.id, user_id: u, type: "read", sec: m.sec + d + r.int(level >= 2 && m !== plantExact && m !== plantSlow ? -1 : 0, 1200) });
      }
    });
    if (level === 3) {
      if (r.chance(0.35)) receipts.push({ message_id: m.id, user_id: m.sender, type: "delivered", sec: m.sec + r.int(1, 20) });   // sender's other device
    }
  }
  if (level >= 2) {
    // A read receipt earlier than the delivered one (clock skew between devices): the earliest wins.
    const m = msgs.find((x) => x !== plantSlow && x !== plantExact && x.sec >= start && x.sec < end && recipientsOf(x).length);
    const u = recipientsOf(m)[0];
    for (let i = receipts.length - 1; i >= 0; i--) if (receipts[i].message_id === m.id && receipts[i].user_id === u) receipts.splice(i, 1);
    const dSlow = sla + r.int(5, 200);
    receipts.push({ message_id: m.id, user_id: u, type: "delivered", sec: m.sec + dSlow });
    receipts.push({ message_id: m.id, user_id: u, type: "read", sec: m.sec + r.int(1, Math.max(1, sla - 1)) });
  }
  if (level === 3) {
    // A receipt from someone who was not a member at the send (the newcomer, on a later sync).
    const g = chats[1];
    const m = msgs.find((x) => x.chat_id === g.chat_id && x.sec >= start && x.sec < end && !isMember(g.chat_id, g.users[g.users.length - 2], x.sec));
    if (m) receipts.push({ message_id: m.id, user_id: g.users[g.users.length - 2], type: "delivered", sec: m.sec + 2 });
  }

  // Oracle.
  const compute = (o) => {
    const out = [];
    for (const m of msgs) {
      if (o.closedEnd ? m.sec > end : m.sec >= end) continue;
      if (m.sec < start) continue;
      let rec;
      if (o.currentMembers) rec = [...new Set(members.filter((x) => x.chat_id === m.chat_id && x.left === null).map((x) => x.user_id))].filter((u) => u !== m.sender);
      else rec = recipientsOf(m);
      if (o.withSender) rec = [...new Set([...rec, m.sender])];
      let who = rec;
      if (o.anyReceipt) who = [...new Set([...rec, ...receipts.filter((x) => x.message_id === m.id && x.user_id !== m.sender).map((x) => x.user_id)])];
      if (who.length === 0) continue;
      let delivered = 0, maxT = -Infinity, complete = true;
      for (const u of who) {
        const mine = receipts.filter((x) => x.message_id === m.id && x.user_id === u && (o.ignoreRead ? x.type === "delivered" : true));
        if (!mine.length) { complete = false; continue; }
        delivered++;
        const t = o.latest ? Math.max(...mine.map((x) => x.sec)) : Math.min(...mine.map((x) => x.sec));
        maxT = Math.max(maxT, t);
      }
      const secs = complete ? maxT - m.sec : null;
      if (secs === null || (o.ge ? secs >= sla : secs > sla)) out.push([m.id, m.chat_id, who.length, delivered, secs]);
    }
    return out;
  };
  const rows = compute({});

  const diagnostics = [
    { message: `A message sent exactly at ${hhmm(end)} was included. The window is half-open: sent_at < end.`, rows: compute({ closedEnd: true }) },
    { message: `A message delivered in exactly ${sla} seconds was reported. Only deliveries that took more than ${sla} seconds are slow.`, rows: compute({ ge: true }) },
    { message: "A later receipt (another device, or a read) set the delivery time. A recipient's delivery time is their earliest receipt.", rows: compute({ latest: true }) },
  ];
  if (level >= 2) {
    diagnostics.push({ message: "Read receipts were ignored. A read implies delivery: a recipient whose only receipt is a read was delivered at that time.", rows: compute({ ignoreRead: true }) });
    diagnostics.push({ message: "Recipients were taken from today's membership. They are the members at sent_at: joined_at <= sent_at and (left_at IS NULL or left_at > sent_at).", rows: compute({ currentMembers: true }) });
  }
  if (level === 3) {
    diagnostics.push({ message: "The sender was counted as a recipient. Receipts from the sender's own devices are sync, not delivery.", rows: compute({ withSender: true }) });
    diagnostics.push({ message: "Anyone with a receipt was counted as a recipient. Only members at sent_at are recipients; receipts from others are ignored.", rows: compute({ anyReceipt: true }) });
  }

  const mCols = ["message_id", "chat_id", "sender_id", "sent_at"];
  const mRows = msgs.map((m) => [m.id, m.chat_id, m.sender, at(m.sec)]);
  const cCols = ["chat_id", "user_id", "joined_at", "left_at"];
  const cRows = members.map((x) => [x.chat_id, x.user_id, at(x.joined), x.left === null ? null : at(x.left)]).sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] - b[1] || (a[2] < b[2] ? -1 : 1)));
  const rCols = ["message_id", "recipient_id", "receipt_type", "receipt_ts"];
  const rRows = receipts.map((x) => [x.message_id, x.user_id, x.type, at(x.sec)]).sort((a, b) => a[0] - b[0] || (a[3] < b[3] ? -1 : a[3] > b[3] ? 1 : a[1] - b[1] || (a[2] < b[2] ? -1 : 1)));

  const setup =
    "SET TIME ZONE 'UTC';\n" +
    "CREATE TABLE messages (\n  message_id BIGINT PRIMARY KEY,\n  chat_id TEXT NOT NULL,\n  sender_id BIGINT NOT NULL,\n  sent_at TIMESTAMPTZ NOT NULL\n);\n" +
    "CREATE TABLE chat_members (\n  chat_id TEXT NOT NULL,\n  user_id BIGINT NOT NULL,\n  joined_at TIMESTAMPTZ NOT NULL,\n  left_at TIMESTAMPTZ\n);\n" +
    "CREATE TABLE receipts (\n  message_id BIGINT NOT NULL REFERENCES messages,\n  recipient_id BIGINT NOT NULL,\n  receipt_type TEXT NOT NULL CHECK (receipt_type IN ('delivered','read')),\n  receipt_ts TIMESTAMPTZ NOT NULL\n);\n" +
    insertSQL("messages", mCols, mRows) + insertSQL("chat_members", cCols, cRows) + insertSQL("receipts", rCols, rRows);

  return {
    vars: {
      sla,
      start: at(start),
      end: at(end),
      member_rule:
        level === 1
          ? "Membership did not change during the window (every `left_at` is NULL)."
          : level === 2
            ? "Members join and leave; recipients are the members at `sent_at`."
            : "Members join and leave, and can leave and rejoin (one row per stay); recipients are the members at `sent_at`. A message whose chat had no other member at `sent_at` has no recipients and is not reported.",
      receipt_rule:
        level === 1
          ? "A recipient on several devices can send several delivered receipts."
          : level === 2
            ? "A recipient can send several receipts (several devices); a read receipt implies delivery and can arrive without a delivered receipt, or carry an earlier time."
            : "A recipient can send several receipts; a read implies delivery. The sender's own devices also send receipts, and a device that synced history after joining can send a receipt for a message it was never a recipient of: neither counts.",
    },
    setup,
    tables: [
      { name: "messages", columns: mCols, rows: mRows },
      { name: "chat_members", columns: cCols, rows: cRows },
      { name: "receipts", columns: rCols, rows: rRows },
    ],
    expected: { columns: ["message_id", "chat_id", "recipients", "delivered_recipients", "delivery_seconds"], rows },
    diagnostics: diagnostics.filter((d) => JSON.stringify(d.rows) !== JSON.stringify(rows)),
  };
}

function at(sec) {
  return new Date(DAY0 + sec * 1000).toISOString().replace("T", " ").replace(".000Z", "+00");
}
function hhmm(sec) { return at(sec).slice(11, 16) + " UTC"; }
