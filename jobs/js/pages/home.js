/**
 * JobSignal home — live counters and the honest empty state.
 *
 * Every number on this page is read from jobs/data/stats.json, which the
 * ingestion pipeline computes by counting the board. Nothing here is written by
 * hand, and a test fails the build if a numeric statistic is ever hardcoded
 * into the markup.
 */
(function () {
  'use strict';

  var el = window.JSDom.el;
  var F = window.JSFormat;

  function stat(value, label) {
    return el('div', { class: 'js-stat' }, [
      el('span', { class: 'stat-value', text: value }),
      el('span', { class: 'stat-label', text: label }),
    ]);
  }

  function emptyState() {
    return el('div', { class: 'js-empty' }, [
      el('h2', { text: 'The board is still filling.' }),
      el('p', {
        text: 'No roles have been ingested yet. JobSignal will not show you a job it cannot ' +
              'currently reach at the employer, so rather than pad this page with samples, it ' +
              'shows you nothing until the first run completes.',
      }),
      el('p', {
        text: 'Ingestion runs every four hours against employers’ own applicant tracking ' +
              'systems. Check back shortly.',
      }),
      el('p', { style: 'margin-top:18px' }, [
        el('a', { class: 'js-view', href: '/jobs/methodology/', text: 'How verification works →' }),
      ]),
    ]);
  }

  function render(s) {
    var host = document.getElementById('js-stats');
    var live = s.live_jobs || 0;

    if (!live) {
      host.parentNode.removeChild(host);
      document.getElementById('js-home-empty').appendChild(emptyState());
      return;
    }

    window.JSDom.mount(host, [
      stat(F.num(live), 'Live jobs'),
      stat(F.num(s.verified_today || 0), 'Verified today'),
      stat(F.num(s.added_last_24h || 0), 'Added in last 24h'),
      stat(F.num(s.employers || 0), 'Employers watched'),
      stat(F.num(s.salary_disclosed || 0), 'Salary disclosed'),
    ]);

    var when = s.generated_at
      ? el('p', {
          class: 'js-count',
          style: 'width:100%;text-align:center;margin-top:6px',
          text: 'Last ingestion run ' + F.since(s.generated_at),
        })
      : null;
    if (when) host.appendChild(when);
  }

  window.JSData.stats().then(render).catch(function () {
    var loading = document.getElementById('js-stats-loading');
    if (loading) loading.textContent = 'Live counts are unavailable right now.';
  });

  // Carry a location typed here straight into the search page's filter state.
  var form = document.getElementById('js-home-form');
  if (form) {
    form.addEventListener('submit', function () {
      ['js-q', 'js-loc'].forEach(function (id) {
        var input = document.getElementById(id);
        if (input && !input.value.trim()) input.disabled = true;  // keeps the URL clean
      });
    });
  }
})();
