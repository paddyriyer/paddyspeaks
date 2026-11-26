/* Views: Cohort Explorer, Health Signals, Goal Studio, Annual Health Review. */
(function () {
  'use strict';
  var HL = window.HL, h = HL.h;
  HL.state.cmetric = null; HL.state.cf = null; HL.state.showObserved = false; HL.state.preset = 'q';
  HL.state.sim = { rate: 0, months: 6, unc: null };

  // ================================================================== COHORTS
  HL.views.cohorts = function (root, d) {
    var C = HL.meta.cohorts, me = d.cohort;
    var redraw = function () { root.innerHTML = ''; HL.views.cohorts(root, d); };
    if (!HL.state.cmetric) HL.state.cmetric = C.metrics.filter(function (m) { return me.current[m].value != null; })[0] || C.metrics[0];
    if (!HL.state.cf || HL.state.cf.pid !== d.profile.id) HL.state.cf = { pid: d.profile.id, age: me.age_band, sex: me.sex, act: me.activity == null ? 1 : me.activity, cond: 0 };
    var f = HL.state.cf, m = HL.state.cmetric, cur = me.current[m];
    var sel = function (label, val, opts, on) {
      return h('label', { class: 'field' }, [label, h('select', { onchange: function (e) { on(e.target.value); redraw(); } }, opts.map(function (o) {
        return h('option', { value: o[0], selected: String(o[0]) === String(val), disabled: o[2] || null, text: o[1] });
      }))]);
    };
    HL.vhead(root, 'Cohort Explorer', 'How do I compare, why this cohort, and how much should I trust it?', null);
    root.appendChild(h('p', { class: 'banner', role: 'note', html: '<span class="illus">Illustrative cohort</span><span>' + HL.esc(C.label) + ' The rank below is a rank within that made-up group, not a population percentile.</span>' }));
    root.appendChild(h('div', { style: 'height:12px' }));
    root.appendChild(h('div', { class: 'filters' }, [
      sel('Measure', m, C.metrics.map(function (k) { return [k, HL.label(k) + (me.current[k].value == null ? ' (not enough data)' : '')]; }), function (v) { HL.state.cmetric = v; }),
      sel('Age band', f.age, C.age_bands.map(function (b, i) { return [i, b + (i === me.age_band ? ' (yours)' : '')]; }), function (v) { f.age = +v; }),
      sel('Reference sex category', f.sex, [['female', 'Female' + (me.sex === 'female' ? ' (yours)' : '')], ['male', 'Male' + (me.sex === 'male' ? ' (yours)' : '')]], function (v) { f.sex = v; }),
      sel('Activity level (steps/day)', f.act, C.activity.map(function (a, i) { return [i, a + (i === me.activity ? ' (yours)' : '')]; }), function (v) { f.act = +v; }),
      sel('Confirmed condition', f.cond, C.conditions.map(function (c, i) { var ok = me.conditions_allowed.indexOf(i) >= 0; return [i, c + (ok ? '' : ' — not in your records'), !ok]; }), function (v) { f.cond = +v; })
    ]));
    var key = [m, f.age, f.sex, f.act, f.cond].join('|'), st = C.strata[key], rank = me.ranks[key];
    var warn = [];
    if (f.age !== me.age_band) warn.push('This is not your age band.');
    if (f.sex !== me.sex) warn.push('This is not your reference category.');
    if (me.activity != null && f.act !== me.activity) warn.push('Your own step count puts you in a different activity level.');
    if (st.n < 200) warn.push('Small cohort (' + st.n + '): ranks move a lot with a few people.');
    var grid = h('div', { class: 'grid g-side' });
    grid.appendChild(HL.card('Where you sit in this cohort', cur.value == null ? HL.esc(cur.reason) : 'Your last-90-day median: <strong>' + HL.esc(HL.fmt(cur.value, m)) + '</strong> from ' + cur.n + ' days or readings.', [
      cur.value == null ? h('p', { text: 'No comparison: the lab will not compare a value it does not have.' }) :
        HL.box({ p: st.p, value: cur.value, code: m, aria: 'Box plot of the illustrative cohort with your value marked; rank ' + rank + '.' }),
      cur.value != null ? h('p', { html: '<strong>Rank within this illustrative cohort:</strong> ' + HL.esc(typeof rank === 'number' ? 'about the ' + rank + 'th percentile' : rank) + ' <span class="illus">Illustrative</span>' }) : null,
      warn.length ? h('ul', { class: 'plain' }, warn.map(function (w) { return h('li', { text: w }); })) : null,
      HL.alt('Show the cohort percentiles as a table', HL.table(['Percentile'].concat(C.pcts.map(function (q) { return q + 'th'; })), [[HL.label(m)].concat(st.p.map(function (v) { return HL.num(v, m); }))], 'Cohort percentiles'))
    ]));
    grid.appendChild(HL.card('Why this cohort', null, [
      h('dl', { class: 'kv' }, [
        h('dt', { text: 'Age' }), h('dd', { text: C.age_bands[f.age] }),
        h('dt', { text: 'Reference category' }), h('dd', { text: f.sex }),
        h('dt', { text: 'Activity level' }), h('dd', { text: C.activity[f.act] }),
        h('dt', { text: 'Condition' }), h('dd', { text: C.conditions[f.cond] }),
        h('dt', { text: 'People (synthetic)' }), h('dd', { text: st.n.toLocaleString() })]),
      h('p', { class: 'note', style: 'margin-top:10px', text: 'Conditions appear only when your clinical records confirm them; the lab never infers one from exercise or heart rate. Activity level comes from your own steps.' }),
      h('p', { class: 'note', text: 'Compare with your earlier self first: your own trend (Health Trends) is measured the same way every day, by the same device, on the same body.' })
    ]));
    root.appendChild(grid);
    root.appendChild(h('div', { style: 'height:16px' }));
    var refs = C.references.filter(function (r) { return r.metric === m; });
    root.appendChild(HL.card('Published references a real system would use', 'None of these is loaded in this demo except where marked. Each needs a method match before it can be compared with a watch.', [
      refs.length ? h('div', { class: 'grid g2' }, refs.map(function (r) {
        return h('div', { class: 'card', style: 'background:var(--surface-2)' }, [h('h3', { text: r.name }), h('p', { class: 'note', text: r.cite + (r.loaded ? ' · used for labels only' : ' · not loaded') }),
          h('p', { text: r.what }), h('p', { html: '<strong>Method match:</strong> ' + HL.esc(r.match) })]);
      })) : h('p', { text: 'No published reference is catalogued for this measure yet. Without one, the honest comparison is with yourself.' }),
      h('p', { class: 'note', style: 'margin-top:10px', text: 'How much to trust any comparison: who was measured (people who buy a watch and share data are not a random sample), how (lab test, examiner, or a wrist estimate), how many, and when.' })
    ]));
  };

  // ================================================================== SIGNALS
  HL.views.signals = function (root, d) {
    var redraw = function () { root.innerHTML = ''; HL.views.signals(root, d); };
    HL.vhead(root, 'Health Signals', 'Which changes deserve attention, and what are the limits of a wearable warning?', null);
    var legend = h('div', { class: 'grid g2' }, [
      h('div', null, [HL.tier('observed'), h('p', { class: 'note', text: 'A measurement differs from your own documented baseline. Usually nothing to do.' })]),
      h('div', null, [HL.tier('context'), h('p', { class: 'note', text: 'The change overlaps something you recorded (an illness, travel) or two records disagree.' })]),
      h('div', null, [HL.tier('discuss'), h('p', { class: 'note', text: 'Persistent, unexplained, and relevant: worth bringing to your next appointment.' })]),
      h('div', null, [HL.tier('urgent'), h('p', { class: 'note', text: 'Serious symptoms or validated warnings: seek care now, whatever the metrics say.' })])
    ]);
    root.appendChild(HL.card('Four tiers, four responses', 'No arbitrary danger thresholds. A signal means “different from your usual”, never “you are ill” or “you are fine”.', [legend]));
    root.appendChild(h('div', { style: 'height:16px' }));
    var main = d.signals.filter(function (s) { return s.tier !== 'observed'; }), obs = d.signals.filter(function (s) { return s.tier === 'observed'; });
    if (!main.length) root.appendChild(HL.card(null, null, [h('p', { text: d.profile.id === 'e' ? 'No signals. With this little data the lab cannot tell what “usual” is, so it says nothing rather than guess.' : 'Nothing persistent or unexplained in this person’s data.' })]));
    var list = h('div', { class: 'grid' });
    main.forEach(function (s) { list.appendChild(sigCard(s, d)); });
    root.appendChild(list);
    root.appendChild(h('div', { style: 'height:16px' }));
    root.appendChild(h('div', { class: 'filters' }, [h('button', { type: 'button', class: 'btn ghost', 'aria-expanded': String(HL.state.showObserved), onclick: function () { HL.state.showObserved = !HL.state.showObserved; redraw(); },
      text: (HL.state.showObserved ? 'Hide' : 'Show') + ' ' + obs.length + ' observed changes' })]));
    if (HL.state.showObserved) { var l2 = h('div', { class: 'grid' }); obs.forEach(function (s) { l2.appendChild(sigCard(s, d)); }); root.appendChild(l2); }
    root.appendChild(h('div', { style: 'height:16px' }));
    root.appendChild(h('section', { class: 'sig urgent' }, [
      h('h3', null, [HL.tier('urgent'), h('span', { class: 'illus', text: 'Illustrative example' })]),
      h('p', { text: 'If someone logs a symptom such as: ' + HL.meta.urgent_terms.slice(0, 8).join(', ') + '…' }),
      h('p', { html: '<strong>The response:</strong> ' + HL.esc(HL.meta.urgent_guidance) }),
      h('p', { class: 'note', text: 'This example is not from this person’s data. Consumer wearables cannot rule out a heart attack or stroke; symptoms outrank the watch. The rule is tested in healthlab/tests.' })]));
  };

  function sigCard(s, d) {
    var kids = [h('h3', null, [HL.tier(s.tier), s.label, h('span', { class: 'note', text: HL.date(s.start) + (s.end && s.end !== s.start ? ' – ' + (s.ongoing ? 'now' : HL.date(s.end)) : '') })])];
    if (d.series[s.metric] && !s.gradual) {
      var dates = HL.dates(), si = dates.indexOf(s.start), ei = dates.indexOf(s.end);
      var a = Math.max(0, si - 70), b = Math.min(dates.length - 1, ei + 30), ser = d.series[s.metric];
      kids.push(HL.lineChart({ dates: dates.slice(a, b + 1), code: s.metric, height: 200,
        series: [{ label: 'Each day', values: ser.v.slice(a, b + 1), color: 'var(--s1)', mode: 'dots', r: 2.2, opacity: 0.6 }, { label: '28-day median', values: ser.med.slice(a, b + 1), color: 'var(--s1)' }],
        refBand: s.baseline.p10 != null ? { lo: s.baseline.p10, hi: s.baseline.p90, label: 'Your usual range (10th–90th percentile)' } : null,
        shade: [{ from: si - a, to: ei - a, fill: 'var(--s1-wash)', legend: 'The flagged period' }],
        aria: s.label + ' around the flagged period.' }));
    }
    var src = (d.overview.available.filter(function (x) { return x.code === s.metric; })[0] || {}).sources;
    kids.push(h('dl', null, [
      h('dt', { text: 'What changed' }), h('dd', { text: s.why }),
      h('dt', { text: 'Source measurements' }), h('dd', { text: src ? src.join(', ') : (s.metric === 'record' ? 'Clinical record and your own entry' : '—') }),
      s.completeness != null ? h('dt', { text: 'Data completeness' }) : null, s.completeness != null ? h('dd', { text: Math.round(s.completeness * 100) + '% of days (' + s.n + ')' }) : null,
      h('dt', { text: 'Why it surfaced' }), h('dd', { text: s.rule }),
      h('dt', { text: 'Known limits' }), h('dd', { text: s.limits }),
      s.related && s.related.length ? h('dt', { text: 'Related records' }) : null,
      s.related && s.related.length ? h('dd', { text: s.related.map(function (r) { return HL.date(r.date) + ': “' + r.text + '” (you entered; shown, not used to explain the change)'; }).join(' · ') }) : null,
      h('dt', { text: 'A reasonable next step' }), h('dd', null, [h('strong', { text: s.next })])
    ]));
    return h('section', { class: 'sig ' + s.tier }, kids);
  }

  // ================================================================== GOALS
  HL.views.goals = function (root, d) {
    var redraw = function () { root.innerHTML = ''; HL.views.goals(root, d); };
    var rank = function (g) { var i = d.profile.goals.indexOf(g.id); return i < 0 ? 99 : i; };
    var gs = d.goals.slice().sort(function (a, b) { return rank(a) - rank(b); });
    if (!HL.state.gs || !gs.some(function (g) { return g.id === HL.state.gs; })) HL.state.gs = gs[0].id;
    var g = gs.filter(function (x) { return x.id === HL.state.gs; })[0], G = HL.meta.goals[g.id];
    HL.vhead(root, 'Goal Studio', 'What would tell me whether I am reaching my goal?', null);
    root.appendChild(h('div', { class: 'tiles', role: 'group', 'aria-label': 'Goals' }, gs.map(function (x) {
      return h('button', { type: 'button', class: 'tile', 'aria-pressed': String(x.id === g.id), onclick: function () { HL.state.gs = x.id; HL.state.sim.unc = null; redraw(); } },
        [h('b', { text: HL.meta.goals[x.id].label }), h('span', { text: x.chosen ? 'Your goal' : 'Explore' })]);
    })));
    root.appendChild(h('div', { style: 'height:16px' }));
    var p = g.progress;
    var grid = h('div', { class: 'grid g2' });
    grid.appendChild(HL.card(G.label, null, [
      h('p', { html: '<strong>1 · Definition.</strong> ' + HL.esc(G.definition) }),
      h('p', { html: '<strong>2 · Measurements available.</strong> ' + (g.available.length ? g.available.map(function (a) { return HL.esc(a.label + ' (' + a.source + ', ' + a.n + ')'); }).join('; ') : 'None.') }),
      h('p', { html: '<strong>3 · Missing.</strong> ' + (g.missing.length ? g.missing.map(function (a) { return HL.esc(a.label + ' — ' + a.source); }).join('; ') + '.' : 'Nothing this goal relies on is missing.') + ' <span class="note">Beyond the watch: ' + HL.esc(G.needs_external) + '</span>' }),
      h('p', { html: '<strong>4 · Baseline.</strong> ' + (p ? HL.esc(HL.fmt(p.baseline, p.code) + (p.baseline_date ? ' (' + HL.date(p.baseline_date) + ')' : ' (the earlier period)')) : 'None yet.') }),
      h('p', null, [h('strong', { text: '5 · Progress since baseline. ' }), p ? HL.status(p.status) : HL.status('insufficient'), ' ', p ? HL.fmt(p.current, p.code) + (p.current_date ? ' (' + HL.date(p.current_date) + ')' : ' (recent period)') : '', p && p.how ? h('span', { class: 'note', text: ' · ' + p.how }) : null]),
      h('p', { html: '<strong>6 · Evaluation period.</strong> ' + HL.esc(G.period) }),
      h('p', { html: '<strong>7 · Behavioral options (evidence-based, general).</strong>' }), h('ul', { class: 'plain' }, G.options.map(function (o) { return h('li', { text: o }); })),
      h('p', { html: '<strong>8 · Questions for your clinician.</strong>' }), h('ul', { class: 'plain' }, G.questions.map(function (o) { return h('li', { text: o }); })),
      g.clinician.length ? h('p', { html: '<strong>Set by your clinician:</strong> ' + g.clinician.map(HL.esc).join(' · ') + ' ' }) : null,
      h('p', { class: 'note', html: '<strong>Guardrail:</strong> ' + HL.esc(G.guardrail) })
    ]));
    grid.appendChild(simulator(g, p, d));
    root.appendChild(grid);
  };

  function simulator(g, p, d) {
    if (!p || p.current == null) return HL.card('Scenario simulator', null, [h('p', { text: 'Needs a baseline value first. With no measurement there is nothing to project from, and the lab will not invent one.' })]);
    var S = HL.state.sim, code = p.code, thr = HL.meta.metrics[code].thr || 1;
    if (S.unc == null) S.unc = +(HL.meta.metrics[code].rel ? thr * p.current : thr).toFixed(2) / 2;
    var out = h('div');
    function draw() {
      out.innerHTML = '';
      var pts = HL.econ.trajectory(p.current, S.rate, S.months, S.unc);
      var W = 640, H = 220, L = 50, R = 16, T = 16, B = 30;
      var lo = Math.min.apply(null, pts.map(function (q) { return q.lo; })), hi = Math.max.apply(null, pts.map(function (q) { return q.hi; }));
      if (hi === lo) { hi += 1; lo -= 1; }
      var X = function (i) { return L + (W - L - R) * i / S.months; }, Y = function (v) { return T + (H - T - B) * (1 - (v - lo) / (hi - lo)); };
      var svg = HL.s('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': 'Arithmetic projection from ' + HL.fmt(p.current, code) + ' at ' + S.rate + ' per month for ' + S.months + ' months.' });
      HL.ticks(lo, hi, 4).forEach(function (t) { svg.appendChild(HL.s('line', { class: 'gl', x1: L, x2: W - R, y1: Y(t), y2: Y(t) })); svg.appendChild(HL.s('text', { x: L - 6, y: Y(t) + 4, 'text-anchor': 'end' }, [HL.num(t, code)])); });
      svg.appendChild(HL.s('path', { d: 'M' + pts.map(function (q, i) { return X(i) + ',' + Y(q.hi); }).join('L') + 'L' + pts.slice().reverse().map(function (q, i) { return X(pts.length - 1 - i) + ',' + Y(q.lo); }).join('L') + 'Z', fill: 'var(--s2-wash)' }));
      svg.appendChild(HL.s('path', { d: 'M' + pts.map(function (q, i) { return X(i) + ',' + Y(q.mid); }).join('L'), fill: 'none', stroke: 'var(--s2)', 'stroke-width': 2, 'stroke-dasharray': '6 4' }));
      pts.forEach(function (q, i) { if (i % Math.max(1, Math.round(S.months / 6)) === 0 || i === S.months) svg.appendChild(HL.s('text', { x: X(i), y: H - 10, 'text-anchor': 'middle' }, [i === 0 ? 'now' : '+' + i + ' mo'])); });
      out.appendChild(h('div', { class: 'chart' }, [svg]));
      out.appendChild(h('p', { html: '<span class="lbl calc">Calculated result</span> ' + HL.esc(HL.fmt(pts[pts.length - 1].mid, code)) + ' after ' + S.months + ' months, range ' + HL.esc(HL.num(pts[pts.length - 1].lo, code) + '–' + HL.num(pts[pts.length - 1].hi, code)) + '.' }));
    }
    var inp = function (label, key, step, tag) {
      return h('label', null, [h('span', { html: HL.esc(label) + ' <span class="lbl ' + tag + '">' + (tag === 'ass' ? 'Your assumption' : 'Setting') + '</span>' }),
        h('input', { type: 'number', step: step, value: S[key], oninput: function (e) { var v = parseFloat(e.target.value); if (!isNaN(v)) { S[key] = key === 'months' ? Math.max(1, Math.min(24, Math.round(v))) : v; draw(); } } })]);
    };
    var c = HL.card('Scenario simulator', 'What would a steady change of your choosing add up to? <strong>This is arithmetic on your assumptions, not a prediction.</strong> Bodies do not change in straight lines, and nothing here knows how yours will respond.', [
      h('div', { class: 'inputs' }, [inp('Assumed change per month (' + HL.unit(code) + ')', 'rate', 'any', 'ass'), inp('Months', 'months', 1, ''), inp('Spread you allow, per month (±)', 'unc', 'any', 'ass')]),
      out,
      h('p', { class: 'note', text: 'Starts from your measured value (' + HL.fmt(p.current, code) + '). The band widens by the spread you set each month.' })]);
    draw();
    return c;
  }

  // ================================================================== ANNUAL
  HL.views.annual = function (root, d) {
    var redraw = function () { root.innerHTML = ''; HL.views.annual(root, d); };
    var A = d.annual[HL.state.preset];
    HL.vhead(root, 'Annual Health Review', 'Where was I, where am I, and what can — and can’t — I conclude?',
      HL.seg([['m', '30 days'], ['q', '90 days'], ['y', '1 year']], HL.state.preset, function (v) { HL.state.preset = v; redraw(); }, 'Comparison'));
    root.appendChild(h('p', { class: 'lede', text: A.label + '. Same season against same season where possible, so summer is not compared with winter.' }));
    var narr = h('div', { class: 'narr' }, A.narrative.map(function (x) { return h('div', null, [h('h4', { text: x.h }), h('p', { text: x.p })]); }));
    var codes = Object.keys(A.rows);
    var grid = h('div', { class: 'grid g-side' });
    grid.appendChild(HL.card('The review, in plain English', 'Written from the computed results below; nothing is added that the numbers do not show.', [narr,
      h('div', { class: 'btns noprint', style: 'margin-top:14px' }, [
        h('button', { type: 'button', class: 'btn', onclick: function () { HL.download('annual-health-review-' + d.profile.name.toLowerCase() + '-synthetic.md', markdown(d, A), 'text/markdown'); }, text: 'Download review (.md)' }),
        h('button', { type: 'button', class: 'btn ghost', onclick: function () { window.print(); }, text: 'Print or save as PDF' })])]));
    grid.appendChild(HL.card('Before and after', null, [HL.table(['Measure', 'Before', 'After', 'Status'], codes.map(function (c) {
      var x = A.rows[c]; return [HL.label(c), HL.fmt(x.prev, c), HL.fmt(x.cur, c), HL.status(x.status)];
    }), 'Before and after')]));
    root.appendChild(grid);
    root.appendChild(h('div', { style: 'height:16px' }));
    var mult = h('div', { class: 'mult' });
    var months = Object.keys(d.monthly[codes[0]] || {});
    codes.forEach(function (c) { mult.appendChild(multiple(d, c, A, HL.state.preset)); });
    root.appendChild(HL.card('Month by month', 'Monthly medians for two years. Shaded: the two periods being compared. A gap means no data that month, never zero.', [mult]));
  };

  function multiple(d, code, A, preset) {
    var mo = d.monthly[code], all = [], s = new Date(d.start + 'T12:00:00Z');
    for (var i = 0; i < 24; i++) { var dd = new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth() + i + 1, 1)); all.push(dd.toISOString().slice(0, 7)); }
    var vals = all.map(function (k) { return mo[k] ? mo[k].med : null; });
    var span = { m: 1, q: 3, y: 12 }[preset];
    var W = 240, H = 90, L = 4, R = 4, T = 8, B = 14;
    var v = vals.filter(function (x) { return x != null; });
    var lo = Math.min.apply(null, v), hi = Math.max.apply(null, v); if (lo === hi) { lo -= 1; hi += 1; }
    var X = function (i) { return L + (W - L - R) * i / 23; }, Y = function (x) { return T + (H - T - B) * (1 - (x - lo) / (hi - lo)); };
    var svg = HL.s('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': HL.label(code) + ' monthly medians: ' + A.rows[code].prev + ' before, ' + A.rows[code].cur + ' after.' });
    svg.appendChild(HL.s('rect', { x: X(24 - span) - 4, y: T, width: X(23) - X(24 - span) + 8, height: H - T - B, fill: 'var(--s1-wash)' }));
    svg.appendChild(HL.s('rect', { x: X(12 - span) - 4, y: T, width: X(11) - X(12 - span) + 8, height: H - T - B, fill: 'var(--surface-2)' }));
    var dpath = '', pen = false;
    vals.forEach(function (x, i) { if (x == null) { pen = false; return; } dpath += (pen ? 'L' : 'M') + X(i) + ',' + Y(x); pen = true; });
    svg.appendChild(HL.s('path', { d: dpath, fill: 'none', stroke: 'var(--s1)', 'stroke-width': 2 }));
    vals.forEach(function (x, i) { if (x != null) svg.appendChild(HL.s('circle', { cx: X(i), cy: Y(x), r: 2.2, fill: 'var(--s1)' })); });
    svg.appendChild(HL.s('text', { x: L, y: H - 2 }, [all[0]])); svg.appendChild(HL.s('text', { x: W - R, y: H - 2, 'text-anchor': 'end' }, [all[23]]));
    var x = A.rows[code], have = vals.filter(function (q) { return q != null; }).length;
    return h('div', { class: 'card' }, [h('p', { style: 'display:flex;justify-content:space-between;gap:8px;margin:0 0 4px' }, [h('strong', { style: 'font-size:13.5px', text: HL.label(code) }), HL.status(x.status)]),
      h('div', { class: 'chart' }, [svg]), h('p', { class: 'note', style: 'margin:2px 0 0', text: HL.fmt(x.prev, code) + ' → ' + HL.fmt(x.cur, code) + ' · ' + have + ' of 24 months with data' })]);
  }

  function markdown(d, A) {
    var L = ['# Annual Health Review — ' + d.profile.name + ' (synthetic)', '', '_Generated by the PaddySpeaks Health Intelligence Lab from fictional data, as of ' + d.as_of + '. Not medical advice._', '', '**' + A.label + '**', ''];
    A.narrative.forEach(function (x) { L.push('## ' + x.h, '', x.p, ''); });
    L.push('## Measurements', '', '| Measure | Before | After | Status |', '|---|---|---|---|');
    Object.keys(A.rows).forEach(function (c) { var x = A.rows[c]; L.push('| ' + HL.label(c) + ' | ' + HL.fmt(x.prev, c) + ' | ' + HL.fmt(x.cur, c) + ' | ' + HL.STATUS[x.status] + ' |'); });
    return L.join('\n') + '\n';
  }
})();
