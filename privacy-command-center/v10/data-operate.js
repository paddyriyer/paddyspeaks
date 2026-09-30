/* Northstar — OPERATE: consent, deletion, retention, individual rights and
 * privacy observability (synthetic).
 *
 * data.js has the fleet (consent consumers, deletion targets, rights requests);
 * data-ops.js has promises, decisions, control tests and Dana. This file adds
 * what running those promises produces day to day:
 *
 *   consentPipeline — what each consent consumer is, whether a probe watches it,
 *                     the copies consent must also reach (retry queues, cached
 *                     segments, derived data), the consent state model, the
 *                     synthetic probe revocations used to measure end-to-end
 *                     latency, and Dana's own revocation, consumer by consumer
 *   deletionTrace   — Dana's deletion request traced to every location it had to
 *                     reach: receipt, T+72h check, tombstone, hold, resurrection risk
 *   deletionCanaries, legalHolds, cryptoShredLimits
 *   retentionPolicy — declared retention per dataset, and what the scanner can see
 *   rightsReach     — for each of the seven rights, which systems, vendors and
 *                     models a request reaches, misses or cannot verify
 *   danaRequests    — Dana's own rights requests
 *   purposeReads, accessTriage, obsHistory, obsMeta — observability inputs
 *
 * Everything is invented and describes no real organisation. Dana is fictional.
 * Views compute every figure from these records; nothing on screen is typed. */
(function () {
'use strict';
var NS = window.NS;

/* ── consent ──────────────────────────────────────────────────────────────
 * kind: where in the pipeline the consumer sits. purposes: which consent it
 * reads. probe: a synthetic revocation checks it daily (c_consent_read).
 * unknownAs: what the consumer does when it has no answer for a person. */
NS.consentPipeline = {
  consumers: {
    cc1:  { kind: 'collection',   purposes: ['advertising', 'analytics'], probe: true,  unknownAs: 'no processing' },
    cc2:  { kind: 'collection',   purposes: ['advertising', 'analytics'], probe: true,  unknownAs: 'no processing' },
    cc3:  { kind: 'read path',    purposes: ['advertising'],              probe: true,  unknownAs: 'no processing' },
    cc4:  { kind: 'cache',        purposes: ['advertising', 'analytics'], probe: true,  unknownAs: 're-reads the Consent Service' },
    cc5:  { kind: 'read path',    purposes: ['advertising', 'analytics'], probe: false, unknownAs: 'not checked' },
    cc6:  { kind: 'read path',    purposes: ['personalization'],          probe: true,  unknownAs: 'no processing' },
    cc7:  { kind: 'batch job',    purposes: ['advertising'],              probe: true,  unknownAs: 'no processing' },
    cc8:  { kind: 'export',       purposes: ['advertising'],              probe: false, unknownAs: 'not checked (filter missing)' },
    cc9:  { kind: 'cache',        purposes: ['advertising'],              probe: true,  unknownAs: 'granted (fallback on cache miss)' },
    cc10: { kind: 'derived data', purposes: ['advertising'],              probe: false, unknownAs: 'not checked' },
    cc11: { kind: 'vendor',       purposes: ['advertising'],              probe: false, unknownAs: 'not sent' },
    cc12: { kind: 'vendor',       purposes: ['marketing email'],          probe: true,  unknownAs: 'no send' },
    cc13: { kind: 'read path',    purposes: ['health'],                   probe: true,  unknownAs: 'no processing' },
    cc14: { kind: 'derived data', purposes: ['model_training'],           probe: false, unknownAs: 'not checked' }
  },
  /* Copies the consumer list does not show: where an old answer survives. */
  copies: [
    { id: 'cp_dlq', name: 'purchase-events dead-letter queue', kind: 'retry queue', ent: 's_bus', honours: false,
      how: 'Failed events are retried for up to 41 days without re-reading consent.', danaArrive: null },
    { id: 'cp_segment', name: 'audience_segments (cached segment table)', kind: 'cached segment', ent: 'd_audience', honours: true,
      how: 'Rebuilt weekly; between rebuilds the exported segment still contains people who opted out.', danaArrive: 520920 }
  ],
  /* The state model. `processes`: whether processing may happen in that state. */
  states: [
    { id: 'UNKNOWN', meaning: 'No recorded answer for this purpose.', processes: false },
    { id: 'GRANTED', meaning: 'The person said yes, for this purpose, in this version of the notice.', processes: true },
    { id: 'REVOKED', meaning: 'The person said no, or withdrew a yes.', processes: false },
    { id: 'EXPIRED', meaning: 'A yes that has outlived its scope: notice version changed or 13 months passed.', processes: false }
  ],
  /* Advertising consent, last 7 days (synthetic). */
  transitions: [
    { from: 'UNKNOWN', to: 'GRANTED', trigger: 'opt in', n: 212400 },
    { from: 'UNKNOWN', to: 'REVOKED', trigger: 'declines at the prompt', n: 318700 },
    { from: 'GRANTED', to: 'REVOKED', trigger: 'revoke (settings or rights request)', n: 96100 },
    { from: 'GRANTED', to: 'EXPIRED', trigger: 'scope ends (notice v7 or 13 months)', n: 41800 },
    { from: 'REVOKED', to: 'GRANTED', trigger: 're-consent', n: 5300 },
    { from: 'EXPIRED', to: 'GRANTED', trigger: 're-prompt', n: 17900 }
  ],
  /* Synthetic probe revocations (c_consent_read): a test identity revokes
   * advertising and marketing-email consent; e2e = seconds until the last
   * PROBED consumer that propagates at all has applied it. vendors: seconds
   * to acknowledgement, or null when no acknowledgement arrived. */
  probes: [
    { id: 'PRB-0913a', at: '2026-09-13T03:10', e2e: 44100, slowest: 'cc7', vendors: { v_mailpost: 41, v_adreach: null } },
    { id: 'PRB-0913b', at: '2026-09-13T15:40', e2e: 61200, slowest: 'cc9', vendors: { v_mailpost: 38, v_adreach: null } },
    { id: 'PRB-0914a', at: '2026-09-14T09:05', e2e: 12600, slowest: 'cc7', vendors: { v_mailpost: 52, v_adreach: null } },
    { id: 'PRB-0915a', at: '2026-09-15T00:20', e2e: 83700, slowest: 'cc7', vendors: { v_mailpost: 35, v_adreach: null } },
    { id: 'PRB-0915b', at: '2026-09-15T14:10', e2e: 30600, slowest: 'cc9', vendors: { v_mailpost: 610, v_adreach: null } },
    { id: 'PRB-0916a', at: '2026-09-16T11:30', e2e: 52200, slowest: 'cc9', vendors: { v_mailpost: 44, v_adreach: null } },
    { id: 'PRB-0917a', at: '2026-09-17T00:02', e2e: 86400, slowest: 'cc7', vendors: { v_mailpost: 39, v_adreach: null } },
    { id: 'PRB-0917b', at: '2026-09-17T04:30', e2e: 70200, slowest: 'cc7', vendors: { v_mailpost: 47, v_adreach: null } },
    { id: 'PRB-0918a', at: '2026-09-18T18:00', e2e: 21600, slowest: 'cc7', vendors: { v_mailpost: 36, v_adreach: null } },
    { id: 'PRB-0919a', at: '2026-09-19T10:45', e2e: 47700, slowest: 'cc9', vendors: { v_mailpost: 42, v_adreach: null } },
    { id: 'PRB-0920a', at: '2026-09-20T02:00', e2e: 79200, slowest: 'cc7', vendors: { v_mailpost: 33, v_adreach: null } },
    { id: 'PRB-0920b', at: '2026-09-20T22:30', e2e: 5400, slowest: 'cc7', vendors: { v_mailpost: 40, v_adreach: null } },
    { id: 'PRB-0921a', at: '2026-09-21T06:00', e2e: 64800, slowest: 'cc7', vendors: { v_mailpost: 51, v_adreach: null } },
    { id: 'PRB-0922a', at: '2026-09-22T13:15', e2e: 38700, slowest: 'cc7', vendors: { v_mailpost: 37, v_adreach: null } },
    { id: 'PRB-0923a', at: '2026-09-23T00:15', e2e: 89100, slowest: 'cc7', vendors: { v_mailpost: 45, v_adreach: null } },
    { id: 'PRB-0923b', at: '2026-09-23T08:00', e2e: 57600, slowest: 'cc7', vendors: { v_mailpost: 43, v_adreach: null } },
    { id: 'PRB-0924a', at: '2026-09-24T16:45', e2e: 26100, slowest: 'cc7', vendors: { v_mailpost: 39, v_adreach: null } },
    { id: 'PRB-0925a', at: '2026-09-25T03:00', e2e: 75600, slowest: 'cc7', vendors: { v_mailpost: 48, v_adreach: null } },
    { id: 'PRB-0925b', at: '2026-09-25T10:15', e2e: 49500, slowest: 'cc9', vendors: { v_mailpost: 36, v_adreach: null } },
    { id: 'PRB-0926a', at: '2026-09-26T00:01', e2e: null, slowest: null, vendors: { v_mailpost: 44, v_adreach: null } }
  ],
  /* Dana's revocation: Settings › Privacy, 01:58 UTC — personalised ads and
   * marketing email off in one visit, two hours after the nightly Audience
   * Builder had already read consent. Per
   * consumer: seconds until her "no" arrives (null = it never will as built;
   * a number beyond today = scheduled, not yet arrived), and what acted on
   * her old "yes" meanwhile (acts: [what, count]). */
  dana: {
    person: 'u_dana', at: '2026-09-21T01:58', purposes: ['advertising', 'marketing email'], promise: 'PR-OPTOUT', decision: 'D-104', request: 'DSR-D-0921',
    steps: [
      { c: 'cc3',  arrive: 0.1,    evidence: 'Consent SDK read log', acts: [] },
      { c: 'cc1',  arrive: 0.2,    evidence: 'Tag-manager consent mode log', acts: [] },
      { c: 'cc2',  arrive: 0.6,    evidence: 'SDK consent sync receipt', acts: [] },
      { c: 'cc12', arrive: 31,     evidence: 'Unsubscribe webhook receipt', acts: [] },
      { c: 'cc4',  arrive: 540,    evidence: 'Edge cache TTL expiry', acts: [['ad-tag decisions served from the cached “yes”', 3]] },
      { c: 'cc9',  arrive: 71400,  evidence: 'CAPI cache refresh log', acts: [['conversion events forwarded to AdReach on the cached “yes”', 2]] },
      { c: 'cc7',  arrive: 79320,  evidence: 'Audience Builder run log (next nightly read)', acts: [['nightly audience build that read consent at 00:00, before she opted out', 1]] },
      { c: 'cc10', arrive: 526920, evidence: 'Retrain scheduled (weekly)', acts: [['lookalike training snapshot still holds her features', 1]] },
      { c: 'cc5',  arrive: null,   evidence: 'No consent check on warehouse reads', acts: [['analyst queries that read her rows since the opt-out', 4]] },
      { c: 'cc8',  arrive: null,   evidence: 'INC-2026-014: filter step missing from the export DAG', acts: [['daily AdReach exports that included her', 2]] },
      { c: 'cc11', arrive: null,   evidence: 'Opt-outs are not sent to AdReach', acts: [['partner audiences she remains in', 3]] }
    ],
    /* Vendors that received her data for these purposes. ack: when the vendor
     * confirmed the opt-out, null when it has not; channel null = no way to ask. */
    vendors: [
      { v: 'v_adreach',   channel: 'bulk deletion API (no per-person opt-out)', sent: '2026-09-23T09:05', ack: null },
      { v: 'v_pixelpeak', channel: null, sent: null, ack: null },
      { v: 'v_mailpost',  channel: 'unsubscribe webhook', sent: '2026-09-21T01:58', ack: '2026-09-21T01:59' }
    ]
  }
};

/* ── deletion ─────────────────────────────────────────────────────────────
 * Dana's deletion request, traced. `key` matches a deletion target
 * (system|label in data.js); `extra: true` marks a copy the orchestrator
 * does not know about. receipt: ok | failed | pending | none | unknown.
 * check (T+72h): absent | found | attested | not run | not possible.
 * The outcome (reached / missed / held / unverified) is derived in the view. */
NS.deletionTrace = {
  person: 'u_dana', request: 'DSR-D-0923', received: '2026-09-23T09:00', checkAt: '2026-09-26T09:00', promise: 'PR-DELETE', decision: 'D-107',
  told: { at: '2026-09-23T09:04', text: 'Your data has been deleted.' },
  locations: [
    { key: 's_profile|primary database', receipt: 'ok', check: 'absent', evidence: 'Orchestrator receipt + canary query', at: '2026-09-26', tombstone: 'hashed ID kept to block re-creation' },
    { key: 's_profile|read replicas', receipt: 'ok', check: 'absent', evidence: 'Replica lag check + canary query', at: '2026-09-26' },
    { key: 's_cache|session & consent cache', receipt: 'ok', check: 'absent', evidence: 'Invalidation receipt', at: '2026-09-23' },
    { key: 's_txn|transaction store', receipt: 'ok', check: 'absent', evidence: 'Non-held columns nulled; held rows retained', at: '2026-09-26', hold: 'LH-PAY-7Y' },
    { key: 's_bus|event stream (compacted)', receipt: 'ok', check: 'absent', evidence: 'Tombstone offset recorded', at: '2026-09-26', tombstone: 'compaction tombstone on customer_id' },
    { key: 's_wh|core warehouse', receipt: 'ok', check: 'absent', evidence: 'Nightly delete-by-id + canary query', at: '2026-09-26', resurrect: 'A dead-letter replay re-inserts her events into the warehouse.' },
    { key: 's_logs|application logs', receipt: 'failed', check: 'found', evidence: 'Email found in 395 days of gateway logs', at: '2026-09-26', hold: null },
    { key: 's_search|search index', receipt: 'ok', check: 'not run', evidence: 'Reindex receipt; not in the canary scan (PRV-0176)', at: '2026-09-23', resurrect: 'A full reindex from an old warehouse snapshot restores her queries.' },
    { key: 's_backup|snapshot backups', receipt: 'ok', check: 'not possible', evidence: 'Tombstone logged for restore replay; snapshots cannot be queried', at: '2026-09-23', tombstone: 'tombstone log entry', expires: '2026-10-28', resurrect: 'A restore before expiry brings her back unless the tombstone replay runs (last drill 30 Aug).' },
    { key: 's_fraudfs|fraud feature store', receipt: 'ok', check: 'absent', evidence: 'Delete-by-id + TTL scan', at: '2026-09-26' },
    { key: 'mdl_fraud|fraud model', receipt: 'pending', check: 'not run', evidence: 'Excluded from the next monthly retrain', at: '2026-09-23', expires: '2026-10-01' },
    { key: 's_lochist|location history', receipt: 'failed', check: 'found', evidence: 'Soft-delete flag set; rows remain', at: '2026-09-26' },
    { key: 's_adswh|advertising warehouse', receipt: 'pending', check: 'not run', evidence: 'Removed at the next weekly segment rebuild', at: '2026-09-23', expires: '2026-09-27' },
    { key: 's_pulsedb|health records', receipt: 'ok', check: 'absent', evidence: 'Key destruction receipt (crypto-shredding)', at: '2026-09-23', shred: true },
    { key: 's_msgstore|message metadata', receipt: 'ok', check: 'absent', evidence: 'Lookup found no rows for her identifiers', at: '2026-09-26' },
    { key: 's_novavec|assistant vector store', receipt: 'failed', check: 'found', evidence: 'Chunks keyed by chunk ID survived the source delete', at: '2026-09-26' },
    { key: 's_novalogs|prompt logs', receipt: 'none', check: 'found', evidence: 'No deletion path for prompt logs', at: '2026-09-26' },
    { key: 's_supportsvc|support transcripts', receipt: 'ok', check: 'absent', evidence: 'Orchestrator receipt + canary query', at: '2026-09-26' },
    { key: 's_family|family accounts', receipt: 'ok', check: 'absent', evidence: 'Lookup found no household for her', at: '2026-09-26' },
    { key: 'v_helphub|HelpHub CRM', receipt: 'pending', check: 'not possible', evidence: 'Deletion API accepted; confirmation outstanding', at: '2026-09-23' },
    { key: 'v_adreach|AdReach Network', receipt: 'pending', check: 'not possible', evidence: 'Bulk deletion file sent; AdReach acknowledges in bulk only', at: '2026-09-23' },
    { key: 'v_mailpost|MailPost', receipt: 'ok', check: 'attested', evidence: 'Deletion API confirmation', at: '2026-09-23' },
    { key: 'v_parcelry|Parcelry', receipt: 'ok', check: 'attested', evidence: 'Deletion API confirmation', at: '2026-09-24' },
    { key: 'v_vaultline|Vaultline', receipt: 'ok', check: 'attested', evidence: 'Attestation; token retained under payment-record hold', at: '2026-09-24' },
    { key: 'v_signalrisk|SignalRisk', receipt: 'ok', check: 'attested', evidence: 'Deletion API confirmation', at: '2026-09-23' },
    { key: 's_idres|identity graph', receipt: 'unknown', check: 'not run', evidence: 'Not wired to the orchestrator; no owner to ask', at: null },
    /* copies the orchestrator does not know about */
    { key: 's_bus|purchase-events dead-letter queue', extra: true, receipt: 'none', check: 'not run', evidence: 'Assumption test “Retries & dead letters”: 41 days of payloads held', at: '2026-09-22', resurrect: 'Replaying the queue re-creates her events downstream.' },
    { key: 's_lochist_eu|location replica (EU)', extra: true, receipt: 'unknown', check: 'not run', evidence: 'Replica added 8 Sep; deletion path unknown', at: null },
    { key: 'mdl_lookalike|lookalike model', extra: true, receipt: 'pending', check: 'not run', evidence: 'Weekly retrain; weights trained on her features until then', at: '2026-09-23', expires: '2026-09-27' },
    { key: 'v_pixelpeak|PixelPeak (ad pixel)', extra: true, receipt: 'none', check: 'not possible', evidence: 'No contract and no deletion channel; received her hashed email at checkout', at: null },
    { key: 'sp_llmco|LLMCo summariser (via HelpHub)', extra: true, receipt: 'unknown', check: 'not possible', evidence: 'Subprocessor retention undocumented', at: null },
    { key: 'v_lumen|Lumen Model API', extra: true, receipt: 'pending', check: 'not possible', evidence: '30-day abuse window, then deleted by the provider; no deletion API', at: '2026-09-23', expires: '2026-10-21' }
  ]
};
/* Canary identities deleted at T and re-queried across the deletion targets at T+72h. */
NS.deletionCanaries = [
  { id: 'CAN-0830', deleted: '2026-08-30T09:00', checked: '2026-09-02T09:00', checkedN: 26, found: ['s_novavec', 's_logs'] },
  { id: 'CAN-0906', deleted: '2026-09-06T09:00', checked: '2026-09-09T09:00', checkedN: 26, found: ['s_novavec', 's_logs', 's_lochist'] },
  { id: 'CAN-0913', deleted: '2026-09-13T09:00', checked: '2026-09-16T09:00', checkedN: 26, found: ['s_novavec', 's_logs', 's_lochist'] },
  { id: 'CAN-0920', deleted: '2026-09-20T09:00', checked: '2026-09-23T09:00', checkedN: 26, found: ['s_novavec', 's_logs', 's_lochist', 's_novalogs'] }
];
/* Legal holds: deliberate exceptions to deletion and retention. Orientation, not legal advice. */
NS.legalHolds = [
  { id: 'LH-PAY-7Y', dataset: 'd_txn', scope: 'Transaction rows: amount, date, payment token', basis: 'Payment-record retention obligation', since: '2019-01-01', review: '2027-01-01', owner: 't_pay' },
  { id: 'LH-2026-03', dataset: 'd_transcripts', scope: 'Support chats about the spring order-dispute cases', basis: 'Litigation hold', since: '2026-06-02', review: '2026-12-01', owner: 't_support' },
  { id: 'LH-2026-05', dataset: 'd_applogs', scope: '14 days of gateway logs around INC-2026-011', basis: 'Security investigation', since: '2026-08-28', review: '2026-10-28', owner: 't_sre' }
];
/* What crypto-shredding does not cover. */
NS.cryptoShredLimits = [
  { text: 'Only data encrypted under the person’s own key is erased: today that is Pulse health records.', ents: ['c_cryptoshred', 's_pulsedb'] },
  { text: 'Anything decrypted before the key was destroyed — caches, logs, exports — stays readable.', ents: ['s_cache', 's_logs'] },
  { text: 'Embeddings and model weights computed from the plaintext are not shredded with the key.', ents: ['s_novavec', 'mdl_pulse'] },
  { text: 'Key backups in the HSM must be destroyed too, on their own rotation.', ents: ['c_cryptoshred'] },
  { text: 'Metadata outside the envelope (who, when, size) is not encrypted and remains.', ents: ['d_msgmeta'] }
];

/* ── retention ────────────────────────────────────────────────────────────
 * declared: what the data catalog says each dataset is kept for (days;
 * 0 = lives with its source; null = nothing declared). notScanned: datasets
 * the retention scanner cannot reach. */
NS.retentionPolicy = {
  declared: { d_txn: 2555, d_purchase: 90, d_orders_wh: 730, d_fraudfeat: 180, d_lochist: 30, d_profile: null, d_phone2fa: 0, d_audience: 390,
    d_adsevents: 395, d_pulsecycle: 365, d_pulseinstall: null, d_heart: 730, d_msgmeta: 30, d_linklogs: 14, d_prompts: 30, d_novavec: 0, d_novamem: null,
    d_transcripts: 365, d_browse: 90, d_applogs: 30, d_family: 0, d_identity_graph: null, d_backup: 35, d_search: 90, d_dpstats: 3650 },
  notScanned: ['d_pulseinstall', 'd_identity_graph', 'd_novamem']
};

/* ── individual rights ────────────────────────────────────────────────────
 * The seven rights, the request types in data.js each one covers, and where a
 * request of that type reaches today. [entity, outcome, how]; outcome:
 * reached | missed | unverified. DELETE is derived from the deletion targets. */
NS.rightKinds = [
  { id: 'ACCESS',  label: 'Access', types: ['ACCESS'], owner: 't_privacy' },
  { id: 'CORRECT', label: 'Correction', types: ['CORRECT'], owner: 't_identity' },
  { id: 'DELETE',  label: 'Deletion', types: ['DELETE'], owner: 't_privacy' },
  { id: 'PORT',    label: 'Portability', types: ['PORT'], owner: 't_privacy' },
  { id: 'RESTRICT', label: 'Restriction · limit sensitive use', types: ['LIMIT SENSITIVE USE'], owner: 't_privacy' },
  { id: 'OBJECT',  label: 'Objection · opt-out', types: ['OBJECT', 'OPT OUT'], owner: 't_audience' },
  { id: 'APPEAL',  label: 'Appeal of an automated decision', types: ['APPEAL'], owner: 't_fraud' }
];
NS.rightsReach = {
  ACCESS: [
    ['s_profile', 'reached', 'profile export'], ['s_txn', 'reached', 'order history export'], ['s_supportsvc', 'reached', 'transcript export'],
    ['s_pulsedb', 'reached', 'decrypted on request with her key'], ['s_lochist', 'reached', 'location export'], ['s_wh', 'reached', 'warehouse extract by customer_id'],
    ['s_idres', 'missed', 'linked identifiers and match inferences are not exported'], ['s_novalogs', 'missed', 'prompt logs are not part of the export'],
    ['s_adswh', 'missed', 'segments and inferences (e.g. “health interest”) are not exported'],
    ['v_helphub', 'unverified', 'vendor copy not requested'], ['v_adreach', 'unverified', 'partner audiences not requested'], ['mdl_lookalike', 'unverified', 'model inferences cannot be listed per person']
  ],
  CORRECT: [
    ['s_profile', 'reached', 'source of truth updated'], ['s_cache', 'reached', 'cache invalidated'], ['v_parcelry', 'reached', 'address pushed on next order'],
    ['s_wh', 'missed', 'history tables keep the old value'], ['s_search', 'missed', 'index keeps the old value until reindex'],
    ['v_mailpost', 'unverified', 'no confirmation of the updated name'], ['v_helphub', 'unverified', 'CRM copy not re-synced']
  ],
  PORT: [
    ['s_profile', 'reached', 'machine-readable JSON'], ['s_txn', 'reached', 'CSV of orders'], ['s_pulsedb', 'reached', 'FHIR-style export'],
    ['s_supportsvc', 'reached', 'transcript JSON'], ['s_novamem', 'missed', 'no export path yet'], ['s_novalogs', 'unverified', 'conversation export not checked for completeness']
  ],
  RESTRICT: [
    ['s_pulseapi', 'reached', 'runtime purpose enforcement'], ['s_checkout', 'reached', 'read-time check'],
    ['s_adswh', 'missed', 'the “health interest” segment is still built'], ['s_idres', 'missed', 'identity graph still links health device IDs'],
    ['mdl_lookalike', 'unverified', 'sensitive features cannot be removed per person']
  ],
  OBJECT: [
    ['s_checkout', 'reached', 'read-time consent check'], ['s_cache', 'reached', 'cache refresh within 15 min'], ['s_audsvc', 'reached', 'next nightly run'],
    ['v_mailpost', 'reached', 'unsubscribe webhook'], ['s_mktg', 'missed', 'export filter missing (INC-2026-014)'], ['v_adreach', 'missed', 'opt-outs not sent'],
    ['s_wh', 'missed', 'warehouse reads do not check consent'], ['mdl_lookalike', 'unverified', 'leaves at the weekly retrain'], ['v_pixelpeak', 'unverified', 'no channel to the vendor']
  ],
  APPEAL: [
    ['mdl_fraud', 'reached', 'manual review queue with reasons'], ['s_fraudsvc', 'reached', 'decision log kept for the appeal'],
    ['mdl_lookalike', 'missed', 'no human review and no appeal path'], ['v_signalrisk', 'unverified', 'vendor score contributes; its reasons are not disclosed']
  ]
};
/* Dana's requests. reach: 'fleet' uses the right's wiring above; 'consent' and
 * 'deletion' use her traces; an array overrides. */
NS.danaRequests = [
  { id: 'DSR-D-0910', type: 'APPEAL', region: 'US-CA', received: '2026-09-10', status: 'complete', completed: '2026-09-12', verified: true,
    what: 'Checkout declined by the fraud model; a reviewer reversed it.', reach: [['mdl_fraud', 'reached', 'reviewed by a person with the model’s reasons'], ['s_fraudsvc', 'reached', 'decision log retrieved'], ['v_signalrisk', 'unverified', 'vendor score reasons not disclosed']] },
  { id: 'DSR-D-0914', type: 'ACCESS', region: 'US-CA', received: '2026-09-14', status: 'complete', completed: '2026-09-17', verified: false,
    what: 'Asked for a copy of everything Northstar holds about her.', reach: 'fleet' },
  { id: 'DSR-D-0921', type: 'OPT OUT', region: 'US-CA', received: '2026-09-21', status: 'open', what: 'Opted out of personalised ads.', reach: 'consent' },
  { id: 'DSR-D-0923', type: 'DELETE', region: 'US-CA', received: '2026-09-23', status: 'open', what: 'Deleted her account.', reach: 'deletion' }
];

/* ── observability inputs ─────────────────────────────────────────────── */
/* Reads the runtime purpose check denied in the last 7 days (c_purpose_runtime). */
NS.purposeReads = {
  window: 7, checked: 1840000,
  denied: [
    { t: '2026-09-25T11:02', who: 'svc-growth-etl', dataset: 'd_pulsecycle', asked: 'analytics' },
    { t: '2026-09-24T16:20', who: 'svc-audience', dataset: 'd_heart', asked: 'advertising' },
    { t: '2026-09-23T09:41', who: 'analyst-4410', dataset: 'd_pulsecycle', asked: 'research' },
    { t: '2026-09-22T22:15', who: 'svc-mktg-sync', dataset: 'd_txn', asked: 'advertising' },
    { t: '2026-09-21T13:37', who: 'svc-audience', dataset: 'd_heart', asked: 'advertising' }
  ]
};
/* Triage state of each access anomaly (keyed by its timestamp in data.js). */
NS.accessTriage = { '2026-09-25T02:14': 'open', '2026-09-24T18:40': 'triaged', '2026-09-24T11:03': 'open', '2026-09-23T23:59': 'open',
  '2026-09-22T03:10': 'triaged', '2026-09-21T14:22': 'triaged', '2026-09-20T09:15': 'open', '2026-09-19T16:48': 'triaged' };
/* Seven previous weekly readings (oldest first) for signals with no
 * indicator in data-ops.js; the current reading is always computed live. */
NS.obsHistory = {
  e2eP99: [79200, 82800, 86400, 84600, 88200, 86400, 88200],
  vendorAck: [0.5, 0.5, 0.52, 0.5, 0.49, 0.5, 0.5],
  surviving: [2, 2, 2, 2, 3, 3, 4],
  joins: [4, 5, 5, 6, 6, 7, 7],
  denied: [3, 2, 4, 3, 5, 4, 6],
  anomalies: [3, 4, 3, 5, 4, 6, 5],
  weakCtl: [18, 18, 19, 19, 20, 20, 19],
  freshEv: [0.44, 0.47, 0.44, 0.5, 0.47, 0.5, 0.5]
};
/* Coverage and owners for the signals with no indicator entry. */
NS.obsMeta = {
  e2eP99:    { owner: 't_audience', coverage: null /* computed: probed consumers */ },
  vendorAck: { owner: 't_privacy',  coverage: null /* computed: vendors with a channel */ },
  surviving: { owner: 't_privacy',  coverage: { v: 0.73, of: 'deletion targets with canaries' } },
  joins:     { owner: 't_identity', coverage: { v: 0.84, of: 'systems scanned by lineage and log detectors' } },
  denied:    { owner: 't_privacy',  coverage: { v: 0.18, of: 'personal datasets behind the runtime purpose check (Pulse and Checkout only)' } },
  anomalies: { owner: 't_privacy',  coverage: { v: 0.7, of: 'stores that emit query logs to the monitor' } },
  weakCtl:   { owner: 't_privacy',  coverage: { v: 1, of: 'registered controls' } },
  freshEv:   { owner: 't_privacy',  coverage: { v: 1, of: 'registered controls' } }
};
})();
