/**
 * PaddySpeaks Analytics — Tracker v3
 * Cookie-free, privacy-respecting
 * Tracks: page view, scroll depth, time on page, UTM, new vs returning,
 *         page load time, 404 detection, search keywords, session page count
 */
(function () {
  'use strict';

  var ENDPOINT = 'https://ps.paddyspeaks.com/api/v';

  if (document.visibilityState === 'prerender') return;

  // ── Session ID ──
  var sid = sessionStorage.getItem('_ps_sid');
  if (!sid) {
    sid = typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : 'xxxx-xxxx-xxxx'.replace(/x/g, function () {
          return (Math.random() * 16 | 0).toString(16);
        });
    sessionStorage.setItem('_ps_sid', sid);
  }

  // ── Session page count (for entry/exit + bounce detection) ──
  var pageCount = parseInt(sessionStorage.getItem('_ps_pc') || '0', 10) + 1;
  sessionStorage.setItem('_ps_pc', pageCount);

  // ── Visitor ID (persistent) ──
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

  // ── First visit timestamp (for return frequency) ──
  var firstVisit = localStorage.getItem('_ps_first');
  if (!firstVisit) {
    firstVisit = new Date().toISOString();
    localStorage.setItem('_ps_first', firstVisit);
  }

  // ── UTM Parameters ──
  var params = new URLSearchParams(location.search);
  var utm = {
    source: params.get('utm_source') || '',
    medium: params.get('utm_medium') || '',
    campaign: params.get('utm_campaign') || ''
  };

  // ── Search keywords from referrer ──
  var searchQuery = '';
  try {
    if (document.referrer) {
      var refUrl = new URL(document.referrer);
      var refParams = refUrl.searchParams;
      searchQuery = refParams.get('q') || refParams.get('query') || refParams.get('p') || '';
    }
  } catch (e) {}

  // ── 404 detection ──
  var is404 = document.title.toLowerCase().indexOf('404') !== -1 ||
    document.querySelector('h1') && document.querySelector('h1').textContent.toLowerCase().indexOf('not found') !== -1 ? 1 : 0;

  // ── Page load time ──
  var loadTime = 0;
  try {
    var perf = performance.getEntriesByType('navigation');
    if (perf.length) loadTime = Math.round(perf[0].loadEventEnd - perf[0].startTime);
  } catch (e) {}

  // ── Page View Beacon ──
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
    dark: window.matchMedia('(prefers-color-scheme:dark)').matches ? 1 : 0,
    pc: pageCount,
    sq: searchQuery,
    is404: is404,
    lt: loadTime
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

  // ── Scroll Depth ──
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

  // ── Exit Beacon ──
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

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') sendExit();
  });
})();
