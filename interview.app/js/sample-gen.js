// ════════════════════════════════════════════════════════════
// Synthetic sample-data generator for SQL playground.
// Given a list of { table, columns }, infers types from column names,
// generates plausible rows (with referential integrity), and creates
// the tables in the provided sql.js Database.
// ════════════════════════════════════════════════════════════

// Deterministic PRNG so the same question always produces the same data.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NAME_POOL = [
  "Alex", "Bailey", "Casey", "Drew", "Ellis", "Frankie", "Gray", "Harper",
  "Indigo", "Jamie", "Kai", "Logan", "Morgan", "Nico", "Ola", "Parker",
  "Quinn", "Reese", "Sage", "Tatum", "Umi", "Val", "Wren", "Xen", "Yu", "Zane",
];
const SURNAME_POOL = [
  "Aoki", "Bose", "Chen", "Diaz", "Eze", "Ferreira", "Gupta", "Hassan",
  "Iyer", "Jung", "Kim", "Lopez", "Mehta", "Nair", "Okafor", "Patel",
  "Quinn", "Reyes", "Singh", "Tanaka", "Uddin", "Vega", "Wong", "Xu", "Yamada", "Zhao",
];
const CITY_POOL = ["Bengaluru", "Singapore", "Berlin", "Lagos", "Lima", "Tokyo", "Mumbai", "Chicago", "Madrid", "Cairo"];
const COUNTRY_POOL = ["IN", "US", "DE", "BR", "JP", "NG", "GB", "FR", "AU", "SG"];
const DEPT_POOL = ["Engineering", "Marketing", "Sales", "Finance", "HR", "Product", "Data", "Ops", "Design"];
const CATEGORY_POOL = ["Electronics", "Books", "Apparel", "Home", "Toys", "Sports", "Beauty", "Grocery"];
const STATUS_POOL = ["pending", "active", "inactive", "completed", "cancelled", "shipped", "failed", "up", "down"];
const PLATFORM_POOL = ["ios", "android", "web", "macos", "windows"];
const CHANNEL_POOL = ["organic", "paid", "email", "referral", "social"];
const METHOD_POOL = ["card", "cash", "wire", "ach", "wallet"];
const REGION_POOL = ["NA", "EMEA", "APAC", "LATAM"];
const PAGE_POOL = ["home", "search", "product", "cart", "checkout", "account"];

const TYPE_RULES = [
  // [test(colname) -> type], ordered specific → general
  { test: (c) => /(^|_)id$/.test(c), type: "INTEGER", role: "id" },
  { test: (c) => /(^|_)is_/.test(c), type: "INTEGER", role: "boolean" },
  { test: (c) => /^(start|end|hire|signup|birth|order|purchase|posted|updated|created|delivered|completed|paid|received|effective|expiry|action|metric|due)_(date|on)$/.test(c) || /_date$/.test(c) || c === "ds" || c === "date" || c === "dob" || c === "month" || c === "week_start", type: "TEXT", role: "date" },
  // watch_time / watch_minutes / watched_seconds etc. are minute/second
  // COUNTS, not timestamps — must beat the generic _time$ datetime rule.
  { test: (c) => /^(watch_time|watch_minutes|watched_seconds|rebuf_seconds|rebuf_count|watch_seconds|duration_sec)$/.test(c), type: "INTEGER", role: "count" },
  { test: (c) => /(_at|_ts|_time)$/.test(c) || c === "timestamp", type: "TEXT", role: "datetime" },
  { test: (c) => /(amount|price|total|revenue|salary|bonus|cost|budget|spend|spent|weight|score|rate|value|profit|gmv|gross|net|fee|tax|discount|balance|due_amount|paid_amount|cogs|avg_|target|quota|goal|forecast|commission|payout)/.test(c), type: "REAL", role: "money" },
  { test: (c) => /(qty|quantity|count|views|likes|comments|clicks|impressions|sessions|wau|dau|mau|days|seconds|minutes|hours|capacity|tickets_sold|delay_minutes|on_hand|new_subs|cancelled_subs|action_count|duration_sec|episodes_watched|user_continued)/.test(c), type: "INTEGER", role: "count" },
  { test: (c) => /^age$/.test(c), type: "INTEGER", role: "age" },
  { test: (c) => /^email/.test(c), type: "TEXT", role: "email" },
  { test: (c) => /^phone/.test(c), type: "TEXT", role: "phone" },
  { test: (c) => /(^|_)country/.test(c), type: "TEXT", role: "country" },
  { test: (c) => /(^|_)city/.test(c), type: "TEXT", role: "city" },
  { test: (c) => /(^|_)region/.test(c), type: "TEXT", role: "region" },
  { test: (c) => /(^|_)category|^classification$/.test(c), type: "TEXT", role: "category" },
  { test: (c) => /(^|_)status/.test(c), type: "TEXT", role: "status" },
  { test: (c) => /(^|_)platform/.test(c), type: "TEXT", role: "platform" },
  { test: (c) => /(^|_)channel/.test(c), type: "TEXT", role: "channel" },
  { test: (c) => /(^|_)method/.test(c), type: "TEXT", role: "method" },
  { test: (c) => /(^|_)page/.test(c), type: "TEXT", role: "page" },
  { test: (c) => /(^|_)dept(_name)?$/.test(c) || /(^|_)department/.test(c), type: "TEXT", role: "department" },
  { test: (c) => /(first_name|last_name|full_name|customer_name|product_name|emp_name|name|title|description|content|gender|currency|sector|level|job_title|manufacturer|tier|plan|action|event_type|txn_type|attribute_json)/.test(c), type: "TEXT", role: "text" },
];

function inferRole(col) {
  for (const r of TYPE_RULES) if (r.test(col)) return r;
  return { type: "TEXT", role: "text" };
}

function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
function intBetween(rng, lo, hi) { return Math.floor(rng() * (hi - lo + 1)) + lo; }
function moneyBetween(rng, lo, hi) { return Math.round((rng() * (hi - lo) + lo) * 100) / 100; }
// Deterministic date schedule that produces:
//   - runs of 3-5 consecutive days (so streak queries fire)
//   - mid-range gaps of ~5-15 days (so gap queries fire)
//   - longer jumps every ~5 chunks (so cohort/launch queries see weeks)
// Input: 1-indexed row/cluster i. Output: day offset from baseDate.
function dateScheduleOffset(i) {
  // Group i into "weeks" of 5 rows. Within a week, dates increment 1 day.
  // Between weeks, jump 4 days (so 3-5-day runs followed by short gaps).
  const week = Math.floor((i - 1) / 5);
  const day = (i - 1) % 5;
  // Periodic long jumps every 5 weeks
  const longJumpEvery = 5;
  const longJumps = Math.floor(week / longJumpEvery);
  return week * 5 + day + longJumps * 10;  // ~50 days span over 25-60 rows
}

function dateOffset(baseDate, days) {
  const d = new Date(baseDate.getTime() + days * 86400000);
  return d.toISOString().slice(0, 10);
}
function datetimeOffset(baseDate, secs) {
  const d = new Date(baseDate.getTime() + secs * 1000);
  return d.toISOString().slice(0, 19).replace("T", " ");
}

// Returns the "owning" table for an FK column like customer_id → customers
// Looks for a table whose name matches the singular root.
function findOwningTable(spec, col) {
  const m = col.match(/^(.+)_id$/);
  if (!m) return null;
  const root = m[1];
  const candidates = [root + "s", root, root + "es"];
  for (const t of spec) {
    if (candidates.includes(t.table)) return t.table;
  }
  return null;
}

// Heuristic: tables that look like "events / facts" (lots of writes, joined
// to a small dim) need denser data for binge / streak / cohort queries to
// surface meaningful patterns. Detected by naming convention.
function isEventTable(table) {
  const t = (table || "").toLowerCase();
  return /^fact_|_history$|_events$|_log$|_logs$|_plays$|_views$|_visits$|_clicks$|_sessions$|_activity$|_filings$|_streams$|_touches$|_records$|^plays$|^viewership$|^messages$|^orders$|^transactions$|^payments$|^searches$|^calls$|^bookings$|^shifts$|^filings$|^returns$|^touches$|^streams$|^events$|^logs$|^sessions$|^activity$|^user_views$|^user_activity$|^scores$/.test(t);
}

// Generate one table's rows.
function generateRows({ table, columns }, spec, rng, ownedIdMap, opts = {}) {
  // 25 rows for dim-style tables; 60 for event/fact tables so streak, gap,
  // binge, cohort and sliding-window queries actually fire.
  const isEvent = isEventTable(table);
  const N = opts.rows || (isEvent ? 60 : 25);
  const baseDate = new Date(Date.UTC(2024, 0, 1));
  const rows = [];
  // Cluster only when the table has MULTIPLE grouping-FK columns
  // (e.g. user_id + series_id) AND a date — that's the "binge" shape.
  // Single-FK event tables (user_views, user_activity) need varying
  // dates so streak / gap queries surface consecutive-day patterns.
  const GROUPING_FK_NAMES = new Set([
    "user_id","customer_id","account_id","profile_id","series_id","show_id",
    "title_id","content_id","channel_id","region_id","country_id","employee_id",
    "manager_id","supervisor_id","parent_id","dept_id","department_id",
    "team_id","product_id","merchant_id","store_id","company_id","ad_id",
    "session_id","room_id","device_id","isp_id",
  ]);
  const groupingFkCount = columns.filter((c) => GROUPING_FK_NAMES.has(c)).length;
  // Three modes:
  //   "binge"  — multi-FK event tables. Cluster shares EVERYTHING (FKs + date)
  //              within a cluster. Demos binge / aggregate-per-cell queries.
  //   "streak" — single-FK event tables (user_views, user_activity, filings).
  //              Cluster shares the FK but date INCREMENTS row-by-row, so 5
  //              consecutive days per user → streak / gap queries fire.
  //   "none"   — dim tables. No clustering.
  let MODE = "none";
  if (isEvent && groupingFkCount >= 2) MODE = "binge";
  else if (isEvent && groupingFkCount === 1) MODE = "streak";
  const CLUSTER_SIZE = (MODE === "binge" || MODE === "streak") ? 5 : 1;

  // Resolve column metadata up-front.
  // Own-PK detection: prefer (a) table-derived names (user_id for `users`,
  // emp_id for `employees`), then (b) bare "id", then (c) the first id-shaped
  // column that ISN'T a well-known grouping FK (so user_id in a fact table
  // doesn't get mistaken for the PK).
  const GROUPING_FK_NAMES = new Set([
    "user_id","customer_id","account_id","profile_id","series_id","show_id",
    "title_id","content_id","channel_id","region_id","country_id","employee_id",
    "manager_id","supervisor_id","parent_id","dept_id","department_id",
    "team_id","product_id","merchant_id","store_id","company_id","ad_id",
    "session_id","room_id","device_id","isp_id",
  ]);
  const tableSingular = table.replace(/s$/, "");
  const tableAbbrevs = [
    `${table}_id`, `${tableSingular}_id`,
    // common abbreviations
    table === "employees" ? "emp_id" : null,
    table === "departments" ? "dept_id" : null,
    table === "products" ? "prod_id" : null,
    table === "customers" ? "cust_id" : null,
    table === "transactions" ? "txn_id" : null,
  ].filter(Boolean);
  let detectedPk = columns.find((c) => tableAbbrevs.includes(c) || c === "id");
  if (!detectedPk) {
    detectedPk = columns.find(
      (c) => (/(^|_)id$/.test(c) || /^[a-z]+_id$/.test(c)) && !GROUPING_FK_NAMES.has(c)
    );
  }
  const colMeta = columns.map((c) => {
    const role = inferRole(c);
    const isOwnPk = c === detectedPk;
    const fkTo = (role.role === "id" && !isOwnPk) ? findOwningTable(spec, c) : null;
    return { name: c, ...role, fkTo, isOwnPk };
  });

  // Which *_id columns should cluster-share (grouping FKs) vs be unique per row.
  const GROUPING_FK = new Set([
    "user_id", "customer_id", "account_id", "profile_id", "series_id",
    "show_id", "title_id", "content_id", "channel_id", "region_id",
    "country_id", "employee_id", "emp_id", "manager_id", "supervisor_id",
    "parent_id", "dept_id", "department_id", "team_id", "product_id",
    "merchant_id", "store_id", "company_id", "ad_id", "session_id",
    "room_id", "device_id", "isp_id",
  ]);
  // Detect interval-style tables (shifts, bookings, streams) so end_*
  // ends up AFTER the corresponding start_*.
  const startCols = colMeta.filter((m) => /^(start|started)_(at|ts|dt|time)$/.test(m.name));
  const endCols   = colMeta.filter((m) => /^(end|ended)_(at|ts|dt|time)$/.test(m.name));
  const isInterval = startCols.length > 0 && endCols.length > 0;
  for (let i = 1; i <= N; i++) {
    const row = {};
    // clusterStart = 1-indexed cluster INDEX (not row index of cluster start).
    // This way cluster 0 → seed 1 → FK pool slot 1; cluster 1 → seed 2 →
    // FK pool slot 2 — different cluster ⇒ different FK value, despite
    // pool size matching cluster size.
    const clusterStart = Math.floor((i - 1) / CLUSTER_SIZE) + 1;
    for (const m of colMeta) {
      const isUniqueRow = m.isOwnPk || (m.role === "id" && !GROUPING_FK.has(m.name));
      const isDate = m.role === "date" || m.role === "datetime";
      // streak mode: FK shared in cluster, date varies row-by-row.
      // binge mode: everything (FK + date) shared in cluster.
      let seedI;
      if (MODE === "streak" && isDate) {
        // Date follows i directly so we get 5 consecutive days per user.
        seedI = i;
      } else if ((MODE === "binge" || MODE === "streak") && !isUniqueRow) {
        seedI = clusterStart;
      } else {
        seedI = i;
      }
      row[m.name] = generateCell(m, seedI, table, baseDate, rng, ownedIdMap);
    }
    // Force end_* > start_* on interval tables: end = start + 1-3 hours.
    if (isInterval) {
      for (const sm of startCols) {
        const startVal = row[sm.name];
        if (!startVal) continue;
        const startTime = new Date(startVal).getTime();
        // Pair this start with the same-suffix end column when possible
        const suffix = sm.name.replace(/^(start|started)_/, "");
        const endName = "end_" + suffix in row ? "end_" + suffix : (
          "ended_" + suffix in row ? "ended_" + suffix : (endCols[0] && endCols[0].name)
        );
        if (endName && endName in row) {
          // Random 30-180 minutes after start; deterministic from i.
          const minutes = 30 + ((i * 47) % 150);
          const endVal = new Date(startTime + minutes * 60000);
          row[endName] = endVal.toISOString().slice(0, 19).replace("T", " ");
        }
      }
    }
    rows.push(row);
  }
  // Track owned IDs (PK of this table) for FK reuse
  const pkCol = colMeta.find(
    (m) => m.role === "id" && (m.name === "id" || m.name === `${table}_id` || m.name === `${table.replace(/s$/, "")}_id`)
  );
  if (pkCol) ownedIdMap[table] = rows.map((r) => r[pkCol.name]);

  return { rows, colMeta };
}

function generateCell(meta, i, tableName, baseDate, rng, ownedIdMap) {
  const c = meta.name;
  switch (meta.role) {
    case "id":
      if (meta.fkTo && ownedIdMap[meta.fkTo]) {
        const ids = ownedIdMap[meta.fkTo];
        return ids[(i - 1) % ids.length];
      }
      // FK-shaped column (e.g. customer_id, product_id) without an explicit
      // owning table in the schema. Cycle through a small pool of values so
      // queries that depend on repeated foreign keys (group-by-customer,
      // new-vs-returning, multi-row patterns) actually have repeated keys to
      // group on. Without this, every row had a unique value and questions
      // like "find customers with multiple orders" returned zero rows.
      const isOwnPk = meta.isOwnPk || (
        c === `${tableName.replace(/s$/, "")}_id` ||
        c === `${tableName}_id` ||
        c === "id"
      );
      if (!isOwnPk) {
        // Hierarchy-FK columns (manager_id, supervisor_id, parent_id) need
        // a top-of-hierarchy row with NULL anchor — and must point STRICTLY
        // EARLIER than the current row, otherwise the recursive CTE cycles.
        if (/^(manager|supervisor|parent|reports_to)_id$/.test(c)) {
          if (i === 1) return null;
          // Point to an earlier row to keep the tree acyclic.
          return Math.max(1, Math.floor((i - 1) / 3));
        }
        // 5 distinct values cycling — produces a realistic mix of cardinality
        // (~25 rows / 5 keys = avg ~5 rows per key, with some 1-of-a-kind).
        return ((i - 1) % 5) + 1;
      }
      return i;
    case "boolean": return rng() < 0.5 ? 0 : 1;
    // Date / datetime are derived deterministically from `i` so cluster
    // members share a date. The schedule is designed to produce some
    // consecutive-day RUNS (so streak queries fire) interspersed with gaps
    // (so gap queries fire). Pattern: every 5 rows, advance 1-3 days; every
    // 25 rows, jump ahead 10-20 days. Net: ~12 distinct dates over ~50 days
    // with 3-5-day runs.
    case "date": return dateOffset(baseDate, dateScheduleOffset(i));
    case "datetime": return datetimeOffset(baseDate, dateScheduleOffset(i) * 86400 + (i * 137) % 86400);
    case "money": return moneyBetween(rng, 10, 1000);
    case "count": return intBetween(rng, 1, 500);
    case "age": return intBetween(rng, 18, 75);
    case "email": {
      // Cycle through a small pool so duplicate-detection / dedup-self-join
      // questions actually find matching rows. With i % 8 across 25 rows you
      // get ~3 collisions on average — enough to demo the pattern.
      const idx = (i - 1) % 8;
      const name = NAME_POOL[idx % NAME_POOL.length].toLowerCase();
      return `${name}${idx}@example.com`;
    }
    case "phone": return `+1-${intBetween(rng, 200, 999)}-${String(intBetween(rng, 1000, 9999)).padStart(4, "0")}`;
    case "country": return pick(rng, COUNTRY_POOL);
    case "city": return pick(rng, CITY_POOL);
    case "region": return pick(rng, REGION_POOL);
    case "category": return pick(rng, CATEGORY_POOL);
    case "status": return pick(rng, STATUS_POOL);
    case "platform": return pick(rng, PLATFORM_POOL);
    case "channel": return pick(rng, CHANNEL_POOL);
    case "method": return pick(rng, METHOD_POOL);
    case "page": return pick(rng, PAGE_POOL);
    case "department": return pick(rng, DEPT_POOL);
    case "text":
      if (c === "first_name") return pick(rng, NAME_POOL);
      if (c === "last_name") return pick(rng, SURNAME_POOL);
      if (c.endsWith("_name") || c === "name" || c === "full_name" || c === "customer_name" || c === "product_name") {
        return `${pick(rng, NAME_POOL)} ${pick(rng, SURNAME_POOL)}`;
      }
      // Limit `title` cardinality so duplicate-listing detection has matches
      // without forcing every row to share a title.
      if (c === "title") return `Item ${((i - 1) % 8) + 1}`;
      if (c === "description" || c === "content") return `Sample ${tableName} content #${((i - 1) % 8) + 1}`;
      // SKU-style columns the playground sees in LIKE pattern questions.
      if (c === "sku") {
        const buckets = [`PROMO-${i}`, `STD-${i}`, `LTD-${i}-2025`, `CLEAR-${i}`, `BUNDLE-${i}-2024`];
        return buckets[(i - 1) % buckets.length];
      }
      if (c === "ticker") {
        const tickers = ["META", "AAPL", "AMZN", "NFLX", "GOOG", "MSFT", "TSLA"];
        return tickers[(i - 1) % tickers.length];
      }
      if (c === "gender") return pick(rng, ["F", "M", "X"]);
      if (c === "currency") return pick(rng, ["USD", "EUR", "INR", "JPY", "GBP"]);
      if (c === "sector") return pick(rng, ["Tech", "Retail", "Health", "Finance", "Energy"]);
      if (c === "level") return pick(rng, ["IC", "Manager", "Senior Manager", "Director", "VP"]);
      if (c === "job_title") return pick(rng, ["Engineer", "Manager", "Analyst", "Designer", "PM", "Director"]);
      if (c === "manufacturer") return pick(rng, ["Acme", "Globex", "Initech", "Umbrella", "Wayne"]);
      if (c === "tier") return pick(rng, ["bronze", "silver", "gold", "platinum"]);
      if (c === "plan") return pick(rng, ["free", "pro", "team", "enterprise"]);
      if (c === "action") return pick(rng, ["click", "view", "purchase", "share", "comment"]);
      if (c === "event_type") return pick(rng, ["signup", "login", "view", "purchase", "logout"]);
      if (c === "txn_type") return pick(rng, ["debit", "credit", "transfer", "refund"]);
      if (c === "attribute_json") return JSON.stringify({ size: pick(rng, ["S", "M", "L"]), color: pick(rng, ["red", "blue", "green"]) });
      return `${c}_${i}`;
    default:
      return `${c}_${i}`;
  }
}

function quoteIdent(name) { return '"' + String(name).replace(/"/g, '""') + '"'; }

/**
 * Create SQLite tables for the given spec on the provided sql.js Database.
 * @param {Database} db sql.js Database instance
 * @param {Array<{table:string, columns:string[]}>} spec
 * @param {object} opts { seed?: number, rowsPerTable?: number, drop?: boolean }
 * @returns {{table:string, rows:number, cols:Array}[]} summary
 */
export function generateAndLoad(db, spec, opts = {}) {
  const seed = opts.seed ?? 42;
  const rng = mulberry32(seed);
  const ownedIdMap = {};
  const summary = [];

  // First pass: tables that look like dimensions (have own PK only) before fact tables
  const ordered = [...spec].sort((a, b) => {
    const aIsFK = a.columns.some((c) => /(^|_)id$/.test(c) && c !== "id" && c !== `${a.table}_id` && c !== `${a.table.replace(/s$/, "")}_id`);
    const bIsFK = b.columns.some((c) => /(^|_)id$/.test(c) && c !== "id" && c !== `${b.table}_id` && c !== `${b.table.replace(/s$/, "")}_id`);
    return Number(aIsFK) - Number(bIsFK);
  });

  for (const t of ordered) {
    const { rows, colMeta } = generateRows(t, ordered, rng, ownedIdMap, { rows: opts.rowsPerTable || 12 });
    const colDefs = colMeta.map((m) => `${quoteIdent(m.name)} ${m.type}`).join(", ");
    if (opts.drop !== false) db.run(`DROP TABLE IF EXISTS ${quoteIdent(t.table)};`);
    db.run(`CREATE TABLE IF NOT EXISTS ${quoteIdent(t.table)} (${colDefs});`);
    const placeholders = colMeta.map(() => "?").join(",");
    const stmt = db.prepare(`INSERT INTO ${quoteIdent(t.table)} VALUES (${placeholders})`);
    db.exec("BEGIN");
    try {
      for (const r of rows) stmt.run(colMeta.map((m) => r[m.name]));
      db.exec("COMMIT");
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    } finally {
      stmt.free();
    }
    summary.push({ table: t.table, rows: rows.length, cols: colMeta.map((m) => `${m.name}:${m.type}`) });
  }
  return summary;
}

// Stable seed from a question id like "co_sql_305-0042"
export function seedFromQid(qid) {
  let h = 0;
  for (let i = 0; i < qid.length; i++) h = ((h << 5) - h + qid.charCodeAt(i)) | 0;
  return Math.abs(h) || 1;
}
