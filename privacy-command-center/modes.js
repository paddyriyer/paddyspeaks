/* Privacy Command Center v1 — the modes: Products, Everyday arrows, Every layer,
 * Future, AI / agents, the four-lens Review, QA and Data governance.
 *
 * One privacy model, two experiences. The essay explains the arrows; these views
 * let you follow them. Everything both properties agree on (the twenty-eight
 * questions, the shared phrases, the evidence labels, the deep links) is in
 * /articles/every-arrow/shared.js (EA_SHARED); every vendor claim is in
 * /articles/every-arrow/compare.js (EA_CMP). Nothing here restates a claim.
 *
 * Two kinds of content never mix, and each wears its band:
 *   DOCUMENTED  — a company's own documentation, cited (Products, Evidence → claims)
 *   SYNTHETIC   — Northstar and conceptual architecture; no company's implementation
 * A TEST is a recommendation. It is never shown as having been run.
 *
 * app.js calls window.PCC_MODES(api) once and gets back pages and helpers. */
window.PCC_MODES = function (A) {
  'use strict';
  var G = A.G, EV = A.EV, X = window.EA_SHARED, C = window.EA_CMP, esc = A.esc, name = A.name, $ = A.$, $$ = A.$$, plural = A.plural;
  var ESSAY = X.essay;
  var CMP_LENS = { security: 'sec', privacy: 'pri', qa: 'qa', gov: 'gov' };
  var APP_LENS = { sec: 'security', pri: 'privacy', qa: 'qa', gov: 'gov' };
  var LENS_IDS = ['security', 'privacy', 'qa', 'gov'];
  var LENS_Q = {}; C.lenses.forEach(function (l) { LENS_Q[APP_LENS[l.id]] = l.q; });
  function byId(list, id) { for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i]; return null; }
  function lensOf(st) { return st.l === 'all' ? LENS_IDS : [st.l]; }
  function inLens(st, l) { return st.l === 'all' || st.l === l; }

  /* ═══════════ shared bits ═══════════ */
  var EB = { doc: 'eb-doc', set: 'eb-set', lim: 'eb-lim', test: 'eb-test', unk: 'eb-unk' };
  function badge(k) { return '<span class="eb ' + EB[k] + '" title="' + esc(X.evidence[k].d) + '">' + esc(X.evidence[k].t) + '</span>'; }
  function lensChip(l) { return '<span class="lc lc-' + l + '">' + esc(X.lensShort[l]) + '</span>'; }
  function band(kind, extra) {
    return kind === 'doc' ? '<p class="band band-doc"><b>Documented vendor information</b> Each company’s own documentation, cited, as reviewed on ' + esc(C.asOf) + '. No scores, no ranks, no winners. ' + (extra || '') + '</p>'
      : '<p class="band band-syn"><b>Synthetic</b> No company implementation is implied. ' + (extra || '') + '</p>';
  }
  function readLink(id) {
    var c = X.concepts[id]; if (!c) return '';
    return '<p class="readx"><a href="' + ESSAY + c.essay + '">Read the explanation: <b>' + esc(c.t) + '</b> →</a> <span>' + esc(c.line) + '</span></p>';
  }
  function phrase(id) { var p = byId(X.phrases, id); return p ? '<p class="keyline">' + esc(p.t) + '</p>' : ''; }
  function phraseText(id) { return byId(X.phrases, id).t; }
  /* the global lens: same data, a different question */
  function lensBar(st, label) {
    return '<div class="lensbar"><div class="seg lens4" role="radiogroup" aria-label="' + esc(label || 'Lens') + '">' + ['all'].concat(LENS_IDS).map(function (l) {
      return '<button role="radio" data-l4="' + l + '" aria-checked="' + (st.l === l) + '">' + esc(X.lensShort[l]) + '</button>'; }).join('') + '</div>' +
      '<p class="lensq">' + (st.l === 'all' ? 'Four lenses. Same data, a different question.' : esc(X.lensShort[st.l]) + ' asks: ' + esc(LENS_Q[st.l])) + '</p></div>';
  }
  function mountLens(root) { $$('[data-l4]', root).forEach(function (b) { b.addEventListener('click', function () { A.focusNext('[data-l4="' + b.getAttribute('data-l4') + '"]'); A.set({ l: b.getAttribute('data-l4') }); }); }); }
  function seg(label, attr, items, cur) {
    return '<div class="seg" role="radiogroup" aria-label="' + esc(label) + '">' + items.map(function (x) { return '<button role="radio" data-' + attr + '="' + x[0] + '" aria-checked="' + (x[0] === cur) + '">' + esc(x[1]) + '</button>'; }).join('') + '</div>';
  }
  function dl(rows) { return '<dl class="five">' + rows.map(function (r) { return '<div' + (r[2] ? ' class="' + r[2] + '"' : '') + '><dt>' + r[0] + '</dt><dd>' + r[1] + '</dd></div>'; }).join('') + '</dl>'; }
  function pgh(h, p, eyebrow) { return '<div class="pg-h">' + (eyebrow ? '<span class="eyebrow">' + esc(eyebrow) + '</span>' : '') + '<h1>' + esc(h) + '</h1><p>' + esc(p) + '</p></div>'; }
  function ctlStatus(id) {
    var c = G.controls[id]; if (!c) return ['unk', 'UNKNOWN'];
    if (c.result === 'fail') return ['fail', 'FAIL'];
    if (c.result === 'never') return ['never', 'NOT RUN'];
    return A.freshness(c.last).k === 'stale' ? ['unk', 'UNKNOWN'] : ['ok', 'PASS'];
  }
  function qst(s) { return '<span class="qs qs-' + s[0] + '">' + esc(s[1]) + '</span>'; }

  /* ═══════════ PRODUCTS — documented claims, and the arrow to watch ═══════════ */
  /* The synthetic arrow behind each product: the pattern, never a company's design. */
  var FOLLOW = {
    passkeys: { moves: 'The private key, encrypted, from one device to the sync service and on to a new device.', id: 'The platform account that owns the keychain.', obs: 'The sync service sees that a key was added, from which device and when; not the key itself.', why: 'So a new phone can sign in without a password.', copies: 'Every enrolled device, the sync service, and a recently-deleted bin.', ret: 'Until the user deletes the passkey in every place: the device, the account and the site.', ctl: 'End-to-end encryption, with a device passcode or recovery key gating any restore.', fail: 'The recovery path. Whoever can restore the key when every device is lost is inside the boundary.' },
    browser: { moves: 'A request to a script or image that the page embeds from another site.', id: 'A cookie, a fingerprint built from the browser’s features, or the IP address.', obs: 'The third party that serves the script, and anyone it shares with.', why: 'Analytics, ads, fonts, video: the site chose to embed it.', copies: 'The third party’s logs, profiles and partners.', ret: 'Set by the third party; the site rarely knows.', ctl: 'Tracking protection, partitioned storage, blocking known trackers by default.', fail: 'A script the site itself embeds runs with the site’s rights; protection cannot tell the site from its tracker.' },
    mail: { moves: 'An image request, fired when the message is opened.', id: 'A unique image address for each recipient, plus the reader’s IP address and the time.', obs: 'The sender’s tracking server.', why: 'To learn whether, when and where the message was read.', copies: 'The sender’s campaign analytics.', ret: 'Set by the sender; unknown to the reader.', ctl: 'Blocking remote images, or fetching them through a proxy before the message is opened.', fail: 'A proxy can hide the IP address and still reveal that the message was opened, if it fetches at open time.' },
    messages: { moves: 'The conversation, copied from the phone into a cloud backup.', id: 'The phone number and the backup account.', obs: 'Whoever holds the backup key.', why: 'So a new phone gets the history back.', copies: 'Every participant’s phone, and every participant’s backup.', ret: 'As long as the backup exists; one participant’s backup outlives the others’ deletion.', ctl: 'End-to-end encryption in transit; an encrypted backup with a key only the user holds.', fail: 'The backup. In transit the message is sealed; the backup copy is where defaults decide who holds the key.' },
    wallet: { moves: 'Transaction details from the wallet to the wallet maker: merchant, amount, time, place.', id: 'The account the wallet signs in to.', obs: 'The wallet maker, besides the merchant and the payment network.', why: 'Receipts, fraud checks, spending summaries.', copies: 'The wallet maker’s transaction history.', ret: 'Set by the wallet maker; may be documented.', ctl: 'A payment token that hides the card number from the merchant.', fail: 'The token hides the card, not the history: it says nothing about what the platform keeps.' },
    backup: { moves: 'Photos and files from the phone to the provider’s cloud.', id: 'The cloud account.', obs: 'Whoever holds the key: the provider, the user, or a recovery contact.', why: 'So nothing is lost with the phone.', copies: 'The cloud store, its replicas, and a recently-deleted bin.', ret: 'Until the user deletes it, plus the bin’s clock.', ctl: 'Encryption at rest; optionally a key only the user holds.', fail: 'Key custody. Whoever holds the key decides who can be compelled to open it.' },
    assistant: { moves: 'The question, plus whatever context the assistant attaches: mail, calendar, location.', id: 'The account, and identifiers inside the context.', obs: 'The on-device model, a private cloud tier, or a third-party model, depending on where it runs.', why: 'To answer the question.', copies: 'Conversation history, provider logs, possibly human review.', ret: 'Often longer than the answer needs; check the default.', ctl: 'On-device processing, attested private compute, no training by default.', fail: 'The arrow from device to cloud, and what is kept after the answer. “Verifiable” and “we promise” are different controls.' },
    wearable: { moves: 'A frame from the camera and the spoken question, or only what was asked of it, from the glasses to the phone app and perhaps the cloud.', id: 'The glasses, the paired phone and the account.', obs: 'The service that answers; and, in the frame, everyone the camera saw.', why: 'To answer a question about what the wearer is looking at.', copies: 'The phone, the cloud for some features, and the voice history.', ret: 'Depends on the feature and the setting; unknown wherever it is not documented.', ctl: 'A capture light, and cropping or on-device recognition before anything is sent.', fail: 'The people in the frame. The owner’s settings and the owner’s awareness do not reach them.' },
    voice: { moves: 'Audio after the wake word, from the speaker to the cloud; then a transcript.', id: 'The household’s account and the device.', obs: 'The cloud service; sometimes a human reviewer.', why: 'To understand the request.', copies: 'The recording, the transcript, and anything learned from them.', ret: 'Set by a setting; deleting the recording may leave the transcript.', ctl: 'Local wake-word detection; settings to delete automatically and opt out of review.', fail: 'Deletion has to reach the transcript made from the audio, not only the audio.' }
  };
  function claimsOf(P, co, lid) { return (P.cells[co] && P.cells[co][CMP_LENS[lid]]) || []; }
  function itemHTML(it) {
    var srcs = (it[3] || '').split(' ').filter(Boolean).map(function (k) { var s = C.sources[k]; return s ? '<a href="' + esc(s.u) + '" rel="noopener">' + esc(s.c) + '</a>' : ''; }).join(' · ');
    return '<li class="cl cl-' + it[0] + '">' + badge(it[0]) + '<div><b>' + esc(it[1]) + '</b><p>' + esc(it[2]) + '</p>' + (it[0] === 'test' ? '<p class="small">A recommendation from the essay. Nobody has run it here.</p>' : srcs ? '<p class="src">' + srcs + '</p>' : '') + '</div></li>';
  }
  function arrowHTML(P, sel) {
    return '<ol class="parrow" aria-label="The arrow in ' + esc(P.n) + '">' + P.arrow.map(function (n, i) { return '<li' + (i === P.hot ? ' class="hot"' : '') + '><span>' + esc(n) + '</span></li>'; }).join('') + '</ol>';
  }
  function productsPage(st) {
    var P = byId(C.products, st.pr) || C.products[0], cos = st.co && P.cos.indexOf(st.co) >= 0 ? [st.co] : P.cos;
    var n = { doc: 0, set: 0, lim: 0, test: 0 };
    cos.forEach(function (co) { lensOf(st).forEach(function (l) { claimsOf(P, co, l).forEach(function (it) { n[it[0]]++; }); }); });
    var F = FOLLOW[P.id], tests = [];
    P.cos.forEach(function (co) { LENS_IDS.forEach(function (l) { claimsOf(P, co, l).forEach(function (it) { if (it[0] === 'test') tests.push(it[1]); }); }); });
    var follow = !st.fa ? '' : '<section class="card fol" aria-labelledby="folH">' + band('syn', 'The pattern behind this arrow, on no company’s data.') +
      '<h3 id="folH">Follow this arrow: ' + esc(P.arrow[P.hot - 1] + ' → ' + P.arrow[P.hot]) + '</h3>' +
      dl([[lensChip('privacy') + ' What moves?', esc(F.moves)], [lensChip('privacy') + ' What identifies the person?', esc(F.id)], [lensChip('security') + ' Who can observe it?', esc(F.obs)],
        [lensChip('privacy') + ' Purpose', esc(F.why)], [lensChip('gov') + ' Copies', esc(F.copies)], [lensChip('gov') + ' Retention', esc(F.ret)], [lensChip('security') + ' Control', esc(F.ctl)],
        [lensChip('qa') + ' Evidence', badge('test') + ' ' + esc(tests.join(' · ') || 'None proposed') + '<br><span class="small">Recommended tests. None has been run.</span>'],
        [lensChip('all') + ' Failure boundary', '<b>' + esc(F.fail) + '</b>', 'hl']]) +
      '<p class="small">' + esc(phraseText('boundary')) + '</p>' +
      '<p><a class="btn ghost" href="' + esc(X.products[P.id].synth) + '">Open the interactive synthetic version →</a></p></section>';
    return pgh('Products', 'Eight everyday products, as their makers document them. Pick a product, then a company and a lens. Every claim is cited; every test is ours, and none has been run.', 'Documented claims') +
      seg('Product', 'pr', C.products.map(function (p) { return [p.id, p.n]; }), P.id) +
      '<div class="m-pw"><section class="card prd" aria-labelledby="prH"><span class="eyebrow">' + esc(P.n) + '</span><h2 id="prH">' + esc(P.t) + '</h2><p class="lede">' + esc(P.lede) + '</p>' +
        '<div class="watch"><span class="eyebrow">The arrow to watch</span>' + arrowHTML(P) + '<p>' + esc(P.read.watch) + '</p>' +
        '<button type="button" class="btn" data-fa aria-expanded="' + !!st.fa + '">' + (st.fa ? 'Hide the arrow' : 'Follow this arrow') + '</button></div>' + follow +
        readLink({ passkeys: 'recovery', browser: 'metadata', mail: 'metadata', messages: 'metadata', wallet: 'lenses', backup: 'recovery', assistant: 'agent', voice: 'derivatives', wearable: 'subject' }[P.id]) +
        '<p class="readx"><a href="' + ESSAY + '#' + P.id + '">Read “' + esc(P.n) + '” in the essay →</a></p></section>' +
      '<section class="card clm" aria-labelledby="clH">' + band('doc') +
        '<h2 id="clH">What the companies document</h2>' + lensBar(st) +
        seg('Company', 'co', [['', 'All ' + plural(P.cos.length, 'company').replace(/^\d+ /, '') + ' (' + P.cos.length + ')']].concat(P.cos.map(function (c) { return [c, C.companies[c]]; })), st.co && P.cos.indexOf(st.co) >= 0 ? st.co : '') +
        '<p class="cnt" aria-live="polite">' + ['doc', 'set', 'lim', 'test'].map(function (k) { return n[k] + ' ' + X.evidence[k].t.toLowerCase(); }).join(' · ') + '</p>' +
        cos.map(function (co) {
          return '<div class="co"><h3>' + esc(C.companies[co]) + ' <span>' + esc(P.names[co]) + '</span></h3>' + lensOf(st).map(function (l) {
            var it = claimsOf(P, co, l);
            return '<div class="col"><p class="col-h">' + lensChip(l) + '</p>' + (it.length ? '<ul class="cls">' + it.map(itemHTML).join('') + '</ul>' : '<p>' + badge('unk') + ' Nothing reviewed for this lens.</p>') + '</div>';
          }).join('') + '</div>';
        }).join('') +
        '<dl class="rd"><div><dt>What they agree on</dt><dd>' + esc(P.read.agree) + '</dd></div><div><dt>Where they differ</dt><dd>' + esc(P.read.differ) + '</dd></div></dl></section></div>';
  }
  function mountProducts(root) {
    mountLens(root);
    root.addEventListener('click', function (e) {
      var b = e.target.closest('[data-pr],[data-co],[data-fa]'); if (!b) return;
      if (b.hasAttribute('data-pr')) { A.focusNext('[data-pr="' + b.getAttribute('data-pr') + '"]'); A.set({ pr: b.getAttribute('data-pr'), co: '', fa: false }); }
      else if (b.hasAttribute('data-co')) { A.focusNext('[data-co="' + b.getAttribute('data-co') + '"]'); A.set({ co: b.getAttribute('data-co') }); }
      else { A.focusNext(A.S().fa ? '[data-fa]' : '#folH'); A.set({ fa: !A.S().fa }); }
    });
  }

  /* ═══════════ EVERY LAYER — a guarantee holds until the next layer ═══════════ */
  var HOPS = {
    sensor: { moves: 'Sound, light, motion and position, before anyone has asked for anything.', observe: 'The device itself; what happens next depends on local processing.', ident: 'Often nobody yet; a voice or a face can become an identifier.', persists: 'Ideally nothing: a wake-word window or a frame buffer that is overwritten.', combine: 'Repeated observations of a room become a routine; faces become people.', prove: 'Run the false activation test and watch the network: nothing should leave before the wake word.', holds: 'A local wake word or on-device recognition decides what never becomes an arrow.', stops: 'Once activated, everything in the window travels together, including other people’s speech.', ctl: 'A local wake word; on-device recognition; indicators; minimisation before transmission', concept: 'sensing' },
    person: { moves: 'An intention: what the person wants, typed, spoken or tapped.', observe: 'People nearby, and the device’s own sensors.', ident: 'A face, a voice, or the account they are signed in to.', persists: 'Nothing yet, unless the device records it.', combine: 'Everything below is about this one person.', prove: 'Write down what the person expects to happen, and test against that expectation.', holds: 'The person decides to act.', stops: 'Once the action leaves their hands, every later hop decides for them.', ctl: 'Clear choices and defaults', concept: 'lenses' },
    device: { moves: 'Taps, sensor readings, the request being built, local history.', observe: 'The operating system, apps with permissions, keyboards and accessibility services.', ident: 'Device identifiers, an advertising ID, the platform account.', persists: 'Local history and caches, and backups that may sync to a cloud.', combine: 'The device ID with the account ID; app activity with location.', prove: 'Check what an app can read with each permission off, and what the backup contains.', holds: 'Hardware-backed keys and on-device processing keep secrets local.', stops: 'Backup and sync carry local data to a cloud the device does not control.', ctl: 'Permissions, a secure chip, an encrypted backup', concept: 'devices' },
    browser: { moves: 'The page request, cookies, site storage, and scripts from other sites.', observe: 'Every script on the page, extensions with page access, the browser’s sync service.', ident: 'Cookies, a fingerprint built from the browser’s features, the signed-in browser account.', persists: 'History, cookies, site storage, synced profiles.', combine: 'Third-party cookies or a fingerprint join visits across sites.', prove: 'Load a test page with a request logger and list every third party and what each receives.', holds: 'Same-origin rules and tracking protection limit what other sites read.', stops: 'A script the site itself embeds runs with the site’s own rights.', ctl: 'Tracking protection, partitioned storage, extension review', concept: 'metadata' },
    dns: { moves: 'The name of the site, before anything else loads.', observe: 'The resolver; the local network too, unless DNS is encrypted.', ident: 'The device’s IP address and the time of the lookup.', persists: 'Resolver logs, for as long as the resolver keeps them.', combine: 'A resolver log joined to address leases and an asset inventory becomes one person’s browsing history.', prove: 'Capture traffic on the local network: is the lookup visible? Read the resolver’s retention.', holds: 'Encrypted DNS hides the question from the local network.', stops: 'Encrypted DNS moves the trust to the resolver; it does not remove it.', ctl: 'Encrypted DNS; resolver log retention', concept: 'metadata' },
    network: { moves: 'Packets: addresses, ports, sizes and timing on the outside; content inside.', observe: 'Every network on the path: the Wi-Fi, the internet provider, transit.', ident: 'An IP address plus a precise time: a join key, not a name.', persists: 'Flow logs and address leases at each operator.', combine: 'An operator’s records can resolve an IP address and a time to a subscriber.', prove: 'Compare what a packet capture shows with and without a relay or VPN.', holds: 'Transport encryption covers the inner layers.', stops: 'Encryption hides the content, not the shape: addresses, sizes and timing stay visible.', ctl: 'Transport encryption; IP relays; truncating addresses', concept: 'metadata' },
    tls: { moves: 'The encrypted request; the hostname in the opening message unless Encrypted Client Hello is used.', observe: 'The network sees metadata. Whoever terminates TLS sees plaintext, and that is often a CDN or load balancer, not the application.', ident: 'The hostname, and the client’s IP address.', persists: 'Nothing on the wire; plaintext logs wherever TLS is terminated.', combine: 'Sizes and timing can tell reading from downloading.', prove: 'List every point that terminates TLS, and what each logs after decryption.', holds: 'TLS proves the server’s identity and keeps the traffic confidential and intact in transit.', stops: 'At the terminator. After it, the plaintext goes to logs, analytics and the warehouse.', ctl: 'TLS 1.3, forward secrecy, Encrypted Client Hello, logging rules at the terminator', concept: 'tls' },
    http: { moves: 'The URL, the query, headers, cookies, tokens and the body.', observe: 'Whoever terminates TLS, the application, and anything that logs requests.', ident: 'Session cookies, bearer tokens, user IDs or email addresses in the URL.', persists: 'Access logs keep URLs, and often headers.', combine: 'An identifier in a URL is copied into every log and analytics event that records the URL.', prove: 'Search the access logs for email addresses, tokens and IDs in URLs.', holds: 'Authentication and authorisation decide who may call the API.', stops: 'Authorisation says who may ask, not what may be logged.', ctl: 'Redacting URLs; an allowlist of headers in logs', concept: 'tls' },
    edge: { moves: 'Requests and responses, decrypted.', observe: 'The CDN or edge provider, its logs and its security tools.', ident: 'IP address, cookies, device hints.', persists: 'Edge logs; cached responses, possibly personal ones.', combine: 'Edge logs for many sites sit with one provider.', prove: 'Request a personal page from two accounts: can the cache serve one person’s page to the other?', holds: 'Caching rules and bot defences protect the service.', stops: 'A personal response cached as public is served to strangers.', ctl: 'Private caching for personal responses; edge log retention', concept: 'tls' },
    service: { moves: 'The request, now as the application’s own objects.', observe: 'The application, its operators, its support tools.', ident: 'The account ID, and every identifier the service adds.', persists: 'Whatever the service writes: the database, the logs, the events.', combine: 'Services that share an account ID can recognise the same person.', prove: 'Trace one request end to end and list every write it causes.', holds: 'Authorisation inside the service decides who sees what.', stops: 'Every write is a new copy with its own retention.', ctl: 'Authorisation; purpose binding; scoped identifiers', concept: 'join' },
    cache: { moves: 'Copies of query results and rendered pages.', observe: 'Anything that can read the cache.', ident: 'Cache keys built from user or tenant IDs.', persists: 'Until the entry expires or is evicted.', combine: 'A cache key without the tenant can serve one tenant’s rows to another.', prove: 'Delete a record and confirm the cached copy goes too; check the key includes the tenant.', holds: 'Expiry limits how long a copy lives.', stops: 'Deleting in the database does not evict the cache by itself.', ctl: 'Expiry; tenant-scoped keys; eviction on delete', concept: 'deletion' },
    db: { moves: 'Rows.', observe: 'The application role, administrators, backup and replication jobs.', ident: 'Primary keys and the identifiers stored in the rows.', persists: 'Rows, replicas and backups, each with its own clock.', combine: 'Two tables can each pass review and still create a new exposure when a shared key joins them.', prove: 'Query as one tenant through every path (API, report, export) and confirm no other tenant’s row appears.', holds: 'Row-level security filters what the database returns.', stops: 'Filtering is not isolation: the semantic layer, cache, export and browser must keep the boundary too.', ctl: 'Row-level security; tenant isolation in every layer', concept: 'filtering' },
    log: { moves: 'Events that describe what happened: who, what, when, from where.', observe: 'Engineers, the logging vendor, security tools.', ident: 'User IDs, IP addresses, device IDs; sometimes emails or tokens copied from URLs.', persists: 'Days to years, by the log’s retention setting, and often longer in an archive.', combine: 'Logs feed analytics, so an identifier in a log reaches every dashboard that reads it.', prove: 'Search a sample of logs for personal identifiers, and confirm the retention setting matches the rule.', holds: 'Access controls on the log store.', stops: 'Analytics downstream copies whatever the log kept.', ctl: 'Redaction when written; retention; access review', concept: 'deletion' },
    lake: { moves: 'Everything, joined for analysis.', observe: 'Analysts, data scientists, pipelines, BI tools.', ident: 'Join keys: account IDs, hashed emails, device IDs.', persists: 'Partitions, snapshots and extracts, often longer than the source.', combine: 'This is where joins are cheap: the inference nobody designed starts here.', prove: 'Delete a test person upstream and search every partition, snapshot and extract for them.', holds: 'Access roles and masking.', stops: 'Deleting upstream does not reach a partition already written.', ctl: 'Masking; join review; deletion that propagates', concept: 'join' },
    analytics: { moves: 'Features, segments, model inputs.', observe: 'Models, dashboards, product teams.', ident: 'Feature vectors keyed by person or device.', persists: 'Feature stores and trained models.', combine: 'Segments and predictions are inferences stored as data.', prove: 'Confirm a deleted person’s features and segments are removed, and decide whether retraining is needed.', holds: 'Aggregation and minimum group sizes.', stops: 'A model trained on a person can keep what it learned after their rows are gone.', ctl: 'Aggregation thresholds; deleting features; a retraining rule', concept: 'join' },
    ai: { moves: 'Prompts, retrieved documents, tool results, memory.', observe: 'The model provider, the runtime, the tools, the logs.', ident: 'The account, and whatever the retrieved text says about the person.', persists: 'Conversation history, memory, provider logs, possibly training data.', combine: 'An agent can create the join that nobody wrote: mail plus browsing plus location.', prove: 'Plant an instruction in a retrieved document and confirm the runtime blocks the tool call it asks for.', holds: 'Tool permissions and the task’s purpose.', stops: 'Authorised inputs do not automatically create an authorised inference.', ctl: 'A tool allowlist; cross-domain join restrictions; human approval', concept: 'agent' },
    export: { moves: 'Files or API feeds to another organisation.', observe: 'The vendor, its sub-processors, its staff.', ident: 'Whatever identifiers the export carries, often more than needed.', persists: 'At the vendor, under the vendor’s retention.', combine: 'The vendor can join it with other data unless the contract and controls stop it.', prove: 'Send a deletion request and require a dated acknowledgement from the vendor.', holds: 'The contract and the export’s field list.', stops: 'Consent is distributed state: a revocation has to reach the vendor’s copy too.', ctl: 'Minimal fields; a consent check at export; deletion acknowledgements', concept: 'consent' },
    archive: { moves: 'Old data, kept for the long term or marked for deletion.', observe: 'Whoever holds the archive and its keys.', ident: 'Whatever the archived records still carry.', persists: 'Years, unless a hold suspends the end.', combine: 'An old record can be matched again while the key and the normalisation rule survive.', prove: 'Restore an old record using the documented path; delete one and prove every copy went.', holds: 'Encryption at rest and retention rules.', stops: 'Deletion has to follow every copy, and preservation has to keep the keys and schemas too.', ctl: 'Retention; key lifecycle; the scope of each hold', concept: 'hold' }
  };
  var HTTP_PARTS = [
    ['URL path', 'The resource, and IDs written into the path', 'Access logs, analytics, the referrer sent onward'],
    ['Query', 'Search terms, filters, sometimes an email or a token', 'Access logs, analytics, the referrer sent onward'],
    ['Headers', 'User agent, language, referrer, client hints', 'Logs; together they can fingerprint the device'],
    ['Cookies', 'Session, preferences, tracking', 'The service; third parties read their own'],
    ['Tokens', 'Bearer tokens and API keys', 'Logs, if headers are logged; then anyone who reads the logs'],
    ['Body', 'Form contents, messages, uploads', 'The application; sometimes error logs'],
    ['Logs', 'All of the above, as written', 'The log store, analytics, the logging vendor']
  ];
  function hopExtra(id) {
    var R = X.tlsReach;
    if (id === 'tls') return '<div class="m-tw"><table class="rel tlsr"><caption>Who can read what, once HTTPS is on</caption><thead><tr><th scope="col">Element</th>' + R.cols.map(function (c) { return '<th scope="col">' + esc(c) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      R.rows.map(function (r) { return '<tr><th scope="row">' + esc(r[0]) + '</th>' + r.slice(1).map(function (v) { return '<td class="' + (/^Hidden/.test(v) ? 'v-no' : 'v-yes') + '">' + esc(v) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>' + phrase('metadata');
    if (id === 'http') return '<div class="m-tw"><table class="rel"><caption>What one request carries, and where it ends up</caption><thead><tr><th scope="col">Part</th><th scope="col">Carries</th><th scope="col">Ends up in</th></tr></thead><tbody>' +
      HTTP_PARTS.map(function (r) { return '<tr><th scope="row">' + esc(r[0]) + '</th><td>' + esc(r[1]) + '</td><td>' + esc(r[2]) + '</td></tr>'; }).join('') + '</tbody></table></div>';
    if (id === 'dns') return '<div class="m-tw"><table class="rel"><caption>Who sees the name being looked up</caption><thead><tr><th scope="col">Lookup</th><th scope="col">The local network</th><th scope="col">The resolver</th></tr></thead><tbody>' +
      '<tr><th scope="row">Plain DNS</th><td class="v-yes">Visible</td><td class="v-yes">Visible</td></tr><tr><th scope="row">Encrypted DNS</th><td class="v-no">Hidden</td><td class="v-yes">Visible</td></tr></tbody></table></div>' + phrase('metadata');
    if (id === 'log') {
      var r = G.retention.filter(function (x) { return x.node === 'ds_logs'; })[0], d = G.deletion.filter(function (x) { return x.node === 'ds_logs'; })[0];
      return band('syn', 'One Northstar log, from the graph.') + dl([['Retention', esc(r.n + ': required ' + r.req + ' days, declared ' + r.dec + ', observed ' + (r.obs == null ? 'not measured' : r.obs))], ['Identifier', esc(d ? d.ev : 'UNKNOWN')],
        ['Access', esc(name('c_iam') + ': ' + (G.controls.c_iam.last ? 'last reviewed ' + G.controls.c_iam.last : 'never reviewed'))], ['Downstream analytics', esc(G.edges.filter(function (e) { return e[0] === 'ds_logs' && e[1] === 'FLOWS_TO'; }).map(function (e) { return name(e[2]); }).join(', ') || 'None recorded')],
        ['Control', esc(name('c_url_redact')) + ' ' + qst(ctlStatus('c_url_redact'))]]);
    }
    if (id === 'db') return '<p><a class="btn ghost" href="#cc?p=reviewer&s=cloud&j=report&q=control&u=tenant">Open the tenant-isolation chain on synthetic data →</a></p>';
    if (id === 'ai') return '<p><a class="btn ghost" href="#ai">Open the agent runtime →</a></p>';
    if (id === 'sensor') return '<p><a class="btn ghost" href="#sensors?sm=room">Follow the microphone through the room →</a></p>' + phrase('sensing');
    if (id === 'archive') return '<p><a class="btn ghost" href="#future?tf=hold">Open preservation and recoverability →</a></p>';
    return '';
  }
  function layersPage(st) {
    var hid = HOPS[st.hop] ? st.hop : 'dns', H = HOPS[hid], i = X.hops.map(function (h) { return h[0]; }).indexOf(hid), next = X.hops[i + 1];
    return pgh('Every layer', 'A guarantee holds until the next layer. Pick a hop and ask the same six questions; the answers change at every boundary.', 'From the person to the archive') +
      '<p class="keyline">' + esc(phraseText('boundary')) + '</p>' +
      '<ol class="m-hops" aria-label="Layers">' + X.hops.map(function (h) { return '<li><button type="button" data-hop="' + h[0] + '" aria-pressed="' + (h[0] === hid) + '">' + esc(h[1]) + '</button></li>'; }).join('') + '</ol>' + lensBar(st) +
      '<div class="m-pw"><section class="card m-hop" aria-labelledby="hopH">' + band('syn', 'How common protocols and architectures generally behave. Details vary by version and configuration.') +
        '<span class="eyebrow">Hop ' + (i + 1) + ' of ' + X.hops.length + '</span><h2 id="hopH">' + esc(X.hops[i][1]) + '</h2>' +
        dl(X.hopQuestions.filter(function (q) { return inLens(st, q[2]); }).map(function (q) { return [lensChip(q[2]) + ' ' + esc(q[1]), esc(H[q[0]])]; })) +
        (st.l !== 'all' ? '<p class="small">' + plural(X.hopQuestions.filter(function (q) { return !inLens(st, q[2]); }).length, 'more question') + ' under the other lenses.</p>' : '') +
        hopExtra(hid) + '</section>' +
      '<section class="card bnd" aria-labelledby="bnH"><span class="eyebrow">Every guarantee has a boundary</span><h2 id="bnH">' + esc(X.hops[i][1]) + ': what holds, and where it stops</h2>' +
        dl([['The guarantee here', esc(H.holds)], ['Where the guarantee stops', '<b>' + esc(H.stops) + '</b>', 'hl'], ['Control', esc(H.ctl)], [badge('test') + ' How we would prove it', esc(H.prove) + '<br><span class="small">A recommended test, not a result.</span>']]) +
        (next ? '<p><button type="button" class="btn ghost" data-hop="' + next[0] + '">Next layer: ' + esc(next[1]) + ' →</button></p>' : '<p class="small">The last hop. Deletion has to follow every copy back up the chain.</p>') +
        readLink(H.concept) + '</section></div>';
  }
  function mountLayers(root) {
    mountLens(root);
    root.addEventListener('click', function (e) { var b = e.target.closest('[data-hop]'); if (b) { A.focusNext('.m-hops [data-hop="' + b.getAttribute('data-hop') + '"]'); A.set({ hop: b.getAttribute('data-hop') }); } });
  }

  /* ═══════════ FUTURE — what must still be possible years from now? ═══════════ */
  var GOALS = [['recover', 'Recover'], ['search', 'Search'], ['match', 'Match'], ['produce', 'Produce'], ['verify', 'Verify'], ['preserve', 'Preserve'], ['delete', 'Delete'], ['unrec', 'Make unrecoverable']];
  var REC = { full: 'Fully recoverable', key: 'Recoverable with key', vault: 'Recoverable through vault', match: 'Matchable but not reversible', irr: 'Irreversible', unk: 'Unknown' };
  /* y = possible · c = possible under a condition · n = not possible */
  var TRANS = [
    ['plain', 'Plain', 'full', 'Nothing', { recover: 'y', search: 'y', match: 'y', produce: 'y', verify: 'y', preserve: 'y', delete: ['c', 'Every copy'], unrec: ['c', 'Only by deleting every copy'] }],
    ['encrypted', 'Encrypted', 'key', 'The key, its owner and its store', { recover: ['c', 'With the key'], search: ['c', 'After decrypting'], match: ['c', 'With the key'], produce: ['c', 'With the key'], verify: 'y', preserve: ['c', 'The bytes and the key'], delete: ['c', 'Every copy, or the key'], unrec: ['c', 'Destroy every copy of the key'] }],
    ['tokenized', 'Tokenized', 'vault', 'The token vault and its mapping', { recover: ['c', 'Through the vault'], search: ['c', 'By token'], match: ['c', 'The same token links systems'], produce: ['c', 'Through the vault'], verify: 'y', preserve: ['c', 'The tokens and the mapping'], delete: ['c', 'The tokens and the mapping'], unrec: ['c', 'Delete the mapping'] }],
    ['hashed', 'Hashed', 'match', 'The algorithm and the normalisation rule', { recover: 'n', search: ['c', 'Exact values only'], match: ['c', 'Known candidates'], produce: ['c', 'Only the hash'], verify: ['c', 'That a known value matches'], preserve: ['c', 'The hash, algorithm and rule'], delete: ['c', 'Every copy'], unrec: ['c', 'Already, yet guessable inputs stay matchable'] }],
    ['hmac', 'Keyed pseudonym / HMAC', 'match', 'The historical key, the normalisation rule and the algorithm version', { recover: 'n', search: ['c', 'With the key'], match: ['c', 'With the historical key, rule and version'], produce: ['c', 'The pseudonym'], verify: ['c', 'With the key'], preserve: ['c', 'The IDs plus key, rule and version'], delete: ['c', 'Every copy'], unrec: ['c', 'Destroy the key; the IDs still link to each other'] }],
    ['aggregated', 'Aggregated', 'irr', 'Group sizes large enough', { recover: 'n', search: ['c', 'Totals only'], match: 'n', produce: ['c', 'Totals only'], verify: ['c', 'The totals'], preserve: ['c', 'Totals only'], delete: ['c', 'Nothing personal left, if groups are large'], unrec: ['c', 'Yes, if groups are large enough'] }],
    ['deleted', 'Deleted', 'irr', 'Every copy gone, including backups and derived data', { recover: 'n', search: 'n', match: 'n', produce: 'n', verify: ['c', 'That it is gone'], preserve: 'n', delete: 'y', unrec: ['c', 'Yes, if every copy went'] }],
    ['shredded', 'Crypto-shredded', 'irr', 'Proof that every copy of the key was destroyed', { recover: 'n', search: 'n', match: 'n', produce: 'n', verify: ['c', 'The key-destruction record'], preserve: ['c', 'Unreadable bytes only'], delete: ['c', 'In effect'], unrec: ['c', 'Yes, if every key copy is destroyed'] }]
  ];
  function cell(v) { var k = typeof v === 'string' ? v : v[0], t = typeof v === 'string' ? { y: 'Yes', n: 'No', c: 'Depends' }[v] : v[1]; return '<td class="g-' + k + '"><i aria-hidden="true">' + { y: '✓', n: '✕', c: '◐' }[k] + '</i> ' + esc(t) + '</td>'; }
  var TF_TABS = [['encrypt', 'Encryption'], ['token', 'Tokenization'], ['hash', 'Hashing'], ['hmac', 'Keyed pseudonym'], ['archive', 'Five-year archive'], ['keygone', 'Key destroyed'], ['hold', 'Preservation hold']];
  var TF_HEAD = {
    encrypt: { flow: [['Original'], ['Encrypt using key'], ['Ciphertext']], dep: [['Ciphertext'], ['Key'], ['Key owner'], ['Key store'], ['Recovery']], q: 'Who can recover the original?', rev: 'Reversible: yes, with the key', concept: 'recovery' },
    token: { flow: [['Original'], ['Token']], dep: [['Token vault'], ['Token ↔ Original']], q: 'Who can reconnect the token to the person?', rev: 'Reversible: through the vault', concept: 'hashing' },
    hash: { flow: [['Original'], ['Hash'], ['Fingerprint']], dep: [['Known candidate'], ['Same transformation'], ['Compare']], q: 'One-way does not necessarily mean unlinkable.', rev: 'Reversible: no', concept: 'hashing' },
    hmac: { flow: [['Identifier'], ['Normalisation'], ['Keyed transformation'], ['Pseudonymous ID']], dep: [['Known candidate'], ['Historical key + rule + version'], ['Compare']], q: 'Key lifecycle can become data lifecycle.', rev: 'Reversible: no · Known-candidate match: yes, if the historical key, the normalisation rule and the algorithm survive', concept: 'hashing' }
  };
  var HOLD_DEPS = [['Data', 'ds_archive'], ['Key', 'k_2026'], ['Token mapping', 'sy_vault'], ['Schema', 'sc_v14'], ['Normalisation', 'nr_v3'], ['Algorithm version', 'k_pseudo'], ['Timestamps', 'ds_archive'], ['Lineage', 'lin_arch'], ['Metadata', 'sc_v14'], ['Audit evidence', 'lin_arch']];
  function chips(list, cls) { return '<ol class="fchips' + (cls ? ' ' + cls : '') + '">' + list.map(function (x) { return '<li>' + esc(x[0]) + '</li>'; }).join('') + '</ol>'; }
  function holdHTML() {
    var Ar = G.archive, dep = function (n) { var d = Ar.deps.filter(function (x) { return x.node === n; })[0]; return d ? d.st.asis : 'unk'; };
    var ans = function (s, yes, no, unk) { return A.mark(s, s === 'ok' ? yes : s === 'fail' ? no : unk); };
    var all = function (a) { return a.indexOf('fail') >= 0 ? 'fail' : a.every(function (x) { return x === 'ok'; }) ? 'ok' : 'unk'; };
    var rel = ctlStatus('c_hold_release');
    return '<div class="lanes2"><div><div class="eyebrow">Normal lifecycle</div>' + chips([['Collect'], ['Use'], ['Retain'], ['Delete']]) + '</div><div><div class="eyebrow">Preservation lifecycle</div>' +
      chips([['Collect'], ['Use'], ['Legal / regulatory hold'], ['Preserve'], ['Release'], ['Resume retention / deletion']], 'hold') + '</div></div>' +
      '<p class="small">An engineering model, not legal advice.</p>' +
      '<div class="eyebrow">What a preserved record depends on</div><ul class="deps2">' + HOLD_DEPS.map(function (d) { return '<li>' + A.mark(dep(d[1]), d[0]) + '<small>' + esc(name(d[1])) + '</small></li>'; }).join('') + '</ul>' +
      band('syn', 'Answers computed from Northstar’s five-year archive, as recorded today.') +
      dl([['Can we open it?', ans(all([dep('ds_archive'), dep('k_2026')]), 'Yes: the data and its key exist', 'No: the data or its key is gone', 'Unproven')],
        ['Can we interpret it?', ans(dep('sc_v14'), 'Yes: the schema is kept', 'No: the schema is gone', 'Unproven: the schema is not under the hold')],
        ['Can we match it?', ans(all([dep('k_pseudo'), dep('nr_v3')]), 'Yes', 'No: the key or the rule is gone', 'Unproven')],
        ['Can we prove where it came from?', ans(dep('lin_arch'), 'Yes: lineage is kept', 'No', 'Unproven')],
        ['Can we delete it when the hold ends?', A.mark(rel[0] === 'ok' ? 'ok' : rel[0] === 'fail' ? 'fail' : 'unk', rel[0] === 'fail' ? 'Not reliably: the last release check failed' : rel[0] === 'ok' ? 'Yes: release verified' : 'Unproven') + ' <small>' + esc(name('c_hold_release')) + '</small>']]) +
      phrase('preserved');
  }
  function futurePage(st) {
    var t = st.tf, H = TF_HEAD[t], goal = st.goal;
    var mx = '<div class="m-tw"><table class="rel m-fut"><caption>Eight ways to keep a value, and what each still allows' + (goal ? ': <b>' + esc(byId(GOALS.map(function (g) { return { id: g[0], t: g[1] }; }), goal).t) + '</b> highlighted' : '') + '</caption><thead><tr><th scope="col">Transformation</th><th scope="col">Recoverability</th><th scope="col">Depends on</th>' +
      GOALS.map(function (g) { return '<th scope="col"' + (g[0] === goal ? ' class="gsel"' : '') + '>' + esc(g[1]) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      TRANS.map(function (r) { return '<tr><th scope="row">' + esc(r[1]) + '</th><td><span class="rc rc-' + r[2] + '">' + esc(REC[r[2]]) + '</span></td><td>' + esc(r[3]) + '</td>' + GOALS.map(function (g) { return cell(r[4][g[0]]).replace('<td class="', '<td class="' + (g[0] === goal ? 'gsel ' : '')); }).join('') + '</tr>'; }).join('') +
      '</tbody></table></div><p class="small"><span class="rc rc-unk">' + esc(REC.unk) + '</span> is a finding of its own: when nobody recorded which transformation, key or rule was used, nobody can say what is still possible.</p>';
    var head = H ? '<div class="tfh"><div><div class="eyebrow">The transformation</div>' + chips(H.flow) + '</div><div><div class="eyebrow">' + (t === 'hash' || t === 'hmac' ? 'What still works' : 'What recovery depends on') + '</div>' + chips(H.dep) + '</div>' +
      '<p class="rev">' + esc(H.rev) + '</p><p class="keyline">' + esc(H.q) + '</p>' + readLink(H.concept) + '</div>' : '';
    return pgh('The arrow into the future', 'What must still be possible years from now? Choose what must stay possible, then compare how each transformation keeps or loses it.', 'Recoverability') +
      '<p class="keyline">' + esc(phraseText('recoverability')) + '</p>' +
      '<div class="goals"><span class="eyebrow">What must still be possible?</span>' + seg('Goal', 'goal', [['', 'Show all']].concat(GOALS), goal || '') + '</div>' + mx +
      '<h2 class="sub">Follow it on synthetic data</h2>' + seg('Mode', 'tf', TF_TABS, t) +
      '<section class="card vis" id="vis" aria-labelledby="visH">' + band('syn', 'Northstar’s keys, vaults, archives and holds.') + head +
        (t === 'hold' ? '<h3 id="visH">' + esc(phraseText('preserved')) + '</h3>' + holdHTML() + readLink('hold') + '<div id="fvw"></div>' : '<h3 id="visH" class="sr-only">' + esc(byId(TF_TABS.map(function (x) { return { id: x[0], t: x[1] }; }), t).t) + '</h3><p class="principle"></p><div id="fvw"></div>') + '</section>';
  }
  var TF_VIEW = { encrypt: { kind: 'transform', tab: 'encrypt', key: 'recneeds' }, token: { kind: 'transform', tab: 'token', key: 'recneeds' }, hash: { kind: 'transform', tab: 'hash', key: 'match' }, hmac: { kind: 'transform', tab: 'pseudo', key: 'match' },
    archive: { kind: 'recover', key: 'recover' }, keygone: { kind: 'keygone', key: 'keygone' }, hold: { kind: 'hold', key: 'hold' } };
  function embed(root, view) {
    var host = $('#fvw', root); if (!host) return;
    var v = Object.assign({ note: '', noTabs: true }, view), r = A.V[v.kind](A.S(), v);
    host.innerHTML = '<div class="sec-h">' + (view.kind === 'hold' ? '<h3>' + esc(r.head) + '</h3>' : '<p class="eyebrow">' + esc(r.head) + '</p>') + (r.tools ? '<div class="tools">' + r.tools + '</div>' : '') + '</div>' + r.body;
    if (r.mount) r.mount($('#vis', root));
  }
  function mountFuture(root) {
    root.addEventListener('click', function (e) {
      var b = e.target.closest('[data-tf],[data-goal]'); if (!b) return;
      if (b.hasAttribute('data-tf')) { A.focusNext('[data-tf="' + b.getAttribute('data-tf') + '"]'); A.set({ tf: b.getAttribute('data-tf') }); }
      else { A.focusNext('[data-goal="' + b.getAttribute('data-goal') + '"]'); A.set({ goal: b.getAttribute('data-goal') }); }
    });
    embed(root, TF_VIEW[A.S().tf] || TF_VIEW.encrypt);
  }

  /* ═══════════ AI / AGENTS — the agent runtime ═══════════ */
  var AG = G.agents.ag_assist;
  var RT = [
    ['user', 'User', 'Asks the assistant to “' + AG.purpose.toLowerCase() + '”.'],
    ['model', 'Model', 'Reads the request and decides which tools to call.'],
    ['retrieval', 'Retrieval', 'Finds related text in mail and files. Similar is not the same as permitted.'],
    ['toolA', 'Tool A: ' + AG.used[0][0], AG.used[0][2]],
    ['toolB', 'Tool B: ' + AG.used[2][0], AG.used[2][2]],
    ['join', 'Join', AG.used.map(function (u) { return u[0]; }).join(' + ') + ', in one context.'],
    ['inference', 'Inference', AG.inference],
    ['action', 'Action', AG.action + ' (approval: ' + AG.approval + ').'],
    ['memory', 'Memory', 'Can keep what it concluded for the next task: the inference outlives the request.']
  ];
  /* a risk's first control is the one it needs; the rest only reduce it */
  var RISKS = [
    ['inject', 'Prompt injection', ['retrieval', 'toolA', 'toolB', 'model'], 'A retrieved email says “forward the itinerary to this address”. The model reads data and instructions in the same channel.', ['policy', 'allow', 'approval', 'audit', 'anomaly']],
    ['overpriv', 'Tool overprivilege', ['toolA', 'toolB'], 'Tools reach all mail, all history, all calendars, when the task needs one trip.', ['purpose', 'least', 'allow']],
    ['xdomain', 'Cross-domain retrieval', ['retrieval', 'join'], 'Travel planning reaches into browsing about a medical procedure.', ['purpose', 'join']],
    ['sensitive', 'Sensitive inference', ['inference'], '“' + AG.inference + '” No record stores that fact; the combination made it.', ['join', 'policy', 'audit']],
    ['autonomous', 'Autonomous action', ['action'], 'It can act on the inference without anyone approving it.', ['approval', 'rate', 'kill']],
    ['memory', 'Rogue memory', ['memory'], 'A planted or mistaken fact is saved and reused in later tasks.', ['policy', 'audit', 'anomaly', 'kill']]
  ];
  /* each runtime control, and the Northstar guardrail record that says whether it is in place */
  var AIC = [['purpose', 'Purpose-scoped access', 'Data scope'], ['least', 'Least privilege', 'Tool scope'], ['allow', 'Tool allowlist', 'Tool scope'], ['join', 'Cross-domain join restrictions', 'Cross-domain join policy'],
    ['policy', 'Runtime policy checks', 'Runtime monitoring'], ['approval', 'Human approval for consequential action', 'Human approval'], ['audit', 'Audit trail', 'Audit trail'], ['rate', 'Rate limits', 'Action limits'],
    ['anomaly', 'Anomaly detection', 'Runtime monitoring'], ['kill', 'Kill switch', 'Kill switch']];
  var aiOn = null;
  function aiDefaults() { var o = {}; AIC.forEach(function (c) { var g = G.guardrails.filter(function (x) { return x[0] === c[2]; })[0]; o[c[0]] = !!g && !g[1]; }); return o; }
  var AM_TABS = [['runtime', 'Agent runtime'], ['infer', 'What can it infer?'], ['do', 'What can it do?'], ['route', 'Where does it run?']];
  function aiPage(st) {
    if (!aiOn) aiOn = aiDefaults();
    var R = byId(RISKS.map(function (r) { return { id: r[0], r: r }; }), st.rk), risk = R ? R.r : null;
    var ctlName = function (x) { return byId(AIC.map(function (a) { return { id: a[0], t: a[1] }; }), x).t.toLowerCase(); };
    var covered = function (r) { return aiOn[r[4][0]] ? r[4].filter(function (c) { return aiOn[c]; }) : []; };
    var open = RISKS.filter(function (r) { return !covered(r).length; });
    var body = st.am !== 'runtime' ? '<p class="principle"></p><div id="fvw"></div>' :
      '<ol class="rt" aria-label="The agent runtime">' + RT.map(function (h) { var hit = risk && risk[2].indexOf(h[0]) >= 0; return '<li class="rt-' + h[0] + (hit ? ' hit' : '') + '"><b>' + esc(h[1]) + '</b><span>' + esc(h[2]) + '</span>' + (hit ? '<em>' + esc(risk[1]) + ' enters here</em>' : '') + '</li>'; }).join('') + '</ol>' +
      '<div class="aig"><div><h3>Risks</h3><div class="rks" role="group" aria-label="Risks">' + RISKS.map(function (r) { var c = covered(r); return '<button type="button" data-rk="' + r[0] + '" aria-pressed="' + (st.rk === r[0]) + '" class="rk' + (c.length ? '' : ' open') + '"><b>' + esc(r[1]) + '</b><span>' + (c.length ? 'Covered by ' + esc(c.map(ctlName).join(', ')) : 'Not covered: needs ' + esc(ctlName(r[4][0])) + (r[4].some(function (x) { return aiOn[x]; }) ? '; ' + esc(r[4].filter(function (x) { return aiOn[x]; }).map(ctlName).join(', ')) + ' only reduce it' : '')) + '</span></button>'; }).join('') + '</div>' +
        (risk ? '<p class="rkd">' + esc(risk[3]) + '</p>' : '<p class="small">Pick a risk to see where it enters the runtime.</p>') + '</div>' +
      '<div><h3>Controls</h3><div class="ctls" role="group" aria-label="Runtime controls">' + AIC.map(function (c) { return '<button type="button" data-aic="' + c[0] + '" aria-pressed="' + !!aiOn[c[0]] + '">' + esc(c[1]) + '<span>' + (aiOn[c[0]] ? 'in place' : 'missing') + '</span></button>'; }).join('') + '</div>' +
        '<p class="small">Starts from Northstar’s guardrail records. Switch a control to see which risks stay open. Nothing is stored.</p></div></div>' +
      '<p class="rsum" aria-live="polite">' + (open.length ? A.tag('CONTROL FAILURE') + ' ' + plural(open.length, 'risk') + ' without the control it needs: ' + esc(open.map(function (r) { return r[1].toLowerCase(); }).join(', ')) + '.' : A.tag('FACT') + ' Every risk has at least one control. Each still needs evidence that it works.') + '</p>';
    return pgh('AI and agents', 'An agent is a loop: it reads, retrieves, calls tools, joins, infers, acts and remembers. Each step is an arrow, and each arrow is a decision.', 'Agent runtime') +
      '<p class="keyline">' + esc(phraseText('authorised')) + '</p>' + seg('Agent view', 'am', AM_TABS, st.am) +
      '<section class="card vis" id="vis" aria-labelledby="aiH">' + band('syn', 'Northstar Assistant, a fictional agent.') + '<h2 id="aiH" class="sr-only">' + esc(byId(AM_TABS.map(function (x) { return { id: x[0], t: x[1] }; }), st.am).t) + '</h2>' + body + '</section>' + readLink('agent');
  }
  var AM_VIEW = { infer: { kind: 'agent', key: 'infer', agent: 'ag_assist' }, do: { kind: 'agentdo', key: 'agentdo' }, route: { kind: 'routing', key: 'routing' } };
  function mountAi(root) {
    root.addEventListener('click', function (e) {
      var b = e.target.closest('[data-am],[data-rk],[data-aic]'); if (!b) return;
      if (b.hasAttribute('data-am')) { A.focusNext('[data-am="' + b.getAttribute('data-am') + '"]'); A.set({ am: b.getAttribute('data-am') }); }
      else if (b.hasAttribute('data-rk')) { var k = b.getAttribute('data-rk'); A.focusNext('[data-rk="' + k + '"]'); A.set({ rk: A.S().rk === k ? '' : k }); }
      else { var c = b.getAttribute('data-aic'); aiOn[c] = !aiOn[c]; A.focusNext('[data-aic="' + c + '"]'); A.render(); }
    });
    if (AM_VIEW[A.S().am]) { var v = Object.assign({ note: '' }, AM_VIEW[A.S().am]), r = A.V[v.kind](A.S(), v), host = $('#fvw', root); host.innerHTML = '<div class="sec-h"><h3>' + esc(r.head) + '</h3>' + (r.tools ? '<div class="tools">' + r.tools + '</div>' : '') + '</div>' + r.body; var pr = $('.principle', root); if (pr) pr.textContent = G.principles[G.principleFor[v.key]] || ''; if (r.mount) r.mount($('#vis', root)); }
  }

  /* ═══════════ REVIEWS — four-lens review, QA, governance, what changed ═══════════ */
  var RV_TABS = [['lens', 'Four-lens review'], ['qa', 'QA'], ['gov', 'Data governance'], ['changes', 'What changed?'], ['features', 'Feature reviews']];
  var ANS = [['yes', 'Yes'], ['no', 'No'], ['unk', 'Unknown'], ['na', 'Not applicable'], ['ev', 'Needs evidence']];
  var RA = {};   /* answers: for this visit only, never stored */
  /* the QA test a review question leads to (index into each lens's seven) */
  var RQ_TEST = { security: { 0: 'idstab', 2: 'keyrec', 5: 'keyrec', 7: 'falsewake' }, privacy: { 1: 'idstab', 6: 'infrem', 3: 'consent', 10: 'indicator' }, qa: { 2: 'keyrec', 3: 'delete', 5: 'restore', 6: 'infrem', 7: 'indicator', 8: 'derivdel', 9: 'falsewake', 10: 'update' }, gov: { 3: 'delete', 5: 'hold', 1: 'delete', 7: 'derivdel', 10: 'delete' } };
  var TT = [
    ['consent', 'Consent revocation', 'When a person revokes consent, every system stops using their data.', 'Revoke for a test person; run every job that reads the data; check exports, vendor feeds and work already in flight.', 'No reads after the revocation time, and an acknowledgement from every consumer.', 'c_consent_read', 'consent'],
    ['delete', 'Delete end to end', 'A deleted person is gone from every copy.', 'Delete a canary person; search the database, cache, warehouse, logs, backups, feature store and vendor exports.', 'Gone everywhere, or a dated reason it is kept (a hold, a backup clock).', 'c_delete_orch', 'deletion'],
    ['tenant', 'Tenant isolation', 'One customer never sees another customer’s rows.', 'Query as one tenant through every path: API, report, cache, export, browser.', 'No other tenant’s row in any response.', 'c_server_filter', 'filtering'],
    ['idstab', 'Identifier stability', 'Identifiers are scoped or rotate as documented.', 'Collect the identifier across sites, sessions and days.', 'Different values wherever the design says scoped.', 'c_id_rotate', 'join'],
    ['pixel', 'Pixel fetch', 'Opening a message reveals nothing to the sender.', 'Send a message with a unique remote image to a test inbox; log every fetch, when and from which IP address.', 'No fetch at open time, or only through a proxy.', 'c_remote_content', 'metadata'],
    ['keyrec', 'Key recovery', 'The owner can recover when every device is lost, and nobody else can.', 'Wipe every device of a test account and follow the documented recovery; try each fallback.', 'Recovery only through the documented path; no SMS fallback.', 'c_recovery', 'recovery'],
    ['restore', 'Archive restore', 'An old record can be restored and understood.', 'Restore a record from the oldest archive with its documented key, schema and rules.', 'Readable and interpretable, with its lineage.', 'c_restore_drill', 'hold'],
    ['hold', 'Legal hold', 'A hold stops deletion in scope and releases cleanly.', 'Place a test hold, request deletion, release the hold, then search every copy.', 'Skips logged during the hold; every copy deleted after release.', 'c_hold_release', 'hold'],
    ['aitool', 'AI tool policy', 'The agent calls only allowed tools, within the task’s purpose.', 'Plant an instruction in a retrieved email asking for an unrelated tool call.', 'The call is blocked and logged; a person is asked before any consequential action.', 'c_agent_policy', 'agent'],
    ['falsewake', 'False activation', 'The device sends nothing when nobody meant to invoke it.', 'Play the correct wake word, similar phrases, television audio and conversation; measure activation, transmission, stored audio, transcripts and retention.', 'Only the wake word starts processing; nothing else leaves or is kept.', '', 'falsepos'],
    ['indicator', 'Indicator matches capture', 'The light or tone is on whenever a sensor captures, and only then.', 'Capture by every path (button, voice, app, live AI) and record the indicator alongside a network capture.', 'The indicator is on for every capture and every transmission.', '', 'bystander'],
    ['derivdel', 'Delete the source, check the derivative', 'Deleting a recording removes what was derived from it.', 'Delete a recording, then search for its transcript, intent, summary, embedding, analytics event and feedback sample.', 'Gone everywhere, or a dated reason it is kept.', '', 'derivatives'],
    ['update', 'Settings after an update', 'Privacy settings, and what they do, survive a firmware or app update.', 'Record every privacy setting, update the device and the app, then re-check each setting and re-run the false activation test.', 'Every setting and its effect unchanged after an update.', '', 'falsepos'],
    ['infrem', 'Inference removal', 'When a connection is scoped, shortened or separated, the inference it enabled stops.', 'Separate the contexts for a test person, then ask the questions the inference answered.', 'The inference no longer appears, in answers or in stored segments.', 'c_join_policy', 'join']
  ];
  var TT_PHRASE = { falsewake: 'falsepos', indicator: 'awareness', derivdel: 'derivative', consent: 'consent', delete: 'deletion', tenant: 'filtering', pixel: 'metadata', keyrec: 'boundary', restore: 'recoverability', hold: 'preserved', aitool: 'authorised', infrem: 'combination', idstab: 'link' };
  function ttOf(id) { return TT.filter(function (t) { return t[0] === id; })[0]; }
  function reviewOutput() {
    var F = [], D = [], E = [], T = [];
    LENS_IDS.forEach(function (l) {
      X.review[l].forEach(function (q, i) {
        var a = RA[l + i]; if (!a) return;
        var t = RQ_TEST[l][i] && ttOf(RQ_TEST[l][i]);
        if (a === 'no') { F.push(['RISK', l, q]); D.push(l, q); T.push(t ? t[1] + ': ' + t[3] : 'Write a test that would show the answer is now yes.'); }
        if (a === 'unk') { F.push(['UNKNOWN', l, q]); E.push('Who can answer: ' + q); }
        if (a === 'ev') { F.push(['DESIGN QUESTION', l, q]); E.push(q); if (t) T.push(t[1] + ': ' + t[3]); }
      });
    });
    var decisions = []; for (var i = 0; i < D.length; i += 2) decisions.push(D[i + 1]);
    var n = Object.keys(RA).length;
    if (!n) return '<p class="small">Answer any question. A question nobody can answer becomes a finding: UNKNOWN. That is not automatically a defect; it is the next thing to find out.</p>';
    return '<p class="cnt">' + plural(n, 'answer') + ' · ' + plural(F.length, 'finding') + '</p>' +
      '<div class="rvo"><div><h3>Findings</h3>' + (F.length ? '<ul class="fl">' + F.map(function (f) { return '<li class="fi">' + A.tag(f[0]) + ' ' + lensChip(f[1]) + '<p>' + esc(f[2]) + '</p>' + (f[0] === 'UNKNOWN' ? '<p class="small">Unknown is a finding, not a verdict.</p>' : '') + '</li>'; }).join('') + '</ul>' : '<p class="small">None yet.</p>') + '</div>' +
      '<div><h3>Decisions</h3>' + (decisions.length ? '<ul>' + decisions.map(function (q) { return '<li>' + A.tag('DECISION') + ' Change the design, accept the risk with an owner and a date, or stop: <i>' + esc(q) + '</i></li>'; }).join('') + '</ul>' : '<p class="small">None: no question was answered No.</p>') +
      '<h3>Evidence needed</h3>' + (E.length ? '<ul>' + E.map(function (e) { return '<li>' + esc(e) + '</li>'; }).join('') + '</ul>' : '<p class="small">None.</p>') +
      '<h3>Follow-up tests</h3>' + (T.length ? '<ul>' + T.map(function (t) { return '<li>' + badge('test') + ' ' + esc(t) + '</li>'; }).join('') + '</ul><p class="small">Recommended tests. None has been run.</p>' : '<p class="small">None.</p>') + '</div></div>';
  }
  function lensReview(st) {
    var P = st.rp && byId(C.products, st.rp);
    return '<p>The essay’s twenty-eight questions, seven per lens. Answers last for this visit and are never stored.</p>' + lensBar(st) +
      '<label class="sl rvp"><span>Reviewing</span><select id="rvP"><option value="">Your own product or feature</option>' + C.products.map(function (p) { return '<option value="' + p.id + '"' + (P && P.id === p.id ? ' selected' : '') + '>' + esc(p.n) + ': with what the companies document</option>'; }).join('') + '</select></label>' +
      '<div class="rvq">' + lensOf(st).map(function (l) {
        return '<section class="card rvl" aria-labelledby="rv-' + l + '"><h3 id="rv-' + l + '">' + lensChip(l) + ' ' + esc(LENS_Q[l]) + '</h3><ol>' + X.review[l].map(function (q, i) {
          return '<li><p>' + esc(q) + '</p><div class="m-ans" role="radiogroup" aria-label="Answer: ' + esc(q) + '">' + ANS.map(function (a) { return '<button role="radio" data-ra="' + l + i + '" data-av="' + a[0] + '" aria-checked="' + (RA[l + i] === a[0]) + '">' + esc(a[1]) + '</button>'; }).join('') + '</div></li>';
        }).join('') + '</ol>' + (P ? '<details class="ctx"><summary>' + esc(P.n) + ': what the companies document for this lens</summary>' + band('doc') + P.cos.map(function (co) { return '<p class="small"><b>' + esc(C.companies[co]) + '</b></p><ul class="cls">' + claimsOf(P, co, l).map(itemHTML).join('') + '</ul>'; }).join('') + '</details>' : '') + '</section>';
      }).join('') + '</div><section class="card" aria-labelledby="rvoH"><h2 id="rvoH">What the review produced</h2><div id="rvo" aria-live="polite">' + reviewOutput() + '</div></section>';
  }
  function qaReview(st) {
    var tests = [];
    C.products.forEach(function (p) { p.cos.forEach(function (co) { LENS_IDS.forEach(function (l) { claimsOf(p, co, l).forEach(function (it) { if (it[0] === 'test') tests.push([p, co, it]); }); }); }); });
    var sel = st.tt && ttOf(st.tt);
    return '<p>For every claim: what is the promise, what test would prove it, what result is expected, and what evidence was collected.</p>' +
      '<section class="card" aria-labelledby="ttH">' + band('syn', 'The status comes from Northstar’s control records.') + '<h3 id="ttH">Test templates</h3>' +
      '<div class="m-tw"><table class="rel tt"><thead><tr><th scope="col">Test</th><th scope="col">The promise</th><th scope="col">Status</th></tr></thead><tbody>' + TT.map(function (t) {
        var s = t[5] ? ctlStatus(t[5]) : ['never', 'NOT RUN'];
        return '<tr' + (sel && sel[0] === t[0] ? ' class="sel"' : '') + '><th scope="row"><button type="button" class="linkbtn" data-tt="' + t[0] + '" aria-expanded="' + !!(sel && sel[0] === t[0]) + '">' + esc(t[1]) + '</button></th><td>' + esc(t[2]) + '</td><td>' + qst(s) + '</td></tr>';
      }).join('') + '</tbody></table></div>' +
      (sel ? (function () { var c = G.controls[sel[5]], s = sel[5] ? ctlStatus(sel[5]) : ['never', 'NOT RUN']; return '<div class="ttd" id="ttd">' + dl([['What is the promise?', esc(sel[2])], ['What test would prove it?', esc(sel[3])], ['What is the expected result?', esc(sel[4])],
        ['What evidence was collected?', esc(c ? c.method + (c.last ? ' · ' + c.last : ' · never run') : 'None recorded')], ['Status', qst(s) + (sel[5] ? ' <small>' + esc(name(sel[5])) + '</small>' : ' <small>No Northstar control records this test.</small>')]]) + phrase(TT_PHRASE[sel[0]]) + readLink(sel[6]) + '</div>'; })() : '') + '</section>' +
      '<section class="card" aria-labelledby="etH">' + band('doc', 'The tests below are the essay’s, not the companies’.') + '<h3 id="etH">Tests the essay recommends</h3><p>' + plural(tests.length, 'test') + ', every one ' + qst(['never', 'NOT RUN']) + '. They are recommendations; nobody has run them, and none is a finding about a company.</p>' +
      '<ul class="cls">' + tests.map(function (x) { return '<li class="cl cl-test">' + badge('test') + '<div><b>' + esc(x[0].n + ' · ' + C.companies[x[1]] + ': ' + x[2][1]) + '</b><p>' + esc(x[2][2]) + '</p></div></li>'; }).join('') + '</ul></section>';
  }
  /* data governance: every copy, and the register */
  var OV = [['owner', 'Owner'], ['retention', 'Retention'], ['copies', 'Copy count'], ['keyowner', 'Key owner'], ['recovery', 'Recovery'], ['export', 'Export'], ['delete', 'Delete'], ['hold', 'Hold'], ['vendor', 'Vendor'], ['derived', 'Derived data']];
  function edgesOf(id, rel, dir) { return G.edges.filter(function (e) { return e[1] === rel && (dir === 'out' ? e[0] === id : e[2] === id); }).map(function (e) { return dir === 'out' ? e[2] : e[0]; }); }
  function tfOf(id) { return G.transforms.filter(function (t) { return t.node === id; })[0]; }
  function unk(t) { return badge('unk') + ' ' + esc(t || 'Not recorded'); }
  function ovCell(id, ov) {
    var t = tfOf(id), r = G.retention.filter(function (x) { return x.node === id; })[0], v;
    switch (ov) {
      case 'owner': v = edgesOf(id, 'OWNED_BY', 'out'); return v.length ? esc(v.map(name).join(', ')) : unk('No owner recorded');
      case 'retention': return r ? esc('Required ' + r.req + ' days · declared ' + r.dec + ' · observed ' + (r.obs == null ? 'not measured' : r.obs)) + (r.obs != null && r.obs > r.dec ? ' ' + qst(['fail', 'longer than declared']) : '') : unk('No retention rule recorded');
      case 'copies': v = edgesOf(id, 'DERIVED_FROM', 'in').concat(edgesOf(id, 'STORED_IN', 'out'), edgesOf(id, 'FLOWS_TO', 'out'), edgesOf(id, 'SHARES_WITH', 'out')); return esc(String(v.length + 1)) + (v.length ? ' <small>this one + ' + esc(v.map(name).join(', ')) + '</small>' : ' <small>no other copy recorded</small>');
      case 'keyowner': return t ? (t.key && G.keys[t.key] ? esc(name(G.keys[t.key].owner) + ' · ' + name(t.key)) : esc('No key: ' + G.transformTypes[t.type].toLowerCase())) : unk('No transformation recorded');
      case 'recovery': return t ? esc(G.recoverability[t.rec]) : unk('No transformation recorded');
      case 'export': v = edgesOf(id, 'SHARES_WITH', 'out').concat(edgesOf(id, 'FLOWS_TO', 'out')).filter(function (x) { return G.nodes[x] && G.nodes[x][0] === 'vendor'; }); return v.length ? esc('Yes: to ' + v.map(name).join(', ')) : esc('No export recorded');
      case 'delete': v = G.deletion.filter(function (x) { return x.node === id; })[0]; return v ? qst(v.st === 'ok' ? ['ok', 'deleted'] : v.st === 'fail' ? ['fail', 'missed'] : ['unk', v.st === 'wait' ? 'pending' : 'unknown']) + ' <small>' + esc(v.ev) + '</small>' : unk('Not in the deletion test');
      case 'hold': v = G.holds.filter(function (h) { return h.items.some(function (it) { return it[1] === id; }); }); return v.length ? esc(v.map(function (h) { return name(h.id) + ' (' + h.status + ')'; }).join(', ')) : esc('No hold');
      case 'vendor': v = G.edges.filter(function (e) { return (e[0] === id && G.nodes[e[2]] && G.nodes[e[2]][0] === 'vendor') || (e[2] === id && G.nodes[e[0]] && G.nodes[e[0]][0] === 'vendor'); }).map(function (e) { return e[0] === id ? e[2] : e[0]; }); return v.length ? esc(v.map(name).join(', ')) : esc('None');
      case 'derived': v = edgesOf(id, 'DERIVED_FROM', 'in'); return v.length ? esc(v.map(name).join(', ')) : esc('None recorded');
    }
    return '';
  }
  function govReview(st) {
    var D = G.deletion, by = function (s) { return D.filter(function (x) { return x.st === s; }); };
    var ok = by('ok'), miss = by('fail'), un = by('unk'), wait = by('wait');
    var owners = []; D.forEach(function (d) { edgesOf(d.node, 'OWNED_BY', 'out').forEach(function (o) { if (owners.indexOf(o) < 0) owners.push(o); }); });
    var keyOwners = []; Object.keys(G.keys).forEach(function (k) { var o = G.keys[k].owner; if (keyOwners.indexOf(o) < 0) keyOwners.push(o); });
    var over = G.retention.filter(function (r) { return r.obs != null && r.obs > r.dec; }), noobs = G.retention.filter(function (r) { return r.obs == null; });
    var held = G.holds.filter(function (h) { return h.status === 'active'; });
    var ds = []; G.retention.forEach(function (r) { if (ds.indexOf(r.node) < 0) ds.push(r.node); }); G.transforms.forEach(function (t) { if (G.nodes[t.node] && G.nodes[t.node][0] === 'dataset' && ds.indexOf(t.node) < 0) ds.push(t.node); });
    var ov = OV.filter(function (o) { return o[0] === st.ov; })[0] || OV[0];
    return '<p>Who holds it, how long does it live, and can it really go?</p>' + band('syn', 'One Northstar person’s data, every copy, from the graph.') +
      '<section class="card" aria-labelledby="cpH"><h3 id="cpH">' + plural(D.length, 'copy') + ' of one person; deletion reached ' + ok.length + ', missed ' + miss.length + (un.length ? ', unknown ' + un.length : '') + (wait.length ? ', pending ' + wait.length : '') + '</h3>' +
        '<ul class="cps">' + D.map(function (d) { return '<li class="cp-' + d.st + '">' + qst(d.st === 'ok' ? ['ok', 'deleted'] : d.st === 'fail' ? ['fail', 'missed'] : ['unk', d.st === 'wait' ? 'pending' : 'unknown']) + '<b>' + esc(d.n) + '</b><span>' + esc(d.ev) + '</span></li>'; }).join('') + '</ul>' + phrase('deletion') +
        dl([['Who holds it?', esc(owners.length ? owners.map(name).join(', ') : 'Not recorded')], ['How long?', esc(G.retention.length + ' datasets with a rule; ' + over.length + ' kept longer than declared; ' + noobs.length + ' never measured')], ['How many copies?', esc(String(D.length))],
          ['Who has the key?', esc(keyOwners.map(name).join(', '))], ['Who can restore it?', esc(G.tokenMap.access + '; anyone with ' + keyOwners.map(name).join(' or ') + '’s keys')],
          ['Does deletion propagate?', miss.length ? qst(['fail', 'No']) + ' ' + esc('Missed: ' + miss.map(function (d) { return d.n; }).join(', ')) : qst(['ok', 'Yes'])],
          ['Which derivatives survive?', esc(miss.filter(function (d) { return /feature|warehouse|export/i.test(d.n); }).map(function (d) { return d.n + ' (' + d.ev + ')'; }).join('; ') || 'None found')],
          ['Is a hold active?', esc(held.length ? held.map(function (h) { return name(h.id) + ': ' + h.scope; }).join('; ') : 'No')]]) + readLink('deletion') + '</section>' +
      '<section class="card" aria-labelledby="ovH"><h3 id="ovH">The register: ' + esc(ov[1].toLowerCase()) + '</h3>' + seg('Overlay', 'ov', OV, ov[0]) +
        '<div class="m-tw"><table class="rel"><thead><tr><th scope="col">Dataset</th><th scope="col">' + esc(ov[1]) + '</th></tr></thead><tbody>' + ds.map(function (id) { return '<tr><th scope="row">' + esc(name(id)) + '</th><td>' + ovCell(id, ov[0]) + '</td></tr>'; }).join('') + '</tbody></table></div>' +
        (function () { var miss = ds.filter(function (id) { return /badge|eb-unk/.test(ovCell(id, ov[0])); }).length; return miss ? '<p>' + A.tag('UNKNOWN') + ' ' + miss + ' of ' + ds.length + ' datasets have no recorded ' + esc(ov[1].toLowerCase()) + '. Nobody can answer the question for them, and that is the finding.</p>' : ''; })() +
        '<p class="small">' + badge('unk') + ' marks a field nobody recorded. Unknown is a finding.</p></section>';
  }
  /* What changed? — before versus after, from the events graph */
  var TRIGGERS = [['New receiver', ['New receiver', 'new destination']], ['New identifier', ['New identifier', 'new identifier']], ['New processor', ['New processor', 'new vendor']], ['New purpose', ['Purpose']],
    ['New retention period', ['Retention', 'retention increase']], ['New dataset', ['new dataset']], ['New join', ['new join']], ['New AI access', ['AI context', 'new AI tool access']], ['New tool', ['new AI tool access']],
    ['New export', ['new destination']], ['Setting default changed', []], ['Vendor control withdrawn', []], ['Key owner changed', ['key schedule']]];
  function diff(ch) {
    var before = EV.compose(EV.day), after = EV.compose(EV.day, { add: ch.add, mark: ch.edge });
    var added = after.order.filter(function (id) { return !before.nodes[id]; }), kind = function (id) { return EV.nodes[id] ? EV.nodes[id].kind : ''; };
    var lab = function (id) { return EV.label(id, 'all'); };
    var know = added.filter(function (id) { return kind(id) === 'data' || kind(id) === 'inf'; }), party = added.filter(function (id) { return kind(id) === 'sys'; }), inf = added.filter(function (id) { return kind(id) === 'inf'; });
    var e = ch.edge.split('>');
    return [
      ['What new thing becomes knowable?', know.length ? know.map(lab).join(', ') : ch.kind === 'Retention' ? 'Nothing new; the same ' + lab(ch.node).toLowerCase() + ' are known for ' + ch.to + ' days instead of ' + ch.from + '.' : 'No new record: ' + lab(e[0]) + ' now reaches ' + lab(e[1]) + '.'],
      ['What new party sees the data?', party.length ? party.map(lab).join(', ') : ch.kind === 'AI context' ? lab(e[0]) + ' now reads ' + lab(e[1]) + '.' : 'No new party.'],
      ['What persists longer?', ch.kind === 'Retention' ? lab(ch.node) + ': ' + ch.from + ' → ' + ch.to + ' days.' : know.filter(function (id) { return EV.nodes[id].ret; }).map(function (id) { return lab(id) + ': ' + EV.nodes[id].ret[0]; }).join('; ') || 'Nothing recorded as longer.'],
      ['What inference becomes possible?', inf.length ? inf.map(lab).join(', ') : 'None appears in the graph yet. Whether the new receiver can infer more is UNKNOWN until its use is reviewed.'],
      ['What existing control no longer covers the flow?', ch.reviewed ? 'Reviewed: the change went through review.' : 'Unknown: the change has not been reviewed, so no control was checked against the new arrow.']
    ];
  }
  function changesReview(st) {
    var all = EV.changes.map(function (c) { return c.kind; }).concat(G.changes.map(function (c) { return c[1]; }));
    var ch = EV.changeById(st.ch) || EV.changes[0];
    return '<p>Privacy problems arrive as changes. Each of these starts a review.</p>' +
      '<section class="card" aria-labelledby="trH"><h3 id="trH">What triggers a review</h3><ul class="trg">' + TRIGGERS.map(function (t) { var n = all.filter(function (k) { return t[1].indexOf(k) >= 0; }).length; return '<li class="' + (n ? 'on' : '') + '"><b>' + esc(t[0]) + '</b><span>' + (n ? plural(n, 'change') + ' recorded' : 'none recorded since the last review') + '</span></li>'; }).join('') + '</ul></section>' +
      '<section class="card" aria-labelledby="dfH">' + band('syn', 'One synthetic morning, before and after each change.') + '<h3 id="dfH">Before and after</h3>' +
        seg('Change', 'ch', EV.changes.map(function (c) { return [c.id, c.title]; }), ch.id) +
        '<div class="m-ba"><div><span class="eyebrow">Before</span><p>' + esc(ch.before) + '</p></div><div><span class="eyebrow">After</span><p>' + esc(ch.after) + '</p></div></div>' +
        dl(diff(ch).map(function (r) { return [esc(r[0]), esc(r[1])]; })) +
        '<p class="small">' + esc(A.fmtDate(ch.date)) + ' · ' + (ch.reviewed ? 'reviewed' : 'not reviewed') + ' · <a href="#everyday?et=changes&e=' + ch.id + '">See it in the events graph →</a></p>' + readLink('changes') + '</section>';
  }
  function reviewsPage(st) {
    var rv = st.rv;
    return pgh('Reviews', 'Security, privacy, QA and data governance: four questions about the same arrows.', 'Review') + seg('Review', 'rv', RV_TABS, rv) +
      '<div class="rvb">' + (rv === 'lens' ? lensReview(st) : rv === 'qa' ? qaReview(st) : rv === 'gov' ? govReview(st) : rv === 'changes' ? changesReview(st) : A.featureReviews()) + '</div>';
  }
  function mountReviews(root) {
    mountLens(root);
    var s = $('#rvP', root); if (s) s.addEventListener('change', function () { A.focusNext('#rvP'); A.set({ rp: this.value }); });
    root.addEventListener('click', function (e) {
      var b = e.target.closest('[data-rv],[data-ra],[data-tt],[data-ov],[data-ch]'); if (!b) return;
      if (b.hasAttribute('data-rv')) { A.focusNext('[data-rv="' + b.getAttribute('data-rv') + '"]'); A.set({ rv: b.getAttribute('data-rv') }); }
      else if (b.hasAttribute('data-ra')) {
        var k = b.getAttribute('data-ra'), v = b.getAttribute('data-av'); if (RA[k] === v) delete RA[k]; else RA[k] = v;
        $$('[data-ra="' + k + '"]', root).forEach(function (x) { x.setAttribute('aria-checked', RA[k] === x.getAttribute('data-av')); });
        $('#rvo', root).innerHTML = reviewOutput();
      }
      else if (b.hasAttribute('data-tt')) { var t = b.getAttribute('data-tt'); A.focusNext(A.S().tt === t ? '[data-tt="' + t + '"]' : '#ttd'); A.set({ tt: A.S().tt === t ? '' : t }); }
      else if (b.hasAttribute('data-ov')) { A.focusNext('[data-ov="' + b.getAttribute('data-ov') + '"]'); A.set({ ov: b.getAttribute('data-ov') }); }
      else { A.focusNext('[data-ch="' + b.getAttribute('data-ch') + '"]'); A.set({ ch: b.getAttribute('data-ch') }); }
    });
  }

  /* ═══════════ EVERYDAY ARROWS — one morning, and many ecosystems ═══════════ */
  function connectCard(st) {
    if (st.et !== 'day' || st.e !== 'm8') return '';
    var away = EV.nodes.n_away, it = EV.nodes.n_itinerary, hw = EV.nodes.n_homework;
    return '<section class="card cnx" aria-labelledby="cnxH">' + band('syn', 'A synthetic privacy inference exercise.') + '<h2 id="cnxH">Ask AI about the flight</h2>' +
      chips([['Question'], ['Assistant'], ['Email / calendar'], ['Reservation'], [it.name]]) +
      (st.connect ? '<p class="cnx-j">' + esc(it.name) + ' joined with ' + esc((hw && hw.name || 'a likely home').toLowerCase()) + ' from the maps trace →</p><p class="cnx-r">' + A.tag('INFERENCE') + ' <b>' + esc(away.name) + '</b>: possible empty-home inference.</p><p class="nobody">Nobody asked that question.</p>' + phrase('combination') +
        '<button type="button" class="btn ghost" data-connect="0">Disconnect</button>'
        : '<button type="button" class="btn" data-connect="1">Connect to location history</button>') + readLink('join') + '</section>';
  }
  /* many ecosystems: the devices you chose, plus mail, payments and AI from other providers */
  function ecoTab(st) {
    var dv = st.dv || EV.dvDefault, d = EV.parseDv(dv), acc = EV.devAccounts(dv), K = EV.devKinds;
    var plat = function (i) { var o = K[i].opts.filter(function (x) { return x[0] === d[i][0]; })[0]; return o ? o[2] : ''; };
    var setup = K.map(function (k, i) { return [k.label, d[i][0] === 'none' ? null : d[i][1]]; }).filter(function (x) { return x[1]; }).concat([['Mail', 'another provider'], ['Payments', 'another provider'], ['AI assistant', 'another provider']]);
    var devs = K.filter(function (k, i) { return d[i][0] !== 'none'; }).map(function (k) { return k.label.toLowerCase(); });
    var samePhoneLaptop = plat(0) && plat(0) === plat(1);
    var J = [
      ['Email address', 'Every platform account, the mail provider, payments and the AI assistant', 'You sign up to each with it'],
      ['Browser account', 'The ' + devs.join(', ') + ', whichever platform each runs', 'A browser signed in on each device syncs history and passwords'],
      ['App account', 'Every device where the same app is installed', 'The app’s own account ID'],
      ['Phone-to-computer link', samePhoneLaptop ? 'Phone and laptop, through one platform account' : 'Phone and laptop, through a link app between two platforms', 'Messages, calls and photos pass between them'],
      ['Home IP / network', 'Every device on the home Wi-Fi', 'One address seen by every service at the same times'],
      ['Shared cloud account', 'Any device that uses the same cloud storage', 'One storage account across platforms'],
      ['Assistant access', 'Mail, calendar and files from several providers', 'The AI assistant is given access to each']
    ];
    return '<div class="eco2">' + band('syn', 'Architecture reasoning only. No real company is implied to perform these joins.') +
      '<div class="ecog"><div><h3>Your setup</h3><ul class="setup">' + setup.map(function (s) { return '<li><b>' + esc(s[0]) + '</b><span>' + esc(s[1]) + '</span></li>'; }).join('') + '</ul>' + A.devicesHTML('eco') + '</div>' +
      '<div><h3>Where the join moves</h3><p>' + plural(acc.length, 'platform account') + ', and none sees everything. These are seen everywhere:</p><ul class="joins">' + J.map(function (j) { return '<li><b>' + esc(j[0]) + '</b><span>joins: ' + esc(j[1]) + '</span><small>' + esc(j[2]) + '</small></li>'; }).join('') + '</ul>' +
      '<p class="keyline">' + esc(phraseText('mixing')) + '</p><p class="small">' + esc(phraseText('link')) + '</p>' +
      '<p><button type="button" class="btn ghost" data-goto="xplat">Follow it in the graph: devices across platforms →</button></p>' + readLink('devices') + '</div></div></div>';
  }
  function everydayPage(st) {
    return pgh('Everyday arrows', 'One morning, many arrows. Each ordinary action sets off the same chain: event → identifier → system → derived data → inference.', 'Everyday arrows') +
      '<p class="readx"><a href="' + ESSAY + '#everyday">Read “Everyday arrows” in the essay →</a> <span>Unlock, sign in, check email, search, directions, buy a coffee, share a file, ask the assistant.</span></p>' +
      connectCard(st) + (st.et === 'amb' ? '' : SX().dsBar(st) + '<p class="small" id="dsnote" aria-live="polite"></p>') + A.eventsLayer();
  }
  function mountEveryday(root) {
    A.mountEvents();
    if (A.S().et !== 'amb') { $$('.dsbar [data-ds]', root).forEach(function (b) { b.addEventListener('click', function () { A.focusNext('[data-ds="' + b.getAttribute('data-ds') + '"]'); A.set({ ds: b.getAttribute('data-ds') }); }); }); SX().highlightGraph(root, A.S()); }
    root.addEventListener('click', function (e) { var b = e.target.closest('[data-connect]'); if (b) { A.focusNext(b.getAttribute('data-connect') === '1' ? '.nobody' : '[data-connect]'); A.set({ connect: b.getAttribute('data-connect') === '1' }); } });
    var n = $('.nobody', root); if (n) n.setAttribute('tabindex', '-1');
  }

  /* ═══════════ EVIDENCE — the taxonomy, and documented claims ═══════════ */
  function evidenceLegend() {
    return '<div class="evlg" aria-label="Evidence labels">' + ['doc', 'set', 'lim', 'test', 'unk'].map(function (k) { return '<p>' + badge(k) + ' <span>' + esc(X.evidence[k].d) + '</span></p>'; }).join('') + '</div>';
  }
  function claimsPage(st) {
    var kind = st.ek || '', n = { doc: 0, set: 0, lim: 0, test: 0 }, rows = [];
    C.products.forEach(function (p) { p.cos.forEach(function (co) { lensOf(st).forEach(function (l) { claimsOf(p, co, l).forEach(function (it) { n[it[0]]++; if (!kind || it[0] === kind) rows.push([p, co, l, it]); }); }); }); });
    return band('doc') + lensBar(st) + seg('Kind', 'kind', [['', 'All']].concat(['doc', 'set', 'lim', 'test'].map(function (k) { return [k, X.evidence[k].t + ' (' + n[k] + ')']; })), kind) +
      C.products.map(function (p) { var r = rows.filter(function (x) { return x[0] === p; }); return r.length ? '<section class="card cg" aria-labelledby="cg-' + p.id + '"><h2 id="cg-' + p.id + '">' + esc(p.n) + ' <a class="small" href="#products?pr=' + p.id + '">open →</a></h2><ul class="cls">' + r.map(function (x) { return itemHTML(x[3]).replace('<div><b>', '<div><span class="small">' + esc(C.companies[x[1]]) + ' · ' + esc(X.lensShort[x[2]]) + '</span><br><b>'); }).join('') + '</ul></section>' : ''; }).join('');
  }

  /* ═══════════ the Command Center's own additions ═══════════ */
  /* Each finding gets the same six follow-ups; the text is per concern, written once. */
  var CN = {
    identity: ['A stable identity lets every system recognise the same person.', 'Scope identifiers per service; keep the stable ID inside the identity system.', 'Every identifier per service, with its scope.', 'devices', ['privacy', 1]],
    authentication: ['Sign-in decides who gets the whole account.', 'Phishing-resistant sign-in on every path, recovery included.', 'A test that a look-alike site, a stolen session and a replayed request all fail.', 'recovery', ['security', 0]],
    devicetrust: ['A compromised device sees everything the person does.', 'Bind sessions to the device; check again on new or second-hand devices.', 'A test on a reset device and a second-hand one.', 'recovery', ['security', 4]],
    recovery: ['Whoever can restore access is inside the boundary.', 'Recover with another enrolled device or a recovery key, not SMS.', 'A walkthrough of every recovery path, fallbacks included.', 'recovery', ['security', 2]],
    takeover: ['One account can open a person’s mail, browser and wallet at once.', 'Device-bound sessions, extension review, no SMS fallback.', 'A takeover drill for each attacker path.', 'recovery', ['qa', 2]],
    linkability: ['A shared identifier lets separate activity be joined.', 'Scope or rotate the identifier, and gate the joins.', 'Identifier values collected across sites, sessions and days.', 'join', ['privacy', 1]],
    tracking: ['Third parties on the page learn what the person reads.', 'Block or partition third-party requests by default.', 'A request log of every third party on a test page.', 'metadata', ['privacy', 0]],
    disclosure: ['Revealing the record when an attribute would do over-shares.', 'Prove the attribute instead of sending the document.', 'What the verifier receives and keeps, captured.', 'lenses', ['privacy', 4]],
    consent: ['Consent is distributed state: each consumer holds a copy that can lag.', 'Check consent when a job reads data; get an acknowledgement from each consumer.', 'A revocation test across every consumer, work in flight included.', 'consent', ['qa', 4]],
    purpose: ['Data collected for one purpose drifts into others.', 'Bind each use to a purpose, and review purpose changes.', 'The purpose of each arrow, and who approved each change.', 'changes', ['gov', 6]],
    minimization: ['What is not collected cannot leak, be joined or be compelled.', 'Collect the derived signal, not the raw data.', 'A field-by-field list: needed, useful or optional.', 'lenses', ['privacy', 0]],
    ondevice: ['What leaves the device can be seen, kept and joined elsewhere.', 'Compute on the device where it can be.', 'A capture of what leaves the device for each feature.', 'agent', ['privacy', 0]],
    thirdmodel: ['A third-party model adds a receiver with its own retention.', 'Route to the fewest parties; settle training and retention in the contract.', 'Where each request was routed, and the provider’s retention.', 'agent', ['privacy', 3]],
    inference: ['The combination is the inference: nobody stored the conclusion.', 'Restrict cross-domain joins; review inferences, not only tables.', 'The questions the inference answered, asked again after the join is cut.', 'join', ['privacy', 6]],
    agent: ['An agent can read, join, infer and act in one loop.', 'Purpose-scoped tools, a join policy, and human approval for consequential actions.', 'A planted-instruction test and an approval log.', 'agent', ['qa', 6]],
    access: ['Access wider than the purpose turns every user into an exposure.', 'Least privilege, reviewed.', 'An access review, with its date.', 'filtering', ['security', 6]],
    tenant: ['Filtering is not isolation: one missed filter shows another customer’s rows.', 'Keep the tenant boundary in the database, cache, export and browser.', 'A cross-tenant query through every path.', 'filtering', ['qa', 1]],
    retention: ['Every copy has a clock; a longer clock means more to leak and more to compel.', 'Set retention per copy, and enforce it.', 'Observed retention measured against the declared rule.', 'deletion', ['gov', 1]],
    deletion: ['Deletion has to follow every copy.', 'One orchestrated deletion, with an acknowledgement from each copy.', 'A canary deleted end to end, backups and derived data included.', 'deletion', ['qa', 3]],
    vendor: ['A vendor’s copy follows the vendor’s rules.', 'Send only the fields needed; require deletion acknowledgements.', 'The vendor’s acknowledgement, dated.', 'deletion', ['gov', 3]],
    logging: ['Logs copy identifiers into every system that reads them.', 'Redact when written; keep logs briefly.', 'A search of sample logs for personal identifiers.', 'tls', ['gov', 1]],
    recoverability: ['Recoverability is a design decision, fixed years ahead.', 'Decide what must still be possible before choosing the transformation.', 'A restore of an old record using the documented path.', 'hashing', ['qa', 5]],
    preservation: ['Preserved bytes are not necessarily preserved evidence.', 'Hold the keys, mappings, schemas and metadata with the data.', 'A test that the held record can be opened, read and traced.', 'hold', ['gov', 5]],
    keylifecycle: ['Key lifecycle can become data lifecycle.', 'Inventory keys with what each protects; check holds before destroying one.', 'A key inventory and destruction log, matched against holds.', 'hold', ['security', 1]]
  };
  function findingMore(f) {
    var c = f.c.filter(function (x) { return CN[x]; })[0], N = c && CN[c]; if (!N) return '';
    var edge = G.edges.filter(function (e) { return f.cite.indexOf(e[0]) >= 0 || f.cite.indexOf(e[2]) >= 0; })[0];
    var rq = X.review[N[4][0]][N[4][1]], cpt = X.concepts[N[3]];
    return '<details class="fx"><summary>Why it matters · what to do · evidence</summary>' + dl([['Why it matters', esc(N[0])], ['Mitigation', esc(N[1])], ['Evidence needed', esc(N[2])],
      ['Related arrow', edge ? esc(name(edge[0]) + ' → ' + name(edge[2])) : badge('unk') + ' No arrow recorded'], ['Related review question', lensChip(N[4][0]) + ' ' + esc(rq)],
      ['Essay context', '<a href="' + ESSAY + cpt.essay + '">' + esc(cpt.t) + ' →</a>']]) + '</details>';
  }
  /* findings under the four lenses: the rule is shown, never hidden */
  var GOV_C = { retention: 1, deletion: 1, recoverability: 1, preservation: 1, keylifecycle: 1, vendor: 1 };
  function lens4(f) {
    var s = {};
    if (f.l === 'security' || f.l === 'both') s.security = 1;
    if (f.l === 'privacy' || f.l === 'both') s.privacy = 1;
    if (f.k === 'CONTROL FAILURE' || f.k === 'UNKNOWN' || f.cite.some(function (c) { return /^c_/.test(c); })) s.qa = 1;
    if (f.c.some(function (c) { return GOV_C[c]; }) || f.cite.some(function (c) { return /^(k_|lh_)/.test(c); })) s.gov = 1;
    return s;
  }
  var LENS_RULE = { qa: 'QA findings: control failures, unknowns, and any finding that cites a control.', gov: 'Data governance findings: retention, deletion, vendors, recoverability, preservation and key lifecycle, and any finding that cites a key or a hold.' };
  var VIEW_CONCEPT = { whoknows: 'metadata', howlearn: 'metadata', prove: 'recovery', 'ctl-auth': 'recovery', takeover: 'recovery', match: 'hashing', recneeds: 'hashing', delete: 'deletion', live: 'deletion', 'ctl-tenant': 'filtering', access: 'filtering',
    join: 'join', know: 'join', infer: 'agent', agentdo: 'agent', routing: 'agent', 'ctl-agent': 'agent', hold: 'hold', holdworked: 'hold', recover: 'hold', keygone: 'hold', 'ctl-keydestroy': 'hold', consent: 'consent', linkid: 'devices',
    changed: 'changes', where: 'tls', boundary: 'tls', purpose: 'lenses', 'ctl-mail': 'metadata', 'ctl-link': 'metadata' };
  function viewRead(view) { return readLink(VIEW_CONCEPT[view.key] || (view.kind === 'control' ? 'verify' : '')); }

  /* ═══════════ ASK PRIVACY — the questions both properties answer ═══════════ */
  function dayIds() {
    var set = EV.compose(EV.day), use = {};
    set.edges.forEach(function (e) { if (EV.nodes[e.a] && EV.nodes[e.a].kind === 'id') Object.keys(e.evs).forEach(function (ev) { (use[e.a] = use[e.a] || {})[ev] = 1; }); });
    return Object.keys(use).map(function (id) { return [id, Object.keys(use[id]).length]; }).filter(function (x) { return x[1] > 1; }).sort(function (a, b) { return b[1] - a[1]; });
  }
  function ask(q, k, a) { return { q: q, k: k, a: a }; }
  var ASK = [
    ask('What do we know about this person?', /know about (this|the) person/i, function () {
      var set = EV.compose(EV.day), d = set.order.filter(function (id) { return EV.nodes[id] && EV.nodes[id].kind === 'data'; }), inf = set.order.filter(function (id) { return EV.nodes[id] && EV.nodes[id].kind === 'inf'; });
      return [['FACT', 'One synthetic morning of eight events created ' + plural(d.length, 'record') + ': ' + d.map(function (id) { return EV.nodes[id].name; }).join(', ') + '.', []],
        ['INFERENCE', 'Joined, they suggest: ' + inf.map(function (id) { return EV.nodes[id].name.toLowerCase(); }).join('; ') + '. Nobody typed any of these in.', []],
        ['RECOMMENDATION', 'Follow each event in Everyday arrows and decide, connection by connection, whether to keep, scope, shorten or separate it.', []]];
    }),
    ask('Who can observe this request before it reaches the service?', /observe.*before|before it reaches/i, function () {
      return ['dns', 'network', 'tls', 'edge'].map(function (h) { return ['FACT', X.hops.filter(function (x) { return x[0] === h; })[0][1] + ': ' + HOPS[h].observe, []]; })
        .concat([['TEST', HOPS.tls.prove, []], ['RECOMMENDATION', 'Encrypted DNS and Encrypted Client Hello narrow the list; they move trust, they do not remove it.', []]]);
    }),
    ask('What survives after TLS terminates?', /tls terminat|after tls|survives.*tls/i, function () {
      var R = X.tlsReach, seen = R.rows.filter(function (r) { return r[2] === 'Visible'; }).map(function (r) { return r[0].toLowerCase(); });
      return [['FACT', 'Whoever terminates TLS sees ' + seen.join(', ') + '.', []], ['FACT', HOPS.tls.stops, []], ['TEST', HOPS.tls.prove, []], ['RECOMMENDATION', 'Redact URLs and headers before they are logged; keep raw logs briefly.', ['c_url_redact']]];
    }),
    ask('Which identifiers link these events?', /identifiers? link/i, function () {
      var ids = dayIds();
      return [['FACT', ids.map(function (x) { return EV.nodes[x[0]].name + ' appears in ' + x[1] + ' of the morning’s events'; }).join('; ') + '.', []],
        ['INFERENCE', 'Any service that receives one of these can recognise the same person across those events.', []], ['RECOMMENDATION', 'Scope the identifier each service receives, so two services can no longer recognise the same person.', []]];
    }),
    ask('What inference does this join create?', /inference does this join|join create/i, function () {
      var a = EV.nodes.n_away;
      return [['INFERENCE', a.name + ', from ' + a.needs.map(function (x) { return EV.nodes[x].name.toLowerCase(); }).join(' and ') + '. Nobody asked that question.', []], ['RECOMMENDATION', 'Separate the contexts, or shorten the location history so the likely home never forms.', []]];
    }),
    ask('What happens when consent is revoked?', /consent is revoked|when consent/i, function () { return A.answer('Which systems still use this user after consent revocation?').lines.concat([['RECOMMENDATION', phraseText('consent') + ' Check consent when a job reads data, and require an acknowledgement from each consumer.', ['c_consent_read']]]); }),
    ask('Can this data actually be deleted?', /actually be deleted|can (this|it) be deleted/i, function () {
      var D = G.deletion, f = D.filter(function (x) { return x.st === 'fail'; }), u = D.filter(function (x) { return x.st === 'unk'; });
      return [['FACT', 'Deletion reached ' + D.filter(function (x) { return x.st === 'ok'; }).length + ' of ' + D.length + ' copies; it missed ' + f.map(function (x) { return x.n; }).join(', ') + '.', f.map(function (x) { return x.node; })]]
        .concat(u.length ? [['UNKNOWN', u.map(function (x) { return x.n + ': ' + x.ev; }).join('; '), u.map(function (x) { return x.node; })]] : []).concat([['RECOMMENDATION', phraseText('deletion'), ['c_delete_orch']]]);
    }),
    ask('Can this archive still be recovered?', /archive (still )?be recovered/i, function () { return A.answer('Can this five-year-old archive actually be restored?').lines; }),
    ask('Can this hash be reversed?', /hash be reversed|reverse (a|the|this) hash/i, function () {
      return [['FACT', 'No. A hash has no key and nothing to decrypt.', ['id_hash']], ['INFERENCE', 'A known candidate can be hashed the same way and compared: one-way does not necessarily mean unlinkable.', ['id_hash']], ['TEST', 'Hash a list of likely values with the same algorithm and rule, and count the matches.', []]];
    }),
    ask('Can this pseudonym still be matched?', /pseudonym (still )?be matched/i, function () {
      var K = G.keys.k_pseudo;
      return [['FACT', name('k_pseudo') + ' is ' + K.status + (K.destroyed ? ', destroyed on ' + K.destroyed : '') + '.', ['k_pseudo']], ['FACT', 'A match also needs the normalisation rule (' + name('nr_v3') + ') and the algorithm version.', ['nr_v3']],
        ['INFERENCE', 'While all three survive, a known candidate can be pseudonymised again and matched to old records.', []], ['RECOMMENDATION', phraseText('keylife') + ' Check holds before destroying the key.', ['c_key_inventory']]];
    }),
    ask('What is under preservation hold?', /preservation hold/i, function () { return A.answer('Which records are currently under legal hold?').lines; }),
    ask('Which control stops being true at the next layer?', /next layer|stops being true/i, function () {
      return ['tls', 'db', 'export'].map(function (h) { return ['FACT', HOPS[h].holds + ' ' + HOPS[h].stops, []]; }).concat([['RECOMMENDATION', phraseText('boundary') + ' Follow the data across the boundary and prove the control on the other side.', []]]);
    }),
    ask('What changed since the previous review?', /changed since|previous review|last review/i, function () {
      var e = EV.changes.filter(function (c) { return !c.reviewed; });
      return [['FACT', plural(G.changes.length + EV.changes.length, 'change') + ' since the ' + G.lastReview + ' review.', []], ['UNKNOWN', plural(e.length, 'change') + ' in the synthetic morning never went through review: ' + e.map(function (c) { return c.title.toLowerCase(); }).join('; ') + '.', []],
        ['RECOMMENDATION', 'Review each change: what new thing becomes knowable, who sees it, what persists longer, what can now be inferred.', []]];
    }),
    ask('What evidence proves this claim?', /evidence proves|proves this claim/i, function () {
      var P = C.products[1], n = { doc: [], set: [], lim: [], test: [] };
      P.cos.forEach(function (co) { LENS_IDS.forEach(function (l) { claimsOf(P, co, l).forEach(function (it) { n[it[0]].push(C.companies[co] + ': ' + it[1]); }); }); });
      return [['DOCUMENTED', P.n + ': ' + n.doc.length + ' documented claims, each citing the company’s own page. For example, ' + n.doc[0] + '.', []], ['SETTING', n.set.length + ' depend on a setting. For example, ' + (n.set[0] || 'none') + '.', []],
        ['LIMIT', n.lim.length + ' are limits the companies document. For example, ' + (n.lim[0] || 'none') + '.', []], ['TEST', n.test.length + ' are tests the essay recommends. None has been run.', []],
        ['UNKNOWN', 'Whether each claim holds in the default state is unknown until a test is run.', []]];
    }),
    ask('What tools can this AI agent call?', /tools can|agent call/i, function () {
      return [['FACT', G.privileges.map(function (p) { return p[0] + ' (' + p[1].toLowerCase() + '; ' + p[2].toLowerCase() + ')'; }).join('; ') + '.', ['ag_assist']], ['CONTROL FAILURE', G.privileges.filter(function (p) { return p[4] === 'fail'; }).map(function (p) { return p[0]; }).join(', ') + ': no approval and no data scope.', ['c_agent_approval']],
        ['RECOMMENDATION', 'Scope each tool to the task’s purpose and require approval for consequential actions.', ['c_agent_policy']]];
    }),
    ask('What can the agent infer by combining them?', /infer by combining|combining them/i, function () {
      return [['FACT', 'It read ' + AG.used.map(function (u) { return u[0].toLowerCase() + ' (' + u[2] + ')'; }).join('; ') + '.', ['ag_assist']], ['INFERENCE', AG.inference + ' No source stores that fact.', AG.infNodes],
        ['RECOMMENDATION', phraseText('authorised') + ' Restrict cross-domain joins and review the inference, not only the inputs.', ['c_join_policy']]];
    })
  ];

  /* ═══════════ routing ═══════════ */
  /* Sensors & wearables (sensors.js) shares these helpers, and is created once, on first use */
  var sx = null;
  function SX() { return sx || (sx = window.PCC_SENSORS(A, { band: band, readLink: readLink, seg: seg, dl: dl, badge: badge, phrase: phrase, phraseText: phraseText, pgh: pgh, qst: qst, chips: chips })); }
  var DEFS = { pr: 'passkeys', co: '', fa: false, hop: 'dns', tf: 'encrypt', goal: '', am: 'runtime', rk: '', rv: 'lens', rp: '', tt: '', ov: 'owner', ch: '', connect: false, ek: '' };
  function parseInto(q, st) {
    if (byId(C.products, q.pr)) st.pr = q.pr;
    if (q.co && C.companies[q.co]) st.co = q.co;
    st.fa = q.fa === '1';
    if (HOPS[q.hop]) st.hop = q.hop;
    if (TF_TABS.some(function (x) { return x[0] === q.tf; })) st.tf = q.tf;
    if (GOALS.some(function (x) { return x[0] === q.goal; })) st.goal = q.goal;
    if (AM_TABS.some(function (x) { return x[0] === q.am; })) st.am = q.am;
    if (RISKS.some(function (x) { return x[0] === q.rk; })) st.rk = q.rk;
    if (RV_TABS.some(function (x) { return x[0] === q.rv; })) st.rv = q.rv;
    if (byId(C.products, q.rp)) st.rp = q.rp;
    if (ttOf(q.tt)) st.tt = q.tt;
    if (OV.some(function (x) { return x[0] === q.ov; })) st.ov = q.ov;
    if (EV.changeById(q.ch)) st.ch = q.ch;
    if (X.evidence[q.ek] && q.ek !== 'unk') st.ek = q.ek;
    st.connect = q.connect === '1';
    var V = SX().valid;
    for (var k in V) if (V[k].indexOf(q[k]) >= 0) st[k] = q[k];
    st.by = q.by === '1';
    return st;
  }
  function hashOf(st) {
    var o = [], put = function (k, v, d) { if (v !== d && v !== '' && v !== false) o.push(k + '=' + (v === true ? '1' : encodeURIComponent(v))); };
    if (st.page === 'products') { put('pr', st.pr, DEFS.pr); put('co', st.co, ''); put('fa', st.fa, false); }
    if (st.page === 'layers') put('hop', st.hop, DEFS.hop);
    if (st.page === 'future') { put('tf', st.tf, DEFS.tf); put('goal', st.goal, ''); }
    if (st.page === 'ai') { put('am', st.am, DEFS.am); put('rk', st.rk, ''); }
    if (st.page === 'reviews') { put('rv', st.rv, DEFS.rv); put('rp', st.rp, ''); put('tt', st.tt, ''); put('ov', st.ov, DEFS.ov); put('ch', st.ch, ''); }
    if (st.page === 'everyday') { put('connect', st.connect, false); put('ds', st.ds, 'everyone'); put('by', st.by, false); }
    if (st.page === 'sensors') { var D = SX().defs; ['sm', 'ds', 'sf', 'alt', 'hop2', 'aw', 'dev'].forEach(function (k) { put(k, st[k], D[k]); }); }
    if (st.page === 'evidence') put('ek', st.ek, '');
    return o.join('&');
  }
  /* the essay links with ?view=…; turn that into the Command Center's own route */
  var LENS_ALIAS = { all: 'all', security: 'security', sec: 'security', privacy: 'privacy', pri: 'privacy', qa: 'qa', gov: 'gov', governance: 'gov', 'data-governance': 'gov' };
  function fromView(p) {
    var v = p.view, l = LENS_ALIAS[p.lens] ? '&l=' + LENS_ALIAS[p.lens] : '';
    if (v === 'product') return '#products?pr=' + (byId(C.products, p.product) ? p.product : 'passkeys') + (p.company && C.companies[p.company] ? '&co=' + p.company : '') + l;
    if (v === 'layers') return '#layers' + (HOPS[p.hop] ? '?hop=' + p.hop : '');
    if ((v === 'journey' || v === 'everyday') && p.mode === 'ambient') return '#everyday?et=amb' + (p.bystanders ? '&by=1' : '');
    if (v === 'sensors' || v === 'wearable' || v === 'ambient') return '#sensors' + (X.sensorModes[p.mode] ? '?sm=' + X.sensorModes[p.mode] : '');
    if (v === 'journey' || v === 'everyday') { var e = X.slugs[p.event] || (/^m[1-8]$/.test(p.event || '') ? p.event : ''); return '#everyday' + (e ? '?e=' + e + (p.connect ? '&connect=1' : '') : ''); }
    if (v === 'ecosystems') return '#everyday?et=eco';
    if (v === 'future') return '#future' + (X.futureModes[p.mode] ? '?tf=' + X.futureModes[p.mode] : '');
    if (v === 'review') return '#reviews?rv=' + (RV_TABS.some(function (x) { return x[0] === p.mode; }) ? p.mode : 'lens') + l;
    if (v === 'ai') return '#ai' + (p.mode && p.mode !== 'agent' && AM_TABS.some(function (x) { return x[0] === p.mode; }) ? '?am=' + p.mode : '');
    if (v === 'evidence') return '#evidence';
    if (v === 'ask') return '#ask' + (p.q ? '?ask=' + encodeURIComponent(p.q) : '');
    return '#cc';
  }

  return {
    pages: {
      products: { render: productsPage, mount: mountProducts },
      everyday: { render: everydayPage, mount: mountEveryday },
      layers: { render: layersPage, mount: mountLayers },
      future: { render: futurePage, mount: mountFuture },
      ai: { render: aiPage, mount: mountAi },
      reviews: { render: reviewsPage, mount: mountReviews },
      sensors: { render: function (st) { return SX().page.render(st); }, mount: function (root) { SX().page.mount(root); } }
    },
    defs: (function () { var o = {}, k, D = SX().defs; for (k in DEFS) o[k] = DEFS[k]; for (k in D) o[k] = D[k]; return o; })(),
    ambTab: function (st) { return SX().ambTab(st); }, mountAmb: function (root) { SX().mountAmb(root); }, parseInto: parseInto, hashOf: hashOf, fromView: fromView,
    lens4: lens4, lensRule: LENS_RULE, lensQ: LENS_Q, lensBar: lensBar, mountLens: mountLens,
    findingMore: findingMore, viewRead: viewRead, readLink: readLink, band: band, badge: badge,
    ecoTab: ecoTab, evidenceLegend: evidenceLegend, claimsPage: claimsPage, ask: ASK.concat(SX().ask),
    hops: HOPS, trans: TRANS, tests: TT, risks: RISKS
  };
};
