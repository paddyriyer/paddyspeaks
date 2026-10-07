/* Reported Interview Questions — browser, trending and company views.
 *
 * All judgement (attribution, frequency, freshness, trends, company shares)
 * is computed once by the Python pipeline (interviewintel/) and shipped as
 * JSON. This file only formats and filters it. Every string from the data is
 * set with textContent: nothing from a source or a model becomes HTML.
 *
 * Three kinds of question are told apart everywhere:
 *   - Reported in an interview / From a public question list (source-derived)
 *   - PaddySpeaks practice question (our rewrite of the reported concept)
 *   - AI-generated similar question (new, written by PaddySpeaks AI)
 */
(function () {
  'use strict';

  var DATA = '/interview.app/reported/data/';
  var STORE = 'ps-reported-v1';
  var KIND = { reported: 'Reported in an interview', listed: 'From a public question list' };
  var FRESH = { RECENT: 'Recent', RECURRING: 'Recurring', HISTORICAL: 'Historical' };
  var STATUS = { practiced: 'Practiced', mastered: 'Mastered', retry: 'Try again' };

  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    if (attrs) {
      for (var k in attrs) {
        if (!Object.prototype.hasOwnProperty.call(attrs, k) || attrs[k] == null) continue;
        if (k === 'text') n.textContent = attrs[k];
        else if (k === 'cls') n.className = attrs[k];
        else if (k.indexOf('on') === 0) n.addEventListener(k.slice(2), attrs[k]);
        else n.setAttribute(k, attrs[k]);
      }
    }
    (kids || []).forEach(function (c) {
      if (c == null || c === false) return;
      n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return n;
  }
  function clear(n) { while (n.firstChild) n.removeChild(n.firstChild); }
  function load(name) {
    return fetch(DATA + name, { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error(name + ' ' + r.status);
      return r.json();
    });
  }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }
  function names(list) { return (list || []).map(function (x) { return x.name; }).join(', '); }
  function fmtDate(s) { return s ? s.slice(0, 10) : 'unknown'; }

  /* ---- progress, kept in this browser only (data/platform/state-keys.json) ---- */
  function readState() {
    try { return JSON.parse(localStorage.getItem(STORE) || '{}') || {}; } catch (e) { return {}; }
  }
  function writeState(s) { try { localStorage.setItem(STORE, JSON.stringify(s)); } catch (e) { /* private mode */ } }
  function mark(id, patch) {
    var s = readState();
    var cur = s[id] || {};
    for (var k in patch) cur[k] = patch[k];
    cur.updated = new Date().toISOString().slice(0, 10);
    if (!cur.saved && !cur.status) delete s[id]; else s[id] = cur;
    writeState(s);
    return s[id] || {};
  }

  /* ================================ browser ================================ */
  var FILTERS = [
    ['c', 'Company', function (q) { return (q.companies_reported || []).map(function (x) { return [x.slug, x.name]; }); }],
    ['r', 'Role', function (q) { return (q.roles_reported || []).map(function (x) { return [x.slug, x.name]; }); }],
    ['t', 'Topic', function (q) { return [[q.category, q.category]]; }],
    ['d', 'Difficulty', function (q) { return q.difficulty ? [[q.difficulty, q.difficulty]] : []; }],
    ['s', 'Interview stage', function (q) { return (q.interview_stages || []).map(function (x) { return [x, x]; }); }],
    ['y', 'Year', function (q) { return (q.years || []).map(function (x) { return [String(x), String(x)]; }); }],
    ['tech', 'Technology', function (q) { return (q.technology || []).map(function (x) { return [x, x]; }); }],
    ['type', 'Question type', function (q) { return [[q.question_type, KIND[q.question_type]]]; }],
    ['mine', 'My progress', function (q, st) {
      var me = st[q.id] || {};
      var out = [];
      if (me.saved) out.push(['saved', 'Saved']);
      if (me.status) out.push([me.status, STATUS[me.status]]);
      return out;
    }]
  ];

  function browser(root) {
    var params = new URLSearchParams(location.search);
    var all = [];
    var filtersBox = document.getElementById('rq-filters');
    var listBox = document.getElementById('rq-list');
    var countBox = document.getElementById('rq-count');

    load('questions.json').then(function (doc) {
      all = doc.questions || [];
      if (!all.length) {
        listBox.appendChild(el('li', { cls: 'rq-empty' }, [
          'No reported questions have been approved yet. Every week the discovery engine reads public interview ',
          'write-ups and questions shared through the Contribute form, and a question appears here only after a person has reviewed its source. ',
          'Nothing on this page is invented or seeded. ',
          el('a', { href: '/interview.app/reported/about/', text: 'How it works →' })
        ]));
        countBox.textContent = '0 questions';
        return;
      }
      buildFilters();
      render();
    }).catch(function () {
      listBox.appendChild(el('li', { cls: 'rq-empty', text: 'The question data could not be loaded. Please try again later.' }));
    });

    function buildFilters() {
      var st = readState();
      FILTERS.forEach(function (f) {
        var seen = {};
        all.forEach(function (q) { f[2](q, st).forEach(function (p) { seen[p[0]] = p[1]; }); });
        var keys = Object.keys(seen).sort(function (a, b) { return String(seen[a]).localeCompare(String(seen[b])); });
        if (f[0] === 'y') keys.reverse();
        var sel = el('select', { id: 'f-' + f[0], 'data-key': f[0], onchange: render }, [el('option', { value: '', text: 'All' })]);
        keys.forEach(function (k) { sel.appendChild(el('option', { value: k, text: seen[k] })); });
        if (f[0] === 'mine') {
          ['saved', 'practiced', 'mastered', 'retry'].forEach(function (k) {
            if (!seen[k]) sel.appendChild(el('option', { value: k, text: k === 'saved' ? 'Saved' : STATUS[k] }));
          });
        }
        sel.value = params.get(f[0]) || '';
        filtersBox.appendChild(el('label', { 'for': 'f-' + f[0] }, [f[1], sel]));
      });
      var search = el('input', { id: 'f-q', type: 'search', placeholder: 'Search questions, e.g. window functions', oninput: render });
      search.value = params.get('q') || '';
      filtersBox.appendChild(el('label', { cls: 'rq-search', 'for': 'f-q' }, ['Search', search]));
    }

    function current() {
      var out = {};
      FILTERS.forEach(function (f) { var v = document.getElementById('f-' + f[0]).value; if (v) out[f[0]] = v; });
      var q = document.getElementById('f-q').value.trim();
      if (q) out.q = q;
      return out;
    }

    function render() {
      var f = current();
      var st = readState();
      var p = new URLSearchParams();
      Object.keys(f).forEach(function (k) { p.set(k, f[k]); });
      var focus = params.get('id');
      if (focus) p.set('id', focus);
      history.replaceState(null, '', location.pathname + (p.toString() ? '?' + p : ''));
      var words = (f.q || '').toLowerCase().split(/\s+/).filter(Boolean);
      var shown = all.filter(function (q) {
        if (focus && q.id !== focus) return false;
        for (var i = 0; i < FILTERS.length; i++) {
          var key = FILTERS[i][0];
          if (!f[key]) continue;
          var vals = FILTERS[i][2](q, st).map(function (x) { return x[0]; });
          if (vals.indexOf(f[key]) < 0) return false;
        }
        var hay = (q.title + ' ' + q.question + ' ' + q.topic + ' ' + (q.technology || []).join(' ')).toLowerCase();
        return words.every(function (w) { return hay.indexOf(w) >= 0; });
      });
      clear(listBox);
      countBox.textContent = plural(shown.length, 'question', 'questions') + (focus ? ' (one question selected)' : '');
      if (focus) {
        listBox.appendChild(el('li', null, [el('button', { cls: 'rq-btn', type: 'button', onclick: function () {
          params.delete('id'); render();
        }, text: '← Show all questions' })]));
      }
      if (!shown.length) listBox.appendChild(el('li', { cls: 'rq-empty', text: 'No questions match these filters.' }));
      shown.forEach(function (q) { listBox.appendChild(card(q)); });
    }
  }

  function card(q) {
    var me = readState()[q.id] || {};
    var statusLine = el('span', { cls: 'rq-status', role: 'status' });
    function showStatus() {
      var bits = [];
      if (me.saved) bits.push('Saved');
      if (me.status) bits.push(STATUS[me.status]);
      statusLine.textContent = bits.length ? bits.join(' · ') + ' — kept in this browser only' : '';
    }
    function toggle(label, key, value) {
      var pressed = key === 'saved' ? !!me.saved : me.status === value;
      var b = el('button', { cls: 'rq-btn', type: 'button', 'aria-pressed': String(pressed), text: label });
      b.addEventListener('click', function () {
        var patch = {};
        if (key === 'saved') patch.saved = !me.saved;
        else patch.status = me.status === value ? null : value;
        me = mark(q.id, patch);
        var row = b.parentNode.querySelectorAll('button[data-k]');
        for (var i = 0; i < row.length; i++) {
          var k = row[i].getAttribute('data-k');
          row[i].setAttribute('aria-pressed', String(k === 'saved' ? !!me.saved : me.status === k));
        }
        showStatus();
      });
      b.setAttribute('data-k', key === 'saved' ? 'saved' : value);
      return b;
    }

    var prep = q.prep;
    var li = el('li', { cls: 'rq-card', id: q.id });
    li.appendChild(el('div', { cls: 'rq-badges' }, [
      el('span', { cls: 'rq-pill rq-kind', text: KIND[q.question_type] }),
      el('span', { cls: 'rq-pill rq-fresh', text: FRESH[q.freshness] || q.freshness }),
      el('span', { cls: 'rq-pill', text: q.category }),
      q.difficulty ? el('span', { cls: 'rq-pill', text: q.difficulty, title: 'Difficulty as assessed by PaddySpeaks' }) : null
    ]));
    li.appendChild(el('h2', { cls: 'rq-title' }, [el('a', { href: '?id=' + encodeURIComponent(q.id), text: q.title })]));
    li.appendChild(el('p', { cls: 'rq-kicker', text: 'PaddySpeaks practice question · rewritten from public reports' }));
    li.appendChild(el('p', { cls: 'rq-q', text: q.question }));

    var facts = el('dl', { cls: 'rq-facts' });
    function fact(k, v) { if (v) { facts.appendChild(el('dt', { text: k })); facts.appendChild(el('dd', { text: v })); } }
    fact('Topic', q.topic);
    fact('Skills tested', prep && prep.skills_tested && prep.skills_tested.length ? prep.skills_tested.join(', ') : null);
    fact('Difficulty', q.difficulty ? q.difficulty + ' (PaddySpeaks assessment)' : 'Not assessed');
    li.appendChild(facts);

    var actions = el('div', { cls: 'rq-actions' }, [
      toggle('Save question', 'saved'), toggle('Mark practiced', 'status', 'practiced'),
      toggle('Mark mastered', 'status', 'mastered'), toggle('Try again', 'status', 'retry'), statusLine
    ]);
    li.appendChild(actions);
    showStatus();

    /* ---- source-derived ---- */
    var src = el('section', { cls: 'rq-section rq-src', 'aria-label': 'Source-derived information' },
      [el('h4', { text: 'Source-derived information — what public reports say' })]);
    var sfacts = el('dl', { cls: 'rq-facts' });
    function sfact(k, v) { sfacts.appendChild(el('dt', { text: k })); sfacts.appendChild(el('dd', { text: v })); }
    sfact('Company reports', names(q.companies_reported) || 'Unknown — no source attributes it to a company');
    sfact('Roles', names(q.roles_reported) || 'Unknown');
    sfact('Interview stage', (q.interview_stages || []).join(', ') || 'Unknown');
    sfact('Reported frequency', plural(q.reported_frequency, 'report', 'reports') + ' in the last 90 days · ' +
      plural(q.source_count, 'public source', 'public sources') + ' in all');
    sfact('Seen', 'first ' + fmtDate(q.first_seen) + ', last ' + fmtDate(q.last_seen));
    src.appendChild(sfacts);
    var sl = el('ul', { cls: 'rq-src-list' });
    (q.sources || []).forEach(function (s) {
      var meta = [s.type_label, s.source_date ? 'published ' + s.source_date : 'publication date unknown',
        'retrieved ' + s.retrieved, s.asked_in_interview ? 'reports it was asked' : 'lists it'];
      var who = [s.company, s.role, s.stage].filter(Boolean).join(' · ');
      sl.appendChild(el('li', null, [
        el('a', { href: s.url, rel: 'nofollow noopener noreferrer', target: '_blank', text: s.title + ' ↗' }),
        el('div', { cls: 'rq-muted', text: meta.join(' · ') + (who ? ' · ' + who : '') })
      ]));
    });
    src.appendChild(el('details', null, [el('summary', { text: 'Source / attribution (' + (q.sources || []).length + ')' }), sl,
      el('p', { cls: 'rq-muted', text: 'We link to the public report and never copy it. Companies, roles and stages appear only when a source states them.' })]));
    li.appendChild(src);

    /* ---- AI-generated preparation material ---- */
    var ai = el('section', { cls: 'rq-section rq-ai', 'aria-label': 'PaddySpeaks AI-generated preparation material' },
      [el('h4', { text: 'PaddySpeaks AI-generated preparation material' })]);
    if (!prep) {
      ai.appendChild(el('p', { cls: 'rq-muted', text: 'Preparation material for this question has not been written yet.' }));
    } else {
      ai.appendChild(el('p', { cls: 'rq-muted', text: 'Written by PaddySpeaks AI on ' + prep.generated_at +
        '. Not from the original interview or candidate.' }));
      if (prep.why_asked) ai.appendChild(el('details', null, [el('summary', { text: 'Why interviewers ask this' }), el('p', { text: prep.why_asked })]));
      var hints = prep.hints || [];
      if (hints.length) {
        var hl = el('ol', { cls: 'rq-plain' });
        var shown = 0;
        var hb = el('button', { cls: 'rq-btn', type: 'button', text: 'Show a hint (' + hints.length + ')' });
        hb.addEventListener('click', function () {
          if (shown < hints.length) hl.appendChild(el('li', { text: hints[shown++] }));
          hb.textContent = shown < hints.length ? 'Next hint (' + (hints.length - shown) + ' left)' : 'All hints shown';
          if (shown >= hints.length) hb.disabled = true;
        });
        ai.appendChild(el('div', null, [hb, hl]));
      }
      var sol = prep.sample_solution || {};
      var solBox = el('div', { hidden: 'hidden' }, [
        el('h3', { text: 'Recommended approach' }), el('p', { text: prep.approach || '' }),
        sol.code ? el('pre', null, [el('code', { text: sol.code })]) : null,
        sol.explanation ? el('p', { text: sol.explanation }) : null,
        (prep.common_mistakes || []).length ? el('h3', { text: 'Common mistakes' }) : null,
        (prep.common_mistakes || []).length ? listOf(prep.common_mistakes) : null,
        prep.estimated_minutes ? el('p', { cls: 'rq-muted', text: 'Estimated solving time: about ' + prep.estimated_minutes + ' minutes.' }) : null
      ]);
      var rb = el('button', { cls: 'rq-btn', type: 'button', 'aria-expanded': 'false', text: 'Reveal solution' });
      rb.addEventListener('click', function () {
        var open = solBox.hasAttribute('hidden');
        if (open) solBox.removeAttribute('hidden'); else solBox.setAttribute('hidden', 'hidden');
        rb.setAttribute('aria-expanded', String(open));
        rb.textContent = open ? 'Hide solution' : 'Reveal solution';
      });
      ai.appendChild(el('div', { cls: 'rq-actions' }, [rb]));
      ai.appendChild(solBox);
      if ((prep.follow_ups || []).length) ai.appendChild(el('details', null, [el('summary', { text: 'Follow-up questions' }), listOf(prep.follow_ups)]));
      if ((prep.related_concepts || []).length) ai.appendChild(el('p', { cls: 'rq-muted', text: 'Related concepts: ' + prep.related_concepts.join(', ') }));

      var sims = prep.similar_questions || [];
      var simBox = el('div');
      var next = 0;
      var gb = el('button', { cls: 'rq-btn', type: 'button', text: 'Generate similar question' });
      gb.addEventListener('click', function () {
        if (!sims.length) { simBox.textContent = 'No similar question has been written for this one yet.'; gb.disabled = true; return; }
        var s = sims[next % sims.length];
        next++;
        clear(simBox);
        simBox.appendChild(el('p', { cls: 'rq-kicker', text: 'AI-generated similar question · not reported by anyone' }));
        simBox.appendChild(el('p', { cls: 'rq-q', text: s.question }));
        if (s.what_changes) simBox.appendChild(el('p', { cls: 'rq-muted', text: 'What changes: ' + s.what_changes }));
      });
      ai.appendChild(el('div', { cls: 'rq-actions' }, [gb, practiceSimilar(q)]));
      ai.appendChild(simBox);
    }
    if (!prep) ai.appendChild(el('div', { cls: 'rq-actions' }, [practiceSimilar(q)]));
    li.appendChild(ai);
    return li;
  }

  function listOf(items) {
    var ul = el('ul', { cls: 'rq-plain' });
    items.forEach(function (t) { ul.appendChild(el('li', { text: t })); });
    return ul;
  }

  function practiceSimilar(q) {
    var m = (q.bank_matches || [])[0];
    var href = m ? '/interview.app/?q=' + encodeURIComponent(m[1]) : '/interview.app/?q=' + encodeURIComponent(q.topic || q.category);
    return el('a', { cls: 'rq-btn', href: href, text: m ? 'Practice similar: ' + m[1] : 'Practice similar in the Question Bank' });
  }

  /* ================================ trending ================================ */
  function trending() {
    var box = document.getElementById('rq-trend');
    var tabs = document.getElementById('rq-tabs');
    Promise.all([load('trending.json'), load('questions.json')]).then(function (res) {
      var t = res[0], byId = {};
      (res[1].questions || []).forEach(function (q) { byId[q.id] = q; });
      var win = new URLSearchParams(location.search).get('w') || '30';
      ['7', '30', '90'].forEach(function (w) {
        var b = el('button', { cls: 'rq-btn', type: 'button', 'aria-pressed': String(w === win), text: 'Last ' + w + ' days' });
        b.addEventListener('click', function () {
          win = w;
          var all = tabs.querySelectorAll('button');
          for (var i = 0; i < all.length; i++) all[i].setAttribute('aria-pressed', String(all[i] === b));
          history.replaceState(null, '', '?w=' + w);
          draw();
        });
        tabs.appendChild(b);
      });
      function draw() {
        clear(box);
        var rows = (t.windows || {})[win] || [];
        if (!rows.length) {
          box.appendChild(el('li', { cls: 'rq-empty', text: 'No topic has at least ' + (t.min_reports || 2) +
            ' approved public reports in the last ' + win + ' days yet. Trends appear as reviewed reports accumulate.' }));
          return;
        }
        rows.forEach(function (r) {
          var arrow = r.direction === 'up' ? '↑ up' : r.direction === 'down' ? '↓ down' : '→ steady';
          var ex = el('div', { cls: 'rq-ex' });
          (r.questions || []).slice(0, 3).forEach(function (id, i) {
            if (!byId[id]) return;
            if (i) ex.appendChild(document.createTextNode(' · '));
            ex.appendChild(el('a', { href: '/interview.app/reported/?id=' + encodeURIComponent(id), text: byId[id].title }));
          });
          box.appendChild(el('li', null, [
            el('strong', { text: r.topic }),
            el('span', { cls: 'rq-dir', text: arrow + ' · ' + plural(r.reports, 'report', 'reports') + ' (previous ' + win + ' days: ' + r.previous + ')' }),
            ex
          ]));
        });
      }
      draw();
    }).catch(function () { box.appendChild(el('li', { cls: 'rq-empty', text: 'Trend data could not be loaded.' })); });
  }

  /* ================================ companies ================================ */
  function bars(block, unit) {
    var ul = el('ul', { cls: 'rq-bars' });
    var max = Math.max.apply(null, (block.rows || []).map(function (r) { return r.count; }).concat([1]));
    (block.rows || []).slice(0, 8).forEach(function (r) {
      var label = block.percent_shown ? r.percent + '% (' + r.count + ')' : plural(r.count, unit, unit + 's');
      ul.appendChild(el('li', { title: r.name + ': ' + label }, [
        el('span', { text: r.name }),
        el('span', { cls: 'rq-track', 'aria-hidden': 'true' }, [el('span', { cls: 'rq-fill', style: 'display:block;width:' + Math.round(100 * r.count / max) + '%' })]),
        el('span', { cls: 'rq-val', text: label })
      ]));
    });
    if (!(block.rows || []).length) ul.appendChild(el('li', { cls: 'rq-muted', text: 'No reports yet.' }));
    return ul;
  }

  function companies() {
    var box = document.getElementById('rq-company');
    var p = new URLSearchParams(location.search);
    var slug = p.get('c');
    var role = p.get('r');
    Promise.all([load('intel.json'), load('questions.json')]).then(function (res) {
      var doc = res[0], byId = {};
      (res[1].questions || []).forEach(function (q) { byId[q.id] = q; });
      var cos = doc.companies || {};
      if (!slug || !cos[slug]) {
        var ul = el('ul', { cls: 'rq-cos' });
        Object.keys(cos).sort(function (a, b) {
          return (cos[b].summary.reports - cos[a].summary.reports) || cos[a].name.localeCompare(cos[b].name);
        }).forEach(function (k) {
          var c = cos[k];
          ul.appendChild(el('li', null, [el('a', { href: '?c=' + encodeURIComponent(k) }, [
            el('strong', { text: c.name }),
            el('span', { cls: 'rq-muted', text: c.summary.reports ? plural(c.summary.reports, 'report', 'reports') + ' · ' +
              plural(c.summary.questions, 'question', 'questions') : 'No approved reports yet' })
          ])]));
        });
        box.appendChild(ul);
        return;
      }
      var c = cos[slug];
      var data = role && c.roles[role] ? c.roles[role] : c.summary;
      document.title = c.name + (role && c.roles[role] ? ' — ' + c.roles[role].name : '') + ' | Interview Intelligence | PaddySpeaks';
      box.appendChild(el('p', { cls: 'rq-eyebrow' }, [el('a', { href: './', text: '← All companies' })]));
      box.appendChild(el('h2', { text: (c.name + (role && c.roles[role] ? ' — ' + c.roles[role].name : '')).toUpperCase() }));
      var chips = el('div', { cls: 'rq-chips', role: 'group', 'aria-label': 'Role' });
      chips.appendChild(el('a', { cls: 'rq-btn', href: '?c=' + encodeURIComponent(slug), 'aria-current': !role ? 'page' : null, text: 'All roles' }));
      Object.keys(c.roles).forEach(function (rk) {
        chips.appendChild(el('a', { cls: 'rq-btn', href: '?c=' + encodeURIComponent(slug) + '&r=' + encodeURIComponent(rk),
          'aria-current': role === rk ? 'page' : null, text: c.roles[rk].name }));
      });
      box.appendChild(chips);
      if (!data.reports) {
        box.appendChild(el('p', { cls: 'rq-empty', text: 'No approved public reports name ' + c.name +
          ' yet. This page fills as reviewed reports arrive; nothing here is estimated or invented.' }));
        return;
      }
      box.appendChild(el('p', { cls: 'rq-muted', text: plural(data.reports, 'approved report', 'approved reports') + ' of ' +
        plural(data.questions, 'question', 'questions') + '; latest ' + fmtDate(data.latest_report) + '. ' +
        (data.topics.percent_shown ? 'Shares are of reports.' : 'Counts are shown, not percentages, until there are at least ' +
          doc.min_reports_for_percent + ' reports.') }));
      var grid = el('div', { cls: 'rq-grid' });
      function panel(title, block, unit) { grid.appendChild(el('section', { cls: 'rq-panel' }, [el('h3', { text: title }), bars(block, unit)])); }
      panel('Most commonly reported topics', data.topics, 'report');
      panel('Difficulty distribution', data.difficulty, 'report');
      panel('Interview stages', data.stages, 'report');
      panel('Skills frequently mentioned', data.skills, 'mention');
      box.appendChild(grid);
      box.appendChild(el('h3', { text: 'Recently reported questions' }));
      var rl = el('ul', { cls: 'rq-plain' });
      (data.recent_questions || []).forEach(function (id) {
        if (byId[id]) rl.appendChild(el('li', null, [el('a', { href: '/interview.app/reported/?id=' + encodeURIComponent(id), text: byId[id].title })]));
      });
      box.appendChild(rl);
      box.appendChild(el('h3', { text: 'Recent changes' }));
      box.appendChild(el('p', { text: (data.new_topics_last_30_days || []).length
        ? 'Topics first reported in the last 30 days: ' + data.new_topics_last_30_days.join(', ') + '.'
        : 'No new topics in the last 30 days.' }));
      box.appendChild(el('p', null, [el('a', { href: '/interview.app/reported/?c=' + encodeURIComponent(slug) + (role ? '&r=' + encodeURIComponent(role) : ''),
        text: 'Practise these questions →' })]));
    }).catch(function () { box.appendChild(el('p', { cls: 'rq-empty', text: 'Company data could not be loaded.' })); });
  }

  var view = document.body.getAttribute('data-rq-view');
  if (view === 'browser') browser();
  else if (view === 'trending') trending();
  else if (view === 'company') companies();
})();
