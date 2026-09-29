/* Every Arrow Is a Decision — figure data.
 *
 * ONE source for each figure: figures.js renders the interactive version from
 * it in the browser, and scripts/every_arrow/build.mjs renders the static
 * fallback (no-JS, print, PDF) from the same objects into the HTML. Change a
 * figure here, run the build, and both agree.
 *
 * Northstar numbers are NOT typed here: they come from the Command Center's
 * synthetic dataset (privacy-command-center/data.js) via northstar.js, which
 * the build generates. People, systems and figures are fictional unless a
 * source is cited next to them in the essay.
 */
(function (root) {
  'use strict';
  var D = {};

  /* ── 01 · One person, no name ─────────────────────────────────── */
  D.person = {
    ids: [
      { id: 'email', k: 'Email', v: 'dana.k@example.com', scope: 'account' },
      { id: 'device', k: 'Device ID', v: 'a7f3…91c2', scope: 'app' },
      { id: 'ad', k: 'Advertising ID', v: 'maid 5e1b0c…', scope: 'ads' },
      { id: 'pay', k: 'Payment token', v: 'tok_••••4417', scope: 'pay' },
      { id: 'loc', k: 'Location ping', v: '37.78, −122.41 · 07:40', scope: 'location' }
    ],
    /* needs: identifiers that must be joinable for the inference to exist.
       sensitive: removed by the "no sensitive inference" guard. */
    inf: [
      { v: 'Leaves home at 7:40 on weekdays', src: 'location × time', needs: ['loc'], sensitive: false },
      { v: 'Visits a pharmacy after 11 p.m.', src: 'payment × location', needs: ['pay', 'loc'], sensitive: true },
      { v: 'Likely pregnant', src: 'basket × timing × account', needs: ['email', 'pay'], sensitive: true },
      { v: 'Household of three', src: 'devices × one account × home IP', needs: ['email', 'device', 'ad'], sensitive: false }
    ],
    modes: [
      { id: 'join', t: 'Everything joins', d: 'One global customer ID travels with every event. Any team can join any table.' },
      { id: 'scoped', t: 'Purpose-scoped IDs', d: 'Each product mints its own identifier. Joins across purposes need a reviewed, logged path.' },
      { id: 'guarded', t: 'Scoped + no sensitive inference', d: 'Scoped IDs, and health or pregnancy categories may not be inferred for marketing at all.' }
    ]
  };

  /* ── 02 · Identifier spectrum ─────────────────────────────────── */
  D.spectrum = [
    ['Global durable', 'Email, phone number, government ID — or a hash of any of them', 'Every system that sees it, for years', 'Only when the feature is identity itself: login, billing, legal.'],
    ['Cross-app', 'A device-level advertising ID', 'Every app on the device that can read it', 'Rarely justified outside advertising, and often requires opt-in.'],
    ['Per-vendor', 'An ID scoped to one company’s apps', 'Everything that one company does', 'Internal analytics across a product family.'],
    ['Purpose-scoped', 'reminders_id — minted for one purpose', 'One purpose; useless to every other', 'Most features. Mint one per purpose and refuse joins.'],
    ['Rotating', 'A token that changes daily', 'One person within one window', 'Measurement that needs repeat visits, but not forever.'],
    ['Ephemeral', 'A per-session or per-request nonce', 'One session, then nothing', 'Rate limiting, abuse checks, a single transaction.'],
    ['None', 'Aggregates with small groups suppressed', 'Nothing — no person to link', 'Dashboards, reporting, most analytics questions.']
  ];

  /* ── 04 · When the data is wrong ──────────────────────────────── */
  D.wrong = {
    uses: [
      { id: 'ads', t: 'Ad segment', sev: 1, what: 'Dana sees irrelevant ads for her partner’s hobbies.', need: [] },
      { id: 'recs', t: 'Recommendations', sev: 1, what: 'Her home page fills with someone else’s taste. Annoying, visible, easy to shrug off.', need: ['correct'] },
      { id: 'fraud', t: 'Fraud decline', sev: 3, what: 'Her card is declined at checkout and her account is restricted. Nobody tells her why.', need: ['threshold', 'human', 'explain', 'correct', 'appeal'] },
      { id: 'credit', t: 'Pay-later eligibility', sev: 3, what: 'Northstar Pay refuses her instalment plan. The reason is her partner’s missed payment.', need: ['threshold', 'human', 'explain', 'correct', 'appeal'] },
      { id: 'job', t: 'Hiring screen (a partner’s use)', sev: 4, what: 'A “risk” flag sold on to a screening vendor follows her into a job application she never connects to a shop.', need: ['threshold', 'human', 'explain', 'correct', 'appeal', 'noshare'] }
    ],
    guards: [
      { id: 'threshold', t: 'Merge only above 0.9 confidence', d: 'The identity graph links two people only on strong evidence; weaker matches stay separate.' },
      { id: 'human', t: 'A person reviews adverse actions', d: 'No decline, refusal or restriction takes effect on the model’s word alone.' },
      { id: 'explain', t: 'Say which data drove it', d: 'The notice names the signals used, in words Dana can check.' },
      { id: 'correct', t: 'Corrections propagate', d: 'When Dana fixes a record, the graph, the features and the vendor copy are corrected too.' },
      { id: 'appeal', t: 'An appeal a human decides', d: 'A route to contest the outcome, with a deadline and a logged result.' },
      { id: 'noshare', t: 'Risk scores never leave for another purpose', d: 'A fraud band stays in fraud; it is not sold, shared or reused for eligibility elsewhere.' }
    ],
    sevWords: ['', 'Low', 'Moderate', 'High', 'Severe']
  };

  /* ── 05 · Eight questions ─────────────────────────────────────── */
  D.eight = [
    ['VALUE', 'What customer outcome needs data?', 'Saves a trip when Dana is running low on something she buys regularly. Expected for items she bought. Not expected: anything the reminder implies about why she bought them.', '“We might need it later.”'],
    ['DATA', 'Exactly what enters the system?', 'Order lines are T2. But the catalogue includes prenatal vitamins and pregnancy tests, so a purchase cadence can reveal health: those categories are T4. Tier by what data reveals, not by column type.', 'Free text, full URLs, raw payloads.'],
    ['IDENTITY', 'Can it be linked to a person?', 'It needs an account-scoped ID to send the reminder. It does not need the device ID or any advertising ID — and must never be joined to them.', 'A durable ID shared across features.'],
    ['FLOW', 'Where does it travel?', 'Orders → cadence job → notification service → MailPost. The vendor needs a token and a template — not the purchase history.', 'Unlisted SDKs, logs, exports.'],
    ['ACCESS', 'Who can see or join it?', 'The model team reads cadences, not baskets. Support sees “reminder sent”, not why. Ad systems have no read path at all.', 'Warehouse-wide read by default.'],
    ['TIME', 'How long does raw data remain?', 'Keep the cadence (“every 28 days”) for 180 days. Raw baskets for the model: 90 days rolling. Vendor message logs: per contract.', 'No TTL, or “until deleted.”'],
    ['MISUSE', 'What secondary use is possible?', 'A future team asks for a “likely expecting” ad audience built from the same cadences. Nothing technical stops it today.', 'Security data readable by ads.'],
    ['REDUCE', 'What can we remove or enforce?', 'Exclude sensitive categories by default. Compute cadence inside the account service. Send the vendor a template ID, never a product name. Put the purpose check in the query layer.', 'Controls that live only in a doc.']
  ];
  D.verdict = [
    'Sensitive product categories are excluded from reminders by default.',
    'The cadence (“every 28 days”) is stored; raw baskets expire after 90 days.',
    'MailPost receives a template ID and a token — never the product name.',
    'Cadence data is purpose-bound to reminders; ad systems cannot read it.'
  ];

  /* ── 06 · Lifecycle + flow map ────────────────────────────────── */
  D.lifecycle = [
    ['Collect', 'What?', 'Collect the minimum; derive on device where you can.'],
    ['Process', 'Where?', 'Process locally or inside isolated services.'],
    ['Use', 'Why?', 'Purpose tags checked at read time, not just intake.'],
    ['Share', 'With whom?', 'Contracts, scoped tokens, aggregation before export.'],
    ['Store', 'How long?', 'TTL per field: raw → derived → aggregate.'],
    ['Delete', 'Prove it.', 'Propagated deletes, audit trail, verification scans. The deletion path is part of the architecture — not a ticket you file after launch.']
  ];
  /* Node names use the Command Center's vocabulary for Northstar's systems. */
  D.flowNodes = {
    device: ['Storefront app', 'DANA’S PHONE', 'user'], sdk: ['GeoGrid SDK', 'THIRD PARTY', 'out'], vendor: ['MailPost', 'THIRD PARTY', 'out'],
    gw: ['API gateway', '', 'in'], svc: ['Checkout service', '', 'in'], bus: ['Event bus', '', 'in'], wh: ['Core warehouse', '', 'in'],
    log: ['Application logs', '', 'in'], mkt: ['Audience Builder', '', 'in'], bak: ['Snapshot backups', '', 'in'],
    dash: ['Exec dashboard', '', 'in'], model: ['Reorder model', '', 'in'], fs: ['Feature store', '', 'in']
  };
  D.flows = [
    { id: 'e1', a: 'device', b: 'gw', t: 'Storefront app → API gateway', tags: ['Crosses boundary → in'],
      d: { Fields: 'customer_id, cart, delivery address, device_id, IP', Identifier: 'Customer ID + device ID (global, durable)', Purpose: 'Place and deliver the order', Consent: 'Core service — no optional use should ride on this arrow', Retention: 'In transit only', Owner: 'Observability & SRE', Control: 'TLS; gateway allow-list drops unknown fields' },
      dec: 'Does the device ID need to travel with every order?' },
    { id: 'e2', a: 'device', b: 'sdk', t: 'Storefront app → GeoGrid SDK', hot: 1, badge: 'EGRESS', tags: ['Third-party egress', 'Invisible to your servers'],
      d: { Fields: 'lat, lon, advertising ID — every 15 minutes, in the background', Identifier: 'Advertising ID (cross-app)', Purpose: 'Unknown — arrived inside another SDK', Consent: 'OS location permission only', Retention: 'Unknown — vendor default', Owner: 'None', Control: 'None on your servers: this arrow never touches them' },
      dec: 'The most dangerous arrow is the one your own logs cannot see.' },
    { id: 'e3', a: 'gw', b: 'svc', t: 'API gateway → Checkout service',
      d: { Fields: 'Order, customer_id, delivery address', Identifier: 'Customer ID', Purpose: 'Fulfilment', Consent: 'Core service', Retention: 'Orders ledger: 7 years for accounting', Owner: 'Checkout Platform', Control: 'Service mTLS; field-level encryption for address' },
      dec: 'The ledger may need seven years. Does the street address?' },
    { id: 'e4', a: 'gw', b: 'log', t: 'API gateway → Application logs', hot: 1, badge: 'UNFILTERED', tags: ['Emails in query strings'],
      d: { Fields: 'request_url (with email in the query string), IP address', Identifier: 'Email + IP', Purpose: 'Debugging', Consent: 'n/a', Retention: '395 days kept; 30 declared', Owner: 'Observability & SRE', Control: 'A redactor that reads bodies, not URLs' },
      dec: 'Debugging is a real purpose. It does not need the customer’s email.' },
    { id: 'e5', a: 'svc', b: 'vendor', t: 'Checkout service → MailPost', hot: 1, badge: 'EGRESS', tags: ['Third-party egress', 'Crosses boundary → out'],
      d: { Fields: 'Email, first name, order summary with item names', Identifier: 'Email (global, durable)', Purpose: 'Order confirmation', Consent: 'Transactional', Retention: 'MailPost keeps message content for its own period', Owner: 'Checkout Platform', Control: 'Contract — but item names can reveal health' },
      dec: 'Send a template ID and an order link, not “prenatal vitamins × 2”.' },
    { id: 'e6', a: 'svc', b: 'bus', t: 'Checkout service → Event bus',
      d: { Fields: 'order_placed {customer_id, device_id, SKUs, total, geo_city, precise_lat, precise_lon}', Identifier: 'Device ID', Purpose: 'Fan-out — no single purpose', Consent: 'Analytics consent read once, at collection', Retention: 'Topic: 7 days', Owner: 'Data Platform', Control: 'Schema registry; tier tags — but a “compatible” change added precise location' },
      dec: 'A bus without purpose tags turns every new subscriber into a new purpose.' },
    { id: 'e7', a: 'bus', b: 'wh', t: 'Event bus → Core warehouse',
      d: { Fields: 'Every event field, joined to profile', Identifier: 'Device ID → customer ID', Purpose: 'Analytics', Consent: 'Not re-checked at read', Retention: '4 years; the TTL policy is a wiki page', Owner: 'Data Platform', Control: 'Role-based access; column controls for T3 and above' },
      dec: 'A retention rule nobody enforces is the absence of one.' },
    { id: 'e8', a: 'bus', b: 'mkt', t: 'Event bus → Audience Builder', hot: 1, badge: 'PURPOSE CHANGE', tags: ['Purpose change', 'Fulfilment → targeting'],
      d: { Fields: 'SKU list, customer_id → joined to email', Identifier: 'Customer ID → email', Purpose: 'Collected to fulfil orders; now used for targeted campaigns', Consent: 'Advertising consent needed — read nightly, so up to a day stale', Retention: '390 days', Owner: 'Audience Engineering', Control: 'None at read time — the purpose check happens at use, or not at all' },
      dec: 'The data didn’t move far. The reason moved a long way.' },
    { id: 'e9', a: 'wh', b: 'bak', t: 'Core warehouse → Snapshot backups',
      d: { Fields: 'Everything', Identifier: 'All of them', Purpose: 'Disaster recovery', Consent: 'n/a', Retention: '35-day snapshots', Owner: 'Observability & SRE', Control: 'Separate backup keys; deletions re-applied on restore' },
      dec: 'Deletion must reach backups, or expire out of them on a stated clock.' },
    { id: 'e10', a: 'wh', b: 'fs', t: 'Core warehouse → Feature store', curve: 1,
      d: { Fields: 'Days since last order, cadence per category', Identifier: 'Customer ID', Purpose: 'Reorder reminders', Consent: 'Honours notification opt-out', Retention: '180 days rolling', Owner: 'Storefront Growth', Control: 'Sensitive categories excluded by rule' },
      dec: 'Derived, narrower, shorter-lived: what the raw event should become.' },
    { id: 'e11', a: 'fs', b: 'model', t: 'Feature store → Reorder model',
      d: { Fields: 'Cadence vectors — no names, no address', Identifier: 'Pseudonymous feature key', Purpose: 'Predict the next reorder date', Consent: 'Inherits from feature store', Retention: 'Training snapshots: 180 days', Owner: 'Storefront Growth', Control: 'Training lineage recorded per snapshot; retrained weekly' },
      dec: 'Can you retrain without a person who asked to be deleted?' },
    { id: 'e12', a: 'model', b: 'dash', t: 'Reorder model → Exec dashboard',
      d: { Fields: 'Reminders sent, reorder rate by region', Identifier: 'None — aggregates only', Purpose: 'Measure the feature', Consent: 'n/a', Retention: '2 years', Owner: 'Data Platform', Control: 'Small groups suppressed (fewer than 50)' },
      dec: 'The safest arrow on the map: no identifier crosses it.' }
  ];

  /* ── 07 · Purpose at the moment of use ────────────────────────── */
  D.purpose = [
    ['Login service', 'send 2FA code', 1, 'Account security — the original purpose'],
    ['Support desk', 'verify caller during recovery', 1, 'Account security — compatible'],
    ['Risk engine', 'flag a takeover attempt', 1, 'Fraud prevention — declared at collection'],
    ['Audience Builder', 'match to custom audience', 0, 'Ad targeting — never declared'],
    ['Growth team', '“people you may know”', 0, 'Contact discovery — new purpose'],
    ['ML platform', 'train a model', 0, 'Model training — a new purpose: needs a compatibility test or a new basis']
  ];

  /* ── 08 · Harm chain ──────────────────────────────────────────── */
  D.harms = ['Surveillance', 'Exposure', 'Linkability', 'Manipulation', 'Loss of control', 'Secondary use', 'Re-identification', 'Context collapse', 'Household leakage', 'Sensitive inference', 'Discrimination', 'Inaccuracy'];
  D.issues = [
    ['Precise location kept for 18 months', 'Surveillance and sensitive inference', 'A visit pattern reveals a clinic, a place of worship, a shelter.', ['Surveillance', 'Sensitive inference'], 'Keep city, not coordinates; 30-day TTL on raw pings.'],
    ['Lock-screen notification previews on', 'Exposure and household leakage', 'A preview reveals a diagnosis on a shared phone.', ['Exposure', 'Household leakage'], 'Generic notification text for T3+ items.'],
    ['Hashed email uploaded to an ad partner', 'Linkability and secondary use', 'Activity here follows a person across other sites and apps.', ['Linkability', 'Secondary use'], 'No hashed identifiers leave without consent checked at export.'],
    ['Purchase history feeds a pricing model', 'Discrimination and manipulation', 'Two people see different prices for reasons neither can see.', ['Discrimination', 'Manipulation'], 'Pricing may not read purchase history; audit prices by segment.'],
    ['Opt-out checked in the app, not the warehouse', 'Loss of control and secondary use', 'The person said no. The warehouse, and every model trained from it, never heard.', ['Loss of control', 'Secondary use'], 'Consent evaluated at read in the query layer.'],
    ['“Anonymized” export with ZIP and birth date', 'Re-identification', 'A journalist, or a stalker, puts a name back on a record.', ['Re-identification'], 'Generalise quasi-identifiers or release with differential privacy.'],
    ['Identity graph merges two people at 0.71 confidence', 'Inaccuracy and discrimination', 'One person inherits another’s fraud history and is refused service.', ['Inaccuracy', 'Discrimination'], 'Merge threshold, human review of adverse actions, a correction path.']
  ];

  /* ── 09 · Make the trade-off consciously ──────────────────────── */
  /* Each alternative: pros, cons, utility cost, privacy benefit, trust assumption, residual risk.
     rec: the recommended alternative. record: the decision record the choice produces. */
  D.tradeoffs = [
    { id: 'reorder', t: 'Reorder reminders', q: 'Where is Dana’s purchase cadence computed?', owner: 'Storefront Growth', reviewer: 'Privacy Engineering', approver: 'VP Commerce', rec: 1,
      alts: [
        { t: 'Server-side, from the warehouse', pros: 'Simple; one pipeline for every platform.', cons: 'Raw baskets centralised; any team with warehouse access can read cadences.', utility: 'None — best accuracy.', benefit: 'None beyond access control.', trust: 'Every warehouse reader and every future consumer.', residual: 'A “likely expecting” audience is one query away.' },
        { t: 'Server-side, purpose-bound feature', pros: 'Cadence only (no baskets) in a store only the reminder service can read.', cons: 'One more store to run and to include in deletion.', utility: 'Small: a 90-day basket window.', benefit: 'Sensitive categories excluded; ads have no read path.', trust: 'The query-layer purpose check.', residual: 'Cadences are still personal; a breach of that store reveals habits.' },
        { t: 'On the device', pros: 'The server never learns the cadence.', cons: 'Reminders only on devices with the app; harder to measure.', utility: 'Moderate: no email reminders; per-device history only.', benefit: 'Nothing on the server to breach or repurpose.', trust: 'The app and the device.', residual: 'Aggregate measurement still needs a privacy-preserving path.' }
      ],
      evidence: ['Purpose policy on the cadence store, with its deny log', 'TTL job report: no basket older than 90 days', 'Category exclusion list under version control'], expiry: 'Review again in 12 months, or at any new consumer of the cadence store' },
    { id: 'location', t: 'Store finder', q: 'How precisely do we need to know where Dana is?', owner: 'Local & Pickup', reviewer: 'Privacy Engineering', approver: 'Director, Commerce', rec: 2,
      alts: [
        { t: 'Background precise location', pros: 'Can nudge Dana when she walks past a store.', cons: 'Home, work, clinic and routine become inferable; T3 data at scale.', utility: 'None.', benefit: 'None.', trust: 'Every holder of the location history, for as long as it is kept.', residual: 'An 18-month movement history of millions of people.' },
        { t: 'Precise, only while the finder is open', pros: 'Accurate nearest store.', cons: 'Still precise coordinates on the server.', utility: 'Loses walk-past nudges.', benefit: 'No background trail.', trust: 'That coordinates are dropped after the request.', residual: 'Request logs can keep coordinates unless redacted.' },
        { t: 'Nearest stores computed on the device', pros: 'Accurate, and coordinates never leave the phone.', cons: 'The app ships a store list.', utility: 'None for the finder itself.', benefit: 'Northstar never learns where Dana is.', trust: 'The app.', residual: 'Pickup still needs a chosen store — which is what Dana chose to share.' }
      ],
      evidence: ['Network test: no coordinates in any request from the finder', 'SDK allow-list check on each release'], expiry: 'Review on any new location consumer or SDK' },
    { id: 'analytics', t: 'Product analytics', q: 'How does Northstar learn whether the reminder feature works?', owner: 'Data Platform', reviewer: 'Privacy Engineering', approver: 'Chief Data Officer', rec: 2,
      alts: [
        { t: 'Raw event stream, forever', pros: 'Any question, any time, down to one person.', cons: 'Every event is a record about someone; retention and access sprawl.', utility: 'None.', benefit: 'None.', trust: 'Every analyst and every future use.', residual: 'Re-identification and scope creep.' },
        { t: 'Pseudonymous events, 30 days', pros: 'Funnel and cohort questions still work.', cons: 'Long-range trends need aggregates.', utility: 'Small.', benefit: 'Joins to identity need a governed path; raw ages out.', trust: 'The key holder for the pseudonym mapping.', residual: 'Still personal data; rare paths can single someone out.' },
        { t: 'Differentially private aggregates', pros: 'A provable bound on what any output reveals about one person.', cons: 'Noise; small groups become unreliable; the budget runs out.', utility: 'Moderate for small segments.', benefit: 'Published answers cannot single out Dana (within the budget).', trust: 'A correct implementation and honest accounting.', residual: 'Privacy loss accumulates across releases; population-level facts still show.' }
      ],
      evidence: ['DP ledger with per-release ε', 'Raw-event TTL job report', 'Query audit of pseudonym re-identification requests'], expiry: 'Review each budget year' },
    { id: 'support', t: 'Support transcripts', q: 'What does Northstar keep after Dana’s support chat?', owner: 'Support Tooling', reviewer: 'Privacy Engineering', approver: 'VP Customer Support', rec: 1,
      alts: [
        { t: 'Verbatim, 365 days, summarised by a third party', pros: 'Every word available for quality review and training.', cons: 'Health, money and family details sit at HelpHub and its subprocessor LLMCo.', utility: 'None.', benefit: 'None.', trust: 'HelpHub, LLMCo and their retention.', residual: 'A year of people’s worst days, in two companies.' },
        { t: 'Summary kept, transcript 30 days', pros: 'Agents keep the context they need.', cons: 'Loses verbatim quotes for audits after 30 days.', utility: 'Small.', benefit: 'Exposure window drops from a year to a month.', trust: 'That the vendor deletes on the day it says.', residual: 'The summary can still carry sensitive facts; redact before summarising.' },
        { t: 'No transcript kept', pros: 'Nothing to leak.', cons: 'Disputes and quality reviews become guesswork.', utility: 'High.', benefit: 'Maximum.', trust: 'None.', residual: 'Agents keep private notes instead — the copy you didn’t design.' }
      ],
      evidence: ['Vendor deletion attestation each quarter', 'Redaction recall measured on a labelled sample', 'Subprocessor list checked against the contract'], expiry: 'Review at contract renewal or any new subprocessor' }
  ];

  /* ── 11 · Enforcement ladder ─────────────────────────────────── */
  D.ladder = [
    { t: 'Policy', who: 'Reviewer', k: 'A document',
      art: '<span class="c">ENGINEERING STANDARDS § 4.2 — Logging</span>\n\n<span class="w">Engineers must not write personal data to\napplication logs.</span>\n\n<span class="c">Last reviewed: 14 months ago\nAcknowledged by: 61% of engineering</span>',
      by: 'Memory and good intentions — easy to write, easy to ignore', fails: 'Whenever someone hasn’t read it, forgot, or is in a hurry.', evidence: 'An acknowledgement count. Says nothing about the code.' },
    { t: 'Review', who: 'Reviewer', k: 'A human reads the design',
      art: '<span class="c">PULL REQUEST TEMPLATE — privacy</span>\n\n[ ] Does this change log request or response bodies?\n[ ] Does it add a field that identifies a person?\n[ ] Is any new field sent to a third party?\n\n<span class="c">Reviewer: @sam — approved in 4 minutes</span>',
      by: 'A reviewer, on a good day', fails: 'When the diff is 900 lines and the reviewer is on call.', evidence: 'A ticked template. Evidence of attention, not of behaviour.' },
    { t: 'Static check', who: 'Builder', k: 'A linter rule',
      art: '<span class="c"># rule: no-pii-in-logs</span>\n<span class="w">match</span>:   logger.$LEVEL(..., $X, ...)\n<span class="w">where</span>:   $X.type in [Email, Phone, DeviceId]\n<span class="w">message</span>: Personal field passed to logger. Use redact($X).\n\n<span class="h">src/checkout/api.ts:88  no-pii-in-logs</span>\n<span class="h">  user.email passed to logger.info</span>',
      by: 'The editor and CI, on every commit', fails: 'On dynamic code paths and untyped data the rule can’t see.', evidence: 'Blocks per week, coverage by repository.' },
    { t: 'Deployment gate', who: 'Builder', k: 'A CI gate',
      art: '<span class="w">privacy-gate</span>  <span class="h">✗ FAILED</span>\n\n  diff: column <span class="w">users.phone</span> (T2) loses its policy\n  <span class="h">✗</span> purpose tag removed: account_security\n  <span class="h">✗</span> retention removed: account_lifetime\n  <span class="g">✓</span> owner: team-identity\n\n  <span class="h">deploy blocked</span> — restore the policy or request\n  a time-boxed, logged exception',
      by: 'The pipeline — nothing ships without it', fails: 'Only when an exception is granted. Exceptions are logged and expire.', evidence: 'Gate decisions and every exception, with owner and expiry.' },
    { t: 'Runtime enforcement', who: 'Builder', k: 'A redactor in the path',
      art: '<span class="c"># query engine — purpose check at read time</span>\n<span class="w">SELECT</span> phone <span class="w">FROM</span> users  <span class="c">-- purpose: ad_targeting</span>\n<span class="h">✗ REFUSED</span>  purpose not in {account_security}\n\n<span class="c"># log pipeline — redactor</span>\n<span class="w">in </span>: {"user":"dana.k@example.com","cart":3}\n<span class="g">out</span>: {"user":"&lt;redacted:email&gt;","cart":3}',
      by: 'The platform, at runtime, for every line', fails: 'On formats the redactor doesn’t recognise — which is why rung 5 exists.', evidence: 'Deny and redaction counts, per service, per day.' },
    { t: 'Continuous audit', who: 'Auditor', k: 'A query that runs daily',
      art: '<span class="c">-- daily scan, every day, whether anyone looks or not</span>\n<span class="w">new joins</span>      users ⋈ ad_events      <span class="h">NEW · no review</span>\n<span class="w">access spikes</span>  analyst_417 · 38× baseline <span class="h">flag</span>\n<span class="w">TTL drift</span>      raw_events oldest row 412 d <span class="h">&gt; 90 d</span>\n<span class="w">PII in logs</span>    payments-worker · 37 hits\n\n<span class="h">→ 4 findings routed to owners (PRV-218…221)</span>',
      by: 'Evidence, every day, whether anyone looks or not', fails: 'Only if nobody reads the ticket. Route it to an owner.', evidence: 'The scan itself: dated results, routed findings, time to close.' }
  ];

  /* ── 12 · Consent consumers come from Northstar (northstar.js) ── */

  /* ── 13 · Rights beyond deletion ──────────────────────────────── */
  /* systems: [system, what it must do, how it can fail]. The deadline rows come
     from the Command Center's rightsDeadlines (simplified; not legal advice). */
  D.rights = [
    { id: 'access', t: 'Access', law: 'GDPR Art. 15 · CCPA right to know', when: 'Oct 25', ask: 'Dana asks: what do you hold about me, where did it come from, and who has it?',
      systems: [['Profile & orders', 'Export records in readable form', 'Exports the profile and forgets the warehouse'], ['Core warehouse', 'Include derived features and inferences', 'Inferences are “not data she gave us”, so they are left out'], ['Assistant logs & memory', 'Include prompts, outputs and memory rows', 'Nobody owns the export for the new AI stores'], ['Vendors (HelpHub, AdReach)', 'List recipients; fetch vendor copies where the contract allows', 'Recipients listed by category, never by name'], ['Identity graph', 'Show which devices and IDs are linked to her', 'The graph has no owner, so it is skipped']],
      proof: 'An export manifest listing every system queried, with the row counts returned, signed and kept with the request.' },
    { id: 'correct', t: 'Correction', law: 'GDPR Art. 16 · CCPA right to correct', when: 'Oct 27', ask: 'Dana tells Northstar her partner’s device was merged into her profile.',
      systems: [['Identity graph', 'Split the wrong merge; block re-merging', 'The nightly job merges them again'], ['Fraud features', 'Recompute her risk band without his history', 'The feature store keeps the old band until its TTL'], ['SignalRisk (vendor)', 'Send the correction to the fraud vendor', 'Corrections have no vendor API; only deletions do'], ['Downstream decisions', 'Re-evaluate decisions made on the wrong data', 'Past declines are never revisited']],
      proof: 'A correction receipt from each system, and a re-run of any decision that used the old value.' },
    { id: 'restrict', t: 'Restriction', law: 'GDPR Art. 18', when: 'Oct 27', ask: 'While the correction is checked, Dana asks Northstar to stop using the disputed record.',
      systems: [['Every reader of the record', 'Hold, don’t delete: store but do not use', 'Restriction is implemented as deletion — then the dispute can’t be resolved'], ['Batch jobs', 'Skip restricted records at read', 'Jobs read yesterday’s snapshot without the flag'], ['Models', 'Exclude from scoring while restricted', 'The flag isn’t a feature the scorer reads']],
      proof: 'A restriction flag checked in the query layer, with deny counts for her ID while the flag is set.' },
    { id: 'object', t: 'Objection & opt-out', law: 'GDPR Art. 21 · CCPA opt-out of sale/sharing', when: 'Sep 18', ask: 'Dana says no to personalised ads — the opt-out in Scene 12.',
      systems: [['Consent service', 'Record REVOKED with a timestamp', 'Records it — the easy part'], ['Nightly audience job', 'Honour it mid-run', 'Read consent once, at midnight'], ['Derived segments', 'Purge or detach her from built segments', 'Last week’s segment keeps the old answer'], ['AdReach (vendor)', 'Suppress her within the legal window', 'Opt-outs are not sent at all']],
      proof: 'Propagation latency per consumer, and a canary identity that must disappear from every export.' },
    { id: 'port', t: 'Portability', law: 'GDPR Art. 20', when: 'Oct 25', ask: 'Dana wants her order history in a format another service can import.',
      systems: [['Orders', 'Machine-readable export (JSON/CSV) of what she provided', 'A PDF is not portable'], ['Account security', 'Verify identity before release', 'The export link goes to an unverified email'], ['Other people', 'Leave out data about others (shared orders, gifts)', 'Her partner’s address travels with it']],
      proof: 'Schema of the export, identity-verification record, and a check that no third party’s data is included.' },
    { id: 'appeal', t: 'Appeal an automated decision', law: 'GDPR Art. 22 · CCPA ADMT rules (from 2027)', when: 'Oct 22', ask: 'Dana contests the automated decline from Scene 04.',
      systems: [['Decision log', 'Find the decision, the model version and the inputs', 'Scores are logged; inputs are not'], ['Human reviewer', 'Someone with authority to overturn it', 'The reviewer can only re-run the same model'], ['Explanation', 'Say which data drove it, in plain words', '“Our systems flagged your account” is all she hears'], ['Correction', 'Fix the input, not only the outcome', 'The decision is reversed; the bad merge stays']],
      proof: 'Decision log with inputs and model version, the human reviewer’s outcome, and the time to decide.' }
  ];

  /* ── 14 · Retention: raw → derived → aggregate (static in HTML) ── */

  /* ── 15 · Forget me: the stores a deletion must reach ─────────── */
  D.forget = [
    ['Primary database', 'Hard delete.'],
    ['Replicas & caches', 'Invalidate; short TTL.'],
    ['Logs', 'Redact at write time — then there is nothing to delete.'],
    ['Backups', 'Expire on a stated clock; re-apply deletions on restore; or crypto-shred.'],
    ['Warehouse tables', 'Partition-aware delete.'],
    ['ML features & models', 'Rebuild or retrain without the person; “unlearning” large models is not yet verifiable.'],
    ['Search indexes & vector stores', 'Reindex; delete embeddings by source document.'],
    ['Vendors & processors', 'Delete API + attestation, written into the contract.'],
    ['Devices', 'Every phone, laptop and local cache.']
  ];

  /* ── 16 · Vendor lifecycle: HelpHub CRM ───────────────────────── */
  /* now: how Northstar runs it today (from the Command Center's vendor record);
     with: the control that would hold. */
  D.vendor = [
    { t: 'Select', q: 'Do we need a vendor for this at all?', now: 'Chosen for features; the privacy review came after the security review.', with: 'Privacy review before selection: purpose, data, region, subprocessors, deletion API.', ev: 'Review record dated before the contract.' },
    { t: 'Scope', q: 'Which API scopes and fields does it get?', now: 'Email, full transcript, order ID and customer ID for every chat.', with: 'Only what support needs: a case token, the transcript with payment and health details redacted.', ev: 'Field allow-list at the egress proxy; blocked-field counts.' },
    { t: 'Contract', q: 'Purpose, retention, subprocessors, audit rights, deletion at the end?', now: 'DPA signed; retention 30 days in the contract.', with: 'Purpose limited to support; 30-day retention; prior notice of new subprocessors; audit rights; delete or return at termination (GDPR Art. 28).', ev: 'Contract clauses mapped to machine checks.' },
    { t: 'Transfer', q: 'Where does the data go, and on what basis?', now: 'EU transcripts reach a US summariser (LLMCo) that nobody reviewed.', with: 'Transfer mechanism recorded (SCCs or adequacy) and a transfer assessment for each subprocessor.', ev: 'Transfer register entry per flow, with its basis.' },
    { t: 'Operate', q: 'Is it still doing what we agreed?', now: 'Retention quietly changed from 30 to 365 days; a new subprocessor was added.', with: 'Drift alerts on retention, subprocessors and new fields; renewal blocked until resolved.', ev: 'Drift feed with owner and resolution date.' },
    { t: 'Audit', q: 'Can they prove it?', now: 'No deletion attestation on file.', with: 'Quarterly attestation, sampled by a canary record that must disappear.', ev: 'Attestations plus canary results.' },
    { t: 'Terminate', q: 'When we leave, does the data?', now: 'No exit plan; backups at the vendor are nobody’s question.', with: 'Return, delete, verify with a canary; certificate of destruction including backups and subprocessors.', ev: 'Certificate + canary re-query after the backup window.' }
  ];

  /* ── 17 · AI: what actually happens, and what you can claim ───── */
  D.aiMech = [
    ['Training & fine-tuning data', 'Examples are used to update model weights. Some sequences — especially duplicated ones — can be memorised and reproduced verbatim.', 'Extraction attacks have recovered verbatim training text from real models.', 'That every record is extractable, or that none is.', 'Train only on consented, minimised data; deduplicate; hold out sensitive categories.', 'Dataset lineage per training run; extraction tests against planted canaries.', ['carlini21', 'carlini23', 'nasr23']],
    ['RAG sources', 'At answer time the system retrieves documents and pastes them into the prompt. Anything retrievable can appear in an answer.', 'Access control has to be enforced at retrieval, per user.', 'That the model “knows” the documents — it reads them each time.', 'Retrieve only what the asking user may see; delete by source document.', 'Retrieval logs; a deleted-document canary that must stop being retrieved.', ['owasp']],
    ['Prompts, outputs, conversation logs', 'Ordinary records: stored, backed up, searchable, sometimes reviewed by people.', 'They are personal data with retention and access like any log.', 'That the model “forgets” a conversation — the logs are what remember.', 'Short retention; no training use without a basis; redact before storage.', 'TTL job reports; reviewer access logs.', []],
    ['Embeddings & vector stores', 'Text turned into vectors for search. Vectors can be partly inverted back into text under some conditions.', 'Treat embeddings as the text they came from.', 'That embeddings are anonymous.', 'Same tier and deletion as the source; key chunks by source ID.', 'Delete-by-source canary; inversion testing on your own model.', ['morris23']],
    ['Memory', 'A feature that saves facts about the user for later conversations — a database row, not a model change.', 'Users can be shown, edit and delete memory rows.', 'That memory is inside the model.', 'Opt-in; show the user what was saved; never save sensitive categories silently.', 'Memory rows per user, with the conversation they came from.', []],
    ['Memorisation & extraction', 'Measured by attacks: prompt with a prefix, check for verbatim continuations; or test membership.', 'A measured rate on a stated test.', 'A guarantee either way from a few tests.', 'Deduplicate; DP training where the budget allows; output filters.', 'Extraction and membership tests with planted canaries, per release.', ['carlini21', 'shokri17']],
    ['Sensitive inference', 'Models infer health, pregnancy or sexuality from ordinary signals.', 'An inference is personal data, and in many laws sensitive data.', 'That you didn’t collect it because nobody typed it.', 'Block sensitive inference for uses that don’t need it; label outputs.', 'Category-level audits of outputs and segments.', []],
    ['Retention & deletion', 'Deleting a conversation removes logs and rows. It does not change weights already trained on it.', 'Deletion reaches logs, memory, indexes and future training sets.', 'That deletion reaches a trained model.', 'Keep deletable data out of training; track which runs used which records.', 'Deletion receipts per store, including vector stores and training manifests.', []],
    ['Model “unlearning”', 'Exact unlearning means retraining without the data (SISA makes that cheaper if designed in from the start). Approximate methods for large models have no verification guarantee.', 'Retraining without the record, where feasible and planned for.', 'That a large model has provably forgotten someone.', 'Design for retraining; prefer not to train on deletable personal data.', 'Retraining manifests; honest wording in deletion confirmations.', ['bourtoule21', 'cooper24']],
    ['Third-party model providers', 'Prompts leave your boundary. Terms decide retention (e.g. an abuse-monitoring window) and training use.', 'What the contract says, verified where possible.', 'That “zero retention” holds without checking the terms and settings.', 'Redact before sending; contract no-training and retention; isolated tenancy.', 'Contract terms mapped to settings; redaction recall on a labelled set.', []],
    ['Agent tools & permissions', 'An agent calls tools (search, checkout, email) with the permissions it was given.', 'Least privilege per tool; scoped, short-lived credentials.', 'That the model will only do what the user meant — prompts can be injected.', 'Scoped tools; allow-lists; rate limits; no ambient credentials.', 'Tool-call logs with the identity and scope used.', ['owasp']],
    ['Human approval boundaries', 'Some actions (purchases, messages to others, deletions) wait for a person to confirm.', 'Irreversible or costly actions need explicit confirmation.', 'That a confirmation click proves understanding.', 'Confirm with the specifics (item, price, recipient); never batch-approve.', 'Approval logs; rate of actions taken without confirmation (should be zero).', []],
    ['Automated decisions, explanation & appeal', 'A model output that decides something about a person — eligibility, a decline, a price.', 'A right to human review and to contest, where the law gives one; good practice everywhere.', 'That a score is “just a recommendation” when nobody overrides it.', 'Human review with authority; explanations tied to the inputs; appeal route.', 'Decision logs with inputs, overrides and appeal outcomes.', ['gdpr', 'aiact']]
  ];

  /* ── 19 · Worst day ───────────────────────────────────────────── */
  D.designs = [
    { n: 'Plaintext, kept forever', d: 'Every message, name and contact — going back years.',
      f: [[1, 'Everything'], [1, 'Years'], [1, 'Names, numbers'], [1, 'No key at all']],
      rec: '<span class="c">// readable, per message × years of history</span>\n{ from: <span class="h">"Dana K. +1 415 555 0142"</span>, to: <span class="h">"Sam R."</span>,\n  sent: "2019-03-14 23:41", body: <span class="h">"the test came back positive…"</span> }' },
    { n: 'Encrypted, company keys', d: 'A stolen disk is useless. An insider or a key thief gets everything.',
      f: [[1, 'Everything'], [1, 'Years'], [1, 'Names, numbers'], [0.45, 'The company']],
      rec: '<span class="c">// disk thief: ciphertext. key thief or insider: this, for years</span>\n{ from: <span class="h">"Dana K. +1 415 555 0142"</span>, to: <span class="h">"Sam R."</span>,\n  sent: "2019-03-14 23:41", body: <span class="h">"the test came back positive…"</span> }' },
    { n: '+ Minimized, short retention', d: 'Only the last 30 days, only the fields that were needed.',
      f: [[0.35, 'Needed fields'], [0.04, '30 days'], [0.6, 'Pseudonymous IDs'], [0.45, 'The company']],
      rec: '<span class="c">// key thief or insider: the last 30 days only</span>\n{ from: "u_8472", to: "u_1190",\n  sent: "2026-09-12", body: <span class="h">"see you at 6"</span> }' },
    { n: 'End-to-end encrypted', d: 'Ciphertext only. Who talked to whom, and when, may still show.',
      f: [[0.35, 'Needed fields'], [0.04, '30 days'], [0.3, 'Metadata only'], [0.02, 'Only the users’ devices']],
      rec: '<span class="c">// anyone: ciphertext — metadata may still show</span>\n{ from: "u_8472", to: "u_1190",\n  sent: <span class="h">"2026-09-12T23:41Z"</span>, body: <span class="g">"x9f2c0…e71b"</span> }' },
    { n: 'Never collected — on device', d: 'Nothing on the server to steal.',
      f: [[0, 'Nothing'], [0, '—'], [0, '—'], [0, '—']],
      rec: '<span class="g">// the server holds nothing to steal</span>\n{ }' }
  ];
  D.designFactors = ['Collected', 'Kept', 'Identifiable', 'Key holder'];
  /* The index: product of the four factors, scaled so the worst design is 100. */
  D.designIndex = function (des) { return des.f.reduce(function (p, f) { return p * f[0]; }, 1) * 100; };

  /* ── 20 · PETs + DP ───────────────────────────────────────────── */
  D.petFamilies = [
    ['REDUCE', 'Hold less', [['min', 'Minimization'], ['dev', 'On-device'], ['ret', 'Retention limits'], ['gen', 'Generalization']]],
    ['TRANSFORM', 'Change its form', [['pse', 'Pseudonymization'], ['kan', 'k-anonymity family'], ['dp', 'Differential privacy'], ['syn', 'Synthetic data']]],
    ['PROTECT COMPUTATION', 'Compute without seeing', [['fl', 'Federated learning'], ['sa', 'Secure aggregation'], ['mpc', 'MPC'], ['he', 'Homomorphic encryption'], ['tee', 'TEEs'], ['psi', 'PSI']]]
  ];
  D.petThreats = [
    ['We hold more than the feature needs', ['min', 'ret'], 'Minimization + retention', 'REDUCE', 'Usually none — you weren’t using it', 'That the deletion jobs actually run', 'What you keep is still fully identifiable'],
    ['Analysts can single out individuals in results', ['dp', 'gen'], 'Differential privacy', 'TRANSFORM', 'Noise; small groups become unreliable. Stronger privacy costs accuracy fast below ε = 1', 'A correct implementation and an honest budget', 'Privacy loss accumulates — see the ledger below. DP does not hide population-level truths; that is the point of the analysis'],
    ['Joinable identifiers across datasets', ['pse'], 'Pseudonymization / scoped IDs', 'TRANSFORM', 'Low; some joins need a governed path', 'Whoever holds the key or mapping table', 'Still personal data; re-linkable with the key or enough quasi-identifiers'],
    ['A test environment needs realistic data', ['syn', 'dp'], 'Synthetic data, ideally trained with DP', 'TRANSFORM', 'Rare cases and subtle correlations may be lost', 'That the generator did not memorise records', 'Outliers can leak without a formal guarantee'],
    ['Train a model without collecting the raw data', ['fl', 'sa', 'dp'], 'Federated learning + secure aggregation + DP', 'PROTECT COMPUTATION', 'Slower training, harder debugging', 'The server sees only the sum of many updates, never one', 'Updates can still leak without DP — gradient-inversion attacks work on small batches'],
    ['Find which contacts already use the app — without uploading the address book', ['psi'], 'Private set intersection', 'PROTECT COMPUTATION', 'Protocol and compute cost', 'Both sides follow the protocol', 'The intersection itself still leaks'],
    ['Two companies want an overlap count without sharing their lists', ['mpc'], 'Secure multi-party computation', 'PROTECT COMPUTATION', 'Network-heavy; complex protocols', 'That the parties do not collude', 'The output can still reveal inputs; limit what is released'],
    ['A server must score data it must never be able to read', ['he'], 'Homomorphic encryption', 'PROTECT COMPUTATION', 'Often orders of magnitude slower', 'Only the key holder can read the result', 'The result, once decrypted, is as sensitive as the inputs it summarises'],
    ['The infrastructure operator could read data in use', ['tee'], 'Trusted execution environments', 'PROTECT COMPUTATION', 'Performance and operational complexity', 'The hardware vendor and the attestation chain', 'Side channels; code inside the enclave can still misuse data']
  ];

  /* ── 21 · Change breaks reviews ───────────────────────────────── */
  /* The reorder-reminder review (Scene 05) was approved with four conditions.
     breaks: index into D.verdict of the condition the change silently breaks (-1: none).
     rule: the change-detection rule that fires (null: correctly ignored). */
  D.changes = [
    { k: 'Schema', t: 'order_placed gains precise_lat, precise_lon — marked “backward compatible”', diff: '+ precise_lat: double\n+ precise_lon: double', breaks: 1, rule: 'New field with tier ≥ T3', ns: 'drift:precise_lat' },
    { k: 'Rename', t: 'cadence_days renamed to cadence', diff: '- cadence_days: int\n+ cadence: int', breaks: -1, rule: null },
    { k: 'Consumer', t: 'Audience Builder subscribes to the cadence feature store', diff: 'consumers:\n  reminder-service\n+ audience-builder   # purpose: ads', breaks: 3, rule: 'New consumer with a purpose outside the declared set' },
    { k: 'Destination', t: 'The MailPost template now includes {{product_name}}', diff: '- template: reorder_v2 (token, link)\n+ template: reorder_v3 (token, link, product_name)', breaks: 2, rule: 'New field reaching a third party' },
    { k: 'Model feature', t: 'The reorder model adds category = prenatal as a feature', diff: 'features:\n  cadence, days_since\n+ category   # includes T4 categories', breaks: 0, rule: 'T4 category enters a model or audience' },
    { k: 'Join', t: 'The identity job links the reminder ID to the advertising ID', diff: '+ JOIN idgraph ON reminders_id = maid', breaks: 3, rule: 'New join between purpose-scoped identifiers' }
  ];

  /* ── 22 · Observability: monitors → incidents they would catch ── */
  /* Incident ids are the Command Center's. */
  D.monitors = [
    { id: 'consent', t: 'Consent canary', d: 'A test identity that has opted out must never appear in any export.', catches: ['INC-2026-014'] },
    { id: 'logs', t: 'Personal data in logs', d: 'Log lines are scanned for email, phone and token patterns.', catches: ['INC-2026-011'] },
    { id: 'delete', t: 'Deletion canary', d: 'Deleted test records must stop being returned — including by search and retrieval — within the SLO.', catches: ['INC-2026-009'] },
    { id: 'egress', t: 'Destination registry', d: 'Every outbound export must match a contracted destination.', catches: ['INC-2026-006'] },
    { id: 'access', t: 'Access-spike alerts', d: 'Account views are compared with each person’s cases and baseline.', catches: ['INC-2026-004'] },
    { id: 'kfloor', t: 'Output floor', d: 'Audiences and aggregates below a minimum size are refused at release.', catches: ['INC-2025-021'] },
    { id: 'uptime', t: 'Uptime and error rates', d: 'Is the service up, and fast?', catches: [] }
  ];
  D.monitorBudget = 3;

  /* ── 23 · Incident response ───────────────────────────────────── */
  /* The Pulse SDK beacon that reached the advertising warehouse (Command
     Center flow fl18). Each step: the tempting move and the one that holds. */
  D.incident = [
    { t: 'Detect', when: 'Sep 23 · 23:59', what: 'An alert: the identity job joined Pulse user IDs to advertising IDs.',
      bad: ['Treat it as a data-quality ticket for the morning', 'The join runs again tonight; the ad warehouse now holds health-app screens tied to ad IDs for another day.'],
      good: ['Page the privacy on-call and open an incident', 'An incident commander owns it from minute one, and the clock the law may start is written down.'] },
    { t: 'Contain', when: 'Sep 24 · 00:20', what: 'Stop further processing.',
      bad: ['Drop the warehouse table', 'The SDK keeps sending tomorrow’s beacons, and the evidence of what was exposed is gone.'],
      good: ['Stop the flow at its source and freeze downstream jobs', 'The SDK beacon is switched off by remote config, the identity job and segment builds are paused, the table is quarantined — read access revoked, rows kept.'] },
    { t: 'Preserve', when: 'Sep 24 · 01:10', what: 'Keep what the investigation needs.',
      bad: ['Copy everything to an incident drive', 'Now there is one more uncontrolled copy of health data — made by the response team.'],
      good: ['Preserve metadata, lineage and access logs in place', 'Evidence is snapshotted without copying the health data; the quarantined rows stay where they are, under hold.'] },
    { t: 'Scope', when: 'Sep 24 · 09:00', what: 'Who and what was affected?',
      bad: ['Count the rows in the table', 'Rows are not people, and the table is not the only place the data went.'],
      good: ['Count distinct people and follow lineage downstream', 'People, time window, and every consumer: segments built, the lookalike model’s last training run, exports to AdReach.'] },
    { t: 'Decide & notify', when: 'Sep 24 · 11:00', what: 'Who must know, and who decides what to tell regulators and people?',
      bad: ['Wait until the investigation is complete', 'Deadlines that may apply run from awareness, not from certainty.'],
      good: ['Brief counsel, the DPO and the accountable executive now', 'They decide, with the facts so far, whether and whom to notify — regulator, partners, people — and record why.'] },
    { t: 'Remediate', when: 'Sep 25–30', what: 'Remove the exposure everywhere it reached.',
      bad: ['Delete the warehouse table and close', 'The segments, the model features and the partner’s copy still hold it.'],
      good: ['Delete the table, rebuild segments, retrain, and get the partner to delete', 'Every copy found by lineage is removed; the partner confirms with an attestation.'] },
    { t: 'Verify & guard', when: 'Oct 2', what: 'Prove it, and make it impossible to repeat by accident.',
      bad: ['Mark the ticket resolved', 'Nothing stops the next SDK update from doing the same.'],
      good: ['Canary queries, a lineage re-check, and a new invariant', 'Health-app identifiers may not join advertising identifiers — enforced in the identity job and checked daily.'] }
  ];

  /* Field kit: the evidence to ask for, per review question (same order as D.eight). */
  D.eightEvidence = [
    'The customer outcome in one sentence, and the metric that shows it',
    'A field list with tiers — by what each field reveals',
    'The identifier used and its scope; the joins it is allowed',
    'A flow diagram in which every arrow has a purpose, retention and owner',
    'Access groups for each store; how access is granted and expires',
    'The TTL per field, and the job that enforces it',
    'The uses that are ruled out, and the control that rules them out',
    'The conditions, each linked to a control and its evidence'
  ];

  /* Concept → Command Center page. The Command Center links back to the same anchors
     (privacy-command-center/app.js, P.ESSAY); a test checks the two agree. */
  D.pccMap = [
    ['person', 'One person, no name', 'explore/person', 'One Person', 'Every fact and inference about Dana, with its join path'],
    ['linkability', 'Two harmless tables', 'explore/identities', 'Identities', 'Identifiers, their scope, and the joins between them'],
    ['review', 'Eight questions', 'privacy/reviews', 'Privacy reviews', 'The eight answers per feature, and launch blockers'],
    ['arrows', 'Every arrow', 'explore/flows', 'Lineage & flows', 'Every flow as a privacy object, including unreviewed ones'],
    ['purpose', 'Purpose at use', 'privacy/purpose', 'Purpose', 'Purpose findings and mismatched reads'],
    ['harm', 'Harm, not just breach', 'privacy/threats', 'Threat models', 'LINDDUN across the riskiest flows'],
    ['burn', 'The burn button', 'privacy/tracking', 'Tracking', 'SDKs and pixels, and whether they ask'],
    ['ladder', 'The enforcement ladder', 'assurance/controls', 'Controls & evidence', 'Each control’s rung and health'],
    ['consent', 'Consent is state', 'privacy/consent', 'Consent', 'Propagation latency per consumer'],
    ['rights', 'Rights as workflows', 'privacy/rights', 'Individual rights', 'Requests, deadlines and slow systems'],
    ['retention', 'Retention', 'privacy/retention', 'Retention', 'Declared versus observed age per dataset'],
    ['forget', 'Forget me', 'privacy/deletion', 'Deletion', 'Deletion verification across every system'],
    ['vendors', 'Vendors', 'governance/vendors', 'Vendor register', 'Vendors, subprocessors, transfers and attestations'],
    ['ai', 'AI, ML and agents', 'privacy/ai', 'AI & agents', 'The model and agent inventory'],
    ['signin', 'Signing in', 'assurance/access', 'Access & insider', 'Unusual access and break-glass use'],
    ['worst', 'Your worst day', 'privacy/worstday', 'Worst Day', 'Blast-radius simulation per dataset'],
    ['pets', 'PETs and budgets', 'privacy/pets', 'PETs & DP', 'Control alternatives and the ε ledger'],
    ['change', 'Change breaks reviews', 'assurance/drift', 'Drift', 'Privacy-impacting changes and the reviews they reopen'],
    ['observe', 'Privacy observability', 'observability', 'Observability', 'Privacy SLOs, control health and evidence freshness'],
    ['incident', 'Incident response', 'assurance/incidents', 'Incidents', 'Incidents, broken assumptions and guards'],
    ['home', 'One home. Three clouds.', 'life/graph', 'Household & places', 'The household graph, every arrow’s fourteen answers, and the engineering answers'],
    ['guest', 'The guest never clicked Accept', 'life/people', 'Who the home observes', 'Owners, subjects, guests and bystanders, and what each sensor takes'],
    ['door', 'When privacy opens the door', 'life/actions', 'Physical actions', 'Every software path that can unlock, open, disarm or start — and its identity'],
    ['routine', 'The routine nobody reviewed', 'life/routines', 'Automation review', 'Each routine’s trigger, identity, privileges, failure mode and kill switch'],
    ['network', 'The network is a witness', 'life/networks', 'Network context', 'What changes when a device moves between networks'],
    ['infer', 'The house made an inference', 'life/inferences', 'Home inferences', 'The inference registry: source, confidence, purpose, expiry, correction and appeal'],
    ['oldkeys', 'The old owner still has the keys', 'life/offboarding', 'Offboarding', 'Workflows across device, hub, account, integrations, vendors and backups']
  ];

  root.EA_DATA = D;
})(typeof window !== 'undefined' ? window : globalThis);
