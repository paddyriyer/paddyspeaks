/* Interview Intelligence teaser on the Interview Studio home page.
 * Reads the same published data as /interview.app/reported/ and shows the
 * live count and the latest reported questions. Every number comes from the
 * data; with no data (or no JavaScript) the band still reads correctly.
 * Text is set with textContent only.
 */
(function () {
  'use strict';
  var box = document.getElementById('ii-latest');
  var count = document.getElementById('ii-count');
  if (!box) return;

  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    for (var k in (attrs || {})) {
      if (attrs[k] == null) continue;
      if (k === 'text') n.textContent = attrs[k];
      else if (k === 'cls') n.className = attrs[k];
      else n.setAttribute(k, attrs[k]);
    }
    (kids || []).forEach(function (c) { if (c) n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return n;
  }

  fetch('/interview.app/reported/data/questions.json?t=' + Math.floor(Date.now() / 60000), { cache: 'no-cache' })
    .then(function (r) { return r.ok ? r.json() : { questions: [] }; })
    .then(function (doc) {
      var qs = (doc.questions || []).slice();
      if (!qs.length) return;
      var companies = {};
      qs.forEach(function (q) { (q.companies_reported || []).forEach(function (c) { companies[c.slug] = 1; }); });
      var nCo = Object.keys(companies).length;
      var nPrep = qs.filter(function (q) { return q.prep && (q.prep.hints || []).length && q.prep.sample_solution; }).length;
      count.textContent = qs.length + ' reported question' + (qs.length === 1 ? '' : 's') +
        (nCo ? ' · ' + nCo + ' compan' + (nCo === 1 ? 'y' : 'ies') + ' named' : '') +
        (nPrep === qs.length ? ' · every one with hints and a worked solution'
          : nPrep ? ' · ' + nPrep + ' with hints and a worked solution' : '');
      qs.sort(function (a, b) { return (b.last_seen || '').localeCompare(a.last_seen || '') || (b.source_count - a.source_count); });
      while (box.firstChild) box.removeChild(box.firstChild);
      qs.slice(0, 3).forEach(function (q) {
        var who = (q.companies_reported || []).map(function (c) { return c.name; }).join(', ');
        box.appendChild(el('li', null, [
          el('a', { href: '/interview.app/reported/?id=' + encodeURIComponent(q.id) }, [
            el('span', { cls: 'ii-q-title', text: q.title }),
            el('span', { cls: 'ii-q-meta', text: [q.question_type === 'reported' ? 'Reported in an interview' : 'From a public list',
              who, q.difficulty].filter(Boolean).join(' · ') })
          ])
        ]));
      });
    })
    .catch(function () { /* the static band still works without data */ });
})();
