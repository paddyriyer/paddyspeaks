// Abhirami Andhadhi - Interactive Application
// =============================================

(function () {
  'use strict';

  var verses = ABHIRAMI_ANDHADHI_DATA;
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
  window.toggleVerse = function (id) {
    var el = document.getElementById(id);
    if (!el) el = document.getElementById('verse-' + id);
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
  function buildSearchVerseCard(verse, query) {
    var num = verse.num;
    var isKaappu = num === 0;
    var label = isKaappu ? 'Kaappu' : String(num);
    var cardClass = isKaappu ? 'kaappu-verse' : (num <= 50 ? 'first-half-verse' : 'second-half-verse');

    var preview = verse.tamil.split('\n')[0];
    if (preview.length > 60) preview = preview.substring(0, 60) + '...';

    var html = '<div class="verse-card ' + cardClass + ' expanded" id="search-verse-' + num + '">';

    html += '<div class="verse-header" onclick="toggleVerse(\'search-verse-' + num + '\')">';
    html += '<span class="verse-number">' + label + '</span>';
    html += '<span class="verse-text-preview">' + highlightText(preview, query) + '</span>';
    if (isKaappu) {
      html += '<span class="verse-section-tag">Invocation</span>';
    }
    html += '<span class="verse-toggle">&#9660;</span>';
    html += '</div>';

    html += '<div class="verse-body">';
    html += '<div class="tamil-block">' + highlightText(verse.tamil, query) + '</div>';
    html += '<div class="transliteration-block">' + highlightText(verse.transliteration, query) + '</div>';
    html += '<div class="meaning-block">';
    html += '<div class="meaning-label">Meaning</div>';
    html += '<div class="meaning-text">' + highlightText(verse.meaning, query) + '</div>';
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
      if (searchTimer) clearTimeout(searchTimer);
      searchTimer = setTimeout(function () {
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
          html += buildSearchVerseCard(verse, query);
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
      document.getElementById('progressBar').style.width = progress + '%';

      // Show/hide scroll buttons
      if (scrollButtons) {
        if (scrollTop > 300) {
          scrollButtons.classList.add('visible');
        } else {
          scrollButtons.classList.remove('visible');
        }
      }
    });
  }

  // --- Generate PDF (open print-ready window) ---
  window.generatePDF = function () {
    var printWin = window.open('', '_blank');
    if (!printWin) {
      alert('Please allow pop-ups to download the PDF.');
      return;
    }

    var html = '<!DOCTYPE html><html lang="en"><head>';
    html += '<meta charset="UTF-8">';
    html += '<title>Abhirami Andhadhi — PDF</title>';
    html += '<link rel="preconnect" href="https://fonts.googleapis.com">';
    html += '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>';
    html += '<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Tamil:wght@400;600;700&family=Playfair+Display:wght@400;600;700&family=Source+Serif+4:opsz,wght@8..60,300;8..60,400;8..60,600&display=swap" rel="stylesheet">';
    html += '<style>';
    html += '*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }';
    html += 'body { font-family: "Source Serif 4", Georgia, serif; color: #2c1810; background: #fff; line-height: 1.7; padding: 0; }';
    html += '.title-page { text-align: center; padding: 120px 40px 80px; page-break-after: always; }';
    html += '.title-page h1 { font-family: "Playfair Display", Georgia, serif; font-size: 36px; color: #c41e3a; margin-bottom: 12px; }';
    html += '.title-page .tamil-title { font-family: "Noto Sans Tamil", sans-serif; font-size: 22px; color: #6b5744; margin-bottom: 8px; }';
    html += '.title-page .subtitle { font-size: 16px; color: #6b5744; }';
    html += '.title-page .author { font-size: 14px; color: #999; margin-top: 40px; }';
    html += '.title-page .ornament { font-size: 24px; color: #b8860b; margin-bottom: 30px; }';
    html += '.content { max-width: 700px; margin: 0 auto; padding: 20px 30px; }';
    html += '.verse-block { page-break-inside: avoid; margin-bottom: 28px; padding: 16px 18px; border: 1px solid #d4c4b0; border-radius: 6px; border-left: 4px solid #c41e3a; background: #fff; }';
    html += '.verse-block.kaappu { border-left-color: #b8860b; }';
    html += '.verse-block.noorpayan { border-left-color: #b8860b; }';
    html += '.verse-label { font-family: "Playfair Display", Georgia, serif; font-weight: 700; font-size: 13px; color: #c41e3a; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.05em; }';
    html += '.kaappu .verse-label, .noorpayan .verse-label { color: #b8860b; }';
    html += '.tamil-text { font-family: "Noto Sans Tamil", sans-serif; font-size: 15px; line-height: 2.1; text-align: center; padding: 12px; background: #f7efe3; border-radius: 4px; margin-bottom: 10px; white-space: pre-line; }';
    html += '.translit-text { font-size: 12px; line-height: 1.9; text-align: center; font-style: italic; color: #4a3728; margin-bottom: 10px; white-space: pre-line; }';
    html += '.meaning-box { font-size: 11.5px; line-height: 1.65; padding: 10px 12px; border-left: 3px solid #b8860b; background: #fffef8; color: #2c1810; }';
    html += '.meaning-label { font-family: "Playfair Display", Georgia, serif; font-size: 10px; font-weight: 600; color: #b8860b; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 4px; }';
    html += '.footer-page { text-align: center; padding: 60px 40px; page-break-before: always; }';
    html += '.footer-page p { color: #6b5744; font-size: 14px; margin-bottom: 6px; }';
    html += '.footer-page .mantra { font-size: 18px; color: #c41e3a; margin-bottom: 16px; }';
    html += '@media print {';
    html += '  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }';
    html += '  .verse-block { page-break-inside: avoid; }';
    html += '  .title-page { page-break-after: always; }';
    html += '}';
    html += '</style></head><body>';

    // Title page
    html += '<div class="title-page">';
    html += '<div class="ornament">&#x2733;</div>';
    html += '<h1>Abhirami Andhadhi</h1>';
    html += '<p class="tamil-title">அபிராமி அந்தாதி</p>';
    html += '<p class="subtitle">100 Verses of Devotion to the Divine Mother</p>';
    html += '<p class="author">By Abhirami Bhattar &middot; Thirukkadaiyur<br>அபிராமி பட்டர் &middot; திருக்கடையூர்</p>';
    html += '<div class="ornament" style="margin-top:50px;">&#x2733;</div>';
    html += '</div>';

    // Verses
    html += '<div class="content">';
    verses.forEach(function (verse) {
      var num = verse.num;
      var label, extraClass;
      if (num === 0) { label = 'Kaappu — Invocation'; extraClass = 'kaappu'; }
      else if (num === 101) { label = 'Noorpayan — Benefit of Recitation'; extraClass = 'noorpayan'; }
      else { label = 'Verse ' + num; extraClass = ''; }

      html += '<div class="verse-block ' + extraClass + '">';
      html += '<div class="verse-label">' + label + '</div>';
      html += '<div class="tamil-text">' + escapeHtml(verse.tamil) + '</div>';
      html += '<div class="translit-text">' + escapeHtml(verse.transliteration) + '</div>';
      if (verse.meaning) {
        html += '<div class="meaning-box">';
        html += '<div class="meaning-label">Meaning</div>';
        html += escapeHtml(verse.meaning);
        html += '</div>';
      }
      html += '</div>';
    });
    html += '</div>';

    // Footer page
    html += '<div class="footer-page">';
    html += '<div style="font-size:24px;color:#b8860b;margin-bottom:20px;">&#x2733;</div>';
    html += '<p class="mantra">Om Shreem Abhirami Namaha</p>';
    html += '<p>Abhirami Andhadhi — Composed by Abhirami Bhattar at Thirukkadaiyur</p>';
    html += '<p style="font-size:12px;color:#999;margin-top:12px;">A PaddySpeaks creation &middot; paddyspeaks.com</p>';
    html += '</div>';

    html += '</body></html>';

    printWin.document.write(html);
    printWin.document.close();

    // Wait for fonts to load, then trigger print
    printWin.onload = function () {
      setTimeout(function () { printWin.print(); }, 500);
    };
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
    renderAllVerses();
    renderFirst50();
    renderLast50();
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
