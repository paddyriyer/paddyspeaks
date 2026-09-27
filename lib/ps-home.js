/**
 * PaddySpeaks — homepage behaviour (docs/HOMEPAGE-MAP-REDESIGN.md).
 *
 * Progressive enhancement only: with JavaScript off the page is complete —
 * the nav is an ordinary row, every link works, "Surprise me" opens the
 * archive. Nothing is stored. The only requests are same-origin GETs:
 * article_metadata.json when "Surprise me" is used, and
 * /jobs/data/stats.json if the page carries [data-ps-live] counts.
 *
 *   1. (Sticky nav state moved to lib/ps-nav.js, shared by every page
 *      that uses the header.)
 *   2. "Surprise me": a random essay, fetched on click only.
 *   3. Live JobSignal numbers: filled from the pipeline's own stats file, so
 *      the homepage never types a count that the next ingest would make wrong.
 */
(function () {
  'use strict';
  /* 1 ── sticky state: lib/ps-nav.js (shared with every page using the header) */

  /* 2 ── "Surprise me": one essay at random. The list is fetched only when
     the link is used (article_metadata.json, same origin); without JavaScript,
     or if the fetch fails, the link simply opens the archive. */
  var surprise = document.querySelector('[data-ps-surprise]');
  if (surprise && window.fetch) {
    surprise.addEventListener('click', function (e) {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
      e.preventDefault();
      fetch('/article_metadata.json', { credentials: 'omit' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (list) {
          if (!list || !list.length) throw new Error('empty');
          var pick = list[Math.floor(Math.random() * list.length)];
          location.href = '/articles/' + pick.slug;
        })
        .catch(function () { location.href = surprise.getAttribute('href'); });
    });
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
