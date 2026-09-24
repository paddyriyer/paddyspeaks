/**
 * PaddySpeaks — platform chrome (P0.5, P0.8, P1.5).
 *
 *   <script defer src="/lib/ps-platform.js"></script>
 *
 * Small, dependency-free, and additive: it never removes or restyles anything
 * a page already has. On any page that includes it, it
 *
 *   1. adds the site-information row (About · Contact · Follow · Changelog ·
 *      Corrections · Privacy · Terms · Disclaimer · Copyright) to the page's
 *      existing footer — or a minimal footer if the page has none;
 *   2. adds a "Skip to content" link when the page lacks one;
 *   3. records the visit for the local "Continue" module when the page opts in
 *      with <meta name="ps:continue" content="…">  (see lib/ps-state.js);
 *   4. on those same content pages, lazily loads "Explore further"
 *      (lib/ps-related.js) when the browser is idle.
 *
 * Nothing here talks to a server.
 */
(function () {
  'use strict';

  var LINKS = [
    ['/', 'PaddySpeaks home'],
    ['/about.html', 'About'],
    ['/contact/', 'Contact'],
    ['/subscribe/', 'Follow'],
    ['/changelog/', 'Changelog'],
    ['/corrections/', 'Corrections'],
    ['/privacy-policy/', 'Privacy'],
    ['/terms/', 'Terms'],
    ['/disclaimer/', 'Disclaimer'],
    ['/copyright/', 'Copyright']
  ];

  function ensureCss() {
    if (document.querySelector('link[href$="/lib/ps-platform.css"]')) return;
    var l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = '/lib/ps-platform.css';
    document.head.appendChild(l);
  }

  function legalRow() {
    var nav = document.createElement('nav');
    nav.className = 'ps-footer-legal';
    nav.setAttribute('aria-label', 'Site information');
    nav.setAttribute('data-ps-legal', '');
    LINKS.forEach(function (l) {
      var a = document.createElement('a');
      a.href = l[0];
      a.textContent = l[1];
      nav.appendChild(a);
    });
    return nav;
  }

  function addLegalFooter() {
    if (document.querySelector('[data-ps-legal]')) return;
    var footers = document.querySelectorAll('footer');
    // The page's own site footer is the last <footer> that is not inside an
    // <article> (article footers are bylines, not site chrome).
    var target = null;
    for (var i = footers.length - 1; i >= 0; i--) {
      if (!footers[i].closest('article')) { target = footers[i]; break; }
    }
    if (!target) {
      target = document.createElement('footer');
      target.className = 'ps-footer-min';
      document.body.appendChild(target);
    }
    var row = legalRow();
    target.appendChild(row);
    // Host footers often use faint text (3:1 on some pages). The row picks its
    // own text colour from the real background behind it so the links meet
    // WCAG AA on light and dark footers alike.
    var bg = effectiveBg(row);
    if (bg) row.setAttribute('data-tone', isDark(bg) ? 'dark' : 'light');
  }

  function effectiveBg(node) {
    for (var n = node; n && n.nodeType === 1; n = n.parentElement) {
      var cs = getComputedStyle(n);
      // A gradient or image behind the row: its colour cannot be measured, so
      // keep inheriting the footer's own text colour, chosen for that image.
      if (cs.backgroundImage && cs.backgroundImage !== 'none') return null;
      var c = cs.backgroundColor;
      var m = /rgba?\(([^)]+)\)/.exec(c || '');
      if (!m) continue;
      var v = m[1].split(',').map(parseFloat);
      if (v.length < 4 || v[3] > 0.5) return v;
    }
    return [255, 255, 255];
  }

  function isDark(rgb) {
    var l = rgb.slice(0, 3).map(function (x) { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); });
    return 0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2] < 0.18;
  }

  function addSkipLink() {
    if (document.querySelector('a.ps-skip-link, a.skip-link, a[href="#main-content"], a[href="#main"], a[href="#content"]')) return;
    // A page's main content: <main> where it exists, else the container the
    // older pages and the single-file demos use for it.
    var main = document.querySelector('main, [role="main"], #main, #content, .about-page, .page, #app, .app');
    if (!main) return;
    if (!main.id) main.id = 'main-content';
    if (!main.hasAttribute('tabindex')) main.setAttribute('tabindex', '-1');
    var a = document.createElement('a');
    a.className = 'ps-skip-link';
    a.href = '#' + main.id;
    a.textContent = 'Skip to content';
    document.body.insertBefore(a, document.body.firstChild);
  }

  function withState(fn) {
    if (window.PSState) return fn(window.PSState);
    var s = document.querySelector('script[src$="/lib/ps-state.js"]');
    if (!s) {
      s = document.createElement('script');
      s.src = '/lib/ps-state.js';
      document.head.appendChild(s);
    }
    s.addEventListener('load', function () { if (window.PSState) fn(window.PSState); });
  }

  function recordContinue() {
    var meta = document.querySelector('meta[name="ps:continue"]');
    if (!meta) return;
    withState(function () {
      record(meta);
      // Apps that navigate by hash (the Gita's #chapter-2-sloka-47, Lalitha's
      // #name-551) update the entry as the reader moves, so "Continue" lands
      // where they actually stopped.
      if (meta.hasAttribute('data-keep-hash')) window.addEventListener('hashchange', function () { record(meta); });
    });
  }

  function hashLabel(h) {
    var m = /chapter-(\d+)(?:-sloka-(\d+))?/.exec(h || '');
    if (m) return 'Chapter ' + m[1] + (m[2] ? ', verse ' + m[2] : '');
    m = /name-(\d+)/.exec(h || '');
    if (m) return 'Name ' + m[1];
    m = /(?:dashaka|verse)-(\d+)/.exec(h || '');
    return m ? 'Section ' + m[1] : '';
  }

  function record(meta) {
    try {
      var keep = meta.hasAttribute('data-keep-hash');
      window.PSState.recordVisit({
        kind: meta.getAttribute('content') || 'page',
        title: meta.getAttribute('data-title') || document.title.replace(/\s*[|—–·-]\s*(PaddySpeaks|Interview Studio).*$/, '').replace(/\s+[—–-]\s+.*$/, ''),
        url: location.pathname + (keep ? location.hash : ''),
        label: meta.getAttribute('data-label') || (keep ? hashLabel(location.hash) : '')
      });
    } catch (e) { /* storage unavailable: nothing to do */ }
  }

  // "Explore further" (lib/ps-related.js) on content pages only, loaded when
  // the browser is idle so it never competes with the page itself.
  function loadRelated() {
    if (!document.querySelector('meta[name="ps:continue"]') || document.querySelector('script[src$="/lib/ps-related.js"]')) return;
    var go = function () {
      var s = document.createElement('script');
      s.src = '/lib/ps-related.js';
      s.defer = true;
      document.head.appendChild(s);
    };
    if ('requestIdleCallback' in window) window.requestIdleCallback(go, { timeout: 3000 });
    else setTimeout(go, 1200);
  }

  function start() {
    ensureCss();
    addLegalFooter();
    addSkipLink();
    recordContinue();
    loadRelated();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
