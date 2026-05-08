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
  { test: (c) => /(_at|_ts|_time)$/.test(c) || c === "timestamp", type: "TEXT", role: "datetime" },
  { test: (c) => /(amount|price|total|revenue|salary|bonus|cost|budget|spend|spent|weight|score|rate|value|profit|gmv|gross|net|fee|tax|discount|balance|due_amount|paid_amount|cogs|avg_|target|quota|goal|forecast|commission|payout)/.test(c), type: "REAL", role: "money" },
  { test: (c) => /(qty|quantity|count|views|likes|comments|clicks|impressions|sessions|wau|dau|mau|days|seconds|minutes|hours|capacity|tickets_sold|delay_minutes|on_hand|new_subs|cancelled_subs|action_count|duration_sec)/.test(c), type: "INTEGER", role: "count" },
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

// Generate one table's rows.
function generateRows({ table, columns }, spec, rng, ownedIdMap, opts = {}) {
  // 25 rows over a 60-day date range produces useful clustering for streak,
  // gap, binge, cohort and sliding-window questions while staying compact
  // enough for visual demo. Tighten the date span (was 180) so multiple rows
  // land on the same calendar day for the same FK partition.
  const N = opts.rows || 25;
  const baseDate = new Date(Date.UTC(2024, 0, 1));
  const rows = [];

  // Resolve column metadata up-front
  const colMeta = columns.map((c) => {
    const role = inferRole(c);
    let fkTo = null;
    if (role.role === "id" && c !== `${table.replace(/s$/, "")}_id` && c !== `${table}_id` && c !== "id") {
      fkTo = findOwningTable(spec, c);
    }
    return { name: c, ...role, fkTo };
  });

  for (let i = 1; i <= N; i++) {
    const row = {};
    for (const m of colMeta) {
      row[m.name] = generateCell(m, i, table, baseDate, rng, ownedIdMap);
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
      const isOwnPk = (
        c === `${tableName.replace(/s$/, "")}_id` ||
        c === `${tableName}_id` ||
        c === "id"
      );
      if (!isOwnPk) {
        // 5 distinct values cycling — produces a realistic mix of cardinality
        // (~12 rows / 5 keys = avg ~2.4 rows per key, with some 1-of-a-kind).
        return ((i - 1) % 5) + 1;
      }
      return i;
    case "boolean": return rng() < 0.5 ? 0 : 1;
    case "date": return dateOffset(baseDate, intBetween(rng, 0, 60));
    case "datetime": return datetimeOffset(baseDate, intBetween(rng, 0, 60 * 86400));
    case "money": return moneyBetween(rng, 10, 1000);
    case "count": return intBetween(rng, 1, 500);
    case "age": return intBetween(rng, 18, 75);
    case "email": {
      const n = pick(rng, NAME_POOL).toLowerCase() + i;
      return `${n}@example.com`;
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
      if (c === "title") return `Item ${i}`;
      if (c === "description" || c === "content") return `Sample ${tableName} content #${i}`;
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
