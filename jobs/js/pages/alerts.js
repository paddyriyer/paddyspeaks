/**
 * JobSignal alerts page.
 *
 * Each alert is a saved search evaluated against the index on load. "New since
 * you last looked" is measured against first_seen_at — the field the pipeline
 * guarantees is never rewritten — so a role republished under a new requisition
 * does not resurface as new.
 */
(function () {
  'use strict';

  window.JSHeader.mount({});
  var __foot = document.getElementById('jsFooter');
  if (__foot) __foot.appendChild(window.JSHeader.footer());

  var el = window.JSDom.el;
  var A = window.JSAlerts;
  var host = document.getElementById('js-alerts');
  var form = document.getElementById('js-alert-form');
  var allJobs = [];

  function readForm() {
    function val(id) {
      var node = document.getElementById(id);
      return node ? node.value.trim() : '';
    }
    function checked(id) {
      var node = document.getElementById(id);
      return !!(node && node.checked);
    }
    var f = {};
    ['q', 'location', 'level', 'remote'].forEach(function (k) {
      var v = val('a-' + k);
      if (v) f[k] = v;
    });
    ['verified6h', 'salaryOnly', 'visa', 'hideReposted', 'directOnly'].forEach(function (k) {
      if (checked('a-' + k)) f[k] = true;
    });
    return f;
  }

  function describe(filters) {
    var bits = [];
    if (filters.q) bits.push('“' + filters.q + '”');
    if (filters.location) bits.push('in ' + filters.location);
    if (filters.remote) bits.push(window.JSFormat.remote(filters.remote));
    if (filters.level) bits.push(window.JSFormat.level(filters.level));
    if (filters.verified6h) bits.push('verified in last 6h');
    if (filters.salaryOnly) bits.push('salary disclosed');
    if (filters.visa) bits.push('visa mentioned');
    if (filters.hideReposted) bits.push('never reposted');
    if (filters.directOnly) bits.push('direct applications');
    return bits.length ? bits.join(' · ') : 'every live role';
  }

  function searchHref(filters) {
    return '/jobs/search/?' + window.JSQuery.write(filters);
  }

  function alertCard(alert) {
    var result = A.evaluate(alert, allJobs);
    var body = [];

    body.push(el('div', { class: 'js-card-top' }, [
      el('div', {}, [
        el('h3', {}, [el('a', { href: searchHref(alert.filters), text: alert.name })]),
        el('p', { class: 'js-card-co', text: describe(alert.filters) }),
      ]),
      el('span', {
        class: 'js-badge', 'data-status': result.fresh.length ? 'live' : 'unverified',
      }, [
        el('span', { class: 'js-dot', 'aria-hidden': 'true' }),
        el('span', {
          text: result.fresh.length
            ? result.fresh.length + ' new since you last looked'
            : 'nothing new',
        }),
      ]),
    ]));

    body.push(el('p', {
      class: 'js-card-dates',
      text: result.matches.length + ' matching live ' + (result.matches.length === 1 ? 'role' : 'roles') +
            '  ·  last checked ' + window.JSFormat.since(alert.last_checked_at),
    }));

    if (result.fresh.length) {
      var preview = el('div', { class: 'js-results', style: 'margin-top:14px' });
      result.fresh.slice(0, 3).forEach(function (j) { preview.appendChild(window.JSCard.build(j)); });
      body.push(preview);
    }

    var openBtn = el('a', { class: 'js-view', href: searchHref(alert.filters), text: 'Open as a search →' });
    var seenBtn = el('button', { class: 'js-btn js-btn-ghost js-btn-sm', type: 'button', text: 'Mark as seen' });
    seenBtn.addEventListener('click', function () { A.markChecked(alert.id); render(); });
    var delBtn = el('button', { class: 'js-btn js-btn-ghost js-btn-sm', type: 'button', text: 'Delete' });
    delBtn.addEventListener('click', function () { A.remove(alert.id); render(); });

    body.push(el('div', { class: 'js-card-actions' }, [openBtn, seenBtn, delBtn]));

    return el('article', { class: 'js-card', 'data-status': result.fresh.length ? 'live' : 'recent' }, body);
  }

  function render() {
    var alerts = A.all();
    if (!alerts.length) {
      window.JSDom.mount(host, el('div', { class: 'js-empty', style: 'margin-top:26px' }, [
        el('h2', { text: 'No alerts yet.' }),
        el('p', {
          text: 'Describe the role you actually want above. Next time you open this page, JobSignal ' +
                'will tell you which matching roles it has seen for the first time since you last ' +
                'looked — not which ones were re-dated.',
        }),
      ]));
      return;
    }
    var wrap = el('div', {}, [
      el('h2', {
        style: 'font-family:var(--font-display);font-size:26px;margin:34px 0 0;color:var(--color-ink)',
        text: 'Your alerts',
      }),
      el('div', { class: 'js-results' }, alerts.map(alertCard)),
      el('p', {
        class: 'js-foot', style: 'text-align:left',
        text: 'Alerts are stored in this browser. Email delivery is not built yet — when it is, ' +
              'it will be opt-in and will use the same mail path as the contact form.',
      }),
    ]);
    window.JSDom.mount(host, wrap);
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var name = document.getElementById('a-name').value.trim();
    if (!name) return;
    A.add(name, readForm());
    form.reset();
    render();
  });

  window.JSData.index().then(function (doc) {
    allJobs = doc.jobs || [];
    render();
  }).catch(render);
})();
