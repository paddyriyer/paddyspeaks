/**
 * JobSignal employer page.
 *
 * Every live role we can currently confirm at one employer, plus the hiring
 * activity we can evidence. Deliberately factual: counts and dates, no
 * editorial about the company, and no rating.
 */
(function () {
  'use strict';

  window.JSHeader.mount({});
  var __foot = document.getElementById('jsFooter');
  if (__foot) __foot.appendChild(window.JSHeader.footer());

  var el = window.JSDom.el;
  var F = window.JSFormat;
  var host = document.getElementById('js-company');
  var slug = new URLSearchParams(location.search).get('c') || '';

  function stat(value, label) {
    return el('div', { class: 'js-stat' }, [
      el('span', { class: 'stat-value', text: value }),
      el('span', { class: 'stat-label', text: label }),
    ]);
  }

  function notFound() {
    return el('div', { class: 'js-empty' }, [
      el('h2', { text: 'No live roles at this employer right now.' }),
      el('p', {
        text: 'Either we do not currently watch this employer, or their hiring system is not ' +
              'listing any open requisitions we can confirm. We would rather show you nothing ' +
              'than show you a role that is no longer there.',
      }),
      el('p', { style: 'margin-top:18px' }, [
        el('a', { class: 'js-view', href: '/jobs/search/', text: 'Search all live roles →' }),
      ]),
    ]);
  }

  Promise.all([window.JSData.index(), window.JSData.companies()]).then(function (res) {
    var jobs = (res[0].jobs || []).filter(function (j) { return j.company_slug === slug; });
    var company = (res[1].companies || []).filter(function (c) { return c.company_slug === slug; })[0];

    if (!jobs.length || !company) {
      window.JSDom.mount(host, notFound());
      return;
    }

    document.title = company.company_name + ' jobs | PaddySpeaks JobSignal';

    var verified = jobs.filter(function (j) { return j.status === 'live'; }).length;
    var reposted = jobs.filter(function (j) { return j.repost_count; }).length;
    var withSalary = jobs.filter(function (j) { return j.salary_min && j.salary_max; }).length;

    var sorted = window.JSSearch.run(jobs, { sort: 'verified' });

    var nodes = [
      el('header', { style: 'margin-top:26px' }, [
        el('p', { class: 'js-eyebrow', text: company.industry || 'Employer' }),
        el('h1', {
          style: 'font-family:var(--font-display);font-size:clamp(32px,5vw,50px);margin:8px 0 0;color:var(--color-ink)',
          text: company.company_name,
        }),
        el('p', { class: 'js-card-meta', style: 'margin-top:10px' }, [
          el('span', { text: company.company_domain }),
          el('span', { text: '·' }),
          el('span', { text: 'Sourced from ' + F.ats(company.ats_provider) }),
          company.company_size ? el('span', { text: '·' }) : null,
          company.company_size ? el('span', { text: company.company_size + ' employees' }) : null,
        ]),
      ]),

      el('section', { class: 'js-stats', style: 'margin-top:28px' }, [
        stat(F.num(jobs.length), 'Live roles'),
        stat(F.num(verified), 'Verified in last 6h'),
        stat(F.num(withSalary), 'Salary disclosed'),
        stat(F.num(reposted), 'Previously reposted'),
      ]),

      el('p', {
        class: 'js-note',
        text: 'First role observed at this employer on ' + F.day(company.first_seen_at) +
              '. Counts describe what we can confirm right now at their own hiring system — ' +
              'they are not a claim about everything this employer is hiring for.',
      }),
    ];

    var list = el('div', { class: 'js-results' });
    sorted.forEach(function (job) { list.appendChild(window.JSCard.build(job)); });
    nodes.push(el('h2', {
      style: 'font-family:var(--font-display);font-size:26px;margin:34px 0 0;color:var(--color-ink)',
      text: 'Open roles',
    }));
    nodes.push(list);

    window.JSDom.mount(host, nodes);
  }).catch(function () {
    window.JSDom.mount(host, notFound());
  });
})();
