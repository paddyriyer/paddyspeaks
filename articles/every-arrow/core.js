/* Every Arrow Is a Decision — the reading framework.
 *
 * Owns everything that is not a particular figure:
 *   · reading paths (executive / full), remembered per browser and linkable (?path=exec)
 *   · the table of contents: current scene, chapter progress, the phone sheet
 *   · the figure registry: every interactive figure registers get/set/reset/read,
 *     and this file supplies Reset, "Copy link to this state", the written
 *     interpretation (an aria-live region) and deep links (?f=<figure>:<state>)
 *   · details (field notes, builder notes): open all, open on deep link, open for print
 *
 * Figures degrade to the static fallback in their markup when this file never
 * runs (the page ships every figure's static state sequence in the HTML).
 */
(function (root) {
  'use strict';
  var d = document;
  var RM = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function $(s, r) { return (r || d).querySelector(s); }
  function $$(s, r) { return [].slice.call((r || d).querySelectorAll(s)); }
  var store = {
    get: function (k) { try { return root.localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { root.localStorage.setItem(k, v); } catch (e) { /* private mode: fine */ } }
  };
  var PATH_KEY = 'ea.path.v1'; /* registered in data/platform/state-keys.json */

  var EA = root.EA = root.EA || {};
  /* The contents sheet and the reading paths depend on this file; say it ran. */
  d.documentElement.classList.add('ea-core');
  EA.RM = RM;
  EA.$ = $; EA.$$ = $$;
  EA.el = function (tag, attrs, html) {
    var e = d.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    if (html != null) e.innerHTML = html;
    return e;
  };
  EA.esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  /* Arrow keys move between the buttons of a tablist / radiogroup. */
  EA.arrowKeys = function (container, sel, upIsNext) {
    container.addEventListener('keydown', function (ev) {
      var btns = $$(sel, container).filter(function (b) { return !b.disabled; });
      var i = btns.indexOf(d.activeElement);
      if (i < 0) return;
      var fwd = upIsNext ? 'ArrowUp' : 'ArrowDown', back = upIsNext ? 'ArrowDown' : 'ArrowUp', n = null;
      if (ev.key === 'ArrowRight' || ev.key === fwd) n = (i + 1) % btns.length;
      if (ev.key === 'ArrowLeft' || ev.key === back) n = (i - 1 + btns.length) % btns.length;
      if (ev.key === 'Home') n = 0;
      if (ev.key === 'End') n = btns.length - 1;
      if (n !== null) { ev.preventDefault(); btns[n].focus(); btns[n].click(); }
    });
  };
  /* Roving tabindex + aria-selected/checked for a set of buttons. */
  EA.select = function (btns, i, attr) {
    attr = attr || 'aria-selected';
    btns.forEach(function (b, j) { b.setAttribute(attr, j === i ? 'true' : 'false'); b.tabIndex = j === i ? 0 : -1; });
  };
  EA.onView = function (node, fn, margin) {
    if (!node) return;
    if (!('IntersectionObserver' in root)) { fn(); return; }
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { io.disconnect(); fn(); } });
    }, { rootMargin: margin || '0px 0px -15% 0px', threshold: 0.1 });
    io.observe(node);
  };

  /* ── figure registry ─────────────────────────────────────────── */
  var FIGS = EA.figs = {};
  var pending = parseFigParams();
  function parseFigParams() {
    var out = {};
    var q = root.location.search.replace(/^\?/, '').split('&');
    q.forEach(function (kv) {
      var p = kv.split('=');
      if (p[0] !== 'f' || !p[1]) return;
      decodeURIComponent(p[1]).split(',').forEach(function (s) {
        var i = s.indexOf(':');
        if (i > 0) out[s.slice(0, i)] = s.slice(i + 1);
      });
    });
    return out;
  }
  EA.link = function (id) {
    var f = FIGS[id], st = f && f.api.get();
    var u = root.location.origin + root.location.pathname;
    return u + (st != null && st !== '' ? '?f=' + encodeURIComponent(id + ':' + st) : '') + '#fig-' + id;
  };
  /* A figure calls EA.fig(id, api) once it has mounted. api: { get, set, reset, read }.
     get() returns a short state string; set(s) must accept any string get() returned;
     read() returns the plain-language interpretation of the current state. */
  EA.fig = function (id, api) {
    var node = d.getElementById('fig-' + id);
    if (!node) return;
    var f = FIGS[id] = { id: id, api: api, node: node, initial: api.get() };
    node.classList.add('is-live');
    var readout = $('.fig-read', node);
    var reset = $('[data-fig-reset]', node), link = $('[data-fig-link]', node), note = $('.fig-copied', node);
    if (reset) reset.addEventListener('click', function () { api.reset(); EA.changed(id); });
    if (link) link.addEventListener('click', function () {
      var url = EA.link(id);
      var done = function (ok) {
        if (!note) return;
        note.textContent = ok ? 'Link copied.' : url;
        note.hidden = false;
        clearTimeout(note._t); note._t = setTimeout(function () { note.hidden = true; }, ok ? 2400 : 12000);
      };
      if (root.navigator.clipboard && root.navigator.clipboard.writeText) root.navigator.clipboard.writeText(url).then(function () { done(true); }, function () { done(false); });
      else done(false);
      try { root.history.replaceState(null, '', url); } catch (e) { /* file:// */ }
    });
    if (pending[id] != null) { try { api.set(pending[id]); } catch (e) { api.reset(); } }
    EA.changed(id, true);
  };
  /* Figures call this after every state change. The first call is quiet (no announcement). */
  EA.changed = function (id, quiet) {
    var f = FIGS[id]; if (!f) return;
    var st = f.api.get();
    f.node.setAttribute('data-state', st);
    var readout = $('.fig-read', f.node);
    if (readout) {
      var t = f.api.read();
      if (quiet) { readout.setAttribute('aria-live', 'off'); readout.innerHTML = t; readout.setAttribute('aria-live', 'polite'); }
      else readout.innerHTML = t;
    }
    var reset = $('[data-fig-reset]', f.node);
    if (reset) reset.disabled = st === f.initial;
  };

  /* ── reading paths ──────────────────────────────────────────── */
  function setPath(p, remember) {
    if (p !== 'exec') p = 'full';
    d.documentElement.setAttribute('data-path', p);
    $$('[data-set-path]').forEach(function (b) {
      var on = b.getAttribute('data-set-path') === p;
      if (b.tagName === 'A') { if (on) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current'); }
      else b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    var live = $('#pathLive');
    if (live && remember) live.textContent = p === 'exec' ? 'Executive path: showing the thesis, each scene in brief, and the field kit.' : 'Full path: showing everything.';
    if (remember) store.set(PATH_KEY, p);
  }
  (function () {
    var q = /[?&]path=(exec|full)\b/.exec(root.location.search);
    setPath(q ? q[1] : (store.get(PATH_KEY) || 'full'), false);
    $$('[data-set-path]').forEach(function (b) {
      b.addEventListener('click', function (ev) {
        ev.preventDefault();
        var p = b.getAttribute('data-set-path');
        setPath(p, true);
        if (b.hasAttribute('data-go')) { var t = d.getElementById(b.getAttribute('data-go')); if (t) t.scrollIntoView({ behavior: RM ? 'auto' : 'smooth', block: 'start' }); }
      });
    });
    /* In the executive path, a scene's "Read the full scene" button opens that one scene. */
    $$('[data-open-scene]').forEach(function (b) {
      b.addEventListener('click', function () {
        var s = b.closest('.scene'); if (!s) return;
        var open = !s.classList.contains('open');
        s.classList.toggle('open', open);
        b.setAttribute('aria-expanded', open ? 'true' : 'false');
        b.textContent = open ? 'Back to the brief' : 'Read the full scene';
      });
    });
  })();

  /* ── table of contents, progress ────────────────────────────── */
  (function () {
    var bar = $('#progress');
    var scenes = $$('main .scene[id]');
    var chapters = $$('main .chapter[id]');
    var links = {};
    $$('.toc a[href^="#"]').forEach(function (a) { links[a.getAttribute('href').slice(1)] = a; });
    var toggle = $('#tocToggle'), toc = $('#toc'), now = $('#tocNow');
    function openToc(v) {
      if (!toggle) return;
      toggle.setAttribute('aria-expanded', v ? 'true' : 'false');
      d.documentElement.classList.toggle('toc-open', v);
      if (v) { var cur = $('.toc a[aria-current]'); (cur || $('.toc a')).focus(); }
    }
    if (toggle) {
      toggle.addEventListener('click', function () { openToc(toggle.getAttribute('aria-expanded') !== 'true'); });
      d.addEventListener('keydown', function (e) { if (e.key === 'Escape' && d.documentElement.classList.contains('toc-open')) { openToc(false); toggle.focus(); } });
      $$('.toc a').forEach(function (a) { a.addEventListener('click', function () { if (d.documentElement.classList.contains('toc-open')) openToc(false); }); });
    }
    var ticking = false;
    function update() {
      ticking = false;
      var h = d.documentElement.scrollHeight - root.innerHeight;
      if (bar) bar.style.transform = 'scaleX(' + (h > 0 ? Math.min(1, root.scrollY / h) : 0) + ')';
      var y = root.innerHeight * 0.3, cur = null, curCh = null;
      scenes.forEach(function (s) { if (s.offsetParent !== null && s.getBoundingClientRect().top < y) cur = s; });
      chapters.forEach(function (c) { if (c.getBoundingClientRect().top < y) curCh = c; });
      Object.keys(links).forEach(function (k) { links[k].removeAttribute('aria-current'); });
      if (cur && links[cur.id]) links[cur.id].setAttribute('aria-current', 'location');
      if (curCh && links[curCh.id]) links[curCh.id].setAttribute('aria-current', cur ? 'true' : 'location');
      /* chapter progress: how far through each chapter the reader is */
      chapters.forEach(function (c) {
        var r = c.getBoundingClientRect(), p = r.height > 0 ? Math.max(0, Math.min(1, (y - r.top) / r.height)) : 0;
        var m = $('.toc [data-ch="' + c.id + '"] .toc-bar i');
        if (m) m.style.width = Math.round(p * 100) + '%';
      });
      if (now) {
        var t = curCh ? (curCh.getAttribute('data-title') || '') : 'Contents';
        var s = cur ? (cur.getAttribute('data-title') || '') : '';
        now.textContent = t + (s ? ' · ' + s : '');
      }
    }
    root.addEventListener('scroll', function () { if (!ticking) { ticking = true; root.requestAnimationFrame(update); } }, { passive: true });
    root.addEventListener('resize', update);
    update();
  })();

  /* ── details: field notes and builder notes ─────────────────── */
  (function () {
    var btn = $('#openNotes');
    if (btn) btn.addEventListener('click', function () {
      var open = btn.getAttribute('aria-pressed') !== 'true';
      $$('details.builder, details.fieldnote').forEach(function (x) { x.open = open; });
      btn.setAttribute('aria-pressed', open ? 'true' : 'false');
      btn.textContent = open ? 'Close all notes' : 'Open all notes';
    });
    function reveal() {
      var id = root.location.hash.slice(1);
      var t = id && d.getElementById(id);
      if (!t) return;
      var p = t.closest('details');
      while (p) { p.open = true; p = p.parentElement && p.parentElement.closest('details'); }
      var s = t.closest('.scene');
      if (s && d.documentElement.getAttribute('data-path') === 'exec') s.classList.add('open');
    }
    root.addEventListener('hashchange', reveal);
    reveal();
    /* Print everything: notes open, and restore what the reader had afterwards. */
    var was = [];
    root.addEventListener('beforeprint', function () {
      was = $$('details').map(function (x) { var o = x.open; x.open = true; return [x, o]; });
    });
    root.addEventListener('afterprint', function () { was.forEach(function (p) { p[0].open = p[1]; }); was = []; });
    var pb = $('#printBtn');
    if (pb) pb.addEventListener('click', function () { root.print(); });
  })();

  /* Once every figure script has run, jump to a deep-linked figure (it may have grown the page). */
  EA.ready = function () {
    var ids = Object.keys(pending);
    var target = ids.length ? d.getElementById('fig-' + ids[0]) : null;
    if (!target && root.location.hash) {
      var h = d.getElementById(root.location.hash.slice(1));
      if (h && (h.querySelector('.tl, .fig') || h.classList.contains('fig'))) target = h;
    }
    if (target) target.scrollIntoView({ behavior: 'auto', block: 'start' });
  };
})(window);
