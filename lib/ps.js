/**
 * PaddySpeaks Analytics — Tracker v2
 * Cookie-free, privacy-respecting
 * Tracks: page view, scroll depth, time on page, UTM, new vs returning
 */
(function () {
  'use strict';

  // ── Configuration ────────────────────────────────────
  var ENDPOINT = 'https://ps.paddyspeaks.com/api/v';

  // ── Guards ───────────────────────────────────────────
  if (document.visibilityState === 'prerender') return;

  // ── Session ID (sessionStorage — resets on tab close) ──
  var sid = sessionStorage.getItem('_ps_sid');
  if (!sid) {
    sid = typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : 'xxxx-xxxx-xxxx'.replace(/x/g, function () {
          return (Math.random() * 16 | 0).toString(16);
        });
    sessionStorage.setItem('_ps_sid', sid);
  }

  // ── Visitor ID (localStorage — persists across visits) ──
  var vid = localStorage.getItem('_ps_vid');
  var isNew = !vid;
  if (!vid) {
    vid = typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : 'xxxx-xxxx-xxxx-xxxx'.replace(/x/g, function () {
          return (Math.random() * 16 | 0).toString(16);
        });
    localStorage.setItem('_ps_vid', vid);
  }

  // ── UTM Parameters ──────────────────────────────────
  var params = new URLSearchParams(location.search);
  var utm = {
    source: params.get('utm_source') || '',
    medium: params.get('utm_medium') || '',
    campaign: params.get('utm_campaign') || ''
  };

  // ── Page View Beacon ────────────────────────────────
  var payload = {
    p: location.pathname,
    r: document.referrer,
    s: screen.width + 'x' + screen.height,
    v: innerWidth + 'x' + innerHeight,
    l: navigator.language,
    sid: sid,
    vid: vid,
    new: isNew ? 1 : 0,
    ut_s: utm.source,
    ut_m: utm.medium,
    ut_c: utm.campaign,
    dark: window.matchMedia('(prefers-color-scheme:dark)').matches ? 1 : 0
  };

  var blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
  if (navigator.sendBeacon) {
    navigator.sendBeacon(ENDPOINT, blob);
  } else {
    var x = new XMLHttpRequest();
    x.open('POST', ENDPOINT, true);
    x.setRequestHeader('Content-Type', 'application/json');
    x.send(JSON.stringify(payload));
  }

  // ── Scroll Depth Tracking ───────────────────────────
  var maxScroll = 0;
  var ticking = false;

  function updateScroll() {
    var scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    var docHeight = Math.max(
      document.body.scrollHeight, document.documentElement.scrollHeight
    ) - innerHeight;
    if (docHeight > 0) {
      var pct = Math.round((scrollTop / docHeight) * 100);
      if (pct > maxScroll) maxScroll = pct;
    }
    ticking = false;
  }

  window.addEventListener('scroll', function () {
    if (!ticking) { ticking = true; requestAnimationFrame(updateScroll); }
  }, { passive: true });

  // ── Time on Page + Send Exit Beacon ─────────────────
  var startTime = Date.now();

  function sendExit() {
    var duration = Math.round((Date.now() - startTime) / 1000);
    if (duration < 1) return;
    var exitData = JSON.stringify({
      t: 'exit',
      p: location.pathname,
      sid: sid,
      dur: duration,
      scroll: maxScroll
    });
    var exitBlob = new Blob([exitData], { type: 'application/json' });
    navigator.sendBeacon(ENDPOINT, exitBlob);
  }

  // Fire on tab hide or page unload
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') sendExit();
  });
})();
