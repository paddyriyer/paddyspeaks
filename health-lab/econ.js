/* Health Intelligence Lab — the two calculators that run in the browser, because
   they work on the visitor's own assumptions, not on health data:
     trajectory()   the Goal Studio's arithmetic projection
     program()      the payer/program cost model
     sensitivity()  program() across a grid of assumptions
   Pure functions, no DOM. Tested by health-lab/tests/econ.mjs.
   Nothing here contains a savings figure: utilization change defaults to 0 and
   is always the visitor's hypothesis. */
(function (root) {
  'use strict';
  function trajectory(start, ratePerMonth, months, spreadPerMonth) {
    var out = [];
    for (var i = 0; i <= months; i++) {
      var mid = start + ratePerMonth * i, sp = Math.abs(spreadPerMonth) * i;
      out.push({ month: i, mid: mid, lo: mid - sp, hi: mid + sp });
    }
    return out;
  }

  var DEFAULTS = {
    eligible: 10000,        // people who could join (your plan's number)
    enrollPct: 20,          // % who join
    programCost: 300,       // program fee per participant per year
    deviceSubsidy: 150,     // one-time device or cuff subsidy per participant
    coaching: 240,          // coaching per participant per year
    clinicianReview: 120,   // clinician review time per participant per year
    techFixed: 250000,      // platform, security, support per year (fixed)
    baselineSpend: 6000,    // medical spending per participant per year BEFORE the program (your assumption)
    utilChangePct: 0,       // hypothetical % change in that spending (negative = lower). Default: no assumed effect
    years: 2                // evaluation period
  };

  function program(inp) {
    var x = {}; for (var k in DEFAULTS) x[k] = inp && inp[k] != null && isFinite(inp[k]) ? +inp[k] : DEFAULTS[k];
    var n = Math.max(0, Math.round(x.eligible * Math.max(0, Math.min(100, x.enrollPct)) / 100));
    var y = Math.max(0, x.years);
    var lines = {
      program: n * x.programCost * y,
      devices: n * x.deviceSubsidy,
      coaching: n * x.coaching * y,
      review: n * x.clinicianReview * y,
      technology: x.techFixed * y
    };
    var total = 0; for (var l in lines) total += lines[l];
    var base = n * x.baselineSpend * y;
    var spendChange = base * x.utilChangePct / 100;
    var net = total + spendChange;                  // > 0: the program costs more than it changes spending
    return {
      participants: n, years: y, lines: lines, totalCost: total,
      costPerParticipantYear: n && y ? total / (n * y) : null,
      baselineSpend: base, spendingChange: spendChange, net: net,
      // the reduction in participants' spending needed for the program to pay for itself
      breakEvenReductionPct: base > 0 ? total / base * 100 : null
    };
  }

  function sensitivity(inp, utilSteps, enrollSteps) {
    utilSteps = utilSteps || [-20, -10, -5, 0, 5];
    enrollSteps = enrollSteps || [5, 10, 20, 40];
    return enrollSteps.map(function (e) {
      return { enrollPct: e, cells: utilSteps.map(function (u) {
        var o = {}; for (var k in inp) o[k] = inp[k]; o.enrollPct = e; o.utilChangePct = u;
        return { utilChangePct: u, net: program(o).net };
      }) };
    });
  }

  var api = { trajectory: trajectory, program: program, sensitivity: sensitivity, DEFAULTS: DEFAULTS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.HL = root.HL || {}; root.HL.econ = api; }
})(this);
