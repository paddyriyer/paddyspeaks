/* Interactive demo H — Step through a circuit.
 * Presets: H→Z→H, H→phase(φ)→H, and a Bell pair (H then CNOT); or build a one-qubit
 * circuit from X, Z, H and S. At each step: the state vector (signed/complex amplitudes),
 * the probabilities, their sum (always 1 for ideal gates), and the gate's rule.
 * Uses the tested simulator in qsim.js (window.IEQ). Measurement is a separate action.
 */
(function (root) {
  'use strict';
  var PRESETS = {
    hzh: { n: 1, label: 'H → Z → H', ops: [['H', 0], ['Z', 0], ['H', 0]] },
    phase: { n: 1, label: 'H → phase(φ) → H', ops: [['H', 0], ['P', 0], ['H', 0]] },
    bell: { n: 2, label: 'Bell pair: H, then CNOT', ops: [['H', 0], ['CNOT', 0, 1]] },
    custom: { n: 1, label: 'Build your own (one qubit)', ops: [] }
  };
  var RULES = {
    H: 'H: |0⟩ → (|0⟩+|1⟩)/√2, |1⟩ → (|0⟩−|1⟩)/√2',
    Z: 'Z: |0⟩ → |0⟩, |1⟩ → −|1⟩ (a phase flip; probabilities unchanged)',
    X: 'X: swaps |0⟩ and |1⟩ (a bit flip)',
    S: 'S: |1⟩ → i|1⟩ (a quarter-turn of phase)',
    P: 'phase(φ): |1⟩ → e^{iφ}|1⟩',
    CNOT: 'CNOT: flips the second qubit when the first is 1'
  };
  function run(Q, preset, upto, phi) {
    var s = Q.zero(preset.n);
    for (var k = 0; k < upto; k++) {
      var op = preset.ops[k];
      if (op[0] === 'CNOT') s = Q.cnot(s, preset.n, op[1], op[2]);
      else s = Q.apply1(s, preset.n, op[1], op[0] === 'P' ? Q.P(phi) : Q.GATES[op[0]]);
    }
    return s;
  }
  root.IEDemoH = { PRESETS: PRESETS, run: run };
  if (typeof document === 'undefined') return;

  function fmt(a) {
    var re = Math.abs(a[0]) < 5e-10 ? 0 : a[0], im = Math.abs(a[1]) < 5e-10 ? 0 : a[1];
    if (!im) return (re >= 0 ? '+' : '−') + Math.abs(re).toFixed(3);
    if (!re) return (im >= 0 ? '+' : '−') + Math.abs(im).toFixed(3) + 'i';
    return (re >= 0 ? '+' : '−') + Math.abs(re).toFixed(3) + (im >= 0 ? ' + ' : ' − ') + Math.abs(im).toFixed(3) + 'i';
  }
  function init() {
    var host = document.getElementById('demo-h');
    if (!host || !root.IEQ) return;
    var Q = root.IEQ;
    var shown = host.querySelectorAll('[data-js]');
    for (var i = 0; i < shown.length; i++) shown[i].hidden = false;
    var circ = document.getElementById('dh-circ'), table = document.getElementById('dh-state'), read = document.getElementById('dh-read');
    var phiIn = document.getElementById('dh-phi'), phiOut = document.getElementById('dh-phi-o'), phiRow = document.getElementById('dh-phi-row');
    var shots = document.getElementById('dh-shots'), pal = document.getElementById('dh-pal');
    var cur = 'hzh', step = 0, custom = PRESETS.custom;

    function render() {
      var p = PRESETS[cur], phi = +phiIn.value * Math.PI / 180;
      phiOut.textContent = phiIn.value + '°';
      phiRow.hidden = cur !== 'phase';
      pal.hidden = cur !== 'custom';
      circ.innerHTML = '';
      var start = document.createElement('span'); start.className = 'q-ket'; start.textContent = p.n === 1 ? '|0⟩' : '|00⟩'; circ.appendChild(start);
      p.ops.forEach(function (op, k) {
        var g = document.createElement('span');
        g.className = 'q-gate' + (k < step ? ' done' : '') + (k === step - 1 ? ' now' : '');
        g.textContent = op[0] === 'CNOT' ? 'CNOT' : op[0] === 'P' ? 'φ' : op[0] + (p.n > 1 ? '₀' : '');
        circ.appendChild(g);
      });
      if (!p.ops.length) { var e = document.createElement('span'); e.className = 'q-empty'; e.textContent = 'add gates below'; circ.appendChild(e); }
      var s = run(Q, p, step, phi), pr = Q.probs(s);
      var rows = '<tr><th scope="col">Basis state</th><th scope="col">Amplitude</th><th scope="col">Probability</th></tr>';
      s.forEach(function (a, k) {
        rows += '<tr><th scope="row">' + Q.label(p.n, k) + '</th><td class="mono">' + fmt(a) + '</td><td><span class="pbar"><span style="width:' + (pr[k] * 100).toFixed(1) + '%"></span></span> ' + pr[k].toFixed(3) + '</td></tr>';
      });
      rows += '<tr><th scope="row">Sum</th><td></td><td class="mono">' + Q.norm(s).toFixed(6) + '</td></tr>';
      table.innerHTML = rows;
      var op = step ? p.ops[step - 1] : null;
      read.textContent = 'Step ' + step + ' of ' + p.ops.length + '. ' + (op ? RULES[op[0]] + '.' : 'Start: every circuit begins in ' + (p.n === 1 ? '|0⟩' : '|00⟩') + '.') +
        ' Probabilities add to ' + Q.norm(s).toFixed(3) + '.' + (cur === 'phase' && step === 3 ? ' Check: cos²(φ/2) = ' + Math.pow(Math.cos(phi / 2), 2).toFixed(3) + '.' : '');
      shots.textContent = '';
    }
    host.addEventListener('click', function (ev) {
      var b = ev.target.closest('button'); if (!b) return;
      var p = PRESETS[cur];
      if (b.hasAttribute('data-preset')) { cur = b.getAttribute('data-preset'); step = 0;
        host.querySelectorAll('[data-preset]').forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); }); }
      else if (b.dataset.step === 'next') step = Math.min(p.ops.length, step + 1);
      else if (b.dataset.step === 'back') step = Math.max(0, step - 1);
      else if (b.dataset.step === 'reset') { step = 0; if (cur === 'custom') custom.ops = []; }
      else if (b.hasAttribute('data-gate')) { if (custom.ops.length < 8) { custom.ops.push([b.getAttribute('data-gate'), 0]); step = custom.ops.length; } }
      else if (b.dataset.step === 'measure') {
        render();
        var s = run(Q, PRESETS[cur], step, +phiIn.value * Math.PI / 180), counts = s.map(function () { return 0; });
        for (var k = 0; k < 100; k++) counts[Q.sample(s)]++;
        shots.textContent = '100 fresh runs, each measured once: ' + counts.map(function (c, k) { return Q.label(PRESETS[cur].n, k) + ' ×' + c; }).join(', ') +
          '. Each run gives one definite answer; the amplitudes only set the odds.';
        return;
      }
      render();
    });
    phiIn.addEventListener('input', render);
    render();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})(typeof window !== 'undefined' ? window : globalThis);
