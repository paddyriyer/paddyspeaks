/**
 * JobSignal search page.
 *
 * Reads filter state from the URL, runs the local search over the committed
 * index, renders cards, and writes the state back so every result set is
 * shareable. Results are paged in the DOM rather than truncated, so a filter
 * that matches thousands of roles does not build thousands of nodes at once.
 */
(function () {
  'use strict';

  var el = window.JSDom.el;
  var PAGE = 25;

  var form = document.getElementById('js-filters');
  var resultsHost = document.getElementById('js-results');
  var countHost = document.getElementById('js-count');
  var moreHost = document.getElementById('js-more');
  var sortSelect = document.getElementById('f-sort');

  var allJobs = [];
  var current = [];
  var shown = 0;

  function controls() {
    return Array.prototype.slice.call(document.querySelectorAll('[data-filter]'));
  }

  /** URL -> form controls. */
  function applyToForm(filters) {
    controls().forEach(function (input) {
      var key = input.getAttribute('data-filter');
      var value = filters[key];
      if (input.type === 'checkbox') input.checked = !!value;
      else input.value = value === undefined || value === null ? '' : String(value);
    });
  }

  /** Form controls -> filter object. */
  function readForm() {
    var f = {};
    controls().forEach(function (input) {
      var key = input.getAttribute('data-filter');
      if (input.type === 'checkbox') {
        if (input.checked) f[key] = true;
      } else if (input.value !== '') {
        f[key] = window.JSQuery.NUMBERS.indexOf(key) !== -1
          ? parseInt(input.value, 10)
          : input.value;
      }
    });
    return f;
  }

  /** Employer and industry options come from the data, not a hand-kept list. */
  function populateOptions(jobs) {
    var companies = {}, industries = {};
    jobs.forEach(function (j) {
      if (j.company_slug) companies[j.company_slug] = j.company_name;
      if (j.industry) industries[j.industry] = j.industry;
    });
    function fill(id, map, sortByLabel) {
      var select = document.getElementById(id);
      if (!select) return;
      var keys = Object.keys(map).sort(function (a, b) {
        return sortByLabel ? map[a].localeCompare(map[b]) : a.localeCompare(b);
      });
      keys.forEach(function (k) {
        select.appendChild(el('option', { value: k, text: map[k] }));
      });
    }
    fill('f-company', companies, true);
    fill('f-industry', industries, false);
  }

  function renderPage(reset) {
    if (reset) {
      window.JSDom.clear(resultsHost);
      shown = 0;
    }
    var slice = current.slice(shown, shown + PAGE);
    slice.forEach(function (job) { resultsHost.appendChild(window.JSCard.build(job)); });
    shown += slice.length;

    window.JSDom.clear(moreHost);
    if (shown < current.length) {
      moreHost.appendChild(el('button', {
        class: 'js-btn js-btn-ghost',
        type: 'button',
        text: 'Show ' + Math.min(PAGE, current.length - shown) + ' more',
        onclick: function () { renderPage(false); },
      }));
    }
  }

  function emptyState(filters) {
    var hasFilters = Object.keys(filters).length > 0;
    return el('div', { class: 'js-empty' }, [
      el('h2', { text: allJobs.length ? 'No live roles match that.' : 'The board is still filling.' }),
      el('p', {
        text: allJobs.length
          ? 'Every role here has to be confirmed at the employer before it is shown, so a narrow ' +
            'search can legitimately come back empty. Widening the location or clearing a trust ' +
            'filter is usually enough.'
          : 'No roles have been ingested yet. JobSignal will not show a job it cannot currently ' +
            'reach at the employer, so it shows nothing rather than filling the page with samples.',
      }),
      hasFilters && allJobs.length
        ? el('p', { style: 'margin-top:14px' }, [
            el('button', {
              class: 'js-btn js-btn-ghost', type: 'button', text: 'Clear all filters',
              onclick: reset,
            }),
          ])
        : null,
    ]);
  }

  function describe(filters, total) {
    var bits = [String(total), total === 1 ? 'role' : 'roles'];
    if (filters.q) bits.push('matching “' + filters.q + '”');
    if (filters.location) bits.push('near ' + filters.location);
    return bits.join(' ');
  }

  function update(pushUrl) {
    var filters = readForm();
    current = window.JSSearch.run(allJobs, filters);

    window.JSDom.clear(countHost);
    countHost.appendChild(el('strong', { text: String(current.length) }));
    countHost.appendChild(document.createTextNode(
      ' ' + describe(filters, current.length).replace(/^\d+\s/, '')));

    if (!current.length) {
      window.JSDom.mount(resultsHost, emptyState(filters));
      window.JSDom.clear(moreHost);
    } else {
      renderPage(true);
    }
    if (pushUrl !== false) window.JSQuery.push(filters);
  }

  function reset() {
    controls().forEach(function (input) {
      if (input.type === 'checkbox') input.checked = false;
      else input.value = '';
    });
    update();
  }

  form.addEventListener('change', function () { update(); });

  // Typing re-ranks locally, so it can be immediate — but not on every
  // keystroke, which would rebuild the list mid-word.
  var typingTimer;
  form.addEventListener('input', function (e) {
    if (e.target.type === 'checkbox' || e.target.tagName === 'SELECT') return;
    clearTimeout(typingTimer);
    typingTimer = setTimeout(function () { update(); }, 180);
  });
  form.addEventListener('submit', function (e) { e.preventDefault(); update(); });
  if (sortSelect) sortSelect.addEventListener('change', function () { update(); });
  document.getElementById('js-reset').addEventListener('click', reset);

  window.JSData.index().then(function (doc) {
    allJobs = doc.jobs || [];
    populateOptions(allJobs);
    applyToForm(window.JSQuery.read());
    update(false);
  }).catch(function () {
    window.JSDom.mount(resultsHost, el('div', { class: 'js-empty' }, [
      el('h2', { text: 'The board could not be loaded.' }),
      el('p', { text: 'The job index did not load. Please try again in a moment.' }),
    ]));
    countHost.textContent = '';
  });
})();
