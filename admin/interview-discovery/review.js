/* Interview discovery review — /admin/interview-discovery/
 *
 * This page cannot change the site. It reads the review queue the pipeline
 * publishes (queue.json), lets a reviewer decide each pending report, keeps
 * the draft in this browser, and turns the decisions into a decision file.
 * The file reaches the repo as a commit (GitHub's "new file" page, or a
 * download), and interviewintel/pipeline/review.py applies it on the next
 * run. The authority to publish is exactly the authority to commit.
 *
 * Everything from the queue is set with textContent: source text never
 * becomes HTML.
 */
(function () {
  'use strict';

  var DRAFT = 'ps-intel-review-draft';
  var REPO_NEW = 'https://github.com/paddyriyer/paddyspeaks/new/main/interviewintel/decisions';
  var queue = null;
  var draft = readDraft();

  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    for (var k in (attrs || {})) {
      if (attrs[k] == null) continue;
      if (k === 'text') n.textContent = attrs[k];
      else if (k === 'cls') n.className = attrs[k];
      else if (k.indexOf('on') === 0) n.addEventListener(k.slice(2), attrs[k]);
      else n.setAttribute(k, attrs[k]);
    }
    (kids || []).forEach(function (c) { if (c != null && c !== false) n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return n;
  }
  function clear(n) { while (n.firstChild) n.removeChild(n.firstChild); }
  function readDraft() {
    try { return JSON.parse(localStorage.getItem(DRAFT) || '{}') || {}; } catch (e) { return {}; }
  }
  function saveDraft() { try { localStorage.setItem(DRAFT, JSON.stringify(draft)); } catch (e) { /* ignore */ } summary(); }

  fetch('queue.json', { cache: 'no-cache' }).then(function (r) { return r.json(); }).then(function (q) {
    queue = q;
    health();
    render();
    summary();
  }).catch(function () {
    document.getElementById('rv-list').appendChild(el('p', { cls: 'rv-empty', text: 'queue.json could not be loaded.' }));
  });

  function health() {
    var h = queue.health || {};
    var d = h.discovery || {};
    var bits = ['Queue generated ' + (queue.generated || '?'),
      'last run ' + (h.run_date || 'never'),
      'search: ' + (h.provider || 'not run'),
      'model: ' + (h.model || 'none')];
    if (d.queries != null) bits.push(d.queries + ' searches, ' + (d.results || 0) + ' results, ' + (d.reports_queued || 0) + ' reports queued');
    document.getElementById('rv-health').textContent = bits.join(' · ');
  }

  function render() {
    var list = document.getElementById('rv-list');
    clear(list);
    var band = document.getElementById('rv-band').value;
    var items = (queue.pending || []).filter(function (r) { return !band || r.band === band; });
    document.getElementById('rv-count').textContent = items.length + ' pending report' + (items.length === 1 ? '' : 's') +
      (band ? ' in this band' : '');
    if (!items.length) {
      list.appendChild(el('p', { cls: 'rv-empty', text: 'Nothing waiting for review.' }));
      return;
    }
    items.forEach(function (r) { list.appendChild(item(r)); });
  }

  function row(k, v, ev) {
    return el('tr', null, [el('th', { scope: 'row', text: k }),
      el('td', null, [v || 'UNKNOWN', ev ? el('div', { cls: 'rv-ev', text: '“' + ev + '”' }) : null])]);
  }

  function item(r) {
    var c = r.canonical || {};
    var d = draft[r.id];
    var box = el('article', { cls: 'rv-item' + (d ? ' rv-decided' : ''), id: r.id });
    box.appendChild(el('div', { cls: 'rv-top' }, [
      el('span', { cls: 'rv-conf rv-' + r.band, text: 'AI confidence ' + r.confidence + ' · ' + r.band }),
      el('span', { cls: 'rv-tag', text: 'Class ' + r.classification['class'] + (r.asked_in_interview ? ' · asked in an interview' : ' · listed') }),
      c.status === 'approved' ? el('span', { cls: 'rv-tag', text: 'New report of an existing question (' + r.canonical_approved_reports + ' approved)' }) : null
    ].concat((r.flags || []).map(function (f) { return el('span', { cls: 'rv-flag', text: f }); }))));
    box.appendChild(el('h2', { text: c.title || r.proposed.title }));
    box.appendChild(el('p', { cls: 'rv-q', text: c.question || r.proposed.question }));
    if (c.question && c.question !== r.proposed.question) {
      box.appendChild(el('p', { cls: 'rv-muted', text: 'This report proposed: ' + r.proposed.question }));
    }
    var t = el('table', { cls: 'rv-table' }, [el('tbody', null, [
      row('Question evidence', r.asked_in_interview ? 'stated as asked' : 'stated in a list', r.evidence),
      row('Company', r.company_name, r.company_evidence),
      row('Role', r.role_name, r.role_evidence),
      row('Stage', r.interview_stage, r.stage_evidence),
      row('Category', [c.category, c.subcategory, c.difficulty].filter(Boolean).join(' · ')),
      row('Original source', null),
      row('Classifier', r.classification.reason),
      row('Confidence', (r.confidence_parts || []).join('; '))
    ])]);
    var srcCell = t.querySelectorAll('td')[5];
    clear(srcCell);
    srcCell.appendChild(el('a', { href: r.url, target: '_blank', rel: 'noopener noreferrer nofollow', text: r.source_title + ' ↗' }));
    srcCell.appendChild(el('div', { cls: 'rv-muted', text: r.source_type + ' · published ' + (r.source_date || 'unknown') +
      ' · found ' + r.discovered + ' via ' + r.provider }));
    box.appendChild(t);
    if ((r.notes || []).length) {
      var nl = el('ul', { cls: 'rv-notes' });
      r.notes.forEach(function (n) { nl.appendChild(el('li', { text: n })); });
      box.appendChild(el('details', null, [el('summary', { text: 'Extraction notes (' + r.notes.length + ')' }), nl]));
    }
    var dups = r.possible_duplicates || [];
    if (dups.length || (r.bank_matches || []).length) {
      var dl = el('ul', { cls: 'rv-notes' });
      dups.forEach(function (p) {
        dl.appendChild(el('li', null, [
          el('strong', { text: Math.round(p.similarity * 100) + '% ' }), p.title + ' — ' + p.question + ' (' + p.how + ') ',
          el('button', { type: 'button', cls: 'rv-btn', text: 'Merge into this', onclick: function () { decide(r, { action: 'merge', into: p.id }); } })
        ]));
      });
      (r.bank_matches || []).forEach(function (b) {
        dl.appendChild(el('li', { text: 'Already in the Question Bank: ' + b.title + ' (' + b.id + ')' }));
      });
      box.appendChild(el('div', { cls: 'rv-dups' }, [el('h3', { text: 'Possible duplicates' }), dl]));
    }

    var status = el('p', { cls: 'rv-decision', role: 'status', text: d ? describe(d) : '' });
    var editBox = editor(r, c);
    var mergeSel = el('select', { 'aria-label': 'Merge into question' }, [el('option', { value: '', text: 'Merge into…' })]);
    (queue.merge_targets || []).forEach(function (m) {
      if (m.id !== r.question_id) mergeSel.appendChild(el('option', { value: m.id, text: m.title + ' [' + m.status + ']' }));
    });
    var note = el('input', { type: 'text', placeholder: 'Note (optional, e.g. why rejected)', 'aria-label': 'Decision note' });
    box.appendChild(el('div', { cls: 'rv-actions' }, [
      el('button', { type: 'button', cls: 'rv-btn rv-approve', text: 'Approve', onclick: function () { decide(r, { action: 'approve', note: note.value }); } }),
      el('button', { type: 'button', cls: 'rv-btn', text: 'Edit', 'aria-expanded': 'false', onclick: function (e) {
        var open = editBox.hasAttribute('hidden');
        if (open) editBox.removeAttribute('hidden'); else editBox.setAttribute('hidden', 'hidden');
        e.currentTarget.setAttribute('aria-expanded', String(open));
      } }),
      el('button', { type: 'button', cls: 'rv-btn rv-reject', text: 'Reject', onclick: function () { decide(r, { action: 'reject', note: note.value }); } }),
      mergeSel,
      el('button', { type: 'button', cls: 'rv-btn', text: 'Merge duplicate', onclick: function () {
        if (mergeSel.value) decide(r, { action: 'merge', into: mergeSel.value, note: note.value });
      } }),
      d ? el('button', { type: 'button', cls: 'rv-btn', text: 'Undo', onclick: function () { delete draft[r.id]; saveDraft(); render(); } }) : null,
      note
    ]));
    box.appendChild(editBox);
    box.appendChild(status);
    return box;
  }

  function editor(r, c) {
    var f = el('form', { cls: 'rv-edit', hidden: 'hidden' });
    function field(label, name, value, opts) {
      var input;
      if (opts) {
        input = el('select', { name: name }, [el('option', { value: '', text: '— unknown —' })]);
        opts.forEach(function (o) { input.appendChild(el('option', { value: o, text: o })); });
        input.value = value || '';
      } else if (name === 'question') {
        input = el('textarea', { name: name, rows: '4' });
        input.value = value || '';
      } else {
        input = el('input', { name: name, type: 'text' });
        input.value = value == null ? '' : value;
      }
      f.appendChild(el('label', null, [label, input]));
    }
    field('Practice question', 'question', c.question || r.proposed.question);
    field('Title', 'title', c.title || r.proposed.title);
    field('Category', 'category', c.category, queue.categories);
    field('Subcategory', 'subcategory', c.subcategory);
    field('Difficulty', 'difficulty', c.difficulty, queue.difficulties);
    field('Technology (comma-separated)', 'technology', (c.technology || []).join(', '));
    field('Company (empty = unknown)', 'company', r.company_name);
    field('Role (empty = unknown)', 'role', r.role_name);
    field('Interview stage', 'interview_stage', r.interview_stage, queue.stages);
    field('Interview year', 'interview_year', r.interview_year);
    f.appendChild(el('button', { type: 'submit', cls: 'rv-btn rv-approve', text: 'Approve with edits' }));
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var edits = {};
      var base = { question: c.question || r.proposed.question, title: c.title || r.proposed.title, category: c.category,
        subcategory: c.subcategory || '', difficulty: c.difficulty || '', technology: (c.technology || []).join(', '),
        company: r.company_name || '', role: r.role_name || '', interview_stage: r.interview_stage || '',
        interview_year: r.interview_year == null ? '' : String(r.interview_year) };
      Object.keys(base).forEach(function (k) {
        var v = f.elements[k].value.trim();
        if (v === String(base[k] || '')) return;
        if (k === 'technology') edits[k] = v.split(',').map(function (x) { return x.trim(); }).filter(Boolean);
        else if (k === 'interview_year') edits[k] = v ? parseInt(v, 10) : null;
        else edits[k] = v || null;
      });
      decide(r, { action: 'approve', edits: edits });
    });
    return f;
  }

  function describe(d) {
    var s = 'Drafted: ' + d.action.toUpperCase();
    if (d.into) s += ' into ' + d.into;
    if (d.edits && Object.keys(d.edits).length) s += ' with edits to ' + Object.keys(d.edits).join(', ');
    if (d.note) s += ' — ' + d.note;
    return s + '. Not applied until the decision file is committed.';
  }

  function decide(r, d) {
    var out = { report: r.id, action: d.action };
    if (d.into) out.into = d.into;
    if (d.edits && Object.keys(d.edits).length) out.edits = d.edits;
    if (d.note) out.note = d.note;
    draft[r.id] = out;
    saveDraft();
    render();
    var node = document.getElementById(r.id);
    if (node) node.scrollIntoView({ block: 'nearest' });
  }

  function decisionFile() {
    var who = document.getElementById('rv-who').value.trim() || 'reviewer';
    return {
      decided_by: who,
      decided_at: new Date().toISOString().replace(/\.\d+Z$/, 'Z'),
      decisions: Object.keys(draft).sort().map(function (k) { return draft[k]; })
    };
  }

  function summary() {
    var n = Object.keys(draft).length;
    var box = document.getElementById('rv-out');
    clear(box);
    box.appendChild(el('p', { text: n ? n + ' decision' + (n === 1 ? '' : 's') + ' drafted in this browser.' : 'No decisions drafted yet.' }));
    if (!n) return;
    var doc = decisionFile();
    var json = JSON.stringify(doc, null, 1);
    var name = doc.decided_at.replace(/[:]/g, '').replace(/Z$/, '') + '.json';
    var gh = REPO_NEW + '?filename=' + encodeURIComponent(name) + '&value=' + encodeURIComponent(json);
    var blob = URL.createObjectURL(new Blob([json + '\n'], { type: 'application/json' }));
    box.appendChild(el('div', { cls: 'rv-actions' }, [
      gh.length < 7500
        ? el('a', { cls: 'rv-btn rv-approve', href: gh, target: '_blank', rel: 'noopener', text: 'Commit decisions on GitHub ↗' })
        : el('span', { cls: 'rv-muted', text: 'Too many decisions for a GitHub link; download the file instead.' }),
      el('a', { cls: 'rv-btn', href: blob, download: name, text: 'Download ' + name }),
      el('button', { type: 'button', cls: 'rv-btn', text: 'Clear draft', onclick: function () {
        if (window.confirm('Discard ' + n + ' drafted decisions?')) { draft = {}; saveDraft(); render(); }
      } })
    ]));
    box.appendChild(el('details', null, [el('summary', { text: 'Show the decision file' }), el('pre', { text: json })]));
  }

  document.getElementById('rv-band').addEventListener('change', render);
  document.getElementById('rv-who').addEventListener('input', summary);
})();
