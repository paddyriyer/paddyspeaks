// Kanda Shashti Kavacham - Interactive Application
// =================================================

(function () {
  'use strict';

  var data = SHASHTI_KAVACHAM_DATA;
  var currentLang = 'both'; // 'both', 'tamil', 'english'
  var searchTimer = null;

  // --- Escape HTML ---
  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // --- Highlight search text ---
  function highlightText(text, query) {
    if (!query) return escapeHtml(text);
    var escaped = escapeHtml(text);
    var queryEscaped = escapeHtml(query);
    var regex = new RegExp('(' + queryEscaped.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
    return escaped.replace(regex, '<mark>$1</mark>');
  }

  // --- Build lines HTML for a section ---
  function buildLinesHtml(lines) {
    var html = '';
    lines.forEach(function (line, idx) {
      html += '<div class="line-block">';
      html += '<div class="line-tamil">' + escapeHtml(line.tamil) + '</div>';
      html += '<div class="line-english">' + escapeHtml(line.english) + '</div>';
      html += '</div>';
    });
    return html;
  }

  // --- Build a section card ---
  function buildSectionCard(section) {
    var sectionClass = section.section;
    var lineCount = section.lines.length;

    var html = '<div class="section-card ' + sectionClass + '" id="section-' + section.section + '">';

    // Header
    html += '<div class="section-card-header" onclick="toggleSection(\'' + section.section + '\')">';
    html += '<span class="section-tag">' + escapeHtml(section.title) + '</span>';
    html += '<span class="section-title-tamil">' + escapeHtml(section.titleTamil) + '</span>';
    html += '<span style="flex:1"></span>';
    html += '<span style="font-size:0.75rem;color:#6b5744;">' + lineCount + ' lines</span>';
    html += '<span class="section-toggle">&#9660;</span>';
    html += '</div>';

    // Body
    html += '<div class="section-card-body">';
    html += buildLinesHtml(section.lines);
    html += '</div>';

    html += '</div>';
    return html;
  }

  // --- Build expand/collapse controls ---
  function buildControls() {
    return '<div class="expand-controls">' +
      '<button class="expand-btn" data-action="expand">Expand All</button>' +
      '<button class="expand-btn" data-action="collapse">Collapse All</button>' +
      '</div>';
  }

  // --- Build language toggle ---
  function buildLangToggle() {
    return '<div class="lang-toggle">' +
      '<button class="lang-btn active" data-lang="both">Tamil & English</button>' +
      '<button class="lang-btn" data-lang="tamil">Tamil Only</button>' +
      '<button class="lang-btn" data-lang="english">English Only</button>' +
      '</div>';
  }

  // --- Render All Sections ---
  function renderAllSections() {
    var container = document.getElementById('all-container');
    var html = buildLangToggle();
    html += buildControls();

    data.forEach(function (section) {
      html += buildSectionCard(section);
    });

    container.innerHTML = html;

    // Expand all sections by default
    data.forEach(function (section) {
      var el = document.getElementById('section-' + section.section);
      if (el) el.classList.add('expanded');
    });
  }

  // --- Render Search ---
  function renderSearch() {
    // search is set up in setupSearch()
  }

  // --- Toggle section expansion ---
  window.toggleSection = function (sectionId) {
    var el = document.getElementById('section-' + sectionId);
    if (el) el.classList.toggle('expanded');
  };

  // --- Language toggle ---
  function setupLangToggle() {
    document.addEventListener('click', function (e) {
      var btn = e.target.closest('.lang-btn');
      if (!btn) return;

      var lang = btn.getAttribute('data-lang');
      currentLang = lang;

      // Update buttons
      document.querySelectorAll('.lang-btn').forEach(function (b) {
        b.classList.remove('active');
      });
      btn.classList.add('active');

      // Update body class
      document.body.classList.remove('lang-tamil', 'lang-english');
      if (lang === 'tamil') {
        document.body.classList.add('lang-tamil');
      } else if (lang === 'english') {
        document.body.classList.add('lang-english');
      }
    });
  }

  // --- Expand/Collapse All handler ---
  function setupExpandCollapse() {
    document.addEventListener('click', function (e) {
      var btn = e.target.closest('.expand-btn');
      if (!btn) return;

      var action = btn.getAttribute('data-action');
      var cards = document.querySelectorAll('.section-card');
      cards.forEach(function (card) {
        if (action === 'expand') {
          card.classList.add('expanded');
        } else {
          card.classList.remove('expanded');
        }
      });
    });
  }

  // --- Search ---
  function setupSearch() {
    var input = document.getElementById('search-input');
    var results = document.getElementById('search-results');
    var count = document.getElementById('search-count');

    if (!input) return;

    input.addEventListener('input', function () {
      if (searchTimer) clearTimeout(searchTimer);
      searchTimer = setTimeout(function () {
        var query = input.value.trim().toLowerCase();
        if (query.length < 2) {
          results.innerHTML = '<p style="text-align:center;color:#6b5744;padding:2rem;">Type at least 2 characters to search...</p>';
          count.textContent = '';
          return;
        }

        var matches = [];
        data.forEach(function (section) {
          section.lines.forEach(function (line) {
            if (
              line.tamil.toLowerCase().includes(query) ||
              line.english.toLowerCase().includes(query)
            ) {
              matches.push({ line: line, section: section.title });
            }
          });
        });

        count.textContent = matches.length + ' found';

        if (matches.length === 0) {
          results.innerHTML = '<p style="text-align:center;color:#6b5744;padding:2rem;">No lines found matching "' + escapeHtml(query) + '"</p>';
          return;
        }

        var html = '';
        matches.forEach(function (match) {
          html += '<div class="line-block">';
          html += '<div style="font-size:0.65rem;text-transform:uppercase;letter-spacing:0.05em;color:#bf8c00;margin-bottom:0.3rem;">' + escapeHtml(match.section) + '</div>';
          html += '<div class="line-tamil">' + highlightText(match.line.tamil, query) + '</div>';
          html += '<div class="line-english">' + highlightText(match.line.english, query) + '</div>';
          html += '</div>';
        });
        results.innerHTML = html;
      }, 300);
    });
  }

  // --- View Navigation ---
  function setupNavigation() {
    var buttons = document.querySelectorAll('.nav-btn');
    buttons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var viewId = btn.getAttribute('data-view');

        buttons.forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');

        document.querySelectorAll('.view').forEach(function (v) {
          v.classList.remove('active');
        });
        document.getElementById(viewId + '-view').classList.add('active');
      });
    });
  }

  // --- Reading Progress & Scroll Buttons ---
  function setupProgressBar() {
    var scrollButtons = document.getElementById('scrollButtons');
    var scrollTopBtn = document.getElementById('scrollTopBtn');
    var scrollBottomBtn = document.getElementById('scrollBottomBtn');

    window.addEventListener('scroll', function () {
      var scrollTop = window.scrollY;
      var docHeight = document.documentElement.scrollHeight - window.innerHeight;
      var progress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
      document.getElementById('progressBar').style.width = progress + '%';

      // Show/hide scroll buttons
      if (scrollButtons) {
        if (scrollTop > 300) {
          scrollButtons.classList.add('visible');
        } else {
          scrollButtons.classList.remove('visible');
        }
      }
    });

    if (scrollTopBtn) {
      scrollTopBtn.addEventListener('click', function () {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }
    if (scrollBottomBtn) {
      scrollBottomBtn.addEventListener('click', function () {
        window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
      });
    }
  }

  // --- Keyboard Navigation ---
  function setupKeyboardNav() {
    document.addEventListener('keydown', function (e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      var cards = document.querySelectorAll('.view.active .section-card');
      if (cards.length === 0) return;
      var expandedCards = document.querySelectorAll('.view.active .section-card.expanded');
      var lastExpanded = expandedCards.length > 0 ? expandedCards[expandedCards.length - 1] : null;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        if (lastExpanded) {
          var next = lastExpanded.nextElementSibling;
          while (next && !next.classList.contains('section-card')) next = next.nextElementSibling;
          if (next) { next.classList.add('expanded'); next.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
        } else if (cards[0]) { cards[0].classList.add('expanded'); cards[0].scrollIntoView({ behavior: 'smooth', block: 'center' }); }
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (lastExpanded) {
          var prev = lastExpanded.previousElementSibling;
          while (prev && !prev.classList.contains('section-card')) prev = prev.previousElementSibling;
          if (prev) { prev.classList.add('expanded'); prev.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
        }
      } else if (e.key === 'Escape') {
        if (lastExpanded) lastExpanded.classList.remove('expanded');
      }
    });
  }

  // --- Initialize ---
  function init() {
    renderAllSections();
    setupSearch();
    setupNavigation();
    setupExpandCollapse();
    setupLangToggle();
    setupProgressBar();
    setupKeyboardNav();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
