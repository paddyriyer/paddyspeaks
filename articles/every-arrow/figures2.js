/* Every Arrow Is a Decision — figures for chapters 3 (BUILD) and 4 (PROVE).
 * Same contract as figures.js: data from EA_DATA / EA_NS, arithmetic from
 * EA_MODEL, and each figure registers get/set/reset/read with EA.fig. */
(function (root) {
  'use strict';
  var EA = root.EA, D = root.EA_DATA, NS = root.EA_NS, M = root.EA_MODEL;
  if (!EA || !D || !M) return;
  var $ = EA.$, $$ = EA.$$, el = EA.el, esc = EA.esc, RM = EA.RM;
  function clamp(i, n) { i = parseInt(i, 10); return isNaN(i) ? 0 : Math.max(0, Math.min(n - 1, i)); }
  function choices(host, items, label, role, onPick) {
    role = role || 'tablist';
    host.setAttribute('role', role); host.setAttribute('aria-label', label);
    var btns = items.map(function (html, i) { var b = el('button', { type: 'button', role: role === 'tablist' ? 'tab' : 'radio' }, html); b.addEventListener('click', function () { onPick(i); }); host.appendChild(b); return b; });
    EA.arrowKeys(host, 'button');
    return btns;
  }
  function pick(btns, i, role) { EA.select(btns, i, role === 'radiogroup' ? 'aria-checked' : 'aria-selected'); }

  /* ═════════ CHAPTER 3 · BUILD ═════════ */

  /* 11 · Enforcement ladder */
  (function () {
    var host = $('#rungs'); if (!host) return;
    var R = D.ladder, btns = [], cur = 0, climbT = null;
    R.forEach(function (r, i) {
      var b = el('button', { type: 'button', 'class': 'rung', role: 'tab', 'aria-selected': 'false', id: 'rung' + i, 'aria-controls': 'lp' }, '<span class="rn">' + i + '</span><span class="rt">' + r.t + '</span><span class="rw">' + r.who + '</span>');
      b.addEventListener('click', function () { stopClimb(); sel(i); EA.changed('ladder'); });
      host.appendChild(b); btns.push(b);
    });
    EA.arrowKeys(host, '.rung', true);
    function sel(i) {
      cur = i;
      btns.forEach(function (b, j) { b.setAttribute('aria-selected', j === i ? 'true' : 'false'); b.classList.toggle('passed', j < i); b.tabIndex = j === i ? 0 : -1; });
      var r = R[i];
      $('#lp').setAttribute('aria-labelledby', 'rung' + i);
      $('#lp').innerHTML = '<div class="lp-top"><span class="lp-title">' + i + ' · ' + r.t + '</span><span class="tag ' + (i >= 2 ? 'tag--cool' : '') + '">' + (i >= 2 ? 'A machine enforces it' : 'A person enforces it') + '</span></div>' +
        '<div class="lp-art">' + r.art + '</div>' +
        '<div class="lp-meta"><div><span>Enforced by</span>' + esc(r.by) + '</div><div><span>Fails when</span>' + esc(r.fails) + '</div><div><span>Evidence it leaves</span>' + esc(r.evidence) + '</div></div>';
      $('#rungFill').style.height = 'calc(' + ((i + 0.5) / 6 * 100) + '% - 8px)';
    }
    function stopClimb() { if (climbT) { clearInterval(climbT); climbT = null; } }
    $('#climb').addEventListener('click', function () {
      stopClimb(); sel(0); EA.changed('ladder');
      if (root.matchMedia('(max-width:900px)').matches) $('#lp').scrollIntoView({ block: 'nearest', behavior: RM ? 'auto' : 'smooth' });
      if (RM) { sel(5); EA.changed('ladder'); return; }
      var k = 0;
      climbT = setInterval(function () { k++; if (k > 5) { stopClimb(); return; } sel(k); EA.changed('ladder'); }, 1500);
    });
    sel(0);
    EA.fig('ladder', {
      get: function () { return String(cur); }, set: function (s) { stopClimb(); sel(clamp(s, R.length)); }, reset: function () { stopClimb(); sel(0); },
      read: function () { var r = R[cur]; return '<b>Rung ' + cur + ', ' + r.t + '</b> (' + (cur >= 2 ? 'a machine' : 'a person') + ' enforces it). Fails when: ' + esc(r.fails) + ' Evidence: ' + esc(r.evidence); }
    });
  })();

  /* 12 · Consent is state — Northstar's consumers */
  (function () {
    var host = $('#prows'); if (!host || !NS) return;
    var fix = false, state = 'U', raf = null, stage = 'idle';
    var MAXLOG = Math.log(8 * 86400);
    function pos(s) { return Math.max(0, Math.min(1, Math.log(Math.max(1, s)) / MAXLOG)); }
    var nodes = { U: $('#smU'), G: $('#smG'), R: $('#smR'), E: $('#smE') };
    var names = { U: 'UNKNOWN', G: 'GRANTED', R: 'REVOKED', E: 'EXPIRED' };
    var msg = { U: 'default = no processing. No consumer may assume a yes.', G: 'consumers may act — within the purpose granted.', R: 'every consumer must stop. Watch how long that takes.', E: 'treat as no until the person is asked again.' };
    var model, rows = [];
    function build() {
      model = M.consent(NS, fix);
      host.innerHTML = '';
      rows = model.rows.map(function (c) {
        var r = el('div', { 'class': 'prow' + (c.never ? ' never' : '') + (c.fixed ? ' fixed' : '') }, '<span class="pn">' + esc(c.name) + '<small>' + esc(c.mode) + '</small></span><span class="pt"><i></i></span><span class="ps">GRANTED</span>');
        host.appendChild(r); return r;
      });
      var pc = model;
      $('#p50').textContent = pc.p50 == null ? 'never' : M.fmtSecs(pc.p50);
      $('#p95').textContent = pc.p95 == null ? 'never' : M.fmtSecs(pc.p95);
      $('#p99').textContent = pc.p99 == null ? 'never' : M.fmtSecs(pc.p99);
      var fb = $('#cFix'); fb.setAttribute('aria-pressed', fix ? 'true' : 'false'); fb.textContent = fix ? 'Wired to read-time checks ✓' : 'Wire the ' + M.consent(NS, false).never + ' silent consumers';
    }
    function setEdge(id) { $$('.sm-e').forEach(function (e) { e.classList.toggle('on', e.id === id); }); }
    function setState(s, edge) {
      state = s;
      Object.keys(nodes).forEach(function (k) { nodes[k].classList.toggle('on', k === s); nodes[k].classList.toggle('revoked', k === 'R' || k === 'E'); });
      setEdge(edge || '');
      $('#smState').textContent = 'State: ' + names[s] + ' — ' + msg[s];
      $('#cGrant').disabled = s === 'G'; $('#cRevoke').disabled = s !== 'G'; $('#cExpire').disabled = s !== 'G';
      $('#smHint').textContent = s === 'G' ? '' : s === 'U' ? 'Grant first: only a granted consent can be revoked or expire.' : 'Grant again to re-consent.';
    }
    function paint(sim, label) {
      var stale = 0;
      model.rows.forEach(function (c, i) {
        var r = rows[i], lat = c.never ? Infinity : c.p50, done = sim >= lat;
        r.querySelector('.pt i').style.width = (c.never ? pos(sim) : Math.min(pos(sim), pos(lat))) * 100 + '%';
        r.classList.toggle('done', done);
        r.querySelector('.ps').textContent = done ? label : (c.never && sim > 0 ? 'STILL GRANTED' : 'GRANTED');
        if (!done) stale++;
      });
      $('#pClock').textContent = 'T + ' + M.fmtSecs(sim);
      var st = $('#pStale');
      if (stale) { st.textContent = stale + ' of ' + model.rows.length + ' consumers still acting on GRANTED'; st.classList.remove('done'); }
      else { st.textContent = 'All consumers honour ' + label; st.classList.add('done'); }
    }
    function resetProp(msgTxt) { if (raf) cancelAnimationFrame(raf); raf = null; rows.forEach(function (r) { r.classList.remove('done'); r.querySelector('.pt i').style.width = '0'; r.querySelector('.ps').textContent = 'GRANTED'; }); $('#pClock').textContent = 'T + 0s'; var st = $('#pStale'); st.classList.remove('done'); st.textContent = msgTxt; }
    function runProp(label, instant) {
      stage = label;
      var dur = RM || instant ? 1 : 7000, t0 = performance.now();
      function frame(now) { var p = Math.min(1, (now - t0) / dur), sim = Math.exp(p * MAXLOG); paint(sim, label); if (p < 1) raf = requestAnimationFrame(frame); else { raf = null; EA.changed('consent'); } }
      if (instant) { paint(Math.exp(MAXLOG), label); return; }
      raf = requestAnimationFrame(frame);
    }
    $('#cGrant').addEventListener('click', function () { var from = state; setState('G', from === 'U' ? 'smUG' : from === 'R' ? 'smRG' : 'smEG'); stage = 'idle'; resetProp('Revoke to start the clock'); EA.changed('consent'); });
    $('#cRevoke').addEventListener('click', function () { setState('R', 'smGR'); runProp('REVOKED'); EA.changed('consent'); });
    $('#cExpire').addEventListener('click', function () { setState('E', 'smGE'); runProp('EXPIRED'); EA.changed('consent'); });
    $('#cReset').addEventListener('click', function () { reset(); EA.changed('consent'); });
    $('#cFix').addEventListener('click', function () { fix = !fix; build(); if (stage !== 'idle') runProp(stage, true); else resetProp(state === 'G' ? 'Revoke to start the clock' : 'Grant, then revoke, to start the clock'); EA.changed('consent'); });
    function reset() { fix = false; build(); setState('U'); stage = 'idle'; resetProp('Grant, then revoke, to start the clock'); }
    reset();
    EA.fig('consent', {
      get: function () { return state + (fix ? '.fixed' : ''); },
      set: function (s) { var p = String(s).split('.'); fix = p[1] === 'fixed'; build(); var st = names[p[0]] ? p[0] : 'U'; setState(st, st === 'G' ? 'smUG' : st === 'R' ? 'smGR' : st === 'E' ? 'smGE' : ''); if (st === 'R' || st === 'E') runProp(names[st], true); else { stage = 'idle'; resetProp(st === 'G' ? 'Revoke to start the clock' : 'Grant, then revoke, to start the clock'); } },
      reset: reset,
      read: function () {
        var m = model, base = '<b>Consent is ' + names[state] + '.</b> ';
        if (state !== 'R' && state !== 'E') return base + (state === 'U' ? 'No consumer may act on Dana’s data for this purpose.' : 'All ' + m.rows.length + ' consumers may act, within the purpose granted.');
        return base + (m.never ? m.never + ' of ' + m.rows.length + ' consumers never hear the revocation, so the end-to-end latency is “never” (' + M.n(m.stale) + ' people’s choices ignored).' : 'Every consumer hears it: P50 ' + M.fmtSecs(m.p50) + ', P95 ' + M.fmtSecs(m.p95) + ', P99 ' + M.fmtSecs(m.p99) + ' — the slowest consumer sets the promise.');
      }
    });
  })();

  /* 13 · Rights beyond deletion */
  (function () {
    var host = $('#rightsPick'); if (!host) return;
    var R = D.rights, cur = 0, orch = false;
    var btns = choices(host, R.map(function (r) { return esc(r.t); }), 'Rights', 'tablist', function (i) { cur = i; render(); EA.changed('rights'); });
    btns.forEach(function (b) { b.className = 'tog'; b.setAttribute('aria-controls', 'rightsOut'); });
    var mb = $('#rightsMode');
    mb.addEventListener('click', function () { orch = !orch; render(); EA.changed('rights'); });
    function deadline(id) {
      if (!NS) return '';
      var type = { access: 'ACCESS', correct: 'CORRECT', restrict: 'OBJECT', object: 'OPT OUT', port: 'PORT', appeal: 'OBJECT' }[id];
      function row(region) { return NS.rightsDeadlines.filter(function (x) { return x.region === region && (x.rights === '*' || x.rights.indexOf(type) >= 0); })[0]; }
      var eu = row('EU'), ca = row('US-CA');
      return (eu ? '<span><b>EU</b> ' + eu.days + ' days' + (eu.ext ? ' (+' + eu.ext + ')' : '') + '</span>' : '') + (ca ? '<span><b>California</b> ' + ca.days + ' days' + (ca.ext ? ' (+' + ca.ext + ')' : '') + '</span>' : '');
    }
    function render() {
      pick(btns, cur);
      var r = R[cur];
      mb.setAttribute('aria-pressed', orch ? 'true' : 'false'); mb.textContent = orch ? 'Orchestrated workflow ✓' : 'A ticket in a queue';
      $('#rightsOut').innerHTML = '<p class="rt-ask"><span class="tag">' + esc(r.when) + ' · ' + esc(r.law) + '</span> ' + esc(r.ask) + '</p>' +
        '<div class="rt-dl">' + deadline(r.id) + '<span class="lab lab--law">Simplified · not legal advice</span></div>' +
        '<table class="rt-t"><thead><tr><th scope="col">System</th><th scope="col">Must</th><th scope="col">' + (orch ? 'With an orchestrated workflow' : 'With a ticket in a queue') + '</th></tr></thead><tbody>' +
        r.systems.map(function (s) { return '<tr class="' + (orch ? 'ok' : 'no') + '"><th scope="row">' + esc(s[0]) + '</th><td>' + esc(s[1]) + '</td><td>' + (orch ? '✓ Receipt from the system, checked by a canary' : '✗ ' + esc(s[2])) + '</td></tr>'; }).join('') +
        '</tbody></table><p class="rt-proof"><span>Proof it worked</span>' + esc(r.proof) + '</p>';
    }
    render();
    EA.fig('rights', {
      get: function () { return R[cur].id + (orch ? '.orchestrated' : ''); },
      set: function (s) { var p = String(s).split('.'), i = R.map(function (r) { return r.id; }).indexOf(p[0]); cur = i < 0 ? 0 : i; orch = p[1] === 'orchestrated'; render(); },
      reset: function () { cur = 0; orch = false; render(); },
      read: function () { var r = R[cur]; return '<b>' + esc(r.t) + ' (' + esc(r.law) + '):</b> ' + r.systems.length + ' systems must act. ' + (orch ? 'An orchestrated workflow collects a receipt from each and checks it with a canary.' : 'As a ticket in a queue, each can fail silently — for example: ' + esc(r.systems[0][2].toLowerCase()) + '.'); }
    });
  })();

  /* 14 · Retention */
  (function () {
    var inp = $('#ret'); if (!inp) return;
    var X0 = 40, X1 = 464, Y0 = 236, YT = 40, TAU = 21, MAXD = 730, RISKY = 150, INIT = inp.value;
    function x(t) { return X0 + Math.sqrt(t / MAXD) * (X1 - X0); }
    function uy(t) { return Y0 - Math.exp(-t / TAU) * (Y0 - YT); }
    var ticks = $('#tcTicks'), NSs = 'http://www.w3.org/2000/svg';
    function s(tag, a) { var e = document.createElementNS(NSs, tag); Object.keys(a).forEach(function (k) { e.setAttribute(k, a[k]); }); return e; }
    [0, 7, 30, 90, 180, 365, 730].forEach(function (t) { ticks.appendChild(s('line', { x1: x(t), y1: Y0, x2: x(t), y2: Y0 + 5, 'class': 'tc-ax' })); var tx = s('text', { 'class': 'tc-tick', x: x(t), y: Y0 + 20 }); tx.textContent = t; ticks.appendChild(tx); });
    var pts = []; for (var t = 0; t <= MAXD; t += (t < 60 ? 1 : 5)) pts.push([x(t), uy(t)]);
    $('#tcU').setAttribute('d', 'M' + pts.map(function (p) { return p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' L'));
    $('#tcR').setAttribute('d', 'M' + X0 + ' ' + RISKY + ' L' + X1 + ' ' + RISKY);
    /* one keystroke = one meaningful step */
    var STOPS = [7, 14, 21, 30, 60, 90, 180, 365, 730];
    function days() { return STOPS[Math.max(0, Math.min(STOPS.length - 1, +inp.value))]; }
    function stats(R) { return M.retention(R); }
    function upd() {
      var R = days(), xr = x(R), st = stats(R);
      inp.setAttribute('aria-valuetext', R + ' days');
      $('#tcRL').setAttribute('x', xr > 300 ? 52 : 340);
      var a = [[X0, Y0]]; for (var t = 0; t <= R; t += (t < 60 ? 1 : 5)) a.push([x(t), uy(t)]); a.push([xr, uy(R)], [xr, Y0]);
      $('#tcUA').setAttribute('d', 'M' + a.map(function (p) { return p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' L') + ' Z');
      $('#tcRA').setAttribute('d', 'M' + X0 + ' ' + Y0 + ' L' + X0 + ' ' + RISKY + ' L' + xr.toFixed(1) + ' ' + RISKY + ' L' + xr.toFixed(1) + ' ' + Y0 + ' Z');
      var cut = $('#tcCut'); cut.setAttribute('x1', xr); cut.setAttribute('x2', xr);
      var lbl = $('#tcCutL'); lbl.textContent = 'keep ' + R + ' d'; lbl.setAttribute('x', Math.min(xr + 4, X1 - 60));
      $('#retV').textContent = R + ' days';
      $('#tsU').textContent = st.u + '%'; $('#tsR').textContent = st.rows; $('#tsX').textContent = st.x + '%';
    }
    inp.addEventListener('input', function () { upd(); EA.changed('retention'); });
    upd();
    EA.fig('retention', {
      get: function () { return String(days()); },
      set: function (v) { var d = parseInt(v, 10) || 30, best = 0; STOPS.forEach(function (x, i) { if (Math.abs(x - d) < Math.abs(STOPS[best] - d)) best = i; }); inp.value = best; upd(); },
      reset: function () { inp.value = INIT; upd(); },
      read: function () { var R = days(), st = stats(R); return '<b>Keep raw events ' + R + ' days:</b> ' + st.u + '% of an event’s lifetime usefulness retained, ' + st.rows + ' rows at risk on any day, ' + st.x + '% of the exposure of keeping two years. Illustrative model.'; }
    });
  })();

  /* 15 · Forget me */
  (function () {
    var wrap = $('#forgetStores'); if (!wrap) return;
    var F = D.forget, total = F.length, on = F.map(function () { return false; }), cards = [];
    function cov() {
      var c = on.filter(Boolean).length;
      $('#covN').innerHTML = c + '<span>/' + total + '</span>';
      $('#covBar').style.width = (c / total * 100) + '%';
      $('#covT').textContent = c === 0 ? 'The button reaches nothing yet. Mark each store your deletion genuinely reaches today — not the ones it is supposed to.' : c < total ? c + ' of ' + total + '. Every unmarked store keeps the person — and a deletion receipt would be a false statement.' : 'All ' + total + '. Now show the verification scan that proves it ran last night.';
      cards.forEach(function (x, i) { x.card.classList.toggle('covered', on[i]); x.b.setAttribute('aria-pressed', on[i] ? 'true' : 'false'); x.b.textContent = on[i] ? 'Reached ✓' : 'Reached?'; });
    }
    F.forEach(function (m, i) {
      var card = el('div', { 'class': 'mine' }, '<span class="n">0' + (i + 1) + '</span><h3>' + esc(m[0]) + '</h3><p>' + esc(m[1]) + '</p>');
      var b = el('button', { type: 'button', 'aria-pressed': 'false', 'aria-label': 'Reached? ' + m[0] }, 'Reached?');
      b.addEventListener('click', function () { on[i] = !on[i]; cov(); EA.changed('forget'); });
      card.appendChild(b); wrap.appendChild(card); cards.push({ card: card, b: b });
    });
    cov();
    EA.fig('forget', {
      get: function () { return on.map(function (x) { return x ? 1 : 0; }).join(''); },
      set: function (s) { on = F.map(function (_, i) { return String(s).charAt(i) === '1'; }); cov(); },
      reset: function () { on = F.map(function () { return false; }); cov(); },
      read: function () { var c = on.filter(Boolean).length, miss = F.filter(function (_, i) { return !on[i]; }).map(function (m) { return m[0]; }); return '<b>' + c + ' of ' + total + ' stores reached.</b> ' + (miss.length ? 'Still holding Dana: ' + esc(miss.join(', ')) + '.' : 'Now prove it with a verification scan.'); }
    });
  })();

  /* 16 · Vendor lifecycle (HelpHub CRM) */
  (function () {
    var host = $('#vendorStages'); if (!host) return;
    var V = D.vendor, cur = 0, withC = false;
    var btns = choices(host, V.map(function (v, i) { return '<span>0' + (i + 1) + '</span>' + esc(v.t); }), 'Vendor lifecycle stages', 'tablist', function (i) { cur = i; render(); EA.changed('vendor'); });
    btns.forEach(function (b) { b.setAttribute('aria-controls', 'vendorOut'); });
    var mb = $('#vendorMode');
    mb.addEventListener('click', function () { withC = !withC; render(); EA.changed('vendor'); });
    function facts() {
      var v = NS && NS.vendor, sp = NS && NS.helphubSubs;
      if (!v) return '';
      return '<dl class="vd-facts"><dt>Data</dt><dd>' + esc(v.data.join(', ')) + '</dd><dt>Region</dt><dd>' + esc(v.region.toUpperCase()) + '</dd><dt>Retention</dt><dd>' + v.retention.contract + ' days in the contract · <b class="hot">' + v.retention.actual + ' observed</b></dd><dt>Subprocessors</dt><dd>' + esc(sp.join(', ')) + '</dd><dt>Deletion attestation</dt><dd>' + (v.attestation ? esc(v.attestation) : '<b class="unk">none on file</b>') + '</dd><dt>People</dt><dd>' + M.n(v.people) + '</dd></dl>';
    }
    function render() {
      pick(btns, cur);
      btns.forEach(function (b, i) { b.classList.toggle('done', i < cur); });
      mb.setAttribute('aria-pressed', withC ? 'true' : 'false'); mb.textContent = withC ? 'With the controls ✓' : 'Northstar today';
      var v = V[cur];
      $('#vendorOut').innerHTML = '<p class="vd-q"><span class="tag">' + esc(v.t) + '</span> ' + esc(v.q) + '</p>' +
        '<div class="vd-two"><div class="vd-now' + (withC ? ' dim' : '') + '"><span>Northstar today</span>' + esc(v.now) + '</div><div class="vd-with' + (withC ? '' : ' dim') + '"><span>With the control</span>' + esc(v.with) + '</div></div>' +
        '<p class="vd-ev"><span>Evidence</span>' + esc(v.ev) + '</p>';
    }
    var f = $('#vendorFacts'); if (f) f.innerHTML = facts();
    render();
    EA.fig('vendor', {
      get: function () { return cur + (withC ? '.controls' : ''); },
      set: function (s) { var p = String(s).split('.'); cur = clamp(p[0], V.length); withC = p[1] === 'controls'; render(); },
      reset: function () { cur = 0; withC = false; render(); },
      read: function () { var v = V[cur]; return '<b>Stage ' + (cur + 1) + ' of ' + V.length + ', ' + v.t + ':</b> ' + esc(v.q) + ' ' + (withC ? 'With the control: ' + esc(v.with) : 'Northstar today: ' + esc(v.now)) + ' Evidence: ' + esc(v.ev); }
    });
  })();

  /* 19 · Worst day */
  (function () {
    var host = $('#designs'); if (!host) return;
    var FN = D.designFactors, Dz = D.designs, cur = 0;
    var fw = $('#factors');
    FN.forEach(function (n, i) { fw.appendChild(el('div', { 'class': 'fac' }, '<span class="fk">' + n + '</span><span class="fb"><i id="fb' + i + '"></i></span><span class="fv" id="fv' + i + '"></span>')); });
    var btns = choices(host, Dz.map(function (d, i) { return '<span>0' + (i + 1) + '</span>' + esc(d.n); }), 'Five designs, from maximum to minimum damage', 'tablist', function (i) { sel(i); EA.changed('worst'); });
    function label(score) { return score === 0 ? '0' : score >= 10 ? String(Math.round(score)) : score >= 0.1 ? score.toFixed(1) : '<0.1'; }
    function sel(i) {
      cur = i; pick(btns, i);
      var d = Dz[i], score = D.designIndex(d), r = score === 0 ? 0 : Math.max(5, 190 * Math.sqrt(score / 100));
      $('#blC').setAttribute('r', r.toFixed(1)); $('#blC2').setAttribute('r', r.toFixed(1));
      var low = r > 0 && r < 70, ty = low ? 200 + r + 46 : 196;
      $('#blPct').setAttribute('y', ty); $('#blPl').setAttribute('y', ty + 26);
      $('#blPct').textContent = label(score);
      $('#dzName').textContent = d.n; $('#dzDesc').textContent = d.d;
      d.f.forEach(function (f, k) { $('#fb' + k).style.width = (f[0] * 100) + '%'; $('#fb' + k).className = f[0] >= 0.9 ? 'hot' : ''; $('#fv' + k).textContent = f[1]; });
      $$('.fm-t').forEach(function (t) { var k = +t.getAttribute('data-f'); t.classList.toggle('low', d.f[k][0] < 0.5); });
      $('#blRec').innerHTML = d.rec;
    }
    sel(0);
    EA.fig('worst', {
      get: function () { return String(cur); }, set: function (s) { sel(clamp(s, Dz.length)); }, reset: function () { sel(0); },
      read: function () { var d = Dz[cur]; return '<b>' + esc(d.n) + ':</b> damage index ' + label(D.designIndex(d)) + ' of 100. ' + esc(d.d) + ' Factors — ' + FN.map(function (n, k) { return n.toLowerCase() + ': ' + d.f[k][1]; }).join('; ') + '. Illustrative index; it compares designs and does not predict harm.'; }
    });
  })();

  /* 20 · PETs */
  (function () {
    var host = $('#threats'); if (!host) return;
    var TH = D.petThreats, cur = 0, fams = $('#fams');
    D.petFamilies.forEach(function (f) {
      var d = el('div', { 'class': 'fam' }, '<h3>' + f[0] + '</h3><p>' + f[1] + '</p>'), c = el('div', { 'class': 'pchips' });
      f[2].forEach(function (p) { c.appendChild(el('span', { 'class': 'pchip', 'data-p': p[0] }, esc(p[1]))); });
      d.appendChild(c); fams.appendChild(d);
    });
    var btns = choices(host, TH.map(function (t) { return esc(t[0]); }), 'Threats', 'tablist', function (i) { sel(i); EA.changed('pets'); if (root.matchMedia('(max-width:900px)').matches) $('#petCard').scrollIntoView({ block: 'nearest', behavior: RM ? 'auto' : 'smooth' }); });
    btns.forEach(function (b) { b.className = 'tog'; b.setAttribute('aria-controls', 'petCard'); });
    function sel(i) {
      cur = i; pick(btns, i);
      var t = TH[i];
      $$('.pchip').forEach(function (c) { c.classList.toggle('on', t[1].indexOf(c.getAttribute('data-p')) >= 0); });
      $('#petCard').innerHTML = '<span class="pk">' + t[3] + '</span><h3>' + esc(t[2]) + '</h3><div class="pet-grid"><div><span>Utility cost</span>' + esc(t[4]) + '</div><div><span>Trust assumption</span>' + esc(t[5]) + '</div><div class="rr"><span>Residual risk</span>' + esc(t[6]) + '</div></div>';
    }
    sel(0);
    EA.fig('pets', {
      get: function () { return String(cur); }, set: function (s) { sel(clamp(s, TH.length)); }, reset: function () { sel(0); },
      read: function () { var t = TH[cur]; return '<b>Threat: ' + esc(t[0].toLowerCase()) + '.</b> Answer: ' + esc(t[2]) + '. Utility cost: ' + esc(t[4]) + '. Trust: ' + esc(t[5]) + '. Residual risk: ' + esc(t[6]) + '.'; }
    });
  })();

  /* 20 · DP ledger */
  (function () {
    var barEl = $('#lgBar'); if (!barEl) return;
    var TOTAL = NS && NS.dp ? NS.dp.total : 4;
    var base = (NS && NS.dp ? NS.dp.releases : []).map(function (r) { return [r.q, r.eps]; });
    var extra = [], last = null;
    function spentList() { return base.concat(extra).map(function (q) { return q[1]; }); }
    function draw() {
      barEl.innerHTML = '';
      base.concat(extra).forEach(function (q, i) { var s = el('div', { 'class': 'lg-seg' + (i >= base.length ? ' q5' : '') }, '<b>' + q[0] + '</b>ε ' + (q[1] < 1 ? q[1].toFixed(1).slice(1) : q[1].toFixed(1))); s.style.flex = '0 0 ' + (q[1] / TOTAL * 100) + '%'; barEl.appendChild(s); });
      var rem = M.ledger(TOTAL, spentList(), 0).rem;
      if (rem > 0.001) barEl.appendChild(el('div', { 'class': 'lg-rem' }, 'left ' + rem.toFixed(1)));
      var q = 'Q' + (base.length + 1 + extra.length);
      $('#lgReq').innerHTML = q + (extra.length ? ' &middot; the next analyst question' : ' &middot; weekly reorders by ZIP') + '<br>requests &#949; = 1.0';
      $('#lgRun').innerHTML = 'Run ' + q + ' at &#949; = 1.0'; $('#lgHalf').innerHTML = 'Run ' + q + ' at &#949; = 0.5';
      var out = $('#lgOut'), why = $('#lgWhy');
      if (!last) { out.textContent = ''; out.className = 'lg-out'; why.textContent = ''; return; }
      out.className = 'lg-out ' + (last.ok ? 'ok' : 'deny'); out.textContent = last.ok ? 'ALLOWED' : 'DENIED';
      why.textContent = last.ok ? 'Answered with noise at ε ' + last.eps.toFixed(1) + '. Remaining budget: ' + rem.toFixed(1) + (rem < 0.05 ? ' — the next query will be denied.' : '.') : 'A ledger that refuses the query is a feature, not an outage. Spent ' + last.spent.toFixed(1) + ' + requested ' + last.eps.toFixed(1) + ' = ' + (last.spent + last.eps).toFixed(1) + ' > budget ' + TOTAL.toFixed(1) + '. Remaining: ' + last.rem.toFixed(1) + '.';
    }
    function run(eps) { var r = M.ledger(TOTAL, spentList(), eps); last = { ok: r.ok, eps: eps, spent: r.spent, rem: r.rem }; if (r.ok) extra.push(['Q' + (base.length + 1 + extra.length), eps]); draw(); }
    $('#lgRun').addEventListener('click', function () { run(1.0); EA.changed('dp'); });
    $('#lgHalf').addEventListener('click', function () { run(0.5); EA.changed('dp'); });
    draw();
    EA.fig('dp', {
      get: function () { return extra.map(function (q) { return q[1]; }).join('+') || 'start'; },
      set: function (s) { extra = []; last = null; String(s).split('+').forEach(function (v) { var e = parseFloat(v); if (e === 0.5 || e === 1) run(e); }); draw(); },
      reset: function () { extra = []; last = null; draw(); },
      read: function () { var r = M.ledger(TOTAL, spentList(), 0); return '<b>Spent ε ' + r.spent.toFixed(1) + ' of ' + TOTAL.toFixed(1) + '</b> (basic composition: the spends add). Remaining ' + r.rem.toFixed(1) + '.' + (last ? (last.ok ? ' The last query was answered with noise.' : ' The last query was refused: it would have exceeded the budget.') : ''); }
    });
  })();

  /* ═════════ CHAPTER 4 · PROVE ═════════ */

  /* 21 · Change breaks reviews */
  (function () {
    var host = $('#chgList'); if (!host) return;
    var C = D.changes, k = 0, withC = false;
    function render() {
      var r = M.change(D, k, withC);
      host.innerHTML = C.map(function (c, i) {
        var applied = i < k, flagged = applied && withC && c.rule, missed = applied && !withC && c.breaks >= 0;
        return '<li class="chg' + (applied ? ' on' : '') + (flagged ? ' flag' : '') + (missed ? ' miss' : '') + '"><span class="chg-k">' + esc(c.k) + '</span><span class="chg-t">' + esc(c.t) + '</span><code class="chg-d">' + esc(c.diff) + '</code>' +
          (applied ? '<span class="chg-v">' + (withC ? (c.rule ? '⛔ Blocked at deploy · review reopened — rule: ' + esc(c.rule) : '✓ Not privacy-impacting · no alert') : (c.breaks >= 0 ? '✗ Shipped silently · breaks condition ' + (c.breaks + 1) : '✓ Harmless')) + '</span>' : '') + '</li>';
      }).join('');
      $('#chgStatus').innerHTML = '<div class="chg-rev"><span>Review says</span><b class="' + (r.status === 'REOPENED' ? 'cool' : r.stale ? 'hot' : '') + '">' + r.status + '</b></div><div class="chg-rev"><span>Conditions actually holding</span><b class="' + (r.nBroken ? 'hot' : 'cool') + '">' + r.held + ' / ' + D.verdict.length + '</b></div><div class="chg-rev"><span>Changes caught</span><b>' + r.detected + '</b></div>';
      $('#chgConds').innerHTML = D.verdict.map(function (v, i) { return '<li class="' + (r.broken[i] ? 'broken' : '') + '">' + (r.broken[i] ? '✗ ' : '✓ ') + esc(v) + '</li>'; }).join('');
      $('#chgNext').disabled = k >= C.length; $('#chgNext').textContent = k >= C.length ? 'All six changes shipped' : 'Ship change ' + (k + 1) + ' of ' + C.length;
      var mb = $('#chgMode'); mb.setAttribute('aria-pressed', withC ? 'true' : 'false'); mb.textContent = withC ? 'Data contract + change detection ✓' : 'No data contract';
    }
    $('#chgNext').addEventListener('click', function () { if (k < C.length) k++; render(); EA.changed('change'); });
    $('#chgMode').addEventListener('click', function () { withC = !withC; render(); EA.changed('change'); });
    render();
    EA.fig('change', {
      get: function () { return k + (withC ? '.contract' : ''); },
      set: function (s) { var p = String(s).split('.'); k = Math.max(0, Math.min(C.length, parseInt(p[0], 10) || 0)); withC = p[1] === 'contract'; render(); },
      reset: function () { k = 0; withC = false; render(); },
      read: function () { var r = M.change(D, k, withC); if (!k) return 'The reorder-reminder review is approved with four conditions. Ship the changes one at a time.'; return '<b>' + k + ' of ' + C.length + ' changes shipped' + (withC ? ' through a data contract' : ' with no contract') + ':</b> the review says ' + r.status + '; ' + r.held + ' of ' + D.verdict.length + ' conditions still hold' + (withC ? '; ' + r.detected + ' privacy-impacting changes blocked, and the harmless rename raised no alert.' : r.nBroken ? ' — and nothing told anyone.' : '.'); }
    });
  })();

  /* 22 · Observability: choose the monitors */
  (function () {
    var host = $('#monPick'); if (!host || !NS) return;
    var picked = {}, BUD = D.monitorBudget;
    var btns = D.monitors.map(function (m) {
      var b = el('button', { type: 'button', 'class': 'tl-rule', role: 'switch', 'aria-checked': 'false', 'data-m': m.id }, '<span class="sw" aria-hidden="true"></span><span><b>' + esc(m.t) + '</b><span>' + esc(m.d) + '</span></span>');
      b.addEventListener('click', function () {
        var n = Object.keys(picked).filter(function (k) { return picked[k]; }).length;
        if (!picked[m.id] && n >= BUD) { $('#monMsg').textContent = 'Budget: ' + BUD + ' monitors. Switch one off first.'; return; }
        picked[m.id] = !picked[m.id]; $('#monMsg').textContent = ''; render(); EA.changed('observe');
      });
      host.appendChild(b); return b;
    });
    function render() {
      btns.forEach(function (b) { b.setAttribute('aria-checked', picked[b.getAttribute('data-m')] ? 'true' : 'false'); });
      var res = M.observe(D, NS, picked), got = res.filter(function (r) { return r.by; });
      $('#monOut').innerHTML = '<p class="mon-sum"><b>' + got.length + ' of ' + res.length + '</b> of Northstar’s recorded incidents would have been caught by a monitor rather than by luck or a complaint.</p><ul class="mon-inc">' +
        res.map(function (r) { return '<li class="' + (r.by ? 'ok' : 'no') + '"><span class="mon-id">' + esc(r.id) + '</span> ' + esc(r.title) + ' <small>' + M.n(r.people) + ' people</small><span class="mon-by">' + (r.by ? '✓ ' + esc(r.by) : '✗ not watched') + '</span></li>'; }).join('') + '</ul>';
    }
    render();
    EA.fig('observe', {
      get: function () { return D.monitors.filter(function (m) { return picked[m.id]; }).map(function (m) { return m.id; }).join('+') || 'none'; },
      set: function (s) { picked = {}; var n = 0; String(s).split('+').forEach(function (id) { if (n < BUD && D.monitors.some(function (m) { return m.id === id; })) { picked[id] = true; n++; } }); render(); },
      reset: function () { picked = {}; $('#monMsg').textContent = ''; render(); },
      read: function () { var res = M.observe(D, NS, picked), got = res.filter(function (r) { return r.by; }); var names = D.monitors.filter(function (m) { return picked[m.id]; }).map(function (m) { return m.t; }); return '<b>' + (names.length ? esc(names.join(', ')) : 'No monitors') + ':</b> ' + got.length + ' of ' + res.length + ' recorded incidents would have been caught.' + (picked.uptime ? ' Uptime catches none of them: a privacy failure is usually a working system doing the wrong thing.' : ''); }
    });
  })();

  /* 23 · Incident response */
  (function () {
    var host = $('#irSteps'); if (!host) return;
    var S = D.incident, ch = S.map(function () { return undefined; });
    function render() {
      var first = ch.indexOf(undefined); if (first < 0) first = S.length;
      host.innerHTML = S.map(function (s, i) {
        var done = ch[i] !== undefined, open = i === first;
        var h = '<li class="ir' + (done ? (ch[i] ? ' good' : ' bad') : '') + (open ? ' open' : '') + '"><div class="ir-h"><span class="ir-n">' + (i + 1) + '</span><b>' + esc(s.t) + '</b><span class="ir-when">' + esc(s.when) + '</span></div><p class="ir-what">' + esc(s.what) + '</p>';
        if (done) h += '<p class="ir-res"><b>' + esc(ch[i] ? s.good[0] : s.bad[0]) + '.</b> ' + esc(ch[i] ? s.good[1] : s.bad[1]) + '</p>';
        else if (open) h += '<div class="ir-opts" role="group" aria-label="' + esc(s.t) + ': choose a move"><button type="button" class="btn" data-c="0" data-i="' + i + '">' + esc(i % 2 ? s.good[0] : s.bad[0]) + '</button><button type="button" class="btn" data-c="1" data-i="' + i + '">' + esc(i % 2 ? s.bad[0] : s.good[0]) + '</button></div>';
        return h + '</li>';
      }).join('');
      $$('.ir-opts button', host).forEach(function (b) {
        b.addEventListener('click', function () {
          var i = +b.getAttribute('data-i'), second = b.getAttribute('data-c') === '1';
          ch[i] = i % 2 ? !second : second; /* options alternate order so the safe move isn't always on one side */
          render(); EA.changed('incident');
          var nx = $('.ir.open button', host); if (nx) nx.focus();
        });
      });
      var r = M.incident(S, ch);
      $('#irMeters').innerHTML = [
        ['Extra days the flow kept running', r.runDays, r.runDays ? 'hot' : 'zero'],
        ['Copies of the joined data left behind', ch[5] === undefined && ch[2] !== false ? '—' : r.copies, ch[5] === undefined && ch[2] !== false ? '' : r.copies ? 'hot' : 'zero'],
        ['Evidence of what happened', r.evidence, r.evidence === 'lost' ? 'hot' : r.evidence === 'kept in place' ? 'zero' : ''],
        ['Notification decision', r.decided, r.decided === 'late' ? 'hot' : r.decided === '—' ? '' : 'zero'],
        ['Guard against a repeat', r.guarded ? 'in place' : (ch[6] === false ? 'none' : '—'), r.guarded ? 'zero' : ch[6] === false ? 'hot' : '']
      ].map(function (m) { return '<div class="tl-m"><div class="n ' + m[2] + '">' + esc(String(m[1])) + '</div><div class="l">' + esc(m[0]) + '</div></div>'; }).join('');
    }
    render();
    EA.fig('incident', {
      get: function () { return ch.map(function (x) { return x === undefined ? '-' : x ? 'g' : 'b'; }).join(''); },
      set: function (s) { ch = S.map(function (_, i) { var c = String(s).charAt(i); return c === 'g' ? true : c === 'b' ? false : undefined; }); var cut = ch.indexOf(undefined); if (cut >= 0) for (var i = cut; i < ch.length; i++) ch[i] = undefined; render(); },
      reset: function () { ch = S.map(function () { return undefined; }); render(); },
      read: function () {
        var r = M.incident(S, ch);
        if (!r.done) return 'Sep 23, 23:59: an alert says Pulse user IDs were joined to advertising IDs. Seven decisions follow. Choose each move.';
        return '<b>' + r.done + ' of ' + r.total + ' decisions made.</b> Extra days running: ' + r.runDays + '. Copies left: ' + r.copies + '. Evidence: ' + r.evidence + '. Notification decision: ' + r.decided + '.' + (r.done === r.total ? (r.guarded ? ' A new invariant guards against a repeat.' : ' Nothing stops a repeat.') : '');
      }
    });
  })();

})(window);
