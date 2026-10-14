/* ABB-L1-03 — Host response time: median minutes to the first real host reply (SQL).
   Simulated practice scenario. All data is generated from the seed.

   Contract: see docs/COMPANY-INTERVIEW-LOOPS.md § Executable templates (sql).
   The oracle below scans each inquiry's messages in JavaScript and takes the median by
   sorting; the evaluator's reference uses MIN … FILTER and PERCENTILE_CONT.
   level: 1 Medium (automated replies and the guest's own follow-ups are not replies; a reply
            at exactly 24 hours; unanswered inquiries stay in the denominator)
          2 Hard (+ a reporting window on the inquiry's creation, replies after the window
            still count; messages from support; a minimum-inquiries floor; a host with no
            answered inquiry)
          3 Very Hard (+ co-hosts: a reply from any co-host of the listing counts for the
            listing's host; co-hosts' automated messages do not) */
import { insertSQL } from "../../js/rng.js";

export const kind = "sql";

const BASE = Date.UTC(2026, 6, 1) / 1000;                 // 2026-07-01 00:00:00 UTC
const fmt = (sec) => new Date(sec * 1000).toISOString().slice(0, 19).replace("T", " ") + "+00";
const MIN = 60, DAYS = 86400;

export function generate(r, level) {
  const nHosts = level === 1 ? 4 : 5 + r.int(0, 1);
  const minInq = level === 1 ? 1 : r.pick([3, 4]);
  // Reporting window on created_at (Hard+). At Medium it spans every inquiry, so it filters nothing.
  const w0 = level === 1 ? BASE : BASE + r.int(1, 5) * DAYS;
  const w1 = level === 1 ? BASE + 40 * DAYS : w0 + r.pick([14, 21]) * DAYS;

  const hosts = [];
  const listings = [];   // {id, host}
  const cohosts = [];    // {listing, user}
  const inquiries = [];  // {id, listing, guest, at}
  const messages = [];   // {id, inquiry, sender, at, auto}
  let hid = 200 + r.int(0, 700), lid = 1000 + r.int(0, 8000), iq = 40000 + r.int(0, 9000), mid = 1;
  let uid = 500 + r.int(0, 400);

  for (let h = 0; h < nHosts; h++) {
    const host = "host_" + (hid += r.int(1, 40));
    hosts.push(host);
    const nl = r.int(1, 2);
    for (let k = 0; k < nl; k++) {
      const l = { id: "lst_" + (lid += r.int(1, 90)), host };
      listings.push(l);
      if (level === 3 && r.chance(0.6)) cohosts.push({ listing: l.id, user: "usr_" + (uid += r.int(1, 30)) });
    }
  }
  const lOf = (host) => listings.filter((l) => l.host === host);
  const msg = (inq, sender, at, auto) => messages.push({ id: 0, inquiry: inq.id, sender, at, auto });
  const newInq = (host, at) => {
    const l = r.pick(lOf(host));
    const inq = { id: "inq_" + (iq += r.int(1, 25)), listing: l.id, host, guest: "gst_" + r.int(1000, 9999), at };
    inquiries.push(inq);
    msg(inq, inq.guest, at, false);                                   // the guest's opening message
    return inq;
  };
  const replier = (inq) => {
    const co = cohosts.filter((c) => c.listing === inq.listing).map((c) => c.user);
    return co.length && r.chance(0.5) ? r.pick(co) : inq.host;
  };
  // A realistic thread: maybe an automated reply, maybe guest follow-ups, maybe support, then a reply.
  const thread = (inq, replyMin) => {
    if (r.chance(0.5)) msg(inq, level === 3 && r.chance(0.5) ? replier(inq) : inq.host, inq.at + r.int(0, 2) * MIN, true);
    if (r.chance(0.4)) msg(inq, inq.guest, inq.at + r.int(3, 90) * MIN, false);
    if (level >= 2 && r.chance(0.25)) msg(inq, "support", inq.at + r.int(5, 200) * MIN, false);
    if (replyMin !== null) {
      msg(inq, replier(inq), inq.at + replyMin * MIN, false);
      if (r.chance(0.4)) msg(inq, inq.host, inq.at + (replyMin + r.int(1, 300)) * MIN, false);   // later replies
    }
  };
  const replyDelay = () => (r.chance(0.18) ? null : r.pick([r.int(1, 59), r.int(30, 600), r.int(60, 1400), r.int(1000, 4000)]));
  const inWindowAt = () => (level === 1 ? BASE + r.int(0, 20 * 24 * 60) * MIN : w0 + r.int(0, (w1 - w0) / MIN - 1) * MIN);

  for (const host of hosts) {
    const n = r.int(2, 6);
    for (let k = 0; k < n; k++) thread(newInq(host, inWindowAt()), replyDelay());
  }
  // Every level: replies at exactly 24 hours (counts) and one minute later (does not).
  const [hA, hB] = r.sample(hosts, 2);
  thread(newInq(hA, inWindowAt()), 1440);
  thread(newInq(hB, inWindowAt()), 1441);
  // Every level: an automated reply in seconds, then the real reply hours later.
  {
    const inq = newInq(r.pick(hosts), inWindowAt());
    msg(inq, inq.host, inq.at + MIN, true);
    msg(inq, inq.guest, inq.at + 2 * MIN, false);
    msg(inq, inq.host, inq.at + r.int(120, 900) * MIN, false);
  }
  if (level >= 2) {
    // Inquiries on both edges of the window: created at w0 counts, at w1 does not.
    const hC = r.pick(hosts);
    thread(newInq(hC, w0), r.int(10, 400));
    thread(newInq(hC, w1), r.int(10, 400));
    thread(newInq(r.pick(hosts), w0 - r.int(1, 600) * MIN), r.int(10, 400));
    // Created just before the end, answered after it: the reply still counts.
    thread(newInq(r.pick(hosts), w1 - r.int(5, 60) * MIN), r.int(100, 1200));
    // A host who answered nothing in the window, with enough inquiries to pass the floor.
    const quiet = "host_" + (hid += r.int(1, 40));
    hosts.push(quiet);
    listings.push({ id: "lst_" + (lid += r.int(1, 90)), host: quiet });
    for (let k = 0; k < minInq; k++) {
      const inq = newInq(quiet, inWindowAt());
      msg(inq, quiet, inq.at + r.int(0, 1) * MIN, true);
      if (r.chance(0.5)) msg(inq, "support", inq.at + r.int(30, 300) * MIN, false);
    }
    // A host below the floor.
    const small = "host_" + (hid += r.int(1, 40));
    hosts.push(small);
    listings.push({ id: "lst_" + (lid += r.int(1, 90)), host: small });
    for (let k = 0; k < minInq - 1; k++) thread(newInq(small, inWindowAt()), r.int(5, 300));
  }
  if (level === 3) {
    // A co-host answers in minutes; the host only hours later.
    const l = listings.find((x) => cohosts.some((c) => c.listing === x.id)) || listings[0];
    if (!cohosts.some((c) => c.listing === l.id)) cohosts.push({ listing: l.id, user: "usr_" + (uid += r.int(1, 30)) });
    const co = cohosts.find((c) => c.listing === l.id).user;
    const inq = { id: "inq_" + (iq += r.int(1, 25)), listing: l.id, host: l.host, guest: "gst_" + r.int(1000, 9999), at: inWindowAt() };
    inquiries.push(inq);
    msg(inq, inq.guest, inq.at, false);
    msg(inq, co, inq.at + r.int(5, 40) * MIN, false);
    msg(inq, l.host, inq.at + r.int(300, 900) * MIN, false);
  }

  messages.sort((x, y) => x.at - y.at || (x.inquiry < y.inquiry ? -1 : x.inquiry > y.inquiry ? 1 : 0));
  messages.forEach((m) => (m.id = mid += r.int(1, 7)));

  const solve = (o = {}) => {
    const per = new Map();
    for (const inq of inquiries) {
      if (level >= 2 && !o.noWindow && !(inq.at >= w0 && inq.at < w1)) continue;
      const side = new Set([inq.host]);
      if (!o.noCohost) for (const c of cohosts) if (c.listing === inq.listing) side.add(c.user);
      let first = null;
      for (const m of messages) {
        if (m.inquiry !== inq.id) continue;
        if (m.auto && !o.countAuto) continue;
        const ok = o.anyoneButGuest ? m.sender !== inq.guest : o.anyAfter ? m.at > inq.at : side.has(m.sender);
        if (!ok) continue;
        if (first === null || m.at < first) first = m.at;
      }
      if (!per.has(inq.host)) per.set(inq.host, { n: 0, mins: [] });
      const s = per.get(inq.host);
      s.n++;
      if (first !== null) s.mins.push((first - inq.at) / MIN);
    }
    const out = [];
    for (const host of [...per.keys()].sort()) {
      const s = per.get(host);
      if (!o.noFloor && s.n < minInq) continue;
      const within = s.mins.filter((x) => (o.strict24 ? x < 1440 : x <= 1440)).length;
      const den = o.answeredDen ? s.mins.length : s.n;
      const share = den === 0 ? null : Math.floor((within * 20000 + den) / (2 * den)) / 10000;
      const m = s.mins.slice().sort((a, b) => a - b);
      let median = null;
      if (m.length) {
        if (o.mean) median = Math.round((m.reduce((a, b) => a + b, 0) / m.length) * 10) / 10;
        else median = m.length % 2 ? m[(m.length - 1) / 2] : (m[m.length / 2 - 1] + m[m.length / 2]) / 2;
      }
      out.push([host, s.n, s.mins.length, within, share, median]);
    }
    return out;
  };
  const rows = solve();

  const diagnostics = [
    { message: "Automated replies were counted. An instant automated message is not a host reply.", rows: solve({ countAuto: true }) },
    { message: "The first later message from anyone was counted, including the guest's own follow-ups. Only the host side's messages are replies.", rows: solve({ anyAfter: true }) },
    { message: "The 24-hour share was taken over answered inquiries only. Unanswered inquiries stay in the denominator.", rows: solve({ answeredDen: true }) },
    { message: "A reply at exactly 24 hours (1440 minutes) was not counted. Within 24 hours is inclusive.", rows: solve({ strict24: true }) },
    { message: "That is the mean, not the median. A few slow replies pull the mean far from the typical response.", rows: solve({ mean: true }) },
  ];
  if (level >= 2) {
    diagnostics.push({ message: "Messages from support were counted as host replies. Only the host side's messages count.", rows: solve({ anyoneButGuest: true }) });
    diagnostics.push({ message: "The reporting window was ignored. Only inquiries created in [window_start, window_end) belong in the report; their replies count whenever they came.", rows: solve({ noWindow: true }) });
    diagnostics.push({ message: "Hosts below the minimum number of inquiries were reported.", rows: solve({ noFloor: true }) });
  }
  if (level === 3) diagnostics.push({ message: "Co-host replies were ignored. A reply from a co-host of the inquiry's listing counts for the listing's host.", rows: solve({ noCohost: true }) });

  const cmp = (x, y) => (x < y ? -1 : x > y ? 1 : 0);
  const lCols = ["listing_id", "host_id"];
  const lRows = listings.slice().sort((x, y) => cmp(x.id, y.id)).map((l) => [l.id, l.host]);
  const cCols = ["listing_id", "user_id"];
  const cRows = cohosts.slice().sort((x, y) => cmp(x.listing, y.listing) || cmp(x.user, y.user)).map((c) => [c.listing, c.user]);
  const iCols = ["inquiry_id", "listing_id", "guest_id", "created_at"];
  const iRows = inquiries.slice().sort((x, y) => cmp(x.id, y.id)).map((i) => [i.id, i.listing, i.guest, fmt(i.at)]);
  const mCols = ["message_id", "inquiry_id", "sender_id", "sent_at", "is_automated"];
  const mRows = messages.map((m) => [m.id, m.inquiry, m.sender, fmt(m.at), m.auto]);
  let setup =
    "SET TIME ZONE 'UTC';\n" +
    "CREATE TABLE listings (\n  listing_id TEXT PRIMARY KEY,\n  host_id TEXT NOT NULL\n);\n";
  setup += "CREATE TABLE listing_cohosts (\n  listing_id TEXT NOT NULL REFERENCES listings(listing_id),\n  user_id TEXT NOT NULL,\n  PRIMARY KEY (listing_id, user_id)\n);\n";
  setup +=
    "CREATE TABLE inquiries (\n  inquiry_id TEXT PRIMARY KEY,\n  listing_id TEXT NOT NULL REFERENCES listings(listing_id),\n  guest_id TEXT NOT NULL,\n  created_at TIMESTAMPTZ NOT NULL\n);\n" +
    "CREATE TABLE messages (\n  message_id BIGINT PRIMARY KEY,\n  inquiry_id TEXT NOT NULL REFERENCES inquiries(inquiry_id),\n  sender_id TEXT NOT NULL,\n  sent_at TIMESTAMPTZ NOT NULL,\n  is_automated BOOLEAN NOT NULL\n);\n" +
    insertSQL("listings", lCols, lRows) + insertSQL("listing_cohosts", cCols, cRows) +
    insertSQL("inquiries", iCols, iRows) + insertSQL("messages", mCols, mRows);

  const tables = [{ name: "listings", columns: lCols, rows: lRows }, { name: "listing_cohosts", columns: cCols, rows: cRows }];
  tables.push({ name: "inquiries", columns: iCols, rows: iRows }, { name: "messages", columns: mCols, rows: mRows });

  return {
    vars: {
      window_start: fmt(w0),
      window_end: fmt(w1),
      min_inquiries: minInq,
      scope_rule: level === 1
        ? "Report every inquiry in the table, for every host with at least one."
        : `Report inquiries created in [\`${fmt(w0)}\`, \`${fmt(w1)}\`); a reply sent after the window still counts. Only hosts with at least ${minInq} such inquiries appear.`,
      host_rule: level === 3
        ? "The host side of an inquiry is the listing's `host_id` and every co-host in `listing_cohosts` for that listing; a reply from any of them counts, and the row belongs to the listing's `host_id`."
        : level === 2
          ? "The host side of an inquiry is the listing's `host_id` (`listing_cohosts` is empty in this sample). Messages from `support` or the guest are never replies."
          : "The host side of an inquiry is the listing's `host_id` (`listing_cohosts` is empty in this sample). The guest's own messages are never replies.",
    },
    setup,
    tables,
    expected: { columns: ["host_id", "inquiries", "answered", "within_24h", "share_within_24h", "median_response_minutes"], rows },
    diagnostics: diagnostics.filter((d) => JSON.stringify(d.rows) !== JSON.stringify(rows)),
  };
}
