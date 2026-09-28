/* Northstar — the operating layer (synthetic).
 *
 * data.js describes what Northstar HAS: products, systems, data, flows,
 * vendors, models, controls and findings. This file describes what Northstar
 * OWES and how it PROVES it:
 *
 *   promises     — plain-language commitments made to people, where they were made,
 *                  and which features, data, controls and findings bear on them
 *   decisions    — the decision each broken promise requires: options with pros,
 *                  cons and trade-offs, a recommendation, dissent, owner, approver,
 *                  due date, the final call and the test that proves the fix
 *   controlTests — when each control was last tested, the result, the evidence,
 *                  exceptions and the next test
 *   indicators   — target, owner, coverage and eight weeks of history per metric
 *   perspectives — the four operating perspectives roles are grouped into
 *
 * Everything is invented and describes no real organisation. Counts shown on
 * screen are computed from these records; nothing in the views is typed. */
(function () {
'use strict';
var NS = window.NS;

/* ── promises ─────────────────────────────────────────────────────────────
 * status is NOT stored: model.js derives BROKEN / AT RISK / UNPROVEN / KEPT
 * from the open findings, control tests and evidence freshness below. */
NS.promises = [
  { id: 'PR-LOC', text: 'We use your location to find a pickup point near you — not to advertise to you.',
    where: 'Storefront location-permission prompt (iOS and Android)', audience: 'Storefront users who turned location on',
    features: ['f_pickup'], purposes: ['service_delivery'], datasets: ['d_lochist', 'd_purchase'],
    controls: ['c_retention_scan', 'c_purpose_runtime', 'c_schema'], findings: ['PRV-0201', 'PRV-0208', 'PRV-0214', 'PRV-0240'],
    risk: 'R-01', decision: 'D-101', owner: 't_location' },
  { id: 'PR-HEALTH', text: 'What you track in Pulse stays in Pulse. It is never used for advertising.',
    where: 'Pulse onboarding, screen 2', audience: 'Pulse users',
    features: ['f_cycle', 'f_heart'], purposes: ['service_delivery'], datasets: ['d_pulsecycle', 'd_pulseinstall', 'd_identity_graph'],
    controls: ['c_cryptoshred', 'c_id_scope', 'c_purpose_runtime'], findings: ['PRV-0233', 'PRV-0229', 'PRV-0239'],
    risk: 'R-02', decision: 'D-102', owner: 't_pulse' },
  { id: 'PR-SEC', text: 'Information you give us to protect your account is used only to protect your account.',
    where: 'Privacy notice §5 “Security and fraud”', audience: 'Every Northstar account holder',
    features: ['f_fraud', 'f_oneclick'], purposes: ['fraud_prevention', 'account_security'], datasets: ['d_fraudfeat', 'd_phone2fa'],
    controls: ['c_purpose_fs', 'c_purpose_runtime'], findings: ['PRV-0217', 'PRV-0203'],
    risk: 'R-03', decision: 'D-103', owner: 't_fraud' },
  { id: 'PR-OPTOUT', text: 'When you opt out of personalised ads, every Northstar system and partner stops within 24 hours.',
    where: 'Settings › Privacy › Personalised ads', audience: 'People who opted out of personalised ads',
    features: ['f_lookalike', 'f_capi'], purposes: ['advertising'], datasets: ['d_audience'],
    controls: ['c_consent_read', 'c_consent_batch', 'c_cmp'], findings: ['PRV-0205', 'PRV-0226'], incidents: ['INC-2026-014'],
    risk: null, decision: 'D-104', owner: 't_audience', sla: { hours: 24, measure: 'consent propagation P99' } },
  { id: 'PR-DELETE', text: 'When you delete your account, we delete your data — everywhere, including our partners.',
    where: 'Settings › Account › Delete account', audience: 'Everyone who asks to be deleted',
    features: ['f_rag', 'f_search'], purposes: ['service_delivery'], datasets: ['d_profile', 'd_novavec', 'd_search'],
    controls: ['c_delete_orch', 'c_delete_verify', 'c_backup_reapply', 'c_vendor_attest'], findings: ['PRV-0221', 'PRV-0176', 'PRV-0210'],
    risk: null, decision: 'D-107', owner: 't_privacy' },
  { id: 'PR-AI', text: 'Nova doesn’t train on your conversations unless you choose to share them.',
    where: 'Nova settings › Improve Nova (off by default)', audience: 'Nova Assistant users',
    features: ['f_memory', 'f_rag'], purposes: ['service_delivery', 'model_training'], datasets: ['d_prompts', 'd_novamem', 'd_novavec'],
    controls: ['c_prompt_redact', 'c_ai_review'], findings: ['PRV-0212', 'PRV-0236', 'PRV-0221'],
    risk: 'R-04', decision: 'D-105', owner: 't_nova' },
  { id: 'PR-BROWSE', text: 'Browser insights are aggregated. We never tie the sites you visit to your account.',
    where: 'Browser-extension store listing', audience: 'Browser-extension users',
    features: ['f_browse'], purposes: ['analytics'], datasets: ['d_browse'],
    controls: ['c_gate_egress', 'c_vendor_attest'], findings: ['PRV-0192', 'PRV-0210'],
    risk: 'R-05', decision: 'D-106', owner: 't_browser' },
  { id: 'PR-LOGS', text: 'We don’t write your personal details into our logs.',
    where: 'Security whitepaper, page 4', audience: 'Every customer',
    features: ['f_oneclick'], purposes: ['account_security'], datasets: ['d_applogs'],
    controls: ['c_log_redact', 'c_policy_nolog', 'c_lint_pii'], findings: ['PRV-0199', 'PRV-0218'],
    risk: 'R-06', decision: 'D-108', owner: 't_sre' },
  { id: 'PR-SUPPORT', text: 'Your support conversations are handled in your region by providers we have vetted.',
    where: 'Help Center › How we use your support chats', audience: 'People who contact support',
    features: ['f_chat'], purposes: ['customer_support'], datasets: ['d_transcripts'],
    controls: ['c_vendor_attest', 'c_gate_egress'], findings: ['PRV-0237'],
    risk: 'R-07', decision: 'D-109', owner: 't_support' },
  { id: 'PR-KIDS', text: 'Family accounts for children are kept separate and never used for advertising.',
    where: 'Family accounts sign-up', audience: 'Children in family accounts, and their parents',
    features: ['f_family'], purposes: ['service_delivery'], datasets: ['d_family'],
    controls: ['c_children', 'c_cmp'], findings: ['PRV-0181'],
    risk: null, decision: null, owner: 't_storefront' },
  { id: 'PR-MSG', text: 'Northstar can’t read your Messenger chats.',
    where: 'Messenger “Encrypted” badge and help page', audience: 'Messenger users',
    features: ['f_e2ee'], purposes: ['service_delivery'], datasets: ['d_msgmeta'],
    controls: ['c_tls', 'c_access_audit'], findings: ['PRV-0160'],
    risk: 'R-09', decision: null, owner: 't_msg' }
];

/* ── decisions ────────────────────────────────────────────────────────────
 * status: owed → decided → verifying → closed. `final` records the call once
 * it is made; `test` is how Northstar will prove the fix, and `testResult`
 * what that test says today. Due dates are derived from the earliest finding
 * behind the decision (model.js), so `due` here is only an override. */
NS.decisions = [
  { id: 'D-101', promise: 'PR-LOC', risk: 'R-01', findings: ['PRV-0201', 'PRV-0208'],
    question: 'Stop keeping 18 months of precise location for a 30-day need, and stop advertising from it?',
    owner: 't_location', approver: 'CPO', status: 'owed', opened: '2026-09-12',
    consequence: 'Where people sleep and work is readable by anyone who compromises one store, and is already shaping ads they never agreed to.',
    options: [
      { id: 'A', title: 'Enforce a 30-day TTL and block the advertising read', privacy: 'Removes most stored history and the secondary use', product: 'None visible to customers', cost: 'about 1 engineer-week',
        pros: ['Fast', 'Keeps pickup working unchanged', 'Closes both findings'], cons: ['Replica and audience copies still need purging'], tradeoff: 'Speed over completeness: the copies downstream are handled separately.' },
      { id: 'B', title: 'Store only the chosen pickup point, never coordinates', privacy: 'No movement history exists at all', product: 'Loses the “recent locations” shortcut', cost: 'about 3 engineer-weeks',
        pros: ['Nothing left to breach or misuse', 'Simplest to prove'], cons: ['Product loses a shortcut some users rely on'], tradeoff: 'A small convenience traded for eliminating the data class.' },
      { id: 'C', title: 'Compute the nearest pickup point on the device', privacy: 'No server-side location at all', product: 'Same experience, slower first launch', cost: 'about one quarter',
        pros: ['Strongest guarantee', 'Scales to future location features'], cons: ['Longest to ship', 'Harder to debug'], tradeoff: 'Months of risk now for the strongest end state.' }
    ],
    recommend: 'A', recommendText: 'A this week to stop the harm; B next sprint to remove the data class; C on the roadmap.',
    dissent: 'Audience Engineering says home and work clusters lift lookalike match rates; the lift has not been measured independently.',
    uncertainty: 'Lineage covers Audience Builder only partly, so the number of downstream copies is not known.',
    test: { text: 'Retention scan shows the oldest location row is 30 days or younger in the primary store and the EU replica, and no advertising reads in 7 days.', control: 'c_retention_scan' },
    testResult: 'fail', final: null },
  { id: 'D-102', promise: 'PR-HEALTH', risk: 'R-02', findings: ['PRV-0229', 'PRV-0233'],
    question: 'Freeze the identity-resolution job that links Pulse health device IDs to advertising IDs?',
    owner: null, approver: 'CPO', status: 'owed', opened: '2026-09-19',
    consequence: 'Health behaviour — which Pulse screens someone opens — can change the ads they see. A logged-out device becomes a named person.',
    options: [
      { id: 'A', title: 'Freeze the job and block purpose-scoped IDs from joining', privacy: 'Stops new cross-context joins today', product: 'Unified customer view paused', cost: 'about 2 engineer-days',
        pros: ['Stops the harm immediately', 'Reversible'], cons: ['Three dashboards go stale'], tradeoff: 'Dashboard freshness traded for stopping health-to-ads linkage.' },
      { id: 'B', title: 'Name an owner, declare a purpose per edge, delete edges older than need', privacy: 'Removes most of the graph', product: 'Marketing match rates drop', cost: 'about 3 engineer-weeks',
        pros: ['Keeps a governed identity graph', 'Makes future joins reviewable'], cons: ['Needs an owner who does not exist today'], tradeoff: 'Governance effort traded for keeping a useful asset.' },
      { id: 'C', title: 'Shut the job down', privacy: 'Removes the exposure', product: 'No unified customer view', cost: 'about 1 engineer-week',
        pros: ['Simplest end state'], cons: ['Loses legitimate cross-product support use'], tradeoff: 'All value of the graph traded for certainty.' }
    ],
    recommend: 'A', recommendText: 'A today; then B with a named owner, or C if no one will own it.',
    dissent: 'Growth says the unified view powers three executive dashboards.',
    uncertainty: 'Downstream copies in the advertising warehouse are not inventoried.',
    test: { text: 'No edge in identity_graph_edges joins a Pulse-scoped ID to an advertising ID; lineage shows no new reads from the ads warehouse.', control: 'c_id_scope' },
    testResult: 'unknown', final: null },
  { id: 'D-103', promise: 'PR-SEC', risk: 'R-03', findings: ['PRV-0217', 'PRV-0203'],
    question: 'Remove Marketing’s access to fraud signals and 2FA phone numbers?',
    owner: 't_fraud', approver: 'CISO', status: 'owed', opened: '2026-09-22',
    consequence: 'People flagged as risky can be excluded from offers, or targeted differently, by advertisers who never see why. A phone number given for security becomes an ad identifier.',
    options: [
      { id: 'A', title: 'Remove the advertising consumer now', privacy: 'Ends the secondary use', product: 'Lookalike model loses one feature', cost: 'about 2 engineer-days',
        pros: ['Immediate', 'Small change'], cons: ['Relies on a person approving the next consumer correctly'], tradeoff: 'Stops the harm without preventing the next one.' },
      { id: 'B', title: 'Fraud-scoped identifier and runtime purpose enforcement at the feature store', privacy: 'Makes this drift impossible, not just forbidden', product: 'None', cost: 'about 4 engineer-weeks',
        pros: ['Prevents recurrence', 'Moves the control from L1 to L4'], cons: ['Weeks of exposure unless A ships first'], tradeoff: 'Engineering time traded for a machine guarantee.' },
      { id: 'C', title: 'Aggregate fraud bands before any non-fraud read', privacy: 'Reduces linkability', product: 'Coarser marketing signal', cost: 'about 2 engineer-weeks',
        pros: ['Keeps some analytic value'], cons: ['Still a secondary use of security data'], tradeoff: 'Partial value kept at the cost of the promise’s plain meaning.' }
    ],
    recommend: 'A', recommendText: 'A now, B this quarter. Stop matching 2FA phone numbers for audiences the same day.',
    dissent: null, uncertainty: 'Existing exports at AdReach: deletion must be requested and attested.',
    test: { text: 'Feature-store read log shows no consumer with purpose ≠ fraud_prevention for 14 days; audience build excludes mfa_phone_numbers.', control: 'c_purpose_fs' },
    testResult: 'fail', final: null },
  { id: 'D-104', promise: 'PR-OPTOUT', risk: null, findings: ['PRV-0205', 'PRV-0226'], incidents: ['INC-2026-014'],
    question: 'Make the consent filter a required step on every export, and stop AdReach batches until they acknowledge revocations?',
    owner: 't_audience', approver: 'CPO', status: 'verifying', opened: '2026-09-22',
    consequence: 'People who said no to personalised ads kept receiving them from a partner, up to 12 days after opting out.',
    options: [
      { id: 'A', title: 'Required consent task in every export DAG, with a contract test', privacy: 'No export can skip the filter', product: 'None', cost: 'about 1 engineer-week',
        pros: ['Turns a convention into an invariant', 'Covers future exports'], cons: ['Batch still lags revocations by up to a day'], tradeoff: 'Correctness now, latency later.' },
      { id: 'B', title: 'Check consent at read time inside the export service', privacy: 'Exports reflect consent as of each row read', product: 'Exports ~8% slower', cost: 'about 3 engineer-weeks',
        pros: ['Closes the mid-job revocation gap'], cons: ['Larger change to a busy service'], tradeoff: 'Throughput traded for freshness.' },
      { id: 'C', title: 'Pause AdReach batches until they acknowledge revocations', privacy: 'Stops the partner gap immediately', product: 'Campaign reporting delayed', cost: 'about 1 day',
        pros: ['Immediate'], cons: ['Commercial friction with the partner'], tradeoff: 'Revenue timing traded for honouring the opt-out.' }
    ],
    recommend: 'A', recommendText: 'A plus C until AdReach acknowledgements are automatic; B next quarter.',
    dissent: 'Ads Measurement asked for C to be limited to one week; the CPO did not agree.',
    uncertainty: 'AdReach acknowledges deletions in bulk, so per-person confirmation is not yet possible.',
    test: { text: 'Reconciliation: every revocation older than 24 h is absent from the last AdReach delivery, and AdReach has acknowledged it.', control: 'c_consent_batch' },
    testResult: 'pending',
    final: { option: 'A', plus: 'C', by: 'CPO', on: '2026-09-24', rationale: 'The promise says every partner within 24 hours; only a required step plus a paused partner can keep it this week.' } },
  { id: 'D-105', promise: 'PR-AI', risk: 'R-04', findings: ['PRV-0212', 'PRV-0236', 'PRV-0221'],
    question: 'Stop training on Nova conversations without opt-in, cap prompt logs at 30 days, and hold Assistant Memory until it has deletion?',
    owner: 't_nova', approver: 'CPO', status: 'owed', opened: '2026-09-05',
    consequence: 'What people confide to an assistant — symptoms, money, relationships — becomes a stored record and a training example.',
    options: [
      { id: 'A', title: '30-day TTL, redact before logging, hold Memory launch', privacy: 'About 90% fewer stored prompts; no memory without deletion', product: 'Less debugging history; Memory slips', cost: 'about 2 engineer-weeks',
        pros: ['Addresses all three findings'], cons: ['Launch date moves'], tradeoff: 'Launch timing traded for keeping the promise at launch.' },
      { id: 'B', title: 'Separate opt-in for training, with memorisation tests', privacy: 'Restores purpose limitation for training', product: 'Smaller fine-tune set', cost: 'about 1 month',
        pros: ['Keeps a training path'], cons: ['Does not shorten log retention'], tradeoff: 'Model quality traded for consent.' },
      { id: 'C', title: 'Stateless serving: no prompt retention at all', privacy: 'Nothing to breach', product: 'Harder quality evaluation', cost: 'about one quarter',
        pros: ['Strongest guarantee'], cons: ['Evaluation needs a new approach'], tradeoff: 'Evaluation convenience traded for zero retention.' }
    ],
    recommend: 'A', recommendText: 'A and B now; evaluate C.',
    dissent: 'Nova Platform notes a fine-tuned model cannot “unlearn” examples already used; retraining is the only removal.',
    uncertainty: 'Which conversations are already in the fine-tune set is known only by week, not by person.',
    test: { text: 'Oldest prompt log ≤ 30 days; training manifest lists only opted-in conversation IDs; memory rows have a deletion path verified by canary.', control: 'c_ai_review' },
    testResult: 'fail', final: null },
  { id: 'D-106', promise: 'PR-BROWSE', risk: 'R-05', findings: ['PRV-0192', 'PRV-0210'],
    question: 'Stop sending full URLs with account IDs to Clearsight?',
    owner: 't_browser', approver: 'CPO', status: 'owed', opened: '2026-09-02',
    consequence: 'A browsing history — clinics, lawyers, job boards — tied to a named account and held by a third party that cannot delete it.',
    options: [
      { id: 'A', title: 'Strip query strings and drop the account ID before export', privacy: 'Removes identity and most sensitive detail', product: 'Per-user funnels lost', cost: 'about 1 engineer-week',
        pros: ['Matches the store listing'], cons: ['Historic data at the vendor remains'], tradeoff: 'Per-user analysis traded for keeping the promise.' },
      { id: 'B', title: 'Derive categories on the device; send daily counts', privacy: 'No URLs leave the device', product: 'Coarser analytics', cost: 'about 4 engineer-weeks',
        pros: ['Aggregation becomes true by design'], cons: ['Longer to build'], tradeoff: 'Analytic detail traded for a guarantee.' },
      { id: 'C', title: 'Stop the export until A ships', privacy: 'Removes the exposure now', product: 'No extension analytics for a sprint', cost: 'about 1 day',
        pros: ['Immediate'], cons: ['Blind for a sprint'], tradeoff: 'Short-term visibility traded for stopping the harm.' }
    ],
    recommend: 'C', recommendText: 'C until A ships; B next.',
    dissent: null, uncertainty: 'Clearsight has no deletion API, so historic URLs cannot be proven gone.',
    test: { text: 'Egress gate shows no field matching account_id or full URL on flow fl17 for 14 days; Clearsight confirms purge in writing.', control: 'c_gate_egress' },
    testResult: 'fail', final: null },
  { id: 'D-107', promise: 'PR-DELETE', risk: null, findings: ['PRV-0221', 'PRV-0176', 'PRV-0210'],
    question: 'Stop telling people “your data is deleted” until vector stores, search and vendors confirm?',
    owner: 't_privacy', approver: 'CPO', status: 'owed', opened: '2026-09-12',
    consequence: 'People are told they are deleted while embeddings, search entries and a vendor copy survive.',
    options: [
      { id: 'A', title: 'Say “in progress” until every system and vendor confirms', privacy: 'Makes the message true', product: 'Confirmation arrives days later', cost: 'about 3 engineer-days',
        pros: ['Honest immediately'], cons: ['More support contacts'], tradeoff: 'Speed of reassurance traded for truth.' },
      { id: 'B', title: 'Add vector store and search index to the orchestrator with canaries', privacy: 'Closes the two known internal gaps', product: 'None', cost: 'about 2 engineer-weeks',
        pros: ['Fixes the cause'], cons: ['Vendor gap remains'], tradeoff: 'Internal completeness first, vendors second.' },
      { id: 'C', title: 'Crypto-shred per person for new data', privacy: 'Future copies unreadable once the key is gone', product: 'None', cost: 'about one quarter',
        pros: ['Covers backups and unknown copies'], cons: ['Does nothing for existing plaintext copies'], tradeoff: 'Long-term guarantee, no help today.' }
    ],
    recommend: 'A', recommendText: 'A now; B this sprint; C for new data stores.',
    dissent: null, uncertainty: 'Backups older than the tombstone log cannot be checked without a restore test.',
    test: { text: 'Canary identities deleted at T are absent from every one of the deletion targets at T+72h, including vector store and search; vendor attestations stored.', control: 'c_delete_verify' },
    testResult: 'fail', final: null },
  { id: 'D-108', promise: 'PR-LOGS', risk: 'R-06', findings: ['PRV-0199', 'PRV-0218'],
    question: 'Redact personal data at the gateway and cut log access to on-call only?',
    owner: 't_sre', approver: 'CISO', status: 'verifying', opened: '2026-08-28',
    consequence: 'Email addresses sit in logs for 13 months, readable by 1,200 people.',
    options: [
      { id: 'A', title: 'Redact at the gateway, purge 395 days of logs', privacy: 'Removes the data at the source', product: 'None', cost: 'about 1 engineer-week',
        pros: ['Fixes cause and history'], cons: ['Purge needs a maintenance window'], tradeoff: 'A short window of log unavailability.' },
      { id: 'B', title: 'Keep logs, restrict access to on-call with just-in-time grants', privacy: 'Fewer readers, same data', product: 'Slower debugging for some teams', cost: 'about 2 engineer-weeks',
        pros: ['Addresses insider risk'], cons: ['Data still there'], tradeoff: 'Access friction without removing exposure.' }
    ],
    recommend: 'A', recommendText: 'A, then B for the logs that must stay.',
    dissent: null, uncertainty: 'Some services log through a sidecar that bypasses the gateway.',
    test: { text: 'Synthetic canary emails sent through every route never appear in logs for 7 days.', control: 'c_log_redact' },
    testResult: 'pending',
    final: { option: 'A', plus: 'B', by: 'CISO', on: '2026-09-15', rationale: 'Removing the data beats guarding it.' } },
  { id: 'D-109', promise: 'PR-SUPPORT', risk: 'R-07', findings: ['PRV-0237'],
    question: 'Stop sending support transcripts to an unreviewed LLM subprocessor in another region?',
    owner: 't_support', approver: 'Privacy Counsel', status: 'owed', opened: '2026-09-01',
    consequence: 'Support chats — often about money, health or disputes — are processed by a provider no one has reviewed, outside the customer’s region.',
    options: [
      { id: 'A', title: 'Route summaries to the in-region, reviewed provider', privacy: 'Keeps data in region with a reviewed vendor', product: 'Slightly slower summaries', cost: 'about 1 engineer-week',
        pros: ['Keeps the feature'], cons: ['Vendor migration'], tradeoff: 'Latency traded for keeping the promise.' },
      { id: 'B', title: 'Complete the review and add transfer safeguards', privacy: 'Legalises the current path', product: 'None', cost: 'about 3 weeks of legal time',
        pros: ['No engineering change'], cons: ['Still out of region, which the promise excludes'], tradeoff: 'Paperwork instead of design; the promise would need rewording.' }
    ],
    recommend: 'A', recommendText: 'A; B only if the Help Center text is changed first.',
    dissent: 'Support Tooling prefers B to avoid a vendor migration this quarter.', uncertainty: 'The subprocessor’s own retention is not documented.',
    test: { text: 'Egress gate shows no transcript flow leaving the customer’s region for 14 days; vendor attestation on file.', control: 'c_vendor_attest' },
    testResult: 'fail', final: null }
];

/* ── control tests ────────────────────────────────────────────────────────
 * [lastTest, result, method, evidence, nextTest, exceptions] */
var T = {
  c_policy_nolog:   [null, 'never', 'None — a document, not a test', 'Policy PP-12 (PDF, 2023)', null, []],
  c_log_redact:     ['2026-09-25', 'fail', 'Daily synthetic canary through every gateway route', 'Canary run 2026-09-25: 3 of 41 routes leaked', '2026-09-26', ['sidecar-logged services bypass the gateway']],
  c_lint_pii:       ['2026-09-26', 'pass', 'CI lint on every pull request', 'CI job pii-lint, last 200 PRs', '2026-09-27', []],
  c_tls:            ['2026-09-26', 'pass', 'Continuous TLS scan', 'Scanner run 2026-09-26', '2026-09-27', []],
  c_mtls:           ['2026-09-24', 'pass', 'Runtime policy + weekly probe', 'Mesh policy report', '2026-10-01', []],
  c_tokenise:       ['2026-09-20', 'pass', 'Quarterly PAN scan + runtime tokenisation', 'PAN scan 2026-09-20: 0 matches', '2026-12-20', []],
  c_schema:         ['2026-09-23', 'fail', 'Schema-registry gate on deploy', 'Gate bypassed for purchase_events v14', '2026-09-30', ['emergency deploys skip the gate']],
  c_ttl_wh:         [null, 'never', 'None — convention only', 'Warehouse TTL policy (wiki)', null, []],
  c_ttl_fs:         ['2026-09-25', 'pass', 'Runtime TTL + daily age scan', 'Age scan 2026-09-25', '2026-09-26', []],
  c_purpose_fs:     ['2026-09-10', 'fail', 'Manual approval of new consumers', 'Approval ticket FS-221 (“analytics”)', '2026-10-10', []],
  c_purpose_runtime:['2026-09-26', 'pass', 'Query engine denies reads without a matching purpose', 'Deny log: 0 bypasses in 30 days', '2026-09-27', ['applies to Pulse and Checkout only']],
  c_consent_read:   ['2026-09-26', 'pass', 'Consent SDK on read path + synthetic revocations', 'Probe run 2026-09-26', '2026-09-27', ['9 of 14 consumers not on the read path']],
  c_consent_batch:  ['2026-09-22', 'fail', 'Filter step in export DAG template', 'INC-2026-014: step missing after refactor', '2026-09-29', []],
  c_delete_orch:    ['2026-09-25', 'pass', 'Per-system receipts on every request', 'Receipts for last 1,000 requests', '2026-09-26', ['vector store and search not wired']],
  c_delete_verify:  ['2026-09-23', 'fail', 'Canary IDs re-queried at T+72h', 'Canary 2026-09-20: found in vector store', '2026-09-26', []],
  c_cryptoshred:    ['2026-09-18', 'pass', 'Key destruction receipts, quarterly restore test', 'Restore test 2026-09-18', '2026-12-18', []],
  c_backup_reapply: ['2026-08-30', 'pass', 'Tombstones replayed on restore; monthly drill', 'Drill 2026-08-30', '2026-09-30', ['backups older than the tombstone log']],
  c_gate_egress:    ['2026-09-21', 'fail', 'Egress gate on new destinations', 'fl17 and fl22 passed without review', '2026-09-28', []],
  c_sdk_inventory:  ['2026-06-02', 'fail', 'Quarterly spreadsheet review', 'Spreadsheet, last edited June', '2026-10-02', []],
  c_cmp:            ['2026-09-24', 'pass', 'Tag-manager consent gating + weekly crawl', 'Crawl 2026-09-24', '2026-10-01', ['authenticated checkout not crawled']],
  c_rbac:           ['2026-09-15', 'pass', 'Quarterly access recertification', 'Recert Q3', '2026-12-15', []],
  c_jit:            [null, 'never', 'Planned', 'Design doc', null, []],
  c_access_audit:   ['2026-09-26', 'pass', 'Continuous sensitive-query monitoring', 'Alert stream', '2026-09-27', []],
  c_dp_budget:      ['2026-09-25', 'pass', 'Ledger refuses over-budget queries', 'Ledger log', '2026-09-26', []],
  c_prompt_redact:  ['2026-09-19', 'pass', 'Eval set, weekly', 'NER eval: 97.1% recall', '2026-09-26', ['free-text addresses under-detected']],
  c_ai_review:      ['2026-07-14', 'fail', 'Manual review before model changes', 'Nova fine-tune shipped without review', '2026-10-14', []],
  c_vendor_attest:  ['2025-11-03', 'fail', 'Annual attestation questionnaire', 'Attestations 2025', '2026-11-03', ['3 vendors never returned it']],
  c_id_scope:       [null, 'never', 'Standard exists; nothing enforces it', 'ID scoping standard v1', null, []],
  c_retention_scan: ['2026-09-26', 'pass', 'Daily: declared vs observed oldest row', 'Scan 2026-09-26: 6 violations found', '2026-09-27', []],
  c_launch_gate:    ['2026-09-26', 'pass', 'Machine-checked launch gate', 'Gate log', '2026-09-27', ['post-launch drift not gated']],
  c_children:       ['2026-09-12', 'pass', 'Separate store + ad-ID absence check', 'Check 2026-09-12', '2026-10-12', ['cookie ns_uid seen on /family']],
  c_break_glass:    ['2026-09-20', 'pass', 'Ticket required; monthly review', 'Review 2026-09', '2026-10-20', ['1 unapproved use this week']]
};
NS.controlTests = {};
Object.keys(T).forEach(function (k) { var t = T[k]; NS.controlTests[k] = { last: t[0], result: t[1], method: t[2], evidence: t[3], next: t[4], exceptions: t[5] }; });

/* ── indicators ───────────────────────────────────────────────────────────
 * history: the seven previous weekly readings (oldest first); the current
 * reading is always computed live and appended. coverage: what share of the
 * estate the detector behind the number can actually see. */
NS.indicators = {
  highfind:    { target: 0, dir: 'down', owner: 't_privacy', history: [9, 10, 10, 11, 12, 13, 12], coverage: { v: 0.84, of: 'systems scanned by lineage and log detectors' } },
  noowner:     { target: 0, dir: 'down', owner: 't_privacy', history: [7, 7, 6, 6, 5, 5, 5], coverage: { v: 0.91, of: 'datasets in the catalog' } },
  unmapped:    { target: 0, dir: 'down', owner: 't_data', history: [3, 4, 4, 5, 5, 6, 6], coverage: { v: 0.72, of: 'traffic observed by the flow sensor' } },
  undeclared:  { target: 0, dir: 'down', owner: 't_privacy', history: [1, 1, 1, 2, 2, 2, 2], coverage: { v: 0.8, of: 'egress points behind the gateway' } },
  nottl:       { target: 0, dir: 'down', owner: 't_data', history: [13, 13, 12, 12, 12, 11, 10], coverage: { v: 1, of: 'datasets in the catalog' } },
  retviol:     { target: 0, dir: 'down', owner: 't_data', history: [5, 5, 6, 6, 6, 6, 6], coverage: { v: 0.88, of: 'stores the retention scanner reaches' } },
  consentfail: { target: 0, dir: 'down', owner: 't_audience', history: [2, 2, 3, 3, 3, 4, 4], coverage: { v: 0.64, of: 'consent consumers instrumented with probes' } },
  delfail:     { target: 0, dir: 'down', owner: 't_privacy', history: [4, 4, 4, 5, 5, 5, 5], coverage: { v: 0.73, of: 'deletion targets with canaries' } },
  sdks:        { target: 0, dir: 'down', owner: 't_privacy', history: [3, 3, 4, 4, 4, 5, 5], coverage: { v: 0.6, of: 'pages crawled (authenticated pages excluded)' } },
  incidents:   { target: 0, dir: 'down', owner: 't_privacy', history: [1, 1, 2, 2, 2, 3, 3], coverage: { v: 1, of: 'reported incidents' } },
  paper:       { target: 0, dir: 'down', owner: 't_privacy', history: [6, 6, 5, 5, 5, 4, 4], coverage: { v: 1, of: 'registered controls' } },
  runtime:     { target: 24, dir: 'up', owner: 't_privacy', history: [13, 13, 14, 14, 15, 16, 16], coverage: { v: 1, of: 'registered controls' } },
  aiprov:      { target: 0, dir: 'down', owner: 't_nova', history: [3, 3, 3, 3, 3, 3, 3], coverage: { v: 1, of: 'models in the AI inventory' } },
  drift:       { target: null, dir: 'down', owner: 't_privacy', history: [4, 7, 5, 6, 3, 8, 6], coverage: { v: 0.84, of: 'systems scanned by the drift detector' } },
  promises:    { target: 0, dir: 'down', owner: 't_privacy', history: [5, 5, 6, 6, 7, 7, 7], coverage: { v: 1, of: 'published promises' } },
  owed:        { target: 0, dir: 'down', owner: 't_privacy', history: [4, 5, 5, 6, 7, 7, 7], coverage: { v: 1, of: 'decisions opened' } }
};

/* ── operating perspectives ───────────────────────────────────────────────
 * Every role sees the same records. The perspective decides which decisions
 * the role can make, the words used, and the evidence shown first. */
NS.perspectives = [
  { id: 'lead', name: 'Leadership', verb: 'Decide', roles: ['cpo', 'ciso', 'cto', 'exec'],
    can: 'approve trade-offs, fund fixes, accept or refuse residual risk',
    evidence: 'people affected, consequence, options and cost', words: { finding: 'exposure', control: 'safeguard', decision: 'decision' } },
  { id: 'own', name: 'Managers & owners', verb: 'Assign', roles: ['em', 'pm', 'gov'],
    can: 'assign owners, schedule fixes, hold or ship launches',
    evidence: 'due dates, blockers and the systems their teams own', words: { finding: 'issue', control: 'control', decision: 'decision' } },
  { id: 'over', name: 'Oversight', verb: 'Challenge', roles: ['counsel', 'compliance', 'auditor'],
    can: 'attest, challenge evidence, require re-review',
    evidence: 'legal basis, control tests, evidence freshness', words: { finding: 'gap', control: 'control', decision: 'determination' } },
  { id: 'build', name: 'Builders', verb: 'Fix', roles: ['priveng', 'dataeng', 'swe', 'seceng', 'mleng'],
    can: 'ship fixes, raise enforcement levels, write the test that proves it',
    evidence: 'systems, flows, code paths and the failing test', words: { finding: 'finding', control: 'control', decision: 'decision' } }
];
})();
