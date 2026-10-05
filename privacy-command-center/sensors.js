/* Privacy Command Center v1 — Sensors & wearables: the data subject may not be the user.
 *
 * Ambient computing starts arrows nobody clicked: a microphone hearing a room, a
 * camera seeing a scene, a wearable observing whoever is nearby. Everything here is
 * SYNTHETIC architecture reasoning: it names device kinds ("Echo-like"), never how a
 * real product works. Vendor claims appear only where they are cited, from
 * /articles/every-arrow/compare.js, under the DOCUMENTED band.
 *
 * Six views (#sensors?sm=…): cafe (what the device saw; the flagship), room (the
 * dinner table, the room hop by hop, the false-activation test), forget (the device
 * that did not forget), gap (the bystander gap and awareness), attack (intended and
 * adversarial flows), home (one home, many ecosystems). Plus the ambient morning on
 * Everyday arrows, the "Whose data?" selector (ds) and Ask privacy questions.
 *
 * Sensed is not collected: every observation carries a state — ephemeral on device,
 * transmitted, stored, derived only, persisted or unknown — and a test is never
 * shown as having been run. modes.js calls window.PCC_SENSORS(api, helpers). */
window.PCC_SENSORS = function (A, H) {
  'use strict';
  var G = A.G, EV = A.EV, X = window.EA_SHARED, C = window.EA_CMP, esc = A.esc, $ = A.$, $$ = A.$$, plural = A.plural;
  var band = H.band, readLink = H.readLink, seg = H.seg, dl = H.dl, badge = H.badge, phrase = H.phrase, phraseText = H.phraseText, pgh = H.pgh, qst = H.qst, chips = H.chips;

  /* ── whose data? ─────────────────────────────────────────── */
  var DS = [['everyone', 'Everyone'], ['me', 'Me'], ['household', 'Household'], ['contacts', 'Contacts'], ['bystanders', 'Bystanders'], ['children', 'Children'], ['employees', 'Employees']];
  var SUBJ = { owner: 'Device owner', household: 'Household member', child: 'Child', guest: 'Guest', passer: 'Passer-by', employee: 'Employee', customer: 'Customer', stranger: 'Stranger', contact: 'Contact', none: 'Nobody (an object)' };
  var GROUP = { me: ['owner'], household: ['household', 'child'], contacts: ['contact'], bystanders: ['guest', 'passer', 'employee', 'customer', 'stranger'], children: ['child'], employees: ['employee'] };
  function inGroup(ds, subj) { return ds === 'everyone' ? subj !== 'none' : (GROUP[ds] || []).indexOf(subj) >= 0; }
  function dsBar(st) {
    return '<div class="dsbar"><span class="eyebrow">Whose data?</span>' + seg('Data subject', 'ds', DS, st.ds) +
      '<p class="small">' + (st.ds === 'everyone' ? 'Every person the flow touches. Pick a group to highlight the flows about them.' : 'Highlighted: flows about ' + esc(DS.filter(function (d) { return d[0] === st.ds; })[0][1].toLowerCase()) + '.') + '</p></div>';
  }
  function mountDs(root) { $$('[data-ds]', root).forEach(function (b) { b.addEventListener('click', function () { A.focusNext('[data-ds="' + b.getAttribute('data-ds') + '"]'); A.set({ ds: b.getAttribute('data-ds') }); }); }); }

  /* sensed is not collected: the states an observation can be in */
  var STATE = { eph: 'Ephemeral on device', tx: 'Transmitted', st: 'Stored', der: 'Derived only', per: 'Persisted', unk: 'Unknown' };
  function stateTag(k) { return '<span class="ss ss-' + k + '">' + esc(STATE[k]) + '</span>'; }
  var AWARE = { clear: 'Clear', partial: 'Partial', unclear: 'Unclear', na: 'Not applicable', unk: 'Unknown' };
  function awareTag(k) { return '<span class="aw aw-' + k + '">' + esc(AWARE[k]) + '</span>'; }

  /* ═══════════ 1 · WHAT THE DEVICE SAW — smart glasses in a café ═══════════ */
  var SENSORS = [['', 'All sensors'], ['camera', 'Camera'], ['mic', 'Microphone'], ['location', 'Location'], ['motion', 'Motion'], ['proximity', 'Proximity'], ['network', 'Network'], ['device', 'Device']];
  /* [id, what, sensor, subject, required?, A, B, C, D] — what happens to it under each design */
  var OBS = [
    ['menu', 'The menu', 'camera', 'none', true, 'tx', 'tx', 'eph', 'eph'],
    ['menutext', 'The menu text', 'camera', 'none', true, 'der', 'der', 'der', 'eph'],
    ['barista', 'The barista’s face', 'camera', 'employee', false, 'tx', 'eph', 'eph', 'eph'],
    ['customer', 'Another customer’s face', 'camera', 'customer', false, 'tx', 'eph', 'eph', 'eph'],
    ['screen', 'A laptop screen at the next table', 'camera', 'stranger', false, 'tx', 'eph', 'eph', 'eph'],
    ['ask', 'The owner’s question, spoken', 'mic', 'owner', true, 'tx', 'tx', 'tx', 'eph'],
    ['talk', 'Conversation at the next table', 'mic', 'customer', false, 'tx', 'tx', 'tx', 'eph'],
    ['place', 'Where the café is', 'location', 'owner', false, 'unk', 'unk', 'unk', 'eph'],
    ['head', 'Which way the owner is looking', 'motion', 'owner', false, 'eph', 'eph', 'eph', 'eph'],
    ['phones', 'Other people’s phones nearby', 'proximity', 'stranger', false, 'eph', 'eph', 'eph', 'eph'],
    ['wifi', 'The café’s Wi-Fi network', 'network', 'owner', false, 'unk', 'unk', 'unk', 'eph'],
    ['devid', 'The glasses’ and phone’s identifiers', 'device', 'owner', true, 'tx', 'tx', 'tx', 'eph']
  ];
  var ALTS = [
    ['A', 'Send the whole frame to the cloud', { utility: 'Highest: the model sees everything', latency: 'A round trip with an image', accuracy: 'High', exposure: 'Every face, screen and voice in the frame leaves the device', cost: 'Cloud compute for every frame' }],
    ['B', 'Crop the region of interest first', { utility: 'High, if the crop is right', latency: 'A small extra step on the device', accuracy: 'High; a bad crop loses text', exposure: 'Only the menu region leaves; faces and screens are cut away', cost: 'Light on-device work' }],
    ['C', 'Read the text on the device; send only the text', { utility: 'Enough for “what does it say?”, not for “what is this dish?”', latency: 'Fast once read', accuracy: 'Limited by on-device text recognition', exposure: 'No image leaves; only the menu text and the question', cost: 'On-device model, battery' }],
    ['D', 'Process everything on the device', { utility: 'Limited by the device’s model', latency: 'No network', accuracy: 'Lower for hard questions', exposure: 'Nothing leaves the device', cost: 'Battery, heat, a capable chip' }]
  ];
  var ALT_I = { A: 5, B: 6, C: 7, D: 8 };
  function cafe(st) {
    var alt = ALT_I[st.alt] ? st.alt : 'A', I = ALT_I[alt], sf = st.sf;
    var rows = OBS.filter(function (o) { return !sf || o[2] === sf; });
    var leaves = OBS.filter(function (o) { return o[I] === 'tx' || o[I] === 'der' && alt !== 'D'; }), others = leaves.filter(function (o) { return o[3] !== 'owner' && o[3] !== 'none'; });
    var hit = OBS.filter(function (o) { return st.ds !== 'everyone' && inGroup(st.ds, o[3]); });
    var sensorName = function (k) { return SENSORS.filter(function (x) { return x[0] === k; })[0][1]; };
    return '<section class="card" aria-labelledby="cfH">' + band('syn', 'A synthetic scene inspired by camera glasses. No company’s design is implied.') +
      '<h2 id="cfH">Walking through a café wearing smart glasses</h2>' +
      '<div class="cf4"><div><span class="eyebrow">What the owner intended</span><p>Ask the assistant: “What does this menu say?”</p></div>' +
        '<div><span class="eyebrow">What was required</span><p>The menu text, and the question.</p></div>' +
        '<div><span class="eyebrow">What the sensors observed</span><p>' + esc(OBS.filter(function (o) { return o[1]; }).map(function (o) { return o[1].toLowerCase(); }).slice(0, 6).join(', ')) + ' and more.</p></div>' +
        '<div><span class="eyebrow">What may be incidental</span><p>' + esc(OBS.filter(function (o) { return !o[4]; }).map(function (o) { return o[1].toLowerCase(); }).join(', ')) + '.</p></div></div>' +
      '<p class="q2">Can the architecture discard incidental data before it becomes another arrow?</p>' +
      '<div class="sfbar"><span class="eyebrow">Sensor</span>' + seg('Sensor', 'sf', SENSORS, sf || '') + '</div>' +
      '<div class="alts" role="radiogroup" aria-label="Design">' + ALTS.map(function (a) { return '<button role="radio" data-alt="' + a[0] + '" aria-checked="' + (a[0] === alt) + '"><b>' + a[0] + '</b> ' + esc(a[1]) + '</button>'; }).join('') + '</div>' +
      '<div class="m-tw"><table class="rel m-obs"><caption>Design ' + alt + ': what happens to each thing the glasses sensed</caption><thead><tr><th scope="col">Observed</th><th scope="col">Sensor</th><th scope="col">Data subject</th><th scope="col">Required or incidental</th><th scope="col">State</th></tr></thead><tbody>' +
        rows.map(function (o) { return '<tr class="' + (hit.indexOf(o) >= 0 ? 'ds-hit' : '') + '"><th scope="row">' + esc(o[1]) + '</th><td>' + esc(sensorName(o[2])) + '</td><td>' + esc(SUBJ[o[3]]) + '</td><td>' + (o[4] ? 'Required' : '<b>Incidental</b>') + '</td><td>' + stateTag(o[I]) + (o[I] === 'tx' ? ' <small>retention: unknown until documented</small>' : '') + '</td></tr>'; }).join('') +
      '</tbody></table></div>' +
      '<p class="rsum" aria-live="polite">' + (others.length ? A.tag('INFERENCE') + ' Under design ' + alt + ', ' + plural(leaves.length, 'thing') + ' leave the device, ' + others.length + ' of them about people who are not the owner.' : A.tag('FACT') + ' Under design ' + alt + ', nothing about anyone but the owner leaves the device' + (leaves.length ? '; ' + plural(leaves.length, 'thing') + ' still leave.' : '.')) +
        (hit.length ? ' ' + plural(hit.length, 'observation') + ' concern the group you picked.' : '') + '</p>' +
      '<div class="m-tw"><table class="rel"><caption>The four designs, side by side (trade-offs, not a ranking)</caption><thead><tr><th scope="col">Design</th><th scope="col">Utility</th><th scope="col">Latency</th><th scope="col">Accuracy</th><th scope="col">Privacy exposure</th><th scope="col">Cost</th></tr></thead><tbody>' +
        ALTS.map(function (a) { return '<tr' + (a[0] === alt ? ' class="sel"' : '') + '><th scope="row">' + a[0] + ' · ' + esc(a[1]) + '</th><td>' + esc(a[2].utility) + '</td><td>' + esc(a[2].latency) + '</td><td>' + esc(a[2].accuracy) + '</td><td>' + esc(a[2].exposure) + '</td><td>' + esc(a[2].cost) + '</td></tr>'; }).join('') +
      '</tbody></table></div><p class="small">None is automatically right. The decision is which of these the feature needs, and whether the rest can be discarded before it becomes another arrow.</p>' +
      phrase('sensing') + phrase('minimise') + '</section>' +
      awarenessCard('cafe') +
      '<section class="card" aria-labelledby="snH"><h2 id="snH">Sensor → observation → derived signal → inference</h2>' + band('syn', 'What a system could derive. No product is implied to take every step.') +
      '<div class="m-tw"><table class="rel odi"><thead><tr><th scope="col">Sensor</th><th scope="col">Observed</th><th scope="col">Derived</th><th scope="col">Inferred</th></tr></thead><tbody>' +
        [['Camera', 'Faces, objects, text', 'Labels, recognised text', 'Scene context: where, with whom'], ['Microphone', 'Speech', 'A transcript', 'A topic or an intent'], ['Location', 'Repeated coordinates', 'A routine', 'A likely home and workplace'], ['Motion', 'Movement', 'Steps, posture', 'An activity pattern']]
          .map(function (r) { return '<tr><th scope="row">' + r[0] + '</th><td><span class="od od-o">observed</span> ' + esc(r[1]) + '</td><td><span class="od od-d">derived</span> ' + esc(r[2]) + '</td><td><span class="od od-i">inferred</span> ' + esc(r[3]) + '</td></tr>'; }).join('') +
      '</tbody></table></div></section>' +
      '<section class="card" aria-labelledby="mnH"><h2 id="mnH">Minimisation for sensors</h2><div class="m-tw"><table class="rel"><thead><tr><th scope="col">Instead of</th><th scope="col">Consider</th><th scope="col">Where it happens</th></tr></thead><tbody>' +
        [['The full image to the cloud', 'Text recognised on the device; only the text', 'Before transmission'], ['A raw audio stream to the cloud', 'A local wake word; only the activation', 'Before transmission'], ['A precise location history', 'A coarse region', 'Before storage'], ['A full camera frame for an age check', 'An age attribute or proof', 'Before transmission']]
          .map(function (r) { return '<tr><th scope="row">' + esc(r[0]) + '</th><td>' + esc(r[1]) + '</td><td>' + esc(r[2]) + '</td></tr>'; }).join('') +
      '</tbody></table></div>' + readLink('cafe') + '</section>';
  }

  /* ═══════════ awareness: tracked separately from consent ═══════════ */
  var AWARE_FLOWS = {
    cafe: ['A question about a menu, on camera glasses', { owner: ['clear', 'They asked the question.'], bystander: ['unclear', 'Depends on whether they noticed an indicator, and what they took it to mean.'], indicator: ['partial', 'A light can say “capturing”; it cannot say what is sent or kept.'], setting: ['partial', 'The owner’s settings; the people in the frame have none.'], consent: ['na', 'The owner authorised the feature. Nobody else was asked, and this view draws no legal conclusion.'], purpose: ['clear', 'Read the menu.'] }],
    dinner: ['“Play some music” at the dinner table', { owner: ['partial', 'The host set the speaker up, but did not ask.'], bystander: ['partial', 'Guests may know a speaker is there, not when it is listening.'], indicator: ['partial', 'A light or tone on activation, if they notice it.'], setting: ['partial', 'The host’s account decides what is kept.'], consent: ['na', 'No legal conclusion is drawn here.'], purpose: ['clear', 'Play music.'] }],
    doorbell: ['The doorbell sees a delivery', { owner: ['clear', 'The owner installed the camera.'], bystander: ['unclear', 'The driver may not know whether it records, or for how long.'], indicator: ['unk', 'Depends on the device.'], setting: ['partial', 'The owner’s motion and retention settings.'], consent: ['na', 'No legal conclusion is drawn here.'], purpose: ['clear', 'See who is at the door.'] }],
    meeting: ['A video meeting', { owner: ['clear', 'They joined the meeting.'], bystander: ['partial', 'Coworkers know the meeting, maybe not a transcript or a summary.'], indicator: ['partial', 'A recording banner, if recording; a summary may have none.'], setting: ['partial', 'The organiser’s or the company’s.'], consent: ['na', 'No legal conclusion is drawn here.'], purpose: ['clear', 'Meet.'] }]
  };
  var AW_ROWS = [['owner', 'Owner awareness'], ['bystander', 'Bystander awareness'], ['indicator', 'Visible indicator'], ['setting', 'Setting'], ['consent', 'Consent or authorisation'], ['purpose', 'Purpose']];
  function awarenessCard(fid) {
    var F = AWARE_FLOWS[fid];
    return '<section class="card" aria-labelledby="awH-' + fid + '"><h2 id="awH-' + fid + '">Awareness is not consent: ' + esc(F[0].toLowerCase()) + '</h2>' +
      dl(AW_ROWS.map(function (r) { return [esc(r[1]), awareTag(F[1][r[0]][0]) + ' ' + esc(F[1][r[0]][1])]; })) +
      '<p class="small">Legal basis is not assessed here. This is a privacy-design view, not legal advice.</p>' + phrase('awareness') + '</section>';
  }

  /* ═══════════ 2 · THE ROOM — the dinner table, hop by hop, and a false activation ═══════════ */
  var HOPS = [
    ['voice', 'Voice in the room', 'Everyone’s speech, the music, the television', 'Everyone present', 'Nothing yet', 'Nothing', 'None', 'Nobody needs to', 'They are all in it'],
    ['mic', 'Microphone', 'Sound, as the device hears it', 'The device', 'Nothing yet', 'Nothing', 'None', 'Nothing to delete', 'Their speech reaches the microphone too'],
    ['wake', 'Local wake word', 'A detector listening for one phrase', 'The device', 'Nothing, if it runs locally (check)', 'Nothing, if it runs locally', 'None', 'Nothing to delete', 'A similar phrase from anyone can wake it'],
    ['buffer', 'Audio buffer', 'A short window of audio', 'The device', 'The window, once activated', 'Unknown until documented', 'None', 'Unknown', 'Their words can fall inside the window'],
    ['proc', 'Cloud or local processing', 'The request, as audio', 'The provider, if it leaves', 'The audio, if processed in the cloud', 'Depends on the owner’s setting', 'None yet', 'The owner', 'Processed under the owner’s account'],
    ['transcript', 'Transcript', 'The words, as text', 'The provider', 'Text, if made in the cloud', 'Depends on the setting', 'The transcript itself', 'The owner, if deletion covers it', 'Their words, in the owner’s history'],
    ['intent', 'Intent', 'What the assistant decided to do', 'The provider', 'Text', 'Logs, usually', 'An intent record', 'Unknown', 'Attributed to the owner'],
    ['action', 'Action', 'The music plays', 'The room', 'A call to the music service', 'The service’s play history', 'A play record', 'The owner', 'Their taste, on the owner’s account'],
    ['log', 'Log', 'A record that it happened', 'Operators, analytics', 'Event records', 'By the log’s retention', 'Counts, timings', 'Rarely the user', 'Present without a name'],
    ['retention', 'Retention', 'Every copy above, each with a clock', 'Whoever holds each copy', '—', 'Each copy’s own rule', 'Whatever was derived', 'The owner, copy by copy', 'They have no setting of their own'],
    ['model', 'Model or analytics', 'What is learned from many requests', 'The provider', '—', 'In a model, if used to improve it', 'Learned patterns', 'Hard to delete from a model', 'Learned from, without an account']
  ];
  var HQ = ['What exists?', 'Who can hear it?', 'What leaves the device?', 'What is stored?', 'What derivative survives?', 'Who can delete it?', 'What about the other people in the room?'];
  var FA_IN = ['The correct wake word', 'A similar-sounding phrase', 'Television audio', 'Background conversation'];
  var FA_MEASURE = ['Activation', 'Network transmission', 'Stored audio', 'Transcript', 'Retention'];
  function room(st) {
    var h = HOPS.filter(function (x) { return x[0] === st.hop2; })[0] || HOPS[4];
    var guests = [['Host', 'owner', 'Owns the speaker and the account; chose the settings'], ['Guest A', 'guest', 'Talking when the speaker woke'], ['Guest B', 'guest', 'Asked: “Play some music.”'], ['Guest C', 'guest', 'Talking in the background'], ['Guest D', 'child', 'A child, at the table']];
    return '<section class="card" aria-labelledby="dnH">' + band('syn', 'A synthetic dinner. No company’s speaker is implied.') + '<h2 id="dnH">The dinner table</h2>' +
      '<p>The host owns a smart speaker. Four guests are talking. Guest B asks it to play some music.</p>' +
      '<ul class="ppl">' + guests.map(function (g) { return '<li class="' + (st.ds !== 'everyone' && inGroup(st.ds, g[1]) ? 'ds-hit' : '') + '"><b>' + esc(g[0]) + '</b><span>' + esc(SUBJ[g[1]]) + '</span><small>' + esc(g[2]) + '</small></li>'; }).join('') + '</ul>' +
      chips([['Guest B’s voice'], ['Room microphone'], ['Activation'], ['Request'], ['Cloud'], ['Response']]) +
      dl([['Device owner', esc('The host')], ['Data subject', esc('Guest B, who asked; Guests A, C and D, whose speech may be in the same audio window')], ['Account', esc('The host’s')], ['Settings chosen by', esc('The host. The guests have none.')],
        ['Other speech in the audio window?', badge('unk') + ' Depends on how long the window stays open; the architecture here does not establish it'], ['Transcript?', badge('unk') + ' Depends on the host’s setting'], ['Stored?', badge('unk') + ' By the host’s retention setting, if at all'],
        ['Retention', esc('The host’s rule applies to the guests’ words')], ['Derivative?', A.tag('INFERENCE') + ' ' + esc('A music preference, recorded against the host’s account')], ['Who can delete it?', esc('The host, through the host’s history. A guest can only ask the host.')]]) +
      phrase('subject') + phrase('consentaware') + readLink('subject') + '</section>' +
      awarenessCard('dinner') +
      '<section class="card" aria-labelledby="rhH"><h2 id="rhH">The room, hop by hop</h2>' + band('syn', 'The generic flow of a voice assistant. Details vary by product and setting.') +
      '<ol class="m-hops">' + HOPS.map(function (x) { return '<li><button type="button" data-hop2="' + x[0] + '" aria-pressed="' + (x === h) + '">' + esc(x[1]) + '</button></li>'; }).join('') + '</ol>' +
      '<h3>' + esc(h[1]) + '</h3>' + dl(HQ.map(function (q, i) { return [esc(q), esc(h[i + 2])]; })) + phrase('room') + '</section>' +
      '<section class="card" aria-labelledby="faH"><h2 id="faH">False activation test</h2>' + band('syn', 'A test to run, not a result. Nothing here has been run.') +
      '<p>Expected: the wake word, and only the wake word, starts processing. The privacy question is not whether the assistant misunderstood. It is whether information left the room when nobody meant to invoke it.</p>' +
      '<div class="m-tw"><table class="rel fat"><caption>Controlled synthetic audio, and what to measure</caption><thead><tr><th scope="col">Input</th>' + FA_MEASURE.map(function (m) { return '<th scope="col">' + esc(m) + '</th>'; }).join('') + '<th scope="col">Observed</th></tr></thead><tbody>' +
        FA_IN.map(function (inp, i) { return '<tr><th scope="row">' + esc(inp) + '</th>' + FA_MEASURE.map(function (m, j) { return '<td>' + (i === 0 ? (j === 4 ? 'By the setting' : 'Expected') : 'None expected') + '</td>'; }).join('') + '<td>' + qst(['never', 'NOT RUN']) + '</td></tr>'; }).join('') +
      '</tbody></table></div><p class="small">Pass means every row but the first shows no transmission, no stored audio and no transcript. Re-run after every update.</p>' + phrase('falsepos') + readLink('falsepos') + '</section>';
  }

  /* ═══════════ 3 · THE DEVICE THAT DID NOT FORGET ═══════════ */
  var DERIV = [['audio', 'Raw audio', 'The recording itself'], ['transcript', 'Transcript', 'The words as text'], ['intent', 'Intent', 'What the assistant decided to do'], ['summary', 'Summary', 'A short description of the request'],
    ['embedding', 'Embedding', 'A vector that represents the request for search or memory'], ['analytics', 'Analytics event', 'A count, a timing, a category'], ['feedback', 'Model feedback record', 'A sample kept to improve a model']];
  var reach = { audio: true };   /* what “delete” is designed to reach; for this visit only */
  function forget(st) {
    var gone = DERIV.filter(function (d) { return reach[d[0]]; }), left = DERIV.filter(function (d) { return !reach[d[0]]; });
    return '<section class="card" aria-labelledby="fgH">' + band('syn', 'A synthetic distributed-deletion scenario. No company is implied to keep any of these.') + '<h2 id="fgH">The device that did not forget</h2>' +
      '<p>The user deletes the recording. Switch on each record that “delete” is designed to reach.</p>' +
      '<div class="drv" role="group" aria-label="What delete reaches">' + DERIV.map(function (d) { return '<button type="button" data-drv="' + d[0] + '" aria-pressed="' + !!reach[d[0]] + '"><b>' + esc(d[1]) + '</b><span>' + esc(d[2]) + '</span><em>' + (reach[d[0]] ? 'deleted' : 'survives') + '</em></button>'; }).join('') + '</div>' +
      '<p class="rsum" aria-live="polite">' + (left.length ? A.tag('INFERENCE') + ' ' + plural(gone.length, 'record') + ' deleted; ' + plural(left.length, 'derivative') + ' survive: ' + esc(left.map(function (d) { return d[1].toLowerCase(); }).join(', ')) + '.' : A.tag('FACT') + ' Delete reaches every record listed here. Prove it with a test.') + '</p>' +
      '<h3>What exactly did delete mean?</h3>' + dl([['Raw audio', reach.audio ? 'Deleted' : 'Kept'], ['Transcript', reach.transcript ? 'Deleted' : 'Survives'], ['Everything derived', left.length ? plural(left.length, 'record') + ' outlive the recording' : 'Gone, if the test agrees']].map(function (r) { return [esc(r[0]), esc(r[1])]; })) +
      '<p>' + badge('test') + ' Delete the audio, then search for the transcript, the intent, the summary, the embedding, the analytics event and the feedback sample. A recommendation; nobody has run it here.</p>' +
      phrase('everyderivative') + phrase('derivative') + readLink('derivatives') + '</section>';
  }

  /* ═══════════ 4 · THE BYSTANDER GAP ═══════════ */
  function gap(st) {
    var rows = [['The sensor is visible', 'Usually: the phone is raised', 'Partly: a small lens in a frame'], ['Activation is visible', 'The gesture of pointing', 'Depends on an indicator'], ['Recording is visible', 'Depends on the gesture and the screen', 'Depends on an indicator light'],
      ['Cloud processing is visible', 'Not to the bystander', 'Not to the bystander'], ['The bystander can opt out', 'By leaving or asking', 'By leaving or asking, if they noticed'], ['The bystander can ask for deletion', 'Only through the owner', 'Only through the owner']];
    var flow = AWARE_FLOWS[st.aw] ? st.aw : 'cafe';
    return '<section class="card" aria-labelledby="gpH">' + band('syn', 'A design checklist, not a verdict on any product.') + '<h2 id="gpH">The bystander gap</h2>' +
      '<p>A phone camera announces itself. A camera in glasses is already being worn. The question becomes how obvious capture is to the person being captured.</p>' +
      '<div class="m-tw"><table class="rel"><thead><tr><th scope="col">Property</th><th scope="col">Phone camera</th><th scope="col">Camera in glasses</th></tr></thead><tbody>' + rows.map(function (r) { return '<tr><th scope="row">' + esc(r[0]) + '</th><td>' + esc(r[1]) + '</td><td>' + esc(r[2]) + '</td></tr>'; }).join('') + '</tbody></table></div>' +
      phrase('consentaware') + readLink('bystander') + '</section>' +
      '<div class="awsel"><span class="eyebrow">Bystander awareness, flow by flow</span>' + seg('Flow', 'aw', Object.keys(AWARE_FLOWS).map(function (k) { return [k, AWARE_FLOWS[k][0]]; }), flow) + '</div>' + awarenessCard(flow);
  }

  /* ═══════════ 5 · UNDER ATTACK — intended and adversarial flows ═══════════ */
  var DEVS = [['speaker', 'Smart speaker'], ['doorbell', 'Doorbell camera'], ['glasses', 'Camera glasses']];
  /* [path, applies to (speaker, doorbell, glasses), what it reaches, the control that narrows it] */
  var PATHS = [
    ['Malicious app', [0, 1, 1], 'Microphone or camera permission on the paired phone', 'Permission review; indicators when a sensor is in use'],
    ['Compromised account', [1, 1, 1], 'Past recordings, clips and history', 'Phishing-resistant sign-in; alerts on new sign-ins'],
    ['Stolen session', [1, 1, 1], 'Everything the account can see, without the password', 'Device-bound sessions; short session lifetimes'],
    ['Malware', [0, 0, 1], 'The paired phone, and through it the media import', 'Platform security updates; app review'],
    ['Rogue extension', [0, 0, 0], 'Not applicable to these devices; relevant to a browser that opens the web app', 'Extension review'],
    ['Phishing', [1, 1, 1], 'The account, and so every device on it', 'Passkeys; no SMS recovery'],
    ['Fake device linking', [1, 1, 1], 'A new device added to the household, receiving future captures', 'A confirmation on an existing device; a visible device list'],
    ['Unauthorised API client', [1, 1, 0], 'Recordings or clips through an integration', 'Scoped tokens; a reviewed list of connected apps'],
    ['Prompt injection', [1, 0, 1], 'The assistant, steered by text it reads or hears', 'Runtime policy; approval before consequential actions'],
    ['Physical device theft', [1, 1, 1], 'Anything stored on the device', 'Encryption at rest; remote wipe; a capture light that cannot be covered'],
    ['Malicious voice command', [1, 0, 1], 'Actions anyone in earshot can request', 'Voice match for sensitive actions; confirmation'],
    ['Untrusted visual or text content', [0, 0, 1], 'The AI, through a sign or a screen in view', 'Treat what the camera reads as data, never as instructions']
  ];
  function attack(st) {
    var di = Math.max(0, DEVS.map(function (d) { return d[0]; }).indexOf(st.dev));
    var applies = PATHS.filter(function (p) { return p[1][di]; });
    return '<section class="card" aria-labelledby="atH">' + band('syn', 'Threat paths to consider. No product is implied to be vulnerable to any of them.') + '<h2 id="atH">Under attack: the adversary view</h2>' +
      seg('Device', 'dev', DEVS, DEVS[di][0]) +
      '<p class="rsum">' + plural(applies.length, 'path') + ' apply to a ' + esc(DEVS[di][1].toLowerCase()) + '.</p>' +
      '<div class="m-tw"><table class="rel"><thead><tr><th scope="col">Path</th><th scope="col">Applies?</th><th scope="col">What it reaches</th><th scope="col">The control that narrows it</th></tr></thead><tbody>' +
        PATHS.map(function (p) { return '<tr' + (p[1][di] ? '' : ' class="na"') + '><th scope="row">' + esc(p[0]) + '</th><td>' + (p[1][di] ? 'Yes' : 'Not applicable') + '</td><td>' + esc(p[2]) + '</td><td>' + esc(p[3]) + '</td></tr>'; }).join('') +
      '</tbody></table></div>' + phrase('adversarial') + readLink('attack') + '</section>';
  }

  /* ═══════════ 6 · ONE HOME, MANY ECOSYSTEMS ═══════════ */
  var HOME = [['phone', 'iPhone-like phone', 'Apple-like', ['email', 'browser', 'app', 'link', 'network', 'cloud', 'contacts', 'calendar', 'location', 'merchant', 'assistant', 'phone']],
    ['laptop', 'Windows-like laptop', 'Microsoft-like', ['email', 'browser', 'app', 'link', 'network', 'cloud', 'calendar']],
    ['tablet', 'Android-like tablet', 'Google-like', ['email', 'browser', 'app', 'network', 'cloud', 'phone']],
    ['speaker', 'Echo-like speaker', 'Amazon-like', ['email', 'network', 'calendar', 'contacts', 'merchant', 'assistant', 'phone']],
    ['doorbell', 'Ring-like doorbell', 'Amazon-like', ['email', 'network', 'phone', 'location']],
    ['display', 'Nest-like display', 'Google-like', ['email', 'network', 'calendar', 'assistant', 'phone']],
    ['glasses', 'Meta-like glasses', 'Meta-like', ['email', 'network', 'phone', 'location', 'assistant', 'app']],
    ['tv', 'Smart television', 'TV maker', ['email', 'network', 'app']],
    ['car', 'Car', 'Car maker', ['phone', 'location', 'contacts', 'calendar', 'assistant']]];
  var JOIN = [['network', 'Home network'], ['email', 'Email address'], ['phone', 'Shared phone'], ['app', 'Shared app'], ['calendar', 'Calendar'], ['contacts', 'Contacts'], ['browser', 'Browser login'], ['cloud', 'Cloud account'], ['location', 'Location'], ['merchant', 'Merchant or transaction'], ['assistant', 'AI assistant access'], ['link', 'Phone-to-computer link']];
  function home(st) {
    var ecos = []; HOME.forEach(function (d) { if (ecos.indexOf(d[2]) < 0) ecos.push(d[2]); });
    return '<section class="card" aria-labelledby="hmH">' + band('syn', 'One synthetic household. No company is implied to exchange data with another.') + '<h2 id="hmH">One home, many ecosystems</h2>' +
      '<p>' + plural(HOME.length, 'device') + ' from ' + plural(ecos.length, 'ecosystem') + '. None of them needs to share data with another to be joined; the common points are enough.</p>' +
      '<ul class="setup">' + HOME.map(function (d) { return '<li><b>' + esc(d[1]) + '</b><span>' + esc(d[2]) + '</span></li>'; }).join('') + '</ul>' +
      '<div class="m-tw"><table class="rel"><caption>Common join points, and the devices each touches</caption><thead><tr><th scope="col">Join point</th><th scope="col">Devices</th></tr></thead><tbody>' +
        JOIN.map(function (j) { var on = HOME.filter(function (d) { return d[3].indexOf(j[0]) >= 0; }); return '<tr><th scope="row">' + esc(j[1]) + '</th><td>' + plural(on.length, 'device') + ': ' + esc(on.map(function (d) { return d[1]; }).join(', ')) + '</td></tr>'; }).join('') +
      '</tbody></table></div>' + phrase('onehome') + phrase('samequestions') + '<p><a class="btn ghost" href="#everyday?et=eco">Follow the devices in the events graph →</a></p></section>';
  }

  /* ═══════════ the page ═══════════ */
  var SM = [['cafe', 'What the device saw'], ['room', 'The room'], ['forget', 'Did not forget'], ['gap', 'Bystander gap'], ['attack', 'Under attack'], ['home', 'One home']];
  function page(st) {
    var sm = SM.some(function (x) { return x[0] === st.sm; }) ? st.sm : 'cafe';
    var body = sm === 'room' ? room(st) : sm === 'forget' ? forget(st) : sm === 'gap' ? gap(st) : sm === 'attack' ? attack(st) : sm === 'home' ? home(st) : cafe(st);
    return pgh('Sensors & wearables', 'Some arrows do not begin with a click. A microphone hears a room, a camera sees a scene, a wearable observes whoever is nearby. Ask what the system observed, about whom, what it turned that into, and what survived.', 'Ambient computing') +
      '<p class="keyline">' + esc(phraseText('subject')) + '</p>' + seg('Scenario', 'sm', SM, sm) + dsBar(st) + '<div class="sens">' + body + '</div>' + readLink('room');
  }
  function mount(root) {
    mountDs(root);
    root.addEventListener('click', function (e) {
      var b = e.target.closest('[data-sm],[data-sf],[data-alt],[data-hop2],[data-drv],[data-aw],[data-dev]'); if (!b) return;
      var a = function (n) { return b.getAttribute(n); };
      if (b.hasAttribute('data-sm')) { A.focusNext('[data-sm="' + a('data-sm') + '"]'); A.set({ sm: a('data-sm') }); }
      else if (b.hasAttribute('data-sf')) { A.focusNext('[data-sf="' + a('data-sf') + '"]'); A.set({ sf: a('data-sf') }); }
      else if (b.hasAttribute('data-alt')) { A.focusNext('[data-alt="' + a('data-alt') + '"]'); A.set({ alt: a('data-alt') }); }
      else if (b.hasAttribute('data-hop2')) { A.focusNext('[data-hop2="' + a('data-hop2') + '"]'); A.set({ hop2: a('data-hop2') }); }
      else if (b.hasAttribute('data-aw')) { A.focusNext('[data-aw="' + a('data-aw') + '"]'); A.set({ aw: a('data-aw') }); }
      else if (b.hasAttribute('data-dev')) { A.focusNext('[data-dev="' + a('data-dev') + '"]'); A.set({ dev: a('data-dev') }); }
      else { var k = a('data-drv'); reach[k] = !reach[k]; A.focusNext('[data-drv="' + k + '"]'); A.render(); }
    });
  }

  /* ═══════════ the ambient morning, on Everyday arrows ═══════════ */
  /* [time, event, sensor, identifier, system, derived, inference, bystanders: [who, subject]] */
  var AMB = [
    ['7:00', 'Alarm from the speaker', 'Microphone (the request the night before)', 'Speaker account', 'Echo-like speaker', 'Alarm time', 'When the household wakes', [['A partner asleep in the room', 'household']]],
    ['7:15', 'Ask the weather', 'Microphone', 'Speaker account, rough location', 'Assistant, weather service', 'Request log', 'Morning routine', [['A child asking something at the same time', 'child'], ['An overnight guest', 'guest']]],
    ['7:40', 'The doorbell sees a delivery', 'Camera and motion', 'Doorbell account', 'Ring-like doorbell, video storage', 'A motion clip', 'Deliveries and when the home is attended', [['The delivery driver', 'employee'], ['A passer-by on the pavement', 'passer']]],
    ['8:10', 'Put on the glasses', 'Motion, proximity', 'Glasses and phone IDs', 'Glasses app on the phone', 'Device connected', 'Leaving home', []],
    ['8:20', 'Ask the glasses to read a sign', 'Camera and microphone', 'Glasses account', 'Assistant, maybe the cloud', 'Recognised text', 'Where the owner walks', [['A pedestrian in the frame', 'passer']]],
    ['8:30', 'Buy a coffee', 'Phone (payment)', 'Payment token, account', 'Wallet, the shop', 'Purchase record', 'Coffee near work on weekdays', [['The barista', 'employee']]],
    ['9:00', 'Join a video meeting', 'Camera and microphone', 'Work account', 'Meeting service', 'Recording or transcript, if on', 'Who works with whom', [['Coworkers on the call', 'contact']]],
    ['9:30', 'Ask the assistant about the flight', 'Microphone', 'Account', 'Assistant, mail, calendar', 'Itinerary', 'Away from home on those dates', []]
  ];
  function people(n) { return n + (n === 1 ? ' person' : ' people'); }
  function ambTab(st) {
    var by = st.by, nb = 0;
    AMB.forEach(function (e) { nb += e[7].length; });
    return '<div class="amb">' + band('syn', 'A synthetic ambient morning. Device kinds are labels, not products.') +
      '<div class="ambh"><p>Eight things before ten, and arrows nobody tapped. Each runs <b>event → sensor → identifier → system → derived data → inference</b>.</p>' +
      '<button type="button" class="btn' + (by ? '' : ' ghost') + '" data-by aria-pressed="' + !!by + '">' + (by ? 'Hide bystanders' : 'Show bystanders') + '</button></div>' + dsBar(st) +
      '<ol class="ambl">' + AMB.map(function (e) {
        var hit = st.ds !== 'everyone' && (st.ds === 'me' || e[7].some(function (b) { return inGroup(st.ds, b[1]); }));
        return '<li class="' + (hit ? 'ds-hit' : '') + '"><span class="t">' + esc(e[0]) + '</span><b>' + esc(e[1]) + '</b>' +
          '<dl class="chain6"><div><dt>Sensor</dt><dd>' + esc(e[2]) + '</dd></div><div><dt>Identifier</dt><dd>' + esc(e[3]) + '</dd></div><div><dt>System</dt><dd>' + esc(e[4]) + '</dd></div><div><dt>Derived</dt><dd>' + esc(e[5]) + '</dd></div><div><dt>Inference</dt><dd>' + esc(e[6]) + '</dd></div></dl>' +
          (by && e[7].length ? '<p class="byst">' + e[7].map(function (b) { return '<span class="bp' + (inGroup(st.ds, b[1]) && st.ds !== 'everyone' ? ' ds-hit' : '') + '">' + esc(b[0]) + ' <small>' + esc(SUBJ[b[1]]) + '</small></span>'; }).join('') + '</p>' : '') + '</li>';
      }).join('') + '</ol>' +
      (by ? '<p class="rsum">' + A.tag('FACT') + ' ' + people(nb) + ' appear in these flows without ever using the product: ' + esc([].concat.apply([], AMB.map(function (e) { return e[7].map(function (b) { return b[0].toLowerCase(); }); })).join(', ')) + '.</p>' : '<p class="small">' + people(nb).replace(/^(\d+) /, '$1 other ') + ' appear in these flows. Show bystanders to see who.</p>') +
      phrase('subject') + readLink('subject') + '</div>';
  }
  function mountAmb(root) {
    mountDs(root);
    var b = $('[data-by]', root); if (b) b.addEventListener('click', function () { A.focusNext('[data-by]'); A.set({ by: !A.S().by }); });
  }
  /* "Whose data?" on the events graph: the records about people other than the owner */
  var SUBJ_NODES = { contacts: ['d_inbox', 'd_contacts', 'x_recipient', 'd_theircopy', 'd_acl', 'x_group', 'd_appcontacts', 'd_cal'], household: ['d_household', 'd_voice', 'd_voiceclip'], bystanders: ['d_photo', 'd_sentphoto', 'd_exif', 'd_voiceclip'], children: [], employees: [] };
  function graphSubjects(st) {
    if (st.ds === 'everyone' || st.ds === 'me') return '';
    var ids = SUBJ_NODES[st.ds] || [];
    return ids;
  }
  function highlightGraph(root, st) {
    var ids = graphSubjects(st); if (!ids) return;
    var on = ids.filter(function (id) { var el = $('[data-n="' + id + '"]', root); if (el) el.classList.add('ds-hit'); return !!el; });
    var note = $('#dsnote', root); if (note) note.innerHTML = on.length ? A.tag('FACT') + ' ' + plural(on.length, 'record') + ' in this graph concern ' + esc(DS.filter(function (d) { return d[0] === st.ds; })[0][1].toLowerCase()) + ': ' + esc(on.map(function (id) { return EV.label(id, 'all'); }).join(', ')) + '.' : A.tag('UNKNOWN') + ' No record in this view is tagged as about this group. Open Sensors & wearables for flows about people who never used the product.';
  }

  /* ═══════════ ask privacy ═══════════ */
  function claims(pid, co, re) {
    var P = C.products.filter(function (p) { return p.id === pid; })[0], out = [];
    if (!P) return out;
    (co ? [co] : P.cos).forEach(function (c) { ['sec', 'pri', 'qa', 'gov'].forEach(function (l) { (P.cells[c][l] || []).forEach(function (it) { if (!re || re.test(it[1] + ' ' + it[2])) out.push([c, it]); }); }); });
    return out;
  }
  var KIND = { doc: 'DOCUMENTED', set: 'SETTING', lim: 'LIMIT', test: 'TEST' };
  function asLines(list, max) { return list.slice(0, max || 6).map(function (x) { return [KIND[x[1][0]], C.companies[x[0]] + ': ' + x[1][1] + '. ' + x[1][2] + (x[1][0] === 'test' ? ' (A recommendation; not run.)' : ''), []]; }); }
  function ask(q, k, a) { return { q: q, k: k, a: a }; }
  var ASK = [
    ask('What can Alexa hear before activation?', /alexa.*before|before activation/i, function () {
      return asLines(claims('voice', 'amazon', /wake word|before|cloud|local/i), 3).concat([['UNKNOWN', 'What the microphone hears and discards locally before the wake word, beyond what Amazon documents, is not established by the documentation reviewed.', []], ['TEST', 'Run the false activation test: the correct wake word, similar phrases, television audio and conversation, measuring activation, transmission, stored audio and transcripts.', []]]);
    }),
    ask('What happens after the wake word?', /after the wake word/i, function () {
      return [['FACT', 'In general: the audio window is processed locally or in the cloud, becomes a transcript and an intent, triggers an action, and leaves logs, each with its own retention.', []]].concat(asLines(claims('voice', null, /record|save|delete|retention|keep|months/i), 4));
    }),
    ask('Which Alexa data becomes a transcript?', /alexa.*transcript|becomes a transcript/i, function () {
      return asLines(claims('voice', 'amazon', /transcript|save|record/i), 4).concat([['UNKNOWN', 'Which further records Amazon derives from a request (intents, summaries, analytics) is not listed in the documentation reviewed.', []]]);
    }),
    ask('What remains after I delete a recording?', /after i delete|delete a recording/i, function () {
      return [['INFERENCE', 'In the synthetic “did not forget” scenario, deleting the audio leaves the transcript, the intent, a summary, an embedding, an analytics event and a feedback sample unless deletion is designed to reach them.', []], ['RECOMMENDATION', phraseText('everyderivative'), []], ['TEST', 'Delete the audio, then search for every derivative.', []]];
    }),
    ask('Who besides the owner appears in this Ring event?', /ring event|besides the owner/i, function () {
      return [['INFERENCE', 'In the synthetic doorbell event at 7:40: the delivery driver, and a passer-by on the pavement. Neither has an account.', []]].concat(asLines(claims('voice', 'amazon', /video|ring/i), 1)).concat([['UNKNOWN', 'What the driver or the passer-by is told, and how either could ask for deletion, is not established here.', []]]);
    }),
    ask('What can smart glasses capture about someone who does not own them?', /glasses capture|does not own/i, function () {
      return asLines(claims('wearable', 'meta', /light|background/i), 3).concat([['INFERENCE', 'In the synthetic café: the barista’s face, another customer’s face and conversation, and a laptop screen. All incidental to reading a menu.', []], ['RECOMMENDATION', 'Crop to the region of interest or read the text on the device, so incidental data never leaves.', []]]);
    }),
    ask('Does this information stay on device?', /stay on (the )?device/i, function () {
      return ALTS.map(function (a) { var I = ALT_I[a[0]], n = OBS.filter(function (o) { return o[I] === 'tx'; }).length; return ['FACT', 'Design ' + a[0] + ' (' + a[1].toLowerCase() + '): ' + (n ? plural(n, 'observation') + ' transmitted' : 'nothing transmitted') + '.', []]; })
        .concat([['UNKNOWN', 'Whether wake-word detection on Meta’s glasses runs on the glasses or the phone could not be confirmed on Meta’s own pages.', []]]);
    }),
    ask('Which sensor data reaches the cloud?', /reaches the cloud|sensor data/i, function () {
      return [['FACT', 'Design A sends: ' + OBS.filter(function (o) { return o[5] === 'tx'; }).map(function (o) { return o[1].toLowerCase(); }).join(', ') + '.', []], ['FACT', 'Design D sends nothing.', []]].concat(asLines(claims('wearable', 'meta', /cloud/i), 2));
    }),
    ask('What is observed versus stored?', /observed versus stored|observed vs/i, function () {
      return [['FACT', 'Sensed is not collected. Each observation is ephemeral on the device, transmitted, stored, derived only, persisted, or unknown.', []], ['RECOMMENDATION', phraseText('sensing'), []]];
    }),
    ask('What is incidental to the feature?', /incidental/i, function () {
      return [['FACT', 'Reading a menu requires the menu text and the question. Incidental: ' + OBS.filter(function (o) { return !o[4]; }).map(function (o) { return o[1].toLowerCase(); }).join(', ') + '.', []], ['RECOMMENDATION', 'Discard incidental data before it becomes another arrow.', []]];
    }),
    ask('Can visual AI operate on a cropped or derived representation?', /cropped|derived representation/i, function () {
      return [['FACT', 'Design B sends a crop; design C sends only text. Both answer “what does it say?”; C cannot answer “what is this dish?”.', []], ['RECOMMENDATION', 'Choose the smallest representation the question needs.', []], ['TEST', 'Ask ten menu questions under B and C; compare accuracy and confirm no full frame leaves the device.', []]];
    }),
    ask('Which people in this graph never interacted with the product?', /never interacted/i, function () {
      return [['FACT', [].concat.apply([], AMB.map(function (e) { return e[7].map(function (b) { return b[0]; }); })).join(', ') + ': in the synthetic ambient morning, none of them used the product.', []]];
    }),
    ask('Which privacy controls protect bystanders?', /protect bystanders/i, function () {
      return asLines(claims('wearable', 'meta', /light/i), 2).concat([['RECOMMENDATION', 'Minimise before transmission (crop, on-device text, local wake word), and give non-users a way to ask for deletion.', []], ['UNKNOWN', 'A deletion route for people captured who do not use the product is not established by the documentation reviewed.', []]]);
    }),
    ask('What happens if the microphone activates accidentally?', /activates accidentally|accidental/i, function () {
      return asLines(claims('wearable', 'meta', /false wake|mistaken/i), 1).concat([['TEST', 'Run the false activation test and read the activity log.', []], ['RECOMMENDATION', phraseText('falsepos'), []]]);
    }),
    ask('What changed after this firmware or privacy-setting update?', /firmware|setting update/i, function () {
      return asLines(claims('voice', 'amazon', /removed|withdrawn/i), 1).concat([['TEST', 'After every update, re-check each privacy setting and re-run the false activation test.', []], ['UNKNOWN', 'Whether a given update changed what is sent or kept is unknown until it is tested.', []]]);
    })
  ];

  return {
    page: { render: page, mount: mount },
    ambTab: ambTab, mountAmb: mountAmb, highlightGraph: highlightGraph,
    defs: { sm: 'cafe', ds: 'everyone', sf: '', alt: 'A', hop2: 'proc', aw: 'cafe', dev: 'speaker', by: false },
    valid: { sm: SM.map(function (x) { return x[0]; }), ds: DS.map(function (x) { return x[0]; }), sf: SENSORS.map(function (x) { return x[0]; }), alt: ['A', 'B', 'C', 'D'], hop2: HOPS.map(function (x) { return x[0]; }), aw: Object.keys(AWARE_FLOWS), dev: DEVS.map(function (x) { return x[0]; }) },
    dsBar: dsBar, ask: ASK, obs: OBS, alts: ALTS, amb: AMB, hops: HOPS, paths: PATHS, home: HOME, join: JOIN
  };
};
