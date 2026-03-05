// Abhirami Andhadhi - Interactive Application
// =============================================

(function () {
  'use strict';

  var verses = ABHIRAMI_ANDHADHI_DATA;

  // --- Utility: Escape HTML ---
  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // --- Build a single verse card HTML ---
  function buildVerseCard(verse) {
    var num = verse.num;
    var isKaappu = num === 0;
    var label = isKaappu ? 'Kaappu' : String(num);
    var cardClass = isKaappu ? 'kaappu-verse' : (num <= 50 ? 'first-half-verse' : 'second-half-verse');

    // Preview: first line of Tamil
    var preview = verse.tamil.split('\n')[0];
    if (preview.length > 60) preview = preview.substring(0, 60) + '...';

    var html = '<div class="verse-card ' + cardClass + '" id="verse-' + num + '">';

    // Header
    html += '<div class="verse-header" onclick="toggleVerse(' + num + ')">';
    html += '<span class="verse-number">' + label + '</span>';
    html += '<span class="verse-text-preview">' + escapeHtml(preview) + '</span>';
    if (isKaappu) {
      html += '<span class="verse-section-tag">Invocation</span>';
    }
    html += '<span class="verse-toggle">&#9660;</span>';
    html += '</div>';

    // Body
    html += '<div class="verse-body">';

    // Tamil text
    html += '<div class="tamil-block">' + escapeHtml(verse.tamil) + '</div>';

    // Transliteration
    html += '<div class="transliteration-block">' + escapeHtml(verse.transliteration) + '</div>';

    // Meaning
    html += '<div class="meaning-block">';
    html += '<div class="meaning-label">Meaning</div>';
    html += '<div class="meaning-text">' + escapeHtml(verse.meaning) + '</div>';
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

  // --- Render All Verses ---
  function renderAllVerses() {
    var container = document.getElementById('all-container');
    var html = buildControls('all');

    verses.forEach(function (verse) {
      html += buildVerseCard(verse);
    });

    container.innerHTML = html;

    // Expand kaappu and first 2 verses by default
    for (var i = 0; i <= 2; i++) {
      var el = document.getElementById('verse-' + i);
      if (el) el.classList.add('expanded');
    }
  }

  // --- Render First 50 ---
  function renderFirst50() {
    var container = document.getElementById('first50-container');
    var filtered = verses.filter(function (v) { return v.num >= 1 && v.num <= 50; });

    var html = buildControls('first50');
    filtered.forEach(function (verse) {
      html += buildVerseCard(verse);
    });

    container.innerHTML = html;
  }

  // --- Render Last 50 ---
  function renderLast50() {
    var container = document.getElementById('last50-container');
    var filtered = verses.filter(function (v) { return v.num >= 51 && v.num <= 100; });

    var html = buildControls('last50');
    filtered.forEach(function (verse) {
      html += buildVerseCard(verse);
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

  // --- Search ---
  function setupSearch() {
    var input = document.getElementById('search-input');
    var results = document.getElementById('search-results');
    var count = document.getElementById('search-count');

    input.addEventListener('input', function () {
      var query = input.value.trim().toLowerCase();
      if (query.length < 2) {
        results.innerHTML = '<p style="text-align:center;color:#6b5744;padding:2rem;">Type at least 2 characters to search...</p>';
        count.textContent = '';
        return;
      }

      var matches = verses.filter(function (verse) {
        return (
          String(verse.num) === query ||
          verse.tamil.toLowerCase().includes(query) ||
          verse.transliteration.toLowerCase().includes(query) ||
          verse.meaning.toLowerCase().includes(query)
        );
      });

      count.textContent = matches.length + ' found';

      if (matches.length === 0) {
        results.innerHTML = '<p style="text-align:center;color:#6b5744;padding:2rem;">No verses found matching "' + escapeHtml(query) + '"</p>';
        return;
      }

      var html = '';
      matches.forEach(function (verse) {
        html += buildVerseCard(verse);
      });
      results.innerHTML = html;

      // Expand all search results
      results.querySelectorAll('.verse-card').forEach(function (card) {
        card.classList.add('expanded');
      });
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
    window.addEventListener('scroll', function () {
      var scrollTop = window.scrollY;
      var docHeight = document.documentElement.scrollHeight - window.innerHeight;
      var progress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
      document.getElementById('progressBar').style.width = progress + '%';
    });
  }

  // --- Initialize ---
  function init() {
    renderAllVerses();
    renderFirst50();
    renderLast50();
    setupSearch();
    setupNavigation();
    setupExpandCollapse();
    setupProgressBar();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
