// ════════════════════════════════════════════════════════════
// Python Playground — Pyodide (Python-WASM) in-browser
// ════════════════════════════════════════════════════════════
import { generateDemo } from "./demo-gen.js";

const DATA_BASE = "../interview/data";
const QUESTIONS_URL = `${DATA_BASE}/questions.json`;
const LS_LAST_Q = "pg.py.lastQ";
// Per-question editor key — switching questions no longer leaks the previous
// question's solution into the editor.
const LS_EDITOR = (qid) => `pg.py.editor.${qid || "default"}`;

const $ = (sel) => document.querySelector(sel);

const state = {
  pyodide: null,
  ready: false,
  loadingPandas: false,
  pandasLoaded: false,
  questions: [],
  pyQuestions: [],
  currentQ: null,
};

// Pre-imported names live in user globals so they don't need re-import.
const PRELUDE = `
import sys, io, json, math, re, random, itertools, functools
from collections import Counter, defaultdict, deque, OrderedDict
import heapq

# Capture stdout/stderr for the run
__stdout = io.StringIO()
__stderr = io.StringIO()
`;

// Buttons that need Pyodide before they're useful.
const ENGINE_DEPENDENT_IDS = ["pg-run", "pg-reset-env"];

function setEngineReady(ready) {
  state.ready = ready;
  for (const id of ENGINE_DEPENDENT_IDS) {
    const el = document.getElementById(id);
    if (el) el.disabled = !ready;
  }
}

// ─── Status ───
function setStatus(msg, kind = "") {
  const el = $("#pg-status");
  if (!el) return;
  el.textContent = msg;
  el.className = "pg-status" + (kind ? " is-" + kind : "");
}

function appendOutput(text, cls = "") {
  const body = $("#pg-results-body");
  if (body.querySelector(".pg-empty")) body.innerHTML = "";
  const span = document.createElement("span");
  if (cls) span.className = cls;
  span.textContent = text;
  body.appendChild(span);
  body.scrollTop = body.scrollHeight;
}

function clearOutput() {
  $("#pg-results-body").innerHTML = `<div class="pg-empty">Run code to see output.</div>`;
  $("#pg-results-stats").textContent = "";
}

// ─── Pyodide bootstrap ───
async function initPyodide() {
  setStatus("Loading Pyodide (~6 MB WASM)…");
  if (typeof window.loadPyodide !== "function") {
    throw new Error("Pyodide failed to load — check your network or ad blocker.");
  }
  state.pyodide = await window.loadPyodide({
    indexURL: "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/",
    stdout: (s) => appendOutput(s + "\n"),
    stderr: (s) => appendOutput(s + "\n", "pg-stderr"),
  });
  await state.pyodide.runPythonAsync(PRELUDE);
  setEngineReady(true);
  setStatus("Ready · Python " + state.pyodide.runPython("import sys; sys.version.split()[0]"), "ok");
}

async function ensurePandas() {
  if (state.pandasLoaded || !$("#pg-load-pandas").checked) return;
  if (state.loadingPandas) return;
  state.loadingPandas = true;
  setStatus("Loading pandas + numpy (~10 MB)…");
  try {
    await state.pyodide.loadPackage(["numpy", "pandas"]);
    await state.pyodide.runPythonAsync("import numpy as np\nimport pandas as pd");
    state.pandasLoaded = true;
    setStatus("Ready · pandas + numpy loaded", "ok");
  } catch (e) {
    setStatus("Failed to load pandas: " + e.message, "error");
    $("#pg-load-pandas").checked = false;
  } finally {
    state.loadingPandas = false;
  }
}

// ─── Run user code ───
async function runCode() {
  if (!state.ready) {
    setStatus("Engine not ready yet", "error");
    return;
  }
  const src = $("#pg-editor").value;
  if (!src.trim()) {
    setStatus("Editor is empty", "error");
    return;
  }
  if (state.currentQ) localStorage.setItem(LS_EDITOR(state.currentQ.id), src);

  await ensurePandas();

  clearOutput();
  $("#pg-results-body").innerHTML = "";

  const t0 = performance.now();
  setStatus("Running…");
  try {
    // Evaluate the whole block. If the last statement is an expression we
    // print its repr (REPL-style).
    state.pyodide.setStdout({ batched: (s) => appendOutput(s + "\n") });
    state.pyodide.setStderr({ batched: (s) => appendOutput(s + "\n", "pg-stderr") });

    // Wrap user code: try eval-as-expression on the last statement
    const wrapper = `
import ast, sys
__src = ${JSON.stringify(src)}
__tree = ast.parse(__src, mode="exec")
__last_value = None
if __tree.body and isinstance(__tree.body[-1], ast.Expr):
    __last = __tree.body.pop()
    exec(compile(__tree, "<editor>", "exec"), globals())
    __last_value = eval(compile(ast.Expression(__last.value), "<editor>", "eval"), globals())
else:
    exec(compile(__tree, "<editor>", "exec"), globals())
__last_value
`;
    const ret = await state.pyodide.runPythonAsync(wrapper);
    if (ret !== undefined && ret !== null) {
      const repr = state.pyodide.runPython("repr(__last_value)");
      appendOutput(repr + "\n", "pg-return");
    }
    const ms = (performance.now() - t0).toFixed(1);
    $("#pg-results-stats").textContent = `${ms} ms`;
    // If the body is still empty, show a friendly hint instead of a black void.
    const body = $("#pg-results-body");
    if (!body.textContent.trim()) {
      body.innerHTML = `<span class="pg-empty">No output. Call your function or use print() to see results — e.g. <code>print(subarraySum([1,1,1], 2))</code></span>`;
    }
    setStatus(`OK · ${ms} ms`, "ok");
  } catch (err) {
    appendOutput(formatPyError(err), "pg-trace");
    setStatus("Error", "error");
  }
}

function formatPyError(err) {
  const msg = err?.message || String(err);
  // Pyodide wraps Python errors with JS noise; trim to the Python traceback
  const idx = msg.indexOf("Traceback");
  return idx >= 0 ? msg.slice(idx) : msg;
}

// ─── Reset env ───
async function resetEnv() {
  if (!state.pyodide) return;
  setStatus("Resetting environment…");
  // Reload by clearing user globals and re-running prelude
  await state.pyodide.runPythonAsync(`
for __k in list(globals().keys()):
    if not __k.startswith('__') and __k not in ('sys',):
        del globals()[__k]
`);
  await state.pyodide.runPythonAsync(PRELUDE);
  if (state.pandasLoaded) {
    await state.pyodide.runPythonAsync("import numpy as np\nimport pandas as pd");
  }
  setStatus("Environment reset", "ok");
  clearOutput();
}

// ─── Question picker ───
function loadQuestion(qid /* , opts unused */) {
  const q = state.pyQuestions.find((x) => x.id === qid);
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
  $("#pg-solution-pane").hidden = true;

  // Editor: restore this question's saved content, otherwise start with the
  // generated stub. Keyed per question so switching no longer leaks code.
  const savedForQ = localStorage.getItem(LS_EDITOR(qid));
  if (savedForQ != null && savedForQ.trim()) {
    $("#pg-editor").value = savedForQ;
  } else {
    $("#pg-editor").value = makeStarter(q);
  }

  localStorage.setItem(LS_LAST_Q, qid);
  const url = new URL(window.location);
  url.searchParams.set("q", qid);
  history.replaceState(null, "", url);
}

function makeStarter(q) {
  // Pull a sensible function/class name out of the title for a stub.
  const slug = (q.title || "solution").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  const isClass = /^(LFU|LRU|Top|Min|Max|Skew|Sliding|Moving|Rate|Ring|Trie|Disjoint|Stack|Queue)/i.test(q.title || "");
  if (isClass) {
    const cls = (q.title || "Solution").split(/\s+/).slice(0, 4).map((w) => w.replace(/[^A-Za-z0-9]/g, "")).join("");
    return `# ${q.title}\n# ${q.company || ""} · ${q.difficulty || ""} · ${q.subtopic || ""}\n\nclass ${cls || "Solution"}:\n    def __init__(self):\n        pass\n\n    # ... methods ...\n\n# Quick test:\nobj = ${cls || "Solution"}()\nprint(obj)\n`;
  }
  return `# ${q.title}\n# ${q.company || ""} · ${q.difficulty || ""} · ${q.subtopic || ""}\n\ndef ${slug || "solve"}():\n    pass\n\nprint(${slug || "solve"}())\n`;
}

function populatePicker() {
  const sel = $("#pg-question-picker");
  sel.innerHTML = "";
  for (const q of state.pyQuestions) {
    const opt = document.createElement("option");
    opt.value = q.id;
    const co = q.company ? `${q.company} · ` : "";
    opt.textContent = `${co}${q.title} [${q.difficulty || "?"}]`;
    sel.appendChild(opt);
  }
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
  const sol = state.currentQ.solution;
  const demo = generateDemo(sol);
  $("#pg-editor").value = sol + demo;
  setStatus(demo ? "Loaded solution + demo — press Run" : "Loaded solution", "ok");
}

function appendDemo() {
  const ed = $("#pg-editor");
  const cur = ed.value;
  const demo = generateDemo(cur);
  if (!demo) {
    setStatus("Couldn't infer a demo from this code — define a function/class first.", "error");
    return;
  }
  // Strip a previously-appended block if present so we don't stack them
  const stripped = cur.replace(/\n\n# ─── Demo \(auto-generated\) ───[\s\S]*$/m, "");
  ed.value = stripped + demo;
  ed.focus();
  setStatus("Demo appended — press Run", "ok");
}

// ─── Snippets sidebar ───
function renderSnippets() {
  const ul = $("#pg-snippets-list");
  ul.innerHTML = "";
  const snippets = [
    { name: "Counter most_common", code: "from collections import Counter\nprint(Counter('aabbbcc').most_common(2))" },
    { name: "heapq nsmallest", code: "import heapq\nprint(heapq.nsmallest(3, [5,1,4,2,3]))" },
    { name: "deque sliding window", code: "from collections import deque\nq = deque(maxlen=3)\nfor x in [1,2,3,4,5]:\n    q.append(x); print(list(q))" },
    { name: "defaultdict groupby", code: "from collections import defaultdict\ng = defaultdict(list)\nfor k,v in [('a',1),('b',2),('a',3)]: g[k].append(v)\nprint(dict(g))" },
    { name: "List as stack", code: "stk=[]\nstk.append(1); stk.append(2); print(stk.pop())" },
  ];
  for (const s of snippets) {
    const li = document.createElement("li");
    const head = document.createElement("div");
    head.className = "pg-table-name";
    head.style.cursor = "pointer";
    head.innerHTML = `<span>${s.name}</span><span class="pg-row-count">insert</span>`;
    head.addEventListener("click", () => {
      const ed = $("#pg-editor");
      ed.value += (ed.value && !ed.value.endsWith("\n") ? "\n\n" : "") + s.code + "\n";
      ed.focus();
    });
    li.appendChild(head);
    ul.appendChild(li);
  }
}

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
  $("#pg-run").addEventListener("click", safeAsync(runCode));
  $("#pg-show-solution").addEventListener("click", showSolution);
  $("#pg-load-solution").addEventListener("click", loadSolution);
  $("#pg-add-demo")?.addEventListener("click", appendDemo);
  $("#pg-solution-close").addEventListener("click", () => ($("#pg-solution-pane").hidden = true));
  $("#pg-clear-output").addEventListener("click", clearOutput);
  $("#pg-reset-env").addEventListener("click", safeAsync(resetEnv));

  $("#pg-load-pandas").addEventListener("change", () => {
    if ($("#pg-load-pandas").checked) ensurePandas();
  });

  $("#pg-question-picker").addEventListener("change", (e) => {
    loadQuestion(e.target.value, { prefill: true });
  });
  $("#pg-prev-q").addEventListener("click", () => stepQuestion(-1));
  $("#pg-next-q").addEventListener("click", () => stepQuestion(+1));

  $("#pg-editor").addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      runCode();
    }
    if (e.key === "Tab") {
      e.preventDefault();
      const ta = e.target;
      const s = ta.selectionStart, ed = ta.selectionEnd;
      ta.value = ta.value.slice(0, s) + "    " + ta.value.slice(ed);
      ta.selectionStart = ta.selectionEnd = s + 4;
    }
  });
  $("#pg-editor").addEventListener("input", () => {
    if (state.currentQ) localStorage.setItem(LS_EDITOR(state.currentQ.id), $("#pg-editor").value);
  });
}

function stepQuestion(delta) {
  if (!state.currentQ) return;
  const idx = state.pyQuestions.findIndex((q) => q.id === state.currentQ.id);
  const next = state.pyQuestions[(idx + delta + state.pyQuestions.length) % state.pyQuestions.length];
  if (next) loadQuestion(next.id, { prefill: true });
}

// ─── Init ───
async function init() {
  wire();
  setEngineReady(false);
  renderSnippets();
  setStatus("Loading question data…");

  const all = await fetch(QUESTIONS_URL).then((r) => r.json());
  state.questions = all;
  state.pyQuestions = all.filter((q) => q.language === "python");
  populatePicker();

  // Show the question UI immediately even before Pyodide is ready.
  // Editor contents are restored per-question inside loadQuestion().
  const params = new URLSearchParams(window.location.search);
  const qid = params.get("q") || localStorage.getItem(LS_LAST_Q) || state.pyQuestions[0]?.id;
  if (qid) loadQuestion(qid);

  await initPyodide();
}

init().catch((err) => {
  console.error(err);
  setStatus("Init failed: " + err.message, "error");
});
