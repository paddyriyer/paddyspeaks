/* Interactive demo A — Coil powers chip.
 * A qualitative model, not a calibrated one: relative coupling is the on-axis
 * field of one circular loop of radius R, normalised to 1 at d = 0,
 *     k(d) = (R² / (R² + d²))^(3/2)
 * and the chip is drawn as powered above an illustrative threshold. The pure
 * model (IEDemoA.model) is tested by invisible-engine/tests/demos.mjs.
 */
(function (root) {
  'use strict';
  var R_CM = 3;            // loop radius, cm (illustrative)
  var THRESHOLD = 0.3;     // relative coupling needed to run the chip (illustrative)

  function coupling(dCm, r) {
    var R = r || R_CM;
    var d = Math.max(0, dCm);
    return Math.pow((R * R) / (R * R + d * d), 1.5);
  }
  function powered(dCm) { return coupling(dCm) >= THRESHOLD; }
  function maxRangeCm() {
    // solve (R²/(R²+d²))^1.5 = T  ->  d = R * sqrt(T^(-2/3) - 1)
    return R_CM * Math.sqrt(Math.pow(THRESHOLD, -2 / 3) - 1);
  }
  var model = { coupling: coupling, powered: powered, maxRangeCm: maxRangeCm, R_CM: R_CM, THRESHOLD: THRESHOLD };
  root.IEDemoA = { model: model };

  if (typeof document === 'undefined') return;

  var NS = 'http://www.w3.org/2000/svg';
  function el(name, attrs, text) {
    var e = document.createElementNS(NS, name);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    return e;
  }

  function init() {
    var host = document.getElementById('demo-a');
    if (!host) return;
    var shown = host.querySelectorAll('[data-js]');
    for (var i = 0; i < shown.length; i++) shown[i].hidden = false;
    var slider = document.getElementById('da-dist');
    var out = document.getElementById('da-d');
    var read = document.getElementById('da-read');
    var stage = document.getElementById('da-stage');
    var view = 'energy';

    var svg = el('svg', { viewBox: '0 0 1080 380', role: 'img', 'aria-labelledby': 'da-svg-t' });
    svg.appendChild(el('title', { id: 'da-svg-t' }, 'Reader, card and chip; the picture updates as you move the card.'));
    stage.appendChild(svg);

    function draw() {
      var d = slider.value / 10; // 0..10 cm
      var k = coupling(d);
      var on = k >= THRESHOLD;
      out.textContent = d.toFixed(1) + ' cm';
      while (svg.childNodes.length > 1) svg.removeChild(svg.lastChild);
      // reader
      svg.appendChild(el('rect', { x: 30, y: 60, width: 170, height: 260, rx: 22, fill: '#1f2937' }));
      svg.appendChild(el('rect', { x: 48, y: 80, width: 134, height: 90, rx: 10, fill: '#e0f2fe' }));
      svg.appendChild(el('text', { x: 115, y: 132, 'text-anchor': 'middle', 'font-size': 18, 'font-weight': 700, fill: '#0c4a6e' }, 'Reader'));
      svg.appendChild(el('rect', { x: 196, y: 120, width: 12, height: 140, rx: 4, fill: '#b45309' }));
      svg.appendChild(el('text', { x: 115, y: 350, 'text-anchor': 'middle', 'font-size': 15, fill: '#334155' }, '13.56 MHz coil'));
      // card position: 0 cm at x=230, 10 cm at x=760
      var cx = 230 + d * 53;
      // field rings (illustrative), opacity falls with coupling at the card
      for (var r = 1; r <= 3; r++) {
        svg.appendChild(el('path', { d: 'M208,' + (190 - r * 45) + ' A' + (r * 60) + ',' + (r * 45) + ' 0 0 1 208,' + (190 + r * 45), fill: 'none', stroke: '#1d4ed8', 'stroke-width': 2, 'stroke-dasharray': '6 6', opacity: 0.7 }));
      }
      // card
      svg.appendChild(el('rect', { x: cx, y: 110, width: 210, height: 132, rx: 12, fill: '#1e3a8a' }));
      svg.appendChild(el('rect', { x: cx + 14, y: 122, width: 120, height: 108, rx: 8, fill: 'none', stroke: '#f59e0b', 'stroke-width': 3 }));
      svg.appendChild(el('rect', { x: cx + 54, y: 158, width: 40, height: 34, rx: 5, fill: on ? '#fcd34d' : '#94a3b8', stroke: '#713f12', 'stroke-width': 2 }));
      svg.appendChild(el('text', { x: cx + 105, y: 268, 'text-anchor': 'middle', 'font-size': 15, fill: '#334155' }, 'card · no battery'));
      // coupling meter
      svg.appendChild(el('text', { x: 800, y: 70, 'font-size': 16, 'font-weight': 700, fill: '#14213d' }, 'Relative coupling'));
      svg.appendChild(el('rect', { x: 800, y: 84, width: 170, height: 18, rx: 9, fill: '#e5e7eb' }));
      svg.appendChild(el('rect', { x: 800, y: 84, width: Math.max(4, 170 * k), height: 18, rx: 9, fill: '#c2410c' }));
      svg.appendChild(el('line', { x1: 800 + 170 * THRESHOLD, y1: 78, x2: 800 + 170 * THRESHOLD, y2: 108, stroke: '#14213d', 'stroke-width': 2 }));
      svg.appendChild(el('text', { x: 800, y: 126, 'font-size': 13, fill: '#475569' }, 'line = illustrative threshold'));

      var y = 170, lines = [];
      function step(txt, col, ok) {
        svg.appendChild(el('circle', { cx: 808, cy: y - 5, r: 7, fill: ok ? col : '#cbd5e1' }));
        svg.appendChild(el('text', { x: 822, y: y, 'font-size': 14.5, fill: ok ? '#14213d' : '#6b7280' }, txt));
        lines.push((ok ? '✓ ' : '✗ ') + txt);
        y += 26;
      }
      if (view === 'energy') {
        step('field reaches the coil', '#c2410c', k > 0.02);
        step('AC voltage induced', '#c2410c', k > 0.05);
        step('rectified to DC', '#c2410c', on);
        step('regulated supply', '#c2410c', on);
        step('chip powered', '#c2410c', on);
        svg.appendChild(el('path', { d: 'M210,180 L' + (cx - 6) + ',180', stroke: '#c2410c', 'stroke-width': 2 + 6 * k, opacity: Math.max(0.15, k) }));
      } else if (view === 'data') {
        step('reader sends a command (dips)', '#1d4ed8', on);
        step('card demodulates it', '#15803d', on);
        step('card load-modulates a reply', '#1d4ed8', on);
        step('reader decodes the reply', '#15803d', on);
        if (on) {
          svg.appendChild(el('path', { d: 'M210,150 L' + (cx - 6) + ',150', stroke: '#1d4ed8', 'stroke-width': 4 }));
          svg.appendChild(el('path', { d: 'M' + (cx - 6) + ',210 L210,210', stroke: '#1d4ed8', 'stroke-width': 4, 'stroke-dasharray': '10 6' }));
        }
      } else {
        step('card computes a fresh cryptogram', '#7e22ce', on);
        step('secret key stays inside the chip', '#7e22ce', on);
        step('issuer checks it later (not the reader)', '#7e22ce', on);
        svg.appendChild(el('text', { x: 808, y: y + 10, 'font-size': 13.5, fill: '#b91c1c' }, 'Being close is not proof of who you are.'));
      }
      read.textContent = 'Distance ' + d.toFixed(1) + ' cm. Relative coupling ' + k.toFixed(2) + ' (threshold ' + THRESHOLD + '). ' +
        (on ? 'The chip is powered. ' : 'Too little energy reaches the chip: it stays off and cannot answer. ') + lines.join('; ') + '.';
    }

    slider.addEventListener('input', draw);
    var btns = host.querySelectorAll('[data-view]');
    for (var b = 0; b < btns.length; b++) {
      btns[b].addEventListener('click', function () {
        view = this.getAttribute('data-view');
        for (var j = 0; j < btns.length; j++) btns[j].setAttribute('aria-pressed', btns[j] === this ? 'true' : 'false');
        draw();
      });
    }
    draw();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})(typeof window !== 'undefined' ? window : globalThis);
