/* Views: Health Overview, Activity Effectiveness, Health Trends. */
(function () {
  'use strict';
  var HL = window.HL, h = HL.h;
  HL.state.win = '90';
  HL.state.metric = null;
  HL.state.goal = null;

  function trendOpen(code) { return function (e) { e.preventDefault(); HL.state.metric = code; HL.go('trends'); }; }

  // ================================================================== OVERVIEW
  HL.views.overview = function (root, d) {
    var ov = d.overview, w = ov.windows[HL.state.win];
    HL.vhead(root, 'Health Overview', 'What do we know, and am I improving?',
      HL.seg([['30', '30 days'], ['90', '90 days'], ['180', '180 days'], ['365', '1 year']], HL.state.win, function (v) { HL.state.win = v; HL.views.overview((root.innerHTML = '', root), d); }, 'Compare period'));

    // who
    var p = d.profile, clin = d.clinical || [];
    var who = HL.card(null, null, [
      h('p', { class: 'kicker', text: 'Synthetic person · seed ' + p.seed }),
      h('h3', { style: 'font:600 22px var(--serif);margin:4px 0 6px', text: p.name + ', ' + p.age + ' · ' + p.headline }),
      h('p', { text: p.story }),
      h('p', { class: 'note', html: 'Goals: ' + p.goals.map(function (g) { return '<strong>' + HL.esc(HL.meta.goals[g].label) + '</strong>'; }).join(' · ') }),
      clin.length ? h('ul', { class: 'plain' }, clin.map(function (c) {
        var t = c.type === 'condition' ? 'Condition: ' + c.text + ' (' + c.verification + ', since ' + HL.date(c.onset) + ')'
          : c.type === 'medication' ? 'Medication on record: ' + c.text + ' (' + c.record_status + ')' + (c.conflict ? ' — you reported it ' + c.conflict.reported_status + ' on ' + HL.date(c.conflict.reported_on) + '; not changed by the app' : '')
            : (c.type === 'clinical_goal' ? 'Clinician-set goal: ' : 'Clinician plan: ') + c.text;
        return h('li', null, [HL.kind('clinician_verified'), ' ', t]);
      })) : h('p', { class: 'note', text: 'No clinical records imported for this person.' })
    ]);
    root.appendChild(who);
    root.appendChild(h('div', { style: 'height:16px' }));

    var grid = h('div', { class: 'grid g-side' });
    // trends at a glance
    var rows = h('div', { class: 'rows' });
    Object.keys(w).forEach(function (code) {
      var x = w[code]; if (!x) return;
      var s = d.series[code], tail = s ? s[HL.meta.metrics[code].cadence === 'sparse' ? 'v' : 'med'].slice(-365) : [];
      var vals = x.status === 'insufficient' ? 'Not enough data to compare' : HL.fmt(x.prev, code) + ' → ' + HL.fmt(x.cur, code) + (x.delta != null ? '  (' + HL.signed(x.delta, code) + ')' : '');
      rows.appendChild(h('div', { class: 'row' }, [
        h('div', { class: 'nm' }, [h('a', { href: '#/trends/' + p.id, onclick: trendOpen(code), text: HL.label(code) }), h('small', null, [HL.kind(HL.meta.metrics[code].kind)])]),
        HL.status(x.status),
        h('div', { class: 'vals num', text: vals }),
        h('div', { class: 'spark' }, [HL.spark(tail, { compact: HL.meta.metrics[code].cadence === 'sparse' })]),
        h('details', null, [h('summary', { text: 'Why this label?' }),
          h('p', { text: x.reason }),
          h('p', { class: 'note', text: 'Earlier ' + HL.state.win + ' days: ' + x.n_prev + ' days or readings' + (x.cov_prev != null ? ' (' + Math.round(x.cov_prev * 100) + '% coverage)' : '') + '. Recent ' + HL.state.win + ' days: ' + x.n_cur + (x.cov_cur != null ? ' (' + Math.round(x.cov_cur * 100) + '% coverage)' : '') + '.' })])
      ]));
    });
    grid.appendChild(HL.card('Trends at a glance', 'Median of the last ' + HL.state.win + ' days against the ' + HL.state.win + ' days before. No single score: every label shows the measurement behind it. <span class="kind measured">Measured</span> <span class="kind estimated">Estimated</span> <span class="kind device">External device</span> say how the number was made. Sparklines: last 12 months.', [rows]));

    var side = h('div', { class: 'grid' });
    var sig = d.signals.filter(function (s) { return s.tier !== 'observed'; });
    side.appendChild(HL.card('Worth a look', sig.length ? null : 'Nothing in the data stands out.', sig.slice(0, 3).map(function (s) {
      return h('p', null, [HL.tier(s.tier), ' ', h('span', { text: s.why })]);
    }).concat([h('p', null, [h('a', { href: '#/signals/' + p.id, text: 'All health signals →' })])])));
    var ch = ov.changes_since_review;
    side.appendChild(HL.card('Since your last review', 'Compared with the 90-day picture on ' + HL.date(ch.date) + '.', ch.items.length ? [h('ul', { class: 'plain' }, ch.items.map(function (c) {
      return h('li', null, [c.label + ': ', HL.status(c.was), ' → ', HL.status(c.now)]);
    }))] : [h('p', { class: 'note', text: 'No label has changed since then.' })]));
    side.appendChild(HL.card('Data available', null, [h('ul', { class: 'plain' }, ov.available.map(function (a) {
      return h('li', null, [h('strong', { text: a.label }), ' ', HL.kind(a.kind), h('span', { class: 'note', text: ' · ' + a.n.toLocaleString() + ' readings · last ' + (a.fresh_days === 0 ? 'today' : a.fresh_days + ' days ago') })]);
    })), ov.missing.length ? h('p', { html: '<strong>Missing for your goals:</strong> ' + ov.missing.map(function (m) { return HL.esc(m.label + ' (' + m.for + ')'); }).join('; ') }) : null,
    h('p', null, [h('a', { href: '#/sources/' + p.id, text: 'Sources, freshness and provenance →' })])]));
    grid.appendChild(side);
    root.appendChild(grid);

    // labs
    var labs = Object.keys(ov.labs || {});
    if (labs.length) {
      root.appendChild(h('div', { style: 'height:16px' }));
      root.appendChild(HL.card('Laboratory results', 'Clinician-verified results from imported records. The watch cannot measure any of these.', labs.map(function (code) {
        var L = ov.labs[code];
        return h('div', null, [h('p', null, [h('strong', { text: HL.label(code) }), ' ', L.status ? HL.status(L.status) : null]),
          HL.table(['Date', 'Result', 'As reported', 'Notes'], L.results.map(function (r) { return [HL.date(r.date), HL.fmt(r.value, code), r.orig, (r.flags || []).join('; ')]; }), HL.label(code) + ' results'),
          L.reason ? h('p', { class: 'note', text: L.reason }) : null]);
      })));
    }

    // ask
    root.appendChild(h('div', { style: 'height:16px' }));
    var qa = h('div', { class: 'qa' });
    d.explain.forEach(function (a) {
      qa.appendChild(h('details', null, [
        h('summary', null, [a.q, ' ', a.refused ? h('span', { class: 'lbl', text: 'Declined · ' + a.refused }) : h('span', { class: 'lbl calc', text: 'Grounded' })]),
        h('p', { text: a.a }),
        a.facts && a.facts.length ? h('ul', { class: 'facts' }, a.facts.map(function (f) { return h('li', { text: f.id + ': ' + f.text }); })) : null
      ]));
    });
    root.appendChild(HL.card('Ask about this data', 'Answers are assembled only from computed facts (listed under each answer). Every number must appear in a cited fact or the answer is withheld. Questions about diagnosis, medicines, safety or prediction are declined before any data is read. <a href="/interview.app/design/the-health-intelligence-problem.html#r4">How the explanation layer works</a>.', [qa]));
  };

  // ================================================================== ACTIVITY
  HL.views.activity = function (root, d) {
    var keys = Object.keys(d.effectiveness);
    if (!HL.state.goal || keys.indexOf(HL.state.goal) < 0) HL.state.goal = d.profile.goals.filter(function (g) { return keys.indexOf(g) >= 0; })[0] || keys[0];
    var g = d.effectiveness[HL.state.goal];
    var pick = h('label', { class: 'field' }, ['Goal', h('select', { onchange: function (e) { HL.state.goal = e.target.value; root.innerHTML = ''; HL.views.activity(root, d); } },
      keys.map(function (k) { return h('option', { value: k, selected: k === HL.state.goal, text: d.effectiveness[k].label + (d.profile.goals.indexOf(k) >= 0 ? ' (your goal)' : '') }); }))]);
    HL.vhead(root, 'Activity Effectiveness', 'Is my exercise supporting the goal I chose?', pick);
    root.appendChild(h('p', { class: 'lede', text: 'Effectiveness depends on the goal. The same walks can be strong evidence of consistency and weak evidence of anything clinical. Read left to right: each stage needs better evidence than the one before.' }));
    var ol = h('ol', { class: 'chain', 'aria-label': 'Evidence chain' });
    var ST = { observed: 'Observed', estimated: 'Estimated', inferred: 'Statistical inference', 'clinician-verified': 'Clinician-verified', 'association only': 'Association only', 'not available': 'Not available', 'not needed': 'Not needed', 'not applicable': 'Not applicable' };
    g.chain.forEach(function (s, i) {
      ol.appendChild(h('li', { class: s.status === 'not available' ? 'na' : '' }, [
        h('h4', { text: (i + 1) + ' · ' + s.stage }), h('span', { class: 'lbl' + (s.status === 'inferred' ? ' calc' : ''), text: ST[s.status] || s.status }),
        h('p', { text: s.text }), s.basis ? h('p', { class: 'note', text: s.basis }) : null]));
    });
    root.appendChild(HL.card(g.label, 'Activity performed → short-term physiology → long-term trend → outcome evidence', [ol]));
    root.appendChild(h('div', { style: 'height:16px' }));

    var wk = d.weekly.slice(-52);
    var grid = h('div', { class: 'grid g2' });
    grid.appendChild(HL.card('Weekly exercise minutes, last 52 weeks', 'Blue weeks reached 150 minutes (US Physical Activity Guidelines). Gray weeks did not, or had missing days.', [
      HL.bars({ width: 520, height: 240, values: wk.map(function (x) { return x.min; }), labels: wk.map(function (x) { return 'Week of ' + HL.date(x.wk); }), line: 150, lineLabel: '150 min',
        fmt: function (v, i) { return v + ' min · ' + wk[i].days + ' days with data · ' + wk[i].n + ' workouts'; },
        tick: function (i) { return wk[i].wk.slice(8) <= '07' && (+wk[i].wk.slice(5, 7)) % 3 === 1 ? HL.date(wk[i].wk, { day: undefined, year: (+wk[i].wk.slice(5, 7)) === 1 ? 'numeric' : undefined }) : null; },
        aria: 'Weekly exercise minutes for 52 weeks; ' + wk.filter(function (x) { return x.min >= 150; }).length + ' weeks reached 150 minutes.' }),
      HL.alt('Show as a table', HL.table(['Week of', 'Minutes', 'Days with data', 'Workouts'], wk.slice().reverse().map(function (x) { return [HL.date(x.wk), x.min, x.days, x.n]; }), 'Weekly exercise minutes'))
    ]));
    var ss = d.same_speed;
    if (ss) {
      var y0 = ss.points[0][0], mid = new Date(new Date(y0).getTime() + (new Date(ss.last) - new Date(y0)) / 2).toISOString().slice(0, 10);
      grid.appendChild(HL.card('Heart rate at the same walking speed', 'Each dot is one ' + HL.esc(ss.route) + '. Orange: first half of the period; blue: second half. If fitness improves, the blue dots sit lower at the same speed.', [
        HL.scatter({ width: 520, height: 320, points: ss.points.map(function (q) { return { x: q[1], y: q[2], color: q[0] < mid ? 'var(--s2)' : 'var(--s1)', tip: HL.date(q[0]) + ': ' + q[1] + ' km/h, ' + q[2] + ' /min' }; }),
          xLabel: 'Walking speed (km/h)', yLabel: 'Average heart rate (/min)', aria: 'Scatter of walking speed against average heart rate for ' + ss.n + ' comparable walks.',
          legend: '<span><i class="dot" style="background:var(--s2)"></i>' + HL.esc(HL.date(ss.first) + ' – ' + HL.date(mid)) + '</span><span><i class="dot" style="background:var(--s1)"></i>' + HL.esc(HL.date(mid) + ' – ' + HL.date(ss.last)) + '</span>' }),
        h('p', { html: '<strong>Result:</strong> ' + (ss.per_180d > 0 ? '+' : '') + ss.per_180d + ' /min every 6 months at the same speed (95% interval ' + ss.ci95[0] + ' to ' + ss.ci95[1] + '), from ' + ss.n + ' walks. <span class="lbl calc">Statistical inference</span>' }),
        h('details', { class: 'alt' }, [h('summary', { text: 'How this conclusion was calculated' }), h('p', { text: ss.method }),
          h('p', { class: 'note', text: 'Only walks of the same distance (within 15%) and the same climb are compared, so a hilly day is never compared with a flat one. One walk can never show an effect; the estimate uses all of them, with its uncertainty.' })])
      ]));
    } else {
      grid.appendChild(HL.card('Heart rate at the same walking speed', null, [h('p', { text: 'Not enough comparable walks (same distance and climb) to compare like with like. The lab will not compare a hilly walk with a flat one.' })]));
    }
    root.appendChild(grid);
    root.appendChild(h('div', { style: 'height:16px' }));
    var recent = d.workouts.slice(-12).reverse();
    root.appendChild(HL.card('Recent workouts', 'As imported. Effort is your own rating, where recorded.', [
      HL.table(['Date', 'Type', 'Minutes', 'Distance', 'Avg heart rate', 'Climb', 'Effort'], recent.map(function (w) {
        return [HL.date(w.d), w.t, w.min, w.km != null ? w.km + ' km' : '—', w.hr != null ? w.hr + ' /min' : '—', w.elev != null ? w.elev + ' m' : '—', w.eff != null ? w.eff + '/10' : '—'];
      }), 'Recent workouts')]));
  };

  // ================================================================== TRENDS
  HL.views.trends = function (root, d) {
    var codes = Object.keys(d.series);
    if (!HL.state.metric || codes.indexOf(HL.state.metric) < 0) HL.state.metric = codes[0];
    var code = HL.state.metric, w = +HL.state.win, s = d.series[code], m = HL.meta.metrics[code];
    var redraw = function () { root.innerHTML = ''; HL.views.trends(root, d); };
    var ctl = h('div', { class: 'filters' }, [
      h('label', { class: 'field' }, ['Measure', h('select', { onchange: function (e) { HL.state.metric = e.target.value; redraw(); } }, codes.map(function (c) { return h('option', { value: c, selected: c === code, text: HL.label(c) }); }))]),
      HL.seg([['30', '30 days'], ['90', '90 days'], ['180', '180 days'], ['365', '1 year']], HL.state.win, function (v) { HL.state.win = v; redraw(); }, 'Compare period')
    ]);
    HL.vhead(root, 'Health Trends', 'What changed over 30, 90, 180 and 365 days?', null);
    root.appendChild(ctl);
    var x = d.overview.windows[HL.state.win][code], n = d.days;
    var sparse = m.cadence === 'sparse';
    var chart = HL.lineChart({
      dates: HL.dates(), code: code, height: 300,
      series: [{ label: sparse ? 'Each reading' : 'Each day', values: s.v, color: 'var(--s1)', mode: 'dots', r: sparse ? 2.6 : 1.7, opacity: sparse ? 0.8 : 0.45 },
        { label: '28-day median', values: s.med, color: 'var(--s1)', width: 2 }],
      band: { lo: s.p25, hi: s.p75, label: 'Middle half of the last 28 days' },
      shade: [{ from: n - 2 * w, to: n - w - 1, fill: 'var(--surface-2)', label: 'Earlier ' + w + ' days', legend: 'Earlier period' },
        { from: n - w, to: n - 1, fill: 'var(--s1-wash)', label: 'Recent ' + w + ' days', legend: 'Recent period' }],
      aria: HL.label(code) + ' over two years. ' + (x ? 'Recent ' + w + '-day median ' + HL.fmt(x.cur, code) + ' against ' + HL.fmt(x.prev, code) + ' before; ' + HL.STATUS[x.status] + '.' : '')
    });
    var stats = x ? h('dl', { class: 'kv' }, [
      h('dt', { text: 'Earlier ' + w + ' days, median' }), h('dd', { text: HL.fmt(x.prev, code) }),
      h('dt', { text: 'Recent ' + w + ' days, median' }), h('dd', { text: HL.fmt(x.cur, code) }),
      h('dt', { text: 'Change' }), h('dd', { text: x.delta != null ? HL.signed(x.delta, code) : '—' }),
      h('dt', { text: 'Days or readings (earlier · recent)' }), h('dd', { text: x.n_prev + ' · ' + x.n_cur }),
      x.cov_cur != null ? h('dt', { text: 'Coverage (earlier · recent)' }) : null, x.cov_cur != null ? h('dd', { text: Math.round(x.cov_prev * 100) + '% · ' + Math.round(x.cov_cur * 100) + '%' }) : null
    ]) : h('p', { text: 'Not compared.' });
    var grid = h('div', { class: 'grid g-side' });
    grid.appendChild(HL.card(HL.label(code), HL.kindLabel[m.kind] + (m.loinc ? ' · LOINC ' + m.loinc : ' · no standard code used') + ' · unit ' + HL.unit(code), [chart,
      HL.alt('Show monthly medians as a table', HL.table(['Month', 'Median', 'Days or readings'], Object.keys(d.monthly[code]).reverse().map(function (k) { var mm = d.monthly[code][k]; return [k, HL.fmt(mm.med, code), mm.n]; }), 'Monthly medians'))]));
    grid.appendChild(HL.card('The comparison', null, [x ? HL.status(x.status) : null, h('div', { style: 'height:10px' }), stats,
      h('p', { class: 'note', style: 'margin-top:10px', text: x ? x.reason : '' }),
      h('p', { class: 'note', html: '<strong>Threshold:</strong> ' + HL.esc(m.basis || '') }),
      h('p', { class: 'note', text: 'Missing days are gaps, never zeros. A period needs at least half its days (or a minimum number of readings) before the lab will compare it.' })]));
    root.appendChild(grid);
  };
})();
