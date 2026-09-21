/**
 * JobSignal — filter bar and drawer.
 *
 * Replaces the permanent 268px left column, which on mobile became a ~900px
 * scrolling block sitting between the search and the first job. The common
 * filters are a horizontal bar under the search; everything else is behind
 * "More filters" in a drawer that traps focus and restores it on close.
 */
(function (global) {
  'use strict';
  var el = global.JSDom.el, icon = global.JSIcon, F = global.JSFormat;

  var QUICK = [
    { key: 'fresh72', label: 'Fresh 72', icon: 'bolt' },
    { key: 'remote', label: 'Remote', value: 'remote' },
    { key: 'verified6h', label: 'Verified 6h' },
    { key: 'salaryOnly', label: 'Salary shown' },
    { key: 'directOnly', label: 'Direct apply' },
    { key: 'visa', label: 'Visa mentioned' }
  ];

  var DRAWER = [
    ['Role family', 'family', 'select', [
      ['', 'Any'], ['data_engineering', 'Data Engineering'], ['data_science', 'Data Science'],
      ['ml_engineering', 'ML Engineering'], ['analytics', 'Analytics'],
      ['software_engineering', 'Software Engineering'], ['infrastructure', 'Infrastructure & SRE'],
      ['security', 'Security'], ['product_management', 'Product Management'], ['design_ux', 'Design & UX']
    ]],
    ['Experience', 'level', 'select', [
      ['', 'Any'], ['internship', 'Internship'], ['entry', 'Entry level'], ['mid', 'Mid level'],
      ['senior', 'Senior'], ['manager', 'Manager'], ['director_plus', 'Director+']
    ]],
    ['Work arrangement', 'remote', 'select', [['', 'Any'], ['remote', 'Remote'], ['hybrid', 'Hybrid'], ['onsite', 'Onsite']]],
    ['Employment type', 'employment', 'select', [
      ['', 'Any'], ['full_time', 'Full-time'], ['part_time', 'Part-time'], ['contract', 'Contract'], ['internship', 'Internship']
    ]],
    ['Originally posted', 'postedDays', 'select', [['', 'Any time'], ['1', 'Last 24 hours'], ['3', 'Last 3 days'], ['7', 'Last 7 days'], ['30', 'Last 30 days']]],
    ['Minimum salary', 'minSalary', 'number'],
    ['Company', 'company', 'select', [['', 'All employers']]],
    ['Industry', 'industry', 'select', [['', 'All industries']]],
    ['Company size', 'size', 'select', [['', 'Any'], ['51-200', '51–200'], ['201-1000', '201–1,000'], ['1k-5k', '1,000–5,000'], ['5k+', '5,000+']]],
    ['Trust', null, 'checks', [
      ['hideStaffing', 'Hide staffing agencies'],
      ['hideReposted', 'Hide previously reposted roles'],
      ['clearanceFree', 'Exclude roles needing a security clearance'],
      ['includeUnverified', 'Include roles we could not verify']
    ]]
  ];

  function bar(state, onChange, onOpenDrawer, counts) {
    var scroll = el('div', { class: 'jsBar-scroll' });

    QUICK.forEach(function (q) {
      var on = q.value ? state[q.key] === q.value : !!state[q.key];
      var kids = [];
      if (q.icon) kids.push(icon(q.icon, 13));
      kids.push(el('span', { text: q.label }));
      var chip = el('button', { class: 'jsChip', type: 'button', 'aria-pressed': on ? 'true' : 'false' }, kids);
      chip.addEventListener('click', function () {
        if (q.value) state[q.key] = state[q.key] === q.value ? '' : q.value;
        else state[q.key] = !state[q.key];
        onChange();
      });
      scroll.appendChild(chip);
    });

    var extra = countActive(state);
    var more = el('button', { class: 'jsSelect' + (extra ? ' is-on' : ''), type: 'button' }, [
      icon('sliders', 13), el('span', { text: 'More filters' }),
      extra ? el('span', { class: 'jsSelect-count', text: String(extra) }) : null
    ]);
    more.addEventListener('click', onOpenDrawer);

    var kids = [scroll, el('div', { class: 'jsBar-sep', 'aria-hidden': 'true' }), more];
    if (extra || anyQuick(state)) {
      var clear = el('button', { class: 'jsBar-clear', type: 'button', text: 'Clear all' });
      clear.addEventListener('click', function () {
        Object.keys(state).forEach(function (k) { if (k !== 'q' && k !== 'sort') delete state[k]; });
        onChange();
      });
      kids.push(el('div', { style: 'flex-grow:1' }));
      kids.push(clear);
    }
    return el('div', { class: 'jsBar' }, kids);
  }

  function anyQuick(state) {
    return QUICK.some(function (q) { return q.value ? state[q.key] === q.value : !!state[q.key]; });
  }

  var DRAWER_KEYS = ['family', 'level', 'remote', 'employment', 'postedDays', 'minSalary',
    'company', 'industry', 'size', 'hideStaffing', 'hideReposted', 'clearanceFree', 'includeUnverified'];

  function countActive(state) {
    return DRAWER_KEYS.filter(function (k) { return state[k]; }).length;
  }

  function drawer(state, options, onApply) {
    var scrim = el('div', { class: 'jsScrim' });
    var body = el('div', { class: 'jsDrawer-body' });

    DRAWER.forEach(function (spec) {
      var legend = spec[0], key = spec[1], kind = spec[2], opts = spec[3];
      var field = el('fieldset', { class: 'jsField' }, [el('legend', { text: legend })]);

      if (kind === 'select') {
        var sel = el('select', { id: 'f_' + key });
        var list = opts.slice();
        if (key === 'company') list = list.concat(options.companies || []);
        if (key === 'industry') list = list.concat(options.industries || []);
        list.forEach(function (o) {
          var op = el('option', { value: o[0], text: o[1] });
          if (String(state[key] || '') === String(o[0])) op.selected = true;
          sel.appendChild(op);
        });
        sel.addEventListener('change', function () { state[key] = sel.value; });
        field.appendChild(sel);
      } else if (kind === 'number') {
        var num = el('input', { type: 'number', id: 'f_' + key, min: '0', step: '5000', placeholder: 'e.g. 150000', value: state[key] || '' });
        num.addEventListener('change', function () { state[key] = num.value ? parseInt(num.value, 10) : 0; });
        field.appendChild(num);
      } else {
        opts.forEach(function (c) {
          var box = el('input', { type: 'checkbox', id: 'f_' + c[0] });
          box.checked = !!state[c[0]];
          box.addEventListener('change', function () { state[c[0]] = box.checked; });
          field.appendChild(el('label', { class: 'jsCheck', for: box.id }, [box, el('span', { text: c[1] })]));
        });
      }
      body.appendChild(field);
    });

    var showBtn = el('button', { class: 'jsBtn jsBtn--primary', type: 'button', style: 'flex-grow:1', text: 'Show results' });
    var clearBtn = el('button', { class: 'jsBtn jsBtn--ghost', type: 'button', text: 'Clear all' });
    var closeBtn = el('button', { class: 'jsPop-close', type: 'button', style: 'position:static', 'aria-label': 'Close filters' }, [icon('close', 18)]);

    var panel = el('aside', { class: 'jsDrawer', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Filters' }, [
      el('div', { class: 'jsDrawer-head' }, [el('h2', { text: 'Filters' }), closeBtn]),
      body,
      el('div', { class: 'jsDrawer-foot' }, [clearBtn, showBtn])
    ]);

    var lastFocus = document.activeElement;
    function shut() {
      scrim.classList.remove('is-open');
      panel.classList.remove('is-open');
      setTimeout(function () {
        if (scrim.parentNode) scrim.parentNode.removeChild(scrim);
        if (panel.parentNode) panel.parentNode.removeChild(panel);
      }, 180);
      document.removeEventListener('keydown', onKey);
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }
    function onKey(e) {
      if (e.key === 'Escape') { shut(); return; }
      if (e.key !== 'Tab') return;
      var f = panel.querySelectorAll('button, input, select, a[href]');
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }

    closeBtn.addEventListener('click', shut);
    scrim.addEventListener('click', shut);
    clearBtn.addEventListener('click', function () {
      DRAWER_KEYS.forEach(function (k) { delete state[k]; });
      shut(); onApply();
    });
    showBtn.addEventListener('click', function () { shut(); onApply(); });

    document.body.appendChild(scrim);
    document.body.appendChild(panel);
    document.addEventListener('keydown', onKey);
    requestAnimationFrame(function () { scrim.classList.add('is-open'); panel.classList.add('is-open'); });
    closeBtn.focus();

    return { close: shut, showBtn: showBtn };
  }

  global.JSFilters = { bar: bar, drawer: drawer, countActive: countActive };
})(window);
