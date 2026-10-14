/* Company Interview Loops band on the Interview Studio home page.
 * Lists the companies that are available now, read from the same generated
 * index the module uses, so a company appears here the day its loops ship.
 * Every number comes from the data; with no data (or no JavaScript) the
 * static list in the page still reads correctly. Text is set with
 * textContent only.
 */
(function () {
  'use strict';
  var box = document.getElementById('cl-cos');
  var more = document.getElementById('cl-more');
  if (!box) return;
  var BASE = '/interview.app/company-loops/';

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  fetch(BASE + 'data/index.json', { cache: 'no-cache' })
    .then(function (r) { return r.ok ? r.json() : { companies: [] }; })
    .then(function (doc) {
      var all = doc.companies || [];
      var live = all.filter(function (c) { return c.status === 'available'; });
      if (!live.length) return;
      while (box.firstChild) box.removeChild(box.firstChild);
      live.forEach(function (c) {
        var counts = c.loop_counts || {};
        var n = Object.keys(counts).reduce(function (s, k) { return s + (counts[k] || 0); }, 0);
        var a = el('a');
        a.href = BASE + '#/company/' + encodeURIComponent(c.id);
        a.appendChild(el('span', 'cl-co-name', c.name));
        a.appendChild(el('span', 'cl-co-meta', [c.category, n ? n + ' question templates' : ''].filter(Boolean).join(' · ')));
        var li = el('li');
        li.appendChild(a);
        box.appendChild(li);
      });
      var planned = all.length - live.length;
      if (more && planned > 0) more.textContent = planned + ' more compan' + (planned === 1 ? 'y' : 'ies') + ' planned, added in batches.';
    })
    .catch(function () { /* the static list still works without data */ });
})();
