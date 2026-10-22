/* Interactive demo C — The BLE whisper.
 * An illustrative duty-cycle model, not a measurement of any product:
 *     I_avg = (I_tx · t_on + I_sleep · (T − t_on)) / T + I_other
 *     life  ≈ C / I_avg            (no derating for pulse load, cold or ageing)
 * and an illustrative reception model: each listening phone hears one
 * advertising event with probability p = duty × q (q = radio environment),
 *     P(event heard by ≥ 1 of k phones) = 1 − (1 − p)^k
 *     P(heard at least once in a minute) = 1 − (1 − P_event)^(60 s / T)
 * The pure model (IEDemoC.model) is tested by invisible-engine/tests/demos.mjs.
 */
(function (root) {
  'use strict';
  var INTERVALS_MS = [20, 100, 250, 500, 1000, 2000, 5000, 10240];  // BLE allows 20 ms – 10.24 s

  function avgCurrentMa(p) {
    var T = p.intervalMs, on = Math.min(p.onMs, T);
    return (p.txMa * on + (p.sleepUa / 1000) * (T - on)) / T + p.otherUa / 1000;
  }
  function lifeHours(p) { return p.capacityMah / avgCurrentMa(p); }
  function pEvent(p) {
    var single = Math.max(0, Math.min(1, (p.dutyPct / 100) * p.quality));
    return 1 - Math.pow(1 - single, p.phones);
  }
  function pMinute(p) { return 1 - Math.pow(1 - pEvent(p), 60000 / p.intervalMs); }
  function meanWaitS(p) { var e = pEvent(p); return e > 0 ? (p.intervalMs / 1000) / e : Infinity; }
  var DEFAULTS = { intervalMs: 2000, onMs: 3, txMa: 6, sleepUa: 2, otherUa: 3, capacityMah: 220, phones: 1, dutyPct: 30, quality: 0.8 };
  var model = { avgCurrentMa: avgCurrentMa, lifeHours: lifeHours, pEvent: pEvent, pMinute: pMinute, meanWaitS: meanWaitS, DEFAULTS: DEFAULTS, INTERVALS_MS: INTERVALS_MS };
  root.IEDemoC = { model: model };

  if (typeof document === 'undefined') return;
  var NS = 'http://www.w3.org/2000/svg';
  function el(name, attrs, text) {
    var e = document.createElementNS(NS, name);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    return e;
  }
  function fmtLife(h) {
    if (!isFinite(h)) return '—';
    if (h < 48) return h.toFixed(0) + ' hours';
    var d = h / 24;
    if (d < 120) return d.toFixed(0) + ' days';
    return (d / 30.4).toFixed(1) + ' months';
  }
  function fmtWait(s) {
    if (!isFinite(s)) return 'never';
    if (s < 90) return s.toFixed(s < 10 ? 1 : 0) + ' s';
    return (s / 60).toFixed(1) + ' min';
  }

  function init() {
    var host = document.getElementById('demo-c');
    if (!host) return;
    var shown = host.querySelectorAll('[data-js]');
    for (var i = 0; i < shown.length; i++) shown[i].hidden = false;
    var ids = { interval: 'dc-int', on: 'dc-on', tx: 'dc-tx', sleep: 'dc-sleep', other: 'dc-other', phones: 'dc-phones', duty: 'dc-duty' };
    var inp = {};
    for (var k in ids) inp[k] = document.getElementById(ids[k]);
    var stage = document.getElementById('dc-stage');
    var read = document.getElementById('dc-read');
    var svg = el('svg', { viewBox: '0 0 1080 360', role: 'img', 'aria-labelledby': 'dc-svg-t' });
    svg.appendChild(el('title', { id: 'dc-svg-t' }, 'Transmit current against time for three advertising intervals, with the average current, and the listening phones.'));
    stage.appendChild(svg);

    function params() {
      return {
        intervalMs: INTERVALS_MS[+inp.interval.value], onMs: +inp.on.value, txMa: +inp.tx.value,
        sleepUa: +inp.sleep.value, otherUa: +inp.other.value, capacityMah: DEFAULTS.capacityMah,
        phones: +inp.phones.value, dutyPct: +inp.duty.value, quality: DEFAULTS.quality
      };
    }
    function out(id, txt) { var o = document.getElementById(id); if (o) o.textContent = txt; }

    function draw() {
      var p = params();
      out('dc-int-o', p.intervalMs >= 1000 ? (p.intervalMs / 1000) + ' s' : p.intervalMs + ' ms');
      out('dc-on-o', p.onMs + ' ms'); out('dc-tx-o', p.txMa + ' mA'); out('dc-sleep-o', p.sleepUa + ' µA');
      out('dc-other-o', p.otherUa + ' µA'); out('dc-phones-o', String(p.phones)); out('dc-duty-o', p.dutyPct + ' %');
      var iavg = avgCurrentMa(p), life = lifeHours(p), pe = pEvent(p), pm = pMinute(p);
      while (svg.childNodes.length > 1) svg.removeChild(svg.lastChild);
      // axes: current (log-ish visual) against time for three intervals
      var x0 = 70, x1 = 700, y0 = 300, yTop = 50;
      svg.appendChild(el('path', { d: 'M' + x0 + ',' + yTop + ' L' + x0 + ',' + y0 + ' L' + x1 + ',' + y0, fill: 'none', stroke: '#334155', 'stroke-width': 2 }));
      svg.appendChild(el('text', { x: x0 - 10, y: yTop - 14, 'font-size': 14, fill: '#334155' }, 'current'));
      svg.appendChild(el('text', { x: x1, y: y0 + 26, 'text-anchor': 'end', 'font-size': 14, fill: '#334155' }, 'time → (three advertising intervals, not to scale)'));
      var span = (x1 - x0 - 20) / 3, pulseW = Math.max(6, Math.min(40, span * p.onMs / Math.max(p.intervalMs, 1) * 30));
      var hTx = y0 - 70, hSleep = y0 - 6;
      var d = 'M' + x0 + ',' + hSleep;
      for (var n = 0; n < 3; n++) {
        var px = x0 + 20 + n * span;
        d += ' L' + px + ',' + hSleep + ' L' + px + ',' + hTx + ' L' + (px + pulseW) + ',' + hTx + ' L' + (px + pulseW) + ',' + hSleep;
      }
      d += ' L' + x1 + ',' + hSleep;
      svg.appendChild(el('path', { d: d, fill: 'none', stroke: '#c2410c', 'stroke-width': 3 }));
      svg.appendChild(el('text', { x: x0 + 28 + pulseW, y: hTx + 4, 'font-size': 13.5, fill: '#9a3412' }, 'advertising event: ' + p.txMa + ' mA for ' + p.onMs + ' ms'));
      svg.appendChild(el('text', { x: x0 + 28 + span, y: hSleep - 10, 'font-size': 13.5, fill: '#475569' }, 'sleep: ' + p.sleepUa + ' µA'));
      var yAvg = hSleep - Math.max(4, Math.min(56, 300 * iavg / p.txMa));
      svg.appendChild(el('path', { d: 'M' + x0 + ',' + yAvg + ' L' + x1 + ',' + yAvg, stroke: '#14213d', 'stroke-width': 2, 'stroke-dasharray': '8 6' }));
      svg.appendChild(el('text', { x: x1 - 4, y: yAvg - 8, 'text-anchor': 'end', 'font-size': 14, 'font-weight': 700, fill: '#14213d' }, 'average ≈ ' + (iavg * 1000).toFixed(1) + ' µA'));
      // listening phones
      var lx = 760;
      svg.appendChild(el('text', { x: lx, y: 46, 'font-size': 15, 'font-weight': 700, fill: '#14213d' }, 'Phones listening nearby'));
      for (var j = 0; j < p.phones; j++) {
        var py = 66 + j * 46;
        svg.appendChild(el('rect', { x: lx, y: py, width: 22, height: 38, rx: 5, fill: '#111827' }));
        svg.appendChild(el('rect', { x: lx + 3, y: py + 4, width: 16, height: 30, rx: 3, fill: '#e0f2fe' }));
        var bar = 200 * Math.min(1, (p.dutyPct / 100) * p.quality);
        svg.appendChild(el('rect', { x: lx + 34, y: py + 12, width: 200, height: 14, rx: 7, fill: '#e5e7eb' }));
        svg.appendChild(el('rect', { x: lx + 34, y: py + 12, width: Math.max(3, bar), height: 14, rx: 7, fill: '#1d4ed8' }));
      }
      svg.appendChild(el('text', { x: lx, y: 66 + p.phones * 46 + 14, 'font-size': 13.5, fill: '#475569' }, 'bar = chance one phone hears one event'));
      svg.appendChild(el('text', { x: lx, y: 66 + p.phones * 46 + 34, 'font-size': 13.5, fill: '#475569' }, 'No pairing: phones only listen.'));
      read.textContent =
        'Average current ≈ ' + (iavg * 1000).toFixed(1) + ' µA → a ' + p.capacityMah + ' mAh coin cell lasts about ' + fmtLife(life) + ' (illustrative, before derating).\n' +
        'Chance a single advertising event is heard by at least one of ' + p.phones + ' phone' + (p.phones > 1 ? 's' : '') + ': ' + (pe * 100).toFixed(0) + ' %. ' +
        'Heard at least once within a minute: ' + (pm * 100).toFixed(pm > 0.995 ? 1 : 0) + ' %. Typical wait: ' + fmtWait(meanWaitS(p)) + '.';
    }
    for (var key in inp) if (inp[key]) inp[key].addEventListener('input', draw);
    draw();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})(typeof window !== 'undefined' ? window : globalThis);
