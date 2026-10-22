/* Interactive demo G — Relative phase lab.
 * Two views of one idea, with the labels switching visibly between them:
 *  · Water-wave analogy: y = sin(ωt) + sin(ωt + φ); the sum's peak is 2|cos(φ/2)|.
 *  · Quantum amplitudes: (|0⟩ + e^{iφ}|1⟩)/√2, then H; amplitude of |0⟩ is (1 + e^{iφ})/2,
 *    so P(0) = cos²(φ/2) and P(1) = sin²(φ/2).
 * The same cosine appears in both, which is the point — and the analogy stops there.
 * The pure model (IEDemoG.model) is tested by tests/demos.mjs.
 */
(function (root) {
  'use strict';
  function waveSum(t, phi) { return Math.sin(t) + Math.sin(t + phi); }
  function wavePeak(phi) { return 2 * Math.abs(Math.cos(phi / 2)); }
  function quantum(phi) {
    var a0 = [(1 + Math.cos(phi)) / 2, Math.sin(phi) / 2], a1 = [(1 - Math.cos(phi)) / 2, -Math.sin(phi) / 2];
    return { a0: a0, a1: a1, p0: a0[0] * a0[0] + a0[1] * a0[1], p1: a1[0] * a1[0] + a1[1] * a1[1] };
  }
  root.IEDemoG = { model: { waveSum: waveSum, wavePeak: wavePeak, quantum: quantum } };
  if (typeof document === 'undefined') return;

  var NS = 'http://www.w3.org/2000/svg';
  function el(n, a, t) { var e = document.createElementNS(NS, n); for (var k in a) e.setAttribute(k, a[k]); if (t != null) e.textContent = t; return e; }

  function init() {
    var host = document.getElementById('demo-g');
    if (!host) return;
    var shown = host.querySelectorAll('[data-js]');
    for (var i = 0; i < shown.length; i++) shown[i].hidden = false;
    var slider = document.getElementById('dg-phi'), out = document.getElementById('dg-phi-o');
    var read = document.getElementById('dg-read'), stage = document.getElementById('dg-stage');
    var modes = host.querySelectorAll('[data-mode]'), mode = 'wave';
    var svg = el('svg', { viewBox: '0 0 1080 380', role: 'img', 'aria-labelledby': 'dg-t' });
    svg.appendChild(el('title', { id: 'dg-t' }, 'Two inputs and their sum, or two amplitude arrows and their resultant, for the chosen phase.'));
    stage.appendChild(svg);

    function draw() {
      var deg = +slider.value, phi = deg * Math.PI / 180;
      out.textContent = deg + '°';
      while (svg.childNodes.length > 1) svg.removeChild(svg.lastChild);
      var tag = el('rect', { x: 10, y: 10, width: mode === 'wave' ? 300 : 340, height: 34, rx: 8, fill: mode === 'wave' ? '#dbeafe' : '#ede9fe' });
      svg.appendChild(tag);
      svg.appendChild(el('text', { x: 24, y: 33, 'font-size': 16, 'font-weight': 700, fill: mode === 'wave' ? '#1d4ed8' : '#6d28d9' },
        mode === 'wave' ? 'WATER-WAVE ANALOGY' : 'QUANTUM AMPLITUDE MATHEMATICS'));
      if (mode === 'wave') {
        var x0 = 40, x1 = 1040, ym = 210, A = 60;
        svg.appendChild(el('path', { d: 'M' + x0 + ',' + ym + ' H' + x1, stroke: '#cbd5e1', 'stroke-width': 1.5 }));
        function curve(f, col, w, dash) {
          var d = '';
          for (var x = 0; x <= 400; x++) { var t = x / 400 * 4 * Math.PI, X = x0 + (x1 - x0) * x / 400, Y = ym - A * f(t); d += (x ? ' L' : 'M') + X.toFixed(1) + ',' + Y.toFixed(1); }
          var a = { d: d, fill: 'none', stroke: col, 'stroke-width': w }; if (dash) a['stroke-dasharray'] = dash;
          svg.appendChild(el('path', a));
        }
        curve(function (t) { return Math.sin(t); }, '#93c5fd', 2.5, '8 6');
        curve(function (t) { return Math.sin(t + phi); }, '#60a5fa', 2.5, '2 5');
        curve(function (t) { return waveSum(t, phi); }, '#1d4ed8', 4);
        svg.appendChild(el('text', { x: x0, y: 360, 'font-size': 14.5, fill: '#334155' }, 'dashed: the two waves · solid: their sum (computed point by point)'));
        read.textContent = 'Phase ' + deg + '°: the sum peaks at ' + wavePeak(phi).toFixed(2) + ' (each wave peaks at 1). ' +
          (wavePeak(phi) < 0.01 ? 'Crest meets trough: they cancel.' : wavePeak(phi) > 1.99 ? 'Crests meet: they add.' : 'Partly adding, partly cancelling.') +
          ' Intensity goes as the square of the amplitude, so the energy at the peak is ' + (wavePeak(phi) * wavePeak(phi)).toFixed(2) + ' times one wave’s.';
      } else {
        var q = quantum(phi), cx = 260, cy = 210, S = 120;
        svg.appendChild(el('path', { d: 'M' + (cx - 170) + ',' + cy + ' H' + (cx + 290) + ' M' + cx + ',' + (cy - 160) + ' V' + (cy + 150), stroke: '#cbd5e1', 'stroke-width': 1.5 }));
        svg.appendChild(el('text', { x: cx + 292, y: cy + 18, 'font-size': 13, fill: '#475569' }, 'real'));
        svg.appendChild(el('text', { x: cx + 6, y: cy - 150, 'font-size': 13, fill: '#475569' }, 'imaginary'));
        function arrow(x1, y1, x2, y2, col, w) {
          svg.appendChild(el('path', { d: 'M' + x1 + ',' + y1 + ' L' + x2 + ',' + y2, stroke: col, 'stroke-width': w }));
          var ang = Math.atan2(y2 - y1, x2 - x1), h = 12;
          svg.appendChild(el('path', { d: 'M' + x2 + ',' + y2 + ' L' + (x2 - h * Math.cos(ang - 0.4)) + ',' + (y2 - h * Math.sin(ang - 0.4)) + ' L' + (x2 - h * Math.cos(ang + 0.4)) + ',' + (y2 - h * Math.sin(ang + 0.4)) + ' Z', fill: col }));
        }
        // 1 + e^{iφ}, head to tail, each of length S; resultant halved = amplitude of |0⟩ after H
        var ex = cx + S, ey = cy, fx = ex + S * Math.cos(phi), fy = ey - S * Math.sin(phi);
        arrow(cx, cy, ex, ey, '#a78bfa', 4);
        arrow(ex, ey, fx, fy, '#7c3aed', 4);
        if (Math.hypot(fx - cx, fy - cy) > 6) arrow(cx, cy, fx, fy, '#14213d', 3);
        svg.appendChild(el('text', { x: cx + 20, y: cy + 26, 'font-size': 14, fill: '#6d28d9' }, '1'));
        var lab = el('text', { x: (ex + fx) / 2 + 8, y: (ey + fy) / 2 - 6, 'font-size': 15, fill: '#6d28d9' }, 'e');
        lab.appendChild(el('tspan', { dy: -7, 'font-size': 11 }, 'iφ'));
        svg.appendChild(lab);
        // probability bars
        var bx = 680;
        [['P(0) = cos²(φ/2)', q.p0], ['P(1) = sin²(φ/2)', q.p1]].forEach(function (r, k) {
          var y = 120 + k * 110;
          svg.appendChild(el('text', { x: bx, y: y - 12, 'font-size': 16, 'font-weight': 700, fill: '#14213d' }, r[0] + ' = ' + r[1].toFixed(3)));
          svg.appendChild(el('rect', { x: bx, y: y, width: 340, height: 26, rx: 6, fill: '#e5e7eb' }));
          svg.appendChild(el('rect', { x: bx, y: y, width: Math.max(2, 340 * r[1]), height: 26, rx: 6, fill: '#15803d' }));
        });
        svg.appendChild(el('text', { x: bx, y: 350, 'font-size': 14, fill: '#334155' }, 'Probabilities are never negative; amplitudes can cancel.'));
        read.textContent = 'Relative phase ' + deg + '°. Start in (|0⟩ + e^(iφ)|1⟩)/√2, then apply H: the amplitude of |0⟩ is (1 + e^(iφ))/2, the dark arrow halved. ' +
          'P(0) = ' + q.p0.toFixed(3) + ', P(1) = ' + q.p1.toFixed(3) + '. A phase applied to both parts at once (global phase) would rotate both arrows together and change nothing measurable.';
      }
    }
    slider.addEventListener('input', draw);
    for (var m = 0; m < modes.length; m++) modes[m].addEventListener('click', function () {
      mode = this.getAttribute('data-mode');
      for (var k = 0; k < modes.length; k++) modes[k].setAttribute('aria-pressed', modes[k] === this ? 'true' : 'false');
      draw();
    });
    draw();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})(typeof window !== 'undefined' ? window : globalThis);
