/* Privacy Command Center — core.
 * Builds the privacy knowledge graph from data.js, derives every metric from
 * it (each with the rule that produced it), and provides the router, the
 * evidence drawer (Privacy Passports), the trail, search, and the analyst.
 * Views live in views-*.js and register into PCC.views. */
(function () {
'use strict';
var NS = window.NS;
var P = window.PCC = { views: {}, passports: {}, acts: {}, state: { role: 'reviewer', trail: [], drawerStack: [] } };
var TODAY = new Date(NS.TODAY + 'T12:00:00Z');

/* ── tiny helpers ─────────────────────────────────────────── */
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function fmtN(n) {
  if (n == null) return '—';
  if (n >= 1e9) return (n / 1e9).toFixed(1).replace(/\.0$/, '') + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace(/\.0$/, '') + 'M';
  if (n >= 1e4) return Math.round(n / 1e3) + 'K';
  return n.toLocaleString('en-US');
}
function fmtDays(d) {
  if (d == null) return null;
  if (d === 0) return 'lifetime of source';
  if (d >= 730) return (d / 365).toFixed(d % 365 ? 1 : 0).replace(/\.0$/, '') + ' yr';
  if (d >= 60) return Math.round(d / 30.4) + ' mo';
  return d + ' d';
}
function daysSince(iso) { if (!iso) return null; return Math.round((TODAY - new Date(iso + (iso.length === 10 ? 'T12:00:00Z' : ':00Z'))) / 864e5); }
function daysUntil(iso) { var d = daysSince(iso); return d == null ? null : -d; }
function unk(label) { return '<em class="unknown" title="Unknown — and therefore a finding">' + esc(label || 'UNKNOWN') + '</em>'; }
function pct(a, b) { return b ? Math.round(100 * a / b) : 0; }
function uniq(a) { var s = {}; return a.filter(function (x) { if (x == null || s[x]) return false; s[x] = 1; return true; }); }
function by(k) { return function (a, b) { return a[k] < b[k] ? -1 : a[k] > b[k] ? 1 : 0; }; }
function quantile(arr, q) { var a = arr.slice().sort(function (x, y) { return x - y; }); if (!a.length) return null; var i = (a.length - 1) * q, lo = Math.floor(i), hi = Math.ceil(i); return a[lo] + (a[hi] - a[lo]) * (i - lo); }
function fmtSecs(s) { if (s == null) return '∞'; if (s < 1) return Math.round(s * 1000) + ' ms'; if (s < 90) return Math.round(s) + ' s'; if (s < 5400) return Math.round(s / 60) + ' min'; if (s < 172800) return Math.round(s / 3600) + ' h'; return Math.round(s / 86400) + ' d'; }
P.esc = esc; P.fmtN = fmtN; P.fmtDays = fmtDays; P.daysSince = daysSince; P.daysUntil = daysUntil; P.unk = unk; P.pct = pct; P.uniq = uniq; P.by = by; P.quantile = quantile; P.fmtSecs = fmtSecs;

/* ── entity registry ─────────────────────────────────────── */
var ENT = P.ENT = {};
var TYPE_LABEL = P.TYPE_LABEL = { bu: 'Business unit', team: 'Owner', product: 'Product', feature: 'Feature', system: 'System', dataset: 'Dataset',
  identifier: 'Identifier', vendor: 'Vendor', subprocessor: 'Subprocessor', flow: 'Data flow', model: 'Model', control: 'Control', finding: 'Finding',
  risk: 'Risk', incident: 'Incident', regulation: 'Regulation', purpose: 'Purpose', consumer: 'Consent consumer', tracker: 'Tracker', pet: 'PET',
  region: 'Region', endpoint: 'Endpoint' };
function reg(id, type, obj, name) { ENT[id] = { id: id, type: type, obj: obj, name: name || obj.name || obj.label || id }; }
NS.bus.forEach(function (o) { reg(o.id, 'bu', o); });
NS.teams.forEach(function (o) { reg(o.id, 'team', o); });
NS.products.forEach(function (o) { reg(o.id, 'product', o); });
NS.features.forEach(function (o) { reg(o.id, 'feature', o); });
NS.systems.forEach(function (o) { reg(o.id, 'system', o); });
NS.datasets.forEach(function (o) { reg(o.id, 'dataset', o); });
NS.identifiers.forEach(function (o) { reg(o.id, 'identifier', o); });
NS.vendors.forEach(function (o) { reg(o.id, 'vendor', o); });
NS.subprocessors.forEach(function (o) { reg(o.id, 'subprocessor', o); });
NS.models.forEach(function (o) { reg(o.id, 'model', o); });
NS.controls.forEach(function (o) { reg(o.id, 'control', o); });
NS.findings.forEach(function (o) { reg(o.id, 'finding', o, o.id + ' · ' + o.title); });
NS.risks.forEach(function (o) { reg(o.id, 'risk', o); });
NS.incidents.forEach(function (o) { reg(o.id, 'incident', o, o.id + ' · ' + o.title); });
NS.regulations.forEach(function (o) { reg(o.id, 'regulation', o); });
NS.purposes.forEach(function (o) { reg(o.id, 'purpose', o, o.id); });
NS.consentConsumers.forEach(function (o) { reg(o.id, 'consumer', o); });
NS.trackers.forEach(function (o) { reg(o.id, 'tracker', o); });
NS.pets.forEach(function (o) { reg(o.id, 'pet', o); });
NS.regions.forEach(function (o) { reg(o.id, 'region', o, o.label); });
reg('n_app', 'endpoint', { id: 'n_app', name: 'Mobile apps (user device)', kind: 'device' });
reg('n_web', 'endpoint', { id: 'n_web', name: 'Web & browser extension (user device)', kind: 'device' });
reg('n_dash', 'endpoint', { id: 'n_dash', name: 'Executive dashboards', kind: 'dashboard' });
reg('s_lochist_eu', 'system', { id: 's_lochist_eu', name: 'Location replica (EU)', kind: 'store', team: 't_location', region: 'eu-west', product: 'p_storefront', parent: 's_lochist' });
NS.flows.forEach(function (f) { reg(f.id, 'flow', f, (ENT[f.from] ? ENT[f.from].name : f.from) + ' → ' + (ENT[f.to] ? ENT[f.to].name : f.to)); });
P.get = function (id) { return ENT[id]; };
P.name = function (id) { return ENT[id] ? ENT[id].name : id; };

/* field name → identifier */
var FIELD_ID = P.FIELD_ID = { customer_id: 'i_customer', account_id: 'i_customer', user_id: 'i_customer', parent_customer_id: 'i_customer', auth_subject: 'i_customer',
  email: 'i_email', email_in_query: 'i_email', phone: 'i_phone', phone_hash: 'i_phone', device_id: 'i_device', maid: 'i_maid', ip_address: 'i_ip',
  hashed_email: 'i_hemail', payment_token: 'i_token', loyalty_id: 'i_loyalty', pulse_user_id: 'i_pulse', device_fingerprint: 'i_fp',
  sender_pseudonym: 'i_msgpseudo', recipient_pseudonym: 'i_msgpseudo', cookie_id: 'i_cookie' };
P.dsTier = function (d) { return d.fields.reduce(function (m, f) { return Math.max(m, f[1]); }, 0); };
P.dsIds = function (d) { return uniq(d.fields.map(function (f) { return FIELD_ID[f[0]]; })); };
P.sysOf = function (d) { return ENT[d.system] ? ENT[d.system].obj : null; };

/* ── knowledge graph ─────────────────────────────────────── */
var EDGES = P.EDGES = [];
function edge(a, b, rel, extra) { if (ENT[a] && ENT[b] && a !== b) EDGES.push({ a: a, b: b, rel: rel, x: extra || null }); }
NS.products.forEach(function (p) { edge(p.bu, p.id, 'runs'); edge(p.id, p.team, 'owned by'); });
NS.features.forEach(function (f) { edge(f.product, f.id, 'has feature'); });
NS.systems.concat([ENT.s_lochist_eu.obj]).forEach(function (s) {
  if (s.feature) edge(s.feature, s.id, 'implemented by'); else if (s.product) edge(s.product, s.id, 'runs on');
  if (s.parent) edge(s.parent, s.id, 'writes to');
  if (s.team) edge(s.id, s.team, 'owned by');
});
NS.datasets.forEach(function (d) {
  edge(d.system, d.id, 'stores');
  if (d.owner) edge(d.id, d.owner, 'owned by');
  P.dsIds(d).forEach(function (i) { edge(d.id, i, 'carries'); });
  d.purposes.forEach(function (p) { edge(d.id, p, 'declared for'); });
});
NS.flows.forEach(function (f) { edge(f.from, f.to, 'flows to', f.id); });
NS.models.forEach(function (m) {
  m.training.forEach(function (d) { edge(d, m.id, 'trains'); });
  (m.thirdParty || []).forEach(function (v) { edge(m.id, v, 'uses'); });
  if (m.featureStore) edge(m.featureStore, m.id, 'feeds');
  edge(m.id, m.team, 'owned by');
  edge(m.id, m.purpose, 'serves');
});
NS.vendors.forEach(function (v) { v.subprocessors.forEach(function (s) { edge(v.id, s, 'subprocessor'); }); });
NS.idJoins.forEach(function (j) { edge(j[0], j[1], j[4] ? 'joins' : 'joins (unsanctioned)', { where: j[2], how: j[3], ok: j[4] }); });
NS.findings.forEach(function (f) { f.entities.forEach(function (e) { if (ENT[e] && ENT[e].type !== 'flow') edge(f.id, e, 'affects'); }); if (f.owner) edge(f.id, f.owner, 'assigned to'); });
NS.incidents.forEach(function (i) { i.entities.forEach(function (e) { if (ENT[e] && ENT[e].type !== 'flow') edge(i.id, e, 'involved'); }); });
NS.risks.forEach(function (r) { edge(r.id, r.asset, 'rates'); r.findings.forEach(function (f) { edge(r.id, f, 'evidenced by'); }); });
NS.regulations.forEach(function (r) { r.obligations.forEach(function (o) { edge(r.id, o.data, 'obliges'); if (o.control) edge(r.id, o.control, 'met by'); }); });
P.nb = function (id) {
  var out = [];
  EDGES.forEach(function (e) { if (e.a === id) out.push({ id: e.b, rel: e.rel, dir: 'out', x: e.x }); else if (e.b === id) out.push({ id: e.a, rel: e.rel, dir: 'in', x: e.x }); });
  return out;
};

/* ── org lookups ─────────────────────────────────────────── */
P.buOf = function (id) {
  var e = ENT[id]; if (!e) return null; var o = e.obj;
  switch (e.type) {
    case 'bu': return id;
    case 'product': return o.bu;
    case 'feature': return P.buOf(o.product);
    case 'team': return o.bu;
    case 'system': return o.product ? P.buOf(o.product) : o.team ? P.buOf(o.team) : null;
    case 'dataset': return o.product ? P.buOf(o.product) : P.buOf(o.system);
    case 'model': return P.buOf(o.team);
    case 'flow': return P.buOf(o.owner || o.from);
    case 'finding': for (var i = 0; i < o.entities.length; i++) { var b = ENT[o.entities[i]] && ['product', 'system', 'dataset', 'feature'].indexOf(ENT[o.entities[i]].type) >= 0 ? P.buOf(o.entities[i]) : null; if (b) return b; } return o.owner ? P.buOf(o.owner) : null;
    default: return null;
  }
};
P.flowsFrom = function (sys) { return NS.flows.filter(function (f) { return f.from === sys; }); };
P.flowsTo = function (sys) { return NS.flows.filter(function (f) { return f.to === sys; }); };
P.findingsFor = function (id) { return NS.findings.filter(function (f) { return f.entities.indexOf(id) >= 0; }); };
P.openFindings = function () { return NS.findings.filter(function (f) { return f.status !== 'accepted' && f.status !== 'closed'; }); };

/* ── the six north-star questions, per dataset ────────────── */
P.SIX = ['WHY', 'FROM', 'TO', 'WHO', 'WHEN', 'PROVE'];
P.SIX_Q = { WHY: 'Why do we have it?', FROM: 'Where did it come from?', TO: 'Where does it go?', WHO: 'Who can see, join or infer from it?', WHEN: 'When will it disappear?', PROVE: 'Can we prove the first five?' };
P.six = function (d) {
  var r = {}, why = [];
  if (!d.purposes.length) { r.WHY = 'u'; why.push(['WHY', 'No declared purpose']); }
  else if (/someday|may need|might need|later/i.test(d.why)) { r.WHY = 'n'; why.push(['WHY', '"' + d.why + '" is not a purpose']); }
  else r.WHY = 'y';
  r.FROM = d.owner ? 'y' : 'u'; if (!d.owner) why.push(['FROM', 'No owner can attest to the collection source']);
  var out = P.flowsFrom(d.system);
  if (out.some(function (f) { return f.status === 'unknown'; })) { r.TO = 'u'; why.push(['TO', 'Unmapped outbound flow']); }
  else if (out.some(function (f) { return f.status === 'unreviewed'; })) { r.TO = 'n'; why.push(['TO', 'Unreviewed outbound flow']); }
  else r.TO = 'y';
  if (d.accessPeople == null) { r.WHO = 'u'; why.push(['WHO', 'Access list unknown']); }
  else if (d.accessPeople > 100) { r.WHO = 'n'; why.push(['WHO', d.accessPeople.toLocaleString() + ' people can read it']); }
  else r.WHO = 'y';
  var rt = d.retention;
  if (rt.actual == null || (rt.required == null && rt.note == null)) { r.WHEN = 'u'; why.push(['WHEN', 'Retention unknown']); }
  else if (rt.required != null && rt.required > 0 && rt.actual > rt.required) { r.WHEN = 'n'; why.push(['WHEN', 'Kept ' + fmtDays(rt.actual) + ' against ' + fmtDays(rt.required)]); }
  else if (!rt.ttl && rt.required > 0) { r.WHEN = 'n'; why.push(['WHEN', 'No enforced TTL']); }
  else r.WHEN = 'y';
  var aud = daysSince(d.lastAudit);
  if (aud == null) { r.PROVE = 'u'; why.push(['PROVE', 'Never audited']); }
  else if (!d.deletionVerified) { r.PROVE = 'n'; why.push(['PROVE', 'Deletion not verified']); }
  else if (aud > 365) { r.PROVE = 'n'; why.push(['PROVE', 'Last audit ' + aud + ' days ago']); }
  else r.PROVE = 'y';
  r.why = why; return r;
};
P.personalDatasets = function () { return NS.datasets.filter(function (d) { return P.dsTier(d) >= 2; }); };

/* ── explainable risk model ──────────────────────────────── */
P.riskCalc = function (r) {
  var exp = 0, ass = 0;
  NS.riskFactors.forEach(function (f) { if (f.kind === 'exposure') exp += r.f[f.k]; else ass += r.f[f.k]; });
  var assurance = ass / 15, residual = exp * (1 - 0.6 * assurance);
  var rating = residual >= 26 ? 'HIGH' : residual >= 16 ? 'MEDIUM' : 'LOW';
  return { exposure: exp, assurance: assurance, residual: Math.round(residual * 10) / 10, rating: rating };
};
P.risksSorted = function () { return NS.risks.slice().sort(function (a, b) { return P.riskCalc(b).residual - P.riskCalc(a).residual; }); };

/* ── metrics: every number has a rule and a list ──────────── */
var M = P.METRICS = [
  { id: 'personal', label: 'Personal data assets', rule: 'Datasets whose most sensitive field is T2 or above.', items: function () { return P.personalDatasets().map(function (d) { return { id: d.id, why: 'Max tier T' + P.dsTier(d) + ' · ' + fmtN(d.people) + ' people' }; }); } },
  { id: 'sensitive', label: 'Sensitive / special assets', rule: 'Datasets holding any T3 (sensitive) or T4 (special) field.', tone: 'hot', items: function () { return NS.datasets.filter(function (d) { return P.dsTier(d) >= 3; }).map(function (d) { return { id: d.id, why: 'T' + P.dsTier(d) + ': ' + d.fields.filter(function (f) { return f[1] >= 3; }).map(function (f) { return f[0]; }).join(', ') }; }); } },
  { id: 'highfind', label: 'High-risk findings', rule: 'Findings with severity HIGH that are not closed or accepted.', tone: 'hot', route: 'privacy/risks', items: function () { return P.openFindings().filter(function (f) { return f.sev === 'HIGH'; }).map(function (f) { return { id: f.id, why: f.kind + ' · ' + fmtN(f.people) + ' people' }; }); } },
  { id: 'noowner', label: 'Unknown data owners', rule: 'Datasets, systems and findings with no accountable team.', tone: 'unk', items: function () {
      return NS.datasets.filter(function (d) { return !d.owner; }).map(function (d) { return { id: d.id, why: 'dataset without owner' }; })
        .concat(NS.systems.filter(function (s) { return !s.team; }).map(function (s) { return { id: s.id, why: 'system without owning team' }; }))
        .concat(P.openFindings().filter(function (f) { return !f.owner; }).map(function (f) { return { id: f.id, why: 'open finding without owning team' }; })); } },
  { id: 'highrisk', label: 'HIGH residual risks', rule: 'Risks whose residual score (exposure × (1 − 0.6 × assurance)) rates HIGH.', tone: 'hot', hidden: true, route: 'privacy/risks', items: function () { return NS.risks.filter(function (r) { return P.riskCalc(r).rating === 'HIGH'; }).map(function (r) { return { id: r.id, why: 'residual ' + P.riskCalc(r).residual }; }); } },
  { id: 'unmapped', label: 'Unmapped data flows', rule: 'Flows observed in traffic or lineage that no review has described (status = unknown).', tone: 'unk', route: 'explore/flows', items: function () { return NS.flows.filter(function (f) { return f.status === 'unknown'; }).map(function (f) { return { id: f.id, why: f.fields.join(', ') }; }); } },
  { id: 'undeclared', label: 'Undeclared third-party egress', rule: 'Recipients receiving personal data with no contract or declaration.', tone: 'hot', route: 'explore/vendors', items: function () { return NS.vendors.filter(function (v) { return !v.declared; }).map(function (v) { return { id: v.id, why: v.data.join(', ') + ' · ' + fmtN(v.people) + ' people' }; }); } },
  { id: 'nottl', label: 'Datasets without TTL', rule: 'Retention is not machine-enforced (and the data is not tied to a source lifetime).', route: 'privacy/retention', items: function () { return NS.datasets.filter(function (d) { return !d.retention.ttl && d.retention.note == null; }).map(function (d) { return { id: d.id, why: 'actual ' + (fmtDays(d.retention.actual) || 'unknown') }; }); } },
  { id: 'retviol', label: 'Retention violations', rule: 'Oldest record is older than the declared requirement.', tone: 'hot', route: 'privacy/retention', items: function () { return NS.datasets.filter(function (d) { var r = d.retention; return r.required > 0 && r.actual > r.required; }).map(function (d) { return { id: d.id, why: fmtDays(d.retention.actual) + ' kept vs ' + fmtDays(d.retention.required) + ' needed' }; }); } },
  { id: 'consentfail', label: 'Consent propagation failures', rule: 'Consumers that never re-check consent, dropped the filter, or do not receive opt-outs.', tone: 'hot', route: 'privacy/consent', items: function () { return NS.consentConsumers.filter(function (c) { return c.p50 == null; }).map(function (c) { return { id: c.id, why: c.mode + (c.stale ? ' · ' + fmtN(c.stale) + ' stale' : '') }; }); } },
  { id: 'delfail', label: 'Deletion verification failures', rule: 'Systems where a Forget-Me request failed or completion cannot be proven.', tone: 'hot', route: 'privacy/deletion', items: function () { return NS.deletionTargets.filter(function (t) { return t[3] === 'failed' || t[3] === 'unknown'; }).map(function (t) { return { id: t[0], why: t[1] + ' — ' + t[2] + ' (' + t[3] + ')' }; }); } },
  { id: 'sdks', label: 'Unreviewed SDKs & pixels', rule: 'Third-party code in apps or pages with no privacy review.', route: 'privacy/tracking', items: function () { return NS.trackers.filter(function (t) { return t.review === 'unreviewed'; }).map(function (t) { return { id: t.id, why: t.where + ' · ' + t.fields }; }); } },
  { id: 'hivendor', label: 'High-risk vendors', rule: 'Vendors holding T3+ data with no privacy review, no deletion path, a retention mismatch, or no contract.', tone: 'hot', route: 'governance/vendors', items: function () { return P.vendorIssues().filter(function (x) { return x.v.tier >= 3 && x.issues.length; }).map(function (x) { return { id: x.v.id, why: x.issues.join(' · ') }; }); } },
  { id: 'incidents', label: 'Open privacy incidents', rule: 'Incidents not yet closed with a permanent guard.', route: 'assurance/incidents', items: function () { return NS.incidents.filter(function (i) { return i.status !== 'closed'; }).map(function (i) { return { id: i.id, why: i.type + ' · ' + i.status }; }); } },
  { id: 'aipersonal', label: 'AI models using personal data', rule: 'Registered models trained on or prompted with personal data.', route: 'privacy/ai', items: function () { return NS.models.filter(function (m) { return m.personal; }).map(function (m) { return { id: m.id, why: m.hosting + (m.sensitive ? ' · sensitive' : '') }; }); } },
  { id: 'aiprov', label: 'Models with unknown provenance', rule: 'Training provenance recorded as unknown or partial.', tone: 'unk', route: 'privacy/ai', items: function () { return NS.models.filter(function (m) { return m.provenance !== 'documented'; }).map(function (m) { return { id: m.id, why: 'provenance: ' + m.provenance }; }); } },
  { id: 'paper', label: 'Controls only in documents', rule: 'Controls at enforcement level 0 (policy text, no mechanism).', tone: 'hot', route: 'assurance/controls', items: function () { return NS.controls.filter(function (c) { return c.level === 0; }).map(function (c) { return { id: c.id, why: c.evidence }; }); } },
  { id: 'runtime', label: 'Runtime-enforced controls', rule: 'Controls at level 4 (runtime) or 5 (continuous audit).', tone: 'good', route: 'assurance/controls', items: function () { return NS.controls.filter(function (c) { return c.level >= 4; }).map(function (c) { return { id: c.id, why: 'L' + c.level + ' · ' + c.health }; }); } },
  { id: 'drift', label: 'Privacy drift this week', rule: 'Changes detected in the last 7 days: new fields, joins, consumers, SDKs, vendors, regions, purposes.', route: 'assurance/drift', items: function () { return NS.drift.filter(function (d) { return daysSince(d.t.slice(0, 10)) < 7 && d.sev !== 'GOOD'; }).map(function (d) { return { id: d.entities[0], why: d.text, t: d.t }; }); } }
];
P.metric = function (id) { for (var i = 0; i < M.length; i++) if (M[i].id === id) return M[i]; };

P.vendorIssues = function () {
  return NS.vendors.map(function (v) {
    var is = [];
    if (!v.declared) is.push('undeclared');
    if (!v.contract) is.push('no contract');
    else if (daysUntil(v.contract.expires) < 0) is.push('agreement expired');
    else if (daysUntil(v.contract.expires) < 45) is.push('agreement expires in ' + daysUntil(v.contract.expires) + ' d');
    if (!v.privacyReview) is.push('no privacy review');
    if (!v.deletionApi) is.push('no deletion mechanism');
    if (v.retention.contract != null && v.retention.actual != null && v.retention.actual > v.retention.contract) is.push('retention ' + v.retention.actual + 'd vs ' + v.retention.contract + 'd contract');
    if (v.retention.actual == null) is.push('retention unknown');
    if (!v.optOutPropagates) is.push('opt-outs not propagated');
    if (v.subprocessors.some(function (s) { return ENT[s] && !ENT[s].obj.known; })) is.push('unknown subprocessor');
    return { v: v, issues: is };
  });
};

/* stage of the lifecycle a finding lives in (for the worry map) */
P.stageOf = function (f) {
  var k = f.kind;
  if (/DELETION/.test(k)) return 'DELETE';
  if (/RETENTION|TTL|LONG-LIVED|OUTLIVES/.test(k)) return 'STORE';
  if (/EGRESS|VENDOR|SUBPROCESSOR|TRACKING|AGREEMENT|INFERENCE \+ CROSS|UNKNOWN SUB/.test(k)) return 'SHARE';
  if (/PURPOSE|CONSENT/.test(k)) return 'USE';
  if (/NEW SENSITIVE FIELD|LOGGING/.test(k)) return 'COLLECT';
  if (/LINKAB|OWNER|ACCESS|UNKNOWN/.test(k)) return 'PROCESS';
  return 'PROCESS';
};
P.STAGES = ['COLLECT', 'PROCESS', 'USE', 'SHARE', 'STORE', 'DELETE'];

/* ── HTML fragments ──────────────────────────────────────── */
P.chip = function (id, label) {
  var e = ENT[id]; if (!e) return '<span class="chip">' + esc(label || id) + '</span>';
  return '<button class="chip" data-ent="' + esc(id) + '"><span class="ty">' + esc((TYPE_LABEL[e.type] || e.type).split(' ')[0]) + '</span>' + esc(label || e.name) + '</button>';
};
P.chips = function (ids) { return '<div class="chips">' + uniq(ids).map(function (i) { return P.chip(i); }).join('') + '</div>'; };
P.tier = function (t) { return '<span class="tier tier-' + t + '" title="' + ['Public', 'Internal', 'Personal', 'Sensitive', 'Special'][t] + '">T' + t + '</span>'; };
P.sev = function (s) { return '<span class="tag sev-' + esc(s) + '">' + esc(s) + '</span>'; };
P.kind = function (k) { return '<span class="tag k-' + esc(k) + '">' + esc(k) + '</span>'; };
P.LEVELS = ['POLICY', 'HUMAN REVIEW', 'STATIC CHECK', 'DEPLOY GATE', 'RUNTIME', 'CONTINUOUS AUDIT'];
P.lvl = function (l) { var s = '<span class="lvl' + (l <= 1 ? ' low' : '') + (l === 0 ? ' zero' : '') + '" title="L' + l + ' ' + P.LEVELS[l] + '">'; for (var i = 0; i <= 5; i++) s += '<i class="' + (i <= l && l > 0 ? 'on' : '') + '"></i>'; return s + '</span> <span class="small mono dim">L' + l + ' ' + P.LEVELS[l] + '</span>'; };
P.sixStrip = function (six) { return '<div class="six" role="list">' + P.SIX.map(function (k) { return '<div role="listitem" class="' + six[k] + '" title="' + esc(P.SIX_Q[k]) + '">' + k + '<br>' + (six[k] === 'y' ? '✓' : six[k] === 'n' ? '✗' : '?') + '</div>'; }).join('') + '</div>'; };
P.kv = function (rows) { return '<dl class="kv">' + rows.filter(Boolean).map(function (r) { return '<dt>' + esc(r[0]) + '</dt><dd>' + (r[1] == null || r[1] === '' ? unk() : r[1]) + '</dd>'; }).join('') + '</dl>'; };
P.sec = function (title, body) { return '<section class="pp-sec"><h3>' + esc(title) + '</h3>' + body + '</section>'; };
P.list = function (items) { return items.length ? '<ul class="checks">' + items.join('') + '</ul>' : '<p class="dim small">None.</p>'; };
P.check = function (ok, text) { return '<li><span class="ic ' + (ok === true ? 'ok' : ok === false ? 'bad' : 'unknown') + '">' + (ok === true ? '✓' : ok === false ? '✗' : '?') + '</span><span>' + text + '</span></li>'; };
P.pageHead = function (eyebrow, title, lede, right) { return '<div class="page-head"><div><p class="eyebrow">' + esc(eyebrow) + '</p><h1>' + esc(title) + '</h1>' + (lede ? '<p class="lede">' + lede + '</p>' : '') + '</div>' + (right || '') + '</div>'; };

/* ── navigation ──────────────────────────────────────────── */
P.NAV = [
  ['', [['overview', 'Command Center']]],
  ['Explore', [['explore/org', 'Organization'], ['explore/products', 'Products & Features'], ['explore/systems', 'Systems'], ['explore/data', 'Data'], ['explore/graph', 'Knowledge Graph'], ['explore/person', 'One Person'], ['explore/identities', 'Identities'], ['explore/flows', 'Data Flows'], ['explore/vendors', 'Vendor Egress'], ['explore/geo', 'Geography']]],
  ['Privacy', [['privacy/risks', 'Risk Radar'], ['privacy/worstday', 'Worst Day'], ['privacy/reviews', 'Reviews'], ['privacy/consent', 'Consent'], ['privacy/purpose', 'Purpose'], ['privacy/retention', 'Retention'], ['privacy/deletion', 'Forget Me'], ['privacy/rights', 'User Rights'], ['privacy/tracking', 'Tracking'], ['privacy/ai', 'AI / ML'], ['privacy/pets', 'PETs & DP'], ['privacy/threats', 'Threat Models']]],
  ['Assurance', [['assurance/controls', 'Enforcement Ladder'], ['assurance/audits', 'Audits'], ['assurance/access', 'Access & Insider'], ['assurance/incidents', 'Incidents'], ['assurance/drift', 'Drift'], ['assurance/evidence', 'Evidence']]],
  ['Governance', [['governance/regulations', 'Policies & Regulations'], ['governance/vendors', 'Vendor Register'], ['governance/maturity', 'Maturity']]],
  ['Report', [['report/executive', 'Executive'], ['report/engineering', 'Engineering'], ['report/audit', 'Audit'], ['report/legal', 'Privacy / Legal']]]
];
var NAV_COUNT = { 'privacy/risks': ['highrisk', 'hot'], 'explore/flows': ['unmapped', 'unk'], 'privacy/retention': ['retviol', 'hot'], 'privacy/deletion': ['delfail', 'hot'], 'privacy/consent': ['consentfail', 'hot'], 'privacy/tracking': ['sdks', ''], 'assurance/controls': ['paper', 'hot'], 'assurance/drift': ['drift', ''], 'assurance/incidents': ['incidents', ''], 'privacy/ai': ['aiprov', 'unk'], 'explore/vendors': ['undeclared', 'hot'] };
function renderNav() {
  var h = P.forYouNav ? P.forYouNav() : '';
  P.NAV.forEach(function (g) {
    if (g[0]) h += '<h2>' + esc(g[0]) + '</h2>';
    g[1].forEach(function (it) {
      var c = NAV_COUNT[it[0]], n = c ? P.metric(c[0]).items().length : null;
      h += '<a href="#/' + it[0] + '" data-route="' + it[0] + '">' + esc(it[1]) + (n ? '<span class="ct ' + c[1] + '">' + n + '</span>' : '') + '</a>';
    });
  });
  document.getElementById('side').innerHTML = h;
}

/* ── router ──────────────────────────────────────────────── */
P.route = { path: 'overview', q: {} };
P.go = function (path) { location.hash = '#/' + path; };
function parseHash() {
  var h = location.hash.replace(/^#\/?/, '') || 'overview';
  var parts = h.split('?'), q = {};
  (parts[1] || '').split('&').forEach(function (kv) { if (!kv) return; var p = kv.split('='); q[decodeURIComponent(p[0])] = decodeURIComponent(p[1] || ''); });
  return { path: parts[0], q: q };
}
function render() {
  var r = parseHash(); P.route = r;
  var segs = r.path.split('/'), key = segs.slice(0, 2).join('/');
  var view = P.views[key] || P.views[segs[0]] || P.views.overview;
  var main = document.getElementById('view');
  main.innerHTML = view.render(segs.slice(2), r.q) + '';
  if (view.mount) view.mount(main, segs.slice(2), r.q);
  main.querySelectorAll('.tbl-wrap,.canvas,.memo table,.heat').forEach(function (el) { if (el.scrollWidth > el.clientWidth + 1 && !el.hasAttribute('tabindex')) { el.tabIndex = 0; el.setAttribute('role', el.getAttribute('role') || 'region'); if (!el.getAttribute('aria-label')) el.setAttribute('aria-label', 'Scrollable content'); } });
  document.querySelectorAll('.side a').forEach(function (a) { var on = a.getAttribute('data-route') === key || (key === 'overview' && a.getAttribute('data-route') === 'overview'); if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  var title = (view.title || 'Command Center');
  document.title = title + ' — Privacy Command Center';
  closeSide();
  if (!P._keepScroll) window.scrollTo(0, 0); P._keepScroll = false;
}
P.render = render;

/* ── drawer (Privacy Passport) ───────────────────────────── */
var drawer, drawerBody, drawerCrumb;
P.open = function (id, opts) {
  opts = opts || {};
  var e = ENT[id]; if (!e) return;
  if (!opts.fromStack && P.state.drawerStack[P.state.drawerStack.length - 1] !== id) { P.state.drawerStack.push(id); if (P.state.drawerStack.length > 8) P.state.drawerStack.shift(); }
  pushTrail(id);
  var fn = P.passports[e.type] || P.passports.generic;
  drawerBody.innerHTML = fn(e.obj, e) + connected(id);
  drawerBody.scrollTop = 0;
  var st = P.state.drawerStack;
  drawerCrumb.innerHTML = st.slice(-4).map(function (x, i, a) { var last = i === a.length - 1; return last ? '<span>' + esc(TYPE_LABEL[ENT[x].type]) + '</span>' : '<button data-stack="' + (st.length - a.length + i) + '">' + esc(shortName(x)) + '</button><span class="sep">›</span>'; }).join('');
  drawer.classList.add('open'); drawer.removeAttribute('inert');
  if (!opts.noFocus) setTimeout(function () { var t = drawerBody.querySelector('.pp-title'); if (t) { t.setAttribute('tabindex', '-1'); t.focus({ preventScroll: true }); } }, 60);
  if (opts.scrollTo) setTimeout(function () { var s = drawerBody.querySelector('[data-anchor="' + opts.scrollTo + '"]'); if (s) { s.scrollIntoView({ block: 'start' }); s.classList.add('hl'); } }, 320);
};
P.openHTML = function (title, html, crumb) {
  drawerBody.innerHTML = html; drawerBody.scrollTop = 0;
  drawerCrumb.innerHTML = '<span>' + esc(crumb || title) + '</span>';
  drawer.classList.add('open'); drawer.removeAttribute('inert');
};
function shortName(id) { var n = P.name(id); return n.length > 22 ? n.slice(0, 20) + '…' : n; }
P.closeDrawer = function () { drawer.classList.remove('open'); drawer.setAttribute('inert', ''); P.state.drawerStack = []; };
function connected(id) {
  var n = P.nb(id); if (!n.length) return '';
  var groups = {};
  n.forEach(function (x) { var t = ENT[x.id].type; (groups[t] = groups[t] || []).push(x); });
  var h = '<section class="pp-sec"><h3>Connected in the knowledge graph · ' + n.length + ' relationships</h3>';
  Object.keys(groups).forEach(function (t) {
    h += '<div style="margin-bottom:8px"><div class="small dim" style="margin-bottom:4px">' + esc(TYPE_LABEL[t] || t) + '</div><div class="chips">' +
      uniq(groups[t].map(function (x) { return x.id; })).map(function (xid) { var rel = groups[t].filter(function (y) { return y.id === xid; })[0]; return '<button class="chip" data-ent="' + esc(xid) + '" title="' + esc((rel.dir === 'out' ? '→ ' : '← ') + rel.rel) + '">' + esc(P.name(xid)) + ' <span class="ty">' + esc(rel.rel) + '</span></button>'; }).join('') + '</div></div>';
  });
  return h + '<div class="btn-row" style="margin-top:10px"><a class="btn" href="#/explore/graph?focus=' + esc(id) + '">Open in knowledge graph</a></div></section>';
}
P.openMetric = function (id) {
  var m = P.metric(id), items = m.items();
  var h = '<p class="pp-type">Metric</p><h2 class="pp-title">' + esc(m.label) + ' · ' + items.length + '</h2>' +
    '<div class="why"><div class="wl">HOW THIS NUMBER IS COMPUTED</div><p>' + esc(m.rule) + '</p></div>' +
    '<p class="small muted">Every item below is the evidence for the number. Click one to open its passport.</p>' +
    '<div class="tbl-wrap"><table class="tbl"><tbody>' + items.map(function (it) {
      var e = ENT[it.id];
      return '<tr class="click" data-ent="' + esc(it.id) + '" tabindex="0"><td>' + (e ? '<div style="font-weight:600">' + esc(e.name) + '</div><div class="small dim">' + esc(TYPE_LABEL[e.type]) + '</div>' : esc(it.id)) + '</td><td class="small muted">' + esc(it.why || '') + '</td></tr>';
    }).join('') + '</tbody></table></div>' +
    (m.route ? '<div class="btn-row" style="margin-top:12px"><a class="btn" href="#/' + m.route + '">Open the full view →</a></div>' : '');
  P.openHTML(m.label, h, 'Metric');
};

/* ── trail ───────────────────────────────────────────────── */
P.pushTrail = function (id) { pushTrail(id); };
function pushTrail(id) {
  var t = P.state.trail; if (t[t.length - 1] === id) return;
  t.push(id); if (t.length > 14) t.shift(); renderTrail();
}
function renderTrail() {
  var t = P.state.trail, el = document.getElementById('trail');
  el.innerHTML = '<span class="tl">TRAIL</span>' + (t.length ? t.map(function (id, i) { return (i ? '<span class="sep">›</span>' : '') + '<button class="chip" data-ent="' + esc(id) + '"><span class="ty">' + esc((TYPE_LABEL[ENT[id].type] || '').split(' ')[0]) + '</span>' + esc(shortName(id)) + '</button>'; }).join('') + '<button class="chip" data-act="clearTrail" style="margin-left:6px">clear</button>'
    : '<span class="empty">Your investigation path appears here. Every click is recorded, so you can explain how you got to a conclusion. <button class="chip" data-act="tour">▶ Follow an investigation</button></span>');
  if (t.length) el.scrollLeft = el.scrollWidth; /* keep the newest step in view; leave the help text at its start */
}
P.acts.clearTrail = function () { P.state.trail = []; renderTrail(); };

/* ── side nav (mobile) ───────────────────────────────────── */
function closeSide() { var s = document.getElementById('side'); s.classList.remove('open'); document.getElementById('scrim').hidden = true; document.getElementById('menuBtn').setAttribute('aria-expanded', 'false'); }

/* ── roles ───────────────────────────────────────────────── */
function setRole(r) {
  P.state.role = r;
  document.querySelectorAll('.role button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-role') === r)); });
  if (P.route.path === 'overview') { P._keepScroll = true; render(); }
}
P.setRole = setRole;
P.renderNav = function () { renderNav(); var r = P.route.path.split('/').slice(0, 2).join('/'); document.querySelectorAll('.side a').forEach(function (x) { if (x.getAttribute('data-route') === r) x.setAttribute('aria-current', 'page'); }); };

/* ── boot wiring (called from boot.js after views load) ─── */
P.init = function () {
  drawer = document.getElementById('drawer'); drawerBody = document.getElementById('drawerBody'); drawerCrumb = document.getElementById('drawerCrumb');
  if (P.initPersona) P.initPersona(); renderNav(); renderTrail(); setRole(P.persona ? P.persona.hat : 'reviewer');
  window.addEventListener('hashchange', render);
  /* A link inside the drawer moves to a new page: the drawer belongs to the old one. */
  window.addEventListener('hashchange', function () { if (drawer.classList.contains('open')) P.closeDrawer(); });
  document.addEventListener('click', function (ev) {
    var t = ev.target.closest('[data-ent],[data-metric],[data-act],[data-stack],[data-role],[data-go]');
    if (!t) return;
    if (t.hasAttribute('data-role')) { setRole(t.getAttribute('data-role')); return; }
    if (t.hasAttribute('data-stack')) { var i = +t.getAttribute('data-stack'); var id = P.state.drawerStack[i]; P.state.drawerStack = P.state.drawerStack.slice(0, i + 1); P.open(id, { fromStack: true }); return; }
    if (t.hasAttribute('data-metric')) { ev.preventDefault(); P.openMetric(t.getAttribute('data-metric')); return; }
    if (t.hasAttribute('data-act')) { var a = P.acts[t.getAttribute('data-act')]; if (a) { ev.preventDefault(); a(t, ev); } return; }
    if (t.hasAttribute('data-go')) { ev.preventDefault(); P.go(t.getAttribute('data-go')); return; }
    if (t.hasAttribute('data-ent')) { ev.preventDefault(); P.open(t.getAttribute('data-ent')); }
  });
  document.addEventListener('keydown', function (ev) {
    var tag = (ev.target.tagName || '').toLowerCase(), typing = tag === 'input' || tag === 'textarea' || tag === 'select';
    if ((ev.key === '/' && !typing) || ((ev.metaKey || ev.ctrlKey) && ev.key.toLowerCase() === 'k')) { ev.preventDefault(); P.openPalette(); }
    if (ev.key === 'Escape') { if (!document.getElementById('palette').hidden) P.closePalette(); else if (document.getElementById('analyst').classList.contains('open')) P.closeAnalyst(); else if (drawer.classList.contains('open')) P.closeDrawer(); else closeSide(); }
    if ((ev.key === 'Enter' || ev.key === ' ') && ev.target.matches && ev.target.matches('g.node,g.edge,[role="button"][data-ent],[role="button"][data-go],tr.click')) { ev.preventDefault(); ev.target.dispatchEvent(new MouseEvent('click', { bubbles: true })); }
  });
  document.getElementById('drawerClose').addEventListener('click', P.closeDrawer);
  document.getElementById('side').addEventListener('click', function (ev) { if (ev.target.closest('a')) P.closeDrawer(); });
  document.getElementById('menuBtn').addEventListener('click', function () { var s = document.getElementById('side'), o = !s.classList.contains('open'); s.classList.toggle('open', o); document.getElementById('scrim').hidden = !o; this.setAttribute('aria-expanded', String(o)); });
  document.getElementById('scrim').addEventListener('click', closeSide);
  document.getElementById('searchBtn').addEventListener('click', function () { P.openPalette(); });
  document.getElementById('analystBtn').addEventListener('click', function () { P.openAnalyst(); });
  document.getElementById('analystClose').addEventListener('click', function () { P.closeAnalyst(); });
  render();
};
})();
