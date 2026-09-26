/* Privacy Passports — what the evidence drawer shows for each entity type.
 * Every passport opens with WHY the thing exists, and renders UNKNOWN as a
 * finding rather than a blank. */
(function () {
'use strict';
var P = window.PCC, NS = window.NS, esc = P.esc, chip = P.chip, kv = P.kv, sec = P.sec, unk = P.unk, fmtN = P.fmtN, fmtDays = P.fmtDays;

function head(type, title, sub) { return '<p class="pp-type">' + esc(type) + '</p><h2 class="pp-title">' + esc(title) + '</h2>' + (sub ? '<p class="muted small" style="margin:0">' + sub + '</p>' : ''); }
function why(text, flagged, label) { return '<div class="why' + (flagged ? ' flag' : '') + '"><div class="wl">' + esc(label || 'WHY DOES THIS DATA EXIST?') + '</div><p>' + (text ? esc(text) : unk('No one has written down why')) + '</p>' + (flagged ? '<p class="small" style="margin-top:6px;color:#a33a0c">Flagged: “we may need it someday” is not a purpose. Data kept for an unknown future use is exposure with no value attached.</p>' : '') + '</div>'; }
function findingsList(list) {
  if (!list.length) return '<p class="dim small">No open findings.</p>';
  return '<div class="tbl-wrap"><table class="tbl"><tbody>' + list.map(function (f) { return '<tr class="click" data-ent="' + f.id + '"><td class="nowrap">' + P.sev(f.sev) + '</td><td><div style="font-weight:600">' + esc(f.title) + '</div><div class="small dim mono">' + f.id + ' · ' + esc(f.kind) + '</div></td></tr>'; }).join('') + '</tbody></table></div>';
}
function owner(id) { return id ? chip(id) : unk('UNKNOWN OWNER'); }
P.passportHelpers = { head: head, why: why, findingsList: findingsList, owner: owner };

/* tier → default controls (field guide p.18), evaluated against the asset */
P.tierControls = function (d) {
  var t = P.dsTier(d), out = [], rt = d.retention;
  if (t >= 2) {
    out.push(['Purpose tags', d.purposes.length > 0]);
    out.push(['Retention limit declared', rt.required != null]);
    out.push(['Access logging', d.accessPeople != null]);
  }
  if (t >= 3) {
    out.push(['Minimised (no raw T3 beyond need)', !(rt.required > 0 && rt.actual > rt.required)]);
    out.push(['Encrypted', /AES|per-user|E2EE/.test(d.encryption)]);
    out.push(['Need-to-know access (≤ 50 people)', d.accessPeople != null ? d.accessPeople <= 50 : null]);
    out.push(['Short, enforced TTL', rt.ttl === true]);
  }
  if (t >= 4) {
    out.push(['Explicit consent', /explicit|verifiable parental/.test(d.consent || '')]);
    out.push(['On-device first / strongest isolation', /per-user|crypto/.test(d.encryption)]);
    out.push(['No advertising identifiers present', P.dsIds(d).indexOf('i_maid') < 0]);
  }
  return out;
};

/* ── dataset: the full Privacy Passport ─────────────────── */
P.passports.dataset = function (d) {
  var sys = P.get(d.system), t = P.dsTier(d), six = P.six(d), rt = d.retention;
  var ids = [], qids = [], der = [], inf = [];
  d.fields.forEach(function (f) { (f[2] === 'id' ? ids : f[2] === 'qid' ? qids : f[2] === 'derived' ? der : f[2] === 'inference' ? inf : []).push(f); });
  var outFlows = P.flowsFrom(d.system), inFlows = P.flowsTo(d.system);
  var vendors = P.uniq(outFlows.filter(function (f) { return P.get(f.to) && (P.get(f.to).type === 'vendor' || P.get(f.to).type === 'subprocessor'); }).map(function (f) { return f.to; }));
  var xb = outFlows.filter(function (f) { return f.regionFrom !== f.regionTo && f.regionTo !== 'user'; });
  var models = NS.models.filter(function (m) { return m.training.indexOf(d.id) >= 0; });
  var finds = P.findingsFor(d.id);
  var incs = NS.incidents.filter(function (i) { return i.entities.indexOf(d.id) >= 0 || finds.some(function (f) { return i.entities.indexOf(f.id) >= 0; }); });
  var obligations = []; NS.regulations.forEach(function (r) { r.obligations.forEach(function (o) { if (o.data === d.id) obligations.push([r, o]); }); });
  var delT = NS.deletionTargets.filter(function (x) { return x[0] === d.system; });
  var feature = sys && sys.obj.feature ? sys.obj.feature : null;
  var reviews = NS.reviews.filter(function (r) { return feature && r.feature === feature; });
  var flagged = /someday|may need|might need/i.test(d.why);
  var sixWhy = six.why.length ? '<ul class="checks" style="margin-bottom:6px">' + six.why.map(function (w) { return P.check(six[w[0]] === 'u' ? null : false, '<span class="mono small dim">' + w[0] + '</span> ' + esc(w[1])); }).join('') + '</ul>' : '<p class="small ok">All six questions answered with evidence.</p>';
  var fieldRows = d.fields.map(function (f) { return '<div class="fr"><span class="mono">' + esc(f[0]) + '</span><span class="small dim">' + esc(f[2] === 'qid' ? 'quasi-identifier' : f[2]) + (P.FIELD_ID[f[0]] ? ' · ' + esc(P.name(P.FIELD_ID[f[0]])) : '') + '</span>' + P.tier(f[1]) + '</div>'; }).join('');
  var tc = P.tierControls(d);
  return head('Privacy Passport · ' + (d.kind || 'dataset'), d.name, 'in ' + (sys ? esc(sys.name) : unk()) + ' · ' + fmtN(d.people) + ' people · max tier ' + P.tier(t)) +
    why(d.why, flagged) +
    '<div class="small dim" style="margin-top:4px">THE SIX QUESTIONS</div>' + P.sixStrip(six) + sixWhy +
    sec('Identity & ownership', kv([
      ['Owner', owner(d.owner)], ['Business unit', P.buOf(d.id) ? chip(P.buOf(d.id)) : unk()], ['Product', d.product ? chip(d.product) : '<span class="dim">shared platform</span>'],
      ['Feature', feature ? chip(feature) : '<span class="dim">—</span>'], ['System', chip(d.system)], ['Business purpose', esc(d.why)],
      ['Data subjects', esc(d.subjects) + ' · ' + fmtN(d.people)], ['Collection source', inFlows.length ? P.chips(inFlows.map(function (f) { return f.from; })) : sys && sys.obj.parent ? chip(sys.obj.parent) : esc(sys ? sys.obj.kind + ' (direct)' : '')]])) +
    sec('Data (' + d.fields.length + ' fields)', '<div class="fields">' + fieldRows + '</div>') +
    sec('Identity', kv([
      ['Identifiers', ids.length ? P.chips(P.dsIds(d)) : '<span class="dim">none</span>'], ['Quasi-identifiers', qids.map(function (f) { return '<span class="mono small">' + esc(f[0]) + '</span>'; }).join(', ') || '<span class="dim">none</span>'],
      ['Derived attributes', der.map(function (f) { return '<span class="mono small">' + esc(f[0]) + '</span>'; }).join(', ') || '<span class="dim">none</span>'],
      ['Inferences', inf.length ? inf.map(function (f) { return '<span class="mono small warn">' + esc(f[0]) + '</span>'; }).join(', ') + ' <span class="small dim">— inference counts as collection</span>' : '<span class="dim">none</span>']])) +
    sec('Purpose & consent', kv([
      ['Purpose tags', d.purposes.length ? P.chips(d.purposes) : unk('NO PURPOSE')], ['Consent requirement', d.consent && d.consent !== 'unknown' ? esc(d.consent) : unk()],
      ['Legal / policy basis', obligations.length ? obligations.map(function (x) { return chip(x[0].id) + ' <span class="small muted">' + esc(x[1].text) + '</span>'; }).join('<br>') : '<span class="dim">no mapped obligation</span>']])) +
    sec('Time', kv([
      ['Required retention', rt.required == null ? unk() : rt.required === 0 ? esc(rt.note || 'lifetime of source') : fmtDays(rt.required)],
      ['Actual retention', rt.actual == null ? unk() : rt.actual === 0 ? esc(rt.note || '—') : '<span class="' + (rt.required > 0 && rt.actual > rt.required ? 'bad' : '') + '">' + fmtDays(rt.actual) + '</span>'],
      ['Actual age of oldest record', d.age == null ? unk() : fmtDays(d.age)], ['TTL enforced', rt.ttl ? '<span class="ok">yes, by the store</span>' : rt.note ? '<span class="dim">tied to source</span>' : '<span class="bad">no</span>']])) +
    sec('Protection & access', kv([
      ['Encryption', esc(d.encryption)], ['Key ownership', d.keyOwner === 'unknown' ? unk() : esc(d.keyOwner)],
      ['People with access', d.accessPeople == null ? unk() : '<span class="' + (d.accessPeople > 100 ? 'bad' : '') + '">' + d.accessPeople.toLocaleString() + '</span>'],
      ['Services with access', d.accessServices == null ? unk() : String(d.accessServices)]])) +
    sec('Where it goes', kv([
      ['Downstream', outFlows.length ? outFlows.map(function (f) { return chip(f.id, '→ ' + P.name(f.to)); }).join(' ') : '<span class="dim">no mapped outbound flow</span>'],
      ['Vendors', vendors.length ? P.chips(vendors) : '<span class="dim">none</span>'], ['Regions', esc(d.regions.join(', '))],
      ['Cross-border transfers', xb.length ? xb.map(function (f) { return chip(f.id, f.regionFrom + ' → ' + f.regionTo); }).join(' ') : '<span class="dim">none</span>']])) +
    sec('Deletion & rights', kv([
      ['Deletion method', d.deletion === 'unknown' ? unk() : esc(d.deletion)], ['Deletion verified', d.deletionVerified ? '<span class="ok">verified by scan</span>' : '<span class="bad">not verified</span>'],
      ['Forget-Me coverage', delT.length ? delT.map(function (x) { return esc(x[1]) + ' — <span class="' + (x[3] === 'verified' ? 'ok' : x[3] === 'unknown' ? 'unknown' : 'bad') + '">' + x[3] + '</span>'; }).join('<br>') : unk('not in deletion orchestrator')],
      ['User rights support', delT.length && delT.every(function (x) { return x[3] === 'verified'; }) ? 'access · delete · correct' : '<span class="warn">partial</span>']])) +
    sec('Tier ' + t + ' default controls — stronger as sensitivity rises', P.list(tc.map(function (c) { return P.check(c[1], esc(c[0])); }))) +
    sec('Reviews, threats, findings', kv([
      ['Privacy reviews', reviews.length ? reviews.map(function (r) { return '<span class="mono small">' + r.id + '</span> ' + esc(r.stage) + (r.drift ? ' <span class="tag sev-MEDIUM">DRIFT</span>' : ''); }).join('<br>') : '<span class="dim">none linked</span>'],
      ['Threat model (LINDDUN)', P.uniq([].concat.apply([], finds.map(function (f) { return f.linddun; }))).join(' · ') || '<span class="dim">not modelled</span>'],
      ['Incident history', incs.length ? P.chips(incs.map(function (i) { return i.id; })) : '<span class="dim">none</span>'],
      ['AI / ML usage', models.length ? P.chips(models.map(function (m) { return m.id; })) : '<span class="dim">none</span>'],
      ['Last audit', d.lastAudit ? esc(d.lastAudit) + ' <span class="dim small">(' + P.daysSince(d.lastAudit) + ' d ago)</span>' : unk('NEVER AUDITED')]])) +
    '<div data-anchor="findings">' + sec('Open findings', findingsList(finds)) + '</div>';
};

/* ── flow: every arrow is a privacy object ──────────────── */
P.passports.flow = function (f) {
  var to = P.get(f.to), from = P.get(f.from);
  var flags = f.flags || [];
  var bnd = { device: 'Device → Northstar', internal: 'Inside one trust zone', trust: 'Crosses an internal trust boundary', third_party: 'Leaves Northstar (third party)' }[f.boundary];
  var norm = NS.contextNorms[f.id];
  var FL = { new_field: 'new field', purpose_change: 'purpose change', identity_join: 'new identity join', cross_region: 'cross-region', sensitive_join: 'sensitive join', undeclared: 'undeclared recipient', authenticated_page: 'authenticated page' };
  var ask = [
    ['Minimise', f.fields.some(function (x) { return /url|lat|lon|transcript|prompt/.test(x); }) ? 'Send a category or bucket instead of the raw field.' : 'Is every field needed by the recipient?'],
    ['Transform', f.identifier && P.get(f.identifier) && /DURABLE|CROSS/.test(P.get(f.identifier).obj.cls) ? 'Replace ' + P.name(f.identifier) + ' with a purpose-scoped or rotating token.' : 'Identifier is already weak.'],
    ['Isolate', f.boundary !== 'internal' ? 'Keep identity on this side of the boundary; send only derived signal.' : 'Separate keys per purpose.'],
    ['Aggregate', f.boundary === 'third_party' ? 'Could the recipient work from thresholded aggregates?' : '—'],
    ['Delete', /unknown|none|no deletion/i.test(f.deletion) ? 'Recipient has no proven deletion path — make it a contract and a test.' : 'Deletion path: ' + f.deletion]
  ];
  return head('Data flow · every arrow is a decision', P.name(f.id), '<span class="mono">' + f.id + '</span> · ' + esc(bnd || f.boundary)) +
    (flags.length ? '<div class="chips" style="margin:10px 0">' + flags.map(function (x) { return '<span class="tag sev-HIGH">' + esc(FL[x] || x) + '</span>'; }).join('') + (f.status !== 'reviewed' ? '<span class="tag k-UNKNOWN">' + esc(f.status.toUpperCase()) + '</span>' : '') + '</div>' : f.status !== 'reviewed' ? '<div style="margin:10px 0"><span class="tag k-UNKNOWN">' + esc(f.status.toUpperCase()) + '</span></div>' : '') +
    (norm ? '<div class="why' + (/Breaks|Unclear|not arriving/.test(norm) ? ' flag' : '') + '"><div class="wl">CONTEXTUAL INTEGRITY — DOES THIS FLOW MATCH WHAT THE PERSON EXPECTED?</div><p>' + esc(norm) + '</p></div>' : '') +
    kv([
      ['From', chip(f.from)], ['To (recipient)', chip(f.to)], ['Data fields', f.fields.map(function (x) { return '<span class="mono small">' + esc(x) + '</span>'; }).join(', ')],
      ['Sensitivity', P.tier(f.tier)], ['Identifier', f.identifier ? chip(f.identifier) + ' <span class="small dim">' + esc(P.get(f.identifier).obj.cls) + '</span>' : '<span class="ok">none</span>'],
      ['Purpose', f.purpose === 'unknown' ? unk('UNKNOWN PURPOSE') : chip(f.purpose)], ['Consent requirement', esc(f.consent)], ['Encryption', esc(f.enc)],
      ['Trust boundary', esc(bnd)], ['Region', esc(f.regionFrom) + ' → ' + (f.regionTo === 'unknown' ? unk() : esc(f.regionTo))], ['Retention at recipient', /unknown/.test(f.retention) ? unk() : esc(f.retention)],
      ['Owner', owner(f.owner)], ['Access', to && to.type === 'vendor' ? 'vendor staff (count unknown)' : 'internal service'], ['Contract', f.contract ? esc(f.contract) : to && (to.type === 'vendor' || to.type === 'subprocessor') ? unk('NO CONTRACT ON FILE') : '<span class="dim">internal</span>'],
      ['Policy / control', f.control ? chip(f.control) + ' ' + P.lvl(P.get(f.control).obj.level) : unk('NO CONTROL')], ['Deletion behaviour', /unknown/.test(f.deletion) ? unk() : esc(f.deletion)], ['Review status', esc(f.status)]]) +
    sec('The decision this arrow represents', '<div class="tbl-wrap"><table class="tbl"><tbody>' + ask.map(function (a) { return '<tr><td class="nowrap mono small">' + a[0] + '</td><td>' + esc(a[1]) + '</td></tr>'; }).join('') + '</tbody></table></div>') +
    sec('Findings on this arrow', findingsList(NS.findings.filter(function (x) { return x.entities.indexOf(f.id) >= 0; }))) +
    '<div class="btn-row" style="margin-top:12px"><a class="btn" href="#/explore/flows?f=' + f.id + '">Show on the flow map</a></div>';
};

/* ── finding ────────────────────────────────────────────── */
P.passports.finding = function (f) {
  var ents = f.entities.filter(function (e) { return P.get(e); });
  var byType = {}; ents.forEach(function (e) { var t = P.get(e).type; (byType[t] = byType[t] || []).push(e); });
  var order = ['product', 'feature', 'system', 'dataset', 'flow', 'identifier', 'vendor', 'model', 'control'];
  var due = P.daysUntil(f.due);
  var ctrl = ents.filter(function (e) { return P.get(e).type === 'control'; }).map(function (e) { return P.get(e).obj; });
  var tech = f.title;
  return head('Finding · ' + f.id, f.title, P.sev(f.sev) + ' · <span class="mono small">' + esc(f.kind) + '</span> · ' + fmtN(f.people) + ' people · status <b>' + esc(f.status) + '</b>') +
    '<div class="chain" style="margin-top:14px">' +
      '<div class="cn bad"><div class="cl">Technical issue</div><div class="cv">' + esc(tech) + '</div></div>' +
      '<div class="cn bad"><div class="cl">Privacy harm</div><div class="cv">' + esc(f.harms.join(' + ') || '—') + '</div></div>' +
      '<div class="cn bad"><div class="cl">Human consequence</div><div class="cv">' + esc(f.human) + '</div></div></div>' +
    kv([['Detected by', '<span class="mono small">' + esc(f.detector) + '</span>'], ['Opened', esc(f.opened)], ['LINDDUN', esc(f.linddun.join(' · ') || '—')],
      ['Owner', owner(f.owner)], ['Due', esc(f.due) + (due != null ? ' <span class="small ' + (due < 7 ? 'bad' : 'dim') + '">(' + (due >= 0 ? 'in ' + due + ' d' : Math.abs(due) + ' d overdue') + ')</span>' : '')],
      ['Required enforcement', P.lvl(f.enforcement)], ['Current control', ctrl.length ? ctrl.map(function (c) { return chip(c.id) + ' ' + P.lvl(c.level) + ' <span class="small ' + (c.health === 'working' ? 'ok' : c.health === 'failing' ? 'bad' : 'unknown') + '">' + c.health + '</span>'; }).join('<br>') : unk('NO CONTROL')]]) +
    sec('What it touches', order.filter(function (t) { return byType[t]; }).map(function (t) { return '<div style="margin-bottom:6px"><div class="small dim">' + esc(P.TYPE_LABEL[t]) + '</div>' + P.chips(byType[t]) + '</div>'; }).join('')) +
    '<div data-anchor="mitigations">' + sec('Mitigations — technical controls that reduce it', '<ol style="margin:0;padding-left:18px">' + f.mitigations.map(function (m) { return '<li style="margin:3px 0">' + esc(m) + '</li>'; }).join('') + '</ol>') + '</div>' +
    sec('Evidence', '<p class="small muted" style="margin:0">Detector output <span class="mono">' + esc(f.detector) + '</span>; lineage and access records for the entities above. Evidence is regenerated on each detector run.</p>') +
    '<div class="btn-row" style="margin-top:14px"><button class="btn" data-act="explainEng" data-id="' + f.id + '">Explain to an engineer</button><button class="btn" data-act="explainCPO" data-id="' + f.id + '">Explain to the CPO</button><a class="btn" href="#/report/executive?f=' + f.id + '">Executive memo</a></div>';
};

/* ── system ─────────────────────────────────────────────── */
P.passports.system = function (s) {
  var ds = NS.datasets.filter(function (d) { return d.system === s.id; });
  var fin = P.findingsFor(s.id).concat([].concat.apply([], ds.map(function (d) { return P.findingsFor(d.id); })));
  var out = P.flowsFrom(s.id), inn = P.flowsTo(s.id);
  return head('System · ' + s.kind, s.name, s.region ? 'region ' + esc(s.region) : '') +
    why(ds.length ? ds.map(function (d) { return d.why; })[0] : (s.feature ? 'Implements ' + P.name(s.feature) + '.' : null), false, 'WHY DOES THIS SYSTEM EXIST?') +
    kv([['Owning team', owner(s.team)], ['Product', s.product ? chip(s.product) : '<span class="dim">shared platform</span>'], ['Feature', s.feature ? chip(s.feature) : '—'], ['Parent', s.parent ? chip(s.parent) : '—'],
      ['Stores', ds.length ? P.chips(ds.map(function (d) { return d.id; })) : '<span class="dim">no registered datasets</span>'],
      ['Inbound flows', inn.length ? inn.map(function (f) { return chip(f.id, P.name(f.from) + ' →'); }).join(' ') : '—'],
      ['Outbound flows', out.length ? out.map(function (f) { return chip(f.id, '→ ' + P.name(f.to)); }).join(' ') : '—']]) +
    sec('Findings', findingsList(P.uniq(fin.map(function (f) { return f.id; })).map(function (id) { return P.get(id).obj; })));
};
P.passports.product = function (p) {
  var feats = NS.features.filter(function (f) { return f.product === p.id; });
  var sys = NS.systems.filter(function (s) { return s.product === p.id; });
  var ds = NS.datasets.filter(function (d) { return d.product === p.id; });
  var fin = P.openFindings().filter(function (f) { return f.entities.indexOf(p.id) >= 0 || sys.some(function (s) { return f.entities.indexOf(s.id) >= 0; }) || ds.some(function (d) { return f.entities.indexOf(d.id) >= 0; }) || feats.some(function (x) { return f.entities.indexOf(x.id) >= 0; }); });
  return head('Product', p.name, chip(p.bu) + ' · ' + (p.users ? fmtN(p.users) + ' users' : 'internal')) +
    kv([['Owner', owner(p.team)], ['Features', P.chips(feats.map(function (f) { return f.id; }))], ['Systems', P.chips(sys.map(function (s) { return s.id; }))], ['Datasets', ds.length ? P.chips(ds.map(function (d) { return d.id; })) : '—']]) +
    sec('Open findings · ' + fin.length, findingsList(fin)) +
    '<div class="btn-row" style="margin-top:12px">' + feats.map(function (f) { return '<a class="btn" href="#/privacy/reviews/' + f.id + '">Review workbench: ' + esc(f.name) + '</a>'; }).join('') + '</div>';
};
P.passports.feature = function (f) {
  var r = NS.reviews.filter(function (x) { return x.feature === f.id; })[0];
  var q = NS.eightQ[f.id];
  return head('Feature', f.name, chip(f.product) + ' · ' + esc(f.status)) +
    kv([['Review', r ? '<span class="mono">' + r.id + '</span> · ' + esc(r.stage) + ' · ' + P.sev(r.risk) : unk('NO REVIEW')], ['Systems', P.chips(NS.systems.filter(function (s) { return s.feature === f.id; }).map(function (s) { return s.id; }))]]) +
    (q ? sec('The 8 questions', '<div class="tbl-wrap"><table class="tbl"><tbody>' + Object.keys(q).map(function (k) { return '<tr><td class="mono small nowrap">' + k + '</td><td>' + (q[k] ? esc(q[k]) : unk()) + '</td></tr>'; }).join('') + '</tbody></table></div>') : '') +
    '<div class="btn-row" style="margin-top:12px"><a class="btn primary" href="#/privacy/reviews/' + f.id + '">Open the review workbench →</a></div>';
};
P.passports.identifier = function (i) {
  var ds = NS.datasets.filter(function (d) { return P.dsIds(d).indexOf(i.id) >= 0; });
  var joins = NS.idJoins.filter(function (j) { return j[0] === i.id || j[1] === i.id; });
  var weaker = /GLOBAL|CROSS/.test(i.cls);
  return head('Identifier · ' + i.cls, i.name, 'lifespan ' + esc(i.lifespan)) +
    '<div class="why' + (weaker ? ' flag' : '') + '"><div class="wl">CAN WE USE A WEAKER, ROTATING, SCOPED OR PURPOSE-SPECIFIC IDENTIFIER?</div><p>' + (weaker ? 'Yes — this is a ' + esc(i.cls.toLowerCase()) + ' identifier. Every dataset below that only needs to recognise a person within one purpose could carry a purpose-scoped token instead.' : 'This identifier is already ' + esc(i.cls.toLowerCase()) + '. Keep it that way: watch for joins that break the scope.') + '</p></div>' +
    '<p class="small muted">' + esc(i.note) + '</p>' +
    sec('Carried by ' + ds.length + ' datasets', P.chips(ds.map(function (d) { return d.id; }))) +
    sec('Joins', joins.length ? '<div class="tbl-wrap"><table class="tbl"><tbody>' + joins.map(function (j) { var other = j[0] === i.id ? j[1] : j[0]; return '<tr><td>' + chip(other) + '</td><td class="small">' + esc(j[3]) + (j[2] ? ' · in ' + esc(P.name(j[2])) : '') + '</td><td>' + (j[4] ? '<span class="tag">sanctioned</span>' : '<span class="tag sev-HIGH">unsanctioned</span>') + '</td></tr>'; }).join('') + '</tbody></table></div>' : '<p class="dim small">No joins.</p>') +
    sec('Findings', findingsList(P.findingsFor(i.id)));
};
P.passports.vendor = function (v) {
  var iss = P.vendorIssues().filter(function (x) { return x.v.id === v.id; })[0].issues;
  var flowsIn = NS.flows.filter(function (f) { return f.to === v.id; });
  var hs = NS.handshakes[v.id];
  return head('Vendor · ' + v.role, v.name, (v.declared ? 'declared' : '<span class="bad">UNDECLARED</span>') + ' · ' + fmtN(v.people) + ' people') +
    '<div class="why' + (hs === 'NONE' ? ' flag' : '') + '"><div class="wl">THE HANDSHAKE RULE — WHAT PATTERN DOES THE PARTNER GET?</div><p>' + (hs === 'NONE' ? 'None. The partner receives person-level data. Name a pattern — token, relay, proof, permission or aggregate — before the data, the retention and the contract.' : esc(hs) + ': the partner gets ' + { TOKEN: 'a stand-in that works for one purpose only.', RELAY: 'a forwarding address that hides the real one.', PERMISSION: 'exactly the data type the person granted.', PROOF: 'a yes or no, never the data.', AGGREGATE: 'a count, no rows.' }[hs]) + '</p></div>' +
    (iss.length ? '<div class="chips" style="margin-bottom:10px">' + iss.map(function (x) { return '<span class="tag ' + (/unknown/.test(x) ? 'k-UNKNOWN' : 'sev-HIGH') + '">' + esc(x) + '</span>'; }).join('') + '</div>' : '<p class="ok small">No detections.</p>') +
    kv([['Data sent', v.data.map(function (x) { return '<span class="mono small">' + esc(x) + '</span>'; }).join(', ')], ['Purpose', v.purpose === 'unknown' ? unk() : chip(v.purpose)], ['Identifiers', v.identifiers.length ? P.chips(v.identifiers) : '<span class="ok">none</span>'],
      ['Sensitive information', P.tier(v.tier)], ['Frequency', esc(v.frequency)], ['People affected', fmtN(v.people)],
      ['Retention (contract / actual)', (v.retention.contract == null ? unk() : v.retention.contract + ' d') + ' / ' + (v.retention.actual == null ? unk() : '<span class="' + (v.retention.contract != null && v.retention.actual > v.retention.contract ? 'bad' : '') + '">' + v.retention.actual + ' d</span>')],
      ['Region', esc(v.region)], ['Subprocessors', P.chips(v.subprocessors)], ['Contract', v.contract ? 'signed ' + esc(v.contract.signed) + ' · expires ' + esc(v.contract.expires) + (v.contract.dpa ? ' · DPA' : '') + (v.contract.noTraining ? ' · no-training clause' : '') : unk('NO CONTRACT')],
      ['Deletion support', v.deletionApi ? '<span class="ok">deletion API</span>' : '<span class="bad">none</span>'], ['Security review', v.securityReview || unk('NEVER')], ['Privacy review', v.privacyReview || unk('NEVER')],
      ['Consent dependency', esc(v.consentDep || 'none')], ['Opt-outs propagate', v.optOutPropagates ? '<span class="ok">yes</span>' : '<span class="bad">no</span>'], ['Last audit', v.lastAudit || unk('NEVER')], ['Attestation', v.attestation || unk('NONE')],
      ['Inbound flows', flowsIn.length ? flowsIn.map(function (f) { return chip(f.id, P.name(f.from) + ' →'); }).join(' ') : '—']]) +
    sec('Findings', findingsList(P.findingsFor(v.id)));
};
P.passports.subprocessor = function (s) { return head('Subprocessor', s.name, 'region ' + esc(s.region)) + (s.known ? '' : '<div class="callout unk" style="margin-top:10px">Not on any vendor\'s subprocessor list. Who they are, what they keep and where they are is <b>unknown</b> — which is a finding.</div>'); };
P.passports.model = function (m) {
  var qs = [
    ['Can this run locally?', m.hosting === 'ON DEVICE' ? true : m.hosting === 'THIRD-PARTY MODEL' ? false : null, m.hosting],
    ['What leaves?', m.hosting === 'ON DEVICE' ? true : null, m.thirdParty.length ? 'to ' + m.thirdParty.map(P.name).join(', ') : 'nothing leaves Northstar'],
    ['Are prompts / outputs logged?', !/full/.test(m.promptLogging), 'prompts: ' + m.promptLogging + ' · outputs: ' + m.outputLogging],
    ['Can employees access prompts?', !/staff/.test(m.humanReview), m.humanReview],
    ['Is user input used for training?', m.trainsOnUserInput === false ? true : m.trainsOnUserInput === true && m.hosting !== 'ON DEVICE' ? false : m.trainsOnUserInput == null ? null : true, m.trainsOnUserInput == null ? 'unknown' : String(m.trainsOnUserInput)],
    ['Can training records be deleted?', /unknown|none/.test(m.deletionPath) ? (/unknown/.test(m.deletionPath) ? null : false) : true, m.deletionPath],
    ['Tested for memorisation?', /not tested/.test(m.memorization) ? false : true, m.memorization],
    ['Training provenance known?', m.provenance === 'documented' ? true : m.provenance === 'partial' ? false : null, m.provenance],
    ['Can RAG return another user\'s data?', m.rag ? null : true, m.rag ? 'ACL on chunks; cross-tenant test not run' : 'no retrieval'],
    ['Can the provider correlate requests?', m.hosting === 'THIRD-PARTY MODEL' ? false : true, m.hosting === 'THIRD-PARTY MODEL' ? 'requests carry a stable account key' : 'n/a']
  ];
  return head('AI / ML system · ' + m.hosting, m.name, esc(m.provider) + ' · ' + esc(m.region)) +
    kv([['Purpose', chip(m.purpose)], ['Owner', owner(m.team)], ['Training data', m.training.length ? P.chips(m.training) : '—'], ['Personal / sensitive', (m.personal ? 'personal' : 'none') + (m.sensitive ? ' · <span class="bad">sensitive</span>' : '')],
      ['Consent / purpose', esc(m.consent)], ['Training retention', esc(m.trainingRetention)], ['Vector / feature store', (m.vector ? chip(m.vector) : '—') + ' ' + (m.featureStore ? chip(m.featureStore) : '')],
      ['Third-party APIs', m.thirdParty.length ? P.chips(m.thirdParty) : 'none'], ['Privacy review', esc(m.review)]]) +
    sec('The questions every AI system must answer', P.list(qs.map(function (q) { return P.check(q[1], '<b>' + esc(q[0]) + '</b> <span class="muted">' + esc(q[2]) + '</span>'); }))) +
    sec('Findings', findingsList(P.findingsFor(m.id)));
};
P.passports.control = function (c) {
  var f = NS.findings.filter(function (x) { return x.entities.indexOf(c.id) >= 0; });
  return head('Control · ' + c.domain, c.name, P.lvl(c.level) + ' · <span class="' + (c.health === 'working' ? 'ok' : c.health === 'failing' ? 'bad' : 'unknown') + '">' + c.health + '</span>') +
    (c.level === 0 ? '<div class="why flag"><div class="wl">THIS CONTROL EXISTS ONLY IN A DOCUMENT</div><p>' + esc(c.statement || c.name) + ' — nothing checks it. Easy to write, easy to ignore.</p></div>' : '') +
    kv([['Owner', owner(c.owner)], ['Scope', esc(c.scope)], ['Evidence', esc(c.evidence)], ['Next rung', c.level < 5 ? 'L' + (c.level + 1) + ' ' + P.LEVELS[c.level + 1] : 'top of the ladder']]) +
    sec('Findings that rely on it', findingsList(f));
};
P.passports.incident = function (i) {
  return head('Incident · ' + i.type, i.title, esc(i.sev) + ' · ' + esc(i.status) + ' · opened ' + esc(i.opened) + ' · ' + fmtN(i.people) + ' people') +
    '<div class="chain" style="margin-top:14px">' +
    [['Incident', i.title, 'bad'], ['Failed assumption', i.assumption, 'bad'], ['Control gap', i.gap, 'bad'], ['Root cause', i.root, ''], ['Remediation', i.remediation, ''], ['Permanent guard', i.guard, 'good']].map(function (x) { return '<div class="cn ' + x[2] + '"><div class="cl">' + x[0] + '</div><div class="cv">' + esc(x[1]) + '</div></div>'; }).join('') + '</div>' +
    '<div class="why"><div class="wl">CAN THIS INCIDENT BECOME A MACHINE-CHECKABLE INVARIANT?</div><p>' + (i.machine ? 'Yes. ' + esc(i.guard) : 'Not yet.') + '</p></div>' +
    sec('Involved', P.chips(i.entities));
};
P.passports.risk = function (r) {
  var c = P.riskCalc(r);
  return head('Risk · ' + r.id, r.name, P.sev(c.rating) + ' · residual ' + c.residual) +
    P.riskWhy(r) + sec('Evidence', P.chips([r.asset].concat(r.findings)));
};
P.passports.team = function (t) {
  var ds = NS.datasets.filter(function (d) { return d.owner === t.id; }), f = P.openFindings().filter(function (x) { return x.owner === t.id; });
  return head('Owner · team', t.name, chip(t.bu) + ' · ' + esc(t.oncall)) + kv([['Datasets', ds.length ? P.chips(ds.map(function (d) { return d.id; })) : '—'], ['Systems', P.chips(NS.systems.filter(function (s) { return s.team === t.id; }).map(function (s) { return s.id; }))]]) + sec('Open findings assigned', findingsList(f));
};
P.passports.bu = function (b) { return head('Business unit', b.name, 'lead ' + esc(b.lead)) + kv([['Products', P.chips(NS.products.filter(function (p) { return p.bu === b.id; }).map(function (p) { return p.id; }))], ['Teams', P.chips(NS.teams.filter(function (t) { return t.bu === b.id; }).map(function (t) { return t.id; }))]]); };
P.passports.purpose = function (p) {
  var decl = NS.datasets.filter(function (d) { return d.purposes.indexOf(p.id) >= 0; });
  var used = NS.flows.filter(function (f) { return f.purpose === p.id; });
  return head('Purpose', p.id, esc(p.label)) + kv([['Declared by', decl.length ? P.chips(decl.map(function (d) { return d.id; })) : '—'], ['Flows using it', used.length ? used.map(function (f) { return chip(f.id); }).join(' ') : '—']]) +
    '<p class="small muted">Purpose is evaluated when data is <b>used</b>, not merely when it is collected. See <a href="#/privacy/purpose">Purpose</a>.</p>';
};
P.passports.consumer = function (c) { return head('Consent consumer', c.name, esc(c.mode)) + kv([['System', P.get(c.system) ? chip(c.system) : esc(c.system)], ['P50 / P95 / P99', c.p50 == null ? unk('NEVER — does not receive revocations') : P.fmtSecs(c.p50) + ' / ' + P.fmtSecs(c.p95) + ' / ' + P.fmtSecs(c.p99)], ['Operating on stale consent', c.stale ? '<span class="bad">' + fmtN(c.stale) + ' people</span>' : '<span class="ok">none</span>']]); };
P.passports.tracker = function (t) { return head('Tracker · ' + t.kind, t.name, esc(t.party) + ' party · ' + esc(t.review)) + (t.flags.length ? '<div class="chips" style="margin:10px 0">' + t.flags.map(function (x) { return '<span class="tag sev-HIGH">' + esc(x) + '</span>'; }).join('') + '</div>' : '') + kv([['Domain', '<span class="mono small">' + esc(t.domain) + '</span>'], ['Company', esc(t.company)], ['Purpose', t.purpose === 'unknown' ? unk() : esc(t.purpose)], ['Identifier', t.identifier ? chip(t.identifier) : 'none'], ['Lifespan', /unknown/.test(t.lifespan) ? unk() : esc(t.lifespan)], ['Where', esc(t.where)], ['Fields transmitted', esc(t.fields)], ['Consent requirement', esc(t.consent)], ['Recipient', esc(t.recipient)], ['Review', esc(t.review)]]); };
P.passports.pet = function (p) { return head('PET · ' + p.group, p.name, '') + kv([['Threat addressed', esc(p.threat.join(', '))], ['Privacy benefit', esc(p.benefit)], ['Utility impact', esc(p.utility)], ['Performance cost', esc(p.perf)], ['Trust assumptions', esc(p.trust)], ['Engineering complexity', esc(p.complexity)], ['Residual risk', esc(p.residual)], ['Fits Northstar features', p.fit.length ? P.chips(p.fit) : '—']]); };
P.passports.regulation = function (r) { return head('Regulation / policy', r.name, esc(r.scope) + ' · orientation, not legal advice') + '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Obligation</th><th>Data</th><th>Control</th><th>Status</th></tr></thead><tbody>' + r.obligations.map(function (o) { return '<tr><td>' + esc(o.text) + '</td><td>' + chip(o.data) + '</td><td>' + (o.control ? chip(o.control) : unk()) + '</td><td><span class="tag ' + (o.status === 'met' ? 'sev-GOOD' : o.status === 'gap' ? 'sev-HIGH' : 'sev-MEDIUM') + '">' + o.status + '</span></td></tr>'; }).join('') + '</tbody></table></div>'; };
P.passports.region = function (r) { return head('Region', r.label, esc(r.kind)) + sec('Transfers', NS.transfers.filter(function (t) { return t.from === r.id || t.to === r.id; }).map(function (t) { return '<div class="small">' + esc(t.from) + ' → ' + esc(t.to) + ' · ' + esc(t.what) + '</div>'; }).join('') || '—'); };
P.passports.endpoint = function (e) { return head('Endpoint', e.name, '') + kv([['Outbound flows', P.flowsFrom(e.id).map(function (f) { return chip(f.id, '→ ' + P.name(f.to)); }).join(' ') || '—'], ['Inbound flows', P.flowsTo(e.id).map(function (f) { return chip(f.id, P.name(f.from) + ' →'); }).join(' ') || '—']]); };
P.passports.generic = function (o, e) { return head(P.TYPE_LABEL[e.type] || e.type, e.name, ''); };

/* explainable risk breakdown (used by passport + Risk Radar) */
P.riskWhy = function (r) {
  var c = P.riskCalc(r);
  var rows = NS.riskFactors.map(function (f) {
    var v = r.f[f.k], w = v / 5 * 100, as = f.kind === 'assurance';
    return '<div class="br"><span>' + esc(f.label) + (as ? ' <span class="dim small">(assurance)</span>' : '') + '</span><span class="track"><span class="fill" style="width:' + w + '%;background:' + (as ? 'var(--ctl)' : v >= 4 ? 'var(--exp)' : v >= 3 ? 'var(--med)' : 'var(--t1)') + '"></span></span><span class="mono small" style="text-align:right">' + v + ' / 5</span></div>';
  }).join('');
  return '<div class="card flat" style="margin:12px 0"><div class="card-h"><h3 style="margin:0">' + P.sev(c.rating) + ' ' + esc(r.name) + '</h3><span class="mono small dim">residual ' + c.residual + '</span></div>' +
    '<div class="g2 grid"><div><div class="small dim" style="margin-bottom:4px">WHY</div><ul class="checks">' + r.why.map(function (w) { return '<li><span class="ic bad">+</span><span>' + esc(w) + '</span></li>'; }).join('') + '</ul></div>' +
    '<div><div class="small dim" style="margin-bottom:4px">MITIGATING CONTROLS</div><ul class="checks">' + r.mitigating.map(function (m) { return P.check(m[1], esc(m[0])); }).join('') + '</ul></div></div>' +
    '<div class="bars" style="margin-top:12px">' + rows + '</div>' +
    '<p class="mono small dim" style="margin:10px 0 0">exposure = Σ nine exposure factors = ' + c.exposure + ' / 45 · assurance = (control + delete + verify) / 15 = ' + c.assurance.toFixed(2) + '<br>residual = exposure × (1 − 0.6 × assurance) = ' + c.residual + ' → HIGH ≥ 26 · MEDIUM ≥ 16</p></div>';
};
})();
