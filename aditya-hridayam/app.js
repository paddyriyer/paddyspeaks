// Aditya Hridayam - Interactive Application
// ============================================

(function () {
  'use strict';

  var data = STOTRAM_DATA;

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

  // --- Get type label ---
  function getTypeLabel(type) {
    switch (type) {
      case 'intro': return 'Introduction';
      case 'praise': return 'Praise of Surya';
      case 'prayer': return 'Prayer';
      case 'phala': return 'Phala Shruti';
      default: return 'Verse';
    }
  }

  // --- Build a single verse card HTML ---
  function buildVerseCard(verse, prefix, query) {
    var typeClass = verse.type + '-type';
    var typeLabel = getTypeLabel(verse.type);
    var cardId = (prefix || 'r') + '-' + verse.type + '-' + verse.num;

    var preview = verse.devanagari.split('\n')[0];
    if (preview.length > 50) preview = preview.substring(0, 50) + '...';

    var html = '<div class="verse-card ' + typeClass + '" id="' + cardId + '">';

    // Header
    html += '<div class="verse-header" onclick="toggleVerse(\'' + cardId + '\')">';
    html += '<span class="verse-number">' + verse.num + '</span>';
    html += '<span class="verse-text-preview">' + (query ? highlightText(preview, query) : escapeHtml(preview)) + '</span>';
    html += '<span class="verse-type-tag">' + typeLabel + '</span>';
    html += '<span class="verse-toggle">&#9660;</span>';
    html += '</div>';

    // Body
    html += '<div class="verse-body">';

    // Devanagari text
    html += '<div class="devanagari-block">' + (query ? highlightText(verse.devanagari, query) : escapeHtml(verse.devanagari)) + '</div>';

    // Transliteration
    html += '<div class="transliteration-block">' + (query ? highlightText(verse.transliteration, query) : escapeHtml(verse.transliteration)) + '</div>';

    // English translation
    html += '<div class="english-block">';
    html += '<div class="english-label">English Translation</div>';
    html += '<div class="english-text">' + (query ? highlightText(verse.translation, query) : escapeHtml(verse.translation)) + '</div>';
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

  // --- Render Reading View ---
  function renderReading() {
    var container = document.getElementById('reading-container');
    var html = buildControls();

    // Introduction
    html += '<div class="section-divider">Introduction (1&ndash;3)</div>';
    data.verses.forEach(function (v) {
      if (v.type === 'intro') html += buildVerseCard(v, 'rd');
    });

    // Praise of Surya
    html += '<div class="section-divider">Praise of Surya (4&ndash;15)</div>';
    data.verses.forEach(function (v) {
      if (v.type === 'praise') html += buildVerseCard(v, 'rp');
    });

    // Prayer
    html += '<div class="section-divider">The Prayer (16&ndash;24)</div>';
    data.verses.forEach(function (v) {
      if (v.type === 'prayer') html += buildVerseCard(v, 'rv');
    });

    // Phala Shruti
    html += '<div class="section-divider">Phala Shruti &mdash; Victory of Rama (25&ndash;31)</div>';
    data.verses.forEach(function (v) {
      if (v.type === 'phala') html += buildVerseCard(v, 'rf');
    });

    container.innerHTML = html;
  }

  // --- Search ---
  function renderSearch(query) {
    var container = document.getElementById('search-results');
    var countEl = document.getElementById('search-count');

    if (!query || query.length < 2) {
      container.innerHTML = '<p style="text-align:center; color: var(--color-text-muted); padding: 2rem;">Type at least 2 characters to search...</p>';
      countEl.textContent = '';
      return;
    }

    var q = query.toLowerCase();
    var results = [];

    data.verses.forEach(function (v) {
      if (
        v.devanagari.toLowerCase().indexOf(q) !== -1 ||
        v.transliteration.toLowerCase().indexOf(q) !== -1 ||
        v.translation.toLowerCase().indexOf(q) !== -1 ||
        String(v.num).indexOf(q) !== -1
      ) {
        results.push(v);
      }
    });

    countEl.textContent = results.length + ' found';

    if (results.length === 0) {
      container.innerHTML = '<p style="text-align:center; color: var(--color-text-muted); padding: 2rem;">No results found for "' + escapeHtml(query) + '"</p>';
      return;
    }

    var html = '';
    results.forEach(function (v, i) {
      html += buildVerseCard(v, 'sr' + i, query);
      // Auto-expand search results
      html = html.replace('id="sr' + i, 'id="sr' + i);
    });

    // Make all search results expanded
    container.innerHTML = html;
    container.querySelectorAll('.verse-card').forEach(function (card) {
      card.classList.add('expanded');
    });
  }

  // --- Toggle verse expand/collapse ---
  window.toggleVerse = function (id) {
    var card = document.getElementById(id);
    if (card) {
      card.classList.toggle('expanded');
    }
  };

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
    renderReading();

    // View navigation
    var navBtns = document.querySelectorAll('.nav-btn');
    navBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var viewName = btn.getAttribute('data-view');

        navBtns.forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');

        var views = document.querySelectorAll('.view');
        views.forEach(function (v) { v.classList.remove('active'); });

        var target = document.getElementById(viewName + '-view');
        if (target) {
          target.classList.add('active');
        }

        if (viewName === 'search') {
          var input = document.getElementById('search-input');
          if (input) setTimeout(function () { input.focus(); }, 100);
        }

        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });

    // Search
    var searchInput = document.getElementById('search-input');
    var searchTimeout;
    searchInput.addEventListener('input', function () {
      clearTimeout(searchTimeout);
      var val = searchInput.value;
      searchTimeout = setTimeout(function () {
        renderSearch(val);
      }, 300);
    });

    // Expand/Collapse buttons
    document.addEventListener('click', function (e) {
      if (e.target.classList.contains('expand-btn')) {
        var action = e.target.getAttribute('data-action');
        var section = e.target.closest('.section-block') || e.target.closest('.view');
        if (section) {
          var cards = section.querySelectorAll('.verse-card');
          cards.forEach(function (card) {
            if (action === 'expand') {
              card.classList.add('expanded');
            } else {
              card.classList.remove('expanded');
            }
          });
        }
      }
    });

    // Reading progress & scroll buttons
    var scrollButtons = document.getElementById('scrollButtons');
    var scrollTopBtn = document.getElementById('scrollTopBtn');
    var scrollBottomBtn = document.getElementById('scrollBottomBtn');

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

    window.addEventListener('scroll', function () {
      var scrollTop = window.scrollY;
      var docHeight = document.documentElement.scrollHeight - window.innerHeight;
      var progress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
      var bar = document.getElementById('progressBar');
      if (bar) bar.style.width = Math.min(progress, 100) + '%';

      // Show/hide scroll buttons
      if (scrollButtons) {
        if (scrollTop > 300) {
          scrollButtons.classList.add('visible');
        } else {
          scrollButtons.classList.remove('visible');
        }
      }
    });

    // Keyboard navigation
    setupKeyboardNav();

    // Render initial search placeholder
    renderSearch('');
  }

  // Wait for DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
