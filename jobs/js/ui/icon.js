/**
 * JobSignal — inline stroke icons.
 *
 * SVG built node by node, never innerHTML: these sit alongside third-party job
 * text and the no-innerHTML rule for jobs/js/ is enforced by a test.
 */
(function (global) {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';

  var PATHS = {
    search:   [['circle', { cx: 11, cy: 11, r: 7 }], ['line', { x1: 21, y1: 21, x2: 16.7, y2: 16.7 }]],
    pin:      [['path', { d: 'M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z' }], ['circle', { cx: 12, cy: 10, r: 3 }]],
    chevron:  [['polyline', { points: '6 9 12 15 18 9' }]],
    close:    [['line', { x1: 6, y1: 6, x2: 18, y2: 18 }], ['line', { x1: 18, y1: 6, x2: 6, y2: 18 }]],
    menu:     [['line', { x1: 4, y1: 7, x2: 20, y2: 7 }], ['line', { x1: 4, y1: 12, x2: 20, y2: 12 }], ['line', { x1: 4, y1: 17, x2: 20, y2: 17 }]],
    heart:    [['path', { d: 'M20.8 5.6a5 5 0 0 0-7.1 0L12 7.3l-1.7-1.7a5 5 0 1 0-7.1 7.1l8.8 8.8 8.8-8.8a5 5 0 0 0 0-7.1Z' }]],
    warn:     [['path', { d: 'M12 9v5' }], ['path', { d: 'M10.3 3.9 2.6 17.2A2 2 0 0 0 4.3 20.2h15.4a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z' }], ['circle', { cx: 12, cy: 17.4, r: 0.6 }]],
    check:    [['polyline', { points: '4 12 10 18 20 6' }]],
    circle:   [['circle', { cx: 12, cy: 12, r: 7 }]],
    bolt:     [['path', { d: 'M13 2 4 14h6l-1 8 9-12h-6l1-8Z' }]],
    external: [['path', { d: 'M14 4h6v6' }], ['path', { d: 'M20 4 11 13' }], ['path', { d: 'M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5' }]],
    sliders:  [['line', { x1: 4, y1: 7, x2: 20, y2: 7 }], ['line', { x1: 4, y1: 12, x2: 20, y2: 12 }], ['line', { x1: 4, y1: 17, x2: 20, y2: 17 }], ['circle', { cx: 9, cy: 7, r: 2 }], ['circle', { cx: 15, cy: 12, r: 2 }], ['circle', { cx: 8, cy: 17, r: 2 }]],
    back:     [['line', { x1: 20, y1: 12, x2: 5, y2: 12 }], ['polyline', { points: '11 6 5 12 11 18' }]]
  };

  var FILLED = { bolt: true };

  function icon(name, size, opts) {
    var o = opts || {};
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('width', size || 16);
    svg.setAttribute('height', size || 16);
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    var filled = FILLED[name] || o.filled;
    svg.setAttribute('fill', filled ? 'currentColor' : 'none');
    if (!filled) {
      svg.setAttribute('stroke', 'currentColor');
      svg.setAttribute('stroke-width', o.weight || 2);
      svg.setAttribute('stroke-linecap', 'round');
      svg.setAttribute('stroke-linejoin', 'round');
    }
    (PATHS[name] || []).forEach(function (spec) {
      var el = document.createElementNS(NS, spec[0]);
      Object.keys(spec[1]).forEach(function (k) { el.setAttribute(k, spec[1][k]); });
      if (spec[0] === 'circle' && name === 'warn') { el.setAttribute('fill', 'currentColor'); el.setAttribute('stroke', 'none'); }
      svg.appendChild(el);
    });
    return svg;
  }

  global.JSIcon = icon;
})(window);
