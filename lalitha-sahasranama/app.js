// Sri Lalitha Sahasranama - Chanting Guide Application
// ====================================================

(function () {
  'use strict';

  var searchTimer = null;

  // --- Name-to-Verse Mapping ---
  // Generated from the śloka text by scripts/lalitha/build.mjs (edition/text.json).
  const VERSE_NAMES = LALITHA_DATA.verse_names;

  // Build a reverse map: name number -> verse number
  const NAME_TO_VERSE = {};
  for (const [v, ns] of Object.entries(VERSE_NAMES)) {
    for (const n of ns) {
      NAME_TO_VERSE[n] = parseInt(v);
    }
  }

  // --- Helper: Build names lookup ---
  const namesMap = {};
  LALITHA_DATA.names.forEach(function (n) {
    namesMap[n.num] = n;
  });

  // --- Render Nyasa ---
  function renderNyasa() {
    var container = document.getElementById('nyasa-content');
    var text = LALITHA_DATA.nyasa
      .replace(/^\.\.\s*nyāsaḥ\s*\.\.\s*/i, '')
      .replace('|| nyAsaH ||', '')
      .trim();
    container.textContent = text;
    if (LALITHA_DATA.nyasa_dev) {
      var dev = document.createElement('div');
      dev.className = 'nyasa-devanagari';
      dev.lang = 'sa';
      dev.textContent = LALITHA_DATA.nyasa_dev.join(' ।\n') + ' ॥';
      container.parentNode.insertBefore(dev, container);
    }
  }

  // --- Render Dhyana Shlokas ---
  function renderDhyana() {
    var container = document.getElementById('dhyana-container');
    var html = '';
    LALITHA_DATA.dhyana.forEach(function (dv) {
      html += '<div class="dhyana-verse">';
      if (dv.devanagari) html += '<div class="devanagari" lang="sa">' + escapeHtml(dv.devanagari) + '</div>';
      html += '<div class="transliteration">' + escapeHtml(dv.sanskrit) + '</div>';
      if (dv.translation) {
        html += '<div class="translation">' + escapeHtml(dv.translation) + '</div>';
      }
      html += '</div>';
    });
    container.innerHTML = html;
  }

  // --- Render Stotram (Main Chanting View) ---
  function renderStotram() {
    var container = document.getElementById('stotram-container');

    // Add expand/collapse controls
    var controlsHtml = '<div class="expand-controls">';
    controlsHtml += '<button class="expand-btn" id="expand-all">Expand All</button>';
    controlsHtml += '<button class="expand-btn" id="collapse-all">Collapse All</button>';
    controlsHtml += '</div>';

    var versesHtml = '';

    LALITHA_DATA.verses.forEach(function (verse) {
      var verseNum = verse.num;
      var nameNums = VERSE_NAMES[verseNum] || [];
      // the reader's lines: words spaced wherever no letter changes (scripts/lalitha/reading.mjs)
      var halves = verse.read_iast || verse.halves || [];

      // Build shloka text display with translations after full verse
      var translations = verse.translations || [];
      var shlokaHtml = '<div class="shloka-text">';
      var halvesDev = verse.read_dev || verse.halves_dev || [];
      if (halvesDev.length) {
        shlokaHtml += '<div class="shloka-devanagari" lang="sa">';
        halvesDev.forEach(function (half, idx) {
          shlokaHtml += '<span class="shloka-line">' + escapeHtml(half) + (idx < halvesDev.length - 1 ? ' ।' : ' ॥ ' + devDigits(verseNum) + ' ॥') + '</span>';
        });
        shlokaHtml += '</div>';
      }
      halves.forEach(function (half, idx) {
        shlokaHtml += '<span class="shloka-line">' + escapeHtml(half) + '</span>';
        if (idx < halves.length - 1) {
          shlokaHtml += '<span class="shloka-separator">|</span>';
        }
      });
      shlokaHtml += '<span class="shloka-separator">|| ' + verseNum + ' ||</span>';
      // The names separated (learning view); ° marks a name whose recited form differs
      if (verse.learn) {
        shlokaHtml += '<div class="shloka-learn" aria-label="The names, separated">';
        verse.learn.forEach(function (row) {
          if (!row.length) return;
          shlokaHtml += '<span class="learn-line">';
          row.forEach(function (n) {
            shlokaHtml += '<span class="learn-name"><sup>' + n[0] + '</sup><span lang="sa">' + escapeHtml(n[1]) + (n[3] ? '°' : '') + '</span></span>';
          });
          shlokaHtml += '</span>';
        });
        shlokaHtml += '</div>';
      }
      // Show translations after the full verse text
      if (translations.length > 0) {
        shlokaHtml += '<div class="shloka-translations">';
        translations.forEach(function (t) {
          if (t) {
            shlokaHtml += '<span class="shloka-translation">' + escapeHtml(t) + '</span>';
          }
        });
        shlokaHtml += '</div>';
      }
      shlokaHtml += '</div>';

      // Build names as word-split cards
      var namesHtml = '<div class="word-section-label">Word Split</div>';
      namesHtml += '<div class="word-grid">';
      nameNums.forEach(function (nNum) {
        var name = namesMap[nNum];
        if (name) {
          namesHtml += '<div class="word-card">';
          namesHtml += '<div class="word-num">' + nNum + '</div>';
          // the name stays whole; its parts are shown beneath it
          namesHtml += '<div class="word-devanagari">' + escapeHtml(name.name_devanagari) + '</div>';
          namesHtml += '<div class="word-transliteration">' + escapeHtml(name.name_iast || '') + '</div>';
          namesHtml += '<div class="word-meaning">' + escapeHtml(name.meaning) + '</div>';
          namesHtml += '<a class="word-study" href="edition/#n-' + nNum + '">Sandhi, samāsa &amp; full analysis &rarr;</a>';
          if (name.morphemes && name.morphemes.length > 1) {
            namesHtml += '<div class="morpheme-split">';
            name.morphemes.forEach(function (m, idx) {
              if (idx > 0) namesHtml += '<span class="morpheme-sep">+</span>';
              namesHtml += '<span class="morpheme" title="' + escapeHtml(m.transliteration + ' — ' + m.meaning) + '">';
              if (m.devanagari) namesHtml += '<span class="morpheme-devanagari">' + escapeHtml(m.devanagari) + '</span>';
              namesHtml += '<span class="morpheme-meaning">' + escapeHtml(m.meaning) + '</span>';
              namesHtml += '</span>';
            });
            namesHtml += '</div>';
          }
          namesHtml += '</div>';
        }
      });
      // The closing line of śloka 183 has no name, but its words get cards too
      (verse.closing_words || []).forEach(function (w) {
        namesHtml += '<div class="word-card closing-card">';
        namesHtml += '<div class="word-num">closing line</div>';
        namesHtml += '<div class="word-devanagari">' + escapeHtml(w.dev) + '</div>';
        namesHtml += '<div class="word-transliteration">' + escapeHtml(w.iast) + (w.form_iast.replace(/-/g, '') !== w.iast ? ' <span class="word-form">(' + escapeHtml(w.form_iast) + ')</span>' : '') + '</div>';
        namesHtml += '<div class="word-meaning">' + escapeHtml(w.meaning) + '</div>';
        if (w.parts.length > 1 || w.parts[0][1] !== w.form_iast.replace(/-/g, '')) {
          namesHtml += '<div class="morpheme-split">';
          w.parts.forEach(function (p, idx) {
            if (idx > 0) namesHtml += '<span class="morpheme-sep">+</span>';
            namesHtml += '<span class="morpheme" title="' + escapeHtml(p[1] + ' — ' + p[2]) + '"><span class="morpheme-devanagari">' + escapeHtml(p[0]) + '</span><span class="morpheme-meaning">' + escapeHtml(p[2]) + '</span></span>';
          });
          namesHtml += '</div>';
        }
        namesHtml += '<a class="word-study" href="edition/#s-' + verseNum + '">Sandhi &amp; word by word &rarr;</a>';
        namesHtml += '</div>';
      });
      namesHtml += '</div>';

      // Preview text (first half of verse)
      var preview = halves.length > 0 ? halves[0] : '';
      if (preview.length > 60) preview = preview.substring(0, 60) + '...';

      // Verse card
      versesHtml += '<div class="verse-card" id="verse-' + verseNum + '">';
      versesHtml += '<div class="verse-header" onclick="toggleVerse(' + verseNum + ')">';
      versesHtml += '<span class="verse-number">' + verseNum + '</span>';
      versesHtml += '<span class="verse-text-preview">' + escapeHtml(preview) + '</span>';
      versesHtml += '<span class="verse-toggle">&#9660;</span>';
      versesHtml += '</div>';
      versesHtml += '<div class="verse-body">';
      versesHtml += shlokaHtml;
      versesHtml += namesHtml;
      versesHtml += '</div>';
      versesHtml += '</div>';
    });

    container.innerHTML = controlsHtml + versesHtml;

    // Expand first 3 verses by default
    for (var i = 1; i <= 3; i++) {
      var el = document.getElementById('verse-' + i);
      if (el) el.classList.add('expanded');
    }

    // Expand/Collapse all
    document.getElementById('expand-all').addEventListener('click', function () {
      document.querySelectorAll('.verse-card').forEach(function (c) {
        c.classList.add('expanded');
      });
    });
    document.getElementById('collapse-all').addEventListener('click', function () {
      document.querySelectorAll('.verse-card').forEach(function (c) {
        c.classList.remove('expanded');
      });
    });
  }

  // --- Toggle verse expansion ---
  window.toggleVerse = function (num) {
    var el = document.getElementById('verse-' + num);
    if (el) el.classList.toggle('expanded');
  };

  // --- Render All Names ---
  function renderNames() {
    var container = document.getElementById('names-container');
    var html = '';
    LALITHA_DATA.names.forEach(function (name) {
      html += '<div class="name-row" id="name-' + name.num + '">';
      html += '<span class="name-num">' + name.num + '.</span>';
      html += '<div class="name-details">';
      html += '<span class="name-iast">' + escapeHtml(name.name_iast || '') + '</span>';
      html += '<span class="name-devanagari">' + escapeHtml(name.name_devanagari) + '</span>';
      html += '<span class="name-meaning">' + escapeHtml(name.meaning) + '</span>';
      html += '</div>';
      html += '</div>';
    });
    container.innerHTML = html;
  }

  // --- Search ---
  function setupSearch() {
    var input = document.getElementById('search-input');
    var results = document.getElementById('search-results');
    var count = document.getElementById('search-count');

    input.addEventListener('input', function () {
      if (searchTimer) clearTimeout(searchTimer);
      searchTimer = setTimeout(function () {
        var query = input.value.trim().toLowerCase();
        if (query.length < 2) {
          results.innerHTML = '<p style="text-align:center;color:#6b5744;padding:2rem;">Type at least 2 characters to search...</p>';
          count.textContent = '';
          return;
        }

        var matches = LALITHA_DATA.names.filter(function (name) {
          return (
            name.name_devanagari.toLowerCase().includes(query) ||
            (name.name_iast || '').toLowerCase().includes(query) ||
            name.meaning.toLowerCase().includes(query) ||
            String(name.num) === query
          );
        });

        count.textContent = matches.length + ' found';

        if (matches.length === 0) {
          results.innerHTML = '<p style="text-align:center;color:#6b5744;padding:2rem;">No names found matching "' + escapeHtml(query) + '"</p>';
          return;
        }

        var html = '';
        matches.forEach(function (name) {
          html += '<div class="name-row">';
          html += '<span class="name-num">' + name.num + '.</span>';
          html += '<div class="name-details">';
          html += '<span class="name-iast">' + highlightText(name.name_iast || '', query) + '</span>';
          html += '<span class="name-devanagari">' + highlightText(name.name_devanagari, query) + '</span>';
          html += '<span class="name-meaning">' + highlightText(name.meaning, query) + '</span>';
          html += '</div>';
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

        // Update button states
        buttons.forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');

        // Show/hide views
        document.querySelectorAll('.view').forEach(function (v) {
          v.classList.remove('active');
        });
        document.getElementById(viewId + '-view').classList.add('active');
      });
    });
  }

  // --- PDF Download: the chanting and learning book, built by scripts/lalitha/build.mjs ---
  var BOOK_PDF = 'edition/Sri-Lalitha-Sahasranama-Study-Edition.pdf';
  function setupPdfDownload() {
    var btn = document.getElementById('download-pdf');
    if (!btn) return;
    btn.addEventListener('click', function () {
      window.location.href = BOOK_PDF;
    });
  }

  // --- Floating Scroll Buttons ---
  function setupScrollButtons() {
    var scrollBtns = document.getElementById('scrollButtons');
    var upBtn = document.getElementById('scroll-up');
    var downBtn = document.getElementById('scroll-down');

    if (!scrollBtns || !upBtn || !downBtn) return;

    window.addEventListener('scroll', function () {
      if (window.scrollY > 300) {
        scrollBtns.classList.add('visible');
      } else {
        scrollBtns.classList.remove('visible');
      }
    });

    upBtn.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    downBtn.addEventListener('click', function () {
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
    });
  }

  // --- Reading Progress ---
  function setupProgressBar() {
    var scrollBtns = document.getElementById('scrollButtons');
    window.addEventListener('scroll', function () {
      var scrollTop = window.scrollY;
      var docHeight = document.documentElement.scrollHeight - window.innerHeight;
      var progress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
      var bar = document.getElementById('progressBar');
      if (bar) bar.style.width = progress + '%';
      if (scrollBtns) {
        if (scrollTop > 300) scrollBtns.classList.add('visible');
        else scrollBtns.classList.remove('visible');
      }
    });
    var topBtn = document.getElementById('scroll-up');
    if (topBtn) topBtn.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });
    var bottomBtn = document.getElementById('scroll-down');
    if (bottomBtn) bottomBtn.addEventListener('click', function () { window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' }); });
  }

  // --- Utility: Devanagari digits for verse numbers inside Devanagari lines ---
  function devDigits(n) {
    return String(n).replace(/\d/g, function (d) { return '०१२३४५६७८९'.charAt(+d); });
  }

  // --- Utility: Escape HTML ---
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
  // --- Deep links: /lalitha-sahasranama/#name-551 ---
  function showView(viewId) {
    var target = document.getElementById(viewId + '-view');
    if (!target) return;
    document.querySelectorAll('.view').forEach(function (v) { v.classList.remove('active'); });
    target.classList.add('active');
    document.querySelectorAll('.nav-btn').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-view') === viewId);
    });
  }

  function applyHash() {
    var m = /^#name-(\d+)$/.exec(window.location.hash || '');
    if (!m) return;
    showView('names');
    var row = document.getElementById('name-' + m[1]);
    if (!row) return;
    window.requestAnimationFrame(function () {
      row.scrollIntoView({ behavior: 'smooth', block: 'center' });
      row.classList.add('name-row-targeted');
      setTimeout(function () { row.classList.remove('name-row-targeted'); }, 2600);
    });
  }

  function init() {
    renderNyasa();
    renderDhyana();
    renderStotram();
    renderNames();
    setupSearch();
    setupNavigation();
    setupProgressBar();
    setupScrollButtons();
    setupPdfDownload();
    setupKeyboardNav();
    applyHash();
    window.addEventListener('hashchange', applyHash);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
