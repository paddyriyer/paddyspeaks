/* Privacy Command Center — Northstar synthetic demo data.
 *
 * SYNTHETIC DEMO DATA. Northstar is a fictional company. Every system, dataset,
 * vendor, person, finding and incident below is invented for this demonstration
 * and describes no real organisation.
 *
 * Shape: plain collections that reference each other by id. app.js derives the
 * knowledge graph (nodes + typed edges), every metric, and the "unknown =
 * finding" detectors from these collections — nothing on screen is typed as a
 * number.
 */
(function () {
'use strict';

var TODAY = '2026-09-26';

/* ── Organisation ─────────────────────────────────────────────── */
var org = { id: 'org', name: 'Northstar', people: 212000000, regions: ['US', 'EU', 'UK', 'IN', 'BR', 'SG', 'JP'] };

var bus = [
  { id: 'bu_commerce',  name: 'Commerce',         lead: 'R. Okafor' },
  { id: 'bu_payments',  name: 'Payments',         lead: 'L. Brandt' },
  { id: 'bu_ads',       name: 'Advertising',      lead: 'M. Castell' },
  { id: 'bu_messaging', name: 'Messaging',        lead: 'S. Iwata' },
  { id: 'bu_health',    name: 'Health',           lead: 'D. Varga' },
  { id: 'bu_assistant', name: 'AI Assistant',     lead: 'P. Mendes' },
  { id: 'bu_support',   name: 'Customer Support', lead: 'A. Lindqvist' },
  { id: 'bu_analytics', name: 'Analytics',        lead: 'K. Adeyemi' }
];

var teams = [
  { id: 't_checkout',  name: 'Checkout Platform',   bu: 'bu_commerce',  oncall: '#checkout-oncall' },
  { id: 't_storefront',name: 'Storefront Growth',   bu: 'bu_commerce',  oncall: '#storefront' },
  { id: 't_location',  name: 'Local & Pickup',      bu: 'bu_commerce',  oncall: '#local-pickup' },
  { id: 't_pay',       name: 'Payments Core',       bu: 'bu_payments',  oncall: '#pay-core' },
  { id: 't_fraud',     name: 'Fraud Analytics',     bu: 'bu_payments',  oncall: '#fraud-analytics' },
  { id: 't_audience',  name: 'Audience Engineering',bu: 'bu_ads',       oncall: '#audience-eng' },
  { id: 't_measure',   name: 'Ads Measurement',     bu: 'bu_ads',       oncall: '#ads-measure' },
  { id: 't_msg',       name: 'Messaging Infra',     bu: 'bu_messaging', oncall: '#msg-infra' },
  { id: 't_pulse',     name: 'Pulse Health Eng',    bu: 'bu_health',    oncall: '#pulse-eng' },
  { id: 't_nova',      name: 'Nova Platform',       bu: 'bu_assistant', oncall: '#nova-platform' },
  { id: 't_support',   name: 'Support Tooling',     bu: 'bu_support',   oncall: '#support-tools' },
  { id: 't_browser',   name: 'Browser Analytics',   bu: 'bu_analytics', oncall: '#browser-analytics' },
  { id: 't_data',      name: 'Data Platform',       bu: 'bu_analytics', oncall: '#data-platform' },
  { id: 't_identity',  name: 'Identity Services',   bu: 'bu_analytics', oncall: '#identity' },
  { id: 't_privacy',   name: 'Privacy Engineering', bu: 'bu_analytics', oncall: '#privacy-eng' },
  { id: 't_sre',       name: 'Observability & SRE', bu: 'bu_analytics', oncall: '#sre' }
];

var products = [
  { id: 'p_checkout',  name: 'Checkout',            bu: 'bu_commerce',  team: 't_checkout',  users: 48000000 },
  { id: 'p_storefront',name: 'Storefront & Search', bu: 'bu_commerce',  team: 't_storefront',users: 91000000 },
  { id: 'p_pay',       name: 'Northstar Pay',       bu: 'bu_payments',  team: 't_pay',       users: 31000000 },
  { id: 'p_adsmgr',    name: 'Ads Manager',         bu: 'bu_ads',       team: 't_measure',   users: 2400000 },
  { id: 'p_audience',  name: 'Audience Builder',    bu: 'bu_ads',       team: 't_audience',  users: 180000 },
  { id: 'p_messenger', name: 'Northstar Messenger', bu: 'bu_messaging', team: 't_msg',       users: 64000000 },
  { id: 'p_pulse',     name: 'Pulse',               bu: 'bu_health',    team: 't_pulse',     users: 9200000 },
  { id: 'p_nova',      name: 'Nova Assistant',      bu: 'bu_assistant', team: 't_nova',      users: 22000000 },
  { id: 'p_help',      name: 'Help Center',         bu: 'bu_support',   team: 't_support',   users: 17000000 },
  { id: 'p_insights',  name: 'Insights Platform',   bu: 'bu_analytics', team: 't_data',      users: 0 }
];

var features = [
  { id: 'f_oneclick', name: 'One-click checkout',        product: 'p_checkout',  status: 'live' },
  { id: 'f_fraud',    name: 'Fraud screening',           product: 'p_checkout',  status: 'live' },
  { id: 'f_pickup',   name: 'Nearby pickup',             product: 'p_storefront',status: 'live' },
  { id: 'f_reorder',  name: 'Smart reorder reminders',   product: 'p_storefront',status: 'design review' },
  { id: 'f_search',   name: 'Personalised search',       product: 'p_storefront',status: 'live' },
  { id: 'f_p2p',      name: 'Peer payments',             product: 'p_pay',       status: 'live' },
  { id: 'f_capi',     name: 'Conversion API',            product: 'p_adsmgr',    status: 'live' },
  { id: 'f_lookalike',name: 'Lookalike audiences',       product: 'p_audience',  status: 'live' },
  { id: 'f_e2ee',     name: 'Encrypted chats',           product: 'p_messenger', status: 'live' },
  { id: 'f_linkprev', name: 'Link previews',             product: 'p_messenger', status: 'live' },
  { id: 'f_cycle',    name: 'Cycle & symptom tracking',  product: 'p_pulse',     status: 'live' },
  { id: 'f_heart',    name: 'Heart-rate insights',       product: 'p_pulse',     status: 'live' },
  { id: 'f_memory',   name: 'Assistant memory',          product: 'p_nova',      status: 'launch gate' },
  { id: 'f_rag',      name: 'Workspace answers (RAG)',   product: 'p_nova',      status: 'live' },
  { id: 'f_chat',     name: 'Support chat & summaries',  product: 'p_help',      status: 'live' },
  { id: 'f_browse',   name: 'Browser usage analytics',   product: 'p_insights',  status: 'build check' },
  { id: 'f_family',   name: 'Family accounts',           product: 'p_storefront',status: 'live' }
];

/* ── Systems: services, APIs, stores, streams, logs, models ─────
 * kind: edge | service | api | store | stream | warehouse | featurestore |
 *       log | cache | index | backup | vector | model | sdk | job        */
var systems = [
  { id: 's_gateway',   name: 'API Gateway',              kind: 'edge',        team: 't_sre',       region: 'us-east',  product: null },
  { id: 's_checkout',  name: 'Checkout Service',         kind: 'service',     team: 't_checkout',  region: 'us-east',  product: 'p_checkout', feature: 'f_oneclick' },
  { id: 's_payment',   name: 'Payment Service',          kind: 'service',     team: 't_pay',       region: 'us-east',  product: 'p_checkout', feature: 'f_oneclick' },
  { id: 's_txn',       name: 'Transaction Store',        kind: 'store',       team: 't_pay',       region: 'us-east',  product: 'p_checkout', parent: 's_payment' },
  { id: 's_fraudsvc',  name: 'Fraud Service',            kind: 'service',     team: 't_fraud',     region: 'us-east',  product: 'p_checkout', feature: 'f_fraud' },
  { id: 's_fraudfs',   name: 'Fraud Feature Store',      kind: 'featurestore',team: 't_fraud',     region: 'us-east',  product: 'p_checkout', parent: 's_fraudsvc' },
  { id: 's_bus',       name: 'Event Bus · purchase-events', kind: 'stream',   team: 't_data',      region: 'us-east',  product: 'p_insights' },
  { id: 's_wh',        name: 'Core Warehouse',           kind: 'warehouse',   team: 't_data',      region: 'us-east',  product: 'p_insights' },
  { id: 's_logs',      name: 'Application Logs',         kind: 'log',         team: 't_sre',       region: 'us-east',  product: null },
  { id: 's_cache',     name: 'Session & Consent Cache',  kind: 'cache',       team: 't_sre',       region: 'us-east',  product: null },
  { id: 's_search',    name: 'Search Index',             kind: 'index',       team: 't_storefront',region: 'us-west',  product: 'p_storefront', feature: 'f_search' },
  { id: 's_backup',    name: 'Snapshot Backups',         kind: 'backup',      team: 't_sre',       region: 'us-west',  product: null },
  { id: 's_location',  name: 'Location Service',         kind: 'service',     team: 't_location',  region: 'us-east',  product: 'p_storefront', feature: 'f_pickup' },
  { id: 's_lochist',   name: 'Location History Store',   kind: 'store',       team: 't_location',  region: 'us-east',  product: 'p_storefront', parent: 's_location' },
  { id: 's_audsvc',    name: 'Audience Builder Service', kind: 'service',     team: 't_audience',  region: 'us-east',  product: 'p_audience', feature: 'f_lookalike' },
  { id: 's_adswh',     name: 'Advertising Warehouse',    kind: 'warehouse',   team: 't_audience',  region: 'us-east',  product: 'p_audience' },
  { id: 's_capi',      name: 'Conversion API Forwarder', kind: 'api',         team: 't_measure',   region: 'us-east',  product: 'p_adsmgr', feature: 'f_capi' },
  { id: 's_idres',     name: 'Identity Resolution Job',  kind: 'job',         team: null,          region: 'us-east',  product: 'p_insights' },
  { id: 's_msg',       name: 'Messaging Service',        kind: 'service',     team: 't_msg',       region: 'eu-west',  product: 'p_messenger', feature: 'f_e2ee' },
  { id: 's_msgstore',  name: 'Message Store (E2EE)',     kind: 'store',       team: 't_msg',       region: 'eu-west',  product: 'p_messenger', parent: 's_msg' },
  { id: 's_linkprev',  name: 'Link Preview Fetcher',     kind: 'service',     team: 't_msg',       region: 'us-east',  product: 'p_messenger', feature: 'f_linkprev' },
  { id: 's_pulseapi',  name: 'Pulse API',                kind: 'api',         team: 't_pulse',     region: 'eu-central',product: 'p_pulse', feature: 'f_cycle' },
  { id: 's_pulsedb',   name: 'Health Records Store',     kind: 'store',       team: 't_pulse',     region: 'eu-central',product: 'p_pulse', parent: 's_pulseapi' },
  { id: 's_pulsesdk',  name: 'Pulse mobile SDK bundle',  kind: 'sdk',         team: 't_pulse',     region: 'device',   product: 'p_pulse' },
  { id: 's_nova',      name: 'Nova Orchestrator',        kind: 'service',     team: 't_nova',      region: 'us-west',  product: 'p_nova', feature: 'f_rag' },
  { id: 's_novalogs',  name: 'Prompt & Output Logs',     kind: 'log',         team: 't_nova',      region: 'us-west',  product: 'p_nova', parent: 's_nova' },
  { id: 's_novavec',   name: 'Nova Vector Store',        kind: 'vector',      team: 't_nova',      region: 'us-west',  product: 'p_nova', parent: 's_nova' },
  { id: 's_novamem',   name: 'Assistant Memory Store',   kind: 'store',       team: 't_nova',      region: 'us-west',  product: 'p_nova', feature: 'f_memory' },
  { id: 's_supportsvc',name: 'Support Chat Service',     kind: 'service',     team: 't_support',   region: 'eu-west',  product: 'p_help', feature: 'f_chat' },
  { id: 's_browse',    name: 'Browser Telemetry Collector', kind: 'service',  team: 't_browser',   region: 'us-east',  product: 'p_insights', feature: 'f_browse' },
  { id: 's_profile',   name: 'Customer Profile Service', kind: 'service',     team: 't_identity',  region: 'us-east',  product: null },
  { id: 's_consent',   name: 'Consent Service',          kind: 'service',     team: 't_privacy',   region: 'us-east',  product: null },
  { id: 's_delete',    name: 'Deletion Orchestrator',    kind: 'service',     team: 't_privacy',   region: 'us-east',  product: null },
  { id: 's_family',    name: 'Family Accounts Service',  kind: 'service',     team: 't_storefront',region: 'us-east',  product: 'p_storefront', feature: 'f_family' },
  { id: 's_insights',  name: 'Insights DP Release Service', kind: 'service',  team: 't_data',      region: 'eu-west',  product: 'p_insights' },
  { id: 's_mktg',      name: 'Marketing Audience Builder', kind: 'job',       team: 't_audience',  region: 'us-east',  product: 'p_audience' }
];

/* ── Purposes ─────────────────────────────────────────────────── */
var purposes = [
  { id: 'account_security', label: 'Account security' },
  { id: 'fraud_prevention', label: 'Fraud prevention' },
  { id: 'service_delivery', label: 'Service delivery' },
  { id: 'analytics',        label: 'Product analytics' },
  { id: 'personalization',  label: 'Personalisation' },
  { id: 'advertising',      label: 'Advertising' },
  { id: 'research',         label: 'Research' },
  { id: 'customer_support', label: 'Customer support' },
  { id: 'model_training',   label: 'Model training' },
  { id: 'legal_obligation', label: 'Legal obligation' }
];

/* ── Datasets ─────────────────────────────────────────────────────
 * fields: [name, tier(0-4), role]  role: id | qid (quasi-identifier) | attr | derived | inference
 * retention.required/actual in days; null = unknown. ttl: is it machine-enforced?
 * why: the stated reason the data exists (shown at the top of the Passport).  */
var datasets = [
  { id: 'd_txn', name: 'transactions', system: 's_txn', product: 'p_checkout', owner: 't_pay', kind: 'table',
    why: 'Complete a purchase and meet payment-record obligations.',
    subjects: 'Customers', people: 48000000, purposes: ['service_delivery', 'fraud_prevention', 'legal_obligation'],
    fields: [['payment_token', 3, 'id'], ['customer_id', 2, 'id'], ['merchant_id', 1, 'attr'], ['amount', 3, 'attr'], ['ts', 2, 'qid'], ['device_id', 2, 'id'], ['ip_address', 2, 'qid']],
    retention: { required: 2555, actual: 2555, ttl: true }, age: 2555, regions: ['us-east'], encryption: 'AES-256 at rest · field-level on token', keyOwner: 'Payments KMS (t_pay)',
    accessPeople: 23, accessServices: 4, deletion: 'hard delete + legal-hold exception', deletionVerified: true, lastAudit: '2026-08-30', consent: 'not required (contract)' },

  { id: 'd_purchase', name: 'purchase_events', system: 's_bus', product: 'p_checkout', owner: 't_data', kind: 'topic',
    why: 'Order analytics and downstream fraud features.',
    subjects: 'Customers', people: 48000000, purposes: ['analytics', 'fraud_prevention'],
    fields: [['customer_id', 2, 'id'], ['device_id', 2, 'id'], ['sku', 1, 'attr'], ['cart_value', 3, 'attr'], ['geo_city', 2, 'qid'], ['precise_lat', 3, 'qid'], ['precise_lon', 3, 'qid'], ['page_url', 2, 'attr']],
    retention: { required: 90, actual: 400, ttl: false }, age: 400, regions: ['us-east'], encryption: 'TLS in transit · broker at rest', keyOwner: 'Platform KMS',
    accessPeople: 140, accessServices: 11, deletion: 'topic compaction (customer_id key)', deletionVerified: false, lastAudit: '2026-03-12', consent: 'analytics consent (checked at collection only)' },

  { id: 'd_orders_wh', name: 'wh.orders_enriched', system: 's_wh', product: 'p_insights', owner: 't_data', kind: 'table',
    why: 'Revenue reporting and merchandising analysis.',
    subjects: 'Customers', people: 48000000, purposes: ['analytics'],
    fields: [['customer_id', 2, 'id'], ['device_id', 2, 'id'], ['order_total', 3, 'attr'], ['category', 1, 'attr'], ['geo_city', 2, 'qid'], ['age_band', 2, 'derived'], ['likely_parent', 3, 'inference']],
    retention: { required: 730, actual: 1460, ttl: false }, age: 1460, regions: ['us-east'], encryption: 'warehouse default', keyOwner: 'Cloud provider managed',
    accessPeople: 612, accessServices: 19, deletion: 'nightly delete-by-id job', deletionVerified: false, lastAudit: '2025-11-04', consent: 'none checked at read' },

  { id: 'd_fraudfeat', name: 'fraud_features_v7', system: 's_fraudfs', product: 'p_checkout', owner: 't_fraud', kind: 'feature table',
    why: 'Score transactions for fraud in real time.',
    subjects: 'Customers', people: 48000000, purposes: ['fraud_prevention'],
    fields: [['customer_id', 2, 'id'], ['device_id', 2, 'id'], ['velocity_24h', 2, 'derived'], ['ip_risk', 2, 'derived'], ['geo_mismatch', 3, 'derived'], ['account_age_days', 2, 'derived'], ['device_fingerprint', 2, 'id']],
    retention: { required: 180, actual: 180, ttl: true }, age: 180, regions: ['us-east'], encryption: 'AES-256', keyOwner: 'Fraud KMS (t_fraud)',
    accessPeople: 18, accessServices: 3, deletion: 'feature TTL + delete-by-id', deletionVerified: true, lastAudit: '2026-07-19', consent: 'not required (legitimate interest: fraud)' },

  { id: 'd_lochist', name: 'customer_location_history', system: 's_lochist', product: 'p_storefront', owner: 't_location', kind: 'table',
    why: 'Suggest the nearest pickup point at checkout.',
    subjects: 'App users with location on', people: 26000000, purposes: ['service_delivery'],
    fields: [['customer_id', 2, 'id'], ['lat', 3, 'qid'], ['lon', 3, 'qid'], ['accuracy_m', 2, 'attr'], ['ts', 2, 'qid'], ['home_cluster', 3, 'inference'], ['work_cluster', 3, 'inference']],
    retention: { required: 30, actual: 547, ttl: false }, age: 547, regions: ['us-east', 'eu-west'], encryption: 'AES-256 at rest', keyOwner: 'Platform KMS',
    accessPeople: 41, accessServices: 7, deletion: 'soft delete flag', deletionVerified: false, lastAudit: '2025-12-02', consent: 'location permission (OS) + in-app toggle' },

  { id: 'd_profile', name: 'customer_profile', system: 's_profile', product: null, owner: 't_identity', kind: 'table',
    why: 'Operate the account: sign-in, contact, shipping.',
    subjects: 'All account holders', people: 212000000, purposes: ['service_delivery', 'account_security'],
    fields: [['customer_id', 2, 'id'], ['email', 2, 'id'], ['phone', 2, 'id'], ['full_name', 2, 'id'], ['address', 3, 'qid'], ['dob', 2, 'qid'], ['loyalty_id', 2, 'id']],
    retention: { required: null, actual: 3650, ttl: false }, age: 3650, regions: ['us-east', 'eu-west'], encryption: 'AES-256 · email/phone tokenised in logs', keyOwner: 'Identity KMS',
    accessPeople: 88, accessServices: 27, deletion: 'deletion orchestrator (primary)', deletionVerified: true, lastAudit: '2026-09-01', consent: 'not required (contract)' },

  { id: 'd_phone2fa', name: 'mfa_phone_numbers', system: 's_profile', product: null, owner: 't_identity', kind: 'table',
    why: 'Second factor and account recovery.',
    subjects: 'Account holders with 2FA', people: 71000000, purposes: ['account_security'],
    fields: [['customer_id', 2, 'id'], ['phone', 2, 'id'], ['verified_at', 1, 'attr']],
    retention: { required: 0, actual: 0, ttl: true, note: 'lives while 2FA is enabled' }, age: 1900, regions: ['us-east'], encryption: 'AES-256', keyOwner: 'Identity KMS',
    accessPeople: 9, accessServices: 5, deletion: 'removed when 2FA disabled', deletionVerified: true, lastAudit: '2026-06-10', consent: 'not required (security)' },

  { id: 'd_audience', name: 'audience_segments', system: 's_adswh', product: 'p_audience', owner: 't_audience', kind: 'table',
    why: 'Build advertiser audiences from first-party signals.',
    subjects: 'Customers and ad viewers', people: 120000000, purposes: ['advertising'],
    fields: [['maid', 2, 'id'], ['hashed_email', 2, 'id'], ['device_id', 2, 'id'], ['segment', 2, 'derived'], ['fraud_score_band', 2, 'derived'], ['phone_hash', 2, 'id'], ['interest_health', 4, 'inference']],
    retention: { required: 390, actual: 390, ttl: true }, age: 390, regions: ['us-east'], encryption: 'warehouse default', keyOwner: 'Cloud provider managed',
    accessPeople: 57, accessServices: 6, deletion: 'segment rebuild (weekly)', deletionVerified: false, lastAudit: '2026-02-20', consent: 'advertising consent (checked nightly)' },

  { id: 'd_adsevents', name: 'ad_events', system: 's_adswh', product: 'p_adsmgr', owner: 't_measure', kind: 'table',
    why: 'Measure ad delivery and conversions for advertisers.',
    subjects: 'Ad viewers', people: 150000000, purposes: ['advertising', 'analytics'],
    fields: [['maid', 2, 'id'], ['device_id', 2, 'id'], ['ip_address', 2, 'qid'], ['user_agent', 1, 'qid'], ['campaign_id', 1, 'attr'], ['conversion_value', 2, 'attr']],
    retention: { required: 395, actual: 395, ttl: true }, age: 395, regions: ['us-east'], encryption: 'warehouse default', keyOwner: 'Cloud provider managed',
    accessPeople: 73, accessServices: 5, deletion: 'partition expiry', deletionVerified: true, lastAudit: '2026-05-14', consent: 'advertising consent (checked at collection)' },

  { id: 'd_pulsecycle', name: 'pulse_cycle_logs', system: 's_pulsedb', product: 'p_pulse', owner: 't_pulse', kind: 'table',
    why: 'Show a person their own cycle predictions.',
    subjects: 'Pulse users who opt in', people: 3100000, purposes: ['service_delivery'],
    fields: [['pulse_user_id', 2, 'id'], ['cycle_day', 4, 'attr'], ['symptoms', 4, 'attr'], ['notes', 4, 'attr'], ['pregnancy_flag', 4, 'inference']],
    retention: { required: 365, actual: 365, ttl: true }, age: 365, regions: ['eu-central'], encryption: 'per-user keys (crypto-shredding)', keyOwner: 'Pulse HSM (t_pulse)',
    accessPeople: 4, accessServices: 1, deletion: 'crypto-shredding', deletionVerified: true, lastAudit: '2026-09-10', consent: 'explicit health consent (checked at read)' },

  { id: 'd_pulseinstall', name: 'pulse_install_telemetry', system: 's_pulsesdk', product: 'p_pulse', owner: null, kind: 'SDK stream',
    why: 'Crash and install analytics.',
    subjects: 'Pulse app installs', people: 9200000, purposes: ['analytics'],
    fields: [['device_id', 2, 'id'], ['maid', 2, 'id'], ['app_screen', 4, 'attr'], ['os_version', 1, 'attr']],
    retention: { required: null, actual: null, ttl: false }, age: null, regions: ['us-east'], encryption: 'TLS', keyOwner: 'unknown',
    accessPeople: null, accessServices: 3, deletion: 'unknown', deletionVerified: false, lastAudit: null, consent: 'unknown' },

  { id: 'd_heart', name: 'heart_rate_series', system: 's_pulsedb', product: 'p_pulse', owner: 't_pulse', kind: 'table',
    why: 'Resting-heart-rate trends, computed on device; server holds weekly aggregates only.',
    subjects: 'Pulse wearable users', people: 5400000, purposes: ['service_delivery'],
    fields: [['pulse_user_id', 2, 'id'], ['weekly_rhr', 4, 'derived']],
    retention: { required: 730, actual: 730, ttl: true }, age: 730, regions: ['eu-central'], encryption: 'per-user keys', keyOwner: 'Pulse HSM (t_pulse)',
    accessPeople: 3, accessServices: 1, deletion: 'crypto-shredding', deletionVerified: true, lastAudit: '2026-09-10', consent: 'explicit health consent (checked at read)' },

  { id: 'd_msgmeta', name: 'message_metadata', system: 's_msgstore', product: 'p_messenger', owner: 't_msg', kind: 'table',
    why: 'Deliver messages and enforce abuse rate limits. Content is end-to-end encrypted and never readable by Northstar.',
    subjects: 'Messenger users', people: 64000000, purposes: ['service_delivery', 'account_security'],
    fields: [['sender_pseudonym', 2, 'id'], ['recipient_pseudonym', 2, 'id'], ['ts_bucket', 2, 'qid'], ['size_bucket', 1, 'attr']],
    retention: { required: 30, actual: 30, ttl: true }, age: 30, regions: ['eu-west'], encryption: 'E2EE content · metadata AES-256', keyOwner: 'Devices (content) · Msg KMS (metadata)',
    accessPeople: 6, accessServices: 2, deletion: 'TTL', deletionVerified: true, lastAudit: '2026-09-15', consent: 'not required (contract)' },

  { id: 'd_linklogs', name: 'link_preview_fetch_logs', system: 's_linkprev', product: 'p_messenger', owner: 't_msg', kind: 'log',
    why: 'Debug link-preview failures.',
    subjects: 'Messenger users who share links', people: 38000000, purposes: ['service_delivery'],
    fields: [['full_url', 3, 'attr'], ['sender_pseudonym', 2, 'id'], ['ip_address', 2, 'qid'], ['ts', 2, 'qid']],
    retention: { required: 14, actual: 180, ttl: false }, age: 180, regions: ['us-east'], encryption: 'log platform default', keyOwner: 'Platform KMS',
    accessPeople: 310, accessServices: 2, deletion: 'log rotation (misconfigured)', deletionVerified: false, lastAudit: '2025-10-01', consent: 'n/a' },

  { id: 'd_prompts', name: 'nova_prompt_output_logs', system: 's_novalogs', product: 'p_nova', owner: 't_nova', kind: 'log',
    why: 'Debug and evaluate assistant quality.',
    subjects: 'Nova users', people: 22000000, purposes: ['service_delivery', 'model_training'],
    fields: [['user_id', 2, 'id'], ['prompt_text', 3, 'attr'], ['output_text', 3, 'attr'], ['retrieved_doc_ids', 2, 'attr'], ['health_mentions', 4, 'inference']],
    retention: { required: 30, actual: 400, ttl: false }, age: 400, regions: ['us-west'], encryption: 'AES-256', keyOwner: 'Platform KMS',
    accessPeople: 64, accessServices: 4, deletion: 'none for logs', deletionVerified: false, lastAudit: '2026-04-02', consent: 'ToS only' },

  { id: 'd_novavec', name: 'nova_workspace_embeddings', system: 's_novavec', product: 'p_nova', owner: 't_nova', kind: 'vector index',
    why: 'Retrieve the user\'s own documents to ground answers.',
    subjects: 'Nova workspace users', people: 6100000, purposes: ['service_delivery'],
    fields: [['tenant_id', 1, 'id'], ['user_id', 2, 'id'], ['chunk_embedding', 3, 'derived'], ['chunk_text', 3, 'attr'], ['acl', 1, 'attr']],
    retention: { required: 0, actual: 0, ttl: false, note: 'lives with source document' }, age: 610, regions: ['us-west'], encryption: 'AES-256', keyOwner: 'Nova KMS',
    accessPeople: 12, accessServices: 2, deletion: 'delete on source delete (unverified for chunks)', deletionVerified: false, lastAudit: '2026-06-22', consent: 'workspace admin' },

  { id: 'd_novamem', name: 'assistant_memories', system: 's_novamem', product: 'p_nova', owner: 't_nova', kind: 'table',
    why: 'Let the assistant remember preferences the user asked it to remember.',
    subjects: 'Nova users who enable memory', people: 0, purposes: ['personalization'],
    fields: [['user_id', 2, 'id'], ['memory_text', 3, 'attr'], ['source_conversation', 2, 'attr']],
    retention: { required: null, actual: null, ttl: false }, age: 0, regions: ['us-west'], encryption: 'AES-256', keyOwner: 'Nova KMS',
    accessPeople: 0, accessServices: 1, deletion: 'user-visible delete (planned)', deletionVerified: false, lastAudit: null, consent: 'opt-in (planned)' },

  { id: 'd_transcripts', name: 'support_chat_transcripts', system: 's_supportsvc', product: 'p_help', owner: 't_support', kind: 'table',
    why: 'Resolve support cases and train agents.',
    subjects: 'Customers who contact support', people: 17000000, purposes: ['customer_support', 'model_training'],
    fields: [['customer_id', 2, 'id'], ['email', 2, 'id'], ['transcript', 3, 'attr'], ['order_id', 1, 'attr'], ['sentiment', 2, 'inference']],
    retention: { required: 365, actual: 365, ttl: true }, age: 365, regions: ['eu-west'], encryption: 'AES-256', keyOwner: 'Support KMS',
    accessPeople: 940, accessServices: 3, deletion: 'deletion orchestrator + vendor API', deletionVerified: false, lastAudit: '2026-07-08', consent: 'not required (contract)' },

  { id: 'd_browse', name: 'browser_usage_events', system: 's_browse', product: 'p_insights', owner: 't_browser', kind: 'stream',
    why: 'Understand which features of the Northstar browser extension are used.',
    subjects: 'Extension users', people: 2400000, purposes: ['analytics'],
    fields: [['account_id', 2, 'id'], ['full_url', 3, 'attr'], ['page_title', 3, 'attr'], ['feature_used', 1, 'attr'], ['ts', 2, 'qid']],
    retention: { required: 90, actual: 90, ttl: true }, age: 64, regions: ['us-east'], encryption: 'TLS', keyOwner: 'Platform KMS',
    accessPeople: 22, accessServices: 2, deletion: 'TTL', deletionVerified: true, lastAudit: null, consent: 'analytics consent' },

  { id: 'd_applogs', name: 'gateway_request_logs', system: 's_logs', product: null, owner: 't_sre', kind: 'log',
    why: 'Debug and trace production requests.',
    subjects: 'All users', people: 212000000, purposes: ['service_delivery'],
    fields: [['request_url', 2, 'attr'], ['email_in_query', 2, 'id'], ['ip_address', 2, 'qid'], ['user_agent', 1, 'qid'], ['auth_subject', 2, 'id']],
    retention: { required: 30, actual: 395, ttl: false }, age: 395, regions: ['us-east'], encryption: 'log platform default', keyOwner: 'Platform KMS',
    accessPeople: 1200, accessServices: 6, deletion: 'rotation only', deletionVerified: false, lastAudit: '2025-09-18', consent: 'n/a' },

  { id: 'd_family', name: 'family_members', system: 's_family', product: 'p_storefront', owner: 't_storefront', kind: 'table',
    why: 'Let a parent add children to a shared household account.',
    subjects: 'Parents and children under 13', people: 3800000, purposes: ['service_delivery'],
    fields: [['household_id', 2, 'id'], ['child_first_name', 4, 'id'], ['child_dob', 4, 'qid'], ['parent_customer_id', 2, 'id']],
    retention: { required: 0, actual: 0, ttl: false, note: 'while household exists' }, age: 1200, regions: ['us-east'], encryption: 'AES-256', keyOwner: 'Identity KMS',
    accessPeople: 15, accessServices: 4, deletion: 'deletion orchestrator', deletionVerified: true, lastAudit: '2026-08-11', consent: 'verifiable parental consent' },

  { id: 'd_identity_graph', name: 'identity_graph_edges', system: 's_idres', product: 'p_insights', owner: null, kind: 'table',
    why: 'We may need a unified customer view someday.',
    subjects: 'Everyone Northstar can link', people: 180000000, purposes: [],
    fields: [['customer_id', 2, 'id'], ['device_id', 2, 'id'], ['maid', 2, 'id'], ['hashed_email', 2, 'id'], ['pulse_user_id', 2, 'id'], ['cookie_id', 2, 'id'], ['match_confidence', 1, 'derived']],
    retention: { required: null, actual: null, ttl: false }, age: 820, regions: ['us-east'], encryption: 'warehouse default', keyOwner: 'Cloud provider managed',
    accessPeople: 212, accessServices: 9, deletion: 'unknown', deletionVerified: false, lastAudit: null, consent: 'unknown' },

  { id: 'd_backup', name: 'core_snapshots', system: 's_backup', product: null, owner: 't_sre', kind: 'bucket',
    why: 'Disaster recovery.',
    subjects: 'All users', people: 212000000, purposes: ['service_delivery'],
    fields: [['full_db_snapshot', 3, 'attr']],
    retention: { required: 35, actual: 35, ttl: true }, age: 35, regions: ['us-west'], encryption: 'AES-256 · separate backup keys', keyOwner: 'Backup KMS (t_sre)',
    accessPeople: 5, accessServices: 1, deletion: 'expiry (35d) · deleted users re-applied on restore', deletionVerified: true, lastAudit: '2026-09-03', consent: 'n/a' },

  { id: 'd_search', name: 'search_query_index', system: 's_search', product: 'p_storefront', owner: 't_storefront', kind: 'index',
    why: 'Personalise search ranking from recent queries.',
    subjects: 'Storefront searchers', people: 91000000, purposes: ['personalization'],
    fields: [['customer_id', 2, 'id'], ['query_text', 3, 'attr'], ['clicked_sku', 1, 'attr']],
    retention: { required: 90, actual: 90, ttl: true }, age: 90, regions: ['us-west'], encryption: 'AES-256', keyOwner: 'Platform KMS',
    accessPeople: 30, accessServices: 3, deletion: 'reindex on delete', deletionVerified: false, lastAudit: '2026-05-30', consent: 'personalisation consent (checked at read)' },

  { id: 'd_dpstats', name: 'insights_public_stats', system: 's_insights', product: 'p_insights', owner: 't_data', kind: 'release',
    why: 'Publish city-level shopping trends without exposing individuals.',
    subjects: 'Aggregates over customers', people: 48000000, purposes: ['research'],
    fields: [['city', 0, 'attr'], ['category', 0, 'attr'], ['noisy_count', 0, 'derived']],
    retention: { required: 3650, actual: 3650, ttl: true }, age: 200, regions: ['eu-west'], encryption: 'public', keyOwner: 'n/a',
    accessPeople: 0, accessServices: 1, deletion: 'n/a (aggregate)', deletionVerified: true, lastAudit: '2026-09-12', consent: 'n/a' }
];

/* ── Identifiers ─────────────────────────────────────────────── */
var identifiers = [
  { id: 'i_email',     name: 'Email',               cls: 'GLOBAL DURABLE', lifespan: 'years', note: 'Known outside Northstar; joins to any partner.' },
  { id: 'i_customer',  name: 'Customer / Account ID', cls: 'GLOBAL DURABLE', lifespan: 'account lifetime', note: 'Internal but used by every product.' },
  { id: 'i_phone',     name: 'Phone number',        cls: 'GLOBAL DURABLE', lifespan: 'years', note: 'Collected for 2FA; also a marketing match key.' },
  { id: 'i_device',    name: 'Device ID',           cls: 'CROSS-APP',      lifespan: 'device lifetime', note: 'Shared by every Northstar app on a device.' },
  { id: 'i_maid',      name: 'Advertising ID (MAID)', cls: 'CROSS-APP',    lifespan: 'until user resets', note: 'Resettable, but rarely reset.' },
  { id: 'i_cookie',    name: 'ns_uid cookie',       cls: 'CROSS-APP',      lifespan: '400 days', note: 'First-party cookie reused across web properties.' },
  { id: 'i_ip',        name: 'IP address',          cls: 'ROTATING',       lifespan: 'hours–months', note: 'Quasi-identifier; household-level.' },
  { id: 'i_hemail',    name: 'Hashed email',        cls: 'GLOBAL DURABLE', lifespan: 'years', note: 'Hashing is not anonymisation: same input, same hash, everywhere.' },
  { id: 'i_token',     name: 'Payment token',       cls: 'PER-VENDOR',     lifespan: 'card lifetime', note: 'Only meaningful to Vaultline.' },
  { id: 'i_loyalty',   name: 'Loyalty ID',          cls: 'GLOBAL DURABLE', lifespan: 'years', note: 'Printed on receipts; shared with partner stores.' },
  { id: 'i_pulse',     name: 'Pulse user ID',       cls: 'PURPOSE-SCOPED', lifespan: 'account lifetime', note: 'Designed as purpose-scoped. The identity graph joins it anyway.' },
  { id: 'i_fp',        name: 'Device fingerprint',  cls: 'CROSS-APP',      lifespan: 'weeks–months', note: 'Fraud signal. Must never leave fraud_prevention.' },
  { id: 'i_msgpseudo', name: 'Messenger pseudonym', cls: 'PURPOSE-SCOPED', lifespan: 'rotates yearly', note: 'Good pattern: no join key to commerce.' },
  { id: 'i_session',   name: 'Session ID',          cls: 'EPHEMERAL',      lifespan: '30 minutes', note: 'Good pattern.' },
  { id: 'i_convo',     name: 'Nova conversation ID',cls: 'ROTATING',       lifespan: 'per conversation', note: 'Rotates, but logs carry user_id beside it.' }
];

/* Joins between identifiers: [a, b, where, how, sanctioned] */
var idJoins = [
  ['i_customer', 'i_email',   's_profile',  'profile row',                 true],
  ['i_customer', 'i_phone',   's_profile',  'profile row',                 true],
  ['i_customer', 'i_device',  's_payment',  'transaction record',          true],
  ['i_customer', 'i_token',   's_txn',      'transaction record',          true],
  ['i_customer', 'i_loyalty', 's_profile',  'profile row',                 true],
  ['i_device',   'i_maid',    's_adswh',    'SDK install beacon',          true],
  ['i_device',   'i_fp',      's_fraudfs',  'fraud feature row',           true],
  ['i_email',    'i_hemail',  's_capi',     'SHA-256 at forwarder',        true],
  ['i_customer', 'i_maid',    's_idres',    'probabilistic match (IP + time)', false],
  ['i_pulse',    'i_device',  's_idres',    'install telemetry join',      false],
  ['i_pulse',    'i_maid',    's_pulsesdk', 'SDK sends both in one beacon',false],
  ['i_cookie',   'i_customer','s_idres',    'login stitching',             false],
  ['i_phone',    'i_maid',    's_mktg',     'phone_hash match for ads',    false],
  ['i_fp',       'i_maid',    's_mktg',     'fraud features reused in audiences', false],
  ['i_customer', 'i_convo',   's_novalogs', 'logged side by side',         false],
  ['i_ip',       'i_customer','s_logs',     'request log',                 true],
  ['i_msgpseudo','i_customer',null,         'no join path (by design)',    true],
  ['i_session',  'i_customer','s_gateway',  'auth session',                true]
];

/* ── Vendors / processors / partners ─────────────────────────── */
var vendors = [
  { id: 'v_clearsight', name: 'Clearsight Analytics', role: 'Web analytics processor', region: 'us', declared: true,
    data: ['full_url', 'account_id', 'page_title'], identifiers: ['i_customer'], tier: 3, people: 2400000, frequency: 'streaming',
    retention: { contract: 90, actual: 400 }, subprocessors: ['sp_cloudhost_us', 'sp_unknown_1'], contract: { signed: '2024-03-01', expires: '2027-03-01', dpa: true },
    deletionApi: false, securityReview: '2025-11-02', privacyReview: null, consentDep: 'analytics', optOutPropagates: false, attestation: null, lastAudit: null, purpose: 'analytics' },
  { id: 'v_adreach', name: 'AdReach Network', role: 'Advertising partner', region: 'us', declared: true,
    data: ['hashed_email', 'maid', 'conversion_value', 'segment'], identifiers: ['i_hemail', 'i_maid'], tier: 2, people: 120000000, frequency: 'hourly batch + CAPI',
    retention: { contract: 180, actual: 180 }, subprocessors: ['sp_cloudhost_us', 'sp_datamatch'], contract: { signed: '2023-06-15', expires: '2026-12-31', dpa: true },
    deletionApi: true, securityReview: '2026-01-10', privacyReview: '2026-01-22', consentDep: 'advertising', optOutPropagates: false, attestation: '2026-06-30', lastAudit: '2026-06-30', purpose: 'advertising' },
  { id: 'v_parcelry', name: 'Parcelry', role: 'Shipping processor', region: 'us', declared: true,
    data: ['full_name', 'address', 'phone'], identifiers: ['i_phone'], tier: 3, people: 41000000, frequency: 'per order',
    retention: { contract: 90, actual: 90 }, subprocessors: ['sp_cloudhost_us'], contract: { signed: '2022-02-01', expires: '2027-02-01', dpa: true },
    deletionApi: true, securityReview: '2026-04-01', privacyReview: '2026-04-09', consentDep: null, optOutPropagates: true, attestation: '2026-08-31', lastAudit: '2026-08-31', purpose: 'service_delivery' },
  { id: 'v_helphub', name: 'HelpHub CRM', role: 'Support CRM processor', region: 'eu', declared: true,
    data: ['email', 'transcript', 'order_id', 'customer_id'], identifiers: ['i_email', 'i_customer'], tier: 3, people: 17000000, frequency: 'real time',
    retention: { contract: 30, actual: 365 }, subprocessors: ['sp_cloudhost_eu', 'sp_llmco'], contract: { signed: '2024-09-01', expires: '2027-09-01', dpa: true },
    deletionApi: true, securityReview: '2026-02-12', privacyReview: '2026-02-20', consentDep: null, optOutPropagates: true, attestation: null, lastAudit: '2026-02-20', purpose: 'customer_support' },
  { id: 'v_vaultline', name: 'Vaultline', role: 'Payment processor', region: 'us', declared: true,
    data: ['card_pan', 'payment_token'], identifiers: ['i_token'], tier: 3, people: 48000000, frequency: 'per transaction',
    retention: { contract: 2555, actual: 2555 }, subprocessors: [], contract: { signed: '2021-01-01', expires: '2028-01-01', dpa: true },
    deletionApi: true, securityReview: '2026-07-01', privacyReview: '2026-07-01', consentDep: null, optOutPropagates: true, attestation: '2026-07-01', lastAudit: '2026-07-01', purpose: 'service_delivery' },
  { id: 'v_signalrisk', name: 'SignalRisk', role: 'Fraud intelligence processor', region: 'us', declared: true,
    data: ['device_fingerprint', 'ip_address', 'email'], identifiers: ['i_fp', 'i_email'], tier: 2, people: 48000000, frequency: 'per transaction',
    retention: { contract: 30, actual: 30 }, subprocessors: ['sp_cloudhost_us'], contract: { signed: '2025-05-01', expires: '2027-05-01', dpa: true },
    deletionApi: true, securityReview: '2026-05-01', privacyReview: '2026-05-06', consentDep: null, optOutPropagates: true, attestation: '2026-05-06', lastAudit: '2026-05-06', purpose: 'fraud_prevention' },
  { id: 'v_mailpost', name: 'MailPost', role: 'Email delivery processor', region: 'us', declared: true,
    data: ['email', 'first_name'], identifiers: ['i_email'], tier: 2, people: 150000000, frequency: 'per send',
    retention: { contract: 30, actual: 30 }, subprocessors: ['sp_cloudhost_us'], contract: { signed: '2023-01-01', expires: '2026-10-15', dpa: true },
    deletionApi: true, securityReview: '2025-12-01', privacyReview: '2025-12-01', consentDep: 'marketing email', optOutPropagates: true, attestation: '2026-03-31', lastAudit: '2026-03-31', purpose: 'service_delivery' },
  { id: 'v_lumen', name: 'Lumen Model API', role: 'Third-party LLM provider', region: 'us', declared: true,
    data: ['prompt_text', 'retrieved_chunks'], identifiers: [], tier: 3, people: 22000000, frequency: 'per request',
    retention: { contract: 0, actual: 30 }, subprocessors: ['sp_cloudhost_us'], contract: { signed: '2025-08-01', expires: '2027-08-01', dpa: true, noTraining: true },
    deletionApi: false, securityReview: '2025-08-01', privacyReview: '2025-08-10', consentDep: null, optOutPropagates: true, attestation: '2026-02-01', lastAudit: '2026-02-01', purpose: 'service_delivery' },
  { id: 'v_pixelpeak', name: 'PixelPeak', role: 'Ad pixel (arrived via SDK)', region: 'us', declared: false,
    data: ['page_url', 'order_value', 'hashed_email'], identifiers: ['i_hemail', 'i_cookie'], tier: 2, people: 48000000, frequency: 'per page view',
    retention: { contract: null, actual: null }, subprocessors: ['sp_unknown_2'], contract: null,
    deletionApi: false, securityReview: null, privacyReview: null, consentDep: 'advertising', optOutPropagates: false, attestation: null, lastAudit: null, purpose: 'advertising' },
  { id: 'v_geogrid', name: 'GeoGrid SDK', role: 'Location SDK', region: 'us', declared: false,
    data: ['lat', 'lon', 'maid'], identifiers: ['i_maid'], tier: 3, people: 26000000, frequency: 'background, every 15 min',
    retention: { contract: null, actual: null }, subprocessors: ['sp_unknown_3'], contract: null,
    deletionApi: false, securityReview: null, privacyReview: null, consentDep: 'location', optOutPropagates: false, attestation: null, lastAudit: null, purpose: 'unknown' },
  { id: 'v_surveyloop', name: 'SurveyLoop', role: 'Survey tool', region: 'eu', declared: true,
    data: ['email', 'responses'], identifiers: ['i_email'], tier: 2, people: 410000, frequency: 'campaign',
    retention: { contract: 180, actual: 180 }, subprocessors: ['sp_cloudhost_eu'], contract: { signed: '2023-09-01', expires: '2026-09-01', dpa: true },
    deletionApi: false, securityReview: '2024-08-20', privacyReview: '2024-08-28', consentDep: null, optOutPropagates: true, attestation: null, lastAudit: '2024-08-28', purpose: 'research' },
  { id: 'v_cloudhost', name: 'CloudHost', role: 'Infrastructure processor', region: 'us', declared: true,
    data: ['all hosted data (encrypted)'], identifiers: [], tier: 4, people: 212000000, frequency: 'continuous',
    retention: { contract: 0, actual: 0 }, subprocessors: [], contract: { signed: '2020-01-01', expires: '2029-01-01', dpa: true },
    deletionApi: true, securityReview: '2026-06-01', privacyReview: '2026-06-01', consentDep: null, optOutPropagates: true, attestation: '2026-06-01', lastAudit: '2026-06-01', purpose: 'service_delivery' }
];

var subprocessors = [
  { id: 'sp_cloudhost_us', name: 'CloudHost (US)', region: 'us', known: true },
  { id: 'sp_cloudhost_eu', name: 'CloudHost (EU)', region: 'eu', known: true },
  { id: 'sp_datamatch',    name: 'DataMatch Onboarding', region: 'us', known: true },
  { id: 'sp_llmco',        name: 'LLMCo summariser', region: 'us', known: true },
  { id: 'sp_unknown_1',    name: 'Unlisted subprocessor', region: 'unknown', known: false },
  { id: 'sp_unknown_2',    name: 'Unlisted ad exchange', region: 'unknown', known: false },
  { id: 'sp_unknown_3',    name: 'Unlisted data buyer', region: 'unknown', known: false }
];

/* ── Data flows: every arrow is a privacy object ──────────────────
 * boundary: internal | trust (crosses a trust boundary inside Northstar) |
 *           third_party | device
 * status: reviewed | unreviewed | unknown                               */
var flows = [
  { id: 'fl01', from: 'n_app', to: 's_gateway', fields: ['customer_id', 'device_id', 'cart', 'lat/lon'], identifier: 'i_device', tier: 3, purpose: 'service_delivery', consent: 'n/a', enc: 'TLS 1.3', boundary: 'device', regionFrom: 'user', regionTo: 'us-east', retention: 'none (transit)', owner: 't_sre', recipient: 'Northstar', control: 'c_tls', status: 'reviewed', deletion: 'n/a' },
  { id: 'fl02', from: 's_gateway', to: 's_checkout', fields: ['customer_id', 'cart'], identifier: 'i_customer', tier: 2, purpose: 'service_delivery', consent: 'n/a', enc: 'mTLS', boundary: 'internal', regionFrom: 'us-east', regionTo: 'us-east', retention: 'none', owner: 't_checkout', recipient: 'Checkout Service', control: 'c_mtls', status: 'reviewed', deletion: 'n/a' },
  { id: 'fl03', from: 's_checkout', to: 's_payment', fields: ['customer_id', 'amount', 'device_id'], identifier: 'i_customer', tier: 3, purpose: 'service_delivery', consent: 'n/a', enc: 'mTLS', boundary: 'internal', regionFrom: 'us-east', regionTo: 'us-east', retention: 'none', owner: 't_pay', recipient: 'Payment Service', control: 'c_mtls', status: 'reviewed', deletion: 'n/a' },
  { id: 'fl04', from: 's_payment', to: 'v_vaultline', fields: ['card_pan → token'], identifier: 'i_token', tier: 3, purpose: 'service_delivery', consent: 'n/a', enc: 'mTLS + field encryption', boundary: 'third_party', regionFrom: 'us-east', regionTo: 'us', retention: '7 years (contract)', owner: 't_pay', recipient: 'Vaultline', control: 'c_tokenise', status: 'reviewed', deletion: 'vendor API · attested', contract: 'DPA 2021' },
  { id: 'fl05', from: 's_checkout', to: 's_bus', fields: ['customer_id', 'device_id', 'sku', 'cart_value', 'geo_city', 'precise_lat', 'precise_lon', 'page_url'], identifier: 'i_device', tier: 3, purpose: 'analytics', consent: 'analytics (at collection only)', enc: 'TLS', boundary: 'trust', regionFrom: 'us-east', regionTo: 'us-east', retention: '400d (should be 90d)', owner: 't_data', recipient: 'Event Bus', control: 'c_schema', status: 'reviewed', deletion: 'compaction only', flags: ['new_field'] },
  { id: 'fl06', from: 's_bus', to: 's_wh', fields: ['all purchase_events fields'], identifier: 'i_device', tier: 3, purpose: 'analytics', consent: 'not re-checked', enc: 'TLS', boundary: 'internal', regionFrom: 'us-east', regionTo: 'us-east', retention: '4 years', owner: 't_data', recipient: 'Core Warehouse', control: 'c_ttl_wh', status: 'reviewed', deletion: 'nightly delete-by-id (unverified)' },
  { id: 'fl07', from: 's_checkout', to: 's_fraudsvc', fields: ['customer_id', 'device_fingerprint', 'ip_address'], identifier: 'i_fp', tier: 2, purpose: 'fraud_prevention', consent: 'n/a (legitimate interest)', enc: 'mTLS', boundary: 'internal', regionFrom: 'us-east', regionTo: 'us-east', retention: 'none', owner: 't_fraud', recipient: 'Fraud Service', control: 'c_mtls', status: 'reviewed', deletion: 'n/a' },
  { id: 'fl08', from: 's_fraudsvc', to: 's_fraudfs', fields: ['velocity_24h', 'ip_risk', 'geo_mismatch', 'device_fingerprint'], identifier: 'i_fp', tier: 3, purpose: 'fraud_prevention', consent: 'n/a', enc: 'AES-256', boundary: 'internal', regionFrom: 'us-east', regionTo: 'us-east', retention: '180d TTL', owner: 't_fraud', recipient: 'Fraud Feature Store', control: 'c_ttl_fs', status: 'reviewed', deletion: 'TTL + delete-by-id · verified' },
  { id: 'fl09', from: 's_fraudfs', to: 'mdl_fraud', fields: ['fraud_features_v7'], identifier: 'i_customer', tier: 3, purpose: 'fraud_prevention', consent: 'n/a', enc: 'internal', boundary: 'internal', regionFrom: 'us-east', regionTo: 'us-east', retention: 'training snapshot 90d', owner: 't_fraud', recipient: 'Fraud Model', control: 'c_purpose_fs', status: 'reviewed', deletion: 'retrain monthly' },
  { id: 'fl10', from: 's_fraudfs', to: 's_mktg', fields: ['customer_id', 'device_fingerprint', 'fraud_score_band'], identifier: 'i_fp', tier: 3, purpose: 'advertising', consent: 'advertising (nightly)', enc: 'internal', boundary: 'trust', regionFrom: 'us-east', regionTo: 'us-east', retention: '390d', owner: null, recipient: 'Marketing Audience Builder', control: null, status: 'unreviewed', deletion: 'segment rebuild', flags: ['purpose_change', 'identity_join'] },
  { id: 'fl11', from: 's_mktg', to: 'v_adreach', fields: ['hashed_email', 'maid', 'segment', 'fraud_score_band'], identifier: 'i_hemail', tier: 2, purpose: 'advertising', consent: 'advertising (nightly)', enc: 'SFTP + PGP', boundary: 'third_party', regionFrom: 'us-east', regionTo: 'us', retention: '180d (contract)', owner: 't_audience', recipient: 'AdReach Network', control: 'c_consent_batch', status: 'reviewed', deletion: 'vendor API · opt-out not propagated', contract: 'DPA 2023 · expires 2026-12-31' },
  { id: 'fl12', from: 's_location', to: 's_lochist', fields: ['customer_id', 'lat', 'lon', 'accuracy_m'], identifier: 'i_customer', tier: 3, purpose: 'service_delivery', consent: 'location toggle', enc: 'AES-256', boundary: 'internal', regionFrom: 'us-east', regionTo: 'us-east', retention: '18 months (should be 30d)', owner: 't_location', recipient: 'Location History Store', control: null, status: 'reviewed', deletion: 'soft delete only' },
  { id: 'fl13', from: 's_lochist', to: 's_lochist_eu', fields: ['customer_id', 'lat', 'lon'], identifier: 'i_customer', tier: 3, purpose: 'service_delivery', consent: 'location toggle', enc: 'TLS', boundary: 'internal', regionFrom: 'us-east', regionTo: 'eu-west', retention: '18 months', owner: 't_location', recipient: 'Location replica (EU)', control: null, status: 'unreviewed', deletion: 'unknown', flags: ['cross_region'], virtualTo: true },
  { id: 'fl14', from: 's_lochist', to: 's_audsvc', fields: ['home_cluster', 'work_cluster'], identifier: 'i_customer', tier: 3, purpose: 'advertising', consent: 'none', enc: 'internal', boundary: 'trust', regionFrom: 'us-east', regionTo: 'us-east', retention: '390d', owner: 't_audience', recipient: 'Audience Builder', control: null, status: 'unreviewed', deletion: 'unknown', flags: ['purpose_change', 'sensitive_join'] },
  { id: 'fl15', from: 'n_app', to: 'v_geogrid', fields: ['lat', 'lon', 'maid'], identifier: 'i_maid', tier: 3, purpose: 'unknown', consent: 'OS location permission only', enc: 'TLS', boundary: 'third_party', regionFrom: 'user', regionTo: 'unknown', retention: 'unknown', owner: null, recipient: 'GeoGrid SDK', control: null, status: 'unknown', deletion: 'unknown', flags: ['undeclared'] },
  { id: 'fl16', from: 'n_web', to: 'v_pixelpeak', fields: ['page_url', 'order_value', 'hashed_email'], identifier: 'i_hemail', tier: 2, purpose: 'advertising', consent: 'none checked', enc: 'TLS', boundary: 'third_party', regionFrom: 'user', regionTo: 'us', retention: 'unknown', owner: null, recipient: 'PixelPeak', control: null, status: 'unknown', deletion: 'unknown', flags: ['undeclared', 'authenticated_page'] },
  { id: 'fl17', from: 's_browse', to: 'v_clearsight', fields: ['full_url', 'account_id', 'page_title'], identifier: 'i_customer', tier: 3, purpose: 'analytics', consent: 'analytics', enc: 'TLS', boundary: 'third_party', regionFrom: 'us-east', regionTo: 'us', retention: '400d (contract 90d)', owner: 't_browser', recipient: 'Clearsight Analytics', control: 'c_gate_egress', status: 'unreviewed', deletion: 'no deletion API', contract: 'DPA 2024', flags: ['sensitive_join'] },
  { id: 'fl18', from: 's_pulsesdk', to: 's_adswh', fields: ['device_id', 'maid', 'app_screen'], identifier: 'i_maid', tier: 4, purpose: 'analytics', consent: 'unknown', enc: 'TLS', boundary: 'trust', regionFrom: 'device', regionTo: 'us-east', retention: 'unknown', owner: null, recipient: 'Advertising Warehouse', control: null, status: 'unknown', deletion: 'unknown', flags: ['identity_join', 'sensitive_join', 'purpose_change', 'cross_region'] },
  { id: 'fl19', from: 'n_app', to: 's_pulseapi', fields: ['pulse_user_id', 'cycle_day', 'symptoms'], identifier: 'i_pulse', tier: 4, purpose: 'service_delivery', consent: 'explicit health consent', enc: 'TLS + per-user keys', boundary: 'device', regionFrom: 'user', regionTo: 'eu-central', retention: '365d', owner: 't_pulse', recipient: 'Pulse API', control: 'c_cryptoshred', status: 'reviewed', deletion: 'crypto-shredding · verified' },
  { id: 'fl20', from: 's_nova', to: 'v_lumen', fields: ['prompt_text', 'retrieved_chunks'], identifier: null, tier: 3, purpose: 'service_delivery', consent: 'ToS', enc: 'TLS', boundary: 'third_party', regionFrom: 'us-west', regionTo: 'us', retention: '30d abuse window (contract says 0)', owner: 't_nova', recipient: 'Lumen Model API', control: 'c_prompt_redact', status: 'reviewed', deletion: 'no deletion API', contract: 'no-training clause', flags: [] },
  { id: 'fl21', from: 's_nova', to: 's_novalogs', fields: ['user_id', 'prompt_text', 'output_text'], identifier: 'i_customer', tier: 3, purpose: 'model_training', consent: 'ToS only', enc: 'AES-256', boundary: 'internal', regionFrom: 'us-west', regionTo: 'us-west', retention: '400d (should be 30d)', owner: 't_nova', recipient: 'Prompt & Output Logs', control: null, status: 'reviewed', deletion: 'none', flags: ['purpose_change'] },
  { id: 'fl22', from: 's_supportsvc', to: 'v_helphub', fields: ['email', 'transcript', 'order_id'], identifier: 'i_email', tier: 3, purpose: 'customer_support', consent: 'n/a', enc: 'TLS', boundary: 'third_party', regionFrom: 'eu-west', regionTo: 'eu', retention: '365d (contract 30d)', owner: 't_support', recipient: 'HelpHub CRM', control: null, status: 'reviewed', deletion: 'vendor API · unconfirmed', contract: 'DPA 2024' },
  { id: 'fl23', from: 'v_helphub', to: 'sp_llmco', fields: ['transcript'], identifier: 'i_email', tier: 3, purpose: 'customer_support', consent: 'n/a', enc: 'TLS', boundary: 'third_party', regionFrom: 'eu', regionTo: 'us', retention: 'unknown', owner: null, recipient: 'LLMCo summariser', control: null, status: 'unknown', deletion: 'unknown', flags: ['cross_region'] },
  { id: 'fl24', from: 's_gateway', to: 's_logs', fields: ['request_url', 'email_in_query', 'ip_address'], identifier: 'i_email', tier: 2, purpose: 'service_delivery', consent: 'n/a', enc: 'TLS', boundary: 'internal', regionFrom: 'us-east', regionTo: 'us-east', retention: '395d (should be 30d)', owner: 't_sre', recipient: 'Application Logs', control: 'c_log_redact', status: 'reviewed', deletion: 'rotation only' },
  { id: 'fl25', from: 's_wh', to: 's_idres', fields: ['customer_id', 'device_id', 'cookie_id'], identifier: 'i_customer', tier: 2, purpose: 'unknown', consent: 'none', enc: 'internal', boundary: 'internal', regionFrom: 'us-east', regionTo: 'us-east', retention: 'unknown', owner: null, recipient: 'Identity Resolution Job', control: null, status: 'unknown', deletion: 'unknown', flags: ['identity_join'] },
  { id: 'fl26', from: 's_idres', to: 's_adswh', fields: ['customer_id ↔ maid', 'pulse_user_id ↔ device_id'], identifier: 'i_maid', tier: 3, purpose: 'unknown', consent: 'none', enc: 'internal', boundary: 'trust', regionFrom: 'us-east', regionTo: 'us-east', retention: 'unknown', owner: null, recipient: 'Advertising Warehouse', control: null, status: 'unknown', deletion: 'unknown', flags: ['identity_join', 'sensitive_join', 'purpose_change'] },
  { id: 'fl27', from: 's_wh', to: 's_backup', fields: ['warehouse snapshot'], identifier: null, tier: 3, purpose: 'service_delivery', consent: 'n/a', enc: 'separate backup keys', boundary: 'internal', regionFrom: 'us-east', regionTo: 'us-west', retention: '35d', owner: 't_sre', recipient: 'Snapshot Backups', control: 'c_backup_reapply', status: 'reviewed', deletion: 'expiry + re-apply deletes on restore' },
  { id: 'fl28', from: 's_capi', to: 'v_adreach', fields: ['hashed_email', 'order_value', 'ip_address'], identifier: 'i_hemail', tier: 2, purpose: 'advertising', consent: 'advertising (cached 24h)', enc: 'TLS', boundary: 'third_party', regionFrom: 'us-east', regionTo: 'us', retention: '180d', owner: 't_measure', recipient: 'AdReach Network', control: 'c_consent_read', status: 'reviewed', deletion: 'vendor API' },
  { id: 'fl29', from: 's_wh', to: 's_insights', fields: ['city', 'category', 'count'], identifier: null, tier: 2, purpose: 'research', consent: 'n/a', enc: 'internal', boundary: 'internal', regionFrom: 'us-east', regionTo: 'eu-west', retention: 'aggregate', owner: 't_data', recipient: 'Insights DP Release', control: 'c_dp_budget', status: 'reviewed', deletion: 'n/a', flags: ['cross_region'] },
  { id: 'fl30', from: 's_msg', to: 's_linkprev', fields: ['full_url', 'sender_pseudonym'], identifier: 'i_msgpseudo', tier: 3, purpose: 'service_delivery', consent: 'n/a', enc: 'mTLS', boundary: 'trust', regionFrom: 'eu-west', regionTo: 'us-east', retention: '180d logs (should be 14d)', owner: 't_msg', recipient: 'Link Preview Fetcher', control: null, status: 'reviewed', deletion: 'log rotation', flags: ['cross_region'] },
  { id: 'fl32', from: 's_nova', to: 's_novamem', fields: ['user_id', 'memory_text', 'source_conversation'], identifier: 'i_customer', tier: 3, purpose: 'personalization', consent: 'opt-in (planned)', enc: 'AES-256', boundary: 'internal', regionFrom: 'us-west', regionTo: 'us-west', retention: 'unknown', owner: 't_nova', recipient: 'Assistant Memory Store', control: null, status: 'unreviewed', deletion: 'user-visible delete (planned)' },
  { id: 'fl33', from: 's_novamem', to: 'v_lumen', fields: ['conversation excerpt → candidate memory'], identifier: null, tier: 3, purpose: 'personalization', consent: 'opt-in (planned)', enc: 'TLS · isolated tenant', boundary: 'third_party', regionFrom: 'us-west', regionTo: 'us', retention: '0 d (contract)', owner: 't_nova', recipient: 'Lumen Model API (isolated)', control: 'c_prompt_redact', status: 'reviewed', deletion: 'stateless', contract: 'no-training clause' },
  { id: 'fl31', from: 's_wh', to: 'n_dash', fields: ['aggregated revenue'], identifier: null, tier: 1, purpose: 'analytics', consent: 'n/a', enc: 'SSO', boundary: 'internal', regionFrom: 'us-east', regionTo: 'us-east', retention: 'n/a', owner: 't_data', recipient: 'Exec dashboards', control: 'c_rbac', status: 'reviewed', deletion: 'n/a' }
];

/* ── Models (AI / ML) ────────────────────────────────────────── */
var models = [
  { id: 'mdl_fraud', name: 'Fraud Model v7', purpose: 'fraud_prevention', team: 't_fraud', provider: 'in-house', hosting: 'INTERNAL CLOUD', region: 'us-east',
    training: ['d_fraudfeat', 'd_txn'], provenance: 'documented', personal: true, sensitive: false, consent: 'legitimate interest (fraud)', trainingRetention: '90d snapshots',
    promptLogging: 'n/a', outputLogging: 'scores 180d', humanReview: 'manual review queue', rag: null, vector: null, featureStore: 's_fraudfs', thirdParty: ['v_signalrisk'],
    trainsOnUserInput: false, deletionPath: 'retrain monthly without deleted IDs', memorization: 'n/a (tabular)', review: 'approved 2026-07' },
  { id: 'mdl_lookalike', name: 'Lookalike Audience Model', purpose: 'advertising', team: 't_audience', provider: 'in-house', hosting: 'INTERNAL CLOUD', region: 'us-east',
    training: ['d_audience', 'd_adsevents', 'd_fraudfeat'], provenance: 'partial', personal: true, sensitive: true, consent: 'advertising (nightly)', trainingRetention: 'unknown',
    promptLogging: 'n/a', outputLogging: 'segments 390d', humanReview: 'none', rag: null, vector: null, featureStore: 's_fraudfs', thirdParty: ['v_adreach'],
    trainsOnUserInput: false, deletionPath: 'unknown', memorization: 'not tested', review: 'not reviewed since fraud features added' },
  { id: 'mdl_reorder', name: 'Reorder Recommender', purpose: 'personalization', team: 't_storefront', provider: 'in-house', hosting: 'INTERNAL CLOUD', region: 'us-east',
    training: ['d_orders_wh'], provenance: 'documented', personal: true, sensitive: false, consent: 'personalisation', trainingRetention: '180d',
    promptLogging: 'n/a', outputLogging: '30d', humanReview: 'n/a', rag: null, vector: null, featureStore: null, thirdParty: [],
    trainsOnUserInput: false, deletionPath: 'retrain weekly', memorization: 'n/a', review: 'in design review' },
  { id: 'mdl_nova', name: 'Nova Assistant', purpose: 'service_delivery', team: 't_nova', provider: 'Lumen Model API', hosting: 'THIRD-PARTY MODEL', region: 'us-west',
    training: ['d_prompts'], provenance: 'unknown', personal: true, sensitive: true, consent: 'ToS only', trainingRetention: '400d logs',
    promptLogging: 'full text, 400d', outputLogging: 'full text, 400d', humanReview: 'sampled by 64 staff', rag: 'workspace docs', vector: 's_novavec', featureStore: null, thirdParty: ['v_lumen'],
    trainsOnUserInput: true, deletionPath: 'none for fine-tune set', memorization: 'not tested', review: 'approved 2025-08 (before logging change)' },
  { id: 'mdl_summarise', name: 'Support Summariser', purpose: 'customer_support', team: 't_support', provider: 'LLMCo (via HelpHub)', hosting: 'THIRD-PARTY MODEL', region: 'us',
    training: ['d_transcripts'], provenance: 'unknown', personal: true, sensitive: false, consent: 'n/a', trainingRetention: 'unknown',
    promptLogging: 'vendor-controlled', outputLogging: 'in CRM', humanReview: 'agents read summaries', rag: null, vector: null, featureStore: null, thirdParty: ['v_helphub', 'sp_llmco'],
    trainsOnUserInput: null, deletionPath: 'unknown', memorization: 'not tested', review: 'never reviewed' },
  { id: 'mdl_pulse', name: 'Pulse Cycle Predictor', purpose: 'service_delivery', team: 't_pulse', provider: 'in-house', hosting: 'ON DEVICE', region: 'device',
    training: ['d_pulsecycle'], provenance: 'documented', personal: true, sensitive: true, consent: 'explicit health consent', trainingRetention: 'federated; no raw data leaves',
    promptLogging: 'n/a', outputLogging: 'on device only', humanReview: 'n/a', rag: null, vector: null, featureStore: null, thirdParty: [],
    trainsOnUserInput: true, deletionPath: 'crypto-shred + federated round exclusion', memorization: 'DP-SGD, ε=2 per user per year', review: 'approved 2026-09' },
  { id: 'mdl_search', name: 'Search Ranking', purpose: 'personalization', team: 't_storefront', provider: 'in-house', hosting: 'INTERNAL CLOUD', region: 'us-west',
    training: ['d_search'], provenance: 'documented', personal: true, sensitive: false, consent: 'personalisation (checked at read)', trainingRetention: '90d',
    promptLogging: 'n/a', outputLogging: '14d', humanReview: 'n/a', rag: null, vector: null, featureStore: null, thirdParty: [],
    trainsOnUserInput: true, deletionPath: 'retrain weekly', memorization: 'n/a', review: 'approved 2026-05' },
  { id: 'mdl_memory', name: 'Nova Memory Extractor', purpose: 'personalization', team: 't_nova', provider: 'Lumen Model API', hosting: 'ISOLATED PRIVATE CLOUD', region: 'us-west',
    training: [], provenance: 'documented', personal: true, sensitive: true, consent: 'opt-in (planned)', trainingRetention: 'none',
    promptLogging: 'off', outputLogging: 'memory rows only', humanReview: 'none', rag: null, vector: null, featureStore: null, thirdParty: ['v_lumen'],
    trainsOnUserInput: false, deletionPath: 'user-visible delete', memorization: 'n/a', review: 'at launch gate' }
];

/* ── Controls (with enforcement level) ─────────────────────────────
 * level: 0 POLICY · 1 HUMAN REVIEW · 2 STATIC CHECK · 3 DEPLOYMENT GATE ·
 *        4 RUNTIME ENFORCEMENT · 5 CONTINUOUS AUDIT
 * health: working | failing | unknown                                   */
var controls = [
  { id: 'c_policy_nolog', name: 'Do not log personal data', domain: 'Logging', level: 0, health: 'unknown', owner: 't_privacy', scope: 'all services', evidence: 'Policy PP-12 (PDF, 2023)', statement: '"Engineers must not log PII."' },
  { id: 'c_log_redact', name: 'Log redaction at gateway', domain: 'Logging', level: 4, health: 'failing', owner: 't_sre', scope: 's_gateway', evidence: 'Redactor drops email in body, misses query strings', statement: 'Regex redactor on request body.' },
  { id: 'c_lint_pii', name: 'PII logging linter', domain: 'Logging', level: 2, health: 'working', owner: 't_privacy', scope: '71% of repos', evidence: 'CI rule ps-lint/pii-log · 412 blocks in 90d', statement: 'Blocks logger calls with tagged fields.' },
  { id: 'c_tls', name: 'TLS 1.3 everywhere', domain: 'Security', level: 5, health: 'working', owner: 't_sre', scope: 'edge', evidence: 'Continuous scanner · 0 downgrades', statement: '' },
  { id: 'c_mtls', name: 'Service mesh mTLS', domain: 'Security', level: 4, health: 'working', owner: 't_sre', scope: 'mesh', evidence: 'Mesh policy STRICT · audit weekly', statement: '' },
  { id: 'c_tokenise', name: 'Card tokenisation', domain: 'Identity', level: 4, health: 'working', owner: 't_pay', scope: 's_payment', evidence: 'PAN never stored · quarterly scan', statement: '' },
  { id: 'c_schema', name: 'Event schema registry with tier tags', domain: 'Discovery', level: 3, health: 'failing', owner: 't_data', scope: 'event bus', evidence: 'precise_lat added under a "compatible" schema change — gate did not fire', statement: 'New T3+ fields need privacy approval.' },
  { id: 'c_ttl_wh', name: 'Warehouse TTL policy', domain: 'Retention', level: 0, health: 'unknown', owner: 't_data', scope: 'core warehouse', evidence: 'Wiki page only', statement: '"Tables must declare retention."' },
  { id: 'c_ttl_fs', name: 'Feature store TTL', domain: 'Retention', level: 4, health: 'working', owner: 't_fraud', scope: 's_fraudfs', evidence: 'TTL enforced by store · sampled daily', statement: '' },
  { id: 'c_purpose_fs', name: 'Purpose tags on feature reads', domain: 'Purpose', level: 1, health: 'failing', owner: 't_fraud', scope: 's_fraudfs', evidence: 'Access request reviewed by a human; Marketing request approved as "analytics"', statement: 'Reads must declare purpose.' },
  { id: 'c_purpose_runtime', name: 'Query-time purpose enforcement', domain: 'Purpose', level: 4, health: 'working', owner: 't_privacy', scope: 'Pulse only', evidence: 'Policy engine denies non-matching purpose · 0 bypasses', statement: '' },
  { id: 'c_consent_read', name: 'Consent checked at read', domain: 'Consent', level: 4, health: 'working', owner: 't_privacy', scope: '9 of 14 consumers', evidence: 'Consent SDK on read path', statement: '' },
  { id: 'c_consent_batch', name: 'Nightly consent filter for batch exports', domain: 'Consent', level: 3, health: 'failing', owner: 't_audience', scope: 'ads exports', evidence: 'Filter step removed from one DAG on 2026-09-21', statement: '' },
  { id: 'c_delete_orch', name: 'Deletion orchestrator', domain: 'Deletion', level: 4, health: 'working', owner: 't_privacy', scope: '22 of 26 systems', evidence: 'Per-system receipts', statement: '' },
  { id: 'c_delete_verify', name: 'Deletion verification scan', domain: 'Deletion', level: 5, health: 'working', owner: 't_privacy', scope: '17 of 26 systems', evidence: 'Canary IDs re-queried at T+72h', statement: '' },
  { id: 'c_cryptoshred', name: 'Per-user keys (crypto-shredding)', domain: 'Deletion', level: 4, health: 'working', owner: 't_pulse', scope: 'Pulse', evidence: 'Key destruction receipts', statement: '' },
  { id: 'c_backup_reapply', name: 'Re-apply deletions on restore', domain: 'Deletion', level: 3, health: 'working', owner: 't_sre', scope: 'backups', evidence: 'Restore drill 2026-09-03', statement: '' },
  { id: 'c_gate_egress', name: 'Third-party egress review gate', domain: 'Vendors', level: 3, health: 'failing', owner: 't_privacy', scope: 'server egress', evidence: 'Browser telemetry used a pre-approved destination; gate skipped', statement: '' },
  { id: 'c_sdk_inventory', name: 'SDK allow-list', domain: 'Tracking', level: 1, health: 'failing', owner: 't_privacy', scope: 'mobile + web', evidence: 'Spreadsheet, last updated 2026-04', statement: '' },
  { id: 'c_cmp', name: 'Consent banner blocks tags', domain: 'Tracking', level: 4, health: 'working', owner: 't_storefront', scope: 'marketing pages', evidence: 'Tag manager consent mode', statement: '' },
  { id: 'c_rbac', name: 'Role-based warehouse access', domain: 'Access', level: 4, health: 'working', owner: 't_data', scope: 'warehouse', evidence: 'IAM · quarterly recert', statement: '' },
  { id: 'c_jit', name: 'Just-in-time access for T3+', domain: 'Access', level: 0, health: 'unknown', owner: 't_privacy', scope: 'planned', evidence: 'RFC draft', statement: '"T3+ access should be time-bound."' },
  { id: 'c_access_audit', name: 'Sensitive query monitoring', domain: 'Access', level: 5, health: 'working', owner: 't_privacy', scope: 'warehouse', evidence: 'Alerts on bulk T3+ reads', statement: '' },
  { id: 'c_dp_budget', name: 'DP budget accountant', domain: 'PETs', level: 4, health: 'working', owner: 't_data', scope: 'Insights releases', evidence: 'Ledger denies over-budget queries', statement: '' },
  { id: 'c_prompt_redact', name: 'Prompt PII redaction before provider', domain: 'AI', level: 4, health: 'working', owner: 't_nova', scope: 'Nova → Lumen', evidence: 'NER redactor · 97.1% recall on eval', statement: '' },
  { id: 'c_ai_review', name: 'AI system privacy review', domain: 'AI', level: 1, health: 'working', owner: 't_privacy', scope: 'new models', evidence: 'Review template', statement: '' },
  { id: 'c_vendor_attest', name: 'Annual vendor deletion attestation', domain: 'Vendors', level: 1, health: 'failing', owner: 't_privacy', scope: 'all vendors', evidence: '5 of 12 vendors attested this year', statement: '' },
  { id: 'c_id_scope', name: 'Purpose-scoped identifiers', domain: 'Identity', level: 0, health: 'unknown', owner: 't_identity', scope: 'standard', evidence: 'Architecture standard AS-7', statement: '"New products get scoped IDs."' },
  { id: 'c_retention_scan', name: 'Retention drift scanner', domain: 'Retention', level: 5, health: 'working', owner: 't_privacy', scope: 'stores with metadata', evidence: 'Compares declared vs observed oldest row, daily', statement: '' },
  { id: 'c_launch_gate', name: 'Privacy launch gate', domain: 'Review', level: 3, health: 'working', owner: 't_privacy', scope: 'launch tooling', evidence: 'Launch blocked without review ID', statement: '' },
  { id: 'c_children', name: 'Children\'s data isolation', domain: 'Identity', level: 4, health: 'working', owner: 't_storefront', scope: 'family accounts', evidence: 'Separate store, no ad identifiers', statement: '' },
  { id: 'c_break_glass', name: 'Break-glass approval', domain: 'Access', level: 3, health: 'working', owner: 't_sre', scope: 'prod data', evidence: 'Pager approval + ticket', statement: '' }
];

/* ── Findings ──────────────────────────────────────────────────
 * Each finding has a detector — the machine rule (or human review) that
 * produced it — and links to the entities it touches. */
var findings = [
  { id: 'PRV-0217', sev: 'HIGH', title: 'Fraud features consumed by Marketing Audience Builder',
    kind: 'PURPOSE DRIFT + CROSS-CONTEXT LINKABILITY', linddun: ['Linking', 'Non-compliance'], harms: ['Secondary use', 'Linkability', 'Discrimination'],
    detector: 'Lineage diff: new consumer of fraud_features_v7 with purpose=advertising', people: 48000000,
    entities: ['p_checkout', 's_fraudsvc', 's_fraudfs', 'd_fraudfeat', 'fl10', 'i_fp', 'i_customer', 'i_device', 's_mktg', 'v_adreach', 'mdl_lookalike', 'c_purpose_fs'],
    human: 'A shopper flagged as risky by a fraud signal can be excluded from offers, or targeted differently, by advertisers who never see why.',
    mitigations: ['Separate identity: fraud reads use a fraud-scoped ID', 'Tokenise device_fingerprint at the store boundary', 'Scope purpose: reads must declare fraud_prevention', 'Remove the advertising consumer', 'Shorten retention of score bands', 'Runtime purpose enforcement at the feature store'],
    owner: 't_fraud', due: '2026-10-09', enforcement: 3, status: 'open', opened: '2026-09-22' },
  { id: 'PRV-0192', sev: 'HIGH', title: 'Full URLs exported to analytics vendor with account ID',
    kind: 'SENSITIVE INFERENCE + CROSS-CONTEXT LINKAGE', linddun: ['Linking', 'Data disclosure', 'Detecting'], harms: ['Sensitive inference', 'Surveillance', 'Linkability'],
    detector: 'Egress scanner: URL-shaped values with query strings leaving to v_clearsight', people: 2400000,
    entities: ['p_insights', 'f_browse', 's_browse', 'd_browse', 'fl17', 'v_clearsight', 'i_customer', 'c_gate_egress'],
    human: 'A browsing history — clinics, lawyers, job boards — becomes readable by a third party, tied to a named account.',
    mitigations: ['Strip query parameters', 'Remove account ID', 'Derive category locally', 'Aggregate to domain-level metrics', 'Short TTL (7 days)'],
    owner: 't_browser', due: '2026-10-18', enforcement: 3, status: 'open', opened: '2026-09-02' },
  { id: 'PRV-0233', sev: 'HIGH', title: 'Health app device ID joined to advertising warehouse',
    kind: 'CROSS-CONTEXT LINKABILITY', linddun: ['Linking', 'Identifying'], harms: ['Linkability', 'Sensitive inference', 'Context collapse'],
    detector: 'Identity graph: i_pulse reachable from i_maid in 2 hops', people: 9200000,
    entities: ['p_pulse', 's_pulsesdk', 'd_pulseinstall', 'fl18', 'fl26', 's_idres', 'd_identity_graph', 'i_pulse', 'i_maid', 'i_device', 's_adswh', 'c_id_scope'],
    human: 'Health behaviour (which Pulse screens someone opens) can alter an advertising profile.',
    mitigations: ['Remove MAID from the Pulse SDK beacon', 'Rotate the Pulse install ID', 'Block i_pulse joins in the identity job', 'Delete existing joined rows', 'Deployment gate on SDK manifests'],
    owner: 't_pulse', due: '2026-10-03', enforcement: 3, status: 'open', opened: '2026-09-19' },
  { id: 'PRV-0201', sev: 'HIGH', title: 'Customer location history kept 18 months against a 30-day need',
    kind: 'RETENTION VIOLATION', linddun: ['Detecting', 'Data disclosure'], harms: ['Surveillance', 'Exposure'],
    detector: 'Retention drift scanner: oldest row 547d, declared 30d', people: 26000000,
    entities: ['p_storefront', 'f_pickup', 's_location', 's_lochist', 'd_lochist', 'fl12', 'fl13', 'fl14', 'c_ttl_wh'],
    human: 'Eighteen months of where someone sleeps and works — available to anyone who compromises one store.',
    mitigations: ['30-day TTL enforced by the store', 'Keep only the pickup-point choice, not coordinates', 'Compute nearest pickup on device', 'Hard-delete historic rows', 'Remove EU replica'],
    owner: 't_location', due: '2026-10-12', enforcement: 4, status: 'open', opened: '2026-08-14' },
  { id: 'PRV-0208', sev: 'HIGH', title: 'Home and work clusters flow into ad audiences without consent',
    kind: 'PURPOSE DRIFT', linddun: ['Non-compliance', 'Linking'], harms: ['Secondary use', 'Sensitive inference', 'Manipulation'],
    detector: 'Lineage: T3 inference fields read by advertising purpose', people: 26000000,
    entities: ['d_lochist', 'fl14', 's_audsvc', 'mdl_lookalike', 'c_purpose_runtime'],
    human: 'Where a person lives and works becomes an advertising attribute they never agreed to.',
    mitigations: ['Block the read at query time', 'Delete derived clusters in ads warehouse', 'Require consent state for any location-derived segment'],
    owner: 't_audience', due: '2026-10-05', enforcement: 4, status: 'open', opened: '2026-09-11' },
  { id: 'PRV-0240', sev: 'HIGH', title: 'Undeclared location SDK collects coordinates with advertising ID',
    kind: 'UNDECLARED THIRD-PARTY EGRESS', linddun: ['Detecting', 'Unawareness', 'Data disclosure'], harms: ['Surveillance', 'Loss of control'],
    detector: 'Mobile traffic capture: calls to geogrid host every 15 min in background', people: 26000000,
    entities: ['v_geogrid', 'fl15', 'i_maid', 'c_sdk_inventory', 'p_storefront'],
    human: 'Background location plus an advertising ID leaves the company to a recipient with unknown purpose and unknown buyers.',
    mitigations: ['Remove the SDK', 'SDK allow-list as a build gate', 'Contact vendor for deletion', 'Notify counsel'],
    owner: 't_storefront', due: '2026-09-30', enforcement: 3, status: 'open', opened: '2026-09-24' },
  { id: 'PRV-0226', sev: 'HIGH', title: 'Ad pixel on authenticated checkout pages',
    kind: 'TRACKING ON SENSITIVE PAGE', linddun: ['Detecting', 'Linking'], harms: ['Surveillance', 'Linkability'],
    detector: 'Tag crawler: third-party pixel on /checkout/* with hashed email', people: 48000000,
    entities: ['v_pixelpeak', 'fl16', 'i_hemail', 'i_cookie', 'p_checkout', 'c_cmp'],
    human: 'What someone buys, and their email hash, reach an ad company that has no contract with Northstar.',
    mitigations: ['Remove pixel from authenticated pages', 'Block unknown hosts via CSP', 'Server-side conversions only with consent check'],
    owner: 't_checkout', due: '2026-10-01', enforcement: 4, status: 'open', opened: '2026-09-20' },
  { id: 'PRV-0212', sev: 'HIGH', title: 'Assistant prompts retained 400 days and used for training',
    kind: 'RETENTION + PURPOSE DRIFT', linddun: ['Data disclosure', 'Non-compliance', 'Unawareness'], harms: ['Exposure', 'Secondary use', 'Sensitive inference'],
    detector: 'AI inventory: prompt_logging=full · retention 400d · purpose model_training added', people: 22000000,
    entities: ['p_nova', 's_nova', 's_novalogs', 'd_prompts', 'fl21', 'mdl_nova', 'i_convo', 'i_customer'],
    human: 'What people confide to an assistant — symptoms, money, relationships — is readable by 64 staff and baked into training sets.',
    mitigations: ['30-day TTL on logs', 'Separate opt-in for training', 'Redact before logging', 'Remove user_id from eval samples', 'Memorisation tests before each release'],
    owner: 't_nova', due: '2026-10-10', enforcement: 4, status: 'open', opened: '2026-09-05' },
  { id: 'PRV-0199', sev: 'HIGH', title: 'Emails in gateway logs via query strings, kept 395 days',
    kind: 'LOGGING LEAK', linddun: ['Data disclosure', 'Identifying'], harms: ['Exposure'],
    detector: 'Log scanner: email pattern in request_url, 0.4% of lines', people: 212000000,
    entities: ['s_gateway', 's_logs', 'd_applogs', 'fl24', 'c_log_redact', 'c_policy_nolog', 'i_email'],
    human: 'Anyone with log access (1,200 people) can find who used password reset and when.',
    mitigations: ['Redact query strings at the edge', 'POST for reset flows', '30-day log TTL', 'Purge historical lines'],
    owner: 't_sre', due: '2026-10-07', enforcement: 4, status: 'in progress', opened: '2026-08-28' },
  { id: 'PRV-0229', sev: 'HIGH', title: 'Identity resolution job has no owner, no purpose, no retention',
    kind: 'UNKNOWN OWNER + UNKNOWN PURPOSE', linddun: ['Linking', 'Identifying', 'Non-compliance'], harms: ['Linkability', 'Re-identification'],
    detector: 'Unknown = finding: owner null, purpose [], retention null', people: 180000000,
    entities: ['s_idres', 'd_identity_graph', 'fl25', 'fl26', 'i_customer', 'i_maid', 'i_pulse', 'i_cookie'],
    human: 'A job nobody owns links health, advertising and shopping identities for 180M people "in case".',
    mitigations: ['Assign owner or shut down', 'Declare purpose per edge type', 'Forbid purpose-scoped ID joins', 'Delete graph edges older than need'],
    owner: null, due: '2026-10-02', enforcement: 0, status: 'open', opened: '2026-09-16' },
  { id: 'PRV-0205', sev: 'HIGH', title: 'Opt-outs not reaching AdReach; consent filter vanished from one batch job',
    kind: 'CONSENT PROPAGATION FAILURE', linddun: ['Unawareness', 'Non-compliance'], harms: ['Loss of control', 'Manipulation'],
    detector: 'Consent canary: revoked test identity still present in AdReach export', people: 1300000,
    entities: ['fl11', 'v_adreach', 'c_consent_batch', 's_mktg', 'd_audience'],
    human: 'People who said "stop" keep receiving targeted ads for weeks.',
    mitigations: ['Restore the filter step as a required DAG task', 'Check consent at read in the export', 'Push revocations to AdReach via API', 'Canary identities in every export'],
    owner: 't_audience', due: '2026-09-30', enforcement: 4, status: 'open', opened: '2026-09-22' },
  { id: 'PRV-0237', sev: 'HIGH', title: 'Support transcripts sent to unreviewed LLM subprocessor across regions',
    kind: 'UNKNOWN SUBPROCESSOR FLOW', linddun: ['Data disclosure', 'Non-compliance'], harms: ['Exposure', 'Loss of control'],
    detector: 'Vendor subprocessor diff: HelpHub added LLMCo (US) on 2026-08-30', people: 17000000,
    entities: ['v_helphub', 'fl22', 'fl23', 'mdl_summarise', 'd_transcripts'],
    human: 'EU customers\' support conversations are processed in the US by a company they have never heard of.',
    mitigations: ['Disable summariser for EU tenants', 'Contractual review of LLMCo', 'Transfer impact assessment', 'Redact before sending'],
    owner: 't_support', due: '2026-10-08', enforcement: 1, status: 'open', opened: '2026-09-01' },
  { id: 'PRV-0214', sev: 'MEDIUM', title: 'Precise latitude/longitude added to purchase_events',
    kind: 'NEW SENSITIVE FIELD', linddun: ['Detecting'], harms: ['Surveillance'],
    detector: 'Schema drift: T3 fields added under compatible change', people: 48000000,
    entities: ['d_purchase', 'fl05', 's_bus', 'c_schema'], human: 'Every purchase now records where the buyer stood.',
    mitigations: ['Coarsen to city', 'Block T3 additions without review ID'], owner: 't_checkout', due: '2026-10-14', enforcement: 3, status: 'open', opened: '2026-09-23' },
  { id: 'PRV-0188', sev: 'MEDIUM', title: 'Warehouse orders kept 4 years; no TTL enforced',
    kind: 'NO TTL', linddun: ['Data disclosure'], harms: ['Exposure'], detector: 'Retention scanner: ttl=false', people: 48000000,
    entities: ['d_orders_wh', 's_wh', 'c_ttl_wh'], human: 'Old orders reveal household composition long after they matter.',
    mitigations: ['Declare 2y TTL', 'Aggregate after 13 months'], owner: 't_data', due: '2026-11-01', enforcement: 0, status: 'open', opened: '2026-07-30' },
  { id: 'PRV-0195', sev: 'MEDIUM', title: 'Link preview logs keep full URLs 180 days, in another region',
    kind: 'PII IN LONG-LIVED LOGS', linddun: ['Data disclosure', 'Detecting'], harms: ['Exposure', 'Sensitive inference'], detector: 'Log scanner', people: 38000000,
    entities: ['d_linklogs', 's_linkprev', 'fl30'], human: 'Links shared in private chats become readable to 310 log users.',
    mitigations: ['Log domain only', '14-day TTL', 'Fetch previews on sender device'], owner: 't_msg', due: '2026-10-20', enforcement: 4, status: 'open', opened: '2026-08-20' },
  { id: 'PRV-0203', sev: 'MEDIUM', title: 'Phone numbers collected for 2FA matched for ad audiences',
    kind: 'PURPOSE DRIFT', linddun: ['Non-compliance'], harms: ['Secondary use'], detector: 'Purpose lineage: account_security → advertising', people: 71000000,
    entities: ['d_phone2fa', 'i_phone', 'd_audience', 's_mktg'], human: 'Turning on a security feature quietly makes a person more targetable.',
    mitigations: ['Remove phone_hash from audiences', 'Runtime purpose check on mfa_phone_numbers'], owner: 't_audience', due: '2026-10-04', enforcement: 4, status: 'open', opened: '2026-09-09' },
  { id: 'PRV-0210', sev: 'MEDIUM', title: 'Clearsight retains 400 days against a 90-day contract; no deletion API',
    kind: 'VENDOR RETENTION MISMATCH', linddun: ['Non-compliance'], harms: ['Loss of control'], detector: 'Vendor attestation diff', people: 2400000,
    entities: ['v_clearsight', 'fl17'], human: 'Deletion requests cannot reach this copy.', mitigations: ['Contract enforcement', 'Stop export until fixed'], owner: 't_browser', due: '2026-10-25', enforcement: 1, status: 'open', opened: '2026-09-02' },
  { id: 'PRV-0221', sev: 'MEDIUM', title: 'Vector store chunks survive source-document deletion',
    kind: 'DELETION VERIFICATION FAILURE', linddun: ['Unawareness'], harms: ['Loss of control', 'Exposure'], detector: 'Deletion verification scan: 3 of 20 canary docs still retrievable', people: 6100000,
    entities: ['d_novavec', 's_novavec', 'mdl_nova', 'c_delete_verify'], human: 'A deleted document can still be quoted back by the assistant.',
    mitigations: ['Delete chunks by source ID', 'Re-embed on delete', 'Verification scan after each delete'], owner: 't_nova', due: '2026-10-16', enforcement: 5, status: 'in progress', opened: '2026-09-12' },
  { id: 'PRV-0224', sev: 'MEDIUM', title: 'MailPost agreement expires in 19 days',
    kind: 'EXPIRING AGREEMENT', linddun: ['Non-compliance'], harms: ['Loss of control'], detector: 'Contract calendar', people: 150000000,
    entities: ['v_mailpost'], human: 'Emails for 150M people would flow without a data processing agreement.', mitigations: ['Renew DPA'], owner: 't_privacy', due: '2026-10-10', enforcement: 1, status: 'open', opened: '2026-09-15' },
  { id: 'PRV-0231', sev: 'MEDIUM', title: 'SurveyLoop agreement expired; data still flowing',
    kind: 'EXPIRED AGREEMENT', linddun: ['Non-compliance'], harms: ['Loss of control'], detector: 'Contract calendar × egress log', people: 410000,
    entities: ['v_surveyloop'], human: 'Survey answers are sent to a vendor with no current contract.', mitigations: ['Pause export', 'Renew or offboard'], owner: 't_privacy', due: '2026-09-29', enforcement: 1, status: 'open', opened: '2026-09-02' },
  { id: 'PRV-0236', sev: 'MEDIUM', title: 'Assistant memory launching with no retention or deletion defined',
    kind: 'UNKNOWN RETENTION', linddun: ['Unawareness', 'Unintervenability'], harms: ['Loss of control'], detector: 'Launch gate: retention=null', people: 0,
    entities: ['f_memory', 's_novamem', 'd_novamem', 'mdl_memory'], human: 'People cannot see or remove what the assistant decided to remember.',
    mitigations: ['Memory viewer + delete', 'Default 12-month expiry', 'Exclude T4 from memory'], owner: 't_nova', due: '2026-10-06', enforcement: 3, status: 'blocking launch', opened: '2026-09-18' },
  { id: 'PRV-0218', sev: 'MEDIUM', title: '1,200 people can read gateway logs',
    kind: 'EXCESS ACCESS', linddun: ['Data disclosure'], harms: ['Exposure'], detector: 'Access graph', people: 212000000,
    entities: ['d_applogs', 's_logs'], human: 'Insider curiosity has a very large surface.', mitigations: ['Scope log access by service', 'JIT for T2+ logs'], owner: 't_sre', due: '2026-11-15', enforcement: 4, status: 'open', opened: '2026-08-29' },
  { id: 'PRV-0239', sev: 'MEDIUM', title: 'Pulse install telemetry: owner, retention and deletion unknown',
    kind: 'UNKNOWN OWNER + RETENTION + DELETION', linddun: ['Non-compliance'], harms: ['Loss of control'], detector: 'Unknown = finding', people: 9200000,
    entities: ['d_pulseinstall', 's_pulsesdk'], human: 'Nobody can say how long health-app screen views live.', mitigations: ['Assign owner', 'Declare retention', 'Add to deletion orchestrator'], owner: null, due: '2026-10-09', enforcement: 0, status: 'open', opened: '2026-09-19' },
  { id: 'PRV-0176', sev: 'LOW', title: 'Search index reindex-on-delete not verified',
    kind: 'DELETION VERIFICATION GAP', linddun: ['Unawareness'], harms: ['Loss of control'], detector: 'Verification coverage', people: 91000000,
    entities: ['d_search', 's_search'], human: 'A deleted user\'s queries might be searchable for a few days.', mitigations: ['Add canary to verification scan'], owner: 't_storefront', due: '2026-11-20', enforcement: 5, status: 'open', opened: '2026-07-11' },
  { id: 'PRV-0181', sev: 'LOW', title: 'ns_uid cookie lives 400 days',
    kind: 'IDENTIFIER OUTLIVES PURPOSE', linddun: ['Linking'], harms: ['Linkability'], detector: 'Cookie crawler', people: 91000000,
    entities: ['i_cookie'], human: 'Visits a year apart are trivially linked.', mitigations: ['Shorten to 90 days', 'Scope per property'], owner: 't_storefront', due: '2026-12-01', enforcement: 2, status: 'open', opened: '2026-07-20' },
  { id: 'PRV-0160', sev: 'LOW', title: 'Messenger metadata: good pattern, keep watching',
    kind: 'POSITIVE CONTROL', linddun: [], harms: [], detector: 'Architecture review', people: 64000000,
    entities: ['d_msgmeta', 'i_msgpseudo'], human: 'No join path from chats to commerce.', mitigations: ['Keep pseudonym rotation', 'Continuous audit of join attempts'], owner: 't_msg', due: '2026-12-31', enforcement: 5, status: 'accepted', opened: '2026-06-01' }
];

/* ── Risks (explainable) ───────────────────────────────────────
 * Each factor 0–5. First nine are EXPOSURE factors (higher = worse);
 * the last three are ASSURANCE factors (higher = better).       */
var riskFactors = [
  { k: 'sens', label: 'Data sensitivity', kind: 'exposure' },
  { k: 'people', label: 'Number of people', kind: 'exposure' },
  { k: 'ident', label: 'Identifiability', kind: 'exposure' },
  { k: 'link', label: 'Linkability', kind: 'exposure' },
  { k: 'ret', label: 'Retention', kind: 'exposure' },
  { k: 'access', label: 'Access breadth', kind: 'exposure' },
  { k: 'third', label: 'Third-party exposure', kind: 'exposure' },
  { k: 'novel', label: 'Purpose novelty', kind: 'exposure' },
  { k: 'geo', label: 'Geographic / regulatory exposure', kind: 'exposure' },
  { k: 'ctrl', label: 'Control strength', kind: 'assurance' },
  { k: 'del', label: 'Ability to delete', kind: 'assurance' },
  { k: 'verify', label: 'Ability to verify', kind: 'assurance' }
];

var risks = [
  { id: 'R-01', name: 'Customer Location History', asset: 'd_lochist', findings: ['PRV-0201', 'PRV-0208'],
    f: { sens: 4, people: 4, ident: 5, link: 4, ret: 5, access: 3, third: 3, novel: 4, geo: 3, ctrl: 1, del: 1, verify: 1 },
    why: ['precise location (T3)', 'durable account identifier', '18-month retention against a 30-day need', 'accessible by 7 services', 'exported to two recipients (Audience Builder, EU replica)', 'used by another product (Advertising)', 'no query-time purpose enforcement', 'deletion not verified downstream'],
    mitigating: [['encrypted at rest', true], ['access logged', true], ['short TTL', false], ['scoped identity', false], ['purpose enforcement', false], ['vendor deletion verification', false]] },
  { id: 'R-02', name: 'Identity graph (health ↔ advertising)', asset: 'd_identity_graph', findings: ['PRV-0229', 'PRV-0233'],
    f: { sens: 4, people: 5, ident: 5, link: 5, ret: 4, access: 4, third: 2, novel: 5, geo: 3, ctrl: 0, del: 0, verify: 0 },
    why: ['joins a purpose-scoped health ID to advertising IDs', '180M people', 'no owner', 'no declared purpose', 'retention unknown', '212 people can query it', 'feeds the advertising warehouse'],
    mitigating: [['warehouse RBAC', true], ['owner', false], ['purpose declared', false], ['join blocked for scoped IDs', false], ['deletion path', false]] },
  { id: 'R-03', name: 'Fraud signals in ad audiences', asset: 'd_fraudfeat', findings: ['PRV-0217'],
    f: { sens: 3, people: 4, ident: 4, link: 4, ret: 3, access: 2, third: 4, novel: 5, geo: 2, ctrl: 2, del: 3, verify: 3 },
    why: ['fraud_prevention data read for advertising', 'device fingerprint leaves fraud context', 'score bands exported to AdReach', 'purpose check is a human approval, not a machine rule'],
    mitigating: [['feature-store TTL', true], ['encrypted', true], ['deletion verified in store', true], ['purpose enforcement', false], ['scoped identity', false]] },
  { id: 'R-04', name: 'Assistant conversations', asset: 'd_prompts', findings: ['PRV-0212'],
    f: { sens: 4, people: 4, ident: 4, link: 3, ret: 4, access: 3, third: 3, novel: 4, geo: 2, ctrl: 2, del: 1, verify: 1 },
    why: ['free text can contain T4 data', '400-day full-text logs', '64 staff can sample', 'added to training set without separate consent', 'no deletion path for fine-tune data'],
    mitigating: [['PII redaction before provider', true], ['no-training clause with provider', true], ['log TTL', false], ['training opt-in', false], ['memorisation testing', false]] },
  { id: 'R-05', name: 'Browser URL analytics', asset: 'd_browse', findings: ['PRV-0192', 'PRV-0210'],
    f: { sens: 4, people: 2, ident: 4, link: 4, ret: 3, access: 2, third: 5, novel: 3, geo: 2, ctrl: 2, del: 1, verify: 1 },
    why: ['full URLs reveal health, legal, financial intent', 'account ID attached', 'third party keeps 400 days', 'vendor has no deletion API'],
    mitigating: [['TTL internally', true], ['analytics consent', true], ['query stripping', false], ['vendor deletion', false]] },
  { id: 'R-06', name: 'Gateway request logs', asset: 'd_applogs', findings: ['PRV-0199', 'PRV-0218'],
    f: { sens: 2, people: 5, ident: 4, link: 3, ret: 4, access: 5, third: 0, novel: 1, geo: 2, ctrl: 2, del: 1, verify: 2 },
    why: ['emails in query strings', '395-day retention', '1,200 people with access', 'redactor misses URLs'],
    mitigating: [['PII lint in 71% of repos', true], ['redaction at runtime', false], ['short TTL', false]] },
  { id: 'R-07', name: 'Support transcripts', asset: 'd_transcripts', findings: ['PRV-0237'],
    f: { sens: 3, people: 3, ident: 4, link: 2, ret: 3, access: 5, third: 4, novel: 3, geo: 4, ctrl: 2, del: 3, verify: 1 },
    why: ['940 agents can read', 'CRM keeps 365d vs 30d contract', 'new US LLM subprocessor for EU data'],
    mitigating: [['DPA in place', true], ['vendor deletion API', true], ['subprocessor review', false], ['transfer assessment', false]] },
  { id: 'R-08', name: 'Pulse cycle logs', asset: 'd_pulsecycle', findings: [],
    f: { sens: 5, people: 2, ident: 3, link: 1, ret: 2, access: 1, third: 0, novel: 1, geo: 3, ctrl: 5, del: 5, verify: 5 },
    why: ['special-category health data', 'but: per-user keys, on-device model, purpose enforced at runtime, crypto-shredding verified'],
    mitigating: [['crypto-shredding', true], ['runtime purpose enforcement', true], ['4 people with access', true], ['on-device prediction', true], ['DP-SGD', true]] },
  { id: 'R-09', name: 'Messenger metadata', asset: 'd_msgmeta', findings: ['PRV-0160'],
    f: { sens: 3, people: 4, ident: 2, link: 1, ret: 1, access: 1, third: 0, novel: 0, geo: 2, ctrl: 5, del: 5, verify: 4 },
    why: ['metadata of 64M people', 'but: rotating pseudonyms, 30-day TTL, no join path to commerce'],
    mitigating: [['E2EE content', true], ['pseudonymous', true], ['30-day TTL', true], ['continuous audit', true]] }
];

/* ── Incidents ──────────────────────────────────────────────── */
var incidents = [
  { id: 'INC-2026-014', title: 'Consent filter removed from ads export DAG', type: 'consent failure', sev: 'SEV-2', status: 'open', opened: '2026-09-22', people: 1300000,
    entities: ['c_consent_batch', 'v_adreach', 'fl11', 'PRV-0205'],
    assumption: 'Batch exports always run the consent filter step.', gap: 'Filter was a convention in the DAG template, not a required task; a refactor dropped it.',
    root: 'Refactor PR #4471 replaced the template; review had no privacy owner.', remediation: 'Restored filter; re-exported with revocations; asked AdReach to delete 1.3M rows.',
    guard: 'Invariant: every export to a third party must pass consent_check() — enforced by the pipeline compiler (deploy gate) and a canary identity in every file (continuous audit).', machine: true },
  { id: 'INC-2026-011', title: 'Emails in gateway logs', type: 'logging leak', sev: 'SEV-3', status: 'remediating', opened: '2026-08-28', people: 850000,
    entities: ['d_applogs', 'c_log_redact', 'PRV-0199'],
    assumption: 'The redactor removes personal data from logs.', gap: 'Redactor only inspects bodies; reset links put email in the query string.',
    root: 'Password-reset flow built with GET for email-link compatibility.', remediation: 'Redact URLs at edge; purge 395 days of lines.',
    guard: 'Invariant: no log line may match email/phone patterns — log pipeline rejects and alerts (runtime).', machine: true },
  { id: 'INC-2026-009', title: 'Deleted workspace documents still retrievable by assistant', type: 'deletion failure', sev: 'SEV-3', status: 'remediating', opened: '2026-09-12', people: 4100,
    entities: ['d_novavec', 'PRV-0221'],
    assumption: 'Deleting a document deletes its embeddings.', gap: 'Chunks were keyed by chunk ID, not source ID; deletes matched nothing.',
    root: 'Chunking service change in June re-keyed chunks.', remediation: 'Backfill source IDs; delete orphans.',
    guard: 'Invariant: after delete(doc), retrieve(doc) returns nothing at T+1h — canary in verification scan.', machine: true },
  { id: 'INC-2026-006', title: 'Marketing export sent to wrong partner bucket', type: 'misdirected export', sev: 'SEV-2', status: 'closed', opened: '2026-05-03', people: 220000,
    entities: ['s_mktg'], assumption: 'Destination buckets are configured per partner.', gap: 'Bucket name reused across two partners in staging config promoted to prod.',
    root: 'Config copied between environments.', remediation: 'Partner deleted with attestation; config validated.', guard: 'Invariant: destination must match contract registry — deploy gate.', machine: true },
  { id: 'INC-2026-004', title: 'Support agent browsed celebrity accounts', type: 'excess access', sev: 'SEV-3', status: 'closed', opened: '2026-03-17', people: 12,
    entities: ['d_transcripts'], assumption: 'Agents only open accounts tied to their tickets.', gap: 'No ticket binding on account view.', root: 'Access model was role-based, not case-based.',
    remediation: 'Case-bound access; access-spike alerting.', guard: 'Invariant: account view requires an open case assigned to the viewer — runtime.', machine: true },
  { id: 'INC-2025-021', title: 'Lookalike model reproduced rare-segment membership', type: 'model leakage', sev: 'SEV-3', status: 'closed', opened: '2025-11-20', people: 3400,
    entities: ['mdl_lookalike'], assumption: 'Aggregated segments cannot reveal individuals.', gap: 'Segments under 100 people were allowed.', root: 'No minimum-size rule.',
    remediation: 'k ≥ 1,000 floor on segments.', guard: 'Invariant: no audience under k=1,000 — enforced in audience API (runtime).', machine: true }
];

/* ── Drift feed ─────────────────────────────────────────────── */
var drift = [
  { t: '2026-09-25T16:40', type: 'new consumer', text: 'Fraud feature store is now consumed by Marketing.', before: 'consumers: Fraud Model v7', after: 'consumers: Fraud Model v7, Marketing Audience Builder', entities: ['s_fraudfs', 's_mktg', 'PRV-0217'], sev: 'HIGH' },
  { t: '2026-09-24T09:12', type: 'new sdk', text: 'New SDK appeared in the Storefront app: GeoGrid.', before: 'sdks: 14', after: 'sdks: 15 (+geogrid 3.2.1)', entities: ['v_geogrid', 'PRV-0240'], sev: 'HIGH' },
  { t: '2026-09-23T14:05', type: 'new field', text: 'Precise latitude was added to Customer Events.', before: 'geo_city', after: 'geo_city, precise_lat, precise_lon', entities: ['d_purchase', 'PRV-0214'], sev: 'MEDIUM' },
  { t: '2026-09-21T22:30', type: 'consent change', text: 'Consent filtering disappeared from one batch job.', before: 'tasks: extract → consent_filter → encrypt → ship', after: 'tasks: extract → encrypt → ship', entities: ['c_consent_batch', 'INC-2026-014'], sev: 'HIGH' },
  { t: '2026-09-20T11:18', type: 'new sdk', text: 'Ad pixel found on authenticated checkout pages.', before: '/checkout/*: 0 third-party tags', after: '/checkout/*: pixelpeak.js', entities: ['v_pixelpeak', 'PRV-0226'], sev: 'HIGH' },
  { t: '2026-09-19T08:44', type: 'new join', text: 'Pulse user ID now joins to advertising IDs in the identity graph.', before: 'i_pulse joins: 0', after: 'i_pulse joins: device_id, maid', entities: ['i_pulse', 'PRV-0233'], sev: 'HIGH' },
  { t: '2026-09-17T13:02', type: 'changed retention', text: 'Vendor retention changed from 30 to 365 days (HelpHub).', before: 'retention: 30d', after: 'retention: 365d', entities: ['v_helphub'], sev: 'MEDIUM' },
  { t: '2026-09-15T10:21', type: 'new vendor', text: 'HelpHub added subprocessor LLMCo (US).', before: 'subprocessors: CloudHost (EU)', after: 'subprocessors: CloudHost (EU), LLMCo (US)', entities: ['v_helphub', 'PRV-0237'], sev: 'HIGH' },
  { t: '2026-09-12T17:50', type: 'new purpose', text: 'Nova prompt logs tagged for model_training.', before: 'purposes: service_delivery', after: 'purposes: service_delivery, model_training', entities: ['d_prompts', 'PRV-0212'], sev: 'HIGH' },
  { t: '2026-09-10T09:00', type: 'broader access', text: 'Gateway logs readable by 1,200 people (+380).', before: 'readers: 820', after: 'readers: 1,200', entities: ['d_applogs'], sev: 'MEDIUM' },
  { t: '2026-09-08T15:36', type: 'new region', text: 'Location history replicated to eu-west.', before: 'regions: us-east', after: 'regions: us-east, eu-west', entities: ['d_lochist'], sev: 'MEDIUM' },
  { t: '2026-09-04T12:12', type: 'new model', text: 'Nova Memory Extractor registered.', before: '—', after: 'model registered · review pending', entities: ['mdl_memory', 'PRV-0236'], sev: 'LOW' },
  { t: '2026-09-02T08:30', type: 'positive', text: 'Pulse moved cycle prediction fully on device.', before: 'hosting: internal cloud', after: 'hosting: on device', entities: ['mdl_pulse'], sev: 'GOOD' },
  { t: '2026-08-30T19:44', type: 'permission change', text: 'Service account svc-growth-etl granted warehouse-wide read.', before: 'scope: marts.growth.*', after: 'scope: *.*', entities: ['s_wh'], sev: 'MEDIUM' }
];

/* ── Consent ────────────────────────────────────────────────── */
var consentConsumers = [
  { id: 'cc1', name: 'Web collection (tag manager)', system: 'n_web', mode: 'read-time', p50: 0.2, p95: 0.9, p99: 2, stale: 0 },
  { id: 'cc2', name: 'Mobile SDK collection', system: 'n_app', mode: 'read-time', p50: 0.5, p95: 4, p99: 30, stale: 0 },
  { id: 'cc3', name: 'Checkout API', system: 's_checkout', mode: 'read-time', p50: 0.1, p95: 0.4, p99: 1, stale: 0 },
  { id: 'cc4', name: 'Consent cache (edge)', system: 's_cache', mode: 'cached 15 min', p50: 420, p95: 900, p99: 900, stale: 0 },
  { id: 'cc5', name: 'Warehouse reads (analytics)', system: 's_wh', mode: 'not checked', p50: null, p95: null, p99: null, stale: 48000000 },
  { id: 'cc6', name: 'Search personalisation', system: 's_search', mode: 'read-time', p50: 0.3, p95: 1.2, p99: 3, stale: 0 },
  { id: 'cc7', name: 'Audience Builder (nightly)', system: 's_audsvc', mode: 'nightly batch', p50: 43200, p95: 86400, p99: 90000, stale: 0 },
  { id: 'cc8', name: 'Ads export → AdReach', system: 's_mktg', mode: 'filter missing', p50: null, p95: null, p99: null, stale: 1300000 },
  { id: 'cc9', name: 'Conversion API forwarder', system: 's_capi', mode: 'cached 24h', p50: 43200, p95: 86400, p99: 86400, stale: 0 },
  { id: 'cc10', name: 'Lookalike model features', system: 'mdl_lookalike', mode: 'weekly retrain', p50: 302400, p95: 604800, p99: 604800, stale: 0 },
  { id: 'cc11', name: 'AdReach (vendor)', system: 'v_adreach', mode: 'opt-out not sent', p50: null, p95: null, p99: null, stale: 1300000 },
  { id: 'cc12', name: 'MailPost (marketing email)', system: 'v_mailpost', mode: 'webhook', p50: 30, p95: 180, p99: 600, stale: 0 },
  { id: 'cc13', name: 'Pulse health reads', system: 's_pulseapi', mode: 'read-time', p50: 0.1, p95: 0.3, p99: 0.8, stale: 0 },
  { id: 'cc14', name: 'Nova training pipeline', system: 's_novalogs', mode: 'not checked', p50: null, p95: null, p99: null, stale: 22000000 }
];

/* ── Deletion: the 26 systems a Forget-Me request must reach ── */
var deletionTargets = [
  ['s_profile', 'primary database', 'hard delete', 'verified'],
  ['s_profile', 'read replicas', 'replication', 'verified'],
  ['s_cache', 'session & consent cache', 'cache invalidation', 'verified'],
  ['s_txn', 'transaction store', 'hard delete + legal-hold exception', 'verified'],
  ['s_bus', 'event stream (compacted)', 'tombstone', 'verified'],
  ['s_wh', 'core warehouse', 'delete-by-id job', 'verified'],
  ['s_logs', 'application logs', 'rotation (395d)', 'failed'],
  ['s_search', 'search index', 'reindex on delete', 'verified'],
  ['s_backup', 'snapshot backups', 'expiry + re-apply on restore', 'verified'],
  ['s_fraudfs', 'fraud feature store', 'TTL + delete-by-id', 'verified'],
  ['mdl_fraud', 'fraud model', 'retrain without ID', 'verified'],
  ['s_lochist', 'location history', 'soft delete flag (rows remain)', 'failed'],
  ['s_adswh', 'advertising warehouse', 'segment rebuild', 'verified'],
  ['s_pulsedb', 'health records', 'crypto-shredding', 'verified'],
  ['s_msgstore', 'message metadata', 'TTL (30d)', 'verified'],
  ['s_novavec', 'assistant vector store', 'delete by source (chunks survive)', 'failed'],
  ['s_novalogs', 'prompt logs', 'none', 'failed'],
  ['s_supportsvc', 'support transcripts', 'orchestrator', 'verified'],
  ['s_family', 'family accounts', 'orchestrator', 'verified'],
  ['v_helphub', 'HelpHub CRM', 'vendor deletion API', 'waiting'],
  ['v_adreach', 'AdReach Network', 'vendor deletion API', 'waiting'],
  ['v_mailpost', 'MailPost', 'vendor deletion API', 'verified'],
  ['v_parcelry', 'Parcelry', 'vendor deletion API', 'verified'],
  ['v_vaultline', 'Vaultline', 'vendor API + attestation', 'verified'],
  ['v_signalrisk', 'SignalRisk', 'vendor deletion API', 'verified'],
  ['s_idres', 'identity graph', 'unknown', 'unknown']
];

/* ── User rights requests (generated deterministically) ─────── */
var rightsTypes = ['ACCESS', 'DELETE', 'CORRECT', 'PORT', 'OPT OUT', 'OBJECT', 'LIMIT SENSITIVE USE'];

/* ── Reviews (operating model) ──────────────────────────────── */
var reviewStages = ['INTAKE', 'TRIAGE', 'DESIGN REVIEW', 'BUILD CHECK', 'LAUNCH GATE', 'POST-LAUNCH AUDIT'];
var reviews = [
  { id: 'RV-311', feature: 'f_memory', stage: 'LAUNCH GATE', risk: 'HIGH', age: 21, blockers: 1, reviewer: 'J. Moreau' },
  { id: 'RV-318', feature: 'f_reorder', stage: 'DESIGN REVIEW', risk: 'MEDIUM', age: 9, blockers: 0, reviewer: 'N. Haddad' },
  { id: 'RV-320', feature: 'f_browse', stage: 'BUILD CHECK', risk: 'HIGH', age: 34, blockers: 2, reviewer: 'J. Moreau' },
  { id: 'RV-322', feature: 'f_capi', stage: 'POST-LAUNCH AUDIT', risk: 'MEDIUM', age: 60, blockers: 0, reviewer: 'A. Petrov', drift: true },
  { id: 'RV-325', feature: 'f_lookalike', stage: 'POST-LAUNCH AUDIT', risk: 'HIGH', age: 140, blockers: 0, reviewer: null, drift: true },
  { id: 'RV-327', feature: 'f_pickup', stage: 'POST-LAUNCH AUDIT', risk: 'HIGH', age: 400, blockers: 0, reviewer: 'N. Haddad', drift: true },
  { id: 'RV-330', feature: 'f_cycle', stage: 'POST-LAUNCH AUDIT', risk: 'HIGH', age: 30, blockers: 0, reviewer: 'J. Moreau' },
  { id: 'RV-331', feature: 'f_linkprev', stage: 'TRIAGE', risk: 'MEDIUM', age: 4, blockers: 0, reviewer: null },
  { id: 'RV-333', feature: 'f_rag', stage: 'POST-LAUNCH AUDIT', risk: 'MEDIUM', age: 45, blockers: 0, reviewer: 'A. Petrov' },
  { id: 'RV-334', feature: 'f_chat', stage: 'INTAKE', risk: 'MEDIUM', age: 2, blockers: 0, reviewer: null },
  { id: 'RV-335', feature: 'f_search', stage: 'POST-LAUNCH AUDIT', risk: 'LOW', age: 12, blockers: 0, reviewer: 'automation' },
  { id: 'RV-336', feature: 'f_p2p', stage: 'BUILD CHECK', risk: 'LOW', age: 3, blockers: 0, reviewer: 'automation' },
  { id: 'RV-337', feature: 'f_family', stage: 'DESIGN REVIEW', risk: 'HIGH', age: 16, blockers: 1, reviewer: 'N. Haddad' },
  { id: 'RV-338', feature: 'f_fraud', stage: 'POST-LAUNCH AUDIT', risk: 'HIGH', age: 5, blockers: 0, reviewer: 'J. Moreau', drift: true },
  { id: 'RV-339', feature: 'f_oneclick', stage: 'TRIAGE', risk: 'LOW', age: 1, blockers: 0, reviewer: null },
  { id: 'RV-340', feature: 'f_heart', stage: 'INTAKE', risk: 'MEDIUM', age: 1, blockers: 0, reviewer: null }
];

/* 8-question answers per feature. null = UNKNOWN (and is shown as a finding). */
var eightQ = {
  f_fraud: {
    VALUE: 'Block card-testing and account takeover at checkout; chargebacks fell 38% after launch.',
    DATA: 'Customer ID, device fingerprint, IP, velocity counters, account age.',
    IDENTITY: 'Yes — customer ID and device fingerprint are durable; fingerprint is cross-app.',
    FLOW: 'Checkout → Fraud Service → Feature Store → Fraud Model; SignalRisk (processor). NEW: Feature Store → Marketing Audience Builder → AdReach.',
    ACCESS: '18 people, 3 services — plus Marketing since 2026-09-25 (approved by a human as "analytics").',
    TIME: 'Features 180d TTL (enforced). Score bands in ads warehouse 390d.',
    MISUSE: 'Secondary use of risk signals for targeting; discrimination against people flagged as risky; linkage of fingerprint to advertising ID.',
    REDUCE: 'Fraud-scoped identifier; query-time purpose enforcement; remove advertising consumer; bucket velocity counters.'
  },
  f_browse: {
    VALUE: 'Know which extension features are used, to prioritise the roadmap.',
    DATA: 'Account ID, full URL, page title, feature used, timestamp.',
    IDENTITY: 'Yes — account ID; full URLs are identifying on their own (tokens, names in paths).',
    FLOW: 'Extension → Telemetry Collector → Clearsight Analytics (third party).',
    ACCESS: '22 internal, plus vendor staff (unknown count).',
    TIME: '90d internal; vendor keeps 400d against a 90d contract.',
    MISUSE: 'Sensitive inference from URLs (clinics, legal help); profile linkage at the vendor.',
    REDUCE: 'Send feature_used only; derive URL category on device; drop account ID; aggregate to daily counts.'
  },
  f_memory: {
    VALUE: 'Users stop repeating preferences to the assistant.',
    DATA: 'Free-text memories extracted from conversations.',
    IDENTITY: 'Yes — user ID; memory text may name people.',
    FLOW: 'Nova Orchestrator → Memory Extractor (Lumen, isolated) → Memory Store.',
    ACCESS: 'Service only; staff access not yet defined.',
    TIME: null,
    MISUSE: 'Remembering T4 facts (health) the user did not intend to keep; memories surfacing in shared contexts.',
    REDUCE: 'Exclude T4 categories; user-visible memory list with delete; 12-month expiry; per-memory provenance.'
  },
  f_pickup: {
    VALUE: 'Suggest the nearest pickup point at checkout.',
    DATA: 'Precise latitude/longitude, accuracy, timestamp, customer ID.',
    IDENTITY: 'Yes — location traces identify home and work within days.',
    FLOW: 'App → Location Service → Location History → (EU replica, Audience Builder).',
    ACCESS: '41 people, 7 services.',
    TIME: 'Declared 30d; observed 547d; no TTL.',
    MISUSE: 'Surveillance; home/work inference; sale of movement patterns via SDK.',
    REDUCE: 'Compute nearest pickup on device; store only the chosen pickup ID; no history at all.'
  },
  f_reorder: {
    VALUE: 'Remind a customer when a consumable is likely running out.',
    DATA: 'Order history per SKU, cadence estimates.',
    IDENTITY: 'Yes — customer ID.',
    FLOW: 'Warehouse → Reorder Recommender → push notification service.',
    ACCESS: 'Storefront Growth (12 people).',
    TIME: '180d training window.',
    MISUSE: 'Sensitive inference from SKUs (pregnancy tests, medication); household leakage via shared devices\' notifications.',
    REDUCE: 'Exclude sensitive SKU categories; generic notification text on lock screen; on-device cadence model.'
  },
  f_cycle: {
    VALUE: 'Predict a user\'s next cycle for them, privately.',
    DATA: 'Cycle day, symptoms, free-text notes.',
    IDENTITY: 'Pseudonymous Pulse user ID (purpose-scoped).',
    FLOW: 'Device (model runs here) → Pulse API (encrypted sync only).',
    ACCESS: '4 people via break-glass; 1 service.',
    TIME: '365d, crypto-shredding on delete.',
    MISUSE: 'Sensitive inference if joined to any other context — which PRV-0233 shows the SDK makes possible.',
    REDUCE: 'Already strong. Remaining: remove MAID from the SDK bundle.'
  }
};

/* ── Trackers (web + mobile) ────────────────────────────────── */
var trackers = [
  { id: 'tr1', name: 'ns_uid', kind: 'cookie', domain: 'northstar.example', company: 'Northstar', party: 'first', purpose: 'analytics', identifier: 'i_cookie', lifespan: '400d', where: 'all web', fields: 'uid', consent: 'analytics', recipient: 'Northstar', review: 'reviewed', flags: ['outlives purpose'] },
  { id: 'tr2', name: 'pixelpeak.js', kind: 'pixel', domain: 'px.pixelpeak.example', company: 'PixelPeak', party: 'third', purpose: 'advertising', identifier: 'i_hemail', lifespan: 'unknown', where: '/checkout/*, /account/*', fields: 'full URL, order value, hashed email', consent: 'none checked', recipient: 'PixelPeak + unknown exchange', review: 'unreviewed', flags: ['authenticated page', 'full URL', 'unreviewed'] },
  { id: 'tr3', name: 'GeoGrid SDK 3.2.1', kind: 'sdk', domain: 'api.geogrid.example', company: 'GeoGrid', party: 'third', purpose: 'unknown', identifier: 'i_maid', lifespan: 'unknown', where: 'Storefront iOS/Android', fields: 'lat, lon, MAID', consent: 'OS location only', recipient: 'GeoGrid + unknown buyers', review: 'unreviewed', flags: ['unreviewed', 'advertising ID misuse'] },
  { id: 'tr4', name: 'Clearsight tag', kind: 'sdk', domain: 'c.clearsight.example', company: 'Clearsight', party: 'third', purpose: 'analytics', identifier: 'i_customer', lifespan: '400d', where: 'browser extension', fields: 'full URL, title, account ID', consent: 'analytics', recipient: 'Clearsight', review: 'unreviewed', flags: ['full URL', 'PII in query string'] },
  { id: 'tr5', name: 'Pulse analytics beacon', kind: 'sdk', domain: 't.northstar.example', company: 'Northstar', party: 'first', purpose: 'analytics', identifier: 'i_maid', lifespan: 'unknown', where: 'Pulse iOS/Android', fields: 'device ID, MAID, screen name', consent: 'unknown', recipient: 'Advertising warehouse', review: 'unreviewed', flags: ['health context', 'advertising ID misuse'] },
  { id: 'tr6', name: 'CAPI forwarder', kind: 'server-side', domain: 'capi.northstar.example', company: 'Northstar → AdReach', party: 'first→third', purpose: 'advertising', identifier: 'i_hemail', lifespan: '180d at partner', where: 'server', fields: 'hashed email, order value, IP', consent: 'advertising (cached 24h)', recipient: 'AdReach', review: 'reviewed', flags: ['server-side forwarding'] },
  { id: 'tr7', name: 'Email open pixel', kind: 'email pixel', domain: 'o.mailpost.example', company: 'MailPost', party: 'third', purpose: 'analytics', identifier: 'i_email', lifespan: 'per send', where: 'marketing email', fields: 'open time, IP', consent: 'marketing email', recipient: 'MailPost', review: 'reviewed', flags: [] },
  { id: 'tr8', name: 'link decoration ?nsclid=', kind: 'link decoration', domain: 'northstar.example', company: 'Northstar', party: 'first', purpose: 'advertising', identifier: 'i_cookie', lifespan: '90d', where: 'outbound ad links', fields: 'click ID', consent: 'advertising', recipient: 'AdReach', review: 'reviewed', flags: [] },
  { id: 'tr9', name: 'metrics.northstar.example (CNAME → Clearsight)', kind: 'CNAME', domain: 'metrics.northstar.example', company: 'Clearsight', party: 'third (disguised)', purpose: 'analytics', identifier: 'i_cookie', lifespan: '400d', where: 'help center', fields: 'page URL, cookie', consent: 'analytics', recipient: 'Clearsight', review: 'unreviewed', flags: ['CNAME tracking', 'unreviewed'] },
  { id: 'tr10', name: 'Fraud device fingerprint', kind: 'fingerprinting', domain: 'northstar.example', company: 'Northstar', party: 'first', purpose: 'fraud_prevention', identifier: 'i_fp', lifespan: 'weeks', where: 'checkout', fields: 'canvas, fonts, UA', consent: 'n/a (fraud)', recipient: 'SignalRisk', review: 'reviewed', flags: ['fraud signal reused for ads'] },
  { id: 'tr11', name: 'Consent-mode tag manager', kind: 'tag manager', domain: 'northstar.example', company: 'Northstar', party: 'first', purpose: 'service_delivery', identifier: null, lifespan: 'session', where: 'marketing pages', fields: 'consent state', consent: 'n/a', recipient: 'Northstar', review: 'reviewed', flags: [] },
  { id: 'tr12', name: 'Support widget', kind: 'sdk', domain: 'w.helphub.example', company: 'HelpHub', party: 'third', purpose: 'customer_support', identifier: 'i_email', lifespan: '365d', where: 'help center (signed in)', fields: 'email, page URL, transcript', consent: 'n/a', recipient: 'HelpHub + LLMCo', review: 'reviewed', flags: ['authenticated page'] }
];

/* Pages × trackers heat (for the Tracking page) */
var trackPages = [
  { page: '/ (home)', ctx: 'public', trackers: ['tr1', 'tr11', 'tr8'] },
  { page: '/search', ctx: 'public', trackers: ['tr1', 'tr11'] },
  { page: '/product/*', ctx: 'public', trackers: ['tr1', 'tr11', 'tr8'] },
  { page: '/checkout/*', ctx: 'authenticated · financial', trackers: ['tr1', 'tr2', 'tr10'] },
  { page: '/account/*', ctx: 'authenticated', trackers: ['tr1', 'tr2'] },
  { page: '/help/*', ctx: 'authenticated', trackers: ['tr1', 'tr9', 'tr12'] },
  { page: 'Storefront app', ctx: 'mobile', trackers: ['tr3', 'tr1'] },
  { page: 'Pulse app', ctx: 'health', trackers: ['tr5'] },
  { page: 'Kids profile (/family)', ctx: 'children', trackers: ['tr1'] },
  { page: 'Marketing email', ctx: 'email', trackers: ['tr7', 'tr8'] }
];

/* ── PETs ───────────────────────────────────────────────────── */
var pets = [
  { id: 'minimize', name: 'Minimisation', group: 'REDUCE DATA', threat: ['exposure', 'surveillance', 'breach'], benefit: 'Data that is never collected cannot leak, be subpoenaed or be misused.', utility: 'Low–none if the field was not needed', perf: 'Negative cost', trust: 'None', complexity: 'Low', residual: 'Whatever remains', fit: ['f_pickup', 'f_browse'] },
  { id: 'ondevice', name: 'On-device processing', group: 'REDUCE DATA', threat: ['exposure', 'surveillance', 'insider', 'breach'], benefit: 'Raw data never reaches the server.', utility: 'Limited by device compute', perf: 'Device CPU/battery', trust: 'Device integrity', complexity: 'Medium', residual: 'Outputs that leave the device', fit: ['f_pickup', 'f_cycle', 'f_browse'] },
  { id: 'retention', name: 'Short retention', group: 'REDUCE DATA', threat: ['breach', 'exposure', 'secondary use'], benefit: 'Shrinks the window in which anything can go wrong.', utility: 'Loses long-range analysis', perf: 'None', trust: 'TTL actually enforced', complexity: 'Low', residual: 'Copies outside the TTL scope', fit: ['f_pickup', 'f_memory'] },
  { id: 'generalize', name: 'Generalisation', group: 'REDUCE DATA', threat: ['re-identification', 'surveillance'], benefit: 'City not coordinates; age band not birth date.', utility: 'Coarser answers', perf: 'None', trust: 'None', complexity: 'Low', residual: 'Rare combinations still unique', fit: ['f_pickup'] },
  { id: 'pseudo', name: 'Pseudonymisation', group: 'TRANSFORM DATA', threat: ['linkability', 'insider'], benefit: 'Separates identity from behaviour; scoped tokens stop cross-context joins.', utility: 'Mostly preserved', perf: 'Token service latency', trust: 'Token vault holder', complexity: 'Medium', residual: 'Re-identification via quasi-identifiers; it is NOT anonymisation', fit: ['f_fraud', 'f_browse'] },
  { id: 'kanon', name: 'k-anonymity family', group: 'TRANSFORM DATA', threat: ['re-identification'], benefit: 'Every record hides in a crowd of ≥k.', utility: 'Suppression and coarsening', perf: 'Batch compute', trust: 'Adversary knowledge assumptions', complexity: 'Medium', residual: 'Homogeneity and background-knowledge attacks', fit: ['f_lookalike'] },
  { id: 'dp', name: 'Differential privacy', group: 'TRANSFORM DATA', threat: ['re-identification', 'membership inference'], benefit: 'Provable bound on what any output reveals about one person.', utility: 'Noise; hurts small groups', perf: 'Low', trust: 'Correct accounting of ε', complexity: 'High', residual: 'Budget exhaustion; ε chosen badly', fit: ['f_browse', 'f_reorder'] },
  { id: 'synthetic', name: 'Synthetic data', group: 'TRANSFORM DATA', threat: ['exposure in testing'], benefit: 'Realistic data for dev/test without real people.', utility: 'Misses rare patterns', perf: 'Generation cost', trust: 'Generator not memorising', complexity: 'Medium', residual: 'Memorised outliers unless trained with DP', fit: [] },
  { id: 'fl', name: 'Federated learning', group: 'PROTECT COMPUTATION', threat: ['exposure', 'insider'], benefit: 'Train without centralising raw data.', utility: 'Slower convergence', perf: 'Device + coordination', trust: 'Aggregator; updates can leak without DP', complexity: 'High', residual: 'Gradient leakage', fit: ['f_cycle', 'f_reorder'] },
  { id: 'secagg', name: 'Secure aggregation', group: 'PROTECT COMPUTATION', threat: ['insider', 'aggregator curiosity'], benefit: 'Server sees only the sum.', utility: 'Only aggregates', perf: 'Protocol rounds', trust: 'Enough honest clients', complexity: 'High', residual: 'The sum itself', fit: ['f_cycle'] },
  { id: 'mpc', name: 'Secure multi-party computation', group: 'PROTECT COMPUTATION', threat: ['partner', 'data sharing'], benefit: 'Compute a joint result without revealing inputs.', utility: 'Exact', perf: 'Heavy', trust: 'Non-colluding parties', complexity: 'Very high', residual: 'Output leakage', fit: ['f_capi'] },
  { id: 'he', name: 'Homomorphic encryption', group: 'PROTECT COMPUTATION', threat: ['processor', 'cloud'], benefit: 'Compute on ciphertext.', utility: 'Limited operations', perf: 'Very heavy', trust: 'Key holder', complexity: 'Very high', residual: 'Output leakage', fit: [] },
  { id: 'tee', name: 'Trusted execution environments', group: 'PROTECT COMPUTATION', threat: ['insider', 'processor'], benefit: 'Operator cannot read memory during compute.', utility: 'Exact', perf: 'Moderate', trust: 'Hardware vendor; side channels', complexity: 'High', residual: 'Side-channel attacks', fit: ['f_memory', 'f_rag'] },
  { id: 'psi', name: 'Private set intersection', group: 'PROTECT COMPUTATION', threat: ['partner', 'linkability'], benefit: 'Find overlap without revealing non-matches.', utility: 'Exact intersection', perf: 'Moderate', trust: 'Honest-but-curious partner', complexity: 'High', residual: 'The intersection itself', fit: ['f_capi', 'f_lookalike'] }
];

/* ── Differential privacy ledger ────────────────────────────── */
var dp = {
  dataset: 'insights_public_stats', mechanism: 'Gaussian (zCDP accounting, converted)', delta: '1e-8', sensitivity: '1 (per user contribution capped)', contribution: 'each person counted at most once per city × category × month',
  unit: 'per user, per calendar year, across all releases', total: 4, population: 48000000,
  releases: [
    { q: 'Q1', desc: 'Monthly top categories by city', eps: 1.0, date: '2026-02-01' },
    { q: 'Q2', desc: 'Weekday vs weekend basket size', eps: 0.5, date: '2026-04-15' },
    { q: 'Q3', desc: 'Seasonal category shifts', eps: 1.0, date: '2026-06-30' },
    { q: 'Q4', desc: 'City-level delivery demand', eps: 1.0, date: '2026-09-01' }
  ]
};

/* ── Regulations / policies → obligations ───────────────────── */
var regulations = [
  { id: 'reg_gdpr', name: 'GDPR', scope: 'EU/EEA residents', obligations: [
    { id: 'ob1', text: 'Erasure on request', data: 'd_profile', systems: 26, control: 'c_delete_orch', evidence: 'c_delete_verify', status: 'partial', note: '24 of 26 systems verifiable' },
    { id: 'ob2', text: 'Purpose limitation', data: 'd_fraudfeat', systems: 3, control: 'c_purpose_fs', evidence: null, status: 'gap', note: 'human approval only; drift found' },
    { id: 'ob3', text: 'Transfer safeguards', data: 'd_transcripts', systems: 2, control: null, evidence: null, status: 'gap', note: 'new US subprocessor' },
    { id: 'ob4', text: 'Special-category processing basis', data: 'd_pulsecycle', systems: 2, control: 'c_purpose_runtime', evidence: 'c_purpose_runtime', status: 'met', note: 'explicit consent checked at read' } ] },
  { id: 'reg_ccpa', name: 'CCPA / CPRA', scope: 'California residents', obligations: [
    { id: 'ob5', text: 'Opt-out of sale/sharing honoured', data: 'd_audience', systems: 4, control: 'c_consent_batch', evidence: null, status: 'gap', note: 'opt-outs not reaching AdReach' },
    { id: 'ob6', text: 'Limit use of sensitive personal information', data: 'd_lochist', systems: 7, control: null, evidence: null, status: 'gap', note: 'location used for ads' },
    { id: 'ob7', text: 'Right to know / access', data: 'd_profile', systems: 22, control: 'c_delete_orch', evidence: 'c_delete_verify', status: 'met', note: '' } ] },
  { id: 'reg_coppa', name: 'COPPA', scope: 'Children under 13 (US)', obligations: [
    { id: 'ob8', text: 'Verifiable parental consent', data: 'd_family', systems: 4, control: 'c_children', evidence: 'c_children', status: 'met', note: '' },
    { id: 'ob9', text: 'No behavioural ads to children', data: 'd_family', systems: 4, control: 'c_children', evidence: null, status: 'partial', note: 'ns_uid cookie present on /family' } ] },
  { id: 'reg_hipaa', name: 'HIPAA (where applicable)', scope: 'Covered-entity partnerships only', obligations: [
    { id: 'ob10', text: 'Business associate safeguards for partner data', data: 'd_pulsecycle', systems: 2, control: 'c_cryptoshred', evidence: 'c_cryptoshred', status: 'met', note: 'Pulse is consumer app; applies only to clinic pilot' } ] },
  { id: 'reg_glba', name: 'GLBA', scope: 'Northstar Pay', obligations: [
    { id: 'ob11', text: 'Safeguard customer financial information', data: 'd_txn', systems: 4, control: 'c_tokenise', evidence: 'c_tokenise', status: 'met', note: '' } ] },
  { id: 'reg_pci', name: 'PCI DSS', scope: 'Card data', obligations: [
    { id: 'ob12', text: 'Do not store PAN', data: 'd_txn', systems: 2, control: 'c_tokenise', evidence: 'c_tokenise', status: 'met', note: '' } ] },
  { id: 'reg_internal', name: 'Northstar policy PP-12', scope: 'Internal', obligations: [
    { id: 'ob13', text: 'No personal data in logs', data: 'd_applogs', systems: 6, control: 'c_policy_nolog', evidence: null, status: 'gap', note: 'policy only; runtime redactor failing' },
    { id: 'ob14', text: 'Every dataset declares retention', data: 'd_orders_wh', systems: 25, control: 'c_ttl_wh', evidence: 'c_retention_scan', status: 'partial', note: '' } ] }
];

/* ── Maturity ───────────────────────────────────────────────── */
var maturityLevels = ['AD HOC', 'DOCUMENTED', 'STANDARDIZED', 'AUTOMATED', 'VERIFIABLE'];
var maturity = [
  ['Data Discovery', 3, 'Schema registry tags tiers; SDK streams undiscovered.'],
  ['Data Lineage', 2, 'Warehouse lineage automated; streams and vendors manual.'],
  ['Purpose Governance', 1, 'Purpose tags exist; enforced at runtime only in Pulse.'],
  ['Consent', 3, 'Read-time checks for 9 of 14 consumers.'],
  ['Retention', 3, 'Drift scanner is verifiable; half the stores still lack TTL.'],
  ['Deletion', 4, 'Orchestrator + verification scan with canaries.'],
  ['Identity', 1, 'Scoped identifiers are a standard nobody enforces.'],
  ['Access', 3, 'RBAC + sensitive query monitoring; JIT still planned.'],
  ['Vendor Governance', 1, 'Attestations annual and incomplete.'],
  ['Product Review', 3, 'Launch gate is machine-checked; post-launch drift under-watched.'],
  ['Tracking Governance', 1, 'SDK allow-list is a spreadsheet.'],
  ['AI Privacy', 1, 'Inventory exists; memorisation testing absent.'],
  ['PET Usage', 3, 'DP accountant, on-device Pulse, crypto-shredding.'],
  ['Enforcement', 2, 'Runtime controls cluster in security, not purpose.'],
  ['Auditing', 3, 'Continuous audit for deletion, retention, access.'],
  ['Incident Response', 2, 'Postmortems name guards; not all guards shipped.'],
  ['User Rights', 3, 'Median 6 days; vendors cause most delay.'],
  ['Executive Governance', 2, 'Quarterly memo; decisions not tracked to closure.']
];

/* ── Access & insider signals ───────────────────────────────── */
var accessEvents = [
  { t: '2026-09-25T02:14', who: 'svc-growth-etl', kind: 'service account', what: 'SELECT * across 212 tables', data: 's_wh', flag: 'warehouse-wide read' },
  { t: '2026-09-24T18:40', who: 'k.ramsey (left 2026-08-31)', kind: 'inactive employee', what: 'token still valid for customer_location_history', data: 'd_lochist', flag: 'inactive employee access' },
  { t: '2026-09-24T11:03', who: 'analyst-7731', kind: 'person', what: 'export 2.1M rows customer_profile (email, phone)', data: 'd_profile', flag: 'bulk sensitive export' },
  { t: '2026-09-23T23:59', who: 'identity-resolution-job', kind: 'job', what: 'join pulse_user_id × maid (9.2M rows)', data: 'd_identity_graph', flag: 'unexpected identity join' },
  { t: '2026-09-22T03:10', who: 'oncall-sre-2', kind: 'break-glass', what: 'read health_records (1 user) — no ticket', data: 'd_pulsecycle', flag: 'unapproved break-glass usage' },
  { t: '2026-09-21T14:22', who: 'support-team-emea', kind: 'group', what: '4.8× normal account views', data: 'd_transcripts', flag: 'access spike' },
  { t: '2026-09-20T09:15', who: 'svc-audience', kind: 'service account', what: 'read fraud_features_v7 (purpose=analytics)', data: 'd_fraudfeat', flag: 'purpose mismatch' },
  { t: '2026-09-19T16:48', who: 'm.ito', kind: 'person', what: 'large join transactions × location_history', data: 'd_lochist', flag: 'sensitive join' }
];

/* ── Regions & geography ────────────────────────────────────── */
var regions = [
  { id: 'us-east', label: 'US East (Virginia)', lat: 38.9, lon: -77.4, kind: 'store' },
  { id: 'us-west', label: 'US West (Oregon)', lat: 45.6, lon: -121.2, kind: 'store' },
  { id: 'eu-west', label: 'EU West (Dublin)', lat: 53.3, lon: -6.3, kind: 'store' },
  { id: 'eu-central', label: 'EU Central (Frankfurt)', lat: 50.1, lon: 8.7, kind: 'store' },
  { id: 'in', label: 'India (Mumbai) — support centre', lat: 19.1, lon: 72.9, kind: 'process' },
  { id: 'sg', label: 'Singapore — vendor', lat: 1.35, lon: 103.8, kind: 'vendor' },
  { id: 'br', label: 'Brazil (São Paulo) — users', lat: -23.5, lon: -46.6, kind: 'users' },
  { id: 'jp', label: 'Japan (Tokyo) — users', lat: 35.7, lon: 139.7, kind: 'users' },
  { id: 'uk', label: 'UK (London) — users', lat: 51.5, lon: -0.1, kind: 'users' },
  { id: 'unknown', label: 'Unknown destination', lat: -45, lon: -150, kind: 'unknown' }
];
var geoUsers = [
  { region: 'us-east', people: 96000000 }, { region: 'eu-west', people: 58000000 }, { region: 'uk', people: 14000000 },
  { region: 'br', people: 19000000 }, { region: 'in', people: 12000000 }, { region: 'jp', people: 9000000 }, { region: 'sg', people: 4000000 }
];
var transfers = [
  { from: 'eu-west', to: 'us-east', what: 'Link preview URLs (Messenger)', tier: 3, basis: 'SCCs', flow: 'fl30', reviewed: true },
  { from: 'us-east', to: 'eu-west', what: 'Location history replica', tier: 3, basis: 'n/a (US→EU)', flow: 'fl13', reviewed: false },
  { from: 'eu-west', to: 'us-east', what: 'Support transcripts → LLMCo', tier: 3, basis: 'none on file', flow: 'fl23', reviewed: false },
  { from: 'us-east', to: 'eu-west', what: 'DP aggregates (Insights)', tier: 0, basis: 'aggregate', flow: 'fl29', reviewed: true },
  { from: 'eu-west', to: 'in', what: 'Support agent access (EMEA overflow)', tier: 3, basis: 'SCCs', flow: null, reviewed: true },
  { from: 'us-east', to: 'sg', what: 'Clearsight processing node', tier: 3, basis: 'unknown', flow: 'fl17', reviewed: false },
  { from: 'us-east', to: 'unknown', what: 'GeoGrid SDK data buyers', tier: 3, basis: 'unknown', flow: 'fl15', reviewed: false },
  { from: 'eu-central', to: 'us-east', what: 'Pulse SDK beacon → ads warehouse', tier: 4, basis: 'none', flow: 'fl18', reviewed: false },
  { from: 'br', to: 'us-east', what: 'All Brazilian user data (primary)', tier: 3, basis: 'contract', flow: null, reviewed: true },
  { from: 'jp', to: 'us-west', what: 'Nova prompts', tier: 3, basis: 'consent (ToS)', flow: null, reviewed: true }
];

/* ── Hypothetical person for "what could we know?" ──────────── */
var persona = {
  name: 'Hypothetical person "A."', blurb: 'Uses Storefront, Checkout, Pulse and Nova on one phone; has 2FA on; opened one support chat. Not a real person.',
  starts: ['i_email', 'i_device'],
  /* facts: attribute, source dataset, join path (identifier chain), kind FACT/INFERENCE, tier, blockers: controls that would remove it */
  facts: [
    { a: 'Name, email, postal address, date of birth', ds: 'd_profile', path: ['i_email', 'i_customer'], kind: 'FACT', tier: 3, blockedBy: [] },
    { a: 'Phone number (given for 2FA)', ds: 'd_phone2fa', path: ['i_customer', 'i_phone'], kind: 'FACT', tier: 2, blockedBy: [] },
    { a: 'Every purchase for 7 years, with amounts', ds: 'd_txn', path: ['i_customer'], kind: 'FACT', tier: 3, blockedBy: ['minimise'] },
    { a: 'Where they stood at each purchase (precise)', ds: 'd_purchase', path: ['i_customer', 'i_device'], kind: 'FACT', tier: 3, blockedBy: ['minimise'] },
    { a: 'Home and work locations', ds: 'd_lochist', path: ['i_customer'], kind: 'INFERENCE', tier: 3, blockedBy: ['ttl'] },
    { a: '18 months of movement history', ds: 'd_lochist', path: ['i_customer'], kind: 'FACT', tier: 3, blockedBy: ['ttl'] },
    { a: '"Likely a parent" (from basket)', ds: 'd_orders_wh', path: ['i_customer'], kind: 'INFERENCE', tier: 3, blockedBy: ['purpose'] },
    { a: 'Fraud risk band', ds: 'd_fraudfeat', path: ['i_customer', 'i_device', 'i_fp'], kind: 'INFERENCE', tier: 2, blockedBy: ['purpose', 'scoped'] },
    { a: 'Which Pulse screens they open (cycle, symptoms)', ds: 'd_pulseinstall', path: ['i_device', 'i_pulse'], kind: 'FACT', tier: 4, blockedBy: ['scoped'] },
    { a: '"Health interest" advertising segment', ds: 'd_audience', path: ['i_device', 'i_maid'], kind: 'INFERENCE', tier: 4, blockedBy: ['scoped', 'purpose'] },
    { a: 'What they asked the assistant (400 days)', ds: 'd_prompts', path: ['i_customer', 'i_convo'], kind: 'FACT', tier: 3, blockedBy: ['ttl'] },
    { a: 'Health topics mentioned to the assistant', ds: 'd_prompts', path: ['i_customer'], kind: 'INFERENCE', tier: 4, blockedBy: ['ttl', 'purpose'] },
    { a: 'Their support conversation, verbatim', ds: 'd_transcripts', path: ['i_email'], kind: 'FACT', tier: 3, blockedBy: [] },
    { a: 'Websites visited via the browser extension', ds: 'd_browse', path: ['i_customer'], kind: 'FACT', tier: 3, blockedBy: ['minimise'] },
    { a: 'When they reset their password (from logs)', ds: 'd_applogs', path: ['i_email'], kind: 'FACT', tier: 2, blockedBy: ['ttl'] },
    { a: 'Linked advertising ID across apps', ds: 'd_identity_graph', path: ['i_customer', 'i_maid'], kind: 'INFERENCE', tier: 2, blockedBy: ['scoped'] },
    { a: 'Their messages', ds: 'd_msgmeta', path: [], kind: 'UNKNOWABLE', tier: 3, blockedBy: [], note: 'End-to-end encrypted, rotating pseudonym, no join path. Architecture made this unknowable to Northstar.' }
  ],
  outside: [
    { who: 'AdReach Network', what: 'hashed email, advertising ID, segments incl. fraud band', via: 'fl11' },
    { who: 'Clearsight Analytics', what: 'full browsing URLs with account ID (400 days)', via: 'fl17' },
    { who: 'PixelPeak (no contract)', what: 'checkout pages visited, order value, hashed email', via: 'fl16' },
    { who: 'GeoGrid (no contract)', what: 'background location + advertising ID', via: 'fl15' },
    { who: 'HelpHub → LLMCo', what: 'support transcript', via: 'fl23' },
    { who: 'Lumen Model API', what: 'redacted prompts (30-day abuse window)', via: 'fl20' }
  ],
  levers: [
    { id: 'scoped', label: 'Purpose-scoped identifiers', note: 'Pulse and fraud IDs cannot be joined to ad IDs' },
    { id: 'purpose', label: 'Query-time purpose enforcement', note: 'Reads must match the collection purpose' },
    { id: 'ttl', label: 'Enforced short retention', note: 'Location 30d · logs 30d · prompts 30d' },
    { id: 'minimise', label: 'Minimise at collection', note: 'City not coordinates; categories not URLs; 2y order history' }
  ]
};


/* ── From the field guide ───────────────────────────────────── */
/* Handshake rule (guide p.78): what pattern does each partner get? NONE = raw person-level data. */
var handshakes = { v_clearsight: 'NONE', v_adreach: 'NONE', v_parcelry: 'PERMISSION', v_helphub: 'NONE', v_vaultline: 'TOKEN',
  v_signalrisk: 'NONE', v_mailpost: 'RELAY', v_lumen: 'NONE', v_pixelpeak: 'NONE', v_geogrid: 'NONE', v_surveyloop: 'PERMISSION', v_cloudhost: 'TOKEN' };
/* Assumption bugs to test every time (guide p.45), with Northstar's latest result. */
var assumptionTests = [
  { k: 'Revocation mid-job', q: 'Batch started before the opt-out', result: 'fail', where: 'Audience Builder nightly run caches consent at 00:00', ent: 'cc7' },
  { k: 'Retries & dead letters', q: 'Payload copies nobody deletes', result: 'fail', where: 'purchase-events DLQ holds 41 days of payloads; not in deletion orchestrator', ent: 's_bus' },
  { k: 'Debug logging', q: 'The #1 place raw data leaks', result: 'fail', where: 'Emails in gateway query strings (PRV-0199)', ent: 'PRV-0199' },
  { k: 'Fallback paths', q: 'Degraded mode skips the filter', result: 'fail', where: 'Consent cache miss → CAPI forwarder defaults to "granted"', ent: 's_capi' },
  { k: 'Exports', q: 'A CSV escapes every control', result: 'fail', where: '2.1M-row profile export by analyst-7731', ent: 'd_profile' },
  { k: 'Shared devices', q: 'Notifications reveal to others', result: 'unknown', where: 'Reorder reminders show SKU names on lock screen — not yet tested', ent: 'f_reorder' },
  { k: 'Stale consent', q: 'Cached at login, never refreshed', result: 'pass', where: 'Edge consent cache TTL 15 min, verified', ent: 'cc4' },
  { k: 'Partial failures', q: 'Half the deletes succeeded', result: 'pass', where: 'Orchestrator retries + verification scan catch survivors', ent: 'c_delete_verify' }
];
/* Contextual integrity (guide p.6): does this flow match what the person expected when they shared it? */
var contextNorms = { fl10: 'Breaks the norm: shared to stop fraud, used to sell ads.', fl14: 'Breaks the norm: shared to find a pickup point, used to profile home and work.',
  fl15: 'Breaks the norm: shared to see nearby stores, sold on to unknown buyers.', fl16: 'Breaks the norm: a purchase became an ad-network signal.',
  fl17: 'Breaks the norm: using an extension is not consent to publish one\'s browsing.', fl18: 'Breaks the norm: a health app is not an ad channel.',
  fl21: 'Breaks the norm: asking for help is not volunteering training data.', fl23: 'Unclear: a support chat processed by an unnamed third party.',
  fl26: 'Breaks the norm: separate contexts stitched into one person.', fl04: 'Matches: payment details go to the payment processor.',
  fl19: 'Matches: health data stays with the health feature, encrypted per person.', fl11: 'Only with consent — and opt-outs are not arriving.' };

window.NS = {
  handshakes: handshakes, assumptionTests: assumptionTests, contextNorms: contextNorms,
  TODAY: TODAY, org: org, bus: bus, teams: teams, products: products, features: features, systems: systems,
  purposes: purposes, datasets: datasets, identifiers: identifiers, idJoins: idJoins, vendors: vendors,
  subprocessors: subprocessors, flows: flows, models: models, controls: controls, findings: findings,
  riskFactors: riskFactors, risks: risks, incidents: incidents, drift: drift, consentConsumers: consentConsumers,
  deletionTargets: deletionTargets, rightsTypes: rightsTypes, reviewStages: reviewStages, reviews: reviews,
  eightQ: eightQ, trackers: trackers, trackPages: trackPages, pets: pets, dp: dp, regulations: regulations,
  maturityLevels: maturityLevels, maturity: maturity, accessEvents: accessEvents, regions: regions,
  geoUsers: geoUsers, transfers: transfers, persona: persona
};
})();
