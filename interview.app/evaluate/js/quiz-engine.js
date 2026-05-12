/* ═══════════════════════════════════════════
   Skill Check — Quiz Engine
   Renders a single-section quiz, persists progress in localStorage,
   auto-grades objective questions, self-rates open/code answers.
   ═══════════════════════════════════════════ */

const STORAGE_PREFIX = "paddyspeaks.skillcheck.";

const SECTIONS = {
  sql:    { slug: "sql",    label: "SQL",            file: "./data/sql.json" },
  python: { slug: "python", label: "Python",         file: "./data/python.json" },
  design: { slug: "design", label: "Data & System Design", file: "./data/design.json" },
};

const params = new URLSearchParams(window.location.search);
const sectionSlug = params.get("section");

const state = {
  section: null,
  questions: [],
  current: 0,
  answers: {},        // question_id -> single index | multi indices | code string | open string
  selfRatings: {},    // question_id -> 0 | 1 | 2 (only used for code/open after submission)
  submitted: false,
};

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
    state.questions = data.questions;
    restore();
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
// localStorage persistence
// ──────────────────────────────────────────
function storageKey() { return STORAGE_PREFIX + sectionSlug; }

function persist() {
  const payload = {
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
    state.answers = payload.answers || {};
    state.selfRatings = payload.selfRatings || {};
    state.current = payload.current || 0;
    state.submitted = !!payload.submitted;
  } catch (e) { /* corrupt — ignore */ }
}

function clearProgress() {
  try { localStorage.removeItem(storageKey()); } catch (e) {}
  state.answers = {};
  state.selfRatings = {};
  state.current = 0;
  state.submitted = false;
}

// ──────────────────────────────────────────
// Rendering — Quiz screen
// ──────────────────────────────────────────
function renderQuiz() {
  const root = document.getElementById("eval-root");
  const q = state.questions[state.current];
  const total = state.questions.length;
  const answeredCount = Object.keys(state.answers).filter(k => isAnswered(state.answers[k])).length;

  root.innerHTML = `
    <div class="quiz-topbar">
      <div>
        <div class="quiz-section-label">${escapeHTML(state.section.title)}</div>
        <div class="quiz-meta">${escapeHTML(state.section.tagline)}</div>
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
        <button class="q-btn q-btn-danger" id="q-reset">Reset progress</button>
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
  const selected = state.answers[q.id];
  return `
    <div class="q-options">
      ${q.options.map((opt, i) => `
        <label class="q-option ${selected === i ? "selected" : ""}" data-idx="${i}">
          <input type="radio" name="opt-${q.id}" value="${i}" ${selected === i ? "checked" : ""} />
          <span class="q-option-text">${formatInline(opt)}</span>
        </label>
      `).join("")}
    </div>
  `;
}

function renderMultiChoice(q) {
  const selected = Array.isArray(state.answers[q.id]) ? state.answers[q.id] : [];
  return `
    <div class="q-options">
      ${q.options.map((opt, i) => `
        <label class="q-option ${selected.includes(i) ? "selected" : ""}" data-idx="${i}">
          <input type="checkbox" name="opt-${q.id}" value="${i}" ${selected.includes(i) ? "checked" : ""} />
          <span class="q-option-text">${formatInline(opt)}</span>
        </label>
      `).join("")}
    </div>
  `;
}

function renderCode(q) {
  const stored = state.answers[q.id];
  const value = typeof stored === "string" ? stored : (q.starter || "");
  return `
    <textarea class="q-code-area" id="q-code-${q.id}" spellcheck="false" placeholder="Write your ${q.language || "code"} here…">${escapeHTML(value)}</textarea>
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
        inputs.forEach((inp, i) => { if (inp.checked) current.push(i); });
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
    // Tab inserts two spaces instead of moving focus
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
  // Cheap refresh of the jump strip + the answered counter without re-rendering the whole question
  const jump = document.getElementById("q-jump");
  if (jump) renderJump();
  const meta = document.querySelector(".quiz-topbar .quiz-meta:last-child");
  if (meta) {
    const answeredCount = Object.keys(state.answers).filter(k => isAnswered(state.answers[k])).length;
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
  const answeredCount = Object.keys(state.answers).filter(k => isAnswered(state.answers[k])).length;
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
  if (!confirm("Clear all answers for this section?")) return;
  clearProgress();
  renderQuiz();
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
      <button class="q-btn q-btn-primary" id="results-retake">Retake this section</button>
    </div>
  `;

  const list = document.getElementById("review-list");
  state.questions.forEach((q, idx) => {
    list.appendChild(renderReviewItem(q, idx));
  });

  document.getElementById("results-retake").addEventListener("click", () => {
    if (!confirm("Clear your answers and start this section over?")) return;
    clearProgress();
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
      return arr.map(i => formatInline(q.options[i])).join("<br>");
    };
    const correctArr = Array.isArray(q.answer) ? q.answer : [q.answer];

    body += `
      <div class="review-answer-label">Your answer</div>
      <div class="review-your-answer">${fmtIndices(userAns)}</div>
      <div class="review-answer-label">Correct answer</div>
      <div class="review-your-answer">${correctArr.map(i => formatInline(q.options[i])).join("<br>")}</div>
      ${q.explanation ? `<div class="review-explanation">${formatInline(q.explanation)}</div>` : ""}
    `;
  } else if (q.type === "code" || q.type === "open") {
    cls += " self-rated";
    const userVal = typeof userAns === "string" ? userAns.trim() : "";
    body += `
      <div class="review-answer-label">Your answer</div>
      <div class="review-your-answer ${q.type === "code" ? "code" : ""}">${userVal ? escapeHTML(userVal) : "<em>No answer</em>"}</div>
      <div class="review-answer-label">Model answer</div>
      <div class="review-model-answer ${q.type === "code" ? "code" : ""}">${escapeHTML(q.model_answer)}</div>
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

  // Wire self-rate buttons
  item.querySelectorAll(".review-self-rate button").forEach(btn => {
    btn.addEventListener("click", () => {
      const qid = btn.parentElement.getAttribute("data-qid");
      const rate = parseInt(btn.getAttribute("data-rate"), 10);
      state.selfRatings[qid] = rate;
      persist();
      // Re-render results to update score
      renderResults();
      window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
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
  // Each question is worth 1 point.
  // - single/multi: 1 if fully correct, 0 otherwise.
  // - code/open: self-rating 0/1/2 -> 0 / 0.5 / 1.0 points.
  // Final score is sum of points; max is questions.length.
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

  return {
    score: total,
    max: state.questions.length,
    autoCorrect,
    autoTotal,
    selfCorrect: selfPoints,
    selfTotal,
  };
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

// Inline formatter — handles `code` only (for option text, explanations, key points)
function formatInline(str) {
  const esc = escapeHTML(str);
  return esc.replace(/`([^`]+)`/g, "<code>$1</code>");
}

// Prompt formatter — handles ```fenced``` code blocks AND inline `code`
function formatPrompt(str) {
  if (!str) return "";
  const parts = [];
  let remaining = str;
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

// ──────────────────────────────────────────
// Errors
// ──────────────────────────────────────────
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
