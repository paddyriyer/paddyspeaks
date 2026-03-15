// Soundarya Lahari - Interactive Application
// ============================================

(function () {
  'use strict';

  var slokas = SOUNDARYA_LAHARI_DATA;
  var searchTimer = null;

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
  function buildVerseCard(sloka) {
    var num = sloka.num;
    var isAnanda = num <= 41;
    var sectionClass = isAnanda ? 'ananda-verse' : 'soundarya-verse';
    var sectionTag = isAnanda ? 'Ananda' : 'Soundarya';

    // Preview: first line of Sanskrit
    var preview = sloka.sanskrit.split('\n')[0];
    if (preview.length > 50) preview = preview.substring(0, 50) + '...';

    var html = '<div class="verse-card ' + sectionClass + '" id="verse-' + num + '">';

    // Header
    html += '<div class="verse-header" onclick="toggleVerse(' + num + ')">';
    html += '<span class="verse-number">' + num + '</span>';
    html += '<span class="verse-text-preview">' + escapeHtml(preview) + '</span>';
    html += '<span class="verse-section-tag">' + sectionTag + '</span>';
    html += '<span class="verse-toggle">&#9660;</span>';
    html += '</div>';

    // Body
    html += '<div class="verse-body">';

    // Sanskrit text
    html += '<div class="sanskrit-block">' + escapeHtml(sloka.sanskrit) + '</div>';

    // Transliteration
    html += '<div class="transliteration-block">' + escapeHtml(sloka.transliteration) + '</div>';

    // Meaning
    html += '<div class="meaning-block">';
    html += '<div class="meaning-label">Meaning</div>';
    html += '<div class="meaning-text">' + escapeHtml(sloka.meaning) + '</div>';
    html += '</div>';

    // Esoteric interpretation
    html += '<div class="esoteric-block">';
    html += '<div class="esoteric-label">Esoteric Interpretation</div>';
    html += '<div class="esoteric-text">' + escapeHtml(sloka.esoteric) + '</div>';
    html += '</div>';

    html += '</div>'; // verse-body
    html += '</div>'; // verse-card

    return html;
  }

  // --- Build expand/collapse controls ---
  function buildControls(idPrefix) {
    return '<div class="expand-controls">' +
      '<button class="expand-btn" data-action="expand" data-target="' + idPrefix + '">Expand All</button>' +
      '<button class="expand-btn" data-action="collapse" data-target="' + idPrefix + '">Collapse All</button>' +
      '</div>';
  }

  // --- Render All Slokas ---
  function renderAllSlokas() {
    var container = document.getElementById('all-slokas-container');
    var html = buildControls('all');

    slokas.forEach(function (sloka) {
      html += buildVerseCard(sloka);
    });

    container.innerHTML = html;

    // Expand first 3 by default
    for (var i = 1; i <= 3; i++) {
      var el = document.getElementById('verse-' + i);
      if (el) el.classList.add('expanded');
    }
  }

  // --- Render Ananda Lahari (1-41) ---
  function renderAnandaLahari() {
    var container = document.getElementById('ananda-container');
    var anandaSlokas = slokas.filter(function (s) { return s.num <= 41; });

    var html = buildControls('ananda');

    anandaSlokas.forEach(function (sloka) {
      html += buildVerseCard(sloka);
    });

    container.innerHTML = html;
  }

  // --- Render Soundarya Lahari (42-103) ---
  function renderSoundaryaLahari() {
    var container = document.getElementById('soundarya-container');
    var soundaryaSlokas = slokas.filter(function (s) { return s.num >= 42; });

    var html = buildControls('soundarya');

    soundaryaSlokas.forEach(function (sloka) {
      html += buildVerseCard(sloka);
    });

    container.innerHTML = html;
  }

  // --- Toggle verse expansion ---
  window.toggleVerse = function (num) {
    var el = document.getElementById('verse-' + num);
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

  // --- Build a search result verse card with highlights ---
  function buildSearchVerseCard(sloka, query) {
    var num = sloka.num;
    var isAnanda = num <= 41;
    var sectionClass = isAnanda ? 'ananda-verse' : 'soundarya-verse';
    var sectionTag = isAnanda ? 'Ananda' : 'Soundarya';

    var preview = sloka.sanskrit.split('\n')[0];
    if (preview.length > 50) preview = preview.substring(0, 50) + '...';

    var html = '<div class="verse-card ' + sectionClass + '" id="verse-' + num + '">';

    html += '<div class="verse-header" onclick="toggleVerse(' + num + ')">';
    html += '<span class="verse-number">' + num + '</span>';
    html += '<span class="verse-text-preview">' + highlightText(preview, query) + '</span>';
    html += '<span class="verse-section-tag">' + sectionTag + '</span>';
    html += '<span class="verse-toggle">&#9660;</span>';
    html += '</div>';

    html += '<div class="verse-body">';
    html += '<div class="sanskrit-block">' + highlightText(sloka.sanskrit, query) + '</div>';
    html += '<div class="transliteration-block">' + highlightText(sloka.transliteration, query) + '</div>';
    html += '<div class="meaning-block">';
    html += '<div class="meaning-label">Meaning</div>';
    html += '<div class="meaning-text">' + highlightText(sloka.meaning, query) + '</div>';
    html += '</div>';
    html += '<div class="esoteric-block">';
    html += '<div class="esoteric-label">Esoteric Interpretation</div>';
    html += '<div class="esoteric-text">' + highlightText(sloka.esoteric, query) + '</div>';
    html += '</div>';
    html += '</div>';
    html += '</div>';

    return html;
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
          results.innerHTML = '<p style="text-align:center;color:#6b5744;padding:2rem;">Type at least 2 characters to search...</p>';
          count.textContent = '';
          return;
        }

        var matches = slokas.filter(function (sloka) {
          return (
            String(sloka.num) === query ||
            sloka.sanskrit.toLowerCase().includes(query) ||
            sloka.transliteration.toLowerCase().includes(query) ||
            sloka.meaning.toLowerCase().includes(query) ||
            sloka.esoteric.toLowerCase().includes(query)
          );
        });

        count.textContent = matches.length + ' found';

        if (matches.length === 0) {
          results.innerHTML = '<p style="text-align:center;color:#6b5744;padding:2rem;">No verses found matching "' + escapeHtml(query) + '"</p>';
          return;
        }

        var html = '';
        matches.forEach(function (sloka) {
          html += buildSearchVerseCard(sloka, query);
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

  // --- Reading Progress ---
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
    renderAllSlokas();
    renderAnandaLahari();
    renderSoundaryaLahari();
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
