/* Privacy Command Center — the operating model.
 *
 * One chain connects everything:
 *   Promise → Product/feature → Purpose → Person/identity → Data → System →
 *   Data flow → Vendor/model → Jurisdiction → Control → Evidence → Finding →
 *   Decision → Owner
 *
 * This file derives, from data.js + data-ops.js:
 *   P.chain(id)          the full chain around any entity
 *   P.promiseState(p)    BROKEN / AT RISK / UNPROVEN / KEPT, with reasons
 *   P.explainRisk(...)   residual risk in words: band, drivers, safeguards, confidence
 *   P.decision(d)        due date, SLA, owner, test and freshness for a decision
 *   P.indicator(id)      value, denominator, target, trend, coverage, owner, freshness
 *   P.priorities(role)   the same priority items, ranked and worded for a role
 * and the small renderers every page shares (chain strip, freshness, cite).
 * Nothing here types a number. */
(function () {
'use strict';
var P = window.PCC, NS = window.NS, esc = P.esc, fmtN = P.fmtN, unk = P.unk;
var ENT = P.ENT;

/* ── register the operating entities in the graph ──────────────── */
P.TYPE_LABEL.promise = 'Promise';
P.TYPE_LABEL.decision = 'Decision';
function reg(id, type, obj, name) { ENT[id] = { id: id, type: type, obj: obj, name: name }; }
NS.promises.forEach(function (p) { reg(p.id, 'promise', p, p.text); });
NS.decisions.forEach(function (d) { reg(d.id, 'decision', d, d.id + ' · ' + d.question); });
function edge(a, b, rel) { if (ENT[a] && ENT[b] && a !== b) P.EDGES.push({ a: a, b: b, rel: rel, x: null }); }
NS.promises.forEach(function (p) {
  (p.features || []).forEach(function (f) { edge(p.id, f, 'made about'); });
  (p.datasets || []).forEach(function (d) { edge(p.id, d, 'covers'); });
  (p.controls || []).forEach(function (c) { edge(p.id, c, 'kept by'); });
  (p.findings || []).forEach(function (f) { edge(f, p.id, 'breaks'); });
  if (p.decision) edge(p.id, p.decision, 'needs');
  if (p.owner) edge(p.id, p.owner, 'owned by');
});
NS.decisions.forEach(function (d) {
  d.findings.forEach(function (f) { edge(d.id, f, 'resolves'); });
  if (d.owner) edge(d.id, d.owner, 'owned by');
  if (d.test && d.test.control) edge(d.id, d.test.control, 'proven by');
});

/* ── dates, freshness, human wording ───────────────────────────── */
var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
P.hdate = function (iso) {
  if (!iso) return null;
  var d = new Date(iso.slice(0, 10) + 'T12:00:00Z');
  return d.getUTCDate() + ' ' + MON[d.getUTCMonth()] + ' ' + d.getUTCFullYear();
};
P.rel = function (iso) {
  var n = P.daysSince(iso); if (n == null) return null;
  if (n === 0) return 'today'; if (n === 1) return 'yesterday'; if (n === -1) return 'tomorrow';
  if (n > 0) return n < 14 ? n + ' days ago' : n < 60 ? Math.round(n / 7) + ' weeks ago' : Math.round(n / 30.4) + ' months ago';
  return 'in ' + (-n < 14 ? -n + ' days' : Math.round(-n / 7) + ' weeks');
};
/* Evidence freshness: fresh ≤ 7 days, aging ≤ 30, stale beyond, never if untested. */
P.freshness = function (iso) {
  if (!iso) return { state: 'never', label: 'never tested', days: null };
  var n = P.daysSince(iso);
  return { state: n <= 7 ? 'fresh' : n <= 30 ? 'aging' : 'stale', label: P.rel(iso), days: n, date: iso };
};
P.freshTag = function (iso, what) {
  var f = P.freshness(iso);
  return '<span class="fresh fresh-' + f.state + '" title="' + esc((what || 'Evidence') + ': ' + (f.date ? P.hdate(f.date) : 'none')) + '">' + esc(f.state === 'never' ? 'never tested' : f.state + ' · ' + f.label) + '</span>';
};
P.personName = function (id) { return id && ENT[id] ? ENT[id].name : null; };
P.ownerHTML = function (id) { return id ? P.chip(id) : unk('no owner'); };
function isOpen(f) { return ['closed', 'mitigated', 'accepted'].indexOf(f.status) < 0; }
P.isOpenFinding = isOpen;

/* ── control evidence ──────────────────────────────────────────── */
P.controlTest = function (cid) {
  var c = ENT[cid] && ENT[cid].obj, t = NS.controlTests[cid] || {};
  var f = P.freshness(t.last);
  var result = t.result || 'never';
  return { control: c, last: t.last, result: result, method: t.method, evidence: t.evidence, next: t.next, exceptions: t.exceptions || [], fresh: f,
    ok: result === 'pass' && f.state !== 'stale', weak: result !== 'pass' || f.state === 'stale' || f.state === 'never' };
};

/* ── promises ──────────────────────────────────────────────────── */
var SEVW = { HIGH: 3, MEDIUM: 2, LOW: 1 };
P.promiseState = function (p) {
  var finds = (p.findings || []).map(function (id) { return ENT[id] && ENT[id].obj; }).filter(Boolean);
  var open = finds.filter(isOpen), high = open.filter(function (f) { return f.sev === 'HIGH'; });
  var incs = (p.incidents || []).map(function (id) { return ENT[id] && ENT[id].obj; }).filter(function (i) { return i && i.status !== 'closed'; });
  var tests = (p.controls || []).map(P.controlTest);
  var failing = tests.filter(function (t) { return t.result === 'fail'; });
  var unproven = tests.filter(function (t) { return t.result === 'never' || t.fresh.state === 'stale'; });
  var why = [];
  high.forEach(function (f) { why.push({ id: f.id, text: f.title, kind: 'finding' }); });
  incs.forEach(function (i) { why.push({ id: i.id, text: i.title, kind: 'incident' }); });
  open.filter(function (f) { return f.sev !== 'HIGH'; }).forEach(function (f) { why.push({ id: f.id, text: f.title, kind: 'finding' }); });
  failing.forEach(function (t) { why.push({ id: t.control.id, text: t.control.name + ' failed its last test', kind: 'control' }); });
  unproven.forEach(function (t) { why.push({ id: t.control.id, text: t.control.name + (t.result === 'never' ? ' has never been tested' : ' was last tested ' + t.fresh.label), kind: 'evidence' }); });
  var status = high.length || incs.length ? 'BROKEN' : open.length || failing.length ? 'AT RISK' : unproven.length ? 'UNPROVEN' : 'KEPT';
  var ds = (p.datasets || []).map(function (id) { return ENT[id] && ENT[id].obj; }).filter(Boolean);
  var people = Math.max.apply(null, [0].concat(open.map(function (f) { return f.people || 0; })).concat(ds.map(function (d) { return d.people || 0; })));
  /* The largest group is named; groups overlap, so they are never added up. */
  var big = ds.slice().sort(function (a, b) { return (b.people || 0) - (a.people || 0); })[0];
  var subjects = big && big.subjects ? [big.subjects] : [];
  var newest = tests.filter(function (t) { return t.last; }).map(function (t) { return t.last; }).sort().pop() || null;
  var oldest = tests.map(function (t) { return t.last; }).sort()[0];
  return { status: status, open: open, high: high, incidents: incs, tests: tests, failing: failing, unproven: unproven, why: why,
    people: people, subjects: subjects, datasets: ds, weight: (SEVW[high.length ? 'HIGH' : open.length ? (open[0].sev) : 'LOW'] || 1),
    evidence: { newest: newest, oldest: tests.some(function (t) { return !t.last; }) ? null : oldest, anyNever: tests.some(function (t) { return !t.last; }) } };
};
P.STATUS_TEXT = { BROKEN: 'Broken', 'AT RISK': 'At risk', UNPROVEN: 'Unproven', KEPT: 'Kept' };
P.statusTag = function (s) { return '<span class="pstat pstat-' + s.replace(' ', '-').toLowerCase() + '">' + esc(P.STATUS_TEXT[s] || s) + '</span>'; };
P.promisesFor = function (id) {
  return NS.promises.filter(function (p) {
    if (p.id === id || p.decision === id || p.risk === id || p.owner === id) return true;
    var refs = [].concat(p.features || [], p.datasets || [], p.controls || [], p.findings || [], p.purposes || [], p.incidents || []);
    if (refs.indexOf(id) >= 0) return true;
    return (p.findings || []).some(function (f) { var o = ENT[f] && ENT[f].obj; return o && o.entities.indexOf(id) >= 0; });
  });
};

/* ── residual risk, in words ───────────────────────────────────────
 * The score exists (P.riskCalc) but is never shown alone: a band, the
 * drivers, the safeguards, the scale and how confident we are. */
var LEVEL = function (v) { return v >= 4 ? 'strong' : v >= 2 ? 'partial' : 'weak'; };
P.explainRisk = function (risk, promise) {
  var out = { band: null, likely: null, drivers: [], safeguards: [], unknowns: [], confidence: 'medium', scale: null, sentence: '' };
  var d = risk ? ENT[risk.asset] && ENT[risk.asset].obj : null;
  if (risk) {
    var c = P.riskCalc(risk);
    out.band = c.rating;
    out.drivers = (risk.why || []).slice(0, 4);
    out.safeguards = [['Controls', risk.f.ctrl], ['Deletion', risk.f.del], ['Verification', risk.f.verify]].map(function (x) { return { k: x[0], v: x[1], level: LEVEL(x[1]) }; });
    out.score = c;
  } else if (promise) {
    var st = P.promiseState(promise);
    out.band = st.high.length ? 'HIGH' : st.open.length ? 'MEDIUM' : 'LOW';
    out.drivers = st.why.slice(0, 3).map(function (w) { return w.text; });
    out.safeguards = st.tests.slice(0, 3).map(function (t) { return { k: t.control.name, v: t.result === 'pass' ? 4 : t.result === 'fail' ? 1 : 0, level: t.result === 'pass' ? 'strong' : t.result === 'fail' ? 'weak' : 'unknown' }; });
    d = st.datasets[0] || null;
  }
  /* What we do not know widens the answer instead of hiding in a decimal. */
  var ds = promise ? P.promiseState(promise).datasets : d ? [d] : [];
  ds.forEach(function (x) {
    if (x.accessPeople == null) out.unknowns.push('who can read ' + x.name);
    if (!x.retention || x.retention.required == null) out.unknowns.push('how long ' + x.name + ' must be kept');
    if (!x.owner) out.unknowns.push('who owns ' + x.name);
    var unm = P.flowsFrom(x.system).filter(function (f) { return f.status === 'unknown'; }).length;
    if (unm) out.unknowns.push(unm + ' unmapped flow' + (unm > 1 ? 's' : '') + ' from ' + P.name(x.system));
  });
  if (promise) P.promiseState(promise).tests.forEach(function (t) { if (t.result === 'never') out.unknowns.push(t.control.name + ' has never been tested'); });
  out.unknowns = P.uniq(out.unknowns);
  out.confidence = out.unknowns.length >= 3 ? 'low' : out.unknowns.length ? 'medium' : 'high';
  var up = { LOW: 'MEDIUM', MEDIUM: 'HIGH', HIGH: 'HIGH' };
  out.likely = out.confidence === 'low' && out.band !== 'HIGH' ? out.band + ' — could be ' + up[out.band] : out.band;
  var people = d ? d.people : null;
  out.scale = people ? fmtN(people) + ' ' + (d.subjects || 'people').toLowerCase() : null;
  var weak = out.safeguards.filter(function (s) { return s.level === 'weak' || s.level === 'unknown'; }).map(function (s) { return s.k.toLowerCase(); });
  var drv = out.drivers.slice(0, 2), saysScale = drv.some(function (t) { return /\d+(\.\d+)?[MK]\b|people/.test(t); });
  out.sentence = (out.band === 'HIGH' ? 'High' : out.band === 'MEDIUM' ? 'Medium' : 'Low') + ' because ' + (drv.join(' and ') || 'of the open findings') +
    (out.scale && !saysScale ? ', affecting ' + out.scale : '') + (weak.length ? '; safeguards are weak or untested (' + weak.join(', ') + ')' : '') + '.';
  return out;
};
P.riskHTML = function (x, opts) {
  opts = opts || {};
  return '<div class="rx"><div class="rx-h"><span class="rx-band rx-' + String(x.band).toLowerCase() + '">' + esc(x.likely || '—') + '</span><span class="rx-conf">confidence: <b>' + x.confidence + '</b></span></div>' +
    '<p class="rx-s">' + esc(x.sentence) + '</p>' +
    (opts.brief ? '' : '<details class="rx-more"><summary>How this rating was reached</summary>' +
      '<div class="rx-grid"><div><h5>What drives it</h5><ul>' + x.drivers.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul></div>' +
      '<div><h5>Safeguards</h5><ul>' + x.safeguards.map(function (s) { return '<li><span class="lvl-w lvl-' + s.level + '">' + s.level + '</span> ' + esc(s.k) + '</li>'; }).join('') + '</ul></div>' +
      '<div><h5>What we don’t know</h5>' + (x.unknowns.length ? '<ul>' + x.unknowns.map(function (t) { return '<li class="unknown">' + esc(t) + '</li>'; }).join('') + '</ul>' : '<p class="small">Nothing material — the inputs are known.</p>') + '</div></div>' +
      '<p class="small dim">Bands, not decimals: exposure (sensitivity, scale, identifiability, linkability, retention, access, third parties, novelty, geography) is reduced by up to 60% by safeguards that are actually tested. Every unknown input lowers confidence; with three or more, the band is shown as a range.</p></details>') + '</div>';
};

/* ── decisions ─────────────────────────────────────────────────── */
var SLA = { HIGH: 14, MEDIUM: 30, LOW: 60 };
P.decision = function (d) {
  var finds = d.findings.map(function (id) { return ENT[id] && ENT[id].obj; }).filter(Boolean);
  var sev = finds.some(function (f) { return f.sev === 'HIGH'; }) ? 'HIGH' : finds.some(function (f) { return f.sev === 'MEDIUM'; }) ? 'MEDIUM' : 'LOW';
  var dues = finds.filter(isOpen).map(function (f) { return f.due; }).filter(Boolean).sort();
  var due = d.due || dues[0] || null;
  var slaDays = SLA[sev], slaDue = null;
  if (d.opened) { var t = new Date(d.opened + 'T12:00:00Z'); t.setUTCDate(t.getUTCDate() + slaDays); slaDue = t.toISOString().slice(0, 10); }
  var left = P.daysUntil(due);
  var test = d.test ? P.controlTest(d.test.control) : null;
  var promise = ENT[d.promise] && ENT[d.promise].obj;
  var risk = d.risk && ENT[d.risk] ? ENT[d.risk].obj : null;
  return { d: d, sev: sev, due: due, left: left, overdue: left != null && left < 0 && d.status === 'owed', slaDays: slaDays, slaDue: slaDue,
    slaBreached: slaDue && P.daysUntil(slaDue) < 0 && d.status === 'owed', test: test, promise: promise, risk: risk,
    rec: d.options.filter(function (o) { return o.id === d.recommend; })[0], alts: d.options.filter(function (o) { return o.id !== d.recommend; }),
    explain: P.explainRisk(risk, promise) };
};
P.STAGE_TEXT = { owed: 'Decision owed', decided: 'Decided', verifying: 'Decided · proving the fix', closed: 'Closed · proven' };
P.decisionsSorted = function () {
  var order = { owed: 0, verifying: 1, decided: 1, closed: 2 };
  return NS.decisions.map(P.decision).sort(function (a, b) { return (order[a.d.status] - order[b.d.status]) || String(a.due).localeCompare(String(b.due)); });
};

/* ── indicators: value, denominator, target, trend, coverage ───── */
/* Operating metrics: registered like every other metric, hidden from the classic tile wall. */
P.METRICS.push({ id: 'promises', hidden: true, tone: 'hot', label: 'Promises broken or at risk', rule: 'Published promises with an open finding, an open incident or a failing control (each promise lists its reasons).', route: 'promises',
  items: function () { return NS.promises.filter(function (p) { var s = P.promiseState(p).status; return s === 'BROKEN' || s === 'AT RISK'; }).map(function (p) { return { id: p.id, why: P.promiseState(p).status.toLowerCase() }; }); }, of: function () { return NS.promises.length; } });
P.METRICS.push({ id: 'owed', hidden: true, tone: 'hot', label: 'Decisions owed', rule: 'Decisions opened for a broken promise that nobody has made yet.', route: 'decisions',
  items: function () { return NS.decisions.filter(function (d) { return d.status === 'owed'; }).map(function (d) { var x = P.decision(d); return { id: d.id, why: 'due ' + (x.due ? P.hdate(x.due) : 'unset') + (x.overdue ? ' · overdue' : '') }; }); }, of: function () { return NS.decisions.length; } });
/* What each count is out of. */
P.DENOM = { personal: function () { return NS.datasets.length; }, sensitive: function () { return NS.datasets.length; }, nottl: function () { return NS.datasets.length; },
  retviol: function () { return NS.datasets.length; }, noowner: null, unmapped: function () { return NS.flows.length; }, paper: function () { return NS.controls.length; },
  runtime: function () { return NS.controls.length; }, delfail: function () { return NS.deletionTargets.length; }, aipersonal: function () { return NS.models.length; },
  aiprov: function () { return NS.models.length; }, sdks: function () { return NS.trackers.length; }, consentfail: function () { return NS.consentConsumers.length; },
  hivendor: function () { return NS.vendors.length; }, highfind: function () { return P.openFindings().length; } };
Object.keys(P.DENOM).forEach(function (k) { if (!P.DENOM[k]) delete P.DENOM[k]; });
P.indicator = function (id) {
  var m = P.metric(id), meta = NS.indicators[id] || {};
  if (!m && id === 'promises') m = { id: 'promises', label: 'Promises broken or at risk', rule: 'Published promises with an open finding, an open incident or a failing control (see each promise for the reasons).', route: 'promises', items: function () { return NS.promises.filter(function (p) { var s = P.promiseState(p).status; return s === 'BROKEN' || s === 'AT RISK'; }).map(function (p) { return { id: p.id, why: P.promiseState(p).status }; }); }, of: function () { return NS.promises.length; } };
  if (!m && id === 'owed') m = { id: 'owed', label: 'Decisions owed', rule: 'Decisions opened for a broken promise that nobody has made yet.', route: 'decisions', items: function () { return NS.decisions.filter(function (d) { return d.status === 'owed'; }).map(function (d) { return { id: d.id, why: 'due ' + (P.decision(d).due || 'unset') }; }); }, of: function () { return NS.decisions.length; } };
  if (!m) return null;
  var items = m.items(), v = m.value ? m.value() : items.length;
  var hist = (meta.history || []).concat([typeof v === 'number' ? v : items.length]);
  var prev = hist.length > 1 ? hist[hist.length - 2] : null, cur = hist[hist.length - 1];
  var delta = prev == null ? null : cur - prev;
  var better = delta == null || delta === 0 ? null : (meta.dir === 'up' ? delta > 0 : delta < 0);
  var denom = typeof m.of === 'function' ? m.of() : P.DENOM[id] ? P.DENOM[id]() : null;
  return { m: m, id: id, label: m.label, value: v, items: items, denom: denom, target: meta.target, dir: meta.dir || 'down', owner: meta.owner || null,
    history: hist, delta: delta, better: better, coverage: meta.coverage || null, rule: m.rule, route: m.route || null,
    fresh: P.freshness(NS.TODAY), onTarget: meta.target != null && (meta.dir === 'up' ? cur >= meta.target : cur <= meta.target) };
};
function spark(h) {
  if (!h || h.length < 2) return '';
  var W = 84, H = 22, mx = Math.max.apply(null, h), mn = Math.min.apply(null, h), r = mx - mn || 1;
  var pts = h.map(function (v, i) { return (i * W / (h.length - 1)).toFixed(1) + ',' + (H - 2 - (v - mn) / r * (H - 4)).toFixed(1); }).join(' ');
  return '<svg class="spark" viewBox="0 0 ' + W + ' ' + H + '" aria-hidden="true"><polyline points="' + pts + '" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>';
}
P.indicatorHTML = function (id, opts) {
  var x = P.indicator(id); if (!x) return '';
  opts = opts || {};
  var trend = x.delta == null ? '' : x.delta === 0 ? 'no change vs last week' : (x.delta > 0 ? '▲ ' : '▼ ') + Math.abs(x.delta) + ' vs last week';
  return '<button class="ind ' + (x.onTarget ? 'on' : x.better === false ? 'worse' : '') + '" data-metric="' + esc(x.id) + '" aria-label="' + esc(x.label + ': ' + x.value + (x.denom ? ' of ' + x.denom : '') + '. ' + trend + '. Open the evidence.') + '">' +
    '<span class="ind-l">' + esc(x.label) + '</span>' +
    '<span class="ind-v">' + esc(String(x.value)) + (x.denom ? '<small> of ' + x.denom + '</small>' : '') + '</span>' +
    '<span class="ind-t ' + (x.better === true ? 'good' : x.better === false ? 'bad' : '') + '">' + spark(x.history) + '<span>' + esc(trend) + '</span></span>' +
    (opts.brief ? '' : '<span class="ind-m"><span>target ' + (x.target == null ? unk('none set') : esc(String(x.target))) + '</span>' +
      (x.coverage ? '<span>sees ' + Math.round(x.coverage.v * 100) + '% of ' + esc(x.coverage.of) + '</span>' : '') +
      '<span>owner ' + (x.owner ? esc(P.name(x.owner)) : unk('none')) + '</span></span>') +
    '<span class="ind-d">how it’s counted · evidence →</span></button>';
};

/* ── the chain ─────────────────────────────────────────────────── */
P.CHAIN = [['promise', 'Promise'], ['product', 'Product · feature'], ['purpose', 'Purpose'], ['identity', 'Person · identity'], ['data', 'Data'], ['system', 'System'],
  ['flow', 'Data flow'], ['recipient', 'Vendor · model'], ['region', 'Jurisdiction'], ['control', 'Control'], ['evidence', 'Evidence'], ['finding', 'Finding'], ['decision', 'Decision'], ['owner', 'Owner']];
P.chain = function (id) {
  var e = ENT[id]; if (!e) return null;
  var C = {}; P.CHAIN.forEach(function (c) { C[c[0]] = []; });
  var add = function (k, x) { if (x && ENT[x] && C[k].indexOf(x) < 0) C[k].push(x); };
  var seedFindings = [];
  var t = e.type, o = e.obj;
  /* 1 · seeds from the starting entity */
  if (t === 'promise') { (o.findings || []).forEach(function (f) { seedFindings.push(f); }); (o.datasets || []).forEach(function (d) { add('data', d); }); (o.features || []).forEach(function (f) { add('product', f); }); (o.purposes || []).forEach(function (p) { add('purpose', p); }); (o.controls || []).forEach(function (c) { add('control', c); }); }
  else if (t === 'decision') { var pr = ENT[o.promise]; if (pr) return P.chain(o.promise); o.findings.forEach(function (f) { seedFindings.push(f); }); }
  else if (t === 'finding') { seedFindings.push(id); }
  else if (t === 'risk') { add('data', o.asset); o.findings.forEach(function (f) { seedFindings.push(f); }); }
  else if (t === 'dataset') add('data', id);
  else if (t === 'system') { add('system', id); NS.datasets.forEach(function (d) { if (d.system === id) add('data', d.id); }); }
  else if (t === 'feature') { add('product', id); NS.systems.forEach(function (s) { if (s.feature === id) { add('system', s.id); NS.datasets.forEach(function (d) { if (d.system === s.id) add('data', d.id); }); } }); }
  else if (t === 'product') { add('product', id); NS.datasets.forEach(function (d) { if (d.product === id) add('data', d.id); }); }
  else if (t === 'flow') { add('flow', id); add('system', o.from); add('recipient', o.to); add('control', o.control); NS.datasets.forEach(function (d) { if (d.system === o.from) add('data', d.id); }); }
  else if (t === 'vendor' || t === 'subprocessor' || t === 'model') { add('recipient', id); P.flowsTo(id).forEach(function (f) { add('flow', f.id); add('system', f.from); NS.datasets.forEach(function (d) { if (d.system === f.from) add('data', d.id); }); }); if (t === 'model') o.training.forEach(function (d) { add('data', d); }); }
  else if (t === 'identifier') { add('identity', id); NS.datasets.forEach(function (d) { if (P.dsIds(d).indexOf(id) >= 0) add('data', d.id); }); }
  else if (t === 'control') { add('control', id); NS.findings.forEach(function (f) { if (f.entities.indexOf(id) >= 0) seedFindings.push(f.id); }); }
  else if (t === 'purpose') { add('purpose', id); NS.datasets.forEach(function (d) { if (d.purposes.indexOf(id) >= 0) add('data', d.id); }); }
  else if (t === 'team') { NS.datasets.forEach(function (d) { if (d.owner === id) add('data', d.id); }); NS.findings.forEach(function (f) { if (f.owner === id && isOpen(f)) seedFindings.push(f.id); }); }
  else if (t === 'consumer') { if (ENT[o.system]) { add(ENT[o.system].type === 'system' ? 'system' : 'recipient', o.system); NS.datasets.forEach(function (d) { if (d.system === o.system) add('data', d.id); }); }
    add('control', o.mode === 'read-time' ? 'c_consent_read' : 'c_consent_batch'); add('purpose', 'advertising');
    NS.findings.forEach(function (f) { if (isOpen(f) && f.entities.indexOf(o.system) >= 0) seedFindings.push(f.id); });
    NS.promises.forEach(function (p) { if (p.id === 'PR-OPTOUT') add('promise', p.id); }); }
  else if (t === 'incident') { o.entities.forEach(function (x) { if (ENT[x] && ENT[x].type === 'finding') seedFindings.push(x); }); }
  /* 2 · findings pull in the entities they name */
  C.data.forEach(function (d) { NS.findings.forEach(function (f) { if (isOpen(f) && f.entities.indexOf(d) >= 0) seedFindings.push(f.id); }); });
  P.uniq(seedFindings).forEach(function (fid) {
    var f = ENT[fid] && ENT[fid].obj; if (!f) return; add('finding', fid);
    f.entities.forEach(function (x) {
      var ty = ENT[x] && ENT[x].type;
      ({ dataset: 'data', system: 'system', flow: 'flow', vendor: 'recipient', subprocessor: 'recipient', model: 'recipient', control: 'control', identifier: 'identity', feature: 'product', product: 'product' })[ty] && add(({ dataset: 'data', system: 'system', flow: 'flow', vendor: 'recipient', subprocessor: 'recipient', model: 'recipient', control: 'control', identifier: 'identity', feature: 'product', product: 'product' })[ty], x);
    });
  });
  /* 3 · expand data → systems, identities, purposes, products, flows, recipients */
  C.data.forEach(function (did) {
    var d = ENT[did].obj; add('system', d.system); if (d.product) add('product', d.product);
    P.dsIds(d).forEach(function (i) { add('identity', i); }); d.purposes.forEach(function (p) { add('purpose', p); });
    NS.models.forEach(function (m) { if (m.training.indexOf(did) >= 0) add('recipient', m.id); });
  });
  C.system.forEach(function (sid) {
    P.flowsFrom(sid).forEach(function (f) { if (f.tier >= 2) { add('flow', f.id); if (ENT[f.to] && ['vendor', 'subprocessor', 'model'].indexOf(ENT[f.to].type) >= 0) add('recipient', f.to); if (f.control) add('control', f.control); } });
    var s = ENT[sid].obj; if (s.region) add('region', s.region);
  });
  C.flow.forEach(function (fid) { var f = ENT[fid].obj; if (f.regionTo && ENT[f.regionTo]) add('region', f.regionTo); });
  C.recipient.forEach(function (rid) { var r = ENT[rid].obj; if (r.region && ENT[r.region]) add('region', r.region); });
  /* 4 · promises and decisions that bear on any of it */
  var anchor = [id].concat(C.finding, C.data, C.product);
  NS.promises.forEach(function (p) { if (anchor.some(function (a) { return P.promisesFor(a).indexOf(p) >= 0; })) add('promise', p.id); });
  if (t === 'promise') C.promise = [id];
  C.promise.forEach(function (pid) { var p = ENT[pid].obj; if (p.decision) add('decision', p.decision); (p.controls || []).forEach(function (c) { if (t === 'promise') add('control', c); }); });
  NS.decisions.forEach(function (d) { if (d.findings.some(function (f) { return C.finding.indexOf(f) >= 0; })) add('decision', d.id); });
  /* 5 · evidence and owners */
  C.evidence = C.control.slice();
  var owners = [];
  C.decision.forEach(function (x) { owners.push(ENT[x].obj.owner); });
  C.finding.forEach(function (x) { owners.push(ENT[x].obj.owner); });
  C.data.forEach(function (x) { owners.push(ENT[x].obj.owner); });
  C.system.forEach(function (x) { owners.push(ENT[x].obj.team); });
  P.uniq(owners).forEach(function (x) { add('owner', x); });
  var missingOwner = C.data.some(function (x) { return !ENT[x].obj.owner; }) || C.finding.some(function (x) { return !ENT[x].obj.owner; }) || C.decision.some(function (x) { return !ENT[x].obj.owner; });
  return { from: id, cols: C, missingOwner: missingOwner };
};
/* The chain strip: fourteen columns, two items each, the rest behind “+N”. */
P.chainHTML = function (id, opts) {
  opts = opts || {};
  var ch = P.chain(id); if (!ch) return '';
  var n = opts.max || 2;
  return '<nav class="chainx" aria-label="Chain from promise to owner">' + '<ol>' + P.CHAIN.map(function (c) {
    var ids = ch.cols[c[0]], shown = ids.slice(0, n), more = ids.length - shown.length;
    var body;
    if (c[0] === 'evidence') body = shown.map(function (cid) { var t = P.controlTest(cid); return '<button class="cx-i ev-' + t.result + '" data-ent="' + esc(cid) + '"><span>' + esc(t.evidence || 'no evidence') + '</span>' + P.freshTag(t.last) + '</button>'; }).join('');
    else body = shown.map(function (x) { return '<button class="cx-i" data-ent="' + esc(x) + '">' + esc(shortName(x)) + '</button>'; }).join('');
    if (!ids.length) body = c[0] === 'owner' || c[0] === 'decision' || c[0] === 'evidence' || c[0] === 'promise' ? unk(c[0] === 'owner' ? 'no owner' : c[0] === 'decision' ? 'no decision opened' : c[0] === 'promise' ? 'no published promise' : 'no evidence') : '<span class="cx-none">—</span>';
    if (c[0] === 'owner' && ch.missingOwner && ids.length) body += unk('+ unowned links');
    return '<li class="cx cx-' + c[0] + '"><span class="cx-k">' + esc(c[1]) + (ids.length ? ' <b>' + ids.length + '</b>' : '') + '</span>' + body +
      (more > 0 ? '<button class="cx-more" data-go="chain?from=' + encodeURIComponent(id) + '">+' + more + ' more</button>' : '') + '</li>';
  }).join('') + '</ol>' + (opts.link === false ? '' : '<a class="cx-open" href="#/chain?from=' + encodeURIComponent(id) + '">Open the full chain →</a>') + '</nav>';
};
function shortName(id) { var e = ENT[id]; if (!e) return id; if (e.type === 'finding' || e.type === 'decision') return id; if (e.type === 'promise') return id; var s = e.name; return s.length > 34 ? s.slice(0, 32) + '…' : s; }
P.shortName = shortName;

/* ── citations: every answer names its records ─────────────────── */
P.cite = function (ids, label) {
  ids = P.uniq(ids || []).filter(function (x) { return ENT[x]; });
  if (!ids.length) return '<p class="cite">' + unk('no source records — this answer cannot be shown') + '</p>';
  return '<p class="cite"><span class="cite-k">' + esc(label || 'Sources') + ' (' + ids.length + ')</span> ' + ids.map(function (x) { return P.chip(x); }).join(' ') + '</p>';
};

/* ── roles: one truth, four ways to act on it ──────────────────── */
P.perspectiveOf = function (personaId) {
  for (var i = 0; i < NS.perspectives.length; i++) if (NS.perspectives[i].roles.indexOf(personaId) >= 0) return NS.perspectives[i];
  return NS.perspectives[0];
};
var APPROVER = { cpo: 'CPO', ciso: 'CISO', counsel: 'Privacy Counsel' };
/* The action each perspective can take on a priority item. */
P.actionFor = function (item, pers, personaId) {
  var d = item.dec, rec = d && d.rec, t = d && d.test;
  switch (pers.id) {
    case 'lead':
      if (!d) return { verb: 'Open a decision', text: 'No decision exists for this promise yet. Ask the owner for options by next week.' };
      if (d.d.status !== 'owed') return { verb: 'Hold them to the test', text: 'You decided ' + (d.d.final ? d.d.final.option : '') + '. The fix is proven only when: ' + d.d.test.text };
      return { verb: 'Decide', text: 'Approve option ' + rec.id + ' — ' + rec.title + ' (' + rec.cost + '), or pick an alternative.' + (APPROVER[personaId] && d.d.approver === APPROVER[personaId] ? ' You are the approver.' : '') };
    case 'own':
      if (!d || !d.d.owner) return { verb: 'Assign', text: 'Nobody owns this. Name an accountable owner today; the SLA clock is already running.' };
      return { verb: 'Schedule', text: 'Plan option ' + (rec ? rec.id : '?') + ' in ' + P.name(d.d.owner) + '’s next sprint; due ' + (d.due ? P.hdate(d.due) : 'not set') + (d.overdue ? ' — already overdue.' : '.') };
    case 'over':
      var weak = item.state.tests.filter(function (x) { return x.weak; });
      return { verb: 'Challenge', text: weak.length ? 'Evidence is weak: ' + weak.slice(0, 2).map(function (x) { return x.control.name + ' (' + (x.result === 'never' ? 'never tested' : x.result + ', ' + x.fresh.label) + ')'; }).join('; ') + '. Require a re-test before attesting.' : 'Evidence is current. Confirm the promise text still matches what the systems do.' };
    default:
      return { verb: 'Fix', text: t ? 'Make this test pass: ' + d.d.test.text : 'Write the test that would prove this promise, then make it pass.' };
  }
};
/* Priority items: every promise that is not demonstrably kept, joined to its
 * decision, risk and chain. Ranking differs by perspective; the facts don't. */
P.priorityItems = function () {
  return NS.promises.map(function (p) {
    var st = P.promiseState(p);
    var dec = p.decision && ENT[p.decision] ? P.decision(ENT[p.decision].obj) : null;
    var risk = p.risk && ENT[p.risk] ? ENT[p.risk].obj : null;
    return { p: p, state: st, dec: dec, risk: risk, explain: P.explainRisk(risk, p) };
  }).filter(function (x) { return x.state.status !== 'KEPT'; });
};
var ORDER = { BROKEN: 0, 'AT RISK': 1, UNPROVEN: 2, KEPT: 3 };
P.priorities = function (personaId, team) {
  var pers = P.perspectiveOf(personaId), items = P.priorityItems();
  var score = {
    lead: function (x) { return ORDER[x.state.status] * 1e12 - x.state.people - (x.dec && APPROVER[personaId] && x.dec.d.approver === APPROVER[personaId] ? 1e11 : 0); },
    own: function (x) { var mine = team && (x.p.owner === team || (x.dec && x.dec.d.owner === team)); return (mine ? 0 : 1e13) + (x.dec && !x.dec.d.owner ? -1e12 : 0) + (x.dec && x.dec.due ? Date.parse(x.dec.due) / 1e3 : 9e9); },
    over: function (x) { return -x.state.tests.filter(function (t) { return t.weak; }).length * 1e6 + ORDER[x.state.status]; },
    build: function (x) { return -x.state.failing.length * 1e6 - (x.dec && x.dec.test && x.dec.test.result !== 'pass' ? 1e5 : 0) + ORDER[x.state.status] * 1e3; }
  }[pers.id];
  return items.sort(function (a, b) { return score(a) - score(b); }).map(function (x) { x.action = P.actionFor(x, pers, personaId); return x; });
};
})();
