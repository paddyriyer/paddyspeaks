// Bhaja Govindam - Interactive Application
// ============================================

(function () {
  'use strict';

  var verses = BHAJA_GOVINDAM_DATA;
  var searchTimer = null;

  // Shankara's original 12 verses: 1-12
  // Transitional/disciple verses: 13-31
  function isShankara(num) {
    return num <= 12;
  }

  // --- Utility: Escape HTML ---
  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // --- Utility: Highlight search text ---
  function highlightText(text, query) {
    if (!query) return escapeHtml(text);
    var escaped = escapeHtml(text);
    var queryEscaped = escapeHtml(query);
    var regex = new RegExp('(' + queryEscaped.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
    return escaped.replace(regex, '<mark>$1</mark>');
  }

  // --- Build a single verse card HTML ---
  function buildVerseCard(verse, query, prefix) {
    var num = verse.num;
    var idPrefix = prefix || 'all';
    var isShankaraVerse = isShankara(num);
    var sectionClass = isShankaraVerse ? 'shankara-verse' : 'disciple-verse';
    var sectionTag = isShankaraVerse ? 'Shankara' : 'Disciples';

    var preview = verse.sanskrit.split('\n')[0];
    if (preview.length > 50) preview = preview.substring(0, 50) + '...';

    var hl = query ? function (t) { return highlightText(t, query); } : function (t) { return escapeHtml(t); };

    var cardId = idPrefix + '-verse-' + num;
    var html = '<div class="verse-card ' + sectionClass + '" id="' + cardId + '">';

    // Header
    html += '<div class="verse-header" onclick="toggleVerse(\'' + cardId + '\')">';
    html += '<span class="verse-number">' + num + '</span>';
    html += '<span class="verse-text-preview">' + hl(preview) + '</span>';
    html += '<span class="verse-section-tag">' + sectionTag + '</span>';
    html += '<span class="verse-toggle">&#9660;</span>';
    html += '</div>';

    // Body
    html += '<div class="verse-body">';

    // Sanskrit text
    html += '<div class="sanskrit-block">' + hl(verse.sanskrit) + '</div>';

    // Transliteration
    html += '<div class="transliteration-block">' + hl(verse.transliteration) + '</div>';

    // English Translation
    html += '<div class="translation-block">';
    html += '<div class="translation-label">English Translation</div>';
    html += '<div class="translation-text">' + hl(verse.translation) + '</div>';
    html += '</div>';

    // Real Life Meaning
    html += '<div class="reallife-block">';
    html += '<div class="reallife-label">Why Shankara Said This</div>';
    html += '<div class="reallife-text">' + hl(verse.realLife) + '</div>';
    html += '</div>';

    html += '</div>'; // verse-body
    html += '</div>'; // verse-card

    return html;
  }

  // --- Build expand/collapse controls ---
  function buildControls() {
    return '<div class="expand-controls">' +
      '<button class="expand-btn" data-action="expand">Expand All</button>' +
      '<button class="expand-btn" data-action="collapse">Collapse All</button>' +
      '</div>';
  }

  // --- Render All Verses ---
  function renderAllVerses() {
    var container = document.getElementById('all-container');
    var html = buildControls();

    verses.forEach(function (verse) {
      html += buildVerseCard(verse, null, 'all');
    });

    container.innerHTML = html;

    // Expand first 3 by default
    for (var i = 1; i <= 3; i++) {
      var el = document.getElementById('all-verse-' + i);
      if (el) el.classList.add('expanded');
    }
  }

  // --- Render Shankara's Twelve ---
  function renderShankaraVerses() {
    var container = document.getElementById('shankara-container');
    var shankaraVerses = verses.filter(function (v) { return isShankara(v.num); });

    var html = buildControls();
    shankaraVerses.forEach(function (verse) {
      html += buildVerseCard(verse, null, 'shankara');
    });

    container.innerHTML = html;
  }

  // --- Render Disciples' Verses ---
  function renderDiscipleVerses() {
    var container = document.getElementById('disciples-container');
    var discipleVerses = verses.filter(function (v) { return !isShankara(v.num); });

    var html = buildControls();
    discipleVerses.forEach(function (verse) {
      html += buildVerseCard(verse, null, 'disciples');
    });

    container.innerHTML = html;
  }

  // --- Toggle verse expansion ---
  window.toggleVerse = function (cardId) {
    var el = document.getElementById(cardId);
    if (el) el.classList.toggle('expanded');
  };

  // --- Expand/Collapse All handler ---
  function setupExpandCollapse() {
    document.addEventListener('click', function (e) {
      var btn = e.target.closest('.expand-btn');
      if (!btn) return;

      var action = btn.getAttribute('data-action');
      var container = btn.closest('.section-block');
      if (!container) return;

      var cards = container.querySelectorAll('.verse-card');
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

    input.addEventListener('input', function () {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(function () {
        var query = input.value.trim().toLowerCase();
        if (query.length < 2) {
          results.innerHTML = '<p style="text-align:center;color:#6b5240;padding:2rem;">Type at least 2 characters to search...</p>';
          count.textContent = '';
          return;
        }

        var matches = verses.filter(function (verse) {
          return (
            String(verse.num) === query ||
            verse.sanskrit.toLowerCase().includes(query) ||
            verse.transliteration.toLowerCase().includes(query) ||
            verse.translation.toLowerCase().includes(query) ||
            verse.realLife.toLowerCase().includes(query)
          );
        });

        count.textContent = matches.length + ' found';

        if (matches.length === 0) {
          results.innerHTML = '<p style="text-align:center;color:#6b5240;padding:2rem;">No verses found matching "' + escapeHtml(query) + '"</p>';
          return;
        }

        var html = '';
        matches.forEach(function (verse) {
          html += buildVerseCard(verse, query, 'search');
        });
        results.innerHTML = html;

        // Expand all search results
        results.querySelectorAll('.verse-card').forEach(function (card) {
          card.classList.add('expanded');
        });
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
    var scrollBtns = document.getElementById('scrollButtons');
    window.addEventListener('scroll', function () {
      var scrollTop = window.scrollY;
      var docHeight = document.documentElement.scrollHeight - window.innerHeight;
      var progress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
      document.getElementById('progressBar').style.width = progress + '%';

      if (scrollBtns) {
        if (scrollTop > 300) scrollBtns.classList.add('visible');
        else scrollBtns.classList.remove('visible');
      }
    });

    var topBtn = document.getElementById('scrollTopBtn');
    if (topBtn) topBtn.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });
    var bottomBtn = document.getElementById('scrollBottomBtn');
    if (bottomBtn) bottomBtn.addEventListener('click', function () { window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' }); });
  }

  // --- Keyboard Navigation ---
  function setupKeyboardNav() {
    document.addEventListener('keydown', function (e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      var cards = document.querySelectorAll('.view.active .verse-card');
      if (cards.length === 0) return;
      var expandedCards = document.querySelectorAll('.view.active .verse-card.expanded');
      var lastExpanded = expandedCards.length > 0 ? expandedCards[expandedCards.length - 1] : null;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        if (lastExpanded) {
          var next = lastExpanded.nextElementSibling;
          while (next && !next.classList.contains('verse-card')) next = next.nextElementSibling;
          if (next) { next.classList.add('expanded'); next.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
        } else if (cards[0]) { cards[0].classList.add('expanded'); cards[0].scrollIntoView({ behavior: 'smooth', block: 'center' }); }
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (lastExpanded) {
          var prev = lastExpanded.previousElementSibling;
          while (prev && !prev.classList.contains('verse-card')) prev = prev.previousElementSibling;
          if (prev) { prev.classList.add('expanded'); prev.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
        }
      } else if (e.key === 'Escape') {
        if (lastExpanded) lastExpanded.classList.remove('expanded');
      }
    });
  }

  // --- Initialize ---
  function init() {
    renderAllVerses();
    renderShankaraVerses();
    renderDiscipleVerses();
    setupSearch();
    setupNavigation();
    setupExpandCollapse();
    setupProgressBar();
    setupKeyboardNav();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
