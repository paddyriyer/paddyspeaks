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
  var PAGES = ['cc', 'products', 'everyday', 'layers', 'sensors', 'future', 'ai', 'reviews', 'evidence', 'ask'];
  var M = null;   /* the modes (modes.js): Products, Everyday arrows, Every layer, Future, AI, Reviews */
  var DEF = { page: 'cc', p: 'reviewer', s: 'all', j: 'signin', q: 'know', c: [], u: 'person', l: 'all', fm: false, ask: '', ev: 'all', et: 'day', e: '', eco: 'all', dv: '' };
  var S = copy(DEF);
  function copy(o) { return JSON.parse(JSON.stringify(o)); }
  function parse() {
    var h = location.hash.replace(/^#/, ''), parts = h.split('?'), page = parts[0] || 'cc', q = {};
    (parts[1] || '').split('&').forEach(function (kv) { if (!kv) return; var i = kv.indexOf('='); if (i > 0) q[decodeURIComponent(kv.slice(0, i))] = decodeURIComponent(kv.slice(i + 1)); });
    var st = copy(DEF);
    st.page = PAGES.indexOf(page) >= 0 ? page : 'cc';
    /* the events layer moved from the Command Center to Everyday arrows; old links follow it */
    if (st.page === 'cc' && (q.e || q.et || q.eco || q.dv)) st.page = 'everyday';
    if (byId(G.personas, q.p)) st.p = q.p;
    if (byId(G.surfaces, q.s)) { st.s = q.s; st.j = byId(G.surfaces, q.s).j; }
    if (byId(G.journeys, q.j)) st.j = q.j;
    if (byId(G.questions, q.q)) st.q = q.q;
    if (q.c) st.c = q.c.split(',').filter(function (c) { return byId(G.concerns, c); });
    if (byId(G.subjects, q.u)) st.u = q.u;
    if (q.l === 'both') st.l = 'all'; else if (G.lenses[q.l]) st.l = q.l;
    st.fm = q.fm === '1'; st.ask = q.ask || ''; st.ev = q.ev || 'all';
    var EVD = G.events;
    if (['day', 'cases', 'all', 'changes', 'eco', 'amb'].indexOf(q.et) >= 0) st.et = q.et;
    if (EVD.ecos.some(function (x) { return x.id === q.eco; })) st.eco = q.eco;
    if (EVD.validDv(q.dv) && q.dv !== EVD.dvDefault) st.dv = q.dv;
    if (q.e && st.et !== 'eco' && st.et !== 'amb' && (st.et === 'day' ? EVD.day.events.some(function (x) { return x.id === q.e; }) : st.et === 'cases' ? EVD.caseById(q.e) : st.et === 'all' ? EVD.type(q.e) : EVD.changeById(q.e))) st.e = q.e;
    if (M) M.parseInto(q, st);
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
    var q = 'p=' + st.p + '&s=' + st.s + '&j=' + st.j + '&q=' + st.q + (st.c.length ? '&c=' + st.c.join(',') : '') + '&u=' + st.u + (st.l !== 'all' ? '&l=' + st.l : '') + (st.fm ? '&fm=1' : '');
    if (st.page === 'ask' && st.ask) q += '&ask=' + encodeURIComponent(st.ask);
    if (st.page === 'evidence' && st.ev !== 'all') q += '&ev=' + st.ev;
    if (st.page === 'everyday') q += (st.et !== 'day' ? '&et=' + st.et : '') + (st.e ? '&e=' + st.e : '') + (st.eco !== 'all' ? '&eco=' + st.eco : '') + (st.dv ? '&dv=' + st.dv : '');
    var mq = M ? M.hashOf(st) : ''; if (mq) q += '&' + mq;
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
  var CTL_BY_CONCERN = { tenant: 'tenant', consent: 'consent', vendor: 'consent', deletion: 'delete', retention: 'delete', access: 'access', minimization: 'pay', agent: 'agent', inference: 'agent', purpose: 'agent', linkability: 'link', tracking: 'link', identity: 'auth', authentication: 'auth', devicetrust: 'auth', recovery: 'auth', disclosure: 'sd', ondevice: 'route', thirdmodel: 'route', logging: 'log', takeover: 'account', recoverability: 'keydestroy', keylifecycle: 'keydestroy', preservation: 'hold' };
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
      /* across time */
      case 'recover': v.kind = 'recover'; v.key = 'recover'; break;
      case 'recneeds': v.kind = 'transform'; v.tab = st.s === 'pay' ? 'token' : 'encrypt'; v.key = 'recneeds'; break;
      case 'match': v.kind = 'transform'; v.tab = st.s === 'pay' ? 'token' : st.s === 'vendor' || st.s === 'ident' ? 'hash' : 'pseudo'; v.key = 'match'; break;
      case 'keygone': v.kind = 'keygone'; v.key = 'keygone'; break;
      case 'hold': v.kind = 'hold'; v.key = 'hold'; break;
      case 'holdworked': v.kind = 'preserve'; v.key = 'holdworked'; break;
      case 'unrecoverable': v.kind = 'control'; v.ctl = 'keydestroy'; v.key = 'ctl-keydestroy'; break;
    }
    if (v.kind === 'agent') v.agent = agentFor(st);
    v.principle = G.principles[G.principleFor[v.key] || (v.ctl && G.principleFor['ctl-' + v.ctl])] || '';
    return v;
  }

  /* ── shared bits ───────────────────────────────────────── */
  var KCLS = { FACT: 'k-fact', INFERENCE: 'k-inf', UNKNOWN: 'k-unk', 'CONTROL FAILURE': 'k-fail', RECOMMENDATION: 'k-rec', RISK: 'k-fail', 'DESIGN QUESTION': 'k-inf', DECISION: 'k-rec', DOCUMENTED: 'k-doc', SETTING: 'k-set', LIMIT: 'k-lim', TEST: 'k-test' };
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
    var I = G.identity, H = 56;
    var inS = function (s) { return st.s === 'all' || s.s.indexOf(st.s) >= 0; };
    /* one drawing, two layouts: wide for desktop, tall (two columns, profile below) for phones */
    function draw(L) {
      var W = L.w, pos = L.pos, P = L.P, mid = function (k) { return [pos[k][0] + W / 2, pos[k][1] + H / 2]; };
      var svg = '<svg viewBox="0 0 ' + L.vw + ' ' + L.vh + '" class="idg ' + L.cls + '" role="img" aria-labelledby="' + L.tid + '"><title id="' + L.tid + '">Six signals about one synthetic person. Connected, shared identifiers turn them into one profile.</title>';
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
      return svg + '</svg>';
    }
    var svg = draw({ cls: 'idg-wide', tid: 'idgT', vw: 700, vh: 300, w: 160, P: [350, 130], pos: { phone: [20, 20], behavior: [20, 130], payment: [20, 240], device: [520, 20], browser: [520, 130], login: [520, 240] } }) +
      draw({ cls: 'idg-tall', tid: 'idgT2', vw: 380, vh: 440, w: 146, P: [190, 400], pos: { phone: [4, 10], behavior: [4, 150], payment: [4, 290], device: [230, 10], browser: [230, 150], login: [230, 290] } });
    var cols = ['collected', 'derived', 'inferred'].map(function (k) { return '<div class="pcol"><div class="eyebrow">' + k + '</div>' + I.profile.filter(function (x) { return x[0] === k; }).map(function (x) { return '<p>' + esc(x[1]) + '</p>'; }).join('') + '</div>'; }).join('');
    return {
      head: 'Separate signals about ' + name('p_dana'),
      tools: '<button class="btn" data-act="connect" aria-pressed="false">Connect the dots</button>',
      body: '<div class="idwrap" tabindex="0" role="region" aria-label="Identity graph">' + svg + '</div><p class="ppre">Connected, these signals become one profile: what was collected, what was derived, and what was inferred.</p><div class="pcols">' + cols + '</div><p class="keyq">Was this linkage necessary and permitted for the intended purpose?</p>' + overTime(st),
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
          var cs = h.ctl && G.controls[h.ctl], proof = cs ? (cs.result === 'never' ? 'UNKNOWN: ' + name(h.ctl) + ' has never been tested' : name(h.ctl) + ': ' + cs.method + (cs.last ? ' · ' + cs.last : '')) : 'UNKNOWN: no control recorded on this arrow';
          var sec = [['Security control', h.sec || 'None recorded']], qa4 = [['How would anyone know?', proof]], gov4 = [['Who holds it after this hop?', ZONE[h.z] + ': ' + h.n]];
          var rows = st.l === 'security' ? [['What moved?', h.mv]].concat(sec) : st.l === 'qa' ? [['What moved?', h.mv]].concat(qa4) : st.l === 'gov' ? [['What moved?', h.mv]].concat(gov4) : st.l === 'all' ? priv.concat(sec, qa4, gov4) : priv;
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
    G.journeys.forEach(function (j) { j.hops.forEach(function (h, i) { if (i && h.sc === 'stable' && h.z !== 'device') { var e = everywhere[h.id] = everywhere[h.id] || []; if (e.indexOf(j.label) < 0) e.push(j.label); } }); });
    var multi = Object.keys(everywhere).filter(function (k) { return everywhere[k].length > 1; });
    var SC = { stable: ['st-fail', 'stable'], scoped: ['st-ok', 'scoped'], none: ['st-ok', 'none'] };
    return {
      head: 'Identifiers on the journey: ' + J.label,
      body: '<ul class="idl">' + seen.map(function (h) { var s = SC[h.sc] || SC.none; return '<li><span class="idn">' + esc(h.id) + '</span><span class="st ' + s[0] + '">' + s[1] + '</span><span class="idw">seen by ' + esc(h.n) + ' · ' + esc(ZONE[h.z]) + '</span></li>'; }).join('') + '</ul>' +
        (multi.length ? '<div class="corr"><div class="eyebrow">Stable identifiers that appear in more than one journey</div>' + multi.map(function (k) { return '<p><b>' + esc(k) + '</b>: ' + everywhere[k].map(esc).join(', ') + '</p>'; }).join('') + '</div>' : '') +
        '<p class="keyline">A stable identifier seen by more than one party is how unrelated activity becomes one profile.</p>' + overTime(st)
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
  function tlSVG(rows, revokedAt, tall) {
    /* wide: one row per system, time across. tall (phones): the label sits above its track. */
    var VW = tall ? 420 : 1000, X0 = tall ? 26 : 230, X1 = tall ? 330 : 960, T1 = 45, RH = tall ? 64 : 40, TOP = tall ? 50 : 40, tx = function (m) { return X0 + m / T1 * (X1 - X0); }, hh = function (m) { var t = 590 + m; return ('0' + Math.floor(t / 60)).slice(-2) + ':' + ('0' + t % 60).slice(-2); };
    var bottom = TOP + rows.length * RH - (tall ? 10 : 0);
    var s = '<svg viewBox="0 0 ' + VW + ' ' + (bottom + 30) + '" class="tl ' + (tall ? 'tl-tall' : 'tl-wide') + '" role="img" aria-labelledby="' + (tall ? 'tlT2' : 'tlT') + '"><title id="' + (tall ? 'tlT2' : 'tlT') + '">Consent revoked at ' + hh(revokedAt) + '. Local systems honour it; downstream systems keep acting on old state.</title>';
    [0, 10, 20, 30, 40].forEach(function (m) { s += '<line class="grid" x1="' + tx(m) + '" x2="' + tx(m) + '" y1="' + (tall ? 36 : 26) + '" y2="' + bottom + '"/><text class="ax" x="' + tx(m) + '" y="' + (bottom + 18) + '" text-anchor="middle">' + hh(m) + '</text>'; });
    s += '<line class="nowb" x1="' + tx(5) + '" x2="' + tx(5) + '" y1="' + (tall ? 6 : 26) + '" y2="' + bottom + '"/><text class="nowbt" x="' + (tall ? tx(5) + 6 : tx(5) - 6) + '" y="14"' + (tall ? '' : ' text-anchor="end"') + '>BATCH STARTS · ' + hh(5) + '</text>';
    s += '<line class="nowl" x1="' + tx(revokedAt) + '" x2="' + tx(revokedAt) + '" y1="' + (tall ? 22 : 16) + '" y2="' + bottom + '"/><text class="nowt" x="' + (tx(revokedAt) + 6) + '" y="' + (tall ? 31 : 14) + '">USER REVOKES · ' + hh(revokedAt) + '</text>';
    rows.forEach(function (r, i) {
      var y = TOP + 8 + i * RH, ly = tall ? y : y, py = tall ? y + 30 : y, w = r.p.length * 7.4 + 18, x = tx(r.at) - (r.from != null ? w : w / 2);
      s += '<g class="tr" data-i="' + i + '"><text class="rl" x="8" y="' + ly + '">' + esc(r.n.toUpperCase()) + '</text><text class="rs" x="' + (tall ? 8 + r.n.length * 8 + 8 : 8) + '" y="' + (tall ? ly : ly + 15) + '">' + esc(r.note) + '</text>';
      if (r.from != null) s += '<rect class="batch" x="' + tx(r.from) + '" y="' + (py - 12) + '" width="' + (tx(r.at) - tx(r.from)) + '" height="22" rx="5"/>';
      s += '<g class="pill pill-' + r.st + '"><rect x="' + x + '" y="' + (py - 11) + '" width="' + w + '" height="21" rx="5"/><text x="' + (x + w / 2) + '" y="' + (py + 4) + '" text-anchor="middle">' + esc(r.p) + '</text></g><text class="ax" x="' + (x + w + 8) + '" y="' + (py + 4) + '">' + (r.from != null ? hh(r.from) + '–' + hh(r.at) : hh(r.at)) + '</text></g>';
    });
    return s + '</svg>';
  }

  V.consent = function () {
    var R = G.consent.rows, local = worst(R.slice(0, 2).map(function (r) { return r.st; })), sys = worst(R.map(function (r) { return r.st; }));
    return {
      head: 'A “no”, followed through the system',
      tools: '<button class="btn ghost" data-act="replay">Replay</button>',
      body: verdict(local, sys) + '<div class="tlw" tabindex="0" role="region" aria-label="Consent timeline">' + tlSVG(R, G.consent.revokedAt) + tlSVG(R, G.consent.revokedAt, true) + '</div><p class="keyline">Consent is distributed state, not a checkbox.</p><p class="aside">The customer said no. The batch job said, “I was already on the freeway.”</p>',
      mount: function (root) {
        var t = [];
        $('[data-act="replay"]', root).addEventListener('click', function () {
          t.forEach(clearTimeout); t = [];
          var g = $$('.tr', root), order = R.map(function (r, i) { return i; }).sort(function (a, b) { return R[a].at - R[b].at || a - b; });
          g.forEach(function (e) { e.classList.add('hide'); });
          order.forEach(function (i, k) { t.push(setTimeout(function () { $$('.tr[data-i="' + i + '"]', root).forEach(function (e) { e.classList.remove('hide'); }); }, RM ? 0 : 200 + k * 450)); });
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
        '<p class="count">' + n + ' of ' + D.length + ' locations verified deleted</p>' + overTime(S, true) + '<p class="keyline">Deletion is a distributed-systems problem disguised as a button.</p><p class="keyq">Can we prove every relevant copy was deleted, detached, or expired?</p>',
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
    if (G.chains[id]) return G.chains[id];
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
  var CHANGE_Q = { 'new control failure': 'control', 'new AI tool access': 'agentdo', 'new join': 'join', 'retention increase': 'live', 'new vendor': 'where', 'new destination': 'where', 'new identifier': 'linkid', 'new dataset': 'live', 'copy outlived its key': 'unrecoverable', 'key schedule': 'keygone', 'legal hold placed': 'hold' };
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

  /* ═══════════ ACROSS TIME: what must still be possible in the future? ═══════════
   * Recover · match · produce · preserve · verify · delete · make unrecoverable.
   * The same graph, followed across years: keys, transformations, schema, holds. */
  var TSTATE = { ok: 'ok', fail: 'fail', unk: 'unk', warn: 'warn' };
  function all3(states) { return states.indexOf('fail') >= 0 ? 'fail' : states.indexOf('unk') >= 0 || states.indexOf('warn') >= 0 ? 'unk' : 'ok'; }
  function yn(st, yes, no, unk) { return st === 'ok' ? yes : st === 'fail' ? no : unk; }
  function mark(st, txt) { return '<span class="mk mk-' + (TSTATE[st] || 'unk') + '"><i aria-hidden="true">' + (st === 'ok' ? '✓' : st === 'fail' ? '✕' : '?') + '</i>' + esc(txt) + '</span>'; }
  /* the same fact, technical and in one sentence; the executive reads the sentence first */
  function say(st, pair) {
    return st.p === 'executive' ? '<div class="say"><p class="say-e">' + esc(pair[1]) + '</p><p class="say-t"><span class="eyebrow">Technical</span> ' + esc(pair[0]) + '</p></div>'
      : '<div class="say"><p class="say-t">' + esc(pair[0]) + '</p><p class="say-e"><span class="eyebrow">In one sentence</span> ' + esc(pair[1]) + '</p></div>';
  }
  function futureStrip(caps) {
    return '<div class="fut"><div class="eyebrow">What must still be possible</div><ul>' + caps.map(function (c) {
      return '<li class="fut-i f-' + c[1] + '"><b>' + esc(c[0]) + '</b><span>' + esc(c[2] || (c[1] === 'ok' ? 'possible' : c[1] === 'fail' ? 'not possible' : 'unproven')) + '</span></li>'; }).join('') + '</ul></div>';
  }
  function statusRow(items) { return '<div class="rstat">' + items.map(function (x) { return '<div class="rs rs-' + x[1] + '"><span>' + esc(x[0]) + '</span><b>' + esc(x[2]) + '</b></div>'; }).join('') + '</div>'; }
  function vchain(nodes) { return '<div class="chain tchain">' + nodes.map(function (n, i) { return (i ? '<span class="arr static' + (n[2] ? ' a-' + n[2] : '') + '" aria-hidden="true"></span>' : '') + '<div class="nd' + (n[3] ? ' ' + n[3] : '') + '">' + esc(n[0]) + (n[1] ? '<small>' + esc(n[1]) + '</small>' : '') + '</div>'; }).join('') + '</div>'; }
  function qa(rows) { return '<dl class="five">' + rows.map(function (r) { return '<div><dt>' + esc(r[0]) + '</dt><dd' + (r[2] ? ' class="' + r[2] + '"' : '') + '>' + esc(r[1]) + '</dd></div>'; }).join('') + '</dl>'; }
  function holdsCovering(id) { return G.holds.filter(function (h) { return h.status === 'active' && h.items.some(function (it) { return it[1] === id && it[2] === 'held'; }); }); }
  function tf(node) { return G.transforms.filter(function (t) { return t.node === node; })[0]; }

  /* Can this data be recovered? — the five-year archive */
  V.recover = function (st) {
    var A = G.archive, m = 'asis';
    function stOf(node) { var d = A.deps.filter(function (x) { return x.node === node; })[0]; return d.st[m]; }
    function draw(root) {
      $$('[data-am]', root).forEach(function (b) { b.setAttribute('aria-checked', b.getAttribute('data-am') === m); });
      var exists = stOf('ds_archive'), key = stOf('k_2026'), rec = all3([exists, key]), match = all3([stOf('k_pseudo'), stOf('nr_v3')]), produce = all3([rec, stOf('sc_v14'), stOf('sy_vault')]);
      var W = { ok: 'available', fail: 'destroyed', unk: 'not verified' };
      $('#ar-res', root).innerHTML =
        '<ol class="deps">' + A.deps.map(function (d, i) { var s = d.st[m]; return '<li class="dep d-' + s + '"><span class="dep-rel">' + (i ? esc(d.rel) : 'Archive ' + esc(A.id)) + '</span><b>' + esc(d.n) + '</b>' + mark(s, d.node === 'ds_archive' ? (s === 'ok' ? 'exists' : 'missing') : W[s]) + '</li>'; }).join('') + '</ol>' +
        statusRow([['Data exists', exists, yn(exists, 'Yes', 'No', 'Unknown')], ['Recoverable', rec, yn(rec, 'Yes', 'Failed', 'Unproven')], ['Matchable', match, yn(match, 'Yes', 'Failed', 'Unproven')]]) +
        futureStrip([['Recover', rec], ['Match', match], ['Produce', produce], ['Preserve', all3(A.deps.map(function (d) { return d.st[m]; }))], ['Verify', all3([exists, stOf('lin_arch')])], ['Delete', stOf('lin_arch'), stOf('lin_arch') === 'ok' ? 'every copy traced' : null],
          key === 'fail' ? ['Make unrecoverable', 'warn', 'already, unplanned'] : ['Make unrecoverable', all3([key, stOf('lin_arch')]), key === 'ok' ? 'destroy K-2026 at the end of retention' : null]]) +
        say(st, A.say[m]);
    }
    return {
      head: 'The five-year archive: can it still be used?',
      body: '<ol class="story">' + A.story.map(function (r) { return '<li><b>' + esc(r[0]) + '</b><span>' + esc(r[1]) + '</span></li>'; }).join('') + '</ol>' +
        '<div class="seg" role="radiogroup" aria-label="When we look">' + A.modes.map(function (x) { return '<button role="radio" data-am="' + x[0] + '" aria-checked="' + (x[0] === m) + '">' + esc(x[1]) + '</button>'; }).join('') + '</div>' +
        '<div id="ar-res" aria-live="polite"></div><p class="keyline">Data existence and data usability are different states.</p>',
      mount: function (root) { root.addEventListener('click', function (e) { var b = e.target.closest('[data-am]'); if (b) { m = b.getAttribute('data-am'); draw(root); } }); draw(root); }
    };
  };

  /* What is required to recover it? / Can we still match this person? — four transformations */
  var TAB_PRINCIPLE = { encrypt: 'readable', hash: 'hashed', pseudo: 'keylife', token: 'protect' };
  var TABS = [['encrypt', 'Encrypted'], ['hash', 'Hashed'], ['pseudo', 'Keyed pseudonym'], ['token', 'Tokenized']];
  V.transform = function (st, view) {
    var t = view.tab, ed = 'ds_archive', killed = {}, cand = '', pk = { key: true, rule: true, ver: true };
    var encs = G.transforms.filter(function (x) { return x.type === 'encrypted' || x.type === 'shredded'; });
    function encHTML() {
      var T = tf(ed), K = G.keys[T.key], gone = !!K.destroyed || killed[T.key], held = holdsCovering(T.key);
      var keySt = gone ? 'fail' : 'ok';
      return '<div class="seg" role="radiogroup" aria-label="Encrypted dataset">' + encs.map(function (x) { return '<button role="radio" data-ed="' + x.node + '" aria-checked="' + (x.node === ed) + '">' + esc(name(x.node)) + '</button>'; }).join('') + '</div>' +
        vchain([[name(T.node), 'dataset'], [name(T.key), K.type, gone ? 'fail' : '', gone ? 'bad' : ''], [name(K.owner), 'key owner'], [name(K.store), 'key store / HSM'], [gone ? 'No recovery path' : 'Decrypt through the KMS role', 'recovery path', gone ? 'fail' : '', gone ? 'bad' : '']]) +
        statusRow([['Data exists', 'ok', 'Yes'], ['Key exists', keySt, gone ? 'No' : 'Yes'], ['Recoverable', keySt, gone ? 'No' : 'Yes']]) +
        (K.destroyed ? '' : '<button class="btn ghost" data-kill="' + T.key + '" aria-pressed="' + !!killed[T.key] + '">' + (killed[T.key] ? 'Undo: keep the key' : 'What if ' + esc(name(T.key)) + ' is destroyed?') + '</button>') +
        qa([['Who holds the key?', name(K.owner) + ', in the ' + name(K.store)], ['Can the service operator decrypt?', gone ? 'No: the key is gone' : K.operator], ['Can a customer-controlled key be used?', K.cmk],
          ['When was the key created?', K.created], ['When was it rotated?', K.rotated || 'Not yet'], ['Was the historical key retained?', K.destroyed ? 'No: destroyed on ' + K.destroyed : K.retained ? 'Yes' : 'No'],
          ['Is the key itself under preservation hold?', held.length ? 'Yes: ' + held.map(function (h) { return name(h.id); }).join(', ') : 'No', held.length && gone ? 'red' : '']]) +
        '<p class="note">Encrypted data without an available key may be operationally equivalent to deleted data. Whether that meets a deletion obligation is a separate, legal question.</p>';
    }
    function hashHTML() {
      var T = tf('id_hash'), norm = G.normalize[T.norm], stored = G.oneWay(norm(G.subjectEmail)), c = cand ? G.oneWay(norm(cand)) : '';
      return vchain([['Original value', 'an email address'], ['Hash function', T.alg + ' · ' + T.ver], [stored, 'the hash in ' + T.where]]) +
        statusRow([['Decrypt', 'fail', 'None'], ['Reversible', 'fail', 'No'], ['Matchable', 'warn', 'Yes, by comparison']]) +
        '<div class="cand"><div class="eyebrow">Try a match</div><form data-cand><label for="candI">A value you already know</label><input id="candI" value="' + esc(cand) + '" placeholder="an email you already know" autocomplete="off"><button class="btn" type="submit">Same transformation, then compare</button></form>' +
        (cand ? '<p class="cmp">' + esc(cand) + ' → ' + esc(c) + ' ' + (c === stored ? mark('fail', 'matches the stored hash') : mark('ok', 'no match')) + '</p>' : '') + '</div>' +
        '<p class="keyline">One-way does not necessarily mean unlinkable.</p><p class="aside">If the inputs are predictable, or drawn from a limited population such as a customer list, anyone holding likely values can apply the same transformation and compare.</p>';
    }
    function pseudoHTML() {
      var T = tf('id_pseudo'), stored = G.keyedPseudonym(name(T.key), T.norm, G.subjectEmail);
      var rule = pk.rule ? T.norm : 'NORMALIZATION-v2', mine = cand && pk.key ? G.keyedPseudonym(name(T.key), rule, cand) : '';
      var repro = pk.key && pk.rule && pk.ver ? 'ok' : 'fail';
      return vchain([['Email / identifier', 'the input'], ['Normalize', T.norm], ['Keyed transformation', name(T.key) + ' · ' + T.alg + ' · ' + T.ver], [stored, 'pseudonymous ID']]) +
        statusRow([['Reversible', 'fail', 'No'], ['Repeatable match', repro, repro === 'ok' ? 'Yes' : 'Not today']]) +
        '<p class="small">Repeatable match: yes, if the historical key and rules exist.</p>' +
        '<div class="seg tg" role="group" aria-label="What was kept">' + [['key', name(T.key) + ' still available'], ['rule', 'Normalization rule recorded'], ['ver', 'Key version recorded']].map(function (x) { return '<button data-pk="' + x[0] + '" aria-pressed="' + pk[x[0]] + '">' + esc(x[1]) + '</button>'; }).join('') + '</div>' +
        '<div class="cand"><form data-cand><label for="candI">Reproduce for a known customer</label><input id="candI" value="' + esc(cand) + '" placeholder="the customer’s email" autocomplete="off"><button class="btn" type="submit">Reproduce the ID</button></form>' +
        (cand ? '<p class="cmp">' + (pk.key ? esc(mine) + ' ' + (mine === stored ? mark('ok', 'same ID: matched') : mark('fail', 'different ID: no match' + (pk.rule ? '' : ': the rule was guessed (v2)'))) : mark('fail', 'cannot compute: the key is gone')) + '</p>' : '') + '</div>' +
        qa([['Which key version created this ID?', pk.ver ? name(T.key) : 'Unknown: not recorded', pk.ver ? '' : 'red'], ['Is the key still available?', pk.key ? 'Yes: ' + G.keys[T.key].status : 'No', pk.key ? '' : 'red'],
          ['Which normalization rule was used?', pk.rule ? T.norm + ' (' + G.nodes.nr_v3[2] + ')' : 'Unknown: not recorded', pk.rule ? '' : 'red'], ['Was the algorithm and version recorded?', T.alg + ', ' + T.ver],
          ['Can we reproduce the same identifier today?', repro === 'ok' ? 'Yes' : 'No', repro === 'ok' ? '' : 'red']]) +
        '<p class="keyline">Key lifecycle can become data lifecycle.</p>';
    }
    function tokenHTML() {
      var M = G.tokenMap, longer = M.mapDays > M.tokDays;
      return vchain([['Personal data', 'card reference'], [M.token, 'token in ' + M.reuse.map(name).join(' and ')]]) +
        '<div class="vault"><div class="eyebrow">' + esc(name(M.vault)) + '</div><p><b>' + esc(M.token) + '</b> ↔ original card reference</p></div>' +
        statusRow([['Reversible', 'warn', 'Through the vault'], ['Mapping outlives tokens', longer ? 'fail' : 'ok', longer ? 'Yes' : 'No'], ['Mapping held', M.held ? 'ok' : 'fail', M.held ? 'Yes' : 'No']]) +
        qa([['Who can access the vault?', M.access], ['Does the application need the original value?', M.needOriginal], ['Is the mapping retained longer than the token?', longer ? 'Yes: mapping ' + M.mapRet + ', tokens ' + M.tokRet : 'No', longer ? 'red' : ''],
          ['Does legal preservation include the mapping?', M.held ? 'Yes: ' + holdsCovering(M.vault).map(function (h) { return name(h.id); }).join(', ') : 'No'],
          ['Can the token be reused across systems?', M.reuse.length > 1 ? 'Yes: the same token in ' + M.reuse.map(name).join(' and ') + ' links them' : 'No', M.reuse.length > 1 ? 'red' : '']]) +
        '<p class="keyline">A token protects the value. The vault decides who can still undo it, and for how long.</p>';
    }
    function draw(root) {
      $$('[data-tt]', root).forEach(function (b) { b.setAttribute('aria-checked', b.getAttribute('data-tt') === t); });
      var pr = root.querySelector('.principle'); if (pr) pr.textContent = G.principles[TAB_PRINCIPLE[t]];
      $('#tf-res', root).innerHTML = t === 'encrypt' ? encHTML() : t === 'hash' ? hashHTML() : t === 'pseudo' ? pseudoHTML() : tokenHTML();
      var T = tf({ encrypt: ed, hash: 'id_hash', pseudo: 'id_pseudo', token: 'id_tok' }[t]);
      $('#tf-meta', root).innerHTML = '<span class="st st-unk">' + esc(G.transformTypes[T.type]) + '</span> <span class="st ' + (T.rec === 'irreversible' ? 'st-ok' : T.rec === 'full' ? 'st-fail' : 'st-warn') + '">' + esc(G.recoverability[T.rec]) + '</span>';
    }
    return {
      head: 'How it was transformed, and who can still undo it',
      body: (view.noTabs ? '' : '<div class="seg" role="radiogroup" aria-label="Transformation">' + TABS.map(function (x) { return '<button role="radio" data-tt="' + x[0] + '" aria-checked="' + (x[0] === t) + '">' + x[1] + '</button>'; }).join('') + '</div>') +
        '<p class="tf-meta" id="tf-meta"></p><div id="tf-res" aria-live="polite"></div>',
      mount: function (root) {
        root.addEventListener('click', function (e) {
          var b = e.target.closest('[data-tt]'); if (b) { t = b.getAttribute('data-tt'); cand = ''; draw(root); return; }
          b = e.target.closest('[data-ed]'); if (b) { ed = b.getAttribute('data-ed'); draw(root); return; }
          b = e.target.closest('[data-kill]'); if (b) { var k = b.getAttribute('data-kill'); killed[k] = !killed[k]; draw(root); return; }
          b = e.target.closest('[data-pk]'); if (b) { var x = b.getAttribute('data-pk'); pk[x] = !pk[x]; draw(root); }
        });
        root.addEventListener('submit', function (e) { if (e.target.closest('[data-cand]')) { e.preventDefault(); cand = $('#candI', root).value.trim(); draw(root); var i = $('#candI', root); if (i) i.focus(); } });
        draw(root);
      }
    };
  };

  /* What happens if the key is destroyed? */
  var CONSEQ = { encrypted: 'can no longer be decrypted', shredded: 'is already unreadable', pseudonym: 'can no longer be re-matched to a person; existing IDs still link to each other', tokenized: 'tokens can no longer be resolved to the original' };
  function keyImpact(k) {
    var deps = G.transforms.filter(function (t) { return t.key === k; });
    var plain = G.edges.filter(function (e) { return e[1] === 'DERIVED_FROM' && deps.some(function (d) { return d.node === e[2]; }); }).map(function (e) { return e[0]; });
    return { deps: deps, plain: plain, holds: holdsCovering(k), K: G.keys[k] };
  }
  V.keygone = function (st) {
    var k = 'k_2026';
    function draw(root) {
      $$('[data-kg]', root).forEach(function (b) { b.setAttribute('aria-checked', b.getAttribute('data-kg') === k); });
      var I = keyImpact(k), K = I.K, nm = name(k);
      var tech = K.destroyed ? nm + ' destroyed on ' + K.destroyed + '; ' + I.deps.map(function (d) { return name(d.node); }).join(', ') + ' remain in storage' + (I.plain.length ? '; plaintext copy ' + I.plain.map(name).join(', ') + ' survives' : '') + '.'
        : 'Destroying ' + nm + ' affects ' + plural(I.deps.length, 'dataset or identifier') + (I.holds.length ? '; ' + nm + ' is held by ' + I.holds.map(function (h) { return name(h.id); }).join(', ') : '') + '.';
      var exec = K.destroyed ? 'Historical records still exist physically but can no longer be decrypted' + (I.plain.length ? ', except for one copy that was decrypted earlier.' : '.')
        : I.holds.length ? 'Destroying this key would make records under a preservation hold unusable.' : 'Destroying this key would make these records permanently unreadable.';
      $('#kg-res', root).innerHTML = '<ul class="kgl">' + I.deps.map(function (d) { return '<li><b>' + esc(name(d.node)) + '</b> <span class="st st-unk">' + esc(G.transformTypes[d.type]) + '</span><span>' + esc(CONSEQ[d.type] || 'becomes unusable') + '</span></li>'; }).join('') + '</ul>' +
        statusRow([['Data still exists', 'ok', 'Yes'], ['Recoverable afterwards', 'fail', 'No'], ['Conflicts with a hold', I.holds.length ? 'fail' : 'ok', I.holds.length ? 'Yes: ' + I.holds.map(function (h) { return name(h.id); }).join(', ') : 'No'], ['Plaintext copies', I.plain.length ? 'fail' : 'ok', I.plain.length ? I.plain.map(name).join(', ') : 'None found']]) +
        qa([['Key', nm + ' · ' + K.type], ['Owner and store', name(K.owner) + ' · ' + name(K.store)], ['State', K.destroyed ? 'Destroyed on ' + K.destroyed : K.status]]) + say(st, [tech, exec]);
    }
    return {
      head: 'If this key is destroyed, what can no longer be done?',
      body: '<div class="seg" role="radiogroup" aria-label="Key">' + Object.keys(G.keys).map(function (x) { return '<button role="radio" data-kg="' + x + '" aria-checked="' + (x === k) + '">' + esc(name(x)) + '</button>'; }).join('') + '</div>' +
        '<div id="kg-res" aria-live="polite"></div><p class="keyline">Encrypted data without an available key may be operationally equivalent to deleted data.</p><p class="aside">That is an engineering state, not a legal conclusion that the data was deleted.</p>',
      mount: function (root) { root.addEventListener('click', function (e) { var b = e.target.closest('[data-kg]'); if (b) { k = b.getAttribute('data-kg'); draw(root); } }); draw(root); }
    };
  };

  /* What is under legal hold? — preservation is not only preserving bytes */
  V.hold = function (st) {
    var H0 = G.holds.filter(function (h) { return h.status === 'active'; })[0], off = {};
    function stOf(node) { var it = H0.items.filter(function (x) { return x[1] === node; })[0]; if (!it) return 'unk'; if (off[node]) return 'fail'; return G.holdStates[it[2]][0] === 'ok' ? 'ok' : 'unk'; }
    function draw(root) {
      $('#hd-items', root).innerHTML = H0.items.map(function (it) { var s = off[it[1]] ? G.holdStates.no : G.holdStates[it[2]]; return '<li><button class="hi hi-' + s[0] + '" data-hi="' + it[1] + '" aria-pressed="' + !off[it[1]] + '"><span>' + esc(it[0]) + '<small>' + esc(name(it[1])) + '</small></span>' + mark(s[0] === 'warn' ? 'unk' : s[0], s[1]) + '</button></li>'; }).join('');
      $('#hd-use', root).innerHTML = G.usability.map(function (u) { var s = all3(u[1].map(stOf)); return '<li>' + mark(s, yn(s, 'Yes', 'No', 'Not yet')) + '<span>' + esc(u[0]) + '</span></li>'; }).join('');
    }
    return {
      head: 'Legal hold ' + name(H0.id) + ': what is preserved, and can it still be used?',
      body: '<div class="lanes2"><div><div class="eyebrow">Normal lifecycle</div>' + vchain([['Active'], ['Retention'], ['Delete']]) + '</div>' +
        '<div><div class="eyebrow">With preservation</div>' + vchain([['Active'], ['Legal hold', '', 'warn', 'hold'], ['Preserve', '', '', 'hold'], ['Hold released'], ['Normal retention resumes']]) + '</div></div>' +
        '<dl class="holdc"><div><dt>Hold</dt><dd>' + esc(name(H0.id)) + ' · ' + esc(H0.status) + ' since ' + esc(H0.start) + '</dd></div><div><dt>Scope</dt><dd>' + esc(H0.scope) + '</dd></div><div><dt>Authority reference</dt><dd>' + esc(H0.authority) + '</dd></div></dl>' +
        '<p class="small">An engineering workflow for preservation, not legal advice. Select an item to see what is lost if it is not preserved.</p>' +
        '<div class="hd"><div><div class="eyebrow">Preserved</div><ul class="hil" id="hd-items"></ul></div><div><div class="eyebrow">Future usability</div><ul class="usel" id="hd-use" aria-live="polite"></ul></div></div>' +
        '<p class="keyline">Preservation is not only preserving bytes.</p>',
      mount: function (root) { root.addEventListener('click', function (e) { var b = e.target.closest('[data-hi]'); if (b) { var n = b.getAttribute('data-hi'); off[n] = !off[n]; draw(root); } }); draw(root); }
    };
  };

  /* Can we prove the hold worked? — delete versus preserve */
  V.preserve = function (st) {
    var P = G.preserve, ph = 0;
    function draw(root) {
      $$('[data-ph]', root).forEach(function (b) { b.setAttribute('aria-checked', +b.getAttribute('data-ph') === ph); });
      var X = P.phases[ph], Hh = G.holds.filter(function (h) { return h.id === X.hold; })[0], ch = G.chains[X.id === 'active' ? 'hold' : 'release'];
      var EV = { ok: 'ok', fail: 'fail', warn: 'warn', wait: 'wait' };
      $('#pv-res', root).innerHTML =
        statusRow([['User request', 'ok', X.id === 'active' ? 'Received ' + P.request : 'Received'], ['Legal hold', X.id === 'active' ? 'warn' : 'ok', X.id === 'active' ? 'Active' : 'Released ' + Hh.release], ['Action', X.id === 'active' ? 'warn' : 'ok', X.id === 'active' ? 'Preserve relevant data' : 'Deletion resumed']]) +
        '<ul class="pvs">' + X.systems.map(function (s) { return '<li><b>' + esc(s[0]) + '</b><span class="st ' + (s[2] ? 'st-warn' : 'st-ok') + '">' + (s[2] ? 'in hold scope' : 'outside scope') + '</span><span>' + esc(s[3]) + '</span></li>'; }).join('') + '</ul>' +
        '<div class="eyebrow">Evidence</div><ol class="pve">' + X.ev.map(function (e) { return '<li class="pe-' + EV[e[2]] + '"><span>' + esc(e[0]) + '</span><span class="small">' + esc(e[1] || 'pending') + '</span>' + stTag(e[2] === 'wait' ? 'wait' : e[2], e[2] === 'ok' ? 'recorded' : e[2] === 'fail' ? 'failed' : e[2] === 'warn' ? 'incomplete' : 'pending') + '</li>'; }).join('') + '</ol>' +
        '<div class="eyebrow">' + esc(ch.title) + '</div>' + verdict(ch.hops[0].st, worst(ch.hops.map(function (h) { return h.st; }))) +
        '<ul class="pvc">' + ch.hops.map(function (h) { return '<li>' + stTag(h.st) + ' <b>' + esc(h.n) + '</b> ' + esc(h.actual) + ' <span class="small">(' + esc(h.evidence) + ')</span></li>'; }).join('') + '</ul>' +
        say(st, X.id === 'active' ? ['Deletion job blocked because legal_hold_id ' + name(X.hold) + ' matches the dataset scope; each skip logged.', 'Deletion is temporarily suspended because the records are under preservation hold.']
          : [name(X.hold) + ' released ' + Hh.release + '; deletion resumed; the post-release canary found feature vectors from the hold period.', 'The hold ended and deletion resumed, but some derived data was missed.']);
    }
    return {
      head: 'Delete versus preserve: can we prove the hold worked?',
      body: '<div class="seg" role="radiogroup" aria-label="Phase">' + P.phases.map(function (x, i) { return '<button role="radio" data-ph="' + i + '" aria-checked="' + (i === ph) + '">' + esc(x.label) + '</button>'; }).join('') + '</div>' +
        '<div id="pv-res" aria-live="polite"></div><p class="keyline">Privacy minimization and legal preservation can legitimately pull in opposite directions. The architecture must make the conflict explicit.</p>',
      mount: function (root) { root.addEventListener('click', function (e) { var b = e.target.closest('[data-ph]'); if (b) { ph = +b.getAttribute('data-ph'); draw(root); } }); draw(root); }
    };
  };

  /* Over time: transformation and recoverability, shown only when the lens asks for it */
  var TIME_LENS = ['identity', 'recoverability', 'preservation', 'keylifecycle', 'deletion'];
  function overTime(st, force) {
    if (!force && !st.c.some(function (c) { return TIME_LENS.indexOf(c) >= 0; })) return '';
    return '<div class="otw"><div class="eyebrow">Over time: how each record is protected, and whether it can be recovered</div><table class="otime"><thead><tr><th scope="col">Record</th><th scope="col">Transformation</th><th scope="col">Recoverability</th><th scope="col">Depends on</th><th scope="col">Hold</th></tr></thead><tbody>' +
      G.transforms.map(function (t) { return '<tr><th scope="row">' + esc(name(t.node)) + '</th><td>' + esc(G.transformTypes[t.type]) + '</td><td>' + esc(G.recoverability[t.rec]) + '</td><td>' + esc([t.key && name(t.key), t.norm].filter(Boolean).join(' + ') || '—') + '</td><td>' + esc(t.hold ? name(t.hold) : '—') + '</td></tr>'; }).join('') + '</tbody></table></div>';
  }

  /* ═══════════ FINDINGS ═══════════ */
  var ORDER = { 'CONTROL FAILURE': 0, FACT: 1, INFERENCE: 2, UNKNOWN: 3 };
  function findingsFor(st, view) {
    var q = view.kind === 'control' && st.q !== 'unrecoverable' ? 'control' : st.q;
    var lensOk = function (f) { return st.l === 'all' || !!M.lens4(f)[st.l]; };
    var sOk = function (f) { return st.s === 'all' || f.s.indexOf(st.s) >= 0; };
    var cOk = function (f) { return !st.c.length || f.c.some(function (c) { return st.c.indexOf(c) >= 0; }); };
    var score = function (f) { return (f.v.indexOf(q) >= 0 ? 4 : 0) + (st.c.length && cOk(f) ? 2 : 0) + (sOk(f) ? 1 : 0); };
    var pool = G.findings.filter(function (f) { return f.v.indexOf(q) >= 0 && sOk(f) && cOk(f) && lensOk(f); }), note = '';
    if (pool.length < 3) pool = pool.concat(G.findings.filter(function (f) { return pool.indexOf(f) < 0 && f.v.indexOf(q) >= 0 && lensOk(f) && sOk(f); }));
    if (pool.length < 3) pool = pool.concat(G.findings.filter(function (f) { return pool.indexOf(f) < 0 && f.v.indexOf(q) >= 0 && (sOk(f) || lensOk(f) && cOk(f)); }));
    if (pool.length < 3) pool = pool.concat(G.findings.filter(function (f) { return pool.indexOf(f) < 0 && f.v.indexOf(q) >= 0; }));
    pool.sort(function (a, b) { return score(b) - score(a) || ORDER[a.k] - ORDER[b.k]; });
    /* all four lenses: the best finding of each kind first, so a lens never crowds the others out */
    if (st.l === 'all') { var seen = {}, first = pool.filter(function (f) { if (seen[f.k]) return false; seen[f.k] = 1; return true; }); pool = first.concat(pool.filter(function (f) { return first.indexOf(f) < 0; })); }
    pool = pool.slice(0, st.p === 'executive' ? 3 : 5);
    if (st.l !== 'all' && pool.some(function (f) { return !lensOk(f); })) note = 'Few ' + (st.l === 'gov' ? 'data governance' : st.l === 'qa' ? 'QA' : st.l) + ' findings answer this; related findings are shown.';
    if (M.lensRule[st.l]) note = (note ? note + ' ' : '') + M.lensRule[st.l];
    return { list: pool.sort(function (a, b) { return ORDER[a.k] - ORDER[b.k]; }), note: note };
  }
  function findingText(f) { return f.text === '{changes}' ? plural(G.changes.length, 'privacy-relevant change') + ' since the ' + G.lastReview + ' review; none went through review.' : f.text; }
  function findingsHTML(st, view) {
    var r = findingsFor(st, view);
    if (!r.list.length) return '<p class="empty">No findings match. Widen the surface or clear the concern.</p>';
    return '<ol class="fl">' + r.list.map(function (f) {
      var p = f.p && f.p[st.p];
      return '<li class="fi">' + tag(f.k) + '<p>' + esc(findingText(f)) + '</p>' + (p ? '<p class="lensline"><b>' + esc(p[0]) + '</b> ' + esc(p[1]) + '</p>' : '') + (f.cite.length ? '<p class="cite">' + f.cite.map(function (c) { return esc(name(c)); }).join(' · ') + '</p>' : '') + M.findingMore(f) + '</li>';
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
    var order = st.p === 'builder' ? ['mit', 'ev', 'risk', 'why'] : st.p === 'auditor' || st.l === 'qa' ? ['ev', 'risk', 'mit', 'why'] : st.l === 'gov' ? ['mit', 'risk', 'ev', 'why'] : ['risk', 'why', 'mit', 'ev'];
    var lab = { builder: { mit: 'Mitigation · where the control lives' }, auditor: { ev: 'Evidence needed · the test' } }[st.p] || {};
    return '<dl class="dec">' + order.map(function (k, i) { return '<div' + (i === 0 ? ' class="hl"' : '') + '><dt>' + esc(lab[k] || F4[k][0]) + '</dt><dd>' + esc(F4[k][1]) + '</dd></div>'; }).join('') + '</dl>';
  }

  /* ═══════════ EVENTS LAYER ═══════════
   * What a person did, and what it set in motion: EVENT → IDENTIFIER → SYSTEM →
   * DERIVED DATA → INFERENCE (events.js). The tab, the selection and the
   * ecosystem live in the URL (et, e, eco); what is highlighted inside a use
   * case, the connection being asked about, and the review decisions on
   * connections live in memory for this visit only, and are never stored. */
  var EV = G.events, EVM = { key: '', hl: null, node: null, edge: null, dec: {}, whole: false, cur: null };
  var EV_TABS = [['day', 'A morning'], ['cases', 'Use cases'], ['all', 'All events'], ['changes', 'What changed?'], ['eco', 'Many ecosystems'], ['amb', 'Ambient morning']];
  var ACTS = [['keep', 'Keep connection'], ['scope', 'Scope it'], ['short', 'Shorten retention'], ['cut', 'Separate contexts']];
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function fmtDate(d) { var p = d.split('-'); return MON[+p[1] - 1] + ' ' + (+p[2]) + ', ' + p[0]; }
  function monthsBetween(a, b) { return Math.round((Date.parse(b) - Date.parse(a)) / 864e5 / 30.44); }
  function listJoin(a) { return a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]; }
  function lc(s) { return /^[A-Z]{2}/.test(s) ? s : s.charAt(0).toLowerCase() + s.slice(1); }
  function lcl(s) { return /^[A-Z][a-zA-Z]*-like/.test(s) ? s : lc(s); }
  function lab(id) { return EV.label(id, S.eco, EVM.cur && EVM.cur.set); }
  function famOf(set, id) { var n = set.nodes[id]; return n && n.type ? n.type.fam : ''; }
  function evTime(def, ev, i) {
    if (!ev.date) return ev.t;
    var first = def.events[0].date, m = monthsBetween(first, ev.date);
    return fmtDate(ev.date).replace(/, \d{4}$/, '') + (i && m >= 1 ? ' · ' + plural(m, 'month') + ' later' : '');
  }
  function evDef() {
    var o = { def: null, extra: null, open: false, hl: null, edge: null };
    if (S.et === 'cases') { var c = EV.caseById(S.e); if (c) { o.def = c.id === 'xplat' ? EV.devCase(S.dv) : c; o.open = true; o.hl = EVM.hl; } }
    else if (S.et === 'all') { var t = EV.type(S.e); if (t) { o.def = { id: 't-' + t.id, title: t.label, line: t.plain, inf: 'all', cc: t.cc, events: [{ id: 'x1', type: t.id, t: '', label: t.label }] }; o.open = true; o.hl = 'x1'; } }
    else if (S.et === 'changes') { var ch = EV.changeById(S.e); if (ch) { o.def = EV.day; o.extra = { add: ch.add, mark: ch.edge }; o.open = true; o.change = ch; o.edge = ch.edge; } }
    else { o.def = EV.day; o.hl = S.e || null; o.open = !!S.e || EVM.whole; }
    var key = S.et + ':' + S.e;
    if (key !== EVM.key) { EVM.key = key; EVM.hl = null; EVM.node = null; EVM.edge = o.edge; EVM.dec = {}; if (S.et === 'cases') o.hl = null; }
    return o;
  }

  /* ── the parts ── */
  function chip(def, ev, i, on, attr) {
    var t = EV.type(ev.type), f = EV.fam(t.fam), time = evTime(def, ev, i);
    return '<button type="button" class="evc f-' + t.fam + (on ? ' sel' : '') + '" ' + attr + ' aria-pressed="' + !!on + '">' + (time ? '<span class="evc-t">' + esc(time) + '</span>' : '') +
      '<span class="evc-l">' + esc(ev.label) + '</span><span class="evc-f">' + esc(f.label) + (ev.who ? ' · ' + esc(ev.who) : '') + '</span></button>';
  }
  function timeline(def, sel, attrName) {
    return '<ol class="etl" aria-label="' + esc(def.title || 'Events') + '">' + def.events.map(function (ev, i) {
      return '<li class="etl-i f-' + EV.type(ev.type).fam + '"><span class="etl-dot" aria-hidden="true"></span>' + chip(def, ev, i, sel === ev.id, 'data-' + attrName + '="' + ev.id + '" id="evc-' + ev.id + '"') + '</li>';
    }).join('') + '</ol>';
  }
  function famLegend(fams) {
    return '<p class="famlg" aria-label="Event families">' + EV.families.filter(function (f) { return !fams || fams.indexOf(f.id) >= 0; }).map(function (f) { return '<span class="f-' + f.id + '"><i aria-hidden="true"></i>' + esc(f.label) + '</span>'; }).join('') + '</p>';
  }
  function oneId(eco) {
    var E0 = EV.ecos.filter(function (x) { return x.id === eco; })[0];
    var svc = E0 && E0.services ? E0.services : Object.keys(EV.nodes).filter(function (k) { var n = EV.nodes[k]; return n.kind === 'sys' && n.L && k !== 's_account'; }).map(function (k) { return EV.nodes[k].name; });
    return '<div class="oneid"><span class="eyebrow">One identity</span><p class="oneid-h"><b>' + esc(EV.label('s_account', eco)) + '</b> sits in front of ' + plural(svc.length, 'service') + '.</p>' +
      '<ul class="oneid-l">' + svc.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul>' +
      '<p class="small">Each is useful alone. Behind one ID, together, they can describe a person’s schedule, places, spending and relationships.</p></div>';
  }

  /* ── your devices: the platform mix, and which account sees which device ── */
  function devicesHTML(where) {
    var dv = S.dv || EV.dvDefault, d = EV.parseDv(dv), acc = EV.devAccounts(dv), kinds = EV.devKinds.filter(function (k, i) { return d[i][0] !== 'none'; });
    var accOf = function (node) { return acc.filter(function (a) { return a.devices.indexOf(node) >= 0; })[0]; };
    var whole = acc.length === 1 && acc[0].devices.length === kinds.length;
    var head = whole ? 'One platform account, the ' + acc[0].label + ', sees all ' + plural(kinds.length, 'device') + '.' : plural(acc.length, 'platform account') + ' across ' + plural(kinds.length, 'device') + '; none of them sees every device.';
    return '<div class="devs"><span class="eyebrow">Your devices</span><div class="dv-pick" role="group" aria-label="Your devices">' + EV.devKinds.map(function (k, i) {
      return '<label class="sl dv-sl"><span class="dv-k">' + esc(k.label) + '</span><select id="dv-' + where + '-' + k.id + '" data-dv="' + i + '">' + k.opts.map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === d[i][0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select></label>';
    }).join('') + '</div>' +
      '<ul class="dv-acc">' + kinds.map(function (k) { var i = EV.devKinds.indexOf(k), a = accOf(k.node); return '<li><b>' + esc(d[i][1]) + '</b><span aria-hidden="true">→</span><span>' + esc(a ? a.label : 'Local sign-in: no platform account') + '</span></li>'; }).join('') + '</ul>' +
      '<p class="dv-h">' + esc(head) + '</p><p class="small">Shared by every device whatever the platform: the browser account, your email address, the apps you install everywhere, the phone link and the home Wi-Fi. That is where the linking moves.</p>' +
      '<div class="dv-other"><span class="eyebrow">Other devices join the same way</span><ul>' + EV.otherDevices.map(function (o) { return '<li>' + (o[2] ? '<button type="button" class="linkbtn" data-goto="' + o[2] + '">' + esc(o[0]) + '</button>' : '<b>' + esc(o[0]) + '</b>') + ' ' + esc(o[1]) + '</li>'; }).join('') + '</ul></div></div>';
  }

  /* ── the graph ── */
  function nodeState(set, id) {
    var n = EV.nodes[id];
    if (set.nodes[id].ev) return 'event';
    if (n.kind === 'id') return 'collected';
    if (n.kind === 'sys') return n.ext ? 'shared' : 'collected';
    if (n.kind === 'inf') return 'inferred';
    return n.st;
  }
  function nodeHTML(set, id, ctx) {
    var sn = set.nodes[id], n = EV.nodes[id], stt = nodeState(set, id), cls = 'en', tagt = '', alive = ctx.st[id].ok;
    if (sn.ev) {
      cls += ' k-event f-' + sn.type.fam; tagt = evTime(set.def, sn.ev, set.def.events.indexOf(sn.ev));
    } else {
      cls += ' k-' + n.kind + ' s-' + stt;
      if (stt === 'shared') tagt = 'outside ↗';
      if (stt === 'expired') tagt = 'deleted';
      if (n.kind === 'id') tagt = EV.stab[n.stab][0].toLowerCase();
      if (sn.by === 99) { cls += ' is-new'; tagt = 'new'; }
      if (ctx.afterDelete && n.kind === 'data') { var d = EV.onDel[n.onDel]; if (d) { tagt = d[1].toLowerCase() + (stt === 'shared' ? ' ↗' : ''); if (!d[0]) cls += ' gone'; } }
    }
    if (!alive) { cls += ' gone'; tagt = n && n.kind === 'inf' ? 'no longer possible' : 'not created'; }
    if (ctx.R) cls += ctx.R[id] ? ' on' : ' dim';
    if (EVM.node === id || ctx.ends[id]) cls += ' sel';
    var label = sn.ev ? sn.ev.label : lab(id);
    var sr = sn.ev ? EV.fam(sn.type.fam).label + ' event' : n.kind === 'id' ? 'identifier' : n.kind === 'sys' ? (n.ext ? 'outside the service' : 'service') : EV.states[stt];
    return '<button type="button" class="' + cls + '" data-n="' + id + '" aria-pressed="' + (EVM.node === id) + '"><span class="en-n">' + esc(label) + '</span>' + (tagt ? '<span class="en-t">' + esc(tagt) + '</span>' : '') + '<span class="sr-only"> (' + esc(sr) + (alive ? '' : ', no longer possible') + ')</span></button>';
  }
  function graphHTML(set, ctx) {
    var cols = [[], [], [], [], []];
    set.order.forEach(function (id, i) { var sn = set.nodes[id]; cols[sn.ev ? 0 : EV.col(EV.nodes[id])].push([sn.by, i, id]); });
    cols.forEach(function (c) { c.sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; }); });
    return '<div class="eg" id="eg" role="group" aria-label="Event graph: event, identifiers, systems, derived data, inferences" style="--fc:' + ctx.fc + '">' +
      EV.cols.map(function (c, i) { return '<div class="eg-col"><h3 class="eg-h">' + esc(c[1]) + '</h3><div class="eg-ns">' + (cols[i].length ? cols[i].map(function (x) { return nodeHTML(set, x[2], ctx); }).join('') : '<p class="eg-none">Nothing inferred</p>') + '</div></div>'; }).join('') +
      '<svg class="eg-svg" aria-hidden="true" focusable="false"></svg></div>';
  }
  function legendHTML() {
    return '<p class="nlg" aria-label="How to read the graph"><span class="s-collected">Collected</span><span class="s-derived">Derived</span><span class="s-inferred">Inferred</span><span class="s-shared">Shared outside ↗</span><span class="gone">Deleted or expired</span></p>';
  }
  function drawEdges() {
    var cur = EVM.cur, eg = $('#eg');
    if (!cur || !eg) return;
    var svg = $('.eg-svg', eg);
    if (getComputedStyle(svg).display === 'none') return;
    var box = eg.getBoundingClientRect(), pos = {};
    $$('[data-n]', eg).forEach(function (b) { var r = b.getBoundingClientRect(); pos[b.getAttribute('data-n')] = { l: r.left - box.left, r: r.right - box.left, y: r.top - box.top + r.height / 2 }; });
    svg.setAttribute('viewBox', '0 0 ' + box.width + ' ' + box.height); svg.setAttribute('width', box.width); svg.setAttribute('height', box.height);
    var colOf = function (id) { var sn = cur.set.nodes[id]; return sn.ev ? 0 : EV.col(EV.nodes[id]); };
    var out = '';
    cur.set.edges.forEach(function (e) {
      var a = pos[e.a], b = pos[e.b]; if (!a || !b) return;
      var d, ca = colOf(e.a), cb = colOf(e.b);
      if (ca === cb) { var bx = Math.max(a.r, b.r), k = 18 + Math.min(26, Math.abs(b.y - a.y) / 8); d = 'M' + a.r + ' ' + a.y + ' C' + (bx + k) + ' ' + a.y + ' ' + (bx + k) + ' ' + b.y + ' ' + b.r + ' ' + b.y; }
      else { var dx = (b.l - a.r) / 2; d = 'M' + a.r + ' ' + a.y + ' C' + (a.r + dx) + ' ' + a.y + ' ' + (b.l - dx) + ' ' + b.y + ' ' + b.l + ' ' + b.y; }
      var dec = EVM.dec[e.k], cls = 'ee' + (cur.R ? (cur.R[e.a] && cur.R[e.b] ? ' on' : ' dim') : '') + (dec ? ' d-' + dec : '') + (EVM.edge === e.k ? ' sel' : '') + (e.mark ? ' m-' + e.mark : '') + (cur.st[e.b].ok ? '' : ' off');
      out += '<path class="' + cls + '" d="' + d + '"/><path class="eh" data-ek="' + e.k + '" d="' + d + '"><title>Why is this connected?</title></path>';
    });
    svg.innerHTML = out;
  }

  /* ── the seven questions, for one event or for the whole set ── */
  function sevenQ(set, R, st) {
    var L = function (id) { return lab(id); }, ids = [], sys = [], ext = [], data = [], inf = [];
    set.order.forEach(function (id) { if ((R && !R[id]) || set.nodes[id].ev) return; var n = EV.nodes[id]; ({ id: ids, sys: n.ext ? ext : sys, data: data, inf: inf })[n.kind].push(id); });
    var live = function (id) { return st[id].ok; };
    var dl = data.filter(live), rows = [];
    var byState = ['collected', 'derived', 'shared', 'expired'].map(function (k) { var l = dl.filter(function (id) { return EV.nodes[id].st === k; }); return l.length ? EV.states[k] + ': ' + listJoin(l.map(L)) + '.' : ''; }).filter(Boolean).join(' ');
    rows.push(['What do we know?', 'FACT', byState || 'Nothing is stored.']);
    rows.push(['How do we know it?', 'FACT', (ids.length ? 'Through your ' + listJoin(ids.map(function (x) { return lcl(L(x)); })) : 'Through no identifier') + (sys.length ? ', recorded by ' + listJoin(sys.map(L)) : '') + '.']);
    rows.push(['Why do we need it?', 'FACT', ['required', 'useful', 'optional'].map(function (k) { var l = dl.filter(function (id) { return EV.nodes[id].need === k; }); return l.length ? EV.needs[k] + ': ' + l.map(function (id) { return L(id) + ' (' + lc(EV.nodes[id].why.replace(/\.$/, '')) + ')'; }).join('; ') + '.' : ''; }).filter(Boolean).join(' ') || 'Nothing is kept, so nothing needs a reason.']);
    var outside = ext.map(L).concat(dl.filter(function (id) { return EV.nodes[id].to; }).map(function (id) { return EV.nodes[id].to; })).filter(function (x, i, a) { return a.indexOf(x) === i; });
    rows.push(['Who receives it?', 'FACT', (sys.length ? 'Inside the service: ' + listJoin(sys.map(L)) + '.' : 'No service.') + (outside.length ? ' Outside it: ' + listJoin(outside) + '.' : ' Nothing leaves the service.')]);
    var keep = dl.filter(function (id) { return !EV.unknownRet(id); }).map(function (id) { return L(id) + ': ' + lc(EV.retOf(id, st)[0]); });
    rows.push(['How long do we keep it?', 'FACT', keep.length ? keep.join('; ') + '.' : 'Nothing is kept.']);
    var long = dl.filter(function (id) { return EV.tooLong(id, st); });
    if (long.length) rows.push(['', 'RECOMMENDATION', 'This information is kept longer than needed: ' + long.map(function (id) { return L(id) + ' (' + lc(EV.retOf(id, st)[0]) + '; ' + (EV.nodes[id].short ? lc(EV.nodes[id].short[0]) + ' would do' : 'its purpose needs less') + ')'; }).join(', ') + '.']);
    dl.filter(EV.unknownRet).forEach(function (id) { rows.push(['', 'UNKNOWN', 'Nobody here can say how long ' + EV.nodes[id].to + ' keeps ' + lc(L(id)) + '.']); });
    rows.push(['What can be inferred when it is combined?', 'INFERENCE', inf.length ? inf.map(function (id) {
      var src = EV.sources(set, id).map(function (ev) { return ev.label; });
      return L(id) + (src.length > 1 ? ', from ' + listJoin(src) : '') + (live(id) ? '' : ' (no longer possible)');
    }).join('. ') + '.' : 'Nothing, on its own.']);
    var joins = data.concat(inf).filter(function (id) { return live(id) && EV.contexts(set, id).length > 1; }), ctxs = [];
    joins.forEach(function (id) { EV.contexts(set, id).forEach(function (c) { if (ctxs.indexOf(c) < 0) ctxs.push(c); }); });
    var gone = dl.filter(function (id) { return EV.nodes[id].st === 'shared'; });
    rows.push(['Can we separate it again?', 'RECOMMENDATION', (ctxs.length ? 'Yes: ' + listJoin(ctxs.map(L)) + ' can recognize the same person through ' + listJoin(ids.filter(function (x) { return EV.nodes[x].stab === 'stable'; }).map(function (x) { return lcl(L(x)); })) + '. Give each its own ID, and ' + plural(joins.length, 'combined fact') + ' here can no longer be made.' : 'Nothing here is combined across services.') + (gone.length ? ' Not for copies already outside: ' + listJoin(gone.map(L)) + '.' : '')]);
    return '<dl class="sevq">' + rows.map(function (r) { return '<div' + (r[0] ? '' : ' class="sub"') + '><dt>' + esc(r[0]) + '</dt><dd>' + tag(r[1]) + ' ' + esc(r[2]) + '</dd></div>'; }).join('') + '</dl>';
  }
  function needTag(n) { return '<span class="need n-' + n + '">' + esc(EV.needs[n]) + '</span>'; }
  function cxList(set, list, title) {
    if (!list.length) return '';
    var L = function (id) { var sn = set.nodes[id]; return sn.ev ? sn.ev.label : lab(id); };
    return '<div class="cxs"><span class="eyebrow">' + esc(title) + '</span><ul>' + list.map(function (e) {
      var x = EV.explain(set, e.k, S.eco, EVM.cur.st), dec = EVM.dec[e.k];
      return '<li><button type="button" class="cx' + (EVM.edge === e.k ? ' sel' : '') + '" data-ek="' + e.k + '"><span>' + esc(L(e.a)) + ' → ' + esc(L(e.b)) + '</span>' + needTag(x.need) + (dec ? '<span class="dd">' + esc(ACTS.filter(function (a) { return a[0] === dec; })[0][1]) + '</span>' : '') + '</button></li>';
    }).join('') + '</ul></div>';
  }
  function actResult(set, k) {
    var dec = EVM.dec[k]; if (!dec) return '';
    var without = {}; Object.keys(EVM.dec).forEach(function (x) { if (x !== k) without[x] = EVM.dec[x]; });
    var before = EV.evaluate(set, without), after = EVM.cur.st, L = function (id) { return lab(id); };
    var lost = Object.keys(set.nodes).filter(function (id) { return before[id] && before[id].ok && !after[id].ok && EV.nodes[id] && (EV.nodes[id].kind === 'inf' || EV.nodes[id].kind === 'data'); }).map(L);
    var e = set.ek[k], tgt = set.nodes[e.b].ev ? '' : L(e.b);
    if (dec === 'keep') return 'Kept: recorded as reviewed and needed, for this visit.';
    if (dec === 'scope') return 'Scoped: ' + tgt + ' gets its own ID for this purpose. ' + (lost.length ? 'These services can no longer recognize the same person, so this is no longer possible: ' + listJoin(lost) + '.' : 'Nothing here depended on recognizing you across services, so everything still works.');
    if (dec === 'short') return listJoin(EV.shortTargets(set, k).map(function (x) { return L(x) + ' is now kept ' + lc(EV.nodes[x].short[0]); })) + '. ' + (lost.length ? 'Too short to build: ' + listJoin(lost) + '.' : 'Nothing here needed the longer history.');
    return 'Separated. ' + (lost.length ? 'No longer possible: ' + listJoin(lost) + '.' : 'Nothing else depended on it.');
  }
  function whyHTML(set, k, change) {
    var x = EV.explain(set, k, S.eco, EVM.cur.st), e = set.ek[k], use = EV.uses.filter(function (u) { return u[0] === x.use; })[0];
    var long = EV.nodes[e.b] && EV.nodes[e.b].kind === 'data' && EV.tooLong(e.b, EVM.cur.st);
    var chg = change && change.edge === k ? '<div class="chgbox"><span class="chg-k">Change · ' + esc(change.kind) + '</span><b>' + esc(change.title) + '</b><p>' + esc(fmtDate(change.date)) + ' · ' + (change.reviewed ? 'went through review' : 'did not go through review') + '</p><p><span class="ba">Before</span> ' + esc(change.before) + '</p><p><span class="ba">After</span> ' + esc(change.after) + '</p></div>' : '';
    return '<div class="why"><span class="eyebrow">Why is this connected?</span><h3 id="whyH" tabindex="-1">' + esc(x.from) + ' → ' + esc(x.to) + '</h3>' + chg +
      (x.joins ? '<p class="joinl">These two services can recognize the same person.</p>' : '') +
      '<dl class="whyl"><div><dt>Purpose</dt><dd>' + esc(x.why) + '</dd></div><div><dt>Needed?</dt><dd>' + needTag(x.need) + ' <span class="euse">' + esc(use ? use[1] : '') + '</span></dd></div>' +
      '<div><dt>Identifier used</dt><dd>' + esc(x.id) + '</dd></div><div><dt>Retention</dt><dd>' + esc(x.ret) + (long ? ' <span class="long">This information is kept longer than needed.</span>' : '') + '</dd></div>' +
      '<div><dt>Who can use it?</dt><dd>' + esc(x.who) + '</dd></div><div><dt>Can these contexts be separated?</dt><dd>' + esc(x.sep) + '</dd></div></dl>' +
      '<div class="acts" role="group" aria-label="Decide about this connection">' + ACTS.map(function (a) { var why = EV.applicable(set, k, a[0]); return '<button type="button" class="act a-' + a[0] + '" data-do="' + a[0] + '" data-ek="' + k + '" aria-pressed="' + (EVM.dec[k] === a[0]) + '"' + (why ? ' aria-describedby="na-' + a[0] + '" disabled' : '') + '>' + a[1] + '</button>'; }).join('') + '</div>' +
      ACTS.map(function (a) { var why = EV.applicable(set, k, a[0]); return why ? '<p class="na" id="na-' + a[0] + '">' + esc(a[1]) + ': ' + esc(why) + '</p>' : ''; }).join('') +
      '<p class="act-res" role="status">' + esc(actResult(set, k)) + '</p>' +
      '<button type="button" class="linkbtn" data-evback>' + (S.et === 'changes' ? 'Back to what this change touches' : 'Back to the event') + '</button></div>';
  }
  function nodeCard(set, id) {
    var sn = set.nodes[id], n = EV.nodes[id], st = EVM.cur.st, L = function (x) { var s = set.nodes[x]; return s.ev ? s.ev.label : lab(x); };
    var inn = set.edges.filter(function (e) { return e.b === id; }), out = set.edges.filter(function (e) { return e.a === id; });
    var rows = [];
    if (sn.ev) rows.push(['What happened', sn.type.plain + (sn.ev.who ? ' By: ' + lc(sn.ev.who) + '.' : '')]);
    else if (n.kind === 'id') rows.push(['What it is', EV.stab[n.stab][0] + '. ' + n.carry]);
    else if (n.kind === 'sys') rows.push(['What it does', 'It ' + n.why + '.'], ['Who can use it?', n.who]);
    else {
      rows.push(['Why it exists', n.why]);
      if (n.kind === 'data') rows.push(['Needed?', EV.needs[n.need]], ['Kept', EV.retOf(id, st)[0] + (EV.tooLong(id, st) ? ' (longer than needed)' : '')], ['Who can use it?', n.who], ['Can it be separated?', n.sep]);
      else rows.push(['Comes from', listJoin(EV.sources(set, id).map(function (ev) { return ev.label; }))]);
      if (n.to) rows.push(['Shared with', n.to]);
    }
    if (st[id] && !st[id].ok) rows.push(['Status', st[id].why === 'retention' ? 'No longer possible: the history it needs is no longer kept.' : st[id].why === 'scoped' ? 'No longer possible: the services can no longer recognize the same person.' : 'No longer possible: something it depends on was separated.']);
    return '<div class="ncard"><span class="eyebrow">' + esc(sn.ev ? EV.fam(sn.type.fam).label + ' event' : { id: 'Identifier', sys: n.ext ? 'Outside the service' : 'System', data: EV.states[n.st], inf: 'Inferred' }[n.kind]) + '</span><h3 id="ncH" tabindex="-1">' + esc(L(id)) + '</h3>' + (n && n.sub ? '<p class="small">' + esc(n.sub) + '</p>' : '') +
      '<dl class="whyl">' + rows.map(function (r) { return '<div><dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd></div>'; }).join('') + '</dl>' +
      cxList(set, inn.concat(out), 'Its connections · ask why') + '<button type="button" class="linkbtn" data-evback>Back</button></div>';
  }
  function inspector(set, o) {
    if (EVM.edge && set.ek[EVM.edge]) return whyHTML(set, EVM.edge, o.change);
    if (EVM.node && set.nodes[EVM.node]) return nodeCard(set, EVM.node);
    var R = EVM.cur.R, hl = EVM.cur.hlId, head;
    if (hl) head = '<span class="eyebrow">This event</span><h3>' + esc(set.nodes[hl].ev.label) + '</h3>';
    else head = '<span class="eyebrow">' + esc(set.def.title || 'These events') + '</span><h3>' + plural(set.events.length, 'event') + ', together</h3>';
    var list = R ? set.edges.filter(function (e) { return R[e.a] && R[e.b]; }) : [];
    return head + sevenQ(set, R, EVM.cur.st) + (list.length ? cxList(set, list, 'Every connection it touches · ask why') : '<p class="small">Click any line in the graph, or pick an event, to ask why it is connected.</p>');
  }

  /* ── panels that some use cases add ── */
  function extras(set, o) {
    var def = set.def, st = EVM.cur.st, L = function (id) { return lab(id); }, out = '';
    var ands = Object.keys(set.nodes).filter(function (id) { var n = EV.nodes[id]; return n && n.kind === 'inf' && n.needs; });
    if (ands.length && set.events.length > 1) out += '<section class="xp"><h3>What only appears when events are combined</h3>' + ands.map(function (id) {
      var src = EV.sources(set, id);
      return '<div class="comb">' + src.map(function (ev) { return '<span class="evc mini f-' + EV.type(ev.type).fam + '"><span class="evc-l">' + esc(ev.label) + '</span>' + (ev.alone ? '<span class="evc-f">Alone: ' + esc(ev.alone) + '</span>' : '') + '</span>'; }).join('<span class="plus" aria-hidden="true">+</span>') +
        '<span class="eq" aria-hidden="true">=</span><span class="en k-inf s-inferred' + (st[id].ok ? '' : ' gone') + '"><span class="en-n">' + esc(L(id)) + '</span>' + (st[id].ok ? '' : '<span class="en-t">no longer possible</span>') + '</span></div>';
    }).join('') + '<p class="small">Each event is ordinary on its own. The combination is new information that nobody typed in.</p></section>';
    if (def.ctx) {
      var into = set.edges.filter(function (e) { return e.b === 'd_ctx'; }), reach = EV.contexts(set, 'd_ctx');
      out += '<section class="xp"><h3>What the assistant receives for one answer</h3><p class="small">For “When is my flight?”, one feature reaches ' + plural(reach.length, 'service') + ': ' + esc(listJoin(reach.map(L))) + '.</p>' +
        '<table class="ctxt"><thead><tr><th scope="col">Context</th><th scope="col">Needed?</th><th scope="col">Why</th><th scope="col"><span class="sr-only">Decide</span></th></tr></thead><tbody>' + into.map(function (e) {
          var x = EV.explain(set, e.k, S.eco, st), cut = EVM.dec[e.k] === 'cut';
          return '<tr' + (cut ? ' class="cutrow"' : '') + '><th scope="row">' + esc(L(e.a)) + '</th><td>' + needTag(x.need) + '</td><td>' + esc(x.why) + '</td><td><button type="button" class="act a-cut" data-do="cut" data-ek="' + e.k + '" aria-pressed="' + cut + '">' + (cut ? 'Left out' : 'Leave out') + '</button></td></tr>';
        }).join('') + '</tbody></table><p class="keyq">What happens when one feature is allowed to see all of them at once?</p>' +
        '<p class="small">' + tag('RECOMMENDATION') + ' Give each answer only what it needs: the Required sources; ask before Useful ones; leave Optional ones out. The answer still works: ' + (st.n_itinerary && st.n_itinerary.ok ? 'it does now.' : 'it does not now, because the reservation was left out.') + '</p></section>';
    }
    if (def.uses) {
      var dl = Object.keys(set.nodes).filter(function (id) { return EV.nodes[id] && EV.nodes[id].kind === 'data'; });
      out += '<section class="xp"><h3>Four different reasons</h3><table class="ctxt"><thead><tr><th scope="col">Reason</th><th scope="col">Record</th><th scope="col">Needed?</th><th scope="col">Kept</th></tr></thead><tbody>' +
        ['operate', 'analytics', 'personalize', 'ads'].map(function (u) { return dl.filter(function (id) { return EV.nodes[id].use === u; }).map(function (id) { return '<tr><th scope="row">' + esc(EV.uses.filter(function (x) { return x[0] === u; })[0][1]) + '</th><td>' + esc(L(id)) + '</td><td>' + needTag(EV.nodes[id].need) + '</td><td>' + esc(EV.retOf(id, st)[0]) + '</td></tr>'; }).join(''); }).join('') +
        '</tbody></table><p class="small">Running the service answers the search. Measuring counts it without an ID. Personalizing remembers it for you. Advertising uses it to choose and measure ads. Only the first is needed to answer.</p></section>';
    }
    if (def.afterDelete) {
      var rows = Object.keys(set.nodes).filter(function (id) { return EV.nodes[id] && EV.nodes[id].kind === 'data' && id !== 'd_delrec'; });
      var gone = rows.filter(function (id) { return !EV.onDel[EV.nodes[id].onDel][0]; });
      out += '<section class="xp"><h3>After “Delete the account”</h3><p class="small">' + plural(gone.length, 'record') + ' deleted; ' + plural(rows.length - gone.length, 'record') + ' remain, each for a stated reason.</p><table class="ctxt"><thead><tr><th scope="col">Record</th><th scope="col">After deletion</th><th scope="col">Why</th></tr></thead><tbody>' +
        rows.map(function (id) { var d = EV.onDel[EV.nodes[id].onDel]; return '<tr><th scope="row">' + esc(L(id)) + '</th><td><span class="dk ' + (d[0] ? 'kept' : 'del') + '">' + esc(d[1]) + '</span></td><td>' + esc(EV.nodes[id].keepWhy || d[2]) + '</td></tr>'; }).join('') + '</tbody></table></section>';
    }
    if (def.perm) {
      var ago = monthsBetween(def.perm.granted, EV.asOf);
      out += '<section class="xp"><h3>A permission, months later</h3><p>Granted ' + esc(fmtDate(def.perm.granted)) + ', ' + plural(ago, 'month') + ' ago, “to find the car”. Last needed for that: ' + esc(fmtDate(def.perm.needed)) + '. Still on today.</p><p class="small">' + tag('RECOMMENDATION') + ' Ask again when access has gone unused, and prefer “While using the app”.</p></section>';
    }
    if (def.exif) out += '<section class="xp"><h3>What is inside the file</h3><dl class="whyl">' + EV.nodes.d_exif.fields.map(function (f) { return '<div><dt>' + esc(f[0]) + '</dt><dd>' + esc(f[1]) + '</dd></div>'; }).join('') + '</dl><p class="small">The picture shows a cat. The file also says when, where and with which phone, to everyone who receives it.</p></section>';
    if (def.unknown) out += '<section class="xp"><h3>Whose activity is this?</h3><p>' + tag('UNKNOWN') + ' ' + esc(def.unknown) + '</p></section>';
    if (def.oneId) out += '<section class="xp">' + oneId(S.eco) + '</section>';
    if (def.devices) out += '<section class="xp"><h3>Which account sees which device</h3>' + (S.eco === 'mixed' ? '<p class="small">Choose the devices above, under Mixed devices.</p>' : devicesHTML('case')) + '</section>';
    return out;
  }

  /* ── the trace: story, graph, inspector ── */
  function traceHTML(o) {
    var set = EV.compose(o.def, o.extra), st = EV.evaluate(set, EVM.dec);
    if (!set.lab && S.eco === 'mixed') set.lab = EV.devLabels(S.dv);
    var hlId = EVM.node ? null : o.hl, R = null;
    if (hlId && set.nodes[hlId]) R = EV.reach(set, hlId);
    else if (EVM.node && set.nodes[EVM.node]) { R = EV.reach(set, EVM.node); var up = EV.reach(set, EVM.node, true); Object.keys(up).forEach(function (k) { R[k] = 1; }); }
    else if (o.change) { var e0 = set.ek[o.change.edge]; R = EV.reach(set, e0.b); var up2 = EV.reach(set, e0.a, true); Object.keys(up2).forEach(function (k) { R[k] = 1; }); }
    var ends = {}; if (EVM.edge && set.ek[EVM.edge]) { ends[set.ek[EVM.edge].a] = 1; ends[set.ek[EVM.edge].b] = 1; }
    var fam = hlId && set.nodes[hlId] ? famOf(set, hlId) : o.change ? 'ads' : '';
    var ctx = { st: st, R: R, ends: ends, afterDelete: o.def.afterDelete, fc: fam ? 'var(--f-' + fam + ')' : 'var(--ink-2)' };
    EVM.cur = { set: set, st: st, R: R, hlId: hlId && set.nodes[hlId] ? hlId : null };
    /* the story line: one column at a time */
    var L = function (id) { var sn = set.nodes[id]; return sn.ev ? sn.ev.label : lab(id); };
    var per = [[], [], [], [], []];
    set.order.forEach(function (id) { if (R && !R[id]) return; var sn = set.nodes[id]; if (!st[id].ok) return; per[sn.ev ? 0 : EV.col(EV.nodes[id])].push(L(id)); });
    var story = '<ol class="estory" aria-label="What this set in motion">' + EV.cols.map(function (c, i) { var l = per[i], txt = l.length ? l.slice(0, 3).join(' + ') + (l.length > 3 ? ' + ' + (l.length - 3) + ' more' : '') : i === 4 ? 'nothing inferred' : '—'; return '<li><span class="eyebrow">' + esc(c[1]) + '</span><span>' + esc(txt) + '</span></li>'; }).join('') + '</ol>';
    var uses = {}; Object.keys(set.nodes).forEach(function (id) { var n = EV.nodes[id]; if (!n || (R && !R[id]) || !st[id].ok || (n.kind !== 'data' && n.kind !== 'inf')) return; var u = n.use || 'operate'; uses[u] = (uses[u] || 0) + 1; });
    var usesRow = '<p class="uses"><span class="eyebrow">What it is for</span>' + EV.uses.filter(function (u) { return uses[u[0]]; }).map(function (u) { return '<span class="eu eu-' + u[0] + '">' + esc(u[1]) + ' <b>' + uses[u[0]] + '</b></span>'; }).join('') + '</p>';
    var nd = Object.keys(EVM.dec).length;
    var decBar = nd ? '<p class="decbar">' + 'Your review: ' + plural(nd, 'connection') + ' decided, for this visit only. <button type="button" class="linkbtn" data-evreset>Undo all</button></p>' : '';
    return '<div class="trace" id="trace">' +
      '<div class="tr-top">' + story + '<div class="tr-act"><button type="button" class="btn ghost" data-evcc>Review in the workspace</button><button type="button" class="linkbtn" data-evclose>Close</button></div></div>' +
      usesRow + decBar +
      '<div class="tr-main"><div class="eg-wrap">' + graphHTML(set, ctx) + legendHTML() + '</div><aside class="evi" id="evi" aria-label="Inspector" tabindex="0">' + inspector(set, o) + '</aside></div>' +
      extras(set, o) + '</div>';
  }

  function tabBody(o) {
    if (S.et === 'eco') return M.ecoTab(S);
    if (S.et === 'amb') return M.ambTab(S);
    if (S.et === 'cases') {
      var c = o.def;
      return '<div class="cases" role="group" aria-label="Use cases">' + EV.cases.map(function (x) { return '<button type="button" class="cs' + (c && c.id === x.id ? ' sel' : '') + '" data-cs="' + x.id + '" id="cs-' + x.id + '" aria-pressed="' + !!(c && c.id === x.id) + '">' + esc(x.title) + '</button>'; }).join('') + '</div>' +
        (c ? '<div class="case-h"><h3>' + esc(c.title) + '</h3><p class="case-l">' + esc(c.line) + '</p><p class="take"><span class="eyebrow">The point</span> ' + esc(c.take) + '</p></div>' + timeline(c, EVM.hl, 'hl') : '<p class="hint">Pick a use case to follow it through the graph.</p>');
    }
    if (S.et === 'all') {
      return '<div class="fams">' + EV.families.map(function (f) {
        return '<div class="fam f-' + f.id + '"><h3><i aria-hidden="true"></i>' + esc(f.label) + '</h3><div class="fam-l">' + EV.types.filter(function (t) { return t.fam === f.id; }).map(function (t) { return chip({ events: [] }, { type: t.id, label: t.label }, 0, S.e === t.id, 'data-ty="' + t.id + '" id="ty-' + t.id + '"'); }).join('') + '</div></div>';
      }).join('') + '</div>';
    }
    if (S.et === 'changes') {
      var rev = EV.changes.filter(function (c) { return c.reviewed; }).length;
      return '<p class="chg-s">' + plural(EV.changes.length, 'change') + ' since the ' + esc(fmtDate(G.lastReview)) + ' review; ' + rev + ' went through review. Privacy problems often arrive as changes, not as the first design.</p>' +
        '<ul class="chgs">' + EV.changes.map(function (c) {
          return '<li><button type="button" class="chc' + (S.e === c.id ? ' sel' : '') + (c.reviewed ? ' rv' : '') + '" data-ch="' + c.id + '" id="ch-' + c.id + '" aria-pressed="' + (S.e === c.id) + '"><span class="chc-k">' + esc(c.kind) + ' · ' + (c.reviewed ? 'reviewed' : 'not reviewed') + '</span><b>' + esc(c.title) + '</b><span class="chc-d">' + esc(fmtDate(c.date)) + '</span><span class="chc-ba">' + esc(c.before) + ' → ' + esc(c.after) + '</span></button></li>';
        }).join('') + '</ul>';
    }
    var picks = EV.day.events.filter(function (e) { return e.pick; });
    return timeline(EV.day, S.e, 'evi') + (o.open ? '' : '<p class="hint">Click any event to follow it, or try ' + picks.map(function (e) { return '<button type="button" class="linkbtn" data-evi="' + e.id + '">' + esc(e.label.toLowerCase()) + '</button>'; }).join(', ') + '. <button type="button" class="linkbtn" data-evwhole>Show the whole morning</button></p>');
  }
  function eventsLayer() {
    var o = evDef(), fams = null;
    var tabs = '<div class="evtab" role="group" aria-label="Events view">' + EV_TABS.map(function (t) {
      var n = t[0] === 'cases' ? EV.cases.length : t[0] === 'all' ? EV.types.length : t[0] === 'changes' ? EV.changes.length : t[0] === 'eco' ? null : t[0] === 'amb' ? null : EV.day.events.length;
      return '<button type="button" data-et="' + t[0] + '" id="et-' + t[0] + '" aria-pressed="' + (S.et === t[0]) + '"' + (t[0] === 'changes' ? ' class="t-chg"' : '') + '>' + esc(t[1]) + (n == null ? '' : ' <span>' + n + '</span>') + '</button>';
    }).join('') + '</div>';
    if (S.et === 'day') fams = EV.day.events.map(function (e) { return EV.type(e.type).fam; });
    if (S.et === 'cases' && o.def) fams = o.def.events.map(function (e) { return EV.type(e.type).fam; });
    return '<section class="evx" id="evl" aria-labelledby="evlH">' +
      '<div class="evl-h"><div class="evl-t"><span class="eyebrow">Events</span><h2 id="evlH">What a person did, and what it set in motion</h2><p class="evl-s">Pick an event. See the data it created, the IDs that touched it, where it travelled, what was inferred, and whether each connection was needed.</p></div>' +
      '<div class="seg eco" role="radiogroup" aria-label="Ecosystem">' + EV.ecos.map(function (x) { return '<button role="radio" data-eco="' + x.id + '" aria-checked="' + (S.eco === x.id) + '">' + esc(x.label) + '</button>'; }).join('') + '</div></div>' +
      (S.eco === 'mixed' ? '<div class="ecobar">' + devicesHTML('bar') + '<p class="eco-n">One person, several platforms. Change the devices to see where the linking moves. ' + esc(EV.ecoNote) + '</p></div>' : S.eco !== 'all' ? '<div class="ecobar">' + oneId(S.eco) + '<p class="eco-n">' + esc(EV.ecoNote) + '</p></div>' : '') +
      tabs + '<div class="evtb">' + tabBody(o) + (fams && S.et !== 'all' ? famLegend(fams) : '') + '</div>' +
      (o.open && S.et !== 'eco' && S.et !== 'amb' ? traceHTML(o) : '') +
      '</section>';
  }
  function evFocus(sel) { if (!sel) return; var el = $(sel); if (el) el.focus({ preventScroll: true }); }
  function renderEvents(focusSel) {
    var old = $('#evl'); if (!old) return;
    var wrap = document.createElement('div'); wrap.innerHTML = eventsLayer();
    old.parentNode.replaceChild(wrap.firstChild, old);
    mountEvents(); evFocus(focusSel);
  }
  var evResizeBound = false;
  function mountEvents() {
    var root = $('#evl'); if (!root) return;
    if (S.et === 'amb') M.mountAmb(root);
    if (EVM.cur && $('#eg')) { drawEdges(); if (document.fonts && document.fonts.ready) document.fonts.ready.then(drawEdges); }
    if (!evResizeBound) { evResizeBound = true; var t = null; window.addEventListener('resize', function () { cancelAnimationFrame(t); t = requestAnimationFrame(drawEdges); }); }
    root.addEventListener('change', function (ev) {
      var sl = ev.target.closest('select[data-dv]'); if (!sl) return;
      var cur = (S.dv || EV.dvDefault).split('.'); cur[+sl.getAttribute('data-dv')] = sl.value;
      var dv = cur.join('.'); focusAfter = sl.id; EVM.key = ''; set({ dv: dv === EV.dvDefault ? '' : dv });
    });
    root.addEventListener('click', function (ev) {
      var b = ev.target.closest('button, path.eh'); if (!b || !root.contains(b)) return;
      var a = function (n) { return b.getAttribute(n); };
      if (a('data-eco')) { focusAfter = null; set({ eco: a('data-eco') }); return evFocus('[data-eco="' + a('data-eco') + '"]'); }
      if (a('data-et')) { EVM.whole = false; focusAfter = 'et-' + a('data-et'); set({ et: a('data-et'), e: '' }); return; }
      if (a('data-evi')) { var id = a('data-evi'); focusAfter = 'evc-' + id; set({ et: 'day', e: S.e === id ? '' : id }); return; }
      if (a('data-ty')) { focusAfter = 'ty-' + a('data-ty'); set({ e: S.e === a('data-ty') ? '' : a('data-ty') }); return; }
      if (a('data-goto')) { focusAfter = 'cs-' + a('data-goto'); set({ et: 'cases', e: a('data-goto') }); return; }
      if (a('data-cs')) { focusAfter = 'cs-' + a('data-cs'); set({ e: S.e === a('data-cs') ? '' : a('data-cs') }); return; }
      if (a('data-ch')) { focusAfter = 'ch-' + a('data-ch'); set({ e: S.e === a('data-ch') ? '' : a('data-ch') }); return; }
      if (a('data-hl')) { EVM.hl = EVM.hl === a('data-hl') ? null : a('data-hl'); EVM.node = null; EVM.edge = null; return renderEvents('#evc-' + a('data-hl')); }
      if (b.hasAttribute('data-evwhole')) { EVM.whole = true; return renderEvents('#trace .eg-h'); }
      if (b.hasAttribute('data-evclose')) { EVM.whole = false; EVM.node = null; EVM.edge = null; if (S.et === 'cases' && EVM.hl) { EVM.hl = null; return renderEvents('#cs-' + S.e); } focusAfter = 'et-' + S.et; set({ e: '' }); return; }
      if (b.hasAttribute('data-evreset')) { EVM.dec = {}; return renderEvents('#evi h3'); }
      if (b.hasAttribute('data-evback')) { EVM.edge = null; EVM.node = null; return renderEvents('#evi h3'); }
      if (b.hasAttribute('data-evcc')) { var c = (EVM.cur && EVM.cur.hlId ? EVM.cur.set.nodes[EVM.cur.hlId].type.cc : null) || (EVM.cur && EVM.cur.set.def.cc) || EV.day.cc; set({ page: 'cc', s: c.s, j: c.j, q: c.q, c: [], u: 'person' }); var v = $('#vis'); if (v) { v.scrollIntoView({ behavior: RM ? 'auto' : 'smooth', block: 'start' }); $('#visH').setAttribute('tabindex', '-1'); $('#visH').focus({ preventScroll: true }); } return; }
      if (a('data-do')) { var k = a('data-ek'), d = a('data-do'); if (EVM.dec[k] === d) delete EVM.dec[k]; else EVM.dec[k] = d; return renderEvents('[data-do="' + d + '"][data-ek="' + k + '"]'); }
      if (a('data-ek')) { EVM.edge = a('data-ek'); return renderEvents('#whyH'); }
      if (a('data-n')) { var n = a('data-n'), sn = EVM.cur.set.nodes[n]; EVM.edge = null; EVM.node = EVM.node === n ? null : n; if (sn && sn.ev && S.et === 'cases') { EVM.hl = n; EVM.node = null; } return renderEvents(EVM.node ? '#ncH' : '[data-n="' + n + '"]'); }
    });
  }

  /* ═══════════ PAGES ═══════════ */
  function selQ(val) {
    var L = offered(G.questions, 'q', S.s), groups = ['today', 'future'].map(function (g) { return [g, L.filter(function (q) { return (q.g || 'today') === g; })]; }).filter(function (x) { return x[1].length; });
    return '<label class="sl k-q"><span class="sr-only">Question</span><select id="selQ">' + groups.map(function (g) { return '<optgroup label="' + esc(G.questionGroups[g[0]]) + '">' + g[1].map(function (x) { return '<option value="' + x.id + '"' + (x.id === val ? ' selected' : '') + '>' + esc(x.label) + '</option>'; }).join('') + '</optgroup>'; }).join('') + '</select></label>';
  }
  function sel(id, label, list, val, cls) { return '<label class="sl ' + (cls || '') + '"><span class="sr-only">' + label + '</span><select id="' + id + '">' + list.map(function (x) { return '<option value="' + x.id + '"' + (x.id === val ? ' selected' : '') + '>' + esc(x.label) + '</option>'; }).join('') + '</select></label>'; }
  function selectorBar() {
    var cl = S.c.map(function (c) { return byId(G.concerns, c).label.toLowerCase(); });
    var cLabel = !cl.length ? 'any concern' : cl.length === 1 ? cl[0] : cl[0] + ' +' + (cl.length - 1);
    return '<div class="sent" role="group" aria-label="Lenses">' +
      '<span class="w">I am a</span>' + sel('selP', 'Persona', G.personas, S.p, 'k-p') +
      '<span class="w">looking at</span>' + sel('selS', 'Surface', G.surfaces, S.s) +
      '<span class="w">when someone</span>' + sel('selJ', 'Journey', offered(G.journeys, 'j', S.s), S.j) +
      '<span class="w">asking</span>' + selQ(S.q) +
      '<span class="w">concerned with</span><span class="ms"><button type="button" id="selC" class="ms-b" aria-haspopup="true" aria-expanded="false" aria-controls="msPop"><span class="sr-only">Privacy concern: </span>' + esc(cLabel) + '</button>' +
      '<div class="ms-pop" id="msPop" hidden><div class="ms-h"><span class="eyebrow">Privacy concerns</span><button type="button" class="linkbtn" id="msClear">Clear</button></div>' +
      offered(G.concerns, 'c', S.s).map(function (c) { return '<label><input type="checkbox" id="cc-' + c.id + '" value="' + c.id + '"' + (S.c.indexOf(c.id) >= 0 ? ' checked' : '') + '> ' + esc(c.label) + '</label>'; }).join('') + '</div></span></div>' +
      '<div class="refine"><span class="w">about</span>' + sel('selU', 'Subject', offered(G.subjects, 'u', S.s), S.u) +
      '<span class="w">through</span><div class="seg" role="radiogroup" aria-label="Lens">' + ['all', 'security', 'privacy', 'qa', 'gov'].map(function (l) { return '<button role="radio" data-l="' + l + '" aria-checked="' + (S.l === l) + '">' + esc(G.lenses[l].label) + '</button>'; }).join('') + '</div></div>' +
      '<p class="lensq">' + esc(G.lenses[S.l].q) + (G.lenses[S.l].incl ? ' <span>Includes ' + esc(G.lenses[S.l].incl) + '.</span>' : '') + '</p>' +
      (S.l === 'all' ? '<div class="conv">' + G.converge.map(function (c) { return '<div class="cv"><b>' + esc(c[0]) + '</b><p><em>Security</em>' + esc(c[1]) + '</p><p><em>Privacy</em>' + esc(c[2]) + '</p></div>'; }).join('') + '</div>'  + conv4() : '');
  }
  function conv4() {
    var C = G.converge4;
    return '<div class="conv4"><b>' + esc(C.title) + '</b><dl>' + C.rows.map(function (r) { return '<div><dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd></div>'; }).join('') + '</dl><p>' + C.line.map(esc).join('<br>') + '</p></div>';
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
    return '<p class="evlink"><a href="#everyday"><b>Everyday arrows</b> One morning, eight events, and what each sets in motion →</a></p>' + selectorBar() + focusRow() +
      '<div class="ws">' +
        '<section class="card vis" aria-labelledby="visH" id="vis"><div class="sec-h"><span class="eyebrow">Graph</span><h2 id="visH" class="vis-h">' + esc(r.head) + '</h2><div class="tools">' + (r.tools || '') + '</div></div>' +
          (view.principle ? '<p class="principle">' + esc(view.principle) + '</p>' : '') + emph(S) + (view.note ? '<p class="note">' + esc(view.note) + '</p>' : '') + r.body + M.viewRead(view) + '</section>' +
        '<div class="side">' +
          '<section class="card fnd" aria-labelledby="fH"><div class="sec-h"><span class="eyebrow">Findings</span><h2 id="fH">' + (S.p === 'executive' ? 'What matters' : 'What we found') + '</h2></div>' + findingsHTML(S, view) + '</section>' +
          '<section class="card dcs" aria-labelledby="dH"><div class="sec-h"><span class="eyebrow">Decision</span><h2 id="dH">' + (S.p === 'executive' ? 'What decision is required' : 'What to do') + '</h2></div><p class="asks">' + esc(per.label) + ': ' + esc(per.asks) + '</p>' + decisionHTML(S, view) + '</section>' +
        '</div></div>' +
      '<p class="always">What looks protected here, but stops being protected somewhere else?</p>';
  }
  var focusAfter = null, focusSel = null, keepPop = false;
  /* A pop-up opens beside its button; where the header or the sentence wraps, that side can be
   * off the screen. Shift it back inside the window (8px margin), never past either edge. */
  function inView(el) {
    el.style.transform = '';
    var W = document.documentElement.clientWidth, r = el.getBoundingClientRect();
    if (r.left < 8) el.style.transform = 'translateX(' + Math.round(8 - r.left) + 'px)';
    else if (r.right > W - 8) el.style.transform = 'translateX(' + Math.round(W - 8 - r.right) + 'px)';
  }
  function closePop(e) { var pop = $('#msPop'); if (pop && !pop.hidden && !e.target.closest('.ms')) { pop.hidden = true; $('#selC').setAttribute('aria-expanded', 'false'); } var vm = $('#vmPop'); if (vm && !vm.hidden && !e.target.closest('.vm')) { vm.hidden = true; $('#vmBtn').setAttribute('aria-expanded', 'false'); } }
  function apply(s) { set({ page: 'cc', p: s.p, s: s.s, j: s.j, q: s.q, c: s.c.slice(), u: s.subj || 'person' }); }
  function mountCC() {
    var view = resolve(S), r = V[view.kind](S, view);
    if (r.mount) r.mount($('#vis'));
    [['selP', 'p'], ['selJ', 'j'], ['selQ', 'q'], ['selU', 'u']].forEach(function (x) { $('#' + x[0]).addEventListener('change', function () { var o = {}; o[x[1]] = this.value; focusAfter = x[0]; set(o); }); });
    $('#selS').addEventListener('change', function () { focusAfter = 'selS'; set({ s: this.value, j: byId(G.surfaces, this.value).j }); });
    var pop = $('#msPop'), btn = $('#selC');
    btn.addEventListener('click', function () { var open = pop.hidden; pop.hidden = !open; btn.setAttribute('aria-expanded', open); if (open) { inView(pop); var f = $('input', pop); if (f) f.focus(); } });
    pop.addEventListener('change', function (e) { focusAfter = e.target.id; keepPop = true; set({ c: $$('input:checked', pop).map(function (i) { return i.value; }) }); });
    $('#msClear').addEventListener('click', function () { focusAfter = 'selC'; set({ c: [] }); });
    if (keepPop) { pop.hidden = false; inView(pop); btn.setAttribute('aria-expanded', 'true'); keepPop = false; }
    $$('[data-l]').forEach(function (b) { b.addEventListener('click', function () { focusAfter = null; set({ l: b.getAttribute('data-l') }); }); });
    $$('[data-fv]').forEach(function (b) { b.addEventListener('click', function () { apply(G.focus[+b.getAttribute('data-fv')].s); }); });
  }

  function featureReviews() {
    return '<p>Each review opens the Command Center with its lenses set. Conditions are the controls that must hold, with their latest evidence.</p>' +
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
    var tabs = '<div class="seg evt" role="radiogroup" aria-label="Evidence view"><button role="radio" data-ev="all" aria-checked="' + (S.ev !== 'time' && S.ev !== 'claims') + '">Controls</button><button role="radio" data-ev="time" aria-checked="' + (S.ev === 'time') + '">Datasets over time</button><button role="radio" data-ev="claims" aria-checked="' + (S.ev === 'claims') + '">Documented claims</button></div>';
    var head = '<div class="pg-h"><h1>Evidence</h1><p>What shows a promise holds. Documented claims are the companies’ own; controls and datasets are Northstar’s, and synthetic. A test is a recommendation until someone runs it.</p></div>' + M.evidenceLegend() + tabs;
    if (S.ev === 'claims') return head + M.claimsPage(S);
    if (S.ev === 'time') return head + M.band('syn', 'Each Northstar record followed across time: where it is, why it exists, how it is protected, whether it can be recovered, and whether a hold overrides its end.') + timeRegister();
    return head + M.band('syn', 'One record per Northstar control: the invariant it promises, where it lives, and the last proof that it holds.') +
      '<div class="seg evf" role="radiogroup" aria-label="Filter controls">' + F2.map(function (f) { return '<button role="radio" data-ev="' + f[0] + '" aria-checked="' + (S.ev === f[0]) + '">' + f[1] + ' <span>' + (counts[f[0]] || 0) + '</span></button>'; }).join('') + '</div>' +
      '<div class="evl">' + shown.map(function (id) {
        var c = G.controls[id], k = ctlClass(id), fr = freshness(c.last);
        return '<article class="card evc ev-' + k + '"><div class="evh"><h2>' + esc(name(id)) + '</h2>' + stTag(L[k][0], L[k][1]) + '</div><p class="inv">' + esc(c.inv) + '</p>' +
          '<dl class="evd"><div><dt>Where</dt><dd>' + esc(c.where) + '</dd></div><div><dt>Last test</dt><dd>' + esc(c.last || '—') + ' · ' + esc(fr.t) + '</dd></div><div><dt>Method</dt><dd>' + esc(c.method) + '</dd></div></dl>' +
          '<button class="linkbtn" data-open-ctl="' + esc(c.c[0]) + '">Did it really work? →</button></article>';
      }).join('') + '</div>';
  }

  function timeRegister() {
    return '<div class="evl">' + G.transforms.map(function (t) {
      var deps = [t.key && name(t.key) + (G.keys[t.key] && G.keys[t.key].destroyed ? ' (destroyed)' : ''), t.norm, t.type === 'tokenized' && name('sy_vault'), t.node === 'ds_archive' && name('sc_v14')].filter(Boolean);
      var h = t.hold && G.holds.filter(function (x) { return x.id === t.hold; })[0];
      return '<article class="card evc ev-' + (t.proof[0] === 'fail' ? 'fail' : t.proof[0] === 'ok' ? 'ok' : 'never') + '"><div class="evh"><h2>' + esc(name(t.node)) + '</h2>' + stTag(t.rec === 'irreversible' ? 'ok' : t.rec === 'unknown' ? 'unk' : 'warn', G.recoverability[t.rec]) + '</div>' +
        '<dl class="evd tvd">' + [['Where is it now?', t.where], ['Why does it exist?', t.why], ['Who can access it?', t.who], ['How is it protected?', G.transformTypes[t.type] + (t.alg ? ': ' + t.alg + (t.ver ? ', ' + t.ver : '') : '')], ['Can it be recovered?', G.recoverability[t.rec]],
          ['What does recovery depend on?', deps.join(' + ') || 'Nothing: it is in the clear'], ['When should it become unrecoverable?', t.until], ['Is a preservation requirement overriding that?', h ? name(h.id) + ' (' + h.status + ')' : 'No'], ['Can we prove all of the above?', t.proof[1]]]
          .map(function (r) { return '<div><dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd></div>'; }).join('') + '</dl></article>';
    }).join('') + '</div>';
  }

  /* ═══════════ ASK PRIVACY — deterministic, cites the graph ═══════════ */
  var ASK = [
    /* across time: recoverability, preservation and key lifecycle */
    { q: 'Which datasets physically exist but can no longer be meaningfully recovered?', k: /physically|no longer be (meaningfully )?recovered|meaningfully/i, a: function () {
      var gone = G.transforms.filter(function (t) { return t.type === 'shredded'; });
      return gone.map(function (t) { return ['FACT', name(t.node) + ' is still in ' + t.where.toLowerCase() + ', but ' + name(t.key) + ' was destroyed on ' + G.keys[t.key].destroyed + ', so it cannot be decrypted.', [t.node, t.key]]; })
        .concat(G.edges.filter(function (e) { return e[1] === 'DERIVED_FROM' && gone.some(function (t) { return t.node === e[2]; }); }).map(function (e) { return ['CONTROL FAILURE', name(e[0]) + ' is a decrypted copy that outlived the key, so ' + name(e[2]) + ' is still readable there.', [e[0], 'c_key_destroy']]; }),
          [['INFERENCE', 'Encrypted data without an available key may be operationally equivalent to deleted data; whether that meets a deletion obligation is a separate, legal question.', []],
           ['RECOMMENDATION', 'Delete plaintext copies before destroying a key, then prove a decrypt attempt fails.', ['c_key_destroy']]]); } },
    { q: 'Would deleting this key violate an active preservation requirement?', k: /deleting (this|the) key|violate|preservation requirement/i, a: function () {
      return Object.keys(G.keys).map(function (k) { var h = holdsCovering(k); return h.length ? ['CONTROL FAILURE', 'Yes for ' + name(k) + ': it is held by ' + h.map(function (x) { return name(x.id); }).join(', ') + ', and the rotation job does not check holds.', [k].concat(h.map(function (x) { return x.id; }), ['c_hold_keys'])] : null; }).filter(Boolean)
        .concat([['FACT', 'Keys outside any active hold: ' + Object.keys(G.keys).filter(function (k) { return !holdsCovering(k).length; }).map(name).join(', ') + '.', []],
          ['RECOMMENDATION', 'Make key destruction check active holds first, and record the check.', ['c_hold_keys']]]); } },
    { q: 'Which data becomes unrecoverable if this key is destroyed?', k: /key is destroyed|destroy(ed|ing)? (the |a |this )?key|unrecoverable if/i, a: function () {
      return Object.keys(G.keys).filter(function (k) { return !G.keys[k].destroyed; }).map(function (k) { var I = keyImpact(k); return ['FACT', name(k) + ': ' + I.deps.map(function (d) { return name(d.node) + ' ' + (CONSEQ[d.type] || 'becomes unusable'); }).join('; ') + '.', [k].concat(I.deps.map(function (d) { return d.node; }))]; })
        .concat([['RECOMMENDATION', 'Before any destruction: list dependents, check holds, remove plaintext copies.', ['c_key_destroy', 'c_hold_keys']]]); } },
    { q: 'Can this dataset be decrypted?', k: /decrypt/i, a: function () {
      return G.transforms.filter(function (t) { return t.type === 'encrypted' || t.type === 'shredded'; }).map(function (t) { var K = G.keys[t.key]; return ['FACT', name(t.node) + ': ' + (K.destroyed ? 'no. ' + name(t.key) + ' was destroyed on ' + K.destroyed + '.' : 'yes, with ' + name(t.key) + ' through the ' + name(K.store) + '. ' + K.operator + '.'), [t.node, t.key]]; })
        .concat([['UNKNOWN', 'Whether the archive can actually be opened end to end: no restore drill has run.', ['c_restore_drill']]]); } },
    { q: 'Who holds the key?', k: /who holds|holds the key|key owner|owns the key/i, a: function () {
      return Object.keys(G.keys).map(function (k) { var K = G.keys[k]; return ['FACT', name(k) + ' (' + K.type + '): ' + name(K.owner) + ', in the ' + name(K.store) + '; ' + K.status + '.', [k, K.owner]]; })
        .concat([['FACT', 'No customer-managed keys are in use.', ['sy_kms']]]); } },
    { q: 'Can I match this hashed identifier back to a known customer?', k: /hash/i, a: function () {
      var T = tf('id_hash');
      return [['FACT', 'It cannot be decrypted: ' + T.alg + ' has no key and no reverse operation.', ['id_hash']],
        ['FACT', 'Applying the same transformation to a known email and comparing reproduces the stored value, so a known customer can be matched.', ['id_hash']],
        ['INFERENCE', 'Anyone holding a list of email addresses, including the partner, can do the same. Hashed is not anonymous.', ['v_adreach']],
        ['RECOMMENDATION', 'Use a keyed pseudonym per partner, or send no identifier.', ['c_key_inventory']]]; } },
    { q: 'Which algorithm and key version created this pseudonym?', k: /pseudonym|key version|algorithm/i, a: function () {
      var T = tf('id_pseudo');
      return [['FACT', 'Current pseudonyms: ' + T.alg + ' ' + T.ver + ', key ' + name(T.key) + ', rule ' + T.norm + '.', ['id_pseudo', T.key, 'nr_v3']],
        ['CONTROL FAILURE', 'Pseudonyms created before 2025 carry no key-version tag.', ['c_key_inventory']],
        ['UNKNOWN', 'Whether today’s rule reproduces the 2026 pseudonyms: never tested.', ['id_pseudo']],
        ['RECOMMENDATION', 'Tag every pseudonym with key and rule versions; keep both for as long as the data.', ['c_key_inventory']]]; } },
    { q: 'Which records are currently under legal hold?', k: /legal hold|under (a )?hold|on hold/i, a: function () {
      return G.holds.filter(function (h) { return h.status === 'active'; }).map(function (h) { return ['FACT', name(h.id) + ', since ' + h.start + ': ' + h.scope + '. Preserved: ' + h.items.filter(function (i) { return i[2] === 'held'; }).map(function (i) { return name(i[1]); }).join(', ') + '.', [h.id]]; })
        .concat(G.holds[0].items.filter(function (i) { return i[2] !== 'held'; }).map(function (i) { return ['UNKNOWN', i[0] + ' (' + name(i[1]) + '): ' + G.holdStates[i[2]][1] + '.', [i[1]]]; }),
          [['RECOMMENDATION', 'Preserve only what is in scope, with its keys, mapping, schema and lineage.', ['c_hold_keys']]]); } },
    { q: 'Can this five-year-old archive actually be restored?', k: /archive|restor/i, a: function () {
      var A = G.archive;
      return [['FACT', 'Archive ' + A.id + ' exists: ' + A.format.toLowerCase() + ', created ' + A.created + '.', [A.node]]]
        .concat(A.deps.filter(function (d) { return d.st.asis !== 'ok'; }).map(function (d) { return ['UNKNOWN', d.n + ' (' + d.rel + '): not verified for future use.', [d.node]]; }),
          [['RECOMMENDATION', 'Record every dependency with the archive and run a yearly restore drill.', ['c_restore_drill']]]); } },
    { q: 'Which token mappings are required to interpret these records?', k: /token|mapping|vault/i, a: function () {
      var M = G.tokenMap;
      return [['FACT', M.token + ' in ' + M.reuse.map(name).join(' and ') + ' resolves only through the ' + name(M.vault) + '.', ['sy_vault', 'id_tok']],
        ['FACT', 'The mapping is kept ' + M.mapRet + '; the tokens expire after ' + M.tokRet + '.', ['sy_vault']],
        ['CONTROL FAILURE', 'The same token appears in ' + M.reuse.map(name).join(' and ') + ', so it links them.', ['id_tok']],
        [M.held ? 'FACT' : 'UNKNOWN', M.held ? 'The mapping is preserved under ' + holdsCovering(M.vault).map(function (h) { return name(h.id); }).join(', ') + '.' : 'Whether the mapping is preserved.', [M.vault]]]; } },
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
  var KORDER = { FACT: 0, DOCUMENTED: 0, SETTING: 0, LIMIT: 0, 'CONTROL FAILURE': 1, INFERENCE: 2, TEST: 3, RECOMMENDATION: 3, UNKNOWN: 4 };
  function answer(text) {
    var hit = null; ASK.forEach(function (x) { if (!hit && x.q.toLowerCase() === text.toLowerCase()) hit = x; });
    if (!hit) ASK.forEach(function (x) { if (!hit && x.k.test(text)) hit = x; });
    if (!hit) return { q: text, lines: [['UNKNOWN', 'The graph holds no records that answer this, so there is no answer to give. Try one of the questions below.', []]] };
    return { q: hit.q, lines: hit.a().sort(function (a, b) { return KORDER[a[0]] - KORDER[b[0]]; }) };
  }
  G.answer = answer;
  function askPage() {
    var a = S.ask ? answer(S.ask) : null;
    return '<div class="pg-h"><h1>Ask privacy</h1><p>Answers come from the graph and from what the companies document. Each line says whether it is a fact, a documented claim, a setting, a limit, a test, an inference, a recommendation or unknown, and names its records. Nothing is made up to fill a gap.</p></div>' +
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
      var MP = M.pages[S.page];
      /* A mode's view mounts on a fresh wrapper, never on #main: #main outlives every render,
       * so a listener bound to it would pile up, one more per render, and each click would
       * redraw twice as often as the last (2026-10-05 incident, docs/INCIDENTS.md). */
      main.innerHTML = MP ? '<div class="mp">' + MP.render(S) + '</div>' : S.page === 'evidence' ? evidencePage() : S.page === 'ask' ? askPage() : ccPage();
      if (MP) MP.mount(main.firstElementChild); else if (S.page === 'cc') mountCC();
      if (S.page === 'evidence') { M.mountLens(main); $$('[data-kind]', main).forEach(function (b) { b.addEventListener('click', function () { focusSel = '[data-kind="' + b.getAttribute('data-kind') + '"]'; set({ ek: b.getAttribute('data-kind') }); }); }); }
      /* each data cell carries its column name, so a phone can show a table as stacked rows */
      $$('table.rel, table.util, table.priv, table.pkt, table.otime', main).forEach(function (t) { var hs = $$('thead th', t).map(function (h) { return h.textContent; }); $$('tbody tr', t).forEach(function (r) { $$('td', r).forEach(function (c) { var h = hs[c.cellIndex]; if (h) c.setAttribute('data-h', h); }); }); });
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
    $('#vmBtn').addEventListener('click', function () { var p = $('#vmPop'), open = p.hidden; p.hidden = !open; this.setAttribute('aria-expanded', open); if (open) { inView(p); $('.vm-i', p).focus(); } });
    if (focusAfter) { var el = document.getElementById(focusAfter); if (el) el.focus(); focusAfter = null; }
    if (focusSel) { var fe = $(focusSel); if (fe) { if (!fe.matches('button,a,input,select,[tabindex]')) fe.setAttribute('tabindex', '-1'); fe.focus(); } focusSel = null; }
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
  /* the modes get what they need from here, and nothing else */
  M = window.PCC_MODES({ G: G, EV: EV, V: V, $: $, $$: $$, esc: esc, name: name, plural: plural, tag: tag, stTag: stTag, mark: mark, freshness: freshness, fmtDate: fmtDate,
    S: function () { return S; }, set: set, render: render, focusNext: function (sel) { focusSel = sel; }, answer: answer,
    eventsLayer: eventsLayer, mountEvents: mountEvents, devicesHTML: devicesHTML, featureReviews: featureReviews });
  for (var dk in M.defs) DEF[dk] = M.defs[dk];
  ASK.push.apply(ASK, M.ask);
  /* the essay links in with ?view=product&product=browser, ?view=layers&hop=tls …; turn that into a route */
  (function () {
    if (!/[?&]view=/.test(location.search)) return;
    var p = {}; location.search.replace(/^\?/, '').split('&').forEach(function (kv) { var i = kv.indexOf('='); if (i > 0) p[decodeURIComponent(kv.slice(0, i))] = decodeURIComponent(kv.slice(i + 1).replace(/\+/g, ' ')); });
    history.replaceState(null, '', location.pathname + M.fromView(p));
  })();
  S = parse();
  if (!new RegExp('^#(' + PAGES.join('|') + ')').test(location.hash) || location.hash.indexOf('#' + S.page) !== 0) history.replaceState(null, '', hashFor(S));
  render();
  window.PCC1 = { offered: offered, state: function () { return copy(S); }, resolve: resolve, findings: function () { return findingsFor(S, resolve(S)).list.map(function (f) { return f.id; }); }, set: set, fit: function (st) { return fit(Object.assign(copy(DEF), st)); },
    events: function () { return EVM.cur ? { set: EVM.cur.set, st: EVM.cur.st, R: EVM.cur.R, hl: EVM.cur.hlId, dec: copy(EVM.dec), edge: EVM.edge, node: EVM.node } : null; } };
})();
