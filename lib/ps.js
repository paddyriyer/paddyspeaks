/**
 * PaddySpeaks Analytics — Lightweight Tracker
 * Cookie-free, privacy-respecting, ~1KB
 *
 * SETUP: Replace ENDPOINT below with your Cloudflare Worker URL
 */
(function () {
  'use strict';

  // ── Configuration ────────────────────────────────────
  var ENDPOINT = 'https://paddyspeaks.paddy-iyer.workers.dev/collect';

  // ── Guards ───────────────────────────────────────────
  if (navigator.doNotTrack === '1') return;
  if (document.visibilityState === 'prerender') return;

  // ── Session ID (sessionStorage, no cookies) ──────────
  var sid = sessionStorage.getItem('_ps_sid');
  if (!sid) {
    sid = typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : 'xxxx-xxxx-xxxx'.replace(/x/g, function () {
          return (Math.random() * 16 | 0).toString(16);
        });
    sessionStorage.setItem('_ps_sid', sid);
  }

  // ── Payload ──────────────────────────────────────────
  var data = JSON.stringify({
    p: location.pathname,
    r: document.referrer,
    s: screen.width + 'x' + screen.height,
    l: navigator.language,
    sid: sid
  });

  // ── Send (non-blocking) ──────────────────────────────
  var blob = new Blob([data], { type: 'application/json' });
  if (navigator.sendBeacon) {
    navigator.sendBeacon(ENDPOINT, blob);
  } else {
    var x = new XMLHttpRequest();
    x.open('POST', ENDPOINT, true);
    x.setRequestHeader('Content-Type', 'application/json');
    x.send(data);
  }
})();
