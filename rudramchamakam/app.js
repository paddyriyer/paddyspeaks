// Sri Rudram Chamakam Application
// ================================

(function () {
  'use strict';

  var searchTimer = null;
  var showDevanagari = true;

  // --- Utility: Escape HTML ---
  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // --- Utility: Highlight Text ---
  function highlightText(text, query) {
    if (!query) return escapeHtml(text);
    var escaped = escapeHtml(text);
    var queryEscaped = escapeHtml(query);
    var regex = new RegExp('(' + queryEscaped.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
    return escaped.replace(regex, '<mark>$1</mark>');
  }

  // --- Build word grid for a mantra ---
  function buildWordGrid(mantra) {
    var words = mantra.words;
    if (!words || words.length === 0) {
      // Auto-derive words from transliteration
      var trans = (mantra.transliteration || mantra.text || '').replace(/[|॥]/g, ' ').trim();
      var parts = trans.split(/[\s]+/).filter(Boolean);
      if (parts.length === 0) return '';
      words = parts.map(function (w) {
        return { word: '', transliteration: w, meaning: '' };
      });
    }

    var html = '<div class="word-grid">';
    words.forEach(function (w) {
      html += '<div class="word-card">';
      if (w.word) {
        html += '<div class="word-devanagari">' + escapeHtml(w.word) + '</div>';
      }
      html += '<div class="word-transliteration">' + escapeHtml(w.transliteration) + '</div>';
      if (w.meaning) {
        html += '<div class="word-meaning">' + escapeHtml(w.meaning) + '</div>';
      }
      html += '</div>';
    });
    html += '</div>';
    return html;
  }

  // --- Build mantra HTML ---
  function buildMantraHtml(mantra, part) {
    var translation = mantra.translation || mantra.meaning || '';
    var esotericMeaning = mantra.esotericMeaning || '';
    var trans = mantra.transliteration || mantra.text || '';
    var devanagari = mantra.devanagari || '';

    var html = '<div class="mantra-block">';

    if (devanagari) {
      html += '<div class="mantra-devanagari devanagari-text">' + escapeHtml(devanagari) + '</div>';
    }

    if (trans) {
      html += '<div class="mantra-text">' + escapeHtml(trans) + '</div>';
    }

    if (translation) {
      html += '<div class="mantra-translation">' + escapeHtml(translation) + '</div>';
    }

    var wordGrid = buildWordGrid(mantra);
    if (wordGrid) {
      html += '<div class="word-section-label">Word by Word</div>';
      html += wordGrid;
    }

    if (esotericMeaning) {
      html += '<div class="esoteric-meaning">';
      html += '<span class="esoteric-label">Esoteric Meaning</span> ';
      html += escapeHtml(esotericMeaning);
      html += '</div>';
    }

    html += '</div>';
    return html;
  }

  // --- Build section card HTML ---
  function buildSectionCard(section) {
    var sectionId = section.id;
    var part = section.part || 'namakam';

    var mantrasHtml = '';
    if (section.description) {
      mantrasHtml += '<div class="section-description">' + escapeHtml(section.description) + '</div>';
    }
    section.mantras.forEach(function (mantra) {
      mantrasHtml += buildMantraHtml(mantra, part);
    });

    var html = '<div class="section-card part-' + part + '" id="section-' + sectionId + '">';
    html += '<div class="section-card-header" onclick="toggleSection(' + sectionId + ')">';
    html += '<span class="section-number">' + sectionId + '</span>';
    html += '<div class="section-title-area">';
    html += '<div class="section-card-title">' + escapeHtml(section.title) + '</div>';
    if (section.titleSanskrit) {
      html += '<div class="section-card-sanskrit">' + escapeHtml(section.titleSanskrit) + '</div>';
    }
    if (section.subtitle) {
      html += '<div class="section-card-subtitle">' + escapeHtml(section.subtitle) + '</div>';
    }
    html += '</div>';
    html += '<span class="section-toggle">&#9660;</span>';
    html += '</div>';
    html += '<div class="section-body">';
    html += mantrasHtml;
    html += '</div>';
    html += '</div>';

    return html;
  }

  // --- Group sections by part ---
  function getSectionsByPart() {
    var namakam = [];
    var chamakam = [];
    RUDRAM_DATA.sections.forEach(function (section) {
      if (section.part === 'chamakam') chamakam.push(section);
      else namakam.push(section);
    });
    return { namakam: namakam, chamakam: chamakam };
  }

  // --- Render Intro ---
  function renderIntro() {
    var container = document.getElementById('intro-content');
    if (container && RUDRAM_DATA.intro) {
      container.textContent = RUDRAM_DATA.intro;
    }
  }

  // --- Render All Sections (Reading View) ---
  function renderSections() {
    var namakamContainer = document.getElementById('namakam-container');
    var chamakamContainer = document.getElementById('chamakam-container');
    var parts = getSectionsByPart();

    // Controls
    var controlsDiv = document.createElement('div');
    controlsDiv.className = 'expand-controls';
    controlsDiv.innerHTML =
      '<button class="expand-btn" id="expand-all">Expand All</button>' +
      '<button class="expand-btn" id="collapse-all">Collapse All</button>' +
      '<button class="expand-btn" id="toggle-devanagari">Hide Devanagari</button>';
    var namakamHeader = document.getElementById('namakam-header');
    namakamHeader.parentNode.insertBefore(controlsDiv, namakamHeader);

    // Namakam
    var namakamHtml = '';
    parts.namakam.forEach(function (section) { namakamHtml += buildSectionCard(section); });
    namakamContainer.innerHTML = namakamHtml;

    // Chamakam
    var chamakamHtml = '';
    parts.chamakam.forEach(function (section) { chamakamHtml += buildSectionCard(section); });
    chamakamContainer.innerHTML = chamakamHtml;

    // Expand first 2 by default
    for (var i = 1; i <= 2; i++) {
      var el = document.getElementById('section-' + i);
      if (el) el.classList.add('expanded');
    }

    document.getElementById('expand-all').addEventListener('click', function () {
      document.querySelectorAll('.section-card').forEach(function (c) { c.classList.add('expanded'); });
    });
    document.getElementById('collapse-all').addEventListener('click', function () {
      document.querySelectorAll('.section-card').forEach(function (c) { c.classList.remove('expanded'); });
    });
    document.getElementById('toggle-devanagari').addEventListener('click', function () {
      showDevanagari = !showDevanagari;
      this.textContent = showDevanagari ? 'Hide Devanagari' : 'Show Devanagari';
      document.querySelectorAll('.mantra-devanagari, .word-devanagari').forEach(function (el) {
        el.style.display = showDevanagari ? '' : 'none';
      });
    });
  }

  // --- Toggle section expansion ---
  window.toggleSection = function (id) {
    var el = document.getElementById('section-' + id);
    if (el) el.classList.toggle('expanded');
  };

  // --- Render Sections Grid (Overview) ---
  function renderSectionsGrid() {
    var container = document.getElementById('sections-grid');
    var parts = getSectionsByPart();
    var html = '';

    html += '<div class="grid-part-header namakam-header">Namakam <span class="grid-part-count">(' + parts.namakam.length + ' anuvakas)</span></div>';
    html += '<div class="sections-grid-group">';
    parts.namakam.forEach(function (section) {
      html += '<div class="section-grid-item part-namakam" onclick="navigateToSection(' + section.id + ')">';
      html += '<span class="section-grid-number">' + section.id + '</span>';
      html += '<div class="section-grid-details">';
      html += '<div class="section-grid-title">' + escapeHtml(section.title) + '</div>';
      if (section.titleSanskrit) html += '<div class="section-grid-sanskrit">' + escapeHtml(section.titleSanskrit) + '</div>';
      if (section.subtitle) html += '<div class="section-grid-subtitle">' + escapeHtml(section.subtitle) + '</div>';
      html += '</div></div>';
    });
    html += '</div>';

    html += '<div class="grid-part-header chamakam-header">Chamakam <span class="grid-part-count">(' + parts.chamakam.length + ' anuvakas)</span></div>';
    html += '<div class="sections-grid-group">';
    parts.chamakam.forEach(function (section) {
      html += '<div class="section-grid-item part-chamakam" onclick="navigateToSection(' + section.id + ')">';
      html += '<span class="section-grid-number">' + section.id + '</span>';
      html += '<div class="section-grid-details">';
      html += '<div class="section-grid-title">' + escapeHtml(section.title) + '</div>';
      if (section.titleSanskrit) html += '<div class="section-grid-sanskrit">' + escapeHtml(section.titleSanskrit) + '</div>';
      if (section.subtitle) html += '<div class="section-grid-subtitle">' + escapeHtml(section.subtitle) + '</div>';
      html += '</div></div>';
    });
    html += '</div>';

    container.innerHTML = html;
  }

  // --- Navigate to section in reading view ---
  window.navigateToSection = function (id) {
    document.querySelectorAll('.nav-btn').forEach(function (b) { b.classList.remove('active'); });
    document.querySelector('[data-view="reading"]').classList.add('active');
    document.querySelectorAll('.view').forEach(function (v) { v.classList.remove('active'); });
    document.getElementById('reading-view').classList.add('active');

    var el = document.getElementById('section-' + id);
    if (el) {
      el.classList.add('expanded');
      setTimeout(function () { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 100);
    }
  };

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
          results.innerHTML = '<p class="search-empty">Type at least 2 characters to search...</p>';
          count.textContent = '';
          return;
        }

        var matches = [];
        RUDRAM_DATA.sections.forEach(function (section) {
          var sectionMatch = section.title.toLowerCase().includes(query) ||
            (section.subtitle || '').toLowerCase().includes(query) ||
            (section.titleSanskrit || '').includes(query);

          section.mantras.forEach(function (mantra) {
            var trans = (mantra.transliteration || mantra.text || '').toLowerCase();
            var devanagari = (mantra.devanagari || '');
            var translation = (mantra.translation || mantra.meaning || '').toLowerCase();
            var esoteric = (mantra.esotericMeaning || '').toLowerCase();
            var wordMatch = false;
            if (mantra.words) {
              mantra.words.forEach(function (w) {
                if ((w.transliteration || '').toLowerCase().includes(query) || (w.meaning || '').toLowerCase().includes(query)) wordMatch = true;
              });
            }

            if (trans.includes(query) || devanagari.includes(query) || translation.includes(query) || esoteric.includes(query) || wordMatch || sectionMatch) {
              matches.push({
                sectionTitle: section.title,
                sectionId: section.id,
                part: section.part,
                devanagari: mantra.devanagari || '',
                transliteration: mantra.transliteration || mantra.text || '',
                translation: mantra.translation || mantra.meaning || '',
                esotericMeaning: mantra.esotericMeaning || ''
              });
            }
          });
        });

        count.textContent = matches.length + ' found';

        if (matches.length === 0) {
          results.innerHTML = '<p class="search-empty">No mantras found matching "' + escapeHtml(query) + '"</p>';
          return;
        }

        var html = '';
        matches.slice(0, 50).forEach(function (match) {
          html += '<div class="search-result" onclick="navigateToSection(' + match.sectionId + ')">';
          html += '<div class="search-result-section">' + highlightText(match.sectionTitle, query);
          html += ' <span class="search-result-part">(' + escapeHtml(match.part) + ')</span></div>';
          if (match.devanagari) {
            html += '<div class="search-result-devanagari">' + highlightText(match.devanagari.substring(0, 100), query) + (match.devanagari.length > 100 ? '…' : '') + '</div>';
          }
          html += '<div class="search-result-text">' + highlightText(match.transliteration.substring(0, 150), query) + (match.transliteration.length > 150 ? '…' : '') + '</div>';
          if (match.translation) {
            html += '<div class="search-result-meaning">' + highlightText(match.translation.substring(0, 120), query) + (match.translation.length > 120 ? '…' : '') + '</div>';
          }
          if (match.esotericMeaning) {
            html += '<div class="search-result-esoteric">' + highlightText(match.esotericMeaning.substring(0, 100), query) + '…</div>';
          }
          html += '</div>';
        });
        if (matches.length > 50) {
          html += '<p class="search-empty">Showing first 50 of ' + matches.length + ' results. Refine your search.</p>';
        }
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
        document.querySelectorAll('.view').forEach(function (v) { v.classList.remove('active'); });
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
      var bar = document.getElementById('progressBar');
      if (bar) bar.style.width = progress + '%';
      if (scrollBtns) scrollBtns.classList.toggle('visible', scrollTop > 300);
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
      var cards = document.querySelectorAll('.view.active .section-card');
      if (!cards.length) return;
      var expandedCards = document.querySelectorAll('.view.active .section-card.expanded');
      var lastExpanded = expandedCards.length ? expandedCards[expandedCards.length - 1] : null;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        var next = lastExpanded ? lastExpanded.nextElementSibling : cards[0];
        while (next && !next.classList.contains('section-card')) next = next.nextElementSibling;
        if (next) { next.classList.add('expanded'); next.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (lastExpanded) {
          var prev = lastExpanded.previousElementSibling;
          while (prev && !prev.classList.contains('section-card')) prev = prev.previousElementSibling;
          if (prev) { prev.classList.add('expanded'); prev.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
        }
      } else if (e.key === 'Escape') {
        if (lastExpanded) lastExpanded.classList.remove('expanded');
      }
    });
  }

  // --- Initialize ---
  function init() {
    renderIntro();
    renderSections();
    renderSectionsGrid();
    setupSearch();
    setupNavigation();
    setupProgressBar();
    setupKeyboardNav();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
