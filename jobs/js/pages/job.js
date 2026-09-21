/**
 * JobSignal job detail.
 *
 * The page is organised around one question: what do we actually know about
 * this role, and when did we learn it? Source transparency and posting history
 * come BEFORE the job description, because those are the parts a candidate
 * cannot get anywhere else.
 */
(function () {
  'use strict';

  var el = window.JSDom.el;
  var F = window.JSFormat;
  var host = document.getElementById('js-job');

  function kv(pairs) {
    var nodes = [];
    pairs.forEach(function (p) {
      if (!p || p[1] === null || p[1] === undefined || p[1] === '') return;
      nodes.push(el('dt', { text: p[0] }));
      nodes.push(el('dd', {}, [typeof p[1] === 'string' ? document.createTextNode(p[1]) : p[1]]));
    });
    return el('dl', { class: 'js-kv' }, nodes);
  }

  function header(job) {
    var meta = [];
    var loc = F.locationText(job);
    if (loc) meta.push(loc);
    var rem = F.remote(job.remote_status);
    if (rem) meta.push(rem);
    var emp = F.employment(job.employment_type);
    if (emp) meta.push(emp);
    var lvl = F.level(job.experience_level);
    if (lvl) meta.push(lvl);

    return el('header', { style: 'margin-top:24px' }, [
      el('p', { class: 'js-eyebrow', text: job.department || 'Open role' }),
      el('h1', {
        style: 'font-family:var(--font-display);font-size:clamp(30px,5vw,46px);line-height:1.1;margin:8px 0 0;color:var(--color-ink)',
        text: job.job_title,
      }),
      el('p', { class: 'js-card-co', style: 'font-size:19px;margin-top:8px' }, [
        el('a', { href: '/jobs/company/?c=' + encodeURIComponent(job.company_slug), text: job.company_name }),
      ]),
      el('p', { class: 'js-card-meta', style: 'margin-top:10px' }, [
        el('span', { text: meta.join('  ·  ') }),
        F.salary(job) ? el('span', { text: '·' }) : null,
        F.salary(job) ? el('strong', { text: F.salary(job) }) : null,
      ]),
      el('div', { style: 'display:flex;flex-wrap:wrap;gap:10px;margin-top:16px;align-items:center' }, [
        window.JSCard.badge(job),
        el('span', { class: 'js-chip', 'data-fresh': job.freshness, text: job.freshness }),
        el('span', { class: 'js-conf', 'data-level': job.confidence_level,
                     text: 'Live confidence: ' + job.confidence_level }),
      ]),
      el('div', { class: 'js-card-actions', style: 'margin-top:20px' }, [
        el('a', {
          class: 'js-apply', href: job.apply_url, target: '_blank', rel: 'noopener nofollow',
          text: 'Apply at ' + job.apply_url_host + ' →',
        }),
        el('span', { class: 'js-applyhost', text: 'This link opens ' + job.apply_url_host + ' directly.' }),
      ]),
    ]);
  }

  function signalsPanel(job) {
    var list = el('ul', { class: 'js-signals' },
      (job.confidence_signals || []).map(function (s) {
        return el('li', { 'data-kind': s.kind }, [
          el('span', { class: 'js-mark', 'aria-hidden': 'true', text: s.kind === 'plus' ? '✓' : '⚠' }),
          el('span', { text: s.text }),
        ]);
      }));

    return el('section', { class: 'js-panel' }, [
      el('h2', { text: 'Live confidence' }),
      el('p', {
        class: 'js-conf', 'data-level': job.confidence_level,
        style: 'font-size:15px;margin:0 0 14px',
        text: String(job.confidence_level || '').toUpperCase(),
      }),
      list,
      el('p', {
        style: 'font-family:var(--font-body);font-size:14px;color:var(--color-light-muted);margin:16px 0 0;line-height:1.6',
        text: 'These are observations, not accusations. JobSignal does not know why an employer ' +
              'posts what it posts — it reports what it checked and when, so you can weigh it ' +
              'yourself before spending an application.',
      }),
    ]);
  }

  function sourcePanel(job) {
    return el('section', { class: 'js-panel' }, [
      el('h2', { text: 'Source transparency' }),
      kv([
        ['Employer', job.company_name + ' (' + job.company_domain + ')'],
        ['Hiring system', F.ats(job.ats_provider)],
        ['Requisition', job.requisition_id || 'not published by the employer'],
        ['Employer’s posting date', job.posted_at_original
          ? F.day(job.posted_at_original)
          : 'not published by the employer'],
        ['First observed by us', F.day(job.first_seen_at)],
        ['Last verified', job.last_verified_at
          ? F.day(job.last_verified_at) + ' (' + F.since(job.last_verified_at) + ')'
          : 'never'],
        ['Age of this posting', F.ageText(job.age_days)],
        (job.repost_count ? ['Age of this role', F.ageText(job.lineage_age_days)] : null),
        ['Application goes to', el('a', {
          href: job.apply_url, target: '_blank', rel: 'noopener nofollow', text: job.apply_url,
        })],
      ]),
    ]);
  }

  function historyPanel(job) {
    var spells = (job.lineage_spells || []).slice().sort(function (a, b) {
      return (a.opened_at || '').localeCompare(b.opened_at || '');
    });
    if (!spells.length) return null;

    var items = spells.map(function (s, i) {
      var isCurrent = !s.closed_at;
      var label = isCurrent
        ? 'Open since ' + F.day(s.opened_at)
        : F.day(s.opened_at) + ' – ' + F.day(s.closed_at);
      return el('li', {}, [
        el('span', { class: 'js-when', text: isCurrent ? 'Current posting' : 'Previous posting ' + (i + 1) }),
        el('span', { text: label }),
      ]);
    });

    return el('section', { class: 'js-panel' }, [
      el('h2', { text: 'Posting history' }),
      job.repost_count
        ? el('p', { class: 'js-card-warn', style: 'margin:0 0 14px', text: '⚠ ' + F.repostLine(job) })
        : el('p', {
            style: 'font-family:var(--font-body);font-size:15px;color:var(--color-muted);margin:0 0 14px',
            text: 'We have seen this role posted once.',
          }),
      el('ul', { class: 'js-timeline' }, items),
      el('p', {
        style: 'font-family:var(--font-body);font-size:14px;color:var(--color-light-muted);margin:14px 0 0;line-height:1.6',
        text: 'History starts the day JobSignal first saw this role, which may be later than the ' +
              'employer first posted it. We never shorten it.',
      }),
    ]);
  }

  function descriptionPanel(job) {
    var kids = [el('h2', { text: 'About the role' })];
    if (job.description) {
      kids.push(el('div', { class: 'js-prose', text: job.description }));
    } else {
      kids.push(el('p', {
        class: 'js-prose',
        text: 'The employer’s feed did not include a full description for this requisition. ' +
              'The apply link above goes to the posting itself.',
      }));
    }
    // Only when the employer published them as their own fields. If we parsed
    // them back out of the description, they are already on the page above in
    // the employer's own wording, and repeating them helps nobody.
    if (job.requirements_source === 'employer_field') {
      if ((job.requirements || []).length) {
        kids.push(el('h3', { text: 'Required qualifications' }));
        kids.push(el('ul', { class: 'js-list' },
          job.requirements.map(function (r) { return el('li', { text: r }); })));
      }
      if ((job.preferred_requirements || []).length) {
        kids.push(el('h3', { text: 'Preferred qualifications' }));
        kids.push(el('ul', { class: 'js-list' },
          job.preferred_requirements.map(function (r) { return el('li', { text: r }); })));
      }
    }

    kids.push(el('h3', { text: 'Work authorisation' }));
    kids.push(el('p', {
      class: 'js-prose',
      text: job.visa_sponsorship === 'mentioned'
        ? 'This posting mentions visa sponsorship. What it actually offers is the employer’s to ' +
          'confirm — we only report that the subject appears in their text.'
        : 'This posting does not mention visa sponsorship. That is not the same as refusing it; ' +
          'the subject simply does not appear in the employer’s text.',
    }));
    if (job.security_clearance === 'mentioned') {
      kids.push(el('p', { class: 'js-prose', text: 'This posting mentions a security clearance requirement.' }));
    }
    if (F.salary(job)) {
      kids.push(el('h3', { text: 'Compensation' }));
      kids.push(el('p', {
        class: 'js-prose',
        text: F.salary(job) + ' — ' + (job.salary_source === 'employer_field'
          ? 'published as a structured field by the employer.'
          : 'read from an explicit range in the employer’s own posting text.'),
      }));
    }
    return el('section', { class: 'js-panel' }, kids);
  }

  function trackerPanel(job) {
    var current = window.JSTracker.stageOf(job.id);
    var buttons = window.JSTracker.STAGES.map(function (stage) {
      var btn = el('button', {
        type: 'button',
        'aria-pressed': current === stage ? 'true' : 'false',
        text: window.JSTracker.STAGE_LABEL[stage],
      });
      btn.addEventListener('click', function () {
        var next = btn.getAttribute('aria-pressed') === 'true' ? '' : stage;
        window.JSTracker.set(job.id, next, job);
        Array.prototype.forEach.call(btn.parentNode.children, function (b) {
          b.setAttribute('aria-pressed', 'false');
        });
        if (next) btn.setAttribute('aria-pressed', 'true');
      });
      return btn;
    });

    return el('section', { class: 'js-panel' }, [
      el('h2', { text: 'Track this application' }),
      el('div', { class: 'js-stage' }, buttons),
      el('p', {
        style: 'font-family:var(--font-body);font-size:14px;color:var(--color-light-muted);margin:14px 0 0;line-height:1.6',
        text: 'Stored in this browser only. There is no account, nothing is sent anywhere, and ' +
              'JobSignal never learns where you applied.',
      }),
      el('p', { style: 'margin-top:12px' }, [
        el('a', { class: 'js-view', href: '/jobs/saved/', text: 'Open your pipeline →' }),
      ]),
    ]);
  }

  function reportPanel(job) {
    // Phase 1 has no reporting endpoint, so rather than a button that quietly
    // does nothing, this routes to the contact form that is already wired and
    // already read. The Worker route is Phase 2 (docs/JOBSIGNAL.md §9).
    var subject = 'Job report: ' + job.job_title + ' at ' + job.company_name + ' (' + job.id + ')';
    return el('section', { class: 'js-panel' }, [
      el('h2', { text: 'Something wrong with this listing?' }),
      el('p', {
        style: 'font-family:var(--font-body);font-size:15px;color:var(--color-muted);margin:0 0 14px;line-height:1.6',
        text: 'Already closed, broken apply link, wrong salary or location, not actually remote, or ' +
              'the employer told you it does not exist — all of it is useful. Reports are treated ' +
              'as signals to re-check, never as automatic proof.',
      }),
      el('a', {
        class: 'js-view',
        href: '/contact/?reason=website-issue&subject=' + encodeURIComponent(subject),
        text: 'Report this job →',
      }),
    ]);
  }

  function notFound(id) {
    return el('div', { class: 'js-empty' }, [
      el('h2', { text: 'That role is no longer on the board.' }),
      el('p', {
        text: 'JobSignal removes a role once the employer’s own hiring system stops listing it, ' +
              'rather than leaving a listing up that nobody is reading. It stays in the archive, ' +
              'so if the same role is posted again its full history comes with it.',
      }),
      id ? el('p', { class: 'js-applyhost', text: 'Reference: ' + id }) : null,
      el('p', { style: 'margin-top:18px' }, [
        el('a', { class: 'js-view', href: '/jobs/search/', text: 'Search live roles →' }),
      ]),
    ]);
  }

  var id = new URLSearchParams(location.search).get('id') || '';

  window.JSData.job(id).then(function (job) {
    if (!job) {
      window.JSDom.mount(host, notFound(id));
      return;
    }
    document.title = job.job_title + ' at ' + job.company_name + ' | PaddySpeaks JobSignal';
    window.JSDom.mount(host, [
      header(job),
      signalsPanel(job),
      sourcePanel(job),
      historyPanel(job),
      descriptionPanel(job),
      trackerPanel(job),
      reportPanel(job),
    ]);
  }).catch(function () {
    window.JSDom.mount(host, notFound(id));
  });
})();
