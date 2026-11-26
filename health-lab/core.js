/* Health Intelligence Lab — core: data, routing, formatting, chart primitives.
   Classic script (no modules) so the page works the same everywhere.
   Every value drawn here was computed by healthlab/ (Python) and shipped in
   data/*.json; this file formats and draws, it does not decide. */
(function () {
  'use strict';
  var HL = window.HL = { views: {}, order: [], meta: null, data: null, cache: {}, state: { view: 'overview', pid: 'a' } };

  HL.VIEWS = [
    ['overview', 'Health Overview'], ['activity', 'Activity Effectiveness'], ['trends', 'Health Trends'],
    ['cohorts', 'Cohort Explorer'], ['signals', 'Health Signals'], ['goals', 'Goal Studio'],
    ['annual', 'Annual Health Review'], ['provider', 'Provider Connect'], ['sources', 'Data Sources'],
    ['privacy', 'Import & Privacy'], ['anonymity', 'Can It Be Anonymous?'], ['rights', 'My Data Rights'],
    ['economics', 'Coverage & Economics']
  ];

  // ------------------------------------------------------------------ dom
  HL.h = function (tag, attrs, kids) {
    var el = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      var v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'text') el.textContent = v;
      else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    }
    (kids || []).forEach(function (c) { if (c != null) el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return el;
  };
  HL.esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var SVGNS = 'http://www.w3.org/2000/svg';
  HL.s = function (tag, attrs, kids) {
    var el = document.createElementNS(SVGNS, tag);
    if (attrs) for (var k in attrs) if (attrs[k] != null) el.setAttribute(k, attrs[k]);
    (kids || []).forEach(function (c) { if (c != null) el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return el;
  };

  // ------------------------------------------------------------------ format
  HL.unit = function (code) { var m = HL.meta.metrics[code]; if (!m) return ''; return m.unit === '/min' ? '/min' : m.unit.replace('count/d', 'steps/day').replace('min/d', 'min/day'); };
  HL.label = function (code) { var m = HL.meta.metrics[code]; return m ? m.label : code; };
  HL.num = function (v, code) {
    if (v == null) return '—';
    var dec = { steps: 0, exercise_min: 0, systolic: 0, diastolic: 0, steadiness: 0, hrv_rmssd: 0, glucose_cgm: 0, ldl: 0, walking_speed: 2, sleep_hours: 2 }[code];
    if (dec == null) dec = Math.abs(v) >= 100 ? 0 : 1;
    return Number(v).toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  };
  HL.signed = function (v, code) { var t = HL.num(Math.abs(v), code); return /^[0.,]+$/.test(t) ? '±0' : (v > 0 ? '+' : '−') + t; };
  HL.fmt = function (v, code) { return v == null ? '—' : HL.num(v, code) + ' ' + HL.unit(code); };
  HL.date = function (iso, opt) {
    if (!iso) return '—';
    var d = new Date(iso.slice(0, 10) + 'T12:00:00Z');
    return d.toLocaleDateString('en-US', Object.assign({ month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }, opt || {}));
  };
  HL.dayIndexDate = function (i) { var d = new Date(HL.data.start + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + i); return d.toISOString().slice(0, 10); };
  HL.kindLabel = { measured: 'Measured', estimated: 'Estimated', device: 'External device', clinician_verified: 'Clinician-verified', patient_reported: 'You entered' };
  HL.kind = function (k) { return HL.h('span', { class: 'kind ' + k, text: HL.kindLabel[k] || k }); };

  var ICON = {
    improving: '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2 8l4-4 4 4" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
    declining: '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
    stable: '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2 6h8" stroke="currentColor" stroke-width="2"/></svg>',
    changed: '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2 6h8M7 3l3 3-3 3" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
    insufficient: '<svg viewBox="0 0 12 12" aria-hidden="true"><circle cx="6" cy="6" r="4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-dasharray="2 2"/></svg>'
  };
  HL.STATUS = { improving: 'Improving', declining: 'Declining', stable: 'Stable', changed: 'Changed (no goal set)', insufficient: 'Insufficient evidence' };
  HL.status = function (s) { s = s || 'insufficient'; return HL.h('span', { class: 'st ' + s, html: ICON[s] + HL.esc(HL.STATUS[s]) }); };
  var TICON = { observed: '○', context: '◐', discuss: '◆', urgent: '▲' };
  HL.TIER = { observed: 'Observed change', context: 'Requires context', discuss: 'Worth discussing', urgent: 'Potential urgency' };
  HL.tier = function (t) { return HL.h('span', { class: 'tier ' + t, html: '<span aria-hidden="true">' + TICON[t] + '</span>' + HL.TIER[t] }); };

  HL.card = function (title, sub, kids, cls) {
    return HL.h('section', { class: 'card ' + (cls || '') }, [title ? HL.h('h3', { text: title }) : null, sub ? HL.h('p', { class: 'sub', html: sub }) : null].concat(kids || []));
  };
  HL.table = function (head, rows, caption) {
    return HL.h('div', { class: 'tblwrap', tabindex: '0', role: 'region', 'aria-label': caption || 'Data table' }, [
      HL.h('table', null, [
        caption ? HL.h('caption', { class: 'vh', text: caption }) : null,
        HL.h('thead', null, [HL.h('tr', null, head.map(function (x) { return HL.h('th', { scope: 'col', text: x }); }))]),
        HL.h('tbody', null, rows.map(function (r) { return HL.h('tr', null, r.map(function (c, i) { return typeof c === 'object' && c && c.nodeType ? HL.h('td', null, [c]) : HL.h(i ? 'td' : 'th', i ? { text: c == null ? '—' : String(c) } : { scope: 'row', text: c == null ? '—' : String(c) }); })); }))
      ])
    ]);
  };
  HL.alt = function (summary, node) { return HL.h('details', { class: 'alt' }, [HL.h('summary', { text: summary || 'Show as a table' }), node]); };
  HL.seg = function (opts, cur, onpick, label) {
    return HL.h('div', { class: 'seg', role: 'group', 'aria-label': label || '' }, opts.map(function (o) {
      return HL.h('button', { type: 'button', 'aria-pressed': String(String(o[0]) === String(cur)), text: o[1], onclick: function () { onpick(o[0]); } });
    }));
  };

  // ------------------------------------------------------------------ scales
  function ext(arrs) {
    var lo = Infinity, hi = -Infinity;
    arrs.forEach(function (a) { (a || []).forEach(function (v) { if (v != null) { if (v < lo) lo = v; if (v > hi) hi = v; } }); });
    if (lo === Infinity) { lo = 0; hi = 1; }
    if (lo === hi) { lo -= 1; hi += 1; }
    var pad = (hi - lo) * 0.08; return [lo - pad, hi + pad];
  }
  function ticks(lo, hi, n) {
    var step = Math.pow(10, Math.floor(Math.log10((hi - lo) / n)));
    [1, 2, 2.5, 5, 10].some(function (m) { if ((hi - lo) / (step * m) <= n) { step *= m; return true; } return false; });
    var out = []; for (var v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(+v.toFixed(6));
    return out;
  }
  HL.ticks = ticks;

  // ------------------------------------------------------------------ line chart (dates)
  /* opts: {dates:[iso], series:[{key,label,values,color,mode:'dots'|'line',width}], band:{lo,hi,label}, refBand:{lo,hi,label},
            shade:[{from,to,label}], code, height, aria, yDomain} */
  HL.lineChart = function (o) {
    var W = 860, H = o.height || 280, L = 52, R = 14, T = 14, B = 30;
    var n = o.dates.length;
    var all = o.series.map(function (s) { return s.values; });
    if (o.band) all.push(o.band.lo, o.band.hi);
    if (o.refBand) all.push([o.refBand.lo, o.refBand.hi]);
    var dom = o.yDomain || ext(all);
    var x = function (i) { return L + (W - L - R) * (n <= 1 ? 0.5 : i / (n - 1)); };
    var y = function (v) { return T + (H - T - B) * (1 - (v - dom[0]) / (dom[1] - dom[0])); };
    var svg = HL.s('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': o.aria || '' });
    (o.shade || []).forEach(function (s) {
      var a = Math.max(0, s.from), b = Math.min(n - 1, s.to);
      if (b < a) return;
      svg.appendChild(HL.s('rect', { x: x(a), y: T, width: Math.max(1, x(b) - x(a)), height: H - T - B, fill: s.fill || 'var(--surface-2)' }));
      if (s.label) svg.appendChild(HL.s('text', { x: x(a) + 4, y: T + 12 }, [s.label]));
    });
    ticks(dom[0], dom[1], 4).forEach(function (t) {
      svg.appendChild(HL.s('line', { class: 'gl', x1: L, x2: W - R, y1: y(t), y2: y(t) }));
      svg.appendChild(HL.s('text', { x: L - 6, y: y(t) + 4, 'text-anchor': 'end' }, [HL.num(t, o.code)]));
    });
    svg.appendChild(HL.s('line', { class: 'ax', x1: L, x2: W - R, y1: H - B, y2: H - B }));
    // month ticks
    var lastM = '';
    o.dates.forEach(function (d, i) {
      var m = d.slice(0, 7);
      if (m !== lastM && d.slice(8) <= '07') {
        lastM = m;
        var mo = +d.slice(5, 7);
        if (n < 120 || mo % 3 === 1) svg.appendChild(HL.s('text', { x: x(i), y: H - 10, 'text-anchor': 'middle' }, [HL.date(d, { month: 'short', day: undefined, year: mo === 1 ? 'numeric' : undefined })]));
      }
    });
    if (o.refBand) {
      svg.appendChild(HL.s('rect', { x: L, width: W - L - R, y: y(o.refBand.hi), height: Math.max(1, y(o.refBand.lo) - y(o.refBand.hi)), fill: 'var(--s2-wash)' }));
    }
    if (o.band) {
      var top = [], bot = [];
      for (var i = 0; i < n; i++) if (o.band.lo[i] != null && o.band.hi[i] != null) { top.push([x(i), y(o.band.hi[i])]); bot.unshift([x(i), y(o.band.lo[i])]); }
      // break the band where data stop
      var segs = [], cur = [];
      for (var j = 0; j < n; j++) {
        if (o.band.lo[j] != null) cur.push(j); else if (cur.length) { segs.push(cur); cur = []; }
      }
      if (cur.length) segs.push(cur);
      segs.forEach(function (sg) {
        var d = 'M' + sg.map(function (k) { return x(k).toFixed(1) + ',' + y(o.band.hi[k]).toFixed(1); }).join('L') +
          'L' + sg.slice().reverse().map(function (k) { return x(k).toFixed(1) + ',' + y(o.band.lo[k]).toFixed(1); }).join('L') + 'Z';
        svg.appendChild(HL.s('path', { d: d, fill: 'var(--s1-wash)' }));
      });
    }
    o.series.forEach(function (s) {
      if (s.mode === 'dots') {
        var g = HL.s('g', { fill: s.color, opacity: s.opacity || 0.55 });
        s.values.forEach(function (v, i) { if (v != null) g.appendChild(HL.s('circle', { cx: x(i).toFixed(1), cy: y(v).toFixed(1), r: s.r || 1.8 })); });
        svg.appendChild(g);
      } else {
        var d = '', pen = false;
        s.values.forEach(function (v, i) { if (v == null) { pen = false; return; } d += (pen ? 'L' : 'M') + x(i).toFixed(1) + ',' + y(v).toFixed(1); pen = true; });
        svg.appendChild(HL.s('path', { d: d, fill: 'none', stroke: s.color, 'stroke-width': s.width || 2, 'stroke-linejoin': 'round', 'stroke-dasharray': s.dash || null }));
      }
    });
    (o.marks || []).forEach(function (m) {
      svg.appendChild(HL.s('line', { x1: x(m.i), x2: x(m.i), y1: T, y2: H - B, stroke: 'var(--ink-3)', 'stroke-dasharray': '3 3' }));
      if (m.label) svg.appendChild(HL.s('text', { x: x(m.i) + 4, y: H - B - 6 }, [m.label]));
    });
    // hover layer
    var wrap = HL.h('div', { class: 'chart' });
    var tip = HL.h('div', { class: 'tip', role: 'presentation' });
    var cross = HL.s('line', { y1: T, y2: H - B, stroke: 'var(--ink-3)', 'stroke-width': 1, opacity: 0 });
    svg.appendChild(cross);
    var hit = HL.s('rect', { x: L, y: T, width: W - L - R, height: H - T - B, fill: 'transparent' });
    svg.appendChild(hit);
    function show(ev) {
      var r = svg.getBoundingClientRect(), px = (ev.clientX - r.left) * W / r.width;
      var i = Math.round((px - L) / (W - L - R) * (n - 1)); i = Math.max(0, Math.min(n - 1, i));
      var parts = [HL.date(o.dates[i])];
      o.series.forEach(function (s) { if (s.values[i] != null) parts.push(s.label + ': ' + HL.fmt(s.values[i], o.code)); });
      if (o.band && o.band.lo[i] != null) parts.push((o.band.label || 'Middle half') + ': ' + HL.num(o.band.lo[i], o.code) + '–' + HL.num(o.band.hi[i], o.code));
      tip.innerHTML = parts.map(HL.esc).join('<br>');
      tip.style.left = (x(i) / W * 100) + '%'; tip.style.top = '12px'; tip.classList.add('on');
      cross.setAttribute('x1', x(i)); cross.setAttribute('x2', x(i)); cross.setAttribute('opacity', 0.6);
    }
    hit.addEventListener('pointermove', show);
    hit.addEventListener('pointerleave', function () { tip.classList.remove('on'); cross.setAttribute('opacity', 0); });
    wrap.appendChild(svg); wrap.appendChild(tip);
    var leg = HL.h('div', { class: 'legend' });
    o.series.forEach(function (s) { if (s.label) leg.appendChild(HL.h('span', null, [HL.h('i', { class: s.mode === 'dots' ? 'dot' : '', style: 'background:' + s.color }), s.label])); });
    if (o.band) leg.appendChild(HL.h('span', null, [HL.h('i', { class: 'band', style: 'background:var(--s1-wash)' }), o.band.label || 'Middle half of the last 28 days']));
    if (o.refBand) leg.appendChild(HL.h('span', null, [HL.h('i', { class: 'band', style: 'background:var(--s2-wash)' }), o.refBand.label]));
    (o.shade || []).forEach(function (s) { if (s.legend) leg.appendChild(HL.h('span', null, [HL.h('i', { class: 'band', style: 'background:' + (s.fill || 'var(--surface-2)') + ';outline:1px solid var(--rule)' }), s.legend])); });
    wrap.appendChild(leg);
    return wrap;
  };

  // ------------------------------------------------------------------ sparkline
  HL.spark = function (vals, opts) {
    opts = opts || {};
    var W = 140, H = 34, v = vals.filter(function (a) { return a != null; });
    if (opts.compact) vals = v;
    var svg = HL.s('svg', { viewBox: '0 0 ' + W + ' ' + H, width: W, height: H, 'aria-hidden': 'true', class: 'spark' });
    if (v.length < 2) { svg.appendChild(HL.s('text', { x: 0, y: 22, fill: 'var(--ink-3)', 'font-size': 11 }, ['no trend'])); return svg; }
    var dom = ext([vals]), n = vals.length;
    var d = '', pen = false;
    vals.forEach(function (a, i) { if (a == null) { pen = false; return; } d += (pen ? 'L' : 'M') + (i / (n - 1) * W).toFixed(1) + ',' + (2 + (H - 4) * (1 - (a - dom[0]) / (dom[1] - dom[0]))).toFixed(1); pen = true; });
    svg.appendChild(HL.s('path', { d: d, fill: 'none', stroke: 'var(--s1)', 'stroke-width': 1.6 }));
    return svg;
  };

  // ------------------------------------------------------------------ bars (weekly)
  HL.bars = function (o) {
    var W = o.width || 860, H = o.height || 220, L = 46, R = 10, T = 12, B = 28, n = o.values.length;
    var hi = Math.max.apply(null, o.values.concat([o.line || 0])) * 1.1 || 1;
    var bw = (W - L - R) / n;
    var y = function (v) { return T + (H - T - B) * (1 - v / hi); };
    var svg = HL.s('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': o.aria || '' });
    ticks(0, hi, 4).forEach(function (t) {
      svg.appendChild(HL.s('line', { class: 'gl', x1: L, x2: W - R, y1: y(t), y2: y(t) }));
      svg.appendChild(HL.s('text', { x: L - 6, y: y(t) + 4, 'text-anchor': 'end' }, [String(t)]));
    });
    var wrap = HL.h('div', { class: 'chart' }), tip = HL.h('div', { class: 'tip' });
    o.values.forEach(function (v, i) {
      var x0 = L + i * bw + 1, h = Math.max(0, y(0) - y(v));
      var met = o.line != null && v >= o.line;
      var rect = HL.s('rect', { x: x0, y: y(v), width: Math.max(1, bw - 2), height: h, rx: Math.min(4, bw / 3), fill: met ? 'var(--s1)' : 'var(--axis)' });
      svg.appendChild(rect);
      var hit = HL.s('rect', { x: L + i * bw, y: T, width: bw, height: H - T - B, fill: 'transparent' });
      hit.addEventListener('pointerenter', function () {
        tip.innerHTML = HL.esc(o.labels[i]) + '<br>' + HL.esc(o.fmt ? o.fmt(v, i) : v);
        tip.style.left = ((x0 + bw / 2) / W * 100) + '%'; tip.style.top = '8px'; tip.classList.add('on');
      });
      hit.addEventListener('pointerleave', function () { tip.classList.remove('on'); });
      svg.appendChild(hit);
      if (o.tick && o.tick(i)) svg.appendChild(HL.s('text', { x: x0 + bw / 2, y: H - 10, 'text-anchor': 'middle' }, [o.tick(i)]));
    });
    svg.appendChild(HL.s('line', { class: 'ax', x1: L, x2: W - R, y1: y(0), y2: y(0) }));
    if (o.line != null) {
      svg.appendChild(HL.s('line', { x1: L, x2: W - R, y1: y(o.line), y2: y(o.line), stroke: 'var(--ink)', 'stroke-dasharray': '5 4', 'stroke-width': 1.2 }));
      svg.appendChild(HL.s('text', { x: W - R, y: y(o.line) - 5, 'text-anchor': 'end', class: 'ttl' }, [o.lineLabel || '']));
    }
    wrap.appendChild(svg); wrap.appendChild(tip);
    if (o.legend) wrap.appendChild(HL.h('div', { class: 'legend', html: o.legend }));
    return wrap;
  };

  // ------------------------------------------------------------------ scatter
  HL.scatter = function (o) {
    var W = o.width || 860, H = o.height || 300, L = 52, R = 14, T = 14, B = 40;
    var xs = o.points.map(function (p) { return p.x; }), ys = o.points.map(function (p) { return p.y; });
    var dx = ext([xs]), dy = ext([ys]);
    var X = function (v) { return L + (W - L - R) * (v - dx[0]) / (dx[1] - dx[0]); };
    var Y = function (v) { return T + (H - T - B) * (1 - (v - dy[0]) / (dy[1] - dy[0])); };
    var svg = HL.s('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': o.aria || '' });
    ticks(dy[0], dy[1], 4).forEach(function (t) { svg.appendChild(HL.s('line', { class: 'gl', x1: L, x2: W - R, y1: Y(t), y2: Y(t) })); svg.appendChild(HL.s('text', { x: L - 6, y: Y(t) + 4, 'text-anchor': 'end' }, [String(t)])); });
    ticks(dx[0], dx[1], 6).forEach(function (t) { svg.appendChild(HL.s('text', { x: X(t), y: H - 22, 'text-anchor': 'middle' }, [String(t)])); });
    svg.appendChild(HL.s('text', { x: (L + W) / 2, y: H - 4, 'text-anchor': 'middle' }, [o.xLabel || '']));
    svg.appendChild(HL.s('text', { x: 12, y: T + 4, transform: 'rotate(-90 12 ' + (T + 4) + ')', 'text-anchor': 'end' }, [o.yLabel || '']));
    var wrap = HL.h('div', { class: 'chart' }), tip = HL.h('div', { class: 'tip' });
    o.points.forEach(function (p) {
      var c = HL.s('circle', { cx: X(p.x), cy: Y(p.y), r: 4, fill: p.color, stroke: 'var(--surface)', 'stroke-width': 1.5, opacity: 0.85 });
      c.addEventListener('pointerenter', function () { tip.innerHTML = HL.esc(p.tip); tip.style.left = (X(p.x) / W * 100) + '%'; tip.style.top = (Y(p.y) / H * 100) + '%'; tip.classList.add('on'); });
      c.addEventListener('pointerleave', function () { tip.classList.remove('on'); });
      svg.appendChild(c);
    });
    (o.lines || []).forEach(function (ln) {
      svg.appendChild(HL.s('line', { x1: X(dx[0]), x2: X(dx[1]), y1: Y(ln.a + ln.b * dx[0]), y2: Y(ln.a + ln.b * dx[1]), stroke: ln.color, 'stroke-width': 2 }));
    });
    wrap.appendChild(svg); wrap.appendChild(tip);
    if (o.legend) wrap.appendChild(HL.h('div', { class: 'legend', html: o.legend }));
    return wrap;
  };

  // ------------------------------------------------------------------ box (percentiles)
  HL.box = function (o) {
    // o.p = [p5,p10,p25,p50,p75,p90,p95], o.value, o.trend [values], o.code, o.domain
    var W = 860, H = 150, L = 20, R = 20, T = 30, B = 34;
    var dom = o.domain || ext([o.p, [o.value]]);
    var X = function (v) { return L + (W - L - R) * (v - dom[0]) / (dom[1] - dom[0]); };
    var svg = HL.s('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': o.aria || '' });
    var p = o.p, yc = (T + H - B) / 2;
    ticks(dom[0], dom[1], 6).forEach(function (t) { svg.appendChild(HL.s('line', { class: 'gl', x1: X(t), x2: X(t), y1: T - 6, y2: H - B })); svg.appendChild(HL.s('text', { x: X(t), y: H - 14, 'text-anchor': 'middle' }, [HL.num(t, o.code)])); });
    svg.appendChild(HL.s('line', { x1: X(p[0]), x2: X(p[6]), y1: yc, y2: yc, stroke: 'var(--ink-3)', 'stroke-width': 1.5 }));
    svg.appendChild(HL.s('rect', { x: X(p[1]), width: X(p[5]) - X(p[1]), y: yc - 14, height: 28, fill: 'var(--s2-wash)', rx: 4 }));
    svg.appendChild(HL.s('rect', { x: X(p[2]), width: X(p[4]) - X(p[2]), y: yc - 20, height: 40, fill: 'none', stroke: 'var(--s2)', 'stroke-width': 2, rx: 4 }));
    svg.appendChild(HL.s('line', { x1: X(p[3]), x2: X(p[3]), y1: yc - 20, y2: yc + 20, stroke: 'var(--s2)', 'stroke-width': 3 }));
    [[0, '5th'], [3, 'median'], [6, '95th']].forEach(function (a) { svg.appendChild(HL.s('text', { x: X(p[a[0]]), y: yc + 34, 'text-anchor': 'middle' }, [a[1]])); });
    if (o.value != null) {
      svg.appendChild(HL.s('line', { x1: X(o.value), x2: X(o.value), y1: T - 10, y2: H - B, stroke: 'var(--s1)', 'stroke-width': 3 }));
      svg.appendChild(HL.s('circle', { cx: X(o.value), cy: yc, r: 7, fill: 'var(--s1)', stroke: 'var(--surface)', 'stroke-width': 2 }));
      svg.appendChild(HL.s('text', { x: X(o.value), y: T - 14, 'text-anchor': 'middle', class: 'ttl' }, ['You: ' + HL.fmt(o.value, o.code)]));
    }
    var wrap = HL.h('div', { class: 'chart' }, [svg]);
    wrap.appendChild(HL.h('div', { class: 'legend', html: '<span><i class="dot" style="background:var(--s1)"></i>Your last-90-day median</span><span><i class="band" style="background:var(--s2-wash);outline:2px solid var(--s2)"></i>Cohort: middle half (box), 10th–90th (shaded), 5th–95th (whiskers)</span>' }));
    return wrap;
  };

  // ------------------------------------------------------------------ routing + boot
  function parse() {
    var m = location.hash.replace(/^#\/?/, '').split('/');
    var v = HL.VIEWS.some(function (x) { return x[0] === m[0]; }) ? m[0] : 'overview';
    var p = /^[a-e]$/.test(m[1] || '') ? m[1] : HL.state.pid;
    return { view: v, pid: p };
  }
  HL.go = function (view, pid) { location.hash = '#/' + (view || HL.state.view) + '/' + (pid || HL.state.pid); };

  function load(pid) {
    if (HL.cache[pid]) return Promise.resolve(HL.cache[pid]);
    return fetch('data/profile-' + pid + '.json').then(function (r) { return r.json(); }).then(function (d) { HL.cache[pid] = d; return d; });
  }

  function chrome() {
    var ps = document.getElementById('personas'); ps.innerHTML = '';
    HL.meta.profiles.forEach(function (p) {
      ps.appendChild(HL.h('button', { type: 'button', class: 'persona', 'aria-pressed': String(p.id === HL.state.pid), onclick: function () { HL.go(null, p.id); } },
        [HL.h('b', { text: p.name + ', ' + p.age }), HL.h('span', { text: p.headline })]));
    });
    var vs = document.getElementById('views'); vs.innerHTML = '';
    HL.VIEWS.forEach(function (v) {
      vs.appendChild(HL.h('a', { href: '#/' + v[0] + '/' + HL.state.pid, 'aria-current': v[0] === HL.state.view ? 'page' : null, text: v[1] }));
    });
  }

  function render(focus) {
    var st = parse();
    var changedView = st.view !== HL.state.view;
    HL.state.view = st.view; HL.state.pid = st.pid;
    chrome();
    load(st.pid).then(function (d) {
      HL.data = d;
      var root = document.getElementById('view');
      root.innerHTML = '';
      try { HL.views[st.view](root, d); }
      catch (e) { root.appendChild(HL.h('p', { text: 'Something went wrong drawing this view: ' + e.message })); console.error(e); }
      var title = HL.VIEWS.filter(function (v) { return v[0] === st.view; })[0][1];
      document.title = title + ' · ' + d.profile.name + ' · Health Intelligence Lab | PaddySpeaks';
      if (focus && changedView) { var h2 = root.querySelector('h2'); if (h2) { h2.setAttribute('tabindex', '-1'); h2.focus({ preventScroll: true }); } }
    });
  }

  HL.boot = function () {
    var t = document.getElementById('theme');
    t.addEventListener('click', function () {
      var cur = document.documentElement.getAttribute('data-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      var next = cur === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      try { localStorage.setItem('hlab.theme', next); } catch (e) { /* storage unavailable: theme still switches */ }
      render(false);
    });
    fetch('data/meta.json').then(function (r) { return r.json(); }).then(function (m) {
      HL.meta = m;
      window.addEventListener('hashchange', function () { render(true); });
      render(false);
    });
  };

  // shared helpers for views
  HL.series = function (code) { return HL.data.series[code]; };
  HL.dates = function () { var out = []; for (var i = 0; i < HL.data.days; i++) out.push(HL.dayIndexDate(i)); return out; };
  HL.vhead = function (root, title, q, right) {
    root.appendChild(HL.h('div', { class: 'vhead' }, [HL.h('div', null, [HL.h('h2', { text: title }), HL.h('p', { class: 'q', text: q })]), right || null]));
  };
  HL.download = function (name, text, type) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: type || 'text/plain' }));
    a.download = name; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  };
})();
