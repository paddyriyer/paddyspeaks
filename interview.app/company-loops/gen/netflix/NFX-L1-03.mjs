/* NFX-L1-03 — Concurrent-stream limit: accounts over their plan's limit, per plan and day (SQL).
   Simulated practice scenario. All data is generated from the seed; plans, limits and
   accounts are hypothetical.

   Contract: see docs/COMPANY-INTERVIEW-LOOPS.md § Executable templates (sql).
   level: 1 Medium (half-open stream intervals; strictly more streams than the limit; UTC days)
          2 Hard (+ streams that cross midnight count on every day they cover; a stream ending
                  exactly at 00:00:00 does not reach the next day)
          3 Very Hard (+ overlapping rows from the same device are one stream (a reconnect);
                  a stream still open (ended_at NULL) runs until the snapshot time) */
import { insertSQL } from "../../js/rng.js";

export const kind = "sql";

const DAYS = ["2026-09-18", "2026-09-19", "2026-09-20"];
const D0 = Date.parse(DAYS[0] + "T00:00:00Z");
const DAY = 86400, WIN = 4 * 3600;
const tsAbs = (sec) => new Date(D0 + sec * 1000).toISOString().slice(0, 19).replace("T", " ") + "+00";
const dateOf = (sec) => new Date(D0 + Math.floor(sec / DAY) * DAY * 1000).toISOString().slice(0, 10);
const DEVICES = ["tv_living", "tv_bedroom", "phone_a", "phone_b", "tablet", "laptop", "console"];
const cmp = (x, y) => (x < y ? -1 : x > y ? 1 : 0);

export function generate(r, level) {
  const premium = r.pick([3, 4]);
  const plans = [["pl_basic", "Basic", 1], ["pl_standard", "Standard", 2], ["pl_premium", "Premium", premium]];
  const nDays = level === 1 ? 2 : 3;
  const asOf = (nDays - 1) * DAY + 22 * 3600;              // the snapshot time (open streams run until it)
  const nAcc = r.int(6, 8);
  const accounts = [];
  const start = r.int(100, 900);
  for (let i = 0; i < nAcc; i++) accounts.push({ id: `acc_${start + 7 * i}`, plan: i < 3 ? plans[i] : r.pick(plans) });
  const streams = [];       // {acc, dev, s, e (null = still open)}
  const add = (acc, dev, s, e) => streams.push({ acc: acc.id, dev, s, e });

  // Scenario builders. Each stays inside one 4-hour window [base, base + WIN).
  const over = (acc, base) => {
    const L = acc.plan[2], T = base + WIN / 2;
    const devs = r.sample(DEVICES, Math.min(DEVICES.length, L + (r.chance(0.25) ? 2 : 1)));
    for (const d of devs) add(acc, d, T - r.int(0, 3000), T + r.int(60, 3000));
  };
  const touch = (acc, base) => {          // L + 1 rows, but one starts exactly when another ends
    const L = acc.plan[2], T = base + WIN / 2;
    const devs = r.sample(DEVICES, L + 1);
    add(acc, devs[0], T - r.int(600, 3000), T);
    for (let k = 1; k < L; k++) add(acc, devs[k], T - r.int(600, 3000), T + r.int(60, 3000));
    add(acc, devs[L], T, T + r.int(60, 3000));
  };
  const under = (acc, base) => {
    const L = acc.plan[2], T = base + WIN / 2;
    const devs = r.sample(DEVICES, r.int(1, L));
    for (const d of devs) add(acc, d, T - r.int(0, 3000), T + r.int(60, 3000));
  };
  const reconnect = (acc, base) => {      // L devices, L + 1 rows: one device reconnected mid-stream
    const L = acc.plan[2], T = base + WIN / 2;
    const devs = r.sample(DEVICES, L);
    add(acc, devs[0], T - r.int(900, 3000), T + r.int(60, 600));
    add(acc, devs[0], T - r.int(1, 300), T + r.int(700, 3000));
    for (let k = 1; k < L; k++) add(acc, devs[k], T - r.int(0, 3000), T + r.int(60, 3000));
  };
  // Midnight scenarios (Hard+): M is the abs second of a midnight.
  const bothDays = (acc, M) => {
    const devs = r.sample(DEVICES, acc.plan[2] + 1);
    for (const d of devs) add(acc, d, M - r.int(300, 6000), M + r.int(300, 6000));
  };
  const nextDayOnly = (acc, M) => {
    const devs = r.sample(DEVICES, acc.plan[2] + 1);
    add(acc, devs[0], M - r.int(600, 3600), M + r.int(1800, 3600));
    for (let k = 1; k < devs.length; k++) add(acc, devs[k], M + r.int(1, 1500), M + r.int(1600, 7000));
  };
  const endsAtMidnight = (acc, M) => {
    const devs = r.sample(DEVICES, acc.plan[2] + 1);
    for (const d of devs) add(acc, d, M - r.int(600, 5000), M);
  };

  const shuffled = r.shuffle(accounts);
  const ms = r.shuffle(accounts);           // accounts for the midnight scenarios (Hard+)
  // Keep the day each special case is about free of other streams of the same account,
  // so the case decides whether that account is over the limit on that day.
  const quiet = new Set();
  quiet.add(shuffled[2].id + "|0");
  if (level === 3) quiet.add(shuffled[4].id + "|0");
  if (level >= 2) quiet.add(ms[0].id + "|1");
  if (level === 3) quiet.add(shuffled[3].id + "|" + (nDays - 1));
  for (let day = 0; day < nDays; day++) {
    for (const acc of accounts) {
      if (quiet.has(acc.id + "|" + day)) continue;
      for (const w of r.sample([1, 2, 3, 4], r.int(1, 2))) {
        const base = day * DAY + w * WIN;
        const roll = r.next();
        if (roll < 0.2) over(acc, base);
        else if (roll < 0.4) touch(acc, base);
        else if (roll < 0.75) under(acc, base);
        else if (level === 3 && roll < 0.9) reconnect(acc, base);
      }
    }
  }
  // Every instance: two accounts on different plans over their limit, and one exact touch.
  // (Window 0, 00:00–04:00, is otherwise empty on the first and last day.)
  over(shuffled[0], 0);
  over(shuffled[1], (nDays - 1) * DAY);
  touch(shuffled[2], 0);
  if (level >= 2) {
    bothDays(ms[0], DAY);
    nextDayOnly(ms[1], DAY);
    endsAtMidnight(ms[2], 2 * DAY);
    if (r.chance(0.5)) under(ms[3], DAY - WIN / 2);
  }
  if (level === 3) {
    // A stream still open at the snapshot, overlapping the account's other streams.
    const acc = shuffled[3];
    const L = acc.plan[2], T = asOf - 900;
    const devs = r.sample(DEVICES, L + 1);
    add(acc, devs[0], T - r.int(900, 4000), null);
    for (let k = 1; k <= L; k++) add(acc, devs[k], T - r.int(0, 600), T + r.int(60, 800));
    reconnect(shuffled[4], 0);
  }

  streams.sort((a, b) => a.s - b.s || cmp(a.acc, b.acc) || cmp(a.dev, b.dev));
  let id = 300000 + r.int(0, 600000);
  for (const s of streams) s.id = id += r.int(1, 40);

  const solve = (o = {}) => {
    const per = new Map();     // day|plan_name -> {n, peak}
    const mark = (day, acc, peak) => {
      const k = day + "|" + acc.plan[1];
      if (!per.has(k)) per.set(k, { n: 0, peak: 0 });
      const g = per.get(k);
      g.n++;
      g.peak = Math.max(g.peak, peak);
    };
    for (const acc of accounts) {
      let iv = streams.filter((x) => x.acc === acc.id && !(o.dropOpen && x.e === null)).map((x) => ({ dev: x.dev, s: x.s, e: x.e === null ? asOf : x.e }));
      if (level === 3 && !o.rows) {
        // One stream per device: union each device's overlapping rows.
        const out = [];
        for (const d of [...new Set(iv.map((x) => x.dev))]) {
          const xs = iv.filter((x) => x.dev === d).sort((a, b) => a.s - b.s);
          let cur = null;
          for (const x of xs) {
            if (cur && x.s < cur.e) cur.e = Math.max(cur.e, x.e);
            else { cur = { ...x }; out.push(cur); }
          }
        }
        iv = out;
      }
      const L = acc.plan[2];
      const isOver = (peak) => (o.atLimit ? peak >= L : peak > L);
      if (o.startDay) {
        // Concurrency checked only at each stream's start, credited to the start's day.
        const best = new Map();
        for (const x of iv) {
          const n = iv.filter((y) => y.s <= x.s && x.s < y.e).length;
          const d = dateOf(x.s);
          best.set(d, Math.max(best.get(d) || 0, n));
        }
        for (const [d, peak] of best) if (isOver(peak)) mark(d, acc, peak);
        continue;
      }
      for (let day = 0; day < nDays; day++) {
        const lo = day * DAY, hi = lo + DAY;
        const ev = [];
        for (const x of iv) {
          const s = Math.max(x.s, lo), e = Math.min(x.e, hi);
          if (s < e || (o.closed && s <= e && x.s < hi && x.e >= lo)) { ev.push([s, 1]); ev.push([e, -1]); }
        }
        // At equal times an end goes first (half-open), or last when intervals are closed.
        ev.sort((a, b) => a[0] - b[0] || (o.closed ? b[1] - a[1] : a[1] - b[1]));
        let n = 0, peak = 0;
        for (const [, d] of ev) { n += d; peak = Math.max(peak, n); }
        if (peak && isOver(peak)) mark(dateOf(lo), acc, peak);
      }
    }
    return [...per.entries()]
      .map(([k, g]) => { const [d, p] = k.split("|"); return [d, p, g.n, g.peak]; })
      .sort((a, b) => cmp(a[0], b[0]) || cmp(a[1], b[1]));
  };
  const rows = solve();

  const diagnostics = [
    { message: "A stream that started exactly when another ended was counted as overlapping it. Intervals are half-open: [started_at, ended_at).", rows: solve({ closed: true }) },
    { message: "Accounts at their limit were counted. Over the limit means strictly more simultaneous streams than max_streams.", rows: solve({ atLimit: true }) },
  ];
  if (level >= 2) diagnostics.push({ message: "Concurrency was only checked when a stream started, and credited to that day. Streams running across midnight are still running at 00:00:00 on the next day.", rows: solve({ startDay: true }) });
  if (level === 3) {
    diagnostics.push({ message: "Rows were counted instead of devices. Overlapping rows from the same device are one reconnecting stream.", rows: solve({ rows: true }) });
    diagnostics.push({ message: "The open stream (ended_at NULL) was dropped. It is still running at the snapshot time.", rows: solve({ dropOpen: true }) });
  }

  const plCols = ["plan_id", "plan_name", "max_streams"];
  const acCols = ["account_id", "plan_id"];
  const stCols = ["stream_id", "account_id", "device_id", "started_at", "ended_at"];
  const plRows = plans.map((p) => [...p]);
  const acRows = accounts.slice().sort((a, b) => cmp(a.id, b.id)).map((a) => [a.id, a.plan[0]]);
  const stRows = streams.map((x) => [x.id, x.acc, x.dev, tsAbs(x.s), x.e === null ? null : tsAbs(x.e)]);
  const setup =
    "SET TIME ZONE 'UTC';\n" +
    "CREATE TABLE plans (\n  plan_id TEXT PRIMARY KEY,\n  plan_name TEXT NOT NULL,\n  max_streams INT NOT NULL\n);\n" +
    "CREATE TABLE accounts (\n  account_id TEXT PRIMARY KEY,\n  plan_id TEXT NOT NULL REFERENCES plans(plan_id)\n);\n" +
    "CREATE TABLE streams (\n  stream_id BIGINT PRIMARY KEY,\n  account_id TEXT NOT NULL REFERENCES accounts(account_id),\n  device_id TEXT NOT NULL,\n" +
    "  started_at TIMESTAMPTZ NOT NULL,\n  ended_at TIMESTAMPTZ" + (level === 3 ? "" : " NOT NULL") + ",\n  CHECK (ended_at IS NULL OR ended_at > started_at)\n);\n" +
    insertSQL("plans", plCols, plRows) + insertSQL("accounts", acCols, acRows) + insertSQL("streams", stCols, stRows);

  return {
    vars: {
      as_of: tsAbs(asOf),
      first_day: DAYS[0],
      last_day: DAYS[nDays - 1],
      streams: streams.length,
      day_rule: level === 1
        ? "Every stream in this sample starts and ends on the same UTC day."
        : "A stream that crosses midnight is running on both days and counts toward both; one that ends exactly at 00:00:00 has stopped before the new day begins.",
      device_rule: level === 3
        ? `A device plays one stream at a time: rows from the same \`device_id\` whose intervals overlap are one stream (the player reconnected), so count distinct devices. A row with \`ended_at\` NULL is still playing; treat it as running until the snapshot time ${tsAbs(asOf)}.`
        : "Count rows: in this sample no two overlapping streams of an account share a device, and every stream has ended.",
    },
    setup,
    tables: [
      { name: "plans", columns: plCols, rows: plRows },
      { name: "accounts", columns: acCols, rows: acRows },
      { name: "streams", columns: stCols, rows: stRows },
    ],
    expected: { columns: ["stream_date", "plan_name", "accounts_over_limit", "peak_streams"], rows },
    diagnostics: diagnostics.filter((d) => JSON.stringify(d.rows) !== JSON.stringify(rows)),
  };
}
