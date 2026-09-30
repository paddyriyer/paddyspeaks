/* Privacy Command Center v1 — the ONE privacy graph.
 *
 * Northstar is a fictional company and every record here is synthetic. No real
 * company, product, person or incident is represented. Surfaces are conceptual
 * ("web / browser", "wallet / payments"); mechanisms are described generically,
 * never as anyone's proprietary implementation.
 *
 * Everything on screen is a lens over this file:
 *   nodes      the ontology (person, identifier, credential, dataset, system, …)
 *   edges      typed relationships (HAS, LINKS, FLOWS_TO, USED_FOR, …)
 *   journeys   the paths people take (sign in, browse, pay, prove age, use AI …)
 *   the rest   scenario views that cite node ids, so a finding always points
 *              back into the graph.
 * Counts on screen are computed from these records, never typed. */
(function () {
  var G = window.PG = {};
  G.asOf = '2026-09-30';

  /* ── nodes ─────────────────────────────────────────────── */
  G.nodes = {
    p_dana: ['person', 'Dana R.', 'synthetic Northstar customer'],
    t_a: ['tenant', 'Tenant A', 'client of Ledger Cloud'], t_b: ['tenant', 'Tenant B', 'another client, same platform'],
    /* identifiers and credentials */
    id_device: ['identifier', 'device_id', 'per-install mobile ID'],
    id_cookie: ['identifier', 'first-party cookie', 'site session state'],
    id_email: ['identifier', 'email address', 'stable across services'],
    id_relay: ['identifier', 'relay address', 'one alias per service'],
    id_phone: ['identifier', 'phone number', 'recovery channel'],
    id_player: ['identifier', 'player_id', 'game identity'],
    id_ip: ['identifier', 'IP address', 'network identifier'],
    id_fp: ['identifier', 'browser fingerprint', 'fonts, screen, GPU, timezone'],
    id_click: ['identifier', 'click ID in URL', 'link decoration'],
    id_token: ['identifier', 'device payment token', 'stands in for the card number'],
    id_merchant: ['identifier', 'merchant customer ID', 'per merchant'],
    id_hash: ['identifier', 'hashed email', 'stable key shared with vendors'],
    cr_password: ['credential', 'password', 'shared secret'],
    cr_passkey: ['credential', 'passkey', 'per-site key pair'],
    cr_session: ['credential', 'session token', 'bearer token after sign-in'],
    cr_mdl: ['credential', 'digital ID', 'issuer-signed credential in the wallet'],
    /* events */
    ev_open: ['event', 'mail open', 'remote image fetched'], ev_signin: ['event', 'sign-in', 'assertion verified'],
    /* datasets */
    ds_behavior: ['dataset', 'player_events', 'Dataset A: behavior'],
    ds_customer: ['dataset', 'customers', 'Dataset B: account + transactions'],
    ds_txn: ['dataset', 'transactions', 'wallet payments'],
    ds_browse: ['dataset', 'page_views', 'URLs and referrers'],
    ds_mail: ['dataset', 'mail_bodies', 'message content'],
    ds_mailmeta: ['dataset', 'mail_metadata', 'sender, recipient, time, opens'],
    ds_fraud: ['dataset', 'fraud_signals', 'device and transaction signals'],
    ds_loc: ['dataset', 'location_history', 'precise location'],
    ds_commission: ['dataset', 'commission_records', 'every tenant, one table'],
    ds_logs: ['dataset', 'api_access_logs', 'request URLs'],
    ds_raw: ['dataset', 'raw_events (staging)', 'unmasked, object storage'],
    ds_curated: ['dataset', 'events_curated', 'masked warehouse table'],
    ds_identity: ['dataset', 'identity_store', 'raw identity records'],
    ds_export: ['dataset', 'partner_export', 'nightly file to AdReach'],
    ds_prompts: ['dataset', 'assistant_context', 'requests and tool results'],
    ds_features: ['dataset', 'feature_store', 'materialized per-user features'],
    ds_backup: ['dataset', 'backups', '35-day rotation'],
    ds_kyc: ['dataset', 'identity documents', 'copies kept by a verifier'],
    ds_authlog: ['dataset', 'sign-in events', 'time, IP, device class'],
    /* systems */
    sy_account: ['system', 'Northstar Account', 'one account for browser, mail and wallet'],
    v_ext: ['vendor', 'PageTools', 'fictional browser extension'],
    sy_bio: ['system', 'biometric unlock', 'Face ID / Touch ID-style, on device'],
    sy_authn: ['system', 'authenticator', 'holds private keys in secure hardware'],
    sy_sync: ['system', 'credential sync', 'end-to-end encrypted'],
    sy_rp: ['system', 'relying party', 'the site you sign in to'],
    sy_recovery: ['system', 'account recovery', 'fallback when a device is lost'],
    sy_browser: ['system', 'Northstar Browser', 'web / browser'],
    sy_mail: ['system', 'Northstar Mail', 'mail / communication'],
    sy_wallet: ['system', 'Northstar Wallet', 'payments, passes, IDs'],
    sy_game: ['system', 'Northstar Play', 'games app'],
    sy_odm: ['system', 'on-device model', 'runs on the phone'],
    sy_pcc: ['system', 'private compute', 'attested, stateless servers'],
    ap_gateway: ['api', 'API gateway', 'public edge'],
    sv_fraud: ['service', 'fraud service', ''],
    sy_consent: ['system', 'consent store', 'source of truth'],
    sy_batch: ['system', 'scoring batch', 'runs 09:55–10:15'],
    sy_export: ['system', 'export pipeline', 'nightly'],
    sy_primary: ['system', 'primary database', ''], sy_cache: ['system', 'cache', ''],
    sy_wh: ['system', 'analytics warehouse', ''], sy_obj: ['system', 'object storage', 'S3-like buckets'],
    sy_featstore: ['system', 'feature store', ''], sy_logsearch: ['system', 'log search', 'observability'],
    sy_emr: ['system', 'nightly aggregation job', 'EMR-like cluster'],
    sy_vpd: ['system', 'tenant database', 'row-level (VPD-style) policy'],
    sy_session: ['system', 'session context', 'sets tenant_id per connection'],
    sy_semantic: ['system', 'semantic layer', 'report models'],
    sy_pdf: ['system', 'PDF statement', 'emailed monthly'], sy_dash: ['system', 'dashboard', 'browser client'],
    sy_rcache: ['system', 'report cache', 'shared across tenants'], sy_rexport: ['system', 'CSV export', 'download'],
    /* purposes */
    pu_service: ['purpose', 'provide the service', ''], pu_fraud: ['purpose', 'fraud prevention', ''],
    pu_analytics: ['purpose', 'product analytics', ''], pu_ads: ['purpose', 'advertising', ''],
    pu_support: ['purpose', 'customer support', ''], pu_training: ['purpose', 'model training', ''],
    pu_billing: ['purpose', 'commission statements', ''], pu_age: ['purpose', 'age check', ''], pu_kyc: ['purpose', 'identity verification', ''],
    cn_ads: ['consent', 'advertising consent', ''],
    /* owners */
    ow_identity: ['owner', 'Identity Platform', ''], ow_growth: ['owner', 'Growth Analytics', ''], ow_platform: ['owner', 'Data Platform', ''],
    ow_risk: ['owner', 'Payments Risk', ''], ow_mail: ['owner', 'Mail Intelligence', ''], ow_ledger: ['owner', 'Ledger Cloud', ''], ow_ai: ['owner', 'Assistant Platform', ''],
    /* vendors and third parties (all fictional) */
    v_adreach: ['vendor', 'AdReach', 'fictional ad partner'], v_llm: ['vendor', 'Parallax AI', 'fictional third-party model'],
    v_pixel: ['vendor', 'BrightPixel', 'fictional analytics script'], v_isp: ['vendor', 'network operator', 'ISP or Wi-Fi owner'],
    v_bank: ['vendor', 'Harbor Bank', 'fictional bank'], v_bar: ['vendor', 'Corner Bar', 'fictional age-restricted venue'],
    v_issuer: ['vendor', 'State ID issuer', 'issues the digital ID'], v_merchant: ['vendor', 'Maple Outfitters', 'fictional merchant'],
    v_network: ['vendor', 'payment network', ''], v_cardissuer: ['vendor', 'card issuer', ''],
    /* models, agents, inferences */
    m_fraud: ['model', 'fraud model', ''],
    ag_assist: ['agent', 'Northstar Assistant', 'plans and books on the user’s behalf'],
    ag_support: ['agent', 'Support agent', 'resolves payment tickets'],
    in_profile: ['inference', 'person-level profile', ''], in_home: ['inference', 'home area', ''],
    in_medical: ['inference', 'possible medical trip', ''], in_hardship: ['inference', 'financial hardship', ''],
    /* controls */
    c_passkey: ['control', 'Phishing-resistant sign-in', ''], c_rp_scope: ['control', 'Per-site credential scoping', ''],
    c_sync: ['control', 'End-to-end encrypted credential sync', ''], c_recovery: ['control', 'Recovery without shared secrets', ''],
    c_session: ['control', 'Session token binding', ''], c_attest: ['control', 'Minimal device attestation', ''],
    c_id_rotate: ['control', 'Fingerprinting protection', ''], c_link_strip: ['control', 'Tracking-parameter removal', ''],
    c_ip_mask: ['control', 'Network privacy relay', ''], c_itp: ['control', 'Cross-site tracking prevention', ''],
    c_remote_content: ['control', 'Remote content protection', ''], c_relay: ['control', 'Email relay aliases', ''],
    c_tokenize: ['control', 'Device-specific payment tokens', ''], c_local_risk: ['control', 'On-device risk assessment', ''],
    c_sd: ['control', 'Selective disclosure request', ''], c_verifier_ret: ['control', 'Verifier does not keep a copy', ''],
    c_issuer_blind: ['control', 'Issuer does not learn where an ID is shown', ''],
    c_route: ['control', 'On-device-first routing', ''], c_pcc_attest: ['control', 'Verifiable private compute', ''],
    c_no_train: ['control', 'No training on requests', ''],
    c_agent_policy: ['control', 'Agent purpose and join policy', ''], c_agent_approval: ['control', 'Human approval for actions', ''],
    c_vpd: ['control', 'Tenant row policy', ''], c_report_scope: ['control', 'Report tenant scope', ''], c_server_filter: ['control', 'Server-side tenant filter', ''],
    c_consent_read: ['control', 'Consent check at read time', ''], c_delete_orch: ['control', 'Deletion orchestrator', ''],
    c_ttl: ['control', 'Retention TTL', ''], c_mask: ['control', 'Warehouse masking', ''], c_iam: ['control', 'Least-privilege IAM', ''],
    c_url_redact: ['control', 'URL redaction before logging', ''], c_join_policy: ['control', 'Cross-domain join policy', ''],
    c_vendor_ack: ['control', 'Vendor deletion acknowledgement', ''],
    c_dbsc: ['control', 'Device-bound sessions', ''], c_cookie_enc: ['control', 'Cookies encrypted to the browser', ''], c_ext_review: ['control', 'Extension permission review', ''],
    inc_export: ['incident', 'INC-14 export after revocation', '']
  };
  G.node = function (id) { var n = G.nodes[id]; return n ? { id: id, type: n[0], name: n[1], sub: n[2] } : null; };

  /* ── edges ─────────────────────────────────────────────── */
  G.edges = [
    ['p_dana', 'HAS', 'id_device'], ['p_dana', 'HAS', 'id_email'], ['p_dana', 'HAS', 'id_phone'], ['p_dana', 'HAS', 'id_player'], ['p_dana', 'HAS', 'cr_passkey'], ['p_dana', 'HAS', 'cr_mdl'], ['p_dana', 'HAS', 'id_token'],
    ['cr_passkey', 'LINKS', 'sy_rp'], ['id_phone', 'LINKS', 'sy_recovery'], ['id_email', 'LINKS', 'ds_customer'], ['id_player', 'LINKS', 'ds_behavior'], ['id_player', 'LINKS', 'ds_customer'],
    ['id_token', 'LINKS', 'ds_txn'], ['id_fp', 'LINKS', 'ds_browse'], ['id_hash', 'LINKS', 'ds_export'], ['id_device', 'LINKS', 'ds_fraud'],
    ['ds_behavior', 'FLOWS_TO', 'sy_wh'], ['ds_customer', 'FLOWS_TO', 'sy_wh'], ['ds_raw', 'FLOWS_TO', 'ds_curated'], ['ds_features', 'FLOWS_TO', 'sy_export'],
    ['sy_export', 'SHARES_WITH', 'v_adreach'], ['sy_pcc', 'SHARES_WITH', 'v_llm'], ['sy_browser', 'SHARES_WITH', 'v_pixel'], ['cr_mdl', 'SHARES_WITH', 'v_bar'], ['cr_mdl', 'SHARES_WITH', 'v_bank'],
    ['ds_fraud', 'USED_FOR', 'pu_fraud'], ['ds_fraud', 'USED_FOR', 'pu_training'], ['ds_export', 'USED_FOR', 'pu_ads'], ['pu_ads', 'REQUIRES', 'cn_ads'], ['cr_mdl', 'USED_FOR', 'pu_age'],
    ['sy_rp', 'OWNED_BY', 'ow_identity'], ['ds_fraud', 'OWNED_BY', 'ow_risk'], ['sy_pcc', 'OWNED_BY', 'ow_ai'], ['ds_commission', 'OWNED_BY', 'ow_ledger'], ['sy_wh', 'OWNED_BY', 'ow_platform'],
    ['c_passkey', 'PROTECTS', 'sy_rp'], ['c_vpd', 'PROTECTS', 'ds_commission'], ['c_consent_read', 'PROTECTS', 'ds_export'], ['c_sd', 'PROTECTS', 'cr_mdl'], ['c_route', 'PROTECTS', 'ds_prompts'],
    ['ds_behavior', 'ENABLES', 'in_profile'], ['ds_customer', 'ENABLES', 'in_profile'], ['ds_loc', 'ENABLES', 'in_home'],
    ['ag_assist', 'ACCESSES', 'ds_mail'], ['ag_assist', 'ACCESSES', 'ds_txn'], ['ag_assist', 'ACCESSES', 'ds_browse'], ['ag_assist', 'ACCESSES', 'ds_loc'], ['ag_assist', 'PRODUCES', 'in_medical'],
    ['ag_support', 'ACCESSES', 'ds_txn'], ['ag_support', 'PRODUCES', 'in_hardship'],
    ['p_dana', 'HAS', 'sy_account'], ['sy_account', 'LINKS', 'ds_browse'], ['sy_account', 'LINKS', 'ds_mailmeta'], ['sy_account', 'LINKS', 'ds_txn'], ['sy_account', 'LINKS', 'cr_passkey'], ['v_ext', 'ACCESSES', 'ds_browse'], ['c_dbsc', 'PROTECTS', 'sy_account']
  ];

  /* ── selector vocabulary ───────────────────────────────── */
  G.personas = [
    { id: 'reviewer', label: 'Reviewer', asks: 'Should this exist this way, and what exposure does the design create?' },
    { id: 'builder', label: 'Builder', asks: 'Where should the control live, and how does it propagate?' },
    { id: 'auditor', label: 'Auditor', asks: 'Can we prove the control still works, and what changed since review?' },
    { id: 'executive', label: 'Executive', asks: 'What matters, what are the options, and what risk remains?' }
  ];
  G.surfaces = [
    { id: 'all', label: 'all surfaces', j: 'signin' },
    { id: 'ident', label: 'identity & authentication', j: 'signin', emph: ['passkeys', 'key pairs', 'biometric unlock', 'device-bound identity', 'synced credentials', 'security keys', 'platform sign-in', 'SSO / OAuth', 'session tokens', 'account recovery', 'device trust', 'credential sharing'] },
    { id: 'web', label: 'web / browser', j: 'browse', emph: ['first-party state', 'third-party tracking', 'cross-site linkability', 'cookies and storage', 'fingerprinting', 'IP address', 'URL decoration', 'redirect tracking', 'embedded scripts', 'extensions', 'autofill', 'private browsing', 'network privacy'] },
    { id: 'mail', label: 'mail / communication', j: 'mail', emph: ['content', 'metadata', 'remote content', 'tracking pixels', 'IP', 'open events', 'links', 'attachments', 'contact graph', 'relay aliases', 'AI processing'] },
    { id: 'pay', label: 'wallet / payments', j: 'pay', emph: ['device tokens', 'authorization', 'fraud signals', 'merchant identity', 'loyalty', 'tickets', 'transit', 'keys', 'IDs', 'connected financial data'] },
    { id: 'did', label: 'digital identity', j: 'age', emph: ['age verification', 'identity verification', 'digital credentials', 'selective disclosure', 'device authentication', 'issuer trust', 'verifier trust'] },
    { id: 'cloud', label: 'cloud / data', j: 'report', emph: ['multi-tenancy', 'IAM', 'S3-like storage', 'distributed copies', 'warehouse', 'logs', 'exports', 'tenant isolation'] },
    { id: 'analytics', label: 'analytics', j: 'revoke', emph: ['events', 'joins', 'warehouse', 'consent', 'exports'] },
    { id: 'ai', label: 'AI / agents', j: 'ai', emph: ['on device', 'private compute', 'third-party models', 'inference', 'tool access', 'cross-domain joins', 'autonomy', 'human approval', 'audit'] },
    { id: 'vendor', label: 'third parties', j: 'revoke', emph: ['egress', 'contracts', 'subprocessors', 'deletion acknowledgement', 'regions', 'model vendors'] }
  ];
  /* Relevance: each surface offers only the journeys, questions, concerns and
   * subjects that belong to it (a wallet never offers “read mail”). “all
   * surfaces” offers everything. The tests check that every combination offered
   * here is answered by at least one finding on that surface. */
  G.relevance = {
    ident: { j: ['signin', 'account', 'share', 'delete'], q: ['know', 'whoknows', 'howlearn', 'prove', 'linkid', 'where', 'live', 'control', 'stolen', 'changed', 'worst'], c: ['identity', 'authentication', 'devicetrust', 'recovery', 'takeover', 'linkability', 'tracking', 'retention'], u: ['person', 'credential'] },
    web: { j: ['browse', 'account', 'signin'], q: ['know', 'whoknows', 'howlearn', 'prove', 'linkid', 'where', 'control', 'stolen', 'worst'], c: ['identity', 'authentication', 'devicetrust', 'takeover', 'linkability', 'tracking'], u: ['person', 'vendor'] },
    mail: { j: ['mail', 'account', 'ai'], q: ['know', 'whoknows', 'howlearn', 'linkid', 'where', 'leftdevice', 'whyleft', 'provewithout', 'infer', 'delete', 'live', 'control', 'stolen'], c: ['identity', 'recovery', 'takeover', 'linkability', 'tracking', 'ondevice', 'thirdmodel', 'inference', 'retention', 'vendor'], u: ['person', 'feature', 'vendor'] },
    pay: { j: ['pay', 'account', 'share'], q: ['know', 'whoknows', 'linkid', 'where', 'leftdevice', 'whyleft', 'provewithout', 'infer', 'agentdo', 'live', 'control', 'stolen'], c: ['identity', 'takeover', 'linkability', 'purpose', 'minimization', 'ondevice', 'inference', 'agent', 'retention'], u: ['person', 'product', 'agent'] },
    did: { j: ['age', 'share'], q: ['whoknows', 'prove', 'where', 'provewithout', 'live', 'changed', 'worst'], c: ['disclosure', 'linkability', 'retention', 'vendor'], u: ['person', 'credential'] },
    cloud: { j: ['report', 'delete'], q: ['whoknows', 'where', 'delete', 'live', 'control', 'worst'], c: ['identity', 'minimization', 'access', 'tenant', 'retention', 'deletion', 'logging'], u: ['tenant', 'dataset', 'person'] },
    analytics: { j: ['revoke', 'delete', 'browse'], q: ['know', 'whoknows', 'linkid', 'where', 'join', 'infer', 'consent', 'delete', 'live', 'control', 'changed', 'worst'], c: ['identity', 'linkability', 'consent', 'purpose', 'minimization', 'inference', 'access', 'retention', 'deletion', 'vendor'], u: ['person', 'dataset', 'vendor'] },
    ai: { j: ['ai', 'mail'], q: ['where', 'leftdevice', 'whyleft', 'infer', 'agentdo', 'delete', 'live', 'control'], c: ['ondevice', 'thirdmodel', 'inference', 'agent', 'access', 'retention', 'vendor'], u: ['person', 'agent', 'feature'] },
    vendor: { j: ['revoke', 'delete', 'share'], q: ['whoknows', 'where', 'leftdevice', 'whyleft', 'consent', 'delete', 'live', 'control', 'changed', 'worst'], c: ['disclosure', 'consent', 'thirdmodel', 'retention', 'deletion', 'vendor'], u: ['vendor', 'person', 'dataset'] }
  };
  G.questions = [
    { id: 'know', label: 'What do we know?' }, { id: 'whoknows', label: 'Who knows it?' }, { id: 'howlearn', label: 'How did they learn it?' },
    { id: 'prove', label: 'How did the user prove identity?' }, { id: 'linkid', label: 'What identifier links this activity?' },
    { id: 'where', label: 'Where did the data go?' }, { id: 'leftdevice', label: 'Did it leave the device?' }, { id: 'whyleft', label: 'Why did it leave the device?' },
    { id: 'provewithout', label: 'Can we prove this without revealing that?' }, { id: 'join', label: 'Should these datasets be joined?' },
    { id: 'infer', label: 'What can this system infer?' }, { id: 'agentdo', label: 'What can this agent do?' },
    { id: 'consent', label: 'Did consent propagate?' }, { id: 'delete', label: 'Can we delete it?' }, { id: 'live', label: 'How long does it live?' },
    { id: 'control', label: 'Did the control really work?' }, { id: 'stolen', label: 'What if the account is stolen?' }, { id: 'changed', label: 'What changed?' }, { id: 'worst', label: 'What is our worst day?' }
  ];
  G.concerns = [
    { id: 'identity', label: 'Identity' }, { id: 'authentication', label: 'Authentication' }, { id: 'devicetrust', label: 'Device trust' }, { id: 'recovery', label: 'Account recovery' }, { id: 'takeover', label: 'Account takeover' },
    { id: 'linkability', label: 'Linkability' }, { id: 'tracking', label: 'Tracking' }, { id: 'disclosure', label: 'Selective disclosure' },
    { id: 'consent', label: 'Consent' }, { id: 'purpose', label: 'Purpose' }, { id: 'minimization', label: 'Data minimization' },
    { id: 'ondevice', label: 'On-device processing' }, { id: 'thirdmodel', label: 'Third-party model' }, { id: 'inference', label: 'Inference' }, { id: 'agent', label: 'AI / agent' },
    { id: 'access', label: 'Access' }, { id: 'tenant', label: 'Tenant isolation' }, { id: 'retention', label: 'Retention' }, { id: 'deletion', label: 'Deletion' },
    { id: 'vendor', label: 'Vendor sharing' }, { id: 'logging', label: 'Logging' }
  ];
  G.subjects = [
    { id: 'person', label: 'one person', focus: 'p_dana' }, { id: 'credential', label: 'one credential', focus: 'cr_passkey' }, { id: 'feature', label: 'one feature', focus: 'sy_pcc' },
    { id: 'dataset', label: 'one dataset', focus: 'ds_behavior' }, { id: 'tenant', label: 'one tenant', focus: 't_a' }, { id: 'vendor', label: 'one vendor', focus: 'v_adreach' },
    { id: 'agent', label: 'one AI agent', focus: 'ag_assist' }, { id: 'product', label: 'one product', focus: 'sy_wallet' }
  ];
  G.lenses = {
    privacy: { q: 'Privacy asks: should this information exist, move, combine, persist, or be inferred?', incl: 'linkability · selective disclosure · purpose · minimization · inference · on-device processing · consent · retention · user expectation' },
    security: { q: 'Security asks: can the wrong actor access it?', incl: 'passkeys · device trust · secure hardware roots of trust · tokenization · cryptographic credentials · session security · runtime isolation · API authorization' },
    both: { q: 'Security creates trustworthy boundaries. Privacy decides what should cross them.', incl: '' }
  };
  G.converge = [
    ['Passkey', 'Prevents phishing and credential theft.', 'Removes the reusable shared secret; each site gets its own key.'],
    ['Digital wallet ID', 'Proves the credential is authentic and unaltered.', 'Shares only the attribute the verifier needs.'],
    ['Private compute', 'Isolates the computation in attested servers.', 'Prevents unnecessary access and retention of the request.']
  ];

  /* ── the ten principles, shown with the view they govern ── */
  G.principles = {
    local: 'Do not collect what you can compute locally.',
    attr: 'Do not identify when you can verify an attribute.',
    derived: 'Do not send raw data when a derived signal will do.',
    scoped: 'Do not use a stable identifier when a scoped one will work.',
    hiding: 'Do not confuse client-side hiding with server-side isolation.',
    infer: 'Do not assume authorized inputs create an authorized inference.',
    no: 'Do not assume a user’s “no” reached every system.',
    del: 'Do not assume “delete me” means every copy disappeared.',
    encrypt: 'Do not assume encryption answers why the data exists.',
    passkey: 'Do not assume moving from passwords to passkeys ends identity risk.'
  };

  /* ── JOURNEYS: the complete privacy path for what a person does ──
   * z: zone — device | private (attested private compute) | service (the service
   * she chose) | third (a third party). sc: identifier scope — none | scoped | stable.
   * obs: what this party can observe. mv: what moved to it. why/need: justification.
   * st: ok | warn | fail | unk. sec: the security control on the hop. ctl: control id. */
  function H(n, z, o) { o.n = n; o.z = z; return o; }
  G.journeys = [
    { id: 'signin', label: 'sign in', sees: 'A sign-in prompt, then the account page', hops: [
      H('Person', 'device', { obs: 'Everything', id: 'none', sc: 'none' }),
      H('Biometric unlock', 'device', { mv: 'Face or fingerprint match', obs: 'The match result only, inside secure hardware', id: 'none', sc: 'none', why: 'Prove the user is present', need: 'yes', st: 'ok', sec: 'Secure hardware; biometric never leaves the device', ctl: 'c_passkey' }),
      H('Passkey', 'device', { mv: 'Permission to sign', obs: 'Which site is asking', id: 'Key pair for this site only', sc: 'scoped', why: 'Answer the site’s challenge', need: 'yes', st: 'ok', sec: 'Private key stays in the authenticator', ctl: 'c_rp_scope' }),
      H('Browser', 'device', { mv: 'Signed challenge', obs: 'The site’s origin', id: 'Origin-bound signature', sc: 'scoped', why: 'Stop phishing sites reusing it', need: 'yes', st: 'ok', sec: 'Origin binding', ctl: 'c_passkey' }),
      H('Relying party', 'service', { mv: 'Assertion + public key', obs: 'Public key, credential ID, account, time, IP, device class', id: 'Credential ID for this site', sc: 'scoped', keep: 'yes', why: 'Verify the sign-in', need: 'yes', st: 'warn', sec: 'Signature check; session token issued', ctl: 'c_session' }),
      H('Credential sync', 'service', { mv: 'Encrypted passkey copy', obs: 'Encrypted blobs and the list of devices', id: 'Platform account', sc: 'stable', keep: 'yes', why: 'Use the passkey on a new device', need: 'yes', st: 'ok', sec: 'End-to-end encryption', ctl: 'c_sync' }),
      H('Account recovery', 'service', { mv: 'SMS code to the phone number', obs: 'Phone number, recovery attempts', id: 'Phone number', sc: 'stable', keep: 'yes', why: 'Lost device', need: 'yes', st: 'fail', sec: 'SMS one-time code: phishable', ctl: 'c_recovery' })] },
    { id: 'browse', label: 'browse', sees: 'An article on a news site', hops: [
      H('Person', 'device', { obs: 'Everything', id: 'none', sc: 'none' }),
      H('Browser', 'device', { mv: 'The link she taps', obs: 'Every page, typed text, autofill', id: 'none', sc: 'none', why: 'Browse', need: 'yes', st: 'ok', sec: 'Sandboxed tabs', ctl: 'c_itp' }),
      H('Website', 'service', { mv: 'Request, first-party cookie, full URL with ?click_id=', obs: 'Pages read on this site, IP, click ID', id: 'First-party cookie', sc: 'scoped', keep: 'yes', why: 'Load the page', need: 'yes', st: 'warn', sec: 'TLS', ctl: 'c_link_strip' }),
      H('Third-party script', 'third', { mv: 'URL, referrer, screen and font list, before the page renders', obs: 'This visit, plus a fingerprint', id: 'Fingerprint', sc: 'stable', keep: 'yes', why: 'Site analytics', need: 'no', st: 'fail', sec: 'Loaded over TLS', ctl: 'c_id_rotate' }),
      H('Network', 'third', { mv: 'Packets and DNS lookups', obs: 'IP address, sites visited, timing', id: 'IP address', sc: 'stable', keep: 'unknown', why: 'Deliver traffic', need: 'yes', st: 'unk', sec: 'Encrypted DNS partly', ctl: 'c_ip_mask' }),
      H('Ad / analytics system', 'third', { mv: 'Events carrying the fingerprint and click ID', obs: 'A browsing history across unrelated sites', id: 'Fingerprint + click ID', sc: 'stable', keep: 'yes', why: 'Ad measurement', need: 'no', st: 'fail', sec: 'None applicable', ctl: 'c_itp' })] },
    { id: 'mail', label: 'read mail', sees: 'A newsletter in the inbox', hops: [
      H('Sender', 'third', { obs: 'The address it sent to', id: 'Email address', sc: 'stable' }),
      H('Mail server', 'service', { mv: 'Message with remote images and tracked links', obs: 'Sender, recipient, time, subject', id: 'Email address', sc: 'stable', keep: 'yes', why: 'Deliver mail', need: 'yes', st: 'ok', sec: 'TLS, SPF, DKIM' }),
      H('Mail app', 'device', { mv: 'The message', obs: 'Content, attachments, links', id: 'none', sc: 'none', why: 'Read it', need: 'yes', st: 'ok', sec: 'Device encryption' }),
      H('Sender’s image server', 'third', { mv: 'Image request when she opens it', obs: 'Opened, when, IP address, device type', id: 'Unique pixel URL tied to the address', sc: 'stable', keep: 'yes', why: 'Render the message', need: 'no', st: 'fail', sec: 'None: the request is allowed', ctl: 'c_remote_content' }),
      H('Summarizer', 'private', { mv: 'Thread text for a long thread', obs: 'The thread, for the duration of the request', id: 'Request-scoped', sc: 'scoped', keep: 'no', why: 'Too long for the on-device model', need: 'yes', st: 'ok', sec: 'Attested, stateless compute', ctl: 'c_pcc_attest' }),
      H('Third-party model', 'third', { mv: 'Message body, only if she opts in', obs: 'Message content', id: 'Request ID', sc: 'scoped', keep: 'unknown', why: 'Draft a reply with a larger model', need: 'unknown', st: 'unk', sec: 'Contract, TLS', ctl: 'c_no_train' })] },
    { id: 'pay', label: 'pay', sees: 'Checkout at a merchant', hops: [
      H('Person', 'device', { obs: 'Everything', id: 'none', sc: 'none' }),
      H('Wallet', 'device', { mv: 'Double-press and biometric match', obs: 'Which card, which merchant', id: 'none', sc: 'none', why: 'Authorize the payment', need: 'yes', st: 'ok', sec: 'Biometric in secure hardware', ctl: 'c_passkey' }),
      H('Device credential', 'device', { mv: 'Device-specific token and one-time cryptogram', obs: 'The real card number is not here either', id: 'Device payment token', sc: 'scoped', why: 'Represent the card', need: 'yes', st: 'ok', sec: 'Tokenization', ctl: 'c_tokenize' }),
      H('Merchant', 'third', { mv: 'Token, amount, cryptogram', obs: 'Token, amount, time, merchant customer ID', id: 'Merchant customer ID', sc: 'scoped', keep: 'yes', why: 'Take the payment', need: 'yes', st: 'warn', sec: 'One-time cryptogram', ctl: 'c_tokenize' }),
      H('Payment network', 'third', { mv: 'Token and amount', obs: 'Token → card mapping, merchant', id: 'Device payment token', sc: 'scoped', keep: 'yes', why: 'Route the authorization', need: 'yes', st: 'ok', sec: 'Token vault' }),
      H('Issuer', 'third', { mv: 'Card account and merchant', obs: 'Every purchase on the card', id: 'Card account', sc: 'stable', keep: 'yes', why: 'Approve or decline', need: 'yes', st: 'ok', sec: 'Issuer authentication' }),
      H('Fraud system', 'service', { mv: 'Raw device signals: motion, location, app usage', obs: 'How and where she pays, and how she holds the phone', id: 'device_id', sc: 'stable', keep: 'yes', why: 'Stop fraud', need: 'unknown', st: 'warn', sec: 'mTLS', ctl: 'c_local_risk' })] },
    { id: 'age', label: 'prove age', sees: '“Show you are over 21”', hops: [
      H('Person', 'device', { obs: 'Everything', id: 'none', sc: 'none' }),
      H('Digital ID in wallet', 'device', { mv: 'Biometric approval', obs: 'Full credential: name, birth date, address, number, photo', id: 'none', sc: 'none', why: 'Hold the credential', need: 'yes', st: 'ok', sec: 'Issuer signature, secure hardware' }),
      H('Request screen', 'device', { mv: 'The verifier’s request', obs: 'Exactly what is asked: “Age over 21”', id: 'none', sc: 'none', why: 'Let her see before sharing', need: 'yes', st: 'ok', sec: 'Verifier authentication', ctl: 'c_sd' }),
      H('Verifier', 'third', { mv: 'Age over 21: TRUE, with issuer signature', obs: 'One yes/no answer and that it is authentic', id: 'none', sc: 'none', keep: 'no', why: 'Admit her', need: 'yes', st: 'ok', sec: 'Signature verification', ctl: 'c_verifier_ret' }),
      H('Issuer', 'third', { mv: 'Nothing, if presentation is offline', obs: 'Whether it learns where the ID was shown depends on the protocol', id: 'none', sc: 'none', keep: 'unknown', why: 'Revocation checks', need: 'unknown', st: 'unk', sec: 'Revocation status list', ctl: 'c_issuer_blind' })] },
    { id: 'share', label: 'share identity', sees: '“Verify your identity to open an account”', hops: [
      H('Person', 'device', { obs: 'Everything', id: 'none', sc: 'none' }),
      H('Digital ID in wallet', 'device', { mv: 'Biometric approval', obs: 'Full credential', id: 'none', sc: 'none', why: 'Hold the credential', need: 'yes', st: 'ok', sec: 'Secure hardware' }),
      H('Request screen', 'device', { mv: 'Name, birth date, address, ID number, photo', obs: 'Five attributes requested; retention stated as 7 years', id: 'none', sc: 'none', why: 'Show the request', need: 'yes', st: 'ok', ctl: 'c_sd' }),
      H('Bank', 'third', { mv: 'Five attributes', obs: 'Her legal identity', id: 'Legal name + ID number', sc: 'stable', keep: 'yes', why: 'Know-your-customer rules', need: 'yes', st: 'ok', sec: 'Signature verification', ctl: 'c_verifier_ret' }),
      H('Bank’s verification vendor', 'third', { mv: 'Photo and ID number', obs: 'Identity documents', id: 'ID number', sc: 'stable', keep: 'unknown', why: 'Liveness and document checks', need: 'unknown', st: 'unk', sec: 'Contract', ctl: 'c_vendor_ack' })] },
    { id: 'ai', label: 'use AI', sees: 'An answer from the assistant', hops: [
      H('Person', 'device', { obs: 'Everything', id: 'none', sc: 'none' }),
      H('Device', 'device', { mv: 'The request and on-screen context', obs: 'Everything on the device', id: 'none', sc: 'none', why: 'Ask the assistant', need: 'yes', st: 'ok' }),
      H('On-device model', 'device', { mv: 'Request + personal context', obs: 'The request; nothing leaves', id: 'none', sc: 'none', why: 'Answer locally when possible', need: 'yes', st: 'ok', sec: 'App sandbox', ctl: 'c_route' }),
      H('Private compute', 'private', { mv: 'Only the context this request needs', obs: 'That context, for the duration of the request', id: 'Request-scoped key', sc: 'scoped', keep: 'no', why: 'Task too large for the device', need: 'yes', st: 'ok', sec: 'Attested, stateless servers; no operator access', ctl: 'c_pcc_attest' }),
      H('Third-party model', 'third', { mv: 'The prompt, if she approves the hand-off', obs: 'Prompt and any attached context', id: 'Request ID', sc: 'scoped', keep: 'unknown', why: 'A capability we do not run', need: 'unknown', st: 'unk', sec: 'Contract, TLS', ctl: 'c_no_train' }),
      H('Agent tool', 'service', { mv: 'A booking request', obs: 'Dates, destination, payment card', id: 'Account', sc: 'stable', keep: 'yes', why: 'Book the trip', need: 'yes', st: 'warn', sec: 'Tool allowlist', ctl: 'c_agent_policy' }),
      H('Action', 'third', { mv: 'Hotel booking with her name and card', obs: 'Name, stay dates, card', id: 'Name + card token', sc: 'stable', keep: 'yes', why: 'Complete the task', need: 'yes', st: 'fail', sec: 'None: no approval step', ctl: 'c_agent_approval' })] },
    { id: 'account', label: 'live on one account', sees: 'Her browser, mail and wallet, each signed in', hops: [
      H('Person', 'device', { obs: 'Everything', id: 'none', sc: 'none' }),
      H('Browser', 'device', { mv: 'Sign-in once, then every page she opens', obs: 'History, open tabs, saved passwords, autofill', id: 'Northstar Account', sc: 'stable', why: 'Browse, signed in', need: 'yes', st: 'ok', sec: 'Session cookie in the browser profile', ctl: 'c_cookie_enc' }),
      H('Browser extension', 'third', { mv: 'Every page, after sign-in: it can read and change all sites', obs: 'Pages, form fields and signed-in sessions on every site', id: 'The session itself', sc: 'stable', keep: 'unknown', why: 'A coupon tool she installed years ago', need: 'no', st: 'fail', sec: 'Extension permissions: all sites', ctl: 'c_ext_review' }),
      H('Northstar Account', 'service', { mv: 'Synced history, contacts, purchases, sign-ins', obs: 'One record that joins what she reads, who she writes to and what she buys', id: 'Account', sc: 'stable', keep: 'yes', why: 'Sync across her devices', need: 'yes', st: 'warn', sec: 'Session tokens not bound to the device', ctl: 'c_dbsc' }),
      H('Mail', 'service', { mv: 'Messages and receipts', obs: 'Who she talks to, and the reset link for every other account', id: 'Account', sc: 'stable', keep: 'yes', why: 'Mail', need: 'yes', st: 'warn', sec: 'Signed in by the same session', ctl: 'c_recovery' }),
      H('Wallet', 'service', { mv: 'Payments and passes', obs: 'What, where and when she buys', id: 'Account', sc: 'stable', keep: 'yes', why: 'Pay', need: 'yes', st: 'ok', sec: 'Payment needs a fresh biometric check', ctl: 'c_tokenize' })] },
    { id: 'report', label: 'open a report', sees: 'A Tenant A commission dashboard', hops: [
      H('Tenant A user', 'device', { obs: 'Everything', id: 'none', sc: 'none' }),
      H('Dashboard', 'device', { mv: 'Report request', obs: 'Her session', id: 'Tenant A session', sc: 'scoped', why: 'See commissions', need: 'yes', st: 'ok', sec: 'SSO' }),
      H('API', 'service', { mv: 'Query for the report', obs: 'Who asked for what; full URL logged', id: 'Tenant and account IDs in the URL', sc: 'stable', keep: 'yes', why: 'Render charts', need: 'yes', st: 'warn', sec: 'OAuth token', ctl: 'c_url_redact' }),
      H('Semantic layer', 'service', { mv: 'Report model query', obs: 'Every tenant the service account can read', id: 'Service account', sc: 'stable', why: 'Build the report', need: 'yes', st: 'warn', sec: 'Service account', ctl: 'c_report_scope' }),
      H('Tenant database', 'service', { mv: 'SQL with tenant context', obs: 'Only Tenant A rows', id: 'tenant_id in session', sc: 'scoped', why: 'Fetch rows', need: 'yes', st: 'ok', sec: 'Row policy', ctl: 'c_vpd' }),
      H('Response to browser', 'device', { mv: 'Rows for tenants A, B and C', obs: 'Tenant B and C data, hidden by the chart', id: 'Tenant A session', sc: 'scoped', why: 'The chart filters on the client', need: 'no', st: 'fail', sec: 'None: already delivered', ctl: 'c_server_filter' })] },
    { id: 'delete', label: 'delete account', sees: '“Your account has been deleted”', hops: [
      H('Person', 'device', { obs: 'Everything', id: 'none', sc: 'none' }),
      H('Account settings', 'device', { mv: 'Delete my data', obs: 'The request', id: 'Account', sc: 'stable', why: 'Leave the service', need: 'yes', st: 'ok' }),
      H('Primary database', 'service', { mv: 'Delete by account', obs: 'Nothing after deletion', id: 'Account', sc: 'stable', why: 'Honour deletion', need: 'yes', st: 'ok', ctl: 'c_delete_orch' }),
      H('Warehouse', 'service', { mv: 'Nothing: not in the fan-out', obs: 'Her history in daily partitions', id: 'player_id', sc: 'stable', keep: 'yes', why: 'Analytics', need: 'no', st: 'fail', ctl: 'c_delete_orch' }),
      H('Feature store', 'service', { mv: 'Nothing: not in the fan-out', obs: 'A vector keyed by player_id', id: 'player_id', sc: 'stable', keep: 'yes', why: 'Models', need: 'no', st: 'fail', ctl: 'c_delete_orch' }),
      H('Vendor export', 'third', { mv: 'Earlier exports', obs: 'Hashed email in old files', id: 'Hashed email', sc: 'stable', keep: 'unknown', why: 'Advertising', need: 'no', st: 'unk', ctl: 'c_vendor_ack' })] },
    { id: 'revoke', label: 'revoke consent', sees: 'A switch set to OFF', hops: [
      H('Person', 'device', { obs: 'Everything', id: 'none', sc: 'none' }),
      H('Settings', 'device', { mv: 'Advertising: OFF at 10:02', obs: 'The choice', id: 'Account', sc: 'stable', why: 'Change her mind', need: 'yes', st: 'ok' }),
      H('Consent store', 'service', { mv: 'Revocation, version v7', obs: 'The current choice', id: 'Account', sc: 'stable', keep: 'yes', why: 'Source of truth', need: 'yes', st: 'ok', ctl: 'c_consent_read' }),
      H('Running batch', 'service', { mv: 'Nothing: read v6 at 09:55', obs: 'The old choice', id: 'player_id', sc: 'stable', why: 'Scoring', need: 'yes', st: 'fail', ctl: 'c_consent_read' }),
      H('Export', 'service', { mv: 'Features built from the old snapshot', obs: 'Her features, still marked opted in', id: 'Hashed email', sc: 'stable', why: 'Campaigns', need: 'no', st: 'fail', ctl: 'c_consent_read' }),
      H('Ad partner', 'third', { mv: 'Nightly file including her', obs: 'That she is a likely churner', id: 'Hashed email', sc: 'stable', keep: 'yes', why: 'Advertising', need: 'no', st: 'fail', ctl: 'c_vendor_ack' })] }
  ];
  G.zones = [['device', 'On device'], ['private', 'Private compute'], ['service', 'Service'], ['third', 'Third party']];

  /* ── ONE ACCOUNT, ONE LIFE: what the join key reveals, and who tries to steal it ── */
  G.oneLife = {
    surfaces: [['browser', 'Browser', 'what she reads'], ['mail', 'Mail', 'who she talks to'], ['wallet', 'Wallet', 'what she buys'], ['signin', 'Saved sign-ins', 'where she has accounts']],
    joins: [
      { needs: ['browser', 'wallet'], fact: 'She researched it, then she bought it.' },
      { needs: ['mail', 'wallet'], fact: 'Receipts show purchases made outside the wallet too.' },
      { needs: ['browser', 'mail'], fact: 'Sign-up emails show which sites she uses.' },
      { needs: ['mail', 'signin'], fact: 'Mail holds the reset link for every other account.' },
      { needs: ['browser', 'mail', 'wallet'], fact: 'Together: interests, relationships, spending and schedule. One life.' }
    ]
  };
  G.takeover = [
    { id: 'scam', label: 'A scammer', how: 'A convincing sign-in page relays her password and one-time code as she types them.', gets: ['browser', 'mail', 'wallet', 'signin'], mfa: 'The code is typed into the fake page and replayed at once.', control: 'Passkeys: the key is bound to the real site, so a fake page receives nothing it can use.', ctl: 'c_passkey', evidence: 'Lookalike-origin test on every release.', after: [], residual: 'A scammer can still talk her into approving a payment herself.' },
    { id: 'ext', label: 'A browser extension', how: 'An extension allowed to read and change all sites updates to a malicious version.', gets: ['browser', 'mail', 'wallet'], mfa: 'It never signs in. It reads pages after she has.', control: 'Review extension permissions; allow extensions by list; limit site access to “on click”.', ctl: 'c_ext_review', evidence: 'Extension inventory with permissions, compared on every update.', after: [], residual: 'An allowed extension that turns malicious still reads what it was allowed to.' },
    { id: 'malware', label: 'Infostealer malware', how: 'Copies session cookies and saved passwords off the device.', gets: ['browser', 'mail', 'wallet', 'signin'], mfa: 'A stolen session cookie is already past the second factor.', control: 'Bind sessions to the device, and encrypt cookies to the browser, so a copied session fails elsewhere.', ctl: 'c_dbsc', evidence: 'Replay a copied session from another machine: rejected.', after: ['signin'], residual: 'Malware running on the device itself can still act as her.' },
    { id: 'simswap', label: 'A SIM swap', how: 'Her phone number is moved to the attacker, who uses “forgot password”.', gets: ['browser', 'mail', 'wallet', 'signin'], mfa: 'The SMS code is the recovery path.', control: 'Recover with another enrolled device or a recovery key, never SMS alone.', ctl: 'c_recovery', evidence: 'Recovery walkthrough with a moved number: refused.', after: [], residual: 'People who lose every device need a slower, human recovery.' }
  ];

  /* ── PASSWORD → PASSKEY ─────────────────────────────── */
  G.auth = {
    rows: [
      ['What exists', 'A shared secret', 'A public/private key pair'],
      ['What the server stores', 'A verifier of the secret', 'Only the public key'],
      ['Phishing', 'Phishable: works on a lookalike site', 'Resistant: bound to the real origin'],
      ['Reuse', 'Often reused across sites', 'A new key pair per site'],
      ['Breach of the server', 'Credential stuffing elsewhere', 'Public keys are useless to an attacker'],
      ['How the user proves it', 'Types it', 'Unlocks the device (biometric or PIN)']
    ],
    questions: [
      ['Who knows the account identity?', 'The relying party knows the account; the credential ID is per site.', 'ok'],
      ['Can authentication become a tracking identifier?', 'Not across sites: keys are scoped per origin. Within a site, the credential ID is stable.', 'warn'],
      ['What metadata is generated during sign-in?', 'Time, IP address, device class and attestation data, kept in sign-in logs.', 'warn'],
      ['What happens during account recovery?', 'Recovery falls back to an SMS code: a phishable shared secret again.', 'fail'],
      ['How are credentials synced?', 'End-to-end encrypted to the platform account.', 'ok'],
      ['What happens when a device is lost?', 'Synced passkeys survive; device-bound keys and security keys must be re-enrolled.', 'warn'],
      ['What does the relying party learn?', 'A public key, a credential ID and, if requested, the authenticator model.', 'warn'],
      ['Can one device become a universal correlation point?', 'The platform account sees every device and sync event. That is a concentration to govern.', 'unk']
    ]
  };

  /* ── WHO KNOWS / identifier view helpers live in app.js; data is in journeys ── */

  /* ── WHAT DO WE KNOW: cross-device identity graph ───── */
  G.identity = {
    signals: [
      { id: 'phone', label: 'Phone', key: 'device_id 7F3A…C2', s: ['all', 'pay', 'analytics', 'ident'] },
      { id: 'behavior', label: 'Behavior', key: 'player_id P-8841', s: ['all', 'analytics'] },
      { id: 'payment', label: 'Payments', key: 'merchant customer ID', s: ['all', 'pay'] },
      { id: 'device', label: 'Device', key: 'fingerprint + IP', s: ['all', 'web'] },
      { id: 'browser', label: 'Browser', key: 'cookie sid_91c…', s: ['all', 'web'] },
      { id: 'login', label: 'Login', key: 'passkey credential ID', s: ['all', 'ident', 'web', 'mail', 'pay'] }
    ],
    links: [
      ['phone', 'behavior', 'device_id', 'fact'], ['behavior', 'login', 'player_id', 'fact'], ['payment', 'login', 'account', 'fact'],
      ['device', 'browser', 'same IP + time', 'inference'], ['browser', 'login', 'sign-in event', 'fact'], ['phone', 'device', 'IP overlap', 'inference']
    ],
    profile: [
      ['collected', 'Account, passkey credential ID, device_id'], ['collected', 'Sessions in the app and the browser'],
      ['derived', 'One person across phone, browser and account'], ['derived', 'Spend per week from payments'],
      ['inferred', 'Home area from late-evening location'], ['inferred', 'Repeated travel from merchant cities']
    ]
  };

  /* ── SHOULD THESE BE JOINED ─────────────────────────── */
  G.join = {
    a: { node: 'ds_behavior', label: 'Dataset A · Behavior', cols: [['player_id', 'P-8841'], ['device', '7F3A…C2'], ['session', '22:14–22:55'], ['behavior', 'ranked · 41 min']] },
    b: { node: 'ds_customer', label: 'Dataset B · Customer', cols: [['player_id', 'P-8841'], ['account', 'dana.r@…'], ['transactions', 'three this week']] },
    on: 'player_id', result: ['identity', 'behavior', 'device', 'transaction context']
  };

  /* ── WHY DID IT LEAVE (server side): declared purpose vs actual use ── */
  G.purpose = [
    { ds: 'ds_fraud', s: ['pay', 'all'], declared: ['pu_fraud'], uses: [['pu_fraud', 'fraud service', 'declared', 'yes'], ['pu_training', 'model training', 'undeclared', 'unknown'], ['pu_ads', 'lookalike audiences', 'undeclared', 'no']] },
    { ds: 'ds_behavior', s: ['analytics', 'all'], declared: ['pu_analytics'], uses: [['pu_analytics', 'dashboards', 'declared', 'yes'], ['pu_ads', 'churn campaign export', 'undeclared', 'no']] },
    { ds: 'ds_loc', s: ['analytics', 'all'], declared: ['pu_service'], uses: [['pu_service', 'nearby features', 'declared', 'yes'], ['pu_analytics', 'daily warehouse export', 'undeclared', 'unknown']] },
    { ds: 'ds_commission', s: ['cloud'], declared: ['pu_billing'], uses: [['pu_billing', 'statements', 'declared', 'yes'], ['pu_analytics', 'cross-tenant benchmarks', 'undeclared', 'unknown']] },
    { ds: 'ds_export', s: ['vendor', 'analytics'], declared: ['pu_ads'], uses: [['pu_ads', 'partner campaigns', 'declared', 'yes'], ['pu_analytics', 'partner’s own modelling', 'undeclared', 'unknown']] },
    { ds: 'ds_kyc', s: ['vendor', 'did'], declared: ['pu_kyc'], uses: [['pu_kyc', 'account opening', 'declared', 'yes'], ['pu_training', 'vendor model improvement', 'undeclared', 'unknown']] }
  ];

  /* ── CAN WE PROVE THIS WITHOUT REVEALING THAT ───────── */
  G.disclosure = {
    age: { title: 'Prove age without handing over the ID',
      old: { label: 'Upload a driver license', fields: ['Name', 'Address', 'Date of birth', 'License number', 'Photo', 'Everything on the card'] },
      neu: { label: 'Request “Age over 21?”', answer: 'TRUE', with: 'signed by the issuer' },
      qs: ['What exact attribute is required?', 'Why, and for how long?', 'Can a yes/no replace the raw attribute?', 'Does the verifier need a copy?', 'Can the issuer avoid learning where it was shown?', 'Can the user see exactly what is requested before sharing?'] },
    relay: { title: 'Does the service need the real email address?',
      rows: [['Newsletter', 'k7q2@relay.northstar.example', 'Relay: forwards, can be switched off'], ['Game account', 'p9w1@relay.northstar.example', 'Relay: forwards, can be switched off'], ['Bank', 'dana.r@…', 'Real address: legally required contact']],
      qs: ['Does this service need to reach her, or to know who she is?', 'Can each service get its own address?', 'Can she cut one off without affecting the others?'] },
    derived: { title: 'Send a derived risk signal, not raw behavior',
      signals: [['Device motion while paying', 'medium', 'high', 'derive on device'], ['Precise location', 'low', 'high', 'drop'], ['Card and token history', 'high', 'medium', 'keep'], ['App usage patterns', 'low', 'high', 'drop'], ['Device integrity check', 'high', 'low', 'keep'], ['Merchant risk', 'high', 'low', 'keep']],
      qs: ['Which signals materially improve fraud detection?', 'Can risk be evaluated on the device?', 'Can a derived assessment leave instead of raw signals?', 'Does model training need the same data as investigation?', 'How long should these signals live?'] }
  };

  /* ── AI routing: where intelligence runs ────────────── */
  G.routing = {
    requests: [
      { r: '“Summarize this note”', zone: 'device', leaves: 'Nothing', retained: 'No', operator: 'No', training: 'No', verified: 'Not needed', third: 'No' },
      { r: '“Summarize this 200-message thread”', zone: 'private', leaves: 'The thread text only', retained: 'No: stateless', operator: 'No: no privileged access', training: 'No', verified: 'Yes: attested software images', third: 'No' },
      { r: '“Find a clinic near my hotel and book it”', zone: 'third', leaves: 'Query, dates, city, hotel name', retained: 'Unknown: 30 days per contract, unverified', operator: 'Unknown', training: 'Unknown', verified: 'No', third: 'Yes: Parallax AI' }
    ],
    qs: ['Can this run on device?', 'What exact data leaves?', 'Why is each piece required?', 'Who can access it?', 'Is it retained?', 'Can it be used for training?', 'Can an operator view it?', 'Can the execution environment be verified?', 'Does it go to a third party?']
  };

  /* ── agents ─────────────────────────────────────────── */
  G.tools = [
    ['Mail', 'ds_mail', 'read', 'draft replies'], ['Calendar', 'ds_mailmeta', 'read', 'create events'], ['Wallet', 'ds_txn', 'read receipts', 'pay with approval'],
    ['Browser', 'ds_browse', 'read history', 'open pages'], ['Location', 'ds_loc', 'current city', 'none'], ['Contacts', 'id_email', 'read', 'none'],
    ['Files', 'ds_prompts', 'read', 'none'], ['Transactions', 'ds_txn', 'read', 'none']
  ];
  G.agents = {
    ag_assist: { purpose: 'Plan and book the user’s travel',
      used: [['Mail', 'ds_mail', '“I am traveling to Boston Friday.”'], ['Wallet', 'ds_txn', 'Hotel payment in Boston'], ['Browser', 'ds_browse', 'Searches about a medical procedure'], ['Location', 'ds_loc', 'Boston, Friday to Monday']],
      inference: 'Possible medical trip.', infNodes: ['in_medical'], action: 'Book a clinic appointment and share dates with the hotel', approval: 'none recorded' },
    ag_support: { purpose: 'Resolve a payment support ticket',
      used: [['Support ticket', 'ds_prompts', '“Can I delay this month’s payment?”'], ['Transactions', 'ds_txn', 'Two missed payments; new city'], ['Device activity', 'ds_fraud', 'Location changed; late-night sessions']],
      inference: 'Likely financial hardship. Likely moved recently.', infNodes: ['in_hardship'], action: 'Flag the account for collections', approval: 'none recorded' }
  };
  G.guardrails = [['Purpose', 1], ['Tool scope', 0], ['Data scope', 1], ['Cross-domain join policy', 1], ['Action limits', 1], ['Human approval', 1], ['Runtime monitoring', 0], ['Audit trail', 0], ['Kill switch', 0]];
  /* per tool: scope and actions for "What can this agent do?" — st says whether the scope is purpose-bound */
  G.privileges = [
    ['Mail', 'All mail, all time', 'Draft and send replies', 'Send needs approval', 'warn'],
    ['Calendar', 'All calendars', 'Create and accept events', 'None', 'fail'],
    ['Wallet', 'Receipts; card on file', 'Pay up to a limit', 'Every payment', 'ok'],
    ['Browser', 'History, 90 days', 'Open pages, fill forms', 'None', 'fail'],
    ['Location', 'Current city', 'None', 'Not applicable', 'ok'],
    ['Contacts', 'All contacts', 'Share contact cards', 'None', 'warn'],
    ['Files', 'All files', 'Read only', 'Not applicable', 'warn'],
    ['Transactions', 'Two years', 'Read only', 'Not applicable', 'warn']
  ];

  /* ── consent, deletion, retention, access, tenant (earlier scenarios) ── */
  G.consent = { revokedAt: 12, rows: [
    { node: 'sy_consent', n: 'UI', at: 12, st: 'ok', p: 'OFF ✓', note: 'settings screen', intended: 'Show the new choice', evidence: 'UI state 10:02' },
    { node: 'sy_consent', n: 'Consent store', at: 12, st: 'ok', p: 'OFF ✓', note: 'source of truth', intended: 'Record revocation', evidence: 'Store version v7 at 10:02' },
    { node: 'sy_batch', n: 'Running batch', at: 25, from: 5, st: 'fail', p: 'OLD STATE ✕', note: 'read consent at 09:55', intended: 'Honour the current choice', evidence: 'Job read store version v6' },
    { node: 'ds_features', n: 'Derived dataset', at: 20, st: 'fail', p: 'STALE ✕', note: 'built from the 09:55 snapshot', intended: 'Recompute on revocation', evidence: 'Feature row for P-8841 at 10:10' },
    { node: 'sy_export', n: 'Export', at: 30, st: 'fail', p: 'USER INCLUDED ✕', note: 'nightly partner file', intended: 'Check consent at export', evidence: 'Dana’s hash in the 10:20 file' },
    { node: 'v_adreach', n: 'Downstream vendor', at: 40, st: 'fail', p: 'OLD STATE ✕', note: 'no revocation received', intended: 'Receive the revocation', evidence: 'No acknowledgement from AdReach' }] };
  G.deletion = [
    { node: 'sy_primary', n: 'Primary DB', st: 'ok', ev: 'Canary lookup: 0 rows' }, { node: 'sy_cache', n: 'Cache', st: 'ok', ev: 'Key evicted, TTL confirmed' },
    { node: 'sy_wh', n: 'Warehouse', st: 'fail', ev: 'Still in the daily partition' }, { node: 'sy_obj', n: 'Object storage', st: 'fail', ev: 'Raw event files, no delete path' },
    { node: 'ds_logs', n: 'Logs', st: 'unk', ev: 'Identifiers in URLs; no search run' }, { node: 'ds_backup', n: 'Backup', st: 'wait', ev: 'Expires with the 35-day rotation' },
    { node: 'sy_featstore', n: 'Feature store', st: 'fail', ev: 'Vector keyed by player_id' }, { node: 'ds_export', n: 'Vendor export', st: 'fail', ev: 'No deletion acknowledgement' }];
  G.retention = [
    { node: 'ds_loc', n: 'location_history', s: ['analytics', 'all', 'pay', 'ai'], req: 30, dec: 90, obs: 540 },
    { node: 'ds_authlog', n: 'sign-in events', s: ['ident', 'all'], req: 30, dec: 90, obs: 400 },
    { node: 'ds_logs', n: 'api_access_logs', s: ['cloud', 'all'], req: 14, dec: 30, obs: 30 },
    { node: 'ds_fraud', n: 'fraud_signals', s: ['pay'], req: 180, dec: 365, obs: 365 },
    { node: 'ds_kyc', n: 'identity documents (verifier)', s: ['did'], req: 0, dec: 2555, obs: null },
    { node: 'ds_prompts', n: 'assistant_context', s: ['ai'], req: 0, dec: 30, obs: null },
    { node: 'ds_mailmeta', n: 'open events (mail)', s: ['mail'], req: 0, dec: 30, obs: 30 },
    { node: 'ds_browse', n: 'page_views', s: ['web'], req: 30, dec: 30, obs: 30 },
    { node: 'ds_raw', n: 'raw_events (staging)', s: ['cloud', 'analytics', 'all'], req: 7, dec: 7, obs: 400 }];
  G.access = {
    process: 'sy_emr', needs: ['ds_curated'], can: ['ds_curated', 'ds_raw', 'ds_logs', 'ds_identity'],
    mask: [['Warehouse curated table', 'MASKED', 'email → hash, precise location → city'], ['Staging / raw storage', 'UNMASKED', 'the same columns, in the clear']],
    leak: ['App', 'API', 'Logging', 'Log search'], leakWhat: 'player_id and email in the request URL'
  };
  G.tenantChain = [
    { node: 'sy_vpd', n: 'Database', intended: 'Tenant A reads only Tenant A rows', actual: 'VPD-style row policy on every query', evidence: 'Policy test: 0 foreign rows', st: 'ok' },
    { node: 'sy_session', n: 'Session context', intended: 'tenant_id set on every connection', actual: 'Set by the pool on checkout', evidence: 'Pooled connections not re-tested', st: 'unk' },
    { node: 'sy_semantic', n: 'Semantic layer', intended: 'Report models inherit tenant scope', actual: 'One cross-tenant benchmark model', evidence: 'Model review pending', st: 'warn' },
    { node: 'sy_pdf', n: 'PDF report', intended: 'Each statement holds one tenant', actual: 'Rendered by a service account', evidence: 'Row-level diff of the statement', st: 'fail', detail: 'pdf' },
    { node: 'sy_dash', n: 'Dashboard', intended: 'Browser receives Tenant A only', actual: 'API returns A, B, C; client filters', evidence: 'Captured response payload', st: 'fail', detail: 'client' },
    { node: 'sy_rcache', n: 'Cache', intended: 'Cache key includes tenant', actual: 'Key is report ID only', evidence: 'No test exists', st: 'unk' },
    { node: 'sy_rexport', n: 'Export', intended: 'CSV holds one tenant', actual: 'Uses the scoped query', evidence: 'Canary export: 0 foreign rows', st: 'ok' }];
  G.statement = (function () {
    var first = ['A. Rivera', 'J. Chen', 'M. Okafor', 'L. Haddad', 'S. Novak', 'R. Patel', 'K. Moreau', 'T. Silva', 'E. Brandt', 'P. Lindqvist', 'H. Yamada', 'D. Mensah', 'C. Ortiz', 'B. Kowalski', 'N. Farouk', 'G. Rossi', 'F. Dubois', 'I. Petrov', 'O. Nakamura', 'V. Adeyemi', 'W. Hughes', 'Y. Cohen', 'Z. Laurent', 'Q. Sato', 'X. Mbeki', 'U. Varga', 'A. Kaur', 'M. Berg', 'J. Alvarez', 'L. Weber', 'S. Ivanova', 'R. Costa', 'K. Tanaka', 'T. Murphy', 'E. Ruiz', 'P. Horvat', 'H. Park', 'D. Schmidt', 'C. Nguyen', 'B. Olsen', 'N. Kim', 'G. Fischer', 'F. Moreno', 'I. Singh', 'O. Novak', 'V. Jensen', 'W. Ali', 'Y. Rossi', 'Z. Hoffman'];
    var rows = first.map(function (n, i) { return [n, 'Tenant A', (2500 + (i * 397) % 2400).toLocaleString('en-US')]; });
    rows.push(['R. Diaz', 'Tenant B', '6,340']);
    return { rows: rows };
  })();
  G.payload = [['A', 412, true], ['B', 988, false], ['C', 305, false]];

  /* ── WHAT CHANGED since the last review ─────────────── */
  G.lastReview = '2026-09-01';
  G.changes = [
    ['2026-09-27', 'new control failure', 'Account recovery falls back to SMS after the passkey rollout', 'ident', ['recovery', 'authentication'], 'c_recovery'],
    ['2026-09-25', 'new control failure', 'An all-sites browser extension found in signed-in browsers, unreviewed', 'web', ['takeover', 'tracking'], 'c_ext_review'],
    ['2026-09-26', 'new control failure', 'Export pipeline stopped checking consent after a refactor', 'analytics', ['consent'], 'c_consent_read'],
    ['2026-09-24', 'new AI tool access', 'Assistant gained Browser history and Location tools', 'ai', ['agent', 'inference'], 'ag_assist'],
    ['2026-09-22', 'new join', 'Warehouse view joins player_events to customers', 'analytics', ['linkability', 'identity'], 'ds_customer'],
    ['2026-09-20', 'new destination', 'Reply drafting can hand prompts to a third-party model', 'ai', ['thirdmodel', 'vendor'], 'v_llm'],
    ['2026-09-19', 'retention increase', 'fraud_signals kept 365 days, up from 180', 'pay', ['retention', 'minimization'], 'ds_fraud'],
    ['2026-09-15', 'new vendor', 'Bank onboarding sends ID photos to a verification vendor', 'did', ['disclosure', 'vendor'], 'ds_kyc'],
    ['2026-09-12', 'new destination', 'Dashboard API returns all tenants; client filters', 'cloud', ['tenant', 'access'], 'sy_dash'],
    ['2026-09-08', 'new identifier', 'Analytics script collects a browser fingerprint', 'web', ['tracking', 'linkability'], 'id_fp'],
    ['2026-09-04', 'new dataset', 'raw_events staging bucket created without a TTL', 'cloud', ['retention', 'access'], 'ds_raw']
  ];

  /* ── WHAT IS OUR WORST DAY ──────────────────────────── */
  G.worst = {
    stores: { ds_raw: ['raw_events', 2, 1], ds_identity: ['identity_store', 3, 1], ds_loc: ['location_history', 3, 1], ds_curated: ['events_curated', 1, 0], ds_logs: ['api_access_logs', 1, 1], ds_export: ['partner_export', 2, 1], ds_prompts: ['assistant_context', 3, 1], ds_kyc: ['identity documents', 3, 1], ds_authlog: ['sign-in events', 1, 1] },
    modes: [
      { id: 'creds', label: 'Warehouse credentials stolen', reach: ['ds_raw', 'ds_identity', 'ds_loc', 'ds_curated', 'ds_logs'] },
      { id: 'insider', label: 'Curious insider', reach: ['ds_logs', 'ds_raw', 'ds_prompts', 'ds_authlog'] },
      { id: 'vendor', label: 'Vendor breached', reach: ['ds_export', 'ds_prompts', 'ds_kyc'] }],
    safeguards: [
      { id: 'ttl', label: 'Enforce TTL on staging', removes: ['ds_raw'] }, { id: 'iam', label: 'Scope the job’s IAM role', removes: ['ds_identity', 'ds_raw'] },
      { id: 'redact', label: 'Redact IDs from logs', deident: ['ds_logs', 'ds_authlog'] }, { id: 'coarse', label: 'Coarsen location on device', deident: ['ds_loc'] },
      { id: 'derived', label: 'Send vendors derived signals only', deident: ['ds_export'] }, { id: 'pcc', label: 'Route assistant context to stateless private compute', removes: ['ds_prompts'] },
      { id: 'attr', label: 'Accept attribute proofs instead of ID copies', removes: ['ds_kyc'] }],
    bands: ['Contained', 'Serious', 'Severe', 'Critical']
  };

  /* ── controls and their evidence. result: pass | fail | never ── */
  G.controls = {
    c_passkey: { inv: 'Sign-in cannot be phished or replayed', where: 'Authenticator and browser', last: '2026-09-28', result: 'pass', method: 'Lookalike-origin test', c: ['authentication'] },
    c_rp_scope: { inv: 'Each site gets its own credential', where: 'Authenticator', last: '2026-09-28', result: 'pass', method: 'Cross-site credential ID comparison', c: ['authentication', 'linkability'] },
    c_sync: { inv: 'Synced credentials are unreadable in transit and at rest', where: 'Credential sync', last: '2026-09-21', result: 'pass', method: 'Key-custody review', c: ['authentication', 'devicetrust'] },
    c_recovery: { inv: 'Recovery does not reintroduce a shared secret', where: 'Account recovery', last: '2026-09-27', result: 'fail', method: 'Recovery path walkthrough', c: ['recovery', 'authentication'] },
    c_session: { inv: 'Session tokens are bound to the device', where: 'Relying party', last: null, result: 'never', method: 'Designed; no replay test', c: ['authentication', 'devicetrust'] },
    c_attest: { inv: 'Attestation reveals only what the site needs', where: 'Authenticator', last: '2026-09-02', result: 'pass', method: 'Attestation payload review', c: ['devicetrust', 'linkability'] },
    c_itp: { inv: 'Third parties cannot keep state across sites', where: 'Browser', last: '2026-09-25', result: 'pass', method: 'Cross-site storage test', c: ['tracking', 'linkability'] },
    c_id_rotate: { inv: 'Scripts cannot build a stable fingerprint', where: 'Browser', last: '2026-09-18', result: 'fail', method: 'Fingerprint stability test across sites', c: ['tracking', 'linkability'] },
    c_link_strip: { inv: 'Known tracking parameters are removed from links', where: 'Browser', last: '2026-09-24', result: 'pass', method: 'Decorated-link corpus', c: ['tracking'] },
    c_ip_mask: { inv: 'Trackers and networks do not see the real IP', where: 'Network relay', last: null, result: 'never', method: 'Available as an option; not measured', c: ['tracking', 'linkability'] },
    c_remote_content: { inv: 'Opening mail reveals nothing to the sender', where: 'Mail client', last: '2026-09-10', result: 'fail', method: 'Pixel test with protection off by default', c: ['tracking'] },
    c_relay: { inv: 'Each service gets its own address', where: 'Mail relay', last: '2026-09-26', result: 'pass', method: 'Alias isolation test', c: ['identity', 'linkability'] },
    c_tokenize: { inv: 'The merchant never receives the card number', where: 'Wallet', last: '2026-09-26', result: 'pass', method: 'Payload inspection', c: ['identity'] },
    c_local_risk: { inv: 'Only a derived risk score leaves the device', where: 'Wallet', last: null, result: 'never', method: 'Designed; raw signals still sent', c: ['minimization', 'ondevice'] },
    c_sd: { inv: 'Verifiers request only the attributes they need', where: 'Wallet request screen', last: '2026-09-22', result: 'pass', method: 'Request review against purpose', c: ['disclosure'] },
    c_verifier_ret: { inv: 'Verifiers do not keep a copy', where: 'Verifier agreement', last: null, result: 'never', method: 'Stated in the request; not verifiable by us', c: ['disclosure', 'retention'] },
    c_issuer_blind: { inv: 'The issuer does not learn where an ID is presented', where: 'Protocol', last: null, result: 'never', method: 'Depends on revocation design', c: ['disclosure', 'linkability'] },
    c_route: { inv: 'Requests run on device unless they cannot', where: 'Assistant router', last: '2026-09-27', result: 'pass', method: 'Routing trace on a request corpus', c: ['ondevice'] },
    c_pcc_attest: { inv: 'Private compute runs only published, attested software', where: 'Private compute', last: '2026-09-29', result: 'pass', method: 'Attestation check by the client', c: ['ondevice', 'access'] },
    c_no_train: { inv: 'Requests are not retained or used for training by a third party', where: 'Third-party model contract', last: null, result: 'never', method: 'Contract clause; no audit rights exercised', c: ['thirdmodel', 'vendor'] },
    c_agent_policy: { inv: 'The agent combines data only within its purpose', where: 'Agent runtime', last: '2026-09-23', result: 'fail', method: 'Red-team prompt set', c: ['agent', 'inference', 'purpose'] },
    c_agent_approval: { inv: 'Consequential actions need the user’s approval', where: 'Agent runtime', last: '2026-09-23', result: 'fail', method: 'Action log review', c: ['agent'] },
    c_vpd: { inv: 'A tenant reads only its own rows', where: 'Tenant database', last: '2026-09-29', result: 'pass', method: 'Foreign-tenant canary', c: ['tenant'] },
    c_report_scope: { inv: 'Report models inherit tenant scope', where: 'Semantic layer', last: '2026-08-02', result: 'pass', method: 'Model review', c: ['tenant'] },
    c_server_filter: { inv: 'The API returns only the caller’s tenant', where: 'Dashboard API', last: null, result: 'never', method: 'Documented; no test', c: ['tenant', 'access'] },
    c_consent_read: { inv: 'Nothing is exported without current consent', where: 'Export boundary', last: '2026-09-27', result: 'fail', method: 'Revoked canary in the nightly file', c: ['consent', 'vendor'] },
    c_delete_orch: { inv: 'A deletion reaches every copy', where: 'Deletion orchestrator', last: '2026-09-28', result: 'fail', method: 'Canary deleted at T, searched at T+72h', c: ['deletion'] },
    c_ttl: { inv: 'Data expires at its declared retention', where: 'Storage lifecycle rules', last: '2026-09-20', result: 'fail', method: 'Oldest-row scan per store', c: ['retention', 'minimization'] },
    c_mask: { inv: 'Warehouse tables hide direct identifiers', where: 'Warehouse views', last: '2026-09-25', result: 'pass', method: 'Column scan', c: ['access', 'minimization'] },
    c_iam: { inv: 'Jobs read only what they need', where: 'IAM roles', last: '2026-07-14', result: 'pass', method: 'Quarterly access review', c: ['access'] },
    c_url_redact: { inv: 'No identifiers in logged URLs', where: 'API gateway logging', last: null, result: 'never', method: 'Documented; no log scan', c: ['logging', 'identity'] },
    c_join_policy: { inv: 'Cross-domain joins need an approved purpose', where: 'Warehouse and agent runtime', last: null, result: 'never', method: 'Policy on paper', c: ['linkability', 'purpose', 'inference'] },
    c_vendor_ack: { inv: 'Vendors confirm deletion and retention', where: 'Vendor contracts', last: null, result: 'never', method: 'Clause; no confirmations collected', c: ['vendor', 'deletion'] },
    c_dbsc: { inv: 'A copied session does not work on another device', where: 'Northstar Account sessions', last: null, result: 'never', method: 'Designed; sessions are still bearer cookies', c: ['takeover', 'devicetrust'] },
    c_cookie_enc: { inv: 'Other programs on the device cannot read the browser’s cookies', where: 'Northstar Browser', last: '2026-09-24', result: 'pass', method: 'Cookie extraction test from another process', c: ['takeover', 'devicetrust'] },
    c_ext_review: { inv: 'Extensions that can read every site are reviewed and allowed by name', where: 'Browser policy', last: '2026-09-25', result: 'fail', method: 'Inventory found all-site extensions with no review', c: ['takeover', 'tracking'] }
  };

  /* ── findings: FACT | INFERENCE | UNKNOWN | CONTROL FAILURE ──
   * v: questions · s: surfaces · c: concerns · l: privacy | security | both · cite · p: persona lines */
  function F(id, k, text, v, s, c, l, cite, p) { return { id: id, k: k, text: text, v: v, s: s, c: c, l: l, cite: cite, p: p || null }; }
  G.findings = [
    /* identity & authentication */
    F('f_pk_phish', 'FACT', 'Passkey sign-in is bound to the real origin; a lookalike site gets nothing usable.', ['prove', 'control', 'howlearn'], ['ident', 'web', 'all'], ['authentication'], 'security', ['cr_passkey', 'c_passkey']),
    F('f_pk_scope', 'FACT', 'Each site receives its own key pair, so the credential cannot link her across sites.', ['prove', 'linkid'], ['ident', 'all'], ['authentication', 'linkability'], 'privacy', ['c_rp_scope']),
    F('f_recovery', 'CONTROL FAILURE', 'Account recovery falls back to an SMS code: a phishable shared secret after the passkey rollout.', ['prove', 'control', 'changed', 'whoknows', 'stolen'], ['ident', 'all'], ['recovery', 'authentication'], 'both', ['sy_recovery', 'c_recovery'],
      { reviewer: ['DESIGN ISSUE', 'Removing the password did not remove the weakest path; recovery is it now.'], builder: ['REQUIRED CONTROL', 'Recover with another enrolled device or a recovery key, not SMS.'], auditor: ['EVIDENCE FAILURE', 'The recovery walkthrough reached the account with an SMS code alone.'], executive: ['RISK', 'Passkeys protect sign-in, but account takeover still runs through the phone number.'] }),
    F('f_authlog', 'FACT', 'Every sign-in records time, IP address and device class, kept far longer than needed.', ['prove', 'whoknows', 'live', 'know', 'where'], ['ident', 'all'], ['authentication', 'retention'], 'privacy', ['ds_authlog']),
    F('f_session', 'UNKNOWN', 'Session tokens are designed to be device-bound, but no replay test exists.', ['prove', 'control'], ['ident'], ['authentication', 'devicetrust'], 'security', ['c_session']),
    F('f_sync_hub', 'INFERENCE', 'The platform account sees every device and sync event: one place where all her credentials correlate.', ['prove', 'linkid', 'whoknows', 'where'], ['ident'], ['devicetrust', 'linkability'], 'privacy', ['sy_sync']),
    F('f_attest', 'FACT', 'Attestation tells a site the authenticator model, not the device serial.', ['prove'], ['ident'], ['devicetrust'], 'security', ['c_attest']),
    /* web */
    F('f_fp', 'CONTROL FAILURE', 'An analytics script builds a fingerprint that stays stable across unrelated sites.', ['whoknows', 'linkid', 'where', 'control', 'howlearn'], ['web', 'all'], ['tracking', 'linkability'], 'privacy', ['id_fp', 'v_pixel', 'c_id_rotate'],
      { reviewer: ['DESIGN ISSUE', 'The page the user sees is not the system that sees the user.'], builder: ['REQUIRED CONTROL', 'Reduce fingerprinting surfaces on device: fonts, GPU, screen.'], auditor: ['EVIDENCE FAILURE', 'The stability test matched her across three sites.'], executive: ['RISK', 'Third parties can follow people across the web.'] }),
    F('f_prerender', 'FACT', 'The third-party script receives URL, referrer and screen details before the page renders.', ['whoknows', 'howlearn', 'where'], ['web'], ['tracking'], 'privacy', ['v_pixel']),
    F('f_click', 'FACT', 'Links arrive with ?click_id=; known parameters are stripped, unknown ones pass through.', ['linkid', 'where'], ['web'], ['tracking', 'linkability'], 'privacy', ['id_click', 'c_link_strip']),
    F('f_ip', 'UNKNOWN', 'The network relay is optional; how many sessions expose the real IP is not measured.', ['whoknows', 'linkid', 'control'], ['web'], ['tracking', 'linkability'], 'privacy', ['id_ip', 'c_ip_mask']),
    F('f_itp', 'FACT', 'Third-party cookies and storage are partitioned per site.', ['control', 'linkid'], ['web'], ['tracking'], 'security', ['c_itp']),
    /* mail */
    F('f_pixel', 'CONTROL FAILURE', 'Opening a newsletter fetches a remote image: the sender learns it was opened, when, and the IP address.', ['whoknows', 'howlearn', 'where', 'control'], ['mail', 'all'], ['tracking', 'identity'], 'privacy', ['ev_open', 'c_remote_content'],
      { reviewer: ['DESIGN ISSUE', 'We think we are reading the email. Sometimes the email is also reading us.'], builder: ['REQUIRED CONTROL', 'Load remote content through a proxy, by default.'], auditor: ['EVIDENCE FAILURE', 'Protection is off by default; the pixel test succeeded.'], executive: ['RISK', 'Senders watch when and where people read.'] }),
    F('f_metadata', 'INFERENCE', 'Sender, recipient and timing metadata reveal her relationships without reading any content.', ['whoknows', 'infer', 'know'], ['mail'], ['identity', 'inference'], 'privacy', ['ds_mailmeta']),
    F('f_realemail', 'FACT', 'Newsletters and a game account hold her real address; a relay alias would do.', ['provewithout', 'linkid'], ['mail', 'ident'], ['identity', 'linkability'], 'privacy', ['id_email', 'c_relay']),
    F('f_summ_private', 'FACT', 'Long threads are summarized in attested private compute; nothing is retained.', ['leftdevice', 'whyleft', 'where'], ['mail', 'ai'], ['ondevice'], 'both', ['sy_pcc', 'c_pcc_attest']),
    F('f_llm_ret', 'UNKNOWN', 'Parallax AI’s retention of prompts is stated in the contract but never verified.', ['leftdevice', 'whyleft', 'where', 'delete', 'live'], ['mail', 'ai', 'vendor'], ['thirdmodel', 'vendor', 'retention'], 'privacy', ['v_llm', 'c_no_train']),
    /* payments */
    F('f_token', 'FACT', 'The merchant receives a device-specific token, not the card number.', ['provewithout', 'where', 'control'], ['pay'], ['identity'], 'security', ['id_token', 'c_tokenize']),
    F('f_merchant_link', 'INFERENCE', 'A merchant customer ID lets one merchant link every purchase she makes there.', ['linkid', 'whoknows'], ['pay'], ['linkability'], 'privacy', ['id_merchant']),
    F('f_raw_signals', 'CONTROL FAILURE', 'Raw device signals (motion, location, app usage) leave the phone where a derived risk score would do.', ['leftdevice', 'whyleft', 'provewithout', 'where'], ['pay', 'all'], ['minimization', 'ondevice'], 'privacy', ['ds_fraud', 'c_local_risk'],
      { reviewer: ['DESIGN QUESTION', 'Which of these signals materially improve fraud detection?'], builder: ['REQUIRED CONTROL', 'Compute risk on device; send the score and the few high-utility signals.'], auditor: ['NO EVIDENCE', 'On-device risk is designed but never shipped.'], executive: ['TRADE-OFF', 'Fraud protection versus minimization: keep what measurably stops fraud, drop the rest.'] }),
    F('f_train_raw', 'FACT', 'Model training receives the same raw signals as fraud investigation.', ['whyleft', 'provewithout'], ['pay'], ['purpose', 'minimization'], 'privacy', ['ds_fraud', 'pu_training']),
    /* digital identity */
    F('f_age_bool', 'FACT', 'The verifier receives “over 21: TRUE” with the issuer’s signature, and nothing else.', ['provewithout', 'prove', 'where', 'whoknows'], ['did', 'all'], ['disclosure'], 'privacy', ['cr_mdl', 'c_sd'],
      { reviewer: ['DESIGN PATTERN', 'Prove the attribute; do not disclose the identity.'], builder: ['CONTROL', 'Request one attribute; show it to the user before sharing.'], auditor: ['EVIDENCE', 'Request review passed on 09-22.'], executive: ['OUTCOME', 'Age checks without collecting ID copies.'] }),
    F('f_verifier_copy', 'UNKNOWN', 'Whether a verifier keeps what it received cannot be verified by us.', ['provewithout', 'live'], ['did'], ['disclosure', 'retention'], 'privacy', ['c_verifier_ret']),
    F('f_issuer', 'UNKNOWN', 'Whether the issuer learns where the ID was shown depends on the revocation protocol.', ['provewithout', 'prove', 'whoknows'], ['did'], ['disclosure', 'linkability'], 'privacy', ['v_issuer', 'c_issuer_blind']),
    F('f_kyc_vendor', 'FACT', 'Bank onboarding sends her photo and ID number to a verification vendor.', ['where', 'whoknows', 'changed'], ['did', 'vendor'], ['vendor', 'disclosure'], 'privacy', ['ds_kyc']),
    /* AI routing and agents */
    F('f_route', 'FACT', 'Short requests run on device; nothing leaves.', ['leftdevice', 'whyleft'], ['ai', 'all'], ['ondevice'], 'privacy', ['sy_odm', 'c_route']),
    F('f_third_prompt', 'UNKNOWN', 'When a request goes to Parallax AI, retention and training use are unverified.', ['leftdevice', 'whyleft', 'where'], ['ai', 'vendor'], ['thirdmodel'], 'privacy', ['v_llm', 'c_no_train'],
      { reviewer: ['DESIGN QUESTION', 'What privacy guarantees change when the request leaves our compute?'], builder: ['REQUIRED CONTROL', 'Ask before the hand-off; send the minimum prompt; strip identifiers.'], auditor: ['NO EVIDENCE', 'No audit of the vendor’s retention.'], executive: ['RISK', 'Some requests lose our guarantees without the user noticing.'] }),
    F('f_medical', 'INFERENCE', 'The assistant concludes “possible medical trip”. No record stores that fact.', ['infer', 'agentdo'], ['ai', 'all'], ['inference', 'agent'], 'privacy', ['ag_assist', 'in_medical'],
      { reviewer: ['DESIGN ISSUE', 'Authorized data + authorized data ≠ unlimited authorized inference.'], builder: ['REQUIRED CONTROL', 'Cross-domain join policy and purpose checks at inference time.'], auditor: ['EVIDENCE FAILURE', 'The red-team set produced a health inference from travel data.'], executive: ['RISK', 'The assistant derives sensitive facts nobody gave it.'] }),
    F('f_agent_act', 'CONTROL FAILURE', 'The assistant can book and share dates with no approval step.', ['agentdo', 'infer', 'control'], ['ai'], ['agent'], 'both', ['ag_assist', 'c_agent_approval']),
    F('f_agent_scope', 'FACT', 'Browser and Calendar tools have no data scope: all history, all calendars.', ['agentdo'], ['ai'], ['agent', 'access'], 'security', ['ag_assist']),
    F('f_hardship', 'INFERENCE', 'The support agent concludes financial hardship from three authorized tools.', ['infer', 'agentdo'], ['pay', 'ai'], ['inference', 'agent'], 'privacy', ['ag_support', 'in_hardship']),
    /* one account, and account takeover */
    F('f_onelife', 'INFERENCE', 'Browser, mail and wallet on one account add up to one life: interests, relationships, spending and schedule.', ['stolen', 'know', 'linkid'], ['ident', 'web', 'mail', 'pay', 'all'], ['linkability', 'identity', 'takeover'], 'privacy', ['sy_account', 'in_profile'],
      { reviewer: ['DESIGN QUESTION', 'Does each service need the others’ data, or only the same sign-in?'], builder: ['REQUIRED CONTROL', 'Keep one sign-in but separate data scopes per service; join only with a stated purpose.'], auditor: ['EVIDENCE', 'The account links browse, mail and payment records today.'], executive: ['RISK', 'One account is one breach away from a whole life.'] }),
    F('f_bearer', 'CONTROL FAILURE', 'Sessions are bearer cookies: a copied cookie works from another machine, past the second factor.', ['stolen', 'control'], ['ident', 'web', 'all'], ['takeover', 'devicetrust'], 'security', ['sy_account', 'c_dbsc'],
      { reviewer: ['DESIGN ISSUE', 'We protected the password and left the session unguarded.'], builder: ['REQUIRED CONTROL', 'Bind sessions to a device key; re-verify on new devices.'], auditor: ['NO EVIDENCE', 'No replay test exists for a copied session.'], executive: ['RISK', 'Malware can skip our sign-in protections entirely.'] }),
    F('f_ext', 'CONTROL FAILURE', 'An extension that can read and change every site sits in signed-in browsers with no review.', ['stolen', 'whoknows', 'control'], ['web', 'ident', 'all'], ['takeover', 'tracking'], 'both', ['v_ext', 'c_ext_review']),
    F('f_mailkey', 'FACT', 'Mail receives the reset link for every other account, so whoever holds mail holds the rest.', ['stolen', 'prove'], ['ident', 'mail', 'all'], ['takeover', 'recovery'], 'security', ['ds_mailmeta', 'c_recovery']),
    F('f_phish_pk', 'FACT', 'With a passkey, a lookalike sign-in page receives nothing it can replay.', ['stolen'], ['ident', 'web', 'all'], ['takeover', 'authentication'], 'security', ['cr_passkey', 'c_passkey']),
    F('f_cookie_enc', 'FACT', 'Other programs on the device can no longer read the browser’s cookies directly.', ['stolen'], ['web', 'ident'], ['takeover', 'devicetrust'], 'security', ['c_cookie_enc']),
    F('f_theft_unknown', 'UNKNOWN', 'How many signed-in sessions were ever copied is unknowable after the fact: nothing records a cookie leaving the device.', ['stolen', 'worst'], ['ident', 'web', 'all'], ['takeover'], 'security', ['sy_account']),
    /* data platform (earlier scenarios) */
    F('f_link', 'FACT', 'Phone, browser and account resolve to one person through player_id and the account.', ['know', 'join', 'linkid'], ['all', 'analytics'], ['identity', 'linkability'], 'privacy', ['id_player', 'in_profile']),
    F('f_iplink', 'INFERENCE', 'Browser and phone are matched by IP and time, not a shared key. The match can be wrong.', ['know', 'linkid'], ['web', 'all'], ['linkability'], 'privacy', ['id_ip']),
    F('f_home', 'INFERENCE', 'Late-evening location reveals a home area even at city precision.', ['know', 'infer'], ['analytics', 'all', 'pay'], ['inference'], 'privacy', ['ds_loc', 'in_home']),
    F('f_link_purpose', 'UNKNOWN', 'No record shows that linking devices was part of the original purpose.', ['know', 'join'], ['all', 'analytics'], ['purpose', 'linkability'], 'privacy', ['c_join_policy'],
      { reviewer: ['DESIGN QUESTION', 'Was this linkage necessary and permitted for the intended purpose?'], builder: ['REQUIRED CONTROL', 'Record purpose on the join and enforce it.'], auditor: ['NO EVIDENCE', 'The join policy has never been tested.'], executive: ['RISK', 'We may be building profiles no one approved.'] }),
    F('f_join_new', 'FACT', 'Neither table names a person with habits. The join does.', ['join'], ['analytics', 'all'], ['linkability', 'identity'], 'privacy', ['ds_behavior', 'ds_customer'],
      { reviewer: ['DESIGN QUESTION', 'Is this join required for the original purpose?'], builder: ['REQUIRED CONTROL', 'Aggregate before joining, or join in a purpose-checked environment.'], auditor: ['EVIDENCE', 'The view was created on 09-22 with no review.'], executive: ['RISK', 'A new profile of identified people now exists.'] }),
    F('f_join_approved', 'UNKNOWN', 'No approval exists for joining behavior to customer identity.', ['join', 'changed'], ['analytics', 'all'], ['purpose', 'linkability'], 'privacy', ['c_join_policy']),
    F('f_client_filter', 'CONTROL FAILURE', 'The dashboard API returns Tenant B and C rows to Tenant A’s browser; the chart hides them.', ['where', 'control', 'whoknows', 'leftdevice'], ['cloud', 'all'], ['tenant', 'access'], 'both', ['sy_dash', 'c_server_filter'],
      { reviewer: ['DESIGN ISSUE', 'Filtering is not isolation.'], builder: ['REQUIRED CONTROL', 'Enforce the tenant filter in the query, not the browser.'], auditor: ['EVIDENCE FAILURE', 'The captured payload contains three tenants.'], executive: ['RISK', 'One customer can see another’s data.'] }),
    F('f_pdf', 'CONTROL FAILURE', 'A Tenant A statement contains one Tenant B commission line.', ['control'], ['cloud'], ['tenant'], 'privacy', ['sy_pdf', 'c_report_scope']),
    F('f_vpd', 'FACT', 'The database row policy passed its foreign-tenant test.', ['control'], ['cloud'], ['tenant'], 'security', ['c_vpd']),
    F('f_cache', 'UNKNOWN', 'The report cache key omits the tenant, and no test covers it.', ['control'], ['cloud'], ['tenant'], 'security', ['sy_rcache']),
    F('f_url', 'FACT', 'Tenant and account IDs travel in the request URL and are logged in full.', ['where', 'whoknows', 'control'], ['cloud', 'all'], ['logging', 'identity'], 'both', ['ds_logs', 'c_url_redact']),
    F('f_emr', 'CONTROL FAILURE', 'The aggregation job needs one curated table but can read the raw identity store.', ['whoknows', 'control'], ['cloud', 'analytics'], ['access', 'minimization'], 'both', ['sy_emr', 'ds_identity', 'c_iam'],
      { reviewer: ['DESIGN ISSUE', 'Security may allow the access. Privacy asks whether the process needs it.'], builder: ['REQUIRED CONTROL', 'Scope the role to events_curated.'], auditor: ['EVIDENCE GAP', 'The last access review was in July.'], executive: ['RISK', 'One job can read everyone’s raw identity.'] }),
    F('f_mask', 'FACT', 'The curated warehouse table is masked; the staging copy of the same rows is not.', ['whoknows', 'control'], ['cloud', 'analytics'], ['access', 'minimization'], 'both', ['ds_curated', 'ds_raw', 'c_mask']),
    F('f_consent_export', 'CONTROL FAILURE', 'Consent revoked at 10:02, but the 10:20 export still contains her.', ['consent', 'control', 'where'], ['analytics', 'all', 'vendor'], ['consent', 'vendor'], 'privacy', ['sy_export', 'c_consent_read', 'inc_export'],
      { reviewer: ['DESIGN ISSUE', 'Consent propagation is incomplete.'], builder: ['REQUIRED CONTROL', 'Re-check consent at the export boundary.'], auditor: ['EVIDENCE FAILURE', 'The export contains a revoked subject.'], executive: ['RISK', 'User choice is not consistently enforced. Recommendation: block exports without current consent state.'] }),
    F('f_consent_ui', 'FACT', 'The UI and consent store show OFF within the same minute.', ['consent', 'control'], ['analytics', 'all'], ['consent'], 'privacy', ['sy_consent']),
    F('f_batch', 'CONTROL FAILURE', 'The running batch read consent at 09:55 and finished at 10:15 on old state.', ['consent'], ['analytics', 'all'], ['consent'], 'privacy', ['sy_batch']),
    F('f_vendor_ack', 'UNKNOWN', 'No acknowledgement from AdReach that the revocation or deletion arrived.', ['consent', 'delete'], ['analytics', 'all', 'vendor'], ['vendor', 'consent', 'deletion'], 'privacy', ['v_adreach', 'c_vendor_ack']),
    F('f_del_wh', 'CONTROL FAILURE', 'After deletion, she is still in the warehouse partition, the feature store and object storage.', ['delete', 'control'], ['all', 'analytics', 'cloud'], ['deletion'], 'privacy', ['sy_wh', 'sy_featstore', 'sy_obj', 'c_delete_orch'],
      { reviewer: ['DESIGN ISSUE', 'Deletion was designed for one database.'], builder: ['REQUIRED CONTROL', 'Fan deletion out to every store that holds the key; verify with a canary.'], auditor: ['EVIDENCE FAILURE', 'Canary still present at T+72h.'], executive: ['RISK', 'We tell people their data is deleted when it is not.'] }),
    F('f_del_logs', 'UNKNOWN', 'Logs may hold her identifiers in URLs. No search was run.', ['delete'], ['all', 'cloud'], ['deletion', 'logging'], 'privacy', ['ds_logs']),
    F('f_del_primary', 'FACT', 'The primary database and cache confirm deletion by canary lookup.', ['delete'], ['all'], ['deletion'], 'privacy', ['sy_primary', 'sy_cache']),
    F('f_ret_loc', 'CONTROL FAILURE', 'location_history is kept far longer than its declared retention.', ['live'], ['analytics', 'all', 'pay'], ['retention'], 'privacy', ['ds_loc', 'c_ttl']),
    F('f_ret_raw', 'CONTROL FAILURE', 'Staging has no lifecycle rule; raw events outlive the 7-day intent.', ['live'], ['cloud', 'analytics'], ['retention', 'access'], 'both', ['ds_raw', 'c_ttl']),
    F('f_ret_kyc', 'UNKNOWN', 'A verifier may keep ID documents for years; we cannot see how long.', ['live'], ['did'], ['retention', 'disclosure'], 'privacy', ['ds_kyc']),
    F('f_changes', 'FACT', '{changes}', ['changed'], ['all'], [], 'privacy', []),
    F('f_worst', 'INFERENCE', 'With stolen warehouse credentials, raw identity and location join into named histories.', ['worst'], ['all', 'cloud', 'analytics'], ['access', 'retention'], 'both', ['ds_identity', 'ds_loc', 'ds_raw']),
    F('f_worst_raw', 'FACT', 'The staging bucket has no TTL and no masking, so one stolen credential reaches months of raw events.', ['worst'], ['all', 'cloud', 'analytics'], ['retention', 'access'], 'both', ['ds_raw', 'c_ttl']),
    F('f_worst_sub', 'UNKNOWN', 'What AdReach and the verification vendor pass to their own subprocessors is not known.', ['worst'], ['all', 'vendor', 'did', 'analytics'], ['vendor'], 'privacy', ['v_adreach', 'c_vendor_ack']),
    F('f_worst_kyc', 'INFERENCE', 'A breached verification vendor would expose ID photos we never needed to send.', ['worst'], ['did', 'vendor'], ['disclosure', 'vendor'], 'privacy', ['ds_kyc'])
  ];

  /* ── decisions per view ─────────────────────────────── */
  function D(risk, why, mit, ev, issue, opts, rec, res) { return { risk: risk, why: why, mit: mit, ev: ev, exec: { issue: issue, opts: opts, rec: rec, res: res } }; }
  G.decisions = {
    know: D('Separate signals combine into a profile of one person.', 'Each signal looks harmless. Linked, they identify someone and reveal habits.', 'Keep contexts unlinkable by default; use scoped identifiers; require a purpose for every join.', 'Join policy test; identifier stability test across contexts.',
      'We can profile a person from signals collected for other reasons.', ['Keep linking, document the purpose', 'Link only in a purpose-checked environment', 'Stop cross-device linking'], 'Link only in a purpose-checked environment.', 'Probabilistic matches can still mislink people.'),
    whoknows: D('Parties the person never sees can observe them.', 'The page the user sees is not necessarily the system that sees the user.', 'Reduce observers on device: partition state, strip link decoration, proxy remote content, mask the IP.', 'Observer inventory per journey, re-measured on each release.',
      'Invisible parties learn what people do.', ['Disclose them', 'Block by default', 'Block known, measure the rest'], 'Block by default where the page still works; measure the rest.', 'First parties still see what happens on their own pages.'),
    where: D('Data moves further than the journey needs.', 'Every arrow is a decision. Each receiver can learn something the sender never intended.', 'Minimize at the source: derived signals, scoped identifiers, server-side scoping.', 'A data-flow inventory with a test for every boundary crossing.',
      'Data reaches places no one approved.', ['Accept with inventory', 'Minimize the failing hops', 'Remove the third-party hop'], 'Minimize the failing hops first, starting with third parties.', 'Unverified vendor retention remains.'),
    prove: D('The login is safer, but identity risk moved to recovery, sync and sign-in metadata.', 'Removing the password does not remove the privacy problem. It changes the trust model.', 'Recover with another device or a recovery key; bind sessions to the device; keep sign-in logs short.', 'Recovery walkthrough; session replay test; oldest sign-in record.',
      'Passkeys stopped phishing, but account takeover still goes through SMS recovery.', ['Keep SMS recovery', 'Require a second device or recovery key', 'Offer both, warn on SMS'], 'Require a second device or recovery key; keep SMS only with a waiting period.', 'People who lose every device need a slower, human recovery path.'),
    linkid: D('A stable identifier lets unrelated activity be linked.', 'Do not use a stable identifier when a scoped one will work.', 'Scope identifiers per site, per merchant and per service; rotate what must persist.', 'Cross-context stability test for each identifier.',
      'Some identifiers follow people everywhere.', ['Accept', 'Scope them', 'Remove them'], 'Scope them per context; remove the fingerprint surface.', 'IP address remains a weak link without a relay.'),
    boundary: D('Data leaves the device when it may not need to.', 'Do not collect what you can compute locally.', 'Process on device first; send derived signals; justify every crossing.', 'Routing trace: which requests leave, with what, and why.',
      'Some data leaves the device without a clear need.', ['Accept', 'Justify each crossing', 'Move processing to the device'], 'Justify each crossing; move the unjustified ones on device.', 'Some features need server compute.'),
    routing: D('The same request has different privacy properties depending on where it runs.', 'Where intelligence runs is itself a privacy decision.', 'Run on device first; use attested private compute when needed; ask before any third-party hand-off.', 'Routing trace plus attestation check; third-party retention audit.',
      'Some AI requests leave our guarantees.', ['Allow third-party models', 'Ask before each hand-off', 'Block third-party models'], 'Ask before each hand-off and send the minimum prompt.', 'Vendor retention is contractual, not verified.'),
    'sd-age': D('Verifiers ask for identity when they need one attribute.', 'Prove the attribute. Do not necessarily disclose the identity.', 'Request one attribute; show the request before sharing; no copies kept.', 'Request review against purpose; verifier retention attestation.',
      'Age checks collect whole identity documents.', ['Keep ID uploads', 'Accept attribute proofs', 'Require attribute proofs'], 'Accept attribute proofs and phase out ID uploads.', 'Some verifiers will still ask for more; the request screen must show it.'),
    'sd-relay': D('Services receive the real address when an alias would work.', 'Does the service need the user’s real email address at all?', 'Offer a relay address per service; keep the real one for legally required contact.', 'Alias isolation test.',
      'Real addresses become cross-service identifiers.', ['Real address everywhere', 'Relay by default', 'Relay on request'], 'Relay by default for sign-up forms.', 'Services can still link by name or payment.'),
    'sd-derived': D('Raw signals leave the device where a derived score would do.', 'Do not send raw data when a derived signal will do. Measure the utility of each signal; do not assume privacy automatically wins.', 'Compute risk on device; send the score plus the few high-utility signals; separate training data from investigation data.', 'Signal-utility study; payload inspection after the change.',
      'Fraud protection collects more than it measurably needs.', ['Keep all signals', 'Keep high-utility signals only', 'Derived score only'], 'Keep high-utility signals; derive the rest on device.', 'Some fraud patterns need raw signals during investigation.'),
    join: D('The join creates a new identified profile that neither table held.', 'The exposure may not exist in either table. It can be created by the relationship.', 'Aggregate before joining, or join in a purpose-checked environment with an expiry.', 'Join approval record; audit of who ran it.',
      'Behavior is now joined to named customers.', ['Keep the join', 'Aggregate first', 'Drop the view'], 'Aggregate first; keep the identified join for approved cases.', 'Existing extracts may persist.'),
    infer: D('Authorized inputs produce an unauthorized inference.', 'AI turns the JOIN from something a developer writes into something the machine may decide to perform.', 'Purpose, data scope and cross-domain join policy at runtime; human approval before actions.', 'Red-team prompts replayed on every model or tool change.',
      'The assistant derives sensitive facts about people.', ['Remove a tool', 'Runtime purpose policy', 'Human approval for actions'], 'Runtime purpose policy plus approval before consequential actions.', 'Novel inferences can slip past rules; keep audit and a kill switch.'),
    agentdo: D('The agent can do more than its purpose needs.', 'Every tool may be authorized; not every combination or action is appropriate.', 'Scope each tool to the task’s data; limit actions; require approval for anything consequential.', 'Privilege diff per release; action log review.',
      'The assistant can act without asking.', ['Keep broad tools', 'Scope tools per task', 'Approval for all actions'], 'Scope tools per task and require approval for bookings, payments and sharing.', 'Approval fatigue: keep prompts rare and specific.'),
    consent: D('A “no” reaches the UI but not the systems that act on it.', 'Consent is distributed state, not a checkbox.', 'Check consent at read and export time; stamp data with the consent version; push revocations to vendors.', 'Revoked canary absent from the next export and from vendor state.',
      'User choice is not consistently enforced.', ['Faster sync', 'Check consent at every boundary', 'Pause exports'], 'Block exports without current consent state.', 'Vendors may hold old state until they acknowledge.'),
    delete: D('The delete button succeeds locally while copies survive elsewhere.', 'Deletion is a distributed-systems problem disguised as a button.', 'Orchestrate deletion across every store holding the key; expire what cannot be deleted; collect vendor confirmations.', 'Can we prove every relevant copy was deleted, detached, or expired?',
      'We say data is deleted when copies remain.', ['Change the promise', 'Fix the fan-out', 'Both'], 'Fix the fan-out and state the backup window in the promise.', 'Backups keep data until rotation.'),
    live: D('Data lives far longer than anyone decided.', 'Encryption does not answer why the data exists, or for how long.', 'Lifecycle rules per store, set from required retention.', 'Oldest-row scan per store against the declared TTL.',
      'Some data outlives its purpose by months.', ['Extend the policy', 'Enforce TTLs', 'Delete the backlog now'], 'Enforce TTLs and delete the backlog.', 'Stores without scanners stay unknown.'),
    purpose: D('Data collected for one purpose is used for another.', 'People agreed to a purpose, not to every later use.', 'Record purpose on every read; block undeclared uses.', 'Purpose check at read time, with logs.',
      'Some data is used for purposes we never declared.', ['Declare and notify', 'Block undeclared uses', 'Review case by case'], 'Block undeclared uses until reviewed.', 'Unknown uses remain until purpose logging covers every read.'),
    access: D('People and jobs can read more than they need.', 'Security may allow the access. Privacy still asks whether the process needs it.', 'Scope roles to what a job reads; mask staging like the warehouse; redact logs.', 'Automated privilege diff each deploy.',
      'One job and every on-call engineer can read raw identity.', ['Keep, monitor', 'Scope roles now', 'Remove raw copies'], 'Scope the role and mask staging now.', 'Log copies remain until redaction ships.'),
    'ctl-tenant': D('Tenant isolation holds in the database and fails after it.', 'If unauthorized data reached the client, the privacy failure already happened. A report can be nearly all correct and still be completely wrong.', 'Carry tenant scope through every layer: session, semantic model, render, cache key, API response.', 'Foreign-tenant canary at every hop, including what the browser receives.',
      'One customer can receive another customer’s data.', ['Hotfix the API', 'Tenant-scope every layer', 'Pause cross-tenant reports'], 'Hotfix the API today; scope every layer this quarter.', 'Statements already sent cannot be recalled.'),
    'ctl-auth': D('The sign-in control works; the paths around it do not.', 'Removing the password does not remove the privacy problem. It changes the trust model.', 'Harden recovery and session binding to the same standard as sign-in.', 'Recovery walkthrough and session replay test.',
      'Account takeover still runs through recovery.', ['Accept', 'Harden recovery', 'Remove SMS recovery'], 'Harden recovery and remove SMS as a sole factor.', 'Lost-everything cases need a human process.'),
    'ctl-link': D('Protections stop cookies but not every linking surface.', 'Do not use a stable identifier when a scoped one will work.', 'Reduce fingerprinting surfaces; strip decoration; offer the IP relay by default.', 'Fingerprint stability and IP exposure measured per release.',
      'Third parties can still follow people across sites.', ['Accept', 'Block fingerprinting surfaces', 'Default network relay'], 'Block fingerprinting surfaces now; evaluate a default relay.', 'First-party tracking on each site remains.'),
    'ctl-sd': D('The request is minimal; what happens after it is not verifiable.', 'Prove the attribute. Do not necessarily disclose the identity.', 'Prefer protocols where the issuer cannot see presentations; require verifier no-retention terms.', 'Protocol review; verifier attestations.',
      'We can minimize what is shared, not what is kept.', ['Trust verifiers', 'Require no-retention terms', 'Allow only certified verifiers'], 'Require no-retention terms and show them on the request screen.', 'A dishonest verifier can still keep data.'),
    'ctl-route': D('On-device and private compute are verified; third-party hand-offs are not.', 'Where intelligence runs is itself a privacy decision.', 'Ask before hand-off; minimize the prompt; audit the vendor.', 'Attestation checks; vendor audit.',
      'Requests sent to a third party lose our guarantees.', ['Allow', 'Ask each time', 'Block'], 'Ask each time and minimize the prompt.', 'Contractual promises only.'),
    'ctl-agent': D('Tool access is checked; the combined inference and actions are not.', 'AI turns the JOIN from something a developer writes into something the machine may decide to perform.', 'Purpose-scoped retrieval, cross-domain restrictions, action limits, human approval.', 'Red-team prompts replayed on each change.',
      'The agent can reach conclusions and act without approval.', ['Restrict tools', 'Runtime policy', 'Approval for actions'], 'Runtime policy plus approval for actions.', 'Inferences held before the fix.'),
    'ctl-access': D('Least privilege is documented, not enforced.', 'Security may allow the access. Privacy still asks whether the process needs it.', 'Generate roles from what a job reads; alert on drift.', 'Automated privilege diff on every deploy.',
      'Jobs hold far more access than they need.', ['Annual review', 'Automated diff', 'Rebuild roles'], 'Automated diff on every deploy.', 'Copies made with the old role.'),
    'ctl-log': D('Identifiers leak into logs that outlive the data.', 'The database may be protected while telemetry creates another copy.', 'IDs out of URLs; redaction at the gateway; short log retention.', 'Daily scan of logs for identifier patterns.',
      'Logs hold identity outside database controls.', ['Restrict readers', 'Redact at source', 'Both'], 'Redact at source; restrict readers meanwhile.', 'Existing logs until they expire.'),
    takeover: D('One stolen session opens a whole life.', 'The account is the join key. Attackers skip the password by stealing what comes after it: the session, the recovery path, the browser itself.', 'Passkeys for sign-in; sessions bound to the device; extensions allowed by name; recovery without SMS; separate data scopes behind one sign-in.', 'Lookalike-origin test; copied-session replay test; extension inventory; recovery walkthrough.',
      'Anyone who steals one session sees her browsing, mail and purchases.', ['Stronger passwords and codes', 'Protect the session and recovery path', 'Separate the services’ data behind one sign-in'], 'Protect the session and recovery path now; separate data scopes next.', 'Malware running on her own device can still act as her.'),
    changed: D('The system changed after review; the review did not.', 'Reviews go stale the day after launch.', 'Re-review on new joins, destinations, vendors, identifiers, tools and retention increases.', 'Change feed reconciled with reviews weekly.',
      'Risky changes shipped since the last review.', ['Review later', 'Re-review the top three now', 'Freeze those changes'], 'Re-review recovery, the consent export and the assistant’s tools now.', 'Changes before the feed existed are unknown.'),
    worst: D('A single credential, insider or vendor reaches named histories.', 'Damage is what we collect, times how long we keep it, times how identifiable it is, times who holds the key.', 'Remove what is not needed; compute locally; then scope access; then de-identify.', 'Blast-radius review after each safeguard.',
      'Our worst day exposes identity joined with location and ID documents.', ['Insure', 'Keep less', 'Limit who can reach it'], 'Keep less first, then limit who can reach it.', 'Vendor copies remain outside our control.')
  };
  G.principleFor = { takeover: 'passkey', 'ctl-account': 'passkey', know: 'scoped', whoknows: 'scoped', where: 'derived', prove: 'passkey', linkid: 'scoped', boundary: 'local', routing: 'local', 'sd-age': 'attr', 'sd-relay': 'scoped', 'sd-derived': 'derived', join: 'infer', infer: 'infer', agentdo: 'infer', consent: 'no', delete: 'del', live: 'encrypt', purpose: 'encrypt', access: 'encrypt', 'ctl-tenant': 'hiding', 'ctl-auth': 'passkey', 'ctl-link': 'scoped', 'ctl-sd': 'attr', 'ctl-route': 'local', 'ctl-agent': 'infer', 'ctl-access': 'encrypt', 'ctl-log': 'scoped', changed: 'no', worst: 'local' };

  G.decisions['ctl-account'] = G.decisions.takeover;

  /* ── reviews ────────────────────────────────────────── */
  G.reviews = [
    { id: 'RV-410', feature: 'Passkey sign-in', s: 'ident', stage: 'Launched · re-review due', view: 'passkey', conds: ['c_passkey', 'c_rp_scope', 'c_recovery', 'c_session'] },
    { id: 'RV-411', feature: 'Browser tracking protections', s: 'web', stage: 'In review', view: 'browser', conds: ['c_itp', 'c_id_rotate', 'c_link_strip', 'c_ip_mask'] },
    { id: 'RV-412', feature: 'Mail privacy and summaries', s: 'mail', stage: 'Launched', view: 'mail', conds: ['c_remote_content', 'c_relay', 'c_pcc_attest', 'c_no_train'] },
    { id: 'RV-413', feature: 'Wallet risk scoring', s: 'pay', stage: 'In review', view: 'payment', conds: ['c_tokenize', 'c_local_risk', 'c_ttl'] },
    { id: 'RV-414', feature: 'Age verification with a digital ID', s: 'did', stage: 'In review', view: 'age', conds: ['c_sd', 'c_verifier_ret', 'c_issuer_blind'] },
    { id: 'RV-415', feature: 'Assistant routing and tools', s: 'ai', stage: 'In review', view: 'agent', conds: ['c_route', 'c_pcc_attest', 'c_agent_policy', 'c_agent_approval'] },
    { id: 'RV-416', feature: 'Ledger commission statements', s: 'cloud', stage: 'Launched', view: 'tenant', conds: ['c_vpd', 'c_report_scope', 'c_server_filter'] },
    { id: 'RV-418', feature: 'Northstar Account sessions', s: 'ident', stage: 'In review', view: 'takeover', conds: ['c_passkey', 'c_dbsc', 'c_cookie_enc', 'c_ext_review', 'c_recovery'] },
    { id: 'RV-417', feature: 'Churn re-engagement export', s: 'analytics', stage: 'Launched', view: 'consent', conds: ['c_consent_read', 'c_vendor_ack', 'c_delete_orch'] }
  ];

  /* ── saved views: selector presets, not modules ─────── */
  function SV(id, label, p, s, j, q, c, subj) { return { id: id, label: label, s: { p: p, s: s, j: j, q: q, c: c, subj: subj || 'person' } }; }
  G.saved = [
    SV('passkey', 'Password → passkey', 'reviewer', 'ident', 'signin', 'prove', ['authentication'], 'credential'),
    SV('browser', 'Browser tracking', 'reviewer', 'web', 'browse', 'whoknows', ['tracking']),
    SV('mail', 'Mail observation', 'reviewer', 'mail', 'mail', 'whoknows', ['tracking']),
    SV('payment', 'Payment privacy', 'reviewer', 'pay', 'pay', 'provewithout', ['minimization'], 'product'),
    SV('age', 'Digital ID / age proof', 'reviewer', 'did', 'age', 'provewithout', ['disclosure']),
    SV('xdevice', 'Cross-device linkability', 'reviewer', 'all', 'browse', 'know', ['linkability']),
    SV('consent', 'Consent propagation', 'auditor', 'analytics', 'revoke', 'consent', ['consent']),
    SV('deleteme', 'Delete me', 'auditor', 'analytics', 'delete', 'delete', ['deletion']),
    SV('airoute', 'AI data routing', 'builder', 'ai', 'ai', 'leftdevice', ['ondevice']),
    SV('agent', 'AI agent privileges', 'builder', 'ai', 'ai', 'agentdo', ['agent'], 'agent'),
    SV('tenant', 'Cross-tenant isolation', 'auditor', 'cloud', 'report', 'control', ['tenant'], 'tenant'),
    SV('twotable', 'Two-table reidentification', 'reviewer', 'analytics', 'revoke', 'join', ['linkability'], 'dataset'),
    SV('onelife', 'One account, one life', 'reviewer', 'ident', 'account', 'stolen', ['linkability']),
    SV('takeover', 'Account takeover', 'auditor', 'ident', 'account', 'control', ['takeover'])
  ];
  /* Focus mode: three presets for a short walkthrough */
  G.focus = [
    { label: 'What do we know about this person?', s: G.saved[5].s },
    { label: 'Where did their data go?', s: { p: 'reviewer', s: 'cloud', j: 'report', q: 'where', c: ['tenant'], subj: 'tenant' } },
    { label: 'Did the control really work?', s: G.saved[6].s }
  ];
})();
