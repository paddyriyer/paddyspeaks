/* ==========================================================================
   Learning Track engine — powers the Communication and AI Engineering track
   pages. Framework-free, no build step, no backend. All progress persists to
   localStorage (anonymous, per-device), matching the app's storage approach.

   Usage (place before </body>):
     <div id="track-root"
          data-section="ai"
          data-url="/interview.app/evaluate/data/ai.json"
          data-accent="#7c3aed"
          data-skillcheck="/interview.app/evaluate/quiz.html?section=ai"
          data-flashcards="/interview.app/flashcards/"></div>
     <script src="/interview.app/js/track.js" defer></script>

   Reuses the SAME data files as the Skill Check and Flashcards, so content is
   authored once. Backward compatible with the base quiz schema; it also reads
   the optional track fields (level, role, format, why_confusing, common_mistake,
   followups, production_example, tags).
   ========================================================================== */
(function () {
  "use strict";

  var root = document.getElementById("track-root");
  if (!root) return;

  var CFG = {
    section: root.dataset.section || "track",
    url: root.dataset.url,
    accent: root.dataset.accent || "#0e7490",
    skillcheck: root.dataset.skillcheck || "",
    flashcards: root.dataset.flashcards || "",
    daily: parseInt(root.dataset.daily || "5", 10),
    coverageTarget: parseFloat(root.dataset.coverageTarget || "0.4"),
  };
  root.classList.add("tk");
  root.style.setProperty("--tk-accent", CFG.accent);
  var KEY = "ps-track-" + CFG.section;

  // ---- storage helpers -----------------------------------------------------
  function lsGet(k, fb) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? fb : v; } catch (e) { return fb; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

  var progress = lsGet(KEY + ":progress", {});   // { qid: {result:'correct'|'partial'|'wrong', ts} }
  var bookmarks = new Set(lsGet(KEY + ":bookmarks", []));
  var savedView = lsGet(KEY + ":view", null);     // { filters, index }

  function persistProgress() { lsSet(KEY + ":progress", progress); }
  function persistBookmarks() { lsSet(KEY + ":bookmarks", Array.from(bookmarks)); }
  function persistView() { lsSet(KEY + ":view", { filters: serializeFilters(), index: practice.idx }); }

  // ---- state ---------------------------------------------------------------
  var DOC = null, QUESTIONS = [], MODULES = [];
  var filters = { topics: new Set(), levels: new Set(), roles: new Set(), formats: new Set(), search: "", bookmarked: false };
  var facets = { levels: [], roles: [], formats: [] };
  var practice = { queue: [], idx: 0, revealed: false, picks: [] };

  // ---- utils ---------------------------------------------------------------
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function fmt(s) { return esc(s).replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\n/g, "<br>"); }
  function exType(q) {
    if (q.format) return { mc: "Multiple choice", rewrite: "Rewrite", scenario: "Scenario", speaking: "Speaking" }[q.format] || q.format;
    return { single: "Multiple choice", multi: "Multi-select", open: "Written / scenario" }[q.type] || q.type;
  }
  function levelOf(q) { return q.level || ({ easy: "Beginner", medium: "Intermediate", hard: "Advanced" }[q.difficulty]) || "Intermediate"; }

  // Deterministic seeded shuffle (for the "Daily practice" set)
  function seededShuffle(arr, seed) {
    var a = arr.slice(), s = 0;
    for (var i = 0; i < seed.length; i++) s = (s * 31 + seed.charCodeAt(i)) >>> 0;
    for (var j = a.length - 1; j > 0; j--) {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      var k = s % (j + 1); var t = a[j]; a[j] = a[k]; a[k] = t;
    }
    return a;
  }

  // ---- filtering -----------------------------------------------------------
  function matches(q) {
    if (filters.topics.size && !filters.topics.has(q.topic)) return false;
    if (filters.levels.size && !filters.levels.has(levelOf(q))) return false;
    if (filters.roles.size && !filters.roles.has(q.role)) return false;
    if (filters.formats.size && !filters.formats.has(exType(q))) return false;
    if (filters.bookmarked && !bookmarks.has(q.id)) return false;
    if (filters.search) {
      var hay = (q.prompt + " " + (q.topic || "") + " " + (q.tags || []).join(" ")).toLowerCase();
      if (hay.indexOf(filters.search.toLowerCase()) === -1) return false;
    }
    return true;
  }
  function filtered() { return QUESTIONS.filter(matches); }

  function serializeFilters() {
    return {
      topics: Array.from(filters.topics), levels: Array.from(filters.levels),
      roles: Array.from(filters.roles), formats: Array.from(filters.formats),
      search: filters.search, bookmarked: filters.bookmarked,
    };
  }
  function restoreFilters(f) {
    if (!f) return;
    filters.topics = new Set(f.topics || []); filters.levels = new Set(f.levels || []);
    filters.roles = new Set(f.roles || []); filters.formats = new Set(f.formats || []);
    filters.search = f.search || ""; filters.bookmarked = !!f.bookmarked;
  }

  // ---- metrics -------------------------------------------------------------
  function resultScore(r) { return r === "correct" ? 1 : r === "partial" ? 0.5 : 0; }
  function moduleStats(topic) {
    var qs = QUESTIONS.filter(function (q) { return q.topic === topic; });
    var seen = 0, score = 0;
    qs.forEach(function (q) { var p = progress[q.id]; if (p) { seen++; score += resultScore(p.result); } });
    return { total: qs.length, seen: seen, score: score, accuracy: seen ? score / seen : null };
  }
  function overallStats() {
    var seen = 0, score = 0;
    QUESTIONS.forEach(function (q) { var p = progress[q.id]; if (p) { seen++; score += resultScore(p.result); } });
    var total = QUESTIONS.length;
    var accuracy = seen ? score / seen : 0;
    var coverage = total ? seen / total : 0;
    var confidence = Math.min(1, coverage / CFG.coverageTarget);
    var readiness = Math.round(accuracy * 100 * confidence);
    return { seen: seen, score: score, total: total, accuracy: accuracy, coverage: coverage, readiness: readiness };
  }
  function readinessVerdict(r, seen) {
    if (seen === 0) return "Not started";
    if (r < 25) return "Getting started";
    if (r < 50) return "Building";
    if (r < 75) return "Solid";
    return "Interview-ready";
  }
  function weakAreas() {
    var arr = MODULES.map(function (m) { var s = moduleStats(m); return { m: m, s: s }; });
    // Prioritize: not-started modules, then lowest accuracy among attempted.
    var notStarted = arr.filter(function (x) { return x.s.seen === 0; }).map(function (x) { return x.m; });
    var attempted = arr.filter(function (x) { return x.s.seen > 0; })
      .sort(function (a, b) { return a.s.accuracy - b.s.accuracy; })
      .filter(function (x) { return x.s.accuracy < 0.8; }).map(function (x) { return x.m; });
    return { notStarted: notStarted, weak: attempted };
  }

  // ---- data load -----------------------------------------------------------
  function load() {
    root.innerHTML = '<div class="tk-loading">Loading track…</div>';
    fetch(CFG.url).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    }).then(function (doc) {
      DOC = doc;
      QUESTIONS = doc.questions || [];
      MODULES = doc.modules || dedupe(QUESTIONS.map(function (q) { return q.topic; }));
      facets.levels = orderLevels(dedupe(QUESTIONS.map(levelOf)));
      facets.roles = dedupe(QUESTIONS.map(function (q) { return q.role; })).filter(Boolean).sort();
      facets.formats = dedupe(QUESTIONS.map(exType));
      restoreFilters(savedView && savedView.filters);
      render();
    }).catch(function (e) {
      root.innerHTML = '<div class="tk-empty">Could not load track content (' + esc(e.message) + '). Please refresh.</div>';
    });
  }
  function dedupe(a) { var s = new Set(), out = []; a.forEach(function (x) { if (x != null && !s.has(x)) { s.add(x); out.push(x); } }); return out; }
  function orderLevels(a) { var ord = ["Beginner", "Intermediate", "Advanced", "Expert"]; return a.slice().sort(function (x, y) { return ord.indexOf(x) - ord.indexOf(y); }); }

  // ---- render: shell -------------------------------------------------------
  function render() {
    var o = overallStats();
    root.innerHTML =
      renderOverview(o) +
      '<h2 class="tk-section-head">Modules</h2>' +
      '<p class="tk-section-sub">' + MODULES.length + ' modules · ' + QUESTIONS.length + ' exercises. Click a module to practise it, or use the filters below.</p>' +
      '<div class="tk-modules" id="tk-modules"></div>' +
      renderFilters() +
      '<div class="tk-practice" id="tk-practice"></div>';
    renderModules();
    wireOverview();
    wireFilters();
    renderPractice();
  }

  function renderOverview(o) {
    var C = 2 * Math.PI * 66; // r=66
    var off = C * (1 - o.readiness / 100);
    var wa = weakAreas();
    var recos = "";
    var picks = (wa.weak.slice(0, 2)).concat(wa.notStarted.slice(0, 2)).slice(0, 3);
    if (picks.length) {
      recos = '<div class="tk-recos"><b>Focus next:</b> ' + picks.map(function (m) {
        var s = moduleStats(m);
        var tag = s.seen === 0 ? "not started" : Math.round(s.accuracy * 100) + "% so far";
        return '<button class="tk-reco-chip" data-reco="' + esc(m) + '">' + esc(m) + ' · ' + tag + '</button>';
      }).join("") + '</div>';
    }
    return '<div class="tk-overview">' +
      '<div class="tk-readiness">' +
        '<div class="tk-readiness-label">Interview readiness</div>' +
        '<div class="tk-gauge"><svg viewBox="0 0 150 150">' +
          '<circle class="tk-gauge-track" cx="75" cy="75" r="66"></circle>' +
          '<circle class="tk-gauge-fill" cx="75" cy="75" r="66" stroke-dasharray="' + C.toFixed(1) + '" stroke-dashoffset="' + off.toFixed(1) + '"></circle>' +
        '</svg><div class="tk-gauge-num"><b>' + o.readiness + '</b><span>/ 100</span></div></div>' +
        '<div class="tk-readiness-verdict">' + readinessVerdict(o.readiness, o.seen) + '</div>' +
        '<div class="tk-readiness-sub">' + o.seen + ' of ' + o.total + ' practised · ' + Math.round(o.accuracy * 100) + '% accuracy</div>' +
      '</div>' +
      '<div class="tk-stats">' +
        '<div class="tk-stat"><b>' + o.seen + '</b><span>Questions practised</span></div>' +
        '<div class="tk-stat"><b>' + Math.round(o.accuracy * 100) + '%</b><span>Accuracy</span></div>' +
        '<div class="tk-stat"><b>' + bookmarks.size + '</b><span>Bookmarked</span></div>' +
        '<div class="tk-cta-row">' +
          '<button class="tk-btn tk-btn-primary" id="tk-continue">' + (savedView && progressAny() ? "▸ Continue where you left off" : "▸ Start mixed practice") + '</button>' +
          '<button class="tk-btn" id="tk-daily">◷ Daily ' + CFG.daily + '</button>' +
          '<button class="tk-btn" id="tk-bookmarks">★ Bookmarks (' + bookmarks.size + ')</button>' +
          (CFG.skillcheck ? '<a class="tk-btn" href="' + esc(CFG.skillcheck) + '">✓ Skill Check</a>' : "") +
          (CFG.flashcards ? '<a class="tk-btn" href="' + esc(CFG.flashcards) + '">⚏ Flashcards</a>' : "") +
          '<button class="tk-btn" id="tk-reset">↺ Reset progress</button>' +
        '</div>' +
        recos +
      '</div>' +
    '</div>';
  }
  function progressAny() { return Object.keys(progress).length > 0; }

  function wireOverview() {
    byId("tk-continue").onclick = function () {
      if (savedView && typeof savedView.index === "number" && practice.queue.length === 0) {
        startPractice(filtered(), savedView.index || 0);
      } else { startPractice(filtered(), practice.idx || 0); }
      scrollToPractice();
    };
    byId("tk-daily").onclick = function () {
      var seed = CFG.section + "-" + new Date().toISOString().slice(0, 10);
      startPractice(seededShuffle(QUESTIONS, seed).slice(0, CFG.daily), 0);
      scrollToPractice();
    };
    byId("tk-bookmarks").onclick = function () {
      if (!bookmarks.size) { alert("No bookmarks yet — tap the ☆ on any question to save it."); return; }
      startPractice(QUESTIONS.filter(function (q) { return bookmarks.has(q.id); }), 0);
      scrollToPractice();
    };
    byId("tk-reset").onclick = function () {
      if (!progressAny() && !bookmarks.size) return;
      if (!confirm("Reset all progress and bookmarks for this track on this device?")) return;
      progress = {}; bookmarks = new Set(); savedView = null; practice = { queue: [], idx: 0, revealed: false, picks: [] };
      persistProgress(); persistBookmarks(); lsSet(KEY + ":view", null);
      render();
    };
    Array.prototype.forEach.call(root.querySelectorAll(".tk-reco-chip"), function (btn) {
      btn.onclick = function () {
        filters.topics = new Set([btn.dataset.reco]);
        filters.levels = new Set(); filters.roles = new Set(); filters.formats = new Set();
        filters.bookmarked = false; filters.search = "";
        render();
        startPractice(filtered(), 0);
        scrollToPractice();
      };
    });
  }

  // ---- render: modules -----------------------------------------------------
  function renderModules() {
    var el = byId("tk-modules");
    el.innerHTML = MODULES.map(function (m) {
      var s = moduleStats(m);
      var pct = s.total ? Math.round((s.seen / s.total) * 100) : 0;
      var acc = s.accuracy == null ? "—" : Math.round(s.accuracy * 100) + "%";
      var weak = s.accuracy != null && s.accuracy < 0.7;
      return '<button class="tk-module" data-topic="' + esc(m) + '">' +
        '<div class="tk-module-name">' + esc(m) + '</div>' +
        '<div class="tk-module-meta">' +
          '<span>' + s.total + ' Qs</span>' +
          '<span>' + s.seen + ' done</span>' +
          '<span class="tk-module-acc' + (weak ? " is-weak" : "") + '">' + acc + '</span>' +
        '</div>' +
        '<div class="tk-bar"><div class="tk-bar-fill" style="width:' + pct + '%"></div></div>' +
      '</button>';
    }).join("");
    Array.prototype.forEach.call(el.querySelectorAll(".tk-module"), function (btn) {
      btn.onclick = function () {
        filters.topics = new Set([btn.dataset.topic]);
        filters.levels = new Set(); filters.roles = new Set(); filters.formats = new Set();
        filters.bookmarked = false; filters.search = "";
        syncFilterUI();
        startPractice(filtered(), 0);
        scrollToPractice();
      };
    });
  }

  // ---- render: filters -----------------------------------------------------
  function chipRow(label, values, set, group) {
    return '<div class="tk-filter-row"><span class="tk-filter-label">' + label + '</span><div class="tk-chips">' +
      values.map(function (v) {
        return '<button class="tk-chip" data-group="' + group + '" data-value="' + esc(v) + '" aria-pressed="' + (set.has(v) ? "true" : "false") + '">' + esc(v) + '</button>';
      }).join("") + '</div></div>';
  }
  function renderFilters() {
    return '<div class="tk-filters" id="tk-filters">' +
      '<div class="tk-filter-row"><span class="tk-filter-label">Search</span><div class="tk-chips"><input class="tk-search" id="tk-search" type="search" placeholder="Search prompts, topics, tags…" value="' + esc(filters.search) + '" aria-label="Search exercises" /></div></div>' +
      chipRow("Topic", MODULES, filters.topics, "topics") +
      chipRow("Level", facets.levels, filters.levels, "levels") +
      chipRow("Role", facets.roles, filters.roles, "roles") +
      chipRow("Type", facets.formats, filters.formats, "formats") +
      '<div class="tk-filter-row"><span class="tk-filter-label"></span><div class="tk-chips">' +
        '<button class="tk-chip" id="tk-bm-toggle" aria-pressed="' + (filters.bookmarked ? "true" : "false") + '">★ Bookmarked only</button>' +
        '<button class="tk-btn" id="tk-apply">▸ Practise these</button>' +
        '<button class="tk-btn" id="tk-clear">Clear filters</button>' +
      '</div></div>' +
      '<div class="tk-filter-summary" id="tk-filter-summary"></div>' +
    '</div>';
  }
  var groupMap = { topics: "topics", levels: "levels", roles: "roles", formats: "formats" };
  function wireFilters() {
    Array.prototype.forEach.call(root.querySelectorAll('.tk-chip[data-group]'), function (chip) {
      chip.onclick = function () {
        var set = filters[groupMap[chip.dataset.group]];
        if (set.has(chip.dataset.value)) set.delete(chip.dataset.value); else set.add(chip.dataset.value);
        chip.setAttribute("aria-pressed", set.has(chip.dataset.value) ? "true" : "false");
        updateSummary();
      };
    });
    var search = byId("tk-search");
    search.oninput = function () { filters.search = search.value.trim(); updateSummary(); };
    byId("tk-bm-toggle").onclick = function () {
      filters.bookmarked = !filters.bookmarked;
      byId("tk-bm-toggle").setAttribute("aria-pressed", filters.bookmarked ? "true" : "false");
      updateSummary();
    };
    byId("tk-apply").onclick = function () { startPractice(filtered(), 0); scrollToPractice(); };
    byId("tk-clear").onclick = function () {
      filters = { topics: new Set(), levels: new Set(), roles: new Set(), formats: new Set(), search: "", bookmarked: false };
      syncFilterUI(); updateSummary();
    };
    updateSummary();
  }
  function syncFilterUI() {
    Array.prototype.forEach.call(root.querySelectorAll('.tk-chip[data-group]'), function (chip) {
      var set = filters[groupMap[chip.dataset.group]];
      chip.setAttribute("aria-pressed", set.has(chip.dataset.value) ? "true" : "false");
    });
    var s = byId("tk-search"); if (s) s.value = filters.search;
    var bm = byId("tk-bm-toggle"); if (bm) bm.setAttribute("aria-pressed", filters.bookmarked ? "true" : "false");
  }
  function updateSummary() {
    var n = filtered().length;
    var active = filters.topics.size + filters.levels.size + filters.roles.size + filters.formats.size + (filters.bookmarked ? 1 : 0) + (filters.search ? 1 : 0);
    byId("tk-filter-summary").innerHTML = active
      ? '<b>' + n + '</b> exercise' + (n === 1 ? "" : "s") + ' match your filters.'
      : 'No filters — the full pool of <b>' + n + '</b> exercises.';
  }

  // ---- render: practice ----------------------------------------------------
  function startPractice(queue, idx) {
    if (!queue || !queue.length) {
      byId("tk-practice").innerHTML = '<div class="tk-card tk-empty">No exercises match. Widen your filters or clear them.</div>';
      return;
    }
    practice = { queue: queue, idx: Math.min(idx || 0, queue.length - 1), revealed: false, picks: [] };
    persistView();
    renderPractice();
  }
  function renderPractice() {
    var el = byId("tk-practice");
    if (!practice.queue.length) {
      el.innerHTML = '<div class="tk-card tk-empty">Pick a module, choose filters and hit <b>Practise these</b>, or use <b>Continue</b> / <b>Daily ' + CFG.daily + '</b> above to begin.</div>';
      return;
    }
    var q = practice.queue[practice.idx];
    if (!q) { el.innerHTML = renderDone(); wireDone(); return; }
    var isMC = q.type === "single" || q.type === "multi";
    var marked = progress[q.id];
    el.innerHTML =
      '<div class="tk-card">' +
        '<div class="tk-card-pills">' +
          '<span class="tk-pill tk-pill-topic">' + esc(q.topic) + '</span>' +
          '<span class="tk-pill">' + esc(levelOf(q)) + '</span>' +
          (q.role ? '<span class="tk-pill">' + esc(q.role) + '</span>' : "") +
          '<span class="tk-pill">' + esc(exType(q)) + '</span>' +
          (marked ? '<span class="tk-pill" style="color:var(--tk-accent)">seen · ' + esc(marked.result) + '</span>' : "") +
          '<button class="tk-star ' + (bookmarks.has(q.id) ? "is-on" : "") + '" id="tk-star" aria-label="Bookmark this question" aria-pressed="' + (bookmarks.has(q.id) ? "true" : "false") + '">' + (bookmarks.has(q.id) ? "★" : "☆") + '</button>' +
        '</div>' +
        '<div class="tk-prompt">' + fmt(q.prompt) + '</div>' +
        (isMC ? renderOptions(q) : renderOpen(q)) +
        (practice.revealed ? renderReveal(q, isMC) : "") +
        '<div class="tk-actions">' +
          (practice.revealed || !isMC ? "" : '<button class="tk-btn tk-btn-primary" id="tk-check">Check answer</button>') +
          (!isMC && !practice.revealed ? '<button class="tk-btn tk-btn-primary" id="tk-reveal">Reveal model answer</button>' : "") +
          '<button class="tk-btn" id="tk-prev"' + (practice.idx === 0 ? " disabled" : "") + '>← Prev</button>' +
          '<button class="tk-btn" id="tk-next">' + (practice.idx === practice.queue.length - 1 ? "Finish" : "Next →") + '</button>' +
          '<span class="tk-progress-text">' + (practice.idx + 1) + ' / ' + practice.queue.length + '</span>' +
        '</div>' +
      '</div>';
    wirePractice(q, isMC);
  }
  function renderOptions(q) {
    var keys = "ABCDEFGH";
    return '<div class="tk-options" id="tk-options" role="group" aria-label="Answer options">' +
      q.options.map(function (opt, i) {
        var cls = "tk-option";
        var picked = practice.picks.indexOf(i) !== -1;
        if (practice.revealed) {
          var correct = Array.isArray(q.answer) ? q.answer.indexOf(i) !== -1 : q.answer === i;
          if (correct) cls += " is-correct";
          else if (picked) cls += " is-wrong";
        }
        return '<button class="' + cls + '" data-idx="' + i + '" aria-pressed="' + (picked ? "true" : "false") + '"' + (practice.revealed ? " disabled" : "") + '>' +
          '<span class="tk-opt-key">' + keys[i] + '</span><span>' + fmt(opt) + '</span></button>';
      }).join("") + '</div>' +
      (q.type === "multi" && !practice.revealed ? '<div class="tk-open-hint">Select all that apply, then Check.</div>' : "");
  }
  function renderOpen(q) {
    return '<div class="tk-open-hint">Think it through (or jot / say your answer aloud), then reveal the model answer and self-rate.</div>';
  }
  function renderReveal(q, isMC) {
    var html = '<div class="tk-reveal">';
    if (isMC) {
      var correctArr = Array.isArray(q.answer) ? q.answer : [q.answer];
      html += '<div class="tk-answer-label">Correct answer</div><div class="tk-answer">' +
        correctArr.map(function (i) { return fmt(q.options[i]); }).join("<br>") + '</div>';
      if (q.explanation) html += '<div class="tk-expl">' + fmt(q.explanation) + '</div>';
    } else {
      if (q.model_answer) html += '<div class="tk-answer-label">Model answer</div><div class="tk-answer">' + fmt(q.model_answer) + '</div>';
      if (q.key_points && q.key_points.length) html += '<div class="tk-answer-label">Key points</div><ul class="tk-keypoints">' + q.key_points.map(function (k) { return '<li>' + fmt(k) + '</li>'; }).join("") + '</ul>';
      if (q.explanation) html += '<div class="tk-expl">' + fmt(q.explanation) + '</div>';
    }
    html += extras(q);
    if (!isMC) {
      var cur = progress[q.id] ? progress[q.id].result : null;
      html += '<div class="tk-selfrate"><span>Self-rate:</span>' +
        selfBtn("wrong", "Missed it", cur) + selfBtn("partial", "Partial", cur) + selfBtn("correct", "Got it", cur) + '</div>';
    }
    return html + '</div>';
  }
  function selfBtn(v, label, cur) {
    return '<button class="tk-btn' + (cur === v ? " tk-btn-primary" : "") + '" data-rate="' + v + '">' + label + '</button>';
  }
  function extras(q) {
    var rows = [];
    function add(label, val) { if (val) rows.push('<div class="tk-extra"><span class="tk-extra-label">' + label + '</span>' + fmt(val) + '</div>'); }
    add("Why the original confuses", q.why_confusing);
    add("Stronger alternative", q.stronger_alternative);
    add("Say it naturally", q.say_it_naturally);
    add("Common mistake", q.common_mistake);
    add("Production example", q.production_example);
    if (q.followups && q.followups.length) rows.push('<div class="tk-extra"><span class="tk-extra-label">Interviewer follow-ups</span><ul class="tk-extra-list">' + q.followups.map(function (f) { return '<li>' + fmt(f) + '</li>'; }).join("") + '</ul></div>');
    if (q.tags && q.tags.length) rows.push('<div class="tk-tags">' + q.tags.map(function (t) { return '<span class="tk-tag">' + esc(t) + '</span>'; }).join("") + '</div>');
    return rows.join("");
  }

  function wirePractice(q, isMC) {
    var star = byId("tk-star");
    star.onclick = function () {
      if (bookmarks.has(q.id)) bookmarks.delete(q.id); else bookmarks.add(q.id);
      persistBookmarks(); renderPractice();
    };
    if (isMC && !practice.revealed) {
      Array.prototype.forEach.call(root.querySelectorAll(".tk-option"), function (btn) {
        btn.onclick = function () {
          var i = parseInt(btn.dataset.idx, 10);
          if (q.type === "single") { practice.picks = [i]; }
          else { var p = practice.picks.indexOf(i); if (p === -1) practice.picks.push(i); else practice.picks.splice(p, 1); }
          renderPractice();
        };
      });
      var check = byId("tk-check");
      if (check) check.onclick = function () {
        if (!practice.picks.length) { alert("Pick an answer first."); return; }
        var correct = gradeMC(q, practice.picks);
        recordResult(q.id, correct ? "correct" : "wrong");
        practice.revealed = true; renderPractice();
      };
    }
    if (!isMC && !practice.revealed) {
      byId("tk-reveal").onclick = function () { practice.revealed = true; renderPractice(); };
    }
    if (practice.revealed && !isMC) {
      Array.prototype.forEach.call(root.querySelectorAll(".tk-selfrate [data-rate]"), function (btn) {
        btn.onclick = function () { recordResult(q.id, btn.dataset.rate); renderPractice(); };
      });
    }
    byId("tk-prev").onclick = function () { if (practice.idx > 0) { practice.idx--; practice.revealed = false; practice.picks = []; persistView(); renderPractice(); } };
    byId("tk-next").onclick = function () { practice.idx++; practice.revealed = false; practice.picks = []; persistView(); renderPractice(); };
  }
  function gradeMC(q, picks) {
    var want = (Array.isArray(q.answer) ? q.answer : [q.answer]).slice().sort();
    var got = picks.slice().sort();
    return want.length === got.length && want.every(function (v, i) { return v === got[i]; });
  }
  function recordResult(qid, result) {
    progress[qid] = { result: result, ts: Date.now() };
    persistProgress();
    // Live-refresh the readiness header without losing practice position.
    refreshOverview();
  }
  function refreshOverview() {
    var container = root.querySelector(".tk-overview");
    if (!container) return;
    var tmp = document.createElement("div");
    tmp.innerHTML = renderOverview(overallStats());
    container.replaceWith(tmp.firstChild);
    wireOverview();
    renderModules();
  }

  function renderDone() {
    var o = overallStats();
    return '<div class="tk-card" style="text-align:center">' +
      '<h2 class="tk-section-head" style="margin-top:0">Set complete ✓</h2>' +
      '<p>You practised ' + practice.queue.length + ' exercises. Readiness is now <b>' + o.readiness + '/100</b> (' + readinessVerdict(o.readiness, o.seen) + ').</p>' +
      '<div class="tk-actions" style="justify-content:center">' +
        '<button class="tk-btn tk-btn-primary" id="tk-again">↺ Practise again</button>' +
        (CFG.skillcheck ? '<a class="tk-btn" href="' + esc(CFG.skillcheck) + '">✓ Take the Skill Check</a>' : "") +
      '</div></div>';
  }
  function wireDone() {
    byId("tk-again").onclick = function () { practice.idx = 0; practice.revealed = false; practice.picks = []; renderPractice(); };
  }

  // ---- keyboard nav --------------------------------------------------------
  document.addEventListener("keydown", function (e) {
    if (!practice.queue.length) return;
    var tag = (e.target.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea") return;
    var q = practice.queue[practice.idx];
    if (!q) return;
    if (e.key === "ArrowRight") { var n = byId("tk-next"); if (n) n.click(); }
    else if (e.key === "ArrowLeft") { var p = byId("tk-prev"); if (p && !p.disabled) p.click(); }
    else if (e.key === "Enter") {
      var c = byId("tk-check") || byId("tk-reveal"); if (c) { e.preventDefault(); c.click(); }
    } else if (/^[1-8]$/.test(e.key) && !practice.revealed && (q.type === "single" || q.type === "multi")) {
      var opt = root.querySelector('.tk-option[data-idx="' + (parseInt(e.key, 10) - 1) + '"]');
      if (opt) opt.click();
    }
  });

  // ---- helpers -------------------------------------------------------------
  function byId(id) { return document.getElementById(id); }
  function scrollToPractice() {
    var el = byId("tk-practice");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  load();
})();
