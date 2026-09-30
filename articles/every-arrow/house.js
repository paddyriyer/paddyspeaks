/* Every Arrow Is a Decision — Chapter 5, “The house is a data system”.
 *
 * One module for the chapter's eight figures: the teaching data they need beyond the
 * household itself, the pure models, the static fallbacks (the build calls
 * EA_HOUSE.statics[id]() in Node, so the no-JS / print / PDF version comes from the
 * same code) and, in a browser, the interactive figures.
 *
 * The household — people, rooms, devices, accounts, networks, arrows, routines,
 * physical actions, inferences, offboarding — is NOT defined here. It is EA_NS.life,
 * generated into northstar.js from the Command Center's data-life.js, so the essay
 * and the Command Center's Connected Life pages read the same records.
 *
 * Platform claims (what a voice assistant, a phone maker's home app or Matter
 * actually does) are cited in the essay's prose next to each figure. Nothing here
 * asserts that competing assistants share recordings: none of the join mechanisms
 * below requires it.
 */
(function (root) {
  'use strict';
  var NS = root.EA_NS, L = NS && NS.life;
  if (!L) return;
  var H = root.EA_HOUSE = {};

  /* ── small shared helpers (Node and browser) ───────────────────── */
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function plain(h) { return String(h).replace(/<[^>]+>/g, '').replace(/"/g, '&quot;'); }
  function table(cap, head, rows, cls) {
    cls = cls || 'st-t';
    return '<table class="' + cls + (rows.length > 5 ? ' st-t--long' : '') + '"><caption>' + cap + '</caption><thead><tr>' + head.map(function (h) { return '<th scope="col">' + h + '</th>'; }).join('') + '</tr></thead><tbody>' +
      rows.map(function (r) { return '<tr' + (r.hot ? ' class="hot"' : '') + '>' + r.cells.map(function (c, i) { return i === 0 ? '<th scope="row">' + c + '</th>' : '<td data-h="' + plain(head[i]) + '">' + c + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table>';
  }
  function byId(list, id) { for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i]; return null; }
  var PER = {}, DEV = {}, ROOM = {}, NET = {};
  L.people.forEach(function (p) { PER[p.id] = p; });
  L.devices.forEach(function (d) { DEV[d.id] = d; });
  L.rooms.forEach(function (r) { ROOM[r.id] = r; });
  L.networks.forEach(function (n) { NET[n.id] = n; });
  var CHAIN = {}; L.chain.forEach(function (c) { CHAIN[c[0]] = c[1]; });
  var STREAM = {}; L.streams.forEach(function (s) { STREAM[s[0]] = s[1]; });
  function bits(n, on) { var s = ''; for (var i = 0; i < n; i++) s += on ? '1' : '0'; return s; }
  function parseBits(s, n, dflt) { s = String(s || ''); if (!/^[01]+$/.test(s) || s.length !== n) return dflt; return s; }
  H.esc = esc;

  /* ═══ 24a · The graph grows: one arrow, fourteen answers ═══ */
  H.consentWord = function (a) { return a.consentBy === 'subject' ? 'the person it is about' : a.consentBy === 'owner' ? 'the device or account owner only' : 'nobody'; };
  H.unanswered = function (a) { return L.questions.filter(function (q) { return a[q[0]] == null; }); };

  /* ═══ 24 · One home. Three clouds. ═══
   * Twelve documented ways separate devices come to share an identity. None needs one
   * assistant to hand a recording to another. `sets` = alternative routes to a fact. */
  H.mechs = [
    { id: 'ip',      t: 'Shared Wi-Fi and one public IP address', what: 'Every device in the house reaches the internet from the same address. Services and ad networks that see several devices at that address can treat them as one household.', control: 'Never join on IP address or network; treat a shared address as coincidence, not identity.', edge: ['house', 'graph'] },
    { id: 'ids',     t: 'Email, phone number and hashed identifiers', what: 'The same email or phone number is registered with several services. Hashing it makes a consistent join key, not an anonymous one.', control: 'Per-service identifiers; no hashed-email matching for advertising.', edge: ['phone', 'graph'] },
    { id: 'acct',    t: 'Shared cloud accounts', what: 'The kitchen speaker is registered to Theo, so whatever anyone in the kitchen says is filed in Theo’s voice history.', control: 'Profiles per person; a guest mode that keeps visitors out of the owner’s history.', edge: ['speaker', 'cvoice'] },
    { id: 'family',  t: 'Household and family profiles', what: 'Family plans link adults and children in one account group — and some share location with every member by default.', control: 'Review what a family group shares; no location sharing by default.', edge: ['phone', 'cphone'] },
    { id: 'cal',     t: 'Calendars, contacts and notification sync', what: 'A shared family calendar appears on the kitchen display; phone notifications are mirrored to a laptop.', control: 'Shared screens show busy/free, never titles; mirror notifications only to personal devices.', edge: ['display', 'ctherm'] },
    { id: 'skills',  t: 'Third-party skills and integrations', what: 'Linking a service to an assistant or hub (account linking, usually OAuth) connects two companies’ records of the same household.', control: 'Least-privilege scopes; an inventory of linked services the household can see.', edge: ['hub', 'cvoice'] },
    { id: 'bridge',  t: 'Hubs and interoperability bridges', what: 'With Matter, one lock can be controlled by several ecosystems at once. What crosses is device state and commands — the lock is locked, the house is in Away mode — not audio.', control: 'Show every controller on each device; give extra controllers view rights, not operate rights, by default.', edge: ['hub', 'ctherm'] },
    { id: 'sdk',     t: 'Advertising and analytics SDKs', what: 'Code from third parties inside an app sends events — including “arrived home” — to its own servers, tied to an advertising ID.', control: 'SDK allow-lists, a manifest gate on every release, and traffic tests.', edge: ['phone', 'graph'] },
    { id: 'voice',   t: 'Voice matching and profile-selection errors', what: 'When a voice is not recognised, a request can land in the device owner’s history; when a similar voice is recognised, it gets the owner’s personal results.', control: 'Unrecognised voices get no personal results and are not filed under the owner.', edge: ['speaker', 'graph'] },
    { id: 'ble',     t: 'Bluetooth, proximity and presence signals', what: 'Hubs and phones notice which phones and watches are nearby, and when.', control: 'Presence only for people who enrolled in it; nothing stored for anyone else.', edge: ['hub', 'graph'] },
    { id: 'screens', t: 'Shared TVs, speakers and notification surfaces', what: 'A private purchase becomes an ad on the living-room TV; a lock screen names what is in a parcel.', control: 'No sensitive content on shared surfaces; family profiles on shared devices.', edge: ['tv', 'graph'] },
    { id: 'time',    t: 'Timing and location correlation', what: 'Events that happen at the same minute from different devices — the door, a phone joining Wi-Fi, the kettle — belong to the same person.', control: 'Coarsen timestamps outside the security path; don’t keep what you don’t need.', edge: ['house', 'graph'] }
  ];
  H.facts = [
    { id: 'together', t: 'Who lives together', sets: [['ip', 'time'], ['family'], ['acct', 'voice']], human: 'Three people are a household before anyone said so.', sens: false },
    { id: 'sleep', t: 'Who sleeps where', sets: [['ble', 'time'], ['acct', 'time'], ['voice', 'time']], human: 'Which room each person is in at 2 a.m.', sens: true },
    { id: 'empty', t: 'When the house is empty', sets: [['bridge'], ['sdk'], ['ip', 'time']], human: 'The one fact a burglar wants.', sens: true },
    { id: 'ill', t: 'Whether someone is ill', sets: [['voice', 'acct'], ['cal', 'screens'], ['sdk', 'ids']], human: 'A health question asked in the kitchen, filed under someone else’s name.', sens: true },
    { id: 'child', t: 'When a child comes home', sets: [['bridge', 'time'], ['screens', 'ip'], ['family']], human: 'That Mira is home alone from 15:40 on Mondays.', sens: true },
    { id: 'private', t: 'Which private interest belongs to whom', sets: [['ids', 'ip'], ['voice'], ['screens'], ['cal']], human: 'Dana’s appointment, read aloud; her purchase, advertised to the room.', sens: true }
  ];
  H.homeFacts = function (on) {
    return H.facts.map(function (f) {
      var via = null; f.sets.some(function (s) { if (s.every(function (m) { return on.indexOf(m) >= 0; })) { via = s; return true; } return false; });
      return { f: f, known: !!via, via: via };
    });
  };
  function mechName(id) { return byId(H.mechs, id).t; }

  /* ═══ 25 · The guest never clicked Accept ═══ (same rule as the Command Center's P.lifeSensed) */
  H.sensed = function (g, room) {
    return L.sense.filter(function (s) {
      var here = s.rooms === '*' ? room !== 'rm_ruth' && room !== 'rm_porch' : s.rooms.indexOf(room) >= 0;
      if (!here) return false;
      if (s.who === 'code') return !!g.code;
      if (s.who === 'phone') return !!g.phone;
      return true;
    });
  };
  H.guestRooms = ['rm_porch', 'rm_hall', 'rm_kitchen', 'rm_living', 'rm_bed2', 'rm_garage', 'rm_ruth'];
  function keepDays(k) { var m = /(\d+)\s*days?/.exec(k); return /Until/.test(k) ? Infinity : m ? +m[1] : null; }
  H.guestSummary = function (g, room) {
    var s = H.sensed(g, room), bio = s.filter(function (x) { return x.bio; }), keeps = s.map(function (x) { return keepDays(x.keep); }).filter(function (x) { return x != null; });
    var longest = keeps.length ? Math.max.apply(null, keeps) : null;
    return { s: s, bio: bio.length, longest: longest === Infinity ? 'until someone deletes it' : longest != null ? longest + ' days' : '—', outside: s.filter(function (x) { return /Outside/.test(x.keep); }).length };
  };

  /* ═══ 26 · When privacy opens the door ═══ */
  H.stages = [['identity', 'Identity', 'Who is this?'], ['authn', 'Authentication', 'How is that proven?'], ['authz', 'Authorisation', 'Is this person still allowed?'], ['auto', 'Automation', 'What fires without a person?'], ['act', 'Physical action', 'What happens in the world?'], ['record', 'Record', 'What is kept, and who can read it?']];
  /* per case: the stage that breaks, the stage text as it is and with the control. */
  H.door = [
    { id: 'account', t: 'An account is taken over', moment: 'Theo reused his password on a shopping site that was breached. On a Sunday someone signs in to the home app as him.',
      breaks: 'authn', as: { identity: 'Someone claiming to be Theo', authn: 'A reused password, no second factor', authz: 'Full administrator', auto: '—', act: 'None yet', record: 'The activity feed: Away since 09:12; the door history; live cameras' },
      fix: { authn: 'A passkey, or a second factor; breached-password checks', record: 'A new-device alert to both admins' },
      consequence: 'Nobody touches the door. The account says the house has been empty since 09:12, and shows the cameras.', sec: 'Can someone sign in who shouldn’t?', priv: 'What does the account reveal to whoever signs in — and how far back?', evidence: 'Share of admin accounts with a phishing-resistant factor; alerts on new devices, delivered and read.', src: ['ftcring23'] },
    { id: 'pin', t: 'A contractor’s code never expires', moment: 'The plumber came in March. His code was never deleted, and nobody has used it since — so nobody remembers it.',
      breaks: 'authz', as: { identity: 'Whoever types 4-1-7-7', authn: 'Knowing four digits', authz: 'Valid forever — no end date', auto: '—', act: 'The front door opens', record: 'Logged as “Plumber (March)”' },
      fix: { authz: 'Every non-resident code has an end date or a schedule', record: 'A monthly “codes still valid” list to the household' },
      consequence: 'A temporary key became a permanent one by default.', sec: 'Can someone get in who shouldn’t?', priv: 'Does the household know who still holds a key?', evidence: 'Weekly census: non-resident codes with no end date = 0.' },
    { id: 'member', t: 'Someone who left is still an administrator', moment: 'Alex moved out last year and was removed from the Northstar Home app. But the thermostat’s ecosystem still lists Alex — and that ecosystem controls the lock through Matter.',
      breaks: 'authz', as: { identity: 'Alex, signed in to another ecosystem', authn: 'Alex’s own account — valid', authz: 'That ecosystem holds operate rights on the lock', auto: 'Its Away mode shows when the house is empty', act: 'Could lock or unlock', record: 'Outside Northstar: unknown' },
      fix: { authz: 'Removing a member prompts a review of every controller on every device; extra controllers get view rights by default' },
      consequence: 'Removal in one app is not removal from the house.', sec: 'Can a former resident still act on the door?', priv: 'Can a former resident still see who is home?', evidence: 'A controller census per lock: which ecosystems, which privilege, who is in each.', src: ['matter', 'nyt18'] },
    { id: 'history', t: 'The door remembers too much', moment: 'The lock’s history goes back two years, to the minute, for every code.',
      breaks: 'record', as: { identity: 'Each code holder', authn: 'Codes, fingerprints, phones', authz: 'Correct', auto: '—', act: 'Ordinary entries', record: '730 days of who came and went, readable by both admins and by support' },
      fix: { record: '90 days in detail, then counts; each person can see their own entries' },
      consequence: 'Nothing went wrong at the door. The record is the harm: a timetable of each person’s life.', sec: 'Is the log protected?', priv: 'Why does a log of Ines’s working hours exist for two years?', evidence: 'Retention scan: oldest access event ≤ 90 days.' },
    { id: 'garage', t: 'The wrong phone opens the garage', moment: 'The garage opens when “Theo’s phone” arrives. Theo’s old phone is now Mira’s, still signed in as him.',
      breaks: 'identity', as: { identity: '“Theo” — actually a ten-year-old with his old phone', authn: 'A geofence', authz: 'The presence group still lists the old phone', auto: '“Welcome home” disarms and unlocks the garage entry', act: 'The garage entry opens for a child — or for whoever finds the phone', record: 'Logged as Theo' },
      fix: { identity: 'Two signals: the phone and the hub’s Bluetooth, from an enrolled person', auto: 'Unlock and disarm need a confirmation on the phone' },
      consequence: 'A phone is not a person. Devices change hands inside families all the time.', sec: 'Can a device open the door without its owner?', priv: 'Whose movements is the house now recording under Theo’s name?', evidence: 'Every physical action logs the identity and its confidence.' },
    { id: 'voice', t: 'A voice is not a key', moment: '“Nova, unlock the front door.” Nova unlocks for voices it recognises. It recognises Theo’s brother.',
      breaks: 'authn', as: { identity: 'A voice that sounds like Theo', authn: 'Voice match — recognition, not proof', authz: 'Unlock allowed for recognised voices', auto: 'The agent calls lock.unlock', act: 'The door opens', record: 'Agent log: “Theo” unlocked' },
      fix: { authn: 'A PIN or a phone confirmation; voice never authorises unlock', auto: 'Unlock is not an agent tool at all' },
      consequence: 'Recognition was built for personal results, not for doors.', sec: 'Can a similar voice or a recording open the door?', priv: 'Whose voice is being matched against every sentence spoken in the kitchen?', evidence: 'Agent tool audit: no physical action without a confirmation outside the model.', src: ['gvoicematch', 'owasp'] },
    { id: 'bio', t: 'A fingerprint cannot be reset', moment: 'The lock matches fingerprints on the lock itself. The doorbell’s “familiar faces”, by contrast, keeps face templates in the cloud — including faces of people who never enrolled.',
      breaks: 'record', as: { identity: 'Faces seen at the door', authn: 'Not used for entry', authz: '—', auto: 'Announces a name', act: '—', record: 'Face templates kept 180 days, in a cloud index' },
      fix: { record: 'Templates only for people who enrol themselves, matched on the device; nothing central to breach' },
      consequence: 'A leaked password can be changed. A leaked face or fingerprint cannot.', sec: 'Can the template store be breached?', priv: 'Why is the courier in a face index at all?', evidence: 'Unlabelled templates older than 24 hours = 0; no templates in the cloud for on-device features.', src: ['ftcbio23', 'bipa'] },
    { id: 'outage', t: 'The cloud goes down', moment: 'On 20 October the internet is out for four hours. The keypad still works. Remote unlock does not. And the code Dana deleted from the app that morning still opens the door, because the lock has not heard.',
      breaks: 'auto', as: { identity: 'Whoever has a code', authn: 'The lock checks its own copy of the codes', authz: 'Stale: deletions wait for the cloud', auto: 'Cloud routines stop; queued events fire late when it returns', act: 'The deleted code opens the door', record: 'Syncs later' },
      fix: { authz: 'Deletions go to the lock first, then the cloud', auto: 'Security routines drop events older than two minutes' },
      consequence: 'Offline behaviour is a design decision, whether anyone made it or not.', sec: 'What does the lock allow when it cannot reach the cloud?', priv: 'What is buffered, and replayed, when it comes back?', evidence: 'An outage drill: revoke a code offline, confirm it fails at the lock.', src: ['eightsleep25'] }
  ];

  /* ═══ 27 · The routine nobody reviewed ═══ */
  H.rtActions = [
    { id: 'disarm',   t: 'Disarm the alarm', impact: 2, dev: 'dv_alarm', perm: 'alarm.disarm', phys: true },
    { id: 'unlock',   t: 'Unlock the garage entry door', impact: 2, dev: 'dv_lock', perm: 'lock.unlock', phys: true },
    { id: 'lights',   t: 'Hall lights on', impact: 0, dev: 'dv_hub', perm: 'lights', phys: false },
    { id: 'announce', t: 'Announce the next calendar event in the kitchen', impact: 2, dev: 'dv_speaker', perm: 'speaker.announce + calendar.read', phys: false }
  ];
  H.rtControls = [
    { id: 'two',     t: 'Two signals', d: 'Phone and the hub’s Bluetooth, from an enrolled person — not “any phone in the group”.' },
    { id: 'fresh',   t: 'Fresh events only', d: 'Drop presence events older than two minutes instead of replaying them.' },
    { id: 'confirm', t: 'Confirm to unlock or disarm', d: 'A tap on the phone of the person arriving.' },
    { id: 'times',   t: 'Times, not titles', d: '“You have something at four”, never the calendar entry.' },
    { id: 'kill',    t: 'A kill switch by the door', d: 'One button that stops every routine, with a light that shows it.' }
  ];
  /* Simplified model. Identity confidence falls with each weakness; impact compounds when actions combine. */
  H.routineEval = function (act, ctl) {
    var on = function (id) { return act.indexOf(id) >= 0; }, has = function (id) { return ctl.indexOf(id) >= 0; };
    var conf = has('two') && has('fresh') ? 'high' : has('two') || has('fresh') ? 'medium' : 'low';
    var why = conf === 'high' ? 'An enrolled person, confirmed by two signals, now.' : conf === 'medium' ? (has('two') ? 'Two signals — but a late event can still replay.' : 'Fresh events — but any phone in the group still counts, including Mira’s hand-me-down.') : 'Any phone in the group, including Theo’s old phone (now Mira’s), and events replayed up to 45 minutes late.';
    var phys = 0, notes = [];
    if (on('disarm') && on('unlock')) { phys = 4; notes.push('Disarm + unlock together make a silent entry: the alarm that would have sounded when the door opened is already off.'); }
    else if (on('disarm')) { phys = 2; notes.push('Disarm alone leaves the house unguarded but locked.'); }
    else if (on('unlock')) { phys = 2; notes.push('Unlock alone would still trip the alarm on entry.'); }
    if (has('confirm') && phys) { phys = 1; notes.push('A person confirms before anything opens.'); }
    var priv = on('announce') ? (has('times') ? 0 : 2) : 0;
    if (on('announce') && !has('times')) notes.push('The announcement reads a calendar Dana shared a year ago to whoever is in the kitchen.');
    var w = { low: 3, medium: 2, high: 1 }[conf];
    var score = Math.max(phys, priv) * w + (phys && priv ? 1 : 0);
    var band = score >= 9 ? 'HIGH' : score >= 4 ? 'MEDIUM' : 'LOW';
    if (!has('kill')) notes.push('The only way to stop it is the app — on a phone that may be in a tunnel.');
    return { conf: conf, why: why, phys: phys, priv: priv, score: score, band: band, notes: notes,
      confirm: has('confirm') ? 'Yes, for unlock and disarm' : 'None', kill: has('kill') ? 'A button by the door, and the app' : 'In the app only',
      failure: has('fresh') ? 'Late events are dropped; the routine does not fire.' : 'Events queue for up to 45 minutes and then fire.' };
  };
  H.rtAlone = function (ctl) { return H.rtActions.map(function (a) { return { a: a, e: H.routineEval([a.id], ctl) }; }); };

  /* ═══ 28 · The network is a witness ═══ */
  H.netMoments = {
    nw_home: 'At home, the router lists every family device by name. It knows whose phone is home and when — one household connection, every device correlated.',
    nw_guest: 'Lena joins the guest network. Every evening for three weeks the router app shows “Lena’s phone”, and the TV and printer show themselves to her.',
    nw_office: 'At work, Dana’s managed laptop sends its traffic through her employer’s proxy — at the office, and at home.',
    nw_library: 'Between meetings Dana opens her clinic portal on library Wi-Fi, away from her employer’s network. At the next table a student downloads his test results on a public computer and leaves.',
    nw_hotel: 'In the hotel, her laptop offers to cast to the room’s TV — and to the one next door.',
    nw_cafe: 'At the airport her phone joins “Airport_Free_WiFi” by itself. It has seen the name before; so, possibly, has someone else.',
    nw_hotspot: 'On her own hotspot, only her mobile carrier sees the envelope.',
    nw_cell: 'On cellular, the carrier always knows the subscriber, and which tower — roughly where she is.'
  };
  H.netRows = [['letter', 'What the page says'], ['site', 'Which site'], ['addr', 'Server address, time and volume'], ['device', 'Which device'], ['person', 'Who she is'], ['announce', 'What her device announces nearby'], ['stays', 'What stays behind']];
  H.netSees = function (id, o) {
    var n = NET[id] || L.networks[0], vpn = !!o.vpn, dns = !!o.dns, mac = !!o.mac, cell = n.trust === 'carrier', managed = n.trust === 'managed';
    var who = cell ? 'the carrier' : managed ? 'her employer' : 'this network’s operator';
    var r = {};
    r.letter = 'Only the site. HTTPS encrypts it on every network.';
    r.site = vpn ? 'The VPN provider — not ' + who + (managed ? ' (unless the managed laptop’s proxy runs before the VPN)' : '') + '.'
      : dns ? who.charAt(0).toUpperCase() + who.slice(1) + ' still sees the server name in the connection, unless the site uses Encrypted Client Hello. Her DNS lookups now go to her own resolver.'
      : who.charAt(0).toUpperCase() + who.slice(1) + ', from her DNS lookups and the server name in each connection.';
    r.addr = vpn ? 'The VPN provider. ' + who.charAt(0).toUpperCase() + who.slice(1) + ' sees only that she uses a VPN, when, and how much.' : who.charAt(0).toUpperCase() + who.slice(1) + ': every destination address, when, and how much.';
    r.device = cell ? n.identity : managed ? 'Her work laptop’s certificate — private addresses are disabled by policy.' : mac ? 'A private address for this network (' + n.randomize.toLowerCase().replace(/\.$/, '') + ').' : 'Her hardware address — the same on every network, a thread through all of them.';
    r.person = n.portal === 'None.' || n.portal === '—' ? (cell ? 'The subscriber, always.' : managed ? 'Her work account.' : 'Nobody asked.') : 'Whatever the portal asked: ' + n.portal.replace(/\.$/, '').toLowerCase() + '.';
    r.announce = n.discovery;
    r.stays = [n.persist, n.history].filter(function (x) { return x && x !== '—'; }).join(' ') || '—';
    return r;
  };
  H.netToggles = [['dns', 'Encrypted DNS'], ['mac', 'Private Wi-Fi address'], ['vpn', 'VPN']];

  /* ═══ 29 · The house made an inference ═══ (same rule as the Command Center's P.lifeInfer) */
  H.observed = { thermo: '03:04 · heating raised to 23°', motion: '03:10 · bathroom motion (5th time since midnight)', door: '15:41 · front door · code: Mira', garage: '07:52 · garage opened, closed', energy: '06:10 · kettle, 2.1 kW',
    wifi: '22:30 · Theo’s phone left the network (9 of 14 nights)', tv: '15:45 · children’s channel', voice: '03:12 · “remind me to take my tablets”', location: '08:05 · all phones outside the geofence', sleep: '23:41–06:38 · watch: asleep, restless' };
  H.infer = function (on) {
    return L.inferences.map(function (x) {
      var ok = x.needs.every(function (s) { return on.indexOf(s) >= 0; }), extra = x.adds.filter(function (s) { return on.indexOf(s) >= 0; });
      return { x: x, ok: ok, conf: ok ? Math.min(0.95, x.base + x.step * extra.length) : 0, used: ok ? x.needs.concat(extra) : [], missing: x.needs.filter(function (s) { return on.indexOf(s) < 0; }) };
    });
  };
  H.never = function (x) { return /never be computed/.test(x.expiry); };
  H.explain = function (r) { return 'Because ' + r.used.map(function (s) { return STREAM[s].toLowerCase(); }).join(', ') + (r.used.length > 1 ? ' changed together' : ' changed') + ' — ' + Math.round(r.conf * 100) + '% sure, not a fact.'; };
  H.anchorName = function (a) { return { home: 'One home. Three clouds.', guest: 'The guest never clicked Accept', door: 'When privacy opens the door', routine: 'The routine nobody reviewed', network: 'The network is a witness', history: 'The history hole', infer: 'The house made an inference', 'house-guide': 'The rest of a connected life', oldkeys: 'The old owner still has the keys' }[a] || a; };

  /* ═══ 30 · The old owner still has the keys ═══ */
  H.remains = function (tr, care) {
    var ci = { r: 0, c: 1, t: 2 }[care] || 0;
    return L.layers.map(function (l) { var v = tr.rows[l[0]][ci]; return { l: l, v: v, na: v === '—', left: !!v && v !== '—' }; });
  };

  /* ═══ Field guide: the environments that get a row, not a scene ═══ */
  H.guide = [
    ['Connected and rental cars', 'Dana pairs her phone with a rental car for a work trip.', 'The head unit copies contacts, call logs, messages and destinations; the carmaker’s cloud keeps trips.', 'The next renter, and the carmaker’s data partners.', 'Delete paired-device data before returning it; charge from a plug adapter, not the car’s USB; ask the maker for your data.', 'The head unit’s paired list is empty; a data request answered.', ['ftcrental', 'ftcgm26', 'subaru25']],
    ['Wearables and health devices', 'Dana’s watch logs a restless night.', 'Heart rate, sleep and movement sync to an app and often to analytics partners.', 'Health apps can share outside the rules people expect for medicine.', 'No health data for advertising; on-device summaries; deletion that reaches partners.', 'Traffic tests show no health events leaving to ad partners.', ['flo21']],
    ['Smart TVs and viewing recognition', 'Mira watches cartoons at 15:45.', 'Content recognition fingerprints the screen every few seconds and ties it to the home’s IP address.', 'The TV maker, and whoever buys “household” viewing data.', 'Turn off viewing information; family profiles; no household matching on IP.', 'The setting off, and verified by traffic.', ['vizio17']],
    ['Printers, scanners and print queues', 'Dana prints her lease at the library.', 'Copiers and printers store images of documents on their drives; queues keep file names.', 'The next user, the next owner of the machine.', 'Wipe or encrypt drives; delete queues; wipe before disposal.', 'A disposal certificate per device.', ['ftccopier10']],
    ['Bluetooth trackers and proximity networks', 'A tracker rides along in a bag.', 'Crowd-sourced finding networks report a tag’s location through strangers’ phones.', 'The owner learns where you are, not where their keys are.', 'Unwanted-tracker alerts across platforms; sound on the tag; scan on demand.', 'Alerts fire on both major phone platforms.', ['dult']],
    ['Cloud clipboard, sync and notification mirroring', 'A sign-in code copied on the phone appears on a shared laptop.', 'Clipboards, photos and notifications follow an account, not a person or a room.', 'Whoever is at the other screen.', 'Sync off on shared devices; notifications mirrored only to personal ones.', 'An inventory of which devices mirror what.', ['uniclip', 'mirroring']],
    ['Shared tablets and family accounts', 'The family tablet is still signed in as Dana.', 'Family groups share purchases, photos and sometimes location by default.', 'Everyone in the group — including a child, or an ex.', 'A family profile on shared devices; review what the group shares.', 'Each shared device runs a family or guest profile.', ['applefamily', 'sharedlib']],
    ['Public charging and USB trust', 'Dana charges at an airport kiosk.', 'A USB port can carry data as well as power; researchers bypassed phones’ trust prompts in 2025.', 'Whoever built the kiosk — though documented real-world cases are hard to find.', 'Use your own plug; decline data prompts; update the phone.', 'Phone updated past the vendor fixes.', ['fccjuice', 'choicejack25']],
    ['Old phones, routers, speakers and TVs', 'The old router is sold online.', 'Configuration, passwords and device lists survive a sale; research on second-hand business routers found many still held sensitive data.', 'The buyer.', 'Factory reset, remove from every account, delete cloud backups.', 'The device absent from every account and backup.', ['eset23']],
    ['Tenant and homeowner transitions', 'A new family moves into a flat with a smart entry system.', 'Access systems keep entry logs; some use faces or fingerprints.', 'The landlord, the system’s vendor — and the next tenant.', 'Consent for biometrics, short retention, and a ban on tracking guests or relationships.', 'A retention schedule; destruction records.', ['nyctdpa']],
    ['Resale, reset and continued cloud membership', 'Theo sells the car.', 'A factory reset clears the device, not the cloud account that can still locate and unlock it.', 'The previous owner — for years.', 'Remove the vehicle from the maker’s account; reset the head unit; tell the maker.', 'The previous owner’s app shows no vehicle.', ['henderson17']],
    ['Account recovery and delegated administrators', 'Someone ports Theo’s phone number.', 'Recovery flows trust a phone number, an email or a helpful support agent.', 'Whoever controls recovery controls the house.', 'Passkeys; a carrier port-out lock; no recovery by SMS alone for admins.', 'Admin recovery methods reviewed quarterly.', ['fccsim23']],
    ['Stalkerware and technology-facilitated abuse', 'An ex-partner still has the thermostat app.', 'Abuse mostly uses ordinary features — shared accounts, location sharing, smart-home controls — not exotic hacking.', 'The person trying to leave.', 'Safety reviews that show and revoke access; plan before revoking, because removal can alert the other person.', 'Safety-check flows tested with advocates.', ['freed18', 'nyt18', 'spyfone21', 'safetycheck']],
    ['Employee, student and tenant monitoring', 'Dana’s laptop, Mira’s school tablet.', 'Monitoring software and managed proxies record activity under an institution’s identity — sometimes at home.', 'Employers, schools, landlords.', 'Proportionate, disclosed, narrow; personal devices out of scope.', 'A published monitoring notice; a data-protection assessment.', ['icoworkers', 'cdt22', 'applemdm']],
    ['Emergency access and break-glass', 'A paramedic needs to get in; a relative needs an account after a death.', 'Emergency paths bypass the usual checks — by design.', 'Anyone who can trigger or impersonate the emergency.', 'Break-glass that is time-boxed, logged and reviewed; legacy contacts named in advance.', 'Every break-glass use reviewed within a day.', ['legacy']],
    ['End of support and abandoned clouds', 'A hub stops working when its company does.', 'Cloud-dependent devices fail when the service ends — sometimes with no warning.', 'Everyone who relied on the lock, the alarm or the thermostat.', 'Local control that survives the cloud; a published support period.', 'The support end date on the box; an offline drill.', ['insteon22', 'revolv16', 'psti24', 'cra24']],
    ['Assistants that remember and act', 'Nova reads a calendar invite that contains instructions.', 'An assistant that can both remember things and operate devices can be steered by text it reads.', 'Anyone who can put text in front of it.', 'No physical tools without a person’s confirmation outside the model; memory the household can see and delete.', 'A tool audit: no unlock, open, disarm or start without confirmation.', ['invite25', 'owasp', 'alexaplus']]
  ];

  /* ── static fallbacks (the build writes these into the HTML) ───── */
  function srcLink(k) { var S = root.EA_SOURCES && root.EA_SOURCES[k]; if (!S) return ''; return ' <a class="src" data-src="' + k + '" href="' + esc(S.u) + '">' + esc(S.l || k) + '</a>'; }
  H.statics = {
    model: function () {
      var a = byId(L.arrows, 'ar_presence');
      return table('The fourteen questions, answered for one arrow: ' + esc(a.title), ['Question', 'Answer'], L.questions.map(function (q, i) {
        var v = a[q[0]]; return { hot: v == null, cells: [(i + 1) + '. ' + esc(q[1]), v == null ? '<b>Unknown — a finding</b>' : q[0] === 'cross' ? esc(v.join(', ')) : esc(v)] }; })) +
        table('Every traced arrow in Dana’s household', ['Arrow', 'Path', 'Consent from', 'Can trigger a physical action', 'Unanswered'], L.arrows.map(function (a) {
          var u = H.unanswered(a).length; return { hot: a.consentBy !== 'subject' && u > 0, cells: [esc(a.title), esc(a.path.map(function (k) { return CHAIN[k]; }).join(' → ')), esc(H.consentWord(a)), /^No\b/.test(a.phys) ? 'No' : '<b>Yes</b>', u ? '<b>' + u + ' of 14</b>' : '0'] }; }), 'st-t st-t--wide');
    },
    homegraph: function () {
      return table('What the household graph learns, and the routes to each fact (any one route is enough)', ['Fact', 'Known through any of', 'For the household'], H.facts.map(function (f) {
        return { hot: f.sens, cells: [esc(f.t), f.sets.map(function (s) { return esc(s.map(mechName).join(' + ')); }).join('<br>or '), esc(f.human)] }; })) +
        table('Twelve ways separate devices come to share an identity', ['Mechanism', 'What happens', 'The control'], H.mechs.map(function (m) { return { cells: [esc(m.t), esc(m.what), esc(m.control)] }; }), 'st-t st-t--wide');
    },
    guest: function () {
      return table('What the house takes from each person who comes into range', ['Person', 'Where', 'Sensors that take something', 'Biometric', 'Kept longest', 'What they agreed to'], L.guests.map(function (g) {
        var s = H.guestSummary(g, g.room), p = PER[g.pid];
        return { hot: s.bio > 0, cells: [esc(g.moment).replace(esc(p.name), '<b>' + esc(p.name) + '</b>'), esc(ROOM[g.room].name), s.s.length ? s.s.map(function (x) { return esc(x.sensor) + ' (' + esc(DEV[x.dev].name) + ')'; }).join('; ') : 'none', s.bio ? '<b>Yes</b>' : 'No', esc(s.longest), esc(g.agreed)] };
      }), 'st-t st-t--wide');
    },
    door: function () {
      return table('Eight ways a door opens that nobody decided', ['Case', 'The link that breaks', 'What happens', 'Security asks', 'Privacy asks', 'The control', 'The evidence'], H.door.map(function (c) {
        var st = H.stages.filter(function (s) { return s[0] === c.breaks; })[0];
        return { hot: true, cells: ['<b>' + esc(c.t) + '</b> ' + esc(c.moment), esc(st[1]) + ': ' + esc(c.as[c.breaks]), esc(c.consequence), esc(c.sec), esc(c.priv), esc(Object.keys(c.fix).map(function (k) { return c.fix[k]; }).join('; ')), esc(c.evidence)] };
      }), 'st-t st-t--wide');
    },
    routine: function () {
      var all = H.rtActions.map(function (a) { return a.id; });
      var cfgs = [[[], 'As Theo built it'], [['two'], '+ two signals'], [['two', 'fresh'], '+ fresh events only'], [['two', 'fresh', 'confirm'], '+ confirm to unlock or disarm'], [['two', 'fresh', 'confirm', 'times'], '+ times, not titles'], [['two', 'fresh', 'confirm', 'times', 'kill'], '+ a kill switch']];
      return table('“Welcome home”: presence → disarm → unlock → lights → announce, with each control added', ['Configuration', 'Identity confidence', 'Human confirmation', 'When the network fails', 'Risk (simplified model)'], cfgs.map(function (c) {
        var e = H.routineEval(all, c[0]); return { hot: e.band === 'HIGH', cells: [esc(c[1]), esc(e.conf) + ' — ' + esc(e.why), esc(e.confirm), esc(e.failure), '<b>' + e.band + '</b>'] }; }), 'st-t st-t--wide') +
        table('Each action alone, and all of them together (as built)', ['Action', 'Alone', 'Why'], H.rtAlone([]).map(function (x) { return { cells: [esc(x.a.t), x.e.band, esc(x.e.notes[0] || 'Harmless alone.')] }; }).concat([{ hot: true, cells: ['<b>All four together</b>', '<b>' + H.routineEval(all, []).band + '</b>', esc(H.routineEval(all, []).notes[0])] }]));
    },
    network: function () {
      return table('The same person on eight networks: who sees the envelope', ['Network', 'The moment', 'Which site, and when', 'Who she is to it', 'What her device announces', 'What stays behind'], L.networks.map(function (n) {
        var r = H.netSees(n.id, { mac: true }); return { cells: ['<b>' + esc(n.name) + '</b> <small>(' + esc(n.trust) + ')</small>', esc(H.netMoments[n.id]), esc(r.site), esc(r.person), esc(r.announce), esc(r.stays)] }; }), 'st-t st-t--wide') +
        table('What changes with encrypted DNS, or a VPN (library Wi-Fi)', ['', 'As it is', 'Encrypted DNS', 'VPN'], H.netRows.slice(0, 3).map(function (row) {
          return { cells: [esc(row[1]), esc(H.netSees('nw_library', {})[row[0]]), esc(H.netSees('nw_library', { dns: true })[row[0]]), esc(H.netSees('nw_library', { vpn: true })[row[0]])] }; }), 'st-t st-t--wide');
    },
    infer: function () {
      var all = L.streams.map(function (s) { return s[0]; }), R = H.infer(all);
      return table('Observed: one ordinary event from each stream', ['Stream', 'An observed event'], L.streams.map(function (s) { return { cells: [esc(s[1]), esc(H.observed[s[0]])] }; })) +
        table('Inferred: the inference registry, with all ten streams (simplified confidence model)', ['Claim', 'Source', 'Confidence', 'Purpose (permitted)', 'Never', 'Correction and appeal', 'Expiry'], R.map(function (r) {
          var x = r.x; return { hot: x.sensitive, cells: [esc(x.claim) + (x.sensitive ? ' <small>(sensitive)</small>' : ''), esc(x.needs.concat(x.adds).map(function (s) { return STREAM[s]; }).join(', ')), Math.round(r.conf * 100) + '%', esc(x.uses), esc(x.never), esc(x.correct) + ' · Appeal: ' + esc(x.appeal), H.never(x) ? '<b>' + esc(x.expiry) + '</b>' : esc(x.expiry)] }; }), 'st-t st-t--wide');
    },
    oldkeys: function () {
      return L.transitions.map(function (tr) {
        return table(esc(tr.title) + ' — what remains at each layer', ['Layer'].concat(L.care.map(function (c) { return esc(c[1]); })), L.layers.map(function (l) {
          var row = tr.rows[l[0]]; return { hot: !!row[1] && row[1] !== '—', cells: [esc(l[1])].concat(row.map(function (v) { return v === '—' ? '<small>not involved</small>' : v ? esc(v) : 'Nothing'; })) }; }), 'st-t st-t--wide');
      }).join('');
    },
    solutions: function () {
      return table('The engineering answers to the connected-life problems', ['Problem', 'Engineering solution', 'Explained in', 'Runs in the Command Center'], L.solutions.map(function (x) {
        return { cells: ['<b>' + esc(x.problem) + '</b>', esc(x.parts.join('; ')) + '.', '<a href="#' + esc(x.essay) + '">' + esc(H.anchorName(x.essay)) + '</a>', x.route ? '<a href="/privacy-command-center/v10/#/' + esc(x.route) + '">' + esc(x.route) + '</a>' : '—'] }; }), 'st-t st-t--wide');
    },
    fieldguide: function () {
      return table('The rest of a connected life, one row each', ['Where', 'The moment', 'The mechanism', 'The hidden join or boundary', 'The control', 'The evidence'], H.guide.map(function (g) {
        return { cells: ['<b>' + esc(g[0]) + '</b>' + g[6].map(srcLink).join(''), esc(g[1]), esc(g[2]), esc(g[3]), esc(g[4]), esc(g[5])] }; }), 'st-t st-t--wide');
    }
  };

  /* ═════════════ browser: the interactive figures ═════════════ */
  var EA = root.EA, d = root.document;
  if (!EA || !d) return;
  var $ = EA.$, $$ = EA.$$, el = EA.el;
  function host(id) { var f = d.getElementById('fig-' + id); return f && $('.fig-live [data-house="' + id + '"]', f); }
  function clamp(i, n) { i = parseInt(i, 10); return isNaN(i) ? 0 : Math.max(0, Math.min(n - 1, i)); }
  function radios(parent, items, label, onPick, cls) {
    var g = el('div', { role: 'radiogroup', 'aria-label': label, 'class': 'hs-radios' + (cls ? ' ' + cls : '') });
    var btns = items.map(function (html, i) { var b = el('button', { type: 'button', role: 'radio', 'class': 'tog' }, html); b.addEventListener('click', function () { onPick(i); }); g.appendChild(b); return b; });
    EA.arrowKeys(g, 'button'); parent.appendChild(g); return btns;
  }
  function checkR(btns, i) { EA.select(btns, i, 'aria-checked'); }
  function toggles(parent, items, label, onToggle, cls) {
    var g = el('div', { role: 'group', 'aria-label': label, 'class': 'hs-toggles' + (cls ? ' ' + cls : '') });
    var btns = items.map(function (html, i) { var b = el('button', { type: 'button', 'class': 'tog', 'aria-pressed': 'false' }, html); b.addEventListener('click', function () { onToggle(i); }); g.appendChild(b); return b; });
    parent.appendChild(g); return btns;
  }
  function press(btns, str) { btns.forEach(function (b, i) { b.setAttribute('aria-pressed', str[i] === '1' ? 'true' : 'false'); }); }
  function flip(str, i) { return str.slice(0, i) + (str[i] === '1' ? '0' : '1') + str.slice(i + 1); }
  function onIds(list, str) { return list.filter(function (x, i) { return str[i] === '1'; }).map(function (x) { return x.id || x[0]; }); }
  function unk(t) { return '<em class="hs-unk">' + esc(t || 'Unknown — a finding') + '</em>'; }

  /* ── 24a · The graph grows ── */
  (function () {
    var h = host('model'); if (!h) return;
    var A = L.arrows, cur = 1;
    var chain = el('ol', { 'class': 'hs-chain', 'aria-label': 'The enlarged privacy graph' });
    L.chain.forEach(function (c) { chain.appendChild(el('li', { 'data-k': c[0] }, '<b>' + esc(c[1]) + '</b><span>' + esc(c[2]) + '</span>')); });
    var btns = radios(h, A.map(function (a) { return esc(a.title); }), 'Choose an arrow', function (i) { cur = i; draw(); EA.changed('model'); }, 'hs-radios--list');
    h.appendChild(chain);
    var card = el('div', { 'class': 'hs-card' }); h.appendChild(card);
    function draw() {
      var a = A[cur]; checkR(btns, cur);
      $$('li', chain).forEach(function (li) { var on = a.path.indexOf(li.getAttribute('data-k')) >= 0; li.classList.toggle('on', on); li.classList.toggle('last', on && li.getAttribute('data-k') === a.path[a.path.length - 1]); });
      var u = H.unanswered(a).length;
      card.innerHTML = '<p class="hs-card-k">' + esc(a.title) + (a.outside ? ' <span class="lab lab--ill">' + esc(a.label) + '</span>' : '') + '</p>' +
        '<p class="hs-consent">Consent came from <b class="' + (a.consentBy === 'subject' ? 'ok' : 'hot') + '">' + esc(H.consentWord(a)) + '</b>. ' + (u ? '<b class="hot">' + u + ' of 14</b> questions have no answer.' : 'All fourteen questions have an answer.') + '</p>' +
        '<dl class="hs-14">' + L.questions.map(function (q, i) { var v = a[q[0]];
          var val = v == null ? unk() : q[0] === 'cross' ? L.boundaries.map(function (b) { return '<span class="hs-b' + (v.indexOf(b[0]) >= 0 ? ' on' : '') + '">' + esc(b[1]) + '</span>'; }).join(' ') : esc(v);
          return '<div' + (v == null ? ' class="u"' : q[0] === 'phys' && !/^No\b/.test(v) ? ' class="p"' : '') + '><dt><span>' + (i + 1) + '</span>' + esc(q[1]) + '</dt><dd>' + val + '</dd></div>'; }).join('') + '</dl>';
    }
    draw();
    EA.fig('model', { get: function () { return String(cur); }, set: function (s) { cur = clamp(s, A.length); draw(); }, reset: function () { cur = 1; draw(); },
      read: function () { var a = A[cur], u = H.unanswered(a).length; return '<b>' + esc(a.title) + ':</b> ' + esc(a.path.map(function (k) { return CHAIN[k]; }).join(' → ')) + '. Consent from ' + esc(H.consentWord(a)) + '. ' + (/^No\b/.test(a.phys) ? 'No physical action.' : 'Can trigger a physical action.') + ' ' + (u ? u + ' of 14 questions unanswered — each one a finding.' : 'All 14 answered.'); } });
  })();

  /* ── 24 · One home. Three clouds. ── */
  (function () {
    var h = host('homegraph'); if (!h) return;
    var n = H.mechs.length, st = bits(n, true), ALL = bits(n, true);
    var ctl = el('div', { 'class': 'hs-hg-ctl' }); h.appendChild(ctl);
    var pre = el('div', { 'class': 'hs-presets' }, '<button type="button" class="btn btn--sm" data-p="1">Everything on — as installed</button> <button type="button" class="btn btn--sm" data-p="0">Everything off</button>');
    ctl.appendChild(pre);
    var btns = toggles(ctl, H.mechs.map(function (m) { return esc(m.t); }), 'Join mechanisms', function (i) { st = flip(st, i); draw(); EA.changed('homegraph'); }, 'hs-toggles--list');
    $$('[data-p]', pre).forEach(function (b) { b.addEventListener('click', function () { st = bits(n, b.getAttribute('data-p') === '1'); draw(); EA.changed('homegraph'); }); });
    var out = el('div', { 'class': 'hs-hg-out' }); h.appendChild(out);
    var svg = el('div', { 'class': 'hs-hg-map', 'aria-hidden': 'true' }); out.appendChild(svg);
    var facts = el('ul', { 'class': 'hs-facts' }); out.appendChild(facts);
    var P = { house: [300, 318], phone: [62, 222], speaker: [136, 222], display: [210, 222], hub: [136, 300], tv: [210, 300], cvoice: [90, 52], cphone: [240, 52], ctherm: [390, 52], graph: [440, 250] };
    function map(on) {
      var s = '<svg viewBox="0 0 520 360"><rect x="20" y="170" width="280" height="176" rx="14" class="hs-house"/><text x="32" y="190" class="hs-lbl">14 ALDER LANE</text>' +
        '<g class="hs-clouds">' + [['cvoice', 'Voice-assistant cloud'], ['cphone', 'Phone-maker cloud'], ['ctherm', 'Thermostat cloud']].map(function (c) { var p = P[c[0]]; return '<rect x="' + (p[0] - 62) + '" y="' + (p[1] - 26) + '" width="124" height="52" rx="26"/><text x="' + p[0] + '" y="' + (p[1] + 4) + '" text-anchor="middle">' + c[1] + '</text>'; }).join('') + '</g>' +
        '';
      var seen = {};
      H.mechs.forEach(function (m) { var k = m.edge.join('-'), a = P[m.edge[0]], b = P[m.edge[1]], lit = on.indexOf(m.id) >= 0; if (seen[k] && !lit) return; seen[k] = 1;
        var mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2 + (m.edge[1] === 'graph' ? -26 : 0);
        s += '<path d="M' + a[0] + ' ' + a[1] + ' Q' + mx + ' ' + my + ' ' + b[0] + ' ' + b[1] + '" class="hs-e' + (lit ? ' on' : '') + '"/>'; });
      s += '<rect x="' + (P.graph[0] - 66) + '" y="' + (P.graph[1] - 30) + '" width="132" height="60" rx="10" class="hs-graph' + (on.length ? ' on' : '') + '"/><text x="' + P.graph[0] + '" y="' + (P.graph[1] - 4) + '" text-anchor="middle" class="hs-gt">IDENTITY GRAPH</text><text x="' + P.graph[0] + '" y="' + (P.graph[1] + 14) + '" text-anchor="middle" class="hs-gs">' + H.homeFacts(on).filter(function (f) { return f.known; }).length + ' of 6 facts</text>';
      [['phone', 'Phones'], ['speaker', 'Speaker'], ['display', 'Display'], ['hub', 'Hub'], ['tv', 'TV']].forEach(function (x) { var p = P[x[0]]; s += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="7" class="hs-dot"/><text x="' + p[0] + '" y="' + (p[1] + 22) + '" text-anchor="middle" class="hs-dl">' + x[1] + '</text>'; });
      return s + '</svg>';
    }
    function draw() {
      press(btns, st); var on = onIds(H.mechs, st);
      svg.innerHTML = map(on);
      facts.innerHTML = H.homeFacts(on).map(function (r) { return '<li class="' + (r.known ? 'k' : 'n') + '"><b>' + esc(r.f.t) + '</b><span>' + (r.known ? 'Known — through ' + esc(r.via.map(mechName).join(' + ')) + '. ' + esc(r.f.human) : 'Not knowable with these mechanisms off.') + '</span></li>'; }).join('');
    }
    draw();
    EA.fig('homegraph', { get: function () { return st; }, set: function (s) { st = parseBits(s, n, ALL); draw(); }, reset: function () { st = ALL; draw(); },
      read: function () { var on = onIds(H.mechs, st), R = H.homeFacts(on), k = R.filter(function (r) { return r.known; }); return 'With ' + on.length + ' of ' + n + ' join mechanisms, the household graph knows ' + (k.length ? k.map(function (r) { return r.f.t.toLowerCase(); }).join('; ') : 'nothing') + '. ' + (k.length < R.length ? 'It cannot tell ' + R.filter(function (r) { return !r.known; }).map(function (r) { return r.f.t.toLowerCase(); }).join('; ') + '.' : 'No assistant had to share a recording.'); } });
  })();

  /* ── 25 · The guest never clicked Accept ── */
  (function () {
    var h = host('guest'); if (!h) return;
    var G = L.guests, gi = 2, ri = H.guestRooms.indexOf(G[2].room);
    var pb = radios(h, G.map(function (g) { return '<b>' + esc(PER[g.pid].name) + '</b>'; }), 'Who comes in', function (i) { gi = i; ri = H.guestRooms.indexOf(G[i].room); draw(); EA.changed('guest'); }, 'hs-radios--people');
    var rb = radios(h, H.guestRooms.map(function (r) { return esc(ROOM[r].name); }), 'Which room', function (i) { ri = i; draw(); EA.changed('guest'); }, 'hs-radios--rooms');
    var body = el('div', { 'class': 'hs-guest' }); h.appendChild(body);
    function plan(room, s) {
      var rooms = L.rooms.filter(function (r) { return r.place === 'pl_alder'; }), devs = s.map(function (x) { return x.dev; });
      var sv = '<svg viewBox="-4 -4 760 472" aria-hidden="true">';
      rooms.forEach(function (r) { sv += '<rect x="' + r.x + '" y="' + r.y + '" width="' + r.w + '" height="' + r.h + '" class="hs-room' + (r.outside ? ' out' : '') + (r.id === room ? ' here' : '') + '"/><text x="' + (r.x + 8) + '" y="' + (r.y + 16) + '" class="hs-lbl">' + esc(r.name.toUpperCase()) + '</text>'; });
      sv += '<rect x="620" y="220" width="130" height="130" class="hs-room' + (room === 'rm_ruth' ? ' here' : '') + '"/><text x="628" y="236" class="hs-lbl">RUTH’S KITCHEN</text><text x="628" y="250" class="hs-lbl">(HARBOUR COURT)</text>';
      L.devices.forEach(function (dv) { var r = dv.room ? ROOM[dv.room] : dv.id === 'dv_ruth' ? { x: 620, y: 220 } : null; if (!r) return;
        var i = dv.room ? L.devices.filter(function (o) { return o.room === dv.room && L.devices.indexOf(o) < L.devices.indexOf(dv); }).length : 0;
        var x = r.x + 14, y = r.y + 36 + (dv.id === 'dv_ruth' ? 18 : 0) + i * 22, hot = devs.indexOf(dv.id) >= 0;
        sv += '<g class="hs-dv' + (hot ? ' hot' : '') + '"><rect x="' + x + '" y="' + (y - 7) + '" width="12" height="12" rx="3"/><text x="' + (x + 17) + '" y="' + (y + 3) + '">' + esc(dv.short || dv.name) + '</text></g>'; });
      var R = room === 'rm_ruth' ? { x: 620, y: 220, w: 130, h: 130 } : ROOM[room];
      sv += '<g class="hs-who"><circle cx="' + (R.x + R.w - 22) + '" cy="' + (R.y + R.h - 26) + '" r="9"/><path d="M' + (R.x + R.w - 34) + ' ' + (R.y + R.h - 4) + ' q12 -18 24 0"/></g>';
      if (s.some(function (x) { return x.rooms === '*'; })) sv += '<text x="380" y="466" text-anchor="middle" class="hs-lbl hs-lbl--hot">+ WI-FI AND BLUETOOTH, ANYWHERE IN THE HOUSE</text>';
      return sv + '</svg>';
    }
    function draw() {
      checkR(pb, gi); checkR(rb, ri);
      var g = G[gi], room = H.guestRooms[ri], S = H.guestSummary(g, room), p = PER[g.pid];
      body.innerHTML = '<p class="hs-moment">' + esc(g.moment) + '</p>' +
        '<div class="hs-guest-g"><div class="hs-plan">' + plan(room, S.s) + '</div><div>' +
        '<div class="hs-meters"><div><b>' + S.s.length + '</b><span>sensors take something</span></div><div><b>' + S.bio + '</b><span>biometric</span></div><div><b>' + esc(S.longest) + '</b><span>kept longest</span></div></div>' +
        '<p class="hs-agreed"><b>What ' + esc(p.name) + ' agreed to:</b> ' + esc(g.agreed) + '</p>' +
        (S.s.length ? '<ul class="hs-sensed">' + S.s.map(function (x) { return '<li' + (x.bio ? ' class="bio"' : '') + '><b>' + esc(x.sensor) + '</b> <span class="hs-dvn">' + esc(DEV[x.dev].name) + '</span><span>' + esc(x.what) + (x.bio ? ' · <b>biometric</b>' : '') + '</span><span>Kept: ' + (/Outside/.test(x.keep) ? unk(x.keep) : esc(x.keep)) + ' · Replay: ' + esc(x.replay) + '</span><span class="hs-ctl">Control: ' + esc(x.control) + '</span></li>'; }).join('') + '</ul>' : '<p>No sensor here takes anything from ' + esc(p.name) + '.</p>') +
        '</div></div>';
    }
    draw();
    EA.fig('guest', { get: function () { return gi + '.' + ri; }, set: function (s) { var p = String(s).split('.'); gi = clamp(p[0], G.length); ri = clamp(p[1], H.guestRooms.length); draw(); }, reset: function () { gi = 2; ri = H.guestRooms.indexOf(G[2].room); draw(); },
      read: function () { var g = G[gi], room = H.guestRooms[ri], S = H.guestSummary(g, room); return '<b>' + esc(PER[g.pid].name) + ', ' + esc(ROOM[room].name) + ':</b> ' + S.s.length + ' sensor' + (S.s.length === 1 ? '' : 's') + ' take something' + (S.s.length ? ' — ' + esc(S.s.map(function (x) { return x.sensor.toLowerCase(); }).join(', ')) : '') + '. ' + (S.bio ? S.bio + ' biometric. ' : '') + 'Agreed to: ' + esc(g.agreed); } });
  })();

  /* ── 26 · When privacy opens the door ── */
  (function () {
    var h = host('door'); if (!h) return;
    var C = H.door, ci = 1, fixed = false;
    var cb = radios(h, C.map(function (c) { return esc(c.t); }), 'Choose a case', function (i) { ci = i; fixed = false; draw(); EA.changed('door'); }, 'hs-radios--list');
    var fx = el('button', { type: 'button', 'class': 'btn btn--sm hs-fix', 'aria-pressed': 'false' }, 'Apply the control'); h.appendChild(fx);
    fx.addEventListener('click', function () { fixed = !fixed; draw(); EA.changed('door'); });
    var body = el('div', { 'class': 'hs-door' }); h.appendChild(body);
    function draw() {
      checkR(cb, ci); var c = C[ci]; fx.setAttribute('aria-pressed', fixed ? 'true' : 'false'); fx.textContent = fixed ? 'Show it as it is' : 'Apply the control';
      body.innerHTML = '<p class="hs-moment">' + esc(c.moment) + '</p><ol class="hs-stages">' + H.stages.map(function (s) {
        var broken = s[0] === c.breaks && !fixed, txt = fixed && c.fix[s[0]] ? c.fix[s[0]] : c.as[s[0]];
        return '<li class="' + (broken ? 'x' : fixed && c.fix[s[0]] ? 'f' : '') + '"><span class="hs-sk">' + esc(s[1]) + '</span><span class="hs-sq">' + esc(s[2]) + '</span><span class="hs-st">' + esc(txt) + '</span>' + (broken ? '<span class="hs-brk">This link breaks</span>' : fixed && c.fix[s[0]] ? '<span class="hs-brk hs-brk--ok">The control</span>' : '') + '</li>';
      }).join('') + '</ol><div class="hs-door-f"><p><b>' + (fixed ? 'With the control:' : 'Consequence:') + '</b> ' + esc(fixed ? 'the door opens only for someone the household still allows, proven now — and the record says who.' : c.consequence) + '</p>' +
        '<p class="hs-q2"><span><b>Security asks</b> ' + esc(c.sec) + '</span><span><b>Privacy asks</b> ' + esc(c.priv) + '</span></p><p><b>Evidence that it worked:</b> ' + esc(c.evidence) + '</p></div>';
    }
    draw();
    EA.fig('door', { get: function () { return ci + (fixed ? '+' : ''); }, set: function (s) { s = String(s); fixed = /\+$/.test(s); ci = clamp(s.replace('+', ''), C.length); draw(); }, reset: function () { ci = 1; fixed = false; draw(); },
      read: function () { var c = C[ci], st = H.stages.filter(function (s) { return s[0] === c.breaks; })[0]; return '<b>' + esc(c.t) + '.</b> ' + (fixed ? 'With the control: ' + esc(Object.keys(c.fix).map(function (k) { return c.fix[k]; }).join('; ')) + '.' : 'The ' + esc(st[1].toLowerCase()) + ' link breaks: ' + esc(c.as[c.breaks]) + '. ' + esc(c.consequence)); } });
  })();

  /* ── 27 · The routine nobody reviewed ── */
  (function () {
    var h = host('routine'); if (!h) return;
    var A = H.rtActions, K = H.rtControls, act = bits(A.length, true), ctl = bits(K.length, false), A0 = act, K0 = ctl;
    var g = el('div', { 'class': 'hs-rt-g' }); h.appendChild(g);
    var left = el('div', { 'class': 'hs-rt-build' }); g.appendChild(left);
    left.appendChild(el('p', { 'class': 'hs-rt-trig' }, '<span>When</span> any household phone enters the geofence <small>after 15:00</small>'));
    left.appendChild(el('p', { 'class': 'hs-rt-k' }, 'Then'));
    var ab = toggles(left, A.map(function (a) { return esc(a.t); }), 'Actions in the routine', function (i) { act = flip(act, i); draw(); EA.changed('routine'); }, 'hs-toggles--list');
    left.appendChild(el('p', { 'class': 'hs-rt-k' }, 'Controls'));
    var kb = toggles(left, K.map(function (k) { return '<b>' + esc(k.t) + '</b><small>' + esc(k.d) + '</small>'; }), 'Controls on the routine', function (i) { ctl = flip(ctl, i); draw(); EA.changed('routine'); }, 'hs-toggles--list hs-toggles--ctl');
    var card = el('div', { 'class': 'hs-rt-card' }); g.appendChild(card);
    function draw() {
      press(ab, act); press(kb, ctl);
      var a = onIds(A, act), c = onIds(K, ctl), e = H.routineEval(a, c), acts = A.filter(function (x) { return a.indexOf(x.id) >= 0; });
      var alone = H.rtAlone(c).filter(function (x) { return a.indexOf(x.a.id) >= 0; });
      card.innerHTML = '<div class="hs-rt-band b-' + e.band + '"><span>Risk</span><b>' + e.band + '</b><small>simplified model</small></div>' +
        '<dl class="hs-rtf">' + [['Trigger', 'Any household phone enters the geofence'], ['Conditions', 'After 15:00'], ['Identity confidence', e.conf + ' — ' + e.why],
          ['Actions', acts.length ? acts.map(function (x) { return x.t; }).join(' · ') : 'none'], ['Devices affected', acts.length ? acts.map(function (x) { return DEV[x.dev].short; }).join(', ') : '—'],
          ['Permissions used', acts.length ? acts.map(function (x) { return x.perm; }).join(', ') : '—'], ['When the network fails', e.failure], ['Audit history', c.indexOf('two') >= 0 || c.indexOf('confirm') >= 0 ? 'Each run logs who, how sure, and who confirmed' : 'Runs logged 90 days, without who or how sure'],
          ['Kill switch', e.kill], ['Human confirmation', e.confirm]].map(function (f) { return '<div><dt>' + esc(f[0]) + '</dt><dd>' + esc(f[1]) + '</dd></div>'; }).join('') + '</dl>' +
        '<p class="hs-rt-conseq"><b>Safety and privacy consequence.</b> ' + esc(e.notes.join(' ')) + '</p>' +
        (alone.length > 1 ? '<p class="hs-rt-alone"><b>Each block alone:</b> ' + alone.map(function (x) { return esc(x.a.t.toLowerCase()) + ' — ' + x.e.band; }).join('; ') + '. <b>Together: ' + e.band + '.</b></p>' : '');
    }
    draw();
    EA.fig('routine', { get: function () { return act + '.' + ctl; }, set: function (s) { var p = String(s).split('.'); act = parseBits(p[0], A.length, A0); ctl = parseBits(p[1], K.length, K0); draw(); }, reset: function () { act = A0; ctl = K0; draw(); },
      read: function () { var e = H.routineEval(onIds(A, act), onIds(K, ctl)); return '<b>Risk ' + e.band + '.</b> Identity confidence ' + e.conf + '. ' + esc(e.notes[0] || 'Nothing it does can open the house or disclose anything.'); } });
  })();

  /* ── 28 · The network is a witness ── */
  (function () {
    var h = host('network'); if (!h) return;
    var N = L.networks, ni = 3, o = { dns: false, mac: true, vpn: false }, O0 = { dns: false, mac: true, vpn: false };
    var nb = radios(h, N.map(function (n) { return esc(n.name.replace(/ Wi-Fi$/, '')) + ' <small>' + esc(n.trust) + '</small>'; }), 'Which network', function (i) { ni = i; draw(); EA.changed('network'); }, 'hs-radios--nets');
    var tb = toggles(h, H.netToggles.map(function (t) { return esc(t[1]); }), 'What Dana turns on', function (i) { var k = H.netToggles[i][0]; o[k] = !o[k]; draw(); EA.changed('network'); });
    var body = el('div', { 'class': 'hs-net' }); h.appendChild(body);
    function draw() {
      checkR(nb, ni); tb.forEach(function (b, i) { b.setAttribute('aria-pressed', o[H.netToggles[i][0]] ? 'true' : 'false'); });
      var n = N[ni], r = H.netSees(n.id, o), base = H.netSees(n.id, O0);
      body.innerHTML = '<p class="hs-moment">' + esc(H.netMoments[n.id]) + '</p><dl class="hs-env">' + H.netRows.map(function (row, i) {
        return '<div class="' + (i === 0 ? 'letter' : 'env') + (r[row[0]] !== base[row[0]] ? ' ch' : '') + '"><dt>' + (i === 0 ? '<span>The letter</span>' : i === 1 ? '<span>The envelope</span>' : '') + esc(row[1]) + '</dt><dd>' + esc(r[row[0]]) + '</dd></div>'; }).join('') + '</dl>';
    }
    draw();
    function code() { return ni + '.' + (o.dns ? 1 : 0) + (o.mac ? 1 : 0) + (o.vpn ? 1 : 0); }
    EA.fig('network', { get: code, set: function (s) { var p = String(s).split('.'); ni = clamp(p[0], N.length); var b = /^[01]{3}$/.test(p[1] || '') ? p[1] : '010'; o = { dns: b[0] === '1', mac: b[1] === '1', vpn: b[2] === '1' }; draw(); },
      reset: function () { ni = 3; o = { dns: false, mac: true, vpn: false }; draw(); },
      read: function () { var n = N[ni], r = H.netSees(n.id, o); return '<b>' + esc(n.name) + '.</b> The page itself: only the site. Which site and when: ' + esc(r.site) + ' Who she is to it: ' + esc(r.person); } });
  })();

  /* ── 29 · The house made an inference ── */
  (function () {
    var h = host('infer'); if (!h) return;
    var S = L.streams, n = S.length, st = bits(n, true), ALL = st;
    var sb = toggles(h, S.map(function (s) { return esc(s[1]); }), 'Streams the house collects', function (i) { st = flip(st, i); draw(); EA.changed('infer'); });
    var g = el('div', { 'class': 'hs-inf-g' }); h.appendChild(g);
    function draw() {
      press(sb, st); var on = onIds(S, st), R = H.infer(on), got = R.filter(function (r) { return r.ok; });
      g.innerHTML = '<div class="hs-obs"><p class="hs-col-k">Observed <small>' + on.length + ' streams</small></p><ul>' + (on.length ? on.map(function (s) { return '<li><span>' + esc(STREAM[s]) + '</span>' + esc(H.observed[s]) + '</li>'; }).join('') : '<li>Nothing is collected.</li>') + '</ul></div>' +
        '<div class="hs-infs"><p class="hs-col-k">Inferred <small>' + got.length + ' claims about people</small></p>' + R.map(function (r) { var x = r.x;
          if (!r.ok) return '<div class="hs-inf off"><b>' + esc(x.claim) + '</b><span>Not inferable — needs ' + esc(r.missing.map(function (s) { return STREAM[s].toLowerCase(); }).join(' and ')) + '.</span></div>';
          return '<div class="hs-inf' + (x.sensitive ? ' sens' : '') + (H.never(x) ? ' never' : '') + '"><b>' + esc(x.claim) + '</b><span class="hs-conf"><i style="width:' + Math.round(r.conf * 100) + '%"></i><em>' + Math.round(r.conf * 100) + '% confidence</em></span>' +
            '<span>From: ' + esc(r.used.map(function (s) { return STREAM[s].toLowerCase(); }).join(', ')) + ' · About: ' + esc(x.about) + '</span><span>Permitted: ' + esc(x.uses) + ' · Never: ' + esc(x.never) + '</span><span>Why: ' + esc(H.explain(r)) + '</span><span>Correction: ' + esc(x.correct) + ' · Appeal: ' + esc(x.appeal) + ' · Expiry: <b>' + esc(x.expiry) + '</b></span></div>'; }).join('') + '</div>';
    }
    draw();
    EA.fig('infer', { get: function () { return st; }, set: function (s) { st = parseBits(s, n, ALL); draw(); }, reset: function () { st = ALL; draw(); },
      read: function () { var on = onIds(S, st), got = H.infer(on).filter(function (r) { return r.ok; }); return 'From ' + on.length + ' of ' + n + ' streams the house concludes ' + got.length + ' things about people' + (got.length ? ', ' + got.filter(function (r) { return r.x.sensitive; }).length + ' of them sensitive: ' + esc(got.map(function (r) { return r.x.claim; }).join('; ')) : '') + '.'; } });
  })();

  /* ── 30 · The old owner still has the keys ── */
  (function () {
    var h = host('oldkeys'); if (!h) return;
    var T = L.transitions, ti = 0, ci = 0, CARE = L.care;
    var tb = radios(h, T.map(function (t) { return esc(t.title); }), 'Choose a transition', function (i) { ti = i; draw(); EA.changed('oldkeys'); }, 'hs-radios--list');
    var cb = radios(h, CARE.map(function (c) { return esc(c[1]); }), 'How carefully it is offboarded', function (i) { ci = i; draw(); EA.changed('oldkeys'); });
    var body = el('div', { 'class': 'hs-old' }); h.appendChild(body);
    function draw() {
      checkR(tb, ti); checkR(cb, ci);
      var tr = T[ti], R = H.remains(tr, CARE[ci][0]), left = R.filter(function (r) { return r.left; }).length;
      body.innerHTML = '<p class="hs-moment"><b>' + esc(tr.title) + '</b> · ' + esc(tr.who) + ' · ' + esc(tr.when) + '</p><p class="hs-left">Something remains at <b>' + left + ' of ' + R.length + '</b> layers.</p><ol class="hs-layers">' +
        R.map(function (r) { return '<li class="' + (r.na ? 'na' : r.left ? 'left' : 'gone') + '"><span class="hs-ln">' + esc(r.l[1]) + '</span><span>' + (r.na ? 'Not involved' : r.left ? esc(r.v) : 'Nothing remains') + '</span></li>'; }).join('') + '</ol>';
    }
    draw();
    EA.fig('oldkeys', { get: function () { return ti + '.' + ci; }, set: function (s) { var p = String(s).split('.'); ti = clamp(p[0], T.length); ci = clamp(p[1], CARE.length); draw(); }, reset: function () { ti = 0; ci = 0; draw(); },
      read: function () { var tr = T[ti], R = H.remains(tr, CARE[ci][0]), l = R.filter(function (r) { return r.left; }); return '<b>' + esc(tr.title) + ', ' + esc(CARE[ci][1].toLowerCase()) + ':</b> something remains at ' + l.length + ' of ' + R.length + ' layers' + (l.length ? ' — ' + esc(l.map(function (r) { return r.l[1].toLowerCase(); }).join(', ')) : '') + '.'; } });
  })();

  if (EA.ready) EA.ready();
})(typeof window !== 'undefined' ? window : this);
