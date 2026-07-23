/* ============================================================
   Interview Studio — AI Mock Interview (Bring Your Own Key)
   The visitor connects their OWN Anthropic API key; the browser calls the
   Anthropic API DIRECTLY. The key is stored only in this browser's
   localStorage and is sent to nobody but Anthropic — it never touches the
   PaddySpeaks servers. The site owner pays nothing.
   ============================================================ */
(function () {
  "use strict";

  var API = "https://api.anthropic.com/v1/messages";
  var LS_KEY = "ps-mock-key";
  var LS_MODEL = "ps-mock-model";
  var $ = function (s, r) { return (r || document).querySelector(s); };

  var MODELS = [
    { id: "claude-haiku-4-5", label: "Haiku 4.5 — cheapest, quick", tier: "cheap" },
    { id: "claude-sonnet-5", label: "Sonnet 5 — balanced", tier: "mid" },
    { id: "claude-opus-4-8", label: "Opus 4.8 — most thorough", tier: "top" },
  ];
  var DEFAULT_MODEL = "claude-haiku-4-5"; // the payer's money — start cheap; they can upgrade

  // Self-contained sample questions so the tool works with zero data loading.
  var SAMPLES = [
    { language: "SQL", difficulty: "Medium", title: "Percentage contribution by category",
      prompt: "For every product category, return its paid revenue and its share of the grand total (as a percentage). Use one window function — no self-join.",
      schema: "orders(order_id, category, amount, status)" },
    { language: "SQL", difficulty: "Hard", title: "Second-highest salary per department",
      prompt: "Return each department's second-highest salary. Handle ties correctly, and return NULL for a department that has only one salaried employee.",
      schema: "employees(emp_id, department, salary)" },
    { language: "SQL", difficulty: "Medium", title: "New vs. returning customers by month",
      prompt: "For each calendar month, count how many purchasing customers were new (first-ever purchase in that month) vs. returning.",
      schema: "orders(order_id, customer_id, order_date, amount)" },
    { language: "Python", difficulty: "Medium", title: "Merge overlapping intervals",
      prompt: "Given a list of [start, end] intervals, merge all overlapping ones and return the result sorted by start. Explain your time complexity.",
      schema: "def merge(intervals: list[list[int]]) -> list[list[int]]:" },
    { language: "Python", difficulty: "Medium", title: "Top-K frequent elements",
      prompt: "Return the k most frequent elements in a list. Aim for better than O(n log n) time and state the complexity you achieve.",
      schema: "def top_k(nums: list[int], k: int) -> list[int]:" },
    { language: "Python", difficulty: "Hard", title: "Streaming median",
      prompt: "Design a class that ingests a stream of integers and can return the running median at any point in O(log n) per insert.",
      schema: "class MedianStream:  # add(num) -> None ; median() -> float" },
  ];

  var CRITIQUE_SCHEMA = {
    type: "object",
    properties: {
      verdict: { type: "string", enum: ["strong", "solid", "partial", "off_track"] },
      summary: { type: "string" },
      strengths: { type: "array", items: { type: "string" } },
      gaps: { type: "array", items: { type: "string" } },
      followup: { type: "string" },
    },
    required: ["verdict", "summary", "strengths", "gaps", "followup"],
    additionalProperties: false,
  };

  var SYSTEM =
    "You are a senior data & AI engineering interviewer running a focused mock interview. " +
    "You are given one interview QUESTION and the CANDIDATE'S ANSWER. Assess the answer the way a real interviewer would: " +
    "judge correctness and approach, not just syntax; if it's code, reason about what it actually returns and its edge cases " +
    "(NULLs, ties, duplicates, empty input, performance). Be specific — cite the exact part of their answer you mean, no filler. " +
    "'strengths' and 'gaps': 1-4 short concrete bullets each (gaps may be empty if strong). 'followup': one probing follow-up an " +
    "interviewer would ask next. 'verdict': strong (interview-passing), solid (good, minor gaps), partial (right idea, real gaps), " +
    "off_track (wrong approach). Return only the structured object.";

  var els = {};
  var idx = 0;
  var busy = false;

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function getKey() { try { return localStorage.getItem(LS_KEY) || ""; } catch (_e) { return ""; } }
  function setKey(k) { try { k ? localStorage.setItem(LS_KEY, k) : localStorage.removeItem(LS_KEY); } catch (_e) {} }
  function getModel() {
    var m;
    try { m = localStorage.getItem(LS_MODEL); } catch (_e) {}
    return MODELS.some(function (x) { return x.id === m; }) ? m : DEFAULT_MODEL;
  }
  function setModel(m) { try { localStorage.setItem(LS_MODEL, m); } catch (_e) {} }
  function maskKey(k) { return k.length > 12 ? k.slice(0, 7) + "…" + k.slice(-4) : "connected"; }

  /* ---------- key connect / status ---------- */
  function renderKeyState() {
    var k = getKey();
    els.connect.hidden = !!k;
    els.status.hidden = !k;
    if (k) els.statusKey.textContent = maskKey(k);
    els.submit.disabled = !k || busy;
  }
  function connectKey() {
    var k = (els.keyInput.value || "").trim();
    if (!/^sk-ant-/.test(k)) {
      els.keyErr.textContent = "That doesn’t look like an Anthropic key (they start with sk-ant-).";
      els.keyErr.hidden = false;
      return;
    }
    els.keyErr.hidden = true;
    setKey(k);
    els.keyInput.value = "";
    renderKeyState();
  }
  function clearKey() { setKey(""); renderKeyState(); }

  /* ---------- question ---------- */
  function currentQuestion() {
    if (els.own.checked) {
      return { question: (els.ownText.value || "").trim(), language: "", difficulty: "", schema: "" };
    }
    var q = SAMPLES[idx];
    return { question: q.prompt, language: q.language, difficulty: q.difficulty, schema: q.schema };
  }
  function renderQuestion() {
    var own = els.own.checked;
    els.sampleBox.hidden = own;
    els.ownBox.hidden = !own;
    if (own) return;
    var q = SAMPLES[idx];
    els.qTitle.textContent = q.title;
    els.qPrompt.textContent = q.prompt;
    els.qMeta.innerHTML =
      '<span class="mk-tag">' + esc(q.language) + "</span>" +
      '<span class="mk-tag">' + esc(q.difficulty) + "</span>" +
      (q.schema ? '<code class="mk-schema">' + esc(q.schema) + "</code>" : "");
  }

  /* ---------- request ---------- */
  function buildBody(model, question, answer, meta) {
    var ctx = [
      "QUESTION (" + (meta.language || "general") + (meta.difficulty ? ", " + meta.difficulty : "") + "):",
      question,
      meta.schema ? "\nSCHEMA / SIGNATURE:\n" + meta.schema : "",
      "\nCANDIDATE'S ANSWER:\n" + answer,
    ].filter(Boolean).join("\n");

    var body = {
      model: model,
      max_tokens: 1200,
      system: SYSTEM,
      messages: [{ role: "user", content: ctx }],
      output_config: { format: { type: "json_schema", schema: CRITIQUE_SCHEMA } },
    };
    // Haiku 4.5 doesn't take adaptive thinking or the effort control (they 400);
    // Opus 4.8 / Sonnet 5 do.
    if (model !== "claude-haiku-4-5") {
      body.thinking = { type: "adaptive" };
      body.output_config.effort = "medium";
    }
    return body;
  }

  var VERDICT = {
    strong: { label: "Strong", cls: "v-strong" },
    solid: { label: "Solid", cls: "v-solid" },
    partial: { label: "Partial", cls: "v-partial" },
    off_track: { label: "Off track", cls: "v-off" },
  };
  function list(items) {
    if (!items || !items.length) return "";
    return "<ul>" + items.map(function (i) { return "<li>" + esc(i) + "</li>"; }).join("") + "</ul>";
  }
  function renderCritique(c) {
    var v = VERDICT[c.verdict] || { label: c.verdict, cls: "v-partial" };
    els.result.innerHTML =
      '<div class="mk-critique">' +
      '<div class="mk-verdict ' + v.cls + '">' + esc(v.label) + "</div>" +
      '<p class="mk-summary">' + esc(c.summary) + "</p>" +
      (c.strengths && c.strengths.length ? '<div class="mk-block"><h4>What worked</h4>' + list(c.strengths) + "</div>" : "") +
      (c.gaps && c.gaps.length ? '<div class="mk-block mk-gaps"><h4>Gaps</h4>' + list(c.gaps) + "</div>" : "") +
      (c.followup ? '<div class="mk-block mk-follow"><h4>Follow-up they’d ask</h4><p>' + esc(c.followup) + "</p></div>" : "") +
      "</div>";
    els.result.hidden = false;
  }
  function state(kind, msg) {
    els.result.hidden = false;
    if (kind === "loading") {
      els.result.innerHTML =
        '<div class="mk-loading"><span class="mk-spin" aria-hidden="true"></span>Reading your answer like an interviewer would…</div>';
    } else {
      els.result.innerHTML = '<div class="mk-note mk-err">' + esc(msg || "Something went wrong.") + "</div>";
    }
  }
  function setBusy(on) {
    busy = on;
    els.submit.disabled = on || !getKey();
    els.submit.textContent = on ? "Grading…" : "Get AI feedback →";
  }

  function errorFor(status, data) {
    var m = (data && data.error && data.error.message) || "";
    if (status === 401) return "That key was rejected. Check it’s a valid Anthropic API key (and has billing enabled).";
    if (status === 403) return "Your key doesn’t have access to this model — pick another model or check your plan.";
    if (status === 429) return "Anthropic rate-limited your key. Wait a few seconds and try again.";
    if (status === 400 && /credit|balance|billing/i.test(m)) return "Your Anthropic account needs credit/billing set up to run this.";
    if (status === 400) return "Request rejected: " + (m || "bad request") + ".";
    return "Grader error (" + status + ")" + (m ? ": " + m : "") + ".";
  }

  function submit() {
    if (busy) return;
    var key = getKey();
    if (!key) { els.keyInput && els.keyInput.focus(); return; }
    var q = currentQuestion();
    var answer = (els.answer.value || "").trim();
    if (!q.question) { state("error", "Pick or paste a question first."); return; }
    if (!answer) { state("error", "Write an answer before asking for feedback."); return; }

    var model = getModel();
    setBusy(true);
    state("loading");

    fetch(API, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify(buildBody(model, q.question, answer, q)),
    })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (d) { return { r: r, d: d }; });
      })
      .then(function (res) {
        var r = res.r, d = res.d;
        if (!r.ok) { state("error", errorFor(r.status, d)); return; }
        if (d.stop_reason === "refusal") { state("error", "The model declined this one — try a different question."); return; }
        var block = (d.content || []).find(function (b) { return b.type === "text"; });
        var critique;
        try { critique = JSON.parse(block.text); } catch (_e) { state("error", "Couldn’t read the model’s feedback — try again."); return; }
        renderCritique(critique);
      })
      .catch(function () {
        state("error", "Couldn’t reach Anthropic from your browser — check your connection and that the key is valid.");
      })
      .then(function () { setBusy(false); });
  }

  function init() {
    els = {
      connect: $("#mk-connect"), status: $("#mk-status"),
      keyInput: $("#mk-key"), keyErr: $("#mk-key-err"),
      connectBtn: $("#mk-connect-btn"), statusKey: $("#mk-status-key"),
      changeBtn: $("#mk-change"), model: $("#mk-model"),
      own: $("#mk-own"), sampleBox: $("#mk-sample"), ownBox: $("#mk-own-box"), ownText: $("#mk-own-text"),
      qTitle: $("#mk-q-title"), qPrompt: $("#mk-q-prompt"), qMeta: $("#mk-q-meta"),
      answer: $("#mk-answer"), submit: $("#mk-submit"), next: $("#mk-next"), result: $("#mk-result"),
    };
    if (!els.submit) return;

    // model selector
    if (els.model) {
      els.model.innerHTML = MODELS.map(function (m) {
        return '<option value="' + m.id + '">' + esc(m.label) + "</option>";
      }).join("");
      els.model.value = getModel();
      els.model.addEventListener("change", function () { setModel(els.model.value); });
    }

    idx = Math.floor(Math.random() * SAMPLES.length);
    renderQuestion();
    renderKeyState();

    els.connectBtn.addEventListener("click", connectKey);
    els.keyInput.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); connectKey(); } });
    els.changeBtn.addEventListener("click", clearKey);
    els.next.addEventListener("click", function () { idx = (idx + 1) % SAMPLES.length; renderQuestion(); });
    els.own.addEventListener("change", renderQuestion);
    els.submit.addEventListener("click", submit);
    els.answer.addEventListener("keydown", function (e) {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); submit(); }
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
