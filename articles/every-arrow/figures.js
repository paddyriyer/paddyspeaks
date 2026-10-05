/* Every Arrow Is a Decision — the interactive figures.
 *
 * Each figure reads its data from EA_DATA (data.js), its Northstar numbers from
 * EA_NS (northstar.js, generated from the Command Center's dataset) and its
 * arithmetic from EA_MODEL (model.js), then registers with the framework
 * (core.js) as EA.fig(id, { get, set, reset, read }). The static fallback for
 * every figure is already in the HTML, written by the build from the same data.
 */
(function (root) {
  'use strict';
  var EA = root.EA, D = root.EA_DATA, NS = root.EA_NS, M = root.EA_MODEL;
  if (!EA || !D || !M) return;
  var $ = EA.$, $$ = EA.$$, el = EA.el, esc = EA.esc, RM = EA.RM;
  var SVGNS = 'http://www.w3.org/2000/svg';
  function sv(tag, attrs) { var e = document.createElementNS(SVGNS, tag); if (attrs) Object.keys(attrs).forEach(function (k) { e.setAttribute(k, attrs[k]); }); return e; }
  function live(id) { var f = document.getElementById('fig-' + id); return f && $('.fig-live', f); }
  function clamp(i, n) { i = parseInt(i, 10); return isNaN(i) ? 0 : Math.max(0, Math.min(n - 1, i)); }
  /* A row of buttons acting as one choice (tablist or radiogroup). */
  function choices(host, items, label, role, onPick) {
    role = role || 'tablist';
    host.setAttribute('role', role);
    host.setAttribute('aria-label', label);
    var btns = items.map(function (html, i) {
      var b = el('button', { type: 'button', role: role === 'tablist' ? 'tab' : 'radio' }, html);
      b.addEventListener('click', function () { onPick(i); });
      host.appendChild(b); return b;
    });
    EA.arrowKeys(host, 'button');
    return btns;
  }
  function pick(btns, i, role) { EA.select(btns, i, role === 'radiogroup' ? 'aria-checked' : 'aria-selected'); }

  /* ═════════ CHAPTER 1 · SEE ═════════ */

  /* 01 · One person, no name — which inferences survive a join policy */
  (function () {
    var asm = $('#asm'); if (!asm) return;
    var P = D.person, mode = 0, timers = [];
    var linesSvg = sv('svg', { 'class': 'asm-lines', 'aria-hidden': 'true' });
    asm.insertBefore(linesSvg, asm.firstChild);
    var infChips = $$('.asm-inf .chip', asm);
    function edgePt(r, box, px) {
      var cy = r.top + r.height / 2 - box.top;
      if (r.right - box.left < px) return [r.right - box.left, cy];
      if (r.left - box.left > px) return [r.left - box.left, cy];
      return null;
    }
    function draw() {
      while (linesSvg.firstChild) linesSvg.removeChild(linesSvg.firstChild);
      var box = asm.getBoundingClientRect(), p = $('.asm-person svg', asm).getBoundingClientRect();
      var px = p.left + p.width / 2 - box.left, py = p.top + p.height / 2 - box.top;
      $$('.asm-ids .chip', asm).forEach(function (c, i) {
        var e = edgePt(c.getBoundingClientRect(), box, px); if (!e) return;
        var l = sv('line', { x1: e[0], y1: e[1], x2: px, y2: py, 'class': 'l-id', pathLength: '1' });
        l.style.transitionDelay = (0.9 + i * 0.12) + 's';
        linesSvg.appendChild(l);
      });
      infChips.forEach(function (c, i) {
        var e = edgePt(c.getBoundingClientRect(), box, px); if (!e) return;
        var l = sv('line', { x1: px, y1: py, x2: e[0], y2: e[1], 'class': 'l-inf' + (c.classList.contains('off') ? ' off' : '') });
        l.style.transitionDelay = (2.2 + i * 0.3) + 's';
        linesSvg.appendChild(l);
      });
    }
    function apply() {
      var st = M.person(P, P.modes[mode].id);
      st.forEach(function (s, i) {
        var c = infChips[i]; if (!c) return;
        c.classList.toggle('off', !s.on);
        var w = $('.why', c); if (w) w.textContent = s.on ? '' : s.why;
      });
      asm.setAttribute('data-mode', P.modes[mode].id);
      $('#asmMode').textContent = P.modes[mode].d;
      pick(btns, mode, 'radiogroup');
      draw();
      var n = st.filter(function (s) { return s.on; }).length;
      $('#asmCount').innerHTML = 'Five identifiers. <span>Zero names.</span> ' + n + ' inference' + (n === 1 ? '' : 's') + ' about one person.';
    }
    function play() {
      timers.forEach(clearTimeout); timers = [];
      asm.classList.remove('play', 'lit');
      draw(); void asm.offsetWidth;
      if (RM) { asm.classList.add('play', 'lit'); return; }
      timers.push(setTimeout(function () { asm.classList.add('play'); }, 60));
      timers.push(setTimeout(function () { asm.classList.add('lit'); }, 1800));
    }
    var btns = choices($('#asmModes'), P.modes.map(function (m) { return m.t; }), 'Join policy', 'radiogroup', function (i) { mode = i; apply(); EA.changed('person'); });
    $('#asmReplay').addEventListener('click', play);
    var played = false;
    EA.onView(asm, function () { played = true; play(); }, '0px 0px -25% 0px');
    var rt; root.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { if (played) draw(); }, 150); });
    apply();
    EA.fig('person', {
      get: function () { return P.modes[mode].id; },
      set: function (s) { var i = P.modes.map(function (m) { return m.id; }).indexOf(s); mode = i < 0 ? 0 : i; apply(); },
      reset: function () { mode = 0; apply(); play(); },
      read: function () {
        var st = M.person(P, P.modes[mode].id), on = st.filter(function (s) { return s.on; });
        return '<b>' + esc(P.modes[mode].t) + ':</b> ' + on.length + ' of ' + st.length + ' inferences can be made about Dana' + (on.length ? ' — ' + esc(on.map(function (s) { return s.v.toLowerCase(); }).join('; ')) : '') + '.' +
          (mode === 0 ? ' Every inference needs a join that nothing forbids.' : mode === 1 ? ' Scoping stops the cross-purpose joins; “likely pregnant” survives because it needs only one product’s own basket history.' : ' Only an inference that needs no join and no sensitive category remains.');
      }
    });
  })();

  /* 02 · Two harmless tables */
  (function () {
    var btn = $('#joinBtn'), box = $('#tables'); if (!btn) return;
    var on = false;
    function apply() { box.classList.toggle('joined', on); btn.setAttribute('aria-pressed', on ? 'true' : 'false'); btn.innerHTML = on ? 'Undo join' : 'Join &#8644;'; }
    btn.addEventListener('click', function () { on = !on; apply(); EA.changed('join'); });
    apply();
    EA.fig('join', {
      get: function () { return on ? 'joined' : 'apart'; },
      set: function (s) { on = s === 'joined'; apply(); },
      reset: function () { on = false; apply(); },
      read: function () { return on ? '<b>Joined on ZIP, birth date and sex:</b> the “de-identified” diagnosis now has a name — R. Alvarez, depression. Neither table held both facts.' : '<b>Apart:</b> one table has diagnoses without names; the other has names without diagnoses. Neither reveals who has which diagnosis.'; }
    });
  })();

  /* 02 · The crowd */
  (function () {
    var cv = $('#crowd'); if (!cv) return;
    var C = M.crowd(), T = C.people[C.target], A = C.people.map(function () { return { a: 1, ta: 1 }; });
    var KEYS = ['zip', 'sex', 'year', 'day'], on = {};
    var ctx = cv.getContext('2d'), W, H, cols, cell, dpr = root.devicePixelRatio || 1, raf = null;
    var cs = getComputedStyle(cv);
    var INK = cs.getPropertyValue('--ink').trim() || '#121315', HOT = cs.getPropertyValue('--hot').trim() || '#b23a0a';
    function size() { W = cv.clientWidth || 600; cols = W < 520 ? 25 : 50; cell = W / cols; H = Math.ceil(1000 / cols) * cell; cv.style.height = H + 'px'; cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
    function match(p) { return KEYS.every(function (k) { return !on[k] || p[k] === T[k]; }); }
    function paint() {
      ctx.clearRect(0, 0, W, H);
      var r = cell * 0.3, n = A.filter(function (x) { return x.ta === 1; }).length;
      C.people.forEach(function (p, i) {
        var x = (i % cols) * cell + cell / 2, y = Math.floor(i / cols) * cell + cell / 2, me = i === C.target && n === 1;
        ctx.globalAlpha = 0.08 + A[i].a * 0.92; ctx.fillStyle = me ? HOT : INK;
        ctx.beginPath(); ctx.arc(x, y, me ? r * 1.6 : r, 0, Math.PI * 2); ctx.fill();
        if (me) { ctx.globalAlpha = 1; ctx.strokeStyle = HOT; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, r * 3.4, 0, Math.PI * 2); ctx.stroke(); }
      });
      ctx.globalAlpha = 1;
    }
    function step() { var moving = false; A.forEach(function (x) { var d = x.ta - x.a; if (Math.abs(d) > 0.01) { x.a += d * 0.14; moving = true; } else x.a = x.ta; }); paint(); raf = moving ? requestAnimationFrame(step) : null; }
    function update() {
      C.people.forEach(function (p, i) { A[i].ta = match(p) ? 1 : 0; if (RM) A[i].a = A[i].ta; });
      var n = M.crowdMatch(C, on);
      $('#crowdN').textContent = n.toLocaleString('en-US'); $('#crowdN').classList.toggle('one', n === 1);
      $('#crowdCap').textContent = n === 1 ? 'person matches. Anonymous no longer: that is your target.' : n <= 5 ? 'people match. Close enough to check each one by hand.' : n === 1000 ? 'people match. No one is identified.' : 'people match.';
      $$('.crowd-ctl .tog').forEach(function (b) { b.setAttribute('aria-pressed', on[b.getAttribute('data-q')] ? 'true' : 'false'); });
      if (RM) paint(); else if (!raf) raf = requestAnimationFrame(step);
    }
    $$('.crowd-ctl .tog').forEach(function (b) { b.addEventListener('click', function () { var k = b.getAttribute('data-q'); on[k] = !on[k]; update(); EA.changed('crowd'); }); });
    size(); update(); paint();
    var rt; root.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { size(); paint(); }, 120); });
    EA.fig('crowd', {
      get: function () { return KEYS.filter(function (k) { return on[k]; }).join('+') || 'none'; },
      set: function (s) { on = {}; String(s).split('+').forEach(function (k) { if (KEYS.indexOf(k) >= 0) on[k] = true; }); update(); },
      reset: function () { on = {}; update(); },
      read: function () {
        var n = M.crowdMatch(C, on), ks = KEYS.filter(function (k) { return on[k]; });
        var names = { zip: 'ZIP code', sex: 'sex', year: 'birth year', day: 'birthday' };
        return '<b>' + (ks.length ? 'Knowing ' + ks.map(function (k) { return names[k]; }).join(', ') : 'Knowing nothing') + ':</b> ' + n.toLocaleString('en-US') + ' of 1,000 synthetic people match.' + (n === 1 ? ' The target is unique — a name is one lookup away.' : '');
      }
    });
  })();

  /* 02 · Identifier spectrum */
  (function () {
    var host = $('#specStops'); if (!host) return;
    var S = D.spectrum, cur = 0;
    var btns = choices(host, S.map(function (s) { return s[0].toUpperCase(); }), 'Identifier classes, from links everything to links nothing', 'tablist', function (i) { sel(i); EA.changed('spectrum'); });
    function sel(i) { cur = i; pick(btns, i); $('#specOut').innerHTML = '<div><span>Example</span>' + esc(S[i][1]) + '</div><div><span>Links a person across</span>' + esc(S[i][2]) + '</div><div><span>Use when</span>' + esc(S[i][3]) + '</div>'; }
    sel(0);
    EA.fig('spectrum', {
      get: function () { return String(cur); }, set: function (s) { sel(clamp(s, S.length)); }, reset: function () { sel(0); },
      read: function () { return '<b>' + esc(S[cur][0]) + ' identifier</b> (' + esc(S[cur][1]) + ') links a person across ' + esc(S[cur][2].toLowerCase()) + '. Use when: ' + esc(S[cur][3]); }
    });
  })();

  /* 03 · The history hole */
  (function () {
    var hh = $('#hh'); if (!hh) return;
    var day = 0, role = 'editor', fixed = false, timers = [];
    var ROWS = [['A. Mensah', '148,000'], ['B. Laurent', '131,500'], ['C. Ito', '162,000'], ['D. Novak', '119,000'], ['E. Farah', '154,250'], ['F. Quinn', '127,800']];
    var RN = { owner: 'Owner', editor: 'Editor', commenter: 'Commenter', viewer: 'Viewer' };
    function table() { return '<table><thead><tr><th>Name</th><th>Base salary</th></tr></thead><tbody>' + ROWS.map(function (r) { return '<tr><td>' + r[0] + '</td><td>' + r[1] + '</td></tr>'; }).join('') + '</tbody></table><p class="more">… 34 more rows · 40 names, 40 numbers</p>'; }
    var intro = '<h4>Q3 planning</h4><p>Agenda: roadmap review, hiring plan, offsite logistics.</p>', gone = '<p class="gone">Comp discussion moved to the HR system.</p>';
    var dayBtns = $$('#hhDays button'), roleBtns = $$('#hhRole button');
    function exposed() { return !fixed && (role === 'owner' || role === 'editor'); }
    function render() {
      EA.select(dayBtns, day); EA.select(roleBtns, Object.keys(RN).indexOf(role), 'aria-checked');
      var doc = $('#hhDoc'), vh = $('#hhVh'), body = $('.hh-body', hh), canHist = role === 'owner' || role === 'editor';
      dayBtns[3].querySelector('span').textContent = exposed() ? 'Exposed' : 'Nothing to see';
      dayBtns[3].classList.toggle('hot', exposed());
      $('#hhTitle').textContent = (fixed && day >= 2 ? 'Copy of Q3 planning' : 'Q3 planning') + ' — shared doc';
      $('#hhShare').innerHTML = '<i title="Priya (owner)">P</i>' + (day >= 2 ? '<i class="new" title="Contractor">C</i>' + RN[role] : '');
      doc.classList.remove('past');
      var open = false, vhHtml = '';
      if (day === 0) doc.innerHTML = '<span class="banner">Monday · 9:03 AM · salary sheet pasted in</span>' + intro + '<p>Comp review (do not share):</p>' + table();
      else if (day === 1) doc.innerHTML = '<span class="banner ok">Tuesday · table deleted — the doc looks safe</span>' + intro + gone;
      else if (day === 2) doc.innerHTML = '<span class="banner">Friday · access granted</span>' + intro + gone + '<div class="dlg"><b>contractor@agency.example</b> added as <b>' + RN[role] + '</b>' + (fixed ? '<br><span style="color:var(--cool)">Shared a fresh copy. The original is retired; its history did not travel.</span>' : '') + '</div>';
      else {
        open = true;
        if (!canHist) { doc.innerHTML = '<span class="banner ok">Friday · 4 PM · the contractor looks for history</span>' + intro + gone; vhHtml = '<h5>Version history</h5><p class="deny">Not available to a ' + RN[role] + '. They see only the present.</p>'; }
        else if (fixed) { doc.innerHTML = '<span class="banner ok">Friday · 4 PM · the contractor opens version history</span>' + intro + gone; vhHtml = '<h5>Version history</h5><div class="v">Fri 3:58 PM<small>Current version</small></div><div class="v">Fri 3:40 PM<small>Created from a copy — no earlier versions</small></div>'; }
        else { doc.classList.add('past'); doc.innerHTML = '<span class="banner">File › Version history › Monday</span>' + intro + '<p>Comp review (do not share):</p>' + table(); vhHtml = '<h5>Version history</h5><div class="v">Fri 3:58 PM<small>Current version</small></div><div class="v">Tue 10:12 AM<small>Priya · table deleted</small></div><div class="v sel">Mon 9:03 AM<small>Priya · every name, every number</small></div>'; }
      }
      body.classList.toggle('vh-open', open);
      vh.innerHTML = open ? '<div class="in">' + vhHtml + '</div>' : '';
      var fx = $('#hhFix'); fx.setAttribute('aria-pressed', fixed ? 'true' : 'false'); fx.textContent = fixed ? 'Clean-room fix applied ✓' : 'Apply the clean-room fix';
    }
    function stop() { timers.forEach(clearTimeout); timers = []; }
    dayBtns.forEach(function (b, i) { b.addEventListener('click', function () { stop(); day = i; render(); EA.changed('history'); }); });
    EA.arrowKeys($('#hhDays'), 'button');
    roleBtns.forEach(function (b) { b.addEventListener('click', function () { role = b.getAttribute('data-r'); render(); EA.changed('history'); }); });
    EA.arrowKeys($('#hhRole'), 'button');
    $('#hhFix').addEventListener('click', function () { fixed = !fixed; render(); EA.changed('history'); });
    $('#hhPlay').addEventListener('click', function () {
      stop(); day = 0; render(); EA.changed('history');
      [1, 2, 3].forEach(function (dd, k) { timers.push(setTimeout(function () { day = dd; render(); EA.changed('history'); }, RM ? 0 : (k + 1) * 1700)); });
    });
    render();
    var DAYS = ['Monday', 'Tuesday', 'Friday', 'Friday 4 p.m.'];
    EA.fig('history', {
      get: function () { return day + '.' + role + (fixed ? '.fixed' : ''); },
      set: function (s) { var p = String(s).split('.'); day = clamp(p[0], 4); role = RN[p[1]] ? p[1] : 'editor'; fixed = p[2] === 'fixed'; render(); },
      reset: function () { stop(); day = 0; role = 'editor'; fixed = false; render(); },
      read: function () {
        var t = '<b>' + DAYS[day] + ', contractor as ' + RN[role] + (fixed ? ', clean-room fix on' : '') + ':</b> ';
        if (day < 3) return t + (day === 0 ? 'the salary sheet is on the page.' : day === 1 ? 'the table is deleted from the page; version history still holds Monday.' : 'the contractor is given access.');
        return t + (exposed() ? 'they open version history and read all 40 salaries from Monday. Permission to edit the present was permission to read the past.' : fixed ? 'the copy they were given has no history before today. Nothing to see.' : 'a ' + RN[role] + ' cannot open version history. They see only the present.');
      }
    });
  })();

  /* 04 · When the data is wrong */
  (function () {
    var host = $('#wrongUses'); if (!host) return;
    var W = D.wrong, use = 2, g = {};
    var btns = choices(host, W.uses.map(function (u) { return u.t; }), 'Where the wrong inference is used', 'radiogroup', function (i) { use = i; render(); EA.changed('wrong'); });
    var gh = $('#wrongGuards');
    var gbtns = W.guards.map(function (x) {
      var b = el('button', { type: 'button', 'class': 'tl-rule', role: 'switch', 'aria-checked': 'false', 'data-g': x.id }, '<span class="sw" aria-hidden="true"></span><span><b>' + esc(x.t) + '</b><span>' + esc(x.d) + '</span></span>');
      b.addEventListener('click', function () { g[x.id] = !g[x.id]; render(); EA.changed('wrong'); });
      gh.appendChild(b); return b;
    });
    function render() {
      pick(btns, use, 'radiogroup');
      gbtns.forEach(function (b) { var id = b.getAttribute('data-g'); b.setAttribute('aria-checked', g[id] ? 'true' : 'false'); b.classList.toggle('needed', W.uses[use].need.indexOf(id) >= 0); });
      var r = M.wrong(W, W.uses[use].id, g), u = r.use;
      $('#wrongOut').innerHTML =
        '<div class="wr-sev"><span>Harm if the merge is wrong</span><b class="s' + u.sev + '">' + W.sevWords[u.sev] + '</b></div>' +
        '<div class="wr-sev"><span>With the safeguards on</span><b class="s' + r.residual + '">' + W.sevWords[r.residual] + '</b></div>' +
        '<p class="wr-what"><b>For Dana:</b> ' + esc(u.what) + '</p>' +
        (u.need.length ? '<p class="wr-need"><b>This use needs:</b> ' + u.need.map(function (id) { var x = W.guards.filter(function (q) { return q.id === id; })[0]; return '<span class="' + (g[id] ? 'ok' : 'no') + '">' + (g[id] ? '✓ ' : '✗ ') + esc(x.t) + '</span>'; }).join('') + '</p>' : '<p class="wr-need">Low stakes: a correction path is courtesy, not a safeguard.</p>');
    }
    render();
    EA.fig('wrong', {
      get: function () { return W.uses[use].id + '.' + W.guards.map(function (x) { return g[x.id] ? 1 : 0; }).join(''); },
      set: function (s) { var p = String(s).split('.'), i = W.uses.map(function (u) { return u.id; }).indexOf(p[0]); use = i < 0 ? 2 : i; g = {}; W.guards.forEach(function (x, j) { if ((p[1] || '').charAt(j) === '1') g[x.id] = true; }); render(); },
      reset: function () { use = 2; g = {}; render(); },
      read: function () {
        var r = M.wrong(W, W.uses[use].id, g);
        return '<b>' + esc(r.use.t) + ':</b> harm if wrong is ' + W.sevWords[r.use.sev].toLowerCase() + '; with the safeguards chosen it is ' + W.sevWords[r.residual].toLowerCase() + '. ' + (r.missing.length ? 'Missing: ' + esc(r.missing.map(function (id) { return W.guards.filter(function (q) { return q.id === id; })[0].t.toLowerCase(); }).join('; ')) + '.' : r.use.need.length ? 'Every safeguard this use needs is in place.' : '');
      }
    });
  })();

  /* ═════════ CHAPTER 2 · DECIDE ═════════ */

  /* 05 · Eight questions */
  (function () {
    var dial = $('#dial'); if (!dial) return;
    var Q = D.eight, N = Q.length, cur = 0, C = 2 * Math.PI * 41;
    var host = el('div', { role: 'tablist', 'aria-label': 'The eight review questions' });
    host.style.cssText = 'position:absolute;inset:0';
    dial.appendChild(host);
    var btns = Q.map(function (q, i) {
      var a = (i / N) * Math.PI * 2 - Math.PI / 2;
      /* named by what it shows, then the question (WCAG 2.5.3: the visible label is part of the name) */
      var b = el('button', { type: 'button', 'class': 'dq', role: 'tab', 'aria-controls': 'eqPanel' }, '<span class="dn">0' + (i + 1) + '</span> ' + q[0] + '<span class="sr">: ' + q[1] + '</span>');
      b.style.left = (50 + Math.cos(a) * 41) + '%'; b.style.top = (50 + Math.sin(a) * 41) + '%';
      b.addEventListener('click', function () { sel(i); EA.changed('eight'); });
      host.appendChild(b); return b;
    });
    EA.arrowKeys(host, '.dq');
    function sel(i) {
      cur = i; pick(btns, i);
      $('#dialN').textContent = '0' + (i + 1); $('#dialW').textContent = Q[i][0];
      $('#dialArc').setAttribute('stroke-dasharray', C.toFixed(1));
      $('#dialArc').setAttribute('stroke-dashoffset', (C * (1 - Math.max(i / N, 0.001))).toFixed(1));
      $('#dialDot').style.transform = 'rotate(' + (i * 45) + 'deg)';
      $('#eqQ').textContent = Q[i][1]; $('#eqA').textContent = Q[i][2];
      $('#eqF').innerHTML = '<span class="tag tag--hot">Red flag</span><span>' + esc(Q[i][3]) + '</span>';
    }
    sel(0);
    EA.fig('eight', {
      get: function () { return String(cur); }, set: function (s) { sel(clamp(s, N)); }, reset: function () { sel(0); },
      read: function () { return '<b>Question ' + (cur + 1) + ' of 8, ' + Q[cur][0] + ':</b> ' + esc(Q[cur][1]) + ' Applied to Dana’s reminder: ' + esc(Q[cur][2]) + ' Red flag: ' + esc(Q[cur][3]); }
    });
  })();

  /* 06 · Lifecycle */
  (function () {
    var host = $('#life'); if (!host) return;
    var L = D.lifecycle, cur = 0;
    var btns = choices(host, L.map(function (l, i) { return '<span>0' + (i + 1) + ' · ' + l[1] + '</span>' + l[0].toUpperCase(); }), 'Data lifecycle stages', 'tablist', function (i) { sel(i); EA.changed('lifecycle'); });
    function sel(i) { cur = i; pick(btns, i); $('#lifeQ').innerHTML = '<span class="lq">' + esc(L[i][1]) + '</span> ' + esc(L[i][2]); }
    sel(0);
    EA.fig('lifecycle', {
      get: function () { return String(cur); }, set: function (s) { sel(clamp(s, L.length)); }, reset: function () { sel(0); },
      read: function () { return '<b>' + L[cur][0] + ' — ' + esc(L[cur][1]) + '</b> ' + esc(L[cur][2]); }
    });
  })();

  /* 06 · Every arrow: the flow map */
  (function () {
    var fig = $('#flowFig'); if (!fig) return;
    var N = D.flowNodes, E = D.flows, INIT = 'e2';
    var WIDE = { vb: [1100, 600], w: 150, h: 56, bound: [185, 130, 900, 450], bl: [200, 154],
      p: { device: [90, 210], sdk: [90, 440], vendor: [500, 55], gw: [290, 210], svc: [500, 210], bus: [710, 210], wh: [925, 210], log: [290, 360], mkt: [710, 360], bak: [925, 360], dash: [500, 505], model: [710, 505], fs: [925, 505] } };
    var TALL = { vb: [400, 890], w: 112, h: 50, bound: [8, 18, 264, 850], bl: [18, 858],
      p: { gw: [75, 60], device: [335, 60], svc: [75, 180], log: [200, 180], sdk: [335, 180], bus: [75, 300], vendor: [335, 300], wh: [75, 430], mkt: [200, 430], bak: [75, 560], fs: [200, 560], model: [200, 690], dash: [200, 810] } };
    var mode = null, selId = INIT, svg, list = $('#arrowList');
    E.forEach(function (e) {
      var b = el('button', { type: 'button', 'aria-pressed': 'false', 'data-e': e.id }, esc(e.t));
      if (e.hot) b.className = 'hot';
      b.addEventListener('click', function () { select(e.id); EA.changed('flow'); });
      list.appendChild(b);
    });
    function clip(c, t, w, h) { var dx = t[0] - c[0], dy = t[1] - c[1]; var sx = dx === 0 ? Infinity : (w / 2 + 6) / Math.abs(dx), sy = dy === 0 ? Infinity : (h / 2 + 6) / Math.abs(dy); var s = Math.min(sx, sy); return [c[0] + dx * s, c[1] + dy * s]; }
    function render() {
      var L = fig.clientWidth < 620 ? TALL : WIDE, m = L === TALL ? 'tall' : 'wide';
      if (m === mode && svg) return;
      mode = m; fig.innerHTML = '';
      svg = sv('svg', { viewBox: '0 0 ' + L.vb[0] + ' ' + L.vb[1], role: 'group', 'aria-label': 'Data-flow diagram of Northstar’s order path. Each arrow is a button that opens its privacy object.' });
      var defs = sv('defs');
      [['mk', '#63666c'], ['mkh', '#b23a0a'], ['mks', '#1d5bd8']].forEach(function (x) { var mk = sv('marker', { id: x[0], viewBox: '0 0 10 10', refX: '9', refY: '5', markerWidth: '7', markerHeight: '7', orient: 'auto-start-reverse', markerUnits: 'strokeWidth' }); mk.appendChild(sv('path', { d: 'M0 0 L10 5 L0 10 Z', fill: x[1] })); defs.appendChild(mk); });
      svg.appendChild(defs);
      var b = L.bound; svg.appendChild(sv('rect', { 'class': 'fl-bound', x: b[0], y: b[1], width: b[2], height: b[3], rx: 18 }));
      var bl = sv('text', { 'class': 'fl-bl', x: L.bl[0], y: L.bl[1] }); bl.textContent = L === TALL ? 'TRUST BOUNDARY' : 'TRUST BOUNDARY · NORTHSTAR’S SYSTEMS'; svg.appendChild(bl);
      var eg = sv('g'), ng = sv('g'), bg = sv('g'); svg.appendChild(eg); svg.appendChild(ng); svg.appendChild(bg);
      E.forEach(function (e) {
        var A = L.p[e.a], B = L.p[e.b], d, mid;
        if (e.curve && L === WIDE) { d = 'M' + (A[0] + L.w / 2 + 4) + ' ' + A[1] + ' C 1068 ' + A[1] + ' 1068 ' + B[1] + ' ' + (B[0] + L.w / 2 + 8) + ' ' + B[1]; mid = [1052, (A[1] + B[1]) / 2]; }
        else { var p1 = clip(A, B, L.w, L.h), p2 = clip(B, A, L.w, L.h); d = 'M' + p1[0].toFixed(1) + ' ' + p1[1].toFixed(1) + ' L' + p2[0].toFixed(1) + ' ' + p2[1].toFixed(1); mid = [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2]; }
        var g = sv('g', { 'data-e': e.id });
        var hit = sv('path', { d: d, 'class': 'fl-hit', tabindex: '0', role: 'button', 'aria-label': e.t + (e.hot ? ' (flagged: ' + (e.badge || '').toLowerCase() + ')' : '') });
        var line = sv('path', { d: d, 'class': 'fl-e' + (e.hot ? ' hot' : ''), 'marker-end': 'url(#' + (e.hot ? 'mkh' : 'mk') + ')' });
        var flow = sv('path', { d: d, 'class': 'fl-f' + (e.hot ? ' hot' : '') });
        hit.addEventListener('click', function () { select(e.id); EA.changed('flow'); });
        hit.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); select(e.id); EA.changed('flow'); } });
        g.appendChild(hit); g.appendChild(line); g.appendChild(flow); eg.appendChild(g);
        if (e.badge) { var tw = e.badge.length * 7 + 14; var bgp = sv('g', { 'class': 'fl-badge', transform: 'translate(' + (mid[0] - tw / 2).toFixed(1) + ' ' + (mid[1] - 10).toFixed(1) + ')' }); bgp.appendChild(sv('rect', { width: tw, height: 20, rx: 5 })); var bt = sv('text', { x: tw / 2, y: 10.5 }); bt.textContent = e.badge; bgp.appendChild(bt); bgp.style.pointerEvents = 'none'; bg.appendChild(bgp); }
      });
      Object.keys(N).forEach(function (k) {
        var n = N[k], P = L.p[k];
        var g = sv('g', { 'class': 'fl-node ' + n[2], transform: 'translate(' + (P[0] - L.w / 2) + ' ' + (P[1] - L.h / 2) + ')' });
        g.appendChild(sv('rect', { width: L.w, height: L.h, rx: 12 }));
        var t = sv('text', { x: L.w / 2, y: n[1] ? L.h / 2 + 7 : L.h / 2 }); t.textContent = n[0]; if (L === TALL) t.style.fontSize = '13px'; g.appendChild(t);
        if (n[1]) { var kk = sv('text', { 'class': 'k', x: L.w / 2, y: 15 }); kk.textContent = n[1]; g.appendChild(kk); }
        ng.appendChild(g);
      });
      fig.appendChild(svg);
      if (RM) $$('.fl-f', svg).forEach(function (f) { f.style.animation = 'none'; });
      paintSel();
    }
    function paintSel() {
      if (!svg) return;
      E.forEach(function (e) {
        var g = svg.querySelector('g[data-e="' + e.id + '"]'); if (!g) return;
        var line = g.querySelector('.fl-e'), on = e.id === selId;
        line.classList.toggle('sel', on); line.setAttribute('marker-end', 'url(#' + (on ? 'mks' : (e.hot ? 'mkh' : 'mk')) + ')');
        g.querySelector('.fl-hit').setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      $$('#arrowList button').forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-e') === selId ? 'true' : 'false'); });
    }
    function get(id) { return E.filter(function (x) { return x.id === id; })[0] || E[0]; }
    function select(id) {
      selId = get(id).id; var e = get(id);
      var tags = (e.tags || []).map(function (t, i) { return '<span class="tag ' + (e.hot ? 'tag--hot' : (i ? '' : 'tag--cool')) + '">' + esc(t) + '</span>'; }).join('') || '<span class="tag">Internal</span>';
      var dl = Object.keys(e.d).map(function (k) { return '<dt>' + k + '</dt><dd>' + esc(e.d[k]) + '</dd>'; }).join('');
      $('#po').innerHTML = '<span class="po-k">Privacy object · ' + e.id.toUpperCase() + '</span><h3>' + esc(e.t) + '</h3><div class="po-tags">' + tags + '</div><dl>' + dl + '</dl><p class="po-dec"><span>The decision</span>' + esc(e.dec) + '</p>';
      paintSel();
    }
    render(); select(selId);
    var rt; root.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(render, 120); });
    EA.fig('flow', {
      get: function () { return selId; }, set: function (s) { select(s); }, reset: function () { select(INIT); },
      read: function () { var e = get(selId); return '<b>' + esc(e.t) + (e.hot ? ' — flagged: ' + esc((e.badge || '').toLowerCase()) : '') + '.</b> Purpose: ' + esc(e.d.Purpose) + '. Retention: ' + esc(e.d.Retention) + '. Owner: ' + esc(e.d.Owner) + '. The decision: ' + esc(e.dec); }
    });
  })();

  /* 07 · Purpose at the moment of use */
  (function () {
    var host = $('#uses'); if (!host) return;
    var U = D.purpose, rows = [], timers = [], ran = false;
    U.forEach(function (u) {
      var r = el('div', { 'class': 'use' }, '<span class="who">' + esc(u[0]) + '<small>' + esc(u[1]) + '</small></span><span class="pipe" aria-hidden="true"><i></i></span><span class="why">Purpose: …</span><span class="v" aria-hidden="true">?</span>');
      host.appendChild(r); rows.push(r);
    });
    function show(i) { var r = rows[i], u = U[i]; r.classList.add(u[2] ? 'ok' : 'no'); r.querySelector('.why').textContent = u[3]; r.querySelector('.v').textContent = u[2] ? '✓' : '✗'; }
    function reset() { timers.forEach(clearTimeout); timers = []; ran = false; rows.forEach(function (r) { r.classList.remove('ok', 'no'); r.querySelector('.why').textContent = 'Purpose: …'; r.querySelector('.v').textContent = '?'; }); $('#driftSum').textContent = ''; }
    function run(instant) {
      reset(); ran = true;
      var ok = U.filter(function (u) { return u[2]; }).length;
      U.forEach(function (u, i) { timers.push(setTimeout(function () { show(i); if (i === U.length - 1) $('#driftSum').textContent = ok + ' allowed · ' + (U.length - ok) + ' denied at use time'; }, instant || RM ? 0 : 350 + i * 420)); });
    }
    $('#driftRun').addEventListener('click', function () { run(false); EA.changed('purpose'); setTimeout(function () { EA.changed('purpose'); }, RM ? 0 : 350 + U.length * 420); });
    EA.fig('purpose', {
      get: function () { return ran ? 'checked' : 'idle'; },
      set: function (s) { if (s === 'checked') { run(true); } else reset(); },
      reset: reset,
      read: function () { if (!ran) return 'Six requests are waiting to read <code>phone_number</code>. Press the button to check each purpose at the moment of use.'; var ok = U.filter(function (u) { return u[2]; }); return '<b>' + ok.length + ' allowed, ' + (U.length - ok.length) + ' denied.</b> Allowed: ' + esc(ok.map(function (u) { return u[0]; }).join(', ')) + '. Denied: ' + esc(U.filter(function (u) { return !u[2]; }).map(function (u) { return u[0] + ' (' + u[3].split(' — ')[0].toLowerCase() + ')'; }).join(', ')) + '.'; }
    });
  })();

  /* 08 · Harm chain */
  (function () {
    var host = $('#harmPick'); if (!host) return;
    var I = D.issues, cur = 0, timers = [];
    var hw = $('#harms');
    D.harms.forEach(function (h) { var s = el('span', null, esc(h)); s.setAttribute('data-h', h); hw.appendChild(s); });
    var btns = choices(host, I.map(function (it) { return esc(it[0]); }), 'Technical issues', 'tablist', function (i) { sel(i); EA.changed('harm'); });
    btns.forEach(function (b) { b.className = 'tog'; b.setAttribute('aria-controls', 'harmChain'); });
    function sel(i) {
      cur = i; timers.forEach(clearTimeout); timers = []; pick(btns, i);
      var it = I[i], cs = [$('#hc1'), $('#hc2'), $('#hc3')];
      cs.forEach(function (c, k) { c.classList.remove('on'); c.querySelector('p').textContent = it[k]; });
      cs.forEach(function (c, k) { timers.push(setTimeout(function () { c.classList.add('on'); }, RM ? 0 : 80 + k * 380)); });
      $$('#harms span').forEach(function (s) { s.classList.toggle('on', it[3].indexOf(s.getAttribute('data-h')) >= 0); });
      $('#harmFix').innerHTML = '<span>The control</span>' + esc(it[4]);
    }
    sel(0);
    EA.fig('harm', {
      get: function () { return String(cur); }, set: function (s) { sel(clamp(s, I.length)); }, reset: function () { sel(0); },
      read: function () { var it = I[cur]; return '<b>' + esc(it[0]) + '</b> → ' + esc(it[1].toLowerCase()) + ' → ' + esc(it[2]) + ' Control: ' + esc(it[4]); }
    });
  })();

  /* 09 · Make the trade-off consciously */
  (function () {
    var host = $('#toPick'); if (!host) return;
    var T = D.tradeoffs, cur = 0, alt = null, recorded = true;
    var btns = choices(host, T.map(function (t) { return esc(t.t); }), 'Design decisions', 'tablist', function (i) { cur = i; alt = null; render(); EA.changed('tradeoff'); });
    btns.forEach(function (b) { b.className = 'tog'; });
    var rec = $('#toRecord');
    rec.addEventListener('click', function () { recorded = !recorded; render(); EA.changed('tradeoff'); });
    function render() {
      pick(btns, cur);
      var t = T[cur];
      $('#toQ').textContent = t.q;
      var h = '';
      t.alts.forEach(function (a, i) {
        h += '<div class="to-alt' + (alt === i ? ' sel' : '') + '"><div class="to-alt-h"><span class="to-n">Option ' + 'ABC'.charAt(i) + '</span>' + (i === t.rec ? '<span class="tag tag--cool">Reviewer’s pick</span>' : '') + '</div><h4>' + esc(a.t) + '</h4><dl>' +
          [['Pros', a.pros], ['Cons', a.cons], ['Utility cost', a.utility], ['Privacy benefit', a.benefit], ['Trust assumption', a.trust], ['Residual risk', a.residual]].map(function (r) { return '<dt>' + r[0] + '</dt><dd>' + esc(r[1]) + '</dd>'; }).join('') +
          '</dl><button type="button" class="btn btn--sm' + (alt === i ? ' btn--solid' : '') + '" data-alt="' + i + '" aria-pressed="' + (alt === i) + '">' + (alt === i ? 'Chosen' : 'Choose option ' + 'ABC'.charAt(i)) + '</button></div>';
      });
      $('#toAlts').innerHTML = h;
      $$('#toAlts [data-alt]').forEach(function (b) { b.addEventListener('click', function () { alt = +b.getAttribute('data-alt'); render(); EA.changed('tradeoff'); var r = $('#toDR'); if (r && root.matchMedia('(max-width:900px)').matches) r.scrollIntoView({ block: 'nearest', behavior: RM ? 'auto' : 'smooth' }); }); });
      rec.setAttribute('aria-pressed', recorded ? 'true' : 'false');
      rec.textContent = recorded ? 'Writing it down ✓' : 'Just ship it';
      var dr = $('#toDR');
      if (alt === null) { dr.innerHTML = '<p class="to-empty">Choose an option to see the decision record it produces.</p>'; return; }
      var a = t.alts[alt];
      if (!recorded) {
        dr.innerHTML = '<p class="dr-k">No record</p><h4>“' + esc(a.t) + '” shipped on a Tuesday.</h4><ul class="dr-miss"><li>No owner — when a new team wants the data, nobody is asked.</li><li>No expiry — the choice outlives every assumption it was made under.</li><li>No evidence — nobody can show the control ran.</li><li>No alternatives on file — the next reviewer re-argues it from zero.</li></ul>';
        return;
      }
      dr.innerHTML = '<p class="dr-k">Decision record · DR-' + (41 + cur) + '</p><h4>' + esc(t.t) + ': ' + esc(a.t) + '</h4><dl class="dr">' +
        '<dt>Decision</dt><dd>' + esc(t.q) + ' → ' + esc(a.t) + (alt !== t.rec ? ' <span class="tag tag--hot">Differs from the reviewer’s pick</span>' : '') + '</dd>' +
        '<dt>Alternatives considered</dt><dd>' + t.alts.map(function (x, i) { return 'ABC'.charAt(i) + '. ' + esc(x.t); }).join(' · ') + '</dd>' +
        '<dt>Accepted residual risk</dt><dd>' + esc(a.residual) + '</dd>' +
        '<dt>Trust assumption</dt><dd>' + esc(a.trust) + '</dd>' +
        '<dt>Owner</dt><dd>' + esc(t.owner) + '</dd><dt>Reviewer</dt><dd>' + esc(t.reviewer) + '</dd><dt>Approver</dt><dd>' + esc(t.approver) + (alt !== t.rec ? ' — with the dissent recorded' : '') + '</dd>' +
        '<dt>Expires</dt><dd>' + esc(t.expiry) + '</dd>' +
        '<dt>Evidence required</dt><dd><ul>' + t.evidence.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></dd></dl>';
    }
    render();
    EA.fig('tradeoff', {
      get: function () { return T[cur].id + '.' + (alt === null ? 'x' : alt) + (recorded ? '' : '.unrecorded'); },
      set: function (s) { var p = String(s).split('.'), i = T.map(function (t) { return t.id; }).indexOf(p[0]); cur = i < 0 ? 0 : i; alt = p[1] === 'x' || p[1] == null ? null : clamp(p[1], 3); recorded = p[2] !== 'unrecorded'; render(); },
      reset: function () { cur = 0; alt = null; recorded = true; render(); },
      read: function () {
        var t = T[cur];
        if (alt === null) return '<b>' + esc(t.t) + ':</b> ' + esc(t.q) + ' Three options, each with a utility cost, a privacy benefit, a trust assumption and a residual risk. None is free.';
        var a = t.alts[alt];
        return '<b>' + esc(t.t) + ', option ' + 'ABC'.charAt(alt) + ' — ' + esc(a.t) + '.</b> Residual risk: ' + esc(a.residual) + ' ' + (recorded ? 'Recorded with an owner (' + esc(t.owner) + '), an approver, an expiry and the evidence that will prove it.' : 'Shipped without a record: no owner, no expiry, no evidence.');
      }
    });
  })();

  /* 10 · The burn button */
  (function () {
    var btn = $('#burnBtn'); if (!btn) return;
    var deck = $('#burnDeck'), ask = $('#burnAsk'), n = $('#burnN'), cap = $('#burnCap'), t = null, raf = null, burned = false, answer = '';
    var CAP0 = cap.innerHTML;
    $$('#burnRows .sw2').forEach(function (s) { s.addEventListener('click', function () { s.setAttribute('aria-pressed', s.getAttribute('aria-pressed') === 'true' ? 'false' : 'true'); }); });
    function count(from, to) { if (raf) cancelAnimationFrame(raf); if (RM) { n.textContent = to; return; } var t0 = performance.now(); (function f(now) { var p = Math.min(1, (now - t0) / 900), e = 1 - Math.pow(1 - p, 3); n.textContent = Math.round(from + (to - from) * e); if (p < 1) raf = requestAnimationFrame(f); })(t0); }
    function apply(animate) {
      clearTimeout(t);
      btn.setAttribute('aria-pressed', burned ? 'true' : 'false');
      if (burned) {
        deck.classList.add('burning');
        t = setTimeout(function () { deck.hidden = true; ask.hidden = false; }, RM || !animate ? 0 : 650);
        if (animate) count(851, 1); else n.textContent = 1;
        n.classList.add('one'); cap.textContent = 'One honest question. Two equal answers. The product absorbed the rest.'; btn.textContent = 'Show the old banner';
      } else {
        ask.hidden = true; deck.hidden = false; void deck.offsetWidth; deck.classList.remove('burning');
        if (animate) count(1, 851); else n.textContent = 851;
        n.classList.remove('one'); cap.innerHTML = CAP0; btn.textContent = 'Burn.';
      }
      $('.ask-p', ask).textContent = answer === 'allow' ? 'Allowed. One tap, and you can change it in Settings.' : answer === 'deny' ? 'Done. One tap, and the app is told not to track you.' : 'Your data will be used to deliver personalized ads to you.';
    }
    btn.addEventListener('click', function () { burned = !burned; answer = ''; apply(true); EA.changed('burn'); });
    $$('.ask-x', ask).forEach(function (b) { b.addEventListener('click', function () { answer = b.textContent === 'Allow' ? 'allow' : 'deny'; apply(false); EA.changed('burn'); }); });
    EA.fig('burn', {
      get: function () { return burned ? 'burned' + (answer ? '.' + answer : '') : 'banner'; },
      set: function (s) { var p = String(s).split('.'); burned = p[0] === 'burned'; answer = burned ? (p[1] || '') : ''; apply(false); },
      reset: function () { burned = false; answer = ''; apply(false); },
      read: function () { return burned ? '<b>One question, two equal answers.</b> ' + (answer ? 'Dana chose “' + (answer === 'allow' ? 'Allow' : 'Ask App Not to Track') + '” in one tap.' : 'The product absorbed the complexity.') : '<b>The banner:</b> four purpose switches (a fifth always on), 847 partners and a pre-ticked “legitimate interest” — 851 decisions handed to the person, and one bright button that says yes.'; }
    });
  })();

  root.EA_FIGS_PART1 = true;
})(window);
