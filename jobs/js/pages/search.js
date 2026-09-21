/**
 * JobSignal search results.
 *
 * The working surface: compact header carrying the query, a filter bar, the
 * result count, the results. No second hero, no repeated marketing copy.
 * URL is the source of truth, so every result set is shareable and the back
 * button behaves.
 */
(function () {
  'use strict';
  var el = window.JSDom.el, icon = window.JSIcon, F = window.JSFormat;

  var PAGE = 25;
  var state = window.JSQuery.read();
  var allJobs = [], current = [], shown = 0, suggest = null, generatedAt = '';

  var resultsHost = document.getElementById('jsResults');
  var toolbarHost = document.getElementById('jsToolbar');
  var barHost = document.getElementById('jsBar');
  var moreHost = document.getElementById('jsMore');

  /* ── header with the query in it ── */
  var searchBar = window.JSSearchBar.build({
    id: 'jsTopQ', compact: true, q: state.q || '', location: state.location || '',
    onSubmit: function (q, loc) {
      state.q = q.trim();
      state.location = loc.trim();
      update();
    }
  });
  window.JSHeader.mount({ searchNode: searchBar });
  document.getElementById('jsFooter').appendChild(window.JSHeader.footer());

  /* ── sort ── */
  var SORTS = [['', 'Best match'], ['newest', 'Newest'], ['verified', 'Recently verified'], ['salary', 'Highest salary']];

  function toolbar(intent, count) {
    var heading = intent && intent.family
      ? (window.JSSearch.FAMILY_LABEL[intent.family] || intent.family)
      : (state.q ? '“' + state.q + '”' : 'All verified roles');

    var facts = [];
    facts.push(count.toLocaleString('en-US') + ' verified ' + (count === 1 ? 'job' : 'jobs'));
    if (intent && intent.location) facts.push(intent.location.city || intent.location.country);
    if (intent && intent.remote) facts.push(F.remote(intent.remote));
    if (intent && intent.level) facts.push(F.level(intent.level));
    if (generatedAt) facts.push('updated ' + F.since(generatedAt));

    var sel = el('select', { 'aria-label': 'Sort results' });
    SORTS.forEach(function (s) {
      var o = el('option', { value: s[0], text: s[1] });
      if ((state.sort || '') === s[0]) o.selected = true;
      sel.appendChild(o);
    });
    sel.addEventListener('change', function () { state.sort = sel.value; update(); });

    var node = el('div', { class: 'jsToolbar' }, [
      el('div', {}, [
        el('h1', { text: heading }),
        el('p', {}, [
          el('strong', { text: facts[0] }),
          el('span', { text: facts.length > 1 ? ' · ' + facts.slice(1).join(' · ') : '' })
        ])
      ]),
      el('label', { class: 'jsSelect', style: 'gap:8px' }, [
        el('span', { style: 'color:var(--ink-3)', text: 'Sort' }), sel
      ])
    ]);
    if (intent && intent.corrected) {
      node.appendChild(el('p', {
        style: 'flex-basis:100%;margin:8px 0 0;font-size:13.5px;color:var(--ink-3)',
        text: 'Showing results for “' + intent.corrected + '”'
      }));
    }
    return node;
  }

  /* ── filter bar ── */
  function options() {
    var c = {}, i = {};
    allJobs.forEach(function (j) {
      if (j.company_slug) c[j.company_slug] = j.company_name;
      if (j.industry) i[j.industry] = j.industry;
    });
    return {
      companies: Object.keys(c).sort(function (a, b) { return c[a].localeCompare(c[b]); }).map(function (k) { return [k, c[k]]; }),
      industries: Object.keys(i).sort().map(function (k) { return [k, k]; })
    };
  }

  function renderBar() {
    window.JSDom.mount(barHost, window.JSFilters.bar(state, update, function () {
      window.JSFilters.drawer(state, options(), update);
    }));
  }

  function renderBottom() {
    var host = document.getElementById('jsBottom');
    window.JSDom.clear(host);
    var s = el('button', { class: 'jsBtn jsBtn--ghost', type: 'button' }, [icon('search', 15), el('span', { text: 'Search' })]);
    s.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setTimeout(function () { searchBar.qInput.focus(); }, 260);
    });
    var n = window.JSFilters.countActive(state);
    var f = el('button', { class: 'jsBtn jsBtn--ghost', type: 'button' }, [
      icon('sliders', 15), el('span', { text: 'Filters' }),
      n ? el('span', { class: 'jsSelect-count', text: String(n) }) : null
    ]);
    f.addEventListener('click', function () { window.JSFilters.drawer(state, options(), update); });
    host.appendChild(s); host.appendChild(f);
  }

  /* ── results ── */
  function page(reset) {
    if (reset) { window.JSDom.clear(resultsHost); shown = 0; }
    var slice = current.slice(shown, shown + PAGE);
    var matched = (current._intent && current._intent.skills) || [];
    slice.forEach(function (job) {
      resultsHost.appendChild(window.JSCard.build(job, {
        matchedSkills: matched,
        onVerify: window.JSPopover.open
      }));
    });
    shown += slice.length;

    window.JSDom.clear(moreHost);
    if (shown < current.length) {
      var btn = el('button', { class: 'jsBtn jsBtn--ghost', type: 'button',
        text: 'Show ' + Math.min(PAGE, current.length - shown) + ' more' });
      btn.addEventListener('click', function () { page(false); });
      moreHost.appendChild(btn);
    } else if (current._truncated) {
      moreHost.appendChild(el('p', { style: 'font-size:13px;color:var(--ink-3)',
        text: 'Showing the strongest 200 matches. Narrow the search to see the rest.' }));
    }
  }

  /** Count what each broadening would actually add, before offering it. */
  function broadenings(intent) {
    var out = [];
    function count(extra) {
      var f = {}; Object.keys(state).forEach(function (k) { f[k] = state[k]; });
      Object.keys(extra).forEach(function (k) { f[k] = extra[k]; });
      return window.JSSearch.run(allJobs, f).length;
    }
    if (intent.location) {
      out.push({ label: 'Include remote roles', count: count({ includeRemote: true }),
        apply: function () { state.includeRemote = true; update(); } });
      out.push({ label: 'Search everywhere', count: count({ location: '', q: stripPlace(state.q) }),
        apply: function () { state.q = stripPlace(state.q); state.location = ''; update(); } });
    }
    if (intent.level) {
      out.push({ label: 'Any experience level', count: count({ q: stripLevel(state.q) }),
        apply: function () { state.q = stripLevel(state.q); update(); } });
    }
    if (state.minSalary) {
      out.push({ label: 'Drop the salary filter', count: count({ minSalary: 0 }),
        apply: function () { delete state.minSalary; update(); } });
    }
    if (window.JSFilters.countActive(state)) {
      out.push({ label: 'Clear all filters', count: count({ level: '', remote: '', family: '', company: '', minSalary: 0, employment: '', postedDays: '' }),
        apply: function () {
          Object.keys(state).forEach(function (k) { if (k !== 'q' && k !== 'sort') delete state[k]; });
          update();
        } });
    }
    return out;
  }

  function stripPlace(q) {
    return String(q || '').replace(/\b(pittsburgh|seattle|austin|boston|chicago|denver|sunnyvale|london|dublin|berlin|bengaluru|bangalore|nyc|new york city|new york|san francisco( bay area)?|bay area|los angeles|united states)\b/gi, '').replace(/\s+/g, ' ').trim();
  }
  function stripLevel(q) {
    return String(q || '').replace(/\b(intern(ship)?|entry[- ]level|new grad(uate)?|junior|jr\.?|senior|sr\.?|staff|principal|lead|manager|director|vp|head of|chief|mid[- ]level)\b/gi, '').replace(/\s+/g, ' ').trim();
  }

  function update(skipUrl) {
    if (!allJobs.length) return;
    var filters = {};
    Object.keys(state).forEach(function (k) { if (state[k] !== '' && state[k] != null) filters[k] = state[k]; });
    // The location box is parsed by the same query parser as the search box,
    // so a typed place and a spoken one behave identically.
    if (state.location) filters.q = ((state.q || '') + ' ' + state.location).trim();

    current = window.JSSearch.run(allJobs, filters);
    var intent = current._intent || {};

    window.JSDom.mount(toolbarHost, toolbar(intent, current.length));
    renderBar();
    renderBottom();

    if (intent.ambiguous && current._families) {
      window.JSDom.mount(resultsHost, window.JSStates.ambiguous(intent.ambiguous, current._families, function (fam) {
        state.family = fam; update();
      }));
      window.JSDom.clear(moreHost);
    } else if (!current.length) {
      window.JSDom.mount(resultsHost, window.JSStates.noResults(intent, broadenings(intent)));
      window.JSDom.clear(moreHost);
    } else {
      page(true);
    }
    if (skipUrl !== true) window.JSQuery.push(state);
  }

  window.addEventListener('popstate', function () {
    state = window.JSQuery.read();
    searchBar.qInput.value = state.q || '';
    searchBar.locInput.value = state.location || '';
    update(true);
  });

  /* ── boot ── */
  window.JSDom.mount(resultsHost, window.JSStates.skeletonList(4));
  window.JSData.index().then(function (doc) {
    allJobs = doc.jobs || [];
    generatedAt = doc.generated_at || '';
    if (!allJobs.length) {
      window.JSDom.mount(resultsHost, window.JSStates.boardEmpty());
      window.JSDom.clear(toolbarHost);
      return;
    }
    suggest = window.JSSearchBar.suggester(allJobs);
    var fresh = window.JSSearchBar.build({
      id: 'jsTopQ', compact: true, q: state.q || '', location: state.location || '',
      suggest: suggest,
      onSubmit: function (q, loc) { state.q = q.trim(); state.location = loc.trim(); update(); }
    });
    searchBar.parentNode.replaceChild(fresh, searchBar);
    searchBar = fresh;
    update(true);
  }).catch(function () {
    window.JSDom.mount(resultsHost, window.JSStates.failed());
    window.JSDom.clear(toolbarHost);
  });
})();
