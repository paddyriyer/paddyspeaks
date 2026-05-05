// ════════════════════════════════════════════════════════════
// SQL Playground — sql.js (SQLite-WASM) in-browser
// ════════════════════════════════════════════════════════════
import { generateAndLoad, seedFromQid } from "./sample-gen.js";

const DATA_BASE = "../interview/data";
const CSV_BASE = "../interview/sample%20dataset";
const QUESTIONS_URL = `${DATA_BASE}/questions.json`;
const SCHEMAS_URL = `${DATA_BASE}/question_schemas.json`;
const LS_LAST_Q = "pg.sql.lastQ";
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
  SQL: null,
  db: null,
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

  const colDefs = headers.map((h, i) => `${quoteIdent(h)} ${types[i]}`).join(", ");
  state.db.run(`DROP TABLE IF EXISTS ${quoteIdent(tableName)};`);
  state.db.run(`CREATE TABLE ${quoteIdent(tableName)} (${colDefs});`);

  const placeholders = headers.map(() => "?").join(",");
  const stmt = state.db.prepare(
    `INSERT INTO ${quoteIdent(tableName)} VALUES (${placeholders})`
  );
  state.db.exec("BEGIN");
  try {
    for (const row of data) {
      if (row.length === 1 && row[0] === "") continue;
      const padded = headers.map((_, i) => castValue(row[i], types[i]));
      stmt.run(padded);
    }
    state.db.exec("COMMIT");
  } catch (e) {
    state.db.exec("ROLLBACK");
    throw e;
  } finally {
    stmt.free();
  }
  state.loadedTables.add(tableName);
}

async function loadAllCSVs() {
  const results = await Promise.allSettled(CSV_FILES.map(loadCSVAsTable));
  const failed = results.filter((r) => r.status === "rejected");
  if (failed.length) {
    console.warn("Some CSVs failed to load:", failed.map((f) => f.reason?.message));
  }
}

// ─── DB lifecycle ───
async function initEngine() {
  setStatus("Loading SQLite engine (~1 MB WASM)…");
  if (typeof window.initSqlJs !== "function") {
    throw new Error("sql.js failed to load — check your network or ad blocker.");
  }
  const SQL = await window.initSqlJs({
    locateFile: (file) => `./vendor/sql.js/${file}`,
  });
  state.SQL = SQL;
  await resetDB();
  setEngineReady(true);
  setStatus(`Ready · ${state.loadedTables.size} tables loaded`, "ok");
}

async function resetDB() {
  if (state.db) state.db.close();
  state.db = new state.SQL.Database();
  state.loadedTables.clear();
  state.questionCreatedTables.clear();
  await loadAllCSVs();
  refreshTableList();
}

// ─── Schema sidebar ───
function getTables() {
  const r = state.db.exec(
    "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
  );
  if (!r.length) return [];
  return r[0].values.map((row) => row[0]);
}

function getTableInfo(name) {
  const cols = state.db.exec(`PRAGMA table_info(${quoteIdent(name)})`);
  const cnt = state.db.exec(`SELECT COUNT(*) FROM ${quoteIdent(name)}`);
  return {
    cols: cols.length ? cols[0].values.map((r) => ({ name: r[1], type: r[2] })) : [],
    count: cnt.length ? cnt[0].values[0][0] : 0,
  };
}

function refreshTableList() {
  const ul = $("#pg-table-list");
  ul.innerHTML = "";
  const tables = getTables();
  for (const t of tables) {
    const info = getTableInfo(t);
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

// ─── Question picker ───
function loadQuestion(qid /* , opts unused */) {
  const q = state.sqlQuestions.find((x) => x.id === qid);
  if (!q) return;
  state.currentQ = q;
  $("#pg-q-title").textContent = q.title || "(untitled)";
  $("#pg-q-co").textContent = q.company ? "🏢 " + q.company : "";
  $("#pg-q-diff").textContent = q.difficulty || "";
  $("#pg-q-type").textContent = [q.type, q.subtopic].filter(Boolean).join(" · ");
  // Show the problem text (community questions ship a real prompt) when present
  const promptBlock = $("#pg-q-prompt-block");
  const promptEl = $("#pg-q-prompt");
  const videoEl = $("#pg-q-video");
  if (promptBlock && promptEl) {
    const hasPrompt = q.question && q.question.trim();
    const hasVideo = q.video_url && q.video_url.trim();
    if (hasPrompt) {
      promptEl.textContent = q.question.trim();
    } else {
      promptEl.textContent = "";
    }
    if (videoEl) {
      if (hasVideo) {
        videoEl.href = q.video_url;
        videoEl.hidden = false;
      } else {
        videoEl.hidden = true;
      }
    }
    promptBlock.hidden = !(hasPrompt || hasVideo);
  }
  if (q.schema) {
    $("#pg-q-schema").textContent = q.schema;
    $("#pg-q-schema-block").hidden = false;
  } else {
    $("#pg-q-schema-block").hidden = true;
  }
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

  // Auto-load this question's tables. Drop any synthetic tables left over
  // from the previous question first — otherwise stale shapes (e.g. a
  // leftover sales_2024 with id/name/value) shadow the new question's
  // expected schema.
  if (state.autoLoadQuestionTables && state.engineReady) {
    dropPreviousQuestionTables(qid);
    loadQuestionTables(qid);
  }

  // Up-front dialect banner if the reference solution uses
  // Snowflake/PostgreSQL features we can't run.
  const body = $("#pg-results-body");
  if (q.runtime === "non-sqlite") {
    const tok = q.dialect_token ? ` <code>${q.dialect_token}</code>` : "";
    body.innerHTML =
      '<div class="pg-empty">⚠ Reference solution uses' + tok +
      ' which is part of Snowflake / PostgreSQL but not the in-browser SQLite engine.<br>' +
      'It runs as reference only — paste it into the matching production engine to execute.</div>';
  } else {
    body.innerHTML = '<div class="pg-empty">Run a query to see results.</div>';
  }
}

// Track which tables were created by which question so we can clean up.
function dropPreviousQuestionTables(nextQid) {
  const baseCsv = new Set(CSV_FILES.map((f) => f.replace(/\.csv$/i, "")));
  const keepFromNext = new Set(
    (state.schemasByQid[nextQid] || []).map((s) => s.table)
  );
  for (const t of Array.from(state.questionCreatedTables || [])) {
    if (baseCsv.has(t)) continue;            // never drop CSVs
    if (keepFromNext.has(t)) continue;       // about to be re-created anyway
    try {
      state.db.run(`DROP TABLE IF EXISTS "${t.replace(/"/g, '""')}"`);
    } catch (e) {
      console.warn("could not drop", t, e.message);
    }
    state.questionCreatedTables.delete(t);
  }
}

function loadQuestionTables(qid) {
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
  try {
    const summary = generateAndLoad(state.db, spec, { seed: seedFromQid(qid), rowsPerTable: 12 });
    for (const s of summary) state.questionCreatedTables.add(s.table);
    const names = summary.map((s) => s.table).join(", ");
    setStatus(`Loaded ${summary.length} synthetic table(s): ${names}`, "ok");
    refreshTableList();
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

function detectNonSqlite(sql) {
  for (const re of NON_SQLITE_TOKENS) {
    const m = re.exec(sql);
    if (m) return m[0];
  }
  return null;
}

function runQuery() {
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
  // SQLite parse error from a Snowflake-only / Postgres-only feature.
  const incompat = detectNonSqlite(sql);
  if (incompat) {
    renderError({ message:
      `This solution uses '${incompat}', which is part of Snowflake or PostgreSQL ` +
      `but isn't supported by the in-browser SQLite engine.\n\n` +
      `The reference solution is correct for its target dialect — read it as ` +
      `you would on paper. To execute, paste it into the actual database ` +
      `(Snowflake / Postgres) you'd use in production.`
    });
    setStatus(`Dialect: needs ${incompat} (not in SQLite)`, "error");
    return;
  }
  if (state.currentQ) localStorage.setItem(LS_EDITOR(state.currentQ.id), sql);
  const t0 = performance.now();
  let attempts = 0;
  const maxAttempts = 3;
  while (true) {
    try {
      const results = state.db.exec(sql);
      const ms = (performance.now() - t0).toFixed(1);
      state.lastResult = results;
      renderResults(results, ms);
      setStatus(`OK · ${ms} ms`, "ok");
      break;
    } catch (err) {
      // Auto-create missing tables once or twice if we can guess columns
      const m = /no such table:\s*(\w+)/i.exec(err.message || "");
      if (m && attempts < maxAttempts && createTableFromSql(m[1], sql)) {
        attempts++;
        continue;
      }
      renderError(err);
      setStatus("Error · " + (err.message || "see results panel"), "error");
      break;
    }
  }
  refreshTableList();
}

/**
 * If the running query references an alias.column for the missing table,
 * create the table on the fly with those columns. Returns true if anything
 * was created (so we can retry).
 */
function createTableFromSql(missingTable, sql) {
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
  const cols = new Set();
  const aliasColRe = /\b(\w+)\.(\w+)\b/g;
  while ((m = aliasColRe.exec(sql)) !== null) {
    if (aliasMap[m[1].toLowerCase()] === missingTable) cols.add(m[2]);
  }
  // Or columns referenced bare when the only table in FROM is the missing one
  if (cols.size === 0) {
    cols.add("id");
    cols.add("name");
    cols.add("value");
  }
  try {
    // Reuse the synthetic generator for consistent shape
    const spec = [{ table: missingTable, columns: [...cols] }];
    generateAndLoad(state.db, spec, { seed: seedFromQid(missingTable), rowsPerTable: 12 });
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
          : `<td>${escapeHtml(String(v))}</td>`
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
  const s = String(v);
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

// ─── Solution actions ───
function showSolution() {
  if (!state.currentQ) return;
  $("#pg-solution").textContent = state.currentQ.solution || "(no reference solution)";
  $("#pg-solution-pane").hidden = false;
  $("#pg-solution-pane").scrollIntoView({ behavior: "smooth", block: "nearest" });
}
function loadSolution() {
  if (!state.currentQ?.solution) return;
  $("#pg-editor").value = state.currentQ.solution;
}

// ─── Custom CSV loader ───
function loadCustomCSV() {
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
    const colDefs = headers.map((h, i) => `${quoteIdent(h)} ${types[i]}`).join(", ");
    state.db.run(`DROP TABLE IF EXISTS ${quoteIdent(name)};`);
    state.db.run(`CREATE TABLE ${quoteIdent(name)} (${colDefs});`);
    const placeholders = headers.map(() => "?").join(",");
    const stmt = state.db.prepare(`INSERT INTO ${quoteIdent(name)} VALUES (${placeholders})`);
    state.db.exec("BEGIN");
    for (const row of data) {
      if (row.length === 1 && row[0] === "") continue;
      stmt.run(headers.map((_, i) => castValue(row[i], types[i])));
    }
    state.db.exec("COMMIT");
    stmt.free();
    state.loadedTables.add(name);
    refreshTableList();
    setStatus(`Loaded "${name}" (${data.length} rows)`, "ok");
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
  $("#pg-solution-close").addEventListener("click", () => ($("#pg-solution-pane").hidden = true));
  $("#pg-export-csv").addEventListener("click", exportCSV);
  $("#pg-refresh-schema").addEventListener("click", () => {
    if (!state.engineReady) { setStatus("Engine not ready yet", "error"); return; }
    refreshTableList();
  });
  $("#pg-csv-load").addEventListener("click", loadCustomCSV);

  $("#pg-reset-db").addEventListener("click", safeAsync(async () => {
    if (!state.engineReady) { setStatus("Engine not ready yet", "error"); return; }
    setStatus("Resetting…");
    await resetDB();
    if (state.autoLoadQuestionTables && state.currentQ) loadQuestionTables(state.currentQ.id);
    setStatus(`Reset · ${state.loadedTables.size} tables loaded`, "ok");
  }));

  $("#pg-load-q-tables")?.addEventListener("click", () => {
    if (!state.engineReady) { setStatus("Engine not ready yet", "error"); return; }
    if (state.currentQ) loadQuestionTables(state.currentQ.id);
  });

  $("#pg-toggle-autoload")?.addEventListener("change", (e) => {
    state.autoLoadQuestionTables = e.target.checked;
  });

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

  // Pick question: ?q= → last → first. Render UI immediately;
  // tables get auto-loaded once the engine is ready. Editor contents are
  // restored per-question inside loadQuestion() itself.
  const params = new URLSearchParams(window.location.search);
  const qid = params.get("q") || localStorage.getItem(LS_LAST_Q) || state.sqlQuestions[0]?.id;
  if (qid) loadQuestion(qid);

  await initEngine();

  // Now that engine is ready, populate this question's tables.
  if (state.currentQ && state.autoLoadQuestionTables) {
    loadQuestionTables(state.currentQ.id);
  }
}

init().catch((err) => {
  console.error(err);
  setStatus("Init failed: " + err.message, "error");
});
