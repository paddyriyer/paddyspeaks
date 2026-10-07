/* Interview discovery review — /admin/interview-discovery/
 *
 * This page cannot change the site. It reads the review queue the pipeline
 * publishes (queue.json), lets a reviewer decide reports one at a time or in
 * bulk, keeps the draft in this browser, and turns the decisions into a
 * decision file. The file reaches the repo as a commit (GitHub's "new file"
 * page, or a download), and interviewintel/pipeline/review.py applies it on
 * the next run. The authority to publish is exactly the authority to commit.
 *
 * Two lists: reports waiting for review, and reports auto-approved (70+, no
 * flag, no possible duplicate) that are already live and can be unpublished.
 * A report with a drafted decision is locked: its action buttons are
 * disabled until it is undone.
 *
 * Everything from the queue is set with textContent: source text never
 * becomes HTML.
 */
(function () {
  'use strict';

  var DRAFT = 'ps-intel-review-draft';
  var REPO_NEW = 'https://github.com/paddyriyer/paddyspeaks/new/main/interviewintel/decisions';
  var STRONG = 70;
  var LABEL = { approve: 'Approved', reject: 'Rejected', merge: 'Merged' };
  var queue = null;
  var draft = readDraft();
  var selected = {};              // report id -> true (not stored)
  var view = 'pending';           // 'pending' | 'auto'

  function $(id) { return document.getElementById(id); }
  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    for (var k in (attrs || {})) {
      if (attrs[k] == null || attrs[k] === false) continue;
      if (k === 'text') n.textContent = attrs[k];
      else if (k === 'cls') n.className = attrs[k];
      else if (k.indexOf('on') === 0) n.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] === true) n.setAttribute(k, '');
      else n.setAttribute(k, attrs[k]);
    }
    (kids || []).forEach(function (c) { if (c != null && c !== false) n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return n;
  }
  function clear(n) { while (n.firstChild) n.removeChild(n.firstChild); }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); }
  function readDraft() {
    try { return JSON.parse(localStorage.getItem(DRAFT) || '{}') || {}; } catch (e) { return {}; }
  }
  function saveDraft() { try { localStorage.setItem(DRAFT, JSON.stringify(draft)); } catch (e) { /* private mode */ } }

  // A fresh URL every load: the CDN in front of GitHub Pages may otherwise serve
  // a queue from before the last run for up to ten minutes.
  fetch('queue.json?t=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (q) {
    queue = q;
    // Forget decisions the queue no longer needs: reports that have left the
    // list (applied by a run), and committed approvals of reports that are
    // already live.
    var pending = {}, live = {};
    (q.pending || []).forEach(function (r) { pending[r.id] = true; });
    (q.auto_approved || []).forEach(function (r) { live[r.id] = true; });
    Object.keys(draft).forEach(function (id) {
      var d = draft[id];
      if (!pending[id] && !live[id]) delete draft[id];
      else if (d.sent && !pending[id] && d.action !== 'reject') delete draft[id];
    });
    saveDraft();
    health();
    render();
  }).catch(function () {
    $('rv-list').appendChild(el('p', { cls: 'rv-empty', text: 'queue.json could not be loaded.' }));
  });

  function health() {
    var h = queue.health || {};
    var d = h.discovery || {};
    var u = h.model_usage;
    var bits = ['Last run ' + (h.run_date || 'never') + (h.mode ? ' (' + h.mode + ')' : '')];
    if (d.results != null) bits.push(plural(d.results, 'item') + ' read from ' + plural(d.sources_ok || 0, 'source'));
    if (d.reports_queued != null) bits.push(plural(d.reports_queued, 'report') + ' found');
    if (u) bits.push(plural(u.calls, 'model call') + ' (' + u.input_tokens + ' in / ' + u.output_tokens + ' out tokens)');
    bits.push('auto-approval at ' + (queue.auto_threshold == null ? 'off' : queue.auto_threshold + '+'));
    $('rv-health').textContent = bits.join(' · ');
  }

  /* ------------------------------ list ------------------------------ */
  function source() { return view === 'auto' ? (queue.auto_approved || []) : (queue.pending || []); }

  function shown() {
    var band = $('rv-band').value, state = $('rv-state').value;
    return source().filter(function (r) {
      if (band && r.band !== band) return false;
      if (state === 'open' && draft[r.id]) return false;
      if (state === 'drafted' && !draft[r.id]) return false;
      return true;
    });
  }

  function render() {
    if (!queue) return;
    var pend = (queue.pending || []).length, auto = (queue.auto_approved || []).length;
    $('rv-tab-pending').textContent = 'Waiting for review · ' + pend;
    $('rv-tab-auto').textContent = 'Auto-approved, live · ' + auto;
    $('rv-tab-pending').setAttribute('aria-selected', String(view === 'pending'));
    $('rv-tab-auto').setAttribute('aria-selected', String(view === 'auto'));
    $('rv-bulk-approve').hidden = view === 'auto';
    $('rv-sel-strong').hidden = view === 'auto';
    $('rv-bulk-reject').textContent = view === 'auto' ? 'Unpublish selected' : 'Reject selected';

    var list = $('rv-list');
    clear(list);
    var items = shown();
    if (!items.length) {
      list.appendChild(el('p', { cls: 'rv-empty', text: source().length
        ? 'No report matches these filters.'
        : view === 'auto'
          ? 'Nothing has been auto-approved yet. Reports scoring ' + (queue.auto_threshold || STRONG) +
            '+ with no flag and no possible duplicate are approved on the next run.'
          : 'Nothing is waiting for review.' }));
    }
    items.forEach(function (r) { list.appendChild(card(r)); });
    selection();
    tray();
  }

  /* ---------------------------- selection ---------------------------- */
  function selection() {
    var items = shown();
    var picked = items.filter(function (r) { return selected[r.id]; });
    var open = picked.filter(function (r) { return !draft[r.id]; }).length;
    var done = picked.length - open;
    var all = $('rv-sel-all');
    all.checked = items.length > 0 && picked.length === items.length;
    all.indeterminate = picked.length > 0 && picked.length < items.length;
    all.disabled = !items.length;
    $('rv-selcount').textContent = picked.length ? plural(picked.length, 'selected', 'selected') : 'None selected';
    $('rv-bulk-approve').disabled = !open;
    $('rv-bulk-reject').disabled = !open;
    $('rv-bulk-undo').disabled = !done;
    $('rv-bulk-approve').textContent = 'Approve' + (open ? ' ' + open : '');
    $('rv-bulk-reject').textContent = (view === 'auto' ? 'Unpublish' : 'Reject') + (open ? ' ' + open : '');
    $('rv-bulk-undo').textContent = 'Undo' + (done ? ' ' + done : '');
  }

  function selectWhere(test) {
    selected = {};
    shown().forEach(function (r) { if (test(r)) selected[r.id] = true; });
    render();
  }

  function bulk(action) {
    shown().forEach(function (r) {
      if (!selected[r.id]) return;
      if (action === 'undo') { if (draft[r.id] && !draft[r.id].sent) delete draft[r.id]; return; }
      if (draft[r.id]) return;                       // decided reports are locked
      var out = { report: r.id, action: action };
      if (view === 'auto') out.note = 'unpublished after auto-approval';
      draft[r.id] = out;
    });
    selected = {};
    saveDraft();
    render();
  }

  /* ------------------------------ cards ------------------------------ */
  function chip(text, kind, title) { return el('span', { cls: 'rv-chip' + (kind ? ' rv-' + kind : ''), text: text, title: title }); }

  function card(r) {
    var auto = view === 'auto';
    var c = auto ? { title: r.title, question: r.question } : (r.canonical || {});
    var d = draft[r.id];
    var title = c.title || (r.proposed || {}).title || r.id;

    var cb = el('input', { type: 'checkbox', 'aria-label': 'Select: ' + title });
    cb.checked = !!selected[r.id];
    cb.addEventListener('change', function () {
      if (cb.checked) selected[r.id] = true; else delete selected[r.id];
      art.classList.toggle('rv-picked', cb.checked);
      selection();
    });

    var status = d
      ? chip((auto && d.action === 'reject' ? 'Unpublish' : LABEL[d.action]) + (d.sent ? ' · committed, applies on the next run' : ' · drafted'),
          d.action === 'approve' ? 'ok' : d.action === 'reject' ? 'bad' : 'info')
      : auto ? chip('Live', 'ok') : chip('Waiting', 'muted');

    var head = el('div', { cls: 'rv-head' }, [
      el('label', { cls: 'rv-check' }, [cb]),
      status,
      chip(r.confidence + ' · ' + r.band, 'band-' + r.band, 'AI confidence and band'),
      !auto && r.canonical && r.canonical.status === 'approved'
        ? chip('adds a source to a live question', 'info') : null
    ].concat((r.flags || []).map(function (f) { return chip(f.replace(/_/g, ' '), 'warn', 'Flag: needs a person'); })));

    var meta = el('p', { cls: 'rv-meta' }, [
      [r.company_name || 'Company unknown', r.role_name || 'role unknown', r.interview_stage].filter(Boolean).join(' · '),
      ' — ',
      el('a', { href: r.url, target: '_blank', rel: 'noopener noreferrer nofollow', text: (r.source_title || 'source') + ' ↗' }),
      r.source_date ? ' · ' + r.source_date : ''
    ]);

    var art = el('article', { cls: 'rv-card' + (d ? ' rv-done rv-done-' + d.action : '') + (selected[r.id] ? ' rv-picked' : ''), id: r.id }, [
      head,
      el('h2', { text: title }),
      el('p', { cls: 'rv-q', text: c.question || (r.proposed || {}).question || '' }),
      meta
    ]);
    if (!auto && c.question && r.proposed && c.question !== r.proposed.question) {
      art.appendChild(el('p', { cls: 'rv-muted', text: 'This report proposed: ' + r.proposed.question }));
    }

    var edit = auto ? null : editor(r, c);
    art.appendChild(actions(r, d, auto, edit));
    if (d && (d.note || d.edits || d.into)) art.appendChild(el('p', { cls: 'rv-muted', text: describe(d) }));
    if (edit) art.appendChild(edit);
    if (!auto) art.appendChild(details(r, c, d));
    return art;
  }

  function actions(r, d, auto, edit) {
    var locked = !!d;
    var undo = el('button', { type: 'button', cls: 'rv-btn', text: 'Undo', hidden: !locked || !!(d && d.sent),
      onclick: function () { delete draft[r.id]; saveDraft(); render(); } });
    if (auto) {
      return el('div', { cls: 'rv-actions' }, [
        el('button', { type: 'button', cls: 'rv-btn rv-reject', text: 'Unpublish', disabled: locked,
          onclick: function () { decide(r, { action: 'reject', note: 'unpublished after auto-approval' }); } }),
        undo]);
    }
    return el('div', { cls: 'rv-actions' }, [
      el('button', { type: 'button', cls: 'rv-btn rv-approve', text: 'Approve', disabled: locked,
        onclick: function () { decide(r, { action: 'approve' }); } }),
      el('button', { type: 'button', cls: 'rv-btn', text: 'Edit…', disabled: locked, 'aria-expanded': 'false',
        onclick: function (e) {
          var open = edit.hasAttribute('hidden');
          if (open) edit.removeAttribute('hidden'); else edit.setAttribute('hidden', '');
          e.currentTarget.setAttribute('aria-expanded', String(open));
          if (open) edit.querySelector('textarea').focus();
        } }),
      el('button', { type: 'button', cls: 'rv-btn rv-reject', text: 'Reject', disabled: locked,
        onclick: function () { decide(r, { action: 'reject' }); } }),
      undo
    ]);
  }

  function row(k, v, ev) {
    return el('tr', null, [el('th', { scope: 'row', text: k }),
      el('td', null, [v || 'Unknown', ev ? el('div', { cls: 'rv-ev', text: '“' + ev + '”' }) : null])]);
  }

  function details(r, c, d) {
    var body = el('div', { cls: 'rv-details' }, [
      el('table', { cls: 'rv-table' }, [el('tbody', null, [
        row('Question', r.asked_in_interview ? 'stated as asked in an interview' : 'stated in a list', r.evidence),
        row('Company', r.company_name, r.company_evidence),
        row('Role', r.role_name, r.role_evidence),
        row('Stage', r.interview_stage, r.stage_evidence),
        row('Category', [c.category, c.subcategory, c.difficulty].filter(Boolean).join(' · ')),
        row('Classifier', 'Class ' + r.classification['class'] + ' — ' + r.classification.reason),
        row('Confidence', (r.confidence_parts || []).join('; ')),
        row('Found', r.discovered + ' via ' + r.provider)
      ])])
    ]);
    if ((r.notes || []).length) {
      body.appendChild(el('h3', { text: 'Extraction notes' }));
      var nl = el('ul', { cls: 'rv-list-plain' });
      r.notes.forEach(function (n) { nl.appendChild(el('li', { text: n })); });
      body.appendChild(nl);
    }
    var dups = r.possible_duplicates || [];
    if (dups.length || (r.bank_matches || []).length) {
      body.appendChild(el('h3', { text: 'Possible duplicates' }));
      var dl = el('ul', { cls: 'rv-list-plain' });
      dups.forEach(function (p) {
        dl.appendChild(el('li', null, [
          el('strong', { text: Math.round(p.similarity * 100) + '% · ' + p.title }), ' — ' + p.question + ' ',
          el('button', { type: 'button', cls: 'rv-btn rv-small', text: 'Merge into this', disabled: !!d,
            onclick: function () { decide(r, { action: 'merge', into: p.id }); } })
        ]));
      });
      (r.bank_matches || []).forEach(function (b) {
        dl.appendChild(el('li', { text: 'Already in the Question Bank: ' + b.title + ' (' + b.id + ')' }));
      });
      body.appendChild(dl);
    }
    var sel = el('select', { 'aria-label': 'Merge into question', disabled: !!d }, [el('option', { value: '', text: 'Merge into another question…' })]);
    (queue.merge_targets || []).forEach(function (m) {
      if (m.id !== r.question_id) sel.appendChild(el('option', { value: m.id, text: m.title + ' (' + m.status + ')' }));
    });
    var note = el('input', { type: 'text', placeholder: 'Note for the record (optional)', 'aria-label': 'Decision note', disabled: !!d });
    body.appendChild(el('div', { cls: 'rv-actions' }, [
      sel,
      el('button', { type: 'button', cls: 'rv-btn', text: 'Merge', disabled: !!d,
        onclick: function () { if (sel.value) decide(r, { action: 'merge', into: sel.value, note: note.value }); else sel.focus(); } }),
      note,
      el('button', { type: 'button', cls: 'rv-btn rv-reject', text: 'Reject with note', disabled: !!d,
        onclick: function () { decide(r, { action: 'reject', note: note.value }); } })
    ]));
    return el('details', { cls: 'rv-more' }, [el('summary', { text: 'Evidence, scoring and more actions' }), body]);
  }

  function editor(r, c) {
    var f = el('form', { cls: 'rv-edit', hidden: true });
    function field(label, name, value, opts, wide) {
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
      f.appendChild(el('label', { cls: wide ? 'rv-wide' : null }, [label, input]));
    }
    var p = r.proposed || {};
    field('Practice question', 'question', c.question || p.question, null, true);
    field('Title', 'title', c.title || p.title, null, true);
    field('Category', 'category', c.category, queue.categories);
    field('Subcategory', 'subcategory', c.subcategory);
    field('Difficulty', 'difficulty', c.difficulty, queue.difficulties);
    field('Technology (comma-separated)', 'technology', (c.technology || []).join(', '));
    field('Company (empty = unknown)', 'company', r.company_name);
    field('Role (empty = unknown)', 'role', r.role_name);
    field('Interview stage', 'interview_stage', r.interview_stage, queue.stages);
    field('Interview year', 'interview_year', r.interview_year);
    f.appendChild(el('div', { cls: 'rv-actions rv-wide' }, [
      el('button', { type: 'submit', cls: 'rv-btn rv-approve', text: 'Approve with edits' }),
      el('button', { type: 'button', cls: 'rv-btn', text: 'Cancel', onclick: function () { f.setAttribute('hidden', ''); } })
    ]));
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var edits = {};
      var base = { question: c.question || p.question, title: c.title || p.title, category: c.category,
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
    var bits = [];
    if (d.into) bits.push('into ' + d.into);
    if (d.edits && Object.keys(d.edits).length) bits.push('edited: ' + Object.keys(d.edits).join(', '));
    if (d.note) bits.push('note: ' + d.note);
    return bits.join(' · ');
  }

  function decide(r, d) {
    if (draft[r.id]) return;                        // locked until undone
    var out = { report: r.id, action: d.action };
    if (d.into) out.into = d.into;
    if (d.edits && Object.keys(d.edits).length) out.edits = d.edits;
    if (d.note) out.note = d.note;
    draft[r.id] = out;
    delete selected[r.id];
    saveDraft();
    render();
  }

  /* ------------------------- the decision tray ------------------------- */
  function decisionFile() {
    var who = $('rv-who').value.trim() || 'reviewer';
    return {
      decided_by: who,
      decided_at: new Date().toISOString().replace(/\.\d+Z$/, 'Z'),
      decisions: unsent().map(function (k) {
        var d = draft[k], out = {};
        Object.keys(d).forEach(function (f) { if (f !== 'sent') out[f] = d[f]; });
        return out;
      })
    };
  }

  function unsent() { return Object.keys(draft).sort().filter(function (k) { return !draft[k].sent; }); }

  function markSent() {
    var at = new Date().toISOString();
    unsent().forEach(function (k) { draft[k].sent = at; });
    selected = {};
    saveDraft();
    render();
  }

  function tray() {
    var ids = unsent();
    var waiting = Object.keys(draft).length - ids.length;
    var counts = { approve: 0, reject: 0, merge: 0 };
    ids.forEach(function (k) { counts[draft[k].action] = (counts[draft[k].action] || 0) + 1; });
    var parts = [];
    if (counts.approve) parts.push(counts.approve + ' approve');
    if (counts.reject) parts.push(counts.reject + ' reject');
    if (counts.merge) parts.push(counts.merge + ' merge');
    $('rv-tray-text').textContent = ids.length
      ? plural(ids.length, 'decision') + ' drafted (' + parts.join(', ') + '). Nothing changes on the site until they are committed.'
      : waiting
        ? plural(waiting, 'committed decision') + ' will be applied by the next run (a few minutes after the commit). Reload this page then.'
        : 'No decisions drafted yet. Approve or reject reports above; they collect here.';
    var box = $('rv-tray-actions');
    clear(box);
    $('rv-tray').classList.toggle('rv-tray-live', ids.length > 0);
    if (!ids.length) return;
    var doc = decisionFile();
    var json = JSON.stringify(doc, null, 1);
    var name = doc.decided_at.replace(/[:]/g, '').replace(/Z$/, '') + '.json';
    var gh = REPO_NEW + '?filename=' + encodeURIComponent(name) + '&value=' + encodeURIComponent(json);
    var blob = URL.createObjectURL(new Blob([json + '\n'], { type: 'application/json' }));
    box.appendChild(gh.length < 7500
      ? el('a', { cls: 'rv-btn rv-primary', href: gh, target: '_blank', rel: 'noopener', onclick: markSent,
          text: 'Commit ' + plural(ids.length, 'decision') + ' on GitHub ↗' })
      : el('span', { cls: 'rv-muted', text: 'Too many for a GitHub link — download the file and commit it.' }));
    box.appendChild(el('a', { cls: 'rv-btn', href: blob, download: name, text: 'Download file', onclick: markSent }));
    box.appendChild(el('button', { type: 'button', cls: 'rv-btn', text: 'Clear all', onclick: function () {
      if (window.confirm('Discard ' + plural(ids.length, 'drafted decision') + '?')) {
        ids.forEach(function (k) { delete draft[k]; }); saveDraft(); render();
      }
    } }));
  }

  /* ------------------------------ wiring ------------------------------ */
  function setView(v) { view = v; selected = {}; render(); }
  $('rv-tab-pending').addEventListener('click', function () { setView('pending'); });
  $('rv-tab-auto').addEventListener('click', function () { setView('auto'); });
  $('rv-band').addEventListener('change', function () { selected = {}; render(); });
  $('rv-state').addEventListener('change', function () { selected = {}; render(); });
  $('rv-sel-all').addEventListener('change', function (e) {
    var on = e.target.checked;
    selectWhere(function () { return on; });
  });
  $('rv-sel-strong').addEventListener('click', function () {
    selectWhere(function (r) { return r.confidence >= STRONG && !draft[r.id]; });
  });
  $('rv-sel-open').addEventListener('click', function () { selectWhere(function (r) { return !draft[r.id]; }); });
  $('rv-sel-none').addEventListener('click', function () { selectWhere(function () { return false; }); });
  $('rv-bulk-approve').addEventListener('click', function () { bulk('approve'); });
  $('rv-bulk-reject').addEventListener('click', function () { bulk('reject'); });
  $('rv-bulk-undo').addEventListener('click', function () { bulk('undo'); });
  $('rv-who').addEventListener('input', tray);
})();
