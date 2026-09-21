/**
 * JobSignal — verification popover.
 *
 * Progressive disclosure: the card shows a quiet "Verified 18m"; the full
 * evidence appears only when asked for. One popover exists at a time.
 */
(function (global) {
  'use strict';
  var el = global.JSDom.el, icon = global.JSIcon, F = global.JSFormat;
  var node = null, opener = null;

  function rows(job) {
    var out = [
      ['Employer', job.company_name + (job.company_domain ? ' (' + job.company_domain + ')' : '')],
      ['Source', F.ats(job.ats_provider)],
      ['Last checked', job.last_verified_at ? F.since(job.last_verified_at) : 'never'],
      ['First observed', F.day(job.first_seen_at)],
      ['Employer posted', job.posted_at_original ? F.day(job.posted_at_original) : 'not published'],
      ['Requisition', job.requisition_id || 'not published'],
      ['Reposts', job.repost_count ? job.repost_count + ' previous run' + (job.repost_count > 1 ? 's' : '') : 'none detected']
    ];
    var dl = el('dl', { class: 'jsPop-kv' });
    out.forEach(function (r) {
      dl.appendChild(el('dt', { text: r[0] }));
      dl.appendChild(el('dd', { text: String(r[1]) }));
    });
    return dl;
  }

  function close() {
    if (node && node.parentNode) node.parentNode.removeChild(node);
    node = null;
    if (opener) { opener.focus(); opener = null; }
  }

  function open(job, anchor) {
    if (node) close();
    opener = anchor;
    var shut = el('button', { class: 'jsPop-close', type: 'button', 'aria-label': 'Close' }, [icon('close', 15)]);
    shut.addEventListener('click', close);

    node = el('div', { class: 'jsPop', role: 'dialog', 'aria-label': 'Verification detail' }, [
      shut,
      el('div', { class: 'jsPop-head' }, [
        el('span', { class: 'dot', 'aria-hidden': 'true' }),
        el('span', { text: job.status === 'live' ? 'Verified' : job.status === 'recent' ? 'Recently verified' : 'Not verified' })
      ]),
      rows(job),
      el('a', { href: '/jobs/methodology/', style: 'display:inline-block;margin-top:11px;font-size:12.5px;font-weight:500', text: 'How verification works →' })
    ]);

    document.body.appendChild(node);
    var r = anchor.getBoundingClientRect();
    var top = r.bottom + window.scrollY + 8;
    var left = Math.min(r.left + window.scrollX, window.innerWidth - 300);
    node.style.top = top + 'px';
    node.style.left = Math.max(12, left) + 'px';
    shut.focus();
  }

  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && node) close(); });
  document.addEventListener('click', function (e) {
    if (node && !node.contains(e.target) && (!opener || !opener.contains(e.target))) close();
  });

  global.JSPopover = { open: open, close: close };
})(window);
