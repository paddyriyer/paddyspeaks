/* Personas — who is looking decides what comes first.
 * Each persona owns ONE question. Its home shows the computed answer, the
 * few things that need that person, four indicators, and where to start.
 * Everything else stays one click away ("Everything else" on the home).
 * Nothing here types a number: every figure comes from a metric or from the
 * data, exactly as on the full Command Center. */
(function () {
'use strict';
var P = window.PCC, NS = window.NS, esc = P.esc, fmtN = P.fmtN;
var KEY = 'pcc.persona.v1';

/* ── extra metrics personas need (hidden from the full tile wall) ── */
function add(m) { m.hidden = true; P.METRICS.push(m); }
add({ id: 'blast', label: 'People in HIGH-risk assets (up to)', rule: 'Sum of people in assets whose residual risk is HIGH (Risk Radar model), capped at everyone Northstar serves. Overlaps are not removed, so this is an upper bound.', tone: 'hot', route: 'privacy/worstday',
  value: function () { return fmtN(Math.min(NS.org.people, NS.risks.filter(function (r) { return P.riskCalc(r).rating === 'HIGH'; }).reduce(function (s, r) { return s + P.get(r.asset).obj.people; }, 0))); },
  items: function () { return NS.risks.filter(function (r) { return P.riskCalc(r).rating === 'HIGH'; }).map(function (r) { return { id: r.asset, why: fmtN(P.get(r.asset).obj.people) + ' people · residual ' + P.riskCalc(r).residual }; }); } });
add({ id: 'access', label: 'Insider access signals this week', rule: 'Sensitive-query monitoring alerts: warehouse-wide reads, inactive accounts, bulk exports, unexpected joins, break-glass without a ticket, spikes.', tone: 'hot', route: 'assurance/access',
  items: function () { return NS.accessEvents.map(function (e) { return { id: e.data, why: e.flag + ' — ' + e.who }; }); } });
add({ id: 'blocked', label: 'Launches blocked', rule: 'Reviews with at least one open blocker: an open finding on the feature that is HIGH or marked blocking launch.', tone: 'hot', route: 'privacy/reviews',
  items: function () { return NS.reviews.filter(function (r) { return r.blockers; }).map(function (r) { return { id: r.feature, why: r.id + ' · ' + r.stage + ' · ' + r.blockers + ' blocker' + (r.blockers === 1 ? '' : 's') }; }); } });
add({ id: 'waiting', label: 'Reviews waiting', rule: 'Reviews in intake, triage or design review.', route: 'privacy/reviews',
  items: function () { return NS.reviews.filter(function (r) { return ['INTAKE', 'TRIAGE', 'DESIGN REVIEW'].indexOf(r.stage) >= 0; }).map(function (r) { return { id: r.feature, why: r.stage + ' · ' + r.age + ' d' }; }); } });
add({ id: 'drifted', label: 'Purpose-drift findings', rule: 'Open findings where data collected for one purpose is used for another.', tone: 'hot', route: 'privacy/purpose',
  items: function () { return P.openFindings().filter(function (f) { return /PURPOSE/.test(f.kind); }).map(function (f) { return { id: f.id, why: f.kind }; }); } });
add({ id: 'failing', label: 'Controls failing', rule: 'Controls whose health check reports failing.', tone: 'hot', route: 'assurance/controls',
  items: function () { return NS.controls.filter(function (c) { return c.health === 'failing'; }).map(function (c) { return { id: c.id, why: 'L' + c.level + ' · ' + c.evidence }; }); } });
add({ id: 'gaps', label: 'Obligations with a gap', rule: 'Mapped obligations whose status is gap or partial (orientation, not legal advice).', tone: 'hot', route: 'governance/regulations',
  items: function () { var o = []; NS.regulations.forEach(function (r) { r.obligations.forEach(function (x) { if (x.status !== 'met') o.push({ id: x.data, why: r.name + ': ' + x.text + ' — ' + x.status }); }); }); return o; } });
add({ id: 'noverify', label: 'Datasets without verified deletion', rule: 'Personal datasets whose deletion has not been verified by a scan.', tone: 'hot', route: 'privacy/deletion',
  items: function () { return P.personalDatasets().filter(function (d) { return !d.deletionVerified; }).map(function (d) { return { id: d.id, why: d.deletion }; }); } });
add({ id: 'aireview', label: 'AI systems not reviewed since change', rule: 'Models whose privacy review is missing, pending, older than 180 days, or predates a material change.', tone: 'hot', route: 'privacy/ai',
  items: function () { return NS.models.filter(function (m) { var d = (m.review.match(/^approved (\d{4}-\d{2}-\d{2})/) || [])[1]; return !d || P.daysSince(d) > 180 || /before/.test(m.review); }).map(function (m) { return { id: m.id, why: m.review }; }); } });
add({ id: 'duesoon', label: 'Findings due in 14 days', rule: 'Open findings due within 14 days or overdue.', tone: 'hot', route: 'report/engineering',
  items: function () { return P.openFindings().filter(function (f) { return P.daysUntil(f.due) <= 14; }).map(function (f) { return { id: f.id, why: 'due ' + f.due }; }); } });

/* ── helpers for "needs you" items ─────────────────────── */
function fItem(f, why) { return { id: f.id, title: f.title, why: why || f.human, sev: f.sev, meta: (f.owner ? P.name(f.owner) : 'NO OWNER') + ' · due ' + f.due }; }
function highs(filter) { return P.openFindings().filter(function (f) { return f.sev === 'HIGH' && (!filter || filter(f)); }); }
function byRisk(list) { var rOf = function (f) { var m = 0; NS.risks.forEach(function (r) { if (r.findings.indexOf(f.id) >= 0) m = Math.max(m, P.riskCalc(r).residual); }); return m; }; return list.slice().sort(function (a, b) { return rOf(b) - rOf(a) || b.people - a.people; }); }

/* ── the personas ───────────────────────────────────────── */
var GROUPS = ['Leadership', 'Managers & owners', 'Oversight', 'Builders'];
var PERSONAS = [
  { id: 'cpo', name: 'Chief Privacy Officer', group: 'Leadership', hat: 'reviewer', q: 'Where are we breaking a promise to people — and which decision do I owe this week?',
    kpis: ['highfind', 'drifted', 'consentfail', 'delfail'],
    items: function () { return P.risksSorted().filter(function (r) { return P.riskCalc(r).rating === 'HIGH'; }).map(function (r) { return { id: r.id, title: r.name, why: r.why.slice(0, 3).join(' · '), sev: 'HIGH', go: 'report/executive?r=' + r.id, cta: 'Decision memo', meta: 'residual ' + P.riskCalc(r).residual }; }); },
    start: [['report/executive', 'Decision memos', 'Trade-offs, not schema diagrams'], ['privacy/risks', 'Risk radar', 'Why each risk is rated as it is'], ['explore/person', 'One person', 'What we could know about a customer'], ['governance/maturity', 'Maturity', 'Where the programme is weakest']] },
  { id: 'ciso', name: 'CISO / Security VP', group: 'Leadership', hat: 'auditor', q: 'If we were breached tomorrow, how much would it hurt — and which doors are open?',
    kpis: ['blast', 'access', 'undeclared', 'incidents'],
    items: function () {
      var r = P.risksSorted().filter(function (x) { return P.riskCalc(x).rating === 'HIGH'; }).map(function (x) { var d = P.get(x.asset).obj; return { id: x.asset, title: 'Worst day: ' + d.name, why: fmtN(d.people) + ' people · ' + (d.accessPeople == null ? 'unknown' : d.accessPeople) + ' people with access · keys: ' + d.keyOwner, sev: 'HIGH', go: 'privacy/worstday', cta: 'Blast radius' }; });
      var a = NS.accessEvents.filter(function (e) { var o = P.get(e.data); return o && o.type === 'dataset' && P.dsTier(o.obj) >= 3; }).map(function (e) { return { id: e.data, title: e.flag.charAt(0).toUpperCase() + e.flag.slice(1), why: e.who + ' — ' + e.what, sev: 'HIGH', go: 'assurance/access', cta: 'Access signals' }; });
      return r.concat(a);
    },
    start: [['privacy/worstday', 'Worst day', 'Blast radius under six architectures'], ['assurance/access', 'Access & insider', 'Who can reach sensitive data'], ['explore/vendors', 'Vendor egress', 'What leaves, to whom'], ['assurance/incidents', 'Incidents', 'Failed assumptions and permanent guards']] },
  { id: 'cto', name: 'CTO', group: 'Leadership', hat: 'builder', q: 'Which privacy controls are real machines — and which are still paper?',
    kpis: ['paper', 'runtime', 'failing', 'unmapped'],
    items: function () { return NS.controls.filter(function (c) { return c.level <= 1 || c.health === 'failing'; }).sort(function (a, b) { return a.level - b.level; }).map(function (c) { return { id: c.id, title: c.name, why: 'Today: L' + c.level + ' ' + P.LEVELS[c.level] + ' (' + c.health + '). ' + c.evidence, sev: c.level === 0 ? 'HIGH' : 'MEDIUM', cta: 'Control' }; }); },
    start: [['assurance/controls', 'Enforcement ladder', 'Policy → runtime → audit'], ['explore/flows', 'Data flows', 'Every arrow is a decision'], ['report/engineering', 'Engineering report', 'Findings by team and due date'], ['explore/graph', 'Knowledge graph', 'How it all connects']] },
  { id: 'exec', name: 'Executive / Board', group: 'Leadership', hat: 'reviewer', q: 'Are we exposed in a way that could hurt customers or make the news — and what are our options?',
    kpis: ['highfind', 'blast', 'incidents', 'aipersonal'],
    items: function () { return P.risksSorted().slice(0, 3).map(function (r) { var c = P.riskCalc(r); return { id: r.id, title: r.name, why: r.why[0] + '; ' + (r.why[1] || ''), sev: c.rating, go: 'report/executive?r=' + r.id, cta: 'Options A/B/C' }; }); },
    start: [['report/executive', 'Executive memo', 'Issue, options, recommendation'], ['privacy/worstday', 'Worst day', 'What a breach would expose'], ['governance/maturity', 'Maturity', 'Eighteen capabilities, honestly scored']] },

  { id: 'em', name: 'Engineering Manager', group: 'Managers & owners', hat: 'builder', team: true, q: 'What does my team have to fix, by when — and what is blocking launch?',
    kpis: ['team:open', 'team:due', 'team:blocked', 'team:controls'],
    items: function (t) { return P.openFindings().filter(function (f) { return f.owner === t; }).sort(function (a, b) { return a.due < b.due ? -1 : 1; }).map(function (f) { var d = P.daysUntil(f.due); return fItem(f, 'First step: ' + f.mitigations[0] + '. Must reach L' + f.enforcement + ' ' + P.LEVELS[f.enforcement] + '.'); }).map(function (x) { var f = P.get(x.id).obj, d = P.daysUntil(f.due); x.meta = (d < 0 ? Math.abs(d) + ' d overdue' : 'due in ' + d + ' d') + ' · ' + fmtN(f.people) + ' people'; return x; }); },
    start: [['report/engineering', 'Engineering report', 'Every team’s open findings'], ['privacy/reviews', 'Reviews', 'Where your launches sit'], ['assurance/controls', 'Enforcement ladder', 'Controls your team owns']] },
  { id: 'pm', name: 'Product Manager', group: 'Managers & owners', hat: 'reviewer', q: 'Can my feature launch — and what would make it easier to say yes?',
    kpis: ['blocked', 'waiting', 'drifted', 'highfind'],
    items: function () { return NS.reviews.filter(function (r) { return r.blockers || r.risk === 'HIGH' && r.stage !== 'POST-LAUNCH AUDIT'; }).map(function (r) { var ff = P.get(r.feature).obj; return { id: r.feature, title: ff.name + ' — ' + r.stage.toLowerCase(), why: (r.blockers ? r.blockers + ' launch blocker. ' : '') + (NS.eightQ[r.feature] ? 'Reduce: ' + NS.eightQ[r.feature].REDUCE : 'Eight questions not yet answered.'), sev: r.risk, go: 'privacy/reviews/' + r.feature, cta: 'Workbench' }; }); },
    start: [['privacy/reviews', 'Reviews', 'Intake → launch gate → audit'], ['explore/products', 'Products & features', 'Your product’s findings'], ['privacy/purpose', 'Purpose', 'Which uses need a new basis'], ['explore/person', 'One person', 'What your feature adds to a profile']] },
  { id: 'gov', name: 'Data Governance Lead', group: 'Managers & owners', hat: 'auditor', q: 'Does every personal dataset have an owner, a purpose and a clock?',
    kpis: ['noowner', 'nottl', 'retviol', 'personal'],
    items: function () { return P.personalDatasets().map(function (d) { return [d, P.six(d)]; }).filter(function (x) { return ['WHY', 'FROM', 'WHEN'].some(function (k) { return x[1][k] !== 'y'; }); }).map(function (x) { return { id: x[0].id, title: x[0].name, why: x[1].why.filter(function (w) { return ['WHY', 'FROM', 'WHEN'].indexOf(w[0]) >= 0; }).map(function (w) { return w[1]; }).join(' · '), sev: x[1].WHY === 'u' || x[1].FROM === 'u' ? 'HIGH' : 'MEDIUM', cta: 'Passport' }; }); },
    start: [['explore/data', 'Data & classification', 'Tiers and the six questions'], ['explore/org', 'Organization', 'Owner by owner'], ['privacy/retention', 'Retention', 'Required vs actual'], ['privacy/purpose', 'Purpose', 'Declared vs used']] },

  { id: 'counsel', name: 'Privacy Counsel', group: 'Oversight', hat: 'reviewer', q: 'Which obligations lack a working control — and what evidence would we show?',
    kpis: ['gaps', 'consentfail', 'undeclared', 'hivendor'],
    items: function () { var o = []; NS.regulations.forEach(function (r) { r.obligations.forEach(function (x) { if (x.status !== 'met') o.push({ id: r.id, title: r.name + ' — ' + x.text, why: x.note + (x.control ? '' : ' · no control mapped'), sev: x.status === 'gap' ? 'HIGH' : 'MEDIUM', go: 'governance/regulations', cta: 'Mapping' }); }); }); return o; },
    start: [['report/legal', 'Privacy / legal report', 'Gaps engineering must close'], ['governance/regulations', 'Regulations', 'Obligation → control → evidence'], ['governance/vendors', 'Vendor register', 'Contracts, retention, deletion']] },
  { id: 'compliance', name: 'Compliance', group: 'Oversight', hat: 'auditor', q: 'Could we prove it to a regulator today?',
    kpis: ['gaps', 'noverify', 'paper', 'failing'],
    items: function () { return P.personalDatasets().filter(function (d) { return P.six(d).PROVE !== 'y'; }).map(function (d) { var w = P.six(d).why.filter(function (x) { return x[0] === 'PROVE'; })[0]; return { id: d.id, title: d.name + ': cannot prove', why: w ? w[1] : 'no evidence', sev: P.dsTier(d) >= 3 ? 'HIGH' : 'MEDIUM', cta: 'Passport' }; }); },
    start: [['governance/regulations', 'Regulations', 'What each obligation needs'], ['assurance/evidence', 'Evidence', 'What proves each control'], ['report/audit', 'Audit report', 'Operational metrics']] },
  { id: 'auditor', name: 'Internal Auditor', group: 'Oversight', hat: 'auditor', q: 'What actually happens in production — and does it match the documents?',
    kpis: ['failing', 'delfail', 'drift', 'paper'],
    items: function () { return NS.assumptionTests.filter(function (t) { return t.result !== 'pass'; }).map(function (t) { return { id: t.ent, title: t.k + ' — ' + t.result, why: t.where, sev: t.result === 'fail' ? 'HIGH' : 'MEDIUM', go: 'assurance/audits', cta: 'Audit' }; }); },
    start: [['assurance/audits', 'Audits', 'Assumption bugs, tested'], ['assurance/drift', 'Drift', 'What changed since launch'], ['assurance/evidence', 'Evidence', 'Proof per control'], ['report/audit', 'Audit report', 'Metrics that describe behaviour']] },

  { id: 'priveng', name: 'Privacy Engineer', group: 'Builders', hat: 'builder', q: 'Which unknowns and failing controls should become machine-checked invariants?',
    kpis: ['noowner', 'unmapped', 'paper', 'delfail'],
    items: function () { return byRisk(P.openFindings().filter(function (f) { return /UNKNOWN|DELETION|CONSENT/.test(f.kind) || f.enforcement >= 4; })).slice(0, 6).map(function (f) { return fItem(f, 'Invariant to build: ' + f.mitigations[0] + ' → L' + f.enforcement + ' ' + P.LEVELS[f.enforcement]); }); },
    start: [['explore/graph', 'Knowledge graph', 'Forward and backward'], ['explore/identities', 'Identities', 'Joins nobody sanctioned'], ['privacy/deletion', 'Forget me', 'Where deletion cannot be proven'], ['assurance/controls', 'Enforcement ladder', 'Move it into machines']] },
  { id: 'dataeng', name: 'Data Engineer', group: 'Builders', hat: 'builder', q: 'Which of my tables break retention, consent or deletion?',
    kpis: ['nottl', 'retviol', 'consentfail', 'noverify'],
    items: function () { return NS.datasets.filter(function (d) { var r = d.retention; return (r.required > 0 && r.actual > r.required) || (!r.ttl && r.note == null) || !d.deletionVerified; }).filter(function (d) { return P.dsTier(d) >= 2; }).map(function (d) { var r = d.retention, w = []; if (r.required > 0 && r.actual > r.required) w.push('kept ' + P.fmtDays(r.actual) + ' vs ' + P.fmtDays(r.required)); if (!r.ttl && r.note == null) w.push('no TTL'); if (!d.deletionVerified) w.push('deletion not verified'); return { id: d.id, title: d.name, why: w.join(' · '), sev: r.required > 0 && r.actual > r.required ? 'HIGH' : 'MEDIUM', cta: 'Passport' }; }); },
    start: [['privacy/retention', 'Retention', 'Required vs actual'], ['privacy/consent', 'Consent', 'Who never gets a revocation'], ['explore/data', 'Data', 'Tier defaults per table'], ['privacy/deletion', 'Forget me', 'Your systems in the fan-out']] },
  { id: 'swe', name: 'Software Engineer', group: 'Builders', hat: 'builder', q: 'What personal data does my service log, send or keep — and what should I change?',
    kpis: ['sdks', 'undeclared', 'unmapped', 'duesoon'],
    items: function () { return byRisk(P.openFindings().filter(function (f) { return /LOGGING|EGRESS|TRACKING|NEW SENSITIVE FIELD|LONG-LIVED|SUBPROCESSOR/.test(f.kind); })).map(function (f) { return fItem(f, 'Change: ' + f.mitigations.slice(0, 2).join('; ')); }); },
    start: [['explore/flows', 'Data flows', 'What your service sends where'], ['privacy/tracking', 'Tracking', 'SDKs and pixels in your pages'], ['explore/systems', 'Systems', 'Your service’s passport']] },
  { id: 'seceng', name: 'Security Engineer', group: 'Builders', hat: 'auditor', q: 'Who and what can reach sensitive data — and is that access justified?',
    kpis: ['access', 'blast', 'runtime', 'incidents'],
    items: function () { return NS.accessEvents.map(function (e) { return { id: e.data, title: e.flag.charAt(0).toUpperCase() + e.flag.slice(1), why: e.who + ' (' + e.kind + ') — ' + e.what, sev: /break-glass|inactive|bulk|identity/.test(e.flag) ? 'HIGH' : 'MEDIUM', go: 'assurance/access', cta: 'Access' }; }); },
    start: [['assurance/access', 'Access & insider', 'Signals and who can read what'], ['privacy/worstday', 'Worst day', 'Blast radius'], ['explore/geo', 'Geography', 'Where copies live']] },
  { id: 'mleng', name: 'AI / ML Engineer', group: 'Builders', hat: 'builder', q: 'What do my models learn, keep and leak — and can they forget?',
    kpis: ['aipersonal', 'aiprov', 'aireview', 'delfail'],
    items: function () { return NS.models.filter(function (m) { return m.provenance !== 'documented' || /full/.test(m.promptLogging) || /not tested/.test(m.memorization) || /unknown|none/.test(m.deletionPath); }).map(function (m) { var w = []; if (m.provenance !== 'documented') w.push('provenance ' + m.provenance); if (/full/.test(m.promptLogging)) w.push('full prompt logs'); if (/not tested/.test(m.memorization)) w.push('memorisation not tested'); if (/unknown|none/.test(m.deletionPath)) w.push('cannot forget: ' + m.deletionPath); return { id: m.id, title: m.name + ' · ' + m.hosting.toLowerCase(), why: w.join(' · '), sev: m.sensitive ? 'HIGH' : 'MEDIUM', cta: 'Model card' }; }); },
    start: [['privacy/ai', 'AI / ML', 'Every model, where it thinks'], ['privacy/pets', 'PETs & DP', 'Techniques by threat'], ['privacy/deletion', 'Forget me', 'Can training data be deleted']] }
];
P.PERSONAS = PERSONAS;
function byId(id) { for (var i = 0; i < PERSONAS.length; i++) if (PERSONAS[i].id === id) return PERSONAS[i]; return null; }

/* team-scoped indicators for the Engineering Manager */
function teamKpi(k, t) {
  var open = P.openFindings().filter(function (f) { return f.owner === t; });
  if (k === 'team:open') return { label: 'Open findings for ' + P.name(t), v: open.length, tone: open.length ? 'hot' : 'good', list: open.map(function (f) { return { id: f.id, why: f.sev + ' · due ' + f.due }; }), rule: 'Open findings assigned to this team.' };
  if (k === 'team:due') { var d = open.filter(function (f) { return P.daysUntil(f.due) <= 14; }); return { label: 'Due in 14 days', v: d.length, tone: d.length ? 'hot' : 'good', list: d.map(function (f) { return { id: f.id, why: 'due ' + f.due }; }), rule: 'This team’s open findings due within 14 days or overdue.' }; }
  if (k === 'team:blocked') { var fs = NS.features.filter(function (x) { return P.get(x.product).obj.team === t || NS.systems.some(function (s) { return s.feature === x.id && s.team === t; }); }).map(function (x) { return x.id; }); var b = NS.reviews.filter(function (r) { return fs.indexOf(r.feature) >= 0 && (r.blockers || r.drift); }); return { label: 'Launches blocked / drifting', v: b.length, tone: b.length ? 'hot' : 'good', list: b.map(function (r) { return { id: r.feature, why: r.stage + (r.blockers ? ' · blocker' : '') + (r.drift ? ' · drift' : '') }; }), rule: 'Reviews for this team’s features with a launch blocker or post-launch drift.' }; }
  var c = NS.controls.filter(function (x) { return x.owner === t; }); var bad = c.filter(function (x) { return x.health !== 'working' || x.level <= 1; });
  return { label: 'Controls owned needing work', v: bad.length + ' / ' + c.length, tone: bad.length ? 'hot' : 'good', list: bad.map(function (x) { return { id: x.id, why: 'L' + x.level + ' · ' + x.health }; }), rule: 'Controls owned by this team that are failing, unknown, or only on paper / human review.' };
}

/* ── state ─────────────────────────────────────────────── */
function load() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
function save(v) { try { if (v) localStorage.setItem(KEY, v); else localStorage.removeItem(KEY); } catch (e) { /* storage blocked: selection lasts for this visit */ } }
P.state.team = P.state.team || 't_fraud';
P.setPersona = function (id) {
  var p = byId(id); P.persona = p; save(p ? p.id : '');
  var sel = document.getElementById('personaSel'); if (sel) sel.value = p ? p.id : '';
  if (p) P.setRole(p.hat);
  P.renderNav();
  if ((P.route.path === 'overview' || P.route.path === '') && !(P.route.q && (P.route.q.all || P.route.q.as))) P.render(); else P.go('overview');
};
P.initPersona = function () {
  var q = (location.hash.split('?')[1] || '').match(/(?:^|&)as=([a-z]+)/);
  var id = q ? q[1] : load();
  P.persona = byId(id);
  if (q && P.persona) save(P.persona.id);
  var sel = document.getElementById('personaSel');
  sel.innerHTML = '<option value="">Choose a role…</option>' + GROUPS.map(function (g) { return '<optgroup label="' + esc(g) + '">' + PERSONAS.filter(function (p) { return p.group === g; }).map(function (p) { return '<option value="' + p.id + '">' + esc(p.name) + '</option>'; }).join('') + '</optgroup>'; }).join('') + '<option value="__all">Everyone — full Command Center</option>';
  sel.value = P.persona ? P.persona.id : (/[?&]all=1/.test(location.hash) ? '__all' : '');
  sel.addEventListener('change', function () { if (sel.value === '__all') { P.persona = null; save(''); P.renderNav(); P.go('overview?all=1'); sel.value = '__all'; return; } P.setPersona(sel.value); });
};
P.forYouNav = function () {
  var p = P.persona; if (!p) return '';
  return '<h2>For you · ' + esc(p.name) + '</h2>' + p.start.map(function (s) { return '<a href="#/' + s[0] + '" data-route="' + s[0].split('?')[0] + '">' + esc(s[1]) + '</a>'; }).join('');
};
P.acts.pickPersona = function (el) { P.setPersona(el.getAttribute('data-id')); window.scrollTo(0, 0); };
P.acts.changePersona = function () { P.persona = null; save(''); P.renderNav(); var s = document.getElementById('personaSel'); if (s) s.value = ''; P.render(); };

/* ── picker ────────────────────────────────────────────── */
function picker() {
  return '<section class="pk"><p class="eyebrow">Northstar · synthetic demo data</p><h1 class="pk-h">Who’s looking?</h1>' +
    '<p class="lede">Every role owns one question. Pick yours and the Command Center shows the answer, the few things that need you, and where to start. Everything else stays one click away.</p>' +
    GROUPS.map(function (g) {
      return '<h2 class="pk-g">' + esc(g) + '</h2><div class="pk-grid">' + PERSONAS.filter(function (p) { return p.group === g; }).map(function (p) {
        var n = p.team ? P.openFindings().filter(function (f) { return f.owner === P.state.team; }).length : p.items(P.state.team).length;
        return '<button class="pk-card" data-act="pickPersona" data-id="' + p.id + '"><span class="pk-name">' + esc(p.name) + '</span><span class="pk-q">“' + esc(p.q) + '”</span><span class="pk-n">' + n + ' item' + (n === 1 ? '' : 's') + ' need' + (n === 1 ? 's' : '') + ' this role →</span></button>';
      }).join('') + '</div>';
    }).join('') +
    '<p class="small dim" style="margin-top:22px"><a href="#/overview?all=1">Skip — show the full Command Center for everyone</a></p></section>';
}

/* ── persona home ──────────────────────────────────────── */
function kpiTile(k, t) {
  if (/^team:/.test(k)) { var x = teamKpi(k, t); return '<button class="tile ' + x.tone + '" data-act="teamKpi" data-k="' + k + '" title="' + esc(x.rule) + '"><span class="v">' + x.v + '</span><span class="l">' + esc(x.label) + '</span><span class="d">why? →</span></button>'; }
  var m = P.metric(k), n = m.value ? m.value() : m.items().length;
  return '<button class="tile ' + (m.tone || '') + '" data-metric="' + m.id + '" title="' + esc(m.rule) + '"><span class="v">' + n + '</span><span class="l">' + esc(m.label) + '</span><span class="d">why? →</span></button>';
}
P.acts.teamKpi = function (el) {
  var x = teamKpi(el.getAttribute('data-k'), P.state.team);
  P.openHTML(x.label, '<p class="pp-type">Indicator · ' + esc(P.name(P.state.team)) + '</p><h2 class="pp-title">' + esc(x.label) + '</h2><div class="why"><div class="wl">HOW THIS NUMBER IS COMPUTED</div><p>' + esc(x.rule) + '</p></div><div class="tbl-wrap"><table class="tbl"><tbody>' + (x.list.length ? x.list.map(function (it) { return '<tr class="click" data-ent="' + esc(it.id) + '" tabindex="0"><td><b>' + esc(P.name(it.id)) + '</b></td><td class="small muted">' + esc(it.why) + '</td></tr>'; }).join('') : '<tr><td class="ok">Nothing — good.</td></tr>') + '</tbody></table></div>', 'Indicator');
};
function hotKpis(p, t) { return p.kpis.filter(function (k) { if (/^team:/.test(k)) return teamKpi(k, t).tone === 'hot'; var m = P.metric(k); return m.tone === 'hot' && (m.value ? m.value() !== '0' : m.items().length > 0); }).length; }
function home(p) {
  var t = P.state.team, items = p.items(t), top = items.slice(0, 5);
  var answer = items.length ? '<b>' + items.length + ' thing' + (items.length === 1 ? '' : 's') + ' need' + (items.length === 1 ? 's' : '') + ' you.</b> Start with ' + esc(top[0].title) + '.' : (hotKpis(p, t) ? '<b>No open items assigned to you.</b> But ' + hotKpis(p, t) + ' of your indicators below need a look.' : '<b>Nothing needs you right now.</b> The indicators below will say when that changes.');
  var teamSel = p.team ? '<label class="small muted" style="display:inline-flex;gap:8px;align-items:center;margin-top:12px">Your team <select id="teamSel">' + NS.teams.filter(function (x) { return x.id !== 't_privacy'; }).map(function (x) { return '<option value="' + x.id + '"' + (x.id === t ? ' selected' : '') + '>' + esc(x.name) + '</option>'; }).join('') + '</select></label>' : '';
  var cards = top.map(function (it, i) {
    var link = it.go ? 'data-go="' + esc(it.go) + '"' : 'data-ent="' + esc(it.id) + '"';
    return '<div class="need" ' + link + ' role="button" tabindex="0"><span class="need-n">' + (i + 1) + '</span><div class="need-b"><div class="need-t">' + esc(it.title) + '</div><div class="need-w">' + esc(it.why) + '</div>' + (it.meta ? '<div class="need-m">' + esc(it.meta) + '</div>' : '') + '</div><div class="need-r">' + (it.sev ? P.sev(it.sev) : '') + '<span class="need-cta">' + esc(it.cta || 'Open') + ' →</span></div></div>';
  }).join('');
  return '<section class="ph"><div class="ph-top"><span class="ph-who">Viewing as <b>' + esc(p.name) + '</b></span><button class="chip" data-act="changePersona">Change role</button></div>' +
    '<h1 class="ph-q">' + esc(p.q) + '</h1><p class="ph-a">' + answer + '</p>' + teamSel + '</section>' +
    '<section class="ph-grid"><div><h2 class="ph-sec">What needs you</h2>' + (cards || '<p class="ok">Nothing open.</p>') + (items.length > 5 ? '<p class="small dim" style="margin:8px 2px 0">+ ' + (items.length - 5) + ' more — open the views under “Start here”.</p>' : '') + '</div>' +
    '<div><h2 class="ph-sec">Your four indicators</h2><div class="ph-kpis">' + p.kpis.map(function (k) { return kpiTile(k, t); }).join('') + '</div>' +
    '<h2 class="ph-sec" style="margin-top:22px">Start here</h2><div class="ph-start">' + p.start.map(function (s) { return '<a class="ph-go" href="#/' + s[0] + '"><b>' + esc(s[1]) + '</b><span>' + esc(s[2]) + '</span></a>'; }).join('') + '</div></div></section>' +
    '<details class="ph-more"><summary>Everything else — the full Command Center (all indicators, worry map, drift)</summary><div class="ph-more-b">' + P.fullOverview.render() + '</div></details>';
}

P.views.overview = { title: 'Command Center', render: function (s, q) {
  if (q && q.all) return P.fullOverview.render();
  /* #/overview?as=ciso works on any navigation, not only a fresh load. */
  if (q && q.as && byId(q.as) && (!P.persona || P.persona.id !== q.as)) { P.persona = byId(q.as); save(P.persona.id); var sel = document.getElementById('personaSel'); if (sel) sel.value = P.persona.id; P.setRole(P.persona.hat); setTimeout(P.renderNav, 0); }
  return P.persona ? home(P.persona) : picker();
}, mount: function (root, s, q) {
  var ts = root.querySelector('#teamSel'); if (ts) ts.addEventListener('change', function () { P.state.team = ts.value; P._keepScroll = true; P.render(); });
  if ((q && q.all) || P.persona) { if (P.fullOverview.mount) P.fullOverview.mount(root); }
  var d = root.querySelector('.ph-more'); if (d) d.addEventListener('toggle', function () { if (d.open && P.fullOverview.mount) P.fullOverview.mount(root); });
} };
})();
