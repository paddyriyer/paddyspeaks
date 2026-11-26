// node health-lab/tests/econ.mjs — the browser-side calculators.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const E = createRequire(import.meta.url)('../econ.js');

// trajectory: pure arithmetic on the visitor's assumptions
const t = E.trajectory(100, -2, 6, 0.5);
assert.equal(t.length, 7);
assert.equal(t[0].mid, 100); assert.equal(t[6].mid, 88);
assert.equal(t[6].lo, 85); assert.equal(t[6].hi, 91);

// program: hand-checked example
const r = E.program({ eligible: 1000, enrollPct: 10, programCost: 100, deviceSubsidy: 50, coaching: 0, clinicianReview: 0,
  techFixed: 1000, baselineSpend: 1000, utilChangePct: 0, years: 2 });
assert.equal(r.participants, 100);
assert.equal(r.totalCost, 100 * 100 * 2 + 100 * 50 + 1000 * 2);   // 27,000
assert.equal(r.spendingChange, 0);
assert.equal(r.net, r.totalCost);
assert.equal(r.breakEvenReductionPct, 27000 / (100 * 1000 * 2) * 100); // 13.5%

// no savings are assumed by default
const d = E.program({});
assert.equal(d.spendingChange, 0);
assert.ok(d.net > 0, 'with no assumed effect the program is a cost');

// a spending reduction exactly at break-even nets to zero
const be = E.program({ ...E.DEFAULTS, utilChangePct: -d.breakEvenReductionPct });
assert.ok(Math.abs(be.net) < 1e-6);

// guards: zero enrollment never divides by zero; nonsense input falls back to defaults
const z = E.program({ enrollPct: 0 });
assert.equal(z.participants, 0); assert.equal(z.costPerParticipantYear, null);
assert.equal(E.program({ eligible: NaN }).participants, Math.round(E.DEFAULTS.eligible * E.DEFAULTS.enrollPct / 100));

// sensitivity grid matches program()
const s = E.sensitivity(E.DEFAULTS, [-5, 0], [10, 20]);
assert.equal(s.length, 2); assert.equal(s[1].cells[0].net, E.program({ ...E.DEFAULTS, enrollPct: 20, utilChangePct: -5 }).net);
// processing economics: hand-checked, and fixed costs dominate at small scale
const pr = E.processing(1000, { storageGbPerUser: 1, storagePrice: 0.02, computePerUser: 0.1, aiPerReport: 0.01, reportsPerUser: 2,
  supportPerUserCloud: 0.5, securityOpsCloud: 1000, complianceCloud: 500, clinicalReviewPerUser: 0, hostingLocal: 10,
  supportPerUserLocal: 0.1, securityLocal: 100, complianceLocal: 50 });
assert.equal(Math.round(pr.cloudTotal * 100) / 100, 1000 * (0.02 + 0.1 + 0.02 + 0.5) + 1500);   // 2,140
assert.equal(Math.round(pr.localTotal * 100) / 100, 10 + 100 + 100 + 50);                         // 260
assert.ok(E.processing(1000).cloudPerUser > E.processing(100000).cloudPerUser, 'fixed costs spread with scale');
assert.equal(E.processing(0).cloudPerUser, null);
assert.equal(E.processing(10000, { aiPerReport: 0 }).cloud.ai, 0, 'no AI, no AI cost');
console.log('✓ econ.js: 17 checks passed');
