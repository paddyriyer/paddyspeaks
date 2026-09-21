/**
 * JobSignal — the search bar, with autocomplete.
 *
 * Suggestions come from the index itself (role families, companies, skills,
 * each with a live count), so nothing is suggested that returns nothing.
 * Capped at 8, debounced, and keyboard-driven.
 */
(function (global) {
  'use strict';
  var el = global.JSDom.el, icon = global.JSIcon;

  function build(opts) {
    var o = opts || {};
    var qInput = el('input', {
      type: 'text', id: o.id || 'jsQ', name: 'q',
      placeholder: o.placeholder || 'Job title, skill or company',
      autocomplete: 'off', spellcheck: 'false', value: o.q || ''
    });
    var locInput = el('input', {
      type: 'text', id: (o.id || 'jsQ') + 'Loc', name: 'location',
      placeholder: 'Location or Remote', autocomplete: 'off', value: o.location || ''
    });
    var listbox = el('div', { class: 'jsAuto', role: 'listbox', hidden: true, id: (o.id || 'jsQ') + 'Auto' });

    qInput.setAttribute('role', 'combobox');
    qInput.setAttribute('aria-expanded', 'false');
    qInput.setAttribute('aria-controls', listbox.id);
    qInput.setAttribute('aria-autocomplete', 'list');

    var form = el('form', {
      class: 'jsSearch' + (o.compact ? ' jsSearch--compact' : ''),
      role: 'search', action: '/jobs/search/', method: 'get'
    }, [
      el('div', { class: 'jsSearch-field' }, [
        icon('search', o.compact ? 16 : 19),
        el('label', { class: 'js-sr', for: qInput.id, text: 'Job title, skill or company' }),
        qInput, listbox
      ]),
      el('div', { class: 'jsSearch-div', 'aria-hidden': 'true' }),
      el('div', { class: 'jsSearch-field is-loc' }, [
        icon('pin', o.compact ? 15 : 18),
        el('label', { class: 'js-sr', for: locInput.id, text: 'Location' }),
        locInput
      ]),
      el('button', { class: 'jsSearch-go', type: 'submit', text: 'Search' })
    ]);

    /* ── autocomplete ── */
    var suggestions = [], active = -1, timer;

    function close() {
      listbox.hidden = true;
      qInput.setAttribute('aria-expanded', 'false');
      active = -1;
    }

    function choose(s) {
      qInput.value = s.value;
      close();
      if (o.onSubmit) o.onSubmit(qInput.value, locInput.value);
      else form.submit();
    }

    function render(items) {
      global.JSDom.clear(listbox);
      suggestions = items;
      if (!items.length) { close(); return; }
      var lastGroup = '';
      items.forEach(function (s, i) {
        if (s.group !== lastGroup) {
          listbox.appendChild(el('div', { class: 'jsAuto-group', text: s.group }));
          lastGroup = s.group;
        }
        var btn = el('button', {
          class: 'jsAuto-item', type: 'button', role: 'option',
          'aria-selected': 'false', 'data-i': i
        }, [
          el('span', { text: s.label }),
          s.count ? el('span', { class: 'count', text: String(s.count) }) : null
        ]);
        btn.addEventListener('click', function () { choose(s); });
        listbox.appendChild(btn);
      });
      listbox.hidden = false;
      qInput.setAttribute('aria-expanded', 'true');
    }

    function highlight(n) {
      var items = listbox.querySelectorAll('.jsAuto-item');
      if (!items.length) return;
      active = (n + items.length) % items.length;
      Array.prototype.forEach.call(items, function (b, i) {
        b.setAttribute('aria-selected', i === active ? 'true' : 'false');
        if (i === active) b.scrollIntoView({ block: 'nearest' });
      });
    }

    qInput.addEventListener('input', function () {
      clearTimeout(timer);
      var v = qInput.value.trim();
      if (v.length < 2 || !o.suggest) { close(); return; }
      timer = setTimeout(function () { render(o.suggest(v).slice(0, 8)); }, 120);
    });

    qInput.addEventListener('keydown', function (e) {
      if (listbox.hidden) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); highlight(active + 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); highlight(active - 1); }
      else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); choose(suggestions[active]); }
      else if (e.key === 'Escape') { close(); }
    });

    qInput.addEventListener('blur', function () { setTimeout(close, 140); });

    form.addEventListener('submit', function (e) {
      if (o.onSubmit) { e.preventDefault(); close(); o.onSubmit(qInput.value, locInput.value); }
    });

    form.qInput = qInput;
    form.locInput = locInput;
    return form;
  }

  /** Build a suggestion source from the index. Counts are real. */
  function suggester(jobs) {
    var roles = {}, companies = {}, skills = {};
    jobs.forEach(function (j) {
      var head = (j.role_head || '').trim();
      if (head) roles[head] = (roles[head] || 0) + 1;
      if (j.company_name) companies[j.company_name] = (companies[j.company_name] || 0) + 1;
      (j.skills || []).forEach(function (s) { skills[s] = (skills[s] || 0) + 1; });
    });
    function top(map, group, q, cap) {
      return Object.keys(map)
        .filter(function (k) { return k.toLowerCase().indexOf(q) !== -1; })
        .sort(function (a, b) { return map[b] - map[a]; })
        .slice(0, cap)
        .map(function (k) {
          return { group: group, label: title(k), value: k, count: map[k] };
        });
    }
    function title(s) {
      return s.replace(/\b[a-z]/g, function (c) { return c.toUpperCase(); });
    }
    return function (query) {
      var q = query.toLowerCase();
      return top(roles, 'Roles', q, 4)
        .concat(top(companies, 'Companies', q, 2))
        .concat(top(skills, 'Skills', q, 2));
    };
  }

  global.JSSearchBar = { build: build, suggester: suggester };
})(window);
