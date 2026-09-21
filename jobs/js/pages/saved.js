/**
 * JobSignal pipeline dashboard.
 *
 * Reads only from localStorage, then enriches each entry from the live index
 * where the role still exists. A role that has since closed still shows —
 * greyed and labelled — because an application you already sent is part of your
 * history whether or not the listing survived.
 */
(function () {
  'use strict';

  var el = window.JSDom.el;
  var F = window.JSFormat;
  var T = window.JSTracker;
  var tabsHost = document.getElementById('js-tabs');
  var listHost = document.getElementById('js-pipeline');
  var toolsHost = document.getElementById('js-pipeline-tools');

  var STAGE_ORDER = ['saved', 'applied', 'interviewing', 'offer', 'rejected', 'hidden'];
  var byId = {};
  var active = 'saved';

  function row(entry) {
    var live = byId[entry.id];
    var title = live ? live.job_title : (entry.title || 'Untitled role');
    var company = live ? live.company_name : (entry.company || '');
    var href = '/jobs/job/?id=' + encodeURIComponent(entry.id);

    var statusNode = live
      ? window.JSCard.badge(live)
      : el('span', { class: 'js-badge', 'data-status': 'closed', text: 'No longer on the board' });

    var stageButtons = el('div', { class: 'js-stage', style: 'margin-top:12px' },
      STAGE_ORDER.map(function (stage) {
        var btn = el('button', {
          type: 'button',
          'aria-pressed': entry.stage === stage ? 'true' : 'false',
          text: T.STAGE_LABEL[stage],
        });
        btn.addEventListener('click', function () {
          T.set(entry.id, entry.stage === stage ? '' : stage, live);
          render();
        });
        return btn;
      }));

    var note = el('input', {
      type: 'text', value: entry.note || '', placeholder: 'Private note (stays in this browser)',
      style: 'width:100%;margin-top:12px;font-family:var(--font-body);font-size:15px;padding:8px 10px;border:1px solid var(--color-border);border-radius:3px',
    });
    note.addEventListener('change', function () { T.setNote(entry.id, note.value); });

    return el('article', { class: 'js-card', 'data-status': live ? live.status : 'closed' }, [
      el('div', { class: 'js-card-top' }, [
        el('div', {}, [
          el('h3', {}, [el('a', { href: href, text: title })]),
          company ? el('p', { class: 'js-card-co', text: company }) : null,
        ]),
        statusNode,
      ]),
      el('p', {
        class: 'js-card-dates',
        text: 'Saved ' + F.dayShort(entry.saved_at) + '  ·  Updated ' + F.since(entry.updated_at),
      }),
      stageButtons,
      note,
      entry.apply_url
        ? el('p', { style: 'margin-top:12px' }, [
            el('a', {
              class: 'js-view', href: entry.apply_url, target: '_blank', rel: 'noopener nofollow',
              text: 'Open the application →',
            }),
          ])
        : null,
    ]);
  }

  function tabs() {
    var counts = T.counts();
    window.JSDom.clear(tabsHost);
    STAGE_ORDER.forEach(function (stage) {
      var btn = el('button', {
        class: 'js-tab', type: 'button', role: 'tab',
        'aria-selected': active === stage ? 'true' : 'false',
        text: T.STAGE_LABEL[stage] + ' (' + counts[stage] + ')',
      });
      btn.addEventListener('click', function () { active = stage; render(); });
      tabsHost.appendChild(btn);
    });
  }

  function tools() {
    window.JSDom.clear(toolsHost);
    var download = el('button', { class: 'js-btn js-btn-ghost js-btn-sm', type: 'button', text: 'Export as JSON' });
    download.addEventListener('click', function () {
      var url = URL.createObjectURL(T.exportBlob());
      var a = el('a', { href: url, download: 'jobsignal-pipeline.json' });
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    });

    var wipe = el('button', { class: 'js-btn js-btn-ghost js-btn-sm', type: 'button', text: 'Delete everything' });
    wipe.addEventListener('click', function () {
      if (window.confirm('Delete every saved job and note in this browser? This cannot be undone.')) {
        T.clearAll();
        render();
      }
    });

    toolsHost.appendChild(el('div', { style: 'display:flex;gap:10px;flex-wrap:wrap' }, [download, wipe]));
    toolsHost.appendChild(el('p', {
      class: 'js-foot', style: 'text-align:left;margin-top:14px',
      text: 'Your pipeline lives in this browser’s local storage. Clearing site data, or opening ' +
            'JobSignal on another device, starts an empty one — export first if that matters.',
    }));
  }

  function render() {
    tabs();
    var entries = T.all(active);
    if (!entries.length) {
      window.JSDom.mount(listHost, el('div', { class: 'js-empty' }, [
        el('h2', { text: 'Nothing here yet.' }),
        el('p', {
          text: 'Open any role and use the tracker at the bottom of the page to move it through ' +
                'saved, applied, interviewing and offer.',
        }),
        el('p', { style: 'margin-top:18px' }, [
          el('a', { class: 'js-view', href: '/jobs/search/', text: 'Find live roles →' }),
        ]),
      ]));
    } else {
      var wrap = el('div', { class: 'js-results' });
      entries.forEach(function (e) { wrap.appendChild(row(e)); });
      window.JSDom.mount(listHost, wrap);
    }
    tools();
  }

  window.JSData.index().then(function (doc) {
    (doc.jobs || []).forEach(function (j) { byId[j.id] = j; });
  }).catch(function () { /* the dashboard is still useful from snapshots alone */ })
    .then(render);
})();
