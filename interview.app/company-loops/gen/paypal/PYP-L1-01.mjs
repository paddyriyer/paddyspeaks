/* PYP-L1-01 — Feed audience per month: the audience each P2P payment was posted with (SQL).
   Simulated practice scenario. All data is generated from the seed.

   Contract: generate(r, level) -> { vars, setup, tables, expected, diagnostics }.
   The oracle below resolves each payment's audience in JavaScript: the override on the
   payment, otherwise the sender's default setting in force at created_at (an as-of
   lookup over the sender's setting history), otherwise this exercise's initial default.
   level: 1 Medium (every sender has a setting row before their first payment; overrides)
          2 Hard (+ declined payments never posted, senders whose first setting row comes
                  after some of their payments, a setting changed at the exact second of
                  a payment)
          3 Very Hard (+ two setting rows at the same second, broken by change_id, and
                  later edits to a posted payment's audience that must be ignored) */
import { insertSQL, ts } from "../../js/rng.js";

export const kind = "sql";

const AUD = ["public", "friends", "private"];
const BASE = "2026-06-01";                  // setting rows may start here
const DAY = 86400;
const P0 = 30 * DAY;                        // 2026-07-01: payments start
const P1 = 122 * DAY;                       // 2026-10-01: payments end (exclusive)

const dayStr = (k) => { const d = new Date(BASE + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + k); return d.toISOString().slice(0, 10); };
const stamp = (s) => ts(dayStr(Math.floor(s / DAY)), s % DAY);
const monthOf = (s) => dayStr(Math.floor(s / DAY)).slice(0, 7) + "-01";
const r4 = (c, n) => Math.floor((2 * c * 10000 + n) / (2 * n)) / 10000;   // ROUND(c / n, 4), half up

export function generate(r, level) {
  const initial = level === 1 ? null : r.pick(["friends", "public"]);
  const nUsers = (level === 1 ? 6 : 8) + r.int(0, 2);
  const base = 1000 + r.int(0, 80) * 10;
  const users = r.shuffle(Array.from({ length: 40 }, (_, i) => "u_" + (base + i * 7))).slice(0, nUsers).sort();

  // Setting history. gen = generation order, so a later-generated row at the same second is "later".
  const settings = [];
  let gen = 0;
  const lateFirst = new Set(level >= 2 ? r.sample(users, 2) : []);
  const firstAt = new Map();
  for (const u of users) {
    const first = lateFirst.has(u) ? r.int(50 * DAY, 95 * DAY) : r.int(0, P0 - 1);
    firstAt.set(u, first);
    settings.push({ user: u, aud: r.pick(AUD), t: first, gen: gen++ });
    const more = r.int(0, 3);
    for (let k = 0; k < more; k++) settings.push({ user: u, aud: r.pick(AUD), t: r.int(Math.max(first + 1, P0), P1 - 1), gen: gen++ });
  }

  const payments = [];
  const addPayment = (sender, t, override, status = "completed") => {
    let rec = r.pick(users);
    while (rec === sender) rec = r.pick(users);
    const p = { sender, recipient: rec, t, override, status, cents: r.pick([500, 1250, 2000, 3500, 4000, 7999, 12000, 25000]) + r.int(0, 99) };
    payments.push(p);
    return p;
  };
  const n = r.int(40, 56) + (level - 1) * 6;
  for (let i = 0; i < n; i++) {
    const declined = level >= 2 && r.chance(0.1);
    addPayment(r.pick(users), r.int(P0, P1 - 1), r.chance(0.22) ? r.pick(AUD) : null, declined ? "declined" : "completed");
  }
  // Month boundaries in UTC: a payment in the last seconds of July and one just after midnight.
  addPayment(r.pick(users), 61 * DAY - r.int(1, 40), null);
  addPayment(r.pick(users), 61 * DAY + r.int(0, 40), null);
  if (level >= 2) {
    // Senders whose first setting row comes later: their earlier payments use the initial default.
    for (const u of lateFirst) addPayment(u, r.int(P0, firstAt.get(u) - 1), null);
  }

  const sorted = () => settings.slice().sort((a, b) => a.t - b.t || a.gen - b.gen);
  const inForce = (u, t, opts = {}) => {
    let best = null;
    for (const s of settings) {
      if (s.user !== u) continue;
      if (opts.strict ? s.t >= t : s.t > t) continue;
      if (!best || s.t > best.t || (s.t === best.t && (opts.lowTie ? s.gen < best.gen : s.gen > best.gen))) best = s;
    }
    return best ? best.aud : null;
  };

  let exactUser = null;
  if (level >= 2) {
    // A setting changed at the exact second of a payment is in force for it.
    const cands = payments.filter((p) => p.status === "completed" && p.override === null && inForce(p.sender, p.t) !== null && !lateFirst.has(p.sender));
    const p = r.pick(cands);
    const cur = inForce(p.sender, p.t);
    exactUser = p.sender;
    settings.push({ user: p.sender, aud: r.pick(AUD.filter((a) => a !== cur)), t: p.t, gen: gen++ });
  }
  if (level === 3) {
    // Two rows at the same second (a double tap): the one with the higher change_id is later.
    const u = r.pick(users.filter((x) => !lateFirst.has(x) && x !== exactUser));
    const t = r.int(70 * DAY, 100 * DAY);
    const cur = inForce(u, t);
    const a1 = r.pick(AUD.filter((a) => a !== cur));
    const a2 = r.pick(AUD.filter((a) => a !== a1));
    settings.push({ user: u, aud: a1, t, gen: gen++ });
    settings.push({ user: u, aud: a2, t, gen: gen++ });
    // Make sure nothing else changes before the payment that shows the tie.
    for (const s of settings) if (s.user === u && s.t > t && s.t <= t + 3 * DAY) s.t = t + 3 * DAY + r.int(1, 3600);
    addPayment(u, t + r.int(60, 2 * DAY), null);
  }

  // change_id follows (changed_at, generation order); payment_id follows created_at.
  const settingRows = sorted().map((s, i) => ({ ...s, id: 501 + i }));
  payments.sort((a, b) => a.t - b.t);
  payments.forEach((p, i) => { p.id = 70001 + i * 3; });

  // Later edits (Very Hard): changes made after posting; they never change the posted audience.
  const edits = [];
  if (level === 3) {
    let eid = 9001;
    for (const p of payments) {
      if (p.status !== "completed" || !r.chance(0.3)) continue;
      const posted = audienceOf(p, {});
      edits.push({ id: eid++, pid: p.id, aud: r.pick(AUD.filter((a) => a !== posted)), t: p.t + r.int(3600, 20 * DAY) });
    }
  }

  function audienceOf(p, o) {
    if (o.lastEdit) {
      const es = edits.filter((e) => e.pid === p.id).sort((a, b) => a.t - b.t);
      if (es.length) return es[es.length - 1].aud;
    }
    if (p.override !== null && !o.noOverride) return p.override;
    if (o.current) {
      const mine = settings.filter((s) => s.user === p.sender).sort((a, b) => a.t - b.t || a.gen - b.gen);
      return mine.length ? mine[mine.length - 1].aud : initial;
    }
    const d = inForce(p.sender, p.t, o);
    if (d !== null) return d;
    return o.dropNoSetting ? undefined : initial;
  }

  const report = (o) => {
    const by = new Map();
    for (const p of payments) {
      if (p.status !== "completed" && !o.countDeclined) continue;
      const a = audienceOf(p, o);
      if (a === undefined) continue;
      const m = monthOf(p.t);
      if (!by.has(m)) by.set(m, { public: 0, friends: 0, private: 0, n: 0 });
      const c = by.get(m);
      c[a] += 1; c.n += 1;
    }
    return [...by.keys()].sort().map((m) => {
      const c = by.get(m);
      return [m, c.n, r4(c.public, c.n), r4(c.friends, c.n), r4(c.private, c.n)];
    });
  };
  const rows = report({});
  const same = (x) => JSON.stringify(x) === JSON.stringify(rows);

  const diagnostics = [
    { message: "The override on the payment was ignored. A payment posted with its own audience uses that audience, not the sender's default.", rows: report({ noOverride: true }) },
    { message: "The sender's current setting was used for every payment. The default that applies is the one in force when the payment was created (the latest change at or before created_at).", rows: report({ current: true }) },
  ];
  if (level >= 2) {
    diagnostics.push({ message: "A setting changed at the exact second of the payment was treated as not yet in force. The default in force is the latest change with changed_at at or before created_at.", rows: report({ strict: true }) });
    diagnostics.push({ message: "Declined payments were counted. Only completed payments were posted to the feed.", rows: report({ countDeclined: true }) });
    diagnostics.push({ message: "Payments made before the sender's first setting row were dropped (an inner join to the setting history). They use this exercise's initial default.", rows: report({ dropNoSetting: true }) });
  }
  if (level === 3) {
    diagnostics.push({ message: "Two setting rows at the same second were resolved to the lower change_id. The higher change_id is the later change.", rows: report({ lowTie: true }) });
    diagnostics.push({ message: "Later edits were applied. The report counts the audience each payment was posted with, not its audience today.", rows: report({ lastEdit: true }) });
  }

  const setCols = ["change_id", "user_id", "default_audience", "changed_at"];
  const setRows = settingRows.map((s) => [s.id, s.user, s.aud, stamp(s.t)]);
  const payCols = ["payment_id", "sender_id", "recipient_id", "amount_cents", "created_at", "status", "audience_override"];
  const payRows = payments.map((p) => [p.id, p.sender, p.recipient, p.cents, stamp(p.t), p.status, p.override]);
  const editCols = ["edit_id", "payment_id", "audience", "edited_at"];
  const editRows = edits.sort((a, b) => a.t - b.t).map((e) => [e.id, e.pid, e.aud, stamp(e.t)]);

  let setup =
    "SET TIME ZONE 'UTC';\n" +
    "CREATE TABLE feed_settings (\n  change_id INT PRIMARY KEY,\n  user_id TEXT NOT NULL,\n  default_audience TEXT NOT NULL CHECK (default_audience IN ('public','friends','private')),\n  changed_at TIMESTAMPTZ NOT NULL\n);\n" +
    "CREATE TABLE p2p_payments (\n  payment_id INT PRIMARY KEY,\n  sender_id TEXT NOT NULL,\n  recipient_id TEXT NOT NULL,\n  amount_cents INT NOT NULL,\n  created_at TIMESTAMPTZ NOT NULL,\n  status TEXT NOT NULL CHECK (status IN ('completed','declined')),\n  audience_override TEXT CHECK (audience_override IN ('public','friends','private'))\n);\n" +
    insertSQL("feed_settings", setCols, setRows) + insertSQL("p2p_payments", payCols, payRows);
  const tables = [
    { name: "feed_settings", columns: setCols, rows: setRows },
    { name: "p2p_payments", columns: payCols, rows: payRows },
  ];
  if (level === 3) {
    setup += "CREATE TABLE audience_edits (\n  edit_id INT PRIMARY KEY,\n  payment_id INT NOT NULL,\n  audience TEXT NOT NULL CHECK (audience IN ('public','friends','private')),\n  edited_at TIMESTAMPTZ NOT NULL\n);\n" + insertSQL("audience_edits", editCols, editRows);
    tables.push({ name: "audience_edits", columns: editCols, rows: editRows });
  }

  return {
    vars: {
      payments: payments.length,
      changes: settingRows.length,
      initial_sql: level === 1 ? "NULL" : `'${initial}'`,
      initial_rule: level === 1
        ? "Every sender has a `feed_settings` row from before their first payment."
        : `A payment created before the sender's first \`feed_settings\` row uses this exercise's initial default, \`'${initial}'\`.`,
      status_rule: level === 1
        ? "Every payment in the sample completed."
        : "Only `completed` payments were posted to the feed; `declined` payments are not counted anywhere.",
      tie_rule: level === 3
        ? "Two `feed_settings` rows of one user can share a `changed_at`; the one with the higher `change_id` is the later change. `audience_edits` records changes a sender made to a payment's audience after it was posted: they do not change the audience it was posted with."
        : "No user has two `feed_settings` rows at the same second.",
      initial_answer: level === 1
        ? "In this sample every sender has one, so the case does not arise; in production you would need a rule (the account's initial default)."
        : `It uses this exercise's initial default, \`'${initial}'\` (check current docs for any real product's default).`,
    },
    setup,
    tables,
    expected: { columns: ["month", "payments", "public_share", "friends_share", "private_share"], rows },
    diagnostics: diagnostics.filter((d) => !same(d.rows)),
  };
}
