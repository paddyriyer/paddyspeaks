/**
 * PaddySpeaks Analytics — Tracker v4
 * Cookie-free, privacy-respecting, first-party. No fingerprinting, no full IP.
 *
 * Backward-compatible superset of v3: still POSTs the same page-view fields the
 * Worker already reads, and still sends the legacy exit beacon. Adds:
 *   - Do Not Track / Global Privacy Control respect (audit fix G)
 *   - ACTIVE engagement time — counts only visible+focused ms (audit fix C)
 *   - Reliable flush on pagehide + visibilitychange via sendBeacon (fix C)
 *   - Scroll milestone events (25/50/75/90), emitted once each
 *   - window.psTrack(name, props) — public event API for Interview Studio
 *
 * Event contract: docs/analytics/EVENT-TAXONOMY.md
 */
(function () {
  'use strict';

  var COLLECT = 'https://ps.paddyspeaks.com/api/v';   // page view + legacy exit
  var EVENTS  = 'https://ps.paddyspeaks.com/api/e';    // versioned events
  var SCHEMA_VERSION = 1;

  // ── Consent guards (fix G) ──
  var dnt = navigator.doNotTrack === '1' || window.doNotTrack === '1' ||
            navigator.msDoNotTrack === '1' || navigator.globalPrivacyControl === true;
  if (dnt) { window.psTrack = function () {}; return; }          // honor DNT/GPC
  if (document.visibilityState === 'prerender') return;

  function uuid() {
    return typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
          var r = Math.random() * 16 | 0;
          return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
        });
  }

  // ── Identity: session (30-min inactivity) + persistent visitor ──
  var now = Date.now();
  var sid = sessionStorage.getItem('_ps_sid');
  var lastSeen = parseInt(sessionStorage.getItem('_ps_seen') || '0', 10);
  if (!sid || (lastSeen && now - lastSeen > 30 * 60000)) {
    sid = uuid();
    sessionStorage.setItem('_ps_sid', sid);
    sessionStorage.setItem('_ps_pc', '0');
  }
  sessionStorage.setItem('_ps_seen', String(now));

  var pageCount = parseInt(sessionStorage.getItem('_ps_pc') || '0', 10) + 1;
  sessionStorage.setItem('_ps_pc', String(pageCount));

  var vid = localStorage.getItem('_ps_vid');
  var isNew = !vid;
  if (!vid) { vid = uuid(); localStorage.setItem('_ps_vid', vid); }

  var firstVisit = localStorage.getItem('_ps_first');
  if (!firstVisit) { firstVisit = new Date().toISOString(); localStorage.setItem('_ps_first', firstVisit); }

  // ── UTM (persisted for the session so later events keep attribution) ──
  var params = new URLSearchParams(location.search);
  function utmGet(k) {
    var v = params.get('utm_' + k);
    if (v) { try { sessionStorage.setItem('_ps_utm_' + k, v); } catch (e) {} return v; }
    return sessionStorage.getItem('_ps_utm_' + k) || '';
  }
  var utm = { source: utmGet('source'), medium: utmGet('medium'), campaign: utmGet('campaign'), term: utmGet('term'), content: utmGet('content') };

  // ── Search keyword from referrer (no free text stored server-side) ──
  var searchQuery = '';
  try {
    if (document.referrer) {
      var rp = new URL(document.referrer).searchParams;
      searchQuery = rp.get('q') || rp.get('query') || rp.get('p') || '';
    }
  } catch (e) {}

  var is404 = (document.title.toLowerCase().indexOf('404') !== -1 ||
    (document.querySelector('h1') && document.querySelector('h1').textContent.toLowerCase().indexOf('not found') !== -1)) ? 1 : 0;

  var loadTime = 0;
  try {
    var perf = performance.getEntriesByType('navigation');
    if (perf.length) loadTime = Math.round(perf[0].loadEventEnd - perf[0].startTime);
  } catch (e) {}

  function send(url, obj) {
    var body = JSON.stringify(obj);
    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }));
        return;
      }
    } catch (e) {}
    try {
      var x = new XMLHttpRequest();
      x.open('POST', url, true);
      x.setRequestHeader('Content-Type', 'application/json');
      x.send(body);
    } catch (e) {}
  }

  // ── Page view (identical shape to v3 — old Worker still understands it) ──
  send(COLLECT, {
    p: location.pathname, r: document.referrer,
    s: screen.width + 'x' + screen.height, v: innerWidth + 'x' + innerHeight,
    l: navigator.language, sid: sid, vid: vid, new: isNew ? 1 : 0,
    ut_s: utm.source, ut_m: utm.medium, ut_c: utm.campaign,
    dark: window.matchMedia('(prefers-color-scheme:dark)').matches ? 1 : 0,
    pc: pageCount, sq: searchQuery, is404: is404, lt: loadTime
  });

  // ── Public event API (Interview Studio & content events) ──
  function baseEnvelope() {
    return {
      event_id: uuid(), schema_version: SCHEMA_VERSION,
      vid: vid, sid: sid, ts: new Date().toISOString(),
      p: location.pathname, title: (document.title || '').slice(0, 200),
      r: document.referrer, l: navigator.language,
      v: innerWidth + 'x' + innerHeight,
      ut_s: utm.source, ut_m: utm.medium, ut_c: utm.campaign, ut_t: utm.term, ut_ct: utm.content
    };
  }
  window.psTrack = function (name, props) {
    try {
      var env = baseEnvelope();
      env.event_name = String(name);
      env.props = props && typeof props === 'object' ? props : {};
      send(EVENTS, env);
    } catch (e) {}
  };
  window.psTrack('page_view', { load_time_ms: loadTime, is_404: !!is404, page_num: pageCount, entry: pageCount === 1 });

  // ── Active engagement time (fix C): count only visible + focused ms ──
  var activeMs = 0;
  var activeSince = (document.visibilityState === 'visible' && document.hasFocus()) ? Date.now() : 0;
  var interactions = 0;
  function pauseTimer() { if (activeSince) { activeMs += Date.now() - activeSince; activeSince = 0; } }
  function resumeTimer() { if (!activeSince && document.visibilityState === 'visible' && document.hasFocus()) activeSince = Date.now(); }
  window.addEventListener('focus', resumeTimer);
  window.addEventListener('blur', pauseTimer);

  // ── Scroll depth + milestones (each once) ──
  var maxScroll = 0, ticking = false;
  var MILESTONES = [25, 50, 75, 90], fired = {};
  function onScroll() {
    var top = window.pageYOffset || document.documentElement.scrollTop;
    var docH = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight) - innerHeight;
    if (docH > 0) {
      var pct = Math.round((top / docH) * 100);
      if (pct > maxScroll) maxScroll = pct;
      MILESTONES.forEach(function (m) {
        if (!fired[m] && maxScroll >= m) { fired[m] = 1; window.psTrack('scroll_milestone', { depth: m }); }
      });
    }
    ticking = false;
  }
  window.addEventListener('scroll', function () {
    interactions++;
    if (!ticking) { ticking = true; requestAnimationFrame(onScroll); }
  }, { passive: true });
  ['click', 'keydown', 'pointerdown'].forEach(function (ev) {
    window.addEventListener(ev, function () { interactions++; }, { passive: true });
  });

  // ── Auto-instrument outbound + CTA + related links (content goals) ──
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a') : null;
    if (!a || !a.href) return;
    try {
      var u = new URL(a.href, location.href);
      if (a.hasAttribute('data-cta')) window.psTrack('cta_click', { cta_id: a.getAttribute('data-cta') || a.textContent.slice(0, 40) });
      else if (a.hasAttribute('data-related') || (a.closest && a.closest('[data-related],.related-articles,.related'))) window.psTrack('related_click', { to_path: u.pathname });
      else if (u.host !== location.host) window.psTrack('outbound_click', { href_domain: u.host.replace(/^www\./, '') });
    } catch (err) {}
  }, { passive: true });

  // ── Reliable flush (fix B+C) ──
  // Legacy exit beacon may fire on every hide (it UPDATEs the row with the
  // latest cumulative active time, so return-reads are captured); the versioned
  // engagement event is emitted once, at the terminal signal.
  var engagementSent = false;
  function flush(terminal) {
    pauseTimer();
    sessionStorage.setItem('_ps_seen', String(Date.now()));
    send(COLLECT, { t: 'exit', p: location.pathname, sid: sid, dur: Math.round(activeMs / 1000), scroll: maxScroll, active_ms: activeMs });
    if (terminal && !engagementSent) {
      engagementSent = true;
      window.psTrack('engagement', {
        active_ms: activeMs, max_scroll: maxScroll, interactions: interactions,
        engaged: (activeMs >= 90000 || maxScroll >= 75 || pageCount >= 2 || interactions > 3)
      });
    }
  }
  window.addEventListener('pagehide', function () { flush(true); });
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') flush(false); else resumeTimer();
  });
})();
