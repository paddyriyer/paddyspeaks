/* ANT-L3-05 — Threshold-protected weekly usage-pattern aggregates (SQL).
   Simulated practice scenario. All data, names and thresholds are generated from the
   seed and are hypothetical.

   Contract: docs/COMPANY-INTERVIEW-LOOPS.md § Executable templates.
   One deterministic result set: one row per published (week, task category) cell, plus
   at most one `other` row per week that merges every suppressed cell of that week:
     conversations  eligible conversations in the cell
     users          distinct pseudonymous user keys in the cell
     orgs           distinct organizations in the cell
   A cell is published when users >= min_users AND orgs >= min_orgs; the `other` row is
   counted over the UNION of the suppressed cells (distinct, never summed) and is itself
   published only when it clears the same thresholds.
   level: 1 Medium    one facet row per classified conversation, users threshold only,
                      deletions, an opted-out organization, unclassified conversations,
                      a cell at exactly the threshold, a week whose `other` row fails
          2 Hard      + an organization threshold, re-classification (latest facet wins),
                      a cell with enough users from too few organizations
          3 Very Hard + a retention window that starts and ends mid-week (partial weeks),
                      facets classified after the report time (ignored), a deletion
                      requested after the report time (still honoured) */
import { insertSQL } from "../../js/rng.js";

export const kind = "sql";

const DAY = 86400, H = 3600, WEEK = 7 * DAY;
// Letters only, so text ordering is the same under every collation.
const CATEGORIES = ["analysis", "brainstorming", "coding", "debugging", "drafting", "marketing", "planning",
  "research", "spreadsheets", "summarizing", "support", "translation", "tutoring", "writing"];
const ORG_NAMES = ["alder", "bramble", "corvid", "dovetail", "estuary", "foxglove", "granite", "heron",
  "inlet", "jasper", "kelp", "larch", "meridian", "nimbus", "oriel", "pylon"];

function stamp(t) {
  const iso = new Date(t * 1000).toISOString();
  return `${iso.slice(0, 10)} ${iso.slice(11, 19)}+00`;
}
const dateOf = (t) => new Date(t * 1000).toISOString().slice(0, 10);
const mondayOf = (t) => t - ((((t - 4 * DAY) % WEEK) + WEEK) % WEEK);   // 1970-01-05 was a Monday
const sundayOf = (t) => t - ((((t - 3 * DAY) % WEEK) + WEEK) % WEEK);   // 1970-01-04 was a Sunday

export function generate(r, level) {
  const minUsers = r.pick([3, 4, 5]);
  const minOrgs = level === 1 ? 1 : r.pick([2, 3]);
  const base = Date.UTC(2026, 6, 6) / 1000 + WEEK * r.int(0, 10);       // a Monday, 00:00 UTC

  let winStart, winEnd, reportAt, retention = null;
  if (level < 3) {
    winStart = base + WEEK;
    winEnd = winStart + 3 * WEEK;
    reportAt = winEnd + r.int(1, 3) * DAY + r.int(1, 20) * H;
  } else {
    retention = r.pick([14, 21]);                                       // whole weeks: both ends fall mid-week
    reportAt = base + 4 * WEEK + r.int(1, 4) * DAY + r.int(1, 21) * H + r.pick([0, 1800]);
    winStart = reportAt - retention * DAY;
    winEnd = reportAt;
  }

  // Organizations and their pseudonymous users; the last organization has opted out.
  const orgNames = r.sample(ORG_NAMES, r.int(6, 7) + 1);
  const usedKeys = new Set();
  const newKey = () => {
    let k;
    do k = "u_" + r.int(0, 0xffffff).toString(16).padStart(6, "0"); while (usedKeys.has(k));
    usedKeys.add(k);
    return k;
  };
  const orgs = orgNames.map((n, i) => ({ id: "org_" + n, optOut: i === orgNames.length - 1, users: [] }));
  for (const o of orgs) for (let k = 0, n = r.int(minUsers + 2, minUsers + 4); k < n; k++) o.users.push({ key: newKey(), org: o.id });
  const optOrg = orgs[orgs.length - 1];
  const normalOrgs = orgs.filter((o) => !o.optOut);
  const normalUsers = normalOrgs.flatMap((o) => o.users);

  const convs = [];
  const clampFacet = (t, at) => (at > reportAt && t < reportAt ? t + Math.floor((reportAt - t) / 2) : at);
  const addConv = (user, t, cat) => {
    const c = { user: user.key, org: user.org, created: t, facets: [], deleted: null, seq: convs.length };
    if (cat !== null) c.facets.push({ cat, at: clampFacet(t, t + r.int(60, 4 * H)) });
    convs.push(c);
    return c;
  };

  // Users for a cell: at least `spread` distinct organizations, then filled at random.
  const pickSpread = (n, spread) => {
    const out = [];
    for (const o of r.sample(normalOrgs, spread)) out.push(r.pick(o.users));
    for (const u of r.shuffle(normalUsers)) {
      if (out.length >= n) break;
      if (!out.includes(u)) out.push(u);
    }
    return out;
  };

  // The weeks the window touches, each clipped to the window.
  const weeks = [];
  for (let w = mondayOf(winStart); w < winEnd; w += WEEK) weeks.push({ start: Math.max(w, winStart), end: Math.min(w + WEEK, winEnd), monday: w });
  const failWeek = r.int(0, weeks.length - 1);
  const perUser = level === 1 ? 2 : 3;
  const weekCats = [];

  weeks.forEach((seg, wi) => {
    const when = () => r.int(seg.start, seg.end - 1);
    const cats = r.shuffle(CATEGORIES);
    weekCats.push(cats.slice(0, 6));
    let roles;
    if (wi === failWeek) roles = ["big", "exact", "tiny"];
    else {
      const lifts = level === 1 ? r.sample(["deleted", "optout"], 1) : r.sample(["deleted", "optout", "orgshort"], 2);
      roles = ["big", "exact", "below", "below", ...lifts];
    }
    let firstBelow = null;
    roles.forEach((role, ci) => {
      const cat = cats[ci];
      let users = [], extra = [], deletedUser = null;
      if (role === "big") users = pickSpread(minUsers + r.int(1, 4), Math.max(minOrgs, 2));
      else if (role === "exact") users = pickSpread(minUsers, minOrgs);
      else if (role === "tiny") users = pickSpread(r.int(1, minUsers - 2), 1);
      else if (role === "below") {
        users = pickSpread(minUsers - 1, 1);
        if (firstBelow === null) firstBelow = users;
        else if (!users.includes(firstBelow[0])) users[0] = firstBelow[0];   // a user in two suppressed cells
      } else if (role === "deleted") {
        users = pickSpread(minUsers - 1, 1);
        deletedUser = r.pick(normalUsers.filter((u) => !users.includes(u)));
      } else if (role === "optout") {
        users = pickSpread(minUsers - 1, 1);
        extra = r.sample(optOrg.users, r.int(1, 2));
      } else if (role === "orgshort") {
        const pool = r.sample(normalOrgs, minOrgs - 1).flatMap((o) => o.users);
        users = r.sample(pool, Math.min(pool.length, minUsers + r.int(0, 2)));
      }
      for (const u of [...users, ...extra]) {
        const n = r.int(1, perUser);
        const made = [];
        for (let k = 0; k < n; k++) made.push(addConv(u, when(), cat));
        // A user with two or more conversations deletes one: the cell keeps the user.
        if (made.length >= 2 && (role === "big" || role === "exact") && r.chance(0.25)) made[0].deleted = made[0].created + r.int(H, 5 * DAY);
      }
      if (deletedUser) {
        for (let k = 0, n = r.int(1, 2); k < n; k++) {
          const c = addConv(deletedUser, when(), cat);
          c.deleted = c.created + r.int(10 * 60, 3 * DAY);
        }
      }
    });
    // An unclassified conversation (no facet row) every week.
    addConv(r.pick(normalUsers), when(), null);
  });

  // Boundaries: a conversation exactly at the window start (included) and, when a week
  // starts inside the window, one exactly at that Monday 00:00 (it belongs to that week).
  const bigOf = (wi) => weekCats[wi][0];
  addConv(r.pick(normalUsers), winStart, bigOf(0));
  if (weeks.length > 1) addConv(r.pick(normalUsers), weeks[1].monday, bigOf(1));

  // Outside the window: before it (still in the table, e.g. waiting for the purge), at
  // exactly its end (excluded: the end is exclusive) and after it.
  const anyCat = () => r.pick(weekCats[r.int(0, weekCats.length - 1)].slice(0, 4));
  for (let k = 0, n = r.int(4, 7); k < n; k++) addConv(r.pick(normalUsers), winStart - r.int(60, 6 * DAY), anyCat());
  addConv(r.pick(normalUsers), winEnd, anyCat());
  for (let k = 0, n = r.int(2, 4); k < n; k++) addConv(r.pick(normalUsers), winEnd + r.int(60, 2 * DAY), anyCat());

  // Re-classification (Hard+): an earlier facet row with a different category.
  if (level >= 2) {
    for (const c of convs) {
      if (!c.facets.length || !r.chance(0.18)) continue;
      const f = c.facets[0];
      const later = f.at + r.int(10 * 60, 2 * H);
      if (c.created < winEnd && later > reportAt) continue;
      const other = r.pick(CATEGORIES.filter((x) => x !== f.cat));
      c.facets = [{ cat: other, at: f.at }, { cat: f.cat, at: later }];
    }
  }

  // Very Hard: facts that only arrive after the report time.
  if (level === 3) {
    const lastCats = weekCats[weekCats.length - 1];
    const late = addConv(r.pick(normalUsers), reportAt - r.int(10 * 60, 2 * H), r.pick(lastCats.slice(0, 2)));
    late.facets = [{ cat: late.facets.length ? late.facets[0].cat : lastCats[0], at: reportAt + r.int(60, 3 * H) }];
    const inWin = convs.filter((c) => c.created >= winStart && c.created < winEnd && c.facets.length && c !== late && !c.deleted
      && orgs.find((o) => o.id === c.org && !o.optOut));
    const re = r.pick(inWin);
    const cur = re.facets[re.facets.length - 1];
    re.facets.push({ cat: r.pick(CATEGORIES.filter((x) => x !== cur.cat)), at: reportAt + r.int(60, 5 * H) });
    const del = r.pick(inWin.filter((c) => c !== re));
    del.deleted = reportAt + r.int(H, 2 * DAY);                          // requested after the report: still honoured
  }

  // Ids in creation order.
  convs.sort((a, b) => a.created - b.created || a.seq - b.seq);
  let cid = 40000 + r.int(0, 50000);
  for (const c of convs) c.id = "cv_" + cid++;

  // The oracle. opts break one rule each, for diagnostics.
  const optOut = new Set(orgs.filter((o) => o.optOut).map((o) => o.id));
  const NULLCAT = "\u0000";
  const compute = (opts = {}) => {
    const cells = new Map();                                          // week|cat -> cell
    for (const c of convs) {
      if (!opts.noWindow && !(c.created >= winStart && c.created < winEnd)) continue;
      if (!opts.keepOptOut && optOut.has(c.org)) continue;
      if (c.deleted !== null && !opts.keepDeleted && !(opts.deletionBeforeReport && c.deleted > reportAt)) continue;
      const fs = c.facets.filter((f) => opts.ignoreReportAt || f.at <= reportAt).sort((a, b) => a.at - b.at);
      let cats;
      if (!fs.length) cats = opts.unclassifiedOther ? [NULLCAT] : [];
      else if (opts.allFacets) cats = fs.map((f) => f.cat);
      else cats = [opts.firstFacet ? fs[0].cat : fs[fs.length - 1].cat];
      const week = opts.sundayWeeks ? sundayOf(c.created) : mondayOf(c.created);
      for (const cat of cats) {
        const key = week + "|" + cat;
        if (!cells.has(key)) cells.set(key, { week, cat, n: 0, users: new Set(), orgs: new Set() });
        const cell = cells.get(key);
        cell.n++;
        cell.users.add(c.user);
        cell.orgs.add(c.org);
      }
    }
    const pass = (u, o) => (opts.strict ? u > minUsers : u >= minUsers) && (opts.usersOnly || (opts.strict ? o > minOrgs : o >= minOrgs));
    const rows = [];
    const others = new Map();
    for (const cell of cells.values()) {
      if (cell.cat !== NULLCAT && pass(cell.users.size, cell.orgs.size)) {
        rows.push([cell.week, cell.cat, cell.n, cell.users.size, cell.orgs.size]);
        continue;
      }
      if (!others.has(cell.week)) others.set(cell.week, { n: 0, users: new Set(), orgs: new Set(), su: 0, so: 0 });
      const o = others.get(cell.week);
      o.n += cell.n;
      o.su += cell.users.size;
      o.so += cell.orgs.size;
      for (const u of cell.users) o.users.add(u);
      for (const g of cell.orgs) o.orgs.add(g);
    }
    if (!opts.dropOther) {
      for (const [week, o] of others) {
        const u = opts.sumDistinct ? o.su : o.users.size, g = opts.sumDistinct ? o.so : o.orgs.size;
        if (opts.otherAlways || pass(u, g)) rows.push([week, "other", o.n, u, g]);
      }
    }
    rows.sort((a, b) => a[0] - b[0] || (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0));
    return rows.map((x) => [dateOf(x[0]), x[1], x[2], x[3], x[4]]);
  };
  const rows = compute();

  const diagnostics = [
    { message: "Conversations with a deletion request were counted. A deleted conversation leaves every aggregate, including the cell it would have lifted over the threshold.", rows: compute({ keepDeleted: true }) },
    { message: "Conversations from an organization that opted out of analysis were counted. Leave out every conversation whose organization has analytics_opt_out = true.", rows: compute({ keepOptOut: true }) },
    { message: "The thresholds are inclusive: a cell with exactly min_users distinct users (and exactly min_orgs organizations) is published.", rows: compute({ strict: true }) },
    { message: "The `other` row's users and orgs were summed across the suppressed cells. A user in two suppressed categories is one user: count distinct keys over the union of the suppressed conversations, then apply the threshold to that.", rows: compute({ sumDistinct: true }) },
    { message: "Suppressed cells were dropped instead of being merged into one `other` row per week.", rows: compute({ dropOther: true }) },
    { message: "The `other` row was published without checking it. It is an aggregate like any other and is published only when it clears the same thresholds.", rows: compute({ otherAlways: true }) },
    { message: "Unclassified conversations (no facet row) were counted, as a NULL category or in `other`. A conversation without a category is not counted anywhere.", rows: compute({ unclassifiedOther: true }) },
    { message: "Weeks started on Sunday. week_start is the Monday (ISO week, UTC): date_trunc('week', …) in PostgreSQL; BigQuery's WEEK defaults to Sunday and needs WEEK(MONDAY).", rows: compute({ sundayWeeks: true }) },
    { message: level === 3 ? "Conversations outside the retention window were counted. Only conversations created at or after the cut-off and before the report time may be used, even though older rows are still in the table." : "Conversations outside the window were counted. The window is half-open: at or after its start, before its end.", rows: compute({ noWindow: true }) },
  ];
  if (level >= 2) {
    diagnostics.push(
      { message: "The organization threshold was ignored. A cell needs at least min_orgs distinct organizations as well as min_users users; many users from one or two organizations can still identify those organizations.", rows: compute({ usersOnly: true }) },
      { message: "A re-classified conversation was counted under its first category. The facet row with the latest classified_at is the conversation's category.", rows: compute({ firstFacet: true }) },
      { message: "Every facet row was joined, so a re-classified conversation was counted once per classification. Pick one facet per conversation (the latest) before aggregating.", rows: compute({ allFacets: true }) },
    );
  }
  if (level === 3) {
    diagnostics.push(
      { message: "Facet rows classified after report_at were used. The report must be reproducible as of report_at: a later re-classification does not change it, and a conversation first classified later is unclassified for this report.", rows: compute({ ignoreReportAt: true }) },
      { message: "Only deletions requested before report_at were honoured. A deletion is honoured whenever the report is run, whatever its time: reproducibility never brings deleted data back.", rows: compute({ deletionBeforeReport: true }) },
    );
  }

  const facetRows = [];
  for (const c of convs) for (const f of c.facets) facetRows.push([c.id, f.cat, stamp(f.at)]);
  facetRows.sort((a, b) => (a[2] < b[2] ? -1 : a[2] > b[2] ? 1 : a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  const delRows = convs.filter((c) => c.deleted !== null).map((c) => [c.id, stamp(c.deleted)])
    .sort((a, b) => (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : a[0] < b[0] ? -1 : 1));
  const oCols = ["org_id", "analytics_opt_out"];
  const cCols = ["conversation_id", "org_id", "user_key", "created_at"];
  const fCols = ["conversation_id", "task_category", "classified_at"];
  const dCols = ["conversation_id", "requested_at"];
  const oRows = orgs.map((o) => [o.id, o.optOut]).sort((a, b) => (a[0] < b[0] ? -1 : 1));
  const cRows = convs.map((c) => [c.id, c.org, c.user, stamp(c.created)]);

  const setup =
    "SET TIME ZONE 'UTC';\n" +
    "CREATE TABLE orgs (\n  org_id TEXT PRIMARY KEY,\n  analytics_opt_out BOOLEAN NOT NULL\n);\n" +
    "CREATE TABLE conversations (\n  conversation_id TEXT PRIMARY KEY,\n  org_id TEXT NOT NULL REFERENCES orgs (org_id),\n  user_key TEXT NOT NULL,\n  created_at TIMESTAMPTZ NOT NULL\n);\n" +
    "CREATE TABLE conversation_facets (\n  conversation_id TEXT NOT NULL REFERENCES conversations (conversation_id),\n  task_category TEXT NOT NULL,\n  classified_at TIMESTAMPTZ NOT NULL,\n  PRIMARY KEY (conversation_id, classified_at)\n);\n" +
    "CREATE TABLE deletion_requests (\n  conversation_id TEXT PRIMARY KEY REFERENCES conversations (conversation_id),\n  requested_at TIMESTAMPTZ NOT NULL\n);\n" +
    insertSQL("orgs", oCols, oRows) + insertSQL("conversations", cCols, cRows) +
    insertSQL("conversation_facets", fCols, facetRows) + insertSQL("deletion_requests", dCols, delRows);

  const ws = stamp(winStart), we = stamp(winEnd), ra = stamp(reportAt);
  return {
    vars: {
      window_start: ws,
      window_end: we,
      report_at: ra,
      min_users: minUsers,
      min_orgs: minOrgs,
      conversations: cRows.length,
      window_rule: level === 3
        ? `Retention is ${retention} days. The report is produced at \`${ra}\` and may use only conversations created at or after \`${ws}\` (the report time minus ${retention} days) and before \`${ra}\`. Older conversations are still in the table because the purge job has not reached them; they must not be used. The first and last weeks are partial: report them with what the window contains.`
        : `The report covers conversations created at or after \`${ws}\` and before \`${we}\` (three whole weeks). It is produced at \`${ra}\`.`,
      threshold_rule: level === 1
        ? `A cell is publishable when it has at least ${minUsers} distinct users. (In this extract the organization threshold is 1, so every non-empty cell meets it.)`
        : `A cell is publishable when it has at least ${minUsers} distinct users AND at least ${minOrgs} distinct organizations.`,
      facet_rule: level === 1
        ? "Each classified conversation has exactly one row in `conversation_facets`."
        : level === 2
          ? "The classifier is re-run from time to time, so a conversation can have several facet rows: the one with the latest `classified_at` is its category."
          : `The classifier is re-run from time to time, so a conversation can have several facet rows: its category is the one with the latest \`classified_at\` at or before \`${ra}\`. Rows classified after the report time are ignored, so the report can be reproduced; a conversation with no row by then is unclassified for this report.`,
    },
    setup,
    tables: [
      { name: "orgs", columns: oCols, rows: oRows },
      { name: "conversations", columns: cCols, rows: cRows },
      { name: "conversation_facets", columns: fCols, rows: facetRows },
      { name: "deletion_requests", columns: dCols, rows: delRows },
    ],
    expected: { columns: ["week_start", "task_category", "conversations", "users", "orgs"], rows },
    diagnostics: diagnostics.filter((d) => JSON.stringify(d.rows) !== JSON.stringify(rows)),
  };
}
