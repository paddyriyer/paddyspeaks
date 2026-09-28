/* Universal privacy search, the Privacy Analyst, and the guided investigation.
 *
 * Nothing here is a language model. A question is matched to a structured
 * query over the records; the answer is composed from what the query returns,
 * each statement is labelled FACT, INFERENCE, RECOMMENDATION or UNKNOWN, and
 * EVERY answer ends with the exact records it used (P.cite). An answer with no
 * source records is not shown as an answer: it is an UNKNOWN. When no query
 * fits the question, the palette says so instead of guessing. */
(function () {
'use strict';
var P = window.PCC, NS = window.NS, esc = P.esc, chip = P.chip, fmtN = P.fmtN;
var uniq = P.uniq;

function ent(id) { var e = P.get(id); return e ? e.obj : null; }
function typeOf(id) { var e = P.get(id); return e ? e.type : null; }
function isVendorish(id) { var t = typeOf(id); return t === 'vendor' || t === 'subprocessor'; }
function hasField(d, re) { return d.fields.some(function (f) { return re.test(f[0]); }); }
function pl(n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); }
function list(ids) { return ids.map(function (i) { return P.name(i); }).join(', '); }
function S(k, t, cite) { return { k: k, t: t, cite: (cite || []).filter(Boolean) }; }
function ctlStmt(cid) {
  var t = P.controlTest(cid), c = t.control; if (!c) return null;
  if (t.result === 'never') return S('UNKNOWN', c.name + ' has never been tested, so it proves nothing yet (' + (t.evidence || 'no evidence') + ').', [cid]);
  return S(t.result === 'pass' ? 'FACT' : 'FACT', 'Evidence: ' + c.name + ' (L' + c.level + ') ' + (t.result === 'pass' ? 'passed' : 'failed') + ' its last test on ' + P.hdate(t.last) + ' — ' + t.evidence + (t.exceptions.length ? '; it does not cover: ' + t.exceptions.join('; ') : '') + '.', [cid]);
}
function when(iso) { return P.hdate(iso); }

/* ── the investigations (answers composed from records) ───────────── */
var LOC = /^(precise_)?(lat|lon)$/, LOCF = /(^|[^a-z])(precise_)?(lat|lon)([^a-z]|$)/;
function qLocation() {
  var ds = NS.datasets.filter(function (d) { return hasField(d, LOC); });
  var flows = NS.flows.filter(function (f) { return f.fields.some(function (x) { return LOCF.test(x); }); });
  var outside = uniq(flows.map(function (f) { return f.to; }).filter(isVendorish));
  var inside = uniq(flows.map(function (f) { return f.to; }).filter(function (x) { return !isVendorish(x); }));
  var out = [S('FACT', pl(ds.length, 'dataset') + ' hold precise coordinates: ' + list(ds.map(function (d) { return d.id; })) + '.', ds.map(function (d) { return d.id; }))];
  ds.forEach(function (d) {
    var r = d.retention;
    if (d.accessPeople == null) out.push(S('UNKNOWN', 'Who can read ' + d.name + ' is not recorded.', [d.id, d.system]));
    else out.push(S('FACT', d.name + ' (' + P.name(d.system) + '): readable by ' + pl(d.accessPeople, 'person', 'people') + ' and ' + pl(d.accessServices, 'service') + '; kept ' + (r.actual == null ? 'for an unknown time' : P.fmtDays(r.actual)) + (r.required > 0 && r.actual > r.required ? ' against a need of ' + P.fmtDays(r.required) : '') + '.', [d.id, d.system]));
  });
  out.push(S('FACT', 'Coordinates move over ' + pl(flows.length, 'flow') + ', into ' + list(inside) + (outside.length ? ' and out to ' + list(outside) : '') + '.', flows.map(function (f) { return f.id; }).concat(inside)));
  outside.forEach(function (v) {
    var o = ent(v), fl = flows.filter(function (f) { return f.to === v; }).map(function (f) { return f.id; });
    if (!o.declared) out.push(S('FACT', o.name + ' receives ' + o.data.join(', ') + ' with no contract or declaration.', [v].concat(fl)));
    if (o.retention.actual == null) out.push(S('UNKNOWN', 'How long ' + o.name + ' keeps the coordinates, and who it passes them to, is unknown.', [v].concat(o.subprocessors)));
  });
  var ctl = uniq([].concat.apply([], ds.map(function (d) { return [].concat.apply([], P.promisesFor(d.id).map(function (p) { return p.controls || []; })); })));
  ctl.forEach(function (c) { var s = ctlStmt(c); if (s) out.push(s); });
  out.push(S('RECOMMENDATION', 'Coarsen to city at collection, enforce the 30-day TTL, and remove the undeclared SDK.', ['PRV-0201', 'PRV-0214', 'PRV-0240'].filter(P.get)));
  return { stmts: out, anchor: 'PR-LOC', rule: 'datasets with a lat / lon / precise_lat / precise_lon field; flows whose fields carry coordinates; their recipients; the controls of the promises covering those datasets',
    items: ds.map(function (d) { return { id: d.id, why: (d.accessPeople == null ? 'readers unknown' : d.accessPeople + ' people') + ' · ' + (P.fmtDays(d.retention.actual) || 'unknown') }; }).concat(outside.map(function (v) { return { id: v, why: 'receives ' + ent(v).data.join(', ') }; })) };
}
function qRevoked() {
  var vs = NS.vendors.filter(function (v) { return v.consentDep && !v.optOutPropagates; });
  var out = [S('FACT', pl(vs.length, 'vendor') + ' receive data that depends on consent but are not told when someone revokes it: ' + list(vs.map(function (v) { return v.id; })) + '.', vs.map(function (v) { return v.id; }))];
  vs.forEach(function (v) {
    var fl = P.flowsTo(v.id).map(function (f) { return f.id; });
    var cc = NS.consentConsumers.filter(function (c) { return c.system === v.id; });
    var del = P.deletionStatus ? P.deletionStatus(v.id) : null;
    var why = [];
    cc.forEach(function (c) { why.push('opt-outs are not sent (' + c.name + ': ' + fmtN(c.stale) + ' people processed on stale consent)'); });
    why.push(del ? P.DEL_TEXT[del.status] : v.deletionApi ? 'no deletion request on record' : 'no deletion mechanism at all');
    out.push(S('FACT', v.name + ' keeps ' + v.data.join(', ') + ' after revocation: ' + why.join('; ') + (v.retention.actual != null ? '; kept ' + P.fmtDays(v.retention.actual) : '') + '.', [v.id].concat(fl, cc.map(function (c) { return c.id; }))));
    if (v.retention.actual == null) out.push(S('UNKNOWN', 'How long ' + v.name + ' keeps it, and whether it can delete it, is unknown — there is no contract.', [v.id]));
  });
  var inc = NS.incidents.filter(function (i) { return i.status !== 'closed' && i.entities.indexOf('c_consent_batch') >= 0; });
  inc.forEach(function (i) { out.push(S('FACT', i.id + ': ' + i.title + ' (' + i.status + ').', [i.id])); });
  ['c_consent_batch', 'c_consent_read', 'c_vendor_attest'].forEach(function (c) { var s = ctlStmt(c); if (s) out.push(s); });
  out.push(S('RECOMMENDATION', 'Pause batches to vendors that do not acknowledge revocations, and require a deletion receipt per revoked person.', ['D-104'].filter(P.get)));
  return { stmts: out, anchor: 'PR-OPTOUT', rule: 'vendors with a consent dependency whose opt-outs do not propagate, with their flows, consent consumers, deletion status and the consent controls’ last tests',
    items: vs.map(function (v) { return { id: v.id, why: v.data.join(', ') + ' · opt-out not propagated' }; }) };
}
var SECP = ['fraud_prevention', 'account_security'];
function qSecurity() {
  var ds = NS.datasets.filter(function (d) { return d.purposes.some(function (p) { return SECP.indexOf(p) >= 0; }); });
  var dIds = ds.map(function (d) { return d.id; });
  var misuse = [];
  ds.forEach(function (d) { P.flowsFrom(d.system).forEach(function (f) { if (d.purposes.indexOf(f.purpose) < 0) misuse.push({ d: d, f: f }); }); });
  var finds = NS.findings.filter(function (f) { return P.isOpenFinding(f) && /PURPOSE/.test(f.kind) && f.entities.some(function (e) { return dIds.indexOf(e) >= 0; }); });
  var prodOf = function (id) { var o = ent(id); if (!o) return null; if (typeOf(id) === 'product') return id; return o.product || (o.system && ent(o.system) ? ent(o.system).product : null); };
  var products = [];
  misuse.forEach(function (m) { var p = prodOf(m.f.to); if (p && p !== m.d.product) products.push(p); });
  finds.forEach(function (f) {
    var own = f.entities.filter(function (e) { return dIds.indexOf(e) >= 0; }).map(function (e) { return ent(e).product; });
    f.entities.forEach(function (e) { if (dIds.indexOf(e) >= 0 || ['system', 'dataset'].indexOf(typeOf(e)) < 0) return; var p = prodOf(e); if (p && own.indexOf(p) < 0) products.push(p); });
  });
  products = uniq(products);
  var out = [S('FACT', pl(ds.length, 'dataset') + ' are held for security or fraud prevention. ' + (products.length ? (products.length === 1 ? 'One product uses' : products.length + ' products use') + ' them for something else: ' + list(products) + '.' : 'No product outside security reads them.'), dIds.concat(products))];
  misuse.forEach(function (m) { out.push(S('FACT', m.d.name + ' (collected for ' + m.d.purposes.join(', ') + ') flows to ' + P.name(m.f.to) + ' for ' + m.f.purpose + ' — ' + m.f.status + (m.f.control ? '' : ', with no control on the flow') + '.', [m.d.id, m.f.id, m.f.to, prodOf(m.f.to)])); });
  finds.forEach(function (f) { out.push(S('FACT', f.id + ': ' + f.title + '.', [f.id].concat(f.entities.filter(function (e) { return dIds.indexOf(e) >= 0; })))); });
  ['c_purpose_fs', 'c_purpose_runtime'].forEach(function (c) { var s = ctlStmt(c); if (s) out.push(s); });
  out.push(S('INFERENCE', 'The only control on these reads is a person approving access requests; the runtime purpose check covers other products, not these stores.', ['c_purpose_fs', 'c_purpose_runtime']));
  out.push(S('RECOMMENDATION', 'Remove the advertising consumers now; move the purpose check to runtime at the feature store and the profile service.', ['D-103'].filter(P.get)));
  return { stmts: out, anchor: 'PR-SEC', rule: 'datasets declared for fraud_prevention or account_security; flows from their systems whose purpose is not declared for them; open PURPOSE findings naming them; the consuming products',
    items: products.map(function (p) { return { id: p, why: 'uses security data for another purpose' }; }).concat(misuse.map(function (m) { return { id: m.f.id, why: m.d.name + ' → ' + m.f.purpose }; })) };
}
function qDana() {
  if (!P.dana) return { stmts: [S('UNKNOWN', 'The person model is not loaded, so the question cannot be answered.', [])], anchor: 'u_dana', rule: '—', items: [] };
  var D = P.dana(), by = { verified: [], waiting: [], failed: [], unknown: [], none: [] };
  D.holders.forEach(function (h) { var s = P.deletionStatus(h); by[s ? s.status : 'none'].push(h); });
  var n = D.holders.length, ok = by.verified.length, trace = P.deletionTraceUsed && P.deletionTraceUsed();
  var out = [S(ok === n ? 'FACT' : 'FACT', (ok === n ? 'Yes. ' : 'No. ') + ok + ' of ' + n + ' places that hold Dana’s data can prove her deletion' + (trace ? ' (from the deletion trace)' : ' (from the deletion targets and their receipts)') + '.', ['u_dana'].concat(D.holders))];
  if (by.failed.length) out.push(S('FACT', 'Deletion failed in ' + by.failed.length + ' places: ' + by.failed.map(function (h) { var s = P.deletionStatus(h); return P.name(h) + ' — ' + (s.method || s.evidence || 'failed'); }).join('; ') + '.', by.failed));
  if (by.waiting.length) out.push(S('FACT', 'Still waiting for ' + list(by.waiting) + ' to confirm.', by.waiting));
  if (by.unknown.length) out.push(S('UNKNOWN', 'Whether she is gone from ' + list(by.unknown) + ' cannot be determined: the deletion method itself is unknown.', by.unknown));
  if (by.none.length) out.push(S('UNKNOWN', list(by.none) + ' hold her data but are not wired to deletion at all, so nothing proves she is gone from them.', by.none));
  ['c_delete_verify', 'c_delete_orch', 'c_backup_reapply', 'c_vendor_attest'].forEach(function (c) { var s = ctlStmt(c); if (s) out.push(s); });
  out.push(S('RECOMMENDATION', 'Tell her deletion is “in progress”, not done, until every place above confirms — the promise says “everywhere, including our partners”.', ['PR-DELETE', 'D-107'].filter(P.get)));
  return { stmts: out, anchor: 'u_dana', go: 'privacy/deletion', goLabel: 'Open Deletion', rule: 'every system holding a dataset in Dana’s profile, plus every vendor reached by a flow from them, checked against ' + (trace ? 'the deletion trace' : 'the deletion targets') + ' and the deletion controls’ last tests',
    items: D.holders.map(function (h) { var s = P.deletionStatus(h); return { id: h, why: s ? P.DEL_TEXT[s.status] : 'not wired to deletion' }; }) };
}
var CONVO = /prompt_text|output_text|transcript|memory_text|source_conversation/;
function qConversations() {
  var ds = NS.datasets.filter(function (d) { return hasField(d, CONVO); }), dIds = ds.map(function (d) { return d.id; });
  var sysIds = ds.map(function (d) { return d.system; });
  var trained = NS.models.filter(function (m) { return m.training.some(function (t) { return dIds.indexOf(t) >= 0; }); });
  var proc = NS.models.filter(function (m) { return trained.indexOf(m) < 0 && m.feature && NS.systems.some(function (s) { return s.feature === m.feature && sysIds.indexOf(s.id) >= 0; }); });
  var provFlows = NS.flows.filter(function (f) { return isVendorish(f.to) && f.fields.some(function (x) { return /prompt|transcript|conversation/.test(x); }) && NS.models.some(function (m) { return (m.thirdParty || []).indexOf(f.to) >= 0; }); });
  var out = [S('FACT', pl(trained.length, 'model') + ' are trained on customer conversations: ' + list(trained.map(function (m) { return m.id; })) + '.', trained.map(function (m) { return m.id; }).concat(dIds))];
  trained.forEach(function (m) {
    var src = m.training.filter(function (t) { return dIds.indexOf(t) >= 0; });
    out.push(S('FACT', m.name + ' learns from ' + list(src) + '; removal: ' + m.deletionPath + '; memorisation: ' + m.memorization + '; review: ' + m.review + '.', [m.id].concat(src)));
    if (m.trainsOnUserInput == null) out.push(S('UNKNOWN', 'Whether ' + m.provider + ' trains its own model on these conversations is unknown.', [m.id].concat(m.thirdParty || [])));
  });
  proc.forEach(function (m) { out.push(S('FACT', m.name + ' reads conversations to extract memories (' + m.review + '); it stores its output, it is not trained on them.', [m.id, m.feature])); });
  provFlows.forEach(function (f) {
    var v = ent(f.to);
    out.push(S(f.retention === 'unknown' ? 'UNKNOWN' : 'FACT', P.name(f.to) + ' receives ' + f.fields.join(', ') + ' (' + f.purpose + ')' + (f.contract ? '; contract: ' + f.contract : '') + (f.retention === 'unknown' ? '; how long it keeps them is unknown' : '; kept ' + f.retention) + '.', [f.to, f.id]));
  });
  ['c_ai_review', 'c_prompt_redact'].forEach(function (c) { var s = ctlStmt(c); if (s) out.push(s); });
  out.push(S('RECOMMENDATION', 'Train only on conversations people opted in to, cap prompt logs at 30 days, and review the summariser’s provider before it sees another transcript.', ['D-105', 'PRV-0237'].filter(P.get)));
  return { stmts: out, anchor: 'PR-AI', rule: 'datasets with prompt, output, transcript or memory text; models trained on them or built into the same feature; model providers receiving that text over a flow',
    items: trained.concat(proc).map(function (m) { return { id: m.id, why: m.hosting + ' · trains on input: ' + (m.trainsOnUserInput == null ? 'UNKNOWN' : m.trainsOnUserInput) }; }) };
}
function qChanged() {
  if (!P.reviewInfo) return { stmts: [S('UNKNOWN', 'The review model is not loaded.', [])], rule: '—', items: [] };
  var xs = NS.reviews.map(P.reviewInfo);
  var signed = xs.filter(function (x) { return x.signedOff; }), changed = signed.filter(function (x) { return x.changes.length; });
  var quiet = signed.filter(function (x) { return !x.changes.length; });
  var pre = xs.filter(function (x) { return !x.signedOff && x.changes.length; });
  var out = [S('FACT', changed.length + ' of ' + signed.length + ' signed-off reviews have changed since sign-off, so their approval no longer describes the system.', changed.map(function (x) { return x.r.id; }))];
  changed.forEach(function (x) {
    var ents = uniq([].concat.apply([], x.changes.map(function (d) { return d.entities; })));
    out.push(S('FACT', x.r.id + ' ' + P.name(x.r.feature) + ' (signed off ' + when(x.signedOff) + '): ' + x.changes.map(function (d) { return d.text.replace(/\.$/, '') + ' (' + when(d.t) + ')'; }).join('; ') + '.', [x.r.id, x.r.feature].concat(ents)));
  });
  if (pre.length) out.push(S('FACT', pl(pre.length, 'review') + ' not yet signed off also changed since intake: ' + pre.map(function (x) { return x.r.id + ' ' + P.name(x.r.feature); }).join(', ') + '.', pre.map(function (x) { return x.r.id; })));
  if (quiet.length) out.push(S('FACT', 'No recorded change since sign-off for ' + quiet.map(function (x) { return x.r.id; }).join(', ') + '.', quiet.map(function (x) { return x.r.id; })));
  var cov = NS.indicators && NS.indicators.drift && NS.indicators.drift.coverage;
  if (cov) out.push(S('UNKNOWN', 'Drift detection sees ' + Math.round(cov.v * 100) + '% of the estate (' + cov.of + '); a change outside it would not appear here.', changed.concat(quiet).map(function (x) { return x.r.id; })));
  out.push(S('RECOMMENDATION', 'Reopen ' + (changed.map(function (x) { return x.r.id; }).join(', ') || 'no review') + ' now; a signed-off review that no longer matches production is not evidence.', changed.map(function (x) { return x.r.id; })));
  return { stmts: out, anchor: changed.length ? changed[0].r.feature : null, go: 'privacy/reviews', goLabel: 'Open Privacy reviews', rule: 'drift events (NS.drift) after each review’s sign-off that name any system, dataset, flow, vendor, model, identifier or finding in the reviewed feature’s scope',
    items: changed.map(function (x) { return { id: x.r.id, why: pl(x.changes.length, 'change') + ' since ' + when(x.signedOff) }; }) };
}

/* Older structured queries: same rule — the answer is the records. */
function simple(s, items, rule, extra) { return function () { var it = items(); return { stmts: [S('FACT', s(it), it.map(function (x) { return x.id; }))].concat(extra ? extra(it) : []), items: it, rule: rule }; }; }
var INTENTS = [
  { six: true, k: ['precise location data', 'precise location', 'location data', 'location', 'gps', 'coordinates', 'lat', 'lon'], q: 'Who has precise location data?', run: qLocation },
  { six: true, k: ['consent was revoked', 'after consent', 'still have data', 'revoked', 'after revocation', 'opted out', 'after opt-out'], q: 'Which vendors still have data after consent was revoked?', run: qRevoked },
  { six: true, k: ['security data', 'another purpose', 'other purpose', 'secondary use', 'fraud data', 'fraud signals', '2fa'], q: 'Which products use security data for another purpose?', run: qSecurity },
  { six: true, k: ['deleted everywhere', 'dana was deleted', 'dana deleted', 'prove dana', 'erasure', 'deleted'], q: 'Can we prove Dana was deleted everywhere?', run: qDana },
  { six: true, k: ['customer conversations', 'conversations', 'contain conversations', 'ai models', 'train on conversations', 'transcripts', 'prompts', 'chat logs'], q: 'Which AI models contain customer conversations?', run: qConversations },
  { six: true, k: ['since the last review', 'last review', 'changed since', 'since review', 'since sign-off', 'reviews changed'], q: 'What changed since the last review?', run: qChanged },
  { k: ['vendors receive email', 'email', 'emails', 'who gets email'], q: 'Which vendors receive emails?', run: simple(function (it) { return it.length + ' vendors receive an email or a hashed email. Hashing is not anonymisation: the same input gives the same hash everywhere.'; },
      function () { return NS.vendors.filter(function (x) { return x.data.some(function (f) { return /email/.test(f); }); }).map(function (x) { return { id: x.id, why: x.data.filter(function (f) { return /email/.test(f); }).join(', ') + ' · ' + x.role }; }); }, 'vendor payload contains email or hashed_email') },
  { k: ['health', 'health data', 'medical', 'cycle', 'special category'], q: 'Where is health data stored?', run: function () {
      var ds = NS.datasets.filter(function (d) { return d.fields.some(function (f) { return f[1] === 4 && /cycle|symptom|health|pregnan|rhr|notes|screen/.test(f[0]); }); });
      var met = ds.filter(function (d) { var tc = P.tierControls(d); return tc.length && tc.every(function (c) { return c[1] === true; }); });
      return { stmts: [S('FACT', ds.length + ' datasets hold health data.', ds.map(function (d) { return d.id; })), S('FACT', met.length + ' of them meet every default control for their tier' + (met.length ? ' (' + met.map(function (d) { return d.name; }).join(', ') + ')' : '') + '; ' + (ds.length - met.length) + ' do not.', ds.map(function (d) { return d.id; }))],
        items: ds.map(function (d) { return { id: d.id, why: P.name(d.system) + ' · ' + d.regions.join(', ') + ' · ' + d.encryption }; }), rule: 'T4 fields about health, symptoms, cycles, heart rate, or health inferences; tier default controls' }; } },
  { k: ['ignore consent', 'systems ignore', 'stale consent', 'consent'], q: 'Which systems ignore consent revocation?', run: simple(function (it) { var c = NS.consentConsumers.filter(function (x) { return x.p50 == null; }); return it.length + ' consumers never receive a revocation; ' + fmtN(c.reduce(function (s, x) { return s + x.stale; }, 0)) + ' people are processed on stale consent.'; },
      function () { return NS.consentConsumers.filter(function (x) { return x.p50 == null; }).map(function (x) { return { id: x.id, why: x.mode }; }); }, 'consent consumers with no propagation path') },
  { k: ['ttl', 'no ttl', 'retention', 'tables have no ttl', 'kept forever'], q: 'Which tables have no TTL?', run: function () { var m = P.metric('nottl'), it = m.items(); return { stmts: [S('FACT', it.length + ' datasets rely on someone remembering to delete.', it.map(function (x) { return x.id; }))], items: it, rule: m.rule }; } },
  { k: ['account id', 'advertising id', 'maid', 'joined', 'join'], q: 'Where is account ID joined to advertising ID?', run: function () {
      var j = NS.idJoins.filter(function (x) { return (x[0] === 'i_customer' && x[1] === 'i_maid') || (x[1] === 'i_customer' && x[0] === 'i_maid') || (x[1] === 'i_maid' && !x[4]); });
      var ok = j.filter(function (x) { return x[4]; }).length;
      return { stmts: [S('FACT', j.length + ' join paths reach the advertising ID; ' + (ok ? ok + ' of them sanctioned.' : 'none of them was sanctioned.'), uniq([].concat.apply([], j.map(function (x) { return [x[0], x[1], x[2]]; }))))],
        items: j.map(function (x) { return { id: x[2] || x[0], why: P.name(x[0]) + ' ↔ ' + P.name(x[1]) + ' — ' + x[3] }; }), rule: 'identifier joins that end at i_maid and are not sanctioned' }; } },
  { k: ['not confirmed deletion', 'vendor deletion', 'vendors deletion', 'deletion confirmation'], q: 'Which vendors have not confirmed deletion?', run: function () {
      var w = NS.deletionTargets.filter(function (t) { return typeOf(t[0]) === 'vendor' && t[3] !== 'verified'; }).map(function (t) { return { id: t[0], why: 'Forget-Me: ' + t[3] }; });
      var n = NS.vendors.filter(function (v) { return !v.deletionApi; }).map(function (v) { return { id: v.id, why: 'no deletion mechanism at all' }; });
      return { stmts: [S('FACT', w.length + ' vendors are still waiting to confirm.', w.map(function (x) { return x.id; })), S('FACT', n.length + ' have no way to delete.', n.map(function (x) { return x.id; }))], items: w.concat(n), rule: 'vendor Forget-Me targets not verified + vendors without a deletion API' }; } },
  { k: ['leave europe', 'europe', 'eu', 'transfer', 'cross-border', 'leaves'], q: 'What data leaves Europe?', run: function () {
      var t = NS.transfers.filter(function (x) { return /^eu/.test(x.from) && !/^eu/.test(x.to); });
      var none = t.filter(function (x) { return /none|unknown/.test(x.basis); });
      return { stmts: [S('FACT', t.length + ' transfers leave Europe.', t.map(function (x) { return x.flow || x.to; })), S(none.length ? 'UNKNOWN' : 'FACT', none.length + ' have no transfer basis on file.', none.map(function (x) { return x.flow || x.to; }))],
        items: t.map(function (x) { return { id: x.flow || x.to, why: x.from + ' → ' + x.to + ': ' + x.what + ' (basis: ' + x.basis + ')' }; }), rule: 'transfers from eu-* regions to non-EU regions' }; } },
  { k: ['full url', 'urls', 'url logged', 'query string'], q: 'Where are full URLs logged?', run: simple(function (it) { return it.length + ' datasets store URLs. A full URL can carry names, tokens and the fact that someone visited a clinic.'; },
      function () { return NS.datasets.filter(function (d) { return hasField(d, /url/); }).map(function (d) { return { id: d.id, why: d.fields.filter(function (f) { return /url/.test(f[0]); }).map(function (f) { return f[0]; }).join(', ') + ' · ' + P.fmtDays(d.retention.actual) }; }); }, 'fields named *url*') },
  { k: ['only in documentation', 'documents', 'paper', 'policy only'], q: 'Which controls exist only in documentation?', go: 'assurance/controls?l=0', run: function () { var m = P.metric('paper'), it = m.items(); return { stmts: [S('FACT', it.length + ' controls are text nobody checks.', it.map(function (x) { return x.id; }))].concat(it.map(function (x) { return ctlStmt(x.id); }).filter(Boolean)), items: it, rule: m.rule, go: 'assurance/controls?l=0', goLabel: 'Open Controls' }; } },
  { k: ['changed this week', 'this week', 'new this week', 'drift this week'], q: 'What changed this week?', run: function () { var m = P.metric('drift'), it = m.items(); return { stmts: [S('FACT', it.length + ' privacy-relevant changes in the last seven days.', it.map(function (x) { return x.id; }))], items: it, rule: m.rule, go: 'assurance/drift', goLabel: 'Open Drift' }; } },
  { k: ['forget-me', 'forget me', 'fail a forget', 'deletion fail'], q: 'What systems would fail a Forget-Me request?', run: function () { var m = P.metric('delfail'), it = m.items(); return { stmts: [S('FACT', it.length + ' Forget-Me targets failed or cannot prove deletion.', it.map(function (x) { return x.id; }))], items: it, rule: m.rule, go: 'privacy/deletion', goLabel: 'Open Deletion' }; } },
  { k: ['infer about one customer', 'one customer', 'one person', 'dossier', 'what can this company infer', 'about dana', 'know about dana'], q: 'What can Northstar know about one customer?', run: function () {
      var D = P.dana ? P.dana() : null; if (!D) return { stmts: [], items: [], rule: '—' };
      var inf = D.facts.filter(function (x) { return x.f.origin === 'inferred' || x.f.origin === 'derived'; });
      return { stmts: [S('FACT', D.facts.length + ' facts about Dana (fictional) are held in ' + D.datasets.length + ' datasets; ' + inf.length + ' of them were computed or guessed rather than given.', ['u_dana'].concat(D.datasets)), S('FACT', D.recipients.length + ' recipients outside Northstar receive some of it.', D.recipients.map(function (r) { return r.id; }))],
        items: [{ id: 'u_dana', why: 'the fictional person' }], rule: 'Dana’s profile: every dataset, join, model and recipient that reaches her identifiers', anchor: 'u_dana', go: 'explore/person', goLabel: 'Open One Person' }; } },
  { k: ['unknown owner', 'no owner', 'orphan', 'unowned'], q: 'What has no owner?', run: function () { var m = P.metric('noowner'), it = m.items(); return { stmts: [S('UNKNOWN', it.length + ' assets have no accountable team. An unknown owner is a finding.', it.map(function (x) { return x.id; }))], items: it, rule: m.rule }; } }
];
P.INTENTS = INTENTS;
P.SIX_QUESTIONS = INTENTS.filter(function (i) { return i.six; }).map(function (i) { return i.q; });

/* ── answers: every one names its records ───────────────────────── */
function citesOf(a) { return uniq([].concat.apply([], (a.stmts || []).map(function (s) { return s.cite; })).concat((a.items || []).map(function (x) { return x.id; }))).filter(function (x) { return P.get(x); }); }
function stmtHTML(s) {
  var c = uniq(s.cite).filter(function (x) { return P.get(x); }), shown = c.slice(0, 8);
  return '<div class="stmt"><span class="tag k-' + s.k + '">' + s.k + '</span><span>' + esc(s.t) + (shown.length ? '<span class="cite">' + shown.map(function (x) { return chip(x); }).join('') + (c.length > shown.length ? '<span class="dim small">+' + (c.length - shown.length) + '</span>' : '') + '</span>' : '') + '</span></div>';
}
P.answerHTML = function (q, a, opts) {
  opts = opts || {};
  var cites = citesOf(a);
  if (!cites.length) return unknownHTML(q, 'The records hold nothing that answers this, so no answer is shown.');
  var anchor = a.anchor && P.get(a.anchor) ? a.anchor : cites[0];
  var tr = [anchor].concat(cites.filter(function (x) { return x !== anchor; }).slice(0, 5));
  return '<div class="answer" data-answer="1"><div class="ah">' + esc(q) + '</div>' + a.stmts.map(stmtHTML).join('') +
    (a.rule ? '<div class="rule">query: ' + esc(a.rule) + '</div>' : '') + P.cite(cites, 'Records used') +
    '<div class="btn-row ans-act"><button class="btn" data-act="trailAdd" data-ids="' + esc(tr.join(',')) + '">Add to trail</button>' +
    '<button class="btn" data-go="chain?from=' + encodeURIComponent(anchor) + '" data-trail="' + esc(anchor) + '" data-close="1">Open the chain</button>' +
    (a.go ? '<button class="btn primary" data-go="' + esc(a.go) + '" data-trail="' + esc(anchor) + '" data-close="1">' + esc(a.goLabel || 'Open') + ' →</button>' : '') + '</div></div>';
};
function unknownHTML(q, why) {
  return '<div class="answer answer-unknown" data-answer="unknown">' + (q ? '<div class="ah">' + esc(q) + '</div>' : '') + '<div class="stmt"><span class="tag k-UNKNOWN">UNKNOWN</span><span>' + esc(why) + ' Nothing is guessed: an unanswerable question is recorded as unknown.</span></div>' + P.cite([]) + '</div>';
}
P.acts.trailAdd = function (el) {
  (el.getAttribute('data-ids') || '').split(',').filter(function (x) { return P.get(x); }).forEach(function (x) { P.pushTrail(x); });
  el.textContent = 'Added to trail ✓';
  var live = document.getElementById('pccLive'); if (live) live.textContent = 'Added to the investigation trail.';
};
P.ask = function (q) { var r = search(q); return r.intent ? { intent: r.intent, a: r.intent.run() } : null; };

/* ── matching ───────────────────────────────────────────────────── */
function reEsc(x) { return x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
/* Whole words only: "lat" must not match "platform" or "translation". */
function hasWord(text, w) { return new RegExp('(^|[^a-z0-9])' + reEsc(w) + '($|[^a-z0-9])').test(text); }
function startsWord(text, w) { return new RegExp('(^|[^a-z0-9])' + reEsc(w)).test(text); }
function norm(s) { return s.toLowerCase().replace(/[’']/g, "'").replace(/[?.!]+\s*$/, '').replace(/\s+/g, ' ').trim(); }
function score(intent, q) { if (norm(intent.q) === q) return 1e3; var s = 0; intent.k.forEach(function (k) { if (hasWord(q, k)) s += k.length; }); if (q.length > 3 && startsWord(intent.q.toLowerCase(), q)) s += 3; return s; }
function search(q) {
  q = norm(q);
  var best = null, bs = 0; if (q) INTENTS.forEach(function (i) { var s = score(i, q); if (s > bs) { bs = s; best = i; } });
  var ents = q.length >= 3 ? Object.keys(P.ENT).filter(function (id) { var n = P.name(id).toLowerCase(); return startsWord(n, q) || id.toLowerCase() === q; }).slice(0, 12) : [];
  var asks = /^(who|what|which|where|when|why|how|can|does|do|is|are|did|will|should)\b/.test(q) || /\?\s*$/.test(q);
  return { intent: bs >= 3 ? best : null, ents: ents, question: asks };
}
P.searchIntent = function (q) { var r = search(q); return r.intent ? r.intent.q : null; };

/* ── the palette ────────────────────────────────────────────────── */
var sel = 0;
function suggestions() { return '<div class="pr-group">Investigate</div>' + INTENTS.filter(function (i) { return i.six; }).map(askBtn).join('') + '<div class="pr-group">Also ask</div>' + INTENTS.filter(function (i) { return !i.six; }).map(askBtn).join(''); }
function askBtn(i) { return '<button class="pr" data-ask="' + esc(i.q) + '"><span class="tag">Q</span><span>' + esc(i.q) + '</span><span class="dim" aria-hidden="true">↵</span></button>'; }
function renderPalette() {
  var q = document.getElementById('paletteInput').value, box = document.getElementById('paletteResults'), r = search(q), h = '';
  if (r.intent) {
    var a = r.intent.run();
    h += P.answerHTML(r.intent.q, a);
    if (a.items && a.items.length) h += '<div class="pr-group">Evidence · ' + a.items.length + '</div>' + a.items.filter(function (it) { return P.get(it.id); }).map(function (it) { return '<button class="pr" data-ent="' + esc(it.id) + '" data-close="1"><span class="tag">' + esc((P.TYPE_LABEL[typeOf(it.id)] || '').split(' ')[0]) + '</span><span><span class="pr-n">' + esc(P.name(it.id)) + '</span><span class="pw">' + esc(it.why || '') + '</span></span><span class="dim" aria-hidden="true">↵</span></button>'; }).join('');
  } else if (q.trim() && (r.question || !r.ents.length)) {
    h += unknownHTML('“' + q.trim() + '”', 'No structured query over Northstar’s records answers this question.');
  }
  if (r.ents.length) h += '<div class="pr-group">Records</div>' + r.ents.map(function (id) { return '<button class="pr" data-ent="' + esc(id) + '" data-close="1"><span class="tag">' + esc((P.TYPE_LABEL[typeOf(id)] || '').split(' ')[0]) + '</span><span>' + esc(P.name(id)) + '</span><span class="dim" aria-hidden="true">↵</span></button>'; }).join('');
  if (!q.trim() || (!r.intent && !r.ents.length)) h += suggestions();
  box.innerHTML = h; sel = 0; mark();
  var live = document.getElementById('pccLive'); if (live) live.textContent = r.intent ? 'Answer: ' + r.intent.q : q.trim() ? (r.ents.length ? r.ents.length + ' matching records' : 'No answer: unknown') : '';
}
function mark() { var items = document.querySelectorAll('#paletteResults .pr'); items.forEach(function (b, i) { b.classList.toggle('sel', i === sel); }); if (items[sel] && sel > 0) items[sel].scrollIntoView({ block: 'nearest' }); }
var lastFocus = null;
/* aria-modal: everything behind the palette is inert while it is open */
var BEHIND = ['view', 'side', 'trail', 'drawer', 'analyst', 'tour'];
function setBehind(on) {
  BEHIND.forEach(function (id) { var el = document.getElementById(id); if (!el) return; if (on) { if (!el.hasAttribute('inert')) { el.setAttribute('inert', ''); el.setAttribute('data-pal-inert', ''); } } else if (el.hasAttribute('data-pal-inert')) { el.removeAttribute('inert'); el.removeAttribute('data-pal-inert'); } });
  document.querySelectorAll('body > header, body > footer').forEach(function (el) { if (on) el.setAttribute('inert', ''); else el.removeAttribute('inert'); });
}
P.openPalette = function (q) { lastFocus = document.activeElement; var p = document.getElementById('palette'); p.hidden = false; setBehind(true); var i = document.getElementById('paletteInput'); i.value = q || ''; renderPalette(); i.focus(); };
P.closePalette = function () { document.getElementById('palette').hidden = true; setBehind(false); if (lastFocus && lastFocus.focus) lastFocus.focus(); };

/* ── analyst ────────────────────────────────────────────────────── */
var AQ = [
  ['What are our largest privacy exposures?', function () {
    return P.risksSorted().slice(0, 4).map(function (r) { var x = P.explainRisk(r); return S('FACT', r.name + ': ' + x.sentence, [r.id, r.asset].concat(r.findings)); })
      .concat([S('INFERENCE', 'The common thread is purpose drift enabled by durable, shared identifiers: fraud, location and health signals reach advertising because the same IDs appear on both sides.', ['i_customer', 'i_device', 'i_maid']), S('RECOMMENDATION', 'Fund purpose-scoped identifiers and query-time purpose enforcement as platform work; they close three of the top four risks at once.', ['c_id_scope', 'c_purpose_runtime'])]);
  }],
  ['Find sensitive information leaving the company.', function () {
    var f = NS.flows.filter(function (x) { return x.boundary === 'third_party' && x.tier >= 3; });
    return f.map(function (x) { return S(x.status === 'unknown' ? 'UNKNOWN' : 'FACT', P.name(x.id) + ': ' + x.fields.join(', ') + (x.status !== 'reviewed' ? ' — ' + x.status + ', nobody signed off' : ''), [x.id, x.to]); })
      .concat([S('RECOMMENDATION', 'Make the egress review a deployment gate for every new destination, including “pre-approved” hosts — the browser telemetry export bypassed it that way.', ['c_gate_egress'])]);
  }],
  ['Find incompatible data uses.', function () {
    var f = NS.flows.filter(function (x) { return (x.flags || []).indexOf('purpose_change') >= 0; });
    return f.map(function (x) { var src = NS.datasets.filter(function (d) { return d.system === x.from; })[0]; return S('FACT', 'Collected for ' + (src ? src.purposes.join(', ') || 'an undeclared purpose' : 'another purpose') + '; used for ' + x.purpose + ' by ' + P.name(x.to) + '.', [x.id, x.from].concat(src ? [src.id] : [])); })
      .concat([S('INFERENCE', 'Each of these was approved by a person or never reviewed at all; none was blocked by a machine.', ['c_purpose_fs']), S('RECOMMENDATION', 'Carry purpose tags on the data and evaluate them at read time, as Pulse already does.', ['c_purpose_runtime'])]);
  }],
  ['Where could pseudonymous data be re-identified?', function () {
    var out = [];
    NS.identifiers.filter(function (i) { return i.cls === 'PURPOSE-SCOPED'; }).forEach(function (i) {
      var bad = NS.idJoins.filter(function (j) { return !j[4] && (j[0] === i.id || j[1] === i.id); });
      if (bad.length) out.push(S('FACT', i.name + ' is classed purpose-scoped, yet ' + bad.length + ' unsanctioned join' + (bad.length > 1 ? 's link' : ' links') + ' it: ' + bad.map(function (j) { return P.name(j[0] === i.id ? j[1] : j[0]) + ' (' + j[3] + (j[2] ? ', ' + P.name(j[2]) : '') + ')'; }).join('; ') + '.', [i.id].concat(bad.map(function (j) { return j[2]; }))));
    });
    var hf = NS.flows.filter(function (f) { return isVendorish(f.to) && f.fields.some(function (x) { return /hashed_email/.test(x); }); });
    var hr = uniq(hf.map(function (f) { return f.to; }));
    if (hr.length) out.push(S('FACT', 'Hashed emails reach ' + pl(hr.length, 'recipient') + ' outside Northstar over ' + pl(hf.length, 'flow') + ' (' + hr.map(P.name).join(', ') + '). A recipient can hash its own users\' emails and match exactly — that match is the product.', ['i_hemail'].concat(hr, hf.map(function (f) { return f.id; }))));
    var geo = NS.datasets.filter(function (d) { return hasField(d, /lat|lon|precise/) && hasField(d, /device_id/); });
    if (geo.length) out.push(S('INFERENCE', geo.map(function (d) { return d.name; }).join(', ') + (geo.length > 1 ? ' carry' : ' carries') + ' precise coordinates beside a device ID: a handful of points reveals home and work, so the device ID alone can be enough to name someone.', geo.map(function (d) { return d.id; })));
    var usp = NS.vendors.filter(function (v) { return v.subprocessors.some(function (x) { return P.get(x) && !P.get(x).obj.known; }); });
    if (usp.length) out.push(S('UNKNOWN', 'Whether the unlisted subprocessors receiving ' + usp.map(function (v) { return v.name; }).join(', ') + ' data hold other datasets to join against.', usp.reduce(function (a, v) { return a.concat(v.subprocessors.filter(function (x) { return P.get(x) && !P.get(x).obj.known; })); }, [])));
    return out.concat([S('RECOMMENDATION', 'Rotate the Pulse install ID, remove MAID from the SDK beacon, and coarsen coordinates to city at collection.', ['PRV-0233', 'PRV-0214'])]);
  }],
  ['Which privacy controls exist only on paper?', function () {
    var m = P.metric('paper'), paper = m.items().map(function (it) { return P.get(it.id).obj; });
    var human = NS.controls.filter(function (c) { return c.level === 1 && P.controlTest(c.id).result === 'fail'; });
    var out = [S('FACT', paper.length + ' controls exist only in documents (' + m.rule.charAt(0).toLowerCase() + m.rule.slice(1).replace(/\.$/, '') + ').', paper.map(function (c) { return c.id; }))]
      .concat(paper.map(function (c) { return ctlStmt(c.id); }).filter(Boolean));
    if (human.length) out = out.concat([S('FACT', 'Not on paper, but close: ' + human.length + ' more control' + (human.length > 1 ? 's rely' : ' relies') + ' on manual review (L1) and failed the last test.', human.map(function (c) { return c.id; }))], human.map(function (c) { return ctlStmt(c.id); }).filter(Boolean));
    var ttl = P.get('c_ttl_wh'), scan = P.get('c_retention_scan');
    if (ttl && scan && ttl.obj.level === 0 && scan.obj.level >= 4 && P.controlTest('c_retention_scan').result === 'pass') out.push(S('RECOMMENDATION', 'Start with the ' + ttl.obj.name + ': the ' + scan.obj.name + ' (L' + scan.obj.level + ', passing) already measures it, so turning the document into a TTL gate reuses a mechanism that exists.', ['c_ttl_wh', 'c_retention_scan']));
    return out;
  }],
  ['What should we fix first?', function () {
    var ranked = P.openFindings().filter(function (f) { return f.sev === 'HIGH'; }).map(function (f) { var ctl = f.entities.filter(function (e) { return typeOf(e) === 'control'; }).map(function (e) { return P.get(e).obj.level; }); var gap = f.enforcement - (ctl.length ? Math.max.apply(null, ctl) : 0); return { f: f, s: Math.log10(f.people) * 2 + Math.max(0, gap) + (P.daysUntil(f.due) < 7 ? 2 : 0) + (f.owner ? 0 : 2) }; }).sort(function (a, b) { return b.s - a.s; }).slice(0, 5);
    return [S('FACT', 'Ranked by people affected (log), the gap between the control that exists and the level required, due date, and whether anyone owns it.', ranked.map(function (x) { return x.f.id; }))].concat(ranked.map(function (x, i) { return S('RECOMMENDATION', (i + 1) + '. ' + x.f.title + ' — first step: ' + x.f.mitigations[0].toLowerCase() + '.', [x.f.id]); }));
  }],
  ['What don\'t we know?', function () {
    var out = [];
    NS.datasets.forEach(function (d) { var six = P.six(d); six.why.filter(function (w) { return six[w[0]] === 'u'; }).forEach(function (w) { out.push(S('UNKNOWN', d.name + ': ' + w[1] + '.', [d.id])); }); });
    NS.flows.filter(function (f) { return f.status === 'unknown'; }).forEach(function (f) { out.push(S('UNKNOWN', 'Undescribed flow: ' + P.name(f.id) + '.', [f.id])); });
    NS.controls.filter(function (c) { return P.controlTest(c.id).result === 'never'; }).forEach(function (c) { out.push(S('UNKNOWN', c.name + ' has never been tested.', [c.id])); });
    out.push(S('INFERENCE', 'Unknowns cluster around one unowned job and two SDKs. Each unknown is a finding: unknown owner, retention, vendor, purpose and deletion path.', ['s_idres', 'v_geogrid', 's_pulsesdk']));
    return out;
  }]
];
function ctxFinding() { var st = P.state.drawerStack; for (var i = st.length - 1; i >= 0; i--) if (typeOf(st[i]) === 'finding') return st[i]; return null; }
/* No finding open: say so and offer the top open findings, rather than
 * silently explaining one the user never picked. */
function pickFinding() {
  var sv = { HIGH: 3, MEDIUM: 2, LOW: 1 }, top = P.openFindings().slice().sort(function (a, b) { return (sv[b.sev] - sv[a.sev]) || (b.people - a.people); }).slice(0, 4);
  return [S('UNKNOWN', 'Which finding? None is open in the passport drawer. Open one (below, or from any list) and ask again: the analyst explains the finding you are looking at.', top.map(function (f) { return f.id; }))];
}
function withFinding(fn) { var id = ctxFinding(); return id ? [S('FACT', 'Explaining ' + id + ', the finding open in the drawer.', [id])].concat(fn(id)) : pickFinding(); }
function ctxEntity() { var st = P.state.drawerStack; return st.length ? st[st.length - 1] : 's_idres'; }
AQ.push(['Explain this finding to an engineer.', function () { return withFinding(explainEng); }]);
AQ.push(['Explain this finding to the CPO.', function () { return withFinding(explainCPO); }]);
AQ.push(['Generate questions for the system owner.', function () {
  var id = ctxEntity(), e = P.get(id), qs = [];
  var ds = e.type === 'dataset' ? [e.obj] : NS.datasets.filter(function (d) { return d.system === id; });
  qs.push(S('FACT', 'Questions for the owner of ' + e.name + (e.obj.team || e.obj.owner ? ' (' + P.name(e.obj.team || e.obj.owner) + ')' : ' — which has no owner, so the first question is who that is') + ':', [id]));
  ['What customer outcome needs this data, and what breaks if it is gone?', 'Which fields could be removed, generalised, or computed on the device?', 'Who and what can join it — and which joins did you intend?', 'After the decision is made, do you still need the raw event?', 'If a person asks to be forgotten, how do you prove every copy is gone?'].forEach(function (q) { qs.push(S('RECOMMENDATION', q, [id])); });
  ds.forEach(function (d) { var six = P.six(d); six.why.forEach(function (w) { qs.push(S(six[w[0]] === 'u' ? 'UNKNOWN' : 'FACT', d.name + ': ' + w[1] + ' — please answer.', [d.id])); }); });
  return qs;
}]);
AQ.push(['Suggest privacy-preserving alternatives.', function () {
  var id = ctxEntity(), e = P.get(id);
  var pets = NS.pets.filter(function (p) { return p.fit.some(function (f) { return f === id || (e.obj.feature && f === e.obj.feature) || (e.obj.system && P.get(e.obj.system) && P.get(e.obj.system).obj.feature === f); }); });
  if (!pets.length) pets = NS.pets.filter(function (p) { return ['minimize', 'ondevice', 'retention', 'pseudo'].indexOf(p.id) >= 0; });
  return [S('FACT', 'Context: ' + e.name + '.', [id])].concat(pets.map(function (p) { return S('RECOMMENDATION', p.name + ' — ' + p.benefit + ' Cost: ' + p.utility.toLowerCase() + '; trust in ' + p.trust.toLowerCase() + '. Residual: ' + p.residual.toLowerCase() + '.', [p.id]); })).concat([S('INFERENCE', 'State the threat first: a technique that does not address it adds complexity without reducing exposure.', pets.map(function (p) { return p.id; }))]);
}]);
function explainEng(fid) {
  var f = P.get(fid).obj;
  var flows = f.entities.filter(function (e) { return typeOf(e) === 'flow'; });
  return [S('FACT', f.id + ' — ' + f.title + '. Detected by: ' + f.detector + '.', [fid]),
    flows.length ? S('FACT', 'The path: ' + flows.map(function (x) { var o = P.get(x).obj; return P.name(o.from) + ' → ' + P.name(o.to) + ' carrying ' + o.fields.join(', '); }).join('; ') + '.', flows) : S('FACT', 'Entities: ' + f.entities.map(P.name).join(', ') + '.', f.entities),
    S('INFERENCE', 'Harm class: ' + f.harms.join(', ') + '. LINDDUN: ' + f.linddun.join(', ') + '.', [fid]),
    S('RECOMMENDATION', 'Ship, in order: ' + f.mitigations.slice(0, 3).join('; ') + '. The fix must reach L' + f.enforcement + ' (' + P.LEVELS[f.enforcement] + ') — a doc change will not close it.', [fid]),
    f.owner ? S('FACT', 'Owner: ' + P.name(f.owner) + ', due ' + P.hdate(f.due) + '.', [f.owner]) : S('UNKNOWN', 'No owner. Assign one before anything else.', [fid])];
}
function explainCPO(fid) {
  var f = P.get(fid).obj;
  return [S('FACT', fmtN(f.people) + ' people are affected.', [fid]), S('FACT', 'What can happen to them: ' + f.human, [fid]),
    S('INFERENCE', 'Likelihood is not hypothetical: the detector observed it in production on ' + P.hdate(f.opened) + '.', [fid]),
    S('RECOMMENDATION', 'Decision: approve “' + f.mitigations[0] + '” now; fund “' + (f.mitigations[1] || f.mitigations[0]) + '” as the durable fix. Product impact is small; the trade-off is written in the memo.', [fid])];
}
P.acts.explainEng = function (el) { P.openAnalyst(); answer('Explain ' + el.getAttribute('data-id') + ' to an engineer', { stmts: explainEng(el.getAttribute('data-id')), anchor: el.getAttribute('data-id') }); };
P.acts.explainCPO = function (el) { P.openAnalyst(); answer('Explain ' + el.getAttribute('data-id') + ' to the CPO', { stmts: explainCPO(el.getAttribute('data-id')), anchor: el.getAttribute('data-id') }); };
function answer(q, a) {
  var body = document.getElementById('analystBody');
  document.getElementById('aAnswers').insertAdjacentHTML('afterbegin', '<div class="msg">' + P.answerHTML(q, a) + '</div>');
  body.scrollTop = 0;
}
P.analystAnswer = answer;
P.openAnalyst = function () {
  var a = document.getElementById('analyst'), body = document.getElementById('analystBody');
  if (!body.innerHTML) {
    body.innerHTML = '<p class="small muted" style="margin-top:0">Answers are composed from Northstar’s records — no language model, nothing invented. Every statement is labelled, and every answer ends with the records it used. <b>UNKNOWN is treated as information</b>: an unknown owner, retention, vendor, purpose or deletion path is itself a finding.</p>' +
      '<div class="legend" style="margin-bottom:12px"><span class="tag k-FACT">FACT</span><span class="tag k-INFERENCE">INFERENCE</span><span class="tag k-RECOMMENDATION">RECOMMENDATION</span><span class="tag k-UNKNOWN">UNKNOWN</span></div>' +
      '<h3 class="aq-h">Investigations</h3><div class="aq">' + INTENTS.filter(function (i) { return i.six; }).map(function (x, i) { return '<button data-ai="' + INTENTS.indexOf(x) + '">' + esc(x.q) + '</button>'; }).join('') + '</div>' +
      '<h3 class="aq-h">Analysis</h3><div class="aq">' + AQ.map(function (x, i) { return '<button data-aq="' + i + '">' + esc(x[0]) + '</button>'; }).join('') + '</div><div id="aAnswers" aria-live="polite"></div>';
    body.addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-aq]'); if (b) { var x = AQ[+b.getAttribute('data-aq')]; answer(x[0], { stmts: x[1]() }); return; }
      var c = ev.target.closest('[data-ai]'); if (c) { var it = INTENTS[+c.getAttribute('data-ai')]; answer(it.q, it.run()); }
    });
    answer(AQ[0][0], { stmts: AQ[0][1]() });
  }
  a.classList.add('open'); a.removeAttribute('inert'); document.getElementById('analystBtn').setAttribute('aria-expanded', 'true');
};
P.closeAnalyst = function () { var a = document.getElementById('analyst'); a.classList.remove('open'); a.setAttribute('inert', ''); document.getElementById('analystBtn').setAttribute('aria-expanded', 'false'); };

/* ── guided investigation ──────────────────────────────── */
var TOUR = [
  { t: 'HIGH RISK', h: 'Start where the number is', p: 'Every number on the Command Center is clickable and explained. This one is the list of open HIGH findings — and the rule that produced it.', go: 'overview?all=1', act: function () { P.openMetric('highfind'); var t = document.querySelector('[data-metric="highfind"]'); if (t) { t.classList.add('hl'); t.scrollIntoView({ block: 'center' }); } } },
  { t: 'PRODUCTS → CHECKOUT', h: 'Pick the product', p: 'Checkout carries several of them. Its passport lists features, systems, datasets and every open finding that touches it.', go: 'explore/products', open: 'p_checkout' },
  { t: 'SYSTEMS → FRAUD SERVICE', h: 'Into the fraud system', p: 'The Fraud Service writes derived features — velocity, IP risk, device fingerprint — to a feature store with a verified 180-day TTL. So far, good architecture.', go: 'explore/systems', open: 's_fraudsvc' },
  { t: 'DATA FLOW', h: 'An arrow nobody reviewed', p: 'From the feature store, customer ID and device fingerprint cross an internal trust boundary into the Marketing Audience Builder. Every arrow is a decision; this one was never made.', go: 'explore/flows?f=fl10', open: 'fl10' },
  { t: 'IDENTITY GRAPH', h: 'The join', p: 'The fingerprint is a cross-app identifier. In the marketing job it meets the advertising ID — a join nobody sanctioned.', go: 'explore/identities', open: 'i_fp' },
  { t: 'VENDOR', h: 'Where it leaves', p: 'The audience export goes to AdReach Network, with the fraud score band attached. Opt-outs are not reaching them either.', go: 'explore/vendors', open: 'v_adreach' },
  { t: 'PURPOSE', h: 'Declared vs actual', p: 'Declared purpose: fraud_prevention. Actual consumer: Marketing Audience Builder. Purpose was checked at collection, never at use.', go: 'privacy/purpose', open: 'd_fraudfeat' },
  { t: 'FINDING', h: 'PURPOSE DRIFT + CROSS-CONTEXT LINKABILITY', p: 'Technical issue → privacy harm → human consequence, the owner, the due date, and the evidence that produced it.', go: 'privacy/risks?r=R-03', open: 'PRV-0217' },
  { t: 'MITIGATIONS', h: 'What reduces it', p: 'Separate identity, tokenise, scope purpose, remove the advertising consumer, shorten retention — and enforce at runtime.', go: 'privacy/risks?r=R-03', open: 'PRV-0217', scroll: 'mitigations' },
  { t: 'ENFORCEMENT', h: 'Is the control actually working?', p: 'The control that should have stopped it is a manual approval (L1), and it failed its last test. The fix must reach runtime enforcement — out of the document and into the machine.', go: 'assurance/controls?d=Purpose', open: 'c_purpose_fs' }
];
var step = -1;
function showStep(i) {
  step = i; var s = TOUR[i], el = document.getElementById('tour');
  el.hidden = false;
  el.innerHTML = '<div class="st">INVESTIGATION · ' + (i + 1) + ' / ' + TOUR.length + ' · ' + esc(s.t) + '</div><h3>' + esc(s.h) + '</h3><p>' + esc(s.p) + '</p><div class="nav"><div class="dots">' + TOUR.map(function (x, k) { return '<i class="' + (k <= i ? 'on' : '') + '"></i>'; }).join('') + '</div><div class="btn-row"><button class="btn ghost" data-tour="end">End</button>' + (i > 0 ? '<button class="btn" data-tour="prev">Back</button>' : '') + (i < TOUR.length - 1 ? '<button class="btn primary" data-tour="next">Next →</button>' : '<button class="btn primary" data-tour="end">Done — WHY answered</button>') + '</div></div>';
  var target = '#/' + s.go;
  var done = function () { if (s.act) s.act(); if (s.open) P.open(s.open, { noFocus: true, scrollTo: s.scroll }); };
  if (location.hash !== target) { location.hash = target; setTimeout(done, 60); } else done();
}
P.acts.tour = function () { if (!document.getElementById('palette').hidden) P.closePalette(); showStep(0); };
document.addEventListener('click', function (ev) {
  var b = ev.target.closest('[data-tour]'); if (b) { var a = b.getAttribute('data-tour'); if (a === 'next') showStep(step + 1); else if (a === 'prev') showStep(step - 1); else { document.getElementById('tour').hidden = true; step = -1; } return; }
  var ask = ev.target.closest('[data-ask]'); if (ask) { document.getElementById('paletteInput').value = ask.getAttribute('data-ask'); renderPalette(); document.getElementById('paletteInput').focus(); return; }
  /* every result followed from an answer is recorded in the trail */
  var tr = ev.target.closest('[data-trail]'); if (tr && P.get(tr.getAttribute('data-trail'))) P.pushTrail(tr.getAttribute('data-trail'));
  var pal = document.getElementById('palette');
  if (!pal.hidden && (ev.target.closest('[data-close]') || (ev.target.closest('[data-ent]') && pal.contains(ev.target)))) setTimeout(function () { pal.hidden = true; setBehind(false); }, 0);
  if (ev.target.id === 'palette') P.closePalette();
});

P.initIntel = function () {
  var inp = document.getElementById('paletteInput');
  if (!document.getElementById('pccLive')) { var l = document.createElement('div'); l.id = 'pccLive'; l.className = 'sr-only'; l.setAttribute('aria-live', 'polite'); document.body.appendChild(l); }
  /* aria-modal: keep Tab inside the palette while it is open */
  document.getElementById('palette').addEventListener('keydown', function (ev) {
    if (ev.key !== 'Tab') return;
    var f = [].slice.call(this.querySelectorAll('input,button,a[href],[tabindex]:not([tabindex="-1"])')).filter(function (x) { return !x.disabled && x.offsetParent !== null; });
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (ev.shiftKey && document.activeElement === first) { ev.preventDefault(); last.focus(); }
    else if (!ev.shiftKey && document.activeElement === last) { ev.preventDefault(); first.focus(); }
    else if (f.indexOf(document.activeElement) < 0) { ev.preventDefault(); first.focus(); }
  });
  inp.addEventListener('input', renderPalette);
  inp.addEventListener('keydown', function (ev) {
    var items = document.querySelectorAll('#paletteResults .pr');
    if (ev.key === 'ArrowDown') { ev.preventDefault(); sel = Math.min(items.length - 1, sel + 1); mark(); }
    else if (ev.key === 'ArrowUp') { ev.preventDefault(); sel = Math.max(0, sel - 1); mark(); }
    else if (ev.key === 'Enter') { ev.preventDefault(); if (items[sel]) items[sel].click(); }
  });
};
})();
