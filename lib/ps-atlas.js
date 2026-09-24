/**
 * PaddySpeaks Atlas (P2.3) — the connected view above search.
 *
 * Deterministic and explainable: no model is called. Atlas composes three
 * things the platform already knows:
 *
 *   1. search results      lib/ps-search.js in page mode ([data-ps-search-page])
 *   2. concepts            data/graph/concepts.json via /data/graph.json —
 *                          when the query names a concept (label or alias), or
 *                          ?c=<id> is in the URL, show its definition and every
 *                          connection, grouped by relation
 *   3. intent panels       when the query names a company Interview Studio
 *                          knows ("Meta data engineer"), assemble: that
 *                          company's questions, its live roles on JobSignal,
 *                          and the prep tracks that apply — each a plain link
 *
 * Architecture for later (docs/ATLAS.md): a synthesis step may one day
 * summarise these connected items. It must cite them, and it sits on top of
 * this deterministic layer rather than replacing it.
 */
(function () {
  'use strict';

  var REL = {
    explains: 'Explained in', appliesTo: 'Applied in', preparesFor: 'Prepare with', relatedTo: 'Related',
    questionTests: 'Practise', references: 'Linked', chapterOf: 'Part of'
  };
  var TYPE_LABEL = {
    article: 'Essay', sacred: 'Sacred text', verse: 'Verse', name: 'Divine name', music: 'Devotional music',
    topic: 'Interview prep', question: 'Question', company: 'Company', demo: 'Demo', tool: 'Tool', page: 'Page', concept: 'Concept'
  };

  function el(tag, attrs, text) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    if (text != null) n.textContent = text;
    return n;
  }
  function safe(u) { return /^\/(?!\/)/.test(u || '') ? u : '#'; }
  function norm(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim(); }
  function getJSON(u) { return fetch(u, { credentials: 'same-origin' }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }); }

  var host = document.getElementById('atlas-connected');
  if (!host) return;

  var graphP = getJSON('/data/graph.json');
  var coreP = getJSON('/data/search/core.json');
  var jobsP = getJSON('/jobs/data/companies.json');

  function conceptFor(q, graph, core) {
    var params = new URLSearchParams(location.search);
    var cid = params.get('c');
    var concepts = (core.docs || []).filter(function (d) { return d.type === 'concept'; });
    if (cid) return concepts.filter(function (c) { return c.id === 'concept:' + cid; })[0] || null;
    var nq = ' ' + norm(q) + ' ';
    if (nq.trim().length < 3) return null;
    var best = null, bestLen = 0;
    concepts.forEach(function (c) {
      [c.title].concat(c.tags || []).forEach(function (alias) {
        var a = norm(alias);
        if (a.length >= 3 && nq.indexOf(' ' + a + ' ') !== -1 && a.length > bestLen) { best = c; bestLen = a.length; }
      });
    });
    return best;
  }

  function conceptPanel(c, graph) {
    var box = el('section', { class: 'ps-atlas-panel', 'aria-labelledby': 'atlas-c-h' });
    box.appendChild(el('span', { class: 'ps-badge', 'data-type': 'concept' }, 'Concept'));
    box.appendChild(el('h2', { id: 'atlas-c-h' }, c.title));
    if (c.text) box.appendChild(el('p', { class: 'ps-atlas-def' }, c.text));
    var groups = {};
    (graph.edges || []).forEach(function (e) {
      if (e[0] !== c.id) return;
      var n = graph.nodes[e[2]];
      if (!n) return;
      (groups[e[1]] = groups[e[1]] || []).push(n);
    });
    Object.keys(REL).forEach(function (rel) {
      if (!groups[rel]) return;
      box.appendChild(el('h3', null, REL[rel]));
      var ul = el('ul', { class: 'ps-atlas-list' });
      groups[rel].forEach(function (n) {
        var li = el('li');
        var a = el('a', { href: safe(n.url) });
        a.appendChild(el('span', { class: 'ps-badge', 'data-type': n.type }, TYPE_LABEL[n.type] || n.type));
        a.appendChild(el('span', null, n.title));
        li.appendChild(a); ul.appendChild(li);
      });
      box.appendChild(ul);
    });
    // Other concepts that point at this one.
    var back = (graph.edges || []).filter(function (e) { return e[2] === c.id && e[0].indexOf('concept:') === 0; });
    if (back.length) {
      box.appendChild(el('h3', null, 'See also'));
      var ul2 = el('ul', { class: 'ps-atlas-list' });
      back.forEach(function (e) {
        var n = graph.nodes[e[0]];
        if (!n) return;
        var li = el('li'); var a = el('a', { href: safe(n.url) });
        a.appendChild(el('span', { class: 'ps-badge', 'data-type': 'concept' }, 'Concept'));
        a.appendChild(el('span', null, n.title)); li.appendChild(a); ul2.appendChild(li);
      });
      box.appendChild(ul2);
    }
    box.appendChild(el('p', { class: 'ps-panel-note' }, 'These connections were chosen by hand and are checked on every build: each points at a real page, verse or topic.'));
    return box;
  }

  function companyPanel(q, core, jobs) {
    var nq = ' ' + norm(q) + ' ';
    var companies = (core.docs || []).filter(function (d) { return d.type === 'company'; });
    var hit = null;
    companies.forEach(function (c) {
      var n = norm(c.title);
      if (n.length >= 2 && nq.indexOf(' ' + n + ' ') !== -1 && (!hit || n.length > norm(hit.title).length)) hit = c;
    });
    if (!hit) return null;
    var name = hit.title;
    var rest = norm(q).replace(norm(name), '').trim();
    var jobCo = ((jobs && jobs.companies) || []).filter(function (c) { return norm(c.company_name) === norm(name) && c.live_jobs > 0; })[0];
    var box = el('section', { class: 'ps-atlas-panel', 'aria-labelledby': 'atlas-co-h' });
    box.appendChild(el('span', { class: 'ps-badge', 'data-type': 'company' }, 'Company'));
    box.appendChild(el('h2', { id: 'atlas-co-h' }, 'Preparing for ' + name + (rest ? ' · ' + rest : '')));
    var ul = el('ul', { class: 'ps-atlas-list' });
    function item(type, label, url, note) {
      var li = el('li'); var a = el('a', { href: safe(url) });
      a.appendChild(el('span', { class: 'ps-badge', 'data-type': type }, TYPE_LABEL[type] || type));
      a.appendChild(el('span', null, label)); li.appendChild(a);
      if (note) li.appendChild(el('small', null, note));
      ul.appendChild(li);
    }
    item('question', name + ' interview questions', hit.url, hit.subtitle);
    if (jobCo) item('company', name + ' on JobSignal', '/jobs/company/?c=' + encodeURIComponent(jobCo.company_slug), jobCo.live_jobs + ' live roles, verified against ' + name + '’s own careers page');
    item('page', 'Search live roles: “' + q + '”', '/jobs/search/?q=' + encodeURIComponent(q), 'JobSignal · roles still open, re-checked every four hours');
    item('topic', 'Company research before the interview', '/interview.app/company-research/', 'Interview Studio');
    item('topic', 'Behavioral & leadership (STAR stories)', '/interview.app/behavioral/', 'Interview Studio');
    item('topic', 'Resume bullet improvements', '/interview.app/resume/', 'Interview Studio');
    item('topic', 'Data system design', '/interview.app/design/', 'Interview Studio');
    box.appendChild(ul);
    box.appendChild(el('p', { class: 'ps-panel-note' }, 'Assembled from what PaddySpeaks already has for ' + name + ' — nothing here is generated.'));
    return box;
  }

  function update() {
    var q = new URLSearchParams(location.search).get('q') || '';
    Promise.all([graphP, coreP, jobsP]).then(function (r) {
      var graph = r[0] || { nodes: {}, edges: [] }, core = r[1] || { docs: [] }, jobs = r[2];
      // Connected knowledge sits between the filters and the result list.
      var results = document.querySelector('[data-ps-search-page] .ps-search-results');
      if (results && host.nextElementSibling !== results) results.parentNode.insertBefore(host, results);
      host.textContent = '';
      var c = conceptFor(q, graph, core);
      if (c) host.appendChild(conceptPanel(c, graph));
      var co = q ? companyPanel(q, core, jobs) : null;
      if (co) host.appendChild(co);
      host.hidden = !host.children.length;
    });
  }

  update();
  // The page-mode search keeps ?q= in the URL as the reader types.
  var input = document.querySelector('[data-ps-search-page] input');
  var t;
  document.addEventListener('input', function (e) {
    if (!e.target.closest || !e.target.closest('[data-ps-search-page]')) return;
    clearTimeout(t); t = setTimeout(update, 250);
  });
  void input;
})();
