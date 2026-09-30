/* Privacy Command Center v1 — one privacy graph, many lenses.
 *
 * Five selectors (persona, surface, journey, question, concern), plus a subject
 * and a privacy/security lens, pick ONE view of the graph in graph.js. The
 * workspace is always the same three sections: VISUAL, FINDINGS, DECISION.
 * State lives in the URL hash (#cc?p=…&s=…&j=…&q=…&c=…&u=…&l=…&fm=1), so every
 * view is a link. Legacy v10 links (#/…) are forwarded before this script runs. */
(function () {
  'use strict';
  var G = window.PG, $ = function (s, r) { return (r || document).querySelector(s); }, $$ = function (s, r) { return [].slice.call((r || document).querySelectorAll(s)); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var RM = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var byId = function (list, id) { for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i]; return null; };
  var name = function (id) { var n = G.node(id); return n ? n.name : id; };
  var plural = function (n, w) { return n + ' ' + (n === 1 ? w : /y$/.test(w) && !/[aeiou]y$/.test(w) ? w.slice(0, -1) + 'ies' : w + 's'); };
  var SAVED_KEY = 'pcc.v1.views';

  /* ── state ─────────────────────────────────────────────── */
  var DEF = { page: 'cc', p: 'reviewer', s: 'all', j: 'signin', q: 'know', c: [], u: 'person', l: 'privacy', fm: false, ask: '', ev: 'all' };
  var S = copy(DEF);
  function copy(o) { return JSON.parse(JSON.stringify(o)); }
  function parse() {
    var h = location.hash.replace(/^#/, ''), parts = h.split('?'), page = parts[0] || 'cc', q = {};
    (parts[1] || '').split('&').forEach(function (kv) { if (!kv) return; var i = kv.indexOf('='); if (i > 0) q[decodeURIComponent(kv.slice(0, i))] = decodeURIComponent(kv.slice(i + 1)); });
    var st = copy(DEF);
    st.page = ['cc', 'reviews', 'evidence', 'ask'].indexOf(page) >= 0 ? page : 'cc';
    if (byId(G.personas, q.p)) st.p = q.p;
    if (byId(G.surfaces, q.s)) { st.s = q.s; st.j = byId(G.surfaces, q.s).j; }
    if (byId(G.journeys, q.j)) st.j = q.j;
    if (byId(G.questions, q.q)) st.q = q.q;
    if (q.c) st.c = q.c.split(',').filter(function (c) { return byId(G.concerns, c); });
    if (byId(G.subjects, q.u)) st.u = q.u;
    if (G.lenses[q.l]) st.l = q.l;
    st.fm = q.fm === '1'; st.ask = q.ask || ''; st.ev = q.ev || 'all';
    return fit(st);
  }
  /* Only what belongs to the surface is offered (G.relevance). A link or preset
   * that names something else falls back to the surface's own default. */
  function offered(list, key, s) { var r = G.relevance[s]; return r ? list.filter(function (x) { return r[key].indexOf(x.id) >= 0; }) : list; }
  function fit(st) {
    var r = G.relevance[st.s];
    if (!r) return st;
    if (r.j.indexOf(st.j) < 0) st.j = byId(G.surfaces, st.s).j;
    if (r.q.indexOf(st.q) < 0) st.q = offered(G.questions, 'q', st.s)[0].id;
    st.c = st.c.filter(function (c) { return r.c.indexOf(c) >= 0; });
    if (r.u.indexOf(st.u) < 0) st.u = r.u[0];
    return st;
  }
  function hashFor(st) {
    var q = 'p=' + st.p + '&s=' + st.s + '&j=' + st.j + '&q=' + st.q + (st.c.length ? '&c=' + st.c.join(',') : '') + '&u=' + st.u + (st.l !== 'privacy' ? '&l=' + st.l : '') + (st.fm ? '&fm=1' : '');
    if (st.page === 'ask' && st.ask) q += '&ask=' + encodeURIComponent(st.ask);
    if (st.page === 'evidence' && st.ev !== 'all') q += '&ev=' + st.ev;
    return '#' + st.page + '?' + q;
  }
  function set(patch) {
    for (var k in patch) S[k] = patch[k];
    fit(S);
    var h = hashFor(S);
    if (location.hash !== h) history.replaceState(null, '', h);
    render();
  }
  window.addEventListener('hashchange', function () { S = parse(); render(); });

  /* ── resolve the selectors to one view of the graph ─────── */
  var CTL_BY_CONCERN = { tenant: 'tenant', consent: 'consent', vendor: 'consent', deletion: 'delete', retention: 'delete', access: 'access', minimization: 'pay', agent: 'agent', inference: 'agent', purpose: 'agent', linkability: 'link', tracking: 'link', identity: 'auth', authentication: 'auth', devicetrust: 'auth', recovery: 'auth', disclosure: 'sd', ondevice: 'route', thirdmodel: 'route', logging: 'log', takeover: 'account' };
  var CTL_BY_SURFACE = { ident: 'auth', web: 'link', mail: 'mail', pay: 'pay', did: 'sd', cloud: 'tenant', analytics: 'consent', ai: 'agent', vendor: 'consent', all: 'tenant' };
  var CTL_LIST = { auth: ['c_passkey', 'c_rp_scope', 'c_attest', 'c_sync', 'c_session', 'c_recovery'], link: ['c_itp', 'c_link_strip', 'c_id_rotate', 'c_ip_mask'], mail: ['c_remote_content', 'c_relay', 'c_route', 'c_pcc_attest', 'c_no_train'], pay: ['c_tokenize', 'c_local_risk', 'c_ttl'], sd: ['c_sd', 'c_verifier_ret', 'c_issuer_blind'], route: ['c_route', 'c_pcc_attest', 'c_no_train'], agent: ['c_route', 'c_agent_policy', 'c_join_policy', 'c_agent_approval'], log: ['c_url_redact', 'c_iam', 'c_ttl'], account: ['c_passkey', 'c_cookie_enc', 'c_dbsc', 'c_ext_review', 'c_recovery'] };
  var CTL_TITLE = { auth: 'Sign-in invariant: no shared secret anywhere in the account’s life', link: 'Unlinkability: unrelated sites stay unlinked', mail: 'Mail invariant: reading a message reveals nothing, and content leaves only when needed', pay: 'Payment invariant: prove what is necessary, keep what measurably helps', sd: 'Disclosure invariant: share the attribute, not the identity', route: 'Routing invariant: run where the fewest parties can see it', agent: 'Agent invariant: act only within the task’s purpose', log: 'Logging invariant: telemetry never copies identity', account: 'Account invariant: a stolen password, code, cookie or phone number does not open her life' };
  var DEVICE_J = { signin: 1, browse: 1, mail: 1, pay: 1, age: 1, share: 1, ai: 1 };
  function agentFor(st) { return st.s === 'pay' ? 'ag_support' : 'ag_assist'; }
  function sdVariant(st) { return st.s === 'did' || st.j === 'age' || st.j === 'share' ? 'age' : (st.s === 'mail' || st.s === 'ident' || st.j === 'mail' || st.j === 'signin') ? 'relay' : 'derived'; }
  function resolve(st) {
    var q = st.q, c0 = st.c[0], v = { note: '' };
    switch (q) {
      case 'know':
        if (st.u === 'dataset') { v.kind = 'join'; v.key = 'join'; v.note = 'For one dataset, what we know is what it can be joined to.'; }
        else if (st.u === 'tenant') { v.kind = 'control'; v.ctl = 'tenant'; v.key = 'ctl-tenant'; v.note = 'For one tenant, what we know is where its rows can reach.'; }
        else if (st.u === 'agent') { v.kind = 'agent'; v.key = 'infer'; }
        else { v.kind = 'identity'; v.key = 'know'; }
        break;
      case 'whoknows':
        if (st.s === 'cloud' || st.s === 'analytics') { v.kind = 'access'; v.key = 'access'; } else { v.kind = 'observers'; v.key = 'whoknows'; }
        break;
      case 'howlearn': v.kind = 'flow'; v.key = 'whoknows'; v.learn = true; break;
      case 'prove':
        if (st.s === 'did' || st.j === 'age' || st.j === 'share') { v.kind = 'sdisc'; v.variant = 'age'; v.key = 'sd-age'; } else { v.kind = 'auth'; v.key = 'prove'; }
        break;
      case 'linkid': v.kind = 'ids'; v.key = 'linkid'; break;
      case 'where': v.kind = 'flow'; v.key = 'where'; break;
      case 'leftdevice': case 'whyleft':
        if (st.s === 'ai' || st.j === 'ai') { v.kind = 'routing'; v.key = 'routing'; }
        else if (q === 'whyleft' && !DEVICE_J[st.j]) { v.kind = 'purpose'; v.key = 'purpose'; v.note = 'This journey starts on our servers, so the question becomes why each use exists.'; }
        else { v.kind = 'boundary'; v.key = 'boundary'; v.why = q === 'whyleft'; }
        break;
      case 'provewithout': v.kind = 'sdisc'; v.variant = sdVariant(st); v.key = 'sd-' + v.variant; break;
      case 'join': v.kind = 'join'; v.key = 'join'; break;
      case 'infer': v.kind = 'agent'; v.key = 'infer'; break;
      case 'agentdo': v.kind = 'agentdo'; v.key = 'agentdo'; break;
      case 'consent': v.kind = 'consent'; v.key = 'consent'; break;
      case 'delete': v.kind = 'delete'; v.key = 'delete'; break;
      case 'live': v.kind = 'retention'; v.key = 'live'; break;
      case 'control':
        v.kind = 'control';
        v.ctl = st.u === 'tenant' ? 'tenant' : st.u === 'agent' ? 'agent' : st.u === 'credential' ? 'auth' : (c0 && CTL_BY_CONCERN[c0]) || CTL_BY_SURFACE[st.s] || 'tenant';
        v.key = v.ctl === 'consent' ? 'consent' : v.ctl === 'delete' ? 'delete' : G.decisions['ctl-' + v.ctl] ? 'ctl-' + v.ctl : { mail: 'whoknows', pay: 'sd-derived' }[v.ctl] || 'where';
        break;
      case 'stolen': v.kind = 'takeover'; v.key = 'takeover'; break;
      case 'changed': v.kind = 'changes'; v.key = 'changed'; break;
      case 'worst': v.kind = 'worst'; v.key = 'worst'; break;
    }
    if (v.kind === 'agent') v.agent = agentFor(st);
    v.principle = G.principles[G.principleFor[v.key] || (v.ctl && G.principleFor['ctl-' + v.ctl])] || '';
    return v;
  }

  /* ── shared bits ───────────────────────────────────────── */
  var KCLS = { FACT: 'k-fact', INFERENCE: 'k-inf', UNKNOWN: 'k-unk', 'CONTROL FAILURE': 'k-fail', RECOMMENDATION: 'k-rec' };
  function tag(k) { return '<span class="tag ' + (KCLS[k] || '') + '">' + esc(k) + '</span>'; }
  var ST = { ok: ['st-ok', 'Verified'], fail: ['st-fail', 'Failed'], unk: ['st-unk', 'Unknown'], warn: ['st-warn', 'Needs review'], wait: ['st-warn', 'Pending'] };
  function stTag(st, txt) { var s = ST[st] || ST.unk; return '<span class="st ' + s[0] + '">' + esc(txt || s[1]) + '</span>'; }
  function worst(states) { return states.indexOf('fail') >= 0 ? 'fail' : states.some(function (s) { return s !== 'ok'; }) ? 'unk' : 'ok'; }
  function verdict(localSt, systemSt, labels) {
    labels = labels || ['LOCAL CONTROL', 'SYSTEM CONTROL'];
    var w = function (s) { return s === 'ok' ? 'PASS' : s === 'fail' ? 'FAIL' : 'UNPROVEN'; };
    return '<div class="verdict"><div class="vd vd-' + localSt + '"><span>' + labels[0] + '</span><b>' + w(localSt) + '</b></div><div class="vd vd-' + systemSt + '"><span>' + labels[1] + '</span><b>' + w(systemSt) + '</b></div></div>';
  }
  function freshness(date) {
    if (!date) return { k: 'never', t: 'never tested' };
    var d = Math.round((Date.parse(G.asOf) - Date.parse(date)) / 864e5);
    return d <= 7 ? { k: 'fresh', t: 'tested ' + (d === 0 ? 'today' : d + 'd ago') } : d <= 30 ? { k: 'aging', t: 'tested ' + d + 'd ago' } : { k: 'stale', t: 'stale · tested ' + d + 'd ago' };
  }
  function ctlState(id) { var c = G.controls[id]; if (!c) return 'unk'; if (c.result === 'fail') return 'fail'; if (c.result === 'never') return 'unk'; return freshness(c.last).k === 'stale' ? 'warn' : 'ok'; }
  var ZONE = {}; G.zones.forEach(function (z) { ZONE[z[0]] = z[1]; });
  function journey(st) { return byId(G.journeys, st.j) || G.journeys[0]; }
  function emph(st) { var d = byId(G.surfaces, st.s); return d && d.emph ? '<div class="emph" aria-label="What this surface emphasizes">' + d.emph.map(function (e) { return '<span>' + esc(e) + '</span>'; }).join('') + '</div>' : ''; }

  /* ═══════════ VISUALS ═══════════ */
  var V = {};

  /* identity graph — separate signals, then connect the dots */
  V.identity = function (st) {
    var I = G.identity, W = 160, H = 56;
    var pos = { phone: [20, 20], behavior: [20, 130], payment: [20, 240], device: [520, 20], browser: [520, 130], login: [520, 240] };
    var mid = function (k) { return [pos[k][0] + W / 2, pos[k][1] + H / 2]; }, P = [350, 130];
    var inS = function (s) { return st.s === 'all' || s.s.indexOf(st.s) >= 0; };
    var svg = '<svg viewBox="0 0 700 300" class="idg" role="img" aria-labelledby="idgT"><title id="idgT">Six signals about one synthetic person. Connected, shared identifiers turn them into one profile.</title>';
    I.signals.forEach(function (s) { var m = mid(s.id); svg += '<line class="spoke" x1="' + m[0] + '" y1="' + m[1] + '" x2="' + P[0] + '" y2="' + P[1] + '"/>'; });
    I.links.forEach(function (l) {
      var a = mid(l[0]), b = mid(l[1]), mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, w = l[2].length * 6.6 + 14;
      svg += '<g class="lk lk-' + l[3] + '"><line x1="' + a[0] + '" y1="' + a[1] + '" x2="' + b[0] + '" y2="' + b[1] + '"/><rect x="' + (mx - w / 2) + '" y="' + (my - 10) + '" width="' + w + '" height="20" rx="4"/><text x="' + mx + '" y="' + (my + 4) + '" text-anchor="middle">' + esc(l[2]) + '</text></g>';
    });
    svg += '<g class="prof"><rect x="' + (P[0] - 88) + '" y="' + (P[1] - 26) + '" width="176" height="52" rx="10"/><text class="pk" x="' + P[0] + '" y="' + (P[1] - 5) + '" text-anchor="middle">PERSON-LEVEL PROFILE</text><text class="pn" x="' + P[0] + '" y="' + (P[1] + 15) + '" text-anchor="middle">' + esc(name('p_dana')) + '</text></g>';
    I.signals.forEach(function (s) {
      var p = pos[s.id];
      svg += '<g class="sg' + (inS(s) ? '' : ' dim') + '"><rect x="' + p[0] + '" y="' + p[1] + '" width="' + W + '" height="' + H + '" rx="10"/><text class="sl" x="' + (p[0] + 12) + '" y="' + (p[1] + 23) + '">' + esc(s.label) + '</text><text class="sk" x="' + (p[0] + 12) + '" y="' + (p[1] + 42) + '">' + esc(s.key) + '</text></g>';
    });
    svg += '</svg>';
    var cols = ['collected', 'derived', 'inferred'].map(function (k) { return '<div class="pcol"><div class="eyebrow">' + k + '</div>' + I.profile.filter(function (x) { return x[0] === k; }).map(function (x) { return '<p>' + esc(x[1]) + '</p>'; }).join('') + '</div>'; }).join('');
    return {
      head: 'Separate signals about ' + name('p_dana'),
      tools: '<button class="btn" data-act="connect" aria-pressed="false">Connect the dots</button>',
      body: '<div class="idwrap" tabindex="0" role="region" aria-label="Identity graph">' + svg + '</div><p class="ppre">Connected, these signals become one profile: what was collected, what was derived, and what was inferred.</p><div class="pcols">' + cols + '</div><p class="keyq">Was this linkage necessary and permitted for the intended purpose?</p>',
      mount: function (root) {
        var b = $('[data-act="connect"]', root);
        b.addEventListener('click', function () { var on = !root.classList.contains('linked'); root.classList.toggle('linked', on); b.textContent = on ? 'Separate again' : 'Connect the dots'; b.setAttribute('aria-pressed', on); $('.vis-h', root).textContent = on ? 'One person, linked across contexts' : 'Separate signals about ' + name('p_dana'); });
      }
    };
  };

  /* journey path — every arrow is a decision */
  V.flow = function (st, view) {
    var J = journey(st), hops = J.hops, CLS = { ok: '', warn: ' a-warn', fail: ' a-fail', unk: ' a-unk' };
    var chain = '<div class="chain">' + hops.map(function (h, i) {
      return (i ? '<button class="arr' + CLS[h.st || 'ok'] + '" data-a="' + i + '" aria-label="Inspect arrow: ' + esc(hops[i - 1].n + ' to ' + h.n) + '"></button>' : '') + '<div class="nd z-' + h.z + '">' + esc(h.n) + '<small>' + esc(ZONE[h.z]) + '</small></div>';
    }).join('') + '</div>';
    var first = hops.findIndex(function (h, i) { return i && h.st === 'fail'; }); if (first < 1) first = 1;
    return {
      head: 'Journey: ' + J.label,
      tools: '<span class="legend"><i class="lg-ok"></i>normal <i class="lg-warn"></i>review <i class="lg-fail"></i>failure <i class="lg-unk"></i>unknown</span>',
      body: '<div class="flow">' + chain + '</div><div class="insp" id="insp" aria-live="polite"></div>',
      mount: function (root) {
        function show(i) {
          var h = hops[i], prev = hops[i - 1];
          $$('.arr', root).forEach(function (b) { var on = +b.getAttribute('data-a') === i; b.classList.toggle('sel', on); b.setAttribute('aria-pressed', on); });
          var tb = prev.z === h.z ? ZONE[h.z] + ' (no boundary crossed)' : ZONE[prev.z] + ' → ' + ZONE[h.z];
          var priv = [['What moved?', h.mv], ['Why?', h.why], ['Under which identity?', h.id + (h.sc && h.sc !== 'none' ? ' (' + h.sc + ')' : '')], ['Across which trust boundary?', tb], [view.learn ? 'How did it learn, and what does it now know?' : 'What can the receiver now learn?', h.obs]];
          var rows = st.l === 'security' ? [['What moved?', h.mv], ['Security control', h.sec || 'None recorded']] : st.l === 'both' ? priv.concat([['Security control', h.sec || 'None recorded']]) : priv;
          var ctl = h.ctl ? '<p class="insp-ctl">Control: <b>' + esc(name(h.ctl)) + '</b> ' + stTag(ctlState(h.ctl), freshness(G.controls[h.ctl] && G.controls[h.ctl].last).t) + '</p>' : '';
          $('#insp', root).innerHTML = '<div class="insp-h"><span class="eyebrow">Arrow</span><b class="' + (h.st === 'fail' ? 'red' : '') + '">' + esc(prev.n + ' → ' + h.n) + '</b></div><dl class="five">' + rows.map(function (r, k) { return '<div><dt>' + esc(r[0]) + '</dt><dd' + (k === 4 && h.st === 'fail' ? ' class="red"' : '') + '>' + esc(r[1]) + '</dd></div>'; }).join('') + '</dl>' + ctl + (h.ctl === 'c_server_filter' ? payloadHTML() : '');
        }
        root.addEventListener('click', function (e) { var b = e.target.closest('.arr'); if (b) show(+b.getAttribute('data-a')); });
        show(first);
      }
    };
  };
  function payloadHTML() {
    var json = '[\n' + G.payload.map(function (r) { var line = '  { "tenant": "' + r[0] + '", "revenue": ' + r[1] + ' }'; return r[2] ? esc(line) : '<span class="x">' + esc(line) + '</span>'; }).join(',\n') + '\n]';
    var max = Math.max.apply(null, G.payload.map(function (r) { return r[1]; }));
    return '<div class="payload"><div class="pane"><div class="eyebrow">Server returns</div><pre class="json" tabindex="0" aria-label="Server response">' + json + '</pre></div>' +
      '<div class="pane"><div class="eyebrow">Client displays</div><div class="bars">' + G.payload.map(function (r) { return '<i class="' + (r[2] ? '' : 'gone') + '" style="height:' + Math.round(r[1] / max * 100) + '%"></i>'; }).join('') + '</div><div class="barl">' + G.payload.map(function (r) { return '<span>' + r[0] + (r[2] ? '' : ' hidden') + '</span>'; }).join('') + '</div></div></div>' +
      '<div class="warn-big">FILTERING ≠ ISOLATION</div><p class="keyline">If unauthorized data reached the client, the privacy failure already happened.</p>';
  }

  /* who knows it — the visible thing versus invisible observers */
  var SEEN_LINE = { browse: 'The page the user sees is not necessarily the system that sees the user.', mail: 'We think we are reading the email. Sometimes the email is also reading us.', signin: 'Removing the password does not remove the privacy problem. It changes the trust model.', pay: 'Prove what is necessary without revealing everything underneath.', age: 'Prove the attribute. Do not necessarily disclose the identity.', ai: 'Where intelligence runs is itself a privacy decision.' };
  V.observers = function (st) {
    var J = journey(st), obs = J.hops.filter(function (h, i) { return i && h.z !== 'device'; });
    var linkable = function (h) { return h.sc === 'stable'; };
    return {
      head: 'Who knows it: ' + J.label,
      body: '<div class="obs"><div class="seen"><div class="eyebrow">What the person sees</div><div class="seen-card">' + esc(J.sees) + '</div><p class="small">' + plural(obs.length, 'party') + ' beyond the device take part.</p></div>' +
        '<div class="unseen"><div class="eyebrow">Who can observe</div><ul>' + obs.map(function (h) {
          return '<li class="o-' + h.st + '"><div class="o-h"><b>' + esc(h.n) + '</b><span class="zone z-' + h.z + '">' + esc(ZONE[h.z]) + '</span></div><p>' + esc(h.obs) + '</p><p class="o-m"><span>' + (h.keep === 'yes' ? 'Persists' : h.keep === 'no' ? 'Not kept' : 'Retention unknown') + '</span><span>' + (linkable(h) ? 'Can link visits: ' + esc(h.id) : 'Identifier scoped') + '</span></p></li>';
        }).join('') + '</ul></div></div>' + (SEEN_LINE[J.id] ? '<p class="keyline">' + esc(SEEN_LINE[J.id]) + '</p>' : '')
    };
  };

  /* how did the user prove identity — password to passkey */
  V.auth = function () {
    var A = G.auth;
    return {
      head: 'From a shared secret to a key pair',
      body: '<div class="pkw" tabindex="0" role="region" aria-label="Password and passkey compared"><table class="pkt"><thead><tr><th scope="col"></th><th scope="col">Password</th><th scope="col">Passkey</th></tr></thead><tbody>' + A.rows.map(function (r) { return '<tr><th scope="row">' + esc(r[0]) + '</th><td class="pw">' + esc(r[1]) + '</td><td class="pkc">' + esc(r[2]) + '</td></tr>'; }).join('') + '</tbody></table></div>' +
        '<div class="eyebrow">Privacy questions that remain</div><ul class="pq">' + A.questions.map(function (q) { return '<li>' + stTag(q[2], q[2] === 'ok' ? 'answered' : q[2] === 'fail' ? 'failing' : q[2] === 'warn' ? 'watch' : 'open') + '<div><b>' + esc(q[0]) + '</b><p>' + esc(q[1]) + '</p></div></li>'; }).join('') + '</ul>' +
        '<p class="keyline">Removing the password does not remove the privacy problem. It changes the trust model.</p>'
    };
  };

  /* what identifier links this activity */
  V.ids = function (st) {
    var J = journey(st), seen = J.hops.filter(function (h, i) { return i && h.id && h.id !== 'none'; });
    var everywhere = {};
    G.journeys.forEach(function (j) { j.hops.forEach(function (h, i) { if (i && h.sc === 'stable' && h.z !== 'device') (everywhere[h.id] = everywhere[h.id] || []).push(j.label); }); });
    var multi = Object.keys(everywhere).filter(function (k) { return everywhere[k].length > 1; });
    var SC = { stable: ['st-fail', 'stable'], scoped: ['st-ok', 'scoped'], none: ['st-ok', 'none'] };
    return {
      head: 'Identifiers on the journey: ' + J.label,
      body: '<ul class="idl">' + seen.map(function (h) { var s = SC[h.sc] || SC.none; return '<li><span class="idn">' + esc(h.id) + '</span><span class="st ' + s[0] + '">' + s[1] + '</span><span class="idw">seen by ' + esc(h.n) + ' · ' + esc(ZONE[h.z]) + '</span></li>'; }).join('') + '</ul>' +
        (multi.length ? '<div class="corr"><div class="eyebrow">Stable identifiers that appear in more than one journey</div>' + multi.map(function (k) { return '<p><b>' + esc(k) + '</b>: ' + everywhere[k].map(esc).join(', ') + '</p>'; }).join('') + '</div>' : '') +
        '<p class="keyline">A stable identifier seen by more than one party is how unrelated activity becomes one profile.</p>'
    };
  };

  /* did it leave the device — swimlanes by zone */
  V.boundary = function (st, view) {
    var J = journey(st);
    var lanes = G.zones.map(function (z) { return '<div class="lane"><div class="lane-h">' + esc(z[1]) + '</div>' + J.hops.map(function (h, i) {
      if (h.z !== z[0]) return '<div class="cell"></div>';
      var crossed = i && J.hops[i - 1].z === 'device' && h.z !== 'device';
      return '<div class="cell"><div class="nd z-' + h.z + (crossed ? ' crossed' : '') + '">' + esc(h.n) + (crossed ? '<small>left the device</small>' : '') + '</div>' + (view.why && i && h.z !== 'device' ? '<div class="why"><b>Why:</b> ' + esc(h.why || '—') + ' ' + stTag(h.need === 'yes' ? 'ok' : h.need === 'no' ? 'fail' : 'unk', h.need === 'yes' ? 'needed' : h.need === 'no' ? 'not needed' : 'need unknown') + '</div>' : '') + '</div>';
    }).join('') + '</div>'; }).join('');
    var left = J.hops.filter(function (h, i) { return i && h.z !== 'device'; });
    return {
      head: (view.why ? 'Why it left the device: ' : 'Did it leave the device: ') + J.label,
      tools: '<span class="count">' + (left.length ? plural(left.length, 'hop') + ' off the device' : 'Stays on the device') + '</span>',
      body: '<div class="lanes" style="--n:' + J.hops.length + '">' + lanes + '</div><p class="keyline">Do not collect what you can compute locally.</p>'
    };
  };

  /* AI routing — on device, private compute, third party */
  V.routing = function () {
    var R = G.routing, Z = { device: 'On device', private: 'Private compute', third: 'Third-party model' };
    var cols = [['leaves', 'What leaves'], ['retained', 'Retained'], ['operator', 'Operator can view'], ['training', 'Used for training'], ['verified', 'Environment verified'], ['third', 'Third party']];
    return {
      head: 'Where each request runs',
      body: '<div class="route"><div class="rt-zones">' + ['device', 'private', 'third'].map(function (z) { return '<div class="rz z-' + z + '"><b>' + Z[z] + '</b></div>'; }).join('') + '</div>' +
        R.requests.map(function (q) { return '<div class="rq"><div class="rq-h"><span class="rq-r">' + esc(q.r) + '</span><span class="rq-a">→ routing decision →</span><span class="zone z-' + q.zone + '">' + Z[q.zone] + '</span></div><dl class="rq-d">' + cols.map(function (c) { var v2 = q[c[0]], bad = /^Unknown|^Yes: Parallax/.test(v2); return '<div><dt>' + c[1] + '</dt><dd class="' + (bad ? 'amb' : '') + '">' + esc(v2) + '</dd></div>'; }).join('') + '</dl></div>'; }).join('') + '</div>' +
        '<ul class="agq">' + R.qs.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul><p class="keyline">Where intelligence runs is itself a privacy decision.</p>'
    };
  };

  /* can we prove this without revealing that */
  V.sdisc = function (st, view) {
    var D = G.disclosure[view.variant], body;
    if (view.variant === 'age') {
      body = '<div class="sd"><div class="sd-old"><div class="eyebrow">Old way · ' + esc(D.old.label) + '</div><ul>' + D.old.fields.map(function (f) { return '<li>' + esc(f) + '</li>'; }).join('') + '</ul><p class="small">All of it, to answer one question.</p></div>' +
        '<div class="sd-arrow" aria-hidden="true">→</div><div class="sd-new"><div class="eyebrow">New way · ' + esc(D.neu.label) + '</div><div class="sd-ans">' + esc(D.neu.answer) + '</div><p class="small">' + esc(D.neu.with) + '. Nothing else leaves the wallet.</p></div></div>';
    } else if (view.variant === 'relay') {
      body = '<table class="rel"><thead><tr><th scope="col">Service</th><th scope="col">Address it receives</th><th scope="col"></th></tr></thead><tbody>' + D.rows.map(function (r) { return '<tr><th scope="row">' + esc(r[0]) + '</th><td class="mono">' + esc(r[1]) + '</td><td>' + esc(r[2]) + '</td></tr>'; }).join('') + '</tbody></table>';
    } else {
      var U = { high: 3, medium: 2, low: 1 }, dec = { keep: ['st-ok', 'keep'], 'derive on device': ['st-warn', 'derive on device'], drop: ['st-fail', 'drop'] };
      body = '<table class="util"><thead><tr><th scope="col">Signal</th><th scope="col">Fraud utility</th><th scope="col">Privacy cost</th><th scope="col">Decision</th></tr></thead><tbody>' + D.signals.map(function (r) { return '<tr><th scope="row">' + esc(r[0]) + '</th><td><span class="meter m' + U[r[1]] + '" aria-hidden="true"></span> ' + r[1] + '</td><td><span class="meter c' + U[r[2]] + '" aria-hidden="true"></span> ' + r[2] + '</td><td><span class="st ' + dec[r[3]][0] + '">' + dec[r[3]][1] + '</span></td></tr>'; }).join('') + '</tbody></table>' +
        '<p class="small">Fraud protection versus data minimization: keep what measurably stops fraud. Privacy does not automatically win.</p>';
    }
    return { head: D.title, body: body + '<ul class="agq">' + D.qs.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' + (view.variant === 'age' ? '<p class="keyline">Prove the attribute. Do not necessarily disclose the identity.</p>' : view.variant === 'relay' ? '<p class="keyline">Does the service need the user’s real email address at all?</p>' : '<p class="keyline">Prove what is necessary without revealing everything underneath.</p>') };
  };

  /* purpose — declared purpose against actual use (server-side journeys) */
  V.purpose = function (st) {
    var rows = G.purpose.filter(function (r) { return st.s === 'all' || r.s.indexOf(st.s) >= 0; }); if (!rows.length) rows = G.purpose;
    var VC = { declared: 'u-ok', undeclared: 'u-bad', unknown: 'u-unk' }, NEED = { yes: 'needed', no: 'not needed', unknown: 'need unknown' };
    return {
      head: 'Declared purpose against actual use',
      tools: '<span class="legend"><i class="lg-ok"></i>declared <i class="lg-fail"></i>undeclared <i class="lg-unk"></i>unknown</span>',
      body: '<div class="purp">' + rows.map(function (r) { return '<div class="prow"><div class="pds"><b>' + esc(name(r.ds)) + '</b><small>declared: ' + r.declared.map(name).map(esc).join(', ') + '</small></div><div class="puses">' + r.uses.map(function (u) { return '<span class="use ' + VC[u[2]] + '"><b>' + esc(name(u[0])) + '</b> via ' + esc(u[1]) + ' · ' + NEED[u[3]] + '</span>'; }).join('') + '</div></div>'; }).join('') + '</div>' +
        '<p class="keyline">Encryption protects the data. It does not answer why the data exists.</p>'
    };
  };

  /* access — needs vs can access */
  V.access = function () {
    var A = G.access, extra = A.can.filter(function (d) { return A.needs.indexOf(d) < 0; });
    return {
      head: name(A.process) + ': what it needs, and what it can reach',
      body: '<div class="acc"><div class="nd big">' + esc(name(A.process)) + '<small>' + esc(G.node(A.process).sub) + '</small></div>' +
        '<div class="acc-c"><div class="eyebrow">Needs</div>' + A.needs.map(function (d) { return '<div class="dsx ok">' + esc(name(d)) + '</div>'; }).join('') + '</div>' +
        '<div class="acc-c"><div class="eyebrow">Can access</div>' + A.can.map(function (d) { var x = extra.indexOf(d) >= 0; return '<div class="dsx ' + (x ? 'bad' : 'ok') + '">' + esc(name(d)) + (x ? ' <span class="st st-fail">excess privilege</span>' : '') + '</div>'; }).join('') + '</div></div>' +
        '<div class="twin">' + A.mask.map(function (m) { var bad = m[1] === 'UNMASKED'; return '<div class="tw ' + (bad ? 'bad' : 'ok') + '"><div class="eyebrow">' + esc(m[0]) + '</div><b>' + m[1] + '</b><small>' + esc(m[2]) + '</small></div>'; }).join('') + '</div>' +
        '<div class="leak"><span class="eyebrow">Observability</span><div class="chain">' + A.leak.map(function (n, i) { return '<div class="nd' + (i >= 2 ? ' bad' : '') + '">' + esc(n) + '</div>' + (i < A.leak.length - 1 ? '<span class="arr static' + (i >= 1 ? ' a-fail' : '') + '"></span>' : ''); }).join('') + '</div><small>' + esc(A.leakWhat) + '</small></div>' +
        '<p class="keyline">Security may allow the access. Privacy still asks whether the process needs it.</p>'
    };
  };

  /* join — two legitimate tables, one new exposure */
  V.join = function () {
    var J = G.join;
    var tbl = function (t) { return '<div class="dt"><div class="dt-h">' + esc(t.label) + '<small>' + esc(name(t.node)) + '</small></div><table><tbody>' + t.cols.map(function (c) { return '<tr><td class="' + (c[0] === J.on ? 'k' : '') + '">' + esc(c[0]) + '</td><td>' + esc(c[1]) + '</td></tr>'; }).join('') + '</tbody></table><div class="dt-ok">' + stTag('ok', 'legitimate on its own') + '</div></div>'; };
    return {
      head: 'Two tables, one new exposure',
      tools: '<button class="btn" data-act="join" aria-pressed="false">Join on ' + esc(J.on) + '</button>',
      body: '<div class="jn">' + tbl(J.a) + '<div class="jop">JOIN ON ' + esc(J.on) + '</div>' + tbl(J.b) + '</div>' +
        '<div class="jres"><div class="eyebrow">Result</div><p class="jpre">Each table is legitimate on its own. Join them to see what the relationship creates.</p><div class="jr">' + J.result.map(esc).join(' + ') + '</div><div class="jnew">NEW PRIVACY MEANING CREATED BY THE JOIN</div></div>' +
        '<p class="keyline">The exposure may not exist in either table. It can be created by the relationship.</p><p class="aside">Table A behaved. Table B behaved. SQL introduced them.</p>',
      mount: function (root) { var b = $('[data-act="join"]', root); b.addEventListener('click', function () { var on = !root.classList.contains('joined'); root.classList.toggle('joined', on); b.setAttribute('aria-pressed', on); b.textContent = on ? 'Undo the join' : 'Join on ' + G.join.on; }); }
    };
  };

  /* consent timeline — local pass, system fail */
  function tlSVG(rows, revokedAt) {
    var X0 = 230, X1 = 960, T1 = 45, tx = function (m) { return X0 + m / T1 * (X1 - X0); }, hh = function (m) { var t = 590 + m; return ('0' + Math.floor(t / 60)).slice(-2) + ':' + ('0' + t % 60).slice(-2); };
    var bottom = 40 + rows.length * 40;
    var s = '<svg viewBox="0 0 1000 ' + (bottom + 30) + '" class="tl" role="img" aria-labelledby="tlT"><title id="tlT">Consent revoked at ' + hh(revokedAt) + '. Local systems honour it; downstream systems keep acting on old state.</title>';
    [0, 10, 20, 30, 40].forEach(function (m) { s += '<line class="grid" x1="' + tx(m) + '" x2="' + tx(m) + '" y1="26" y2="' + bottom + '"/><text class="ax" x="' + tx(m) + '" y="' + (bottom + 18) + '" text-anchor="middle">' + hh(m) + '</text>'; });
    s += '<line class="nowb" x1="' + tx(5) + '" x2="' + tx(5) + '" y1="26" y2="' + bottom + '"/><text class="nowbt" x="' + (tx(5) - 6) + '" y="14" text-anchor="end">BATCH STARTS · ' + hh(5) + '</text>';
    s += '<line class="nowl" x1="' + tx(revokedAt) + '" x2="' + tx(revokedAt) + '" y1="16" y2="' + bottom + '"/><text class="nowt" x="' + (tx(revokedAt) + 6) + '" y="14">USER REVOKES · ' + hh(revokedAt) + '</text>';
    rows.forEach(function (r, i) {
      var y = 48 + i * 40, w = r.p.length * 7.4 + 18, x = tx(r.at) - (r.from != null ? w : w / 2);
      s += '<g class="tr" data-i="' + i + '"><text class="rl" x="8" y="' + y + '">' + esc(r.n.toUpperCase()) + '</text><text class="rs" x="8" y="' + (y + 15) + '">' + esc(r.note) + '</text>';
      if (r.from != null) s += '<rect class="batch" x="' + tx(r.from) + '" y="' + (y - 12) + '" width="' + (tx(r.at) - tx(r.from)) + '" height="22" rx="5"/>';
      s += '<g class="pill pill-' + r.st + '"><rect x="' + x + '" y="' + (y - 11) + '" width="' + w + '" height="21" rx="5"/><text x="' + (x + w / 2) + '" y="' + (y + 4) + '" text-anchor="middle">' + esc(r.p) + '</text></g><text class="ax" x="' + (x + w + 8) + '" y="' + (y + 4) + '">' + (r.from != null ? hh(r.from) + '–' + hh(r.at) : hh(r.at)) + '</text></g>';
    });
    return s + '</svg>';
  }
  V.consent = function () {
    var R = G.consent.rows, local = worst(R.slice(0, 2).map(function (r) { return r.st; })), sys = worst(R.map(function (r) { return r.st; }));
    return {
      head: 'A “no”, followed through the system',
      tools: '<button class="btn ghost" data-act="replay">Replay</button>',
      body: verdict(local, sys) + '<div class="tlw" tabindex="0" role="region" aria-label="Consent timeline">' + tlSVG(R, G.consent.revokedAt) + '</div><p class="keyline">Consent is distributed state, not a checkbox.</p><p class="aside">The customer said no. The batch job said, “I was already on the freeway.”</p>',
      mount: function (root) {
        var t = [];
        $('[data-act="replay"]', root).addEventListener('click', function () {
          t.forEach(clearTimeout); t = [];
          var g = $$('.tr', root), order = R.map(function (r, i) { return i; }).sort(function (a, b) { return R[a].at - R[b].at || a - b; });
          g.forEach(function (e) { e.classList.add('hide'); });
          order.forEach(function (i, k) { t.push(setTimeout(function () { g[i].classList.remove('hide'); }, RM ? 0 : 200 + k * 450)); });
        });
      }
    };
  };

  /* deletion */
  V.delete = function () {
    var D = G.deletion, n = D.filter(function (x) { return x.st === 'ok'; }).length, LBL = { ok: 'Deleted ✓', fail: 'Still present ✕', unk: 'Unknown ?', wait: 'Pending' };
    return {
      head: 'Delete my data: every copy that holds ' + name('p_dana'),
      tools: '<button class="btn" data-act="del">Delete my data</button>',
      body: verdict(worst(D.slice(0, 2).map(function (x) { return x.st; })), worst(D.map(function (x) { return x.st; }))) +
        '<div class="stores">' + D.map(function (x) { return '<div class="store s-' + x.st + '"><b>' + esc(x.n) + '</b><small>' + esc(x.ev) + '</small>' + stTag(x.st, LBL[x.st]) + '</div>'; }).join('') + '</div>' +
        '<p class="count">' + n + ' of ' + D.length + ' locations verified deleted</p><p class="keyline">Deletion is a distributed-systems problem disguised as a button.</p><p class="keyq">Can we prove every relevant copy was deleted, detached, or expired?</p>',
      mount: function (root) {
        var t = [];
        $('[data-act="del"]', root).addEventListener('click', function () {
          t.forEach(clearTimeout); t = [];
          var s = $$('.store', root); s.forEach(function (e) { e.classList.add('pending'); });
          s.forEach(function (e, k) { t.push(setTimeout(function () { e.classList.remove('pending'); }, RM ? 0 : 150 + k * 260)); });
        });
      }
    };
  };

  /* retention */
  V.retention = function (st) {
    var rows = G.retention.filter(function (r) { return st.s === 'all' || r.s.indexOf(st.s) >= 0; }); if (!rows.length) rows = G.retention;
    var max = Math.max.apply(null, rows.map(function (r) { return Math.max(r.req, r.dec, r.obs || 0); })), sc = function (v) { return Math.max(1, Math.round(v / max * 100)); };
    return {
      head: 'How long it lives, in days',
      tools: '<span class="legend"><i class="lg-req"></i>required <i class="lg-dec"></i>declared <i class="lg-obs"></i>observed</span>',
      body: '<div class="ret">' + rows.map(function (r) {
        var over = r.obs != null && r.obs > r.dec, st2 = r.obs == null ? 'unk' : over ? 'fail' : r.dec > r.req ? 'warn' : 'ok';
        return '<div class="rrow"><div class="rn"><b>' + esc(r.n) + '</b>' + stTag(st2, r.obs == null ? 'not measured' : over ? 'over declared' : r.dec > r.req ? 'longer than required' : 'within') + '</div><div class="rbars">' +
          '<span class="rb req" style="width:' + sc(r.req) + '%"><em>' + (r.req === 0 ? 'none' : r.req) + '</em></span><span class="rb dec" style="width:' + sc(r.dec) + '%"><em>' + r.dec + '</em></span>' +
          (r.obs == null ? '<span class="rb unkb">observed: unknown</span>' : '<span class="rb obs' + (over ? ' over' : '') + '" style="width:' + sc(r.obs) + '%"><em>' + r.obs + '</em></span>') + '</div></div>';
      }).join('') + '</div><p class="keyline">Every extra day is exposure without purpose.</p>'
    };
  };

  /* control — intended, actual, evidence, exceptions, hop by hop */
  function chainFor(id, st) {
    if (id === 'tenant') return { title: 'Tenant invariant: Tenant A must never receive Tenant B data', hops: G.tenantChain };
    if (id === 'consent') return { title: 'Consent invariant: nothing acts on a revoked choice', hops: G.consent.rows.map(function (r) { return { n: r.n, intended: r.intended, actual: r.p, evidence: r.evidence, st: r.st }; }) };
    if (id === 'delete') return { title: 'Deletion invariant: every copy is deleted, detached or expired', hops: G.deletion.map(function (x) { return { n: x.n, intended: 'Remove ' + name('p_dana'), actual: x.ev, evidence: x.st === 'ok' ? 'Canary lookup' : x.st === 'unk' ? 'No search run' : 'Canary at T+72h', st: x.st === 'wait' ? 'warn' : x.st }; }) };
    if (id === 'access') { var A = G.access; return { title: 'Least privilege: a job reads only what it needs', hops: [
      { n: 'IAM role', intended: 'Read ' + A.needs.map(name).join(', '), actual: 'Can read ' + plural(A.can.length, 'dataset'), evidence: 'Access review, ' + freshness(G.controls.c_iam.last).t, st: 'fail' },
      { n: 'Warehouse masking', intended: G.controls.c_mask.inv, actual: 'Masked views', evidence: 'Column scan, ' + freshness(G.controls.c_mask.last).t, st: ctlState('c_mask') },
      { n: 'Staging copy', intended: 'Same masking as the warehouse', actual: 'Unmasked', evidence: 'Bucket sample', st: 'fail' },
      { n: 'Logs', intended: G.controls.c_url_redact.inv, actual: 'IDs in request paths', evidence: 'Never scanned', st: 'unk' }] }; }
    var list = CTL_LIST[id] || CTL_LIST.link;
    return { title: CTL_TITLE[id], hops: list.map(function (c) { var C = G.controls[c], s = ctlState(c); return { n: name(c), intended: C.inv, actual: C.result === 'pass' ? 'Holds at ' + C.where.toLowerCase() : C.result === 'fail' ? 'Fails at ' + C.where.toLowerCase() : 'Documented, never tested', evidence: C.method + ' · ' + freshness(C.last).t, st: s }; }) };
  }
  V.control = function (st, view) {
    var ch = chainFor(view.ctl, st), local = ch.hops[0].st, sys = worst(ch.hops.map(function (h) { return h.st; }));
    var exc = ch.hops.filter(function (h) { return h.st !== 'ok'; }).length;
    var cards = ch.hops.map(function (h, i) {
      return '<button class="hop h-' + h.st + '" data-h="' + i + '"><span class="hop-n">' + esc(h.n) + '</span>' + stTag(h.st) +
        '<span class="hop-r"><em>Intended</em>' + esc(h.intended) + '</span><span class="hop-r"><em>Actual</em>' + esc(h.actual) + '</span><span class="hop-r"><em>Evidence</em>' + esc(h.evidence) + '</span></button>';
    }).join('');
    return {
      head: ch.title,
      tools: '<span class="count">' + plural(exc, 'exception') + ' in ' + plural(ch.hops.length, 'hop') + '</span>',
      body: verdict(local, sys) + '<div class="hops">' + cards + '</div><div class="hopd" id="hopd" aria-live="polite"></div>',
      mount: function (root) {
        function show(i) {
          var h = ch.hops[i]; $$('.hop', root).forEach(function (b) { b.classList.toggle('sel', +b.getAttribute('data-h') === i); });
          var d = $('#hopd', root);
          d.innerHTML = h.detail === 'client' ? payloadHTML() : h.detail === 'pdf' ? statementHTML() : '<p class="hopline"><b>' + esc(h.n) + '.</b> Intended: ' + esc(h.intended) + '. Actual: ' + esc(h.actual) + '. Evidence: ' + esc(h.evidence) + '.</p>';
        }
        root.addEventListener('click', function (e) { var b = e.target.closest('.hop'); if (b) show(+b.getAttribute('data-h')); });
        var f = ch.hops.findIndex(function (h) { return h.detail; }); if (f < 0) f = ch.hops.findIndex(function (h) { return h.st === 'fail'; }); show(f < 0 ? 0 : f);
      }
    };
  };
  function statementHTML() {
    var rows = G.statement.rows, mine = rows.filter(function (r) { return r[1] === 'Tenant A'; }), bad = rows.filter(function (r) { return r[1] !== 'Tenant A'; }), pct = Math.round(mine.length / rows.length * 100);
    return '<div class="stmt"><div class="stmt-l"><div class="eyebrow">Tenant A commission statement · PDF</div><table><thead><tr><th scope="col">Rep</th><th scope="col">Tenant</th><th scope="col">Commission</th></tr></thead><tbody>' +
      bad.concat(mine.slice(0, 4)).map(function (r) { var x = r[1] !== 'Tenant A'; return '<tr class="' + (x ? 'x' : '') + '"><td>' + esc(r[0]) + '</td><td>' + esc(r[1]) + '</td><td>' + esc(r[2]) + '</td></tr>'; }).join('') +
      '<tr><td colspan="3" class="more">+ ' + (mine.length - 4) + ' more Tenant A rows</td></tr></tbody></table></div>' +
      '<div class="stmt-r"><div class="big-n">' + pct + '% correct</div><div class="big-n red">100% wrong</div><p>' + plural(bad.length, 'line') + ' of ' + rows.length + ' belongs to another tenant: one person’s pay, sent to a stranger.</p></div></div>' +
      '<p class="keyline">A report can be ' + pct + '% correct and still be 100% wrong from a privacy perspective.</p>';
  }

  /* what can this system infer — the agent combines authorized data */
  V.agent = function (st, view) {
    var ag = G.agents[view.agent];
    return {
      head: name(view.agent) + ' · purpose: ' + ag.purpose,
      tools: '<button class="btn" data-act="combine" aria-pressed="false">Let the agent combine</button>',
      body: '<div class="agw"><div class="agt">' + ag.used.map(function (t) { return '<div class="tool"><b>' + esc(t[0]) + '</b>' + stTag('ok', 'Authorized ✓') + '<small>' + esc(t[2]) + '</small></div>'; }).join('') + '</div>' +
        '<div class="agc"><div class="agent-core">AGENT<small>' + esc(name(view.agent)) + '</small></div></div>' +
        '<div class="agi"><div class="inf-pre">Each tool answers one narrow question.</div><div class="inf-on">' + tag('INFERENCE') + '<b>' + esc(ag.inference) + '</b><small>No database stored this. The system inferred it.</small><div class="agact">Next action: ' + esc(ag.action) + ' · approval: ' + esc(ag.approval) + '</div></div></div></div>' +
        '<div class="neq">' + ag.used.map(function () { return '<span>AUTHORIZED DATA</span>'; }).join('<i>+</i>') + '<b>≠</b><span>UNLIMITED AUTHORIZED INFERENCE</span></div>' +
        guardsHTML() + '<p class="keyline">AI turns the JOIN from something a developer writes into something the machine may decide to perform.</p>',
      mount: function (root) { var b = $('[data-act="combine"]', root); b.addEventListener('click', function () { var on = !root.classList.contains('combined'); root.classList.toggle('combined', on); b.setAttribute('aria-pressed', on); b.textContent = on ? 'Reset' : 'Let the agent combine'; }); }
    };
  };
  function guardsHTML() { return '<div class="guards"><span class="eyebrow">Guardrails</span>' + G.guardrails.map(function (g) { return '<span class="gd' + (g[1] ? ' need' : '') + '" title="' + (g[1] ? 'Missing: would have stopped this' : 'In place') + '">' + esc(g[0]) + (g[1] ? ' · missing' : '') + '</span>'; }).join('') + '</div>'; }

  /* what can this agent do — privileges per tool */
  V.agentdo = function () {
    var P = G.privileges;
    return {
      head: name('ag_assist') + ': tools, scope and actions',
      tools: '<span class="count">' + plural(P.filter(function (p) { return p[4] !== 'ok'; }).length, 'tool') + ' wider than the task</span>',
      body: '<table class="priv"><thead><tr><th scope="col">Tool</th><th scope="col">Data scope</th><th scope="col">Can do</th><th scope="col">Approval</th><th scope="col"></th></tr></thead><tbody>' + P.map(function (p) { return '<tr><th scope="row">' + esc(p[0]) + '</th><td>' + esc(p[1]) + '</td><td>' + esc(p[2]) + '</td><td>' + esc(p[3]) + '</td><td>' + stTag(p[4], p[4] === 'ok' ? 'bounded' : p[4] === 'fail' ? 'unbounded' : 'broad') + '</td></tr>'; }).join('') + '</tbody></table>' +
        guardsHTML() + '<p class="keyline">Every tool may be individually authorized. That does not make every combination, or every action, appropriate.</p>'
    };
  };

  /* one account, one life — and who tries to steal it */
  V.takeover = function (st) {
    var O = G.oneLife, T = G.takeover, on = O.surfaces.map(function () { return true; }), ti = 0, fixed = false;
    var names = {}; O.surfaces.forEach(function (x) { names[x[0]] = x[1]; });
    function draw(root) {
      var have = O.surfaces.filter(function (x, i) { return on[i]; }).map(function (x) { return x[0]; });
      var facts = O.joins.filter(function (j) { return j.needs.every(function (n) { return have.indexOf(n) >= 0; }); });
      $$('[data-sf]', root).forEach(function (b, i) { b.setAttribute('aria-pressed', on[i]); });
      $('#ol-res', root).innerHTML = facts.length ? '<ul class="ol-f">' + facts.map(function (j) { return '<li>' + tag('INFERENCE') + ' ' + esc(j.fact) + ' <span class="cite">' + j.needs.map(function (n) { return esc(names[n]); }).join(' + ') + '</span></li>'; }).join('') + '</ul>' : '<p class="empty">Separate, each surface knows one thing about her.</p>';
      var t = T[ti], reach = (fixed ? t.after : t.gets);
      $$('[data-tk]', root).forEach(function (b, i) { b.setAttribute('aria-checked', i === ti); });
      $('#tk-fix', root).setAttribute('aria-pressed', fixed); $('#tk-fix', root).textContent = fixed ? 'Remove the control' : 'Apply the control';
      $('#tk-res', root).innerHTML = '<p class="tk-how">' + esc(t.how) + '</p><div class="tk-reach">' + O.surfaces.map(function (x) { var got = reach.indexOf(x[0]) >= 0; return '<span class="tk-s ' + (got ? 'got' : 'safe') + '"><b>' + esc(x[1]) + '</b>' + (got ? 'reached' : 'protected') + '</span>'; }).join('') + '</div>' +
        '<dl class="tk-d"><div><dt>Why a one-time code does not stop it</dt><dd>' + esc(t.mfa) + '</dd></div><div><dt>The control</dt><dd>' + esc(t.control) + ' ' + stTag(ctlState(t.ctl), name(t.ctl) + ' · ' + freshness(G.controls[t.ctl].last).t) + '</dd></div><div><dt>The evidence</dt><dd>' + esc(t.evidence) + '</dd></div>' + (fixed ? '<div><dt>What remains</dt><dd>' + esc(t.residual) + '</dd></div>' : '') + '</dl>';
    }
    return {
      head: 'One account, one life',
      body: '<div class="ol"><div class="eyebrow">Surfaces signed in to one account</div><div class="seg ol-t" role="group" aria-label="Surfaces on the account">' + O.surfaces.map(function (x, i) { return '<button data-sf="' + i + '" aria-pressed="true">' + esc(x[1]) + ' <small>' + esc(x[2]) + '</small></button>'; }).join('') + '</div><div id="ol-res" aria-live="polite"></div></div>' +
        '<div class="tk"><div class="eyebrow">Who tries to steal it</div><div class="seg" role="radiogroup" aria-label="Attacker">' + T.map(function (t, i) { return '<button role="radio" data-tk="' + i + '" aria-checked="' + (i === 0) + '">' + esc(t.label) + '</button>'; }).join('') + '</div> <button class="btn ghost" id="tk-fix" aria-pressed="false">Apply the control</button><div id="tk-res" aria-live="polite"></div></div>' +
        '<p class="keyline">The account is the join key. Protect what comes after the password: the session, the browser, the recovery path.</p>',
      mount: function (root) {
        root.addEventListener('click', function (e) {
          var b = e.target.closest('[data-sf]'); if (b) { var i = +b.getAttribute('data-sf'); on[i] = !on[i]; draw(root); return; }
          var r = e.target.closest('[data-tk]'); if (r) { ti = +r.getAttribute('data-tk'); fixed = false; draw(root); return; }
          if (e.target.closest('#tk-fix')) { fixed = !fixed; draw(root); }
        });
        draw(root);
      }
    };
  };

  /* what changed */
  var CHANGE_Q = { 'new control failure': 'control', 'new AI tool access': 'agentdo', 'new join': 'join', 'retention increase': 'live', 'new vendor': 'where', 'new destination': 'where', 'new identifier': 'linkid', 'new dataset': 'live' };
  function changesFor(st) { return G.changes.filter(function (c) { return (st.s === 'all' || c[3] === st.s) && (!st.c.length || c[4].some(function (x) { return st.c.indexOf(x) >= 0; })); }); }
  V.changes = function (st) {
    var list = changesFor(st);
    return {
      head: 'Changed since the ' + G.lastReview + ' review',
      tools: '<span class="count">' + plural(list.length, 'change') + '</span>',
      body: list.length ? '<ol class="chg">' + list.map(function (c) { return '<li><span class="cd">' + esc(c[0]) + '</span><span class="ct">' + esc(c[1]) + '</span><span class="cx">' + esc(c[2]) + '</span><button class="linkbtn" data-go-q="' + CHANGE_Q[c[1]] + '" data-go-s="' + c[3] + '">Open</button></li>'; }).join('') + '</ol>' : '<p class="empty">No changes match these selectors. Choose all surfaces or clear the concern.</p>',
      mount: function (root) { root.addEventListener('click', function (e) { var b = e.target.closest('[data-go-q]'); if (b) { var s2 = b.getAttribute('data-go-s'); set({ q: b.getAttribute('data-go-q'), s: s2, j: byId(G.surfaces, s2).j }); } }); }
    };
  };

  /* worst day — a band, never a score */
  function band(reach, on) {
    var W = G.worst, removed = [], deid = [];
    W.safeguards.forEach(function (s) { if (on[s.id]) { removed = removed.concat(s.removes || []); deid = deid.concat(s.deident || []); } });
    var got = reach.filter(function (d) { return removed.indexOf(d) < 0; }).map(function (d) { var r = W.stores[d]; return { id: d, n: r[0], sens: r[1], ident: !!r[2] && deid.indexOf(d) < 0 }; });
    var sc = got.reduce(function (s, g) { return s + g.sens * (g.ident ? 2 : 1); }, 0);
    return { got: got, band: sc <= 4 ? 0 : sc <= 8 ? 1 : sc <= 14 ? 2 : 3 };
  }
  G.band = band;
  V.worst = function () {
    var W = G.worst, mode = W.modes[0].id, on = {};
    function draw(root) {
      var m = byId(W.modes, mode), r = band(m.reach, on);
      $('#wd-res', root).innerHTML = '<div class="bands" aria-label="Band: ' + W.bands[r.band] + '">' + W.bands.map(function (b, i) { return '<span class="' + (i === r.band ? 'on b' + i : '') + '">' + b + '</span>'; }).join('') + '</div>' +
        (r.got.length ? '<ul class="wd-list">' + r.got.map(function (g) { return '<li><b>' + esc(g.n) + '</b> ' + (g.ident ? stTag('fail', 'identifiable') : stTag('ok', 'de-identified')) + '</li>'; }).join('') + '</ul>' : '<p class="empty">Nothing reachable.</p>');
    }
    return {
      head: 'Our worst day, as a band',
      body: '<div class="wd"><div class="wd-l"><div class="seg" role="radiogroup" aria-label="Failure">' + W.modes.map(function (m, i) { return '<button role="radio" aria-checked="' + (i === 0) + '" data-m="' + m.id + '">' + esc(m.label) + '</button>'; }).join('') + '</div>' +
        '<fieldset class="sgs"><legend class="eyebrow">Safeguards</legend>' + W.safeguards.map(function (s) { return '<label><input type="checkbox" id="wd-' + s.id + '" data-s="' + s.id + '"> ' + esc(s.label) + '</label>'; }).join('') + '</fieldset></div><div class="wd-r" id="wd-res" aria-live="polite"></div></div>' +
        '<p class="keyline">Damage = what we collect × how long we keep it × how identifiable it is × who holds the key.</p>',
      mount: function (root) {
        root.addEventListener('click', function (e) { var b = e.target.closest('[data-m]'); if (!b) return; mode = b.getAttribute('data-m'); $$('[data-m]', root).forEach(function (x) { x.setAttribute('aria-checked', x === b); }); draw(root); });
        root.addEventListener('change', function (e) { var c = e.target.closest('[data-s]'); if (c) { on[c.getAttribute('data-s')] = c.checked; draw(root); } });
        draw(root);
      }
    };
  };

  /* ═══════════ FINDINGS ═══════════ */
  var ORDER = { 'CONTROL FAILURE': 0, FACT: 1, INFERENCE: 2, UNKNOWN: 3 };
  function findingsFor(st, view) {
    var q = view.kind === 'control' ? 'control' : st.q;
    var lensOk = function (f) { return st.l === 'both' || f.l === 'both' || f.l === st.l; };
    var sOk = function (f) { return st.s === 'all' || f.s.indexOf(st.s) >= 0; };
    var cOk = function (f) { return !st.c.length || f.c.some(function (c) { return st.c.indexOf(c) >= 0; }); };
    var score = function (f) { return (f.v.indexOf(q) >= 0 ? 4 : 0) + (st.c.length && cOk(f) ? 2 : 0) + (sOk(f) ? 1 : 0); };
    var pool = G.findings.filter(function (f) { return f.v.indexOf(q) >= 0 && sOk(f) && cOk(f) && lensOk(f); }), note = '';
    if (pool.length < 3) pool = pool.concat(G.findings.filter(function (f) { return pool.indexOf(f) < 0 && f.v.indexOf(q) >= 0 && lensOk(f) && sOk(f); }));
    if (pool.length < 3) pool = pool.concat(G.findings.filter(function (f) { return pool.indexOf(f) < 0 && f.v.indexOf(q) >= 0 && (sOk(f) || lensOk(f) && cOk(f)); }));
    if (pool.length < 3) pool = pool.concat(G.findings.filter(function (f) { return pool.indexOf(f) < 0 && f.v.indexOf(q) >= 0; }));
    pool.sort(function (a, b) { return score(b) - score(a) || ORDER[a.k] - ORDER[b.k]; });
    pool = pool.slice(0, st.p === 'executive' ? 3 : 5);
    if (st.l !== 'both' && pool.some(function (f) { return !lensOk(f); })) note = 'Few ' + st.l + '-only findings answer this; related findings are shown.';
    return { list: pool.sort(function (a, b) { return ORDER[a.k] - ORDER[b.k]; }), note: note };
  }
  function findingText(f) { return f.text === '{changes}' ? plural(G.changes.length, 'privacy-relevant change') + ' since the ' + G.lastReview + ' review; none went through review.' : f.text; }
  function findingsHTML(st, view) {
    var r = findingsFor(st, view);
    if (!r.list.length) return '<p class="empty">No findings match. Widen the surface or clear the concern.</p>';
    return '<ol class="fl">' + r.list.map(function (f) {
      var p = f.p && f.p[st.p];
      return '<li class="fi">' + tag(f.k) + '<p>' + esc(findingText(f)) + '</p>' + (p ? '<p class="lensline"><b>' + esc(p[0]) + '</b> ' + esc(p[1]) + '</p>' : '') + (f.cite.length ? '<p class="cite">' + f.cite.map(function (c) { return esc(name(c)); }).join(' · ') + '</p>' : '') + '</li>';
    }).join('') + '</ol>' + (r.note ? '<p class="note">' + esc(r.note) + '</p>' : '');
  }

  /* ═══════════ DECISION ═══════════ */
  function decisionHTML(st, view) {
    var d = G.decisions[view.key] || G.decisions.where;
    if (st.p === 'executive') {
      return '<dl class="dec"><div><dt>Issue</dt><dd>' + esc(d.exec.issue) + '</dd></div><div><dt>Options</dt><dd><ol class="opts">' + d.exec.opts.map(function (o) { return '<li>' + esc(o) + '</li>'; }).join('') + '</ol></dd></div>' +
        '<div class="hl"><dt>Recommendation</dt><dd>' + esc(d.exec.rec) + '</dd></div><div><dt>Residual risk</dt><dd>' + esc(d.exec.res) + '</dd></div></dl>';
    }
    var F4 = { risk: ['Risk', d.risk], why: ['Why it matters', d.why], mit: ['Mitigation', d.mit], ev: ['Evidence needed', d.ev] };
    var order = st.p === 'builder' ? ['mit', 'ev', 'risk', 'why'] : st.p === 'auditor' ? ['ev', 'risk', 'mit', 'why'] : ['risk', 'why', 'mit', 'ev'];
    var lab = { builder: { mit: 'Mitigation · where the control lives' }, auditor: { ev: 'Evidence needed · the test' } }[st.p] || {};
    return '<dl class="dec">' + order.map(function (k, i) { return '<div' + (i === 0 ? ' class="hl"' : '') + '><dt>' + esc(lab[k] || F4[k][0]) + '</dt><dd>' + esc(F4[k][1]) + '</dd></div>'; }).join('') + '</dl>';
  }

  /* ═══════════ PAGES ═══════════ */
  function sel(id, label, list, val, cls) { return '<label class="sl ' + (cls || '') + '"><span class="sr-only">' + label + '</span><select id="' + id + '">' + list.map(function (x) { return '<option value="' + x.id + '"' + (x.id === val ? ' selected' : '') + '>' + esc(x.label) + '</option>'; }).join('') + '</select></label>'; }
  function selectorBar() {
    var cl = S.c.map(function (c) { return byId(G.concerns, c).label.toLowerCase(); });
    var cLabel = !cl.length ? 'any concern' : cl.length === 1 ? cl[0] : cl[0] + ' +' + (cl.length - 1);
    return '<div class="sent" role="group" aria-label="Lenses">' +
      '<span class="w">I am a</span>' + sel('selP', 'Persona', G.personas, S.p, 'k-p') +
      '<span class="w">looking at</span>' + sel('selS', 'Surface', G.surfaces, S.s) +
      '<span class="w">when someone</span>' + sel('selJ', 'Journey', offered(G.journeys, 'j', S.s), S.j) +
      '<span class="w">asking</span>' + sel('selQ', 'Question', offered(G.questions, 'q', S.s), S.q, 'k-q') +
      '<span class="w">concerned with</span><span class="ms"><button type="button" id="selC" class="ms-b" aria-haspopup="true" aria-expanded="false" aria-controls="msPop"><span class="sr-only">Privacy concern: </span>' + esc(cLabel) + '</button>' +
      '<div class="ms-pop" id="msPop" hidden><div class="ms-h"><span class="eyebrow">Privacy concerns</span><button type="button" class="linkbtn" id="msClear">Clear</button></div>' +
      offered(G.concerns, 'c', S.s).map(function (c) { return '<label><input type="checkbox" id="cc-' + c.id + '" value="' + c.id + '"' + (S.c.indexOf(c.id) >= 0 ? ' checked' : '') + '> ' + esc(c.label) + '</label>'; }).join('') + '</div></span></div>' +
      '<div class="refine"><span class="w">about</span>' + sel('selU', 'Subject', offered(G.subjects, 'u', S.s), S.u) +
      '<span class="w">through the</span><div class="seg" role="radiogroup" aria-label="Lens">' + ['privacy', 'security', 'both'].map(function (l) { return '<button role="radio" data-l="' + l + '" aria-checked="' + (S.l === l) + '">' + l.charAt(0).toUpperCase() + l.slice(1) + '</button>'; }).join('') + '</div><span class="w">lens</span></div>' +
      '<p class="lensq">' + esc(G.lenses[S.l].q) + (G.lenses[S.l].incl ? ' <span>Includes ' + esc(G.lenses[S.l].incl) + '.</span>' : '') + '</p>' +
      (S.l === 'both' ? '<div class="conv">' + G.converge.map(function (c) { return '<div class="cv"><b>' + esc(c[0]) + '</b><p><em>Security</em>' + esc(c[1]) + '</p><p><em>Privacy</em>' + esc(c[2]) + '</p></div>'; }).join('') + '</div>' : '');
  }
  function focusRow() { return S.fm ? '<div class="focus-row" role="group" aria-label="Walkthrough views">' + G.focus.map(function (v, i) { return '<button class="chip" data-fv="' + i + '"><span class="n">' + (i + 1) + '</span>' + esc(v.label) + '</button>'; }).join('') + '</div>' : ''; }
  function loadSaved() { try { return JSON.parse(localStorage.getItem(SAVED_KEY) || '[]'); } catch (e) { return []; } }
  function storeSaved(v) { try { localStorage.setItem(SAVED_KEY, JSON.stringify(v)); } catch (e) { /* blocked storage: saved views last for this visit */ } }
  function viewsMenu() {
    var mine = loadSaved();
    return '<div class="vm-pop" id="vmPop" hidden><div class="eyebrow">Saved views</div>' + G.saved.map(function (v) { return '<button class="vm-i" data-sv="' + v.id + '">' + esc(v.label) + '</button>'; }).join('') +
      (mine.length ? '<div class="eyebrow">Yours</div>' + mine.map(function (v, i) { return '<span class="vm-mine"><button class="vm-i" data-mv="' + i + '">' + esc(v.label) + '</button><button class="x" data-mx="' + i + '" aria-label="Remove ' + esc(v.label) + '">×</button></span>'; }).join('') : '') +
      '<button class="vm-i add" id="saveView">+ Save the current view</button></div>';
  }

  function ccPage() {
    var view = resolve(S), r = V[view.kind](S, view), per = byId(G.personas, S.p);
    return selectorBar() + focusRow() +
      '<div class="ws">' +
        '<section class="card vis" aria-labelledby="visH" id="vis"><div class="sec-h"><span class="eyebrow">Graph</span><h2 id="visH" class="vis-h">' + esc(r.head) + '</h2><div class="tools">' + (r.tools || '') + '</div></div>' +
          (view.principle ? '<p class="principle">' + esc(view.principle) + '</p>' : '') + emph(S) + (view.note ? '<p class="note">' + esc(view.note) + '</p>' : '') + r.body + '</section>' +
        '<div class="side">' +
          '<section class="card fnd" aria-labelledby="fH"><div class="sec-h"><span class="eyebrow">Findings</span><h2 id="fH">' + (S.p === 'executive' ? 'What matters' : 'What we found') + '</h2></div>' + findingsHTML(S, view) + '</section>' +
          '<section class="card dcs" aria-labelledby="dH"><div class="sec-h"><span class="eyebrow">Decision</span><h2 id="dH">' + (S.p === 'executive' ? 'What decision is required' : 'What to do') + '</h2></div><p class="asks">' + esc(per.label) + ': ' + esc(per.asks) + '</p>' + decisionHTML(S, view) + '</section>' +
        '</div></div>' +
      '<p class="always">What looks protected here, but stops being protected somewhere else?</p>';
  }
  var focusAfter = null, keepPop = false;
  function closePop(e) { var pop = $('#msPop'); if (pop && !pop.hidden && !e.target.closest('.ms')) { pop.hidden = true; $('#selC').setAttribute('aria-expanded', 'false'); } var vm = $('#vmPop'); if (vm && !vm.hidden && !e.target.closest('.vm')) { vm.hidden = true; $('#vmBtn').setAttribute('aria-expanded', 'false'); } }
  function apply(s) { set({ page: 'cc', p: s.p, s: s.s, j: s.j, q: s.q, c: s.c.slice(), u: s.subj || 'person' }); }
  function mountCC() {
    var view = resolve(S), r = V[view.kind](S, view);
    if (r.mount) r.mount($('#vis'));
    [['selP', 'p'], ['selJ', 'j'], ['selQ', 'q'], ['selU', 'u']].forEach(function (x) { $('#' + x[0]).addEventListener('change', function () { var o = {}; o[x[1]] = this.value; focusAfter = x[0]; set(o); }); });
    $('#selS').addEventListener('change', function () { focusAfter = 'selS'; set({ s: this.value, j: byId(G.surfaces, this.value).j }); });
    var pop = $('#msPop'), btn = $('#selC');
    btn.addEventListener('click', function () { var open = pop.hidden; pop.hidden = !open; btn.setAttribute('aria-expanded', open); if (open) { var f = $('input', pop); if (f) f.focus(); } });
    pop.addEventListener('change', function (e) { focusAfter = e.target.id; keepPop = true; set({ c: $$('input:checked', pop).map(function (i) { return i.value; }) }); });
    $('#msClear').addEventListener('click', function () { focusAfter = 'selC'; set({ c: [] }); });
    if (keepPop) { pop.hidden = false; btn.setAttribute('aria-expanded', 'true'); keepPop = false; }
    $$('[data-l]').forEach(function (b) { b.addEventListener('click', function () { focusAfter = null; set({ l: b.getAttribute('data-l') }); }); });
    $$('[data-fv]').forEach(function (b) { b.addEventListener('click', function () { apply(G.focus[+b.getAttribute('data-fv')].s); }); });
  }

  function reviewsPage() {
    return '<div class="pg-h"><h1>Reviews</h1><p>Each review opens the Command Center with its lenses set. Conditions are the controls that must hold, with their latest evidence.</p></div>' +
      '<div class="rv">' + G.reviews.map(function (r) {
        var sts = r.conds.map(ctlState), met = sts.filter(function (s) { return s === 'ok'; }).length;
        return '<article class="card rvc"><div class="rvh"><span class="eyebrow">' + esc(r.id) + ' · ' + esc(byId(G.surfaces, r.s).label) + '</span><h2>' + esc(r.feature) + '</h2><span class="stage">' + esc(r.stage) + '</span></div>' +
          '<ul class="conds">' + r.conds.map(function (c, i) { return '<li>' + stTag(sts[i], sts[i] === 'ok' ? 'holds' : sts[i] === 'fail' ? 'failing' : sts[i] === 'warn' ? 'stale' : 'unproven') + ' ' + esc(name(c)) + '</li>'; }).join('') + '</ul>' +
          '<div class="rvf"><span class="count">' + met + ' of ' + r.conds.length + ' conditions proven</span><button class="btn ghost" data-sv="' + r.view + '">Open in Command Center</button></div></article>';
      }).join('') + '</div>';
  }
  function ctlClass(id) { var c = G.controls[id]; return c.result === 'fail' ? 'fail' : c.result === 'never' ? 'never' : freshness(c.last).k === 'stale' ? 'stale' : 'ok'; }
  function evidencePage() {
    var ids = Object.keys(G.controls), rank = { fail: 0, never: 1, stale: 2, ok: 3 };
    ids.sort(function (a, b) { return rank[ctlClass(a)] - rank[ctlClass(b)]; });
    var counts = { all: ids.length }; ids.forEach(function (i) { counts[ctlClass(i)] = (counts[ctlClass(i)] || 0) + 1; });
    var F2 = [['all', 'All'], ['fail', 'Failing'], ['never', 'Documented, not verified'], ['stale', 'Stale'], ['ok', 'Verified']];
    var shown = ids.filter(function (i) { return S.ev === 'all' || ctlClass(i) === S.ev; });
    var L = { fail: ['fail', 'failing'], never: ['unk', 'never tested'], stale: ['warn', 'stale'], ok: ['ok', 'verified'] };
    return '<div class="pg-h"><h1>Evidence</h1><p>One record per control: the invariant it promises, where it lives, and the last proof that it holds.</p></div>' +
      '<div class="seg evf" role="radiogroup" aria-label="Filter controls">' + F2.map(function (f) { return '<button role="radio" data-ev="' + f[0] + '" aria-checked="' + (S.ev === f[0]) + '">' + f[1] + ' <span>' + (counts[f[0]] || 0) + '</span></button>'; }).join('') + '</div>' +
      '<div class="evl">' + shown.map(function (id) {
        var c = G.controls[id], k = ctlClass(id), fr = freshness(c.last);
        return '<article class="card evc ev-' + k + '"><div class="evh"><h2>' + esc(name(id)) + '</h2>' + stTag(L[k][0], L[k][1]) + '</div><p class="inv">' + esc(c.inv) + '</p>' +
          '<dl class="evd"><div><dt>Where</dt><dd>' + esc(c.where) + '</dd></div><div><dt>Last test</dt><dd>' + esc(c.last || '—') + ' · ' + esc(fr.t) + '</dd></div><div><dt>Method</dt><dd>' + esc(c.method) + '</dd></div></dl>' +
          '<button class="linkbtn" data-open-ctl="' + esc(c.c[0]) + '">Did it really work? →</button></article>';
      }).join('') + '</div>';
  }

  /* ═══════════ ASK PRIVACY — deterministic, cites the graph ═══════════ */
  var ASK = [
    { q: 'Who can see precise location?', k: /location|gps/i, a: function () {
      var r = G.retention.filter(function (x) { return x.node === 'ds_loc'; })[0];
      return [['FACT', name('ds_loc') + ' holds precise location and is exported daily to the ' + name('sy_wh') + '.', ['ds_loc', 'sy_wh']],
        ['FACT', 'Kept ' + r.obs + ' days against a declared ' + r.dec + ' and a required ' + r.req + '.', ['c_ttl']],
        ['FACT', 'The assistant’s Location tool sees the current city only.', ['ag_assist']],
        ['INFERENCE', 'Late-evening points reveal a home area.', ['in_home']],
        ['RECOMMENDATION', 'Coarsen on device before export, and enforce the TTL.', ['c_ttl']],
        ['UNKNOWN', 'Whether any vendor receives location: no field list in the export contract.', ['v_adreach']]]; } },
    { q: 'Show every place this person’s data exists.', k: /every place|exists|copies/i, a: function () {
      return G.deletion.map(function (x) { return [x.st === 'unk' ? 'UNKNOWN' : 'FACT', x.n + ': ' + x.ev + (x.st === 'ok' ? ' (deleted)' : x.st === 'fail' ? ' (still present)' : x.st === 'wait' ? ' (pending expiry)' : ''), [x.node]]; })
        .concat([['RECOMMENDATION', 'Fan deletion out to every store keyed by her identifiers, and verify with a canary.', ['c_delete_orch']]]); } },
    { q: 'Which systems still use this user after consent revocation?', k: /consent|revok|opt.?out/i, a: function () {
      var R = G.consent.rows;
      return [['FACT', R.filter(function (r) { return r.st === 'ok'; }).map(function (r) { return r.n; }).join(' and ') + ' honour the revocation.', ['sy_consent']]].concat(
        R.filter(function (r) { return r.st !== 'ok' && r.node !== 'v_adreach'; }).map(function (r) { return ['FACT', r.n + ': ' + r.evidence + '.', [r.node]]; }),
        [['UNKNOWN', 'Whether AdReach applied the revocation: no acknowledgement.', ['v_adreach', 'c_vendor_ack']], ['RECOMMENDATION', 'Check consent at read and export time; push revocations to vendors.', ['c_consent_read']]]); } },
    { q: 'Show cross-tenant exposure.', k: /tenant|isolation/i, a: function () {
      return G.tenantChain.filter(function (h) { return h.st !== 'ok'; }).map(function (h) { return [h.st === 'fail' ? 'FACT' : 'UNKNOWN', h.n + ': ' + h.actual + ' (' + h.evidence + ').', [h.node]]; })
        .concat([['RECOMMENDATION', 'Enforce tenant scope in the query and the cache key; test with a foreign-tenant canary at every hop.', ['c_server_filter']]]); } },
    { q: 'What changed after these two datasets were joined?', k: /join|joined|two datasets/i, a: function () {
      return [['FACT', 'Before: ' + name('ds_behavior') + ' keyed by player_id; ' + name('ds_customer') + ' keyed by account.', ['ds_behavior', 'ds_customer']],
        ['FACT', 'After: one row holds ' + G.join.result.join(', ') + '.', ['in_profile']], ['INFERENCE', 'Spending by play style for a named person.', ['in_profile']],
        ['UNKNOWN', 'No approval exists for this join.', ['c_join_policy']], ['RECOMMENDATION', 'Aggregate before joining, or join in a purpose-checked environment.', ['c_join_policy']]]; } },
    { q: 'Which AI agents can access transaction data?', k: /agent.*(transaction|payment|wallet)|(transaction|payment|wallet).*agent/i, a: function () {
      var who = G.edges.filter(function (e) { return e[1] === 'ACCESSES' && e[2] === 'ds_txn'; }).map(function (e) { return e[0]; });
      return who.map(function (a) { return ['FACT', name(a) + ' can read transactions (' + G.agents[a].purpose.toLowerCase() + ').', [a, 'ds_txn']]; })
        .concat([['RECOMMENDATION', 'Scope the tool to the task’s merchant and dates.', ['c_agent_policy']]]); } },
    { q: 'What can this agent infer that no source explicitly stores?', k: /infer|agent/i, a: function () {
      var ag = G.agents.ag_assist; return [['FACT', 'Tools used: ' + ag.used.map(function (t) { return t[0]; }).join(', ') + '. Each is authorized.', ['ag_assist']],
        ['INFERENCE', ag.inference + ' No database stored that fact.', ag.infNodes], ['RECOMMENDATION', 'Cross-domain join policy and purpose checks at inference time; approval before booking.', ['c_agent_policy', 'c_agent_approval']],
        ['UNKNOWN', 'Whether the inference is kept in assistant memory.', ['ds_prompts']]]; } },
    { q: 'Which privacy controls are documented but not verified?', k: /documented|not verified|unverified|never tested/i, a: function () {
      return Object.keys(G.controls).filter(function (i) { return G.controls[i].result === 'never'; }).map(function (i) { return ['UNKNOWN', name(i) + ': ' + G.controls[i].method + '.', [i]]; })
        .concat([['RECOMMENDATION', 'Give each a runtime test before relying on it in a review.', []]]); } },
    { q: 'What does a site learn when she signs in with a passkey?', k: /passkey|sign.?in|login|authenticat/i, a: function () {
      var rp = byId(G.journeys, 'signin').hops.filter(function (h) { return h.n === 'Relying party'; })[0];
      return [['FACT', 'The site receives: ' + rp.obs.toLowerCase() + '.', ['sy_rp']], ['FACT', 'Each site gets its own key pair, so the credential does not link sites.', ['c_rp_scope']],
        ['FACT', 'Recovery still falls back to an SMS code.', ['c_recovery']], ['RECOMMENDATION', 'Recover with another device or a recovery key.', ['c_recovery']], ['UNKNOWN', 'Whether session tokens are bound to the device: never tested.', ['c_session']]]; } },
    { q: 'What happens if someone steals her account?', k: /steal|stolen|takeover|take over|hijack|malware|extension|phish|sim swap|scam/i, a: function () {
      return G.takeover.map(function (t) { return ['FACT', t.label + ': ' + t.how + ' It reaches ' + t.gets.length + ' of ' + G.oneLife.surfaces.length + ' surfaces. ' + t.mfa, [t.ctl]]; })
        .concat([['INFERENCE', 'Browser, mail and wallet on one account add up to one life.', ['sy_account', 'in_profile']],
          ['RECOMMENDATION', 'Passkeys, device-bound sessions, extension review and recovery without SMS.', ['c_passkey', 'c_dbsc', 'c_ext_review', 'c_recovery']],
          ['UNKNOWN', 'Whether a session was ever copied: nothing records a cookie leaving the device.', ['sy_account']]]); } },
    { q: 'What leaves the device when she uses the assistant?', k: /leave|device|assistant|private compute|on.?device/i, a: function () {
      return G.routing.requests.map(function (r) { return [/Unknown/.test(r.retained) ? 'UNKNOWN' : 'FACT', r.r + ': runs ' + ({ device: 'on device', private: 'in private compute', third: 'at a third party' })[r.zone] + '; leaves: ' + r.leaves.toLowerCase() + '; retained: ' + r.retained.toLowerCase() + '.', [r.zone === 'device' ? 'sy_odm' : r.zone === 'private' ? 'sy_pcc' : 'v_llm']]; })
        .concat([['RECOMMENDATION', 'Ask before any third-party hand-off and send the minimum prompt.', ['c_no_train']]]); } }
  ];
  var KORDER = { FACT: 0, INFERENCE: 1, RECOMMENDATION: 2, UNKNOWN: 3 };
  function answer(text) {
    var hit = null; ASK.forEach(function (x) { if (!hit && x.q.toLowerCase() === text.toLowerCase()) hit = x; });
    if (!hit) ASK.forEach(function (x) { if (!hit && x.k.test(text)) hit = x; });
    if (!hit) return { q: text, lines: [['UNKNOWN', 'The graph holds no records that answer this, so there is no answer to give. Try one of the questions below.', []]] };
    return { q: hit.q, lines: hit.a().sort(function (a, b) { return KORDER[a[0]] - KORDER[b[0]]; }) };
  }
  G.answer = answer;
  function askPage() {
    var a = S.ask ? answer(S.ask) : null;
    return '<div class="pg-h"><h1>Ask privacy</h1><p>Answers come from the graph. Each line says whether it is a fact, an inference, a recommendation or unknown, and names its records. Nothing is made up to fill a gap.</p></div>' +
      '<form class="askf" id="askF"><label for="askI" class="sr-only">Ask a privacy question</label><input id="askI" value="' + esc(S.ask) + '" placeholder="Ask privacy…" autocomplete="off"><button class="btn" type="submit">Ask</button></form>' +
      '<div class="asks-l">' + ASK.map(function (x) { return '<button class="chip" data-ask="' + esc(x.q) + '">' + esc(x.q) + '</button>'; }).join('') + '</div>' +
      (a ? '<section class="card ans" aria-live="polite"><h2>' + esc(a.q) + '</h2>' + a.lines.map(function (l) { return '<div class="al">' + tag(l[0]) + '<div><p>' + esc(l[1]) + '</p>' + (l[2].length ? '<p class="cite">' + l[2].map(function (c) { return esc(name(c)); }).join(' · ') + '</p>' : '') + '</div></div>'; }).join('') + '</section>' : '');
  }

  /* ═══════════ render ═══════════ */
  function render() {
    document.body.classList.toggle('fm', S.fm);
    $$('.nav a').forEach(function (a) { var on = a.getAttribute('data-page') === S.page; if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); a.href = hashFor(Object.assign({}, S, { page: a.getAttribute('data-page') })); });
    var fb = $('#fmBtn'); fb.setAttribute('aria-pressed', S.fm); fb.textContent = S.fm ? 'Exit focus' : 'Focus mode';
    $('#vm').innerHTML = '<button class="tb" id="vmBtn" aria-haspopup="true" aria-expanded="false" aria-controls="vmPop">Views ▾</button>' + viewsMenu();
    var main = $('#main');
    try {
      main.innerHTML = S.page === 'reviews' ? reviewsPage() : S.page === 'evidence' ? evidencePage() : S.page === 'ask' ? askPage() : ccPage();
      if (S.page === 'cc') mountCC();
      $$('[data-ev]', main).forEach(function (b) { b.addEventListener('click', function () { focusAfter = null; set({ ev: b.getAttribute('data-ev') }); }); });
      $$('[data-open-ctl]', main).forEach(function (b) { b.addEventListener('click', function () { set({ page: 'cc', q: 'control', c: [b.getAttribute('data-open-ctl')] }); window.scrollTo(0, 0); }); });
      var f = $('#askF'); if (f) f.addEventListener('submit', function (e) { e.preventDefault(); set({ ask: $('#askI').value.trim() }); });
      $$('[data-ask]', main).forEach(function (b) { b.addEventListener('click', function () { set({ ask: b.getAttribute('data-ask') }); }); });
    } catch (err) {
      main.innerHTML = '<div class="card err" role="alert"><h2>This view could not be drawn</h2><p>' + esc(err.message) + '</p><p><a href="#cc">Back to the Command Center</a></p></div>';
      if (window.console) console.error(err);
    }
    $$('[data-sv]').forEach(function (b) { b.addEventListener('click', function () { apply(byId(G.saved, b.getAttribute('data-sv')).s); window.scrollTo(0, 0); }); });
    $$('[data-mv]').forEach(function (b) { b.addEventListener('click', function () { apply(loadSaved()[+b.getAttribute('data-mv')].s); }); });
    $$('[data-mx]').forEach(function (b) { b.addEventListener('click', function () { var m = loadSaved(); m.splice(+b.getAttribute('data-mx'), 1); storeSaved(m); render(); }); });
    $('#saveView').addEventListener('click', function () {
      var m = loadSaved(), label = byId(G.personas, S.p).label + ' · ' + byId(G.questions, S.q).label.replace('?', '');
      m.push({ label: label, s: { p: S.p, s: S.s, j: S.j, q: S.q, c: S.c.slice(), subj: S.u } }); storeSaved(m); render(); $('#status').textContent = 'Saved “' + label + '”';
    });
    $('#vmBtn').addEventListener('click', function () { var p = $('#vmPop'), open = p.hidden; p.hidden = !open; this.setAttribute('aria-expanded', open); if (open) $('.vm-i', p).focus(); });
    if (focusAfter) { var el = document.getElementById(focusAfter); if (el) el.focus(); focusAfter = null; }
  }

  document.addEventListener('click', closePop, true);
  $('#fmBtn').addEventListener('click', function () { set({ fm: !S.fm }); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      var pop = $('#msPop'); if (pop && !pop.hidden) { pop.hidden = true; $('#selC').setAttribute('aria-expanded', 'false'); $('#selC').focus(); }
      var vm = $('#vmPop'); if (vm && !vm.hidden) { vm.hidden = true; $('#vmBtn').setAttribute('aria-expanded', 'false'); $('#vmBtn').focus(); }
    }
    if (e.target.closest('input,select,textarea') || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === '/') { e.preventDefault(); set({ page: 'ask' }); var i = $('#askI'); if (i) i.focus(); }
    if (S.fm && S.page === 'cc' && /^[123]$/.test(e.key)) apply(G.focus[+e.key - 1].s);
  });
  S = parse();
  if (!/^#(cc|reviews|evidence|ask)/.test(location.hash)) history.replaceState(null, '', hashFor(S));
  render();
  window.PCC1 = { offered: offered, state: function () { return copy(S); }, resolve: resolve, findings: function () { return findingsFor(S, resolve(S)).list.map(function (f) { return f.id; }); }, set: set };
})();
