/**
 * PaddySpeaks — "Explore further" (P2.2).
 *
 * Loaded by lib/ps-platform.js on content pages (those with
 * <meta name="ps:continue">). Reads this page's entry from
 * /data/related/<section>.json — built by scripts/platform_build/graph.py from
 * curated concepts, real content links, article series and shared explicit
 * tags — and renders up to eight connections, each saying WHY it is shown.
 *
 * No entry, no section: nothing arbitrary is ever filled in. Everything is
 * built with DOM APIs and textContent; links must be site-relative.
 */
(function () {
  'use strict';

  var TYPE_LABEL = {
    article: 'Essay', sacred: 'Sacred text', verse: 'Verse', name: 'Divine name', music: 'Devotional music',
    topic: 'Interview prep', question: 'Question', company: 'Company', demo: 'Demo', tool: 'Tool',
    page: 'Page', concept: 'Concept'
  };

  function el(tag, attrs, text) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    if (text != null) n.textContent = text;
    return n;
  }

  function here() {
    var p = location.pathname.replace(/index\.html$/, '');
    return p;
  }

  function shardFor(p) {
    if (p.indexOf('/articles/') === 0) return 'articles';
    if (p.indexOf('/interview.app/') === 0) return 'interview';
    return 'site';
  }

  function render(items) {
    if (!items || !items.length) return;
    var aside = el('aside', { class: 'ps-related', 'aria-labelledby': 'ps-related-h' });
    aside.appendChild(el('h2', { id: 'ps-related-h', class: 'ps-related-h' }, 'Explore further'));
    var ul = el('ul', { class: 'ps-related-list' });
    items.forEach(function (it) {
      if (!/^\/(?!\/)/.test(it.url || '')) return;
      var li = el('li');
      var a = el('a', { href: it.url, 'data-related': '' });
      a.appendChild(el('span', { class: 'ps-badge', 'data-type': it.type }, TYPE_LABEL[it.type] || it.type));
      a.appendChild(el('span', { class: 'ps-related-title' }, it.title));
      li.appendChild(a);
      if (it.why) li.appendChild(el('span', { class: 'ps-related-why' }, it.why));
      ul.appendChild(li);
    });
    aside.appendChild(ul);
    var concept = items.filter(function (i) { return i.type === 'concept'; })[0];
    var more = el('p', { class: 'ps-related-more' });
    var link = el('a', { href: concept ? concept.url : '/atlas/' }, concept ? 'See everything connected to “' + concept.title + '” in the Atlas →' : 'Explore the Atlas →');
    more.appendChild(link);
    aside.appendChild(more);

    // Place it after the page's content, before any legacy "You Might Also
    // Enjoy" block, the Sources panel, or the footer — whichever comes first.
    var anchor = document.querySelector('.related-articles, #sources-and-verification, body > footer, footer.site-footer');
    if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(aside, anchor);
    else (document.querySelector('main') || document.body).appendChild(aside);
  }

  function start() {
    var p = here();
    fetch('/data/related/' + shardFor(p) + '.json', { credentials: 'same-origin' })
      .then(function (r) { return r.ok ? r.json() : {}; })
      .then(function (m) { render(m[p] || m[p.replace(/\/$/, '/index.html')]); })
      .catch(function () { /* no data: no section */ });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
