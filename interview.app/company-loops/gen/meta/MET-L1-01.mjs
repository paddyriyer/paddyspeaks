/* MET-L1-01 — Ad frequency caps: impressions served over the cap (SQL).
   Simulated practice scenario. All data is generated from the seed.

   Contract: see docs/COMPANY-INTERVIEW-LOOPS.md § Executable templates (sql).
   level: 1 Medium (one cap and one window for every campaign)
          2 Hard (+ a cap per campaign, a campaign with no impressions, same-second ties)
          3 Very Hard (+ a window per campaign, impressions logged twice, invalid traffic) */
import { insertSQL } from "../../js/rng.js";

export const kind = "sql";

const CAMPAIGNS = ["cmp_aurora", "cmp_bloom", "cmp_cascade", "cmp_drift", "cmp_ember", "cmp_fable", "cmp_glow", "cmp_harbor"];
const BASE = Date.UTC(2026, 8, 21);            // 2026-09-21 00:00:00 UTC; times are seconds from here

export function generate(r, level) {
  const sharedHours = r.pick([24, 48]);
  const sharedCap = r.pick([2, 3, 4]);
  const names = r.sample(CAMPAIGNS, level === 1 ? 3 : 4).sort();
  const campaigns = names.map((campaign_id) => ({
    campaign_id,
    frequency_cap: level === 1 ? sharedCap : r.pick([1, 2, 3, 5]),
    window_hours: level === 3 ? r.pick([12, 24, 48, 72]) : sharedHours,
  }));
  const empty = level >= 2 ? campaigns[campaigns.length - 1 - r.int(0, 1)].campaign_id : null;   // a campaign that served nothing yet

  const people = r.sample([...Array(40)].map((_, i) => 100200 + i * 7 + r.int(0, 6)), 15);
  const users = people.slice(0, 12);          // the random audience
  const [u0, u1, u2] = people.slice(12);      // planted cases get their own users
  const imps = [];                             // {id, user_id, campaign_id, sec, valid}
  let nextId = 5_000_000 + r.int(0, 900_000);
  const push = (user_id, campaign_id, sec, valid = true) => imps.push({ id: nextId++, user_id, campaign_id, sec, valid });

  for (const c of campaigns) {
    if (c.campaign_id === empty) continue;
    const H = c.window_hours * 3600;
    const gaps = [0, 45, 600, 3600, Math.floor(H / 3), H - 1, H, H + 1, Math.floor(H / 2)];
    const audience = r.sample(users, r.int(2, 4));
    for (const u of audience) {
      let t = r.int(0, 20 * 3600);
      const n = r.int(1, c.frequency_cap + 3);
      for (let k = 0; k < n; k++) {
        if (k) t += r.pick(gaps);
        push(u, c.campaign_id, t, level < 3 || !r.chance(0.12));
      }
    }
  }

  // Planted cases on the first campaign that serves impressions.
  const live = campaigns.filter((c) => c.campaign_id !== empty);
  const c0 = live[0], c1 = live[1];
  {
    // A burst: cap + 1 impressions within an hour. The last one is over the cap.
    let t = 30 * 3600 + r.int(0, 3000);
    for (let k = 0; k <= c0.frequency_cap; k++) push(u0, c0.campaign_id, t + k * r.int(60, 400));
  }
  {
    // Exactly one window after the first impression, the first one has left: NOT over the cap.
    const H = c1.window_hours * 3600;
    const t = 26 * 3600 + r.int(0, 3000);
    for (let k = 0; k < c1.frequency_cap; k++) push(u1, c1.campaign_id, t + k * 120);
    push(u1, c1.campaign_id, t + H);
  }
  if (level >= 2) {
    // Two impressions in the same second; only the later impression_id is over the cap.
    const t = 40 * 3600 + r.int(0, 3000);
    for (let k = 0; k < c0.frequency_cap - 1; k++) push(u2, c0.campaign_id, t + k * 90);
    const tie = t + c0.frequency_cap * 90;
    push(u2, c0.campaign_id, tie);
    push(u2, c0.campaign_id, tie);
  }
  if (level === 3) {
    // Invalid traffic in the middle of a burst does not count toward the cap.
    const t = 50 * 3600 + r.int(0, 3000);
    const c = live[live.length - 1];
    for (let k = 0; k < c.frequency_cap; k++) push(u1, c.campaign_id, t + k * 200, k !== 0);
    push(u1, c.campaign_id, t + c.frequency_cap * 200);
  }

  // Logged rows: at Very Hard, client and server both log some impressions (same impression_id).
  const logged = [];
  for (const e of imps) {
    const lag = r.int(1, 90);
    logged.push({ ...e, logged_by: "client", lag });
    if (level === 3 && r.chance(0.25)) logged.push({ ...e, logged_by: "server", lag: lag + r.int(1, 600) });
  }

  const capOf = new Map(campaigns.map((c) => [c.campaign_id, c]));
  const compute = (opts) => {
    let src = imps;
    if (opts.noDedup) src = logged;
    if (!opts.countInvalid) src = src.filter((e) => e.valid);
    const per = new Map(campaigns.map((c) => [c.campaign_id, { n: 0, over: 0, users: new Set() }]));
    for (const a of src) {
      const c = capOf.get(a.campaign_id);
      const H = (opts.oneWindow ? sharedHours : c.window_hours) * 3600;
      let n = 0;
      for (const b of src) {
        if (b.user_id !== a.user_id || b.campaign_id !== a.campaign_id) continue;
        const inside = opts.closed ? b.sec >= a.sec - H : b.sec > a.sec - H;
        const before = b.sec < a.sec || (b.sec === a.sec && (opts.peers || b.id <= a.id));
        if (inside && before) n++;
      }
      const s = per.get(a.campaign_id);
      s.n++;
      if (opts.geCap ? n >= c.frequency_cap : n > c.frequency_cap) { s.over++; s.users.add(a.user_id); }
    }
    const out = [];
    for (const c of campaigns) {
      const s = per.get(c.campaign_id);
      if (opts.inner && s.n === 0) continue;
      out.push([c.campaign_id, s.n, s.over, s.users.size]);
    }
    return out;
  };
  const rows = compute({});

  const diagnostics = [
    { message: "The window was closed at its start. An impression exactly one window earlier has left it: count only impressions with served_at > this one's served_at minus the window.", rows: compute({ closed: true }) },
    { message: "An impression was flagged when it reached the cap. The cap is the number allowed: an impression is over the cap only when it is number cap + 1 or later in its window.", rows: compute({ geCap: true }) },
  ];
  if (level >= 2) {
    diagnostics.push({ message: "Impressions served in the same second were counted as peers (a RANGE window, or <= on served_at alone), so both were flagged. Break ties by impression_id: the earlier id was served first.", rows: compute({ peers: true }) });
    diagnostics.push({ message: "A campaign with no impressions disappeared. Start from campaigns and LEFT JOIN, so it reports 0 impressions.", rows: compute({ inner: true }) });
  }
  if (level === 3) {
    diagnostics.push({ message: "Impressions logged by both client and server were counted twice. Keep one row per impression_id before counting.", rows: compute({ noDedup: true }) });
    diagnostics.push({ message: "Invalid traffic was counted. Impressions with is_valid = false were not real exposures: they neither count toward the cap nor appear in the totals.", rows: compute({ countInvalid: true }) });
    diagnostics.push({ message: `Every campaign used the same ${sharedHours}-hour window. Each campaign has its own window_hours.`, rows: compute({ oneWindow: true }) });
  }

  const impCols = ["impression_id", "user_id", "campaign_id", "served_at", "logged_at", "logged_by", "is_valid"];
  const impRows = logged
    .map((e) => [e.id, e.user_id, e.campaign_id, at(e.sec), at(e.sec + e.lag), e.logged_by, e.valid])
    .sort((a, b) => (a[3] < b[3] ? -1 : a[3] > b[3] ? 1 : a[0] - b[0] || (a[5] < b[5] ? -1 : 1)));
  const campCols = ["campaign_id", "frequency_cap", "window_hours"];
  const campRows = campaigns.map((c) => [c.campaign_id, c.frequency_cap, c.window_hours]);

  const setup =
    "SET TIME ZONE 'UTC';\n" +
    "CREATE TABLE campaigns (\n  campaign_id TEXT PRIMARY KEY,\n  frequency_cap INT NOT NULL CHECK (frequency_cap > 0),\n  window_hours INT NOT NULL CHECK (window_hours > 0)\n);\n" +
    "CREATE TABLE ad_impressions (\n  impression_id BIGINT NOT NULL,\n  user_id BIGINT NOT NULL,\n  campaign_id TEXT NOT NULL REFERENCES campaigns,\n  served_at TIMESTAMPTZ NOT NULL,\n  logged_at TIMESTAMPTZ NOT NULL,\n  logged_by TEXT NOT NULL CHECK (logged_by IN ('client','server')),\n  is_valid BOOLEAN NOT NULL\n);\n" +
    insertSQL("campaigns", campCols, campRows) + insertSQL("ad_impressions", impCols, impRows);

  return {
    vars: {
      impressions: impRows.length,
      cap_rule:
        level === 1
          ? `Every campaign has the same cap (${sharedCap}) and the same window (${sharedHours} hours); both are also in \`campaigns\`.`
          : level === 2
            ? `Each campaign has its own \`frequency_cap\`; every window is ${sharedHours} hours. A campaign may have served no impressions yet: it is still reported, with zeros.`
            : "Each campaign has its own `frequency_cap` and its own `window_hours`. A campaign may have served no impressions yet: it is still reported, with zeros.",
      log_rule:
        level === 3
          ? "Some impressions were logged twice, once by the client and once by the server, with the same `impression_id`: count each impression once. Impressions with `is_valid = false` were filtered as invalid traffic: ignore them completely."
          : "Each impression is logged once, and every row is valid.",
    },
    setup,
    tables: [
      { name: "campaigns", columns: campCols, rows: campRows },
      { name: "ad_impressions", columns: impCols, rows: impRows },
    ],
    expected: { columns: ["campaign_id", "impressions", "over_cap_impressions", "users_over_cap"], rows },
    diagnostics: diagnostics.filter((d) => JSON.stringify(d.rows) !== JSON.stringify(rows)),
  };
}

function at(sec) {                             // seconds from BASE -> "2026-09-21 01:02:03+00"
  return new Date(BASE + sec * 1000).toISOString().replace("T", " ").replace(".000Z", "+00");
}
