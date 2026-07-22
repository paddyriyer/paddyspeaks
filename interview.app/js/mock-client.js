/* ============================================================
   Interview Studio — AI Mock Interview (NS-2, Phase 1)
   Sends the candidate's answer to the Worker (/api/mock), which grades it with
   Claude and returns a structured critique. No account; the answer is graded
   and discarded (see the disclosure on the page). Degrades gracefully to a
   "not live yet" state while the backend is dormant (503).
   ============================================================ */
(function () {
  "use strict";

  var API = "https://ps.paddyspeaks.com/api/mock";
  var $ = function (s, r) { return (r || document).querySelector(s); };

  // Self-contained sample questions so the tool works with zero data loading.
  // "Bring your own" lets a user paste any question they like.
  var SAMPLES = [
    {
      language: "SQL", difficulty: "Medium",
      title: "Percentage contribution by category",
      prompt: "For every product category, return its paid revenue and its share of the grand total (as a percentage). Use one window function — no self-join.",
      schema: "orders(order_id, category, amount, status)"
    },
    {
      language: "SQL", difficulty: "Hard",
      title: "Second-highest salary per department",
      prompt: "Return each department's second-highest salary. Handle ties correctly, and return NULL for a department that has only one salaried employee.",
      schema: "employees(emp_id, department, salary)"
    },
    {
      language: "SQL", difficulty: "Medium",
      title: "New vs. returning customers by month",
      prompt: "For each calendar month, count how many purchasing customers were new (first-ever purchase in that month) vs. returning.",
      schema: "orders(order_id, customer_id, order_date, amount)"
    },
    {
      language: "Python", difficulty: "Medium",
      title: "Merge overlapping intervals",
      prompt: "Given a list of [start, end] intervals, merge all overlapping ones and return the result sorted by start. Explain your time complexity.",
      schema: "def merge(intervals: list[list[int]]) -> list[list[int]]:"
    },
    {
      language: "Python", difficulty: "Medium",
      title: "Top-K frequent elements",
      prompt: "Return the k most frequent elements in a list. Aim for better than O(n log n) time and state the complexity you achieve.",
      schema: "def top_k(nums: list[int], k: int) -> list[int]:"
    },
    {
      language: "Python", difficulty: "Hard",
      title: "Streaming median",
      prompt: "Design a class that ingests a stream of integers and can return the running median at any point in O(log n) per insert.",
      schema: "class MedianStream:  # add(num) -> None ; median() -> float"
    }
  ];

  var els = {};
  var idx = 0;
  var busy = false;

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function currentQuestion() {
    if (els.own.checked) {
      return {
        question: (els.ownText.value || "").trim(),
        language: "", difficulty: "", schema: ""
      };
    }
    var q = SAMPLES[idx];
    return {
      question: q.prompt, language: q.language, difficulty: q.difficulty, schema: q.schema
    };
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

  var VERDICT = {
    strong: { label: "Strong", cls: "v-strong" },
    solid: { label: "Solid", cls: "v-solid" },
    partial: { label: "Partial", cls: "v-partial" },
    off_track: { label: "Off track", cls: "v-off" }
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
      (c.strengths && c.strengths.length
        ? '<div class="mk-block"><h4>What worked</h4>' + list(c.strengths) + "</div>"
        : "") +
      (c.gaps && c.gaps.length
        ? '<div class="mk-block mk-gaps"><h4>Gaps</h4>' + list(c.gaps) + "</div>"
        : "") +
      (c.followup
        ? '<div class="mk-block mk-follow"><h4>Follow-up they’d ask</h4><p>' + esc(c.followup) + "</p></div>"
        : "") +
      "</div>";
    els.result.hidden = false;
  }

  function state(kind, msg) {
    els.result.hidden = false;
    if (kind === "loading") {
      els.result.innerHTML =
        '<div class="mk-loading"><span class="mk-spin" aria-hidden="true"></span>' +
        "Reading your answer like an interviewer would…</div>";
    } else if (kind === "dormant") {
      els.result.innerHTML =
        '<div class="mk-note">The AI interviewer isn’t live yet — it’s being set up. ' +
        'Meanwhile, every question runs for real in the ' +
        '<a href="../sql.html">SQL</a> and <a href="../python.html">Python</a> playgrounds.</div>';
    } else {
      els.result.innerHTML = '<div class="mk-note mk-err">' + esc(msg || "Something went wrong.") + "</div>";
    }
  }

  function setBusy(on) {
    busy = on;
    els.submit.disabled = on;
    els.submit.textContent = on ? "Grading…" : "Get AI feedback →";
  }

  function submit() {
    if (busy) return;
    var q = currentQuestion();
    var answer = (els.answer.value || "").trim();
    if (!q.question) { state("error", "Pick or paste a question first."); return; }
    if (!answer) { state("error", "Write an answer before asking for feedback."); return; }

    setBusy(true);
    state("loading");

    fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: q.question, answer: answer,
        language: q.language, difficulty: q.difficulty, schema: q.schema
      })
    })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (d) { return { r: r, d: d }; });
      })
      .then(function (res) {
        var r = res.r, d = res.d;
        if (r.status === 503 || d.error === "not_configured") { state("dormant"); return; }
        if (!r.ok || !d.ok) { state("error", d.message || ("Error " + r.status)); return; }
        renderCritique(d.critique);
      })
      .catch(function () { state("error", "Network error — check your connection and retry."); })
      .then(function () { setBusy(false); });
  }

  function init() {
    els = {
      own: $("#mk-own"),
      sampleBox: $("#mk-sample"),
      ownBox: $("#mk-own-box"),
      ownText: $("#mk-own-text"),
      qTitle: $("#mk-q-title"),
      qPrompt: $("#mk-q-prompt"),
      qMeta: $("#mk-q-meta"),
      answer: $("#mk-answer"),
      submit: $("#mk-submit"),
      next: $("#mk-next"),
      result: $("#mk-result")
    };
    if (!els.submit) return;
    idx = Math.floor(Math.random() * SAMPLES.length);
    renderQuestion();
    els.next.addEventListener("click", function () {
      idx = (idx + 1) % SAMPLES.length;
      renderQuestion();
    });
    els.own.addEventListener("change", renderQuestion);
    els.submit.addEventListener("click", submit);
    els.answer.addEventListener("keydown", function (e) {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); submit(); }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
