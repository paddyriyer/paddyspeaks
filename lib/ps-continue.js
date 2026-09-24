/**
 * PaddySpeaks — "Continue where you left off" (P1.5).
 *
 *   <section id="ps-continue" hidden></section>
 *   <script defer src="/lib/ps-state.js"></script>
 *   <script defer src="/lib/ps-continue.js"></script>
 *
 * Built only from this browser's own storage, via lib/ps-state.js:
 *   - the last pages opened on opted-in pages (sacred texts, articles,
 *     Interview Studio, demos) — recorded by lib/ps-platform.js
 *   - saved JobSignal roles (jsig_pipeline_v1)
 *   - an Interview Studio question set in progress (qb.set.v1)
 *
 * Nothing is sent anywhere. The section stays hidden until there is something
 * to continue, and "Clear history" forgets the visit history in one click
 * (saved jobs and question sets are the products' own data, cleared from
 * /privacy-policy/#browser).
 */
(function () {
  'use strict';

  var KIND_LABEL = { sacred: 'Sacred text', article: 'Essay', interview: 'Interview Studio', demo: 'Demo', page: 'Page' };

  function el(tag, attrs, text) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    if (text != null) n.textContent = text;
    return n;
  }

  function ago(iso) {
    var d = (Date.now() - Date.parse(iso)) / 864e5;
    if (!(d >= 0)) return '';
    if (d < 1) return 'today';
    if (d < 2) return 'yesterday';
    if (d < 14) return Math.floor(d) + ' days ago';
    return Math.floor(d / 7) + ' weeks ago';
  }

  function render(host) {
    var S = window.PSState;
    if (!S) return;
    var here = location.pathname;
    var items = [];

    S.recent().filter(function (r) { return r.url.split('#')[0] !== here; }).slice(0, 4).forEach(function (r) {
      var verb = r.kind === 'sacred' ? 'Continue ' : r.kind === 'interview' ? 'Resume ' : r.kind === 'article' ? 'Continue reading ' : 'Back to ';
      items.push({ href: r.url, text: verb + (r.title || 'where you were'), note: [KIND_LABEL[r.kind] || '', r.label, ago(r.at)].filter(Boolean).join(' · ') });
    });

    var sum = S.summary();
    if (sum.savedJobs) items.push({ href: '/jobs/saved/', text: 'Review ' + sum.savedJobs + ' saved ' + (sum.savedJobs === 1 ? 'job' : 'jobs'), note: 'JobSignal · in this browser' });
    if (sum.pickedQuestions) items.push({ href: '/interview.app/', text: 'Your question set: ' + sum.pickedQuestions + ' picked', note: 'Interview Studio · in this browser' });

    if (!items.length) { host.hidden = true; return; }

    host.textContent = '';
    var inner = el('div', { class: 'ps-continue-inner' });
    var head = el('div', { class: 'ps-continue-head' });
    head.appendChild(el('h2', { id: 'ps-continue-h' }, 'Continue where you left off'));
    var clear = el('button', { type: 'button', class: 'ps-linklike' }, 'Clear history');
    clear.setAttribute('aria-label', 'Clear your recently viewed history on this site');
    clear.addEventListener('click', function () {
      S.clearRecent();
      render(host);
      var s = el('p', { class: 'ps-sr-only', role: 'status' }, 'History cleared.');
      document.body.appendChild(s);
      setTimeout(function () { s.remove(); }, 3000);
    });
    head.appendChild(clear);
    inner.appendChild(head);
    var ul = el('ul');
    items.slice(0, 5).forEach(function (it) {
      var li = el('li');
      var a = el('a', { href: /^\/(?!\/)/.test(it.href) ? it.href : '/' }, it.text);
      li.appendChild(a);
      if (it.note) li.appendChild(el('small', null, it.note));
      ul.appendChild(li);
    });
    inner.appendChild(ul);
    inner.appendChild(el('p', { class: 'ps-panel-note', style: 'margin:8px 0 0;font-size:12px' }, 'Only in this browser — never sent anywhere.'));
    host.appendChild(inner);
    host.hidden = false;
  }

  function start() {
    var host = document.getElementById('ps-continue');
    if (!host) return;
    if (window.PSState) render(host);
    else {
      var s = document.querySelector('script[src$="/lib/ps-state.js"]');
      if (s) s.addEventListener('load', function () { render(host); });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
