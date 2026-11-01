/* The Upaniṣads — study edition reader. Loaded by every page that
   scripts/upanishads/build.mjs writes; edit here, then rebuild (the link carries
   ?v=<hash>). Everything here is an enhancement: without it every page reads in
   full, with the Serious Student sections open.

   - Reading path (1 Curious Reader, 2 Serious Student, 3 Scholar) decides which
     sections are open when a mantra page loads; nothing is ever hidden or locked.
   - Script (Devanagari / IAST / both), Sanskrit size and English size.
   - Settings are kept in localStorage "ps.upanishad.reader.v1" on this device only
     (registered in data/platform/state-keys.json).
   - Copy buttons, glossary search, and the concept map's highlighting. */
(function () {
  'use strict';
  var KEY = 'ps.upanishad.reader.v1';
  var SA = [0.85, 1, 1.15, 1.32, 1.5];
  var EN = [0.9, 1, 1.1, 1.22];
  var root = document.documentElement;

  function load() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch (e) { /* not remembered */ } }
  var prefs = load();
  if ([1, 2, 3].indexOf(prefs.path) < 0) prefs.path = 2;
  if (['both', 'dev', 'iast'].indexOf(prefs.script) < 0) prefs.script = 'both';
  if (typeof prefs.sa !== 'number' || prefs.sa < 0 || prefs.sa >= SA.length) prefs.sa = 1;
  if (typeof prefs.en !== 'number' || prefs.en < 0 || prefs.en >= EN.length) prefs.en = 1;

  function applyLook() {
    root.style.setProperty('--sa-scale', String(SA[prefs.sa]));
    root.style.setProperty('--en-scale', String(EN[prefs.en]));
    root.setAttribute('data-script', prefs.script);
    root.setAttribute('data-path', String(prefs.path));
  }
  applyLook();

  function applyPath(all) {
    var ds = document.querySelectorAll('details[data-lvl]');
    for (var i = 0; i < ds.length; i++) {
      var lvl = parseInt(ds[i].getAttribute('data-lvl'), 10) || 1;
      ds[i].open = all ? true : lvl <= prefs.path;
    }
    var cs = document.querySelectorAll('.concepts[data-lvl]');
    for (var j = 0; j < cs.length; j++) cs[j].hidden = false;
  }

  var live;
  function say(msg) { if (!live) return; live.textContent = ''; setTimeout(function () { live.textContent = msg; }, 30); }

  function copy(text) {
    function done() { say('Sanskrit copied'); }
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); done(); } catch (e) { say('Copy failed — select the text to copy it'); }
      document.body.removeChild(ta);
    }
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done, fallback);
    else fallback();
  }

  function setChecked(group, attr, val) {
    var bs = group.querySelectorAll('[' + attr + ']');
    for (var i = 0; i < bs.length; i++) bs[i].setAttribute('aria-checked', String(bs[i].getAttribute(attr) === String(val)));
  }

  function readerBar() {
    var bar = document.getElementById('reader-bar');
    if (!bar) return;
    bar.hidden = false;
    live = document.getElementById('rb-live');
    var paths = bar.querySelector('.rb-paths');
    var panel = document.getElementById('rb-panel');
    var aa = bar.querySelector('.rb-aa');
    setChecked(paths, 'data-path', prefs.path);
    setChecked(panel, 'data-script', prefs.script);
    // a page reached through a section link (#m6-s10) opens that section too
    applyPath(false);
    if (location.hash) { var t = document.getElementById(location.hash.slice(1)); if (t && t.tagName === 'DETAILS') t.open = true; }
    paths.addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-path]'); if (!b) return;
      prefs.path = parseInt(b.getAttribute('data-path'), 10); save(); applyLook(); applyPath(false);
      setChecked(paths, 'data-path', prefs.path);
      say(b.textContent + ' path: sections opened to match');
    });
    aa.addEventListener('click', function () {
      var open = panel.hidden; panel.hidden = !open; aa.setAttribute('aria-expanded', String(open));
    });
    document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape' && !panel.hidden) { panel.hidden = true; aa.setAttribute('aria-expanded', 'false'); aa.focus(); } });
    panel.addEventListener('click', function (ev) {
      var b = ev.target.closest('button'); if (!b) return;
      if (b.hasAttribute('data-script')) { prefs.script = b.getAttribute('data-script'); setChecked(panel, 'data-script', prefs.script); }
      if (b.hasAttribute('data-sa')) prefs.sa = Math.max(0, Math.min(SA.length - 1, prefs.sa + parseInt(b.getAttribute('data-sa'), 10)));
      if (b.hasAttribute('data-en')) prefs.en = Math.max(0, Math.min(EN.length - 1, prefs.en + parseInt(b.getAttribute('data-en'), 10)));
      if (b.getAttribute('data-all') === 'open') { applyPath(true); say('All sections open'); }
      if (b.getAttribute('data-all') === 'path') { applyPath(false); say('Sections reset to the path'); }
      save(); applyLook();
    });
  }

  function copies() {
    document.addEventListener('click', function (ev) {
      var b = ev.target.closest('button.copy'); if (b) copy(b.getAttribute('data-copy'));
    });
  }

  function glossary() {
    var box = document.querySelector('.gsearch'); if (!box) return;
    box.hidden = false;
    var q = document.getElementById('gq'), n = document.getElementById('gq-n');
    var items = document.querySelectorAll('.gt');
    var fold = function (s) { return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); };
    var keys = [];
    for (var i = 0; i < items.length; i++) keys.push(fold(items[i].getAttribute('data-q') || ''));
    q.addEventListener('input', function () {
      var v = fold(q.value.trim()), shown = 0;
      for (var i = 0; i < items.length; i++) { var hit = !v || keys[i].indexOf(v) >= 0; items[i].hidden = !hit; if (hit) shown++; }
      var gs = document.querySelectorAll('.gg');
      for (var j = 0; j < gs.length; j++) gs[j].hidden = !gs[j].querySelector('.gt:not([hidden])');
      n.textContent = v ? shown + (shown === 1 ? ' term' : ' terms') : '';
    });
  }

  function cmap() {
    var svg = document.querySelector('svg.cmap'); if (!svg) return;
    var nodes = svg.querySelectorAll('.cn'), edges = svg.querySelectorAll('.ce');
    function show(id) {
      svg.classList.add('dim');
      for (var i = 0; i < nodes.length; i++) { nodes[i].classList.toggle('on', nodes[i].getAttribute('data-id') === id); nodes[i].classList.remove('near'); }
      for (var j = 0; j < edges.length; j++) {
        var f = edges[j].getAttribute('data-from'), t = edges[j].getAttribute('data-to'), on = f === id || t === id;
        edges[j].classList.toggle('on', on);
        if (on) { var other = f === id ? t : f; var o = svg.querySelector('.cn[data-id="' + other + '"]'); if (o) o.classList.add('near'); }
      }
      var cards = document.querySelectorAll('.cl');
      for (var k = 0; k < cards.length; k++) cards[k].classList.toggle('on', cards[k].id === 'n-' + id);
    }
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].addEventListener('focus', function () { show(this.getAttribute('data-id')); });
      nodes[i].addEventListener('mouseenter', function () { show(this.getAttribute('data-id')); });
    }
    if (location.hash.indexOf('#n-') === 0) show(location.hash.slice(3));
  }

  function init() { readerBar(); copies(); glossary(); cmap(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
