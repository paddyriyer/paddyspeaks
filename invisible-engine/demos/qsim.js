/* A tiny, exact state-vector simulator for The Invisible Engine's quantum demos
 * (H: circuit stepper, I: Grover). One to three qubits; complex amplitudes as [re, im].
 * Basis order: |q0 q1 …⟩ with q0 the leftmost (most significant) bit.
 * Ideal gates only — no noise — and measurement is a separate step that samples
 * from the Born-rule probabilities |amplitude|². Tested by tests/demos.mjs.
 */
(function (root) {
  'use strict';
  var R = Math.SQRT1_2;
  function c(re, im) { return [re, im || 0]; }
  function add(a, b) { return [a[0] + b[0], a[1] + b[1]]; }
  function mul(a, b) { return [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]]; }
  function abs2(a) { return a[0] * a[0] + a[1] * a[1]; }
  function expi(phi) { return [Math.cos(phi), Math.sin(phi)]; }

  var GATES = {
    X: [[c(0), c(1)], [c(1), c(0)]],
    Z: [[c(1), c(0)], [c(0), c(-1)]],
    H: [[c(R), c(R)], [c(R), c(-R)]],
    S: [[c(1), c(0)], [c(0), c(0, 1)]]
  };
  function P(phi) { return [[c(1), c(0)], [c(0), expi(phi)]]; }   // phase gate: |1⟩ gets e^{iφ}

  function zero(n) { var s = []; for (var i = 0; i < (1 << n); i++) s.push(c(i === 0 ? 1 : 0)); return s; }
  function basis(n, k) { var s = zero(n); s[0] = c(0); s[k] = c(1); return s; }

  function apply1(state, n, q, U) {            // single-qubit gate U on qubit q
    var out = state.map(function () { return c(0); }), bit = 1 << (n - 1 - q);
    for (var i = 0; i < state.length; i++) {
      var b = (i & bit) ? 1 : 0, j0 = i & ~bit, j1 = i | bit;
      out[j0] = add(out[j0], mul(U[0][b], state[i]));
      out[j1] = add(out[j1], mul(U[1][b], state[i]));
    }
    return out;
  }
  function cnot(state, n, control, target) {
    var cb = 1 << (n - 1 - control), tb = 1 << (n - 1 - target);
    return state.map(function (_, i) { return state[(i & cb) ? (i ^ tb) : i]; });
  }
  function probs(state) { return state.map(abs2); }
  function norm(state) { return probs(state).reduce(function (a, b) { return a + b; }, 0); }
  function label(n, i) { var s = ''; for (var q = n - 1; q >= 0; q--) s += (i >> q) & 1; return '|' + s + '⟩'; }
  function sample(state, rnd) {
    var r = (rnd || Math.random)(), acc = 0, p = probs(state);
    for (var i = 0; i < p.length; i++) { acc += p[i]; if (r < acc) return i; }
    return p.length - 1;
  }

  // Grover on n qubits: oracle flips the sign of the marked item; diffusion reflects about the mean.
  function uniform(n) { var a = 1 / Math.sqrt(1 << n); return zero(n).map(function () { return c(a); }); }
  function oracle(state, marked) { return state.map(function (a, i) { return i === marked ? [-a[0], -a[1]] : a; }); }
  function diffuse(state) {
    var m = state.reduce(function (s, a) { return add(s, a); }, c(0));
    m = [m[0] / state.length, m[1] / state.length];
    return state.map(function (a) { return [2 * m[0] - a[0], 2 * m[1] - a[1]]; });
  }
  function mean(state) { var m = state.reduce(function (s, a) { return add(s, a); }, c(0)); return [m[0] / state.length, m[1] / state.length]; }
  function groverIterations(N) { return Math.floor(Math.PI / 4 * Math.sqrt(N)); }

  root.IEQ = { c: c, add: add, mul: mul, abs2: abs2, expi: expi, GATES: GATES, P: P, zero: zero, basis: basis,
    apply1: apply1, cnot: cnot, probs: probs, norm: norm, label: label, sample: sample,
    uniform: uniform, oracle: oracle, diffuse: diffuse, mean: mean, groverIterations: groverIterations };
})(typeof window !== 'undefined' ? window : globalThis);
