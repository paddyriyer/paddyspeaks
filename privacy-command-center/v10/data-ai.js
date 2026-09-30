/* Northstar — the investigation layer (synthetic).
 *
 * SYNTHETIC DEMO DATA. Northstar is fictional; every agent, tool, vendor
 * audit, schema change and date below is invented and describes no real
 * organisation. Vendor names are the fictional ones already used in data.js.
 *
 * data.js says what Northstar HAS. This file adds what an investigator needs
 * to follow data end to end:
 *
 *   origins          where each dataset's records come from, and on what basis
 *   transforms       what each flow does to the data on the way (null = nobody knows)
 *   schemaChanges    fields added or re-keyed, and whether a gate noticed
 *   purposeHistory   purpose at collection vs purposes added later
 *   aiConversationData  datasets that hold what customers said to us
 *   aiModels         per model: data by stage (training, fine-tuning, RAG,
 *                    memory, inference), artefacts kept, retraining, unlearning
 *                    limits, extraction risk, automated decisions, residency
 *   agents           AI agents, their tools, permissions and approval boundaries
 *   vendorOps        per vendor: access method, last audit, termination and
 *                    deletion status
 *   worstDayScenarios / worstDaySafeguards   the Worst Day simulator's words
 *
 * Only words and dates are authored. Every count, band and verdict on screen
 * is computed from these records by views-investigate.js. */
(function () {
'use strict';
var NS = window.NS;

/* ── origins: where each dataset comes from ──────────────────────────────
 * kind: provided (the person typed or chose it) · observed (recorded as they
 * use a product) · derived (computed from other data) · inferred (a guess
 * about them) · sdk (collected by third-party code) · copy (a copy of other
 * data). from: the entity the records arrive from. */
NS.origins = {
  d_txn:            { from: 's_checkout',  kind: 'provided', how: 'Written at checkout from the order the person places and the card they enter.', basis: 'contract' },
  d_purchase:       { from: 's_checkout',  kind: 'observed', how: 'Emitted for every purchase; precise coordinates are copied from the app payload.', basis: 'analytics consent, checked at collection only' },
  d_orders_wh:      { from: 's_bus',       kind: 'derived',  how: 'Loaded from purchase_events, then enriched with an age band and a likely-parent guess.', basis: 'none recorded for the enrichment' },
  d_fraudfeat:      { from: 's_fraudsvc',  kind: 'derived',  how: 'Computed from checkout events: velocity, IP risk, geo mismatch, device fingerprint.', basis: 'legitimate interest (fraud)' },
  d_lochist:        { from: 's_location',  kind: 'observed', how: 'Recorded by the Storefront app while location is on; home and work are computed nightly.', basis: 'OS location permission and the in-app toggle' },
  d_profile:        { from: 'n_app',       kind: 'provided', how: 'Typed by the person when they create or edit their account.', basis: 'contract' },
  d_phone2fa:       { from: 'n_app',       kind: 'provided', how: 'Entered by the person when they turn on two-factor sign-in.', basis: 'account security' },
  d_audience:       { from: 's_mktg',      kind: 'derived',  how: 'Built nightly from ad events, hashed emails, phone hashes and (since September) fraud score bands.', basis: 'advertising consent, checked nightly' },
  d_adsevents:      { from: 's_capi',      kind: 'observed', how: 'Recorded when an ad is shown or a conversion is reported.', basis: 'advertising consent, checked at collection' },
  d_pulsecycle:     { from: 's_pulseapi',  kind: 'provided', how: 'Logged by the person in the Pulse app, encrypted with their own key.', basis: 'explicit health consent' },
  d_pulseinstall:   { from: 's_pulsesdk',  kind: 'sdk',      how: 'Sent by the SDK bundle inside the Pulse app on install and on each screen.', basis: null },
  d_heart:          { from: 's_pulseapi',  kind: 'derived',  how: 'Weekly resting-heart-rate aggregates computed on the device and uploaded.', basis: 'explicit health consent' },
  d_msgmeta:        { from: 's_msg',       kind: 'observed', how: 'Delivery metadata written by the messaging service; message content never leaves devices.', basis: 'contract' },
  d_linklogs:       { from: 's_linkprev',  kind: 'observed', how: 'Written by the link-preview fetcher for every link shared in a chat.', basis: 'none needed was assumed; never reviewed' },
  d_prompts:        { from: 's_nova',      kind: 'provided', how: 'Every prompt a person types into Nova and every answer, stored in full with their user ID.', basis: 'terms of service only' },
  d_novavec:        { from: 's_nova',      kind: 'provided', how: 'Chunks of documents people upload or paste into Nova, embedded for retrieval.', basis: 'workspace administrator' },
  d_novamem:        { from: 'mdl_memory',  kind: 'inferred', how: 'Sentences the memory extractor decides are worth remembering from a conversation.', basis: 'opt-in (planned, not built)' },
  d_transcripts:    { from: 's_supportsvc', kind: 'provided', how: 'The full text of support chats between customers and agents.', basis: 'contract' },
  d_browse:         { from: 'n_web',       kind: 'observed', how: 'Sent by the browser extension for each page the person visits.', basis: 'analytics consent' },
  d_applogs:        { from: 's_gateway',   kind: 'observed', how: 'One line per request through the API gateway, including the full URL.', basis: 'none needed was assumed; query strings carry email' },
  d_family:         { from: 'n_app',       kind: 'provided', how: 'Entered by a parent when adding a child to a household.', basis: 'verifiable parental consent' },
  d_identity_graph: { from: 's_idres',     kind: 'inferred', how: 'Edges guessed by probabilistic matching (IP and time) and login stitching.', basis: null },
  d_backup:         { from: 's_wh',        kind: 'copy',     how: 'Nightly encrypted snapshots of the core stores.', basis: 'disaster recovery' },
  d_search:         { from: 's_search',    kind: 'observed', how: 'Queries typed into Storefront search and the products clicked.', basis: 'personalisation consent, checked at read' },
  d_dpstats:        { from: 's_insights',  kind: 'derived',  how: 'City-by-category counts with differential-privacy noise added before release.', basis: 'aggregate — no per-person rows' }
};

/* ── what each arrow does to the data (null: nobody has described it) ─── */
NS.transforms = {
  fl01: 'Sent over TLS; fields unchanged.',
  fl02: 'Passed in memory; fields unchanged.',
  fl03: 'Passed in memory; fields unchanged.',
  fl04: 'Card number replaced by a Vaultline token before it leaves.',
  fl05: 'Serialised to the event schema; precise_lat and precise_lon copied from the app payload.',
  fl06: 'Loaded as-is, then enriched with age_band and likely_parent in the warehouse.',
  fl07: 'Passed per request; fields unchanged.',
  fl08: 'Velocity, IP risk and geo-mismatch computed from checkout events.',
  fl09: 'A training snapshot of the feature table is taken each month.',
  fl10: 'Fraud score bucketed into bands; device fingerprint copied unchanged.',
  fl11: 'Email hashed (SHA-256); segment and fraud score band attached; file PGP-encrypted.',
  fl12: 'Raw coordinates stored; home and work clusters computed nightly.',
  fl13: 'Full replica; nothing removed.',
  fl14: 'Home and work clusters read directly; nothing removed.',
  fl15: null,
  fl16: 'Email hashed in the browser by the pixel script.',
  fl17: 'None: full URL, page title and account ID sent as they are.',
  fl18: null,
  fl19: 'Encrypted on the device with the person’s own key.',
  fl20: 'Names, emails and phone numbers redacted before the provider sees the prompt.',
  fl21: 'Prompt and answer stored in full beside the user ID.',
  fl22: 'Transcript copied in real time.',
  fl23: null,
  fl24: 'Redactor strips email from request bodies; query strings pass through.',
  fl25: null,
  fl26: null,
  fl27: 'Encrypted snapshot under separate backup keys.',
  fl28: 'Email hashed (SHA-256) at the forwarder.',
  fl29: 'Aggregated to city × category counts; differential-privacy noise added.',
  fl30: 'Full URL fetched and written to the fetch log.',
  fl31: 'Aggregated to revenue totals.',
  fl32: 'A model proposes one memory sentence from the conversation.',
  fl33: 'An excerpt is sent to an isolated provider tenant; nothing is kept there.'
};

/* ── schema changes: new fields, re-keys, and whether a gate fired ─────── */
NS.schemaChanges = [
  { id: 'SC-31', ds: 'd_purchase', date: '2026-09-23', change: 'added', fields: ['precise_lat', 'precise_lon'], via: 'Event schema registry, marked a “compatible” change', gate: 'did not fire', finding: 'PRV-0214' },
  { id: 'SC-30', ds: 'd_audience', date: '2026-09-22', change: 'added', fields: ['fraud_score_band'], via: 'Marketing Audience Builder join to the fraud feature store', gate: 'human approval recorded the purpose as analytics', finding: 'PRV-0217' },
  { id: 'SC-28', ds: 'd_prompts', date: '2026-09-12', change: 'added', fields: ['health_mentions'], via: 'Evaluation pipeline v3 added a health classifier to prompt logs', gate: 'no gate covers log schemas', finding: 'PRV-0212' },
  { id: 'SC-24', ds: 'd_pulseinstall', date: '2026-08-02', change: 'added', fields: ['maid'], via: 'SDK bundle 4.1 shipped an ad-attribution module', gate: 'no SDK manifest gate', finding: 'PRV-0233' },
  { id: 'SC-19', ds: 'd_orders_wh', date: '2026-06-30', change: 'added', fields: ['likely_parent'], via: 'Warehouse model orders_enriched v12', gate: 'did not fire — warehouse columns carry no tier tags', finding: null },
  { id: 'SC-17', ds: 'd_novavec', date: '2026-06-10', change: 're-keyed', fields: ['chunk_embedding'], via: 'Chunking service keyed chunks by chunk ID instead of source document', gate: 'no deletion test ran after the change', finding: 'PRV-0221' }
];

/* ── purpose at collection vs purposes added afterwards ──────────────── */
NS.purposeHistory = [
  { ds: 'd_prompts', collected: ['service_delivery'], told: 'Nova settings: “Improve Nova” is off by default.', added: [{ purpose: 'model_training', date: '2026-09-12', by: 't_nova', basis: 'terms of service only' }] },
  { ds: 'd_transcripts', collected: ['customer_support'], told: 'Help Center: support chats are used to resolve your case.', added: [{ purpose: 'model_training', date: '2025-11-03', by: 't_support', basis: 'none recorded' }] }
];

/* ── AI: which datasets hold what customers said to us ───────────────── */
NS.aiConversationData = [
  { ds: 'd_prompts', what: 'What people type to Nova, and its answers' },
  { ds: 'd_transcripts', what: 'Support chats between customers and agents' },
  { ds: 'd_novamem', what: 'Memories extracted from Nova conversations' },
  { ds: 'd_novavec', what: 'Documents people upload or paste into Nova conversations' }
];

/* ── AI: per model, beyond the registry row in data.js ───────────────────
 * fineTune/rag/memory: datasets used at that stage (training comes from
 * models[].training minus fineTune). retrain: cadence in days and last run;
 * excludesDeleted says whether a retrain drops deleted people. extraction:
 * memorisation / extraction risk as a band word (null = unknown). adm: an
 * automated decision about a person, if any. */
NS.aiModels = {
  mdl_fraud: { fineTune: [], rag: [], memory: [], inference: 'The order, device fingerprint and IP address at checkout.',
    artefacts: { prompts: null, outputs: { what: 'risk scores', retention: '180 days' }, logs: { what: 'score and top features per order', retention: '180 days' }, embeddings: null, memory: null },
    retrain: { cadence: 30, last: '2026-09-01', excludesDeleted: true },
    unlearning: 'Deleted customers are left out of the next monthly retrain. Until then the live model still reflects them.',
    extraction: { level: 'low', why: 'Tabular features in, a score out; no free text is learned.', tested: null },
    adm: { decides: 'Holds or blocks a checkout it scores as risky', human: 'Held orders go to an analyst; automatic blocks do not', explanation: 'The customer sees “we couldn’t verify this payment”; the reasons stay internal', appeal: 'Contact support; an analyst reviews the block within two working days' } },
  mdl_lookalike: { fineTune: [], rag: [], memory: [], inference: 'Seed audiences chosen by marketers.',
    artefacts: { prompts: null, outputs: { what: 'audience segments', retention: '390 days' }, logs: { what: 'segment membership per run', retention: '390 days' }, embeddings: null, memory: null },
    retrain: { cadence: 7, last: '2026-09-21', excludesDeleted: true },
    unlearning: 'The weekly retrain drops opted-out people only when the consent filter runs — it did not run on 21 September.',
    extraction: { level: 'medium', why: 'A 2025 incident showed rare-segment membership could be reproduced; a minimum audience size now applies, and fraud signals were added since.', tested: '2025-11-28' },
    adm: { decides: 'Which people are shown which ads', human: 'None', explanation: '“Why this ad?” names the advertiser only, not that fraud or location signals contributed', appeal: 'Opt out of personalised ads — which does not currently reach AdReach' } },
  mdl_reorder: { fineTune: [], rag: [], memory: [], inference: 'The signed-in customer’s recent orders.',
    artefacts: { prompts: null, outputs: { what: 'product suggestions', retention: '30 days' }, logs: null, embeddings: null, memory: null },
    retrain: { cadence: 7, last: '2026-09-20', excludesDeleted: true },
    unlearning: 'Rebuilt weekly from the warehouse, so a deletion reaches it once the warehouse delete job succeeds — which is not verified.',
    extraction: { level: 'low', why: 'Learns purchase co-occurrence, not free text.', tested: null }, adm: null },
  mdl_nova: { fineTune: ['d_prompts'], rag: ['d_novavec'], memory: [], inference: 'The person’s prompt, retrieved workspace chunks and saved memories, redacted, then sent to the provider.',
    artefacts: { prompts: { what: 'full prompt text with user ID', retention: '400 days (declared 30)' }, outputs: { what: 'full answer text', retention: '400 days (declared 30)' }, logs: { what: 'samples read by staff for quality', retention: '400 days' },
      embeddings: { what: 'workspace document chunks', retention: 'lives with the source document — orphaned chunks survived deletion' }, memory: { what: 'see Nova Memory Extractor', retention: null } },
    retrain: { cadence: 90, last: '2026-07-15', excludesDeleted: false },
    unlearning: 'There is no deletion path for the fine-tuning set. Deleting a conversation removes the log row, not what the fine-tuned weights learned from it; only retraining from a cleaned set removes it, and none is scheduled.',
    extraction: { level: 'high', why: 'Fine-tuned on free-text conversations that can hold health, money and relationship details; memorisation has never been tested.', tested: null },
    adm: null },
  mdl_summarise: { fineTune: [], rag: [], memory: [], inference: 'Full support transcripts, sent by HelpHub to its LLM subprocessor.',
    artefacts: { prompts: { what: 'transcripts at the vendor', retention: null }, outputs: { what: 'case summaries in the CRM', retention: '365 days' }, logs: { what: 'vendor-controlled', retention: null }, embeddings: null, memory: null },
    retrain: null,
    unlearning: 'Unknown: whether the subprocessor trains on transcripts, and whether a deletion reaches it, has never been asked in writing.',
    extraction: { level: null, why: 'The vendor has not said whether transcripts are used for training.', tested: null }, adm: null },
  mdl_pulse: { fineTune: [], rag: [], memory: [], inference: 'The person’s own cycle log, on their device.',
    artefacts: { prompts: null, outputs: { what: 'predictions', retention: 'on the device only' }, logs: null, embeddings: null, memory: null },
    retrain: { cadence: 30, last: '2026-09-05', excludesDeleted: true },
    unlearning: 'Deleting the account destroys the person’s key, and their device leaves the next federated round. Differential privacy bounds how much any one person could have shaped the model.',
    extraction: { level: 'low', why: 'Federated training with differential privacy; raw logs never leave the phone.', tested: '2026-08-28' }, adm: null },
  mdl_search: { fineTune: [], rag: [], memory: [], inference: 'The query being typed and recent clicks.',
    artefacts: { prompts: null, outputs: { what: 'ranked results', retention: '14 days' }, logs: { what: 'query log', retention: '90 days' }, embeddings: null, memory: null },
    retrain: { cadence: 7, last: '2026-09-22', excludesDeleted: true },
    unlearning: 'Weekly retrain from the index; deleted users drop out once the reindex runs, which is not yet verified.',
    extraction: { level: 'low', why: 'Learns ranking signals; rare queries are dropped below a frequency floor.', tested: '2026-05-30' }, adm: null },
  mdl_memory: { fineTune: [], rag: [], memory: ['d_novamem'], inference: 'An excerpt of the current Nova conversation.',
    artefacts: { prompts: { what: 'conversation excerpts', retention: 'not kept (isolated tenant)' }, outputs: { what: 'memory sentences', retention: null }, logs: null, embeddings: null, memory: { what: 'one row per remembered fact', retention: null } },
    retrain: null,
    unlearning: 'Memories are rows, not weights: deleting the row removes the memory — once the user-visible delete ships.',
    extraction: { level: 'low', why: 'Does not train on what it reads; it only writes rows.', tested: null }, adm: null }
};

/* ── AI agents: tools, permissions and human approval boundaries ─────────
 * kind: read · write · act (changes something about the person) ·
 * external (sends data outside Northstar). purpose: the tool's own purpose
 * when it differs from the agent's. approval: none · human above a
 * limit · human before · blocked. */
NS.agents = [
  { id: 'ag_support', name: 'Nova Support Agent', model: 'mdl_nova', product: 'p_help', team: 't_support', purpose: 'customer_support',
    status: 'pilot — answers a share of support chats in the EU and US', since: '2026-08-04', actsFor: 'Customers who open a support chat',
    tools: [
      { name: 'Look up the customer’s orders', kind: 'read', purpose: 'service_delivery', data: ['d_txn'], system: 's_checkout', scope: 'the signed-in customer’s orders only', approval: 'none', logged: true },
      { name: 'Read the chat and past tickets', kind: 'read', data: ['d_transcripts'], system: 's_supportsvc', scope: 'this customer’s tickets', approval: 'none', logged: true },
      { name: 'Issue a refund', kind: 'act', purpose: 'service_delivery', data: ['d_txn'], system: 's_payment', scope: 'orders placed by this customer', approval: 'human above a limit', limit: 'small refunds are automatic; larger ones wait for a support lead', logged: true },
      { name: 'Change the delivery address', kind: 'act', purpose: 'service_delivery', data: ['d_profile'], system: 's_profile', scope: 'this customer’s profile', approval: 'human before', limit: 'the customer confirms by email link, then an agent approves', logged: true },
      { name: 'Remember a preference', kind: 'write', purpose: 'personalization', data: ['d_novamem'], system: 's_novamem', scope: 'this customer’s memory', approval: 'none', limit: 'no expiry defined', logged: false },
      { name: 'Send a follow-up email', kind: 'external', purpose: 'service_delivery', data: ['d_profile'], system: 'v_mailpost', scope: 'templated emails to this customer', approval: 'none', logged: true },
      { name: 'Close the account or delete data', kind: 'act', purpose: 'service_delivery', data: ['d_profile'], system: 's_delete', scope: '—', approval: 'blocked', limit: 'always handed to a person', logged: true }
    ],
    boundaries: ['Never closes an account or deletes data: it hands off to a person', 'Refunds above the limit and every address change need a person', 'Sees payment tokens, never card numbers', 'Cannot open another customer’s record'],
    injection: { defence: 'Retrieved text is marked untrusted and tool calls it suggests are refused', lastTest: '2026-08-20', result: 'a red-team found prompts that produced an unapproved tool call; fix in progress' },
    actionLog: { where: 's_novalogs', retention: '400 days, with the prompt logs' },
    adm: { decides: 'Small refunds, which it grants or refuses on its own', explanation: 'The reply states the refund and the order; a refusal does not say why', appeal: 'Ask for a person in the chat; a support lead reviews within one working day' },
    review: '2026-07-30', findings: ['PRV-0212', 'PRV-0236'], unknowns: ['how many refunds the agent refused, and on what grounds', 'whether memories it writes include health details'] },
  { id: 'ag_campaign', name: 'Campaign Builder Assistant', model: 'mdl_lookalike', product: 'p_audience', team: 't_audience', purpose: 'advertising',
    status: 'production — used by marketers', since: '2026-05-12', actsFor: 'Northstar marketers (staff)',
    tools: [
      { name: 'Query audience segments', kind: 'read', data: ['d_audience'], system: 's_adswh', scope: 'all segments', approval: 'none', logged: true },
      { name: 'Read home and work location clusters', kind: 'read', data: ['d_lochist'], system: 's_audsvc', scope: 'every app user with location on', approval: 'none', logged: false },
      { name: 'Build a lookalike audience', kind: 'act', data: ['d_audience', 'd_fraudfeat'], system: 's_mktg', scope: 'any seed list', approval: 'none', limit: 'minimum audience size enforced by the audience API', logged: true },
      { name: 'Export an audience to an ad partner', kind: 'external', data: ['d_audience'], system: 'v_adreach', scope: 'partners on the contract register', approval: 'human before', limit: 'recorded as required; exports can also run under a service account with no approver', logged: true }
    ],
    boundaries: ['Exports to partners need a named approver', 'Audiences below the minimum size are refused'],
    injection: { defence: 'Seed lists are parsed as data, not instructions', lastTest: null, result: null },
    actionLog: { where: 's_adswh', retention: '390 days' },
    adm: { decides: 'Who is included in an advertising audience', explanation: 'None shown to the people targeted', appeal: 'Opt out of personalised ads — which does not currently reach AdReach' },
    review: null, findings: ['PRV-0208', 'PRV-0217', 'PRV-0205'], unknowns: ['who approved each partner export in September', 'which audiences used location clusters'] },
  { id: 'ag_fraudops', name: 'Fraud Review Copilot', model: 'mdl_fraud', product: 'p_checkout', team: 't_fraud', purpose: 'fraud_prevention',
    status: 'production — used by fraud analysts', since: '2026-03-02', actsFor: 'Fraud analysts (staff)',
    tools: [
      { name: 'Read the held order and its fraud features', kind: 'read', data: ['d_fraudfeat', 'd_txn'], system: 's_fraudfs', scope: 'orders in the analyst’s queue', approval: 'none', logged: true },
      { name: 'Recommend release or cancel', kind: 'write', data: [], system: 's_fraudsvc', scope: 'a note on the case', approval: 'none', logged: true },
      { name: 'Cancel the order', kind: 'act', purpose: 'fraud_prevention', data: ['d_txn'], system: 's_checkout', scope: 'the held order', approval: 'human before', limit: 'the analyst confirms', logged: true },
      { name: 'Lock the account', kind: 'act', purpose: 'account_security', data: ['d_profile'], system: 's_profile', scope: 'the order’s account', approval: 'human before', limit: 'two analysts must agree', logged: true }
    ],
    boundaries: ['Recommends; never cancels or locks on its own', 'Account locks need two people', 'Cannot read advertising or location data'],
    injection: { defence: 'Order notes from customers are shown as quoted text, never followed', lastTest: '2026-09-02', result: 'no unapproved actions in the last test' },
    actionLog: { where: 's_fraudfs', retention: '180 days' },
    adm: { decides: 'Nothing on its own — an analyst decides', explanation: 'The analyst sees the top features behind each score', appeal: 'Customers can ask support to re-review a cancelled order' },
    review: '2026-02-20', findings: [], unknowns: [] }
];

/* ── vendors: access method, last audit, termination and deletion ───────
 * deletion.state: verified (tested on the date) · requested (asked, not
 * confirmed) · unconfirmed (API exists, completion not proven) · none (no
 * mechanism) · unknown. */
NS.vendorOps = {
  v_clearsight: { access: 'Server push over HTTPS, streaming', audit: { date: null, kind: 'security questionnaire only' }, status: 'active', deletion: { state: 'none', text: 'No deletion API; contract says 90 days, 400 observed' } },
  v_adreach:    { access: 'SFTP batch push and a conversions API', audit: { date: '2026-06-30', kind: 'assurance report review and deletion attestation', result: 'passed with an exception on opt-outs' }, status: 'active', deletion: { state: 'requested', date: '2026-09-23', text: 'Rows exported without consent were asked to be deleted; confirmation pending' } },
  v_parcelry:   { access: 'API pull per order, only the fields the person agreed to share', audit: { date: '2026-08-31', kind: 'deletion attestation', result: 'passed' }, status: 'active', deletion: { state: 'verified', date: '2026-08-31', text: 'Canary deletions confirmed' } },
  v_helphub:    { access: 'Real-time CRM sync', audit: { date: '2026-02-20', kind: 'privacy questionnaire', result: 'passed before the retention change' }, status: 'active', deletion: { state: 'unconfirmed', text: 'API accepts deletes; completion not proven since retention moved to 365 days' } },
  v_vaultline:  { access: 'Token API over mTLS', audit: { date: '2026-07-01', kind: 'payment-security report review', result: 'passed' }, status: 'active', deletion: { state: 'verified', date: '2026-07-01', text: 'Token revocation tested' } },
  v_signalrisk: { access: 'Real-time API per transaction', audit: { date: '2026-05-06', kind: 'privacy review and deletion attestation', result: 'passed' }, status: 'active', deletion: { state: 'verified', date: '2026-05-06', text: 'Canary deletions confirmed' } },
  v_mailpost:   { access: 'Relay API with masked addresses', audit: { date: '2026-03-31', kind: 'deletion attestation', result: 'passed' }, status: 'renewal due', deletion: { state: 'verified', date: '2026-03-31', text: 'Suppression and deletion tested' } },
  v_lumen:      { access: 'Inference API; prompts redacted first', audit: { date: '2026-02-01', kind: 'no-training attestation', result: 'passed' }, status: 'active', deletion: { state: 'none', text: 'No deletion API; relies on a 30-day abuse window although the contract says none' } },
  v_pixelpeak:  { access: 'Script on our web pages; the browser sends data straight to the vendor', audit: { date: null, kind: 'never audited' }, status: 'no contract — removal decided', deletion: { state: 'unknown', text: 'Cannot be requested: there is no contract' } },
  v_geogrid:    { access: 'SDK inside the Storefront app; the phone sends data straight to the vendor', audit: { date: null, kind: 'never audited' }, status: 'removal in progress', deletion: { state: 'unknown', text: 'Vendor has not answered; its buyers are unknown' } },
  v_surveyloop: { access: 'CSV upload per campaign', audit: { date: '2024-08-28', kind: 'privacy questionnaire', result: 'passed' }, status: 'agreement expired — offboarding', deletion: { state: 'requested', date: '2026-09-05', text: 'Deletion certificate requested; not received' } },
  v_cloudhost:  { access: 'Hosts Northstar systems; data encrypted with Northstar-held keys', audit: { date: '2026-06-01', kind: 'assurance report review', result: 'passed' }, status: 'active', deletion: { state: 'verified', date: '2026-06-01', text: 'Key destruction tested' } }
};

/* ── Worst Day: the words for the simulator ──────────────────────────── */
NS.worstDayScenarios = [
  { id: 'breach', label: 'An outsider copies the store', who: 'someone outside Northstar with a full copy of the data' },
  { id: 'insider', label: 'Someone with access looks where they shouldn’t', who: 'a curious or coerced employee or contractor with read access' },
  { id: 'vendor', label: 'A vendor holding a copy is breached', who: 'an attacker inside a vendor or subprocessor that received the data' }
];
NS.worstDaySafeguards = [
  { id: 'ttl', label: 'Enforce the declared retention', control: 'c_retention_scan', does: 'Nothing older than the declared need is kept.' },
  { id: 'minimise', label: 'Drop inferred fields', control: 'c_schema', does: 'Guesses about the person (home, health, parenthood) are not stored.' },
  { id: 'tokenise', label: 'Replace durable identifiers with scoped tokens', control: 'c_id_scope', does: 'A stolen row no longer names a person outside this purpose.' },
  { id: 'keys', label: 'Per-person keys held apart', control: 'c_cryptoshred', does: 'A copy of the store is unreadable without each person’s key.' },
  { id: 'novendor', label: 'Keep it inside Northstar', control: 'c_gate_egress', does: 'No vendor or subprocessor holds a copy.' },
  { id: 'nojoin', label: 'Block unsanctioned joins', control: 'c_id_scope', does: 'It cannot be stitched to the person’s other data.' },
  { id: 'jit', label: 'Just-in-time access', control: 'c_jit', does: 'Nobody can read it without a ticket that expires.' }
];
})();
