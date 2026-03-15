// Mahanyasam - The Great Consecration Application
// ================================================

(function () {
  'use strict';

  var searchTimer = null;

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

  // --- Render Introduction ---
  function renderIntro() {
    var container = document.getElementById('intro-content');
    container.textContent = MAHANYASAM_DATA.intro;
  }

  // --- Render All Sections (Reading View) ---
  function renderSections() {
    var container = document.getElementById('sections-container');

    // Add expand/collapse controls
    var controlsHtml = '<div class="expand-controls">';
    controlsHtml += '<button class="expand-btn" id="expand-all">Expand All</button>';
    controlsHtml += '<button class="expand-btn" id="collapse-all">Collapse All</button>';
    controlsHtml += '</div>';

    var sectionsHtml = '';

    MAHANYASAM_DATA.sections.forEach(function (section) {
      var sectionId = section.id;

      // Build mantras HTML
      var mantrasHtml = '';

      // Section description
      if (section.description) {
        mantrasHtml += '<div class="section-description">' + escapeHtml(section.description) + '</div>';
      }

      section.mantras.forEach(function (mantra) {
        mantrasHtml += '<div class="mantra-block">';

        if (mantra.instruction) {
          mantrasHtml += '<div class="mantra-instruction">' + escapeHtml(mantra.instruction) + '</div>';
        }

        mantrasHtml += '<div class="mantra-text">' + escapeHtml(mantra.text) + '</div>';

        if (mantra.meaning) {
          mantrasHtml += '<div class="mantra-meaning">' + escapeHtml(mantra.meaning) + '</div>';
        }

        mantrasHtml += '</div>';
      });

      // Section card
      sectionsHtml += '<div class="section-card" id="section-' + sectionId + '">';
      sectionsHtml += '<div class="section-card-header" onclick="toggleSection(' + sectionId + ')">';
      sectionsHtml += '<span class="section-number">' + sectionId + '</span>';
      sectionsHtml += '<div class="section-title-area">';
      sectionsHtml += '<div class="section-card-title">' + escapeHtml(section.title) + '</div>';
      if (section.titleSanskrit) {
        sectionsHtml += '<div class="section-card-sanskrit">' + escapeHtml(section.titleSanskrit) + '</div>';
      }
      if (section.subtitle) {
        sectionsHtml += '<div class="section-card-subtitle">' + escapeHtml(section.subtitle) + '</div>';
      }
      sectionsHtml += '</div>';
      sectionsHtml += '<span class="section-toggle">&#9660;</span>';
      sectionsHtml += '</div>';
      sectionsHtml += '<div class="section-body">';
      sectionsHtml += mantrasHtml;
      sectionsHtml += '</div>';
      sectionsHtml += '</div>';
    });

    container.innerHTML = controlsHtml + sectionsHtml;

    // Expand first 2 sections by default
    for (var i = 1; i <= 2; i++) {
      var el = document.getElementById('section-' + i);
      if (el) el.classList.add('expanded');
    }

    // Expand/Collapse all
    document.getElementById('expand-all').addEventListener('click', function () {
      document.querySelectorAll('.section-card').forEach(function (c) {
        c.classList.add('expanded');
      });
    });
    document.getElementById('collapse-all').addEventListener('click', function () {
      document.querySelectorAll('.section-card').forEach(function (c) {
        c.classList.remove('expanded');
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
    var html = '';

    MAHANYASAM_DATA.sections.forEach(function (section) {
      html += '<div class="section-grid-item" onclick="navigateToSection(' + section.id + ')">';
      html += '<span class="section-grid-number">' + section.id + '</span>';
      html += '<div class="section-grid-details">';
      html += '<div class="section-grid-title">' + escapeHtml(section.title) + '</div>';
      if (section.titleSanskrit) {
        html += '<div class="section-grid-sanskrit">' + escapeHtml(section.titleSanskrit) + '</div>';
      }
      if (section.subtitle) {
        html += '<div class="section-grid-subtitle">' + escapeHtml(section.subtitle) + '</div>';
      }
      html += '</div>';
      html += '</div>';
    });

    container.innerHTML = html;
  }

  // --- Navigate to section in reading view ---
  window.navigateToSection = function (id) {
    // Switch to reading view
    document.querySelectorAll('.nav-btn').forEach(function (b) { b.classList.remove('active'); });
    document.querySelector('[data-view="reading"]').classList.add('active');
    document.querySelectorAll('.view').forEach(function (v) { v.classList.remove('active'); });
    document.getElementById('reading-view').classList.add('active');

    // Expand the section
    var el = document.getElementById('section-' + id);
    if (el) {
      el.classList.add('expanded');
      setTimeout(function () {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
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
          results.innerHTML = '<p style="text-align:center;color:var(--color-text-muted);padding:2rem;">Type at least 2 characters to search...</p>';
          count.textContent = '';
          return;
        }

        var matches = [];

        MAHANYASAM_DATA.sections.forEach(function (section) {
          // Check section title and subtitle
          var sectionMatch = section.title.toLowerCase().includes(query) ||
            (section.subtitle || '').toLowerCase().includes(query) ||
            (section.titleSanskrit || '').includes(query);

          section.mantras.forEach(function (mantra) {
            var textMatch = mantra.text.toLowerCase().includes(query);
            var meaningMatch = (mantra.meaning || '').toLowerCase().includes(query);
            var instructionMatch = (mantra.instruction || '').toLowerCase().includes(query);

            if (textMatch || meaningMatch || instructionMatch || sectionMatch) {
              matches.push({
                sectionTitle: section.title,
                sectionId: section.id,
                text: mantra.text,
                meaning: mantra.meaning || '',
                instruction: mantra.instruction || ''
              });
            }
          });
        });

        count.textContent = matches.length + ' found';

        if (matches.length === 0) {
          results.innerHTML = '<p style="text-align:center;color:var(--color-text-muted);padding:2rem;">No mantras found matching "' + escapeHtml(query) + '"</p>';
          return;
        }

        var html = '';
        matches.forEach(function (match) {
          html += '<div class="search-result" onclick="navigateToSection(' + match.sectionId + ')">';
          html += '<div class="search-result-section">' + highlightText(match.sectionTitle, query) + '</div>';
          html += '<div class="search-result-text">' + highlightText(match.text.substring(0, 200), query) + (match.text.length > 200 ? '...' : '') + '</div>';
          if (match.meaning) {
            html += '<div class="search-result-meaning">' + highlightText(match.meaning, query) + '</div>';
          }
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

  // --- Reading Progress ---
  function setupProgressBar() {
    var scrollButtons = document.getElementById('scrollButtons');
    var scrollTopBtn = document.getElementById('scrollTopBtn');
    var scrollBottomBtn = document.getElementById('scrollBottomBtn');

    scrollTopBtn.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    scrollBottomBtn.addEventListener('click', function () {
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
    });

    window.addEventListener('scroll', function () {
      var scrollTop = window.scrollY;
      var docHeight = document.documentElement.scrollHeight - window.innerHeight;
      var progress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
      document.getElementById('progressBar').style.width = progress + '%';

      if (scrollTop > 300) {
        scrollButtons.classList.add('visible');
      } else {
        scrollButtons.classList.remove('visible');
      }
    });
  }

  // --- Keyboard Navigation ---
  function setupKeyboardNav() {
    document.addEventListener('keydown', function (e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      var cards = document.querySelectorAll('.view.active .section-card');
      if (cards.length === 0) return;
      var expandedCards = document.querySelectorAll('.view.active .section-card.expanded');
      var lastExpanded = expandedCards.length > 0 ? expandedCards[expandedCards.length - 1] : null;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        if (lastExpanded) {
          var next = lastExpanded.nextElementSibling;
          while (next && !next.classList.contains('section-card')) next = next.nextElementSibling;
          if (next) { next.classList.add('expanded'); next.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
        } else if (cards[0]) { cards[0].classList.add('expanded'); cards[0].scrollIntoView({ behavior: 'smooth', block: 'center' }); }
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
