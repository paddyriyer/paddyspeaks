/* PIN-L1-03 — Fresh-pin share of home feed impressions per country and day (SQL).
   Simulated practice scenario. All data is generated from the seed; the freshness rule
   (a repin is as old as its original) is this exercise's rule, not any product's. The home
   feed's ranking is out of scope: only what was shown is counted.

   Contract: see docs/COMPANY-INTERVIEW-LOOPS.md § Executable templates (sql).
   level: 1 Medium (a repin dated by its original's creation; strict N-day window; one UTC day)
          2 Hard (+ two UTC days with impressions either side of midnight; the client logs some
            impressions twice with the same impression_id)
          3 Very Hard (+ scheduled pins: an original's age starts at published_at when set) */
import { insertSQL, ts } from "../../js/rng.js";

export const kind = "sql";

const COUNTRIES = ["BR", "DE", "FR", "GB", "JP", "MX", "US"];
const EPOCH = "2026-01-01";
const DAY_IDX = 277;                                         // 2026-10-05, a Monday

function addDays(day, n) {
  const d = new Date(Date.UTC(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10) + n));
  return d.toISOString().slice(0, 10);
}
const stamp = (t) => ts(addDays(EPOCH, Math.floor(t / 86400)), ((t % 86400) + 86400) % 86400);
const dateOf = (t) => addDays(EPOCH, Math.floor(t / 86400));

export function generate(r, level) {
  const N = r.pick([2, 3, 7]);
  const W = N * 86400;
  const nDays = level === 1 ? 1 : 2;
  const D0 = DAY_IDX * 86400;
  const countries = r.sample(COUNTRIES, 3).sort();
  let pinNo = 10000 + r.int(0, 50000);
  const pins = [];                                           // {id, created, published, parent}
  const newPin = (created, parent = null, published = null) => {
    const p = { id: "pin_" + (pinNo += r.int(1, 400)), created, published, parent };
    pins.push(p);
    return p;
  };
  const origin = (p) => (p.parent ? p.parent : p);
  const startOf = (p) => (p.published ?? p.created);

  // Originals: fresh, just outside the window, and old.
  const originals = [];
  for (let i = 0; i < 3; i++) originals.push(newPin(D0 - r.int(3600, W - 7200)));            // fresh at day start
  for (let i = 0; i < 2; i++) originals.push(newPin(D0 - W - r.int(3600, 3 * 86400)));       // a few days too old
  for (let i = 0; i < 2; i++) originals.push(newPin(D0 - r.int(60, 500) * 86400 - r.int(0, 86399)));   // long ago
  // Repins: recent saves of old and fresh originals; the repin itself always looks fresh.
  const repins = [];
  for (let i = 0; i < 3 + level; i++) {
    const o = i < 2 ? r.pick(originals.slice(3)) : r.pick(originals);
    repins.push(newPin(Math.max(o.created + 3600, D0 - r.int(3600, W - 3600)), o));
  }
  // The boundary pin: its window ends inside the first day.
  const x = r.int(7200, 72000);
  const edge = newPin(D0 - W + x);
  const edgeRepin = newPin(D0 - r.int(600, 3000), edge);
  // Very Hard: a scheduled original created long ago but published inside the window, a repin
  // of it, and one published just before the window's start so it ages out during the data.
  if (level === 3) {
    const sched = newPin(D0 - W - r.int(2, 9) * 86400 - r.int(0, 80000), null, D0 - r.int(3600, W - 7200));
    newPin(sched.published + r.int(600, 3000), sched);
    newPin(D0 - W - r.int(3600, 86400), null, D0 - W + r.int(3600, 6 * 3600));
  }

  // Impressions.
  const imps = [];                                           // {pin, country, t}
  const dayT = () => D0 + r.int(0, nDays - 1) * 86400 + r.int(1800, 84600);
  const n = 16 + 6 * level;
  for (let i = 0; i < n; i++) imps.push({ pin: r.pick(pins.filter((p) => p !== edge && p !== edgeRepin)), country: r.pick(countries), t: dayT() });
  // Every repin of an old original is shown at least once.
  for (const p of repins) if (startOf(origin(p)) + W <= D0) imps.push({ pin: p, country: r.pick(countries), t: dayT() });
  // Boundary: exactly N days after the original (not fresh) and one second before (fresh).
  imps.push({ pin: edge, country: r.pick(countries), t: D0 + x });
  imps.push({ pin: edgeRepin, country: r.pick(countries), t: D0 + x - 1 });
  if (level >= 2) {
    // Either side of midnight between the two days.
    imps.push({ pin: r.pick(originals.slice(0, 3)), country: r.pick(countries), t: D0 + 86400 - 1 });
    imps.push({ pin: r.pick(repins), country: r.pick(countries), t: D0 + 86400 });
  }
  if (level === 3) for (const p of pins.filter((q) => q.published !== null || (q.parent && q.parent.published !== null))) imps.push({ pin: p, country: r.pick(countries), t: dayT() });
  // A pin is never shown before it exists (or, if scheduled, before it is published).
  for (const im of imps) {
    const own = im.pin.published ?? im.pin.created;
    const src = startOf(origin(im.pin));
    if (im.t <= Math.max(own, src)) im.t = Math.max(own, src) + r.int(60, 3600);
  }
  imps.sort((a, b) => a.t - b.t);
  let iid = 800000 + r.int(0, 90000);
  for (const im of imps) im.id = "imp_" + (iid += r.int(1, 9));
  // Hard+: the client logs some impressions twice (same impression_id, same time).
  const logs = [];
  for (const im of imps) {
    logs.push(im);
    if (level >= 2 && r.chance(0.15)) logs.push(im);
  }
  if (level >= 2 && logs.length === imps.length) logs.push(imps[r.int(0, imps.length - 1)]);
  logs.sort((a, b) => a.t - b.t || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
  const solve = (o = {}) => {
    const seen = new Set();
    const agg = new Map();
    for (const im of logs) {
      if (!o.dups && seen.has(im.id)) continue;
      seen.add(im.id);
      const src = o.own ? im.pin : origin(im.pin);
      const start = o.created ? src.created : startOf(src);
      const age = im.t - start;
      const fresh = o.inclusive ? age <= W : age < W;
      const k = dateOf(im.t) + "|" + im.country;
      if (!agg.has(k)) agg.set(k, { n: 0, f: 0 });
      const g = agg.get(k);
      g.n++;
      if (fresh) g.f++;
    }
    const share = (a, b) => Math.floor((a * 20000 + b) / (2 * b)) / 10000;
    return [...agg.entries()].sort((a, b) => cmp(a[0], b[0])).map(([k, g]) => {
      const [d, c] = k.split("|");
      return [d, c, g.n, g.f, share(g.f, g.n)];
    });
  };
  const rows = solve();

  const diagnostics = [
    { message: "Repins were dated by their own creation. A repin is as old as its original pin (original_pin_id), so a fresh repin of an old pin is not fresh.", rows: solve({ own: true }) },
    { message: "The window was treated as inclusive. An impression exactly N days after the original's start is no longer fresh.", rows: solve({ inclusive: true }) },
  ];
  if (level >= 2) diagnostics.push({ message: "Duplicate logs were counted. An impression logged twice (same impression_id) is one impression.", rows: solve({ dups: true }) });
  if (level === 3) diagnostics.push({ message: "Scheduled pins were dated by created_at. A scheduled original's age starts when it was published.", rows: solve({ created: true }) });

  pins.sort((a, b) => a.created - b.created || cmp(a.id, b.id));
  const pCols = ["pin_id", "original_pin_id", "created_at", "published_at"];
  const pRows = pins.map((p) => [p.id, p.parent ? p.parent.id : null, stamp(p.created), p.published === null ? null : stamp(p.published)]);
  const iCols = ["log_id", "impression_id", "pin_id", "country", "impression_ts"];
  let lid = 1;
  const iRows = logs.map((im) => [lid++, im.id, im.pin.id, im.country, stamp(im.t)]);
  const setup =
    "SET TIME ZONE 'UTC';\n" +
    "CREATE TABLE pins (\n  pin_id TEXT PRIMARY KEY,\n  original_pin_id TEXT REFERENCES pins(pin_id),   -- NULL for an original pin\n  created_at TIMESTAMPTZ NOT NULL,\n  published_at TIMESTAMPTZ                         -- set only for a scheduled pin\n);\n" +
    "CREATE TABLE home_feed_impressions (\n  log_id BIGINT PRIMARY KEY,\n  impression_id TEXT NOT NULL,\n  pin_id TEXT NOT NULL REFERENCES pins(pin_id),\n  country TEXT NOT NULL,\n  impression_ts TIMESTAMPTZ NOT NULL\n);\n" +
    insertSQL("pins", pCols, pRows) + insertSQL("home_feed_impressions", iCols, iRows);

  return {
    vars: {
      fresh_days: N,
      logs: logs.length,
      pins: pins.length,
      dup_rule: level === 1
        ? "Each impression is logged once, and all of them fall on one UTC day."
        : "The data covers two UTC days. The client sometimes logs an impression twice after a retry: both rows have the same `impression_id` and count as one impression.",
      sched_rule: level === 3
        ? "A pin can be scheduled: it is created first and goes live at `published_at`. An original's age starts at `published_at` when it is set, otherwise at `created_at`; a repin of a scheduled pin is as old as that published original."
        : "`published_at` is NULL for every pin in this sample, so an original's age starts at `created_at`.",
    },
    setup,
    tables: [
      { name: "pins", columns: pCols, rows: pRows },
      { name: "home_feed_impressions", columns: iCols, rows: iRows },
    ],
    expected: { columns: ["impression_date", "country", "impressions", "fresh_impressions", "fresh_share"], rows },
    diagnostics: diagnostics.filter((d) => JSON.stringify(d.rows) !== JSON.stringify(rows)),
  };
}
