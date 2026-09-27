/**
 * PaddySpeaks — the archive on /articles/ (docs/HOMEPAGE-MAP-REDESIGN.md).
 *
 * Moved from the homepage when the homepage became a map. The deck cards are
 * plain links and all of them are in the HTML, so without JavaScript the page
 * is the complete list; this script only filters by subject and pages it.
 *
 * A subject can be linked to: /articles/#technology, #philosophy, #ai,
 * #personality (older pages link index.html#technology, which the homepage
 * forwards here). Choosing a filter updates the hash with replaceState, so
 * the address can be shared without adding history entries.
 */
(function () {
  'use strict';
  var INITIAL_SHOW = 15;   // a dated list: 15 rows is about one screen
  var FILTERS = ['all', 'philosophy', 'technology', 'ai', 'personality'];
  var cards = document.querySelectorAll('.deck-card');
  var filterBtns = document.querySelectorAll('.deck-filter-btn');
  var loadMoreBtn = document.querySelector('.deck-load-more-btn');
  var archive = document.getElementById('archive');
  var currentFilter = 'all';
  var showCount = INITIAL_SHOW;
  if (!cards.length) return;

  function setFilter(filter, fromHash) {
    currentFilter = filter;
    showCount = INITIAL_SHOW;
    filterBtns.forEach(function (b) {
      var on = b.getAttribute('data-filter') === filter;
      b.classList.toggle('active', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    if (!fromHash && window.history && history.replaceState) {
      history.replaceState(null, '', filter === 'all' ? location.pathname : '#' + filter);
    }
    update();
  }

  function update() {
    var totalMatched = 0;
    cards.forEach(function (card) {
      var matches = currentFilter === 'all' || card.getAttribute('data-category') === currentFilter;
      if (matches) totalMatched++;
      var show = matches && totalMatched <= showCount;
      card.style.display = show ? '' : 'none';
      if (show) card.removeAttribute('data-hidden'); else card.setAttribute('data-hidden', 'true');
    });
    if (loadMoreBtn) {
      if (totalMatched > showCount) {
        loadMoreBtn.style.display = '';
        loadMoreBtn.textContent = 'Show ' + Math.min(30, totalMatched - showCount) + ' more · ' + (totalMatched - showCount) + ' remaining';
      } else {
        loadMoreBtn.style.display = 'none';
      }
    }
  }

  filterBtns.forEach(function (btn) {
    btn.addEventListener('click', function () { setFilter(btn.getAttribute('data-filter')); });
  });
  if (loadMoreBtn) {
    loadMoreBtn.addEventListener('click', function () { showCount += 30; update(); });
  }

  function fromHash() {
    var h = location.hash.replace('#', '');
    if (FILTERS.indexOf(h) > 0) {
      setFilter(h, true);
      if (archive) setTimeout(function () { archive.scrollIntoView(); }, 0);
      return true;
    }
    return false;
  }
  window.addEventListener('hashchange', fromHash);
  if (!fromHash()) update();
})();
