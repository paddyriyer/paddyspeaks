/**
 * PaddySpeaks — "Sources & Verification" panel (P0.2 / P0.3).
 *
 *   <script defer src="/lib/ps-sources.js" data-provenance="bhagavad-gita"></script>
 *
 * Renders a compact, COLLAPSED <details> panel just above the page footer from
 *   /data/provenance/<id>.json   (schema: docs/PROVENANCE.md)
 *   /data/corrections.json       (entries whose url or also[] matches this page)
 *
 * Without data-provenance it renders only when this page has a correction.
 *
 * Rules this component keeps:
 *   - It never claims more than the record says. "Verified" appears only when
 *     the record's status is verified; an unrecorded source is SAID to be
 *     unrecorded, not hidden.
 *   - Everything is built with DOM APIs and textContent. Record text is data,
 *     never HTML. Links are allowed only for http(s) and same-origin paths.
 *   - It fails silent: no network, no record → no panel, no console noise.
 */
(function () {
  'use strict';

  var script = document.currentScript;
  var id = script && script.getAttribute('data-provenance');

  var STATUS_LABEL = {
    'verified': 'Verified',
    'source-noted': 'Sources noted',
    'source-not-recorded': 'Source not recorded',
    'under-review': 'Under review'
  };
  var ROLE_LABEL = {
    text: 'Text', transliteration: 'Transliteration', translation: 'Translation',
    commentary: 'Commentary', reference: 'Reference', data: 'Data'
  };
  var KIND_LABEL = { primary: 'primary', secondary: 'secondary', reference: 'reference' };

  function ensureCss() {
    if (document.querySelector('link[href*="/lib/ps-platform.css"]')) return;
    var l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = '/lib/ps-platform.css';
    document.head.appendChild(l);
  }

  function el(tag, attrs, children) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (attrs[k] == null) return;
      if (k === 'text') n.textContent = attrs[k];
      else n.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) {
      if (c == null) return;
      n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return n;
  }

  function safeHref(u) {
    if (!u || typeof u !== 'string') return null;
    if (/^\/(?!\/)/.test(u)) return u;
    try {
      var p = new URL(u);
      return (p.protocol === 'https:' || p.protocol === 'http:') ? p.href : null;
    } catch (e) { return null; }
  }

  function link(label, url) {
    var h = safeHref(url);
    if (!h) return document.createTextNode(label);
    var a = el('a', { href: h, text: label });
    if (/^https?:/.test(h) && h.indexOf(location.origin) !== 0) {
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
    }
    return a;
  }

  function fmtDate(d) {
    if (!d) return '';
    var t = new Date(d + 'T12:00:00Z');
    if (isNaN(t)) return d;
    return t.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  }

  function norm(p) {
    return (p || '/').replace(/index\.html$/, '').replace(/\/+$/, '/') || '/';
  }

  function correctionsFor(all) {
    var here = norm(location.pathname);
    return (all || []).filter(function (c) {
      var urls = [c.url].concat(c.also || []);
      return urls.some(function (u) { return norm(u) === here; });
    });
  }

  function getJSON(url) {
    return fetch(url, { credentials: 'same-origin' }).then(function (r) {
      if (!r.ok) throw new Error(r.status);
      return r.json();
    });
  }

  function render(rec, corrections) {
    if (!rec && !corrections.length) return;
    ensureCss();

    var status = rec && rec.status;
    var summary = el('summary', null, [
      el('span', { text: rec ? 'Sources & Verification' : 'Corrections' })
    ]);
    if (status) {
      summary.appendChild(el('span', { class: 'ps-badge', 'data-status': status, text: STATUS_LABEL[status] || status }));
    }
    if (corrections.length) {
      summary.appendChild(el('span', {
        class: 'ps-badge', 'data-status': 'open',
        text: corrections.length + (corrections.length === 1 ? ' correction' : ' corrections')
      }));
    }

    var body = el('div', { class: 'ps-panel-body' });

    if (rec) {
      var dl = el('dl');
      function row(k, v) { if (v) { dl.appendChild(el('dt', { text: k })); dl.appendChild(el('dd', null, [v])); } }
      row('Work', rec.work && rec.work.title);
      row('Language', rec.work && rec.work.language);
      if (rec.attribution) {
        row('Composer', rec.attribution.composer);
        row('Traditional source', rec.attribution.traditionalLocation);
      }
      row('Page prepared by', rec.editor);
      if (rec.citation && rec.citation.scheme) {
        row('Cite as', rec.citation.example || (rec.title + ', ' + rec.citation.scheme.replace(/\./g, ' ') + ' N'));
      }
      row('Last reviewed', rec.lastReviewed ? fmtDate(rec.lastReviewed) : 'Not yet reviewed');
      body.appendChild(dl);

      if (rec.statusNote) body.appendChild(el('p', { class: 'ps-panel-note', text: rec.statusNote }));

      if (rec.sources && rec.sources.length) {
        body.appendChild(el('h3', { text: 'Sources' }));
        var ul = el('ul');
        rec.sources.forEach(function (s) {
          var li = el('li');
          li.appendChild(el('strong', { text: (ROLE_LABEL[s.role] || s.role) + ': ' }));
          li.appendChild(link(s.label, s.url));
          if (s.kind) li.appendChild(document.createTextNode(' (' + (KIND_LABEL[s.kind] || s.kind) + ')'));
          if (s.note) li.appendChild(el('div', { class: 'ps-panel-note', text: s.note }));
          ul.appendChild(li);
        });
        body.appendChild(ul);
      }

      if (rec.translation && rec.translation.note) {
        body.appendChild(el('h3', { text: 'Translation' }));
        body.appendChild(el('p', { text: rec.translation.by ? ('By ' + rec.translation.by + '. ' + rec.translation.note) : rec.translation.note }));
      }

      if (rec.verification && rec.verification.length) {
        body.appendChild(el('h3', { text: 'Checks' }));
        var vl = el('ul');
        rec.verification.forEach(function (v) {
          var li = el('li', { text: v.method });
          var meta = [v.runs, v.scope].filter(Boolean).join(' · ');
          if (meta) li.appendChild(el('div', { class: 'ps-panel-note', text: meta }));
          vl.appendChild(li);
        });
        body.appendChild(vl);
      }

      if (rec.knownIssues && rec.knownIssues.length) {
        body.appendChild(el('h3', { text: 'Known issues' }));
        var kl = el('ul');
        rec.knownIssues.forEach(function (k) {
          kl.appendChild(el('li', { text: (k.since ? fmtDate(k.since) + ' — ' : '') + k.summary }));
        });
        body.appendChild(kl);
      }

      if (rec.recordedText) {
        body.appendChild(el('h3', { text: 'As recorded in the source file' }));
        body.appendChild(el('p', { class: 'ps-panel-note', text: '“' + rec.recordedText + '”' }));
      }
    }

    if (corrections.length) {
      body.appendChild(el('h3', { text: 'Corrections' }));
      var cl = el('ul');
      corrections.forEach(function (c) {
        cl.appendChild(el('li', null, [
          el('strong', { text: fmtDate(c.date) + '. ' }),
          c.summary + (c.status === 'open' ? ' (Work continues.)' : '')
        ]));
      });
      body.appendChild(cl);
    }

    body.appendChild(el('p', { class: 'ps-panel-note' }, [
      'Spotted an error? ',
      link('Report it', '/corrections/#report'),
      ' · ',
      link('How sources are recorded', '/corrections/#provenance')
    ]));

    var panel = el('details', { class: 'ps-panel', id: 'sources-and-verification' }, [summary, body]);
    var footer = document.querySelector('body > footer, footer.site-footer, footer');
    if (footer && footer.parentNode) footer.parentNode.insertBefore(panel, footer);
    else (document.querySelector('main') || document.body).appendChild(panel);
    if (location.hash === '#sources-and-verification') panel.open = true;
  }

  function start() {
    var rec = id ? getJSON('/data/provenance/' + encodeURIComponent(id) + '.json').catch(function () { return null; }) : Promise.resolve(null);
    var cor = getJSON('/data/corrections.json').then(function (d) { return correctionsFor(d.corrections); }).catch(function () { return []; });
    Promise.all([rec, cor]).then(function (r) { render(r[0], r[1]); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
