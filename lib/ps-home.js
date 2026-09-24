/**
 * PaddySpeaks — homepage behaviour (docs/HOMEPAGE-UI-AUDIT.md).
 *
 * Progressive enhancement only: with JavaScript off the page is complete —
 * the nav is an ordinary row, every section is visible and the JobSignal
 * counts fall back to words. Nothing is stored and nothing leaves the browser
 * except one same-origin GET of /jobs/data/stats.json.
 *
 *   1. (Sticky nav state moved to lib/ps-nav.js, shared by every page
 *      that uses the header.)
 *   2. Where am I: the nav link for the chapter in view gets aria-current.
 *   3. Live JobSignal numbers: filled from the pipeline's own stats file, so
 *      the homepage never types a count that the next ingest would make wrong.
 */
(function () {
  'use strict';
  var IO = 'IntersectionObserver' in window;

  /* 1 ── sticky state: lib/ps-nav.js (shared with every page using the header) */

  /* 2 ── chapter in view → aria-current on its nav link */
  var links = {};
  Array.prototype.forEach.call(document.querySelectorAll('.nav-bar a[data-journey]'), function (a) {
    links[a.getAttribute('data-journey')] = a;
  });
  var chapters = document.querySelectorAll('.ps-chapter-block[data-journey]');
  var current = null;
  function mark(j) {
    if (j === current) return;
    if (current && links[current]) links[current].removeAttribute('aria-current');
    current = j;
    if (j && links[j]) links[j].setAttribute('aria-current', 'location');
  }
  if (IO && chapters.length) {
    var seen = {};
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { seen[e.target.getAttribute('data-journey')] = e.isIntersecting; });
      var pick = null;
      Array.prototype.forEach.call(chapters, function (c) {
        var j = c.getAttribute('data-journey');
        if (!pick && seen[j]) pick = j;
      });
      mark(pick);
    }, { rootMargin: '-45% 0px -50% 0px' });
    Array.prototype.forEach.call(chapters, function (c) { io.observe(c); });
  }

  /* 3 ── live JobSignal counts */
  var live = document.querySelectorAll('[data-ps-live]');
  if (live.length && window.fetch) {
    fetch('/jobs/data/stats.json', { credentials: 'omit' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (st) {
        if (!st) return;
        var ok = true;
        Array.prototype.forEach.call(live, function (el) {
          var v = st[el.getAttribute('data-ps-live')];
          if (typeof v !== 'number' || v <= 0) { ok = false; return; }
          el.textContent = v.toLocaleString('en-US');
        });
        if (!ok) return;   // an empty board keeps the words, never shows a zero
        Array.prototype.forEach.call(document.querySelectorAll('[data-ps-live-show]'), function (el) { el.hidden = false; });
        Array.prototype.forEach.call(document.querySelectorAll('[data-ps-live-fallback]'), function (el) { el.hidden = true; });
        var when = document.querySelector('[data-ps-live-when]');
        if (when && st.generated_at) {
          var d = new Date(st.generated_at);
          if (!isNaN(d)) {
            when.setAttribute('datetime', st.generated_at);
            when.textContent = d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
          }
        }
      })
      .catch(function () { /* keep the fallback words */ });
  }
})();
