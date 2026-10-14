/* CFX-L1-03 — DNS records that flapped: more than k real changes in a UTC day (SQL).
   Simulated practice scenario. All data is generated from the seed. What counts as a
   change (and as a record), and the threshold, are this exercise's own rules.

   Contract: see docs/COMPANY-INTERVIEW-LOOPS.md § Executable templates (sql).
   level: 1 Medium (rewrites of the same value ignored; the first row is creation; the
                    previous value can come from an earlier day)
          2 Hard (+ one name with A and AAAA records: a record is (zone, name, type); several
                  changes in the same second, ordered by change_id; changes at midnight)
          3 Very Hard (+ deletions (NULL) and re-creations count; values compared
                       case-insensitively and without a trailing dot) */
import { insertSQL, ts } from "../../js/rng.js";

export const kind = "sql";

const ZONES = ["example.com", "example.net", "example.org"];
const NAMES = ["www", "api", "app", "cdn", "mail", "status", "shop", "vpn"];

const cmp = (x, y) => (x < y ? -1 : x > y ? 1 : 0);

function pool(r, type) {
  if (type === "A") { const p = r.pick(["192.0.2.", "198.51.100.", "203.0.113."]); return r.sample([10, 11, 12, 20, 21, 40, 41], 3).map((n) => p + n); }
  if (type === "AAAA") return r.sample(["a", "b", "c", "d", "e", "f"], 3).map((h) => `2001:db8::${h}${r.int(1, 9)}`);
  return r.sample(["lb-east", "lb-west", "origin-1", "origin-2", "failover"], 3).map((h) => h + ".example.net");
}

export function generate(r, level) {
  const k = r.pick([2, 3]);
  const days = ["2026-09-" + r.pick(["07", "08"])];
  const d0 = Number(days[0].slice(-2));
  days.push("2026-09-" + String(d0 + 1).padStart(2, "0"), "2026-09-" + String(d0 + 2).padStart(2, "0"));
  const zones = r.sample(ZONES, 2).sort();

  const recs = [];
  for (const z of zones) {
    for (const n of r.sample(NAMES, level === 1 ? 2 : 3)) {
      const type = r.pick(["A", "A", "AAAA", "CNAME"]);
      recs.push({ zone: z, name: n + "." + z, type });
    }
  }
  if (level >= 2) {
    // One name with both an A and an AAAA record.
    const base = recs.find((x) => x.type === "A") || recs[0];
    base.type = "A";
    recs.push({ zone: base.zone, name: base.name, type: "AAAA" });
  }
  const forced = r.pick(recs);
  const forcedDay = r.int(1, 2);

  const events = [];   // {rec, day, sec, seq, value (canonical or null)}
  let seq = 0;
  for (const rec of recs) {
    const p = pool(r, rec.type);
    let cur = p[0];
    events.push({ rec, day: 0, sec: r.int(0, 3 * 3600), seq: seq++, value: cur });   // creation
    let lastSec = 4 * 3600;
    for (let d = 0; d < 3; d++) {
      const n = rec === forced && d === forcedDay ? k + 1 + r.int(1, 2) : r.int(0, k + 2);
      let sec = d === 0 ? lastSec : 0;
      const secs = [];
      for (let i = 0; i < n; i++) {
        if (level >= 2 && i > 0 && secs[i - 1] !== secs[i - 2] && r.chance(0.2)) { secs.push(sec); continue; }   // same second (pairs only)
        sec = level >= 2 && d > 0 && i === 0 && r.chance(0.3) ? 0 : Math.min(86399, sec + r.int(60, 86399 / (n + 1)));
        secs.push(sec);
      }
      if (level >= 2 && n > 0 && r.chance(0.25)) secs[n - 1] = 86399;
      let forcedReal = 0;
      for (let i = 0; i < n; i++) {
        let v;
        const wantReal = rec === forced && d === forcedDay && forcedReal < k + 1 && (n - i) <= (k + 1 - forcedReal) + 1;
        if (level === 3 && cur !== null && r.chance(0.12) && !wantReal) v = null;               // deleted
        else if (cur === null) v = r.chance(0.5) ? p[0] : r.pick(p);                           // re-created
        else if (!wantReal && r.chance(0.25)) v = cur;                                        // same value rewritten
        else v = r.pick(p.filter((x) => x !== cur));
        if (rec === forced && d === forcedDay && v !== cur) forcedReal++;
        events.push({ rec, day: d, sec: secs[i], seq: seq++, value: v });
        cur = v;
      }
    }
  }
  // Keep the forced record's day over k: append real changes at the end of that day if needed.
  {
    const evs = events.filter((e) => e.rec === forced).sort((a, b) => a.day - b.day || a.sec - b.sec || a.seq - b.seq);
    let real = 0, prev = null;
    evs.forEach((e, i) => { if (i > 0 && e.day === forcedDay && e.value !== prev) real++; prev = e.value; });
    const p = pool(r, forced.type);
    let cur = evs[evs.length - 1].value;
    const tail = evs.filter((e) => e.day === forcedDay);
    let sec = tail.length ? tail[tail.length - 1].sec : 3600;
    const later = evs.filter((e) => e.day > forcedDay);
    while (real <= k) {
      sec = Math.min(86399, sec + 1);
      const v = cur === p[0] ? p[1] : p[0];
      const e = { rec: forced, day: forcedDay, sec, seq: seq++, value: v };
      events.push(e);
      // Re-sequence later days after the inserted change so the timeline stays consistent.
      for (const l of later) l.seq = seq++;
      cur = v; real++;
    }
  }

  // Cosmetic spellings at Very Hard: the canonical value is unchanged.
  const spell = (rec, v) => {
    if (v === null || level < 3) return v;
    if (rec.type === "CNAME") { let s = v; if (r.chance(0.3)) s = s.toUpperCase(); if (r.chance(0.3)) s += "."; return s; }
    if (rec.type === "AAAA" && r.chance(0.35)) return v.toUpperCase();
    return v;
  };
  events.sort((a, b) => a.day - b.day || a.sec - b.sec || a.seq - b.seq);
  let cid = 50000 + r.int(0, 40000);
  const rows = events.map((e) => { e.id = (cid += r.int(1, 4)); e.raw = spell(e.rec, e.value); return [e.id, e.rec.zone, e.rec.name, e.rec.type, ts(days[e.day], e.sec), e.raw]; });

  const norm = (v, o) => (v === null ? null : o.noNorm ? v : v.toLowerCase().replace(/\.+$/, ""));
  const solve = (o = {}) => {
    const by = new Map();
    for (const e of events) {
      if (o.ignoreDeletes && e.raw === null) continue;
      const key = o.mergeType ? e.rec.zone + "|" + e.rec.name : e.rec.zone + "|" + e.rec.name + "|" + e.rec.type;
      if (!by.has(key)) by.set(key, []);
      by.get(key).push(e);
    }
    const counts = new Map();
    for (const [key, evs] of by) {
      evs.sort((a, b) => a.day - b.day || a.sec - b.sec || a.id - b.id);
      evs.forEach((e, i) => {
        let change;
        if (i === 0) change = !!o.creationCounts;
        else if (o.perDay && evs[i - 1].day !== e.day) change = false;
        else if (o.rewrites) change = true;
        else change = norm(e.raw, o) !== norm(evs[i - 1].raw, o);
        if (!change) return;
        const ck = key + "|" + e.day;
        counts.set(ck, (counts.get(ck) || 0) + 1);
      });
    }
    const out = [];
    for (const [ck, n] of counts) {
      if (o.ge ? n < k : n <= k) continue;
      const parts = ck.split("|");
      const day = Number(parts.pop());
      const [zone, name, type] = parts;
      const typeOut = o.mergeType ? (recs.find((x) => x.zone === zone && x.name === name).type) : type;
      out.push([zone, name, typeOut, days[day], n]);
    }
    return out.sort((x, y) => cmp(x[0], y[0]) || cmp(x[3], y[3]) || cmp(x[1], y[1]) || cmp(x[2], y[2]));
  };
  const expected = solve();

  const diagnostics = [
    { message: "Rewrites of the same value were counted as changes. A row whose value equals the record's previous value is not a change.", rows: solve({ rewrites: true }) },
    { message: "The previous value was looked up within the day only. The first change of a day compares with the record's last value from an earlier day.", rows: solve({ perDay: true }) },
    { message: "The first row of a record was counted. It is the record's creation, not a change.", rows: solve({ creationCounts: true }) },
    { message: "The threshold was applied as >= k. Only records with more than k changes in a day are reported.", rows: solve({ ge: true }) },
  ];
  if (level >= 2) diagnostics.push({ message: "Records were identified by zone and name only. An A and an AAAA record on one name are different records; their values must not be compared with each other.", rows: solve({ mergeType: true }) });
  if (level === 3) {
    diagnostics.push({ message: "Values were compared as written. 'Origin-1.Example.Net.' and 'origin-1.example.net' are the same answer: lower-case and drop the trailing dot first.", rows: solve({ noNorm: true }) });
    diagnostics.push({ message: "Deletions were dropped. A deletion is a change, and so is the re-creation after it, even with the same value as before.", rows: solve({ ignoreDeletes: true }) });
  }

  const cols = ["change_id", "zone_name", "record_name", "record_type", "changed_at", "new_value"];
  const setup =
    "SET TIME ZONE 'UTC';\n" +
    "CREATE TABLE dns_changes (\n  change_id BIGINT PRIMARY KEY,\n  zone_name TEXT NOT NULL,\n  record_name TEXT NOT NULL,\n  record_type TEXT NOT NULL,\n  changed_at TIMESTAMPTZ NOT NULL,\n  new_value TEXT\n);\n" +
    insertSQL("dns_changes", cols, rows);

  return {
    vars: {
      k,
      changes: rows.length,
      identity_rule: level === 1
        ? "Each name has a single record type in this sample, and no two rows of a record share a `changed_at`."
        : "A record is identified by `(zone_name, record_name, record_type)`: an A and an AAAA record on one name are separate records. Rows of one record can share a `changed_at`; `change_id` gives their order.",
      value_rule: level === 3
        ? "`new_value` is NULL when the record was **deleted**: a deletion is a change, and so is the re-creation that follows it. Compare values case-insensitively and ignoring trailing dots (`Origin-1.Example.Net.` equals `origin-1.example.net`)."
        : "`new_value` is never NULL in this sample, and every value is written in one canonical form.",
    },
    setup,
    tables: [{ name: "dns_changes", columns: cols, rows }],
    expected: { columns: ["zone_name", "record_name", "record_type", "change_date", "changes"], rows: expected },
    diagnostics: diagnostics.filter((d) => JSON.stringify(d.rows) !== JSON.stringify(expected)),
  };
}
