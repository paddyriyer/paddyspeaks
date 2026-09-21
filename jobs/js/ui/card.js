/**
 * JobSignal — the job card.
 *
 * Visual priority, in this order: title, company, location & salary, matching
 * skills, freshness, verification, apply. Verification is a trust signal, not
 * the headline — the old card shouted VERIFIED LIVE · CHECKED 21 MINUTES AGO
 * in uppercase mono above a smaller job title.
 *
 * The apply button names its destination, so "opens boards.greenhouse.io" is
 * no longer printed beside every one.
 */
(function (global) {
  'use strict';
  var el = global.JSDom.el, icon = global.JSIcon, F = global.JSFormat;

  function initials(name) {
    var parts = String(name || '').trim().split(/\s+/);
    return ((parts[0] || '')[0] || '?').toUpperCase() +
           ((parts[1] || '')[0] || '').toLowerCase();
  }

  function logo(job) {
    var box = el('div', { class: 'jsCard-logo', 'aria-hidden': 'true', text: initials(job.company_name) });
    if (job.company_domain) {
      var img = el('img', {
        src: 'https://logo.clearbit.com/' + job.company_domain,
        alt: '', loading: 'lazy', width: 40, height: 40
      });
      img.addEventListener('error', function () { if (img.parentNode) img.parentNode.removeChild(img); });
      img.addEventListener('load', function () { box.textContent = ''; box.appendChild(img); });
    }
    return box;
  }

  function verifyButton(job, onOpen) {
    var cls = 'jsVerify';
    var label = 'Verified ' + F.since(job.last_verified_at);
    if (job.status === 'recent') { cls += ' is-stale'; }
    if (job.status === 'unverified') { cls += ' is-unverified'; label = 'Not verified'; }
    var btn = el('button', {
      class: cls, type: 'button',
      'aria-label': label + ' — show verification detail'
    }, [
      el('span', { class: 'dot', 'aria-hidden': 'true' }),
      el('span', { text: label })
    ]);
    btn.addEventListener('click', function (e) { e.preventDefault(); onOpen(job, btn); });
    return btn;
  }

  /** Skills that matched the query are marked; the rest are context. */
  function skillChips(job, matched) {
    var want = {};
    (matched || []).forEach(function (s) { want[s] = true; });
    return (job.skills || []).slice(0, 5).map(function (s) {
      return el('span', { class: 'jsSkill' + (want[s] ? ' is-match' : ''), text: F.skill(s) });
    });
  }

  function build(job, opts) {
    var o = opts || {};
    var href = '/jobs/job/?id=' + encodeURIComponent(job.id);
    var place = F.locationText(job);
    var arrangement = F.remote(job.remote_status);
    var pay = F.salary(job);
    var repost = F.repostLine(job);
    var longRun = F.longRunningLine(job);

    var saved = global.JSTracker && global.JSTracker.stageOf(job.id);
    var save = el('button', {
      class: 'jsSave', type: 'button',
      'aria-pressed': saved ? 'true' : 'false',
      'aria-label': (saved ? 'Saved' : 'Save') + ': ' + job.job_title + ' at ' + job.company_name
    }, [icon('heart', 19, { weight: 1.8 })]);
    save.addEventListener('click', function () {
      if (!global.JSTracker) return;
      var on = save.getAttribute('aria-pressed') === 'true';
      global.JSTracker.set(job.id, on ? '' : 'saved', job);
      save.setAttribute('aria-pressed', on ? 'false' : 'true');
      save.setAttribute('aria-label', (on ? 'Save' : 'Saved') + ': ' + job.job_title + ' at ' + job.company_name);
    });

    var facts = [];
    if (job.posted_at_original) facts.push('Posted ' + F.dayShort(job.posted_at_original));
    else facts.push('First seen ' + F.dayShort(job.first_seen_at));
    if (job.freshness === 'REPOSTED') facts.push('Reposted');
    if ((job.apply_hops || 0) === 0) facts.push('Direct apply');

    return el('article', { class: 'jsCard', 'data-id': job.id }, [
      logo(job),
      el('div', { class: 'jsCard-body' }, [
        el('div', { class: 'jsCard-head' }, [
          el('div', { style: 'flex-grow:1;min-width:0' }, [
            el('a', { class: 'jsCard-title', href: href, text: job.job_title }),
            el('p', { class: 'jsCard-co' }, [
              el('a', { href: '/jobs/company/?c=' + encodeURIComponent(job.company_slug), text: job.company_name })
            ])
          ]),
          save
        ]),
        el('div', { class: 'jsCard-meta' }, [
          el('span', { class: 'jsCard-place', text: [place, arrangement].filter(Boolean).join(' · ') }),
          pay ? el('span', { class: 'jsCard-pay', text: pay })
              : el('span', { class: 'jsCard-pay is-none', text: 'Salary not disclosed' })
        ]),
        (job.skills || []).length ? el('div', { class: 'jsCard-skills' }, skillChips(job, o.matchedSkills)) : null,
        repost || longRun
          ? el('p', { class: 'jsCard-note' }, [icon('warn', 15), el('span', { text: repost || longRun })])
          : null,
        el('div', { class: 'jsCard-foot' }, [
          el('div', { class: 'jsCard-facts' }, [verifyButton(job, o.onVerify || function () {})]
            .concat(facts.map(function (t) { return el('span', { class: 'jsCard-fact', text: t }); }))),
          el('div', { class: 'jsCard-actions' }, [
            el('a', { class: 'jsBtn jsBtn--ghost', href: href, text: 'View details' }),
            el('a', {
              class: 'jsBtn jsBtn--primary', href: job.apply_url,
              target: '_blank', rel: 'noopener nofollow',
              title: 'Direct employer application'
            }, [
              el('span', { text: 'Apply at ' + F.companyShort(job) }),
              icon('external', 14, { weight: 2.2 })
            ])
          ])
        ])
      ])
    ]);
  }

  function skeleton() {
    return el('div', { class: 'jsSkel', 'aria-hidden': 'true' }, [
      el('div', { class: 'jsSkel-b', style: 'width:40px;height:40px;border-radius:9px;flex:none' }),
      el('div', { style: 'flex-grow:1' }, [
        el('div', { class: 'jsSkel-b', style: 'width:52%;height:17px' }),
        el('div', { class: 'jsSkel-b', style: 'width:26%;height:13px;margin-top:9px' }),
        el('div', { class: 'jsSkel-b', style: 'width:70%;height:13px;margin-top:14px' }),
        el('div', { class: 'jsSkel-b', style: 'width:40%;height:13px;margin-top:10px' })
      ])
    ]);
  }

  global.JSCard = { build: build, skeleton: skeleton };
})(window);
