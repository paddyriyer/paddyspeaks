/**
 * JobSignal home — search is the product.
 *
 * No statistics band, no trust bar, no marketing copy. The counts beside the
 * popular roles are real, computed from the index the page already loads.
 */
(function () {
  'use strict';
  var el = window.JSDom.el, icon = window.JSIcon;

  window.JSHeader.mount({});
  document.getElementById('jsFooter').appendChild(window.JSHeader.footer());

  var QUICK = [
    ['Fresh 72', { fresh72: '1' }, 'bolt'],
    ['Remote', { remote: 'remote' }],
    ['Entry level', { level: 'entry' }],
    ['$150K+', { minSalary: '150000' }],
    ['Visa sponsorship', { visa: '1' }],
    ['Direct apply', { directOnly: '1' }]
  ];

  var POPULAR = [
    ['Product Manager', 'product manager'], ['Data Engineer', 'data engineer'],
    ['UX Designer', 'ux designer'], ['Data Scientist', 'data scientist'],
    ['Cybersecurity', 'cybersecurity'], ['AI Engineer', 'ai engineer'],
    ['Software Engineer', 'software engineer'], ['SRE', 'site reliability']
  ];

  function href(params) {
    var p = new URLSearchParams(params);
    return '/jobs/search/?' + p.toString();
  }

  var host = document.getElementById('jsHomeSearch');
  host.appendChild(window.JSSearchBar.build({ id: 'jsHomeQ' }));

  var quick = document.getElementById('jsHomeQuick');
  quick.appendChild(el('div', { class: 'jsChips' }, QUICK.map(function (q) {
    var kids = [];
    if (q[2]) kids.push(icon(q[2], 13));
    kids.push(el('span', { text: q[0] }));
    var a = el('a', { class: 'jsChip', href: href(q[1]) }, kids);
    if (q[2]) a.classList.add('is-on');
    return a;
  })));

  window.JSData.index().then(function (doc) {
    var jobs = doc.jobs || [];
    var bar = host.querySelector('.jsSearch');
    if (bar && jobs.length) {
      // Rebuild with a suggester now that we know what is actually on the board.
      var withSuggest = window.JSSearchBar.build({
        id: 'jsHomeQ', suggest: window.JSSearchBar.suggester(jobs)
      });
      host.replaceChild(withSuggest, bar);
    }

    var pop = document.getElementById('jsHomePopular');
    window.JSDom.clear(pop);
    if (!jobs.length) {
      pop.appendChild(window.JSStates ? window.JSStates.boardEmpty() : el('p', { text: 'The board is still filling.' }));
      return;
    }

    var counts = {};
    POPULAR.forEach(function (p) {
      counts[p[0]] = window.JSSearch.run(jobs.map(function (j) { return j; }), { q: p[1] }).length;
    });

    pop.appendChild(el('div', {
      style: 'font-size:12.5px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--ink-3)',
      text: 'Popular'
    }));
    pop.appendChild(el('div', { class: 'jsChips', style: 'margin-top:12px' },
      POPULAR.filter(function (p) { return counts[p[0]] > 0; }).map(function (p) {
        return el('a', { class: 'jsChip', href: href({ q: p[1] }) }, [
          el('span', { text: p[0] }),
          el('span', { style: 'color:var(--ink-3);font-variant-numeric:tabular-nums', text: String(counts[p[0]]) })
        ]);
      })));

    pop.appendChild(el('p', {
      style: 'margin:26px 0 0;font-size:13.5px;color:var(--ink-3);line-height:1.6',
      text: 'Verified directly against employer hiring systems. ' +
            jobs.length.toLocaleString('en-US') + ' roles on the board, last refreshed ' +
            window.JSFormat.since(doc.generated_at) + '.'
    }));
  }).catch(function () {
    var pop = document.getElementById('jsHomePopular');
    window.JSDom.mount(pop, el('p', { style: 'color:var(--ink-3);font-size:14px', text: 'Role counts are unavailable right now.' }));
  });
})();
