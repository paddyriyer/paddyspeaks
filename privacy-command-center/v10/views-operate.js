/* Views: OPERATE — privacy observability, consent, deletion, retention and
 * individual rights.
 *
 * Every page answers one question for a promise:
 *   #/observability       Which signals say a promise is breaking, and can we trust them?
 *   #/privacy/consent     When someone says no, does every copy hear it — and when?
 *   #/privacy/deletion    Can we prove Dana was deleted everywhere?
 *   #/privacy/retention   Is anything kept longer than we declared, or than we need?
 *   #/privacy/rights      Where does a rights request reach, miss, or go unverified?
 * Figures are computed from data.js, data-ops.js and data-operate.js. Unknowns
 * are shown with P.unk(); every block cites its records. */
(function () {
'use strict';
var P = window.PCC, NS = window.NS, esc = P.esc, chip = P.chip, fmtN = P.fmtN, unk = P.unk, fmtDays = P.fmtDays, uniq = P.uniq;
var V = P.views, CP = NS.consentPipeline;

/* ── small helpers ─────────────────────────────────────────────── */
function pl(n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); }
/* nearest-rank percentile: always a value that is actually in the data */
function nr(arr, q) { var a = arr.filter(function (x) { return x != null; }).sort(function (x, y) { return x - y; }); if (!a.length) return null; return a[Math.max(0, Math.ceil(q * a.length) - 1)]; }
P.nearestRank = nr;
function ms(iso) { return Date.parse(iso.length === 10 ? iso + 'T12:00:00Z' : iso + ':00Z'); }
var NOW = ms(NS.TODAY);
function hm(iso) { return iso && iso.length > 10 ? iso.slice(11, 16) + ' UTC' : ''; }
function when(iso) { if (!iso) return unk('no date'); return '<span class="nowrap">' + esc(P.hdate(iso)) + (iso.length > 10 ? ' ' + esc(hm(iso)) : '') + '</span> <span class="dim small">(' + esc(P.rel(iso.slice(0, 10))) + ')</span>'; }
function wrap(label, html) { return '<div class="tbl-wrap" tabindex="0" role="region" aria-label="' + esc(label) + '">' + html + '</div>'; }
function type(id) { var e = P.get(id); return e ? e.type : null; }
function isVendor(id) { var t = type(id); return t === 'vendor' || t === 'subprocessor'; }
function pctTxt(a, b) { return b ? Math.round(100 * a / b) + '%' : unk('no denominator'); }
function secsAfter(iso, s) { return new Date(ms(iso) + s * 1000).toISOString().slice(0, 16); }
function spark(h, label) {
  var v = h.filter(function (x) { return x != null; }); if (v.length < 2) return '';
  var W = 96, H = 24, mx = Math.max.apply(null, v), mn = Math.min.apply(null, v), r = mx - mn || 1;
  var pts = h.map(function (x, i) { return x == null ? null : (i * W / (h.length - 1)).toFixed(1) + ',' + (H - 3 - (x - mn) / r * (H - 6)).toFixed(1); }).filter(Boolean).join(' ');
  return '<svg class="op-spark" viewBox="0 0 ' + W + ' ' + H + '" aria-hidden="true"><polyline points="' + pts + '" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>';
}

/* The promise a page protects: its words, state, decision, proof and chain. */
function promiseBar(pid, extra) {
  var e = P.get(pid); if (!e) return '<p>' + unk('promise ' + pid + ' not found') + '</p>';
  var p = e.obj, st = P.promiseState(p), dec = p.decision && P.get(p.decision) ? P.decision(P.get(p.decision).obj) : null;
  var t = dec && dec.test;
  return '<section class="op-promise" aria-label="The promise at stake">' +
    '<div class="op-pq">' + P.statusTag(st.status) + ' <q>' + esc(p.text) + '</q><span class="small dim"> Promised in: ' + esc(p.where) + ' · ' + chip(p.id, p.id) + '</span></div>' +
    '<dl class="op-pf">' +
      '<div><dt>Decision</dt><dd>' + (dec ? '<a href="#/decisions/' + esc(dec.d.id) + '">' + esc(dec.d.id) + '</a> <span class="stage stage-' + esc(dec.d.status) + '">' + esc(P.STAGE_TEXT[dec.d.status]) + '</span><div class="small">' + esc(dec.d.question) + '</div>' : unk('no decision opened')) + '</dd></div>' +
      '<div><dt>Owner · due</dt><dd>' + P.ownerHTML(dec ? dec.d.owner : p.owner) + (dec ? ' · ' + (dec.due ? esc(P.hdate(dec.due)) + ' <span class="dim small">(' + esc(P.rel(dec.due)) + ')</span>' : unk('no due date')) : '') + '</dd></div>' +
      '<div class="wide"><dt>Proof of the fix</dt><dd>' + (dec ? esc(dec.d.test.text) + ' <span class="ev-r ev-' + esc(dec.d.testResult) + '">' + esc(dec.d.testResult === 'pending' ? 'not yet proven' : dec.d.testResult === 'fail' ? 'failing' : dec.d.testResult === 'unknown' ? 'cannot be run yet' : dec.d.testResult) + '</span> ' + (t ? P.freshTag(t.last, 'Last test of ' + t.control.name) : '') : unk('no test defined')) + '</dd></div>' +
    '</dl>' + (extra || '') +
    '<details class="op-chain"><summary>From promise to owner — the whole chain</summary>' + P.chainHTML(pid) + '</details>' +
    P.cite([p.id, p.decision].concat(st.why.map(function (w) { return w.id; })).filter(Boolean), 'Why it is ' + P.STATUS_TEXT[st.status].toLowerCase()) +
  '</section>';
}
function answer(q, a) { return '<div class="op-answer"><p class="op-q">' + esc(q) + '</p><p class="op-a">' + a + '</p></div>'; }
P.promiseBar = promiseBar; P.answer = answer; /* shared with views-life.js */

/* ════════════ CONSENT: model ════════════ */
function consumer(id) { return P.get(id).obj; }
function consentStats() {
  var probes = CP.probes, done = probes.filter(function (x) { return x.e2e != null; }), e2e = done.map(function (x) { return x.e2e; });
  var cs = NS.consentConsumers, live = cs.filter(function (c) { return c.p50 != null; });
  var never = cs.filter(function (c) { return c.p50 == null; });
  var stale = cs.filter(function (c) { return c.p50 == null || c.stale > 0; });
  var probed = cs.filter(function (c) { return CP.consumers[c.id] && CP.consumers[c.id].probe; });
  var slowest = live.slice().sort(function (a, b) { return b.p99 - a.p99; })[0];
  var acks = { sent: 0, acked: 0, byVendor: {} , last: null };
  probes.forEach(function (pr) { Object.keys(pr.vendors).forEach(function (v) {
    var b = acks.byVendor[v] = acks.byVendor[v] || { sent: 0, acked: 0, last: null };
    b.sent++; acks.sent++;
    if (pr.vendors[v] != null) { b.acked++; acks.acked++; var t = secsAfter(pr.at, pr.vendors[v]); if (!b.last || t > b.last) b.last = t; if (!acks.last || t > acks.last) acks.last = t; }
  }); });
  var target = (P.get('PR-OPTOUT').obj.sla || {}).hours;
  return { probes: probes, done: done, open: probes.length - done.length, p50: nr(e2e, 0.5), p95: nr(e2e, 0.95), p99: nr(e2e, 0.99),
    slowestProbe: done.slice().sort(function (a, b) { return b.e2e - a.e2e; })[0],
    live: live, never: never, stale: stale, probed: probed, slowest: slowest, acks: acks, targetS: target != null ? target * 3600 : null,
    lastProbe: probes.map(function (x) { return x.at; }).sort().pop() };
}
/* Dana's revocation, as rows ordered by when her "no" arrives. */
function danaRows() {
  var D = CP.dana, now = (NOW - ms(D.at)) / 1000;
  var rows = D.steps.map(function (s) { return { ent: s.c, name: P.name(s.c), kind: (CP.consumers[s.c] || {}).kind, arrive: s.arrive, acts: s.acts, evidence: s.evidence, copy: false }; })
    .concat(CP.copies.map(function (c) { return { ent: c.ent, name: c.name, kind: c.kind, arrive: c.danaArrive, acts: [], evidence: c.how, copy: true }; }));
  rows.sort(function (a, b) { var x = a.arrive == null ? Infinity : a.arrive, y = b.arrive == null ? Infinity : b.arrive; return x - y; });
  return { rows: rows, now: now, D: D };
}
function rowState(r, t) { return r.arrive == null ? 'never' : r.arrive <= t ? 'has' : 'old'; }
var STATE_TXT = { has: 'has her “no”', old: 'still on her old “yes”', never: 'never — stays on “yes”' };
function danaSummary(R, t) {
  var c = { has: 0, old: 0, never: 0 }; R.rows.forEach(function (r) { c[rowState(r, t)]++; });
  return '<b>' + c.has + ' of ' + R.rows.length + '</b> places have her “no”; <b>' + c.old + '</b> still act on her old “yes” and will catch up; <b>' + c.never + '</b> never will as built.';
}
function stopsFor(R) {
  var s = [0].concat(R.rows.map(function (r) { return r.arrive; }).filter(function (a) { return a != null && a <= R.now; })).concat([R.now]);
  return uniq(s.sort(function (a, b) { return a - b; }));
}
function stopLabel(R, t) { return t === R.now ? 'today, ' + P.hdate(NS.TODAY) + ' (' + P.fmtSecs(t) + ' after)' : t === 0 ? 'the moment she opted out' : P.fmtSecs(t) + ' after — ' + P.hdate(secsAfter(R.D.at, t)) + ' ' + hm(secsAfter(R.D.at, t)); }

function latencyChart(cs) {
  var W = 760, rowH = 30, H = cs.length * rowH + 40, x0 = 230, xs = function (v) { return x0 + (Math.log10(Math.max(v, 0.05)) + 1.4) / (6.2 + 1.4) * (W - x0 - 60); };
  var s = '<svg width="100%" viewBox="0 0 ' + W + ' ' + H + '" style="min-width:560px" role="img" aria-label="Consent propagation latency per consumer, log scale. The table below has the same values.">';
  [[0.1, '100 ms'], [1, '1 s'], [60, '1 min'], [3600, '1 h'], [86400, '1 d'], [604800, '7 d']].forEach(function (t) { var x = xs(t[0]); s += '<line x1="' + x + '" x2="' + x + '" y1="10" y2="' + (H - 24) + '" stroke="#e4dfd4"/><text x="' + x + '" y="' + (H - 8) + '" fill="#6b6457" font-size="12" text-anchor="middle">' + t[1] + '</text>'; });
  cs.forEach(function (c, i) {
    var y = 20 + i * rowH;
    s += '<text x="' + (x0 - 10) + '" y="' + (y + 4) + '" fill="' + (c.p50 == null ? '#b3400b' : '#3a4250') + '" font-size="13" text-anchor="end">' + esc(c.name) + '</text>';
    if (c.p50 == null) s += '<line x1="' + x0 + '" x2="' + (W - 4) + '" y1="' + y + '" y2="' + y + '" stroke="#b3400b" stroke-dasharray="3 4" stroke-opacity=".6"/><text x="' + (W - 4) + '" y="' + (y - 5) + '" fill="#b3400b" font-size="11.5" text-anchor="end">never · ' + esc(c.mode) + '</text>';
    else s += '<line x1="' + xs(c.p50) + '" x2="' + xs(c.p99) + '" y1="' + y + '" y2="' + y + '" stroke="#0b7d60" stroke-opacity=".5" stroke-width="2"/><circle cx="' + xs(c.p95) + '" cy="' + y + '" r="3.2" fill="#fffdf9" stroke="#0b7d60"/><circle cx="' + xs(c.p50) + '" cy="' + y + '" r="5" fill="#0b7d60"/>';
  });
  return s + '</svg>';
}
function stateMachine() {
  return '<svg viewBox="0 0 420 182" width="100%" class="op-sm" role="img" aria-label="Consent state machine. UNKNOWN goes to GRANTED on opt in. GRANTED goes to REVOKED on revoke and to EXPIRED when scope ends. REVOKED returns to GRANTED on re-consent; EXPIRED on re-prompt. Default: no processing."><defs><marker id="opSmA" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#6b6457"/></marker></defs>' +
    [['UNKNOWN', 20, 70, '#6346c9'], ['GRANTED', 160, 20, '#0b7d60'], ['REVOKED', 300, 70, '#b3400b'], ['EXPIRED', 160, 120, '#7a5200']].map(function (n) { return '<rect x="' + n[1] + '" y="' + n[2] + '" width="100" height="30" rx="15" fill="#fffdf9" stroke="' + n[3] + '"' + (n[0] === 'UNKNOWN' ? ' stroke-dasharray="4 3"' : '') + '/><text x="' + (n[1] + 50) + '" y="' + (n[2] + 19) + '" fill="' + n[3] + '" font-size="11.5" font-weight="700" text-anchor="middle" font-family="JetBrains Mono, monospace">' + n[0] + '</text>'; }).join('') +
    '<path d="M120,78 L160,42" stroke="#6b6457" marker-end="url(#opSmA)"/><text x="100" y="52" fill="#4f5968" font-size="10.5">opt in</text>' +
    '<path d="M260,40 L300,72" stroke="#6b6457" marker-end="url(#opSmA)"/><text x="284" y="48" fill="#4f5968" font-size="10.5">revoke</text>' +
    '<path d="M300,94 C260,110 250,40 262,36" fill="none" stroke="#6b6457" stroke-dasharray="3 3" marker-end="url(#opSmA)"/><text x="304" y="116" fill="#4f5968" font-size="10.5">re-consent</text>' +
    '<path d="M210,50 L210,118" stroke="#6b6457" marker-end="url(#opSmA)"/><text x="204" y="90" fill="#4f5968" font-size="10.5" text-anchor="end">scope ends</text>' +
    '<path d="M160,135 C110,150 90,110 170,52" fill="none" stroke="#6b6457" stroke-dasharray="3 3" marker-end="url(#opSmA)"/><text x="36" y="152" fill="#4f5968" font-size="10.5">re-prompt</text>' +
    '<text x="20" y="176" fill="#4f5968" font-size="10.5">default in UNKNOWN, REVOKED, EXPIRED: no processing</text></svg>';
}

/* ════════════ CONSENT: page ════════════ */
V['privacy/consent'] = { title: 'Consent', render: function () {
  var S = consentStats(), R = danaRows(), D = R.D, cs = NS.consentConsumers, stops = stopsFor(R);
  var inScope = cs.filter(function (c) { var k = CP.consumers[c.id]; return k && k.purposes.some(function (p) { return D.purposes.indexOf(p) >= 0; }); });
  var outScope = cs.filter(function (c) { return inScope.indexOf(c) < 0; });
  var over = S.targetS != null && S.p99 != null && S.p99 > S.targetS;
  var adr = S.acks.byVendor.v_adreach || { sent: 0, acked: 0 };
  var unknownGranted = cs.filter(function (c) { var k = CP.consumers[c.id]; return k && /granted/.test(k.unknownAs); });

  var head = P.pageHead('Operate · consent', 'Consent is state, not a checkbox', 'A “no” is a state change that has to reach every copy of a person’s data: read paths, caches, retry queues, nightly jobs, cached segments, models built from it, and partners. This page follows one “no” — Dana’s — and measures every other.');
  var ans = answer('When someone says no, does every system and partner stop within the promised time?',
    (over ? '<b class="bad">No.</b> ' : S.p99 == null ? unk('Cannot tell') + ' ' : '<b class="ok">Measured, yes.</b> ') +
    'End-to-end P99 across ' + pl(S.done.length, 'probe revocation') + ' is <b>' + P.fmtSecs(S.p99) + '</b> against a ' + (S.targetS != null ? P.fmtSecs(S.targetS) : unk('unset')) + ' promise. ' +
    '<b>' + S.never.length + ' of ' + cs.length + '</b> consumers never receive a revocation, and AdReach acknowledged <b>' + adr.acked + ' of ' + adr.sent + '</b> probe revocations. ' +
    'The probes watch ' + S.probed.length + ' of ' + cs.length + ' consumers, so the slowest paths are measured by nobody: ' + unk('true end-to-end latency unknown') + '.');

  /* 1 · Dana's replay */
  var rowsHTML = R.rows.map(function (r, i) {
    var st = rowState(r, R.now), at = r.arrive == null ? null : secsAfter(D.at, r.arrive);
    return '<tr class="rp-row rp-' + st + '" data-arrive="' + (r.arrive == null ? '' : r.arrive) + '" data-ent-id="' + esc(r.ent) + '">' +
      '<th scope="row">' + chip(r.ent, r.name) + (r.copy ? ' <span class="tag">copy</span>' : '') + '</th>' +
      '<td class="small" data-label="Kind">' + esc(r.kind || '—') + '</td>' +
      '<td data-label="Her “no” arrives">' + (r.arrive == null ? '<span class="bad">never</span>' : '<span class="mono small">+' + esc(P.fmtSecs(r.arrive)) + '</span><div class="small dim">' + esc(P.hdate(at) + ' ' + hm(at)) + (r.arrive > R.now ? ' · scheduled' : '') + '</div>') + '</td>' +
      '<td class="rp-st" data-label="State"><span class="rp-badge">' + esc(STATE_TXT[st]) + '</span></td>' +
      '<td class="small" data-label="Acted on the old answer">' + (r.acts.length ? r.acts.map(function (a) { return '<div><b>' + a[1] + '</b> ' + esc(a[0]) + '</div>'; }).join('') : '<span class="dim">nothing recorded</span>') + '</td>' +
      '<td class="small dim" data-label="Evidence">' + esc(r.evidence) + '</td></tr>';
  }).join('');
  var vend = D.vendors.map(function (x) {
    var st = x.ack ? '<span class="ok">acknowledged</span> ' + when(x.ack) : x.channel ? unk('not acknowledged') : unk('no channel — cannot be asked');
    return '<tr data-vendor="' + esc(x.v) + '" data-ack="' + (x.ack ? 'yes' : 'no') + '"><th scope="row">' + chip(x.v) + '</th><td class="small">' + (x.channel ? esc(x.channel) : unk('none')) + '</td><td>' + (x.sent ? when(x.sent) : unk('never sent')) + '</td><td>' + st + '</td></tr>';
  }).join('');
  var replay = '<section class="card op-sec" aria-labelledby="op-dana"><div class="card-h"><h2 class="sec" id="op-dana">Replay: Dana says no</h2><span class="sub">' + chip(D.person) + ' · ' + esc(D.purposes.join(' and ')) + ' off at ' + esc(P.hdate(D.at) + ' ' + hm(D.at)) + ' · request ' + esc(D.request) + '</span></div>' +
    '<p class="small">The nightly audience job had read consent two hours earlier. Move through time to see, for each place her data lives, when her “no” arrives and what acted on her old “yes” meanwhile.</p>' +
    '<div class="rp-ctl"><button class="btn" id="rpPlay" type="button">▶ Replay from the start</button>' +
      '<label for="rpT" class="small">Time since she opted out</label><input type="range" id="rpT" min="0" max="' + (stops.length - 1) + '" step="1" value="' + (stops.length - 1) + '" aria-valuetext="' + esc(stopLabel(R, R.now)) + '">' +
      '<output id="rpOut" for="rpT" class="small mono">' + esc(stopLabel(R, R.now)) + '</output></div>' +
    '<p class="rp-sum" id="rpSum" aria-live="polite">' + danaSummary(R, R.now) + '</p>' +
    wrap('Dana’s revocation, place by place', '<table class="tbl rp-t" id="rpTable"><caption class="sr-only">Where Dana’s “no” arrives, in order</caption><thead><tr><th scope="col">Where</th><th scope="col">Kind</th><th scope="col">Her “no” arrives</th><th scope="col">State</th><th scope="col">Acted on the old answer</th><th scope="col">Evidence</th></tr></thead><tbody>' + rowsHTML + '</tbody></table>') +
    '<h3 class="op-h3">Vendors: who has acknowledged?</h3>' +
    wrap('Vendor acknowledgements for Dana', '<table class="tbl op-vack"><caption class="sr-only">Vendor acknowledgements of Dana’s revocation</caption><thead><tr><th scope="col">Vendor</th><th scope="col">Channel</th><th scope="col">Sent</th><th scope="col">Acknowledged</th></tr></thead><tbody>' + vend + '</tbody></table>') +
    (outScope.length ? '<p class="small dim">Not in scope of her revocation (they read a different consent): ' + outScope.map(function (c) { return chip(c.id); }).join(' ') + '</p>' : '') +
    P.cite([D.person, D.promise, D.decision].concat(R.rows.map(function (r) { return r.ent; })).concat(D.vendors.map(function (x) { return x.v; })).concat(['INC-2026-014']), 'Records') + '</section>';

  /* 2 · propagation across consumers */
  var tbl = '<table class="tbl op-cons"><caption class="sr-only">Consent propagation latency by consumer</caption><thead><tr><th scope="col">Consumer</th><th scope="col">Kind</th><th scope="col">Mode</th><th scope="col" class="num">P50</th><th scope="col" class="num">P95</th><th scope="col" class="num">P99</th><th scope="col">Probe</th><th scope="col">State</th></tr></thead><tbody>' +
    cs.map(function (c) {
      var k = CP.consumers[c.id] || {}, isStale = c.p50 == null || c.stale > 0;
      return '<tr data-consumer="' + esc(c.id) + '"' + (isStale ? ' class="op-stale" data-stale="1"' : '') + '><th scope="row">' + chip(c.id) + '</th><td class="small">' + esc(k.kind || '—') + '</td><td class="small">' + esc(c.mode) + '</td>' +
        '<td class="num">' + (c.p50 == null ? '<span class="bad">never</span>' : esc(P.fmtSecs(c.p50))) + '</td><td class="num">' + (c.p95 == null ? '—' : esc(P.fmtSecs(c.p95))) + '</td><td class="num">' + (c.p99 == null ? '—' : esc(P.fmtSecs(c.p99))) + '</td>' +
        '<td class="small">' + (k.probe ? '<span class="ok">probed</span>' : unk('no probe')) + '</td>' +
        '<td class="small">' + (isStale ? '<span class="bad">stale</span>' + (c.stale ? ' · ' + fmtN(c.stale) + ' people on an old answer' : ' · never receives revocations') : '<span class="ok">propagates</span>') + '</td></tr>';
    }).join('') + '</tbody></table>';
  var staleSum = S.stale.filter(function (c) { return c.stale; }), staleMax = staleSum.reduce(function (m, c) { return Math.max(m, c.stale); }, 0), staleTot = staleSum.reduce(function (m, c) { return m + c.stale; }, 0);
  var prop = '<section class="card op-sec" aria-labelledby="op-prop"><div class="card-h"><h2 class="sec" id="op-prop">Propagation across every consumer</h2><span class="sub">end to end, and per consumer</span></div>' +
    '<div class="op-stats" id="opE2E" data-p50="' + S.p50 + '" data-p95="' + S.p95 + '" data-p99="' + S.p99 + '" data-n="' + S.done.length + '">' +
      [['P50', S.p50], ['P95', S.p95], ['P99', S.p99]].map(function (x) { return '<div class="op-stat"><span class="op-sv' + (S.targetS != null && x[1] > S.targetS ? ' bad' : '') + '">' + esc(P.fmtSecs(x[1])) + '</span><span class="op-sl">end-to-end ' + x[0] + '</span></div>'; }).join('') +
      '<div class="op-stat"><span class="op-sv">' + (S.targetS != null ? esc(P.fmtSecs(S.targetS)) : unk('unset')) + '</span><span class="op-sl">promised (PR-OPTOUT)</span></div>' +
      '<div class="op-stat"><span class="op-sv bad">' + S.stale.length + '<small> of ' + cs.length + '</small></span><span class="op-sl">stale consumers</span></div></div>' +
    '<p class="small dim">How it is computed: nearest-rank percentiles over ' + pl(S.done.length, 'completed probe revocation') + ' (' + S.open + ' still in flight and excluded, which flatters the result). End-to-end = until the last probed consumer that propagates at all applies the “no”. Slowest probe: ' + (S.slowestProbe ? esc(S.slowestProbe.id) + ', ' + esc(P.fmtSecs(S.slowestProbe.e2e)) + ' via ' + chip(S.slowestProbe.slowest) : unk('none')) + '. Latest probe ' + P.freshTag(S.lastProbe.slice(0, 10), 'Latest probe') + '.</p>' +
    '<p>Slowest path that propagates at all: ' + chip('s_consent') + ' → ' + (S.slowest ? chip(S.slowest.id) + ' — P99 <b>' + esc(P.fmtSecs(S.slowest.p99)) + '</b>' + (CP.consumers[S.slowest.id] && !CP.consumers[S.slowest.id].probe ? ' (' + unk('not probed') + ', so the end-to-end figures above do not include it)' : '') : unk('none')) + '.</p>' +
    '<div class="legend" aria-hidden="true"><span><i class="op-lg-dot"></i>P50</span><span><i class="op-lg-ring"></i>P95</span><span><i style="background:#0b7d60;opacity:.5"></i>P50 to P99</span><span><i style="background:repeating-linear-gradient(90deg,#b3400b 0 4px,transparent 4px 7px)"></i>never propagates</span></div>' +
    '<div class="pv-scroll op-fig" tabindex="0" role="region" aria-label="Consent latency chart (scrolls sideways)">' + latencyChart(cs) + '</div>' +
    '<details class="op-more" open><summary>Table: latency, probes and stale consumers</summary>' + wrap('Consent latency table', tbl) + '</details>' +
    (staleSum.length ? '<div class="callout warn"><b>Up to ' + fmtN(staleTot) + ' people</b> are processed on an old answer by ' + pl(staleSum.length, 'consumer') + '. People overlap between consumers, so the true number is between ' + fmtN(staleMax) + ' and ' + fmtN(staleTot) + '.</div>' : '') +
    (unknownGranted.length ? '<div class="callout warn">' + unknownGranted.map(function (c) { return chip(c.id); }).join(' ') + ' treats <span class="unknown">UNKNOWN</span> as <b>granted</b> when its cache misses. The model says UNKNOWN means no processing.</div>' : '') +
    '<h3 class="op-h3">Copies the consumer list does not show</h3><ul class="op-list">' + CP.copies.map(function (c) { return '<li>' + chip(c.ent, c.name) + ' <span class="tag">' + esc(c.kind) + '</span> ' + (c.honours ? '<span class="warn">catches up late</span>' : '<span class="bad">never re-reads consent</span>') + ' — ' + esc(c.how) + '</li>'; }).join('') + '</ul>' +
    '<details class="op-more"><summary>Vendor acknowledgements across ' + pl(S.probes.length, 'probe revocation') + '</summary>' + wrap('Vendor acknowledgements across probes', '<table class="tbl"><thead><tr><th scope="col">Vendor</th><th scope="col" class="num">Sent</th><th scope="col" class="num">Acknowledged</th><th scope="col">Latest acknowledgement</th></tr></thead><tbody>' +
      Object.keys(S.acks.byVendor).map(function (v) { var b = S.acks.byVendor[v]; return '<tr><th scope="row">' + chip(v) + '</th><td class="num">' + b.sent + '</td><td class="num ' + (b.acked < b.sent ? 'bad' : 'ok') + '">' + b.acked + '</td><td>' + (b.last ? when(b.last) : unk('never')) + '</td></tr>'; }).join('') + '</tbody></table>') +
      wrap('Probe revocations', '<table class="tbl"><thead><tr><th scope="col">Probe</th><th scope="col">Revoked</th><th scope="col" class="num">End to end</th><th scope="col">Slowest</th></tr></thead><tbody>' + S.probes.map(function (x) { return '<tr><td class="mono small">' + esc(x.id) + '</td><td>' + when(x.at) + '</td><td class="num">' + (x.e2e == null ? unk('in flight') : esc(P.fmtSecs(x.e2e))) + '</td><td>' + (x.slowest ? chip(x.slowest) : '—') + '</td></tr>'; }).join('') + '</tbody></table>') + '</details>' +
    P.cite(cs.map(function (c) { return c.id; }).concat(['c_consent_read', 'c_consent_batch', 's_consent']), 'Records') + '</section>';

  /* 3 · the state model */
  var T = CP.transitions;
  var model = '<section class="card op-sec" aria-labelledby="op-sm"><div class="card-h"><h2 class="sec" id="op-sm">The state machine</h2><span class="sub">advertising consent · last 7 days</span></div>' +
    '<div class="op-2"><div>' + stateMachine() + '<dl class="op-states">' + CP.states.map(function (s) { return '<div><dt><span class="mono ' + (s.id === 'UNKNOWN' ? 'unknown' : '') + '">' + esc(s.id) + '</span></dt><dd>' + esc(s.meaning) + ' <span class="small ' + (s.processes ? 'ok' : 'dim') + '">' + (s.processes ? 'processing allowed' : 'no processing') + '</span></dd></div>'; }).join('') + '</dl></div>' +
    '<div>' + wrap('Consent transitions, last 7 days', '<table class="tbl"><caption class="sr-only">Consent state transitions in the last 7 days</caption><thead><tr><th scope="col">From</th><th scope="col">To</th><th scope="col">Trigger</th><th scope="col" class="num">People</th></tr></thead><tbody>' + T.map(function (t) { return '<tr><td class="mono small">' + esc(t.from) + '</td><td class="mono small">' + esc(t.to) + '</td><td class="small">' + esc(t.trigger) + '</td><td class="num">' + fmtN(t.n) + '</td></tr>'; }).join('') + '</tbody></table>') +
      '<p class="small dim">Every transition must reach every consumer above. A revocation that reaches ' + (cs.length - S.never.length) + ' of ' + cs.length + ' consumers has not happened for the rest.</p></div></div></section>';

  return head + promiseBar('PR-OPTOUT') + ans + replay + prop + model;
}, mount: function (root) {
  var R = danaRows(), stops = stopsFor(R), inp = root.querySelector('#rpT'), out = root.querySelector('#rpOut'), sum = root.querySelector('#rpSum'), play = root.querySelector('#rpPlay');
  var rows = root.querySelectorAll('#rpTable tbody tr'), timers = [];
  function show(i) {
    var t = stops[i];
    rows.forEach(function (tr) { var a = tr.getAttribute('data-arrive'), st = a === '' ? 'never' : +a <= t ? 'has' : 'old'; tr.className = 'rp-row rp-' + st; tr.querySelector('.rp-badge').textContent = STATE_TXT[st]; });
    out.textContent = stopLabel(R, t); inp.setAttribute('aria-valuetext', stopLabel(R, t)); sum.innerHTML = danaSummary(R, t);
  }
  inp.addEventListener('input', function () { timers.forEach(clearTimeout); timers = []; show(+inp.value); });
  play.addEventListener('click', function () {
    timers.forEach(clearTimeout); timers = [];
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { inp.value = stops.length - 1; show(stops.length - 1); return; }
    stops.forEach(function (s, i) { timers.push(setTimeout(function () { inp.value = i; show(i); }, 650 * i)); });
  });
} };

/* ════════════ DELETION ════════════ */
var CAT = { store: 'Operational store', service: 'Operational store', cache: 'Cache', stream: 'Stream · retry queue', log: 'Log', index: 'Search index', warehouse: 'Warehouse',
  featurestore: 'Feature store', vector: 'Embeddings · vector store', backup: 'Backup', job: 'Derived store' };
var CAT_ORDER = ['Operational store', 'Cache', 'Stream · retry queue', 'Log', 'Search index', 'Warehouse', 'Feature store', 'Embeddings · vector store', 'Derived store', 'Model', 'Backup', 'Vendor'];
function catOf(id) { var e = P.get(id); if (!e) return 'Unknown'; if (e.type === 'vendor' || e.type === 'subprocessor') return 'Vendor'; if (e.type === 'model') return 'Model'; return CAT[e.obj.kind] || 'Operational store'; }
function outcomeOf(l) {
  if (l.hold) return 'held';
  if (l.check === 'found' || l.receipt === 'failed' || l.receipt === 'none') return 'missed';
  if (l.check === 'absent' || l.check === 'attested') return 'reached';
  return 'unverified';
}
P.deletionOutcome = outcomeOf;
function traceRows() {
  var tg = {}; NS.deletionTargets.forEach(function (t) { tg[t[0] + '|' + t[1]] = t; });
  return NS.deletionTrace.locations.map(function (l) {
    var k = l.key.split('|'), t = tg[l.key];
    return { l: l, id: k[0], where: k[1], target: t || null, mech: t ? t[2] : null, cat: catOf(k[0]), outcome: outcomeOf(l) };
  }).sort(function (a, b) { return (CAT_ORDER.indexOf(a.cat) - CAT_ORDER.indexOf(b.cat)) || 0; });
}
var OUT_TXT = { reached: 'reached', missed: 'missed', held: 'held (legal hold)', unverified: 'unverified' };
function outcomeHTML(o) { return o === 'unverified' ? unk('UNVERIFIED') : '<span class="op-o op-o-' + o + '">' + (o === 'reached' ? '✓ ' : o === 'missed' ? '✗ ' : '⏸ ') + esc(OUT_TXT[o]) + '</span>'; }
var RECEIPT_TXT = { ok: 'confirmed', failed: 'failed', pending: 'pending', none: 'no deletion path', unknown: 'unknown' };
var CHECK_TXT = { absent: 'absent', found: 'found', attested: 'vendor confirmed', 'not run': 'not run', 'not possible': 'cannot be checked' };
function countOut(rows) { var c = { reached: 0, missed: 0, unverified: 0, held: 0 }; rows.forEach(function (r) { c[r.outcome]++; }); return c; }

V['privacy/deletion'] = { title: 'Deletion', render: function () {
  var DT = NS.deletionTrace, rows = traceRows(), c = countOut(rows), n = rows.length, extra = rows.filter(function (r) { return r.l.extra; });
  var told = DT.told, toldMin = Math.round((ms(told.at) - ms(DT.received)) / 60000);
  var head = P.pageHead('Operate · deletion', 'Can we prove Dana was deleted everywhere?', 'One request fans out to every place her data was copied: operational stores, logs, search indexes, caches, warehouses, feature stores, embeddings, models, backups and vendors. A location counts as reached only with evidence; everything else is a miss or an unknown.');
  var ans = answer('Can we prove Dana was deleted everywhere?', (c.missed || c.unverified ? '<b class="bad">No.</b> ' : '<b class="ok">Yes.</b> ') +
    'Of <b>' + n + '</b> locations her request had to reach, <b class="ok">' + c.reached + ' reached</b>, <b class="bad">' + c.missed + ' missed</b>, <b class="unknown">' + c.unverified + ' unverified</b> and ' + c.held + ' held under a legal hold. ' +
    extra.length + ' of them are copies the deletion orchestrator does not know about. She was told “' + esc(told.text) + '” ' + pl(toldMin, 'minute') + ' after asking, on ' + esc(P.hdate(told.at)) + '.');
  var seg = '<div class="op-bar" role="img" aria-label="' + esc(c.reached + ' reached, ' + c.missed + ' missed, ' + c.unverified + ' unverified, ' + c.held + ' held, of ' + n + ' locations') + '">' +
    ['reached', 'missed', 'unverified', 'held'].map(function (k) { return c[k] ? '<span class="op-bar-' + k + '" style="flex:' + c[k] + '"></span>' : ''; }).join('') + '</div>' +
    '<div class="legend op-legend" aria-hidden="true"><span><i class="op-lg-reached"></i>reached ' + c.reached + '</span><span><i class="op-lg-missed"></i>missed ' + c.missed + '</span><span><i class="op-lg-unverified"></i>unverified ' + c.unverified + '</span><span><i class="op-lg-held"></i>held ' + c.held + '</span></div>';
  var tbl = '<table class="tbl op-del" id="opDelTable" data-n="' + n + '" data-reached="' + c.reached + '" data-missed="' + c.missed + '" data-unverified="' + c.unverified + '" data-held="' + c.held + '"><caption class="sr-only">Every location Dana’s deletion had to reach</caption><thead><tr><th scope="col">Location</th><th scope="col">Kind</th><th scope="col">Mechanism</th><th scope="col">Receipt</th><th scope="col">T+72h check</th><th scope="col">Outcome</th><th scope="col">Evidence</th></tr></thead><tbody>' +
    rows.map(function (r) {
      var l = r.l, notes = [];
      if (l.tombstone) notes.push('Tombstone: ' + esc(l.tombstone));
      if (l.hold) notes.push('Legal hold ' + esc(l.hold));
      if (l.expires) notes.push('Gone by ' + esc(P.hdate(l.expires)) + ' (' + esc(P.rel(l.expires)) + ')');
      if (l.resurrect) notes.push('<span class="bad">Resurrection risk:</span> ' + esc(l.resurrect));
      if (l.shred) notes.push('Crypto-shredded — see the limits below');
      return '<tr data-loc="' + esc(l.key) + '" data-outcome="' + r.outcome + '"><th scope="row">' + chip(r.id) + '<div class="small">' + esc(r.where) + '</div>' + (l.extra ? '<span class="tag op-extra">not in the orchestrator</span>' : '') + '</th>' +
        '<td class="small" data-label="Kind">' + esc(r.cat) + '</td><td class="small" data-label="Mechanism">' + (r.mech ? esc(r.mech) : unk('no mechanism')) + '</td>' +
        '<td class="small ' + (l.receipt === 'ok' ? '' : l.receipt === 'unknown' ? 'unknown' : l.receipt === 'pending' ? 'warn' : 'bad') + '" data-label="Receipt">' + esc(RECEIPT_TXT[l.receipt]) + '</td>' +
        '<td class="small ' + (l.check === 'found' ? 'bad' : l.check === 'absent' ? 'ok' : l.check === 'attested' ? '' : 'unknown') + '" data-label="T+72h check">' + esc(CHECK_TXT[l.check]) + '</td>' +
        '<td data-label="Outcome">' + outcomeHTML(r.outcome) + '</td>' +
        '<td class="small" data-label="Evidence">' + esc(l.evidence) + ' ' + (l.at ? P.freshTag(l.at, 'Evidence') : unk('no evidence')) + (notes.length ? '<div class="op-notes">' + notes.join('<br>') + '</div>' : '') + '</td></tr>';
    }).join('') + '</tbody></table>';
  var trace = '<section class="card op-sec" aria-labelledby="op-dtrace"><div class="card-h"><h2 class="sec" id="op-dtrace">Dana’s request, location by location</h2><span class="sub">' + chip(DT.person) + ' · ' + esc(DT.request) + ' · received ' + esc(P.hdate(DT.received) + ' ' + hm(DT.received)) + ' · T+72h check ' + esc(P.hdate(DT.checkAt) + ' ' + hm(DT.checkAt)) + '</span></div>' + seg +
    '<p class="small dim">Rule: <b>reached</b> needs a T+72h check that found nothing, or a vendor’s confirmation; <b>missed</b> means the check found her, the delete failed, or there is no deletion path; <b>held</b> is a documented legal hold; anything else is <span class="unknown">unverified</span> — never counted as success.</p>' +
    wrap('Deletion locations for Dana', tbl) + P.cite(uniq(rows.map(function (r) { return r.id; })).concat([DT.person, DT.promise, DT.decision, 'c_delete_orch', 'c_delete_verify']), 'Records') + '</section>';

  /* canaries */
  var cans = NS.deletionCanaries, last = cans[cans.length - 1];
  var canary = '<section class="card op-sec" aria-labelledby="op-can"><div class="card-h"><h2 class="sec" id="op-can">Post-deletion verification: canaries at T+72h</h2><span class="sub">test identities deleted, then re-queried</span></div>' +
    '<p>Latest run ' + esc(last.id) + ': deleted ' + esc(P.hdate(last.deleted)) + ', checked ' + esc(P.hdate(last.checked)) + ' ' + P.freshTag(last.checked.slice(0, 10), 'Canary check') + ' — still found in <b class="bad">' + last.found.length + ' of ' + last.checkedN + '</b> locations: ' + last.found.map(function (x) { return chip(x); }).join(' ') + '.</p>' +
    '<p class="small dim">The canary only checks the ' + NS.deletionTargets.length + ' registered targets. The ' + pl(extra.length, 'copy', 'copies') + ' the orchestrator does not know about are never checked, so a clean canary would still not prove deletion.</p>' +
    wrap('Canary runs', '<table class="tbl"><caption class="sr-only">Canary runs and what survived</caption><thead><tr><th scope="col">Run</th><th scope="col">Deleted</th><th scope="col">Checked</th><th scope="col" class="num">Survived in</th><th scope="col">Where</th></tr></thead><tbody>' + cans.slice().reverse().map(function (x) { return '<tr><td class="mono small">' + esc(x.id) + '</td><td>' + when(x.deleted) + '</td><td>' + when(x.checked) + '</td><td class="num bad">' + x.found.length + ' of ' + x.checkedN + '</td><td>' + x.found.map(function (f) { return chip(f); }).join(' ') + '</td></tr>'; }).join('') + '</tbody></table>') +
    P.cite(['c_delete_verify'].concat(last.found), 'Records') + '</section>';

  /* tombstones, holds, resurrection, crypto-shredding */
  var tomb = rows.filter(function (r) { return r.l.tombstone; }), res = rows.filter(function (r) { return r.l.resurrect; }), held = rows.filter(function (r) { return r.l.hold; });
  var holdsById = {}; NS.legalHolds.forEach(function (h) { holdsById[h.id] = h; });
  var mech = '<section class="card op-sec" aria-labelledby="op-mech"><h2 class="sec" id="op-mech">Tombstones, holds, resurrection and crypto-shredding</h2><div class="op-2">' +
    '<div><h3 class="op-h3">Resurrection risk (' + res.length + ')</h3><ul class="op-list">' + res.map(function (r) { return '<li>' + chip(r.id, r.where) + ' — ' + esc(r.l.resurrect) + '</li>'; }).join('') + '</ul>' +
      '<h3 class="op-h3">Tombstones (' + tomb.length + ')</h3><ul class="op-list">' + tomb.map(function (r) { return '<li>' + chip(r.id, r.where) + ' — ' + esc(r.l.tombstone) + '</li>'; }).join('') + '</ul>' +
      '<p class="small">Restore safety: ' + chip('c_backup_reapply') + ' last drill ' + P.freshTag(P.controlTest('c_backup_reapply').last, 'Restore drill') + '; exception: ' + esc(P.controlTest('c_backup_reapply').exceptions.join('; ') || 'none') + '.</p></div>' +
    '<div><h3 class="op-h3">Legal holds on her data (' + held.length + ')</h3><ul class="op-list">' + held.map(function (r) { var h = holdsById[r.l.hold]; return '<li>' + chip(r.id, r.where) + ' — ' + (h ? esc(h.id + ': ' + h.scope + ' (' + h.basis + '; review ' + P.hdate(h.review) + ')') : unk('hold ' + r.l.hold + ' not registered')) + '</li>'; }).join('') + '</ul>' +
      '<h3 class="op-h3">What crypto-shredding cannot do</h3><ul class="op-list">' + NS.cryptoShredLimits.map(function (x) { return '<li>' + esc(x.text) + ' ' + x.ents.map(function (e) { return chip(e); }).join(' ') + '</li>'; }).join('') + '</ul></div></div>' +
    '<p class="small dim">Legal holds are orientation, not legal advice.</p></section>';

  return head + promiseBar('PR-DELETE') + ans + trace + canary + mech;
} };

/* ════════════ RETENTION ════════════ */
var HOLDS = function (ds) { return NS.legalHolds.filter(function (h) { return h.dataset === ds; }); };
function retentionRows() {
  var pol = NS.retentionPolicy;
  return NS.datasets.map(function (d) {
    var r = d.retention, decl = pol.declared.hasOwnProperty(d.id) ? pol.declared[d.id] : null, scanned = pol.notScanned.indexOf(d.id) < 0;
    var obs = scanned ? d.age : null, req = r.required, v = [];
    if (!scanned) v.push(['Not scanned', 'unk']);
    if (decl == null) v.push(['Nothing declared', 'unk']);
    if (obs != null && decl != null && decl > 0 && obs > decl) v.push(['Kept longer than declared', 'bad']);
    if (req != null && decl != null && req > 0 && decl > req) v.push(['Declared longer than needed', 'warn']);
    if (req == null) v.push(['No requirement', 'unk']);
    if (!r.ttl && decl !== 0) v.push(['No TTL enforcing it', 'warn']);
    var holds = HOLDS(d.id);
    return { d: d, decl: decl, obs: obs, req: req, ttl: r.ttl, scanned: scanned, v: v, holds: holds, viol: v.some(function (x) { return x[0] === 'Kept longer than declared'; }) };
  });
}
function daysTxt(d, kind) { if (d == null) return unk(kind === 'obs' ? 'not observed' : 'none'); if (d === 0) return '<span class="small">with its source</span>'; return esc(fmtDays(d)); }
function retentionChart(rows) {
  var W = 780, x0 = 214, FS = 12.5, xs = function (d) { return x0 + Math.log10(Math.max(d, 1)) / Math.log10(4000) * (W - x0 - 30); }, H = rows.length * 24 + 34;
  var s = '<svg width="100%" viewBox="0 0 ' + W + ' ' + H + '" style="min-width:560px" role="img" aria-label="Required, declared and observed retention per dataset, log scale. The table below has the same values.">';
  [[1, '1 d'], [7, '1 wk'], [30, '30 d'], [90, '90 d'], [365, '1 yr'], [1095, '3 yr'], [3650, '10 yr']].forEach(function (t) { var x = xs(t[0]); s += '<line x1="' + x + '" x2="' + x + '" y1="6" y2="' + (H - 22) + '" stroke="#e4dfd4"/><text x="' + x + '" y="' + (H - 6) + '" fill="#6b6457" font-size="12" text-anchor="middle">' + t[1] + '</text>'; });
  rows.forEach(function (r, i) {
    var cy = 16 + i * 24, d = r.d;
    s += '<text x="' + (x0 - 10) + '" y="' + (cy + 4) + '" fill="#3a4250" font-size="' + FS + '" text-anchor="end">' + esc(d.name.length > 28 ? d.name.slice(0, 27) + '…' : d.name) + '</text>';
    if (r.obs == null) s += '<text x="' + (W - 30) + '" y="' + (cy + 4) + '" fill="#6346c9" font-size="11" text-anchor="end">' + (r.scanned ? 'not observed' : 'not scanned') + '</text>';
    else if (r.obs > 0) {
      if (r.decl != null && r.decl > 0 && r.obs > r.decl) s += '<line x1="' + xs(r.decl) + '" x2="' + xs(r.obs) + '" y1="' + cy + '" y2="' + cy + '" stroke="#b3400b" stroke-width="3" stroke-opacity=".45"/>';
      var col = r.viol ? '#b3400b' : '#3a4250';
      s += r.ttl ? '<circle cx="' + xs(r.obs) + '" cy="' + cy + '" r="5" fill="' + col + '"/>' : '<circle cx="' + xs(r.obs) + '" cy="' + cy + '" r="5.5" fill="#fffdf9" stroke="' + col + '" stroke-width="1.6" stroke-dasharray="2 2"/><circle cx="' + xs(r.obs) + '" cy="' + cy + '" r="2.4" fill="' + col + '"/>';
    }
    if (r.req != null && r.req > 0) s += '<line x1="' + xs(r.req) + '" x2="' + xs(r.req) + '" y1="' + (cy - 9) + '" y2="' + (cy + 9) + '" stroke="#0b7d60" stroke-width="2.5"/>';
    if (r.decl != null && r.decl > 0) s += '<rect x="' + (xs(r.decl) - 4.5) + '" y="' + (cy - 4.5) + '" width="9" height="9" fill="none" stroke="#1f6ac0" stroke-width="1.6" transform="rotate(45 ' + xs(r.decl) + ' ' + cy + ')"/>';
  });
  return s + '</svg>';
}
V['privacy/retention'] = { title: 'Retention', render: function () {
  var rows = retentionRows(), n = rows.length;
  var viol = rows.filter(function (r) { return r.viol; }), none = rows.filter(function (r) { return r.decl == null; }), noTtl = rows.filter(function (r) { return !r.ttl && r.decl !== 0; }), notSc = rows.filter(function (r) { return !r.scanned; }), over = rows.filter(function (r) { return r.v.some(function (x) { return x[0] === 'Declared longer than needed'; }); });
  var scan = P.controlTest('c_retention_scan');
  var retFind = NS.findings.filter(function (f) { return P.isOpenFinding(f) && /RETENTION|TTL|LONG-LIVED|OUTLIVES/.test(f.kind); });
  var prom = uniq([].concat.apply([], viol.map(function (r) { return P.promisesFor(r.d.id).map(function (p) { return p.id; }); })));
  var head = P.pageHead('Operate · retention', 'Declared, observed, required', 'Three numbers per dataset: what the business needs (required), what the catalog says (declared), and the oldest record the scanner actually finds (observed). Every extra day is another day for breach, subpoena and misuse.');
  var ans = answer('Is anything kept longer than we declared, or than we need?', (viol.length ? '<b class="bad">Yes.</b> ' : '<b class="ok">No.</b> ') +
    '<b>' + viol.length + ' of ' + n + '</b> datasets hold records older than declared; ' + over.length + ' declare longer than they need; ' + none.length + ' declare nothing; ' + noTtl.length + ' have no TTL enforcing the declaration. ' +
    'The scanner cannot see ' + notSc.length + ' of ' + n + ' datasets ' + unk('their retention is unknown') + '. Last scan ' + P.freshTag(scan.last, 'Retention scan') + '.');
  var tbl = '<table class="tbl op-ret" id="opRetTable"><caption class="sr-only">Retention per dataset</caption><thead><tr><th scope="col">Dataset</th><th scope="col" class="num">Required</th><th scope="col" class="num">Declared</th><th scope="col" class="num">Observed oldest</th><th scope="col">TTL</th><th scope="col">Legal hold</th><th scope="col">Verdict</th></tr></thead><tbody>' +
    rows.slice().sort(function (a, b) { return (b.viol - a.viol) || (b.v.length - a.v.length); }).map(function (r) {
      return '<tr data-ds="' + esc(r.d.id) + '"' + (r.viol ? ' data-viol="1"' : '') + '><th scope="row">' + chip(r.d.id) + '<div class="small dim">' + esc(r.d.class || 'unclassified') + '</div></th>' +
        '<td class="num">' + daysTxt(r.req) + '</td><td class="num">' + daysTxt(r.decl) + '</td><td class="num ' + (r.viol ? 'bad' : '') + '">' + daysTxt(r.obs, 'obs') + '</td>' +
        '<td class="small">' + (r.ttl ? '<span class="ok">enforced</span>' : '<span class="warn">none</span>') + '</td>' +
        '<td class="small">' + (r.holds.length ? r.holds.map(function (h) { return esc(h.id); }).join(', ') : '<span class="dim">—</span>') + '</td>' +
        '<td class="small">' + (r.v.length ? r.v.map(function (x) { return x[1] === 'unk' ? unk(x[0]) : '<span class="' + x[1] + '">' + esc(x[0]) + '</span>'; }).join('<br>') : '<span class="ok">within declaration</span>') + '</td></tr>';
    }).join('') + '</tbody></table>';
  var chartRows = rows.slice().sort(function (a, b) { return (b.viol - a.viol) || String(a.d.class).localeCompare(String(b.d.class)); });
  var main = '<section class="card op-sec" aria-labelledby="op-ret"><div class="card-h"><h2 class="sec" id="op-ret">Every dataset</h2><span class="sub">log scale</span></div>' +
    '<div class="legend" aria-hidden="true"><span><i style="background:#0b7d60;height:10px;width:3px"></i>required</span><span><i class="op-lg-diamond"></i>declared</span><span><i class="op-lg-obs"></i>observed oldest record</span><span><i style="background:#b3400b;opacity:.45"></i>kept past the declaration</span><span><i class="op-lg-nottl"></i>no TTL (dashed)</span></div>' +
    '<div class="pv-scroll op-fig" tabindex="0" role="region" aria-label="Retention chart (scrolls sideways)">' + retentionChart(chartRows) + '</div>' +
    '<details class="op-more" open><summary>Table: required, declared, observed, TTL and holds</summary>' + wrap('Retention table', tbl) + '</details>' +
    P.cite(viol.map(function (r) { return r.d.id; }).concat(['c_retention_scan', 'c_ttl_wh']), 'Records') + '</section>';
  var holds = '<section class="card op-sec" aria-labelledby="op-holds"><h2 class="sec" id="op-holds">Legal holds</h2><p class="small dim">A hold suspends deletion and retention limits for a stated scope. Orientation, not legal advice.</p>' +
    wrap('Legal holds', '<table class="tbl"><thead><tr><th scope="col">Hold</th><th scope="col">Dataset</th><th scope="col">Scope</th><th scope="col">Basis</th><th scope="col">Since</th><th scope="col">Review</th><th scope="col">Owner</th></tr></thead><tbody>' + NS.legalHolds.map(function (h) { return '<tr><td class="mono small">' + esc(h.id) + '</td><td>' + chip(h.dataset) + '</td><td class="small">' + esc(h.scope) + '</td><td class="small">' + esc(h.basis) + '</td><td>' + when(h.since) + '</td><td>' + when(h.review) + '</td><td>' + P.ownerHTML(h.owner) + '</td></tr>'; }).join('') + '</tbody></table>') +
    P.cite(NS.legalHolds.map(function (h) { return h.dataset; }), 'Records') + '</section>';
  var finds = '<section class="card op-sec" aria-labelledby="op-rf"><h2 class="sec" id="op-rf">Retention findings and the promises they break</h2>' +
    (retFind.length ? '<ul class="op-list">' + retFind.map(function (f) { return '<li>' + P.sev(f.sev) + ' ' + chip(f.id) + ' <span class="small dim">owner</span> ' + P.ownerHTML(f.owner) + (f.due ? ' <span class="small dim">due ' + esc(P.hdate(f.due)) + '</span>' : '') + '</li>'; }).join('') + '</ul>' : '<p class="small ok">No open retention findings.</p>') +
    '<p>Promises that datasets kept past their declaration bear on: ' + prom.map(function (p) { return chip(p, p) + ' ' + P.statusTag(P.promiseState(P.get(p).obj).status); }).join(' · ') + '</p>' +
    P.cite(retFind.map(function (f) { return f.id; }).concat(prom), 'Records') + '</section>';
  return head + promiseBar('PR-DELETE') + ans + main + holds + finds;
} };

/* ════════════ INDIVIDUAL RIGHTS ════════════ */
function kindOf(type) { for (var i = 0; i < NS.rightKinds.length; i++) if (NS.rightKinds[i].types.indexOf(type) >= 0) return NS.rightKinds[i]; return null; }
function deadlineFor(region, type) { var rs = NS.rightsDeadlines; for (var i = 0; i < rs.length; i++) if (rs[i].region === region && (rs[i].rights === '*' || rs[i].rights.indexOf(type) >= 0)) return rs[i]; return null; }
function addDays(iso, n) { var d = new Date(ms(iso.slice(0, 10))); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
function daysBetween(a, b) { return Math.round((ms(b.slice(0, 10)) - ms(a.slice(0, 10))) / 864e5); }
/* SLA state of one request against its own jurisdiction's deadline. */
function sla(x) {
  var dl = deadlineFor(x.region, x.type);
  if (!dl) return { dl: null, state: 'unknown', text: 'no deadline rule', due: null };
  var due = addDays(x.received, dl.days);
  if (x.status === 'refused') return { dl: dl, due: due, state: 'closed', text: 'refused — identity not verified' };
  if (x.status === 'complete') { var took = x.took != null ? x.took : daysBetween(x.received, x.completed); return { dl: dl, due: due, took: took, state: took <= dl.days ? 'met' : 'missed', text: (took <= dl.days ? 'met' : 'missed') + ' — ' + took + ' of ' + dl.days + ' days' }; }
  var left = P.daysUntil(due);
  return { dl: dl, due: due, left: left, state: left < 0 ? 'overdue' : left <= 7 ? 'soon' : 'on track', text: left < 0 ? 'overdue by ' + pl(-left, 'day') : pl(left, 'day') + ' left' };
}
function slaHTML(s) { var cls = { met: 'ok', 'on track': 'ok', soon: 'warn', missed: 'bad', overdue: 'bad', closed: 'dim', unknown: 'unknown' }[s.state]; return s.state === 'unknown' ? unk(s.text) : '<span class="' + cls + '">' + esc(s.text) + '</span>'; }
function reachFor(kind) {
  if (kind === 'DELETE') return NS.deletionTargets.map(function (t) { return [t[0], t[3] === 'verified' ? 'reached' : t[3] === 'failed' ? 'missed' : 'unverified', t[1] + ' — ' + t[2]]; });
  return NS.rightsReach[kind] || [];
}
function danaReach(r) {
  if (Array.isArray(r.reach)) return r.reach;
  if (r.reach === 'fleet') return reachFor(kindOf(r.type).id);
  if (r.reach === 'consent') { var R = danaRows(); return R.rows.map(function (x) { var s = rowState(x, R.now); return [x.ent, s === 'has' ? 'reached' : s === 'never' ? 'missed' : 'unverified', x.name + (s === 'old' ? ' — arrives ' + P.hdate(secsAfter(R.D.at, x.arrive)) : '')]; })
    .concat(CP.dana.vendors.map(function (v) { return [v.v, v.ack ? 'reached' : v.channel ? 'unverified' : 'missed', v.channel || 'no channel']; })); }
  if (r.reach === 'deletion') return traceRows().map(function (x) { return [x.id, x.outcome === 'held' ? 'held' : x.outcome, x.where]; });
  return [];
}
function reachCounts(list) { var c = { reached: 0, missed: 0, unverified: 0, held: 0 }; list.forEach(function (x) { c[x[1]] = (c[x[1]] || 0) + 1; }); return c; }
function reachList(list) {
  var g = { missed: [], unverified: [], held: [], reached: [] };
  list.forEach(function (x) { g[x[1]].push(x); });
  return ['missed', 'unverified', 'held', 'reached'].filter(function (k) { return g[k].length; }).map(function (k) {
    return '<div class="op-reach-g"><h5>' + (k === 'unverified' ? unk('UNVERIFIED') : '<span class="op-o op-o-' + k + '">' + esc(OUT_TXT[k]) + '</span>') + ' <span class="dim">(' + g[k].length + ')</span></h5><ul>' + g[k].map(function (x) { return '<li>' + chip(x[0]) + ' <span class="small dim">' + esc(x[2]) + '</span></li>'; }).join('') + '</ul></div>';
  }).join('');
}
V['privacy/rights'] = { title: 'Individual rights', render: function () {
  var RR = NS.rightsRequests.concat(NS.danaRequests.map(function (d) { var o = {}; for (var k in d) o[k] = d[k]; o.dana = true; return o; }));
  var S = RR.map(function (x) { return { x: x, s: sla(x), k: kindOf(x.type) }; });
  var open = S.filter(function (r) { return r.x.status === 'open'; }), overdue = S.filter(function (r) { return r.s.state === 'overdue'; }), missed = S.filter(function (r) { return r.s.state === 'missed'; });
  var unver = S.filter(function (r) { return r.x.status === 'complete' && !r.x.verified; });
  var head = P.pageHead('Operate · individual rights', 'Where does a rights request actually reach?', 'Access, correction, deletion, portability, restriction, objection and appeal of automated decisions. Each is a system requirement: a request is only as complete as the systems, vendors and models it reaches — and we can prove it reached.');
  var reachAll = NS.rightKinds.map(function (k) { return reachCounts(reachFor(k.id)); });
  var missAny = reachAll.reduce(function (s, c) { return s + c.missed; }, 0), unvAny = reachAll.reduce(function (s, c) { return s + c.unverified; }, 0);
  var ans = answer('When someone exercises a right, does the request reach everywhere their data is — in time?', '<b class="bad">Not yet.</b> Across the seven rights, requests miss <b>' + missAny + '</b> system, vendor or model paths and cannot verify <b>' + unvAny + '</b> more. ' +
    '<b>' + overdue.length + ' of ' + open.length + '</b> open requests are past their own deadline; ' + missed.length + ' completed late; ' + unver.length + ' were closed without proof that the data was reached.');
  var promises = '<p class="op-proms">Promises at stake: ' + ['PR-DELETE', 'PR-OPTOUT'].map(function (p) { return chip(p, p) + ' ' + P.statusTag(P.promiseState(P.get(p).obj).status); }).join(' · ') + ' · decisions ' + chip('D-107', 'D-107') + ' ' + chip('D-104', 'D-104') + '</p>';

  var mtx = '<table class="tbl op-reach" id="opReach"><caption class="sr-only">Reach of each right</caption><thead><tr><th scope="col">Right</th><th scope="col" class="num">Requests</th><th scope="col" class="num">Open</th><th scope="col" class="num">Reached</th><th scope="col" class="num">Missed</th><th scope="col" class="num">Unverified</th><th scope="col">SLA</th><th scope="col">Owner</th></tr></thead><tbody>' +
    NS.rightKinds.map(function (k, i) {
      var reqs = S.filter(function (r) { return r.k === k; }), c = reachAll[i], od = reqs.filter(function (r) { return r.s.state === 'overdue'; }).length, late = reqs.filter(function (r) { return r.s.state === 'missed'; }).length;
      return '<tr data-right="' + esc(k.id) + '"><th scope="row">' + esc(k.label) + '<div class="small dim">' + esc(k.types.join(' · ')) + '</div></th><td class="num">' + reqs.length + '</td><td class="num">' + reqs.filter(function (r) { return r.x.status === 'open'; }).length + '</td>' +
        '<td class="num ok">' + c.reached + '</td><td class="num ' + (c.missed ? 'bad' : '') + '">' + c.missed + '</td><td class="num">' + (c.unverified ? unk(String(c.unverified)) : '0') + '</td>' +
        '<td class="small">' + (reqs.length ? (od ? '<span class="bad">' + od + ' overdue</span>' : '<span class="ok">none overdue</span>') + (late ? ' · <span class="bad">' + late + ' late</span>' : '') : unk('no requests yet')) + '</td><td>' + P.ownerHTML(k.owner) + '</td></tr>';
    }).join('') + '</tbody></table>';
  var matrix = '<section class="card op-sec" aria-labelledby="op-rr"><div class="card-h"><h2 class="sec" id="op-rr">Seven rights, and where each one reaches</h2><span class="sub">reach = the systems, vendors and models the request is wired to today</span></div>' + wrap('Reach of each right', mtx) +
    NS.rightKinds.map(function (k) { return '<details class="op-more op-rk" data-right="' + esc(k.id) + '"><summary>' + esc(k.label) + ': reached, missed and unverified</summary><div class="op-reach-l">' + reachList(reachFor(k.id)) + '</div></details>'; }).join('') +
    '<p class="small dim">Deletion reach comes from the ' + NS.deletionTargets.length + ' registered deletion targets; the others from each right’s pipeline wiring. Unverified means the request was sent but nothing proves it arrived.</p>' +
    P.cite(uniq([].concat.apply([], NS.rightKinds.map(function (k) { return reachFor(k.id).map(function (x) { return x[0]; }); }))), 'Records') + '</section>';

  var dana = '<section class="card op-sec" aria-labelledby="op-dr"><div class="card-h"><h2 class="sec" id="op-dr">Dana’s requests</h2><span class="sub">' + chip('u_dana') + ' · region ' + esc(NS.danaRequests[0].region) + '</span></div><div class="op-dreq">' +
    NS.danaRequests.map(function (d) {
      var s = sla(d), k = kindOf(d.type), list = danaReach(d), c = reachCounts(list);
      var extra = d.type === 'OPT OUT' && P.get('PR-OPTOUT').obj.sla ? '<p class="small">The law allows ' + pl(s.dl.days, 'day') + '; Northstar promised ' + P.fmtSecs(P.get('PR-OPTOUT').obj.sla.hours * 3600) + '. <a href="#/privacy/consent">Replay it →</a></p>' : d.type === 'DELETE' ? '<p class="small"><a href="#/privacy/deletion">Every location, with evidence →</a></p>' : '';
      return '<article class="op-req" data-req="' + esc(d.id) + '"><header><span class="mono small">' + esc(d.id) + '</span> <b>' + esc(k.label) + '</b> ' + slaHTML(s) + '</header><p class="small">' + esc(d.what) + '</p>' +
        '<dl class="op-rf"><div><dt>Received</dt><dd>' + when(d.received) + '</dd></div><div><dt>Deadline</dt><dd>' + (s.dl ? esc(P.hdate(s.due)) + ' <span class="small dim">(' + s.dl.days + ' d, ' + esc(d.region) + ')</span>' : unk('no rule')) + '</dd></div>' +
        '<div><dt>Status</dt><dd>' + esc(d.status) + (d.completed ? ' ' + esc(P.hdate(d.completed)) : '') + (d.status === 'complete' ? (d.verified ? ' · <span class="ok">verified</span>' : ' · ' + unk('not verified')) : '') + '</dd></div>' +
        '<div><dt>Reach</dt><dd><span class="ok">' + c.reached + ' reached</span> · <span class="bad">' + c.missed + ' missed</span> · ' + unk(c.unverified + ' unverified') + (c.held ? ' · ' + c.held + ' held' : '') + '</dd></div></dl>' + extra +
        '<details class="op-more"><summary>Systems, vendors and models</summary><div class="op-reach-l">' + reachList(list) + '</div></details></article>';
    }).join('') + '</div>' + P.cite(['u_dana', 'PR-OPTOUT', 'PR-DELETE', 'mdl_fraud'], 'Records') + '</section>';

  /* one sample request per right (the oldest open one, else the latest), plus the queue */
  var samples = NS.rightKinds.map(function (k) {
    var mine = S.filter(function (r) { return r.k === k && !r.x.dana; });
    if (!mine.length) mine = S.filter(function (r) { return r.k === k; });
    var o = mine.filter(function (r) { return r.x.status === 'open'; }).sort(function (a, b) { return a.x.received < b.x.received ? -1 : 1; });
    return o[0] || mine.sort(function (a, b) { return a.x.received < b.x.received ? 1 : -1; })[0] || null;
  });
  var sampleT = '<table class="tbl"><caption class="sr-only">A sample request for each right</caption><thead><tr><th scope="col">Right</th><th scope="col">Request</th><th scope="col">Region</th><th scope="col">Received</th><th scope="col">Deadline</th><th scope="col">SLA</th><th scope="col">Reach (wired)</th></tr></thead><tbody>' +
    NS.rightKinds.map(function (k, i) {
      var r = samples[i], c = reachAll[i];
      if (!r) return '<tr><th scope="row">' + esc(k.label) + '</th><td colspan="6">' + unk('no request of this type on record — the path is untested by real requests') + '</td></tr>';
      return '<tr><th scope="row">' + esc(k.label) + '</th><td class="mono small nowrap">' + esc(r.x.id) + (r.x.dana ? ' <span class="tag">Dana</span>' : '') + '</td><td class="mono small nowrap">' + esc(r.x.region) + '</td><td>' + when(r.x.received) + '</td><td>' + (r.s.dl ? esc(P.hdate(r.s.due)) + ' <span class="small dim">(' + r.s.dl.days + ' d)</span>' : unk('none')) + '</td><td>' + slaHTML(r.s) + '</td><td class="small"><span class="ok">' + c.reached + '</span> / <span class="bad">' + c.missed + '</span> / ' + unk(String(c.unverified)) + '</td></tr>';
    }).join('') + '</tbody></table>';
  var sorted = S.slice().sort(function (a, b) { var o = { overdue: 0, soon: 1, 'on track': 2, missed: 3, met: 4, closed: 5, unknown: 6 }; return o[a.s.state] - o[b.s.state] || (a.x.received < b.x.received ? -1 : 1); });
  var queue = '<table class="tbl"><caption class="sr-only">Every rights request</caption><thead><tr><th scope="col">Request</th><th scope="col">Right</th><th scope="col">Region</th><th scope="col">Identity</th><th scope="col">Received</th><th scope="col">Due</th><th scope="col">SLA</th><th scope="col">Proof</th><th scope="col">Delayed by</th></tr></thead><tbody>' +
    sorted.map(function (r) { var x = r.x; return '<tr><td class="mono small nowrap">' + esc(x.id) + (x.dana ? ' <span class="tag">Dana</span>' : '') + '</td><td class="small">' + esc(r.k ? r.k.label : x.type) + '</td><td class="mono small">' + esc(x.region) + '</td><td class="small ' + (x.idv === 'failed' ? 'bad' : 'dim') + '">' + esc(x.idv || '—') + '</td><td class="nowrap">' + esc(P.hdate(x.received)) + '</td><td class="nowrap">' + (r.s.due ? esc(P.hdate(r.s.due)) : unk('none')) + '</td><td>' + slaHTML(r.s) + '</td><td class="small">' + (x.status === 'complete' ? (x.verified ? '<span class="ok">verified</span>' : unk('not verified')) : '<span class="dim">—</span>') + '</td><td>' + (x.delay ? chip(x.delay) : '<span class="dim">—</span>') + '</td></tr>'; }).join('') + '</tbody></table>';
  var ops = '<section class="card op-sec" aria-labelledby="op-rs"><h2 class="sec" id="op-rs">Sample requests and deadlines</h2>' + wrap('Sample request per right', sampleT) +
    '<h3 class="op-h3">Deadlines by jurisdiction <span class="small dim">(simplified — orientation, not legal advice)</span></h3>' +
    wrap('Deadlines by jurisdiction', '<table class="tbl"><thead><tr><th scope="col">Region</th><th scope="col">Rights</th><th scope="col" class="num">Deadline</th><th scope="col" class="num">Extension</th><th scope="col">Identity check</th><th scope="col">Basis</th></tr></thead><tbody>' + NS.rightsDeadlines.map(function (d) { return '<tr><td class="mono small">' + esc(d.region) + '</td><td class="small">' + (d.rights === '*' ? 'all others' : esc(d.rights.join(', '))) + '</td><td class="num">' + d.days + ' d</td><td class="num">' + (d.ext ? '+' + d.ext + ' d' : '—') + '</td><td class="small">' + (d.verify ? 'required' : 'not required') + '</td><td class="small">' + esc(d.basis) + '</td></tr>'; }).join('') + '</tbody></table>') +
    '<details class="op-more"><summary>Every request (' + S.length + '), overdue first</summary>' + wrap('Every rights request', queue) + '</details></section>';
  return head + promises + ans + matrix + dana + ops;
} };

/* ════════════ OBSERVABILITY ════════════ */
function hist(key, cur) { return (NS.obsHistory[key] || []).concat([cur]); }
function fromIndicator(id, extra) {
  var x = P.indicator(id); if (!x) return null;
  var o = { id: id, label: x.label, value: x.value, display: String(x.value), denom: x.denom, denomText: x.denom != null ? 'of ' + x.denom : null, target: x.target, targetText: x.target == null ? null : x.target === 0 ? '0' : (x.dir === 'up' ? '≥ ' : '≤ ') + x.target,
    onTarget: x.target == null ? null : x.onTarget, history: x.history, dir: x.dir, coverage: x.coverage, owner: x.owner, rule: x.rule, records: x.items.map(function (i) { return i.id; }), route: x.route };
  for (var k in extra) o[k] = extra[k];
  return o;
}
P.opSignals = function () {
  var S = consentStats(), out = [];
  var probedCov = { v: S.probed.length / NS.consentConsumers.length, of: 'consent consumers watched by probe revocations' };
  out.push({ id: 'e2e', promise: 'PR-OPTOUT', label: 'Consent propagation, end-to-end P99', value: S.p99, display: P.fmtSecs(S.p99), denom: S.done.length, denomText: 'over ' + pl(S.done.length, 'probe revocation'),
    target: S.targetS, targetText: S.targetS != null ? '≤ ' + P.fmtSecs(S.targetS) + ' (the promise)' : null, onTarget: S.targetS == null || S.p99 == null ? null : S.p99 <= S.targetS,
    history: hist('e2eP99', S.p99), dir: 'down', fmt: P.fmtSecs, coverage: probedCov, owner: NS.obsMeta.e2eP99.owner, fresh: S.lastProbe.slice(0, 10),
    records: uniq(S.done.map(function (x) { return x.slowest; })).concat(['c_consent_read']), route: 'privacy/consent',
    rule: 'Nearest-rank 99th percentile of end-to-end latency over completed probe revocations; end-to-end = until the last probed consumer that propagates applies the “no”. In-flight probes are excluded. P50 ' + P.fmtSecs(S.p50) + ', P95 ' + P.fmtSecs(S.p95) + '.' });
  out.push(fromIndicator('consentfail', { id: 'stale', promise: 'PR-OPTOUT', label: 'Stale consent consumers', fresh: P.controlTest('c_consent_read').last,
    rule: 'Consumers that never receive a revocation (no latency at all) — they act on an old answer indefinitely. Per-consumer P50/P95/P99 are on the Consent page.' }));
  var ackRatio = S.acks.sent ? S.acks.acked / S.acks.sent : null;
  var withDep = NS.vendors.filter(function (v) { return v.consentDep; }), measured = uniq(S.probes.reduce(function (a, p) { return a.concat(Object.keys(p.vendors)); }, []));
  out.push({ id: 'vack', promise: 'PR-OPTOUT', label: 'Vendor acknowledgements of revocations', value: ackRatio, display: S.acks.acked + ' of ' + S.acks.sent, denom: S.acks.sent, denomText: 'revocations sent to vendors by probes',
    target: 1, targetText: 'every revocation acknowledged', onTarget: ackRatio == null ? null : ackRatio === 1, history: hist('vendorAck', ackRatio), dir: 'up', fmt: function (v) { return Math.round(v * 100) + '%'; },
    coverage: { v: measured.length / withDep.length, of: 'vendors whose processing depends on consent' }, owner: NS.obsMeta.vendorAck.owner, fresh: S.acks.last ? S.acks.last.slice(0, 10) : null,
    records: measured.concat(withDep.map(function (v) { return v.id; })), route: 'privacy/consent',
    rule: 'Probe revocations sent to each vendor, and how many the vendor acknowledged. Vendors with no channel are never sent one and appear only in coverage.' });
  out.push(fromIndicator('delfail', { id: 'delfail', promise: 'PR-DELETE', fresh: P.controlTest('c_delete_verify').last, route: 'privacy/deletion',
    rule: 'Deletion targets whose last result is failed or unknown. Vendor targets still waiting for confirmation are not counted here; they show as unverified on the Deletion page.' }));
  var cans = NS.deletionCanaries, last = cans[cans.length - 1];
  out.push({ id: 'surv', promise: 'PR-DELETE', label: 'Surviving copies after deletion (canary, T+72h)', value: last.found.length, display: String(last.found.length), denom: last.checkedN, denomText: 'of ' + last.checkedN + ' locations checked',
    target: 0, targetText: '0', onTarget: last.found.length === 0, history: hist('surviving', last.found.length), dir: 'down', coverage: NS.obsMeta.surviving.coverage, owner: NS.obsMeta.surviving.owner, fresh: last.checked.slice(0, 10),
    records: last.found.concat(['c_delete_verify']), route: 'privacy/deletion', rule: 'Canary identities are deleted, then every registered deletion target is re-queried at T+72h; each location where the canary is still found counts once. Copies outside the registry are not checked.' });
  out.push(fromIndicator('retviol', { id: 'retviol', promise: 'PR-LOC', also: ['PR-LOGS', 'PR-AI'], fresh: P.controlTest('c_retention_scan').last, route: 'privacy/retention' }));
  var joins = NS.idJoins.filter(function (j) { return !j[4]; }), jd = NS.drift.filter(function (d) { return d.type === 'new join'; }).map(function (d) { return d.t.slice(0, 10); }).sort().pop();
  out.push({ id: 'joins', promise: 'PR-HEALTH', also: ['PR-SEC'], label: 'Unauthorised identity joins', value: joins.length, display: String(joins.length), denom: NS.idJoins.length, denomText: 'of ' + NS.idJoins.length + ' observed joins',
    target: 0, targetText: '0', onTarget: joins.length === 0, history: hist('joins', joins.length), dir: 'down', coverage: NS.obsMeta.joins.coverage, owner: NS.obsMeta.joins.owner, fresh: jd,
    records: uniq(joins.map(function (j) { return j[2]; }).concat(joins.map(function (j) { return j[0]; }))).concat(['c_id_scope']), route: 'explore/identities',
    rule: 'Identifier joins observed in lineage or logs that no review sanctioned (for example Pulse ID × advertising ID).' });
  var PR = NS.purposeReads, mism = NS.accessEvents.filter(function (e) { return e.flag === 'purpose mismatch'; });
  out.push({ id: 'denied', promise: 'PR-HEALTH', also: ['PR-SEC'], label: 'Purpose-denied reads (and mismatches let through)', value: PR.denied.length, display: String(PR.denied.length), denom: PR.checked, denomText: 'of ' + fmtN(PR.checked) + ' reads checked in ' + PR.window + ' days',
    target: 0, targetText: '0 mismatched reads allowed (' + mism.length + ' allowed outside the check)', onTarget: mism.length === 0, history: hist('denied', PR.denied.length), dir: 'down',
    coverage: NS.obsMeta.denied.coverage, owner: NS.obsMeta.denied.owner, fresh: PR.denied.map(function (d) { return d.t.slice(0, 10); }).sort().pop(),
    records: uniq(PR.denied.map(function (d) { return d.dataset; }).concat(mism.map(function (e) { return e.data; }))).concat(['c_purpose_runtime', 'c_purpose_fs']), route: 'privacy/purpose',
    rule: 'Reads the runtime purpose check refused because the declared purpose did not match the collection purpose. A denial is the control working; a mismatch outside the check’s scope is the finding.' });
  var win = NS.accessEvents.filter(function (e) { return P.daysSince(e.t.slice(0, 10)) <= 7; }), openA = win.filter(function (e) { return NS.accessTriage[e.t] !== 'triaged'; });
  out.push({ id: 'anom', promise: null, label: 'Access anomalies awaiting triage', value: openA.length, display: String(openA.length), denom: win.length, denomText: 'of ' + win.length + ' anomalies in the last 7 days',
    target: 0, targetText: '0 untriaged', onTarget: openA.length === 0, history: hist('anomalies', openA.length), dir: 'down', coverage: NS.obsMeta.anomalies.coverage, owner: NS.obsMeta.anomalies.owner,
    fresh: win.map(function (e) { return e.t.slice(0, 10); }).sort().pop(), records: uniq(openA.map(function (e) { return e.data; })).concat(['c_access_audit']), route: 'assurance/access',
    rule: 'Access events flagged by sensitive-query monitoring (bulk exports, inactive accounts, unexpected joins, break-glass) not yet triaged.' });
  var tests = NS.controls.map(function (c) { return P.controlTest(c.id); }), weak = tests.filter(function (t) { return t.weak; }), fresh = tests.filter(function (t) { return t.fresh.state === 'fresh'; });
  var newest = tests.map(function (t) { return t.last; }).filter(Boolean).sort().pop();
  out.push({ id: 'weak', promise: null, label: 'Controls failing, stale or never tested', value: weak.length, display: String(weak.length), denom: tests.length, denomText: 'of ' + tests.length + ' controls',
    target: 0, targetText: '0', onTarget: weak.length === 0, history: hist('weakCtl', weak.length), dir: 'down', coverage: NS.obsMeta.weakCtl.coverage, owner: NS.obsMeta.weakCtl.owner, fresh: newest,
    records: weak.map(function (t) { return t.control.id; }), route: 'assurance/controls', rule: 'Controls whose last test failed, is older than 30 days, or never ran.' });
  var fr = fresh.length / tests.length;
  out.push({ id: 'fresh', promise: null, label: 'Evidence freshness', value: fr, display: fresh.length + ' of ' + tests.length, denom: tests.length, denomText: 'controls with evidence 7 days old or newer',
    target: 1, targetText: 'every control', onTarget: fr === 1, history: hist('freshEv', fr), dir: 'up', fmt: function (v) { return Math.round(v * 100) + '%'; }, coverage: NS.obsMeta.freshEv.coverage, owner: NS.obsMeta.freshEv.owner, fresh: newest,
    records: tests.filter(function (t) { return t.fresh.state !== 'fresh'; }).map(function (t) { return t.control.id; }), route: 'assurance/controls', rule: 'Share of controls whose last test is 7 days old or newer (fresh). Aging is 8–30 days, stale beyond 30, never = no test.' });
  return out.filter(Boolean);
};
function trendText(s) {
  var h = s.history; if (!h || h.length < 2 || h[h.length - 1] == null || h[h.length - 2] == null) return null;
  var d = h[h.length - 1] - h[h.length - 2]; if (Math.abs(d) < 1e-9) return { t: 'no change vs last week', better: null };
  var f = s.fmt || function (v) { return String(Math.round(v * 100) / 100); };
  var better = s.dir === 'up' ? d > 0 : d < 0;
  return { t: (d > 0 ? '▲ ' : '▼ ') + (s.fmt ? f(Math.abs(d)) : Math.abs(Math.round(d * 100) / 100)) + ' vs last week', better: better };
}
function signalHTML(s) {
  var st = s.onTarget === true ? ['on', 'On target'] : s.onTarget === false ? ['off', 'Off target'] : ['unk', 'Unknown'];
  var tr = trendText(s), f = s.fmt || function (v) { return v == null ? '—' : String(v); };
  var fresh = s.fresh ? P.freshTag(s.fresh, 'Latest evidence') + ' <span class="small dim">' + esc(P.hdate(s.fresh)) + '</span>' : unk('no evidence date');
  return '<article class="op-sig op-sig-' + st[0] + '" data-signal="' + esc(s.id) + '" aria-labelledby="sig-' + esc(s.id) + '">' +
    '<header><h3 id="sig-' + esc(s.id) + '">' + esc(s.label) + '</h3><span class="op-sst op-sst-' + st[0] + '">' + (st[0] === 'unk' ? unk(st[1]) : esc(st[1])) + '</span></header>' +
    '<p class="op-sv2"><b>' + (s.value == null ? unk('UNKNOWN') : esc(s.display)) + '</b> <span class="small dim">' + esc(s.denomText || '') + '</span></p>' +
    '<dl class="op-sf">' +
      '<div><dt>Denominator</dt><dd>' + (s.denom != null ? esc(typeof s.denom === 'number' ? fmtN(s.denom) : s.denom) : unk('none')) + '</dd></div>' +
      '<div><dt>Target</dt><dd>' + (s.targetText != null ? esc(s.targetText) : unk('none set')) + '</dd></div>' +
      '<div><dt>Trend</dt><dd>' + (tr ? spark(s.history) + ' <span class="' + (tr.better === true ? 'ok' : tr.better === false ? 'bad' : 'dim') + '">' + esc(tr.t) + '</span>' : unk('no history')) + '</dd></div>' +
      '<div><dt>Coverage</dt><dd>' + (s.coverage ? 'sees ' + Math.round(s.coverage.v * 100) + '% of ' + esc(s.coverage.of) : unk('not measured')) + '</dd></div>' +
      '<div><dt>Owner</dt><dd>' + P.ownerHTML(s.owner) + '</dd></div>' +
      '<div><dt>Freshness</dt><dd>' + fresh + '</dd></div>' +
    '</dl>' +
    '<details class="op-more"><summary>How it’s computed · weekly readings</summary><p class="small">' + esc(s.rule) + '</p>' +
      (s.history && s.history.length ? wrap('Weekly readings: ' + s.label, '<table class="tbl op-hist"><thead><tr>' + s.history.map(function (v, i) { return '<th scope="col">' + (i === s.history.length - 1 ? 'now' : '−' + (s.history.length - 1 - i) + ' wk') + '</th>'; }).join('') + '</tr></thead><tbody><tr>' + s.history.map(function (v) { return '<td class="num">' + esc(v == null ? '—' : f(v)) + '</td>'; }).join('') + '</tr></tbody></table>') : '') + '</details>' +
    P.cite(s.records, 'Records') + (s.route ? '<a class="op-open" href="#/' + esc(s.route) + '">Open the records →</a>' : '') +
  '</article>';
}
V.observability = { title: 'Observability', render: function () {
  var sigs = P.opSignals();
  var off = sigs.filter(function (s) { return s.onTarget === false; }), on = sigs.filter(function (s) { return s.onTarget === true; }), un = sigs.filter(function (s) { return s.onTarget == null; });
  var groups = [], seen = {};
  sigs.forEach(function (s) { var k = s.promise || '_all'; if (!seen[k]) { seen[k] = []; groups.push(k); } seen[k].push(s); });
  var head = P.pageHead('Operate · observability', 'Privacy observability', 'The signals that tell us a promise is breaking before a person or a regulator does. Each shows its value, what it is out of, the target, its trend, how much the detector can see, who owns it and how fresh the evidence is.');
  var ans = answer('Which signals say a promise is breaking, and can we trust them?', '<b>' + off.length + ' of ' + sigs.length + '</b> signals are off target, ' + on.length + ' on target' + (un.length ? ', ' + un.length + ' ' + unk('unknown') : '') + '. ' +
    'The weakest coverage: ' + sigs.filter(function (s) { return s.coverage; }).sort(function (a, b) { return a.coverage.v - b.coverage.v; }).slice(0, 2).map(function (s) { return esc(s.label.toLowerCase()) + ' sees ' + Math.round(s.coverage.v * 100) + '% of ' + esc(s.coverage.of); }).join('; ') + '. What a detector cannot see is not zero — it is unknown.');
  var glance = '<section class="card op-sec" aria-labelledby="op-gl"><h2 class="sec" id="op-gl">All signals at a glance</h2>' + wrap('All signals', '<table class="tbl op-glance"><caption class="sr-only">Every observability signal</caption><thead><tr><th scope="col">Signal</th><th scope="col">Promise</th><th scope="col" class="num">Value</th><th scope="col">Target</th><th scope="col">State</th><th scope="col">Owner</th><th scope="col">Evidence</th></tr></thead><tbody>' +
    sigs.map(function (s) { return '<tr><th scope="row"><button type="button" class="linklike" data-jump="sig-' + esc(s.id) + '">' + esc(s.label) + '</button></th><td>' + (s.promise ? chip(s.promise, s.promise) : '<span class="small dim">every promise</span>') + '</td><td class="num">' + (s.value == null ? unk('UNKNOWN') : esc(s.display)) + '</td><td class="small">' + (s.targetText ? esc(s.targetText) : unk('none')) + '</td><td class="small nowrap ' + (s.onTarget === true ? 'ok' : s.onTarget === false ? 'bad' : '') + '">' + (s.onTarget == null ? unk('unknown') : s.onTarget ? 'on target' : 'off target') + '</td><td>' + P.ownerHTML(s.owner) + '</td><td>' + (s.fresh ? P.freshTag(s.fresh) : unk('none')) + '</td></tr>'; }).join('') + '</tbody></table>') + '</section>';
  var body = groups.map(function (k) {
    var ss = seen[k], p = k === '_all' ? null : P.get(k).obj;
    var st = p ? P.promiseState(p) : null, also = uniq([].concat.apply([], ss.map(function (s) { return s.also || []; })));
    return '<section class="op-grp" aria-labelledby="grp-' + esc(k) + '"><header class="op-grp-h"><h2 id="grp-' + esc(k) + '">' + (p ? P.statusTag(st.status) + ' <q>' + esc(p.text) + '</q>' : 'Across every promise: can we trust the evidence?') + '</h2>' +
      (p ? '<p class="small dim">Protects ' + chip(p.id, p.id) + (p.decision ? ' · decision ' + chip(p.decision, p.decision) : '') + (also.length ? ' · also bears on ' + also.map(function (a) { return chip(a, a); }).join(' ') : '') + ' · <a href="#/promises/' + esc(p.id) + '">Open the promise →</a></p>' : '<p class="small dim">Controls, evidence and access: the ground every other signal stands on.</p>') + '</header>' +
      '<div class="op-sigs">' + ss.map(signalHTML).join('') + '</div></section>';
  }).join('');
  return head + ans + glance + body;
}, mount: function (root) {
  root.querySelectorAll('[data-jump]').forEach(function (a) { a.addEventListener('click', function (ev) { ev.preventDefault(); var t = root.querySelector('#' + a.getAttribute('data-jump')); if (t) { t.scrollIntoView({ block: 'start' }); t.setAttribute('tabindex', '-1'); t.focus({ preventScroll: true }); } }); });
} };
})();
