/* Interactive demo I — Grover with four drawers.
 * Four drawers, one marked. Start with equal amplitudes +1/2; the oracle flips the marked
 * amplitude to −1/2 (mean 1/4); diffusion reflects every amplitude about the mean, giving
 * +1 for the marked drawer and 0 for the others. Signed amplitude bars and probability
 * bars side by side. A second view shows why N = 4 is a toy: for N items the success
 * probability after k rounds is sin²((2k+1)θ) with sin θ = 1/√N, best near (π/4)√N.
 * Uses qsim.js (window.IEQ); the model (IEDemoI.model) is tested by tests/demos.mjs.
 */
(function (root) {
  'use strict';
  function successAfter(N, k) { var th = Math.asin(1 / Math.sqrt(N)); return Math.pow(Math.sin((2 * k + 1) * th), 2); }
  function bestRounds(N) { return Math.round(Math.PI / (4 * Math.asin(1 / Math.sqrt(N))) - 0.5); }
  root.IEDemoI = { model: { successAfter: successAfter, bestRounds: bestRounds } };
  if (typeof document === 'undefined') return;

  var NS = 'http://www.w3.org/2000/svg';
  function el(n, a, t) { var e = document.createElementNS(NS, n); for (var k in a) e.setAttribute(k, a[k]); if (t != null) e.textContent = t; return e; }

  function init() {
    var host = document.getElementById('demo-i');
    if (!host || !root.IEQ) return;
    var Q = root.IEQ;
    var shown = host.querySelectorAll('[data-js]');
    for (var i = 0; i < shown.length; i++) shown[i].hidden = false;
    var stage = document.getElementById('di-stage'), read = document.getElementById('di-read'), curve = document.getElementById('di-curve');
    var marked = 2, step = 0;
    var NAMES = ['Start: equal amplitudes', 'Oracle: flip the marked sign', 'Diffusion: reflect about the mean', 'Measure'];
    var svg = el('svg', { viewBox: '0 0 1080 360', role: 'img', 'aria-labelledby': 'di-t' });
    svg.appendChild(el('title', { id: 'di-t' }, 'Four drawers with signed amplitude bars and probability bars.'));
    stage.appendChild(svg);

    function state() {
      var s = Q.uniform(2);
      if (step >= 1) s = Q.oracle(s, marked);
      if (step >= 2) s = Q.diffuse(s);
      return s;
    }
    function draw() {
      var s = state(), pr = Q.probs(s), m = Q.mean(s)[0];
      while (svg.childNodes.length > 1) svg.removeChild(svg.lastChild);
      var zero = 170, scale = 120;
      svg.appendChild(el('text', { x: 20, y: 28, 'font-size': 16, 'font-weight': 700, fill: '#14213d' }, 'Amplitude (signed)'));
      svg.appendChild(el('text', { x: 600, y: 28, 'font-size': 16, 'font-weight': 700, fill: '#14213d' }, 'Probability = amplitude²'));
      svg.appendChild(el('path', { d: 'M20,' + zero + ' H520', stroke: '#94a3b8', 'stroke-width': 1.5 }));
      for (var k = 0; k < 4; k++) {
        var a = s[k][0], x = 50 + k * 115, h = a * scale;
        svg.appendChild(el('rect', { x: x, y: h >= 0 ? zero - h : zero, width: 70, height: Math.max(1, Math.abs(h)), rx: 4, fill: k === marked ? '#7c3aed' : '#94a3b8' }));
        svg.appendChild(el('text', { x: x + 35, y: h >= 0 ? zero - h - 8 : zero - h + 20, 'text-anchor': 'middle', 'font-size': 14, fill: '#14213d' }, (a >= 0 ? '+' : '−') + Math.abs(a).toFixed(2)));
        svg.appendChild(el('rect', { x: x + 5, y: 300, width: 60, height: 40, rx: 6, fill: k === marked ? '#ede9fe' : '#f1f5f9', stroke: k === marked ? '#7c3aed' : '#94a3b8', 'stroke-width': 2 }));
        svg.appendChild(el('text', { x: x + 35, y: 326, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 700, fill: '#14213d' }, 'drawer ' + (k + 1)));
        var px = 600 + k * 115, ph = pr[k] * 220;
        svg.appendChild(el('rect', { x: px, y: 280 - ph, width: 70, height: Math.max(1, ph), rx: 4, fill: k === marked ? '#15803d' : '#86efac' }));
        svg.appendChild(el('text', { x: px + 35, y: 300, 'text-anchor': 'middle', 'font-size': 14, fill: '#14213d' }, pr[k].toFixed(2)));
      }
      if (step === 1 || step === 2) {
        var my = zero - (step === 1 ? m : Q.mean(Q.oracle(Q.uniform(2), marked))[0]) * scale;
        svg.appendChild(el('path', { d: 'M30,' + my + ' H510', stroke: '#c2410c', 'stroke-width': 2, 'stroke-dasharray': '8 6' }));
        svg.appendChild(el('text', { x: 516, y: my + 5, 'font-size': 13, fill: '#9a3412' }, 'mean ' + (step === 1 ? m : 0.25).toFixed(2)));
      }
      var msg = 'Step ' + step + ': ' + NAMES[step] + '. ';
      if (step === 0) msg += 'All four amplitudes are +1/2, so each drawer has probability 1/4.';
      if (step === 1) msg += 'The marked amplitude is now −1/2. Probabilities have not changed yet; the mean is 1/4.';
      if (step === 2) msg += 'Each amplitude a becomes 2·(1/4) − a: the marked one goes to +1, the others to 0.';
      if (step === 3) { var got = Q.sample(state()); msg += 'Opened drawer ' + (got + 1) + (got === marked ? ': the marked one, as it will be every time for four drawers.' : '.'); }
      read.textContent = msg;
      host.querySelectorAll('[data-mark]').forEach(function (b) { b.setAttribute('aria-pressed', +b.getAttribute('data-mark') === marked ? 'true' : 'false'); });
    }
    function drawCurve() {
      var N = +document.getElementById('di-n').value;
      document.getElementById('di-n-o').textContent = N + ' items';
      var best = bestRounds(N), rows = [];
      for (var k = 0; k <= Math.min(best + 2, 12); k++) rows.push('round ' + k + ': ' + (successAfter(N, k) * 100).toFixed(1) + '%' + (k === best ? '  ← best' : ''));
      curve.textContent = 'Chance of finding the marked item among ' + N + ' after k rounds (one oracle query per round):\n' + rows.join('\n') +
        '\nBest near (π/4)·√' + N + ' ≈ ' + (Math.PI / 4 * Math.sqrt(N)).toFixed(1) + ' rounds — and going past it makes things worse. A classical search needs about ' + (N / 2) + ' looks on average.';
    }
    host.addEventListener('click', function (ev) {
      var b = ev.target.closest('button'); if (!b) return;
      if (b.hasAttribute('data-mark')) { marked = +b.getAttribute('data-mark'); step = 0; }
      if (b.dataset.step === 'next') step = Math.min(3, step + 1);
      if (b.dataset.step === 'back') step = Math.max(0, step - 1);
      if (b.dataset.step === 'reset') step = 0;
      draw();
    });
    document.getElementById('di-n').addEventListener('input', drawCurve);
    draw(); drawCurve();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})(typeof window !== 'undefined' ? window : globalThis);
