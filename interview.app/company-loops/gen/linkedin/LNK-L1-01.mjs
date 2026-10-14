/* LNK-L1-01 — Invitation acceptance within 14 days, by sender region and month (SQL).
   Simulated practice scenario. All data is generated from the seed; every member id,
   region and number is hypothetical. The output is an aggregate per region and month,
   never a list of members.

   Contract: see docs/COMPANY-INTERVIEW-LOOPS.md § Executable templates (sql).
   level: 1 Medium (withdrawn invitations excluded; inclusive 14-day window; month of the send)
          2 Hard (+ resends to the same member collapse into one invitation dated at its first
            send, chain gaps exactly at the resend limit, a minimum-invitations floor)
          3 Very Hard (+ the sender's region as of the first send, from a region history;
            chains of three sends) */
import { insertSQL } from "../../js/rng.js";

export const kind = "sql";

const REGIONS = ["apac", "emea", "latam", "na"];
const DAY = 86400;
const WINDOW = 14 * DAY;
const START = Date.UTC(2026, 7, 1) / 1000;          // 2026-08-01 00:00:00 UTC
const END = Date.UTC(2026, 9, 1) / 1000;            // 2026-10-01 00:00:00 UTC (exclusive)
const fmt = (s) => new Date(s * 1000).toISOString().replace("T", " ").slice(0, 19) + "+00";
const monthOf = (s) => new Date(s * 1000).toISOString().slice(0, 7) + "-01";

export function generate(r, level) {
  const resendDays = r.pick([7, 10, 14, 30]);
  const minInvites = level === 1 ? 1 : r.int(3, 4);
  const regions = r.shuffle(REGIONS);
  const main = regions.slice(0, 3);
  const small = regions[3];

  let memberId = r.int(100000, 900000);
  let recipientId = r.int(2000000, 8000000);
  const nextMember = () => (memberId += r.int(1, 97));
  const nextRecipient = () => (recipientId += r.int(1, 997));

  const history = [];            // {member, region, from}
  const senders = [];
  for (const reg of main) for (let i = 0; i < 3; i++) {
    const id = nextMember();
    senders.push(id);
    history.push({ member: id, region: reg, from: Date.UTC(2026, 0, 1) / 1000 });
  }

  const chains = [];             // {sender, recipient, sends: [t], st: [status...], at: [time|null]}
  // A chain of sends: earlier sends were withdrawn before the next one went out.
  const makeChain = (sender, recipient, t0, opts = {}) => {
    const n = opts.rows || (level === 1 ? 1 : level === 2 ? (r.chance(0.35) ? 2 : 1) : r.pick([1, 1, 2, 3]));
    const sends = [t0];
    for (let k = 1; k < n; k++) {
      const gap = r.chance(0.25) ? resendDays * DAY : r.int(DAY, resendDays * DAY - 1);
      sends.push(sends[k - 1] + gap);
    }
    const st = [], at = [];
    for (let k = 0; k < n - 1; k++) { st.push("withdrawn"); at.push(sends[k] + r.int(3600, sends[k + 1] - sends[k] - 1)); }
    const last = sends[n - 1];
    const final = opts.final || r.pick(["accepted", "accepted", "accepted", "ignored", "pending", "withdrawn"]);
    let fAt = null;
    if (final === "accepted") {
      const choices = [];
      if (t0 + WINDOW > last + 60) choices.push(t0 + WINDOW, r.int(last + 60, t0 + WINDOW), r.int(last + 60, t0 + WINDOW), r.int(last + 60, t0 + WINDOW));
      choices.push(t0 + WINDOW + 1, r.int(Math.max(last, t0 + WINDOW) + 1, Math.max(last, t0 + WINDOW) + 30 * DAY));
      fAt = opts.acceptAt !== undefined && opts.acceptAt > last ? opts.acceptAt : r.pick(choices);
    } else if (final !== "pending") fAt = last + r.int(3600, 20 * DAY);
    st.push(final); at.push(fAt);
    const c = { sender, recipient, sends, st, at };
    chains.push(c);
    return c;
  };

  for (const s of senders) {
    const nChains = r.int(4, level === 1 ? 6 : 7);
    for (let i = 0; i < nChains; i++) {
      const t0 = r.int(START, END - 1);
      const c = makeChain(s, nextRecipient(), t0);
      // Hard+: the same member invited again after the resend limit is a new invitation.
      if (level >= 2 && c.st[c.st.length - 1] !== "accepted" && r.chance(0.3)) {
        const lastSend = c.sends[c.sends.length - 1];
        const t1 = lastSend + resendDays * DAY + (r.chance(0.5) ? 1 : r.int(3600, 10 * DAY));
        if (t1 < END) makeChain(s, c.recipient, t1, { rows: 1 });
      }
    }
  }
  // Every level: an invitation sent in the last minute of August, accepted in September.
  makeChain(r.pick(senders), nextRecipient(), Date.UTC(2026, 7, 31, 23, 59) / 1000 + r.int(0, 59),
    { rows: 1, final: "accepted", acceptAt: Date.UTC(2026, 8, 1) / 1000 + r.int(3600, 5 * DAY) });
  // Every level: accepted exactly 14 days after the send (counted) and one second later (not).
  {
    const t0 = r.int(START, START + 20 * DAY);
    makeChain(r.pick(senders), nextRecipient(), t0, { rows: 1, final: "accepted", acceptAt: t0 + WINDOW });
    const t1 = r.int(START + 25 * DAY, END - 1);
    makeChain(r.pick(senders), nextRecipient(), t1, { rows: 1, final: "accepted", acceptAt: t1 + WINDOW + 1 });
  }
  if (level >= 2) {
    // A resend crossing into September: the invitation belongs to August, timed from the first send.
    const t0 = Date.UTC(2026, 7, 30) / 1000 + r.int(0, DAY);
    makeChain(r.pick(senders), nextRecipient(), t0, { rows: 2, final: "accepted", acceptAt: t0 + WINDOW - r.int(60, 3600) });
    // A resend sent exactly at the limit, accepted soon after: one invitation, late if timed from the resend.
    const t1 = r.int(START, START + 10 * DAY);
    const c = makeChain(r.pick(senders), nextRecipient(), t1, { rows: 1, final: "withdrawn" });
    c.at[0] = t1 + r.int(3600, DAY);
    c.sends.push(t1 + resendDays * DAY);
    c.st.push("accepted");
    c.at.push(t1 + resendDays * DAY + r.int(60, 2 * DAY));
    // The floor: a sender alone in a small region, exactly at the floor in August, one short in September.
    const lone = nextMember();
    history.push({ member: lone, region: small, from: Date.UTC(2026, 0, 1) / 1000 });
    for (let i = 0; i < minInvites; i++) makeChain(lone, nextRecipient(), r.int(START + DAY, START + 28 * DAY), { rows: 1, final: r.pick(["accepted", "ignored"]) });
    for (let i = 0; i < minInvites - 1; i++) makeChain(lone, nextRecipient(), r.int(START + 32 * DAY, END - DAY), { rows: 1, final: r.pick(["accepted", "ignored"]) });
  }
  if (level === 3) {
    // Two senders move region mid-window. One invitation starts exactly at the move; one starts before it and is resent after.
    for (const s of r.sample(senders, 2)) {
      const old = history.find((h) => h.member === s).region;
      const move = r.int(START + 20 * DAY, START + 40 * DAY);
      history.push({ member: s, region: r.pick(main.filter((x) => x !== old)), from: move });
      makeChain(s, nextRecipient(), move, { rows: 1, final: "accepted", acceptAt: move + r.int(3600, 5 * DAY) });
      const t0 = move - r.int(DAY, 3 * DAY);
      const c = makeChain(s, nextRecipient(), t0, { rows: 1, final: "withdrawn" });
      c.at[0] = t0 + 3600;
      c.sends.push(move + 3600);
      c.st.push("accepted");
      c.at.push(move + 2 * 3600);
    }
  }

  // Rows. Invitation ids are not in time order.
  const rows = [];
  for (const c of chains) c.sends.forEach((t, k) => rows.push({ sender: c.sender, recipient: c.recipient, sent: t, status: c.st[k], at: c.at[k] }));
  const ids = r.shuffle(rows.map((_, i) => i));
  const base = r.int(10_000_000, 90_000_000);
  rows.forEach((x, i) => { x.id = base + ids[i] * r.int(1, 3) * 7 + i; });
  {
    const seen = new Set();
    for (const x of rows) { while (seen.has(x.id)) x.id += 1; seen.add(x.id); }
  }

  // Oracle: rebuild invitations from the rows, independently of the generator's chain objects.
  const cmp = (x, y) => (x < y ? -1 : x > y ? 1 : 0);
  const regionAt = (member, t, current) => {
    const hs = history.filter((h) => h.member === member && (current || h.from <= t)).sort((a, b) => a.from - b.from);
    return hs[hs.length - 1].region;
  };
  const solve = (o = {}) => {
    const byPair = new Map();
    for (const x of rows) {
      const k = x.sender + "|" + x.recipient;
      if (!byPair.has(k)) byPair.set(k, []);
      byPair.get(k).push(x);
    }
    const invs = [];
    for (const list of byPair.values()) {
      list.sort((a, b) => a.sent - b.sent || a.id - b.id);
      let cur = null;
      for (const x of list) {
        if (o.perRow || !cur || x.sent > cur.lastSent + resendDays * DAY) {
          cur = { sender: x.sender, first: x.sent, lastSent: x.sent, status: x.status, at: x.at };
          invs.push(cur);
        } else { cur.lastSent = x.sent; cur.status = x.status; cur.at = x.at; }
      }
    }
    const groups = new Map();
    for (const v of invs) {
      if (v.status === "withdrawn" && !o.keepWithdrawn) continue;
      const k = monthOf(v.first) + "|" + regionAt(v.sender, v.first, o.currentRegion);
      if (!groups.has(k)) groups.set(k, { n: 0, a: 0 });
      const g = groups.get(k);
      g.n++;
      const from = o.fromLast ? v.lastSent : v.first;
      if (v.status === "accepted" && (o.noWindow || (o.exclusive ? v.at < from + WINDOW : v.at <= from + WINDOW))) g.a++;
    }
    const share = (n, d) => Math.floor((n * 20000 + d) / (2 * d)) / 10000;
    return [...groups.entries()]
      .filter(([, g]) => o.noFloor || g.n >= minInvites)
      .sort((x, y) => cmp(x[0], y[0]))
      .map(([k, g]) => { const [m, reg] = k.split("|"); return [m, reg, g.n, g.a, share(g.a, g.n)]; });
  };
  const expected = solve();

  const diagnostics = [
    { message: "Withdrawn invitations were left in the denominator. A withdrawn invitation never reached a decision and is excluded.", rows: solve({ keepWithdrawn: true }) },
    { message: "The 14-day bound was exclusive. An acceptance exactly 14 days after the send is within 14 days.", rows: solve({ exclusive: true }) },
    { message: "Every acceptance was counted, however late. Only acceptances within 14 days of the first send count.", rows: solve({ noWindow: true }) },
  ];
  if (level >= 2) {
    diagnostics.push({ message: "Each send was treated as its own invitation. Sends to the same member within the resend limit of the previous send are one invitation, dated at its first send.", rows: solve({ perRow: true }) });
    diagnostics.push({ message: "The 14 days were measured from the last resend. They run from the invitation's first send.", rows: solve({ fromLast: true }) });
    diagnostics.push({ message: "The minimum-invitations floor was not applied (or was applied before withdrawn invitations were removed).", rows: solve({ noFloor: true }) });
  }
  if (level === 3) diagnostics.push({ message: "The sender's current region was used. The region is the one in force at the invitation's first send (valid_from at or before it).", rows: solve({ currentRegion: true }) });

  const iCols = ["invitation_id", "sender_id", "recipient_id", "sent_at", "status", "status_at"];
  const iRows = rows.slice().sort((a, b) => a.id - b.id).map((x) => [x.id, x.sender, x.recipient, fmt(x.sent), x.status, x.at === null ? null : fmt(x.at)]);
  const hCols = ["member_id", "region", "valid_from"];
  const hRows = history.slice().sort((a, b) => a.member - b.member || a.from - b.from).map((h) => [h.member, h.region, fmt(h.from)]);
  const setup =
    "SET TIME ZONE 'UTC';\n" +
    "CREATE TABLE member_regions (\n  member_id BIGINT NOT NULL,\n  region TEXT NOT NULL,\n  valid_from TIMESTAMPTZ NOT NULL,\n  PRIMARY KEY (member_id, valid_from)\n);\n" +
    "CREATE TABLE invitations (\n  invitation_id BIGINT PRIMARY KEY,\n  sender_id BIGINT NOT NULL,\n  recipient_id BIGINT NOT NULL,\n  sent_at TIMESTAMPTZ NOT NULL,\n  status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'ignored', 'withdrawn')),\n  status_at TIMESTAMPTZ\n);\n" +
    insertSQL("member_regions", hCols, hRows) + insertSQL("invitations", iCols, iRows);

  return {
    vars: {
      invitation_rows: iRows.length,
      resend_days: resendDays,
      min_invites: minInvites,
      resend_rule: level === 1
        ? "In this sample a sender invites a member at most once, so every row is its own invitation."
        : `A sender may invite the same member again. A send to the same member no more than ${resendDays} days after that pair's previous send (exactly ${resendDays} days included) is a resend: all sends in such a chain are one invitation, dated at its first send, and its outcome is the status of its latest send. A send more than ${resendDays} days after the previous one starts a new invitation.`,
      region_rule: level === 3
        ? "Members can move region: `member_regions` holds each member's region history, and the region that counts is the one in force at the invitation's first send (the row with the latest `valid_from` at or before it)."
        : "Each member has a single row in `member_regions` in this sample.",
      floor_rule: level === 1
        ? "Report every month and region with at least one invitation."
        : `Report only months and regions with at least ${minInvites} invitations after withdrawn ones are removed.`,
    },
    setup,
    tables: [
      { name: "member_regions", columns: hCols, rows: hRows },
      { name: "invitations", columns: iCols, rows: iRows },
    ],
    expected: { columns: ["month", "region", "invitations", "accepted_14d", "acceptance_rate"], rows: expected },
    diagnostics: diagnostics.filter((d) => JSON.stringify(d.rows) !== JSON.stringify(expected)),
  };
}
