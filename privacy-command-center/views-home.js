/* Views: the Command Center home, Promises and the Chain explorer.
 *
 * The home answers four questions, in order:
 *   1 · What promise is at risk?
 *   2 · Who or what is affected?
 *   3 · Which decision is owed, by whom and by when?
 *   4 · What evidence proves the problem is fixed?
 * The records are the same for every role. The perspective decides the order,
 * the words and the action offered on each item (model.js · P.priorities). */
(function () {
'use strict';
var P = window.PCC, NS = window.NS, esc = P.esc, chip = P.chip, fmtN = P.fmtN, unk = P.unk;
var V = P.views;

/* Which indicators each perspective sees first. Same metrics, different emphasis. */
var IND = {
  lead: ['promises', 'owed', 'highfind', 'incidents', 'consentfail', 'delfail'],
  own: ['owed', 'highfind', 'noowner', 'nottl', 'unmapped', 'retviol'],
  over: ['promises', 'paper', 'delfail', 'consentfail', 'undeclared', 'retviol'],
  build: ['runtime', 'paper', 'consentfail', 'delfail', 'unmapped', 'sdks']
};

function peopleLine(st) { return st.people ? 'Up to ' + fmtN(st.people) + ' ' + (st.subjects.join(', ') || 'people').toLowerCase() : unk('number of people unknown'); }
function dueHTML(dec) {
  if (!dec) return unk('no decision opened');
  if (!dec.due) return unk('no due date');
  return '<b>' + esc(P.hdate(dec.due)) + '</b> <span class="' + (dec.overdue ? 'bad' : 'dim') + '">(' + esc(P.rel(dec.due)) + ')</span>' +
    (dec.d.status === 'owed' ? ' · SLA ' + dec.slaDays + ' days' + (dec.slaBreached ? ' <span class="bad">breached</span>' : '') : '');
}
function optionRow(o, rec) {
  return '<tr' + (rec ? ' class="rec"' : '') + '><th scope="row">' + (rec ? '<span class="rec-tag">Recommended</span>' : '') + esc(o.id + ' · ' + o.title) + '</th>' +
    '<td><ul class="pc">' + o.pros.map(function (x) { return '<li class="pro">' + esc(x) + '</li>'; }).join('') + o.cons.map(function (x) { return '<li class="con">' + esc(x) + '</li>'; }).join('') + '</ul></td>' +
    '<td>' + esc(o.tradeoff) + '<div class="small dim">' + esc(o.privacy) + ' · ' + esc(o.product) + ' · ' + esc(o.cost) + '</div></td></tr>';
}
P.optionsTable = function (dec) {
  if (!dec) return '';
  return '<div class="tbl-wrap"><table class="tbl opts"><caption class="sr-only">Options for ' + esc(dec.d.id) + '</caption><thead><tr><th scope="col">Option</th><th scope="col">For and against</th><th scope="col">Trade-off · privacy · product · cost</th></tr></thead><tbody>' +
    optionRow(dec.rec, true) + dec.alts.map(function (o) { return optionRow(o, false); }).join('') + '</tbody></table></div>';
};
function failedEvidence(st) {
  var weak = st.tests.filter(function (t) { return t.weak; });
  if (!weak.length) return '<p class="small ok">Every control behind this promise passed its last test.</p>';
  return '<ul class="evl">' + weak.map(function (t) {
    return '<li><button class="linklike" data-ent="' + esc(t.control.id) + '">' + esc(t.control.name) + '</button> ' + P.lvl(t.control.level) +
      ' <span class="ev-r ev-' + t.result + '">' + (t.result === 'never' ? 'never tested' : t.result) + '</span> ' + P.freshTag(t.last) +
      '<div class="small dim">' + esc(t.evidence || 'no evidence recorded') + (t.exceptions.length ? ' · exceptions: ' + esc(t.exceptions.join('; ')) : '') + '</div></li>';
  }).join('') + '</ul>';
}
function chainChips(x, col, max) {
  var ids = P.chain(x.p.id).cols[col] || [];
  return ids.length ? ids.slice(0, max || 4).map(function (i) { return chip(i); }).join(' ') + (ids.length > (max || 4) ? ' <span class="dim small">+' + (ids.length - (max || 4)) + '</span>' : '') : '<span class="dim">—</span>';
}

/* One priority item: everything required to understand and act, progressively disclosed. */
P.priorityCard = function (x, i, pers) {
  var st = x.state, dec = x.dec, conseq = dec ? dec.d.consequence : (st.open[0] && st.open[0].human) || '';
  var owner = dec ? dec.d.owner : x.p.owner;
  return '<article class="pri pri-' + st.status.replace(' ', '-').toLowerCase() + '" aria-labelledby="pri-' + esc(x.p.id) + '">' +
    '<header class="pri-h"><span class="pri-n">' + (i + 1) + '</span>' + P.statusTag(st.status) +
      '<h3 id="pri-' + esc(x.p.id) + '" class="pri-t"><q>' + esc(x.p.text) + '</q></h3>' +
      '<p class="pri-where">Promised in: ' + esc(x.p.where) + ' · ' + chip(x.p.id, x.p.id) + '</p></header>' +
    '<p class="pri-c">' + esc(conseq) + '</p>' +
    '<dl class="pri-f">' +
      '<div><dt>People affected</dt><dd>' + peopleLine(st) + '</dd></div>' +
      '<div><dt>Products · systems</dt><dd>' + chainChips(x, 'product', 2) + ' · ' + chainChips(x, 'system', 2) + '</dd></div>' +
      '<div><dt>Accountable owner</dt><dd>' + P.ownerHTML(owner) + '</dd></div>' +
      '<div><dt>Decision due</dt><dd>' + dueHTML(dec) + '</dd></div>' +
      '<div class="wide"><dt>Residual risk</dt><dd>' + P.riskHTML(x.explain, { brief: true }) + '</dd></div>' +
    '</dl>' +
    '<div class="pri-act"><span class="act-v">' + esc(x.action.verb) + '</span> ' + esc(x.action.text) + '</div>' +
    '<details class="pri-more"><summary>Options, evidence and the full chain</summary>' +
      (dec ? '<h4>' + esc(dec.d.question) + '</h4><p><b>Recommended:</b> ' + esc(dec.d.recommendText) + '</p>' + P.optionsTable(dec) +
        (dec.d.dissent ? '<p class="small"><b>Dissent:</b> ' + esc(dec.d.dissent) + '</p>' : '') + (dec.d.uncertainty ? '<p class="small"><b>Uncertain:</b> ' + esc(dec.d.uncertainty) + '</p>' : '')
        : '<p>' + unk('No decision has been opened for this promise') + '</p>') +
      '<h4>Control or evidence that failed</h4>' + failedEvidence(st) +
      '<h4>Residual risk, explained</h4>' + P.riskHTML(x.explain) +
      '<h4>From promise to owner</h4>' + P.chainHTML(x.p.id) +
      '<div class="btn-row">' + (dec ? '<a class="btn" href="#/decisions/' + esc(dec.d.id) + '">Open the decision memo</a>' : '') + '<a class="btn" href="#/promises/' + esc(x.p.id) + '">Open the promise</a><button class="btn" data-act="investigate" data-id="' + esc(x.p.id) + '">Start an investigation here</button></div>' +
    '</details></article>';
};
P.acts.investigate = function (el) { var id = el.getAttribute('data-id'); P.pushTrail(id); P.go('chain?from=' + encodeURIComponent(id)); };

function affected(items) {
  var subj = {}, prods = [], sys = [], rec = [];
  items.forEach(function (x) {
    x.state.datasets.forEach(function (d) { var k = d.subjects || 'People'; subj[k] = Math.max(subj[k] || 0, d.people || 0); });
    var c = P.chain(x.p.id).cols; prods = prods.concat(c.product); sys = sys.concat(c.system); rec = rec.concat(c.recipient);
  });
  var rows = Object.keys(subj).sort(function (a, b) { return subj[b] - subj[a]; });
  return '<div class="aff"><div><h4>People, by relationship</h4><ul class="aff-l">' + rows.map(function (k) { return '<li><b>' + fmtN(subj[k]) + '</b> ' + esc(k.toLowerCase()) + '</li>'; }).join('') + '</ul>' +
    '<p class="small dim">Largest affected group per relationship. The same person can appear in several groups, so these are not added up.</p></div>' +
    '<div><h4>Products and features (' + P.uniq(prods).length + ')</h4><p>' + P.uniq(prods).map(function (i) { return chip(i); }).join(' ') + '</p>' +
    '<h4>Systems (' + P.uniq(sys).length + ')</h4><p>' + P.uniq(sys).slice(0, 12).map(function (i) { return chip(i); }).join(' ') + (P.uniq(sys).length > 12 ? ' <span class="dim small">+' + (P.uniq(sys).length - 12) + '</span>' : '') + '</p>' +
    '<h4>Vendors and models (' + P.uniq(rec).length + ')</h4><p>' + P.uniq(rec).map(function (i) { return chip(i); }).join(' ') + '</p></div></div>';
}
function decisionsTable() {
  var ds = P.decisionsSorted();
  return '<div class="tbl-wrap"><table class="tbl dec-t"><caption class="sr-only">Decisions and who owes them</caption><thead><tr><th scope="col">Decision</th><th scope="col">Stage</th><th scope="col">Owner · approver</th><th scope="col">Due</th><th scope="col">Recommended</th></tr></thead><tbody>' +
    ds.map(function (x) {
      return '<tr class="click" data-go="decisions/' + esc(x.d.id) + '" tabindex="0"><td><span class="mono small">' + esc(x.d.id) + '</span> ' + esc(x.d.question) + '</td>' +
        '<td><span class="stage stage-' + x.d.status + '">' + esc(P.STAGE_TEXT[x.d.status]) + '</span></td>' +
        '<td>' + P.ownerHTML(x.d.owner) + '<div class="small dim">approver: ' + esc(x.d.approver) + '</div></td>' +
        '<td>' + dueHTML(x) + '</td><td>' + esc(x.rec.id + ' · ' + x.rec.title) + '</td></tr>';
    }).join('') + '</tbody></table></div>';
}
function proofTable() {
  var ds = P.decisionsSorted();
  var kept = NS.promises.filter(function (p) { return P.promiseState(p).status === 'KEPT'; });
  return '<div class="tbl-wrap"><table class="tbl proof-t"><caption class="sr-only">How each fix will be proven</caption><thead><tr><th scope="col">Decision</th><th scope="col">The test that proves the fix</th><th scope="col">Today</th><th scope="col">Evidence</th></tr></thead><tbody>' +
    ds.map(function (x) {
      var t = x.test;
      return '<tr><td><a href="#/decisions/' + esc(x.d.id) + '" class="mono small">' + esc(x.d.id) + '</a></td><td>' + esc(x.d.test.text) + '<div class="small dim">via ' + chip(x.d.test.control) + '</div></td>' +
        '<td><span class="ev-r ev-' + esc(x.d.testResult) + '">' + esc(x.d.testResult === 'pending' ? 'not yet proven' : x.d.testResult === 'fail' ? 'failing' : x.d.testResult === 'unknown' ? 'cannot be run yet' : x.d.testResult) + '</span></td>' +
        '<td>' + (t ? P.freshTag(t.last, 'Last test') + '<div class="small dim">next: ' + esc(t.next ? P.hdate(t.next) : 'not scheduled') + '</div>' : unk('no control')) + '</td></tr>';
    }).join('') + '</tbody></table></div>' +
    (kept.length ? '<h4 style="margin-top:14px">Promises kept, and the proof</h4><ul class="kept">' + kept.map(function (p) { var st = P.promiseState(p); return '<li>' + P.statusTag('KEPT') + ' <q>' + esc(p.text) + '</q> — ' + st.tests.map(function (t) { return chip(t.control.id) + ' ' + P.freshTag(t.last); }).join(' ') + '</li>'; }).join('') + '</ul>' : '');
}

/* ── the home ─────────────────────────────────────────────────── */
P.homeV2 = function (persona) {
  var pid = persona ? persona.id : 'cpo', pers = persona ? P.perspectiveOf(persona.id) : null;
  var items = P.priorities(pid, P.state.team);
  var all = NS.promises.length, broken = items.filter(function (x) { return x.state.status === 'BROKEN'; }).length;
  var owed = NS.decisions.filter(function (d) { return d.status === 'owed'; });
  var late = owed.filter(function (d) { return P.decision(d).overdue; }).length;
  var weakEv = NS.controls.filter(function (c) { return P.controlTest(c.id).weak; }).length;
  var q = persona ? persona.q : 'Where are we breaking a promise to people — and which decision is owed?';
  var who = persona ? '<div class="hm-who"><span>Viewing as <b>' + esc(persona.name) + '</b> · ' + esc(pers.name) + '</span><span class="dim">You can ' + esc(pers.can) + '. Evidence shown first: ' + esc(pers.evidence) + '.</span><button class="chip" data-act="changePersona">Change role</button></div>'
    : '<div class="hm-who"><span>Viewing as <b>everyone</b></span><span class="dim">Pick a role to rank these by the decisions you can make.</span><button class="chip" data-act="changePersona">Choose a role</button></div>';
  var team = persona && persona.team ? '<label class="small muted hm-team">Your team <select id="teamSel">' + NS.teams.filter(function (x) { return x.id !== 't_privacy'; }).map(function (x) { return '<option value="' + x.id + '"' + (x.id === P.state.team ? ' selected' : '') + '>' + esc(x.name) + '</option>'; }).join('') + '</select></label>' : '';
  var shown = items.slice(0, persona ? 4 : 5), rest = items.slice(shown.length);
  var set = IND[pers ? pers.id : 'lead'];
  return '<section class="hm-hero">' + who +
      '<p class="eyebrow">Northstar · synthetic demo data · ' + esc(P.hdate(NS.TODAY)) + '</p>' +
      '<h1 class="hm-q">' + esc(q) + '</h1>' +
      '<p class="hm-a"><b>' + items.length + ' of ' + all + ' promises</b> are not demonstrably kept — ' + broken + ' broken. <b>' + owed.length + ' decisions are owed</b>' + (late ? ', ' + late + ' past due' : '') + '. ' + weakEv + ' of ' + NS.controls.length + ' controls have failing, stale or no evidence.</p>' + team +
      '<nav class="hm-jump" aria-label="The four questions"><a href="#q1">1 · Promise at risk</a><a href="#q2">2 · Who is affected</a><a href="#q3">3 · Decision owed</a><a href="#q4">4 · Proof of the fix</a></nav>' +
    '</section>' +
    '<section class="hm-sec" aria-labelledby="q1"><h2 id="q1" class="hm-h"><span>1</span> What promise is at risk?</h2>' +
      (pers ? '<p class="hm-lens">Ordered for ' + esc(pers.name.toLowerCase()) + ': ' + esc({ lead: 'most people and broken promises first; decisions you approve rise to the top.', own: 'your team’s items and unowned items first, then by due date.', over: 'weakest evidence first — what you would have to challenge before attesting.', build: 'failing controls and tests first — what you can fix and prove.' }[pers.id]) + '</p>' : '') +
      shown.map(function (x, i) { return P.priorityCard(x, i, pers); }).join('') +
      (rest.length ? '<details class="hm-rest"><summary>' + rest.length + ' more promise' + (rest.length > 1 ? 's' : '') + ' at risk or unproven</summary>' + rest.map(function (x, i) { return P.priorityCard(x, i + shown.length, pers); }).join('') + '</details>' : '') +
    '</section>' +
    '<section class="hm-sec" aria-labelledby="q2"><h2 id="q2" class="hm-h"><span>2</span> Who or what is affected?</h2>' + affected(items) + '</section>' +
    '<section class="hm-sec" aria-labelledby="q3"><h2 id="q3" class="hm-h"><span>3</span> Which decision is owed, by whom, by when?</h2>' + decisionsTable() + '</section>' +
    '<section class="hm-sec" aria-labelledby="q4"><h2 id="q4" class="hm-h"><span>4</span> What evidence proves the fix?</h2>' + proofTable() + '</section>' +
    '<section class="hm-sec" aria-labelledby="qi"><h2 id="qi" class="hm-h hm-h-sm">Indicators' + (pers ? ' for ' + esc(pers.name.toLowerCase()) : '') + '</h2><p class="small dim">Each shows its trend, what it is out of, the target, how much of the estate its detector can see, and who owns it. Open one for the records behind it.</p>' +
      '<div class="inds">' + set.map(function (id) { return P.indicatorHTML(id); }).join('') + '</div></section>' +
    '<details class="ph-more"><summary>Everything else — risk radar, worry map, north-star questions, drift and every indicator</summary><div class="ph-more-b" id="classicOverview"></div></details>';
};
P.homeMount = function (root) {
  var ts = root.querySelector('#teamSel'); if (ts) ts.addEventListener('change', function () { P.state.team = ts.value; P._keepScroll = true; P.render(); });
  var d = root.querySelector('.ph-more'); if (d) d.addEventListener('toggle', function () {
    if (!d.open) return; var box = root.querySelector('#classicOverview'); if (box && !box.innerHTML) { box.innerHTML = P.fullOverview.render(); if (P.fullOverview.mount) P.fullOverview.mount(box); }
  });
};

/* ── Promises ─────────────────────────────────────────────────── */
V['promises'] = { title: 'Promises', render: function () {
  var rows = NS.promises.map(function (p) { return { p: p, st: P.promiseState(p) }; }).sort(function (a, b) { return ['BROKEN', 'AT RISK', 'UNPROVEN', 'KEPT'].indexOf(a.st.status) - ['BROKEN', 'AT RISK', 'UNPROVEN', 'KEPT'].indexOf(b.st.status); });
  var count = function (s) { return rows.filter(function (r) { return r.st.status === s; }).length; };
  return P.pageHead('Decide', 'Promises Northstar has made to people', 'Plain-language commitments, where they were made, and whether the systems keep them. A promise is <b>broken</b> when an open high finding or incident contradicts it, <b>at risk</b> with any other open finding or failing control, <b>unproven</b> when its controls are untested or stale, and <b>kept</b> only with fresh, passing evidence.') +
    '<div class="stat-row card" style="margin-bottom:14px">' + ['BROKEN', 'AT RISK', 'UNPROVEN', 'KEPT'].map(function (s) { return '<div class="stat"><div class="sv">' + count(s) + '</div><div class="sl">' + P.statusTag(s) + '</div></div>'; }).join('') + '</div>' +
    rows.map(function (r) {
      var dec = r.p.decision ? P.decision(P.get(r.p.decision).obj) : null;
      return '<article class="card prom" style="margin-bottom:10px"><div class="card-h"><div>' + P.statusTag(r.st.status) + ' <a class="mono small" href="#/promises/' + esc(r.p.id) + '">' + esc(r.p.id) + '</a></div><span class="sub">' + esc(r.p.where) + '</span></div>' +
        '<h2 class="prom-t"><a href="#/promises/' + esc(r.p.id) + '"><q>' + esc(r.p.text) + '</q></a></h2>' +
        '<p class="small">' + (r.st.why.length ? esc(r.st.why.slice(0, 2).map(function (w) { return w.text; }).join(' · ')) + (r.st.why.length > 2 ? ' · +' + (r.st.why.length - 2) + ' more' : '') : 'Every control passed a recent test.') + '</p>' +
        '<p class="small dim">Owner ' + P.ownerHTML(r.p.owner) + ' · ' + peopleLine(r.st) + (dec ? ' · decision ' + chip(dec.d.id, dec.d.id) + ' due ' + (dec.due ? esc(P.hdate(dec.due)) : 'unset') : '') + '</p></article>';
    }).join('');
} };
V['promises/:id'] = { title: 'Promise', render: function (s) {
  var id = s[1], e = P.get(id); if (!e || e.type !== 'promise') return P.pageHead('Decide', 'Promise not found', '') + '<p>' + unk('No promise with id ' + esc(id)) + '</p>';
  var p = e.obj, st = P.promiseState(p), dec = p.decision ? P.decision(P.get(p.decision).obj) : null, risk = p.risk ? P.get(p.risk).obj : null;
  P.pushTrail(id);
  return P.pageHead('Promise · ' + p.id, '“' + p.text + '”', 'Promised in ' + esc(p.where) + ' to ' + esc(p.audience.toLowerCase()) + '.', P.statusTag(st.status)) +
    '<div class="grid g-main"><div>' +
      '<div class="card" style="margin-bottom:12px"><div class="card-h"><h2 class="sec">Why it is ' + esc(P.STATUS_TEXT[st.status].toLowerCase()) + '</h2></div>' +
        (st.why.length ? '<ul class="why-l">' + st.why.map(function (w) { return '<li><span class="tag">' + esc(w.kind) + '</span> ' + chip(w.id, w.id) + ' ' + esc(w.text) + '</li>'; }).join('') + '</ul>' : '<p class="ok">Every control behind this promise passed a test in the last 30 days.</p>') + '</div>' +
      '<div class="card" style="margin-bottom:12px"><div class="card-h"><h2 class="sec">Residual risk</h2></div>' + P.riskHTML(P.explainRisk(risk, p)) + '</div>' +
      '<div class="card" style="margin-bottom:12px"><div class="card-h"><h2 class="sec">Controls that keep it, and their evidence</h2></div>' +
        '<div class="tbl-wrap"><table class="tbl"><thead><tr><th scope="col">Control</th><th scope="col">Level</th><th scope="col">Last test</th><th scope="col">Evidence</th><th scope="col">Next</th></tr></thead><tbody>' +
        st.tests.map(function (t) { return '<tr class="click" data-ent="' + esc(t.control.id) + '" tabindex="0"><td>' + esc(t.control.name) + '<div class="small dim">' + esc(t.method || '') + '</div></td><td>' + P.lvl(t.control.level) + '</td><td><span class="ev-r ev-' + t.result + '">' + (t.result === 'never' ? 'never tested' : t.result) + '</span> ' + P.freshTag(t.last) + '</td><td class="small">' + esc(t.evidence || '') + (t.exceptions.length ? '<div class="dim">exceptions: ' + esc(t.exceptions.join('; ')) + '</div>' : '') + '</td><td class="small">' + esc(t.next ? P.hdate(t.next) : '—') + '</td></tr>'; }).join('') + '</tbody></table></div></div>' +
    '</div><div>' +
      '<div class="card" style="margin-bottom:12px"><div class="card-h"><h2 class="sec">Decision</h2></div>' + (dec ? '<p><a href="#/decisions/' + esc(dec.d.id) + '"><b>' + esc(dec.d.id) + '</b> ' + esc(dec.d.question) + '</a></p><p class="small">' + esc(P.STAGE_TEXT[dec.d.status]) + ' · owner ' + P.ownerHTML(dec.d.owner) + ' · due ' + dueHTML(dec) + '</p><p class="small"><b>Recommended:</b> ' + esc(dec.d.recommendText) + '</p>' : '<p>' + unk('No decision opened') + '</p>') + '</div>' +
      '<div class="card"><div class="card-h"><h2 class="sec">Who it reaches</h2></div><p>' + peopleLine(st) + '</p><p class="small">' + st.datasets.map(function (d) { return chip(d.id); }).join(' ') + '</p></div>' +
    '</div></div>' +
    '<div class="card" style="margin-top:12px"><div class="card-h"><h2 class="sec">From promise to owner</h2><a class="sub" href="#/chain?from=' + esc(id) + '">open in the chain explorer →</a></div>' + P.chainHTML(id, { max: 4, link: false }) + '</div>';
} };

/* ── Chain explorer ───────────────────────────────────────────── */
var STARTS = [['Promise', function () { return NS.promises.map(function (p) { return p.id; }); }], ['Person or identity', function () { return NS.identifiers.map(function (i) { return i.id; }); }],
  ['System', function () { return NS.systems.map(function (s) { return s.id; }); }], ['Vendor', function () { return NS.vendors.map(function (v) { return v.id; }); }],
  ['Product or feature', function () { return NS.products.map(function (p) { return p.id; }).concat(NS.features.map(function (f) { return f.id; })); }],
  ['Risk', function () { return NS.risks.map(function (r) { return r.id; }); }], ['Model', function () { return NS.models.map(function (m) { return m.id; }); }],
  ['Consent consumer', function () { return NS.consentConsumers.map(function (c) { return c.id; }); }]];
V['chain'] = { title: 'Chain explorer', render: function (s, q) {
  var from = q.from && P.get(q.from) ? q.from : 'PR-LOC';
  var ch = P.chain(from);
  var sel = '<form class="chain-pick" onsubmit="return false"><label for="chainFrom">Start from</label><select id="chainFrom">' + STARTS.map(function (g) { return '<optgroup label="' + esc(g[0]) + '">' + g[1]().map(function (id) { return '<option value="' + esc(id) + '"' + (id === from ? ' selected' : '') + '>' + esc(P.shortName(id) === id ? id : id + ' · ' + P.shortName(id)) + '</option>'; }).join('') + '</optgroup>'; }).join('') + '</select></form>';
  var cols = P.CHAIN.map(function (c) {
    var ids = ch.cols[c[0]];
    return '<section class="chx-col"><h2 class="chx-h">' + esc(c[1]) + ' <span>' + ids.length + '</span></h2>' + (ids.length ? '<ul>' + ids.map(function (x) {
      if (c[0] === 'evidence') { var t = P.controlTest(x); return '<li><button class="linklike" data-ent="' + esc(x) + '">' + esc(t.evidence || 'no evidence') + '</button> <span class="ev-r ev-' + t.result + '">' + (t.result === 'never' ? 'never tested' : t.result) + '</span> ' + P.freshTag(t.last) + '</li>'; }
      return '<li><button class="linklike" data-ent="' + esc(x) + '">' + esc(P.shortName(x) === x && P.get(x).type !== 'finding' && P.get(x).type !== 'decision' && P.get(x).type !== 'promise' ? P.name(x) : (P.get(x).type === 'promise' ? x + ' · ' + P.name(x) : P.name(x))) + '</button>' + (c[0] === 'finding' ? ' ' + P.sev(P.get(x).obj.sev) : '') + '</li>';
    }).join('') + '</ul>' : '<p class="small">' + (['owner', 'decision', 'evidence', 'promise'].indexOf(c[0]) >= 0 ? unk('none — a gap in the chain') : '<span class="dim">none</span>') + '</p>') + '</section>';
  }).join('');
  P.pushTrail(from);
  return P.pageHead('Investigate', 'Chain explorer', 'Start anywhere — a promise, a person’s identifier, a system, a vendor, a product, a risk or a consent consumer — and follow the complete chain from promise to owner. Every item opens its record; empty links in the chain are findings.', sel) +
    '<p class="small">Starting from ' + P.chip(from) + ' · ' + P.cite([from], 'Anchor') + '</p>' +
    '<div class="chx" role="list">' + cols + '</div>';
}, mount: function (root) {
  var s = root.querySelector('#chainFrom'); if (s) s.addEventListener('change', function () { P.go('chain?from=' + encodeURIComponent(s.value)); });
} };
})();

/* ── passports for the operating layer ────────────────────────── */
(function () {
var P = window.PCC, esc = P.esc, chip = P.chip, unk = P.unk;
function head(type, title, sub) { return '<p class="pp-type">' + esc(type) + '</p><h2 class="pp-title">' + esc(title) + '</h2>' + (sub ? '<p class="muted small" style="margin:0">' + sub + '</p>' : ''); }
P.passports.promise = function (p) {
  var st = P.promiseState(p);
  return head('Promise · ' + p.id, '“' + p.text + '”', esc(p.where)) + '<p style="margin:10px 0">' + P.statusTag(st.status) + ' ' + (st.people ? 'up to ' + P.fmtN(st.people) + ' ' + esc((st.subjects[0] || 'people').toLowerCase()) : '') + '</p>' +
    (st.why.length ? '<ul class="why-l">' + st.why.slice(0, 6).map(function (w) { return '<li>' + chip(w.id, w.id) + ' ' + esc(w.text) + '</li>'; }).join('') + '</ul>' : '<p class="ok small">Every control passed a recent test.</p>') +
    '<div class="btn-row"><a class="btn" href="#/promises/' + esc(p.id) + '">Open the promise</a>' + (p.decision ? '<a class="btn" href="#/decisions/' + esc(p.decision) + '">Open decision ' + esc(p.decision) + '</a>' : '') + '</div>';
};
P.passports.decision = function (d) {
  var x = P.decision(d);
  return head('Decision · ' + d.id, d.question, esc(P.STAGE_TEXT[d.status])) +
    '<dl class="kv"><dt>Promise</dt><dd>' + chip(d.promise) + '</dd><dt>Owner</dt><dd>' + P.ownerHTML(d.owner) + '</dd><dt>Approver</dt><dd>' + esc(d.approver) + '</dd><dt>Due</dt><dd>' + (x.due ? esc(P.hdate(x.due)) + ' (' + esc(P.rel(x.due)) + ')' : unk('not set')) + '</dd>' +
    '<dt>Recommended</dt><dd>' + esc(x.rec.id + ' · ' + x.rec.title) + '</dd><dt>Proven when</dt><dd>' + esc(d.test.text) + '</dd></dl>' +
    '<div class="btn-row"><a class="btn" href="#/decisions/' + esc(d.id) + '">Open the decision memo</a></div>';
};
})();
