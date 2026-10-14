/* ADB-L1-02 — First-week activation: new users who saved a cloud document within 7 days (SQL).
   Simulated practice scenario. All data is generated from the seed. The activation rule is this
   exercise's hypothetical definition, not any product's published metric.

   Contract: see docs/COMPANY-INTERVIEW-LOOPS.md § Executable templates (sql).
   expected comes from the JavaScript oracle below, written independently of the evaluator's SQL.
   level: 1 Medium (reinstalls are not new users; a half-open 7-day window; saves in another app do not count)
          2 Hard (+ local saves that do not count, a save at the install instant, an install in the last
            minute of a month, a user new to two apps)
          3 Very Hard (+ the data ends at `as_of`: users whose 7 days are not over are not yet measurable,
            including a whole cohort month with nobody measurable) */
import { insertSQL } from "../../js/rng.js";

export const kind = "sql";

const APPS = ["acrobat", "express", "illustrator", "lightroom", "photoshop"];
const DAY = 86400;
const T0 = Date.UTC(2026, 8, 1);                 // 2026-09-01 00:00:00 UTC; times are seconds after it
const stamp = (abs) => new Date(T0 + abs * 1000).toISOString().replace("T", " ").slice(0, 19) + "+00";
const cmp = (x, y) => (x < y ? -1 : x > y ? 1 : 0);

export function generate(r, level) {
  const apps = r.sample(APPS, level === 1 ? 2 : 3).sort();
  const asOfDay = level === 3 ? 61 + r.int(3, 5) : 68;  // L3: 2026-11-04..06; else 2026-11-08
  const asOf = asOfDay * DAY;
  const lastInstall = level === 3 ? asOf - 3600 : 61 * DAY - 1;   // L1/L2: installs end with October
  const nPairs = level === 1 ? 12 : level === 2 ? 16 : 20;

  const scenarios = ["within", "within", "late", "exact7", "none", "other_app", "reinstall"];
  if (level >= 2) scenarios.push("local", "at_install", "within");
  const forced = ["within", "exact7", "reinstall", "other_app"];
  if (level >= 2) forced.push("local", "at_install", "boundary", "two_apps");
  if (level === 3) forced.push("asof_exact", "asof_pending", "nov");

  const users = new Set();
  const newUser = () => { let u; do u = "usr_" + r.int(1000, 9999); while (users.has(u)); users.add(u); return u; };
  const installs = [];   // {u, app, at}
  const saves = [];      // {u, app, at, loc}
  const pairs = [];      // {u, app, first}
  const usedPair = new Set();

  const addPair = (u, app, first, sc) => {
    usedPair.add(u + "|" + app);
    pairs.push({ u, app, first });
    installs.push({ u, app, at: first });
    const inWin = () => first + r.int(60, 7 * DAY - 60);
    switch (sc) {
      case "within": case "boundary": case "asof_exact":
        saves.push({ u, app, at: inWin(), loc: "cloud" });
        if (r.chance(0.4)) saves.push({ u, app, at: inWin(), loc: "cloud" });
        break;
      case "at_install": saves.push({ u, app, at: first, loc: "cloud" }); break;
      case "exact7": saves.push({ u, app, at: first + 7 * DAY, loc: "cloud" }); break;
      case "late": saves.push({ u, app, at: first + 7 * DAY + r.int(60, 5 * DAY), loc: "cloud" }); break;
      case "local": saves.push({ u, app, at: inWin(), loc: "local" }); break;
      case "other_app": {
        const other = apps.find((a) => a !== app && !usedPair.has(u + "|" + a));
        saves.push({ u, app: other, at: inWin(), loc: "cloud" });
        break;
      }
      case "reinstall": {
        const re = first + r.int(9, 20) * DAY + r.int(0, DAY - 1);
        installs.push({ u, app, at: re });
        saves.push({ u, app, at: re + r.int(60, 3 * DAY), loc: "cloud" });
        break;
      }
      case "asof_pending": case "nov":
        if (r.chance(0.6)) saves.push({ u, app, at: Math.min(first + r.int(60, 2 * DAY), asOf - 60), loc: "cloud" });
        break;
      default: break;    // none
    }
  };

  const randomFirst = () => r.int(0, Math.min(lastInstall, level === 3 ? asOf - 8 * DAY : lastInstall));
  for (let i = 0; i < nPairs; i++) {
    const sc = i < forced.length ? forced[i] : r.pick(scenarios);
    const u = newUser();
    let app = r.pick(apps);
    let first = randomFirst();
    if (sc === "boundary") first = 30 * DAY - r.int(1, 59);            // last minute of September
    if (sc === "asof_exact") first = asOf - 7 * DAY;                     // its 7 days end exactly at as_of
    if (sc === "asof_pending") first = asOf - 7 * DAY + r.int(1, 3) * DAY;
    if (sc === "nov") first = 61 * DAY + r.int(0, asOf - 61 * DAY - 7200);
    if (sc === "reinstall") first = r.int(0, asOf - 25 * DAY);          // the reinstall stays inside the data
    if (sc === "two_apps") {
      const [a1, a2] = r.sample(apps, 2);
      addPair(u, a1, first, "within");
      addPair(u, a2, Math.min(first + r.int(1, 10) * DAY, level === 3 ? asOf - 8 * DAY : lastInstall), r.pick(["within", "none", "late"]));
      continue;
    }
    addPair(u, app, first, sc);
  }
  // L3: another November user so that month has more than one new user, none measurable.
  if (level === 3) addPair(newUser(), r.pick(apps), 61 * DAY + r.int(0, asOf - 61 * DAY - 7200), "nov");

  // Nothing after the data's end.
  for (const list of [installs, saves]) for (let k = list.length - 1; k >= 0; k--) if (list[k].at >= asOf) list.splice(k, 1);

  const monthKey = (abs) => stamp(abs).slice(0, 7) + "-01";
  const share = (n, d) => (d === 0 ? null : Math.floor((n * 20000 + d) / (2 * d)) / 10000);
  const solve = (o = {}) => {
    // o.everyInstall: each install row is its own new user.
    const cohort = o.everyInstall ? installs.map((x) => ({ u: x.u, app: x.app, first: x.at })) : pairs;
    const agg = new Map();
    for (const p of cohort) {
      const k = p.app + "|" + monthKey(p.first);
      if (!agg.has(k)) agg.set(k, { n: 0, m: 0, a: 0 });
      const s = agg.get(k);
      s.n++;
      const measurable = o.ignoreAsOf || p.first + 7 * DAY <= asOf;
      if (!measurable) continue;
      s.m++;
      const end = p.first + 7 * DAY;
      if (saves.some((v) => v.u === p.u && v.app === p.app && (o.anyLocation || v.loc === "cloud") &&
                            v.at >= p.first && (o.inclusive ? v.at <= end : v.at < end))) s.a++;
    }
    return [...agg.entries()].sort((x, y) => cmp(x[0], y[0])).map(([k, s]) => {
      const [app, month] = k.split("|");
      return [app, month, s.n, s.m, s.a, share(s.a, s.m)];
    });
  };
  const rows = solve();

  const diagnostics = [
    { message: "Reinstalls were counted as new users. A user is new to an app once, at their first install of it; later installs start no new window.", rows: solve({ everyInstall: true }) },
    { message: "The 7-day window included its end. A save exactly 7 days after the first install is outside the window.", rows: solve({ inclusive: true }) },
  ];
  if (level >= 2) diagnostics.push({ message: "Local saves were counted. Only saves with location 'cloud' activate a user.", rows: solve({ anyLocation: true }) });
  if (level === 3) diagnostics.push({ message: "Users whose 7 days had not ended by as_of were counted as measurable (and so as not activated). They belong in new_users only.", rows: solve({ ignoreAsOf: true }) });

  let iid = 7000 + r.int(0, 2000), sid = 50000 + r.int(0, 20000);
  const iRows = installs.slice().sort((x, y) => x.at - y.at || cmp(x.u, y.u)).map((x) => [iid += r.int(1, 7), x.u, x.app, stamp(x.at)]);
  const sRows = saves.slice().sort((x, y) => x.at - y.at || cmp(x.u, y.u)).map((x) => [sid += r.int(1, 7), x.u, x.app, stamp(x.at), x.loc]);
  const iCols = ["install_id", "user_id", "app", "installed_ts"];
  const sCols = ["save_id", "user_id", "app", "saved_ts", "location"];
  const setup =
    "SET TIME ZONE 'UTC';\n" +
    "CREATE TABLE installs (\n  install_id BIGINT PRIMARY KEY,\n  user_id TEXT NOT NULL,\n  app TEXT NOT NULL,\n  installed_ts TIMESTAMPTZ NOT NULL\n);\n" +
    "CREATE TABLE saves (\n  save_id BIGINT PRIMARY KEY,\n  user_id TEXT NOT NULL,\n  app TEXT NOT NULL,\n  saved_ts TIMESTAMPTZ NOT NULL,\n  location TEXT NOT NULL CHECK (location IN ('cloud', 'local'))\n);\n" +
    insertSQL("installs", iCols, iRows) + insertSQL("saves", sCols, sRows);

  return {
    vars: {
      as_of: stamp(asOf),
      installs: iRows.length,
      saves: sRows.length,
      location_rule: level === 1
        ? "Every save in this sample is a cloud save, but filter on `location` anyway."
        : "Saves with `location = 'local'` never count; only `'cloud'` saves do.",
      asof_rule: level === 3
        ? "The data ends at `as_of` (exclusive). A new user is **measurable** only if their 7 days are over by then (first install + 7 days ≤ `as_of`); users who are not measurable count in `new_users` and nowhere else, even if they have already saved. A cohort month with no measurable user has `activation_rate` NULL."
        : "Every new user in this sample installed more than 7 days before `as_of`, so `measurable_users = new_users`; keep the rule in your query anyway.",
    },
    setup,
    tables: [
      { name: "installs", columns: iCols, rows: iRows },
      { name: "saves", columns: sCols, rows: sRows },
    ],
    expected: { columns: ["app", "cohort_month", "new_users", "measurable_users", "activated", "activation_rate"], rows },
    diagnostics: diagnostics.filter((d) => JSON.stringify(d.rows) !== JSON.stringify(rows)),
  };
}
