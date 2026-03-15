// Hanuman Chalisa - Interactive Application
// ============================================

(function () {
  'use strict';

  var data = HANUMAN_CHALISA_DATA;
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

  // --- Get all verses as flat array ---
  function getAllVerses() {
    var verses = [];
    data.introDohas.forEach(function (d) { verses.push(d); });
    data.chaupais.forEach(function (c) { verses.push(c); });
    verses.push(data.closingDoha);
    return verses;
  }

  // --- Build a single verse card HTML ---
  function buildVerseCard(verse) {
    var isDoha = verse.type === 'doha';
    var cardClass = isDoha ? 'doha-verse' : 'chaupai-verse';
    var typeLabel = isDoha ? 'Doha' : 'Chaupai';
    var displayNum = isDoha ? 'D' + verse.num : verse.num;
    var cardId = isDoha ? 'doha-' + verse.num : 'chaupai-' + verse.num;

    // For closing doha, use unique id
    if (verse === data.closingDoha) {
      cardId = 'closing-doha';
      displayNum = 'D';
    }

    // Preview: first line of Hindi
    var preview = verse.hindi.split('\n')[0];
    if (preview.length > 50) preview = preview.substring(0, 50) + '...';

    var html = '<div class="verse-card ' + cardClass + '" id="' + cardId + '">';

    // Header
    html += '<div class="verse-header" onclick="toggleVerse(\'' + cardId + '\')">';
    html += '<span class="verse-number">' + displayNum + '</span>';
    html += '<span class="verse-text-preview">' + escapeHtml(preview) + '</span>';
    html += '<span class="verse-type-tag">' + typeLabel + '</span>';
    html += '<span class="verse-toggle">&#9660;</span>';
    html += '</div>';

    // Body
    html += '<div class="verse-body">';

    // Hindi text
    html += '<div class="hindi-block">' + escapeHtml(verse.hindi) + '</div>';

    // Transliteration
    html += '<div class="transliteration-block">' + escapeHtml(verse.transliteration) + '</div>';

    // English translation
    html += '<div class="english-block">';
    html += '<div class="english-label">English Translation</div>';
    html += '<div class="english-text">' + escapeHtml(verse.english) + '</div>';
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

  // --- Render Complete Chalisa (All view) ---
  function renderAll() {
    var container = document.getElementById('all-container');
    var html = buildControls();

    // Opening Dohas
    html += '<div class="section-divider">Opening Dohas</div>';
    data.introDohas.forEach(function (doha) {
      html += buildVerseCard(doha);
    });

    // Chaupais
    html += '<div class="section-divider">Chaupais (1&ndash;40)</div>';
    data.chaupais.forEach(function (chaupai) {
      html += buildVerseCard(chaupai);
    });

    // Closing Doha
    html += '<div class="section-divider">Closing Doha</div>';
    html += buildVerseCard(data.closingDoha);

    container.innerHTML = html;

    // Expand first few by default
    ['doha-1', 'doha-2', 'chaupai-1', 'chaupai-2', 'chaupai-3'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.classList.add('expanded');
    });
  }

  // --- Render Hindi Only View ---
  function renderHindiOnly() {
    var container = document.getElementById('hindi-container');
    var html = '';

    html += '<div class="section-divider">Opening Dohas</div>';
    data.introDohas.forEach(function (d) {
      html += '<div class="hindi-only-card doha">';
      html += '<div class="verse-num-label">Doha ' + d.num + '</div>';
      html += '<div class="hindi-text">' + escapeHtml(d.hindi) + '</div>';
      html += '</div>';
    });

    html += '<div class="section-divider">चौपाई (1&ndash;40)</div>';
    data.chaupais.forEach(function (c) {
      html += '<div class="hindi-only-card chaupai">';
      html += '<div class="verse-num-label">Chaupai ' + c.num + '</div>';
      html += '<div class="hindi-text">' + escapeHtml(c.hindi) + '</div>';
      html += '</div>';
    });

    html += '<div class="section-divider">Closing Doha</div>';
    html += '<div class="hindi-only-card doha">';
    html += '<div class="verse-num-label">Doha</div>';
    html += '<div class="hindi-text">' + escapeHtml(data.closingDoha.hindi) + '</div>';
    html += '</div>';

    container.innerHTML = html;
  }

  // --- Render English Only View ---
  function renderEnglishOnly() {
    var container = document.getElementById('english-container');
    var html = '';

    html += '<div class="section-divider">Opening Dohas</div>';
    data.introDohas.forEach(function (d) {
      html += '<div class="english-only-card doha">';
      html += '<div class="verse-num-label">Doha ' + d.num + '</div>';
      html += '<div class="english-text">' + escapeHtml(d.english) + '</div>';
      html += '</div>';
    });

    html += '<div class="section-divider">Chaupais (1&ndash;40)</div>';
    data.chaupais.forEach(function (c) {
      html += '<div class="english-only-card chaupai">';
      html += '<div class="verse-num-label">Chaupai ' + c.num + '</div>';
      html += '<div class="english-text">' + escapeHtml(c.english) + '</div>';
      html += '</div>';
    });

    html += '<div class="section-divider">Closing Doha</div>';
    html += '<div class="english-only-card doha">';
    html += '<div class="verse-num-label">Doha</div>';
    html += '<div class="english-text">' + escapeHtml(data.closingDoha.english) + '</div>';
    html += '</div>';

    container.innerHTML = html;
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

  // --- Build search result card with highlights ---
  function buildSearchResultCard(verse, query) {
    var isDoha = verse.type === 'doha';
    var cardClass = isDoha ? 'doha-verse' : 'chaupai-verse';
    var displayNum = isDoha ? 'D' + verse.num : verse.num;
    var cardId = 'search-' + (isDoha ? 'doha-' + verse.num : 'chaupai-' + verse.num);

    if (verse === data.closingDoha) {
      cardId = 'search-closing-doha';
      displayNum = 'D';
    }

    var html = '<div class="verse-card ' + cardClass + ' expanded" id="' + cardId + '">';
    html += '<div class="verse-header">';
    html += '<span class="verse-number">' + displayNum + '</span>';
    html += '<span class="verse-text-preview">' + escapeHtml(verse.hindi.split('\n')[0].substring(0, 50)) + '</span>';
    html += '</div>';
    html += '<div class="verse-body">';
    html += '<div class="hindi-block">' + highlightText(verse.hindi, query) + '</div>';
    html += '<div class="transliteration-block">' + highlightText(verse.transliteration, query) + '</div>';
    html += '<div class="english-block">';
    html += '<div class="english-label">English Translation</div>';
    html += '<div class="english-text">' + highlightText(verse.english, query) + '</div>';
    html += '</div>';
    html += '</div></div>';
    return html;
  }

  // --- Search ---
  function setupSearch() {
    var input = document.getElementById('search-input');
    var results = document.getElementById('search-results');
    var count = document.getElementById('search-count');
    var allVerses = getAllVerses();

    input.addEventListener('input', function () {
      if (searchTimer) clearTimeout(searchTimer);

      searchTimer = setTimeout(function () {
        var query = input.value.trim().toLowerCase();
        if (query.length < 2) {
          results.innerHTML = '<p style="text-align:center;color:#6b5744;padding:2rem;">Type at least 2 characters to search...</p>';
          count.textContent = '';
          return;
        }

        var matches = allVerses.filter(function (verse) {
          return (
            String(verse.num) === query ||
            verse.hindi.toLowerCase().includes(query) ||
            verse.transliteration.toLowerCase().includes(query) ||
            verse.english.toLowerCase().includes(query)
          );
        });

        count.textContent = matches.length + ' found';

        if (matches.length === 0) {
          results.innerHTML = '<p style="text-align:center;color:#6b5744;padding:2rem;">No verses found matching "' + escapeHtml(query) + '"</p>';
          return;
        }

        var html = '';
        matches.forEach(function (verse) {
          html += buildSearchResultCard(verse, query);
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
          while (next && !next.classList.contains('verse-card')) {
            next = next.nextElementSibling;
          }
          if (next) {
            next.classList.add('expanded');
            next.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        } else if (cards[0]) {
          cards[0].classList.add('expanded');
          cards[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (lastExpanded) {
          var prev = lastExpanded.previousElementSibling;
          while (prev && !prev.classList.contains('verse-card')) {
            prev = prev.previousElementSibling;
          }
          if (prev) {
            prev.classList.add('expanded');
            prev.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }
      } else if (e.key === 'Escape') {
        if (lastExpanded) lastExpanded.classList.remove('expanded');
      }
    });
  }

  // --- Initialize ---
  function init() {
    renderAll();
    renderHindiOnly();
    renderEnglishOnly();
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
