// Narayaneeyam - Interactive Application
// =======================================

(function () {
  'use strict';

  if (typeof NARAYANEEYAM_DATA === 'undefined') {
    document.addEventListener('DOMContentLoaded', function() {
      document.querySelector('.content').innerHTML = '<p style="text-align:center;padding:3rem;color:#c62828;">Failed to load Narayaneeyam data. Please refresh the page.</p>';
    });
    return;
  }
  var data = NARAYANEEYAM_DATA;
  var currentDashaka = null;
  var searchTimer = null;
  var STORAGE_KEY = 'narayaneeyam-visited';

  // Theme color mapping
  var THEME_COLORS = {
    philosophy: '#5C6BC0',
    creation: '#26A69A',
    avatar: '#EF5350',
    leela: '#FFA726',
    devotion: '#EC407A',
    prayer: '#AB47BC'
  };

  var THEME_ICONS = {
    philosophy: '\u0950',
    creation: '\u2727',
    avatar: '\u2694',
    leela: '\u266B',
    devotion: '\u2764',
    prayer: '\u2022'
  };

  // --- Utility: Escape HTML ---
  function escapeHtml(str) {
    if (!str) return '';
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // --- Utility: Highlight search term in text ---
  function highlightText(text, query) {
    if (!query || !text) return escapeHtml(text);
    var escaped = escapeHtml(text);
    var queryEscaped = escapeHtml(query);
    var regex = new RegExp('(' + queryEscaped.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
    return escaped.replace(regex, '<mark>$1</mark>');
  }

  // --- Get dashaka by number ---
  function getDashaka(num) {
    for (var i = 0; i < data.dashakas.length; i++) {
      if (data.dashakas[i].dashaka === num) return data.dashakas[i];
    }
    return null;
  }

  // --- Get all slokas as flat array ---
  function getAllSlokas() {
    var slokas = [];
    data.dashakas.forEach(function (d) {
      if (d.slokas && d.slokas.length > 0) {
        d.slokas.forEach(function (s) {
          slokas.push(s);
        });
      }
    });
    return slokas;
  }

  // --- Reading Progress (localStorage) ---
  function getVisited() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function markVisited(dashakaNum) {
    var visited = getVisited();
    visited[dashakaNum] = Date.now();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(visited));
    } catch (e) {
      // Storage full or unavailable
    }
  }

  function getVisitedCount() {
    return Object.keys(getVisited()).length;
  }

  // --- Update reading progress display ---
  function updateReadingProgress() {
    var total = data.dashakas.length;
    var visited = getVisitedCount();
    var percent = total > 0 ? Math.round((visited / total) * 100) : 0;

    var bar = document.getElementById('progressBar');
    if (bar) {
      bar.style.width = percent + '%';
      bar.title = visited + ' of ' + total + ' dashakas visited (' + percent + '%)';
    }
  }

  // --- Build word grid HTML ---
  function buildWordGrid(words) {
    if (!words || words.length === 0) return '';
    var html = '<div class="word-grid">';
    words.forEach(function (w) {
      html += '<div class="word-card">';
      html += '<div class="word-devanagari">' + escapeHtml(w.word) + '</div>';
      if (w.transliteration) {
        html += '<div class="word-transliteration">' + escapeHtml(w.transliteration) + '</div>';
      }
      html += '<div class="word-meaning">' + escapeHtml(w.meaning) + '</div>';
      html += '</div>';
    });
    html += '</div>';
    return html;
  }

  // --- Build sloka card ID ---
  function slokaCardId(sloka) {
    return 'dashaka-' + sloka.dashaka + '-sloka-' + sloka.sloka;
  }

  // --- Build a single verse card HTML ---
  function buildVerseCard(sloka) {
    var cardId = slokaCardId(sloka);

    // Preview: first line of devanagari
    var preview = sloka.devanagari ? sloka.devanagari.split('\n')[0] : '';
    if (preview.length > 60) preview = preview.substring(0, 60) + '\u2026';

    var html = '<div class="verse-card" id="' + cardId + '">';

    // Header
    html += '<div class="verse-header" data-toggle-verse="' + cardId + '">';
    html += '<span class="verse-number">' + sloka.dashaka + '.' + sloka.sloka + '</span>';
    html += '<span class="verse-text-preview">' + escapeHtml(preview) + '</span>';
    html += '<span class="verse-toggle">&#9660;</span>';
    html += '</div>';

    // Body
    html += '<div class="verse-body">';

    // Devanagari text
    html += '<div class="sloka-devanagari">' + escapeHtml(sloka.devanagari) + '</div>';

    // Transliteration
    if (sloka.transliteration) {
      html += '<div class="sloka-transliteration">' + escapeHtml(sloka.transliteration) + '</div>';
    }

    // Word-by-word grid
    if (sloka.words && sloka.words.length > 0) {
      html += '<div class="word-section-label">Word-by-Word</div>';
      html += buildWordGrid(sloka.words);
    }

    // English translation
    if (sloka.translation) {
      html += '<div class="translation-block">';
      html += '<div class="translation-label">Translation</div>';
      html += '<div class="translation-text">' + escapeHtml(sloka.translation) + '</div>';
      html += '</div>';
    }

    // Commentary
    if (sloka.commentary) {
      html += '<div class="commentary-block">';
      html += '<div class="commentary-label">Commentary</div>';
      html += '<div class="commentary-text">' + escapeHtml(sloka.commentary) + '</div>';
      html += '</div>';
    }

    html += '</div>'; // verse-body
    html += '</div>'; // verse-card

    return html;
  }

  // --- Render Dashaka Grid (10x10 map) ---
  function renderDashakaGrid() {
    var container = document.getElementById('dashaka-grid');
    if (!container) return;

    var visited = getVisited();
    var html = '<div class="dashaka-grid-inner">';

    for (var i = 1; i <= 100; i++) {
      var d = getDashaka(i);
      var theme = d ? d.theme : 'philosophy';
      var color = THEME_COLORS[theme] || '#5C6BC0';
      var icon = THEME_ICONS[theme] || '\u2022';
      var title = d ? d.titleEnglish : 'Dashaka ' + i;
      var verseCount = d ? d.verseCount : 0;
      var isVisited = visited[i] ? true : false;
      var hasData = d && d.slokas && d.slokas.length > 0;

      html += '<div class="dashaka-card' + (isVisited ? ' visited' : '') + (hasData ? ' has-data' : '') + '"';
      html += ' data-dashaka="' + i + '"';
      html += ' style="border-top: 3px solid ' + color + '"';
      html += '>';
      html += '<div class="dashaka-card-number" style="color: ' + color + '">' + i + '</div>';
      html += '<div class="dashaka-card-icon" style="color: ' + color + '">' + icon + '</div>';
      html += '<div class="dashaka-card-title">' + escapeHtml(title) + '</div>';
      html += '<div class="dashaka-card-meta">' + verseCount + ' verses</div>';
      if (isVisited) {
        html += '<div class="dashaka-card-visited">\u2713</div>';
      }
      html += '</div>';
    }

    html += '</div>';

    // Theme legend
    html += '<div class="theme-legend">';
    Object.keys(THEME_COLORS).forEach(function (theme) {
      html += '<span class="legend-item">';
      html += '<span class="legend-color" style="background: ' + THEME_COLORS[theme] + '"></span>';
      html += '<span class="legend-label">' + theme.charAt(0).toUpperCase() + theme.slice(1) + '</span>';
      html += '</span>';
    });
    html += '</div>';

    // Reading stats
    var visitedCount = getVisitedCount();
    html += '<div class="reading-stats">';
    html += '<span>' + visitedCount + ' of 100 dashakas explored</span>';
    html += '</div>';

    container.innerHTML = html;

    // Bind click events
    container.querySelectorAll('.dashaka-card').forEach(function (card) {
      card.addEventListener('click', function () {
        var num = parseInt(card.getAttribute('data-dashaka'), 10);
        loadDashaka(num);
      });
    });
  }

  // --- Load a dashaka into detail view ---
  function loadDashaka(num) {
    if (num < 1 || num > 100) return;
    var d = getDashaka(num);
    currentDashaka = num;

    // Mark as visited and update URL hash
    markVisited(num);
    updateReadingProgress();
    history.replaceState(null, '', '#dashaka-' + num);

    // Switch views
    showView('reading');

    var container = document.getElementById('dashaka-detail');
    if (!container) return;

    var theme = d ? d.theme : 'philosophy';
    var color = THEME_COLORS[theme] || '#5C6BC0';

    var html = '';

    // Navigation controls
    html += '<div class="dashaka-nav-controls">';
    html += '<button class="nav-control-btn back-btn" data-action="back-to-grid">&larr; Dashaka Map</button>';
    html += '<div class="dashaka-nav-arrows">';
    if (num > 1) {
      html += '<button class="nav-control-btn prev-btn" data-action="prev-dashaka">&larr; Prev</button>';
    }
    if (num < 100) {
      html += '<button class="nav-control-btn next-btn" data-action="next-dashaka">Next &rarr;</button>';
    }
    html += '</div>';
    html += '</div>';

    // Dashaka header
    html += '<div class="dashaka-header" style="border-left: 4px solid ' + color + '">';
    html += '<div class="dashaka-header-number" style="color: ' + color + '">Dashaka ' + num + '</div>';
    if (d) {
      html += '<div class="dashaka-header-title-sanskrit">' + escapeHtml(d.titleSanskrit) + '</div>';
      html += '<div class="dashaka-header-title">' + escapeHtml(d.titleEnglish) + '</div>';
      html += '<div class="dashaka-header-theme">';
      html += '<span class="theme-badge" style="background: ' + color + '">' + escapeHtml(theme) + '</span>';
      html += '<span class="dashaka-verse-count">' + d.verseCount + ' verses</span>';
      html += '</div>';
      if (d.summary) {
        html += '<div class="dashaka-header-summary">' + escapeHtml(d.summary) + '</div>';
      }
    }
    html += '</div>';

    // Slokas
    if (d && d.slokas && d.slokas.length > 0) {
      // Expand/Collapse controls
      html += '<div class="expand-controls">';
      html += '<button class="expand-btn" data-action="expand">Expand All</button>';
      html += '<button class="expand-btn" data-action="collapse">Collapse All</button>';
      html += '</div>';

      d.slokas.forEach(function (sloka) {
        html += buildVerseCard(sloka);
      });
    } else {
      html += '<div class="coming-soon">';
      html += '<div class="coming-soon-icon">\uD83D\uDD49</div>';
      html += '<div class="coming-soon-title">Coming Soon</div>';
      html += '<div class="coming-soon-text">The slokas for Dashaka ' + num + ' are being prepared and will be available soon.</div>';
      html += '</div>';
    }

    container.innerHTML = html;

    // Expand first 2 slokas by default
    if (d && d.slokas) {
      d.slokas.slice(0, 2).forEach(function (sloka) {
        var el = document.getElementById(slokaCardId(sloka));
        if (el) el.classList.add('expanded');
      });
    }

    // Bind navigation button events
    bindDetailNavigation();

    // Scroll to top smoothly
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // --- Bind navigation buttons in detail view ---
  function bindDetailNavigation() {
    var container = document.getElementById('dashaka-detail');
    if (!container) return;

    var backBtn = container.querySelector('[data-action="back-to-grid"]');
    if (backBtn) {
      backBtn.addEventListener('click', function () {
        currentDashaka = null;
        showView('map');
      });
    }

    var prevBtn = container.querySelector('[data-action="prev-dashaka"]');
    if (prevBtn) {
      prevBtn.addEventListener('click', function () {
        if (currentDashaka > 1) loadDashaka(currentDashaka - 1);
      });
    }

    var nextBtn = container.querySelector('[data-action="next-dashaka"]');
    if (nextBtn) {
      nextBtn.addEventListener('click', function () {
        if (currentDashaka < 100) loadDashaka(currentDashaka + 1);
      });
    }
  }

  // --- Show a specific view ---
  function showView(viewName) {
    // Update nav buttons
    document.querySelectorAll('.nav-btn').forEach(function (btn) {
      if (btn.getAttribute('data-view') === viewName) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Toggle view sections via CSS (.view/.active) and aria-hidden
    document.querySelectorAll('.view').forEach(function (v) {
      v.classList.remove('active');
      v.setAttribute('aria-hidden', 'true');
    });
    var target = document.getElementById(viewName + '-view');
    if (target) {
      target.classList.add('active');
      target.setAttribute('aria-hidden', 'false');
    }

    // Re-render grid when returning to map view
    if (viewName === 'map') {
      renderDashakaGrid();
    }

    // Focus search input when switching to search
    if (viewName === 'search') {
      var input = document.getElementById('search-input');
      if (input) {
        setTimeout(function () { input.focus(); }, 100);
      }
    }
  }

  // --- Build search result card with highlights ---
  function buildSearchResultCard(sloka, query, matchedField) {
    var cardId = 'search-' + slokaCardId(sloka);

    var html = '<div class="verse-card expanded" id="' + cardId + '">';

    // Header
    html += '<div class="verse-header">';
    html += '<span class="verse-number">' + sloka.dashaka + '.' + sloka.sloka + '</span>';
    html += '<span class="search-match-field">Matched in: ' + escapeHtml(matchedField) + '</span>';
    html += '</div>';

    // Body (always expanded for search results)
    html += '<div class="verse-body">';

    // Devanagari
    if (sloka.devanagari) {
      html += '<div class="sloka-devanagari">' + highlightText(sloka.devanagari, query) + '</div>';
    }

    // Transliteration
    if (sloka.transliteration) {
      html += '<div class="sloka-transliteration">' + highlightText(sloka.transliteration, query) + '</div>';
    }

    // Word-by-word
    if (sloka.words && sloka.words.length > 0) {
      html += '<div class="word-section-label">Word-by-Word</div>';
      html += '<div class="word-grid">';
      sloka.words.forEach(function (w) {
        html += '<div class="word-card">';
        html += '<div class="word-devanagari">' + highlightText(w.word, query) + '</div>';
        if (w.transliteration) {
          html += '<div class="word-transliteration">' + highlightText(w.transliteration, query) + '</div>';
        }
        html += '<div class="word-meaning">' + highlightText(w.meaning, query) + '</div>';
        html += '</div>';
      });
      html += '</div>';
    }

    // Translation
    if (sloka.translation) {
      html += '<div class="translation-block">';
      html += '<div class="translation-label">Translation</div>';
      html += '<div class="translation-text">' + highlightText(sloka.translation, query) + '</div>';
      html += '</div>';
    }

    // Commentary
    if (sloka.commentary) {
      html += '<div class="commentary-block">';
      html += '<div class="commentary-label">Commentary</div>';
      html += '<div class="commentary-text">' + highlightText(sloka.commentary, query) + '</div>';
      html += '</div>';
    }

    html += '</div>'; // verse-body
    html += '</div>'; // verse-card

    return html;
  }

  // --- Determine which field matched ---
  function getMatchedField(sloka, query) {
    var q = query.toLowerCase();
    var fields = [];

    if (sloka.devanagari && sloka.devanagari.toLowerCase().indexOf(q) !== -1) fields.push('Sanskrit');
    if (sloka.transliteration && sloka.transliteration.toLowerCase().indexOf(q) !== -1) fields.push('Transliteration');
    if (sloka.translation && sloka.translation.toLowerCase().indexOf(q) !== -1) fields.push('Translation');
    if (sloka.commentary && sloka.commentary.toLowerCase().indexOf(q) !== -1) fields.push('Commentary');

    if (sloka.words) {
      for (var i = 0; i < sloka.words.length; i++) {
        var w = sloka.words[i];
        if (
          (w.word && w.word.toLowerCase().indexOf(q) !== -1) ||
          (w.transliteration && w.transliteration.toLowerCase().indexOf(q) !== -1) ||
          (w.meaning && w.meaning.toLowerCase().indexOf(q) !== -1)
        ) {
          fields.push('Word Meanings');
          break;
        }
      }
    }

    return fields.length > 0 ? fields.join(', ') : 'Content';
  }

  // --- Search Setup ---
  function setupSearch() {
    var input = document.getElementById('search-input');
    var results = document.getElementById('search-results');
    var count = document.getElementById('search-count');
    if (!input || !results || !count) return;

    var allSlokas = getAllSlokas();

    input.addEventListener('input', function () {
      if (searchTimer) clearTimeout(searchTimer);

      searchTimer = setTimeout(function () {
        var query = input.value.trim().toLowerCase();
        if (query.length < 2) {
          results.innerHTML = '<p style="text-align:center;color:#6b5744;padding:2rem;">Type at least 2 characters to search\u2026</p>';
          count.textContent = '';
          return;
        }

        var matches = allSlokas.filter(function (sloka) {
          // Match by verse reference
          var verseRef = sloka.dashaka + '.' + sloka.sloka;
          if (verseRef === query) return true;

          // Match by content fields
          if (sloka.devanagari && sloka.devanagari.toLowerCase().indexOf(query) !== -1) return true;
          if (sloka.transliteration && sloka.transliteration.toLowerCase().indexOf(query) !== -1) return true;
          if (sloka.translation && sloka.translation.toLowerCase().indexOf(query) !== -1) return true;
          if (sloka.commentary && sloka.commentary.toLowerCase().indexOf(query) !== -1) return true;

          // Match by word meanings
          if (sloka.words) {
            for (var i = 0; i < sloka.words.length; i++) {
              var w = sloka.words[i];
              if (
                (w.word && w.word.toLowerCase().indexOf(query) !== -1) ||
                (w.transliteration && w.transliteration.toLowerCase().indexOf(query) !== -1) ||
                (w.meaning && w.meaning.toLowerCase().indexOf(query) !== -1)
              ) return true;
            }
          }

          return false;
        });

        count.textContent = matches.length + ' found';

        if (matches.length === 0) {
          results.innerHTML = '<p style="text-align:center;color:#6b5744;padding:2rem;">No slokas found matching \u201C' + escapeHtml(query) + '\u201D</p>';
          return;
        }

        var html = '';
        matches.forEach(function (sloka) {
          var matchedField = getMatchedField(sloka, query);
          html += buildSearchResultCard(sloka, query, matchedField);
        });
        results.innerHTML = html;
      }, 300);
    });
  }

  // --- Toggle verse expansion via event delegation ---
  document.addEventListener('click', function (e) {
    var header = e.target.closest('[data-toggle-verse]');
    if (header) {
      var id = header.getAttribute('data-toggle-verse');
      var el = document.getElementById(id);
      if (el) el.classList.toggle('expanded');
    }
  });

  // --- Expand/Collapse All handler ---
  function setupExpandCollapse() {
    document.addEventListener('click', function (e) {
      var btn = e.target.closest('.expand-btn');
      if (!btn) return;

      var action = btn.getAttribute('data-action');
      if (action === 'expand' || action === 'collapse') {
        var detail = document.getElementById('dashaka-detail');
        if (!detail) return;

        var cards = detail.querySelectorAll('.verse-card');
        cards.forEach(function (card) {
          if (action === 'expand') {
            card.classList.add('expanded');
          } else {
            card.classList.remove('expanded');
          }
        });
      }
    });
  }

  // --- View Navigation Setup ---
  function setupNavigation() {
    var buttons = document.querySelectorAll('[data-view]');
    buttons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var viewName = btn.getAttribute('data-view');
        showView(viewName);
      });
    });
  }

  // --- Scroll Progress & Scroll Buttons ---
  function setupScrollHandlers() {
    var scrollBtns = document.getElementById('scrollButtons');

    window.addEventListener('scroll', function () {
      // Show/hide floating scroll buttons
      if (scrollBtns) {
        if (window.scrollY > 300) {
          scrollBtns.classList.add('visible');
        } else {
          scrollBtns.classList.remove('visible');
        }
      }
    });

    // Scroll to top button
    var topBtn = document.getElementById('scrollTopBtn');
    if (topBtn) {
      topBtn.addEventListener('click', function () {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }

    // Scroll to bottom button
    var bottomBtn = document.getElementById('scrollBottomBtn');
    if (bottomBtn) {
      bottomBtn.addEventListener('click', function () {
        window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
      });
    }
  }

  // --- Keyboard Navigation ---
  function setupKeyboardNavigation() {
    document.addEventListener('keydown', function (e) {
      // Only handle if not typing in an input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      switch (e.key) {
        case 'Escape':
          if (currentDashaka !== null) {
            currentDashaka = null;
            showView('map');
            e.preventDefault();
          }
          break;

        case 'ArrowLeft':
          if (currentDashaka !== null && currentDashaka > 1) {
            loadDashaka(currentDashaka - 1);
            e.preventDefault();
          }
          break;

        case 'ArrowRight':
          if (currentDashaka !== null && currentDashaka < 100) {
            loadDashaka(currentDashaka + 1);
            e.preventDefault();
          }
          break;
      }
    });
  }

  // --- URL Hash Navigation ---
  function handleHashNavigation() {
    var hash = window.location.hash;
    if (!hash) return;

    // Expected format: #dashaka-N or #dashaka-N-sloka-M
    var dashakaMatch = hash.match(/^#dashaka-(\d+)$/);
    var slokaMatch = hash.match(/^#dashaka-(\d+)-sloka-(\d+)$/);

    if (slokaMatch) {
      var dNum = parseInt(slokaMatch[1], 10);
      var sNum = parseInt(slokaMatch[2], 10);
      loadDashaka(dNum);
      // Scroll to specific sloka after render
      setTimeout(function () {
        var el = document.getElementById('dashaka-' + dNum + '-sloka-' + sNum);
        if (el) {
          el.classList.add('expanded');
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 200);
    } else if (dashakaMatch) {
      var num = parseInt(dashakaMatch[1], 10);
      loadDashaka(num);
    }
  }

  // --- Initialize Application ---
  function init() {
    // Render the dashaka grid
    renderDashakaGrid();

    // Set up search
    setupSearch();

    // Set up expand/collapse
    setupExpandCollapse();

    // Set up view navigation
    setupNavigation();

    // Set up scroll handlers
    setupScrollHandlers();

    // Set up keyboard navigation
    setupKeyboardNavigation();

    // Update reading progress
    updateReadingProgress();

    // Default view: show grid, hide others
    showView('map');

    // Handle hash navigation (if URL has a hash)
    handleHashNavigation();

    // Listen for hash changes
    window.addEventListener('hashchange', handleHashNavigation);
  }

  // --- Start ---
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
