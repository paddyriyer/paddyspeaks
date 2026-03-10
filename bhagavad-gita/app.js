// Bhagavad Gita - Interactive Application
// =========================================

(function () {
  'use strict';

  var data = BHAGAVAD_GITA_DATA;
  var currentChapter = 1;
  var currentSlokaIndex = 0;
  var searchTimer = null;

  // --- Utility: Escape HTML ---
  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // --- Utility: Highlight search term in text ---
  function highlightText(text, query) {
    if (!query) return escapeHtml(text);
    var escaped = escapeHtml(text);
    var queryEscaped = escapeHtml(query);
    var regex = new RegExp('(' + queryEscaped.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
    return escaped.replace(regex, '<mark>$1</mark>');
  }

  // --- Get chapter by number ---
  function getChapter(num) {
    for (var i = 0; i < data.chapters.length; i++) {
      if (data.chapters[i].chapter === num) return data.chapters[i];
    }
    return null;
  }

  // --- Get all slokas as flat array ---
  function getAllSlokas() {
    var slokas = [];
    data.chapters.forEach(function (ch) {
      ch.slokas.forEach(function (s) {
        slokas.push(s);
      });
    });
    return slokas;
  }

  // --- Get slokas for current chapter ---
  function getCurrentChapterSlokas() {
    var ch = getChapter(currentChapter);
    return ch ? ch.slokas : [];
  }

  // --- Check if a chapter has data ---
  function chapterHasData(num) {
    return getChapter(num) !== null;
  }

  // --- Build card ID for a sloka ---
  function slokaCardId(sloka) {
    return 'chapter-' + sloka.chapter + '-sloka-' + sloka.sloka;
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

  // --- Build a single verse card HTML (Chapter View) ---
  function buildVerseCard(sloka) {
    var cardId = slokaCardId(sloka);

    // Preview: first line of devanagari
    var preview = sloka.devanagari.split('\n')[0];
    if (preview.length > 60) preview = preview.substring(0, 60) + '...';

    var html = '<div class="verse-card" id="' + cardId + '">';

    // Header
    html += '<div class="verse-header" onclick="toggleVerse(\'' + cardId + '\')">';
    html += '<span class="verse-number">' + sloka.chapter + '.' + sloka.sloka + '</span>';
    html += '<span class="verse-text-preview">' + escapeHtml(preview) + '</span>';
    html += '<span class="verse-toggle">&#9660;</span>';
    html += '</div>';

    // Body
    html += '<div class="verse-body">';

    // Devanagari text
    html += '<div class="sloka-devanagari">' + escapeHtml(sloka.devanagari) + '</div>';

    // Transliteration
    html += '<div class="sloka-transliteration">' + escapeHtml(sloka.transliteration) + '</div>';

    // Word-by-word grid
    if (sloka.words && sloka.words.length > 0) {
      html += '<div class="word-section-label">Word-by-Word</div>';
      html += buildWordGrid(sloka.words);
    }

    // English translation
    html += '<div class="translation-block">';
    html += '<div class="translation-label">Translation</div>';
    html += '<div class="translation-text">' + escapeHtml(sloka.translation) + '</div>';
    html += '</div>';

    // Modern interpretation
    if (sloka.modernInterpretation) {
      html += '<div class="modern-insight">';
      html += '<div class="modern-insight-label">Modern Insight</div>';
      html += '<div class="modern-insight-text">' + escapeHtml(sloka.modernInterpretation) + '</div>';
      html += '</div>';
    }

    html += '</div>'; // verse-body
    html += '</div>'; // verse-card

    return html;
  }

  // --- Build expand/collapse controls ---
  function buildControls() {
    return '<div class="chapter-controls">' +
      '<div class="chapter-controls-row">' +
      '<button class="expand-btn back-btn" data-action="back-to-index">&larr; All Chapters</button>' +
      '</div>' +
      '<div class="chapter-controls-row">' +
      '<button class="expand-btn" data-action="expand">Expand All</button>' +
      '<button class="expand-btn" data-action="collapse">Collapse All</button>' +
      '</div>' +
      '</div>';
  }

  // --- Render chapter navigation buttons (1-18) ---
  function renderChapterNav() {
    var container = document.getElementById('chapter-nav');
    if (!container) return;

    var html = '<div class="chapter-buttons">';
    html += '<span class="chapter-buttons-label">Chapter</span>';
    for (var i = 1; i <= 18; i++) {
      var hasData = chapterHasData(i);
      var activeClass = (i === currentChapter && hasData) ? ' chapter-btn-active' : '';
      var disabledClass = hasData ? '' : ' chapter-btn-disabled';
      var tooltip = hasData ? 'Chapter ' + i : 'Chapter ' + i + ' — Coming Soon';

      html += '<button class="chapter-btn' + activeClass + disabledClass + '"';
      html += ' data-chapter="' + i + '"';
      html += ' title="' + tooltip + '"';
      if (!hasData) html += ' disabled';
      html += '>' + i + '</button>';
    }
    html += '</div>';
    container.innerHTML = html;

    // Bind click events
    container.querySelectorAll('.chapter-btn:not(.chapter-btn-disabled)').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var chNum = parseInt(btn.getAttribute('data-chapter'), 10);
        loadChapter(chNum);
      });
    });
  }

  // --- Update section heading for current chapter ---
  function updateChapterHeading() {
    var ch = getChapter(currentChapter);
    if (!ch) return;

    var heading = document.getElementById('chapter-heading');
    if (heading) {
      heading.innerHTML = 'Chapter ' + ch.chapter + ': ' + escapeHtml(ch.titleEnglish) +
        ' <span class="section-heading-sanskrit">अध्याय ' + ch.chapter + ': ' + escapeHtml(ch.titleSanskrit) + '</span>';
    }

    var intro = document.getElementById('chapter-intro');
    if (intro) {
      intro.textContent = ch.titleMeaning + ' — ' + ch.slokas.length + ' Slokas';
    }
  }

  // --- Build chapter index cards (overview of all available chapters) ---
  function renderChapterIndex() {
    var container = document.getElementById('chapter-index');
    if (!container) return;

    var html = '';
    data.chapters.forEach(function (ch) {
      html += '<div class="chapter-index-card" data-chapter="' + ch.chapter + '">';
      html += '<div class="chapter-index-number">Chapter ' + ch.chapter + '</div>';
      html += '<div class="chapter-index-title">' + escapeHtml(ch.titleEnglish) + '</div>';
      html += '<div class="chapter-index-sanskrit">' + escapeHtml(ch.titleSanskrit) + '</div>';
      html += '<div class="chapter-index-meaning">' + escapeHtml(ch.titleMeaning) + ' — ' + ch.slokas.length + ' Slokas</div>';
      html += '<div class="chapter-index-summary">' + escapeHtml(ch.summary.substring(0, 180)) + '...</div>';
      html += '<div class="chapter-index-read">Read Chapter ' + ch.chapter + ' &rarr;</div>';
      html += '</div>';
    });

    container.innerHTML = html;

    // Bind click events
    container.querySelectorAll('.chapter-index-card').forEach(function (card) {
      card.addEventListener('click', function () {
        var chNum = parseInt(card.getAttribute('data-chapter'), 10);
        loadChapter(chNum);
      });
    });
  }

  // --- Show chapter index (landing state) ---
  function showChapterIndex() {
    var indexEl = document.getElementById('chapter-index');
    var navEl = document.getElementById('chapter-nav');
    var containerEl = document.getElementById('chapter-container');

    if (indexEl) indexEl.style.display = '';
    if (navEl) navEl.style.display = '';
    if (containerEl) containerEl.innerHTML = '';

    renderChapterNav();

    var heading = document.getElementById('chapter-heading');
    if (heading) {
      heading.innerHTML = 'Chapters <span class="section-heading-sanskrit">अध्यायाः</span>';
    }
    var intro = document.getElementById('chapter-intro');
    if (intro) {
      intro.textContent = 'Select a chapter to begin reading';
    }

    // Clear other views too
    var wordsContainer = document.getElementById('words-container');
    if (wordsContainer) wordsContainer.innerHTML = '';
    var modernContainer = document.getElementById('modern-container');
    if (modernContainer) modernContainer.innerHTML = '';
  }

  // --- Load a chapter ---
  function loadChapter(chNum) {
    if (!chapterHasData(chNum)) return;
    currentChapter = chNum;
    currentSlokaIndex = 0;

    // Hide the chapter index, show nav + slokas
    var indexEl = document.getElementById('chapter-index');
    var navEl = document.getElementById('chapter-nav');
    if (indexEl) indexEl.style.display = 'none';
    if (navEl) navEl.style.display = '';

    renderChapterNav();
    updateChapterHeading();
    renderChapterView();
    renderWordsView();
    renderModernView();

    // Scroll to top of content
    var heading = document.getElementById('chapter-heading');
    if (heading) heading.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // --- Render Chapter View (expandable cards) ---
  function renderChapterView() {
    var container = document.getElementById('chapter-container');
    if (!container) return;

    var slokas = getCurrentChapterSlokas();
    var html = buildControls();

    slokas.forEach(function (sloka) {
      html += buildVerseCard(sloka);
    });

    container.innerHTML = html;

    // Expand first 3 slokas by default
    slokas.slice(0, 3).forEach(function (sloka) {
      var el = document.getElementById(slokaCardId(sloka));
      if (el) el.classList.add('expanded');
    });
  }

  // --- Render Word-by-Word View ---
  function renderWordsView() {
    var container = document.getElementById('words-container');
    if (!container) return;

    var slokas = getCurrentChapterSlokas();
    var html = '';

    slokas.forEach(function (sloka) {
      html += '<div class="word-view-card">';
      html += '<div class="word-view-header">';
      html += '<span class="verse-number">' + sloka.chapter + '.' + sloka.sloka + '</span>';
      html += '</div>';

      // Sloka text (compact)
      html += '<div class="word-view-sloka">' + escapeHtml(sloka.devanagari) + '</div>';
      html += '<div class="word-view-transliteration">' + escapeHtml(sloka.transliteration) + '</div>';

      // Word grid (prominent)
      if (sloka.words && sloka.words.length > 0) {
        html += buildWordGrid(sloka.words);
      }

      html += '</div>';
    });

    container.innerHTML = html;
  }

  // --- Render Modern Insights View ---
  function renderModernView() {
    var container = document.getElementById('modern-container');
    if (!container) return;

    var slokas = getCurrentChapterSlokas();
    var html = '';

    slokas.forEach(function (sloka) {
      if (!sloka.modernInterpretation) return;

      html += '<div class="insight-card">';
      html += '<div class="insight-card-header">';
      html += '<span class="verse-number">' + sloka.chapter + '.' + sloka.sloka + '</span>';
      html += '</div>';

      // Sloka text (smaller)
      html += '<div class="insight-sloka-text">' + escapeHtml(sloka.devanagari) + '</div>';
      html += '<div class="insight-transliteration">' + escapeHtml(sloka.transliteration) + '</div>';

      // Translation (compact)
      html += '<div class="insight-translation">' + escapeHtml(sloka.translation) + '</div>';

      // Modern interpretation (prominent)
      html += '<div class="insight-modern">' + escapeHtml(sloka.modernInterpretation) + '</div>';

      html += '</div>';
    });

    container.innerHTML = html;
  }

  // --- Build search result card with highlights ---
  function buildSearchResultCard(sloka, query, matchedField) {
    var cardId = 'search-' + slokaCardId(sloka);

    var html = '<div class="verse-card expanded" id="' + cardId + '">';

    // Header
    html += '<div class="verse-header">';
    html += '<span class="verse-number">' + sloka.chapter + '.' + sloka.sloka + '</span>';
    html += '<span class="search-match-field">Matched in: ' + escapeHtml(matchedField) + '</span>';
    html += '</div>';

    // Body (always expanded for search results)
    html += '<div class="verse-body">';

    // Devanagari
    html += '<div class="sloka-devanagari">' + highlightText(sloka.devanagari, query) + '</div>';

    // Transliteration
    html += '<div class="sloka-transliteration">' + highlightText(sloka.transliteration, query) + '</div>';

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
    html += '<div class="translation-block">';
    html += '<div class="translation-label">Translation</div>';
    html += '<div class="translation-text">' + highlightText(sloka.translation, query) + '</div>';
    html += '</div>';

    // Modern interpretation
    if (sloka.modernInterpretation) {
      html += '<div class="modern-insight">';
      html += '<div class="modern-insight-label">Modern Insight</div>';
      html += '<div class="modern-insight-text">' + highlightText(sloka.modernInterpretation, query) + '</div>';
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

    if (sloka.devanagari.toLowerCase().indexOf(q) !== -1) fields.push('Sanskrit');
    if (sloka.transliteration.toLowerCase().indexOf(q) !== -1) fields.push('Transliteration');
    if (sloka.translation.toLowerCase().indexOf(q) !== -1) fields.push('Translation');
    if (sloka.modernInterpretation && sloka.modernInterpretation.toLowerCase().indexOf(q) !== -1) fields.push('Modern Insight');

    if (sloka.words) {
      for (var i = 0; i < sloka.words.length; i++) {
        var w = sloka.words[i];
        if (
          w.word.toLowerCase().indexOf(q) !== -1 ||
          (w.transliteration && w.transliteration.toLowerCase().indexOf(q) !== -1) ||
          w.meaning.toLowerCase().indexOf(q) !== -1
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
          results.innerHTML = '<p style="text-align:center;color:#6b5744;padding:2rem;">Type at least 2 characters to search...</p>';
          count.textContent = '';
          return;
        }

        var matches = allSlokas.filter(function (sloka) {
          var verseRef = sloka.chapter + '.' + sloka.sloka;
          if (verseRef === query) return true;
          if (sloka.devanagari.toLowerCase().indexOf(query) !== -1) return true;
          if (sloka.transliteration.toLowerCase().indexOf(query) !== -1) return true;
          if (sloka.translation.toLowerCase().indexOf(query) !== -1) return true;
          if (sloka.modernInterpretation && sloka.modernInterpretation.toLowerCase().indexOf(query) !== -1) return true;

          if (sloka.words) {
            for (var i = 0; i < sloka.words.length; i++) {
              var w = sloka.words[i];
              if (
                w.word.toLowerCase().indexOf(query) !== -1 ||
                (w.transliteration && w.transliteration.toLowerCase().indexOf(query) !== -1) ||
                w.meaning.toLowerCase().indexOf(query) !== -1
              ) return true;
            }
          }

          return false;
        });

        count.textContent = matches.length + ' found';

        if (matches.length === 0) {
          results.innerHTML = '<p style="text-align:center;color:#6b5744;padding:2rem;">No slokas found matching "' + escapeHtml(query) + '"</p>';
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

  // --- Toggle verse expansion ---
  window.toggleVerse = function (id) {
    var el = document.getElementById(id);
    if (el) el.classList.toggle('expanded');
  };

  // --- Expand/Collapse All handler ---
  function setupExpandCollapse() {
    document.addEventListener('click', function (e) {
      var btn = e.target.closest('.expand-btn');
      if (!btn) return;

      var action = btn.getAttribute('data-action');

      if (action === 'back-to-index') {
        showChapterIndex();
        return;
      }

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

  // --- Reading Progress Bar & Scroll Buttons ---
  function setupProgressBar() {
    var scrollBtns = document.getElementById('scrollButtons');

    window.addEventListener('scroll', function () {
      var scrollTop = window.scrollY;
      var docHeight = document.documentElement.scrollHeight - window.innerHeight;
      var progress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
      var bar = document.getElementById('progressBar');
      if (bar) bar.style.width = progress + '%';

      // Show/hide floating scroll buttons
      if (scrollBtns) {
        if (scrollTop > 300) {
          scrollBtns.classList.add('visible');
        } else {
          scrollBtns.classList.remove('visible');
        }
      }
    });

    // Scroll to top
    var topBtn = document.getElementById('scrollTopBtn');
    if (topBtn) {
      topBtn.addEventListener('click', function () {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }

    // Scroll to bottom
    var bottomBtn = document.getElementById('scrollBottomBtn');
    if (bottomBtn) {
      bottomBtn.addEventListener('click', function () {
        window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
      });
    }
  }

  // --- URL Hash Navigation ---
  function handleHashNavigation() {
    var hash = window.location.hash;
    if (!hash) return;

    // Expected format: #chapter-1-sloka-5
    var match = hash.match(/^#chapter-(\d+)-sloka-(\d+)$/);
    if (!match) return;

    var chNum = parseInt(match[1], 10);
    var slokaNum = parseInt(match[2], 10);

    if (!chapterHasData(chNum)) return;

    // Load the chapter if different
    if (chNum !== currentChapter) {
      loadChapter(chNum);
    }

    // Scroll to the specific sloka
    var targetId = 'chapter-' + chNum + '-sloka-' + slokaNum;
    setTimeout(function () {
      var el = document.getElementById(targetId);
      if (el) {
        el.classList.add('expanded');
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
  }

  // --- Keyboard Navigation ---
  function setupKeyboardNav() {
    document.addEventListener('keydown', function (e) {
      // Only handle when not in an input field
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      var slokas = getCurrentChapterSlokas();
      if (slokas.length === 0) return;

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (currentSlokaIndex < slokas.length - 1) {
          currentSlokaIndex++;
          var nextId = slokaCardId(slokas[currentSlokaIndex]);
          var nextEl = document.getElementById(nextId);
          if (nextEl) {
            nextEl.classList.add('expanded');
            nextEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (currentSlokaIndex > 0) {
          currentSlokaIndex--;
          var prevId = slokaCardId(slokas[currentSlokaIndex]);
          var prevEl = document.getElementById(prevId);
          if (prevEl) {
            prevEl.classList.add('expanded');
            prevEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }
      } else if (e.key === 'Escape') {
        // Collapse current sloka
        var curId = slokaCardId(slokas[currentSlokaIndex]);
        var curEl = document.getElementById(curId);
        if (curEl) curEl.classList.remove('expanded');
      }
    });
  }

  // --- Initialize ---
  function init() {
    renderChapterIndex();
    setupSearch();
    setupNavigation();
    setupExpandCollapse();
    setupProgressBar();
    setupKeyboardNav();

    renderChapterNav();

    // If URL has a hash, load that chapter directly; otherwise show index
    var hash = window.location.hash;
    if (hash && hash.match(/^#chapter-(\d+)/)) {
      handleHashNavigation();
    } else {
      showChapterIndex();
    }

    // Listen for hash changes
    window.addEventListener('hashchange', handleHashNavigation);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
