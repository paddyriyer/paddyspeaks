// Medha Suktam - Interactive Application
// ==========================================

(function () {
  'use strict';

  var data = STOTRAM_DATA;

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function highlightText(text, query) {
    if (!query) return escapeHtml(text);
    var escaped = escapeHtml(text);
    var queryEscaped = escapeHtml(query);
    var regex = new RegExp('(' + queryEscaped.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
    return escaped.replace(regex, '<mark>$1</mark>');
  }

  function getTypeLabel(type) {
    switch (type) {
      case 'invocation': return 'Invocation';
      case 'prayer': return 'Prayer for Wisdom';
      case 'blessing': return 'Blessings';
      default: return 'Verse';
    }
  }

  function buildVerseCard(verse, prefix, query) {
    var typeClass = verse.type + '-type';
    var typeLabel = getTypeLabel(verse.type);
    var cardId = (prefix || 'r') + '-' + verse.type + '-' + verse.num;

    var preview = verse.devanagari.split('\n')[0];
    if (preview.length > 50) preview = preview.substring(0, 50) + '...';

    var html = '<div class="verse-card ' + typeClass + '" id="' + cardId + '">';

    html += '<div class="verse-header" onclick="toggleVerse(\'' + cardId + '\')">';
    html += '<span class="verse-number">' + verse.num + '</span>';
    html += '<span class="verse-text-preview">' + (query ? highlightText(preview, query) : escapeHtml(preview)) + '</span>';
    html += '<span class="verse-type-tag">' + typeLabel + '</span>';
    html += '<span class="verse-toggle">&#9660;</span>';
    html += '</div>';

    html += '<div class="verse-body">';
    html += '<div class="devanagari-block">' + (query ? highlightText(verse.devanagari, query) : escapeHtml(verse.devanagari)) + '</div>';
    html += '<div class="transliteration-block">' + (query ? highlightText(verse.transliteration, query) : escapeHtml(verse.transliteration)) + '</div>';
    html += '<div class="english-block">';
    html += '<div class="english-label">English Translation</div>';
    html += '<div class="english-text">' + (query ? highlightText(verse.translation, query) : escapeHtml(verse.translation)) + '</div>';
    html += '</div>';
    html += '</div>';
    html += '</div>';

    return html;
  }

  function buildControls() {
    return '<div class="expand-controls">' +
      '<button class="expand-btn" data-action="expand">Expand All</button>' +
      '<button class="expand-btn" data-action="collapse">Collapse All</button>' +
      '</div>';
  }

  function renderReading() {
    var container = document.getElementById('reading-container');
    var html = buildControls();

    html += '<div class="section-divider">Invocation of Medha (1&ndash;3)</div>';
    data.verses.forEach(function (v) {
      if (v.type === 'invocation') html += buildVerseCard(v, 'ri');
    });

    html += '<div class="section-divider">Prayer for Wisdom (4&ndash;7)</div>';
    data.verses.forEach(function (v) {
      if (v.type === 'prayer') html += buildVerseCard(v, 'rp');
    });

    html += '<div class="section-divider">Blessings &amp; Culmination (8&ndash;11)</div>';
    data.verses.forEach(function (v) {
      if (v.type === 'blessing') html += buildVerseCard(v, 'rb');
    });

    container.innerHTML = html;
  }

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
    });

    container.innerHTML = html;
    container.querySelectorAll('.verse-card').forEach(function (card) {
      card.classList.add('expanded');
    });
  }

  window.toggleVerse = function (id) {
    var card = document.getElementById(id);
    if (card) card.classList.toggle('expanded');
  };

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

  function init() {
    renderReading();

    var navBtns = document.querySelectorAll('.nav-btn');
    navBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var viewName = btn.getAttribute('data-view');
        navBtns.forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        var views = document.querySelectorAll('.view');
        views.forEach(function (v) { v.classList.remove('active'); });
        var target = document.getElementById(viewName + '-view');
        if (target) target.classList.add('active');
        if (viewName === 'search') {
          var input = document.getElementById('search-input');
          if (input) setTimeout(function () { input.focus(); }, 100);
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });

    var searchInput = document.getElementById('search-input');
    var searchTimeout;
    searchInput.addEventListener('input', function () {
      clearTimeout(searchTimeout);
      var val = searchInput.value;
      searchTimeout = setTimeout(function () { renderSearch(val); }, 300);
    });

    document.addEventListener('click', function (e) {
      if (e.target.classList.contains('expand-btn')) {
        var action = e.target.getAttribute('data-action');
        var section = e.target.closest('.section-block') || e.target.closest('.view');
        if (section) {
          section.querySelectorAll('.verse-card').forEach(function (card) {
            if (action === 'expand') card.classList.add('expanded');
            else card.classList.remove('expanded');
          });
        }
      }
    });

    var scrollButtons = document.getElementById('scrollButtons');
    var scrollTopBtn = document.getElementById('scrollTopBtn');
    var scrollBottomBtn = document.getElementById('scrollBottomBtn');

    if (scrollTopBtn) scrollTopBtn.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });
    if (scrollBottomBtn) scrollBottomBtn.addEventListener('click', function () { window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' }); });

    window.addEventListener('scroll', function () {
      var scrollTop = window.scrollY;
      var docHeight = document.documentElement.scrollHeight - window.innerHeight;
      var progress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
      var bar = document.getElementById('progressBar');
      if (bar) bar.style.width = Math.min(progress, 100) + '%';
      if (scrollButtons) {
        if (scrollTop > 300) scrollButtons.classList.add('visible');
        else scrollButtons.classList.remove('visible');
      }
    });

    setupKeyboardNav();
    renderSearch('');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
