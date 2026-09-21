/**
 * JobSignal — the job card.
 *
 * Six lines, per the product brief: title, employer and place, trust badge,
 * dates, a caution line when one is warranted, and two actions. The Apply
 * button always names the host it goes to, so nobody clicks it without knowing
 * where they land. There is no "Easy Apply" — a test enforces its absence.
 */
(function (global) {
  'use strict';

  var el = global.JSDom.el;
  var F = global.JSFormat;

  function badge(job) {
    return el('span', { class: 'js-badge', 'data-status': job.status }, [
      el('span', { class: 'js-dot', 'aria-hidden': 'true' }),
      el('span', { text: F.statusText(job.status) }),
      job.last_verified_at ? el('span', { text: '· checked ' + F.since(job.last_verified_at) }) : null,
    ]);
  }

  function metaLine(job) {
    var bits = [];
    var loc = F.locationText(job);
    if (loc) bits.push(loc);
    var rem = F.remote(job.remote_status);
    if (rem) bits.push(rem);
    var sal = F.salary(job);
    if (sal) bits.push(sal);
    var lvl = F.level(job.experience_level);
    if (lvl) bits.push(lvl);
    if (job.department) bits.push(job.department);

    var children = [];
    bits.forEach(function (b, i) {
      if (i) children.push(el('span', { text: '·', 'aria-hidden': 'true' }));
      children.push(el('span', { text: b }));
    });
    children.push(el('span', { class: 'js-chip', 'data-fresh': job.freshness, text: job.freshness }));
    return el('p', { class: 'js-card-meta' }, children);
  }

  function dateLine(job) {
    var parts = [];
    if (job.posted_at_original) {
      parts.push('Posted by employer ' + F.dayShort(job.posted_at_original));
    } else {
      parts.push('Employer published no posting date');
    }
    parts.push('First seen ' + F.dayShort(job.first_seen_at));
    parts.push('Age ' + F.ageText(job.age_days));
    return el('p', { class: 'js-card-dates', text: parts.join('  ·  ') });
  }

  function build(job) {
    var href = '/jobs/job/?id=' + encodeURIComponent(job.id);
    var repost = F.repostLine(job);

    return el('article', { class: 'js-card', 'data-status': job.status, 'data-id': job.id }, [
      el('div', { class: 'js-card-top' }, [
        el('div', {}, [
          el('h3', {}, [el('a', { href: href, text: job.job_title })]),
          el('p', { class: 'js-card-co' }, [
            el('a', { href: '/jobs/company/?c=' + encodeURIComponent(job.company_slug), text: job.company_name }),
          ]),
        ]),
        badge(job),
      ]),
      metaLine(job),
      dateLine(job),
      repost ? el('p', { class: 'js-card-warn', text: '⚠ ' + repost }) : null,
      el('div', { class: 'js-card-actions' }, [
        el('a', { class: 'js-view', href: href, text: 'View job' }),
        el('a', {
          class: 'js-apply', href: job.apply_url, target: '_blank', rel: 'noopener nofollow',
          text: 'Apply at ' + job.apply_url_host + ' →',
        }),
        el('span', {
          class: 'js-applyhost',
          text: 'opens ' + job.apply_url_host,
        }),
      ]),
    ]);
  }

  global.JSCard = { build: build, badge: badge };
})(window);
