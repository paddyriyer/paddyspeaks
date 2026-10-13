/* Śrī Devī Māhātmyam — study edition reader. Loaded by every page that
   scripts/devi_mahatmyam/build.mjs writes; edit here, then rebuild (the link
   carries ?v=<hash>). Everything here is an enhancement: without it the
   verses, their analysis and the verse links still work.

   - Reading settings (Sanskrit size, Devanagari / IAST / both) are kept in
     localStorage "ps.dm.reader.v1" on this device only (data/platform/state-keys.json).
   - The reader bar shows the current verse, moves to the previous / next one
     and jumps to any verse by number.
   - "Expand all" / "Collapse all" opens or closes every analysis section.
   - Each verse's Copy button copies its Sanskrit. */
(function () {
  'use strict';
  var KEY = 'ps.dm.reader.v1';
  var SIZES = [0.85, 1, 1.18, 1.36];
  var root = document.documentElement;

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; }
  }
  function save(p) {
    try { localStorage.setItem(KEY, JSON.stringify(p)); } catch (e) { /* settings simply aren't remembered */ }
  }
  var prefs = load();
  if (typeof prefs.size !== 'number' || prefs.size < 0 || prefs.size >= SIZES.length) prefs.size = 1;
  if (['both', 'dev', 'iast'].indexOf(prefs.script) < 0) prefs.script = 'both';

  function apply() {
    root.style.setProperty('--sa-scale', String(SIZES[prefs.size]));
    root.setAttribute('data-script', prefs.script);
  }
  apply();

  var live;
  function say(msg) {
    if (!live) return;
    live.textContent = '';
    setTimeout(function () { live.textContent = msg; }, 30);
  }

  function copy(text, label) {
    function done() { say(label + ' copied'); }
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); done(); } catch (e) { say('Copy failed — select the verse to copy it'); }
      document.body.removeChild(ta);
    }
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(done, fallback);
    } else {
      fallback();
    }
  }

  function init() {
    live = document.querySelector('.rb-live');

    // Copy buttons (every verse)
    document.addEventListener('click', function (ev) {
      var b = ev.target.closest && ev.target.closest('button.copy[data-copy]');
      if (!b) return;
      copy(b.getAttribute('data-copy'), 'Verse ' + (b.closest('.verse') || {}).getAttribute('data-id'));
      var old = b.textContent;
      b.textContent = 'Copied';
      setTimeout(function () { b.textContent = old; }, 1400);
    });

    var bar = document.querySelector('.reader-bar');
    if (!bar) return;
    var verses = Array.prototype.slice.call(document.querySelectorAll('.verse[id]'));
    if (!verses.length) return;
    var prog = bar.querySelector('.rb-prog');
    var tools = bar.querySelector('.rb-tools');
    var cur = bar.querySelector('[data-cur]');
    var fill = bar.querySelector('.rb-fill');
    var jump = bar.querySelector('.rb-jump');
    var aa = bar.querySelector('.rb-aa');
    var panel = document.getElementById('rb-panel');
    prog.hidden = false;
    tools.hidden = false;

    var index = 0;
    function setCurrent(i) {
      index = i;
      var v = verses[i];
      cur.textContent = v.getAttribute('data-id');
      fill.style.width = (((i + 1) / verses.length) * 100).toFixed(2) + '%';
      if (jump.value !== v.id) jump.value = v.id;
    }

    // The current verse is the last one whose top has passed the reading line
    // just below the bars.
    function offset() {
      var h = 0;
      var sb = document.querySelector('.site-bar');
      if (sb && getComputedStyle(sb).position === 'sticky') h += sb.offsetHeight;
      return h + bar.offsetHeight + 24;
    }
    var ticking = false;
    function measure() {
      ticking = false;
      var line = offset();
      var lo = 0, hi = verses.length - 1, best = 0;
      while (lo <= hi) {
        var mid = (lo + hi) >> 1;
        if (verses[mid].getBoundingClientRect().top <= line) { best = mid; lo = mid + 1; } else { hi = mid - 1; }
      }
      if (best !== index || cur.textContent !== verses[best].getAttribute('data-id')) setCurrent(best);
    }
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(measure); }
    }, { passive: true });
    window.addEventListener('resize', measure);

    function go(i) {
      i = Math.max(0, Math.min(verses.length - 1, i));
      var v = verses[i];
      if (history.replaceState) history.replaceState(null, '', '#' + v.id);
      v.scrollIntoView({ block: 'start' });
      setCurrent(i);
      var h = v.querySelector('.v-num a');
      if (h) h.focus({ preventScroll: true });
      say('Verse ' + v.getAttribute('data-id'));
    }
    bar.addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-go]');
      if (b) go(index + (b.getAttribute('data-go') === 'next' ? 1 : -1));
    });
    jump.addEventListener('change', function () {
      for (var i = 0; i < verses.length; i++) if (verses[i].id === jump.value) { go(i); break; }
    });

    // Reading settings panel
    function openPanel(open) {
      panel.hidden = !open;
      aa.setAttribute('aria-expanded', open ? 'true' : 'false');
    }
    aa.addEventListener('click', function () { openPanel(panel.hidden); });
    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape' && !panel.hidden) { openPanel(false); aa.focus(); }
    });
    document.addEventListener('click', function (ev) {
      if (!panel.hidden && !panel.contains(ev.target) && !aa.contains(ev.target)) openPanel(false);
    });

    function syncPanel() {
      Array.prototype.forEach.call(panel.querySelectorAll('[data-script]'), function (b) {
        b.setAttribute('aria-checked', b.getAttribute('data-script') === prefs.script ? 'true' : 'false');
      });
      var dn = panel.querySelector('[data-size="-1"]');
      var up = panel.querySelector('[data-size="1"]');
      dn.disabled = prefs.size === 0;
      up.disabled = prefs.size === SIZES.length - 1;
    }
    syncPanel();

    panel.addEventListener('click', function (ev) {
      var b = ev.target.closest('button');
      if (!b) return;
      var v = verses[index];
      var top = v.getBoundingClientRect().top;
      if (b.hasAttribute('data-size')) {
        var d = +b.getAttribute('data-size');
        prefs.size = d === 0 ? 1 : Math.max(0, Math.min(SIZES.length - 1, prefs.size + d));
        apply(); save(prefs); syncPanel();
        say('Sanskrit size ' + Math.round(SIZES[prefs.size] * 100) + '%');
      } else if (b.hasAttribute('data-script')) {
        prefs.script = b.getAttribute('data-script');
        apply(); save(prefs); syncPanel();
        say(prefs.script === 'both' ? 'Showing Devanagari and IAST' : prefs.script === 'dev' ? 'Showing Devanagari only' : 'Showing IAST only');
      } else if (b.hasAttribute('data-expand')) {
        var open = b.getAttribute('data-expand') === '1';
        Array.prototype.forEach.call(document.querySelectorAll('details.an'), function (d) { d.open = open; });
        say(open ? 'All grammar and commentary opened' : 'All grammar and commentary closed');
      }
      // keep the verse being read where it was
      window.scrollBy(0, v.getBoundingClientRect().top - top);
    });

    // Arrow keys on the radio group
    panel.querySelector('[role="radiogroup"]').addEventListener('keydown', function (ev) {
      if (ev.key !== 'ArrowRight' && ev.key !== 'ArrowLeft') return;
      var bs = Array.prototype.slice.call(this.querySelectorAll('[role="radio"]'));
      var i = bs.indexOf(document.activeElement);
      if (i < 0) return;
      ev.preventDefault();
      var n = bs[(i + (ev.key === 'ArrowRight' ? 1 : bs.length - 1)) % bs.length];
      n.focus();
      n.click();
    });

    // Opening a verse link inside a closed section (e.g. #m-1-2) still works:
    // browsers scroll to the id; nothing is hidden by default except analysis.
    measure();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
