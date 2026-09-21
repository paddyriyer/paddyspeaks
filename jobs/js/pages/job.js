/**
 * JobSignal job detail — two columns.
 *
 * Left reads; right keeps Apply, verification and the dates in view while you
 * scroll. The trust evidence is a panel, not a banner above the job title.
 */
(function () {
  'use strict';
  var el = window.JSDom.el, icon = window.JSIcon, F = window.JSFormat;
  var host = document.getElementById('jsJob');
  var id = new URLSearchParams(location.search).get('id') || '';

  window.JSHeader.mount({});
  document.getElementById('jsFooter').appendChild(window.JSHeader.footer());

  function kv(pairs) {
    var dl = el('dl', { class: 'jsPop-kv', style: 'font-size:13.5px;gap:9px 16px' });
    pairs.forEach(function (p) {
      if (!p || p[1] === '' || p[1] == null) return;
      dl.appendChild(el('dt', { text: p[0] }));
      dl.appendChild(el('dd', {}, [typeof p[1] === 'string' ? document.createTextNode(p[1]) : p[1]]));
    });
    return dl;
  }

  function aside(job) {
    var saved = window.JSTracker.stageOf(job.id);
    var save = el('button', {
      class: 'jsBtn jsBtn--ghost jsBtn--block', type: 'button',
      'aria-pressed': saved ? 'true' : 'false', style: 'margin-top:9px'
    }, [icon('heart', 16, { weight: 1.9 }), el('span', { text: saved ? 'Saved' : 'Save job' })]);
    save.addEventListener('click', function () {
      var on = save.getAttribute('aria-pressed') === 'true';
      window.JSTracker.set(job.id, on ? '' : 'saved', job);
      save.setAttribute('aria-pressed', on ? 'false' : 'true');
      window.JSDom.clear(save);
      save.appendChild(icon('heart', 16, { weight: 1.9 }));
      save.appendChild(el('span', { text: on ? 'Save job' : 'Saved' }));
    });

    var verifyCls = 'jsVerify' + (job.status === 'recent' ? ' is-stale' : job.status === 'unverified' ? ' is-unverified' : '');

    return el('aside', { class: 'jsAside' }, [
      el('div', { class: 'jsPanel', style: 'margin-top:0' }, [
        el('div', { class: verifyCls, style: 'font-size:13.5px' }, [
          el('span', { class: 'dot', 'aria-hidden': 'true' }),
          el('span', { text: job.status === 'live' ? 'Verified ' + F.since(job.last_verified_at)
                          : job.status === 'recent' ? 'Last verified ' + F.since(job.last_verified_at)
                          : 'Not verified' })
        ]),
        el('a', {
          class: 'jsBtn jsBtn--primary jsBtn--block', style: 'margin-top:13px',
          href: job.apply_url, target: '_blank', rel: 'noopener nofollow',
          title: 'Direct employer application'
        }, [el('span', { text: 'Apply at ' + F.companyShort(job) }), icon('external', 15, { weight: 2.2 })]),
        save,
        el('div', { style: 'margin-top:18px;padding-top:16px;border-top:1px solid var(--line-soft)' }, [
          kv([
            ['Employer posted', job.posted_at_original ? F.day(job.posted_at_original) : 'not published'],
            ['First observed', F.day(job.first_seen_at)],
            ['Age', F.ageText(job.age_days)],
            ['Source', F.ats(job.ats_provider)],
            ['Requisition', job.requisition_id || 'not published'],
            ['Reposts', job.repost_count ? job.repost_count + ' previous' : 'none detected']
          ])
        ]),
        el('a', { href: '/jobs/methodology/', style: 'display:inline-block;margin-top:14px;font-size:13px;font-weight:500', text: 'How verification works →' })
      ])
    ]);
  }

  function signals(job) {
    if (!(job.confidence_signals || []).length) return null;
    return el('section', { class: 'jsPanel' }, [
      el('h2', { text: 'What we checked' }),
      el('ul', { class: 'jsSignals' }, job.confidence_signals.map(function (s) {
        return el('li', { 'data-kind': s.kind }, [
          el('span', { class: 'mk', 'aria-hidden': 'true' }, [icon(s.kind === 'plus' ? 'check' : 'warn', 14, { weight: 2.6 })]),
          el('span', { text: s.text })
        ]);
      })),
      el('p', {
        style: 'margin:15px 0 0;font-size:13px;color:var(--ink-3);line-height:1.6',
        text: 'Observations, not accusations. JobSignal does not know why an employer posts what it posts — it reports what it checked and when.'
      })
    ]);
  }

  function history(job) {
    var spells = (job.lineage_spells || []).slice().sort(function (a, b) {
      return String(a.opened_at).localeCompare(String(b.opened_at));
    });
    if (spells.length < 2 && !job.repost_count) return null;
    return el('section', { class: 'jsPanel' }, [
      el('h2', { text: 'Posting history' }),
      job.repost_count ? el('p', { class: 'jsCard-note', style: 'margin:0 0 14px' }, [
        icon('warn', 15), el('span', { text: F.repostLine(job) })
      ]) : null,
      el('ul', { class: 'jsTimeline' }, spells.map(function (s, i) {
        var open = !s.closed_at;
        return el('li', {}, [
          el('span', { class: 'when', text: open ? 'Current posting' : 'Previous posting ' + (i + 1) }),
          el('span', { text: open ? 'Open since ' + F.day(s.opened_at) : F.day(s.opened_at) + ' – ' + F.day(s.closed_at) })
        ]);
      }))
    ]);
  }

  function body(job) {
    var kids = [el('h2', { text: 'About the role' })];
    kids.push(el('div', { class: 'jsProse', text: job.description ||
      'The employer’s feed did not include a full description for this requisition. The apply link goes to the posting itself.' }));

    if (job.requirements_source === 'employer_field') {
      if ((job.requirements || []).length) {
        kids.push(el('h3', { text: 'Required qualifications' }));
        kids.push(el('ul', { class: 'jsList' }, job.requirements.map(function (r) { return el('li', { text: r }); })));
      }
      if ((job.preferred_requirements || []).length) {
        kids.push(el('h3', { text: 'Preferred qualifications' }));
        kids.push(el('ul', { class: 'jsList' }, job.preferred_requirements.map(function (r) { return el('li', { text: r }); })));
      }
    }

    kids.push(el('h3', { text: 'Work authorisation' }));
    kids.push(el('p', { class: 'jsProse', text: job.visa_sponsorship === 'mentioned'
      ? 'This posting mentions visa sponsorship. What it actually offers is the employer’s to confirm — we only report that the subject appears in their text.'
      : 'This posting does not mention visa sponsorship. That is not the same as refusing it; the subject simply does not appear in the employer’s text.' }));

    if (F.salary(job)) {
      kids.push(el('h3', { text: 'Compensation' }));
      kids.push(el('p', { class: 'jsProse', text: F.salary(job) + ' — ' +
        (job.salary_source === 'employer_field' ? 'published as a structured field by the employer.'
                                                : 'read from an explicit range in the employer’s own posting text.') }));
    }
    return el('section', { class: 'jsPanel' }, kids);
  }

  function tracker(job) {
    var current = window.JSTracker.stageOf(job.id);
    var row = el('div', { class: 'jsChips' }, window.JSTracker.STAGES.map(function (stage) {
      var b = el('button', {
        class: 'jsChip', type: 'button',
        'aria-pressed': current === stage ? 'true' : 'false',
        text: window.JSTracker.STAGE_LABEL[stage]
      });
      b.addEventListener('click', function () {
        var on = b.getAttribute('aria-pressed') === 'true';
        window.JSTracker.set(job.id, on ? '' : stage, job);
        Array.prototype.forEach.call(row.children, function (c) { c.setAttribute('aria-pressed', 'false'); });
        if (!on) b.setAttribute('aria-pressed', 'true');
      });
      return b;
    }));
    return el('section', { class: 'jsPanel' }, [
      el('h2', { text: 'Track this application' }), row,
      el('p', { style: 'margin:14px 0 0;font-size:13px;color:var(--ink-3);line-height:1.6',
        text: 'Stored in this browser only. No account, nothing uploaded, and JobSignal never learns where you applied.' })
    ]);
  }

  function notFound() {
    return el('div', { class: 'jsEmpty', style: 'margin-top:40px' }, [
      el('h2', { text: 'That role is no longer on the board.' }),
      el('p', { text: 'JobSignal removes a role once the employer’s own hiring system stops listing it. It stays in the archive, so if the same role is posted again its full history comes with it.' }),
      el('div', { class: 'jsEmpty-acts' }, [
        el('a', { class: 'jsBtn jsBtn--primary', href: '/jobs/search/', text: 'Search live roles' })
      ])
    ]);
  }

  window.JSData.job(id).then(function (job) {
    if (!job) { window.JSDom.mount(host, notFound()); return; }
    document.title = job.job_title + ' at ' + job.company_name + ' | PaddySpeaks JobSignal';

    // The detail page has the room the card does not: name every place the
    // role is open in rather than counting the ones left out.
    var meta = [F.locationList(job).join('  ·  '), F.remote(job.remote_status), F.employment(job.employment_type), F.level(job.experience_level)]
      .filter(Boolean).join('  ·  ');

    window.JSDom.mount(host, [
      el('p', { style: 'margin:20px 0 0' }, [
        el('a', { class: 'jsBtn jsBtn--ghost', href: '/jobs/search/' }, [icon('back', 14), el('span', { text: 'Back to search' })])
      ]),
      el('div', { class: 'jsDetail' }, [
        el('div', { class: 'jsDetail-main' }, [
          el('h1', { text: job.job_title }),
          el('p', { class: 'jsDetail-co' }, [
            el('a', { href: '/jobs/company/?c=' + encodeURIComponent(job.company_slug), text: job.company_name })
          ]),
          el('p', { style: 'margin:10px 0 0;font-size:15px;color:#3C4250' }, [
            el('span', { text: meta }),
            F.salary(job) ? el('strong', { style: 'margin-left:12px;font-variant-numeric:tabular-nums', text: F.salary(job) }) : null
          ]),
          signals(job), history(job), body(job), tracker(job),
          el('section', { class: 'jsPanel' }, [
            el('h2', { text: 'Something wrong with this listing?' }),
            el('p', { style: 'margin:0 0 13px;font-size:14.5px;color:var(--ink-2);line-height:1.6',
              text: 'Already closed, broken apply link, wrong salary or location, not actually remote — all of it is useful. Reports are treated as a reason to re-check, never as automatic proof.' }),
            el('a', { class: 'jsBtn jsBtn--ghost',
              href: '/contact/?reason=website-issue&subject=' + encodeURIComponent('Job report: ' + job.job_title + ' at ' + job.company_name + ' (' + job.id + ')'),
              text: 'Report this job' })
          ])
        ]),
        aside(job)
      ])
    ]);
  }).catch(function () { window.JSDom.mount(host, notFound()); });
})();
