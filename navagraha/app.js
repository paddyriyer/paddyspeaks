// Navagraha Stotras - Interactive Application
// =============================================

(function () {
  'use strict';

  var data = NAVAGRAHA_DATA;
  var currentStotra = null;
  var currentGraha = null;
  var currentSlokaIndex = 0;
  var searchTimer = null;

  // Graha metadata
  var GRAHA_INFO = [
    { num: 1, name: 'Surya',     short: 'Sur', symbol: '\u2609', sanskrit: '\u0938\u0942\u0930\u094D\u092F\u0903' },
    { num: 2, name: 'Chandra',   short: 'Cha', symbol: '\u263D', sanskrit: '\u091A\u0928\u094D\u0926\u094D\u0930\u0903' },
    { num: 3, name: 'Mangala',   short: 'Man', symbol: '\u2642', sanskrit: '\u092E\u0919\u094D\u0917\u0932\u0903' },
    { num: 4, name: 'Budha',     short: 'Bud', symbol: '\u263F', sanskrit: '\u092C\u0941\u0927\u0903' },
    { num: 5, name: 'Guru',      short: 'Gur', symbol: '\u2643', sanskrit: '\u0917\u0941\u0930\u0941\u0903' },
    { num: 6, name: 'Shukra',    short: 'Shu', symbol: '\u2640', sanskrit: '\u0936\u0941\u0915\u094D\u0930\u0903' },
    { num: 7, name: 'Shani',     short: 'Sha', symbol: '\u2644', sanskrit: '\u0936\u0928\u093F\u0903' },
    { num: 8, name: 'Rahu',      short: 'Rah', symbol: '\u260A', sanskrit: '\u0930\u093E\u0939\u0941\u0903' },
    { num: 9, name: 'Ketu',      short: 'Ket', symbol: '\u260B', sanskrit: '\u0915\u0947\u0924\u0941\u0903' }
  ];

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

  // --- Get stotra by id ---
  function getStotra(id) {
    for (var i = 0; i < data.stotras.length; i++) {
      if (data.stotras[i].id === id) return data.stotras[i];
    }
    return null;
  }

  // --- Get graha within a stotra ---
  function getGraha(stotraId, grahaNum) {
    var stotra = getStotra(stotraId);
    if (!stotra) return null;
    for (var i = 0; i < stotra.grahas.length; i++) {
      if (stotra.grahas[i].graha === grahaNum) return stotra.grahas[i];
    }
    return null;
  }

  // --- Get graha info by number ---
  function getGrahaInfo(grahaNum) {
    for (var i = 0; i < GRAHA_INFO.length; i++) {
      if (GRAHA_INFO[i].num === grahaNum) return GRAHA_INFO[i];
    }
    return null;
  }

  // --- Get all slokas as flat array ---
  function getAllSlokas() {
    var slokas = [];
    data.stotras.forEach(function (stotra) {
      stotra.grahas.forEach(function (graha) {
        graha.slokas.forEach(function (s) {
          slokas.push(s);
        });
      });
    });
    return slokas;
  }

  // --- Get slokas for current graha in current stotra ---
  function getCurrentGrahaSlokas() {
    if (!currentStotra || !currentGraha) return [];
    var graha = getGraha(currentStotra, currentGraha);
    return graha ? graha.slokas : [];
  }

  // --- Build card ID for a sloka ---
  function slokaCardId(sloka) {
    return sloka.stotra + '-graha-' + sloka.graha + '-sloka-' + sloka.sloka;
  }

  // --- Build verse reference label ---
  function slokaRefLabel(sloka) {
    var info = getGrahaInfo(sloka.graha);
    var name = info ? info.short : sloka.graha;
    return name + '.' + sloka.sloka;
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

  // --- Build a single verse card HTML (Stotra View) ---
  function buildVerseCard(sloka) {
    var cardId = slokaCardId(sloka);

    // Preview: first line of devanagari
    var preview = sloka.devanagari.split('\n')[0];
    if (preview.length > 60) preview = preview.substring(0, 60) + '...';

    var html = '<div class="verse-card" id="' + cardId + '">';

    // Header
    html += '<div class="verse-header" onclick="toggleVerse(\'' + cardId + '\')">';
    html += '<span class="verse-number">' + slokaRefLabel(sloka) + '</span>';
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

    html += '</div>'; // verse-body
    html += '</div>'; // verse-card

    return html;
  }

  // --- Build expand/collapse controls ---
  function buildControls(backLabel, backAction) {
    return '<div class="chapter-controls">' +
      '<div class="chapter-controls-row">' +
      '<button class="expand-btn back-btn" data-action="' + backAction + '">&larr; ' + escapeHtml(backLabel) + '</button>' +
      '</div>' +
      '<div class="chapter-controls-row">' +
      '<button class="expand-btn" data-action="expand">Expand All</button>' +
      '<button class="expand-btn" data-action="collapse">Collapse All</button>' +
      '</div>' +
      '</div>';
  }

  // --- Render graha navigation buttons (9 grahas) ---
  function renderGrahaNav() {
    var container = document.getElementById('stotra-nav');
    if (!container) return;

    if (!currentStotra) {
      container.innerHTML = '';
      return;
    }

    var stotra = getStotra(currentStotra);
    if (!stotra) return;

    var html = '<div class="chapter-buttons">';
    html += '<span class="chapter-buttons-label">Graha</span>';

    GRAHA_INFO.forEach(function (info) {
      // Check if this graha exists in the current stotra
      var hasData = false;
      for (var i = 0; i < stotra.grahas.length; i++) {
        if (stotra.grahas[i].graha === info.num) { hasData = true; break; }
      }

      var activeClass = (info.num === currentGraha && hasData) ? ' chapter-btn-active' : '';
      var disabledClass = hasData ? '' : ' chapter-btn-disabled';
      var tooltip = hasData
        ? info.name + ' (' + info.symbol + ')'
        : info.name + ' \u2014 Coming Soon';

      html += '<button class="chapter-btn' + activeClass + disabledClass + '"';
      html += ' data-graha="' + info.num + '"';
      html += ' title="' + tooltip + '"';
      if (!hasData) html += ' disabled';
      html += '>' + escapeHtml(info.short) + '</button>';
    });

    html += '</div>';
    container.innerHTML = html;

    // Bind click events
    container.querySelectorAll('.chapter-btn:not(.chapter-btn-disabled)').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var grahaNum = parseInt(btn.getAttribute('data-graha'), 10);
        loadGraha(currentStotra, grahaNum);
      });
    });
  }

  // --- Update section heading for current graha ---
  function updateStotraHeading() {
    var stotra = getStotra(currentStotra);
    if (!stotra) return;
    var graha = getGraha(currentStotra, currentGraha);
    if (!graha) return;
    var info = getGrahaInfo(currentGraha);

    var heading = document.getElementById('stotra-heading');
    if (heading) {
      heading.innerHTML = escapeHtml(stotra.titleEnglish) + ' \u2014 ' + escapeHtml(graha.grahaName) + ' ' + info.symbol +
        ' <span class="section-heading-sanskrit">' + escapeHtml(graha.grahaSanskrit) + '</span>';
    }

    var intro = document.getElementById('stotra-intro');
    if (intro) {
      intro.textContent = graha.grahaName + ' \u2014 ' + graha.slokas.length + ' Sloka' + (graha.slokas.length !== 1 ? 's' : '');
    }
  }

  // --- Render stotra index (landing page: 2 cards) ---
  function renderStotraIndex() {
    var container = document.getElementById('stotra-index');
    if (!container) return;

    var html = '';

    data.stotras.forEach(function (stotra) {
      html += '<div class="chapter-index-card" data-stotra="' + escapeHtml(stotra.id) + '">';
      html += '<div class="chapter-index-number">' + escapeHtml(stotra.titleEnglish) + '</div>';
      html += '<div class="chapter-index-sanskrit">' + escapeHtml(stotra.titleSanskrit) + '</div>';
      if (stotra.titleMeaning) {
        html += '<div class="chapter-index-meaning">' + escapeHtml(stotra.titleMeaning) + '</div>';
      }
      if (stotra.summary) {
        var summaryText = stotra.summary.length > 200 ? stotra.summary.substring(0, 200) + '...' : stotra.summary;
        html += '<div class="chapter-index-summary">' + escapeHtml(summaryText) + '</div>';
      }
      html += '<div class="chapter-index-read">Explore ' + escapeHtml(stotra.titleEnglish) + ' &rarr;</div>';
      html += '</div>';
    });

    container.innerHTML = html;

    // Bind click events
    container.querySelectorAll('.chapter-index-card').forEach(function (card) {
      card.addEventListener('click', function () {
        var stotraId = card.getAttribute('data-stotra');
        renderGrahaIndex(stotraId);
      });
    });
  }

  // --- Render graha index (9 graha cards for selected stotra) ---
  function renderGrahaIndex(stotraId) {
    var stotra = getStotra(stotraId);
    if (!stotra) return;

    currentStotra = stotraId;
    currentGraha = null;

    var indexEl = document.getElementById('stotra-index');
    var navEl = document.getElementById('stotra-nav');
    var containerEl = document.getElementById('stotra-container');

    if (indexEl) indexEl.style.display = 'none';
    if (navEl) navEl.style.display = 'none';
    if (containerEl) containerEl.innerHTML = '';

    // Update heading
    var heading = document.getElementById('stotra-heading');
    if (heading) {
      heading.innerHTML = escapeHtml(stotra.titleEnglish) +
        ' <span class="section-heading-sanskrit">' + escapeHtml(stotra.titleSanskrit) + '</span>';
    }
    var intro = document.getElementById('stotra-intro');
    if (intro) {
      intro.textContent = 'Select a Graha to begin reading';
    }

    // Build graha cards inside container
    var html = '<div class="chapter-controls">' +
      '<div class="chapter-controls-row">' +
      '<button class="expand-btn back-btn" data-action="back-to-stotras">&larr; All Stotras</button>' +
      '</div>' +
      '</div>';

    html += '<div class="graha-index-grid">';

    stotra.grahas.forEach(function (graha) {
      var info = getGrahaInfo(graha.graha);
      html += '<div class="chapter-index-card graha-index-card" data-stotra="' + escapeHtml(stotraId) + '" data-graha="' + graha.graha + '">';
      html += '<div class="graha-symbol">' + (info ? info.symbol : '') + '</div>';
      html += '<div class="chapter-index-number">' + escapeHtml(graha.grahaName) + '</div>';
      html += '<div class="chapter-index-sanskrit">' + escapeHtml(graha.grahaSanskrit) + '</div>';
      html += '<div class="chapter-index-meaning">' + graha.slokas.length + ' Sloka' + (graha.slokas.length !== 1 ? 's' : '') + '</div>';
      html += '<div class="chapter-index-read">Read ' + escapeHtml(graha.grahaName) + ' &rarr;</div>';
      html += '</div>';
    });

    html += '</div>';

    if (containerEl) containerEl.innerHTML = html;

    // Bind click events
    if (containerEl) {
      containerEl.querySelectorAll('.graha-index-card').forEach(function (card) {
        card.addEventListener('click', function () {
          var sid = card.getAttribute('data-stotra');
          var gNum = parseInt(card.getAttribute('data-graha'), 10);
          loadGraha(sid, gNum);
        });
      });
    }

    // Scroll to top
    if (heading) heading.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // --- Show stotra index (landing state) ---
  function showStotraIndex() {
    currentStotra = null;
    currentGraha = null;

    var indexEl = document.getElementById('stotra-index');
    var navEl = document.getElementById('stotra-nav');
    var containerEl = document.getElementById('stotra-container');

    if (indexEl) indexEl.style.display = '';
    if (navEl) navEl.style.display = 'none';
    if (containerEl) containerEl.innerHTML = '';

    var heading = document.getElementById('stotra-heading');
    if (heading) {
      heading.innerHTML = 'Navagraha Stotras <span class="section-heading-sanskrit">\u0928\u0935\u0917\u094D\u0930\u0939 \u0938\u094D\u0924\u094B\u0924\u094D\u0930\u093E\u0923\u093F</span>';
    }
    var intro = document.getElementById('stotra-intro');
    if (intro) {
      intro.textContent = 'Select a stotra to begin reading';
    }

    // Clear other views too
    var wordsContainer = document.getElementById('words-container');
    if (wordsContainer) wordsContainer.innerHTML = '';
    var meaningsContainer = document.getElementById('meanings-container');
    if (meaningsContainer) meaningsContainer.innerHTML = '';
  }

  // --- Load a specific graha's slokas ---
  function loadGraha(stotraId, grahaNum) {
    var graha = getGraha(stotraId, grahaNum);
    if (!graha) return;

    currentStotra = stotraId;
    currentGraha = grahaNum;
    currentSlokaIndex = 0;

    // Hide the stotra index, show nav + slokas
    var indexEl = document.getElementById('stotra-index');
    var navEl = document.getElementById('stotra-nav');
    if (indexEl) indexEl.style.display = 'none';
    if (navEl) navEl.style.display = '';

    renderGrahaNav();
    updateStotraHeading();
    renderStotraView();
    renderWordsView();
    renderMeaningsView();

    // Scroll to top of content
    var heading = document.getElementById('stotra-heading');
    if (heading) heading.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // --- Render Stotra View (expandable cards) ---
  function renderStotraView() {
    var container = document.getElementById('stotra-container');
    if (!container) return;

    var slokas = getCurrentGrahaSlokas();
    var html = buildControls('All Grahas', 'back-to-grahas');

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

    var slokas = getCurrentGrahaSlokas();
    var html = '';

    slokas.forEach(function (sloka) {
      html += '<div class="word-view-card">';
      html += '<div class="word-view-header">';
      html += '<span class="verse-number">' + slokaRefLabel(sloka) + '</span>';
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

  // --- Render Meanings View ---
  function renderMeaningsView() {
    var container = document.getElementById('meanings-container');
    if (!container) return;

    var slokas = getCurrentGrahaSlokas();
    var html = '';

    slokas.forEach(function (sloka) {
      html += '<div class="insight-card">';
      html += '<div class="insight-card-header">';
      html += '<span class="verse-number">' + slokaRefLabel(sloka) + '</span>';
      html += '</div>';

      // Sloka text (smaller)
      html += '<div class="insight-sloka-text">' + escapeHtml(sloka.devanagari) + '</div>';
      html += '<div class="insight-transliteration">' + escapeHtml(sloka.transliteration) + '</div>';

      // Translation (prominent)
      html += '<div class="insight-translation">' + escapeHtml(sloka.translation) + '</div>';

      // Significance note if available
      if (sloka.significance) {
        html += '<div class="modern-insight">';
        html += '<div class="modern-insight-label">Significance</div>';
        html += '<div class="modern-insight-text">' + escapeHtml(sloka.significance) + '</div>';
        html += '</div>';
      }

      html += '</div>';
    });

    container.innerHTML = html;
  }

  // --- Build search result card with highlights ---
  function buildSearchResultCard(sloka, query, matchedField) {
    var cardId = 'search-' + slokaCardId(sloka);
    var stotra = getStotra(sloka.stotra);
    var stotraLabel = stotra ? stotra.titleEnglish : sloka.stotra;
    var info = getGrahaInfo(sloka.graha);
    var grahaLabel = info ? info.name : 'Graha ' + sloka.graha;

    var html = '<div class="verse-card expanded" id="' + cardId + '">';

    // Header
    html += '<div class="verse-header">';
    html += '<span class="verse-number">' + slokaRefLabel(sloka) + '</span>';
    html += '<span class="search-match-field">' + escapeHtml(stotraLabel) + ' \u2014 ' + escapeHtml(grahaLabel) + ' | Matched in: ' + escapeHtml(matchedField) + '</span>';
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

    // Significance
    if (sloka.significance) {
      html += '<div class="modern-insight">';
      html += '<div class="modern-insight-label">Significance</div>';
      html += '<div class="modern-insight-text">' + highlightText(sloka.significance, query) + '</div>';
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
    if (sloka.significance && sloka.significance.toLowerCase().indexOf(q) !== -1) fields.push('Significance');

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
          if (sloka.devanagari.toLowerCase().indexOf(query) !== -1) return true;
          if (sloka.transliteration.toLowerCase().indexOf(query) !== -1) return true;
          if (sloka.translation.toLowerCase().indexOf(query) !== -1) return true;
          if (sloka.significance && sloka.significance.toLowerCase().indexOf(query) !== -1) return true;

          // Search graha name
          var info = getGrahaInfo(sloka.graha);
          if (info && info.name.toLowerCase().indexOf(query) !== -1) return true;

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
    requestAnimationFrame(updateScrollButtons);
  };

  // --- Re-evaluate scroll button visibility ---
  function updateScrollButtons() {
    var scrollBtns = document.getElementById('scrollButtons');
    if (!scrollBtns) return;
    if (window.scrollY > 300) {
      scrollBtns.classList.add('visible');
    } else {
      scrollBtns.classList.remove('visible');
    }
  }

  // --- Expand/Collapse All handler ---
  function setupExpandCollapse() {
    document.addEventListener('click', function (e) {
      var btn = e.target.closest('.expand-btn');
      if (!btn) return;

      var action = btn.getAttribute('data-action');

      if (action === 'back-to-stotras') {
        showStotraIndex();
        return;
      }

      if (action === 'back-to-grahas') {
        if (currentStotra) {
          renderGrahaIndex(currentStotra);
        } else {
          showStotraIndex();
        }
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

      // Re-evaluate scroll button visibility after layout change
      requestAnimationFrame(updateScrollButtons);
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

    // Expected format: #suktam-graha-1-sloka-1
    var match = hash.match(/^#([a-zA-Z]+)-graha-(\d+)-sloka-(\d+)$/);
    if (!match) return;

    var stotraId = match[1];
    var grahaNum = parseInt(match[2], 10);
    var slokaNum = parseInt(match[3], 10);

    var graha = getGraha(stotraId, grahaNum);
    if (!graha) return;

    // Load the graha if different
    if (stotraId !== currentStotra || grahaNum !== currentGraha) {
      loadGraha(stotraId, grahaNum);
    }

    // Scroll to the specific sloka
    var targetId = stotraId + '-graha-' + grahaNum + '-sloka-' + slokaNum;
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

      var slokas = getCurrentGrahaSlokas();
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
        if (currentSlokaIndex < slokas.length) {
          var curId = slokaCardId(slokas[currentSlokaIndex]);
          var curEl = document.getElementById(curId);
          if (curEl) curEl.classList.remove('expanded');
        }
      }
    });
  }

  // --- Initialize ---
  function init() {
    renderStotraIndex();
    setupSearch();
    setupNavigation();
    setupExpandCollapse();
    setupProgressBar();
    setupKeyboardNav();

    // If URL has a hash, load that graha directly; otherwise show index
    var hash = window.location.hash;
    if (hash && hash.match(/^#[a-zA-Z]+-graha-\d+/)) {
      handleHashNavigation();
    } else {
      showStotraIndex();
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
