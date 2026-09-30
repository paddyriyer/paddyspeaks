/* Views: CONNECTED LIFE — the household as a data system.
 *
 *   #/life/graph        Household & places: the enlarged graph, the house, and every arrow's fourteen answers
 *   #/life/people       Who the home observes: owners, admins, subjects, guests, bystanders
 *   #/life/actions      Physical-action register: every software path that can unlock, open, disarm, start…
 *   #/life/routines     Automation review: routines as small programs with privileges
 *   #/life/networks     Network context: what changes when a device moves between networks
 *   #/life/inferences   Home inferences: observed streams, inferred claims, and their limits
 *   #/life/offboarding  Household deletion and offboarding, layer by layer
 *
 * Everything is computed from data-life.js (NS.life and the Northstar Home records it
 * adds to the organisation). The essay's chapter “The house is a data system” reads the
 * same records. Unknowns are shown with P.unk(); every block cites its records. */
(function () {
'use strict';
var P = window.PCC, NS = window.NS, esc = P.esc, chip = P.chip, unk = P.unk, uniq = P.uniq;
var V = P.views, L = NS.life, ENT = P.ENT;
if (!L) return;

/* ── the household joins the knowledge graph ─────────────────────────── */
var TL = { hperson: 'Person', place: 'Place', hdevice: 'Device', haccount: 'Account', network: 'Network', automation: 'Automation', paction: 'Physical action', hinfer: 'Home inference' };
Object.keys(TL).forEach(function (k) { P.TYPE_LABEL[k] = TL[k]; });
function reg(id, type, obj, name) { ENT[id] = { id: id, type: type, obj: obj, name: name || obj.name || obj.title || obj.claim || id }; }
function edge(a, b, rel) { if (ENT[a] && ENT[b] && a !== b) P.EDGES.push({ a: a, b: b, rel: rel, x: null }); }
var CAP = {}; L.capabilities.forEach(function (c) { CAP[c[0]] = c[1]; });
var ROOM = {}; L.rooms.forEach(function (r) { ROOM[r.id] = r; });
var DEV = {}; L.devices.forEach(function (d) { DEV[d.id] = d; });
var PER = {}; L.people.forEach(function (p) { PER[p.id] = p; });
var NET = {}; L.networks.forEach(function (n) { NET[n.id] = n; });
L.people.forEach(function (o) { reg(o.id, 'hperson', o); });
L.places.forEach(function (o) { reg(o.id, 'place', o); });
L.devices.forEach(function (o) { reg(o.id, 'hdevice', o); });
L.accounts.forEach(function (o) { reg(o.id, 'haccount', o); });
L.networks.forEach(function (o) { reg(o.id, 'network', o); });
L.automations.forEach(function (o) { reg(o.id, 'automation', o, 'Routine · ' + o.name); });
L.actions.forEach(function (o) { reg(o.id, 'paction', o, CAP[o.cap] + ' · ' + DEV[o.device].name + ' via ' + o.via); });
L.inferences.forEach(function (o) { reg(o.id, 'hinfer', o, o.claim); });
function placeOf(d) { return d.place || (d.room && ROOM[d.room] ? ROOM[d.room].place : null); }
L.devices.forEach(function (d) { edge(d.id, d.owner, 'owned by'); edge(d.id, placeOf(d), 'in'); });
L.accounts.forEach(function (a) { edge(a.id, a.holder, 'held by'); a.admins.concat(a.members).forEach(function (m) { var id = String(m).split(' ')[0]; edge(a.id, id, a.admins.indexOf(m) >= 0 ? 'administered by' : 'member'); }); });
L.automations.forEach(function (a) { a.devices.forEach(function (d) { edge(a.id, d, 'operates'); }); edge(a.id, a.owner, 'owned by'); if (a.finding) edge(a.finding, a.id, 'affects'); });
L.actions.forEach(function (a) { edge(a.id, a.device, 'acts on'); edge(a.id, a.owner, 'owned by'); if (a.finding) edge(a.finding, a.id, 'affects'); });
L.networks.forEach(function (n) { edge(n.id, n.place, 'serves'); });

/* ── small helpers ────────────────────────────────────────────────────── */
function wrap(label, html) { return '<div class="tbl-wrap" tabindex="0" role="region" aria-label="' + esc(label) + '">' + html + '</div>'; }
function answer(q, a) { return P.answer ? P.answer(q, a) : '<div class="op-answer"><p class="op-q">' + esc(q) + '</p><p class="op-a">' + a + '</p></div>'; }
function bar(pid) { return P.promiseBar ? P.promiseBar(pid) : ''; }
function sec(id, title, sub, body) { return '<section class="card op-sec lf-sec" aria-labelledby="' + id + '"><div class="card-h"><h2 class="sec" id="' + id + '">' + esc(title) + '</h2>' + (sub ? '<span class="sub">' + sub + '</span>' : '') + '</div>' + body + '</section>'; }
function pname(id) { var s = String(id), k = s.split(' ')[0]; return PER[k] ? chip(k) + esc(s.slice(k.length)) : esc(s); }
function val(v, label) { return v == null ? unk(label || 'UNKNOWN — nobody at Northstar can answer') : esc(v); }
var ASSUR = { high: ['ok', 'strong'], medium: ['warn', 'medium'], low: ['bad', 'weak'], none: ['bad', 'none'], unknown: ['unk', 'unknown'] };
function assurTag(a) { var x = ASSUR[a] || ASSUR.unknown; return x[0] === 'unk' ? unk('identity: unknown') : '<span class="tag lf-as lf-as-' + esc(a) + '">identity: ' + esc(x[1]) + '</span>'; }
var WEAK = function (a) { return a.assur === 'low' || a.assur === 'none' || a.assur === 'unknown'; };
var OPENS = ['unlock', 'open', 'disarm', 'start'];
P.lifeWeakActions = function () { return L.actions.filter(function (a) { return OPENS.indexOf(a.cap) >= 0 && WEAK(a); }); };
P.METRICS.push({ id: 'physical', hidden: true, tone: 'hot', label: 'Doors, alarms and cars that open on weak identity', route: 'life/actions',
  rule: 'Software paths that can unlock, open, disarm or start with weak, no or unknown proof of who is asking (physical-action register).',
  items: function () { return P.lifeWeakActions().map(function (a) { return { id: a.id, why: (ASSUR[a.assur] || ASSUR.unknown)[1] + ' identity · ' + a.who }; }); } });

/* Which sensors take something from a person who walks into a room. Shared with the essay (same rule). */
P.lifeSensed = function (g, room) {
  return L.sense.filter(function (s) {
    var here = s.rooms === '*' ? room !== 'rm_ruth' && room !== 'rm_porch' : s.rooms.indexOf(room) >= 0;
    if (!here) return false;
    if (s.who === 'code') return !!g.code;
    if (s.who === 'phone') return !!g.phone;
    return true;
  });
};

/* ── the household map (a plan, not a picture) ────────────────────────── */
function houseMap(highlight) {
  var rooms = L.rooms.filter(function (r) { return r.place === 'pl_alder'; });
  var s = '<svg class="lf-map" viewBox="-6 -6 612 472" role="img" aria-label="Plan of 14 Alder Lane with ' + L.devices.filter(function (d) { return d.room; }).length + ' devices marked by room. The table below lists the same devices.">';
  rooms.forEach(function (r) {
    s += '<rect x="' + r.x + '" y="' + r.y + '" width="' + r.w + '" height="' + r.h + '" class="lf-room' + (r.outside ? ' out' : '') + '"/>' +
      '<text x="' + (r.x + 8) + '" y="' + (r.y + 16) + '" class="lf-rl">' + esc(r.name.toUpperCase()) + '</text>';
  });
  rooms.forEach(function (r) {
    var ds = L.devices.filter(function (d) { return d.room === r.id; });
    ds.forEach(function (d, i) {
      var cx = r.x + 18, cy = r.y + 38 + i * 24;
      var hot = highlight && highlight.indexOf(d.id) >= 0;
      s += '<g class="lf-dev' + (hot ? ' hot' : '') + '"><rect x="' + (cx - 7) + '" y="' + (cy - 7) + '" width="14" height="14" rx="3"/><text x="' + (cx + 11) + '" y="' + (cy + 4) + '">' + esc(d.short || d.name) + '</text></g>';
    });
  });
  return s + '</svg>';
}

/* How far along an engineering answer is: every control behind it passing = in place. */
P.solutionState = function (x) {
  if (!x.controls.length) return { state: 'unknown', html: unk('no Northstar control tests this') };
  var t = x.controls.map(function (c) { return { c: c, t: P.controlTest(c) }; }), pass = t.filter(function (y) { return y.t.result === 'pass'; }).length;
  var state = pass === t.length ? 'in place' : pass ? 'partly' : 'not yet';
  return { state: state, html: '<b class="' + (state === 'in place' ? 'ok' : state === 'partly' ? 'warn' : 'bad') + '">' + state + '</b> · ' + t.map(function (y) { return chip(y.c) + ' <span class="dim">' + esc(y.t.result === 'never' ? 'never tested' : y.t.result) + '</span>'; }).join(' ') };
};

/* ════════════ HOUSEHOLD & PLACES ════════════ */
V['life/graph'] = { title: 'Household & places', render: function (args, q) {
  var sensors = uniq([].concat.apply([], L.devices.map(function (d) { return d.sensors; })));
  var holds = L.people.filter(function (p) { return L.accounts.some(function (a) { return a.holder === p.id || a.admins.some(function (m) { return String(m).split(' ')[0] === p.id; }); }); });
  var notAsked = L.arrows.filter(function (a) { return a.consentBy !== 'subject'; });
  var head = P.pageHead('Connected Life · household & places', 'One household, as a data system',
    'A person does not live inside one application. This page follows one fictional household — 14 Alder Lane — through its rooms, devices, accounts, networks and the companies behind them, using the same records as the essay.');
  var ans = answer('Who and what does one household connect?',
    '<b>' + L.people.length + ' people</b>, of whom only ' + holds.length + ' hold or administer an account on anything that observes them; <b>' + L.devices.length + ' devices</b> with ' + sensors.length + ' kinds of sensor; ' +
    L.accounts.length + ' accounts; ' + L.networks.length + ' networks. In <b>' + notAsked.length + ' of ' + L.arrows.length + '</b> traced arrows the person the data is about was never the one who agreed. ' + L.actions.length + ' software paths can act on the physical world.');
  /* the enlarged chain, with a count for every link */
  var CT = { person: L.people.length, household: 1, place: L.places.length, device: L.devices.length, sensor: sensors.length, account: L.accounts.length, network: L.networks.length,
    cloud: NS.systems.filter(function (s) { return s.product === 'p_home'; }).length, integration: NS.flows.filter(function (f) { return /^flh/.test(f.id) && (f.boundary === 'third_party' || f.boundary === 'trust'); }).length,
    vendor: uniq(NS.flows.filter(function (f) { return /^flh/.test(f.id) && P.get(f.to) && P.get(f.to).type === 'vendor'; }).map(function (f) { return f.to; }).concat(NS.flows.filter(function (f) { return /^flh/.test(f.id) && P.get(f.from) && P.get(f.from).type === 'vendor'; }).map(function (f) { return f.from; }))).length,
    inference: L.inferences.length, automation: L.automations.length, action: L.actions.length };
  var chainH = '<ol class="lf-chain">' + L.chain.map(function (c, i) { return '<li><span class="lf-ci">' + (i + 1) + '</span><b>' + esc(c[1]) + '</b><span class="lf-cn">' + CT[c[0]] + '</span><span class="small dim">' + esc(c[2]) + '</span></li>'; }).join('') + '</ol>';
  var devT = '<table class="tbl"><caption class="sr-only">Devices at 14 Alder Lane and elsewhere</caption><thead><tr><th scope="col">Device</th><th scope="col">Where</th><th scope="col">Ecosystem</th><th scope="col">Owner</th><th scope="col">Sensors</th><th scope="col">Can do</th><th scope="col">Processing</th><th scope="col">When the internet is down</th></tr></thead><tbody>' +
    L.devices.map(function (d) { var pl = placeOf(d); return '<tr><th scope="row">' + chip(d.id) + (d.note ? '<div class="small bad">' + esc(d.note) + '</div>' : '') + '</th><td class="small">' + esc(d.room ? ROOM[d.room].name : pl ? P.name(pl) : 'with its owner') + '</td><td class="small">' + esc(d.eco) + '</td><td>' + chip(d.owner) + '</td><td class="small">' + esc(d.sensors.join(', ')) + '</td><td class="small">' + esc(d.acts.join(', ') || '—') + '</td><td class="small nowrap">' + esc(d.where) + '</td><td class="small">' + esc(d.offline) + '</td></tr>'; }).join('') + '</tbody></table>';
  var acctT = '<table class="tbl"><caption class="sr-only">Accounts, and who they include</caption><thead><tr><th scope="col">Account</th><th scope="col">Holder</th><th scope="col">Administrators</th><th scope="col">Members</th><th scope="col">Also</th></tr></thead><tbody>' +
    L.accounts.map(function (a) { return '<tr><th scope="row">' + chip(a.id) + '</th><td>' + chip(a.holder) + '</td><td class="small">' + a.admins.map(pname).join(', ') + '</td><td class="small">' + (a.members.length ? a.members.map(function (m) { return /never|previous/.test(m) ? '<span class="bad">' + pname(m) + '</span>' : pname(m); }).join(', ') : '<span class="dim">—</span>') + '</td><td class="small">' + esc((a.codes ? ['codes: ' + a.codes.map(function (c) { return PER[c] ? PER[c].name : c; }).join(', ')] : []).concat(a.other || []).join(' · ')) + '</td></tr>'; }).join('') + '</tbody></table>';
  /* one arrow's fourteen answers */
  var cur = L.arrows.filter(function (a) { return a.id === q.a; })[0] || L.arrows[1];
  var pick = '<div class="lf-pick" role="group" aria-label="Choose an arrow">' + L.arrows.map(function (a) { return '<a class="chip' + (a === cur ? ' on' : '') + '" href="#/life/graph?a=' + a.id + '"' + (a === cur ? ' aria-current="true"' : '') + '>' + esc(a.title) + '</a>'; }).join('') + '</div>';
  var unknowns = L.questions.filter(function (qq) { return cur[qq[0]] == null; });
  var qs = '<dl class="lf-14">' + L.questions.map(function (qq, i) {
    var v = cur[qq[0]], h;
    if (qq[0] === 'cross') h = L.boundaries.map(function (b) { return '<span class="tag' + (v.indexOf(b[0]) >= 0 ? ' lf-on' : ' lf-off') + '">' + esc(b[1]) + (v.indexOf(b[0]) >= 0 ? ' ✓' : '') + '</span>'; }).join(' ');
    else if (qq[0] === 'where') h = '<span class="tag">' + esc(v) + '</span>';
    else h = val(v);
    return '<div' + (v == null ? ' class="unk"' : '') + '><dt><span class="lf-qn">' + (i + 1) + '</span>' + esc(qq[1]) + '</dt><dd>' + h + '</dd></div>';
  }).join('') + '</dl>';
  var path = '<p class="small lf-path">' + cur.path.map(function (k) { var c = L.chain.filter(function (x) { return x[0] === k; })[0]; return '<span>' + esc(c[1]) + '</span>'; }).join(' → ') + '</p>';
  var arrowCard = pick + '<div class="lf-arrow"><h3>' + esc(cur.title) + (cur.outside ? ' <span class="tag">outside Northstar · ' + esc(cur.label) + '</span>' : '') + '</h3>' + path +
    '<p class="small">Consent came from: <b class="' + (cur.consentBy === 'subject' ? 'ok' : 'bad') + '">' + esc(cur.consentBy === 'subject' ? 'the person it is about' : cur.consentBy === 'owner' ? 'the device or account owner only' : 'nobody') + '</b>' +
    (unknowns.length ? ' · <span class="bad">' + unknowns.length + ' of 14 questions have no answer at Northstar</span>' : ' · all 14 answered') + '</p>' + qs +
    P.cite([cur.flow, cur.finding].filter(Boolean), 'Records') + '</div>';
  var matrix = '<table class="tbl"><caption class="sr-only">Every arrow at a glance</caption><thead><tr><th scope="col">Arrow</th><th scope="col">Consent from</th><th scope="col">Processing</th><th scope="col">Crosses</th><th scope="col">Physical action</th><th scope="col" class="num">Unanswered</th></tr></thead><tbody>' +
    L.arrows.map(function (a) { var u = L.questions.filter(function (qq) { return a[qq[0]] == null; }).length; return '<tr><th scope="row"><a href="#/life/graph?a=' + a.id + '">' + esc(a.title) + '</a></th><td class="small ' + (a.consentBy === 'subject' ? 'ok' : 'bad') + '">' + esc(a.consentBy === 'subject' ? 'the person' : a.consentBy === 'owner' ? 'owner only' : 'nobody') + '</td><td class="small">' + esc(a.where) + '</td><td class="small">' + esc(a.cross.join(', ')) + '</td><td class="small">' + esc(/^No\b/.test(a.phys) ? 'no' : 'yes') + '</td><td class="num">' + (u ? '<span class="bad">' + u + '</span>' : '0') + '</td></tr>'; }).join('') + '</tbody></table>';
  var places = '<ul class="lf-places">' + L.places.map(function (p) { return '<li>' + chip(p.id) + ' <span class="tag">' + esc(p.kind) + '</span> <span class="small dim">' + esc(p.note) + '</span></li>'; }).join('') + '</ul>';
  var sol = '<table class="tbl lf-sol"><caption class="sr-only">Engineering answers to the connected-life problems</caption><thead><tr><th scope="col">Problem</th><th scope="col">Engineering solution</th><th scope="col">Where Northstar stands</th><th scope="col">Read · run</th></tr></thead><tbody>' +
    L.solutions.map(function (x) { var st = P.solutionState(x); return '<tr data-so="' + x.id + '"><th scope="row">' + esc(x.problem) + '</th><td class="small"><ul class="lf-parts">' + x.parts.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul></td><td class="small">' + st.html + '</td><td class="small"><a href="' + P.ESSAY_URL + '#' + esc(x.essay) + '">Essay</a>' + (x.route ? ' · <a href="#/' + esc(x.route) + '">Command Center</a>' : '') + '</td></tr>'; }).join('') + '</tbody></table>';
  return head + bar('PR-HOMEDATA') + ans +
    sec('lf-sol-h', 'The engineering answers', 'status from Northstar’s control tests', wrap('Engineering answers', sol)) +
    sec('lf-chain', 'The graph, grown', 'person → … → physical action', '<p class="small dim">Enterprise privacy follows Person → Data → System → Vendor. A household adds the links in between — and the last one can open a door. Counts are this household’s records.</p>' + chainH) +
    sec('lf-house', '14 Alder Lane', 'a plan, not a picture', '<div class="pv-scroll" tabindex="0" role="region" aria-label="House plan (scrolls sideways on small screens)">' + houseMap() + '</div>' + '<details class="op-more" open><summary>Every device, its owner, its sensors and what it does offline</summary>' + wrap('Devices', devT) + '</details>') +
    sec('lf-accts', 'Accounts and who they include', 'the account owner agreed — for everyone', wrap('Accounts', acctT) + '<p class="small">Places this household moves through: </p>' + places) +
    sec('lf-arrows', 'Every arrow answers fourteen questions', 'unknown is a finding', arrowCard + '<details class="op-more"><summary>All arrows at a glance</summary>' + wrap('Arrows', matrix) + '</details>');
} };

/* ════════════ WHO THE HOME OBSERVES ════════════ */
V['life/people'] = { title: 'Who the home observes', render: function () {
  var R = L.roles;
  var hasRole = function (p, r) { return p.roles.filter(function (x) { return x[0] === r; }); };
  var observed = L.guests.map(function (g) { return { g: g, s: P.lifeSensed(g, g.room) }; });
  var unasked = observed.filter(function (o) { return !/^Everything/.test(o.g.agreed); });
  var bio = observed.filter(function (o) { return o.s.some(function (s) { return s.bio; }); });
  var head = P.pageHead('Connected Life · people', 'Who the home observes', 'Devices are bought by one person and observe everyone in range. The account owner’s agreement is not the agreement of the babysitter, the courier or the child.');
  var ans = answer('Who is observed without having agreed?', '<b>' + unasked.length + ' of ' + L.guests.length + '</b> people who come into range never agreed to anything the sensors do; ' + bio.length + ' of them can end up in a biometric system (a face index, a voice history, a fingerprint store). Roles below are relationships to a device or account — one person can hold several, and the person observed is usually not the one who clicked “Accept”.');
  var roleT = '<table class="tbl lf-roles"><caption class="sr-only">People and the roles they hold</caption><thead><tr><th scope="col">Person</th>' + R.map(function (r) { return '<th scope="col" title="' + esc(r[2]) + '">' + esc(r[1]) + '</th>'; }).join('') + '</tr></thead><tbody>' +
    L.people.map(function (p) { return '<tr><th scope="row">' + chip(p.id) + '<div class="small dim">' + esc(p.who) + '</div></th>' + R.map(function (r) { var h = hasRole(p, r[0]); return '<td class="small">' + (h.length ? '<b class="lf-yes">✓</b> ' + esc(h.map(function (x) { return x[1]; }).join('; ')) : '<span class="dim" aria-label="no">—</span>') + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table>';
  var guestT = '<table class="tbl"><caption class="sr-only">What the house takes from each person who comes into range</caption><thead><tr><th scope="col">Person</th><th scope="col">Where</th><th scope="col">Sensors that take something</th><th scope="col">Biometric</th><th scope="col">What they agreed to</th></tr></thead><tbody>' +
    observed.map(function (o) { return '<tr><th scope="row">' + chip(o.g.pid) + '<div class="small dim">' + esc(o.g.moment) + '</div></th><td class="small">' + esc(ROOM[o.g.room].name) + '</td><td class="small">' + (o.s.length ? o.s.map(function (s) { return esc(s.sensor) + ' <span class="dim">(' + esc(DEV[s.dev].name) + ')</span>'; }).join('<br>') : '<span class="dim">none</span>') + '</td><td class="small">' + (o.s.some(function (s) { return s.bio; }) ? '<span class="bad">yes</span>' : 'no') + '</td><td class="small">' + esc(o.g.agreed) + '</td></tr>'; }).join('') + '</tbody></table>';
  var senseT = '<table class="tbl"><caption class="sr-only">What each sensor takes from someone who never enrolled</caption><thead><tr><th scope="col">Sensor</th><th scope="col">Rooms</th><th scope="col">Takes</th><th scope="col">Kept</th><th scope="col">Who can replay it</th><th scope="col">The control</th></tr></thead><tbody>' +
    L.sense.map(function (s) { return '<tr><th scope="row">' + esc(s.sensor) + '<div class="small">' + chip(s.dev) + '</div></th><td class="small">' + esc(s.rooms === '*' ? 'the whole house' : s.rooms.map(function (r) { return ROOM[r].name; }).join(', ')) + '</td><td class="small">' + esc(s.what) + (s.bio ? ' <span class="tag sev-HIGH">biometric</span>' : '') + '</td><td class="small">' + (/Outside/.test(s.keep) ? unk(s.keep) : esc(s.keep)) + '</td><td class="small">' + esc(s.replay) + '</td><td class="small">' + esc(s.control) + '</td></tr>'; }).join('') + '</tbody></table>';
  return head + bar('PR-HOMEDATA') + ans +
    sec('lf-roles', 'Owner, administrator, subject, guest, bystander', 'relationships, not people', wrap('Roles', roleT)) +
    sec('lf-guests', 'The guest never clicked “Accept”', 'computed from the sensor map', wrap('Guests', guestT) + P.cite(['PRV-0306', 'd_faces', 'd_clips', 'c_privacy_zone', 'c_face_consent'], 'Records')) +
    sec('lf-sense', 'What each sensor takes from someone who never enrolled', '', wrap('Sensors', senseT));
} };

/* ════════════ PHYSICAL-ACTION REGISTER ════════════ */
V['life/actions'] = { title: 'Physical actions', render: function (args, q) {
  var list = L.actions.filter(function (a) { return (!q.cap || a.cap === q.cap) && (!q.weak || WEAK(a)); });
  var weakOpen = P.lifeWeakActions(), outside = L.actions.filter(function (a) { return a.outside; }), withF = L.actions.filter(function (a) { return a.finding; });
  var head = P.pageHead('Connected Life · physical actions', 'Every software path that can act on the world', 'Unlocking, opening, disarming, starting, purchasing, recording, broadcasting, changing temperature, revealing presence, calling for help. When software controls a door, privacy architecture becomes physical architecture.');
  var ans = answer('Which paths can open a door, and how sure are they who is asking?',
    '<b>' + L.actions.length + ' paths</b> across ' + L.capabilities.length + ' capabilities. <b class="bad">' + weakOpen.length + '</b> can unlock, open, disarm or start on weak, no or unknown identity. ' + outside.length + ' run outside Northstar, where who uses them is ' + unk('unknown') + '; ' + withF.length + ' are tied to an open finding.');
  var tools = '<div class="lf-pick" role="group" aria-label="Filter by capability"><a class="chip' + (!q.cap ? ' on' : '') + '" href="#/life/actions' + (q.weak ? '?weak=1' : '') + '">All</a>' +
    L.capabilities.map(function (c) { var n = L.actions.filter(function (a) { return a.cap === c[0]; }).length; return '<a class="chip' + (q.cap === c[0] ? ' on' : '') + '" href="#/life/actions?cap=' + c[0] + (q.weak ? '&weak=1' : '') + '"' + (q.cap === c[0] ? ' aria-current="true"' : '') + '>' + esc(c[1]) + ' · ' + n + '</a>'; }).join('') +
    '<a class="chip' + (q.weak ? ' on' : '') + '" href="#/life/actions?' + (q.cap ? 'cap=' + q.cap + (q.weak ? '' : '&') : '') + (q.weak ? '' : 'weak=1') + '">' + (q.weak ? 'Showing weak identity only ✕' : 'Weak identity only') + '</a></div>';
  var groups = L.capabilities.filter(function (c) { return list.some(function (a) { return a.cap === c[0]; }); });
  var tbl = '<table class="tbl lf-reg" id="lfReg"><caption class="sr-only">Physical-action register</caption><thead><tr><th scope="col">Path</th><th scope="col">Who can invoke it</th><th scope="col">Identity required</th><th scope="col">Confirmation</th><th scope="col">When offline</th><th scope="col">Audit</th><th scope="col">Owner · finding</th></tr></thead>' +
    groups.map(function (c) {
      return '<tbody><tr class="lf-grp"><th scope="colgroup" colspan="7">' + esc(c[1]) + '</th></tr>' + list.filter(function (a) { return a.cap === c[0]; }).map(function (a) {
        return '<tr data-pa="' + a.id + '"' + (WEAK(a) ? ' data-weak="1"' : '') + '><th scope="row">' + chip(a.id, DEV[a.device].name + ' — ' + a.via) + (a.outside ? ' <span class="tag">outside Northstar</span>' : '') + '</th><td class="small">' + esc(a.who) + '</td><td class="small">' + esc(a.id_) + '<div>' + assurTag(a.assur) + '</div></td><td class="small">' + (/^Unknown$/.test(a.confirm) ? unk('unknown') : esc(a.confirm)) + '</td><td class="small">' + esc(a.offline) + '</td><td class="small">' + (/Outside/.test(a.audit) ? unk(a.audit) : esc(a.audit)) + '</td><td class="small">' + P.ownerHTML(a.owner) + (a.finding ? ' ' + chip(a.finding) : '') + '</td></tr>';
      }).join('') + '</tbody>';
    }).join('') + '</table>';
  var note = '<div class="callout"><b>Where privacy and security meet.</b> Security asks: can someone get in who shouldn’t? Privacy asks: what does the system reveal and keep about the people who do — and who can learn when the house is empty? A door lock answers both, which is why the same record appears in both reviews. The questions stay different: a perfectly secure lock can still keep two years of everyone’s comings and goings.</div>';
  return head + bar('PR-DOOR') + ans + sec('lf-reg-h', 'The register', list.length + ' of ' + L.actions.length + ' paths shown', tools + wrap('Physical-action register', tbl) + note + P.cite(uniq(L.actions.map(function (a) { return a.finding; }).filter(Boolean)).concat(['c_physical_confirm', 'c_code_expiry']), 'Records'));
} };

/* ════════════ AUTOMATION REVIEW ════════════ */
var SEV = { disarm: 3, unlock: 3, open: 3, start: 3, announce: 2, notify: 2, dropin: 2, call: 1, purchase: 2, lights: 0, heat: 0, eco: 0, arm: 0, lock: 0, tv: 0 };
var CONF = { none: 0, low: 1, medium: 2, high: 3 };
/* Simplified model: a routine is as risky as its most consequential action taken on its weakest identity. */
P.routineRisk = function (a) {
  var sev = Math.max.apply(null, a.actions.map(function (x) { return SEV[x[0]] || 0; })), c = CONF[a.idConf] != null ? CONF[a.idConf] : 0;
  var band = sev >= 3 && c <= 1 ? 'HIGH' : sev >= 3 || (sev === 2 && c <= 1) ? 'MEDIUM' : 'LOW';
  return { band: band, sev: sev, conf: c, why: (sev >= 3 ? 'can open, unlock or disarm' : sev === 2 ? 'can reveal something to a room or a screen' : 'only closes or adjusts things') + ' on ' + (c <= 1 ? 'weak or no identity' : c === 2 ? 'medium identity' : 'strong identity') };
};
V['life/routines'] = { title: 'Automation review', render: function () {
  var A = L.automations.slice().sort(function (x, y) { var o = { HIGH: 0, MEDIUM: 1, LOW: 2 }; return o[P.routineRisk(x).band] - o[P.routineRisk(y).band]; });
  var never = A.filter(function (a) { return !a.lastReview; }), phys = A.filter(function (a) { return P.routineRisk(a).sev >= 3; }), weakId = A.filter(function (a) { return CONF[a.idConf] <= 1; });
  var head = P.pageHead('Connected Life · automation review', 'Routines are small programs with privileges', 'Each is reviewed like code that can open a door: what triggers it, how sure it is who is there, what it may do, what happens when the network fails, and who can stop it.');
  var ans = answer('Which routines could hurt someone if they fire at the wrong moment?', '<b>' + A.filter(function (a) { return P.routineRisk(a).band === 'HIGH'; }).length + ' of ' + A.length + '</b> rate HIGH. ' + never.length + ' have never been reviewed; ' + phys.length + ' can open, unlock or disarm; ' + weakId.length + ' trust a weak signal (or none) for who is there. <span class="small dim">Rule: a routine is as risky as its most consequential action taken on its weakest identity (simplified model).</span>');
  var cards = A.map(function (a) {
    var r = P.routineRisk(a);
    var F = [['Trigger', esc(a.trigger)], ['Conditions', esc(a.conditions)], ['Identity source · confidence', esc(a.idSource) + ' · <span class="tag lf-as lf-as-' + (a.idConf === 'medium' ? 'medium' : a.idConf === 'high' ? 'high' : 'low') + '">' + esc(a.idConf) + '</span><div class="small dim">' + esc(a.idWhy) + '</div>'],
      ['Privileges', esc(a.privileges.join(' · '))], ['Actions', a.actions.map(function (x) { return '<span class="tag' + ((SEV[x[0]] || 0) >= 3 ? ' sev-HIGH' : '') + '">' + esc(x[1]) + '</span>'; }).join(' ')],
      ['Devices affected', a.devices.map(function (d) { return chip(d); }).join(' ')], ['Bystanders affected', esc(a.bystanders)], ['When offline', esc(a.offline)],
      ['Last review', a.lastReview ? esc(P.hdate(a.lastReview)) : unk('never reviewed')], ['Owner', chip(a.owner) + ' <span class="small dim">since ' + esc(P.hdate(a.created)) + '</span>'],
      ['Evidence', esc(a.audit)], ['Emergency disable', esc(a.kill)], ['Human confirmation', /^None/.test(a.confirm) ? '<span class="bad">' + esc(a.confirm) + '</span>' : esc(a.confirm)],
      ['Safety and privacy consequence', '<b>' + esc(a.consequence) + '</b>']];
    return '<article class="lf-rt" data-rt="' + a.id + '" aria-labelledby="rt-' + a.id + '"><header><h3 id="rt-' + a.id + '">' + esc(a.name) + '</h3>' + P.sev(r.band) + '<span class="small dim">' + esc(r.why) + '</span>' + (a.finding ? ' ' + chip(a.finding) : '') + '</header><dl class="lf-rtf">' +
      F.map(function (f) { return '<div><dt>' + esc(f[0]) + '</dt><dd>' + f[1] + '</dd></div>'; }).join('') + '</dl></article>';
  }).join('');
  return head + bar('PR-DOOR') + ans + sec('lf-rt-h', 'Every routine', 'sorted by risk', cards + P.cite(uniq(A.map(function (a) { return a.finding; }).filter(Boolean)).concat(['d_routinelog', 'c_physical_confirm']), 'Records'));
} };

/* ════════════ NETWORK CONTEXT ════════════ */
V['life/networks'] = { title: 'Network context', render: function (args, q) {
  var a = NET[q.from] || NET.nw_home, b = NET[q.to] || NET.nw_library; if (a === b) b = a === NET.nw_home ? NET.nw_library : NET.nw_home;
  var changed = L.netTracked.filter(function (t) { return a[t[0]] !== b[t[0]]; });
  var head = P.pageHead('Connected Life · network context', 'The network is a witness', 'HTTPS protects what a page says. It does not hide which service a device reached, when, how much, from where — or the name a device announces to everyone nearby. What changes as a device moves is who is watching the envelope.');
  var ans = answer('What changes when ' + P.name('dv_dphone') + ' moves from ' + a.name + ' to ' + b.name + '?', '<b>' + changed.length + ' of ' + L.netTracked.length + '</b> things change — and the operator changes from ' + esc(a.operator) + ' to ' + esc(b.operator) + '. The content of encrypted pages is unreadable on both.');
  var opt = function (sel, name) { return '<label class="small">' + name + ' <select data-lf-net="' + name.toLowerCase() + '">' + L.networks.map(function (n) { return '<option value="' + n.id + '"' + (n === sel ? ' selected' : '') + '>' + esc(n.name) + '</option>'; }).join('') + '</select></label>'; };
  var cmp = '<div class="lf-pick lf-netpick">' + opt(a, 'From') + ' ' + opt(b, 'To') + '</div>' +
    wrap('What changes', '<table class="tbl lf-cmp"><caption class="sr-only">What changes between the two networks</caption><thead><tr><th scope="col">Tracked</th><th scope="col">' + esc(a.name) + ' <span class="tag">' + esc(a.trust) + '</span></th><th scope="col">' + esc(b.name) + ' <span class="tag">' + esc(b.trust) + '</span></th></tr></thead><tbody>' +
    L.netTracked.map(function (t) { var d = a[t[0]] !== b[t[0]]; return '<tr' + (d ? ' class="lf-diff"' : '') + '><th scope="row">' + esc(t[1]) + (d ? ' <span class="tag">changes</span>' : '') + '</th><td class="small">' + esc(a[t[0]]) + '</td><td class="small">' + esc(b[t[0]]) + '</td></tr>'; }).join('') + '</tbody></table>');
  var all = '<table class="tbl"><caption class="sr-only">Every network and what it sees</caption><thead><tr><th scope="col">Network</th><th scope="col">Trust</th><th scope="col">Operator</th>' + L.netTracked.map(function (t) { return '<th scope="col">' + esc(t[1]) + '</th>'; }).join('') + '</tr></thead><tbody>' +
    L.networks.map(function (n) { return '<tr><th scope="row">' + chip(n.id) + '</th><td class="small">' + esc(n.trust) + '</td><td class="small">' + esc(n.operator) + '</td>' + L.netTracked.map(function (t) { return '<td class="small">' + esc(n[t[0]]) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table>';
  return head + ans + sec('lf-net-c', 'Move a device', 'choose two networks', cmp) + sec('lf-net-a', 'Every network', L.networks.length + ' contexts · 8 things tracked', wrap('Networks', all) + P.cite(['i_device', 'i_maid', 'PRV-0305'], 'Records'));
}, mount: function (main) {
  main.querySelectorAll('[data-lf-net]').forEach(function (s) { s.addEventListener('change', function () { var f = main.querySelector('[data-lf-net="from"]').value, t = main.querySelector('[data-lf-net="to"]').value; P._keepScroll = true; P.go('life/networks?from=' + f + '&to=' + t); }); });
} };

/* ════════════ HOME INFERENCES ════════════ */
/* Simplified model (the essay uses the same): an inference exists once all its `needs` streams are
 * present; each optional stream adds `step` to a base confidence, capped at 0.95. */
P.lifeInfer = function (on) {
  return L.inferences.map(function (x) {
    var ok = x.needs.every(function (s) { return on.indexOf(s) >= 0; }), extra = x.adds.filter(function (s) { return on.indexOf(s) >= 0; });
    return { x: x, ok: ok, conf: ok ? Math.min(0.95, x.base + x.step * extra.length) : 0, used: ok ? x.needs.concat(extra) : [] };
  });
};
/* The explanation a person would be shown: which of their streams moved together. */
P.lifeExplain = function (r) { var SN = {}; L.streams.forEach(function (s) { SN[s[0]] = s[1].toLowerCase(); }); return 'Because ' + r.used.map(function (s) { return SN[s]; }).join(', ') + (r.used.length > 1 ? ' changed together' : ' changed') + ' — ' + Math.round(r.conf * 100) + '% sure, not a fact.'; };
V['life/inferences'] = { title: 'Home inferences', render: function () {
  var all = L.streams.map(function (s) { return s[0]; }), R = P.lifeInfer(all), SN = {}; L.streams.forEach(function (s) { SN[s[0]] = s[1]; });
  var sens = R.filter(function (r) { return r.x.sensitive; }), never = R.filter(function (r) { return /never be computed/.test(r.x.expiry); });
  var head = P.pageHead('Connected Life · inferences', 'The inference registry', 'The home infers more than any sensor observed. Thermostat changes, motion, doors, the garage, electricity, Wi-Fi, the TV, voice, location, sleep. Each is mundane. Together they produce claims about people — who is home, who is ill, who is alone. An inference is data about a person, and it can be wrong.');
  var ans = answer('What does the house conclude, and on what authority?', '<b>' + R.filter(function (r) { return r.ok; }).length + ' claims</b> from ' + all.length + ' mundane streams; ' + sens.length + ' are sensitive and ' + never.length + ' should never be computed at all. Each entry carries its source, confidence, purpose, expiry, explanation, correction and appeal. <span class="small dim">Confidence: base + a step per supporting stream, capped at 95% (simplified model).</span>');
  var obs = '<table class="tbl"><caption class="sr-only">Observed streams and where they come from</caption><thead><tr><th scope="col">Observed stream</th><th scope="col">Devices</th><th scope="col">Used by inferences</th></tr></thead><tbody>' +
    L.streams.map(function (s) { var dv = { thermo: ['dv_thermo'], motion: ['dv_motion', 'dv_alarm'], door: ['dv_lock'], garage: ['dv_garage'], energy: ['dv_energy'], wifi: ['dv_router'], tv: ['dv_tv'], voice: ['dv_speaker', 'dv_display'], location: ['dv_dphone', 'dv_tphone'], sleep: ['dv_watch'] }[s[0]] || [];
      return '<tr><th scope="row">' + esc(s[1]) + '</th><td>' + dv.map(function (d) { return chip(d); }).join(' ') + '</td><td class="num">' + L.inferences.filter(function (x) { return x.needs.concat(x.adds).indexOf(s[0]) >= 0; }).length + '</td></tr>'; }).join('') + '</tbody></table>';
  var inf = '<table class="tbl lf-inf"><caption class="sr-only">Inferred claims with provenance, confidence, uses, correction and expiry</caption><thead><tr><th scope="col">Inferred claim</th><th scope="col">About</th><th scope="col">From</th><th scope="col" class="num">Confidence</th><th scope="col">Permitted uses</th><th scope="col">Never</th><th scope="col">Explanation</th><th scope="col">Correction</th><th scope="col">Appeal</th><th scope="col">Expiry</th></tr></thead><tbody>' +
    R.map(function (r) { var x = r.x, bad = /never be computed/.test(x.expiry); return '<tr' + (x.sensitive ? ' class="lf-sens"' : '') + '><th scope="row">' + esc(x.claim) + (x.sensitive ? ' <span class="tag sev-HIGH">sensitive</span>' : '') + '</th><td class="small">' + esc(x.about) + '</td><td class="small">' + esc(r.used.map(function (s) { return SN[s]; }).join(' + ')) + '</td><td class="num">' + Math.round(r.conf * 100) + '%</td><td class="small">' + esc(x.uses) + '</td><td class="small">' + esc(x.never) + '</td><td class="small">' + esc(P.lifeExplain(r)) + '</td><td class="small">' + (x.correct === '—' ? unk('no correction path') : esc(x.correct)) + '</td><td class="small">' + (x.appeal === '—' ? unk('no appeal') : esc(x.appeal)) + '</td><td class="small' + (bad ? ' bad' : '') + '">' + esc(x.expiry) + '</td></tr>'; }).join('') + '</tbody></table>';
  return head + bar('PR-HOMEDATA') + ans + sec('lf-obs', 'Observed', 'what the sensors actually record', wrap('Observed streams', obs)) +
    sec('lf-infs', 'Inferred', 'claims the house makes about people', wrap('Inferences', inf) + P.cite(['d_presence', 'd_accesslog', 'd_energy', 'c_presence_ttl', 'PRV-0304', 'PRV-0305'], 'Records'));
} };

/* ════════════ OFFBOARDING ════════════ */
var ST = { done: ['ok', 'done'], failed: ['bad', 'failed'], unknown: ['unk', 'unknown'] };
V['life/offboarding'] = { title: 'Offboarding', render: function (args, q) {
  var steps = [].concat.apply([], L.workflows.map(function (w) { return w.steps; }));
  var cnt = function (s) { return steps.filter(function (x) { return x[2] === s; }).length; };
  var tr = L.transitions.filter(function (t) { return t.id === q.t; })[0] || L.transitions[0], care = ['r', 'c', 't'].indexOf(q.care) >= 0 ? q.care : 'r', ci = { r: 0, c: 1, t: 2 }[care];
  var LN = {}; L.layers.forEach(function (l) { LN[l[0]] = l[1]; });
  var remain = L.layers.filter(function (l) { var v = tr.rows[l[0]][ci]; return v && v !== '—'; });
  var head = P.pageHead('Connected Life · offboarding', 'The old owner still has the keys', 'People move out, sell cars, hand phones down, change cleaners. Access and data live at six layers — device, hub, cloud account, integrations, vendors and backups — and a factory reset reaches one of them.');
  var ans = answer('When someone or something leaves the household, what stays behind?', 'Across ' + L.workflows.length + ' offboarding workflows, <b>' + cnt('done') + ' of ' + steps.length + '</b> steps verifiably worked in the last run, <b class="bad">' + cnt('failed') + '</b> failed and ' + cnt('unknown') + ' ' + unk('cannot be verified') + '. For “' + esc(tr.title) + '” with ' + esc(L.care[ci][1].toLowerCase()) + ', something remains at <b>' + remain.length + ' of ' + L.layers.length + '</b> layers.');
  var pick = '<div class="lf-pick" role="group" aria-label="Choose a transition">' + L.transitions.map(function (t) { return '<a class="chip' + (t === tr ? ' on' : '') + '" href="#/life/offboarding?t=' + t.id + '&care=' + care + '"' + (t === tr ? ' aria-current="true"' : '') + '>' + esc(t.title) + '</a>'; }).join('') + '</div>' +
    '<div class="lf-pick" role="group" aria-label="Level of care">' + L.care.map(function (c) { return '<a class="chip' + (c[0] === care ? ' on' : '') + '" href="#/life/offboarding?t=' + tr.id + '&care=' + c[0] + '"' + (c[0] === care ? ' aria-current="true"' : '') + '>' + esc(c[1]) + '</a>'; }).join('') + '</div>';
  var layers = '<table class="tbl lf-layers"><caption class="sr-only">What remains at each layer</caption><thead><tr><th scope="col">Layer</th><th scope="col">What remains — ' + esc(L.care[ci][1].toLowerCase()) + '</th></tr></thead><tbody>' +
    L.layers.map(function (l) { var v = tr.rows[l[0]][ci]; return '<tr' + (v && v !== '—' ? ' class="lf-rem"' : '') + '><th scope="row">' + esc(l[1]) + '</th><td class="small">' + (v === '—' ? '<span class="dim">not involved</span>' : v ? '<span class="bad">' + esc(v) + '</span>' : '<span class="ok">nothing</span>') + '</td></tr>'; }).join('') + '</tbody></table>';
  var wf = L.workflows.map(function (w) {
    return '<article class="lf-wf" data-wf="' + w.id + '"><h3>' + esc(w.name) + '</h3><ol>' + w.steps.map(function (s) { var t = ST[s[2]]; return '<li><span class="tag">' + esc(LN[s[0]]) + '</span> ' + esc(s[1]) + ' ' + (t[0] === 'unk' ? unk('not verifiable') : '<span class="' + t[0] + ' mono small">' + t[1] + '</span>') + '</li>'; }).join('') + '</ol></article>';
  }).join('');
  return head + bar('PR-DOOR') + ans + sec('lf-tr', 'Follow a transition', esc(tr.who) + ' · ' + esc(tr.when), pick + wrap('Layers', layers)) +
    sec('lf-wf-h', 'Workflows, and their last run', 'synthetic run', '<div class="lf-wfs">' + wf + '</div>' + P.cite(['PRV-0308', 'PRV-0301', 'PRV-0303', 'd_hubbackup', 'c_backup_reapply', 'c_code_expiry'], 'Records'));
} };

/* ── passports for household records ──────────────────────────────────── */
var H = P.passportHelpers || { head: function (t, n) { return '<p class="pp-type">' + esc(t) + '</p><h2 class="pp-title">' + esc(n) + '</h2>'; } };
function kvs(rows) { return '<dl class="kv">' + rows.map(function (r) { return '<dt>' + esc(r[0]) + '</dt><dd>' + r[1] + '</dd>'; }).join('') + '</dl>'; }
function see(route, label) { return '<p class="btn-row" style="margin-top:10px"><a class="btn" href="#/' + route + '">' + esc(label) + ' →</a></p>'; }
P.passports.hperson = function (p) { return H.head('Person (synthetic)', p.name, esc(p.who)) + kvs(p.roles.map(function (r) { return [L.roles.filter(function (x) { return x[0] === r[0]; })[0][1], esc(r[1])]; })) + see('life/people', 'Who the home observes'); };
P.passports.place = function (p) { return H.head('Place', p.name, esc(p.kind)) + '<p>' + esc(p.note) + '</p>' + see('life/graph', 'Household & places'); };
P.passports.hdevice = function (d) { return H.head('Device', d.name, esc(d.eco)) + kvs([['Owner', chip(d.owner)], ['Where', esc(d.room ? ROOM[d.room].name : d.place ? P.name(d.place) : 'with its owner')], ['Sensors', esc(d.sensors.join(', '))], ['Can do', esc(d.acts.join(', ') || '—')], ['Processing', esc(d.where)], ['When offline', esc(d.offline)]].concat(d.note ? [['Note', '<span class="bad">' + esc(d.note) + '</span>']] : [])) + see('life/graph', 'Household & places'); };
P.passports.haccount = function (a) { return H.head('Account', a.name) + kvs([['Holder', chip(a.holder)], ['Administrators', a.admins.map(pname).join(', ')], ['Members', a.members.map(pname).join(', ') || '—'], ['Also', esc((a.other || []).join(' · ') || '—')]]); };
P.passports.network = function (n) { return H.head('Network', n.name, esc(n.trust) + ' · ' + esc(n.operator)) + kvs(L.netTracked.map(function (t) { return [t[1], esc(n[t[0]])]; })) + see('life/networks?from=nw_home&to=' + n.id, 'Compare with home'); };
P.passports.automation = function (a) { var r = P.routineRisk(a); return H.head('Automation', a.name, P.sev(r.band) + ' ' + esc(r.why)) + kvs([['Trigger', esc(a.trigger)], ['Identity', esc(a.idSource) + ' · ' + esc(a.idConf)], ['Actions', esc(a.actions.map(function (x) { return x[1]; }).join(' · '))], ['When offline', esc(a.offline)], ['Last review', a.lastReview ? esc(P.hdate(a.lastReview)) : unk('never')], ['Consequence', esc(a.consequence)]]) + see('life/routines', 'Automation review'); };
P.passports.paction = function (a) { return H.head('Physical action · ' + CAP[a.cap], DEV[a.device].name + ' via ' + a.via, assurTag(a.assur)) + kvs([['Who can invoke it', esc(a.who)], ['Identity required', esc(a.id_)], ['Confirmation', esc(a.confirm)], ['When offline', esc(a.offline)], ['Audit', esc(a.audit)], ['Owner', P.ownerHTML(a.owner)]].concat(a.finding ? [['Finding', chip(a.finding)]] : [])) + see('life/actions?cap=' + a.cap, 'Physical-action register'); };
P.passports.hinfer = function (x) { return H.head('Home inference', x.claim, x.sensitive ? '<span class="tag sev-HIGH">sensitive</span>' : '') + kvs([['About', esc(x.about)], ['Needs', esc(x.needs.join(', '))], ['Strengthened by', esc(x.adds.join(', '))], ['Permitted uses', esc(x.uses)], ['Never', esc(x.never)], ['Correction', esc(x.correct)], ['Expiry', esc(x.expiry)]]) + see('life/inferences', 'Home inferences'); };
})();
