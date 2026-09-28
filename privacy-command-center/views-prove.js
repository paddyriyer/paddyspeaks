/* Views: PROVE & PERSON.
 *
 *   #/explore/person            One Person — what Northstar can KNOW, INFER, JOIN,
 *                               PREDICT and DISCLOSE about Dana (fictional)
 *   #/assurance/controls        Controls & evidence: every control, its last test,
 *   #/assurance/evidence        result, evidence, freshness, exceptions and next test
 *   #/privacy/reviews[/<fid>]   Privacy reviews and the review workbench
 *
 * Loaded after the older view files, so these routes replace theirs. Every
 * figure is computed from data.js, data-ops.js and the synthetic records
 * below; nothing on screen is typed. */

/* ═══════════════════════ synthetic records ═══════════════════════
 * Everything here is invented and describes no real person or organisation.
 * NS.personProfile — what Northstar holds about Dana, by ORIGIN. Each fact
 *   names the dataset and fields it lives in; tier, retention, access, purpose,
 *   recipients, promises and rights reach are all derived from those records.
 * NS.reviewDetails — the parts of a privacy review that data.js does not hold:
 *   who asked, what for, when it was signed off, and the launch conditions,
 *   each mapped to the concrete check (pull request, deployment gate or
 *   control test) that proves it. Intake dates come from the review's age. */
(function () {
'use strict';
var NS = window.NS;
/* [id, origin, attribute, dataset, fields, identifier path, how it got here, levers that would remove it, produced by (entity), source (text, when no entity)] */
var F = [
  ['df-01', 'collected', 'Name, email, postal address and date of birth', 'd_profile', ['full_name', 'email', 'address', 'dob'], ['i_email', 'i_customer'], 'Typed by her at sign-up and in account settings.', [], null],
  ['df-02', 'collected', 'Phone number, given for two-factor sign-in', 'd_phone2fa', ['phone'], ['i_customer', 'i_phone'], 'Entered by her when she turned on two-factor sign-in.', [], null],
  ['df-03', 'collected', 'Payment card, kept as a token', 'd_txn', ['payment_token'], ['i_customer', 'i_token'], 'Entered by her at checkout; the card number goes to the payment processor and only a token comes back.', [], 'v_vaultline'],
  ['df-04', 'collected', 'Cycle days, symptoms and private notes she logs in Pulse', 'd_pulsecycle', ['cycle_day', 'symptoms', 'notes'], ['i_pulse'], 'Logged by her in the Pulse app after explicit health consent.', [], null],
  ['df-05', 'collected', 'What she asked the assistant, word for word', 'd_prompts', ['prompt_text'], ['i_customer', 'i_convo'], 'Typed by her into Nova, then logged beside her user ID.', ['ttl'], null],
  ['df-06', 'collected', 'Her support conversation, verbatim', 'd_transcripts', ['transcript'], ['i_email', 'i_customer'], 'Written by her in a support chat.', [], null],
  ['df-07', 'observed', 'Every purchase, with amount, shop and time', 'd_txn', ['amount', 'merchant_id', 'ts'], ['i_customer'], 'Recorded by the payment system at every order.', ['minimise'], 's_payment'],
  ['df-08', 'observed', 'Where she stood at each purchase, to the metre', 'd_purchase', ['precise_lat', 'precise_lon'], ['i_customer', 'i_device'], 'Attached by the app to each purchase event.', ['minimise'], 's_checkout'],
  ['df-09', 'observed', 'Her movement history', 'd_lochist', ['lat', 'lon', 'ts'], ['i_customer'], 'Sampled by the app while location is on.', ['ttl'], 's_location'],
  ['df-10', 'observed', 'Which Pulse screens she opens (cycle, symptoms)', 'd_pulseinstall', ['app_screen'], ['i_device', 'i_maid'], 'Sent by the Pulse SDK in install telemetry, beside her advertising ID.', ['scoped'], 's_pulsesdk'],
  ['df-11', 'observed', 'What she searched for in the Storefront, and what she clicked', 'd_search', ['query_text', 'clicked_sku'], ['i_customer'], 'Recorded by Storefront search.', [], 's_search'],
  ['df-12', 'observed', 'When she reset her password, with her email in the request', 'd_applogs', ['email_in_query', 'request_url'], ['i_email'], 'Written into gateway logs from the request URL.', ['ttl'], 's_gateway'],
  ['df-13', 'observed', 'Her IP address and device at each order', 'd_txn', ['ip_address', 'device_id'], ['i_customer', 'i_device'], 'Recorded by the payment system at every order.', [], 's_payment'],
  ['df-14', 'derived', 'Purchase velocity and account age', 'd_fraudfeat', ['velocity_24h', 'account_age_days'], ['i_customer', 'i_device'], 'Computed from her orders by the Fraud Service.', [], 's_fraudsvc'],
  ['df-15', 'derived', 'Weekly resting heart rate', 'd_heart', ['weekly_rhr'], ['i_pulse'], 'Computed from her wearable readings.', [], 's_pulseapi'],
  ['df-16', 'derived', 'Age band', 'd_orders_wh', ['age_band'], ['i_customer'], 'Computed in the warehouse from her date of birth.', ['minimise'], 's_wh'],
  ['df-17', 'derived', 'Hashed email, used as an advertising match key', 'd_audience', ['hashed_email'], ['i_email', 'i_hemail'], 'A SHA-256 of her email: any partner holding her email computes the same hash.', ['purpose'], 's_capi'],
  ['df-18', 'derived', 'Her advertising ID, linked to her account across apps', 'd_identity_graph', ['maid', 'match_confidence'], ['i_customer', 'i_maid'], 'Matched probabilistically (IP and time) by the identity-resolution job.', ['scoped'], 's_idres'],
  ['df-19', 'inferred', 'Where she lives and works', 'd_lochist', ['home_cluster', 'work_cluster'], ['i_customer'], 'Clustered from her movement history.', ['ttl'], 's_lochist'],
  ['df-20', 'inferred', '“Likely a parent”, from her basket', 'd_orders_wh', ['likely_parent'], ['i_customer'], 'Predicted from what she buys.', ['purpose'], 's_wh'],
  ['df-21', 'inferred', 'Fraud risk band, copied into her ad profile', 'd_audience', ['fraud_score_band'], ['i_customer', 'i_device', 'i_fp'], 'Scored by the fraud model, then copied into advertising audiences.', ['purpose', 'scoped'], 'mdl_fraud'],
  ['df-22', 'inferred', '“Health interest” advertising segment', 'd_audience', ['interest_health'], ['i_device', 'i_maid'], 'Inferred from Pulse screens joined to her advertising ID.', ['scoped', 'purpose'], 'mdl_lookalike'],
  ['df-23', 'inferred', 'Health topics she mentioned to the assistant', 'd_prompts', ['health_mentions'], ['i_customer'], 'Tagged automatically in the prompt logs.', ['ttl', 'purpose'], 's_novalogs'],
  ['df-24', 'inferred', 'Pregnancy flag', 'd_pulsecycle', ['pregnancy_flag'], ['i_pulse'], 'Predicted from her cycle logs.', [], 'mdl_pulse'],
  ['df-25', 'inferred', 'Mood of her support conversation', 'd_transcripts', ['sentiment'], ['i_email'], 'Scored by the support summariser.', [], 'mdl_summarise'],
  ['df-26', 'external', 'IP risk score from a fraud-intelligence vendor', 'd_fraudfeat', ['ip_risk'], ['i_customer', 'i_ip'], 'Returned by the fraud-intelligence vendor when her order is screened.', [], 'v_signalrisk'],
  ['df-27', 'external', 'Documents her employer shared into her Nova workspace', 'd_novavec', ['chunk_text', 'chunk_embedding'], ['i_customer'], 'Uploaded by her employer’s workspace admin, not by her.', [], null, 'Her employer’s Nova workspace'],
  ['df-28', 'external', 'Loyalty ID, printed on receipts and used at partner stores', 'd_profile', ['loyalty_id'], ['i_customer', 'i_loyalty'], 'Shared with partner stores, which report purchases back under it.', [], null, 'Partner stores']
];
NS.personProfile = {
  person: 'u_dana',
  facts: F.map(function (x) { return { id: x[0], origin: x[1], a: x[2], ds: x[3], fields: x[4], path: x[5], how: x[6], levers: x[7], by: x[8], src: x[9] || null }; }),
  /* The systems Northstar's access-request (DSAR) export actually reads. */
  accessExport: { job: 'DSAR export job v3', systems: ['s_profile', 's_txn', 's_supportsvc', 's_search', 's_pulsedb', 's_lochist'] }
};

/* [condition, integration kind, control that proves it (or null), the concrete check] */
function C(text, kind, control, check) { return { text: text, kind: kind, control: control, check: check }; }
var PR = 'Pull request check', GATE = 'Deployment gate', TEST = 'Control test', SIGN = 'Manual sign-off';
NS.reviewDetails = {
  'RV-311': { requester: 't_nova', summary: 'Nova remembers a user’s preferences across conversations.', signedOff: null, conditions: [
    C('Retention declared and enforced: memories expire after twelve months', GATE, 'c_launch_gate', 'launch-gate: retention_declared(assistant_memories)'),
    C('A user-visible delete that reaches the memory store, proven by canary', TEST, 'c_delete_verify', 'canary: memory row absent at T+72h'),
    C('Health and other special categories excluded before storage', TEST, 'c_prompt_redact', 'eval: special-category exclusion set'),
    C('AI privacy review completed for the Memory Extractor', SIGN, 'c_ai_review', 'AI review ticket for mdl_memory')] },
  'RV-318': { requester: 't_storefront', summary: 'Remind a customer when a consumable is likely to run out.', signedOff: null, conditions: [
    C('Sensitive product categories excluded from the training data', PR, 'c_lint_pii', 'ci: sku-sensitivity-filter on the reorder repo'),
    C('Training window enforced at 180 days', TEST, 'c_retention_scan', 'scan: reorder training snapshot age'),
    C('Lock-screen notifications use generic text', SIGN, null, 'design review of notification copy')] },
  'RV-320': { requester: 't_browser', summary: 'Learn which browser-extension features are used.', signedOff: null, conditions: [
    C('No account ID or full URL on the analytics export', GATE, 'c_gate_egress', 'egress-gate: field allow-list on fl17'),
    C('Vendor retention matches the 90-day contract, attested', TEST, 'c_vendor_attest', 'attestation: Clearsight Analytics'),
    C('URL category derived on the device; no page titles leave it', PR, 'c_lint_pii', 'ci: extension telemetry schema check')] },
  'RV-322': { requester: 't_measure', summary: 'Send conversions to the advertising partner server-side.', signedOff: '2026-08-11', conditions: [
    C('Consent read at request time; cache no longer than 24 hours', TEST, 'c_consent_read', 'probe: synthetic revocation through the forwarder'),
    C('A consent-cache miss denies instead of defaulting to “granted”', GATE, 'c_launch_gate', 'launch-gate: fallback-path test present'),
    C('Hashed email treated as personal data in the partner agreement', SIGN, 'c_vendor_attest', 'AdReach agreement annex')] },
  'RV-325': { requester: 't_audience', summary: 'Build lookalike audiences from converting customers.', signedOff: '2026-05-30', conditions: [
    C('Only people with advertising consent in the training set', TEST, 'c_consent_batch', 'reconciliation: training set against the consent store'),
    C('No fraud or health signals used as features', TEST, 'c_purpose_fs', 'feature-store read log'),
    C('Opt-outs reach the advertising partner within 24 hours', TEST, 'c_consent_batch', 'AdReach acknowledgement feed')] },
  'RV-327': { requester: 't_location', summary: 'Suggest the nearest pickup point at checkout.', signedOff: '2025-09-15', conditions: [
    C('Location kept 30 days, machine-enforced', TEST, 'c_retention_scan', 'scan: oldest row in customer_location_history'),
    C('No advertising reads of location', TEST, 'c_purpose_runtime', 'policy engine deny log'),
    C('New precise-location fields need privacy approval', GATE, 'c_schema', 'schema registry tier gate')] },
  'RV-330': { requester: 't_pulse', summary: 'Predict a user’s next cycle for them, privately.', signedOff: '2026-09-08', conditions: [
    C('Per-user keys; deletion by crypto-shredding', TEST, 'c_cryptoshred', 'quarterly restore test'),
    C('The Pulse ID never joins an advertising ID', TEST, 'c_id_scope', 'identity-graph edge scan'),
    C('Health reads carry the service-delivery purpose', TEST, 'c_purpose_runtime', 'policy engine deny log')] },
  'RV-331': { requester: 't_msg', summary: 'Fetch previews for links shared in chats.', signedOff: null, conditions: [
    C('Fetch logs kept 14 days', TEST, 'c_retention_scan', 'scan: link_preview_fetch_logs'),
    C('Fetch from the sender’s region', GATE, 'c_gate_egress', 'region pinning check')] },
  'RV-333': { requester: 't_nova', summary: 'Answer questions from a workspace’s own documents.', signedOff: '2026-08-26', conditions: [
    C('Chunks deleted when the source document is deleted', TEST, 'c_delete_verify', 'canary document deletion'),
    C('Prompts redacted before the model provider', TEST, 'c_prompt_redact', 'NER evaluation set'),
    C('The model provider does not train on inputs', SIGN, 'c_vendor_attest', 'no-training clause, attested')] },
  'RV-334': { requester: 't_support', summary: 'Support chat, with AI summaries for agents.', signedOff: null, conditions: [
    C('Transcripts processed in the customer’s region', GATE, 'c_gate_egress', 'egress-gate: transcript flows'),
    C('Every subprocessor reviewed before data flows to it', SIGN, 'c_vendor_attest', 'subprocessor list attestation')] },
  'RV-335': { requester: 't_storefront', summary: 'Rank search results by what a customer bought before.', signedOff: '2026-09-16', conditions: [
    C('Personalisation consent checked at read', TEST, 'c_consent_read', 'probe: synthetic revocation'),
    C('Deletion reaches the search index', TEST, 'c_delete_verify', 'canary query after deletion')] },
  'RV-336': { requester: 't_pay', summary: 'Let customers pay each other.', signedOff: null, conditions: [
    C('No payment memo text in logs', PR, 'c_lint_pii', 'ci: pii-lint'),
    C('Card data tokenised', TEST, 'c_tokenise', 'quarterly card-number scan')] },
  'RV-337': { requester: 't_storefront', summary: 'Household accounts that include children.', signedOff: null, conditions: [
    C('Children’s data in a separate store with no advertising identifiers', TEST, 'c_children', 'advertising-ID absence check'),
    C('No advertising tags on family pages', TEST, 'c_cmp', 'weekly tag crawl'),
    C('Verifiable parental consent before any collection', SIGN, null, 'consent-flow review')] },
  'RV-338': { requester: 't_fraud', summary: 'Screen checkouts for card testing and account takeover.', signedOff: '2026-09-23', conditions: [
    C('Fraud features read only for fraud prevention', TEST, 'c_purpose_fs', 'feature-store read log'),
    C('Feature TTL of 180 days', TEST, 'c_ttl_fs', 'daily age scan'),
    C('The device fingerprint never leaves fraud prevention', TEST, 'c_id_scope', 'identity-graph edge scan')] },
  'RV-339': { requester: 't_checkout', summary: 'Buy with one tap using a saved card and address.', signedOff: null, conditions: [
    C('No personal data in gateway logs', TEST, 'c_log_redact', 'synthetic canary through every route'),
    C('PII linter on the checkout repository', PR, 'c_lint_pii', 'ci: pii-lint')] },
  'RV-340': { requester: 't_pulse', summary: 'Weekly heart-rate trends from a wearable.', signedOff: null, conditions: [
    C('Heart data crypto-shredded on delete', TEST, 'c_cryptoshred', 'restore test'),
    C('Explicit health consent checked at read', TEST, 'c_purpose_runtime', 'policy engine deny log')] }
};
})();

/* ═══════════════════════ shared model for this module ═══════════════════════ */
(function () {
'use strict';
var P = window.PCC, NS = window.NS, esc = P.esc, chip = P.chip, fmtN = P.fmtN, unk = P.unk, uniq = P.uniq;
var ENT = P.ENT;
function ent(id) { return ENT[id] ? ENT[id].obj : null; }
function typeOf(id) { return ENT[id] ? ENT[id].type : null; }
function pl(n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); }
function isOpen(f) { return P.isOpenFinding ? P.isOpenFinding(f) : ['closed', 'mitigated', 'accepted'].indexOf(f.status) < 0; }
P.pl = P.pl || pl;

/* reviews become citable records */
P.TYPE_LABEL.review = 'Review';
NS.reviews.forEach(function (r) { ENT[r.id] = { id: r.id, type: 'review', obj: r, name: r.id + ' · ' + (ENT[r.feature] ? ENT[r.feature].name : r.feature) }; });

/* ── deletion status per system or vendor ─────────────────────────────
 * NS.deletionTrace (another module's detailed trace) wins when it names the
 * target; otherwise NS.deletionTargets. Nothing known → null (UNKNOWN). */
var RANK = { failed: 4, unknown: 3, waiting: 2, verified: 1 };
function traceSteps() {
  var t = NS.deletionTrace; if (!t) return [];
  var steps = Array.isArray(t) ? t : (t.steps || t.targets || t.systems || []);
  if (!Array.isArray(steps)) return [];
  return steps.map(function (s) {
    if (Array.isArray(s)) return { id: s[0], status: s[3] || s[1], evidence: null, at: null };
    return { id: s.target || s.system || s.id || s.entity, status: String(s.status || s.result || s.state || '').toLowerCase(), evidence: s.evidence || s.proof || null, at: s.at || s.t || s.verified || null };
  }).filter(function (s) { return s.id && ENT[s.id]; }).map(function (s) {
    var st = /verif|deleted|done|confirm|pass/.test(s.status) ? 'verified' : /fail|surviv|found|resurrect/.test(s.status) ? 'failed' : /wait|pending|progress|queued/.test(s.status) ? 'waiting' : 'unknown';
    return { id: s.id, status: st, evidence: s.evidence, at: s.at, from: 'trace' };
  });
}
P.deletionStatus = function (id) {
  var tr = traceSteps().filter(function (s) { return s.id === id; });
  if (tr.length) return tr.sort(function (a, b) { return RANK[b.status] - RANK[a.status]; })[0];
  var rows = NS.deletionTargets.filter(function (t) { return t[0] === id; });
  if (!rows.length) return null;
  var worst = rows.slice().sort(function (a, b) { return (RANK[b[3]] || 0) - (RANK[a[3]] || 0); })[0];
  return { id: id, status: worst[3], method: worst[2], label: worst[1], rows: rows.length, from: 'targets' };
};
P.deletionTraceUsed = function () { return traceSteps().length > 0; };
P.DEL_TEXT = { verified: 'deletion verified', waiting: 'waiting for confirmation', failed: 'deletion failed', unknown: 'deletion cannot be proven' };

/* ── Dana: every fact enriched from the records it names ───────────── */
var fieldTier = function (d, names) { return d.fields.filter(function (f) { return names.indexOf(f[0]) >= 0; }).reduce(function (m, f) { return Math.max(m, f[1]); }, 0); };
function carries(flow, names) { return flow.fields.some(function (x) { return /^all |snapshot/.test(x) || names.some(function (n) { return x.indexOf(n) >= 0; }); }); }
var DANA = null;
P.dana = function () {
  if (DANA) return DANA;
  var prof = NS.personProfile, person = NS.person;
  var facts = prof.facts.map(function (f) {
    var d = ent(f.ds), sys = d ? d.system : null;
    var out = d ? P.flowsFrom(sys).filter(function (fl) { return carries(fl, f.fields); }) : [];
    var extra = uniq(out.map(function (fl) { return fl.purpose; }).filter(function (p) { return d && d.purposes.indexOf(p) < 0 && p !== 'unknown'; }));
    var unknownUse = out.filter(function (fl) { return fl.purpose === 'unknown'; }).map(function (fl) { return fl.id; });
    var inExport = prof.accessExport.systems.indexOf(sys) >= 0;
    return { f: f, d: d, sys: sys, tier: d ? fieldTier(d, f.fields) : null, flows: out, alsoFor: extra, unknownUse: unknownUse,
      promises: d ? P.promisesFor(f.ds) : [], access: inExport, del: sys ? P.deletionStatus(sys) : null,
      missingFields: d ? f.fields.filter(function (n) { return !d.fields.some(function (x) { return x[0] === n; }); }) : f.fields };
  });
  /* JOIN: identifier joins reachable from her identifiers; which exist only through unsanctioned ones */
  var real = NS.idJoins.filter(function (j) { return j[2]; });
  function reach(onlyOk) {
    var seen = {}; person.identifiers.forEach(function (i) { seen[i] = 1; });
    for (var k = 0; k < 8; k++) real.forEach(function (j) { if (onlyOk && !j[4]) return; if (seen[j[0]] && !seen[j[1]]) seen[j[1]] = 1; else if (seen[j[1]] && !seen[j[0]]) seen[j[0]] = 1; });
    return Object.keys(seen);
  }
  var all = reach(false), ok = reach(true);
  var joins = real.filter(function (j) { return all.indexOf(j[0]) >= 0 && all.indexOf(j[1]) >= 0; });
  var onlyBad = all.filter(function (i) { return ok.indexOf(i) < 0; });
  facts.forEach(function (x) { x.viaUnsanctioned = x.f.path.filter(function (i) { return onlyBad.indexOf(i) >= 0; }); });
  /* systems that hold her data, their parents, then every flow onward */
  var seeds = uniq(facts.map(function (x) { return x.sys; }).concat(facts.map(function (x) { var s = ent(x.sys); return s && s.parent; })).concat(['n_app', 'n_web']).filter(Boolean));
  var reached = seeds.slice(), used = [];
  for (var k = 0; k < 8; k++) NS.flows.forEach(function (fl) { if (reached.indexOf(fl.from) >= 0 && used.indexOf(fl.id) < 0) { used.push(fl.id); if (reached.indexOf(fl.to) < 0) reached.push(fl.to); } });
  var dsIds = uniq(facts.map(function (x) { return x.f.ds; }));
  var models = NS.models.filter(function (m) { return m.training.some(function (t) { return dsIds.indexOf(t) >= 0; }) || facts.some(function (x) { return x.f.by === m.id; }) || reached.indexOf(m.id) >= 0; });
  var ext = {};
  used.forEach(function (fid) { var fl = ent(fid), t = typeOf(fl.to); if (t === 'vendor' || t === 'subprocessor') (ext[fl.to] = ext[fl.to] || { id: fl.to, flows: [], via: [] }).flows.push(fid); });
  models.forEach(function (m) { (m.thirdParty || []).forEach(function (v) { if (typeOf(v) === 'vendor' || typeOf(v) === 'subprocessor') (ext[v] = ext[v] || { id: v, flows: [], via: [] }).via.push(m.id); }); });
  var recipients = Object.keys(ext).map(function (k) { return ext[k]; });
  var holders = uniq(facts.map(function (x) { return x.sys; }).filter(Boolean)).concat(recipients.map(function (r) { return r.id; }));
  DANA = { person: person, facts: facts, joins: joins, onlyBad: onlyBad, idsReached: all, systems: uniq(facts.map(function (x) { return x.sys; }).filter(Boolean)),
    reached: reached, flowsUsed: used, models: models, recipients: recipients, holders: holders, datasets: dsIds };
  return DANA;
};
P.danaReset = function () { DANA = null; };

/* ── review scope, conditions and re-review ──────────────────────────── */
P.REVIEW_INTERVAL = { HIGH: 90, MEDIUM: 180, LOW: 365 };
function addDays(iso, n) { var t = new Date(iso + 'T12:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); }
P.addDays = addDays;
P.reviewScope = function (fid) {
  var sys = NS.systems.filter(function (s) { return s.feature === fid; }).map(function (s) { return s.id; });
  sys = sys.concat(NS.systems.filter(function (s) { return sys.indexOf(s.parent) >= 0; }).map(function (s) { return s.id; }));
  var ds = NS.datasets.filter(function (d) { return sys.indexOf(d.system) >= 0; });
  var dIds = ds.map(function (d) { return d.id; });
  var flows = NS.flows.filter(function (f) { return sys.indexOf(f.from) >= 0 || sys.indexOf(f.to) >= 0; });
  var models = NS.models.filter(function (m) { return m.feature === fid || sys.indexOf(m.featureStore) >= 0 || sys.indexOf(m.vector) >= 0 || m.training.some(function (t) { return dIds.indexOf(t) >= 0; }) || flows.some(function (f) { return f.from === m.id || f.to === m.id; }); });
  var vendors = uniq(flows.map(function (f) { return f.to; }).concat(flows.map(function (f) { return f.from; })).concat([].concat.apply([], models.map(function (m) { return m.thirdParty || []; }))).filter(function (x) { var t = typeOf(x); return t === 'vendor' || t === 'subprocessor'; }));
  var ids = uniq([].concat.apply([], ds.map(P.dsIds)));
  var purposes = uniq([].concat.apply([], ds.map(function (d) { return d.purposes; })).concat(flows.map(function (f) { return f.purpose; })).concat(models.map(function (m) { return m.purpose; })).filter(function (p) { return ENT[p]; }));
  var all = [fid].concat(sys, dIds, flows.map(function (f) { return f.id; }), models.map(function (m) { return m.id; }), vendors, ids);
  var finds = NS.findings.filter(function (f) { return f.entities.some(function (e) { return all.indexOf(e) >= 0 && typeOf(e) !== 'identifier'; }); });
  var promises = uniq([].concat.apply(P.promisesFor(fid).map(function (p) { return p.id; }), dIds.map(function (d) { return P.promisesFor(d).map(function (p) { return p.id; }); })));
  return { sys: sys, ds: ds, flows: flows, models: models, vendors: vendors, ids: ids, purposes: purposes, all: all, finds: finds, open: finds.filter(isOpen), promises: promises };
};
P.conditionState = function (c) {
  if (!c.control) return { state: 'unknown', text: 'no automated check — a person must attest', t: null };
  var t = P.controlTest(c.control);
  if (t.result === 'never') return { state: 'unknown', text: 'the check has never run', t: t };
  if (t.result === 'fail') return { state: 'fail', text: 'failing on its last run', t: t };
  if (t.fresh.state === 'stale') return { state: 'stale', text: 'passed, but the evidence is stale', t: t };
  return { state: 'pass', text: 'passing on its last run', t: t };
};
P.reviewInfo = function (r) {
  var det = NS.reviewDetails[r.id] || null, scope = P.reviewScope(r.feature);
  var intake = addDays(NS.TODAY, -r.age);
  var conds = det ? det.conditions.map(function (c) { return { c: c, s: P.conditionState(c) }; }) : [];
  var met = conds.filter(function (x) { return x.s.state === 'pass'; }).length;
  var since = det && det.signedOff ? det.signedOff : null;
  var drift = NS.drift.filter(function (d) { return d.sev !== 'GOOD' && d.entities.some(function (e) { return scope.all.indexOf(e) >= 0; }); });
  var after = since ? drift.filter(function (d) { return d.t.slice(0, 10) > since; }) : drift.filter(function (d) { return d.t.slice(0, 10) >= intake; });
  var due = since ? addDays(since, P.REVIEW_INTERVAL[r.risk]) : null;
  var reason = !det ? 'unknown' : !since ? 'not signed off' : after.length ? 'drift' : P.daysUntil(due) < 0 ? 'expired' : 'scheduled';
  return { r: r, det: det, scope: scope, intake: intake, conds: conds, met: met, signedOff: since, changes: after, due: due, reason: reason,
    blockers: P.reviewBlockers ? P.reviewBlockers(r.feature) : scope.open.filter(function (f) { return f.sev === 'HIGH' || f.status === 'blocking launch'; }) };
};
P.rereviewHTML = function (x) {
  if (x.reason === 'unknown') return unk('no review record — re-review date unknown');
  if (x.reason === 'not signed off') return '<span class="dim">Set at sign-off: ' + P.REVIEW_INTERVAL[x.r.risk] + ' days later (' + esc(x.r.risk) + ' risk)</span>';
  var d = '<b>' + esc(P.hdate(x.due)) + '</b> <span class="dim">(' + esc(P.rel(x.due)) + ')</span>';
  if (x.reason === 'drift') return '<span class="bad">Due now</span> — ' + pl(x.changes.length, 'change') + ' since sign-off <span class="dim">(scheduled ' + esc(P.hdate(x.due)) + ')</span>';
  if (x.reason === 'expired') return '<span class="bad">Expired</span> ' + d;
  return d;
};

/* ── passports for the records this module adds ─────────────────────── */
function head(type, title, sub) { return '<p class="pp-type">' + esc(type) + '</p><h2 class="pp-title">' + esc(title) + '</h2>' + (sub ? '<p class="muted small" style="margin:0">' + sub + '</p>' : ''); }
P.passports.person = function (o) {
  var D = P.dana();
  return head('Person · fictional', o.name, esc(o.note)) +
    P.kv([['Customer since', esc(P.hdate(o.since))], ['Uses', P.chips(o.products)], ['Starting identifiers', P.chips(o.identifiers)],
      ['What Northstar holds', pl(D.facts.length, 'fact') + ' in ' + pl(D.datasets.length, 'dataset') + ', across ' + pl(D.systems.length, 'system')], ['Recipients outside Northstar', P.chips(D.recipients.map(function (r) { return r.id; }))]]) +
    '<div class="btn-row" style="margin-top:12px"><a class="btn primary" href="#/explore/person">Open One Person</a><a class="btn" href="#/privacy/rights">Rights requests</a><a class="btn" href="#/privacy/deletion">Deletion</a></div>';
};
P.passports.review = function (r) {
  var x = P.reviewInfo(r);
  return head('Privacy review · ' + r.id, P.name(r.feature), esc(r.stage) + ' · ' + esc(r.risk) + ' risk') +
    P.kv([['Reviewer', r.reviewer ? esc(r.reviewer) : unk('no reviewer')], ['Opened', esc(P.hdate(x.intake))], ['Signed off', x.signedOff ? esc(P.hdate(x.signedOff)) : '<span class="dim">not yet</span>'],
      ['Launch conditions', x.det ? x.met + ' of ' + x.conds.length + ' passing' : unk('none recorded')], ['Re-review', P.rereviewHTML(x)]]) +
    '<div class="btn-row" style="margin-top:12px"><a class="btn primary" href="#/privacy/reviews/' + esc(r.feature) + '">Open the review workbench</a></div>';
};
})();

/* ═══════════════════════ ONE PERSON ═══════════════════════ */
(function () {
'use strict';
var P = window.PCC, NS = window.NS, esc = P.esc, chip = P.chip, fmtN = P.fmtN, unk = P.unk, uniq = P.uniq, pl = P.pl;
var V = P.views;
P.ORIGINS = [
  ['collected', 'Collected', 'She gave it to Northstar: typed it, logged it or chose it.'],
  ['observed', 'Observed', 'Recorded from what she does: orders, places, screens, requests.'],
  ['derived', 'Derived', 'Computed from her data by a rule: counts, bands, hashes, links.'],
  ['inferred', 'Inferred', 'Predicted about her by a model or a heuristic. She never said it, and it may be wrong.'],
  ['external', 'Obtained externally', 'Came from someone other than her: a vendor, a partner or her employer.']
];
var OL = {}; P.ORIGINS.forEach(function (o) { OL[o[0]] = o[1]; });
P.personLevers = P.personLevers || {};

function kept(d) {
  var r = d.retention;
  if (r.actual == null) return unk('how long it is kept is unknown');
  var a = r.actual === 0 ? esc(r.note || 'lifetime of source') : esc(P.fmtDays(r.actual));
  var over = r.required > 0 && r.actual > r.required;
  return (over ? '<span class="bad">' + a + '</span> against a need of ' + esc(P.fmtDays(r.required)) : a + (r.required == null ? ' · ' + unk('need not declared') : '')) + (r.ttl ? ' · enforced TTL' : ' · <span class="bad">no TTL</span>');
}
function whoSees(x) {
  var d = x.d;
  var ppl = d.accessPeople == null ? unk('who can read it is unknown') : pl(d.accessPeople, 'person', 'people') + (d.accessServices != null ? ' · ' + pl(d.accessServices, 'service') : '');
  var rec = x.flows.map(function (fl) { return chip(fl.id, '→ ' + P.shortName(fl.to)); }).join(' ');
  return ppl + (rec ? '<div class="pf-sub">Flows onward: ' + rec + '</div>' : '');
}
function purposeHTML(x) {
  var d = x.d;
  var dec = d.purposes.length ? d.purposes.map(function (p) { return chip(p); }).join(' ') : unk('no declared purpose');
  var also = x.alsoFor.length ? '<div class="pf-sub bad">Also used for ' + x.alsoFor.map(function (p) { return chip(p); }).join(' ') + '</div>' : '';
  var u = x.unknownUse.length ? '<div class="pf-sub">' + unk('used for an unknown purpose') + ' via ' + x.unknownUse.map(function (i) { return chip(i); }).join(' ') + '</div>' : '';
  return dec + also + u;
}
function promiseHTML(x) {
  if (!x.promises.length) return unk('no published promise covers it');
  return x.promises.map(function (p) { return chip(p.id, p.id) + ' ' + P.statusTag(P.promiseState(p).status); }).join(' ');
}
function rightsHTML(x) {
  var acc = x.access ? '<span class="ok">returned</span> by an access request' : '<span class="bad">not returned</span> by an access request';
  var del = x.del ? '<span class="' + (x.del.status === 'verified' ? 'ok' : x.del.status === 'waiting' ? 'warn' : 'bad') + '">' + esc(P.DEL_TEXT[x.del.status] || x.del.status) + '</span>' + (x.del.method ? ' <span class="dim">(' + esc(x.del.method) + ')</span>' : '')
    : unk('not wired to deletion');
  return acc + '<div class="pf-sub">Delete: ' + del + '</div>';
}
function sourceHTML(x) {
  var f = x.f;
  var by = f.by ? chip(f.by) : f.src ? '<span class="tag">' + esc(f.src) + '</span>' : '';
  return chip(f.ds) + ' in ' + chip(x.sys) + '<div class="pf-sub mono">' + f.fields.map(esc).join(', ') + '</div>' + (by ? '<div class="pf-sub">' + (f.origin === 'external' ? 'From ' : 'Produced by ') + by + '</div>' : '');
}
function factHTML(x) {
  var f = x.f, blocked = f.levers.filter(function (l) { return P.personLevers[l]; });
  var flag = x.d.retention.required > 0 && x.d.retention.actual > x.d.retention.required ? 'kept too long' : x.alsoFor.length ? 'used for another purpose' : x.viaUnsanctioned.length ? 'joined without sanction' : !x.promises.length ? 'no promise' : '';
  return '<details class="pf-fact o-' + f.origin + (blocked.length ? ' gone' : '') + '" id="' + esc(f.id) + '" data-origin="' + f.origin + '" data-levers="' + esc(f.levers.join(' ')) + '">' +
    '<summary><span class="pf-o o-' + f.origin + '">' + esc(OL[f.origin]) + '</span><span class="pf-a">' + esc(f.a) + '</span> ' + P.tier(x.tier) +
      (flag ? ' <span class="pf-flag">' + esc(flag) + '</span>' : '') + '<span class="pf-gone" aria-hidden="' + (blocked.length ? 'false' : 'true') + '">' + (blocked.length ? 'removed by ' + esc(blocked.map(leverName).join(', ')) : '') + '</span></summary>' +
    '<dl class="pf-dl">' +
      '<div><dt>Source · dataset and system</dt><dd>' + sourceHTML(x) + '</dd></div>' +
      '<div><dt>How it got here</dt><dd>' + esc(f.how) + '</dd></div>' +
      '<div><dt>Purpose</dt><dd>' + purposeHTML(x) + '</dd></div>' +
      '<div><dt>Kept</dt><dd>' + kept(x.d) + '</dd></div>' +
      '<div><dt>Who can see it</dt><dd>' + whoSees(x) + '</dd></div>' +
      '<div><dt>Promise it touches</dt><dd>' + promiseHTML(x) + '</dd></div>' +
      '<div><dt>Her rights reach it?</dt><dd>' + rightsHTML(x) + '</dd></div>' +
      '<div><dt>Joined to her through</dt><dd>' + (x.f.path.length ? x.f.path.map(function (i) { return chip(i); }).join(' → ') : '—') + (x.viaUnsanctioned.length ? '<div class="pf-sub bad">Only reachable through an unsanctioned join (' + x.viaUnsanctioned.map(P.name).map(esc).join(', ') + ')</div>' : '') + '</dd></div>' +
    '</dl>' + P.cite([f.ds, x.sys].concat(x.flows.map(function (fl) { return fl.id; }), x.promises.map(function (p) { return p.id; }), f.path, f.by ? [f.by] : []), 'Records') + '</details>';
}
function leverName(id) { var l = NS.persona.levers.filter(function (x) { return x.id === id; })[0]; return l ? l.label.toLowerCase() : id; }

function joinsTable(D) {
  return '<div class="tbl-wrap" tabindex="0" role="region" aria-label="Identifier joins reachable from Dana"><table class="tbl pf-joins"><caption class="sr-only">Identifier joins that link Dana’s records</caption><thead><tr><th scope="col">Join</th><th scope="col">Where</th><th scope="col">How</th><th scope="col">Sanctioned</th></tr></thead><tbody>' +
    D.joins.map(function (j) { return '<tr><td>' + chip(j[0]) + ' ↔ ' + chip(j[1]) + '</td><td>' + chip(j[2]) + '</td><td class="small">' + esc(j[3]) + '</td><td>' + (j[4] ? '<span class="ok">yes</span>' : '<span class="bad">no</span>') + '</td></tr>'; }).join('') + '</tbody></table></div>';
}
function modelsHTML(D) {
  return '<div class="pf-cards">' + D.models.map(function (m) {
    var her = m.training.filter(function (t) { return D.datasets.indexOf(t) >= 0; });
    return '<article class="pf-card"><h4>' + chip(m.id) + '</h4><p class="small">Predicts for ' + chip(m.purpose) + ' · ' + esc(m.hosting.toLowerCase()) + '</p>' +
      P.kv([['Trained on her data', her.length ? her.map(function (d) { return chip(d); }).join(' ') : '<span class="dim">no — scores her at run time</span>'],
        ['Trains on what she types', m.trainsOnUserInput == null ? unk('unknown') : m.trainsOnUserInput ? '<span class="bad">yes</span>' : 'no'],
        ['Removing her from it', /unknown|none/.test(m.deletionPath) ? unk(m.deletionPath) : esc(m.deletionPath)],
        ['Provenance', m.provenance === 'documented' ? 'documented' : unk(m.provenance)]]) + '</article>';
  }).join('') + '</div>';
}
function recipientsHTML(D) {
  return '<div class="tbl-wrap" tabindex="0" role="region" aria-label="Recipients outside Northstar"><table class="tbl pf-rec"><caption class="sr-only">Who outside Northstar receives Dana’s data</caption><thead><tr><th scope="col">Recipient</th><th scope="col">What they get</th><th scope="col">Her opt-out reaches them</th><th scope="col">Deletion</th><th scope="col">Kept</th></tr></thead><tbody>' +
    D.recipients.map(function (r) {
      var v = P.get(r.id).obj, isV = P.get(r.id).type === 'vendor';
      var fields = uniq([].concat.apply([], r.flows.map(function (f) { return P.get(f).obj.fields; })));
      var del = P.deletionStatus(r.id);
      return '<tr><td>' + chip(r.id) + (isV && !v.declared ? ' <span class="tag sev-HIGH">undeclared</span>' : '') + '</td>' +
        '<td class="small">' + (fields.length ? esc(fields.join(', ')) : 'via ' + r.via.map(P.name).map(esc).join(', ')) + '<div>' + r.flows.map(function (f) { return chip(f); }).join(' ') + r.via.map(function (m) { return chip(m); }).join(' ') + '</div></td>' +
        '<td>' + (!isV ? unk('unknown') : v.consentDep == null ? '<span class="dim">no consent dependency</span>' : v.optOutPropagates ? '<span class="ok">yes</span>' : '<span class="bad">no</span>') + '</td>' +
        '<td>' + (del ? '<span class="' + (del.status === 'verified' ? 'ok' : del.status === 'waiting' ? 'warn' : 'bad') + '">' + esc(P.DEL_TEXT[del.status]) + '</span>' : isV && !v.deletionApi ? '<span class="bad">no deletion mechanism</span>' : unk('not wired to deletion')) + '</td>' +
        '<td class="small">' + (!isV ? unk('unknown') : v.retention.actual == null ? unk('unknown') : P.fmtDays(v.retention.actual) === 'lifetime of source' ? 'while hosted' : esc(P.fmtDays(v.retention.actual)) + (v.retention.contract != null && v.retention.actual > v.retention.contract ? ' <span class="bad">(contract ' + esc(P.fmtDays(v.retention.contract)) + ')</span>' : '')) + '</td></tr>';
    }).join('') + '</tbody></table></div>';
}
function rightsReach(D) {
  var sys = D.systems;
  var acc = sys.filter(function (s) { return NS.personProfile.accessExport.systems.indexOf(s) >= 0; });
  var byDel = { verified: [], waiting: [], failed: [], unknown: [], none: [] };
  D.holders.forEach(function (h) { var s = P.deletionStatus(h); byDel[s ? s.status : 'none'].push(h); });
  var tests = ['c_delete_orch', 'c_delete_verify', 'c_backup_reapply', 'c_vendor_attest'].map(P.controlTest);
  return '<div class="pf-rights">' +
    '<div class="pf-card"><h4>Access request</h4><p><b>' + acc.length + ' of ' + sys.length + '</b> systems holding her data are read by the ' + esc(NS.personProfile.accessExport.job) + '.</p>' +
      '<p class="small">Returned: ' + acc.map(function (s) { return chip(s); }).join(' ') + '</p><p class="small">Not returned: ' + sys.filter(function (s) { return acc.indexOf(s) < 0; }).map(function (s) { return chip(s); }).join(' ') + '</p>' +
      '<a class="btn" href="#/privacy/rights">Individual rights →</a></div>' +
    '<div class="pf-card"><h4>Deletion request</h4><p><b>' + byDel.verified.length + ' of ' + D.holders.length + '</b> places holding her data can prove deletion.</p>' +
      ['failed', 'waiting', 'unknown', 'none'].filter(function (k) { return byDel[k].length; }).map(function (k) { return '<p class="small"><span class="' + (k === 'waiting' ? 'warn' : k === 'failed' ? 'bad' : 'unknown') + '">' + esc(k === 'none' ? 'not wired to deletion at all' : P.DEL_TEXT[k]) + '</span>: ' + byDel[k].map(function (s) { return chip(s); }).join(' ') + '</p>'; }).join('') +
      '<p class="small">Evidence: ' + tests.map(function (t) { return chip(t.control.id) + ' <span class="ev-r ev-' + t.result + '">' + (t.result === 'never' ? 'never tested' : t.result) + '</span> ' + P.freshTag(t.last); }).join(' · ') + '</p>' +
      '<a class="btn" href="#/privacy/deletion">Deletion →</a></div></div>';
}

V['explore/person'] = { title: 'One Person', render: function () {
  var D = P.dana(), person = D.person;
  P.pushTrail(person.id);
  var by = function (o) { return D.facts.filter(function (x) { return x.f.origin === o; }); };
  var unkn = NS.persona.facts.filter(function (f) { return f.kind === 'UNKNOWABLE'; });
  var bad = D.joins.filter(function (j) { return !j[4]; });
  var provable = D.holders.filter(function (h) { var s = P.deletionStatus(h); return s && s.status === 'verified'; });
  var sec = function (id, n, verb, q, body, lede) { return '<section class="pf-sec" aria-labelledby="' + id + '"><h2 id="' + id + '" class="hm-h"><span>' + n + '</span>' + esc(verb) + ' <small>' + esc(q) + '</small></h2>' + (lede ? '<p class="pf-lede">' + lede + '</p>' : '') + body + '</section>'; };
  var list = function (xs) { return '<div class="pf-facts">' + xs.map(factHTML).join('') + '</div>'; };
  var allCite = [person.id].concat(D.datasets, D.systems, D.recipients.map(function (r) { return r.id; }), D.models.map(function (m) { return m.id; }));
  return P.pageHead('Investigate · one person', 'What Northstar can know about Dana', 'Dana is fictional. Starting from ' + esc(person.identifiers.map(function (i) { return P.name(i).toLowerCase(); }).join(' and ')) + ', this page follows every dataset, join, model and recipient that reaches her, and says where each fact came from: <b>given by her</b>, <b>observed</b>, <b>derived</b>, <b>inferred</b> or <b>obtained from someone else</b>.') +
    '<div class="pf-who"><div><p class="pf-name">' + esc(person.name) + ' <span class="tag">fictional</span></p><p class="small muted">' + esc(person.note) + ' Customer since ' + esc(P.hdate(person.since)) + '.</p></div>' +
      '<div class="small"><span class="dim">Uses</span> ' + person.products.map(function (p) { return chip(p); }).join(' ') + '</div><div class="small"><span class="dim">Starts from</span> ' + person.identifiers.map(function (i) { return chip(i); }).join(' ') + '</div></div>' +
    '<div class="pf-origins" role="list" aria-label="Facts by origin">' + P.ORIGINS.map(function (o) {
      var xs = by(o[0]);
      return '<div class="pf-ocol o-' + o[0] + '" role="listitem"><h3><span class="pf-o o-' + o[0] + '">' + esc(o[1]) + '</span> <b data-count="' + o[0] + '">' + xs.length + '</b></h3><p class="small dim">' + esc(o[2]) + '</p><ul>' +
        xs.map(function (x) { return '<li data-levers="' + esc(x.f.levers.join(' ')) + '"><button class="linklike" data-act="toFact" data-id="' + esc(x.f.id) + '">' + esc(x.f.a) + '</button></li>'; }).join('') + '</ul></div>';
    }).join('') + '</div>' +
    '<p class="pf-sum" id="pfSum">' + sumLine(D) + '</p>' +
    '<div class="pf-levers" role="group" aria-labelledby="pfLevH"><h2 id="pfLevH" class="pf-h3">Architecture levers — what would shrink this profile</h2><div class="pf-lev">' + NS.persona.levers.map(function (l) {
      var n = D.facts.filter(function (x) { return x.f.levers.indexOf(l.id) >= 0; }).length;
      return '<label class="lever' + (P.personLevers[l.id] ? ' on' : '') + '"><input type="checkbox" data-lever="' + esc(l.id) + '"' + (P.personLevers[l.id] ? ' checked' : '') + '><span><b>' + esc(l.label) + '</b><br><span class="small muted">' + esc(l.note) + ' · removes ' + pl(n, 'fact') + '</span></span></label>';
    }).join('') + '</div></div>' +
    '<nav class="hm-jump pf-jump" aria-label="Five questions about Dana"><a href="#pfKnow" data-act="toSec">1 · Know</a><a href="#pfInfer" data-act="toSec">2 · Infer</a><a href="#pfJoin" data-act="toSec">3 · Join</a><a href="#pfPredict" data-act="toSec">4 · Predict</a><a href="#pfDisclose" data-act="toSec">5 · Disclose</a><a href="#pfRights" data-act="toSec">Her rights</a></nav>' +
    sec('pfKnow', 1, 'Know', 'what she gave, what was observed, what came from others', list(by('collected').concat(by('observed'), by('external'))), 'Open any fact for its dataset and system, purpose, retention, who can see it, the promise it touches, and whether her rights reach it.') +
    sec('pfInfer', 2, 'Infer', 'what was computed or predicted about her', list(by('derived').concat(by('inferred'))), 'Derived facts follow a rule; inferred facts are guesses. Both are personal data about her.') +
    sec('pfJoin', 3, 'Join', 'the identifier links that make one profile out of many records',
      joinsTable(D) + '<p class="small" style="margin-top:8px">' + pl(bad.length, 'join') + ' of ' + D.joins.length + ' were never sanctioned. ' + (D.onlyBad.length ? 'Without them, Northstar could not reach ' + D.onlyBad.map(function (i) { return chip(i); }).join(' ') + ' — and the ' + pl(D.facts.filter(function (x) { return x.viaUnsanctioned.length; }).length, 'fact') + ' that hang off them.' : '') + '</p>' + P.cite(D.joins.map(function (j) { return j[2]; }).concat(D.idsReached), 'Records')) +
    sec('pfPredict', 4, 'Predict', 'the models that score or learn from her', modelsHTML(D) + P.cite(D.models.map(function (m) { return m.id; }), 'Records')) +
    sec('pfDisclose', 5, 'Disclose', 'who outside Northstar receives her data', recipientsHTML(D) + P.cite(D.recipients.map(function (r) { return r.id; }).concat([].concat.apply([], D.recipients.map(function (r) { return r.flows; }))), 'Records'),
      'Followed from every system that holds her data, along every recorded flow, plus the providers behind the models that score her.') +
    '<section class="pf-sec" aria-labelledby="pfRights"><h2 id="pfRights" class="hm-h hm-h-sm">What her rights requests would reach</h2>' + rightsReach(D) + '</section>' +
    '<section class="pf-sec" aria-labelledby="pfUnk"><h2 id="pfUnk" class="hm-h hm-h-sm">What architecture made unknowable</h2>' + unkn.map(function (f) { return '<p class="callout">' + P.chip(f.ds) + ' <b>' + esc(f.a) + '</b> — ' + esc(f.note) + '</p>'; }).join('') + '</section>' +
    '<section class="pf-sec" aria-labelledby="pfChain"><h2 id="pfChain" class="hm-h hm-h-sm">From promise to owner</h2>' + P.chainHTML(person.id, { max: 3 }) + '</section>' +
    P.cite(allCite, 'Every record on this page');
}, mount: function (root) {
  root.querySelectorAll('[data-lever]').forEach(function (cb) { cb.addEventListener('change', function () { P.personLevers[cb.getAttribute('data-lever')] = cb.checked; cb.closest('.lever').classList.toggle('on', cb.checked); applyLevers(root); }); });
  applyLevers(root);
} };
function sumLine(D, gone) {
  gone = gone || {};
  var live = D.facts.filter(function (x) { return !gone[x.f.id]; });
  var inf = live.filter(function (x) { return x.f.origin === 'inferred' || x.f.origin === 'derived'; }).length;
  var t4 = live.filter(function (x) { return x.tier === 4; }).length;
  var removed = D.facts.length - live.length;
  return '<b>' + live.length + '</b> facts about her are held' + (removed ? ' (<span class="ok">' + removed + ' removed by the levers</span>)' : '') + '; <b>' + inf + '</b> of them were computed or guessed rather than given; <span class="bad"><b>' + t4 + '</b> are special-category</span>. ' +
    '<b>' + D.recipients.length + '</b> recipients outside Northstar receive some of it, and <b>' + D.joins.filter(function (j) { return !j[4]; }).length + '</b> unsanctioned joins hold the profile together.';
}
function applyLevers(root) {
  var D = P.dana(), gone = {};
  D.facts.forEach(function (x) { var b = x.f.levers.filter(function (l) { return P.personLevers[l]; }); if (b.length) gone[x.f.id] = b; });
  root.querySelectorAll('.pf-fact').forEach(function (el) {
    var b = gone[el.id]; el.classList.toggle('gone', !!b);
    var s = el.querySelector('.pf-gone'); s.textContent = b ? 'removed by ' + b.map(leverName).join(', ') : ''; s.setAttribute('aria-hidden', b ? 'false' : 'true');
  });
  root.querySelectorAll('.pf-ocol li').forEach(function (li) { var ls = (li.getAttribute('data-levers') || '').split(' ').filter(Boolean); li.classList.toggle('gone', ls.some(function (l) { return P.personLevers[l]; })); });
  var s = root.querySelector('#pfSum'); if (s) s.innerHTML = sumLine(D, gone);
}
P.acts.toFact = function (el) { var d = document.getElementById(el.getAttribute('data-id')); if (!d) return; d.open = true; d.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); var s = d.querySelector('summary'); if (s) s.focus({ preventScroll: true }); P.pushTrail(d.querySelector('.cite .chip') ? d.querySelector('.cite .chip').getAttribute('data-ent') : 'u_dana'); };
P.acts.toSec = function (el) { var id = (el.getAttribute('href') || '').replace('#', ''); var s = document.getElementById(id); if (!s) return; s.scrollIntoView({ block: 'start' }); s.setAttribute('tabindex', '-1'); s.focus({ preventScroll: true }); };
})();

/* ═══════════════════════ CONTROLS & EVIDENCE ═══════════════════════ */
(function () {
'use strict';
var P = window.PCC, NS = window.NS, esc = P.esc, chip = P.chip, unk = P.unk, uniq = P.uniq, pl = P.pl;
var V = P.views;
P.LEVEL_NAME = ['Policy', 'Manual review', 'Static check', 'Deployment gate', 'Runtime enforcement', 'Continuous audit'];
var LEVEL_DESC = ['Words in a document. Nothing checks them.', 'A person reads the design or approves the request.', 'A linter or scanner flags it before merge.', 'The deploy is blocked until the check passes.', 'Enforced in production on every request.', 'Measured in production, continuously, and alerted on.'];
var RESULT_TEXT = { pass: 'Passed', fail: 'Failed', never: 'Never tested' };
var FRESH_TEXT = { fresh: 'Fresh (≤ 7 days)', aging: 'Aging (≤ 30 days)', stale: 'Stale (> 30 days)', never: 'Never tested' };
function row(c) {
  var t = P.controlTest(c.id);
  var proms = P.promisesFor(c.id);
  var finds = NS.findings.filter(function (f) { return f.entities.indexOf(c.id) >= 0 && P.isOpenFinding(f); });
  var nextOver = t.next && P.daysUntil(t.next) < 0;
  return { c: c, t: t, proms: proms, finds: finds, nextOver: nextOver };
}
P.controlRows = function () { return NS.controls.map(row); };
function filterRows(rows, q) {
  return rows.filter(function (x) {
    return (!q.d || x.c.domain === q.d) && (q.l == null || q.l === '' || String(x.c.level) === q.l) && (!q.r || x.t.result === q.r) && (!q.f || x.t.fresh.state === q.f);
  });
}
function link(q, k, v) { var o = {}; Object.keys(q).forEach(function (x) { if (q[x] !== '' && q[x] != null) o[x] = q[x]; }); if (v == null) delete o[k]; else o[k] = v; var s = Object.keys(o).map(function (x) { return x + '=' + encodeURIComponent(o[x]); }).join('&'); return 'assurance/controls' + (s ? '?' + s : ''); }
function seg(label, k, opts, q) {
  return '<div class="pf-filt"><span class="pf-fl" id="flt-' + k + '">' + esc(label) + '</span><div class="seg" role="group" aria-labelledby="flt-' + k + '"><button data-go="' + esc(link(q, k, null)) + '" aria-pressed="' + (q[k] == null || q[k] === '') + '">All</button>' +
    opts.map(function (o) { return '<button data-go="' + esc(link(q, k, o[0])) + '" aria-pressed="' + (String(q[k]) === String(o[0])) + '">' + esc(o[1]) + (o[2] != null ? ' <span class="dim">' + o[2] + '</span>' : '') + '</button>'; }).join('') + '</div></div>';
}
function ladder(rows) {
  return '<ol class="pf-ladder" aria-label="Enforcement ladder">' + P.LEVEL_NAME.map(function (n, i) {
    var here = rows.filter(function (x) { return x.c.level === i; });
    return '<li class="pf-rung r' + i + '"><div class="pf-rh"><span class="pf-rn">L' + i + '</span><b>' + esc(n) + '</b><span class="pf-rc">' + here.length + '</span></div><p class="small dim">' + esc(LEVEL_DESC[i]) + '</p>' +
      '<div class="pf-rchips">' + here.map(function (x) { return '<button class="ctl-chip pf-cc res-' + x.t.result + '" data-ent="' + esc(x.c.id) + '" aria-label="' + esc(x.c.name + ': ' + RESULT_TEXT[x.t.result] + ', ' + x.t.fresh.label) + '">' + esc(x.c.name) + '<small>' + esc(RESULT_TEXT[x.t.result].toLowerCase() + ' · ' + (x.t.fresh.state === 'never' ? 'no evidence' : x.t.fresh.state)) + '</small></button>'; }).join('') + '</div></li>';
  }).join('') + '</ol>';
}
function table(rows) {
  if (!rows.length) return '<p class="callout">No control matches these filters. <a href="#/assurance/controls">Clear the filters</a>.</p>';
  return '<div class="tbl-wrap pf-ctl-wrap" tabindex="0" role="region" aria-label="Controls with their last test and evidence"><table class="tbl pf-ctl"><caption class="sr-only">Every control: owner, scope, last test, result, evidence, freshness, exceptions, next test, promises and failed findings</caption><thead><tr>' +
    ['Control', 'Owner · scope', 'Last test', 'Result', 'Evidence', 'Freshness', 'Exceptions', 'Next test', 'Keeps promises', 'Findings it failed'].map(function (h) { return '<th scope="col">' + h + '</th>'; }).join('') + '</tr></thead><tbody>' +
    rows.map(function (x) {
      var c = x.c, t = x.t;
      return '<tr data-ctl="' + esc(c.id) + '">' +
        '<th scope="row" data-label="Control"><button class="linklike" data-ent="' + esc(c.id) + '">' + esc(c.name) + '</button><div class="small dim">' + esc(c.domain) + '</div><div>' + P.lvl(c.level) + '</div></th>' +
        '<td data-label="Owner · scope"><div>' + P.ownerHTML(c.owner) + '<div class="small dim">' + esc(c.scope || '') + '</div></div></td>' +
        '<td data-label="Last test" class="pf-last"><div>' + (t.last ? '<b>' + esc(P.hdate(t.last)) + '</b>' : unk('never tested')) + '<div class="small dim">' + esc(t.method || '') + '</div></div></td>' +
        '<td data-label="Result" class="pf-res"><div><span class="ev-r ev-' + t.result + '">' + esc(RESULT_TEXT[t.result]) + '</span></div></td>' +
        '<td data-label="Evidence" class="pf-ev small"><div>' + (t.evidence ? esc(t.evidence) : unk('no evidence')) + '</div></td>' +
        '<td data-label="Freshness" class="pf-fr"><div>' + P.freshTag(t.last, 'Last test') + '</div></td>' +
        '<td data-label="Exceptions" class="small"><div>' + (t.exceptions.length ? '<ul class="pf-exc">' + t.exceptions.map(function (e) { return '<li>' + esc(e) + '</li>'; }).join('') + '</ul>' : '<span class="dim">none recorded</span>') + '</div></td>' +
        '<td data-label="Next test" class="pf-next"><div>' + (t.next ? '<span class="' + (x.nextOver ? 'bad' : '') + '">' + esc(P.hdate(t.next)) + '</span><div class="small dim">' + esc(x.nextOver ? 'overdue · ' + P.rel(t.next) : P.rel(t.next)) + '</div>' : unk('not scheduled')) + '</div></td>' +
        '<td data-label="Keeps promises"><div>' + (x.proms.length ? x.proms.map(function (p) { return chip(p.id, p.id); }).join(' ') : '<span class="dim">none published</span>') + '</div></td>' +
        '<td data-label="Findings it failed"><div>' + (x.finds.length ? x.finds.map(function (f) { return chip(f.id, f.id); }).join(' ') : '<span class="dim">none open</span>') + '</div></td></tr>';
    }).join('') + '</tbody></table></div>';
}
function evidenceTab(rows) {
  var sorted = rows.slice().sort(function (a, b) { var o = { never: 0, stale: 1, aging: 2, fresh: 3 }; return (o[a.t.fresh.state] - o[b.t.fresh.state]) || (a.t.result === 'fail' ? -1 : 0) - (b.t.result === 'fail' ? -1 : 0); });
  var decs = P.decisionsSorted();
  return '<div class="card" style="margin-bottom:14px"><div class="card-h"><h2 class="sec">Evidence locker — what proves each control</h2><span class="sub">weakest evidence first</span></div>' +
    '<ul class="pf-evl">' + sorted.map(function (x) {
      var t = x.t;
      return '<li class="pf-evi res-' + t.result + '"><div class="pf-evh"><button class="linklike" data-ent="' + esc(x.c.id) + '">' + esc(x.c.name) + '</button> ' + P.freshTag(t.last, 'Evidence') + ' <span class="ev-r ev-' + t.result + '">' + esc(RESULT_TEXT[t.result]) + '</span></div>' +
        '<p class="small">' + (t.evidence ? esc(t.evidence) : unk('no evidence')) + ' <span class="dim">· ' + esc(t.method || 'no method') + '</span></p>' +
        (t.exceptions.length ? '<p class="small"><b>Does not prove:</b> ' + esc(t.exceptions.join('; ')) + '</p>' : '') + '</li>';
    }).join('') + '</ul></div>' +
    '<div class="card" style="margin-bottom:14px"><div class="card-h"><h2 class="sec">The tests that will prove each decision’s fix</h2></div><div class="tbl-wrap" tabindex="0" role="region" aria-label="Decision proof tests"><table class="tbl"><caption class="sr-only">Proof test per decision</caption><thead><tr><th scope="col">Decision</th><th scope="col">Proven when</th><th scope="col">Today</th><th scope="col">Evidence</th></tr></thead><tbody>' +
    decs.map(function (x) { return '<tr><td>' + chip(x.d.id, x.d.id) + '</td><td class="small">' + esc(x.d.test.text) + '<div>' + chip(x.d.test.control) + '</div></td><td><span class="ev-r ev-' + esc(x.d.testResult) + '">' + esc(x.d.testResult === 'pending' ? 'not yet proven' : x.d.testResult === 'fail' ? 'failing' : x.d.testResult === 'unknown' ? 'cannot run yet' : x.d.testResult) + '</span></td><td>' + (x.test ? P.freshTag(x.test.last, 'Last test') : unk('no control')) + '</td></tr>'; }).join('') + '</tbody></table></div></div>' +
    '<div class="card"><div class="card-h"><h2 class="sec">What produced each finding</h2><span class="sub">a finding is only as good as its detector</span></div><div class="tbl-wrap" tabindex="0" role="region" aria-label="Findings and their detectors"><table class="tbl"><caption class="sr-only">Finding detectors</caption><thead><tr><th scope="col">Finding</th><th scope="col">Detected by</th><th scope="col">Opened</th></tr></thead><tbody>' +
    NS.findings.map(function (f) { return '<tr class="click" data-ent="' + esc(f.id) + '" tabindex="0"><td><span class="mono small">' + esc(f.id) + '</span> ' + esc(f.title) + '</td><td class="mono small">' + esc(f.detector) + '</td><td class="small nowrap">' + esc(P.hdate(f.opened)) + '</td></tr>'; }).join('') + '</tbody></table></div></div>';
}
function controlsView(defTab) {
  return function (s, q) {
    q = q || {}; var tab = q.tab || defTab;
    var all = P.controlRows(), rows = filterRows(all, q);
    var cnt = function (fn) { return all.filter(fn).length; };
    var fail = cnt(function (x) { return x.t.result === 'fail'; }), never = cnt(function (x) { return x.t.result === 'never'; }), stale = cnt(function (x) { return x.t.fresh.state === 'stale'; });
    var ok = cnt(function (x) { return x.t.ok; }), over = cnt(function (x) { return x.nextOver; });
    var machine = cnt(function (x) { return x.c.level >= 2; });
    var domains = uniq(NS.controls.map(function (c) { return c.domain; })).sort();
    var tabs = '<div class="pf-tabs" role="tablist" aria-label="Controls and evidence"><a role="tab" href="#/assurance/controls" aria-selected="' + (tab !== 'evidence') + '"' + (tab !== 'evidence' ? ' aria-current="page"' : '') + '>Controls</a><a role="tab" href="#/assurance/evidence" aria-selected="' + (tab === 'evidence') + '"' + (tab === 'evidence' ? ' aria-current="page"' : '') + '>Evidence locker</a></div>';
    var head = P.pageHead('Prove', tab === 'evidence' ? 'Evidence — what proves each control works' : 'Controls & evidence',
      'A control is only as strong as its last test. Each one shows its owner, scope, the last test and its result, the evidence it produced, how fresh that evidence is, the exceptions it does not cover and when it is tested next — and the promises it keeps and findings it failed.') +
      '<p class="pf-sum"><b>' + ok + ' of ' + all.length + '</b> controls passed a test in the last 30 days. <span class="bad"><b>' + fail + '</b> failed their last test</span>, <span class="unknown"><b>' + never + '</b> have never been tested</span>, <b>' + stale + '</b> have stale evidence' + (over ? ' and <span class="bad"><b>' + over + '</b> are past their next test date</span>' : '') + '. ' + machine + ' of ' + all.length + ' are enforced by a machine (L2 or above).</p>' + tabs;
    if (tab === 'evidence') return head + evidenceTab(all) + P.cite(all.map(function (x) { return x.c.id; }), 'Controls');
    var filt = '<div class="pf-filters">' +
      seg('Domain', 'd', domains.map(function (d) { return [d, d, cnt(function (x) { return x.c.domain === d; })]; }), q) +
      seg('Level', 'l', P.LEVEL_NAME.map(function (n, i) { return [String(i), 'L' + i + ' ' + n, cnt(function (x) { return x.c.level === i; })]; }), q) +
      seg('Result', 'r', [['pass', 'Passed'], ['fail', 'Failed'], ['never', 'Never tested']].map(function (o) { return o.concat([cnt(function (x) { return x.t.result === o[0]; })]); }), q) +
      seg('Freshness', 'f', ['fresh', 'aging', 'stale', 'never'].map(function (k) { return [k, FRESH_TEXT[k], cnt(function (x) { return x.t.fresh.state === k; })]; }), q) + '</div>';
    return head +
      '<section class="pf-sec" aria-labelledby="pfLad"><h2 id="pfLad" class="pf-h3">The enforcement ladder' + (rows.length !== all.length ? ' · filtered' : '') + '</h2><p class="small muted">Policy (L0) and manual review (L1) depend on people remembering. Static checks (L2) and deployment gates (L3) prove the design was checked. Only runtime enforcement (L4) and continuous audit (L5) prove what happens in production.</p>' + ladder(rows) + '</section>' +
      '<section class="pf-sec" aria-labelledby="pfTbl"><h2 id="pfTbl" class="pf-h3">Every control, its last test and its evidence <span class="dim">· ' + rows.length + ' of ' + all.length + '</span></h2>' + filt + table(rows) + '</section>' +
      P.cite(rows.map(function (x) { return x.c.id; }), 'Controls shown');
  };
}
V['assurance/controls'] = { title: 'Controls & evidence', render: controlsView('controls') };
V['assurance/evidence'] = { title: 'Evidence', render: controlsView('evidence') };
})();

/* ═══════════════════════ PRIVACY REVIEWS ═══════════════════════ */
(function () {
'use strict';
var P = window.PCC, NS = window.NS, esc = P.esc, chip = P.chip, unk = P.unk, uniq = P.uniq, pl = P.pl;
var V = P.views;
var QS = ['VALUE', 'DATA', 'IDENTITY', 'FLOW', 'ACCESS', 'TIME', 'MISUSE', 'REDUCE'];
var QTEXT = { VALUE: 'What customer outcome needs this data?', DATA: 'Exactly which fields, at what tier?', IDENTITY: 'Can it identify or link a person?', FLOW: 'Where does it go, including logs and vendors?',
  ACCESS: 'Who and what can read it?', TIME: 'When does it disappear?', MISUSE: 'How could it be misused, or used for something else?', REDUCE: 'How can we collect, keep or share less?' };
var RF = { VALUE: '“We might need it later.”', DATA: 'Free text, full URLs, raw payloads.', IDENTITY: 'A durable ID shared across features.', FLOW: 'Unlisted SDKs, logs, exports.', ACCESS: 'Warehouse-wide read by default.', TIME: 'No TTL, or “until deleted.”', MISUSE: 'Security data readable by ads.', REDUCE: 'Controls that live only in a document.' };
var KIND_ORDER = ['Pull request check', 'Deployment gate', 'Control test', 'Manual sign-off'];
var STATE_TEXT = { pass: 'met', fail: 'not met', stale: 'unproven — stale', unknown: 'cannot be checked' };

function reviewCard(x) {
  var r = x.r, f = P.get(r.feature);
  return '<a class="pf-rv" href="#/privacy/reviews/' + esc(r.feature) + '" data-review="' + esc(r.id) + '"><span class="pf-rvh">' + P.sev(r.risk) + '<span class="mono small dim">' + esc(r.id) + '</span></span>' +
    '<b class="pf-rvt">' + esc(f ? f.name : r.feature) + '</b>' +
    '<span class="small muted">' + (r.reviewer ? esc(r.reviewer) : '<span class="unknown">no reviewer</span>') + ' · opened ' + esc(P.rel(x.intake)) + '</span>' +
    '<span class="small">' + (x.det ? '<span class="' + (x.met === x.conds.length ? 'ok' : 'bad') + '">' + x.met + ' of ' + x.conds.length + ' conditions met</span>' : unk('no conditions recorded')) + '</span>' +
    (x.blockers.length ? '<span class="small bad">' + pl(x.blockers.length, r.stage === 'POST-LAUNCH AUDIT' ? 'open post-launch blocker' : 'launch blocker') + '</span>' : '') +
    '<span class="small">Re-review: ' + P.rereviewHTML(x) + '</span>' +
    (x.scope.promises.length ? '<span class="small dim">Promises: ' + x.scope.promises.map(esc).join(', ') + '</span>' : '') + '</a>';
}
function listView() {
  var xs = NS.reviews.map(P.reviewInfo);
  var waiting = xs.filter(function (x) { return ['INTAKE', 'TRIAGE', 'DESIGN REVIEW'].indexOf(x.r.stage) >= 0; });
  var blocked = xs.filter(function (x) { return x.r.stage !== 'POST-LAUNCH AUDIT' && x.blockers.length; });
  var due = xs.filter(function (x) { return x.reason === 'drift' || x.reason === 'expired'; });
  var noRev = xs.filter(function (x) { return !x.r.reviewer; });
  var failing = xs.filter(function (x) { return x.conds.some(function (c) { return c.s.state === 'fail'; }); });
  var stats = [['Waiting for review', waiting.length, 'in intake, triage or design review'], ['Launches blocked', blocked.length, 'open HIGH or launch-blocking findings in scope', blocked.length ? 'bad' : ''],
    ['Re-review due now', due.length, 'changed since sign-off, or past the re-review date', due.length ? 'bad' : ''], ['With a failing condition', failing.length, 'a launch condition whose check failed its last run', failing.length ? 'bad' : ''], ['No reviewer', noRev.length, 'nobody is accountable for the review', noRev.length ? 'unk' : '']];
  return P.pageHead('Decide', 'Privacy reviews', 'Intake → triage → design review → build check → launch gate → post-launch audit. Every review states its scope, answers the same eight questions, lists the conditions that must hold before launch — each tied to a pull-request check, a deployment gate or a control test — and says when it must be looked at again.') +
    '<div class="stat-row card pf-stats" style="margin-bottom:14px">' + stats.map(function (s) { return '<div class="stat"><div class="sv ' + (s[3] || '') + '">' + s[1] + '</div><div class="sl">' + esc(s[0]) + '</div><div class="sr">' + esc(s[2]) + '</div></div>'; }).join('') + '</div>' +
    '<p class="small dim">Re-review rule: ' + ['HIGH', 'MEDIUM', 'LOW'].map(function (k) { return k.toLowerCase() + ' risk every ' + P.REVIEW_INTERVAL[k] + ' days'; }).join(', ') + ' after sign-off — or at once when a change touches the feature’s systems, data, flows, vendors or models.</p>' +
    '<div class="pf-stages">' + NS.reviewStages.map(function (st) {
      var rs = xs.filter(function (x) { return x.r.stage === st; });
      return '<section class="pf-stage" aria-labelledby="st-' + st.replace(/\W+/g, '') + '"><h2 class="pf-sth" id="st-' + st.replace(/\W+/g, '') + '">' + esc(st.charAt(0) + st.slice(1).toLowerCase()) + ' <span class="dim">' + rs.length + '</span></h2>' + (rs.length ? rs.map(reviewCard).join('') : '<p class="small dim">None.</p>') + '</section>';
    }).join('') + '</div>' +
    P.cite(xs.map(function (x) { return x.r.id; }).concat(xs.map(function (x) { return x.r.feature; })), 'Reviews');
}
function condTable(x) {
  if (!x.det) return '<p>' + unk('No launch conditions are recorded for this review') + '</p>';
  return '<ol class="pf-conds">' + x.conds.map(function (c) {
    var t = c.s.t;
    return '<li class="pf-cond st-' + c.s.state + '" data-state="' + c.s.state + '"><div class="pf-condh"><span class="pf-cst">' + esc(STATE_TEXT[c.s.state]) + '</span> <b>' + esc(c.c.text) + '</b></div>' +
      '<div class="pf-condb small"><span class="pf-kind">' + esc(c.c.kind) + '</span> <span class="mono">' + esc(c.c.check) + '</span>' + (c.c.control ? ' · ' + chip(c.c.control) : ' · ' + unk('no control proves it')) +
      ' · ' + esc(c.s.text) + (t && t.last ? ' ' + P.freshTag(t.last, 'Last run') : '') + '</div></li>';
  }).join('') + '</ol>';
}
function evidenceList(x) {
  if (!x.det) return '<p>' + unk('No evidence requirements recorded') + '</p>';
  var need = x.conds.filter(function (c) { return c.c.control; });
  var manual = x.conds.filter(function (c) { return !c.c.control; });
  return '<ul class="pf-need">' + need.map(function (c) {
    var t = c.s.t, good = t.result === 'pass' && t.fresh.state !== 'stale' && t.fresh.state !== 'never';
    return '<li><span class="ic ' + (good ? 'ok' : t.result === 'never' ? 'unknown' : 'bad') + '" aria-hidden="true">' + (good ? '✓' : t.result === 'never' ? '?' : '✗') + '</span><span><b>' + esc(t.evidence || 'no evidence recorded') + '</b> from ' + chip(c.c.control) + ' ' + P.freshTag(t.last, 'Evidence') +
      '<span class="sr-only">' + (good ? 'sufficient' : 'insufficient') + '</span>' + (t.exceptions.length ? '<div class="small dim">Does not cover: ' + esc(t.exceptions.join('; ')) + '</div>' : '') + '</span></li>';
  }).join('') + manual.map(function (c) { return '<li><span class="ic unknown" aria-hidden="true">?</span><span>' + unk('A signed attestation: ' + c.c.check) + '<span class="sr-only">not yet provided</span></span></li>'; }).join('') + '</ul>' +
    '<p class="small dim">Approval needs every item passing, with evidence no older than 30 days.</p>';
}
function integration(x) {
  if (!x.det) return '';
  return '<div class="pf-integ">' + KIND_ORDER.map(function (k) {
    var cs = x.conds.filter(function (c) { return c.c.kind === k; });
    return '<div class="pf-ig"><h4>' + esc(k) + ' <span class="dim">' + cs.length + '</span></h4>' + (cs.length ? '<ul>' + cs.map(function (c) { return '<li class="small"><span class="mono">' + esc(c.c.check) + '</span> <span class="ev-r ev-' + (c.s.state === 'pass' ? 'pass' : c.s.state === 'fail' ? 'fail' : 'never') + '">' + esc(STATE_TEXT[c.s.state]) + '</span></li>'; }).join('') + '</ul>' : '<p class="small dim">none</p>') + '</div>';
  }).join('') + '</div>';
}
function workbench(fid) {
  var fe = P.get(fid), f = fe.obj, r = NS.reviews.filter(function (x) { return x.feature === fid; })[0];
  if (!r) return P.pageHead('Privacy review', f.name, chip(f.product)) + '<p class="callout unk">' + unk('This feature has no privacy review') + ' — nothing about its data can be shown to have been checked.</p>' + P.chainHTML(fid) + P.cite([fid, f.product], 'Records');
  P.pushTrail(r.id);
  var x = P.reviewInfo(r), S = x.scope, q = NS.eightQ[fid], det = x.det;
  var decs = uniq(S.promises.map(function (p) { return P.get(p).obj.decision; }).filter(Boolean));
  var tiers = S.ds.map(function (d) { return '<li>' + chip(d.id) + ' ' + P.tier(P.dsTier(d)) + ' <span class="small dim">' + esc(d.fields.filter(function (fl) { return fl[1] >= 3; }).map(function (fl) { return fl[0]; }).join(', ') || 'no T3+ fields') + '</span></li>'; }).join('');
  var none = function (what) { return unk('none registered — ' + what + ' cannot be shown'); };
  var nodes = S.sys.concat(S.models.map(function (m) { return m.id; }));
  var dfd = S.flows.length && P.miniDFD ? '<div class="canvas" tabindex="0" role="region" aria-label="Data-flow diagram for ' + esc(f.name) + '">' + P.miniDFD(nodes, S.flows) + '</div>' : '';
  return P.pageHead('Privacy review · ' + r.id, f.name, chip(f.product) + ' · feature ' + esc(f.status) + ' · review at <b>' + esc(r.stage.toLowerCase()) + '</b> ' + P.sev(r.risk)) +
    (x.blockers.length ? '<div class="callout warn" style="margin-bottom:14px"><b>' + pl(x.blockers.length, r.stage === 'POST-LAUNCH AUDIT' ? 'open post-launch blocker' : 'launch blocker') + ':</b> ' + x.blockers.map(function (b) { return chip(b.id, b.id); }).join(' ') + (r.stage === 'POST-LAUNCH AUDIT' ? ' — the feature is live; the audit cannot close until these do.' : ' — the launch gate refuses sign-off until these close.') + '</div>' : '') +
    '<div class="pf-wb">' +
    '<section class="card pf-intake" aria-labelledby="wbIn"><h2 class="sec" id="wbIn">1 · Intake</h2>' + P.kv([
      ['What it does', det ? esc(det.summary) : unk('no intake summary')], ['Requested by', det ? P.ownerHTML(det.requester) : unk('unknown')], ['Opened', esc(P.hdate(x.intake)) + ' <span class="dim">(' + esc(P.rel(x.intake)) + ')</span>'],
      ['Reviewer', r.reviewer ? esc(r.reviewer) : unk('no reviewer assigned')], ['Signed off', x.signedOff ? esc(P.hdate(x.signedOff)) : '<span class="dim">not yet</span>'],
      ['Re-review', '<span class="pf-rereview">' + P.rereviewHTML(x) + '</span>']]) + '</section>' +
    '<section class="card pf-scope" aria-labelledby="wbSc"><h2 class="sec" id="wbSc">2 · Scope</h2>' + P.kv([
      ['Data and tiers', S.ds.length ? '<ul class="pf-tl">' + tiers + '</ul>' : none('its data')],
      ['Purposes', S.purposes.length ? S.purposes.map(function (p) { return chip(p); }).join(' ') : none('its purposes')],
      ['Identities', S.ids.length ? S.ids.map(function (i) { return chip(i); }).join(' ') : none('its identifiers')],
      ['Flows', S.flows.length ? S.flows.map(function (fl) { return chip(fl.id); }).join(' ') : none('its flows')],
      ['Vendors', S.vendors.length ? S.vendors.map(function (v) { return chip(v); }).join(' ') : S.sys.length ? '<span class="dim">none</span>' : none('its vendors')],
      ['Models', S.models.length ? S.models.map(function (m) { return chip(m.id); }).join(' ') : '<span class="dim">none</span>']]) + '</section>' +
    (dfd ? '<section class="card pf-dfd" aria-labelledby="wbDf"><h2 class="sec" id="wbDf">Data-flow diagram, built from lineage</h2>' + dfd + '</section>' : '') +
    '<section class="card pf-8q" aria-labelledby="wb8"><h2 class="sec" id="wb8">3 · The eight review questions</h2><div class="tbl-wrap" tabindex="0" role="region" aria-label="Eight review questions"><table class="tbl"><caption class="sr-only">The same eight questions for every review</caption><tbody>' +
      QS.map(function (k, i) { var a = q && q[k]; return '<tr data-q="' + k + '"><th scope="row" class="nowrap"><span class="mono small dim">' + (i + 1) + '</span> ' + k + '<div class="small dim pf-qt">' + esc(QTEXT[k]) + '</div></th><td>' + (a ? esc(a) : unk(q ? 'UNKNOWN — unanswered, and therefore a finding' : 'not yet answered')) + '<div class="small dim">Red flag: ' + esc(RF[k]) + '</div></td></tr>'; }).join('') + '</tbody></table></div></section>' +
    '<section class="card pf-launch" aria-labelledby="wbLc"><h2 class="sec" id="wbLc">4 · Conditions before launch</h2>' + condTable(x) + '</section>' +
    '<section class="card" aria-labelledby="wbEv"><h2 class="sec" id="wbEv">5 · Evidence required for approval</h2>' + evidenceList(x) + '</section>' +
    '<section class="card" aria-labelledby="wbIg"><h2 class="sec" id="wbIg">6 · Where each condition is enforced</h2><p class="small muted">The concrete checks behind the conditions: what runs on every pull request, what blocks a deploy, and what is tested in production.</p>' + integration(x) + '</section>' +
    '<section class="card" aria-labelledby="wbCh"><h2 class="sec" id="wbCh">7 · What changed since ' + (x.signedOff ? 'sign-off' : 'intake') + '</h2>' + (x.changes.length ? '<ul class="pf-chg">' + x.changes.map(function (d) { return '<li><span class="small dim nowrap">' + esc(P.hdate(d.t)) + '</span> ' + esc(d.text) + ' ' + d.entities.filter(function (e) { return P.get(e); }).map(function (e) { return chip(e, P.get(e).type === 'finding' ? e : null); }).join(' ') + '</li>'; }).join('') + '</ul>' : '<p class="small">Nothing recorded in drift touches this feature’s scope.</p>') + '</section>' +
    '<section class="card" aria-labelledby="wbPr"><h2 class="sec" id="wbPr">8 · Promises and decisions it affects</h2>' +
      (S.promises.length ? '<ul class="pf-pl">' + S.promises.map(function (pid) { var p = P.get(pid).obj; return '<li>' + P.statusTag(P.promiseState(p).status) + ' ' + chip(pid, pid) + ' <q>' + esc(p.text) + '</q></li>'; }).join('') + '</ul>' : '<p>' + unk('No published promise covers this feature') + '</p>') +
      (decs.length ? '<p class="small">Decisions: ' + decs.map(function (d) { var dx = P.decision(P.get(d).obj); return chip(d, d) + ' <span class="stage stage-' + dx.d.status + '">' + esc(P.STAGE_TEXT[dx.d.status]) + '</span>'; }).join(' · ') + '</p>' : '') + '</section>' +
    '<section class="card" aria-labelledby="wbFi"><h2 class="sec" id="wbFi">9 · Findings in scope</h2>' + (S.sys.length ? P.passportHelpers.findingsList(S.open) : unk('No lineage — findings cannot attach')) + '</section>' +
    '</div>' +
    '<section class="card" style="margin-top:14px" aria-labelledby="wbCn"><h2 class="sec" id="wbCn">From promise to owner</h2>' + P.chainHTML(fid) + '</section>' +
    P.cite([r.id, fid].concat(S.sys, S.ds.map(function (d) { return d.id; }), S.flows.map(function (fl) { return fl.id; }), S.vendors, x.conds.map(function (c) { return c.c.control; }), S.promises, decs), 'Records');
}
V['privacy/reviews'] = { title: 'Privacy reviews', render: function (s) {
  if (s[0] && P.get(s[0]) && P.get(s[0]).type === 'feature') return workbench(s[0]);
  if (s[0]) return P.pageHead('Privacy review', 'Review not found', '') + '<p>' + unk('No feature with id ' + s[0]) + '</p><p><a href="#/privacy/reviews">All reviews</a></p>';
  return listView();
} };
})();
