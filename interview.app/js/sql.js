// ════════════════════════════════════════════════════════════
// SQL Playground — SQLite (sql.js) by default, PostgreSQL (PGlite) on demand
// ════════════════════════════════════════════════════════════
import { seedFromQid } from "./sample-gen.js";
import { SqliteEngine } from "./engines/sqlite-engine.js";
import { PgliteEngine } from "./engines/pglite-engine.js";

const DATA_BASE = "../interview/data";
const CSV_BASE = "../interview/sample%20dataset";
const QUESTIONS_URL = `${DATA_BASE}/questions.json`;
const SCHEMAS_URL = `${DATA_BASE}/question_schemas.json`;
const LS_LAST_Q = "pg.sql.lastQ";
const LS_RUNTIME = "pg.sql.runtime";  // 'auto' | 'sqlite' | 'postgres'
// Per-question editor key — one slot per question id so switching questions
// no longer leaks the previous question's solution into the editor.
const LS_EDITOR = (qid) => `pg.sql.editor.${qid || "default"}`;

// CSVs we ship in the repo. Names also become table names.
const CSV_FILES = [
  "clickstream.csv",
  "daily_metrics.csv",
  "daily_metrics_gapped.csv",
  "employees.csv",
  "events.csv",
  "logins.csv",
  "orders.csv",
  "product_dim.csv",
  "products.csv",
  "purchases.csv",
  "sessions.csv",
  "skewed_table.csv",
  "user_profiles.csv",
  "users.csv",
  "weekly_metrics.csv",
];

const $ = (sel) => document.querySelector(sel);

const state = {
  engine: null,                // active engine (SqliteEngine | PgliteEngine)
  enginesByKind: {},           // lazily-instantiated cache so switching back is instant
  runtimePref: "auto",         // 'auto' | 'sqlite' | 'postgres' from the toolbar
  questions: [],
  sqlQuestions: [],
  schemasByQid: {},
  currentQ: null,
  loadedTables: new Set(),
  questionCreatedTables: new Set(),  // synthetic tables created for the active question
  lastResult: null,
  autoLoadQuestionTables: true,
  engineReady: false,
};

// Buttons that need the SQL engine before they can do anything useful.
const ENGINE_DEPENDENT_IDS = [
  "pg-run", "pg-reset-db", "pg-load-q-tables",
  "pg-refresh-schema", "pg-csv-load",
];

function setEngineReady(ready) {
  state.engineReady = ready;
  for (const id of ENGINE_DEPENDENT_IDS) {
    const el = document.getElementById(id);
    if (el) el.disabled = !ready;
  }
}

// ─── Status helper ───
function setStatus(msg, kind = "") {
  const el = $("#pg-status");
  if (!el) return;
  el.textContent = msg;
  el.className = "pg-status" + (kind ? " is-" + kind : "");
}

function updateEngineBadge() {
  const el = $("#pg-engine-badge");
  if (!el) return;
  if (!state.engine) {
    el.textContent = "—";
    el.removeAttribute("data-engine");
    return;
  }
  el.textContent = state.engine.kind === "postgres" ? "PostgreSQL" : "SQLite";
  el.setAttribute("data-engine", state.engine.kind);
}

// ─── CSV parser (handles quoted commas + escaped quotes) ───
function parseCSV(text) {
  const rows = [];
  let cur = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") { cur.push(field); field = ""; }
      else if (c === "\n") { cur.push(field); rows.push(cur); cur = []; field = ""; }
      else if (c === "\r") { /* skip */ }
      else field += c;
    }
  }
  if (field.length || cur.length) { cur.push(field); rows.push(cur); }
  return rows.filter((r) => r.length > 1 || (r.length === 1 && r[0] !== ""));
}

// ─── Type inference ───
function inferType(sample) {
  if (sample === "" || sample == null) return null;
  if (/^-?\d+$/.test(sample)) return "INTEGER";
  if (/^-?\d+\.\d+$/.test(sample)) return "REAL";
  return "TEXT";
}
function inferColumnTypes(headers, rows) {
  const types = headers.map(() => null);
  for (const r of rows.slice(0, 100)) {
    for (let i = 0; i < headers.length; i++) {
      const t = inferType(r[i]);
      if (!t) continue;
      if (types[i] === null) types[i] = t;
      else if (types[i] === "INTEGER" && t === "REAL") types[i] = "REAL";
      else if (types[i] !== t) types[i] = "TEXT";
    }
  }
  return types.map((t) => t || "TEXT");
}

function quoteIdent(name) {
  return '"' + String(name).replace(/"/g, '""') + '"';
}

function castValue(value, type) {
  if (value === "" || value == null) return null;
  if (type === "INTEGER") {
    const n = parseInt(value, 10);
    return Number.isNaN(n) ? null : n;
  }
  if (type === "REAL") {
    const n = parseFloat(value);
    return Number.isNaN(n) ? null : n;
  }
  return value;
}

// ─── Load one CSV as a table ───
async function loadCSVAsTable(filename) {
  const url = `${CSV_BASE}/${encodeURIComponent(filename)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not fetch ${filename}: ${res.status}`);
  const text = await res.text();
  const rows = parseCSV(text);
  if (!rows.length) return;
  const headers = rows[0].map((h) => h.trim());
  const data = rows.slice(1);
  const types = inferColumnTypes(headers, data);
  const tableName = filename.replace(/\.csv$/i, "");
  const records = data
    .filter((row) => !(row.length === 1 && row[0] === ""))
    .map((row) => headers.map((_, i) => castValue(row[i], types[i])));
  await state.engine.loadCSV(tableName, headers, types, records);
  state.loadedTables.add(tableName);
}

async function loadAllCSVs() {
  const results = await Promise.allSettled(CSV_FILES.map(loadCSVAsTable));
  const failed = results.filter((r) => r.status === "rejected");
  if (failed.length) {
    console.warn("Some CSVs failed to load:", failed.map((f) => f.reason?.message));
  }
}

// ─── Engine lifecycle ───
// Decide which engine should run a given question. Manual override wins; in
// 'auto' mode looks at the question's runtime tag. The tag was set by the
// dialect-classifier audit which scans each solution for SQLite-only
// markers (julianday, strftime, IIF) vs Postgres-only markers (DATE_TRUNC,
// FILTER WHERE, IS DISTINCT FROM, NULLS LAST, INTERVAL '...', string_agg).
// PostgreSQL is the priority dialect — auto-mode lands on PGlite for
// portable queries; SQLite is reserved for solutions that explicitly
// need julianday/strftime.
function pickEngineKindFor(q) {
  if (state.runtimePref === "sqlite") return "sqlite";
  if (state.runtimePref === "postgres") return "postgres";
  if (q && q.runtime === "sqlite") return "sqlite";
  if (q && q.runtime === "postgres") return "postgres";
  // Untagged: peek at the solution as a final safety net. SQLite-only
  // markers force SQLite; everything else defaults to Postgres.
  if (q && q.solution) {
    if (/\b(julianday|strftime)\s*\(/i.test(q.solution)) return "sqlite";
  }
  return "postgres";
}

// SQLite-specific function tokens — used to refuse to run a SQLite-flavored
// solution on the Postgres engine (and vice versa for the existing Postgres
// detector below). Without this the user sees a confusing
// `function julianday(timestamp without time zone) does not exist` from
// PGlite when they manually picked the wrong engine.
const SQLITE_ONLY_TOKENS = [
  /\bjulianday\s*\(/i,
  /\bstrftime\s*\(/i,
  /\bIIF\s*\(/i,
];

function detectSqliteOnly(sql) {
  const cleaned = stripStringsAndComments(sql);
  for (const re of SQLITE_ONLY_TOKENS) {
    const m = re.exec(cleaned);
    if (m) return m[0];
  }
  return null;
}

async function ensureEngine(kind) {
  if (state.enginesByKind[kind]) return state.enginesByKind[kind];
  if (kind === "postgres") {
    setStatus("Loading PostgreSQL engine (PGlite, ~3 MB)…");
    const eng = new PgliteEngine();
    await eng.init();
    state.enginesByKind[kind] = eng;
    return eng;
  }
  setStatus("Loading SQLite engine (~1 MB WASM)…");
  const eng = new SqliteEngine();
  await eng.init();
  state.enginesByKind[kind] = eng;
  return eng;
}

async function activateEngine(kind, { reseed = true } = {}) {
  const eng = await ensureEngine(kind);
  if (state.engine === eng) return eng;
  state.engine = eng;
  setEngineReady(true);
  updateEngineBadge();
  if (reseed) {
    state.loadedTables.clear();
    state.questionCreatedTables.clear();
    await loadAllCSVs();
    await refreshTableList();
  }
  return eng;
}

async function initEngine() {
  // Boot the SQLite engine eagerly (it's the default for ~90% of questions
  // and the WASM is local), then the Postgres path lights up lazily when a
  // question or the toolbar asks for it.
  await activateEngine("sqlite");
  setStatus(`Ready · ${state.loadedTables.size} tables loaded`, "ok");
}

async function resetDB() {
  if (!state.engine) return;
  await state.engine.reset();
  state.loadedTables.clear();
  state.questionCreatedTables.clear();
  await loadAllCSVs();
  await refreshTableList();
}

// ─── Schema sidebar ───
async function refreshTableList() {
  const ul = $("#pg-table-list");
  if (!ul) return;
  ul.innerHTML = "";
  if (!state.engine) return;
  const tables = await state.engine.listTables();
  for (const t of tables) {
    const info = await state.engine.tableInfo(t);
    const li = document.createElement("li");
    const head = document.createElement("div");
    head.className = "pg-table-name";
    head.innerHTML = `<span>${t}</span><span class="pg-row-count">${info.count} rows</span>`;
    head.addEventListener("click", () => li.classList.toggle("is-open"));
    const cols = document.createElement("div");
    cols.className = "pg-table-cols";
    cols.innerHTML = info.cols
      .map((c) => `<div>${c.name}<span class="pg-col-type">${c.type || ""}</span></div>`)
      .join("");
    li.appendChild(head);
    li.appendChild(cols);
    ul.appendChild(li);
  }
}

// ─── Real-world enrichment loader ───
// Each question may have an optional HTML fragment at
// /interview/data/enrichments/<qid>.html with a business-flavoured scenario,
// sample data table, annotated SQL, result table, and strategic commentary.
// If the fetch returns 404 (or the network fails), we silently fall back to
// the bare prompt — nothing breaks for unenriched questions.
const enrichmentCache = new Map();
const ENRICHMENTS_BASE = `${DATA_BASE}/enrichments`;
async function loadEnrichment(qid) {
  const block = $("#pg-q-enrichment-block");
  const body = $("#pg-q-enrichment");
  if (!block || !body) return;
  // Reset before async work — we don't want a stale enrichment from a
  // previously selected question to flash before the new one is fetched.
  block.hidden = true;
  body.innerHTML = "";
  if (!qid) return;
  if (enrichmentCache.has(qid)) {
    const cached = enrichmentCache.get(qid);
    if (cached) {
      body.innerHTML = cached;
      // Gated: the walkthrough embeds the answer SQL, so it stays hidden
      // until the reader reveals the solution.
      block.hidden = !state.solutionShown;
    }
    return;
  }
  try {
    const res = await fetch(`${ENRICHMENTS_BASE}/${encodeURIComponent(qid)}.html`);
    if (!res.ok) {
      enrichmentCache.set(qid, null);
      return;
    }
    const html = await res.text();
    enrichmentCache.set(qid, html);
    // Race-guard: only render if we're still on the same question. Switching
    // questions fast must not leak the previous question's enrichment.
    if (state.currentQ && state.currentQ.id === qid) {
      body.innerHTML = html;
      block.hidden = !state.solutionShown;
    }
  } catch (err) {
    enrichmentCache.set(qid, null);
  }
}

// ─── Question picker ───
function loadQuestion(qid /* , opts unused */) {
  const q = state.sqlQuestions.find((x) => x.id === qid);
  if (!q) return;
  state.currentQ = q;
  state.solutionShown = false;
  $("#pg-q-title").textContent = q.title || "(untitled)";
  $("#pg-q-co").textContent = q.company ? "🏢 " + q.company : "";
  $("#pg-q-diff").textContent = q.difficulty || "";
  $("#pg-q-type").textContent = [q.type, q.subtopic].filter(Boolean).join(" · ");
  // Render auto-detected SQL technique tags (analytical-functions, joins, cte, …).
  // Tags come from the bulk auto-tagger that scans each question's solution SQL.
  const tagBox = $("#pg-q-tagchips");
  if (tagBox) {
    tagBox.innerHTML = "";
    const tags = Array.isArray(q.tags) ? q.tags : [];
    if (tags.length) {
      for (const t of tags) {
        const chip = document.createElement("span");
        chip.className = "pg-q-tagchip pg-q-tag-" + t;
        chip.textContent = t;
        tagBox.appendChild(chip);
      }
      tagBox.hidden = false;
    } else {
      tagBox.hidden = true;
    }
  }
  // Show the problem text (community questions ship a real prompt) when present
  const promptBlock = $("#pg-q-prompt-block");
  const promptEl = $("#pg-q-prompt");
  if (promptBlock && promptEl) {
    if (q.question && q.question.trim()) {
      promptEl.textContent = q.question.trim();
      promptBlock.hidden = false;
    } else {
      promptBlock.hidden = true;
    }
  }
  if (q.schema) {
    $("#pg-q-schema").textContent = q.schema;
    $("#pg-q-schema-block").hidden = false;
  } else {
    $("#pg-q-schema-block").hidden = true;
  }

  // Load the optional real-world enrichment file. One HTML fragment per qid
  // under /interview/data/enrichments/<qid>.html. Missing file = no enrichment.
  loadEnrichment(qid);

  $("#pg-question-picker").value = qid;

  // Editor: load this question's last saved content, otherwise prefill a
  // header. This is keyed per question id so switching no longer leaks the
  // previous question's solution into the new editor.
  const savedForQ = localStorage.getItem(LS_EDITOR(qid));
  if (savedForQ != null && savedForQ.trim()) {
    $("#pg-editor").value = savedForQ;
  } else {
    $("#pg-editor").value =
      `-- ${q.title}\n-- ${q.company || ""} · ${q.difficulty || ""}\n` +
      `-- Schema: ${q.schema || "(see top of page)"}\n\n`;
  }

  $("#pg-solution-pane").hidden = true;
  localStorage.setItem(LS_LAST_Q, qid);

  // Update URL
  const url = new URL(window.location);
  url.searchParams.set("q", qid);
  history.replaceState(null, "", url);

  // Switch to the right engine for this question (lazy-loads PGlite the
  // first time a Postgres question is opened), then auto-load tables.
  const wantedKind = pickEngineKindFor(q);
  const switchAndLoad = async () => {
    if (state.engine && state.engine.kind !== wantedKind) {
      await activateEngine(wantedKind);
    } else if (!state.engine) {
      await activateEngine(wantedKind);
    }
    if (state.autoLoadQuestionTables && state.engineReady) {
      await dropPreviousQuestionTables(qid);
      await loadQuestionTables(qid);
    }
  };
  switchAndLoad().catch((err) => {
    console.error(err);
    setStatus("Engine switch failed: " + err.message, "error");
  });

  // Dialect notice if the reference solution uses Snowflake/MySQL/Postgres
  // features the in-browser engine can't run. The solution itself stays
  // gated behind Show solution — only a notice appears here.
  const body = $("#pg-results-body");
  if (q.runtime === "non-sqlite") {
    body.innerHTML = renderDialectReference(q);
  } else {
    body.innerHTML = '<div class="pg-empty">Run a query to see results.</div>';
  }
}

// Build the dialect-notice block shown in the results pane for questions
// whose canonical solution targets MySQL / PostgreSQL / Snowflake. The
// solution itself stays behind Show solution — never revealed upfront.
function renderDialectReference(q) {
  const tok = q.dialect_token
    ? ` (<code>${escapeHtml(q.dialect_token)}</code>)`
    : "";
  return (
    '<div class="pg-dialect-ref">' +
      '<div class="pg-dialect-banner">' +
        '<strong>Dialect notice — MySQL / PostgreSQL / Snowflake</strong>' + tok +
        '<div class="pg-dialect-note">' +
          "This question's reference solution uses syntax the in-browser engine " +
          'does not support, so it cannot run here. Click <strong>Show solution</strong> ' +
          'to view the canonical answer, then run it in MySQL, PostgreSQL, or Snowflake.' +
        '</div>' +
      '</div>' +
    '</div>'
  );
}

// Track which tables were created by which question so we can clean up.
async function dropPreviousQuestionTables(nextQid) {
  const baseCsv = new Set(CSV_FILES.map((f) => f.replace(/\.csv$/i, "")));
  const keepFromNext = new Set(
    (state.schemasByQid[nextQid] || []).map((s) => s.table)
  );
  for (const t of Array.from(state.questionCreatedTables || [])) {
    if (baseCsv.has(t)) continue;            // never drop CSVs
    if (keepFromNext.has(t)) continue;       // about to be re-created anyway
    try {
      await state.engine.dropTable(t);
    } catch (e) {
      console.warn("could not drop", t, e.message);
    }
    state.questionCreatedTables.delete(t);
  }
}

// Extract column names that appear inside `PARTITION BY ...` clauses of the
// solution SQL. These tell sample-gen which columns should REPEAT across
// rows so window functions like LAG/LEAD have something to look at — the
// canonical bug being a `LEAD(date) OVER (PARTITION BY order_id ...)` query
// against a table where order_id is unique per row, returning all NULLs.
function extractWindowHints(sql) {
  const partition = new Set();
  const orderByInWindow = new Set();
  // categoryHints maps column-name → Set of string literals the solution
  // expects to see in that column. The all-null pivot bug: a solution does
  // `SUM(CASE WHEN region='North' THEN ...)` but sample-gen seeded region
  // with ['NA','EMEA','APAC'], so the CASE never fires and the column is
  // structurally NULL. Seeding 'North' into the data fixes the pivot.
  const categoryHints = {};
  if (!sql) return { partition, orderByInWindow, categoryHints };
  // We DELIBERATELY work on the original SQL (NOT comment-stripped) for
  // PARTITION BY because column names live in code, but we still strip
  // strings for the partition-column extraction.
  const stripStrings = (s) => s
    .replace(/'(?:''|\\'|[^'])*'/g, "''")
    .replace(/"(?:""|\\"|[^"])*"/g, '""')
    .replace(/--.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "");
  const cleaned = stripStrings(sql);
  const partRe = /\bPARTITION\s+BY\s+([\s\S]+?)(?=\bORDER\s+BY\b|\bROWS\b|\bRANGE\b|\)|$)/gi;
  let m;
  while ((m = partRe.exec(cleaned)) !== null) {
    splitColList(m[1]).forEach((c) => partition.add(c));
  }
  const overRe = /\bOVER\s*\(([\s\S]*?)\)/gi;
  while ((m = overRe.exec(cleaned)) !== null) {
    const inside = m[1];
    const ord = /\bORDER\s+BY\s+([\s\S]+?)(?=\bROWS\b|\bRANGE\b|$)/i.exec(inside);
    if (ord) splitColList(ord[1]).forEach((c) => orderByInWindow.add(c));
  }
  // For category-literal extraction we keep strings intact but strip comments.
  const noComments = String(sql).replace(/--.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
  const addLit = (col, lit) => {
    if (!col || lit == null) return;
    const c = col.toLowerCase();
    if (!categoryHints[c]) categoryHints[c] = new Set();
    categoryHints[c].add(lit);
  };
  // <col> = '<literal>'  or  <col>='<literal>'
  const eqRe = /\b(\w+)\s*=\s*'((?:[^']|'')*)'/g;
  while ((m = eqRe.exec(noComments)) !== null) addLit(m[1], m[2].replace(/''/g, "'"));
  // <col> IN ('a','b','c')
  const inRe = /\b(\w+)\s+IN\s*\(\s*('(?:[^']|'')*'(?:\s*,\s*'(?:[^']|'')*')*)\s*\)/gi;
  while ((m = inRe.exec(noComments)) !== null) {
    const col = m[1];
    const litList = m[2];
    const litRe = /'((?:[^']|'')*)'/g;
    let lm;
    while ((lm = litRe.exec(litList)) !== null) addLit(col, lm[1].replace(/''/g, "'"));
  }
  // CASE WHEN <col> = '<lit>' THEN ... — already covered by the eq pattern.
  return { partition, orderByInWindow, categoryHints };
}

function splitColList(text) {
  // "alias.col, schema.table.col DESC, col2 ASC" → ['col','col','col2']
  return text
    .split(",")
    .map((part) => {
      const tok = part.trim().replace(/\s+(ASC|DESC|NULLS\s+(FIRST|LAST))\b.*$/i, "").trim();
      // strip table/alias prefix and quote chars
      const last = tok.split(".").pop().replace(/[`"\[\]]/g, "").trim();
      return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(last) ? last.toLowerCase() : null;
    })
    .filter(Boolean);
}

async function loadQuestionTables(qid) {
  const spec = state.schemasByQid[qid];
  const btn = $("#pg-load-q-tables");
  if (!spec || !spec.length) {
    if (btn) {
      btn.disabled = true;
      btn.textContent = "No schema (using base CSVs)";
    }
    return;
  }
  if (btn) {
    btn.disabled = !state.engineReady;
    btn.textContent = `Reload ${spec.length} table(s) for question`;
  }
  if (!state.engineReady) return;
  // Pull window-clause hints from the question's reference solution so the
  // sampler clusters on PARTITION BY columns instead of generating unique
  // PKs that defeat the window function. categoryHints seeds the column
  // pool with literals the solution expects (region='North', etc.) so
  // pivot CASE branches actually fire instead of returning all-NULL.
  const q = state.sqlQuestions.find((x) => x.id === qid);
  const hints = extractWindowHints(q?.solution || "");
  // Convert Sets in categoryHints to arrays for serialization across module
  // boundaries.
  const categoryHints = {};
  for (const [col, set] of Object.entries(hints.categoryHints)) {
    categoryHints[col] = [...set];
  }
  try {
    const summary = await state.engine.loadSpec(spec, {
      seed: seedFromQid(qid),
      // Don't pin rowsPerTable — let sample-gen pick (25 for dim tables,
      // 60 for event/fact tables) so streak / multi-streak / cohort
      // questions get enough rows per user to exercise their CASE
      // branches. Forcing 12 here collapsed each user to a single
      // cluster and made gap-classification CASE WHEN logic unreachable.
      partitionCols: [...hints.partition],
      windowOrderCols: [...hints.orderByInWindow],
      categoryHints,
    });
    for (const s of summary) state.questionCreatedTables.add(s.table);
    const names = summary.map((s) => s.table).join(", ");
    setStatus(`Loaded ${summary.length} synthetic table(s): ${names}`, "ok");
    await refreshTableList();
  } catch (err) {
    console.error(err);
    setStatus("Could not generate question tables: " + err.message, "error");
  }
}

function populateQuestionPicker() {
  const sel = $("#pg-question-picker");
  sel.innerHTML = "";
  for (const q of state.sqlQuestions) {
    const opt = document.createElement("option");
    opt.value = q.id;
    const co = q.company ? `${q.company} · ` : "";
    opt.textContent = `${co}${q.title} [${q.difficulty || "?"}]`;
    sel.appendChild(opt);
  }
}

// ─── Run query ───
// Tokens that mean "this query targets a different SQL dialect and won't
// run in the in-browser SQLite". We surface a clear banner instead of the
// cryptic 'near "..." : syntax error' the user would otherwise see.
const NON_SQLITE_TOKENS = [
  /\bQUALIFY\b/i, /\bILIKE\b/i, /\bIFF\s*\(/i, /\bMATCH_RECOGNIZE\b/i,
  /\bMERGE\s+INTO\b/i, /\bGROUPING\s+SETS\b/i, /\bCUBE\s*\(/i, /\bROLLUP\s*\(/i,
  /\bTO_CHAR\s*\(/i, /\bTO_DATE\s*\(/i, /\bSPLIT_PART\s*\(/i, /\bLISTAGG\s*\(/i,
  /\bSTRING_AGG\s*\(/i, /\bARRAY_AGG\s*\(/i, /\bOBJECT_AGG\s*\(/i,
  /\bREGEXP_MATCHES\s*\(/i, /\bREGEXP_LIKE\s*\(/i, /\bREGEXP_SUBSTR\s*\(/i,
  /\bREGEXP_REPLACE\s*\(/i,
  /\bGENERATE_SERIES\s*\(/i, /\bDATE_TRUNC\s*\(/i, /\bDATE_PART\s*\(/i,
  /\bDATE_FORMAT\s*\(/i, /\bFROM_UNIXTIME\s*\(/i, /\bUNIX_TIMESTAMP\s*\(/i,
  /\bUNNEST\s*\(/i, /\bFLATTEN\s*\(/i, /\bSTDDEV\s*\(/i, /\bVARIANCE\s*\(/i,
  /\bPERCENTILE_(?:CONT|DISC)\s*\(/i, /\bMEDIAN\s*\(/i,
  /\bSHA2\s*\(/i, /\bMD5\s*\(/i, /\bCONCAT_WS\s*\(/i, /\bSTRING_TO_ARRAY\s*\(/i,
  /\bDAYOFWEEK\s*\(/i, /\bDAYOFMONTH\s*\(/i, /\bWEEKOFYEAR\s*\(/i,
  /\bANY\s*\(/i, /\bTRY_CAST\s*\(/i, /\bNVL\s*\(/i,
  /\bLEFT\s*\(/i, /\bRIGHT\s*\(/i, /\bLEAST\s*\(/i, /\bGREATEST\s*\(/i,
  /\bCURRENT_DATE\s*\(/i, /\bCURRENT_TIMESTAMP\s*\(/i, /\bGETDATE\s*\(/i,
  /\bSYSDATE\s*\(/i, /\bNOW\s*\(/i,
  /\bINTERVAL\s+'[^']+'/i,                          // PG/Snowflake interval literals
  /\bDATE\s+'\d{4}-\d{2}-\d{2}'/i,                  // ANSI date literal
  /\bOFFSET\s+\d+\s+LIMIT\b/i,                      // PG/Snowflake order
  /::\s*[A-Za-z]/,                                  // PG cast operator
  /\bRETURNING\b/i,
  // EXTRACT() exists in modern SQLite but the playground build doesn't
  // include it; flag so users see a clear message rather than 'no such function'.
  /\bEXTRACT\s*\(/i,
];

// Strip strings + comments before dialect detection so a string LITERAL
// like 'Returning' or 'qualify' never trips the regex (the keyword RETURNING
// in Postgres is a real clause; the word inside quotes is just data).
function stripStringsAndComments(sql) {
  // STRIP COMMENTS FIRST. If we strip strings first, an apostrophe inside
  // a `-- Customer's history` line comment leaves the string regex
  // unbalanced and it eats through real code (including SQL keywords like
  // julianday(...)) until it finds another quote — silently defeating
  // the dialect detector.
  return sql
    // line comments
    .replace(/--.*$/gm, '')
    // block comments
    .replace(/\/\*[\s\S]*?\*\//g, '')
    // single-quoted strings (handle '' escape inside)
    .replace(/'(?:''|\\'|[^'])*'/g, "''")
    // double-quoted identifiers / strings
    .replace(/"(?:""|\\"|[^"])*"/g, '""');
}

function detectNonSqlite(sql) {
  const cleaned = stripStringsAndComments(sql);
  for (const re of NON_SQLITE_TOKENS) {
    const m = re.exec(cleaned);
    if (m) return m[0];
  }
  return null;
}

async function runQuery() {
  if (!state.engineReady) {
    setStatus("Still loading the SQL engine — try again in a moment.", "error");
    return;
  }
  const sql = $("#pg-editor").value.trim();
  if (!sql) {
    setStatus("Editor is empty", "error");
    return;
  }
  // Pre-flight: bail with a helpful message before we hit a cryptic
  // SQLite parse error from a MySQL/Postgres/Snowflake-only feature. We
  // re-render the canonical reference (banner + code) for the active
  // question so the reader sees what the answer actually looks like —
  // that's the value, even when it can't execute here.
  // Pre-flight dialect checks. Each engine has functions the OTHER engine
  // doesn't recognize — surfacing a clear banner is much better than the
  // cryptic `function julianday(timestamp without time zone) does not exist`
  // PGlite emits when it sees a SQLite-flavored query.
  if (state.engine?.kind === "sqlite") {
    const incompat = detectNonSqlite(sql);
    if (incompat) {
      const body = $("#pg-results-body");
      if (state.currentQ && state.currentQ.runtime === "non-sqlite") {
        body.innerHTML = renderDialectReference(state.currentQ);
      } else {
        renderError({ message:
          `This query uses '${incompat}', which is part of MySQL / PostgreSQL / ` +
          `Snowflake but isn't supported by the in-browser SQLite engine.\n\n` +
          `Switch the runtime above to PostgreSQL (PGlite) to execute it ` +
          `as-written, or copy it into MySQL / Snowflake.`
        });
      }
      setStatus(`MySQL / PostgreSQL / Snowflake dialect: ${incompat} (not in SQLite)`, "error");
      return;
    }
  } else if (state.engine?.kind === "postgres") {
    const sqliteOnly = detectSqliteOnly(sql);
    if (sqliteOnly) {
      renderError({ message:
        `This query uses '${sqliteOnly}', a SQLite-specific function ` +
        `that PostgreSQL doesn't have.\n\n` +
        `Switch the engine to SQLite (via the dropdown above) to run it ` +
        `as-written, or rewrite the date math using PostgreSQL syntax ` +
        `(e.g. \`a - b\` returns an INTERVAL, or \`EXTRACT(EPOCH FROM ...)\`).`
      });
      setStatus(`SQLite-only function: ${sqliteOnly} — switch engine to SQLite`, "error");
      return;
    }
  }
  if (state.currentQ) localStorage.setItem(LS_EDITOR(state.currentQ.id), sql);
  const t0 = performance.now();
  let attempts = 0;
  const maxAttempts = 3;
  while (true) {
    try {
      const results = await state.engine.exec(sql);
      const ms = (performance.now() - t0).toFixed(1);
      state.lastResult = results;
      renderResults(results, ms);
      setStatus(`OK · ${ms} ms · ${state.engine.label}`, "ok");
      break;
    } catch (err) {
      // Auto-create missing tables once or twice if we can guess columns
      const m = /(?:no such table|relation "?(\w+)"? does not exist):?\s*(\w+)?/i.exec(err.message || "");
      const missing = m ? (m[1] || m[2]) : null;
      if (missing && attempts < maxAttempts && (await createTableFromSql(missing, sql))) {
        attempts++;
        continue;
      }
      renderError(err);
      setStatus("Error · " + (err.message || "see results panel"), "error");
      break;
    }
  }
  await refreshTableList();
}

// Locked canonical column sets for common entity tables. When a user's
// custom query references one of these tables and it hasn't been loaded
// for the current question, the auto-create path uses the FULL canonical
// list — not just the alias-prefixed columns the SQL happened to mention.
// This stops the "departments lost department_name" class of confusion
// when a user types `WHERE department_name = 'Engineering'` without
// having aliased `d.` in front of it.
const CANONICAL_TABLES = {
  employees:     ["emp_id", "name", "email", "hire_date", "salary", "dept_id", "manager_id", "job_title"],
  employee:      ["emp_id", "name", "email", "hire_date", "salary", "dept_id", "manager_id", "job_title"],
  departments:   ["dept_id", "department_name", "location", "manager_id"],
  department:    ["dept_id", "department_name", "location", "manager_id"],
  customers:     ["customer_id", "name", "email", "signup_date", "country", "city"],
  customer:      ["customer_id", "name", "email", "signup_date", "country", "city"],
  users:         ["user_id", "name", "email", "signup_date", "country"],
  user:          ["user_id", "name", "email", "signup_date", "country"],
  accounts:      ["account_id", "name", "plan", "signup_date", "country"],
  products:      ["product_id", "name", "category", "price", "sku", "manufacturer"],
  product:       ["product_id", "name", "category", "price", "sku", "manufacturer"],
  orders:        ["order_id", "customer_id", "order_date", "status", "amount"],
  order:         ["order_id", "customer_id", "order_date", "status", "amount"],
  cities:        ["city_id", "cityname", "country", "state"],
  stores:        ["store_id", "name", "location", "city", "region"],
  merchants:     ["merchant_id", "name", "category", "city"],
  restaurants:   ["restaurant_id", "name", "cuisine", "city"],
  listings:      ["listing_id", "title", "city", "price", "host_id"],
  companies:     ["company_id", "name", "industry", "country", "founded_year"],
  company:       ["company_id", "name", "industry", "country", "founded_year"],
  suppliers:     ["supplier_id", "name", "country", "city"],
  invoices:      ["invoice_id", "customer_id", "invoice_date", "amount", "status"],
  payments:      ["payment_id", "customer_id", "payment_date", "amount", "method", "status"],
  transactions:  ["transaction_id", "customer_id", "transaction_time", "amount", "txn_type", "status"],
  projects:      ["project_id", "name", "start_date", "end_date", "status", "manager_id"],
  tasks:         ["task_id", "project_id", "name", "assignee_id", "status", "due_date"],
  subscriptions: ["subscription_id", "customer_id", "plan", "start_date", "end_date", "status"],
  items:         ["item_id", "name", "category", "price"],
};

/**
 * If the running query references an alias.column for the missing table,
 * create the table on the fly with those columns. Returns true if anything
 * was created (so we can retry).
 *
 * Canonical-table rule: if the missing table's name is a known entity
 * (employees, departments, customers, ...) we ignore the alias-derived
 * column set and use the locked canonical column list above. That way
 * `WHERE department_name = 'X'` references in custom SQL — which never
 * survive alias.col parsing — still resolve to a populated column.
 */
async function createTableFromSql(missingTable, sql) {
  const lcTable = String(missingTable).toLowerCase();
  let cols;
  if (CANONICAL_TABLES[lcTable]) {
    // Locked canonical shape — every canonical entity always loads with
    // the same column set, regardless of what the user's query mentioned.
    cols = new Set(CANONICAL_TABLES[lcTable]);
    // Also union in any extra alias.col cols the user referenced, so a
    // user-introduced column (e.g. employees.notes) still works.
  } else {
    cols = new Set();
  }
  // Find aliases in FROM/JOIN clauses
  const fromRe = /(?:FROM|JOIN)\s+(\w+)(?:\s+(?:AS\s+)?(\w+))?/gi;
  const aliasMap = {};
  let m;
  while ((m = fromRe.exec(sql)) !== null) {
    const t = m[1], a = m[2];
    aliasMap[t.toLowerCase()] = t;
    if (a) aliasMap[a.toLowerCase()] = t;
  }
  // Collect alias.col tokens that resolve to the missing table
  const aliasColRe = /\b(\w+)\.(\w+)\b/g;
  while ((m = aliasColRe.exec(sql)) !== null) {
    if (aliasMap[m[1].toLowerCase()] === missingTable) cols.add(m[2]);
  }
  // Fallback if we still have nothing AND the table isn't canonical:
  // create a tiny generic table so the query at least binds.
  if (cols.size === 0) {
    cols.add("id");
    cols.add("name");
    cols.add("value");
  }
  try {
    const spec = [{ table: missingTable, columns: [...cols] }];
    await state.engine.loadSpec(spec, { seed: seedFromQid(missingTable), rowsPerTable: 12 });
    setStatus(`Auto-created table "${missingTable}" — re-running…`, "ok");
    return true;
  } catch (e) {
    console.error("createTableFromSql failed", e);
    return false;
  }
}

function renderResults(results, ms) {
  const body = $("#pg-results-body");
  const stats = $("#pg-results-stats");
  body.innerHTML = "";
  $("#pg-export-csv").hidden = true;

  if (!results.length) {
    body.innerHTML = `<div class="pg-affected">Statement executed (no rows returned).</div>`;
    stats.textContent = `${ms} ms`;
    return;
  }
  const last = results[results.length - 1];
  const { columns, values } = last;
  const table = document.createElement("table");
  table.className = "pg-result-table";
  const thead = document.createElement("thead");
  thead.innerHTML = "<tr>" + columns.map((c) => `<th>${escapeHtml(c)}</th>`).join("") + "</tr>";
  table.appendChild(thead);
  const tbody = document.createElement("tbody");
  const max = Math.min(values.length, 1000);
  for (let i = 0; i < max; i++) {
    const tr = document.createElement("tr");
    tr.innerHTML = values[i]
      .map((v) =>
        v === null
          ? `<td class="pg-null">NULL</td>`
          : `<td>${escapeHtml(formatCell(v))}</td>`
      )
      .join("");
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  body.appendChild(table);

  const truncated = values.length > 1000 ? ` (showing first 1000 of ${values.length})` : "";
  stats.textContent = `${values.length} rows${truncated} · ${ms} ms`;
  $("#pg-export-csv").hidden = false;
}

// Result-cell value → display string. Postgres engines return JSONB / JSON
// columns as parsed JS objects, arrays as JS arrays, dates as JS Date
// instances. The naive `String(v)` yields '[object Object]' for objects,
// '1,2,3' for arrays, and locale-formatted noise for Date — none of which
// belong in a SQL-result table.
function formatCell(v) {
  if (v === null || v === undefined) return "";
  // Date → ISO string (the form Postgres / SQLite both display)
  if (v instanceof Date) {
    const iso = v.toISOString();
    // Trim trailing 'Z' and milliseconds for cleaner display; keep date for DATE cols
    return iso.endsWith("T00:00:00.000Z") ? iso.slice(0, 10) : iso.replace(/\.\d{3}Z$/, "Z");
  }
  // Buffers / typed arrays → hex preview
  if (v instanceof Uint8Array || (typeof Buffer !== "undefined" && v instanceof Buffer)) {
    const a = Array.from(v.slice(0, 16));
    const hex = a.map((b) => b.toString(16).padStart(2, "0")).join("");
    return `\\x${hex}${v.length > 16 ? "…" : ""}`;
  }
  // Arrays and plain objects → pretty JSON
  if (Array.isArray(v) || (typeof v === "object")) {
    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  }
  return String(v);
}

function renderError(err) {
  const body = $("#pg-results-body");
  body.innerHTML = `<div class="pg-error">${escapeHtml(err.message || String(err))}</div>`;
  $("#pg-results-stats").textContent = "";
  $("#pg-export-csv").hidden = true;
}

function escapeHtml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function exportCSV() {
  if (!state.lastResult || !state.lastResult.length) return;
  const last = state.lastResult[state.lastResult.length - 1];
  const lines = [last.columns.map(csvCell).join(",")];
  for (const row of last.values) lines.push(row.map(csvCell).join(","));
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "query-results.csv";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
function csvCell(v) {
  if (v == null) return "";
  const s = formatCell(v);
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

// ─── Solution actions ───
// The enrichment walkthrough embeds the reference SQL, so it is revealed
// together with the solution — never upfront.
function revealEnrichment() {
  const body = $("#pg-q-enrichment");
  if (body && body.innerHTML.trim()) $("#pg-q-enrichment-block").hidden = false;
}
function showSolution() {
  if (!state.currentQ) return;
  state.solutionShown = true;
  $("#pg-solution").textContent = state.currentQ.solution || "(no reference solution)";
  $("#pg-solution-pane").hidden = false;
  $("#pg-solution-pane").scrollIntoView({ behavior: "smooth", block: "nearest" });
  revealEnrichment();
}
function loadSolution() {
  if (!state.currentQ?.solution) return;
  state.solutionShown = true;
  $("#pg-editor").value = state.currentQ.solution;
  revealEnrichment();
}

// ─── Custom CSV loader ───
async function loadCustomCSV() {
  const name = ($("#pg-csv-name").value || "").trim();
  const text = $("#pg-csv-text").value;
  if (!name) { alert("Provide a table name"); return; }
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) { alert("Use letters, digits, underscores; start with a letter"); return; }
  if (!text.trim()) { alert("Paste some CSV first"); return; }
  try {
    const rows = parseCSV(text);
    const headers = rows[0].map((h) => h.trim());
    const data = rows.slice(1);
    const types = inferColumnTypes(headers, data);
    const records = data
      .filter((row) => !(row.length === 1 && row[0] === ""))
      .map((row) => headers.map((_, i) => castValue(row[i], types[i])));
    await state.engine.loadCSV(name, headers, types, records);
    state.loadedTables.add(name);
    await refreshTableList();
    setStatus(`Loaded "${name}" (${records.length} rows)`, "ok");
  } catch (e) {
    setStatus(e.message, "error");
  }
}

// ─── Format (very light pass) ───
function formatSQL() {
  let s = $("#pg-editor").value;
  s = s
    .replace(/\bselect\b/gi, "SELECT")
    .replace(/\bfrom\b/gi, "FROM")
    .replace(/\bwhere\b/gi, "WHERE")
    .replace(/\bgroup by\b/gi, "GROUP BY")
    .replace(/\border by\b/gi, "ORDER BY")
    .replace(/\bhaving\b/gi, "HAVING")
    .replace(/\bjoin\b/gi, "JOIN")
    .replace(/\bleft join\b/gi, "LEFT JOIN")
    .replace(/\binner join\b/gi, "INNER JOIN")
    .replace(/\bright join\b/gi, "RIGHT JOIN")
    .replace(/\bon\b/gi, "ON")
    .replace(/\blimit\b/gi, "LIMIT")
    .replace(/\bunion\b/gi, "UNION")
    .replace(/\bas\b/gi, "AS");
  $("#pg-editor").value = s;
}

// Wraps an async handler so any thrown error becomes a visible status update.
function safeAsync(fn, busyMsg) {
  return async (...args) => {
    if (busyMsg) setStatus(busyMsg);
    try { return await fn(...args); }
    catch (err) {
      console.error(err);
      setStatus("Error · " + (err.message || "see console"), "error");
    }
  };
}

// ─── Wire ───
function wire() {
  $("#pg-run").addEventListener("click", runQuery);
  $("#pg-format").addEventListener("click", formatSQL);
  $("#pg-show-solution").addEventListener("click", showSolution);
  $("#pg-load-solution").addEventListener("click", loadSolution);
  $("#pg-solution-close").addEventListener("click", () => {
    state.solutionShown = false;
    $("#pg-solution-pane").hidden = true;
    $("#pg-q-enrichment-block").hidden = true;
  });
  $("#pg-export-csv").addEventListener("click", exportCSV);
  $("#pg-refresh-schema").addEventListener("click", () => {
    if (!state.engineReady) { setStatus("Engine not ready yet", "error"); return; }
    refreshTableList();
  });
  $("#pg-csv-load").addEventListener("click", loadCustomCSV);

  $("#pg-clear-editor")?.addEventListener("click", () => {
    $("#pg-editor").value = "";
    if (state.currentQ) localStorage.removeItem(LS_EDITOR(state.currentQ.id));
    setStatus("Editor cleared", "ok");
  });

  $("#pg-clear-output")?.addEventListener("click", () => {
    const body = $("#pg-results-body");
    if (body) body.innerHTML = '<div class="pg-empty">Run a query to see results.</div>';
    const stats = $("#pg-results-stats");
    if (stats) stats.textContent = "";
    const csvBtn = $("#pg-export-csv");
    if (csvBtn) csvBtn.hidden = true;
    state.lastResult = null;
  });

  $("#pg-reset-db").addEventListener("click", safeAsync(async () => {
    if (!state.engineReady) { setStatus("Engine not ready yet", "error"); return; }
    setStatus("Resetting…");
    await resetDB();
    if (state.autoLoadQuestionTables && state.currentQ) await loadQuestionTables(state.currentQ.id);
    setStatus(`Reset · ${state.loadedTables.size} tables loaded`, "ok");
  }));

  $("#pg-load-q-tables")?.addEventListener("click", safeAsync(async () => {
    if (!state.engineReady) { setStatus("Engine not ready yet", "error"); return; }
    if (state.currentQ) await loadQuestionTables(state.currentQ.id);
  }));

  $("#pg-toggle-autoload")?.addEventListener("change", (e) => {
    state.autoLoadQuestionTables = e.target.checked;
  });

  const runtimeSel = $("#pg-runtime-select");
  if (runtimeSel) {
    const saved = localStorage.getItem(LS_RUNTIME) || "auto";
    state.runtimePref = saved;
    runtimeSel.value = saved;
    runtimeSel.addEventListener("change", safeAsync(async (e) => {
      state.runtimePref = e.target.value;
      localStorage.setItem(LS_RUNTIME, state.runtimePref);
      const wantedKind = pickEngineKindFor(state.currentQ);
      if (state.engine?.kind !== wantedKind) {
        setStatus(`Switching to ${wantedKind === "postgres" ? "PostgreSQL" : "SQLite"}…`);
        await activateEngine(wantedKind);
        if (state.autoLoadQuestionTables && state.currentQ) {
          await loadQuestionTables(state.currentQ.id);
        }
        setStatus(`Ready · ${state.engine.label}`, "ok");
      }
    }, "Switching engine…"));
  }

  $("#pg-question-picker").addEventListener("change", (e) => {
    loadQuestion(e.target.value, { prefill: true });
  });

  $("#pg-prev-q").addEventListener("click", () => stepQuestion(-1));
  $("#pg-next-q").addEventListener("click", () => stepQuestion(+1));

  // Ctrl+Enter / Cmd+Enter to run
  $("#pg-editor").addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      runQuery();
    }
    // Tab inserts two spaces
    if (e.key === "Tab") {
      e.preventDefault();
      const ta = e.target;
      const s = ta.selectionStart, ed = ta.selectionEnd;
      ta.value = ta.value.slice(0, s) + "  " + ta.value.slice(ed);
      ta.selectionStart = ta.selectionEnd = s + 2;
    }
  });

  // Persist editor (per question)
  $("#pg-editor").addEventListener("input", () => {
    if (state.currentQ) localStorage.setItem(LS_EDITOR(state.currentQ.id), $("#pg-editor").value);
  });
}

function stepQuestion(delta) {
  if (!state.currentQ) return;
  const idx = state.sqlQuestions.findIndex((q) => q.id === state.currentQ.id);
  const next = state.sqlQuestions[(idx + delta + state.sqlQuestions.length) % state.sqlQuestions.length];
  if (next) loadQuestion(next.id, { prefill: true });
}

// ─── Init ───
async function init() {
  state.runtimePref = localStorage.getItem(LS_RUNTIME) || "auto";
  wire();
  setEngineReady(false);            // start with engine-dependent buttons disabled
  setStatus("Loading question data…");

  // Load questions + per-question schemas
  const [all, schemas] = await Promise.all([
    fetch(QUESTIONS_URL).then((r) => r.json()),
    fetch(SCHEMAS_URL).then((r) => r.json()).catch(() => ({})),
  ]);
  state.questions = all;
  state.sqlQuestions = all.filter((q) => q.language === "sql");
  state.schemasByQid = schemas;
  populateQuestionPicker();

  // Pick question first — engine pick-and-load runs inside loadQuestion()
  const params = new URLSearchParams(window.location.search);
  const qid = params.get("q") || localStorage.getItem(LS_LAST_Q) || state.sqlQuestions[0]?.id;

  // Pick the right engine UPFRONT based on the question's runtime tag plus
  // the user's saved preference, so we don't double-boot SQLite then jump
  // to Postgres if the question is Postgres-only.
  const startQ = state.sqlQuestions.find((q) => q.id === qid);
  const startKind = pickEngineKindFor(startQ);
  await activateEngine(startKind);
  setStatus(`Ready · ${state.engine.label} · ${state.loadedTables.size} tables`, "ok");

  if (qid) loadQuestion(qid);
}

init().catch((err) => {
  console.error(err);
  setStatus("Init failed: " + err.message, "error");
});
