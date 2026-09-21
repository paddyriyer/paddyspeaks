/**
 * JobSignal pipeline health.
 *
 * Renders jobs/data/health.json, which the ingestion run commits. Read-only by
 * construction: this is a static page over committed data, so it holds no
 * session, grants no privilege and cannot change anything. Source controls
 * (disable, re-verify, merge, block) need a Worker route and are Phase 2.
 */
(function () {
  'use strict';

  var el = window.JSDom.el;
  var F = window.JSFormat;
  var host = document.getElementById('js-health');

  function stat(value, label) {
    return el('div', { class: 'js-stat' }, [
      el('span', { class: 'stat-value', text: value }),
      el('span', { class: 'stat-label', text: label }),
    ]);
  }

  function table(sources) {
    var head = el('tr', {}, ['Employer', 'ATS', 'Status', 'Seen', 'Kept', 'Detail'].map(function (h) {
      return el('th', { text: h });
    }));
    var rows = sources.map(function (s) {
      return el('tr', {}, [
        el('td', { text: s.company_name }),
        el('td', { text: s.ats_provider }),
        el('td', { class: s.ok ? 'js-ok' : 'js-bad', text: s.ok ? 'ok' : 'failed' }),
        el('td', { text: String(s.postings_seen) }),
        el('td', { text: String(s.kept) }),
        el('td', { text: s.error || '—' }),
      ]);
    });
    return el('table', { class: 'js-table' }, [
      el('thead', {}, [head]),
      el('tbody', {}, rows),
    ]);
  }

  window.JSData.health().then(function (h) {
    if (!h.generated_at) {
      window.JSDom.mount(host, el('div', { class: 'js-empty' }, [
        el('h2', { text: 'No ingestion run has completed yet.' }),
        el('p', {
          text: 'This console fills in once the scheduled pipeline has run against the source ' +
                'registry. Until then there is genuinely nothing to report.',
        }),
      ]));
      return;
    }

    window.JSDom.mount(host, [
      el('section', { class: 'js-stats', style: 'margin-top:20px' }, [
        stat(F.num(h.sources_ok) + '/' + F.num(h.sources_total), 'Sources reached'),
        stat(F.num(h.postings_seen), 'Postings seen'),
        stat(F.num(h.jobs_published), 'Published live'),
        stat(F.num(h.jobs_closed_this_run), 'Closed this run'),
      ]),
      el('p', { class: 'js-note', text: 'Last run ' + F.day(h.generated_at) + ' (' + F.since(h.generated_at) + ').' }),
      el('section', { class: 'js-panel' }, [
        el('h2', { text: 'Per-source outcome' }),
        table(h.sources || []),
      ]),
      el('p', {
        class: 'js-foot', style: 'text-align:left',
        text: 'A failing source drops one employer and never breaks a run. Repeated failures mean a ' +
              'dead or renamed ATS slug in jobsignal/sources.json — fix it there, not here.',
      }),
    ]);
  }).catch(function () {
    window.JSDom.mount(host, el('div', { class: 'js-empty' }, [
      el('h2', { text: 'Health data could not be loaded.' }),
    ]));
  });
})();
