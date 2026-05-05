// ════════════════════════════════════════════════════════════
// SQL Playground — sql.js (SQLite-WASM) in-browser
// ════════════════════════════════════════════════════════════

const DATA_BASE = "../data";
const CSV_BASE = "../sample dataset";
const QUESTIONS_URL = `${DATA_BASE}/questions.json`;
const LS_LAST_Q = "pg.sql.lastQ";
const LS_EDITOR = "pg.sql.editor";

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
  currentQ: null,
  loadedTables: new Set(),
  lastResult: null,
};

// ─── Status helper ───
function setStatus(msg, kind = "") {
  const el = $("#pg-status");
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
  setStatus("Loading SQLite engine…");
  // sql.js wasm is hosted alongside the JS on the CDN
  const SQL = await window.initSqlJs({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/sql.js@1.10.3/dist/${file}`,
  });
  state.SQL = SQL;
  await resetDB();
  setStatus(`Ready · ${state.loadedTables.size} tables loaded`, "ok");
}

async function resetDB() {
  if (state.db) state.db.close();
  state.db = new state.SQL.Database();
  state.loadedTables.clear();
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
function loadQuestion(qid, opts = {}) {
  const q = state.sqlQuestions.find((x) => x.id === qid);
  if (!q) return;
  state.currentQ = q;
  $("#pg-q-title").textContent = q.title || "(untitled)";
  $("#pg-q-co").textContent = q.company ? "🏢 " + q.company : "";
  $("#pg-q-diff").textContent = q.difficulty || "";
  $("#pg-q-type").textContent = [q.type, q.subtopic].filter(Boolean).join(" · ");
  if (q.schema) {
    $("#pg-q-schema").textContent = q.schema;
    $("#pg-q-schema-block").hidden = false;
  } else {
    $("#pg-q-schema-block").hidden = true;
  }
  $("#pg-question-picker").value = qid;

  // Optional: prefill editor only if user hasn't typed something
  if (opts.prefill) {
    $("#pg-editor").value = `-- ${q.title}\n-- ${q.company || ""} · ${q.difficulty || ""}\n-- Schema: ${q.schema || "(see top of page)"}\n\n`;
  }

  $("#pg-solution-pane").hidden = true;
  localStorage.setItem(LS_LAST_Q, qid);

  // Update URL
  const url = new URL(window.location);
  url.searchParams.set("q", qid);
  history.replaceState(null, "", url);
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
function runQuery() {
  const sql = $("#pg-editor").value.trim();
  if (!sql) {
    setStatus("Editor is empty", "error");
    return;
  }
  localStorage.setItem(LS_EDITOR, sql);
  const t0 = performance.now();
  try {
    const results = state.db.exec(sql);
    const ms = (performance.now() - t0).toFixed(1);
    state.lastResult = results;
    renderResults(results, ms);
    setStatus(`OK · ${ms} ms`, "ok");
  } catch (err) {
    renderError(err);
    setStatus("Error", "error");
  }
  refreshTableList();
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

// ─── Wire ───
function wire() {
  $("#pg-run").addEventListener("click", runQuery);
  $("#pg-format").addEventListener("click", formatSQL);
  $("#pg-show-solution").addEventListener("click", showSolution);
  $("#pg-load-solution").addEventListener("click", loadSolution);
  $("#pg-solution-close").addEventListener("click", () => ($("#pg-solution-pane").hidden = true));
  $("#pg-export-csv").addEventListener("click", exportCSV);
  $("#pg-refresh-schema").addEventListener("click", refreshTableList);
  $("#pg-csv-load").addEventListener("click", loadCustomCSV);

  $("#pg-reset-db").addEventListener("click", async () => {
    setStatus("Resetting…");
    await resetDB();
    setStatus(`Reset · ${state.loadedTables.size} tables loaded`, "ok");
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

  // Persist editor
  $("#pg-editor").addEventListener("input", () => {
    localStorage.setItem(LS_EDITOR, $("#pg-editor").value);
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
  // Load questions, filter SQL ones
  const all = await fetch(QUESTIONS_URL).then((r) => r.json());
  state.questions = all;
  state.sqlQuestions = all.filter((q) => q.language === "sql");
  populateQuestionPicker();

  // Initial editor contents (from localStorage if present)
  const savedEditor = localStorage.getItem(LS_EDITOR);
  if (savedEditor) $("#pg-editor").value = savedEditor;

  await initEngine();

  // Pick question: ?q= → last → first
  const params = new URLSearchParams(window.location.search);
  const qid = params.get("q") || localStorage.getItem(LS_LAST_Q) || state.sqlQuestions[0]?.id;
  if (qid) loadQuestion(qid, { prefill: !savedEditor });
}

init().catch((err) => {
  console.error(err);
  setStatus("Init failed: " + err.message, "error");
});
