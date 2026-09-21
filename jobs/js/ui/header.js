/**
 * JobSignal — the product header.
 *
 * Replaces the site's article chrome on /jobs. That chrome measured 500px
 * before any content on both breakpoints, and pushed the first job card to
 * y=1579 on a 390px phone. This is 64px desktop, 56px mobile, sticky, and it
 * carries the search box on results pages so the query stays editable.
 *
 * The journal nav (Philosophy, Sacred Texts, Testimonials…) is deliberately
 * absent: it belongs to the website, not inside a job search.
 */
(function (global) {
  'use strict';
  var el = global.JSDom.el, icon = global.JSIcon;

  var LINKS = [
    ['/jobs/saved/', 'Saved'],
    ['/jobs/alerts/', 'Alerts'],
    ['/jobs/saved/?stage=applied', 'Applications']
  ];

  function brand() {
    return el('a', { class: 'jsHeader-brand', href: '/', 'aria-label': 'PaddySpeaks home' }, [
      el('span', { class: 'ps', text: 'PaddySpeaks' }),
      el('span', { class: 'sep', 'aria-hidden': 'true', text: '/' }),
      el('span', { class: 'pn', text: 'JobSignal' })
    ]);
  }

  /** @param opts {searchNode, current} */
  function mount(opts) {
    var o = opts || {};
    var nav = el('nav', { class: 'jsHeader-nav', id: 'jsHeaderNav', 'aria-label': 'JobSignal' },
      LINKS.map(function (l) {
        var a = el('a', { href: l[0], text: l[1] });
        if (o.current === l[1]) a.setAttribute('aria-current', 'page');
        return a;
      }));

    var menu = el('button', {
      class: 'jsHeader-menu', type: 'button',
      'aria-label': 'Menu', 'aria-expanded': 'false', 'aria-controls': 'jsHeaderNav'
    }, [icon('menu', 21)]);
    menu.addEventListener('click', function () {
      var open = nav.classList.toggle('is-open');
      menu.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('is-open')) {
        nav.classList.remove('is-open');
        menu.setAttribute('aria-expanded', 'false');
        menu.focus();
      }
    });

    var kids = [brand()];
    if (o.searchNode) kids.push(o.searchNode);
    kids.push(el('div', { class: 'jsHeader-spacer' }));
    kids.push(nav);
    kids.push(menu);

    var header = el('header', { class: 'jsHeader' }, kids);
    var skip = el('a', { class: 'js-skip', href: '#jsMain', text: 'Skip to results' });
    document.body.insertBefore(header, document.body.firstChild);
    document.body.insertBefore(skip, header);
    return header;
  }

  function footer() {
    return el('footer', { class: 'jsFoot' }, [
      el('div', { class: 'jsWrap' }, [
        el('div', { class: 'jsFoot-in' }, [
          el('a', { href: '/jobs/', text: 'JobSignal' }),
          el('a', { href: '/jobs/methodology/', text: 'How verification works' }),
          el('a', { href: '/', text: 'PaddySpeaks' }),
          el('a', { href: '/contact/', text: 'Contact' })
        ]),
        el('p', {
          class: 'jsFoot-note',
          text: 'No employer can pay to appear here, rank higher, look fresher, or hide a repost. ' +
                'Saved jobs and alerts stay in this browser — there is no account.'
        })
      ])
    ]);
  }

  global.JSHeader = { mount: mount, footer: footer };
})(window);
