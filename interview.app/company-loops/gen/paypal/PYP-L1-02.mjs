/* PYP-L1-02 — Cross-border corridors per week: count, median minutes to available, and
   amounts in each currency's major units from its minor-unit exponent (SQL).
   Simulated practice scenario. All data is generated from the seed.

   Contract: generate(r, level) -> { vars, setup, tables, expected, diagnostics }.
   The oracle computes, per (ISO week of sent_at, send currency, receive currency),
   the counted transfers, those available to the recipient, the median minutes from
   send to available (percentile_cont semantics), and both totals scaled by the
   currency's exponent, written as exact decimal strings.
   level: 1 Medium (every transfer available; one row per transfer)
          2 Hard (+ pending transfers counted but not in the median or the received
                  total, cancelled transfers excluded, a corridor-week with nothing
                  available yet)
          3 Very Hard (+ the table is a status log: a transfer has one row per status
                  change, and the row with the latest updated_at is its current state) */
import { insertSQL, ts } from "../../js/rng.js";

export const kind = "sql";

// ISO 4217 minor-unit exponents (public standard). Amounts and rates below are hypothetical.
const EXP = { USD: 2, EUR: 2, GBP: 2, MXN: 2, PHP: 2, INR: 2, CAD: 2, JPY: 0, KRW: 0, KWD: 3, BHD: 3, JOD: 3 };
const PAIRS = [
  ["USD", "MXN", 18], ["USD", "PHP", 57], ["USD", "INR", 84], ["GBP", "INR", 110], ["EUR", "PHP", 63],
  ["USD", "JPY", 147], ["KWD", "INR", 274], ["BHD", "PHP", 151], ["JPY", "USD", 0.0068], ["USD", "KRW", 1380],
  ["CAD", "JOD", 0.52], ["EUR", "KWD", 0.33], ["KRW", "PHP", 0.041], ["JOD", "GBP", 1.06],
];
const BASE = "2026-09-07";                       // a Monday
const DAY = 86400, WEEK = 7 * DAY;

const dayStr = (k) => { const d = new Date(BASE + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + k); return d.toISOString().slice(0, 10); };
const stamp = (s) => ts(dayStr(Math.floor(s / DAY)), s % DAY);
const weekOf = (s) => dayStr(Math.floor(s / WEEK) * 7);
const weekSunday = (s) => dayStr(Math.floor((s + DAY) / WEEK) * 7 - 1);  // weeks that start on Sunday

function major(minor, exp) {                     // exact decimal text of minor / 10^exp
  if (exp === 0) return String(minor);
  const neg = minor < 0, a = String(Math.abs(minor)).padStart(exp + 1, "0");
  return (neg ? "-" : "") + a.slice(0, -exp) + "." + a.slice(-exp);
}
function median(xs) {
  if (!xs.length) return null;
  const s = xs.slice().sort((a, b) => a - b), m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
function sendAmount(r, cur) {
  const e = EXP[cur];
  if (e === 0) return r.int(5, 400) * (cur === "KRW" ? 1000 : 100) + r.int(0, 99);
  if (e === 3) return r.int(10, 900) * 1000 + r.int(0, 999);
  return r.int(20, 1500) * 100 + r.int(0, 99);
}

export function generate(r, level) {
  // Always one corridor with an exponent-0 currency and one with an exponent-3 currency.
  const zero = PAIRS.filter(([a, b]) => EXP[a] === 0 || EXP[b] === 0);
  const three = PAIRS.filter(([a, b]) => EXP[a] === 3 || EXP[b] === 3);
  const rest = PAIRS.filter((p) => !zero.includes(p) && !three.includes(p));
  const pairs = [r.pick(zero), r.pick(three), ...r.sample(rest, level === 1 ? 1 : 2)];
  const weeks = 3;

  const transfers = [];
  let id = 4100 + r.int(0, 500) * 10;
  const add = (pair, sentMin, delayMin, status) => {
    const [s, rc, rate] = pair;
    const send = sendAmount(r, s);
    const recv = Math.max(1, Math.round(send * rate * Math.pow(10, EXP[rc] - EXP[s])));
    const t = { id: id++, send_cur: s, recv_cur: rc, send, recv, sent: sentMin * 60, status, avail: status === "available" ? (sentMin + delayMin) * 60 : null };
    transfers.push(t);
    return t;
  };
  const delay = () => (r.chance(0.6) ? r.int(1, 45) : r.int(60, 2 * 24 * 60));
  const status = () => (level === 1 ? "available" : r.chance(0.7) ? "available" : r.chance(0.6) ? "pending" : "cancelled");
  for (const pair of pairs) {
    for (let w = 0; w < weeks; w++) {
      const k = r.int(2, 5);
      for (let i = 0; i < k; i++) add(pair, w * 7 * 24 * 60 + r.int(0, 7 * 24 * 60 - 1), delay(), status());
    }
  }
  // Week boundaries: Sunday 23:5x and Monday 00:0x UTC, both available.
  const edgePair = r.pick(pairs);
  add(edgePair, (7 * 24 * 60) - r.int(1, 9), delay(), "available");
  add(edgePair, (7 * 24 * 60) + r.int(0, 9), delay(), "available");
  if (level >= 2) {
    // A corridor-week where nothing has become available yet (median NULL, received 0).
    const p = r.pick(pairs.filter((x) => x !== edgePair));
    const w = weeks;                                // a fourth, partial week
    add(p, w * 7 * 24 * 60 + r.int(0, 3 * 24 * 60), 0, "pending");
    add(p, w * 7 * 24 * 60 + r.int(0, 3 * 24 * 60), 0, "cancelled");
  }

  // Status log (Very Hard): every transfer also has its creation row (pending, at sent_at);
  // the row with the latest updated_at is its current state. Some available transfers are
  // touched again later without changing state.
  const logRows = [];
  for (const t of transfers) {
    const touched = level === 3 && t.status === "available" && r.chance(0.3);
    const upd = t.status === "available" ? t.avail + (touched ? r.int(1, 120) * 60 : 0) : t.sent + r.int(1, 600) * 60;
    if (level === 3) logRows.push({ ...t, status: "pending", avail: null, updated: t.sent });
    logRows.push({ ...t, updated: upd });
  }
  const log = logRows;

  const report = (o) => {
    let src;
    if (level === 3 && !o.allRows) {
      const by = new Map();
      for (const x of log) {
        const cur = by.get(x.id);
        if (!cur || (o.firstRow ? x.updated < cur.updated : x.updated > cur.updated)) by.set(x.id, x);
      }
      src = [...by.values()];
    } else src = level === 3 ? log : transfers;
    const g = new Map();
    for (const t of src) {
      if (t.status === "cancelled" && !o.countCancelled) continue;
      const wk = o.sunday ? weekSunday(t.sent) : weekOf(t.sent);
      const key = wk + "|" + t.send_cur + "|" + t.recv_cur;
      if (!g.has(key)) g.set(key, { n: 0, avail: 0, mins: [], sent: 0, recv: 0 });
      const c = g.get(key);
      c.n += 1; c.sent += t.send;
      if (t.avail !== null) { c.avail += 1; c.mins.push((t.avail - t.sent) / 60); }
      if (t.avail !== null || o.recvAll) c.recv += t.recv;
    }
    return [...g.keys()].sort().map((k) => {
      const [wk, s, rc] = k.split("|");
      const c = g.get(k);
      const es = o.cents ? 2 : EXP[s], er = o.cents ? 2 : EXP[rc];
      const med = o.avg ? (c.mins.length ? Math.round((c.mins.reduce((a, b) => a + b, 0) / c.mins.length) * 1e6) / 1e6 : null) : median(c.mins);
      return [wk, s, rc, c.n, c.avail, med, major(c.sent, es), major(c.recv, er)];
    });
  };
  const rows = report({});
  const same = (x) => JSON.stringify(x) === JSON.stringify(rows);

  const diagnostics = [
    { message: "Every amount was divided by 100. Each currency's exponent comes from `currencies`: 0 for a currency with no minor unit, 3 for one with thousandths.", rows: report({ cents: true }) },
    { message: "The average was used instead of the median. Use percentile_cont(0.5) over the minutes of transfers that became available.", rows: report({ avg: true }) },
    { message: "Weeks started on Sunday. Weeks here start on Monday 00:00 UTC (date_trunc('week', …)).", rows: report({ sunday: true }) },
  ];
  if (level >= 2) {
    diagnostics.push({ message: "Cancelled transfers were counted. A cancelled transfer is not sent; it appears nowhere in the report.", rows: report({ countCancelled: true }) });
    diagnostics.push({ message: "The received total included transfers not yet available. received_total covers only money that became available to the recipient.", rows: report({ recvAll: true }) });
  }
  if (level === 3) {
    diagnostics.push({ message: "Every status row was counted as a transfer. Keep one row per transfer: the one with the latest updated_at.", rows: report({ allRows: true }) });
    diagnostics.push({ message: "The first status row was used. A transfer's current state is its row with the latest updated_at.", rows: report({ firstRow: true }) });
  }

  const curCols = ["currency", "minor_exponent"];
  const used = [...new Set(pairs.flat().filter((x) => typeof x === "string"))];
  const extra = r.sample(Object.keys(EXP).filter((c) => !used.includes(c)), 2);
  const curRows = [...used, ...extra].sort().map((c) => [c, EXP[c]]);
  const tCols = ["transfer_id", "send_currency", "receive_currency", "send_amount_minor", "receive_amount_minor", "sent_at", "available_at", "status", "updated_at"];
  const tRows = log
    .slice()
    .sort((a, b) => a.updated - b.updated || a.id - b.id)
    .map((t) => [t.id, t.send_cur, t.recv_cur, t.send, t.recv, stamp(t.sent), t.avail === null ? null : stamp(t.avail), t.status, stamp(t.updated)]);

  const setup =
    "SET TIME ZONE 'UTC';\n" +
    "CREATE TABLE currencies (\n  currency TEXT PRIMARY KEY,\n  minor_exponent INT NOT NULL CHECK (minor_exponent IN (0, 2, 3))\n);\n" +
    "CREATE TABLE transfers (\n  transfer_id INT NOT NULL,\n  send_currency TEXT NOT NULL REFERENCES currencies,\n  receive_currency TEXT NOT NULL REFERENCES currencies,\n  send_amount_minor BIGINT NOT NULL,\n  receive_amount_minor BIGINT NOT NULL,\n  sent_at TIMESTAMPTZ NOT NULL,\n  available_at TIMESTAMPTZ,\n  status TEXT NOT NULL CHECK (status IN ('pending','available','cancelled')),\n  updated_at TIMESTAMPTZ NOT NULL" + (level === 3 ? ",\n  PRIMARY KEY (transfer_id, updated_at)" : ",\n  PRIMARY KEY (transfer_id)") + "\n);\n" +
    insertSQL("currencies", curCols, curRows) + insertSQL("transfers", tCols, tRows);

  return {
    vars: {
      transfers: transfers.length,
      rows_n: tRows.length,
      status_rule: level === 1
        ? "Every transfer in the sample has `status = 'available'`."
        : "`status` is `available` (the recipient can use the money from `available_at`), `pending` (not yet available; `available_at` is NULL) or `cancelled`. Cancelled transfers are not counted anywhere. Pending transfers count in `transfers` and `sent_total` only.",
      log_rule: level === 3
        ? "`transfers` is a status log: a transfer has one row per status change, and its row with the latest `updated_at` is its current state."
        : "`transfers` has one row per transfer.",
    },
    setup,
    tables: [
      { name: "currencies", columns: curCols, rows: curRows },
      { name: "transfers", columns: tCols, rows: tRows },
    ],
    expected: { columns: ["week_start", "send_currency", "receive_currency", "transfers", "available", "median_minutes", "sent_total", "received_total"], rows },
    diagnostics: diagnostics.filter((d) => !same(d.rows)),
  };
}
