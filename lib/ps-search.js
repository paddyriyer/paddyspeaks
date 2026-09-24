/**
 * PaddySpeaks Search (P1.2 + P0.8): one search across the whole platform.
 *
 *   <script defer src="/lib/ps-search.js"></script>
 *
 * Opens from any [data-ps-search-open] control, the ⌘/Ctrl-K shortcut, or "/"
 * (when not typing). It searches articles, sacred texts, Bhagavad Gita verses,
 * Vishnu and Lalitha Sahasranama names, devotional music, Interview Studio
 * questions, topics, design problems and data models, companies, demos, tools
 * and site pages. Every result says what kind of thing it is.
 *
 * Data: /data/search/core.json on open; verses, names and questions shards on
 * the first keystroke (cached for the tab). Nothing loads until search is used.
 * Live JobSignal roles are not snapshotted: companies come from
 * /jobs/data/companies.json and role searches hand off to JobSignal's own ranker.
 *
 * Accessibility: a modal dialog (role=dialog, aria-modal, labelled), focus is
 * trapped while open and returned to the opener on close, the input is a
 * combobox driving a listbox with aria-activedescendant, type filters are
 * toggle buttons, and the result count is announced in a polite live region.
 *
 * The ranking engine (PSSearch.engine) is pure and tested in lib/tests/search.mjs.
 */
(function (global) {
  'use strict';

  /* ══════════════════════════ ENGINE (pure) ══════════════════════════ */

  var TYPE_LABEL = {
    article: 'Article', sacred: 'Sacred text', verse: 'Verse', name: 'Divine name', music: 'Devotional music',
    topic: 'Interview topic', question: 'Interview question', company: 'Company', demo: 'Demo', tool: 'Tool',
    page: 'Page', journey: 'Start here', job: 'Jobs', concept: 'Concept'
  };
  // Filter groups shown as chips; each maps to one or more document types.
  var GROUPS = [
    { id: 'all', label: 'All', types: null },
    { id: 'read', label: 'Articles', types: ['article'] },
    { id: 'learn', label: 'Sacred texts', types: ['sacred', 'verse', 'name', 'music'] },
    { id: 'prepare', label: 'Interview prep', types: ['topic', 'question'] },
    { id: 'find', label: 'Companies & jobs', types: ['company', 'job'] },
    { id: 'build', label: 'Demos & tools', types: ['demo', 'tool'] },
    { id: 'site', label: 'Concepts & site', types: ['concept', 'page', 'journey'] }
  ];
  var TYPE_WEIGHT = { journey: 1.1, article: 1.15, sacred: 1.25, verse: 1.0, name: 0.85, music: 1.05,
    topic: 1.1, question: 0.9, company: 1.0, demo: 1.1, tool: 1.05, page: 0.75, job: 1.0, concept: 1.3 };
  var STOP = { the: 1, a: 1, an: 1, of: 1, and: 1, to: 1, in: 1, for: 1, on: 1, is: 1, with: 1, how: 1, what: 1, my: 1, i: 1, do: 1 };

  function norm(s) {
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase().replace(/[‘’'`]/g, '').replace(/[^\p{L}\p{N}.#+]+/gu, ' ').trim();
  }

  function terms(q) {
    var t = norm(q).split(/\s+/).filter(Boolean);
    var kept = t.filter(function (w) { return !STOP[w]; });
    return kept.length ? kept : t;
  }

  // Light English stemming so "attachment" finds "attached" and "engineers"
  // finds "engineer". Only long words, only common suffixes: a stem must keep
  // at least five letters, so "meta" or "gita" are never touched.
  var SUFFIX = /(ments|ment|ness|ings|ing|ions|ion|ies|ed|es|s)$/;
  function stem(t) {
    if (t.length < 6 || /\d/.test(t)) return t;
    var s = t.replace(SUFFIX, '');
    return s.length >= 5 ? s : t;
  }

  /** Precompute the normalised fields once per document. */
  function prepare(d) {
    if (d._n) return d;
    d._n = {
      title: norm(d.title),
      sub: norm(d.subtitle),
      tags: norm((d.tags || []).join(' ')),
      text: norm(d.text)
    };
    return d;
  }

  function wordStart(hay, term) {
    if (!hay) return false;
    if (hay.indexOf(term) === 0) return true;
    return hay.indexOf(' ' + term) !== -1;
  }

  function wholeWord(hay, term) {
    return (' ' + hay + ' ').indexOf(' ' + term + ' ') !== -1;
  }

  // "Bhagavad Gita 2.47", "gita 2:47", "bg 2.47", or a bare "2.47".
  var VERSE_REF = /^(?:(?:bhagavad\s*)?gita|bg)?\s*(\d{1,2})[.:](\d{1,3})$/i;

  /**
   * Rank documents for a query. Returns [{doc, score}] best first.
   *   opts.types   restrict to these types (array) or null for all
   */
  function rank(docs, query, opts) {
    opts = opts || {};
    var q = String(query || '').trim();
    if (!q) return [];
    var ts = terms(q);
    var phrase = norm(q);
    var ref = VERSE_REF.exec(q.replace(/\s+/g, ' ').trim());
    var refId = ref ? 'gita:' + (+ref[1]) + '.' + (+ref[2]) : null;
    var allow = opts.types ? {} : null;
    if (allow) opts.types.forEach(function (t) { allow[t] = 1; });
    var need = ts.length <= 2 ? ts.length : ts.length - 1;
    var out = [];
    for (var i = 0; i < docs.length; i++) {
      var d = docs[i];
      if (allow && !allow[d.type]) continue;
      prepare(d);
      var n = d._n, score = 0, matched = 0;
      if (refId && d.id === refId) { out.push({ doc: d, score: 1e6 }); continue; }
      for (var j = 0; j < ts.length; j++) {
        var t = ts[j], st = stem(t), s = 0;
        if (wordStart(n.title, t)) s += wholeWord(n.title, t) ? 16 : 12;
        else if (st !== t && wordStart(n.title, st)) s += 9;
        else if (n.title.indexOf(t) !== -1) s += 6;
        if (wordStart(n.tags, t)) s += 5; else if (wordStart(n.tags, st)) s += 4; else if (t.length > 3 && n.tags.indexOf(t) !== -1) s += 2;
        if (wordStart(n.sub, t)) s += 3;
        if (wordStart(n.text, t)) s += 3; else if (wordStart(n.text, st)) s += 2; else if (t.length > 3 && n.text.indexOf(t) !== -1) s += 1;
        if (s > 0) { matched++; score += s; }
      }
      if (matched < need || score === 0) continue;
      // A company is a result only when the query names it: "Meta data
      // engineer" should surface Meta, not all 107 companies whose blurb
      // mentions data engineering.
      if (d.type === 'company' && !ts.some(function (t) { return wordStart(n.title, t); })) continue;
      if (ts.length > 1 && n.title.indexOf(phrase) !== -1) score += 14;
      else if (ts.length > 1 && (n.text.indexOf(phrase) !== -1 || n.tags.indexOf(phrase) !== -1)) score += 8;
      if (n.title === phrase) score += 20;
      score *= (TYPE_WEIGHT[d.type] || 1) * (matched / ts.length);
      out.push({ doc: d, score: score });
    }
    out.sort(function (a, b) { return b.score - a.score || (a.doc.title < b.doc.title ? -1 : 1); });
    return out;
  }

  /** Count ranked results by filter group (for the chip badges). */
  function groupCounts(ranked) {
    var c = { all: ranked.length };
    GROUPS.forEach(function (g) {
      if (!g.types) return;
      c[g.id] = ranked.filter(function (r) { return g.types.indexOf(r.doc.type) !== -1; }).length;
    });
    return c;
  }

  /** In the "All" view keep the list varied: at most `cap` of any one type. */
  function diversify(ranked, cap, limit) {
    var seen = {}, out = [], rest = [];
    for (var i = 0; i < ranked.length && out.length < limit; i++) {
      var t = ranked[i].doc.type;
      seen[t] = (seen[t] || 0) + 1;
      if (seen[t] <= cap) out.push(ranked[i]); else rest.push(ranked[i]);
    }
    // When the query is really about one kind of thing (every hit is a verse),
    // the cap must not starve the list: backfill in rank order.
    for (var k = 0; out.length < limit && k < rest.length; k++) out.push(rest[k]);
    return out.sort(function (a, b) { return b.score - a.score; });
  }

  function unpack(json) {
    var defs = json.defaults || {};
    return (json.docs || []).map(function (d) {
      for (var k in defs) if (!(k in d)) d[k] = defs[k];
      return d;
    });
  }

  var engine = { norm: norm, terms: terms, stem: stem, rank: rank, groupCounts: groupCounts, diversify: diversify,
    unpack: unpack, GROUPS: GROUPS, TYPE_LABEL: TYPE_LABEL };

  if (typeof document === 'undefined') {           // Node: expose the engine for tests
    if (typeof module !== 'undefined') module.exports = engine;
    global.PSSearchEngine = engine;
    return;
  }

  /* ══════════════════════════ DATA ══════════════════════════ */

  var cache = {};
  function load(name) {
    if (!cache[name]) {
      cache[name] = fetch('/data/search/' + name + '.json', { credentials: 'same-origin' })
        .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
        .then(unpack)
        .catch(function () { cache[name] = null; return []; });
    }
    return cache[name];
  }
  var jobsCompanies = null;
  function loadJobCompanies() {
    if (!jobsCompanies) {
      jobsCompanies = fetch('/jobs/data/companies.json', { credentials: 'same-origin' })
        .then(function (r) { return r.ok ? r.json() : { companies: [] }; })
        .then(function (j) {
          return (j.companies || []).filter(function (c) { return c.live_jobs > 0; }).map(function (c) {
            return { id: 'jobco:' + c.company_slug, type: 'company', title: c.company_name,
              subtitle: 'Hiring on JobSignal · ' + c.live_jobs + ' live roles',
              tags: [c.industry || '', c.company_domain || ''], url: '/jobs/company/?c=' + encodeURIComponent(c.company_slug) };
          });
        })
        .catch(function () { return []; });
    }
    return jobsCompanies;
  }

  var corpus = [];
  var extraLoaded = false;
  function ensureCore() { return load('core').then(function (d) { if (!corpus.length) corpus = d.slice(); return corpus; }); }
  function ensureAll(onMore) {
    if (extraLoaded) return;
    extraLoaded = true;
    Promise.all([load('verses'), load('names'), load('questions'), loadJobCompanies()]).then(function (parts) {
      parts.forEach(function (p) { corpus = corpus.concat(p); });
      onMore();
    });
  }

  /* ══════════════════════════ UI ══════════════════════════ */

  function el(tag, attrs, text) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { if (attrs[k] != null) n.setAttribute(k, attrs[k]); });
    if (text != null) n.textContent = text;
    return n;
  }
  function safeUrl(u) { return /^\/(?!\/)/.test(u || '') ? u : '#'; }
  function ensureCss() {
    if (document.querySelector('link[href$="/lib/ps-platform.css"]')) return;
    var l = el('link', { rel: 'stylesheet', href: '/lib/ps-platform.css' });
    document.head.appendChild(l);
  }

  /** Append `text` to `node`, wrapping query-term matches in <mark> (no innerHTML).
   *  Matching is diacritic-insensitive ("karma" marks "karmāṇi"), so the text is
   *  folded character by character with a map back to original offsets. */
  function highlight(node, text, ts) {
    text = String(text || '');
    var folded = '', map = [];
    for (var i = 0; i < text.length; i++) {
      var f = text[i].normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      for (var j = 0; j < f.length; j++) { folded += f[j]; map.push(i); }
    }
    var marks = [];
    ts.forEach(function (t) {
      if (t.length < 2) return;
      var from = 0, k;
      while ((k = folded.indexOf(t, from)) !== -1) {
        marks.push([map[k], map[k + t.length - 1] + 1]);
        from = k + t.length;
      }
    });
    marks.sort(function (a, b) { return a[0] - b[0]; });
    var pos = 0;
    marks.forEach(function (m) {
      if (m[0] < pos) return;
      node.appendChild(document.createTextNode(text.slice(pos, m[0])));
      node.appendChild(el('mark', null, text.slice(m[0], m[1])));
      pos = m[1];
    });
    node.appendChild(document.createTextNode(text.slice(pos)));
  }

  var uid = 0;
  function createUI(host, mode) {
    ensureCss();
    var id = 'pss' + (++uid);
    var state = { group: 'all', active: -1, items: [], query: '', opener: null };

    var root = el('div', mode === 'dialog'
      ? { class: 'ps-search ps-search--dialog', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': id + '-h', hidden: '' }
      : { class: 'ps-search ps-search--page' });
    var panel = el('div', { class: 'ps-search-panel' });
    var heading = el('h2', { id: id + '-h', class: mode === 'dialog' ? 'ps-sr-only' : 'ps-search-title' }, 'Search PaddySpeaks');
    var form = el('div', { class: 'ps-search-bar' });
    var label = el('label', { for: id + '-q', class: 'ps-sr-only' }, 'Search articles, sacred texts, interview prep, companies and more');
    var input = el('input', {
      id: id + '-q', type: 'search', class: 'ps-search-input', autocomplete: 'off', spellcheck: 'false',
      placeholder: 'Search essays, verses, interview topics, companies…',
      role: 'combobox', 'aria-expanded': 'false', 'aria-controls': id + '-list', 'aria-autocomplete': 'list'
    });
    form.appendChild(label); form.appendChild(input);
    if (mode === 'dialog') {
      var closeBtn = el('button', { type: 'button', class: 'ps-search-close', 'aria-label': 'Close search' }, 'Esc');
      closeBtn.addEventListener('click', function () { close(); });
      form.appendChild(closeBtn);
    }
    var chips = el('div', { class: 'ps-search-chips', role: 'group', 'aria-label': 'Filter by kind' });
    GROUPS.forEach(function (g) {
      var b = el('button', { type: 'button', class: 'ps-chip', 'data-group': g.id, 'aria-pressed': g.id === 'all' ? 'true' : 'false' });
      b.appendChild(el('span', null, g.label));
      b.appendChild(el('span', { class: 'ps-chip-count', 'aria-hidden': 'true' }, ''));
      b.addEventListener('click', function () { setGroup(g.id); input.focus(); });
      chips.appendChild(b);
    });
    var status = el('p', { class: 'ps-search-status', role: 'status', 'aria-live': 'polite' });
    var list = el('ul', { id: id + '-list', class: 'ps-search-results', role: 'listbox', 'aria-label': 'Search results' });
    var foot = el('div', { class: 'ps-search-foot' });

    panel.appendChild(heading); panel.appendChild(form); panel.appendChild(chips);
    panel.appendChild(status); panel.appendChild(list); panel.appendChild(foot);
    root.appendChild(panel);
    host.appendChild(root);

    function setGroup(g) {
      state.group = g;
      Array.prototype.forEach.call(chips.children, function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-group') === g ? 'true' : 'false'); });
      render();
    }

    function setActive(i) {
      var opts = list.querySelectorAll('[role="option"]');
      if (!opts.length) { state.active = -1; input.removeAttribute('aria-activedescendant'); return; }
      state.active = Math.max(0, Math.min(i, opts.length - 1));
      Array.prototype.forEach.call(opts, function (o, k) { o.setAttribute('aria-selected', k === state.active ? 'true' : 'false'); });
      input.setAttribute('aria-activedescendant', opts[state.active].id);
      opts[state.active].scrollIntoView({ block: 'nearest' });
    }

    function renderEmpty() {
      list.textContent = '';
      foot.textContent = '';
      input.setAttribute('aria-expanded', 'false');
      status.textContent = 'Try a verse ("Gita 2.47"), an idea ("karma without attachment"), a skill ("spark skew") or a company ("Meta").';
      Array.prototype.forEach.call(chips.querySelectorAll('.ps-chip-count'), function (c) { c.textContent = ''; });
    }

    function render() {
      var q = state.query;
      if (!q.trim()) { renderEmpty(); return; }
      var ts = terms(q);
      var ranked = rank(corpus, q);
      var counts = groupCounts(ranked);
      Array.prototype.forEach.call(chips.children, function (b) {
        var n = counts[b.getAttribute('data-group')] || 0;
        b.querySelector('.ps-chip-count').textContent = n ? String(n) : '';
      });
      var g = GROUPS.filter(function (x) { return x.id === state.group; })[0];
      var shown = g.types ? ranked.filter(function (r) { return g.types.indexOf(r.doc.type) !== -1; }).slice(0, 40)
        : diversify(ranked, 5, 24);
      list.textContent = '';
      shown.forEach(function (r, k) {
        var d = r.doc;
        var li = el('li', { id: id + '-o' + k, role: 'option', 'aria-selected': 'false', class: 'ps-result' });
        var a = el('a', { href: safeUrl(d.url), tabindex: '-1' });
        var top = el('span', { class: 'ps-result-top' });
        var badge = el('span', { class: 'ps-badge', 'data-type': d.type }, TYPE_LABEL[d.type] || d.type);
        var title = el('span', { class: 'ps-result-title' });
        highlight(title, d.title, ts);
        top.appendChild(badge); top.appendChild(title);
        a.appendChild(top);
        if (d.subtitle) a.appendChild(el('span', { class: 'ps-result-sub' }, d.subtitle));
        if (d.text) { var p = el('span', { class: 'ps-result-text' }); highlight(p, d.text.length > 180 ? d.text.slice(0, 177) + '…' : d.text, ts); a.appendChild(p); }
        li.appendChild(a);
        li.addEventListener('mousemove', function () { if (state.active !== k) setActive(k); });
        list.appendChild(li);
      });
      input.setAttribute('aria-expanded', shown.length ? 'true' : 'false');
      state.active = -1; input.removeAttribute('aria-activedescendant');
      var total = g.types ? counts[g.id] : counts.all;
      status.textContent = total
        ? (total + (total === 1 ? ' result' : ' results') + (g.types ? ' in ' + g.label : '') + (total > shown.length ? ', showing ' + shown.length : '') + '.')
        : 'Nothing matches “' + q + '”' + (g.types ? ' in ' + g.label : '') + '. Try fewer or different words.';
      foot.textContent = '';
      var jobs = el('a', { href: '/jobs/search/?q=' + encodeURIComponent(q), class: 'ps-search-handoff' }, 'Search live roles for “' + q + '” on JobSignal →');
      var atlas = el('a', { href: '/atlas/?q=' + encodeURIComponent(q), class: 'ps-search-handoff' }, 'Explore “' + q + '” in Atlas, with connections →');
      if (mode === 'dialog') foot.appendChild(atlas);
      foot.appendChild(jobs);
    }

    var t;
    input.addEventListener('input', function () {
      state.query = input.value;
      if (mode === 'page') syncUrl(state.query);
      ensureAll(render);
      clearTimeout(t);
      t = setTimeout(render, 60);
    });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setActive(state.active + 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(state.active - 1); }
      else if (e.key === 'Home' && e.ctrlKey) { e.preventDefault(); setActive(0); }
      else if (e.key === 'Enter') {
        var opts = list.querySelectorAll('[role="option"] a');
        var target = opts[state.active >= 0 ? state.active : 0];
        if (target) { e.preventDefault(); location.href = target.getAttribute('href'); if (mode === 'dialog') close(); }
      }
    });

    // Focus trap (dialog only): Tab cycles within the panel.
    root.addEventListener('keydown', function (e) {
      if (mode !== 'dialog') return;
      if (e.key === 'Escape') { e.preventDefault(); close(); return; }
      if (e.key !== 'Tab') return;
      var f = panel.querySelectorAll('input, button, a[href]:not([tabindex="-1"])');
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
    root.addEventListener('mousedown', function (e) { if (mode === 'dialog' && e.target === root) close(); });

    function open(opener, q) {
      state.opener = opener || document.activeElement;
      root.hidden = false;
      document.documentElement.classList.add('ps-search-open');
      ensureCore().then(function () { if (q != null) { input.value = q; state.query = q; ensureAll(render); } render(); });
      input.focus();
      input.select();
    }
    function close() {
      if (mode !== 'dialog' || root.hidden) return;
      root.hidden = true;
      document.documentElement.classList.remove('ps-search-open');
      if (state.opener && state.opener.focus) state.opener.focus();
    }
    function syncUrl(q) {
      try {
        var u = new URL(location.href);
        if (q) u.searchParams.set('q', q); else u.searchParams.delete('q');
        history.replaceState(null, '', u.pathname + u.search + u.hash);
      } catch (e) { /* ignore */ }
    }

    if (mode === 'page') {
      var q0 = new URLSearchParams(location.search).get('q') || '';
      input.value = q0; state.query = q0;
      ensureCore().then(function () { if (q0) ensureAll(render); render(); });
    }
    return { open: open, close: close, input: input, root: root };
  }

  /* ══════════════════════════ WIRING ══════════════════════════ */

  var dialog = null;
  function getDialog() { if (!dialog) dialog = createUI(document.body, 'dialog'); return dialog; }

  function openSearch(opener, q) { getDialog().open(opener, q); }

  function start() {
    document.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('[data-ps-search-open]');
      if (!b) return;
      e.preventDefault();
      // data-ps-search-q prefills the dialog (the homepage's example queries).
      openSearch(b, b.getAttribute('data-ps-search-q'));
    });
    document.addEventListener('keydown', function (e) {
      var typing = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target && e.target.tagName) || '') || (e.target && e.target.isContentEditable);
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); openSearch(document.activeElement); }
      else if (e.key === '/' && !typing) { e.preventDefault(); openSearch(document.activeElement); }
    });
    var mounts = document.querySelectorAll('[data-ps-search-page]');
    for (var i = 0; i < mounts.length; i++) createUI(mounts[i], 'page');
    // ?q= on a page with the dialog (the homepage's SearchAction) opens it prefilled.
    var q = new URLSearchParams(location.search).get('q');
    if (q && !mounts.length && document.querySelector('[data-ps-search-open]')) openSearch(null, q);
  }

  global.PSSearch = { open: openSearch, engine: engine };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})(typeof window !== 'undefined' ? window : globalThis);
