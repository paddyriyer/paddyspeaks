/* ═══════════════════════════════════════════
   Skill Check — Quiz Engine v2
   - Pool randomization (each attempt pulls N from the bank)
   - Option order shuffling (single/multi)
   - In-browser code execution (PGlite Postgres-WASM for SQL, Pyodide for Python)
   - localStorage persistence with version-keyed migrations
   ═══════════════════════════════════════════ */

const ENGINE_VERSION = 4;
const STORAGE_PREFIX = "paddyspeaks.skillcheck.";
const DEFAULT_QUIZ_LENGTH = 20;

const SECTIONS = {
  sql:    { slug: "sql",    label: "SQL",            file: "./data/sql.json" },
  python: { slug: "python", label: "Python",         file: "./data/python.json" },
  design: { slug: "design", label: "Data & System Design", file: "./data/design.json" },
};

const params = new URLSearchParams(window.location.search);
const sectionSlug = params.get("section");

const state = {
  section: null,
  bank: [],           // full question pool from JSON
  questions: [],      // selected subset for this attempt (in display order)
  attempt: null,      // { questionIds: [...], optionOrder: { qid: [perm] }, startedAt, version }
  current: 0,
  answers: {},        // qid -> canonical option index (single) | array of canonical indices (multi) | string (code/open)
  selfRatings: {},    // qid -> 0 | 1 | 2
  submitted: false,
  runOutputs: {},     // qid -> { kind: 'ok'|'error'|'pass'|'fail', html: '...' } (NOT persisted)
};

// Lazy runtime singletons
const runtimes = {
  pglite: null,        // PGlite Postgres-WASM instance
  pyodide: null,       // Pyodide instance
  loadingPglite: null, // pending promise
  loadingPyodide: null,
  pyodidePandasLoaded: false,
  loadingPandas: null, // pending promise for numpy+pandas load
};

// Detect whether a Python snippet imports pandas or numpy — same regex the
// existing playground uses. We use this to lazy-load the pandas+numpy
// Pyodide packages on the first pandas-flagged question; Pyodide ships
// without them by default.
const PANDAS_IMPORT_RX = /(?:^|\W)(?:import|from)\s+[^\n#]*\b(?:pandas|numpy)\b/m;

// ──────────────────────────────────────────
// Init
// ──────────────────────────────────────────
async function init() {
  if (!sectionSlug || !SECTIONS[sectionSlug]) {
    renderError("Unknown section. Pick one from the start page.");
    return;
  }
  try {
    const res = await fetch(SECTIONS[sectionSlug].file);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    state.section = data;
    state.bank = data.questions;
    if (!Array.isArray(state.bank) || state.bank.length === 0) {
      throw new Error("Question bank is empty.");
    }
    prepareAttempt();
    if (state.submitted) {
      renderResults();
    } else {
      renderQuiz();
    }
  } catch (err) {
    renderError(`Could not load questions: ${err.message}`);
  }
}

// ──────────────────────────────────────────
// Attempt lifecycle — generate, restore, materialize
// ──────────────────────────────────────────
function prepareAttempt() {
  restore();
  if (!state.attempt || state.attempt.version !== ENGINE_VERSION) {
    newAttempt();
  }
  // Materialize state.questions = bank items in attempt order, only those still in bank
  const byId = Object.fromEntries(state.bank.map(q => [q.id, q]));
  const selected = state.attempt.questionIds.map(id => byId[id]).filter(Boolean);
  if (selected.length === 0) {
    // Banked questions changed since last attempt — start fresh
    clearProgress();
    newAttempt();
    state.questions = state.attempt.questionIds.map(id => byId[id]).filter(Boolean);
  } else {
    state.questions = selected;
  }
}

function newAttempt() {
  const length = Math.min(state.section.quiz_length || DEFAULT_QUIZ_LENGTH, state.bank.length);
  const shuffled = shuffleArray(state.bank.map(q => q.id));
  const questionIds = shuffled.slice(0, length);

  const optionOrder = {};
  for (const id of questionIds) {
    const q = state.bank.find(b => b.id === id);
    if (q && (q.type === "single" || q.type === "multi") && Array.isArray(q.options)) {
      optionOrder[id] = shuffleArray(q.options.map((_, i) => i));
    }
  }

  state.attempt = {
    version: ENGINE_VERSION,
    startedAt: Date.now(),
    questionIds,
    optionOrder,
  };
  state.current = 0;
  state.answers = {};
  state.selfRatings = {};
  state.submitted = false;
  state.runOutputs = {};
  persist();
}

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ──────────────────────────────────────────
// localStorage persistence
// ──────────────────────────────────────────
function storageKey() { return STORAGE_PREFIX + sectionSlug; }

function persist() {
  const payload = {
    version: ENGINE_VERSION,
    attempt: state.attempt,
    answers: state.answers,
    selfRatings: state.selfRatings,
    current: state.current,
    submitted: state.submitted,
    updated_at: Date.now(),
  };
  try { localStorage.setItem(storageKey(), JSON.stringify(payload)); } catch (e) { /* quota */ }
}

function restore() {
  try {
    const raw = localStorage.getItem(storageKey());
    if (!raw) return;
    const payload = JSON.parse(raw);
    if (!payload || payload.version !== ENGINE_VERSION) return; // schema mismatch → fresh attempt
    state.attempt = payload.attempt || null;
    state.answers = payload.answers || {};
    state.selfRatings = payload.selfRatings || {};
    state.current = payload.current || 0;
    state.submitted = !!payload.submitted;
  } catch (e) { /* corrupt — ignore */ }
}

function clearProgress() {
  try { localStorage.removeItem(storageKey()); } catch (e) {}
  state.attempt = null;
  state.answers = {};
  state.selfRatings = {};
  state.current = 0;
  state.submitted = false;
  state.runOutputs = {};
}

// ──────────────────────────────────────────
// Rendering — Quiz screen
// ──────────────────────────────────────────
function renderQuiz() {
  const root = document.getElementById("eval-root");
  const total = state.questions.length;
  const q = state.questions[state.current];
  const answeredCount = countAnswered();
  const poolSize = state.bank.length;

  root.innerHTML = `
    <div class="quiz-topbar">
      <div>
        <div class="quiz-section-label">${escapeHTML(state.section.title)}</div>
        <div class="quiz-meta">${escapeHTML(state.section.tagline)} · randomized from a pool of <strong>${poolSize}</strong></div>
      </div>
      <div class="quiz-meta">
        Question <strong>${state.current + 1}</strong> of <strong>${total}</strong> ·
        <strong>${answeredCount}</strong> answered
      </div>
    </div>

    <div class="quiz-progress">
      <div class="quiz-progress-bar" style="width:${((state.current + 1) / total * 100).toFixed(1)}%"></div>
    </div>

    <article class="q-card" id="q-card"></article>

    <div class="q-nav">
      <div class="q-nav-side">
        <button class="q-btn" id="q-prev" ${state.current === 0 ? "disabled" : ""}>← Previous</button>
      </div>
      <div class="q-nav-side">
        <button class="q-btn q-btn-danger" id="q-reset">Reset (new attempt)</button>
        <button class="q-btn q-btn-primary" id="q-submit">Submit &amp; Score</button>
        <button class="q-btn" id="q-next" ${state.current === total - 1 ? "disabled" : ""}>Next →</button>
      </div>
    </div>

    <div class="q-jump" id="q-jump"></div>
  `;

  renderQuestion(q);
  renderJump();

  document.getElementById("q-prev").addEventListener("click", () => navigate(state.current - 1));
  document.getElementById("q-next").addEventListener("click", () => navigate(state.current + 1));
  document.getElementById("q-submit").addEventListener("click", confirmSubmit);
  document.getElementById("q-reset").addEventListener("click", confirmReset);
}

function renderQuestion(q) {
  const root = document.getElementById("q-card");
  const tags = `
    <div class="q-tag-row">
      <span class="q-pill q-type-${q.type}">${q.type === "single" ? "Single choice" : q.type === "multi" ? "Multi-select" : q.type === "code" ? "Code" : "Open answer"}</span>
      <span class="q-pill q-diff-${q.difficulty}">${q.difficulty}</span>
      <span class="q-pill">${escapeHTML(q.topic)}</span>
    </div>
  `;

  let body = "";
  if (q.type === "single") {
    body = renderSingleChoice(q);
  } else if (q.type === "multi") {
    body = renderMultiChoice(q);
  } else if (q.type === "code") {
    body = renderCode(q);
  } else if (q.type === "open") {
    body = renderOpen(q);
  }

  root.innerHTML = `
    ${tags}
    <div class="q-prompt">${formatPrompt(q.prompt)}</div>
    ${body}
  `;

  attachQuestionHandlers(q);
}

function renderSingleChoice(q) {
  const order = state.attempt.optionOrder[q.id] || q.options.map((_, i) => i);
  const selected = state.answers[q.id];
  return `
    <div class="q-options">
      ${order.map((origIdx) => `
        <label class="q-option ${selected === origIdx ? "selected" : ""}" data-idx="${origIdx}">
          <input type="radio" name="opt-${q.id}" value="${origIdx}" ${selected === origIdx ? "checked" : ""} />
          <span class="q-option-text">${formatInline(q.options[origIdx])}</span>
        </label>
      `).join("")}
    </div>
  `;
}

function renderMultiChoice(q) {
  const order = state.attempt.optionOrder[q.id] || q.options.map((_, i) => i);
  const selected = Array.isArray(state.answers[q.id]) ? state.answers[q.id] : [];
  return `
    <div class="q-options">
      ${order.map((origIdx) => `
        <label class="q-option ${selected.includes(origIdx) ? "selected" : ""}" data-idx="${origIdx}">
          <input type="checkbox" name="opt-${q.id}" value="${origIdx}" ${selected.includes(origIdx) ? "checked" : ""} />
          <span class="q-option-text">${formatInline(q.options[origIdx])}</span>
        </label>
      `).join("")}
    </div>
  `;
}

function renderCode(q) {
  const stored = state.answers[q.id];
  const value = typeof stored === "string" ? stored : (q.starter || "");
  const schemaPanel = q.schema ? `
    <details class="q-code-schema">
      <summary>Schema &amp; sample data (preloaded into PostgreSQL · PGlite)</summary>
      <pre><code>${escapeHTML(q.schema)}</code></pre>
    </details>
  ` : "";
  const canRun = (q.language === "sql" && q.schema) || (q.language === "python");
  const output = state.runOutputs[q.id];
  return `
    ${schemaPanel}
    <textarea class="q-code-area" id="q-code-${q.id}" spellcheck="false" placeholder="Write your ${q.language || "code"} here…">${escapeHTML(value)}</textarea>
    ${canRun ? `
      <div class="q-run-row">
        <button class="q-btn q-btn-run" id="q-run-${q.id}">▶ Run ${q.language === "sql" ? "SQL" : "Python"}</button>
        <button class="q-btn" id="q-reset-code-${q.id}">↺ Reset to starter</button>
        <span class="q-run-status" id="q-run-status-${q.id}"></span>
      </div>
      <div class="q-run-output ${output ? "has-output q-output-" + output.kind : ""}" id="q-run-output-${q.id}">
        ${output ? output.html : ""}
      </div>
    ` : ""}
  `;
}

function renderOpen(q) {
  const value = typeof state.answers[q.id] === "string" ? state.answers[q.id] : "";
  return `
    <textarea class="q-open-area" id="q-open-${q.id}" placeholder="Type your answer here…">${escapeHTML(value)}</textarea>
  `;
}

function attachQuestionHandlers(q) {
  if (q.type === "single") {
    const labels = document.querySelectorAll(`.q-option[data-idx]`);
    document.querySelectorAll(`input[name="opt-${q.id}"]`).forEach(input => {
      input.addEventListener("change", () => {
        const idx = parseInt(input.value, 10);
        state.answers[q.id] = idx;
        persist();
        labels.forEach(l => l.classList.toggle("selected", parseInt(l.getAttribute("data-idx"), 10) === idx));
        updateJumpStatus();
      });
    });
  } else if (q.type === "multi") {
    const labels = document.querySelectorAll(`.q-option[data-idx]`);
    document.querySelectorAll(`input[name="opt-${q.id}"]`).forEach(input => {
      input.addEventListener("change", () => {
        const inputs = document.querySelectorAll(`input[name="opt-${q.id}"]`);
        const current = [];
        inputs.forEach(inp => { if (inp.checked) current.push(parseInt(inp.value, 10)); });
        current.sort((a,b) => a - b);
        state.answers[q.id] = current;
        persist();
        labels.forEach(l => {
          const i = parseInt(l.getAttribute("data-idx"), 10);
          l.classList.toggle("selected", current.includes(i));
        });
        updateJumpStatus();
      });
    });
  } else if (q.type === "code") {
    const ta = document.getElementById(`q-code-${q.id}`);
    ta.addEventListener("input", () => {
      state.answers[q.id] = ta.value;
      persist();
      updateJumpStatus();
    });
    ta.addEventListener("keydown", (e) => {
      if (e.key === "Tab") {
        e.preventDefault();
        const start = ta.selectionStart, end = ta.selectionEnd;
        ta.value = ta.value.substring(0, start) + "  " + ta.value.substring(end);
        ta.selectionStart = ta.selectionEnd = start + 2;
        state.answers[q.id] = ta.value;
        persist();
      }
    });
    const runBtn = document.getElementById(`q-run-${q.id}`);
    if (runBtn) runBtn.addEventListener("click", () => runCode(q));
    const resetBtn = document.getElementById(`q-reset-code-${q.id}`);
    if (resetBtn) resetBtn.addEventListener("click", () => {
      ta.value = q.starter || "";
      state.answers[q.id] = ta.value;
      persist();
      updateJumpStatus();
    });
  } else if (q.type === "open") {
    const ta = document.getElementById(`q-open-${q.id}`);
    ta.addEventListener("input", () => {
      state.answers[q.id] = ta.value;
      persist();
      updateJumpStatus();
    });
  }
}

function renderJump() {
  const jump = document.getElementById("q-jump");
  jump.innerHTML = state.questions.map((q, i) => {
    const answered = isAnswered(state.answers[q.id]);
    const cls = i === state.current ? "current" : answered ? "answered" : "";
    return `<button class="${cls}" data-idx="${i}" aria-label="Jump to question ${i+1}">${i+1}</button>`;
  }).join("");
  jump.querySelectorAll("button").forEach(btn => {
    btn.addEventListener("click", () => navigate(parseInt(btn.getAttribute("data-idx"), 10)));
  });
}

function updateJumpStatus() {
  const jump = document.getElementById("q-jump");
  if (jump) renderJump();
  const meta = document.querySelector(".quiz-topbar .quiz-meta:last-child");
  if (meta) {
    const answeredCount = countAnswered();
    meta.innerHTML = `Question <strong>${state.current + 1}</strong> of <strong>${state.questions.length}</strong> · <strong>${answeredCount}</strong> answered`;
  }
}

function navigate(idx) {
  if (idx < 0 || idx >= state.questions.length) return;
  state.current = idx;
  persist();
  renderQuiz();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function confirmSubmit() {
  const answeredCount = countAnswered();
  const total = state.questions.length;
  const skipped = total - answeredCount;
  let msg = "Submit and see your score?";
  if (skipped > 0) msg = `You have ${skipped} unanswered question${skipped === 1 ? "" : "s"}. Submit anyway?`;
  if (!confirm(msg)) return;
  state.submitted = true;
  persist();
  renderResults();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function confirmReset() {
  if (!confirm("Start a fresh attempt? Your current answers will be cleared and a new random set of questions will be drawn.")) return;
  clearProgress();
  prepareAttempt();
  renderQuiz();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function countAnswered() {
  return Object.keys(state.answers).filter(k => isAnswered(state.answers[k])).length;
}

// ──────────────────────────────────────────
// Code execution — PGlite (Postgres-WASM) for SQL, Pyodide for Python
// ──────────────────────────────────────────
async function runCode(q) {
  const ta = document.getElementById(`q-code-${q.id}`);
  const src = ta ? ta.value : (state.answers[q.id] || "");
  state.answers[q.id] = src; // ensure persisted before run
  persist();

  const statusEl = document.getElementById(`q-run-status-${q.id}`);
  const outputEl = document.getElementById(`q-run-output-${q.id}`);

  if (q.language === "sql") {
    if (!q.schema) { renderRunOutput(q, "error", "<em>No schema attached to this question — can't run.</em>"); return; }
    setRunStatus(statusEl, "Loading PostgreSQL (PGlite, ~14 MB on first run, cached afterwards)…");
    try {
      await ensurePglite();
      setRunStatus(statusEl, "Running…");
      const result = await runSQL(q.schema, src);
      const html = renderSqlResult(result, q.expected_rows);
      const kind = inferSqlKind(result, q.expected_rows);
      renderRunOutput(q, kind, html);
      setRunStatus(statusEl, kind === "pass" ? "✓ Output matches expected" : kind === "fail" ? "✗ Output differs from expected" : "Done", kind);
    } catch (err) {
      renderRunOutput(q, "error", `<pre class="q-error">${escapeHTML(String(err.message || err))}</pre>`);
      setRunStatus(statusEl, "Error", "error");
    }
  } else if (q.language === "python") {
    setRunStatus(statusEl, "Loading Python (~6 MB on first run)…");
    try {
      await ensurePyodide();
      // If the user's code OR the hidden test harness imports pandas/numpy,
      // load those packages before running. Pyodide doesn't ship them by
      // default — without this the user sees ModuleNotFoundError on import.
      const needsPandas = PANDAS_IMPORT_RX.test(src) || PANDAS_IMPORT_RX.test(q.tests || "");
      if (needsPandas && !runtimes.pyodidePandasLoaded) {
        setRunStatus(statusEl, "Loading pandas + numpy (~12 MB on first run, cached)…");
        await ensurePandas();
      }
      setRunStatus(statusEl, "Running…");
      const result = await runPython(src, q.tests);
      renderRunOutput(q, result.kind, result.html);
      setRunStatus(statusEl,
        result.kind === "pass" ? "✓ All tests passed" :
        result.kind === "fail" ? "✗ Tests failed" :
        result.kind === "error" ? "Error" : "Done",
        result.kind
      );
    } catch (err) {
      renderRunOutput(q, "error", `<pre class="q-error">${escapeHTML(String(err.message || err))}</pre>`);
      setRunStatus(statusEl, "Error", "error");
    }
  }
}

function renderRunOutput(q, kind, html) {
  state.runOutputs[q.id] = { kind, html };
  const el = document.getElementById(`q-run-output-${q.id}`);
  if (el) {
    el.className = `q-run-output has-output q-output-${kind}`;
    el.innerHTML = html;
  }
}

function setRunStatus(el, text, kind) {
  if (!el) return;
  el.textContent = text;
  el.className = `q-run-status${kind ? " q-status-" + kind : ""}`;
}

// ── PGlite (Postgres-WASM) ──
async function ensurePglite() {
  if (runtimes.pglite) return runtimes.pglite;
  if (runtimes.loadingPglite) return runtimes.loadingPglite;
  runtimes.loadingPglite = (async () => {
    // Dynamic import of the vendored PGlite ES module. quiz-engine.js is
    // loaded as a classic script, so its dynamic import() resolves the
    // specifier relative to the SCRIPT's URL (/interview.app/evaluate/js/
    // quiz-engine.js) — NOT the document URL. So we need ../../ to climb
    // out of evaluate/js/ to reach /interview.app/vendor/pglite/.
    const mod = await import("../../vendor/pglite/index.js");
    const PGlite = mod.PGlite || mod.default?.PGlite || mod.default;
    if (!PGlite) throw new Error("PGlite module did not expose a PGlite class");
    runtimes.pglite = await PGlite.create();
    return runtimes.pglite;
  })();
  return runtimes.loadingPglite;
}

// Best-effort SQL statement splitter. Skips ;'s inside quoted strings,
// line comments, block comments, and parens. Adapted from the existing
// /interview.app/js/engines/pglite-engine.js — same shape, no PL/pgSQL.
function splitStatements(sql) {
  const out = [];
  let depth = 0;
  let cur = [];
  let inSingle = false, inDouble = false, inLine = false, inBlock = false;
  for (let i = 0; i < sql.length; i++) {
    const c = sql[i], n = sql[i + 1];
    if (inLine) { cur.push(c); if (c === "\n") inLine = false; continue; }
    if (inBlock) { cur.push(c); if (c === "*" && n === "/") { cur.push(n); i++; inBlock = false; } continue; }
    if (inSingle) { cur.push(c); if (c === "'" && n === "'") { cur.push(n); i++; } else if (c === "'") inSingle = false; continue; }
    if (inDouble) { cur.push(c); if (c === '"' && n === '"') { cur.push(n); i++; } else if (c === '"') inDouble = false; continue; }
    if (c === "-" && n === "-") { cur.push(c); inLine = true; continue; }
    if (c === "/" && n === "*") { cur.push(c); inBlock = true; continue; }
    if (c === "'") { cur.push(c); inSingle = true; continue; }
    if (c === '"') { cur.push(c); inDouble = true; continue; }
    if (c === "(") depth++;
    else if (c === ")") depth--;
    if (c === ";" && depth === 0) { out.push(cur.join("")); cur = []; continue; }
    cur.push(c);
  }
  if (cur.length) out.push(cur.join(""));
  return out;
}

// PGlite returns JS Date objects for DATE / TIMESTAMP columns; render them
// as ISO strings to match how the renderer treats the rest of the values.
function pgliteNormalize(v) {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) {
    // Drop the trailing 'Z' and microseconds for a stable string form.
    return v.toISOString().replace("T", " ").replace(/\.\d+Z$/, "");
  }
  return v;
}

async function runSQL(schema, userSql) {
  const db = await ensurePglite();
  // Each Run is isolated: drop and recreate the public schema, then load
  // the question's CREATE/INSERT, then execute the user's query.
  await db.exec("DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;");
  try {
    await db.exec(schema);
  } catch (e) {
    throw new Error("Schema setup failed: " + e.message);
  }
  // Split user SQL into statements and execute one-by-one; collect result
  // sets in the same {columns, values} shape that sql.js returned, so the
  // existing renderer keeps working unchanged.
  const stmts = splitStatements(userSql);
  const results = [];
  for (const s of stmts) {
    const trimmed = s.trim();
    if (!trimmed) continue;
    const res = await db.query(trimmed);
    if (res.fields && res.fields.length && res.rows && res.rows.length !== undefined) {
      results.push({
        columns: res.fields.map(f => f.name),
        values: res.rows.map(row => res.fields.map(f => pgliteNormalize(row[f.name]))),
      });
    }
  }
  return results;
}

function renderSqlResult(results, expected) {
  if (!results || results.length === 0) {
    return `<div class="q-output-empty">Query ran successfully but returned no rows.</div>`;
  }
  // Use the LAST result set (in case schema setup mixed in)
  const r = results[results.length - 1];
  const headerRow = `<tr>${r.columns.map(c => `<th>${escapeHTML(String(c))}</th>`).join("")}</tr>`;
  const bodyRows = r.values.map(row =>
    `<tr>${row.map(v => `<td>${v === null ? '<em>NULL</em>' : escapeHTML(String(v))}</td>`).join("")}</tr>`
  ).join("");
  let extra = "";
  if (Array.isArray(expected)) {
    const match = compareSqlResultToExpected(r, expected);
    extra = match
      ? `<div class="q-output-banner q-banner-pass">✓ ${r.values.length} row${r.values.length === 1 ? "" : "s"} — matches expected output.</div>`
      : `<div class="q-output-banner q-banner-fail">✗ Output does not match expected. Compare your result to the model answer in the review screen. ${renderExpectedTable(expected)}</div>`;
  } else {
    extra = `<div class="q-output-banner">Returned ${r.values.length} row${r.values.length === 1 ? "" : "s"} × ${r.columns.length} column${r.columns.length === 1 ? "" : "s"}.</div>`;
  }
  return `${extra}<div class="q-output-table-wrap"><table class="q-output-table">${headerRow}${bodyRows}</table></div>`;
}

function renderExpectedTable(expected) {
  if (!expected.length) return "";
  const cols = Object.keys(expected[0]);
  const header = `<tr>${cols.map(c => `<th>${escapeHTML(c)}</th>`).join("")}</tr>`;
  const rows = expected.map(r =>
    `<tr>${cols.map(c => `<td>${r[c] === null || r[c] === undefined ? '<em>NULL</em>' : escapeHTML(String(r[c]))}</td>`).join("")}</tr>`
  ).join("");
  return `<details class="q-expected"><summary>Show expected output</summary><table class="q-output-table">${header}${rows}</table></details>`;
}

function compareSqlResultToExpected(result, expected) {
  if (!Array.isArray(expected)) return null;
  if (expected.length !== result.values.length) return false;
  if (expected.length === 0) return true;
  const cols = Object.keys(expected[0]);
  // Map result columns case-insensitively
  const colIdx = {};
  for (const c of cols) {
    const idx = result.columns.findIndex(rc => String(rc).toLowerCase() === c.toLowerCase());
    if (idx < 0) return false;
    colIdx[c] = idx;
  }
  // Order-insensitive comparison: sort both sides by JSON-string of the row
  const norm = (val) => val === null || val === undefined ? null : (typeof val === "number" ? val : String(val).trim());
  const userRows = result.values.map(row => cols.map(c => norm(row[colIdx[c]])));
  const expRows = expected.map(r => cols.map(c => norm(r[c])));
  const keyer = (row) => JSON.stringify(row);
  userRows.sort((a,b) => keyer(a).localeCompare(keyer(b)));
  expRows.sort((a,b) => keyer(a).localeCompare(keyer(b)));
  for (let i = 0; i < userRows.length; i++) {
    for (let j = 0; j < cols.length; j++) {
      const u = userRows[i][j], e = expRows[i][j];
      // Numeric-tolerant compare
      if (u === e) continue;
      const un = typeof u === "string" && /^-?\d+(\.\d+)?$/.test(u) ? parseFloat(u) : u;
      const en = typeof e === "string" && /^-?\d+(\.\d+)?$/.test(e) ? parseFloat(e) : e;
      if (un === en) continue;
      if (typeof un === "number" && typeof en === "number" && Math.abs(un - en) < 1e-9) continue;
      return false;
    }
  }
  return true;
}

function inferSqlKind(results, expected) {
  if (!Array.isArray(expected)) return "ok";
  if (!results || results.length === 0) return expected.length === 0 ? "pass" : "fail";
  const r = results[results.length - 1];
  return compareSqlResultToExpected(r, expected) ? "pass" : "fail";
}

// ── Pyodide ──
async function ensurePyodide() {
  if (runtimes.pyodide) return runtimes.pyodide;
  if (runtimes.loadingPyodide) return runtimes.loadingPyodide;
  runtimes.loadingPyodide = (async () => {
    if (typeof window.loadPyodide !== "function") {
      throw new Error("Pyodide failed to load — check your network or ad blocker.");
    }
    runtimes.pyodide = await window.loadPyodide({
      indexURL: "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/",
    });
    return runtimes.pyodide;
  })();
  return runtimes.loadingPyodide;
}

// Lazy-load numpy + pandas into Pyodide. Pyodide ships without them; user
// code that imports pandas/numpy throws ModuleNotFoundError unless we call
// loadPackage first. ~12 MB combined, cached by the browser after first load.
async function ensurePandas() {
  if (runtimes.pyodidePandasLoaded) return;
  if (runtimes.loadingPandas) return runtimes.loadingPandas;
  runtimes.loadingPandas = (async () => {
    const py = await ensurePyodide();
    await py.loadPackage(["numpy", "pandas"]);
    // Silence pandas's pyarrow-deprecation and various FutureWarnings so they
    // don't pollute the test output panel with red stderr lines.
    await py.runPythonAsync(
      "import warnings\n" +
      "warnings.filterwarnings('ignore', category=DeprecationWarning)\n" +
      "warnings.filterwarnings('ignore', category=FutureWarning)\n"
    );
    runtimes.pyodidePandasLoaded = true;
  })();
  return runtimes.loadingPandas;
}

async function runPython(userCode, tests) {
  const py = await ensurePyodide();
  let stdoutBuf = "", stderrBuf = "";
  py.setStdout({ batched: (s) => { stdoutBuf += s + "\n"; } });
  py.setStderr({ batched: (s) => { stderrBuf += s + "\n"; } });
  try {
    await py.runPythonAsync(userCode);
  } catch (e) {
    return {
      kind: "error",
      html: `${stdoutBuf ? `<pre class="q-stdout">${escapeHTML(stdoutBuf)}</pre>` : ""}<pre class="q-error">${escapeHTML(String(e.message || e))}</pre>`,
    };
  }
  if (!tests || !tests.trim()) {
    return {
      kind: stdoutBuf ? "ok" : "ok",
      html: stdoutBuf ? `<pre class="q-stdout">${escapeHTML(stdoutBuf)}</pre>` : `<div class="q-output-empty">Code ran successfully (no output).</div>`,
    };
  }
  // Run tests against the user-defined names
  let testStdout = "", testErr = null;
  py.setStdout({ batched: (s) => { testStdout += s + "\n"; } });
  py.setStderr({ batched: (s) => { testStdout += s + "\n"; } });
  try {
    await py.runPythonAsync(tests);
  } catch (e) {
    testErr = e;
  }
  const combined = (stdoutBuf ? `<pre class="q-stdout">${escapeHTML(stdoutBuf)}</pre>` : "") +
                   (testStdout ? `<pre class="q-stdout q-test-out">${escapeHTML(testStdout)}</pre>` : "");
  if (testErr) {
    return { kind: "fail", html: `${combined}<pre class="q-error">${escapeHTML(String(testErr.message || testErr))}</pre>` };
  }
  const passed = /\bPASS\b/.test(testStdout);
  return { kind: passed ? "pass" : "ok", html: combined };
}

// ──────────────────────────────────────────
// Results screen
// ──────────────────────────────────────────
function renderResults() {
  const root = document.getElementById("eval-root");
  const { score, max, autoCorrect, autoTotal, selfCorrect, selfTotal } = computeScore();
  const pct = max > 0 ? Math.round((score / max) * 100) : 0;
  const passing = state.section.passing_score || 70;
  const verdict = pct >= passing
    ? `Passing mark — you scored at or above the ${passing}% bar.`
    : `Below the ${passing}% bar — review the questions you missed and the open-ended model answers, then retake.`;

  root.innerHTML = `
    <div class="results-hero">
      <div class="results-eyebrow">Skill Check · ${escapeHTML(state.section.title)}</div>
      <div class="results-score">${pct}<span>%</span></div>
      <div class="results-verdict">${verdict}</div>
      <div class="results-breakdown">
        <div class="results-stat">
          <div class="results-stat-label">Auto-graded</div>
          <div class="results-stat-value">${autoCorrect} / ${autoTotal}</div>
        </div>
        <div class="results-stat">
          <div class="results-stat-label">Self-rated</div>
          <div class="results-stat-value">${selfCorrect.toFixed(1)} / ${selfTotal}</div>
        </div>
        <div class="results-stat">
          <div class="results-stat-label">Weighted score</div>
          <div class="results-stat-value">${score.toFixed(1)} / ${max}</div>
        </div>
        <div class="results-stat">
          <div class="results-stat-label">Pass mark</div>
          <div class="results-stat-value">${passing}%</div>
        </div>
      </div>
    </div>

    <div class="review-section">
      <h2>Question Review</h2>
      <div id="review-list"></div>
    </div>

    <div class="results-actions">
      <a href="./" class="q-btn">← Pick another section</a>
      <button class="q-btn q-btn-primary" id="results-retake">Retake with new questions</button>
    </div>
  `;

  const list = document.getElementById("review-list");
  state.questions.forEach((q, idx) => {
    list.appendChild(renderReviewItem(q, idx));
  });

  document.getElementById("results-retake").addEventListener("click", () => {
    if (!confirm("Start a fresh attempt with a new random set of questions?")) return;
    clearProgress();
    prepareAttempt();
    renderQuiz();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}

function renderReviewItem(q, idx) {
  const item = document.createElement("article");
  const userAns = state.answers[q.id];

  let cls = "review-item";
  let body = `
    <div class="q-tag-row">
      <span class="q-pill">Q${idx + 1}</span>
      <span class="q-pill q-type-${q.type}">${q.type}</span>
      <span class="q-pill q-diff-${q.difficulty}">${q.difficulty}</span>
      <span class="q-pill">${escapeHTML(q.topic)}</span>
    </div>
    <div class="review-q">${formatPrompt(q.prompt)}</div>
  `;

  if (q.type === "single" || q.type === "multi") {
    const correct = gradeObjective(q, userAns);
    cls += correct ? " correct" : " incorrect";

    const fmtIndices = (val) => {
      if (val === undefined || val === null) return "<em>No answer</em>";
      const arr = Array.isArray(val) ? val : [val];
      if (arr.length === 0) return "<em>No answer</em>";
      return arr.map(i => q.options[i] !== undefined ? formatInline(q.options[i]) : "").filter(Boolean).join("<br>");
    };
    const correctArr = Array.isArray(q.answer) ? q.answer : [q.answer];

    body += `
      <div class="review-answer-label">Your answer</div>
      <div class="review-your-answer">${fmtIndices(userAns)}</div>
      <div class="review-answer-label">Correct answer</div>
      <div class="review-your-answer">${correctArr.map(i => formatInline(q.options[i])).join("<br>")}</div>
      ${q.explanation ? `<div class="review-explanation">${formatPrompt(q.explanation)}</div>` : ""}
    `;
  } else if (q.type === "code" || q.type === "open") {
    cls += " self-rated";
    const userVal = typeof userAns === "string" ? userAns.trim() : "";
    body += `
      <div class="review-answer-label">Your answer</div>
      <div class="review-your-answer ${q.type === "code" ? "code" : ""}">${userVal ? escapeHTML(userVal) : "<em>No answer</em>"}</div>
      <div class="review-answer-label">Model answer</div>
      <div class="review-model-answer ${q.type === "code" ? "code" : ""}">${escapeHTML(q.model_answer || "")}</div>
      ${q.key_points && q.key_points.length ? `
        <div class="review-answer-label">Key points to look for</div>
        <ul class="review-keypoints">${q.key_points.map(kp => `<li>${formatInline(kp)}</li>`).join("")}</ul>
      ` : ""}
      <div class="review-self-rate" data-qid="${q.id}">
        <span class="review-self-rate-label">Self-rate</span>
        ${[
          { v: 0, label: "Missed it" },
          { v: 1, label: "Partial" },
          { v: 2, label: "Got it" },
        ].map(r => `<button data-rate="${r.v}" class="${state.selfRatings[q.id] === r.v ? "selected" : ""}">${r.label}</button>`).join("")}
      </div>
    `;
  }

  item.className = cls;
  item.innerHTML = body;

  item.querySelectorAll(".review-self-rate button").forEach(btn => {
    btn.addEventListener("click", () => {
      const qid = btn.parentElement.getAttribute("data-qid");
      const rate = parseInt(btn.getAttribute("data-rate"), 10);
      state.selfRatings[qid] = rate;
      persist();
      renderResults();
    });
  });

  return item;
}

// ──────────────────────────────────────────
// Grading
// ──────────────────────────────────────────
function gradeObjective(q, userAns) {
  if (userAns === undefined || userAns === null) return false;
  if (q.type === "single") {
    return userAns === q.answer;
  }
  if (q.type === "multi") {
    const user = Array.isArray(userAns) ? [...userAns].sort((a,b) => a-b) : [];
    const correct = [...q.answer].sort((a,b) => a-b);
    if (user.length !== correct.length) return false;
    return user.every((v, i) => v === correct[i]);
  }
  return false;
}

function computeScore() {
  let autoCorrect = 0, autoTotal = 0;
  let selfPoints = 0, selfTotal = 0;
  let total = 0;

  state.questions.forEach(q => {
    if (q.type === "single" || q.type === "multi") {
      autoTotal += 1;
      if (gradeObjective(q, state.answers[q.id])) {
        autoCorrect += 1;
        total += 1;
      }
    } else {
      selfTotal += 1;
      const r = state.selfRatings[q.id];
      if (r === 2) { selfPoints += 1.0; total += 1.0; }
      else if (r === 1) { selfPoints += 0.5; total += 0.5; }
    }
  });

  return { score: total, max: state.questions.length, autoCorrect, autoTotal, selfCorrect: selfPoints, selfTotal };
}

// ──────────────────────────────────────────
// Utils
// ──────────────────────────────────────────
function isAnswered(val) {
  if (val === undefined || val === null) return false;
  if (Array.isArray(val)) return val.length > 0;
  if (typeof val === "string") return val.trim().length > 0;
  return true;
}

function escapeHTML(str) {
  if (str === undefined || str === null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatInline(str) {
  const esc = escapeHTML(str);
  return esc.replace(/`([^`]+)`/g, "<code>$1</code>");
}

function formatPrompt(str) {
  if (!str) return "";
  const parts = [];
  const fence = /```(\w*)\n([\s\S]*?)```/g;
  let lastIdx = 0;
  let m;
  while ((m = fence.exec(str)) !== null) {
    if (m.index > lastIdx) parts.push({ kind: "text", val: str.slice(lastIdx, m.index) });
    parts.push({ kind: "code", val: m[2], lang: m[1] });
    lastIdx = m.index + m[0].length;
  }
  if (lastIdx < str.length) parts.push({ kind: "text", val: str.slice(lastIdx) });

  return parts.map(p => {
    if (p.kind === "code") {
      return `<pre><code>${escapeHTML(p.val)}</code></pre>`;
    } else {
      return formatInline(p.val).replace(/\n/g, "<br>");
    }
  }).join("");
}

function renderError(msg) {
  const root = document.getElementById("eval-root");
  root.innerHTML = `
    <div class="q-card" style="text-align:center;padding:48px;">
      <p style="font-family:var(--font-display);font-size:24px;color:var(--color-rust);margin-bottom:12px;">⚠ ${escapeHTML(msg)}</p>
      <p style="color:var(--color-muted);"><a href="./" class="q-btn">← Back to start</a></p>
    </div>
  `;
}

// Boot
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
