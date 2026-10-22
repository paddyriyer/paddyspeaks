/* Interactive demo D — How a lost tag is found.
 * The facts (steps, parties, who sees what) are in lost.json; the static table and
 * step list in the page are written from the same file by
 * scripts/invisible_engine/content/inserts.py. This script only adds the step
 * scrubber, the picture and the per-party highlight. Tested by tests/demos.mjs.
 */
(function () {
  'use strict';
  if (typeof document === 'undefined') return;
  var NS = 'http://www.w3.org/2000/svg';
  function el(name, attrs, text) {
    var e = document.createElementNS(NS, name);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    return e;
  }
  var COL = { signal: '#1d4ed8', crypto: '#7e22ce', plain: '#15803d', ink: '#14213d', muted: '#475569' };

  function arrow(svg, d, col, dash) {
    var a = { d: d, fill: 'none', stroke: col, 'stroke-width': 4, 'marker-end': 'url(#dd-m-' + col.slice(1) + ')' };
    if (dash) a['stroke-dasharray'] = dash;
    svg.appendChild(el('path', a));
  }

  function init() {
    var host = document.getElementById('demo-d');
    if (!host) return;
    var shown = host.querySelectorAll('[data-js]');
    for (var i = 0; i < shown.length; i++) shown[i].hidden = false;
    var slider = document.getElementById('dd-step');
    var out = document.getElementById('dd-step-o');
    var read = document.getElementById('dd-read');
    var stage = document.getElementById('dd-stage');
    var steps = host.querySelectorAll('#dd-steps li');
    var rows = host.querySelectorAll('#dd-table tbody tr');
    var picks = host.querySelectorAll('[data-pick]');
    var picked = null;

    var svg = el('svg', { viewBox: '0 0 1080 330', role: 'img', 'aria-labelledby': 'dd-svg-t' });
    svg.appendChild(el('title', { id: 'dd-svg-t' }, 'A station with a suitcase and a passer-by, the relay service, and the owner at home; the active step is highlighted.'));
    var defs = el('defs', {});
    [COL.signal, COL.crypto, COL.plain].forEach(function (c) {
      var m = el('marker', { id: 'dd-m-' + c.slice(1), viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 5, markerHeight: 5, orient: 'auto' });
      m.appendChild(el('path', { d: 'M0,0 L10,5 L0,10 Z', fill: c }));
      defs.appendChild(m);
    });
    svg.appendChild(defs);
    stage.appendChild(svg);
    var layer = el('g', {});
    svg.appendChild(layer);

    function place(x, w, title, on) {
      layer.appendChild(el('rect', { x: x, y: 20, width: w, height: 290, rx: 14, fill: on ? '#f8fafc' : '#ffffff', stroke: on ? COL.ink : '#cbd5e1', 'stroke-width': on ? 3 : 1.5 }));
      layer.appendChild(el('text', { x: x + 16, y: 46, 'font-size': 15, 'font-weight': 700, fill: COL.ink }, title));
    }
    function draw() {
      var n = +slider.value;
      out.textContent = n + ' of ' + steps.length;
      while (layer.firstChild) layer.removeChild(layer.firstChild);
      place(10, 470, 'Station (the suitcase is here)', n <= 2);
      place(500, 250, 'Relay service', n === 3);
      place(770, 300, 'Owner, far away', n === 4);
      // suitcase + tag
      layer.appendChild(el('rect', { x: 60, y: 140, width: 90, height: 120, rx: 12, fill: '#0e7490' }));
      layer.appendChild(el('path', { d: 'M85,140 L85,116 L125,116 L125,140', fill: 'none', stroke: '#334155', 'stroke-width': 5 }));
      layer.appendChild(el('circle', { cx: 160, cy: 200, r: 22, fill: '#f8fafc', stroke: '#94a3b8', 'stroke-width': 3 }));
      layer.appendChild(el('text', { x: 105, y: 290, 'text-anchor': 'middle', 'font-size': 13, fill: COL.muted }, 'tag: no GPS, no mobile link'));
      for (var r = 1; r <= 3; r++) layer.appendChild(el('path', { d: 'M' + (186 + r * 12) + ',' + (186 - r * 10) + ' q' + (8 + r * 5) + ',' + (14 + r * 10) + ' 0,' + (28 + r * 20), fill: 'none', stroke: COL.signal, 'stroke-width': 3, opacity: 1 - r * 0.2 }));
      // passer-by
      if (n >= 2) {
        layer.appendChild(el('circle', { cx: 360, cy: 110, r: 18, fill: '#475569' }));
        layer.appendChild(el('rect', { x: 336, y: 132, width: 48, height: 92, rx: 14, fill: '#475569' }));
        layer.appendChild(el('rect', { x: 386, y: 160, width: 16, height: 28, rx: 4, fill: '#111827' }));
        layer.appendChild(el('text', { x: 360, y: 250, 'text-anchor': 'middle', 'font-size': 13, fill: COL.muted }, 'passer-by’s phone'));
        layer.appendChild(el('text', { x: 360, y: 268, 'text-anchor': 'middle', 'font-size': 13, fill: COL.muted }, 'uses its OWN location'));
        arrow(layer, 'M230,200 L330,182', COL.signal);
        layer.appendChild(el('rect', { x: 404, y: 96, width: 56, height: 40, rx: 6, fill: '#f5f3ff', stroke: COL.crypto, 'stroke-width': 2.5 }));
        layer.appendChild(el('path', { d: 'M404,100 L432,120 L460,100', fill: 'none', stroke: COL.crypto, 'stroke-width': 2.5 }));
      }
      if (n >= 3) {
        arrow(layer, 'M462,116 C500,80 560,80 600,120', COL.crypto);
        layer.appendChild(el('rect', { x: 560, y: 150, width: 130, height: 110, rx: 10, fill: '#e2e8f0', stroke: '#334155', 'stroke-width': 2 }));
        layer.appendChild(el('text', { x: 625, y: 190, 'text-anchor': 'middle', 'font-size': 13, fill: COL.ink }, 'sealed report'));
        layer.appendChild(el('text', { x: 625, y: 210, 'text-anchor': 'middle', 'font-size': 13, fill: COL.ink }, 'filed under'));
        layer.appendChild(el('text', { x: 625, y: 230, 'text-anchor': 'middle', 'font-size': 13, fill: COL.ink }, 'a lookup value'));
        layer.appendChild(el('text', { x: 625, y: 290, 'text-anchor': 'middle', 'font-size': 13, fill: COL.muted }, 'cannot open it'));
      }
      if (n >= 4) {
        arrow(layer, 'M692,200 L850,200', COL.crypto);
        layer.appendChild(el('rect', { x: 860, y: 110, width: 70, height: 130, rx: 12, fill: '#111827' }));
        layer.appendChild(el('rect', { x: 866, y: 118, width: 58, height: 114, rx: 8, fill: '#e0f2fe' }));
        layer.appendChild(el('path', { d: 'M895,200 C878,176 878,156 895,154 C912,156 912,176 895,200 Z', fill: '#2563eb' }));
        layer.appendChild(el('text', { x: 950, y: 160, 'font-size': 13, fill: COL.plain, 'font-weight': 700 }, 'opened here,'));
        layer.appendChild(el('text', { x: 950, y: 178, 'font-size': 13, fill: COL.plain, 'font-weight': 700 }, 'on the device'));
        layer.appendChild(el('text', { x: 950, y: 206, 'font-size': 13, fill: COL.muted }, 'estimated place'));
        layer.appendChild(el('text', { x: 950, y: 224, 'font-size': 13, fill: COL.muted }, '+ a time'));
      }
      for (var s = 0; s < steps.length; s++) steps[s].classList.toggle('on', s === n - 1);
      for (var r2 = 0; r2 < rows.length; r2++) rows[r2].classList.toggle('now', +rows[r2].getAttribute('data-from') === n);
      read.textContent = 'Step ' + n + ': ' + steps[n - 1].textContent;
    }
    function pick(id) {
      picked = picked === id ? null : id;
      for (var b = 0; b < picks.length; b++) picks[b].setAttribute('aria-pressed', picks[b].getAttribute('data-pick') === picked ? 'true' : 'false');
      var cells = host.querySelectorAll('#dd-table [data-actor]');
      for (var c = 0; c < cells.length; c++) cells[c].classList.toggle('on', cells[c].getAttribute('data-actor') === picked);
    }
    slider.addEventListener('input', draw);
    for (var k = 0; k < picks.length; k++) picks[k].addEventListener('click', function () { pick(this.getAttribute('data-pick')); });
    draw();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
