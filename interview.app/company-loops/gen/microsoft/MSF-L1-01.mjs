/* MSF-L1-01 — Meeting join failures: participants whose first join try failed (SQL).
   Simulated practice scenario. All data is generated from the seed; tenants are the
   fictional sample organisations used in public product documentation, and every
   number is hypothetical.

   Contract: see docs/COMPANY-INTERVIEW-LOOPS.md § Executable templates (sql).
   level: 1 Medium (one platform per participant; retries within 120 s collapse into one try)
          2 Hard (+ gaps of exactly 120 and 121 s, chained retries, participants who switch
                  platform, two attempts in the same second)
          3 Very Hard (+ cancelled attempts are ignored entirely, a participant with only
                       cancelled attempts is not counted, and a minimum-participants floor) */
import { insertSQL, ts } from "../../js/rng.js";

export const kind = "sql";

const TENANTS = ["contoso", "fabrikam", "northwind", "tailspin", "woodgrove"];
const PLATFORMS = ["android", "ios", "mac", "web", "windows"];
const DAYS = ["2026-09-15", "2026-09-16", "2026-09-17"];
const HEX = "0123456789abcdef".split("");
const WINDOW = 120;

export function generate(r, level) {
  const day = r.pick(DAYS);
  const tenants = r.sample(TENANTS, level === 1 ? 2 : 3).sort();
  const platforms = r.sample(PLATFORMS, level === 1 ? 3 : 4).sort();
  const meetings = [];
  for (const t of tenants) {
    const n = r.int(2, 3);
    for (let k = 0; k < n; k++) meetings.push({ id: "mtg_" + Array.from({ length: 6 }, () => r.pick(HEX)).join(""), tenant: t, start: r.int(7, 18) * 3600 + r.pick([0, 1800]) });
  }
  const parts = [];                     // {meeting, user, attempts: [{gap, platform, outcome}]}
  let uid = r.int(100, 900);
  const user = () => "u" + (uid += r.int(1, 9));
  const GAPS = level === 1 ? [15, 40, 90, 200, 420] : [0, 30, 100, 119, 120, 121, 150, 400];
  for (const m of meetings) {
    const n = r.int(3, level === 1 ? 5 : 6);
    for (let k = 0; k < n; k++) {
      const home = r.pick(platforms);
      const nAtt = r.pick([1, 1, 2, 2, 3, 4]);
      const attempts = [];
      for (let a = 0; a < nAtt; a++) {
        let outcome = r.chance(a === nAtt - 1 ? 0.65 : 0.25) ? "succeeded" : "failed";
        if (level === 3 && r.chance(0.2)) outcome = "cancelled";
        const platform = level >= 2 && a > 0 && r.chance(0.3) ? r.pick(platforms) : home;
        attempts.push({ gap: a === 0 ? r.int(0, 600) : r.pick(GAPS), platform, outcome });
      }
      parts.push({ meeting: m, user: user(), attempts });
    }
  }
  // Cases every instance contains, placed in random meetings.
  const forced = (attempts, who) => parts.push({ meeting: who ? who.meeting : r.pick(meetings), user: who ? who.user : user(), attempts: attempts.map(([gap, outcome, platform]) => ({ gap, outcome, platform })) });
  const P = () => r.pick(platforms);
  { const p = P(); forced([[r.int(0, 300), "failed", p], [r.int(20, 90), "succeeded", p]]); }        // retry inside 2 min: not failed
  { const p = P(); forced([[r.int(0, 300), "failed", p], [r.int(200, 600), "succeeded", p]]); }      // failed, recovered later
  { const p = P(); forced([[r.int(0, 300), "failed", p], [r.int(10, 60), "failed", p]]); }           // failed, never recovered
  if (level >= 2) {
    const [p1, p2] = r.sample(platforms, 2);
    forced([[r.int(0, 300), "failed", p1], [120, "succeeded", p1]]);                                  // exactly 120 s: same try
    forced([[r.int(0, 300), "failed", p1], [121, "succeeded", p1]]);                                  // 121 s: a new try
    forced([[r.int(0, 300), "failed", p1], [100, "failed", p1], [100, "succeeded", p1]]);             // chained: 200 s after the first
    forced([[r.int(0, 300), "failed", p1], [r.int(5, 60), "succeeded", p2]]);                         // switched platform: counts on p1
    forced([[r.int(0, 300), "failed", p2], [0, "succeeded", p1]]);                                    // same second: lower attempt_id first
    // The same person in a second meeting of the same tenant is a second participant.
    const p0 = parts[0];
    const m2 = meetings.find((m) => m !== p0.meeting && m.tenant === p0.meeting.tenant);
    forced([[r.int(0, 300), "failed", p1], [r.int(20, 90), "succeeded", p1]], { meeting: m2, user: p0.user });
  }
  if (level === 3) {
    const [p1, p2] = r.sample(platforms, 2);
    forced([[r.int(0, 300), "failed", p1], [100, "cancelled", p1], [100, "succeeded", p1]]);          // cancelled does not chain
    forced([[r.int(0, 300), "cancelled", p1]]);                                                       // only cancelled: not a participant
    forced([[r.int(0, 300), "cancelled", p2], [r.int(5, 60), "failed", p1], [r.int(20, 90), "failed", p1]]); // platform of first counted attempt
  }

  // Timestamps and ids: attempts sorted by time; same-second attempts keep their list order.
  const all = [];
  let seq = 0;
  for (const p of parts) {
    let t = p.meeting.start;
    for (const a of p.attempts) {
      t += a.gap;
      a.sec = t;
      a.seq = seq++;
      a.part = p;
      all.push(a);
    }
  }
  all.sort((x, y) => x.sec - y.sec || x.seq - y.seq);
  let id = 50000 + r.int(0, 40000);
  for (const a of all) a.id = (id += r.int(1, 7));

  const cmp = (x, y) => (x < y ? -1 : x > y ? 1 : 0);
  const share = (n, d) => Math.floor((n * 20000 + d) / (2 * d)) / 10000;
  const solve = (o = {}) => {
    const groups = new Map();
    let units = parts;
    if (o.perUser) {                    // wrong grain: one participant per user, across meetings
      const m = new Map();
      for (const p of parts) {
        const k = p.meeting.tenant + "|" + p.user;
        if (!m.has(k)) m.set(k, { meeting: p.meeting, user: p.user, attempts: [] });
        m.get(k).attempts.push(...p.attempts);
      }
      units = [...m.values()];
    }
    for (const p of units) {
      let at = p.attempts.slice().sort((x, y) => x.sec - y.sec || x.id - y.id);
      if (!o.cancelledCounts) at = at.filter((a) => a.outcome !== "cancelled");
      if (!at.length) continue;
      const tries = [];
      let anchor = null, prev = null;
      for (const a of at) {
        const ref = o.anchorFirst ? anchor : prev;
        const gap = ref === null ? Infinity : a.sec - ref;
        const same = o.strict ? gap < WINDOW : gap <= WINDOW;
        if (o.noCollapse || !same) { tries.push([]); anchor = a.sec; }
        tries[tries.length - 1].push(a);
        prev = a.sec;
      }
      const ok = (tr) => tr.some((a) => a.outcome === "succeeded");
      const failed = !ok(tries[0]);
      const recovered = failed && tries.slice(1).some(ok);
      const platform = o.lastPlatform ? at[at.length - 1].platform : at[0].platform;
      const k = p.meeting.tenant + "|" + platform;
      if (!groups.has(k)) groups.set(k, { n: 0, f: 0, rec: 0 });
      const g = groups.get(k);
      g.n++;
      if (failed) g.f++;
      if (recovered) g.rec++;
    }
    return [...groups.entries()]
      .filter(([, g]) => o.noFloor || g.n >= minParticipants)
      .sort((x, y) => cmp(x[0], y[0]))
      .map(([k, g]) => { const [t, p] = k.split("|"); return [t, p, g.n, g.f, g.rec, share(g.f, g.n)]; });
  };

  let minParticipants = 1;
  if (level === 3) {
    minParticipants = 0;
    const sizes = solve().map((row) => row[2]).sort((a, b) => b - a);
    minParticipants = Math.min(sizes[0], Math.max(2, sizes[Math.min(sizes.length - 1, r.int(1, Math.max(1, Math.floor(sizes.length / 2))))]));
  }
  const rows = solve();

  const diagnostics = [
    { message: "Retries were not collapsed: a failed first attempt followed by a success within two minutes is not a failed join.", rows: solve({ noCollapse: true }) },
  ];
  if (level >= 2) {
    diagnostics.push({ message: "A gap of exactly 120 seconds was treated as a new try. Within two minutes includes 120 seconds.", rows: solve({ strict: true }) });
    diagnostics.push({ message: "The two minutes were measured from the first attempt of the try. Each retry is compared with the previous attempt, so a chain of quick retries stays one try.", rows: solve({ anchorFirst: true }) });
    diagnostics.push({ message: "Attempts were grouped per user rather than per meeting and user. The same person joining two meetings is two participants, each with their own first try.", rows: solve({ perUser: true }) });
    diagnostics.push({ message: "Participants were counted on the platform of their last attempt. The platform is the one of the first attempt (lowest attempt_id on a tie).", rows: solve({ lastPlatform: true }) });
  }
  if (level === 3) {
    diagnostics.push({ message: "Cancelled attempts were counted. They are ignored entirely: they do not start or extend a try, and a participant with only cancelled attempts is not counted.", rows: solve({ cancelledCounts: true }) });
    diagnostics.push({ message: `The floor was not applied: only tenant–platform groups with at least ${minParticipants} participants are reported.`, rows: solve({ noFloor: true }) });
  }

  const cols = ["attempt_id", "meeting_id", "tenant_id", "user_id", "client_platform", "attempt_ts", "outcome"];
  const dataRows = all.map((a) => [a.id, a.part.meeting.id, a.part.meeting.tenant, a.part.user, a.platform, ts(day, a.sec), a.outcome]);
  const setup =
    "SET TIME ZONE 'UTC';\n" +
    "CREATE TABLE join_attempts (\n  attempt_id BIGINT PRIMARY KEY,\n  meeting_id TEXT NOT NULL,\n  tenant_id TEXT NOT NULL,\n  user_id TEXT NOT NULL,\n  client_platform TEXT NOT NULL,\n  attempt_ts TIMESTAMPTZ NOT NULL,\n  outcome TEXT NOT NULL CHECK (outcome IN ('succeeded', 'failed', 'cancelled'))\n);\n" +
    insertSQL("join_attempts", cols, dataRows);

  return {
    vars: {
      attempts: all.length,
      min_participants: minParticipants,
      platform_rule: level === 1
        ? "In this sample every participant uses one platform for all of their attempts."
        : "A participant may switch platform between attempts; they are counted once, on the platform of their first attempt. Attempts in the same second are ordered by `attempt_id`.",
      cancel_rule: level === 3
        ? `Some attempts have \`outcome = 'cancelled'\` (the person closed the join screen). Ignore them entirely: they do not start, extend or end a try, a participant whose attempts are all cancelled is not a participant, and the platform is that of the first attempt that is not cancelled. Report only tenant–platform groups with at least ${minParticipants} participants.`
        : "There are no cancelled attempts in this sample; report every tenant–platform group that has a participant.",
    },
    setup,
    tables: [{ name: "join_attempts", columns: cols, rows: dataRows }],
    expected: { columns: ["tenant_id", "client_platform", "participants", "failed_first_try", "recovered_later", "failed_share"], rows },
    diagnostics: diagnostics.filter((d) => JSON.stringify(d.rows) !== JSON.stringify(rows)),
  };
}
