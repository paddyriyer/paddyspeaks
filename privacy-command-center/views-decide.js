/* Views: DECIDE & REPORT.
 *
 *   #/decisions               the decision register (stage, promise, owner, approver, due + SLA,
 *                             recommendation, follow-up test), filterable by stage and owner
 *   #/decisions/:id           the decision memo — eight fixed sections, and "Record the decision"
 *   #/decisions/new?t=…       a draft memo pre-filled from an investigation trail (not a decision)
 *   #/report/executive        the same memo, with a picker (old ?r=risk / ?f=finding links still work)
 *   #/report/investigation?t= the trail as an auditable report: every step, why it matters, what it cites
 *
 * Also owns printing for the whole app: a print-only header and footer line
 * (generation date + synthetic-data disclaimer) and opening every <details>
 * while printing. Styles: pcc-decide.css (screen) and pcc-print.css (print).
 *
 * Nothing here types a number: counts, dates and SLAs come from the records
 * (data-ops.js) through model.js. Recording a decision changes the in-memory
 * record only (P.state.decisionLog keeps what it replaced); nothing is stored. */
(function () {
'use strict';
var P = window.PCC, NS = window.NS, esc = P.esc, chip = P.chip, fmtN = P.fmtN, unk = P.unk;
var V = P.views;

/* ── UI config ───────────────────────────────────────────────── */
var STAGES = ['owed', 'decided', 'verifying', 'closed'];
var STAGE_SHORT = { owed: 'Owed', decided: 'Decided', verifying: 'Verifying', closed: 'Closed' };
/* Which approver title each leadership persona holds. */
var APPROVER = { cpo: 'CPO', ciso: 'CISO', counsel: 'Privacy Counsel' };
var TEST_WORD = { pending: 'not yet proven', fail: 'failing', unknown: 'cannot be run yet', pass: 'passing' };
var SECTIONS = [['required', 'Decision required'], ['promise', 'Promise and people affected'], ['evidence', 'Evidence'], ['options', 'Options'],
  ['rec', 'Recommendation'], ['dissent', 'Dissent or uncertainty'], ['owner', 'Owner, approver and due date'], ['final', 'Final decision and follow-up test']];
/* A worked example for the empty investigation report: a real path through the records. */
var SAMPLE_TRAIL = ['PR-LOC', 'PRV-0201', 'd_lochist', 'c_retention_scan', 'D-101'];

function obj(id) { var e = P.get(id); return e ? e.obj : null; }
function typeOf(id) { var e = P.get(id); return e ? e.type : null; }
function when(iso) { return iso ? '<b>' + esc(P.hdate(iso)) + '</b> <span class="dim">(' + esc(P.rel(iso)) + ')</span>' : unk('no date'); }
function testWord(r) { return '<span class="ev-r ev-' + esc(r) + '">' + esc(TEST_WORD[r] || r) + '</span>'; }
function resultWord(t) { return '<span class="ev-r ev-' + esc(t.result) + '">' + esc(t.result === 'never' ? 'never tested' : t.result) + '</span>'; }
function stageTag(s) { return '<span class="stage stage-' + esc(s) + '">' + esc(P.STAGE_TEXT[s] || s) + '</span>'; }
function printBtn() { return '<button class="btn" data-act="printPage">Print / save as PDF</button>'; }
function sec(key, n, body, extra) {
  var t = SECTIONS.filter(function (s) { return s[0] === key; })[0][1];
  return '<section class="dm-sec" id="dm-' + key + '" aria-labelledby="dmh-' + key + '"' + (extra || '') + '><h2 class="dm-h" id="dmh-' + key + '"><span class="dm-n" aria-hidden="true">' + n + '</span>' + esc(t) + '</h2>' + body + '</section>';
}
function stepper(status) {
  var at = STAGES.indexOf(status);
  return '<ol class="dm-steps" aria-label="Decision stage">' + STAGES.map(function (s, i) {
    return '<li class="' + (i < at ? 'done' : i === at ? 'now' : '') + '"' + (i === at ? ' aria-current="step"' : '') + '><span>' + esc(STAGE_SHORT[s]) + '</span></li>';
  }).join('') + '</ol>';
}
P.acts.printPage = function () { window.print(); };

/* ── SLA wording ─────────────────────────────────────────────── */
function slaHTML(x) {
  var d = x.d;
  if (!x.slaDue) return unk('no SLA — the decision has no opening date');
  var base = x.slaDays + ' days for a ' + x.sev.toLowerCase() + '-severity decision, from ' + esc(P.hdate(d.opened)) + ' → ' + esc(P.hdate(x.slaDue));
  if (d.status === 'owed') return base + (x.slaBreached ? ' · <span class="bad"><b>breached</b> ' + esc(P.rel(x.slaDue)) + '</span>' : ' · <span class="ok">within SLA</span>, ' + esc(P.rel(x.slaDue)));
  if (d.final && d.final.on) return base + ' · decided ' + esc(P.hdate(d.final.on)) + (d.final.on <= x.slaDue ? ' <span class="ok">within SLA</span>' : ' <span class="bad">after the SLA</span>');
  return base;
}
function dueHTML(x) {
  if (!x.due) return unk('no due date');
  return when(x.due) + (x.overdue ? ' <span class="bad">overdue</span>' : '');
}

/* ── the register ────────────────────────────────────────────── */
function roleNote(all) {
  var per = P.persona ? P.perspectiveOf(P.persona.id) : null;
  if (!per) return '<p class="dr-note">Viewing as <b>everyone</b>. <button class="linklike" data-act="changePersona">Choose a role</button> to see which of these decisions are yours to make, schedule, challenge or prove.</p>';
  var ids, text;
  if (per.id === 'lead') {
    var title = APPROVER[P.persona.id];
    ids = all.filter(function (x) { return title ? x.d.approver === title : x.d.status === 'owed'; });
    text = title ? 'As ' + esc(P.persona.name) + ' you approve <b>' + ids.length + '</b> of these' + (ids.length ? '; ' + ids.filter(function (x) { return x.d.status === 'owed'; }).length + ' still wait for you' : '') + '.'
      : 'Leadership funds and accepts these trade-offs; the approver named on each row signs. <b>' + ids.length + '</b> are still owed.';
  } else if (per.id === 'own') {
    ids = all.filter(function (x) { return !x.d.owner || (P.state.team && x.d.owner === P.state.team); });
    text = 'Owners schedule the chosen option. <b>' + all.filter(function (x) { return !x.d.owner; }).length + '</b> ' + (all.filter(function (x) { return !x.d.owner; }).length === 1 ? 'decision has' : 'decisions have') + ' no owner — assign one first' + (P.state.team ? '; ' + all.filter(function (x) { return x.d.owner === P.state.team; }).length + ' belong to ' + esc(P.name(P.state.team)) : '') + '.';
  } else if (per.id === 'over') {
    ids = all.filter(function (x) { return x.test && x.test.weak; });
    text = 'Oversight challenges the proof. <b>' + ids.length + '</b> follow-up tests rest on failing, stale or missing evidence; do not attest to these yet.';
  } else {
    ids = all.filter(function (x) { return x.d.testResult !== 'pass'; });
    text = 'Builders make the follow-up test pass. <b>' + ids.length + '</b> tests are not passing today.';
  }
  return '<p class="dr-note"><span class="tag">' + esc(per.name) + '</span> ' + text + (ids.length ? ' ' + ids.map(function (x) { return '<a class="mono small" href="#/decisions/' + esc(x.d.id) + '">' + esc(x.d.id) + '</a>'; }).join(' ') : '') + '</p>';
}
V['decisions'] = { title: 'Decision register', render: function (s, q) {
  var all = P.decisionsSorted();
  var stage = STAGES.indexOf(q.stage) >= 0 ? q.stage : 'all';
  var owners = P.uniq(all.map(function (x) { return x.d.owner || '__none'; }));
  var owner = q.owner && owners.indexOf(q.owner) >= 0 ? q.owner : 'all';
  var rows = all.filter(function (x) { return (stage === 'all' || x.d.status === stage) && (owner === 'all' || (x.d.owner || '__none') === owner); });
  var link = function (st, ow) { var a = []; if (st !== 'all') a.push('stage=' + st); if (ow !== 'all') a.push('owner=' + encodeURIComponent(ow)); return 'decisions' + (a.length ? '?' + a.join('&') : ''); };
  var count = function (st) { return all.filter(function (x) { return st === 'all' || x.d.status === st; }).length; };
  var filters = '<div class="toolbar dr-filters"><div class="seg" role="group" aria-label="Filter by stage">' + ['all'].concat(STAGES).map(function (st) {
      return '<button data-go="' + esc(link(st, owner)) + '" aria-pressed="' + (st === stage) + '">' + esc(st === 'all' ? 'All' : STAGE_SHORT[st]) + ' <span class="dim">' + count(st) + '</span></button>'; }).join('') + '</div>' +
    '<label class="small muted dr-owner">Owner <select id="drOwner"><option value="all">Every owner</option>' + owners.map(function (o) { return '<option value="' + esc(o) + '"' + (o === owner ? ' selected' : '') + '>' + esc(o === '__none' ? 'No owner (unknown)' : P.name(o)) + '</option>'; }).join('') + '</select></label></div>';
  var body = rows.length ? '<div class="tbl-wrap dr-wrap"><table class="tbl dreg"><caption class="sr-only">Decisions, ' + esc(stage === 'all' ? 'every stage' : STAGE_SHORT[stage]) + ', ' + esc(owner === 'all' ? 'every owner' : owner === '__none' ? 'no owner' : P.name(owner)) + '</caption>' +
    '<thead><tr><th scope="col">Decision · promise</th><th scope="col">Stage</th><th scope="col">Owner · approver</th><th scope="col">Due · SLA</th><th scope="col">Recommended</th><th scope="col">Follow-up test</th></tr></thead><tbody>' +
    rows.map(function (x) {
      var d = x.d;
      return '<tr class="click" data-go="decisions/' + esc(d.id) + '" tabindex="0" aria-label="' + esc(d.id + ': ' + d.question) + '">' +
        '<td data-label="Decision"><span class="mono small">' + esc(d.id) + '</span> <span class="dr-q">' + esc(d.question) + '</span><div class="dr-p">' + (x.promise ? chip(d.promise, d.promise) + ' ' + P.statusTag(P.promiseState(x.promise).status) : unk('no promise')) + '</div></td>' +
        '<td data-label="Stage">' + stageTag(d.status) + (d.final ? '<div class="small dim">option ' + esc(d.final.option + (d.final.plus ? ' + ' + d.final.plus : '')) + ' · ' + esc(P.hdate(d.final.on)) + '</div>' : '') + '</td>' +
        '<td data-label="Owner · approver">' + P.ownerHTML(d.owner) + '<div class="small dim">approver: ' + esc(d.approver || '') + (d.approver ? '' : unk('none')) + '</div></td>' +
        '<td data-label="Due · SLA">' + dueHTML(x) + '<div class="small dim">SLA ' + x.slaDays + ' days' + (x.slaBreached ? ' · <span class="bad">breached</span>' : '') + '</div></td>' +
        '<td data-label="Recommended" class="dr-rec">' + (x.rec ? '<b>' + esc(x.rec.id) + '</b> ' + esc(x.rec.title) : unk('no recommendation')) + '</td>' +
        '<td data-label="Follow-up test">' + testWord(d.testResult) + (x.test ? '<div class="small">' + P.freshTag(x.test.last, 'Last test') + '</div>' : '<div>' + unk('no control') + '</div>') + '</td></tr>';
    }).join('') + '</tbody></table></div>'
    : '<div class="callout">No decision matches these filters. <a href="#/decisions">Show every decision</a>.</div>';
  var owed = all.filter(function (x) { return x.d.status === 'owed'; });
  return P.pageHead('Decide', 'Decision register', 'Every decision a broken promise requires, from <b>owed</b> to <b>decided</b>, <b>verifying</b> (the fix is being proven) and <b>closed</b>. Due dates come from the earliest open finding behind each decision; the SLA runs from the day it was opened and is tighter for higher-severity findings.') +
    '<p class="dr-sum"><b>' + owed.length + ' of ' + all.length + '</b> decisions are owed' + (owed.filter(function (x) { return x.overdue; }).length ? ', <b class="bad">' + owed.filter(function (x) { return x.overdue; }).length + ' past due</b>' : '') + (owed.filter(function (x) { return x.slaBreached; }).length ? ', ' + owed.filter(function (x) { return x.slaBreached; }).length + ' past their SLA' : '') + '. ' +
      all.filter(function (x) { return x.d.status === 'verifying'; }).length + ' are decided and waiting for their follow-up test to pass.</p>' +
    roleNote(all) + filters + '<p class="pcc-print-only small">Filter: ' + esc(stage === 'all' ? 'every stage' : STAGE_SHORT[stage]) + ' · ' + esc(owner === 'all' ? 'every owner' : owner === '__none' ? 'no owner' : P.name(owner)) + ' · ' + rows.length + ' of ' + all.length + ' decisions</p>' + body +
    P.cite(rows.map(function (x) { return x.d.id; }), 'Records');
}, mount: function (root, a, q) {
  var o = root.querySelector('#drOwner'); if (!o) return;
  o.addEventListener('change', function () { var st = STAGES.indexOf(q.stage) >= 0 ? 'stage=' + q.stage : ''; var ow = o.value === 'all' ? '' : 'owner=' + encodeURIComponent(o.value); var qs = [st, ow].filter(Boolean).join('&'); P.go('decisions' + (qs ? '?' + qs : '')); });
} };
/* ── the memo ────────────────────────────────────────────────── */
function findingsTable(ids, caption) {
  var fs = ids.map(obj).filter(Boolean);
  if (!fs.length) return '<p>' + unk('no findings recorded behind this decision') + '</p>';
  return '<div class="tbl-wrap"><table class="tbl dm-t"><caption class="sr-only">' + esc(caption) + '</caption><thead><tr><th scope="col">Finding</th><th scope="col">Severity</th><th scope="col">Status</th><th scope="col">People</th><th scope="col">Due</th><th scope="col">Owner</th></tr></thead><tbody>' +
    fs.map(function (f) {
      return '<tr><td data-label="Finding">' + chip(f.id, f.id) + ' ' + esc(f.title) + (f.human ? '<div class="small dim">' + esc(f.human) + '</div>' : '') + '</td><td data-label="Severity">' + P.sev(f.sev) + '</td><td data-label="Status">' + esc(f.status) + '</td>' +
        '<td data-label="People" class="num">' + (f.people ? fmtN(f.people) : unk('unknown')) + '</td><td data-label="Due">' + (f.due ? when(f.due) : unk('no due date')) + '</td><td data-label="Owner">' + P.ownerHTML(f.owner) + '</td></tr>';
    }).join('') + '</tbody></table></div>';
}
function controlsTable(cids, caption) {
  var ts = P.uniq(cids).filter(function (c) { return typeOf(c) === 'control'; }).map(P.controlTest);
  if (!ts.length) return '<p>' + unk('no control keeps this promise') + '</p>';
  var weak = ts.filter(function (t) { return t.weak; }), ok = ts.filter(function (t) { return !t.weak; });
  var row = function (t) {
    return '<tr><td data-label="Control">' + chip(t.control.id) + '<div class="small dim">' + esc(t.method || '') + '</div></td><td data-label="Level">' + P.lvl(t.control.level) + '</td>' +
      '<td data-label="Last test">' + resultWord(t) + ' ' + P.freshTag(t.last, 'Last test') + (t.last ? '<div class="small dim">' + esc(P.hdate(t.last)) + '</div>' : '') + '</td>' +
      '<td data-label="Evidence" class="small">' + (t.evidence ? esc(t.evidence) : unk('no evidence')) + (t.exceptions.length ? '<div class="dim">exceptions: ' + esc(t.exceptions.join('; ')) + '</div>' : '') + '</td>' +
      '<td data-label="Next test" class="small">' + (t.next ? esc(P.hdate(t.next)) : unk('not scheduled')) + '</td></tr>';
  };
  var table = function (list, cap) { return '<div class="tbl-wrap"><table class="tbl dm-t"><caption class="sr-only">' + esc(cap) + '</caption><thead><tr><th scope="col">Control</th><th scope="col">Level</th><th scope="col">Last test</th><th scope="col">Evidence</th><th scope="col">Next test</th></tr></thead><tbody>' + list.map(row).join('') + '</tbody></table></div>'; };
  return (weak.length ? '<h3 class="dm-sub">Failing, stale or untested (' + weak.length + ' of ' + ts.length + ')</h3>' + table(weak, caption + ': weak evidence') : '<p class="ok small">Every control behind it passed a recent test.</p>') +
    (ok.length ? '<details class="dm-more"><summary>Controls with current, passing evidence (' + ok.length + ')</summary>' + table(ok, caption + ': passing') + '</details>' : '');
}
function optionsHTML(x) {
  var opts = [x.rec].concat(x.alts).filter(Boolean);
  return '<div class="dm-opts">' + opts.map(function (o) {
    var rec = o === x.rec, chosen = x.d.final && (x.d.final.option === o.id || x.d.final.plus === o.id);
    return '<article class="dm-opt' + (rec ? ' rec' : '') + (chosen ? ' chosen' : '') + '" aria-labelledby="opt-' + esc(x.d.id + o.id) + '">' +
      '<h3 id="opt-' + esc(x.d.id + o.id) + '" class="dm-opt-t"><span class="dm-opt-id">' + esc(o.id) + '</span> ' + esc(o.title) + (rec ? ' <span class="rec-tag">Recommended</span>' : '') + (chosen ? ' <span class="chosen-tag">Chosen</span>' : '') + '</h3>' +
      '<dl class="dm-opt-f"><div><dt>Privacy reduction</dt><dd>' + esc(o.privacy) + '</dd></div><div><dt>Product impact</dt><dd>' + esc(o.product) + '</dd></div><div><dt>Cost</dt><dd>' + esc(o.cost) + '</dd></div></dl>' +
      '<div class="dm-pc"><div><h4>For</h4><ul class="pc">' + o.pros.map(function (t) { return '<li class="pro">' + esc(t) + '</li>'; }).join('') + '</ul></div>' +
      '<div><h4>Against</h4><ul class="pc">' + (o.cons.length ? o.cons.map(function (t) { return '<li class="con">' + esc(t) + '</li>'; }).join('') : '<li>' + unk('no downside recorded') + '</li>') + '</ul></div></div>' +
      '<p class="dm-trade"><b>Trade-off:</b> ' + esc(o.tradeoff) + '</p></article>';
  }).join('') + '</div>';
}
function personLine(promise) {
  var ids = P.chain(promise.id).cols.identity, hers = NS.person.identifiers.filter(function (i) { return ids.indexOf(i) >= 0; });
  return hers.length ? '<p class="small">One of them: ' + chip(NS.person.id) + ' — ' + esc(NS.person.note) + ' Her ' + hers.map(function (i) { return esc(P.name(i).toLowerCase()); }).join(', ') + ' ' + (hers.length > 1 ? 'are' : 'is') + ' in this chain.</p>' : '';
}
function peopleHTML(st) { return st.people ? 'Up to <b>' + fmtN(st.people) + '</b> ' + esc((st.subjects.join(', ') || 'people').toLowerCase()) : unk('number of people unknown'); }

P.memoHTML = function (d, opts) {
  opts = opts || {};
  var x = P.decision(d), pr = x.promise, st = pr ? P.promiseState(pr) : null, n = 0;
  var log = (P.state.decisionLog || {})[d.id];
  var controls = P.uniq((pr ? pr.controls || [] : []).concat(d.test ? [d.test.control] : []));
  var t = x.test;
  var next = d.status === 'decided' || d.status === 'verifying'
    ? '<div class="dm-next" id="dmNext" tabindex="-1"><p class="dm-next-k">Next thing to prove</p><p class="dm-next-t">' + esc(d.test.text) + '</p><p class="small">via ' + chip(d.test.control) + ' · today: ' + testWord(d.testResult) + (t ? ' · last test ' + P.freshTag(t.last, 'Last test') + ' · next test ' + (t.next ? esc(P.hdate(t.next)) : unk('not scheduled')) : '') + '</p></div>' : '';
  var h = '<article class="dm" aria-labelledby="dm-title" data-decision="' + esc(d.id) + '">' +
    '<header class="dm-head"><p class="eyebrow">Decision memo · ' + esc(d.id) + ' · Northstar (fictional) · synthetic demo data</p>' +
      '<h1 id="dm-title" class="dm-title">' + esc(d.question) + '</h1>' + stepper(d.status) +
      '<p class="dm-meta">' + stageTag(d.status) + ' · owner ' + P.ownerHTML(d.owner) + ' · approver ' + esc(d.approver || '') + (d.approver ? '' : unk('none')) + ' · due ' + dueHTML(x) + '</p>' +
      '<div class="btn-row dm-acts">' + printBtn() + (pr ? '<a class="btn" href="#/promises/' + esc(pr.id) + '">Open the promise</a>' : '') + '<a class="btn" href="#/decisions">All decisions</a></div></header>' + next +
    sec('required', ++n, '<p class="dm-lead">' + esc(d.question) + '</p><p>' + (d.status === 'owed' ? 'Owed by ' + P.ownerHTML(d.owner) + ', to be approved by <b>' + esc(d.approver) + '</b>, ' + (x.due ? 'by ' + when(x.due) : unk('with no due date')) + '.' : 'Decided — ' + esc(P.STAGE_TEXT[d.status]).toLowerCase() + '.') + '</p>' +
      '<p class="small dim">Opened ' + esc(P.hdate(d.opened)) + ' because promise ' + chip(d.promise, d.promise) + ' is ' + (st ? esc(P.STATUS_TEXT[st.status].toLowerCase()) : unk('unknown')) + '.</p>') +
    sec('promise', ++n, pr ? '<blockquote class="dm-quote"><q>' + esc(pr.text) + '</q><footer>Promised in ' + esc(pr.where) + ' · to ' + esc(pr.audience.toLowerCase()) + ' · ' + P.statusTag(st.status) + '</footer></blockquote>' +
      '<dl class="dm-kv"><div><dt>People affected</dt><dd>' + peopleHTML(st) + '<div class="small dim">The largest affected group; groups overlap, so they are not added up.</div></dd></div>' +
      '<div><dt>What it means for them</dt><dd>' + (d.consequence ? esc(d.consequence) : unk('consequence not described')) + '</dd></div>' +
      '<div><dt>Data involved</dt><dd>' + st.datasets.map(function (ds) { return chip(ds.id); }).join(' ') + '</dd></div></dl>' + personLine(pr)
      : '<p>' + unk('no published promise is linked to this decision') + '</p>') +
    sec('evidence', ++n, '<h3 class="dm-sub">Findings behind the decision</h3>' + findingsTable(d.findings, 'Findings behind ' + d.id) +
      (d.incidents && d.incidents.length ? '<p class="small">Incidents: ' + d.incidents.map(function (i) { return chip(i); }).join(' ') + '</p>' : '') +
      '<h3 class="dm-sub">Controls and their evidence</h3>' + controlsTable(controls, 'Controls behind ' + d.id) +
      '<h3 class="dm-sub">Residual risk today</h3>' + P.riskHTML(x.explain) +
      '<h3 class="dm-sub">From promise to owner</h3>' + P.chainHTML(d.id, { max: 3 }) +
      P.cite([d.promise].concat(d.findings, d.incidents || [], controls), 'Records behind this memo')) +
    sec('options', ++n, optionsHTML(x)) +
    sec('rec', ++n, x.rec ? '<p class="dm-lead"><span class="dm-opt-id">' + esc(x.rec.id) + '</span> ' + esc(x.rec.title) + '</p><p>' + esc(d.recommendText || '') + '</p>' +
      '<p class="small"><b>Why:</b> ' + esc(x.rec.pros.join('; ')) + '. <b>What it leaves open:</b> ' + (x.rec.cons.length ? esc(x.rec.cons.join('; ')) : unk('nothing recorded')) + '.</p>' : unk('no recommendation recorded')) +
    sec('dissent', ++n, '<dl class="dm-kv"><div><dt>Dissent</dt><dd>' + (d.dissent ? esc(d.dissent) : '<span class="dim">None recorded.</span>') + '</dd></div>' +
      '<div><dt>What we are unsure of</dt><dd>' + (d.uncertainty ? '<span class="unknown">' + esc(d.uncertainty) + '</span>' : '<span class="dim">Nothing material recorded.</span>') + '</dd></div>' +
      (x.explain.unknowns.length ? '<div><dt>Unknown inputs to the risk</dt><dd><ul class="dm-unk">' + x.explain.unknowns.map(function (u) { return '<li>' + unk(u) + '</li>'; }).join('') + '</ul></dd></div>' : '') + '</dl>') +
    sec('owner', ++n, '<dl class="dm-kv"><div><dt>Accountable owner</dt><dd>' + P.ownerHTML(d.owner) + (d.owner ? '' : ' <span class="small">— name one today; the SLA clock is already running.</span>') + '</dd></div>' +
      '<div><dt>Approver</dt><dd>' + (d.approver ? esc(d.approver) : unk('none named')) + '</dd></div>' +
      '<div><dt>Due</dt><dd>' + dueHTML(x) + '<div class="small dim">' + (d.due ? 'Set on the decision.' : 'From the earliest open finding behind it.') + '</div></dd></div>' +
      '<div><dt>SLA</dt><dd>' + slaHTML(x) + '</dd></div></dl>') +
    sec('final', ++n, finalHTML(d, x, log) +
      '<h3 class="dm-sub">Follow-up test — how the fix is proven</h3><p class="dm-lead">' + esc(d.test.text) + '</p>' +
      '<dl class="dm-kv"><div><dt>Result today</dt><dd>' + testWord(d.testResult) + '</dd></div>' +
      '<div><dt>Control</dt><dd>' + chip(d.test.control) + (t ? ' ' + P.lvl(t.control.level) : '') + '</dd></div>' +
      '<div><dt>Last test</dt><dd>' + (t ? resultWord(t) + ' ' + P.freshTag(t.last, 'Last test') + (t.last ? ' · ' + esc(P.hdate(t.last)) : '') + '<div class="small dim">' + esc(t.method || '') + (t.evidence ? ' — ' + esc(t.evidence) : '') + '</div>' : unk('no test recorded')) + '</dd></div>' +
      '<div><dt>Next test</dt><dd>' + (t && t.next ? when(t.next) : unk('not scheduled')) + '</dd></div></dl>' +
      P.cite([d.test.control, d.id], 'Proof records')) +
    '<footer class="dm-foot">Generated from the decision record ' + esc(d.id) + ' and the records it cites. Northstar is fictional; every system, person and finding here is synthetic.</footer></article>';
  return h;
};
function finalHTML(d, x, log) {
  if (d.final) {
    var f = d.final;
    return '<div class="dm-final" role="note"><p class="dm-lead">Decided: <span class="dm-opt-id">' + esc(f.option) + '</span>' + (f.plus ? ' + <span class="dm-opt-id">' + esc(f.plus) + '</span>' : '') + ' ' + esc(optTitle(d, f.option)) + '</p>' +
      '<p>By <b>' + esc(f.by) + '</b> on ' + esc(P.hdate(f.on)) + '. ' + esc(f.rationale) + '</p>' +
      (log ? '<p class="small dim">Recorded in this browser tab only — nothing was stored or sent. <button class="linklike" data-act="reopenDecision" data-id="' + esc(d.id) + '">Undo</button></p>' : '') + '</div>';
  }
  var opts = [x.rec].concat(x.alts).filter(Boolean);
  return '<p>' + unk('No decision recorded yet') + '</p>' +
    '<form class="dm-form" id="dmForm" data-id="' + esc(d.id) + '" novalidate><h3 class="dm-sub">Record the decision</h3>' +
      '<fieldset><legend>Option chosen</legend>' + opts.map(function (o, i) { return '<label class="dm-radio"><input type="radio" name="dmOpt" value="' + esc(o.id) + '"' + (i === 0 ? ' checked' : '') + '> <b>' + esc(o.id) + '</b> ' + esc(o.title) + (o === x.rec ? ' <span class="small dim">(recommended)</span>' : '') + '</label>'; }).join('') + '</fieldset>' +
      '<label class="dm-lbl" for="dmRationale">Rationale</label><textarea id="dmRationale" rows="3" aria-describedby="dmRatHelp" placeholder="Why this option, in a sentence a customer would accept."></textarea><p class="small dim" id="dmRatHelp">Required. It is quoted in the memo.</p>' +
      '<label class="dm-lbl" for="dmBy">Decided by</label><input id="dmBy" type="text" value="' + esc(d.approver || '') + '" autocomplete="off">' +
      '<div class="btn-row"><button type="submit" class="btn primary">Record the decision</button></div>' +
      '<p class="small dim">Recorded in this tab only: the memo changes in memory, nothing is stored or sent, and a reload resets it.</p><p class="dm-msg" id="dmMsg" role="status" aria-live="polite"></p></form>';
}
function optTitle(d, id) { var o = d.options.filter(function (x) { return x.id === id; })[0]; return o ? '— ' + o.title : ''; }

/* Recording a decision: the in-memory record changes, the old one is kept for Undo. */
P.recordDecision = function (id, option, rationale, by) {
  var d = obj(id); if (!d || typeOf(id) !== 'decision') return false;
  var log = P.state.decisionLog = P.state.decisionLog || {};
  if (!log[id]) log[id] = { status: d.status, final: d.final };
  d.final = { option: option, by: by, on: NS.TODAY, rationale: rationale };
  d.status = 'decided';
  P.pushTrail(id);
  if (P.renderNav) P.renderNav();
  return true;
};
P.acts.reopenDecision = function (el) {
  var id = el.getAttribute('data-id'), log = P.state.decisionLog || {}, d = obj(id);
  if (!d || !log[id]) return;
  d.status = log[id].status; d.final = log[id].final; delete log[id];
  if (P.renderNav) P.renderNav(); P._keepScroll = true; P.render();
};
function mountMemo(root) {
  var f = root.querySelector('#dmForm'); if (!f) return;
  f.addEventListener('submit', function (ev) {
    ev.preventDefault();
    var id = f.getAttribute('data-id'), opt = f.querySelector('input[name="dmOpt"]:checked'), ra = f.querySelector('#dmRationale'), by = f.querySelector('#dmBy'), msg = f.querySelector('#dmMsg');
    var why = ra.value.trim(), who = by.value.trim();
    ra.removeAttribute('aria-invalid'); by.removeAttribute('aria-invalid');
    if (!why || !who) { var bad = !why ? ra : by; bad.setAttribute('aria-invalid', 'true'); msg.textContent = !why ? 'Write the rationale first — a decision without one cannot be audited.' : 'Name who decided.'; bad.focus(); return; }
    P.recordDecision(id, opt ? opt.value : null, why, who);
    var r = P.route;
    if (r.path === 'report/executive' && r.q.d !== id) { P.go('report/executive?d=' + encodeURIComponent(id)); }
    else { P._keepScroll = true; P.render(); }
    setTimeout(function () { var n = document.getElementById('dmNext'); if (n) { n.scrollIntoView({ block: 'center' }); n.focus({ preventScroll: true }); } }, 30);
  });
}

V['decisions/:id'] = { title: 'Decision memo', render: function (s) {
  var id = s[1], d = obj(id);
  if (!d || typeOf(id) !== 'decision') return P.pageHead('Decide', 'Decision not found', '') + '<p>' + unk('No decision with id ' + id) + '</p><p><a href="#/decisions">See every decision →</a></p>';
  P.pushTrail(id);
  return P.memoHTML(d);
}, mount: function (root) { mountMemo(root); } };

/* The executive memo is the same memo; old ?r=<risk> and ?f=<finding> links pick the matching decision. */
function execPick(q) {
  var note = '', d = null;
  if (q.d && typeOf(q.d) === 'decision') d = obj(q.d);
  if (!d && q.r) { d = NS.decisions.filter(function (x) { return x.risk === q.r; })[0] || null; if (!d) note = unk('No decision has been opened for ' + (P.get(q.r) ? P.name(q.r) : q.r)) + ' — showing the most urgent owed decision instead.'; }
  if (!d && q.f) { d = NS.decisions.filter(function (x) { return x.findings.indexOf(q.f) >= 0; })[0] || null; if (!d) note = unk('No decision covers finding ' + q.f) + ' — showing the most urgent owed decision instead.'; }
  if (!d) { var owed = P.decisionsSorted().filter(function (x) { return x.d.status === 'owed'; }); d = (owed[0] || P.decisionsSorted()[0]).d; }
  return { d: d, note: note };
}
V['report/executive'] = { title: 'Executive memo', render: function (s, q) {
  var pick = execPick(q), d = pick.d;
  P.pushTrail(d.id);
  return '<div class="toolbar dm-pick"><label class="small muted" for="execPick">Decision</label><select id="execPick">' + P.decisionsSorted().map(function (x) {
      return '<option value="' + esc(x.d.id) + '"' + (x.d.id === d.id ? ' selected' : '') + '>' + esc(x.d.id + ' · ' + STAGE_SHORT[x.d.status] + ' · ' + x.d.question) + '</option>'; }).join('') + '</select></div>' +
    (pick.note ? '<p class="callout unk">' + pick.note + '</p>' : '') + P.memoHTML(d, { exec: true });
}, mount: function (root) {
  mountMemo(root);
  var s = root.querySelector('#execPick'); if (s) s.addEventListener('change', function () { P.go('report/executive?d=' + encodeURIComponent(s.value)); });
} };

/* ── the trail as a document ─────────────────────────────────── */
function trailIds(q) {
  var raw = q.t != null ? q.t.split(',').map(function (x) { return x.trim(); }).filter(Boolean) : P.state.trail.slice();
  return raw;
}
/* Why a record matters, in its own words. */
function whyMatters(id) {
  var e = P.get(id); if (!e) return unk('record not found — this step cannot be verified');
  var o = e.obj, t = e.type;
  switch (t) {
    case 'promise': var st = P.promiseState(o); return 'A promise to ' + esc(o.audience.toLowerCase()) + ', made in ' + esc(o.where) + '. It is ' + esc(P.STATUS_TEXT[st.status].toLowerCase()) + (st.why.length ? ': ' + esc(st.why.slice(0, 2).map(function (w) { return w.text; }).join('; ')) : '') + '.';
    case 'decision': return esc(o.consequence || o.question) + ' <span class="dim">(' + esc(P.STAGE_TEXT[o.status]) + ')</span>';
    case 'finding': return esc(o.human || o.title) + ' <span class="dim">(' + esc(o.sev + ' · ' + o.status + (o.people ? ' · ' + fmtN(o.people) + ' people' : '')) + ')</span>';
    case 'dataset': return esc(o.why || '') + (o.people ? ' Holds data on ' + fmtN(o.people) + ' ' + esc((o.subjects || 'people').toLowerCase()) + '.' : ' ' + unk('number of people unknown')) + (o.owner ? '' : ' ' + unk('no owner'));
    case 'control': var ct = P.controlTest(id); return esc(o.statement || o.name).replace(/([^.!?”"])$/, '$1.') + ' Last test: ' + resultWord(ct) + ' ' + P.freshTag(ct.last, 'Last test') + (ct.evidence ? ' — ' + esc(ct.evidence) : '') + '.';
    case 'system': return esc((o.kind || 'system') + ' run by ' + (o.team ? P.name(o.team) : 'no team')) + (o.team ? '' : ' ' + unk('owner unknown')) + (o.region ? ', in ' + esc(P.name(o.region)) : '') + '. ' + P.findingsFor(id).filter(P.isOpenFinding).length + ' open findings name it.';
    case 'vendor': case 'subprocessor': return esc(o.role || 'Third party') + (o.data ? ' receiving ' + esc(o.data.join(', ')) : '') + (o.people ? ' for ' + fmtN(o.people) + ' people' : '') + '.';
    case 'flow': return esc((o.fields || []).join(', ')) + ' → ' + esc(P.name(o.to)) + ' · ' + esc(o.status || '') + (o.status === 'unknown' ? ' ' + unk('unmapped') : '') + '.';
    case 'risk': return esc((o.why || []).slice(0, 3).join('; ')) + '.';
    case 'incident': return esc(o.assumption || o.title) + ' ' + (o.gap ? esc(o.gap) : '');
    case 'identifier': return esc((o.cls || '') + (o.note ? ' — ' + o.note : ''));
    case 'model': return esc((o.purpose ? 'Serves ' + o.purpose : 'Model') + (o.hosting ? ' · ' + o.hosting : '') + (o.provenance ? ' · provenance ' + o.provenance : ''));
    case 'person': return esc(o.note);
    default: var nf = P.findingsFor(id).filter(P.isOpenFinding).length; return esc(P.TYPE_LABEL[t] || t) + ' in the privacy graph' + (nf ? '; ' + nf + ' open findings name it' : '') + '.';
  }
}
/* The records each step rests on. */
function stepCites(id) {
  var e = P.get(id); if (!e) return [];
  var o = e.obj;
  switch (e.type) {
    case 'promise': return (o.findings || []).concat(o.controls || [], o.decision ? [o.decision] : []);
    case 'decision': return [o.promise].concat(o.findings, o.test ? [o.test.control] : []);
    case 'finding': return o.entities.slice(0, 8).concat(o.owner ? [o.owner] : []);
    case 'risk': return [o.asset].concat(o.findings);
    case 'incident': return o.entities.slice();
    case 'person': return o.identifiers.concat(o.products || []);
    case 'control': return P.findingsFor(id).map(function (f) { return f.id; }).concat(P.promisesFor(id).map(function (p) { return p.id; }), NS.decisions.filter(function (d) { return d.test && d.test.control === id; }).map(function (d) { return d.id; }), o.owner ? [o.owner] : []);
    default: return P.findingsFor(id).filter(P.isOpenFinding).map(function (f) { return f.id; }).slice(0, 6).concat(P.nb(id).filter(function (n) { return n.rel === 'owned by' || n.rel === 'stores'; }).map(function (n) { return n.id; }));
  }
}
function linkTo(prev, id) {
  if (!prev || !P.get(prev) || !P.get(id)) return '';
  var r = P.nb(prev).filter(function (n) { return n.id === id; })[0];
  return r ? 'Reached from the previous step: ' + esc(P.shortName(prev)) + ' ' + (r.dir === 'out' ? '→' : '←') + ' ' + esc(r.rel) + '.' : 'Not directly linked to the previous step in the graph — opened separately.';
}
function anchorOf(ids) {
  var ok = ids.filter(function (i) { return P.get(i); });
  var pr = ok.filter(function (i) { return typeOf(i) === 'promise'; })[0];
  if (pr) return pr;
  var dec = ok.filter(function (i) { return typeOf(i) === 'decision'; })[0];
  if (dec) return obj(dec).promise || dec;
  for (var i = 0; i < ok.length; i++) { var ps = P.promisesFor(ok[i]); if (ps.length) return ps[0].id; }
  return ok[0] || null;
}
function genLine() {
  return 'Generated ' + esc(P.hdate(new Date().toISOString().slice(0, 10))) + ' · data as of ' + esc(P.hdate(NS.TODAY));
}
function disclaimer() { return '<p class="ir-disc" role="note"><b>Synthetic demo data.</b> Northstar is fictional; every system, vendor, person, finding and incident in this report is invented and describes no real organisation. Regulation mappings are orientation, not legal advice.</p>'; }
function emptyTrail(what) {
  return '<div class="card ir-empty"><h2 class="sec">No trail to ' + esc(what) + ' yet</h2><p>Open records — a promise, a finding, a dataset, a control — and each one is added to the trail at the bottom of the screen. The trail then becomes a report you can print, a link you can share, or a draft decision memo.</p>' +
    '<div class="btn-row"><a class="btn" href="' + esc(P.trailHash(what === 'report' ? 'report/investigation' : 'decisions/new', SAMPLE_TRAIL)) + '">Open a worked example</a><a class="btn" href="#/chain">Start in the chain explorer</a></div></div>';
}
/* Which existing decisions already cover what the trail found. */
function coveringDecisions(ids) {
  var found = ids.filter(function (i) { return typeOf(i) === 'finding'; }), proms = ids.filter(function (i) { return typeOf(i) === 'promise'; });
  return NS.decisions.filter(function (d) { return ids.indexOf(d.id) >= 0 || proms.indexOf(d.promise) >= 0 || d.findings.some(function (f) { return found.indexOf(f) >= 0; }); });
}

V['report/investigation'] = { title: 'Investigation report', render: function (s, q) {
  var ids = trailIds(q);
  if (q.t != null) P.setTrail(ids);
  var head = P.pageHead('Report', 'Investigation report', 'Every step of an investigation, in the order it was taken: what each record is, why it matters, and the records it rests on. Share the link and anyone sees the same trail.');
  if (!ids.length) return head + emptyTrail('report');
  var known = ids.filter(function (i) { return P.get(i); }), anchor = anchorOf(ids);
  var proms = P.uniq(known.filter(function (i) { return typeOf(i) === 'promise'; }).concat(anchor && typeOf(anchor) === 'promise' ? [anchor] : []));
  var decs = coveringDecisions(known.concat(proms));
  var finds = known.filter(function (i) { return typeOf(i) === 'finding'; }).map(obj);
  var types = P.uniq(known.map(function (i) { return P.TYPE_LABEL[typeOf(i)] || typeOf(i); }));
  var steps = ids.map(function (id, i) {
    var e = P.get(id);
    return '<li class="ir-step"><div class="ir-n" aria-hidden="true">' + (i + 1) + '</div><div class="ir-b">' +
      '<p class="ir-type">Step ' + (i + 1) + ' · ' + esc(e ? (P.TYPE_LABEL[e.type] || e.type) : 'Unknown record') + ' <span class="mono dim">' + esc(id) + '</span></p>' +
      '<h3 class="ir-name">' + (e ? chip(id, e.name) : unk(id)) + '</h3>' +
      '<p class="ir-why"><b>Why it matters:</b> ' + whyMatters(id) + '</p>' +
      (i ? '<p class="small dim ir-link">' + linkTo(ids[i - 1], id) + '</p>' : '') +
      (e ? P.cite(stepCites(id), 'Cites') : '') + '</div></li>';
  }).join('');
  var link = location.href.split('#')[0] + P.trailHash('report/investigation', known);
  return head +
    '<article class="ir" aria-labelledby="ir-title">' +
    '<header class="ir-head"><p class="eyebrow">Investigation report · Northstar (fictional) · synthetic demo data</p><h2 id="ir-title" class="ir-title">' + ids.length + ' step' + (ids.length > 1 ? 's' : '') + (anchor ? ', anchored on ' + esc(typeOf(anchor) === 'promise' ? anchor : P.shortName(anchor)) : '') + '</h2>' +
      '<p class="ir-gen">' + genLine() + ' · ' + esc(types.join(', ')) + '</p>' +
      '<div class="btn-row ir-acts">' + printBtn() + '<button class="btn" data-act="shareTrail">Copy link</button><a class="btn" href="' + esc(P.trailHash('decisions/new', known)) + '">Draft a decision memo from this trail</a></div>' +
      '<p class="pcc-print-only small ir-url">Reproduce this trail: ' + esc(link) + '</p></header>' +
    '<section class="ir-sec" aria-labelledby="ir-sum"><h2 id="ir-sum" class="dm-h">What the trail establishes</h2><dl class="dm-kv">' +
      '<div><dt>Promises</dt><dd>' + (proms.length ? proms.map(function (p) { return chip(p, p) + ' ' + P.statusTag(P.promiseState(obj(p)).status); }).join(' ') : unk('no promise on the trail')) + '</dd></div>' +
      '<div><dt>Findings opened</dt><dd>' + (finds.length ? finds.map(function (f) { return chip(f.id, f.id) + ' ' + P.sev(f.sev); }).join(' ') : '<span class="dim">None opened on the trail.</span>') + '</dd></div>' +
      '<div><dt>Decisions</dt><dd>' + (decs.length ? decs.map(function (d) { return '<a class="mono small" href="#/decisions/' + esc(d.id) + '">' + esc(d.id) + '</a> ' + stageTag(d.status); }).join(' · ') : unk('no decision covers these records')) + '</dd></div>' +
      (ids.length !== known.length ? '<div><dt>Could not verify</dt><dd>' + ids.filter(function (i) { return !P.get(i); }).map(function (i) { return unk(i); }).join(' ') + '</dd></div>' : '') + '</dl></section>' +
    '<section class="ir-sec" aria-labelledby="ir-steps"><h2 id="ir-steps" class="dm-h">Steps, in order</h2><ol class="ir-steps">' + steps + '</ol></section>' +
    (anchor ? '<section class="ir-sec" aria-labelledby="ir-chain"><h2 id="ir-chain" class="dm-h">The chain around ' + esc(typeOf(anchor) === 'promise' ? anchor : P.shortName(anchor)) + '</h2>' + P.chainHTML(anchor, { max: 3 }) + '</section>' : '') +
    disclaimer() + '</article>';
} };

/* ── a draft memo from the trail ─────────────────────────────── */
V['decisions/new'] = { title: 'Draft decision memo', render: function (s, q) {
  var ids = trailIds(q);
  if (q.t != null) P.setTrail(ids);
  var head = P.pageHead('Decide', 'Draft decision memo', 'Pre-filled from an investigation trail: the promise, findings, controls and evidence found along the way. The owner writes the options; the approver decides.');
  var known = ids.filter(function (i) { return P.get(i); });
  if (!known.length) return head + emptyTrail('memo');
  var of = function (ty) { return known.filter(function (i) { return typeOf(i) === ty; }); };
  var proms = P.uniq(of('promise').concat(of('decision').map(function (d) { return obj(d).promise; })).filter(Boolean));
  if (!proms.length) { var a = anchorOf(known); if (a && typeOf(a) === 'promise') proms = [a]; }
  var pr = proms.map(obj);
  var fromTrail = of('finding'), finds = fromTrail.length ? fromTrail : P.uniq([].concat.apply([], pr.map(function (p) { return P.promiseState(p).open.map(function (f) { return f.id; }); })));
  var controls = P.uniq(of('control').concat([].concat.apply([], pr.map(function (p) { return p.controls || []; }))));
  var main = pr[0] || null;
  var draft = { id: 'DRAFT', promise: main ? main.id : null, risk: main ? main.risk : null, findings: finds, options: [], opened: NS.TODAY, status: 'owed' };
  var x = P.decision(draft);
  var owner = main ? main.owner : (finds.map(obj).filter(function (f) { return f.owner; })[0] || {}).owner || null;
  var cover = coveringDecisions(known.concat(proms));
  var n = 0;
  var slot = function (L) {
    return '<article class="dm-opt empty" aria-label="Option ' + L + ', not yet written"><h3 class="dm-opt-t"><span class="dm-opt-id">' + L + '</span> ' + unk('not yet written') + '</h3>' +
      '<dl class="dm-opt-f"><div><dt>Privacy reduction</dt><dd>' + unk('to be written') + '</dd></div><div><dt>Product impact</dt><dd>' + unk('to be written') + '</dd></div><div><dt>Cost</dt><dd>' + unk('to be estimated') + '</dd></div></dl>' +
      '<div class="dm-pc"><div><h4>For</h4><p class="dm-blank">&nbsp;</p></div><div><h4>Against</h4><p class="dm-blank">&nbsp;</p></div></div><p class="dm-trade"><b>Trade-off:</b> <span class="dm-blank-i">&nbsp;</span></p></article>';
  };
  var ex = main ? P.explainRisk(main.risk ? obj(main.risk) : null, main) : null;
  var weak = controls.filter(function (c) { return typeOf(c) === 'control'; }).map(P.controlTest).filter(function (t) { return t.weak; });
  var question = main ? 'What will Northstar change so that “' + main.text + '” is true again?' : finds.length ? 'What will Northstar do about ' + finds.join(', ') + '?' : 'What decision does this investigation require?';
  return head +
    '<article class="dm dm-draft" aria-labelledby="dm-title">' +
    '<p class="dm-banner" role="note"><b>Draft — not a decision.</b> Nothing here has been decided or approved. It gathers what the trail found so an owner can write the options.</p>' +
    '<header class="dm-head"><p class="eyebrow">Draft decision memo · from a ' + known.length + '-step trail · Northstar (fictional) · synthetic demo data</p><h2 id="dm-title" class="dm-title">' + esc(question) + '</h2>' +
      '<p class="dm-meta"><span class="stage stage-draft">Draft</span> · ' + genLine() + '</p>' +
      '<div class="btn-row dm-acts">' + printBtn() + '<a class="btn" href="' + esc(P.trailHash('report/investigation', known)) + '">The investigation report</a></div></header>' +
    (cover.length ? '<div class="callout warn dm-cover"><b>Before drafting:</b> ' + cover.map(function (d) { return '<a href="#/decisions/' + esc(d.id) + '">' + esc(d.id) + '</a> (' + esc(P.STAGE_TEXT[d.status].toLowerCase()) + ')'; }).join(', ') + ' already cover' + (cover.length === 1 ? 's' : '') + ' some of these records. Open ' + (cover.length === 1 ? 'it' : 'them') + ' rather than opening a duplicate.</div>' : '') +
    sec('required', ++n, '<p class="dm-lead">' + esc(question) + '</p><p class="small dim">A suggested wording, derived from the trail. The owner should restate it as a yes/no choice.</p>') +
    sec('promise', ++n, pr.length ? pr.map(function (p) { var st = P.promiseState(p); return '<blockquote class="dm-quote"><q>' + esc(p.text) + '</q><footer>Promised in ' + esc(p.where) + ' · to ' + esc(p.audience.toLowerCase()) + ' · ' + P.statusTag(st.status) + '</footer></blockquote><p>' + peopleHTML(st) + '. ' + (st.open[0] && st.open[0].human ? esc(st.open[0].human) : '') + '</p>'; }).join('') : '<p>' + unk('the trail touched no published promise') + ' — say which promise this breaks before it goes to an approver.</p>') +
    sec('evidence', ++n, '<h3 class="dm-sub">Findings' + (fromTrail.length ? ' opened on the trail' : ' behind the promise') + '</h3>' + findingsTable(finds, 'Findings for the draft') +
      '<h3 class="dm-sub">Controls and evidence' + (of('control').length ? ' (' + of('control').length + ' opened on the trail)' : '') + '</h3>' + (controls.length ? controlsTable(controls, 'Controls for the draft') : '<p>' + unk('no control found along the way') + '</p>') +
      (ex ? '<h3 class="dm-sub">Residual risk today</h3>' + P.riskHTML(ex) : '') +
      (anchorOf(known) ? '<h3 class="dm-sub">From promise to owner</h3>' + P.chainHTML(anchorOf(known), { max: 3 }) : '') +
      P.cite(known, 'Found along the way')) +
    sec('options', ++n, '<p class="small">At least two options, each with what it is for and against, the trade-off, the privacy reduction, the product impact and the cost.</p><div class="dm-opts">' + slot('A') + slot('B') + '</div>') +
    sec('rec', ++n, '<p>' + unk('none — a recommendation needs options first') + '</p>') +
    sec('dissent', ++n, '<dl class="dm-kv"><div><dt>Dissent</dt><dd>' + unk('not yet gathered — ask the teams who would lose something') + '</dd></div>' +
      '<div><dt>What we are unsure of</dt><dd>' + (ex && ex.unknowns.length ? '<ul class="dm-unk">' + ex.unknowns.map(function (u) { return '<li>' + unk(u) + '</li>'; }).join('') + '</ul>' : '<span class="dim">No unknown inputs found along the way.</span>') + '</dd></div></dl>') +
    sec('owner', ++n, '<dl class="dm-kv"><div><dt>Suggested owner</dt><dd>' + P.ownerHTML(owner) + '<div class="small dim">' + (main ? 'Owns the promise.' : 'Owns the first finding.') + '</div></dd></div>' +
      '<div><dt>Approver</dt><dd>' + unk('to be named') + '</dd></div>' +
      '<div><dt>Due</dt><dd>' + dueHTML(x) + '<div class="small dim">From the earliest open finding.</div></dd></div>' +
      '<div><dt>SLA if opened today</dt><dd>' + x.slaDays + ' days for a ' + esc(x.sev.toLowerCase()) + '-severity decision → ' + esc(P.hdate(x.slaDue)) + '</dd></div></dl>') +
    sec('final', ++n, '<p><span class="stage stage-draft">Not decided</span> This is a draft.</p><h3 class="dm-sub">Follow-up test — what would prove the fix</h3>' +
      (weak.length ? '<p class="small">These controls lack current, passing evidence; the follow-up test should make one of them pass:</p><ul class="evl">' + weak.map(function (t) { return '<li>' + chip(t.control.id) + ' ' + resultWord(t) + ' ' + P.freshTag(t.last, 'Last test') + '<div class="small dim">' + esc(t.method || '') + ' · next test ' + (t.next ? esc(P.hdate(t.next)) : 'not scheduled') + '</div></li>'; }).join('') + '</ul>' : '<p>' + unk('no failing control found — write the test that would prove the promise') + '</p>')) +
    disclaimer() + '</article>';
} };

/* ── printing, for every page ─────────────────────────────────
 * A print-only header (title, generation date, synthetic-data disclaimer)
 * above #view and a footer line below it; every <details> opens while
 * printing (pcc-print.css also forces their content visible for engines
 * that print without a beforeprint event) and closes again afterwards. */
var main = document.getElementById('view');
var ph = document.createElement('div'), pf = document.createElement('div');
ph.className = 'pcc-print-only pcc-print-head'; ph.setAttribute('aria-hidden', 'true');
pf.className = 'pcc-print-only pcc-print-foot'; pf.setAttribute('aria-hidden', 'true');
if (main && main.parentNode) { main.parentNode.insertBefore(ph, main); main.parentNode.insertBefore(pf, main.nextSibling); }
function stamp() {
  var t = document.title.replace(/ — Privacy Command Center$/, '');
  ph.innerHTML = '<span class="pph-t">Privacy Command Center · ' + esc(t) + '</span><span class="pph-d">' + genLine() + '</span><span class="pph-s">Northstar is fictional · synthetic demo data</span>';
  pf.innerHTML = '<p><b>Synthetic demo data.</b> Northstar is fictional; every system, vendor, person, finding and incident is invented. Regulation mappings are orientation, not legal advice. ' + genLine() + ' · ' + esc(location.href) + '</p>';
}
if (main) new MutationObserver(function () { stamp(); }).observe(main, { childList: true });
stamp();
var reopened = [];
function beforePrint() {
  stamp();
  reopened = [].slice.call(document.querySelectorAll('#view details:not([open])'));
  reopened.forEach(function (d) { d.open = true; d.dispatchEvent(new Event('toggle')); });
}
function afterPrint() { reopened.forEach(function (d) { if (d.isConnected) d.open = false; }); reopened = []; }
window.addEventListener('beforeprint', beforePrint);
window.addEventListener('afterprint', afterPrint);
P.printPrepare = beforePrint; P.printRestore = afterPrint;
})();
