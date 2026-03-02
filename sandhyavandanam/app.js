// Sandhyavandanam Q&A — Slide Deck Application
// ===============================================

(function () {
  'use strict';

  var currentSlideIndex = 0;
  var filteredSlides = SANDHYAVANDANAM_DATA.slides.slice();
  var activeCategory = 'all';
  var touchStartX = 0;
  var touchEndX = 0;

  // --- Utility: Escape HTML ---
  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // --- Get category label ---
  function getCategoryLabel(categoryId) {
    for (var i = 0; i < SANDHYAVANDANAM_DATA.categories.length; i++) {
      if (SANDHYAVANDANAM_DATA.categories[i].id === categoryId) {
        return SANDHYAVANDANAM_DATA.categories[i].label;
      }
    }
    return categoryId;
  }

  // --- Render Introduction ---
  function renderIntro() {
    document.getElementById('intro-content').textContent = SANDHYAVANDANAM_DATA.intro;
  }

  // --- Render Category Filters ---
  function renderCategoryFilters() {
    var containers = [
      document.getElementById('category-filter'),
      document.getElementById('browse-category-filter')
    ];

    containers.forEach(function (container) {
      var html = '<span class="category-tag active" data-category="all">All (50)</span>';
      SANDHYAVANDANAM_DATA.categories.forEach(function (cat) {
        var count = 0;
        SANDHYAVANDANAM_DATA.slides.forEach(function (s) {
          if (s.category === cat.id) count++;
        });
        html += '<span class="category-tag" data-category="' + cat.id + '">' + escapeHtml(cat.label) + ' (' + count + ')</span>';
      });
      container.innerHTML = html;

      // Bind clicks
      container.querySelectorAll('.category-tag').forEach(function (tag) {
        tag.addEventListener('click', function () {
          var cat = tag.getAttribute('data-category');
          filterByCategory(cat);
        });
      });
    });
  }

  // --- Filter slides by category ---
  function filterByCategory(category) {
    activeCategory = category;

    if (category === 'all') {
      filteredSlides = SANDHYAVANDANAM_DATA.slides.slice();
    } else {
      filteredSlides = SANDHYAVANDANAM_DATA.slides.filter(function (s) {
        return s.category === category;
      });
    }

    // Update active tags across both views
    document.querySelectorAll('.category-tag').forEach(function (tag) {
      tag.classList.remove('active');
      if (tag.getAttribute('data-category') === category) {
        tag.classList.add('active');
      }
    });

    currentSlideIndex = 0;
    renderSlides();
    renderBrowseCards();
    showSlide(0);
  }

  // --- Render Slides ---
  function renderSlides() {
    var container = document.getElementById('slide-container');
    var html = '';

    filteredSlides.forEach(function (slide, index) {
      html += '<div class="slide' + (index === 0 ? ' active' : '') + '" data-index="' + index + '">';
      html += '<div class="slide-card">';

      // Header
      html += '<div class="slide-card-header">';
      html += '<span class="slide-number">Q' + slide.id + '</span>';
      html += '<div class="slide-category-label">' + escapeHtml(getCategoryLabel(slide.category)) + '</div>';
      html += '<div class="slide-question">' + escapeHtml(slide.question) + '</div>';
      html += '</div>';

      // Body
      html += '<div class="slide-card-body">';
      html += '<div class="slide-answer">' + escapeHtml(slide.answer) + '</div>';

      if (slide.insight) {
        html += '<div class="slide-insight">';
        html += '<div class="slide-insight-label">Scientific Perspective</div>';
        html += '<div class="slide-insight-text">' + escapeHtml(slide.insight) + '</div>';
        html += '</div>';
      }

      if (slide.sanskrit) {
        html += '<div class="slide-sanskrit">' + escapeHtml(slide.sanskrit) + '</div>';
      }

      html += '</div>';
      html += '</div>';
      html += '</div>';
    });

    container.innerHTML = html;
    updateSlideCounter();
  }

  // --- Show specific slide ---
  function showSlide(index) {
    if (index < 0 || index >= filteredSlides.length) return;

    currentSlideIndex = index;
    var slides = document.querySelectorAll('#slide-container .slide');
    slides.forEach(function (s) { s.classList.remove('active'); });

    if (slides[index]) {
      slides[index].classList.add('active');
    }

    updateSlideCounter();
    updateNavButtons();

    // Update progress bar
    var progress = filteredSlides.length > 1 ? (index / (filteredSlides.length - 1)) * 100 : 100;
    document.getElementById('progressBar').style.width = progress + '%';
  }

  // --- Update slide counter text ---
  function updateSlideCounter() {
    var counter = document.getElementById('slide-counter');
    counter.textContent = (currentSlideIndex + 1) + ' / ' + filteredSlides.length;
  }

  // --- Update navigation button states ---
  function updateNavButtons() {
    document.getElementById('prev-btn').disabled = currentSlideIndex <= 0;
    document.getElementById('next-btn').disabled = currentSlideIndex >= filteredSlides.length - 1;
  }

  // --- Slide Navigation ---
  function nextSlide() {
    if (currentSlideIndex < filteredSlides.length - 1) {
      showSlide(currentSlideIndex + 1);
    }
  }

  function prevSlide() {
    if (currentSlideIndex > 0) {
      showSlide(currentSlideIndex - 1);
    }
  }

  // --- Navigate to slide by question ID ---
  window.navigateToSlide = function (questionId) {
    // Switch to slide view
    document.querySelectorAll('.nav-btn').forEach(function (b) { b.classList.remove('active'); });
    document.querySelector('[data-view="slides"]').classList.add('active');
    document.querySelectorAll('.view').forEach(function (v) { v.classList.remove('active'); });
    document.getElementById('slides-view').classList.add('active');

    // Find slide index in filtered slides
    for (var i = 0; i < filteredSlides.length; i++) {
      if (filteredSlides[i].id === questionId) {
        showSlide(i);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
    }

    // If not in filtered set, reset to all and find
    filterByCategory('all');
    for (var j = 0; j < filteredSlides.length; j++) {
      if (filteredSlides[j].id === questionId) {
        showSlide(j);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
    }
  };

  // --- Render Browse Cards ---
  function renderBrowseCards() {
    var container = document.getElementById('browse-container');
    var html = '';

    filteredSlides.forEach(function (slide) {
      html += '<div class="browse-card" id="browse-' + slide.id + '">';

      // Header
      html += '<div class="browse-card-header" onclick="toggleBrowseCard(' + slide.id + ')">';
      html += '<span class="browse-card-number">' + slide.id + '</span>';
      html += '<span class="browse-card-question">' + escapeHtml(slide.question) + '</span>';
      html += '<span class="browse-card-toggle">&#9660;</span>';
      html += '</div>';

      // Body
      html += '<div class="browse-card-body">';
      html += '<div class="browse-answer">' + escapeHtml(slide.answer) + '</div>';

      if (slide.insight) {
        html += '<div class="browse-insight">';
        html += '<div class="browse-insight-label">Scientific Perspective</div>';
        html += '<div class="browse-insight-text">' + escapeHtml(slide.insight) + '</div>';
        html += '</div>';
      }

      if (slide.sanskrit) {
        html += '<div class="browse-sanskrit">' + escapeHtml(slide.sanskrit) + '</div>';
      }

      html += '</div>';
      html += '</div>';
    });

    container.innerHTML = html;
  }

  // --- Toggle browse card expansion ---
  window.toggleBrowseCard = function (id) {
    var el = document.getElementById('browse-' + id);
    if (el) el.classList.toggle('expanded');
  };

  // --- Search ---
  function setupSearch() {
    var input = document.getElementById('search-input');
    var results = document.getElementById('search-results');
    var count = document.getElementById('search-count');

    input.addEventListener('input', function () {
      var query = input.value.trim().toLowerCase();
      if (query.length < 2) {
        results.innerHTML = '<p class="search-placeholder">Type at least 2 characters to search...</p>';
        count.textContent = '';
        return;
      }

      var matches = [];
      SANDHYAVANDANAM_DATA.slides.forEach(function (slide) {
        var qMatch = slide.question.toLowerCase().includes(query);
        var aMatch = slide.answer.toLowerCase().includes(query);
        var iMatch = slide.insight && slide.insight.toLowerCase().includes(query);
        var sMatch = slide.sanskrit && slide.sanskrit.toLowerCase().includes(query);

        if (qMatch || aMatch || iMatch || sMatch) {
          matches.push(slide);
        }
      });

      count.textContent = matches.length + ' found';

      if (matches.length === 0) {
        results.innerHTML = '<p class="search-placeholder">No results found for "' + escapeHtml(query) + '"</p>';
        return;
      }

      var html = '';
      matches.forEach(function (slide) {
        html += '<div class="search-result" onclick="navigateToSlide(' + slide.id + ')">';
        html += '<div class="search-result-number">Q' + slide.id + '</div>';
        html += '<div class="search-result-question">' + escapeHtml(slide.question) + '</div>';
        html += '<div class="search-result-preview">' + escapeHtml(slide.answer.substring(0, 150)) + (slide.answer.length > 150 ? '...' : '') + '</div>';
        html += '<span class="search-result-category">' + escapeHtml(getCategoryLabel(slide.category)) + '</span>';
        html += '</div>';
      });
      results.innerHTML = html;
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

  // --- Keyboard Navigation ---
  function setupKeyboard() {
    document.addEventListener('keydown', function (e) {
      // Only handle in slide view
      if (!document.getElementById('slides-view').classList.contains('active')) return;
      // Don't intercept if typing in search
      if (e.target.tagName === 'INPUT') return;

      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        nextSlide();
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        prevSlide();
      }
    });
  }

  // --- Touch/Swipe Navigation ---
  function setupTouch() {
    var container = document.getElementById('slide-container');

    container.addEventListener('touchstart', function (e) {
      touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    container.addEventListener('touchend', function (e) {
      touchEndX = e.changedTouches[0].screenX;
      var diff = touchStartX - touchEndX;

      if (Math.abs(diff) > 50) {
        if (diff > 0) {
          nextSlide();
        } else {
          prevSlide();
        }
      }
    }, { passive: true });
  }

  // --- Expand/Collapse All (Browse View) ---
  function setupExpandCollapse() {
    document.getElementById('expand-all').addEventListener('click', function () {
      document.querySelectorAll('.browse-card').forEach(function (c) {
        c.classList.add('expanded');
      });
    });
    document.getElementById('collapse-all').addEventListener('click', function () {
      document.querySelectorAll('.browse-card').forEach(function (c) {
        c.classList.remove('expanded');
      });
    });
  }

  // --- Initialize ---
  function init() {
    renderIntro();
    renderCategoryFilters();
    renderSlides();
    renderBrowseCards();
    setupSearch();
    setupNavigation();
    setupKeyboard();
    setupTouch();
    setupExpandCollapse();

    // Nav button event listeners
    document.getElementById('prev-btn').addEventListener('click', prevSlide);
    document.getElementById('next-btn').addEventListener('click', nextSlide);

    showSlide(0);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
