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
// Forward-progression lifecycle for status-log tables. Emits the SAME status
// twice in a row inside each cluster so the canonical
//   `WHERE status != prev_status OR prev_status IS NULL` dedup logic
// has consecutive duplicates to collapse — that's the point of the
// gaps-and-islands question. Last status of each cluster is the terminal
// state (Delivered), so the LEAD-based end_date NULL lands on it.
const LIFECYCLE_POOL = ["Pending", "Shipped", "Delivered", "Cancelled"];
const LIFECYCLE_PATTERN_5 = [0, 0, 1, 1, 2]; // P, P, S, S, D for 5-row clusters
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

// Multi-streak pattern for a user: 4 streaks of 4-6 days separated by gaps
// designed to exercise gap-classification SQL branches. Cumulative offsets:
//   rows 0-4   (streak 1, 5 days):       day 0 .. 4
//   rows 5-9   (gap 12d → 'continuing'): day 17 .. 21
//   rows 10-13 (gap 40d → 'resurrected'): day 62 .. 65
//   rows 14-19 (gap 95d → 'long_resurrect' / 'churned'): day 161 .. 166
// Total: 20 rows over 167 days per user. Useful for:
//   • streak detection (multiple distinct streaks per user)
//   • gap-bucket CASE WHEN (≤28, ≤90, >90)
//   • cohort retention (rows span multiple weeks/months)
//   • churned / open / resurrected exit-status queries
const MULTI_STREAK_PATTERN = [
  { offset: 0,   length: 5 },
  { offset: 17,  length: 5 },
  { offset: 62,  length: 4 },
  { offset: 161, length: 6 },
];
function multiStreakDayOffset(rowInUser /* 0-based */) {
  let acc = 0;
  for (const s of MULTI_STREAK_PATTERN) {
    if (rowInUser < acc + s.length) return s.offset + (rowInUser - acc);
    acc += s.length;
  }
  // Fallback for rowInUser >= 20 — extra rows tack on after the last streak
  return MULTI_STREAK_PATTERN[MULTI_STREAK_PATTERN.length - 1].offset
    + MULTI_STREAK_PATTERN[MULTI_STREAK_PATTERN.length - 1].length
    + (rowInUser - 20) * 5;
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
  // Per-question hint: columns the solution PARTITIONs or GROUPs by. When
  // such a column is present in this table we treat it as a grouping FK
  // (rows REPEAT it) instead of a PK, so window functions like
  // LAG/LEAD OVER (PARTITION BY ...) actually have something to look at.
  const hintPartition = new Set(
    (opts.partitionCols || []).map((c) => String(c).toLowerCase())
  );
  // Same idea for the ORDER BY column inside windows — if the solution
  // orders a window by `order_date`, the synthetic data should ensure that
  // column varies monotonically within each cluster, not random jumps.
  const hintWindowOrder = new Set(
    (opts.windowOrderCols || []).map((c) => String(c).toLowerCase())
  );
  // Per-column literal pool from the solution's `WHERE col='X'` /
  // `col IN ('a','b')` patterns. When set, generateCell prefers these
  // values over the built-in defaults so pivot CASE branches fire.
  const categoryHints = {};
  for (const [k, v] of Object.entries(opts.categoryHints || {})) {
    categoryHints[String(k).toLowerCase()] = Array.isArray(v) ? v : [...v];
  }

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
  // Hints are additive — any partition column the solution declared becomes
  // a grouping FK for this table, even if it'd normally be the PK.
  for (const c of hintPartition) GROUPING_FK_NAMES.add(c);
  const groupingFkCount = columns.filter((c) => GROUPING_FK_NAMES.has(c.toLowerCase())).length;
  // Three modes:
  //   "binge"  — multi-FK event tables. Cluster shares EVERYTHING (FKs + date)
  //              within a cluster. Demos binge / aggregate-per-cell queries.
  //   "streak" — single-FK event tables (user_views, user_activity, filings).
  //              Cluster shares the FK but date INCREMENTS row-by-row, so 5
  //              consecutive days per user → streak / gap queries fire.
  //   "none"   — dim tables. No clustering.
  let MODE = "none";
  // Hint-driven partitioning ALWAYS wins — when the solution explicitly
  // partitions by a column the data has, we must cluster on it regardless
  // of whether the table looks like a "fact" by name.
  if (hintPartition.size > 0 && groupingFkCount >= 1) {
    MODE = groupingFkCount >= 2 ? "binge" : "streak";
  } else if (isEvent && groupingFkCount >= 2) MODE = "binge";
  // In streak mode, switch to a wider per-user date pattern (4 streaks
  // separated by gaps of 12 / 40 / 95 days) so the canonical
  //   CASE WHEN gap_days ≤ 28 → 'continuing'
  //   CASE WHEN gap_days ≤ 90 → 'resurrected'
  //   ELSE 'long_resurrect' / 'churned'
  // questions actually exercise every branch instead of producing one
  // monolithic 5-day streak per user. Triggered when:
  //   (a) we're in streak mode AND
  //   (b) the table has enough rows for the pattern (≥ 12)
  // and forces user_id to cycle slowly (3-4 distinct users per N rows).
  else if (isEvent && groupingFkCount === 1) MODE = "streak";
  // Multi-streak: each user gets ROWS_PER_USER rows distributed across
  // 4 sub-streaks. Drops user count to N/ROWS_PER_USER (≈3 users for
  // N=60) but each user demonstrates streak detection + multiple gap
  // buckets. CLUSTER_SIZE in this mode = ROWS_PER_USER (each "cluster"
  // = one user's full history) so user_id sharing logic still works.
  const USE_MULTI_STREAK = MODE === "streak" && N >= 12;
  const ROWS_PER_USER = USE_MULTI_STREAK ? Math.min(20, N) : 5;
  const CLUSTER_SIZE = USE_MULTI_STREAK
    ? ROWS_PER_USER
    : ((MODE === "binge" || MODE === "streak") ? 5 : 1);

  // Resolve column metadata up-front.
  // Own-PK detection: prefer (a) table-derived names (user_id for `users`,
  // emp_id for `employees`), then (b) bare "id", then (c) the first id-shaped
  // column that ISN'T a well-known grouping FK (so user_id in a fact table
  // doesn't get mistaken for the PK).
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
  let detectedPk = columns.find(
    (c) => (tableAbbrevs.includes(c) || c === "id") && !hintPartition.has(c.toLowerCase())
  );
  if (!detectedPk) {
    detectedPk = columns.find(
      (c) => (/(^|_)id$/.test(c) || /^[a-z]+_id$/.test(c))
        && !GROUPING_FK_NAMES.has(c.toLowerCase())
        && !hintPartition.has(c.toLowerCase())
    );
  }
  const colMeta = columns.map((c) => {
    const role = inferRole(c);
    const isHintPartition = hintPartition.has(c.toLowerCase());
    const isHintWindowOrder = hintWindowOrder.has(c.toLowerCase());
    const isOwnPk = c === detectedPk && !isHintPartition;
    const fkTo = (role.role === "id" && !isOwnPk) ? findOwningTable(spec, c) : null;
    const literalPool = categoryHints[c.toLowerCase()] || null;
    return { name: c, ...role, fkTo, isOwnPk, isHintPartition, isHintWindowOrder, literalPool };
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
  // Hint partition columns are also grouping FKs so the per-row generator
  // shares them across the cluster instead of inventing unique values.
  for (const c of hintPartition) GROUPING_FK.add(c);
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
      const isHintPart = m.isHintPartition;
      const isUniqueRow = m.isOwnPk
        || (m.role === "id" && !GROUPING_FK.has(m.name) && !isHintPart);
      const isDate = m.role === "date" || m.role === "datetime";
      // streak mode: FK shared in cluster, date varies row-by-row.
      // binge mode: everything (FK + date) shared in cluster.
      // Hint-driven: hint partition cols cluster-share regardless of name.
      let seedI;
      if (MODE === "streak" && (isDate || m.isHintWindowOrder)) {
        // Date follows i directly so we get consecutive days per user.
        seedI = i;
      } else if ((MODE === "binge" || MODE === "streak") && !isUniqueRow) {
        seedI = clusterStart;
      } else {
        seedI = i;
      }
      // Multi-streak override for date columns: instead of monotonically
      // walking forward across all rows, each user (cluster) traces the
      // same MULTI_STREAK_PATTERN over 167 days — so streaks 1..4 within
      // a single user produce gap_days of {12, 40, 95}.
      if (USE_MULTI_STREAK && isDate) {
        const rowInUser = (i - 1) % ROWS_PER_USER;
        const dayOffset = multiStreakDayOffset(rowInUser);
        if (m.role === "date") {
          row[m.name] = dateOffset(baseDate, dayOffset);
        } else {
          // datetime — keep a deterministic seconds offset for variety
          row[m.name] = datetimeOffset(baseDate, dayOffset * 86400 + (i * 137) % 86400);
        }
      } else {
        row[m.name] = generateCell(m, seedI, table, baseDate, rng, ownedIdMap);
      }
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
  // Status-log post-process: when the solution PARTITIONs by an id column
  // on this table AND we have a `status` column without a user-supplied
  // literal pool, force a forward lifecycle (Pending → Shipped → Delivered)
  // within each cluster. This is the missing piece that made co_sql_305-0439
  // produce semantically wrong end_date NULLs — the terminal Delivered
  // status should be the open-ended row, not whatever status fell last in
  // a random cycle.
  if (CLUSTER_SIZE > 1 && hintPartition.size > 0) {
    const statusCol = colMeta.find(
      (m) => m.role === "status" && !(m.literalPool && m.literalPool.length)
    );
    if (statusCol) {
      const pattern = (CLUSTER_SIZE === 5)
        ? LIFECYCLE_PATTERN_5
        : Array.from({ length: CLUSTER_SIZE }, (_, k) =>
            Math.min(k * (LIFECYCLE_POOL.length - 1) / (CLUSTER_SIZE - 1) | 0, LIFECYCLE_POOL.length - 2));
      for (let i = 0; i < rows.length; i++) {
        const posInCluster = i % CLUSTER_SIZE;
        const idx = pattern[posInCluster] ?? 0;
        rows[i][statusCol.name] = LIFECYCLE_POOL[idx];
      }
    }
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
  // Solution-derived literal pool wins over the role's default pool — so
  // `WHERE region='North'` queries against a region column actually find
  // a 'North' row instead of the generic 'NA','EMEA' built-ins. We only
  // do this for non-id, non-numeric roles where a literal substitution
  // makes sense. Cycle through the literals so multiple distinct values
  // land in the data.
  if (meta.literalPool && meta.literalPool.length &&
      !["id","date","datetime","money","count","boolean","age"].includes(meta.role)) {
    return meta.literalPool[(i - 1) % meta.literalPool.length];
  }
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
      // Hint-driven exception: when the question's solution PARTITIONs by
      // this column (e.g. `LEAD(...) OVER (PARTITION BY order_id ...)`),
      // we DELIBERATELY treat it as repeating, even if it'd normally be the
      // table's PK. Otherwise window functions have nothing to look at.
      const isOwnPk = !meta.isHintPartition && (meta.isOwnPk || (
        c === `${tableName.replace(/s$/, "")}_id` ||
        c === `${tableName}_id` ||
        c === "id"
      ));
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
 * Plan rows for a spec without loading them into any engine. Returns the
 * shared shape both the SQLite (sql.js, sync) and Postgres (pglite, async)
 * loaders consume.
 * @param {Array<{table:string, columns:string[]}>} spec
 * @param {object} opts { seed?: number, rowsPerTable?: number }
 * @returns {{table:string, colMeta:Array, rows:object[]}[]}
 */
export function planRowsForSpec(spec, opts = {}) {
  const seed = opts.seed ?? 42;
  const rng = mulberry32(seed);
  const ownedIdMap = {};

  // First pass: dim-style tables (own PK only) before fact tables, so FKs
  // resolve cleanly when generateRows reaches the fact table.
  const ordered = [...spec].sort((a, b) => {
    const aIsFK = a.columns.some((c) => /(^|_)id$/.test(c) && c !== "id" && c !== `${a.table}_id` && c !== `${a.table.replace(/s$/, "")}_id`);
    const bIsFK = b.columns.some((c) => /(^|_)id$/.test(c) && c !== "id" && c !== `${b.table}_id` && c !== `${b.table.replace(/s$/, "")}_id`);
    return Number(aIsFK) - Number(bIsFK);
  });

  const out = [];
  for (const t of ordered) {
    const { rows, colMeta } = generateRows(t, ordered, rng, ownedIdMap, {
      // Don't default to 12 here — let generateRows pick the right N
      // (25 dim / 60 event) so streak / multi-streak / cohort questions
      // get enough rows to exercise their CASE WHEN gap branches.
      rows: opts.rowsPerTable,
      partitionCols: opts.partitionCols,
      windowOrderCols: opts.windowOrderCols,
      categoryHints: opts.categoryHints,
    });
    out.push({ table: t.table, colMeta, rows });
  }
  return out;
}

/**
 * Create SQLite tables for the given spec on the provided sql.js Database.
 * @param {Database} db sql.js Database instance
 * @param {Array<{table:string, columns:string[]}>} spec
 * @param {object} opts { seed?: number, rowsPerTable?: number, drop?: boolean }
 * @returns {{table:string, rows:number, cols:Array}[]} summary
 */
export function generateAndLoad(db, spec, opts = {}) {
  const plan = planRowsForSpec(spec, opts);
  const summary = [];
  for (const { table, colMeta, rows } of plan) {
    const colDefs = colMeta.map((m) => `${quoteIdent(m.name)} ${m.type}`).join(", ");
    if (opts.drop !== false) db.run(`DROP TABLE IF EXISTS ${quoteIdent(table)};`);
    db.run(`CREATE TABLE IF NOT EXISTS ${quoteIdent(table)} (${colDefs});`);
    const placeholders = colMeta.map(() => "?").join(",");
    const stmt = db.prepare(`INSERT INTO ${quoteIdent(table)} VALUES (${placeholders})`);
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
    summary.push({ table, rows: rows.length, cols: colMeta.map((m) => `${m.name}:${m.type}`) });
  }
  return summary;
}

// Map a sample-gen colMeta entry to a Postgres-friendly type. SQLite gets
// INTEGER/REAL/TEXT for everything, but Postgres needs DATE/TIMESTAMP for
// DATE_TRUNC / EXTRACT / interval arithmetic to work on the synthetic data.
export function pgTypeFor(meta) {
  if (meta.role === "date") return "DATE";
  if (meta.role === "datetime") return "TIMESTAMP";
  if (meta.role === "money") return "NUMERIC(12,2)";
  if (meta.type === "INTEGER") return "INTEGER";
  if (meta.type === "REAL") return "DOUBLE PRECISION";
  return "TEXT";
}

// Stable seed from a question id like "co_sql_305-0042"
export function seedFromQid(qid) {
  let h = 0;
  for (let i = 0; i < qid.length; i++) h = ((h << 5) - h + qid.charCodeAt(i)) | 0;
  return Math.abs(h) || 1;
}
