/* Every Arrow Is a Decision ↔ Privacy Command Center — the one privacy model.
 *
 * Two properties, one model. The essay explains the arrows; the Command Center
 * lets you follow them. This file is what both of them agree on, written once:
 *
 *   entities, relations, attrs   the canonical model every arrow is drawn in
 *   evidence                     the evidence labels (the essay's four, plus UNKNOWN)
 *   phrases                      the shared vocabulary, each with where the essay
 *                                explains it and where the Command Center shows it
 *   review                       the essay's review questions (seven per lens, plus the ambient ones), word for word
 *   products                     per product: the arrow to watch (from EA_CMP), the
 *                                "Try this" line, and the synthetic Northstar preset
 *   sections                     essay section → the Command Center view to try it in
 *   concepts                     Command Center concept → the essay's explanation
 *   hops                         every layer, person to archive
 *   sync, syncAmbient            twenty questions both properties must answer, and twenty more for
 *                                devices that sense a room
 *
 * The lens titles and questions, and every vendor claim, stay in compare.js
 * (EA_CMP); this file never restates a claim. Tests:
 *   articles/every-arrow/tests/edition4.mjs   essay side (anchors, phrases, the kit)
 *   privacy-command-center/tests/sync.test.mjs app side (routes render, phrases show)
 */
(function (root) {
  var ESSAY = '/articles/every-arrow-is-a-decision.html';
  var APP = '/privacy-command-center/';

  var X = root.EA_SHARED = {
    essay: ESSAY,
    app: APP,

    /* The essay's lens ids (compare.js) and the Command Center's, side by side. */
    lensIds: { sec: 'security', pri: 'privacy', qa: 'qa', gov: 'gov' },
    lensShort: { all: 'All four', security: 'Security', privacy: 'Privacy', qa: 'QA', gov: 'Data governance' },

    /* ── the canonical model ─────────────────────────────────── */
    entities: [
      ['person', 'Person', 'Someone the data is about.'],
      ['event', 'Event', 'Something the person did: unlock, search, pay, ask.'],
      ['device', 'Device', 'The phone, laptop, tablet, speaker or car the event happened on.'],
      ['identifier', 'Identifier', 'What lets a system recognise the same person again.'],
      ['account', 'Account', 'The sign-in that ties identifiers and devices together.'],
      ['product', 'Product', 'What the person thinks they are using.'],
      ['system', 'System', 'Where the event lands and is processed.'],
      ['service', 'Service', 'One function inside a system: maps, mail, search, assistant.'],
      ['dataset', 'Dataset', 'A table, log, bucket or index that keeps what arrived.'],
      ['copy', 'Data copy', 'A cache, replica, backup, export, extract or feature table.'],
      ['derived', 'Derived data', 'Something computed from collected data: a route, a history, a segment.'],
      ['inference', 'Inference', 'A conclusion nobody typed in: home, commute, travel, hardship.'],
      ['purpose', 'Purpose', 'Why the arrow exists.'],
      ['vendor', 'Processor / vendor', 'Another organisation that receives the data.'],
      ['control', 'Control', 'What is meant to stop the wrong arrow.'],
      ['evidence', 'Evidence', 'What shows the control works: a test, a log, an audit.'],
      ['key', 'Key', 'What can turn ciphertext back into the original.'],
      ['transform', 'Transformation', 'Encrypted, tokenized, hashed, keyed, aggregated, deleted.'],
      ['tokenmap', 'Token mapping', 'The vault that can turn a token back into the value.'],
      ['archive', 'Archive', 'A copy kept for the long term.'],
      ['retention', 'Retention rule', 'How long each copy should live.'],
      ['hold', 'Legal / preservation hold', 'A requirement that suspends deletion for some records.'],
      ['model', 'AI model', 'The model that reads context and produces text or a decision.'],
      ['agent', 'AI agent', 'A loop that reads, calls tools, remembers and acts.'],
      ['tool', 'Tool', 'A capability the agent can call: mail, calendar, browser, payments.'],
      ['action', 'Action', 'What changes in the world: a booking, a message, a payment.'],
      /* ambient computing: the data subject may not be the user */
      ['sensor', 'Sensor', 'A microphone, camera, location, motion or proximity sensor.'],
      ['observation', 'Observation', 'What a sensor picked up: a frame, a sound, a position, a movement.'],
      ['owner', 'Device owner', 'The person who set the device up and chose its settings.'],
      ['subject', 'Data subject', 'The person the data is about. Not always the device owner.'],
      ['bystander', 'Bystander', 'Someone a device senses who never used it: a guest, a passer-by, an employee, a customer.']
    ],
    relations: [
      ['person', 'performs', 'event'], ['event', 'carries', 'identifier'], ['event', 'enters', 'system'],
      ['system', 'creates', 'dataset'], ['dataset', 'creates', 'copy'], ['dataset', 'joins', 'dataset'],
      ['join', 'creates', 'derived'], ['derived', 'enables', 'inference'], ['system', 'sends data to', 'vendor'],
      ['control', 'protects', 'relationship'], ['evidence', 'verifies', 'control'], ['key', 'enables', 'recovery'],
      ['transform', 'changes', 'recoverability'], ['hold', 'overrides', 'retention'],
      ['agent', 'reads', 'data'], ['agent', 'calls', 'tool'], ['tool', 'returns', 'data'],
      ['agent', 'creates', 'inference'], ['agent', 'takes', 'action'],
      ['owner', 'owns', 'device'], ['device', 'senses', 'room'], ['sensor', 'observes', 'subject'],
      ['observation', 'becomes', 'derived'], ['subject', 'may differ from', 'owner']
    ],
    /* what any arrow may carry; an arrow that cannot answer one shows UNKNOWN */
    attrs: [
      ['purpose', 'Purpose'], ['need', 'Required / useful / optional'], ['identifier', 'Identifier'], ['receiver', 'Receiver'],
      ['retention', 'Retention'], ['transform', 'Transformation'], ['key', 'Key dependency'], ['control', 'Control'],
      ['evidence', 'Evidence'], ['lens', 'Lens'], ['provider', 'Provider'], ['product', 'Product'], ['changed', 'Change date'], ['review', 'Review status'],
      ['subject', 'Data subject'], ['awareness', 'Owner and bystander awareness'], ['state', 'Sensed, transmitted, stored, derived or persisted']
    ],

    /* ── evidence: the essay's four labels, and UNKNOWN ──────────
     * A TEST is a recommendation. It is never shown as having been run. */
    evidence: {
      doc: { t: 'Documented', d: 'The company says so in its own documentation.' },
      set: { t: 'Setting', d: 'Behaviour depends on a setting or a user or admin choice; the default is stated when documented.' },
      lim: { t: 'Limit', d: 'A limitation, caveat or boundary the company itself documents.' },
      test: { t: 'Test', d: 'A verification a reviewer could run. A recommendation, not a result: nobody has run it for this.' },
      unk: { t: 'Unknown', d: 'The evidence reviewed does not establish the answer.' }
    },
    synthetic: 'Synthetic. No company implementation is implied.',

    /* ── the shared vocabulary ───────────────────────────────── */
    phrases: [
      { id: 'decision', t: 'Every arrow is a decision.', essay: '#lenses', app: '#cc' },
      { id: 'watch', t: 'The arrow to watch.', essay: '#compare', app: '#products' },
      { id: 'boundary', t: 'Every guarantee has a boundary.', essay: '#pt-boundary', app: '#layers' },
      { id: 'metadata', t: 'Metadata is data.', essay: '#pt-metadata', app: '#layers?hop=tls' },
      { id: 'filtering', t: 'Filtering is not isolation.', essay: '#ly-copies', app: '#layers?hop=db' },
      { id: 'consent', t: 'Consent is distributed state.', essay: '#ly-copies', app: '#reviews?rv=qa&tt=consent' },
      { id: 'deletion', t: 'Deletion has to follow every copy.', essay: '#pt-deletion', app: '#reviews?rv=gov' },
      { id: 'recoverability', t: 'Recoverability is a design decision.', essay: '#pt-recoverability', app: '#future' },
      { id: 'keylife', t: 'Key lifecycle can become data lifecycle.', essay: '#m-hmac', app: '#future?tf=hmac' },
      { id: 'link', t: 'The link moves; it does not disappear.', essay: '#pt-link', app: '#everyday?et=eco' },
      { id: 'combination', t: 'The combination is the inference.', essay: '#ev-join', app: '#everyday?e=m8&connect=1' },
      { id: 'authorised', t: 'Authorised inputs do not automatically create an authorised inference.', essay: '#ly-agent', app: '#ai' },
      { id: 'preserved', t: 'Preserved bytes are not necessarily preserved evidence.', essay: '#fu-hold', app: '#future?tf=hold' },
      { id: 'oneway', t: 'One-way does not necessarily mean unlinkable.', essay: '#m-hash', app: '#future?tf=hash' },
      { id: 'mixing', t: 'Mixing platforms moves the join; it does not remove it.', essay: '#ev-devices', app: '#everyday?et=eco' },
      /* ambient computing */
      { id: 'subject', t: 'The data subject may not be the user.', essay: '#wr-subject', app: '#sensors?sm=room' },
      { id: 'consentaware', t: 'Consent from the device owner is not the same thing as awareness by everyone the device can sense.', essay: '#wr-subject', app: '#sensors?sm=gap' },
      { id: 'sensing', t: 'Sensing is not the same as storing.', essay: '#wr-sensing', app: '#sensors?sm=cafe' },
      { id: 'derivative', t: 'Delete the source, check the derivative.', essay: '#vo-derived', app: '#sensors?sm=forget' },
      { id: 'everyderivative', t: 'Deletion has to follow every derivative, not only every copy.', essay: '#vo-derived', app: '#sensors?sm=forget' },
      { id: 'room', t: 'Ambient computing moves the privacy boundary into the room.', essay: '#pt-room', app: '#sensors?sm=room' },
      { id: 'falsepos', t: 'A false positive can be a privacy event.', essay: '#vo-false', app: '#sensors?sm=room' },
      { id: 'awareness', t: 'User awareness and bystander awareness are different controls.', essay: '#wr-gap', app: '#sensors?sm=gap' },
      { id: 'minimise', t: 'Minimisation can happen before storage — or before transmission.', essay: '#wr-cafe', app: '#sensors?sm=cafe' },
      { id: 'adversarial', t: 'The privacy model must include both intended and adversarial flows.', essay: '#wr-attack', app: '#sensors?sm=attack' },
      { id: 'onehome', t: 'The person lives in one home. The data lives in many ecosystems.', essay: '#ev-ambient', app: '#sensors?sm=home' },
      { id: 'samequestions', t: 'Different ecosystems. Different defaults. The same questions follow the data.', essay: '#patterns', app: '#sensors?sm=home' },
      /* item trackers */
      { id: 'carrier', t: 'A tag’s location is the location of whoever carries it.', essay: '#tr-subject', app: '#sensors?sm=tag' },
      { id: 'platform', t: 'Protection that depends on the platform protects only that platform.', essay: '#tr-alert', app: '#sensors?sm=tag' }
    ],

    /* ── the four-lens review: the essay's twenty-eight questions ──
     * Word for word with #kit-questions in the essay (a test compares them). */
    review: {
      security: [
        'What stops a look-alike site, a stolen session or a replayed request?',
        'Where does the key live, and what hardware protects it?',
        'Who can restore access when every device is lost, and how are guesses limited?',
        'What is sent before the person acts: before the wake word, before the tap, before opening?',
        'What happens on a compromised or second-hand device?',
        'If recovery is required, who controls the key or the mapping?',
        'Are the links kept for security (phone number, recovery email, devices, IP address) used for nothing else?',
        'Can an unauthorised person activate or access this sensor?',
        'Can a stolen session or device retrieve earlier captures?'
      ],
      privacy: [
        'What leaves the device, and could it have been computed on the device?',
        'Which identifier links this activity to other activity, and is it scoped?',
        'What metadata remains after the content is encrypted?',
        'Is it used for training, ads or personalisation, and what is the default?',
        'Could the purpose be met by proving an attribute instead of revealing the data?',
        'Should the original remain recoverable, or would a pseudonymous or irreversible representation meet the purpose?',
        'What can be inferred when this activity is joined with other activity, on this device and on the person’s other devices?',
        'Whose data is being sensed, and is that person the device owner?',
        'What incidental information enters the frame or the microphone?',
        'Can filtering or minimisation happen before transmission?',
        'Does a bystander understand that capture is happening?',
        'If it can locate an object, how is a person told that the object is travelling with them, and on which phones?'
      ],
      qa: [
        'What would an outsider need to verify the claim: source, logs, an audit, a research environment?',
        'Is the default state tested, not only the configured one?',
        'Is every fallback tested: to SMS, to an unencrypted channel, to a password?',
        'Is deletion tested end to end, including derived data and backups?',
        'Is the test re-run after every release and every policy change?',
        'Can we restore and interpret an old protected record using the documented recovery path?',
        'When a connection is scoped, shortened or separated, does the inference it enabled really stop?',
        'Does sensor activation match the indicator the person sees?',
        'Does a do-not-save setting prevent both raw and derived records from persisting?',
        'What happens during a false activation?',
        'Do the settings survive an update?',
        'Does the safeguard reach people who use a different platform from the owner?'
      ],
      gov: [
        'Who holds the key, and who could be compelled to use it?',
        'How long does each copy live: active, backup, reviewed, derived?',
        'Can the person export it, and in what format?',
        'Does deletion in one place reach every other place?',
        'Which controls can the vendor or a government withdraw, and who would be told?',
        'Does a preservation hold include the keys, mappings, schemas, metadata and derived copies needed to make the record meaningful?',
        'Which connections changed since the last review (a new receiver, identifier, processor, purpose or retention period), and did each go through review?',
        'What retention applies to raw media, and what to transcripts and derivatives?',
        'Can the device owner delete data about another person?',
        'What can a non-user whose data was captured do about it?',
        'What happens to captures and derivatives when the account is deleted?'
      ]
    },

    /* ── products: the essay's, in its order ───────────────────
     * `try` is the one line the essay ends the product with; `synth` opens the
     * matching view on SYNTHETIC Northstar data. The arrow, the arrow to watch
     * and every claim come from EA_CMP. */
    products: {
      passkeys: { try: 'Explore recovery and deletion.', synth: '#cc?p=reviewer&s=ident&j=signin&q=prove' },
      browser: { try: 'Follow a third-party request.', synth: '#cc?p=reviewer&s=web&j=browse&q=whoknows&l=privacy' },
      mail: { try: 'Fire a synthetic tracking pixel.', synth: '#cc?p=reviewer&s=mail&j=mail&q=whoknows&l=privacy' },
      messages: { try: 'Follow the backup key.', synth: '#future?tf=encrypt' },
      wallet: { try: 'Compare the token with the transaction context.', synth: '#cc?p=reviewer&s=pay&j=pay&q=provewithout' },
      backup: { try: 'Change who holds the key.', synth: '#cc?p=reviewer&s=cloud&j=delete&q=delete' },
      assistant: { try: 'Move processing between device, private cloud and a third party.', synth: '#cc?p=reviewer&s=ai&j=ai&q=leftdevice' },
      voice: { try: 'Follow the speaker to the cloud and the transcript.', synth: '#sensors?sm=room' },
      wearable: { try: 'Follow the glasses to the cloud, and the people in the frame.', synth: '#sensors?sm=cafe' },
      tracker: { try: 'Follow the tag to the owner’s map, and back to the person carrying it.', synth: '#sensors?sm=tag' }
    },

    /* ── essay → Command Center: one compact link per major section ── */
    sections: {
      lenses: { app: '?view=review&lens=all', t: 'Run the four-lens review interactively.' },
      future: { app: '?view=future&mode=hashing', t: 'Change encryption → hashing → tokenization and observe recoverability.' },
      everyday: { app: '?view=journey&event=bought-coffee', t: 'Follow the full morning.' },
      layers: { app: '?view=layers&hop=dns', t: 'Trace one request from DNS to the warehouse.' },
      patterns: { app: '?view=evidence', t: 'See each pattern as evidence: what is documented, what is a test, what is unknown.' },
      kit: { app: '?view=review&lens=qa', t: 'Run the review interactively.' },
      voice: { app: '?view=sensors&mode=room', t: 'Explore the room.' },
      wearable: { app: '?view=sensors&mode=cafe', t: 'Explore smart glasses in a café.' },
      tracker: { app: '?view=sensors&mode=tag', t: 'Follow a tag in someone else’s bag.' }
    },
    /* further links inside sections (checked like the ones above) */
    links: ['?view=journey&mode=ambient&bystanders=1', '?view=layers&hop=sensor'],

    /* ── Command Center → essay: short context and a deep link ── */
    concepts: {
      metadata: { t: 'Why metadata matters', essay: '#pt-metadata', line: 'The content can be sealed while the pattern around it stays readable.' },
      recovery: { t: 'Why the recovery path is a boundary', essay: '#pt-recovery', line: 'Whoever can restore the key is inside the boundary.' },
      hashing: { t: 'Why hashing is not encryption', essay: '#m-hash', line: 'There is no key and nothing to decrypt, but a known candidate can still be matched.' },
      deletion: { t: 'Why deletion is distributed', essay: '#pt-deletion', line: 'Every copy has its own clock, and deletion has to reach each one.' },
      filtering: { t: 'Why filtering is not isolation', essay: '#ly-copies', line: 'Row security protects the database; the cache, export and browser must keep the boundary too.' },
      join: { t: 'Why the join creates an inference', essay: '#ev-join', line: 'Ordinary signals become revealing when they are joined.' },
      tls: { t: 'Why TLS protects only one layer', essay: '#ly-tls', line: 'HTTPS hides the request from the network, not from whoever terminates TLS.' },
      hold: { t: 'Why legal preservation changes retention', essay: '#fu-hold', line: 'A valid hold suspends deletion, and must preserve what makes the record meaningful.' },
      agent: { t: 'Why AI agents change the control model', essay: '#ly-agent', line: 'Retrieved text is data and possible instructions at once, so the invariants live in the runtime.' },
      devices: { t: 'Why mixing platforms moves the join', essay: '#ev-devices', line: 'Whatever runs on every device can recognise the person everywhere.' },
      consent: { t: 'Why consent is distributed state', essay: '#ly-copies', line: 'Every consumer holds a copy of the consent, and a copy can lag behind.' },
      changes: { t: 'Why privacy problems arrive as changes', essay: '#ev-changes', line: 'Most arrows were not in the first design; each change deserves its own review.' },
      verify: { t: 'Why a claim you can verify is a control', essay: '#pt-verify', line: 'QA’s job is to turn each promise into a test someone can run.' },
      lenses: { t: 'Why four lenses', essay: '#lenses', line: 'Same data, a different question.' },
      subject: { t: 'Why the data subject may not be the user', essay: '#wr-subject', line: 'A sensor can create information about someone who never installed the app or read a setting.' },
      sensing: { t: 'Why sensing is different from storage', essay: '#wr-sensing', line: 'Inspecting for a moment, transforming on the device, sending and keeping are different decisions.' },
      bystander: { t: 'Why bystander awareness matters', essay: '#wr-gap', line: 'How obvious capture is to the person being captured is a property to evaluate, not assume.' },
      derivatives: { t: 'Why deleting raw data may leave derivatives', essay: '#vo-derived', line: 'A request becomes audio, a transcript, an intent and perhaps a derived fact, each with its own clock.' },
      tracker: { t: 'Why the alert is the only notice', essay: '#tr-alert', line: 'A tag in a bag cannot tell anyone it is there; the carrier’s own phone has to.' },
      room: { t: 'Why ambient computing changes the privacy boundary', essay: '#pt-room', line: 'The people nearby and the surroundings become part of the data flow.' },
      falsepos: { t: 'Why a false activation is a privacy event', essay: '#vo-false', line: 'Did audio leave the room when nobody meant to ask?' },
      cafe: { t: 'Why incidental data should be discarded early', essay: '#wr-cafe', line: 'Only the menu text was needed; the faces, the screen and the speech were incidental.' },
      attack: { t: 'Why the model includes adversarial flows', essay: '#wr-attack', line: 'An attacker is another path through the same system.' }
    },

    /* ── every layer, person to archive (the essay's §13 figure) ── */
    hops: [
      ['person', 'Person'], ['sensor', 'Sensor'], ['device', 'Device'], ['browser', 'Browser'], ['dns', 'DNS'], ['network', 'Network'], ['tls', 'TLS'],
      ['http', 'HTTP / API'], ['edge', 'Edge'], ['service', 'Service'], ['cache', 'Cache'], ['db', 'Database'], ['log', 'Log / event'],
      ['lake', 'Data lake / warehouse'], ['analytics', 'Analytics / ML'], ['ai', 'AI'], ['export', 'Export / vendor'], ['archive', 'Archive / delete']
    ],
    /* who can read what once HTTPS is on: the essay's #fig-https-reach, cell for cell */
    tlsReach: {
      cols: ['The network path', 'Whoever terminates TLS', 'The application'],
      rows: [
        ['Destination address', 'Visible', 'Visible', 'Visible'],
        ['Hostname', 'Visible unless Encrypted Client Hello', 'Visible', 'Visible'],
        ['URL path and query', 'Hidden', 'Visible', 'Visible'],
        ['Headers, cookies, tokens', 'Hidden', 'Visible', 'Visible'],
        ['Request body', 'Hidden', 'Visible', 'Visible'],
        ['Sizes and timing', 'Visible', 'Visible', 'Visible']
      ]
    },
    hopQuestions: [
      ['moves', 'What data moves?', 'privacy'], ['observe', 'Who can observe it?', 'security'], ['ident', 'What identifies the person?', 'privacy'],
      ['persists', 'What persists?', 'gov'], ['combine', 'What can be combined later?', 'privacy'], ['prove', 'How would we prove the control works?', 'qa']
    ],

    /* ── twenty questions both properties must answer ──────────
     * essay: an anchor in the essay and words it must contain there;
     * app: a Command Center link and words the view must show. */
    sync: [
      { q: 'What are the four lenses?', essay: '#lenses', ek: 'Data governance', app: '#reviews?rv=lens', ak: 'Data governance' },
      { q: 'What is the arrow to watch?', essay: '#browser', ek: 'arrow to watch', app: '#products?pr=browser', ak: 'The arrow to watch' },
      { q: 'What data moves?', essay: '#layers', ek: 'What data moves?', app: '#layers?hop=http', ak: 'What data moves?' },
      { q: 'What identifies the person?', essay: '#everyday', ek: 'Identifiers', app: '#everyday?e=m5', ak: 'identif' },
      { q: 'What metadata survives?', essay: '#layers', ek: 'metadata', app: '#layers?hop=tls', ak: 'Metadata is data' },
      { q: 'What gets copied?', essay: '#ly-copies', ek: 'copy', app: '#reviews?rv=gov', ak: 'How many copies?' },
      { q: 'What gets joined?', essay: '#everyday', ek: 'Joined', app: '#everyday?e=m8&connect=1', ak: 'joined' },
      { q: 'What inference appears?', essay: '#everyday', ek: 'Inferred', app: '#everyday?e=m8&connect=1', ak: 'Nobody asked that question' },
      { q: 'What is the purpose?', essay: '#ev-why', ek: 'what it is for', app: '#products?pr=mail&fa=1', ak: 'Purpose' },
      { q: 'What is the retention period?', essay: '#future', ek: 'retention', app: '#reviews?rv=gov', ak: 'How long?' },
      { q: 'Who holds the key?', essay: '#backup', ek: 'key', app: '#future?tf=encrypt', ak: 'Who can recover the original?' },
      { q: 'Is the data recoverable?', essay: '#future', ek: 'recover', app: '#future?tf=hash', ak: 'Reversible' },
      { q: 'What happens under preservation hold?', essay: '#fu-hold', ek: 'hold', app: '#future?tf=hold', ak: 'Preserved bytes are not necessarily preserved evidence' },
      { q: 'Does deletion reach every copy?', essay: '#pt-deletion', ek: 'every copy', app: '#reviews?rv=gov', ak: 'Does deletion propagate?' },
      { q: 'What happens at the next technical layer?', essay: '#layers', ek: 'next layer', app: '#layers?hop=tls', ak: 'Where the guarantee stops' },
      { q: 'What changes across devices and ecosystems?', essay: '#ev-devices', ek: 'device', app: '#everyday?et=eco', ak: 'Mixing platforms moves the join' },
      { q: 'What can an AI agent retrieve, infer and do?', essay: '#ly-agent', ek: 'agent', app: '#ai', ak: 'Authorised inputs do not automatically create an authorised inference' },
      { q: 'What control applies?', essay: '#layers', ek: 'control', app: '#layers?hop=log', ak: 'Control' },
      { q: 'What evidence proves that control?', essay: '#pt-verify', ek: 'test', app: '#evidence', ak: 'Last test' },
      { q: 'What changed since the previous review?', essay: '#ev-changes', ek: 'change', app: '#reviews?rv=changes', ak: 'What new thing becomes knowable?' }
    ],
    /* twenty more, for devices that sense a room: the data subject may not be the user */
    syncAmbient: [
      { q: 'Who owns the device?', essay: '#wr-subject', ek: 'own the device', app: '#sensors?sm=room', ak: 'Device owner' },
      { q: 'Who is the data subject?', essay: '#wr-subject', ek: 'whose privacy', app: '#sensors?sm=room', ak: 'Data subject' },
      { q: 'What sensor observed the information?', essay: '#wr-sensing', ek: 'microphone', app: '#sensors?sm=cafe', ak: 'Camera' },
      { q: 'Was the information required or incidental?', essay: '#wr-cafe', ek: 'incidental', app: '#sensors?sm=cafe', ak: 'Incidental' },
      { q: 'Did it stay on the device?', essay: '#wr-sensing', ek: 'ephemeral on the device', app: '#sensors?sm=cafe&alt=D', ak: 'Ephemeral on device' },
      { q: 'Did it leave the device?', essay: '#vo-room', ek: 'leaves the device', app: '#sensors?sm=cafe&alt=A', ak: 'Transmitted' },
      { q: 'Was raw data sent, or a derived signal?', essay: '#wr-cafe', ek: 'send only the text', app: '#sensors?sm=cafe&alt=C', ak: 'Derived only' },
      { q: 'Was it stored?', essay: '#vo-room', ek: 'what is stored', app: '#sensors?sm=room', ak: 'Stored' },
      { q: 'Was a transcript or derivative created?', essay: '#vo-derived', ek: 'transcript', app: '#sensors?sm=forget', ak: 'Transcript' },
      { q: 'What identifier was attached?', essay: '#ev-ambient', ek: 'identifier', app: '#everyday?et=amb', ak: 'Identifier' },
      { q: 'What can be inferred?', essay: '#vo-derived', ek: 'could be derived', app: '#everyday?et=amb', ak: 'Inference' },
      { q: 'Who else was present?', essay: '#ev-ambient', ek: 'delivery driver', app: '#everyday?et=amb&by=1', ak: 'Delivery driver' },
      { q: 'Was capture or processing visible?', essay: '#wr-gap', ek: 'visible', app: '#sensors?sm=gap', ak: 'Bystander awareness' },
      { q: 'What setting controls it?', essay: '#wearable', ek: 'setting', app: '#products?pr=wearable', ak: 'Setting' },
      { q: 'What happens after deletion?', essay: '#vo-derived', ek: 'deleting the recording', app: '#sensors?sm=forget', ak: 'What exactly did delete mean?' },
      { q: 'What happens after an update?', essay: '#kit', ek: 'survive an update', app: '#reviews?rv=qa&tt=update', ak: 'after an update' },
      { q: 'What happens under attack?', essay: '#wr-attack', ek: 'malicious app', app: '#sensors?sm=attack', ak: 'Malicious app' },
      { q: 'What test would prove the claim?', essay: '#vo-false', ek: 'synthetic audio', app: '#sensors?sm=room', ak: 'False activation test' },
      { q: 'What is documented?', essay: '#wearable', ek: 'capture light', app: '#products?pr=wearable', ak: 'Documented' },
      { q: 'What is unknown?', essay: '#method', ek: 'wake-word detection', app: '#products?pr=wearable&fa=1', ak: 'Unknown' }
    ]
  };

  /* `?view=` deep links (the form the essay uses) → the Command Center's own routes */
  X.slugs = { 'unlock': 'm1', 'sign-in': 'm2', 'check-email': 'm3', 'search-coffee': 'm4', 'directions': 'm5', 'bought-coffee': 'm6', 'share-file': 'm7', 'ask-flight': 'm8' };
  X.sensorModes = { cafe: 'cafe', saw: 'cafe', room: 'room', dinner: 'room', forget: 'forget', deletion: 'forget', gap: 'gap', bystanders: 'gap', attack: 'attack', adversary: 'attack', home: 'home', tag: 'tag', tracker: 'tag' };
  X.futureModes = { encryption: 'encrypt', tokenization: 'token', hashing: 'hash', hmac: 'hmac', pseudonym: 'hmac', hold: 'hold', archive: 'hold' };
})(typeof window !== 'undefined' ? window : globalThis);
